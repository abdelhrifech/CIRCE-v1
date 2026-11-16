import type { ActionAudit, TypeEntite } from '../generated/prisma/client.ts'
import type { Tx } from './transaction.ts'

export interface StatutHistoriqueEntree {
  typeEntite: TypeEntite
  entiteId: string | number
  ancien: string | null
  nouveau: string
  parId: number | null
  motif?: string
  regle?: string
}

/** CLAUDE.md §6 / RG-COO-061, 307 : chaque changement de statut écrit un historique (même transaction). */
export function ecrireHistoriqueStatut(tx: Tx, entree: StatutHistoriqueEntree) {
  return tx.statutHistorique.create({
    data: {
      typeEntite: entree.typeEntite,
      entiteId: String(entree.entiteId),
      ancien: entree.ancien,
      nouveau: entree.nouveau,
      parId: entree.parId,
      motif: entree.motif ?? null,
      regle: entree.regle ?? null,
    },
  })
}

export interface JournalEntree {
  typeEntite: TypeEntite
  entiteId: string | number
  action: ActionAudit
  parId: number | null
  ancienneValeur?: string | null
  nouvelleValeur?: string | null
  complement?: string
  donnees?: unknown
}

/** RG-REC-004/005/006, RG-COO-160 : journal d'audit nominatif, écrit dans la MÊME transaction. */
export function ecrireJournal(tx: Tx, entree: JournalEntree) {
  return tx.journalAudit.create({
    data: {
      typeEntite: entree.typeEntite,
      entiteId: String(entree.entiteId),
      action: entree.action,
      parId: entree.parId,
      ancienneValeur: entree.ancienneValeur ?? null,
      nouvelleValeur: entree.nouvelleValeur ?? null,
      complement: entree.complement ?? null,
      donnees: entree.donnees === undefined ? null : JSON.stringify(entree.donnees),
    },
  })
}
