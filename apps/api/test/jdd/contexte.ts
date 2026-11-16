// Contexte commun des générateurs de JDD (étape 9) : seed, graine PRNG, semaines propres à la seed, sites isolés
// (une plateforme, ses ateliers, ses utilisateurs par profil), appels d'API avec clés d'idempotence déterministes,
// journal des vérifications (rejets attendus, etc.). Toutes les données passent par la base de TEST uniquement.
import { lundiSemaineIso, semaineIsoDe, type Role, type SemaineIso } from '@circe/shared'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import { type Ctx } from '../support/reception.ts'
import { creerRng, type Rng } from './prng.ts'

export type Headers = Record<string, string>
export const PROFILS: readonly Role[] = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']

export interface VerificationJdd {
  scenario: string
  nom: string
  ok: boolean
  /** Ce qui était attendu / ce qui a été obtenu (message d'échec lisible). */
  attendu: string
  obtenu: string
  regle: string | null
}

export interface Utilisateur {
  id: number
  headers: Headers
  ext: string
}

export interface SiteJdd {
  plateforme: { id: number; nom: string }
  supports: { id: number; nom: string }[]
  imprimeurId: number
  livreurId: number
  photoBlId: number
  ateliers: { fixe: { id: number }; scroll: { id: number }; scroll2: { id: number } }
  destinataires: { id: number }[]
  users: Record<Role, Utilisateur>
}

export interface Jdd {
  readonly ctx: Ctx
  readonly rng: Rng
  readonly seed: number
  readonly volume: number
  /** Semaine ISO courante : semaine des lignes attendues (les réceptions la visent, comme les tests existants). */
  readonly semaine: SemaineIso
  /** Semaine de départ des trains, propre à la seed (isolation : aucune autre seed ne partage ce départ). */
  readonly depart: SemaineIso
  scenario: string
  readonly verifications: VerificationJdd[]
  readonly compteurs: Record<string, number>
  contNum(): number
  cle(): Headers
  compter(nom: string, n?: number): void
  reinitialiserCompteurs(): void
  /** Enregistre une vérification (rejet attendu, invariant local...). */
  verifier(nom: string, ok: boolean, attendu: string, obtenu: string, regle?: string): void
}

const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))

/** Seeds acceptées : 1 à 999 (le compteur des factories et les n° de dossier sont dérivés de la seed). */
export function creerJdd(ctx: Ctx, seed: number, volume: number): Jdd {
  if (!Number.isInteger(seed) || seed < 1 || seed > 999)
    throw new Error(`seed invalide (${String(seed)}) : entier de 1 à 999`)
  const semaine = semaineIsoDe(new Date())
  let numero = 0
  let cles = 0
  const jdd: Jdd = {
    ctx,
    rng: creerRng(seed * 7919),
    seed,
    volume,
    semaine,
    depart: plus(semaine, 2 + (seed % 6)),
    scenario: '',
    verifications: [],
    compteurs: {},
    // N° de dossier à 6 chiffres (RG-REC-013), plage de 100 000 propre à (seed mod 9) : une même base ne porte jamais deux
    // seeds de même reste en même temps (les générateurs purgent) ; jamais plus de 99 999 dossiers par seed.
    contNum: () => {
      if (++numero > 99_999) throw new Error('trop de dossiers pour une seed (99 999 maximum)')
      return 100_000 + (seed % 9) * 100_000 + numero
    },
    cle: () => ({ 'idempotency-key': `jdd-${String(seed)}-${String(++cles)}` }),
    reinitialiserCompteurs: () => {
      for (const k of Object.keys(jdd.compteurs)) Reflect.deleteProperty(jdd.compteurs, k)
    },
    compter: (nom, n = 1) => {
      jdd.compteurs[nom] = (jdd.compteurs[nom] ?? 0) + n
    },
    verifier: (nom, ok, attendu, obtenu, regle) => {
      jdd.verifications.push({
        scenario: jdd.scenario,
        nom,
        ok,
        attendu,
        obtenu,
        regle: regle ?? null,
      })
    },
  }
  return jdd
}

/** Site isolé : plateforme, ateliers (fixe, deux déroulants), formats, destinataires, un utilisateur par profil. */
export async function creerSite(
  jdd: Jdd,
  o: { destinataires?: number; formats?: number; nom?: string } = {},
): Promise<SiteJdd> {
  const { db } = jdd.ctx
  const plateforme = await f.createPlateforme(db, o.nom ? { nom: o.nom } : {})
  const supports = []
  for (let i = 0; i < (o.formats ?? 2); i++)
    supports.push(await f.createSupport(db, { poids: 1 + i, qteUm: i === 0 ? null : 40 }))
  const [imprimeur, livreur] = await Promise.all([f.createImprimeur(db), f.createLivreur(db)])
  const [fixe, scroll, scroll2] = await Promise.all([
    f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' }),
    f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' }),
    f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' }),
  ])
  const destinataires = []
  for (let i = 0; i < (o.destinataires ?? 3); i++)
    destinataires.push(
      await f.createDestinataire(db, { nom: `Destinataire JDD ${String(f.next())}` }),
    )
  const users = {} as Record<Role, Utilisateur>
  for (const r of PROFILS) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, ext: u.identifiantExterne, headers: devHeaders(u.identifiantExterne) }
  }
  const photoBlId = (
    await f.createPhoto(db, { intitule: 'bl-jdd.png', taille: 16, createdById: users.recep.id })
  ).id
  return {
    plateforme,
    supports,
    imprimeurId: imprimeur.id,
    livreurId: livreur.id,
    photoBlId,
    ateliers: { fixe, scroll, scroll2 },
    destinataires,
    users,
  }
}

/** Utilisateur supplémentaire (autre site, aucun rôle...) pour les scénarios de profils. */
export async function creerUtilisateur(
  jdd: Jdd,
  roles: Role[],
  plateformeIds: number[],
): Promise<Utilisateur> {
  const u = await f.createUtilisateurAvecRoles(
    jdd.ctx.db,
    roles,
    plateformeIds.map((plateformeId) => ({ plateformeId })),
  )
  return { id: u.id, ext: u.identifiantExterne, headers: devHeaders(u.identifiantExterne) }
}
