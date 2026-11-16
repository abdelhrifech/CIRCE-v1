// COO-P13 — Colis, expédition et fin de journée (ECR-EXP-01 « Scan et colisage », ECR-EXP-02 « Colis ») :
// poids (RG-COO-263), fractionnement d'une UM sur plusieurs colis (RG-COO-264), rattachement d'une UM (RG-COO-265),
// création / suppression d'un colis et refus de la réouverture (RG-COO-266), retrait (RG-COO-267), expédition
// (RG-COO-268), fin de journée (RG-COO-269) avec sorties de stock (RG-X-087), train ajouté à un colis (RG-COO-270),
// mail « colis expédié » tracé sans envoi (RG-COO-271, Q-375, Q-285), statut effectif de l'UM (RG-COO-280).
// Hypothèses : Q-197 (cette session), Q-272, Q-273, Q-284. Création des UM (RG-COO-260 à 262) : BLOQUÉE (Q-265) ;
// intégration AMT (RG-COO-272 à 276) : non reprise (Q-274). Toutes les écritures d'une opération sont dans la
// transaction de l'appelant (CLAUDE.md §6).
import {
  formatSemaineIso,
  semaineIsoDe,
  type AColiser,
  type AjouterTrain,
  type AjouterUnite,
  type ColisLigne,
  type ColisQuery,
  type CreerColis,
  type ExpedierColis,
  type FicheColis,
  type ListeColis,
  type ResultatColis,
  type ResultatFinDeJournee,
  type RetirerColis,
  type StatutColis,
  type VersionColis,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { parPaquets } from '../../core/paquets.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { Prisma, StatutProduction } from '../../generated/prisma/client.ts'
import { mettreEnFileMail } from '../mails/file.ts'
import { lireTypes, typeDe } from './unitaire.ts'
import { lireParametreTexte } from '../reception/parametres.ts'
import { enregistrerMouvementAutomatique, stockAffiche } from '../reception/stock.ts'
import { assertDroitCoordination, assertPerimetreAtelier, COO } from './permissions.ts'
import {
  STATUTS_FACE_COLISABLES,
  STATUTS_UM_COLISABLES,
  TRANSITIONS_COLIS,
  TRANSITIONS_FACE_RETRAIT_COLIS,
  TRANSITIONS_UM_COLISAGE,
} from './statuts-colis.ts'
import { TRANSITIONS_FACE } from './statuts-trains.ts'
import { ateliersDuPerimetre, cleTheme } from './trains.ts'

type Client = Db | Tx

const DROIT = 'colis.gerer'
/** RG-COO-263 : poids minimum d'un colis (1 kg, « pour Calberson » : conservé tant que le transporteur n'est pas tranché, Q-271). */
const POIDS_MINIMUM = 1
/** RG-COO-263 : majoration des ateliers 8 m² (+3 kg), ateliers lus du paramètre `colis.ateliersMajoration` (Q-319). */
const POIDS_MAJORATION = 3
const MESSAGE_VIDE = 'Aucun colis clos à expédier dans ce périmètre.'

const STATUT_AFFICHE: Record<StatutProduction, StatutColis | null> = {
  A_TRAITER: null,
  EN_COURS: 'EN_COURS',
  INSTRUCTION_OK: null,
  ERREUR: null,
  ANNULE: null,
  A_IMPRIMER: null,
  PREPARE: null,
  A_EXPEDIER: 'A_EXPEDIER',
  TERMINE: 'TERMINE',
  EXPORT_PREPA: null,
  AU_ROULAGE: null,
}
const STATUTS_COLIS_DB: readonly StatutProduction[] = ['EN_COURS', 'A_EXPEDIER', 'TERMINE']

const codeColis = (id: number) => `C-${String(id).padStart(18, '0')}`
const codeUnite = (um: { id: number; codeBarre: string | null }) =>
  um.codeBarre ?? `UM-${String(um.id)}`

// RG-COO-249 : la garde « UM dans un colis » (retrait, rendre la main) est dans unitaire.ts:umDansColis (appel direct).

// ───────────────────────────── Lecture ─────────────────────────────

const INCLUDE_COLIS = {
  atelier: { include: { plateforme: { select: { nom: true } } } },
  destinataire: true,
  unites: { include: { unite: true } },
} as const
type ColisLu = Prisma.ColisGetPayload<{ include: typeof INCLUDE_COLIS }>

interface FaceColis {
  id: number
  version: number
  colisId: number | null
  trainId: string | null
  statut: StatutProduction
  theme: string | null
  contNum: number | null
  dateDepart: Date
}

async function facesDesColis(client: Client, colisIds: readonly number[]): Promise<FaceColis[]> {
  return parPaquets(colisIds, (paquet) =>
    client.faceTrain.findMany({
      where: { colisId: { in: paquet }, statut: { not: 'ANNULE' } },
      select: {
        id: true,
        version: true,
        colisId: true,
        trainId: true,
        statut: true,
        theme: true,
        contNum: true,
        dateDepart: true,
      },
      orderBy: { id: 'asc' },
    }),
  )
}

async function lireColis(client: Client, id: number): Promise<ColisLu> {
  const colis = await client.colis.findUnique({ where: { id }, include: INCLUDE_COLIS })
  if (!colis) throw new NotFoundError('Colis introuvable')
  return colis
}

/** RG-COO-167 : le colis doit être d'un atelier du périmètre (site choisi compris) ; 403 sinon. */
function assertPerimetreColis(identity: Identity, colis: ColisLu): void {
  assertPerimetreAtelier(identity, { id: colis.atelierId, plateformeId: colis.plateformeId })
}

function departDe(colis: ColisLu, faces: readonly FaceColis[]): string | null {
  const semaines: string[] = []
  for (const l of colis.unites) {
    const { semAnnee, semNum } = l.unite
    if (semAnnee !== null && semNum !== null)
      semaines.push(formatSemaineIso({ annee: semAnnee, semaine: semNum }))
  }
  for (const f of faces) semaines.push(formatSemaineIso(semaineIsoDe(f.dateDepart)))
  return semaines.sort()[0] ?? null
}

function ligneColis(
  colis: ColisLu,
  faces: readonly FaceColis[],
  expedieLe: string | null,
): ColisLigne {
  const statut = STATUT_AFFICHE[colis.statut]
  if (!statut) throw new Error(`Statut de colis inattendu : ${colis.statut}`)
  const trains = new Set(faces.map((f) => f.trainId ?? `face-${String(f.id)}`))
  return {
    id: colis.id,
    code: colis.codeColis ?? codeColis(colis.id),
    statut,
    destinataire: {
      id: colis.destinataireId,
      nom: colis.destinataire.nom ?? colis.destinataire.nomOrigine,
    },
    atelier: {
      id: colis.atelierId,
      libelle: colis.atelier.libelle,
      plateforme: colis.atelier.plateforme.nom,
    },
    nbUnites: colis.unites.length,
    nbTrains: trains.size,
    quantite: colis.unites.reduce((somme, l) => somme + l.quantite, 0) + faces.length,
    poids: colis.poids === null ? null : Number(colis.poids),
    depart: departDe(colis, faces),
    dateExpedition: colis.dateExpedition?.toISOString() ?? null,
    // ECR-EXP-02 colonne masquée « Expédié le » : date de la fin de journée (transition 7 → 8 de l'historique).
    expedieLe,
    codeExterne: colis.codeExterne,
    transporteur: colis.transporteur,
    tarif: colis.tarif,
    version: colis.version,
  }
}

async function ficheColis(client: Client, id: number): Promise<FicheColis> {
  const colis = await lireColis(client, id)
  const faces = await facesDesColis(client, [id])
  const historique = await client.statutHistorique.findMany({
    where: { typeEntite: 'COLIS', entiteId: String(id) },
    orderBy: { id: 'asc' },
  })
  const auteurs = await client.utilisateur.findMany({
    where: {
      id: {
        in: [...new Set(historique.map((h) => h.parId).filter((p): p is number => p !== null))],
      },
    },
    select: { id: true, nom: true, identifiantExterne: true },
  })
  const nom = new Map(auteurs.map((a) => [a.id, a.nom ?? a.identifiantExterne]))
  const parTrain = new Map<string, FaceColis[]>()
  for (const f of faces) {
    const cle = f.trainId ?? `face-${String(f.id)}`
    parTrain.set(cle, [...(parTrain.get(cle) ?? []), f])
  }
  return {
    ...ligneColis(
      colis,
      faces,
      historique
        .filter((h) => h.nouveau === 'TERMINE')
        .at(-1)
        ?.le.toISOString() ?? null,
    ),
    commentaire: colis.commentaire,
    formatCode: colis.formatCode,
    unites: colis.unites.map((l) => ({
      uniteId: l.uniteId,
      code: codeUnite(l.unite),
      dossier: l.unite.contNum,
      theme: l.unite.theme,
      annonceur: l.unite.annonceur,
      quantite: l.quantite,
      quantiteTotale: l.unite.qte,
      statutUnite: l.unite.statut,
    })),
    trains: [...parTrain.entries()].map(([trainId, fs]) => ({
      trainId,
      dossier: fs[0]?.contNum ?? null,
      theme: fs[0]?.theme ?? null,
      faces: fs.length,
      statut: fs[0]?.statut ?? 'A_EXPEDIER',
    })),
    historique: historique.map((h) => ({
      de: h.ancien,
      vers: h.nouveau,
      le: h.le.toISOString(),
      par: h.parId === null ? null : (nom.get(h.parId) ?? null),
      motif: h.motif,
    })),
  }
}

/** ECR-EXP-02 « Expédié le » : date de la dernière transition vers « Terminé » (fin de journée) de chaque colis. */
async function datesFinDeJournee(
  client: Client,
  colisIds: readonly number[],
): Promise<Map<number, string>> {
  const lignes = await parPaquets(colisIds.map(String), (paquet) =>
    client.statutHistorique.findMany({
      where: { typeEntite: 'COLIS', entiteId: { in: paquet }, nouveau: 'TERMINE' },
      select: { entiteId: true, le: true, id: true },
      orderBy: { id: 'asc' },
    }),
  )
  return new Map(lignes.map((h) => [Number(h.entiteId), h.le.toISOString()]))
}

/** Colis des ateliers du périmètre (RG-COO-167), tous statuts de colis, avec leurs faces. */
async function colisDuPerimetre(client: Client, identity: Identity, q: ColisQuery) {
  const ateliers = (await ateliersDuPerimetre(client, identity)).filter(
    (a) => q.atelier === undefined || a.id === q.atelier,
  )
  const statuts: StatutProduction[] = q.statut ? [q.statut] : [...STATUTS_COLIS_DB]
  const colis = await parPaquets(
    ateliers.map((a) => a.id),
    (paquet) =>
      client.colis.findMany({
        where: { atelierId: { in: paquet }, statut: { in: statuts } },
        include: INCLUDE_COLIS,
        orderBy: { id: 'desc' },
      }),
  )
  const faces = await facesDesColis(
    client,
    colis.map((c) => c.id),
  )
  const parColis = new Map<number, FaceColis[]>()
  for (const f of faces)
    if (f.colisId !== null) parColis.set(f.colisId, [...(parColis.get(f.colisId) ?? []), f])
  const typesUnitaire = q.type ? await lireTypes(client) : null
  const filtre = q.destinataire?.toLowerCase()
  const expedies = await datesFinDeJournee(
    client,
    colis.filter((c) => c.statut === 'TERMINE').map((c) => c.id),
  )
  return colis
    .map((c) => ({
      colis: c,
      faces: parColis.get(c.id) ?? [],
      expedieLe: expedies.get(c.id) ?? null,
    }))
    .filter(({ colis: c, faces: fs }) => {
      if (
        q.type &&
        typesUnitaire &&
        !c.unites.some((l) => typeDe(l.unite, typesUnitaire) === q.type)
      )
        return false
      if (filtre) {
        const nomDest = `${c.destinataire.nom ?? ''} ${c.destinataire.nomOrigine}`.toLowerCase()
        if (!nomDest.includes(filtre)) return false
      }
      if (q.dossier !== undefined) {
        const parUm = c.unites.some((l) => l.unite.contNum === q.dossier)
        if (!parUm && !fs.some((f) => f.contNum === q.dossier)) return false
      }
      if (q.depart !== undefined && departDe(c, fs) !== q.depart) return false
      return true
    })
}

// ECR-EXP-02 : liste des colis (Code colis, Départ, Destinataire, Statut…), indicateurs.
export async function listerColis(db: Db, identity: Identity, q: ColisQuery): Promise<ListeColis> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-265')
  // ECR-EXP-02 : tri par statut croissant (ouvert, clos, expédié), puis du plus récent au plus ancien.
  const rang: Record<StatutColis, number> = { EN_COURS: 0, A_EXPEDIER: 1, TERMINE: 2 }
  const lignes = (await colisDuPerimetre(db, identity, q))
    .map(({ colis, faces, expedieLe }) => ligneColis(colis, faces, expedieLe))
    .sort((a, b) => rang[a.statut] - rang[b.statut] || b.id - a.id)
  return {
    colis: lignes,
    indicateurs: {
      clos: lignes.filter((l) => l.statut === 'A_EXPEDIER').length,
      expedies: lignes.filter((l) => l.statut === 'TERMINE').length,
      livres: null,
    },
    total: lignes.length,
  }
}

export async function lireFicheColis(db: Db, identity: Identity, id: number): Promise<FicheColis> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-265')
  assertPerimetreColis(identity, await lireColis(db, id))
  return ficheColis(db, id)
}

// ECR-EXP-01 : unités produites à coliser (UM « En cours » ou « Préparé » avec reste à placer ; trains aux faces
// 5 / 9 / 10 sans colis), par destinataire, et colis ouverts.
export async function lireAColiser(db: Db, identity: Identity, q: ColisQuery): Promise<AColiser> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-265')
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter(
    (a) => q.atelier === undefined || a.id === q.atelier,
  )
  const atelierPar = new Map(ateliers.map((a) => [a.id, a]))
  const fixes = ateliers.filter((a) => a.type === 'FIXE').map((a) => a.id)
  const scrolls = ateliers.filter((a) => a.type !== 'FIXE').map((a) => a.id)
  const filtre = q.destinataire?.toLowerCase()
  const groupes = new Map<string, AColiser['groupes'][number]>()
  const groupe = (
    destinataire: { id: number; nom: string },
    atelierId: number,
    depart: string | null,
  ) => {
    const cle = `${String(destinataire.id)}|${String(atelierId)}`
    const existant = groupes.get(cle)
    if (existant) {
      if (depart && (!existant.depart || depart < existant.depart)) existant.depart = depart
      return existant
    }
    const atelier = atelierPar.get(atelierId)
    const nouveau = {
      destinataire,
      atelier: {
        id: atelierId,
        libelle: atelier?.libelle ?? '',
        plateforme: atelier?.plateforme ?? '',
      },
      depart,
      unites: [],
    }
    groupes.set(cle, nouveau)
    return nouveau
  }
  const nomDest = (d: { nom: string | null; nomOrigine: string } | null) =>
    d ? (d.nom ?? d.nomOrigine) : '—'

  const ums = await parPaquets(fixes, (paquet) =>
    db.uniteManutention.findMany({
      where: {
        atelierId: { in: paquet },
        statut: { in: [...STATUTS_UM_COLISABLES] },
        destinataireId: { not: null },
        ...(q.dossier !== undefined ? { contNum: q.dossier } : {}),
      },
      include: { destinataire: true, colis: true },
      orderBy: { id: 'asc' },
    }),
  )
  let aColiser = 0
  for (const um of ums) {
    const place = um.colis.reduce((somme, l) => somme + l.quantite, 0)
    const reste = (um.qte ?? 0) - place
    if (reste <= 0 || um.destinataireId === null || um.atelierId === null) continue
    const depart =
      um.semAnnee !== null && um.semNum !== null
        ? formatSemaineIso({ annee: um.semAnnee, semaine: um.semNum })
        : null
    if (q.depart !== undefined && depart !== q.depart) continue
    if (filtre && !nomDest(um.destinataire).toLowerCase().includes(filtre)) continue
    groupe(
      { id: um.destinataireId, nom: nomDest(um.destinataire) },
      um.atelierId,
      depart,
    ).unites.push({
      type: 'UM',
      uniteId: um.id,
      code: codeUnite(um),
      dossier: um.contNum,
      theme: um.theme,
      afficheur: nomDest(um.destinataire),
      quantite: reste,
      statut: um.statut,
    })
    aColiser += 1
  }

  const faces = await parPaquets(scrolls, (paquet) =>
    db.faceTrain.findMany({
      where: {
        atelierId: { in: paquet },
        statut: { in: [...STATUTS_FACE_COLISABLES] },
        colisId: null,
        destinataireId: { not: null },
        trainId: { not: null },
        ...(q.dossier !== undefined ? { contNum: q.dossier } : {}),
      },
      include: { destinataire: true },
      orderBy: { id: 'asc' },
    }),
  )
  const trains = new Map<string, (typeof faces)[number][]>()
  for (const f of faces) {
    if (f.trainId === null) continue
    const cle = `${f.trainId}|${String(f.atelierId)}`
    trains.set(cle, [...(trains.get(cle) ?? []), f])
  }
  for (const fs of trains.values()) {
    const premiere = fs[0]
    if (!premiere || premiere.destinataireId === null || premiere.atelierId === null) continue
    const depart = formatSemaineIso(semaineIsoDe(premiere.dateDepart))
    if (q.depart !== undefined && depart !== q.depart) continue
    if (filtre && !nomDest(premiere.destinataire).toLowerCase().includes(filtre)) continue
    groupe(
      { id: premiere.destinataireId, nom: nomDest(premiere.destinataire) },
      premiere.atelierId,
      depart,
    ).unites.push({
      type: 'TRAIN',
      trainId: premiere.trainId ?? '',
      dossier: premiere.contNum,
      theme: premiere.theme,
      afficheur: nomDest(premiere.destinataire),
      faces: fs.length,
      statut: premiere.statut,
    })
    aColiser += 1
  }

  const tous = await colisDuPerimetre(db, identity, q)
  const lignes = tous.map(({ colis, faces: fs, expedieLe }) => ligneColis(colis, fs, expedieLe))
  return {
    groupes: [...groupes.values()].sort(
      (a, b) =>
        (a.depart ?? '').localeCompare(b.depart ?? '') ||
        a.destinataire.nom.localeCompare(b.destinataire.nom),
    ),
    colisOuverts: lignes.filter((l) => l.statut === 'EN_COURS'),
    indicateurs: {
      aColiser,
      clos: lignes.filter((l) => l.statut === 'A_EXPEDIER').length,
      expedies: lignes.filter((l) => l.statut === 'TERMINE').length,
      livres: null,
    },
  }
}

// ───────────────────────────── Écritures : helpers ─────────────────────────────

const listeIds = (texte: string): number[] =>
  texte
    .split(';')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isInteger(x) && x > 0)

// RG-COO-263 : poids du colis = Σ (uc_qte × poids du support) des UM ; sans UM, Σ (faces × poids du support) ;
// minimum 1 kg ; +3 kg pour les ateliers 8 m² (paramètre). Recalculé depuis zéro (pas de cumul du +3 kg).
async function recalculerPoids(tx: Tx, colisId: number, atelierId: number): Promise<number> {
  const unites = await tx.uniteColis.findMany({
    where: { colisId },
    include: { unite: { include: { support: { select: { poids: true } } } } },
  })
  let poids = 0
  if (unites.length > 0) {
    for (const l of unites) poids += l.quantite * Number(l.unite.support?.poids ?? 0)
  } else {
    const faces = await tx.faceTrain.findMany({
      where: { colisId, statut: { not: 'ANNULE' } },
      include: { support: { select: { poids: true } } },
    })
    for (const f of faces) poids += Number(f.support?.poids ?? 0)
  }
  poids = Math.max(poids, POIDS_MINIMUM)
  if (listeIds(await lireParametreTexte(tx, 'colis.ateliersMajoration')).includes(atelierId))
    poids += POIDS_MAJORATION
  return Math.round(poids * 1000) / 1000
}

async function ecrireColis(
  tx: Tx,
  identity: Identity,
  colis: { id: number; atelierId: number },
  expectedVersion: number,
  data: Prisma.ColisUncheckedUpdateManyInput,
) {
  const poids = await recalculerPoids(tx, colis.id, colis.atelierId)
  await updateWithVersion({
    expectedVersion,
    update: (where) =>
      tx.colis.updateMany({
        where: { id: colis.id, ...where },
        data: { poids, ...data, updatedById: identity.userId, ...bumpVersion },
      }),
    exists: async () => (await tx.colis.count({ where: { id: colis.id } })) > 0,
    ...COO.version,
  })
}

async function changerStatutUnite(
  tx: Tx,
  identity: Identity,
  um: { id: number; statut: StatutProduction; version: number },
  vers: StatutProduction,
  regle: string,
  motif?: string,
) {
  assertTransition(TRANSITIONS_UM_COLISAGE, um.statut, vers, { regle })
  await updateWithVersion({
    expectedVersion: um.version,
    update: (where) =>
      tx.uniteManutention.updateMany({
        where: { id: um.id, ...where },
        data: { statut: vers, updatedById: identity.userId, ...bumpVersion },
      }),
    ...COO.version,
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'UNITE_MANUTENTION',
    entiteId: um.id,
    ancien: um.statut,
    nouveau: vers,
    parId: identity.userId,
    regle,
    ...(motif ? { motif } : {}),
  })
}

async function changerStatutFace(
  tx: Tx,
  identity: Identity,
  face: { id: number; statut: StatutProduction; version: number },
  vers: StatutProduction,
  regle: string,
  colisId: number | null,
  table = TRANSITIONS_FACE,
) {
  assertTransition(table, face.statut, vers, { regle })
  await updateWithVersion({
    expectedVersion: face.version,
    update: (where) =>
      tx.faceTrain.updateMany({
        where: { id: face.id, ...where },
        data: { statut: vers, colisId, updatedById: identity.userId, ...bumpVersion },
      }),
    ...COO.version,
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'FACE_TRAIN',
    entiteId: face.id,
    ancien: face.statut,
    nouveau: vers,
    parId: identity.userId,
    regle,
  })
}

/** Un colis n'accepte plus de changement dès qu'il est clos (RG-COO-266, RG-COO-267 : colis non expédié). */
function assertColisOuvert(colis: { statut: StatutProduction }, regle: string): void {
  if (colis.statut !== 'EN_COURS')
    throw new ConflictError('Ce colis est clos : il ne peut plus être modifié.', {
      code: 'COO_COLIS_CLOS',
      regle,
      details: { statut: colis.statut },
    })
}

function resultat(fiche: FicheColis | null, message: string): ResultatColis {
  return { colis: fiche, supprime: fiche === null, message }
}

// ───────────────────────────── RG-COO-266 : création, ouverture, suppression ─────────────────────────────

// RG-COO-266 : colis « En cours », format « À définir » (5), code `C-` + n° sur 18 chiffres, poids minimum ;
// en cible (ECR-EXP-01) le premier scan ouvre le colis (« Aucun colis ouvert. Le premier scan d'unité ouvre un colis »).
export async function creerColis(
  tx: Tx,
  identity: Identity,
  input: CreerColis,
): Promise<ResultatColis> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-266')
  const atelier = await tx.atelier.findUnique({ where: { id: input.atelierId } })
  if (!atelier) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, atelier)
  const destinataire = await tx.destinataire.findUnique({ where: { id: input.destinataireId } })
  if (!destinataire) throw new NotFoundError('Destinataire introuvable')
  if (!destinataire.actif)
    throw new BusinessError('Ce destinataire n’est plus actif.', {
      code: 'COO_DESTINATAIRE_INACTIF',
      regle: 'RG-COO-266',
    })
  const cree = await tx.colis.create({
    data: {
      plateformeId: atelier.plateformeId,
      atelierId: atelier.id,
      destinataireId: destinataire.id,
      statut: 'EN_COURS',
      poids: await recalculerPoids(tx, 0, atelier.id),
      createdById: identity.userId,
    },
  })
  await tx.colis.update({ where: { id: cree.id }, data: { codeColis: codeColis(cree.id) } })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'COLIS',
    entiteId: cree.id,
    ancien: null,
    nouveau: 'EN_COURS',
    parId: identity.userId,
    regle: 'RG-COO-266',
  })
  await ecrireJournal(tx, {
    typeEntite: 'COLIS',
    entiteId: cree.id,
    action: 'CREATION_COLIS',
    parId: identity.userId,
    nouvelleValeur: codeColis(cree.id),
    donnees: { atelierId: atelier.id, destinataireId: destinataire.id },
  })
  return resultat(await ficheColis(tx, cree.id), `Colis ${codeColis(cree.id)} ouvert.`)
}

// RG-COO-266 : un colis ne se supprime que s'il ne contient plus d'UM (ni de train).
export async function supprimerColis(
  tx: Tx,
  identity: Identity,
  id: number,
  input: VersionColis,
): Promise<ResultatColis> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-266')
  const colis = await lireColis(tx, id)
  assertPerimetreColis(identity, colis)
  assertColisOuvert(colis, 'RG-COO-266')
  const faces = await facesDesColis(tx, [id])
  if (colis.unites.length > 0 || faces.length > 0)
    throw new ConflictError(
      'Ce colis contient encore des unités : retirez-les avant de le supprimer.',
      {
        code: 'COO_COLIS_NON_VIDE',
        regle: 'RG-COO-266',
        details: { unites: colis.unites.length, faces: faces.length },
      },
    )
  await supprimerLigneColis(tx, identity, colis, input.version)
  return resultat(null, `Colis ${colis.codeColis ?? codeColis(id)} supprimé.`)
}

async function supprimerLigneColis(tx: Tx, identity: Identity, colis: ColisLu, version: number) {
  const { count } = await tx.colis.deleteMany({ where: { id: colis.id, version } })
  if (count === 0)
    throw new ConflictError(
      'Cet élément a été modifié par un autre utilisateur : rechargez la page.',
      { ...COO.version, details: { versionAttendue: version } },
    )
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'COLIS',
    entiteId: colis.id,
    ancien: colis.statut,
    nouveau: 'SUPPRIME',
    parId: identity.userId,
    regle: 'RG-COO-266',
  })
  await ecrireJournal(tx, {
    typeEntite: 'COLIS',
    entiteId: colis.id,
    action: 'SUPPRESSION_COLIS',
    parId: identity.userId,
    ancienneValeur: colis.codeColis,
  })
}

// RG-COO-266 / Q-272 : « Ouvrir » un colis clos n'existe plus en cible (décision du 16/10) : 409 ; un colis déjà
// ouvert n'a pas de transition « ouvrir » non plus (le premier scan d'unité ouvre un colis : `creerColis`).
export async function ouvrirColis(
  tx: Tx,
  identity: Identity,
  id: number,
  input: VersionColis,
): Promise<ResultatColis> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-266')
  const colis = await lireColis(tx, id)
  assertPerimetreColis(identity, colis)
  if (colis.version !== input.version)
    throw new ConflictError(
      'Cet élément a été modifié par un autre utilisateur : rechargez la page.',
      { ...COO.version, details: { versionAttendue: input.version } },
    )
  throw new ConflictError(
    colis.statut === 'EN_COURS'
      ? 'Ce colis est déjà ouvert.'
      : 'Un colis clos ne se rouvre pas (décision du 16/10).',
    {
      code: colis.statut === 'EN_COURS' ? 'TRANSITION_INTERDITE' : 'COO_COLIS_NON_ROUVRABLE',
      regle: 'RG-COO-266',
      details: { de: colis.statut, vers: 'EN_COURS' },
    },
  )
}

// ───────────────────────────── RG-COO-265 / 264 : ajout d'une UM ─────────────────────────────

const CODE_UM = /^UM-?(\d+)$/i

// RG-COO-265 : UM aux statuts 1 ou 6, même destinataire (et même atelier) que le colis, pas déjà dans le colis ;
// RG-COO-264 : uc_qte = quantité placée dans CE colis (reste à placer par défaut, Σ uc_qte ≤ UM_qte : HYPOTHÈSE
// Q-197 (6)) ; UM 1 → 6 ; RG-COO-263 : poids recalculé.
export async function ajouterUnite(
  tx: Tx,
  identity: Identity,
  id: number,
  input: AjouterUnite,
): Promise<ResultatColis> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-265')
  const colis = await lireColis(tx, id)
  assertPerimetreColis(identity, colis)
  assertColisOuvert(colis, 'RG-COO-265')
  const parId = CODE_UM.exec(input.code)?.[1]
  const um = await tx.uniteManutention.findFirst({
    where: parId
      ? { OR: [{ codeBarre: input.code }, { id: Number(parId) }] }
      : { codeBarre: input.code },
    include: { colis: true },
  })
  const refus = (message: string, code: string) =>
    new BusinessError(message, { code, regle: 'RG-COO-265' })
  if (!um || !STATUTS_UM_COLISABLES.includes(um.statut))
    throw refus("L'UM n'existe pas ou n'est pas en cours ou préparée", 'COO_UM_NON_COLISABLE')
  if (um.destinataireId !== colis.destinataireId || um.atelierId !== colis.atelierId)
    throw refus('Le destinataire de l’UM ne correspond pas à celle du colis', 'COO_UM_DESTINATAIRE')
  if (um.colis.some((l) => l.colisId === colis.id))
    throw refus("L'UM à ajouter existe déjà dans le colis", 'COO_UM_DEJA_DANS_COLIS')
  const place = um.colis.reduce((somme, l) => somme + l.quantite, 0)
  const reste = (um.qte ?? 0) - place
  const quantite = input.quantite ?? reste
  if (quantite <= 0 || quantite > reste)
    throw new BusinessError(
      `La quantité à placer (${String(quantite)}) dépasse le reste de l'UM (${String(Math.max(reste, 0))}).`,
      {
        code: 'COO_UM_QUANTITE_DEPASSEE',
        regle: 'RG-COO-264',
        details: { reste, quantite, total: um.qte },
      },
    )
  await tx.uniteColis.create({
    data: { uniteId: um.id, colisId: colis.id, quantite, createdById: identity.userId },
  })
  if (um.statut === 'EN_COURS')
    await changerStatutUnite(tx, identity, um, 'PREPARE', 'RG-COO-265', 'Ajout au colis')
  await ecrireColis(tx, identity, colis, input.version, {})
  await ecrireJournal(tx, {
    typeEntite: 'COLIS',
    entiteId: colis.id,
    action: 'AJOUT_UM_COLIS',
    parId: identity.userId,
    nouvelleValeur: codeUnite(um),
    donnees: { uniteId: um.id, quantite },
  })
  return resultat(
    await ficheColis(tx, colis.id),
    `${codeUnite(um)} ajouté au colis ${colis.codeColis ?? codeColis(colis.id)} (${String(quantite)} affiche(s)).`,
  )
}

// ───────────────────────────── RG-COO-270 : ajout d'un train ─────────────────────────────

// RG-COO-270 : atelier déroulant ; destinataire et atelier identiques à ceux du colis ; un train déjà rattaché à un
// colis est refusé ; faces 5 / 9 / 10 → 7 immédiatement (409 pour tout autre statut, table de transitions).
export async function ajouterTrain(
  tx: Tx,
  identity: Identity,
  id: number,
  input: AjouterTrain,
): Promise<ResultatColis> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-270')
  const colis = await lireColis(tx, id)
  assertPerimetreColis(identity, colis)
  assertColisOuvert(colis, 'RG-COO-270')
  if (colis.atelier.type === 'FIXE')
    throw new BusinessError('Un train ne se place que dans un colis d’un atelier déroulant.', {
      code: 'COO_COLIS_ATELIER_FIXE',
      regle: 'RG-COO-270',
    })
  const faces = await tx.faceTrain.findMany({
    where: { trainId: input.trainId, atelierId: colis.atelierId, statut: { not: 'ANNULE' } },
    orderBy: { id: 'asc' },
  })
  if (faces.length === 0) throw new NotFoundError('Train introuvable')
  if (faces.some((f) => f.colisId !== null))
    throw new BusinessError('Il existe déjà un train dans ce colis', {
      code: 'COO_TRAIN_DEJA_DANS_UN_COLIS',
      regle: 'RG-COO-270',
    })
  if (faces.some((f) => f.destinataireId !== colis.destinataireId))
    throw new BusinessError('Le destinataire du train ne correspond pas à celui du colis', {
      code: 'COO_TRAIN_DESTINATAIRE',
      regle: 'RG-COO-270',
    })
  for (const f of faces)
    await changerStatutFace(tx, identity, f, 'A_EXPEDIER', 'RG-COO-270', colis.id)
  await ecrireColis(tx, identity, colis, input.version, {})
  await ecrireJournal(tx, {
    typeEntite: 'COLIS',
    entiteId: colis.id,
    action: 'AJOUT_TRAIN_COLIS',
    parId: identity.userId,
    nouvelleValeur: input.trainId,
    donnees: { faces: faces.length },
  })
  return resultat(
    await ficheColis(tx, colis.id),
    `${input.trainId} ajouté au colis ${colis.codeColis ?? codeColis(colis.id)} (${String(faces.length)} face(s)).`,
  )
}

// ───────────────────────────── RG-COO-267 : retrait ─────────────────────────────

// RG-COO-267 : le retrait supprime la ligne UM ↔ colis ; l'UM repasse à 1 (En cours) si elle n'est plus dans aucun
// colis (HYPOTHÈSE Q-197 (5) : « A expédier » si tous ses colis restants sont déjà expédiés) ; une face retirée
// retrouve son statut d'avant (HYPOTHÈSE Q-197 (4)) ; poids recalculé ; colis vidé : supprimé (ECR-EXP-01).
export async function retirerDuColis(
  tx: Tx,
  identity: Identity,
  id: number,
  input: RetirerColis,
): Promise<ResultatColis> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-267')
  const colis = await lireColis(tx, id)
  assertPerimetreColis(identity, colis)
  assertColisOuvert(colis, 'RG-COO-267')
  const faces = await facesDesColis(tx, [id])
  const umIds = input.tout ? colis.unites.map((l) => l.uniteId) : input.unites
  const trains = input.tout
    ? [...new Set(faces.map((f) => f.trainId).filter((t): t is string => t !== null))]
    : input.trains
  for (const umId of umIds)
    if (!colis.unites.some((l) => l.uniteId === umId))
      throw new NotFoundError(`L'unité ${String(umId)} n'est pas dans ce colis`)
  for (const t of trains)
    if (!faces.some((f) => f.trainId === t))
      throw new NotFoundError(`Le train ${t} n'est pas dans ce colis`)

  for (const umId of umIds) {
    await tx.uniteColis.deleteMany({ where: { colisId: colis.id, uniteId: umId } })
    const um = await tx.uniteManutention.findUnique({ where: { id: umId } })
    if (!um) continue
    const restants = await tx.uniteColis.findMany({
      where: { uniteId: umId },
      include: { colis: { select: { statut: true } } },
    })
    if (restants.length === 0) {
      if (um.statut === 'PREPARE')
        await changerStatutUnite(tx, identity, um, 'EN_COURS', 'RG-COO-267')
    } else if (
      restants.every((r) => r.colis.statut !== 'EN_COURS') &&
      STATUTS_UM_COLISABLES.includes(um.statut)
    )
      await changerStatutUnite(tx, identity, um, 'A_EXPEDIER', 'RG-COO-267')
  }
  for (const f of faces.filter((x) => x.trainId !== null && trains.includes(x.trainId))) {
    const precedent = await tx.statutHistorique.findFirst({
      where: { typeEntite: 'FACE_TRAIN', entiteId: String(f.id), nouveau: 'A_EXPEDIER' },
      orderBy: { id: 'desc' },
    })
    const reel = await tx.faceTrain.findUniqueOrThrow({ where: { id: f.id } })
    const ancien = precedent?.ancien as StatutProduction | null | undefined
    const vers: StatutProduction =
      ancien && STATUTS_FACE_COLISABLES.includes(ancien)
        ? ancien
        : reel.rouleurId !== null
          ? 'AU_ROULAGE'
          : 'A_IMPRIMER'
    await changerStatutFace(
      tx,
      identity,
      reel,
      vers,
      'RG-COO-267',
      null,
      TRANSITIONS_FACE_RETRAIT_COLIS,
    )
  }

  const reste = await tx.uniteColis.count({ where: { colisId: colis.id } })
  const facesRestantes = await tx.faceTrain.count({
    where: { colisId: colis.id, statut: { not: 'ANNULE' } },
  })
  await ecrireJournal(tx, {
    typeEntite: 'COLIS',
    entiteId: colis.id,
    action: 'RETRAIT_COLIS',
    parId: identity.userId,
    donnees: { unites: umIds, trains },
  })
  if (reste === 0 && facesRestantes === 0) {
    await supprimerLigneColis(tx, identity, colis, input.version)
    return resultat(null, `Colis ${colis.codeColis ?? codeColis(colis.id)} vidé et supprimé.`)
  }
  await ecrireColis(tx, identity, colis, input.version, {})
  return resultat(
    await ficheColis(tx, colis.id),
    `${String(umIds.length + trains.length)} élément(s) retiré(s) du colis.`,
  )
}

// ───────────────────────────── RG-COO-268 : expédition ─────────────────────────────

// RG-COO-268 : « Expédier » enregistre transporteur / tarif (défaut du couple destinataire × atelier), code externe
// (« ETIQUETTES » remis à vide), commentaire, poids, format, date ; colis 1 → 7 ; atelier fixe : les UM dont tous les
// colis sont clos passent à 7 (HYPOTHÈSE Q-272) ; atelier déroulant : les faces sont déjà à 7 (RG-COO-270).
export async function expedierColis(
  tx: Tx,
  identity: Identity,
  id: number,
  input: ExpedierColis,
  maintenant = new Date(),
): Promise<ResultatColis> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-268')
  const colis = await lireColis(tx, id)
  assertPerimetreColis(identity, colis)
  assertTransition(TRANSITIONS_COLIS, colis.statut, 'A_EXPEDIER', { regle: 'RG-COO-268' })
  const faces = await facesDesColis(tx, [id])
  if (colis.unites.length === 0 && faces.length === 0)
    throw new BusinessError('Problème lors de l’expédition : le colis est vide.', {
      code: 'COO_COLIS_VIDE',
      regle: 'RG-COO-268',
    })
  const transport = await tx.transportDestinataire.findUnique({
    where: {
      destinataireId_atelierId: {
        destinataireId: colis.destinataireId,
        atelierId: colis.atelierId,
      },
    },
  })
  const codeExterne = input.codeExterne === 'ETIQUETTES' ? null : (input.codeExterne ?? null)
  await ecrireColis(tx, identity, colis, input.version, {
    statut: 'A_EXPEDIER',
    dateExpedition: maintenant,
    transporteur: transport?.transporteur ?? null,
    tarif: transport?.tarif ?? null,
    codeExterne,
    commentaire: input.commentaire ?? null,
    ...(input.formatCode !== undefined ? { formatCode: input.formatCode } : {}),
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'COLIS',
    entiteId: colis.id,
    ancien: colis.statut,
    nouveau: 'A_EXPEDIER',
    parId: identity.userId,
    regle: 'RG-COO-268',
  })
  let unites = 0
  for (const l of colis.unites) {
    const um = await tx.uniteManutention.findUniqueOrThrow({ where: { id: l.uniteId } })
    const ouverts = await tx.uniteColis.count({
      where: { uniteId: um.id, colis: { statut: 'EN_COURS' } },
    })
    if (ouverts === 0 && STATUTS_UM_COLISABLES.includes(um.statut)) {
      await changerStatutUnite(tx, identity, um, 'A_EXPEDIER', 'RG-COO-268')
      unites += 1
    }
  }
  await ecrireJournal(tx, {
    typeEntite: 'COLIS',
    entiteId: colis.id,
    action: 'EXPEDITION_COLIS',
    parId: identity.userId,
    nouvelleValeur: colis.codeColis,
    donnees: { unites, faces: faces.length, transporteur: transport?.transporteur ?? null },
  })
  return resultat(
    await ficheColis(tx, colis.id),
    `Colis ${colis.codeColis ?? codeColis(colis.id)} expédié (à expédier).`,
  )
}

// ───────────────────────────── RG-COO-269 / RG-X-087 : fin de journée ─────────────────────────────

// RG-X-087 : une sortie de stock « Expédition C-… » par UM expédiée (quantité uc_qte du colis), prélevée FIFO sur les
// affiches reçues du dossier, de la plateforme et du thème de l'UM, dans la transaction du passage à « Expédié ».
// HYPOTHÈSE Q-197 (9) : jamais de stock négatif (sortie limitée au stock disponible, reste tracé « manquant ») ; ateliers
// déroulants : aucune sortie automatique (quantité d'affiches par face non sourcée).
async function sortiesStock(
  tx: Tx,
  identity: Identity,
  colis: ColisLu,
  maintenant: Date,
): Promise<{ sorties: number; manquants: ResultatFinDeJournee['manquants'] }> {
  const manquants: ResultatFinDeJournee['manquants'] = []
  let sorties = 0
  if (colis.atelier.type !== 'FIXE') return { sorties, manquants }
  for (const l of colis.unites) {
    const um = l.unite
    // ANO-054 / RG-X-087 : une sortie par UM expédiée ; une UM « Annulé » restée dans le colis (RG-COO-278) n'est pas expédiée.
    if (um.statut === 'ANNULE') continue
    let reste = l.quantite
    const affiches =
      um.contNum === null
        ? []
        : (
            await tx.affiche.findMany({
              where: { plateformeId: colis.plateformeId, contNum: um.contNum, rebus: false },
              orderBy: [{ dateEntree: 'asc' }, { id: 'asc' }],
            })
          ).filter((a) => cleTheme(a.theme) === cleTheme(um.theme))
    for (const a of affiches) {
      if (reste <= 0) break
      const stock = await stockAffiche(tx, a.id)
      if (stock <= 0) continue
      const prise = Math.min(stock, reste)
      try {
        await enregistrerMouvementAutomatique(tx, identity, {
          afficheId: a.id,
          type: 'EXPEDITION',
          quantite: -prise,
          motif: `Expédition ${colis.codeColis ?? codeColis(colis.id)}`,
          date: maintenant,
        })
      } catch (e) {
        if (e instanceof ConflictError) continue // affiche fusionnée (RG-REC-169) : lecture seule
        throw e
      }
      reste -= prise
      sorties += 1
    }
    if (reste > 0)
      manquants.push({
        colis: colis.id,
        uniteId: um.id,
        manquant: reste,
        raison: affiches.length > 0 ? 'STOCK_INSUFFISANT' : 'AUCUNE_AFFICHE',
      })
  }
  return { sorties, manquants }
}

// RG-COO-269 : colis « A expédier » → « Terminé » (« Expédié »), ses UM (7 → 8 quand tous leurs colis le sont) et ses
// faces 7 → 8, sorties de stock (RG-X-087), mail non envoyé tracé (RG-COO-271). Une transaction unique (cible) ;
// exécution manuelle : la planification du batch est hors dépôt (Q-005, BLOQUÉE). Idempotent : un 2e passage ne
// trouve plus de colis « A expédier ».
export async function finDeJournee(
  tx: Tx,
  identity: Identity,
  maintenant = new Date(),
): Promise<ResultatFinDeJournee> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-269')
  const ateliers = await ateliersDuPerimetre(tx, identity)
  const colisListe = await parPaquets(
    ateliers.map((a) => a.id),
    (paquet) =>
      tx.colis.findMany({
        where: { atelierId: { in: paquet }, statut: 'A_EXPEDIER' },
        include: INCLUDE_COLIS,
        orderBy: { id: 'asc' },
      }),
  )
  const res: ResultatFinDeJournee = {
    colis: [],
    unites: 0,
    faces: 0,
    sortiesStock: 0,
    manquants: [],
    message: MESSAGE_VIDE,
  }
  for (const colis of colisListe) {
    assertTransition(TRANSITIONS_COLIS, colis.statut, 'TERMINE', { regle: 'RG-COO-269' })
    await updateWithVersion({
      expectedVersion: colis.version,
      update: (where) =>
        tx.colis.updateMany({
          where: { id: colis.id, ...where },
          data: { statut: 'TERMINE', updatedById: identity.userId, ...bumpVersion },
        }),
      ...COO.version,
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'COLIS',
      entiteId: colis.id,
      ancien: 'A_EXPEDIER',
      nouveau: 'TERMINE',
      parId: identity.userId,
      regle: 'RG-COO-269',
    })
    for (const l of colis.unites) {
      const um = await tx.uniteManutention.findUniqueOrThrow({ where: { id: l.uniteId } })
      const nonTermines = await tx.uniteColis.count({
        where: { uniteId: um.id, colis: { statut: { not: 'TERMINE' } } },
      })
      if (nonTermines === 0 && um.statut === 'A_EXPEDIER') {
        await changerStatutUnite(tx, identity, um, 'TERMINE', 'RG-COO-269')
        res.unites += 1
      }
    }
    for (const f of await tx.faceTrain.findMany({
      where: { colisId: colis.id, statut: 'A_EXPEDIER' },
    })) {
      await changerStatutFace(tx, identity, f, 'TERMINE', 'RG-COO-269', colis.id)
      res.faces += 1
    }
    const stock = await sortiesStock(tx, identity, colis, maintenant)
    res.sortiesStock += stock.sorties
    res.manquants.push(...stock.manquants)
    await ecrireJournal(tx, {
      typeEntite: 'COLIS',
      entiteId: colis.id,
      action: 'FIN_JOURNEE_COLIS',
      parId: identity.userId,
      nouvelleValeur: colis.codeColis,
      donnees: { sorties: stock.sorties, manquants: stock.manquants },
    })
    // RG-COO-271 (D-19, HYPOTHÈSE Q-409 / Q-285 « conserver à l'identique ») : le mail « colis expédié » est mis en
    // file dans CETTE transaction (jamais envoyé ici) ; `mailEnvoye` ne passe à vrai que si l'envoi réussit.
    const code = colis.codeColis ?? codeColis(colis.id)
    const miseEnFile = await mettreEnFileMail(tx, {
      type: 'COLIS_EXPEDIE',
      cle: `COLIS:${String(colis.id)}`,
      source: { type: 'COLIS', id: colis.id },
      destinataires: [colis.destinataire.mail],
      sujet: `Colis expédié ${code}`,
      corps: [
        `Le colis ${code} a été expédié le ${maintenant.toISOString().slice(0, 10)}.`,
        `Destinataire : ${colis.destinataire.nom ?? colis.destinataire.nomOrigine}`,
        `Atelier : ${colis.atelier.libelle} (${colis.atelier.plateforme.nom})`,
        `Unités de manutention : ${String(colis.unites.length)}`,
      ].join('\n'),
      parId: identity.userId,
    })
    await ecrireJournal(tx, {
      typeEntite: 'COLIS',
      entiteId: colis.id,
      action: 'MAIL_COLIS',
      parId: identity.userId,
      complement: miseEnFile
        ? 'Mail « colis expédié » mis en file d’envoi (Q-375, Q-285, Q-409)'
        : 'Mail « colis expédié » non mis en file : aucune adresse valide pour le destinataire (Q-375, Q-285)',
      donnees: {
        destinataire: colis.destinataire.mail ?? null,
        mailFileId: miseEnFile?.id ?? null,
      },
    })
    res.colis.push(colis.id)
  }
  res.message =
    res.colis.length === 0
      ? MESSAGE_VIDE
      : `Fin de journée : ${String(res.colis.length)} colis expédié(s), sorties de stock automatiques.`
  return res
}
