# BRIEF COMMUN — Étape 1b (synthèse). À LIRE EN ENTIER avant d'écrire.

Racine projet : /Users/hrifech/Desktop/cityzmedia/circe-cv1 (chemins ABSOLUS obligatoires). Aucun code applicatif.
Lire : CLAUDE.md (§5 conventions d'ID, §7 règles non négociables), docs/MISSION.md (§3, §6, §11), le modèle du livrable visé dans docs/ (squelette vide).
Sources de synthèse : docs/_travail/*.md. Retour aux sources originales (circe-develop/, docs-sources/, docs/_travail/extraits/) en cas de doute : LECTURE SEULE.

## Règles de fond
1. Jamais d'invention : chaque règle a une source (legacy `fichier:ligne` repris des notes — vérifier par grep en cas de doute ; spec `doc §` + ID EX ; écran ECR-xxx-nn). Sans source -> question Q-xxx.
2. Conflit legacy/spec/maquette, ambiguïté, règle sans source : créer une question (ne JAMAIS trancher seul). BLOQUANTE uniquement si elle empêche réellement de modéliser (schéma Prisma/statuts) ou d'implémenter la règle ; sinon NON + éventuelle HYPOTHÈSE explicite (statut HYPOTHÈSE PRISE). Pas de BLOQUANTE par excès de prudence : justifier chaque BLOQUANTE en une phrase (ce qui est impossible tant que non tranché).
3. Priorité : la spec 02/11 (option A) remplace celle du 27/10 (passages barrés). La cible prime sur le legacy pour le comportement attendu, MAIS un écart legacy/cible non explicitement voulu par une spec = question, pas décision.
4. Marquage de chaque règle : CONSERVÉE (legacy = cible) · MODIFIÉE (une spec change le legacy ; dire quoi) · NOUVELLE (spec/maquette seule) · SUPPRIMÉE (UNIQUEMENT si une spec le dit explicitement ; citer la phrase). Règle legacy absente des specs et jamais retirée : CONSERVÉE + question si doute d'applicabilité (ne rien perdre : MISSION §12.6).
5. Règles testables : énoncé précis (conditions, seuils, valeurs, messages d'erreur exacts quand connus). Une RG = un comportement vérifiable par au moins un test nominal et un test de rejet.
6. Les données MOCK de la maquette servent à comprendre, jamais de source de valeurs métier définitives sans spec (sinon question).

## IDs
- Format fixe : `RG-REC-nnn`, `RG-COO-nnn`, `RG-X-nnn`, `Q-nnn`, `ECR-<MOD>-nn`, `EX-<MOD>-nnn`. Trois chiffres.
- **Collision d'IDs EX détectée** : `specs-ateliers-besoins.md` réutilise EX-REC-001…, EX-COO-001…, EX-TRA-001… déjà définis dans specs-reception/coordination/transverse avec un AUTRE sens. Règle définitive : tout EX issu de `specs-ateliers-besoins.md` est cité avec **+500** : EX-REC-001 (ateliers) = **EX-REC-501**, EX-COO-012 (ateliers) = **EX-COO-512**, EX-FIX-003 = EX-FIX-503, etc. Les EX des autres fichiers specs-* gardent leur ID. EX-EXI-nnn (specs-existant-process) inchangés. Toujours citer les EX avec ce schéma.
- Blocs d'IDs RÉSERVÉS (ne jamais sortir de ta plage ; les trous sont acceptables) :
  * RG-REC : 001-299 (agent REC)
  * RG-COO : 001-199 (agent COO-1 : validation admin, Instruction OK, réceptions attendues, alertes pré-prod, déblocage, droits/périmètre, alimentation/intégrations) ; 200-399 (agent COO-2 : trains, export, préparation fixe/pliage/bus/déroulant, suivi 8 m², dispatch, bagues/étiquettes, répartition, UM/colis)
  * RG-X : 001-049 (déclenchées par une action RÉCEPTION, conséquence COORDINATION — agent REC) ; 050-099 (déclenchées par une action COORDINATION, conséquence RÉCEPTION, ou invariants croisés — agents COO-1 et COO-2 : COO-1 = 050-074, COO-2 = 075-099)
  * Q : Q-001…Q-010 existent déjà (docs/QUESTIONS_OUVERTES.md, ne pas les modifier ; tu peux les citer). REC : Q-100…Q-199 ; COO-1 : Q-200…Q-249 ; COO-2 : Q-250…Q-299 ; ARCH/DATA/TRA : Q-300…Q-399.
- Les anciens IDs provisoires des notes (RG-REC-xx de legacy-reception.md, RG-COO-xx, RG-AT, RG-VA, RG-ADM/RPR/INT…) sont des numéros PROVISOIRES : toujours donner la correspondance « ancien ID provisoire (fichier) » dans les Sources de la règle définitive.
- Profils/rôles : provisoires (Q-003, CLAUDE.md §8) = les 6 rôles de la maquette, colonnes EXACTES et dans cet ordre : `coord` (Coordination) · `cheq` (Chef d'équipe) · `recep` (Agent de réception) · `expe` (Agent d'expédition) · `admin` (Administrateur) · `com` (Commerce, lecture). Mapper sur les 27 droits legacy (legacy-admin.md) et le dire dans Source. Cellule : ✔ autorisé / ✘ refusé / ✔(cond.) avec la condition / ? avec Q-xxx.

## Format des questions (lignes de tableau Markdown, 1 ligne par question, colonnes EXACTES)
| ID | Module | Sujet | Source(s) en conflit / manquante | Options et conséquences | Bloquante ? | Statut | Décision (équipe) | Date |
- Module ∈ REC, COO, TRA, DATA, INT, X. « Bloquante ? » = `OUI — <ce qui est bloqué>` ou `NON`. Statut = `OUVERTE` ou `HYPOTHÈSE PRISE` (alors décrire l'HYPOTHÈSE retenue dans « Options et conséquences »). Décision et Date vides. Pas de `|` dans une cellule (utiliser `/`). Une ligne = une seule ligne de texte.

## Format d'une règle (respecter EXACTEMENT, c'est le modèle docs/RECEPTION_REGLES_METIER.md)
### RG-REC-012 — <titre>
- Origine : CONSERVÉE | MODIFIÉE | NOUVELLE | SUPPRIMÉE
- Énoncé :
- Déclencheur :
- Conditions :
- Effet / message d'erreur :
- Sources : legacy `fichier:ligne` (ancien ID provisoire …) · spec `doc §` (EX-…) · écran `ECR-…`
- Questions liées : Q-xxx (ou « — »)
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
Les titres de règles commencent par `### RG-` (un script les compte pour la matrice : ne pas utiliser ce préfixe ailleurs).
Les règles RG-X suivent le même format, avec en plus la ligne `- Modules : REC → COO` (ou COO → REC / bidirectionnel) et `- Atomicité : transaction unique oui/non`.

## Livraison par FRAGMENTS (limite de taille d'un Write ~ 25 Ko : écrire plusieurs fichiers)
Écrire dans /Users/hrifech/Desktop/cityzmedia/circe-cv1/docs/_travail/synth/ :
`<agent>-1-entites.md` (section 1 : tableau Entité | Champs clés | Obligatoire/conditionnel | Source)
`<agent>-2-profils.md` (section 2 : matrice profils × actions, 6 colonnes de rôles + Source)
`<agent>-3-statuts.md` (3.1 statuts + 3.2 transitions : tableau De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source ; ajouter un petit tableau « transitions interdites notables (409) »)
`<agent>-4-regles-NN.md` (section 4 : règles, un fichier par ~25-30 règles : -01, -02, …)
`<agent>-5-rgx.md` (section 5 : règles RG-X de ta plage, format règle)
`<agent>-6-auto.md` (section 6 traitements automatiques) · `<agent>-7-messages.md` (section 7 : Code | Message | Règle)
`<agent>-questions.md` (lignes de questions de ta plage, format ci-dessus, SANS en-tête de tableau)
`<agent>-ex-couverture.md` (tableau : EX | RG qui la couvre (IDs) ou raison de non-couverture (UX seulement / autre module : lequel / info / hors périmètre / dépendance étape 8). Doit contenir CHAQUE EX de ton périmètre.)
Pas de titre `#`/`##` de section dans les fragments sauf indication ; commence directement par le contenu (le contenu du fragment sera concaténé sous le titre de section par un script). Les fragments `-4-regles` ne contiennent QUE des `### RG-…`.
`<agent>` ∈ rec, coo1, coo2, arch.

## Rapport final de l'agent (court, < 40 lignes)
Liste des fichiers, nombre de RG par origine (CONSERVÉE/MODIFIÉE/NOUVELLE/SUPPRIMÉE), nombre de Q (dont BLOQUANTES avec ID + sujet + ce qui est bloqué), EX de ton périmètre non couvertes, difficultés. Ne recopie pas le contenu.
