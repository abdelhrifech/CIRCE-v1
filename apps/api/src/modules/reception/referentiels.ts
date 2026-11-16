// RG-REC-035 : imprimeurs, transporteurs (livreurs) et agents de réception = listes FERMÉES (Q-115).
// HYPOTHÈSE Q-177 : « agents de réception » = utilisateurs actifs au rôle recep du site (ou du périmètre).
import type { ReferentielsReception } from '@circe/shared'
import { lireParametreTexte } from './parametres.ts'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import type { Identity } from '../../core/identity.ts'
import { plateformesVisibles } from './attendues.ts'
import { assertDroitReception } from './permissions.ts'

export async function agentsDeReception(db: Db | Tx, plateformes: number[] | 'toutes') {
  const agents = await db.utilisateur.findMany({
    where: {
      actif: true,
      roles: { some: { role: { code: 'recep' } } },
      ...(plateformes === 'toutes'
        ? {}
        : { perimetres: { some: { plateformeId: { in: plateformes } } } }),
    },
    orderBy: { nom: 'asc' },
    select: {
      id: true,
      nom: true,
      identifiantExterne: true,
      perimetres: { select: { plateformeId: true } },
    },
  })
  return agents.map((a) => ({
    id: a.id,
    nom: a.nom ?? a.identifiantExterne,
    plateformeIds: [...new Set(a.perimetres.map((p) => p.plateformeId))],
  }))
}

export async function referentielsReception(
  db: Db,
  identity: Identity,
): Promise<ReferentielsReception> {
  assertDroitReception(identity, 'reception.saisir')
  const plateformes = plateformesVisibles(identity)
  const [imprimeurs, livreurs, agents] = await Promise.all([
    db.imprimeur.findMany({
      where: { actif: true },
      orderBy: { libelle: 'asc' },
      select: { id: true, libelle: true },
    }),
    db.livreur.findMany({
      where: { actif: true },
      orderBy: { libelle: 'asc' },
      select: { id: true, libelle: true },
    }),
    agentsDeReception(db, plateformes),
  ])
  const sites = await db.plateforme.findMany({
    where: plateformes === 'toutes' ? {} : { id: { in: plateformes } },
    orderBy: { nom: 'asc' },
    select: { id: true, nom: true },
  })
  const plateformesAvecAllee = []
  for (const p of sites) {
    // RG-REC-097 / Q-105 : allée tampon par défaut, réglable par site.
    plateformesAvecAllee.push({
      ...p,
      alleeInconnues: await lireParametreTexte(db, 'reception.alleeInconnues', p.id),
    })
  }
  const formats = await db.categorieSupport.findMany({
    orderBy: { nom: 'asc' },
    select: { id: true, nom: true },
  })
  return { imprimeurs, livreurs, agents, plateformes: plateformesAvecAllee, formats }
}
