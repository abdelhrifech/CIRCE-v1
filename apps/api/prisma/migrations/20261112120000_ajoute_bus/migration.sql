CREATE TABLE "bus_referentiel" ("id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1, "donnees" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" DATETIME NOT NULL, "updatedById" INTEGER NOT NULL);
CREATE TABLE "bus_ligne" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "idExterne" TEXT NOT NULL, "plateformeId" INTEGER NOT NULL, "dossierId" INTEGER NOT NULL, "ligneAttendueId" INTEGER NOT NULL,
 "centreCode" TEXT NOT NULL, "parc" TEXT NOT NULL, "formatCode" TEXT NOT NULL, "semaine" TEXT NOT NULL, "finPose" TEXT NOT NULL,
 "vendu" INTEGER NOT NULL, "quantiteBroadcast" INTEGER NOT NULL, "attendu" INTEGER NOT NULL, "entretienPourcent" REAL NOT NULL,
 "quantiteAjustee" INTEGER, "ajusteParId" INTEGER, "ajusteLe" DATETIME, "resteEnPlace" BOOLEAN NOT NULL DEFAULT false,
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("plateformeId") REFERENCES "tr_plateforme"("id") ON DELETE RESTRICT,
 FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE RESTRICT,
 FOREIGN KEY ("ligneAttendueId") REFERENCES "tf_prepa_affiche"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "bus_ligne_idExterne_key" ON "bus_ligne"("idExterne");
CREATE INDEX "bus_ligne_plateformeId_semaine_idx" ON "bus_ligne"("plateformeId", "semaine");
CREATE INDEX "bus_ligne_ligneAttendueId_idx" ON "bus_ligne"("ligneAttendueId");
CREATE TABLE "bus_controle_reception" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "receptionId" INTEGER NOT NULL, "ligneAttendueId" INTEGER NOT NULL,
 "entretien" BOOLEAN NOT NULL, "themeConforme" BOOLEAN NOT NULL, "photoId" INTEGER NOT NULL,
 "tenue" TEXT NOT NULL DEFAULT '', "allongement" TEXT NOT NULL DEFAULT '', "massicotage" TEXT NOT NULL DEFAULT '', "nc" TEXT NOT NULL DEFAULT '', "commentaire" TEXT NOT NULL DEFAULT '',
 "createdById" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("receptionId") REFERENCES "reception"("id") ON DELETE RESTRICT,
 FOREIGN KEY ("ligneAttendueId") REFERENCES "tf_prepa_affiche"("id") ON DELETE RESTRICT,
 FOREIGN KEY ("photoId") REFERENCES "photo"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "bus_controle_reception_receptionId_key" ON "bus_controle_reception"("receptionId");
