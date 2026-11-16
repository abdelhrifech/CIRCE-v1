Rôles PROVISOIRES (Q-003, CLAUDE.md §8) = les 6 rôles de la maquette, colonnes dans cet ordre : `coord` Coordination · `cheq` Chef d'équipe · `recep` Agent de réception (= contrôleur, EX-REC-076) · `expe` Agent d'expédition · `admin` Administrateur · `com` Commerce (lecture).

Légende : ✔ autorisé (source explicite) · ✘ refusé (source explicite) · ✔* / ✘* = déduit de l'HYPOTHÈSE Q-136 · ✔(cond.) = autorisé sous condition · ? = non tranché (question citée).
HYPOTHÈSE Q-136 (statut HYPOTHÈSE PRISE) : la maquette ne grise que les écrans « secondaires » du rôle (`s.roles`, aucun refus codé, `maquettes-reception-coordination.md §1.3`) ; en cible les permissions sont vérifiées dans le service (CLAUDE.md §6, EX-TRA-002). On retient : écran « primaire » du rôle (champ `roles` de l'écran de la maquette) = lecture et écriture autorisées ; écran « secondaire » = lecture seule ; `com` = lecture seule partout. Écrans primaires : `reception` (étapes 1 et 2, Liste des affiches) = coord, cheq, recep, com (lecture) ; `identification` (Réceptions inconnues) = coord, recep ; Stock par affiche (mise au rebut) = recep, cheq, expe ; Validation admin = coord et admin (restriction codée) ; Paramétrage = admin. Les cellules marquées « ? Q-136 » sont contredites par une autre source (chef d'équipe : « alertes, consultation » EX-REC-076 vs écran primaire de la maquette).

| Action | coord | cheq | recep | expe | admin | com | Source |
|---|---|---|---|---|---|---|---|
| Consulter les Réceptions attendues et le panier | ✔* | ✔* | ✔ | ✘* | ✘* | ✔ (lecture) | ECR-REC-01 `roles` ; `[README]` H10 (EX-TRA-004) ; legacy droit `reception_liste_affiche` (menu) |
| Photographier le BL / une affiche, mettre au panier | ✔* | ? Q-136 | ✔ | ✘* | ✘* | ✘ | EX-REC-076 (agent de réception : quai, étape 1) ; ECR-REC-01/07 |
| Valider la réception (créer la réception, les affiches et les mouvements) | ✔* | ? Q-136 | ✔ | ✘* | ✘* | ✘ | EX-REC-076 ; ECR-REC-01 |
| Créer une réception inconnue | ✔* | ? Q-136 | ✔ | ✘* | ✘* | ✘ | EX-REC-076 (« crée les inconnues ») ; ECR-REC-08 |
| Consulter le sas (palettes à contrôler) et son badge | ✔* | ✔ | ✔ | ✘* | ✘* | ✔ (lecture) | EX-REC-070 (alerte palette en retard : Réception et chefs d'équipe) ; ECR-REC-02 |
| Contrôler la palette et « Valider le contrôle et imprimer » (contrôleur) | ? Q-136 | ? Q-136 | ✔ | ✘* | ✘* | ✘ | EX-REC-026, 076 (contrôleur = un agent de réception) ; ECR-REC-02 |
| Imprimer / réimprimer feuilles de stock et étiquettes rack (liste, fiche, ligne attendue contrôlée) | ✔* | ✔* | ✔ | ✘* | ✘* | ✘ | EX-REC-034, 076 (« réimprime les feuilles ») ; ECR-REC-03/09/10 |
| Consulter la Liste des affiches, la fiche affiche et la fiche réception | ✔* | ✔* | ✔ | ✘* | ✘* | ✔ (lecture) | ECR-REC-03/05/06 ; `[README]` H10 |
| Modifier la fiche affiche (annonceur/thème saisis, imprimeur, allée, rayon, « à conserver ») | ✔* | ✔* | ✔ | ✘* | ✘* | ✘ | ECR-REC-05 ; legacy RG-REC-024 (aucun contrôle serveur) |
| Consulter les Réceptions inconnues (badge rouge) | ✔ | ✘* | ✔ | ✘* | ✘* | ✘ | ECR-REC-04 `roles` ; EX-REC-037 |
| Identifier et « Rattacher » une réception inconnue | ✔ (vaut validation admin) | ✘* | ✔(cond. : reste « à confirmer », pas de validation) ? Q-107 | ✘* | ✘* | ✘ | EX-REC-040 ; ECR-REC-04 (`rattache='MAIN'`) |
| « Signaler à la Coordination » (Dossier introuvable) | ✔* | ✘* | ✔ | ✘* | ✘* | ✘ | EX-REC-041 ; ECR-REC-04 |
| Valider / « Annuler la validation » (validation admin d'une affiche) | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | `[README]` H1 ; maquette `role === 'coord' || 'admin'` (instructions.js:16-18, reception.js:85-88) ; EX-COO-010, EX-TRA-005 ; mapping legacy droit `validation_admin` |
| Changer de thème, retirer un rattachement, « + Rattacher à un autre dossier » (fiche affiche) | ✔ (vaut validation) | ? Q-136 | ✔(cond. : reste « à confirmer ») ? Q-136 | ✘* | ✘* | ✘ | EX-REC-048 ; ECR-REC-05 ; Q-REC-22 de la maquette (droits sur « Retirer » non définis) |
| Cocher « Affiche à conserver » | ✔* | ✔* | ✔ | ✘* | ✘* | ✘ | ECR-REC-05 ; legacy droit `validation_admin` (case « à conserver » réservée à ce droit) : écart, Q-136 |
| Mettre au rebut (depuis Stocks ou fiche) | ✘* | ✔ | ✔ | ✔ | ✘* | ✘ | ECR-STK-01 `roles` recep, cheq, expe ; EX-REC-024 |
| Ajout / sortie manuels de stock | ? Q-117 | ? Q-117 | ? Q-117 | ? Q-117 | ? Q-117 | ✘ | legacy RG-REC-021/022 (aucun contrôle) ; Q-117 |
| Consulter Stocks › Fin de campagne (destruction) | ✔ | ✔ | ✔ | ✘* | ✘* | ✘* | ECR-STK-03 `roles` recep, cheq, coord (module STK, hors REC) |
| Consulter Pilotage › Alertes et acquitter | ✔ | ✔ | ✔ | ✘* | ✔* | ✔ (lecture) | ECR-TRA-01 ; EX-TRA-027 (règles d'acquittement : Q-TRA-2 maquette) |
| Paramétrer Règles métier › Réception (seuils, purge, délai, exemplaires, allée) | ✘* | ✘* | ✘* | ✘* | ✔ | ✘ | ECR-ADM-05 ; `[README]` §3 (Administration › Paramétrage) |
| Gérer les référentiels Imprimeurs / Livreurs / Agents de réception | ✘* | ✘* | ✘* | ✘* | ✔ | ✘ | ECR-ADM-07 ; EX-REC-074, EX-ADM-501 ; legacy droit `referentiel`/`admin` |
| Gérer plateformes, imprimantes, mails de réception | ✘* | ✘* | ✘* | ✘* | ✔ | ✘ | legacy-admin RG-ADM-040/042 (droit `admin`) ; EX-TRA-041 |
| Consulter l'historique d'une affiche et le journal | ✔* | ✔* | ✔ | ✘* | ✔ | ✔ (lecture) | ECR-REC-05 (onglet Historique) ; ECR-ADM-08 |
| Exporter un tableau (xlsx) | ✔* | ✔* | ✔* | ✘* | ✔* | ✔ (lecture) | EX-TRA-016 ; maquette §2.1 (« Exporter » visible pour tous) |

Mapping des droits legacy (27, `CommunBll.Droits`, `legacy-admin.md §2`) touchant la Réception, vers les rôles provisoires :

| Droit legacy (`tr_utilisateur_menu.menu`) | Effet legacy (UI uniquement, jamais contrôlé côté serveur : RG-ADM-015) | Rôle(s) cible provisoire(s) | Source |
|---|---|---|---|
| `reception_liste_affiche` | Menu Réception : Réception des affiches + Liste des affiches | coord, cheq, recep (+ com en lecture) | legacy-admin §2 ; RG-REC-120 |
| `validation_admin` | Cases « Validation Admin » et « Affiche à conserver » ; boutons associer/dissocier une prépa | coord, admin (validation) ; case « à conserver » : voir Q-136 | legacy RG-REC-027/091/092 ; EX-TRA-005 |
| `Zone_Picking` | Sous-menu Zone picking ; case « zone Picking » du détail | non repris (EX-REC-079, Q-101) | legacy RG-REC-029 ; `[README]` §3, §7 |
| `fusion_affiche` | Sous-menu Fusion des affiches ; colonne/bouton Fusionner | non repris (EX-REC-079, Q-100) | legacy RG-REC-014 |
| `suivi_suivi_production` | Menu Suivi dont Etat de destruction | coord, cheq, recep (Pilotage, Stocks › Fin de campagne) | legacy RG-REC-050, 120 |
| `admin`, `referentiel`, `Super_admin` | Administration : plateformes, mails, imprimantes, référentiels, utilisateurs | admin | legacy-admin §2 |
| Périmètre `tr_utilisateur_data` (plateforme, atelier) | Listes de plateformes filtrées | tous rôles : périmètre par site conservé (RG-REC-001) | legacy RG-REC-001 ; EX-TRA-006 |

Constat legacy conservé pour mémoire : aucun contrôle serveur n'existe dans l'existant (RG-REC-121 provisoire) ; la cible l'impose (RG-REC-002).
