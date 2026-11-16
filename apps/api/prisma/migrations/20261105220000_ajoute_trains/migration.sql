-- COO-P09 (trains) : colonnes d'emplacement du legacy (RG-COO-200 / 202), position fractionnée (RG-COO-209 / 221),
-- train créé par la Coordination (RG-COO-224), motif de suppression (RG-COO-225). ALTER seulement (pas de reconstruction).
ALTER TABLE "tf_face_train" ADD COLUMN "empl_sect_code" INTEGER;
ALTER TABLE "tf_face_train" ADD COLUMN "empl_depa_code" TEXT;
ALTER TABLE "tf_face_train" ADD COLUMN "comm_numord" INTEGER;
ALTER TABLE "tf_face_train" ADD COLUMN "empl_numord" INTEGER;
ALTER TABLE "tf_face_train" ADD COLUMN "empl_addresse1" TEXT;
ALTER TABLE "tf_face_train" ADD COLUMN "fractionnee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tf_face_train" ADD COLUMN "origine_train" TEXT;
ALTER TABLE "tf_face_train" ADD COLUMN "motif_suppression" TEXT;
