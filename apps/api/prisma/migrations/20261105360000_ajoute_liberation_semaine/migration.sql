-- CreateTable
CREATE TABLE "tf_liberation_semaine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ate_id" INTEGER NOT NULL,
    "sem_annee" INTEGER NOT NULL,
    "sem_num" INTEGER NOT NULL,
    "liberee_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "par_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tf_liberation_semaine_ate_id_fkey" FOREIGN KEY ("ate_id") REFERENCES "tr_atelier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tf_liberation_semaine_ate_id_sem_annee_sem_num_key" ON "tf_liberation_semaine"("ate_id", "sem_annee", "sem_num");
