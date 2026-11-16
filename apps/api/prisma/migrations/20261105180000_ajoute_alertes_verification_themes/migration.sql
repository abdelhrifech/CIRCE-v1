-- COO-P07 (RG-COO-033, 066 à 076 ; ECR-TRA-01, ECR-THM-01 à 03) : acquittement des alertes, verdicts et demandes
-- de la vérification des thèmes. Création de tables seulement (aucune modification de l'existant).
-- CreateTable
CREATE TABLE "alerte_acquittement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cle" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "par_id" INTEGER NOT NULL,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "verification_theme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "par_id" INTEGER NOT NULL,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "demande_theme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "cont_num" INTEGER NOT NULL,
    "ancien" TEXT NOT NULL,
    "nouveau" TEXT NOT NULL,
    "note" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ENVOYEE',
    "mail_envoye" BOOLEAN NOT NULL DEFAULT false,
    "par_id" INTEGER NOT NULL,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "alerte_acquittement_cle_key" ON "alerte_acquittement"("cle");

-- CreateIndex
CREATE INDEX "verification_theme_type_cle_actif_idx" ON "verification_theme"("type", "cle", "actif");

-- CreateIndex
CREATE INDEX "demande_theme_type_cont_num_statut_idx" ON "demande_theme"("type", "cont_num", "statut");
