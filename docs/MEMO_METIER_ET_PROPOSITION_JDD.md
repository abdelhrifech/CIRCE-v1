# CIRCE — Mémo métier et proposition de JDD

Analyse du 9 novembre 2026. Demande : comprendre `circe-v1`, conserver les règles métier existantes et proposer des jeux de données de test. Seuls ce mémo et son inventaire associé sont ajoutés ; aucun code métier, paramètre, test ou contenu de base n'est modifié.

## Portée et mémoire du projet

Ce document conserve une mémoire explicite et relisible pour les prochaines interventions. Il ne remplace ni les spécifications, ni la matrice, ni les décisions dans `QUESTIONS_OUVERTES.md`. Un comportement codé peut dépendre d'une hypothèse non validée : le décrire ne constitue pas une validation métier.

Lecture ciblée des services de Réception et Coordination, des machines d'états, des JDD, des tests et de la documentation de suivi. Cette analyse n'est pas un nouvel audit exhaustif de tous les écrans, de toutes les spécifications ou de chaque branche du code. Le dossier historique `circe-develop/`, cité par la documentation, n'est pas présent à la racine de cette copie ; l'équivalence avec l'ancien système n'a donc pas été démontrée.

L'[inventaire associé](INVENTAIRE_REGLES_METIER_2026-11-09.md) reprend toutes les règles RG-REC, RG-COO et RG-X de la matrice, avec leur statut déclaré et les occurrences retrouvées dans le code et les tests. Une occurrence d'identifiant, surtout dans un commentaire, n'est pas une preuve d'implémentation ni de couverture.

Pour reprendre le travail : relire ce mémo, retrouver les RG concernées dans l'inventaire, vérifier le service et les tests correspondants, puis consulter les questions ouvertes avant toute modification. Ne pas convertir un comportement litigieux en règle nouvelle au moyen d'un JDD.

## Architecture observée

- Monorepo pnpm, `apps/web` (React/TanStack), `apps/api` (Node/TypeScript/Prisma), `packages/shared` (contrats et validation).
- SQLite dans l'implémentation actuelle. L'ancienne mention PostgreSQL de `MISSION.md` est dépassée par la décision Q-343 et les instructions `CLAUDE.md`.
- Modules majeurs : Réception, Coordination, Administration, file de mails et tâches. Le web relaie les requêtes vers l'API.
- Services métier, transactions, historique, permissions et versions optimistes constituent les mécanismes à préserver. Les intégrations externes simulées ne prouvent pas le fonctionnement avec les systèmes réels.

## État des règles : recomptage actuel

Commande exécutée en lecture seule : `node docs/_travail/controle-tracabilite.mjs`. Résultat : **858 lignes, 0 anomalie de traçabilité**. Ce contrôle vérifie des liens documentaires et des références, pas l'exactitude fonctionnelle.

| Règles | Total | FAIT | PARTIEL | BLOQUÉ | À FAIRE | NON REPRIS |
|---|---:|---:|---:|---:|---:|---:|
| Réception | 189 | 119 | 34 | 19 | 0 | 17 |
| Coordination | 230 | 128 | 92 | 4 | 0 | 6 |
| Inter-modules | 54 | 33 | 20 | 0 | 1 | 0 |
| Total RG | 473 | 280 | 146 | 23 | 1 | 23 |

Les 473 règles ne sont donc pas toutes implémentées intégralement. Les statuts sont ceux de la matrice existante, pas une certification issue de cette lecture.

Pour l'ensemble RG + exigences + écrans, le recomptage donne 394 FAIT, 345 PARTIEL, 32 BLOQUÉ, 64 À FAIRE et 23 NON REPRIS. Il diffère de l'audit daté du 6 novembre (343 PARTIEL et 66 À FAIRE) : utiliser le résultat actuel plutôt que recopier les totaux anciens.

## Comportements importants vérifiés dans les services

### Réception

| Sujet | Comportement codé à préserver | Références principales |
|---|---|---|
| Attendu / reçu / reste | Attendu selon la source BC ou PREPA, avec repli sur l'autre quantité ; reçu = somme des rattachements actifs ; reste = max(0, attendu − reçu). | RG-REC-017 ; `reception/lignes.ts`, `stock.ts` |
| Statut de ligne | Reçu ≤ 0 : ATTENDUE ; reçu < attendu : PARTIELLE ; au-dessus du seuil strict de tolérance : SURPLUS ; sinon COMPLETE. Pour attendu 100 et seuil 10 %, 110 est COMPLETE et 111 SURPLUS. | RG-REC-018 ; `reception/lignes.ts` |
| Arrivée | La réception connue crée une réception A_CONTROLER, les affiches ou compléments, les mouvements et les rattachements. Le reçu existe dès l'arrivée, avant le contrôle et sans validation administrative automatique. | RG-REC-038 à 044, RG-X-005 ; `reception/validation.ts` |
| BL doublonné | Un numéro de BL déjà reçu déclenche un conflit confirmable, pas une interdiction absolue : confirmation explicite exigée. | RG-REC-036 ; `reception/validation.ts` |
| Complément | Réutilise une affiche déjà liée activement à la ligne, lorsque celle-ci est PARTIELLE ; ajoute mouvement et quantité au lien. La première validation administrative est conservée par ce parcours. | RG-REC-040, RG-X-018 ; `reception/validation.ts` |
| Contrôle | Toutes les affiches de la réception doivent être présentes exactement une fois ; contrôleur du site, allée et rayon obligatoires. Quantités non négatives. Écart au BL inscrit comme mouvement signé. | RG-REC-056 à 069 ; `reception/controle.ts` |
| Rebut | Mouvement négatif plafonné au stock disponible. Il réduit le stock, sans réduire le reçu porté par les liens. | RG-REC-064 ; `reception/controle.ts` |
| Stock | Somme des mouvements ; la quantité stockée sur l'affiche est un cache recalculé. Mouvement entier non nul, signe selon le type ; mouvement négatif refusé s'il rend le stock négatif. | RG-REC-151, 153, 154 ; `reception/stock.ts` |
| Répartition | Lors de l'ajout, somme des quantités réparties + quantité ajoutée ≤ stock courant. Ne pas transformer cette garde ponctuelle en invariant permanent « reçu = stock », notamment après rebut ou expédition. | RG-X-060 ; `reception/stock.ts` |
| États | A_IDENTIFIER → A_CONTROLER → CONTROLEE ; retrait du dernier dossier peut revenir à A_IDENTIFIER, y compris depuis CONTROLEE. Le retour direct CONTROLEE → A_CONTROLER est interdit. | RG-REC-070, 071, 114 ; `reception/statuts.ts` |
| Liens | Un lien ACTIF peut devenir RETIRE ; il n'est pas réactivé. Les statuts d'affiche ORPHELINE / IDENTIFIEE suivent les rattachements. | RG-REC-137 ; `reception/statuts.ts` |

### Coordination et effets croisés

| Sujet | Comportement codé à préserver | Références principales |
|---|---|---|
| Validation administrative | Confirmation humaine ; indépendante de la quantité, de la prépa et d'Instruction OK. Une affiche inconnue doit d'abord être rattachée. L'annulation de validation ne crée pas de mouvement et ne remet pas la palette à contrôler. | RG-COO-001, 002, 008, 014, 016 ; RG-X-050 ; `coordination/effets-validation.ts` |
| Doutes | Motifs cumulables : BL, FORMAT, THEME, MULTI, SANS_IP, ANNULEE, LIGNE_FERMEE. État calculé avec priorité inconnue, puis validée, puis doute ou proposition. | RG-COO-005 à 007 ; `coordination/validation-admin.ts` |
| Instruction OK automatique | Prépa reçue, instruction EN_COURS, commentaire vide, exceptions égales à la quantité hors entretien, répartition à 100 %, aucun écart BC/Circé connu non nul. L'écart null ne bloque pas ce calcul. | RG-COO-042, 043, 052, 055 ; `coordination/instruction-ok.ts` |
| Répartition à 100 % | Somme par couple support × type de préparation, tolérance numérique < 1e-6. Sans visuel, la fonction considère la répartition conforme. | RG-COO-043 ; `coordination/instruction-ok.ts` |
| Instruction OK manuelle | Prépa reçue et répartition à 100 % restent nécessaires ; les critères automatiques de commentaire et d'exceptions ne sont pas tous des gardes de la validation manuelle. | RG-COO-044, 052 ; `coordination/instruction-ok.ts` |
| Renvoi de prépa | Avant export, réouverture d'Instruction OK en EN_COURS et effacement du calcul des trains ; validation administrative conservée. | RG-COO-054 ; `coordination/instruction-ok.ts` |
| Lignes attendues | Une ligne fermée est conservée et marquée ANNULEE. Les déplacements de rattachement retirent les anciens liens et préservent la traçabilité. | RG-COO-085, 087 à 089 ; `coordination/lignes-vie.ts` |
| Alimentation BC | Lecture vide : pas de modification ; ligne absente marquée puis fermée à la lecture suivante ; correspondances et semaines participent au rapprochement. | RG-COO-080 à 091 ; `coordination/alimentation-lignes.ts` |
| Trains | Machines d'états distinctes pour faces, actions utilisateur et export. Le statut agrégé du train dépend des faces et de la couverture des visuels. | RG-COO-208, 210, 218, 220 ; `coordination/statuts-trains.ts` |
| Déblocage | Refus si production trop avancée ou contrôle impossible faute de correspondance ; annulation des répartitions/UM autorisées, traçabilité et mises en file ; les appels externes restent soumis au contrat simulé. | RG-COO-143 à 147, 277, 278 ; `coordination/deblocage.ts` |
| Colis | Quantité placée par colis plafonnée à l'UM, cohérence atelier/destinataire, transitions encadrées ; fin de journée déclenche les sorties de stock. | RG-COO-264 à 269, RG-X-087 ; `coordination/colis.ts` |
| Accès et concurrence | Permissions et périmètre vérifiés côté serveur ; version périmée refusée. Les droits du rôle et l'appartenance au site sont deux contrôles distincts. | RG-REC-001, 002, 009 ; RG-COO-167 ; fichiers `permissions.ts` et socle |

## JDD existants : les réutiliser

Le registre `apps/api/test/jdd/scenarios/index.ts` contient 13 familles : `nominal`, `incomplet`, `limites`, `invalides`, `statuts`, `transitions-interdites`, `doublons`, `profils`, `rejets-reprises`, `inter-modules`, `concurrence`, `aleatoire`, `volumetrie`.

Il existe déjà des factories, un contexte commun, des appels API, des vérifications de scénarios et un contrôleur d'invariants SQL dans `apps/api/test/massif/invariants.ts`. La suite de tests massifs complète le générateur ; lancer uniquement `pnpm jdd` ne revient pas à exécuter toute la suite d'intégration ni tous ses invariants.

Contraintes actuelles observées :

- Seeds entières de 1 à 999 ; `volume` règle la taille des familles, pas le nombre exact d'enregistrements créés.
- Garde du runner sur une URL SQLite finissant par `test.db`, chargement de `.env.test` par le script CLI.
- Purge par défaut des données créées ; `--keep` les conserve. Ne pas proposer `--keep` comme un chargement de démonstration dans la base de développement.
- Les numéros de dossiers dépendent de `seed % 9` : deux seeds de même reste conservées simultanément peuvent se heurter. Les clés d'idempotence et séquences sont aussi dérivées de la seed.
- Le contexte lit `new Date()` pour la semaine ISO : une seed fixe seule ne garantit pas les mêmes dates entre deux semaines. Un futur JDD de calendrier devra fixer l'horloge de test.
- Les données invalides doivent être soumises aux validations API, pas introduites directement en base pour simuler un parcours valide.

## Ajouts proposés, sans changement métier

Les cas ci-dessous renforcent les scénarios existants. Ils ne signifient pas que chaque sujet est absent de tous les tests actuels. Les attentes chiffrées doivent être indépendantes de la fonction métier testée, sinon un même défaut peut passer dans le code et dans le calcul de l'attendu.

| Priorité / lot | Jeu de données concret | Résultat à vérifier / intérêt |
|---|---|---|
| P1 — Réception aux bornes | Attendu 100, reçu 0/1/99/100/110/111, seuil configuré à 10 %, puis autre seuil et autre plateforme. | Statuts exacts, reste et alerte contrôlés séparément. `limites.ts` vérifie surtout la réussite de plusieurs appels : ajouter des assertions détaillées. RG-REC-017/018. |
| P1 — Concurrence opposée | Une validation et une annulation réellement concurrentes sur la même version ; changement de thème contre validation ; contrôle contre retrait du dernier lien. | Un résultat conforme au verrouillage, état final complet, pas de mélange de deux opérations, journal et stock cohérents. Le scénario K-02 actuel envoie deux annulations, malgré son commentaire évoquant validation contre annulation. RG-X-012, RG-REC-009. |
| P1 — Atomicité des lots | Réception ou validation avec plusieurs objets : premiers valides, dernier invalide ; refus pour site, version ou quantité. | Après rejet : aucune écriture partielle dans les entités, mouvements, liens et historiques concernés. Réutiliser les tests d'atomicité existants et étendre les combinaisons. |
| P1 — Comptage zéro, diagnostic | BL 100, un lien actif 100, puis contrôle compté 0 ; variante à plusieurs liens et avec rebut. | Relever séparément stock, reçu, statut et quantité du lien. Actuellement `Math.max(1, …)` peut laisser reçu 1 avec stock 0. ANO-064 / Q-416 : ne pas présenter cette divergence comme une règle validée. |
| P1 — Quantité après colisage, diagnostic | Ligne 40, colisage, changement à 30 ou 50 avant production ; variante après passage PREPARE. | Photographier quantité de répartition, UM et colis. ANO-063 / Q-418 : le code modifie la répartition sans synchroniser l'UM dans ce service. Le choix entre synchronisation et refus reste ouvert. |
| P2 — Compléments successifs | Attendu 100 : réception 40, validation, complément 30, contrôle, complément final ; variantes avec changement de thème et site incorrect. | Même affiche quand les conditions le permettent, cumuls exacts et pas de doublon. Documenter séparément Q-399 / RG-X-061 concernant une nouvelle proposition du complément. |
| P2 — Calendrier déterministe | Passage S52/S53/S01 avec des années ISO valides, fin de mois et année bissextile, juste avant/à/après les délais. | Fenêtre d'alimentation, retard et purge selon les comparaisons réellement codées. Les JDD actuels créent des lignes S1/S52 sans démontrer à eux seuls un franchissement d'année. |
| P2 — Paramètres / plateformes | Deux sites avec seuils différents ; ateliers 8 m² configurés puis non configurés ; types bus/pliage et majoration colis. | Application du bon paramètre et absence de contamination entre sites. Scénarios nominaux seulement avec configuration explicitée ; conserver les hypothèses Q-265/Q-404 comme telles. |
| P2 — Broadcast rejoué | Même lot deux fois, lecture vide, disparition sur deux passages, renvoi avant puis après export, référence externe inconnue. | Idempotence, fermeture attendue, historiques et validation conservés selon chaque RG. Couverture du contrat simulé uniquement, sans affirmer la compatibilité réelle. |
| P2 — Fin de journée rejouée | Plusieurs colis partageant une UM et un stock, puis seconde fin de journée et tentative de sortie excessive. | Quantité expédiée une seule fois, stock non négatif, bons statuts de colis/UM et rollback du refus. RG-COO-269 / RG-X-087. |
| P3 — Démonstration métier | Petit ensemble lisible : reçue partiellement, inconnue à identifier, palette à contrôler, doute à confirmer, instruction en cours, train prêt, colis à expédier. | Utile pour recette manuelle et écrans. À distinguer des campagnes massives ; le besoin « démonstration » n'est pas confirmé dans la demande tronquée. |

Les deux diagnostics ANO-063 et ANO-064 correspondent déjà à des `it.todo` dans `apps/api/test/massif/non-regression.int.test.ts`. Ajouter des reproductions observables est possible sans corriger les services ; définir leur comportement cible exige de trancher les questions correspondantes. Une caractérisation du comportement actuel ne doit pas faire passer ces anomalies en « résolues ».

## Proposition de réalisation ultérieure

Commencer par les assertions de bornes, la vraie concurrence opposée et l'atomicité ; ajouter ensuite les reproductions des anomalies ouvertes dans un rapport distinct. Étendre le registre existant uniquement si une nouvelle famille est utile. Pour chaque cas, conserver identifiant RG, contexte initial, action API, résultat attendu, résultat réel et état de base après action.

Exemple de campagne sur les familles déjà disponibles, depuis `circe-v1`, après préparation de la base de test :

```sh
pnpm jdd --seed=42 --volume=20 --scenarios=nominal,limites,concurrence,inter-modules --json
```

Cette commande est une proposition, **non exécutée pendant l'analyse**. Ne pas annoncer de nouveaux scénarios disponibles avant leur ajout. Faire une première exécution modeste, puis augmenter le volume et varier les seeds en purgeant entre campagnes ; le nombre d'enregistrements n'est pas le nombre de règles couvertes.

## Vérifications de cette intervention

- Lecture du code et des scénarios ciblés ; recomptage de la matrice avec le contrôleur existant : 0 anomalie.
- Aucun test applicatif, JDD, serveur, migration ou seed lancé pendant cette analyse ; aucun nouveau résultat de tests fonctionnels revendiqué.
- Les résultats historiques de `RAPPORT_TESTS.md` et `AUDIT_FINAL_CIRCE.md` restent des résultats historiques.
- Ajouts limités à ce mémo et à l'inventaire documentaire. Aucune règle métier corrigée ou réinterprétée dans l'application.
