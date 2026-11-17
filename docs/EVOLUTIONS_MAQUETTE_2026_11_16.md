# Évolutions de la livraison OneDrive du 16 novembre 2026

## État du point de sauvegarde du 17 novembre

**Implémentation en cours, non déclarée intégralement conforme.** Ce document distingue les évolutions réalisées, les règles volontairement conservées et les compléments restant à réaliser. Le commit constitue un point de sauvegarde demandé par l’utilisateur.

## Sources et sauvegardes

Comparaison de `docs-sources/OneDrive_1_16-11-2026/maquette` avec `docs-sources/news specs/OneDrive_1_12-11-2026/maquette` : 17 fichiers modifiés, `screens/reprises.js` ajouté, aucun fichier supprimé hors fichiers système. Sources consultées en lecture seule. Code avant modifications sauvegardé dans `/private/tmp/circe-avant-16/code.tgz`, copie SQLite cohérente dans `/private/tmp/circe-avant-16/dev.db`. Ces sauvegardes temporaires ne sont pas versionnées.

Référence publiée précédente : `89071b514a68d2b40c1780957dcff9aa78aac4b5`.

## Décision utilisateur applicable

L’utilisateur a confirmé : **« Oui, conserver les règles existantes (recommandé) »** pour les comportements explicitement indécis de la maquette : douchage d’activité et sortie de stock, fusion, suppression à l’export, duplication des trains. Réutiliser les services existants ; laisser indisponibles les actions nécessitant d’inventer une règle. Les données simulées de la maquette ne deviennent pas des données codées en dur.

## Matrice de réalisation

| Exigence | Réalisation | État / reste |
|---|---|---|
| RG-NEW16-NC-001 : décision Préproduction distincte de la réponse plateforme | Réponses Oui/Non historisées avec date, auteur, commentaire ; contrôles de version, site, droit et statut ; Oui clôture selon le calcul historique ; nouvelle décision rouvre sans effacer les réponses | Implémenté ; ancienne décision « Traité par la plateforme » encore comprise pour compatibilité |
| EX-NEW16-NC-002 : navigation NC unifiée | Nouvelle demande / Suivi des NC, choix plateformes/agences, couleurs avec libellés, anciens liens conservés | Implémenté |
| EX-NEW16-NC-003 : préremplissage réel | Recherche dossier partiel, DA, annonceur ; cas site × dossier × thème effectivement reçu ; somme des rattachements, semaines, format, dernière réception ; valeurs modifiables ; correspondance AUTRE | Implémenté ; compléter la mise en évidence de tous les groupes de cases obligatoires |
| EX-NEW16-NC-004 : suivi et export | Liste unifiée, filtre dossier exact, semaine/quantité, export de tous les champs de formulaire, réponses et noms des justificatifs | Implémenté ; harmonisation visuelle complète des filtres de cette grille encore à finir |
| EX-NEW16-REC-001 : justificatifs et feuille NC | Photos au constat ; feuille groupée distincte des copies de stock ; réimpression depuis suivi et liste des affiches ; repère « Feuille NC à imprimer » ; impression tracée dans le journal, refus si version périmée ; stock et NC imprimés ensemble dans la même transaction | Implémenté ; recette visuelle A4 des cas volumineux et enrichissement complet du détail BL/emplacements restent à mener |
| EX-NEW16-REC-002 : photo BL erronée | Retrait de photo, remise à vide du numéro BL ; lignes manuelles du panier conservées | Implémenté pour le fonctionnement actuel, qui n’importe pas automatiquement des lignes depuis une photo |
| EX-NEW16-REC-003 : grilles Réception | Impression après contrôle sans ajout automatique des étiquettes rack ; bouton NC distinct, indisponible sans NC | Partiel : séparation systématique annonceur/thème/format, synthèse complète du sas et navigation de retour entre fiches à compléter |
| EX-NEW16-TRA-001 : tableaux | Opérateurs texte/nombre/vide, ancien raccourci numérique conservé ; hauteur réglable souris/clavier/réinitialisation, mémorisée en session ; colonnes ajoutées signalées | Implémenté dans TableMetier ; les anciennes grilles spécifiques ne sont pas toutes migrées |
| RG-NEW16-PIL-001 : archives d’alertes | Onglets ouvertes/archivées, archive auteur/date, instantané conservé après résolution, restauration ; droits de la source et périmètre atelier revérifiés, configuration Désactivée respectée | Implémenté ; une cause résolue ne recrée pas d’alerte à la restauration, pour conserver la levée automatique existante |
| EX-NEW16-COO-001 : granularité et colonnes | Liste des trains par face réelle, actions dédupliquées par train ; fixe/pliage par répartition, actions par dossier ; dossiers sans répartition toujours accessibles ; colonnes UM héritées et métadonnées réelles des colis/commentaires/synthèses | Implémenté ; recette complète des cas mixtes et de l’ordre de toutes les colonnes à poursuivre |
| EX-NEW16-COO-002 : vues déroulant | Entrées Position Train et Export préparation ; données côte à côte réelles ; préparation avec détail positions 1–6, aperçu complet conservé au-delà, actions Modifier/Rouleur | Partiel : Export préparation reprend encore la préparation existante ; son regroupement spécifique, le suivi par thème enrichi et les actions associées restent à compléter |
| RG-NEW16-COO-003 : événements d’export | Notification de go par plateforme/semaine ; alertes sur préparation arrivée après export, y compris dossier non exporté | Implémenté ; couverture ciblée des bornes de semaine et des renvois Broadcast à renforcer |
| EX-NEW16-PIL-002 : suivi macro | Vue par ligne attendue/visuel avec liens dossier vers les cinq étapes, NC ouvertes, quantités et états réels | Partiel : regroupement des doublons de visuels, classification des attentes sans répartition et performance sur gros volumes à consolider |
| EX-NEW16-REP-001 : reprises | Zone picking reliée à la modification d’affiche existante ; fusion présentée sans mutation non spécifiée ; analyse des trains produits depuis les états existants ; accès admin et duplication via service existant | Partiel : activité/équipe sans modèle de douchage, liste extérieure sans flux transporteur, aucune valeur simulée utilisée pour combler ces absences |
| EX-NEW16-ADM-001 : administration | Accès déblocage, préparations débloquées, rafraîchissement, duplication ; RBAC existant et admin global conservés | Les deux accès de déblocage réutilisent la même page ; aucune nouvelle règle individuelle de menus inventée |

## Garde-fous préservés

- Aucun changement de calcul de stock, de quantité d’entretien ou de point de non-retour des services existants.
- Aucun remplacement de la fusion historique par la simulation de la maquette.
- Duplication : algorithme, états, contrôle des collisions et droits du service existant conservés.
- Les numéros de panneaux BC restent protégés par leur permission dédiée.
- Les réponses NC et les impressions ne contournent ni le site sélectionné ni la concurrence optimiste.
- Les sources et JDD de développement n’ont pas été réinitialisés. La migration ajoute uniquement les réponses NC et les instantanés d’alertes.
- Les chemins `/api` et `/v1` restent compatibles ; contrat OpenAPI régénéré.

## Contrôles

- Passage complet d’intégration : **3 732 tests réussis**, 1 échec attendu, 8 à faire, 1 fichier ignoré.
- Vérification finale du point de sauvegarde : **TypeScript, lint, tests unitaires et build réussis**.
- Vérification finale navigateur : **108 tests réussis** après correction de l’accès aux dossiers sans répartition et adaptation des assertions aux nouveaux libellés et aux nouvelles colonnes.
- Après les derniers ajustements d’impression : **14 tests d’intégration ciblés réussis** (NC et compatibilité/contrat API). Le passage complet de 3 732 tests précède le regroupement transactionnel final de l’impression stock + NC.
- Tests ciblés supplémentaires : regroupement NC par dossier/thème, recherche DA, isolement des sites, historique des réponses, version périmée, visibilité des archives et traçabilité d’impression sans changement de statut/version.
- Audit spec-auditor : risque de fuite des archives et comptage des NC statistiques corrigés. Il ne constitue pas une validation finale de conformité de l’ensemble des écrans.

Les résultats définitifs du point de sauvegarde figurent dans le journal du plan. Les limites ci-dessus ne doivent pas être présentées comme terminées.
