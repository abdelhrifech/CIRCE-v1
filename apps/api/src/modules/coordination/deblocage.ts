// COO-P08 — Déblocage des préparations et « Rendre la main à la Pré-Prod » (RG-COO-140 à 152, 277 à 279 ;
// RG-X-059). HYPOTHÈSES : Q-217 (déblocage conservé comme action de la Coordination, sans effet sur la validation
// admin ni les affiches reçues), Q-218 (contrôle serveur des faces d'un groupe TRAIN, refus explicite si la
// correspondance support est absente), Q-382 (« Déblocage » → « Rendre la main »), Q-191 (source des groupes,
// demande à Broadcast mise en file, famille d'un type de préparation). Q-005 : l'appel réel à Broadcast
// (`P_CirceDebloquerGroupePreparation`) est BLOQUÉ ; Q-375 / Q-409 : le mail est mis en file (envoi : modules/mails).
import {
  MOTIF_RENDRE_MAIN_DEFAUT,
  type DebloquerGroupe,
  type GroupeDeblocable,
  type RechercheDeblocageQuery,
  type ResultatRechercheDeblocage,
  type SuiviDeblocageQuery,
} from '@circe/shared'
import type { StatutProduction } from '../../generated/prisma/client.ts'
import type { Db } from '../../core/db.ts'
import {
  BusinessError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { mettreEnFileMail } from '../mails/file.ts'
import { mettreEnFile } from './integration-broadcast.ts'
import { assertDroitCoordination, COO } from './permissions.ts'
import { parPaquets } from './trains.ts'

type Client = Db | Tx

// ───────────────────────────── Clé d'un groupe (pure) ─────────────────────────────

export type CleGroupe =
  | { type: 'UM'; idGroupe: number }
  | {
      type: 'TRAIN'
      chapeau: number
      contNum: number
      annee: number
      semaine: number
      idSurface: number | null
      idTypePreparation: number | null
      idSiteCcf: number | null
    }

const opt = (v: number | null) => (v === null ? '-' : String(v))
const lireOpt = (s: string | undefined) => (s === undefined || s === '-' ? null : Number(s))

export function encoderCle(c: CleGroupe): string {
  return c.type === 'UM'
    ? `UM:${String(c.idGroupe)}`
    : `TRAIN:${String(c.chapeau)}:${String(c.contNum)}:${String(c.annee)}:${String(c.semaine)}:${opt(c.idSurface)}:${opt(c.idTypePreparation)}:${opt(c.idSiteCcf)}`
}

/** null si la clé est mal formée (400 côté action). */
export function decoderCle(s: string): CleGroupe | null {
  const p = s.split(':')
  const entier = (x: string | undefined) => x !== undefined && /^\d+$/.test(x)
  const entierOpt = (x: string | undefined) => x === '-' || entier(x)
  // RG-COO-143 / 277 / 278 : un groupe UM = TOUT le groupe Broadcast (`IdGroupePreparation`), comme le legacy.
  if (p[0] === 'UM' && p.length === 2 && entier(p[1])) return { type: 'UM', idGroupe: Number(p[1]) }
  if (
    p[0] === 'TRAIN' &&
    p.length === 8 &&
    p.slice(1, 5).every(entier) &&
    p.slice(5).every(entierOpt)
  )
    return {
      type: 'TRAIN',
      chapeau: Number(p[1]),
      contNum: Number(p[2]),
      annee: Number(p[3]),
      semaine: Number(p[4]),
      idSurface: lireOpt(p[5]),
      idTypePreparation: lireOpt(p[6]),
      idSiteCcf: lireOpt(p[7]),
    }
  return null
}

// ───────────────────────────── Règles d'atelier (pure, RG-COO-141) ─────────────────────────────

export interface RegleAtelier {
  atelierId: number
  typePreparationId: number | null
  surfaceId: number | null
  exclusion: boolean
}

/** RG-COO-141 : une règle correspond si (tpr nul ou = famille du type) ET (surface nulle ou égale).
 * HYPOTHÈSE Q-191 (2) : référentiel des types fusionné (Q-318) : la famille d'un type est le type lui-même. */
export function regleCorrespond(
  r: RegleAtelier,
  idTypePreparation: number | null,
  idSurface: number | null,
): boolean {
  return (
    (r.typePreparationId === null || r.typePreparationId === idTypePreparation) &&
    (r.surfaceId === null || r.surfaceId === idSurface)
  )
}

/** RG-COO-141 : groupe visible si, pour au moins un atelier de l'utilisateur du même site CCF, une inclusion
 * correspond et aucune exclusion ne correspond. */
export function groupeAutorise(
  ateliers: { id: number; idSiteCcf: number | null }[],
  regles: RegleAtelier[],
  g: { idSiteCcf: number | null; idTypePreparation: number | null; idSurface: number | null },
): boolean {
  return ateliers.some((a) => {
    if (a.idSiteCcf === null || a.idSiteCcf !== g.idSiteCcf) return false
    const rs = regles.filter((r) => r.atelierId === a.id)
    return (
      rs.some((r) => !r.exclusion && regleCorrespond(r, g.idTypePreparation, g.idSurface)) &&
      !rs.some((r) => r.exclusion && regleCorrespond(r, g.idTypePreparation, g.idSurface))
    )
  })
}

// RG-COO-143 / 277 : statuts d'UM ≥ 6 (Préparé, À expédier, Terminé, Export prépa, Au roulage) : bloquants.
export const STATUTS_UM_BLOQUANTS: StatutProduction[] = [
  'PREPARE',
  'A_EXPEDIER',
  'TERMINE',
  'EXPORT_PREPA',
  'AU_ROULAGE',
]
// RG-COO-142 / 144 (Q-218) : faces à 0, 1 ou 4 = production non lancée ; toute autre bloque.
export const STATUTS_FACE_LIBRES: StatutProduction[] = ['A_TRAITER', 'EN_COURS', 'ANNULE']

/** RG-COO-149 : « Tole traditionnelle » est affiché « 4m² colle ». */
export function libelleTypeSuivi(libelle: string | null): string | null {
  return libelle !== null && libelle.trim().toLowerCase() === 'tole traditionnelle'
    ? '4m² colle'
    : libelle
}

export const MESSAGE_NON_DEBLOCABLE = "Le groupe de preparation n'est pas déblocable !"

// ───────────────────────────── Construction des groupes ─────────────────────────────

interface GroupeInterne extends GroupeDeblocable {
  cleGroupe: CleGroupe
  plateformeId: number | null
  repartitionIds: number[]
}

async function ateliersUtilisateur(client: Client, identity: Identity) {
  const ateliers = await client.atelier.findMany({
    where: identity.perimetre.toutesPlateformes
      ? {}
      : {
          OR: identity.perimetre.lignes.map((l) =>
            l.atelierId === null
              ? { plateformeId: l.plateformeId }
              : { id: l.atelierId, plateformeId: l.plateformeId },
          ),
        },
    include: { plateforme: { select: { idSiteCcf: true } } },
  })
  return ateliers.map((a) => ({ id: a.id, idSiteCcf: a.plateforme.idSiteCcf }))
}

/** Groupes d'un dossier, d'une prépa chapeau ou d'un groupe Broadcast, AVANT filtre par les règles d'atelier. */
async function construireGroupes(
  client: Client,
  critere: { preparation?: number; dossier?: number; groupe?: number },
): Promise<GroupeInterne[]> {
  const pb =
    critere.groupe !== undefined
      ? []
      : await client.prepaBroadcast.findMany({
          where: {
            idPreparationChapeau:
              critere.preparation !== undefined ? critere.preparation : { not: null },
            ...(critere.dossier !== undefined ? { idDossierDeVenteChapeau: critere.dossier } : {}),
          },
          orderBy: { id: 'asc' },
        })
  const contNums = new Set<number>(
    pb.map((l) => l.idDossierDeVenteChapeau).filter((c): c is number => c !== null),
  )
  if (critere.dossier !== undefined) contNums.add(critere.dossier)
  // RG-COO-143 / 277 / 278 (legacy `p_s_controle_rendumain(IdGroupePreparation)`) : le groupe est pris EN
  // ENTIER, toutes ses tranches dossier × semaine comprises, même hors du critère de recherche.
  const idGroupes =
    critere.groupe !== undefined
      ? [critere.groupe]
      : [
          ...new Set(
            (
              await client.repartition.findMany({
                where: { contNum: { in: [...contNums] }, idGroupePreparation: { not: null } },
                select: { idGroupePreparation: true },
              })
            )
              .map((r) => r.idGroupePreparation)
              .filter((g): g is number => g !== null),
          ),
        ]
  const reps = await client.repartition.findMany({
    where: { idGroupePreparation: { in: idGroupes } },
    include: {
      atelier: { include: { plateforme: { select: { id: true, nom: true, idSiteCcf: true } } } },
      unite: {
        include: {
          atelier: { include: { plateforme: { select: { nom: true } } } },
        },
      },
    },
    orderBy: { id: 'asc' },
  })
  // Lignes de l'état des réservations des dossiers du groupe (prépa chapeau, surface, site, quantité).
  const contNumsGroupes = [
    ...new Set(reps.map((r) => r.contNum).filter((c): c is number => c !== null)),
  ]
  const pbGroupes = await client.prepaBroadcast.findMany({
    where: {
      idDossierDeVenteChapeau: { in: contNumsGroupes },
      idPreparationChapeau: { not: null },
    },
    orderBy: { id: 'asc' },
  })
  const types = new Map(
    (await client.typePreparation.findMany({ select: { id: true, libelle: true } })).map((t) => [
      t.id,
      t.libelle,
    ]),
  )
  const plateformes = await client.plateforme.findMany({
    where: { idSiteCcf: { not: null } },
    select: { id: true, nom: true, idSiteCcf: true },
  })
  // RG-COO-142 : plateforme du site déduite du référentiel (site CCF de la plateforme), et non de la règle
  // codée en dur du legacy « site 39 → plateforme 1, sinon 2 » (Q-191 (11)).
  const plateformeDuSite = (site: number | null) =>
    site === null ? undefined : plateformes.find((p) => p.idSiteCcf === site)

  const groupes: GroupeInterne[] = []
  const pbUtilisees = new Set<number>()
  for (const idGroupe of idGroupes) {
    const rs = reps.filter(
      (r) =>
        r.idGroupePreparation === idGroupe &&
        r.contNum !== null &&
        r.semAnnee !== null &&
        r.semNum !== null,
    )
    const r0 = rs[0]
    if (!r0) continue
    // Tranches dossier × semaine du groupe, triées.
    const parTranche = new Map<string, typeof rs>()
    for (const r of rs) {
      const k = `${String(r.contNum).padStart(10, '0')}:${String(r.semAnnee)}:${String(r.semNum).padStart(2, '0')}`
      parTranche.set(k, [...(parTranche.get(k) ?? []), r])
    }
    const lignesPb: (typeof pbGroupes)[number][] = []
    const tranches = [...parTranche.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, tr]) => {
        const t0 = tr[0] ?? r0
        const typesTranche = new Set(tr.map((r) => r.typePreparationId))
        // HYPOTHÈSE Q-191 (1) : ligne de l'état des réservations = même dossier, semaine et type.
        const lp = pbGroupes.filter(
          (l) =>
            l.idDossierDeVenteChapeau === t0.contNum &&
            l.semAnnee === t0.semAnnee &&
            l.semNum === t0.semNum &&
            (typesTranche.has(null) || typesTranche.has(l.idTypePreparation)),
        )
        lignesPb.push(...lp)
        const actives = tr.filter((r) => r.statut !== 'ANNULE')
        return {
          contNum: t0.contNum ?? 0,
          semaine: { annee: t0.semAnnee ?? 0, semaine: t0.semNum ?? 0 },
          quantite: actives.reduce((x, r) => x + (r.qte ?? 0), 0),
          repartitionsActives: actives.length,
        }
      })
    lignesPb.forEach((l) => pbUtilisees.add(l.id))
    const l0 = lignesPb[0]
    const chapeau = l0?.idPreparationChapeau ?? null
    if (
      critere.preparation !== undefined &&
      !lignesPb.some((l) => l.idPreparationChapeau === critere.preparation)
    )
      continue
    const site = l0?.idSiteCcf ?? r0.atelier?.plateforme.idSiteCcf ?? null
    const plateforme = plateformeDuSite(site)
    const actives = rs.filter((r) => r.statut !== 'ANNULE')
    const unites = [
      ...new Map(
        rs
          .map((r) => r.unite)
          .filter((u): u is NonNullable<typeof u> => u !== null)
          .map((u) => [u.id, u]),
      ).values(),
    ]
    const bloquantes = unites.filter((u) => STATUTS_UM_BLOQUANTS.includes(u.statut))
    const etat = actives.length > 0 ? ('INTEGRE' as const) : ('DEBLOQUE' as const)
    const idTypePreparation = r0.typePreparationId ?? l0?.idTypePreparation ?? null
    const premiere = tranches[0]
    const cleGroupe: CleGroupe = { type: 'UM', idGroupe }
    groupes.push({
      cle: encoderCle(cleGroupe),
      cleGroupe,
      type: 'UM',
      etat,
      idPreparationChapeau: chapeau,
      idGroupePreparation: idGroupe,
      contNum: premiere?.contNum ?? 0,
      annonceur: l0?.annonceur ?? r0.annonceur,
      semaine: premiere?.semaine ?? { annee: 0, semaine: 0 },
      tranches,
      idSurface: l0?.idSurface ?? null,
      surface: l0?.surface ?? null,
      idSiteCcf: site,
      site: plateforme?.nom ?? r0.atelier?.plateforme.nom ?? null,
      plateformeId: plateforme?.id ?? r0.atelier?.plateforme.id ?? null,
      idTypePreparation,
      typePreparation: idTypePreparation === null ? null : (types.get(idTypePreparation) ?? null),
      quantite:
        actives.reduce((x, r) => x + (r.qte ?? 0), 0) ||
        (lignesPb.length ? lignesPb.reduce((x, l) => x + (l.quantite ?? 0), 0) : null),
      // RG-COO-142 (UM) : « En cours » si une UM existe pour le groupe, sinon « None ».
      statutPrepa: actives.some((r) => r.uniteId !== null) ? 'EN_COURS' : 'NONE',
      deblocable: etat === 'INTEGRE' && bloquantes.length === 0,
      motifBlocage:
        etat === 'DEBLOQUE'
          ? 'Groupe déjà débloqué : en attente du renvoi de la préparation par Broadcast.'
          : bloquantes.length
            ? MESSAGE_NON_DEBLOCABLE
            : null,
      regleBlocage: etat === 'DEBLOQUE' ? 'RG-COO-145' : bloquantes.length ? 'RG-COO-143' : null,
      unitesBloquantes: bloquantes.map((u) => ({
        id: u.id,
        plateforme: u.atelier?.plateforme.nom ?? null,
        atelier: u.atelier?.libelle ?? null,
        codeBarre: u.codeBarre,
        contNum: u.contNum,
        theme: u.theme,
        statut: u.statut,
      })),
      repartitionsActives: actives.length,
      repartitionIds: actives.map((r) => r.id),
    })
  }
  // TRAIN : groupes de l'état des réservations sans répartition Circé (déroulant).
  const parTrain = new Map<string, (typeof pb)[number][]>()
  for (const l of pb) {
    if (pbUtilisees.has(l.id) || l.idPreparationChapeau === null) continue
    if (l.idDossierDeVenteChapeau === null || l.semAnnee === null || l.semNum === null) continue
    const c: CleGroupe = {
      type: 'TRAIN',
      chapeau: l.idPreparationChapeau,
      contNum: l.idDossierDeVenteChapeau,
      annee: l.semAnnee,
      semaine: l.semNum,
      idSurface: l.idSurface,
      idTypePreparation: l.idTypePreparation,
      idSiteCcf: l.idSiteCcf,
    }
    const k = encoderCle(c)
    parTrain.set(k, [...(parTrain.get(k) ?? []), l])
  }
  for (const [k, ls] of parTrain) {
    const cleGroupe = decoderCle(k)
    const l0 = ls[0]
    if (!cleGroupe || cleGroupe.type !== 'TRAIN' || !l0) continue
    const controle = await controleTrain(client, cleGroupe)
    const plateforme = plateformeDuSite(cleGroupe.idSiteCcf)
    const derniere = await client.deblocagePreparation.findFirst({
      where: { cle: k },
      orderBy: { le: 'desc' },
    })
    // DEBLOQUE tant qu'aucune face n'a été (ré)intégrée depuis le dernier déblocage.
    const etat =
      derniere && !(controle.derniereFace && controle.derniereFace > derniere.le)
        ? ('DEBLOQUE' as const)
        : ('INTEGRE' as const)
    groupes.push({
      cle: k,
      cleGroupe,
      type: 'TRAIN',
      etat,
      idPreparationChapeau: cleGroupe.chapeau,
      idGroupePreparation: null,
      contNum: cleGroupe.contNum,
      annonceur: l0.annonceur,
      semaine: { annee: cleGroupe.annee, semaine: cleGroupe.semaine },
      tranches: [
        {
          contNum: cleGroupe.contNum,
          semaine: { annee: cleGroupe.annee, semaine: cleGroupe.semaine },
          quantite: ls.reduce((x, l) => x + (l.quantite ?? 0), 0),
          repartitionsActives: 0,
        },
      ],
      idSurface: cleGroupe.idSurface,
      surface: l0.surface,
      idSiteCcf: cleGroupe.idSiteCcf,
      site: plateforme?.nom ?? null,
      plateformeId: plateforme?.id ?? null,
      idTypePreparation: cleGroupe.idTypePreparation,
      typePreparation:
        cleGroupe.idTypePreparation === null
          ? null
          : (types.get(cleGroupe.idTypePreparation) ?? null),
      quantite: ls.reduce((s, l) => s + (l.quantite ?? 0), 0),
      statutPrepa: controle.supportsConnus ? (controle.lancee ? 'EN_COURS' : 'NONE') : null,
      deblocable: etat === 'INTEGRE' && controle.supportsConnus && !controle.lancee,
      motifBlocage:
        etat === 'DEBLOQUE'
          ? 'Groupe déjà débloqué : en attente du renvoi de la préparation par Broadcast.'
          : !controle.supportsConnus
            ? 'Contrôle impossible : correspondance des supports absente pour cette surface (aucune face rapprochable).'
            : controle.lancee
              ? `${MESSAGE_NON_DEBLOCABLE} Production lancée : ${String(controle.facesLancees)} face(s) au-delà de « En cours ».`
              : null,
      regleBlocage:
        etat === 'DEBLOQUE'
          ? 'RG-COO-145'
          : !controle.supportsConnus || controle.lancee
            ? 'RG-COO-144'
            : null,
      unitesBloquantes: [],
      repartitionsActives: 0,
      repartitionIds: [],
    })
  }
  return groupes.sort(
    (a, b) =>
      a.contNum - b.contNum ||
      a.semaine.annee - b.semaine.annee ||
      a.semaine.semaine - b.semaine.semaine ||
      a.cle.localeCompare(b.cle),
  )
}

// RG-COO-142 / 144 (HYPOTHÈSE Q-218 / Q-191 (4)) : faces du dossier × semaine sur les supports de la surface
// (correspondance surface × format → support) et sur un atelier déroulant (scroll) du site. Correspondance
// absente ⇒ contrôle impossible ⇒ refus explicite (et non fail-open comme le legacy).
async function controleTrain(client: Client, c: Extract<CleGroupe, { type: 'TRAIN' }>) {
  const supports =
    c.idSurface === null
      ? []
      : (
          await client.correspondanceSupport.findMany({
            where: { idSurface: c.idSurface },
            select: { supportId: true },
          })
        ).map((x) => x.supportId)
  if (supports.length === 0)
    return { supportsConnus: false, lancee: false, facesLancees: 0, derniereFace: null }
  const faces = await client.faceTrain.findMany({
    where: {
      contNum: c.contNum,
      contAnbas: c.annee,
      contSembas: c.semaine,
      supportId: { in: supports },
      atelier: {
        type: 'SCROLL',
        ...(c.idSiteCcf !== null ? { plateforme: { idSiteCcf: c.idSiteCcf } } : {}),
      },
    },
    select: { statut: true, createdAt: true, updatedAt: true },
  })
  const lancees = faces.filter((f) => !STATUTS_FACE_LIBRES.includes(f.statut))
  const derniereFace = faces.reduce<Date | null>(
    (m, f) => (m === null || f.createdAt > m ? f.createdAt : m),
    null,
  )
  return {
    supportsConnus: true,
    lancee: lancees.length > 0,
    facesLancees: lancees.length,
    derniereFace,
  }
}

async function groupesAutorises(client: Client, identity: Identity, groupes: GroupeInterne[]) {
  const ateliers = await ateliersUtilisateur(client, identity)
  const regles = await parPaquets(
    ateliers.map((a) => a.id),
    (paquet) =>
      client.atelierDroitPrepa.findMany({
        where: { atelierId: { in: paquet } },
        select: { atelierId: true, typePreparationId: true, surfaceId: true, exclusion: true },
      }),
  )
  const avertissements: string[] = []
  // RG-COO-141 : traces (le legacy les écrivait dans le journal technique).
  for (const a of ateliers) {
    if (!regles.some((r) => r.atelierId === a.id))
      avertissements.push(`Déblocage : aucune règle pour l'atelier ${String(a.id)}.`)
    else if (a.idSiteCcf === null)
      avertissements.push(
        `Déblocage : site CCF introuvable pour l'atelier ${String(a.id)} (atelier / plateforme incomplet).`,
      )
  }
  return {
    groupes: groupes.filter((g) => groupeAutorise(ateliers, regles, g)),
    avertissements,
  }
}

// ───────────────────────────── Services ─────────────────────────────

const exposer = (g: GroupeInterne): GroupeDeblocable => ({
  cle: g.cle,
  type: g.type,
  etat: g.etat,
  idPreparationChapeau: g.idPreparationChapeau,
  idGroupePreparation: g.idGroupePreparation,
  contNum: g.contNum,
  annonceur: g.annonceur,
  semaine: g.semaine,
  tranches: g.tranches,
  idSurface: g.idSurface,
  surface: g.surface,
  idSiteCcf: g.idSiteCcf,
  site: g.site,
  idTypePreparation: g.idTypePreparation,
  typePreparation: g.typePreparation,
  quantite: g.quantite,
  statutPrepa: g.statutPrepa,
  deblocable: g.deblocable,
  motifBlocage: g.motifBlocage,
  regleBlocage: g.regleBlocage,
  unitesBloquantes: g.unitesBloquantes,
  repartitionsActives: g.repartitionsActives,
})

// RG-COO-140 / 141 / 142 / 152 : recherche des groupes débloquables (lecture seule).
export async function rechercherDeblocables(
  db: Db,
  identity: Identity,
  q: RechercheDeblocageQuery,
): Promise<ResultatRechercheDeblocage> {
  assertDroitCoordination(identity, 'deblocage.consulter', 'RG-COO-152')
  // RG-COO-140 : aucun critère ⇒ grille vide (aucun chargement massif).
  if (q.preparation === undefined && q.dossier === undefined)
    return {
      groupes: [],
      message: 'Saisissez un n° de préparation ou de dossier.',
      avertissements: [],
    }
  const { groupes, avertissements } = await groupesAutorises(
    db,
    identity,
    await construireGroupes(db, q),
  )
  return {
    groupes: groupes.map(exposer),
    message: groupes.length ? null : 'Aucune préparation débloquable pour ces critères.',
    avertissements,
  }
}

// RG-COO-145 / 146 / 147 / 151 / 152 / 277 / 278 / RG-X-059 : « Rendre la main à la Pré-Prod » (déblocage d'un
// groupe de préparation) dans UNE transaction (celle de l'appelant).
export async function debloquerGroupe(tx: Tx, identity: Identity, input: DebloquerGroupe) {
  assertDroitCoordination(identity, 'deblocage.executer', 'RG-COO-152')
  const cle = decoderCle(input.cle)
  if (!cle) throw new ValidationError('Groupe de préparation inconnu (clé invalide).')
  const tous = await construireGroupes(
    tx,
    cle.type === 'UM' ? { groupe: cle.idGroupe } : { dossier: cle.contNum },
  )
  const brut = tous.find((g) => g.cle === input.cle)
  if (!brut) throw new NotFoundError('Groupe de préparation introuvable')
  // RG-COO-141 / 167 : le groupe doit être visible de l'utilisateur (règles d'atelier, périmètre).
  if (!(await groupesAutorises(tx, identity, [brut])).groupes.length)
    throw new ForbiddenError(
      "Ce groupe de préparation n'est pas dans le périmètre de vos ateliers.",
      { ...COO.perimetre, regle: 'RG-COO-141' },
    )
  const g = brut
  // §3.2.e : INTEGRE → DEBLOQUE seulement.
  if (g.etat === 'DEBLOQUE')
    throw new ConflictError(
      'Ce groupe de préparation est déjà débloqué : en attente du renvoi par Broadcast.',
      { code: 'TRANSITION_INTERDITE', regle: 'RG-COO-145' },
    )
  // RG-COO-143 / 277 (UM ≥ 6) ; RG-COO-144 (faces lancées ou correspondance absente).
  if (!g.deblocable)
    throw new BusinessError(g.motifBlocage ?? MESSAGE_NON_DEBLOCABLE, {
      code: 'COO_GROUPE_NON_DEBLOCABLE',
      regle: g.regleBlocage ?? 'RG-COO-143',
      details: { unites: g.unitesBloquantes },
    })
  const motif = input.motif?.trim() || MOTIF_RENDRE_MAIN_DEFAUT
  // RG-COO-278 : répartitions du groupe (statut ≠ 4) → ANNULE, puis leurs UM (statut ≠ 4) → ANNULE ; colis
  // non touchés ; utilisateur tracé (le legacy l'écrivait vide).
  const reps = await tx.repartition.findMany({
    where: { id: { in: g.repartitionIds }, statut: { not: 'ANNULE' } },
  })
  for (const r of reps) {
    await updateWithVersion({
      expectedVersion: r.version,
      update: (where) =>
        tx.repartition.updateMany({
          where: { id: r.id, ...where },
          data: { statut: 'ANNULE', updatedById: identity.userId, ...bumpVersion },
        }),
      ...COO.version,
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'REPARTITION',
      entiteId: r.id,
      ancien: r.statut,
      nouveau: 'ANNULE',
      parId: identity.userId,
      motif,
      regle: 'RG-COO-278',
    })
  }
  const umIds = [...new Set(reps.map((r) => r.uniteId).filter((u): u is number => u !== null))]
  const unites = await tx.uniteManutention.findMany({
    where: { id: { in: umIds }, statut: { not: 'ANNULE' } },
  })
  for (const u of unites) {
    // RG-COO-143 revérifié dans la transaction (une UM a pu passer « Préparé » entre-temps).
    if (STATUTS_UM_BLOQUANTS.includes(u.statut))
      throw new BusinessError(MESSAGE_NON_DEBLOCABLE, {
        code: 'COO_GROUPE_NON_DEBLOCABLE',
        regle: 'RG-COO-143',
      })
    await updateWithVersion({
      expectedVersion: u.version,
      update: (where) =>
        tx.uniteManutention.updateMany({
          where: { id: u.id, ...where },
          data: { statut: 'ANNULE', updatedById: identity.userId, ...bumpVersion },
        }),
      ...COO.version,
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'UNITE_MANUTENTION',
      entiteId: u.id,
      ancien: u.statut,
      nouveau: 'ANNULE',
      parId: identity.userId,
      motif,
      regle: 'RG-COO-278',
    })
  }
  // RG-COO-147 (HYPOTHÈSE Q-219) : destinataires = adresses de la plateforme du site ; Q-375 : non envoyé.
  const plateforme =
    g.plateformeId === null
      ? null
      : await tx.plateforme.findUnique({ where: { id: g.plateformeId }, select: { mail: true } })
  const destinataires = (plateforme?.mail ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  const mailStatut = destinataires.length ? 'NON_ENVOYE' : 'SANS_DESTINATAIRE'
  const sujet =
    `Déblocages - groupe préparation ${String(g.idGroupePreparation ?? g.idPreparationChapeau ?? '—')} Contrat ${String(g.contNum)} ${g.annonceur ?? ''}`.trim()
  // RG-COO-146 : trace (th_repart_annule + historique DebloquerPreparation), même transaction.
  const trace = await tx.deblocagePreparation.create({
    data: {
      cle: g.cle,
      type: g.type,
      idGroupePreparation: g.idGroupePreparation,
      idPreparationChapeau: g.idPreparationChapeau,
      contNum: g.contNum,
      semAnnee: g.semaine.annee,
      semNum: g.semaine.semaine,
      idSiteCcf: g.idSiteCcf,
      plateformeId: g.plateformeId,
      idSurface: g.idSurface,
      idTypePreparation: g.idTypePreparation,
      libelleType: g.typePreparation,
      annonceur: g.annonceur,
      quantite: g.quantite,
      motif,
      repartitions: JSON.stringify(reps.map((r) => r.id)),
      unites: JSON.stringify(unites.map((u) => u.id)),
      mailStatut,
      mailDestinataires: destinataires.join(', ') || null,
      parId: identity.userId,
    },
  })
  // Historique de CHAQUE dossier du groupe (un groupe Broadcast peut couvrir plusieurs dossiers / semaines).
  const dossiers = [...new Set(g.tranches.map((t) => t.contNum))]
  // RG-COO-147 (D-19, Q-219, Q-409) : mail mis en file dans cette transaction ; l'envoi se fait après le commit.
  if (destinataires.length)
    await mettreEnFileMail(tx, {
      type: 'DEBLOCAGE',
      cle: `DEBLOCAGE:${String(trace.id)}`,
      source: { type: 'DEBLOCAGE', id: trace.id },
      destinataires,
      sujet,
      corps: [
        `Main rendue à la Pré-Prod : ${motif}`,
        ...g.tranches.map(
          (t) =>
            `Dossier ${String(t.contNum)} - semaine ${String(t.semaine.semaine).padStart(2, '0')}/${String(t.semaine.annee)}`,
        ),
        `Répartitions annulées : ${String(reps.length)} ; unités annulées : ${String(unites.length)}`,
        `Par : ${identity.nom ?? identity.identifiantExterne}`,
      ].join('\n'),
      parId: identity.userId,
    })
  for (const contNum of dossiers)
    await ecrireJournal(tx, {
      typeEntite: 'DOSSIER',
      entiteId: contNum,
      action: 'DEBLOQUER_PREPARATION',
      parId: identity.userId,
      nouvelleValeur: `Main rendue à la Pré-Prod : ${motif}`,
      complement: 'RG-COO-145 / RG-COO-151',
      donnees: {
        deblocageId: trace.id,
        cle: g.cle,
        tranches: g.tranches,
        repartitions: reps.length,
        unites: unites.length,
        mail: { statut: mailStatut, destinataires, sujet },
      },
    })
  // RG-COO-145 (HYPOTHÈSE Q-191 (3)) : la demande `P_CirceDebloquerGroupePreparation` est mise en file dans la
  // même transaction (rejouée par le passage d'intégration) ; l'appel réel est BLOQUÉ (Q-005).
  await mettreEnFile(
    tx,
    {
      type: 'DEBLOQUER_GROUPE',
      cle: g.cle,
      donnees: {
        idGroupePreparation: g.idGroupePreparation,
        idPreparationChapeau: g.idPreparationChapeau,
        contNum: g.contNum,
        dossiers,
        utilisateur: identity.nom ?? identity.identifiantExterne,
      },
    },
    identity.userId,
  )
  return {
    deblocageId: trace.id,
    repartitionsAnnulees: reps.length,
    unitesAnnulees: unites.length,
    mailEnvoye: false,
    message:
      `Main rendue à la Pré-Prod pour le ${dossiers.length > 1 ? 'groupe de préparation' : 'dossier'} ${g.tranches.map((t) => `${String(t.contNum)} (S${String(t.semaine.semaine).padStart(2, '0')})`).join(', ')} : ${String(reps.length)} répartition(s) et ${String(unites.length)} UM annulée(s). ` +
      'Broadcast peut renvoyer la préparation ; la validation admin et les affiches reçues sont inchangées. ' +
      (destinataires.length
        ? 'Mail à la plateforme mis en file d’envoi (Q-375, Q-409).'
        : 'Aucune adresse mail pour cette plateforme : mail non envoyé.'),
  }
}

const jour = (d: Date) => d.toISOString().slice(0, 10)

// RG-COO-149 / 152 : suivi des déblocages (« Préparations débloquées »), période par défaut = le dernier mois.
export async function listerDeblocages(
  db: Db,
  identity: Identity,
  q: SuiviDeblocageQuery,
  maintenant = new Date(),
) {
  assertDroitCoordination(identity, 'deblocage.consulter', 'RG-COO-152')
  const au = q.au ?? jour(maintenant)
  // RG-COO-149 : « le dernier mois » = même jour du mois précédent, borné au dernier jour de ce mois
  // (un 31 mars donne le 28 / 29 février, jamais le 3 mars : ANO-038).
  const an = maintenant.getUTCFullYear()
  const mois = maintenant.getUTCMonth() - 1
  const dernierJour = new Date(Date.UTC(an, mois + 1, 0)).getUTCDate()
  const du =
    q.du ?? jour(new Date(Date.UTC(an, mois, Math.min(maintenant.getUTCDate(), dernierJour))))
  if (au < du)
    throw new BusinessError('La date de fin doit être supérieur à la date de début !', {
      code: 'COO_PERIODE_INVALIDE',
      regle: 'RG-COO-149',
    })
  const fin = new Date(`${au}T00:00:00.000Z`)
  fin.setUTCDate(fin.getUTCDate() + 1)
  const lignes = await db.deblocagePreparation.findMany({
    where: {
      le: { gte: new Date(`${du}T00:00:00.000Z`), lt: fin },
      ...(identity.perimetre.toutesPlateformes
        ? {}
        : { plateformeId: { in: identity.perimetre.plateformeIds } }),
    },
    orderBy: { le: 'desc' },
  })
  const noms = new Map(
    (
      await db.utilisateur.findMany({
        where: { id: { in: [...new Set(lignes.map((l) => l.parId))] } },
        select: { id: true, nom: true, identifiantExterne: true },
      })
    ).map((u) => [u.id, u.nom ?? u.identifiantExterne]),
  )
  const sites = new Map(
    (
      await db.plateforme.findMany({
        where: {
          id: { in: lignes.map((l) => l.plateformeId).filter((x): x is number => x !== null) },
        },
        select: { id: true, nom: true },
      })
    ).map((p) => [p.id, p.nom]),
  )
  return {
    du,
    au,
    deblocages: lignes.map((l) => ({
      id: l.id,
      le: l.le.toISOString(),
      par: noms.get(l.parId) ?? null,
      type: l.type as 'UM' | 'TRAIN',
      idPreparationChapeau: l.idPreparationChapeau,
      idGroupePreparation: l.idGroupePreparation,
      contNum: l.contNum,
      annonceur: l.annonceur,
      semaine: { annee: l.semAnnee, semaine: l.semNum },
      // RG-COO-149 : site traduit (TranscoderLibelleSiteCCF → nom de la plateforme).
      site: l.plateformeId === null ? null : (sites.get(l.plateformeId) ?? null),
      typePreparation: libelleTypeSuivi(l.libelleType),
      quantite: l.quantite,
      motif: l.motif,
      repartitionsAnnulees: (JSON.parse(l.repartitions) as number[]).length,
      unitesAnnulees: (JSON.parse(l.unites) as number[]).length,
      mailStatut: l.mailStatut,
    })),
  }
}
