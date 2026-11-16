Exigences transverses consolidées. Colonne « Portée » : P1 = exigence à satisfaire dans les écrans/parcours Réception et Coordination (étapes 5-6) ; Socle = étape 4 (socle backend commun) ; E8 = étape 8 (dépendance) ; Hors = hors périmètre de la mission. Les EX des ateliers sont cités avec +500 (Q-350). Les contraintes d'ingénierie (CLAUDE.md, MISSION §2) sont signalées « projet » quand les specs ne les écrivent pas.

### 7.1 Authentification, habilitations, périmètre

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Connexion et droits par rôle fournis par le lot 0 (socle). Mécanisme de la cible non spécifié (existant : compte Windows/AD, aucun écran de login) | EX-TRA-001 | Socle | Q-001 (APIM / Entra ID ?) |
| Permissions vérifiées côté serveur, dans le service (l'existant n'a aucun `[Authorize]`, les droits ne masquent que des menus) | EX-TRA-002 ; projet (CLAUDE.md §6) | Socle puis P1 (chaque endpoint) | — |
| Six rôles provisoires ; le sélecteur de rôle de la maquette est un outil de démonstration (en production le rôle vient de l'authentification) | EX-TRA-003 | Socle | Q-003, Q-352, Q-353 |
| Rôle Commerce en lecture seule (pas de boutons d'action) | EX-TRA-004 | P1 (REC lecture) | Q-355 |
| Droits spécifiques : « Valider » réservé Coordination ; droits `validation_admin`, `Zone_Picking`, `fusion_affiche` à reporter | EX-TRA-005 | P1 (validation admin) ; E8 (Zone picking, fusion) | Q-354, Q-352 |
| Site choisi au bandeau 1, valable pour toute l'application ; périmètre utilisateur (`tr_utilisateur_data`) | EX-TRA-006 | Socle + P1 (filtre de tous les écrans) | Q-357, Q-358 |
| Comptes nominatifs : validation et contrôle exigent le nom d'une personne ; adresse mail Cityz, plus d'adresse générique | EX-TRA-007 ; EX-ADM-502 | Socle (identité) ; E8 (gestion des utilisateurs) | Q-001, Q-359 |
| Ré-impression des bagues restreinte (directeurs de plateforme, chefs d'équipe) | EX-ADM-503 | P1 (ECR-COO-11) | Q-356 |
| Sécurité : pas d'identifiants en clair (ISO 27001) ; secrets hors dépôt | EX-TRA-038 | Socle | Q-010 |

### 7.2 Impressions, PDF, agent local d'impression

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Feuille de stock = étiquette rack A4, mention « définitive » ou « temporaire », impression en lot (1 à 5 exemplaires), avec/sans étiquettes rack ; aperçu avant impression | EX-TRA-024 ; ECR-REC-09, ECR-REC-10 | P1 (REC) | Q-002, Q-367 |
| Simplifier l'impression de l'étiquette rack (au moins une étape en moins) et permettre l'impression multiple depuis la liste (3 clics par dossier aujourd'hui) | EX-REC-515, EX-REC-502, EX-TRA-507 | P1 (REC) | — |
| Autres éditions existantes : fiche de préparation (détail/synthèse, Excel), bagues, étiquettes de colis et de rack, picking par semaine, fiche de synthèse, quantités à encoller (bus) | EX-TRA-025 | P1 (bagues, fiche de synthèse : ECR-COO-11, ECR-COO-09) ; E8 (étiquettes colis, picking) | Q-367 |
| Génération PDF : aucune spec de la cible ; contrainte projet « PDF générés côté navigateur uniquement » ; existant RDLC (ReportViewer) PDF/Excel serveur | EX-TRA-026 ; projet (MISSION §2) | Socle (composant d'impression) | Q-368 |
| Agent local d'impression : mode d'appel (navigateur ou API) non tranché ; existant : envoi direct aux imprimantes de la plateforme (étiquette rack à la validation admin) | EX-TRA-024, EX-TRA-025 ; projet | P1 pour les impressions (REC-P01) | Q-002 (bloquante pour les impressions) |
| Code-barres d'étiquette rack : format legacy « A- » + id d'affiche complété à 13 caractères | legacy-admin.md RG-ADM-062 provisoire | P1 (REC) | Q-368 |
| Export « Exporter » en .xlsx (ordre de l'écran, en-tête gras figé, filtre auto, nombres et dates typés) ; seuls les fichiers machine restent CSV ; garder l'extraction Excel sur longue période | EX-TRA-016 ; EX-TRA-505, EX-TRA-513 | P1 (tous les tableaux) | Q-360 |

### 7.3 Authentification externe et intégrations (APIM, Broadcast, Geodis, mail)

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| APIM / Entra ID : accès aux API d'entreprise non décrit par les specs (mention CLAUDE.md §8) | projet | Socle | Q-001 |
| Broadcast : Circé interroge Broadcast à intervalles réguliers (flux destinataires, préparations, trains, instructions, EDR S à S+8) ; ne peut pas écrire dans Broadcast (mail/alerte pour toute correction) ; retour : affiche « associée » seulement si liée et validation admin = 1 (ANO-05) | EX-TRA-039 | P1 (lecture des attendues/préparations) ; E8 (alimentation, retour) | Q-005, Q-377, Q-378, Q-379 |
| Dates de validité et « annule et remplace » des données de l'interface BC | EX-TRA-512, EX-TRA-514 | E8 | Q-378 |
| Interfaces tierces : Geodis (API Zoom, fichier TXT, preuve de livraison), Process Métier (non-conformités), Vendôme/Caire (.ini), SMTP, AD | EX-TRA-040 | Hors P1 sauf Broadcast et Process Métier ; E8 pour Geodis | Q-390, Q-394 |
| Mails conservés : demande de correction à la Pré-Prod (Broadcast), mail « rajout après préparation » à la liste de distribution ; les autres mails sont remplacés par des alertes | EX-TRA-030 | P1 (COO) ; E8 (SMTP) | Q-375 |

### 7.4 LLM

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Fournisseur LLM éventuel via API compatible chat/completions, derrière l'interface `LlmProvider` ; usage fonctionnel possible : reconnaissance visuelle des affiches orphelines (REC-17 hors périmètre avant le 31/12) | projet (CLAUDE.md §3) ; EX-REC-507 | Socle (interface seule) ; usage Hors P1 | Q-369 |

### 7.5 Performances, volumétrie, disponibilité

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Raccrochages en masse sans blocage (Circé « bugge » quand il y a trop de lignes) ; saturation à la génération des fichiers | EX-SCR-506, EX-SCR-514 | P1 (COO) / E8 (GEN) | — |
| Pas de rafraîchissement manuel à chaque changement de filtre ; suppression des « caches » de valeur de filtre ; volumétrie réelle EDR S à S+8 | EX-TRA-504, EX-TRA-506 ; ECR-PIL-03 | P1 (tous les écrans) | — |
| Sauvegarde des données de la veille (« base REF ») ; extraction sur période longue (aujourd'hui mois par mois) | EX-TRA-510, EX-TRA-513 | Hors P1 / E8 | Q-396 |
| Actions de masse sans version : concurrence, double soumission, atomicité (non traités par les specs) | projet (CLAUDE.md §6) | Socle | — |
| Aucun seuil de performance chiffré dans les sources | — | — | Q-373 (seuils) |

### 7.6 Audit, historisation, traçabilité

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Journal des actions lancées, modifiées, ajoutées ; chaque génération de fichiers = lot versionné ; durée de conservation et consultation non précisées | EX-TRA-034 ; ECR-ADM-08 | Socle (journal) ; E8 (écran) | Q-376 |
| Journal d'événements de réception (réception, contrôle, rattachement, changement de thème, retrait, modification, impression et réimpression de feuille, étiquette rack) ; historique de l'affiche (qui, quand) ; dissociation à historiser comme une association | EX-TRA-035 | P1 (REC) | — |
| Historique de la validation admin : nom et date (`validationAdmin_par`, `validationAdmin_le`) ; rattachements par qui et quand, actif/retiré | EX-TRA-036 | P1 (COO) | — |
| Stock = somme des mouvements, chaque mouvement tracé (référence, date, BL, équipe, machine, transporteur, imprimeur, quantité) | EX-TRA-037 | P1 (REC) | — |
| Chaque changement de statut écrit un historique (une machine d'états par entité) | projet (CLAUDE.md §6) ; Q-D de maquettes-reception-coordination.md | Socle + P1 | Q-381 |
| Pas de trace des changements de droits/référentiels dans l'existant ; ajout en cible | legacy-admin.md RG-ADM-030 à 036 provisoires | E8 | — |
| Purge / rétention : réceptions attendues à 4 semaines (sauf conservation) ; conservation d'affiches (20 / 365 existant) ; vidage du rebut ; la purge ne lève pas d'alerte | EX-TRA-042 ; EX-TRA-032 ; EX-REC-512 | P1 (REC) | Q-384 |
| Rétention du journal et des photos de BL non définie | EX-TRA-042 | — | Q-370, Q-376 |

### 7.7 Notifications et mails

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Confirmation d'action en bas à droite pendant 5 secondes ; erreur bloquante près du champ ; pas d'action sans retour visible | EX-TRA-033 | P1 (UX) | — |
| Mails sortants : canaux (bandeau, bandeau + mail, mail immédiat, digest 7 h, désactivée) ; aucun mail ne part dans la maquette ; « les alertes remplacent les mails » vs mails conservés | EX-TRA-029, EX-TRA-030 | E8 (SMTP) ; P1 pour le bandeau | Q-375 |
| Listes de distribution gérées en Administration (chef d'atelier, admins plateforme, coordinateurs) | EX-ADM-504 ; EX-COO-503 | E8 | — |
| Plus de mail à la réception d'un dossier pour le Commerce ; mail automatique au commercial refusé | EX-TRA-004 ; EX-REC-523 | P1 (non-implémentation) | Q-388 |

### 7.8 Alertes

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Écran Pilotage › Alertes : gravité (4 indicateurs), type (filtres avec compteur), acquittement, lien vers l'écran concerné ; icône avec compteur au bandeau 1 | EX-TRA-027 ; ECR-TRA-01 | P1 | Q-371 |
| Gravités : Critique (bloque un départ/une deadline), Important (dans la journée), À surveiller, OK, Info ; toujours icône + libellé | EX-TRA-028, EX-TRA-019 | P1 | Q-372 |
| Règles d'alerte en configuration (seuil, gravité, destinataires, canal) | EX-TRA-029 ; EX-TRA-041 ; ECR-ADM-04 | E8 (écran) ; P1 (valeurs lues) | Q-373 |
| Catalogue d'alertes (17 types de la maquette ; réception EX-REC-063 à 072, coordination EX-COO-015, 027-029, 031, 047) | EX-TRA-031 | P1 | Q-374 |
| Dashboard de réception : alertes d'écart +/- 10 %, réception sans IP | EX-REC-516 à EX-REC-521 | P1 (REC) | — |
| Menu Alertes Pré-Prod : intitulés de thèmes proches ; page des modifications de thème après identification | EX-COO-513, EX-THM-502, EX-THM-503 | E8 (THM) | Q-366 |
| Alerte rajouts post préparation / fixe après le 1er colisage | EX-COO-503, EX-FIX-503 | P1 (COO) | Q-380, Q-391 |

### 7.9 Accessibilité, UX transverse, états, responsive

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Deux bandeaux, pas de menu latéral ; 10 onglets ; une seule liste ouverte à la fois ; pas d'onglets dans les pages ; bouton « ← Retour » | EX-TRA-008, EX-TRA-009, EX-TRA-010, EX-TRA-013 | P1 (coque) | Q-365 |
| Barre de filtres unique (ET entre filtres, OU entre valeurs, compteurs, filtres « smart », N° de dossier avec collage de liste, 4 filtres visibles, « Départ ») ; filtres d'en-tête par colonne ; filtres intelligents annonceur -> thèmes | EX-TRA-014 ; EX-TRA-503 | P1 | Q-364 |
| Tableaux : 8 colonnes visibles, colonnes déplaçables/redimensionnables, vues personnalisables gardées sur le poste, sélection et actions groupées, 2 actions par ligne, densité 40/32 px, état vide explicatif, ordre des colonnes, sélections multiples | EX-TRA-015 ; EX-TRA-501, EX-TRA-502, EX-TRA-508 | P1 | Q-361 |
| En-tête de page, boutons (un principal), indicateurs cliquables, panneau latéral (consulter) / modale (saisir), jamais deux fenêtres empilées | EX-TRA-017 | P1 | — |
| Vocabulaire : 12 statuts uniques, « un mot, un sens », pas d'abréviation sans infobulle, dates « jeu. 15/10 16h30 », nombres « 1 284 » | EX-TRA-018 | P1 | Q-381 |
| Statut = pastille + libellé + gravité, jamais la couleur seule ; « Annulé » gris barré | EX-TRA-019 | P1 | — |
| États vide / chargement / erreur : seul le vide est décrit ; chargement et erreur = exigence projet | EX-TRA-020 ; projet (CLAUDE.md §6) | P1 | Q-362 |
| Postes : PC 1920x1080 (Coordination / chef d'équipe) ; réception/expédition : tablette ou PC d'atelier, cibles >= 40 px ; douchette contradictoire | EX-TRA-021 | P1 | Q-363 |
| Accessibilité : contraste >= 4,5:1, focus clavier visible, pas d'information par la couleur seule, cibles >= 32 px, tableaux et graphiques lisibles au clavier, vue tableau de chaque graphique | EX-TRA-022 | P1 | — |
| Charte visuelle : police système 14 px, grille 4 px, navy `#1b2a44`, accent `#0a6f93` ; graphiques : barres horizontales, pas de camembert comparatif | EX-TRA-023 | P1 (point de départ proposé, non imposé) | Q-361 |
| Réduire le nombre de clics ; distinguer chaque ligne par une couleur (critère non précisé) | EX-TRA-507, EX-TRA-509 | P1 (UX) | — |
| Plan du site et menu actuel (référence) | EX-TRA-011, EX-TRA-012 | P1 (plan) ; Hors (menu actuel) | Q-382 |
| Paramétrage : règles en configuration et non dans le code (machines, alertes, entretien : grain, seuil, arrondi) ; purge de la liste des destinations | EX-TRA-041 ; EX-TRA-511 | E8 | Q-373 |
