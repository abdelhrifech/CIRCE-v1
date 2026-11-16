import { expect, test } from '@playwright/test'

// COO-P07 — Pilotage › Alertes (ECR-TRA-01, RG-COO-075) et Vérification des thèmes (ECR-THM-01 / 03,
// RG-COO-068 / 069, RG-X-057). Utilisateur e2e.coord ; données : apps/api/scripts/e2e-seed.ts (site « THM » :
// « Annonceur TBC E2E » thème changé dans Broadcast ; « Boulangerie / Garage / Cinéma » thèmes proches).

test.describe.configure({ mode: 'serial' })

test('ECR-COO-02 / RG-COO-068 / 069 fiche dossier : encadrés « Thème modifié dans Broadcast » et « thème proche », reprise', async ({
  page,
}) => {
  await page.goto('/pilotage/alertes?depart=TOUTES&type=VALIDATION_ADMIN')
  await page
    .getByRole('table', { name: 'Alertes' })
    .getByRole('row')
    .filter({ hasText: 'Annonceur Fiche TBC E2E' })
    .getByRole('link', { name: 'Ouvrir' })
    .click()
  await page
    .getByRole('table', { name: 'Dossiers' })
    .getByRole('row', { name: /Annonceur Fiche TBC E2E/ })
    .getByRole('button', { name: /^Ouvrir le dossier/ })
    .click()
  const fiche = page.getByRole('dialog', { name: /Annonceur Fiche TBC E2E · dossier/ })
  await expect(fiche).toContainText('Thème modifié dans Broadcast après la validation')
  await expect(fiche).toContainText(
    'Broadcast indique « Thème fiche E2E », Circé a « Ancien fiche E2E »',
  )
  await expect(fiche).toContainText('Thème proche à vérifier avant de valider')
  await expect(fiche.getByRole('link', { name: 'Vérifier les thèmes' })).toHaveAttribute(
    'href',
    /\/coordination\/themes\?dossier=\d+/,
  )
  await fiche.getByRole('button', { name: 'Reprendre la version Broadcast' }).click()
  await expect(fiche.getByRole('status')).toContainText('« Thème fiche E2E » repris de Broadcast')
  await expect(fiche).not.toContainText('Thème modifié dans Broadcast après la validation')
})

test('ECR-TRA-01 / RG-COO-068 alerte « Thème modifié dans Broadcast », ouverture et reprise de la version Broadcast', async ({
  page,
}) => {
  await page.goto('/pilotage/alertes?depart=TOUTES')
  await expect(page.getByRole('heading', { name: 'Alertes' })).toBeVisible()
  await expect(page.getByText('Critiques', { exact: true })).toHaveCount(0)
  await page.getByText(/^Type \(/).click()
  await page.getByRole('checkbox', { name: /^Thème modifié dans Broadcast/ }).check()
  const ligne = page
    .getByRole('table', { name: 'Alertes' })
    .getByRole('row')
    .filter({ hasText: 'Thème modifié dans Broadcast après la validation' })
    .filter({ hasText: 'Annonceur TBC E2E' })
  await expect(ligne).toContainText(
    'Broadcast indique « Thème Broadcast E2E », Circé a « Thème Circé E2E »',
  )
  // Q-220 : l'acquittement n'est ouvert à aucun rôle tant que « qui acquitte » n'est pas décidé.
  await expect(ligne.getByRole('button', { name: 'Acquitter' })).toBeDisabled()
  await ligne.getByRole('link', { name: 'Ouvrir' }).click()
  await expect(page.getByRole('heading', { name: 'Thèmes modifiés dans Broadcast' })).toBeVisible()
  const table = page.getByRole('table', { name: 'Thèmes modifiés dans Broadcast' })
  const tbc = table.getByRole('row', { name: /Annonceur TBC E2E/ })
  await expect(tbc).toContainText('Thème Circé E2E')
  await expect(tbc).toContainText('Avant la production')
  await tbc.getByRole('button', { name: 'Reprendre la version BC' }).click()
  await expect(page.getByRole('status')).toContainText(
    '« Thème Broadcast E2E » repris de Broadcast pour le dossier',
  )
  await expect(page.getByText('Aucun thème modifié dans Broadcast avec ces filtres')).toBeVisible()
})

test('RG-COO-069 thèmes proches : « Visuels différents » lève l’alerte ; « Demander la correction » trace la demande', async ({
  page,
}) => {
  await page.goto('/coordination/themes?annonceur=Boulangerie%20Kzwxq')
  const table = page.getByRole('table', { name: 'Thèmes proches' })
  const boulangerie = table.getByRole('row', { name: /Boulangerie Kzwxq E2E/ })
  await expect(boulangerie).toContainText('« Pain de campagne » · « PAIN DE CAMPAGNE ! »')
  await expect(boulangerie).toContainText('À vérifier')
  await boulangerie.getByRole('button', { name: 'Visuels différents' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Noté : ce sont des visuels différents. L’alerte est levée.',
  )
  await expect(page.getByText('Aucun thème proche à vérifier avec ces filtres.')).toBeVisible()

  await page.goto('/coordination/themes?annonceur=Garage%20Pltrv')
  await page
    .getByRole('row', { name: /Garage Pltrv E2E/ })
    .getByRole('button', { name: 'Demander la correction' })
    .click()
  const modale = page.getByRole('dialog', {
    name: 'Demander la correction dans Broadcast · Garage Pltrv E2E',
  })
  await modale.getByRole('radio', { name: /« Révision hiver »/ }).check()
  await expect(modale.getByRole('table', { name: 'À corriger dans Broadcast' })).toContainText(
    '« Revision hiver 2026 » → « Révision hiver »',
  )
  await modale.getByRole('button', { name: 'Envoyer la demande' }).click()
  await expect(page.getByRole('status')).toContainText('Demande enregistrée pour 1 dossier(s)')
  await page.goto('/coordination/themes?annonceur=Garage%20Pltrv&etat=DEMANDE_ENVOYEE')
  await expect(page.getByRole('row', { name: /Garage Pltrv E2E/ })).toContainText(
    'Demande envoyée à Broadcast',
  )
})

test('RG-COO-069 rejet : production lancée sur tous les dossiers → « Rien à demander »', async ({
  page,
}) => {
  await page.goto('/coordination/themes?annonceur=Cin%C3%A9ma%20Hjqsd')
  await page
    .getByRole('row', { name: /Cinéma Hjqsd E2E/ })
    .getByRole('button', { name: 'Demander la correction' })
    .click()
  const modale = page.getByRole('dialog', {
    name: 'Demander la correction dans Broadcast · Cinéma Hjqsd E2E',
  })
  await expect(modale).toContainText('Production lancée : à voir avec l’atelier')
  await modale.getByRole('button', { name: 'Envoyer la demande' }).click()
  await expect(page.getByTestId('error-message')).toContainText(
    'Rien à demander : la production est lancée sur ces dossiers. Voir avec l’atelier.',
  )
})
