import { expect, test } from '@playwright/test'

// Étape 8, lot 2 — D-06 (ECR-ADM-05 « Règles métier »), D-02 (ECR-ADM-01 « Sites et ateliers », lecture) et D-01
// (utilisateurs). Utilisateur e2e.admin (rôle admin). Hypothèses : Q-405, Q-406.

test.describe.configure({ mode: 'serial' })

const PURGE = 'Purge des réceptions attendues après (semaines)'

test('D-06 modifier un paramètre : message, valeur conservée au rechargement, historique ; une valeur hors bornes est refusée avec son message', async ({
  page,
}) => {
  await page.goto('/admin/parametres')
  await expect(page.getByRole('heading', { name: 'Règles métier' })).toBeVisible()
  const champ = page.getByLabel(PURGE, { exact: true })
  const initiale = await champ.inputValue()
  const cible = initiale === '5' ? '6' : '5'
  await champ.fill(cible)
  await page.getByRole('button', { name: `Enregistrer ${PURGE}` }).click()
  await expect(page.getByRole('status')).toContainText(`Paramètre « ${PURGE} » enregistré`)
  await page.reload()
  await expect(page.getByLabel(PURGE, { exact: true })).toHaveValue(cible)
  await page.getByRole('button', { name: `Historique ${PURGE}` }).click()
  const modale = page.getByRole('dialog', { name: /Historique/ })
  await expect(modale.getByRole('table', { name: 'Historique des modifications' })).toContainText(
    cible,
  )
  await modale.getByRole('button', { name: 'Fermer' }).click()
  // Rejet : hors bornes (1 à 52).
  await page.getByLabel(PURGE, { exact: true }).fill('99')
  await page.getByRole('button', { name: `Enregistrer ${PURGE}` }).click()
  await expect(page.getByTestId('error-message')).toContainText('entre 1 et 52')
  // Remise de la valeur initiale (l'environnement de test reste inchangé).
  await page.reload()
  await page.getByLabel(PURGE, { exact: true }).fill(initiale)
  await page.getByRole('button', { name: `Enregistrer ${PURGE}` }).click()
  await expect(page.getByRole('status')).toContainText('enregistré')
})

test('D-06 les valeurs structurées sont en lecture seule', async ({ page }) => {
  await page.goto('/admin/parametres')
  const table = page.getByRole('table', { name: 'Paramètres Intégration' })
  await expect(table).toBeVisible()
  await expect(table.getByText('lecture seule').first()).toBeVisible()
  await expect(table.getByRole('button', { name: /^Enregistrer Routage du pliage/ })).toHaveCount(0)
})

test('D-02 sites et ateliers : lecture seule, mode Trains / Unitaire', async ({ page }) => {
  await page.goto('/admin/sites')
  await expect(page.getByRole('heading', { name: 'Sites et ateliers' })).toBeVisible()
  const table = page.getByRole('table', { name: 'Ateliers par site' })
  await expect(table).toBeVisible()
  await expect(table.getByText(/Trains \(déroulant\)|Unitaire/).first()).toBeVisible()
  // Recherche : un site inexistant ne renvoie rien (message), le filtre est appliqué par le serveur.
  await page.getByLabel('Rechercher').fill('introuvable-e2e-zzz')
  await page.getByRole('button', { name: 'Filtrer' }).click()
  await expect(page.getByText('Aucun site pour cette recherche.')).toBeVisible()
})

test('D-01 créer un utilisateur (rôle, périmètre), le retrouver, le modifier, le désactiver ; un doublon est refusé', async ({
  page,
}) => {
  const identifiant = `e2e.compte.${String(Date.now())}`
  await page.goto('/admin/utilisateurs')
  await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible()
  // La liste est chargée côté client : signe que la page est hydratée (sinon les saisies seraient réinitialisées).
  await expect(page.getByRole('table', { name: 'Liste des utilisateurs' })).toBeVisible()
  const form = page.getByRole('form', { name: 'Nouvel utilisateur' })
  await form.getByLabel('Identifiant').fill(identifiant)
  await form.getByLabel('Nom', { exact: true }).fill('Compte E2E')
  await form.getByLabel('Réception').check()
  // Premier site proposé (le seed E2E en contient).
  const site = form.getByLabel('Site')
  await expect(site.locator('option')).not.toHaveCount(1)
  await site.selectOption({ index: 1 })
  await form.getByRole('button', { name: 'Ajouter au périmètre' }).click()
  await expect(form.getByRole('list', { name: 'Périmètre' })).toBeVisible()
  await form.getByRole('button', { name: 'Créer le compte' }).click()
  await expect(page.getByRole('status')).toContainText(`Compte « ${identifiant} » créé.`)
  // Doublon refusé avec son message.
  await form.getByLabel('Identifiant').fill(identifiant)
  await form.getByLabel('Réception').check()
  await form.getByRole('button', { name: 'Créer le compte' }).click()
  await expect(page.getByTestId('error-message')).toContainText('existe déjà')
  // Recherche, modification du nom, désactivation.
  await page.getByLabel('Rechercher').fill(identifiant)
  await page.getByRole('button', { name: 'Filtrer' }).click()
  const table = page.getByRole('table', { name: 'Liste des utilisateurs' })
  const ligne = table.getByRole('row', { name: new RegExp(identifiant) })
  await expect(ligne).toContainText('Réception')
  await expect(ligne).toContainText('Actif')
  await page.getByRole('button', { name: `Modifier ${identifiant}` }).click()
  const modale = page.getByRole('dialog', { name: `Modifier ${identifiant}` })
  await modale.getByLabel('Nom', { exact: true }).fill('Compte E2E modifié')
  await modale.getByLabel('Chef d’équipe').check()
  await modale.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('status')).toContainText(`Compte « ${identifiant} » modifié.`)
  await expect(ligne).toContainText('Compte E2E modifié')
  await expect(ligne).toContainText('Chef d’équipe')
  await page.getByRole('button', { name: `Désactiver ${identifiant}` }).click()
  await expect(page.getByRole('status')).toContainText('désactivé')
  await expect(ligne).toContainText('Désactivé')
  await page.getByRole('button', { name: `Réactiver ${identifiant}` }).click()
  await expect(ligne).toContainText('Actif')
})

test('D-01 son propre compte : rôles et périmètre non modifiables (message), pas de bouton Désactiver', async ({
  page,
}) => {
  await page.goto('/admin/utilisateurs')
  await expect(page.getByRole('table', { name: 'Liste des utilisateurs' })).toBeVisible()
  await page.getByLabel('Rechercher').fill('e2e.admin')
  await page.getByRole('button', { name: 'Filtrer' }).click()
  await expect(page.getByRole('button', { name: 'Désactiver e2e.admin' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Modifier e2e.admin' }).click()
  const modale = page.getByRole('dialog', { name: 'Modifier e2e.admin' })
  await expect(modale).toContainText('C’est votre compte')
  await expect(modale.getByLabel('Administrateur')).toBeDisabled()
})
