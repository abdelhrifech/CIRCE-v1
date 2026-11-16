import { expect, test } from '@playwright/test'

// COO-P04 — « Valider » / « Annuler la validation » d'une affiche dans la fiche dossier (RG-COO-008 / 014),
// message de la maquette (RG-COO-010), étiquette rack à imprimer (RG-COO-023), état des réservations
// (RG-COO-026). Utilisateur e2e.coord ; données : apps/api/scripts/e2e-seed.ts (« Annonceur Unitaire E2E » :
// une affiche rattachée à la main, à doute).

test('RG-COO-008 / RG-COO-014 valider puis annuler la validation d’une affiche depuis la fiche dossier', async ({
  page,
}) => {
  await page.goto('/coordination?pour=fixe')
  const table = page.getByRole('table', { name: 'Dossiers' })
  await table
    .getByRole('row', { name: /Annonceur Unitaire E2E/ })
    .getByRole('button', { name: /^Ouvrir le dossier/ })
    .click()
  const fiche = page.getByRole('dialog', { name: /Annonceur Unitaire E2E · dossier/ })
  const affiches = fiche.getByRole('table', { name: 'Affiches reçues et validation admin' })
  await expect(affiches).toContainText('À confirmer : doute')
  await expect(fiche.getByRole('table', { name: 'Lignes attendues' })).toContainText('•')

  await affiches.getByRole('button', { name: /^Valider l’affiche \d+$/ }).click()
  await expect(fiche.getByRole('status')).toContainText(
    '1 affiche(s) confirmée(s) par la Coordination : n° d’affiche dans le suivi de prod, picking et étiquette rack débloqués',
  )
  await expect(affiches).toContainText('Validée par la Coordination')
  await expect(fiche.getByRole('table', { name: 'Lignes attendues' })).toContainText('✓')

  // Rejet visible : l'annulation repasse l'affiche à doute, motif « validation annulée : à refaire ».
  await affiches.getByRole('button', { name: /^Annuler la validation de l’affiche \d+$/ }).click()
  await expect(fiche.getByRole('status')).toContainText('Validation annulée')
  await expect(affiches).toContainText('À confirmer : doute')
  await expect(affiches).toContainText('Validation annulée : à refaire')

  await page.keyboard.press('Escape')
  // RG-COO-023 : l'étiquette rack demandée par la validation est proposée à l'impression, par plateforme.
  await expect(page.getByRole('region', { name: 'Étiquettes rack à imprimer' })).toContainText(
    '1 étiquette(s)',
  )
})

test('RG-X-051 / RG-COO-017 / RG-X-015 la Coordination rattache une réception inconnue (validée), puis annule et revalide depuis la fiche affiche', async ({
  page,
}) => {
  await page.goto('/reception/inconnues')
  const tableau = page.getByRole('table', { name: 'Réceptions inconnues' })
  const ligne = tableau.getByRole('row', { name: /Inconnue Coord E2E/ })
  await expect(ligne).toContainText('À identifier')
  await ligne.getByRole('cell').nth(1).click()
  await page.getByRole('tab', { name: /Préparations/ }).click()
  await page.getByRole('button', { name: /Rattacher à un autre dossier/ }).click()
  await page.getByLabel('N° de dossier, DA, annonceur ou thème').fill('Annonceur Inconnue')
  await page.getByRole('button', { name: 'Rattacher' }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('rattachée')
  await page.keyboard.press('Escape')
  await expect(tableau.getByRole('row', { name: /Inconnue Coord E2E/ })).toContainText(
    'Rattachée, à contrôler',
  )

  // ECR-REC-05 : rattachée par la Coordination = validée ; « Annuler la validation » puis « Valider ».
  await tableau
    .getByRole('row', { name: /Inconnue Coord E2E/ })
    .getByRole('button', { name: 'Fiche' })
    .click()
  const fiche = page.getByRole('dialog', { name: /^Affiche n° \d+$/ })
  const bloc = fiche.getByRole('region', { name: 'Validation admin' })
  await expect(bloc).toContainText('Validée par Coordination E2E')
  await bloc.getByRole('button', { name: 'Annuler la validation' }).click()
  await expect(fiche.getByRole('status')).toContainText('Validation annulée')
  await expect(bloc).toContainText('À confirmer : doute')
  await expect(bloc).toContainText('Rattachement proposé au dossier')
  await expect(bloc).toContainText(
    'doute : Rattachée sans le n° du BL ; Validation annulée : à refaire',
  )
  await bloc.getByRole('button', { name: 'Valider' }).click()
  await expect(fiche.getByRole('status')).toContainText(
    '1 affiche(s) confirmée(s) par la Coordination',
  )
  await expect(bloc).toContainText('Validée par Coordination E2E')
})
