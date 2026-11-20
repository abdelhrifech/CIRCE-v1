CREATE TABLE "fin_campagne" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "plateformeId" INTEGER NOT NULL,
  "dossier" INTEGER NOT NULL,
  "decision" TEXT NOT NULL,
  "jusqua" TEXT,
  "motif" TEXT,
  "destinataire" TEXT,
  "quantiteRetour" INTEGER,
  "quantiteEnvoyee" INTEGER NOT NULL DEFAULT 0,
  "quantiteDetruite" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" DATETIME NOT NULL,
  "parId" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "fin_campagne_plateformeId_dossier_key" ON "fin_campagne"("plateformeId","dossier");
CREATE TABLE "machine_configuration" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "nom" TEXT NOT NULL, "type" TEXT NOT NULL,
 "fichier" BOOLEAN NOT NULL DEFAULT false, "tiroirsMax" INTEGER, "sortie" TEXT, "repertoire" TEXT, "bagues" TEXT,
 "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "machine_configuration_nom_key" ON "machine_configuration"("nom");
CREATE TABLE "boucle_transport_configuration" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "plateformeId" INTEGER NOT NULL, "nom" TEXT NOT NULL,
 "canal" TEXT NOT NULL, "jour" INTEGER NOT NULL, "heure" TEXT NOT NULL, "destinataires" TEXT NOT NULL DEFAULT '[]',
 "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "boucle_transport_configuration_plateformeId_nom_key" ON "boucle_transport_configuration"("plateformeId","nom");
CREATE TABLE "liste_distribution_configuration" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "nom" TEXT NOT NULL, "plateformeId" INTEGER,
 "roles" TEXT NOT NULL, "usage" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "liste_distribution_configuration_nom_key" ON "liste_distribution_configuration"("nom");
