// COO-P12 — Préparation 2 m² fixe / pliage / bus (écran « unitaire », ECR-COO-09) : liste des unités avec entretien à
// l'afficheur (RG-COO-238, 245, 248, 290), quantité à produire (RG-COO-239), rendre la main (RG-COO-243), corriger
// l'intitulé (RG-COO-244), fiche de synthèse (RG-COO-246), pliage (RG-COO-247), retirer / préparer (RG-COO-249, 250),
// quantités à encoller du Bus (RG-COO-304, 305). Hypothèses : Q-196. Libération de la semaine et création des UM
// (RG-COO-240 à 242, 260 à 262) : `unitaire-creation.ts` (Q-265, option (c) retenue par défaut) ; les repères
// « à libérer » et « arrivé après libération » sont dérivés ici à la lecture.
import { randomUUID } from 'node:crypto'
import {
  formatSemaineIso,
  lireSemaineIso,
  semaineIsoDe,
  type ComptagePliage,
  type CorrigerIntitule,
  type Encoller,
  type EncollerQuery,
  type EnregistrerEncoller,
  type LigneUnitaire,
  type LignesSelection,
  type ModifierQuantite,
  type RefRepartition,
  type RendreLaMain,
  type ResultatUnitaire,
  type Synthese,
  type TypeUnitaire,
  type Unitaire,
  type UnitaireQuery,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { parPaquets } from '../../core/paquets.ts'
import { assertPlateforme } from '../../core/permissions/permissions.ts'
import { assertTransition, type Transitions } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { Prisma, StatutProduction } from '../../generated/prisma/client.ts'
import { lireParametreNombre, lireParametreTexte } from '../reception/parametres.ts'
import { assertDroitCoordination, assertPerimetreAtelier, COO } from './permissions.ts'
import { mettreEnFileMail } from '../mails/file.ts'
import { ateliersDuPerimetre, cleTheme, cleVisuel, contient } from './trains.ts'
import { nombreEntretien } from './trains-calcul.ts'
import { affichesIndicatives } from './unitaire-affiches.ts'

type Client = Db | Tx

// ───────────────────────────── Machine d'états (répartition / UM) ─────────────────────────────

/** COORDINATION_REGLES_METIER.md §3.2 « Ligne de répartition » : 0 → 1 (créer UM, Q-265 : non exposé), 1 → 0
 * (Retirer, RG-COO-249 ; Rendre la main, RG-COO-243), 1 → 6 (Préparer, RG-COO-250, comptage RG-COO-247),
 * 0 / 1 / 6 → 4 (déblocage, RG-COO-277, COO-P08). Toute autre transition est interdite (409, RG-COO-307). */
export const TRANSITIONS_REPARTITION: Transitions<StatutProduction> = {
  A_TRAITER: ['EN_COURS', 'ANNULE'],
  EN_COURS: ['A_TRAITER', 'PREPARE', 'ANNULE'],
  PREPARE: ['ANNULE'],
  ERREUR: [],
  ANNULE: [],
  INSTRUCTION_OK: [],
  A_IMPRIMER: [],
  A_EXPEDIER: [],
  TERMINE: [],
  EXPORT_PREPA: [],
  AU_ROULAGE: [],
}

/** §3.2 « UM » : 1 → 6 (Préparer), 1 / 6 → 4 (déblocage) ; l'UM est supprimée au retrait (RG-COO-249). */
export const TRANSITIONS_UM: Transitions<StatutProduction> = {
  ...TRANSITIONS_REPARTITION,
  EN_COURS: ['PREPARE', 'ANNULE'],
  PREPARE: ['ANNULE'],
}

/** RG-COO-223 / 143 (HYPOTHÈSE Q-196) : une unité « Préparé » ou au-delà est en production (point de non-retour). */
const STATUTS_EN_PRODUCTION: readonly StatutProduction[] = [
  'PREPARE',
  'A_EXPEDIER',
  'TERMINE',
  'EXPORT_PREPA',
  'AU_ROULAGE',
]
export const STATUTS_MASQUES: StatutProduction[] = ['ERREUR', 'ANNULE'] // RG-COO-290 : hors statuts 3 et 4
export const RANG: Record<StatutProduction, number> = {
  A_TRAITER: 0,
  EN_COURS: 1,
  INSTRUCTION_OK: 2,
  ERREUR: 3,
  ANNULE: 4,
  A_IMPRIMER: 5,
  PREPARE: 6,
  A_EXPEDIER: 7,
  TERMINE: 8,
  EXPORT_PREPA: 9,
  AU_ROULAGE: 10,
}

const MESSAGE_EN_PRODUCTION =
  'Unité déjà en production : impossible de la modifier (point de non-retour).'

const enProduction = (statut: StatutProduction) => STATUTS_EN_PRODUCTION.includes(statut)

// ───────────────────────────── Lecture : lignes de l'unitaire ─────────────────────────────

export const INCLUDE_REPARTITION = {
  unite: { include: { colis: { include: { colis: { select: { codeColis: true } } } } } },
  destinataire: { select: { nom: true, nomOrigine: true } },
  support: { select: { nom: true } },
  typePreparation: { select: { libelle: true } },
  atelier: {
    select: { id: true, libelle: true, plateformeId: true, plateforme: { select: { nom: true } } },
  },
} satisfies Prisma.RepartitionInclude
export type RepartitionLue = Prisma.RepartitionGetPayload<{ include: typeof INCLUDE_REPARTITION }>

function listeIds(texte: string): Set<number> {
  return new Set(
    texte
      .split(/[;,]/)
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isInteger(x) && x > 0),
  )
}

/** Type d'unité d'une répartition (HYPOTHÈSE Q-196, Q-319 : types de pliage et de bus en paramètres ; tout autre
 * type d'un atelier fixe est « 2 m² fixe » : plus de distinction Vrac / Roulée, RG-COO-248). */
export async function lireTypes(client: Client) {
  return {
    pliage: listeIds(await lireParametreTexte(client, 'unitaire.typesPliage')),
    bus: listeIds(await lireParametreTexte(client, 'unitaire.typesBus')),
  }
}
export type TypesParam = Awaited<ReturnType<typeof lireTypes>>

export const typeDe = (
  r: Pick<RepartitionLue, 'typePreparationId'>,
  t: TypesParam,
): TypeUnitaire =>
  r.typePreparationId !== null && t.bus.has(r.typePreparationId)
    ? 'bus'
    : r.typePreparationId !== null && t.pliage.has(r.typePreparationId)
      ? 'pliage'
      : 'fixe'

const PREFIXE: Record<TypeUnitaire, string> = { fixe: 'UM', pliage: 'PL', bus: 'BU' }
export const codeUnite = (type: TypeUnitaire, id: number) =>
  `${PREFIXE[type]}-${String(id).padStart(4, '0')}`

/** RG-COO-238 (HYPOTHÈSE Q-256) : entretien à l'afficheur, minimum 1 dès le seuil. */
export function entretienDeLigne(
  qte: number,
  pourcentage: number,
  seuil: number,
  arrondiMode: string,
): number {
  const e = nombreEntretien(qte, pourcentage, seuil, arrondiMode)
  return qte >= seuil && e < 1 ? 1 : e
}

/** RG-COO-238 : % d'entretien repris de l'instruction du dossier (Broadcast, sans ressaisie), sinon le défaut (8). */
async function pourcentagesDossiers(client: Client, contNums: number[]) {
  const defaut = await lireParametreNombre(client, 'coordination.entretienDefaut')
  const instructions = await parPaquets(contNums, (paquet) =>
    client.instruction.findMany({
      where: { contNum: { in: paquet }, entretien: { not: null }, statut: { not: 'ANNULE' } },
      select: { contNum: true, entretien: true },
      orderBy: { code: 'asc' },
    }),
  )
  const m = new Map<number, number>()
  for (const i of instructions)
    if (i.contNum !== null && i.entretien !== null && !m.has(i.contNum))
      m.set(i.contNum, i.entretien)
  return (contNum: number | null) => (contNum === null ? defaut : (m.get(contNum) ?? defaut))
}

/** Groupe les répartitions en lignes (RG-COO-248 : une ligne par destinataire × thème × dossier × semaine). */
async function construireLignes(
  client: Client,
  reps: readonly RepartitionLue[],
  types: TypesParam,
): Promise<LigneUnitaire[]> {
  const contNums = [...new Set(reps.map((r) => r.contNum).filter((c): c is number => c !== null))]
  const [pct, indicatives, seuil, arrondi] = await Promise.all([
    pourcentagesDossiers(client, contNums),
    affichesIndicatives(client, contNums),
    lireParametreNombre(client, 'trains.entretienSeuil'),
    lireParametreTexte(client, 'trains.entretienArrondi'),
  ])
  // RG-COO-241 / 242 : libération de la semaine de chaque (atelier, semaine) affiché.
  const ateliersLus = [
    ...new Set(reps.map((r) => r.atelierId).filter((a): a is number => a !== null)),
  ]
  const liberations = new Map<string, Date>()
  for (const l of await parPaquets(ateliersLus, (paquet) =>
    client.liberationSemaine.findMany({ where: { atelierId: { in: paquet } } }),
  ))
    liberations.set(cleLiberation(l.atelierId, l.semAnnee, l.semNum), l.libereeLe)
  const liensAffiches = await parPaquets(contNums, (paquet) =>
    client.afficheAttendue.findMany({
      where: { actif: true, ligneAttendue: { contNum: { in: paquet } } },
      select: {
        afficheId: true,
        ligneAttendue: { select: { plateformeId: true, contNum: true, theme: true } },
      },
    }),
  )
  const groupes = new Map<string, RepartitionLue[]>()
  for (const r of reps) {
    const cle = [
      r.atelierId,
      r.contNum,
      cleTheme(r.theme),
      cleTheme(r.repiquage),
      r.destinataireId,
      r.semAnnee,
      r.semNum,
    ].join('|')
    groupes.set(cle, [...(groupes.get(cle) ?? []), r])
  }
  const lignes: LigneUnitaire[] = []
  for (const [cle, membres] of groupes) {
    const premiere = membres[0]
    if (!premiere?.atelier) continue
    const plateformeId = premiere.atelier.plateformeId
    const type = typeDe(premiere, types)
    const qte = membres.reduce((x, r) => x + (r.qte ?? 0), 0)
    const pourcentage = pct(premiere.contNum)
    const entretien = entretienDeLigne(qte, pourcentage, seuil, arrondi)
    const statut = membres.reduce(
      (a, r) => (RANG[r.statut] < RANG[a] ? r.statut : a),
      premiere.statut,
    )
    const um = membres.find((r) => r.unite !== null)?.unite ?? null
    const liberee =
      premiere.atelierId !== null && premiere.semAnnee !== null && premiere.semNum !== null
        ? (liberations.get(cleLiberation(premiere.atelierId, premiere.semAnnee, premiere.semNum)) ??
          null)
        : null
    const nom = premiere.destinataire
      ? (premiere.destinataire.nom ?? premiere.destinataire.nomOrigine)
      : null
    const ums = [
      ...new Map(
        membres.flatMap((r) => (r.unite ? [[r.unite.id, r.unite] as const] : [])),
      ).values(),
    ]
    const unique = (values: (string | null)[]) => [
      ...new Set(values.filter((v): v is string => v !== null && v !== '')),
    ]
    lignes.push({
      // EX-NEW16-COO-001 : métadonnées réelles, sans changer le regroupement ni les quantités métier.
      detailsUm: {
        commentaires: unique(ums.map((u) => u.commentaire)),
        preparations: unique(ums.map((u) => u.codeSynthese)),
        colis: unique(ums.flatMap((u) => u.colis.map((c) => c.colis.codeColis))),
        repartitions: unique(membres.map((r) => r.repartition?.toString() ?? null)),
        affiches: [
          ...new Set(
            liensAffiches
              .filter(
                (l) =>
                  cleVisuel(
                    l.ligneAttendue.plateformeId,
                    l.ligneAttendue.contNum,
                    l.ligneAttendue.theme,
                  ) === cleVisuel(plateformeId, premiere.contNum, premiere.theme),
              )
              .map((l) => l.afficheId),
          ),
        ],
        quantitePreparee: ums.reduce(
          (total, u) => total + u.colis.reduce((s, c) => s + c.quantite, 0),
          0,
        ),
        creation: ums.map((u) => u.createdAt.toISOString()).sort()[0] ?? null,
      },
      cle,
      refs: membres.map((r) => ({ id: r.id, version: r.version })),
      unite: um ? { id: um.id, code: codeUnite(type, um.id), statut: um.statut } : null,
      type,
      typePreparation: premiere.typePreparation?.libelle ?? null,
      atelier: {
        id: premiere.atelier.id,
        libelle: premiere.atelier.libelle,
        plateforme: premiere.atelier.plateforme.nom,
        plateformeId: premiere.atelier.plateformeId,
      },
      dossier: premiere.contNum,
      annonceur: premiere.annonceur,
      theme: premiere.theme,
      repiquage: premiere.repiquage,
      destinataire: nom,
      afficheur: nom,
      format: premiere.support?.nom ?? null,
      qte,
      entretien,
      total: qte + entretien,
      pourcentageEntretien: pourcentage,
      statut,
      depart:
        premiere.semAnnee !== null && premiere.semNum !== null
          ? formatSemaineIso({ annee: premiere.semAnnee, semaine: premiere.semNum })
          : null,
      jourAffichage: premiere.dateAffichage ? premiere.dateAffichage.toISOString() : null,
      corrigeePlateforme: membres.some((r) => r.corrigeePlateforme),
      rendue: membres.some((r) => r.rendueLe !== null),
      // RG-COO-241 : « à libérer » = ligne A traiter d'une semaine non libérée (repère dérivé, HYPOTHÈSE Q-250).
      aLiberer: liberee === null && statut === 'A_TRAITER',
      // RG-COO-242 : préparation (ligne) créée après la date de libération de sa semaine.
      apresLiberation: liberee !== null && membres.some((r) => r.createdAt > liberee),
      enProduction: membres.some(
        (r) => enProduction(r.statut) || (r.unite !== null && enProduction(r.unite.statut)),
      ),
      afficheRecue:
        indicatives.get(
          cleVisuel(premiere.atelier.plateformeId, premiere.contNum, premiere.theme),
        ) ?? 'AUCUNE',
    })
  }
  return lignes.sort(
    (a, b) =>
      (a.depart ?? '').localeCompare(b.depart ?? '') ||
      (a.dossier ?? 0) - (b.dossier ?? 0) ||
      a.cle.localeCompare(b.cle),
  )
}

export const cleLiberation = (atelierId: number, annee: number, semaine: number) =>
  `${String(atelierId)}|${String(annee)}|${String(semaine)}`

/** Ateliers fixes du périmètre (RG-COO-167) ; l'atelier demandé est revérifié côté serveur. */
async function ateliersUnitaire(client: Client, identity: Identity, demande?: number) {
  const ateliers = (await ateliersDuPerimetre(client, identity)).filter((a) => a.type === 'FIXE')
  if (demande === undefined) return ateliers
  const trouve = ateliers.find((a) => a.id === demande)
  if (trouve) return [trouve]
  const ailleurs = await client.atelier.findUnique({ where: { id: demande } })
  if (!ailleurs) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, ailleurs)
  throw new BusinessError("Cet atelier n'est pas un atelier de préparation 2 m² (fixe).", {
    code: 'COO_ATELIER_NON_FIXE',
    regle: 'RG-COO-290',
  })
}

async function lireLignes(client: Client, identity: Identity, q: UnitaireQuery) {
  const ateliers = await ateliersUnitaire(client, identity, q.atelier)
  const types = await lireTypes(client)
  const depart = q.depart ? lireSemaineIso(q.depart) : null
  const reps = await parPaquets(
    ateliers.map((a) => a.id),
    (paquet) =>
      client.repartition.findMany({
        where: {
          atelierId: { in: paquet },
          statut: { notIn: STATUTS_MASQUES },
          contNum: q.dossier ?? { not: null },
          ...(depart ? { semAnnee: depart.annee, semNum: depart.semaine } : {}),
        },
        include: INCLUDE_REPARTITION,
        orderBy: { id: 'asc' },
      }),
  )
  const retenues = reps.filter((r) => typeDe(r, types) === q.type)
  const toutes = await construireLignes(client, retenues, types)
  const lignes = toutes.filter(
    (l) =>
      (!q.statut || l.statut === q.statut) &&
      contient(l.annonceur, q.annonceur) &&
      contient(l.destinataire, q.destinataire) &&
      contient(l.afficheur, q.afficheur) &&
      (q.repere === undefined ||
        (q.repere === 'RENDU' && l.rendue) ||
        (q.repere === 'A_LIBERER' && l.aLiberer) ||
        (q.repere === 'APRES_LIBERATION' && l.apresLiberation)),
  )
  return { ateliers, lignes, toutes, types, reps: retenues }
}

/** RG-COO-240 à 242 : état de la libération de chaque (atelier, semaine de départ) des lignes affichées. */
async function semainesLiberation(db: Db, lignes: readonly LigneUnitaire[]) {
  const groupes = new Map<string, LigneUnitaire[]>()
  for (const l of lignes) {
    if (l.depart === null) continue
    const cle = `${String(l.atelier.id)}|${l.depart}`
    groupes.set(cle, [...(groupes.get(cle) ?? []), l])
  }
  const liberations = await parPaquets([...new Set(lignes.map((l) => l.atelier.id))], (paquet) =>
    db.liberationSemaine.findMany({
      where: { atelierId: { in: paquet } },
      include: { atelier: { select: { id: true } } },
    }),
  )
  const parAuteurs = new Map(
    (
      await parPaquets(
        [...new Set(liberations.map((l) => l.parId).filter((u): u is number => u !== null))],
        (paquet) =>
          db.utilisateur.findMany({
            where: { id: { in: paquet } },
            select: { id: true, nom: true, identifiantExterne: true },
          }),
      )
    ).map((u) => [u.id, u.nom ?? u.identifiantExterne]),
  )
  const semaines: Unitaire['liberation']['semaines'] = []
  for (const membres of groupes.values()) {
    const [premiere] = membres
    if (!premiere?.depart) continue
    const sem = lireSemaineIso(premiere.depart)
    const lib = liberations.find(
      (l) =>
        l.atelierId === premiere.atelier.id && l.semAnnee === sem.annee && l.semNum === sem.semaine,
    )
    semaines.push({
      atelierId: premiere.atelier.id,
      atelier: premiere.atelier.libelle,
      depart: premiere.depart,
      libereeLe: lib ? lib.libereeLe.toISOString() : null,
      libereePar: lib?.parId != null ? (parAuteurs.get(lib.parId) ?? null) : null,
      lignesALiberer: membres.filter((m) => m.aLiberer).length,
      dossiersApres: [
        ...new Set(
          membres
            .filter((m) => m.apresLiberation)
            .map((m) => m.dossier)
            .filter((d): d is number => d !== null),
        ),
      ].sort((a, b) => a - b),
    })
  }
  return semaines.sort((a, b) => a.depart.localeCompare(b.depart) || a.atelierId - b.atelierId)
}

// RG-COO-290 / 238 / 245 / 248 : liste des unités d'un type (fixe, pliage, bus), lecture seule.
export async function listerUnitaire(
  db: Db,
  identity: Identity,
  q: UnitaireQuery,
): Promise<Unitaire> {
  assertDroitCoordination(identity, 'train.consulter', 'RG-COO-290')
  const { ateliers, lignes, toutes, reps } = await lireLignes(db, identity, q)
  const contNums = [...new Set(reps.map((r) => r.contNum).filter((c): c is number => c !== null))]
  // Thèmes exclus par Broadcast (RG-COO-014) : sortis automatiquement, listés en annotation.
  const exclus = await parPaquets(contNums, (paquet) =>
    db.receptionAttendue.findMany({
      where: { themeExclu: true, contNum: { in: paquet } },
      select: { theme: true },
    }),
  )
  return {
    type: q.type,
    ateliers: ateliers.map((a) => ({
      id: a.id,
      libelle: a.libelle,
      plateforme: a.plateforme,
      plateformeId: a.plateformeId,
    })),
    lignes,
    themesExclus: [
      ...new Set(exclus.map((e) => e.theme).filter((t): t is string => t !== null)),
    ].sort(),
    liberation: { disponible: true, semaines: await semainesLiberation(db, toutes) },
  }
}

// RG-COO-246 : fiche de synthèse groupée par destinataire (aperçu et impression côté navigateur, RG-COO-306).
export async function syntheseUnitaire(
  db: Db,
  identity: Identity,
  q: UnitaireQuery,
): Promise<Synthese> {
  assertDroitCoordination(identity, 'train.consulter', 'RG-COO-246')
  const { lignes } = await lireLignes(db, identity, q)
  const parDest = new Map<string, LigneUnitaire[]>()
  for (const l of lignes) {
    const k = l.destinataire ?? '—'
    parDest.set(k, [...(parDest.get(k) ?? []), l])
  }
  const somme = (ls: LigneUnitaire[], c: 'qte' | 'entretien' | 'total') =>
    ls.reduce((x, l) => x + l[c], 0)
  const groupes = [...parDest.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([destinataire, ls]) => ({
      destinataire,
      lignes: ls.map((l) => ({
        dossier: l.dossier,
        annonceur: l.annonceur,
        theme: l.theme,
        repiquage: l.repiquage,
        format: l.format,
        qte: l.qte,
        entretien: l.entretien,
        total: l.total,
      })),
      qte: somme(ls, 'qte'),
      entretien: somme(ls, 'entretien'),
      total: somme(ls, 'total'),
    }))
  return {
    type: q.type,
    groupes,
    qte: somme(lignes, 'qte'),
    entretien: somme(lignes, 'entretien'),
    total: somme(lignes, 'total'),
  }
}

// ───────────────────────────── Écritures ─────────────────────────────

/** Charge les répartitions d'une sélection : doublon (400), inconnue (404), périmètre (403), version périmée (409). */
export async function chargerSelection(
  tx: Tx,
  identity: Identity,
  refs: readonly RefRepartition[],
  regle: string,
) {
  if (new Set(refs.map((r) => r.id)).size !== refs.length)
    throw new ValidationError('Une ligne est citée plusieurs fois dans la sélection.')
  const reps = await parPaquets(
    refs.map((r) => r.id),
    (paquet) =>
      tx.repartition.findMany({ where: { id: { in: paquet } }, include: INCLUDE_REPARTITION }),
  )
  const parId = new Map(reps.map((r) => [r.id, r]))
  for (const ref of refs) {
    const r = parId.get(ref.id)
    if (!r) throw new NotFoundError(`Ligne ${String(ref.id)} introuvable`)
    assertPerimetreAtelier(identity, r.atelier)
    if (r.atelier?.id === undefined || r.atelierId === null)
      throw new BusinessError("Cette ligne n'est rattachée à aucun atelier.", {
        code: 'COO_LIGNE_SANS_ATELIER',
        regle,
      })
  }
  for (const ref of refs)
    if (parId.get(ref.id)?.version !== ref.version)
      throw new ConflictError(
        'Cette ligne a été modifiée par un autre utilisateur : rechargez la page.',
        { ...COO.version, regle: 'RG-COO-308' },
      )
  return refs.map((ref) => parId.get(ref.id) as RepartitionLue)
}

export async function changerStatutRepartition(
  tx: Tx,
  identity: Identity,
  r: Pick<RepartitionLue, 'id' | 'statut' | 'version'>,
  vers: StatutProduction,
  regle: string,
  extra: Prisma.RepartitionUncheckedUpdateManyInput = {},
  motif?: string,
) {
  assertTransition(TRANSITIONS_REPARTITION, r.statut, vers, { regle })
  await updateWithVersion({
    expectedVersion: r.version,
    update: (where) =>
      tx.repartition.updateMany({
        where: { id: r.id, ...where },
        data: { statut: vers, updatedById: identity.userId, ...extra, ...bumpVersion },
      }),
    ...COO.version,
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'REPARTITION',
    entiteId: r.id,
    ancien: r.statut,
    nouveau: vers,
    parId: identity.userId,
    regle,
    ...(motif ? { motif } : {}),
  })
}

/** Toutes les répartitions (non annulées) des UM de la sélection : l'UM est traitée en entier (legacy RG-COO-249). */
async function repartitionsDesUnites(tx: Tx, reps: readonly RepartitionLue[]) {
  const umIds = [...new Set(reps.map((r) => r.uniteId).filter((u): u is number => u !== null))]
  const parUnite = new Map<number, RepartitionLue[]>()
  for (const r of await parPaquets(umIds, (paquet) =>
    tx.repartition.findMany({
      where: { uniteId: { in: paquet }, statut: { not: 'ANNULE' } },
      include: INCLUDE_REPARTITION,
    }),
  ))
    if (r.uniteId !== null) parUnite.set(r.uniteId, [...(parUnite.get(r.uniteId) ?? []), r])
  return parUnite
}

/** RG-COO-249 : l'UM est supprimée, ses répartitions repassent à « A traiter » (UM_id nul). Les colis (COO-P13)
 * gardent la suppression : voir `umDansColis`. */
async function retirerUnite(
  tx: Tx,
  identity: Identity,
  um: { id: number; statut: StatutProduction; version: number },
  membres: readonly RepartitionLue[],
  regle: string,
  extra: Prisma.RepartitionUncheckedUpdateManyInput,
  motif?: string,
) {
  // §3.2 : seule l'UM « En cours » (1) se retire ; toute autre transition est un 409 (une UM « Annulé » comprise).
  if (um.statut !== 'EN_COURS' || membres.some((m) => m.statut !== 'EN_COURS'))
    throw new ConflictError(
      "Cette unité n'est plus « En cours » : elle ne peut plus être retirée (point de non-retour).",
      { code: 'TRANSITION_INTERDITE', regle, details: { unite: um.id, statut: um.statut } },
    )
  await umDansColis(tx, um.id, regle)
  for (const m of membres)
    await changerStatutRepartition(
      tx,
      identity,
      m,
      'A_TRAITER',
      regle,
      { uniteId: null, ...extra },
      motif,
    )
  await tx.uniteManutention.delete({ where: { id: um.id } })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'UNITE_MANUTENTION',
    entiteId: um.id,
    ancien: um.statut,
    nouveau: 'SUPPRIMEE',
    parId: identity.userId,
    regle,
    ...(motif ? { motif } : {}),
  })
}

// RG-COO-249 : refus explicite (409) si l'UM est dans un colis (le legacy échouait par contrainte étrangère).
// Garde appelée directement (plus d'enregistrement par effet de bord à l'import du module colis, audit final m3).
async function umDansColis(tx: Tx, umId: number, regle: string): Promise<void> {
  const colis = await tx.uniteColis.count({ where: { uniteId: umId } })
  if (colis > 0)
    throw new ConflictError(
      'Cette unité est dans un colis : retirez-la d’abord du colis (point de non-retour).',
      { code: 'COO_UM_DANS_COLIS', regle, details: { unite: umId, colis } },
    )
}

// RG-COO-239 : modifier la quantité à produire d'une ligne (entretien reçu insuffisant), avec historique.
export async function modifierQuantite(
  tx: Tx,
  identity: Identity,
  input: ModifierQuantite,
): Promise<ResultatUnitaire> {
  assertDroitCoordination(identity, 'unite.gerer', 'RG-COO-239')
  const [r] = await chargerSelection(
    tx,
    identity,
    [{ id: input.id, version: input.version }],
    'RG-COO-239',
  )
  if (!r) throw new NotFoundError('Ligne introuvable')
  if (enProduction(r.statut) || (r.unite !== null && enProduction(r.unite.statut)))
    throw new ConflictError(MESSAGE_EN_PRODUCTION, {
      code: 'COO_UNITE_EN_PRODUCTION',
      regle: 'RG-COO-223',
    })
  if (r.statut !== 'A_TRAITER' && r.statut !== 'EN_COURS')
    throw new ConflictError('Cette ligne est annulée ou en erreur : elle ne se modifie pas.', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-239',
    })
  if (r.qte === input.quantite)
    return {
      message: 'Quantité inchangée.',
      traitees: 0,
      enProduction: 0,
      ecart: null,
      mailStatut: null,
    }
  await updateWithVersion({
    expectedVersion: r.version,
    update: (where) =>
      tx.repartition.updateMany({
        where: { id: r.id, ...where },
        data: { qte: input.quantite, updatedById: identity.userId, ...bumpVersion },
      }),
    ...COO.version,
  })
  await ecrireJournal(tx, {
    typeEntite: 'REPARTITION',
    entiteId: r.id,
    action: 'MODIFICATION_QUANTITE_UNITE',
    parId: identity.userId,
    ancienneValeur: String(r.qte ?? 0),
    nouvelleValeur: String(input.quantite),
    complement: 'RG-COO-239',
    donnees: { contNum: r.contNum, theme: r.theme },
  })
  return {
    message: `Quantité à produire mise à jour : ${String(r.qte ?? 0)} → ${String(input.quantite)}.`,
    traitees: 1,
    enProduction: 0,
    ecart: null,
    mailStatut: null,
  }
}

// RG-COO-244 : « Corriger l'intitulé » (annonceur imprimé, thème) de toutes les unités du thème ; production lancée
// autorisée (exception limitée à l'intitulé imprimé, HYPOTHÈSE Q-196) ; « Feuille à refaire » sur les affiches
// (RG-X-082) ; mail à la Pré-Prod consigné, non envoyé (Q-375).
export async function corrigerIntitule(
  tx: Tx,
  identity: Identity,
  input: CorrigerIntitule,
): Promise<ResultatUnitaire> {
  assertDroitCoordination(identity, 'intitule.corriger', 'RG-COO-244')
  const annonceur = input.annonceur.trim()
  const theme = input.theme.trim()
  if (!annonceur || !theme)
    throw new BusinessError('Le thème et l’annonceur ne peuvent pas être vides.', {
      code: 'COO_INTITULE_VIDE',
      regle: 'RG-COO-244',
    })
  const [ref] = await chargerSelection(
    tx,
    identity,
    [{ id: input.id, version: input.version }],
    'RG-COO-244',
  )
  if (!ref?.atelier) throw new NotFoundError('Ligne introuvable')
  if (ref.statut === 'ANNULE' || ref.statut === 'ERREUR')
    throw new ConflictError('Cette ligne est annulée ou en erreur : elle ne se modifie pas.', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-244',
    })
  if ((ref.annonceur ?? '').trim() === annonceur && (ref.theme ?? '').trim() === theme)
    throw new BusinessError('Rien n’a changé.', { code: 'COO_RIEN_A_CHANGER', regle: 'RG-COO-244' })
  // Toutes les unités du thème (même dossier, même thème normalisé, même site).
  const candidates = await tx.repartition.findMany({
    where: {
      contNum: ref.contNum,
      statut: { notIn: STATUTS_MASQUES },
      atelier: { plateformeId: ref.atelier.plateformeId },
    },
    include: INCLUDE_REPARTITION,
  })
  const cible = cleTheme(ref.theme)
  const reps = candidates.filter((r) => cleTheme(r.theme) === cible)
  let lancees = 0
  for (const r of reps) {
    if (enProduction(r.statut) || (r.unite !== null && enProduction(r.unite.statut))) lancees++
    await updateWithVersion({
      expectedVersion: r.version,
      update: (where) =>
        tx.repartition.updateMany({
          where: { id: r.id, ...where },
          data: {
            annonceur,
            theme,
            corrigeePlateforme: true,
            updatedById: identity.userId,
            ...bumpVersion,
          },
        }),
      ...COO.version,
    })
    await ecrireJournal(tx, {
      typeEntite: 'REPARTITION',
      entiteId: r.id,
      action: 'CORRECTION_INTITULE',
      parId: identity.userId,
      ancienneValeur: `${r.annonceur ?? ''} · ${r.theme ?? ''}`,
      nouvelleValeur: `${annonceur} · ${theme}`,
      complement: 'RG-COO-244',
    })
  }
  // RG-X-082 : « Feuille à refaire » sur les affiches rattachées aux lignes de ce thème (même dossier et site).
  const lignes = (
    await tx.receptionAttendue.findMany({
      where: { contNum: ref.contNum, plateformeId: ref.atelier.plateformeId, etatLigne: 'ACTIVE' },
      select: { id: true, theme: true },
    })
  ).filter((l) => cleTheme(l.theme) === cible)
  const liens = await parPaquets(
    lignes.map((l) => l.id),
    (paquet) =>
      tx.afficheAttendue.findMany({
        where: { actif: true, ligneAttendueId: { in: paquet } },
        select: { afficheId: true },
      }),
  )
  const affiches = await parPaquets([...new Set(liens.map((l) => l.afficheId))], (paquet) =>
    tx.affiche.findMany({ where: { id: { in: paquet } } }),
  )
  for (const a of affiches) {
    await updateWithVersion({
      expectedVersion: a.version,
      update: (where) =>
        tx.affiche.updateMany({
          where: { id: a.id, ...where },
          data: { feuilleARefaire: true, updatedById: identity.userId, ...bumpVersion },
        }),
      ...COO.version,
    })
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: a.id,
      action: 'MODIFICATION_THEME',
      parId: identity.userId,
      ancienneValeur: a.theme,
      nouvelleValeur: theme,
      complement: 'Intitulé corrigé par la plateforme : feuille à refaire (RG-COO-244, RG-X-082)',
    })
  }
  // Mail « Pré-Prod <site> » (RG-COO-244, D-19, Q-219, Q-409) : mis en file dans cette transaction, envoyé après le commit.
  let mailStatut: string | null = null
  if (input.prevenirPreProd) {
    const plateforme = await tx.plateforme.findUnique({
      where: { id: ref.atelier.plateformeId },
      select: { mail: true, nom: true },
    })
    const miseEnFile = await mettreEnFileMail(tx, {
      type: 'CORRECTION_INTITULE',
      // Pas de ligne source : clé unique par correction (l'idempotence de la requête est portée par l'Idempotency-Key).
      cle: `CORRECTION_INTITULE:${randomUUID()}`,
      destinataires: [plateforme?.mail],
      sujet: `Intitulé corrigé - dossier ${String(ref.contNum ?? '—')} ${annonceur}`.trim(),
      corps: [
        `Intitulé corrigé par la plateforme ${plateforme?.nom ?? ''} (feuille à refaire).`,
        `Avant : ${ref.annonceur ?? ''} - ${ref.theme ?? ''}`,
        `Après : ${annonceur} - ${theme}`,
        `Par : ${identity.nom ?? identity.identifiantExterne}`,
      ].join('\n'),
      parId: identity.userId,
    })
    mailStatut = miseEnFile ? 'NON_ENVOYE' : 'SANS_DESTINATAIRE'
  }
  if (ref.contNum !== null)
    await ecrireJournal(tx, {
      typeEntite: 'DOSSIER',
      entiteId: ref.contNum,
      action: 'CORRECTION_INTITULE',
      parId: identity.userId,
      ancienneValeur: `${ref.annonceur ?? ''} · ${ref.theme ?? ''}`,
      nouvelleValeur: `${annonceur} · ${theme}`,
      complement: 'RG-COO-244',
      donnees: {
        unites: reps.length,
        enProduction: lancees,
        affiches: affiches.length,
        mailStatut,
      },
    })
  return {
    message: `Intitulé corrigé sur ${String(reps.length)} unité(s) ; « Feuille à refaire » posée sur ${String(affiches.length)} affiche(s)${
      mailStatut === 'NON_ENVOYE' ? ' ; mail à la Pré-Prod mis en file d’envoi (Q-375, Q-409)' : ''
    }.`,
    traitees: reps.length,
    enProduction: lancees,
    ecart: null,
    mailStatut,
  }
}

// RG-COO-243 : « Rendre la main à la Pré-Prod » : unités non lancées → « A traiter » (EN_ATTENTE) avec repère
// « main rendue » et enregistrement du rendu ; les unités déjà en production ne sont pas retirées (point de non-retour).
// RG-X-081 : « Rendre la main » depuis la préparation unitaire.
export async function rendreLaMain(
  tx: Tx,
  identity: Identity,
  input: RendreLaMain,
): Promise<ResultatUnitaire> {
  assertDroitCoordination(identity, 'preprod.rendre_main', 'RG-COO-243')
  const motif = input.motif?.trim() || 'Changement de visuel demandé par le client'
  const reps = await chargerSelection(tx, identity, input.lignes, 'RG-COO-243')
  const parUnite = await repartitionsDesUnites(tx, reps)
  const maintenant = new Date()
  const rendues: RepartitionLue[] = []
  let lancees = 0
  const vues = new Set<number>()
  for (const r of reps) {
    if (vues.has(r.id)) continue
    const membres = r.uniteId !== null ? (parUnite.get(r.uniteId) ?? [r]) : [r]
    membres.forEach((m) => vues.add(m.id))
    if (membres.some((m) => enProduction(m.statut)) || (r.unite && enProduction(r.unite.statut))) {
      lancees += membres.length
      continue
    }
    if (r.statut === 'ANNULE' || r.statut === 'ERREUR')
      throw new ConflictError('Cette ligne est annulée ou en erreur : sa main ne se rend pas.', {
        code: 'TRANSITION_INTERDITE',
        regle: 'RG-COO-243',
      })
    if (r.uniteId !== null && r.unite)
      await retirerUnite(
        tx,
        identity,
        r.unite,
        membres,
        'RG-COO-243',
        { rendueLe: maintenant },
        motif,
      )
    else
      for (const m of membres) {
        await updateWithVersion({
          expectedVersion: m.version,
          update: (where) =>
            tx.repartition.updateMany({
              where: { id: m.id, ...where },
              data: { rendueLe: maintenant, updatedById: identity.userId, ...bumpVersion },
            }),
          ...COO.version,
        })
      }
    rendues.push(...membres)
  }
  if (rendues.length === 0)
    throw new BusinessError(
      'Aucune unité à rendre : elles sont toutes déjà en production (point de non-retour).',
      { code: 'COO_RIEN_A_RENDRE', regle: 'RG-COO-243', details: { enProduction: lancees } },
    )
  const dossiers = [
    ...new Set(rendues.map((m) => m.contNum).filter((c): c is number => c !== null)),
  ]
  await tx.renduMain.create({
    data: {
      atelierId: rendues[0]?.atelierId ?? null,
      motif,
      nbEnProduction: lancees,
      repartitions: JSON.stringify(rendues.map((m) => m.id)),
      dossiers: JSON.stringify(dossiers),
      parId: identity.userId,
    },
  })
  // RG-COO-243 : les dossiers repassent à « Préparation reçue » (sauf annulés).
  for (const contNum of dossiers) {
    const dossier = await tx.dossier.findUnique({ where: { contNum } })
    if (dossier && dossier.statut === 'A_TRAITER')
      await updateWithVersion({
        expectedVersion: dossier.version,
        update: (where) =>
          tx.dossier.updateMany({
            where: { id: dossier.id, ...where },
            data: { statut: 'PREPARATION_RECUE', updatedById: identity.userId, ...bumpVersion },
          }),
        ...COO.version,
      })
    await ecrireJournal(tx, {
      typeEntite: 'DOSSIER',
      entiteId: contNum,
      action: 'RENDU_MAIN_UNITE',
      parId: identity.userId,
      nouvelleValeur: `Main rendue à la Pré-Prod : ${motif}`,
      complement: 'RG-COO-243',
      donnees: {
        unites: rendues.filter((m) => m.contNum === contNum).length,
        enProduction: lancees,
      },
    })
  }
  return {
    message: `Main rendue à la Pré-Prod : ${String(rendues.length)} unité(s) rendue(s)${
      lancees > 0 ? `, ${String(lancees)} déjà en production (non retirée(s))` : ''
    }.`,
    traitees: rendues.length,
    enProduction: lancees,
    ecart: null,
    mailStatut: null,
  }
}

// RG-COO-249 : « Retirer » : l'UM est supprimée et ses répartitions repassent à « A traiter » (UM_id nul).
export async function retirerUnites(
  tx: Tx,
  identity: Identity,
  input: LignesSelection,
): Promise<ResultatUnitaire> {
  assertDroitCoordination(identity, 'unite.gerer', 'RG-COO-249')
  const reps = await chargerSelection(tx, identity, input.lignes, 'RG-COO-249')
  const parUnite = await repartitionsDesUnites(tx, reps)
  const traitees = new Set<number>()
  let unites = 0
  for (const r of reps) {
    if (r.uniteId === null || !r.unite)
      throw new ConflictError("Cette ligne n'est dans aucune UM : il n'y a rien à retirer.", {
        code: 'TRANSITION_INTERDITE',
        regle: 'RG-COO-249',
      })
    if (traitees.has(r.uniteId)) continue
    traitees.add(r.uniteId)
    await retirerUnite(tx, identity, r.unite, parUnite.get(r.uniteId) ?? [r], 'RG-COO-249', {})
    await ecrireJournal(tx, {
      typeEntite: 'UNITE_MANUTENTION',
      entiteId: r.uniteId,
      action: 'RETRAIT_UNITE',
      parId: identity.userId,
      nouvelleValeur: 'UM retirée : répartitions repassées à « A traiter »',
      complement: 'RG-COO-249',
    })
    unites++
  }
  return {
    message: `${String(unites)} UM retirée(s) : leurs lignes repassent à « A traiter ».`,
    traitees: unites,
    enProduction: 0,
    ecart: null,
    mailStatut: null,
  }
}

async function preparerUnites(
  tx: Tx,
  identity: Identity,
  reps: readonly RepartitionLue[],
  regle: string,
  motif?: string,
): Promise<number> {
  const parUnite = await repartitionsDesUnites(tx, reps)
  const faites = new Set<number>()
  let preparees = 0
  for (const r of reps) {
    if (r.uniteId === null || !r.unite)
      throw new ConflictError("Seules les UM peuvent être préparées : cette ligne n'a pas d'UM.", {
        code: 'TRANSITION_INTERDITE',
        regle,
        details: { statut: r.statut },
      })
    if (faites.has(r.uniteId)) continue
    faites.add(r.uniteId)
    const um = r.unite
    // HYPOTHÈSE Q-271 : seules les UM « En cours » (1) ou « Préparé » (6) se préparent (3, 4, 7, 8 : 409).
    if (um.statut !== 'EN_COURS' && um.statut !== 'PREPARE')
      throw new ConflictError(`Transition interdite : ${um.statut} → PREPARE`, {
        code: 'TRANSITION_INTERDITE',
        regle,
        details: { de: um.statut, vers: 'PREPARE' },
      })
    if (um.statut === 'PREPARE') continue
    assertTransition(TRANSITIONS_UM, um.statut, 'PREPARE', { regle })
    for (const m of parUnite.get(r.uniteId) ?? [r])
      await changerStatutRepartition(tx, identity, m, 'PREPARE', regle, {}, motif)
    await updateWithVersion({
      expectedVersion: um.version,
      update: (where) =>
        tx.uniteManutention.updateMany({
          where: { id: um.id, ...where },
          data: { statut: 'PREPARE', updatedById: identity.userId, ...bumpVersion },
        }),
      ...COO.version,
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'UNITE_MANUTENTION',
      entiteId: um.id,
      ancien: um.statut,
      nouveau: 'PREPARE',
      parId: identity.userId,
      regle,
      ...(motif ? { motif } : {}),
    })
    await ecrireJournal(tx, {
      typeEntite: 'UNITE_MANUTENTION',
      entiteId: um.id,
      action: 'PREPARATION_UNITE',
      parId: identity.userId,
      ancienneValeur: um.statut,
      nouvelleValeur: 'PREPARE',
      complement: regle,
    })
    preparees++
  }
  return preparees
}

// RG-COO-250 : « Préparer » : l'UM et ses répartitions passent à « Préparé » (cible : Produit).
export async function preparerSelection(
  tx: Tx,
  identity: Identity,
  input: LignesSelection,
): Promise<ResultatUnitaire> {
  assertDroitCoordination(identity, 'unite.gerer', 'RG-COO-250')
  const reps = await chargerSelection(tx, identity, input.lignes, 'RG-COO-250')
  const n = await preparerUnites(tx, identity, reps, 'RG-COO-250')
  return {
    message: n > 0 ? `${String(n)} UM préparée(s).` : 'Ces UM sont déjà préparées.',
    traitees: n,
    enProduction: 0,
    ecart: null,
    mailStatut: null,
  }
}

// RG-COO-247 : pliage : « Valider le comptage » passe les unités à PRODUIT (Préparé) ; écart → alerte qualité
// (journal, comportement cible à confirmer, Q-196).
export async function comptagePliage(
  tx: Tx,
  identity: Identity,
  input: ComptagePliage,
): Promise<ResultatUnitaire> {
  assertDroitCoordination(identity, 'unite.gerer', 'RG-COO-247')
  const reps = await chargerSelection(tx, identity, input.lignes, 'RG-COO-247')
  const types = await lireTypes(tx)
  const pasPliage = reps.filter((r) => typeDe(r, types) !== 'pliage')
  if (pasPliage.length > 0)
    throw new ConflictError('Le comptage ne concerne que les lots de pliage.', {
      code: 'COO_PAS_PLIAGE',
      regle: 'RG-COO-247',
      details: { lignes: pasPliage.map((r) => r.id) },
    })
  const lignes = await construireLignes(tx, reps, types)
  const attendu = lignes.reduce((x, l) => x + l.total, 0)
  const ecart = attendu - input.comptees
  const n = await preparerUnites(tx, identity, reps, 'RG-COO-247', 'Comptage du pliage')
  if (ecart !== 0)
    for (const um of new Set(reps.map((r) => r.uniteId).filter((u): u is number => u !== null)))
      await ecrireJournal(tx, {
        typeEntite: 'UNITE_MANUTENTION',
        entiteId: um,
        action: 'COMPTAGE_PLIAGE',
        parId: identity.userId,
        nouvelleValeur: `Écart de comptage : ${String(Math.abs(ecart))} affiche(s) (attendu ${String(attendu)}, compté ${String(input.comptees)}) : alerte qualité`,
        complement: 'RG-COO-247',
        donnees: { attendu, comptees: input.comptees, ecart },
      })
  return {
    message:
      ecart === 0
        ? 'Comptage conforme.'
        : `Écart de comptage : ${String(Math.abs(ecart))} affiche(s). Alerte qualité créée.`,
    traitees: n,
    enProduction: 0,
    ecart,
    mailStatut: null,
  }
}

// ───────────────────────────── Bus : quantités à encoller (RG-COO-304) ─────────────────────────────

/** HYPOTHÈSE Q-196 : calcul Broadcast = commande × 1,08 + commande × 0,20 = commande × 1,28 (arrondi à l'entier). */
export const calculBroadcast = (commande: number) => Math.round((commande * 128) / 100)
/** Ajustements en % additifs (global + centre), plancher −100 % ; arrondi à l'entier. */
export const quantiteAEncoller = (calcul: number, global: number, centre: number) =>
  Math.round((calcul * (100 + Math.max(-100, global + centre))) / 100)

async function plateformeEncoller(client: Client, identity: Identity, demande?: number) {
  const ateliers = (await ateliersDuPerimetre(client, identity)).filter((a) => a.type === 'FIXE')
  const plateformeId = demande ?? ateliers[0]?.plateformeId
  if (plateformeId === undefined)
    throw new BusinessError('Aucun atelier de préparation sur votre périmètre.', {
      code: 'COO_PAS_DE_SITE',
      regle: 'RG-COO-304',
    })
  assertPlateforme(identity, plateformeId, { ...COO.perimetre, regle: 'RG-COO-304' })
  return plateformeId
}

export async function lireEncollage(
  db: Client,
  identity: Identity,
  q: EncollerQuery,
  maintenant = new Date(),
): Promise<Encoller> {
  assertDroitCoordination(identity, 'train.consulter', 'RG-COO-304')
  const plateformeId = await plateformeEncoller(db, identity, q.plateforme)
  const semaine = q.depart
    ? lireSemaineIso(q.depart)
    : semaineIsoDe(new Date(maintenant.getTime() + 7 * 86_400_000))
  const types = await lireTypes(db)
  const reps = (
    await db.repartition.findMany({
      where: {
        atelier: { plateformeId, type: 'FIXE' },
        statut: { notIn: STATUTS_MASQUES },
        semAnnee: semaine.annee,
        semNum: semaine.semaine,
      },
      include: INCLUDE_REPARTITION,
    })
  ).filter((r) => typeDe(r, types) === 'bus')
  const commandes = new Map<number, { centre: string; commande: number }>()
  for (const r of reps) {
    if (r.destinataireId === null) continue
    const e = commandes.get(r.destinataireId) ?? {
      centre: r.destinataire ? (r.destinataire.nom ?? r.destinataire.nomOrigine) : '—',
      commande: 0,
    }
    e.commande += r.qte ?? 0
    commandes.set(r.destinataireId, e)
  }
  const saisie = await db.encollageBus.findUnique({
    where: {
      plateformeId_semAnnee_semNum: {
        plateformeId,
        semAnnee: semaine.annee,
        semNum: semaine.semaine,
      },
    },
  })
  const ajustements = new Map(
    (JSON.parse(saisie?.centres ?? '[]') as { destinataireId: number; ajustement: number }[]).map(
      (c) => [c.destinataireId, c.ajustement],
    ),
  )
  const global = saisie?.ajustementGlobal ?? 0
  const centres = [...commandes.entries()]
    .sort(([, a], [, b]) => a.centre.localeCompare(b.centre))
    .map(([destinataireId, e]) => {
      const calcul = calculBroadcast(e.commande)
      const ajustement = ajustements.get(destinataireId) ?? 0
      return {
        destinataireId,
        centre: e.centre,
        commande: e.commande,
        calculBroadcast: calcul,
        ajustement,
        aEncoller: quantiteAEncoller(calcul, global, ajustement),
      }
    })
  return {
    plateformeId,
    depart: formatSemaineIso(semaine),
    ajustementGlobal: global,
    version: saisie?.version ?? 0,
    centres,
    total: centres.reduce((x, c) => x + c.aEncoller, 0),
  }
}

// RG-COO-304 : « Enregistrer et éditer les états de collage » : ajustements global et par centre, avec historique.
export async function enregistrerEncollage(
  tx: Tx,
  identity: Identity,
  input: EnregistrerEncoller,
): Promise<Encoller> {
  assertDroitCoordination(identity, 'unite.gerer', 'RG-COO-304')
  assertPlateforme(identity, input.plateformeId, { ...COO.perimetre, regle: 'RG-COO-304' })
  // BUS-19 (note du 08/10) remplace l'ajustement global ou par dossier pour les données Bus nouvelles.
  if (await tx.busLigne.count({ where: { plateformeId: input.plateformeId } }))
    throw new ConflictError(
      'Utilisez Bus › Préparation : ajustement par centre bus, parc et format, sans ajustement global.',
      { code: 'BUS_AJUSTEMENT_GLOBAL_RETIRE', regle: 'BUS-19' },
    )
  const semaine = lireSemaineIso(input.depart)
  const cle = {
    plateformeId_semAnnee_semNum: {
      plateformeId: input.plateformeId,
      semAnnee: semaine.annee,
      semNum: semaine.semaine,
    },
  }
  const existant = await tx.encollageBus.findUnique({ where: cle })
  const donnees = {
    ajustementGlobal: input.ajustementGlobal,
    centres: JSON.stringify(input.centres),
    parId: identity.userId,
  }
  if (!existant) {
    if (input.version !== 0)
      throw new ConflictError(
        'Ces quantités ont été modifiées par un autre utilisateur : rechargez.',
        {
          ...COO.version,
          regle: 'RG-COO-304',
        },
      )
    await tx.encollageBus.create({
      data: {
        plateformeId: input.plateformeId,
        semAnnee: semaine.annee,
        semNum: semaine.semaine,
        ...donnees,
      },
    })
  } else
    await updateWithVersion({
      expectedVersion: input.version,
      update: (where) =>
        tx.encollageBus.updateMany({
          where: { id: existant.id, ...where },
          data: { ...donnees, ...bumpVersion },
        }),
      ...COO.version,
    })
  await ecrireJournal(tx, {
    typeEntite: 'ENCOLLAGE_BUS',
    entiteId: `${String(input.plateformeId)}:${formatSemaineIso(semaine)}`,
    action: 'QUANTITES_ENCOLLER',
    parId: identity.userId,
    ancienneValeur: existant ? `global ${String(existant.ajustementGlobal)} %` : null,
    nouvelleValeur: `global ${String(input.ajustementGlobal)} % ; ${String(input.centres.length)} centre(s)`,
    complement: 'RG-COO-304 : états de collage à éditer (PDF navigateur)',
  })
  return lireEncollage(tx, identity, {
    plateforme: input.plateformeId,
    depart: input.depart,
  })
}
