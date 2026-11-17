ALTER TABLE "non_conformite" ADD COLUMN "reponses" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "alerte_acquittement" ADD COLUMN "snapshot" TEXT NOT NULL DEFAULT '';
