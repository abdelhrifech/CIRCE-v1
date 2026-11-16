-- CreateTable
CREATE TABLE "tr_adresseMail_plateforme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plt_id" INTEGER NOT NULL,
    "adresseMail" TEXT NOT NULL,
    "user_creation" INTEGER,
    "date_creation" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tr_adresseMail_plateforme_plt_id_fkey" FOREIGN KEY ("plt_id") REFERENCES "tr_plateforme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tr_atelier_imprimante" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plt_id" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tr_atelier_imprimante_plt_id_fkey" FOREIGN KEY ("plt_id") REFERENCES "tr_plateforme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "regle_alerte" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "destinataires" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "tr_adresseMail_plateforme_plt_id_adresseMail_key" ON "tr_adresseMail_plateforme"("plt_id", "adresseMail");

-- CreateIndex
CREATE UNIQUE INDEX "tr_atelier_imprimante_plt_id_nom_key" ON "tr_atelier_imprimante"("plt_id", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "regle_alerte_type_key" ON "regle_alerte"("type");
