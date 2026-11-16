-- CreateTable
CREATE TABLE "rendu_main" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ate_id" INTEGER,
    "motif" TEXT NOT NULL,
    "nb_en_production" INTEGER NOT NULL,
    "repartitions" TEXT NOT NULL,
    "dossiers" TEXT NOT NULL,
    "par_id" INTEGER NOT NULL,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "encollage_bus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plateforme_id" INTEGER NOT NULL,
    "sem_annee" INTEGER NOT NULL,
    "sem_num" INTEGER NOT NULL,
    "ajustement_global" REAL NOT NULL DEFAULT 0,
    "centres" TEXT NOT NULL DEFAULT '[]',
    "par_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- AlterTable : colonnes ajoutées par ALTER (pas de reconstruction de tf_repart_calcul)
ALTER TABLE "tf_repart_calcul" ADD COLUMN "corrigee_plateforme" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tf_repart_calcul" ADD COLUMN "rendue_le" DATETIME;

-- CreateIndex
CREATE INDEX "rendu_main_ate_id_idx" ON "rendu_main"("ate_id");

-- CreateIndex
CREATE UNIQUE INDEX "encollage_bus_plateforme_id_sem_annee_sem_num_key" ON "encollage_bus"("plateforme_id", "sem_annee", "sem_num");
