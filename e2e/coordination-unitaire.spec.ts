import { expect, test, type Page } from '@playwright/test'

// COO-P12 — ECR-COO-09 : Préparation 2 m² fixe / Pliage / Bus (RG-COO-238, 239, 243, 244, 246, 247, 249, 250, 304).
// Utilisateur e2e.coord ; données : apps/api/scripts/e2e-seed.ts (site « UNI », dossiers 2190401 à 2190406). La
// libération de la semaine (RG-COO-240 à 242) et Colisage (RG-COO-260 à 262) : Q-265, option (c) par défaut ; dossier
// 2190407 (atelier « Fixe E2E LIB », support de 10 par UM). L'impression est un aperçu
// navigateur (Q-002, Q-287).

test.describe.configure({ mode: 'serial' })

const unites = (page: Page) => page.getByRole('table', { name: 'Unités de préparation' })
const ligne = (page: Page, texte: RegExp) => unites(page).getByRole('row', { name: texte })

test('RG-COO-238 / 239 liste de la préparation 2 m² fixe : entretien à l’afficheur, libération annoncée, quantité modifiée', async ({
  page,
}) => {
  await page.goto('/coordination/unitaire?dossier=2190401')
  const l = ligne(page, /Thème unitaire E2E/)
  await expect(l).toContainText('Destinataire UNI A')
  // 20 affiches : entretien 8 % arrondi au supérieur = 2, total 22.
  await expect(l.getByRole('cell').nth(5)).toHaveText('20')
  await expect(l.getByRole('cell').nth(6)).toHaveText('2')
  await expect(l.getByRole('cell').nth(7)).toHaveText('22')
  await expect(page.getByTestId('liberation')).toContainText('pas encore libérée')
  await l.getByRole('button', { name: 'Quantité' }).click()
  const modale = page.getByRole('dialog', { name: 'Modifier la quantité à produire' })
  await modale.getByLabel('Quantité').fill('30')
  await modale.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('status')).toContainText('Quantité à produire mise à jour : 20 → 30.')
  await expect(
    ligne(page, /Thème unitaire E2E/)
      .getByRole('cell')
      .nth(6),
  ).toHaveText('3')
  await expect(
    ligne(page, /Thème unitaire E2E/)
      .getByRole('cell')
      .nth(7),
  ).toHaveText('33')
})

test('RG-COO-244 corriger l’intitulé : champs vides refusés, puis correction (Pré-Prod prévenue, feuille à refaire)', async ({
  page,
}) => {
  await page.goto('/coordination/unitaire?dossier=2190401')
  await ligne(page, /Thème unitaire E2E/)
    .getByRole('button', { name: 'Corriger l’intitulé' })
    .click()
  const modale = page.getByRole('dialog', { name: 'Corriger l’intitulé' })
  await expect(
    modale.getByLabel('Prévenir la Pré-Prod, pour aligner Broadcast si besoin'),
  ).toBeChecked()
  await modale.getByLabel('Thème').fill('   ')
  await modale.getByRole('button', { name: 'Corriger' }).click()
  await expect(modale.getByTestId('error-message')).toContainText(
    'Le thème et l’annonceur ne peuvent pas être vides.',
  )
  await modale.getByLabel('Thème').fill('Thème corrigé E2E')
  await modale.getByLabel('Annonceur imprimé').fill('Annonceur corrigé')
  await modale.getByRole('button', { name: 'Corriger' }).click()
  await expect(page.getByRole('status')).toContainText('Intitulé corrigé sur 1 unité(s)')
  await expect(page.getByRole('status')).toContainText('mail à la Pré-Prod mis en file')
  const l = ligne(page, /Thème corrigé E2E/)
  await expect(l).toContainText('corrigé par la plateforme')
  await expect(l).toContainText('Annonceur corrigé')
})

test('RG-COO-250 / 249 préparer une UM, puis retirer une autre ; un retrait impossible est refusé', async ({
  page,
}) => {
  await page.goto('/coordination/unitaire?dossier=2190402')
  const prep = ligne(page, /Thème à préparer E2E/)
  await expect(prep).toContainText('En cours')
  await prep.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Préparer', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('1 UM préparée(s).')
  await expect(ligne(page, /Thème à préparer E2E/)).toContainText('Préparé')
  // « Préparé » ne se retire plus : refus visible (transition interdite).
  await ligne(page, /Thème à préparer E2E/)
    .getByRole('checkbox')
    .check()
  await page.getByRole('button', { name: 'Retirer' }).click()
  await expect(page.getByTestId('error-message')).toContainText(
    'ne peut plus être retirée (point de non-retour)',
  )

  await page.goto('/coordination/unitaire?dossier=2190403')
  const ret = ligne(page, /Thème à retirer E2E/)
  await ret.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Retirer' }).click()
  await expect(page.getByRole('status')).toContainText('1 UM retirée(s)')
  // RG-COO-241 : la semaine n'est pas libérée, la ligne A traiter est donc « à libérer ».
  await expect(ligne(page, /Thème à retirer E2E/)).toContainText('À libérer')
  await expect(
    ligne(page, /Thème à retirer E2E/)
      .getByText('—')
      .first(),
  ).toBeVisible()
})

test('RG-COO-243 rendre la main à la Pré-Prod : motif par défaut, unités rendues avec le repère « main rendue »', async ({
  page,
}) => {
  await page.goto('/coordination/unitaire?dossier=2190404')
  const l = ligne(page, /Thème à rendre E2E/)
  await l.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Rendre la main à la Pré-Prod' }).click()
  const modale = page.getByRole('dialog', { name: 'Rendre la main à la Pré-Prod' })
  await expect(modale.getByLabel('Motif')).toHaveValue('Changement de visuel demandé par le client')
  await modale.getByRole('button', { name: 'Rendre la main' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Main rendue à la Pré-Prod : 1 unité(s) rendue(s).',
  )
  await expect(ligne(page, /Thème à rendre E2E/)).toContainText('main rendue')
  await page.goto('/coordination/unitaire?repere=RENDU&dossier=2190404')
  await expect(ligne(page, /Thème à rendre E2E/)).toBeVisible()
})

test('RG-COO-247 pliage : comptage avec écart (alerte qualité) puis unités « Préparé »', async ({
  page,
}) => {
  await page.goto('/coordination/unitaire?type=pliage&dossier=2190405')
  const l = ligne(page, /Thème pliage E2E/)
  await l.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Plié : saisir le comptage' }).click()
  const modale = page.getByRole('dialog', { name: 'Plié : saisir le comptage' })
  await expect(modale).toContainText('Attendu : 22 affiche(s).')
  await modale.getByLabel('Affiches comptées').fill('20')
  await modale.getByRole('button', { name: 'Valider le comptage' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Écart de comptage : 2 affiche(s). Alerte qualité créée.',
  )
  await expect(ligne(page, /Thème pliage E2E/)).toContainText('Préparé')
})

test('RG-COO-304 / 305 bus : quantités à encoller par centre, ajustement global enregistré', async ({
  page,
}) => {
  await page.goto('/coordination/unitaire?type=bus')
  await expect(ligne(page, /Thème bus E2E/)).toContainText('Centre bus UNI')
  await page.getByRole('button', { name: 'Quantités à encoller' }).click()
  const modale = page.getByRole('dialog', { name: 'Quantités à encoller' })
  const centre = modale
    .getByRole('table', { name: 'Centres bus' })
    .getByRole('row', { name: /Centre bus UNI/ })
  await expect(centre).toContainText('100')
  await expect(centre).toContainText('128')
  await modale.getByLabel('Ajustement global (%)').fill('10')
  await modale.getByRole('button', { name: 'Enregistrer et éditer les états de collage' }).click()
  await expect(page.getByRole('status')).toContainText('Quantités à encoller enregistrées')
  await page.getByRole('button', { name: 'Quantités à encoller' }).click()
  await expect(
    page
      .getByRole('dialog', { name: 'Quantités à encoller' })
      .getByRole('table', { name: 'Centres bus' })
      .getByRole('row', { name: /Centre bus UNI/ }),
  ).toContainText('141')
})

test('RG-COO-246 fiche de synthèse groupée par destinataire (impression côté navigateur)', async ({
  page,
}) => {
  await page.goto('/coordination/unitaire?dossier=2190401')
  // La page est rendue côté serveur : le clic n'est pris en compte qu'une fois la liste chargée (hydratation).
  await expect(ligne(page, /Thème corrigé E2E/)).toBeVisible()
  await page.getByRole('button', { name: 'Fiche de synthèse' }).click()
  const modale = page.getByRole('dialog', { name: 'Fiche de synthèse' })
  const tableau = modale.getByRole('table', { name: 'Synthèse par destinataire' })
  await expect(tableau).toContainText('Destinataire UNI A')
  await expect(tableau).toContainText('Thème corrigé E2E')
  await expect(tableau.getByRole('row', { name: /Total général/ })).toContainText('33')
  await expect(modale.getByRole('button', { name: 'Imprimer la fiche' })).toBeVisible()
  // D-18 : à l'impression (média « print »), seule l'édition est visible (en-tête, filtres) : plus de page blanche.
  await page.emulateMedia({ media: 'print' })
  const edition = page.getByTestId('edition')
  await expect(edition).toBeVisible()
  await expect(edition.getByRole('heading', { name: /^Fiche de synthèse · / })).toBeVisible()
  await expect(edition).toContainText('N° de dossier : 2190401')
  await expect(edition).toContainText('Édité le')
  await expect(modale.getByRole('button', { name: 'Imprimer la fiche' })).toBeHidden()
  await expect(page.locator('[role="dialog"]')).toHaveCSS('position', 'static')
  await page.emulateMedia({ media: 'screen' })
})

test('RG-COO-241 / 240 ligne « à libérer » : « Libérer la semaine » (sans créer d’UM), puis la ligne n’est plus « à libérer »', async ({
  page,
}) => {
  await page.goto('/coordination/unitaire?dossier=2190407')
  const l = ligne(page, /Thème libération E2E/)
  await expect(l).toContainText('À libérer')
  await expect(page.getByTestId('liberation')).toContainText(
    'pas encore libérée vers l’atelier Fixe E2E LIB',
  )
  await page.getByRole('button', { name: /^Libérer la W/ }).click()
  await expect(page.getByRole('status')).toContainText("libérée vers l'atelier « Fixe E2E LIB »")
  await expect(page.getByTestId('liberation')).toContainText('libérée vers l’atelier Fixe E2E LIB')
  await expect(ligne(page, /Thème libération E2E/)).not.toContainText('À libérer')
  await expect(ligne(page, /Thème libération E2E/)).toContainText('À traiter')
  // Une seconde libération n'est plus proposée (une seule par atelier et semaine).
  await expect(page.getByRole('button', { name: /^Libérer la W/ })).toHaveCount(0)
})

test('RG-COO-260 / 261 / 262 Colisage : 25 affiches à 10 par UM donnent 3 UM « En cours » ; un second Colisage est refusé', async ({
  page,
}) => {
  await page.goto('/coordination/unitaire?dossier=2190407')
  await ligne(page, /Thème libération E2E/)
    .getByRole('checkbox')
    .check()
  await page.getByRole('button', { name: 'Colisage' }).click()
  await expect(page.getByRole('status')).toContainText('3 UM créée(s).')
  const l = ligne(page, /Thème libération E2E/)
  await expect(l).toContainText('En cours')
  await expect(l).toContainText(/UM-\d{4}/)
  await l.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Colisage' }).click()
  await expect(page.getByTestId('error-message')).toContainText(
    /déjà dans une UM|Transition interdite/i,
  )
})
