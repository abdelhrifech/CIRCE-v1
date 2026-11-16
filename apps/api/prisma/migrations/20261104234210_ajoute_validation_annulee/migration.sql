-- COO-P03 : motif de doute ANNULEE (RG-COO-006 / RG-COO-014). Réécrite en ALTER (pas de reconstruction
-- de la table affiche, qui garderait sinon le risque de perdre les index partiels).
ALTER TABLE "affiche" ADD COLUMN "validation_annulee" BOOLEAN NOT NULL DEFAULT false;
