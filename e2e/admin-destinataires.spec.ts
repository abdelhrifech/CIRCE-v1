import { expect, test, type Page } from '@playwright/test'

// D-05 — ECR-ADM-07 « Destinataires et afficheurs » (référentiel des destinataires). Utilisateur e2e.admin ; données :
// apps/api/scripts/e2e-seed.ts (« Destinataire ADM A » et « Destinataire ADM B »). Hypothèses : Q-403.

test.describe.configure({ mode: 'serial' })

const table = (page: Page) => page.getByRole('table', { name: 'Liste des destinataires' })
const ligne = (page: Page, nom: string) => table(page).getByRole('row', { name: new RegExp(nom) })

test('D-05 créer un destinataire : il apparaît actif dans la liste ; un doublon est refusé avec son message', async ({
  page,
}) => {
  await page.goto('/coordination/destinataires')
  await expect(page.getByRole('heading', { name: 'Destinataires et afficheurs' })).toBeVisible()
  await expect(ligne(page, 'Destinataire ADM A')).toContainText('Actif')
  const nom = `Destinataire E2E ${String(Date.now())}`
  const form = page.getByRole('form', { name: 'Nouveau destinataire' })
  await form.getByLabel('Nom d’origine').fill(nom)
  await form.getByLabel('Dispatch').selectOption('O')
  await form.getByRole('button', { name: 'Ajouter' }).click()
  await expect(page.getByRole('status')).toContainText(`Destinataire « ${nom} » créé.`)
  await expect(ligne(page, nom)).toContainText('Actif')
  await expect(ligne(page, nom)).toContainText('O')
  await form.getByLabel('Nom d’origine').fill(nom)
  await form.getByRole('button', { name: 'Ajouter' }).click()
  await expect(page.getByTestId('error-message')).toContainText('existe déjà')
})

test('D-05 modifier (libellé, dispatch, adresse) puis désactiver / réactiver ; la recherche filtre', async ({
  page,
}) => {
  await page.goto('/coordination/destinataires')
  await ligne(page, 'Destinataire ADM B').getByRole('button', { name: 'Modifier' }).click()
  const modale = page.getByRole('dialog', { name: /Modifier Destinataire ADM B/ })
  await modale.getByLabel('Libellé').fill('ADM B affichage')
  await modale.getByLabel('Dispatch').selectOption('N')
  await modale.getByLabel('Localité').fill('Nîmes')
  await modale.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('status')).toContainText('Destinataire « ADM B affichage » modifié.')
  const l = ligne(page, 'ADM B affichage')
  await expect(l).toContainText('Nîmes')
  await expect(l).toContainText('N')
  await l.getByRole('button', { name: 'Désactiver' }).click()
  await expect(page.getByRole('status')).toContainText('désactivé')
  await expect(ligne(page, 'ADM B affichage')).toContainText('Désactivé')
  await ligne(page, 'ADM B affichage').getByRole('button', { name: 'Réactiver' }).click()
  await expect(ligne(page, 'ADM B affichage')).toContainText('Actif')
  await page.getByLabel('Rechercher').fill('Destinataire ADM A')
  await page.getByRole('button', { name: 'Filtrer' }).click()
  await expect(table(page).getByRole('row', { name: /ADM B affichage/ })).toHaveCount(0)
  await expect(ligne(page, 'Destinataire ADM A')).toBeVisible()
})
