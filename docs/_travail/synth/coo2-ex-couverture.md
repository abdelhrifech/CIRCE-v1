Rappel de lecture : les EX issus de `specs-ateliers-besoins.md` sont cités avec +500 (EX-COO-501 = EX-COO-001 des ateliers). Les EX-COO-001 à 050 sans +500 sont ceux de `specs-coordination.md`. « coo1 » = bloc 1 (validation admin, Instruction OK, réceptions attendues, alertes pré-production, déblocage de préparation, droits, intégrations d'alimentation).

| EX | RG qui la couvre (IDs) ou raison de non-couverture |
|---|---|
| EX-COO-501 | RG-COO-238 (entretien repris de Broadcast, sans ressaisie) ; la ressaisie à l'Instruction OK est traitée par coo1 |
| EX-COO-502 | RG-COO-231 (exclusion automatique « ne pas afficher » / « reste en place ») ; Q-263 |
| EX-COO-503 | RG-X-075, RG-X-076, RG-X-078 (alertes et mails de rajout), RG-COO-221, RG-COO-222, RG-COO-242 ; liste de distribution = coo1 / Administration ; Q-266 |
| EX-COO-504 | Autre bloc : coo1 (écran « liste des instructions déroulants » ; contenu fonctionnel du dev APPFR-1143 non décrit dans les extraits) |
| EX-COO-505 | RG-COO-224, RG-COO-225 ; Q-258, Q-259 |
| EX-COO-506 | Autre module : REC / coo1 (proposition automatique de raccrochage affiche ↔ dossier) |
| EX-COO-507 | Autre bloc : coo1 (fusion du raccrochage et de la validation admin) |
| EX-COO-508 | RG-COO-204 (campagne contrôlée : 15 % et position 1), RG-COO-238 ; Instruction OK automatique = coo1 ; Q-257 |
| EX-COO-509 | RG-COO-232, RG-COO-231 ; Q-263 |
| EX-COO-510 | Question seule (aucune RG tant que non tranché) : Q-283 |
| EX-COO-511 | RG-COO-251 ; Q-261 |
| EX-COO-512 | RG-X-077 (dernière minute sur train en production) ; contrôle des réceptions sans IP = coo1 / REC ; Q-282 |
| EX-COO-513 | Autre module : THM (menu Alertes Pré-Prod, thèmes proches) / coo1 |
| EX-FIX-501 | RG-COO-248 |
| EX-FIX-502 | Autre module : GEN (génération du fichier de production multi-rouleuse) |
| EX-FIX-503 | RG-X-076, RG-COO-242 ; Q-265, Q-266 |
| EX-FIX-504 | RG-COO-245 ; Q-270 |
| EX-FIX-505 | RG-COO-238, RG-COO-239 ; Q-269 |
| EX-FIX-506 | RG-COO-239 (mention) ; module probable REC (surplus compté en entretien) ; Q-288 |
| EX-FIX-507 | Autre module : GEN (taille de rouleau max de la multi-rouleuse) |
| EX-FIX-508 | RG-COO-238, RG-COO-239, RG-COO-203 ; Q-256 |
| EX-FIX-509 | RG-COO-244, RG-COO-223, RG-X-082 ; Q-268 |
| EX-FIX-510 | RG-COO-240 ; Q-265 (BLOQUANTE) |
| EX-FIX-511 | Autre module : PIL (suivi de prod enrichi) ; consomme les statuts d'unité (RG-COO-208, RG-COO-280) |
| EX-SCR-501 | RG-COO-303 (mention, hors périmètre initial) ; Q-278 |
| EX-SCR-502 | RG-COO-303 ; Q-278 |
| EX-SCR-503 | Autre module : GEN (fichiers de production Vendôme) |
| EX-SCR-504 | Autre module : PIL (tableaux de suivi de prod consolidés) ; Q-278 |
| EX-SCR-505 | Info : besoin non défini, en attente d'un exemple (génération de fichier, GEN) ; aucune RG |
| EX-SCR-506 | RG-COO-222 (raccrochage en masse) ; Q-261 |
| EX-SCR-507 | RG-COO-234 ; Q-262 |
| EX-SCR-508 | RG-COO-235 (UX : affichage annonceur 1 – thème 1 / annonceur 2 – thème 2) |
| EX-SCR-509 | RG-COO-228 |
| EX-SCR-510 | RG-COO-227 |
| EX-SCR-511 | RG-COO-296 ; Q-287 |
| EX-SCR-512 | RG-COO-229 ; Q-286 |
| EX-SCR-513 | UX seulement : vignette lien vers le visuel dans le Suivi par thème (RG-COO-230 pour la vue) |
| EX-SCR-514 | Autre module : GEN (saturation à la génération des fichiers, seuil « trop fait » non défini) |
| EX-SCR-515 | Q-278 (reporting MUI du lundi, hors périmètre initial) ; RG-COO-303 |
| EX-SCR-516 | Q-278 (synthèse du jeudi + commentaires, hors périmètre initial) |
| EX-SCR-517 | RG-X-087 ; Q-281 (contradiction avec EX-STK-001) |
| EX-SCR-518 | RG-COO-216 (décision d'abandon : l'utilisateur supprime les lignes à la main pour arriver à 20 tiroirs) |
| EX-PIL-501 | RG-COO-208 (B = trains 100 % visuels reçus), RG-X-079 ; formules et écran : autre module PIL |
| EX-PIL-502 | RG-COO-237 (demies haut / bas Nîmes, fait, reste à faire) ; reste des colonnes : autre module PIL ; Q-264 |
| EX-BUS-501 | Autre module : REC / INT (réceptions attendues Bus hors Nanterre, saisie des quantités) ; Q-279 |
| EX-BUS-502 | RG-COO-305 ; Q-279 |
| EX-BUS-503 | RG-COO-304 ; Q-279 |
| EX-BUS-504 | Autre module : REC / TRA (visibilité des anomalies de réception Bus) ; Q-279 |
| EX-EXP-501 | Autre module : EXP (bouton « envoi manuel » dans Préparer colis pour les trains) ; RG-COO-270 en interface |
| EX-EXP-502 | Autre module : EXP (comptage des bagues du Milk par scan) |
| EX-EXP-503 | RG-COO-267 (retrait en masse d'un train d'un colis) ; module EXP |
| EX-EXP-504 | Autre module : EXP (consulter le contenu d'un colis depuis Préparation) |
| EX-EXP-505 | Autre module : EXP (BL Geodis dans Liste des colis) ; Q-284 |
| EX-EXP-506 | RG-COO-266 ; Q-272 |
| EX-STK-001 | RG-X-087 ; module STK pour le calcul du stock ; Q-281 |
| EX-STK-005 | RG-X-087 ; Q-281 |
| EX-ADM-503 | RG-COO-218, RG-COO-301 ; Q-277, Q-286 |
| EX-ADM-504 | Autre bloc : coo1 / ADM (listes de distribution) ; RG-X-075 |
| EX-COO-001 | RG-X-083, RG-X-084, RG-COO-211 |
| EX-COO-003 | RG-COO-212 (acteurs : export par la Coordination) ; autres acteurs : coo1 |
| EX-COO-014 | RG-X-084 (la validation admin ne conditionne pas les UM) ; effets de la validation admin : coo1 |
| EX-COO-020 | RG-COO-206 (effet sur les faces) ; statuts d'instruction : coo1 |
| EX-COO-021 | RG-COO-200, RG-COO-201, RG-COO-202, RG-COO-203, RG-COO-205 |
| EX-COO-022 | RG-X-078 ; moment de l'Instruction OK automatique : coo1 ; Q-251 |
| EX-COO-023 | RG-COO-202 (répartition à 100 %), RG-COO-238 (entretien 8 %), RG-COO-231 (reste en place) ; contrôle automatique : coo1 |
| EX-COO-024 | RG-COO-210, RG-COO-211, RG-COO-212, RG-COO-213, RG-COO-214, RG-COO-215, RG-COO-216, RG-COO-217 ; Q-251, Q-252, Q-253, Q-254 |
| EX-COO-025 | RG-COO-240, RG-COO-241 ; Q-265 |
| EX-COO-034 | RG-COO-231 (quantité hors « reste en place ») ; ligne attendue Broadcast : coo1 |
| EX-COO-038 | RG-COO-273 (semaines ISO du flux AMT) ; fenêtre S à S+8 : coo1 |
| EX-COO-044 | RG-X-083, RG-X-085, RG-COO-212 (jalons 5, 6 et 7) |
| EX-COO-045 | RG-X-085 ; rattachements : coo1 / REC |
| EX-COO-050 | RG-COO-228, RG-COO-251 ; Q-261 (Q46) ; écran « liste des instructions » : coo1 |
| EX-COO-004 à 019 sauf 014, 020 à 023, 026 à 033, 035 à 037, 039 à 043, 046 à 049 | Autre bloc : coo1 (validation admin, Instruction OK, réceptions attendues, alertes pré-production, alimentation) |
| EX-EXI-030 | RG-COO-206, RG-COO-217, RG-COO-220 et section 3 (statuts) |
| EX-EXI-031 | RG-COO-200, RG-COO-202 ; rôle de l'Instruction OK : coo1 |
| EX-EXI-032 | Autre bloc : coo1 (Instruction OK à la main et automatique) ; RG-COO-243 pour le renvoi à la Pré-Prod |
| EX-EXI-033 | RG-COO-209, RG-COO-210, RG-COO-213, RG-COO-216 ; Q-253 |
| EX-EXI-034 | RG-COO-230, RG-COO-231, RG-COO-233 |
| EX-EXI-035 | RG-COO-215, RG-COO-235, RG-COO-236, RG-COO-299, RG-COO-216 |
| EX-EXI-036 | RG-COO-221, RG-COO-222, RG-X-086 |
| EX-EXI-037 | RG-COO-233, RG-COO-234, RG-COO-236, RG-COO-237 |
| EX-EXI-040 | RG-COO-241 |
| EX-EXI-041 | RG-COO-240, RG-COO-260, RG-COO-261 ; Q-265 |
| EX-EXI-042 | RG-COO-249, RG-COO-250, section 3 ; Q-250 |
| EX-EXI-043 | RG-COO-240, RG-COO-246 |
| EX-EXI-044 | Autre module : EXP (expédition 2 m² fixe) ; RG-COO-265, RG-COO-268 en interface |
| EX-EXI-045 | RG-COO-243, RG-COO-249 ; Q-267 |
| EX-EXI-085 | RG-COO-266, RG-COO-267 ; module EXP |
| EX-EXI-017 | Autre bloc : coo1 (intégration fixe et pliage) ; RG-COO-248 |
| EX-EXI-018 | Autre bloc : coo1 (intégration déroulant) ; RG-COO-207, RG-X-078 |
| EX-EXI-019 | Autre bloc : coo1 (bascule de la ligne attendue) |
| EX-EXI-020 | RG-COO-243, RG-COO-278 ; déblocage de préparation : coo1 |
| EX-EXI-070 | Section 3 (statuts) ; RG-COO-206, RG-COO-217 |
| EX-EXI-071 | RG-COO-241 (« À traiter » de la ligne fixe) ; Q-250 |
| EX-EXI-072 | RG-COO-269 |
| EX-EXI-073 | RG-X-080, RG-COO-260 (grains) |
| EX-EXI-075 | RG-COO-203, RG-COO-204, RG-COO-238 ; Q-256 |
| EX-EXI-076 | RG-X-087 ; Q-281 |
| EX-EXI-077 | RG-COO-212 ; RG-X-075 |
| EX-EXI-078 | RG-X-075, RG-X-076, RG-X-077 ; Q-282 |
| EX-EXI-079 | RG-COO-244 ; gestion des thèmes : THM |
| EX-TRA-024 | RG-COO-306 (impressions du bloc) ; feuille de stock : REC |
| EX-TRA-025 | RG-COO-246, RG-COO-296, RG-COO-299, RG-COO-306 |
| EX-TRA-026 | RG-COO-306 ; Q-002, Q-287 |
| EX-TRA-031 | RG-X-075, RG-X-076, RG-X-077, RG-COO-295 ; catalogue d'alertes : coo1 / TRA |
| EX-TRA-034 | RG-COO-307 |
