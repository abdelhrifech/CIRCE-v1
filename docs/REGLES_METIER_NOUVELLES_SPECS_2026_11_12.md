# Règles implémentées — nouvelles spécifications du 12/11/2026

Ce document mémorise les comportements du code, avec leurs sources. Il complète `RECEPTION_REGLES_METIER.md` et `COORDINATION_REGLES_METIER.md`. Il ne remplace pas une décision métier par une simulation de la maquette.

## Priorité des sources et décisions

- La note de transmission Production Bus du 08/10/2026 prévaut sur les ateliers, le CDC de juin et les premières US Bus, comme elle l’indique explicitement.
- La nouvelle maquette du dossier `docs-sources/news specs/OneDrive_1_12-11-2026/maquette` est comparée à celle de `docs-sources/2. CIRCE CIBLE + MAQUETTE/maquette` : 19 fichiers modifiés, 5 nouveaux.
- Consigne utilisateur conservée : administrateur = toutes les permissions et tous les centres ; le choix explicite d’un site continue à filtrer l’écran et les opérations.
- Confirmation utilisateur : pour BUS-22 et BUS-26, conserver les garde-fous existants. Aucune échéance d’ajustement supplémentaire, aucune production ou dépose automatique, aucun traitement automatique de « reste en place » n’a été ajouté.

## Réception

| Identifiant | Comportement effectif | Source / preuve principale |
|---|---|---|
| RG-NEW-REC-001 | Sans BL est un choix explicite. Photo, numéro de BL et imprimeur peuvent manquer ; le transporteur reste obligatoire. La livraison porte « Sans BL ». Le rattachement reste manuel, à confirmer selon les droits habituels. | `reception.js`, demande du 09/11 ; `reception/validation.int.test.ts` |
| RG-NEW-REC-002 | Une ligne ajoutée manuellement au panier arrive non cochée. Seules les coches explicites participent au BL. Le glissement sélectionne/désélectionne une plage ; revenir en arrière restaure les lignes quittées à leur état avant le geste. | `reception.js`, `core.js` ; tests panier, sélection, E2E |
| RG-NEW-REC-003 | Contrôler et imprimer sont deux actions distinctes. « Valider le contrôle » conserve le contrôle sans enregistrer une impression ; « Valider et imprimer » ouvre l’aperçu. Le contrôle terminé disparaît. La liste des affiches propose les feuilles restant à imprimer. | `reception.js` ; tests contrôle et parcours E2E |
| RG-NEW-REC-004 | Validation admin depuis la sélection d’affiches. Les propositions sûres sont précochées ; les doutes demandent toujours une confirmation explicite. Aucun autre visuel du même dossier n’est validé implicitement par cette sélection. | `reception.js`, `instructions.js` ; `validation-admin.int.test.ts` |
| RG-NEW-REC-005 | Une inconnue à identifier s’ouvre dans sa fiche ; le rattachement se fait dans Préparations. Plus de panneau de recherche sous le tableau pour les orphelines. Le rattachement conserve stock, contrôles, droits et transition vers le sas. | `identification.js` ; tests affiches et E2E |
| RG-NEW-REC-006 | Les modifications du repiquage, de la conservation, de la zone picking et de la photo de l’affiche sont persistées, versionnées et historisées. Une photo hors périmètre est refusée. La feuille de stock utilise la photo disponible. | nouvelle maquette, fiche affiche ; `affiches.int.test.ts` |

Les règles existantes de quantités, d’allocation, de doublon de BL, de contrôle, de validation admin, de stock et de version restent appliquées. Un constat de NC demandé à l’arrivée est enregistré dans la même transaction que la réception : pas de demi-enregistrement.

## Non-conformités

- Deux formulaires : réception contrôlée et réclamation agence. Les champs obligatoires et conditionnels sont contrôlés aussi par le serveur. Les justificatifs sont conservés en base et téléchargés depuis une route protégée.
- Origine conservée : déclaration autonome, réception ou réception inconnue. Une déclaration liée à une réception ne peut pas désigner des affiches étrangères à cette réception ou à sa plateforme.
- Les types explicitement bloquants ou non bloquants de la maquette déterminent la portée. Croix mal positionnées et écart de quantité demandent une portée explicite lorsqu’aucun type ne la détermine.
- Portée non bloquante : « Pour statistique », sans décision à prendre. Portée bloquante sans décision : « À décider » et alerte dans le moteur commun.
- Une liste de décisions à choix multiple remplace les anciens champs de décision séparés. La Préproduction/Coordination décide ; la plateforme peut seulement ajouter « Traité par la plateforme » après une demande de traitement. Les décisions antérieures restent conservées.
- « Traité par la plateforme », « OK préparation en l’état », « NON JUSTIFIE » ou « RAF » aboutissent à « Traitée » ; les autres décisions demandent une action plateforme. Les conflits de version sont refusés.
- Le référentiel des déclarants est administrable et importable en XLSX : première colonne, titre facultatif, ajout par défaut ou remplacement explicite. Doublons neutralisés à la casse, aux accents et aux espaces près. Les réceptions et déclarations historiques restent conservées.

Source : `nonconformite.js`, `reception.js`, `parametrage.js`, `xlsxread.js`. Preuve : tests `test/nonconformite/parcours.int.test.ts` et `e2e/admin-nouvelles-specs.spec.ts`.

## Bus

| Source | Règle implémentée |
|---|---|
| BUS-01 à 03 | Données issues du lot d’intégration Broadcast, sans ressaisie des ventes. DSP → plateforme ; une DSP sous-traitée sans plateforme est ignorée. Formats stables AR1, AR2, FG, FD, AV, avec correspondance paramétrée vers le support. |
| BUS-04 à 09 | Réceptions attendues et reçus reposent sur les lignes attendues, affiches, mouvements et rattachements communs. Une réception Bus est visible dans Réception ; pas de compteur de stock parallèle. Un complément partiel conserve le numéro d’affiche. |
| BUS-08 | Une réception sans dossier est possible puis complétée par rattachement ; les contrôles métier et le périmètre du parcours commun restent appliqués. |
| BUS-10 à 14 | Échéance affichée vendredi S-2 16 h 30, selon la convention horaire existante du projet. Entretien fourni, conformité du thème, photo avant collage et test de collage sont enregistrés. Le délai technique et le vernissage AV sont informatifs ; aucune DM automatique. |
| BUS-12 | Une NC Bus décrit le conditionnement ou le format, jamais une absence de livraison. Le roulé sous 50 exemplaires est tracé et non bloquant. Aucun refus de réception au-dessus de 50 n’est déduit de cette tolérance. |
| BUS-13 | La photo réelle est conservée et accessible aux profils autorisés, y compris le commerce du périmètre et pour les compléments. Ce stockage local ne prétend pas réaliser une intégration OneDrive. |
| BUS-15 à 18 | Préparation détaillée par centre et semaine, synthèse et étiquettes de dispatch utilisent les données courantes. Les intitulés amont modifiés sont repris ; les feuilles concernées sont marquées à refaire. |
| BUS-19/20 | Ajustement uniquement manuel par centre × parc × format. Quantité vendue et quantité Broadcast conservées séparément de la quantité ajustée. Historique avant/après, auteur et date. Retour explicite à Broadcast possible. Le garde-fou existant interdit de réajuster après lancement en production. |
| BUS-21/22 | Référentiels DSP, centres, parcs A/B ou autres, formats, cadastre et terrain paramétrables. Une destination utilisée ne peut être déplacée silencieusement ; une correspondance support utilisée exige une migration explicite. Aucun ajustement à partir du cadastre ou du terrain n’est automatique. |
| BUS-23 | Le nouveau parcours Bus ne crée ni colis ni expédition transporteur ni picking. |
| BUS-24/25 | Suivi sur six semaines, attendus/partiels/complets/surplus, échéances et vue condensée. Les quatre anomalies sont lisibles sans nouveau moteur de notifications Bus. La couverture de quantité affichée n’accorde pas de nouveau droit de production. |
| BUS-26 | « Reste en place » reste une information reçue des IP, sans calcul automatique de durée, dépose, maintien ou nouvelle instruction. |

Un réimport conserve l’ajustement manuel et ne double ni les lignes ni le stock. Si la semaine ou le thème de destination change, les quantités de l’ancien et du nouvel attendu sont recalculées. Un lot avec deux occurrences de la même clé Bus est refusé. Un import EDR classique complet n’annule pas les dossiers du flux Bus.

Les anciens dossiers Bus du modèle unitaire restent lisibles pour la reprise. Pour les dossiers alimentés par le nouveau modèle Bus, l’ancien ajustement global est refusé : seul le grain BUS-19 est accepté.

Preuve : `test/bus/parcours.int.test.ts`, tests d’intégration Broadcast et parcours navigateur.

## J−3, tableau de bord et présentation

- J−3 : trois sections de la maquette, Wissous 1, Wissous 2 et Nîmes, par semaine ISO. Initialisation une seule fois avec les dossiers incomplets de l’EDR ; ajout explicite d’autres dossiers ; retrait du suivi sans suppression du dossier métier. Quantités recalculées depuis les attendus/reçus ; annotations et surcoûts partagés, versionnés et historisés. Export XLSX. La composition Nîmes indiquée comme à confirmer dans la source est conservée comme hypothèse de maquette.
- Tableau de bord : compteurs, listes, alertes, notes limitées à 500 caractères ; ajout, retrait, largeur, ordre et glissement. Les filtres s’appliquent aux différents contenus. La disposition est conservée par utilisateur authentifié en base, plutôt que par un stockage navigateur partagé entre profils.
- Alertes : gravité conservée côté règles et administration, retirée des indicateurs, filtres et colonnes de l’écran opérationnel. Types à choix multiple et ordre chronologique.
- Navigation : fin de l’onglet Pré-production ; accès direct aux nouveaux écrans, aux contextes À traiter fixe/pliage et aux colis du type ; sous-vues Déroulant et vérification des thèmes accessibles dans le menu principal. Suppression des barres de navigation internes correspondantes.
- Présentation des états de production : jaune, orange, rose, violet, violet foncé avec textures distinctes ; information en gris. Les libellés restent visibles sans dépendre des couleurs.
- Exports XLSX : filtres et colonnes visibles, nombres conservés ; dates natives pour les exports construits avec des dates. Les fichiers destinés aux machines ne sont pas convertis en tableaux bureautiques.

## Limites à distinguer d’une règle réalisée

L’adaptateur réel Broadcast et la reconnaissance automatique BL/visuel requièrent toujours leurs contrats et services externes. Les boutons de maquette simulant un envoi ne constituent pas une intégration réelle. La note Bus exclut une interface directe Circé ↔ Field Service ; aucun envoi réel n’est donc annoncé comme réalisé.

Cette adaptation ne résout pas par déduction tous les écarts antérieurs répertoriés dans `ECARTS_EXISTANT_VS_CIBLE.md` : notamment le suivi global de production complet de la maquette, les écrans Stocks dédiés, les fichiers machine multi-rouleuse et certaines éditions industrielles. Leur absence est signalée ; aucun lien vers une page inexistante ni indicateur artificiel n’est ajouté pour donner une apparence de couverture.
