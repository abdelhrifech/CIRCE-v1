import { expect, test } from '@playwright/test'

// L'E2E injecte un utilisateur de dev (Q-001) : le 401 est simulé sur /api/me.
test('Mon profil affiche l’erreur normalisée quand l’utilisateur n’est pas identifié (401)', async ({
  page,
}) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({
      status: 401,
      json: { code: 'NON_AUTHENTIFIE', message: 'Authentification requise' },
    }),
  )
  await page.goto('/moi')
  const erreur = page.getByTestId('error-message')
  await expect(erreur).toContainText('Connexion requise')
  await expect(erreur).toContainText('Authentification requise')
  await expect(page.getByRole('main').getByRole('button', { name: 'Réessayer' })).toBeVisible()
})

test('le composant d’erreur affiche la règle violée (422)', async ({ page }) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({
      status: 422,
      json: { code: 'REGLE_METIER', message: 'Refus métier', regle: 'RG-REC-012' },
    }),
  )
  await page.goto('/moi')
  await expect(page.getByTestId('error-message')).toContainText('Règle métier non respectée')
  await expect(page.getByTestId('error-regle')).toHaveText('Règle : RG-REC-012')
})

test('Mon profil affiche les permissions renvoyées par le serveur', async ({ page }) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        userId: 1,
        identifiantExterne: 'e2e.coord',
        nom: 'Utilisateur E2E',
        roles: ['coord'],
        permissions: ['validation_admin.valider'],
        perimetre: { toutesPlateformes: false, plateformeIds: [1] },
        siteId: null,
      },
    }),
  )
  await page.goto('/moi')
  await expect(page.getByTestId('moi-ready')).toContainText('validation_admin.valider')
})

test('la page d’accès refusé explique le motif', async ({ page }) => {
  await page.goto('/acces-refuse?permission=reception.valider&motif=interdit')
  await expect(page.getByTestId('acces-refuse')).toContainText('Votre rôle ne permet pas')
  await expect(page.getByTestId('acces-refuse')).toContainText('reception.valider')
})
