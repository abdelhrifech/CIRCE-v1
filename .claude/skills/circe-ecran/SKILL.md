---
name: circe-ecran
description: Procédure pour implémenter un écran CIRCE V2 à partir d'une maquette (TanStack Start/Router, React, Tailwind, Radix), branché sur l'API réelle, sans données MOCK, avec tous les états.
---

# Implémenter un écran CIRCE

## 0. Entrées

- Fiche ECR-xxx dans `docs/_travail/maquettes-<module>.md` + l'image/fichier de maquette d'origine.
- Endpoints existants et testés. Si un endpoint manque : le créer d'abord (skill circe-endpoint).

## 1. Structure

- Route : `apps/web/src/routes/<module>/…` (TanStack Router, file-based).
- Paramètres de liste (filtres, tri, page) dans les search params typés (validation Zod) → URL partageable.
- Chargement via loader / query côté serveur web qui appelle `/api` ; jamais de BDD.
- Composants UI : Radix + Tailwind, composants communs dans `apps/web/src/components/ui`.

## 2. Checklist de conformité maquette

- [ ] Même structure de page, mêmes libellés.
- [ ] Toutes les colonnes, dans le même ordre, avec le même format (dates, montants, codes).
- [ ] Tous les filtres et la recherche, branchés côté API (pas de filtrage client sur une page de données).
- [ ] Toutes les actions ; visibilité selon `GET …/actions` du backend (pas de règle recalculée en front).
- [ ] Modales de confirmation et de saisie (motif de rejet…) comme sur la maquette.
- [ ] Messages de succès/erreur : erreurs API affichées avec leur message métier.
- [ ] États : chargement (skeleton), vide (message), erreur (message + réessayer).
- [ ] Double clic : bouton désactivé pendant la requête + `Idempotency-Key`.
- [ ] Conflit 409 de version : message « modifié par un autre utilisateur » + rechargement.
- [ ] Responsive et accessible (labels, focus, clavier ; Radix aide).
- [ ] AUCUNE donnée MOCK dans le code (`grep` des valeurs vues dans la maquette avant de terminer).

## 3. Test

- E2E Playwright du parcours nominal de l'écran + au moins un cas de rejet visible.
- Sélecteurs par rôle/label, pas par classe CSS.
