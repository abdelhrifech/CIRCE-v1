CREATE TABLE "non_conformite" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "plateformeId" INTEGER NOT NULL,
 "type" TEXT NOT NULL, "origine" TEXT NOT NULL, "receptionId" INTEGER, "afficheIds" TEXT NOT NULL DEFAULT '[]',
 "bloquante" BOOLEAN, "donnees" TEXT NOT NULL, "decisions" TEXT NOT NULL DEFAULT '[]', "commentaireDecision" TEXT NOT NULL DEFAULT '',
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL, "createdById" INTEGER NOT NULL, "updatedById" INTEGER,
 FOREIGN KEY ("plateformeId") REFERENCES "tr_plateforme"("id") ON DELETE RESTRICT,
 FOREIGN KEY ("receptionId") REFERENCES "reception"("id") ON DELETE RESTRICT
);
CREATE INDEX "non_conformite_plateformeId_type_idx" ON "non_conformite"("plateformeId", "type");
CREATE TABLE "non_conformite_fichier" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "nonConformiteId" INTEGER NOT NULL,
 "nom" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "taille" INTEGER NOT NULL, "contenu" BLOB NOT NULL,
 FOREIGN KEY ("nonConformiteId") REFERENCES "non_conformite"("id") ON DELETE RESTRICT
);
CREATE TABLE "declarants_nc" (
 "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1, "noms" TEXT NOT NULL DEFAULT '[]', "version" INTEGER NOT NULL DEFAULT 1,
 "updatedAt" DATETIME NOT NULL, "updatedById" INTEGER
);
