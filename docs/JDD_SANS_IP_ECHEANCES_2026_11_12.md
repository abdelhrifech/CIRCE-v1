# Complément JDD — Sans IP et échéances à J−3

Demande du 12 novembre 2026 : ajouter des données aux deux indicateurs du tableau de bord. Aucune règle, date système ni paramètre métier modifié.

## Données ajoutées

- 36 réceptions sans IP supplémentaires, 12 par centre. Le total de l’indicateur passe de 3 à **39**, soit 13 pour chacun des centres Wissous, Nîmes et Nanterre.
- Variantes : formats 2 m² fixe et déroulant majoritaires, formats complémentaires, quantités 35/60/100/125, avec/sans BL, contrôlées ou à contrôler. Thème amont absent, intitulé saisi sur l’affiche et rattachement conservé.
- 24 dossiers pour la prochaine échéance, 8 par centre : attendus non reçus ou reçus partiellement, départ 2026-W49, préparation à traiter.
- 12 dossiers à échéance dépassée, 4 par centre, départ 2026-W48.

72 dossiers ajoutés à la série existante ; le catalogue `docs/_travail/jdd-plus-2026-W46.json` répertorie maintenant 222 scénarios. Rechercher **Sans IP · visuel saisi**, **J−3 · prochaine échéance** ou **J−3 · échéance dépassée**.

## Pourquoi l’indicateur J−3 reste à zéro aujourd’hui

Le code existant sélectionne les dossiers à traiter dont la deadline Préproduction est strictement future et située au plus à 72 heures. Cette deadline est calculée par le paramètre `coordination.deadlinePrepa`, actuellement `-2;4;16:00` : jeudi S−2 à 16 h UTC. Ce n’est pas un décompte de tous les dossiers du tableau hebdomadaire J−3.

Au moment du chargement, l’échéance du 12 novembre à 16 h UTC est déjà passée. La prochaine est le 19 novembre à 16 h UTC, soit 17 h à Paris. Les 24 dossiers seront dans la fenêtre de l’indicateur du 16 novembre à 17 h jusqu’avant le 19 novembre à 17 h, s’ils sont toujours à traiter. Il n’existe aucune semaine de départ valide donnant une deadline dans les 72 heures suivant le chargement actuel : remplir ce compteur aujourd’hui exigerait une autre règle, qui n’est pas autorisée ici.

La graine lit le paramètre métier pour choisir la première échéance future. Les données déjà créées ne sont jamais redatées lors d’une relance : leur vieillissement est normal et les essais utilisateur restent conservés.

## Vérifications

- Sauvegarde avant chargement : `apps/api/prisma/dev-avant-sansip-j3-20261112-172508.db`.
- TypeScript, ESLint et Prettier : réussis.
- Réceptions et contrôles créés par les services métier existants, transactions par scénario.
- Intégrité SQLite et clés étrangères : OK ; rattachements sans IP et caches de stock cohérents pour les nouvelles affiches.
- Réexécution : zéro nouveau dossier ; comparaison des empreintes de toutes les tables = aucune modification.
- API de pilotage : 39 réceptions sans IP en accès global, 13 par centre ; J−3 à zéro à la date de chargement.
- Les 24 dossiers de prochaine échéance ont chacun été vérifiés par leur API réelle : à traiter, deadline 19/11/2026 16:00 UTC, non dépassée.

Le démarrage habituel inclut déjà `pnpm seed:scenarios` ; aucune plateforme technique supplémentaire n’est créée.
