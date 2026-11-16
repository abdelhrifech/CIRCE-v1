import { defineConfig } from 'vitest/config'

// Config dédiée : n'embarque pas les plugins TanStack Start / Nitro de vite.config.ts.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
