import { expect, test, type Page } from '@playwright/test'

// COO-P01 — ECR-COO-01 (socle) avec l'utilisateur e2e.coord (rôle coord) ; données :
// apps/api/scripts/e2e-seed.ts (dossier « Annonceur Coordination E2E » : instruction INSTRUCTION_OK avec
// 2 faces dont une d'entretien, instruction EN_COURS ; dossier « Annonceur Annulé E2E »).

test.describe.configure({ mode: 'serial' })

async function ouvrir(page: Page) {
  await page.goto('/coordination?aFaire=TOUS')
  await expect(page.getByRole('table', { name: 'Dossiers' })).toBeVisible()
}

const ligne = (page: Page, annonceur: RegExp) =>
  page.getByRole('table', { name: 'Dossiers' }).getByRole('row', { name: annonceur })

const instructionEnCours = (page: Page) =>
  ligne(page, /Annonceur Coordination E2E/)
    .getByRole('listitem')
    .filter({ hasText: /^E2EENC/ })

test('RG-COO-063 / RG-COO-062 / RG-COO-040 la liste montre la préparation et les instructions ; dossier annulé : « — »', async ({
  page,
}) => {
  await ouvrir(page)
  await expect(page.getByRole('note')).toContainText(
    'Aucune validation sans vous : Circé propose, vous confirmez.',
  )
  const dossier = ligne(page, /Annonceur Coordination E2E/)
  await expect(dossier).toContainText('Reçue')
  await expect(dossier).toContainText('Instruction ok')
  await expect(dossier).toContainText('En cours')
  const annule = ligne(page, /Annonceur Annulé E2E/)
  await expect(annule).toContainText('Annulé')
  // RG-COO-062 : aucune action sur les instructions (seule la fiche s'ouvre).
  await expect(
    annule.getByRole('button', { name: /^(Annuler|Remettre à traiter|Repasser en cours)$/ }),
  ).toHaveCount(0)
  await expect(annule.getByRole('checkbox')).toHaveCount(0)
})

test('RG-COO-040 conflit : une instruction modifiée entre-temps est refusée avec le message du serveur', async ({
  page,
}) => {
  await ouvrir(page)
  await instructionEnCours(page).getByRole('button', { name: 'Annuler' }).click()
  const modale = page.getByRole('dialog', { name: /^Annuler l’instruction E2EENC/ })
  await expect(modale).toBeVisible()
  // Un autre utilisateur annule la même instruction pendant ce temps (même relais, autre clé).
  const code = ((await modale.getByRole('heading').textContent()) ?? '').split(' ').pop() ?? ''
  const liste = (await (await page.request.get(`/api/coordination/dossiers`)).json()) as {
    items: { instructions: { code: string; version: number }[] }[]
  }
  const version = liste.items.flatMap((d) => d.instructions).find((i) => i.code === code)?.version
  const r = await page.request.post(`/api/coordination/instructions/${code}/statut`, {
    headers: { 'idempotency-key': `e2e-${String(Date.now())}` },
    data: { version, vers: 'ANNULE' },
  })
  expect(r.status()).toBe(200)
  await modale.getByRole('button', { name: 'Confirmer' }).click()
  await expect(modale.getByTestId('error-message')).toContainText('Conflit')
  await page.keyboard.press('Escape')
})

test('RG-COO-045 « Remettre à traiter » une instruction annulée', async ({ page }) => {
  await ouvrir(page)
  await instructionEnCours(page).getByRole('button', { name: 'Remettre à traiter' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click()
  await expect(page.getByRole('status')).toContainText(': À traiter.')
  await expect(instructionEnCours(page)).toContainText('À traiter · prépa pas reçue')
})

test('RG-COO-046 retour arrière de l’Instruction OK : avertissement puis calcul des trains effacé', async ({
  page,
}) => {
  await ouvrir(page)
  const iok = ligne(page, /Annonceur Coordination E2E/)
    .getByRole('listitem')
    .filter({ hasText: /^E2EIOK/ })
  await iok.getByRole('button', { name: 'Repasser en cours' }).click()
  const modale = page.getByRole('dialog')
  await expect(modale.getByRole('note')).toContainText(
    'Le calcul des trains de cette instruction sera effacé',
  )
  await modale.getByRole('button', { name: 'Confirmer' }).click()
  await expect(page.getByRole('status')).toContainText(
    "Calcul des trains effacé (1 face(s) remise(s) à blanc, 1 face(s) d'entretien supprimée(s)).",
  )
  await expect(iok).toContainText('En cours')
})
