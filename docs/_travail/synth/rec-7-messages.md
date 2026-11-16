Messages exacts quand connus (maquette / legacy) ; « (proposé) » = libellé à valider. HTTP : 400 validation, 401, 403, 404, 409, 422 règle métier.

| Code | Message | Règle |
|---|---|---|
| REC_PANIER_VIDE (422) | Le panier est vide. | RG-REC-037 |
| REC_AUCUNE_LIGNE_COCHEE (422) | Cochez dans le panier les lignes de ce BL. | RG-REC-037 |
| REC_BL_DEUX_PLATEFORMES (422) | Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme. | RG-REC-024, 037 |
| REC_PHOTO_BL_MANQUANTE (422) | Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche. | RG-REC-026, 037 |
| REC_BL_CHAMPS_OBLIGATOIRES (422) | N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé. | RG-REC-033, 037 |
| REC_ALLEE_RAYON_OBLIGATOIRES (422) | Allée et rayon sont obligatoires pour chaque affiche. | RG-REC-061 |
| REC_CONTROLEUR_OBLIGATOIRE (422) | Le nom du contrôleur est obligatoire (REC-12). | RG-REC-067 |
| REC_QTE_INCONNUE_OBLIGATOIRE (422) | Indiquez la quantité comptée. | RG-REC-096 |
| REC_ALLEE_RAYON_INCONNUE_OBLIGATOIRES (422) | Allée et rayon sont obligatoires : ils sont imprimés sur la feuille temporaire. | RG-REC-097 |
| REC_RATTACHER_SANS_DOSSIER (422) | Choisissez au moins un dossier et une quantité. | RG-REC-107 |
| REC_REPARTITION_DEPASSE (422) | La répartition (x) dépasse la quantité reçue (y). | RG-REC-108 |
| REC_QTE_DOSSIER_OBLIGATOIRE (422) | Indiquez la quantité pour ce dossier. | RG-REC-136 |
| REC_BL_DOUBLON (422, confirmable) | Ce n° de BL a déjà été réceptionné (réception R…). Continuer ? (proposé) | RG-REC-036 |
| REC_DOSSIER_FORMAT (400) | Attention, votre format de saise de dossier est inccorect. Exemple format attendue "100000+120000" (texte legacy, fautes d'origine) | RG-REC-013 |
| REC_SEMAINE_FORMAT (400) | Attention, votre format semaine est inccorect. Exemple format attendue "S41/S42+S41/S42" (legacy) | RG-REC-147 |
| REC_DOSSIER_SEMAINE_NOMBRE (400) | Attention, le nombre de dossier ne correspond pas aux semaines (legacy) | RG-REC-147 |
| REC_NB_SEMAINE (400) | Attention, le nombre de semaine ne correspond pas aux semaines (legacy) | RG-REC-147 |
| REC_QTE_NEGATIVE (400) | La quantité doit être supérieure ou égale à 0. (proposé) | RG-REC-023, 057 |
| REC_REBUT_SUPERIEUR_STOCK (422) | Le rebut dépasse le stock disponible. (proposé) | RG-REC-064 |
| REC_PHOTO_INVALIDE (400) | Format ou taille de photo non accepté. (proposé) | RG-REC-027 |
| REC_REFERENTIEL_INCONNU (422) | Valeur absente du référentiel : à ajouter par l'administrateur. (proposé) | RG-REC-035 |
| REC_ACCES_REFUSE (403) | Vous n'avez pas le droit d'effectuer cette action. (proposé) | RG-REC-002 |
| REC_VALIDATION_RESERVEE (403) | Aucune validation sans la Coordination : à confirmer dans Pré-production › Validation admin et Instruction OK, sans attendre la préparation. | RG-REC-003 |
| REC_PERIMETRE_INTERDIT (403) | Cette plateforme n'est pas dans votre périmètre. (proposé) | RG-REC-001 |
| REC_CONFLIT_VERSION (409) | Cet élément a été modifié par un autre utilisateur : rechargez la page. (proposé) | RG-REC-009 |
| REC_IDEMPOTENCE_CONFLIT (409) | Même clé d'idempotence avec une requête différente. (proposé) | RG-REC-008 |
| REC_CONTROLE_DEJA_FAIT (409) | Ce contrôle est déjà validé. (proposé) | RG-REC-070 |
| REC_CONTROLE_INTERDIT_A_IDENTIFIER (409) | Cette réception est à identifier : rattachez d'abord un dossier. (proposé) | RG-REC-071 |
| REC_FEUILLE_DEFINITIVE_IMPOSSIBLE (409) | Pas de feuille définitive sans dossier. (proposé) | RG-REC-084 |
| REC_AFFICHE_FUSIONNEE_LECTURE_SEULE (409) | Affiche fusionnée (héritée) : lecture seule. (proposé) | RG-REC-169 |
| REC_ERREUR_INTERNE (500) | Une erreur est survenue, merci de contacter le support (texte legacy repris) | RG-REC-046 |
| MSG_AUCUNE_RECEPTION_ATTENDUE | Aucune réception attendue à proposer sur ce site. | RG-REC-014, 029 |
| MSG_TABLEAU_VIDE | Aucune ligne pour ces filtres. | RG-REC-014, 121 |
| MSG_SAS_VIDE | Aucune palette à contrôler : le sas est vide. | RG-REC-053 |
| MSG_DEJA_AU_PANIER | Ce visuel est déjà au panier. | RG-REC-021 |
| MSG_PANIER_AJOUT | n ligne(s) ajoutée(s) au panier. | RG-REC-021 |
| MSG_VISUEL_RECONNU | Visuel reconnu : 1 ligne au panier ; la photo de l'affiche est jointe à la réception. | RG-REC-031 |
| MSG_BL_PRE_REMPLI | n ligne(s) du BL au panier, cochées pour ce BL… ; bon de livraison pré-rempli : vérifiez, puis validez la réception. | RG-REC-028 |
| MSG_RECEPTION_VALIDEE | Réception R… : n ligne(s), « affiche reçue » = oui dès l'arrivée ; n unité(s) prête(s) à produire. La palette passe à l'étape 2 (contrôle). Validation admin : n rattachement(s) proposé(s) à confirmer, n avec un doute… (Coordination). | RG-REC-038 |
| MSG_INCONNUE_CREEE | Réception inconnue R… : affiche n rangée en X-n. La Coordination est prévenue (Pilotage › Alertes). | RG-REC-099 |
| MSG_RATTACHEE | Affiche n° rattachée. n unité(s) passent « Prêt ». La palette R… passe dans le sas de Réception des affiches : la réception valide le contrôle et imprime la feuille définitive. | RG-REC-109 |
| MSG_SIGNALEMENT | Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… | RG-REC-112 |
| MSG_THEME_CORRIGE | Thème corrigé : feuille de stock à refaire. | RG-REC-135 |
| MSG_PALETTES_RETARD | n palette(s) dans le sas depuis plus de 24 h — À contrôler en premier : elles sont en tête de liste. | RG-REC-055 |
| MSG_COMPTAGE_MORCEAU | Comptage par morceau (4 morceaux par affiche) | RG-REC-060 |
| MSG_PURGE | n réception(s) attendue(s) purgée(s). | RG-REC-181 |
| MSG_IMPRESSION | n feuille(s) (…) [et n étiquette(s) rack] envoyées à l'imprimante. | RG-REC-085 |
| MSG_CONFIRMATION_REBUS_LEGACY | Confirmez-vous le vidage du rebus ? (legacy) | RG-REC-158 |
| MSG_ALERTE_QTE_BC_LEGACY | La quantité reçue ne correspondent pas à la quantité BC (legacy, non reprise) | RG-REC-175 |
| MSG_FUSION_OK_LEGACY | La fusion a été effectuée avec succes ! (legacy, non reprise) | RG-REC-167 |
