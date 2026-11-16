import { Link } from '@tanstack/react-router'

// ECR-EXP-01 / 02 / 03 — navigation du module Expédition (Scan et colisage, Colis, Départs camions).
export function ExpeditionNav() {
  return (
    <nav aria-label="Expédition" className="mt-2 flex gap-4 text-sm">
      <Link
        to="/expedition"
        className="underline"
        activeProps={{ className: 'font-semibold underline' }}
        activeOptions={{ exact: true }}
      >
        Scan et colisage
      </Link>
      <Link
        to="/expedition/colis"
        className="underline"
        activeProps={{ className: 'font-semibold underline' }}
      >
        Colis
      </Link>
      <Link
        to="/expedition/departs"
        className="underline"
        activeProps={{ className: 'font-semibold underline' }}
      >
        Départs camions
      </Link>
    </nav>
  )
}

export function IndicateurExpedition({ titre, valeur }: { titre: string; valeur: number | null }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{titre}</p>
      <p className="text-2xl font-semibold">{valeur ?? '—'}</p>
    </div>
  )
}
