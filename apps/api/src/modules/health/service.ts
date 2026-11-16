import type { HealthResponse } from '@circe/shared'

/** Ce dont le contrôle de santé a besoin de la base (permet de le tester sans base). */
export interface HealthDb {
  $queryRaw: (query: TemplateStringsArray) => Promise<unknown>
}

export async function checkHealth(db: HealthDb): Promise<HealthResponse> {
  let database: HealthResponse['database'] = 'up'
  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    database = 'down'
  }
  return {
    status: database === 'up' ? 'ok' : 'error',
    database,
    time: new Date().toISOString(),
  }
}
