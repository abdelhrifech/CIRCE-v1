// COO-P06 — traitement des flux Broadcast → Circé (RG-COO-091 à 093, 104, 118 à 131 ; retour : retour-broadcast.ts). Chaque fonction
// `integrer…` travaille DANS la transaction de l'appelant (une transaction par dossier, par groupe de
// préparation ou par flux : RG-COO-091 / 102) ; l'orchestration (ordre fixe, journal de chargement, verrou,
// délai) est dans integration-broadcast.ts. Les valeurs codées en dur du legacy sont des paramètres (Q-227).
// Contrat d'entrée : @circe/shared coordination-integration.ts (HYPOTHÈSE Q-188 (1), source réelle Q-005).
import {
  formatSemaineIso,
  type DestinataireBroadcast,
  type FaceBroadcast,
  type GroupePreparation,
  type InstructionLue,
  type LigneEtatReservations,
  type SemaineIso,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { COO } from './permissions.ts'
import type { StatutProduction } from '../../generated/prisma/client.ts'
import { lireParametreTexte } from '../reception/parametres.ts'
import {
  alimenterDepuisBroadcast,
  alimenterDepuisPreparation,
  lignesPrepaDepuisProduction,
  type LigneLueBroadcast,
} from './alimentation-lignes.ts'
import { CIRCE_AUTOMATIQUE, type TypesVisuels } from './integration-commun.ts'
import {
  annulerDossier,
  creerChapeauATraiter,
  integrerInstruction,
  integrerPreparation,
  type InstructionBroadcast,
} from './integration.ts'

// ───────────────────────────── Lecture des paramètres (fonctions pures) ─────────────────────────────

const entier = (x: string | undefined) => (x !== undefined && /^\d+$/.test(x) ? Number(x) : null)

/** « 39;40;43 » → [39, 40, 43] (entrées mal formées ignorées). */
export function lireNombres(valeur: string): number[] {
  return valeur
    .split(';')
    .map((x) => entier(x.trim()))
    .filter((x): x is number => x !== null)
}

/** « 39:2;40:3 » → Map(39 → 2, 40 → 3). */
export function lirePaires(valeur: string): Map<number, number> {
  const m = new Map<number, number>()
  for (const p of valeur.split(';')) {
    const [a, b, ...reste] = p.split(':').map((x) => x.trim())
    const ka = entier(a)
    const kb = entier(b)
    if (reste.length === 0 && ka !== null && kb !== null) m.set(ka, kb)
  }
  return m
}

/** RG-COO-126 : « surface:site:atelier;… » → Map(« surface:site » → atelier). */
export function lireAtelierDeroulant(valeur: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of valeur.split(';')) {
    const morceaux = p.split(':').map((x) => entier(x.trim()))
    const [surface, site, atelier] = morceaux
    if (morceaux.length === 3 && surface != null && site != null && atelier != null)
      m.set(`${String(surface)}:${String(site)}`, atelier)
  }
  return m
}

export interface Transport {
  transporteur: number
  tarif: string
}

/** RG-COO-120 : « atelier:transporteur:tarif;…;*:transporteur:tarif ». */
export function lireTransports(valeur: string): {
  parAtelier: Map<number, Transport>
  defaut: Transport | null
} {
  const parAtelier = new Map<number, Transport>()
  let defaut: Transport | null = null
  for (const p of valeur.split(';')) {
    const [a, t, tarif, ...reste] = p.split(':').map((x) => x.trim())
    const transporteur = entier(t)
    if (reste.length > 0 || transporteur === null || !tarif) continue
    if (a === '*') defaut = { transporteur, tarif }
    else {
      const atelier = entier(a)
      if (atelier !== null) parAtelier.set(atelier, { transporteur, tarif })
    }
  }
  return { parAtelier, defaut }
}

export { lireTypesVisuels, type TypesVisuels } from './integration-commun.ts'

// RG-COO-127 : code d'instruction = AAAA + SS (2 chiffres) + « C0 » + atelier (2 chiffres) + dossier
// (8 chiffres) ; atelier inconnu (0) → « C000 » (signalé, RG-COO-126).
export function codeInstruction(s: SemaineIso, atelierId: number | null, contNum: number): string {
  return (
    String(s.annee) +
    String(s.semaine).padStart(2, '0') +
    'C0' +
    String(atelierId ?? 0).padStart(2, '0') +
    String(contNum).padStart(8, '0')
  )
}

// RG-COO-118 : adresse conservée si son début est futur, ou si maintenant est dans [début, fin] ; une
// période échue (ou sans début, comparaison SQL fausse) est ignorée.
export function adresseEnVigueur(
  d: Pick<DestinataireBroadcast, 'dateDebutPivot' | 'dateFinPivot'>,
  maintenant: Date,
): boolean {
  if (d.dateDebutPivot === null) return false
  if (d.dateDebutPivot > maintenant) return true
  return d.dateFinPivot !== null && maintenant <= d.dateFinPivot
}

// RG-COO-118 (« annule et remplace », EX-TRA-512 / 514) : par (type, clé PEX), seule la dernière donnée
// valide est gardée (début de validité le plus récent).
export function destinatairesRetenus(
  lus: DestinataireBroadcast[],
  maintenant: Date,
): { retenus: DestinataireBroadcast[]; ignores: number } {
  const parCle = new Map<string, DestinataireBroadcast>()
  let ignores = 0
  for (const d of lus) {
    if (!adresseEnVigueur(d, maintenant)) {
      ignores++
      continue
    }
    const k = `${String(d.type)}|${String(d.clePex)}`
    const actuel = parCle.get(k)
    if (actuel) ignores++
    if (!actuel || (actuel.dateDebutPivot ?? 0) < (d.dateDebutPivot ?? 0)) parCle.set(k, d)
  }
  return { retenus: [...parCle.values()], ignores }
}

/** RG-COO-119 : lieu-dit = lieu-dit + point de remise, tronqué à 50 caractères. */
export function lieuDitDe(lieuDit: string | null, pointRemise: string | null): string | null {
  const texte = [lieuDit, pointRemise]
    .map((x) => x?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
  return texte === '' ? null : texte.slice(0, 50)
}

/** Codes legacy rpc_statut 0 à 10 → statuts V2 (Q-250). */
const STATUTS_PAR_CODE: StatutProduction[] = [
  'A_TRAITER',
  'EN_COURS',
  'INSTRUCTION_OK',
  'ERREUR',
  'ANNULE',
  'A_IMPRIMER',
  'PREPARE',
  'A_EXPEDIER',
  'TERMINE',
  'EXPORT_PREPA',
  'AU_ROULAGE',
]
const statuts = (...codes: number[]) => codes.map((c) => STATUTS_PAR_CODE[c] as StatutProduction)
/** RG-COO-129 (2) : faces remplacées par un renvoi (0, 1, 3, 4). */
export const FACES_REMPLACABLES = statuts(0, 1, 3, 4)
/** RG-COO-130 : faces dont on reprend l'afficheur (2, 5 à 10). */
export const FACES_REFERENCE_AFFICHEUR = statuts(2, 5, 6, 7, 8, 9, 10)

// ───────────────────────────── Accès communs ─────────────────────────────

/** Résultat d'une unité de traitement (dossier, groupe, flux), cumulé dans le journal de chargement. */
export interface Compteurs {
  lues: number
  creees: number
  misesAJour: number
  ignorees: number
}
export const compteursVides = (): Compteurs => ({ lues: 0, creees: 0, misesAJour: 0, ignorees: 0 })

/** Donnée de référence manquante : journalisée (relue par les Alertes Pré-Prod via alertesAlimentation). */
async function referenceManquante(tx: Tx, message: string, donnees: Record<string, unknown>) {
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: 'integration',
    action: 'DONNEE_REFERENCE_MANQUANTE',
    parId: null,
    nouvelleValeur: message,
    complement: CIRCE_AUTOMATIQUE,
    donnees,
  })
}

/** Q-336 / HYPOTHÈSE Q-188 (3) : le dossier est créé (À traiter) au premier flux qui le cite. */
export async function assurerDossier(tx: Tx, contNum: number, annonceur: string | null) {
  const existant = await tx.dossier.findUnique({ where: { contNum } })
  if (existant) {
    if (existant.annonceur === null && annonceur)
      await updateWithVersion({
        expectedVersion: existant.version,
        update: (where) =>
          tx.dossier.updateMany({
            where: { id: existant.id, ...where },
            data: { annonceur, ...bumpVersion },
          }),
        ...COO.version,
      })
    return existant
  }
  const dossier = await tx.dossier.create({ data: { contNum, annonceur, statut: 'A_TRAITER' } })
  await ecrireJournal(tx, {
    typeEntite: 'DOSSIER',
    entiteId: contNum,
    action: 'CREATION_DOSSIER',
    parId: null,
    nouvelleValeur: 'A_TRAITER',
    complement: CIRCE_AUTOMATIQUE,
  })
  return dossier
}

/** Atelier existant du référentiel (sinon null + donnée de référence manquante). */
async function atelierExistant(
  tx: Tx,
  atelierId: number | undefined,
  contexte: Record<string, unknown>,
  regle: string,
): Promise<number | null> {
  if (atelierId !== undefined) {
    const a = await tx.atelier.findUnique({ where: { id: atelierId }, select: { id: true } })
    if (a) return a.id
  }
  await referenceManquante(
    tx,
    atelierId === undefined
      ? `Aucun atelier pour ce site / cette surface (${regle}) : atelier 0.`
      : `Atelier ${String(atelierId)} absent du référentiel (${regle}).`,
    { ...contexte, regle },
  )
  return null
}

async function destinataireDe(tx: Tx, cle: { type: number; clePex: number } | null) {
  if (!cle) return null
  const d = await tx.destinataire.findFirst({
    where: { desType: cle.type, desId: BigInt(cle.clePex) },
    select: { id: true },
  })
  return d?.id ?? null
}

// ───────────────────────────── Flux 1 : état des réservations ─────────────────────────────

export function ligneLue(l: LigneEtatReservations): LigneLueBroadcast {
  return {
    idSiteCcf: l.idSiteCcf,
    destinataire: l.destinataire,
    contNum: l.contNum,
    annonceur: l.annonceur,
    idSurface: l.idSurface,
    idFormat: l.idFormat,
    idTheme: l.idTheme,
    theme: l.theme,
    idThemeBandeau: l.idThemeBandeau,
    idDaChapeau: l.idDaChapeau,
    semaine: l.semaine,
    quantite: l.quantite,
    estResteEnPlace: l.estResteEnPlace,
    statutPreparation: l.statutPreparation,
  }
}

// RG-COO-091 : pour UN dossier (transaction de l'appelant) : la copie `tf_prepa_Broadcast` du dossier devient
// l'image de la lecture (date_vue renseignée, IdThemeBandeau copié) ; RG-COO-092 : colonnes conservées
// (site, surface, format, prépa chapeau, type de préparation, reste en place, n° de thème) ; puis les lignes
// attendues sont alimentées (RG-COO-080 à 087, 093, 096) en limitant les « non vues » à ce dossier.
export async function integrerEtatReservationsDossier(
  tx: Tx,
  contNum: number,
  lignes: LigneEtatReservations[],
  lueLe: Date,
): Promise<Compteurs> {
  await assurerDossier(tx, contNum, lignes.find((l) => l.annonceur)?.annonceur ?? null)
  await tx.prepaBroadcast.deleteMany({ where: { idDossierDeVenteChapeau: contNum } })
  const correspondances = await tx.correspondanceSupport.findMany()
  for (const l of lignes) {
    const supportId =
      correspondances.find((c) => c.idSurface === l.idSurface && c.idFormat === l.idFormat)
        ?.supportId ?? null
    await tx.prepaBroadcast.create({
      data: {
        idSiteCcf: l.idSiteCcf,
        destinataireEffectif: l.destinataire,
        idDossierDeVenteChapeau: contNum,
        idDaChapeau: l.idDaChapeau,
        idPreparationChapeau: l.idPreparationChapeau,
        idSurface: l.idSurface,
        idFormat: l.idFormat,
        idTypePreparation: l.idTypePreparation,
        annonceur: l.annonceur,
        surface: l.surface,
        format: l.format,
        // Assistants gardés séparés (le legacy les concaténait « Nom Prénom »).
        assistantCommercial: l.assistantCommercial,
        assistantLogistique: l.assistantLogistique,
        theme: l.theme,
        idTheme: l.idTheme,
        bandeau: l.bandeau,
        idThemeBandeau: l.idThemeBandeau,
        quantite: l.quantite,
        estResteEnPlace: l.estResteEnPlace,
        statutPreparation: l.statutPreparation,
        // Le legacy recopiait le bandeau dans `repiquage` : conservé pour la lecture héritée.
        repiquage: l.bandeau,
        semNum: l.semaine.semaine,
        semAnnee: l.semaine.annee,
        supportId,
        dateVue: lueLe,
      },
    })
  }
  const r = await alimenterDepuisBroadcast(
    tx,
    { lueLe, lignes: lignes.map(ligneLue) },
    { contNums: [contNum] },
  )
  return {
    lues: lignes.length,
    creees: r.creees,
    misesAJour: r.misesAJour + r.fermees + r.provisoiresFermees,
    ignorees: r.exclues + r.ecartees,
  }
}

// ───────────────────────────── Flux destinataires ─────────────────────────────

// RG-COO-119 : création (actif, dispatch « O ») ou mise à jour par (type, clé PEX) ; adresse insérée seulement
// s'il n'en a aucune, mise à jour seulement si le nom correspond ; jamais de désactivation ni de suppression.
// RG-COO-120 : en fin de flux, transporteur et tarif par défaut pour chaque destinataire × atelier sans ligne.
export async function integrerDestinataires(
  tx: Tx,
  lus: DestinataireBroadcast[],
  maintenant: Date,
): Promise<Compteurs> {
  const c = compteursVides()
  c.lues = lus.length
  const { retenus, ignores } = destinatairesRetenus(lus, maintenant)
  c.ignorees = ignores
  for (const d of retenus) {
    const adresse = {
      adresse1: d.adresse1,
      adresse2: d.adresse2,
      codePostal: d.codePostal,
      localite: d.localite,
      lieuDit: lieuDitDe(d.lieuDit, d.pointRemise),
    }
    // Correction du défaut legacy : la recherche porte sur (clé PEX, TYPE) — site et plateforme partagent
    // IdSiteCCF.
    const existant = await tx.destinataire.findFirst({
      where: { desType: d.type, desId: BigInt(d.clePex) },
      include: { adresses: true },
    })
    if (!existant) {
      const cree = await tx.destinataire.create({
        data: {
          desType: d.type,
          desId: BigInt(d.clePex),
          nomOrigine: d.nom,
          nom: d.nom,
          actif: true,
          dispatch: 'O',
          mail: d.mail,
          telephone: d.telephone,
          adresses: { create: adresse },
        },
      })
      c.creees++
      await ecrireJournal(tx, {
        typeEntite: 'REFERENTIEL',
        entiteId: `destinataire:${String(cree.id)}`,
        action: 'INTEGRATION_DESTINATAIRE',
        parId: null,
        nouvelleValeur: d.nom,
        complement: CIRCE_AUTOMATIQUE,
        donnees: { type: d.type, clePex: d.clePex },
      })
      continue
    }
    await updateWithVersion({
      expectedVersion: existant.version,
      update: (where) =>
        tx.destinataire.updateMany({
          where: { id: existant.id, ...where },
          // Q-414 : un mail / téléphone édité à la main (D-05) n'est pas écrasé par le flux.
          data: existant.contactModifie
            ? { ...bumpVersion }
            : { mail: d.mail, telephone: d.telephone, ...bumpVersion },
        }),
      ...COO.version,
    })
    const principale = existant.adresses[0]
    if (!principale)
      await tx.destinataireAdresse.create({ data: { ...adresse, destinataireId: existant.id } })
    else if (existant.nomOrigine === d.nom)
      await updateWithVersion({
        expectedVersion: principale.version,
        update: (where) =>
          tx.destinataireAdresse.updateMany({
            where: { id: principale.id, ...where },
            data: { ...adresse, ...bumpVersion },
          }),
        ...COO.version,
      })
    c.misesAJour++
  }
  const transports = lireTransports(await lireParametreTexte(tx, 'integration.transportParAtelier'))
  // RG-COO-120 : lignes manquantes créées EN BASE (INSERT … SELECT, une requête par transporteur) : destinataires ×
  // ateliers peut compter des millions de couples quand la base grossit (une lecture + un createMany JS dépassait
  // 60 s, ANO-055). La clé unique (destinataire, atelier) garde l'idempotence ; l'atelier 0 est exclu.
  const horodatage = maintenant.toISOString()
  const idsDedies = [...transports.parAtelier.keys()]
  for (const [atelierId, t] of transports.parAtelier)
    await tx.$executeRaw`INSERT OR IGNORE INTO tr_ate_dest_trans (dest_id, ate_id, trans_id, tarif, created_at)
      SELECT d.id, a.id, ${t.transporteur}, ${t.tarif}, ${horodatage}
      FROM tr_destinataire d CROSS JOIN tr_atelier a
      WHERE a.id = ${atelierId} AND a.id <> 0`
  if (transports.defaut) {
    const t = transports.defaut
    await tx.$executeRaw`INSERT OR IGNORE INTO tr_ate_dest_trans (dest_id, ate_id, trans_id, tarif, created_at)
      SELECT d.id, a.id, ${t.transporteur}, ${t.tarif}, ${horodatage}
      FROM tr_destinataire d CROSS JOIN tr_atelier a
      WHERE a.id <> 0 AND a.id NOT IN (SELECT value FROM json_each(${JSON.stringify(idsDedies)}))`
  }
  return c
}

// ───────────────────────────── Flux préparation fixe / pliage ─────────────────────────────

export interface ParametresPreparation {
  sites: number[]
  statutEnvoyee: number
  typePliage: number
  typesDeroulants: number[]
  routagePliage: Map<number, number>
  routageFixe: Map<number, number>
}

export async function lireParametresPreparation(tx: Db | Tx): Promise<ParametresPreparation> {
  const t = (cle: Parameters<typeof lireParametreTexte>[1]) => lireParametreTexte(tx, cle)
  return {
    sites: lireNombres(await t('integration.sitesPreparation')),
    statutEnvoyee: Number(await t('integration.statutPrepaEnvoyee')),
    typePliage: Number(await t('integration.typePreparationPliage')),
    typesDeroulants: lireNombres(await t('integration.typesDeroulants')),
    routagePliage: lirePaires(await t('integration.routagePliage')),
    routageFixe: lirePaires(await t('integration.routageFixe')),
  }
}

// RG-COO-121 : atelier de destination d'un détail de prépa (pliage / 2 m² fixe), `undefined` si le site
// n'a pas d'atelier (atelier 0) ; null si le type est un déroulant (exclu).
export function routerDetail(
  p: ParametresPreparation,
  idSiteCcf: number | null,
  idTypePreparation: number,
): number | undefined | null {
  if (p.typesDeroulants.includes(idTypePreparation)) return null
  const table = idTypePreparation === p.typePliage ? p.routagePliage : p.routageFixe
  return idSiteCcf === null ? undefined : table.get(idSiteCcf)
}

export interface ResultatGroupe extends Compteurs {
  refusees: number
  integre: boolean
  dossiers: number[]
}

/** Lundi 0 h (UTC) de la semaine de `date` (lundi = début de semaine ISO, sans le paramètre régional `datefirst`). */
function lundiDe(date: Date): Date {
  const jour = (date.getUTCDay() + 6) % 7 // 0 = lundi … 6 = dimanche
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - jour))
}

// RG-COO-124 (HYPOTHÈSE Q-196, legacy `p_integ_preparation.sql:15-24,296-331`, calcul ISO explicite) : lundi à jeudi,
// la quantité (`rpc_qte`) des lignes « A traiter » / « En cours » dont le premier départ est ≥ début de semaine
// + 14 jours est réalignée sur la `QuantiteEntretien` de Broadcast ; vendredi à dimanche : seulement les départs
// ≥ + 21 jours ET les lignes sans UM. L'entretien de Broadcast est repris sans ressaisie (EX-COO-501).
export async function realignerEntretien(tx: Tx, g: GroupePreparation, le: Date): Promise<number> {
  const semaineEnCours = (le.getUTCDay() + 6) % 7 <= 3 // lundi (0) à jeudi (3)
  const seuil = new Date(lundiDe(le).getTime() + (semaineEnCours ? 14 : 21) * 86_400_000)
  let realignees = 0
  for (const d of g.details) {
    if (d.quantiteEntretien === undefined || d.quantiteEntretien === null) continue
    if (!d.datePremierDepart || d.datePremierDepart.getTime() < seuil.getTime()) continue
    const lignes = await tx.repartition.findMany({
      where: {
        idPreparationDetail: d.idPreparationDetail,
        contNum: d.contNum,
        statut: { in: ['A_TRAITER', 'EN_COURS'] },
        ...(semaineEnCours ? {} : { uniteId: null }),
      },
    })
    for (const l of lignes) {
      if (l.qte === d.quantiteEntretien) continue
      await updateWithVersion({
        expectedVersion: l.version,
        update: (where) =>
          tx.repartition.updateMany({
            where: { id: l.id, ...where },
            data: { qte: d.quantiteEntretien, ...bumpVersion },
          }),
        ...COO.version,
      })
      realignees++
    }
  }
  if (realignees > 0)
    await ecrireJournal(tx, {
      typeEntite: 'REPARTITION',
      entiteId: `groupe:${String(g.idGroupe)}`,
      action: 'INTEGRATION_GROUPE_PREPARATION',
      parId: null,
      nouvelleValeur: `Entretien Broadcast repris : ${String(realignees)} ligne(s) réalignée(s)`,
      complement: CIRCE_AUTOMATIQUE,
      donnees: { realignees, regle: 'RG-COO-124' },
    })
  return realignees
}

// RG-COO-121 / 122 / 123 / 063 / 086 / 094 : un groupe de préparation Broadcast (transaction de l'appelant).
export async function integrerGroupePreparation(
  tx: Tx,
  g: GroupePreparation,
  p: ParametresPreparation,
  le: Date,
): Promise<ResultatGroupe> {
  const r: ResultatGroupe = { ...compteursVides(), refusees: 0, integre: false, dossiers: [] }
  r.lues = g.details.length
  // RG-COO-121 : groupe pris seulement si son site est géré et son statut Broadcast est « envoyée » (133).
  if (
    g.idSiteCcf === null ||
    !p.sites.includes(g.idSiteCcf) ||
    g.statutBroadcast !== p.statutEnvoyee
  ) {
    r.ignorees = g.details.length
    return r
  }
  const dossiers = new Set<number>()
  for (const d of g.details) {
    // RG-COO-121 / 093 : ligne de travail annulée (rpc_statut 4) ou type déroulant : non prise.
    const routage = routerDetail(p, g.idSiteCcf, d.idTypePreparation)
    if (d.statutTravail === 4 || routage === null) {
      r.ignorees++
      continue
    }
    // RG-COO-122 : une ligne déjà intégrée et non annulée bloque le renvoi (tentative tracée + alerte
    // « prépa renvoyée non intégrée » à la Coordination, HYPOTHÈSE Q-216).
    const existante = await tx.repartition.findFirst({
      where: {
        idPreparationDetail: d.idPreparationDetail,
        contNum: d.contNum,
        statut: { not: 'ANNULE' },
      },
      select: { id: true },
    })
    if (existante) {
      r.refusees++
      await ecrireJournal(tx, {
        typeEntite: 'DOSSIER',
        entiteId: d.contNum,
        action: 'PREPA_RENVOYEE_NON_INTEGREE',
        parId: null,
        nouvelleValeur: `Prépa renvoyée non intégrée : détail ${String(d.idPreparationDetail)} déjà intégré (à débloquer d’abord).`,
        complement: 'RG-COO-122',
        donnees: {
          contNum: d.contNum,
          idGroupe: g.idGroupe,
          idPreparationDetail: d.idPreparationDetail,
        },
      })
      continue
    }
    await assurerDossier(tx, d.contNum, d.annonceur)
    const atelierId = await atelierExistant(
      tx,
      routage,
      { contNum: d.contNum, idSiteCcf: g.idSiteCcf, idTypePreparation: d.idTypePreparation },
      'RG-COO-121',
    )
    const support =
      d.supportId === null
        ? null
        : await tx.categorieSupport.findUnique({ where: { id: d.supportId }, select: { id: true } })
    if (d.supportId !== null && !support)
      await referenceManquante(tx, `Support ${String(d.supportId)} absent du référentiel.`, {
        contNum: d.contNum,
        regle: 'RG-COO-121',
      })
    const typePrepa = await tx.typePreparation.findUnique({
      where: { id: d.idTypePreparation },
      select: { id: true },
    })
    await tx.repartition.create({
      data: {
        statut: 'A_TRAITER',
        atelierId,
        supportId: support?.id ?? null,
        typePreparationId: typePrepa?.id ?? null,
        destinataireId: await destinataireDe(tx, d.destinataire),
        desType: d.destinataire?.type ?? null,
        desId: d.destinataire ? BigInt(d.destinataire.clePex) : null,
        semNum: d.semaine.semaine,
        semAnnee: d.semaine.annee,
        annonceur: d.annonceur,
        theme: d.theme,
        repiquage: d.repiquage,
        repiquageId: d.repiquageId,
        numAfficheAmt: d.numAfficheAmt === null ? null : BigInt(d.numAfficheAmt),
        qte: d.quantite,
        dateAffichage: d.dateAffichage,
        contNum: d.contNum,
        idPreparationDetail: d.idPreparationDetail,
        idGroupePreparation: g.idGroupe,
      },
    })
    r.creees++
    dossiers.add(d.contNum)
  }
  // RG-COO-086 / 094 / 095 : les lignes attendues du dossier passent en source PREPA (ou sont créées) à
  // partir des répartitions intégrées ; RG-COO-063 / 042 : préparation reçue, Instruction OK automatique.
  for (const contNum of dossiers) {
    await alimenterDepuisPreparation(tx, await lignesPrepaDepuisProduction(tx, le, [contNum]), le)
    await integrerPreparation(tx, contNum)
  }
  r.dossiers = [...dossiers]
  r.integre = dossiers.size > 0
  await realignerEntretien(tx, g, le)
  // RG-COO-123 : suivi d'intégration par groupe, journalisé sans blocage (« partiel » si des détails n'ont
  // pas été intégrés ; la condition legacy `count(distinct rpc_statut) <> 8` est INCERTAINE, Q-228).
  await ecrireJournal(tx, {
    typeEntite: 'REPARTITION',
    entiteId: `groupe:${String(g.idGroupe)}`,
    action: 'INTEGRATION_GROUPE_PREPARATION',
    parId: null,
    nouvelleValeur:
      r.refusees + r.ignorees > 0
        ? 'integration groupe de preparation partiel'
        : 'integration groupe de preparation',
    complement: CIRCE_AUTOMATIQUE,
    donnees: { integres: r.creees, refuses: r.refusees, ignores: r.ignorees },
  })
  return r
}

// ───────────────────────────── Flux trains / instructions (déroulant) ─────────────────────────────

/** RG-COO-126 : atelier déroulant de (surface, site), `undefined` si aucun (atelier 0). */
export function atelierDeroulantDe(
  table: Map<string, number>,
  idSurface: number | null,
  idSiteCcf: number | null,
): number | undefined {
  if (idSurface === null || idSiteCcf === null) return undefined
  return table.get(`${String(idSurface)}:${String(idSiteCcf)}`)
}

export interface ResultatFaces extends Compteurs {
  code: string
}

// RG-COO-129 / 130 / 041 : faces d'UN dossier × semaine × atelier (transaction de l'appelant).
export async function integrerFacesInstruction(
  tx: Tx,
  faces: FaceBroadcast[],
  atelierDeroulant: Map<string, number>,
): Promise<ResultatFaces> {
  const premiere = faces[0]
  if (!premiere) return { ...compteursVides(), code: '' }
  const atelierId = await atelierExistant(
    tx,
    atelierDeroulantDe(atelierDeroulant, premiere.idSurface, premiere.idSiteCcf),
    { contNum: premiere.contNum, idSurface: premiere.idSurface, idSiteCcf: premiere.idSiteCcf },
    'RG-COO-126',
  )
  const code = codeInstruction(premiere.semaine, atelierId, premiere.contNum)
  const r: ResultatFaces = { ...compteursVides(), lues: faces.length, code }
  await assurerDossier(tx, premiere.contNum, premiere.annonceur)
  const instruction = await tx.instruction.findUnique({ where: { code } })
  // RG-COO-129 (1) / RG-COO-053 : instruction au-delà de « En cours » → faces non réintégrées, renvoi
  // ignoré mais signalé (HYPOTHÈSE Q-216 : alerte « Rajout après préparation »).
  if (instruction && instruction.statut !== 'A_TRAITER' && instruction.statut !== 'EN_COURS') {
    r.ignorees = faces.length
    await ecrireJournal(tx, {
      typeEntite: 'INSTRUCTION',
      entiteId: code,
      action: 'RENVOI_BROADCAST_IGNORE',
      parId: null,
      ancienneValeur: instruction.statut,
      nouvelleValeur: `Faces renvoyées par Broadcast ignorées (${String(faces.length)}).`,
      complement: 'RG-COO-129',
      donnees: { contNum: premiere.contNum },
    })
    return r
  }
  // RG-COO-129 (5) / RG-COO-041 : chapeau d'instruction manquant créé (À traiter, « contrat », « BC »).
  if (!instruction)
    await creerChapeauATraiter(tx, {
      code,
      contNum: premiere.contNum,
      semaine: premiere.semaine,
      atelierId,
    })
  // RG-COO-129 (2) : la suppression des anciennes faces est faite UNE fois par dossier × semaine, avant
  // l'insertion de tous ses groupes (supprimerFacesRemplacables, ANO-034).
  for (const f of faces) {
    const destinataireId = await destinataireDe(tx, f.destinataire)
    // RG-COO-130 / RG-COO-207 : une nouvelle face reprend l'afficheur, le nom et le destinataire des faces déjà engagées
    // (statuts 2, 5 à 10) du même panel, même semaine et année du contrat (legacy : RefPanel, cont_anbas,
    // cont_sembas).
    const reference =
      f.refPanel === null
        ? null
        : await tx.faceTrain.findFirst({
            where: {
              refPanel: f.refPanel,
              contAnbas: f.semaine.annee,
              contSembas: f.semaine.semaine,
              statut: { in: FACES_REFERENCE_AFFICHEUR },
            },
            orderBy: { id: 'desc' },
          })
    const support =
      f.supportId === null
        ? null
        : await tx.categorieSupport.findUnique({ where: { id: f.supportId }, select: { id: true } })
    await tx.faceTrain.create({
      data: {
        instructionCode: code,
        statut: 'A_TRAITER',
        atelierId,
        supportId: support?.id ?? null,
        cadrIdent: f.cadrIdent,
        cadreLib: f.cadreLib,
        dateDepart: f.dateDepart,
        contNum: f.contNum,
        contAnnonc: f.annonceur,
        contSembas: f.semaine.semaine,
        contAnbas: f.semaine.annee,
        depSembas: f.depart.semaine,
        depAnbas: f.depart.annee,
        theme: f.theme,
        themeId: f.themeId,
        repiquage: f.repiquage,
        repiquageId: f.repiquageId,
        ftType: f.ftType,
        refPanel: f.refPanel,
        afficheurId: reference?.afficheurId ?? f.afficheurId,
        afficheurNom: reference?.afficheurNom ?? f.afficheurNom,
        destinataireId: reference?.destinataireId ?? destinataireId,
        // RG-COO-200 / 202 : emplacement legacy (identifiant de train, ordre de parcours), Q-192 (1).
        emplSectCode: f.emplSectCode ?? null,
        emplDepaCode: f.emplDepaCode ?? null,
        commNumord: f.commNumord ?? null,
        emplNumord: f.emplNumord ?? null,
        emplAdresse1: f.emplAdresse1 ?? null,
        train: f.train ?? null,
        rang: f.rang ?? null,
      },
    })
    r.creees++
    // RG-COO-130 : les faces 0 / 1 du même panel / semaine reprennent l'afficheur de la face insérée.
    if (f.refPanel !== null && !reference) {
      const aSuivre = await tx.faceTrain.findMany({
        where: {
          refPanel: f.refPanel,
          contAnbas: f.semaine.annee,
          contSembas: f.semaine.semaine,
          statut: { in: statuts(0, 1) },
          NOT: { afficheurId: f.afficheurId },
        },
        select: { id: true, version: true },
      })
      for (const x of aSuivre)
        await reaffecterFace(tx, x, {
          afficheurId: f.afficheurId,
          afficheurNom: f.afficheurNom,
        })
    }
  }
  await ecrireJournal(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: code,
    action: 'INTEGRATION_FACES',
    parId: null,
    nouvelleValeur: `${String(r.creees)} face(s) intégrée(s)`,
    complement: CIRCE_AUTOMATIQUE,
  })
  return r
}

/** Réaffectation de la ressource d'une face, sous verrou de version (CLAUDE.md §6). */
async function reaffecterFace(
  tx: Tx,
  face: { id: number; version: number },
  data: { afficheurId: number | null; afficheurNom: string | null; destinataireId?: number | null },
) {
  await updateWithVersion({
    expectedVersion: face.version,
    update: (where) =>
      tx.faceTrain.updateMany({
        where: { id: face.id, ...where },
        data: { ...data, ...bumpVersion },
      }),
    ...COO.version,
  })
}

export interface PanelATraiter {
  refPanel: string
  contAnbas: number
  contSembas: number
  dateDepart: Date
  face: FaceBroadcast
}

// RG-COO-130 (3e clause, legacy p_integ_train_affiches.sql:111-117 #PanelATraiter) : AVANT la suppression des
// anciennes faces, panels déjà présents pour les faces reçues (faces existantes du dossier, même panel, même
// semaine et année du contrat, statut ≤ 4), avec la ressource de la face reçue. HYPOTHÈSE Q-188 (16) : la
// correspondance legacy par IdFaceOTAffichage (non repris) est approchée par (dossier, semaine, panel).
export async function panelsATraiter(tx: Tx, faces: FaceBroadcast[]): Promise<PanelATraiter[]> {
  const sortie = new Map<string, PanelATraiter>()
  for (const f of faces) {
    if (f.refPanel === null) continue
    const existantes = await tx.faceTrain.findMany({
      where: {
        refPanel: f.refPanel,
        contNum: f.contNum,
        contAnbas: f.semaine.annee,
        contSembas: f.semaine.semaine,
        statut: { in: statuts(0, 1, 2, 3, 4) },
      },
      select: { dateDepart: true },
    })
    for (const e of existantes) {
      const cle = [f.refPanel, formatSemaineIso(f.semaine), e.dateDepart.toISOString()].join('|')
      if (!sortie.has(cle))
        sortie.set(cle, {
          refPanel: f.refPanel,
          contAnbas: f.semaine.annee,
          contSembas: f.semaine.semaine,
          dateDepart: e.dateDepart,
          face: f,
        })
    }
  }
  return [...sortie.values()]
}

// RG-COO-130 (3e clause, legacy p_integ_train_affiches.sql:313-338) : après l'intégration, pour chaque panel à
// traiter dont TOUTES les faces (même panel, semaine et année du contrat, date de départ) sont aux statuts 0 à
// 4, la ressource (afficheur, nom, destinataire) reçue est reportée sur toutes les faces du panel, tracé
// « UpdateRessource ». Un panel qui a une face au-delà (statut > 4) n'est pas touché.
export async function mettreAJourRessourcesPanels(
  tx: Tx,
  panels: PanelATraiter[],
): Promise<number> {
  let n = 0
  for (const p of panels) {
    const duPanel = await tx.faceTrain.findMany({
      where: {
        refPanel: p.refPanel,
        contAnbas: p.contAnbas,
        contSembas: p.contSembas,
        dateDepart: p.dateDepart,
      },
      select: { id: true, version: true, statut: true },
    })
    if (duPanel.length === 0 || duPanel.some((x) => !statuts(0, 1, 2, 3, 4).includes(x.statut)))
      continue
    const destinataireId = await destinataireDe(tx, p.face.destinataire)
    for (const x of duPanel)
      await reaffecterFace(tx, x, {
        afficheurId: p.face.afficheurId,
        afficheurNom: p.face.afficheurNom,
        destinataireId,
      })
    await ecrireJournal(tx, {
      typeEntite: 'FACE_TRAIN',
      entiteId: `panel:${p.refPanel}`,
      action: 'INTEGRATION_FACES',
      parId: null,
      nouvelleValeur: 'UpdateRessource',
      complement: 'RG-COO-130',
      donnees: {
        refPanel: p.refPanel,
        semaine: formatSemaineIso({ annee: p.contAnbas, semaine: p.contSembas }),
        faces: duPanel.length,
        afficheurId: p.face.afficheurId,
      },
    })
    n++
  }
  return n
}

// RG-COO-129 (2) : anciennes faces (départ futur) du même dossier / semaine aux statuts 0, 1, 3, 4 supprimées
// avant la recréation, UNE fois par dossier × semaine (un dossier déroulant sur deux ateliers garde les faces
// de ses deux instructions, ANO-034) ; les faces d'une instruction au-delà de « En cours » ne sont jamais
// touchées (RG-COO-129 (1) : elles ne sont pas réintégrées).
export async function supprimerFacesRemplacables(
  tx: Tx,
  contNum: number,
  semaine: SemaineIso,
  maintenant: Date,
): Promise<number> {
  const supprimees = await tx.faceTrain.deleteMany({
    where: {
      contNum,
      contAnbas: semaine.annee,
      contSembas: semaine.semaine,
      dateDepart: { gt: maintenant },
      statut: { in: FACES_REMPLACABLES },
      instruction: { statut: { in: ['A_TRAITER', 'EN_COURS'] } },
    },
  })
  return supprimees.count
}

/** RG-COO-129 : faces d'un dossier × semaine, en sous-groupes par instruction (surface, site → atelier). */
export function grouperFacesParDossier(faces: FaceBroadcast[]): FaceBroadcast[][][] {
  const parDossier = new Map<string, FaceBroadcast[]>()
  for (const f of faces) {
    const k = `${String(f.contNum)}|${formatSemaineIso(f.semaine)}`
    parDossier.set(k, [...(parDossier.get(k) ?? []), f])
  }
  return [...parDossier.values()].map(grouperFaces)
}

/** Regroupe les faces par instruction (dossier × semaine × (surface, site)). */
export function grouperFaces(faces: FaceBroadcast[]): FaceBroadcast[][] {
  const groupes = new Map<string, FaceBroadcast[]>()
  for (const f of faces) {
    const k = [f.contNum, formatSemaineIso(f.semaine), f.idSurface ?? '', f.idSiteCcf ?? ''].join(
      '|',
    )
    groupes.set(k, [...(groupes.get(k) ?? []), f])
  }
  return [...groupes.values()]
}

/** RG-COO-131 : faces du lot marqué (`Traitement = 'E'`, `IdTypeDestinationDA` non nul). */
export const faceAIntegrer = (f: FaceBroadcast) =>
  f.traitement === 'E' && f.idTypeDestinationDa !== null

// RG-COO-128 : types de préparation / supports forcés (reprise à l'identique, sens à clarifier : Q-228) ;
// chaque identifiant est vérifié dans le référentiel (sinon null + donnée de référence manquante).
function typesForces(tx: Tx, t: TypesVisuels, contNum: number) {
  const tpr = async (id: number | null) => {
    if (id === null) return null
    const x = await tx.typePreparation.findUnique({ where: { id }, select: { id: true } })
    if (!x)
      await referenceManquante(tx, `Type de préparation ${String(id)} absent du référentiel.`, {
        contNum,
        regle: 'RG-COO-128',
      })
    return x?.id ?? null
  }
  const sup = async (id: number | null) => {
    if (id === null) return null
    const x = await tx.categorieSupport.findUnique({ where: { id }, select: { id: true } })
    if (!x)
      await referenceManquante(tx, `Support ${String(id)} absent du référentiel.`, {
        contNum,
        regle: 'RG-COO-128',
      })
    return x?.id ?? null
  }
  return { tpr, sup }
}

// RG-COO-041 / 126 / 127 / 128 : une instruction lue (transaction de l'appelant).
export async function integrerInstructionLue(
  tx: Tx,
  i: InstructionLue,
  atelierDeroulant: Map<string, number>,
  t: TypesVisuels,
) {
  const atelierId = await atelierExistant(
    tx,
    atelierDeroulantDe(atelierDeroulant, i.idSurface, i.idSiteCcf),
    { contNum: i.contNum, idSurface: i.idSurface, idSiteCcf: i.idSiteCcf },
    'RG-COO-126',
  )
  const code = codeInstruction(i.semaine, atelierId, i.contNum)
  await assurerDossier(tx, i.contNum, i.annonceur)
  const bdx = i.origine?.trim().toLowerCase() === 'bdx'
  const { tpr, sup } = typesForces(tx, t, i.contNum)
  const tprVisuel = await tpr(bdx ? t.bdx : t.visuel.typePreparationId)
  const supVisuel = await sup(t.visuel.supportId)
  const details: NonNullable<InstructionBroadcast['details']> = []
  for (const d of i.details) {
    const venusial = t.venusial !== null && d.idTypePreparation === t.venusial.type
    details.push({
      cadrIdent: d.cadrIdent,
      cadreLib: d.cadreLib,
      supportId: venusial ? await sup(t.venusial?.supportId ?? null) : await sup(d.supportId),
      typePreparationId: await tpr(
        bdx ? t.bdx : venusial ? (t.venusial?.typePreparationId ?? null) : t.detail,
      ),
      afchIdent: d.afchIdent,
      theme: d.theme,
      repiquageIdent: d.repiquageIdent,
      repiquage: d.repiquage,
      type: d.type,
    })
  }
  const lue: InstructionBroadcast = {
    code,
    type: i.type,
    contNum: i.contNum,
    semaine: i.semaine,
    atelierId,
    annonceur: i.annonceur,
    commentaire: i.commentaire,
    sectCodeCentre: i.sectCodeCentre,
    talrTrait: i.talrTrait,
    entretien: i.entretien,
    details,
    visuels: i.visuels.map((v) => ({
      afchIdent: v.afchIdent,
      supportId: supVisuel,
      typePreparationId: tprVisuel,
      theme: v.theme,
      pourcentage: v.pourcentage,
    })),
  }
  return { code, resultat: await integrerInstruction(tx, lue) }
}

// RG-COO-062 / RG-X-065 : vente annulée dans Broadcast → dossier annulé (lignes ANNULEE, affiches en stock) ;
// un dossier inconnu ou déjà annulé est ignoré (rejeu idempotent, RG-COO-102).
export async function integrerAnnulation(tx: Tx, contNum: number) {
  const d = await tx.dossier.findUnique({ where: { contNum }, select: { statut: true } })
  if (!d || d.statut === 'ANNULE') return 'IGNORE' as const
  await annulerDossier(tx, contNum)
  return 'ANNULE' as const
}
