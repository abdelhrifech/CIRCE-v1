import { expect, test } from '@playwright/test'

test('la coque affiche l’état de l’API relayé par /api/health', async ({ page }) => {
  await page.goto('/moi')
  await expect(page.getByTestId('health-ready')).toContainText('API : ok')
  await expect(page.getByTestId('health-ready')).toContainText('base : up')
})

test('affiche l’état d’erreur avec réessai quand l’API répond en erreur', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 502,
      json: { code: 'API_INDISPONIBLE', message: "L'API est injoignable" },
    }),
  )
  await page.goto('/moi')
  await expect(page.getByTestId('health-error')).toContainText("L'API est injoignable")
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
})
