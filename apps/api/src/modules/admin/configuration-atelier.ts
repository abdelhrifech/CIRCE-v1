import { z } from 'zod'
import {
  DistributionInputSchema,
  BoucleTransportInputSchema,
  type MachineConfigurationInputSchema,
  type BoucleTransportInputSchema as BoucleInput,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import type { Identity } from '../../core/identity.ts'
import { assertDroitAdmin } from './permissions.ts'
import { ConflictError, NotFoundError, BusinessError } from '../../core/errors.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
// EX-ADM-NEW-001 — référentiels séparés : ne reconfigurent pas les moteurs gelés.
export async function sauverMachine(
  tx: Tx,
  i: Identity,
  id: number | null,
  input: z.infer<typeof MachineConfigurationInputSchema>,
) {
  assertDroitAdmin(i, 'parametrage.gerer')
  const { version, ...data } = input
  const rows = await tx.machineConfiguration.findMany({ select: { id: true, nom: true } })
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('fr')
  if (rows.some((m) => m.id !== id && norm(m.nom) === norm(data.nom)))
    throw new ConflictError('Une machine porte déjà ce nom.')
  let row
  if (id === null) {
    if (version !== 0) throw new ConflictError('Version initiale attendue.')
    row = await tx.machineConfiguration.create({ data })
  } else {
    if (!rows.some((m) => m.id === id)) throw new NotFoundError('Machine introuvable')
    const r = await tx.machineConfiguration.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    })
    if (!r.count) throw new ConflictError('Machine modifiée entre-temps : rechargez.')
    row = await tx.machineConfiguration.findUniqueOrThrow({ where: { id } })
  }
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `machine:${row.id}`,
    action: 'MODIFICATION_REFERENTIEL',
    parId: i.userId,
    nouvelleValeur: row.nom,
    complement: 'Configuration machine',
  })
  return {
    id: row.id,
    version: row.version,
    nom: row.nom,
    type: row.type,
    fichier: row.fichier,
    tiroirsMax: row.tiroirsMax,
    sortie: row.sortie,
    repertoire: row.repertoire,
    bagues: row.bagues,
  }
}
export async function lireBoucles(db: Db | Tx, i: Identity) {
  assertDroitAdmin(i, 'parametrage.gerer')
  const [rows, sites, dests] = await Promise.all([
    db.boucleTransportConfiguration.findMany({
      orderBy: [{ plateformeId: 'asc' }, { nom: 'asc' }],
    }),
    db.plateforme.findMany({ select: { id: true, nom: true }, orderBy: { nom: 'asc' } }),
    db.destinataire.findMany({
      select: { id: true, nom: true, nomOrigine: true },
      orderBy: { nomOrigine: 'asc' },
    }),
  ])
  const siteDe = new Map(sites.map((s) => [s.id, s.nom])),
    destDe = new Map(dests.map((d) => [d.id, d.nom ?? d.nomOrigine]))
  return {
    items: rows.map((r) => {
      const destinataires = z.array(z.number()).parse(JSON.parse(r.destinataires))
      return {
        ...BoucleTransportInputSchema.parse({ ...r, destinataires }),
        id: r.id,
        site: siteDe.get(r.plateformeId) ?? '—',
        destinations: destinataires.map((id) => destDe.get(id) ?? String(id)),
      }
    }),
    sites,
    destinataires: dests.map((d) => ({ id: d.id, nom: d.nom ?? d.nomOrigine })),
  }
}
export async function sauverBoucle(
  tx: Tx,
  i: Identity,
  id: number | null,
  input: z.infer<typeof BoucleInput>,
) {
  assertDroitAdmin(i, 'parametrage.gerer')
  if (!(await tx.plateforme.findUnique({ where: { id: input.plateformeId } })))
    throw new BusinessError('Plateforme inconnue.')
  const dests = [...new Set(input.destinataires)]
  if ((await tx.destinataire.count({ where: { id: { in: dests } } })) !== dests.length)
    throw new BusinessError('Destination inconnue.')
  const { version, ...values } = input,
    data = { ...values, destinataires: JSON.stringify(dests) }
  const existants = await tx.boucleTransportConfiguration.findMany({
    where: { plateformeId: input.plateformeId },
  })
  if (
    existants.some(
      (b) =>
        b.id !== id && b.nom.trim().toLocaleLowerCase('fr') === input.nom.toLocaleLowerCase('fr'),
    )
  )
    throw new ConflictError('Cette boucle existe déjà sur le site.')
  let row
  if (id === null) {
    if (version !== 0) throw new ConflictError('Version initiale attendue')
    row = await tx.boucleTransportConfiguration.create({ data })
  } else {
    const r = await tx.boucleTransportConfiguration.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    })
    if (!r.count) throw new ConflictError('Boucle modifiée entre-temps : rechargez.')
    row = await tx.boucleTransportConfiguration.findUniqueOrThrow({ where: { id } })
  }
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `boucle:${row.id}`,
    action: 'MODIFICATION_REFERENTIEL',
    parId: i.userId,
    nouvelleValeur: row.nom,
    complement: 'Configuration boucle transport',
  })
  const resultat = (await lireBoucles(tx, i)).items.find((b) => b.id === row.id)
  if (!resultat) throw new NotFoundError('Boucle introuvable')
  return resultat
}

export async function lireDistributions(db: Db | Tx, i: Identity) {
  assertDroitAdmin(i, 'parametrage.gerer')
  const [rows, sites] = await Promise.all([
    db.listeDistributionConfiguration.findMany({ orderBy: { nom: 'asc' } }),
    db.plateforme.findMany({ select: { id: true, nom: true }, orderBy: { nom: 'asc' } }),
  ])
  const noms = new Map(sites.map((s) => [s.id, s.nom]))
  return {
    items: rows.map((r) => ({
      ...DistributionInputSchema.parse({
        ...r,
        roles: DistributionInputSchema.shape.roles.parse(JSON.parse(r.roles)),
      }),
      id: r.id,
      site: r.plateformeId === null ? null : (noms.get(r.plateformeId) ?? null),
    })),
    sites,
  }
}
export async function sauverDistribution(
  tx: Tx,
  i: Identity,
  id: number | null,
  input: z.infer<typeof DistributionInputSchema>,
) {
  assertDroitAdmin(i, 'parametrage.gerer')
  if (
    input.plateformeId !== null &&
    !(await tx.plateforme.findUnique({ where: { id: input.plateformeId } }))
  )
    throw new BusinessError('Plateforme inconnue.')
  const rows = await tx.listeDistributionConfiguration.findMany({ select: { id: true, nom: true } })
  if (
    rows.some(
      (r) => r.id !== id && r.nom.toLocaleLowerCase('fr') === input.nom.toLocaleLowerCase('fr'),
    )
  )
    throw new ConflictError('Cette liste existe déjà.')
  const { version, ...vals } = input,
    data = { ...vals, roles: JSON.stringify([...new Set(vals.roles)]) }
  let row
  if (id === null) {
    if (version !== 0) throw new ConflictError('Version initiale attendue')
    row = await tx.listeDistributionConfiguration.create({ data })
  } else {
    const r = await tx.listeDistributionConfiguration.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    })
    if (!r.count) throw new ConflictError('Liste modifiée entre-temps : rechargez.')
    row = await tx.listeDistributionConfiguration.findUniqueOrThrow({ where: { id } })
  }
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `distribution:${row.id}`,
    action: 'MODIFICATION_REFERENTIEL',
    parId: i.userId,
    nouvelleValeur: row.nom,
    complement: 'Liste de distribution : ' + input.roles.join(', '),
  })
  const resultat = (await lireDistributions(tx, i)).items.find((r) => r.id === row.id)
  if (!resultat) throw new NotFoundError()
  return resultat
}
