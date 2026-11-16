// COO-P05 — lecture des lignes attendues : état des réservations vivant (ECR-PIL-03, RG-COO-101, 107, 108),
// suivi de production (RG-COO-105, 106) et suppression interdite (RG-COO-089). Lecture seule.
import {
  comparerSemaines,
  ETAPES_RESERVATION,
  formatSemaineIso,
  lireSemaineIso,
  lundiSemaineIso,
  PHASES_RESERVATION,
  semaineIsoDe,
  type EtapeReservation,
  type GrainReservations,
  type LigneReservation,
  type ReservationsQuery,
} from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { assertPlateforme } from '../../core/permissions/permissions.ts'
import type { StatutProduction } from '../../generated/prisma/client.ts'
import { attenduDe } from '../reception/lignes.ts'
import { lireParametreTexte } from '../reception/parametres.ts'
import { numeroVisibleSuiviProd, marqueEtatReservations } from './effets-validation.ts'
import {
  assertDroitCoordination,
  assertPerimetreAtelier,
  COO,
  peutVoirAtelier,
} from './permissions.ts'
import { normaliserTheme } from './validation-admin.ts'

const RANG = new Map<EtapeReservation, number>(ETAPES_RESERVATION.map((e, i) => [e, i]))
const rang = (e: EtapeReservation) => RANG.get(e) ?? 0

/** RG-COO-107 : un groupe compte à l'étape la MOINS avancée de ses lignes (Annulé seulement si tout l'est). */
export function etapeMoinsAvancee(etapes: EtapeReservation[]): EtapeReservation {
  const actives = etapes.filter((e) => e !== 'ANNULE')
  if (actives.length === 0) return 'ANNULE'
  return actives.reduce((a, b) => (rang(b) < rang(a) ? b : a))
}

// RG-COO-107 : « Où en est-il » d'une ligne attendue (HYPOTHÈSE Q-187 (5) pour la production : toutes les
// unités « Terminé » → Expédié ; toutes « À expédier » ou au-delà → Produit ; sinon Prêt ou en production ;
// « Livré » exige la preuve de livraison, non disponible en V2).
export function etapeLigne(l: {
  annulee: boolean
  provisoire: boolean
  source: 'BC' | 'PREPA'
  attendu: number
  recu: number
  toutesValidees: boolean
  production: StatutProduction[]
}): EtapeReservation {
  if (l.annulee) return 'ANNULE'
  if (l.provisoire) return 'DA_ACTIVEE'
  if (l.source === 'BC') return 'IP_SAISIES'
  if (l.recu <= 0) return 'PREPA_RECUE'
  if (l.recu < l.attendu) return 'RECUES_EN_PARTIE'
  if (!l.toutesValidees) return 'VALIDATION_A_CONFIRMER'
  const prod = l.production.filter((s) => s !== 'ANNULE')
  if (prod.length > 0 && prod.every((s) => s === 'TERMINE')) return 'EXPEDIE'
  if (prod.length > 0 && prod.every((s) => s === 'A_EXPEDIER' || s === 'TERMINE')) return 'PRODUIT'
  return 'EN_PRODUCTION'
}

function afficheRecue(statut: string, attendu: number, recu: number) {
  if (attendu <= 0) return recu > 0 ? ('SANS_ATTENDU' as const) : null
  return (
    { ATTENDUE: 'NON', PARTIELLE: 'PARTIELLE', COMPLETE: 'OUI', SURPLUS: 'OUI_SURPLUS' } as const
  )[statut as 'ATTENDUE' | 'PARTIELLE' | 'COMPLETE' | 'SURPLUS']
}

const cleProd = (
  contNum: number | null,
  supportId: number | null,
  theme: string | null,
  a: number | null,
  s: number | null,
) => [contNum ?? 0, supportId ?? 0, normaliserTheme(theme), a ?? 0, s ?? 0].join('|')

interface LigneFine {
  id: number
  plateformeId: number
  plateforme: string
  contNum: number | null
  dossierId: number | null
  annonceur: string | null
  supportId: number
  format: string
  theme: string | null
  themeCle: string
  idThemeBandeau: number | null
  semaine: { annee: number; semaine: number }
  attendu: number
  recu: number
  statut: string
  ou: EtapeReservation
  numeros: { id: number; marque: '✓' | '•' }[]
}

/** Deadline Pré-Prod (RG-COO-066 / 076, paramètre « semaines relatives;jour ISO;hh:mm », défaut « -2;4;16:00 » =
 * jeudi S-2 16 h). HYPOTHÈSE Q-187 (15) : heure calculée en UTC (le fuseau des plateformes n'est pas modélisé). */
export function lireDeadline(valeur: string) {
  const [s, j, h] = valeur.split(';').map((x) => x.trim())
  const [hh, mm] = (h ?? '16:00').split(':').map(Number)
  return (depart: { annee: number; semaine: number }) => {
    const lundi = lundiSemaineIso(depart)
    const jours = Number(s ?? -2) * 7 + (Number(j ?? 4) - 1)
    return new Date(lundi.getTime() + jours * 86_400_000 + ((hh ?? 16) * 60 + (mm ?? 0)) * 60_000)
  }
}

// ECR-PIL-03 : liseré de la ligne (maquette `tone`), sur le premier départ du groupe.
export function lisereDe(
  l: { ou: EtapeReservation; departs: string[] },
  maintenant: Date,
  courante: { annee: number; semaine: number },
  deadline: (s: { annee: number; semaine: number }) => Date,
): 'critique' | 'surveiller' | 'info' | 'ok' | null {
  const premier = l.departs[0] ? lireSemaineIso(l.departs[0]) : null
  if (premier) {
    if ((l.ou === 'DA_ACTIVEE' || l.ou === 'IP_SAISIES') && maintenant > deadline(premier))
      return 'critique'
    if (l.ou === 'PREPA_RECUE' && comparerSemaines(premier, courante) <= 0) return 'critique'
  }
  if (l.ou === 'DA_ACTIVEE' || l.ou === 'RECUES_EN_PARTIE') return 'surveiller'
  if (l.ou === 'VALIDATION_A_CONFIRMER') return 'info'
  if ((PHASES_RESERVATION.produitsOuExpedies as readonly string[]).includes(l.ou)) return 'ok'
  return null
}

/** Agrégat d'un groupe de lignes fines (attendu passé en paramètre : compté une fois par thème). */
function agreger(
  cle: string,
  lignes: LigneFine[],
  attendu: number,
  grain: GrainReservations,
): LigneReservation {
  const premiere = lignes[0]
  const recu = lignes.reduce((s, l) => s + l.recu, 0)
  const departs = [...new Set(lignes.map((l) => formatSemaineIso(l.semaine)))].sort()
  const dossiers = new Set(lignes.map((l) => l.contNum))
  const themes = new Set(
    lignes.map((l) => `${String(l.contNum)}|${l.themeCle}|${String(l.idThemeBandeau ?? 0)}`),
  )
  const numeros = new Map<number, '✓' | '•'>()
  for (const l of lignes) for (const x of l.numeros) numeros.set(x.id, x.marque)
  const ou = etapeMoinsAvancee(lignes.map((l) => l.ou))
  const visuels = [...new Set(lignes.map((l) => l.theme))]
  const statuts = lignes.filter((l) => l.ou !== 'ANNULE')
  return {
    cle,
    dossier: grain === 'FORMAT' || dossiers.size !== 1 ? null : (premiere?.contNum ?? null),
    dossierId: dossiers.size === 1 ? (premiere?.dossierId ?? null) : null,
    dossiers: dossiers.size,
    themes: themes.size,
    annonceur:
      new Set(lignes.map((l) => l.annonceur)).size === 1 ? (premiere?.annonceur ?? null) : null,
    visuel: visuels.length === 1 ? (visuels[0] ?? null) : null,
    format: new Set(lignes.map((l) => l.format)).size === 1 ? (premiere?.format ?? null) : null,
    plateforme:
      new Set(lignes.map((l) => l.plateforme)).size === 1 ? (premiere?.plateforme ?? null) : null,
    departs,
    ou,
    attendu,
    recu,
    resteARecevoir: Math.max(0, attendu - recu),
    afficheRecue:
      ou === 'ANNULE'
        ? null
        : statuts.length === 1 && statuts[0]
          ? afficheRecue(statuts[0].statut, attendu, recu)
          : afficheRecue(
              recu === 0 ? 'ATTENDUE' : recu < attendu ? 'PARTIELLE' : 'COMPLETE',
              attendu,
              recu,
            ),
    numerosAffiche: [...numeros.entries()]
      .map(([id, marque]) => ({ id, marque }))
      .sort((a, b) => a.id - b.id),
    lisere: null,
    reperes: [
      ...(departs.length > 1 ? (['MULTI_SEMAINES'] as const) : []),
      ...(lignes.some((l) => l.theme === null && l.ou === 'DA_ACTIVEE')
        ? (['PROVISOIRE'] as const)
        : []),
    ],
  }
}

// RG-COO-107 / 108 / 101 : état des réservations vivant, une base (lignes attendues de la semaine en cours et
// suivantes), des vues (« Afficher par »). Filtres sur les lignes fines puis regroupement ; quantité d'un
// thème sur plusieurs semaines comptée une fois (HYPOTHÈSE Q-187 (3) : attendu du thème = max des semaines).
export async function etatReservations(db: Db, identity: Identity, q: ReservationsQuery) {
  assertDroitCoordination(identity, 'reservations.consulter')
  // RG-COO-108 : plateformes gérées du périmètre ; le site choisi est revérifié côté serveur.
  if (q.plateformeId !== undefined)
    assertPlateforme(identity, q.plateformeId, { ...COO.perimetre, regle: 'RG-COO-108' })
  const perimetre = identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds
  const plateformes =
    q.plateformeId !== undefined ? [q.plateformeId] : perimetre === null ? undefined : perimetre
  const courante = semaineIsoDe(new Date())
  const lignes = await db.receptionAttendue.findMany({
    where: {
      ...(plateformes ? { plateformeId: { in: plateformes } } : {}),
      plateforme: { idSiteCcf: { not: null } },
      ...(q.dossier !== undefined ? { contNum: q.dossier } : {}),
      ...(q.atelierId !== undefined ? { atelierId: q.atelierId } : {}),
      OR: [
        { semAnnee: { gt: courante.annee } },
        { semAnnee: courante.annee, semNum: { gte: courante.semaine } },
      ],
    },
    include: {
      plateforme: { select: { nom: true } },
      support: { select: { nom: true } },
      rattachements: {
        where: { actif: true },
        select: { quantite: true, affiche: { select: { id: true, validationAdmin: true } } },
      },
    },
  })
  const contNums = [...new Set(lignes.map((l) => l.contNum).filter((x): x is number => x !== null))]
  const dossiers = await parPaquets(contNums, (paquet) =>
    db.dossier.findMany({
      where: { contNum: { in: paquet } },
      select: { id: true, contNum: true, statut: true },
    }),
  )
  const dossierDe = new Map(dossiers.map((d) => [d.contNum, d]))
  // RG-COO-106 : statut d'une répartition = celui de son UM si elle existe.
  const production = new Map<string, StatutProduction[]>()
  const ajouter = (k: string, s: StatutProduction) =>
    production.set(k, [...(production.get(k) ?? []), s])
  for (const r of await parPaquets(contNums, (paquet) =>
    db.repartition.findMany({
      where: { contNum: { in: paquet } },
      include: { unite: { select: { statut: true } } },
    }),
  ))
    ajouter(
      cleProd(r.contNum, r.supportId, r.theme, r.semAnnee, r.semNum),
      r.unite?.statut ?? r.statut,
    )
  for (const f of await parPaquets(contNums, (paquet) =>
    db.faceTrain.findMany({ where: { contNum: { in: paquet } } }),
  ))
    ajouter(cleProd(f.contNum, f.supportId, f.theme, f.depAnbas, f.depSembas), f.statut)

  const annonceur = q.annonceur ? normaliserTheme(q.annonceur) : null
  const depart = q.depart ? lireSemaineIso(q.depart) : null
  const fines: LigneFine[] = []
  for (const l of lignes) {
    const dossier = l.contNum !== null ? dossierDe.get(l.contNum) : undefined
    const annulee = l.etatLigne === 'ANNULEE' || dossier?.statut === 'ANNULE'
    // Une ligne fermée (visuel provisoire remplacé, ligne plus vue) n'apparaît que si le dossier est annulé.
    if (l.etatLigne === 'ANNULEE' && dossier?.statut !== 'ANNULE') continue
    const semaine = { annee: l.semAnnee, semaine: l.semNum }
    if (depart && comparerSemaines(semaine, depart) !== 0) continue
    if (annonceur && !normaliserTheme(l.annonceur).includes(annonceur)) continue
    const attendu = annulee ? 0 : attenduDe(l)
    const recu = l.rattachements.reduce((s, r) => s + r.quantite, 0)
    fines.push({
      id: l.id,
      plateformeId: l.plateformeId,
      plateforme: l.plateforme.nom,
      contNum: l.contNum,
      dossierId: dossier?.id ?? null,
      annonceur: l.annonceur,
      supportId: l.supportId,
      format: l.support.nom,
      theme: l.theme,
      themeCle: l.themeCle ?? '',
      idThemeBandeau: l.idThemeBandeau,
      semaine,
      attendu,
      recu,
      statut: l.statut,
      ou: etapeLigne({
        annulee,
        provisoire: l.theme === null,
        source: l.source,
        attendu,
        recu,
        toutesValidees: l.rattachements.every((r) => r.affiche.validationAdmin),
        production:
          production.get(cleProd(l.contNum, l.supportId, l.theme, l.semAnnee, l.semNum)) ?? [],
      }),
      // RG-COO-026 / 107 : « ✓ » validée, « • » proposée à confirmer, dès la réception.
      numeros: l.rattachements.map((r) => ({
        id: r.affiche.id,
        marque: marqueEtatReservations(r.affiche.validationAdmin),
      })),
    })
  }

  // RG-COO-101 : grain thème = (plateforme × dossier × support × thème × bandeau), toutes semaines confondues ;
  // l'attendu est compté une fois (max des semaines), le reçu une fois (somme des liens).
  const parTheme = new Map<string, LigneFine[]>()
  for (const l of fines) {
    const k = [l.plateformeId, l.contNum ?? 0, l.supportId, l.themeCle, l.idThemeBandeau ?? 0].join(
      '|',
    )
    parTheme.set(k, [...(parTheme.get(k) ?? []), l])
  }
  const themes = [...parTheme.entries()].map(([k, ls]) =>
    agreger(k, ls, Math.max(0, ...ls.map((l) => l.attendu)), 'THEME'),
  )

  // Indicateurs (phases) : par dossier, à l'étape la moins avancée de ses lignes ; dossiers annulés exclus.
  const etapeDossier = new Map<number, EtapeReservation[]>()
  for (const t of themes)
    if (t.dossier !== null)
      etapeDossier.set(t.dossier, [...(etapeDossier.get(t.dossier) ?? []), t.ou])
  const phases = [...etapeDossier.values()].map(etapeMoinsAvancee).filter((e) => e !== 'ANNULE')
  const compte = (...e: EtapeReservation[]) => phases.filter((x) => e.includes(x)).length
  // ECR-PIL-03 (maquette `PHASES`, Q-187 (6)) : « validation admin à confirmer » compte en pré-production.
  const indicateurs = {
    dossiers: phases.length,
    enPreProduction: compte(...PHASES_RESERVATION.enPreProduction),
    affichesAttendues: compte(...PHASES_RESERVATION.affichesAttendues),
    enProduction: compte(...PHASES_RESERVATION.enProduction),
    produitsOuExpedies: compte(...PHASES_RESERVATION.produitsOuExpedies),
  }

  // « Afficher par » : regroupement des lignes de grain thème.
  let lignesGrain: LigneReservation[]
  if (q.grain === 'THEME') lignesGrain = themes
  else {
    const cleDe = (l: LigneFine) =>
      q.grain === 'DOSSIER'
        ? String(l.contNum ?? 0)
        : q.grain === 'DA'
          ? [l.contNum ?? 0, l.supportId, l.plateformeId].join('|')
          : String(l.supportId)
    const groupes = new Map<string, { lignes: LigneFine[]; themes: Set<string> }>()
    for (const [kTheme, ls] of parTheme)
      for (const l of ls) {
        const g = groupes.get(cleDe(l)) ?? { lignes: [], themes: new Set() }
        g.lignes.push(l)
        g.themes.add(kTheme)
        groupes.set(cleDe(l), g)
      }
    lignesGrain = [...groupes.entries()].map(([k, g]) => {
      const attendu = [...g.themes].reduce(
        (s, kt) => s + Math.max(0, ...(parTheme.get(kt) ?? []).map((l) => l.attendu)),
        0,
      )
      return agreger(k, g.lignes, attendu, q.grain)
    })
  }
  const maintenant = new Date()
  const deadline = lireDeadline(await lireParametreTexte(db, 'coordination.deadlinePrepa'))
  const filtrees = lignesGrain
    .map((l) => ({ ...l, lisere: lisereDe(l, maintenant, courante, deadline) }))
    .filter((l) => q.ou === undefined || q.ou.includes(l.ou))
    .sort(
      (a, b) =>
        (a.departs[0] ?? '').localeCompare(b.departs[0] ?? '') ||
        (a.dossier ?? 0) - (b.dossier ?? 0) ||
        (a.visuel ?? '').localeCompare(b.visuel ?? ''),
    )
  const totaux = filtrees.reduce(
    (t, l) => ({
      attendu: t.attendu + l.attendu,
      recu: t.recu + l.recu,
      resteARecevoir: t.resteARecevoir + l.resteARecevoir,
    }),
    { attendu: 0, recu: 0, resteARecevoir: 0 },
  )
  const debut = (q.page - 1) * q.pageSize
  return {
    items: filtrees.slice(debut, debut + q.pageSize),
    total: filtrees.length,
    page: q.page,
    pageSize: q.pageSize,
    indicateurs,
    totaux,
  }
}

// RG-COO-105 / 106 : suivi de production — seules les lignes de source PREPA (les attendues « Broadcast »
// n'y apparaissent pas) ; n° d'affiche validée (RG-COO-021) ; répartitions (statut de l'UM s'il existe) et
// faces de trains ; limité aux ateliers de l'utilisateur (RG-COO-167). Le détail d'écran est ECR-PIL-02.
export async function suiviProduction(
  db: Db,
  identity: Identity,
  q: { atelierId?: number | undefined; dossier?: number | undefined },
) {
  assertDroitCoordination(identity, 'suivi_production.consulter')
  if (q.atelierId !== undefined) {
    const atelier = await db.atelier.findUnique({
      where: { id: q.atelierId },
      select: { id: true, plateformeId: true },
    })
    if (!atelier) throw new NotFoundError('Atelier introuvable')
    assertPerimetreAtelier(identity, atelier)
  }
  const lignes = await db.receptionAttendue.findMany({
    where: {
      source: 'PREPA',
      etatLigne: 'ACTIVE',
      atelierId: q.atelierId ?? { not: null },
      ...(q.dossier !== undefined ? { contNum: q.dossier } : {}),
    },
    include: {
      atelier: { select: { id: true, plateformeId: true } },
      support: { select: { nom: true } },
      rattachements: {
        where: { actif: true },
        select: { quantite: true, affiche: { select: { id: true, validationAdmin: true } } },
      },
    },
    orderBy: [{ semAnnee: 'asc' }, { semNum: 'asc' }, { contNum: 'asc' }, { id: 'asc' }],
  })
  const visibles = lignes.filter((l) => peutVoirAtelier(identity, l.atelier))
  const contNums = [
    ...new Set(visibles.map((l) => l.contNum).filter((x): x is number => x !== null)),
  ]
  const repartitions = await parPaquets(contNums, (paquet) =>
    db.repartition.findMany({
      where: { contNum: { in: paquet } },
      include: {
        unite: { select: { statut: true } },
        destinataire: { select: { nom: true, nomOrigine: true } },
      },
      orderBy: { id: 'asc' },
    }),
  )
  const faces = await parPaquets(contNums, (paquet) =>
    db.faceTrain.findMany({ where: { contNum: { in: paquet } } }),
  )
  return {
    items: visibles.map((l) => {
      const k = cleProd(l.contNum, l.supportId, l.theme, l.semAnnee, l.semNum)
      const parStatut = new Map<string, number>()
      for (const f of faces.filter(
        (f) => cleProd(f.contNum, f.supportId, f.theme, f.depAnbas, f.depSembas) === k,
      ))
        parStatut.set(f.statut, (parStatut.get(f.statut) ?? 0) + 1)
      return {
        ligneAttendueId: l.id,
        dossier: l.contNum,
        annonceur: l.annonceur,
        theme: l.theme,
        format: l.support.nom,
        atelierId: l.atelierId,
        depart: formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }),
        attendu: attenduDe(l),
        recu: l.rattachements.reduce((s, r) => s + r.quantite, 0),
        numerosAffiche: l.rattachements
          .filter((r) =>
            numeroVisibleSuiviProd({ validee: r.affiche.validationAdmin, sources: ['PREPA'] }),
          )
          .map((r) => r.affiche.id),
        repartitions: repartitions
          .filter((r) => cleProd(r.contNum, r.supportId, r.theme, r.semAnnee, r.semNum) === k)
          .map((r) => ({
            id: r.id,
            statut: r.unite?.statut ?? r.statut,
            qte: r.qte,
            destinataire: r.destinataire ? (r.destinataire.nom ?? r.destinataire.nomOrigine) : null,
          })),
        faces: [...parStatut.entries()].map(([statut, nombre]) => ({ statut, nombre })),
      }
    }),
  }
}

// RG-COO-089 : une ligne attendue n'est JAMAIS supprimée ; la fermeture (ANNULEE + date) est la seule voie.
// HYPOTHÈSE Q-187 (9) : le droit vérifié est celui de la gestion des lignes par la Coordination
// (`alimentation.manuelle` : coord, admin) ; les autres profils reçoivent 403 avant tout.
export async function supprimerLigneAttendue(
  db: Db,
  identity: Identity,
  id: number,
): Promise<never> {
  assertDroitCoordination(identity, 'alimentation.manuelle', 'RG-COO-089')
  const ligne = await db.receptionAttendue.findUnique({
    where: { id },
    select: { id: true, plateformeId: true },
  })
  if (!ligne) throw new NotFoundError('Ligne attendue introuvable')
  assertPlateforme(identity, ligne.plateformeId, COO.perimetre)
  throw new ConflictError(
    'Une ligne attendue ne se supprime jamais : elle est fermée (annulée) avec une date.',
    { code: 'TRANSITION_INTERDITE', regle: 'RG-COO-089' },
  )
}
