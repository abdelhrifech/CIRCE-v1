import { expect, test, type Page } from '@playwright/test'

// COO-P10 — Export des trains (ECR-COO-05b, RG-COO-210 à 213), suivi par thème (ECR-COO-06, RG-COO-230, 233),
// Préparation et rouleur (ECR-COO-07, RG-COO-215, 235, 236), générateur de fichiers (ECR-GEN-01 / 03).
// Utilisateur e2e.coord ; données : apps/api/scripts/e2e-seed.ts (site « EXP »). Le fichier est une simulation (Q-193).

test.describe.configure({ mode: 'serial' })

const table = (page: Page) => page.getByRole('table', { name: 'Trains' })

test('RG-COO-211 / 213 « Exporter les trains… » : simulation sans statut, export réel, historique, dossier « En cours » signalé', async ({
  page,
}) => {
  await page.goto('/coordination/trains?dossier=2190201')
  await expect(table(page).getByRole('row', { name: /E2E-EXP-/ })).toHaveCount(2)
  await page.getByRole('button', { name: 'Exporter les trains…' }).click()
  const modale = page.getByRole('dialog', { name: /Exporter les trains · départ/ })
  await expect(modale).toContainText('en Instruction OK : leurs faces passent « A imprimer »')
  await expect(modale).toContainText('« En cours » — Ils ne partent pas')
  await expect(modale).toContainText('2190203')
  await modale.getByRole('button', { name: 'Simulation export' }).click()
  await expect(modale.getByRole('status')).toContainText('aucun statut modifié')
  await expect(modale.getByRole('button', { name: /^Télécharger Simulation/ })).toBeVisible()
  await modale.getByRole('button', { name: 'Exporter', exact: true }).click()
  await expect(modale.getByRole('status')).toContainText('exporté(s) : leurs')
  const histo = modale.getByRole('table', { name: 'Historique des exports' })
  await expect(histo).toContainText('Export des trains')
  await expect(histo).toContainText('simulation')
  // Audit B1 : le fichier est SIMULÉ (D-15), distinct de la « simulation d'export » fonctionnelle.
  await expect(modale.getByRole('note').filter({ hasText: 'Fichier simulé (D-15)' })).toBeVisible()
  await expect(histo).toContainText('fichier simulé (D-15)')
  await expect(histo).toContainText('_SIMULE.csv')
  // RG-COO-211 : plus rien à exporter pour ce départ : bouton « Exporter » désactivé.
  await expect(modale.getByRole('button', { name: 'Exporter', exact: true })).toBeDisabled()
  await expect(modale).toContainText('0 dossier(s)')
})

test('RG-COO-230 / 233 suivi par thème : besoin et couvert par thème, « Marquer pré-assemblé » puis « Désassembler »', async ({
  page,
}) => {
  await page.goto('/coordination/trains?tab=besoin&dossier=2190204')
  const besoin = page.getByRole('table', { name: 'Besoin par thème' })
  const ligne = besoin.getByRole('row', { name: /Thème prêt E2E/ })
  await expect(ligne).toContainText('3 / 1')
  await expect(ligne).toContainText('Oui')
  await expect(ligne).toContainText('X-4')
  await ligne.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Marquer pré-assemblé' }).click()
  await expect(page.getByRole('status')).toContainText('1 visuel(s) pré-assemblé(s).')
  await expect(besoin.getByRole('row', { name: /Thème prêt E2E/ })).toContainText('Fait')
  await besoin
    .getByRole('row', { name: /Thème prêt E2E/ })
    .getByRole('checkbox')
    .check()
  await page.getByRole('button', { name: 'Désassembler' }).click()
  await expect(page.getByRole('status')).toContainText('1 visuel(s) désassemblé(s).')
})

test('RG-COO-215 / 235 / 236 Préparation : « Choisir le rouleur… » ; l’export préparation d’un atelier non autorisé est refusé', async ({
  page,
}) => {
  await page.goto('/coordination/trains?tab=prepa&dossier=2190204')
  const ligne = table(page).getByRole('row', { name: /E2E-PRETX-/ })
  await expect(ligne).toContainText('Prêt à produire')
  await expect(ligne).toContainText('—')
  await ligne.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Export préparation' }).click()
  await expect(page.getByTestId('error-message')).toContainText(
    'L’export préparation n’est autorisé que pour les ateliers de 2 m²',
  )
  await page.getByRole('button', { name: 'Choisir le rouleur…' }).click()
  const modale = page.getByRole('dialog', { name: /Rouleur de 1 ligne\(s\) de trains/ })
  await modale.getByLabel('Rouleur').selectOption({ label: 'Rouleur E2E' })
  await modale.getByRole('button', { name: 'Affecter' }).click()
  await expect(page.getByRole('status')).toContainText('Rouleur Rouleur E2E affecté à 1 train(s).')
  await expect(table(page).getByRole('row', { name: /E2E-PRETX-/ })).toContainText('Rouleur E2E')
})

test('ECR-GEN-01 / GEN-03 générateur : choix du train prêt, compteur de tiroirs, fichier simulé préparé puis envoyé à la machine (envoi simulé)', async ({
  page,
}) => {
  await page.goto('/coordination/generateur')
  await expect(
    page.getByRole('heading', { name: 'Fichiers Vendôme · choix des trains' }),
  ).toBeVisible()
  const ligne = page.getByRole('table', { name: 'Trains' }).getByRole('row', { name: /E2E-PRETX-/ })
  await expect(ligne).toContainText('Prêt')
  await expect(
    page.getByText('Cochez les trains à mettre dans le fichier.', { exact: true }),
  ).toBeVisible()
  await ligne.getByRole('checkbox').check()
  await expect(page.getByLabel('Tiroirs')).toContainText('1 / 20 tiroirs')
  await page.getByRole('button', { name: /^Préparer le fichier/ }).click()
  const bilan = page.getByRole('region', { name: 'Bilan de génération' })
  await expect(bilan).toContainText('(simulation)')
  await expect(bilan.getByLabel('Aperçu du fichier')).toContainText('# SIMULATION')
  await bilan.getByRole('button', { name: /^Envoyer à la machine/ }).click()
  await expect(bilan.getByRole('status')).toContainText(
    'envoyé à la machine « simulee » (envoi simulé, D-15',
  )
  await expect(bilan.getByRole('status')).toContainText('Les faces gardent leur statut')
  await expect(page.getByRole('region', { name: 'Historique des générations' })).toContainText(
    'Envoyé à la machine',
  )
})
