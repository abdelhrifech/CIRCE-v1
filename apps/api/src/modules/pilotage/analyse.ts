import { formatSemaineIso, type AnalyseProductionQuerySchema } from '@circe/shared'
import type { z } from 'zod'
import type { Db } from '../../core/db.ts'
import type { Identity } from '../../core/identity.ts'
import { assertPermission } from '../../core/permissions/permissions.ts'
import { ateliersDuPerimetre, construireTrains, facesDesTrains } from '../coordination/trains.ts'
// EX-NEW16-REP-001 — analyse en lecture seule : même définition des trains produits que la préparation.
export async function analyserProduction(
  db: Db,
  identity: Identity,
  q: z.infer<typeof AnalyseProductionQuerySchema>,
) {
  assertPermission(identity, 'train.consulter')
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter(
    (a) => identity.siteId === null || a.plateformeId === identity.siteId,
  )
  const faces = await facesDesTrains(db, ateliers, { atelierId: q.atelier })
  const trains = (await construireTrains(db, faces, ateliers)).filter(
    (t) =>
      ['PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'].includes(t.statut) &&
      (!q.du || t.depart.toISOString().slice(0, 10) >= q.du) &&
      (!q.au || t.depart.toISOString().slice(0, 10) <= q.au),
  )
  const rouleurs = new Map(
    (
      await db.rouleur.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                trains.flatMap((t) =>
                  t.faces.flatMap((f) => (f.rouleurId === null ? [] : [f.rouleurId])),
                ),
              ),
            ],
          },
        },
      })
    ).map((r) => [r.id, r.nom]),
  )
  return {
    ateliers: ateliers.map((a) => ({ id: a.id, libelle: a.libelle, plateforme: a.plateforme })),
    trains: trains.map((t) => ({
      id: t.trainId,
      rouleur:
        [
          ...new Set(
            t.faces.flatMap((f) => {
              const nom = f.rouleurId === null ? undefined : rouleurs.get(f.rouleurId)
              return nom ? [nom] : []
            }),
          ),
        ].join(', ') || null,
      machine: null,
      atelier: t.atelier?.libelle ?? '—',
      site: t.atelier?.plateforme ?? '—',
      depart: formatSemaineIso(t.semaineDepart),
      statut: t.statut,
    })),
  }
}
