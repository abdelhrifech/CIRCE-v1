Périmètre de ce fragment (coo1) : machines d'états des AFFICHES (validation admin), des DOSSIERS (préparation ; pastille de validation calculée), des INSTRUCTIONS du déroulant, des LIGNES ATTENDUES, des DEMANDES de correction, des ALERTES et du GROUPE DE PRÉPARATION (déblocage). Les statuts des trains, faces, UM, colis, répartitions appartiennent à coo2 : ils ne sont cités que comme « ponts ». Statuts hérités du legacy : `Enums.cs:223-247` (`StatutPreparation` 0 à 10), contenu de `tr_statut` à obtenir (Q-004).

### 3.1 Statuts

#### 3.1.a Validation admin d'une affiche (calculée, RG-COO-007)
| Statut | Libellé affiché | Signification | Source |
|---|---|---|---|
| `RECEPTION_INCONNUE` | Réception inconnue | affiche sans dossier rattaché : à identifier d'abord (fiche Réceptions inconnues) | [PC] p.1 ; ECR-REC-04 ; RG-COO-007 |
| `A_CONFIRMER_PROPOSE` | À confirmer : proposé | cas sûr (RG-COO-005), pré-coché | [PC] p.1 ; RG-COO-005 |
| `A_CONFIRMER_DOUTE` | À confirmer : doute | au moins un motif (BL, FORMAT, THEME, MULTI, SANS_IP, ANNULEE) ; un par un | [PC] p.1 ; RG-COO-006 |
| `VALIDEE` | Validée par <nom> le <date> | confirmée par une personne | [PC] p.1 ; RG-COO-008, 015 |
| (libellés divergents) | Proposée par Circé / À vérifier / Orpheline ([DC]) | à harmoniser sur les libellés ci-dessus | Q-200 |

#### 3.1.b Dossier — préparation (persisté) et validation admin (pastille calculée)
| Statut | Libellé affiché | Signification | Source |
|---|---|---|---|
| `A_TRAITER` | À traiter | prépa non envoyée (un mot, un sens) | [PC] p.1 ; RG-COO-063 |
| `PREPARATION_RECUE` | Préparation reçue | prépa envoyée par la Pré-Prod, posé par Circé | [PC] p.1 ; RG-COO-063 |
| `ANNULE` | Annulé | vente annulée ; validation « — » | [PC] p.1 ; RG-COO-062 |
| (calculé) `AUCUNE_AFFICHE_RECUE` | Aucune affiche reçue | rien à valider | RG-COO-019 |
| (calculé) `A_CONFIRMER(n)` | À confirmer (n[, dont k doutes]) | affiches à confirmer | RG-COO-019 |
| (calculé) `VALIDEE` | Validée (« Validation admin faite ») | au moins une affiche reçue, toutes confirmées | RG-COO-019, 020 |
| (calculé) `SANS_OBJET` | « — » | dossier annulé | RG-COO-019 |
| `VALIDE` (interne maquette) | non affiché | préparation reçue + toutes affiches confirmées : NON retenu comme statut persisté | Q-215 |

#### 3.1.c Instruction (déroulant) — grain dossier × semaine × atelier
| Statut (code legacy) | Libellé affiché | Signification | Source |
|---|---|---|---|
| `A_TRAITER` (0) | À traiter · prépa pas reçue (instruction) | faces reçues, instructions pas encore reçues | [PC] p.1 ; EX-EXI-018, 030 ; RG-COO-040 |
| `EN_COURS` (1) | En cours | prépa reçue, posé par Circé ; traité automatiquement (Nariman) ou par la Coordination | RG-COO-040, 041 |
| `INSTRUCTION_OK` (2) | Instruction ok (automatique / après contrôle) | feu vert de composition ; calcule et fige les trains | RG-COO-042, 044 |
| `ERREUR` (3) | Erreur | hérité ; repassé à 1 à l'intégration ; aucun choix proposé | `p_integ_instructions.sql` ; RG-COO-041 |
| `ANNULE` (4) | Annulé | pas à produire, avant l'export | RG-COO-045 |
| `PRET_A_PRODUIRE` (5) | Prêt à produire (ex « A imprimer ») | exportée le jeudi 14 h : posé par l'export (coo2) | [PC] p.1 ; EX-COO-020 |
| 6 à 10 (Préparé, A expédier, Terminé, Export prépa, Au roulage) | (faces/UM) | côté production : coo2, NON statuts d'instruction | EX-EXI-030 |
| mode `AUTO` / `MANUEL` | « Instruction ok · automatique » / « après contrôle » | propriété de la transition vers 2 (`iok_par`, `iok_le`) | RG-COO-042, 044 |

#### 3.1.d Ligne attendue
| Statut | Libellé affiché | Signification | Source |
|---|---|---|---|
| `source` BC | (repère) | ligne alimentée par la copie Broadcast (prépa non envoyée) | RG-COO-082 |
| `source` PREPA | (repère) | prépa arrivée (`qte_prepa`) | RG-COO-086 |
| `etat_ligne` ACTIVE | — | ligne vivante, une par clé | RG-COO-080 |
| `etat_ligne` ANNULEE | — | fermée avec date, jamais supprimée | RG-COO-087, 089 |
| Attendue / Partielle / Complète / Surplus | (calculé, Réception) | non persisté ; > 10 % en trop = Surplus | EX-REC-051 (module Réception) |

#### 3.1.e Autres objets
| Objet | Statuts | Source |
|---|---|---|
| Demande de correction à Broadcast | `ENVOYEE` (date, user, note) → `FAITE` (« Corrigé par Broadcast » quand Broadcast renvoie la prépa corrigée) ; renvoi autorisé (« Le mail sera renvoyé ») | RG-COO-057, 069 |
| Vérification de thèmes/annonceurs | `A_VERIFIER` → `DEMANDE` → `CORRIGE` ; ou `DIFFERENTS` ; `MEME` ; rouvrable | RG-COO-069, 070 |
| Alerte | `OUVERTE` → `ACQUITTEE` (ou levée automatiquement quand la condition disparaît) ; gravités critical / serious (« Important ») / warning (« À surveiller ») / info | RG-COO-033, 066 à 074 ; Q-220 |
| Groupe de préparation Broadcast | `ENVOYE` (133) → `INTEGRE` (accusé `MajStatutGroupePrepa`) → `DEBLOQUE` (`P_CirceDebloquerGroupePreparation`) ; `StatutPrepa` : None (débloquable) / En cours (bloquant) | RG-COO-125, 142, 145 |
| Chargement de flux | 1 (en cours) → 0 (OK) / 2 (échec) | RG-COO-116 |

### 3.2 Transitions (toute transition absente est INTERDITE : 409)

#### 3.2.a Affiche — validation admin
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (création) | Création de l'affiche par la Réception | `A_CONFIRMER_PROPOSE` / `A_CONFIRMER_DOUTE` / `RECEPTION_INCONNUE` selon calcul | Réception (action) ; état calculé par Circé | RG-COO-004, 005, 006, 007 | proposition de liens ; aucun effet de validation (RG-COO-002) | [PP] §5 ; [RA] |
| `RECEPTION_INCONNUE` | Rattacher | `VALIDEE` (coord, admin) ou `A_CONFIRMER_DOUTE` (autres rôles) | `coord`, `admin` (validation) ; `recep` (rattachement seul) | RG-COO-017, RG-COO-009 | RG-X-051, RG-X-063 | [README] §3 ; ECR-REC-04 |
| `RECEPTION_INCONNUE` | Signaler (dossier introuvable) | `RECEPTION_INCONNUE` (statut d'affiche « Introuvable ») | `coord`, `recep` | RG-X-054 | alerte « Dossier introuvable » (RG-COO-072) | [DC] §7 |
| `A_CONFIRMER_PROPOSE` | Valider / Valider la sélection | `VALIDEE` | `coord`, `admin` | RG-COO-008, 009, 010 | RG-COO-021 à 025 ; historique RG-COO-015 | [PC] p.1-2 |
| `A_CONFIRMER_DOUTE` | Valider (confirmation explicite) | `VALIDEE` | `coord`, `admin` | RG-COO-012 | idem | ECR-COO-03 |
| `VALIDEE` | Annuler la validation | `A_CONFIRMER_DOUTE` (motif ANNULEE) | `coord`, `admin` | RG-COO-014 | RG-X-050 | [PP] §5 |
| `VALIDEE` | Thème de la ligne changé (Broadcast) | `A_CONFIRMER_DOUTE` (motif THEME) | système (alimentation) | RG-COO-030 | alerte ; RG-X-057 | [RA] RG-VA-02 |
| `A_CONFIRMER_*`, `VALIDEE` | Retrait du dernier dossier | `RECEPTION_INCONNUE` | `coord`, `recep` | RG-X-058 | validation effacée | [DC] §8-10 |
| `A_CONFIRMER_*`, `VALIDEE` | Rattachement manuel (surplus, autre dossier) | état recalculé | `coord`, `admin` (vaut validation du lien) | RG-COO-099, RG-X-052 | historique | [PP] §6 |
| tout état | Fusion d'affiches | `VALIDEE` si une source l'était | droit `fusion_affiche` | RG-COO-029 | héritage `par/le` | legacy `FusionAfficheBll.cs:127` |

#### 3.2.b Dossier — préparation
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (création) | Lecture Broadcast, DA activée | `A_TRAITER` | système | RG-COO-091 | alerte « Préparation non reçue » après deadline (RG-COO-066) | [PC] |
| `A_TRAITER` | Intégration de la prépa | `PREPARATION_RECUE` | système (Circé) | RG-COO-063, 121, 131 | instruction → `EN_COURS` (RG-COO-041) ; historique (RG-COO-061) | [PC] p.1 ; [PP] §2 |
| `PREPARATION_RECUE` | Renvoi de prépa (avant export) | `PREPARATION_RECUE` | système | RG-COO-054 (Q-204), 148 | instruction rouverte ; validation inchangée (RG-X-059) | [PP] §2 jalon 5 |
| `A_TRAITER`, `PREPARATION_RECUE` | DA / vente annulée | `ANNULE` | système | RG-COO-062 | alertes relevées ; RG-X-065 | [PC] p.1 |
| `PREPARATION_RECUE` | Déblocage de la préparation | `PREPARATION_RECUE` (après annulation des lignes) | `coord`, `admin` | RG-COO-143, 144, 145 | RG-X-059 | legacy `AdminPreparationDeblocageBll.cs:252-333` |

#### 3.2.c Instruction (déroulant)
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (absente) | Intégration d'instruction / chapeau | `EN_COURS` (instruction) ou `A_TRAITER` (chapeau de faces) | système | RG-COO-041, 131 | historique | `p_integ_instructions.sql:175-259` |
| `A_TRAITER` | Arrivée des instructions | `EN_COURS` | système | RG-COO-041 | — | EX-EXI-018 |
| `A_TRAITER` | Annuler | `ANNULE` | `coord`, `admin` | RG-COO-045 | historique | legacy `PreparationDeroulantsController.cs:1507-1542` |
| `EN_COURS` | Instruction OK automatique (règle de Nariman) | `INSTRUCTION_OK` (AUTO) | système | RG-COO-042, 043, 052 ; moment Q-204 | calcul des trains (pont coo2) ; RG-COO-047 | [PC] ; [RA] RG-IOK-01 |
| `EN_COURS` | Instruction OK (après contrôle) | `INSTRUCTION_OK` (MANUEL) | `coord`, `admin` | RG-COO-044, 043, 052 | idem | [PC] p.1-2 |
| `EN_COURS` | Annuler | `ANNULE` | `coord`, `admin` | RG-COO-045 | historique | idem |
| `EN_COURS` | Renvoi Broadcast (intégration) | `EN_COURS` | système | RG-COO-041 | mise à jour annonceur/commentaire | `p_integ_instructions.sql:578-590` |
| `INSTRUCTION_OK` | Retour « En cours » / « À traiter » | `EN_COURS` / `A_TRAITER` | `coord`, `admin` | RG-COO-046 | efface le calcul des trains sauf faces 5 (pont coo2) | `p_u_statut_preparation.sql:24-64` |
| `INSTRUCTION_OK` | Annuler | `ANNULE` | `coord`, `admin` | RG-COO-045, 046 | efface le calcul | idem |
| `INSTRUCTION_OK` | Renvoi de prépa avant export | `EN_COURS` | système | RG-COO-054 (Q-204) | recalcul des trains | maquette `renvoiPrepa` |
| `INSTRUCTION_OK` | Export des trains du jeudi 14 h (action coo2) | `PRET_A_PRODUIRE` | `coord` (coo2) | gardes coo2 | historique `ExporterTrains` (RG-COO-160) | [PC] ; `PreparationDeroulantsService.cs:109-223` |
| `INSTRUCTION_OK`, `PRET_A_PRODUIRE`, `ANNULE` | Renvoi de Broadcast | inchangé (ignoré + alerte) | système | RG-COO-053 | alerte « Rajout après préparation » (RG-COO-073) | `p_integ_train_affiches.sql:38-48` |
| `PRET_A_PRODUIRE` | Débloquer semaine (action coo2) | `INSTRUCTION_OK` | droit `train_debloquer_semaine` (coo2) | gardes coo2 | — | `TrainSuiviThemeBll.cs:496-522` |
| `ANNULE` | Remettre à traiter | `A_TRAITER` | `coord`, `admin` | RG-COO-045 | historique | `PreparationRepository.cs:1020-1111` |
| `ERREUR` | Intégration suivante | `EN_COURS` | système | RG-COO-041 | — | `p_integ_*` |

#### 3.2.d Ligne attendue
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (absente) | Lecture Broadcast (prépa non envoyée) | `ACTIVE`, source BC | système | RG-COO-080, 082 | — | [RA] RG-AT-03 |
| `ACTIVE` source BC | Arrivée de la prépa | `ACTIVE`, source PREPA | système | RG-COO-086 | alerte écart si `qte_prepa ≠ qte_bc` | [RA] RG-AT-05 |
| `ACTIVE` | Ligne non revue à la lecture suivante / DA annulée | `ANNULEE` | système | RG-COO-087 | alerte si lien actif ; RG-X-055, 065 | [RA] RG-AT-06 |
| `ACTIVE` (provisoire) | IP saisies | `ANNULEE` + lignes par thème `ACTIVE` | système | RG-COO-085 | RG-X-056 | [RA] RG-AT-04 |
| `ACTIVE` | Doublon (reprise) | `ANNULEE` (autres lignes de la clé) | migration | RG-COO-090 | lien reporté | [RA] §4 |

#### 3.2.e Groupe de préparation Broadcast (déblocage)
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| `ENVOYE` (133) | Intégration par Circé | `INTEGRE` | système | RG-COO-121, 125 | accusé à Broadcast | `BatchAlimBll.cs:91-124` |
| `INTEGRE` | Débloquer | `DEBLOQUE` | `coord`, `admin` | RG-COO-143, 144, 152 | RG-COO-145 à 147 ; RG-X-059 | `AdminPreparationDeblocageBll.cs:252-333` |
| `INTEGRE` | Débloquer (groupe avec UM ≥ 6 ou faces ≥ 2) | — | — | RG-COO-143, 144 | refus 422 | idem |

#### Transitions interdites notables (409)
| Tentative | Réponse | Règle |
|---|---|---|
| Valider une affiche déjà `VALIDEE` ; annuler une validation d'une affiche non validée | 409 | RG-COO-008, 014 |
| Passer de `RECEPTION_INCONNUE` à `VALIDEE` sans rattachement | 409 | RG-COO-007, 017 |
| Instruction OK depuis un statut autre que `EN_COURS` (`A_TRAITER`, `ANNULE`, `PRET_A_PRODUIRE`, `INSTRUCTION_OK`) | 409 | RG-COO-040, 044 |
| Instruction OK avant l'arrivée de la prépa | 422 | RG-COO-052 |
| Annuler (ou changer de statut) une instruction `PRET_A_PRODUIRE` depuis l'écran des instructions | 409 | RG-COO-040, 045, 046 |
| Modifier annonceur / entretien / position d'une instruction `INSTRUCTION_OK` ou `PRET_A_PRODUIRE` | 409 | RG-COO-047 |
| Rouvrir (« En cours ») une instruction après l'export | 409 | RG-COO-040, 054 |
| Passer un dossier `ANNULE` en `A_TRAITER` / `PREPARATION_RECUE` | 409 | RG-COO-062 |
| Supprimer une ligne attendue ; rouvrir une ligne `ANNULEE` hors migration | 409 | RG-COO-089 |
| Débloquer un groupe avec UM ≥ 6 ou faces ≥ 2 | 422 | RG-COO-143, 144 |
