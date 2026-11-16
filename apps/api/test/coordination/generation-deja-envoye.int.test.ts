// COO-P10 (audit B4) — tests d'INTÉGRATION : un train déjà envoyé à la machine ne peut pas repartir (RG-COO-217, Q-194).
// Depuis que l'envoi ne modifie plus les faces, le train reste « PRET » : c'est le lot « ENVOYE » (avec la version du
// train enregistrée au « Préparer ») qui fait de lui un train « déjà envoyé ». Un train dont la composition a changé
// depuis (autre version) est un autre fichier et peut repartir. Fichier de production réel (D-15) simulé.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { GenerationSchema, TrainsGenerationSchema } from '@circe/shared'
import { dbIdentityLoader } from '../../src/core/identity.ts'
import type { MachinePort } from '../../src/core/ports/machine.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import { envoyerGeneration } from '../../src/modules/coordination/generation-fichiers.ts'
import * as f from '../factories/index.ts'
import { contexteReception, erreur, get } from '../support/reception.ts'
import {
  DEPART_TXT,
  envoyer,
  recu,
  restaurerParametres,
  siteDeroulant,
  trainExportable,
  versions,
  type SiteD,
} from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
afterEach(restaurerParametres)

const site = () => siteDeroulant(ctx)
const preparer = async (s: SiteD, trainIds: string[]) =>
  envoyer(ctx, '/api/coordination/generateur', s.users.cheq.headers, {
    depart: DEPART_TXT,
    trains: await versions(ctx, s.users.coord.headers, trainIds),
  })
const envoi = (s: SiteD, id: number, version: number) =>
  envoyer(ctx, '/api/coordination/generateur/envoyer', s.users.cheq.headers, { id, version })
const pret = async (s: SiteD, themes: string[]) => {
  const t = await trainExportable(ctx, s, themes, { statut: 'A_IMPRIMER' })
  for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
  return t
}
const generateur = async (s: SiteD) =>
  TrainsGenerationSchema.parse(
    (
      await get(ctx, `/api/coordination/generateur?depart=${DEPART_TXT}`, s.users.cheq.headers)
    ).json(),
  )
const lotsDe = (trainId: string) =>
  db.generationFichiers.count({ where: { trains: { contains: trainId } } })

describe('RG-COO-217 / ECR-GEN-01 un train déjà envoyé à la machine (audit B4)', () => {
  it('RG-COO-217 nominal : après l’envoi, le train est « Déjà envoyé » et compté comme tel dans les indicateurs (et non plus « Prêt »)', async () => {
    const s = await site()
    const t = await pret(s, ['Rose'])
    const autre = await pret(s, ['Gris'])
    const avant = await generateur(s)
    expect(avant.trains.find((x) => x.trainId === t.trainId)?.statut).toBe('PRET')
    const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    // Préparé mais pas encore envoyé : toujours « Prêt ».
    expect((await generateur(s)).trains.find((x) => x.trainId === t.trainId)?.statut).toBe('PRET')
    expect((await envoi(s, g.id, g.version)).statusCode).toBe(200)
    const apres = await generateur(s)
    expect(apres.trains.find((x) => x.trainId === t.trainId)?.statut).toBe('DEJA_ENVOYE')
    expect(apres.trains.find((x) => x.trainId === autre.trainId)?.statut).toBe('PRET')
    expect(apres.indicateurs.dejaEnvoyes).toBeGreaterThanOrEqual(1)
    expect(apres.indicateurs.prets).toBe(avant.indicateurs.prets - 1)
    // Les faces n'ont pas bougé (audit B2) : c'est bien le lot qui porte l'information.
    expect(
      (await db.faceTrain.findUniqueOrThrow({ where: { id: t.faces[0]?.id ?? 0 } })).statut,
    ).toBe('A_IMPRIMER')
  })

  it('RG-COO-217 rejet : préparer de nouveau un train déjà envoyé : 409 COO_TRAIN_DEJA_ENVOYE (lot cité), aucun nouveau lot', async () => {
    const s = await site()
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    expect((await envoi(s, g.id, g.version)).statusCode).toBe(200)
    const r = await preparer(s, [t.trainId])
    expect(r.statusCode, r.body).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'COO_TRAIN_DEJA_ENVOYE', regle: 'RG-COO-217' })
    expect(erreur(r).message).toContain(g.lot)
    expect(await lotsDe(t.trainId)).toBe(1)
  })

  it('RG-COO-217 rejet : deux lots « Préparé » pour le même train ; le 2e envoi est refusé (409), le lot reste « Préparé », rien n’est remis à la machine', async () => {
    const s = await site()
    const t = await pret(s, ['Rose'])
    const g1 = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    const g2 = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    expect((await envoi(s, g1.id, g1.version)).statusCode).toBe(200)
    const r = await envoi(s, g2.id, g2.version)
    expect(r.statusCode, r.body).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'COO_TRAIN_DEJA_ENVOYE', regle: 'RG-COO-217' })
    const lot2 = await db.generationFichiers.findUniqueOrThrow({ where: { id: g2.id } })
    expect(lot2).toMatchObject({ statut: 'PREPARE', version: g2.version, machineEnvoi: null })
    // Test direct du service avec un port espion : le refus est avant l'envoi.
    const envois: string[] = []
    const espion: MachinePort = {
      nom: 'espion',
      envoyer: (fichier) => {
        envois.push(fichier.lot)
        return Promise.resolve()
      },
    }
    const charge = await dbIdentityLoader(db)(s.users.cheq.ext)
    if (!charge) throw new Error('identité introuvable')
    const identity = { ...charge, siteId: null }
    await expect(
      withTransaction(db, (tx) =>
        envoyerGeneration(tx, identity, { id: g2.id, version: g2.version }, espion),
      ),
    ).rejects.toMatchObject({ httpStatus: 409 })
    expect(envois).toEqual([])
  })

  it('RG-COO-217 nominal : un train dont la composition a changé depuis l’envoi (autre version) est un autre fichier : « Prêt » et préparable de nouveau', async () => {
    const s = await site()
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    expect((await envoi(s, g.id, g.version)).statusCode).toBe(200)
    // Le rouleur affecté (RG-COO-236) change la version du train.
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur B4' })
    expect(
      (
        await envoyer(ctx, '/api/coordination/trains/rouleur', s.users.cheq.headers, {
          trains: await versions(ctx, s.users.coord.headers, [t.trainId]),
          rouleurId: rouleur.id,
        })
      ).statusCode,
    ).toBe(200)
    expect((await generateur(s)).trains.find((x) => x.trainId === t.trainId)?.statut).toBe('PRET')
    const r = await preparer(s, [t.trainId])
    expect(r.statusCode, r.body).toBe(200)
    expect(await lotsDe(t.trainId)).toBe(2)
  })

  it('RG-COO-217 un train envoyé une semaine n’empêche pas un autre train de la même semaine d’être préparé', async () => {
    const s = await site()
    const envoye = await pret(s, ['Rose'])
    const libre = await pret(s, ['Gris'])
    const g = GenerationSchema.parse((await preparer(s, [envoye.trainId])).json())
    expect((await envoi(s, g.id, g.version)).statusCode).toBe(200)
    const r = await preparer(s, [libre.trainId])
    expect(r.statusCode, r.body).toBe(200)
    // Un lot qui mélange un train libre et un train déjà envoyé est refusé en entier (rien d'écrit).
    const avant = await db.generationFichiers.count()
    const melange = await preparer(s, [libre.trainId, envoye.trainId])
    expect(melange.statusCode).toBe(409)
    expect(erreur(melange).code).toBe('COO_TRAIN_DEJA_ENVOYE')
    expect(await db.generationFichiers.count()).toBe(avant)
  })
})
