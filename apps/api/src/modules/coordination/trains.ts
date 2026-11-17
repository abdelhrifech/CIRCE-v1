// COO-P09 — Liste des trains (ECR-COO-05) et actions sur les trains : couverture des visuels (RG-COO-208),
// positions (RG-COO-209), changer statut (RG-COO-218), annuler un thème (RG-COO-219), débloquer semaine
// (RG-COO-220), fractionner (RG-COO-221), raccrocher (RG-COO-222), point de non-retour (RG-COO-223), créer
// (RG-COO-224), supprimer (RG-COO-225), dupliquer (RG-COO-226), filtres (RG-COO-228), n° de panneau (RG-COO-229),
// historique (RG-COO-307), verrou de version et idempotence des actions de masse (RG-COO-308).
// HYPOTHÈSE Q-250 : le train (unité de production) est calculé à partir des faces de même `train_id`.
import {
  formatSemaineIso,
  lireSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  STATUTS_UNITE_EN_PRODUCTION,
  type AnnulerThemeTrain,
  type ChangerStatutFaces,
  type CreerTrain,
  type DebloquerSemaineTrains,
  type DupliquerTrain,
  type EtatPosition,
  type FicheTrain,
  type FractionnerTrains,
  type LigneTrain,
  type ListeTrains,
  type RaccrocherVisuel,
  type ResultatActionTrains,
  type StatutUnite,
  type SupprimerTrain,
  type TrainsQuery,
  type TrainVersion,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { hasPermission } from '../../core/permissions/permissions.ts'
import { parPaquets } from '../../core/paquets.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { FaceTrain, StatutProduction } from '../../generated/prisma/client.ts'
import { lireParametreNombre } from '../reception/parametres.ts'
import { assertDroitCoordination, assertPerimetreAtelier, COO } from './permissions.ts'
import {
  CHANGER_STATUT_LISTE,
  CHANGER_STATUT_PREPARATION,
  statutUnite,
  TRANSITIONS_FACE,
  TRANSITIONS_INSTRUCTION_TRAINS,
} from './statuts-trains.ts'
import { nettoyerTheme } from './trains-calcul.ts'
import { normaliserTheme } from './validation-admin.ts'

type Client = Db | Tx

/** Faces qui composent un train (statut ≥ Instruction OK, non annulées). */
export const STATUTS_TRAIN: StatutProduction[] = [
  'INSTRUCTION_OK',
  'A_IMPRIMER',
  'EXPORT_PREPA',
  'AU_ROULAGE',
  'PREPARE',
  'A_EXPEDIER',
  'TERMINE',
]
export const MESSAGE_NON_RETOUR =
  'Train déjà en production : impossible de le modifier (point de non-retour).'

export interface AtelierPerimetre {
  id: number
  libelle: string
  plateformeId: number
  plateforme: string
  type: string
}

/** RG-COO-228 / RG-COO-167 : ateliers du périmètre de l'utilisateur. */
export async function ateliersDuPerimetre(
  db: Client,
  identity: Identity,
): Promise<AtelierPerimetre[]> {
  const ateliers = await db.atelier.findMany({
    include: { plateforme: { select: { nom: true } } },
    orderBy: { id: 'asc' },
  })
  return ateliers
    .filter(
      (a) =>
        identity.perimetre.toutesPlateformes ||
        identity.perimetre.lignes.some(
          (l) =>
            l.plateformeId === a.plateformeId && (l.atelierId === null || l.atelierId === a.id),
        ),
    )
    .map((a) => ({
      id: a.id,
      libelle: a.libelle,
      plateformeId: a.plateformeId,
      plateforme: a.plateforme.nom,
      type: a.type,
    }))
}

/** RG-COO-167 : ateliers d'un lot d'export / de génération, conservés avec le lot (JSON trié). */
export function ateIdsDeFaces(faces: readonly { atelierId: number | null }[]): string {
  const ids = new Set<number>()
  for (const f of faces) if (f.atelierId !== null) ids.add(f.atelierId)
  return JSON.stringify([...ids].sort((a, b) => a - b))
}

/**
 * RG-COO-167 : un lot (fichier d'export ou de génération, avec destinataires, adresses, annonceurs et thèmes) n'est
 * visible que si TOUS ses ateliers sont dans le périmètre de l'utilisateur ; un lot sans atelier connu (antérieur à
 * la colonne) n'est visible que de qui voit toutes les plateformes. HYPOTHÈSE Q-193 (13).
 */
export function lotDansPerimetre(
  ateIds: string,
  ateliersAutorises: ReadonlySet<number>,
  identity: Identity,
): boolean {
  if (identity.perimetre.toutesPlateformes) return true
  const ids = JSON.parse(ateIds) as number[]
  return ids.length > 0 && ids.every((id) => ateliersAutorises.has(id))
}

/**
 * Audit COO-P10 m6 : lots visibles par l'utilisateur, du plus récent au plus ancien. Le périmètre d'un lot est un
 * JSON (`ate_ids`) : on lit par paquets (curseur sur l'identifiant décroissant) jusqu'à `limite` lots visibles ou
 * jusqu'à épuisement, sans tronquer un site dont les lots seraient noyés parmi ceux des autres sites.
 */
export async function lotsVisibles<T extends { id: number; ateIds: string }>(
  lire: (avantId: number | null, taille: number) => Promise<T[]>,
  ateliersAutorises: ReadonlySet<number>,
  identity: Identity,
  limite: number,
): Promise<T[]> {
  const TAILLE = 200
  const visibles: T[] = []
  let curseur: number | null = null
  for (;;) {
    const page = await lire(curseur, TAILLE)
    for (const l of page)
      if (visibles.length < limite && lotDansPerimetre(l.ateIds, ateliersAutorises, identity))
        visibles.push(l)
    const dernier = page.at(-1)
    if (visibles.length >= limite || page.length < TAILLE || !dernier) return visibles
    curseur = dernier.id
  }
}

/** Clé d'un visuel pour la couverture : thème sans le complément « --- » ni guillemets, normalisé. */
export function cleTheme(theme: string | null): string {
  return normaliserTheme((theme ?? '').replace(/-{3}$/, '').replace(/['"]/g, ' '))
}
export const cleVisuel = (plateformeId: number, contNum: number | null, theme: string | null) =>
  `${String(plateformeId)}|${String(contNum ?? 0)}|${cleTheme(theme)}`

interface Couverture {
  /** Face couverte par le reçu (départ le plus proche servi d'abord). */
  couvertes: Set<number>
  recu: Map<string, number>
  attendu: Map<string, number>
  emplacements: Map<string, string[]>
}

// RG-COO-208 / RG-X-079 / RG-X-080 (HYPOTHÈSE Q-280 ; le reçu se rattache au VISUEL, jamais au destinataire) : le reçu d'un visuel (somme des quantités des affiches rattachées aux
// lignes de ce thème sur le site, à l'enregistrement de la réception) couvre d'abord les positions dont le départ
// camion est le plus proche ; une position fractionnée n'entre plus dans le besoin (RG-COO-209). Recalculée à
// chaque lecture : réception, fractionnement, raccrochage ou suppression la font évoluer sans autre écriture.
export async function couverture(
  db: Client,
  faces: readonly Pick<FaceTrain, 'contNum' | 'theme' | 'atelierId'>[],
  plateformeDe: ReadonlyMap<number, number>,
): Promise<Couverture> {
  const res: Couverture = {
    couvertes: new Set(),
    recu: new Map(),
    attendu: new Map(),
    emplacements: new Map(),
  }
  const contNums = [...new Set(faces.map((f) => f.contNum).filter((c) => c !== null))]
  if (contNums.length === 0) return res
  const cles = new Set(
    faces.map((f) => cleVisuel(plateformeDe.get(f.atelierId ?? 0) ?? 0, f.contNum, f.theme)),
  )
  const consommatrices = (
    await parPaquets(contNums, (paquet) =>
      db.faceTrain.findMany({
        where: {
          contNum: { in: paquet },
          trainId: { not: null },
          fractionnee: false,
          statut: { in: STATUTS_TRAIN },
        },
        select: {
          id: true,
          contNum: true,
          theme: true,
          atelierId: true,
          dateDepart: true,
          trainId: true,
        },
      }),
    )
  )
    .map((f) => ({
      ...f,
      cle: cleVisuel(plateformeDe.get(f.atelierId ?? 0) ?? 0, f.contNum, f.theme),
    }))
    .filter((f) => cles.has(f.cle))
    .sort(
      (a, b) =>
        a.dateDepart.getTime() - b.dateDepart.getTime() ||
        (a.trainId ?? '').localeCompare(b.trainId ?? '') ||
        a.id - b.id,
    )
  const liens = await parPaquets(contNums, (paquet) =>
    db.afficheAttendue.findMany({
      where: { actif: true, ligneAttendue: { contNum: { in: paquet } } },
      select: {
        quantite: true,
        ligneAttendue: { select: { plateformeId: true, contNum: true, theme: true } },
        affiche: { select: { allee: true, rayon: true } },
      },
    }),
  )
  for (const l of liens) {
    const k = cleVisuel(
      l.ligneAttendue.plateformeId,
      l.ligneAttendue.contNum,
      l.ligneAttendue.theme,
    )
    if (!cles.has(k)) continue
    res.recu.set(k, (res.recu.get(k) ?? 0) + l.quantite)
    const emp = [l.affiche.allee, l.affiche.rayon].filter(Boolean).join('-')
    if (emp && !(res.emplacements.get(k) ?? []).includes(emp))
      res.emplacements.set(k, [...(res.emplacements.get(k) ?? []), emp])
  }
  const reste = new Map(res.recu)
  for (const f of consommatrices) {
    res.attendu.set(f.cle, (res.attendu.get(f.cle) ?? 0) + 1)
    const r = reste.get(f.cle) ?? 0
    if (r > 0) {
      res.couvertes.add(f.id)
      reste.set(f.cle, r - 1)
    }
  }
  return res
}

export interface TrainCalcule {
  trainId: string
  version: string
  faces: FaceTrain[]
  atelier: AtelierPerimetre | null
  destinataire: string | null
  afficheur: string | null
  origine: LigneTrain['origine']
  positions: (LigneTrain['positions'][number] & { cle: string })[]
  statut: StatutUnite
  fractionne: boolean
  depart: Date
  semaineDepart: { annee: number; semaine: number }
}

const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Position renvoyée à l'écran (sans la clé interne de visuel). */
function positionPublique(p: TrainCalcule['positions'][number]): LigneTrain['positions'][number] {
  return {
    lettre: p.lettre,
    faceId: p.faceId,
    contNum: p.contNum,
    annonceur: p.annonceur,
    theme: p.theme,
    repiquage: p.repiquage,
    etat: p.etat,
    ftType: p.ftType,
  }
}

/** RG-COO-308 : version d'un train = empreinte des versions de ses faces (change à toute écriture). */
export function versionTrain(faces: readonly Pick<FaceTrain, 'id' | 'version'>[]): string {
  const somme = faces.reduce((s, f) => s + f.version, 0)
  const max = faces.reduce((m, f) => Math.max(m, f.id), 0)
  return `${String(faces.length)}.${String(somme)}.${String(max)}`
}

/** Construit les trains (unités) à partir de leurs faces (HYPOTHÈSE Q-250). */
export async function construireTrains(
  db: Client,
  faces: FaceTrain[],
  ateliers: readonly AtelierPerimetre[],
): Promise<TrainCalcule[]> {
  const parAtelier = new Map(ateliers.map((a) => [a.id, a]))
  const plateformeDe = new Map(ateliers.map((a) => [a.id, a.plateformeId]))
  const cov = await couverture(db, faces, plateformeDe)
  const destinataires = new Map(
    (
      await db.destinataire.findMany({
        where: { id: { in: [...new Set(faces.map((f) => f.destinataireId ?? 0))] } },
        select: { id: true, nom: true, nomOrigine: true },
      })
    ).map((d) => [d.id, d.nom ?? d.nomOrigine]),
  )
  const groupes = new Map<string, FaceTrain[]>()
  for (const f of faces) groupes.set(f.trainId ?? '', [...(groupes.get(f.trainId ?? '') ?? []), f])
  const trains: TrainCalcule[] = []
  for (const [trainId, fs] of groupes) {
    const tri = [...fs].sort((a, b) => (a.ordreReel ?? 0) - (b.ordreReel ?? 0) || a.id - b.id)
    const premiere = tri[0]
    if (!premiere) continue
    const positions = tri.map((f, i) => {
      const etat: EtatPosition = f.fractionnee
        ? 'FRACTIONNE'
        : cov.couvertes.has(f.id)
          ? 'OK'
          : 'MANQUANT'
      return {
        lettre: LETTRES[i] ?? String(i + 1),
        faceId: f.id,
        contNum: f.contNum,
        annonceur: f.contAnnonc,
        theme: f.theme,
        repiquage: f.repiquage,
        etat,
        ftType: f.ftType,
        cle: cleVisuel(plateformeDe.get(f.atelierId ?? 0) ?? 0, f.contNum, f.theme),
      }
    })
    const couvert = positions.every((p) => p.etat !== 'MANQUANT')
    const origine: LigneTrain['origine'] =
      premiere.origineTrain === 'PRE_TEST' || premiere.origineTrain === 'ENTRETIEN_AJOUTE'
        ? premiere.origineTrain
        : tri.every((f) => f.ftType === 'entretien')
          ? 'ENTRETIEN'
          : 'CALCULE'
    const depart = tri.reduce((d, f) => (f.dateDepart < d ? f.dateDepart : d), premiere.dateDepart)
    trains.push({
      trainId,
      version: versionTrain(tri),
      faces: tri,
      atelier: parAtelier.get(premiere.atelierId ?? 0) ?? null,
      destinataire: destinataires.get(premiere.destinataireId ?? 0) ?? null,
      afficheur: premiere.afficheurNom,
      origine,
      positions,
      statut: statutUnite(
        tri.map((f) => f.statut),
        couvert,
      ),
      fractionne: tri.some((f) => f.fractionnee),
      depart,
      semaineDepart:
        premiere.depAnbas !== null && premiere.depSembas !== null
          ? { annee: premiere.depAnbas, semaine: premiere.depSembas }
          : semaineIsoDe(depart),
    })
  }
  return trains
}

/** Faces des trains du périmètre (option : semaine de départ, atelier, liste d'identifiants). */
export async function facesDesTrains(
  db: Client,
  ateliers: readonly AtelierPerimetre[],
  filtre: {
    semaine?: { annee: number; semaine: number }
    atelierId?: number
    trainIds?: string[]
    /** COO-P11 : trains dont le départ est postérieur à cette date (listes sans semaine choisie). */
    departApres?: Date
  },
) {
  const ids = ateliers
    .map((a) => a.id)
    .filter((id) => filtre.atelierId === undefined || id === filtre.atelierId)
  return parPaquets(ids, (paquet) =>
    db.faceTrain.findMany({
      where: {
        atelierId: { in: paquet },
        statut: { in: STATUTS_TRAIN },
        ...(filtre.trainIds ? { trainId: { in: filtre.trainIds } } : { trainId: { not: null } }),
        ...(filtre.semaine
          ? { depAnbas: filtre.semaine.annee, depSembas: filtre.semaine.semaine }
          : {}),
        ...(filtre.departApres ? { dateDepart: { gte: filtre.departApres } } : {}),
      },
    }),
  )
}

export { parPaquets }

export const contient = (valeur: string | null, recherche: string | undefined) =>
  recherche === undefined || normaliserTheme(valeur).includes(normaliserTheme(recherche))

/** RG-COO-229 : n° de panneau Broadcast réservé aux chefs d'équipe et coordinateurs (droit dédié). */
export function panneaux(identity: Identity, faces: readonly FaceTrain[]): string[] | null {
  if (!hasPermission(identity, 'suivi_8m2.saisir')) return null
  return [...new Set(faces.map((f) => f.refPanel).filter((p) => p !== null))]
}

// ECR-COO-05 / RG-COO-228 : liste des trains (périmètre d'ateliers, semaine suivante par défaut), lignes de trains
// identiques regroupées (« Nb trains »), indicateurs et encadré « À faire par la Coordination ».
export async function listerTrains(
  db: Db,
  identity: Identity,
  q: TrainsQuery,
  maintenant = new Date(),
): Promise<ListeTrains> {
  assertDroitCoordination(identity, 'train.consulter')
  const semaine = q.depart
    ? lireSemaineIso(q.depart)
    : semaineIsoDe(new Date(maintenant.getTime() + 7 * 86_400_000))
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter((a) => a.type === 'SCROLL')
  const faces = await facesDesTrains(db, ateliers, {
    semaine,
    ...(q.atelier ? { atelierId: q.atelier } : {}),
  })
  const themes = (q.theme ?? []).map(cleTheme)
  const tous = (await construireTrains(db, faces, ateliers)).filter(
    (t) =>
      (q.dossier === undefined || t.positions.some((p) => p.contNum === q.dossier)) &&
      contient(t.destinataire, q.destinataire) &&
      contient(t.afficheur, q.afficheur) &&
      (q.annonceur === undefined || t.positions.some((p) => contient(p.annonceur, q.annonceur))) &&
      (themes.length === 0 || t.positions.some((p) => themes.includes(cleTheme(p.theme)))) &&
      (q.trainsDe === undefined || t.positions.length === q.trainsDe),
  )
  const compter = (statuts: readonly StatutUnite[]) =>
    tous.filter((t) => statuts.includes(t.statut)).length
  const filtres = tous.filter(
    (t) => !q.statut || q.statut.length === 0 || q.statut.includes(t.statut),
  )
  // RG-COO-235 / ECR-COO-05 : rouleur, fichier (lot G-nnnn) et modifications tracées de chaque train.
  const rouleurs = new Map(
    (
      await parPaquets([...new Set(faces.map((f) => f.rouleurId ?? 0))], (paquet) =>
        db.rouleur.findMany({
          where: { id: { in: paquet } },
          select: { id: true, nom: true },
        }),
      )
    ).map((x) => [x.id, x.nom]),
  )
  const fichierDe = new Map<string, string>()
  for (const lot of await db.generationFichiers.findMany({
    where: { depAnnee: semaine.annee, depSemaine: semaine.semaine },
    orderBy: { id: 'asc' },
    select: { lot: true, trains: true },
  }))
    for (const id of JSON.parse(lot.trains) as string[]) fichierDe.set(id, lot.lot)
  const modifications = new Map<string, number>()
  const idsTrains = filtres.map((t) => t.trainId)
  for (let i = 0; i < idsTrains.length; i += 400)
    for (const g of await db.journalAudit.groupBy({
      by: ['entiteId'],
      where: { typeEntite: 'TRAIN', entiteId: { in: idsTrains.slice(i, i + 400) } },
      _count: { _all: true },
    }))
      modifications.set(g.entiteId, g._count._all)
  // RG-COO-235 / 299 : bagues imprimées des trains de la liste (colonne masquée « Bague »).
  const baguesDe = new Map<string, { id: number; reimpressions: number }>()
  for (let i = 0; i < idsTrains.length; i += 400)
    for (const b of await db.bague.findMany({
      where: { trainId: { in: idsTrains.slice(i, i + 400) } },
      select: { trainId: true, id: true, reimpressions: true },
    }))
      baguesDe.set(b.trainId, b)
  const preAssembleDe = (t: TrainCalcule) => {
    const utiles = t.faces.filter((f) => !f.fractionnee)
    return utiles.length > 0 && utiles.every((f) => f.preAssemblage)
  }
  // Trains identiques : même atelier, destinataire, départ, statut et composition.
  const lignes = new Map<string, LigneTrain>()
  for (const t of filtres.sort(
    (a, b) => a.depart.getTime() - b.depart.getTime() || a.trainId.localeCompare(b.trainId),
  )) {
    const k = JSON.stringify([
      t.atelier?.id,
      t.destinataire,
      t.depart.toISOString(),
      t.statut,
      t.fractionne,
      t.origine,
      t.afficheur,
      t.positions.map((p) => [p.contNum, p.theme, p.repiquage, p.etat]),
      t.faces[0]?.rouleurId ?? null,
      preAssembleDe(t),
    ])
    const existante = lignes.get(k)
    const bague = baguesDe.get(t.trainId)
    if (existante) {
      existante.trains.push({ trainId: t.trainId, version: t.version })
      existante.nb++
      if (bague) {
        existante.bagues.push(bague.id)
        existante.reimpressions += bague.reimpressions
      }
      if (existante.panneauxBc) {
        for (const p of panneaux(identity, t.faces) ?? [])
          if (!existante.panneauxBc.includes(p)) existante.panneauxBc.push(p)
      }
      continue
    }
    lignes.set(k, {
      cle: t.trainId,
      trains: [{ trainId: t.trainId, version: t.version }],
      origine: t.origine,
      atelier: t.atelier
        ? { id: t.atelier.id, libelle: t.atelier.libelle, plateforme: t.atelier.plateforme }
        : null,
      machine: null,
      destinataire: t.destinataire,
      afficheur: t.afficheur,
      positions: t.positions.map(positionPublique),
      nb: 1,
      depart: t.depart.toISOString(),
      semaineDepart: t.semaineDepart,
      statut: t.statut,
      fractionne: t.fractionne,
      panneauxBc: panneaux(identity, t.faces),
      preAssemble: preAssembleDe(t),
      rouleur: rouleurs.get(t.faces[0]?.rouleurId ?? 0) ?? null,
      fichier: fichierDe.get(t.trainId) ?? null,
      modifications: modifications.get(t.trainId) ?? 0,
      bagues: bague ? [bague.id] : [],
      reimpressions: bague?.reimpressions ?? 0,
    })
  }
  // Encadré « À faire par la Coordination avant l'export du jeudi 14 h » : instructions pas encore OK dont les
  // faces partent cette semaine (ateliers déroulants du périmètre).
  const enCours = [
    ...new Map(
      (
        await parPaquets(
          ateliers.map((a) => a.id),
          (paquet) =>
            db.faceTrain.findMany({
              where: {
                atelierId: { in: paquet },
                depAnbas: semaine.annee,
                depSembas: semaine.semaine,
                statut: { in: ['A_TRAITER', 'EN_COURS', 'ERREUR'] },
              },
              select: { instructionCode: true, contNum: true },
              distinct: ['instructionCode'],
            }),
        )
      ).map((f) => [f.instructionCode, f]),
    ).values(),
  ]
  return {
    semaine,
    lignes: [...lignes.values()],
    // EX-NEW16-COO-001 : une ligne par face réelle, regroupement historique conservé pour les actions.
    faces: filtres.flatMap((t) => {
      const base = [...lignes.values()].find((l) => l.trains.some((v) => v.trainId === t.trainId))
      if (!base) return []
      return t.faces.map((f) => ({
        ...base,
        cle: t.trainId,
        trains: [{ trainId: t.trainId, version: t.version }],
        nb: 1,
        faceId: f.id,
        adresse: f.emplAdresse1,
        coteCote: f.coteCote,
        positions: t.positions.filter((p) => p.faceId === f.id).map(positionPublique),
        panneauxBc: panneaux(identity, [f]),
        bagues: [baguesDe.get(t.trainId)].flatMap((b) => (b ? [b.id] : [])),
        reimpressions: baguesDe.get(t.trainId)?.reimpressions ?? 0,
      }))
    }),
    indicateurs: {
      aProduire: compter(['EN_ATTENTE', 'PRET']),
      enAttente: compter(['EN_ATTENTE']),
      prets: compter(['PRET']),
      enProduction: compter(['EN_PROD', 'PRODUIT']),
      colisesExpedies: compter(['COLISE', 'EXPEDIE', 'LIVRE']),
    },
    aFaire: {
      instructions: enCours.length,
      dossiers: new Set(enCours.map((f) => f.contNum)).size,
    },
    positionsMax: await lireParametreNombre(db, 'trains.positionsMax'),
    ateliers: ateliers.map((a) => ({ id: a.id, libelle: a.libelle, plateforme: a.plateforme })),
  }
}

/** Charge des trains du périmètre par identifiant (actions) ; 404 si un train est absent. */
export async function chargerTrains(db: Client, identity: Identity, trainIds: readonly string[]) {
  const ateliers = await ateliersDuPerimetre(db, identity)
  const faces = await facesDesTrains(db, ateliers, { trainIds: [...trainIds] })
  const trains = await construireTrains(db, faces, ateliers)
  for (const id of trainIds) {
    if (!trains.some((t) => t.trainId === id)) {
      // RG-COO-167 : un train hors périmètre est traité comme introuvable s'il existe ailleurs.
      const ailleurs = await db.faceTrain.findFirst({
        where: { trainId: id, statut: { in: STATUTS_TRAIN } },
        include: { atelier: { select: { id: true, plateformeId: true } } },
      })
      if (ailleurs) assertPerimetreAtelier(identity, ailleurs.atelier)
      throw new NotFoundError(`Train ${id} introuvable`)
    }
  }
  return { trains, ateliers }
}

/** RG-COO-308 : la version envoyée doit être celle du train lu (sinon 409, rien n'est écrit). */
export function verifierVersions(
  trains: readonly TrainCalcule[],
  demandes: readonly TrainVersion[],
) {
  for (const d of demandes) {
    const t = trains.find((x) => x.trainId === d.trainId)
    if (t && t.version !== d.version)
      throw new ConflictError(
        `Le train ${d.trainId} a été modifié par un autre utilisateur : rechargez la page.`,
        { ...COO.version, regle: 'RG-COO-308', details: { trainId: d.trainId } },
      )
  }
}

export const enProduction = (t: TrainCalcule) => STATUTS_UNITE_EN_PRODUCTION.includes(t.statut)

/** Mise à jour d'une face sous verrou de version, avec historique si le statut change (RG-COO-307). */
export async function ecrireFace(
  tx: Tx,
  face: Pick<FaceTrain, 'id' | 'version' | 'statut'>,
  data: Record<string, unknown>,
  h: { vers?: StatutProduction; parId: number; regle: string; motif?: string },
) {
  if (h.vers && h.vers !== face.statut)
    assertTransition(TRANSITIONS_FACE, face.statut, h.vers, { regle: h.regle })
  await updateWithVersion({
    expectedVersion: face.version,
    update: (where) =>
      tx.faceTrain.updateMany({
        where: { id: face.id, ...where },
        data: {
          ...data,
          ...(h.vers ? { statut: h.vers } : {}),
          updatedById: h.parId,
          ...bumpVersion,
        },
      }),
    ...COO.version,
    regle: 'RG-COO-308',
  })
  if (h.vers && h.vers !== face.statut)
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'FACE_TRAIN',
      entiteId: face.id,
      ancien: face.statut,
      nouveau: h.vers,
      parId: h.parId,
      regle: h.regle,
      ...(h.motif ? { motif: h.motif } : {}),
    })
}

// ECR-COO-05a : fiche d'un train (positions avec reçu / attendu et emplacement, modifications tracées).
// RG-X-088 : l'emplacement (allée, rayon) saisi à la réception est lu à la fiche du train (aucune écriture).
export async function ficheTrain(db: Db, identity: Identity, trainId: string): Promise<FicheTrain> {
  assertDroitCoordination(identity, 'train.consulter')
  const { trains, ateliers } = await chargerTrains(db, identity, [trainId])
  const t = trains[0]
  if (!t) throw new NotFoundError(`Train ${trainId} introuvable`)
  const plateformeDe = new Map(ateliers.map((a) => [a.id, a.plateformeId]))
  const cov = await couverture(db, t.faces, plateformeDe)
  const [journal, historiques] = await Promise.all([
    db.journalAudit.findMany({
      where: { typeEntite: 'TRAIN', entiteId: trainId },
      include: { par: { select: { nom: true, identifiantExterne: true } } },
      orderBy: { id: 'asc' },
    }),
    db.statutHistorique.findMany({
      where: { typeEntite: 'FACE_TRAIN', entiteId: { in: t.faces.map((f) => String(f.id)) } },
      include: { par: { select: { nom: true, identifiantExterne: true } } },
      orderBy: { id: 'asc' },
    }),
  ])
  const nom = (p: { nom: string | null; identifiantExterne: string } | null) =>
    p ? (p.nom ?? p.identifiantExterne) : null
  const bague = await db.bague.findUnique({
    where: { trainId },
    include: { rouleur: { select: { nom: true } } },
  })
  return {
    trainId,
    version: t.version,
    origine: t.origine,
    statut: t.statut,
    fractionne: t.fractionne,
    atelier: t.atelier
      ? { id: t.atelier.id, libelle: t.atelier.libelle, plateforme: t.atelier.plateforme }
      : null,
    destinataire: t.destinataire,
    afficheur: t.afficheur,
    depart: t.depart.toISOString(),
    panneauxBc: panneaux(identity, t.faces),
    positions: t.positions.map(({ cle, ...p }) => ({
      ...p,
      recu: cov.recu.get(cle) ?? 0,
      attendu: cov.attendu.get(cle) ?? 0,
      emplacement: (cov.emplacements.get(cle) ?? []).join(', ') || null,
    })),
    modifications: [
      ...journal.map((j) => ({
        le: j.le.toISOString(),
        par: nom(j.par) ?? j.complement,
        action: j.action,
        detail: j.nouvelleValeur,
      })),
      ...historiques.map((h) => ({
        le: h.le.toISOString(),
        par: nom(h.par),
        action: `Face ${h.entiteId} : ${h.ancien ?? '—'} → ${h.nouveau}`,
        detail: h.motif ?? h.regle,
      })),
    ].sort((a, b) => a.le.localeCompare(b.le)),
    bague: bague
      ? {
          numero: bague.id,
          version: bague.version,
          imprimeeLe: bague.imprimeeLe.toISOString(),
          rouleur: bague.rouleur?.nom ?? null,
          reimpressions: bague.reimpressions,
          modifiee: bague.modifiee,
        }
      : null,
  }
}

// RG-COO-221 : « Fractionner » : un train EN_ATTENTE dont au moins un visuel est reçu passe PRÊT, ses positions
// manquantes sont marquées fractionnées (produites à part, RG-X-086) ; historique et journal. Les autres trains de
// la sélection sont écartés (en production : RG-COO-223 ; non fractionnables).
export async function fractionnerTrains(
  tx: Tx,
  identity: Identity,
  input: FractionnerTrains,
): Promise<ResultatActionTrains> {
  assertDroitCoordination(identity, 'train.fractionner')
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const res: ResultatActionTrains = { traites: [], ecartes: [], message: '' }
  for (const t of trains) {
    if (enProduction(t)) {
      res.ecartes.push({ trainId: t.trainId, raison: MESSAGE_NON_RETOUR })
      continue
    }
    if (t.statut !== 'EN_ATTENTE' || !t.positions.some((p) => p.etat === 'OK')) {
      res.ecartes.push({
        trainId: t.trainId,
        raison: 'Non fractionnable (il faut au moins un visuel reçu).',
      })
      continue
    }
    const manquantes = t.positions.filter((p) => p.etat === 'MANQUANT')
    for (const p of manquantes) {
      const face = t.faces.find((f) => f.id === p.faceId)
      if (face)
        await ecrireFace(
          tx,
          face,
          { fractionnee: true },
          { parId: identity.userId, regle: 'RG-COO-221' },
        )
    }
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: t.trainId,
      action: 'FRACTIONNEMENT_TRAIN',
      parId: identity.userId,
      ancienneValeur: 'EN_ATTENTE',
      nouvelleValeur: `Fractionné : ${manquantes.map((p) => `${p.lettre} ${p.theme ?? ''}`).join(', ')} produit(s) à part.`,
      complement: 'RG-COO-221',
    })
    res.traites.push(t.trainId)
  }
  if (res.traites.length === 0) {
    const tousEnProd = res.ecartes.every((e) => e.raison === MESSAGE_NON_RETOUR)
    throw new ConflictError(
      tousEnProd
        ? MESSAGE_NON_RETOUR
        : 'Aucun train fractionnable (il faut au moins un visuel reçu).',
      {
        code: 'TRANSITION_INTERDITE',
        regle: tousEnProd ? 'RG-COO-223' : 'RG-COO-221',
        details: { ecartes: res.ecartes },
      },
    )
  }
  res.message = `${String(res.traites.length)} train(s) fractionné(s) : ils passent « Prêt », les visuels manquants seront produits à part.`
  return res
}

/** Visuel d'instruction raccrochable / utilisable pour un train créé (RG-COO-222, 224). */
async function visuelDe(db: Client, visuelId: number) {
  const v = await db.instructionVisuel.findUnique({
    where: { id: visuelId },
    include: {
      instruction: {
        select: {
          code: true,
          atelierId: true,
          contNum: true,
          annonceur: true,
          contAnbas: true,
          contSembas: true,
          statut: true,
          dossier: { select: { statut: true } },
        },
      },
    },
  })
  if (!v) throw new NotFoundError('Visuel introuvable')
  return v
}

// RG-COO-222 : visuels proposés pour un train (même atelier donc même site, même semaine, instruction et dossier non
// annulés, thème renseigné, pas déjà dans le train).
export async function visuelsRaccrochables(db: Db, identity: Identity, trainId: string) {
  assertDroitCoordination(identity, 'train.consulter')
  const { trains } = await chargerTrains(db, identity, [trainId])
  const t = trains[0]
  const premiere = t?.faces[0]
  if (!t || !premiere) throw new NotFoundError(`Train ${trainId} introuvable`)
  const visuels = await db.instructionVisuel.findMany({
    where: {
      theme: { not: null },
      instruction: {
        atelierId: premiere.atelierId,
        contAnbas: premiere.contAnbas,
        contSembas: premiere.contSembas,
        NOT: { statut: 'ANNULE' },
        dossier: { NOT: { statut: 'ANNULE' } },
      },
    },
    include: { instruction: { select: { contNum: true, annonceur: true } } },
    orderBy: { id: 'asc' },
  })
  const deja = new Set(t.positions.map((p) => `${String(p.contNum)}|${cleTheme(p.theme)}`))
  return {
    visuels: visuels
      .filter((v) => !deja.has(`${String(v.instruction.contNum)}|${cleTheme(v.theme)}`))
      .map((v) => ({
        visuelId: v.id,
        contNum: v.instruction.contNum,
        annonceur: v.instruction.annonceur,
        theme: v.theme ?? '',
      })),
  }
}

// RG-COO-222 / RG-COO-209 : « Raccrocher un visuel » à un ou plusieurs trains : une position (face) est ajoutée à
// chaque train retenu ; sont écartés les trains en production (RG-COO-223), d'un autre atelier ou d'une autre
// semaine, complets (« Train complet », positions max en paramètre, Q-253) ou qui ont déjà le visuel. Le besoin
// du thème (lignes de préparation du Suivi par thème) se calcule à partir des faces : il augmente de lui-même.
export async function raccrocherVisuel(
  tx: Tx,
  identity: Identity,
  input: RaccrocherVisuel,
): Promise<ResultatActionTrains> {
  assertDroitCoordination(identity, 'train.fractionner')
  const v = await visuelDe(tx, input.visuelId)
  if (v.instruction.statut === 'ANNULE' || v.instruction.dossier?.statut === 'ANNULE' || !v.theme)
    throw new BusinessError(
      'Ce visuel ne peut pas être raccroché (instruction ou dossier annulé).',
      {
        code: 'COO_VISUEL_NON_RACCROCHABLE',
        regle: 'RG-COO-222',
      },
    )
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const max = await lireParametreNombre(tx, 'trains.positionsMax')
  const res: ResultatActionTrains = { traites: [], ecartes: [], message: '' }
  const cleV = `${String(v.instruction.contNum)}|${cleTheme(v.theme)}`
  for (const t of trains) {
    const ref = t.faces[0]
    if (!ref) continue
    const raison = enProduction(t)
      ? MESSAGE_NON_RETOUR
      : ref.atelierId !== v.instruction.atelierId
        ? 'Autre atelier.'
        : ref.contAnbas !== v.instruction.contAnbas || ref.contSembas !== v.instruction.contSembas
          ? 'Autre semaine.'
          : t.positions.length >= max
            ? 'Train complet'
            : t.positions.some((p) => `${String(p.contNum)}|${cleTheme(p.theme)}` === cleV)
              ? 'Le train a déjà ce visuel.'
              : null
    if (raison) {
      res.ecartes.push({ trainId: t.trainId, raison })
      continue
    }
    const ordre =
      Math.max(...t.faces.map((f) => ((f.ordreReel ?? 0) < 98 ? (f.ordreReel ?? 0) : 0))) + 1
    const face = await tx.faceTrain.create({
      data: {
        instructionCode: v.instruction.code,
        visuelId: v.id,
        destinataireId: ref.destinataireId,
        statut: ref.statut,
        atelierId: ref.atelierId,
        supportId: v.supportId ?? ref.supportId,
        // Cadre propre au visuel raccroché (pas de doublon de cadre, RG-COO-205).
        cadrIdent: -v.id,
        cadreLib: 'raccroche',
        dateDepart: ref.dateDepart,
        contNum: v.instruction.contNum,
        contAnnonc: v.instruction.annonceur,
        contSembas: v.instruction.contSembas,
        contAnbas: v.instruction.contAnbas,
        depSembas: ref.depSembas,
        depAnbas: ref.depAnbas,
        emplSectCode: ref.emplSectCode,
        emplDepaCode: ref.emplDepaCode,
        commNumord: ref.commNumord,
        emplNumord: ref.emplNumord,
        emplAdresse1: ref.emplAdresse1,
        train: ref.train,
        trainId: t.trainId,
        versionTrain: ref.versionTrain,
        theme: nettoyerTheme(v.theme),
        themeId: v.afchIdent,
        ftType: 'raccroche',
        ordrePropose: ordre,
        ordreReel: ordre,
        refPanel: ref.refPanel,
        afficheurId: ref.afficheurId,
        afficheurNom: ref.afficheurNom,
        origineTrain: ref.origineTrain,
        createdById: identity.userId,
      },
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'FACE_TRAIN',
      entiteId: face.id,
      ancien: null,
      nouveau: face.statut,
      parId: identity.userId,
      regle: 'RG-COO-222',
    })
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: t.trainId,
      action: 'RACCROCHAGE_VISUEL',
      parId: identity.userId,
      nouvelleValeur: `Visuel raccroché : ${String(v.instruction.contNum)} « ${v.theme} ».`,
      complement: 'RG-COO-222',
    })
    res.traites.push(t.trainId)
  }
  if (res.traites.length === 0) {
    const une = res.ecartes.length === 1 ? res.ecartes[0] : undefined
    throw new ConflictError(une ? une.raison : 'Aucun train ne peut recevoir ce visuel.', {
      code: 'TRANSITION_INTERDITE',
      regle:
        une?.raison === MESSAGE_NON_RETOUR
          ? 'RG-COO-223'
          : une?.raison === 'Train complet'
            ? 'RG-COO-209'
            : 'RG-COO-222',
      details: { ecartes: res.ecartes },
    })
  }
  res.message = `${String(res.traites.length)} train(s) ont reçu le visuel « ${v.theme} ».`
  return res
}

// RG-COO-224 : options de la modale « Créer un train de pré-test ou d'entretien » (ateliers déroulants du site,
// visuels de l'atelier à partir de la semaine en production, destinataires du site).
export async function optionsCreationTrain(
  db: Db,
  identity: Identity,
  atelierId: number | undefined,
  maintenant = new Date(),
) {
  assertDroitCoordination(identity, 'train.creer_supprimer')
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter((a) => a.type === 'SCROLL')
  const atelier = ateliers.find((a) => a.id === atelierId) ?? ateliers[0]
  const semaineMin = semaineIsoDe(maintenant)
  const visuels = atelier
    ? await db.instructionVisuel.findMany({
        where: {
          theme: { not: null },
          instruction: {
            atelierId: atelier.id,
            NOT: { statut: 'ANNULE' },
            dossier: { NOT: { statut: 'ANNULE' } },
            OR: [
              { contAnbas: { gt: semaineMin.annee } },
              { contAnbas: semaineMin.annee, contSembas: { gte: semaineMin.semaine } },
            ],
          },
        },
        include: {
          instruction: {
            select: { contNum: true, annonceur: true, contAnbas: true, contSembas: true },
          },
        },
        orderBy: { id: 'asc' },
      })
    : []
  const destinataires = atelier
    ? await db.destinataire.findMany({
        where: {
          actif: true,
          OR: [
            { faces: { some: { atelier: { plateformeId: atelier.plateformeId } } } },
            { repartitions: { some: { atelier: { plateformeId: atelier.plateformeId } } } },
          ],
        },
        orderBy: { id: 'asc' },
      })
    : []
  return {
    ateliers: ateliers.map((a) => ({ id: a.id, libelle: a.libelle, plateforme: a.plateforme })),
    visuels: visuels.map((v) => ({
      visuelId: v.id,
      contNum: v.instruction.contNum,
      annonceur: v.instruction.annonceur,
      theme: v.theme ?? '',
      semaine: { annee: v.instruction.contAnbas ?? 0, semaine: v.instruction.contSembas ?? 0 },
    })),
    destinataires: destinataires.map((d) => ({ id: d.id, nom: d.nom ?? d.nomOrigine })),
    semaineMin,
  }
}

// RG-COO-224 : « Créer un train de pré-test ou d'entretien » (1 à 9 trains d'une position) : atelier déroulant du
// périmètre, départ ≥ semaine en production, visuel de l'atelier (semaine ≥ départ) et destinataire obligatoires.
// HYPOTHÈSE Q-192 (5) : n° « TR-Pnnnn » séquentiel ; face « A imprimer » (pas d'export pour un train créé par la
// Coordination) ; afficheur = premier afficheur connu du destinataire ; départ = départ connu du destinataire
// cette semaine, sinon le lundi.
export async function creerTrain(
  tx: Tx,
  identity: Identity,
  input: CreerTrain,
  maintenant = new Date(),
) {
  assertDroitCoordination(identity, 'train.creer_supprimer')
  if (input.visuelId === null || input.destinataireId === null)
    throw new BusinessError('Choisissez un visuel et un destinataire.', {
      code: 'COO_TRAIN_INCOMPLET',
      regle: 'RG-COO-224',
    })
  const atelier = (await ateliersDuPerimetre(tx, identity)).find((a) => a.id === input.atelierId)
  if (!atelier) {
    const existe = await tx.atelier.findUnique({ where: { id: input.atelierId } })
    if (!existe) throw new NotFoundError('Atelier introuvable')
    assertPerimetreAtelier(identity, existe)
    throw new NotFoundError('Atelier introuvable')
  }
  if (atelier.type !== 'SCROLL')
    throw new BusinessError('Un train se crée sur un atelier déroulant.', {
      code: 'COO_ATELIER_NON_DEROULANT',
      regle: 'RG-COO-224',
    })
  const depart = lireSemaineIso(input.depart)
  const enProd = semaineIsoDe(maintenant)
  if (depart.annee * 100 + depart.semaine < enProd.annee * 100 + enProd.semaine)
    throw new BusinessError(`Le départ doit être au plus tôt ${formatSemaineIso(enProd)}.`, {
      code: 'COO_DEPART_PASSE',
      regle: 'RG-COO-224',
    })
  const v = await visuelDe(tx, input.visuelId)
  const semV = (v.instruction.contAnbas ?? 0) * 100 + (v.instruction.contSembas ?? 0)
  if (
    v.instruction.atelierId !== atelier.id ||
    v.instruction.statut === 'ANNULE' ||
    v.instruction.dossier?.statut === 'ANNULE' ||
    !v.theme ||
    semV < depart.annee * 100 + depart.semaine
  )
    throw new BusinessError(
      'Ce visuel ne fait pas partie des thèmes de l’atelier à partir de ce départ.',
      {
        code: 'COO_VISUEL_INVALIDE',
        regle: 'RG-COO-224',
      },
    )
  const destinataire = await tx.destinataire.findUnique({ where: { id: input.destinataireId } })
  if (!destinataire) throw new NotFoundError('Destinataire introuvable')
  // RG-COO-224 (ANO-041, HYPOTHÈSE Q-192 (16)) : destinataire du site, même critère que les options de la modale.
  const duSite = await tx.destinataire.count({
    where: {
      id: destinataire.id,
      actif: true,
      OR: [
        { faces: { some: { atelier: { plateformeId: atelier.plateformeId } } } },
        { repartitions: { some: { atelier: { plateformeId: atelier.plateformeId } } } },
      ],
    },
  })
  if (duSite === 0)
    throw new BusinessError('Ce destinataire ne fait pas partie des destinataires du site.', {
      code: 'COO_DESTINATAIRE_HORS_SITE',
      regle: 'RG-COO-224',
    })
  const connue = await tx.faceTrain.findFirst({
    where: {
      destinataireId: destinataire.id,
      afficheurNom: { not: null },
      NOT: { afficheurNom: 'ENTRETIEN' },
    },
    orderBy: { id: 'asc' },
  })
  const departConnu = await tx.faceTrain.findFirst({
    where: { destinataireId: destinataire.id, depAnbas: depart.annee, depSembas: depart.semaine },
    orderBy: { dateDepart: 'asc' },
  })
  const existants = await tx.faceTrain.findMany({
    where: { trainId: { startsWith: 'TR-P' } },
    select: { trainId: true },
  })
  let numero = existants.reduce((m, f) => Math.max(m, Number((f.trainId ?? '').slice(4)) || 0), 0)
  const crees: string[] = []
  for (let i = 0; i < input.nombre; i++) {
    numero++
    const trainId = `TR-P${String(numero).padStart(4, '0')}`
    const face = await tx.faceTrain.create({
      data: {
        instructionCode: v.instruction.code,
        visuelId: v.id,
        destinataireId: destinataire.id,
        statut: 'A_IMPRIMER',
        atelierId: atelier.id,
        supportId: v.supportId,
        cadrIdent: 0,
        cadreLib: input.type === 'PRE_TEST' ? 'pré-test' : 'entretien',
        dateDepart: departConnu?.dateDepart ?? lundiSemaineIso(depart),
        contNum: v.instruction.contNum,
        contAnnonc: v.instruction.annonceur,
        contSembas: v.instruction.contSembas,
        contAnbas: v.instruction.contAnbas,
        depSembas: depart.semaine,
        depAnbas: depart.annee,
        trainId,
        versionTrain: 0,
        theme: nettoyerTheme(v.theme),
        themeId: v.afchIdent,
        ftType: input.type === 'PRE_TEST' ? 'pre-test' : 'entretien',
        ordrePropose: 1,
        ordreReel: 1,
        afficheurId: connue?.afficheurId ?? null,
        afficheurNom: connue?.afficheurNom ?? null,
        origineTrain: input.type,
        createdById: identity.userId,
      },
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'FACE_TRAIN',
      entiteId: face.id,
      ancien: null,
      nouveau: 'A_IMPRIMER',
      parId: identity.userId,
      regle: 'RG-COO-224',
    })
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: trainId,
      action: 'CREATION_TRAIN',
      parId: identity.userId,
      nouvelleValeur: `Train ${input.type === 'PRE_TEST' ? 'de pré-test' : 'd’entretien'} créé : ${String(v.instruction.contNum)} « ${v.theme} ».`,
      complement: 'RG-COO-224',
    })
    crees.push(trainId)
  }
  return {
    trains: crees,
    message: `${String(crees.length)} train(s) ${input.type === 'PRE_TEST' ? 'de pré-test' : 'd’entretien'} créé(s) : ${crees.join(', ')}.`,
  }
}

// RG-COO-225 : « Supprimer le train » avec motif : suppression logique (faces ANNULÉES, motif et historique),
// refusée en production (RG-COO-223) ; la couverture se recalcule à la lecture (Q-259).
export async function supprimerTrain(
  tx: Tx,
  identity: Identity,
  trainId: string,
  input: SupprimerTrain,
) {
  assertDroitCoordination(identity, 'train.creer_supprimer')
  const { trains } = await chargerTrains(tx, identity, [trainId])
  verifierVersions(trains, [{ trainId, version: input.version }])
  const t = trains[0]
  if (!t) throw new NotFoundError(`Train ${trainId} introuvable`)
  if (enProduction(t))
    throw new ConflictError(MESSAGE_NON_RETOUR, {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-223',
    })
  const motif = input.precision ? `${input.motif} : ${input.precision}` : input.motif
  for (const f of t.faces)
    await ecrireFace(
      tx,
      f,
      { motifSuppression: motif },
      { vers: 'ANNULE', parId: identity.userId, regle: 'RG-COO-225', motif },
    )
  await ecrireJournal(tx, {
    typeEntite: 'TRAIN',
    entiteId: trainId,
    action: 'SUPPRESSION_TRAIN',
    parId: identity.userId,
    ancienneValeur: t.statut,
    nouvelleValeur: motif,
    complement: 'RG-COO-225',
  })
  return { message: `Train ${trainId} supprimé (${motif}).`, nombre: t.faces.length }
}

// RG-COO-218 : « Changer statut » des faces des trains choisis, contrôlé côté serveur. Liste des trains : 2 → 5,
// 5 → 10 ; Préparation : 10 / 5 / 9 → 5 si TOUTES les faces sont en 10, 5 ou 9. RG-COO-217 : rouleur
// obligatoire pour « Au roulage ».
export async function changerStatutFaces(tx: Tx, identity: Identity, input: ChangerStatutFaces) {
  assertDroitCoordination(identity, 'train.changer_statut')
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const faces = trains.flatMap((t) => t.faces)
  if (input.ecran === 'PREPARATION') {
    if (faces.some((f) => !CHANGER_STATUT_PREPARATION[f.statut].includes(input.vers)))
      throw new ConflictError(
        "Toutes les faces des trains ne sont pas dans le statut 'Au roulage' ou 'Export prépa' !",
        { code: 'TRANSITION_INTERDITE', regle: 'RG-COO-218' },
      )
  } else {
    for (const f of faces)
      assertTransition(CHANGER_STATUT_LISTE, f.statut, input.vers, { regle: 'RG-COO-218' })
  }
  let rouleurId: number | null = null
  if (input.vers === 'AU_ROULAGE') {
    if (input.rouleurId === undefined)
      throw new BusinessError('Choisissez un rouleur.', {
        code: 'COO_ROULEUR_OBLIGATOIRE',
        regle: 'RG-COO-217',
      })
    const rouleur = await tx.rouleur.findUnique({ where: { id: input.rouleurId } })
    if (!rouleur || (rouleur.dateFin !== null && rouleur.dateFin < new Date()))
      throw new NotFoundError('Rouleur introuvable ou inactif')
    rouleurId = rouleur.id
  }
  let n = 0
  for (const t of trains) {
    for (const f of t.faces) {
      if (f.statut === input.vers) continue
      await ecrireFace(tx, f, rouleurId !== null ? { rouleurId } : {}, {
        vers: input.vers,
        parId: identity.userId,
        regle: 'RG-COO-218',
      })
      n++
    }
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: t.trainId,
      action: 'CHANGEMENT_STATUT_FACE',
      parId: identity.userId,
      ancienneValeur: t.statut,
      nouvelleValeur: input.vers,
      complement: 'RG-COO-218',
    })
  }
  return {
    message: `${String(n)} face(s) passée(s) au statut ${input.vers === 'A_IMPRIMER' ? '« A imprimer »' : '« Au roulage »'}.`,
    nombre: n,
  }
}

/** Faces d'un atelier du périmètre pour une semaine de départ (RG-COO-219, 220). */
async function facesAtelierSemaine(tx: Tx, identity: Identity, atelierId: number, depart: string) {
  const atelier = await tx.atelier.findUnique({ where: { id: atelierId } })
  if (!atelier) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, atelier)
  const s = lireSemaineIso(depart)
  return tx.faceTrain.findMany({
    where: {
      atelierId,
      depAnbas: s.annee,
      depSembas: s.semaine,
      trainId: { not: null },
      NOT: { statut: 'ANNULE' },
    },
  })
}

// RG-COO-219 : « Annuler thème » : toutes les faces du thème (atelier, départ, dossier, thème) doivent être
// « A imprimer » ; elles passent ANNULÉES, train vidé, avec auteur, date et historique.
export async function annulerThemeTrain(tx: Tx, identity: Identity, input: AnnulerThemeTrain) {
  assertDroitCoordination(identity, 'train.changer_statut', 'RG-COO-219')
  const faces = (await facesAtelierSemaine(tx, identity, input.atelierId, input.depart)).filter(
    (f) => f.contNum === input.contNum && cleTheme(f.theme) === cleTheme(input.theme),
  )
  if (faces.length === 0)
    throw new ConflictError('Pas de données à traiter !', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-219',
    })
  // RG-COO-219 : « le statut de la ligne et de toutes les faces du thème doit être 5 ». La « ligne » legacy est la
  // répartition du thème (`tf_repart_calcul`) : HYPOTHÈSE Q-192 (19). Sans répartition (cas du déroulant en V2),
  // seule la condition sur les faces s'applique.
  const s = lireSemaineIso(input.depart)
  const lignes = (
    await tx.repartition.findMany({
      where: {
        atelierId: input.atelierId,
        contNum: input.contNum,
        semAnnee: s.annee,
        semNum: s.semaine,
      },
    })
  ).filter((r) => cleTheme(r.theme) === cleTheme(input.theme))
  if (lignes.some((r) => r.statut !== 'A_IMPRIMER'))
    throw new ConflictError("Le statut du thème ne permet pas l'annulation !", {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-219',
    })
  if (faces.some((f) => f.statut !== 'A_IMPRIMER'))
    throw new ConflictError("Toutes les faces du theme ne sont pas dans le statut 'A Imprimer'", {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-219',
    })
  for (const f of faces)
    await ecrireFace(
      tx,
      f,
      { trainId: null },
      { vers: 'ANNULE', parId: identity.userId, regle: 'RG-COO-219' },
    )
  for (const trainId of new Set(faces.map((f) => f.trainId ?? '')))
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: trainId,
      action: 'ANNULATION_THEME_TRAIN',
      parId: identity.userId,
      nouvelleValeur: `Thème annulé : ${String(input.contNum)} « ${input.theme} ».`,
      complement: 'RG-COO-219',
    })
  return {
    message: `Thème « ${input.theme} » annulé (${String(faces.length)} face(s)).`,
    nombre: faces.length,
  }
}

// RG-COO-220 : « Débloquer semaine » (atelier × départ) : faces et instructions « A imprimer » repassent
// « Instruction ok » ; refus s'il n'y a rien à traiter ou si une face n'est pas « A imprimer » (dont les trains en
// production, RG-COO-223).
export async function debloquerSemaineTrains(
  tx: Tx,
  identity: Identity,
  input: DebloquerSemaineTrains,
) {
  assertDroitCoordination(identity, 'train.changer_statut', 'RG-COO-220')
  const faces = await facesAtelierSemaine(tx, identity, input.atelierId, input.depart)
  const codes = [...new Set(faces.map((f) => f.instructionCode))]
  const instructions = await tx.instruction.findMany({
    where: { code: { in: codes }, statut: 'PRET_A_PRODUIRE' },
  })
  if (faces.length === 0 && instructions.length === 0)
    throw new ConflictError("Il n'y a pas de données à traiter !", {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-220',
    })
  if (faces.some((f) => f.statut !== 'A_IMPRIMER'))
    throw new ConflictError("Toutes les données ne sont pas au statut 'A imprimer' !", {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-220',
    })
  for (const f of faces)
    await ecrireFace(
      tx,
      f,
      {},
      { vers: 'INSTRUCTION_OK', parId: identity.userId, regle: 'RG-COO-220' },
    )
  for (const i of instructions) {
    assertTransition(TRANSITIONS_INSTRUCTION_TRAINS, i.statut, 'INSTRUCTION_OK', {
      regle: 'RG-COO-220',
    })
    await updateWithVersion({
      expectedVersion: i.version,
      update: (where) =>
        tx.instruction.updateMany({
          where: { code: i.code, ...where },
          data: { statut: 'INSTRUCTION_OK', updatedById: identity.userId, ...bumpVersion },
        }),
      ...COO.version,
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'INSTRUCTION',
      entiteId: i.code,
      ancien: i.statut,
      nouveau: 'INSTRUCTION_OK',
      parId: identity.userId,
      regle: 'RG-COO-220',
    })
  }
  await ecrireJournal(tx, {
    typeEntite: 'TRAIN',
    entiteId: `${String(input.atelierId)}:${input.depart}`,
    action: 'DEBLOCAGE_SEMAINE_TRAINS',
    parId: identity.userId,
    nouvelleValeur: `${String(faces.length)} face(s) et ${String(instructions.length)} instruction(s) repassées « Instruction ok ».`,
    complement: 'RG-COO-220',
  })
  return {
    message: `Semaine ${input.depart} débloquée : ${String(faces.length)} face(s) et ${String(instructions.length)} instruction(s) repassent « Instruction ok ».`,
    nombre: faces.length,
  }
}

// RG-COO-226 (CONSERVÉE, Q-260) : « Dupliquer train » : copie N fois les faces du train source vers des trains
// cibles dont l'identifiant augmente de 190 à chaque exemplaire ; copies « A imprimer » ; afficheur saisi stocké
// dans le nom d'afficheur (legacy `pers_nom`). V2 : train source existant, N ≥ 1, cibles libres (409 sinon).
export async function dupliquerTrain(tx: Tx, identity: Identity, input: DupliquerTrain) {
  assertDroitCoordination(identity, 'train.dupliquer')
  const source = await tx.faceTrain.findMany({
    where: { trainId: input.trainSource, NOT: { statut: 'ANNULE' } },
    orderBy: { id: 'asc' },
  })
  if (source.length === 0) throw new NotFoundError(`Train source ${input.trainSource} introuvable`)
  const cibles = Array.from({ length: input.nombre }, (_, k) =>
    String(BigInt(input.trainCible) + 190n * BigInt(k + 1)),
  )
  const prises = await tx.faceTrain.count({ where: { trainId: { in: cibles } } })
  if (prises > 0)
    throw new ConflictError('Un identifiant de train cible est déjà utilisé.', {
      code: 'COO_TRAIN_CIBLE_EXISTANT',
      regle: 'RG-COO-226',
      details: { cibles },
    })
  for (const trainId of cibles) {
    for (const f of source) {
      const copie = await tx.faceTrain.create({
        data: {
          instructionCode: f.instructionCode,
          visuelId: f.visuelId,
          destinataireId: f.destinataireId,
          atelierId: f.atelierId,
          supportId: f.supportId,
          rouleurId: f.rouleurId,
          jourDepartId: f.jourDepartId,
          cadrIdent: f.cadrIdent,
          cadreLib: f.cadreLib,
          dateDepart: f.dateDepart,
          contNum: f.contNum,
          contAnnonc: f.contAnnonc,
          contSembas: f.contSembas,
          contAnbas: f.contAnbas,
          depSembas: f.depSembas,
          depAnbas: f.depAnbas,
          train: f.train,
          rang: f.rang,
          ordrePropose: f.ordrePropose,
          ordreReel: f.ordreReel,
          ordreCalcule: f.ordreCalcule,
          ordreReelInitial: f.ordreReelInitial,
          theme: f.theme,
          themeId: f.themeId,
          repiquage: f.repiquage,
          repiquageId: f.repiquageId,
          ftType: f.ftType,
          versionTrain: f.versionTrain,
          preAssemblage: f.preAssemblage,
          conservation: f.conservation,
          coteCote: f.coteCote,
          refPanel: f.refPanel,
          afficheurId: f.afficheurId,
          emplSectCode: f.emplSectCode,
          emplDepaCode: f.emplDepaCode,
          commNumord: f.commNumord,
          emplNumord: f.emplNumord,
          emplAdresse1: f.emplAdresse1,
          origineTrain: f.origineTrain,
          trainId,
          statut: 'A_IMPRIMER',
          // Legacy : l'« afficheur » saisi est stocké dans pers_nom.
          afficheurNom: input.afficheur,
          createdById: identity.userId,
          updatedById: identity.userId,
        },
      })
      await ecrireHistoriqueStatut(tx, {
        typeEntite: 'FACE_TRAIN',
        entiteId: copie.id,
        ancien: null,
        nouveau: 'A_IMPRIMER',
        parId: identity.userId,
        regle: 'RG-COO-226',
      })
    }
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: trainId,
      action: 'DUPLICATION_TRAIN',
      parId: identity.userId,
      ancienneValeur: input.trainSource,
      nouvelleValeur: `${input.trainSource}|${input.trainCible}|${input.afficheur}|${String(input.nombre)}`,
      complement: 'RG-COO-226',
    })
  }
  return {
    message: `${String(cibles.length)} copie(s) du train ${input.trainSource} : ${cibles.join(', ')}.`,
    nombre: cibles.length,
  }
}
