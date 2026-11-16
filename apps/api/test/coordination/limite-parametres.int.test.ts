// ANO-049 — limite de paramètres de SQLite / Prisma : les ateliers d'un administrateur (tous les sites) alimentent
// des clauses `IN (...)`. Sur une base de plus d'un millier d'ateliers (la base de test les accumule), l'export, la liste
// des trains et le générateur répondaient 500 « The query parameter limit supported by your database is exceeded »
// (même classe que ANO-035). Les lectures se font maintenant par paquets (`parPaquets`).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ExportApercuSchema, ListeTrainsSchema, TrainsGenerationSchema } from '@circe/shared'
import * as f from '../factories/index.ts'
import { contexteReception, get } from '../support/reception.ts'
import { DEPART_TXT, siteDeroulant, trainExportable } from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(async () => {
  await ctx.demarrer()
  // Complète la base jusqu'à 1 300 ateliers déroulants (au-delà de la limite de paramètres observée).
  const existants = await db.atelier.count({ where: { type: 'SCROLL' } })
  if (existants < 1300) {
    const plateforme = await f.createPlateforme(db)
    await db.atelier.createMany({
      data: Array.from({ length: 1300 - existants }, (_, i) => ({
        plateformeId: plateforme.id,
        libelle: `Atelier volume ${String(i)}`,
        type: 'SCROLL' as const,
      })),
    })
  }
})
afterAll(() => ctx.arreter())

describe('ANO-049 lectures des ateliers du périmètre par paquets (administrateur sur toute la base)', () => {
  it('ANO-049 l’aperçu de l’export, la liste des trains et le générateur répondent 200 pour un administrateur (tous les sites) sur plus de 1 000 ateliers', async () => {
    const s = await siteDeroulant(ctx)
    await trainExportable(ctx, s, ['Rose'])
    const admin = s.users.admin.headers
    expect((await db.atelier.count({ where: { type: 'SCROLL' } })) > 1000).toBe(true)
    const apercu = await get(
      ctx,
      `/api/coordination/trains/export/apercu?depart=${DEPART_TXT}`,
      admin,
    )
    expect(apercu.statusCode, apercu.body).toBe(200)
    expect(ExportApercuSchema.parse(apercu.json()).faces).toBeGreaterThanOrEqual(1)
    const liste = await get(
      ctx,
      `/api/coordination/trains?depart=${DEPART_TXT}`,
      s.users.coord.headers,
    )
    expect(liste.statusCode, liste.body).toBe(200)
    ListeTrainsSchema.parse(liste.json())
    const generateur = await get(
      ctx,
      `/api/coordination/generateur?depart=${DEPART_TXT}`,
      s.users.coord.headers,
    )
    expect(generateur.statusCode, generateur.body).toBe(200)
    TrainsGenerationSchema.parse(generateur.json())
  })

  it('ANO-049 l’export réel d’un administrateur passe aussi (lecture par paquets, ordre des faces conservé)', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'])
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/trains/export',
      headers: { ...s.users.admin.headers, 'idempotency-key': `t-limite-${String(Date.now())}` },
      payload: { depart: DEPART_TXT, simulation: true },
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.body).toContain(t.trainId)
  })
})
