### RG-REC-101 — Tableau « Réceptions inconnues »
- Origine : NOUVELLE
- Énoncé : un seul tableau (un statut par ligne) : N° affiche, Lu sur l'affiche (annonceur · description), Site, Qté, Reçue le, En attente depuis, Statut, Dossier(s), Emplacement ; masquées : Format, Imprimeur, Feuille de stock ; action « Fiche ». Sous le tableau : photo, annonceur lu, description, quantité, format, imprimeur, emplacement. Badge rouge du menu = nb d'affiches orphelines.
- Déclencheur : ouverture de l'écran.
- Conditions : périmètre du site.
- Effet / message d'erreur : vide : « Aucune réception inconnue avec ce statut. ».
- Sources : spec `[DC] §7, §17` (EX-REC-037) · écran ECR-REC-04
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-102 — Statuts et filtre par défaut des réceptions inconnues
- Origine : NOUVELLE
- Énoncé : cinq statuts (RECEPTION_INCONNUE.*, section 3) ; filtre Statut par défaut : À identifier + Introuvable + Rattachée à contrôler + Contrôlée feuille définitive à imprimer ; « Rattachée, feuille définitive » masqué par défaut.
- Déclencheur : ouverture.
- Conditions : —
- Effet / message d'erreur : voir §3.
- Sources : spec `[DC] §9` (EX-REC-055) · écran ECR-REC-04
- Questions liées : Q-109
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-103 — « En attente depuis » d'une réception inconnue
- Origine : NOUVELLE
- Énoncé : durée depuis la création ; rouge/Important au-delà de 24 h (`delaiControle`) ; « — » si rattachée ; ligne « À identifier » > 24 h teintée en important ; alerte importante après 24 h (RG-REC-185).
- Déclencheur : affichage.
- Conditions : durée > 24 h.
- Effet / message d'erreur : teinte.
- Sources : spec `[DC] §7, §11` ; Q-REC-17 maquette · écran ECR-REC-04
- Questions liées : Q-105
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-104 — Identifier par le visuel
- Origine : NOUVELLE
- Énoncé : « Voir les visuels proposés (n) » : candidats (4 max dans la maquette) avec score ; dossier pré-coché si reconnu à coup sûr ; plusieurs dossiers cochables. Reconnaissance simulée ; critère « à coup sûr » non défini.
- Déclencheur : voie « Par le visuel ».
- Conditions : candidat(s) disponible(s).
- Effet / message d'erreur : sinon « Aucun visuel proche : cherchez par n° de dossier. ».
- Sources : spec `[DC] §7` (EX-REC-038) ; ateliers EX-REC-507 · écran ECR-REC-04
- Questions liées : Q-112, Q-125
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-105 — Identifier par n° de dossier
- Origine : NOUVELLE
- Énoncé : recherche à la frappe par n° de dossier, DA, annonceur, thème (min. 2 caractères, 8 résultats max dans la maquette) ; voie proposée d'office si pas de visuel (photo absente, IP non saisies, aucun visuel proche).
- Déclencheur : saisie.
- Conditions : ≥ 2 caractères.
- Effet / message d'erreur : « Tapez un n° de dossier, de DA, un annonceur ou un thème. » / « Aucun dossier pour « q » sur ce site. ».
- Sources : spec `[DC] §7` (EX-REC-038) · écran ECR-REC-04
- Questions liées : Q-125
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-106 — Pré-coche du dossier reconnu à coup sûr
- Origine : NOUVELLE
- Énoncé : le dossier est pré-coché seulement si le visuel est reconnu à coup sûr ; sinon l'utilisateur coche. Qté par candidat : nombre ≥ 1, défaut min(quantité reçue, attendu). Seuils (0,9/0,6) fictifs.
- Déclencheur : affichage des candidats.
- Conditions : score ≥ seuil (à fixer).
- Effet / message d'erreur : « Visuel reconnu (xx %) — Rattachement proposé directement : il reste à confirmer. ».
- Sources : spec `[DC] §7` · écran ECR-REC-04
- Questions liées : Q-125
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-107 — « Rattacher » : refus
- Origine : NOUVELLE
- Énoncé : « Rattacher » ne s'applique qu'à une affiche ORPHELINE (réception A_IDENTIFIER ou introuvable) ; il exige ≥ 1 dossier ET une quantité > 0.
- Déclencheur : clic « Rattacher ».
- Conditions : aucun dossier ou quantité 0 ; affiche non orpheline → 409.
- Effet / message d'erreur : 422 `REC_RATTACHER_SANS_DOSSIER` « Choisissez au moins un dossier et une quantité. ».
- Sources : spec `[DC] §7` (EX-REC-039) · écran ECR-REC-04
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-108 — Répartition ≤ quantité reçue
- Origine : NOUVELLE
- Énoncé : la somme des quantités réparties ne dépasse pas la quantité reçue ; une répartition inférieure est permise (le surplus reste en stock, doc coordination).
- Déclencheur : « Rattacher ».
- Conditions : total > quantité reçue.
- Effet / message d'erreur : 422 `REC_REPARTITION_DEPASSE` « La répartition (x) dépasse la quantité reçue (y). ». Répartition < reçue : HYPOTHÈSE Q-124 autorisée.
- Sources : spec `[DC] §7` (EX-REC-039) ; `[PP] §6`
- Questions liées : Q-124
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-109 — Effets de « Rattacher »
- Origine : NOUVELLE
- Énoncé : l'affiche passe IDENTIFIEE ; la réception passe A_CONTROLER (`a_controler_depuis` = maintenant) et entre dans le sas ; rattachement avec `mode_rattachement` MAIN ; tag « Feuille à refaire » (feuille définitive à imprimer) ; alerte « Feuille de stock définitive à imprimer » à la réception de la plateforme (RG-REC-187) ; recalcul des unités (RG-X-003). Boutons selon l'état : RG-REC-119.
- Déclencheur : « Rattacher ».
- Conditions : RG-REC-107/108.
- Effet / message d'erreur : « Affiche n° rattachée. n unité(s) passent « Prêt ». La palette R… passe dans le sas… ».
- Sources : spec `[DC] §7` (EX-REC-040) · écran ECR-REC-04
- Questions liées : Q-107
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-110 — Annonceur et libellé après rattachement
- Origine : NOUVELLE
- Énoncé : l'annonceur saisi est remplacé par celui du dossier ; le libellé saisi n'est remplacé que si les IP sont saisies (sinon règle du 1er qui a parlé, RG-REC-048). Répartition possible sur 1..n thèmes (plusieurs semaines).
- Déclencheur : « Rattacher ».
- Conditions : —
- Effet / message d'erreur : champs mis à jour + historique.
- Sources : spec `[DC] §7` · écran ECR-REC-04 (règles de Rattacher)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-111 — Validation admin au rattachement selon le rôle
- Origine : NOUVELLE
- Énoncé : rattachement par `coord` = validation admin faite ; par un autre rôle : reste « à confirmer » (`rattache = MAIN`, motif « rattachée sans le n° du BL »). Tant que non rattachée : « Réception inconnue : à rattacher d'abord ».
- Déclencheur : « Rattacher », changement de thème, rattachement manuel.
- Conditions : rôle.
- Effet / message d'erreur : RG-X-007.
- Sources : spec `[DC] §7` ; EX-COO-010, 017 · écran ECR-REC-04/05
- Questions liées : Q-107
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-112 — Signaler « Dossier introuvable »
- Origine : NOUVELLE
- Énoncé : « Personne ne retrouve le dossier ? » → « Signaler à la Coordination (alerte) », sans mail ; statut RECEPTION_INCONNUE.INTROUVABLE (date) ; alerte « Dossier introuvable » (RG-REC-186). Destinataire : Coordination du site (Wissous : équipe Coord. Réception de Boulogne). Périmètre de « introuvable » : Q36 source.
- Déclencheur : clic.
- Conditions : statut À identifier.
- Effet / message d'erreur : « Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… ».
- Sources : spec `[DC] §3, §7, §11` (EX-REC-041) · écran ECR-REC-04
- Questions liées : Q-109, Q-110
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-113 — Deux cas à ne pas confondre
- Origine : NOUVELLE
- Énoncé : (a) DA activée, IP non saisies : PAS une réception inconnue (alerte « sans IP » à la Coordination) ; (b) affiche introuvable alors que le dossier est dans Broadcast : réception inconnue, reconnue par la photo.
- Déclencheur : création.
- Conditions : —
- Effet / message d'erreur : voir RG-REC-047, 095.
- Sources : spec `[DC] §7, §10` (EX-REC-042)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-114 — Retrait du dernier dossier
- Origine : NOUVELLE
- Énoncé : retirer le dernier dossier renvoie l'affiche dans les réceptions inconnues (ORPHELINE) ; la réception redevient A_IDENTIFIER. Affiche sans lien actif = orpheline. État si déjà contrôlée : contradiction [DC] §9/§10.
- Déclencheur : « Retirer ».
- Conditions : plus aucun rattachement actif.
- Effet / message d'erreur : HYPOTHÈSE Q-108 : A_IDENTIFIER dans tous les cas.
- Sources : spec `[DC] §8, §9, §10` (EX-REC-043) · écran ECR-REC-05
- Questions liées : Q-108
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-115 — Définition d'une affiche orpheline
- Origine : MODIFIÉE
- Énoncé : affiche orpheline = aucun rattachement actif. Legacy : deux définitions contradictoires (aucune `tf_prepa_affiche` liée ; ou `date_creation` ∈ période ET aucune prépa) et prépas `FromBroadcast` comptées comme association dans la SP mais exclues dans `GetPrepaAfficheByAfficheId`.
- Déclencheur : tout calcul.
- Conditions : —
- Effet / message d'erreur : une définition unique.
- Sources : legacy `SP/p_GetListeAffiche.sql:62-65`, `REPO/ReceptionListeAfficheRepository.cs:456-469, 283` (RG-REC-008)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-116 — Création manuelle d'une affiche (mode Création) legacy
- Origine : MODIFIÉE
- Énoncé : voie probablement morte (aucun bouton Créer ; contrôleur lit `GetAfficheById(0)`) : affiche + mouvement initial de quantité 0 alors que `affiche.quantite = quantiteSaisie`. Remplacée par « Réception inconnue ».
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:756-798`, `CTRL/ReceptionListeAfficheController.cs:119-128, 177` (RG-REC-020) · spec EX-REC-079
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-117 — Livraison « orpheline » legacy : affiches persistées avant contrôle
- Origine : MODIFIÉE
- Énoncé : le legacy persiste les affiches (`CreateAfficheOrpheline`) avant les contrôles dossier/semaines et écrit un historique même en cas d'erreur. Corrigé par RG-REC-046.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : rien de résiduel.
- Sources : legacy `BLL/LivraisonAfficheService.cs:532-624` (RG-REC-078)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-118 — Qui peut rattacher une réception inconnue
- Origine : NOUVELLE
- Énoncé : `coord` rattache (vaut validation) ; l'agent de réception peut rattacher (« rattachée par la réception : reste à vérifier ») ; ambiguïté README « Coordination, réception ».
- Déclencheur : « Rattacher ».
- Conditions : rôle ∈ {coord, recep}.
- Effet / message d'erreur : autres : 403.
- Sources : spec `[DC] §7` (EX-REC-040) ; `[README] §3`
- Questions liées : Q-107
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-119 — Boutons selon l'état de la réception inconnue
- Origine : NOUVELLE
- Énoncé : À identifier/Signalée : Rattacher, Fiche, Signaler ; Rattachée à contrôler : « Modifier le rattachement ou le thème », « Valider et imprimer dans Réception des affiches » ; Contrôlée feuille définitive à imprimer : « Imprimer dans Réception des affiches » ; Rattachée feuille définitive : « Ouvrir la fiche », « Réimprimer la feuille définitive ».
- Déclencheur : affichage.
- Conditions : statut.
- Effet / message d'erreur : action non listée absente.
- Sources : spec `[DC] §7` ; `[PR]` · écran ECR-REC-04
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-120 — Rattachement par la réception : reste à vérifier
- Origine : NOUVELLE
- Énoncé : un rattachement posé par la réception (non coord) garde la validation admin « à confirmer » (motif doute) jusqu'à confirmation par la Coordination.
- Déclencheur : rattachement par recep.
- Conditions : rôle ≠ coord/admin.
- Effet / message d'erreur : RG-X-007.
- Sources : spec `[DC] §7` · maquette `rattache = MAIN`
- Questions liées : Q-107
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-121 — Liste des affiches : colonnes
- Origine : MODIFIÉE
- Énoncé : colonnes : N° affiche, Reçue le, Visuel, Dossier(s) (tag « N dossiers »), Départ (tag « multi-semaines »), En stock, Emplacement, Statut et tags ; masquées : Réception (cliquable), Site, Annonceur, Thème, Format, Imprimeur (REC-07), Reçu, Rebut, Contrôleur, Feuille de stock. Tri initial date décroissante. Lecture + impression (pas de création). Imprimeur visible ; n° de réception cliquable (onglet Mouvements). Legacy : colonnes dont « Orpheline » oui/non, « Zone » (Picking/Réceptionnée), dernière sortie.
- Déclencheur : ouverture.
- Conditions : —
- Effet / message d'erreur : vide « Aucune ligne pour ces filtres. ».
- Sources : spec `[DC] §8` (EX-REC-045) ; ateliers EX-REC-509 · écran ECR-REC-03
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-122 — Liste des affiches : filtres
- Origine : MODIFIÉE
- Énoncé : N° de dossier ; Départ (une affiche sans semaine reste visible) ; Tag (À contrôler, Orpheline, Complément, Feuille à refaire) ; Format ; Imprimeur (+ Filtre). Actions groupées : « Réimprimer les feuilles à refaire (n) », « Imprimer les feuilles de stock », « Étiquettes rack », « Ranger avant d'imprimer ».
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir RG-REC-087, 090.
- Sources : spec `[DC] §8` (EX-REC-045) · écran ECR-REC-03
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-123 — Période par défaut et « Historique » (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : période 1 mois glissant ; « Historique » décoché réinitialise les dates mais les SP filtrent toujours `date_entree BETWEEN` et n'utilisent pas `@historique`. Remplacé par le filtre Départ.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:73-76, 104-109`, `SP/p_GetListeAffiche.sql:112-122` (RG-REC-002)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-124 — Listes legacy Tous / À traiter / Rebus / Fusionnées
- Origine : MODIFIÉE
- Énoncé : legacy : 4 listes (« Tous » hors fusionnées ; « À traiter » = (non validée OU orpheline) hors rebus et fusionnées ; « Rebus » ; « Fusionnées » avec seule action Modifier) tri `affiche_id` décroissant, quantité = Σ mouvements. Cible : une liste filtrée par tags/statuts ; stat. et colonne Zone non reprises.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : remplacement par RG-REC-121/122.
- Sources : legacy `SP/p_GetListeAffiche*.sql`, `BLL/ReceptionListeAfficheBll.cs:53-54, 116-121` (RG-REC-003 à 009, 011, 013) · Q-100
- Questions liées : Q-100, Q-118
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-125 — Plus de doublons dans la Liste des affiches
- Origine : NOUVELLE
- Énoncé : une affiche = une seule ligne dans la Liste des affiches quel que soit le nombre de dossiers/rattachements/réceptions (ANO-01).
- Déclencheur : lecture.
- Conditions : —
- Effet / message d'erreur : agrégation (dossiers en tag).
- Sources : ateliers EX-REC-501 ; spec EX-REC-081
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
