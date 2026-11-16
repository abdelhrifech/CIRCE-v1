// COO-P07 — Vérification des thèmes (Pré-production, ECR-THM-01 / 02 / 03) : thèmes proches entre dossiers
// (RG-COO-069), annonceurs proches (RG-COO-070), thèmes modifiés dans Broadcast et « Reprendre la version
// Broadcast » (RG-COO-068, RG-COO-030, RG-X-057). Les groupes sont CALCULÉS à la lecture (comme la maquette
// `C.groupesThemes`) ; seuls les verdicts (« différents ») et les demandes de correction sont persistés.
// Circé ne modifie pas Broadcast : une demande est tracée par dossier, l'état du dossier ne change pas ; le mail
// au gestionnaire du pôle n'est pas envoyé (Q-375).
import {
  formatSemaineIso,
  semaineIsoDe,
  type DemanderCorrectionTheme,
  type ListeVerificationQuery,
  type SemaineIso,
  type StatutVerification,
  type VerdictVerification,
} from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { assertPlateforme } from '../../core/permissions/permissions.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { lireParametreNombre, lireParametreTexte } from '../reception/parametres.ts'
import { assertDroitCoordination, COO } from './permissions.ts'
import {
  departsDesDossiers,
  dossiersEnProduction,
  formatDepart,
  libellePreparation,
} from './production.ts'
import { normaliserTheme } from './validation-admin.ts'

type Client = Db | Tx

// ───────────────────────────── Règle de proximité (RG-COO-069 / 070) ─────────────────────────────

/** Intitulé simplifié : minuscules, sans accents ni ponctuation (maquette `C.simplifier`). */
export function simplifier(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, ' ')
    .trim()
}

/** Similarité par plus longues sous-chaînes communes récursives (équivalent de difflib.SequenceMatcher.ratio,
 * maquette `C.ratio`). */
export function ratio(a: string, b: string): number {
  const lcs = (x: string, y: string): number => {
    if (!x.length || !y.length) return 0
    let best = 0
    let bi = 0
    let bj = 0
    for (let i = 0; i < x.length; i++)
      for (let j = 0; j < y.length; j++) {
        let k = 0
        while (i + k < x.length && j + k < y.length && x[i + k] === y[j + k]) k++
        if (k > best) {
          best = k
          bi = i
          bj = j
        }
      }
    if (!best) return 0
    return best + lcs(x.slice(0, bi), y.slice(0, bj)) + lcs(x.slice(bi + best), y.slice(bj + best))
  }
  return a.length + b.length ? (2 * lcs(a, b)) / (a.length + b.length) : 1
}

/** RG-COO-069 : proches si identiques une fois simplifiés, l'un contenu dans l'autre (≥ 3 caractères, mots
 * entiers), ou similarité ≥ seuil (paramètre `coordination.seuilThemesProches`, 0,85). */
export function proches(a: string, b: string, seuil: number): boolean {
  return prochesSimplifies(simplifierMemo(a), simplifierMemo(b), seuil)
}

// ANO-062 : la comparaison deux à deux des intitulés d'un annonceur recalculait `simplifier` à chaque paire ; le
// résultat est mémorisé (fonction pure, mémoire bornée).
const MEMO_SIMPLIFIER = new Map<string, string>()
function simplifierMemo(s: string): string {
  const connu = MEMO_SIMPLIFIER.get(s)
  if (connu !== undefined) return connu
  if (MEMO_SIMPLIFIER.size > 50_000) MEMO_SIMPLIFIER.clear()
  const v = simplifier(s)
  MEMO_SIMPLIFIER.set(s, v)
  return v
}

function prochesSimplifies(x: string, y: string, seuil: number): boolean {
  if (x === y) return true
  const [court, long] = x.length <= y.length ? [x, y] : [y, x]
  if (court.length >= 3 && ` ${long} `.includes(` ${court} `)) return true
  // La similarité ne dépasse jamais 2 × min(|x|, |y|) / (|x| + |y|) (une sous-chaîne commune n'est pas plus longue
  // que la plus courte) : sous le seuil, le calcul coûteux des sous-chaînes communes est inutile.
  if ((2 * court.length) / (x.length + y.length) < seuil) return false
  // Idem avec le nombre de caractères communs (multiensemble) : la plus longue sous-chaîne commune n'en compte pas plus.
  if ((2 * caracteresCommuns(histogramme(x), histogramme(y))) / (x.length + y.length) < seuil)
    return false
  return ratio(x, y) >= seuil
}

const MEMO_HISTOGRAMME = new Map<string, Uint16Array>()
/** Effectif de chaque caractère d'un intitulé simplifié (chiffres, lettres, espace) : 37 cases. */
function histogramme(s: string): Uint16Array {
  const connu = MEMO_HISTOGRAMME.get(s)
  if (connu) return connu
  if (MEMO_HISTOGRAMME.size > 50_000) MEMO_HISTOGRAMME.clear()
  const h = new Uint16Array(37)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    const k = c === 32 ? 36 : c <= 57 ? c - 48 : c - 87
    h[k] = (h[k] ?? 0) + 1
  }
  MEMO_HISTOGRAMME.set(s, h)
  return h
}
function caracteresCommuns(a: Uint16Array, b: Uint16Array): number {
  let n = 0
  for (let i = 0; i < 37; i++) n += Math.min(a[i] ?? 0, b[i] ?? 0)
  return n
}

/** RG-COO-070 : regroupements d'enseignes « motif:valeur ; … » (« * » = n'importe quel texte). */
export function lireRegroupements(valeur: string): { motif: RegExp; valeur: string }[] {
  return valeur
    .split(';')
    .map((x) => x.trim())
    .filter((x) => /^[^:]+:[^:]+$/.test(x))
    .map((x) => {
      const [motif = '', v = ''] = x.split(':')
      const re = motif
        .trim()
        .split('*')
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')
      return { motif: new RegExp(`^${re}$`, 'i'), valeur: v.trim() }
    })
}

export function regrouper(nom: string, regroupements: { motif: RegExp; valeur: string }[]): string {
  return regroupements.find((r) => r.motif.test(nom))?.valeur ?? nom
}

/** Composantes connexes d'une liste selon la relation « proches » (maquette : parcours en largeur). */
function composantes<T>(
  liste: T[],
  libelle: (t: T) => string,
  sont: (a: string, b: string) => boolean,
) {
  const vu = new Set<number>()
  const out: T[][] = []
  liste.forEach((t0, i0) => {
    if (vu.has(i0)) return
    vu.add(i0)
    const comp = [t0]
    for (let i = 0; i < comp.length; i++) {
      const courant = comp[i] as T
      liste.forEach((t, j) => {
        if (!vu.has(j) && sont(libelle(courant), libelle(t))) {
          vu.add(j)
          comp.push(t)
        }
      })
    }
    out.push(comp)
  })
  return out
}

// ───────────────────────────── Données lues ─────────────────────────────

const plateformesDe = (identity: Identity) =>
  identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds

const depuisSemaine = (s: SemaineIso) => ({
  OR: [{ semAnnee: { gt: s.annee } }, { semAnnee: s.annee, semNum: { gte: s.semaine } }],
})

interface DossierLu {
  contNum: number
  annonceur: string
  statut: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE' | null
  departs: SemaineIso[]
  plateformes: Set<number>
  ateliers: Set<number>
  productionLancee: boolean
}

interface ThemeLu {
  id: string
  contNum: number
  libelle: string
}

interface Contexte {
  seuil: number
  regroupements: { motif: RegExp; valeur: string }[]
  dossiers: Map<number, DossierLu>
  themes: ThemeLu[]
  verdicts: { id: number; type: string; cle: string; parId: number; le: Date; version: number }[]
  demandes: {
    id: number
    type: string
    cle: string
    contNum: number
    ancien: string
    nouveau: string
    le: Date
  }[]
  noms: Map<number, string>
}

/** RG-COO-069 / 070 : thèmes (dès la saisie des IP) et noms d'annonceurs (dès la DA activée) des dossiers non
 * annulés au départ ≥ semaine en cours, dans le périmètre. Thème « reste en place / ne pas afficher » exclu. */
async function lireContexte(
  client: Client,
  identity: Identity,
  maintenant: Date,
): Promise<Contexte> {
  const plateformes = plateformesDe(identity)
  const S = semaineIsoDe(maintenant)
  const lignes = await client.receptionAttendue.findMany({
    where: {
      etatLigne: 'ACTIVE',
      purgeeLe: null,
      contNum: { not: null },
      ...(plateformes ? { plateformeId: { in: plateformes } } : {}),
      ...depuisSemaine(S),
    },
    select: {
      contNum: true,
      theme: true,
      annonceur: true,
      plateformeId: true,
      atelierId: true,
      themeExclu: true,
      provisoire: true,
    },
  })
  const contNums = [...new Set(lignes.map((l) => l.contNum).filter((c): c is number => c !== null))]
  const [fiches, departs, enProduction] = await Promise.all([
    parPaquets(contNums, (paquet) =>
      client.dossier.findMany({ where: { contNum: { in: paquet } } }),
    ),
    departsDesDossiers(client, contNums),
    dossiersEnProduction(client, contNums),
  ])
  const parNum = new Map(fiches.map((d) => [d.contNum, d]))
  const dossiers = new Map<number, DossierLu>()
  const themes = new Map<string, ThemeLu>()
  for (const l of lignes) {
    if (l.contNum === null) continue
    const fiche = parNum.get(l.contNum)
    if (fiche?.statut === 'ANNULE') continue
    const d = dossiers.get(l.contNum) ?? {
      contNum: l.contNum,
      annonceur: (fiche?.annonceur ?? l.annonceur ?? '').trim(),
      statut: fiche?.statut ?? null,
      departs: (departs.get(l.contNum) ?? []).filter(
        (s) => s.annee > S.annee || (s.annee === S.annee && s.semaine >= S.semaine),
      ),
      plateformes: new Set<number>(),
      ateliers: new Set<number>(),
      productionLancee: enProduction.has(l.contNum),
    }
    d.plateformes.add(l.plateformeId)
    if (l.atelierId !== null) d.ateliers.add(l.atelierId)
    dossiers.set(l.contNum, d)
    if (l.theme === null || l.provisoire || l.themeExclu || !l.theme.trim()) continue
    const libelle = l.theme.trim()
    const id = `${String(l.contNum)}:${encodeURIComponent(libelle)}`
    themes.set(id, { id, contNum: l.contNum, libelle })
  }
  const [verdicts, demandes, seuil, regroupements] = await Promise.all([
    client.verificationTheme.findMany({ where: { actif: true } }),
    client.demandeTheme.findMany({ where: { statut: 'ENVOYEE' }, orderBy: { le: 'desc' } }),
    lireParametreNombre(client, 'coordination.seuilThemesProches'),
    lireParametreTexte(client, 'coordination.regroupementsAnnonceurs'),
  ])
  const noms = new Map(
    (
      await parPaquets([...new Set(verdicts.map((v) => v.parId))], (paquet) =>
        client.utilisateur.findMany({
          where: { id: { in: paquet } },
          select: { id: true, nom: true, identifiantExterne: true },
        }),
      )
    ).map((u) => [u.id, u.nom ?? u.identifiantExterne]),
  )
  return {
    seuil,
    regroupements: lireRegroupements(regroupements),
    dossiers,
    themes: [...themes.values()],
    verdicts,
    demandes,
    noms,
  }
}

// ───────────────────────────── Groupes ─────────────────────────────

interface GroupeAnnonceursCalc {
  cle: string
  bases: string[]
  noms: string[]
  dossiers: number[]
  statut: StatutVerification
  verdict: Contexte['verdicts'][number] | null
}

/** RG-COO-070 : demande en cours = demande ENVOYEE dont l'ancien nom est toujours celui du dossier. */
function demandeEnCours(
  ctx: Contexte,
  type: 'THEMES' | 'ANNONCEURS',
  contNum: number,
  libelle: string,
) {
  return ctx.demandes.find((x) => x.type === type && x.contNum === contNum && x.ancien === libelle)
}

function groupesAnnonceurs(ctx: Contexte): GroupeAnnonceursCalc[] {
  const dossiers = [...ctx.dossiers.values()].filter((d) => d.annonceur)
  const bases = [...new Set(dossiers.map((d) => regrouper(d.annonceur, ctx.regroupements)))]
  const out: GroupeAnnonceursCalc[] = []
  for (const comp of composantes(
    bases,
    (b) => b,
    (a, b) => proches(a, b, ctx.seuil),
  )) {
    // RG-COO-070 : deux noms qu'un regroupement réunit déjà ne sont pas signalés (même base).
    if (comp.length < 2) continue
    const membres = dossiers.filter((d) => comp.includes(regrouper(d.annonceur, ctx.regroupements)))
    const nums = [...new Set(membres.map((d) => d.contNum))].sort((a, b) => a - b)
    const cle = nums.join('|')
    const verdict = ctx.verdicts.find((v) => v.type === 'ANNONCEURS' && v.cle === cle) ?? null
    const enCours = membres.some((d) => demandeEnCours(ctx, 'ANNONCEURS', d.contNum, d.annonceur))
    out.push({
      cle,
      bases: comp,
      noms: [...new Set(membres.map((d) => d.annonceur))],
      dossiers: nums,
      statut: enCours ? 'DEMANDE_ENVOYEE' : verdict ? 'DIFFERENTS' : 'A_VERIFIER',
      verdict,
    })
  }
  return out
}

interface GroupeThemesCalc {
  cle: string
  annonceur: string
  themes: ThemeLu[]
  dossiers: number[]
  libelles: string[]
  statut: StatutVerification
  verdict: Contexte['verdicts'][number] | null
}

function groupesThemes(ctx: Contexte, annonceurs: GroupeAnnonceursCalc[]): GroupeThemesCalc[] {
  // RG-COO-070 : annonceur de référence = groupe d'annonceurs proches (sauf « différents »), sinon regroupement.
  const ref = new Map<string, string>()
  for (const g of annonceurs.filter((x) => x.statut !== 'DIFFERENTS'))
    for (const b of g.bases) ref.set(b, g.noms.join(' / '))
  const refDe = (nom: string) => {
    const base = regrouper(nom, ctx.regroupements)
    return ref.get(base) ?? base
  }
  const parAnnonceur = new Map<string, ThemeLu[]>()
  for (const t of ctx.themes) {
    const a = refDe(ctx.dossiers.get(t.contNum)?.annonceur ?? '')
    parAnnonceur.set(a, [...(parAnnonceur.get(a) ?? []), t])
  }
  const out: GroupeThemesCalc[] = []
  for (const [annonceur, liste] of parAnnonceur) {
    for (const comp of composantes(
      liste,
      (t) => t.libelle,
      (a, b) => proches(a, b, ctx.seuil),
    )) {
      if (comp.length < 2) continue
      const cle = comp
        .map((t) => t.id)
        .sort()
        .join('|')
      const dossiers = [...new Set(comp.map((t) => t.contNum))].sort((a, b) => a - b)
      const libelles = [...new Set(comp.map((t) => t.libelle))]
      const verdict = ctx.verdicts.find((v) => v.type === 'THEMES' && v.cle === cle) ?? null
      const enCours = comp.some((t) => demandeEnCours(ctx, 'THEMES', t.contNum, t.libelle))
      // Maquette `etatOf` : demande en cours → verdict → intitulés à harmoniser → même intitulé.
      const statut: StatutVerification = enCours
        ? 'DEMANDE_ENVOYEE'
        : verdict
          ? 'DIFFERENTS'
          : libelles.length > 1
            ? 'A_VERIFIER'
            : 'MEME_INTITULE'
      out.push({ cle, annonceur, themes: comp, dossiers, libelles, statut, verdict })
    }
  }
  return out
}

/** Groupes « Corrigé par Broadcast » : demandes ENVOYÉES dont l'ancien intitulé (ou nom) n'existe plus sur le
 * dossier (Broadcast a renvoyé la préparation corrigée) ; gardés pour la trace (maquette). */
function corriges(ctx: Contexte, type: 'THEMES' | 'ANNONCEURS') {
  const existe = (contNum: number, libelle: string) =>
    type === 'THEMES'
      ? ctx.themes.some((t) => t.contNum === contNum && t.libelle === libelle)
      : ctx.dossiers.get(contNum)?.annonceur === libelle
  const parCle = new Map<string, Contexte['demandes']>()
  for (const d of ctx.demandes.filter((x) => x.type === type && ctx.dossiers.has(x.contNum))) {
    if (existe(d.contNum, d.ancien)) continue
    parCle.set(d.cle, [...(parCle.get(d.cle) ?? []), d])
  }
  return parCle
}

function dossierGroupe(
  ctx: Contexte,
  type: 'THEMES' | 'ANNONCEURS',
  contNum: number,
  libelles: string[],
) {
  const d = ctx.dossiers.get(contNum)
  const demande = ctx.demandes.find((x) => x.type === type && x.contNum === contNum)
  return {
    contNum,
    annonceur: d?.annonceur ?? null,
    depart: formatDepart(d?.departs[0]),
    preparation: libellePreparation(d?.statut ?? null),
    productionLancee: d?.productionLancee ?? false,
    libelles,
    demande: demande
      ? {
          ancien: demande.ancien,
          nouveau: demande.nouveau,
          le: demande.le.toISOString(),
          statut: libelles.includes(demande.ancien) ? 'ENVOYEE' : 'CORRIGEE',
        }
      : null,
  }
}

const premierDepart = (ctx: Contexte, nums: number[]) =>
  nums
    .flatMap((n) => ctx.dossiers.get(n)?.departs ?? [])
    .map((s) => formatSemaineIso(s))
    .sort()[0] ?? null

function filtrerGroupe(
  ctx: Contexte,
  q: ListeVerificationQuery,
  g: { dossiers: number[]; libelleAnnonceur: string },
) {
  if (q.dossier !== undefined && !g.dossiers.includes(q.dossier)) return false
  if (
    q.depart !== undefined &&
    !g.dossiers.some((n) =>
      ctx.dossiers.get(n)?.departs.some((s) => formatSemaineIso(s) === q.depart),
    )
  )
    return false
  if (q.annonceur && !g.libelleAnnonceur.toLowerCase().includes(q.annonceur.toLowerCase()))
    return false
  if (
    q.atelierId !== undefined &&
    !g.dossiers.some((n) => ctx.dossiers.get(n)?.ateliers.has(q.atelierId ?? -1))
  )
    return false
  return true
}

// Maquette : un lien posant le dossier (?dossier=…) montre tous ses groupes ; « Déjà traités » = corrigés ou
// différents.
const etatVoulu = (q: ListeVerificationQuery, statut: StatutVerification) =>
  q.etat === 'TOUS' ||
  (q.dossier !== undefined && q.etat === 'A_VERIFIER') ||
  (q.etat === 'TRAITES' && (statut === 'CORRIGE' || statut === 'DIFFERENTS')) ||
  q.etat === statut

// ───────────────────────────── Lectures (ECR-THM-01 / 02) ─────────────────────────────

// RG-COO-069 / 075 : ECR-THM-01, consultation coord / admin.
export async function listerThemesProches(
  db: Db,
  identity: Identity,
  q: ListeVerificationQuery,
  maintenant = new Date(),
) {
  assertDroitCoordination(identity, 'verification_themes.consulter', 'RG-COO-075')
  const ctx = await lireContexte(db, identity, maintenant)
  const groupes = groupesThemes(ctx, groupesAnnonceurs(ctx)).map((g) => ({
    cle: g.cle,
    statut: g.statut,
    annonceur: g.annonceur,
    libelles: g.libelles.map((l) => {
      const ts = g.themes.filter((t) => t.libelle === l)
      return { libelle: l, themes: ts.length, dossiers: new Set(ts.map((t) => t.contNum)).size }
    }),
    dossiers: g.dossiers.map((n) =>
      dossierGroupe(
        ctx,
        'THEMES',
        n,
        g.themes.filter((t) => t.contNum === n).map((t) => t.libelle),
      ),
    ),
    depart: premierDepart(ctx, g.dossiers),
    verdict: g.verdict
      ? { par: ctx.noms.get(g.verdict.parId) ?? null, le: g.verdict.le.toISOString() }
      : null,
  }))
  for (const [cle, ds] of corriges(ctx, 'THEMES')) {
    const nums = [...new Set(ds.map((d) => d.contNum))].sort((a, b) => a - b)
    groupes.push({
      cle,
      statut: 'CORRIGE',
      annonceur: ctx.dossiers.get(nums[0] ?? 0)?.annonceur ?? '',
      libelles: [...new Set(ds.map((d) => d.nouveau))].map((l) => ({
        libelle: l,
        themes: ds.filter((d) => d.nouveau === l).length,
        dossiers: new Set(ds.filter((d) => d.nouveau === l).map((d) => d.contNum)).size,
      })),
      dossiers: nums.map((n) => dossierGroupe(ctx, 'THEMES', n, [])),
      depart: premierDepart(ctx, nums),
      verdict: null,
    })
  }
  const visibles = groupes.filter((g) =>
    filtrerGroupe(ctx, q, {
      dossiers: g.dossiers.map((d) => d.contNum),
      libelleAnnonceur: g.annonceur,
    }),
  )
  const n = (s: StatutVerification) => visibles.filter((g) => g.statut === s).length
  return {
    groupes: visibles.filter((g) => etatVoulu(q, g.statut)),
    indicateurs: {
      aVerifier: n('A_VERIFIER'),
      demandesEnvoyees: n('DEMANDE_ENVOYEE'),
      memeIntitule: n('MEME_INTITULE'),
      dejaTraites: n('CORRIGE') + n('DIFFERENTS'),
    },
    seuil: ctx.seuil,
  }
}

// RG-COO-070 / 075 : ECR-THM-02.
export async function listerAnnonceursProches(
  db: Db,
  identity: Identity,
  q: ListeVerificationQuery,
  maintenant = new Date(),
) {
  assertDroitCoordination(identity, 'verification_themes.consulter', 'RG-COO-075')
  const ctx = await lireContexte(db, identity, maintenant)
  const groupes = groupesAnnonceurs(ctx).map((g) => ({
    cle: g.cle,
    statut: g.statut,
    // HYPOTHÈSE Q-190 (8) : l'annonceur imprimé corrigé par la plateforme (fixe / colle, FIX-15) n'est pas
    // modélisé : tous les noms viennent de Broadcast.
    noms: g.noms.map((nom) => ({ nom, origine: 'BROADCAST' as const })),
    dossiers: g.dossiers.map((n) =>
      dossierGroupe(ctx, 'ANNONCEURS', n, [ctx.dossiers.get(n)?.annonceur ?? '']),
    ),
    depart: premierDepart(ctx, g.dossiers),
    verdict: g.verdict
      ? { par: ctx.noms.get(g.verdict.parId) ?? null, le: g.verdict.le.toISOString() }
      : null,
  }))
  for (const [cle, ds] of corriges(ctx, 'ANNONCEURS')) {
    const nums = [...new Set(ds.map((d) => d.contNum))].sort((a, b) => a - b)
    groupes.push({
      cle,
      statut: 'CORRIGE',
      noms: [...new Set(ds.map((d) => d.nouveau))].map((nom) => ({ nom, origine: 'BROADCAST' })),
      dossiers: nums.map((n) => dossierGroupe(ctx, 'ANNONCEURS', n, [])),
      depart: premierDepart(ctx, nums),
      verdict: null,
    })
  }
  const visibles = groupes.filter((g) =>
    filtrerGroupe(ctx, q, {
      dossiers: g.dossiers.map((d) => d.contNum),
      libelleAnnonceur: g.noms.map((x) => x.nom).join(' / '),
    }),
  )
  const n = (s: StatutVerification) => visibles.filter((g) => g.statut === s).length
  return {
    groupes: visibles.filter((g) => etatVoulu(q, g.statut)),
    indicateurs: {
      aVerifier: n('A_VERIFIER'),
      demandesEnvoyees: n('DEMANDE_ENVOYEE'),
      dejaTraites: n('CORRIGE') + n('DIFFERENTS'),
    },
  }
}

/** Groupes à vérifier (alertes RG-COO-069 / 070, ECR-TRA-01). */
export async function groupesAVerifier(client: Client, identity: Identity, maintenant: Date) {
  const ctx = await lireContexte(client, identity, maintenant)
  const annonceurs = groupesAnnonceurs(ctx)
  const vue = (nums: number[]) => {
    const plateformes = new Set(nums.flatMap((n) => [...(ctx.dossiers.get(n)?.plateformes ?? [])]))
    return {
      plateformeId: plateformes.size === 1 ? ([...plateformes][0] ?? null) : null,
      depart: premierDepart(ctx, nums),
    }
  }
  return {
    themes: groupesThemes(ctx, annonceurs)
      .filter((g) => g.statut === 'A_VERIFIER')
      .map((g) => ({ ...g, ...vue(g.dossiers) })),
    annonceurs: annonceurs
      .filter((g) => g.statut === 'A_VERIFIER')
      .map((g) => ({ ...g, ...vue(g.dossiers) })),
  }
}

// ───────────────────────────── Actions (ECR-THM-01 / 02) ─────────────────────────────

const REGLE = { THEMES: 'RG-COO-069', ANNONCEURS: 'RG-COO-070' } as const

async function groupeATraiter(
  tx: Tx,
  identity: Identity,
  type: 'THEMES' | 'ANNONCEURS',
  cle: string,
) {
  const ctx = await lireContexte(tx, identity, new Date())
  const annonceurs = groupesAnnonceurs(ctx)
  const g =
    type === 'THEMES'
      ? groupesThemes(ctx, annonceurs).find((x) => x.cle === cle)
      : annonceurs.find((x) => x.cle === cle)
  if (!g)
    throw new ConflictError(
      'Ce groupe a changé (préparation renvoyée, dossier annulé ou autre décision) : rechargez la page.',
      { code: 'COO_GROUPE_CHANGE', regle: REGLE[type] },
    )
  return { ctx, g }
}

// RG-COO-069 / 070 : « Demander la correction dans Broadcast » : une demande par dossier à corriger, l'état du
// dossier ne change pas ; refus si la production est lancée sur tous les dossiers à corriger (« Voir avec
// l'atelier »). RG-COO-009 : coord / admin. Mail au gestionnaire du pôle : Q-375 (non envoyé).
export async function demanderCorrectionTheme(
  tx: Tx,
  identity: Identity,
  input: DemanderCorrectionTheme,
) {
  assertDroitCoordination(identity, 'broadcast.correction.demander', REGLE[input.type])
  const { ctx, g } = await groupeATraiter(tx, identity, input.type, input.cle)
  if (g.statut !== 'A_VERIFIER')
    throw new ConflictError(
      'Ce groupe n’est plus à vérifier : une demande ou une décision existe déjà.',
      {
        code: 'COO_VERIFICATION_DEJA_TRAITEE',
        regle: REGLE[input.type],
      },
    )
  // Paires (dossier, intitulé à corriger).
  const aCorriger: { contNum: number; ancien: string }[] =
    input.type === 'THEMES'
      ? (g as GroupeThemesCalc).themes
          .filter((t) => t.libelle !== input.correct)
          .map((t) => ({ contNum: t.contNum, ancien: t.libelle }))
      : g.dossiers
          .map((n) => ({ contNum: n, ancien: ctx.dossiers.get(n)?.annonceur ?? '' }))
          .filter((x) => x.ancien !== input.correct)
  const valeurs =
    input.type === 'THEMES' ? (g as GroupeThemesCalc).libelles : (g as GroupeAnnonceursCalc).noms
  if (!valeurs.includes(input.correct))
    throw new BusinessError('Choisissez un intitulé parmi ceux du groupe.', {
      code: 'COO_INTITULE_INCONNU',
      regle: REGLE[input.type],
    })
  const possibles = aCorriger.filter((x) => !ctx.dossiers.get(x.contNum)?.productionLancee)
  if (possibles.length === 0)
    throw new BusinessError(
      'Rien à demander : la production est lancée sur ces dossiers. Voir avec l’atelier.',
      { code: 'COO_PRODUCTION_LANCEE', regle: REGLE[input.type] },
    )
  for (const x of possibles) {
    await tx.demandeTheme.create({
      data: {
        type: input.type,
        cle: input.cle,
        contNum: x.contNum,
        ancien: x.ancien,
        nouveau: input.correct,
        note: input.note || null,
        parId: identity.userId,
      },
    })
    await ecrireJournal(tx, {
      typeEntite: 'DOSSIER',
      entiteId: x.contNum,
      action: 'DEMANDE_CORRECTION_THEME',
      parId: identity.userId,
      ancienneValeur: x.ancien,
      nouvelleValeur: input.correct,
      complement: REGLE[input.type],
      donnees: { type: input.type, note: input.note || null, mailEnvoye: false },
    })
  }
  const dossiers = new Set(possibles.map((x) => x.contNum)).size
  const ignores = new Set(aCorriger.filter((x) => !possibles.includes(x)).map((x) => x.contNum))
    .size
  return {
    dossiers,
    message:
      `Demande enregistrée pour ${String(dossiers)} dossier(s). Le mail au gestionnaire du pôle n’est pas ` +
      'encore envoyé par Circé (Q-375). Le groupe disparaîtra au renvoi des préparations corrigées.' +
      (ignores ? ` ${String(ignores)} dossier(s) en production : voir avec l’atelier.` : ''),
  }
}

// RG-COO-069 / 070 : « Visuels différents » / « Annonceurs différents » (lève l'alerte) et « Rouvrir ».
export async function trancherVerification(tx: Tx, identity: Identity, input: VerdictVerification) {
  assertDroitCoordination(identity, 'broadcast.correction.demander', REGLE[input.type])
  if (input.verdict === 'ROUVRIR') {
    const v = await tx.verificationTheme.findFirst({
      where: { type: input.type, cle: input.cle, actif: true },
    })
    if (!v)
      throw new ConflictError('Ce groupe n’a pas de décision à rouvrir.', {
        code: 'COO_VERIFICATION_SANS_DECISION',
        regle: REGLE[input.type],
      })
    await updateWithVersion({
      expectedVersion: v.version,
      update: (where) =>
        tx.verificationTheme.updateMany({
          where: { id: v.id, ...where },
          data: { actif: false, ...bumpVersion },
        }),
      ...COO.version,
    })
    await ecrireJournal(tx, {
      typeEntite: 'VERIFICATION_THEME',
      entiteId: v.id,
      action: 'VERDICT_VERIFICATION_THEME',
      parId: identity.userId,
      ancienneValeur: 'DIFFERENTS',
      nouvelleValeur: 'A_VERIFIER',
      complement: REGLE[input.type],
      donnees: { type: input.type, cle: input.cle },
    })
    return { dossiers: input.cle.split('|').length, message: 'Groupe rouvert : à vérifier.' }
  }
  const { g } = await groupeATraiter(tx, identity, input.type, input.cle)
  if (g.statut !== 'A_VERIFIER')
    throw new ConflictError(
      'Ce groupe n’est plus à vérifier : une demande ou une décision existe déjà.',
      {
        code: 'COO_VERIFICATION_DEJA_TRAITEE',
        regle: REGLE[input.type],
      },
    )
  const v = await tx.verificationTheme.create({
    data: { type: input.type, cle: input.cle, verdict: 'DIFFERENTS', parId: identity.userId },
  })
  await ecrireJournal(tx, {
    typeEntite: 'VERIFICATION_THEME',
    entiteId: v.id,
    action: 'VERDICT_VERIFICATION_THEME',
    parId: identity.userId,
    ancienneValeur: 'A_VERIFIER',
    nouvelleValeur: 'DIFFERENTS',
    complement: REGLE[input.type],
    donnees: { type: input.type, cle: input.cle, dossiers: g.dossiers },
  })
  return {
    dossiers: g.dossiers.length,
    message:
      input.type === 'THEMES'
        ? 'Noté : ce sont des visuels différents. L’alerte est levée.'
        : 'Noté : ce sont des annonceurs différents. Leurs thèmes ne sont plus comparés entre eux.',
  }
}

// ───────────────────────────── Thèmes modifiés dans Broadcast (ECR-THM-03) ─────────────────────────────

/** RG-COO-068 / RG-COO-030 : lignes dont le thème Broadcast a changé après la validation (drapeau
 * `theme_modifie` posé par effetsLigneModifiee) et dont le thème de Circé (thème de l'affiche, imprimé sur la
 * feuille de stock) diffère encore. HYPOTHÈSE Q-190 (7) : « thème de Circé » = thème de l'affiche reçue. */
export async function lignesThemeModifie(client: Client, plateformes: number[] | null) {
  // RG-COO-068 (ANO-036) : « après la validation / l'Instruction OK » : affiche validée dont le thème a changé
  // (drapeau, RG-COO-030), OU affiche (même non validée) d'un dossier dont l'instruction est passée en
  // Instruction OK ou au-delà. La validation n'est défaite que pour les affiches validées (RG-COO-030).
  // ANO-051 : les dossiers après l'Instruction OK sont lus par paquets ; les LIGNES sont filtrées par périmètre
  // (une instruction sans atelier ne doit pas faire disparaître l'alerte, RG-COO-068).
  const apresIok = [
    ...new Set(
      (
        await client.instruction.findMany({
          where: { statut: { in: ['INSTRUCTION_OK', 'PRET_A_PRODUIRE'] }, contNum: { not: null } },
          select: { contNum: true },
          distinct: ['contNum'],
        })
      )
        .map((i) => i.contNum)
        .filter((c): c is number => c !== null),
    ),
  ]
  const include = {
    affiche: { select: { id: true, theme: true } },
    ligneAttendue: {
      include: {
        atelier: { select: { libelle: true } },
        plateforme: { select: { nom: true } },
      },
    },
  } as const
  const surLigne = {
    etatLigne: 'ACTIVE' as const,
    ...(plateformes ? { plateformeId: { in: plateformes } } : {}),
  }
  // Deux lectures (drapeau « thème modifié » ; dossiers après l'Instruction OK, par paquets) fusionnées par lien.
  const parDrapeau = await client.afficheAttendue.findMany({
    where: { actif: true, affiche: { themeModifie: true }, ligneAttendue: surLigne },
    include,
  })
  const parIok = await parPaquets(apresIok, (paquet) =>
    client.afficheAttendue.findMany({
      where: {
        actif: true,
        ligneAttendue: { ...surLigne, contNum: { in: paquet } },
      },
      include,
    }),
  )
  const liens = [...new Map([...parDrapeau, ...parIok].map((l) => [l.id, l])).values()].sort(
    (x, y) => x.id - y.id,
  )
  const parLigne = new Map<
    number,
    {
      ligne: (typeof liens)[number]['ligneAttendue']
      affiches: { id: number; theme: string | null }[]
    }
  >()
  for (const l of liens) {
    // Ligne sans thème (IP non saisies) : rien à comparer (alerte « Réception sans IP », RG-COO-071).
    if (l.ligneAttendue.theme === null) continue
    if (normaliserTheme(l.affiche.theme) === normaliserTheme(l.ligneAttendue.theme)) continue
    const e = parLigne.get(l.ligneAttendueId) ?? { ligne: l.ligneAttendue, affiches: [] }
    e.affiches.push(l.affiche)
    parLigne.set(l.ligneAttendueId, e)
  }
  const nums = [...parLigne.values()]
    .map((x) => x.ligne.contNum)
    .filter((c): c is number => c !== null)
  const enProduction = await dossiersEnProduction(client, nums)
  const statuts = new Map(
    (
      await parPaquets([...new Set(nums)], (paquet) =>
        client.dossier.findMany({
          where: { contNum: { in: paquet } },
          select: { contNum: true, statut: true },
        }),
      )
    ).map((d) => [d.contNum, d.statut]),
  )
  return [...parLigne.values()].map(({ ligne, affiches }) => ({
    ligneAttendueId: ligne.id,
    version: ligne.version,
    contNum: ligne.contNum,
    annonceur: ligne.annonceur,
    plateformeId: ligne.plateformeId,
    atelier: `${ligne.atelier?.libelle ?? ligne.format ?? '—'} · ${ligne.plateforme.nom}`,
    depart: formatSemaineIso({ annee: ligne.semAnnee, semaine: ligne.semNum }),
    themeCirce: affiches[0]?.theme ?? null,
    themeBroadcast: ligne.theme,
    productionLancee: ligne.contNum !== null && enProduction.has(ligne.contNum),
    affiches: affiches.map((a) => a.id),
    atelierId: ligne.atelierId,
    preparation: libellePreparation(
      ligne.contNum !== null ? (statuts.get(ligne.contNum) ?? null) : null,
    ),
  }))
}

// RG-COO-068 : ECR-THM-03.
export async function listerThemesModifies(db: Db, identity: Identity, q: ListeVerificationQuery) {
  assertDroitCoordination(identity, 'verification_themes.consulter', 'RG-COO-075')
  const toutes = (await lignesThemeModifie(db, plateformesDe(identity))).filter(
    (l) =>
      (q.dossier === undefined || l.contNum === q.dossier) &&
      (q.depart === undefined || l.depart === q.depart) &&
      (q.atelierId === undefined || l.atelierId === q.atelierId) &&
      (!q.annonceur || (l.annonceur ?? '').toLowerCase().includes(q.annonceur.toLowerCase())),
  )
  const lignes = toutes.filter(
    (l) => q.production === undefined || (q.production === 'LANCEE') === l.productionLancee,
  )
  return {
    lignes,
    indicateurs: {
      total: toutes.length,
      productionLancee: toutes.filter((l) => l.productionLancee).length,
      avantProduction: toutes.filter((l) => !l.productionLancee).length,
    },
  }
}

// RG-COO-068 / RG-X-057 (HYPOTHÈSE Q-210 : reprise sur clic seulement) : « Reprendre la version Broadcast » :
// dans UNE transaction, le thème de l'affiche (Circé) prend celui de la ligne (Broadcast), « Feuille à refaire »
// est posé (alerte Réception RG-REC-188), historique de l'affiche et du dossier. La validation reste à refaire
// (motif THEME, RG-COO-030) jusqu'à la reconfirmation. Production lancée : mail aux chefs d'équipe de
// l'atelier tracé, non envoyé (Q-375). RG-COO-009 : coord / admin ; RG-COO-167 : périmètre.
export async function reprendreThemeBroadcast(
  tx: Tx,
  identity: Identity,
  ligneAttendueId: number,
  version: number,
) {
  assertDroitCoordination(identity, 'broadcast.version.appliquer', 'RG-COO-068')
  const ligne = await tx.receptionAttendue.findUnique({ where: { id: ligneAttendueId } })
  if (!ligne) throw new NotFoundError('Ligne attendue introuvable')
  assertPlateforme(identity, ligne.plateformeId, COO.perimetre)
  if (ligne.version !== version)
    throw new ConflictError(
      'Cet élément a été modifié par un autre utilisateur : rechargez la page.',
      {
        ...COO.version,
        details: { versionAttendue: version },
      },
    )
  const a_reprendre = (await lignesThemeModifie(tx, [ligne.plateformeId])).find(
    (l) => l.ligneAttendueId === ligne.id,
  )
  if (!a_reprendre)
    throw new ConflictError(
      'Rien à reprendre : Circé a déjà le thème de Broadcast pour cette ligne.',
      {
        code: 'COO_RIEN_A_REPRENDRE',
        regle: 'RG-COO-068',
      },
    )
  const affiches = await tx.affiche.findMany({ where: { id: { in: a_reprendre.affiches } } })
  for (const a of affiches) {
    // RG-X-057 : l'affiche doit encore être rattachée (identifiée) à la ligne : sinon rien n'est écrit.
    if (a.statut !== 'IDENTIFIEE')
      throw new ConflictError('L’affiche n’est plus rattachée : rechargez la page.', {
        code: 'COO_RIEN_A_REPRENDRE',
        regle: 'RG-X-057',
      })
    await updateWithVersion({
      expectedVersion: a.version,
      update: (where) =>
        tx.affiche.updateMany({
          where: { id: a.id, ...where },
          data: {
            theme: ligne.theme,
            feuilleARefaire: true,
            updatedById: identity.userId,
            ...bumpVersion,
          },
        }),
      ...COO.version,
    })
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: a.id,
      action: 'MODIFICATION_THEME',
      parId: identity.userId,
      ancienneValeur: a.theme,
      nouvelleValeur: ligne.theme,
      complement: 'Repris de la version Broadcast (RG-COO-068)',
    })
  }
  const prod = a_reprendre.productionLancee
  if (ligne.contNum !== null)
    await ecrireJournal(tx, {
      typeEntite: 'DOSSIER',
      entiteId: ligne.contNum,
      action: 'REPRISE_THEME_BROADCAST',
      parId: identity.userId,
      ancienneValeur: a_reprendre.themeCirce,
      nouvelleValeur: ligne.theme,
      complement: 'RG-COO-068',
      donnees: {
        ligneAttendueId: ligne.id,
        affiches: a_reprendre.affiches,
        productionLancee: prod,
        mailAtelier: prod ? 'à envoyer (Q-375)' : null,
      },
    })
  return {
    affiches: affiches.length,
    productionLancee: prod,
    mailEnvoye: false,
    message:
      `Thème « ${ligne.theme ?? '—'} » repris de Broadcast pour le dossier ${String(ligne.contNum ?? '—')}.` +
      (prod
        ? ' Production lancée : l’atelier est à prévenir (mail aux chefs d’équipe non envoyé par Circé, Q-375).'
        : ''),
  }
}

// RG-COO-068 / RG-X-057 (ECR-COO-02, « Reprendre la version Broadcast » de la fiche dossier) : toutes les lignes
// modifiées du dossier sont reprises dans UNE transaction (celle de l'appelant) : si une ligne échoue (version
// périmée, rien à reprendre, affiche plus rattachée), aucune n'est reprise. Chaque ligne doit appartenir au dossier.
export async function reprendreThemesDossier(
  tx: Tx,
  identity: Identity,
  input: { contNum: number; lignes: { ligneAttendueId: number; version: number }[] },
) {
  assertDroitCoordination(identity, 'broadcast.version.appliquer', 'RG-COO-068')
  const ids = [...new Set(input.lignes.map((l) => l.ligneAttendueId))]
  if (ids.length !== input.lignes.length)
    throw new ValidationError('Une ligne est citée deux fois.', { regle: 'RG-COO-068' })
  const lignes = await tx.receptionAttendue.findMany({
    where: { id: { in: ids } },
    select: { id: true, contNum: true },
  })
  for (const id of ids) {
    const l = lignes.find((x) => x.id === id)
    if (!l) throw new NotFoundError('Ligne attendue introuvable')
    if (l.contNum !== input.contNum)
      throw new ValidationError(
        `La ligne ${String(id)} n’appartient pas au dossier ${String(input.contNum)}.`,
        { regle: 'RG-COO-068' },
      )
  }
  let affiches = 0
  let productionLancee = false
  const repris: string[] = []
  for (const l of input.lignes) {
    const r = await reprendreThemeBroadcast(tx, identity, l.ligneAttendueId, l.version)
    affiches += r.affiches
    productionLancee ||= r.productionLancee
    const theme = (
      await tx.receptionAttendue.findUniqueOrThrow({
        where: { id: l.ligneAttendueId },
        select: { theme: true },
      })
    ).theme
    repris.push(`« ${theme ?? '—'} »`)
  }
  return {
    affiches,
    productionLancee,
    mailEnvoye: false,
    message:
      `Thème ${repris.join(', ')} repris de Broadcast pour le dossier ${String(input.contNum)} (${String(affiches)} affiche(s)).` +
      (productionLancee
        ? ' Production lancée : l’atelier est à prévenir (mail aux chefs d’équipe non envoyé par Circé, Q-375).'
        : ''),
  }
}
