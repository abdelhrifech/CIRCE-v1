// COO-P12 — RG-COO-290 : affiche reçue INDICATIVE d'une unité de préparation (✓ validée, • proposée), en lecture seule.
// Module séparé : aucune écriture d'UM ni de répartition ici ; la création d'UM, la libération et le passage
// « En cours » → « Préparé » ne dépendent d'aucune réception ni validation admin (RG-COO-027, RG-X-084).
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import { cleVisuel } from './trains.ts'

/** RG-COO-290 : affiche reçue indicative (✓ validée, • proposée), sans effet sur les actions. */
export async function affichesIndicatives(client: Db | Tx, contNums: number[]) {
  const liens = await parPaquets(contNums, (paquet) =>
    client.afficheAttendue.findMany({
      where: { actif: true, ligneAttendue: { contNum: { in: paquet } } },
      select: {
        ligneAttendue: { select: { plateformeId: true, contNum: true, theme: true } },
        affiche: { select: { validationAdmin: true } },
      },
    }),
  )
  const m = new Map<string, 'VALIDEE' | 'PROPOSEE'>()
  for (const l of liens) {
    const k = cleVisuel(
      l.ligneAttendue.plateformeId,
      l.ligneAttendue.contNum,
      l.ligneAttendue.theme,
    )
    if (l.affiche.validationAdmin) m.set(k, 'VALIDEE')
    else if (!m.has(k)) m.set(k, 'PROPOSEE')
  }
  return m
}
