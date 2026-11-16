import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Dev : le relais /api/* lit DEV_IDENTITY_SECRET / DEV_IDENTITY_USER / API_URL dans process.env (Q-001). Vite ne charge que
// les variables VITE_* : on charge donc le .env racine (sans écraser les variables déjà définies, ex. par pnpm start:all
// ou Playwright). Absent => rien n'est injecté et l'API répond 401.
try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../.env'))
} catch {
  // pas de .env : variables d'environnement du processus uniquement
}

// Serveur Node (Nitro, preset node-server). Le relais /api/* vers l'API est la route src/routes/api/$.ts.
// Les serveurs web de test (Playwright) partagent le même dossier : un 4e serveur concurrent doit avoir son propre cache de
// dépendances (VITE_CACHE_DIR), sinon les pré-bundles se réécrivent entre serveurs et les pages restent en « Chargement… ».
const cacheDir = process.env['VITE_CACHE_DIR']

export default defineConfig({
  ...(cacheDir ? { cacheDir } : {}),
  plugins: [tailwindcss(), tanstackStart(), nitro({ preset: 'node-server' }), viteReact()],
})
