// COO-P08 — Déblocage des préparations et « Rendre la main à la Pré-Prod » : recherche (RG-COO-140 à 142),
// gardes serveur (RG-COO-143, 144, 277), effet atomique (RG-COO-145, 146, 278), mail (RG-COO-147, Q-375),
// prépa renvoyée intégrée (RG-COO-148), suivi (RG-COO-149), legacy non repris (RG-COO-150, 279), rendre la main
// (RG-COO-151, RG-X-059), droits (RG-COO-152). HYPOTHÈSES Q-217, Q-218, Q-382, Q-191.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  DebloquerGroupeResultatSchema,
  ListeAlertesSchema,
  ListeDeblocagesSchema,
  MOTIF_RENDRE_MAIN_DEFAUT,
  ResultatRechercheDeblocageSchema,
  lundiSemaineIso,
  semaineIsoDe,
  type GroupePreparation,
  type LotIntegration,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import type { BroadcastPort, MessageBroadcast } from '../../src/core/ports/broadcast.ts'
import {
  envoyerEnAttente,
  lancerPassage,
} from '../../src/modules/coordination/integration-broadcast.ts'
import { MailBoiteEnvoi } from '../../src/core/ports/mail.ts'
import { traiterFileMails } from '../../src/modules/mails/file.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception, erreur, get, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const S = semaineIsoDe(new Date())
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const SEM = plus(S, 2)
const ROLES: Role[] = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']
const URL = '/api/coordination/deblocage/groupes'

const restaurer: (() => Promise<unknown>)[] = []
async function parametre(cle: string, valeur: string) {
  const existant = await db.parametre.findFirst({ where: { cle, plateformeId: null } })
  if (existant) {
    await db.parametre.update({ where: { id: existant.id }, data: { valeur } })
    restaurer.push(() =>
      db.parametre.update({ where: { id: existant.id }, data: { valeur: existant.valeur } }),
    )
  } else {
    const p = await db.parametre.create({ data: { cle, valeur } })
    restaurer.push(() => db.parametre.delete({ where: { id: p.id } }))
  }
}
afterEach(async () => {
  while (restaurer.length > 0) await restaurer.pop()?.()
})

/** Site Broadcast (site CCF unique) : atelier fixe (inclusion « tout »), atelier déroulant, type, surface. */
async function site(opts: { mail?: string | null; regle?: boolean } = {}) {
  const idSiteCcf = 30_000 + next()
  const plateforme = await f.createPlateforme(db, {
    idSiteCcf,
    mail: opts.mail === undefined ? 'preprod@exemple.test, chef@exemple.test' : opts.mail,
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
  const users = {} as Record<Role, { id: number; headers: Record<string, string> }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, headers: devHeaders(u.identifiantExterne) }
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
    contNum: 900_000 + next(),
    chapeau: 40_000 + next(),
  }
}
type Site = Awaited<ReturnType<typeof site>>

/** Groupe UM : ligne de l'état des réservations + répartitions Circé du groupe (+ UM éventuelles). */
async function groupeUm(
  s: Site,
  opts: { statuts?: ('A_TRAITER' | 'EN_COURS' | 'A_IMPRIMER' | 'ERREUR')[]; um?: string } = {},
) {
  const idGroupe = 80_000 + next()
  await f.createPrepaBroadcast(db, {
    idPreparationChapeau: s.chapeau,
    idDossierDeVenteChapeau: s.contNum,
    idSiteCcf: s.idSiteCcf,
    idSurface: s.surface.id,
    surface: '2 m²',
    idTypePreparation: s.type.id,
    annonceur: 'ANNONCEUR DEBLOCAGE',
    semAnnee: SEM.annee,
    semNum: SEM.semaine,
    quantite: 30,
  })
  const unite = opts.um
    ? await f.createUniteManutention(db, {
        atelierId: s.atelier.id,
        contNum: s.contNum,
        statut: opts.um as 'EN_COURS',
      })
    : null
  const reps = []
  for (const st of opts.statuts ?? ['A_TRAITER', 'EN_COURS']) {
    reps.push(
      await f.createRepartition(db, {
        statut: st,
        atelierId: s.atelier.id,
        contNum: s.contNum,
        semAnnee: SEM.annee,
        semNum: SEM.semaine,
        typePreparationId: s.type.id,
        idGroupePreparation: idGroupe,
        annonceur: 'ANNONCEUR DEBLOCAGE',
        qte: 15,
        uniteId: unite?.id ?? null,
      }),
    )
  }
  return {
    idGroupe,
    reps,
    unite,
    cle: `UM:${String(idGroupe)}`,
  }
}

/** Groupe TRAIN : ligne de l'état des réservations sans répartition ; faces sur l'atelier déroulant. */
async function groupeTrain(s: Site, opts: { correspondance?: boolean; faces?: string[] } = {}) {
  await f.createPrepaBroadcast(db, {
    idPreparationChapeau: s.chapeau,
    idDossierDeVenteChapeau: s.contNum,
    idSiteCcf: s.idSiteCcf,
    idSurface: s.surface.id,
    surface: '8 m²',
    idTypePreparation: s.type.id,
    annonceur: 'ANNONCEUR TRAIN',
    semAnnee: SEM.annee,
    semNum: SEM.semaine,
    quantite: 12,
  })
  if (opts.correspondance !== false)
    await db.correspondanceSupport.create({
      data: { idSurface: s.surface.id, idFormat: 5_000 + next(), supportId: s.support.id },
    })
  for (const st of opts.faces ?? [])
    await f.createFaceTrain(db, {
      statut: st as 'A_TRAITER',
      contNum: s.contNum,
      contAnbas: SEM.annee,
      contSembas: SEM.semaine,
      supportId: s.support.id,
      atelierId: s.scroll.id,
    })
  return `TRAIN:${String(s.chapeau)}:${String(s.contNum)}:${String(SEM.annee)}:${String(SEM.semaine)}:${String(s.surface.id)}:${String(s.type.id)}:${String(s.idSiteCcf)}`
}

async function chercher(h: Record<string, string>, qs: string) {
  const r = await get(ctx, `${URL}?${qs}`, h)
  expect(r.statusCode, r.body).toBe(200)
  return ResultatRechercheDeblocageSchema.parse(r.json())
}
const debloquer = (h: Record<string, string>, cle: string, motif?: string) =>
  post(ctx, URL, h, motif === undefined ? { cle } : { cle, motif })

describe('RG-COO-140 / 141 / 142 recherche des groupes débloquables', () => {
  it('RG-COO-140 sans n° de préparation ni de dossier : grille vide et message', async () => {
    const s = await site()
    await groupeUm(s)
    const r = await chercher(s.users.coord.headers, '')
    expect(r).toEqual({
      groupes: [],
      message: 'Saisissez un n° de préparation ou de dossier.',
      avertissements: [],
    })
  })

  it('RG-COO-140 recherche par n° de dossier ou par n° de préparation : le groupe UM est trouvé', async () => {
    const s = await site()
    const g = await groupeUm(s)
    for (const qs of [`dossier=${String(s.contNum)}`, `preparation=${String(s.chapeau)}`]) {
      const r = await chercher(s.users.coord.headers, qs)
      expect(r.groupes, qs).toEqual([
        expect.objectContaining({
          cle: g.cle,
          type: 'UM',
          etat: 'INTEGRE',
          idPreparationChapeau: s.chapeau,
          idGroupePreparation: g.idGroupe,
          contNum: s.contNum,
          annonceur: 'ANNONCEUR DEBLOCAGE',
          site: s.plateforme.nom,
          typePreparation: s.type.libelle,
          quantite: 30,
          statutPrepa: 'NONE',
          deblocable: true,
          repartitionsActives: 2,
        }),
      ])
    }
  })

  it('RG-COO-140 rejet : critère invalide (400) ; aucun groupe pour un autre n° (liste vide)', async () => {
    const s = await site()
    await groupeUm(s)
    expect((await get(ctx, `${URL}?dossier=abc`, s.users.coord.headers)).statusCode).toBe(400)
    const r = await chercher(s.users.coord.headers, `dossier=${String(s.contNum + 1)}`)
    expect(r.groupes).toEqual([])
    expect(r.message).toBe('Aucune préparation débloquable pour ces critères.')
  })

  it('RG-COO-141 règle d’exclusion de l’atelier : groupe masqué ; inclusion limitée au type : visible', async () => {
    const s = await site({ regle: false })
    await groupeUm(s)
    await db.atelierDroitPrepa.create({
      data: {
        atelierId: s.atelier.id,
        typePreparationId: s.type.id,
        surfaceId: null,
        exclusion: false,
      },
    })
    const q = `dossier=${String(s.contNum)}`
    expect((await chercher(s.users.coord.headers, q)).groupes).toHaveLength(1)
    await db.atelierDroitPrepa.create({
      data: {
        atelierId: s.atelier.id,
        typePreparationId: null,
        surfaceId: s.surface.id,
        exclusion: true,
      },
    })
    expect((await chercher(s.users.coord.headers, q)).groupes).toEqual([])
  })

  it('RG-COO-141 atelier sans règle : rien n’est débloquable et la trace l’indique ; autre site : rien', async () => {
    const s = await site({ regle: false })
    await groupeUm(s)
    const r = await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)
    expect(r.groupes).toEqual([])
    expect(r.avertissements).toContain(
      `Déblocage : aucune règle pour l'atelier ${String(s.atelier.id)}.`,
    )
    const t = await site()
    expect((await chercher(t.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes).toEqual(
      [],
    )
  })

  it('RG-COO-142 statut d’avancement UM : « None » sans UM, « En cours » avec une UM', async () => {
    const s = await site()
    await groupeUm(s, { um: 'EN_COURS' })
    const [g] = (await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes
    expect(g).toMatchObject({ type: 'UM', statutPrepa: 'EN_COURS', deblocable: true })
  })

  it('RG-COO-142 statut d’avancement TRAIN : « None » sans face lancée, « En cours » sinon', async () => {
    const s = await site()
    await groupeTrain(s, { faces: ['A_TRAITER', 'EN_COURS', 'ANNULE'] })
    const [g] = (await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes
    expect(g).toMatchObject({ type: 'TRAIN', statutPrepa: 'NONE', deblocable: true })
    const t = await site()
    await groupeTrain(t, { faces: ['A_TRAITER', 'INSTRUCTION_OK'] })
    const [h] = (await chercher(t.users.coord.headers, `dossier=${String(t.contNum)}`)).groupes
    expect(h).toMatchObject({
      statutPrepa: 'EN_COURS',
      deblocable: false,
      regleBlocage: 'RG-COO-144',
    })
  })
})

describe('RG-COO-145 / 146 / 278 / RG-X-059 « Rendre la main » : effet atomique et trace', () => {
  it('RG-COO-278 répartitions et UM du groupe → Annulé (y compris 0, 1, 3, 5), historique, utilisateur tracé', async () => {
    const s = await site()
    const g = await groupeUm(s, {
      statuts: ['A_TRAITER', 'EN_COURS', 'ERREUR', 'A_IMPRIMER'],
      um: 'EN_COURS',
    })
    const r = await debloquer(s.users.coord.headers, g.cle)
    expect(r.statusCode, r.body).toBe(200)
    const res = DebloquerGroupeResultatSchema.parse(r.json())
    expect(res).toMatchObject({ repartitionsAnnulees: 4, unitesAnnulees: 1, mailEnvoye: false })
    expect(res.message).toContain(`Main rendue à la Pré-Prod pour le dossier ${String(s.contNum)}`)
    const reps = await db.repartition.findMany({ where: { idGroupePreparation: g.idGroupe } })
    expect(reps.every((x) => x.statut === 'ANNULE' && x.updatedById === s.users.coord.id)).toBe(
      true,
    )
    expect(
      (await db.uniteManutention.findUniqueOrThrow({ where: { id: g.unite?.id ?? 0 } })).statut,
    ).toBe('ANNULE')
    const histo = await db.statutHistorique.findMany({
      where: {
        OR: [
          { typeEntite: 'REPARTITION', entiteId: { in: reps.map((x) => String(x.id)) } },
          { typeEntite: 'UNITE_MANUTENTION', entiteId: String(g.unite?.id) },
        ],
      },
    })
    expect(histo).toHaveLength(5)
    expect(
      histo.every(
        (h) => h.nouveau === 'ANNULE' && h.regle === 'RG-COO-278' && h.parId === s.users.coord.id,
      ),
    ).toBe(true)
  })

  it('RG-COO-146 / 145 trace (qui, quand, motif, ids), historique du dossier, demande à Broadcast mise en file', async () => {
    const s = await site()
    const g = await groupeUm(s)
    const r = await debloquer(s.users.admin.headers, g.cle, 'Visuel refait')
    expect(r.statusCode, r.body).toBe(200)
    const trace = await db.deblocagePreparation.findFirstOrThrow({ where: { cle: g.cle } })
    expect(trace).toMatchObject({
      type: 'UM',
      idGroupePreparation: g.idGroupe,
      idPreparationChapeau: s.chapeau,
      contNum: s.contNum,
      motif: 'Visuel refait',
      parId: s.users.admin.id,
      plateformeId: s.plateforme.id,
    })
    expect(JSON.parse(trace.repartitions)).toEqual(g.reps.map((x) => x.id))
    const journal = await db.journalAudit.findMany({
      where: {
        typeEntite: 'DOSSIER',
        entiteId: String(s.contNum),
        action: 'DEBLOQUER_PREPARATION',
      },
    })
    expect(journal).toHaveLength(1)
    expect(journal[0]).toMatchObject({
      parId: s.users.admin.id,
      nouvelleValeur: 'Main rendue à la Pré-Prod : Visuel refait',
    })
    const file = await db.envoiBroadcast.findMany({
      where: { type: 'DEBLOQUER_GROUPE', cle: g.cle },
    })
    expect(file).toHaveLength(1)
    expect(file[0]?.statut).toBe('A_ENVOYER')
  })

  it('RG-COO-151 motif vide : motif par défaut de la maquette', async () => {
    const s = await site()
    const g = await groupeUm(s)
    expect((await debloquer(s.users.coord.headers, g.cle, '   ')).statusCode).toBe(200)
    expect((await db.deblocagePreparation.findFirstOrThrow({ where: { cle: g.cle } })).motif).toBe(
      MOTIF_RENDRE_MAIN_DEFAUT,
    )
  })

  it('RG-X-059 / RG-COO-151 dossier toujours « Préparation reçue », validation admin, affiche, stock et liens inchangés', async () => {
    const s = await site()
    const g = await groupeUm(s)
    const dossier = await db.dossier.create({
      data: { contNum: s.contNum, statut: 'PREPARATION_RECUE' },
    })
    const ligne = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      validationAdmin: true,
      validationAdminParId: s.users.coord.id,
      validationAdminLe: new Date('2026-01-02T10:00:00Z'),
    })
    const lien = await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: ligne.id })
    expect((await debloquer(s.users.coord.headers, g.cle)).statusCode).toBe(200)
    expect((await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).statut).toBe(
      'PREPARATION_RECUE',
    )
    const apres = await db.affiche.findUniqueOrThrow({ where: { id: a.id } })
    expect(apres).toMatchObject({
      validationAdmin: true,
      validationAdminParId: s.users.coord.id,
      quantite: a.quantite,
      version: a.version,
    })
    expect(await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })).toMatchObject({
      actif: true,
      version: lien.version,
    })
  })

  it('RG-COO-279 non reproduit : seul le groupe choisi est annulé (un autre groupe du dossier reste actif)', async () => {
    const s = await site()
    const g1 = await groupeUm(s)
    const g2 = await groupeUm(s)
    expect((await debloquer(s.users.coord.headers, g1.cle)).statusCode).toBe(200)
    const autres = await db.repartition.findMany({ where: { idGroupePreparation: g2.idGroupe } })
    expect(autres.every((x) => x.statut !== 'ANNULE')).toBe(true)
  })

  it('RG-COO-146 atomicité : échec de l’écriture de la trace → déblocage annulé, rien n’est écrit', async () => {
    const s = await site()
    const g = await groupeUm(s)
    await db.$executeRawUnsafe(
      `CREATE TRIGGER t_deblocage_panne BEFORE INSERT ON deblocage_preparation BEGIN SELECT RAISE(ABORT, 'panne'); END`,
    )
    try {
      const r = await debloquer(s.users.coord.headers, g.cle)
      expect(r.statusCode).toBe(500)
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS t_deblocage_panne')
    }
    const reps = await db.repartition.findMany({ where: { idGroupePreparation: g.idGroupe } })
    expect(reps.map((x) => x.statut)).toEqual(['A_TRAITER', 'EN_COURS'])
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'REPARTITION', entiteId: { in: reps.map((x) => String(x.id)) } },
      }),
    ).toBe(0)
    expect(await db.envoiBroadcast.count({ where: { cle: g.cle } })).toBe(0)
  })
})

describe('RG-COO-143 / 144 / 277 gardes serveur et transitions', () => {
  it('RG-COO-143 / 277 une UM « Préparé » (≥ 6) bloque : 422 avec la liste des UM, rien n’est écrit', async () => {
    const s = await site()
    const g = await groupeUm(s, { um: 'PREPARE' })
    const [vu] = (await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes
    expect(vu).toMatchObject({ deblocable: false, regleBlocage: 'RG-COO-143' })
    const r = await debloquer(s.users.coord.headers, g.cle)
    expect(r.statusCode).toBe(422)
    const e = erreur(r)
    expect(e).toMatchObject({
      code: 'COO_GROUPE_NON_DEBLOCABLE',
      regle: 'RG-COO-143',
      message: "Le groupe de preparation n'est pas déblocable !",
    })
    expect(e.details).toEqual({
      unites: [
        expect.objectContaining({
          id: g.unite?.id,
          codeBarre: g.unite?.codeBarre,
          statut: 'PREPARE',
        }),
      ],
    })
    const reps = await db.repartition.findMany({ where: { idGroupePreparation: g.idGroupe } })
    expect(reps.every((x) => x.statut !== 'ANNULE')).toBe(true)
    expect(await db.deblocagePreparation.count({ where: { cle: g.cle } })).toBe(0)
  })

  it('RG-COO-277 répartitions sans UM jamais bloquantes ; UM « À imprimer » (< 6) non bloquante', async () => {
    const s = await site()
    const g = await groupeUm(s, { um: 'A_IMPRIMER' })
    expect((await debloquer(s.users.coord.headers, g.cle)).statusCode).toBe(200)
  })

  it('RG-COO-144 groupe TRAIN : faces non lancées (0, 1, 4) → débloqué, trace sans répartition', async () => {
    const s = await site()
    const cle = await groupeTrain(s, { faces: ['A_TRAITER', 'ANNULE'] })
    const r = await debloquer(s.users.coord.headers, cle)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({ repartitionsAnnulees: 0, unitesAnnulees: 0 })
    expect(await db.deblocagePreparation.count({ where: { cle, type: 'TRAIN' } })).toBe(1)
  })

  it('RG-COO-144 rejet : une face au-delà de « En cours » (production lancée) → 422', async () => {
    const s = await site()
    const cle = await groupeTrain(s, { faces: ['EN_COURS', 'EXPORT_PREPA'] })
    const r = await debloquer(s.users.coord.headers, cle)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_GROUPE_NON_DEBLOCABLE', regle: 'RG-COO-144' })
    expect(await db.deblocagePreparation.count({ where: { cle } })).toBe(0)
  })

  it('RG-COO-144 rejet : correspondance des supports absente → refus explicite (pas de fail-open)', async () => {
    const s = await site()
    const cle = await groupeTrain(s, { correspondance: false })
    const [g] = (await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes
    expect(g).toMatchObject({ statutPrepa: null, deblocable: false })
    const r = await debloquer(s.users.coord.headers, cle)
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-144')
    expect(erreur(r).message).toContain('correspondance des supports absente')
  })

  it('§3.2.e transition interdite : débloquer un groupe déjà débloqué → 409', async () => {
    const s = await site()
    const g = await groupeUm(s)
    expect((await debloquer(s.users.coord.headers, g.cle)).statusCode).toBe(200)
    const [vu] = (await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes
    expect(vu).toMatchObject({ etat: 'DEBLOQUE', deblocable: false })
    const r = await debloquer(s.users.coord.headers, g.cle)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-145' })
  })

  it('§3.2.e TRAIN déjà débloqué : 409 tant qu’aucune face n’est réintégrée', async () => {
    const s = await site()
    const cle = await groupeTrain(s, { faces: ['A_TRAITER'] })
    expect((await debloquer(s.users.coord.headers, cle)).statusCode).toBe(200)
    expect((await debloquer(s.users.coord.headers, cle)).statusCode).toBe(409)
  })

  it('rejets : clé invalide (400), groupe inconnu (404), groupe hors des ateliers de l’utilisateur (403)', async () => {
    const s = await site()
    const g = await groupeUm(s)
    expect((await debloquer(s.users.coord.headers, 'n’importe quoi')).statusCode).toBe(400)
    expect((await debloquer(s.users.coord.headers, 'UM:999999999')).statusCode).toBe(404)
    const t = await site()
    const r = await debloquer(t.users.coord.headers, g.cle)
    expect(r.statusCode).toBe(403)
    expect(erreur(r)).toMatchObject({ code: 'COO_PERIMETRE_INTERDIT', regle: 'RG-COO-141' })
  })

  it('concurrence et idempotence : même clé rejouée → même réponse, une seule trace ; deux personnes en même temps → 200 et 409', async () => {
    const s = await site()
    const g = await groupeUm(s)
    const headers = { ...s.users.coord.headers, 'idempotency-key': `deb-${String(next())}` }
    const r1 = await ctx.app.inject({ method: 'POST', url: URL, headers, payload: { cle: g.cle } })
    const r2 = await ctx.app.inject({ method: 'POST', url: URL, headers, payload: { cle: g.cle } })
    expect(r1.statusCode, r1.body).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(await db.deblocagePreparation.count({ where: { cle: g.cle } })).toBe(1)
    // Deux personnes en même temps sur un autre groupe : une seule réussit, l'autre reçoit 409.
    const g2 = await groupeUm(s)
    const [a, b] = await Promise.all([
      debloquer(s.users.coord.headers, g2.cle),
      debloquer(s.users.admin.headers, g2.cle),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(await db.deblocagePreparation.count({ where: { cle: g2.cle } })).toBe(1)
  })
})

describe('RG-COO-143 / 277 / 278 groupe Broadcast ENTIER (audit COO-P08 B1)', () => {
  /** Ajoute au groupe une tranche (autre semaine et / ou autre dossier) avec ses répartitions. */
  async function tranche(
    s: Site,
    idGroupe: number,
    contNum: number,
    sem: SemaineIso,
    um?: 'PREPARE' | 'EN_COURS',
  ) {
    const unite = um
      ? await f.createUniteManutention(db, { atelierId: s.atelier.id, contNum, statut: um })
      : null
    return f.createRepartition(db, {
      statut: 'A_TRAITER',
      atelierId: s.atelier.id,
      contNum,
      semAnnee: sem.annee,
      semNum: sem.semaine,
      typePreparationId: s.type.id,
      idGroupePreparation: idGroupe,
      qte: 5,
      uniteId: unite?.id ?? null,
    })
  }

  it('RG-COO-143 groupe sur deux semaines : une UM « Préparé » dans l’autre semaine bloque tout (422), rien n’est écrit', async () => {
    const s = await site()
    const g = await groupeUm(s)
    const autre = await tranche(s, g.idGroupe, s.contNum, plus(SEM, 1), 'PREPARE')
    const [vu] = (await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes
    expect(vu).toMatchObject({ cle: `UM:${String(g.idGroupe)}`, deblocable: false })
    expect(vu?.tranches).toHaveLength(2)
    const r = await debloquer(s.users.coord.headers, g.cle)
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-143')
    const reps = await db.repartition.findMany({ where: { idGroupePreparation: g.idGroupe } })
    expect(reps.map((x) => x.id)).toContain(autre.id)
    expect(reps.every((x) => x.statut !== 'ANNULE')).toBe(true)
    expect(await db.deblocagePreparation.count({ where: { cle: g.cle } })).toBe(0)
  })

  it('RG-COO-278 « Rendre la main » annule TOUT le groupe : deux semaines et deux dossiers, une seule ligne à l’écran', async () => {
    const s = await site()
    const g = await groupeUm(s)
    const autreDossier = s.contNum + 7
    await tranche(s, g.idGroupe, s.contNum, plus(SEM, 1))
    await tranche(s, g.idGroupe, autreDossier, SEM, 'EN_COURS')
    // Recherche par l'autre dossier : le même groupe entier, une seule ligne.
    const vus = (await chercher(s.users.coord.headers, `dossier=${String(autreDossier)}`)).groupes
    expect(vus).toHaveLength(1)
    expect(vus[0]).toMatchObject({ cle: g.cle, repartitionsActives: 4 })
    expect(vus[0]?.tranches.map((t) => t.contNum)).toEqual([s.contNum, s.contNum, autreDossier])
    const r = await debloquer(s.users.coord.headers, g.cle)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({ repartitionsAnnulees: 4, unitesAnnulees: 1 })
    const reps = await db.repartition.findMany({ where: { idGroupePreparation: g.idGroupe } })
    expect(reps.every((x) => x.statut === 'ANNULE')).toBe(true)
    for (const n of [s.contNum, autreDossier])
      expect(
        await db.journalAudit.count({
          where: { typeEntite: 'DOSSIER', entiteId: String(n), action: 'DEBLOQUER_PREPARATION' },
        }),
        String(n),
      ).toBe(1)
    const demande = await db.envoiBroadcast.findFirstOrThrow({ where: { cle: g.cle } })
    expect(JSON.parse(demande.donnees)).toMatchObject({
      idGroupePreparation: g.idGroupe,
      idPreparationChapeau: s.chapeau,
      dossiers: [s.contNum, autreDossier],
    })
  })
})

describe('RG-COO-147 mail de déblocage (Q-219, Q-375)', () => {
  it('RG-COO-147 destinataires = adresses de la plateforme ; mail mis en file (Q-375, Q-409), le déblocage reste fait', async () => {
    const s = await site()
    const g = await groupeUm(s)
    const r = await debloquer(s.users.coord.headers, g.cle)
    expect(r.statusCode).toBe(200)
    expect(r.json<{ message: string }>().message).toContain(
      'Mail à la plateforme mis en file d’envoi (Q-375, Q-409).',
    )
    expect(await db.deblocagePreparation.findFirstOrThrow({ where: { cle: g.cle } })).toMatchObject(
      {
        mailStatut: 'NON_ENVOYE',
        mailDestinataires: 'preprod@exemple.test, chef@exemple.test',
      },
    )
    // D-19 : le mail est dans la file (même transaction), source = la trace du déblocage ; l'envoi se fait après.
    const trace = await db.deblocagePreparation.findFirstOrThrow({ where: { cle: g.cle } })
    expect(
      await db.mailFile.findUniqueOrThrow({ where: { cle: `DEBLOCAGE:${String(trace.id)}` } }),
    ).toMatchObject({
      type: 'DEBLOCAGE',
      statut: 'EN_ATTENTE',
      destinataires: 'preprod@exemple.test;chef@exemple.test',
      sourceType: 'DEBLOCAGE',
      sourceId: trace.id,
    })
    // File partagée avec les autres fichiers : les lignes plus anciennes sont soldées pour que celle-ci soit dans les 100 premières.
    await db.mailFile.updateMany({
      where: {
        statut: 'EN_ATTENTE',
        id: {
          lt: (
            await db.mailFile.findUniqueOrThrow({ where: { cle: `DEBLOCAGE:${String(trace.id)}` } })
          ).id,
        },
      },
      data: { statut: 'ENVOYE', canal: 'SIMULE' },
    })
    await traiterFileMails({ db, mail: new MailBoiteEnvoi() })
    expect(
      (await db.deblocagePreparation.findUniqueOrThrow({ where: { id: trace.id } })).mailStatut,
    ).toBe('SIMULE')
  })

  it('RG-COO-147 rejet : plateforme sans adresse → avertissement tracé, déblocage fait quand même', async () => {
    const s = await site({ mail: null })
    const g = await groupeUm(s)
    const r = await debloquer(s.users.coord.headers, g.cle)
    expect(r.statusCode).toBe(200)
    expect(r.json<{ message: string }>().message).toContain('Aucune adresse mail')
    expect(
      (await db.deblocagePreparation.findFirstOrThrow({ where: { cle: g.cle } })).mailStatut,
    ).toBe('SANS_DESTINATAIRE')
  })
})

describe('RG-COO-145 demande de déblocage refusée par Broadcast : alerte (audit COO-P08 m2)', () => {
  class Refus implements BroadcastPort {
    readonly nom = 'refus'
    readonly configure = true
    lireLot(): Promise<LotIntegration> {
      return Promise.reject(new Error('non utilisé'))
    }
    envoyer(): Promise<void> {
      return Promise.reject(new Error('Groupe inconnu de Broadcast'))
    }
  }
  const alertesDeblocage = async (h: Record<string, string>) => {
    const r = await get(ctx, '/api/alertes', h)
    expect(r.statusCode, r.body).toBe(200)
    return ListeAlertesSchema.parse(r.json()).alertes.filter((a) => a.cle.startsWith('DEB-BC-'))
  }

  it('RG-COO-145 Broadcast refuse la demande : alerte « Déblocage non transmis » pour le site ; acceptée ensuite : levée', async () => {
    const s = await site()
    const g = await groupeUm(s)
    expect((await debloquer(s.users.coord.headers, g.cle)).statusCode).toBe(200)
    const e = await db.envoiBroadcast.findFirstOrThrow({ where: { cle: g.cle } })
    // Avant toute tentative : pas d'alerte.
    expect(
      (await alertesDeblocage(s.users.coord.headers)).filter(
        (a) => a.cle === `DEB-BC-${String(e.id)}`,
      ),
    ).toEqual([])
    await envoyerEnAttente({ db, broadcast: new Refus() }, [e.id])
    const vues = (await alertesDeblocage(s.users.coord.headers)).filter(
      (a) => a.cle === `DEB-BC-${String(e.id)}`,
    )
    expect(vues).toEqual([
      expect.objectContaining({
        type: 'INTEGRATION',
        regle: 'RG-COO-145',
        gravite: 'IMPORTANT',
        titre: 'Déblocage non transmis à Broadcast',
        dossiers: [s.contNum],
      }),
    ])
    expect(vues[0]?.message).toContain('Groupe inconnu de Broadcast')
    // Rejet : un coordinateur d'un autre site ne la voit pas.
    const t = await site()
    expect(
      (await alertesDeblocage(t.users.coord.headers)).some(
        (a) => a.cle === `DEB-BC-${String(e.id)}`,
      ),
    ).toBe(false)
    // Envoi réussi ensuite : l'alerte disparaît.
    const ok: BroadcastPort = {
      nom: 'ok',
      configure: true,
      lireLot: () => Promise.reject(new Error('non utilisé')),
      envoyer: () => Promise.resolve(),
    }
    await envoyerEnAttente({ db, broadcast: ok }, [e.id])
    expect(
      (await alertesDeblocage(s.users.coord.headers)).some(
        (a) => a.cle === `DEB-BC-${String(e.id)}`,
      ),
    ).toBe(false)
  })
})

describe('RG-COO-148 prépa renvoyée après déblocage : intégrée normalement', () => {
  class Memoire implements BroadcastPort {
    readonly nom = 'memoire'
    readonly configure = true
    envoyes: MessageBroadcast[] = []
    lireLot(): Promise<LotIntegration> {
      return Promise.reject(new Error('non utilisé'))
    }
    envoyer(m: MessageBroadcast) {
      this.envoyes.push(m)
      return Promise.resolve()
    }
  }
  const passer = (lot: Partial<LotIntegration>) =>
    lancerPassage(
      { db, broadcast: new Memoire() },
      {
        declencheur: 'LOT',
        identity: null,
        lot: { idInterface: 1, lectureComplete: false, lueLe: new Date(), ...lot },
      },
    )

  it('RG-COO-148 / 122 / RG-X-059 sans déblocage la prépa renvoyée est refusée ; après « Rendre la main », elle est intégrée, validation admin inchangée', async () => {
    const s = await site()
    await parametre('integration.sitesPreparation', String(s.idSiteCcf))
    await parametre('integration.routageFixe', `${String(s.idSiteCcf)}:${String(s.atelier.id)}`)
    const groupe: GroupePreparation = {
      idGroupe: 90_000 + next(),
      idSiteCcf: s.idSiteCcf,
      statutBroadcast: 133,
      details: [
        {
          idPreparationDetail: 60_000 + next(),
          contNum: s.contNum,
          idTypePreparation: s.type.id,
          supportId: s.support.id,
          destinataire: null,
          annonceur: 'ANNONCEUR DEBLOCAGE',
          theme: 'Thème A',
          repiquage: null,
          repiquageId: null,
          quantite: 40,
          semaine: SEM,
          dateAffichage: null,
          numAfficheAmt: null,
          statutTravail: 0,
        },
      ],
    }
    await f.createPrepaBroadcast(db, {
      idPreparationChapeau: s.chapeau,
      idDossierDeVenteChapeau: s.contNum,
      idSiteCcf: s.idSiteCcf,
      idSurface: s.surface.id,
      idTypePreparation: s.type.id,
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    await passer({ preparations: [groupe] })
    expect(
      await db.repartition.count({ where: { contNum: s.contNum, statut: { not: 'ANNULE' } } }),
    ).toBe(1)
    const validee = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      validationAdmin: true,
      validationAdminParId: s.users.coord.id,
      validationAdminLe: new Date('2026-01-02T10:00:00Z'),
    })
    // Renvoi sans déblocage : refusé (RG-COO-122).
    const refus = await passer({ preparations: [groupe] })
    expect(refus.flux.find((x) => x.flux === 'PREPARATIONS')).toMatchObject({ creees: 0 })
    const [g] = (await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes
    expect(g?.type).toBe('UM')
    expect((await debloquer(s.users.coord.headers, g?.cle ?? '')).statusCode).toBe(200)
    const renvoi = await passer({ preparations: [groupe] })
    expect(renvoi.flux.find((x) => x.flux === 'PREPARATIONS')).toMatchObject({ creees: 1 })
    const reps = await db.repartition.findMany({
      where: { contNum: s.contNum },
      orderBy: { id: 'asc' },
    })
    expect(reps.map((x) => x.statut)).toEqual(['ANNULE', 'A_TRAITER'])
    expect((await db.dossier.findUniqueOrThrow({ where: { contNum: s.contNum } })).statut).toBe(
      'PREPARATION_RECUE',
    )
    // RG-X-059 : le renvoi de prépa ne touche pas la validation admin déjà faite.
    expect(await db.affiche.findUniqueOrThrow({ where: { id: validee.id } })).toMatchObject({
      validationAdmin: true,
      validationAdminParId: s.users.coord.id,
      version: validee.version,
    })
    // Le groupe redevient « intégré » (débloquable à nouveau).
    const [apres] = (await chercher(s.users.coord.headers, `dossier=${String(s.contNum)}`)).groupes
    expect(apres).toMatchObject({ etat: 'INTEGRE', deblocable: true })
  })
})

describe('RG-COO-149 « Préparations débloquées »', () => {
  const SUIVI = '/api/coordination/deblocage/suivi'
  it('RG-COO-149 période par défaut (dernier mois) : le déblocage du jour, site traduit, « Tole traditionnelle » → « 4m² colle »', async () => {
    const s = await site()
    await db.typePreparation.update({
      where: { id: s.type.id },
      data: { libelle: 'Tole traditionnelle' },
    })
    const g = await groupeUm(s)
    expect((await debloquer(s.users.coord.headers, g.cle, 'Motif suivi')).statusCode).toBe(200)
    const r = await get(ctx, SUIVI, s.users.coord.headers)
    expect(r.statusCode, r.body).toBe(200)
    const l = ListeDeblocagesSchema.parse(r.json())
    const ligne = l.deblocages.find((x) => x.contNum === s.contNum)
    expect(ligne).toMatchObject({
      site: s.plateforme.nom,
      typePreparation: '4m² colle',
      motif: 'Motif suivi',
      repartitionsAnnulees: 2,
      type: 'UM',
    })
    expect(ligne?.par).toBeTruthy()
    expect(l.au > l.du).toBe(true)
  })

  it('RG-COO-149 rejet : date de fin avant la date de début → 422 avec le message legacy', async () => {
    const s = await site()
    const r = await get(ctx, `${SUIVI}?du=2026-05-10&au=2026-05-01`, s.users.coord.headers)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({
      regle: 'RG-COO-149',
      message: 'La date de fin doit être supérieur à la date de début !',
    })
    expect((await get(ctx, `${SUIVI}?du=2026-5-1`, s.users.coord.headers)).statusCode).toBe(400)
  })

  it('RG-COO-149 / 167 hors période ou autre site : non listé', async () => {
    const s = await site()
    const g = await groupeUm(s)
    expect((await debloquer(s.users.coord.headers, g.cle)).statusCode).toBe(200)
    const ancien = ListeDeblocagesSchema.parse(
      (await get(ctx, `${SUIVI}?du=2020-01-01&au=2020-01-31`, s.users.coord.headers)).json(),
    )
    expect(ancien.deblocages.some((x) => x.contNum === s.contNum)).toBe(false)
    const t = await site()
    const autre = ListeDeblocagesSchema.parse((await get(ctx, SUIVI, t.users.coord.headers)).json())
    expect(autre.deblocages.some((x) => x.contNum === s.contNum)).toBe(false)
  })
})

describe('RG-COO-152 droits ; RG-COO-150 legacy non repris', () => {
  it('RG-COO-152 coord et admin : recherche, action, suivi autorisés', async () => {
    const s = await site()
    await groupeUm(s)
    for (const r of ['coord', 'admin'] as const) {
      expect(
        (await get(ctx, `${URL}?dossier=${String(s.contNum)}`, s.users[r].headers)).statusCode,
      ).toBe(200)
      expect(
        (await get(ctx, '/api/coordination/deblocage/suivi', s.users[r].headers)).statusCode,
      ).toBe(200)
    }
  })

  it('RG-COO-152 rejet : cheq, recep, expe (403 RG-COO-152), com (403 RG-COO-168), sans identité (401) ; rien n’est écrit', async () => {
    const s = await site()
    const g = await groupeUm(s)
    for (const r of ['cheq', 'recep', 'expe'] as const) {
      const a = await debloquer(s.users[r].headers, g.cle)
      expect(a.statusCode, r).toBe(403)
      expect(erreur(a).regle).toBe('RG-COO-152')
      expect(
        (await get(ctx, `${URL}?dossier=${String(s.contNum)}`, s.users[r].headers)).statusCode,
      ).toBe(403)
      expect(
        (await get(ctx, '/api/coordination/deblocage/suivi', s.users[r].headers)).statusCode,
      ).toBe(403)
    }
    const com = await debloquer(s.users.com.headers, g.cle)
    expect(erreur(com).regle).toBe('RG-COO-168')
    expect((await ctx.app.inject({ method: 'GET', url: `${URL}?dossier=1` })).statusCode).toBe(401)
    expect(await db.deblocagePreparation.count({ where: { cle: g.cle } })).toBe(0)
  })

  it('RG-COO-150 BLOQUÉ (Q-228) : l’ancien écran « Répartitions déblocables » n’est pas repris (aucune route)', async () => {
    const s = await site()
    for (const url of [
      '/api/coordination/repartitions/deblocables',
      '/api/repartitions/deblocables',
    ])
      expect((await get(ctx, url, s.users.coord.headers)).statusCode).toBe(404)
  })
})
