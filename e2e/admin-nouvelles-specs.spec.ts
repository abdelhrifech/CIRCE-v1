import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test('EX-NEW-PIL-001 les notes personnelles survivent au rechargement', async ({ page }) => {
  await page.goto('/pilotage/tableau')
  await page.getByLabel('Notes', { exact: true }).fill('Note fonctionnelle fictive E2E')
  await expect(page.getByRole('status')).toHaveText('Disposition enregistrée')
  await page.reload()
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue(
    'Note fonctionnelle fictive E2E',
  )
})

test('EX-NEW-ADM-001 import Excel, doublons normalisés, export XLSX et persistance des déclarants', async ({
  page,
}) => {
  await page.goto('/admin/declarants')
  const texte = page.getByLabel('Un déclarant par ligne')
  await expect(texte).toBeVisible()
  await page.getByLabel('Remplacer la liste lors de l’import').check()
  await page
    .getByLabel('Importer la première colonne')
    .setInputFiles(resolve(import.meta.dirname, 'fixtures/declarants-comprimes.xlsx'))
  await expect(texte).toHaveValue('Agent fictif Élodie\nAgent fictif Martin')
  await page.getByRole('button', { name: 'Enregistrer le référentiel' }).click()
  await page.reload()
  await expect(texte).toHaveValue('Agent fictif Élodie\nAgent fictif Martin')
  const telechargement = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter en Excel' }).click()
  expect((await telechargement).suggestedFilename()).toMatch(/\.xlsx$/)
})

test('EX-NEW-NAV-001 les cinq pages Bus sont accessibles et le contexte actif reste unique', async ({
  page,
}) => {
  for (const [tab, titre] of [
    ['suivi', 'Suivi de prod'],
    ['reception', 'Réceptions attendues'],
    ['atraiter', 'À traiter'],
    ['preparation', 'Préparation'],
    ['vue', 'Vue des réceptions'],
  ] as const) {
    await page.goto(`/bus?tab=${tab}`)
    await expect(page.getByRole('heading', { name: titre, exact: true })).toBeVisible()
    await expect(page.getByTestId('onglet-bus')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('error-message')).toHaveCount(0)
  }
})

test('EX-NEW-NC-001 les quatre entrées NC et les champs des formulaires sont disponibles', async ({
  page,
}) => {
  await page.goto('/non-conformite?tab=reception')
  await expect(page.getByRole('heading', { name: 'Nouvelle réception', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: /^Déclarant/ })).toBeVisible()
  await page.goto('/non-conformite?tab=declaration')
  await expect(page.getByRole('heading', { name: 'Nouvelle demande', exact: true })).toBeVisible()
  await expect(page.getByLabel('Date d’affichage *', { exact: true })).toBeVisible()
})
