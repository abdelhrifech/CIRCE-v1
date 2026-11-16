import { expect, test } from '@playwright/test'

// COO-P06 — suivi des chargements Broadcast (RG-COO-116), passage manuel (RG-COO-103), « Rafraîchir un
// dossier » (RG-COO-132). Utilisateur e2e.coord. La liaison avec Broadcast n'est pas configurée (Q-005) :
// le passage manuel est réservé à l'administrateur ; le seed E2E a déposé un lot par la commande d'intégration
// (passage « Lot déposé » réussi).

test.describe.configure({ mode: 'serial' })

test('RG-COO-116 journal de chargement : passage du seed réussi, flux « État des réservations » en succès', async ({
  page,
}) => {
  await page.goto('/coordination/integration')
  const table = page.getByRole('table', { name: 'Passages d’intégration' })
  await expect(table).toBeVisible()
  const lot = table.getByRole('row', { name: /Lot déposé/ }).first()
  await expect(lot).toContainText('Succès')
  await expect(lot).toContainText('État des réservations')
  await expect(page.getByText(/planificateur inactif/)).toBeVisible()
})

test('RG-COO-103 passage manuel réservé à l’administrateur : bouton désactivé pour la Coordination', async ({
  page,
}) => {
  await page.goto('/coordination/integration')
  await expect(page.getByRole('table', { name: 'Passages d’intégration' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lancer un passage' })).toBeDisabled()
  await expect(
    page.getByText('Passage manuel réservé à l’administrateur (RG-COO-103).'),
  ).toBeVisible()
})

test('RG-COO-132 « Rafraîchir un dossier » : n° obligatoire, demande enregistrée', async ({
  page,
}) => {
  await page.goto('/coordination/integration')
  await expect(page.getByRole('table', { name: 'Passages d’intégration' })).toBeVisible()
  await page.getByRole('button', { name: 'Rafraîchir un dossier' }).click()
  await expect(page.getByRole('status')).toContainText('Saisissez un n° de dossier')
  // Dossier inconnu de Circé : refusé à un coordinateur de site (RG-COO-167, Q-188 (15)).
  await page.getByLabel('N° de dossier').fill('123456')
  await page.getByRole('button', { name: 'Rafraîchir un dossier' }).click()
  await expect(page.getByTestId('error-message')).toContainText('pas connu de Circé')
  // Dossier du périmètre (déposé par le seed) : demande enregistrée.
  await page.getByLabel('N° de dossier').fill('1900001')
  await page.getByRole('button', { name: 'Rafraîchir un dossier' }).click()
  await expect(page.getByRole('status')).toContainText('Dossier 1900001 : demande enregistrée')
})
