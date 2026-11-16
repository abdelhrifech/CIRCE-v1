# Transfert des JDD E2E vers les trois centres — 12 novembre 2026

Demande utilisateur : ne rien supprimer ; transférer les JDD des sites techniques vers Wissous, Nîmes et Nanterre. Opération limitée à la base locale de développement, sans changement des règles métier ni des sources.

Les ensembles de chaque plateforme E2E sont répartis successivement entre les trois centres en conservant les ateliers et leurs identifiants. Les ateliers ne sont pas fusionnés : leurs trains, instructions, rouleurs et préparations conservent ainsi leurs liens. Les anciennes plateformes et leurs périmètres historiques restent présents. Les accès aux centres de destination sont ajoutés aux utilisateurs E2E concernés sans doublon ; les profils locaux et les droits globaux administrateur sont conservés.

| Plateforme source | Destination | Lignes déplacées ou accès ajoutés |
|---|---|---|
| Plateforme E2E 1793983329440 | Wissous | perimetresAjoutes : 2, tr_atelier : 1, reception : 1, affiche : 2, tf_prepa_affiche : 9 |
| Plateforme E2E VA 1793983329503 | Nîmes | perimetresAjoutes : 1, reception : 2, affiche : 5, tf_prepa_affiche : 4 |
| Plateforme E2E EDR 1793983329531 | Nanterre | perimetresAjoutes : 1, tf_prepa_affiche : 4, tf_prepa_Broadcast : 4 |
| Plateforme E2E THM 1793983329567 | Wissous | affiche : 2, tf_prepa_affiche : 9 |
| Plateforme E2E DEB 1793983329596 | Nîmes | tr_atelier : 1, tf_prepa_Broadcast : 2 |
| Plateforme E2E TRN 1793983329610 | Nanterre | tr_atelier : 1, affiche : 1, tf_prepa_affiche : 1 |
| Plateforme E2E EXP 1793983329627 | Wissous | tr_atelier : 1, affiche : 1, tf_prepa_affiche : 1 |
| Plateforme E2E ROU 1793983329648 | Nîmes | perimetresAjoutes : 1, tr_atelier : 1, affiche : 4, tf_prepa_affiche : 4 |
| Plateforme E2E UNI 1793983329675 | Nanterre | tr_atelier : 2 |
| Plateforme E2E EXP 1793983329717 | Wissous | perimetresAjoutes : 1, tr_atelier : 1, affiche : 1 |

Bilan : 16 affiches, 32 attendus, 3 réceptions, 8 ateliers et 6 lignes Broadcast transférés ; 6 périmètres ajoutés. Les références de site CCF des données Broadcast de démonstration sont adaptées au centre destinataire. Les dossiers, stocks, photos, quantités, rattachements et historiques ne sont pas recréés. Les ateliers et les enregistrements versionnés déplacés reçoivent une nouvelle version. Chaque transfert est tracé dans le journal d’audit.

## Vérifications

- Simulation transactionnelle préalable avec annulation de toutes ses écritures.
- Sauvegarde SQLite cohérente avant application, puis transaction unique.
- Aucun nombre de lignes diminué dans aucune table ; seules les traces d’audit et les périmètres supplémentaires sont ajoutés.
- Mouvements, photos, livraisons, rattachements et historiques de statut strictement inchangés.
- `integrity_check = ok`, aucune erreur de clé étrangère ; attendus/ateliers et rattachements actifs/affiches cohérents par centre.
- Nouvelle simulation après application : zéro modification proposée.
- ESLint et Prettier du script : réussis.
- Après redémarrage, attendus, dossiers, ateliers et tableau de bord répondent 200 en accès global puis pour chacun des trois centres (16 lectures). Administrateur : 64 permissions et accès à toutes les plateformes.
- Redémarrage habituel : les graines ignorent les JDD déjà présents et ne reconstituent pas les données sur les sites sources.

Les anciennes plateformes apparaissent encore dans le sélecteur administrateur : elles sont conservées à la demande de l’utilisateur. Leurs ateliers, réceptions, affiches et attendus ont été transférés. Les libellés E2E des anciens scénarios et ateliers sont conservés pour leur traçabilité.

## Maintenance

Simulation : `node scripts/transfert-jdd-centres.mjs`. Application avec sauvegarde : `node scripts/transfert-jdd-centres.mjs --apply`. Le script refuse la production et utilise exclusivement `apps/api/prisma/dev.db`. Il refuse les anciens sites contenant des données des nouveaux modules nécessitant une reprise spécifique ; aucun effacement ni fusion implicite n’est effectué.

Rapport : `docs/_travail/transfert-jdd-centres-2026-11-12.json`.

Sauvegarde locale : `/Users/hrifech/Documents/ChatGPT/CIRCE-CLAUDE-GV1/circe-v1/apps/api/prisma/dev-avant-transfert-jdd-2026-11-12T13-57-51-543Z.db`.


## Suppression ultérieure explicitement demandée

Après le transfert, l’utilisateur demande « supprime les ». Les 10 plateformes E2E désormais vides sont supprimées, avec leurs 11 anciens périmètres techniques. Les accès aux centres destinataires ajoutés lors du transfert restent présents. Toutes les autres tables métier conservent leurs effectifs ; les historiques sont conservés et dix traces de suppression sont ajoutées au journal d’audit. Une sauvegarde `dev-avant-suppression-sites-e2e-*.db` est conservée à côté de la base. Intégrité SQLite : OK ; aucune clé étrangère invalide.

Le démarrage normal n’appelle plus le générateur E2E de démonstration : il charge les graines des trois centres et des nouvelles spécifications. Le générateur des tests E2E reste inchangé pour la base de test. ESLint et Prettier du script de démarrage : réussis.
