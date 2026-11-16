# MISSION : RECONSTRUCTION DE CIRCE ET IMPLÉMENTATION COMPLÈTE DES MODULES RÉCEPTION ET COORDINATION

> Note d'organisation du workspace (adaptation du prompt d'origine) :
> - `circe-develop/` : code historique (lecture seule).
> - `docs-sources/` : spécifications, maquettes et schéma de la base (lecture seule). Dans ce document, « les sources de `docs/` » désigne ce dossier.
> - `docs/` (dans circe-v2) : uniquement les LIVRABLES produits par Claude.

Tu interviens sur un projet de reconstruction complète de l'application CIRCE à partir de son code source actuel, avec une nouvelle architecture technique et de nouvelles spécifications fonctionnelles.

L'objectif est de reconstruire une application fonctionnelle, moderne et fiable, en préservant les règles métier importantes de l'application existante et en respectant intégralement les nouvelles spécifications et maquettes.

## 1. STRUCTURE DU WORKSPACE ET SOURCES À ANALYSER

### `circe-develop/`
Copie complète du code source de l'application CIRCE actuelle.

Ce dossier est ta référence pour comprendre :
- Les fonctionnalités existantes.
- Les règles métier déjà implémentées.
- Les workflows.
- Les validations.
- Les statuts et transitions.
- Les relations entre les modules.
- Les traitements backend.
- Les interactions frontend/backend.
- Les structures de données.
- Les comportements particuliers et les cas exceptionnels.

Tu dois analyser le code existant en profondeur et ne pas te limiter à une lecture superficielle des composants.

Ce dossier doit rester intact : aucune modification ne doit être réalisée directement dans le code source historique.

### `docs-sources/`
Ce dossier contient les nouveaux éléments de référence de la solution cible.

Il contient notamment :

**1. Les nouvelles maquettes fonctionnelles**

Ces maquettes représentent les nouveaux écrans à développer et le fonctionnement attendu de la nouvelle application.

Elles contiennent également des exemples MOCK déjà intégrés directement dans les écrans :
- Exemples d'enregistrements.
- Exemples de données affichées.
- Exemples de formulaires.
- Exemples de listes et de tableaux.
- Exemples de statuts.
- Exemples d'interactions et de parcours.

Ces exemples MOCK sont importants : analyse-les attentivement pour comprendre la structure des écrans, les informations attendues, les comportements, les interactions et les différents états de l'interface.

Ne te contente pas de reproduire visuellement les maquettes. Il faut comprendre et implémenter les fonctionnalités métier qui se cachent derrière chaque écran.

**2. Les documents de spécifications fonctionnelles de la nouvelle solution**

Ces documents définissent le comportement attendu de la nouvelle application.

Ils constituent la référence principale pour les nouvelles fonctionnalités et les évolutions demandées.

Analyse-les intégralement et identifie chaque exigence fonctionnelle, règle métier, condition, validation, transition, interaction et cas particulier.

IMPORTANT : les nouvelles maquettes et les documents de spécifications sont complémentaires. Tu dois impérativement exploiter les deux.

Ne néglige aucun élément présent dans les maquettes ou les documents.

### Schéma de la véritable base de données

Un schéma de la véritable base de données existe également dans `docs-sources/`.

Identifie-le et analyse-le attentivement.

Il servira de référence pour comprendre les entités métier, les relations, les contraintes et la structure réelle des données.

Tu peux faire évoluer ce modèle pour la nouvelle application si cela est nécessaire, mais toute modification doit être justifiée et préserver la cohérence métier.

---

## 2. NOUVELLE ARCHITECTURE TECHNIQUE OBLIGATOIRE

### Frontend

- TanStack Start.
- TanStack Router.
- React.
- TypeScript.
- Tailwind CSS.
- Radix UI.
- Vite.
- Nitro en mode Node.js.

Le frontend fonctionne avec un serveur Node.js qui relaie les requêtes API via `/api`.

Aucune connexion directe à la base de données depuis le frontend.

### Backend API

- Node.js.
- TypeScript.
- API REST.
- Prisma ORM.
- PostgreSQL.

Le backend est exclusivement responsable :
- De l'authentification.
- Des contrôles d'accès.
- Des permissions.
- Des validations métier.
- Des workflows.
- Des transitions de statuts.
- Des traitements métier.
- De la persistance des données.
- De la cohérence transactionnelle.

### Stack commune et qualité

- TypeScript strict.
- ESLint.
- Prettier.
- Architecture modulaire.
- Séparation claire entre frontend, backend et logique métier.
- Client Prisma généré au build du backend avec l'adaptateur PostgreSQL.
- Génération des PDF côté navigateur uniquement.
- Intégration possible d'un fournisseur LLM via une API compatible chat/completions, comme Azure OpenAI ou un autre fournisseur.

Respecte cette architecture sans introduire inutilement d'autres technologies.

---

## 3. ANALYSE FONCTIONNELLE APPROFONDIE AVANT DÉVELOPPEMENT

Avant de commencer à coder, réalise une analyse croisée des trois sources :

1. Le code source actuel dans `circe-develop/`.
2. Les maquettes et les spécifications fonctionnelles dans `docs-sources/`.
3. Le schéma de la véritable base de données.

L'objectif est de comprendre le fonctionnement actuel et de déterminer précisément le fonctionnement cible.

Pour chaque fonctionnalité, identifie :

- Le fonctionnement actuel.
- Le fonctionnement attendu.
- Les nouvelles règles métier.
- Les règles métier conservées.
- Les règles métier modifiées.
- Les règles métier supprimées, si explicitement demandé.
- Les acteurs concernés.
- Les permissions nécessaires.
- Les données manipulées.
- Les validations.
- Les statuts et transitions.
- Les interactions avec les autres modules.
- Les cas nominaux et exceptionnels.

Construis une matrice de correspondance entre les fonctionnalités existantes, les spécifications, les maquettes et la nouvelle implémentation.

Ne prends aucune décision métier arbitraire.

En cas de contradiction entre une maquette, une spécification et le code historique, identifie explicitement le conflit, explique ses conséquences et ne choisis pas silencieusement un comportement (voir `docs/QUESTIONS_OUVERTES.md`).

---

## 4. PRIORITÉ ABSOLUE : MODULE RÉCEPTION

La réception est l'un des deux modules prioritaires de cette reconstruction.

Je souhaite une implémentation complète et fidèle aux spécifications.

Analyse d'abord son fonctionnement actuel dans `circe-develop/`, puis confronte-le aux nouvelles maquettes et aux documents fonctionnels de `docs-sources/`.

Reconstitue l'ensemble des parcours de réception.

Pour chaque écran et chaque action présente dans les maquettes, implémente le véritable comportement fonctionnel correspondant.

Analyse et implémente notamment, selon les règles réellement identifiées dans les sources :

- La création et la gestion des éléments réceptionnés.
- Les formulaires et leurs validations.
- Les données obligatoires et conditionnelles.
- Les différents états et statuts.
- Les changements de statut.
- Les contrôles métier.
- Les opérations possibles selon le profil utilisateur.
- Les règles de modification.
- Les règles de suppression.
- Les opérations de validation et de rejet.
- Les interactions avec les autres modules.
- Les traitements automatiques.
- Les messages de confirmation et d'erreur.
- Les cas particuliers et les situations exceptionnelles.

Ne considère pas cette liste comme une définition exhaustive des fonctionnalités : les véritables règles sont celles à retrouver dans le code historique et les nouvelles spécifications.

Aucune fonctionnalité présente dans les spécifications ne doit être oubliée.

---

## 5. PRIORITÉ ABSOLUE : MODULE COORDINATION

La coordination doit faire l'objet du même niveau d'analyse et d'implémentation que la réception.

Analyse son fonctionnement existant, les nouvelles maquettes et toutes les spécifications correspondantes.

Reconstitue intégralement les processus métier de coordination.

Identifie notamment :

- Les différents parcours.
- Les acteurs et leurs responsabilités.
- Les opérations disponibles.
- Les affectations.
- Les règles de gestion.
- Les validations.
- Les conditions de changement de statut.
- Les droits d'accès.
- Les interactions entre les différentes étapes.
- Les relations avec la réception.
- Les interactions avec les autres modules.
- Les traitements automatiques.
- Les erreurs et les cas particuliers.

Chaque action représentée dans les nouvelles maquettes doit correspondre à une véritable fonctionnalité.

Les exemples MOCK présents dans les maquettes doivent t'aider à identifier les données nécessaires et à comprendre les différents cas d'utilisation.

Ils ne doivent pas devenir des données codées en dur dans la version finale.

---

## 6. INTERACTIONS ENTRE RÉCEPTION ET COORDINATION

Il est impératif de ne pas traiter ces deux modules comme deux fonctionnalités indépendantes.

Comprends et implémente l'ensemble des interactions entre eux.

Vérifie notamment :

- Les données transmises d'un module à l'autre.
- Les conditions permettant de déclencher une action.
- Les transitions de statuts ayant des conséquences sur l'autre module.
- Les règles de synchronisation.
- Les validations croisées.
- Les dépendances entre les traitements.
- Les droits nécessaires.
- Les cas où une opération est impossible en raison de l'état de l'autre module.
- La cohérence des données après chaque opération.

Une action dans la réception doit produire exactement les conséquences métier attendues dans la coordination, et inversement lorsque cela est prévu par les spécifications.

Utilise des transactions lorsque plusieurs opérations doivent être réalisées de manière atomique.

Prévois également les protections nécessaires contre les mises à jour concurrentes et les doubles soumissions.

---

## 7. RESPECT STRICT DES NOUVELLES MAQUETTES

Les nouvelles maquettes présentes dans `docs-sources/` constituent la référence visuelle et fonctionnelle de la nouvelle application.

Je souhaite que tu les analyses écran par écran.

Respecte notamment :

- La structure des pages.
- Les menus.
- Les formulaires.
- Les tableaux.
- Les colonnes.
- Les filtres.
- Les recherches.
- Les boutons.
- Les actions disponibles.
- Les statuts affichés.
- Les messages.
- Les fenêtres modales.
- Les navigations.
- Les interactions.
- Les informations conditionnelles.
- Les états vides.
- Les états de chargement.
- Les états d'erreur.

Exploite les exemples MOCK déjà présents dans les maquettes pour comprendre les données attendues et les comportements illustrés.

Tu dois cependant remplacer progressivement ces exemples par de véritables données issues du backend et de la base de données.

Je souhaite un frontend moderne, professionnel, propre et responsive, mais le design ne doit jamais prendre le dessus sur l'exactitude fonctionnelle.

NE SIMPLIFIE PAS les parcours métier pour rendre les écrans plus faciles à développer.

---

## 8. BASE DE DONNÉES ET MODÈLE PRISMA

Analyse le schéma de la véritable base de données.

Compare-le avec les entités métier identifiées dans le code source et les spécifications.

Construis un modèle Prisma cohérent avec la nouvelle architecture.

Respecte :
- Les relations.
- Les clés étrangères.
- Les contraintes.
- Les cardinalités.
- Les statuts.
- Les historiques.
- Les données de référence.
- Les règles d'intégrité.

Fais évoluer le modèle lorsque c'est nécessaire pour prendre en charge les nouvelles fonctionnalités.

Chaque évolution doit être documentée et associée à une migration.

N'effectue aucune suppression destructive non justifiée.

---

## 9. TESTS ET GÉNÉRATION MASSIVE DE JDD

Je souhaite une couverture de tests particulièrement approfondie.

Ne te contente pas de quelques tests nominaux.

Après l'implémentation, génère plusieurs milliers de jeux de données de test variés, réalistes et reproductibles.

Prévois notamment :

- Des données nominales.
- Des données incomplètes.
- Des valeurs limites.
- Des combinaisons de données.
- Des données invalides.
- Des différents statuts.
- Des différents profils utilisateurs.
- Des parcours alternatifs.
- Des cas de rejet.
- Des cas de reprise.
- Des doublons.
- Des transitions interdites.
- Des interactions entre réception et coordination.
- Des opérations simultanées.
- Des cas de volumétrie importante.

Les JDD doivent respecter les contraintes relationnelles de la base lorsque l'objectif est de tester des parcours fonctionnels valides.

Les données volontairement incorrectes doivent être utilisées pour tester les rejets et validations.

Utilise une génération reproductible avec des seeds configurables.

Ne réutilise aucune donnée personnelle réelle.

### Stratégie de tests obligatoire

- Tests unitaires des règles métier.
- Tests d'intégration des API et de la base.
- Tests des permissions.
- Tests des transitions de statuts.
- Tests transactionnels.
- Tests de non-régression.
- Tests E2E avec Playwright.
- Tests de réception.
- Tests de coordination.
- Tests de bout en bout réception → coordination et dans l'autre sens lorsque le processus le prévoit.

Chaque règle métier doit être associée à un ou plusieurs scénarios de tests pertinents.

Les milliers de JDD ne remplacent pas les tests de couverture fonctionnelle.

Les tests doivent être exécutés sur une base isolée, jamais sur la base de production.

---

## 10. MÉTHODOLOGIE DE DÉVELOPPEMENT

Ne développe pas tout le projet dans une seule opération massive.

Travaille par étapes cohérentes (une commande `/etape-xx` par session).

1. Audit et compréhension : analyse l'ensemble des sources et produis la documentation fonctionnelle et technique.
2. Architecture : crée le nouveau projet indépendant avec la stack demandée.
3. Modèle de données : prépare le modèle Prisma et les migrations nécessaires.
4. Socle backend : développe les services communs, l'authentification, les permissions et les validations.
5. Réception : implémente et teste l'intégralité du module.
6. Coordination : implémente et teste l'intégralité du module.
7. Interactions métier : valide tous les échanges entre les deux modules.
8. Autres fonctionnalités : implémente les autres dépendances indispensables identifiées durant l'analyse.
9. Tests massifs : génère les JDD, exécute les tests et corrige les anomalies.
10. Audit final : compare l'intégralité de l'application avec les spécifications et les maquettes.

À chaque étape, mets à jour la documentation et la matrice de traçabilité.

Ne t'arrête pas après avoir créé le socle technique ou les écrans : l'objectif est une application réellement fonctionnelle.

---

## 11. LIVRABLES ATTENDUS (dans `docs/` du nouveau projet)

- `docs/ANALYSE_ARCHITECTURE_EXISTANTE.md`
- `docs/ANALYSE_FONCTIONNELLE_COMPLETE.md`
- `docs/RECEPTION_REGLES_METIER.md`
- `docs/COORDINATION_REGLES_METIER.md`
- `docs/ANALYSE_MODELE_DONNEES.md`
- `docs/MATRICE_TRACABILITE_SPECIFICATIONS.md`
- `docs/ECARTS_EXISTANT_VS_CIBLE.md`
- `docs/PLAN_IMPLEMENTATION.md`
- `docs/RAPPORT_TESTS.md`
- `docs/AUDIT_FINAL_CIRCE.md`
- `docs/QUESTIONS_OUVERTES.md`

La matrice doit relier chaque exigence fonctionnelle à sa source, son implémentation et ses tests.

À la fin, je veux pouvoir connaître précisément :
- Les fonctionnalités implémentées.
- Les règles métier prises en charge.
- Les parcours réellement opérationnels.
- Les tests exécutés.
- Les anomalies corrigées.
- Les écarts restants.
- Les fonctionnalités non terminées.

---

## 12. EXIGENCES NON NÉGOCIABLES

1. Ne modifie jamais `circe-develop/` ni `docs-sources/`.
2. Ne néglige aucun document de spécification.
3. Analyse toutes les nouvelles maquettes.
4. Exploite les exemples MOCK présents directement dans les maquettes pour comprendre les données et les interactions attendues.
5. Ne conserve pas les données MOCK en dur dans les fonctionnalités finales.
6. Ne perds aucune règle métier existante encore applicable.
7. Ne développe pas uniquement des écrans sans backend fonctionnel.
8. Ne contourne jamais une validation métier.
9. Ne considère jamais un test réussi comme une preuve de couverture complète.
10. Ne déclare jamais une fonctionnalité terminée si elle est partiellement implémentée.
11. Ne masque jamais les exigences non couvertes.
12. Ne fais aucune supposition métier sans la documenter.

## OBJECTIF FINAL

Je veux obtenir une nouvelle application CIRCE, indépendante de l'ancien projet, reposant sur la nouvelle stack technique demandée.

L'application doit respecter les spécifications fonctionnelles et les nouvelles maquettes.

Les modules Réception et Coordination doivent être particulièrement complets, fiables et conformes à l'ensemble des règles métier.

La priorité n'est pas de produire rapidement un joli frontend, mais de reconstruire fidèlement et intégralement les processus métier.

Je veux une véritable application opérationnelle, avec des API, une base de données, des workflows, des validations, des permissions et une couverture de tests sérieuse.

**Ne sacrifie jamais l'exactitude métier, la complétude fonctionnelle ou la fiabilité des données pour gagner du temps de développement.**