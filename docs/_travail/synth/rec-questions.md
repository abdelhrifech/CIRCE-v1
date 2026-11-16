| Q-100 | REC | Fusion des affiches non reprise dans la cible | legacy RG-REC-060 à 064 (fusion, droit `fusion_affiche`, champs `est_fusionne`, `fusion_affiche`) · `[README] §3, §7` (« Zone picking et Fusion non repris ; fusion inopérante ANO-15 ») | Option 1 : écran supprimé, données héritées en lecture seule. Option 2 : reprendre la fonction. HYPOTHÈSE retenue : option 1 (règles marquées SUPPRIMÉE RG-REC-163 à 167, 169) ; migration des fusions existantes à décider (Q-155). | NON | HYPOTHÈSE PRISE | | |
| Q-101 | REC | Zone picking et Édition picking | legacy RG-REC-029, 101 · `[README] §7` (Zone picking non repris) · EX-TRA-025 (liste de picking citée parmi les éditions existantes) | Garder la donnée `zone_Picking` et l'Édition picking, ou les abandonner. HYPOTHÈSE : écran Zone picking abandonné, Édition picking CONSERVÉE (RG-REC-093) tant que non tranché. | NON | HYPOTHÈSE PRISE | | |
| Q-102 | REC | Grain du contrôle et de la réception : BL, palette | `[DC] §10, §13` (EX-REC-011, 080 : « grain à trancher : contrôle par BL ou par palette ») | HYPOTHÈSE : une réception = un BL = une unité de contrôle ; une palette avec deux BL = deux réceptions. | NON | HYPOTHÈSE PRISE | | |
| Q-103 | REC | Quantité de référence : `affiche.quantite` dénormalisée ou somme des mouvements | legacy RG-REC-023 · `[DC] §9` (stock = somme des mouvements) | HYPOTHÈSE : stock = Σ mouvements, reçu = Σ rattachements actifs ; colonne `quantite` supprimée ou recalculée. | NON | HYPOTHÈSE PRISE | | |
| Q-104 | REC | « Affiche reçue » à l'arrivée ou après le contrôle (Q31 des sources) | `[DC] §9, §17` (question clé ouverte) · maquette (à l'arrivée) | HYPOTHÈSE : à l'arrivée de la palette, corrigée ensuite par le contrôle. | NON | HYPOTHÈSE PRISE | | |
| Q-105 | REC | Valeurs par défaut et portée des paramètres Réception (Q30, Q32, Q33 des sources) | `[DC] §11` (10 %, 4 sem., 24 h, 30, 2, X) · ECR-ADM-05 | HYPOTHÈSE : valeurs par défaut citées, paramètres globaux sauf l'allée tampon (par site). | NON | HYPOTHÈSE PRISE | | |
| Q-106 | REC | Représentation de la zone tampon (allée X par site, palettes connues) | `[DC] §7, §9, §11` (« allée X à fixer par site ») · maquette (`Z-tampon`) | HYPOTHÈSE : allée/rayon vides + indicateur zone tampon pour les palettes connues ; allée paramétrée par site pour les inconnues. | NON | HYPOTHÈSE PRISE | | |
| Q-107 | REC | Qui peut rattacher une réception inconnue | `[DC] §7` / `[README] §3` · Q-REC-18 maquette | HYPOTHÈSE : coord et recep peuvent rattacher ; seul coord/admin vaut validation. | NON | HYPOTHÈSE PRISE | | |
| Q-108 | REC | État de la réception quand le dernier dossier est retiré (déjà contrôlée) | `[DC] §9` / `§10` (contradiction) · EX-REC-053 | HYPOTHÈSE : A_IDENTIFIER dans tous les cas (maquette). | NON | HYPOTHÈSE PRISE | | |
| Q-109 | REC | Statut « Introuvable » : transition vers « Rattachée » et persistance | EX-REC-055 (« à confirmer ») · Q36, Q37 sources | HYPOTHÈSE : horodatage `signale_le` ; Introuvable → Rattachée autorisé ; pas de retour. | NON | HYPOTHÈSE PRISE | | |
| Q-110 | REC | Destinataire des alertes d'inconnue/introuvable : Coordination ou Pré-Prod (Q61) | `[PR]` (Pré-Prod) / `[DC]` (Coordination) ; Nîmes « Pré-Prod Nîmes » | HYPOTHÈSE : rôle Coordination du site ; Wissous : équipe Coord. Réception de Boulogne. | NON | HYPOTHÈSE PRISE | | |
| Q-111 | REC | Alerte « sans instructions de pose » : libellé et canal (bandeau et mail ?) | `[DC] §11` / principe « pas de mail » | HYPOTHÈSE : bandeau ; mail seulement si canal configuré. | NON | HYPOTHÈSE PRISE | | |
| Q-112 | REC | Lecture du BL et reconnaissance visuelle : technologie, périmètre (REC-17 après le 31/12) | `[DC] §4` · EX-REC-004, 007 | HYPOTHÈSE : V1 sans lecture automatique ; interface `LlmProvider` prévue. | NON | HYPOTHÈSE PRISE | | |
| Q-113 | REC | Stockage, types et taille des photos | legacy `photo.image_file` varbinary · `bdd.md §10` (Q-h) | Valeurs de type/taille à fixer ; stockage objet ou base. HYPOTHÈSE : métadonnées en base, fichier hors base. | NON | HYPOTHÈSE PRISE | | |
| Q-114 | REC | Unicité du n° de BL | legacy (aucun contrôle) · `bdd.md §10` | HYPOTHÈSE : avertissement confirmable. | NON | HYPOTHÈSE PRISE | | |
| Q-115 | REC | Création à la volée d'un imprimeur ou transporteur inconnu | EX-REC-074 | HYPOTHÈSE : listes fermées. | NON | HYPOTHÈSE PRISE | | |
| Q-116 | REC | « Déchargé par » obligatoire ? | Q-REC-2 maquette | HYPOTHÈSE : facultatif. | NON | HYPOTHÈSE PRISE | | |
| Q-117 | REC | Ajout/sortie manuels de stock, stock négatif | legacy RG-REC-021, 022 · EX-REC-057 | HYPOTHÈSE : conservés (module Stocks), quantité > 0, sortie ≤ disponible. | NON | HYPOTHÈSE PRISE | | |
| Q-118 | REC | Rebus legacy (drapeau) vs rebut cible (mouvement), tag « Au rebut », vidage | legacy RG-REC-040, 041 · `[DC] §5, §10` | HYPOTHÈSE : drapeau remplacé par mouvements ; migration des rebus en mouvement. | NON | HYPOTHÈSE PRISE | | |
| Q-119 | REC | Etat de destruction legacy : précédence SQL, 356/365 jours | legacy RG-REC-050, 051 · EX-STK-504 | À arbitrer avec le module Stocks. | NON | OUVERTE | | |
| Q-120 | REC | Unité de `conservation` (jours/semaines), défauts 20/365, alerte « dernier départ dépassé » | legacy RG-REC-010, 031 | HYPOTHÈSE : règles conservées, unité à confirmer. | NON | HYPOTHÈSE PRISE | | |
| Q-121 | REC | Modification d'une réception validée (en-tête, quantités) | legacy RG-REC-079 · Q-REC-11, 23 maquette | HYPOTHÈSE : pas de modification de l'en-tête ; corrections par mouvements. | NON | HYPOTHÈSE PRISE | | |
| Q-122 | REC | Suppression/annulation d'une réception | legacy (aucune) · EX-REC-081 | HYPOTHÈSE : aucune suppression. | NON | HYPOTHÈSE PRISE | | |
| Q-123 | DATA | Quantité par défaut à la reprise des rattachements existants (sans quantité) | `[DC] §13` | À définir à l'étape 3/8. | NON | OUVERTE | | |
| Q-124 | REC | Répartition inférieure à la quantité reçue | EX-REC-039 | HYPOTHÈSE : autorisée (le surplus reste en stock). | NON | HYPOTHÈSE PRISE | | |
| Q-125 | REC | Seuils et algorithme de proposition de visuels/candidats | Q-REC-15, 25 maquette (valeurs fabriquées) | À fixer si reconnaissance implémentée. | NON | OUVERTE | | |
| Q-126 | REC | Stockage du type de feuille et du tag « Feuille à refaire » | `[DC] §6, §13` | HYPOTHÈSE : colonnes sur l'affiche. | NON | HYPOTHÈSE PRISE | | |
| Q-127 | REC | Définition de « multi-semaines » et fond jaune (Q18) | `[DC] §6` | HYPOTHÈSE : ≥ 2 semaines distinctes. | NON | HYPOTHÈSE PRISE | | |
| Q-128 | REC | Exemplaires : 2 ou 3, destinataire (Q32) | `[PR]` / `[DC]` / `[README]` | HYPOTHÈSE : 2 par défaut. | NON | HYPOTHÈSE PRISE | | |
| Q-129 | REC | Imprimantes par plateforme et impression directe vs PDF | legacy RG-ADM-041 · Q-002 | Lié à Q-002. | NON | OUVERTE | | |
| Q-130 | REC | Purge : point de départ des 4 semaines, « conservation à l'année », lignes Broadcast | EX-REC-075, 512 | À fixer. | NON | OUVERTE | | |
| Q-131 | REC | Résumé à 7 h, rajouts après préparation, IP tardives : forme et canal | EX-REC-063, 505 | À fixer avec la liste de distribution. | NON | OUVERTE | | |
| Q-132 | REC | Gravité « grave » vs Critique/Important | EX-TRA-028 | HYPOTHÈSE : grave = Important. | NON | HYPOTHÈSE PRISE | | |
| Q-133 | REC | Base de l'écart de 10 % (avec ou sans entretien) et dashboard | EX-REC-516 à 519 vs EX-REC-064 | À trancher. | NON | OUVERTE | | |
| Q-134 | REC | Date prévisionnelle de livraison : source, saisie | EX-REC-008, 520 | À trancher. | NON | OUVERTE | | |
| Q-135 | REC | Définition des thèmes exclus (« ne pas afficher », « reste en place ») | EX-REC-009 | HYPOTHÈSE : champ `exclu` de Broadcast. | NON | HYPOTHÈSE PRISE | | |
| Q-136 | REC | Matrice profils × actions Réception | Q-003, EX-REC-076, maquette `roles` | HYPOTHÈSE : écran primaire = écriture, secondaire = lecture. | NON | HYPOTHÈSE PRISE | | |
| Q-137 | REC | Sites DBG et DBG Lyon | EX-TRA-006 | À trancher. | NON | OUVERTE | | |
| Q-139 | REC | Suffixe « -W » : qui le pose, quel champ | EX-REC-015 | HYPOTHÈSE : posé par l'alimentation (Coordination). | NON | HYPOTHÈSE PRISE | | |
| Q-140 | REC | Comptage par morceau : mécanique | Q-REC-8 maquette | HYPOTHÈSE : libellé sans calcul. | NON | HYPOTHÈSE PRISE | | |
| Q-141 | REC | Surplus en entretien « CG » : définition | EX-REC-025, FIX-506 | À définir. | NON | OUVERTE | | |
| Q-142 | REC | Non-conformité : liste, motif de rebut, Process Métier | EX-REC-024, 028 | À cadrer. | NON | OUVERTE | | |
| Q-143 | REC | « Feuille à refaire » après modification d'annonceur/thème saisis | Q-REC-21 maquette | HYPOTHÈSE : comme la maquette (non posé). | NON | HYPOTHÈSE PRISE | | |
| Q-145 | REC | Contrôleur lié à l'utilisateur connecté | Q-REC-9 maquette | À trancher. | NON | OUVERTE | | |
| Q-146 | REC | Droits des référents 8 m² / MUI (Wissous) | EX-REC-077 | À définir. | NON | OUVERTE | | |
| Q-147 | REC | Famille de formats 2 m² : applicabilité | legacy RG-REC-075, 090 | HYPOTHÈSE : conservée. | NON | HYPOTHÈSE PRISE | | |
| Q-148 | REC | Remplacement de l'auto-association à l'ouverture | legacy RG-REC-093 | HYPOTHÈSE : supprimée. | NON | HYPOTHÈSE PRISE | | |
| Q-150 | REC | Champs texte dossiers/semaines de la fiche et `tf_dossier_semaine_depart` | legacy RG-REC-025, 026 | HYPOTHÈSE : remplacés par rattachements. | NON | HYPOTHÈSE PRISE | | |
| Q-151 | INT | Batch d'export PEX : filtre `envoye`, `IdSiteCCF` en dur, dédoublonnage | legacy RG-REC-110 · EX-TRA-039 | À trancher. | NON | OUVERTE | | |
| Q-154 | REC | Format/domaine d'allée et rayon | Maquette (placeholders) | HYPOTHÈSE : texte libre. | NON | HYPOTHÈSE PRISE | | |
| Q-155 | DATA | Reprise des données héritées : fusions, rebus, zone picking, `envoye` | legacy | À définir. | NON | OUVERTE | | |
| Q-157 | REC | Délai de contrôle : heures calendaires ou ouvrées (Q33) | EX-REC-019 | HYPOTHÈSE : calendaires. | NON | HYPOTHÈSE PRISE | | |
| Q-160 | REC | Autres pièces jointes de livraison | Q-REC-23 | À trancher. | NON | OUVERTE | | |
| Q-162 | REC | Étiquettes rack en rafale (Q62) | EX-COO-014 | À trancher. | NON | OUVERTE | | |
| Q-163 | REC | Transporteur par défaut | MOCK | À trancher. | NON | OUVERTE | | |
| Q-165 | REC | Recherche à la frappe vs Entrée | `[DESIGN]` vs REC-10 | HYPOTHÈSE : frappe. | NON | HYPOTHÈSE PRISE | | |
| Q-166 | REC | Ligne du BL à quantité 0 : message | Q-REC-5 | HYPOTHÈSE : ignorée avec mention. | NON | HYPOTHÈSE PRISE | | |
| Q-167 | REC | Ligne cochée absente du BL : bloquant ? | EX-REC-006 | HYPOTHÈSE : non bloquant. | NON | HYPOTHÈSE PRISE | | |
| Q-168 | REC | Format des n° de réception et d'affiche | MOCK | HYPOTHÈSE : identifiants entiers ; code-barres A- + 13 chiffres. | NON | HYPOTHÈSE PRISE | | |
