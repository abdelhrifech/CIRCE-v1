import {
  formatSemaineIso,
  type StockLigne,
  type StockQuery,
  type MouvementStockQuerySchema,
} from '@circe/shared'
import type { z } from 'zod'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import type { Identity } from '../../core/identity.ts'
import { assertPermission } from '../../core/permissions/permissions.ts'
import type { Prisma } from '../../generated/prisma/client.ts'
type Client = Db | Tx
export const scopeStock = (i: Identity) =>
  i.siteId !== null
    ? { plateformeId: i.siteId }
    : i.perimetre.toutesPlateformes
      ? {}
      : { plateformeId: { in: i.perimetre.plateformeIds } }
export const idsDossiers = (texte: string | undefined) =>
  texte
    ?.split(/[,;\s]+/)
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0) ?? []
const inclure = {
  plateforme: true,
  support: true,
  mouvements: { orderBy: [{ date: 'desc' }, { id: 'desc' }] },
  rattachements: {
    where: { actif: true },
    orderBy: { id: 'asc' },
    include: { ligneAttendue: { include: { atelier: true } } },
  },
} satisfies Prisma.AfficheInclude
// RG-REC-153 réutilisée en lecture : aucune quantité de la maquette ni cache supposé à jour.
export async function lireStock(db: Client, i: Identity, dossiers?: number[]) {
  assertPermission(i, 'stock.consulter')
  const affiches = await db.affiche.findMany({
    where: {
      ...scopeStock(i),
      ...(dossiers
        ? { rattachements: { some: { actif: true, ligneAttendue: { contNum: { in: dossiers } } } } }
        : {}),
    },
    include: inclure,
    orderBy: { id: 'asc' },
  })
  const items: StockLigne[] = affiches.map((a) => ({
    id: a.id,
    version: a.version,
    plateformeId: a.plateformeId,
    site: a.plateforme.nom,
    annonceur: a.contAnnonc,
    theme: a.theme,
    dossiers: [
      ...new Set(
        a.rattachements.flatMap((r) =>
          r.ligneAttendue.contNum === null ? [] : [r.ligneAttendue.contNum],
        ),
      ),
    ],
    semaines: [
      ...new Set(
        a.rattachements.map((r) =>
          formatSemaineIso({ annee: r.ligneAttendue.semAnnee, semaine: r.ligneAttendue.semNum }),
        ),
      ),
    ].sort(),
    emplacement: `${a.allee ?? '—'}-${a.rayon ?? '—'}`,
    allee: a.allee,
    format: a.support.nom,
    recu: a.mouvements
      .filter((m) => ['RECEPTION', 'COMPLEMENT', 'ECART_CONTROLE'].includes(m.type))
      .reduce((s, m) => s + m.quantite, 0),
    sorties: -a.mouvements
      .filter((m) => m.type === 'EXPEDITION')
      .reduce((s, m) => s + m.quantite, 0),
    rebut: -a.mouvements
      .filter((m) => m.type === 'MISE_AU_REBUT')
      .reduce((s, m) => s + m.quantite, 0),
    disponible: a.mouvements.reduce((s, m) => s + m.quantite, 0),
    conserver: a.aConserver,
    derniereSortie: a.mouvements.find((m) => m.auto && m.quantite < 0)?.date.toISOString() ?? null,
    fusionnee: a.estFusionne,
  }))
  return { affiches, items }
}
export async function listerStocks(
  db: Client,
  i: Identity,
  q: StockQuery,
  maintenant = new Date(),
) {
  const { items, affiches } = await lireStock(db, i),
    dossiers = idsDossiers(q.dossier)
  const rows = items.filter(
    (a) =>
      (!q.dossier || dossiers.some((d) => a.dossiers.includes(d))) &&
      (!q.depart || !a.semaines.length || a.semaines.includes(q.depart)) &&
      (!q.format || a.format === q.format) &&
      (!q.allee || a.allee === q.allee) &&
      (!q.q ||
        `${a.id} ${a.annonceur} ${a.theme} ${a.dossiers.join(' ')}`
          .toLocaleLowerCase('fr')
          .includes(q.q.toLocaleLowerCase('fr'))) &&
      (!q.etat ||
        (q.etat === 'stock'
          ? a.disponible > 0
          : q.etat === 'epuise'
            ? a.disponible <= 0
            : q.etat === 'conserver'
              ? a.conserver
              : a.rebut > 0)),
  )
  const ids = new Set(rows.map((a) => a.id))
  const debut = new Date(maintenant)
  debut.setHours(0, 0, 0, 0)
  return {
    items: rows,
    indicateurs: {
      disponible: rows.reduce((s, a) => s + Math.max(0, a.disponible), 0),
      reliquats: rows.filter((a) => a.conserver).reduce((s, a) => s + Math.max(0, a.disponible), 0),
      visuelsConserves: rows.filter((a) => a.conserver).length,
      rebut: rows.reduce((s, a) => s + a.rebut, 0),
      sortiesAujourdhui: -affiches
        .filter((a) => ids.has(a.id))
        .flatMap((a) => a.mouvements)
        .filter((m) => m.auto && m.quantite < 0 && m.date >= debut)
        .reduce((s, m) => s + m.quantite, 0),
    },
  }
}
export async function listerMouvementsStocks(
  db: Client,
  i: Identity,
  q: z.infer<typeof MouvementStockQuerySchema>,
) {
  assertPermission(i, 'stock.consulter')
  const dossiers = idsDossiers(q.dossier)
  const where: Prisma.MouvementWhereInput = {
    affiche: {
      ...scopeStock(i),
      ...(q.dossier
        ? { rattachements: { some: { actif: true, ligneAttendue: { contNum: { in: dossiers } } } } }
        : {}),
    },
    ...(q.auto ? { auto: q.auto === 'oui' } : {}),
    ...(q.du || q.au
      ? {
          date: {
            ...(q.du ? { gte: new Date(`${q.du}T00:00:00`) } : {}),
            ...(q.au ? { lt: new Date(new Date(`${q.au}T00:00:00`).getTime() + 86400000) } : {}),
          },
        }
      : {}),
  }
  const [rows, users] = await Promise.all([
    db.mouvement.findMany({
      where,
      include: {
        affiche: {
          include: {
            plateforme: true,
            rattachements: { where: { actif: true }, include: { ligneAttendue: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    }),
    db.utilisateur.findMany({ select: { id: true, nom: true, identifiantExterne: true } }),
  ])
  const noms = new Map(users.map((u) => [u.id, u.nom ?? u.identifiantExterne]))
  const items = rows
    .map((m) => ({
      id: m.id,
      date: m.date.toISOString(),
      afficheId: m.afficheId,
      site: m.affiche.plateforme.nom,
      dossiers: [
        ...new Set(
          m.affiche.rattachements.flatMap((r) =>
            r.ligneAttendue.contNum === null ? [] : [r.ligneAttendue.contNum],
          ),
        ),
      ],
      type: m.type,
      quantite: m.quantite,
      par:
        m.createdById === null ? 'Automatique' : (noms.get(m.createdById) ?? 'Utilisateur inconnu'),
      automatique: m.auto,
      motif: m.motif,
    }))
    .filter(
      (m) =>
        (!q.type || m.type === q.type) &&
        (!q.par || m.par.toLocaleLowerCase('fr').includes(q.par.toLocaleLowerCase('fr'))) &&
        (!q.q ||
          `${m.afficheId} ${m.type} ${m.motif ?? ''} ${m.par}`
            .toLocaleLowerCase('fr')
            .includes(q.q.toLocaleLowerCase('fr'))),
    )
  return {
    items: items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    total: items.length,
    page: q.page,
    pageSize: q.pageSize,
  }
}
