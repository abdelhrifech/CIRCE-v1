-- CreateTable
CREATE TABLE "mail_file" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "source_type" TEXT,
    "source_id" INTEGER,
    "destinataires" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "derniere_erreur" TEXT,
    "canal" TEXT,
    "par_id" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tentative_le" DATETIME,
    "envoye_le" DATETIME
);

-- CreateTable
CREATE TABLE "tache_execution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tache" TEXT NOT NULL,
    "declencheur" TEXT NOT NULL,
    "par_id" INTEGER,
    "statut" TEXT NOT NULL,
    "verrou" TEXT,
    "debut" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" DATETIME,
    "message" TEXT,
    "resultat" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_file_cle_key" ON "mail_file"("cle");

-- CreateIndex
CREATE INDEX "mail_file_statut_id_idx" ON "mail_file"("statut", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tache_execution_verrou_key" ON "tache_execution"("verrou");

-- CreateIndex
CREATE INDEX "tache_execution_tache_debut_idx" ON "tache_execution"("tache", "debut");
