### RG-X-050 — Annulation d'une validation admin : conséquences côté Réception
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : quand la Coordination annule la validation d'une affiche (RG-COO-014), dans la même transaction : l'affiche repasse « À confirmer : doute » (motif ANNULEE) ; elle redevient « à traiter » dans la liste des affiches de la Réception ; le n° d'affiche n'apparaît plus dans le suivi de production (✓ → •) ; l'étiquette rack déjà imprimée et le picking ne sont pas détruits (aucun effet sur le stock ni sur la palette) ; l'indicateur « reçue et associée » vers Broadcast repasse à faux au prochain passage (RG-COO-024) ; une alerte « Validation admin à confirmer » est levée selon le départ (RG-COO-033). Le stock, les mouvements et le statut de la palette (À contrôler / Contrôlée) ne sont jamais modifiés par une annulation.
- Déclencheur : action « Annuler la validation » (Coordination).
- Conditions : affiche `VALIDEE` ; rôle `coord`/`admin`.
- Effet / message d'erreur : 409 si l'affiche n'est pas validée ; test de rejet : après annulation, aucun mouvement de stock créé et statut de palette inchangé.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` ; `BLL/SuiviEtatReservationBll.cs:172-201` · spec [PP] §5 ; [DC] encadré 02/11 (EX-COO-009, EX-COO-014) ; écran ECR-COO-02
- Questions liées : Q-202
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-051 — Rattachement d'une réception inconnue par la Coordination : validation et entrée de la palette dans le sas
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : « Rattacher » (réception inconnue) par un utilisateur `coord`/`admin` écrit dans une seule transaction : les liens affiche ↔ lignes (avec quantités), la validation admin (validée/par/le, mode MAIN, RG-COO-017), le statut d'affiche « Identifiée », le statut de la réception « À contrôler » (la palette entre dans le sas de contrôle), l'annonceur de l'affiche remplacé par celui du dossier (libellé remplacé seulement si les IP sont saisies : « le 1er qui a parlé » sinon), la feuille de stock « définitive à imprimer » (alerte à la Réception de la plateforme) et la levée de l'alerte « Réception inconnue à identifier ». Rattaché par un autre rôle (ex. agent de réception) : mêmes écritures sauf la validation (reste « À confirmer : doute », motif BL, RG-COO-018).
- Déclencheur : action « Rattacher » (ECR-REC-04).
- Conditions : au moins un dossier et une quantité > 0 ; Σ quantités ≤ quantité reçue ; affiche « Orpheline » ou « Introuvable » ; `Idempotency-Key`.
- Effet / message d'erreur : 422 « Choisissez au moins un dossier et une quantité. » ; 422 « La répartition (n) dépasse la quantité reçue (m). » ; 409 si l'affiche est déjà rattachée.
- Sources : spec [PP] §6 ; [DC] §7 ; [README] §3, H1 (EX-COO-010, EX-COO-017) ; EX-REC-039, EX-REC-040 ; écran ECR-REC-04 (« Règles de Rattacher »)
- Questions liées : Q-201
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-052 — Rattachement manuel du surplus à un autre dossier (même après validation ou début de production)
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : la Coordination peut rattacher à la main le surplus d'une affiche à un autre dossier (« + Rattacher à un autre dossier », sans limite de nombre de dossiers, ANO-12) même si l'affiche est validée ou que la production a commencé ; seul le surplus est rattaché ; le nouveau lien porte la quantité du surplus, est historisé (qui/quand) et, si l'acteur est `coord`/`admin`, vaut validation de ce lien ; les validations déjà faites sur les autres liens ne sont pas retirées (HYPOTHÈSE Q-202) ; changement de thème d'un lien : tag « Feuille à refaire » côté Réception ; autre plateforme : transfert puis réception.
- Déclencheur : action « + Rattacher à un autre dossier » / « Changer de thème… » (fiche affiche).
- Conditions : Σ quantités des liens actifs ≤ quantité reçue ; ligne cible `ACTIVE`.
- Effet / message d'erreur : 422 « La répartition (x) dépasse la quantité reçue (y). » ; historique `AfficheAssocier` ; alerte « Feuilles de stock à refaire » (Réception et Coordination).
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; EX-REC-048, EX-REC-062 ; EX-EXI-058
- Questions liées : Q-202
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-053 — Affiche à doute : tant que non confirmée, ses effets de validation ne sont pas produits
- Origine : NOUVELLE
- Modules : bidirectionnel
- Atomicité : transaction unique non (invariant de lecture)
- Énoncé : invariant : une affiche en `A_CONFIRMER_PROPOSE` ou `A_CONFIRMER_DOUTE` ne produit aucun des effets réservés à la validation (n° d'affiche « ✓ » dans l'état des réservations et le suivi de prod, retour « reçue et associée » à Broadcast, édition du picking, sortie de la liste « à traiter ») ; en revanche sa réception, son contrôle, son stock, sa feuille de stock et l'impression de son étiquette de stock restent permis (la réception ne dépend pas de la validation, la quantité reçue est comptée dès le mouvement de réception).
- Déclencheur : toute lecture ou action sur une affiche non validée.
- Conditions : état ≠ `VALIDEE`.
- Effet / message d'erreur : 422 sur les actions réservées (picking : RG-COO-022) ; test : une affiche à doute reçue et contrôlée a un stock et une feuille, mais aucun `EstAssociee`.
- Sources : spec [PP] §3, §5 ; [README] §3 (EX-COO-014) ; EX-REC-052 ; legacy `BLL/BatchAlimReceptionBll.cs:89`
- Questions liées : Q-231
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-054 — Réception inconnue traitée par la Coordination : « Signaler » et dossier introuvable
- Origine : NOUVELLE
- Modules : bidirectionnel (action de la Coordination sur une réception créée par REC)
- Atomicité : transaction unique oui
- Énoncé : sur une réception inconnue « À identifier », la Coordination peut : (1) « Voir les visuels proposés (n) » puis rattacher (RG-X-051) ; (2) rechercher par n° de dossier ; (3) « Signaler à la Coordination (alerte) » si personne ne retrouve le dossier : l'affiche passe « Introuvable : alerte à la Coordination » avec date/heure du signalement, une alerte « Dossier introuvable » est levée (grave dès le signalement, Coordination du site, sans mail), et toute correction ultérieure de Broadcast (dossier créé/corrigé) fait apparaître le dossier dans les candidats. Deux cas à ne pas confondre : DA activée mais IP non saisies = pas une réception inconnue (RG-COO-071) ; dossier dans Broadcast mais affiche non reconnue = réception inconnue.
- Déclencheur : bouton « Signaler à la Coordination (alerte) ».
- Conditions : affiche « À identifier » ; un signalement répété met à jour la date, ne duplique pas l'alerte.
- Effet / message d'erreur : transition `A_IDENTIFIER → INTROUVABLE` ; toast « Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… » ; destinataire Nîmes : Q-221 ; qui rattache après la correction Broadcast : Q37 d'origine, hors décision.
- Sources : spec [DC] §3, §7, §10, §11 ; [PR] p.1 ; [PP] §6 (EX-COO-017) ; EX-REC-041, EX-REC-042 ; écran ECR-REC-04
- Questions liées : Q-221, Q-234
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-055 — Ligne fermée ou annulée : le lien de l'affiche est déplacé, jamais perdu
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : quand une ligne attendue se ferme (annulation Broadcast, fermeture du provisoire aux IP, RG-COO-085, 087), les liens d'affiches qu'elle porte restent intacts (liés à la ligne fermée) jusqu'à un déplacement explicite (automatique si un seul candidat, sinon choix de la Coordination) ; l'affiche ne devient jamais « Orpheline » du seul fait de la fermeture d'une ligne ; une alerte à la Coordination signale l'affiche à re-rattacher ; un lien déplacé conserve son historique (retiré/créé, qui, quand).
- Déclencheur : fermeture d'une ligne attendue.
- Conditions : au moins un lien actif.
- Effet / message d'erreur : test de rejet : après fermeture de la ligne, l'affiche reste « Identifiée » et le stock est intact.
- Sources : spec [RA] §5 RG-AT-04, 06, 08 ; [PP] §6, §7 R5 (EX-COO-035, EX-COO-037, EX-COO-039)
- Questions liées : Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-056 — Saisie des IP : déplacement automatique des affiches du provisoire vers le thème
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : le passage « visuel provisoire → lignes par thème » (RG-COO-085) a des conséquences sur les affiches réceptionnées avant les IP : l'affiche est déplacée seule vers le thème s'il n'y a qu'un thème possible ou si le visuel du BL n'en désigne qu'un ; sinon elle reste rattachée au provisoire fermé et la Coordination choisit ; aucun candidat : alerte ; l'intitulé de la plateforme (« 1er qui a parlé ») est conservé autant que possible, et si la Pré-Prod corrige l'intitulé, les feuilles de stock sont à refaire (alerte « Feuilles de stock à refaire » à la Réception).
- Déclencheur : lecture de Broadcast avec IP.
- Conditions : affiche rattachée à une ligne provisoire.
- Effet / message d'erreur : tag « Feuille à refaire » si l'intitulé change ; tout déplacement est historisé.
- Sources : spec [RA] §5 RG-AT-04 ; [PP] §7 R3, R5 (EX-COO-035) ; ateliers EX-THM-501, EX-THM-503 (A14 slide 30 #1, #3) ; EX-REC-062
- Questions liées : Q-208
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-057 — Thème modifié dans Broadcast après la validation : validation à refaire et feuille de stock à refaire
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : si le thème de la ligne d'une affiche validée est modifié dans Broadcast (RG-COO-030), la Coordination « Reprendre la version Broadcast » (RG-COO-068) : dans la même transaction le thème de la ligne est mis à jour, la validation de l'affiche est à refaire (hypothèse Q-210), le tag « Feuille à refaire » est posé sur l'affiche et l'alerte « Feuilles de stock à refaire » est levée (Réception et Coordination) pour réimpression des feuilles ; une page des modifications de thème reçues après l'identification est mise à disposition de la Réception avec alerte (EX-THM-503).
- Déclencheur : action « Reprendre la version Broadcast » ; lecture de Broadcast modifiant le thème.
- Conditions : thème de Broadcast ≠ thème de Circé ; au moins une affiche rattachée.
- Effet / message d'erreur : si production lancée : mail aux chefs d'équipe (RG-COO-068) ; tags et alertes levés à la réimpression de la feuille.
- Sources : spec [README] §3 ; [PP] §6, §9 (EX-COO-016, EX-COO-029) ; ateliers EX-THM-503 ; écran ECR-THM-03 ; `maquettes-autres-modules.md §0.1` (écriture de THM vers Réception : `noterThemeModifie`)
- Questions liées : Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-058 — Retrait ou dissociation du dernier dossier par la Coordination : l'affiche redevient réception inconnue
- Origine : MODIFIÉE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : si la Coordination retire (dissocie) le dernier lien actif d'une affiche, l'affiche redevient orpheline (« Réception inconnue ») avec statut de réception « À identifier » (hors du sas), sa validation est caduque (effacée, historisée), son alerte « Réception inconnue à identifier » est relevée. La dissociation est historisée par une action distincte `AfficheDissocier`. MODIFIÉE : legacy = dissociation sans contrôle de statut, historisée avec l'action d'association (id de la prépa comme id d'entité) ; `ARecevoir` non remis à zéro (voir RG-COO-097) ; état de la palette « À identifier » ou « À contrôler » si elle était déjà contrôlée : contradiction [DC] §9 / §10 (EX-REC-043), traité par le module Réception.
- Déclencheur : action « Retirer » (fiche affiche, onglet Préparations).
- Conditions : un seul lien actif restant.
- Effet / message d'erreur : transition `IDENTIFIEE → ORPHELINE` ; 409 si aucun lien actif.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:577-586` ; `BLL/HistorisationBll.cs:68-76` · spec [DC] §8, §9, §10 (EX-COO-039) ; EX-REC-043
- Questions liées : Q-213
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-059 — Déblocage / « Rendre la main » : validation admin et affiches reçues inchangées
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : invariant : le déblocage d'une préparation (RG-COO-145) et le renvoi de prépa (RG-COO-054, 148) n'altèrent ni la validation admin déjà faite, ni les affiches reçues, ni leur stock, ni les liens avec les lignes attendues ; seules les lignes de répartition/UM non lancées sont annulées ou remises en attente (coo2). La validation admin ne bouge pas lors d'un renvoi de prépa (règle `renvoiPrepa` de la maquette). HYPOTHÈSE Q-217 (question Q-COO-18 de la maquette : « conséquences sur la validation admin et les affiches reçues »).
- Déclencheur : déblocage ; renvoi de prépa.
- Conditions : toute validation existante.
- Effet / message d'erreur : test de rejet : un déblocage laisse `VALIDEE` et le stock inchangés.
- Sources : maquette `app.js` `renvoiPrepa` (maquettes-autres-modules.md §A) ; ECR-COO-09b ; spec [PP] §2 jalon 5 (EX-COO-044)
- Questions liées : Q-217
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-060 — Thème partagé par plusieurs dossiers : le reçu est compté une seule fois
- Origine : NOUVELLE
- Modules : bidirectionnel
- Atomicité : transaction unique non (invariant de calcul)
- Énoncé : invariant : pour un thème présent sur plusieurs dossiers (ou un dossier sur plusieurs semaines), la quantité reçue d'une affiche est la somme de ses mouvements, jamais dupliquée par le nombre de dossiers ; la répartition par dossier est portée par les quantités des liens (RG-COO-088) et leur somme ne dépasse pas la quantité reçue ; les totaux (état des réservations, tableau de bord) comptent le reçu et le reste une fois par thème.
- Déclencheur : calcul d'attendu/reçu/reste.
- Conditions : lien plusieurs-à-plusieurs.
- Effet / message d'erreur : test : une affiche de 100 sur 3 dossiers (50/30/20) ⇒ reçu total 100.
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; EX-REC-058 ; écran ECR-PIL-03 (« Totaux en pied (reçu et reste comptés une fois par thème) ») ; ateliers EX-TRA-515
- Questions liées : Q-208
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-061 — Réception partielle : validation de ce qui est reçu, complément proposé puis confirmé
- Origine : NOUVELLE
- Modules : bidirectionnel
- Atomicité : transaction unique oui
- Énoncé : une réception partielle est validée pour ce qu'elle contient (RG-COO-016) ; le manque reste à l'état « reste à recevoir » de la ligne avec son alerte (Visuel non reçu / reçu en partie : Réception) ; à l'arrivée du complément (nouvelle réception sur la même ligne), la Coordination reçoit une nouvelle proposition (complément proposé) qui est confirmée comme les autres ; l'affiche garde ses liens ; la validation du premier lot n'est pas retirée.
- Déclencheur : réception d'un complément (action Réception).
- Conditions : ligne avec liens actifs et reste à recevoir > 0.
- Effet / message d'erreur : nouvelle proposition `A_CONFIRMER_PROPOSE` pour le complément (tag « Complément » de l'affiche) ; exemple 3/3/3 : A et B validées, rien pour C, complément de B proposé.
- Sources : spec [PP] §5, §6 ; [RA] RG-VA-03, cas 24 (EX-COO-011) ; EX-REC-054, EX-REC-059
- Questions liées : Q-203
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-062 — Aucune écriture en lecture : supprimer l'auto-rattachement à l'ouverture d'une fiche
- Origine : MODIFIÉE
- Modules : COO → REC
- Atomicité : transaction unique non (invariant)
- Énoncé : l'ouverture de la fiche d'une affiche (liste filtrée) ne rattache plus rien automatiquement : toute proposition passe par la création de l'affiche (RG-COO-004) ou une action explicite de rattachement. MODIFIÉE : legacy = si l'affiche n'a aucune préparation et n'est pas validée, l'ouverture depuis une liste filtrée rattache d'office toutes les lignes attendues du même dossier/plateforme/support (`ValiderAssocPrepaAffiche`), sans confirmation. Remplacé par la proposition de l'option A (Q-214, HYPOTHÈSE).
- Déclencheur : lecture de la fiche affiche.
- Conditions : `GET` idempotent sans effet de bord.
- Effet / message d'erreur : test : deux ouvertures successives de la fiche ne créent aucun lien ni historique.
- Sources : legacy `WEB/Controllers/ReceptionListeAfficheController.cs:218-257` (ancien ID provisoire RG-COO-024 ; RG-REC-093) · spec [PP] §5 ; [RA] RG-AT-08 (EX-COO-004)
- Questions liées : Q-214
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-063 — Rattachement par la Réception ne vaut pas validation ; validation possible à tout moment du process
- Origine : NOUVELLE
- Modules : bidirectionnel
- Atomicité : transaction unique oui
- Énoncé : un rattachement fait par l'agent de réception (rôle `recep`) ne pose jamais la validation admin : l'affiche reste « À confirmer » (motif BL, mode MAIN). La validation reste possible à n'importe quel statut de la ligne, de l'instruction et du dossier (y compris après l'export du jeudi 14 h : l'affiche arrivée après l'export est proposée puis confirmée ; urgences du vendredi), sans changer ces statuts.
- Déclencheur : rattachement par `recep` ; validation tardive.
- Conditions : aucune condition de statut du dossier/de l'instruction (RG-COO-001).
- Effet / message d'erreur : test de rejet : rattachement par `recep` ⇒ état `A_CONFIRMER_DOUTE`, jamais `VALIDEE`.
- Sources : spec [README] §3, H1 ; [PP] §2 jalon 7 ; [DC] §7 (EX-COO-010, EX-COO-044) ; EX-EXI-053 ; écran ECR-REC-04 (Q-REC-18)
- Questions liées : Q-201
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-064 — Quantité Broadcast modifiée après réception : l'attendu se recalcule, les liens et le stock restent
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : une modification de quantité dans Broadcast après réception met à jour `qte_bc` / `qte_prepa` de la ligne et le statut calculé de la ligne (Attendue / Partielle / Complète / Surplus, > 10 % en trop) côté Réception ; les liens, le stock et les validations restent inchangés ; une alerte « Écart Broadcast / Circé » est levée à la Coordination (RG-COO-031, 067).
- Déclencheur : lecture de Broadcast ; arrivée de la prépa.
- Conditions : ligne avec liens actifs.
- Effet / message d'erreur : test : `qte` Broadcast de 100 → 80 avec reçu 90 ⇒ statut « Surplus » (+12,5 %), alerte levée, aucun lien retiré.
- Sources : spec [RA] RG-AT-05, RG-VA-02 ; [PP] §6 (EX-COO-016, EX-COO-028) ; EX-REC-051
- Questions liées : Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-065 — Dossier ou DA annulé après réception : affiches conservées en stock, alerte à la Coordination
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : l'annulation d'une DA/d'un dossier après réception (RG-COO-062, 087) ne supprime ni ne rebute les affiches reçues : elles restent en stock (fin de campagne : décision de la Coordination/Réception), leur validation devient sans objet, les alertes de validation levées sont relevées, et une alerte informe la Coordination que des affiches reçues sont rattachées à une ligne fermée (RG-COO-032).
- Déclencheur : passage du dossier à `ANNULE` / ligne `ANNULEE`.
- Conditions : affiches rattachées.
- Effet / message d'erreur : aucun mouvement de stock créé ; test de rejet : le stock de l'affiche est inchangé.
- Sources : spec [RA] RG-AT-06, cas 14 ; [PP] §6 (EX-COO-037) ; maquette ECR-COO-01 (dossier annulé)
- Questions liées : Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
