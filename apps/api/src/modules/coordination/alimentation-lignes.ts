// COO-P05 — règles de vie des lignes attendues (RG-COO-080 à 089, 094 à 097). Fonctions appelées par le
// passage d'intégration (integration-flux.ts, COO-P06 : flux « état des réservations » et « préparations »),
// DANS la transaction de l'appelant (RG-COO-091 / 102 : transaction par dossier ou par flux). La récupération
// des données chez Broadcast (planification, procédures) est hors dépôt (Q-005, BLOQUÉ) : ces fonctions
// travaillent sur un contrat d'entrée interne (HYPOTHÈSE Q-187 (1), Q-188 (1)). Acteur : « Circé (automatique) ».
import {
  comparerSemaines,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type SemaineIso,
} from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { Prisma, type ReceptionAttendue } from '../../generated/prisma/client.ts'
import { lireParametreNombre, lireParametreTexte } from '../reception/parametres.ts'
import { CIRCE_AUTOMATIQUE } from './integration-commun.ts'
import { mettreAJourLigneAttendue } from './lignes-maj.ts'
import { deplacerLien, fermerLigne } from './lignes-vie.ts'
import { COO } from './permissions.ts'
import { normaliserTheme } from './validation-admin.ts'

export { deplacerLien, fermerLigne } from './lignes-vie.ts'

// ───────────────────────────── Contrat d'entrée (HYPOTHÈSE Q-187 (1)) ─────────────────────────────

/** Une ligne de l'état des réservations lu chez Broadcast (P_CirceEtatReservation_New, RG-COO-092). */
export interface LigneLueBroadcast {
  idSiteCcf: number | null
  destinataire: string | null
  contNum: number
  annonceur: string | null
  idSurface: number | null
  idFormat: number | null
  idTheme: number | null
  theme: string | null
  idThemeBandeau: number | null
  idDaChapeau: number | null
  semaine: SemaineIso
  quantite: number
  estResteEnPlace: boolean
  statutPreparation: string | null
}

/** Une ligne « prépa » (RG-COO-094 (1) répartitions fixe / pliage, (2) faces du déroulant). */
export interface LignePrepa {
  plateformeId: number
  contNum: number
  supportId: number
  theme: string
  idTheme?: number | null
  idThemeBandeau: number | null
  atelierId: number | null
  annonceur: string | null
  semaine: SemaineIso
  quantite: number
}

export type TypeAlerteAlimentation =
  | 'DONNEE_REFERENCE_MANQUANTE'
  | 'THEME_SANS_NUMERO'
  | 'ECART_DA_PREPA'
  | 'AUCUN_CANDIDAT_THEME'
  | 'THEME_MODIFIE'
  | 'ECART_QUANTITE'
  | 'LIGNE_ANNULEE'

export interface AlerteAlimentation {
  type: TypeAlerteAlimentation
  /** Plateforme concernée (filtre de périmètre à la relecture, COO-P07). */
  plateformeId?: number | null
  regle: string
  message: string
  contNum?: number | null
  ligneAttendueId?: number
  afficheId?: number
}

export interface RapportAlimentation {
  lues: number
  exclues: number
  ecartees: number
  creees: number
  misesAJour: number
  provisoiresFermees: number
  liensDeplaces: number
  nonVues: number
  fermees: number
  alertes: AlerteAlimentation[]
}

const rapportVide = (): RapportAlimentation => ({
  lues: 0,
  exclues: 0,
  ecartees: 0,
  creees: 0,
  misesAJour: 0,
  provisoiresFermees: 0,
  liensDeplaces: 0,
  nonVues: 0,
  fermees: 0,
  alertes: [],
})

// ───────────────────────────── Fonctions pures ─────────────────────────────

// RG-COO-083 : semaines ISO, fenêtre S → S+n calculée en dates (lundi de la semaine courante + n semaines),
// sans cas particulier de fin d'année.
export function fenetreAlimentation(
  maintenant: Date,
  semaines: number,
): { debut: SemaineIso; fin: SemaineIso } {
  const debut = semaineIsoDe(maintenant)
  const lundi = lundiSemaineIso(debut)
  const fin = semaineIsoDe(new Date(lundi.getTime() + semaines * 7 * 86_400_000))
  return { debut, fin }
}

export function dansFenetre(s: SemaineIso, f: { debut: SemaineIso; fin: SemaineIso }): boolean {
  return comparerSemaines(s, f.debut) >= 0 && comparerSemaines(s, f.fin) <= 0
}

// RG-COO-093 : exclusions (statut de préparation « Envoyé », destinataires exclus paramétrables, Q-227).
export function estExclue(
  l: Pick<LigneLueBroadcast, 'statutPreparation' | 'destinataire'>,
  destinatairesExclus: string[],
): boolean {
  if (l.statutPreparation !== null && normaliserTheme(l.statutPreparation) === 'ENVOYE') return true
  const d = normaliserTheme(l.destinataire)
  return d !== '' && destinatairesExclus.some((x) => normaliserTheme(x) === d)
}

/** Clé d'une ligne active (RG-COO-080) : la DA et l'atelier sont HORS clé (Q-207). */
export interface CleLigne {
  plateformeId: number
  contNum: number
  supportId: number
  /** Thème normalisé (Q-208) ; null = ligne provisoire avant IP (RG-COO-084). */
  themeCle: string | null
  idThemeBandeau: number | null
  semaine: SemaineIso
}

export function cleTexte(c: CleLigne): string {
  return [
    c.plateformeId,
    c.contNum,
    c.supportId,
    c.themeCle ?? '',
    c.idThemeBandeau ?? 0,
    formatSemaineIso(c.semaine),
  ].join('|')
}

// RG-COO-080 / 082 : regroupement par clé ; quantités additionnées (plusieurs DA, plusieurs ateliers) ;
// « reste en place » retiré de la quantité (Q-209).
export function regrouper<T extends { cle: CleLigne; quantite: number; resteEnPlace?: boolean }>(
  lignes: T[],
): { cle: CleLigne; quantite: number; lignes: T[] }[] {
  const groupes = new Map<string, { cle: CleLigne; quantite: number; lignes: T[] }>()
  for (const l of lignes) {
    const k = cleTexte(l.cle)
    const g = groupes.get(k) ?? { cle: l.cle, quantite: 0, lignes: [] }
    if (!l.resteEnPlace) g.quantite += l.quantite
    g.lignes.push(l)
    groupes.set(k, g)
  }
  return [...groupes.values()]
}

// RG-COO-095 : correspondance support → support bandeau (paramètre « 5:100;26:100;… », Q-227).
export function lireSupportsBandeau(valeur: string): Map<number, number> {
  const m = new Map<number, number>()
  for (const paire of valeur.split(';')) {
    const morceaux = paire.split(':').map((x) => x.trim())
    // Entrée mal formée (« :3 », « 5: », « 5 », « x:1 ») ignorée : deux entiers positifs exigés.
    if (morceaux.length !== 2 || !morceaux.every((x) => /^\d+$/.test(x))) continue
    m.set(Number(morceaux[0]), Number(morceaux[1]))
  }
  return m
}

// RG-COO-090 : dédoublonnage (reprise) — pour chaque clé en double, garder la ligne qui porte une affiche (à
// défaut la plus récente), reporter les liens des autres sur la gardée, fermer les autres.
export function planDedoublonnage(
  lignes: { id: number; cle: string; liensActifs: number; createdAt: Date }[],
): { garder: number; fermer: number[] }[] {
  const parCle = new Map<string, typeof lignes>()
  for (const l of lignes) parCle.set(l.cle, [...(parCle.get(l.cle) ?? []), l])
  const plan: { garder: number; fermer: number[] }[] = []
  for (const groupe of parCle.values()) {
    if (groupe.length < 2) continue
    const tri = [...groupe].sort(
      (a, b) =>
        Number(b.liensActifs > 0) - Number(a.liensActifs > 0) ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id - a.id,
    )
    const [garde, ...autres] = tri
    if (garde) plan.push({ garder: garde.id, fermer: autres.map((x) => x.id) })
  }
  return plan
}

// ───────────────────────────── Accès aux lignes ─────────────────────────────

function whereCle(c: CleLigne) {
  return {
    plateformeId: c.plateformeId,
    contNum: c.contNum,
    supportId: c.supportId,
    ...(c.themeCle === null
      ? { OR: [{ themeCle: null }, { themeCle: '' }] }
      : { themeCle: c.themeCle }),
    idThemeBandeau: c.idThemeBandeau,
    semAnnee: c.semaine.annee,
    semNum: c.semaine.semaine,
    etatLigne: 'ACTIVE' as const,
  }
}

async function ligneActive(tx: Tx, c: CleLigne, idTheme?: number | null) {
  const exacte = await tx.receptionAttendue.findFirst({ where: whereCle(c) })
  if (exacte || idTheme === null || idTheme === undefined) return exacte
  // RG-COO-081 : rapprochement par n° de thème quand Broadcast le fournit (thème renommé dans Broadcast).
  return tx.receptionAttendue.findFirst({
    where: {
      plateformeId: c.plateformeId,
      contNum: c.contNum,
      supportId: c.supportId,
      idThemeBandeau: c.idThemeBandeau,
      semAnnee: c.semaine.annee,
      semNum: c.semaine.semaine,
      idTheme,
      etatLigne: 'ACTIVE',
    },
  })
}

// RG-COO-085 / RG-X-020 / RG-X-056 : IP saisies → la ligne provisoire de (plateforme × dossier × support × semaine) est fermée ;
// chaque affiche rattachée est déplacée seule vers la ligne du thème s'il n'y a qu'un thème possible ou si le
// thème lu sur le BL n'en désigne qu'un ; sinon le lien reste sur la ligne fermée (motif LIGNE_FERMEE, « à
// re-rattacher » par la Coordination, RG-COO-032) et une alerte est levée.
async function fermerProvisoires(
  tx: Tx,
  cle: Omit<CleLigne, 'themeCle' | 'idThemeBandeau'>,
  le: Date,
  rapport: RapportAlimentation,
) {
  const provisoires = await tx.receptionAttendue.findMany({
    where: { ...whereCle({ ...cle, themeCle: null, idThemeBandeau: null }), provisoire: true },
  })
  if (provisoires.length === 0) return
  const themes = await tx.receptionAttendue.findMany({
    where: {
      plateformeId: cle.plateformeId,
      contNum: cle.contNum,
      supportId: cle.supportId,
      semAnnee: cle.semaine.annee,
      semNum: cle.semaine.semaine,
      etatLigne: 'ACTIVE',
      provisoire: false,
      themeCle: { not: null },
      idThemeBandeau: null,
    },
  })
  for (const p of provisoires) {
    const liens = await tx.afficheAttendue.findMany({
      where: { ligneAttendueId: p.id, actif: true },
      include: { affiche: { select: { id: true, theme: true } } },
    })
    for (const lien of liens) {
      const candidats =
        themes.length === 1
          ? themes
          : themes.filter((t) => t.themeCle === normaliserTheme(lien.affiche.theme))
      const cible = candidats.length === 1 ? candidats[0] : undefined
      if (cible) {
        await deplacerLien(tx, lien.id, cible.id, le)
        rapport.liensDeplaces++
      } else {
        await signaler(tx, rapport, {
          plateformeId: p.plateformeId,
          type: 'AUCUN_CANDIDAT_THEME',
          regle: 'RG-COO-085',
          message:
            themes.length === 0
              ? 'IP saisies sans thème correspondant : affiche à re-rattacher par la Coordination.'
              : 'Plusieurs thèmes possibles : la Coordination choisit le thème de l’affiche.',
          contNum: p.contNum,
          ligneAttendueId: p.id,
          afficheId: lien.afficheId,
        })
      }
    }
    const courante = await tx.receptionAttendue.findUniqueOrThrow({ where: { id: p.id } })
    const alertes = await fermerLigne(
      tx,
      courante,
      le,
      'IP saisies : visuel provisoire fermé',
      'RG-COO-085',
    )
    rapport.provisoiresFermees++
    for (const a of alertes)
      rapport.alertes.push({
        type: a.type,
        regle: a.regle,
        message: 'Ligne fermée portant une affiche rattachée.',
        contNum: p.contNum,
        ligneAttendueId: p.id,
        afficheId: a.afficheId,
      })
  }
}

// RG-COO-096 : DA chapeau d'une nouvelle ligne reprise de la copie Broadcast par (dossier, semaine, année).
async function daChapeauDeLaCopie(tx: Tx, contNum: number, s: SemaineIso) {
  const copie = await tx.prepaBroadcast.findFirst({
    where: {
      idDossierDeVenteChapeau: contNum,
      semAnnee: s.annee,
      semNum: s.semaine,
      idDaChapeau: { not: null },
    },
    select: { idDaChapeau: true },
    orderBy: { id: 'asc' },
  })
  return copie?.idDaChapeau ?? null
}

/** RG-COO-080 : création ; une collision d'unicité (passage concurrent) devient une mise à jour. */
async function creerLigne(
  tx: Tx,
  data: Prisma.ReceptionAttendueUncheckedCreateInput,
): Promise<{ ligne: ReceptionAttendue; creee: boolean }> {
  try {
    const ligne = await tx.receptionAttendue.create({ data })
    return { ligne, creee: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const ligne = await tx.receptionAttendue.findFirstOrThrow({
        where: whereCle({
          plateformeId: data.plateformeId,
          contNum: data.contNum ?? 0,
          supportId: data.supportId,
          themeCle: data.themeCle ?? null,
          idThemeBandeau: data.idThemeBandeau ?? null,
          semaine: { annee: data.semAnnee, semaine: data.semNum },
        }),
      })
      return { ligne, creee: false }
    }
    throw error
  }
}

function alertesEffets(
  rapport: RapportAlimentation,
  alertes: {
    type: 'THEME_MODIFIE' | 'ECART_QUANTITE' | 'LIGNE_ANNULEE'
    afficheId: number
    regle: string
  }[],
  ligne: { id: number; contNum: number | null },
) {
  for (const a of alertes)
    rapport.alertes.push({
      type: a.type,
      regle: a.regle,
      message:
        a.type === 'THEME_MODIFIE'
          ? 'Thème modifié après la validation : validation à refaire.'
          : a.type === 'ECART_QUANTITE'
            ? 'Quantité modifiée après la validation.'
            : 'Ligne fermée portant une affiche rattachée.',
      contNum: ligne.contNum,
      ligneAttendueId: ligne.id,
      afficheId: a.afficheId,
    })
}

// Interface lue par les Alertes Pré-Prod (COO-P07) : les alertes de l'alimentation (thème sans n°, aucun thème
// candidat à la saisie des IP, écart DA / prépa, donnée de référence manquante) sont JOURNALISÉES (action
// ALERTE_ALIMENTATION / DONNEE_REFERENCE_MANQUANTE, données = l'alerte) et relues par `alertesAlimentation`.
async function signaler(tx: Tx, rapport: RapportAlimentation, a: AlerteAlimentation) {
  rapport.alertes.push(a)
  await ecrireJournal(tx, {
    typeEntite: a.ligneAttendueId !== undefined ? 'LIGNE_ATTENDUE' : 'REFERENTIEL',
    entiteId: a.ligneAttendueId ?? 'alimentation',
    action: 'ALERTE_ALIMENTATION',
    parId: null,
    nouvelleValeur: a.message,
    complement: `${a.type} (${a.regle})`,
    donnees: a,
  })
}

/** Alertes de l'alimentation journalisées, du périmètre (null = tous les sites), les plus récentes d'abord. */
export async function alertesAlimentation(
  client: Pick<Tx, 'journalAudit'>,
  plateformes: number[] | null,
  depuis?: Date,
): Promise<(AlerteAlimentation & { le: Date; id: number })[]> {
  const lignes = await client.journalAudit.findMany({
    where: {
      action: { in: ['ALERTE_ALIMENTATION', 'DONNEE_REFERENCE_MANQUANTE'] },
      ...(depuis ? { le: { gte: depuis } } : {}),
    },
    orderBy: { id: 'desc' },
  })
  const sortie: (AlerteAlimentation & { le: Date; id: number })[] = []
  for (const l of lignes) {
    const d = JSON.parse(l.donnees ?? '{}') as Partial<AlerteAlimentation> & { contNum?: number }
    const a: AlerteAlimentation =
      l.action === 'DONNEE_REFERENCE_MANQUANTE'
        ? {
            type: 'DONNEE_REFERENCE_MANQUANTE',
            regle: 'RG-COO-081',
            message: l.nouvelleValeur ?? '',
            contNum: d.contNum ?? null,
            plateformeId: null,
          }
        : (d as AlerteAlimentation)
    // Une donnée de référence manquante n'a pas de plateforme connue : visible de tous les sites seulement.
    if (plateformes !== null && (a.plateformeId == null || !plateformes.includes(a.plateformeId)))
      continue
    sortie.push({ ...a, le: l.le, id: l.id })
  }
  return sortie
}

async function alerteReference(
  tx: Tx,
  rapport: RapportAlimentation,
  message: string,
  donnees: Record<string, unknown>,
) {
  rapport.ecartees++
  rapport.alertes.push({
    type: 'DONNEE_REFERENCE_MANQUANTE',
    regle: 'RG-COO-081',
    message,
    contNum: typeof donnees['contNum'] === 'number' ? donnees['contNum'] : null,
  })
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: 'alimentation',
    action: 'DONNEE_REFERENCE_MANQUANTE',
    parId: null,
    nouvelleValeur: message,
    complement: CIRCE_AUTOMATIQUE,
    donnees,
  })
}

// ───────────────────────────── Lecture de l'état des réservations Broadcast ─────────────────────────────

// RG-COO-082 : à chaque lecture (fenêtre RG-COO-083), création ou mise à jour des lignes de source BC.
// RG-COO-081 : rapprochement par identifiants (site, surface × format, n° de thème) ; identifiant inconnu →
// alerte « donnée de référence manquante », traitement poursuivi pour les autres lignes.
// RG-COO-084 : sans thème (IP non saisies) → une ligne provisoire par (plateforme × dossier × support ×
// semaine) ; RG-COO-085 : thèmes présents → provisoire fermée, affiches déplacées.
// RG-COO-087 : ligne BC non vue → marquée à la 1re lecture, fermée (ANNULEE) à la lecture suivante.
// RG-COO-091 : lecture vide → rien n'est écrit.
export async function alimenterDepuisBroadcast(
  tx: Tx,
  lecture: { lueLe: Date; lignes: LigneLueBroadcast[] },
  /** RG-COO-091 : transaction PAR DOSSIER — limite la fermeture des lignes non vues aux dossiers lus. */
  portee?: { contNums: number[] },
): Promise<RapportAlimentation> {
  const rapport = rapportVide()
  rapport.lues = lecture.lignes.length
  if (lecture.lignes.length === 0) return rapport
  const fenetre = fenetreAlimentation(
    lecture.lueLe,
    await lireParametreNombre(tx, 'coordination.fenetreSemaines'),
  )
  const exclus = (await lireParametreTexte(tx, 'coordination.destinatairesExclus'))
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
  const plateformes = await tx.plateforme.findMany({
    where: { idSiteCcf: { not: null } },
    select: { id: true, idSiteCcf: true },
  })
  const correspondances = await tx.correspondanceSupport.findMany()

  /** Dossiers × plateformes exclus (prépa « Envoyé ») : leurs lignes BC ne sont pas « disparues ». */
  const envoyes = new Set<string>()
  const retenues: {
    cle: CleLigne
    quantite: number
    resteEnPlace: boolean
    source: LigneLueBroadcast
  }[] = []
  for (const l of lecture.lignes) {
    if (!dansFenetre(l.semaine, fenetre)) {
      rapport.exclues++
      continue
    }
    const sites = plateformes.filter((p) => p.idSiteCcf === l.idSiteCcf)
    const plateforme = sites.length === 1 ? sites[0] : undefined
    if (!plateforme) {
      // HYPOTHÈSE Q-187 (2) : plusieurs plateformes pour un même site → ligne écartée avec alerte (pas de choix).
      await alerteReference(
        tx,
        rapport,
        sites.length === 0
          ? `Site Broadcast ${String(l.idSiteCcf ?? '—')} inconnu du référentiel des plateformes.`
          : `Site Broadcast ${String(l.idSiteCcf)} rattaché à plusieurs plateformes.`,
        { contNum: l.contNum, idSiteCcf: l.idSiteCcf },
      )
      continue
    }
    if (estExclue(l, exclus)) {
      rapport.exclues++
      envoyes.add(`${String(plateforme.id)}|${String(l.contNum)}`)
      continue
    }
    const corr = correspondances.find(
      (c) => c.idSurface === l.idSurface && c.idFormat === l.idFormat,
    )
    if (!corr) {
      await alerteReference(
        tx,
        rapport,
        `Surface ${String(l.idSurface ?? '—')} × format ${String(l.idFormat ?? '—')} sans support Circé.`,
        { contNum: l.contNum, idSurface: l.idSurface, idFormat: l.idFormat },
      )
      continue
    }
    const theme = l.theme?.trim() ? l.theme.trim() : null
    if (theme !== null && l.idTheme === null) {
      // RG-COO-081 / Q-208 : thème sans n° → rapprochement au texte normalisé, avec alerte.
      await signaler(tx, rapport, {
        plateformeId: plateforme.id,
        type: 'THEME_SANS_NUMERO',
        regle: 'RG-COO-081',
        message: `Thème « ${theme} » reçu sans n° de thème : rapproché au texte normalisé.`,
        contNum: l.contNum,
      })
    }
    retenues.push({
      cle: {
        plateformeId: plateforme.id,
        contNum: l.contNum,
        supportId: corr.supportId,
        themeCle: theme === null ? null : normaliserTheme(theme),
        idThemeBandeau: theme === null ? null : l.idThemeBandeau,
        semaine: l.semaine,
      },
      quantite: l.quantite,
      resteEnPlace: l.estResteEnPlace,
      source: { ...l, theme },
    })
  }

  const groupes = regrouper(retenues)
  const vuesIds = new Set<number>()
  for (const g of groupes) {
    const premiere = g.lignes[0]?.source
    if (!premiere) continue
    const theme = g.lignes.find((x) => x.source.theme !== null)?.source.theme ?? null
    const idTheme = g.lignes.find((x) => x.source.idTheme !== null)?.source.idTheme ?? null
    const idDa = g.lignes.find((x) => x.source.idDaChapeau !== null)?.source.idDaChapeau ?? null
    const existante = await ligneActive(tx, g.cle, idTheme)
    if (existante) {
      vuesIds.add(existante.id)
      // RG-COO-082 / 086 : une ligne passée PREPA garde sa quantité prépa ; la lecture ne touche que le BC.
      const r = await mettreAJourLigneAttendue(
        tx,
        existante.id,
        {
          ...(theme !== null ? { theme } : {}),
          qteBc: g.quantite,
          idTheme,
          annonceur: premiere.annonceur,
          dateVueBc: lecture.lueLe,
          nonVueLe: null,
          ...(existante.idDaChapeau === null && idDa !== null ? { idDaChapeau: idDa } : {}),
        },
        'BROADCAST',
      )
      alertesEffets(rapport, r.alertes, existante)
      rapport.misesAJour++
      continue
    }
    const { ligne, creee } = await creerLigne(tx, {
      plateformeId: g.cle.plateformeId,
      contNum: g.cle.contNum,
      supportId: g.cle.supportId,
      theme,
      themeCle: g.cle.themeCle,
      idTheme,
      idThemeBandeau: g.cle.idThemeBandeau,
      annonceur: premiere.annonceur,
      semAnnee: g.cle.semaine.annee,
      semNum: g.cle.semaine.semaine,
      source: 'BC',
      qteBc: g.quantite,
      dateVueBc: lecture.lueLe,
      provisoire: theme === null,
      // RG-COO-096 : DA chapeau de la lecture, sinon de la copie Broadcast (dossier, semaine, année).
      idDaChapeau: idDa ?? (await daChapeauDeLaCopie(tx, g.cle.contNum, g.cle.semaine)),
    })
    vuesIds.add(ligne.id)
    if (creee) {
      rapport.creees++
      await ecrireJournal(tx, {
        typeEntite: 'LIGNE_ATTENDUE',
        entiteId: ligne.id,
        action: 'ALIMENTATION_LIGNE',
        parId: null,
        nouvelleValeur: `${theme ?? 'visuel provisoire'} · BC ${String(g.quantite)}`,
        complement: CIRCE_AUTOMATIQUE,
        donnees: { dossier: g.cle.contNum, semaine: formatSemaineIso(g.cle.semaine) },
      })
    } else {
      rapport.misesAJour++
    }
  }

  // RG-COO-085 : IP saisies pour une clé (plateforme × dossier × support × semaine) qui a une ligne provisoire.
  const quadruples = new Map<string, Omit<CleLigne, 'themeCle' | 'idThemeBandeau'>>()
  for (const g of groupes)
    if (g.cle.themeCle !== null)
      quadruples.set(
        [g.cle.plateformeId, g.cle.contNum, g.cle.supportId, formatSemaineIso(g.cle.semaine)].join(
          '|',
        ),
        {
          plateformeId: g.cle.plateformeId,
          contNum: g.cle.contNum,
          supportId: g.cle.supportId,
          semaine: g.cle.semaine,
        },
      )
  for (const q of quadruples.values()) await fermerProvisoires(tx, q, lecture.lueLe, rapport)

  await traiterNonVues(
    tx,
    {
      lueLe: lecture.lueLe,
      fenetre,
      plateformeIds: plateformes.map((p) => p.id),
      vuesIds,
      envoyes,
      filtreDossiers: portee ? { in: new Set(portee.contNums) } : undefined,
    },
    rapport,
  )
  return rapport
}

// RG-COO-091 / 087 : en fin de lecture (transaction par dossier), les dossiers de la fenêtre ABSENTS de la
// lecture ont des lignes BC « plus vues » : marquées puis fermées à la lecture suivante. Lecture vide : rien.
export async function traiterDossiersNonLus(
  tx: Tx,
  lueLe: Date,
  contNumsLus: number[],
): Promise<RapportAlimentation> {
  const rapport = rapportVide()
  if (contNumsLus.length === 0) return rapport
  const fenetre = fenetreAlimentation(
    lueLe,
    await lireParametreNombre(tx, 'coordination.fenetreSemaines'),
  )
  const plateformes = await tx.plateforme.findMany({
    where: { idSiteCcf: { not: null } },
    select: { id: true },
  })
  await traiterNonVues(
    tx,
    {
      lueLe,
      fenetre,
      plateformeIds: plateformes.map((p) => p.id),
      vuesIds: new Set(),
      envoyes: new Set(),
      filtreDossiers: { notIn: new Set(contNumsLus) },
    },
    rapport,
  )
  return rapport
}

async function traiterNonVues(
  tx: Tx,
  o: {
    lueLe: Date
    fenetre: { debut: SemaineIso; fin: SemaineIso }
    plateformeIds: number[]
    vuesIds: Set<number>
    envoyes: Set<string>
    filtreDossiers: { in: Set<number> } | { notIn: Set<number> } | undefined
  },
  rapport: RapportAlimentation,
) {
  const lecture = { lueLe: o.lueLe }
  const { fenetre, envoyes } = o
  // RG-COO-087 : lignes BC actives de la fenêtre, sur une plateforme gérée par Broadcast, non vues.
  // Les listes de dossiers / de lignes vues peuvent dépasser la limite de paramètres de SQLite (ANO-051) : elles
  // filtrent donc en mémoire, sur les lignes BC actives de la fenêtre (sites gérés par Broadcast).
  const dansPortee = (contNum: number | null) => {
    const f = o.filtreDossiers
    if (!f) return true
    if ('in' in f) return contNum !== null && f.in.has(contNum)
    return contNum === null || !f.notIn.has(contNum)
  }
  const candidates = (
    await tx.receptionAttendue.findMany({
      where: {
        source: 'BC',
        etatLigne: 'ACTIVE',
        plateformeId: { in: o.plateformeIds },
      },
    })
  ).filter((l) => !o.vuesIds.has(l.id) && dansPortee(l.contNum))
  for (const l of candidates) {
    if (!dansFenetre({ annee: l.semAnnee, semaine: l.semNum }, fenetre)) continue
    if (envoyes.has(`${String(l.plateformeId)}|${String(l.contNum)}`)) continue
    if (l.nonVueLe === null) {
      await updateWithVersion({
        expectedVersion: l.version,
        update: (where) =>
          tx.receptionAttendue.updateMany({
            where: { id: l.id, ...where },
            data: { nonVueLe: lecture.lueLe, ...bumpVersion },
          }),
        ...COO.version,
      })
      rapport.nonVues++
      continue
    }
    const alertes = await fermerLigne(
      tx,
      l,
      lecture.lueLe,
      'Ligne plus vue par Broadcast (deux lectures)',
      'RG-COO-087',
    )
    alertesEffets(rapport, alertes, l)
    rapport.fermees++
  }
}

// ───────────────────────────── Arrivée de la prépa (lignes PREPA) ─────────────────────────────

// RG-COO-086 : la ligne active de même clé passe en source PREPA et reçoit `qte_prepa` ; écart DA / prépa
// signalé (RG-COO-067) ; une ligne n'est créée que si la clé n'existe pas ; les liens ne bougent pas.
// RG-COO-085 : une prépa thématisée ferme aussi la ligne provisoire de la même clé.
export async function alimenterDepuisPreparation(
  tx: Tx,
  lignes: LignePrepa[],
  le: Date = new Date(),
): Promise<RapportAlimentation> {
  const rapport = rapportVide()
  rapport.lues = lignes.length
  const groupes = regrouper(
    lignes.map((l) => ({
      ...l,
      cle: {
        plateformeId: l.plateformeId,
        contNum: l.contNum,
        supportId: l.supportId,
        themeCle: normaliserTheme(l.theme),
        idThemeBandeau: l.idThemeBandeau,
        semaine: l.semaine,
      },
    })),
  )
  for (const g of groupes) {
    const premiere = g.lignes[0]
    if (!premiere) continue
    const idTheme = g.lignes.find((x) => x.idTheme != null)?.idTheme ?? null
    const existante = await ligneActive(tx, g.cle, idTheme)
    if (existante) {
      const r = await mettreAJourLigneAttendue(
        tx,
        existante.id,
        {
          source: 'PREPA',
          qtePrepa: g.quantite,
          ...(existante.atelierId === null ? { atelierId: premiere.atelierId } : {}),
        },
        'PREPA',
      )
      alertesEffets(rapport, r.alertes, existante)
      if (!r.ignoree && existante.qteBc !== null && existante.qteBc !== g.quantite)
        await signaler(tx, rapport, {
          plateformeId: existante.plateformeId,
          type: 'ECART_DA_PREPA',
          regle: 'RG-COO-086',
          message: `Écart DA / prépa : Broadcast ${String(existante.qteBc)}, prépa ${String(g.quantite)}.`,
          contNum: existante.contNum,
          ligneAttendueId: existante.id,
        })
      rapport.misesAJour++
    } else {
      const { ligne, creee } = await creerLigne(tx, {
        plateformeId: g.cle.plateformeId,
        contNum: g.cle.contNum,
        supportId: g.cle.supportId,
        atelierId: premiere.atelierId,
        theme: premiere.theme,
        themeCle: g.cle.themeCle,
        idTheme,
        idThemeBandeau: g.cle.idThemeBandeau,
        annonceur: premiere.annonceur,
        semAnnee: g.cle.semaine.annee,
        semNum: g.cle.semaine.semaine,
        source: 'PREPA',
        qtePrepa: g.quantite,
        idDaChapeau: await daChapeauDeLaCopie(tx, g.cle.contNum, g.cle.semaine),
      })
      if (creee) {
        rapport.creees++
        await ecrireJournal(tx, {
          typeEntite: 'LIGNE_ATTENDUE',
          entiteId: ligne.id,
          action: 'ALIMENTATION_LIGNE',
          parId: null,
          nouvelleValeur: `${premiere.theme} · prépa ${String(g.quantite)}`,
          complement: CIRCE_AUTOMATIQUE,
          donnees: { dossier: g.cle.contNum, semaine: formatSemaineIso(g.cle.semaine) },
        })
      } else rapport.misesAJour++
    }
    if (g.cle.idThemeBandeau === null)
      await fermerProvisoires(
        tx,
        {
          plateformeId: g.cle.plateformeId,
          contNum: g.cle.contNum,
          supportId: g.cle.supportId,
          semaine: g.cle.semaine,
        },
        le,
        rapport,
      )
  }
  return rapport
}

// RG-COO-094 : lignes « prépa » issues de la production : (1) répartitions fixe / pliage (quantité = Σ rpc_qte),
// (2) faces du déroulant (quantité = nombre de faces, thème non nul) ; statut ≠ ANNULE (rpc_statut 4), fenêtre
// S → S+8, départ futur pour les faces. RG-COO-095 : lignes « bandeau » dédiées (support bandeau paramétré,
// thème = repiquage, bandeau dans la clé, atelier du bandeau). Plateforme = celle de l'atelier.
export async function lignesPrepaDepuisProduction(
  tx: Tx,
  maintenant: Date,
  contNums?: number[],
): Promise<LignePrepa[]> {
  const fenetre = fenetreAlimentation(
    maintenant,
    await lireParametreNombre(tx, 'coordination.fenetreSemaines'),
  )
  const bandeaux = lireSupportsBandeau(await lireParametreTexte(tx, 'coordination.supportsBandeau'))
  const lireRepartitions = (filtreDossier: { contNum: { in: number[] } | { not: null } }) =>
    tx.repartition.findMany({
      where: {
        statut: { not: 'ANNULE' },
        supportId: { not: null },
        atelierId: { not: null },
        ...filtreDossier,
      },
      include: { atelier: { select: { plateformeId: true } } },
    })
  const repartitions = contNums
    ? await parPaquets(contNums, (paquet) => lireRepartitions({ contNum: { in: paquet } }))
    : await lireRepartitions({ contNum: { not: null } })
  const sortie: LignePrepa[] = []
  for (const r of repartitions) {
    if (r.semAnnee === null || r.semNum === null || !r.atelier || r.contNum === null) continue
    const semaine = { annee: r.semAnnee, semaine: r.semNum }
    if (!dansFenetre(semaine, fenetre) || r.supportId === null) continue
    if (r.theme)
      sortie.push({
        plateformeId: r.atelier.plateformeId,
        contNum: r.contNum,
        supportId: r.supportId,
        theme: r.theme,
        idThemeBandeau: null,
        atelierId: r.atelierId,
        annonceur: r.annonceur,
        semaine,
        quantite: r.qte ?? 0,
      })
    const supportBandeau = bandeaux.get(r.supportId)
    if (r.repiquage && supportBandeau !== undefined)
      sortie.push({
        plateformeId: r.atelier.plateformeId,
        contNum: r.contNum,
        supportId: supportBandeau,
        theme: r.repiquage,
        idThemeBandeau: r.repiquageId,
        atelierId: r.atelierId,
        annonceur: r.annonceur,
        semaine,
        quantite: r.qte ?? 0,
      })
  }
  const lireFaces = (filtreDossier: { contNum: { in: number[] } | { not: null } }) =>
    tx.faceTrain.findMany({
      where: {
        statut: { not: 'ANNULE' },
        theme: { not: null },
        supportId: { not: null },
        atelierId: { not: null },
        dateDepart: { gt: maintenant },
        ...filtreDossier,
      },
      include: { atelier: { select: { plateformeId: true } } },
    })
  const faces = contNums
    ? await parPaquets(contNums, (paquet) => lireFaces({ contNum: { in: paquet } }))
    : await lireFaces({ contNum: { not: null } })
  for (const f of faces) {
    if (f.depAnbas === null || f.depSembas === null || !f.atelier || f.contNum === null) continue
    const semaine = { annee: f.depAnbas, semaine: f.depSembas }
    if (!dansFenetre(semaine, fenetre) || f.supportId === null || f.theme === null) continue
    sortie.push({
      plateformeId: f.atelier.plateformeId,
      contNum: f.contNum,
      supportId: f.supportId,
      theme: f.theme,
      idThemeBandeau: null,
      atelierId: f.atelierId,
      annonceur: f.contAnnonc,
      semaine,
      quantite: 1,
    })
    const supportBandeau = bandeaux.get(f.supportId)
    if (f.repiquage && supportBandeau !== undefined)
      sortie.push({
        plateformeId: f.atelier.plateformeId,
        contNum: f.contNum,
        supportId: supportBandeau,
        theme: f.repiquage,
        idThemeBandeau: f.repiquageId,
        atelierId: f.atelierId,
        annonceur: f.contAnnonc,
        semaine,
        quantite: 1,
      })
  }
  return sortie
}

// ───────────────────────────── Reprise : dédoublonnage (RG-COO-090) ─────────────────────────────

// RG-COO-090 : avant l'activation de l'index unique (reprise des données legacy), les doublons de clé
// (thème comparé normalisé, Q-208) sont traités : ligne gardée (porteuse d'affiche, sinon la plus récente),
// liens des autres reportés sur la gardée (jamais perdus), autres fermées ANNULEE. Renvoie le rapport.
export async function dedoublonnerLignes(tx: Tx, le: Date = new Date()) {
  const lignes = await tx.receptionAttendue.findMany({
    where: { etatLigne: 'ACTIVE' },
    include: { _count: { select: { rattachements: { where: { actif: true } } } } },
  })
  const plan = planDedoublonnage(
    lignes.map((l) => ({
      id: l.id,
      cle: cleTexte({
        plateformeId: l.plateformeId,
        contNum: l.contNum ?? 0,
        supportId: l.supportId,
        themeCle: l.theme === null ? null : normaliserTheme(l.theme),
        idThemeBandeau: l.idThemeBandeau,
        semaine: { annee: l.semAnnee, semaine: l.semNum },
      }),
      liensActifs: l._count.rattachements,
      createdAt: l.createdAt,
    })),
  )
  let liensReportes = 0
  let fermees = 0
  for (const p of plan) {
    for (const id of p.fermer) {
      const liens = await tx.afficheAttendue.findMany({
        where: { ligneAttendueId: id, actif: true },
      })
      for (const lien of liens) {
        await deplacerLien(tx, lien.id, p.garder, le, 'doublon reporté (reprise, RG-COO-090)')
        liensReportes++
      }
      const ligne = await tx.receptionAttendue.findUniqueOrThrow({ where: { id } })
      await fermerLigne(
        tx,
        ligne,
        le,
        `Doublon de la ligne ${String(p.garder)} (reprise)`,
        'RG-COO-090',
      )
      fermees++
    }
    const gardee = await tx.receptionAttendue.findUniqueOrThrow({ where: { id: p.garder } })
    if (gardee.theme !== null && gardee.themeCle !== normaliserTheme(gardee.theme))
      await tx.receptionAttendue.update({
        where: { id: gardee.id },
        data: { themeCle: normaliserTheme(gardee.theme), ...bumpVersion },
      })
  }
  return { cles: plan.length, fermees, liensReportes }
}
