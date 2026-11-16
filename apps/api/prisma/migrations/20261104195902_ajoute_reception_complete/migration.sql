-- REC-P04 à REC-P10 (2026-11-04) : réception inconnue, entrée dans le sas, contrôleur (RG-REC-038, 055, 063,
-- 095, 109), « Déchargé par » (RG-REC-033), surplus d'entretien (RG-REC-066), imprimeur de l'affiche (RG-REC-131).
-- Réécrite à la main : la version générée reconstruisait `affiche` et `reception` (DROP TABLE + copie).
-- ALTER TABLE ADD COLUMN conserve les tables, leurs données et leurs index. Les nouvelles valeurs de
-- l'enum ActionAudit ne demandent aucun SQL en SQLite.
ALTER TABLE "reception" ADD COLUMN "est_inconnue" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reception" ADD COLUMN "a_controler_depuis" DATETIME;
ALTER TABLE "reception" ADD COLUMN "controleur_id" INTEGER;
ALTER TABLE "livraison" ADD COLUMN "decharge_par_id" INTEGER;
ALTER TABLE "affiche" ADD COLUMN "surplus_entretien" INTEGER;
ALTER TABLE "affiche" ADD COLUMN "imprimeur_id" INTEGER REFERENCES "tr_imprimeur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
