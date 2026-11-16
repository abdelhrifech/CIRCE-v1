// ÉTAPE 7 — RG-X-003 : « Valider la réception » (et rattachement d'une inconnue) fait passer « prêt à produire »
// les unités en attente (train EN_ATTENTE → PRET quand tous ses visuels sont reçus, RG-COO-208). Le statut du
// train est CALCULÉ à la lecture (HYPOTHÈSE Q-250) : « recalcul automatique dans les deux sens » est donc
// acquis ; ce module ne fait que COMPTER, dans la transaction de la réception, les trains qui changent d'état,
// pour le message « n unité(s) prête(s) à produire » (ECR-REC-01 / ECR-REC-04). Lecture seule.
import type { StatutUnite } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { parPaquets } from '../../core/paquets.ts'
import type { Tx } from '../../core/transaction.ts'
import { construireTrains, STATUTS_TRAIN, type AtelierPerimetre } from './trains.ts'

type Client = Db | Tx

/** Statut calculé des trains (unités) qui portent un visuel de l'un des dossiers `contNums`. */
export async function statutsTrainsDesDossiers(
  db: Client,
  contNums: readonly (number | null)[],
): Promise<Map<string, StatutUnite>> {
  const nums = [...new Set(contNums.filter((c): c is number => c !== null))]
  if (nums.length === 0) return new Map()
  const amorces = await parPaquets(nums, (paquet) =>
    db.faceTrain.findMany({
      where: { contNum: { in: paquet }, trainId: { not: null }, statut: { in: STATUTS_TRAIN } },
      select: { trainId: true },
    }),
  )
  const trainIds = [
    ...new Set(amorces.map((f) => f.trainId).filter((t): t is string => t !== null)),
  ]
  if (trainIds.length === 0) return new Map()
  const faces = await parPaquets(trainIds, (paquet) =>
    db.faceTrain.findMany({ where: { trainId: { in: paquet }, statut: { in: STATUTS_TRAIN } } }),
  )
  const ateliers: AtelierPerimetre[] = (
    await db.atelier.findMany({ include: { plateforme: { select: { nom: true } } } })
  ).map((a) => ({
    id: a.id,
    libelle: a.libelle,
    plateformeId: a.plateformeId,
    plateforme: a.plateforme.nom,
    type: a.type,
  }))
  const trains = await construireTrains(db, faces, ateliers)
  return new Map(trains.map((t) => [t.trainId, t.statut]))
}

/** Nombre de trains passés d'EN_ATTENTE à PRET entre les deux calculs. */
export function unitesDevenuesPretes(
  avant: ReadonlyMap<string, StatutUnite>,
  apres: ReadonlyMap<string, StatutUnite>,
): number {
  let n = 0
  for (const [id, statut] of apres) if (statut === 'PRET' && avant.get(id) === 'EN_ATTENTE') n++
  return n
}

/** Phrase de la maquette (ECR-REC-01 / 04) ; vide quand aucune unité ne change d'état. */
export const messageUnitesPretes = (n: number) =>
  n > 0 ? ` ${String(n)} unité(s) prête(s) à produire.` : ''
