-- REC-P02 (2026-11-04) : exclusion de thème (Q-135), conservation à l'année et date de purge (Q-130,
-- RG-REC-180, RG-COO-089) sur les lignes attendues.
-- Réécrite à la main : la version générée par Prisma reconstruisait la table (DROP TABLE + copie) et
-- PERDAIT l'index unique partiel "tf_prepa_affiche_ligne_active_cle_key" (Q-305). ALTER TABLE ADD COLUMN
-- conserve la table, ses données et tous ses index. L'action d'audit PURGE_ATTENDUES (enum) ne demande
-- aucun SQL en SQLite.
ALTER TABLE "tf_prepa_affiche" ADD COLUMN "theme_exclu" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tf_prepa_affiche" ADD COLUMN "conserver_annee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tf_prepa_affiche" ADD COLUMN "purgee_le" DATETIME;
