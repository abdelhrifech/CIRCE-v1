CREATE TABLE "j3_feuille" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "plateformeId" INTEGER NOT NULL, "section" TEXT NOT NULL, "semaine" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("plateformeId") REFERENCES "tr_plateforme"("id") ON DELETE RESTRICT);
CREATE UNIQUE INDEX "j3_feuille_plateformeId_section_semaine_key" ON "j3_feuille"("plateformeId", "section", "semaine");
CREATE TABLE "j3_ligne" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "feuilleId" INTEGER NOT NULL, "dossierId" INTEGER NOT NULL, "donnees" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" DATETIME NOT NULL, "updatedById" INTEGER NOT NULL,
 FOREIGN KEY ("feuilleId") REFERENCES "j3_feuille"("id") ON DELETE RESTRICT, FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE RESTRICT);
CREATE UNIQUE INDEX "j3_ligne_feuilleId_dossierId_key" ON "j3_ligne"("feuilleId", "dossierId");
CREATE TABLE "tableau_personnel" ("userId" INTEGER NOT NULL PRIMARY KEY, "carres" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("userId") REFERENCES "utilisateur"("id") ON DELETE RESTRICT);
