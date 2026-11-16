// RG-COO-167 / Q-173 — le site choisi dans le bandeau (en-tête x-site-id) vaut pour TOUTE l'application : listes,
// fiches et actions de Coordination sont restreintes à ce site (ANO-053, corrigée en COO-P13). Un utilisateur de deux
// sites voit les deux sans en-tête et un seul avec ; un site hors périmètre est refusé (403, RG-REC-001).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formatSemaineIso, semaineIsoDe } from '@circe/shared'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception, erreur, get, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
const SEM = semaineIsoDe(new Date())
const DEPART = formatSemaineIso(SEM)

beforeAll(async () => {
  await ctx.demarrer()
})
const purge = { ateliers: [] as number[], dossiers: [] as number[], destinataires: [] as number[] }

afterAll(async () => {
  // Données purgées : la suite d'intégration est proche des limites SQLite et des passages d'intégration (COO-P06).
  const essayer = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch {
      // purge au mieux : la base de test est recréée à chaque exécution
    }
  }
  await essayer(() => db.faceTrain.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() => db.instruction.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() => db.dossier.deleteMany({ where: { id: { in: purge.dossiers } } }))
  await essayer(() =>
    db.transportDestinataire.deleteMany({ where: { atelierId: { in: purge.ateliers } } }),
  )
  for (const id of purge.ateliers) await essayer(() => db.atelier.delete({ where: { id } }))
  for (const id of purge.destinataires)
    await essayer(() => db.destinataire.delete({ where: { id } }))
  await ctx.arreter()
})

/** Deux sites, un atelier fixe et un atelier déroulant par site, un dossier avec instruction et face par site. */
async function deuxSites() {
  const sites = []
  for (let i = 0; i < 2; i++) {
    const plateforme = await f.createPlateforme(db)
    const fixe = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
    const scroll = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' })
    const support = await f.createSupport(db)
    const destinataire = await f.createDestinataire(db)
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    purge.ateliers.push(fixe.id, scroll.id)
    purge.dossiers.push(dossier.id)
    purge.destinataires.push(destinataire.id)
    const instruction = await f.createInstruction(db, {
      atelierId: scroll.id,
      dossierId: dossier.id,
      contNum: dossier.contNum,
      statut: 'PRET_A_PRODUIRE',
    })
    await f.createFaceTrain(db, {
      instructionCode: instruction.code,
      statut: 'A_IMPRIMER',
      atelierId: scroll.id,
      supportId: support.id,
      destinataireId: destinataire.id,
      contNum: dossier.contNum,
      dateDepart: new Date(),
      depAnbas: SEM.annee,
      depSembas: SEM.semaine,
      trainId: `7${String(dossier.contNum).padStart(15, '0')}`,
      theme: `Thème ${String(dossier.contNum)}`,
    })
    sites.push({ plateforme, fixe, scroll, support, destinataire, dossier, instruction })
  }
  const [s1, s2] = sites as [(typeof sites)[number], (typeof sites)[number]]
  const coord = await f.createUtilisateurAvecRoles(
    db,
    ['coord'],
    [{ plateformeId: s1.plateforme.id }, { plateformeId: s2.plateforme.id }],
  )
  const cheq = await f.createUtilisateurAvecRoles(
    db,
    ['cheq'],
    [{ plateformeId: s1.plateforme.id }, { plateformeId: s2.plateforme.id }],
  )
  return { s1, s2, coord, cheq }
}

describe('RG-COO-167 le site choisi dans le bandeau restreint les écrans de Coordination', () => {
  it('RG-COO-167 liste des dossiers : sans en-tête les deux sites, avec x-site-id le site choisi seulement', async () => {
    const { s1, s2, coord } = await deuxSites()
    const ids = async (siteId: number | undefined, contNum: number) => {
      const r = await get(
        ctx,
        `/api/coordination/dossiers?dossier=${String(contNum)}`,
        devHeaders(coord.identifiantExterne, siteId),
      )
      expect(r.statusCode, r.body).toBe(200)
      return r.json<{ items: { dossier: number }[] }>().items.map((x) => x.dossier)
    }
    expect(await ids(undefined, s1.dossier.contNum)).toEqual([s1.dossier.contNum])
    expect(await ids(undefined, s2.dossier.contNum)).toEqual([s2.dossier.contNum])
    expect(await ids(s2.plateforme.id, s1.dossier.contNum)).toEqual([])
    expect(await ids(s2.plateforme.id, s2.dossier.contNum)).toEqual([s2.dossier.contNum])
    expect(await ids(s1.plateforme.id, s2.dossier.contNum)).toEqual([])
  })

  it('RG-COO-167 ateliers du périmètre : restreints au site choisi', async () => {
    const { s1, s2, coord } = await deuxSites()
    const lire = async (siteId?: number) =>
      (await get(ctx, '/api/coordination/ateliers', devHeaders(coord.identifiantExterne, siteId)))
        .json<{ ateliers: { id: number }[] }>()
        .ateliers.map((a) => a.id)
    expect(await lire()).toEqual(
      expect.arrayContaining([s1.fixe.id, s1.scroll.id, s2.fixe.id, s2.scroll.id]),
    )
    const seul = await lire(s2.plateforme.id)
    expect(seul.sort()).toEqual([s2.fixe.id, s2.scroll.id].sort())
  })

  it('RG-COO-167 liste des trains : le site choisi filtre les trains', async () => {
    const { s1, s2, coord } = await deuxSites()
    const lire = async (siteId: number | undefined, contNum: number) => {
      const r = await get(
        ctx,
        `/api/coordination/trains?depart=${DEPART}&dossier=${String(contNum)}`,
        devHeaders(coord.identifiantExterne, siteId),
      )
      expect(r.statusCode, r.body).toBe(200)
      return r.json<{ lignes: unknown[] }>().lignes.length
    }
    expect(await lire(undefined, s1.dossier.contNum)).toBe(1)
    expect(await lire(s2.plateforme.id, s1.dossier.contNum)).toBe(0)
    expect(await lire(s1.plateforme.id, s1.dossier.contNum)).toBe(1)
  })

  it('RG-COO-167 action : agir sur un dossier de l’autre site avec le site choisi est refusé (403), rien n’est écrit', async () => {
    const { s1, s2, coord } = await deuxSites()
    const r = await post(
      ctx,
      '/api/coordination/validation-admin',
      devHeaders(coord.identifiantExterne, s2.plateforme.id),
      { dossierIds: [s1.dossier.id], confirmerDoutes: false },
    )
    expect(r.statusCode, r.body).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-167')
  })

  it('RG-COO-167 le chef d’équipe : unités à plat, dispatch et colis restreints au site choisi ; site hors périmètre : 403', async () => {
    const { s1, s2, cheq } = await deuxSites()
    const h = (siteId?: number) => devHeaders(cheq.identifiantExterne, siteId)
    const ateliersColis = async (siteId?: number) => {
      const r = await get(ctx, '/api/coordination/colis/a-coliser', h(siteId))
      expect(r.statusCode, r.body).toBe(200)
      return r.statusCode
    }
    await ateliersColis()
    await ateliersColis(s1.plateforme.id)
    for (const url of [
      '/api/coordination/dossiers',
      '/api/coordination/trains',
      '/api/coordination/unitaire',
      '/api/coordination/colis',
      '/api/coordination/ateliers',
    ]) {
      const hors = await get(ctx, url, h(999_999_999))
      expect(hors.statusCode, url).toBe(403)
      expect(erreur(hors).regle, url).toBe('RG-REC-001')
    }
    expect(s2.plateforme.id).toBeGreaterThan(0)
  })
})
