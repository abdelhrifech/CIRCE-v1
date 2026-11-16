# Audit final CIRCE V2

Étape 10, rédigé le 2026-11-06 après correction de la traçabilité et exécution de la chaîne complète. Les chiffres de statut viennent de la matrice `MATRICE_TRACABILITE_SPECIFICATIONS.md`, recomptée par le script `docs/_travail/controle-tracabilite.mjs` (0 anomalie). Les chiffres de tests viennent de l'exécution réelle (détail : `RAPPORT_TESTS.md`).

**Verdict en une phrase : CIRCE V2 n'est PAS prêt pour la production et ne peut pas être présenté comme terminé.** Une partie des règles est implémentée et prouvée par des tests (394 lignes de la matrice sur 858 sont FAIT), mais 343 sont PARTIEL, 32 BLOQUÉ, 66 À FAIRE et 23 NON REPRIS ; l'authentification est celle de développement, l'API refuse de démarrer en production, et les liaisons externes (Broadcast, imprimantes, mail, machines) sont simulées.

## 1. Synthèse (chiffres de la matrice)

Recomptage réel de la matrice (statut FAIT = implémentation appelée en production + tests nominal ET rejet ; en cas de doute : PARTIEL).

| Type | Total | FAIT | PARTIEL | BLOQUÉ | À FAIRE | NON REPRIS |
|---|---|---|---|---|---|---|
| RG-REC (Réception) | 189 | 119 | 34 | 19 | 0 | 17 |
| RG-COO (Coordination) | 230 | 128 | 92 | 4 | 0 | 6 |
| RG-X (inter-modules) | 54 | 33 | 20 | 0 | 1 | 0 |
| EX (exigences) | 333 | 106 | 168 | 9 | 50 | 0 |
| ECR (écrans) | 52 | 8 | 29 | 0 | 15 | 0 |
| **Total** | 858 | 394 | 343 | 32 | 66 | 23 |

Avant la correction de traçabilité (même périmètre) : RG-REC 119 FAIT / 49 PARTIEL / 21 BLOQUÉ ; RG-COO 136 / 85 / 4 / 5 NON REPRIS ; RG-X 35 / 19 ; EX 95 FAIT / 161 PARTIEL / 10 BLOQUÉ / 67 À FAIRE ; ECR 10 / 24 / 18 À FAIRE. Le tableau « Synthèse » de la matrice affichait en outre 858 « À FAIRE » (jamais régénéré) : il est maintenant exact.

Ce que la correction a changé : 42 EX ont changé de statut (dont EX-COO-511, EX-FIX-501, EX-COO-038 passés PARTIEL ; EX-REC-501 et six EX Réception passés FAIT ; EX-EXI-003 FAIT ; EX-COO-040 / 041, EX-EXI-010 / 011 / 056 / 059 / 073, EX-SCR-513 passés PARTIEL) ; 4 RG d'intégration Broadcast (091, 102, 115, 116) et tout le groupe Q-265 / Q-404 (RG-COO-237, 241, 250, 262, RG-X-084) rétrogradés PARTIEL ; RG-X-061 passée À FAIRE ; RG-REC-092 passée BLOQUÉ (Q-002, sans test) ; 17 règles legacy et RG-COO-058 passées « NON REPRIS — décision à valider » ; RG-REC-008 et RG-REC-178 promues FAIT après vérification des tests.

Note de lecture : 66 des 333 EX et 15 des 52 ECR sont encore À FAIRE (Stock, Pilotage, Aide, Navigation, ergonomie transverse) ; le périmètre prioritaire de la mission (Réception et Coordination) est largement implémenté mais pas terminé.

## 2. Fonctionnalités implémentées

Implémentées et appelées par l'API / le web (le détail fichier:fonction est dans la matrice) :

- Socle : API REST Node / Prisma / SQLite, erreurs au format unique `{ code, message, details?, regle? }`, permissions contrôlées dans le service, machines d'états avec historique, verrouillage optimiste, `Idempotency-Key` sur les POST de création / transition de la Réception, journal d'audit, périmètre site / atelier.
- Réception : réceptions attendues (recherche, filtres, reçu / attendu / reste, statut de ligne), panier et bon de livraison (photo, unicité du n° de BL), « Valider la réception » (affiches, mouvements, complément, partielle, surplus, sans IP), sas et contrôle de la palette (comptage, écart de 10 %, rebut, emplacement), feuilles de stock et étiquettes rack (aperçu et PDF côté navigateur), réceptions inconnues (création, identification, rattachement, « dossier introuvable »), liste et fiche des affiches (champs modifiables, changement de thème, rattachements), stock et mouvements, alertes calculées, paramètres et référentiels (imprimeurs, livreurs, agents).
- Coordination : liste des instructions et Instruction OK (manuelle et automatique), écart Broadcast / Circé, validation admin (cas sûrs, doutes, lot, annulation, effets), lignes attendues (règles de vie), passage d'intégration Broadcast (cinq flux, journal) sur contrat simulé, alertes Pré-Prod et vérification des thèmes, déblocage « Rendre la main », trains (calcul, positions, couverture, fractionnement, changement de statut), export des trains, suivi par thème, préparation, générateur de fichiers simulé, dispatch du roulage, rouleurs, bagues, suivi 8 m², préparation unitaire (fixe, pliage, bus), libération de la semaine et Colisage (hypothèse Q-265), colis, expédition, fin de journée, sorties de stock.
- Administration (étape 8) : utilisateurs et périmètre (D-01), sites et ateliers en lecture (D-02), plateformes (D-03), référentiels de réception (D-04), destinataires (D-05), paramètres métier (D-06), règles d'alerte (D-08), file d'envoi des mails simulée (D-19), ordonnanceur de tâches désactivé par défaut (D-20).
- Outillage : générateurs de JDD reproductibles (13 familles, 29 invariants), script de contrôle de traçabilité.

## 3. Règles métier prises en charge

Voir le tableau du §1. Lecture par catégorie :

- RG-REC : 119 FAIT (63 % des 189). 34 PARTIEL, dont RG-REC-005 / 006 / 007 (journal et historique incomplets : pas d'Administration › Journal, dossier / semaines / format non historisés), RG-REC-043 (formats : 2 fonctions sur 3 jamais appelées en production), RG-REC-089 / 091 / 155 (devenues PARTIEL : impression automatique dépendante de Q-002, droit de l'ajout manuel de stock non attribué, Q-117), RG-REC-179 (hypothèse Q-407), RG-REC-182 (bandeau seul, ni résumé de 7 h ni mail). 19 BLOQUÉ (reconnaissance du visuel Q-112, dashboard, dates prévisionnelles Q-134, impression RG-REC-092). 17 NON REPRIS (fusion, zone picking, rebus, listes legacy : décision à prendre, Q-100 / 101 / 118 / 155).
- RG-COO : 128 FAIT (56 %). 92 PARTIEL, dont tout le groupe « libération de la semaine / Colisage » (Q-265 / Q-404, hypothèse non validée), les règles dépendant de paramètres vides par défaut (RG-COO-237, 263, 305 : `suivi8m2.ateliers`, `colis.ateliersMajoration`, `unitaire.typesBus`, `unitaire.typesPliage`) et l'intégration Broadcast sur contrat simulé (RG-COO-091, 102, 103, 104, 115, 116, Q-005). 4 BLOQUÉ. 6 NON REPRIS (intégration AMT, Q-274 ; RG-COO-058).
- RG-X : 33 FAIT, 20 PARTIEL, 1 À FAIRE (RG-X-061 : nouvelle proposition du complément, Q-399). Concurrence et rollback ne sont pas démontrés pour RG-X-012 (concurrence), 052, 055, 056, 057 (concurrence), 064, 076 ; preuves faibles pour RG-X-084, 086, 088 (voir ECART-112).
- EX : 106 FAIT, 168 PARTIEL, 9 BLOQUÉ, 50 À FAIRE. Un EX n'est FAIT que si toutes les RG qu'il couvre le sont (calcul vérifié par le script) ; 2 EX ont un statut forcé documenté (EX-TRA-015, EX-TRA-042 : lien EX ↔ RG ténu).
- ECR : 8 FAIT (COO-03, COO-10, REC-02, 05, 06, 08, 09, 11), 29 PARTIEL, 15 À FAIRE. Plusieurs ECR FAIT portent sur l'écran seul : des RG liées y restent PARTIEL (indiqué dans leur remarque). Requalifications de l'audit : ECR-COO-08 et ECR-REC-10 de FAIT à PARTIEL (paramètre vide par défaut ; aucun test d'écran) ; ECR-REC-12, ECR-ADM-04 et ECR-ADM-07 de À FAIRE à PARTIEL (modale et écrans existants).

## 4. Parcours réellement opérationnels (démontrés en E2E)

93 tests E2E Playwright passent (22 fichiers, base de test, API 3101 + web 3100). Parcours démontrés de bout en bout :

- Réception : liste des attendues (filtres, statut, colonnes, erreur API) ; panier, photo du BL, modale Visuel ; valider la réception, contrôler la palette, imprimer la feuille définitive ; réception inconnue (création, identification, rattachement) ; liste et fiche des affiches ; étiquettes rack en lot.
- Coordination : validation admin (confirmer, doutes, lot) ; Instruction OK ; effets de la validation ; alertes Pré-Prod et vérification des thèmes ; état des réservations ; intégration Broadcast (simulée) ; déblocage ; trains ; export des trains ; préparation unitaire (libération, Colisage) ; roulage (dispatch, bagues, suivi 8 m²) ; expédition (colis, fin de journée).
- Inter-modules : Réception reçoit → Coordination voit « à confirmer » → valide → la Réception le voit → annulation → retrait du dernier dossier → réception inconnue (`interactions.spec.ts`).
- Administration : paramètres, utilisateurs, sites, plateformes, référentiels, alertes, destinataires.

Non démontré en E2E : le référentiel des rouleurs (API testée en intégration seulement, RG-COO-297), la modale « Ranger avant d'imprimer », les écrans Stock, Pilotage (Dashboard, suivi de prod), Journal, Aide.

## 5. Tests exécutés (renvoi RAPPORT_TESTS)

Chaîne exécutée une fois, séquentiellement, sur la base de test uniquement (`test.db`) :

| Commande | Résultat réel |
|---|---|
| `pnpm typecheck` | 0 erreur |
| `pnpm lint` | 0 erreur (ESLint + Prettier) |
| `pnpm test` | 287 OK (shared 16, web 34, api 237) ; 0 échec |
| `pnpm test:int` | 78 fichiers : 77 passés + 1 ignoré (tout en `it.todo`) ; 3733 tests OK, 1 échec attendu (témoin Q-179), 8 `it.todo` ; 3742 au total ; durée 247 s |
| `pnpm test:e2e` | 93 OK, 0 échec ; durée 1,2 min |
| `pnpm jdd --seed=777 --volume=1000` | 106 097 enregistrements en 86,7 s ; 5 786 vérifications OK, 0 échec |

Précisions honnêtes :

- Le premier `pnpm jdd --seed=2026` a échoué sur mon erreur d'usage (la seed doit être entre 1 et 999) ; relancé avec 777. Aucun test n'a échoué dans la chaîne ; aucune anomalie de code n'a donc été corrigée à ce stade.
- Les 8 `it.todo` sont des tests en attente, pas des tests réussis : RG-X-061, 085, 016, 077, 022 (5, `ecarts-connus.int.test.ts`), RG-COO-204 (1), NR-063 et NR-064 (2, `non-regression.int.test.ts`).
- Après la chaîne, seuls des noms de tests ont reçu des identifiants de règle (RG-REC-011, 089, 091, 113, RG-COO-104, RG-COO-072) et des commentaires `// RG-COO-072` et `// RG-X-nnn` ont été ajoutés au code sans changer le comportement. `pnpm typecheck` et `pnpm lint` ont été relancés (0 erreur), 7 fichiers d'intégration (219 OK + 5 `it.todo`) et `e2e/reception-attendues.spec.ts` (10 OK) aussi ; la chaîne complète n'a pas été rejouée après ces ajouts.
- Aucun nouveau test unitaire n'a été ajouté (consigne). La couverture de code n'est pas mesurable (aucun fournisseur installé).
- Le test de commande `taches:executer` (`taches.int.test.ts`) est conditionné par la présence d'un fichier `.env` (ECART-106) ; il a tourné ici car `.env` existe.
- Contrôle de traçabilité : 148 anomalies relevées par le script avant correction, 0 après (RAPPORT_TESTS §8).

## 6. Anomalies corrigées

- ANO-001 à ANO-064 (RAPPORT_TESTS §6) : 64 anomalies enregistrées, 60 corrigées dans le code ou les tests (droits manquants, versionnement, périmètre, limites de paramètres SQLite, fuite de lots entre sites, arrondis du quota, stock négatif ANO-061, performance ANO-062, etc.).
- Restent ouvertes ou en hypothèse (4) : ANO-019 (périmètre de l'administrateur : conflit de sources, hypothèse Q-179), ANO-058 (complément sans nouvelle proposition, Q-399), ANO-063 (quantité d'une ligne modifiée après le Colisage, Q-418, `it.todo` NR-063), ANO-064 (comptage à zéro : lien de 1 sur stock 0, Q-416, `it.todo` NR-064).
- Anomalies NR-xxx : NR-063 et NR-064 sont les deux seules, ouvertes, non corrigées (décision de l'utilisateur attendue) ; aucune NR nouvelle n'est apparue pendant cette chaîne.
- Corrections de traçabilité de l'audit final (pas des défauts de code) : tableau « Synthèse » faux, 148 écarts du script, EX périmés, mentions « Q-265 BLOQUANTE » périmées, Q-123 hors sujet pour RG-X-016 (nouvelle Q-419), références de fonctions et fichiers inexistants.

## 7. Écarts restants

Voir `ECARTS_EXISTANT_VS_CIBLE.md` (§3 écarts d'implémentation, §6 écarts consignés par l'audit final : ECART-104 à ECART-115). Les plus importants :

- Mails SIMULE marqués ENVOYE dans la file : risque de perte à la bascule SMTP (ECART-104).
- Verrou de version trivial sur plusieurs écritures de la Réception (impressions, stocks, inconnues, affiches, contrôle, rattachement) : seule la sérialisation de SQLite protège (ECART-108).
- `POST /admin/file-envoi/traiter` et `POST /admin/taches/:tache/executer` : pas de rejeu de réponse stocké (ECART-105).
- Droit `referentiel.gerer` exigé pour lire les agents (ECART-107) ; droit de passage manuel d'intégration : administrateur seul, alors que la matrice des droits dit coordination et administrateur (Q-189, ECART-111).
- Code non appelé en production : `alertesIntegration`, `dedoublonnerLignes`, `retirerCochees`, 3 fonctions de `formats.ts` (ECART-109).
- RG-COO-297 (rouleurs) sans E2E ; ECR-REC-01 : n° d'affiche non cliquables, colonne « Besoins couverts » et mode « Compact » absents (ECART-110, ECART-113).
- Concurrence et rollback non démontrés pour 7 règles inter-modules ; preuves faibles pour RG-X-084 / 086 / 088 (ECART-112).

## 8. Fonctionnalités non terminées

- Écrans À FAIRE : Stock (STK-01 / 02 / 03), Dashboard et suivi de prod (PIL-01 / 02), fiche dossier partagée (PIL-04), Journal (ADM-08), Machines (ADM-02), Statuts (ADM-03), Transport (ADM-06), Aide (AID-01 / 02), Navigation (NAV-01 / 02), générateur multi-rouleuse (GEN-02).
- Reconnaissance du visuel et lecture du BL (Q-112), dashboard de réception, date prévisionnelle de livraison (Q-134).
- Nouvelle proposition du complément (RG-X-061, Q-399) et surplus proposé à l'autre dossier (RG-X-016, Q-419).
- Intégration AMT (RG-COO-272 à 276, non reprise, Q-274) ; tableau de roulage (RG-COO-303, Q-278) ; ordonnancement « Paris » de l'export (RG-COO-214, Q-255) ; campagne contrôlée (RG-COO-204, Q-257).
- Reprise de données (D-23), statuts `tr_statut` (D-07), fiche dossier partagée (D-11), Geodis (D-17), Process Métier (D-22) : NON FAITS.
- 17 règles legacy Réception et RG-COO-058 : NON REPRIS, à décider.
- Dépendances de l'étape 8 : aucune n'est validée par l'équipe ; D-01, 02, 03, 05, 06, 08, 09, 10, 12, 13, 15, 16, 18, 19, 20, 21 PARTIEL, D-04 FAIT sous réserve de D-23, D-14 PARTIEL (colonne « Avancement » du plan §4).

## 9. Questions encore ouvertes

Bilan de `QUESTIONS_OUVERTES.md` : 289 questions ; 84 OUVERTES, 194 HYPOTHÈSE PRISE (option recommandée, à valider), 9 TRANCHÉES, 2 NON.

Bloquantes (la colonne « Bloquante ? » vaut OUI) :

- Q-005 (OUVERTE) : code et planification hors dépôt (procédures INTERFACE / EXTPLAY / Broadcast, `webapicirce`, jobs). Bloque l'alimentation réelle des réceptions attendues ; l'intégration tourne sur contrat simulé.
- Q-001 (hypothèse) : mode d'authentification (APIM ? Entra ID ?). L'identité de dev est la seule disponible.
- Q-002 (hypothèse) : appel de l'agent local d'impression. Aucune impression automatique aux imprimantes de plateforme.
- Q-265 (hypothèse, option (c)) : libération de la semaine contre bouton « Colisage », création des UM.
- Q-339 (OUVERTE) : outillage de la machine de développement ; périmée en pratique (pnpm fonctionne), à clôturer.

Ouvertes non bloquantes à trancher en priorité : Q-375 (mails réellement envoyés, digest 7 h, fournisseur SMTP), Q-194 (effet de « Envoyer à la machine »), Q-189 (qui lance un passage manuel Broadcast), Q-399 (complément proposé, RG-X-061), Q-418 (quantité d'une ligne modifiée après Colisage), Q-006 (batch d'Instruction OK automatique déployé ?), Q-134 (date prévisionnelle), Q-151 (batch PEX), Q-255 / Q-257 (ordonnancement Paris, campagne contrôlée), Q-281 / Q-284 (déclencheur de fin de journée, preuve de livraison), Q-282 (dernière minute), Q-175 (exports xlsx). Au total 82 questions OUVERTES non bloquantes figurent dans le fichier (dont celles ci-dessus).

## 10. Hypothèses « option recommandée » à valider par l'utilisateur

Prises sur délégation (« si tu ne trouves pas d'infos, fais le plus recommandé ») ; aucune n'est validée.

- Q-265 et Q-404 : libération sans création d'UM + bouton Colisage (deux boutons, contradiction avec la lettre de la maquette ECR-COO-09a) ; libération irréversible et sans effet de verrouillage ; Colisage proposé à tous les ateliers fixes alors que la spec ne vise que Wissous ; code barre dérivé du jour de création ; « préparation reçue » approximée.
- Q-402 : validation admin d'une affiche dont le dossier est ANNULÉ.
- Q-403 : référentiel des destinataires (périmètre minimal) ; Q-414 : source de vérité du mail et du téléphone des destinataires.
- Q-405 : bornes et formats des paramètres métier, valeurs structurées en lecture seule.
- Q-406 : administration des utilisateurs, rôles, périmètre, sites.
- Q-407 : plateformes (D-03) et référentiels de réception (D-04), y compris l'écran des agents en lecture seule.
- Q-408 : configuration des alertes (canal, destinataires ; gravité non configurable).
- Q-409 : file d'envoi des mails et fournisseur SMTP ; Q-413 : TLS du client SMTP.
- Q-410 : traitements planifiés, horaires vides par défaut (désactivés) ; Q-412 : compte technique `circe-automatique`.
- Q-411 : Départs camions, complément de génération, liste de picking, zone d'impression.
- Q-415 : PRNG maison pour les JDD ; Q-416 : comptage à zéro ; Q-417 : écart de contrôle refusé s'il rend le stock négatif.
- Q-418 : refuser la modification de la quantité d'une ligne dans une UM (recommandé : (a)).
- Q-419 : surplus d'une affiche partagée rattaché à la main (RG-X-052), aucune proposition automatique.
- Q-399 : modèle du complément proposé puis confirmé (OUVERTE, non bloquante).
- Autres hypothèses structurantes : Q-100 / 101 / 118 / 155 (fonctions legacy non reprises), Q-274 (AMT non repris), Q-188 (contrat d'entrée de l'intégration Broadcast), Q-193 / 195 / 196 (export, roulage, préparation unitaire), Q-178 (conventions de gravité et de comptage), Q-343 (SQLite à la place de PostgreSQL, TRANCHÉE).

## 11. Décisions à prendre par l'utilisateur

1. Valider ou refuser l'hypothèse Q-265 / Q-404 (deux boutons ; irréversibilité ; Colisage pour tous les ateliers fixes). Elle a fait passer 4 règles de FAIT à PARTIEL (RG-COO-241, 250, 262, RG-X-084) et conditionne 6 autres déjà PARTIEL (RG-COO-240, 242, 260, 261, RG-X-076 et ECR-COO-09).
2. Fournir ou décrire le code hors dépôt de l'intégration Broadcast (Q-005) et les horaires des tâches planifiées (Q-006, Q-410).
3. Choisir le mode d'authentification de production (Q-001) et l'agent d'impression (Q-002).
4. Dire quels mails partent réellement et choisir le fournisseur SMTP (Q-375, Q-409, Q-413), et décider comment requalifier les mails SIMULE avant la bascule (ECART-104).
5. Décider du sort des 17 règles legacy « NON REPRIS » et de RG-COO-058 : HORS PÉRIMÈTRE ou reprise.
6. Trancher Q-399 / Q-419 (complément, surplus), Q-418 (quantité après Colisage), Q-416 / Q-417 (stock), Q-194 (envoi à la machine), Q-189 (passage manuel).
7. Définir la stratégie de reprise de données (D-23) et d'hébergement (SQLite ou PostgreSQL, sauvegarde).
8. Valider les dépendances de l'étape 8 (aucune ne l'est) et la liste des écrans à ne pas faire.

## 12. Risques avant mise en production

Classés par gravité (1 = bloquant sans traitement).

1. Authentification de développement seulement (Q-001). Le fournisseur d'identité est un en-tête signé par HMAC injecté par le relais web ; l'API REFUSE de démarrer avec `NODE_ENV=production` (`apps/api/src/core/config.ts`). Aucun accès réel (APIM, Entra ID) n'existe : aucune mise en production possible en l'état.
2. Secret par défaut forgeable : `.env.example` fournit `DEV_IDENTITY_SECRET=change-me-dev-only-secret` ; quiconque connaît ce secret forge une identité d'administrateur sur tout environnement qui l'aurait gardé (le test utilise `test-only-secret-not-for-production`). À remplacer et à interdire hors développement.
3. Reprise de données inexistante (D-23) : aucune migration depuis SQL Server, aucun référentiel vivant (ateliers, types, destinataires) ; plusieurs règles sont vides par défaut (`suivi8m2.ateliers`, `colis.ateliersMajoration`, `unitaire.typesPliage`, `unitaire.typesBus`) donc inactives en production tant que l'administrateur ne les saisit pas.
4. SQLite à la place de PostgreSQL (Q-343) et absence de sauvegarde : un fichier local, pas de réplication, pas de stratégie de sauvegarde ni de restauration, concurrence limitée (la sérialisation des écritures SQLite masque le verrou de version trivial, ECART-108).
5. Intégration Broadcast simulée (Q-005) : aucun chargement réel des réservations ni des préparations ; contrat d'entrée supposé (Q-188). Le planificateur ne démarre pas sans source ; le retour « reçue et associée » vers Broadcast n'est pas envoyé (batch PEX non reproduit).
6. Ordonnanceur sans horaires (Q-005, Q-006, Q-410) : fin de journée des colis, purge des attendues, Instruction OK automatique en rattrapage et envoi des mails sont désactivés par défaut ; aucun horaire sourcé.
7. Mails : SMTP fait maison, sans STARTTLS, non validé (le client refuse les identifiants sur connexion non chiffrée, Q-413) ; canal SIMULE par défaut, et les mails SIMULE sont marqués ENVOYE (ECART-104) : perte à la bascule ; le mail « Rajout après préparation » n'existe pas (Q-375).
8. Agent d'impression local (Q-002) : aucune impression automatique aux imprimantes de plateforme ; seuls l'aperçu et le PDF navigateur existent ; l'échec d'impression n'est pas détectable (RG-REC-092 BLOQUÉ).
9. Export machine simulé (Q-193, Q-194) : le fichier `.ini` réel et le dépôt réseau sont derrière `MachinePort` simulé ; l'effet de « Envoyer à la machine » n'est pas tranché ; la garde « déjà envoyé » repose sur une version de train recalculable (risque de double production, Q-196 (12)).
10. Idempotence non purgée (Q-348) : la table des clés d'idempotence croît sans limite (9 407 lignes pour un JDD de volume 1 000) ; pas de rétention.
11. Autres : verrou de version trivial sur plusieurs écritures Réception (ECART-108) ; alertes sans pagination (3 Mo à 6 000 dossiers, RAPPORT_TESTS §5) ; couverture de code non mesurable ; droits « ? » refusés par défaut (Q-349) donc certaines fonctions (ajout manuel de stock, Q-117) sont inaccessibles à tous les profils ; performances mesurées seulement sur SQLite local.

## Annexe : comment rejouer le contrôle

`node docs/_travail/controle-tracabilite.mjs` (ou `--json`) relit la matrice et signale : EX FAIT dont une RG couverte ne l'est pas, mentions « reste » périmées, fichiers ou fonctions cités inexistants, FAIT / PARTIEL de RG sans test portant l'identifiant, tableau de synthèse inexact. Le code de sortie vaut 1 s'il reste une anomalie. Dernier résultat : 858 lignes, 0 anomalie.
