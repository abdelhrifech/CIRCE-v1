-- COO-P05 : règles de vie des lignes attendues.
-- RG-COO-081 / Q-208 : n° de thème Broadcast (rapprochement par identifiant quand il est fourni).
ALTER TABLE "tf_prepa_affiche" ADD COLUMN "IdTheme" INTEGER;
-- RG-COO-084 : ligne au visuel provisoire (avant IP).
ALTER TABLE "tf_prepa_affiche" ADD COLUMN "provisoire" BOOLEAN NOT NULL DEFAULT false;
-- RG-COO-087 / 089 : date de fermeture ; première lecture où la ligne n'a plus été vue.
ALTER TABLE "tf_prepa_affiche" ADD COLUMN "fermee_le" DATETIME;
ALTER TABLE "tf_prepa_affiche" ADD COLUMN "non_vue_le" DATETIME;

-- RG-COO-081 / Q-227 : correspondance surface × format Broadcast → support (ex Transaco_Surface_Format).
CREATE TABLE "transaco_surface_format" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "IdSurface" INTEGER NOT NULL,
    "IdFormat" INTEGER NOT NULL,
    "sup_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transaco_surface_format_sup_id_fkey" FOREIGN KEY ("sup_id") REFERENCES "tr_categorie_support" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "transaco_surface_format_IdSurface_IdFormat_key" ON "transaco_surface_format"("IdSurface", "IdFormat");
