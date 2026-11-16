import { expect, test } from '@playwright/test'

// COO-P08 — Déblocage des préparations / « Rendre la main à la Pré-Prod » (RG-COO-140 à 152). Utilisateur
// e2e.coord ; données : apps/api/scripts/e2e-seed.ts (dossier 2190001 débloquable, 2190002 bloqué par une UM
// « Préparé »).

test.describe.configure({ mode: 'serial' })

test('RG-COO-140 sans critère : grille vide et message', async ({ page }) => {
  await page.goto('/coordination/deblocage')
  await expect(page.getByRole('heading', { name: 'Déblocage des préparations' })).toBeVisible()
  await expect(page.getByText('Saisissez un n° de préparation ou de dossier.')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Préparations débloquables' })).toHaveCount(0)
})

test('RG-COO-143 groupe avec une UM « Préparé » : « Rendre la main » désactivé, motif affiché', async ({
  page,
}) => {
  await page.goto('/coordination/deblocage')
  // Page hydratée (le suivi est chargé par l'API) avant de saisir le critère.
  await expect(page.getByText(/^Du \d{4}-\d{2}-\d{2} au/)).toBeVisible()
  await page.getByLabel('N° de dossier').fill('2190002')
  await page.getByRole('button', { name: 'Rechercher' }).click()
  const table = page.getByRole('table', { name: 'Préparations débloquables' })
  const ligne = table.getByRole('row', { name: /Annonceur Bloqué E2E/ })
  await expect(ligne).toContainText("Le groupe de preparation n'est pas déblocable !")
  await expect(ligne.getByRole('button', { name: 'Rendre la main' })).toBeDisabled()
})

test('RG-COO-145 / 151 / 149 « Rendre la main » : motif par défaut, confirmation, suivi des déblocages', async ({
  page,
}) => {
  await page.goto('/coordination/deblocage?dossier=2190001')
  const table = page.getByRole('table', { name: 'Préparations débloquables' })
  const ligne = table.getByRole('row', { name: /Annonceur Déblocage E2E/ })
  await expect(ligne).toContainText('Débloquable')
  await ligne.getByRole('button', { name: 'Rendre la main' }).click()
  const modale = page.getByRole('dialog', { name: 'Rendre la main à la Pré-Prod' })
  await expect(modale.getByLabel('Motif')).toHaveValue('Changement de visuel demandé par le client')
  await expect(modale).toContainText('2 ligne(s) de préparation non lancée(s) seront annulées')
  await modale.getByLabel('Motif').fill('Visuel refait E2E')
  await modale.getByRole('button', { name: 'Rendre la main' }).click()
  await expect(modale).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText(
    'Main rendue à la Pré-Prod pour le dossier 2190001',
  )
  await expect(ligne).toContainText('Main rendue')
  await expect(ligne.getByRole('button', { name: 'Rendre la main' })).toBeDisabled()
  const suivi = page.getByRole('table', { name: 'Déblocages' })
  await expect(suivi.getByRole('row', { name: /Visuel refait E2E/ }).first()).toContainText(
    '2190001',
  )
})
