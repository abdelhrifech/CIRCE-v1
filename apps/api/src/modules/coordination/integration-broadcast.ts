// COO-P06 — passage d'intégration Broadcast → Circé : verrou (un seul passage à la fois, RG-COO-102),
// prérequis et ordre fixe des flux (RG-COO-115), journal de chargement par flux et arrêt sur échec
// (RG-COO-116), délai par transaction (RG-COO-117), transaction par dossier / groupe / flux (RG-COO-091,
// 102), envoi des messages vers Broadcast rejoué au passage suivant (RG-COO-125, 131, 132, 134), alerte
// technique après deux échecs consécutifs et planificateur interne (RG-COO-103, HYPOTHÈSE Q-211). La source
// réelle (lecture chez Broadcast) est le port BroadcastPort : aucun adaptateur réel (Q-005, BLOQUÉ).
import {
  FLUX_INTEGRATION,
  LotIntegrationSchema,
  STATUT_FLUX,
  type FluxIntegration,
  type LotIntegration,
  type PassageIntegrationDto,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError, ForbiddenError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import type { BroadcastPort, MessageBroadcast } from '../../core/ports/broadcast.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import { integrerLignesBus } from '../bus/service.ts'
import type { Tx } from '../../core/transaction.ts'
import { Prisma } from '../../generated/prisma/client.ts'
import { lireParametreNombre, lireParametreTexte } from '../reception/parametres.ts'
import { traiterDossiersNonLus } from './alimentation-lignes.ts'
import { CIRCE_AUTOMATIQUE } from './integration-commun.ts'
import {
  compteursVides,
  faceAIntegrer,
  grouperFacesParDossier,
  integrerAnnulation,
  integrerDestinataires,
  integrerEtatReservationsDossier,
  integrerFacesInstruction,
  integrerGroupePreparation,
  integrerInstructionLue,
  lireAtelierDeroulant,
  lireParametresPreparation,
  lireTypesVisuels,
  mettreAJourRessourcesPanels,
  panelsATraiter,
  supprimerFacesRemplacables,
  type Compteurs,
} from './integration-flux.ts'
import { cleRetour, populationRetour } from './retour-broadcast.ts'
import { COO, assertDroitCoordination, dossierDuPerimetre } from './permissions.ts'

export const INTEGRATION = {
  enCours: { code: 'COO_PASSAGE_EN_COURS', regle: 'RG-COO-102' },
} as const

/** RG-COO-116 : message d'erreur nettoyé (pas de SQL, pas de pile ; 500 caractères max). */
export function nettoyerMessage(error: unknown): string {
  const brut = error instanceof Error ? error.message : String(error)
  const lignes = brut.split('\n').filter((l) => l.trim() !== '' && !/^\s*at\s/.test(l))
  // Erreur Prisma : la 1re ligne cite l'appel (« Invalid `tx.x.create()` invocation… ») et la DERNIÈRE la
  // cause ; le code source cité entre les deux n'est jamais repris.
  const retenue =
    (/^Invalid `/.test(lignes[0] ?? '') ? lignes.at(-1) : lignes[0]) ?? 'Erreur inconnue'
  return retenue.replace(/\s+/g, ' ').trim().slice(0, 500)
}

// RG-COO-103 : prochain horaire planifié (« HH:MM », heure locale du serveur) strictement après `maintenant`.
export function prochainHoraire(horaires: string[], maintenant: Date): Date | null {
  const minutes = horaires
    .map((h) => /^(\d{1,2}):(\d{2})$/.exec(h.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]) * 60 + Number(m[2]))
    .filter((m) => m < 24 * 60)
    .sort((a, b) => a - b)
  if (minutes.length === 0) return null
  for (let jour = 0; jour < 2; jour++)
    for (const m of minutes) {
      const d = new Date(maintenant)
      d.setDate(d.getDate() + jour)
      d.setHours(Math.floor(m / 60), m % 60, 0, 0)
      if (d > maintenant) return d
    }
  return null
}

export const lireHoraires = async (client: Db | Tx) =>
  (await lireParametreTexte(client, 'integration.horaires'))
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)

/** Délai d'une transaction d'intégration (RG-COO-117). */
async function delaiMs(db: Db) {
  return Math.max(1, await lireParametreNombre(db, 'integration.timeoutSecondes')) * 1000
}

/** Transaction d'une unité (dossier, groupe, flux) avec délai paramétré (RG-COO-117). */
function unite<T>(db: Db, timeout: number, fn: (tx: Tx) => Promise<T>) {
  return db.$transaction(fn, { timeout, maxWait: timeout })
}

interface ResultatFlux extends Compteurs {
  erreurs: number
  message: string | null
  details: unknown
}

export interface ContexteIntegration {
  db: Db
  broadcast: BroadcastPort
  maintenant?: () => Date
}

// ───────────────────────────── Envoi vers Broadcast ─────────────────────────────

/** RG-COO-125 / 131 / 132 / 134 : message mis en file (dans la transaction de l'appelant). */
export function mettreEnFile(tx: Tx, m: MessageBroadcast, parId: number | null = null) {
  return tx.envoiBroadcast.create({
    data: { type: m.type, cle: m.cle, donnees: JSON.stringify(m.donnees), parId },
  })
}

// RG-COO-125 : les messages non envoyés sont rejoués à chaque passage ; un échec est journalisé (tentatives,
// message) sans faire échouer le passage. RG-COO-134 : le drapeau `envoye` d'une affiche n'est posé qu'après
// un envoi réussi, et n'est jamais remis à faux.
export async function envoyerEnAttente(ctx: ContexteIntegration, ids?: number[]) {
  const { db, broadcast } = ctx
  const enAttente = await db.envoiBroadcast.findMany({
    where: { statut: 'A_ENVOYER', ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { id: 'asc' },
  })
  let envoyes = 0
  let echecs = 0
  let dernierMessage: string | null = null
  // Les envois réussis sont validés en base par paquets (une transaction par paquet, pas par message) : un
  // premier retour peut compter des milliers de lignes. Un arrêt entre l'envoi et la validation du paquet fait
  // renvoyer au plus un paquet au passage suivant (rejeu idempotent, RG-COO-125).
  const PAQUET = 100
  let reussis: typeof enAttente = []
  const valider = async () => {
    if (reussis.length === 0) return
    const lot = reussis
    reussis = []
    await db.$transaction(async (tx) => {
      await tx.envoiBroadcast.updateMany({
        where: { id: { in: lot.map((e) => e.id) } },
        data: { statut: 'ENVOYE', envoyeLe: new Date(), tentatives: { increment: 1 } },
      })
      const afficheIds = lot
        .filter((e) => e.type === 'RETOUR_RECEPTION')
        .map((e) => (JSON.parse(e.donnees) as { afficheId: number }).afficheId)
      if (afficheIds.length > 0)
        await tx.affiche.updateMany({ where: { id: { in: afficheIds } }, data: { envoye: true } })
    })
  }
  for (const e of enAttente) {
    try {
      await broadcast.envoyer({
        type: e.type as MessageBroadcast['type'],
        cle: e.cle,
        donnees: JSON.parse(e.donnees) as unknown,
      })
      reussis.push(e)
      envoyes++
      if (reussis.length >= PAQUET) await valider()
    } catch (error) {
      echecs++
      dernierMessage = nettoyerMessage(error)
      await db.envoiBroadcast.update({
        where: { id: e.id },
        data: { tentatives: { increment: 1 }, message: dernierMessage },
      })
    }
  }
  await valider()
  return { envoyes, echecs, dernierMessage }
}

// ───────────────────────────── Flux ─────────────────────────────

async function fluxEtatReservations(
  ctx: ContexteIntegration,
  lot: LotIntegration,
  timeout: number,
): Promise<ResultatFlux> {
  const lignes = lot.etatReservations ?? []
  const r: ResultatFlux = { ...compteursVides(), erreurs: 0, message: null, details: null }
  const lignesBus = lot.bus ?? []
  r.lues = lignes.length + lignesBus.length
  // RG-COO-091 : lecture vide → rien n'est écrit.
  if (lignes.length === 0 && lignesBus.length === 0) return r
  const parDossier = new Map<number, typeof lignes>()
  for (const l of lignes) parDossier.set(l.contNum, [...(parDossier.get(l.contNum) ?? []), l])
  for (const l of lignesBus) if (!parDossier.has(l.contNum)) parDossier.set(l.contNum, [])
  const erreurs: { contNum: number; message: string }[] = []
  for (const [contNum, du] of parDossier) {
    try {
      // RG-COO-091 / 102 : transaction PAR DOSSIER ; une erreur annule ce dossier seulement.
      const c = await unite(ctx.db, timeout, async (tx) => {
        const normal = du.length
          ? await integrerEtatReservationsDossier(tx, contNum, du, lot.lueLe)
          : { creees: 0, misesAJour: 0, ignorees: 0 }
        const bus = await integrerLignesBus(
          tx,
          lignesBus.filter((l) => l.contNum === contNum),
          lot.lueLe,
        )
        return {
          creees: normal.creees + bus.creees,
          misesAJour: normal.misesAJour + bus.misesAJour,
          ignorees: normal.ignorees + bus.ignorees,
        }
      })
      r.creees += c.creees
      r.misesAJour += c.misesAJour
      r.ignorees += c.ignorees
    } catch (error) {
      erreurs.push({ contNum, message: nettoyerMessage(error) })
    }
  }
  // RG-COO-087 : dossiers absents d'une lecture COMPLÈTE de la fenêtre : lignes « plus vues ». Un lot partiel
  // (lectureComplete = false) ne marque ni ne ferme rien hors de ses dossiers (Q-188 (1)).
  if (lot.lectureComplete && lot.etatReservations !== undefined) {
    // Le flux Bus a son propre grain et sa propre fenêtre ; un EDR classique ne l’annule pas.
    const dossiersBus = await ctx.db.busLigne.findMany({ select: { dossierId: true } })
    const contratsBus = await ctx.db.dossier.findMany({
      where: { id: { in: [...new Set(dossiersBus.map((l) => l.dossierId))] } },
      select: { contNum: true },
    })
    const nonLus = await unite(ctx.db, timeout, (tx) =>
      traiterDossiersNonLus(tx, lot.lueLe, [
        ...new Set([...parDossier.keys(), ...contratsBus.map((d) => d.contNum)]),
      ]),
    )
    r.misesAJour += nonLus.nonVues + nonLus.fermees
  }
  r.erreurs = erreurs.length
  if (erreurs.length > 0) {
    r.message = `${String(erreurs.length)} dossier(s) en erreur, annulé(s) sans écriture partielle.`
    r.details = { erreurs }
    await ctx.db.$transaction((tx) =>
      ecrireJournal(tx, {
        typeEntite: 'REFERENTIEL',
        entiteId: 'integration',
        action: 'INTEGRATION_ECHEC',
        parId: null,
        nouvelleValeur: r.message,
        complement: 'RG-COO-091',
        donnees: { erreurs },
      }),
    )
  }
  return r
}

async function fluxDestinataires(
  ctx: ContexteIntegration,
  lot: LotIntegration,
  timeout: number,
  maintenant: Date,
): Promise<ResultatFlux> {
  const lus = lot.destinataires ?? []
  // RG-COO-102 : transaction par flux.
  const c = await unite(ctx.db, timeout, (tx) => integrerDestinataires(tx, lus, maintenant))
  return { ...c, erreurs: 0, message: null, details: null }
}

async function fluxPreparations(
  ctx: ContexteIntegration,
  lot: LotIntegration,
  timeout: number,
): Promise<ResultatFlux> {
  const groupes = lot.preparations ?? []
  const r: ResultatFlux = { ...compteursVides(), erreurs: 0, message: null, details: null }
  const p = await lireParametresPreparation(ctx.db)
  const erreurs: { idGroupe: number; message: string }[] = []
  let refusees = 0
  for (const g of groupes) {
    try {
      // Transaction PAR GROUPE (RG-COO-102) ; RG-COO-125 : l'accusé est mis en file dans la même
      // transaction, envoyé après la validation (pas de transaction distribuée, rejoué si l'envoi échoue).
      const gr = await unite(ctx.db, timeout, async (tx) => {
        const res = await integrerGroupePreparation(tx, g, p, lot.lueLe)
        if (res.integre)
          await mettreEnFile(tx, {
            type: 'ACCUSE_PREPA',
            cle: String(g.idGroupe),
            donnees: { idGroupe: g.idGroupe, statut: 'INTEGRE', dossiers: res.dossiers },
          })
        return res
      })
      r.lues += gr.lues
      r.creees += gr.creees
      r.ignorees += gr.ignorees
      refusees += gr.refusees
    } catch (error) {
      r.lues += g.details.length
      erreurs.push({ idGroupe: g.idGroupe, message: nettoyerMessage(error) })
    }
  }
  r.erreurs = erreurs.length
  if (refusees > 0 || erreurs.length > 0)
    r.message = [
      refusees > 0 ? `${String(refusees)} détail(s) renvoyé(s) non intégré(s) (RG-COO-122)` : '',
      erreurs.length > 0 ? `${String(erreurs.length)} groupe(s) en erreur` : '',
    ]
      .filter(Boolean)
      .join(' ; ')
  r.details = { refusees, erreurs }
  return r
}

async function fluxTrains(
  ctx: ContexteIntegration,
  lot: LotIntegration,
  timeout: number,
  maintenant: Date,
): Promise<ResultatFlux> {
  const faces = lot.trains ?? []
  const r: ResultatFlux = { ...compteursVides(), erreurs: 0, message: null, details: null }
  r.lues = faces.length
  const aIntegrer = faces.filter(faceAIntegrer)
  r.ignorees = faces.length - aIntegrer.length
  const table = lireAtelierDeroulant(
    await lireParametreTexte(ctx.db, 'integration.atelierDeroulant'),
  )
  const purges: number[] = []
  const erreurs: { contNum: number; message: string }[] = []
  for (const groupes of grouperFacesParDossier(aIntegrer)) {
    const premiere = groupes[0]?.[0]
    if (!premiere) continue
    try {
      // RG-COO-129 : suppression (une fois) puis recréation des faces, transactionnelle par dossier × semaine.
      const c = await unite(ctx.db, timeout, async (tx) => {
        const total = compteursVides()
        // RG-COO-130 : panels déjà présents, relevés AVANT la suppression des anciennes faces.
        const panels = await panelsATraiter(tx, groupes.flat())
        total.misesAJour = await supprimerFacesRemplacables(
          tx,
          premiere.contNum,
          premiere.semaine,
          maintenant,
        )
        for (const groupe of groupes) {
          const g = await integrerFacesInstruction(tx, groupe, table)
          total.creees += g.creees
          total.ignorees += g.ignorees
        }
        // RG-COO-130 (3e clause) : ressource reportée sur les panels encore entièrement modifiables.
        await mettreAJourRessourcesPanels(tx, panels)
        return total
      })
      r.creees += c.creees
      r.misesAJour += c.misesAJour
      r.ignorees += c.ignorees
      purges.push(...groupes.flat().map((f) => f.idInterface))
    } catch (error) {
      erreurs.push({ contNum: premiere.contNum, message: nettoyerMessage(error) })
    }
  }
  // RG-COO-131 : seuls les Id intégrés sont supprimés côté INTERFACE ; un groupe en erreur reste pour le
  // passage suivant (intégration idempotente).
  if (purges.length > 0)
    await ctx.db.$transaction((tx) =>
      mettreEnFile(tx, {
        type: 'PURGE_INTERFACE',
        cle: `trains:${lot.lueLe.toISOString()}`,
        donnees: { flux: 'TRAINS', ids: purges },
      }),
    )
  r.erreurs = erreurs.length
  if (erreurs.length > 0) {
    r.message = `${String(erreurs.length)} dossier(s) en erreur : faces non remplacées.`
    r.details = { erreurs }
  }
  return r
}

async function fluxInstructions(
  ctx: ContexteIntegration,
  lot: LotIntegration,
  timeout: number,
): Promise<ResultatFlux> {
  const instructions = lot.instructions ?? []
  const r: ResultatFlux = { ...compteursVides(), erreurs: 0, message: null, details: null }
  r.lues = instructions.length + (lot.dossiersAnnules?.length ?? 0)
  const table = lireAtelierDeroulant(
    await lireParametreTexte(ctx.db, 'integration.atelierDeroulant'),
  )
  const types = lireTypesVisuels(await lireParametreTexte(ctx.db, 'integration.typesVisuels'))
  const purges: number[] = []
  const erreurs: { contNum: number; message: string }[] = []
  for (const i of instructions) {
    try {
      const { resultat } = await unite(ctx.db, timeout, (tx) =>
        integrerInstructionLue(tx, i, table, types),
      )
      if (resultat === 'CREEE') r.creees++
      else if (resultat === 'MISE_A_JOUR' || resultat === 'ROUVERTE') r.misesAJour++
      else r.ignorees++
      purges.push(i.idInterface)
    } catch (error) {
      erreurs.push({ contNum: i.contNum, message: nettoyerMessage(error) })
    }
  }
  for (const contNum of lot.dossiersAnnules ?? []) {
    try {
      const res = await unite(ctx.db, timeout, (tx) => integrerAnnulation(tx, contNum))
      if (res === 'ANNULE') r.misesAJour++
      else r.ignorees++
    } catch (error) {
      erreurs.push({ contNum, message: nettoyerMessage(error) })
    }
  }
  if (purges.length > 0)
    await ctx.db.$transaction((tx) =>
      mettreEnFile(tx, {
        type: 'PURGE_INTERFACE',
        cle: `instructions:${lot.lueLe.toISOString()}`,
        donnees: { flux: 'INSTRUCTIONS', ids: purges },
      }),
    )
  r.erreurs = erreurs.length
  if (erreurs.length > 0) {
    r.message = `${String(erreurs.length)} instruction(s) / annulation(s) en erreur.`
    r.details = { erreurs }
  }
  return r
}

// RG-COO-134 : retour « reçue et associée » : seuls les CHANGEMENTS (clé + quantité + EstAssociee) sont mis
// en file ; un message non encore envoyé de la même clé est remplacé ; lignes écartées journalisées. Puis
// tous les messages en attente sont (re)tentés (RG-COO-125).
async function fluxRetour(
  ctx: ContexteIntegration,
  timeout: number,
  maintenant: Date,
): Promise<ResultatFlux> {
  const r: ResultatFlux = { ...compteursVides(), erreurs: 0, message: null, details: null }
  await unite(ctx.db, timeout, async (tx) => {
    const { lignes, ecartees } = await populationRetour(tx, maintenant)
    r.lues = lignes.length + ecartees.length
    r.ignorees = ecartees.length
    // Dernier message de chaque clé, lu par paquets (une requête par paquet, pas une par ligne).
    const derniers = new Map<string, { id: number; statut: string; donnees: string }>()
    for (let i = 0; i < lignes.length; i += 400) {
      const cles = lignes.slice(i, i + 400).map(cleRetour)
      for (const e of await tx.envoiBroadcast.findMany({
        where: {
          type: 'RETOUR_RECEPTION',
          cle: { in: cles },
          statut: { in: ['A_ENVOYER', 'ENVOYE'] },
        },
        orderBy: { id: 'asc' },
      }))
        derniers.set(e.cle, e)
    }
    const aRemplacer: number[] = []
    const aCreer: { type: string; cle: string; donnees: string; parId: null }[] = []
    for (const l of lignes) {
      const cle = cleRetour(l)
      const donnees = JSON.stringify(l)
      const dernier = derniers.get(cle)
      if (dernier?.donnees === donnees) continue
      if (dernier?.statut === 'A_ENVOYER' && dernier.id > 0) aRemplacer.push(dernier.id)
      aCreer.push({ type: 'RETOUR_RECEPTION', cle, donnees, parId: null })
      // Une même clé répétée dans la population n'est mise en file qu'une fois (id < 0 : créé dans ce passage).
      derniers.set(cle, { id: -1, statut: 'A_ENVOYER', donnees })
    }
    for (let i = 0; i < aRemplacer.length; i += 400)
      await tx.envoiBroadcast.updateMany({
        where: { id: { in: aRemplacer.slice(i, i + 400) } },
        data: { statut: 'REMPLACE' },
      })
    for (let i = 0; i < aCreer.length; i += 200)
      await tx.envoiBroadcast.createMany({ data: aCreer.slice(i, i + 200) })
    r.creees += aCreer.length
    if (ecartees.length > 0)
      await ecrireJournal(tx, {
        typeEntite: 'REFERENTIEL',
        entiteId: 'retour-broadcast',
        action: 'RETOUR_BROADCAST',
        parId: null,
        nouvelleValeur: `${String(ecartees.length)} ligne(s) écartée(s) du retour vers Broadcast`,
        complement: 'RG-COO-134',
        donnees: { ecartees },
      })
  })
  const envoi = await envoyerEnAttente(ctx)
  r.misesAJour = envoi.envoyes
  if (envoi.echecs > 0)
    r.message = `${String(envoi.echecs)} message(s) vers Broadcast en attente : ${envoi.dernierMessage ?? ''}`
  r.details = envoi
  return r
}

// ───────────────────────────── Passage ─────────────────────────────

/** Libère un verrou laissé par un passage interrompu (arrêt du serveur) au-delà de 6 × le délai d'un flux. */
async function libererVerrouPerime(db: Db, timeout: number, maintenant: Date) {
  const perime = new Date(maintenant.getTime() - 6 * timeout)
  await db.passageIntegration.updateMany({
    where: { verrou: 'ACTIF', debut: { lt: perime } },
    data: {
      verrou: null,
      statut: 'ECHEC',
      fin: maintenant,
      message: 'Passage interrompu (verrou périmé libéré).',
    },
  })
}

export async function lancerPassage(
  ctx: ContexteIntegration,
  o: {
    declencheur: 'PLANIFIE' | 'MANUEL' | 'LOT'
    identity: Identity | null
    lot?: LotIntegration
  },
): Promise<PassageIntegrationDto> {
  const { db } = ctx
  const maintenant = ctx.maintenant?.() ?? new Date()
  const timeout = await delaiMs(db)
  await libererVerrouPerime(db, timeout, maintenant)
  // RG-COO-102 : un seul passage actif à la fois (unicité du verrou) → 409.
  let passage
  try {
    passage = await db.passageIntegration.create({
      data: {
        declencheur: o.declencheur,
        parId: o.identity?.userId ?? null,
        statut: 'EN_COURS',
        verrou: 'ACTIF',
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new ConflictError('Un passage d’intégration est déjà en cours.', INTEGRATION.enCours)
    throw error
  }
  let statut: 'SUCCES' | 'ECHEC' = 'SUCCES'
  let message: string | null = null
  try {
    let lot = o.lot
    if (!lot) {
      // RG-COO-104 / 117 : lecture du lot chez Broadcast (délai borné) ; RG-COO-092 : colonne absente →
      // erreur de lecture explicite.
      let minuterie: NodeJS.Timeout | undefined
      const lu = await Promise.race([
        ctx.broadcast.lireLot(),
        new Promise<never>((_, rejeter) => {
          minuterie = setTimeout(() => {
            rejeter(new Error('Délai de lecture Broadcast dépassé.'))
          }, timeout)
        }),
      ]).finally(() => {
        clearTimeout(minuterie)
      })
      const verifie = LotIntegrationSchema.safeParse(lu)
      if (!verifie.success)
        throw new Error(
          `Lecture Broadcast invalide : ${verifie.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.')} ${i.message}`)
            .join(' ; ')}`,
        )
      lot = verifie.data
    }
    // RG-COO-115 : prérequis — interface de chargement du premier flux.
    if (lot.idInterface === null) throw new Error('IdInterface non récupéré !')
    const lotVerifie = lot
    const executions: Record<FluxIntegration, () => Promise<ResultatFlux>> = {
      ETAT_RESERVATIONS: () => fluxEtatReservations(ctx, lotVerifie, timeout),
      DESTINATAIRES: () => fluxDestinataires(ctx, lotVerifie, timeout, maintenant),
      PREPARATIONS: () => fluxPreparations(ctx, lotVerifie, timeout),
      TRAINS: () => fluxTrains(ctx, lotVerifie, timeout, maintenant),
      INSTRUCTIONS: () => fluxInstructions(ctx, lotVerifie, timeout),
      RETOUR_BROADCAST: () => fluxRetour(ctx, timeout, maintenant),
    }
    const presents: Record<FluxIntegration, boolean> = {
      ETAT_RESERVATIONS: lot.etatReservations !== undefined || lot.bus !== undefined,
      DESTINATAIRES: lot.destinataires !== undefined,
      PREPARATIONS: lot.preparations !== undefined,
      TRAINS: lot.trains !== undefined,
      INSTRUCTIONS: lot.instructions !== undefined || lot.dossiersAnnules !== undefined,
      RETOUR_BROADCAST: true,
    }
    // RG-COO-115 : ordre fixe ; RG-COO-116 : un flux en échec arrête les suivants, les précédents restent.
    for (const [ordre, flux] of FLUX_INTEGRATION.entries()) {
      if (!presents[flux]) continue
      const journal = await db.fluxChargement.create({
        data: { passageId: passage.id, flux, ordre: ordre + 1, statut: STATUT_FLUX.EN_COURS },
      })
      try {
        const res = await executions[flux]()
        await db.fluxChargement.update({
          where: { id: journal.id },
          data: {
            statut: STATUT_FLUX.SUCCES,
            fin: new Date(),
            lues: res.lues,
            creees: res.creees,
            misesAJour: res.misesAJour,
            ignorees: res.ignorees,
            erreurs: res.erreurs,
            message: res.message,
            details: res.details === null ? null : JSON.stringify(res.details),
          },
        })
      } catch (error) {
        const m = nettoyerMessage(error)
        await db.fluxChargement.update({
          where: { id: journal.id },
          data: { statut: STATUT_FLUX.ECHEC, fin: new Date(), message: m },
        })
        throw new Error(`Flux ${flux} : ${m}`, { cause: error })
      }
    }
  } catch (error) {
    statut = 'ECHEC'
    message = nettoyerMessage(error)
  }
  await db.$transaction(async (tx) => {
    await tx.passageIntegration.update({
      where: { id: passage.id },
      data: { statut, verrou: null, fin: new Date(), message },
    })
    await ecrireJournal(tx, {
      typeEntite: 'REFERENTIEL',
      entiteId: `passage:${String(passage.id)}`,
      action: statut === 'SUCCES' ? 'INTEGRATION_FLUX' : 'INTEGRATION_ECHEC',
      parId: o.identity?.userId ?? null,
      nouvelleValeur: statut,
      complement: statut === 'ECHEC' ? 'RG-COO-116' : o.declencheur,
      donnees: {
        declencheur: o.declencheur,
        acteur: o.identity ? null : CIRCE_AUTOMATIQUE,
        message,
      },
    })
    // RG-COO-103 : alerte technique si deux passages consécutifs échouent.
    if (statut === 'ECHEC') {
      const precedent = await tx.passageIntegration.findFirst({
        where: { id: { lt: passage.id }, statut: { not: 'EN_COURS' } },
        orderBy: { id: 'desc' },
      })
      if (precedent?.statut === 'ECHEC')
        await ecrireJournal(tx, {
          typeEntite: 'REFERENTIEL',
          entiteId: `passage:${String(passage.id)}`,
          action: 'ALERTE_INTEGRATION',
          parId: null,
          nouvelleValeur: 'Deux passages d’intégration consécutifs en échec.',
          complement: 'RG-COO-103',
          donnees: { passages: [precedent.id, passage.id], message },
        })
    }
  })
  return (await lirePassages(db, passage.id))[0] as PassageIntegrationDto
}

async function lirePassages(db: Db, id?: number): Promise<PassageIntegrationDto[]> {
  const passages = await db.passageIntegration.findMany({
    where: id === undefined ? {} : { id },
    orderBy: { id: 'desc' },
    take: 30,
    include: { flux: { orderBy: { ordre: 'asc' } } },
  })
  const ids = [...new Set(passages.map((p) => p.parId).filter((x): x is number => x !== null))]
  const users = await db.utilisateur.findMany({
    where: { id: { in: ids } },
    select: { id: true, nom: true, identifiantExterne: true },
  })
  return passages.map((p) => {
    const u = users.find((x) => x.id === p.parId)
    return {
      id: p.id,
      declencheur: p.declencheur as PassageIntegrationDto['declencheur'],
      par: u ? (u.nom ?? u.identifiantExterne) : null,
      statut: p.statut as PassageIntegrationDto['statut'],
      debut: p.debut.toISOString(),
      fin: p.fin?.toISOString() ?? null,
      message: p.message,
      flux: p.flux.map((f) => ({
        id: f.id,
        flux: f.flux as FluxIntegration,
        ordre: f.ordre,
        statut: f.statut,
        debut: f.debut.toISOString(),
        fin: f.fin?.toISOString() ?? null,
        lues: f.lues,
        creees: f.creees,
        misesAJour: f.misesAJour,
        ignorees: f.ignorees,
        erreurs: f.erreurs,
        message: f.message,
      })),
    }
  })
}

// ───────────────────────────── Actions utilisateur ─────────────────────────────

// RG-COO-103 : passage manuel par l'administrateur, lu depuis la source (port Broadcast). Aucun lot n'est
// déposé par l'API (Q-188 (1)) : un lot n'entre que par le connecteur ou la commande `integration:lot`.
export function lancerPassageManuel(ctx: ContexteIntegration, identity: Identity) {
  assertDroitCoordination(identity, 'integration.passage_manuel', 'RG-COO-103')
  return lancerPassage(ctx, { declencheur: 'MANUEL', identity })
}

// RG-COO-116 : écran de suivi des chargements (passages, flux, erreurs) ; RG-COO-103 : horaires.
export async function listerPassages(ctx: ContexteIntegration, identity: Identity) {
  assertDroitCoordination(identity, 'alimentation.manuelle', 'RG-COO-116')
  return {
    passages: await lirePassages(ctx.db),
    envoisEnAttente: await ctx.db.envoiBroadcast.count({ where: { statut: 'A_ENVOYER' } }),
    horaires: await lireHoraires(ctx.db),
    planificateurActif: ctx.broadcast.configure,
  }
}

// RG-COO-132 : « Rafraîchir un dossier » (droit legacy train_rafraichir_contrat → coord / admin) : demande
// à Broadcast de ré-alimenter la zone de travail du dossier (procédure ope.P_ExportTrainAfficheTravailCirce,
// Q-005) ; Circé intègre au passage suivant. La demande est tracée et rejouée tant qu'elle n'est pas envoyée.
export async function rafraichirDossier(
  ctx: ContexteIntegration,
  identity: Identity,
  contNum: number,
) {
  assertDroitCoordination(identity, 'alimentation.manuelle', 'RG-COO-132')
  // RG-COO-167 : dossier connu de Circé → périmètre de l'utilisateur ; dossier encore inconnu (pas encore
  // intégré) → réservé aux utilisateurs de tous les sites (HYPOTHÈSE Q-188 (15)).
  const dossier = await ctx.db.dossier.findUnique({ where: { contNum }, select: { id: true } })
  if (dossier) await dossierDuPerimetre(ctx.db, identity, dossier.id)
  else if (!identity.perimetre.toutesPlateformes)
    throw new ForbiddenError(
      `Le dossier ${String(contNum)} n'est pas connu de Circé : seul un utilisateur de tous les sites peut le faire rafraîchir.`,
      COO.perimetre,
    )
  const envoi = await ctx.db.$transaction(async (tx) => {
    const e = await mettreEnFile(
      tx,
      { type: 'RAFRAICHIR_DOSSIER', cle: String(contNum), donnees: { contNum } },
      identity.userId,
    )
    await ecrireJournal(tx, {
      typeEntite: 'DOSSIER',
      entiteId: contNum,
      action: 'RAFRAICHIR_DOSSIER',
      parId: identity.userId,
      nouvelleValeur: 'Rafraîchissement demandé à Broadcast',
    })
    return e
  })
  const r = await envoyerEnAttente(ctx, [envoi.id])
  const envoye = r.envoyes === 1
  return {
    contNum,
    envoye,
    message: envoye
      ? `Dossier ${String(contNum)} : Broadcast ré-alimente la zone de travail ; Circé l’intègre au prochain passage.`
      : `Dossier ${String(contNum)} : demande enregistrée, envoyée à Broadcast dès que la liaison est disponible (${r.dernierMessage ?? 'non envoyée'}).`,
  }
}

/** RG-COO-116 (échec d'un passage ou d'un flux) et RG-COO-103 (deux échecs consécutifs) : alertes techniques
 * journalisées, lues par les Alertes Pré-Prod (COO-P07). */
export async function alertesIntegration(db: Db | Tx, depuis?: Date) {
  const lignes = await db.journalAudit.findMany({
    where: {
      action: { in: ['ALERTE_INTEGRATION', 'INTEGRATION_ECHEC'] },
      ...(depuis ? { le: { gte: depuis } } : {}),
    },
    orderBy: { id: 'desc' },
  })
  return lignes.map((l) => ({
    le: l.le,
    type: l.action === 'ALERTE_INTEGRATION' ? ('ECHECS_CONSECUTIFS' as const) : ('ECHEC' as const),
    message:
      l.action === 'ALERTE_INTEGRATION'
        ? (l.nouvelleValeur ?? '')
        : `Intégration Broadcast en échec : ${(JSON.parse(l.donnees ?? '{}') as { message?: string }).message ?? l.nouvelleValeur ?? ''}`,
    regle: l.action === 'ALERTE_INTEGRATION' ? 'RG-COO-103' : (l.complement ?? 'RG-COO-116'),
  }))
}

// ───────────────────────────── Planificateur (RG-COO-103) ─────────────────────────────

// HYPOTHÈSE Q-211 : planificateur interne à l'API, horaires paramétrés. Il ne démarre que si une source
// Broadcast réelle est branchée (Q-005) : sans source, aucun passage automatique n'est tenté.
export function demarrerPlanificateur(
  ctx: ContexteIntegration,
  journal: (message: string, erreur?: unknown) => void,
): () => void {
  let minuterie: NodeJS.Timeout | undefined
  let arrete = false
  const planifier = async () => {
    if (arrete) return
    const prochain = prochainHoraire(await lireHoraires(ctx.db), new Date())
    if (!prochain) return
    minuterie = setTimeout(() => {
      lancerPassage(ctx, { declencheur: 'PLANIFIE', identity: null })
        .catch((e: unknown) => {
          journal('Passage planifié non lancé', e)
        })
        .finally(() => {
          void planifier()
        })
    }, prochain.getTime() - Date.now())
  }
  if (ctx.broadcast.configure) void planifier()
  return () => {
    arrete = true
    if (minuterie) clearTimeout(minuterie)
  }
}
