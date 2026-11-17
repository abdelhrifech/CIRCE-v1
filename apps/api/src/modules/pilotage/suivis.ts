import { type z } from 'zod'
import {
  type SuiviAtelierQuerySchema,
  statutNc,
  NcDonneesSchema,
  NC_DECISIONS,
} from '@circe/shared'
import { z as schema } from 'zod'
import type { Db } from '../../core/db.ts'
import type { Identity } from '../../core/identity.ts'
import { assertPermission } from '../../core/permissions/permissions.ts'
import { peutVoirAtelier } from '../coordination/permissions.ts'
import { lireTypes, typeDe } from '../coordination/unitaire.ts'
// EX-NEW16-COO-001 — suivi par visuel et étapes ; lecture seule, aucun changement d’état.
export async function suiviAtelier(
  db: Db,
  identity: Identity,
  q: z.infer<typeof SuiviAtelierQuerySchema>,
) {
  assertPermission(identity, 'instruction.consulter')
  const types = await lireTypes(db)
  const scope =
    identity.siteId !== null
      ? { plateformeId: identity.siteId }
      : identity.perimetre.toutesPlateformes
        ? {}
        : { plateformeId: { in: identity.perimetre.plateformeIds } }
  const lignes = await db.receptionAttendue.findMany({
    where: {
      ...scope,
      ...(q.dossier ? { contNum: q.dossier } : {}),
      ...(q.depart
        ? { semAnnee: Number(q.depart.slice(0, 4)), semNum: Number(q.depart.slice(6)) }
        : {}),
      etatLigne: 'ACTIVE',
    },
    include: {
      plateforme: true,
      support: true,
      atelier: true,
      rattachements: { where: { actif: true }, include: { affiche: true } },
    },
    orderBy: [{ contNum: 'asc' }, { id: 'asc' }],
  })
  const repartTypes = await db.repartition.findMany({
    where: { retire: false },
    select: { contNum: true, typePreparationId: true, atelierId: true },
  })
  const visibles = lignes.filter(
    (l) =>
      peutVoirAtelier(identity, l.atelier) &&
      (!q.pour ||
        (q.pour === 'deroulant'
          ? l.atelier?.type === 'SCROLL'
          : l.atelier?.type !== 'SCROLL' &&
            repartTypes.some(
              (r) =>
                r.contNum === l.contNum &&
                r.atelierId === l.atelierId &&
                typeDe(r, types) === q.pour,
            ))),
  )
  const ncs = await db.nonConformite.findMany({ where: scope })
  const items = []
  for (const l of visibles) {
    const filtre = { atelierId: l.atelierId, contNum: l.contNum, theme: l.theme }
    const [faces, reparts, instructions] = await Promise.all([
      db.faceTrain.groupBy({
        by: ['statut'],
        where: { ...filtre, depAnbas: l.semAnnee, depSembas: l.semNum },
        _count: { _all: true },
      }),
      db.repartition.groupBy({
        by: ['statut'],
        where: { ...filtre, semAnnee: l.semAnnee, semNum: l.semNum, retire: false },
        _count: { _all: true },
      }),
      db.instruction.findMany({
        where: {
          contNum: l.contNum,
          atelierId: l.atelierId,
          contAnbas: l.semAnnee,
          contSembas: l.semNum,
        },
        select: { statut: true },
      }),
    ])
    const etats = [...faces, ...reparts],
      resume = etats.map((e) => `${e.statut} (${e._count._all})`).join(' · ')
    const affs = l.rattachements.map((r) => r.affiche),
      recu = l.rattachements.reduce((s, r) => s + r.quantite, 0)
    const nc = ncs.filter((n) => {
      const d = NcDonneesSchema.parse(JSON.parse(n.donnees))
      const ids = schema.array(schema.number()).parse(JSON.parse(n.afficheIds))
      return (
        n.plateformeId === l.plateformeId &&
        (ids.some((id) => affs.some((a) => a.id === id)) ||
          (!!l.contNum &&
            (d.dossier.match(/\d+/g) ?? []).some((v) => v === String(l.contNum)) &&
            d.theme === l.theme)) &&
        ['À décider', 'En cours plateforme'].includes(
          statutNc(
            n.bloquante,
            schema.array(schema.enum(NC_DECISIONS)).parse(JSON.parse(n.decisions)),
          ),
        )
      )
    }).length
    items.push({
      id: l.id,
      dossier: l.contNum,
      annonceur: l.annonceur,
      theme: l.theme,
      format: l.format ?? l.support.nom,
      site: l.plateforme.nom,
      atelier: l.atelier?.libelle ?? '—',
      depart: `${l.semAnnee}-W${String(l.semNum).padStart(2, '0')}`,
      preparation:
        [...new Set(instructions.map((i) => i.statut))].join(' · ') || 'Préparation non reçue',
      reception: l.statut,
      production: resume || 'Aucune unité',
      expedition:
        etats
          .filter((e) => ['COLISE', 'EXPEDIE', 'LIVRE', 'TERMINE'].includes(e.statut))
          .map((e) => `${e.statut} (${e._count._all})`)
          .join(' · ') || 'Aucune expédition',
      nc,
      attendu: l.qtePrepa ?? l.qteBc,
      recu,
      validees: affs.filter((a) => a.validationAdmin).length,
      affiches: [...new Set(affs.map((a) => a.id))],
    })
  }
  return { items }
}
