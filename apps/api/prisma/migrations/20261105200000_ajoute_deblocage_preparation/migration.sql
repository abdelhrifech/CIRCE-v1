-- COO-P08 (RG-COO-146, 149, 278) : trace des déblocages de préparation. CREATE seulement.
-- CreateTable
CREATE TABLE "deblocage_preparation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "IdGroupePreparation" INTEGER,
    "IdPreparationChapeau" INTEGER,
    "cont_num" INTEGER NOT NULL,
    "sem_annee" INTEGER NOT NULL,
    "sem_num" INTEGER NOT NULL,
    "IdSiteCCF" INTEGER,
    "plt_id" INTEGER,
    "IdSurface" INTEGER,
    "IdTypePreparation" INTEGER,
    "libelle_type" TEXT,
    "annonceur" TEXT,
    "quantite" INTEGER,
    "motif" TEXT NOT NULL,
    "repartitions" TEXT NOT NULL,
    "unites" TEXT NOT NULL,
    "mail_statut" TEXT NOT NULL,
    "mail_destinataires" TEXT,
    "par_id" INTEGER NOT NULL,
    "le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "deblocage_preparation_cle_idx" ON "deblocage_preparation"("cle");

-- CreateIndex
CREATE INDEX "deblocage_preparation_le_idx" ON "deblocage_preparation"("le");

-- CreateIndex
CREATE INDEX "deblocage_preparation_cont_num_idx" ON "deblocage_preparation"("cont_num");
