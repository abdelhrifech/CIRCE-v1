import { expect, test, type Page } from '@playwright/test'

// REC-P04 à REC-P10 — parcours nominal de bout en bout sur l'API réelle (base de test).
// Données : apps/api/scripts/e2e-seed.ts — lignes dédiées Zêta 900006 et Êta 900007 (départ passé),
// « Imprimeur E2E », « Transporteur E2E », agent « Agent E2E » (e2e.recep, rôle recep).
// L'impression est rendue par le navigateur : window.print est neutralisé dans le test.

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000a49444154789c6300010000050001',
  'hex',
)

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'print', { value: () => undefined })
  })
})

async function photographierBl(page: Page) {
  await page.getByRole('button', { name: 'Photographier le BL' }).last().click()
  await page
    .getByLabel('Fichier du BL (photo ou PDF)')
    .setInputFiles({ name: 'bl.png', mimeType: 'image/png', buffer: PNG })
  await page.getByRole('button', { name: 'Joindre le BL' }).click()
}

const bl = `BL-PARCOURS-${Date.now()}`

test('REC-P04 / REC-P05 / REC-P06 valider la réception, contrôler la palette, imprimer la feuille définitive', async ({
  page,
}) => {
  await page.goto('/reception?depart=tous&q=900006')
  const attendues = page.getByRole('table', { name: 'Réceptions attendues' })
  await expect(attendues).toBeVisible()
  await attendues
    .getByRole('row', { name: /Annonceur Zêta/ })
    .getByRole('button', { name: 'Au panier' })
    .click()
  await page.getByRole('checkbox', { name: /Ligne 900006 pour ce BL/ }).check()
  await photographierBl(page)
  await page.getByLabel('N° de BL *').fill(bl)
  await page.getByLabel('Transporteur *').selectOption({ label: 'Transporteur E2E' })
  await page.getByLabel('Imprimeur *').selectOption({ label: 'Imprimeur E2E' })
  await page.getByRole('button', { name: 'Valider la réception (1 ligne)' }).click()
  await expect(page.getByTestId('message-reception')).toContainText('La palette passe à l’étape 2')

  // ECR-REC-02 : la palette est dans le sas.
  const sas = page.getByRole('table', { name: 'Palettes à contrôler' })
  const palette = sas.getByRole('row', { name: new RegExp(bl) })
  await expect(palette).toContainText('Imprimeur E2E')
  await palette.getByRole('button', { name: 'Contrôler' }).click()
  const controle = page.getByRole('region', { name: /Contrôle de la palette · réception R/ })
  await expect(controle).toContainText('Annonceur Zêta')

  // RG-REC-067 : sans contrôleur → refus de l'API, message de la maquette.
  await controle.getByLabel(/^Allée, affiche/).fill('b')
  await controle.getByLabel(/^Rayon, affiche/).fill('7')
  await controle.getByRole('button', { name: 'Valider et imprimer' }).click()
  await expect(controle.getByTestId('error-message')).toContainText(
    'Le nom du contrôleur est obligatoire (REC-12).',
  )

  await controle.getByLabel('Contrôleur (obligatoire)').selectOption({ label: 'Agent E2E' })
  await controle.getByRole('button', { name: 'Valider et imprimer' }).click()

  // ECR-REC-09 : aperçu des feuilles de stock (définitive), impression avec étiquettes rack.
  const apercu = page.getByRole('dialog', { name: 'Aperçu avant impression' })
  await expect(apercu.getByTestId('resume-feuilles')).toHaveText(
    '1 feuille(s) : 1 définitive(s), 0 temporaire(s).',
  )
  await expect(apercu.getByTestId('feuille-stock').first()).toContainText(
    'FEUILLE DE STOCK DÉFINITIVE',
  )
  await expect(apercu.getByTestId('feuille-stock').first()).toContainText('B - 7')
  // RG-REC-086 : 2 exemplaires rendus (le second n'apparaît qu'à l'impression).
  await expect(apercu.getByTestId('feuille-stock')).toHaveCount(2)
  await expect(apercu.getByRole('img', { name: /^Code-barres A-\d{13}$/ }).first()).toBeVisible()
  await apercu
    .getByRole('button', { name: 'Imprimer (2 exemplaires) et les étiquettes rack' })
    .click()
  await expect(apercu).toHaveCount(0)
  await expect(controle).toHaveCount(0)
})

test('REC-P07 réception inconnue : création (refus puis succès), puis identification et rattachement', async ({
  page,
}) => {
  await page.goto('/reception')
  await expect(page.getByRole('table', { name: 'Réceptions attendues' })).toBeVisible()
  await page.getByRole('button', { name: 'Réception inconnue' }).click()
  const modale = page.getByRole('dialog', { name: 'Réception inconnue' })
  await modale.getByLabel('Annonceur lu sur l’affiche').fill('ETA LU')
  await modale.getByLabel('Thème ou description').fill('affiche bleue')
  await modale.getByLabel('Quantité comptée').fill('5')
  await modale.getByLabel('Palette arrivée sans BL').check()
  // RG-REC-097 : rayon vide → refus.
  await modale
    .getByRole('button', { name: 'Créer, ranger et imprimer la feuille temporaire' })
    .click()
  await expect(modale.getByTestId('error-message')).toContainText(
    'Allée et rayon sont obligatoires : ils sont imprimés sur la feuille temporaire.',
  )
  await expect(modale.getByLabel('Allée (zone tampon des réceptions inconnues)')).toHaveValue('X')
  await modale.getByLabel('Rayon (obligatoire)').fill('3')
  await modale
    .getByRole('button', { name: 'Créer, ranger et imprimer la feuille temporaire' })
    .click()

  const apercu = page.getByRole('dialog', { name: 'Aperçu avant impression' })
  await expect(apercu.getByTestId('feuille-stock').first()).toContainText(
    'FEUILLE DE STOCK TEMPORAIRE',
  )
  await apercu.getByRole('button', { name: /^Imprimer \(2 exemplaires\)$/ }).click()
  await expect(page.getByTestId('message-reception')).toContainText(
    'rangée en X-3. La Coordination est prévenue',
  )

  // ECR-REC-04 : identifier par n° de dossier et rattacher.
  await page.getByTestId('onglet-reception').click()
  await page
    .getByTestId('menu-reception')
    .getByRole('link', { name: /Réceptions inconnues/ })
    .click()
  const tableau = page.getByRole('table', { name: 'Réceptions inconnues' })
  await expect(tableau.getByRole('row', { name: /ETA LU/ })).toContainText('À identifier')
  await tableau
    .getByRole('row', { name: /ETA LU/ })
    .getByRole('button', { name: 'Fiche' })
    .click()
  await page.getByRole('tab', { name: /Préparations/ }).click()
  await page.getByRole('button', { name: /Rattacher à un autre dossier/ }).click()
  await page.getByLabel('N° de dossier, DA, annonceur ou thème').fill('900007')
  await page.getByRole('button', { name: 'Rattacher' }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('rattachée')
  await page.keyboard.press('Escape')
  await expect(tableau.getByRole('row', { name: /ETA LU|Annonceur Êta/ })).toContainText(
    'Rattachée, à contrôler',
  )
})

test('REC-P08 liste des affiches et fiche affiche : onglets, modification enregistrée', async ({
  page,
}) => {
  await page.goto('/reception/affiches')
  const liste = page.getByRole('table', { name: 'Liste des affiches' })
  await expect(liste).toBeVisible()
  await liste
    .getByRole('row', { name: /Annonceur Zêta/ })
    .getByRole('cell')
    .nth(1)
    .click()
  const fiche = page.getByRole('dialog', { name: /^Affiche n° \d+$/ })
  await expect(fiche).toContainText('Identifiée')
  await fiche.getByRole('tab', { name: 'Mouvements' }).click()
  await expect(fiche.getByRole('table', { name: 'Mouvements' })).toContainText('Réception')
  await fiche.getByRole('tab', { name: /Préparations \(1\)/ }).click()
  await expect(fiche.getByRole('table', { name: 'Préparations' })).toContainText('900006')
  await fiche.getByRole('tab', { name: 'Détail' }).click()
  await fiche.getByLabel('Commentaire').fill('Contrôlé en E2E')
  await fiche.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(fiche.getByRole('status')).toHaveText('Fiche affiche modifiée.')
  await fiche.getByRole('tab', { name: 'Historique' }).click()
  await expect(fiche.getByRole('list', { name: 'Historique' })).toContainText(
    'MODIFICATION_COMMENTAIRE',
  )
})

test('REC-P08 / RG-REC-090 « Étiquettes rack » en lot : aperçu en mode étiquette, impression en un clic', async ({
  page,
}) => {
  await page.goto('/reception/affiches')
  const liste = page.getByRole('table', { name: 'Liste des affiches' })
  const ligneZeta = liste.getByRole('row', { name: /Annonceur Zêta/ })
  await ligneZeta.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Étiquettes rack' }).click()
  const apercu = page.getByRole('dialog', { name: 'Étiquettes rack' })
  await expect(apercu.getByTestId('feuille-stock').first()).toContainText(
    'FEUILLE DE STOCK DÉFINITIVE',
  )
  await apercu.getByRole('button', { name: 'Imprimer 1 étiquette(s) rack' }).click()
  await expect(apercu).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'étiquette' })).toHaveText(
    '1 étiquette(s) rack imprimée(s) en un clic.',
  )
})

test('REC-P10 alertes : la feuille définitive à imprimer de l’affiche rattachée est signalée', async ({
  page,
}) => {
  await page.goto('/reception/alertes')
  await expect(page.getByRole('table', { name: 'Alertes' })).toContainText(
    'Feuille de stock définitive à imprimer',
  )
})
