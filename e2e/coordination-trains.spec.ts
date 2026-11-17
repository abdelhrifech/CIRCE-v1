import { expect, test, type Locator, type Page } from '@playwright/test'

// COO-P09 — Liste des trains (ECR-COO-05) : positions A reçu / B manquant, statut d'unité (RG-COO-208),
// fiche train (ECR-COO-05a), fractionner (RG-COO-221), raccrocher un visuel (RG-COO-222), pré-test
// (RG-COO-224). Utilisateur e2e.coord ; données : apps/api/scripts/e2e-seed.ts (site « TRN »).

test.describe.configure({ mode: 'serial' })

const table = (page: Page) => page.getByRole('table', { name: 'Trains' })

/** Choisit, dans une liste, la DERNIÈRE option contenant le texte (données du run courant). */
async function choisir(liste: Locator, texte: string) {
  const option = liste.locator('option', { hasText: texte }).last()
  await expect(option).toBeAttached()
  await liste.selectOption((await option.getAttribute('value')) ?? '')
}

test('RG-COO-208 / 228 liste filtrée par dossier : train EN_ATTENTE (A reçu, B manquant) et train PRÊT', async ({
  page,
}) => {
  await page.goto('/coordination/trains?dossier=2190101')
  await expect(page.getByRole('heading', { name: 'Déroulant · Liste des trains' })).toBeVisible()
  const attente = table(page).getByRole('row', { name: /E2E-FRAC-/ })
  await expect(attente).toHaveCount(2)
  await expect(attente.nth(0)).toContainText('En attente d’affiches')
  await expect(attente.nth(1)).toContainText('En attente d’affiches')
  await expect(attente.getByRole('button', { name: 'Position A reçu' })).toBeVisible()
  await expect(attente.getByRole('button', { name: 'Position B manquant' })).toBeVisible()
  await expect(table(page).getByRole('row', { name: /E2E-PRET-/ })).toContainText('Prêt à produire')
})

test('RG-COO-221 fiche train puis « Fractionner » : le train passe « Prêt », la position B est fractionnée', async ({
  page,
}) => {
  await page.goto('/coordination/trains?dossier=2190101')
  await table(page)
    .getByRole('row', { name: /E2E-FRAC-/ })
    .first()
    .getByText(/E2E-FRAC-/)
    .click()
  const fiche = page.getByRole('dialog', { name: /Train E2E-FRAC-/ })
  await expect(fiche.getByRole('table', { name: 'Positions du train' })).toContainText(
    'Thème manquant E2E',
  )
  await expect(fiche.getByRole('table', { name: 'Positions du train' })).toContainText('T-9')
  await fiche.getByRole('button', { name: 'Fractionner' }).click()
  await expect(page.getByRole('status')).toContainText(
    '1 train(s) fractionné(s) : ils passent « Prêt », les visuels manquants seront produits à part.',
  )
  const ligne = table(page).getByRole('row', { name: /E2E-FRAC-/ })
  await expect(ligne.first()).toContainText('Prêt à produire')
  await expect(ligne.getByRole('button', { name: 'Position B fractionné' })).toBeVisible()
})

test('RG-COO-222 « Raccrocher un visuel » au train prêt : une position B s’ajoute', async ({
  page,
}) => {
  await page.goto('/coordination/trains?dossier=2190101')
  await table(page)
    .getByRole('row', { name: /E2E-PRET-/ })
    .getByRole('checkbox')
    .check()
  await page.getByRole('button', { name: 'Raccrocher un visuel' }).click()
  const modale = page.getByRole('dialog', { name: /Raccrocher un visuel au train E2E-PRET-/ })
  await choisir(modale.getByLabel('Visuel'), 'Visuel à raccrocher E2E')
  await modale.getByRole('button', { name: 'Raccrocher' }).click()
  await expect(page.getByRole('status')).toContainText('1 train(s) ont reçu le visuel')
  await expect(
    table(page)
      .getByRole('row', { name: /E2E-PRET-/ })
      .getByRole('button', { name: /Position B/ }),
  ).toBeVisible()
})

test('RG-COO-224 rejet puis création d’un train de pré-test', async ({ page }) => {
  await page.goto('/coordination/trains?dossier=2190103')
  await expect(page.getByLabel('Indicateurs')).toBeVisible()
  const depart = await page.getByRole('form', { name: 'Filtres' }).getByLabel('Départ').inputValue()
  await page.getByRole('button', { name: 'Train de pré-test…' }).click()
  const modale = page.getByRole('dialog', { name: 'Créer un train de pré-test ou d’entretien' })
  await choisir(modale.getByLabel('Atelier'), 'Déroulant E2E')
  await modale.getByLabel('Départ').fill(depart)
  await modale.getByRole('button', { name: 'Créer' }).click()
  await expect(modale).toContainText('Choisissez un visuel et un destinataire.')
  await choisir(modale.getByLabel('Visuel'), 'Visuel à raccrocher E2E')
  await choisir(modale.getByLabel('Destinataire'), 'Destinataire E2E TRN')
  await modale.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('status')).toContainText('train(s) de pré-test créé(s) : TR-P')
  await expect(table(page).getByRole('row', { name: /TR-P/ })).toContainText('pré-test')
})
