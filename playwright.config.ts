import { defineConfig } from '@playwright/test'

// E2E sur la base de test (.env.test) : API sur 3101, web sur 3100.
// Le web tourne en `vite dev` : le relais /api y injecte l'identité de dev (DEV_IDENTITY_USER, Q-001),
// ce que le build de production ne fait jamais. Données : apps/api/scripts/e2e-seed.ts.
const apiPort = 3101
const webPort = 3100
// COO-P01 : second serveur web de test, identité de dev e2e.coord (rôle coord), pour les écrans Coordination.
const webCoordPort = 3102
// COO-P11 : troisième serveur web de test, identité de dev e2e.chef (rôle cheq), pour le dispatch, les bagues et le suivi 8 m².
const webChefPort = 3103
// Étape 8 (D-05) : quatrième serveur web de test, identité de dev e2e.admin (rôle admin), pour les référentiels.
const webAdminPort = 3104
const secret = 'test-only-secret-not-for-production'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${webPort}` },
  projects: [
    {
      name: 'reception',
      testIgnore: /(coordination|roulage).*\.spec\.ts|[\\/]admin-[^\\/]*\.spec\.ts$/,
    },
    {
      name: 'coordination',
      testMatch: /coordination.*\.spec\.ts/,
      use: { baseURL: `http://127.0.0.1:${webCoordPort}` },
    },
    {
      name: 'admin',
      testMatch: /[\\/]admin-[^\\/]*\.spec\.ts$/,
      use: { baseURL: `http://127.0.0.1:${webAdminPort}` },
    },
    {
      name: 'roulage',
      testMatch: /roulage.*\.spec\.ts/,
      use: { baseURL: `http://127.0.0.1:${webChefPort}` },
    },
  ],
  webServer: [
    {
      command:
        'pnpm --filter @circe/api db:test:up && pnpm --filter @circe/api e2e:seed && pnpm --filter @circe/api exec tsx --env-file=../../.env.test src/server.ts',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      env: { ADMIN_PORT: '0' },
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: `pnpm --filter @circe/web exec vite dev --port ${webPort} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        API_URL: `http://127.0.0.1:${apiPort}`,
        DEV_IDENTITY_USER: 'e2e.recep',
        DEV_IDENTITY_SECRET: secret,
        NODE_ENV: 'development',
      },
    },
    {
      command: `pnpm --filter @circe/web exec vite dev --port ${webCoordPort} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${webCoordPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        API_URL: `http://127.0.0.1:${apiPort}`,
        DEV_IDENTITY_USER: 'e2e.coord',
        DEV_IDENTITY_SECRET: secret,
        NODE_ENV: 'development',
      },
    },
    {
      command: `pnpm --filter @circe/web exec vite dev --port ${webChefPort} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${webChefPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        API_URL: `http://127.0.0.1:${apiPort}`,
        DEV_IDENTITY_USER: 'e2e.chef',
        DEV_IDENTITY_SECRET: secret,
        NODE_ENV: 'development',
      },
    },
    {
      command: `pnpm --filter @circe/web exec vite dev --port ${webAdminPort} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${webAdminPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        API_URL: `http://127.0.0.1:${apiPort}`,
        DEV_IDENTITY_USER: 'e2e.admin',
        VITE_CACHE_DIR: 'node_modules/.vite-e2e-admin',
        DEV_IDENTITY_SECRET: secret,
        NODE_ENV: 'development',
      },
    },
  ],
})
