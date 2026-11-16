// COO-P13 — tests d'INTÉGRATION du colisage, de l'expédition et de la fin de journée (ECR-EXP-01 / ECR-EXP-02) :
// RG-COO-263 à 271, RG-COO-280, RG-COO-249 (garde « UM dans un colis »), RG-X-087 (sorties de stock), RG-COO-167.
// API réelle sur la base de test (test.db), données par les factories, purgées dans l'afterAll. Aucun test unitaire.
// Absences vérifiées : RG-COO-260 / 261 / 262 (création des UM : voir liberation-colisage.int.test.ts, Q-265), RG-COO-272 à 276 (AMT non repris,
// Q-274). Hypothèses : Q-197 (cette session), Q-272, Q-273, Q-284, Q-285, Q-375.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AColiserSchema,
  FicheColisSchema,
  ListeColisSchema,
  ResultatColisSchema,
  ResultatFinDeJourneeSchema,
  formatSemaineIso,
  semaineIsoDe,
  type Role,
} from '@circe/shared'
import type { StatutProduction } from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { avecEchec, parametre, restaurerParametres, ROLES } from '../support/export-trains.ts'
import { contexteReception, erreur, get, idem, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx

type H = Record<string, string>
const SEM = semaineIsoDe(new Date())
const DEPART = formatSemaineIso(SEM)
const A = (n: number) => 700_000 + n

const purge = {
  plateformes: [] as number[],
  ateliers: [] as number[],
  dossiers: [] as number[],
  destinataires: [] as number[],
}

beforeAll(async () => {
  await ctx.demarrer()
})

afterAll(async () => {
  await restaurerParametres()
  const essayer = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch {
      // purge au mieux : la base de test est recréée à chaque exécution
    }
  }
  const plateformeIn = { in: purge.plateformes }
  await essayer(() =>
    db.uniteColis.deleteMany({ where: { colis: { plateformeId: plateformeIn } } }),
  )
  await essayer(() => db.colis.deleteMany({ where: { plateformeId: plateformeIn } }))
  await essayer(() =>
    db.mouvement.deleteMany({ where: { affiche: { plateformeId: plateformeIn } } }),
  )
  await essayer(() => db.affiche.deleteMany({ where: { plateformeId: plateformeIn } }))
  await essayer(() => db.faceTrain.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() => db.instruction.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() => db.dossier.deleteMany({ where: { id: { in: purge.dossiers } } }))
  await essayer(() => db.repartition.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() =>
    db.uniteManutention.deleteMany({ where: { atelierId: { in: purge.ateliers } } }),
  )
  await essayer(() =>
    db.transportDestinataire.deleteMany({ where: { atelierId: { in: purge.ateliers } } }),
  )
  // Les ateliers et destinataires sont purgés : le flux « Destinataires » (RG-COO-120) crée une ligne de transport
  // par destinataire × atelier ; des milliers de couples laissés par les tests ralentissent les passages
  // d'intégration au-delà de leur délai (ANO-043).
  await essayer(() => db.rouleur.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() =>
    db.receptionAttendue.deleteMany({ where: { plateformeId: { in: purge.plateformes } } }),
  )
  for (const id of purge.ateliers) await essayer(() => db.atelier.delete({ where: { id } }))
  for (const id of purge.destinataires)
    await essayer(() => db.destinataire.delete({ where: { id } }))
  await ctx.arreter()
  // Purge volumineuse (colis, UM, ateliers, destinataires, transports) : délai explicite de 60 s, la base de test
  // grossit avec la suite (ANO-043).
}, 60_000)

// ───────────────────────── données ─────────────────────────

/** Site : atelier FIXE + atelier SCROLL, support de 2 kg, deux destinataires, un utilisateur par rôle. */
async function siteColis() {
  const plateforme = await f.createPlateforme(db)
  const fixe = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
  const scroll = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' })
  const support = await f.createSupport(db, { poids: 2 })
  const dest = [
    await f.createDestinataire(db, { nom: `Dest A ${String(next())}`, mail: 'a@test.fr' }),
    await f.createDestinataire(db, { nom: `Dest B ${String(next())}` }),
  ] as const
  const users = {} as Record<Role, { id: number; headers: H }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, headers: devHeaders(u.identifiantExterne) }
  }
  purge.plateformes.push(plateforme.id)
  purge.ateliers.push(fixe.id, scroll.id)
  purge.destinataires.push(dest[0].id, dest[1].id)
  return { plateforme, fixe, scroll, support, dest, users }
}
type Site = Awaited<ReturnType<typeof siteColis>>

interface OptUm {
  qte?: number
  statut?: StatutProduction
  dest?: 0 | 1
  atelierId?: number
  contNum?: number
  theme?: string
  semaine?: { annee: number; semaine: number }
}
function um(s: Site, o: OptUm = {}) {
  const sem = o.semaine ?? SEM
  return f.createUniteManutention(db, {
    atelierId: o.atelierId ?? s.fixe.id,
    supportId: s.support.id,
    destinataireId: s.dest[o.dest ?? 0].id,
    qte: o.qte ?? 10,
    statut: o.statut ?? 'EN_COURS',
    contNum: o.contNum ?? A(next()),
    theme: o.theme ?? `Thème ${String(next())}`,
    semAnnee: sem.annee,
    semNum: sem.semaine,
  })
}

/** Train de `n` faces (atelier déroulant) prêt pour le colisage. */
async function train(
  s: Site,
  o: {
    statut?: StatutProduction
    n?: number
    dest?: 0 | 1
    trainId?: string
    rouleur?: boolean
  } = {},
) {
  const trainId = o.trainId ?? `9${String(next()).padStart(15, '0')}`
  const faces = []
  for (let k = 0; k < (o.n ?? 2); k++) {
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    purge.dossiers.push(dossier.id)
    const i = await f.createInstruction(db, {
      atelierId: s.scroll.id,
      dossierId: dossier.id,
      contNum: dossier.contNum,
      statut: 'PRET_A_PRODUIRE',
    })
    faces.push(
      await f.createFaceTrain(db, {
        instructionCode: i.code,
        statut: o.statut ?? 'AU_ROULAGE',
        atelierId: s.scroll.id,
        supportId: s.support.id,
        destinataireId: s.dest[o.dest ?? 0].id,
        contNum: dossier.contNum,
        dateDepart: new Date(),
        depAnbas: SEM.annee,
        depSembas: SEM.semaine,
        trainId,
        theme: `Thème train ${String(next())}`,
        ...(o.rouleur
          ? { rouleurId: (await f.createRouleur(db, { atelierId: s.scroll.id })).id }
          : {}),
      }),
    )
  }
  return { trainId, faces }
}

// ───────────────────────── appels ─────────────────────────

const U = '/api/coordination/colis'
const ecrire = (s: Site, role: Role, chemin: string, payload: unknown, cle?: H) =>
  ctx.app.inject({
    method: 'POST',
    url: `${U}${chemin}`,
    headers: { ...s.users[role].headers, ...(cle ?? idem()) },
    payload: payload as object,
  })
const lire = (s: Site, role: Role, chemin = '') => get(ctx, `${U}${chemin}`, s.users[role].headers)

async function ouvrir(s: Site, o: { atelier?: 'fixe' | 'scroll'; dest?: 0 | 1; role?: Role } = {}) {
  const r = await ecrire(s, o.role ?? 'expe', '', {
    atelierId: (o.atelier === 'scroll' ? s.scroll : s.fixe).id,
    destinataireId: s.dest[o.dest ?? 0].id,
  })
  expect(r.statusCode, r.body).toBe(200)
  const fiche = ResultatColisSchema.parse(r.json()).colis
  if (!fiche) throw new Error('colis non créé')
  return fiche
}
const code = (u: { id: number; codeBarre: string | null }) => u.codeBarre ?? `UM-${String(u.id)}`
async function ajouter(
  s: Site,
  colis: { id: number; version: number },
  u: { id: number; codeBarre: string | null },
  quantite?: number,
  role: Role = 'expe',
) {
  return ecrire(s, role, `/${String(colis.id)}/unites`, {
    version: colis.version,
    code: code(u),
    ...(quantite ? { quantite } : {}),
  })
}
const fiche = async (s: Site, id: number) => {
  const r = await lire(s, 'expe', `/${String(id)}`)
  expect(r.statusCode, r.body).toBe(200)
  return FicheColisSchema.parse(r.json())
}
const umLue = (id: number) => db.uniteManutention.findUniqueOrThrow({ where: { id } })
const colisLu = (id: number) => db.colis.findUniqueOrThrow({ where: { id } })
const resultat = (r: { json: () => unknown }) => ResultatColisSchema.parse(r.json())

/** Colis ouvert contenant une UM (EN_COURS → PREPARE). */
async function colisAvecUm(s: Site, o: OptUm & { quantite?: number } = {}) {
  const u = await um(s, o)
  const c = await ouvrir(s, { dest: o.dest })
  const r = await ajouter(s, c, u, o.quantite)
  expect(r.statusCode, r.body).toBe(200)
  const maj = resultat(r).colis
  if (!maj) throw new Error('colis absent')
  return { u, colis: maj }
}

// ───────────────────────── RG-COO-266 : création, ouverture, suppression ─────────────────────────

describe('RG-COO-266 création, ouverture et suppression d’un colis', () => {
  it('RG-COO-266 crée un colis « Colis ouvert » : code C- sur 18 chiffres, format « À définir » (5), poids minimum 1 kg, historique', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    expect(c.statut).toBe('EN_COURS')
    expect(c.code).toBe(`C-${String(c.id).padStart(18, '0')}`)
    expect(c.formatCode).toBe(5)
    expect(c.poids).toBe(1)
    expect(c.nbUnites).toBe(0)
    expect(c.version).toBe(1)
    expect((await colisLu(c.id)).codeColis).toBe(c.code)
    expect(c.historique.map((h) => h.vers)).toEqual(['EN_COURS'])
    const journal = await db.journalAudit.findFirst({
      where: { typeEntite: 'COLIS', entiteId: String(c.id), action: 'CREATION_COLIS' },
    })
    expect(journal?.parId).toBe(s.users.expe.id)
  })

  it.each(['cheq', 'expe'] as const)('RG-COO-266 %s peut créer un colis', async (role) => {
    const s = await siteColis()
    await ouvrir(s, { role })
  })

  it.each(['coord', 'recep', 'com'] as const)(
    'RG-COO-165 %s ne crée pas de colis : 403 sans écriture',
    async (role) => {
      const s = await siteColis()
      const avant = await db.colis.count({ where: { plateformeId: s.plateforme.id } })
      const r = await ecrire(s, role, '', { atelierId: s.fixe.id, destinataireId: s.dest[0].id })
      expect(r.statusCode).toBe(403)
      expect(erreur(r).regle).toBe(role === 'com' ? 'RG-COO-168' : 'RG-COO-266')
      expect(await db.colis.count({ where: { plateformeId: s.plateforme.id } })).toBe(avant)
    },
  )

  it('RG-COO-266 refuse : atelier inconnu (404), destinataire inconnu (404), destinataire inactif (422), atelier hors périmètre (403)', async () => {
    const s = await siteColis()
    const autre = await siteColis()
    expect(
      (await ecrire(s, 'expe', '', { atelierId: 999_999_999, destinataireId: s.dest[0].id }))
        .statusCode,
    ).toBe(404)
    expect(
      (await ecrire(s, 'expe', '', { atelierId: s.fixe.id, destinataireId: 999_999_999 }))
        .statusCode,
    ).toBe(404)
    const inactif = await f.createDestinataire(db, { actif: false })
    const r = await ecrire(s, 'expe', '', { atelierId: s.fixe.id, destinataireId: inactif.id })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('COO_DESTINATAIRE_INACTIF')
    const hors = await ecrire(s, 'expe', '', {
      atelierId: autre.fixe.id,
      destinataireId: s.dest[0].id,
    })
    expect(hors.statusCode).toBe(403)
    expect(erreur(hors).regle).toBe('RG-COO-167')
  })

  it('RG-COO-266 supprime un colis vide ; refuse un colis non vide (409, rien supprimé) et une version périmée (409)', async () => {
    const s = await siteColis()
    const vide = await ouvrir(s)
    const perimee = await ecrire(s, 'expe', `/${String(vide.id)}/supprimer`, {
      version: vide.version + 5,
    })
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).code).toBe('COO_CONFLIT_VERSION')
    const ok = await ecrire(s, 'expe', `/${String(vide.id)}/supprimer`, { version: vide.version })
    expect(ok.statusCode, ok.body).toBe(200)
    expect(resultat(ok).supprime).toBe(true)
    expect(await db.colis.count({ where: { id: vide.id } })).toBe(0)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(vide.id), action: 'SUPPRESSION_COLIS' },
      }),
    ).toBe(1)

    const { colis } = await colisAvecUm(s)
    const refus = await ecrire(s, 'expe', `/${String(colis.id)}/supprimer`, {
      version: colis.version,
    })
    expect(refus.statusCode).toBe(409)
    expect(erreur(refus).code).toBe('COO_COLIS_NON_VIDE')
    expect(await db.colis.count({ where: { id: colis.id } })).toBe(1)
    expect((await ecrire(s, 'expe', '/999999999/supprimer', { version: 1 })).statusCode).toBe(404)
  })

  it('RG-COO-266 / Q-272 un colis clos ne se rouvre pas (409) ; un colis déjà ouvert n’a pas de transition « ouvrir » (409)', async () => {
    const s = await siteColis()
    const { colis } = await colisAvecUm(s)
    const deja = await ecrire(s, 'expe', `/${String(colis.id)}/ouvrir`, { version: colis.version })
    expect(deja.statusCode).toBe(409)
    expect(erreur(deja).code).toBe('TRANSITION_INTERDITE')
    const exp = await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, { version: colis.version })
    expect(exp.statusCode, exp.body).toBe(200)
    const clos = await fiche(s, colis.id)
    const rouvrir = await ecrire(s, 'expe', `/${String(colis.id)}/ouvrir`, {
      version: clos.version,
    })
    expect(rouvrir.statusCode).toBe(409)
    expect(erreur(rouvrir).code).toBe('COO_COLIS_NON_ROUVRABLE')
    expect((await colisLu(colis.id)).statut).toBe('A_EXPEDIER')
    const perimee = await ecrire(s, 'expe', `/${String(colis.id)}/ouvrir`, { version: 1 })
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).code).toBe('COO_CONFLIT_VERSION')
  })
})

// ───────────────────────── RG-COO-265 / 264 / 263 : ajout d’une UM, fractionnement, poids ─────────────────────────

describe('RG-COO-265 rattachement d’une UM à un colis', () => {
  it('RG-COO-265 ajoute une UM « En cours » (par code barre) : ligne UM ↔ colis, UM → « Préparé », poids, version', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c = await ouvrir(s)
    const r = await ajouter(s, c, u)
    expect(r.statusCode, r.body).toBe(200)
    const maj = resultat(r).colis
    expect(maj?.nbUnites).toBe(1)
    expect(maj?.quantite).toBe(10)
    expect(maj?.poids).toBe(20) // 10 affiches × 2 kg (RG-COO-263)
    expect(maj?.version).toBe(c.version + 1)
    expect(maj?.depart).toBe(DEPART)
    expect(maj?.unites[0]).toMatchObject({ uniteId: u.id, quantite: 10, quantiteTotale: 10 })
    expect((await umLue(u.id)).statut).toBe('PREPARE')
    const histo = await db.statutHistorique.findFirst({
      where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(u.id), nouveau: 'PREPARE' },
    })
    expect(histo?.regle).toBe('RG-COO-265')
  })

  it('RG-COO-265 accepte aussi le code UM-<id> et une UM « Préparé » (statuts 1 ou 6 seulement)', async () => {
    const s = await siteColis()
    const prepare = await um(s, { statut: 'PREPARE', qte: 4 })
    const c = await ouvrir(s)
    const r = await ecrire(s, 'expe', `/${String(c.id)}/unites`, {
      version: c.version,
      code: `UM-${String(prepare.id)}`,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect((await umLue(prepare.id)).statut).toBe('PREPARE')
  })

  it.each(['ERREUR', 'ANNULE', 'A_EXPEDIER', 'TERMINE', 'A_TRAITER', 'AU_ROULAGE'] as const)(
    'RG-COO-265 refuse une UM au statut %s : « L’UM n’existe pas ou n’est pas en cours ou préparée » (422), rien écrit',
    async (statut) => {
      const s = await siteColis()
      const u = await um(s, { statut })
      const c = await ouvrir(s)
      const r = await ajouter(s, c, u)
      expect(r.statusCode).toBe(422)
      expect(erreur(r).code).toBe('COO_UM_NON_COLISABLE')
      expect(erreur(r).message).toBe("L'UM n'existe pas ou n'est pas en cours ou préparée")
      expect(await db.uniteColis.count({ where: { colisId: c.id } })).toBe(0)
      expect((await umLue(u.id)).statut).toBe(statut)
      expect((await colisLu(c.id)).version).toBe(c.version)
    },
  )

  it('RG-COO-265 refuse un code inconnu (422), un destinataire différent (422), un autre atelier (422) et une UM déjà dans le colis (422)', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    const inconnu = await ecrire(s, 'expe', `/${String(c.id)}/unites`, {
      version: c.version,
      code: 'INCONNU-1',
    })
    expect(inconnu.statusCode).toBe(422)
    const autreDest = await um(s, { dest: 1 })
    const r1 = await ajouter(s, c, autreDest)
    expect(r1.statusCode).toBe(422)
    expect(erreur(r1).code).toBe('COO_UM_DESTINATAIRE')
    expect(erreur(r1).message).toBe('Le destinataire de l’UM ne correspond pas à celle du colis')
    const autreAtelier = await db.atelier.create({
      data: { plateformeId: s.plateforme.id, libelle: 'Autre atelier', type: 'FIXE' },
    })
    purge.ateliers.push(autreAtelier.id)
    const r2 = await ajouter(s, c, await um(s, { atelierId: autreAtelier.id }))
    expect(r2.statusCode).toBe(422)
    expect(erreur(r2).code).toBe('COO_UM_DESTINATAIRE')
    const { u, colis } = await colisAvecUm(s)
    const deja = await ajouter(s, colis, u, 1)
    expect(deja.statusCode).toBe(422)
    expect(erreur(deja).code).toBe('COO_UM_DEJA_DANS_COLIS')
  })

  it('RG-COO-265 refuse l’ajout dans un colis clos (409) ; version périmée (409) ; colis inconnu (404)', async () => {
    const s = await siteColis()
    const { colis } = await colisAvecUm(s)
    await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, { version: colis.version })
    const clos = await fiche(s, colis.id)
    const r = await ajouter(s, clos, await um(s))
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_COLIS_CLOS')
    const ouvert = await ouvrir(s)
    const perimee = await ajouter(s, { id: ouvert.id, version: ouvert.version + 3 }, await um(s))
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).code).toBe('COO_CONFLIT_VERSION')
    expect((await ajouter(s, { id: 999_999_999, version: 1 }, await um(s))).statusCode).toBe(404)
  })
})

describe('RG-COO-264 fractionnement d’une UM sur plusieurs colis', () => {
  it('RG-COO-264 une UM de 10 se place en 4 puis 6 dans deux colis ; Σ uc_qte ≤ UM_qte (7 après 4 : 422)', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c1 = await ouvrir(s)
    const c2 = await ouvrir(s)
    const r1 = await ajouter(s, c1, u, 4)
    expect(r1.statusCode, r1.body).toBe(200)
    const trop = await ajouter(s, c2, u, 7)
    expect(trop.statusCode).toBe(422)
    expect(erreur(trop).code).toBe('COO_UM_QUANTITE_DEPASSEE')
    expect(erreur(trop).regle).toBe('RG-COO-264')
    expect(await db.uniteColis.count({ where: { uniteId: u.id } })).toBe(1)
    const r2 = await ajouter(s, c2, u) // par défaut : le reste à placer
    expect(r2.statusCode, r2.body).toBe(200)
    expect(resultat(r2).colis?.unites[0]?.quantite).toBe(6)
    expect((await umLue(u.id)).statut).toBe('PREPARE')
    // plus rien à placer : un 3e colis est refusé
    const c3 = await ouvrir(s)
    expect((await ajouter(s, c3, u)).statusCode).toBe(422)
  })

  it('RG-COO-264 refuse une quantité nulle ou négative (400)', async () => {
    const s = await siteColis()
    const u = await um(s)
    const c = await ouvrir(s)
    for (const quantite of [0, -1])
      expect(
        (
          await ecrire(s, 'expe', `/${String(c.id)}/unites`, {
            version: c.version,
            code: code(u),
            quantite,
          })
        ).statusCode,
      ).toBe(400)
    expect(await db.uniteColis.count({ where: { colisId: c.id } })).toBe(0)
  })
})

describe('RG-COO-263 poids du colis', () => {
  it('RG-COO-263 Σ (uc_qte × poids du support), minimum 1 kg ; recalculé au retrait', async () => {
    const s = await siteColis()
    const petite = await um(s, { qte: 0 })
    const c = await ouvrir(s)
    // une UM de quantité nulle ne peut pas être placée (reste ≤ 0) : le poids reste au minimum
    expect((await ajouter(s, c, petite)).statusCode).toBe(422)
    expect((await colisLu(c.id)).poids?.toString()).toBe('1')
    const u1 = await um(s, { qte: 3 })
    const u2 = await um(s, { qte: 5 })
    const r1 = resultat(await ajouter(s, c, u1)).colis
    const r2 = resultat(await ajouter(s, r1 ?? c, u2)).colis
    expect(r2?.poids).toBe(16) // (3 + 5) × 2 kg
    const apres = await ecrire(s, 'expe', `/${String(c.id)}/retirer`, {
      version: r2?.version ?? 0,
      unites: [u2.id],
    })
    expect(resultat(apres).colis?.poids).toBe(6)
  })

  it('RG-COO-263 +3 kg pour les ateliers du paramètre `colis.ateliersMajoration` (8 m²), sans cumul', async () => {
    const s = await siteColis()
    await parametre(ctx, 'colis.ateliersMajoration', String(s.fixe.id))
    const c = await ouvrir(s)
    expect(c.poids).toBe(4) // minimum 1 kg + 3 kg
    const u = await um(s, { qte: 2 })
    const maj = resultat(await ajouter(s, c, u)).colis
    expect(maj?.poids).toBe(7) // 2 × 2 + 3
    const encore = resultat(
      await ecrire(s, 'expe', `/${String(c.id)}/retirer`, {
        version: maj?.version ?? 0,
        unites: [u.id],
      }),
    )
    expect(encore.supprime).toBe(true)
    await parametre(ctx, 'colis.ateliersMajoration', '')
  })

  it('RG-COO-263 sans UM : Σ (faces × poids du support) pour un colis de train', async () => {
    const s = await siteColis()
    const t = await train(s, { n: 3 })
    const c = await ouvrir(s, { atelier: 'scroll' })
    const r = await ecrire(s, 'expe', `/${String(c.id)}/trains`, {
      version: c.version,
      trainId: t.trainId,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(resultat(r).colis?.poids).toBe(6) // 3 faces × 2 kg
  })
})

// ───────────────────────── RG-COO-270 : train ajouté à un colis ─────────────────────────

describe('RG-COO-270 train ajouté à un colis', () => {
  it.each(['A_IMPRIMER', 'EXPORT_PREPA', 'AU_ROULAGE'] as const)(
    'RG-COO-270 les faces %s passent à « A expédier » (7) avec le colis, historique',
    async (statut) => {
      const s = await siteColis()
      const t = await train(s, { statut })
      const c = await ouvrir(s, { atelier: 'scroll' })
      const r = await ecrire(s, 'expe', `/${String(c.id)}/trains`, {
        version: c.version,
        trainId: t.trainId,
      })
      expect(r.statusCode, r.body).toBe(200)
      expect(resultat(r).colis).toMatchObject({ nbTrains: 1, quantite: 2 })
      for (const face of t.faces) {
        const lue = await db.faceTrain.findUniqueOrThrow({ where: { id: face.id } })
        expect(lue.statut).toBe('A_EXPEDIER')
        expect(lue.colisId).toBe(c.id)
        const h = await db.statutHistorique.findFirst({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(face.id), nouveau: 'A_EXPEDIER' },
        })
        expect(h?.ancien).toBe(statut)
        expect(h?.regle).toBe('RG-COO-270')
      }
    },
  )

  it('RG-COO-270 refuse : colis d’atelier fixe (422), train déjà dans un colis (422), autre destinataire (422), inconnu (404)', async () => {
    const s = await siteColis()
    const t = await train(s)
    const fixe = await ouvrir(s)
    const r0 = await ecrire(s, 'expe', `/${String(fixe.id)}/trains`, {
      version: fixe.version,
      trainId: t.trainId,
    })
    expect(r0.statusCode).toBe(422)
    expect(erreur(r0).code).toBe('COO_COLIS_ATELIER_FIXE')
    const c = await ouvrir(s, { atelier: 'scroll' })
    const ok = await ecrire(s, 'expe', `/${String(c.id)}/trains`, {
      version: c.version,
      trainId: t.trainId,
    })
    expect(ok.statusCode, ok.body).toBe(200)
    const c2 = await ouvrir(s, { atelier: 'scroll' })
    const deja = await ecrire(s, 'expe', `/${String(c2.id)}/trains`, {
      version: c2.version,
      trainId: t.trainId,
    })
    expect(deja.statusCode).toBe(422)
    expect(erreur(deja).message).toBe('Il existe déjà un train dans ce colis')
    const autre = await train(s, { dest: 1 })
    const r3 = await ecrire(s, 'expe', `/${String(c2.id)}/trains`, {
      version: c2.version,
      trainId: autre.trainId,
    })
    expect(r3.statusCode).toBe(422)
    expect(erreur(r3).message).toBe('Le destinataire du train ne correspond pas à celui du colis')
    expect(
      (
        await ecrire(s, 'expe', `/${String(c2.id)}/trains`, {
          version: c2.version,
          trainId: 'INCONNU',
        })
      ).statusCode,
    ).toBe(404)
  })

  it.each(['INSTRUCTION_OK', 'EN_COURS', 'A_EXPEDIER', 'TERMINE'] as const)(
    'RG-COO-270 / RG-COO-307 une face au statut %s ne peut pas entrer dans un colis : 409 TRANSITION_INTERDITE, rien écrit',
    async (statut) => {
      const s = await siteColis()
      const t = await train(s, { statut })
      const c = await ouvrir(s, { atelier: 'scroll' })
      const r = await ecrire(s, 'expe', `/${String(c.id)}/trains`, {
        version: c.version,
        trainId: t.trainId,
      })
      expect(r.statusCode).toBe(409)
      expect(erreur(r).code).toBe('TRANSITION_INTERDITE')
      expect((await colisLu(c.id)).version).toBe(c.version)
      for (const face of t.faces)
        expect(
          (await db.faceTrain.findUniqueOrThrow({ where: { id: face.id } })).colisId,
        ).toBeNull()
    },
  )
})

// ───────────────────────── RG-COO-267 : retrait ─────────────────────────

describe('RG-COO-267 retrait d’une UM ou d’un train d’un colis', () => {
  it('RG-COO-267 retirer le dernier colis d’une UM : UM « Préparé » → « En cours » ; poids recalculé ; colis vidé supprimé', async () => {
    const s = await siteColis()
    const u1 = await um(s, { qte: 2 })
    const u2 = await um(s, { qte: 3 })
    const c = await ouvrir(s)
    const a = resultat(await ajouter(s, c, u1)).colis
    const b = resultat(await ajouter(s, a ?? c, u2)).colis
    const r = await ecrire(s, 'expe', `/${String(c.id)}/retirer`, {
      version: b?.version ?? 0,
      unites: [u1.id],
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(resultat(r).colis).toMatchObject({ nbUnites: 1, poids: 6 })
    expect((await umLue(u1.id)).statut).toBe('EN_COURS')
    expect((await umLue(u2.id)).statut).toBe('PREPARE')
    const histo = await db.statutHistorique.findFirst({
      where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(u1.id), nouveau: 'EN_COURS' },
    })
    expect(histo?.regle).toBe('RG-COO-267')
    const vide = await ecrire(s, 'expe', `/${String(c.id)}/retirer`, {
      version: resultat(r).colis?.version ?? 0,
      tout: true,
    })
    expect(resultat(vide).supprime).toBe(true)
    expect(await db.colis.count({ where: { id: c.id } })).toBe(0)
    expect((await umLue(u2.id)).statut).toBe('EN_COURS')
  })

  it('RG-COO-267 une UM fractionnée sur deux colis reste « Préparé » tant qu’elle est dans un autre colis', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c1 = await ouvrir(s)
    const c2 = await ouvrir(s)
    await ajouter(s, c1, u, 4)
    const m2 = resultat(await ajouter(s, c2, u, 6)).colis
    const r = await ecrire(s, 'expe', `/${String(c2.id)}/retirer`, {
      version: m2?.version ?? 0,
      unites: [u.id],
    })
    expect(resultat(r).supprime).toBe(true)
    expect((await umLue(u.id)).statut).toBe('PREPARE')
    expect(await db.uniteColis.count({ where: { uniteId: u.id } })).toBe(1)
  })

  it('RG-COO-267 retirer un train rend ses faces à leur statut d’avant (5 / 9 / 10) ; colis vidé supprimé', async () => {
    const s = await siteColis()
    const t = await train(s, { statut: 'EXPORT_PREPA' })
    const c = await ouvrir(s, { atelier: 'scroll' })
    const a = resultat(
      await ecrire(s, 'expe', `/${String(c.id)}/trains`, {
        version: c.version,
        trainId: t.trainId,
      }),
    ).colis
    const r = await ecrire(s, 'expe', `/${String(c.id)}/retirer`, {
      version: a?.version ?? 0,
      trains: [t.trainId],
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(resultat(r).supprime).toBe(true)
    for (const face of t.faces) {
      const lue = await db.faceTrain.findUniqueOrThrow({ where: { id: face.id } })
      expect(lue.statut).toBe('EXPORT_PREPA')
      expect(lue.colisId).toBeNull()
    }
  })

  it('RG-COO-267 refuse : colis clos (409), unité ou train absent du colis (404), sélection vide (400), version périmée (409)', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s)
    const autre = await um(s)
    const absent = await ecrire(s, 'expe', `/${String(colis.id)}/retirer`, {
      version: colis.version,
      unites: [autre.id],
    })
    expect(absent.statusCode).toBe(404)
    expect(
      (
        await ecrire(s, 'expe', `/${String(colis.id)}/retirer`, {
          version: colis.version,
          trains: ['X'],
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (await ecrire(s, 'expe', `/${String(colis.id)}/retirer`, { version: colis.version }))
        .statusCode,
    ).toBe(400)
    const perimee = await ecrire(s, 'expe', `/${String(colis.id)}/retirer`, {
      version: colis.version + 4,
      unites: [u.id],
    })
    expect(perimee.statusCode).toBe(409)
    expect(await db.uniteColis.count({ where: { colisId: colis.id } })).toBe(1)
    await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, { version: colis.version })
    const clos = await fiche(s, colis.id)
    const r = await ecrire(s, 'expe', `/${String(colis.id)}/retirer`, {
      version: clos.version,
      unites: [u.id],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_COLIS_CLOS')
    expect(await db.uniteColis.count({ where: { colisId: colis.id } })).toBe(1)
  })
})

// ───────────────────────── RG-COO-268 : expédition ─────────────────────────

describe('RG-COO-268 expédition d’un colis', () => {
  it('RG-COO-268 « Expédier » : colis → « A expédier », date, transporteur et tarif par défaut du couple destinataire × atelier, UM → « A expédier »', async () => {
    const s = await siteColis()
    await db.transportDestinataire.create({
      data: { destinataireId: s.dest[0].id, atelierId: s.fixe.id, transporteur: 2, tarif: 'T1' },
    })
    const { u, colis } = await colisAvecUm(s, { qte: 3 })
    const r = await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, {
      version: colis.version,
      codeExterne: 'EXT-42',
      commentaire: 'RAS',
      formatCode: 3,
    })
    expect(r.statusCode, r.body).toBe(200)
    const m = resultat(r).colis
    expect(m).toMatchObject({
      statut: 'A_EXPEDIER',
      codeExterne: 'EXT-42',
      transporteur: 2,
      tarif: 'T1',
      formatCode: 3,
    })
    expect(m?.dateExpedition).not.toBeNull()
    expect((await umLue(u.id)).statut).toBe('A_EXPEDIER')
    expect(m?.historique.map((h) => h.vers)).toEqual(['EN_COURS', 'A_EXPEDIER'])
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(colis.id), action: 'EXPEDITION_COLIS' },
      }),
    ).toBe(1)
  })

  it('RG-COO-268 le code externe « ETIQUETTES » est remis à vide ; sans transport par défaut : transporteur nul', async () => {
    const s = await siteColis()
    const { colis } = await colisAvecUm(s)
    const r = await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, {
      version: colis.version,
      codeExterne: 'ETIQUETTES',
    })
    expect(resultat(r).colis).toMatchObject({ codeExterne: null, transporteur: null, tarif: null })
  })

  it('RG-COO-268 une UM répartie sur deux colis n’est « A expédier » que lorsque tous ses colis sont clos (Q-272)', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c1 = await ouvrir(s)
    const c2 = await ouvrir(s)
    const m1 = resultat(await ajouter(s, c1, u, 4)).colis
    const m2 = resultat(await ajouter(s, c2, u, 6)).colis
    await ecrire(s, 'expe', `/${String(c1.id)}/expedier`, { version: m1?.version ?? 0 })
    expect((await umLue(u.id)).statut).toBe('PREPARE')
    await ecrire(s, 'expe', `/${String(c2.id)}/expedier`, { version: m2?.version ?? 0 })
    expect((await umLue(u.id)).statut).toBe('A_EXPEDIER')
  })

  it('RG-COO-268 refuse : colis vide (422), colis déjà expédié (409 TRANSITION_INTERDITE), version périmée (409), inconnu (404)', async () => {
    const s = await siteColis()
    const vide = await ouvrir(s)
    const r = await ecrire(s, 'expe', `/${String(vide.id)}/expedier`, { version: vide.version })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('COO_COLIS_VIDE')
    expect((await colisLu(vide.id)).statut).toBe('EN_COURS')
    const { colis } = await colisAvecUm(s)
    const perimee = await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, {
      version: colis.version + 9,
    })
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).code).toBe('COO_CONFLIT_VERSION')
    expect(
      (await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, { version: colis.version }))
        .statusCode,
    ).toBe(200)
    const clos = await fiche(s, colis.id)
    const bis = await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, { version: clos.version })
    expect(bis.statusCode).toBe(409)
    expect(erreur(bis).code).toBe('TRANSITION_INTERDITE')
    expect((await ecrire(s, 'expe', '/999999999/expedier', { version: 1 })).statusCode).toBe(404)
  })
})

// ───────────────────────── RG-COO-269 / RG-X-087 / RG-COO-271 : fin de journée ─────────────────────────

describe('RG-COO-269 fin de journée', () => {
  async function affiche(
    s: Site,
    u: { contNum: number | null; theme: string | null },
    stock: number,
    o: { plateformeId?: number } = {},
  ) {
    const a = await f.createAffiche(db, {
      plateformeId: o.plateformeId ?? s.plateforme.id,
      supportId: s.support.id,
      contNum: u.contNum,
      theme: u.theme,
      quantite: stock,
    })
    if (stock > 0) await f.createMouvement(db, { afficheId: a.id, quantite: stock })
    return a
  }
  const stockDe = async (afficheId: number) =>
    (await db.mouvement.aggregate({ _sum: { quantite: true }, where: { afficheId } }))._sum
      .quantite ?? 0
  const fin = (s: Site, role: Role = 'expe', cle?: H) => ecrire(s, role, '/fin-de-journee', {}, cle)

  async function colisExpedie(s: Site, o: OptUm & { quantite?: number } = {}) {
    const { u, colis } = await colisAvecUm(s, o)
    const r = await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, { version: colis.version })
    expect(r.statusCode, r.body).toBe(200)
    return { u, colis: resultat(r).colis ?? colis }
  }

  it('RG-COO-269 + RG-X-087 colis « A expédier » → « Terminé », UM → « Terminé », une sortie de stock « Expédition C-… » dans la même transaction', async () => {
    const s = await siteColis()
    const { u, colis } = await colisExpedie(s, { qte: 6 })
    const a = await affiche(s, u, 10)
    const r = await fin(s)
    expect(r.statusCode, r.body).toBe(200)
    const res = ResultatFinDeJourneeSchema.parse(r.json())
    expect(res).toMatchObject({
      colis: [colis.id],
      unites: 1,
      faces: 0,
      sortiesStock: 1,
      manquants: [],
    })
    expect(res.message).toBe('Fin de journée : 1 colis expédié(s), sorties de stock automatiques.')
    expect((await colisLu(colis.id)).statut).toBe('TERMINE')
    expect((await umLue(u.id)).statut).toBe('TERMINE')
    const mouvement = await db.mouvement.findFirstOrThrow({
      where: { afficheId: a.id, type: 'EXPEDITION' },
    })
    expect(mouvement).toMatchObject({ quantite: -6, auto: true, motif: `Expédition ${colis.code}` })
    expect(await stockDe(a.id)).toBe(4)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).quantite).toBe(4)
    const histo = await fiche(s, colis.id)
    expect(histo.historique.map((h) => h.vers)).toEqual(['EN_COURS', 'A_EXPEDIER', 'TERMINE'])
    expect(histo.statut).toBe('TERMINE')
  })

  it('RG-COO-269 idempotent : un 2e passage ne trouve plus de colis « A expédier » (« Aucun colis clos à expédier dans ce périmètre. »), aucune 2e sortie', async () => {
    const s = await siteColis()
    const { u } = await colisExpedie(s, { qte: 5 })
    const a = await affiche(s, u, 5)
    expect((await fin(s)).statusCode).toBe(200)
    const bis = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(bis).toMatchObject({
      colis: [],
      sortiesStock: 0,
      message: 'Aucun colis clos à expédier dans ce périmètre.',
    })
    expect(await db.mouvement.count({ where: { afficheId: a.id, type: 'EXPEDITION' } })).toBe(1)
  })

  it('RG-X-087 sortie prélevée FIFO sur plusieurs affiches ; stock jamais négatif : le manquant est tracé (Q-197 (9))', async () => {
    const s = await siteColis()
    const { u, colis } = await colisExpedie(s, { qte: 9 })
    const a1 = await affiche(s, u, 4)
    const a2 = await affiche(s, u, 3)
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res.sortiesStock).toBe(2)
    expect(res.manquants).toEqual([
      { colis: colis.id, uniteId: u.id, manquant: 2, raison: 'STOCK_INSUFFISANT' },
    ])
    expect(await stockDe(a1.id)).toBe(0)
    expect(await stockDe(a2.id)).toBe(0)
    expect((await colisLu(colis.id)).statut).toBe('TERMINE')
  })

  it('RG-X-087 aucune affiche reçue, ou affiche sans réception (stock nul) : aucune sortie, manquant tracé, le colis passe tout de même « Terminé »', async () => {
    const s = await siteColis()
    const sans = await colisExpedie(s, { qte: 3 })
    const jamaisRecue = await colisExpedie(s, { qte: 4 })
    await affiche(s, jamaisRecue.u, 0) // affiche créée mais aucune réception : stock nul
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res.sortiesStock).toBe(0)
    expect(res.manquants).toEqual(
      expect.arrayContaining([
        { colis: sans.colis.id, uniteId: sans.u.id, manquant: 3, raison: 'AUCUNE_AFFICHE' },
        {
          colis: jamaisRecue.colis.id,
          uniteId: jamaisRecue.u.id,
          manquant: 4,
          raison: 'STOCK_INSUFFISANT',
        },
      ]),
    )
    expect(
      await db.mouvement.count({
        where: { type: 'EXPEDITION', motif: { in: [`Expédition ${sans.colis.code}`] } },
      }),
    ).toBe(0)
  })

  it('RG-X-087 seules les affiches du même dossier, du même thème (casse et accents ignorés) et de la même plateforme sont prélevées', async () => {
    const s = await siteColis()
    const autre = await siteColis()
    const { u } = await colisExpedie(s, { qte: 2, theme: 'Été Été' })
    const bonne = await affiche(s, { contNum: u.contNum, theme: 'ETE ete' }, 5)
    const autreTheme = await affiche(s, { contNum: u.contNum, theme: 'Autre' }, 5)
    const autreDossier = await affiche(s, { contNum: A(next()), theme: u.theme }, 5)
    const autrePlateforme = await affiche(autre, u, 5)
    await fin(s)
    expect(await stockDe(bonne.id)).toBe(3)
    for (const a of [autreTheme, autreDossier, autrePlateforme]) expect(await stockDe(a.id)).toBe(5)
  })

  it('RG-X-087 fractionnement : chaque colis débite sa propre quantité uc_qte, une seule fois', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const a = await affiche(s, u, 10)
    const c1 = await ouvrir(s)
    const c2 = await ouvrir(s)
    const m1 = resultat(await ajouter(s, c1, u, 4)).colis
    const m2 = resultat(await ajouter(s, c2, u, 6)).colis
    await ecrire(s, 'expe', `/${String(c1.id)}/expedier`, { version: m1?.version ?? 0 })
    await fin(s) // c1 seul clos : UM encore « Préparé » (c2 ouvert)
    expect(await stockDe(a.id)).toBe(6)
    expect((await umLue(u.id)).statut).toBe('PREPARE')
    await ecrire(s, 'expe', `/${String(c2.id)}/expedier`, { version: m2?.version ?? 0 })
    await fin(s)
    expect(await stockDe(a.id)).toBe(0)
    expect((await umLue(u.id)).statut).toBe('TERMINE')
    expect(await db.mouvement.count({ where: { afficheId: a.id, type: 'EXPEDITION' } })).toBe(2)
  })

  it('RG-X-087 atomicité : un échec d’écriture d’un mouvement annule toute la fin de journée (colis, UM, stock inchangés)', async () => {
    const s = await siteColis()
    const { u, colis } = await colisExpedie(s, { qte: 5 })
    const a = await affiche(s, u, 8)
    const r = await avecEchec(ctx, "BEFORE INSERT ON mouvement WHEN NEW.type = 'EXPEDITION'", () =>
      fin(s),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect((await colisLu(colis.id)).statut).toBe('A_EXPEDIER')
    expect((await umLue(u.id)).statut).toBe('A_EXPEDIER')
    expect(await stockDe(a.id)).toBe(8)
    // la panne levée, le passage suivant aboutit
    expect((await fin(s)).statusCode).toBe(200)
    expect((await colisLu(colis.id)).statut).toBe('TERMINE')
    expect(await stockDe(a.id)).toBe(3)
  })

  it('RG-COO-269 atelier déroulant : faces → « Terminé » avec le colis, aucune sortie de stock automatique (Q-197 (8))', async () => {
    const s = await siteColis()
    const t = await train(s, { n: 3 })
    const c = await ouvrir(s, { atelier: 'scroll' })
    const m = resultat(
      await ecrire(s, 'expe', `/${String(c.id)}/trains`, {
        version: c.version,
        trainId: t.trainId,
      }),
    ).colis
    await ecrire(s, 'expe', `/${String(c.id)}/expedier`, { version: m?.version ?? 0 })
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res).toMatchObject({ colis: [c.id], faces: 3, unites: 0, sortiesStock: 0 })
    for (const face of t.faces)
      expect((await db.faceTrain.findUniqueOrThrow({ where: { id: face.id } })).statut).toBe(
        'TERMINE',
      )
  })

  it('RG-COO-271 le mail « colis expédié » est mis en file (Q-375, Q-409) : tracé au journal, `mailEnvoye` reste faux tant que rien n’est parti', async () => {
    const s = await siteColis()
    const { colis } = await colisExpedie(s)
    await fin(s)
    const mail = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: String(colis.id), action: 'MAIL_COLIS' },
    })
    expect(mail.complement).toContain('Q-375')
    expect(JSON.parse(mail.donnees ?? '{}')).toMatchObject({ destinataire: 'a@test.fr' })
    expect(
      await db.mailFile.findFirstOrThrow({ where: { cle: `COLIS:${String(colis.id)}` } }),
    ).toMatchObject({
      statut: 'EN_ATTENTE',
      destinataires: 'a@test.fr',
    })
    expect((await colisLu(colis.id)).mailEnvoye).toBe(false)
  })

  it('RG-COO-269 seuls les colis du périmètre sont traités ; un colis « Colis ouvert » ou « Terminé » n’est jamais touché', async () => {
    const s = await siteColis()
    const autre = await siteColis()
    const { colis: mien } = await colisExpedie(s)
    const { colis: leur } = await colisExpedie(autre)
    const ouvert = await ouvrir(s)
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res.colis).toEqual([mien.id])
    expect((await colisLu(leur.id)).statut).toBe('A_EXPEDIER')
    expect((await colisLu(ouvert.id)).statut).toBe('EN_COURS')
  })

  it('RG-COO-269 idempotence : la même Idempotency-Key rejouée renvoie la même réponse sans 2e traitement ; une autre requête avec la même clé est refusée (409)', async () => {
    const s = await siteColis()
    const { u } = await colisExpedie(s, { qte: 2 })
    const a = await affiche(s, u, 2)
    const cle = idem()
    const r1 = await fin(s, 'expe', cle)
    const r2 = await fin(s, 'expe', cle)
    expect(r2.statusCode).toBe(r1.statusCode)
    expect(r2.json()).toEqual(r1.json())
    expect(await db.mouvement.count({ where: { afficheId: a.id, type: 'EXPEDITION' } })).toBe(1)
    const autre = await ecrire(s, 'expe', '/fin-de-journee', { extra: 1 }, cle)
    expect([400, 409]).toContain(autre.statusCode)
  })

  it('RG-COO-280 le statut de l’UM prime sur celui de la répartition dans le suivi de production (statut effectif, Q-273)', async () => {
    const s = await siteColis()
    const { u } = await colisExpedie(s, { qte: 3 })
    const contNum = u.contNum ?? 0
    const dossier = await f.createDossier(db, { contNum, statut: 'PREPARATION_RECUE' })
    purge.dossiers.push(dossier.id)
    const rep = await f.createRepartition(db, {
      atelierId: s.fixe.id,
      supportId: s.support.id,
      destinataireId: s.dest[0].id,
      contNum,
      theme: u.theme,
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      uniteId: u.id,
      statut: 'EN_COURS',
    })
    const ligneAttendue = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      atelierId: s.fixe.id,
      contNum,
      theme: u.theme,
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      source: 'PREPA',
    })
    await fin(s)
    expect((await db.repartition.findUniqueOrThrow({ where: { id: rep.id } })).statut).toBe(
      'EN_COURS',
    )
    const r = await get(
      ctx,
      `/api/coordination/suivi-production?dossier=${String(contNum)}`,
      s.users.cheq.headers,
    )
    expect(r.statusCode, r.body).toBe(200)
    const items = r.json<{
      items: { ligneAttendueId: number; repartitions: { id: number; statut: string }[] }[]
    }>().items
    const item = items.find((i) => i.ligneAttendueId === ligneAttendue.id)
    expect(item?.repartitions).toEqual([expect.objectContaining({ id: rep.id, statut: 'TERMINE' })])
  })
})

// ───────────────────────── RG-COO-249 : garde « UM dans un colis » (branchée ici) ─────────────────────────

describe('RG-COO-249 une UM dans un colis ne se retire pas et la main ne se rend pas (409 réel)', () => {
  it('RG-COO-249 retirer / rendre la main refusés tant que l’UM est dans un colis ; acceptés après son retrait du colis', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 4 })
    const rep = await f.createRepartition(db, {
      atelierId: s.fixe.id,
      supportId: s.support.id,
      destinataireId: s.dest[0].id,
      contNum: u.contNum,
      theme: u.theme,
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      uniteId: u.id,
      qte: 4,
      statut: 'EN_COURS',
    })
    const c = await ouvrir(s)
    const m = resultat(await ajouter(s, c, u)).colis
    // « Préparé » par l'ajout au colis : les deux actions sont déjà refusées par le point de non-retour (409) ;
    // on vérifie la garde elle-même en remettant l'UM « En cours » (statut seul), sans la sortir du colis.
    await db.uniteManutention.update({ where: { id: u.id }, data: { statut: 'EN_COURS' } })
    for (const chemin of ['retirer', 'rendre-la-main']) {
      const res = await post(ctx, `/api/coordination/unitaire/${chemin}`, s.users.coord.headers, {
        lignes: [{ id: rep.id, version: rep.version }],
      })
      expect(res.statusCode, `${chemin} : ${res.body}`).toBe(409)
      expect(erreur(res).code).toBe('COO_UM_DANS_COLIS')
      expect(await umLue(u.id)).not.toBeNull()
    }
    // sortie du colis → l'UM repasse « En cours » (6 → 1 n'a pas lieu : déjà En cours) et le retrait passe
    await db.uniteManutention.update({ where: { id: u.id }, data: { statut: 'PREPARE' } })
    const sortie = await ecrire(s, 'expe', `/${String(c.id)}/retirer`, {
      version: m?.version ?? 0,
      unites: [u.id],
    })
    expect(resultat(sortie).supprime).toBe(true)
    const apres = await db.repartition.findUniqueOrThrow({ where: { id: rep.id } })
    const retrait = await post(ctx, '/api/coordination/unitaire/retirer', s.users.coord.headers, {
      lignes: [{ id: apres.id, version: apres.version }],
    })
    expect(retrait.statusCode, retrait.body).toBe(200)
    expect(await db.uniteManutention.count({ where: { id: u.id } })).toBe(0)
  })
})

// ───────────────────────── RG-COO-260 à 262, 272 à 276 : absences ─────────────────────────

describe('RG-COO-260 / 261 / 262 : création des UM par « Colisage » (liberation-colisage.int.test.ts) ; RG-COO-272 à 276 : AMT non repris (Q-274)', () => {
  it('RG-COO-260 aucune route de création d’UM hors « Colisage » de l’unitaire, pour aucun rôle', async () => {
    const s = await siteColis()
    for (const role of ROLES)
      for (const url of [
        '/api/coordination/unitaire/creer',
        '/api/coordination/unites',
        '/api/coordination/unites/creer',
      ]) {
        const r = await ecrire(s, role, '', {}) // témoin : la route colis n'est pas une création d'UM
        expect(r.statusCode).not.toBe(201)
        const absent = await post(ctx, url, s.users[role].headers, {})
        expect(absent.statusCode, `${role} ${url}`).toBe(404)
      }
  })

  it('RG-COO-262 / 275 aucun traitement ne modifie la quantité d’une UM (UM_qte = 0 reste 0 : correction legacy non reproduite)', async () => {
    const s = await siteColis()
    const zero = await um(s, { qte: 0 })
    const c = await ouvrir(s)
    expect((await ajouter(s, c, zero)).statusCode).toBe(422)
    await ecrire(s, 'expe', '/fin-de-journee', {})
    expect((await umLue(zero.id)).qte).toBe(0)
  })

  it.each([
    '/api/coordination/amt/integration',
    '/api/coordination/amt/reparts',
    '/api/coordination/amt/statut-repart',
    '/api/coordination/amt/purge',
  ])('RG-COO-272 à 276 aucune route d’intégration AMT : %s → 404', async (url) => {
    const s = await siteColis()
    expect((await post(ctx, url, s.users.expe.headers, {})).statusCode).toBe(404)
    expect((await get(ctx, url, s.users.expe.headers)).statusCode).toBe(404)
  })

  it('RG-COO-272 une répartition déjà active n’est pas réintégrée : aucune intégration AMT en V2 (Q-274), 404', async () => {
    const s = await siteColis()
    for (const role of ROLES)
      expect(
        (await post(ctx, '/api/coordination/amt/reintegration', s.users[role].headers, {}))
          .statusCode,
        role,
      ).toBe(404)
  })

  it('RG-COO-273 aucun transcodage du type de préparation ni regroupement par afficheur AMT (Q-274), 404', async () => {
    const s = await siteColis()
    expect(
      (await post(ctx, '/api/coordination/amt/transcodage', s.users.expe.headers, {})).statusCode,
    ).toBe(404)
    expect(
      (await post(ctx, '/api/coordination/amt/regroupement', s.users.expe.headers, {})).statusCode,
    ).toBe(404)
  })

  it('RG-COO-274 aucun contrôle d’anomalie AMT 903 / 905 / 906 / 907 ni ligne en erreur « E » (Q-274), 404', async () => {
    const s = await siteColis()
    expect(
      (await get(ctx, '/api/coordination/amt/anomalies', s.users.expe.headers)).statusCode,
    ).toBe(404)
    expect(
      (await post(ctx, '/api/coordination/amt/controles', s.users.expe.headers, {})).statusCode,
    ).toBe(404)
  })

  it('RG-COO-276 l’intégration des statuts de répartition AMT reste désactivée : aucune route (Q-274), 404', async () => {
    const s = await siteColis()
    for (const role of ROLES)
      expect(
        (await post(ctx, '/api/coordination/amt/statut-repart', s.users[role].headers, {}))
          .statusCode,
        role,
      ).toBe(404)
  })
})

// ───────────────────────── ECR-EXP-01 / ECR-EXP-02 : lectures ─────────────────────────

describe('ECR-EXP-01 unités à coliser et colis ouverts', () => {
  it('ECR-EXP-01 liste par destinataire les UM « En cours » / « Préparé » avec reste à placer et les trains aux faces 5 / 9 / 10', async () => {
    const s = await siteColis()
    const a = await um(s, { qte: 10 })
    const b = await um(s, { qte: 6, statut: 'PREPARE', dest: 1 })
    await um(s, { statut: 'ERREUR' })
    await um(s, { statut: 'TERMINE' })
    const pleine = await um(s, { qte: 3 })
    const c = await ouvrir(s)
    await ajouter(s, c, pleine) // reste 0 : n'apparaît plus
    await ajouter(s, { id: c.id, version: c.version + 1 }, a, 4)
    const t = await train(s, { n: 2 })
    await train(s, { statut: 'INSTRUCTION_OK' })
    const r = await lire(s, 'expe', '/a-coliser')
    expect(r.statusCode, r.body).toBe(200)
    const lu = AColiserSchema.parse(r.json())
    const unites = lu.groupes.flatMap((g) => g.unites)
    expect(unites.flatMap((x) => (x.type === 'UM' ? [x.uniteId] : [])).sort()).toEqual(
      [a.id, b.id].sort(),
    )
    const ua = unites.find((x) => x.type === 'UM' && x.uniteId === a.id)
    expect(ua).toMatchObject({ quantite: 6, statut: 'PREPARE' })
    expect(unites.filter((x) => x.type === 'TRAIN')).toEqual([
      expect.objectContaining({ trainId: t.trainId, faces: 2 }),
    ])
    expect([...new Set(lu.groupes.map((g) => g.destinataire.id))].sort()).toEqual(
      [s.dest[0].id, s.dest[1].id].sort(),
    )
    expect(lu.colisOuverts.map((x) => x.id)).toContain(c.id)
    expect(lu.indicateurs).toMatchObject({ aColiser: 3, livres: null })
  })

  it('ECR-EXP-01 filtres côté API : dossier, départ, destinataire (nom partiel), atelier', async () => {
    const s = await siteColis()
    const a = await um(s, { contNum: A(900_001), dest: 0 })
    const b = await um(s, {
      dest: 1,
      semaine: { annee: SEM.annee, semaine: SEM.semaine === 1 ? 2 : SEM.semaine - 1 },
    })
    const ids = async (qs: string) =>
      AColiserSchema.parse((await lire(s, 'expe', `/a-coliser${qs}`)).json())
        .groupes.flatMap((g) => g.unites)
        .flatMap((x) => (x.type === 'UM' ? [x.uniteId] : []))
    expect(await ids(`?dossier=${String(a.contNum)}`)).toEqual([a.id])
    expect(
      await ids(`?depart=${formatSemaineIso({ annee: SEM.annee, semaine: SEM.semaine })}`),
    ).toEqual([a.id])
    expect(await ids('?destinataire=dest%20b')).toEqual([b.id])
    expect(await ids(`?atelier=${String(s.scroll.id)}`)).toEqual([])
    expect((await lire(s, 'expe', '/a-coliser?depart=2026-W54')).statusCode).toBe(400)
    expect((await lire(s, 'expe', '/a-coliser?dossier=abc')).statusCode).toBe(400)
  })
})

describe('ECR-EXP-02 liste des colis', () => {
  it('ECR-EXP-02 liste les colis du périmètre avec statut, départ, destinataire, indicateurs (Livré non calculable : Q-284)', async () => {
    const s = await siteColis()
    const ouvert = await ouvrir(s)
    const { colis: clos } = await colisAvecUm(s, { qte: 2 })
    await ecrire(s, 'expe', `/${String(clos.id)}/expedier`, { version: clos.version })
    const { colis: termine } = await colisAvecUm(s, { qte: 2 })
    await ecrire(s, 'expe', `/${String(termine.id)}/expedier`, { version: termine.version })
    await ecrire(s, 'expe', '/fin-de-journee', {})
    // fin de journée a terminé les deux colis clos : on en rouvre un nouveau clos pour l'indicateur « Clos »
    const { colis: encoreClos } = await colisAvecUm(s, { qte: 1 })
    await ecrire(s, 'expe', `/${String(encoreClos.id)}/expedier`, { version: encoreClos.version })
    const r = await lire(s, 'cheq')
    expect(r.statusCode, r.body).toBe(200)
    const l = ListeColisSchema.parse(r.json())
    expect(l.total).toBe(4)
    expect(l.indicateurs).toEqual({ clos: 1, expedies: 2, livres: null })
    expect(l.colis.find((x) => x.id === ouvert.id)?.statut).toBe('EN_COURS')
    expect(l.colis.find((x) => x.id === encoreClos.id)).toMatchObject({
      statut: 'A_EXPEDIER',
      depart: DEPART,
      nbUnites: 1,
    })
  })

  it('ECR-EXP-02 filtres côté API : statut, dossier, départ, destinataire, atelier ; paramètres invalides (400)', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 2, dest: 0 })
    const { colis: autre } = await colisAvecUm(s, { qte: 2, dest: 1 })
    const ids = async (qs: string) =>
      ListeColisSchema.parse((await lire(s, 'expe', qs)).json()).colis.map((x) => x.id)
    expect(await ids(`?dossier=${String(u.contNum)}`)).toEqual([colis.id])
    expect(await ids('?destinataire=dest%20b')).toEqual([autre.id])
    expect((await ids('?statut=EN_COURS')).sort()).toEqual([colis.id, autre.id].sort())
    expect(await ids('?statut=TERMINE')).toEqual([])
    expect(await ids(`?atelier=${String(s.scroll.id)}`)).toEqual([])
    expect((await ids(`?depart=${DEPART}`)).length).toBe(2)
    expect((await lire(s, 'expe', '?statut=LIVRE')).statusCode).toBe(400)
    expect((await lire(s, 'expe', '?depart=2026-W99')).statusCode).toBe(400)
  })

  it('ECR-EXP-02 fiche d’un colis : unités, trains, historique nominatif ; colis inconnu 404', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 2 })
    const fc = await fiche(s, colis.id)
    expect(fc.unites).toEqual([
      expect.objectContaining({ uniteId: u.id, code: code(u), quantite: 2 }),
    ])
    expect(fc.historique[0]).toMatchObject({ de: null, vers: 'EN_COURS' })
    expect(fc.historique[0]?.par).toBeTruthy()
    expect((await lire(s, 'expe', '/999999999')).statusCode).toBe(404)
  })

  it('volumétrie : plus de 1 000 colis et de 1 000 faces d’un périmètre sans erreur 500 (lecture par paquets)', async () => {
    const s = await siteColis()
    const dest = s.dest[0].id
    for (let i = 0; i < 1100; i += 100)
      await db.colis.createMany({
        data: Array.from({ length: 100 }, (_, k) => ({
          plateformeId: s.plateforme.id,
          atelierId: s.fixe.id,
          destinataireId: dest,
          codeColis: `V-${String(s.plateforme.id)}-${String(i + k)}`,
        })),
      })
    const r = await lire(s, 'cheq')
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200)
    expect(ListeColisSchema.parse(r.json()).total).toBe(1100)
    const aColiser = await lire(s, 'cheq', '/a-coliser')
    expect(aColiser.statusCode, aColiser.body.slice(0, 200)).toBe(200)
  })
})

// ───────────────────────── permissions, périmètre, entrées invalides ─────────────────────────

describe('RG-COO-165 / 167 / 168 permissions, périmètre et site choisi', () => {
  it.each(ROLES)(
    'RG-COO-165 %s : lectures et écritures du colisage (cheq et expe autorisés ; les autres 403)',
    async (role) => {
      const s = await siteColis()
      const { colis } = await colisAvecUm(s)
      const autorise = role === 'cheq' || role === 'expe' || role === 'admin'
      const lectures = ['', '/a-coliser', `/${String(colis.id)}`]
      for (const chemin of lectures) {
        const r = await lire(s, role, chemin)
        expect(r.statusCode, `${role} GET ${chemin}`).toBe(autorise ? 200 : 403)
        if (!autorise) expect(erreur(r).regle).toBe(role === 'com' ? 'RG-COO-168' : 'RG-COO-265')
      }
      const ecritures: [string, unknown][] = [
        ['', { atelierId: s.fixe.id, destinataireId: s.dest[0].id }],
        [`/${String(colis.id)}/unites`, { version: colis.version, code: 'X' }],
        [`/${String(colis.id)}/trains`, { version: colis.version, trainId: 'X' }],
        [`/${String(colis.id)}/retirer`, { version: colis.version, tout: true }],
        [`/${String(colis.id)}/supprimer`, { version: colis.version }],
        [`/${String(colis.id)}/ouvrir`, { version: colis.version }],
        [`/${String(colis.id)}/expedier`, { version: 99 }],
        ['/fin-de-journee', {}],
      ]
      for (const [chemin, corps] of ecritures) {
        const r = await ecrire(s, role, chemin, corps)
        if (autorise) expect(r.statusCode, `${role} POST ${chemin}`).not.toBe(403)
        else expect(r.statusCode, `${role} POST ${chemin}`).toBe(403)
      }
      if (!autorise) expect((await colisLu(colis.id)).statut).toBe('EN_COURS')
    },
  )

  it('RG-COO-165 sans identité : 401 sur toutes les routes', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    for (const chemin of ['', '/a-coliser', `/${String(c.id)}`]) {
      expect((await ctx.app.inject({ method: 'GET', url: `${U}${chemin}` })).statusCode).toBe(401)
    }
    const corps: [string, unknown][] = [
      ['', { atelierId: s.fixe.id, destinataireId: s.dest[0].id }],
      ['/fin-de-journee', {}],
      [`/${String(c.id)}/expedier`, { version: c.version }],
    ]
    for (const [chemin, payload] of corps)
      expect(
        (
          await ctx.app.inject({
            method: 'POST',
            url: `${U}${chemin}`,
            headers: idem(),
            payload: payload as object,
          })
        ).statusCode,
      ).toBe(401)
  })

  it('RG-COO-167 un coordinateur d’un autre site : listes sans fuite, fiche et actions refusées (403, rien d’écrit)', async () => {
    const s = await siteColis()
    const autre = await siteColis()
    const { u, colis } = await colisAvecUm(s)
    expect(
      ListeColisSchema.parse((await lire(autre, 'expe')).json()).colis.map((x) => x.id),
    ).not.toContain(colis.id)
    expect(
      AColiserSchema.parse((await lire(autre, 'expe', '/a-coliser')).json()).groupes.flatMap(
        (g) => g.unites,
      ),
    ).toEqual([])
    const entete = s.users.expe.headers
    const pasMien = { ...autre.users.expe.headers }
    const fiche403 = await get(ctx, `${U}/${String(colis.id)}`, pasMien)
    expect(fiche403.statusCode).toBe(403)
    expect(erreur(fiche403).regle).toBe('RG-COO-167')
    for (const [chemin, corps] of [
      [`/${String(colis.id)}/unites`, { version: colis.version, code: code(u) }],
      [`/${String(colis.id)}/retirer`, { version: colis.version, tout: true }],
      [`/${String(colis.id)}/supprimer`, { version: colis.version }],
      [`/${String(colis.id)}/expedier`, { version: colis.version }],
    ] as const) {
      const r = await post(ctx, `${U}${chemin}`, pasMien, corps)
      expect(r.statusCode, chemin).toBe(403)
    }
    expect(entete).toBeDefined()
    expect(await db.uniteColis.count({ where: { colisId: colis.id } })).toBe(1)
    expect((await colisLu(colis.id)).statut).toBe('EN_COURS')
  })

  it('RG-COO-167 / Q-173 le site choisi dans le bandeau (x-site-id) restreint les listes à ce site ; hors périmètre : 403', async () => {
    const s1 = await siteColis()
    const s2 = await siteColis()
    const u = await f.createUtilisateurAvecRoles(
      db,
      ['expe'],
      [{ plateformeId: s1.plateforme.id }, { plateformeId: s2.plateforme.id }],
    )
    const c1 = await ouvrir(s1)
    const c2 = await ouvrir(s2)
    const sans = ListeColisSchema.parse(
      (await get(ctx, U, devHeaders(u.identifiantExterne))).json(),
    )
    expect(sans.colis.map((x) => x.id)).toEqual(expect.arrayContaining([c1.id, c2.id]))
    const site2 = ListeColisSchema.parse(
      (await get(ctx, U, devHeaders(u.identifiantExterne, s2.plateforme.id))).json(),
    )
    expect(site2.colis.map((x) => x.id)).toEqual([c2.id])
    // une action sur un colis de l'autre site, site choisi = s2 : refusée
    const ecriture = await post(
      ctx,
      `${U}/${String(c1.id)}/supprimer`,
      devHeaders(u.identifiantExterne, s2.plateforme.id),
      { version: c1.version },
    )
    expect(ecriture.statusCode).toBe(403)
    expect(await db.colis.count({ where: { id: c1.id } })).toBe(1)
    const horsPerimetre = await get(ctx, U, devHeaders(u.identifiantExterne, 999_999_999))
    expect(horsPerimetre.statusCode).toBe(403)
  })

  it('CLAUDE.md §6 entrées invalides (400) et absence d’Idempotency-Key (400) sur chaque POST', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    const h = s.users.expe.headers
    const invalides: [string, unknown][] = [
      ['', {}],
      ['', { atelierId: 'x', destinataireId: 1 }],
      [`/${String(c.id)}/unites`, { version: 0, code: 'X' }],
      [`/${String(c.id)}/unites`, { version: 1, code: '' }],
      [`/${String(c.id)}/trains`, { version: 1 }],
      [`/${String(c.id)}/retirer`, { version: 1, unites: ['a'] }],
      [`/${String(c.id)}/expedier`, { version: 1, formatCode: 100 }],
      [`/${String(c.id)}/supprimer`, {}],
      ['/fin-de-journee', { x: 1 }],
    ]
    for (const [chemin, corps] of invalides)
      expect((await post(ctx, `${U}${chemin}`, h, corps)).statusCode, chemin).toBe(400)
    for (const chemin of ['', '/fin-de-journee', `/${String(c.id)}/supprimer`])
      expect(
        (
          await post(
            ctx,
            `${U}${chemin}`,
            h,
            chemin === ''
              ? { atelierId: s.fixe.id, destinataireId: s.dest[0].id }
              : chemin === '/fin-de-journee'
                ? {}
                : { version: 1 },
            false,
          )
        ).statusCode,
        chemin,
      ).toBe(400)
    expect((await lire(s, 'expe', '/abc')).statusCode).toBe(400)
  })
})

// ───────────────────────── concurrence, idempotence, atomicité ─────────────────────────

describe('concurrence, idempotence et atomicité', () => {
  it('RG-COO-308 deux ajouts simultanés avec la même version de colis : un seul aboutit (200), l’autre est refusé (409), une seule ligne écrite', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    const a = await um(s, { qte: 2 })
    const b = await um(s, { qte: 2 })
    const [r1, r2] = await Promise.all([ajouter(s, c, a), ajouter(s, c, b)])
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409])
    expect(await db.uniteColis.count({ where: { colisId: c.id } })).toBe(1)
    expect((await colisLu(c.id)).version).toBe(c.version + 1)
    const perdante = r1.statusCode === 409 ? a : b
    expect((await umLue(perdante.id)).statut).toBe('EN_COURS')
  })

  it('CLAUDE.md §6 idempotence : la même clé rejouée ne crée qu’un colis et un seul rattachement ; autre corps avec la même clé : 409', async () => {
    const s = await siteColis()
    const cle = idem()
    const corps = { atelierId: s.fixe.id, destinataireId: s.dest[0].id }
    const avant = await db.colis.count({ where: { plateformeId: s.plateforme.id } })
    const r1 = await ecrire(s, 'expe', '', corps, cle)
    const r2 = await ecrire(s, 'expe', '', corps, cle)
    expect(r2.json()).toEqual(r1.json())
    expect(await db.colis.count({ where: { plateformeId: s.plateforme.id } })).toBe(avant + 1)
    const autre = await ecrire(s, 'expe', '', { ...corps, destinataireId: s.dest[1].id }, cle)
    expect(autre.statusCode).toBe(409)
    expect(erreur(autre).code).toBe('COO_IDEMPOTENCE_CONFLIT')

    const colis = ResultatColisSchema.parse(r1.json()).colis
    const u = await um(s, { qte: 2 })
    const cleAjout = idem()
    const a1 = await ecrire(
      s,
      'expe',
      `/${String(colis?.id)}/unites`,
      { version: colis?.version, code: code(u) },
      cleAjout,
    )
    const a2 = await ecrire(
      s,
      'expe',
      `/${String(colis?.id)}/unites`,
      { version: colis?.version, code: code(u) },
      cleAjout,
    )
    expect(a1.statusCode).toBe(200)
    expect(a2.json()).toEqual(a1.json())
    expect(await db.uniteColis.count({ where: { uniteId: u.id } })).toBe(1)
  })

  it('CLAUDE.md §6 atomicité : un échec du journal annule l’ajout (UM, ligne UM ↔ colis, version, historique intacts) ; la clé n’est pas consommée', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    const u = await um(s, { qte: 3 })
    const cle = idem()
    const r = await avecEchec(
      ctx,
      "BEFORE INSERT ON journal_audit WHEN NEW.action = 'AJOUT_UM_COLIS'",
      () =>
        ajouter(s, c, u).then(() =>
          ecrire(s, 'expe', `/${String(c.id)}/unites`, { version: c.version, code: code(u) }, cle),
        ),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.uniteColis.count({ where: { colisId: c.id } })).toBe(0)
    expect((await umLue(u.id)).statut).toBe('EN_COURS')
    expect((await colisLu(c.id)).version).toBe(c.version)
    const rejeu = await ecrire(
      s,
      'expe',
      `/${String(c.id)}/unites`,
      { version: c.version, code: code(u) },
      cle,
    )
    expect(rejeu.statusCode, rejeu.body).toBe(200)
  })

  it('CLAUDE.md §6 atomicité : un échec de l’historique de statut d’une face annule l’ajout du train', async () => {
    const s = await siteColis()
    const t = await train(s, { n: 2 })
    const c = await ouvrir(s, { atelier: 'scroll' })
    const r = await avecEchec(
      ctx,
      "BEFORE INSERT ON statut_historique WHEN NEW.type_entite = 'FACE_TRAIN' AND NEW.nouveau = 'A_EXPEDIER'",
      () =>
        ecrire(s, 'expe', `/${String(c.id)}/trains`, { version: c.version, trainId: t.trainId }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    for (const face of t.faces) {
      const lue = await db.faceTrain.findUniqueOrThrow({ where: { id: face.id } })
      expect(lue.statut).toBe('AU_ROULAGE')
      expect(lue.colisId).toBeNull()
    }
    expect((await colisLu(c.id)).version).toBe(c.version)
  })

  it('RG-COO-268 atomicité : un échec du changement de statut de l’UM annule l’expédition (colis resté « Colis ouvert »)', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 2 })
    const r = await avecEchec(
      ctx,
      "BEFORE INSERT ON statut_historique WHEN NEW.type_entite = 'UNITE_MANUTENTION' AND NEW.nouveau = 'A_EXPEDIER'",
      () => ecrire(s, 'expe', `/${String(colis.id)}/expedier`, { version: colis.version }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect((await colisLu(colis.id)).statut).toBe('EN_COURS')
    expect((await colisLu(colis.id)).dateExpedition).toBeNull()
    expect((await umLue(u.id)).statut).toBe('PREPARE')
  })
})
