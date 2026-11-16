-- AlterTable
ALTER TABLE "export_trains" ADD COLUMN "fichier_simule" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "generation_fichiers" ADD COLUMN "versions_trains" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "generation_fichiers" ADD COLUMN "machine_envoi" TEXT;
