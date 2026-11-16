// COO-P07 — lectures communes des alertes Pré-Prod et de la vérification des thèmes : production lancée, départs
// et libellés de préparation d'un dossier. Lecture seule.
import { formatSemaineIso, semaineIsoDe, type SemaineIso } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { parPaquets } from '../../core/paquets.ts'
import type { Tx } from '../../core/transaction.ts'
import type { StatutProduction } from '../../generated/prisma/client.ts'

type Client = Db | Tx

/** RG-COO-068 / 069 (HYPOTHÈSE Q-190 (1), maquette `C.prodLancee` : unité « en production » ou au-delà) :
 * statuts de production qui marquent le point de non-retour (impression, préparé, à expédier, terminé, export
 * de la préparation, au roulage). */
export const STATUTS_PRODUCTION_LANCEE: StatutProduction[] = [
  'A_IMPRIMER',
  'PREPARE',
  'A_EXPEDIER',
  'TERMINE',
  'EXPORT_PREPA',
  'AU_ROULAGE',
]

/** Dossiers (n° de contrat) dont la production est lancée : une face, une répartition ou une UM au-delà du
 * point de non-retour, ou une instruction « Prêt à produire ». */
export async function dossiersEnProduction(
  client: Client,
  contNums: number[],
): Promise<Set<number>> {
  const ids = [...new Set(contNums)]
  if (ids.length === 0) return new Set()
  const statut = { in: STATUTS_PRODUCTION_LANCEE }
  const [faces, repartitions, unites, instructions] = await Promise.all([
    parPaquets(ids, (paquet) =>
      client.faceTrain.findMany({
        where: { contNum: { in: paquet }, statut },
        select: { contNum: true },
        distinct: ['contNum'],
      }),
    ),
    parPaquets(ids, (paquet) =>
      client.repartition.findMany({
        where: { contNum: { in: paquet }, statut },
        select: { contNum: true },
        distinct: ['contNum'],
      }),
    ),
    parPaquets(ids, (paquet) =>
      client.uniteManutention.findMany({
        where: { contNum: { in: paquet }, statut },
        select: { contNum: true },
        distinct: ['contNum'],
      }),
    ),
    parPaquets(ids, (paquet) =>
      client.instruction.findMany({
        where: { contNum: { in: paquet }, statut: 'PRET_A_PRODUIRE' },
        select: { contNum: true },
        distinct: ['contNum'],
      }),
    ),
  ])
  return new Set(
    [...faces, ...repartitions, ...unites, ...instructions]
      .map((x) => x.contNum)
      .filter((c): c is number => c !== null),
  )
}

/** Semaines de départ (ISO, triées) des lignes attendues actives de chaque dossier. */
export async function departsDesDossiers(
  client: Client,
  contNums: number[],
): Promise<Map<number, SemaineIso[]>> {
  const lignes = await parPaquets([...new Set(contNums)], (paquet) =>
    client.receptionAttendue.findMany({
      where: { contNum: { in: paquet }, etatLigne: 'ACTIVE' },
      select: { contNum: true, semAnnee: true, semNum: true },
      distinct: ['contNum', 'semAnnee', 'semNum'],
      orderBy: [{ semAnnee: 'asc' }, { semNum: 'asc' }],
    }),
  )
  const m = new Map<number, SemaineIso[]>()
  for (const l of lignes) {
    if (l.contNum === null) continue
    m.set(l.contNum, [...(m.get(l.contNum) ?? []), { annee: l.semAnnee, semaine: l.semNum }])
  }
  return m
}

/** Semaine ISO décalée de `n` semaines. */
export function semainePlus(s: SemaineIso, n: number, lundi: (s: SemaineIso) => Date): SemaineIso {
  return semaineIsoDe(new Date(lundi(s).getTime() + n * 7 * 86_400_000))
}

export const formatDepart = (s: SemaineIso | undefined) => (s ? formatSemaineIso(s) : null)

/** Libellé du statut de préparation du dossier (ECR-COO-01, colonne « Préparation »). */
export function libellePreparation(statut: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE' | null) {
  return statut === 'PREPARATION_RECUE'
    ? 'Préparation reçue'
    : statut === 'ANNULE'
      ? 'Annulé'
      : 'Pas encore envoyée'
}
