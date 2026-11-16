-- COO-P11 : poste du rouleur (RG-COO-297), bagues (RG-COO-299 à 302), suivi 8 m² (RG-COO-237).
-- ALTER / CREATE seulement.

-- AlterTable
ALTER TABLE "tr_rouleur" ADD COLUMN "poste" TEXT;

-- CreateTable
CREATE TABLE "bague" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "train_id" TEXT NOT NULL,
    "ate_id" INTEGER,
    "rouleur_id" INTEGER,
    "textes" TEXT NOT NULL,
    "modifiee" BOOLEAN NOT NULL DEFAULT false,
    "reimpressions" INTEGER NOT NULL DEFAULT 0,
    "imprimee_le" DATETIME NOT NULL,
    "imprimee_par_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bague_rouleur_id_fkey" FOREIGN KEY ("rouleur_id") REFERENCES "tr_rouleur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suivi_8m2" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plateforme_id" INTEGER NOT NULL,
    "cont_num" INTEGER NOT NULL,
    "theme_cle" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "demies_haut" INTEGER NOT NULL DEFAULT 0,
    "demies_bas" INTEGER NOT NULL DEFAULT 0,
    "finales" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "bague_train_id_key" ON "bague"("train_id");

-- CreateIndex
CREATE INDEX "bague_ate_id_idx" ON "bague"("ate_id");

-- CreateIndex
CREATE UNIQUE INDEX "suivi_8m2_plateforme_id_cont_num_theme_cle_key" ON "suivi_8m2"("plateforme_id", "cont_num", "theme_cle");
