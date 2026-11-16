import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { MeResponseSchema, MesSitesSchema } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdentity } from '../../core/identity.ts'
import { permissionsOf } from '../../core/permissions/permissions.ts'

/** GET /api/me : identité et permissions (le front s'en sert pour l'affichage ; le serveur reste juge). */
export function meRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()
  r.get('/me', { schema: { response: { 200: MeResponseSchema } } }, (request) => {
    const identity = requireIdentity(request)
    return {
      userId: identity.userId,
      identifiantExterne: identity.identifiantExterne,
      nom: identity.nom,
      roles: identity.roles,
      permissions: permissionsOf(identity.roles),
      perimetre: {
        toutesPlateformes: identity.perimetre.toutesPlateformes,
        plateformeIds: identity.perimetre.plateformeIds,
      },
      siteId: identity.siteId,
    }
  })

  // EX-TRA-006 / ECR-NAV-01 : sites du sélecteur du bandeau = plateformes du périmètre de l'utilisateur (toutes pour
  // l'administrateur, RG-COO-167). Aucune permission métier : la liste ne révèle que le périmètre déjà attribué.
  r.get('/me/sites', { schema: { response: { 200: MesSitesSchema } } }, async (request) => {
    const { perimetre } = requireIdentity(request)
    const sites = await db.plateforme.findMany({
      where: perimetre.toutesPlateformes ? {} : { id: { in: perimetre.plateformeIds } },
      orderBy: [{ nom: 'asc' }, { id: 'asc' }],
      select: { id: true, nom: true },
    })
    return { sites }
  })
}
