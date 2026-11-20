import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { createDb, type Db } from '../apps/api/src/core/db.ts'
import * as f from '../apps/api/test/factories/index.ts'
let db: Db, numero: number, afficheId: number
const annonceur = `Fin campagne navigateur ${Date.now()}`
test.beforeAll(async () => {
  process.loadEnvFile(resolve('.env.test'))
  const url = process.env['DATABASE_URL'] ?? ''
  if (!url.endsWith('test.db')) throw new Error('Base de test obligatoire')
  db = createDb('file:' + resolve('apps/api', url.slice(5)))
  const site = await f.createPlateforme(db),
    support = await f.createSupport(db, { nom: '2 m² fixe' }),
    atelier = await f.createAtelier(db, { plateformeId: site.id })
  numero = 9500000 + Math.floor(Math.random() * 100000)
  const a = await f.createAffiche(db, {
    plateformeId: site.id,
    supportId: support.id,
    contNum: numero,
    contAnnonc: annonceur,
    theme: 'Visuel navigateur',
    quantite: 40,
  })
  afficheId = a.id
  await f.createMouvement(db, { afficheId: a.id, quantite: 40 })
  const l = await f.createReceptionAttendue(db, {
    plateformeId: site.id,
    supportId: support.id,
    atelierId: atelier.id,
    contNum: numero,
    annonceur,
    theme: 'Visuel navigateur',
    semAnnee: 2024,
    semNum: 3,
  })
  await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, quantite: 40 })
})
test.afterAll(async () => {
  await db.$disconnect()
})
test('EX-STK-NEW-001 stock, filtres et conservation réelle, sans toucher au parcours Réception', async ({
  page,
}) => {
  await page.goto(`/stocks?dossier=${numero}`)
  await expect(page.getByRole('heading', { name: 'Stock par affiche', exact: true })).toBeVisible()
  const table = page.getByRole('table', { name: 'Stock par affiche', exact: true }),
    ligne = table.getByRole('row').filter({ hasText: annonceur })
  await expect(ligne).toContainText('40')
  await ligne.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Marquer « à conserver »' }).click()
  const dialogue = page.getByRole('dialog', { name: 'Marquer les affiches à conserver' })
  await dialogue.getByRole('button', { name: 'Confirmer' }).click()
  await expect(page.getByRole('status')).toContainText('à conserver')
  await expect(ligne).toContainText('À conserver')
  expect((await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })).aConserver).toBe(true)
})
test('RG-STK-NEW-002 renvoi puis destruction exige confirmation et conserve les deux sorties', async ({
  page,
}) => {
  await page.goto(`/stocks/fin-campagne?dossier=${numero}`)
  const table = page.getByRole('table', { name: 'Fin de campagne', exact: true })
  await table
    .getByRole('row')
    .filter({ hasText: annonceur })
    .getByRole('button', { name: 'Décider…' })
    .click()
  let dialogue = page.getByRole('dialog', {
    name: new RegExp(`Fin de campagne · dossier ${numero}`),
  })
  await dialogue.getByLabel('Renvoyer, puis détruire le reste').check()
  await dialogue.getByLabel('Destinataire', { exact: true }).fill('Agence navigateur')
  await dialogue.getByLabel('Quantité à renvoyer').fill('10')
  await dialogue.getByRole('button', { name: 'Enregistrer la décision' }).click()
  await expect(dialogue).toHaveCount(0)
  await page.getByLabel('Décision', { exact: true }).selectOption('ENVOYER')
  await table
    .getByRole('row')
    .filter({ hasText: annonceur })
    .getByRole('button', { name: 'Renvoi fait' })
    .click()
  dialogue = page.getByRole('dialog', { name: 'Confirmer le renvoi' })
  await dialogue.getByRole('button', { name: 'Confirmer' }).click()
  await expect(page.getByRole('status')).toContainText('10 affiche(s) renvoyée(s)')
  await page.getByLabel('Décision', { exact: true }).selectOption('DETRUIRE')
  await table
    .getByRole('row')
    .filter({ hasText: annonceur })
    .getByRole('button', { name: 'Destruction faite…' })
    .click()
  dialogue = page.getByRole('dialog', { name: 'Confirmer la destruction' })
  await expect(dialogue.getByRole('button', { name: 'Confirmer' })).toBeDisabled()
  await dialogue.getByRole('checkbox').check()
  await dialogue.getByRole('button', { name: 'Confirmer' }).click()
  await expect(page.getByRole('status')).toContainText('30 affiche(s) détruite(s)')
  const mouvements = await db.mouvement.findMany({
    where: { afficheId, type: { in: ['RENVOI', 'DESTRUCTION'] } },
  })
  expect(mouvements.map((m) => m.quantite)).toEqual([-10, -30])
})
test('EX-ADM-NEW-001 les nouvelles rubriques administration et colis extérieurs chargent sans erreur', async ({
  page,
}) => {
  for (const [url, titre] of [
    ['/admin/machines', 'Machines et fichiers'],
    ['/admin/transport', 'Transport'],
    ['/admin/statuts', 'Statuts'],
    ['/admin/journal', 'Journal'],
    ['/admin/mails', 'Mails'],
    ['/admin/fin-campagne', 'Règles de fin de campagne'],
    ['/expedition/exterieur', 'Liste des colis (extérieur)'],
  ] as const) {
    await page.goto(url)
    await expect(page.getByRole('heading', { name: titre, exact: true })).toBeVisible()
    if (url === '/admin/fin-campagne')
      await expect(page.getByRole('button', { name: 'Enregistrer les paramètres' })).toBeVisible()
    else await expect(page.getByRole('table').first()).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveCount(0)
  }
})

test('EX-PIL-NEW-001 filtres cumulés du suivi et synthèse de production accessibles sans mutation', async ({
  page,
}) => {
  await page.goto(`/pilotage/suivi?dossier=${numero}`)
  const table = page.getByRole('table', { name: 'Suivi de prod', exact: true })
  const filtres = page.getByRole('group', { name: 'Filtres du suivi' })
  await expect(filtres.getByLabel('Dossier(s)', { exact: true })).toHaveValue(String(numero))
  await expect(table).toContainText(annonceur)
  await page
    .getByRole('group', { name: 'Filtres du suivi' })
    .getByLabel('Annonceur')
    .fill('Sans correspondance navigateur')
  await expect(table).not.toContainText(annonceur)
  await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click()
  await expect(table).toContainText(annonceur)
  await page.goto('/pilotage/analyse')
  await expect(
    page.getByRole('table', { name: 'Trains produits par rouleur', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('table', { name: 'Analyse des trains', exact: true })).toBeVisible()
  await expect(page.getByTestId('error-message')).toHaveCount(0)
})
