-- AlterTable
ALTER TABLE "instruction_train" ADD COLUMN "iok_le" DATETIME;
ALTER TABLE "instruction_train" ADD COLUMN "iok_mode" TEXT;
ALTER TABLE "instruction_train" ADD COLUMN "iok_par_id" INTEGER;

-- CreateTable
CREATE TABLE "demande_correction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dossier_id" INTEGER NOT NULL,
    "note" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ENVOYEE',
    "mail_envoye" BOOLEAN NOT NULL DEFAULT false,
    "par_id" INTEGER NOT NULL,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "faite_le" DATETIME,
    CONSTRAINT "demande_correction_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "demande_correction_dossier_id_idx" ON "demande_correction"("dossier_id");

