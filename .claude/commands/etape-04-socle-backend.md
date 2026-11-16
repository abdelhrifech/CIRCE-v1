---
description: Étape 4 — Socle backend commun (auth, permissions, erreurs, transactions, concurrence, idempotence, audit)
---

Étape 4 de docs/MISSION.md : SOCLE BACKEND. Respecte les décisions sur l'authentification dans docs/QUESTIONS_OUVERTES.md ; si elles ne sont pas tranchées, implémente resolveIdentity avec un fournisseur de dev (en-tête signé, désactivé en production) et note-le comme écart.

Implémente dans apps/api/src/core :

1. Identité et contexte de requête (userId, profils, site).
2. Rôles → permissions (depuis la matrice profils × actions des docs de règles métier) ; `assertPermission`.
3. Erreurs normalisées `{ code, message, details?, regle? }` et mapping HTTP (CLAUDE.md §6).
4. Helpers : transaction, mise à jour avec contrôle de version, `withIdempotency`, écriture d'historique de statut, journal d'audit.
5. Pagination/tri/filtre standards pour les listes.
6. Côté web : client API typé (gestion 401/403/409/422), composant d'affichage d'erreur, garde de routes selon permissions (confort UX seulement : le backend reste juge).

Tests : unitaires sur chaque helper, intégration sur un endpoint factice (permission 403, conflit de version 409, idempotence, rollback de transaction). Mets à jour la matrice et le plan.
