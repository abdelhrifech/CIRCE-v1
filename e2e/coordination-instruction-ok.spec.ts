import { expect, test, type Page } from '@playwright/test'

// COO-P02 — ECR-COO-01 (filtre « À faire », écart, Instruction OK groupée), ECR-COO-02 (fiche dossier),
// ECR-COO-04 (demande de correction). Utilisateur e2e.coord ; données : apps/api/scripts/e2e-seed.ts
// (« Annonceur Contrôle E2E » : En cours avec commentaire ; « Annonceur Répartition E2E » : 90 % ;
// « Annonceur Écart E2E » : qte BC 10 / Circé 8).

test.describe.configure({ mode: 'serial' })

async function ouvrir(page: Page) {
  await page.goto('/coordination')
  await expect(page.getByRole('table', { name: 'Dossiers' })).toBeVisible()
}

const ligne = (page: Page, annonceur: RegExp) =>
  page.getByRole('table', { name: 'Dossiers' }).getByRole('row', { name: annonceur })

test('RG-COO-060 / RG-COO-055 « À faire » par défaut : dossiers en cours et écart signalé', async ({
  page,
}) => {
  await ouvrir(page)
  await expect(page.getByLabel('À faire (Coordination)')).toHaveValue('A_FAIRE')
  await expect(ligne(page, /Annonceur Contrôle E2E/)).toContainText('En cours · commentaire')
  await expect(ligne(page, /Annonceur Écart E2E/)).toContainText('+2')
  // Dossier annulé : rien à faire, absent du filtre par défaut.
  await expect(page.getByRole('table', { name: 'Dossiers' })).not.toContainText(
    'Annonceur Annulé E2E',
  )
})

test('RG-COO-043 Instruction OK groupée refusée si la répartition n’est pas à 100 %', async ({
  page,
}) => {
  await ouvrir(page)
  await ligne(page, /Annonceur Répartition E2E/)
    .getByRole('checkbox')
    .check()
  await page.getByRole('button', { name: /^Instruction OK \(après contrôle\) \(1\)$/ }).click()
  await expect(page.getByTestId('error-message')).toContainText(
    'La répartition des thèmes n’est pas à 100 % !',
  )
})

test('RG-COO-059 / RG-COO-048 / RG-COO-044 fiche dossier : position proposée, entretien saisi, Instruction OK après contrôle', async ({
  page,
}) => {
  await ouvrir(page)
  await ligne(page, /Annonceur Contrôle E2E/)
    .getByRole('button', { name: /^Ouvrir le dossier/ })
    .click()
  const fiche = page.getByRole('dialog', { name: /Annonceur Contrôle E2E · dossier/ })
  await expect(fiche).toContainText('Proposée d’après le commentaire : Début de train')
  await fiche.getByLabel('Entretien (%)').fill('15')
  await fiche.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(fiche.getByRole('status')).toContainText('modifiée')
  await fiche.getByRole('button', { name: 'Instruction OK (après contrôle)' }).click()
  await expect(fiche.getByRole('status')).toContainText('1 instruction(s) en Instruction OK')
  await expect(fiche).toContainText('Instruction ok · après contrôle')
  // RG-COO-047 : saisie figée après l'Instruction OK.
  await expect(fiche.getByLabel('Entretien (%)')).toBeDisabled()
})

test('RG-COO-056 / RG-COO-057 écart : appliquer la version Broadcast, puis demander une correction', async ({
  page,
}) => {
  await page.goto('/coordination?aFaire=TOUS')
  await ligne(page, /Annonceur Écart E2E/)
    .getByRole('button', { name: /^Ouvrir le dossier/ })
    .click()
  const fiche = page.getByRole('dialog', { name: /Annonceur Écart E2E · dossier/ })
  await expect(fiche).toContainText('Écart Broadcast / Circé : +2')
  await fiche.getByRole('button', { name: 'Appliquer la version Broadcast' }).click()
  await expect(fiche.getByRole('status')).toContainText('écart corrigé (2)')
  await expect(fiche.getByRole('button', { name: 'Appliquer la version Broadcast' })).toHaveCount(0)
  await fiche.getByRole('button', { name: 'Demander une correction à Broadcast' }).click()
  const modale = page.getByRole('dialog', {
    name: /^Demander une correction à Broadcast · dossier/,
  })
  await modale.getByLabel('Qu’y a-t-il à corriger ?').fill('Quantité du thème à revoir')
  await modale.getByRole('button', { name: 'Envoyer la demande' }).click()
  await expect(fiche.getByRole('status')).toContainText('Demande de correction enregistrée')
  await expect(fiche).toContainText('Correction demandée à Broadcast le')
})
