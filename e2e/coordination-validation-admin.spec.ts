import { expect, test, type Page } from '@playwright/test'

// COO-P03 — validation admin : pastille du dossier (RG-COO-019), pré-cochage des cas sûrs (RG-COO-011),
// « Valider la sélection » et modale ECR-COO-03 (RG-COO-010 / 012 / 013), fiche dossier (ECR-COO-02).
// Utilisateur e2e.coord ; données : apps/api/scripts/e2e-seed.ts (« Annonceur Cas sûr E2E » : une affiche
// proposée en mode BL ; « Annonceur Doute E2E » : une proposée + une rattachée à la main, à doute).

test.describe.configure({ mode: 'serial' })

const table = (page: Page) => page.getByRole('table', { name: 'Dossiers' })
const ligne = (page: Page, annonceur: RegExp) => table(page).getByRole('row', { name: annonceur })

async function ouvrir(page: Page) {
  await page.goto('/coordination?pour=fixe')
  await expect(table(page)).toBeVisible()
}

test('RG-COO-019 / RG-COO-011 pastilles « À confirmer » et cas sûr pré-coché à l’arrivée', async ({
  page,
}) => {
  await ouvrir(page)
  await expect(ligne(page, /Annonceur Cas sûr E2E/)).toContainText('À confirmer (1)')
  await expect(ligne(page, /Annonceur Doute E2E/)).toContainText('À confirmer (2, dont 1 doute)')
  await expect(ligne(page, /Annonceur Cas sûr E2E/).getByRole('checkbox')).toBeChecked()
  await expect(ligne(page, /Annonceur Doute E2E/).getByRole('checkbox')).not.toBeChecked()
  await expect(page.getByRole('button', { name: /^Cocher les cas sûrs \(1\)$/ })).toBeVisible()
})

test('RG-COO-013 « Valider la sélection » sans affiche à confirmer : refus « Rien à valider »', async ({
  page,
}) => {
  await ouvrir(page)
  await ligne(page, /Annonceur Cas sûr E2E/)
    .getByRole('checkbox')
    .uncheck()
  await page.goto('/coordination?pour=deroulant')
  await ligne(page, /Annonceur Répartition E2E/)
    .getByRole('checkbox')
    .check()
  await page.getByRole('button', { name: 'Valider la sélection' }).click()
  await expect(page.getByTestId('error-message')).toContainText('Rien à valider')
  await ouvrir(page)
  await expect(ligne(page, /Annonceur Cas sûr E2E/)).toContainText('À confirmer (1)')
})

test('RG-COO-012 ECR-COO-03 doutes dans la sélection : confirmation explicite, « sans doute seulement »', async ({
  page,
}) => {
  await ouvrir(page)
  await ligne(page, /Annonceur Doute E2E/)
    .getByRole('checkbox')
    .check()
  await page.getByRole('button', { name: 'Valider la sélection' }).click()
  const modale = page.getByRole('dialog', { name: 'Confirmer aussi les affiches à doute ?' })
  await expect(modale).toContainText('2 affiche(s) sans doute et 1 affiche(s) à doute')
  await expect(modale.getByRole('list', { name: 'Affiches à doute' })).toContainText(
    'Rattachée sans le n° du BL',
  )
  // « Annuler » : rien n'est écrit.
  await modale.getByRole('button', { name: 'Annuler' }).click()
  await expect(modale).toHaveCount(0)
  await expect(ligne(page, /Annonceur Cas sûr E2E/)).toContainText('À confirmer (1)')
  await page.getByRole('button', { name: 'Valider la sélection' }).click()
  await page
    .getByRole('dialog', { name: 'Confirmer aussi les affiches à doute ?' })
    .getByRole('button', { name: 'Confirmer les 2 sans doute seulement' })
    .click()
  await expect(page.getByRole('status')).toContainText('2 affiche(s) confirmée(s)')
  // Cas sûr validé : plus rien à faire (sort du filtre par défaut) ; le doute reste à confirmer.
  await expect(ligne(page, /Annonceur Cas sûr E2E/)).toHaveCount(0)
  await expect(ligne(page, /Annonceur Doute E2E/)).toContainText('À confirmer (1, dont 1 doute)')
})

test('RG-COO-006 / RG-COO-012 fiche dossier : motif affiché, « Valider (1 affiche) » avec confirmation explicite', async ({
  page,
}) => {
  await ouvrir(page)
  await ligne(page, /Annonceur Doute E2E/)
    .getByRole('button', { name: /^Ouvrir le dossier/ })
    .click()
  const fiche = page.getByRole('dialog', { name: /Annonceur Doute E2E · dossier/ })
  const affiches = fiche.getByRole('table', { name: 'Affiches reçues et validation admin' })
  await expect(affiches).toContainText('À confirmer : doute')
  await expect(affiches).toContainText('Rattachée sans le n° du BL')
  await expect(affiches).toContainText('Validée par la Coordination')
  await fiche.getByRole('button', { name: 'Valider (1 affiche)' }).click()
  await page
    .getByRole('dialog', { name: 'Confirmer aussi les affiches à doute ?' })
    .getByRole('button', { name: 'Confirmer tout (1)' })
    .click()
  await expect(fiche.getByRole('status')).toContainText('1 affiche(s) confirmée(s)')
  await expect(fiche).toContainText('Validation admin : Validée')
  await expect(affiches).not.toContainText('À confirmer')
})
