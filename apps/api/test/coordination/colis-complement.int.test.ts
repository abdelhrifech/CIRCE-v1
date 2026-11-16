// COO-P13 (test-engineer) — tests d'INTÉGRATION COMPLÉMENTAIRES du colisage, de l'expédition et de la fin de journée,
// écrits à partir des RÈGLES (RG-COO-249, 263 à 271, 280, RG-X-087, RG-COO-165 / 167, CLAUDE.md §6), pas du code.
// API réelle sur la base de test (test.db), données par les factories, purgées dans l'afterAll. Aucun test unitaire.
// Les anomalies détectées sont d'abord écrites en `it.fails` (comportement ATTENDU) ; ANO-054 est corrigée : test normal.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FicheColisSchema,
  ListeColisSchema,
  ResultatColisSchema,
  ResultatFinDeJourneeSchema,
  semaineIsoDe,
  type Role,
} from '@circe/shared'
import { DEV_IDENTITY_HEADER } from '@circe/shared/dev-identity'
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
const A = (n: number) => 800_000 + n

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
  await essayer(() => db.rouleur.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() =>
    db.receptionAttendue.deleteMany({ where: { plateformeId: { in: purge.plateformes } } }),
  )
  for (const id of purge.ateliers) await essayer(() => db.atelier.delete({ where: { id } }))
  for (const id of purge.destinataires)
    await essayer(() => db.destinataire.delete({ where: { id } }))
  await ctx.arreter()
})

// ───────────────────────── données ─────────────────────────

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
  supportId?: number | null
}
function um(s: Site, o: OptUm = {}) {
  return f.createUniteManutention(db, {
    atelierId: o.atelierId ?? s.fixe.id,
    supportId: o.supportId === undefined ? s.support.id : o.supportId,
    destinataireId: s.dest[o.dest ?? 0].id,
    qte: o.qte ?? 10,
    statut: o.statut ?? 'EN_COURS',
    contNum: o.contNum ?? A(next()),
    theme: o.theme ?? `Thème ${String(next())}`,
    semAnnee: SEM.annee,
    semNum: SEM.semaine,
  })
}

async function train(
  s: Site,
  o: { statut?: StatutProduction; n?: number; dest?: 0 | 1; atelierId?: number } = {},
) {
  const trainId = `9${String(next()).padStart(15, '0')}`
  const atelierId = o.atelierId ?? s.scroll.id
  const faces = []
  for (let k = 0; k < (o.n ?? 2); k++) {
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    purge.dossiers.push(dossier.id)
    const i = await f.createInstruction(db, {
      atelierId,
      dossierId: dossier.id,
      contNum: dossier.contNum,
      statut: 'PRET_A_PRODUIRE',
    })
    faces.push(
      await f.createFaceTrain(db, {
        instructionCode: i.code,
        statut: o.statut ?? 'AU_ROULAGE',
        atelierId,
        supportId: s.support.id,
        destinataireId: s.dest[o.dest ?? 0].id,
        contNum: dossier.contNum,
        dateDepart: new Date(),
        depAnbas: SEM.annee,
        depSembas: SEM.semaine,
        trainId,
        theme: `Thème train ${String(next())}`,
      }),
    )
  }
  return { trainId, faces }
}

// ───────────────────────── appels ─────────────────────────

const U = '/api/coordination/colis'
const ecrireH = (headers: H, chemin: string, payload: unknown, cle?: H) =>
  ctx.app.inject({
    method: 'POST',
    url: `${U}${chemin}`,
    headers: { ...headers, ...(cle ?? idem()) },
    payload: payload as object,
  })
const ecrire = (s: Site, role: Role, chemin: string, payload: unknown, cle?: H) =>
  ecrireH(s.users[role].headers, chemin, payload, cle)
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
const ajouterTrain = (
  s: Site,
  colis: { id: number; version: number },
  trainId: string,
  role: Role = 'expe',
) => ecrire(s, role, `/${String(colis.id)}/trains`, { version: colis.version, trainId })
const fiche = async (s: Site, id: number) => {
  const r = await lire(s, 'expe', `/${String(id)}`)
  expect(r.statusCode, r.body).toBe(200)
  return FicheColisSchema.parse(r.json())
}
const umLue = (id: number) => db.uniteManutention.findUniqueOrThrow({ where: { id } })
const colisLu = (id: number) => db.colis.findUniqueOrThrow({ where: { id } })
const resultat = (r: { json: () => unknown }) => ResultatColisSchema.parse(r.json())
const faceLue = (id: number) => db.faceTrain.findUniqueOrThrow({ where: { id } })
const expedier = (s: Site, colis: { id: number; version: number }, role: Role = 'expe', cle?: H) =>
  ecrire(s, role, `/${String(colis.id)}/expedier`, { version: colis.version }, cle)
const fin = (s: Site, role: Role = 'expe', cle?: H) => ecrire(s, role, '/fin-de-journee', {}, cle)
const stockDe = async (afficheId: number) =>
  (await db.mouvement.aggregate({ _sum: { quantite: true }, where: { afficheId } }))._sum
    .quantite ?? 0

async function colisAvecUm(s: Site, o: OptUm & { quantite?: number } = {}) {
  const u = await um(s, o)
  const c = await ouvrir(s, { dest: o.dest })
  const r = await ajouter(s, c, u, o.quantite)
  expect(r.statusCode, r.body).toBe(200)
  const maj = resultat(r).colis
  if (!maj) throw new Error('colis absent')
  return { u, colis: maj }
}
async function colisExpedie(s: Site, o: OptUm & { quantite?: number } = {}) {
  const { u, colis } = await colisAvecUm(s, o)
  const r = await expedier(s, colis)
  expect(r.statusCode, r.body).toBe(200)
  return { u, colis: resultat(r).colis ?? colis }
}
async function colisTrain(s: Site, n = 2) {
  const t = await train(s, { n })
  const c = await ouvrir(s, { atelier: 'scroll' })
  const r = await ajouterTrain(s, c, t.trainId)
  expect(r.statusCode, r.body).toBe(200)
  return { t, colis: resultat(r).colis ?? c }
}
async function affiche(
  s: Site,
  u: { contNum: number | null; theme: string | null },
  stock: number,
  o: { dateEntree?: Date } = {},
) {
  const a = await f.createAffiche(db, {
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    contNum: u.contNum,
    theme: u.theme,
    quantite: stock,
    ...(o.dateEntree ? { dateEntree: o.dateEntree } : {}),
  })
  if (stock > 0) await f.createMouvement(db, { afficheId: a.id, quantite: stock })
  return a
}

// ───────────────────────── transitions de colis : table complète ─────────────────────────

describe('RG-COO-266 / 268 / 269 transitions de colis : autorisées et interdites (409)', () => {
  it('RG-COO-268 / 269 transitions autorisées : « Colis ouvert » → « A expédier » (Expédier) puis → « Terminé » (fin de journée), versions incrémentées, un historique par changement', async () => {
    const s = await siteColis()
    const { colis } = await colisAvecUm(s)
    const clos = resultat(await expedier(s, colis)).colis
    expect(clos?.version).toBe(colis.version + 1)
    expect((await fin(s)).statusCode).toBe(200)
    const termine = await fiche(s, colis.id)
    expect(termine.statut).toBe('TERMINE')
    expect(termine.version).toBe(colis.version + 2)
    expect(termine.historique.map((h) => [h.de, h.vers])).toEqual([
      [null, 'EN_COURS'],
      ['EN_COURS', 'A_EXPEDIER'],
      ['A_EXPEDIER', 'TERMINE'],
    ])
  })

  it.each(['A_EXPEDIER', 'TERMINE'] as const)(
    'RG-COO-266 / 267 / 268 un colis %s : ajout d’UM, de train, retrait, suppression, réouverture, 2e expédition tous refusés (409), rien d’écrit',
    async (statut) => {
      const s = await siteColis()
      const { colis } = await colisExpedie(s)
      if (statut === 'TERMINE') expect((await fin(s)).statusCode).toBe(200)
      const avant = await fiche(s, colis.id)
      expect(avant.statut).toBe(statut)
      const libre = await um(s)
      const t = await train(s)
      const v = avant.version
      const cas: [string, unknown, string, string][] = [
        ['unites', { version: v, code: code(libre) }, 'COO_COLIS_CLOS', 'RG-COO-265'],
        ['trains', { version: v, trainId: t.trainId }, 'COO_COLIS_CLOS', 'RG-COO-270'],
        ['retirer', { version: v, tout: true }, 'COO_COLIS_CLOS', 'RG-COO-267'],
        ['supprimer', { version: v }, 'COO_COLIS_CLOS', 'RG-COO-266'],
        ['ouvrir', { version: v }, 'COO_COLIS_NON_ROUVRABLE', 'RG-COO-266'],
        ['expedier', { version: v }, 'TRANSITION_INTERDITE', 'RG-COO-268'],
      ]
      for (const [chemin, corps, codeAttendu, regle] of cas) {
        const r = await ecrire(s, 'expe', `/${String(colis.id)}/${chemin}`, corps)
        expect(r.statusCode, `${statut} ${chemin} : ${r.body}`).toBe(409)
        expect(erreur(r).code, chemin).toBe(codeAttendu)
        expect(erreur(r).regle, chemin).toBe(regle)
      }
      const apres = await fiche(s, colis.id)
      expect(apres.version).toBe(v)
      expect(apres.statut).toBe(statut)
      expect(apres.nbUnites).toBe(1)
      expect((await umLue(libre.id)).statut).toBe('EN_COURS')
      for (const face of t.faces) expect((await faceLue(face.id)).colisId).toBeNull()
    },
  )

  it('RG-COO-269 il n’existe aucune route « Ouvert → Terminé » : le colis ne passe « Terminé » que par la fin de journée, après « Expédier »', async () => {
    const s = await siteColis()
    const { colis } = await colisAvecUm(s)
    await fin(s) // colis encore ouvert : intact
    expect((await colisLu(colis.id)).statut).toBe('EN_COURS')
  })
})

// ───────────────────────── RG-COO-266 : création, suppression, atomicité, concurrence ─────────────────────────

describe('RG-COO-266 compléments (atomicité, concurrence)', () => {
  it('RG-COO-266 atomicité : un échec du journal de création n’écrit aucun colis (ni ligne sans code, ni historique)', async () => {
    const s = await siteColis()
    const r = await avecEchec(
      ctx,
      "BEFORE INSERT ON journal_audit WHEN NEW.action = 'CREATION_COLIS'",
      () => ecrire(s, 'expe', '', { atelierId: s.fixe.id, destinataireId: s.dest[0].id }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.colis.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
  })

  it('RG-COO-266 atomicité : un échec du journal de suppression laisse le colis (suppression annulée)', async () => {
    const s = await siteColis()
    const vide = await ouvrir(s)
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'SUPPRESSION_COLIS' AND NEW.entite_id = '${String(vide.id)}'`,
      () => ecrire(s, 'expe', `/${String(vide.id)}/supprimer`, { version: vide.version }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.colis.count({ where: { id: vide.id } })).toBe(1)
    expect((await colisLu(vide.id)).version).toBe(vide.version)
  })

  it('RG-COO-266 concurrence : deux suppressions de la même version, une seule aboutit (l’autre 404 ou 409)', async () => {
    const s = await siteColis()
    const vide = await ouvrir(s)
    const rs = await Promise.all([
      ecrire(s, 'expe', `/${String(vide.id)}/supprimer`, { version: vide.version }),
      ecrire(s, 'expe', `/${String(vide.id)}/supprimer`, { version: vide.version }),
    ])
    expect(rs.filter((r) => r.statusCode === 200)).toHaveLength(1)
    for (const r of rs) expect([200, 404, 409]).toContain(r.statusCode)
    expect(await db.colis.count({ where: { id: vide.id } })).toBe(0)
  })

  it('RG-COO-266 / 265 concurrence : suppression et ajout d’UM sur la même version, aucune ligne orpheline ni UM « Préparé » sans colis', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    const u = await um(s, { qte: 2 })
    const [rSup, rAjout] = await Promise.all([
      ecrire(s, 'expe', `/${String(c.id)}/supprimer`, { version: c.version }),
      ajouter(s, c, u),
    ])
    expect(
      [rSup.statusCode, rAjout.statusCode].filter((x) => x === 200),
      `${rSup.body} ${rAjout.body}`,
    ).toHaveLength(1)
    const existe = (await db.colis.count({ where: { id: c.id } })) === 1
    const lignes = await db.uniteColis.count({ where: { uniteId: u.id } })
    if (existe) {
      expect(lignes).toBe(1)
      expect((await umLue(u.id)).statut).toBe('PREPARE')
    } else {
      expect(lignes).toBe(0)
      expect((await umLue(u.id)).statut).toBe('EN_COURS')
    }
  })
})

// ───────────────────────── RG-COO-264 / 265 : fractionnement et rattachement, limites ─────────────────────────

describe('RG-COO-264 / 265 limites du fractionnement et du rattachement', () => {
  it('RG-COO-264 limite : la quantité totale de l’UM (10 sur 10) est acceptée ; 11 sur 10 est refusée (422, regle RG-COO-264, rien écrit)', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c = await ouvrir(s)
    const trop = await ajouter(s, c, u, 11)
    expect(trop.statusCode).toBe(422)
    expect(erreur(trop).code).toBe('COO_UM_QUANTITE_DEPASSEE')
    expect(erreur(trop).regle).toBe('RG-COO-264')
    expect(await db.uniteColis.count({ where: { uniteId: u.id } })).toBe(0)
    expect((await umLue(u.id)).statut).toBe('EN_COURS')
    const ok = await ajouter(s, c, u, 10)
    expect(ok.statusCode, ok.body).toBe(200)
    expect(resultat(ok).colis?.unites[0]?.quantite).toBe(10)
  })

  it('RG-COO-264 une quantité fractionnaire (2,5) est refusée (400) : uc_qte est un entier', async () => {
    const s = await siteColis()
    const u = await um(s)
    const c = await ouvrir(s)
    const r = await ecrire(s, 'expe', `/${String(c.id)}/unites`, {
      version: c.version,
      code: code(u),
      quantite: 2.5,
    })
    expect(r.statusCode).toBe(400)
    expect(await db.uniteColis.count({ where: { colisId: c.id } })).toBe(0)
  })

  it('RG-COO-264 / 267 retirer une fraction libère sa quantité : après 4 + 6 puis retrait du colis de 6, 7 est refusé et 6 accepté', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c1 = await ouvrir(s)
    const c2 = await ouvrir(s)
    await ajouter(s, c1, u, 4)
    const m2 = resultat(await ajouter(s, c2, u, 6)).colis
    const retrait = await ecrire(s, 'expe', `/${String(c2.id)}/retirer`, {
      version: m2?.version ?? 0,
      tout: true,
    })
    expect(resultat(retrait).supprime).toBe(true)
    const c3 = await ouvrir(s)
    expect((await ajouter(s, c3, u, 7)).statusCode).toBe(422)
    const ok = await ajouter(s, c3, u, 6)
    expect(ok.statusCode, ok.body).toBe(200)
    const lignes = await db.uniteColis.findMany({ where: { uniteId: u.id } })
    expect(lignes.reduce((somme, l) => somme + l.quantite, 0)).toBe(10)
  })

  it('RG-COO-264 concurrence : une UM « Préparé » placée en parallèle dans deux colis ne dépasse jamais sa quantité (Σ uc_qte ≤ UM_qte)', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c0 = await ouvrir(s)
    expect((await ajouter(s, c0, u, 2)).statusCode).toBe(200)
    const c1 = await ouvrir(s)
    const c2 = await ouvrir(s)
    const rs = await Promise.all([ajouter(s, c1, u), ajouter(s, c2, u)]) // chacun veut le reste (8)
    const lignes = await db.uniteColis.findMany({ where: { uniteId: u.id } })
    const somme = lignes.reduce((x, l) => x + l.quantite, 0)
    expect(
      somme,
      rs.map((r) => `${String(r.statusCode)} ${r.body}`).join(' | '),
    ).toBeLessThanOrEqual(10)
  })

  it('RG-COO-265 une UM du site voisin (autre atelier, autre plateforme) ne se scanne pas dans un colis de mon site : 422, rien écrit', async () => {
    const s = await siteColis()
    const autre = await siteColis()
    const etrangere = await um(autre)
    const c = await ouvrir(s)
    const r = await ajouter(s, c, etrangere)
    expect(r.statusCode).toBe(422)
    expect(await db.uniteColis.count({ where: { uniteId: etrangere.id } })).toBe(0)
    expect((await umLue(etrangere.id)).statut).toBe('EN_COURS')
  })

  it('RG-COO-265 un code UM-<id> inconnu est refusé (422) comme un code barre inconnu', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    const r = await ecrire(s, 'expe', `/${String(c.id)}/unites`, {
      version: c.version,
      code: 'UM-999999999',
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('COO_UM_NON_COLISABLE')
  })

  it('RG-COO-265 / 268 UM de statuts différents dans un même colis : « En cours » et « Préparé » (déjà dans un autre colis ouvert) ; à l’expédition seule l’UM sans autre colis ouvert devient « A expédier »', async () => {
    const s = await siteColis()
    const seule = await um(s, { qte: 3 })
    const partagee = await um(s, { qte: 10 })
    const autre = await ouvrir(s)
    expect((await ajouter(s, autre, partagee, 4)).statusCode).toBe(200) // « Préparé »
    expect((await umLue(partagee.id)).statut).toBe('PREPARE')
    const c = await ouvrir(s)
    const a = resultat(await ajouter(s, c, seule)).colis
    const b = resultat(await ajouter(s, a ?? c, partagee, 6)).colis // 2e colis pour une UM « Préparé »
    expect(b?.nbUnites).toBe(2)
    expect(b?.quantite).toBe(9)
    expect((await expedier(s, b ?? c)).statusCode).toBe(200)
    expect((await umLue(seule.id)).statut).toBe('A_EXPEDIER')
    expect((await umLue(partagee.id)).statut).toBe('PREPARE')
  })
})

// ───────────────────────── RG-COO-263 : poids, valeurs limites ─────────────────────────

describe('RG-COO-263 poids : valeurs limites', () => {
  it.each([
    { poids: 0.5, qte: 1, attendu: 1 }, // 0,5 kg < minimum : forcé à 1
    { poids: 0.5, qte: 2, attendu: 1 }, // exactement 1 kg
    { poids: 0.4, qte: 3, attendu: 1.2 }, // > minimum : conservé
    { poids: 0, qte: 5, attendu: 1 }, // support sans poids : minimum
  ])(
    'RG-COO-263 support de $poids kg × $qte affiches → colis de $attendu kg',
    async ({ poids, qte, attendu }) => {
      const s = await siteColis()
      const support = await f.createSupport(db, { poids })
      const { colis } = await colisAvecUm(s, { qte, supportId: support.id })
      expect(colis.poids).toBe(attendu)
      expect(Number((await colisLu(colis.id)).poids)).toBe(attendu)
    },
  )

  it('RG-COO-263 UM sans support : poids du support 0, minimum 1 kg', async () => {
    const s = await siteColis()
    const { colis } = await colisAvecUm(s, { qte: 4, supportId: null })
    expect(colis.poids).toBe(1)
  })

  it('RG-COO-263 supports différents dans un même colis : Σ (uc_qte × poids de chaque support)', async () => {
    const s = await siteColis()
    const lourd = await f.createSupport(db, { poids: 1.5 })
    const c = await ouvrir(s)
    const a = resultat(await ajouter(s, c, await um(s, { qte: 2 }))).colis // 2 × 2 = 4
    const b = resultat(await ajouter(s, a ?? c, await um(s, { qte: 3, supportId: lourd.id }))).colis // 3 × 1,5 = 4,5
    expect(b?.poids).toBe(8.5)
  })

  it('RG-COO-263 le poids d’une fraction est uc_qte × poids (et non la quantité totale de l’UM)', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c = await ouvrir(s)
    const m = resultat(await ajouter(s, c, u, 3)).colis
    expect(m?.poids).toBe(6)
  })

  it('RG-COO-263 la majoration de 3 kg n’est pas cumulée au fil des ajouts ni à l’expédition (recalcul depuis zéro)', async () => {
    const s = await siteColis()
    await parametre(ctx, 'colis.ateliersMajoration', String(s.fixe.id))
    try {
      const c = await ouvrir(s)
      const a = resultat(await ajouter(s, c, await um(s, { qte: 2 }))).colis
      const b = resultat(await ajouter(s, a ?? c, await um(s, { qte: 1 }))).colis
      expect(b?.poids).toBe(9) // (2 + 1) × 2 + 3
      const clos = resultat(await expedier(s, b ?? c)).colis
      expect(clos?.poids).toBe(9)
      expect(Number((await colisLu(c.id)).poids)).toBe(9)
    } finally {
      await parametre(ctx, 'colis.ateliersMajoration', '')
    }
  })

  it('RG-COO-263 un atelier absent du paramètre `colis.ateliersMajoration` n’est pas majoré (liste de plusieurs ateliers : seuls ceux listés)', async () => {
    const s = await siteColis()
    await parametre(ctx, 'colis.ateliersMajoration', `${String(s.scroll.id)};999999`)
    try {
      const c = await ouvrir(s) // atelier fixe, non listé
      expect(c.poids).toBe(1)
      const cs = await ouvrir(s, { atelier: 'scroll' }) // listé
      expect(cs.poids).toBe(4)
    } finally {
      await parametre(ctx, 'colis.ateliersMajoration', '')
    }
  })
})

// ───────────────────────── RG-COO-270 : trains ─────────────────────────

describe('RG-COO-270 / 267 compléments sur les trains', () => {
  it('RG-COO-270 atomicité fonctionnelle : si une face du train est dans un statut interdit, aucune face n’est modifiée (409, tout ou rien)', async () => {
    const s = await siteColis()
    const t = await train(s, { n: 3 })
    await db.faceTrain.update({
      where: { id: t.faces[2]?.id ?? 0 },
      data: { statut: 'INSTRUCTION_OK' },
    })
    const c = await ouvrir(s, { atelier: 'scroll' })
    const r = await ajouterTrain(s, c, t.trainId)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('TRANSITION_INTERDITE')
    for (const face of t.faces) {
      const lue = await faceLue(face.id)
      expect(lue.colisId).toBeNull()
      expect(lue.statut).not.toBe('A_EXPEDIER')
    }
    expect((await colisLu(c.id)).version).toBe(c.version)
  })

  it('RG-COO-270 les faces annulées du train restent annulées et hors du colis (poids et quantité : faces non annulées)', async () => {
    const s = await siteColis()
    const t = await train(s, { n: 3 })
    await db.faceTrain.update({ where: { id: t.faces[2]?.id ?? 0 }, data: { statut: 'ANNULE' } })
    const c = await ouvrir(s, { atelier: 'scroll' })
    const r = await ajouterTrain(s, c, t.trainId)
    expect(r.statusCode, r.body).toBe(200)
    expect(resultat(r).colis).toMatchObject({ quantite: 2, poids: 4 })
    const annulee = await faceLue(t.faces[2]?.id ?? 0)
    expect(annulee.statut).toBe('ANNULE')
    expect(annulee.colisId).toBeNull()
  })

  it('RG-COO-270 un train d’un autre atelier déroulant n’entre pas dans le colis (refus 404 ou 422), faces intactes', async () => {
    const s = await siteColis()
    const autreAtelier = await f.createAtelier(db, {
      plateformeId: s.plateforme.id,
      type: 'SCROLL',
    })
    purge.ateliers.push(autreAtelier.id)
    const t = await train(s, { atelierId: autreAtelier.id })
    const c = await ouvrir(s, { atelier: 'scroll' })
    const r = await ajouterTrain(s, c, t.trainId)
    expect([404, 422]).toContain(r.statusCode)
    for (const face of t.faces) expect((await faceLue(face.id)).colisId).toBeNull()
  })

  it('RG-COO-270 concurrence : le même train placé en parallèle dans deux colis n’entre que dans un seul', async () => {
    const s = await siteColis()
    const t = await train(s, { n: 2 })
    const c1 = await ouvrir(s, { atelier: 'scroll' })
    const c2 = await ouvrir(s, { atelier: 'scroll' })
    const rs = await Promise.all([ajouterTrain(s, c1, t.trainId), ajouterTrain(s, c2, t.trainId)])
    expect(
      rs.filter((r) => r.statusCode === 200),
      rs.map((r) => r.body).join(' | '),
    ).toHaveLength(1)
    const colisFaces = new Set(
      (await Promise.all(t.faces.map((x) => faceLue(x.id)))).map((x) => x.colisId),
    )
    expect(colisFaces.size).toBe(1)
    expect([...colisFaces][0]).not.toBeNull()
  })

  it('RG-COO-267 retirer un seul train d’un colis qui en contient deux : l’autre reste, poids recalculé, faces retirées rendues', async () => {
    const s = await siteColis()
    const a = await train(s, { n: 2, statut: 'AU_ROULAGE' })
    const b = await train(s, { n: 3, statut: 'A_IMPRIMER' })
    const c = await ouvrir(s, { atelier: 'scroll' })
    const m1 = resultat(await ajouterTrain(s, c, a.trainId)).colis
    const m2 = resultat(await ajouterTrain(s, m1 ?? c, b.trainId)).colis
    expect(m2?.poids).toBe(10)
    const r = await ecrire(s, 'expe', `/${String(c.id)}/retirer`, {
      version: m2?.version ?? 0,
      trains: [a.trainId],
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(resultat(r).colis).toMatchObject({ nbTrains: 1, quantite: 3, poids: 6 })
    for (const face of a.faces) {
      const lue = await faceLue(face.id)
      expect(lue.statut).toBe('AU_ROULAGE')
      expect(lue.colisId).toBeNull()
    }
    for (const face of b.faces) expect((await faceLue(face.id)).colisId).toBe(c.id)
  })

  it('RG-COO-268 « Expédier » un colis de train : colis « A expédier », date posée, faces restent « A expédier » (7) avec leur colis', async () => {
    const s = await siteColis()
    const { t, colis } = await colisTrain(s, 2)
    const r = await expedier(s, colis)
    expect(r.statusCode, r.body).toBe(200)
    const m = resultat(r).colis
    expect(m?.statut).toBe('A_EXPEDIER')
    expect(m?.dateExpedition).not.toBeNull()
    for (const face of t.faces) {
      const lue = await faceLue(face.id)
      expect(lue.statut).toBe('A_EXPEDIER')
      expect(lue.colisId).toBe(colis.id)
    }
    const journal = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: String(colis.id), action: 'EXPEDITION_COLIS' },
    })
    expect(JSON.parse(journal.donnees ?? '{}')).toMatchObject({ unites: 0, faces: 2 })
  })
})

// ───────────────────────── RG-COO-267 : retrait et UM d’un colis clos ─────────────────────────

describe('RG-COO-267 / 268 retrait avec colis frères', () => {
  it('RG-COO-267 retirer une fraction quand l’autre colis est clos : l’UM passe « A expédier » (HYPOTHÈSE Q-197 (5))', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c1 = await ouvrir(s)
    const c2 = await ouvrir(s)
    const m1 = resultat(await ajouter(s, c1, u, 4)).colis
    const m2 = resultat(await ajouter(s, c2, u, 6)).colis
    await expedier(s, m1 ?? c1)
    expect((await umLue(u.id)).statut).toBe('PREPARE')
    const r = await ecrire(s, 'expe', `/${String(c2.id)}/retirer`, {
      version: m2?.version ?? 0,
      unites: [u.id],
    })
    expect(r.statusCode, r.body).toBe(200)
    expect((await umLue(u.id)).statut).toBe('A_EXPEDIER')
  })

  it('RG-COO-267 atomicité : un échec du journal de retrait laisse la ligne UM ↔ colis, le statut de l’UM et la version intacts', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 2 })
    const autre = await um(s, { qte: 2 })
    const m = resultat(await ajouter(s, colis, autre)).colis
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'RETRAIT_COLIS' AND NEW.entite_id = '${String(colis.id)}'`,
      () =>
        ecrire(s, 'expe', `/${String(colis.id)}/retirer`, {
          version: m?.version ?? 0,
          unites: [u.id],
        }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.uniteColis.count({ where: { colisId: colis.id } })).toBe(2)
    expect((await umLue(u.id)).statut).toBe('PREPARE')
    expect((await colisLu(colis.id)).version).toBe(m?.version)
  })

  it('RG-COO-267 concurrence : deux retraits de la même version, un seul aboutit (l’autre 404 ou 409), une seule UM retirée', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 2 })
    const autre = await um(s, { qte: 2 })
    const m = resultat(await ajouter(s, colis, autre)).colis
    const corps = { version: m?.version ?? 0, unites: [u.id] }
    const rs = await Promise.all([
      ecrire(s, 'expe', `/${String(colis.id)}/retirer`, corps),
      ecrire(s, 'expe', `/${String(colis.id)}/retirer`, corps),
    ])
    expect(
      rs.filter((r) => r.statusCode === 200),
      rs.map((r) => r.body).join(' | '),
    ).toHaveLength(1)
    for (const r of rs) expect([200, 404, 409]).toContain(r.statusCode)
    expect(await db.uniteColis.count({ where: { colisId: colis.id } })).toBe(1)
    expect((await umLue(u.id)).statut).toBe('EN_COURS')
  })
})

// ───────────────────────── RG-COO-268 : expédition, compléments ─────────────────────────

describe('RG-COO-268 compléments (limites, concurrence, idempotence, atomicité)', () => {
  it('RG-COO-268 limites des champs : format 99, commentaire 200 car., code externe 50 car. acceptés ; 100, 201 et 51 refusés (400), colis intact', async () => {
    const s = await siteColis()
    const { colis } = await colisAvecUm(s)
    for (const corps of [
      { formatCode: 100 },
      { formatCode: 0 },
      { commentaire: 'x'.repeat(201) },
      { codeExterne: 'x'.repeat(51) },
      { commentaire: '   ' },
    ])
      expect(
        (
          await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, {
            version: colis.version,
            ...corps,
          })
        ).statusCode,
        JSON.stringify(corps).slice(0, 40),
      ).toBe(400)
    expect((await colisLu(colis.id)).statut).toBe('EN_COURS')
    const ok = await ecrire(s, 'expe', `/${String(colis.id)}/expedier`, {
      version: colis.version,
      formatCode: 99,
      commentaire: 'c'.repeat(200),
      codeExterne: 'e'.repeat(50),
    })
    expect(ok.statusCode, ok.body).toBe(200)
    expect(resultat(ok).colis).toMatchObject({ formatCode: 99, codeExterne: 'e'.repeat(50) })
  })

  it('RG-COO-268 concurrence : deux expéditions de la même version, une seule aboutit (409 pour l’autre), un seul historique « A expédier »', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 2 })
    const rs = await Promise.all([expedier(s, colis), expedier(s, colis)])
    expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 409])
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'COLIS', entiteId: String(colis.id), nouveau: 'A_EXPEDIER' },
      }),
    ).toBe(1)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(u.id), nouveau: 'A_EXPEDIER' },
      }),
    ).toBe(1)
  })

  it('RG-COO-268 idempotence : la même clé rejouée n’expédie qu’une fois (même réponse, un seul journal)', async () => {
    const s = await siteColis()
    const { colis } = await colisAvecUm(s)
    const cle = idem()
    const r1 = await expedier(s, colis, 'expe', cle)
    const r2 = await expedier(s, colis, 'expe', cle)
    expect(r1.statusCode).toBe(200)
    expect(r2.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(colis.id), action: 'EXPEDITION_COLIS' },
      }),
    ).toBe(1)
  })

  it('RG-COO-267 / 266 idempotence : la même clé rejouée pour un retrait et une suppression renvoie la même réponse sans 404 ni 2e écriture', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 2 })
    const cleR = idem()
    const corps = { version: colis.version, unites: [u.id] }
    const r1 = await ecrire(s, 'expe', `/${String(colis.id)}/retirer`, corps, cleR)
    const r2 = await ecrire(s, 'expe', `/${String(colis.id)}/retirer`, corps, cleR)
    expect(r1.statusCode, r1.body).toBe(200)
    expect(r2.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(colis.id), action: 'RETRAIT_COLIS' },
      }),
    ).toBe(1)

    const vide = await ouvrir(s)
    const cleS = idem()
    const s1 = await ecrire(
      s,
      'expe',
      `/${String(vide.id)}/supprimer`,
      { version: vide.version },
      cleS,
    )
    const s2 = await ecrire(
      s,
      'expe',
      `/${String(vide.id)}/supprimer`,
      { version: vide.version },
      cleS,
    )
    expect(s1.statusCode).toBe(200)
    expect(s2.statusCode).toBe(200)
    expect(s2.json()).toEqual(s1.json())
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(vide.id), action: 'SUPPRESSION_COLIS' },
      }),
    ).toBe(1)
  })

  it('RG-COO-270 idempotence : la même clé rejouée pour l’ajout d’un train ne place le train qu’une fois', async () => {
    const s = await siteColis()
    const t = await train(s, { n: 2 })
    const c = await ouvrir(s, { atelier: 'scroll' })
    const cle = idem()
    const corps = { version: c.version, trainId: t.trainId }
    const r1 = await ecrire(s, 'expe', `/${String(c.id)}/trains`, corps, cle)
    const r2 = await ecrire(s, 'expe', `/${String(c.id)}/trains`, corps, cle)
    expect(r1.statusCode, r1.body).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(
      await db.statutHistorique.count({
        where: {
          typeEntite: 'FACE_TRAIN',
          entiteId: String(t.faces[0]?.id),
          nouveau: 'A_EXPEDIER',
        },
      }),
    ).toBe(1)
  })

  it('RG-COO-268 atomicité : un échec du journal d’expédition (dernière écriture) annule le statut du colis, de l’UM et leur historique', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 2 })
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'EXPEDITION_COLIS' AND NEW.entite_id = '${String(colis.id)}'`,
      () => expedier(s, colis),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    const lu = await colisLu(colis.id)
    expect(lu.statut).toBe('EN_COURS')
    expect(lu.version).toBe(colis.version)
    expect((await umLue(u.id)).statut).toBe('PREPARE')
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'COLIS', entiteId: String(colis.id), nouveau: 'A_EXPEDIER' },
      }),
    ).toBe(0)
    expect((await expedier(s, colis)).statusCode).toBe(200)
  })
})

// ───────────────────────── RG-COO-269 / RG-X-087 : fin de journée ─────────────────────────

describe('RG-COO-269 / RG-X-087 fin de journée : compléments', () => {
  it('RG-X-087 la sortie de stock respecte l’ordre FIFO (affiche reçue la plus ancienne d’abord), même si elle a été créée en dernier', async () => {
    const s = await siteColis()
    const { u } = await colisExpedie(s, { qte: 6 })
    const recente = await affiche(s, u, 5, { dateEntree: new Date('2026-02-05') })
    const ancienne = await affiche(s, u, 5, { dateEntree: new Date('2026-01-05') })
    await fin(s)
    expect(await stockDe(ancienne.id)).toBe(0)
    expect(await stockDe(recente.id)).toBe(4)
  })

  it('RG-X-087 jamais de stock négatif : deux UM du même dossier / thème se partagent un stock de 5 (3 + 4) ; le manquant de 2 est tracé, l’affiche vaut 0', async () => {
    const s = await siteColis()
    const contNum = A(next())
    const theme = `Partagé ${String(next())}`
    const a = await colisExpedie(s, { qte: 3, contNum, theme })
    const b = await colisExpedie(s, { qte: 4, contNum, theme })
    const aff = await affiche(s, { contNum, theme }, 5)
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res.colis.sort()).toEqual([a.colis.id, b.colis.id].sort())
    expect(res.manquants.reduce((x, m) => x + m.manquant, 0)).toBe(2)
    expect(res.manquants.every((m) => m.raison === 'STOCK_INSUFFISANT')).toBe(true)
    expect(await stockDe(aff.id)).toBe(0)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: aff.id } })).quantite).toBe(0)
    const sorties = await db.mouvement.findMany({
      where: { afficheId: aff.id, type: 'EXPEDITION' },
    })
    expect(sorties.reduce((x, m) => x + m.quantite, 0)).toBe(-5)
    expect(sorties.every((m) => m.quantite < 0)).toBe(true)
  })

  it('RG-X-087 un stock exactement égal à la quantité expédiée donne un stock nul et aucun manquant (limite)', async () => {
    const s = await siteColis()
    const { u } = await colisExpedie(s, { qte: 7 })
    const a = await affiche(s, u, 7)
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res.manquants).toEqual([])
    expect(await stockDe(a.id)).toBe(0)
  })

  it('RG-X-087 une UM sans dossier n’a aucune affiche à débiter : manquant « AUCUNE_AFFICHE », aucun mouvement, le colis passe « Terminé »', async () => {
    const s = await siteColis()
    const { u, colis } = await colisExpedie(s, { qte: 3 })
    await db.uniteManutention.update({ where: { id: u.id }, data: { contNum: null } })
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res.manquants).toEqual([
      { colis: colis.id, uniteId: u.id, manquant: 3, raison: 'AUCUNE_AFFICHE' },
    ])
    expect((await colisLu(colis.id)).statut).toBe('TERMINE')
  })

  it('RG-COO-269 une UM dans deux colis « A expédier » traités au même passage : « Terminé » une seule fois, chaque colis débite sa quantité', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const a = await affiche(s, u, 10)
    const c1 = await ouvrir(s)
    const c2 = await ouvrir(s)
    const m1 = resultat(await ajouter(s, c1, u, 4)).colis
    const m2 = resultat(await ajouter(s, c2, u, 6)).colis
    await expedier(s, m1 ?? c1)
    await expedier(s, m2 ?? c2)
    expect((await umLue(u.id)).statut).toBe('A_EXPEDIER')
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res).toMatchObject({ unites: 1, sortiesStock: 2, manquants: [] })
    expect((await umLue(u.id)).statut).toBe('TERMINE')
    expect(await stockDe(a.id)).toBe(0)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(u.id), nouveau: 'TERMINE' },
      }),
    ).toBe(1)
  })

  it('RG-COO-269 passage mixte : un colis d’UM et un colis de train dans le même passage, compteurs et stock cohérents (aucune sortie pour le train)', async () => {
    const s = await siteColis()
    const { u, colis: cu } = await colisExpedie(s, { qte: 2 })
    const a = await affiche(s, u, 5)
    const { t, colis: ct } = await colisTrain(s, 3)
    await expedier(s, ct)
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res.colis.sort()).toEqual([cu.id, ct.id].sort())
    expect(res).toMatchObject({ unites: 1, faces: 3, sortiesStock: 1 })
    expect(await stockDe(a.id)).toBe(3)
    for (const face of t.faces) expect((await faceLue(face.id)).statut).toBe('TERMINE')
  })

  it('RG-COO-269 historique : l’UM et les faces « Terminé » portent la règle RG-COO-269 ; le journal de fin de journée consigne sorties et manquants', async () => {
    const s = await siteColis()
    const { u, colis } = await colisExpedie(s, { qte: 4 })
    await fin(s)
    const h = await db.statutHistorique.findFirstOrThrow({
      where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(u.id), nouveau: 'TERMINE' },
    })
    expect(h).toMatchObject({ ancien: 'A_EXPEDIER', regle: 'RG-COO-269', parId: s.users.expe.id })
    const j = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: String(colis.id), action: 'FIN_JOURNEE_COLIS' },
    })
    expect(JSON.parse(j.donnees ?? '{}')).toEqual({
      sorties: 0,
      manquants: [{ colis: colis.id, uniteId: u.id, manquant: 4, raison: 'AUCUNE_AFFICHE' }],
    })
  })

  it('RG-COO-269 concurrence : deux fins de journée simultanées ne débitent le stock qu’une fois (pas de double sortie, pas de stock négatif)', async () => {
    const s = await siteColis()
    const { u, colis } = await colisExpedie(s, { qte: 5 })
    const a = await affiche(s, u, 8)
    const rs = await Promise.all([fin(s), fin(s)])
    for (const r of rs) expect([200, 409], r.body).toContain(r.statusCode)
    expect(await db.mouvement.count({ where: { afficheId: a.id, type: 'EXPEDITION' } })).toBe(1)
    expect(await stockDe(a.id)).toBe(3)
    expect((await colisLu(colis.id)).statut).toBe('TERMINE')
  })

  it('RG-X-087 atomicité : un échec sur le 2e colis annule aussi le 1er (colis, UM, historique et stock inchangés), puis le passage suivant aboutit', async () => {
    const s = await siteColis()
    const premier = await colisExpedie(s, { qte: 2 })
    const second = await colisExpedie(s, { qte: 3 })
    const a1 = await affiche(s, premier.u, 4)
    const a2 = await affiche(s, second.u, 4)
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'MAIL_COLIS' AND NEW.entite_id = '${String(second.colis.id)}'`,
      () => fin(s),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    for (const { colis, u } of [premier, second]) {
      expect((await colisLu(colis.id)).statut).toBe('A_EXPEDIER')
      expect((await umLue(u.id)).statut).toBe('A_EXPEDIER')
      expect(
        await db.statutHistorique.count({
          where: { typeEntite: 'COLIS', entiteId: String(colis.id), nouveau: 'TERMINE' },
        }),
      ).toBe(0)
    }
    expect(await stockDe(a1.id)).toBe(4)
    expect(await stockDe(a2.id)).toBe(4)
    expect(
      await db.mouvement.count({
        where: { afficheId: { in: [a1.id, a2.id] }, type: 'EXPEDITION' },
      }),
    ).toBe(0)
    expect((await fin(s)).statusCode).toBe(200)
    expect(await stockDe(a1.id)).toBe(2)
    expect(await stockDe(a2.id)).toBe(1)
  })

  it('RG-COO-269 atomicité : un échec de l’historique de l’UM « Terminé » annule colis et stock ; un échec de l’historique d’une face annule le colis de train', async () => {
    const s = await siteColis()
    const { u, colis } = await colisExpedie(s, { qte: 2 })
    const a = await affiche(s, u, 5)
    const r1 = await avecEchec(
      ctx,
      `BEFORE INSERT ON statut_historique WHEN NEW.type_entite = 'UNITE_MANUTENTION' AND NEW.nouveau = 'TERMINE' AND NEW.entite_id = '${String(u.id)}'`,
      () => fin(s),
    )
    expect(r1.statusCode).toBeGreaterThanOrEqual(500)
    expect((await colisLu(colis.id)).statut).toBe('A_EXPEDIER')
    expect(await stockDe(a.id)).toBe(5)

    const { t, colis: ct } = await colisTrain(s, 2)
    await expedier(s, ct)
    const r2 = await avecEchec(
      ctx,
      `BEFORE INSERT ON statut_historique WHEN NEW.type_entite = 'FACE_TRAIN' AND NEW.nouveau = 'TERMINE' AND NEW.entite_id = '${String(t.faces[1]?.id)}'`,
      () => fin(s),
    )
    expect(r2.statusCode).toBeGreaterThanOrEqual(500)
    expect((await colisLu(ct.id)).statut).toBe('A_EXPEDIER')
    for (const face of t.faces) expect((await faceLue(face.id)).statut).toBe('A_EXPEDIER')
  })

  it('RG-COO-249 / 269 une UM « Terminé » ne se retire plus et la main ne se rend plus (409), ses colis non plus', async () => {
    const s = await siteColis()
    const { u } = await colisExpedie(s, { qte: 2 })
    await fin(s)
    expect((await umLue(u.id)).statut).toBe('TERMINE')
    const rep = await f.createRepartition(db, {
      atelierId: s.fixe.id,
      supportId: s.support.id,
      destinataireId: s.dest[0].id,
      contNum: u.contNum,
      theme: u.theme,
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      uniteId: u.id,
      qte: 2,
      statut: 'EN_COURS',
    })
    // « Retirer » : 409 (seule l'UM « En cours » se retire) ; « Rendre la main » : « Aucune unité à rendre »
    // (422, RG-COO-243 : unité déjà au-delà du point de non-retour). Dans les deux cas rien n'est écrit.
    const attendu: Record<string, number> = { retirer: 409, 'rendre-la-main': 422 }
    for (const chemin of ['retirer', 'rendre-la-main']) {
      const r = await post(ctx, `/api/coordination/unitaire/${chemin}`, s.users.coord.headers, {
        lignes: [{ id: rep.id, version: rep.version }],
      })
      expect(r.statusCode, `${chemin} : ${r.body}`).toBe(attendu[chemin])
    }
    expect(await db.uniteManutention.count({ where: { id: u.id } })).toBe(1)
    expect((await db.repartition.findUniqueOrThrow({ where: { id: rep.id } })).statut).toBe(
      'EN_COURS',
    )
  })
})

// ───────────────────────── RG-COO-249 : garde ─────────────────────────

describe('RG-COO-249 garde « UM dans un colis » : compléments', () => {
  async function avecRepartition(
    s: Site,
    u: Awaited<ReturnType<typeof um>>,
    statut: StatutProduction = 'EN_COURS',
  ) {
    return f.createRepartition(db, {
      atelierId: s.fixe.id,
      supportId: s.support.id,
      destinataireId: s.dest[0].id,
      contNum: u.contNum,
      theme: u.theme,
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      uniteId: u.id,
      qte: u.qte ?? 1,
      statut,
    })
  }
  const unitaire = (s: Site, chemin: string, rep: { id: number; version: number }) =>
    post(ctx, `/api/coordination/unitaire/${chemin}`, s.users.coord.headers, {
      lignes: [{ id: rep.id, version: rep.version }],
    })

  it('RG-COO-249 une UM dans un colis clos (« A expédier ») ne se retire pas et la main ne se rend pas : 409, UM et répartition inchangées', async () => {
    const s = await siteColis()
    const { u } = await colisExpedie(s, { qte: 3 })
    const rep = await avecRepartition(s, u)
    // « Retirer » : 409 ; « Rendre la main » : 422 « Aucune unité à rendre » (UM au-delà du point de non-retour, RG-COO-243)
    const attendu: Record<string, number> = { retirer: 409, 'rendre-la-main': 422 }
    for (const chemin of ['retirer', 'rendre-la-main']) {
      const r = await unitaire(s, chemin, rep)
      expect(r.statusCode, `${chemin} : ${r.body}`).toBe(attendu[chemin])
    }
    expect(await db.uniteManutention.count({ where: { id: u.id } })).toBe(1)
    expect((await db.repartition.findUniqueOrThrow({ where: { id: rep.id } })).uniteId).toBe(u.id)
  })

  it('RG-COO-249 la garde cite la règle : retirer → RG-COO-249, rendre la main → RG-COO-243 (UM « En cours » forcée, encore dans un colis)', async () => {
    const s = await siteColis()
    const { u } = await colisAvecUm(s, { qte: 3 })
    await db.uniteManutention.update({ where: { id: u.id }, data: { statut: 'EN_COURS' } })
    const rep = await avecRepartition(s, u)
    const retirer = await unitaire(s, 'retirer', rep)
    expect(retirer.statusCode).toBe(409)
    expect(erreur(retirer).code).toBe('COO_UM_DANS_COLIS')
    expect(erreur(retirer).regle).toBe('RG-COO-249')
    const main = await unitaire(s, 'rendre-la-main', rep)
    expect(main.statusCode).toBe(409)
    expect(erreur(main).code).toBe('COO_UM_DANS_COLIS')
    expect(erreur(main).regle).toBe('RG-COO-243')
  })

  it('RG-COO-249 une UM fractionnée reste gardée tant qu’elle est dans UN colis (retirée d’un seul des deux : toujours 409)', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c1 = await ouvrir(s)
    const c2 = await ouvrir(s)
    const m1 = resultat(await ajouter(s, c1, u, 4)).colis
    await ajouter(s, c2, u, 6)
    const sortie = await ecrire(s, 'expe', `/${String(c1.id)}/retirer`, {
      version: m1?.version ?? 0,
      tout: true,
    })
    expect(resultat(sortie).supprime).toBe(true)
    await db.uniteManutention.update({ where: { id: u.id }, data: { statut: 'EN_COURS' } })
    const rep = await avecRepartition(s, u)
    const r = await unitaire(s, 'retirer', rep)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_UM_DANS_COLIS')
    expect(await db.uniteManutention.count({ where: { id: u.id } })).toBe(1)
  })

  it('RG-COO-249 / 278 une UM « Annulé » encore reliée à un colis (déblocage : colis inchangés) ne se retire pas : 409, UM conservée', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 2 })
    await db.uniteManutention.update({ where: { id: u.id }, data: { statut: 'ANNULE' } })
    const rep = await avecRepartition(s, u, 'ANNULE')
    const r = await unitaire(s, 'retirer', rep)
    expect(r.statusCode, r.body).toBe(409)
    expect(await db.uniteManutention.count({ where: { id: u.id } })).toBe(1)
    expect(await db.uniteColis.count({ where: { colisId: colis.id } })).toBe(1)
    // le colis garde son statut (RG-COO-278) et l'UM annulée ne peut plus entrer dans un autre colis
    expect((await colisLu(colis.id)).statut).toBe('EN_COURS')
    const autre = await ouvrir(s)
    expect((await ajouter(s, autre, u)).statusCode).toBe(422)
  })
})

// ───────────────────────── RG-COO-280 : statut effectif ─────────────────────────

describe('RG-COO-280 statut de l’UM prime sur celui de la répartition (suivi de production)', () => {
  it('RG-COO-280 le suivi lit le statut de l’UM à chaque étape (Préparé, A expédier, Terminé) ; une répartition sans UM garde son statut', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 3 })
    const contNum = u.contNum ?? 0
    const dossier = await f.createDossier(db, { contNum, statut: 'PREPARATION_RECUE' })
    purge.dossiers.push(dossier.id)
    const base = {
      atelierId: s.fixe.id,
      supportId: s.support.id,
      destinataireId: s.dest[0].id,
      contNum,
      theme: u.theme,
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      statut: 'EN_COURS' as const,
    }
    const avecUm = await f.createRepartition(db, { ...base, uniteId: u.id })
    const sansUm = await f.createRepartition(db, { ...base, statut: 'A_TRAITER' })
    const ligne = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      atelierId: s.fixe.id,
      contNum,
      theme: u.theme,
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      source: 'PREPA',
    })
    const lireStatuts = async () => {
      const r = await get(
        ctx,
        `/api/coordination/suivi-production?dossier=${String(contNum)}`,
        s.users.cheq.headers,
      )
      expect(r.statusCode, r.body).toBe(200)
      const item = r
        .json<{
          items: { ligneAttendueId: number; repartitions: { id: number; statut: string }[] }[]
        }>()
        .items.find((i) => i.ligneAttendueId === ligne.id)
      return new Map((item?.repartitions ?? []).map((x) => [x.id, x.statut]))
    }
    let st = await lireStatuts()
    expect(st.get(avecUm.id)).toBe('PREPARE')
    expect(st.get(sansUm.id)).toBe('A_TRAITER')
    await expedier(s, colis)
    st = await lireStatuts()
    expect(st.get(avecUm.id)).toBe('A_EXPEDIER')
    await fin(s)
    st = await lireStatuts()
    expect(st.get(avecUm.id)).toBe('TERMINE')
    expect(st.get(sansUm.id)).toBe('A_TRAITER')
    // aucune écriture sur la répartition
    expect((await db.repartition.findUniqueOrThrow({ where: { id: avecUm.id } })).statut).toBe(
      'EN_COURS',
    )
  })
})

// ───────────────────────── permissions ─────────────────────────

describe('RG-COO-165 / 168 permissions : chaque profil, chaque action', () => {
  it.each(['cheq', 'expe'] as const)(
    'RG-COO-265 à 270 %s autorisé : parcours complet (créer, ajouter UM, retirer, expédier, fin de journée ; train : ajouter, retirer, expédier) en 200',
    async (role) => {
      const s = await siteColis()
      const c = await ouvrir(s, { role })
      const u1 = await um(s, { qte: 2 })
      const u2 = await um(s, { qte: 2 })
      const a = await ajouter(s, c, u1, undefined, role)
      expect(a.statusCode, a.body).toBe(200)
      const b = await ajouter(s, resultat(a).colis ?? c, u2, undefined, role)
      expect(b.statusCode, b.body).toBe(200)
      const r = await ecrire(s, role, `/${String(c.id)}/retirer`, {
        version: resultat(b).colis?.version ?? 0,
        unites: [u2.id],
      })
      expect(r.statusCode, r.body).toBe(200)
      const e = await expedier(s, resultat(r).colis ?? c, role)
      expect(e.statusCode, e.body).toBe(200)

      const t = await train(s)
      const cs = await ouvrir(s, { atelier: 'scroll', role })
      const at = await ajouterTrain(s, cs, t.trainId, role)
      expect(at.statusCode, at.body).toBe(200)
      const rt = await ecrire(s, role, `/${String(cs.id)}/retirer`, {
        version: resultat(at).colis?.version ?? 0,
        trains: [t.trainId],
      })
      expect(rt.statusCode, rt.body).toBe(200)
      const vide = await ouvrir(s, { role })
      const sup = await ecrire(s, role, `/${String(vide.id)}/supprimer`, { version: vide.version })
      expect(sup.statusCode, sup.body).toBe(200)

      const f1 = await fin(s, role)
      expect(f1.statusCode, f1.body).toBe(200)
      expect(ResultatFinDeJourneeSchema.parse(f1.json()).colis).toContain(c.id)
      expect((await colisLu(c.id)).statut).toBe('TERMINE')
      for (const chemin of ['', '/a-coliser', `/${String(c.id)}`])
        expect((await lire(s, role, chemin)).statusCode, chemin).toBe(200)
    },
  )

  it.each(['coord', 'recep', 'com'] as const)(
    'RG-COO-165 %s refusé : toutes les actions avec des données VALIDES répondent 403 et n’écrivent rien',
    async (role) => {
      const s = await siteColis()
      const { colis: ouvert, u: dedans } = await colisAvecUm(s, { qte: 2 })
      const libre = await um(s, { qte: 2 })
      const t = await train(s)
      const cs = await ouvrir(s, { atelier: 'scroll' })
      const { colis: clos } = await colisExpedie(s, { qte: 1 })
      const aff = await affiche(
        s,
        await umLue(
          (await db.uniteColis.findFirstOrThrow({ where: { colisId: clos.id } })).uniteId,
        ),
        3,
      )
      const avant = await db.colis.count({ where: { plateformeId: s.plateforme.id } })
      const regleAttendue = (r: string) => (role === 'com' ? 'RG-COO-168' : r)
      const cas: [string, string, unknown, string][] = [
        ['POST', '', { atelierId: s.fixe.id, destinataireId: s.dest[0].id }, 'RG-COO-266'],
        [
          'POST',
          `/${String(ouvert.id)}/unites`,
          { version: ouvert.version, code: code(libre) },
          'RG-COO-265',
        ],
        [
          'POST',
          `/${String(cs.id)}/trains`,
          { version: cs.version, trainId: t.trainId },
          'RG-COO-270',
        ],
        [
          'POST',
          `/${String(ouvert.id)}/retirer`,
          { version: ouvert.version, unites: [dedans.id] },
          'RG-COO-267',
        ],
        ['POST', `/${String(cs.id)}/supprimer`, { version: cs.version }, 'RG-COO-266'],
        ['POST', `/${String(ouvert.id)}/ouvrir`, { version: ouvert.version }, 'RG-COO-266'],
        ['POST', `/${String(ouvert.id)}/expedier`, { version: ouvert.version }, 'RG-COO-268'],
        ['POST', '/fin-de-journee', {}, 'RG-COO-269'],
      ]
      for (const [, chemin, corps, regle] of cas) {
        const r = await ecrire(s, role, chemin, corps)
        expect(r.statusCode, `${role} POST ${chemin} : ${r.body}`).toBe(403)
        expect(erreur(r).regle, chemin).toBe(regleAttendue(regle))
      }
      expect(await db.colis.count({ where: { plateformeId: s.plateforme.id } })).toBe(avant)
      expect((await umLue(libre.id)).statut).toBe('EN_COURS')
      expect(await db.uniteColis.count({ where: { colisId: ouvert.id } })).toBe(1)
      expect((await colisLu(ouvert.id)).statut).toBe('EN_COURS')
      expect((await colisLu(ouvert.id)).version).toBe(ouvert.version)
      expect(await db.colis.count({ where: { id: cs.id } })).toBe(1)
      for (const face of t.faces) expect((await faceLue(face.id)).colisId).toBeNull()
      expect((await colisLu(clos.id)).statut).toBe('A_EXPEDIER')
      expect(await stockDe(aff.id)).toBe(3)
      expect(await db.mouvement.count({ where: { afficheId: aff.id, type: 'EXPEDITION' } })).toBe(0)
    },
  )

  it('RG-COO-165 un utilisateur sans aucun rôle est refusé (403) sur la lecture comme sur l’écriture', async () => {
    const s = await siteColis()
    const sansRole = await f.createUtilisateurAvecRoles(db, [], [{ plateformeId: s.plateforme.id }])
    const h = devHeaders(sansRole.identifiantExterne)
    expect((await get(ctx, U, h)).statusCode).toBe(403)
    expect(
      (await ecrireH(h, '', { atelierId: s.fixe.id, destinataireId: s.dest[0].id })).statusCode,
    ).toBe(403)
    expect((await ecrireH(h, '/fin-de-journee', {})).statusCode).toBe(403)
  })

  it('RG-COO-165 sans identité (401) : ajout d’UM, de train, retrait, suppression, réouverture, lectures ; signature invalide : 401', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    const sansEntete = (chemin: string, payload: unknown) =>
      ctx.app.inject({
        method: 'POST',
        url: `${U}${chemin}`,
        headers: idem(),
        payload: payload as object,
      })
    const cas: [string, unknown][] = [
      [`/${String(c.id)}/unites`, { version: c.version, code: 'UM-1' }],
      [`/${String(c.id)}/trains`, { version: c.version, trainId: 'T1' }],
      [`/${String(c.id)}/retirer`, { version: c.version, tout: true }],
      [`/${String(c.id)}/supprimer`, { version: c.version }],
      [`/${String(c.id)}/ouvrir`, { version: c.version }],
    ]
    for (const [chemin, corps] of cas)
      expect((await sansEntete(chemin, corps)).statusCode, chemin).toBe(401)
    const faux = await ctx.app.inject({
      method: 'GET',
      url: U,
      headers: { [DEV_IDENTITY_HEADER]: 'signature-invalide' },
    })
    expect(faux.statusCode).toBe(401)
    expect((await colisLu(c.id)).version).toBe(c.version)
  })

  it('CLAUDE.md §6 sans Idempotency-Key : 400 sur chaque POST (création, ajout d’UM, de train, retrait, suppression, réouverture, expédition, fin de journée), rien d’écrit', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    const h = s.users.expe.headers
    const u = await um(s)
    const cas: [string, unknown][] = [
      ['', { atelierId: s.fixe.id, destinataireId: s.dest[0].id }],
      [`/${String(c.id)}/unites`, { version: c.version, code: code(u) }],
      [`/${String(c.id)}/trains`, { version: c.version, trainId: 'T1' }],
      [`/${String(c.id)}/retirer`, { version: c.version, tout: true }],
      [`/${String(c.id)}/supprimer`, { version: c.version }],
      [`/${String(c.id)}/ouvrir`, { version: c.version }],
      [`/${String(c.id)}/expedier`, { version: c.version }],
      ['/fin-de-journee', {}],
    ]
    const avant = await db.colis.count({ where: { plateformeId: s.plateforme.id } })
    for (const [chemin, corps] of cas)
      expect((await post(ctx, `${U}${chemin}`, h, corps, false)).statusCode, chemin).toBe(400)
    expect(await db.colis.count({ where: { plateformeId: s.plateforme.id } })).toBe(avant)
    expect(await db.uniteColis.count({ where: { uniteId: u.id } })).toBe(0)
  })
})

// ───────────────────────── périmètre : site choisi ─────────────────────────

describe('RG-COO-167 / Q-173 site choisi (x-site-id) sur l’écriture', () => {
  async function deuxSites() {
    const s1 = await siteColis()
    const s2 = await siteColis()
    const u = await f.createUtilisateurAvecRoles(
      db,
      ['expe'],
      [{ plateformeId: s1.plateforme.id }, { plateformeId: s2.plateforme.id }],
    )
    const h = (site?: number) => devHeaders(u.identifiantExterne, site)
    return { s1, s2, h }
  }

  it('RG-COO-269 la fin de journée ne traite que le site choisi : x-site-id = site 2 laisse le colis du site 1 « A expédier » ; sans en-tête, les deux sites', async () => {
    const { s1, s2, h } = await deuxSites()
    const { colis: c1 } = await colisExpedie(s1, { qte: 1 })
    const { colis: c2 } = await colisExpedie(s2, { qte: 1 })
    const r = await ecrireH(h(s2.plateforme.id), '/fin-de-journee', {})
    expect(r.statusCode, r.body).toBe(200)
    expect(ResultatFinDeJourneeSchema.parse(r.json()).colis).toEqual([c2.id])
    expect((await colisLu(c1.id)).statut).toBe('A_EXPEDIER')
    expect((await colisLu(c2.id)).statut).toBe('TERMINE')
    const toutes = await ecrireH(h(), '/fin-de-journee', {})
    expect(ResultatFinDeJourneeSchema.parse(toutes.json()).colis).toEqual([c1.id])
  })

  it('RG-COO-167 site choisi = site 2 : créer un colis sur un atelier du site 1, ajouter un train, rouvrir, expédier et lister les colis du site 1 sont refusés ou masqués ; rien d’écrit', async () => {
    const { s1, s2, h } = await deuxSites()
    const { colis: ouvert } = await colisAvecUm(s1)
    const cs1 = await ouvrir(s1, { atelier: 'scroll' })
    const t = await train(s1)
    const headers = h(s2.plateforme.id)
    const avant = await db.colis.count({ where: { plateformeId: s1.plateforme.id } })
    const creer = await ecrireH(headers, '', {
      atelierId: s1.fixe.id,
      destinataireId: s1.dest[0].id,
    })
    expect(creer.statusCode).toBe(403)
    for (const [chemin, corps] of [
      [`/${String(cs1.id)}/trains`, { version: cs1.version, trainId: t.trainId }],
      [`/${String(ouvert.id)}/ouvrir`, { version: ouvert.version }],
      [`/${String(ouvert.id)}/expedier`, { version: ouvert.version }],
    ] as const) {
      const r = await ecrireH(headers, chemin, corps)
      expect(r.statusCode, chemin).toBe(403)
      expect(erreur(r).regle, chemin).toBe('RG-COO-167')
    }
    expect(await db.colis.count({ where: { plateformeId: s1.plateforme.id } })).toBe(avant)
    for (const face of t.faces) expect((await faceLue(face.id)).colisId).toBeNull()
    const liste = ListeColisSchema.parse((await get(ctx, U, headers)).json())
    expect(liste.colis.map((x) => x.id)).not.toContain(ouvert.id)
    const lecture = await get(ctx, `${U}/${String(ouvert.id)}`, headers)
    expect(lecture.statusCode).toBe(403)
  })
})

// ───────────────────────── lectures : unités à coliser après fractionnement ─────────────────────────

describe('ECR-EXP-01 reste à placer après fractionnement et retrait', () => {
  it('RG-COO-264 la liste « à coliser » montre le reste à placer d’une UM fractionnée, puis la retire quand tout est placé ou quand l’UM est « A expédier »', async () => {
    const s = await siteColis()
    const u = await um(s, { qte: 10 })
    const c1 = await ouvrir(s)
    const m1 = resultat(await ajouter(s, c1, u, 4)).colis
    const reste = async () =>
      (
        await get(ctx, `${U}/a-coliser`, s.users.expe.headers).then((r) =>
          r.json<{
            groupes: { unites: { type: string; uniteId?: number; quantite?: number }[] }[]
          }>(),
        )
      ).groupes
        .flatMap((g) => g.unites)
        .find((x) => x.type === 'UM' && x.uniteId === u.id)
    expect((await reste())?.quantite).toBe(6)
    const c2 = await ouvrir(s)
    await ajouter(s, c2, u, 6)
    expect(await reste()).toBeUndefined() // plus rien à placer
    const r = await ecrire(s, 'expe', `/${String(c1.id)}/retirer`, {
      version: m1?.version ?? 0,
      tout: true,
    })
    expect(resultat(r).supprime).toBe(true)
    expect((await reste())?.quantite).toBe(4) // la fraction retirée redevient à placer
  })
})

// ───────────────────────── traçabilité, entrées, volumétrie ─────────────────────────

describe('traçabilité, limites d’entrée et volumétrie', () => {
  it('RG-COO-249 / 266 à 269 chaque écriture trace l’utilisateur : journal (parId), historique de statut (parId) et colis (updatedById)', async () => {
    const s = await siteColis()
    const moi = s.users.cheq.id
    const c = await ouvrir(s, { role: 'cheq' })
    const u1 = await um(s, { qte: 2 })
    const u2 = await um(s, { qte: 2 })
    const a = resultat(await ajouter(s, c, u1, undefined, 'cheq')).colis
    const b = resultat(await ajouter(s, a ?? c, u2, undefined, 'cheq')).colis
    const r = await ecrire(s, 'cheq', `/${String(c.id)}/retirer`, {
      version: b?.version ?? 0,
      unites: [u2.id],
    })
    const e = await expedier(s, resultat(r).colis ?? c, 'cheq')
    expect(e.statusCode, e.body).toBe(200)
    expect((await colisLu(c.id)).updatedById).toBe(moi)
    await fin(s, 'cheq')
    expect((await colisLu(c.id)).updatedById).toBe(moi)
    const journal = await db.journalAudit.findMany({
      where: { typeEntite: 'COLIS', entiteId: String(c.id) },
    })
    expect(journal.map((j) => j.action).sort()).toEqual(
      [
        'AJOUT_UM_COLIS',
        'AJOUT_UM_COLIS',
        'CREATION_COLIS',
        'EXPEDITION_COLIS',
        'FIN_JOURNEE_COLIS',
        'MAIL_COLIS',
        'RETRAIT_COLIS',
      ].sort(),
    )
    for (const j of journal) expect(j.parId, j.action).toBe(moi)
    const historiques = await db.statutHistorique.findMany({
      where: {
        OR: [
          { typeEntite: 'COLIS', entiteId: String(c.id) },
          { typeEntite: 'UNITE_MANUTENTION', entiteId: { in: [String(u1.id), String(u2.id)] } },
        ],
      },
    })
    expect(historiques.length).toBeGreaterThanOrEqual(6)
    for (const h of historiques) expect(h.parId, `${h.typeEntite} ${h.nouveau}`).toBe(moi)
    expect(
      (await db.uniteColis.findFirstOrThrow({ where: { colisId: c.id, uniteId: u1.id } }))
        .createdById,
    ).toBe(moi)
  })

  it('RG-COO-265 à 270 colis inconnu : 404 sur la lecture et sur chaque action (profil autorisé)', async () => {
    const s = await siteColis()
    expect((await lire(s, 'expe', '/999999999')).statusCode).toBe(404)
    for (const [chemin, corps] of [
      ['unites', { version: 1, code: 'UM-1' }],
      ['trains', { version: 1, trainId: 'T1' }],
      ['retirer', { version: 1, tout: true }],
      ['supprimer', { version: 1 }],
      ['ouvrir', { version: 1 }],
      ['expedier', { version: 1 }],
    ] as const)
      expect((await ecrire(s, 'expe', `/999999999/${chemin}`, corps)).statusCode, chemin).toBe(404)
  })

  it('CLAUDE.md §6 limites des entrées : code UM de 100 car. accepté (422 inconnu), 101 refusé (400) ; trainId 30 / 31 ; 500 / 501 unités à retirer', async () => {
    const s = await siteColis()
    const c = await ouvrir(s)
    const unites = `/${String(c.id)}/unites`
    expect(
      (await ecrire(s, 'expe', unites, { version: c.version, code: 'U'.repeat(100) })).statusCode,
    ).toBe(422)
    expect(
      (await ecrire(s, 'expe', unites, { version: c.version, code: 'U'.repeat(101) })).statusCode,
    ).toBe(400)
    const trains = `/${String(c.id)}/trains`
    expect(
      (await ecrire(s, 'expe', trains, { version: c.version, trainId: 'T'.repeat(31) })).statusCode,
    ).toBe(400)
    const retirer = `/${String(c.id)}/retirer`
    expect(
      (
        await ecrire(s, 'expe', retirer, {
          version: c.version,
          unites: Array.from({ length: 501 }, (_, i) => i + 1),
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await ecrire(s, 'expe', retirer, {
          version: c.version,
          unites: Array.from({ length: 500 }, (_, i) => i + 1),
        })
      ).statusCode,
    ).toBe(404) // 500 accepté par le schéma ; unités absentes du colis
    expect((await colisLu(c.id)).version).toBe(c.version)
  })

  it('volumétrie : une fin de journée sur plus de 1 000 colis « A expédier » aboutit (200), tous « Terminé », stock débité, aucune erreur de limite SQLite', async () => {
    const s = await siteColis()
    const N = 1100
    const ids: number[] = []
    const affiches: number[] = []
    for (let i = 0; i < N; i++) {
      const contNum = A(next())
      const theme = `Vol ${String(i)}`
      const u = await f.createUniteManutention(db, {
        atelierId: s.fixe.id,
        supportId: s.support.id,
        destinataireId: s.dest[0].id,
        qte: 3,
        statut: 'A_EXPEDIER',
        contNum,
        theme,
        semAnnee: SEM.annee,
        semNum: SEM.semaine,
      })
      const c = await db.colis.create({
        data: {
          plateformeId: s.plateforme.id,
          atelierId: s.fixe.id,
          destinataireId: s.dest[0].id,
          statut: 'A_EXPEDIER',
          poids: 6,
          createdById: s.users.expe.id,
        },
      })
      await db.uniteColis.create({ data: { uniteId: u.id, colisId: c.id, quantite: 3 } })
      ids.push(c.id)
      if (i % 100 === 0) affiches.push((await affiche(s, { contNum, theme }, 5)).id)
    }
    const r = await fin(s)
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200)
    const res = ResultatFinDeJourneeSchema.parse(r.json())
    expect(res.colis).toHaveLength(N)
    expect(res.unites).toBe(N)
    expect(
      await db.colis.count({ where: { plateformeId: s.plateforme.id, statut: 'TERMINE' } }),
    ).toBe(N)
    for (const id of affiches) expect(await stockDe(id)).toBe(2)
    const liste = ListeColisSchema.parse((await lire(s, 'expe', '?statut=TERMINE')).json())
    expect(liste.indicateurs.expedies).toBeGreaterThanOrEqual(N)
  }, 60_000)
})

describe('double soumission simultanée et site choisi (lecture « à coliser »)', () => {
  it('CLAUDE.md §6 double soumission SIMULTANÉE (même Idempotency-Key en parallèle) : un seul colis créé, une seule expédition', async () => {
    const s = await siteColis()
    const avant = await db.colis.count({ where: { plateformeId: s.plateforme.id } })
    const cle = idem()
    const corps = { atelierId: s.fixe.id, destinataireId: s.dest[0].id }
    const rs = await Promise.all([
      ecrire(s, 'expe', '', corps, cle),
      ecrire(s, 'expe', '', corps, cle),
    ])
    for (const r of rs) expect([200, 409], r.body).toContain(r.statusCode)
    expect(rs.some((r) => r.statusCode === 200)).toBe(true)
    expect(await db.colis.count({ where: { plateformeId: s.plateforme.id } })).toBe(avant + 1)

    const { u, colis } = await colisAvecUm(s, { qte: 2 })
    const cleE = idem()
    const es = await Promise.all([
      expedier(s, colis, 'expe', cleE),
      expedier(s, colis, 'expe', cleE),
    ])
    for (const r of es) expect([200, 409], r.body).toContain(r.statusCode)
    expect(es.some((r) => r.statusCode === 200)).toBe(true)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(u.id), nouveau: 'A_EXPEDIER' },
      }),
    ).toBe(1)
  })

  it('RG-COO-167 / Q-173 « à coliser » : le site choisi restreint les unités et les colis ouverts à ce site', async () => {
    const s1 = await siteColis()
    const s2 = await siteColis()
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['expe'],
      [{ plateformeId: s1.plateforme.id }, { plateformeId: s2.plateforme.id }],
    )
    const u1 = await um(s1)
    const u2 = await um(s2)
    const o1 = await ouvrir(s1)
    const lire2 = async (site?: number) =>
      (await get(ctx, `${U}/a-coliser`, devHeaders(user.identifiantExterne, site))).json<{
        groupes: { unites: { uniteId?: number }[] }[]
        colisOuverts: { id: number }[]
      }>()
    const tous = await lire2()
    expect(tous.groupes.flatMap((g) => g.unites.map((x) => x.uniteId))).toEqual(
      expect.arrayContaining([u1.id, u2.id]),
    )
    const site2 = await lire2(s2.plateforme.id)
    const ids = site2.groupes.flatMap((g) => g.unites.map((x) => x.uniteId))
    expect(ids).toContain(u2.id)
    expect(ids).not.toContain(u1.id)
    expect(site2.colisOuverts.map((c) => c.id)).not.toContain(o1.id)
  })
})

describe('anomalies corrigées par le fork de COO-P13', () => {
  // ANO-054 (corrigée : `sortiesStock` ignore les UM « Annulé ») ; fichier concerné apps/api/src/modules/coordination/colis.ts
  // (`sortiesStock`, appelée par `finDeJournee` pour toutes les lignes UM ↔ colis sans regarder le statut de l'UM).
  // Attendu (RG-X-087 : « une sortie de stock par unité EXPÉDIÉE » ; RG-COO-278 : l'UM annulée reste « Annulé », elle
  // n'est donc pas expédiée et le compteur `unites` ne la compte pas) : aucune sortie de stock pour une UM « Annulé »
  // restée dans un colis. Obtenu : sortie de stock de sa quantité (`sortiesStock` = 1, stock débité) alors que
  // `unites` = 0.
  it('ANO-054 RG-X-087 / 278 une UM « Annulé » restée dans un colis expédié ne génère aucune sortie de stock', async () => {
    const s = await siteColis()
    const { u, colis } = await colisAvecUm(s, { qte: 4 })
    await db.uniteManutention.update({ where: { id: u.id }, data: { statut: 'ANNULE' } }) // déblocage (RG-COO-278)
    const a = await affiche(s, u, 9)
    expect((await expedier(s, colis)).statusCode).toBe(200)
    const res = ResultatFinDeJourneeSchema.parse((await fin(s)).json())
    expect(res.unites).toBe(0)
    expect(res.sortiesStock).toBe(0)
    expect(await stockDe(a.id)).toBe(9)
  })
})
