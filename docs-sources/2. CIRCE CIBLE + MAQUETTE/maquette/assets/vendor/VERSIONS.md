# Librairies tierces de la maquette

Téléchargées le 14/10/2026 depuis le registre npm officiel (registry.npmjs.org), avec l'accord de la cheffe de projet, **pour les maquettes uniquement**. L'empreinte SHA-512 de chaque archive a été vérifiée contre celle publiée par le registre avant extraction. Aucun script n'a été exécuté pendant l'installation : les fichiers ont seulement été copiés.

| Librairie | Version | Licence | Fichiers copiés | Rôle dans la maquette |
|---|---|---|---|---|
| Tabler (`@tabler/core`) | 1.6.1 | MIT | `tabler/tabler.min.css` | Système de design : composants, typographie, couleurs. Aucun appel réseau (pas de police ni d'image externe). |
| Tabler Icons (`@tabler/icons`) | 3.49.0 | MIT | `tabler-icons/icons.js` | Sous-ensemble de 80 icônes « outline », converti en données JavaScript (pas de police d'icônes). |
| Apache ECharts (`echarts`) | 6.1.0 | Apache-2.0 | `echarts/echarts.min.js`, `NOTICE` | Graphiques du suivi de prod. |
| Tabulator (`tabulator-tables`) | 6.6.1 | MIT | `tabulator/tabulator.min.js`, `tabulator_bootstrap5.min.css` | Tableaux : tri, déplacement et masquage des colonnes, sélection multiple, totaux. |

Chaque dossier contient le fichier `LICENSE` de la librairie (et le `NOTICE` exigé par la licence Apache pour ECharts).

Ces choix valent pour la maquette. Le choix des technologies de l'application cible revient au prestataire.
