-- CreateTable
CREATE TABLE "tf_colis" (
    "colis_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plt_id" INTEGER NOT NULL,
    "ate_id" INTEGER NOT NULL,
    "dest_id" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "colis_format" INTEGER NOT NULL DEFAULT 5,
    "colis_code" TEXT,
    "colis_poids" DECIMAL,
    "tsp_id" INTEGER,
    "tsp_id_tarif_code" TEXT,
    "colis_code_externe" TEXT,
    "colis_comment" TEXT,
    "colis_dat_expe" DATETIME,
    "mailcolis_envoye" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "colis_dat_cre" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "colis_dat_maj" DATETIME NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    CONSTRAINT "tf_colis_plt_id_fkey" FOREIGN KEY ("plt_id") REFERENCES "tr_plateforme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_colis_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_colis_dest_id_fkey" FOREIGN KEY ("dest_id") REFERENCES "tr_destinataire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tf_UM_colis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "UM_id" INTEGER NOT NULL,
    "colis_id" INTEGER NOT NULL,
    "uc_qte" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    CONSTRAINT "tf_UM_colis_colis_id_fkey" FOREIGN KEY ("colis_id") REFERENCES "tf_colis" ("colis_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tf_UM_colis_UM_id_fkey" FOREIGN KEY ("UM_id") REFERENCES "tf_UM" ("UM_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tf_colis_colis_code_key" ON "tf_colis"("colis_code");

-- CreateIndex
CREATE INDEX "tf_colis_plt_id_statut_idx" ON "tf_colis"("plt_id", "statut");

-- CreateIndex
CREATE INDEX "tf_colis_dest_id_idx" ON "tf_colis"("dest_id");

-- CreateIndex
CREATE INDEX "tf_UM_colis_colis_id_idx" ON "tf_UM_colis"("colis_id");

-- CreateIndex
CREATE UNIQUE INDEX "tf_UM_colis_UM_id_colis_id_key" ON "tf_UM_colis"("UM_id", "colis_id");
