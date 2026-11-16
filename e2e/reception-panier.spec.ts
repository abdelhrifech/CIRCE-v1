import { expect, test, type Page } from '@playwright/test'

// REC-P03 — panier, photo du BL, bon de livraison, modale Visuel (ECR-REC-01, 07, 11, 12).
// Données : apps/api/scripts/e2e-seed.ts (Alpha 0/10 reste 10, Bêta 4/10 reste 6 ; « Imprimeur E2E »,
// « Transporteur E2E »). Contrôles réels de l'API (POST /api/receptions/verification).

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000a49444154789c6300010000050001',
  'hex',
)

async function ouvrir(page: Page) {
  await page.goto('/reception')
  await expect(page.getByRole('table', { name: 'Réceptions attendues' }).first()).toBeVisible()
}

const ligneAlpha = (page: Page) =>
  page
    .getByRole('table', { name: 'Réceptions attendues' })
    .first()
    .getByRole('row', { name: /Annonceur Alpha/ })

test('RG-REC-021 / RG-REC-023 « Au panier » : ligne non cochée, Qté du BL = reste ; une ligne au panier n’est plus proposée', async ({
  page,
}) => {
  await ouvrir(page)
  await ligneAlpha(page).getByRole('button', { name: 'Au panier' }).click()
  await expect(page.getByTestId('message-panier')).toHaveText('1 ligne(s) ajoutée(s) au panier.')
  await expect(ligneAlpha(page)).toContainText('✓ au panier')
  const panier = page.getByRole('region', { name: 'Lignes du BL (panier)' })
  await expect(panier.getByRole('checkbox', { name: /Ligne 900001 pour ce BL/ })).not.toBeChecked()
  await expect(panier.getByRole('spinbutton', { name: /Qté du BL, dossier 900001/ })).toHaveValue(
    '10',
  )
  await expect(page.getByTestId('panier-sous-titre')).toContainText('0 cochée(s) sur 1')
})

test('RG-REC-021 « Ajouter au panier (n) » et « Vider le panier »', async ({ page }) => {
  await ouvrir(page)
  await page.getByRole('checkbox', { name: 'Sélectionner le dossier 900001' }).check()
  await page.getByRole('checkbox', { name: 'Sélectionner le dossier 900002' }).check()
  await page.getByRole('button', { name: 'Ajouter au panier (2)' }).click()
  await expect(page.getByTestId('message-panier')).toHaveText('2 ligne(s) ajoutée(s) au panier.')
  await page.getByRole('button', { name: 'Vider le panier' }).click()
  await expect(page.getByRole('region', { name: 'Lignes du BL (panier)' })).toContainText(
    'Aucune ligne.',
  )
})

test('RG-REC-026 sans photo du BL, la validation est refusée par l’API avec son message', async ({
  page,
}) => {
  await ouvrir(page)
  await ligneAlpha(page).getByRole('button', { name: 'Au panier' }).click()
  await expect(page.getByTestId('bl-a-photographier')).toBeVisible()
  await page.getByRole('checkbox', { name: /Ligne 900001 pour ce BL/ }).check()
  await page.getByRole('button', { name: /Valider la réception/ }).click()
  await expect(page.getByTestId('error-message')).toContainText(
    'Photographiez le BL avant de valider',
  )
  await expect(page.getByTestId('error-regle')).toHaveText('Règle : RG-REC-026')
})

test('RG-REC-026 / RG-REC-033 / RG-REC-038 / RG-REC-045 photo jointe, bon de livraison complet : réception validée', async ({
  page,
}) => {
  // Ligne dédiée (Epsilon, départ passé) : la validation ne modifie pas les lignes des autres tests.
  await page.goto('/reception?depart=tous&q=900005')
  const tableau = page.getByRole('table', { name: 'Réceptions attendues' })
  await expect(tableau).toBeVisible()
  await tableau
    .getByRole('row', { name: /Annonceur Epsilon/ })
    .getByRole('button', { name: 'Au panier' })
    .click()
  // RG-REC-026 : le bouton du bandeau ouvre la même modale que celui du bon de livraison.
  await page
    .getByRole('search', { name: /Trouver les dossiers du BL/ })
    .getByRole('button', { name: 'Photo du BL' })
    .click()
  await page
    .getByLabel('Fichier du BL (photo ou PDF)')
    .setInputFiles({ name: 'bl.png', mimeType: 'image/png', buffer: PNG })
  await page.getByRole('button', { name: 'Joindre le BL' }).click()
  await expect(page.getByTestId('bl-photographie')).toContainText('BL photographié (bl.png)')

  await page.getByRole('checkbox', { name: /Ligne 900005 pour ce BL/ }).check()
  // RG-REC-033 : champs obligatoires manquants → refus de l'API.
  await page.getByRole('button', { name: /Valider la réception/ }).click()
  await expect(page.getByTestId('error-message')).toContainText(
    'N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé.',
  )

  await page.getByLabel('N° de BL *').fill(`BL-E2E-${Date.now()}`)
  await page.getByLabel('Transporteur *').selectOption({ label: 'Transporteur E2E' })
  await page.getByLabel('Imprimeur *').selectOption({ label: 'Imprimeur E2E' })

  // ECR-REC-11 : « Voir le BL » montre la photo, l'imprimeur, le transporteur et le nombre de lignes.
  await page.getByRole('button', { name: 'Voir le BL' }).click()
  const modale = page.getByRole('dialog', { name: /^BL / })
  await expect(modale).toContainText('Imprimeur : Imprimeur E2E')
  await expect(modale).toContainText('Transporteur : Transporteur E2E')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Valider la réception (1 ligne)' }).click()
  await expect(page.getByTestId('message-reception')).toContainText(
    '1 ligne(s), « affiche reçue » = oui dès l’arrivée. La palette passe à l’étape 2 (contrôle).',
  )
  // RG-REC-045 : la ligne quitte le panier ; BL et imprimeur remis à zéro, transporteur conservé.
  await expect(page.getByRole('region', { name: 'Lignes du BL (panier)' })).toContainText(
    'Aucune ligne.',
  )
  await expect(page.getByLabel('N° de BL *')).toHaveValue('')
  await expect(page.getByLabel('Imprimeur *')).toHaveValue('')
  await expect(page.getByLabel('Transporteur *')).not.toHaveValue('')
  await expect(page.getByTestId('bl-a-photographier')).toBeVisible()
})

test('RG-REC-022 / RG-REC-023 une ligne décochée ne compte pas ; quantité 0 = ligne ignorée', async ({
  page,
}) => {
  await ouvrir(page)
  await page.getByRole('checkbox', { name: 'Sélectionner le dossier 900001' }).check()
  await page.getByRole('checkbox', { name: 'Sélectionner le dossier 900002' }).check()
  await page.getByRole('button', { name: 'Ajouter au panier (2)' }).click()
  const panier = page.getByRole('region', { name: 'Lignes du BL (panier)' })
  await panier.getByRole('checkbox', { name: /Ligne 900001 pour ce BL/ }).check()
  await panier.getByRole('checkbox', { name: /Ligne 900002 pour ce BL/ }).uncheck()
  await expect(page.getByTestId('panier-sous-titre')).toContainText('1 cochée(s) sur 2')
  await panier.getByRole('spinbutton', { name: /Qté du BL, dossier 900001/ }).fill('0')
  await expect(panier).toContainText('quantité 0 : ligne ignorée')
})

test('RG-REC-203 la modale Visuel montre le dossier, la DA et le reçu', async ({ page }) => {
  await ouvrir(page)
  await page.getByRole('button', { name: 'Voir le visuel du dossier 900002' }).click()
  const modale = page.getByRole('dialog', { name: /Visuel/ })
  await expect(modale).toContainText('900002 (800002)')
  await expect(modale).toContainText('4 / 10')
  await page.keyboard.press('Escape')
  await expect(modale).toHaveCount(0)
})

test('EX-NEW-REC-002 glissement puis retour : les lignes quittées retrouvent leur sélection initiale', async ({
  page,
}) => {
  await ouvrir(page)
  const table = page.getByRole('table', { name: 'Réceptions attendues' })
  const debut = await table
    .getByRole('row', { name: /Annonceur Alpha/ })
    .getByRole('cell')
    .nth(1)
    .boundingBox()
  const fin = await table
    .getByRole('row', { name: /Annonceur Bêta/ })
    .getByRole('cell')
    .nth(1)
    .boundingBox()
  if (!debut || !fin) throw new Error('Lignes Alpha / Bêta absentes')
  await page.mouse.move(debut.x + 8, debut.y + debut.height / 2)
  await page.mouse.down()
  await page.mouse.move(fin.x + 8, fin.y + fin.height / 2, { steps: 8 })
  await expect(
    table.getByRole('checkbox', { name: 'Sélectionner le dossier 900001' }),
  ).toBeChecked()
  await expect(
    table.getByRole('checkbox', { name: 'Sélectionner le dossier 900002' }),
  ).toBeChecked()
  await page.mouse.move(debut.x + 8, debut.y + debut.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(
    table.getByRole('checkbox', { name: 'Sélectionner le dossier 900001' }),
  ).toBeChecked()
  await expect(
    table.getByRole('checkbox', { name: 'Sélectionner le dossier 900002' }),
  ).not.toBeChecked()
})

test('EX-NEW-NAV-001 export Excel des lignes et colonnes visibles', async ({ page }) => {
  await ouvrir(page)
  const fichier = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter en Excel', exact: true }).click()
  expect((await fichier).suggestedFilename()).toBe('reception-index.xlsx')
})
