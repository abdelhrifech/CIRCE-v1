-- COO-P04 : effets de la validation admin.
-- RG-COO-030 (HYPOTHÈSE Q-210) : thème de la ligne changé après la validation → motif THEME.
ALTER TABLE "affiche" ADD COLUMN "theme_modifie" BOOLEAN NOT NULL DEFAULT false;
-- RG-COO-023 : étiquette rack à imprimer à la plateforme après la validation.
ALTER TABLE "affiche" ADD COLUMN "etiquette_rack_a_imprimer" BOOLEAN NOT NULL DEFAULT false;
