-- AlterTable
ALTER TABLE "instruction_train" ADD COLUMN "exporte_le" DATETIME;
ALTER TABLE "instruction_train" ADD COLUMN "exporte_par_id" INTEGER;

-- CreateTable
CREATE TABLE "export_trains" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dep_annee" INTEGER NOT NULL,
    "dep_semaine" INTEGER NOT NULL,
    "nature" TEXT NOT NULL,
    "simulation" BOOLEAN NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "nb_dossiers" INTEGER NOT NULL,
    "nb_trains" INTEGER NOT NULL,
    "nb_faces" INTEGER NOT NULL,
    "par_id" INTEGER NOT NULL,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tf_train_export" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "export_id" INTEGER NOT NULL,
    "train_id" TEXT NOT NULL,
    "ate_id" INTEGER,
    "afficheur" TEXT,
    "destinataire" TEXT,
    "nb_contrats" INTEGER NOT NULL,
    "contrats" TEXT NOT NULL,
    CONSTRAINT "tf_train_export_export_id_fkey" FOREIGN KEY ("export_id") REFERENCES "export_trains" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "generation_fichiers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lot" TEXT NOT NULL,
    "ate_id" INTEGER,
    "dep_annee" INTEGER NOT NULL,
    "dep_semaine" INTEGER NOT NULL,
    "trains" TEXT NOT NULL,
    "nb_trains" INTEGER NOT NULL,
    "nb_tiroirs" INTEGER NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "par_id" INTEGER NOT NULL,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoye_le" DATETIME,
    "envoye_par_id" INTEGER
);

-- CreateIndex
CREATE INDEX "export_trains_dep_annee_dep_semaine_idx" ON "export_trains"("dep_annee", "dep_semaine");

-- CreateIndex
CREATE INDEX "tf_train_export_export_id_idx" ON "tf_train_export"("export_id");

-- CreateIndex
CREATE INDEX "tf_train_export_train_id_idx" ON "tf_train_export"("train_id");

-- CreateIndex
CREATE UNIQUE INDEX "generation_fichiers_lot_key" ON "generation_fichiers"("lot");

-- CreateIndex
CREATE INDEX "generation_fichiers_dep_annee_dep_semaine_idx" ON "generation_fichiers"("dep_annee", "dep_semaine");
