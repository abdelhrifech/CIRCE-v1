import { expect, test } from '@playwright/test'

// Étape 8, lot 3 — D-04 (ECR-ADM-07 référentiels de réception), D-03 (plateformes : coordonnées, mails de réception,
// imprimantes) et D-08 (ECR-ADM-04 règles d'alerte). Utilisateur e2e.admin (rôle admin). Hypothèses : Q-407, Q-408.

test.describe.configure({ mode: 'serial' })

test('D-04 imprimeur et livreur : ajout, doublon refusé avec son message, désactivation ; agents de réception en lecture seule', async ({
  page,
}) => {
  const imprimeur = `E2E Imprimeur ${String(Date.now())}`
  await page.goto('/admin/referentiels')
  await expect(page.getByRole('heading', { name: 'Référentiels de réception' })).toBeVisible()
  const cartes = {
    imprimeurs: page.getByRole('region', { name: 'Imprimeurs' }),
    livreurs: page.getByRole('region', { name: 'Livreurs' }),
    agents: page.getByRole('region', { name: 'Agents de réception' }),
  }
  // Les listes sont chargées côté client : signe que la page est hydratée.
  await expect(cartes.imprimeurs.getByRole('list', { name: 'Liste Imprimeurs' })).toBeVisible()
  await cartes.imprimeurs.getByLabel('Nouvel imprimeur').fill(imprimeur)
  await cartes.imprimeurs.getByRole('button', { name: '+ Ajouter un imprimeur' }).click()
  await expect(cartes.imprimeurs.getByRole('status')).toContainText(`« ${imprimeur} » ajouté.`)
  await expect(cartes.imprimeurs.getByRole('list', { name: 'Liste Imprimeurs' })).toContainText(
    imprimeur,
  )
  // Rejet : le doublon (casse ignorée) est refusé avec son message.
  await cartes.imprimeurs.getByLabel('Nouvel imprimeur').fill(imprimeur.toUpperCase())
  await cartes.imprimeurs.getByRole('button', { name: '+ Ajouter un imprimeur' }).click()
  await expect(cartes.imprimeurs.getByTestId('error-message')).toContainText('existe déjà')
  // Désactivation puis réactivation.
  await cartes.imprimeurs.getByRole('button', { name: `Désactiver ${imprimeur}` }).click()
  await expect(cartes.imprimeurs.getByRole('status')).toContainText('désactivé')
  await expect(
    cartes.imprimeurs.getByRole('button', { name: `Réactiver ${imprimeur}` }),
  ).toBeVisible()
  // Livreur.
  const livreur = `E2E Livreur ${String(Date.now())}`
  await cartes.livreurs.getByLabel('Nouveau livreur').fill(livreur)
  await cartes.livreurs.getByRole('button', { name: '+ Ajouter un livreur' }).click()
  await expect(cartes.livreurs.getByRole('status')).toContainText(`« ${livreur} » ajouté.`)
  await cartes.livreurs.getByRole('button', { name: `Désactiver ${livreur}` }).click()
  await expect(cartes.livreurs.getByRole('status')).toContainText('désactivé')
  // Agents de réception : lecture seule (aucun bouton d'ajout), lien vers les utilisateurs.
  await expect(cartes.agents.getByRole('link', { name: 'Utilisateurs' })).toBeVisible()
  await expect(cartes.agents.getByRole('button')).toHaveCount(0)
})

test('D-03 plateforme : modifier les coordonnées (rejet puis succès), ajouter puis supprimer une adresse de réception, ajouter une imprimante', async ({
  page,
}) => {
  const stamp = String(Date.now())
  await page.goto('/admin/plateformes')
  await expect(page.getByRole('heading', { name: 'Plateformes' })).toBeVisible()
  const table = page.getByRole('table', { name: 'Liste des plateformes' })
  await expect(table).toBeVisible()
  const premiere = table.getByRole('row').nth(1)
  const nom = (await premiere.getByRole('cell').first().innerText()).replace(/ \(site CCF.*\)$/, '')
  await premiere.getByRole('button', { name: /^Modifier / }).click()
  const modale = page.getByRole('dialog', { name: /^Modifier / })
  // Rejet : mail de déblocage invalide (message du serveur).
  await modale.getByLabel(/^Mail de déblocage/).fill('pas-une-adresse')
  await modale.getByRole('button', { name: 'Enregistrer les coordonnées' }).click()
  await expect(modale.getByTestId('error-message')).toContainText('Mail de déblocage')
  // Succès : coordonnées enregistrées (la modale se ferme, la liste est rechargée).
  await modale.getByLabel(/^Mail de déblocage/).fill(`deblocage.${stamp}@site.fr`)
  await modale.getByRole('button', { name: 'Enregistrer les coordonnées' }).click()
  await expect(page.getByRole('status')).toContainText('enregistrée')
  await expect(page.getByRole('table', { name: 'Liste des plateformes' })).toContainText(
    `deblocage.${stamp}@site.fr`,
  )
  // Adresse de réception : ajout, doublon refusé, suppression.
  await page
    .getByRole('row', { name: new RegExp(nom.slice(0, 20)) })
    .first()
    .getByRole('button', { name: /^Modifier / })
    .click()
  const m2 = page.getByRole('dialog', { name: /^Modifier / })
  const adresse = `reception.${stamp}@site.fr`
  await m2.getByLabel('Nouvelle adresse').fill(adresse)
  await m2.getByRole('button', { name: 'Ajouter l’adresse' }).click()
  await expect(m2.getByRole('status')).toContainText(`Adresse « ${adresse} » ajoutée.`)
  await expect(m2.getByRole('list', { name: 'Adresses de réception' })).toContainText(adresse)
  await m2.getByLabel('Nouvelle adresse').fill(adresse.toUpperCase())
  await m2.getByRole('button', { name: 'Ajouter l’adresse' }).click()
  await expect(m2.getByTestId('error-message')).toContainText('existe déjà')
  await m2.getByRole('button', { name: `Supprimer ${adresse}` }).click()
  await expect(m2.getByRole('status')).toContainText('supprimée')
  await expect(m2.getByRole('region', { name: 'Mails de réception' })).not.toContainText(adresse)
  // Imprimante : ajout puis désactivation (jamais de suppression).
  const imprimante = `E2E-IMP-${stamp}`
  await m2.getByLabel('Nouvelle imprimante').fill(imprimante)
  await m2.getByRole('button', { name: 'Ajouter l’imprimante' }).click()
  await expect(m2.getByRole('status')).toContainText(`Imprimante « ${imprimante} » ajoutée.`)
  await m2.getByRole('button', { name: `Désactiver ${imprimante}` }).click()
  await expect(m2.getByRole('status')).toContainText('désactivée')
  await expect(m2.getByRole('button', { name: `Supprimer ${imprimante}` })).toHaveCount(0)
})

test('D-08 règles d’alerte : modifier le canal et les destinataires, valeur conservée au rechargement, retour au bandeau', async ({
  page,
}) => {
  await page.goto('/admin/alertes')
  await expect(page.getByRole('heading', { name: 'Alertes et mails' })).toBeVisible()
  const table = page.getByRole('table', { name: 'Règles d’alerte' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(23)
  const libelle = 'Écart de réception > 10 %'
  const ligne = table.getByRole('row', { name: new RegExp(libelle) })
  await ligne.getByRole('button', { name: `Modifier ${libelle}` }).click()
  const modale = page.getByRole('dialog', { name: /Règle d’alerte/ })
  await modale.getByLabel('Canal').selectOption({ label: 'Bandeau + mail' })
  await modale.getByLabel('Chefs d’équipe').check()
  await modale.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('status')).toContainText(`Règle « ${libelle} » enregistrée.`)
  await page.reload()
  const ligneApres = page
    .getByRole('table', { name: 'Règles d’alerte' })
    .getByRole('row', { name: new RegExp(libelle) })
  await expect(ligneApres).toContainText('Bandeau + mail')
  await expect(ligneApres).toContainText('Chefs d’équipe')
  // Retour aux valeurs par défaut (l'environnement de test reste neutre).
  await ligneApres.getByRole('button', { name: `Modifier ${libelle}` }).click()
  const m2 = page.getByRole('dialog', { name: /Règle d’alerte/ })
  await m2.getByLabel('Canal').selectOption({ label: 'Bandeau' })
  await m2.getByLabel('Chefs d’équipe').uncheck()
  await m2.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('status')).toContainText('enregistrée')
  await expect(
    page
      .getByRole('table', { name: 'Règles d’alerte' })
      .getByRole('row', { name: new RegExp(libelle) }),
  ).toContainText('Par défaut')
})
