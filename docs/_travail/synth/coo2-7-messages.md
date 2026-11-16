Les messages marqués (legacy) sont repris à l'identique du code ; les messages (maquette) de l'écran cible ; (à définir) = libellé proposé, non source. Les erreurs sont renvoyées au format `{ code, message, details?, regle? }` avec `regle` = ID de la RG violée.

| Code | Message | Règle |
|---|---|---|
| COO2_TRAIN_EN_PRODUCTION | Train déjà en production : impossible de le modifier (point de non-retour). (maquette) | RG-COO-223 |
| COO2_AUCUN_FRACTIONNABLE | Aucun train fractionnable (il faut au moins un visuel reçu). (maquette) | RG-COO-221 |
| COO2_FRACTIONNE_OK | n train(s) fractionné(s) : ils passent « Prêt », les visuels manquants seront produits à part. (maquette) | RG-COO-221 |
| COO2_FRACTIONNEMENT_STATUT | Le statut du thème ne permet pas le fractionnement ! (legacy) | RG-COO-221 |
| COO2_PAS_DE_DONNEES | Pas de données à traiter ! (legacy) | RG-COO-221 |
| COO2_TRAIN_COMPLET | Train complet (maquette) | RG-COO-209, 222 |
| COO2_RACCROCHAGE_MASSE | n train(s) recevront ce visuel (maquette) | RG-COO-222 |
| COO2_CHOISIR_VISUEL_DEST | Choisissez un visuel et un destinataire. (maquette) | RG-COO-224 |
| COO2_SELECTION_N_TRAINS | n train(s) sélectionné(s), sur m ligne(s)… la ligne suivante en compte k et dépasserait N. (maquette) | RG-COO-227 |
| COO2_ANNULATION_THEME_STATUT | Le statut du thème ne permet pas l'annulation ! (legacy) | RG-COO-219 |
| COO2_ANNULATION_THEME_FACES | Toutes les faces du theme ne sont pas dans le statut 'A Imprimer' (legacy) | RG-COO-219 |
| COO2_DEBLOQUER_SEMAINE_VIDE | Il n'y a pas de données à traiter ! (legacy) | RG-COO-220 |
| COO2_DEBLOQUER_SEMAINE_STATUT | Toutes les données ne sont pas au statut 'A imprimer' ! (legacy) | RG-COO-220 |
| COO2_CHANGER_STATUT_FACES | Toutes les faces des trains ne sont pas dans le statut 'Au roulage' ou 'Export prépa' ! (legacy) | RG-COO-218 |
| COO2_EXPORT_PREPA_STATUT | Les faces des trains ne sont pas dans le statut 'A imprimer' ! (legacy) | RG-COO-215 |
| COO2_EXPORT_CAPACITE | Le nombre de thèmes ajouté est supérieur à la capacité de la machine ! (legacy) | RG-COO-216 |
| COO2_EXPORT_RIEN | Aucun dossier en Instruction OK à exporter (à définir ; bouton Exporter désactivé si 0) | RG-COO-211 |
| COO2_EXPORT_OK | n dossier(s) en Instruction OK : leurs faces passent « A imprimer », le go des plateformes. (maquette) | RG-COO-211 |
| COO2_EXPORT_ERREUR | L'export a échoué : aucun statut n'a été modifié (à définir ; le legacy masque l'erreur) | RG-COO-213 |
| COO2_COUVERTURE | Visuel manquant : le train reste « En attente d'affiches » (à définir) | RG-COO-208 |
| COO2_LIBERATION_OK | S44 libérée vers l'atelier … Les préparations reçues ensuite déclencheront une alerte et un mail. (maquette) | RG-COO-240 |
| COO2_LIBERATION_DEJA | Cette semaine est déjà libérée pour cet atelier (à définir) | RG-COO-240 |
| COO2_RENDRE_MAIN_PROD | n unité(s) déjà en production — Elles ne seront pas retirées (point de non-retour) (maquette) | RG-COO-243 |
| COO2_INTITULE_VIDE | Le thème et l'annonceur ne peuvent pas être vides. (maquette) | RG-COO-244 |
| COO2_INTITULE_INCHANGE | Rien n'a changé. (maquette) | RG-COO-244 |
| COO2_8M2_VALEUR | Valeur invalide : un nombre supérieur ou égal à 0 est attendu (à définir) | RG-COO-237 |
| COO2_COMPTAGE_OK | Comptage conforme. (maquette) | RG-COO-247 |
| COO2_COMPTAGE_ECART | Écart de comptage : n affiche(s). Alerte qualité créée. (maquette) | RG-COO-247 |
| COO2_TRANSITION_INTERDITE | Transition de statut interdite (à définir ; 409, `regle` = RG de la table de transitions) | RG-COO-307 |
| COO2_CONFLIT_VERSION | La donnée a été modifiée par un autre utilisateur : actualisez (à définir ; 409) | RG-COO-308 |
| COO2_UM_STATUT | L'UM n'existe pas ou n'est pas en cours ou préparée (legacy) | RG-COO-265 |
| COO2_UM_DEST | Le destinataire de l'UM ne correspond pas à celle du colis (legacy) | RG-COO-265 |
| COO2_UM_DEJA_COLIS | L'UM à ajouter existe déjà dans le colis (legacy) | RG-COO-265 |
| COO2_UM_DEST_ATELIER | Le destinataire des UMs est différent de celui du colis ! (legacy) | RG-COO-265 |
| COO2_UM_CODE_INCONNU | Code inconnu : X (maquette EXP) | RG-COO-265 |
| COO2_UM_NON_PRODUIT | … n'est pas « Produit » (statut : …) (maquette EXP) | RG-COO-265 |
| COO2_TRAIN_DEJA_COLIS | Il existe déjà un train dans ce colis (legacy) | RG-COO-270 |
| COO2_TRAIN_DEST_COLIS | Le destinataire du train ne correspond pas à celui du colis (legacy) | RG-COO-270 |
| COO2_COLIS_EXPEDITION | Problème lors de l'expédition (legacy) | RG-COO-268 |
| COO2_COLIS_FIN_JOURNEE | Le colis expédié (legacy, action unitaire de fin de journée) | RG-COO-269 |
| COO2_UM_DANS_COLIS | L'UM est dans un colis : retrait impossible (à définir ; le legacy échoue par contrainte étrangère) | RG-COO-249 |
| COO2_REPART_TRANSITION | Seules les répartitions à traiter peuvent être placées dans une UM (à définir) | RG-COO-262 |
| COO2_DEBLOCAGE_REFUSE | Le groupe de preparation n'est pas déblocable ! (legacy) | RG-COO-277 |
| COO2_DOUBLON_REPART | Doublon envoie : <rpfo> (legacy, `tt_log`) | RG-COO-272 |
| COO2_BAGUE_AUCUNE_PRETE | Aucune unité « Prêt à produire » dans la sélection. (maquette) | RG-COO-299 |
| COO2_BAGUE_MOTIF | Motif de réimpression obligatoire (à définir) | RG-COO-301 |
| COO2_DISPATCH_REPARTI | Répartition proposée : n trains sur m rouleurs. (maquette) | RG-COO-293 |
| COO2_DISPATCH_AUCUN_ATELIER | Aucun atelier déroulant sur ce site. (maquette) | RG-COO-291 |
| COO2_ATELIER_ABSENT | Pas d'atelier « X » sur ce site. Choisissez « Tous les sites » ou un autre site en haut de page. (maquette) | RG-COO-291 |
| COO2_TRAIN_DOUBLON_6 | Train supérieur à 6 pour le TrainId (legacy, `tt_log` module « CIRCE - Export Surf ») | RG-COO-213 |
