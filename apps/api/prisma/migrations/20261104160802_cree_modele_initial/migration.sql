-- CreateTable
CREATE TABLE "utilisateur" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "identifiant_externe" TEXT NOT NULL,
    "nom" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "role" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "utilisateur_role" (
    "utilisateur_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("utilisateur_id", "role_id"),
    CONSTRAINT "utilisateur_role_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "utilisateur_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "permission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    PRIMARY KEY ("role_id", "permission_id"),
    CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "utilisateur_perimetre" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "utilisateur_id" INTEGER NOT NULL,
    "plateforme_id" INTEGER NOT NULL,
    "atelier_id" INTEGER,
    CONSTRAINT "utilisateur_perimetre_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "utilisateur_perimetre_plateforme_id_fkey" FOREIGN KEY ("plateforme_id") REFERENCES "tr_plateforme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "utilisateur_perimetre_atelier_id_fkey" FOREIGN KEY ("atelier_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tr_plateforme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "plt_adr_1" TEXT,
    "plt_adr_2" TEXT,
    "plt_postal" TEXT,
    "plt_localite" TEXT,
    "plt_tel" TEXT,
    "plt_mail" TEXT,
    "id_site_ccf" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tr_atelier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plt_id" INTEGER NOT NULL,
    "ate_lib" TEXT NOT NULL,
    "ate_code_amt" INTEGER,
    "ate_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tr_atelier_plt_id_fkey" FOREIGN KEY ("plt_id") REFERENCES "tr_plateforme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tr_categorie_support" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sup_nom" TEXT NOT NULL,
    "sup_bandeaux" INTEGER NOT NULL DEFAULT 0,
    "sup_poids" DECIMAL,
    "sup_qte_UM" INTEGER,
    "reception" BOOLEAN NOT NULL DEFAULT false,
    "est_deroulant" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "surface" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "libelle" TEXT NOT NULL,
    "valeur" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "type_preparation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "libelle" TEXT NOT NULL,
    "id_categorie_preparation" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tr_atelier_droit_prepa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ate_id" INTEGER NOT NULL,
    "tpr_id" INTEGER,
    "id_surface" INTEGER,
    "exclusion" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tr_atelier_droit_prepa_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tr_atelier_droit_prepa_tpr_id_fkey" FOREIGN KEY ("tpr_id") REFERENCES "type_preparation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tr_atelier_droit_prepa_id_surface_fkey" FOREIGN KEY ("id_surface") REFERENCES "surface" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tr_instruction_plus" (
    "tip_ins_code" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tip_ins_lib" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tr_jour_depart" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "libelle" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tr_parametre_alternance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "est_inclus" BOOLEAN NOT NULL,
    "est_actif" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tr_imprimeur" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tr_transposteur_reception" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tr_rouleur" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ate_id" INTEGER,
    "nom" TEXT NOT NULL,
    "date_fin" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tr_rouleur_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tr_destinataire" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dest_nom_ori" TEXT NOT NULL,
    "dest_nom" TEXT,
    "dest_actif" BOOLEAN NOT NULL DEFAULT true,
    "dest_dispatch" TEXT,
    "des_id" BIGINT,
    "des_type" INTEGER,
    "des_mail" TEXT,
    "des_NumTel" TEXT,
    "des_PexId" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "parametre" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cle" TEXT NOT NULL,
    "plateforme_id" INTEGER,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "parametre_plateforme_id_fkey" FOREIGN KEY ("plateforme_id") REFERENCES "tr_plateforme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "par_id" INTEGER,
    "type_entite" TEXT NOT NULL,
    "entite_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ancienne_valeur" TEXT,
    "nouvelle_valeur" TEXT,
    "complement" TEXT,
    "donnees" TEXT,
    CONSTRAINT "journal_audit_par_id_fkey" FOREIGN KEY ("par_id") REFERENCES "utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "statut_historique" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type_entite" TEXT NOT NULL,
    "entite_id" TEXT NOT NULL,
    "ancien" TEXT,
    "nouveau" TEXT NOT NULL,
    "par_id" INTEGER,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motif" TEXT,
    "regle" TEXT,
    CONSTRAINT "statut_historique_par_id_fkey" FOREIGN KEY ("par_id") REFERENCES "utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cle_idempotence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cle" TEXT NOT NULL,
    "utilisateur_id" INTEGER NOT NULL,
    "methode" TEXT NOT NULL,
    "chemin" TEXT NOT NULL,
    "empreinte" TEXT NOT NULL,
    "statut_http" INTEGER,
    "reponse" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expire_le" DATETIME NOT NULL,
    CONSTRAINT "cle_idempotence_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "image_mime_type" TEXT,
    "image_file" BLOB,
    "intitule" TEXT,
    "size" INTEGER,
    "extension" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER
);

-- CreateTable
CREATE TABLE "livraison" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "DateLivraison" DATETIME,
    "imprimeur_id" INTEGER,
    "livreur_id" INTEGER,
    "Reference" TEXT,
    "Nbre_colis" INTEGER,
    "Ref_dossier" TEXT,
    "Ref_DA" TEXT,
    "Decharge_par" TEXT,
    "commentaire" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    CONSTRAINT "livraison_imprimeur_id_fkey" FOREIGN KEY ("imprimeur_id") REFERENCES "tr_imprimeur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "livraison_livreur_id_fkey" FOREIGN KEY ("livreur_id") REFERENCES "tr_transposteur_reception" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reception" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plateforme_id" INTEGER NOT NULL,
    "livraison_id" INTEGER,
    "statut" TEXT NOT NULL,
    "date_arrivee" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "controle_le" DATETIME,
    "controleur_nom" TEXT,
    "signale_le" DATETIME,
    "photo_bl_id" INTEGER,
    "commentaire" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    CONSTRAINT "reception_plateforme_id_fkey" FOREIGN KEY ("plateforme_id") REFERENCES "tr_plateforme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reception_livraison_id_fkey" FOREIGN KEY ("livraison_id") REFERENCES "livraison" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reception_photo_bl_id_fkey" FOREIGN KEY ("photo_bl_id") REFERENCES "photo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "affiche" (
    "affiche_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plt_id" INTEGER NOT NULL,
    "sup_id" INTEGER NOT NULL,
    "reception_id" INTEGER,
    "photo_id" INTEGER,
    "statut" TEXT NOT NULL,
    "date_entree" DATETIME NOT NULL,
    "commentaire" TEXT,
    "cont_num" INTEGER,
    "cont_annonc" TEXT,
    "theme" TEXT,
    "repiquage" TEXT,
    "conservation" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "date_dernier_depart" DATETIME,
    "date_derniere_sortie" DATETIME,
    "allee" TEXT,
    "rayon" TEXT,
    "a_conserver" BOOLEAN NOT NULL DEFAULT false,
    "type_feuille" TEXT,
    "feuille_a_refaire" BOOLEAN NOT NULL DEFAULT false,
    "validation_admin" BOOLEAN NOT NULL DEFAULT false,
    "validation_admin_par_id" INTEGER,
    "validation_admin_le" DATETIME,
    "mode_rattachement" TEXT,
    "rebus" BOOLEAN NOT NULL DEFAULT false,
    "date_rebus" DATETIME,
    "zone_Picking" BOOLEAN NOT NULL DEFAULT false,
    "est_fusionne" BOOLEAN NOT NULL DEFAULT false,
    "envoye" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "date_creation" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_maj" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    CONSTRAINT "affiche_plt_id_fkey" FOREIGN KEY ("plt_id") REFERENCES "tr_plateforme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "affiche_sup_id_fkey" FOREIGN KEY ("sup_id") REFERENCES "tr_categorie_support" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "affiche_reception_id_fkey" FOREIGN KEY ("reception_id") REFERENCES "reception" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "affiche_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asso_livraison_affiche" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "Id_livraison" INTEGER NOT NULL,
    "Id_affiche_livraison" INTEGER NOT NULL,
    "id_affiche_initial_livraison" INTEGER,
    "NumeroLivraison" INTEGER,
    CONSTRAINT "asso_livraison_affiche_Id_livraison_fkey" FOREIGN KEY ("Id_livraison") REFERENCES "livraison" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asso_livraison_affiche_Id_affiche_livraison_fkey" FOREIGN KEY ("Id_affiche_livraison") REFERENCES "affiche" ("affiche_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asso_livraison_affiche_id_affiche_initial_livraison_fkey" FOREIGN KEY ("id_affiche_initial_livraison") REFERENCES "affiche" ("affiche_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asso_livraison_photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "photo_id" INTEGER NOT NULL,
    "livraison_Id" INTEGER NOT NULL,
    "intitule" TEXT,
    CONSTRAINT "asso_livraison_photo_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asso_livraison_photo_livraison_Id_fkey" FOREIGN KEY ("livraison_Id") REFERENCES "livraison" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mouvement" (
    "mouvement_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "affiche_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantite" INTEGER NOT NULL,
    "recepisse" TEXT,
    "expediteur" TEXT,
    "comptee" BOOLEAN NOT NULL DEFAULT false,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "motif" TEXT,
    "livraison_id" INTEGER,
    "reception_id" INTEGER,
    "id_affiche_initial" INTEGER,
    "IdActivite" INTEGER,
    "date_creation" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    CONSTRAINT "mouvement_affiche_id_fkey" FOREIGN KEY ("affiche_id") REFERENCES "affiche" ("affiche_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mouvement_id_affiche_initial_fkey" FOREIGN KEY ("id_affiche_initial") REFERENCES "affiche" ("affiche_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mouvement_livraison_id_fkey" FOREIGN KEY ("livraison_id") REFERENCES "livraison" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mouvement_reception_id_fkey" FOREIGN KEY ("reception_id") REFERENCES "reception" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fusion_affiche" (
    "id_fusion_affiche" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_affiche_chapeau" INTEGER NOT NULL,
    "id_affiche" INTEGER NOT NULL,
    "qui_creation" TEXT,
    "date_creation" DATETIME,
    CONSTRAINT "fusion_affiche_id_affiche_chapeau_fkey" FOREIGN KEY ("id_affiche_chapeau") REFERENCES "affiche" ("affiche_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fusion_affiche_id_affiche_fkey" FOREIGN KEY ("id_affiche") REFERENCES "affiche" ("affiche_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tf_dossier_semaine_depart" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "IdAffiche" INTEGER NOT NULL,
    "Dossier" INTEGER,
    "Semaine" INTEGER NOT NULL,
    "Annee" INTEGER NOT NULL,
    CONSTRAINT "tf_dossier_semaine_depart_IdAffiche_fkey" FOREIGN KEY ("IdAffiche") REFERENCES "affiche" ("affiche_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tf_prepa_affiche" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plt_id" INTEGER NOT NULL,
    "sup_id" INTEGER NOT NULL,
    "ate_id" INTEGER,
    "cont_num" INTEGER,
    "Format" TEXT,
    "Description" TEXT,
    "rpc_annonceur" TEXT,
    "rpc_num_aff_amt" INTEGER,
    "rpc_theme" TEXT,
    "theme_cle" TEXT,
    "repiquage" TEXT,
    "IdDAChapeau" INTEGER,
    "IdThemeBandeau" INTEGER,
    "sem_num" INTEGER NOT NULL,
    "sem_annee" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "etat_ligne" TEXT NOT NULL DEFAULT 'ACTIVE',
    "statut" TEXT NOT NULL DEFAULT 'ATTENDUE',
    "qte_bc" INTEGER,
    "qte_prepa" INTEGER,
    "date_vue_bc" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "dateCreated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    CONSTRAINT "tf_prepa_affiche_plt_id_fkey" FOREIGN KEY ("plt_id") REFERENCES "tr_plateforme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_prepa_affiche_sup_id_fkey" FOREIGN KEY ("sup_id") REFERENCES "tr_categorie_support" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_prepa_affiche_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asso_affiche_visuel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "affiche_id" INTEGER NOT NULL,
    "ligne_attendue_id" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL,
    "cree_par_id" INTEGER,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retire_par_id" INTEGER,
    "retire_le" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "asso_affiche_visuel_affiche_id_fkey" FOREIGN KEY ("affiche_id") REFERENCES "affiche" ("affiche_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asso_affiche_visuel_ligne_attendue_id_fkey" FOREIGN KEY ("ligne_attendue_id") REFERENCES "tf_prepa_affiche" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tf_prepa_Broadcast" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "IdSiteCCF" INTEGER,
    "DestinataireEffectif" TEXT,
    "IdDossierDeVenteChapeau" INTEGER,
    "IdDAChapeau" INTEGER,
    "IdPreparationChapeau" INTEGER,
    "IdSurface" INTEGER,
    "IdFormat" INTEGER,
    "IdTypePreparation" INTEGER,
    "Annonceur" TEXT,
    "Surface" TEXT,
    "Format" TEXT,
    "AssistantCommercial" TEXT,
    "AssistantLogistique" TEXT,
    "Theme" TEXT,
    "IdTheme" INTEGER,
    "Bandeau" TEXT,
    "IdThemeBandeau" INTEGER,
    "quantite" INTEGER,
    "EstResteEnPlace" BOOLEAN NOT NULL DEFAULT false,
    "StatutPreparation" TEXT,
    "repiquage" TEXT,
    "sem_num" INTEGER,
    "sem_annee" INTEGER,
    "sup_id" INTEGER,
    "date_vue" DATETIME,
    "dateCreated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "dossier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cont_num" INTEGER NOT NULL,
    "annonceur" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'A_TRAITER',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER
);

-- CreateTable
CREATE TABLE "instruction_train" (
    "instr_code" TEXT NOT NULL PRIMARY KEY,
    "dossier_id" INTEGER,
    "ate_id" INTEGER,
    "statut" TEXT NOT NULL,
    "tip_ins_code" INTEGER,
    "instr_type_instruction" TEXT,
    "rese_ident" INTEGER,
    "cont_num" INTEGER,
    "instr_annonceur" TEXT,
    "cont_anbas" INTEGER,
    "cont_sembas" INTEGER,
    "instr_commentaire" TEXT,
    "instr_entretien" INTEGER,
    "instr_CommentExtPlay" TEXT,
    "Conservation" INTEGER,
    "CoteCote" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "instr_dat_cre" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instr_dat_maj" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    CONSTRAINT "instruction_train_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "instruction_train_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "instruction_train_tip_ins_code_fkey" FOREIGN KEY ("tip_ins_code") REFERENCES "tr_instruction_plus" ("tip_ins_code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "instruction_detail" (
    "insd_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instr_code" TEXT NOT NULL,
    "insd_cadr_ident" INTEGER,
    "insd_cadre_lib" TEXT,
    "sup_id" INTEGER,
    "tpr_id" INTEGER,
    "insd_afch_ident" INTEGER,
    "insd_theme" TEXT,
    "insd_repiquage_ident" INTEGER,
    "insd_repiquage" TEXT,
    "insd_type" TEXT,
    "insd_dat_cre" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ins_dat_maj" DATETIME NOT NULL,
    CONSTRAINT "instruction_detail_instr_code_fkey" FOREIGN KEY ("instr_code") REFERENCES "instruction_train" ("instr_code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "instruction_detail_sup_id_fkey" FOREIGN KEY ("sup_id") REFERENCES "tr_categorie_support" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "instruction_detail_tpr_id_fkey" FOREIGN KEY ("tpr_id") REFERENCES "type_preparation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "instruction_visuels" (
    "insv_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instr_code" TEXT NOT NULL,
    "sup_id" INTEGER,
    "tpr_id" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'A_TRAITER',
    "insv_afch_ident" INTEGER,
    "insv_theme" TEXT,
    "insv_theme_ori" TEXT,
    "insv_pourcentage" DECIMAL,
    "insv_pourcentage_ori" DECIMAL,
    "insv_dat_cre" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "insv_dat_maj" DATETIME NOT NULL,
    CONSTRAINT "instruction_visuels_instr_code_fkey" FOREIGN KEY ("instr_code") REFERENCES "instruction_train" ("instr_code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "instruction_visuels_sup_id_fkey" FOREIGN KEY ("sup_id") REFERENCES "tr_categorie_support" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "instruction_visuels_tpr_id_fkey" FOREIGN KEY ("tpr_id") REFERENCES "type_preparation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tf_face_train" (
    "ft_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instr_code" TEXT NOT NULL,
    "insv_id" INTEGER,
    "dest_id" INTEGER,
    "statut" TEXT NOT NULL,
    "ate_id" INTEGER,
    "sup_id" INTEGER,
    "rouleur_id" INTEGER,
    "IdJourDepart" INTEGER,
    "cadr_ident" INTEGER NOT NULL,
    "cadre_lib" TEXT,
    "rdep_datdep" DATETIME NOT NULL,
    "cont_num" INTEGER,
    "cont_annonc" TEXT,
    "cont_sembas" INTEGER,
    "cont_anbas" INTEGER,
    "dep_sembas" INTEGER,
    "dep_anbas" INTEGER,
    "train_id" TEXT,
    "train" INTEGER,
    "rang" INTEGER,
    "ordre_propose" INTEGER,
    "ordre_reel" INTEGER,
    "ordre_calcule" INTEGER,
    "ordre_reel_initial" INTEGER,
    "theme" TEXT,
    "theme_id" INTEGER,
    "repiquage" TEXT,
    "repiquage_id" INTEGER,
    "ft_type" TEXT,
    "version_train" INTEGER,
    "pre_assemblage" BOOLEAN NOT NULL DEFAULT false,
    "Conservation" INTEGER,
    "CoteCote" INTEGER,
    "colis_id" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ft_dat_cre" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ft_dat_maj" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    CONSTRAINT "tf_face_train_instr_code_fkey" FOREIGN KEY ("instr_code") REFERENCES "instruction_train" ("instr_code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_face_train_insv_id_fkey" FOREIGN KEY ("insv_id") REFERENCES "instruction_visuels" ("insv_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_face_train_dest_id_fkey" FOREIGN KEY ("dest_id") REFERENCES "tr_destinataire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_face_train_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_face_train_sup_id_fkey" FOREIGN KEY ("sup_id") REFERENCES "tr_categorie_support" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_face_train_rouleur_id_fkey" FOREIGN KEY ("rouleur_id") REFERENCES "tr_rouleur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_face_train_IdJourDepart_fkey" FOREIGN KEY ("IdJourDepart") REFERENCES "tr_jour_depart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tf_repart_calcul" (
    "rpc_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sup_id" INTEGER,
    "ate_id" INTEGER,
    "tpr_id" INTEGER,
    "dest_id" INTEGER,
    "UM_id" INTEGER,
    "statut" TEXT NOT NULL,
    "sem_num" INTEGER,
    "sem_annee" INTEGER,
    "des_id" BIGINT,
    "des_type" INTEGER,
    "des_type_adr" INTEGER,
    "rpc_type" INTEGER,
    "rpc_repartition" BIGINT,
    "rpc_annonceur" TEXT,
    "rpc_theme" TEXT,
    "rpc_repiquage" TEXT,
    "rpc_repiquageId" INTEGER,
    "rpc_num_aff_amt" BIGINT,
    "rpc_qte" INTEGER,
    "rpc_dat_aff" DATETIME,
    "cont_num" INTEGER,
    "numeroReception" TEXT,
    "rpc_retire" BOOLEAN NOT NULL DEFAULT false,
    "IdPreparationDetail" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rpc_dat_cre" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rpc_dat_maj" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    CONSTRAINT "tf_repart_calcul_sup_id_fkey" FOREIGN KEY ("sup_id") REFERENCES "tr_categorie_support" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_repart_calcul_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_repart_calcul_tpr_id_fkey" FOREIGN KEY ("tpr_id") REFERENCES "type_preparation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_repart_calcul_dest_id_fkey" FOREIGN KEY ("dest_id") REFERENCES "tr_destinataire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_repart_calcul_UM_id_fkey" FOREIGN KEY ("UM_id") REFERENCES "tf_UM" ("UM_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tf_UM" (
    "UM_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tpr_id" INTEGER,
    "ate_id" INTEGER,
    "sup_id" INTEGER,
    "dest_id" INTEGER,
    "statut" TEXT NOT NULL,
    "sem_num" INTEGER,
    "sem_annee" INTEGER,
    "UM_repartition" BIGINT,
    "UM_annonceur" TEXT,
    "UM_theme" TEXT,
    "UM_Repiquage" TEXT,
    "UM_num_aff_amt" BIGINT,
    "UM_qte" INTEGER,
    "cont_num" INTEGER,
    "UM_poids" DECIMAL,
    "UM_code_barre" TEXT,
    "UM_code_synthese" TEXT,
    "UM_comment" TEXT,
    "UM_date_aff" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "UM_dat_cre" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UM_dat_maj" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    CONSTRAINT "tf_UM_tpr_id_fkey" FOREIGN KEY ("tpr_id") REFERENCES "type_preparation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_UM_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_UM_sup_id_fkey" FOREIGN KEY ("sup_id") REFERENCES "tr_categorie_support" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_UM_dest_id_fkey" FOREIGN KEY ("dest_id") REFERENCES "tr_destinataire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_identifiant_externe_key" ON "utilisateur"("identifiant_externe");

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");

-- CreateIndex
CREATE INDEX "utilisateur_perimetre_plateforme_id_idx" ON "utilisateur_perimetre"("plateforme_id");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_perimetre_utilisateur_id_plateforme_id_atelier_id_key" ON "utilisateur_perimetre"("utilisateur_id", "plateforme_id", "atelier_id");

-- CreateIndex
CREATE INDEX "tr_atelier_plt_id_idx" ON "tr_atelier"("plt_id");

-- CreateIndex
CREATE UNIQUE INDEX "tr_atelier_droit_prepa_ate_id_tpr_id_id_surface_key" ON "tr_atelier_droit_prepa"("ate_id", "tpr_id", "id_surface");

-- CreateIndex
CREATE UNIQUE INDEX "parametre_cle_plateforme_id_key" ON "parametre"("cle", "plateforme_id");

-- CreateIndex
CREATE INDEX "journal_audit_type_entite_entite_id_idx" ON "journal_audit"("type_entite", "entite_id");

-- CreateIndex
CREATE INDEX "journal_audit_le_idx" ON "journal_audit"("le");

-- CreateIndex
CREATE INDEX "statut_historique_type_entite_entite_id_idx" ON "statut_historique"("type_entite", "entite_id");

-- CreateIndex
CREATE INDEX "cle_idempotence_expire_le_idx" ON "cle_idempotence"("expire_le");

-- CreateIndex
CREATE UNIQUE INDEX "cle_idempotence_utilisateur_id_cle_key" ON "cle_idempotence"("utilisateur_id", "cle");

-- CreateIndex
CREATE INDEX "livraison_Reference_idx" ON "livraison"("Reference");

-- CreateIndex
CREATE UNIQUE INDEX "reception_livraison_id_key" ON "reception"("livraison_id");

-- CreateIndex
CREATE INDEX "reception_plateforme_id_statut_idx" ON "reception"("plateforme_id", "statut");

-- CreateIndex
CREATE INDEX "reception_date_arrivee_idx" ON "reception"("date_arrivee");

-- CreateIndex
CREATE INDEX "affiche_plt_id_statut_idx" ON "affiche"("plt_id", "statut");

-- CreateIndex
CREATE INDEX "affiche_plt_id_sup_id_idx" ON "affiche"("plt_id", "sup_id");

-- CreateIndex
CREATE INDEX "affiche_cont_num_idx" ON "affiche"("cont_num");

-- CreateIndex
CREATE INDEX "affiche_reception_id_idx" ON "affiche"("reception_id");

-- CreateIndex
CREATE UNIQUE INDEX "asso_livraison_affiche_Id_livraison_Id_affiche_livraison_key" ON "asso_livraison_affiche"("Id_livraison", "Id_affiche_livraison");

-- CreateIndex
CREATE UNIQUE INDEX "asso_livraison_photo_livraison_Id_photo_id_key" ON "asso_livraison_photo"("livraison_Id", "photo_id");

-- CreateIndex
CREATE INDEX "mouvement_affiche_id_date_idx" ON "mouvement"("affiche_id", "date");

-- CreateIndex
CREATE INDEX "mouvement_reception_id_idx" ON "mouvement"("reception_id");

-- CreateIndex
CREATE UNIQUE INDEX "fusion_affiche_id_affiche_chapeau_id_affiche_key" ON "fusion_affiche"("id_affiche_chapeau", "id_affiche");

-- CreateIndex
CREATE UNIQUE INDEX "tf_dossier_semaine_depart_IdAffiche_Dossier_Annee_Semaine_key" ON "tf_dossier_semaine_depart"("IdAffiche", "Dossier", "Annee", "Semaine");

-- CreateIndex
CREATE INDEX "tf_prepa_affiche_plt_id_sem_annee_sem_num_idx" ON "tf_prepa_affiche"("plt_id", "sem_annee", "sem_num");

-- CreateIndex
CREATE INDEX "tf_prepa_affiche_cont_num_idx" ON "tf_prepa_affiche"("cont_num");

-- CreateIndex
CREATE INDEX "tf_prepa_affiche_etat_ligne_statut_idx" ON "tf_prepa_affiche"("etat_ligne", "statut");

-- CreateIndex
CREATE INDEX "asso_affiche_visuel_affiche_id_actif_idx" ON "asso_affiche_visuel"("affiche_id", "actif");

-- CreateIndex
CREATE INDEX "asso_affiche_visuel_ligne_attendue_id_actif_idx" ON "asso_affiche_visuel"("ligne_attendue_id", "actif");

-- CreateIndex
CREATE INDEX "tf_prepa_Broadcast_IdDossierDeVenteChapeau_idx" ON "tf_prepa_Broadcast"("IdDossierDeVenteChapeau");

-- CreateIndex
CREATE INDEX "tf_prepa_Broadcast_sem_annee_sem_num_idx" ON "tf_prepa_Broadcast"("sem_annee", "sem_num");

-- CreateIndex
CREATE UNIQUE INDEX "dossier_cont_num_key" ON "dossier"("cont_num");

-- CreateIndex
CREATE INDEX "dossier_statut_idx" ON "dossier"("statut");

-- CreateIndex
CREATE INDEX "instruction_train_statut_idx" ON "instruction_train"("statut");

-- CreateIndex
CREATE INDEX "instruction_train_cont_num_cont_sembas_cont_anbas_idx" ON "instruction_train"("cont_num", "cont_sembas", "cont_anbas");

-- CreateIndex
CREATE INDEX "instruction_train_ate_id_statut_idx" ON "instruction_train"("ate_id", "statut");

-- CreateIndex
CREATE INDEX "instruction_detail_instr_code_idx" ON "instruction_detail"("instr_code");

-- CreateIndex
CREATE INDEX "instruction_visuels_instr_code_idx" ON "instruction_visuels"("instr_code");

-- CreateIndex
CREATE INDEX "tf_face_train_instr_code_idx" ON "tf_face_train"("instr_code");

-- CreateIndex
CREATE INDEX "tf_face_train_statut_ate_id_idx" ON "tf_face_train"("statut", "ate_id");

-- CreateIndex
CREATE INDEX "tf_face_train_train_id_idx" ON "tf_face_train"("train_id");

-- CreateIndex
CREATE INDEX "tf_face_train_cont_num_idx" ON "tf_face_train"("cont_num");

-- CreateIndex
CREATE INDEX "tf_repart_calcul_statut_ate_id_idx" ON "tf_repart_calcul"("statut", "ate_id");

-- CreateIndex
CREATE INDEX "tf_repart_calcul_sem_annee_sem_num_idx" ON "tf_repart_calcul"("sem_annee", "sem_num");

-- CreateIndex
CREATE INDEX "tf_repart_calcul_cont_num_idx" ON "tf_repart_calcul"("cont_num");

-- CreateIndex
CREATE UNIQUE INDEX "tf_UM_UM_code_barre_key" ON "tf_UM"("UM_code_barre");

-- CreateIndex
CREATE INDEX "tf_UM_statut_ate_id_idx" ON "tf_UM"("statut", "ate_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- Index uniques PARTIELS (SQL brut : Prisma ne sait pas les exprimer).
-- À CONSERVER dans les migrations suivantes : `prisma migrate dev` générera des DROP INDEX
-- pour ces index, à retirer à la relecture du SQL (skill circe-migration-prisma, étape 4).
-- Vérifiés par apps/api/test/modele-donnees.int.test.ts.
-- ─────────────────────────────────────────────────────────────────────────────

-- Q-305 / RG-COO-080 : une seule ligne attendue ACTIVE par plateforme × dossier × support × thème
-- (normalisé, Q-208) × bandeau × semaine ISO. COALESCE : NULL traité comme une valeur (SQLite
-- considère deux NULL comme distincts dans un index unique) ; couvre aussi les lignes sans thème.
CREATE UNIQUE INDEX "tf_prepa_affiche_ligne_active_cle_key"
ON "tf_prepa_affiche" (
    "plt_id",
    COALESCE("cont_num", 0),
    "sup_id",
    COALESCE("theme_cle", ''),
    COALESCE("IdThemeBandeau", 0),
    "sem_annee",
    "sem_num"
)
WHERE "etat_ligne" = 'ACTIVE';

-- Q-306 / RG-REC-137 : un seul lien ACTIF entre une affiche et une ligne attendue
-- (un lien retiré n'est jamais réactivé : un nouveau lien est créé).
CREATE UNIQUE INDEX "asso_affiche_visuel_lien_actif_key"
ON "asso_affiche_visuel" ("affiche_id", "ligne_attendue_id")
WHERE "actif" = 1;

-- Q-337 : un paramètre global (plateforme NULL) est unique par clé.
CREATE UNIQUE INDEX "parametre_cle_globale_key"
ON "parametre" ("cle")
WHERE "plateforme_id" IS NULL;

-- Périmètre utilisateur sans atelier : unique par (utilisateur, plateforme).
CREATE UNIQUE INDEX "utilisateur_perimetre_sans_atelier_key"
ON "utilisateur_perimetre" ("utilisateur_id", "plateforme_id")
WHERE "atelier_id" IS NULL;
