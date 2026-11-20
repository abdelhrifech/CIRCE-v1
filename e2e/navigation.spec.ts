import { expect, test, type Page } from '@playwright/test'

// ECR-NAV-01 / EX-TRA-008 : coque (deux bandeaux, pas de menu latéral), onglets à liste déroulante, site envoyé en
// en-tête x-site-id, profil de dev (cookie circe_dev_user), droits. Profils dev.<rôle> créés par e2e-seed.
// Serveur web du projet « reception » : identité par défaut e2e.recep.

/** Ouvre une page et attend l'hydratation de la coque (profil chargé) avant d'agir. */
async function ouvrir(page: Page, chemin: string) {
  await page.goto(chemin)
  await expect(page.getByTestId('shell-utilisateur')).toBeVisible()
}

async function profil(page: Page, identifiant: string) {
  await page.context().addCookies([
    {
      name: 'circe_dev_user',
      value: identifiant,
      url: page.url().startsWith('http') ? page.url() : 'http://127.0.0.1:3100',
    },
  ])
}

test('ECR-NAV-01 EX-TRA-008 la coque affiche deux bandeaux, sans menu latéral', async ({
  page,
}) => {
  await ouvrir(page, '/moi')
  const entete = page.getByRole('banner')
  await expect(entete.getByRole('link', { name: /Circé/ })).toBeVisible()
  await expect(page.getByTestId('shell-site')).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  for (const titre of [
    'Pilotage',
    'Réception',
    'Non-conformité',
    'Déroulant',
    '2 m² fixe',
    'Pliage',
    'Bus',
    'Expédition',
    'Administration',
  ])
    await expect(nav.getByRole('button', { name: new RegExp(`^${titre}`) })).toBeVisible()
  // Hors cible : « Simuler », « Besoins », « Aide »
  await expect(entete.getByText('Simuler')).toHaveCount(0)
  await expect(entete.getByText('Besoins')).toHaveCount(0)
  await expect(page.getByTestId('health-ready')).toContainText('API : ok')
})

test('ECR-NAV-01 un onglet ouvre une liste déroulante unique, fermée par Échap', async ({
  page,
}) => {
  await ouvrir(page, '/moi')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await nav.getByRole('button', { name: /^Réception/ }).click()
  const menu = page.getByTestId('menu-reception')
  await expect(menu.getByRole('link', { name: /Réception des affiches/ })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Liste des affiches' })).toBeVisible()
  await expect(menu.getByRole('link', { name: /Réceptions inconnues/ })).toBeVisible()
  // une seule liste ouverte à la fois
  await nav.getByRole('button', { name: /^Expédition/ }).click()
  await expect(page.getByTestId('menu-expedition')).toBeVisible()
  await expect(page.getByTestId('menu-reception')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('menu-expedition')).toHaveCount(0)
  // clic ailleurs ferme
  await nav.getByRole('button', { name: /^Réception/ }).click()
  await expect(page.getByTestId('menu-reception')).toBeVisible()
  await page.getByRole('heading', { name: 'Mon profil' }).click()
  await expect(page.getByTestId('menu-reception')).toHaveCount(0)
})

test('ECR-NAV-01 une entrée ouvre sa page et porte aria-current', async ({ page }) => {
  await ouvrir(page, '/moi')
  await page.getByTestId('onglet-reception').click()
  await page.getByTestId('menu-reception').getByRole('link', { name: 'Liste des affiches' }).click()
  await expect(page).toHaveURL(/\/reception\/affiches/)
  await page.getByTestId('onglet-reception').click()
  await expect(
    page.getByTestId('menu-reception').getByRole('link', { name: 'Liste des affiches' }),
  ).toHaveAttribute('aria-current', 'page')
})

test('ECR-NAV-01 les entrées de la maquette sans écran sont absentes', async ({ page }) => {
  await ouvrir(page, '/moi')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('button', { name: /Stocks/ })).toBeVisible()
  await page.getByTestId('onglet-pilotage').click()
  const menu = page.getByTestId('menu-pilotage')
  await expect(menu.getByText('Suivi de prod', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('onglet-fixe').click()
  await expect(page.getByTestId('menu-fixe').getByText('Fichiers multi-rouleuse')).toHaveCount(0)
})

test('EX-TRA-006 le site choisi est envoyé en en-tête x-site-id sur les appels API', async ({
  page,
}) => {
  await ouvrir(page, '/moi')
  const select = page.getByTestId('shell-site')
  await expect(select.locator('option')).not.toHaveCount(1)
  const valeur = await select.locator('option').nth(1).getAttribute('value')
  expect(valeur).toMatch(/^\d+$/)
  const attente = page.waitForRequest(
    (req) => req.url().endsWith('/api/me') && req.headers()['x-site-id'] === valeur,
  )
  await select.selectOption(valeur ?? '')
  await attente
  await expect(page.getByTestId('shell-site')).toHaveValue(valeur ?? '')
  // retour à « Tous les sites » : plus d'en-tête
  const sans = page.waitForRequest(
    (req) => req.url().endsWith('/api/me') && req.headers()['x-site-id'] === undefined,
  )
  await page.getByTestId('shell-site').selectOption('ALL')
  await sans
})

test('ECR-NAV-01 le profil de dev change les droits : Administration refusée en coord, accessible en admin', async ({
  page,
}) => {
  await ouvrir(page, '/moi')
  await profil(page, 'dev.coord')
  await ouvrir(page, '/moi')
  await expect(page.getByTestId('shell-profil')).toHaveValue('dev.coord')
  await expect(page.getByTestId('shell-utilisateur')).toContainText('coord')
  await page.getByTestId('onglet-admin').click()
  const menu = page.getByTestId('menu-admin')
  await expect(menu.getByRole('link', { name: 'Paramètres' })).toHaveCount(0)
  const grise = menu.locator('[aria-disabled="true"]', { hasText: 'Paramètres' })
  await expect(grise).toBeVisible()
  await expect(grise).toHaveAttribute('title', /Réservé/)
  await page.keyboard.press('Escape')
  // le serveur reste juge : l'accès direct affiche la page de refus
  await page.goto('/admin/parametres')
  await expect(page.getByTestId('acces-refuse')).toBeVisible()

  // changement de profil par le sélecteur
  await ouvrir(page, '/moi')
  await page.getByTestId('shell-profil').selectOption('dev.admin')
  await expect(page.getByTestId('shell-utilisateur')).toContainText('admin')
  await page.getByTestId('onglet-admin').click()
  await page.getByTestId('menu-admin').getByRole('link', { name: 'Paramètres' }).click()
  await expect(page).toHaveURL(/\/admin\/parametres/)
  await expect(page.getByTestId('acces-refuse')).toHaveCount(0)
})

test('ECR-NAV-01 le logo ouvre la première page accessible du profil (Q-365)', async ({ page }) => {
  await profil(page, 'dev.expe')
  await page.goto('/')
  await expect(page).toHaveURL(/\/expedition/)
  await profil(page, 'dev.recep')
  await ouvrir(page, '/expedition/colis')
  await page.getByRole('banner').getByRole('link', { name: /Circé/ }).click()
  await expect(page).toHaveURL(/\/reception/)
})

test('ECR-NAV-01 un cookie de profil invalide est ignoré par le relais', async ({ page }) => {
  await profil(page, 'dev.pirate')
  await ouvrir(page, '/moi')
  await expect(page.getByTestId('shell-utilisateur')).toBeVisible()
  await expect(page.getByTestId('shell-profil')).toHaveValue('')
})

test('ECR-NAV-01 erreur du chargement du profil : message et réessai', async ({ page }) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({
      status: 502,
      json: { code: 'API_INDISPONIBLE', message: "L'API est injoignable" },
    }),
  )
  await page.goto('/moi')
  await expect(page.getByTestId('shell-me-error')).toBeVisible()
  await expect(
    page.getByTestId('shell-me-error').getByRole('button', { name: 'Réessayer' }),
  ).toBeVisible()
})
