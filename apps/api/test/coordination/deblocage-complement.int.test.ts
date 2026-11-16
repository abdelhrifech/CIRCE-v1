// COO-P08 — tests COMPLÉMENTAIRES du déblocage des préparations / « Rendre la main » (deblocage.int.test.ts n'est
// pas dupliqué) et de la reprise groupée de la version Broadcast (POST /api/coordination/themes/broadcast/
// reprendre-dossier). Source de l'attendu (les règles, pas le code) : docs/COORDINATION_REGLES_METIER.md
// RG-COO-068, 140 à 152, 277 à 279, RG-X-057, RG-X-059 ; hypothèses Q-191, Q-217, Q-218 ; CLAUDE.md §6 (400 / 409).
// Les écarts constatés sont marqués `it.fails` avec leur n° ANO (non reportés dans RAPPORT_TESTS.md).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  ResultatRechercheDeblocageSchema,
  SuiviDeblocageQuerySchema,
  lundiSemaineIso,
  semaineIsoDe,
  type LotIntegration,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import { dbIdentityLoader, type Identity } from '../../src/core/identity.ts'
import type { BroadcastPort, MessageBroadcast } from '../../src/core/ports/broadcast.ts'
import { listerDeblocages } from '../../src/modules/coordination/deblocage.ts'
import { lancerPassage } from '../../src/modules/coordination/integration-broadcast.ts'
import type { StatutProduction } from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

// ───────────────────────────── outils ─────────────────────────────

type Headers = Record<string, string>
const S = semaineIsoDe(new Date())
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const SEM = plus(S, 2)
const ROLES: Role[] = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']
const URL = '/api/coordination/deblocage/groupes'
const URL_SUIVI = '/api/coordination/deblocage/suivi'
const URL_REPRISE = '/api/coordination/themes/broadcast/reprendre-dossier'

const restaurer: (() => Promise<unknown>)[] = []
afterEach(async () => {
  while (restaurer.length > 0) await restaurer.pop()?.()
})

/** Site Broadcast : atelier fixe (inclusion « tout »), atelier déroulant, type, surface, un utilisateur par rôle. */
async function site(opts: { mail?: string | null; regle?: boolean } = {}) {
  const idSiteCcf = 50_000 + next()
  const plateforme = await f.createPlateforme(db, {
    idSiteCcf,
    mail: opts.mail === undefined ? 'preprod@exemple.test' : opts.mail,
  })
  const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
  const scroll = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' })
  const type = await f.createTypePreparation(db)
  const surface = await f.createSurface(db)
  const support = await f.createSupport(db)
  if (opts.regle !== false)
    await db.atelierDroitPrepa.create({
      data: { atelierId: atelier.id, typePreparationId: null, surfaceId: null, exclusion: false },
    })
  const users = {} as Record<Role, { id: number; headers: Headers; ext: string }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, headers: devHeaders(u.identifiantExterne), ext: u.identifiantExterne }
  }
  return {
    plateforme,
    atelier,
    scroll,
    type,
    surface,
    support,
    idSiteCcf,
    users,
    contNum: 940_000 + next(),
    chapeau: 45_000 + next(),
  }
}
type Site = Awaited<ReturnType<typeof site>>

async function ligneEdr(s: Site, o: { chapeau?: number; surface?: string } = {}) {
  await f.createPrepaBroadcast(db, {
    idPreparationChapeau: o.chapeau ?? s.chapeau,
    idDossierDeVenteChapeau: s.contNum,
    idSiteCcf: s.idSiteCcf,
    idSurface: s.surface.id,
    surface: o.surface ?? '2 m²',
    idTypePreparation: s.type.id,
    annonceur: 'ANNONCEUR C08',
    semAnnee: SEM.annee,
    semNum: SEM.semaine,
    quantite: 30,
  })
}

/** Groupe UM : ligne de l'état des réservations + répartitions Circé du groupe (+ UM éventuelle). */
async function groupeUm(
  s: Site,
  opts: { um?: StatutProduction; statutRep?: StatutProduction; chapeau?: number } = {},
) {
  const idGroupe = 85_000 + next()
  await ligneEdr(s, { chapeau: opts.chapeau ?? s.chapeau })
  const unite = opts.um
    ? await f.createUniteManutention(db, {
        atelierId: s.atelier.id,
        contNum: s.contNum,
        statut: opts.um,
      })
    : null
  const rep = await f.createRepartition(db, {
    statut: opts.statutRep ?? 'A_TRAITER',
    atelierId: s.atelier.id,
    contNum: s.contNum,
    semAnnee: SEM.annee,
    semNum: SEM.semaine,
    typePreparationId: s.type.id,
    idGroupePreparation: idGroupe,
    annonceur: 'ANNONCEUR C08',
    qte: 15,
    uniteId: unite?.id ?? null,
  })
  return {
    idGroupe,
    rep,
    unite,
    cle: `UM:${String(idGroupe)}`,
  }
}

/** Groupe TRAIN : ligne de l'état des réservations sans répartition ; correspondance surface → support. */
async function groupeTrain(s: Site) {
  await ligneEdr(s, { surface: '8 m²' })
  await db.correspondanceSupport.create({
    data: { idSurface: s.surface.id, idFormat: 6_000 + next(), supportId: s.support.id },
  })
  return `TRAIN:${String(s.chapeau)}:${String(s.contNum)}:${String(SEM.annee)}:${String(SEM.semaine)}:${String(s.surface.id)}:${String(s.type.id)}:${String(s.idSiteCcf)}`
}
const face = (
  s: Site,
  statut: StatutProduction,
  o: { atelierId?: number; semaine?: SemaineIso; supportId?: number } = {},
) =>
  f.createFaceTrain(db, {
    statut,
    contNum: s.contNum,
    contAnbas: (o.semaine ?? SEM).annee,
    contSembas: (o.semaine ?? SEM).semaine,
    supportId: o.supportId ?? s.support.id,
    atelierId: o.atelierId ?? s.scroll.id,
  })

async function chercher(h: Headers, qs: string) {
  const r = await get(ctx, `${URL}?${qs}`, h)
  expect(r.statusCode, r.body).toBe(200)
  return ResultatRechercheDeblocageSchema.parse(r.json())
}
const debloquer = (h: Headers, cle: string, cleIdem: Headers = idem(), motif?: string) =>
  ctx.app.inject({
    method: 'POST',
    url: URL,
    headers: { ...h, ...cleIdem },
    payload: motif === undefined ? { cle } : { cle, motif },
  })

let numDeclencheur = 0
async function avecEchec<T>(corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_deb_${String(++numDeclencheur)}_${String(next())}`
  await db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} ${corps} BEGIN SELECT RAISE(ABORT, 'echec simule'); END`,
  )
  try {
    return await fn()
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}

async function identite(ext: string): Promise<Identity> {
  const i = await dbIdentityLoader(db)(ext)
  if (!i) throw new Error('identité')
  return { ...i, siteId: null }
}

// ───────────────── RG-COO-143 / 277 limites des statuts d'UM ─────────────────

describe('RG-COO-143 / RG-COO-277 UM : limite 5 / 6 (complément)', () => {
  it.each<StatutProduction>(['A_TRAITER', 'EN_COURS', 'INSTRUCTION_OK', 'ERREUR', 'A_IMPRIMER'])(
    'RG-COO-277 UM au statut %s (< 6) : non bloquante, UM et répartition annulées',
    async (statut) => {
      const s = await site()
      const g = await groupeUm(s, { um: statut })
      const r = await debloquer(s.users.coord.headers, g.cle)
      expect(r.statusCode, r.body).toBe(200)
      expect((await db.repartition.findUniqueOrThrow({ where: { id: g.rep.id } })).statut).toBe(
        'ANNULE',
      )
      expect(
        (await db.uniteManutention.findUniqueOrThrow({ where: { id: g.unite?.id ?? 0 } })).statut,
      ).toBe('ANNULE')
    },
  )

  it.each<StatutProduction>(['PREPARE', 'A_EXPEDIER', 'TERMINE', 'EXPORT_PREPA', 'AU_ROULAGE'])(
    'RG-COO-143 UM au statut %s (≥ 6) : 422 « Le groupe de preparation n’est pas déblocable ! », rien n’est écrit',
    async (statut) => {
      const s = await site()
      const g = await groupeUm(s, { um: statut })
      const r = await debloquer(s.users.coord.headers, g.cle)
      expect(r.statusCode).toBe(422)
      expect(erreur(r)).toMatchObject({
        regle: 'RG-COO-143',
        message: "Le groupe de preparation n'est pas déblocable !",
      })
      expect(await db.repartition.findUniqueOrThrow({ where: { id: g.rep.id } })).toMatchObject({
        statut: 'A_TRAITER',
        version: g.rep.version,
      })
      expect(await db.deblocagePreparation.count({ where: { cle: g.cle } })).toBe(0)
      expect(
        await db.envoiBroadcast.count({ where: { type: 'DEBLOQUER_GROUPE', cle: g.cle } }),
      ).toBe(0)
    },
  )

  it('RG-COO-277 le statut de la répartition elle-même n’est pas testé : répartition « Terminé » sans UM ⇒ débloquée', async () => {
    const s = await site()
    const g = await groupeUm(s, { statutRep: 'TERMINE' })
    expect((await debloquer(s.users.coord.headers, g.cle)).statusCode).toBe(200)
    expect((await db.repartition.findUniqueOrThrow({ where: { id: g.rep.id } })).statut).toBe(
      'ANNULE',
    )
  })
})

// ───────────────── RG-COO-144 limites des statuts de faces ─────────────────

describe('RG-COO-144 groupe TRAIN : faces lancées (complément)', () => {
  it.each<StatutProduction>(['A_TRAITER', 'EN_COURS', 'ANNULE'])(
    'RG-COO-144 face au statut %s (0, 1, 4) : déblocable',
    async (statut) => {
      const s = await site()
      const cle = await groupeTrain(s)
      await face(s, statut)
      expect((await debloquer(s.users.coord.headers, cle)).statusCode).toBe(200)
    },
  )

  it.each<StatutProduction>([
    'INSTRUCTION_OK',
    'ERREUR',
    'A_IMPRIMER',
    'PREPARE',
    'A_EXPEDIER',
    'TERMINE',
    'EXPORT_PREPA',
    'AU_ROULAGE',
  ])('RG-COO-144 face au statut %s (≥ 2) : 422, aucune trace', async (statut) => {
    const s = await site()
    const cle = await groupeTrain(s)
    await face(s, 'A_TRAITER')
    await face(s, statut)
    const r = await debloquer(s.users.coord.headers, cle)
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-144')
    expect(await db.deblocagePreparation.count({ where: { cle } })).toBe(0)
  })

  it('RG-COO-144 rapprochement : une face lancée d’une autre semaine, d’un atelier non déroulant ou d’un autre support ne bloque pas', async () => {
    const s = await site()
    const cle = await groupeTrain(s)
    const autreSupport = await f.createSupport(db)
    await face(s, 'TERMINE', { semaine: plus(SEM, 1) })
    await face(s, 'TERMINE', { atelierId: s.atelier.id })
    await face(s, 'TERMINE', { supportId: autreSupport.id })
    expect((await debloquer(s.users.coord.headers, cle)).statusCode).toBe(200)
  })

  it('RG-COO-144 face lancée d’un atelier déroulant d’un AUTRE site : ne bloque pas (atelier scroll du site du groupe)', async () => {
    const s = await site()
    const cle = await groupeTrain(s)
    const ailleurs = await f.createPlateforme(db, { idSiteCcf: 51_000 + next() })
    const scrollAilleurs = await f.createAtelier(db, { plateformeId: ailleurs.id, type: 'SCROLL' })
    await face(s, 'TERMINE', { atelierId: scrollAilleurs.id })
    expect((await debloquer(s.users.coord.headers, cle)).statusCode).toBe(200)
  })
})

// ───────────────── RG-COO-140 / 141 recherche ─────────────────

describe('RG-COO-140 / RG-COO-141 recherche (complément)', () => {
  it('RG-COO-140 n° de préparation ET n° de dossier qui ne vont pas ensemble ⇒ liste vide', async () => {
    const s = await site()
    await groupeUm(s)
    const r = await chercher(
      s.users.coord.headers,
      `preparation=${String(s.chapeau + 1)}&dossier=${String(s.contNum)}`,
    )
    expect(r.groupes).toEqual([])
    expect(r.message).toBe('Aucune préparation débloquable pour ces critères.')
  })

  it('RG-COO-140 recherche par n° de préparation : seuls les groupes de cette préparation chapeau', async () => {
    const s = await site()
    const g1 = await groupeUm(s)
    const autre = s.chapeau + 7
    const g2 = await groupeUm(s, { chapeau: autre })
    // Deux groupes Broadcast du même dossier / semaine : le rapprochement Q-191 (1) rattache g2 à la 2e prépa.
    await db.prepaBroadcast.updateMany({
      where: { idPreparationChapeau: autre },
      data: { idTypePreparation: (await f.createTypePreparation(db)).id },
    })
    await db.repartition.update({
      where: { id: g2.rep.id },
      data: {
        typePreparationId: (
          await db.prepaBroadcast.findFirstOrThrow({ where: { idPreparationChapeau: autre } })
        ).idTypePreparation,
      },
    })
    const r = await chercher(s.users.coord.headers, `preparation=${String(s.chapeau)}`)
    expect(r.groupes.map((g) => g.cle)).toEqual([g1.cle])
  })

  it.each([
    ['0', 'preparation=0'],
    ['négatif', 'dossier=-3'],
    ['texte', 'dossier=abc'],
  ])('RG-COO-140 critère invalide (%s) ⇒ 400', async (_cas, qs) => {
    const s = await site()
    expect((await get(ctx, `${URL}?${qs}`, s.users.coord.headers)).statusCode).toBe(400)
  })

  it('RG-COO-141 inclusion limitée à une surface : groupe d’une autre surface invisible et non débloquable (403)', async () => {
    const s = await site({ regle: false })
    const autreSurface = await f.createSurface(db)
    await db.atelierDroitPrepa.create({
      data: {
        atelierId: s.atelier.id,
        typePreparationId: null,
        surfaceId: autreSurface.id,
        exclusion: false,
      },
    })
    const g = await groupeUm(s)
    expect((await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes).toEqual(
      [],
    )
    const r = await debloquer(s.users.coord.headers, g.cle)
    expect(r.statusCode).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-141')
  })

  it('RG-COO-141 exclusion par surface l’emporte sur une inclusion « tout » du même atelier', async () => {
    const s = await site()
    await db.atelierDroitPrepa.create({
      data: {
        atelierId: s.atelier.id,
        typePreparationId: null,
        surfaceId: s.surface.id,
        exclusion: true,
      },
    })
    await groupeUm(s)
    expect((await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes).toEqual(
      [],
    )
  })

  it('RG-COO-141 / 167 utilisateur limité à l’atelier déroulant (sans règle) : rien de visible, trace « aucune règle »', async () => {
    const s = await site()
    await groupeUm(s)
    const u = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: s.plateforme.id, atelierId: s.scroll.id }],
    )
    const r = await chercher(devHeaders(u.identifiantExterne), `dossier=${String(s.contNum)}`)
    expect(r.groupes).toEqual([])
    expect(r.avertissements).toContain(
      `Déblocage : aucune règle pour l'atelier ${String(s.scroll.id)}.`,
    )
  })
})

// ───────────────── RG-COO-145 / 146 atomicité, idempotence, file Broadcast ─────────────────

describe('RG-COO-145 / RG-COO-146 / RG-COO-278 atomicité, idempotence, file Broadcast (complément)', () => {
  it('RG-COO-145 atomicité : échec à la mise en file Broadcast ⇒ répartitions, UM, trace et historique annulés ; clé non gardée', async () => {
    const s = await site()
    const g = await groupeUm(s, { um: 'EN_COURS' })
    const cle = idem()
    const r = await avecEchec(
      `BEFORE INSERT ON envoi_broadcast WHEN NEW.type = 'DEBLOQUER_GROUPE'`,
      () => debloquer(s.users.coord.headers, g.cle, cle),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect((await db.repartition.findUniqueOrThrow({ where: { id: g.rep.id } })).statut).toBe(
      'A_TRAITER',
    )
    expect(
      (await db.uniteManutention.findUniqueOrThrow({ where: { id: g.unite?.id ?? 0 } })).statut,
    ).toBe('EN_COURS')
    expect(await db.deblocagePreparation.count({ where: { cle: g.cle } })).toBe(0)
    expect(
      await db.journalAudit.count({
        where: { action: 'DEBLOQUER_PREPARATION', entiteId: String(s.contNum) },
      }),
    ).toBe(0)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'REPARTITION', entiteId: String(g.rep.id) },
      }),
    ).toBe(0)
    expect(
      await db.cleIdempotence.count({
        where: { utilisateurId: s.users.coord.id, cle: cle['idempotency-key'] },
      }),
    ).toBe(0)
    const rejeu = await debloquer(s.users.coord.headers, g.cle, cle)
    expect(rejeu.statusCode, rejeu.body).toBe(200)
  })

  it('RG-COO-278 atomicité : échec à l’annulation de l’UM ⇒ la répartition déjà passée « Annulé » est restaurée', async () => {
    const s = await site()
    const g = await groupeUm(s, { um: 'A_IMPRIMER' })
    const r = await avecEchec(`BEFORE UPDATE ON tf_UM WHEN NEW.statut = 'ANNULE'`, () =>
      debloquer(s.users.coord.headers, g.cle),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.repartition.findUniqueOrThrow({ where: { id: g.rep.id } })).toMatchObject({
      statut: 'A_TRAITER',
      version: g.rep.version,
    })
    expect(await db.deblocagePreparation.count({ where: { cle: g.cle } })).toBe(0)
  })

  it('RG-COO-145 Idempotency-Key rejouée avec un autre corps ⇒ 409 COO_IDEMPOTENCE_CONFLIT, un seul déblocage', async () => {
    const s = await site()
    const g = await groupeUm(s)
    const cle = idem()
    expect((await debloquer(s.users.coord.headers, g.cle, cle)).statusCode).toBe(200)
    const r = await debloquer(s.users.coord.headers, g.cle, cle, 'autre motif')
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect(await db.deblocagePreparation.count({ where: { cle: g.cle } })).toBe(1)
  })

  it('RG-COO-145 transition interdite : débloquer un groupe déjà débloqué avec une autre clé ⇒ 409 TRANSITION_INTERDITE, aucune 2e trace ni 2e demande', async () => {
    const s = await site()
    const g = await groupeUm(s)
    expect((await debloquer(s.users.coord.headers, g.cle)).statusCode).toBe(200)
    const r = await debloquer(s.users.admin.headers, g.cle)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-145' })
    expect(await db.envoiBroadcast.count({ where: { type: 'DEBLOQUER_GROUPE', cle: g.cle } })).toBe(
      1,
    )
  })

  it('RG-COO-145 (Q-191 (3)) la demande à Broadcast est envoyée au passage d’intégration suivant, une seule fois', async () => {
    const s = await site()
    const g = await groupeUm(s)
    expect((await debloquer(s.users.coord.headers, g.cle)).statusCode).toBe(200)
    const envoyes: MessageBroadcast[] = []
    const port: BroadcastPort = {
      nom: 'memoire',
      configure: true,
      lireLot: () => Promise.reject(new Error('non utilisé')),
      envoyer: (m) => {
        envoyes.push(m)
        return Promise.resolve()
      },
    }
    const lot: LotIntegration = { idInterface: 1, lectureComplete: false, lueLe: new Date() }
    await lancerPassage({ db, broadcast: port }, { declencheur: 'LOT', identity: null, lot })
    await lancerPassage({ db, broadcast: port }, { declencheur: 'LOT', identity: null, lot })
    const demandes = envoyes.filter((m) => m.type === 'DEBLOQUER_GROUPE' && m.cle === g.cle)
    expect(demandes).toHaveLength(1)
    expect(demandes[0]?.donnees).toMatchObject({
      contNum: s.contNum,
      idGroupePreparation: g.idGroupe,
    })
  })

  it('RG-COO-147 adresses de la plateforme nettoyées (espaces, entrées vides) ; RG-COO-146 trace « par »', async () => {
    const s = await site({ mail: ' a@exemple.test , , b@exemple.test ,' })
    const g = await groupeUm(s)
    expect((await debloquer(s.users.admin.headers, g.cle)).statusCode).toBe(200)
    expect(await db.deblocagePreparation.findFirstOrThrow({ where: { cle: g.cle } })).toMatchObject(
      {
        mailStatut: 'NON_ENVOYE',
        mailDestinataires: 'a@exemple.test, b@exemple.test',
        parId: s.users.admin.id,
      },
    )
  })
})

// ───────────────── RG-COO-149 suivi ─────────────────

describe('RG-COO-149 « Préparations débloquées » (complément)', () => {
  it('RG-COO-149 limite : du = au = aujourd’hui ⇒ le déblocage du jour est listé (bornes incluses)', async () => {
    const s = await site()
    const g = await groupeUm(s)
    await debloquer(s.users.coord.headers, g.cle)
    const j = new Date().toISOString().slice(0, 10)
    const r = await get(ctx, `${URL_SUIVI}?du=${j}&au=${j}`, s.users.coord.headers)
    expect(r.statusCode, r.body).toBe(200)
    expect(
      r.json<{ deblocages: { contNum: number }[] }>().deblocages.map((d) => d.contNum),
    ).toContain(s.contNum)
  })

  it('RG-COO-149 rejet : date de début seule, dans le futur (fin par défaut = aujourd’hui) ⇒ 422', async () => {
    const s = await site()
    const demain = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
    const r = await get(ctx, `${URL_SUIVI}?du=${demain}`, s.users.coord.headers)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({
      regle: 'RG-COO-149',
      message: 'La date de fin doit être supérieur à la date de début !',
    })
  })

  // ANO-038 : RG-COO-149 « la période par défaut est le dernier mois » (Q-191 (8) : « du même jour du mois
  // précédent à aujourd'hui »). Un 31 mars, Date.UTC(2026, 1, 31) déborde au 3 mars : la période par défaut ne
  // couvre que 4 semaines et exclut les déblocages du 1er au 2 mars (deblocage.ts:680-690).
  it('RG-COO-149 période par défaut un 31 mars : elle couvre le dernier mois (début au plus tard le 1er mars) (ANO-038)', async () => {
    const s = await site()
    const r = await listerDeblocages(
      db,
      await identite(s.users.coord.ext),
      SuiviDeblocageQuerySchema.parse({}),
      new Date('2026-03-31T10:00:00Z'),
    )
    expect(r.au).toBe('2026-03-31')
    expect(r.du <= '2026-03-01').toBe(true)
  })

  // ANO-039 : CLAUDE.md §6 (400 = validation) et RG-COO-149 (période saisie) : une date impossible (30 février)
  // passe la validation (format seul, SuiviDeblocageQuerySchema) et est acceptée (200) puis réinterprétée en
  // silence par new Date (deblocage.ts:696-700) : la période réellement lue n'est pas celle saisie.
  it('RG-COO-149 entrée invalide : date impossible (2026-02-30) ⇒ 400, pas acceptée en silence (ANO-039)', async () => {
    const s = await site()
    const r = await get(ctx, `${URL_SUIVI}?du=2026-02-30&au=2026-03-05`, s.users.coord.headers)
    expect(r.statusCode).toBe(400)
  })
})

// ───────────────── Reprise groupée de la version Broadcast (RG-COO-068 / RG-X-057) ─────────────────

describe('RG-COO-068 / RG-X-057 « Reprendre la version Broadcast » du dossier (reprise groupée)', () => {
  async function lignesModifiees(s: Site, n: number) {
    const lignes = []
    for (let k = 0; k < n; k++) {
      const l = await f.createReceptionAttendue(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: s.contNum,
        semAnnee: plus(S, 1).annee,
        semNum: plus(S, 1).semaine,
        theme: `Nouveau ${String(k)}`,
      })
      const a = await f.createAffiche(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: s.contNum,
        theme: `Ancien ${String(k)}`,
        themeModifie: true,
      })
      await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, quantite: 2 })
      lignes.push({ l, a })
    }
    return lignes
  }
  const reprise = (h: Headers, body: unknown, cle: Headers = idem()) =>
    ctx.app.inject({
      method: 'POST',
      url: URL_REPRISE,
      headers: { ...h, ...cle },
      payload: body as object,
    })
  const corps = (s: Site, ls: { l: { id: number; version: number } }[]) => ({
    contNum: s.contNum,
    lignes: ls.map((x) => ({ ligneAttendueId: x.l.id, version: x.l.version })),
  })

  it('RG-COO-068 deux lignes modifiées : reprises dans la même opération (thèmes alignés, feuilles à refaire, historique par ligne)', async () => {
    const s = await site()
    const ls = await lignesModifiees(s, 2)
    const r = await reprise(s.users.coord.headers, corps(s, ls))
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ affiches: number }>().affiches).toBe(2)
    for (const [k, x] of ls.entries())
      expect(await db.affiche.findUniqueOrThrow({ where: { id: x.a.id } })).toMatchObject({
        theme: `Nouveau ${String(k)}`,
        feuilleARefaire: true,
      })
    expect(
      await db.journalAudit.count({
        where: { action: 'REPRISE_THEME_BROADCAST', entiteId: String(s.contNum) },
      }),
    ).toBe(2)
  })

  it('RG-X-057 atomicité : la 2e ligne a une version périmée ⇒ 409, la 1re n’est pas reprise non plus', async () => {
    const s = await site()
    const ls = await lignesModifiees(s, 2)
    const body = corps(s, ls)
    const seconde = body.lignes[1]
    if (seconde) seconde.version -= 1
    const r = await reprise(s.users.coord.headers, body)
    expect(r.statusCode).toBe(409)
    for (const [k, x] of ls.entries())
      expect(await db.affiche.findUniqueOrThrow({ where: { id: x.a.id } })).toMatchObject({
        theme: `Ancien ${String(k)}`,
        version: x.a.version,
      })
  })

  it('RG-X-057 atomicité : une ligne sans rien à reprendre ⇒ 409, aucune autre reprise', async () => {
    const s = await site()
    const ls = await lignesModifiees(s, 1)
    const deja = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: plus(S, 1).annee,
      semNum: plus(S, 1).semaine,
    })
    const r = await reprise(s.users.coord.headers, {
      contNum: s.contNum,
      lignes: [
        { ligneAttendueId: ls[0]?.l.id ?? 0, version: ls[0]?.l.version ?? 0 },
        { ligneAttendueId: deja.id, version: deja.version },
      ],
    })
    expect(r.statusCode).toBe(409)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: ls[0]?.a.id ?? 0 } })).theme).toBe(
      'Ancien 0',
    )
  })

  it('RG-COO-068 rejets d’entrée : ligne d’un autre dossier ou citée deux fois ⇒ 400 ; liste vide ⇒ 400 ; ligne inconnue ⇒ 404', async () => {
    const s = await site()
    const ls = await lignesModifiees(s, 1)
    const x = { ligneAttendueId: ls[0]?.l.id ?? 0, version: ls[0]?.l.version ?? 0 }
    expect(
      (await reprise(s.users.coord.headers, { contNum: s.contNum + 1, lignes: [x] })).statusCode,
    ).toBe(400)
    expect(
      (await reprise(s.users.coord.headers, { contNum: s.contNum, lignes: [x, x] })).statusCode,
    ).toBe(400)
    expect(
      (await reprise(s.users.coord.headers, { contNum: s.contNum, lignes: [] })).statusCode,
    ).toBe(400)
    expect(
      (
        await reprise(s.users.coord.headers, {
          contNum: s.contNum,
          lignes: [{ ligneAttendueId: 999_999_999, version: 1 }],
        })
      ).statusCode,
    ).toBe(404)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: ls[0]?.a.id ?? 0 } })).theme).toBe(
      'Ancien 0',
    )
  })

  it('RG-COO-068 idempotence : même clé ⇒ même réponse, une seule reprise', async () => {
    const s = await site()
    const ls = await lignesModifiees(s, 2)
    const cle = idem()
    const r1 = await reprise(s.users.coord.headers, corps(s, ls), cle)
    const r2 = await reprise(s.users.coord.headers, corps(s, ls), cle)
    expect(r1.statusCode, r1.body).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(
      await db.journalAudit.count({
        where: { action: 'REPRISE_THEME_BROADCAST', entiteId: String(s.contNum) },
      }),
    ).toBe(2)
  })

  it.each<[Role, number]>([
    ['coord', 200],
    ['admin', 200],
    ['cheq', 403],
    ['recep', 403],
    ['expe', 403],
    ['com', 403],
  ])('RG-COO-068 / 009 reprise groupée par le rôle %s ⇒ %i', async (role, statut) => {
    const s = await site()
    const ls = await lignesModifiees(s, 1)
    const r = await reprise(s.users[role].headers, corps(s, ls))
    expect(r.statusCode).toBe(statut)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: ls[0]?.a.id ?? 0 } })).theme).toBe(
      statut === 200 ? 'Nouveau 0' : 'Ancien 0',
    )
  })

  it('RG-COO-167 rejet : coordinateur d’un autre site ⇒ 403, rien n’est repris', async () => {
    const s = await site()
    const autre = await site()
    const ls = await lignesModifiees(s, 1)
    const r = await reprise(autre.users.coord.headers, corps(s, ls))
    expect(r.statusCode).toBe(403)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: ls[0]?.a.id ?? 0 } })).theme).toBe(
      'Ancien 0',
    )
  })
})
