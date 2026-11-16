// COO-P04 — validation admin : confirmation unitaire (RG-COO-008), annulation (RG-COO-014 / RG-X-050),
// traçabilité (RG-COO-015), effets (RG-COO-021 à 026), gardes négatives (RG-COO-027 / 028 / 064), ligne
// modifiée après la validation (RG-COO-030 à 032), rattachements manuels (RG-COO-017 / 018, RG-X-014 / 015,
// RG-X-051 / 052 / 058).
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AlertesSchema,
  EtiquettesRackSchema,
  FicheAfficheSchema,
  FicheDossierSchema,
  InconnueCreeeSchema,
  ListeAffichesSchema,
  ValidationAfficheResultatSchema,
  type Role,
} from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import { annulerDossier, integrerPreparation } from '../../src/modules/coordination/integration.ts'
import {
  alertesValidation,
  estAssociee,
  aTraiter,
  marqueEtatReservations,
  numeroVisibleSuiviProd,
} from '../../src/modules/coordination/effets-validation.ts'
import * as f from '../factories/index.ts'
import {
  autre,
  contexteReception,
  erreur,
  get,
  idem,
  ligne,
  photo,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

async function contexte(preparation: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE' = 'A_TRAITER') {
  const s = await site(ctx, ['recep'])
  const coord = await autre(ctx, s.plateforme.id, ['coord'])
  const dossier = await f.createDossier(db, { statut: preparation })
  return { ...s, coord, dossier }
}
type Ctx = Awaited<ReturnType<typeof contexte>>

function recevoir(c: Ctx, qte = 10, data: Parameters<typeof f.createReceptionAttendue>[1] = {}) {
  return receptionValidee(ctx, c.headers, c.plateforme.id, qte, {
    contNum: c.dossier.contNum,
    supportId: c.support.id,
    ...data,
  })
}

const affiche = (id: number) => db.affiche.findUniqueOrThrow({ where: { id } })

async function changer(
  headers: Record<string, string>,
  id: number,
  valider: boolean,
  version?: number,
) {
  const v = version ?? (await affiche(id)).version
  return post(ctx, `/api/coordination/affiches/${String(id)}/validation-admin`, headers, {
    version: v,
    valider,
  })
}

async function fiche(c: Ctx, headers = c.coord.headers) {
  const r = await get(ctx, `/api/coordination/dossiers/${String(c.dossier.id)}`, headers)
  expect(r.statusCode).toBe(200)
  return FicheDossierSchema.parse(r.json())
}

const journal = (afficheId: number) =>
  db.journalAudit.findMany({
    where: { typeEntite: 'AFFICHE', entiteId: String(afficheId) },
    orderBy: { id: 'asc' },
  })

describe('RG-COO-008 « Valider » une affiche (fiche dossier)', () => {
  it('RG-COO-008 proposée → VALIDEE : par / le, historique, journal du dossier, message de la maquette', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 4)
    const r = await changer(c.coord.headers, rv.afficheId, true)
    expect(r.statusCode).toBe(200)
    const res = ValidationAfficheResultatSchema.parse(r.json())
    expect(res.message).toBe(
      '1 affiche(s) confirmée(s) par la Coordination : n° d’affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé au prochain retour.',
    )
    const a = await affiche(rv.afficheId)
    expect(a).toMatchObject({
      validationAdmin: true,
      validationAdminParId: c.coord.user.id,
      validationAnnulee: false,
      etiquetteRackAImprimer: true,
      version: res.version,
    })
    expect(a.validationAdminLe).toBeInstanceOf(Date)
    expect((await journal(a.id)).at(-1)).toMatchObject({
      action: 'VALIDATION_ADMIN',
      parId: c.coord.user.id,
      nouvelleValeur: 'Validation admin confirmée : rattachement proposé par Circé, sans doute',
    })
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'DOSSIER',
          entiteId: String(c.dossier.contNum),
          action: 'VALIDATION_ADMIN',
        },
      }),
    ).toBe(1)
    expect((await fiche(c)).affiches[0]).toMatchObject({ etat: 'VALIDEE', estAssociee: true })
  })

  it('RG-COO-008 une affiche à doute se confirme une par une dans la fiche (motif cité dans l’historique)', async () => {
    const c = await contexte()
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: 'T',
    })
    const a = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'IDENTIFIEE',
      theme: 'T',
    })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      quantite: 2,
      mode: 'MAIN',
    })
    expect((await fiche(c)).affiches[0]?.etat).toBe('A_CONFIRMER_DOUTE')
    expect((await changer(c.coord.headers, a.id, true)).statusCode).toBe(200)
    expect((await journal(a.id)).at(-1)?.nouvelleValeur).toBe(
      'Validation admin confirmée après vérification (BL)',
    )
  })

  it('RG-COO-008 rejet : affiche déjà validée → 409 TRANSITION_INTERDITE, rien n’est écrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const avant = await affiche(rv.afficheId)
    const r = await changer(c.coord.headers, rv.afficheId, true)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-008' })
    expect((await affiche(rv.afficheId)).version).toBe(avant.version)
  })

  it('RG-COO-008 rejet : version périmée → 409 COO_CONFLIT_VERSION', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const v = (await affiche(rv.afficheId)).version
    const r = await changer(c.coord.headers, rv.afficheId, true, v - 1)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_CONFLIT_VERSION')
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
  })

  it('RG-COO-008 rejet : réception inconnue (orpheline) → 409 « à rattacher d’abord »', async () => {
    const c = await contexte()
    const a = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      statut: 'ORPHELINE',
    })
    const r = await changer(c.coord.headers, a.id, true)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).message).toContain('à rattacher d’abord')
  })

  it('RG-COO-008 affiche inconnue → 404 ; sans Idempotency-Key → 400', async () => {
    const c = await contexte()
    const r = await post(
      ctx,
      '/api/coordination/affiches/99999999/validation-admin',
      c.coord.headers,
      {
        version: 1,
        valider: true,
      },
    )
    expect(r.statusCode).toBe(404)
    const rv = await recevoir(c, 2)
    const sansCle = await post(
      ctx,
      `/api/coordination/affiches/${String(rv.afficheId)}/validation-admin`,
      c.coord.headers,
      { version: 1, valider: true },
      false,
    )
    expect(sansCle.statusCode).toBe(400)
  })

  it('RG-COO-008 double soumission (même clé) : une seule validation, même réponse', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const h = { ...c.coord.headers, ...idem() }
    const envoi = () =>
      ctx.app.inject({
        method: 'POST',
        url: `/api/coordination/affiches/${String(a.id)}/validation-admin`,
        headers: h,
        payload: { version: a.version, valider: true },
      })
    const r1 = await envoi()
    const r2 = await envoi()
    expect(r1.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect((await journal(a.id)).filter((j) => j.action === 'VALIDATION_ADMIN')).toHaveLength(1)
  })

  it('RG-COO-064 / RG-COO-001 la validation est acceptée avec un dossier « À traiter » (prépa non reçue)', async () => {
    const c = await contexte('A_TRAITER')
    const rv = await recevoir(c, 2)
    expect((await changer(c.coord.headers, rv.afficheId, true)).statusCode).toBe(200)
  })

  it('RG-COO-016 une réception partielle (reçu < attendu) se valide pour ce qu’elle contient', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 3, { qteBc: 10 })
    expect((await changer(c.coord.headers, rv.afficheId, true)).statusCode).toBe(200)
  })
})

describe('RG-COO-009 / RG-COO-167 qui peut valider et annuler', () => {
  it.each<[Role, number, string | undefined]>([
    ['coord', 200, undefined],
    ['admin', 200, undefined],
    ['recep', 403, 'RG-COO-009'],
    ['cheq', 403, 'RG-COO-009'],
    ['expe', 403, 'RG-COO-009'],
    ['com', 403, 'RG-COO-168'],
  ])(
    'RG-COO-009 « Valider » puis « Annuler la validation » par le rôle %s → %i',
    async (role, statut, regle) => {
      const c = await contexte()
      const rv = await recevoir(c, 2)
      const u = await autre(ctx, c.plateforme.id, [role])
      const r = await changer(u.headers, rv.afficheId, true)
      expect(r.statusCode).toBe(statut)
      if (regle) {
        expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle })
        expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
        await changer(c.coord.headers, rv.afficheId, true)
      }
      const annul = await changer(u.headers, rv.afficheId, false)
      expect(annul.statusCode).toBe(statut)
      expect((await affiche(rv.afficheId)).validationAdmin).toBe(regle !== undefined)
    },
  )

  it('RG-COO-167 rejet : affiche d’un site hors périmètre → 403, rien n’est écrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const ailleurs = await site(ctx, ['coord'])
    const r = await changer(ailleurs.headers, rv.afficheId, true)
    expect(r.statusCode).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-167')
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
  })
})

describe('RG-COO-014 / RG-X-050 / RG-COO-015 annuler la validation', () => {
  it('RG-COO-014 VALIDEE → « À confirmer : doute » (ANNULEE), par / le effacés, historique nominatif', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const r = await changer(c.coord.headers, rv.afficheId, false)
    expect(r.statusCode).toBe(200)
    expect(r.json<{ message: string }>().message).toContain('À confirmer : doute')
    expect(await affiche(rv.afficheId)).toMatchObject({
      validationAdmin: false,
      validationAdminParId: null,
      validationAdminLe: null,
      validationAnnulee: true,
    })
    expect((await fiche(c)).affiches[0]).toMatchObject({
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['ANNULEE'],
      estAssociee: false,
    })
    expect((await journal(rv.afficheId)).at(-1)).toMatchObject({
      action: 'ANNULATION_VALIDATION_ADMIN',
      nouvelleValeur: `validation annulée par ${c.coord.user.nom ?? c.coord.user.identifiantExterne}`,
    })
  })

  it('RG-COO-014 rejet : affiche non validée → 409, rien n’est écrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const avant = await affiche(rv.afficheId)
    const r = await changer(c.coord.headers, rv.afficheId, false)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-014' })
    expect((await affiche(rv.afficheId)).version).toBe(avant.version)
  })

  it('RG-COO-014 l’annulation est possible quel que soit le statut du dossier, de la prépa ou de l’Instruction OK', async () => {
    const c = await contexte('PREPARATION_RECUE')
    await f.createInstruction(db, {
      dossierId: c.dossier.id,
      contNum: c.dossier.contNum,
      statut: 'INSTRUCTION_OK',
    })
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    expect((await changer(c.coord.headers, rv.afficheId, false)).statusCode).toBe(200)
  })

  it('RG-X-050 l’annulation ne crée aucun mouvement de stock et ne change pas le statut de la palette', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 5)
    await changer(c.coord.headers, rv.afficheId, true)
    const mvts = await db.mouvement.count({ where: { afficheId: rv.afficheId } })
    const palette = await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })
    await changer(c.coord.headers, rv.afficheId, false)
    expect(await db.mouvement.count({ where: { afficheId: rv.afficheId } })).toBe(mvts)
    const apres = await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })
    expect(apres.statut).toBe(palette.statut)
    expect(apres.version).toBe(palette.version)
  })

  it('RG-X-050 l’annulation retire les effets de lecture : « à traiter », • au lieu de ✓, n° masqué, plus « associée »', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2, { source: 'PREPA' })
    await changer(c.coord.headers, rv.afficheId, true)
    let l = (await fiche(c)).lignes[0]
    expect(l?.affiches).toEqual([{ id: rv.afficheId, marque: '✓' }])
    expect(l?.numerosSuiviProd).toEqual([rv.afficheId])
    await changer(c.coord.headers, rv.afficheId, false)
    l = (await fiche(c)).lignes[0]
    expect(l?.affiches).toEqual([{ id: rv.afficheId, marque: '•' }])
    expect(l?.numerosSuiviProd).toEqual([])
    const liste = ListeAffichesSchema.parse(
      (
        await get(ctx, `/api/affiches?aTraiter=oui&dossier=${String(c.dossier.contNum)}`, c.headers)
      ).json(),
    )
    expect(liste.items.map((x) => x.id)).toEqual([rv.afficheId])
  })

  it('RG-COO-015 une reconfirmation par une autre personne la trace à son nom', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    await changer(c.coord.headers, rv.afficheId, false)
    const admin = await autre(ctx, c.plateforme.id, ['admin'])
    await changer(admin.headers, rv.afficheId, true)
    expect((await affiche(rv.afficheId)).validationAdminParId).toBe(admin.user.id)
    const fa = FicheAfficheSchema.parse(
      (await get(ctx, `/api/affiches/${String(rv.afficheId)}`, c.coord.headers)).json(),
    )
    expect(fa.validation.par).toBe(admin.user.nom ?? admin.user.identifiantExterne)
  })

  it('RG-COO-015 rejet : aucun acteur automatique n’écrit de validation (journal de validation toujours nominatif)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    expect(
      await db.journalAudit.count({ where: { action: 'VALIDATION_ADMIN', parId: null } }),
    ).toBe(0)
  })
})

describe('RG-COO-021 à 026 effets de la validation', () => {
  it('RG-COO-021 n° d’affiche au suivi de prod : validée ET ligne de source PREPA', async () => {
    const c = await contexte()
    const prepa = await recevoir(c, 2, { source: 'PREPA' })
    await recevoir(c, 2, { source: 'BC', theme: 'Autre' })
    expect((await fiche(c)).lignes.flatMap((l) => l.numerosSuiviProd)).toEqual([])
    await post(ctx, '/api/coordination/validation-admin', c.coord.headers, {
      dossierIds: [c.dossier.id],
    })
    expect((await fiche(c)).lignes.flatMap((l) => l.numerosSuiviProd)).toEqual([prepa.afficheId])
  })

  it('RG-COO-021 rejet : une affiche non validée n’expose pas son n° (fonction pure)', () => {
    expect(numeroVisibleSuiviProd({ validee: false, sources: ['PREPA'] })).toBe(false)
    expect(numeroVisibleSuiviProd({ validee: true, sources: ['BC'] })).toBe(false)
    expect(numeroVisibleSuiviProd({ validee: true, sources: ['PREPA'] })).toBe(true)
  })

  it('RG-COO-022 picking : seule une affiche validée figure à l’édition ; l’annulation l’en retire', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const jour = a.dateEntree.toISOString().slice(0, 10)
    const picking = async () =>
      (
        await get(
          ctx,
          `/api/edition-picking?plateformeId=${String(c.plateforme.id)}&du=${jour}&au=${jour}`,
          c.headers,
        )
      )
        .json<{ lignes: { afficheId: number }[] }>()
        .lignes.map((x) => x.afficheId)
    expect(await picking()).not.toContain(a.id)
    await changer(c.coord.headers, a.id, true)
    expect(await picking()).toContain(a.id)
    await changer(c.coord.headers, a.id, false)
    expect(await picking()).not.toContain(a.id)
  })

  it('RG-COO-023 / RG-REC-089 étiquette rack : posée à la validation, groupée par plateforme, levée à l’impression', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const lire = async () =>
      EtiquettesRackSchema.parse(
        (await get(ctx, '/api/coordination/etiquettes-rack', c.coord.headers)).json(),
      ).groupes
    expect(await lire()).toEqual([
      { plateformeId: c.plateforme.id, plateforme: c.plateforme.nom, afficheIds: [rv.afficheId] },
    ])
    const imp = await post(ctx, '/api/impressions', c.headers, {
      afficheIds: [rv.afficheId],
      contenu: 'ETIQUETTE_RACK',
      exemplaires: 1,
    })
    expect(imp.statusCode).toBe(200)
    expect(await lire()).toEqual([])
  })

  it('RG-COO-023 rejet : aucune étiquette au décochage ; une nouvelle validation en redemande une', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    await post(ctx, '/api/impressions', c.headers, {
      afficheIds: [rv.afficheId],
      contenu: 'ETIQUETTE_RACK',
      exemplaires: 1,
    })
    await changer(c.coord.headers, rv.afficheId, false)
    expect((await affiche(rv.afficheId)).etiquetteRackAImprimer).toBe(false)
    await changer(c.coord.headers, rv.afficheId, true)
    expect((await affiche(rv.afficheId)).etiquetteRackAImprimer).toBe(true)
  })

  it('RG-COO-023 l’agent de réception de la plateforme voit et imprime les étiquettes de son périmètre', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const ailleurs = await site(ctx, ['recep'])
    const lire = async (h: Record<string, string>) =>
      EtiquettesRackSchema.parse((await get(ctx, '/api/coordination/etiquettes-rack', h)).json())
        .groupes
    expect((await lire(c.headers)).flatMap((g) => g.afficheIds)).toEqual([rv.afficheId])
    expect((await lire(ailleurs.headers)).flatMap((g) => g.afficheIds)).not.toContain(rv.afficheId)
  })

  it.each<[Role]>([['expe'], ['com']])(
    'RG-COO-023 rejet : le profil %s ne lit pas les étiquettes rack (403)',
    async (role) => {
      const c = await contexte()
      const u = await autre(ctx, c.plateforme.id, [role])
      const r = await get(ctx, '/api/coordination/etiquettes-rack', u.headers)
      expect(r.statusCode).toBe(403)
      expect(erreur(r).regle).toBe('RG-COO-023')
    },
  )

  it('RG-COO-024 « reçue et associée » : vrai seulement liée ET validée', async () => {
    expect(estAssociee({ liensActifs: 1, validee: true })).toBe(true)
    expect(estAssociee({ liensActifs: 1, validee: false })).toBe(false)
    expect(estAssociee({ liensActifs: 0, validee: true })).toBe(false)
    const c = await contexte()
    const rv = await recevoir(c, 2)
    expect((await fiche(c)).affiches[0]?.estAssociee).toBe(false)
    await changer(c.coord.headers, rv.afficheId, true)
    expect((await fiche(c)).affiches[0]?.estAssociee).toBe(true)
  })

  it('RG-COO-025 une affiche validée sort de « à traiter » (Réception) ; rejet : non validée y reste', async () => {
    expect(aTraiter({ rebus: false, fusionnee: false, validee: true, liensActifs: 0 })).toBe(true)
    expect(aTraiter({ rebus: true, fusionnee: false, validee: false, liensActifs: 1 })).toBe(false)
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const lire = async () =>
      ListeAffichesSchema.parse(
        (
          await get(
            ctx,
            `/api/affiches?aTraiter=oui&dossier=${String(c.dossier.contNum)}`,
            c.headers,
          )
        ).json(),
      ).items.map((x) => x.id)
    expect(await lire()).toEqual([rv.afficheId])
    await changer(c.coord.headers, rv.afficheId, true)
    expect(await lire()).toEqual([])
  })

  it('RG-COO-026 état des réservations : « • » dès la réception, « ✓ » après validation ; rejet : jamais « non reçue » une fois reçue', async () => {
    expect(marqueEtatReservations(false)).toBe('•')
    const c = await contexte()
    const rv = await recevoir(c, 2)
    expect((await fiche(c)).lignes[0]?.affiches).toEqual([{ id: rv.afficheId, marque: '•' }])
    await changer(c.coord.headers, rv.afficheId, true)
    expect((await fiche(c)).lignes[0]?.affiches).toEqual([{ id: rv.afficheId, marque: '✓' }])
  })
})

describe('RG-COO-027 / 028 gardes négatives (option A du 02/11)', () => {
  it('RG-COO-027 aucun code de production (UM, répartition, colis) ne lit la validation admin', () => {
    const racine = resolve(import.meta.dirname, '../../src/modules')
    const fichiers = readdirSync(racine, { recursive: true, encoding: 'utf8' })
      .filter((p) => p.endsWith('.ts') && !p.endsWith('.test.ts'))
      .map((p) => readFileSync(resolve(racine, p), 'utf8'))
    const production = fichiers.filter((s) =>
      /uniteManutention\.(create|update)|repartition\.(create|update)/.test(s),
    )
    for (const s of production) expect(s).not.toMatch(/validationAdmin/)
  })

  it('RG-COO-028 l’arrivée de la prépa ne valide aucune affiche reçue (reste « à confirmer »)', async () => {
    const c = await contexte('A_TRAITER')
    const rv = await recevoir(c, 2)
    await withTransaction(db, (tx) => integrerPreparation(tx, c.dossier.contNum))
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
    expect((await fiche(c)).affiches[0]?.etat).toBe('A_CONFIRMER_PROPOSE')
  })
})

describe('RG-COO-029 fusion (non reprise, Q-100)', () => {
  it('RG-COO-029 une affiche cible d’une fusion héritée ne se valide pas (lecture seule, 409 RG-REC-169)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const chapeau = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      statut: 'IDENTIFIEE',
    })
    await f.createFusionAffiche(db, { afficheChapeauId: chapeau.id, afficheId: rv.afficheId })
    const r = await changer(c.coord.headers, rv.afficheId, true)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-REC-169')
  })
})

describe('RG-COO-030 / 031 / 032 ligne modifiée après la validation (par les vrais déclencheurs)', () => {
  async function validee(c: Ctx, data: Parameters<typeof f.createReceptionAttendue>[1] = {}) {
    const rv = await recevoir(c, 2, data)
    await changer(c.coord.headers, rv.afficheId, true)
    return rv
  }
  const alertes = () => withTransaction(db, (tx) => alertesValidation(tx, null))

  it('RG-COO-030 prépa intégrée avec un thème différent : validation à refaire (motif THEME), feuille à refaire, alerte', async () => {
    const c = await contexte()
    const rv = await validee(c)
    await withTransaction(db, (tx) =>
      integrerPreparation(tx, c.dossier.contNum, [
        { ligneAttendueId: rv.ligne.id, theme: 'Nouveau' },
      ]),
    )
    expect(await affiche(rv.afficheId)).toMatchObject({
      validationAdmin: false,
      themeModifie: true,
      feuilleARefaire: true,
    })
    expect((await fiche(c)).affiches[0]?.etat).toBe('A_CONFIRMER_DOUTE')
    expect((await fiche(c)).affiches[0]?.motifs).toContain('THEME')
    expect((await journal(rv.afficheId)).at(-1)?.nouvelleValeur).toContain(
      'validation à refaire (thème modifié',
    )
    expect(
      (await alertes()).filter((a) => a.afficheId === rv.afficheId).map((a) => a.type),
    ).toEqual(['THEME_MODIFIE'])
    // Reconfirmation : motif et alerte effacés.
    await changer(c.coord.headers, rv.afficheId, true)
    expect((await affiche(rv.afficheId)).themeModifie).toBe(false)
    expect((await alertes()).filter((a) => a.afficheId === rv.afficheId)).toEqual([])
  })

  it('RG-COO-030 rejet : prépa intégrée avec le même thème → la validation reste', async () => {
    const c = await contexte()
    const rv = await validee(c)
    await withTransaction(db, (tx) =>
      integrerPreparation(tx, c.dossier.contNum, [
        { ligneAttendueId: rv.ligne.id, theme: 'Thème A' },
      ]),
    )
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
  })

  it('RG-COO-031 prépa intégrée avec une autre quantité : la validation reste, alerte « écart » calculable', async () => {
    const c = await contexte()
    const rv = await validee(c, { source: 'PREPA', qteBc: 10 })
    await withTransaction(db, (tx) =>
      integrerPreparation(tx, c.dossier.contNum, [{ ligneAttendueId: rv.ligne.id, qtePrepa: 7 }]),
    )
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
    expect(
      (await alertes()).filter((a) => a.afficheId === rv.afficheId).map((a) => a.type),
    ).toEqual(['ECART_QUANTITE'])
  })

  it('RG-COO-031 « Appliquer la version Broadcast » change la quantité : la validation reste, plus d’écart', async () => {
    const c = await contexte('PREPARATION_RECUE')
    const rv = await validee(c, { qteBc: 10, qtePrepa: 8 })
    const r = await post(
      ctx,
      `/api/coordination/dossiers/${String(c.dossier.id)}/version-broadcast`,
      c.coord.headers,
      { version: (await db.dossier.findUniqueOrThrow({ where: { id: c.dossier.id } })).version },
    )
    expect(r.statusCode).toBe(200)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: rv.ligne.id } })).qtePrepa,
    ).toBe(10)
    expect((await alertes()).filter((a) => a.afficheId === rv.afficheId)).toEqual([])
  })

  it('RG-COO-032 dossier annulé : lien et validation conservés, alerte « ligne annulée », affiche à re-rattacher', async () => {
    const c = await contexte()
    const rv = await validee(c)
    await withTransaction(db, (tx) => annulerDossier(tx, c.dossier.contNum))
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
    expect(
      await db.afficheAttendue.count({ where: { afficheId: rv.afficheId, actif: true } }),
    ).toBe(1)
    expect((await fiche(c)).aReRattacher).toEqual([{ afficheId: rv.afficheId, theme: 'Thème A' }])
    expect(
      (await alertes()).filter((a) => a.afficheId === rv.afficheId).map((a) => a.type),
    ).toEqual(['LIGNE_ANNULEE'])
  })

  it('RG-COO-032 rejet : un dossier annulé sans affiche reçue ne lève aucune alerte', async () => {
    const c = await contexte()
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    await withTransaction(db, (tx) => annulerDossier(tx, c.dossier.contNum))
    expect((await alertes()).filter((a) => a.ligneAttendueId === l.id)).toEqual([])
    expect((await fiche(c)).aReRattacher).toEqual([])
  })

  // HYPOTHÈSE Q-186 (13) (audit COO-P04, 2e passe) : une ligne fermée est ignorée et tracée, la prépa est intégrée.
  it('RG-COO-030 rejet : une ligne fermée n’est pas mise à jour par la prépa (ignorée, tracée), validation intacte', async () => {
    const c = await contexte()
    const rv = await validee(c)
    await db.receptionAttendue.update({
      where: { id: rv.ligne.id },
      data: { etatLigne: 'ANNULEE' },
    })
    const r = await withTransaction(db, (tx) =>
      integrerPreparation(tx, c.dossier.contNum, [{ ligneAttendueId: rv.ligne.id, theme: 'Z' }]),
    )
    expect(r).toBe('PREPARATION_RECUE')
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: rv.ligne.id } })).theme,
    ).toBe('Thème A')
  })

  it('RG-COO-030 prépa avec une ligne fermée et une ligne active : prépa intégrée, ligne fermée inchangée et tracée, ligne active mise à jour', async () => {
    const c = await contexte()
    const ferme = await validee(c)
    const active = await validee(c, { theme: 'Thème B' })
    const avant = await db.receptionAttendue.findUniqueOrThrow({ where: { id: ferme.ligne.id } })
    await db.receptionAttendue.update({
      where: { id: ferme.ligne.id },
      data: { etatLigne: 'ANNULEE' },
    })
    await withTransaction(db, (tx) =>
      integrerPreparation(tx, c.dossier.contNum, [
        { ligneAttendueId: ferme.ligne.id, theme: 'Z', qtePrepa: 1 },
        { ligneAttendueId: active.ligne.id, qtePrepa: 4 },
      ]),
    )
    expect((await db.dossier.findUniqueOrThrow({ where: { id: c.dossier.id } })).statut).toBe(
      'PREPARATION_RECUE',
    )
    const apres = await db.receptionAttendue.findUniqueOrThrow({ where: { id: ferme.ligne.id } })
    expect({ theme: apres.theme, qtePrepa: apres.qtePrepa }).toEqual({
      theme: avant.theme,
      qtePrepa: avant.qtePrepa,
    })
    expect(
      await db.journalAudit.findFirst({
        where: {
          typeEntite: 'LIGNE_ATTENDUE',
          entiteId: String(ferme.ligne.id),
          action: 'RENVOI_BROADCAST_IGNORE',
        },
      }),
    ).toMatchObject({
      nouvelleValeur: 'ligne fermée : mise à jour ignorée',
      complement: 'Préparation',
    })
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: active.ligne.id } })).qtePrepa,
    ).toBe(4)
  })

  it('RG-COO-030 rejet : un thème qui ne change que par la casse, les accents ou les espaces ne défait pas la validation', async () => {
    const c = await contexte()
    const rv = await validee(c)
    await withTransaction(db, (tx) =>
      integrerPreparation(tx, c.dossier.contNum, [
        { ligneAttendueId: rv.ligne.id, theme: '  thème   a ' },
      ]),
    )
    expect(await affiche(rv.afficheId)).toMatchObject({
      validationAdmin: true,
      themeModifie: false,
    })
  })
})

describe('RG-COO-017 / RG-COO-018 / RG-X-051 / RG-X-014 rattachement d’une réception inconnue', () => {
  async function inconnue(c: Ctx) {
    const r = await post(ctx, '/api/receptions-inconnues', c.headers, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      annonceur: 'Lu sur affiche',
      theme: 'Description',
      imprimeurId: null,
      quantite: 12,
      allee: 'x',
      rayon: '4',
      photoAfficheId: null,
      photoBlId: await photo(ctx, c.headers),
      sansBl: false,
      numeroBl: 'BL-INC',
    })
    if (r.statusCode !== 201) throw new Error(r.body)
    return InconnueCreeeSchema.parse(r.json())
  }

  it('RG-X-051 / RG-COO-017 par la Coordination : liens, VALIDEE (mode MAIN), IDENTIFIEE, palette dans le sas, annonceur du dossier, étiquette rack, alerte levée — une transaction', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      annonceur: 'VRAI',
      theme: 'Vrai thème',
    })
    const a = await affiche(inc.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattacher-inconnue`, c.coord.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 12 }],
    })
    expect(r.statusCode).toBe(200)
    expect(r.json<{ message: string }>().message).toBe(
      `Affiche ${String(a.id)} rattachée. La palette R${String(inc.receptionId)} passe dans le sas de Réception des affiches : la réception valide le contrôle et imprime la feuille définitive.`,
    )
    expect(await affiche(a.id)).toMatchObject({
      statut: 'IDENTIFIEE',
      validationAdmin: true,
      validationAdminParId: c.coord.user.id,
      contAnnonc: 'VRAI',
      feuilleARefaire: true,
      etiquetteRackAImprimer: true,
    })
    expect(
      await db.afficheAttendue.findMany({ where: { afficheId: a.id, actif: true } }),
    ).toMatchObject([{ mode: 'MAIN', quantite: 12 }])
    expect((await db.reception.findUniqueOrThrow({ where: { id: inc.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
    const { alertes } = AlertesSchema.parse(
      (await get(ctx, '/api/alertes/reception', c.coord.headers)).json(),
    )
    expect(alertes.map((x) => x.cle)).not.toContain(`RG-REC-185:${String(inc.receptionId)}`)
    expect((await fiche(c)).affiches[0]?.etat).toBe('VALIDEE')
  })

  it('RG-COO-017 / RG-COO-018 rejet : rattachée par l’agent de réception → « À confirmer : doute », motif BL, mode MAIN', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: 'Description',
    })
    const a = await affiche(inc.afficheId)
    await post(ctx, `/api/affiches/${String(a.id)}/rattacher-inconnue`, c.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 12 }],
    })
    expect(await affiche(a.id)).toMatchObject({
      validationAdmin: false,
      etiquetteRackAImprimer: false,
    })
    expect((await fiche(c)).affiches[0]).toMatchObject({ etat: 'A_CONFIRMER_DOUTE' })
    expect((await fiche(c)).affiches[0]?.motifs).toContain('BL')
  })

  it('RG-X-051 rejet : répartition > quantité reçue → 422, rien n’est écrit (ni lien, ni validation, ni palette)', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a = await affiche(inc.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattacher-inconnue`, c.coord.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 13 }],
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).message).toBe('La répartition (13) dépasse la quantité reçue (12).')
    expect(await affiche(a.id)).toMatchObject({ validationAdmin: false, statut: 'ORPHELINE' })
    expect(await db.afficheAttendue.count({ where: { afficheId: a.id } })).toBe(0)
    expect((await db.reception.findUniqueOrThrow({ where: { id: inc.receptionId } })).statut).toBe(
      'A_IDENTIFIER',
    )
  })

  it('RG-X-051 rejet : réception pas dans l’état requis (affiche déjà rattachée) → 409', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattacher-inconnue`, c.coord.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: rv.ligne.id, quantite: 1 }],
    })
    expect(r.statusCode).toBe(409)
    expect((await affiche(a.id)).validationAdmin).toBe(false)
  })
})

describe('RG-X-052 / RG-X-058 / RG-X-015 rattachements manuels depuis la fiche affiche', () => {
  it('RG-X-052 la Coordination rattache le surplus d’une affiche validée à un autre dossier : nouveau lien MAIN, validation conservée', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 10, { qteBc: 6 })
    await changer(c.coord.headers, rv.afficheId, true)
    const autreDossier = await f.createDossier(db)
    const l2 = await ligne(ctx, c.plateforme.id, {
      contNum: autreDossier.contNum,
      supportId: c.support.id,
    })
    // Le lien d'origine porte toute la quantité reçue : on le réduit pour libérer le surplus.
    await db.afficheAttendue.updateMany({
      where: { afficheId: rv.afficheId },
      data: { quantite: 6 },
    })
    const a = await affiche(rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattachements`, c.coord.headers, {
      version: a.version,
      ligneAttendueId: l2.id,
      quantite: 4,
    })
    expect(r.statusCode).toBe(200)
    expect(await affiche(a.id)).toMatchObject({ validationAdmin: true, feuilleARefaire: true })
    expect(
      await db.afficheAttendue.findMany({
        where: { afficheId: a.id, actif: true },
        orderBy: { id: 'asc' },
      }),
    ).toMatchObject([{ quantite: 6 }, { quantite: 4, mode: 'MAIN' }])
  })

  it('RG-X-052 rejet : la répartition dépasse la quantité reçue → 422, rien n’est écrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 10)
    await changer(c.coord.headers, rv.afficheId, true)
    const l2 = await ligne(ctx, c.plateforme.id, {
      contNum: (await f.createDossier(db)).contNum,
      supportId: c.support.id,
    })
    const a = await affiche(rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattachements`, c.coord.headers, {
      version: a.version,
      ligneAttendueId: l2.id,
      quantite: 1,
    })
    expect(r.statusCode).toBe(422)
    expect(await db.afficheAttendue.count({ where: { afficheId: a.id, actif: true } })).toBe(1)
    expect((await affiche(a.id)).validationAdmin).toBe(true)
  })

  it('RG-X-058 la Coordination retire le dernier dossier : orpheline, palette « À identifier », validation caduque, AFFICHE_DISSOCIER', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, actif: true },
    })
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, c.coord.headers, {
      lienVersion: lien.version,
    })
    expect(r.statusCode).toBe(200)
    expect(await affiche(rv.afficheId)).toMatchObject({
      statut: 'ORPHELINE',
      validationAdmin: false,
    })
    expect((await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })).statut).toBe(
      'A_IDENTIFIER',
    )
    const actions = (await journal(rv.afficheId)).map((j) => j.action)
    expect(actions).toContain('AFFICHE_DISSOCIER')
    expect(actions.at(-2)).toBe('ANNULATION_VALIDATION_ADMIN')
  })

  it('RG-X-058 rejet : un lien déjà retiré ne se retire pas une seconde fois (409)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId: rv.afficheId } })
    await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, c.coord.headers, {
      lienVersion: lien.version,
    })
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, c.coord.headers, {
      lienVersion: lien.version + 1,
    })
    expect(r.statusCode).toBe(409)
  })

  it('RG-X-015 « Valider » / « Annuler la validation » depuis la fiche affiche : mêmes effets (étiquette rack, motif ANNULEE)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    expect(
      (
        await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, c.coord.headers, {
          version: a.version,
          valider: true,
        })
      ).statusCode,
    ).toBe(200)
    expect(await affiche(a.id)).toMatchObject({
      validationAdmin: true,
      etiquetteRackAImprimer: true,
    })
    const b = await affiche(a.id)
    await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, c.coord.headers, {
      version: b.version,
      valider: false,
    })
    expect((await fiche(c)).affiches[0]).toMatchObject({
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['ANNULEE'],
    })
  })

  it('RG-X-015 rejet : l’agent de réception ne valide pas depuis la fiche affiche (403)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, c.headers, {
      version: a.version,
      valider: true,
    })
    expect(r.statusCode).toBe(403)
    expect((await affiche(a.id)).validationAdmin).toBe(false)
  })
})

describe('RG-X-001 libellé d’historique de la proposition', () => {
  it('RG-X-001 la réception par le BL écrit « Rattachement proposé par Circé (automatique), à confirmer par la Coordination »', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const fa = FicheAfficheSchema.parse(
      (await get(ctx, `/api/affiches/${String(rv.afficheId)}`, c.coord.headers)).json(),
    )
    expect(fa.historique.find((h) => h.action === 'AFFICHE_ASSOCIER')?.nouveau).toContain(
      'Rattachement proposé par Circé (automatique), à confirmer par la Coordination',
    )
  })
})

describe('Audit COO-P04 : compléments', () => {
  it('RG-COO-029 / RG-COO-010 « Valider la sélection » : une cible de fusion héritée est ignorée et listée (FUSIONNEE), les autres sont confirmées', async () => {
    const c = await contexte()
    const fusionnee = await recevoir(c, 2)
    const autreAffiche = await recevoir(c, 2, { theme: 'Thème B' })
    const chapeau = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      statut: 'IDENTIFIEE',
    })
    await f.createFusionAffiche(db, {
      afficheChapeauId: chapeau.id,
      afficheId: fusionnee.afficheId,
    })
    const r = await post(ctx, '/api/coordination/validation-admin', c.coord.headers, {
      dossierIds: [c.dossier.id],
    })
    expect(r.statusCode).toBe(200)
    const res = r.json<{
      confirmees: { id: number }[]
      ignorees: { id: number; raison: string }[]
    }>()
    expect(res.confirmees.map((x) => x.id)).toEqual([autreAffiche.afficheId])
    expect(res.ignorees).toEqual([{ id: fusionnee.afficheId, raison: 'FUSIONNEE' }])
    expect((await affiche(fusionnee.afficheId)).validationAdmin).toBe(false)
  })

  it('RG-COO-029 / RG-COO-013 rejet : un lot qui ne contient qu’une cible de fusion héritée → 422 rien à valider, rien n’est écrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const chapeau = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      statut: 'IDENTIFIEE',
    })
    await f.createFusionAffiche(db, { afficheChapeauId: chapeau.id, afficheId: rv.afficheId })
    const r = await post(ctx, '/api/coordination/validation-admin', c.coord.headers, {
      dossierIds: [c.dossier.id],
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-013')
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
  })

  it('RG-COO-015 / RG-X-052 un rattachement par un autre coordinateur ne réécrit pas par / le d’une affiche déjà validée', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 10, { qteBc: 6 })
    await changer(c.coord.headers, rv.afficheId, true)
    const avant = await affiche(rv.afficheId)
    await db.afficheAttendue.updateMany({
      where: { afficheId: rv.afficheId },
      data: { quantite: 6 },
    })
    const l2 = await ligne(ctx, c.plateforme.id, {
      contNum: (await f.createDossier(db)).contNum,
      supportId: c.support.id,
    })
    const coord2 = await autre(ctx, c.plateforme.id, ['coord'])
    const r = await post(
      ctx,
      `/api/affiches/${String(rv.afficheId)}/rattachements`,
      coord2.headers,
      {
        version: (await affiche(rv.afficheId)).version,
        ligneAttendueId: l2.id,
        quantite: 4,
      },
    )
    expect(r.statusCode).toBe(200)
    expect(r.json<{ message: string }>().message).toMatch(
      /rattachée au dossier \d+ : feuille de stock à refaire \(tag « Feuille à refaire »\) ; validation admin faite\.$/,
    )
    const apres = await affiche(rv.afficheId)
    expect(apres.validationAdminParId).toBe(c.coord.user.id)
    expect(apres.validationAdminLe?.getTime()).toBe(avant.validationAdminLe?.getTime())
  })

  it('RG-X-052 par l’agent de réception : message « la Coordination confirmera la validation admin. »', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 10, { qteBc: 6 })
    await db.afficheAttendue.updateMany({
      where: { afficheId: rv.afficheId },
      data: { quantite: 6 },
    })
    const l2 = await ligne(ctx, c.plateforme.id, {
      contNum: (await f.createDossier(db)).contNum,
      supportId: c.support.id,
    })
    const r = await post(ctx, `/api/affiches/${String(rv.afficheId)}/rattachements`, c.headers, {
      version: (await affiche(rv.afficheId)).version,
      ligneAttendueId: l2.id,
      quantite: 4,
    })
    expect(r.json<{ message: string }>().message).toMatch(
      /la Coordination confirmera la validation admin\.$/,
    )
  })

  it('RG-X-015 / RG-COO-014 fiche affiche : historique « validation annulée par <nom> », 409 citant RG-COO-008 / 014', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const url = `/api/affiches/${String(rv.afficheId)}/validation-admin`
    const v = async () => (await affiche(rv.afficheId)).version
    expect(
      erreur(await post(ctx, url, c.coord.headers, { version: await v(), valider: false })).regle,
    ).toBe('RG-COO-014')
    await post(ctx, url, c.coord.headers, { version: await v(), valider: true })
    expect(
      erreur(await post(ctx, url, c.coord.headers, { version: await v(), valider: true })).regle,
    ).toBe('RG-COO-008')
    await post(ctx, url, c.coord.headers, { version: await v(), valider: false })
    expect((await journal(rv.afficheId)).at(-1)?.nouvelleValeur).toBe(
      `validation annulée par ${c.coord.user.nom ?? c.coord.user.identifiantExterne}`,
    )
  })

  it('RG-COO-007 / RG-REC-111 fiche affiche : une affiche IDENTIFIEE sans lien (réception inconnue calculée) ne se valide pas', async () => {
    const c = await contexte()
    const a = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      statut: 'IDENTIFIEE',
    })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, c.coord.headers, {
      version: a.version,
      valider: true,
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'REC_VALIDATION_A_RATTACHER', regle: 'RG-REC-111' })
  })

  it('RG-COO-009 message serveur du refus (maquette, reformulé)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const r = await changer(c.headers, rv.afficheId, true)
    expect(erreur(r).message).toBe(
      'Réservé à la Coordination : la validation admin est faite par les rôles Coordination et administrateur.',
    )
  })
})
