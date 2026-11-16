// Accès aux données du module Réception (aucune règle métier ici).
import type { Tx } from '../../core/transaction.ts'
import type { Db } from '../../core/db.ts'

type Client = Db | Tx

export function trouverReception(client: Client, id: number) {
  return client.reception.findUnique({
    where: { id },
    include: { livraison: { select: { reference: true } }, _count: { select: { affiches: true } } },
  })
}

export function historiqueReception(client: Client, id: number) {
  return client.statutHistorique.findMany({
    where: { typeEntite: 'RECEPTION', entiteId: String(id) },
    orderBy: [{ le: 'asc' }, { id: 'asc' }],
    include: { par: { select: { nom: true, identifiantExterne: true } } },
  })
}

export function trouverAffiche(client: Client, id: number) {
  return client.affiche.findUnique({ where: { id } })
}

export function rattachementsActifs(client: Client, afficheId: number) {
  return client.afficheAttendue.findMany({
    where: { afficheId, actif: true },
    orderBy: { id: 'asc' },
    include: { ligneAttendue: { select: { contNum: true } } },
  })
}

export async function sommeMouvements(client: Client, afficheId: number): Promise<number> {
  const r = await client.mouvement.aggregate({ where: { afficheId }, _sum: { quantite: true } })
  return r._sum.quantite ?? 0
}

export async function sommeRattachementsAffiche(
  client: Client,
  afficheId: number,
): Promise<number> {
  const r = await client.afficheAttendue.aggregate({
    where: { afficheId, actif: true },
    _sum: { quantite: true },
  })
  return r._sum.quantite ?? 0
}

export async function sommeRattachementsLigne(
  client: Client,
  ligneAttendueId: number,
): Promise<number> {
  const r = await client.afficheAttendue.aggregate({
    where: { ligneAttendueId, actif: true },
    _sum: { quantite: true },
  })
  return r._sum.quantite ?? 0
}
