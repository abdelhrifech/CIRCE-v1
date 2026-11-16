# Adaptation aux nouvelles spécifications du 12 novembre 2026

## Références et ordre de lecture

Sources conservées intactes : `docs-sources/news specs`. Comparaison exhaustive des fichiers de la nouvelle maquette avec `docs-sources/2. CIRCE CIBLE + MAQUETTE/maquette` : 19 fichiers modifiés et 5 ajoutés (Bus, J-3, non-conformité, tableau de bord, lecteur XLSX). Les autres écrans sont inchangés dans la source, ce qui ne prouve pas leur couverture par l'application.

La note de transmission Bus du 08/10/2026 indique explicitement qu'elle prévaut sur les documents Bus antérieurs. BUS-19 remplace donc l'ajustement global du dossier par centre × parc × format. BUS-23 retire colis et transporteurs du parcours Bus. Les points BUS-22 (moment et limites), BUS-26 (reste en place), contrats externes Broadcast et Field Service restent à distinguer des exigences fermées.

## Registre de réalisation

| Identifiant | Source nouvelle | Changement à vérifier et réaliser | État |
|---|---|---|---|
| RG-NEW-REC-001 | reception.js, arrivée 09/11 | Sans BL explicite : photo, numéro et imprimeur facultatifs, transporteur obligatoire ; traçabilité Sans BL | Réalisé, vérifié |
| RG-NEW-REC-002 | reception.js, auPanier | Ajout manuel non coché ; sélection explicite et glissement | Réalisé, voir précisions |
| RG-NEW-REC-003 | reception.js, contrôle | Validation indépendante de l'impression ; feuilles à imprimer ; disparition du contrôle terminé | Réalisé, voir précisions |
| RG-NEW-REC-004 | reception.js, liste affiches | Validation admin en lot, cas sûrs précochés, doutes confirmés par une personne | Réalisé, voir précisions |
| EX-NEW-REC-005 | reception.js, identification.js | Recherche compacte, fiche inconnue, champs affiche, BL facultatif, visuel sur feuille | Réalisé, voir précisions |
| EX-NEW-NAV-001 | core.js, ui.js | Suppression Pré-production, ordre et contexte des menus, suppression introductions | Réalisé, voir précisions |
| EX-NEW-PIL-001 | tableau.js | Carrés personnalisables, compteurs/listes filtrés, notes 500 caractères | Réalisé, voir précisions |
| EX-NEW-PIL-002 | alertes.js | Sans gravité à l'écran, filtre type et ordre chronologique | Réalisé, voir précisions |
| EX-NEW-J3-001 | j3.js | Trois tableaux hebdomadaires alimentés par EDR, saisies et totaux | Réalisé, voir précisions |
| EX-NEW-NC-001 | nonconformite.js | Formulaires réception/agence, fichiers persistés, référentiel déclarants | Réalisé, voir précisions |
| RG-NEW-NC-002 | nonconformite.js, reception.js | Portée déduite, décisions Préproduction/Plateforme, suivi et alertes | Réalisé, voir précisions |
| EX-NEW-BUS-001 | bus.js, note BUS-01 à 26 | Cinq vues, référentiels DSP/centre/parc/format, réception et préparation | Réalisé, voir précisions |
| RG-NEW-BUS-002 | note BUS-19/20 | Ajustement manuel centre × parc × format, historique, vente inchangée | Réalisé, voir précisions |
| EX-NEW-COO-001 | instructions.js, unitaire.js, expedition.js | À traiter/Préparation/Colis par type, tous ateliers avec filtre | Réalisé, voir précisions |
| EX-NEW-ADM-001 | parametrage.js, xlsxread.js | Déclarants, import et référentiel Bus | Réalisé, voir précisions |

Les droits administrateur complets et les périmètres Wissous, Nîmes et Nanterre restent applicables. Les données de maquette ne deviennent pas des données métier codées dans les écrans. Les vérifications et limites constatées seront consignées ici au fil des incréments.

## Décision utilisateur

Le 12/11/2026, l’utilisateur confirme : « Oui, conserver les garde-fous actuels » pour BUS-22 et BUS-26 (limite d’ajustement, quantités nulles, reste en place). Ces éléments ne donnent lieu à aucune règle automatique supplémentaire.

## Vérifications intermédiaires

- Réception/validation administrative/contrôle : 83 tests d’intégration réussis.
- Panier : 6 tests unitaires réussis.
- Non-conformités : 7 tests d’intégration réussis (formulaire, pièces jointes, périmètres, portée, décisions, concurrence, référentiel).
- `pnpm start:all --no-demo` : migration additive appliquée, API et web démarrés ; API `/api/health` répond 200, URL web annoncée. Une nouvelle vérification complète sera faite après les incréments suivants.


## Réalisation et portée

Les comportements effectivement implémentés, les décisions utilisateur et les limites sont mémorisés dans `REGLES_METIER_NOUVELLES_SPECS_2026_11_12.md`. Les sources ne sont pas modifiées.

Trois migrations additives : non-conformités et justificatifs, J−3 et dispositions personnelles, référentiel/lignes/contrôles Bus. Pas de remise à zéro de la base de développement. Les JDD sont limités à `apps/api/prisma/dev.db`, hors production ; le démarrage habituel alimente les nouveaux scénarios fictifs après les référentiels et centres existants.

Le statut du registre concerne les évolutions décrites, pas une conformité exhaustive de tous les anciens écrans de la maquette. La fiche affiche a été enrichie, mais la refonte intégrale de ses champs hérités et la reconnaissance automatique restent à distinguer des fonctions vérifiées. Les écarts antérieurs de suivi global, Stocks et fichiers machines restent identifiés dans le registre existant.


## Vérification finale du 12 novembre 2026

- `pnpm test` : 290 tests unitaires réussis (16 partagés, 36 web, 238 API).
- `pnpm test:int` : 3 724 tests réussis ; 1 échec attendu, 8 tests à faire et 1 fichier ignoré restent explicitement signalés par la suite.
- `pnpm test:e2e` : 108 parcours navigateur réussis, dont les nouveaux formulaires, les cinq vues Bus, les notes persistantes, un import XLSX compressé, la sélection par glissement et le téléchargement Excel.
- `pnpm typecheck`, `pnpm lint` et `pnpm build` : réussis. Les avertissements de construction des dépendances React/Radix ne bloquent pas le build.
- Contrôle indépendant du fichier XLSX généré : archive ZIP et XML valides, nombres et dates typés, texte ressemblant à une formule conservé comme texte.

Ces résultats vérifient les parcours couverts ; ils ne constituent pas une certification de conformité exhaustive aux standards Cityz. Les écarts de ce document restent décrits dans `AUDIT_STANDARDS_CITYZ_0_2_0_PRE.md`.


### Relance avec la commande habituelle

`pnpm start:all --user=dev.admin` : application prête sur `http://127.0.0.1:3000`, API sur `http://127.0.0.1:3005` (les ports API habituels sont occupés). Aucune migration en attente. Les graines centres et nouvelles spécifications annoncent chacune zéro dossier créé à la seconde exécution : pas de doublon de ces JDD. Les centres Wissous, Nîmes et Nanterre et les profils locaux sont présents ; l’administrateur possède les 64 permissions et l’accès global.

Après relance : santé, identité, Bus, tableau de bord et disposition répondent 200. Contrôle navigateur : tableau chargé, API « ok », disposition enregistrée et note de vérification effacée. La base existante n’a pas été réinitialisée.
