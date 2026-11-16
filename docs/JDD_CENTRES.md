# Données de démonstration des trois centres

Chargement réalisé le 9 novembre 2026 dans `apps/api/prisma/dev.db`, après sauvegarde SQLite dans `/private/tmp/circe-dev-avant-jdd-20261109-110108.db`.

## Contenu ajouté

| Centre | ID local | Dossiers / lignes attendues | Réceptions | Affiches |
|---|---:|---:|---:|---:|
| Wissous | 11 | 12 | 11 | 11 |
| Nîmes | 12 | 12 | 11 | 11 |
| Nanterre | 13 | 12 | 11 | 11 |

Chaque centre possède deux ateliers de démonstration (fixe et déroulant), deux lignes ATTENDUE, deux PARTIELLE, six COMPLETE et deux SURPLUS. Parmi les réceptions : six A_CONTROLER, quatre CONTROLEE et une inconnue A_IDENTIFIER. Deux affiches par centre sont validées administrativement.

Les dossiers 760000–760011, 760100–760111 et 760200–760211 sont fictifs. Les instructions sont à traiter, sans préparation reçue ; ce chargement ne simule pas un passage Broadcast ni toute la chaîne d'expédition. Les réceptions, mouvements, rattachements, contrôles et validations administratives passent par les services existants. Les pièces jointes sont des PNG techniques d'un pixel, explicitement nommés « Echantillon-technique-JDD », pas des BL réels.

## Profils disponibles

24 comptes de développement au total : les six profils généraux `dev.coord`, `dev.cheq`, `dev.recep`, `dev.expe`, `dev.admin`, `dev.com`, plus les six mêmes profils dans chacun des trois centres.

Exemples : `dev.recep.wissous`, `dev.coord.nimes`, `dev.expe.nanterre`. Suffixes : `wissous`, `nimes`, `nanterre`.

Rôles : coordination, chef d'équipe, réception, expédition, administration et commerce. Aucun nouveau rôle métier créé. Les comptes locaux non administrateurs sont limités à leur centre. Les profils généraux gardent leur ancien périmètre et ont également accès aux trois centres.

**Tous les administrateurs, y compris ceux portant un suffixe de centre, disposent des 56 permissions existantes et du périmètre global.** C'est le comportement déjà implémenté (Q-421), réaffirmé par l'utilisateur le 9 novembre. Les règles de quantité, de statut et d'intégrité restent applicables. Le choix explicite d'un centre dans le bandeau filtre les résultats ; sélectionner « Tous » pour voir l'ensemble.

Les profils sont proposés dans « Profil (dev) ». Ce sélecteur et la signature de son cookie restent réservés au développement ; le serveur vérifie l'identifiant dans la liste autorisée et recharge les droits en base. Aucun mot de passe ajouté : le projet conserve son mécanisme d'identité de développement existant.

## Rechargement

Depuis la racine `circe-v1` :

```sh
pnpm seed:centres
```

Le chargement est aussi appelé par `pnpm start:all`, sauf `--no-seed` ou `--no-demo`. Il refuse toute autre base que le fichier local `apps/api/prisma/dev.db`, ainsi que le mode production. Les centres existants sont recherchés sans tenir compte des accents ou de la casse. Une collision avec un dossier non reconnu est refusée.

Les dossiers déjà présents sont conservés tels quels : les modifications faites pendant la recette ne sont pas réinitialisées. La semaine des nouveaux dossiers correspond à la semaine courante lors de leur création ; elle n'est pas déplacée lors d'une relance. Ne pas confondre ce chargement de démonstration avec `pnpm jdd`, réservé à la base de test et purgé par défaut.

## Vérifications réalisées

- Premier chargement : 36 dossiers créés. Deuxième chargement : 0 dossier supplémentaire ; mêmes centres et mêmes comptes.
- Chaque centre : quantités du cache égales à la somme des mouvements ; statuts et nombres ci-dessus vérifiés par lecture SQLite.
- `PRAGMA foreign_key_check` : aucune violation.
- Les trois comptes admin locaux et `dev.admin` : périmètre global et 56 permissions ; contrôle des périmètres des 15 comptes locaux non admin.
- Typage API, web et shared vérifié ; 14 tests existants de permissions réussis ; lint et format vérifiés sur les fichiers modifiés.
- Aucun service de règles métier modifié. Pas de nouvelle exécution E2E du navigateur pour cette intervention.
