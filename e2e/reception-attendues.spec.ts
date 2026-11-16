import { expect, test, type Page } from '@playwright/test'

/** Le tableau n'apparaît qu'après l'appel API côté navigateur : la page est alors hydratée. */
async function ouvrir(page: Page) {
  await page.goto('/reception')
  await expect(page.getByRole('table', { name: 'Réceptions attendues' })).toBeVisible()
}

// REC-P02 — ECR-REC-01 « Réceptions attendues » ; données : apps/api/scripts/e2e-seed.ts
// (utilisateur e2e.recep ; semaine courante : Alpha Attendue 0/10, Bêta Partielle 4/10, Gamma Complète 10/10 ;
// Delta Attendue il y a deux semaines ; 1 palette à contrôler). Statuts produits par les vrais services.

test('RG-REC-014 / RG-REC-016 affiche les lignes attendues du site, Attendue + Partielle par défaut', async ({
  page,
}) => {
  await page.goto('/reception')
  await expect(page.getByRole('heading', { name: 'Réception des affiches' })).toBeVisible()
  const tableau = page.getByRole('table', { name: 'Réceptions attendues' })
  await expect(tableau).toContainText('Annonceur Alpha')
  await expect(tableau).toContainText('Annonceur Bêta')
  await expect(tableau).not.toContainText('Annonceur Gamma')
  await expect(tableau.getByRole('row', { name: /Annonceur Alpha/ })).toContainText('0 / 10')
  await expect(tableau.getByRole('row', { name: /Annonceur Alpha/ })).toContainText('Attendue')
  await expect(page.getByText('2 ligne(s)')).toBeVisible()
})

test('RG-REC-010 le menu Réception affiche le badge des palettes à contrôler', async ({ page }) => {
  await page.goto('/reception')
  await expect(page.getByTestId('onglet-reception')).toContainText('1')
})

test('RG-REC-011 / RG-REC-012 recherche à la frappe : un dossier masqué par le filtre Statut est signalé, puis affiché', async ({
  page,
}) => {
  await ouvrir(page)
  await page.getByLabel('Par n° de dossier').fill('900003')
  await expect(page.getByTestId('recherche-masques')).toContainText('900003 : masqué par Statut')
  await expect(page.getByText('Aucune ligne pour ces filtres.')).toBeVisible()
  await page.getByRole('button', { name: 'Afficher' }).click()
  await expect(page.getByRole('table', { name: 'Réceptions attendues' })).toContainText(
    'Annonceur Gamma',
  )
  await expect(page.getByRole('table', { name: 'Réceptions attendues' })).toContainText('Complète')
})

test('RG-REC-012 une valeur recherchée sans aucune ligne est signalée comme absente', async ({
  page,
}) => {
  await ouvrir(page)
  await page.getByLabel('Par n° de dossier').fill('123456')
  await expect(page.getByTestId('recherche-absents')).toContainText('123456')
})

test('RG-REC-016 le filtre Statut à cocher pilote la liste', async ({ page }) => {
  await ouvrir(page)
  await page.getByRole('button', { name: /Filtre Statut/ }).click()
  await page.getByRole('checkbox', { name: /Partielle/ }).uncheck()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('table', { name: 'Réceptions attendues' })).not.toContainText(
    'Annonceur Bêta',
  )
  await expect(page.getByRole('table', { name: 'Réceptions attendues' })).toContainText(
    'Annonceur Alpha',
  )
})

test('une erreur de l’API est affichée avec son message et « Réessayer »', async ({ page }) => {
  await page.route('**/api/receptions-attendues**', (route) =>
    route.fulfill({
      status: 403,
      json: {
        code: 'REC_ACCES_REFUSE',
        message: "Vous n'avez pas le droit d'effectuer cette action.",
        regle: 'RG-REC-002',
      },
    }),
  )
  await page.goto('/reception')
  await expect(page.getByTestId('error-message')).toContainText('Action non autorisée')
  await expect(page.getByTestId('error-regle')).toHaveText('Règle : RG-REC-002')
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
})

test('RG-REC-017 / RG-REC-019 reçu, reste et contrôle issus des rattachements réels', async ({
  page,
}) => {
  await ouvrir(page)
  const beta = page
    .getByRole('table', { name: 'Réceptions attendues' })
    .getByRole('row', { name: /Annonceur Bêta/ })
  await expect(beta).toContainText('4 / 10')
  await expect(beta).toContainText('Partielle')
  await expect(beta).toContainText('À contrôler')
})

test('RG-REC-012 / RG-REC-015 une ligne d’une semaine passée, masquée par Départ, réapparaît avec « Afficher »', async ({
  page,
}) => {
  await ouvrir(page)
  await page.getByLabel('Par n° de dossier').fill('900004')
  await expect(page.getByTestId('recherche-masques')).toContainText('900004 : masqué par Départ')
  await page.getByRole('button', { name: 'Afficher' }).click()
  await expect(page.getByRole('table', { name: 'Réceptions attendues' })).toContainText(
    'Annonceur Delta',
  )
})

test('RG-REC-014 le sélecteur « Colonnes » fait apparaître une colonne masquée (DA)', async ({
  page,
}) => {
  await ouvrir(page)
  await expect(page.getByRole('columnheader', { name: 'DA' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Colonnes' }).click()
  await page.getByRole('checkbox', { name: 'DA' }).check()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('columnheader', { name: 'DA' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Réceptions attendues' })).toContainText('800001')
})

test('RG-REC-016 un filtre invalide est refusé par l’API (400) et l’erreur est affichée', async ({
  page,
}) => {
  await page.goto('/reception?statut=PERDUE')
  await expect(page.getByTestId('error-message')).toContainText('Saisie invalide')
  await expect(page.getByTestId('error-message')).toContainText('Statut de ligne inconnu')
})
