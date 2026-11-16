import { expect, test, type Page } from '@playwright/test'

// COO-P13 — ECR-EXP-01 « Scan et colisage » et ECR-EXP-02 « Colis » (RG-COO-264 à 270, RG-X-087). Utilisateur
// e2e.chef (rôle cheq, droit `colis.gerer`) ; données : apps/api/scripts/e2e-seed.ts (site « EXP », dossiers 2190501
// à 2190503). La création des UM est bloquée (Q-265) : seules les UM existantes sont scannées. Étiquette Geodis,
// boucle et preuve de livraison : étape 8 (Q-284).

test.describe.configure({ mode: 'serial' })

const douchette = (page: Page) => page.getByRole('textbox', { name: /Douchette/ })

test('RG-COO-265 / 267 scan et colisage : code inconnu refusé, le premier scan ouvre un colis, retrait puis colis vidé supprimé', async ({
  page,
}) => {
  await page.goto('/expedition?dossier=2190501')
  const groupe = page.getByRole('group', { name: 'À coliser pour Destinataire EXP A' })
  await expect(groupe).toContainText('UM-E2E-501')
  await expect(
    page.getByText('Aucun colis ouvert. Le premier scan d’unité ouvre un colis.'),
  ).toBeVisible()
  // code inconnu : refus visible
  await douchette(page).fill('INCONNU-1')
  await douchette(page).press('Enter')
  await expect(page.getByRole('status')).toContainText('Code inconnu : INCONNU-1')
  // le premier scan d'unité ouvre un colis (UM En cours → Préparé, poids 6 × 2 kg)
  await groupe.getByRole('button', { name: 'Scanner UM-E2E-501' }).click()
  await expect(page.getByRole('status')).toContainText('UM-E2E-501 ajouté au colis C-')
  const carte = page.getByRole('region', { name: 'Colis en cours' }).getByRole('article')
  await expect(carte).toContainText('Colis ouvert')
  await expect(carte).toContainText('12 kg')
  await expect(page.getByRole('group', { name: 'À coliser pour Destinataire EXP A' })).toHaveCount(
    0,
  )
  // retrait sans sélection : message ; puis retrait de la sélection → colis vidé supprimé
  await carte.getByRole('button', { name: 'Retirer la sélection' }).click()
  await expect(page.getByRole('status')).toContainText('Cochez les unités à retirer du colis.')
  await carte.getByRole('checkbox', { name: 'Retirer UM-E2E-501' }).check()
  await carte.getByRole('button', { name: 'Retirer la sélection' }).click()
  await expect(page.getByRole('status')).toContainText('vidé et supprimé')
  await expect(
    page.getByText('Aucun colis ouvert. Le premier scan d’unité ouvre un colis.'),
  ).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'À coliser pour Destinataire EXP A' }),
  ).toContainText('UM-E2E-501')
})

test('RG-COO-268 / 269 / RG-X-087 clore le colis, puis fin de journée : colis « Expédié », confirmation avant l’action irréversible', async ({
  page,
}) => {
  await page.goto('/expedition?dossier=2190502')
  await douchette(page).fill('UM-E2E-502')
  await douchette(page).press('Enter')
  await expect(page.getByRole('status')).toContainText('UM-E2E-502 ajouté au colis C-')
  await page.getByRole('button', { name: 'Clore le colis' }).click()
  await expect(page.getByRole('status')).toContainText('expédié (à expédier)')
  await page.getByTestId('onglet-expedition').click()
  await page
    .getByTestId('menu-expedition')
    .getByRole('link', { name: 'Colis', exact: true })
    .click()
  await expect(page).toHaveURL(/\/expedition\/colis/)
  await page.goto('/expedition/colis?dossier=2190502')
  const table = page.getByRole('table', { name: 'Colis' })
  await expect(table).toContainText('Clos · à expédier')
  await expect(table).toContainText('Destinataire EXP A')
  await page.getByRole('button', { name: 'Fin de journée' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Fin de journée' })
  await expect(confirmation).toContainText('irréversible')
  await confirmation.getByRole('button', { name: 'Confirmer la fin de journée' }).click()
  await expect(page.getByRole('status')).toContainText('Fin de journée : 1 colis expédié(s)')
  await expect(table).toContainText('Expédié')
  await expect(page.getByLabel('Statut du colis')).toBeVisible()
})

test('ECR-EXP-02 liste des colis : filtre par statut, état vide', async ({ page }) => {
  await page.goto('/expedition/colis?dossier=2190503')
  await expect(page.getByText('Aucun colis ne correspond aux filtres.')).toBeVisible()
  await page.goto('/expedition/colis?dossier=2190502&statut=EN_COURS')
  await expect(page.getByText('Aucun colis ne correspond aux filtres.')).toBeVisible()
  await page.goto('/expedition/colis?dossier=2190502&statut=TERMINE')
  const table = page.getByRole('table', { name: 'Colis' })
  await expect(table).toContainText('Expédié')
  // D-14 : colonnes « Récépissé », « Clos le », « Expédié le » (dates de clôture et de fin de journée renseignées).
  for (const colonne of ['Récépissé', 'Clos le', 'Expédié le'])
    await expect(table.getByRole('columnheader', { name: colonne })).toBeVisible()
  await expect(table.getByRole('row').nth(1).getByRole('cell').nth(8)).not.toHaveText('—')
  await expect(table.getByRole('row').nth(1).getByRole('cell').nth(9)).not.toHaveText('—')
})

test('ECR-EXP-03 Départs camions (D-14) : avancement du colisage par départ et destinataire, filtre, état vide', async ({
  page,
}) => {
  await page.goto('/expedition')
  await expect(page.getByTestId('shell-utilisateur')).toBeVisible()
  await page.getByTestId('onglet-expedition').click()
  await page.getByTestId('menu-expedition').getByRole('link', { name: 'Départs camions' }).click()
  await expect(page).toHaveURL(/\/expedition\/departs/)
  await expect(page.getByRole('heading', { name: 'Expédition · Départs camions' })).toBeVisible()
  await page.goto('/expedition/departs?destinataire=Destinataire+EXP+A')
  const table = page.getByRole('table', { name: 'Départs camions' })
  for (const colonne of [
    'Départ',
    'Destinations',
    'Unités',
    'Colisées / parties',
    'En cours',
    'En attente d’affiches',
    'Avancement',
  ])
    await expect(table.getByRole('columnheader', { name: colonne })).toBeVisible()
  const ligne = table.getByRole('row', { name: /Destinataire EXP A/ })
  await expect(ligne).toBeVisible()
  await expect(ligne.getByRole('progressbar')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Indicateurs' })).toContainText('Unités')
  await page.goto('/expedition/departs?destinataire=Introuvable+E2E')
  await expect(page.getByText('Aucun départ ne correspond aux filtres.')).toBeVisible()
})
