Graphe de navigation du périmètre Réception / Coordination, repris de maquettes-reception-coordination.md §3 et maquettes-autres-modules.md §B. Format : source -> cible. Les paramètres d'URL (`?tab=`, `?q=`, `?id=`, `?pour=`, `?type=`, `?atelier=`, `?statut=`, `?ou=`) sont des filtres posés une fois à l'arrivée ; toute page ouverte par un lien affiche « ← Retour : <page quittée> » (pile de 20, vidée par le menu ; EX-TRA-013).

### 5.1 Entrées de menu -> écrans

| Source | Cible | Remarque |
|---|---|---|
| Menu Pilotage › Alertes ; cloche du bandeau 1 | ECR-TRA-01 | cloche : toutes pages |
| Menu Réception › Réception des affiches | ECR-REC-01 puis ECR-REC-02 (même page, `?tab=attendues`, vues attendues / saisie / contrôle) | badge = palettes à contrôler |
| Menu Réception › Liste des affiches | ECR-REC-03 (`?tab=affiches`) | |
| Menu Réception › Réceptions inconnues | ECR-REC-04 | badge rouge = affiches orphelines |
| Menu Pré-production › Validation admin et Instruction OK | ECR-COO-01 | badge = dossiers à traiter, rouge si écart BC |
| Menu Déroulant › Liste des instructions | ECR-COO-01 (`?pour=deroulant`) | |
| Menu Déroulant › Liste des trains | ECR-COO-05 (`tab=trains`) | |
| Menu Déroulant › Suivi par thème | ECR-COO-06 (`tab=besoin`) | |
| Menu Déroulant › Préparation | ECR-COO-07 (`tab=prepa`) | |
| Menu Déroulant › Suivi 8 m² (demies) | ECR-COO-08 (`tab=d8`) | |
| Menu Déroulant › Bagues | ECR-COO-11 | |
| Menu Déroulant › Dispatch | ECR-COO-10 (sous-entrées `?atelier=`) | |
| Menu 2 m² fixe / Pliage / Bus › Préparation | ECR-COO-09 (`?type=`, `?atelier=`) | badge « arrivés après libération » |

### 5.2 Liens internes Réception

| Source | Action | Cible |
|---|---|---|
| ECR-REC-01 | Photographier BL / affiche | ECR-REC-07 |
| ECR-REC-07 | Mettre au panier / Joindre | ECR-REC-01 |
| ECR-REC-01 | Réception inconnue… | ECR-REC-08 puis ECR-REC-09 (feuille temporaire) ; crée une ligne dans ECR-REC-04 et une alerte |
| ECR-REC-01 | Valider la réception | sas de ECR-REC-02 |
| ECR-REC-02 | Contrôler -> Valider | ECR-REC-09 (feuilles définitives) |
| ECR-REC-01 / ECR-REC-03 | clic n° d'affiche | ECR-REC-05 |
| ECR-REC-05 | Réception | ECR-REC-06 |
| ECR-REC-06 | Contrôler la palette | ECR-REC-02 |
| ECR-REC-05 | Imprimer la feuille | ECR-REC-09 |
| ECR-REC-03 | clic ligne | ECR-REC-05 |
| ECR-REC-03 | action groupée (imprimer) | ECR-REC-10 puis ECR-REC-09 |
| ECR-REC-04 | Fiche | ECR-REC-05 |
| ECR-REC-04 | Rattacher | palette dans le sas de ECR-REC-02 |
| ECR-REC-04 | Valider et imprimer | ECR-REC-02 |
| Tout écran | Voir le visuel | ECR-REC-12 |
| ECR-REC-01 / ECR-REC-06 | voir le BL | ECR-REC-11 |

### 5.3 Liens internes Coordination

| Source | Action | Cible |
|---|---|---|
| ECR-COO-01 | clic ligne | ECR-COO-02 |
| ECR-COO-02 | Demander une correction | ECR-COO-04 |
| ECR-COO-02 | Valider (si doutes) | ECR-COO-03 |
| ECR-COO-02 | Vérifier les thèmes | ECR-THM-01 (`?dossier`) [P2] |
| ECR-COO-05 | clic ligne | fiche train (05a) |
| fiche train (05a) | Réimprimer bague | ECR-COO-11 (11c) |
| fiche train (05a) | Raccrocher / Supprimer | 05d / 05e |
| ECR-COO-05 | Exporter les trains | 05b |
| ECR-COO-05 | Train de pré-test | 05c |
| ECR-COO-05 | Fichiers Vendôme / Générer les fichiers | ECR-GEN-01 (`?machine=`, trains pré-cochés) [P2] |
| ECR-COO-05 | Bagues | ECR-COO-11 |
| ECR-COO-05 (callout) | Voir les dossiers | ECR-COO-01 (`?pour=deroulant`) |
| ECR-COO-07 | Choisir le rouleur | modale rouleur |
| ECR-COO-07 | Imprimer les bagues | ECR-COO-11 |
| ECR-COO-09 | Libérer, Rendre la main, Corriger l'intitulé, Fiche de synthèse, Quantités à encoller, Comptage | modales |
| ECR-COO-09 | Générer les fichiers multi-rouleuse | ECR-GEN-02 [P2] |
| ECR-COO-09 | Imprimer les bagues | ECR-COO-11 (11a) |

### 5.4 Alertes (ECR-TRA-01) et liens entrants

| Source | Action | Cible |
|---|---|---|
| ECR-TRA-01 | Ouvrir (alertes MANQUANT, DEPART_RISQUE) | ECR-PIL-03 (`?q=`) [P2] |
| ECR-TRA-01 | Ouvrir (ECART, SANS_IP, THEME_MODIF `tag=refaire`) | ECR-REC-03 (`?q=`, `?tag=`) |
| ECR-TRA-01 | Ouvrir (ORPHELINE, DOSSIER_INTROUVABLE) | ECR-REC-04 (`?id=`) |
| ECR-TRA-01 | Ouvrir (CONTROLE_RETARD, FEUILLE_DEFINITIVE) | ECR-REC-02 (`tab=controle&id=`) |
| ECR-TRA-01 | Ouvrir (IP_MANQUANTES, ECART_BC, VALIDATION_ADMIN, APRES_LIBERATION) | ECR-COO-01 (`?q=`, `?statut=TOUS&q=`) |
| ECR-TRA-01 | Ouvrir (DM_FICHIER, APRES_LIBERATION) | ECR-COO-05 (`?q=`) |
| ECR-TRA-01 | Ouvrir (APRES_LIBERATION) | ECR-COO-09 (`?atelier=&q=`, `?flag=apres`) |
| ECR-TRA-01 | Ouvrir (THEMES_PROCHES, ANNONCEURS_PROCHES, THEME_BC) | ECR-THM-01/02/03 [P2] |
| ECR-TRA-01 | Règles et destinataires | ECR-ADM-04 (`?tab=alertes`) [P2] |
| ECR-GEN-03 | Générer un complément | lié à l'alerte DM_FICHIER [P2] |

### 5.5 Liens entrants depuis les autres modules vers P1

| Source | Action | Cible |
|---|---|---|
| ECR-PIL-04 | Voir dans Instructions | ECR-COO-01 (`?q=`) |
| ECR-PIL-04 | Voir les affiches | ECR-REC-03 (`?tab=affiches&q=`) |
| ECR-THM-01 / 02 | Ouvrir le dossier | ECR-COO-01 (`?statut=TOUS&q=`) |
| ECR-THM-03 | Reprendre la version BC | tag « Feuille à refaire » (ECR-REC-03) |
| ECR-GEN-01 / 02 | pré-sélection `G.preselect` | trains cochés dans ECR-COO-05 / 07 |
| ECR-EXP-02 | Fin de journée Geodis | statuts unités, mouvements de stock (lus par ECR-REC-03 / ECR-REC-05) |
| Écrans stock / suivi | `ui.afficheModal` | ECR-REC-05 |

Remarques : (1) la navigation de référence est `M.NAV` de `core.js` (10 onglets) ; l'aperçu V1.2 (ECR-NAV-02) est obsolète. (2) Le rôle ne fait que griser les pages secondaires, rien n'est interdit (Q-353). (3) Pas de page d'accueil : ouverture sur ECR-PIL-01 (P3), Q-365. (4) Aucune navigation n'est décrite pour les entrées du menu actuel sans écran cible (Q-382).
