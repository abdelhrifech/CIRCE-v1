// Lecture des paramètres métier (Q-337) : valeur globale, sinon la valeur par défaut issue des règles
// (seed-ref). Jamais de seuil codé en dur dans les règles (RG-REC-018).
// Q-105 (HYPOTHÈSE) : paramètres GLOBAUX, sauf l'allée tampon qui se règle par site.
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import { PARAMETRES_REF } from '../../reference/seed-ref.ts'

type CleParametre = (typeof PARAMETRES_REF)[number]['cle']

const PAR_SITE: readonly CleParametre[] = ['reception.alleeInconnues']

export async function lireParametreNombre(
  client: Db | Tx,
  cle: CleParametre,
  site?: number,
): Promise<number> {
  const plateformeId = PAR_SITE.includes(cle) ? site : undefined
  const lignes = await client.parametre.findMany({
    where: { cle, OR: [{ plateformeId: null }, ...(plateformeId ? [{ plateformeId }] : [])] },
  })
  const valeur =
    lignes.find((l) => l.plateformeId === plateformeId)?.valeur ??
    lignes.find((l) => l.plateformeId === null)?.valeur ??
    PARAMETRES_REF.find((p) => p.cle === cle)?.valeur
  const nombre = Number(valeur)
  if (!Number.isFinite(nombre)) throw new Error(`Paramètre « ${cle} » invalide : ${String(valeur)}`)
  return nombre
}

/** Paramètre texte (ex. allée des réceptions inconnues, réglable par site : Q-105). */
export async function lireParametreTexte(
  client: Db | Tx,
  cle: CleParametre,
  site?: number,
): Promise<string> {
  const plateformeId = PAR_SITE.includes(cle) ? site : undefined
  const lignes = await client.parametre.findMany({
    where: { cle, OR: [{ plateformeId: null }, ...(plateformeId ? [{ plateformeId }] : [])] },
  })
  return (
    lignes.find((l) => l.plateformeId === plateformeId)?.valeur ??
    lignes.find((l) => l.plateformeId === null)?.valeur ??
    PARAMETRES_REF.find((p) => p.cle === cle)?.valeur ??
    ''
  )
}
