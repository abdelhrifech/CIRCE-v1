# Specs COORDINATION / Pré-production (cible) — extraction des exigences

Documents lus intégralement (dossier `2. COORDINATION/`) :
- **[PC]** `process_coordination_statuts_actions.html` (cible au 02/11, 2 pages).
- **[PP]** `process_preprod_avant_apres.html` (27/10, mis à jour 02/11, 12 sections).
- **[RA]** `receptions_attendues_doublons_tables_regles.html` (26/10, MAJ 27/10 et 02/11, 8 sections).
- Non fourni / illisible : `requetes_doublons_receptions_attendues.sql` (cité au sommaire ; non listé dans le dossier reçu).
- Compléments : [README], [DESIGN] (maquette), [DC] = dossier complet Réception.

Règle de lecture : la version **02/11 (option A)** remplace celle du 27/10 (passages barrés dans les sources). Le périmètre « Coordination » couvre : validation admin, Instruction OK, réceptions attendues (RG-AT), alertes de pré-production, export des trains.

---

## A. Principe général

### EX-COO-001 — Deux circuits indépendants
- Énoncé : la validation admin part de la réception physique ; l'Instruction OK part de la prépa (envoi Broadcast). Aucun des deux n'attend l'autre : la validation admin n'attend ni la prépa ni l'Instruction OK ; l'Instruction OK n'attend pas la validation admin. Fixe comme scro.
- Type : règle
- Source : [PC] p.1 (encadré « Indépendants ») ; [PP] encadré 02/11, §3, §8 ; [README] §2.4, H1
- Ambiguïté : [PP] §3 nuance l'existant (scro : dépendance indirecte) ; la cible supprime toute dépendance.

### EX-COO-002 — Fil conducteur
- Énoncé : « chaque passage à la main correspond à une information qui n'arrive pas à Circé » : on automatise en faisant arriver l'information, pas en supprimant l'étape. Aucun développement Broadcast.
- Type : règle
- Source : [PP] §1
- Ambiguïté : aucune

### EX-COO-003 — Acteurs
- Énoncé : Pré-Prod (gestionnaires) : saisit IP, envoie la prépa, dans Broadcast seulement, ne travaille pas dans Circé ; Réception : enregistre l'affiche physique ; Circé : crée lignes attendues, propose le rattachement, Instruction OK automatique ; Coordination : confirme validation admin, traite instructions « En cours », réceptions inconnues, export des trains du jeudi 14 h ; Chefs d'équipe/plateformes : produisent (démarrent souvent avant jeudi à leurs risques).
- Type : permission
- Source : [PP] §1 (tableau « Qui fait quoi »), §2 ; [PC] p.2
- Ambiguïté : [PP] §1 tableau (non barré) dit encore « Circé : fait … la validation admin quand il n'y a pas de doute » et « Coordination : les validations admin à doute » → obsolète vs option A. À Nîmes la Coordination = « Pré-Prod Nîmes » (Q61, déduit).

---

## B. Validation admin (option A, 02/11)

### EX-COO-004 — Circé propose, une personne confirme
- Énoncé : à la réception, Circé propose le rattachement de l'affiche à la ligne attendue de l'état des réservations, aidé du BL (n° de dossier ou de DA, format, plateforme, semaine, visuel). **Hypothèse retenue le 02/11 (accord de la cheffe de projet).** Rien n'est validé sans une personne ; son nom et la date sont tracés (RG-VA-04).
- Type : règle
- Source : [PP] encadré 02/11, §5 ; [RA] encadré, RG-VA-04 ; [PC] p.1 ; [README] §3, §6 H1
- Ambiguïté : hypothèse non validée définitivement (marquée « hypothèse retenue »).

### EX-COO-005 — Origine du n° de dossier associé
- Énoncé : (1) lu sur le BL (photo du BL) : cas courant ; (2) sinon par le visuel (photo d'une affiche comparée aux visuels de Broadcast ; doute « pas de n° sur le BL ») ; (3) sinon saisi (« Par n° de dossier », DA, annonceur, ou dans Réceptions inconnues). Circé cherche ce n° dans les lignes attendues (dossier, thème, format, semaine). Un visuel commun à plusieurs dossiers donne plusieurs n° : répartition à confirmer. Aujourd'hui : n° saisi sur l'affiche (plusieurs n° séparés par « + »).
- Type : règle
- Source : [PC] p.1 (encadré « Le n° de dossier associé ») ; [PP] §5
- Ambiguïté : aucune

### EX-COO-006 — Cas sûr : conditions (pré-coché)
- Énoncé : une proposition est un cas sûr (pré-cochée) quand : l'affiche est rattachée à une ligne attendue active ; le n° de dossier ou de DA lu sur le BL est celui de la ligne ; même format ; un seul thème possible (ou le visuel lu sur le BL le désigne) ; un seul dossier. La prépa arrivée n'est plus une condition (supprimée le 02/11).
- Type : règle
- Source : [PP] §5 ; [RA] RG-VA-01 (reprise comme définition du cas sûr), RG-VA-04 ; [DC] §15
- Ambiguïté : aucune

### EX-COO-007 — Motifs de doute
- Énoncé : sinon, doute avec motif affiché : « Rattachée sans le n° du BL » (par le visuel ou à la main) ; « Format différent » ; « Plusieurs thèmes possibles » ; « Répartition à confirmer » (visuel de plusieurs dossiers) ; IP pas saisies ; validation annulée. Les doutes ne sont jamais pré-cochés et demandent une confirmation explicite.
- Type : règle
- Source : [PP] §5 ; [PC] p.1 ; [DC] encadré 02/11 ; [README] §3 ; [DESIGN] §11
- Ambiguïté : la liste de motifs varie légèrement entre documents ([DC] cite « BL sans n° de dossier, format différent, plusieurs thèmes possibles, même visuel pour plusieurs dossiers, validation annulée » ; [PC] ajoute « IP pas saisies »).

### EX-COO-008 — Confirmation en lot
- Énoncé : page Pré-production › « Validation admin et Instruction OK » : cas sûrs pré-cochés à l'arrivée sur l'écran, bouton « Valider la sélection » (un clic) ; bouton « Cocher les cas sûrs » recoche les premières lignes ; doutes un par un dans la fiche du dossier (« Affiches reçues et validation admin »), bouton « Valider ». Confirmation explicite si la sélection contient des doutes. Bandeau : « Aucune validation sans vous : Circé propose, vous confirmez ».
- Type : fonctionnalité
- Source : [PC] p.1-2 ; [README] §3 ; [DESIGN] §11
- Ambiguïté : taille maximale du lot, et comportement des cas déjà pré-cochés après changement de filtre (une fois par arrivée sur l'écran).

### EX-COO-009 — Validation décochable ; traçabilité
- Énoncé : une validation se décoche toujours (« Annuler la validation ») ; nom de la personne et date tracés ; l'historique ne dit plus « validée par Circé » (02/11).
- Type : règle
- Source : [PP] §5 ; [RA] RG-VA-04 ; [DC] encadré 02/11
- Ambiguïté : aucune

### EX-COO-010 — Qui peut valider
- Énoncé : le bouton « Valider » n'est visible que pour la Coordination ; l'agent de réception ne valide pas. Le rattachement d'une réception inconnue par la Coordination vaut validation.
- Type : permission
- Source : [README] §3 (Liste des affiches), §3 (Réceptions inconnues), H1 ; [DC] §7 ; [PP] §6
- Ambiguïté : le droit existant `validation_admin` (relevé §13) est-il conservé tel quel ou remplacé par le rôle Coordination ? non dit.

### EX-COO-011 — La quantité n'est pas une condition (RG-VA-03)
- Énoncé : une réception partielle est validée pour ce qu'elle contient ; le manque reste un état de la ligne (« reste à recevoir ») avec son alerte. Exemple 3/3/3 réception partielle (A 3, B 2, C 0) : A et B validées, rien à valider pour C ; le complément de B est proposé puis confirmé à sa réception.
- Type : règle
- Source : [PP] §5, §6 ; [RA] RG-VA-03, cas 24
- Ambiguïté : aucune

### EX-COO-012 — États de validation d'une affiche
- Énoncé : Réception inconnue (à identifier d'abord) ; À confirmer : proposé (cas sûr, pré-coché) ; À confirmer : doute (un par un) ; Validée (par une personne, nom et date). Un dossier n'est jamais « Validée » sans affiche reçue.
- Type : transition
- Source : [PC] p.1 ; [DC] encadré 02/11 ; [README] §5 ; [DESIGN] §11
- Ambiguïté : libellés divergents (voir Contradictions) : « Proposée par Circé / À vérifier / Orpheline » ([DC]) vs « À confirmer : proposé / doute / Réception inconnue » ([PC]).

### EX-COO-013 — Statut de validation du dossier (pastille)
- Énoncé : « Dossier · deux pastilles indépendantes » : préparation (À traiter : prépa pas envoyée ; Préparation reçue : envoyée par la Pré-Prod ; (Annulé)) et validation admin (Aucune affiche reçue : rien à valider ; À confirmer (n) ; Validée : toutes confirmées). Statut du dossier « Validation admin faite » (ex « Validé Pré-Prod ») = toutes les affiches reçues confirmées par une personne.
- Type : transition
- Source : [PC] p.1 ; [DC] §9 ; [README] §5 ; [DESIGN] §11
- Ambiguïté : libellé « Validée » vs « Validation admin faite ». Dossier sans affiche reçue : « Aucune affiche reçue » (pas « faite »).

### EX-COO-014 — Effets de la validation admin
- Énoncé : n° d'affiche dans le suivi de prod ; picking (verrou) ; « reçue et associée » envoyé à Broadcast ; étiquette rack imprimée à la plateforme ; sortie de la liste « à traiter » ; historique. L'effet « UM du fixe et du pliage » est **non démontré**, corrigé le 02/11. Le n° d'affiche est visible dans l'état des réservations dès la réception (• à confirmer, ✓ validée) ; dans le suivi de prod dès la prépa.
- Type : traitement auto
- Source : [PP] §3, encadré correction ; [PC] p.1-2 ; [README] §3
- Ambiguïté : Q62 : étiquettes rack en rafale au clic de la confirmation en lot (grouper par plateforme ou bouton imprimer).

### EX-COO-015 — Alerte « Validation admin à confirmer »
- Énoncé : une alerte par affiche à doute ; grave pour un départ en S ou S+1 ; destinataire Coordination ; ouvre l'écran de validation.
- Type : traitement auto
- Source : [PC] p.2 ; [DC] §11 ; [README] §7
- Ambiguïté : libellé « Validation admin à faire » ([DC], [PP]) vs « à confirmer » ([PC]).

### EX-COO-016 — Thème ou quantité changés après validation (RG-VA-02)
- Énoncé : si le thème ou la quantité de la ligne change après la validation, ou si la ligne est annulée : alerte. Proposition : thème changé → validation à refaire ; quantité changée → alerte seule (Q55). Prépa différente de l'état des réservations : alerte.
- Type : règle
- Source : [RA] RG-VA-02, cas 13 ; [PP] §6, §9
- Ambiguïté : Q55 ouverte (proposition non tranchée).

### EX-COO-017 — Réception inconnue rattachée
- Énoncé : alerte « Réception inconnue à identifier » ; si introuvable, « Signaler » → alerte « Dossier introuvable » ; destinataire Coordination ; rattachée par la Coordination, l'affiche est validée.
- Type : règle
- Source : [PP] §6 ; [PC] p.2 ; voir EX-REC-035 à 041
- Ambiguïté : Q61 pour Nîmes.

---

## C. Instruction OK (déroulant)

### EX-COO-018 — Règle de Nariman (automatique)
- Énoncé : pour chaque ligne atelier × plateforme du déroulant : pas de commentaire de prépa **et** nombre d'exceptions = quantité (hors entretien) → passage automatique en « Instruction ok » ; Circé répartit les thèmes sur les trains et crée l'entretien. « En cours de mise en place ».
- Type : traitement auto
- Source : [PC] p.1 ; [PP] §1, §4 ; [RA] RG-IOK-01 ; [PP] Q49 (réglée 26/10)
- Ambiguïté : Nariman (code « en cours de mise en place ») : déjà en production ? (question « À confirmer »). Voir Q60.

### EX-COO-019 — Instruction OK manuelle
- Énoncé : sinon, le dossier reste « En cours » : la Coordination lit le commentaire, contrôle quantités, exceptions, entretien et positions (souvent « début » ou « fin de train »), puis « Instruction OK (après contrôle) » ; ou « Annulé » (pas à produire, tant que les trains ne sont pas exportés). Écart dû à « reste en place » : constat puis Instruction OK ; écart dû à une erreur : « Appliquer la version Broadcast » ou « Demander une correction à Broadcast » (mail à la Pré-Prod).
- Type : transition
- Source : [PC] p.1-2 ; [PP] §4
- Ambiguïté : aucune

### EX-COO-020 — Statuts de l'instruction
- Énoncé : À traiter (faces reçues, pas les instructions) → En cours (prépa reçue, posé par Circé) → Instruction ok (Nariman sinon Coordination) → Prêt à produire (exportée le jeudi ; ex « A imprimer ») ; Annulé (avant l'export). Code existant : 0 A traiter, 1 En cours, 2 Instruction Ok, 4 Annulé, 5 A imprimer. Repasser « En cours » efface le calcul des trains, sauf faces « A imprimer ».
- Type : transition
- Source : [PC] p.1 ; [PP] §3, §12 ; relevé §3 ; [README] §5
- Ambiguïté : « À traiter » désigne aussi le dossier (prépa non envoyée) : « un mot, un sens » ([DESIGN] §11). Q51 : grain atelier × plateforme (Circé) vs par dossier (maquette).

### EX-COO-021 — Instruction OK calcule et fige les trains
- Énoncé : l'Instruction OK déclenche le calcul des trains (visuel de chaque face selon les pourcentages, n° de train, ordre, affiches d'entretien) puis les fige (réglages verrouillés, renvois de Broadcast ignorés).
- Type : traitement auto
- Source : [PP] §3
- Ambiguïté : aucune

### EX-COO-022 — Moment de l'Instruction OK automatique (Q60 / RG-IOK-02)
- Énoncé : Circé ignore aujourd'hui, sans rien dire, les instructions et faces renvoyées après l'Instruction OK. Option (a) recommandée pour commencer : appliquer la règle le jeudi 14 h par un bouton « Instruction OK des dossiers conformes » puis exporter ; option (b) dès l'arrivée de la prépa avec réouverture du dossier si renvoi avant l'export. La maquette refait l'Instruction OK quand la prépa est renvoyée, tant que les trains ne sont pas exportés.
- Type : règle
- Source : [PP] §4, §9, §10 ; [RA] RG-IOK-02, cas 17
- Ambiguïté : **non tranchée** (Q60 pour Nariman).

### EX-COO-023 — Points à vérifier avec Nariman
- Énoncé : répartition à 100 % exigée (l'automatisme doit faire le contrôle) ; entretien 8 % par défaut (où arrive un autre taux ?) ; « reste en place » : si écart = quantité en reste en place (même dossier, plateforme, semaine) → Instruction OK automatique, à vérifier sur 2-3 dossiers (Q63) ; commentaire libre : l'afficher dans la liste « En cours », proposer la position si « début » ou « fin », la Coordination confirme.
- Type : règle
- Source : [PP] §4, §10
- Ambiguïté : non spécifié ; propositions à valider.

### EX-COO-024 — Export des trains du jeudi 14 h
- Énoncé : Déroulant › Liste des trains, bouton « Exporter les trains… » (Coordination) ; seules les faces en Instruction ok partent ; elles passent « Prêt à produire » (ex « A imprimer ») ; c'est le go des plateformes ; la Coordination vérifie la préparation des trains avant. Urgences du vendredi à la main ou renvoi. Jusqu'à 20 thèmes (couples thème/repiquage) par export (règle existante).
- Type : transition
- Source : [PC] p.1-2 ; [PP] §2, §12 ; [README] §3 ; relevé §7
- Ambiguïté : Q47 (« Valid PP » entre export et préparation des trains = vérification par la Coordination ?) ; règle des 20 tiroirs : ANO-13 (ne bloque rien aujourd'hui) ; cible = bloquer au-delà (README H6 pour Vendôme).

### EX-COO-025 — Libération de la semaine (fixe, pliage, bus)
- Énoncé : « Libération de la semaine » (ex « Colisage ») ; la ligne 2 m² fixe ou pliage d'une semaine non libérée est « à libérer » (et non « A traiter »). Fixe et pliage : lignes « à libérer » à l'intégration de la prépa.
- Type : règle
- Source : [PC] p.2 ; [README] §5, H2 ; [DESIGN] §11
- Ambiguïté : « Qui fait la libération ? » (question ouverte).

---

## D. Prépa, alertes, écarts

### EX-COO-026 — Envoi de la prépa
- Énoncé : le gestionnaire envoie la prépa depuis Broadcast, le lundi (thèmes, exceptions, commentaire) ; la Pré-Prod ne suit plus l'aval. Dossier : « À traiter » → « Préparation reçue ». La prépa n'est plus le feu vert pour la validation admin ; elle reste le feu vert de Broadcast et ne bloque plus le contrôle des affiches. Pas d'Instruction OK avant la prépa (abandonné).
- Type : transition
- Source : [PC] p.1 ; [PP] §1, §2
- Ambiguïté : aucune

### EX-COO-027 — Alerte « Préparation non reçue »
- Énoncé : deadline jeudi S-2 16 h ; Coordination relance la Pré-Prod. Gravité critique (« préparation absente après la deadline »).
- Type : traitement auto
- Source : [PC] p.2 ; [DESIGN] §2.2
- Ambiguïté : « jeudi S-2 16 h » : S-2 par rapport à quoi ? (semaine de départ)

### EX-COO-028 — Écart Broadcast / Circé
- Énoncé : quantité ou thème modifiés dans Broadcast après l'envoi, ou prépa différente de ce qui est reçu → alerte « Écart Broadcast / Circé » (Coordination) ; traitement : « Appliquer la version Broadcast » ou « Demander une correction à Broadcast » (mail à la Pré-Prod). À l'arrivée de la prépa : la ligne bascule en gardant son lien ; seul l'écart de thème ou de quantité lève l'alerte.
- Type : traitement auto
- Source : [PC] p.2 ; [PP] encadré 02/11 ; [RA] RG-AT-05
- Ambiguïté : Q55.

### EX-COO-029 — Alerte « Thème modifié dans Broadcast »
- Énoncé : après l'envoi ; atelier prévenu si la production est lancée (critique si lancée) ; reprise de la version Broadcast proposée (vérification des thèmes, PP-09).
- Type : traitement auto
- Source : [PC] p.2 ; [README] §2.1, §3
- Ambiguïté : aucune

### EX-COO-030 — Vérification des thèmes (Pré-production)
- Énoncé : thèmes proches entre dossiers dès la saisie des IP (règle de l'outil multi-rouleuse) : demande de correction à la Pré-Prod (mail), ou « visuels différents » ; annonceurs proches dès la DA activée : deux réponses (demander la correction à Broadcast ou « annonceurs différents »), thèmes comparés tant que non tranché ; thèmes modifiés après Instruction OK et validation admin : alerte, reprise de la version Broadcast.
- Type : fonctionnalité
- Source : [README] §2.1, §3 ; (PP-08, PP-09)
- Ambiguïté : RP30 #2 demande cet écran dans Broadcast (Q19, décision provisoire H11).

### EX-COO-031 — Alerte « Réception sur un dossier sans IP »
- Énoncé : la Coordination est alertée et prévient la Pré-Prod.
- Type : traitement auto
- Source : [PC] p.2 ; [DC] §11
- Ambiguïté : libellés multiples.

---

## E. Réceptions attendues (règles cibles)

### EX-COO-032 — RG-AT-01 : une ligne active par clé
- Énoncé : une seule ligne attendue active par plateforme × dossier × support × thème × bandeau × semaine ISO ; la DA et l'atelier sont hors clé : leurs quantités s'additionnent. (R1 de [PP] : clé dossier × DA × plateforme × support × semaine × visuel.) Index unique.
- Type : règle
- Source : [RA] §5 ; [DC] §12 ; [PP] §7 (R1)
- Ambiguïté : **[PP] R1 inclut la DA dans la clé ; [RA]/[DC] l'excluent.** Q57 (deux DA, une ou deux lignes ?), Q58 (même thème, deux ateliers) : propositions « une ligne » non tranchées.

### EX-COO-033 — RG-AT-02 : rapprochement par identifiants
- Énoncé : plateforme par `IdSiteCCF`, support par `IdSurface` × `IdFormat`, thème par `IdTheme` ; les textes servent à l'affichage seulement. Sans n° de thème (Q56) : thème écrit mis en forme (majuscules, espaces, accents) avec alerte.
- Type : règle
- Source : [RA] §5 ; [DC] §12
- Ambiguïté : Q56 (Broadcast peut-il fournir `IdTheme` ? définition de `IdThemeBandeau`).

### EX-COO-034 — RG-AT-03 : ligne « Broadcast »
- Énoncé : créée ou mise à jour à chaque lecture de l'état des réservations (fenêtre semaine en cours à +8), tant que la prépa n'est pas envoyée ; quantité = somme des lignes Broadcast de la clé hors « reste en place » (Q59).
- Type : traitement auto
- Source : [RA] §5
- Ambiguïté : Q59 (retirer « reste en place » : proposé oui).

### EX-COO-035 — RG-AT-04 : visuel provisoire avant les IP
- Énoncé : avant les IP, une ligne au visuel « provisoire » par plateforme × dossier × support × semaine. Aux IP, elle est fermée (pas supprimée) et les lignes de thème créées. Affiche rattachée déplacée seule s'il n'y a qu'un thème possible ou si le visuel du BL n'en désigne qu'un ; sinon la Coordination choisit ; aucun candidat : alerte. (R3, R5 de [PP].) Alerte « Réception sans IP » tant que les IP manquent.
- Type : règle
- Source : [RA] §5, cas 1-3 ; [PP] §7 (R3, R5)
- Ambiguïté : aucune

### EX-COO-036 — RG-AT-05 : arrivée de la prépa
- Énoncé : la ligne de même clé passe en source « PREPA », `qte_prepa` renseignée ; alerte « écart DA / prépa » si différente de `qte_bc` ; une ligne n'est créée que si la clé n'existe pas. Les liens ne bougent pas (R4).
- Type : traitement auto
- Source : [RA] §5 ; [PP] §7 (R4)
- Ambiguïté : aucune

### EX-COO-037 — RG-AT-06 : disparition / annulation
- Énoncé : une ligne Broadcast qui n'est plus vue passe « ANNULEE » après la lecture suivante (jamais supprimée) ; alerte à la Coordination si une affiche y est rattachée (ex. DA annulée après réception). R2 : une ligne n'est jamais supprimée, fermée avec date.
- Type : transition
- Source : [RA] §5, cas 14 ; [PP] §6, §7 (R2)
- Ambiguïté : aucune

### EX-COO-038 — RG-AT-07 : semaines ISO
- Énoncé : semaines ISO partout (programme d'échange et SQL), fenêtre S à S+8 calculée en dates, sans cas particulier de fin d'année.
- Type : règle
- Source : [RA] §5
- Ambiguïté : aucune

### EX-COO-039 — RG-AT-08 : lien affiche ↔ ligne avec quantité
- Énoncé : lien plusieurs-à-plusieurs avec quantité (une affiche couvre plusieurs lignes ; une ligne est couverte par plusieurs affiches) ; retiré et recréé avec qui/quand ; déplacé, jamais perdu quand une ligne se ferme. Tables `asso_affiche_visuel`, `tf_edr_rapprochement`.
- Type : règle
- Source : [RA] §4, §5 ; [PP] §7 ; [DC] §13
- Ambiguïté : reprise des rattachements actuels (sans quantité) non définie.

### EX-COO-040 — Suivi de prod (RG-SP-01)
- Énoncé : une ligne de production n'existe qu'avec la prépa ; quand elle arrive, l'affiche déjà validée y apparaît avec son n° d'affiche ; jointure par n° de thème.
- Type : règle
- Source : [RA] §5
- Ambiguïté : dépend de Q56.

### EX-COO-041 — Doublons : causes et traitement initial
- Énoncé : quatre causes (correctif sans thème ; bascule ratée au texte ; découpage par champ invisible ; plateforme retrouvée par nom). Avant l'index unique, dédoublonner : garder la ligne qui porte une affiche (ou la plus récente), reporter le rattachement, passer les autres en « ANNULEE ».
- Type : traitement auto
- Source : [RA] §2, §4
- Ambiguïté : causes hypothétiques « à confirmer avec les requêtes de la DSI ».

### EX-COO-042 — Procédure de fin d'année
- Énoncé : la branche de fin d'année de la procédure des attendues est invalide dans le dépôt (colonne écrite deux fois), échec probable à partir de la mi-novembre ; la DSI vérifie la version en production avant la mi-novembre.
- Type : non-fonctionnel
- Source : [DC] §12 ; [PP] §9 ; [RA] §2
- Ambiguïté : action hors lots, sur l'existant.

### EX-COO-043 — Données reçues de Broadcast
- Énoncé : (1) état des réservations (copie, S à S+8, par dossier × DA × destinataire × thème/bandeau × format × semaine, avant la prépa) ; (2) réceptions attendues « Broadcast » calculées ; (3) prépa fixe/pliage (lundi ; renvoi rejeté tant que non débloqué) ; (4) faces des trains (renvoi remplace, sauf Instruction OK faite) ; (5) instructions/exceptions/commentaire (dossier « En cours »). Interrogation à intervalles réguliers (8 h, 10 h … 18 h d'après l'équipe), pas d'événement « DA activée ».
- Type : traitement auto
- Source : [PP] §11 ; [DC] §12 ; relevé §12
- Ambiguïté : planification non dans le code ; fréquence à confirmer.

### EX-COO-044 — Jalons du process
- Énoncé : 1 DA activée (Broadcast → lignes attendues provisoires) ; 2 IP saisies (Pré-Prod → lignes par thème) ; 3 Réception physique (Circé crée affiche, n°, propose rattachement) ; 4 Envoi prépa (le lundi ; confirme les lignes ; Instruction OK) ; 5 Renvoi de Broadcast avant jeudi 14 h (« à prévoir avec Nariman » : rouvrir et recalculer) ; 6 Jeudi 14 h (export) ; 7 Après l'export (affiche arrivée = proposée puis confirmée ; urgences du vendredi).
- Type : règle
- Source : [PP] §2
- Ambiguïté : jalon 5 non défini (« à prévoir »).

### EX-COO-045 — Cas particuliers de rattachement
- Énoncé : même thème sur plusieurs dossiers (une ligne par dossier ; surplus proposé à l'autre dossier ; la Coordination confirme ; reçu compté une fois ; Q64) ; affiches en plus pour un autre dossier (rattachement manuel, avec historique, même après validation ou début de production ; seul le surplus ; autre plateforme : transfert puis réception) ; plusieurs thèmes et formats (le format trie les candidats, le doute porte sur le thème) ; dossier sur deux plateformes (une ligne par plateforme ; destinataires ne multiplient pas les lignes).
- Type : règle
- Source : [PP] §6 ; [RA] cas 21-25
- Ambiguïté : Q64 (Broadcast : même n° de thème ?).

### EX-COO-046 — Données V2 de coordination
- Énoncé : `tf_prepa_Broadcast` (+ IdSiteCCF, IdSurface, IdFormat, IdPreparationChapeau, IdTypePreparation, EstResteEnPlace, date_vue ; demande IdTheme) ; `tf_prepa_affiche` (+ source BC/PREPA, etat_ligne ACTIVE/ANNULEE, qte_bc, qte_prepa, date_vue_bc, IdThemeBandeau, rpc_num_aff_amt, index unique + second index pour lignes sans thème) ; `affiche` (+ validationAdmin_par/_le, mode_rattachement) ; `tr_visuel.provisoire` ; traitements réécrits (`p_Alimentation_tf_prepa_affiche`, `Fn_GetPrepaAffiche`, `GetPrepaAfficheAttached`, `p_s_adminSuiviRead`, intégration trains/instructions).
- Type : non-fonctionnel
- Source : [RA] §4 ; [PP] §7
- Ambiguïté : noms de colonnes « propositions ». Question « V2 : garder le mode de rattachement (BL, visuel, à la main) ».

### EX-COO-047 — Alertes de coordination (tableau)
- Énoncé : Validation admin à confirmer (doute, départ S/S+1) ; Réception inconnue à identifier (dès création ; Coordination + Réception) ; Dossier introuvable (après « Signaler ») ; Réception sur un dossier sans IP ; Préparation non reçue (deadline jeudi S-2 16 h) ; Écart Broadcast / Circé ; Thème modifié dans Broadcast. Toutes pour la Coordination, via Pilotage › Alertes.
- Type : traitement auto
- Source : [PC] p.2
- Ambiguïté : gravités détaillées non données pour toutes.

### EX-COO-048 — État des réservations vivant
- Énoncé : écran Pilotage : tous les dossiers dont la DA est activée, de la semaine en cours aux suivantes, une ligne par dossier et thème ; « Où en est-il » (DA activée, IP saisies, prépa reçue, affiches attendues/reçues en partie, validation admin à confirmer, prêt/en production, produit, expédié, livré) ; colonne « N° d'affiche » (✓ validée, • proposé à confirmer) dès la réception ; 5 indicateurs ; « Afficher par » dossier, DA, thème, destinataire, afficheur, unité, colis, départ, format ; le reçu reste au visuel (pas par destinataire, Q41).
- Type : fonctionnalité
- Source : [README] §3 ; [DC] §15
- Ambiguïté : détail écran dans screens/*.js (autre agent).

### EX-COO-049 — Instruction OK par atelier et plateforme
- Énoncé : dans Circé : par ligne (ex. 2 m² Wissous, 2 m² Nîmes) ; la maquette la fait par dossier.
- Type : règle
- Source : [PP] §10 (Q51)
- Ambiguïté : Q51 ouverte.

### EX-COO-050 — Liste des instructions (Déroulant)
- Énoncé : « Liste des instructions » = écran des préparations à valider limité au déroulant ; Déroulant garde les tableaux du menu Trains : Liste des instructions, Liste des trains, Suivi par thème, Préparation. Trains de pré-test ou d'entretien créés par la Coordination.
- Type : affichage
- Source : [README] §2.1, §3
- Ambiguïté : Q46 (changer l'ordre des trains : position d'un thème dans tous ses trains ou ordre des trains entre eux ?).

---

## Statuts et transitions (résumé)

| Objet | Statuts | Transitions / déclencheur |
|---|---|---|
| Affiche (validation admin) | Réception inconnue → À confirmer : proposé / À confirmer : doute → Validée | proposition à la réception ; confirmation Coordination ; Annuler la validation |
| Dossier – préparation | À traiter → Préparation reçue → (Annulé) | envoi prépa (lundi) |
| Dossier – validation admin | Aucune affiche reçue → À confirmer (n) → Validée | calculé |
| Instruction (déroulant) | À traiter → En cours → Instruction ok → Prêt à produire ; Annulé | prépa reçue ; règle Nariman ou Coordination ; export jeudi 14 h |
| Ligne attendue | source BC/PREPA ; état ACTIVE/ANNULEE ; Attendue/Partielle/Complète/Surplus | lecture Broadcast, prépa, disparition |
| Unité de production | En attente d'affiches → Prêt à produire → En production (point de non-retour) → Produit → Colisé·à expédier → Expédié → Livré ; « à libérer » (fixe/pliage) | voir [README] §5 |

## Glossaire
- **Coordination** : équipe qui travaille dans Circé (identifie, valide, exporte) ; Nîmes : « Pré-Prod Nîmes » (déduit). **Pré-Prod** : gestionnaires dans Broadcast. **Validation admin** : case sur l'affiche confirmant que l'affiche reçue est la bonne pour le dossier. **Instruction OK** : feu vert de composition des trains (déroulant). **Prépa** : préparation envoyée de Broadcast (lundi). **Règle de Nariman** : automatisme d'Instruction OK. **DA** : n° de DA. **IP** : instructions de pose (thèmes). **EDR / état des réservations** : table Broadcast copiée dans Circé. **Reste en place** : thème qui reste en place (non livré). **Libération de la semaine** : ex Colisage. **UM** : unité de manutention (non défini). **Scro / fixe / déroulant / pliage / bus** : ateliers/types de production. **Face** : ligne d'un train. **Visuel provisoire** : visuel avant IP.

## Contradictions internes
1. [PP] §1 « Qui fait quoi » et §2 note finale (non barrés) : Circé fait la validation admin « quand il n'y a pas de doute » / « affiches déjà reçues sont validées dès l'arrivée de la prépa » vs option A (Circé propose, rien sans une personne ; la prépa n'intervient plus).
2. Clé de ligne attendue : [PP] R1 (inclut la DA) vs [RA] RG-AT-01 / [DC] (DA hors clé).
3. Libellés d'états de validation : « Validée / Proposée par Circé / À vérifier / Réception inconnue » ([DC]) ; « Orpheline » ([DC] tableau statuts) ; « À confirmer : proposé / doute » ([PC], [README]).
4. Statut dossier : « Validation admin faite » ([DESIGN], [DC]) vs « Validée » ([PC], [README]).
5. Alerte : « Validation admin à faire » ([DC], [PP], [README]) vs « à confirmer » ([PC]).
6. [PP] §3 « indépendants » vs constat 02/11 (dépendance indirecte au scro) : nuance reconnue par le doc.
7. [PP] §10 : « La maquette la refait quand la prépa est renvoyée » vs reco (a) jeudi 14 h.
8. « À traiter » : statut du dossier et statut d'instruction ; README/DESIGN voulaient un seul sens.
9. [PP] §3 et [DC] « UM du fixe et du pliage » : corrigé le 02/11, mais encore présent barré.
10. Q48 « réglée » : validation par la Coordination « avec validation automatique » (barré) vs option A.

## Sections non comprises ou incomplètes
- Jalon « renvoi Broadcast avant jeudi 14 h » : à prévoir avec Nariman.
- Fixe et pliage : libération de la semaine : qui ?
- Détails écran « Validation admin et Instruction OK », « État des réservations vivant » : dans screens/*.js (autre agent).
- Reprise des rattachements existants (sans quantité) et migration (dédoublonnage) à cadrer.
- Questions ouvertes : Q46, Q47, Q50, Q51, Q55, Q56, Q57, Q58, Q59, Q60, Q61, Q62, Q63, Q64 ; V2 : mode de rattachement.
- `requetes_doublons_receptions_attendues.sql` non lu (absent du dossier fourni).
