// RG-REC-180 / RG-REC-181 : purge automatique des réceptions attendues.
// HYPOTHÈSES (Q-130) : ancienneté comptée depuis le lundi de la semaine de départ ; « purgée » = ligne
// fermée (ANNULEE + purgeeLe), jamais supprimée (RG-COO-089) ; « conservation à l'année » = conserverAnnee.
// Les lignes venues de Broadcast sont purgées aussi (cible RG-REC-180 ; le legacy ne les purgeait pas).
// La PLANIFICATION du traitement est bloquée par Q-005 (aucun planificateur, D-20) : fonction seule.
// RG-REC-052 : une affiche livrée après la purge de sa ligne passe par « Réception inconnue… » (REC-P07).
import { lundiSemaineIso } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import { lireParametreNombre } from './parametres.ts'

export async function purgerReceptionsAttendues(
  db: Db,
  maintenant: Date = new Date(),
): Promise<number> {
  const semaines = await lireParametreNombre(db, 'reception.purgeAttendues')
  const limite = new Date(maintenant.getTime() - semaines * 7 * 86_400_000)
  return db.$transaction(async (tx) => {
    // RG-REC-180 : lignes Attendue / Partielle, actives, non conservées, plus vieilles que `purgeAttendues`.
    const candidates = await tx.receptionAttendue.findMany({
      where: {
        etatLigne: 'ACTIVE',
        statut: { in: ['ATTENDUE', 'PARTIELLE'] },
        conserverAnnee: false,
        purgeeLe: null,
      },
      select: { id: true, semAnnee: true, semNum: true },
    })
    const ids = candidates
      .filter((l) => lundiSemaineIso({ annee: l.semAnnee, semaine: l.semNum }) < limite)
      .map((l) => l.id)
    if (ids.length > 0) {
      await tx.receptionAttendue.updateMany({
        where: {
          id: { in: ids },
          etatLigne: 'ACTIVE',
          statut: { in: ['ATTENDUE', 'PARTIELLE'] },
          conserverAnnee: false,
        },
        data: { etatLigne: 'ANNULEE', purgeeLe: maintenant, version: { increment: 1 } },
      })
    }
    // RG-REC-181 : aucune alerte, aucune validation ; UNE ligne au journal.
    await ecrireJournal(tx, {
      typeEntite: 'LIGNE_ATTENDUE',
      entiteId: 'purge',
      action: 'PURGE_ATTENDUES',
      parId: null,
      nouvelleValeur: `${ids.length} réception(s) attendue(s) purgée(s).`,
      donnees: { ids, purgeAttendues: semaines },
    })
    return ids.length
  })
}
