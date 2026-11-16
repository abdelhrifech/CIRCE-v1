// REC-P02 — Réceptions attendues (ECR-REC-01) : lignes, recherche, filtres, compteurs.
// Calcul en mémoire sur les lignes du site (volumétrie ~ centaines par site ; à revoir à l'étape 9).
import {
  CONTROLES_LIGNE,
  MESSAGE_DOSSIER_FORMAT,
  NUMERO_DOSSIER,
  STATUTS_LIGNE,
  StatutLigneSchema,
  comparerSemaines,
  formatSemaineIso,
  lireSemaineIso,
  semaineIsoDe,
  type ControleLigne,
  type LigneAttendue,
  type ListeAttenduesQuery,
  type ListeAttenduesResponse,
  type StatutLigne,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ValidationError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { attenduDe, controleDe, resteDe } from './lignes.ts'
import { assertDroitReception, assertPerimetreReception } from './permissions.ts'

type Dimension = 'statut' | 'depart' | 'format' | 'controle' | 'annonceur'
const DIMENSIONS: Dimension[] = ['statut', 'depart', 'format', 'controle', 'annonceur']
const LIBELLES: Record<Dimension, string> = {
  statut: 'Statut',
  depart: 'Départ',
  format: 'Format',
  controle: 'Contrôle',
  annonceur: 'Annonceur',
}

// RG-REC-001 / RG-COO-167 : plateformes visibles = site choisi (vérifié) sinon tout le périmètre.
export function plateformesVisibles(identity: Identity): number[] | 'toutes' {
  if (identity.siteId !== null) {
    assertPerimetreReception(identity, identity.siteId)
    return [identity.siteId]
  }
  return identity.perimetre.toutesPlateformes ? 'toutes' : identity.perimetre.plateformeIds
}

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** RG-REC-012 : plusieurs valeurs (espaces, virgules, points-virgules, « + » de la saisie héritée). */
export function jetonsRecherche(q: string | undefined): string[] {
  if (!q) return []
  return [
    ...new Set(
      q
        .split(/[\s,;+]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ]
}

// RG-REC-012 : un jeton numérique cherche le n° de dossier ou de DA ; sinon l'annonceur.
// RG-REC-025 : le suffixe « -W » de la 2e plateforme est accepté dans la recherche.
export function correspond(
  ligne: Pick<LigneAttendue, 'dossier' | 'da' | 'annonceur'>,
  jeton: string,
): boolean {
  const num = /^(\d+)(-W)?$/i.exec(jeton)
  if (num) {
    const n = Number(num[1])
    return ligne.dossier === n || ligne.da === n
  }
  return ligne.annonceur !== null && normaliser(ligne.annonceur).includes(normaliser(jeton))
}

function valeurDe(ligne: LigneAttendue, dim: Dimension): string {
  switch (dim) {
    case 'statut':
      return ligne.statut
    case 'depart':
      return ligne.depart
    case 'format':
      return ligne.format ?? ''
    case 'controle':
      return ligne.controle
    case 'annonceur':
      return ligne.annonceur ?? ''
  }
}

function compare(a: LigneAttendue, b: LigneAttendue, tri: ListeAttenduesQuery['sort']): number {
  const txt = (x: string | null, y: string | null) => (x ?? '').localeCompare(y ?? '', 'fr')
  switch (tri) {
    case 'dossier':
      return (a.dossier ?? 0) - (b.dossier ?? 0)
    case 'annonceur':
      return txt(a.annonceur, b.annonceur)
    case 'theme':
      return txt(a.theme, b.theme)
    case 'depart':
      return a.depart.localeCompare(b.depart) || (a.dossier ?? 0) - (b.dossier ?? 0)
    case 'recu':
      return a.recu - b.recu
    case 'attendu':
      return a.attendu - b.attendu
    case 'reste':
      return a.reste - b.reste
    case 'statut':
      return STATUTS_LIGNE.indexOf(a.statut) - STATUTS_LIGNE.indexOf(b.statut)
    case 'controle':
      return CONTROLES_LIGNE.indexOf(a.controle) - CONTROLES_LIGNE.indexOf(b.controle)
    case 'site':
      return txt(a.site.nom, b.site.nom)
  }
}

// RG-REC-016 : statut par défaut Attendue + Partielle ; « tous » = aucune restriction.
function statutsDemandes(brut: string | undefined): StatutLigne[] {
  if (brut === undefined || brut === '') return ['ATTENDUE', 'PARTIELLE']
  if (brut === 'tous') return []
  const parsed = StatutLigneSchema.array().safeParse(brut.split(',').map((s) => s.trim()))
  if (!parsed.success)
    throw new ValidationError('Statut de ligne inconnu', { details: { statut: brut } })
  return parsed.data
}

// RG-REC-014 : lignes ACTIVES du site, hors dossiers annulés (RG-COO-062), thèmes exclus (Q-135) et purgées.
async function chargerLignes(db: Db, plateformes: number[] | 'toutes'): Promise<LigneAttendue[]> {
  const filtrePlateforme = plateformes === 'toutes' ? {} : { plateformeId: { in: plateformes } }
  const annules = await db.dossier.findMany({
    where: { statut: 'ANNULE' },
    select: { contNum: true },
  })
  // Dossiers annulés filtrés en mémoire : leur liste n'est pas bornée (limite de paramètres de SQLite, ANO-051).
  const annulesSet = new Set(annules.map((d) => d.contNum))
  const lignesBrutes = await db.receptionAttendue.findMany({
    where: {
      ...filtrePlateforme,
      etatLigne: 'ACTIVE',
      themeExclu: false,
      purgeeLe: null,
    },
    include: {
      plateforme: { select: { id: true, nom: true } },
      rattachements: {
        where: { actif: true },
        include: { affiche: { select: { id: true, reception: { select: { statut: true } } } } },
      },
    },
  })
  const lignes = lignesBrutes.filter((l) => l.contNum === null || !annulesSet.has(l.contNum))
  return lignes.map((l) => {
    const attendu = attenduDe(l)
    // RG-REC-017 / RG-X-060 : reçu = Σ liens ACTIFS (chaque affiche comptée une fois par ligne).
    const recu = l.rattachements.reduce((s, r) => s + r.quantite, 0)
    return {
      id: l.id,
      version: l.version,
      site: l.plateforme,
      dossier: l.contNum,
      da: l.idDaChapeau,
      annonceur: l.annonceur,
      theme: l.theme,
      format: l.format,
      depart: formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }),
      attendu,
      recu,
      reste: resteDe(attendu, recu),
      statut: l.statut,
      controle: controleDe(l.rattachements.map((r) => r.affiche.reception?.statut ?? null)),
      affiches: [...new Set(l.rattachements.map((r) => r.affiche.id))].sort((a, b) => a - b),
      livraisonPrevue: null,
    }
  })
}

export async function listerReceptionsAttendues(
  db: Db,
  identity: Identity,
  query: ListeAttenduesQuery,
  maintenant: Date = new Date(),
): Promise<ListeAttenduesResponse> {
  // RG-REC-002 : consultation des attendues.
  assertDroitReception(identity, 'reception.attendues.consulter')
  const plateformes = plateformesVisibles(identity)
  const toutes = await chargerLignes(db, plateformes)

  // RG-REC-012 : recherche à la frappe (plusieurs valeurs, OU entre valeurs).
  const jetons = jetonsRecherche(query.q)
  // RG-REC-013 : un n° de dossier saisi comporte exactement 6 chiffres (suffixe -W accepté).
  const invalides = query.dossier.filter((d) => !NUMERO_DOSSIER.test(d))
  if (invalides.length > 0) {
    throw new ValidationError(MESSAGE_DOSSIER_FORMAT, {
      code: 'REC_DOSSIER_FORMAT',
      regle: 'RG-REC-013',
      details: { invalides },
    })
  }
  const parDossier = query.dossier.map((d) => Number(d.replace(/-W$/i, '')))
  const trouvees = toutes.filter(
    (l) =>
      (jetons.length === 0 || jetons.some((j) => correspond(l, j))) &&
      (parDossier.length === 0 || (l.dossier !== null && parDossier.includes(l.dossier))),
  )

  // RG-REC-015 : départ par défaut = semaine courante (en production) et suivantes, en semaines ISO.
  const courante = semaineIsoDe(maintenant)
  const estFuture = (depart: string) => comparerSemaines(lireSemaineIso(depart), courante) >= 0
  const tousDeparts = query.depart === 'tous'
  const departsChoisis = query.depart === 'tous' ? [] : query.depart
  const departParDefaut = !tousDeparts && departsChoisis.length === 0
  const filtres: Record<Dimension, string[]> = {
    statut: statutsDemandes(query.statut),
    depart: departParDefaut
      ? [...new Set(toutes.map((l) => l.depart))].filter(estFuture).sort()
      : departsChoisis,
    format: query.format,
    controle: query.controle,
    annonceur: query.annonceur,
  }
  // RG-REC-016 : aucune coche = tout ; OU entre valeurs d'un filtre ; ET entre filtres.
  // RG-REC-015 : sans choix explicite, le Départ retient la semaine courante et les suivantes — même
  // quand aucune ligne n'existe encore pour ces semaines (une liste vide ne veut pas dire « tout » ici).
  const passeDim = (l: LigneAttendue, dim: Dimension) => {
    if (dim === 'depart' && departParDefaut) return estFuture(l.depart)
    return filtres[dim].length === 0 || filtres[dim].includes(valeurDe(l, dim))
  }
  const passe = (l: LigneAttendue, sauf?: Dimension) =>
    DIMENSIONS.every((dim) => dim === sauf || passeDim(l, dim))

  const visibles = trouvees.filter((l) => passe(l))
  visibles.sort((a, b) => (query.ordre === 'desc' ? -1 : 1) * compare(a, b, query.sort))

  // RG-REC-016 : compteurs par valeur, calculés sans le filtre de la dimension.
  const compteurs = Object.fromEntries(
    DIMENSIONS.map((dim) => {
      const comptes = new Map<string, number>()
      // RG-REC-015 : les options du filtre Départ commencent à la semaine de production.
      const base = trouvees.filter(
        (x) => passe(x, dim) && (dim !== 'depart' || estFuture(x.depart)),
      )
      for (const l of base) {
        const v = valeurDe(l, dim)
        comptes.set(v, (comptes.get(v) ?? 0) + 1)
      }
      return [
        dim,
        [...comptes]
          .map(([valeur, nombre]) => ({ valeur, nombre }))
          .sort((a, b) => a.valeur.localeCompare(b.valeur)),
      ]
    }),
  ) as ListeAttenduesResponse['compteurs']

  // RG-REC-012 : « Absents de cette page » et « Masqués par <filtre> ».
  const absents: string[] = []
  const masques: { valeur: string; filtres: string[] }[] = []
  for (const jeton of jetons) {
    const lignesJeton = toutes.filter((l) => correspond(l, jeton))
    if (lignesJeton.length === 0) absents.push(jeton)
    else if (!lignesJeton.some((l) => passe(l))) {
      // Filtres en cause = ceux qui excluent effectivement au moins une ligne correspondante.
      const enCause = DIMENSIONS.filter((dim) => lignesJeton.some((l) => !passeDim(l, dim)))
      masques.push({ valeur: jeton, filtres: enCause.map((d) => LIBELLES[d]) })
    }
  }

  const debut = (query.page - 1) * query.pageSize
  return {
    items: visibles.slice(debut, debut + query.pageSize),
    total: visibles.length,
    page: query.page,
    pageSize: query.pageSize,
    filtres: {
      statut: filtres.statut as StatutLigne[],
      depart: filtres.depart,
      format: filtres.format,
      controle: filtres.controle as ControleLigne[],
      annonceur: filtres.annonceur,
    },
    compteurs,
    recherche: { absents, masques },
    aucuneLigneSurLeSite: toutes.length === 0,
  }
}
