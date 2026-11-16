import { expect, test, type Page } from '@playwright/test'

// ÉTAPE 7 — parcours de bout en bout Réception ↔ Coordination (RG-X-001, 005, 013, 015, 028, 050, 053, 058, 063).
// Deux acteurs : l'agent de réception (e2e.recep, web 3100 : projet « reception ») et la Coordination
// (e2e.coord, web 3102). Données : apps/api/scripts/e2e-seed.ts (« Annonceur Interactions E2E », une ligne
// attendue 10 affiches, départ passé). Les tests s'enchaînent (mode serial) sur la même affiche.

test.describe.configure({ mode: 'serial' })

const COORD = 'http://127.0.0.1:3102'
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000a49444154789c6300010000050001',
  'hex',
)
const ANNONCEUR = /Annonceur Interactions E2E/

async function coordination(page: Page, chemin: string) {
  const p = await page.context().newPage()
  await p.goto(`${COORD}${chemin}`)
  return p
}

async function ficheCoordination(p: Page) {
  const table = p.getByRole('table', { name: 'Dossiers' })
  await expect(table).toBeVisible()
  const ligne = table.getByRole('row', { name: ANNONCEUR })
  await ligne.getByRole('button', { name: /^Ouvrir le dossier/ }).click()
  return p.getByRole('dialog', { name: /Annonceur Interactions E2E · dossier/ })
}

async function ficheAffiche(page: Page) {
  await page.goto('/reception/affiches')
  const liste = page.getByRole('table', { name: 'Liste des affiches' })
  await expect(liste).toBeVisible()
  await liste.getByRole('row', { name: ANNONCEUR }).getByRole('cell').nth(1).click()
  return page.getByRole('dialog', { name: /^Affiche n° \d+$/ })
}

test('RG-X-001 / RG-X-005 / RG-X-028 la Réception reçoit le BL : la Coordination voit une proposition « à confirmer », rien n’est validé', async ({
  page,
}) => {
  // Réception (ECR-REC-01) : panier, photo du BL, bon de livraison, validation.
  await page.goto('/reception?depart=tous&q=Interactions E2E')
  const tableau = page.getByRole('table', { name: 'Réceptions attendues' })
  await expect(tableau).toBeVisible()
  await tableau
    .getByRole('row', { name: ANNONCEUR })
    .getByRole('button', { name: 'Au panier' })
    .click()
  await page
    .getByRole('search', { name: /Trouver les dossiers du BL/ })
    .getByRole('button', { name: 'Photo du BL' })
    .click()
  await page
    .getByLabel('Fichier du BL (photo ou PDF)')
    .setInputFiles({ name: 'bl.png', mimeType: 'image/png', buffer: PNG })
  await page.getByRole('button', { name: 'Joindre le BL' }).click()
  await expect(page.getByTestId('bl-photographie')).toContainText('BL photographié (bl.png)')
  await page.getByLabel('N° de BL *').fill(`BL-IX-${Date.now()}`)
  await page.getByLabel('Transporteur *').selectOption({ label: 'Transporteur E2E' })
  await page.getByLabel('Imprimeur *').selectOption({ label: 'Imprimeur E2E' })
  await page
    .getByRole('region', { name: 'Lignes du BL (panier)' })
    .getByRole('checkbox', { name: /Ligne .* pour ce BL/ })
    .check()
  await page.getByRole('button', { name: 'Valider la réception (1 ligne)' }).click()
  await expect(page.getByTestId('message-reception')).toContainText(
    '« affiche reçue » = oui dès l’arrivée. La palette passe à l’étape 2 (contrôle).',
  )

  // Coordination : le dossier est « À confirmer (1) », l’affiche est une proposition (RG-X-001, RG-X-063).
  const coord = await coordination(page, '/coordination?pour=fixe')
  const fiche = await ficheCoordination(coord)
  const affiches = fiche.getByRole('table', { name: 'Affiches reçues et validation admin' })
  await expect(affiches).toContainText('À confirmer')
  await expect(affiches).not.toContainText('Validée par la Coordination')
  await coord.close()
})

test('RG-X-015 / RG-X-063 la Réception ne valide pas : la fiche affiche l’indique, aucun bouton « Valider »', async ({
  page,
}) => {
  const fiche = await ficheAffiche(page)
  const bloc = fiche.getByRole('region', { name: 'Validation admin' })
  await expect(bloc).toContainText('À confirmer')
  await expect(bloc.getByRole('button', { name: 'Valider' })).toHaveCount(0)
  await expect(bloc.getByRole('button', { name: 'Annuler la validation' })).toHaveCount(0)

  // Rejet côté serveur (le front n'est qu'un confort) : l'agent de réception qui tente de valider reçoit 403.
  const titre = (await fiche.getByRole('heading').first().textContent()) ?? ''
  const afficheId = /(\d+)/.exec(titre)?.[1]
  expect(afficheId).toBeDefined()
  const r = await page.request.post(`/api/affiches/${String(afficheId)}/validation-admin`, {
    headers: { 'Idempotency-Key': `ix-403-${String(Date.now())}` },
    data: { version: 1, valider: true },
  })
  expect(r.status()).toBe(403)
  await expect(bloc).toContainText('À confirmer')
})

test('RG-X-050 / RG-X-053 la Coordination valide puis annule : la Réception le voit sur la fiche affiche, le stock ne bouge pas', async ({
  page,
}) => {
  const coord = await coordination(page, '/coordination?pour=fixe')
  const fiche = await ficheCoordination(coord)
  const affiches = fiche.getByRole('table', { name: 'Affiches reçues et validation admin' })
  await affiches.getByRole('button', { name: /^Valider l’affiche \d+$/ }).click()
  await expect(fiche.getByRole('status')).toContainText(
    '1 affiche(s) confirmée(s) par la Coordination',
  )
  await expect(affiches).toContainText('Validée par la Coordination')

  // Réception : la fiche affiche porte la validation faite par la Coordination.
  const ficheRec = await ficheAffiche(page)
  const bloc = ficheRec.getByRole('region', { name: 'Validation admin' })
  await expect(bloc).toContainText('Validée par Coordination E2E')
  await ficheRec.getByRole('tab', { name: 'Mouvements' }).click()
  await expect(ficheRec.getByRole('table', { name: 'Mouvements' })).toContainText('Réception')
  await page.keyboard.press('Escape')

  // Annulation côté Coordination : aucun mouvement créé, la Réception voit « à confirmer » (RG-X-050).
  await affiches.getByRole('button', { name: /^Annuler la validation de l’affiche \d+$/ }).click()
  await expect(fiche.getByRole('status')).toContainText('Validation annulée')
  const ficheRec2 = await ficheAffiche(page)
  await expect(ficheRec2.getByRole('region', { name: 'Validation admin' })).toContainText(
    'À confirmer',
  )
  await ficheRec2.getByRole('tab', { name: 'Mouvements' }).click()
  await expect(ficheRec2.getByRole('table', { name: 'Mouvements' }).getByRole('row')).toHaveCount(2) // en-tête + l'unique mouvement de réception
  await coord.close()
})

test('RG-X-013 / RG-X-058 la Réception retire le dernier dossier : l’affiche redevient une réception inconnue, la Coordination ne la voit plus', async ({
  page,
}) => {
  const fiche = await ficheAffiche(page)
  await fiche.getByRole('tab', { name: /Préparations \(1\)/ }).click()
  await fiche
    .getByRole('table', { name: 'Préparations' })
    .getByRole('button', { name: 'Retirer' })
    .click()
  await expect(fiche.getByRole('status')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/reception/inconnues')
  const inconnues = page.getByRole('table', { name: 'Réceptions inconnues' })
  await expect(inconnues).toBeVisible()
  await expect(inconnues.getByRole('row', { name: ANNONCEUR })).toContainText('À identifier')

  // Coordination : plus aucune affiche à confirmer sur ce dossier, il sort du filtre par défaut (« À faire »).
  const coord = await coordination(page, '/coordination?pour=fixe')
  const table = coord.getByRole('table', { name: 'Dossiers' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('row', { name: ANNONCEUR })).toHaveCount(0)
  await coord.close()
})
