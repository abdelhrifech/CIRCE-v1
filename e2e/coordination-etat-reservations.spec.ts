import { expect, test, type Page } from '@playwright/test'

// COO-P05 — ECR-PIL-03 État des réservations vivant (RG-COO-101, 107, 108). Utilisateur e2e.coord ; données :
// apps/api/scripts/e2e-seed.ts (« Annonceur EDR Multi E2E » : 100 affiches sur deux semaines ; « Annonceur
// EDR Provisoire E2E » : DA activée avant IP), lignes produites par la lecture Broadcast (alimentation).

const table = (page: Page) => page.getByRole('table', { name: 'État des réservations' })
const ligne = (page: Page, texte: RegExp) => table(page).getByRole('row', { name: texte })

test('RG-COO-101 / 107 dossier sur deux semaines compté une fois ; visuel provisoire « IP à saisir »', async ({
  page,
}) => {
  await page.goto('/pilotage/reservations')
  await expect(table(page)).toBeVisible()
  const multi = ligne(page, /Annonceur EDR Multi E2E/)
  await expect(multi).toContainText('Thème multi')
  await expect(multi).toContainText('Multi-semaines')
  await expect(multi).toContainText('IP saisies, prépa attendue')
  await expect(multi.getByRole('cell').nth(4)).toHaveText('100')
  await expect(ligne(page, /Annonceur EDR Provisoire E2E/)).toContainText('DA activée, IP à saisir')
})

test('RG-COO-107 filtre « Où en est-il » et grain Dossier ; filtre sans résultat', async ({
  page,
}) => {
  await page.goto('/pilotage/reservations')
  await expect(table(page)).toBeVisible()
  await page.getByLabel('Où en est-il').selectOption('DA_ACTIVEE')
  await expect(ligne(page, /Annonceur EDR Provisoire E2E/)).toBeVisible()
  await expect(ligne(page, /Annonceur EDR Multi E2E/)).toHaveCount(0)
  await page.getByLabel('Où en est-il').selectOption('')
  await page.getByLabel('Afficher par').selectOption('DOSSIER')
  await expect(ligne(page, /Annonceur EDR Multi E2E/)).toContainText('100')
  await page.getByLabel('Annonceur').fill('aucun annonceur de ce nom')
  await page.getByLabel('Annonceur').press('Enter')
  await expect(page.getByText('Aucune ligne avec ces filtres à ce grain.')).toBeVisible()
})

test('ECR-PIL-03 clic sur la tuile « En pré-production » au grain Dossier : autant de lignes que l’indicateur', async ({
  page,
}) => {
  await page.goto('/pilotage/reservations?par=DOSSIER')
  await expect(table(page)).toBeVisible()
  const tuile = page.getByRole('button', { name: /^En pré-production/ })
  const nombre = Number((await tuile.innerText()).replace(/\D/g, ''))
  expect(nombre).toBeGreaterThan(0)
  await tuile.click()
  await expect(page).toHaveURL(
    /ou=DA_ACTIVEE%2CIP_SAISIES%2CVALIDATION_A_CONFIRMER|ou=DA_ACTIVEE,IP_SAISIES,VALIDATION_A_CONFIRMER/,
  )
  await expect(table(page).locator('tbody tr')).toHaveCount(nombre)
  await expect(ligne(page, /Annonceur EDR Provisoire E2E/)).toBeVisible()
})
