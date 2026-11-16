import { expect, test, type Page } from '@playwright/test'

// COO-P11 — Dispatch du roulage (ECR-COO-10, RG-COO-291 à 296), bagues et étiquettes (ECR-COO-11, RG-COO-298 à 302),
// suivi 8 m² (ECR-COO-08, RG-COO-237). Utilisateur e2e.chef (rôle cheq, site « ROU » seul) ; données :
// apps/api/scripts/e2e-seed.ts (dossiers 2190301 à 2190304, deux rouleurs). L'étiquette est un aperçu navigateur
// (Q-002, Q-287) et la répartition proposée une règle simulée (Q-276).

test.describe.configure({ mode: 'serial' })

const trains = (page: Page) => page.getByRole('table', { name: 'Trains' })

test('RG-COO-291 / 294 / 296 dispatch : trains prêts de l’atelier, affectation immédiate d’un rouleur, charge et liste de picking', async ({
  page,
}) => {
  await page.goto('/coordination/dispatch?dossier=2190301')
  const ligne = trains(page).getByRole('row', { name: /E2E-ROU-A-/ })
  await expect(ligne).toContainText('Prêt')
  await expect(ligne).toContainText('Destinataire E2E ROU')
  await expect(page.getByText('Moteur de répartition à brancher')).toBeVisible()
  await ligne.getByRole('combobox').selectOption({ label: 'Rouleur R1 E2E · Table 1' })
  await expect(page.getByRole('status')).toContainText(
    'Rouleur Rouleur R1 E2E affecté à 1 train(s).',
  )
  await expect(ligne.getByRole('combobox').locator('option:checked')).toHaveText(/Rouleur R1 E2E/)
  const charge = page.getByRole('table', { name: 'Charge' })
  const rouleur = charge.getByRole('row', { name: /Rouleur R1 E2E/ })
  await expect(rouleur).toContainText('Table 1')
  await expect(rouleur).toContainText('Destinataire E2E ROU')
  await rouleur.getByRole('button', { name: 'Liste de picking' }).click()
  const picking = page.getByRole('dialog', {
    name: 'Liste des affaires à collecter : Rouleur R1 E2E',
  })
  const affaires = picking.getByRole('table', { name: 'Affaires à collecter' })
  await expect(affaires).toContainText('R-5')
  await expect(affaires).toContainText('Thème roulage A')
  await picking.getByText('Fermer', { exact: true }).click()
  await expect(picking).toHaveCount(0)
  // RG-COO-294 : « Non affecté » remet le train à sa place, immédiatement.
  await ligne.getByRole('combobox').selectOption({ label: 'Non affecté' })
  await expect(page.getByRole('status')).toContainText('1 train(s) désaffecté(s).')
})

test('RG-COO-293 / 294 « Proposer une répartition » (règle simulée) puis « Tout désaffecter » ; rien à répartir : refus visible', async ({
  page,
}) => {
  await page.goto('/coordination/dispatch?dossier=2190302')
  await expect(trains(page).getByRole('row', { name: /E2E-ROU-B-/ })).toBeVisible()
  await page.getByRole('button', { name: 'Proposer une répartition' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Répartition proposée : 1 trains sur 1 rouleurs.',
  )
  await page.getByRole('button', { name: 'Proposer une répartition' }).click()
  await expect(page.getByTestId('error-message')).toContainText(
    'Aucun train non affecté à répartir.',
  )
  await page.getByRole('button', { name: 'Tout désaffecter' }).click()
  await expect(page.getByRole('status')).toContainText('1 train(s) désaffecté(s).')
})

test('RG-COO-298 à 302 bagues : impression avec rouleur obligatoire, « En production », textes modifiés, réimpression avec motif', async ({
  page,
}) => {
  await page.goto('/coordination/bagues?dossier=2190304')
  const table = page.getByRole('table', { name: 'Bagues' })
  const ligne = table.getByRole('row', { name: /E2E-ROU-D-/ })
  await expect(ligne).toContainText('Sans machine')
  await expect(ligne).toContainText('Thème roulage D')
  await ligne.getByRole('checkbox', { name: /Sélectionner E2E-ROU-D-/ }).check()
  await page.getByRole('button', { name: 'Imprimer les bagues (1)' }).click()
  const modale = page.getByRole('dialog', { name: 'Imprimer 1 bague(s)' })
  // RG-COO-299 : rouleur obligatoire : « Imprimer » reste désactivé sans rouleur.
  await expect(modale.getByRole('button', { name: 'Imprimer', exact: true })).toBeDisabled()
  const etiquette = modale.getByRole('article', { name: /Bague E2E-ROU-D-/ })
  await expect(etiquette).toContainText('Nb aff : 1')
  await expect(etiquette).toContainText('Destinataire E2E ROU')
  await expect(etiquette).toContainText('Thème roulage D')
  await modale.getByRole('combobox').selectOption({ label: 'Rouleur R2 E2E · Table 2' })
  await modale.getByRole('button', { name: 'Imprimer', exact: true }).click()
  await expect(modale.getByRole('status')).toContainText(
    "1 bague(s) imprimée(s) (rouleur Rouleur R2 E2E). Le statut passe automatiquement à « En production » à l'impression.",
  )
  await modale.getByText('Fermer', { exact: true }).click()
  await expect(ligne).toHaveCount(0)
  // Bagues imprimées : numéro et rouleur ; « Modifier » : textes vides refusés, puis réimpression automatique.
  await page.getByLabel('Filtre Bague').selectOption('IMPRIMEES')
  const imprimee = table.getByRole('row', { name: /E2E-ROU-D-/ })
  await expect(imprimee).toContainText('Imprimée (Rouleur R2 E2E)')
  await expect(imprimee).toContainText('En production')
  await imprimee.getByRole('button', { name: 'Modifier' }).click()
  const textes = page.getByRole('dialog', { name: /^Textes imprimés sur la bague/ })
  await textes.getByLabel('Annonceur (A)').fill('')
  await textes.getByRole('button', { name: 'Enregistrer et réimprimer' }).click()
  await expect(textes.getByTestId('error-message')).toContainText(
    "Le thème et l'annonceur ne peuvent pas être vides.",
  )
  await textes.getByLabel('Annonceur (A)').fill('ANNONCEUR MODIFIE')
  await textes.getByRole('button', { name: 'Enregistrer et réimprimer' }).click()
  await expect(page.getByRole('status')).toContainText('enregistrés et réimprimés')
  await expect(imprimee).toContainText('modifié')
  await expect(imprimee).toContainText('réimprimée 1 fois')
  // RG-COO-301 : réimprimer avec un motif.
  await imprimee.getByRole('button', { name: 'Aperçu' }).click()
  await page.getByRole('button', { name: /^Réimprimer la bague \d+…/ }).click()
  const reimpression = page.getByRole('dialog', { name: /^Réimprimer la bague/ })
  await reimpression.getByRole('combobox').selectOption('Colis perdu, refait')
  await reimpression.getByRole('button', { name: 'Réimprimer', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('réimprimée (motif : Colis perdu, refait)')
  await expect(imprimee).toContainText('réimprimée 2 fois')
})

test('RG-COO-237 suivi 8 m² : saisie en ligne des demies et des 8 m² finales, reste à faire, refus d’une valeur négative', async ({
  page,
}) => {
  await page.goto('/coordination/trains?tab=d8&dossier=2190301')
  const table = page.getByRole('table', { name: 'Suivi 8 m²' })
  const ligne = table.getByRole('row', { name: /Thème roulage A/ })
  await expect(ligne).toContainText('Annonceur Roulage A')
  const demies = ligne.getByLabel(/^Demies haut de/)
  await demies.fill('3')
  await demies.press('Enter')
  await expect(page.getByRole('status')).toContainText('8 m² : demies haut = 3')
  const finales = ligne.getByLabel(/^8 m² finales de/)
  await finales.fill('1')
  await finales.press('Enter')
  await expect(page.getByRole('status')).toContainText('8 m² : 8 m² finales = 1')
  // Reste à faire = besoin − finales (1 − 1).
  await expect(ligne.getByRole('cell').last()).toHaveText('0')
  await expect(ligne.getByLabel(/^Demies haut de/)).toHaveValue('3')
  // RG-COO-237 : valeur négative refusée.
  await ligne.getByLabel(/^Demies bas de/).fill('-1')
  await ligne.getByLabel(/^Demies bas de/).press('Enter')
  await expect(page.getByTestId('error-message')).toContainText(
    'saisissez un nombre entier supérieur ou égal à 0',
  )
})
