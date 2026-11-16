-- AlterTable : « Générer un complément » (ECR-GEN-03, RG-COO-074) : lot d'origine du complément (lien logique, Q-310).
ALTER TABLE "generation_fichiers" ADD COLUMN "complement_de_id" INTEGER;
