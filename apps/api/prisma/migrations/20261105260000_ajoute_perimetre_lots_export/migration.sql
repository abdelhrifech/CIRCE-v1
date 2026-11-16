-- AlterTable
ALTER TABLE "export_trains" ADD COLUMN "ate_ids" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "generation_fichiers" ADD COLUMN "ate_ids" TEXT NOT NULL DEFAULT '[]';
