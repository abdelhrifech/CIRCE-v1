-- COO-P06 (RG-COO-102, 103, 116, 119, 120, 122, 125, 130, 131, 132, 134) : intégration Broadcast. ALTER seulement.
-- AlterTable
ALTER TABLE "tf_face_train" ADD COLUMN "pers_ident" INTEGER;
ALTER TABLE "tf_face_train" ADD COLUMN "pers_nom" TEXT;
ALTER TABLE "tf_face_train" ADD COLUMN "ref_panel" TEXT;

-- AlterTable
ALTER TABLE "tf_repart_calcul" ADD COLUMN "IdGroupePreparation" INTEGER;

-- CreateTable
CREATE TABLE "passage_integration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "declencheur" TEXT NOT NULL,
    "par_id" INTEGER,
    "statut" TEXT NOT NULL,
    "verrou" TEXT,
    "debut" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" DATETIME,
    "message" TEXT
);

-- CreateTable
CREATE TABLE "flux_chargement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "passage_id" INTEGER NOT NULL,
    "flux" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "statut" INTEGER NOT NULL,
    "debut" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" DATETIME,
    "lues" INTEGER NOT NULL DEFAULT 0,
    "creees" INTEGER NOT NULL DEFAULT 0,
    "mises_a_jour" INTEGER NOT NULL DEFAULT 0,
    "ignorees" INTEGER NOT NULL DEFAULT 0,
    "erreurs" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "details" TEXT,
    CONSTRAINT "flux_chargement_passage_id_fkey" FOREIGN KEY ("passage_id") REFERENCES "passage_integration" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tr_destinataire_adresse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dest_id" INTEGER NOT NULL,
    "adr_1" TEXT,
    "adr_2" TEXT,
    "adr_postal" TEXT,
    "adr_localite" TEXT,
    "lieu_dit" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tr_destinataire_adresse_dest_id_fkey" FOREIGN KEY ("dest_id") REFERENCES "tr_destinataire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tr_ate_dest_trans" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dest_id" INTEGER NOT NULL,
    "ate_id" INTEGER NOT NULL,
    "trans_id" INTEGER NOT NULL,
    "tarif" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tr_ate_dest_trans_dest_id_fkey" FOREIGN KEY ("dest_id") REFERENCES "tr_destinataire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tr_ate_dest_trans_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "envoi_broadcast" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "donnees" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'A_ENVOYER',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "par_id" INTEGER,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoye_le" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "passage_integration_verrou_key" ON "passage_integration"("verrou");

-- CreateIndex
CREATE INDEX "passage_integration_debut_idx" ON "passage_integration"("debut");

-- CreateIndex
CREATE INDEX "flux_chargement_passage_id_idx" ON "flux_chargement"("passage_id");

-- CreateIndex
CREATE INDEX "tr_destinataire_adresse_dest_id_idx" ON "tr_destinataire_adresse"("dest_id");

-- CreateIndex
CREATE UNIQUE INDEX "tr_ate_dest_trans_dest_id_ate_id_key" ON "tr_ate_dest_trans"("dest_id", "ate_id");

-- CreateIndex
CREATE INDEX "envoi_broadcast_type_cle_idx" ON "envoi_broadcast"("type", "cle");

-- CreateIndex
CREATE INDEX "envoi_broadcast_statut_idx" ON "envoi_broadcast"("statut");

-- CreateIndex
CREATE INDEX "tf_repart_calcul_IdPreparationDetail_idx" ON "tf_repart_calcul"("IdPreparationDetail");

-- CreateIndex
CREATE INDEX "tr_destinataire_des_type_des_id_idx" ON "tr_destinataire"("des_type", "des_id");
