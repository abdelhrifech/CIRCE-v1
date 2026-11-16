Messages exacts de la maquette ou du legacy lorsqu'ils sont connus ; les textes marqués « (à définir) » sont proposés sans source et à valider.

| Code | Message | Règle |
|---|---|---|
| COO_VA_BANDEAU | Aucune validation sans vous : Circé propose, vous confirmez | RG-COO-002 |
| COO_VA_RIEN_A_VALIDER | Rien à valider : les dossiers choisis n'ont aucune affiche à confirmer (validation admin déjà faite, ou aucune affiche reçue). | RG-COO-013 |
| COO_VA_RIEN_DANS_SELECTION | Aucune affiche à confirmer dans la sélection : la validation admin est déjà faite, ou aucune affiche n'est encore arrivée. | RG-COO-013 |
| COO_VA_CONFIRMER_DOUTES | n affiche(s) sans doute et m affiche(s) à doute sont dans la sélection. Rien n'est validé sans vous… | RG-COO-012 |
| COO_VA_CONFIRMER_SANS_DOUTE | Confirmer les n sans doute seulement | RG-COO-012 |
| COO_VA_CONFIRMER_TOUT | Confirmer tout (n) | RG-COO-012 |
| COO_VA_DOUTES_NON_CONFIRMES | Des affiches à doute sont dans la sélection : confirmez-les explicitement ou retirez-les. (à définir) | RG-COO-012 |
| COO_VA_CONFIRMEES | n affiche(s) confirmée(s) par la Coordination : n° d'affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé. | RG-COO-008, 010 |
| COO_VA_RESERVE | Réservé à la Coordination : choisissez le rôle « Coordination » en haut de page pour valider | RG-COO-009 |
| COO_VA_DEJA_VALIDEE | Cette affiche est déjà validée. (à définir) | RG-COO-008 |
| COO_VA_NON_VALIDEE | Cette affiche n'est pas validée : rien à annuler. (à définir) | RG-COO-014 |
| COO_VA_MOTIF_BL | Rattachée sans le n° du BL | RG-COO-006 |
| COO_VA_MOTIF_FORMAT | Format différent | RG-COO-006 |
| COO_VA_MOTIF_THEME | Plusieurs thèmes possibles | RG-COO-006 |
| COO_VA_MOTIF_MULTI | Répartition à confirmer | RG-COO-006 |
| COO_VA_MOTIF_SANS_IP | IP pas saisies | RG-COO-006 |
| COO_VA_MOTIF_ANNULEE | Validation annulée : à refaire | RG-COO-006, 014 |
| COO_RATT_AUCUN_DOSSIER | Choisissez au moins un dossier et une quantité. | RG-COO-088, RG-X-051 |
| COO_RATT_DEPASSE | La répartition (n) dépasse la quantité reçue (m). | RG-COO-088, RG-X-051, RG-X-052 |
| COO_IOK_FAITES | n dossier(s) en Instruction OK : Circé répartit les visuels sur les trains et crée l'entretien. Les trains partent à l'export du jeudi 14 h (Liste des trains). | RG-COO-044 |
| COO_IOK_REPARTITION | La répartition des thèmes n'est pas à 100 % ! | RG-COO-043 |
| COO_IOK_PREPA_ABSENTE | L'Instruction OK n'est possible qu'après réception de la préparation. (à définir) | RG-COO-052 |
| COO_IOK_ENTRETIEN_GELE | Entretien repris de Broadcast : modifiable seulement quand l'Instruction OK se fait après contrôle (dossier « En cours »). | RG-COO-047, 048 |
| COO_TRANSITION_INTERDITE | Transition de statut interdite : <statut> → <statut>. (à définir) | RG-COO-040 |
| COO_BC_DEMANDE_DEJA | Une demande est déjà partie le … Le mail sera renvoyé. | RG-COO-057 |
| COO_BC_PROD_LANCEE | Production lancée — Prévenez aussi l'atelier | RG-COO-057 |
| COO_BC_MAIL_OBJET | [Circé] Correction à faire dans Broadcast : dossier n (annonceur) | RG-COO-057 |
| COO_THEME_REPRIS | Thème « … » repris de Broadcast pour le dossier … Production lancée : l'atelier est prévenu. | RG-COO-068 |
| COO_THEME_DEMANDE_ENVOYEE | Demande envoyée pour n dossier(s) : mail au gestionnaire… | RG-COO-069 |
| COO_THEME_DIFFERENTS | Noté : ce sont des visuels différents. L'alerte est levée. | RG-COO-069 |
| COO_ANNONCEUR_DIFFERENTS | Noté : ce sont des annonceurs différents… | RG-COO-070 |
| COO_THEME_RIEN_A_DEMANDER | Rien à demander… Voir avec l'atelier | RG-COO-069 |
| COO_ALERTE_DOSSIER_INTROUVABLE | Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… | RG-X-054 |
| COO_DEBLOC_NON_DEBLOCABLE | Le groupe de preparation n'est pas déblocable ! | RG-COO-143, 144 |
| COO_DEBLOC_PERIODE | La date de fin doit être supérieur à la date de début ! | RG-COO-149 |
| COO_DEBLOC_RECHERCHE_VIDE | Saisissez un n° de préparation ou un n° de dossier. (à définir) | RG-COO-140 |
| COO_ALIM_INTERFACE_ABSENTE | IdInterface non récupéré ! | RG-COO-115 |
| COO_ALIM_ERREUR_PREPA | Erreur dans la procédure : p_integ_preparation ! | RG-COO-125 |
| COO_ALIM_ERREUR_DEROULANTS | Erreur dans la procédure : p_integ_deroulants ! | RG-COO-131 |
| COO_ALIM_EN_COURS | Un passage d'alimentation est déjà en cours. (à définir) | RG-COO-102 |
| COO_PERMISSION | Action réservée à la Coordination et aux administrateurs. (à définir ; code `PERMISSION`, `regle` = RG violée) | RG-COO-009, 165, 168 |
| COO_LECTURE_SEULE | Rôle en lecture seule : aucune action n'est possible. (à définir) | RG-COO-168 |
| COO_VIDE_FILTRES | Aucune ligne pour ces filtres. | RG-COO-060 |
| COO_VIDE_THEMES_PROCHES | Aucun thème proche à vérifier avec ces filtres. | RG-COO-069 |
| COO_VIDE_ANNONCEURS | Aucun annonceur proche à vérifier avec ces filtres. | RG-COO-070 |
| COO_VIDE_THEME_BC | Aucun thème modifié dans Broadcast avec ces filtres : Broadcast et Circé ont les mêmes thèmes. | RG-COO-068 |
| COO_PREPA_PAS_ENVOYEE | Préparation pas encore envoyée de Broadcast. | RG-COO-063 |
