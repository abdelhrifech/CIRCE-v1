---
name: circe-migration-prisma
description: Procédure pour toute modification du schéma Prisma de CIRCE V2 (ajout/modification de modèle, colonne, relation, index) avec migration, justification documentée et contrôle des suppressions.
---

# Migration Prisma CIRCE

1. Justifier AVANT de modifier : quelle EX/RG l'exige ? Quel écart avec le schéma réel ?
2. Conventions du schéma :
   - Mapper les noms réels si on conserve des tables : `@@map("NOM_TABLE")`, `@map("NOM_COLONNE")`.
   - Toute entité métier modifiable : `version Int @default(1)`, `createdAt`, `updatedAt`, `createdById`, `updatedById`.
   - Statuts : enum Prisma OU table de référence, suivre la décision de l'étape 3 (ANALYSE_MODELE_DONNEES.md).
   - Historique de statut : table `<entite>_historique_statut` dédiée.
   - Clés étrangères explicites avec `onDelete` réfléchi (par défaut `Restrict`, jamais `Cascade` sur des données métier sans justification).
   - Index sur toutes les colonnes utilisées par les filtres des maquettes.
3. `pnpm --filter api prisma migrate dev --name <verbe_objet>` (ex : `ajoute_motif_rejet_reception`).
4. Relire le SQL généré dans `prisma/migrations/*/migration.sql`. Si on y voit `DROP` ou une perte de données : STOP, créer une question Q-xxx.
5. Documenter dans `docs/ANALYSE_MODELE_DONNEES.md`, section « Journal des évolutions » :
   `| date | migration | changement | justification (EX/RG) | impact données existantes |`
6. Mettre à jour les factories de test et les générateurs de JDD concernés.
