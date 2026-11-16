import type { ReactNode } from 'react'

export type Ton = 'neutre' | 'info' | 'ok' | 'surveiller' | 'important' | 'critique'

const TONS: Record<Ton, string> = {
  neutre: 'bg-slate-100 text-slate-700',
  info: 'bg-slate-100 text-slate-800',
  ok: 'bg-emerald-100 text-emerald-800',
  surveiller: 'bg-amber-100 text-amber-800',
  important: 'bg-orange-100 text-orange-800',
  critique: 'bg-red-100 text-red-800',
}

/** Pastille de statut (rampe de la maquette : bleu clair, OK vert, À surveiller jaune, Important orange). */
const ETAPES: Record<string, [string, string, string]> = {
  EN_ATTENTE: ['#f9db7c', 'none', '#352b18'],
  A_TRAITER: ['#f9db7c', 'none', '#352b18'],
  PRET: [
    '#f7a35a',
    'repeating-linear-gradient(-45deg, #0007 0 1.5px, transparent 1.5px 4px)',
    '#352310',
  ],
  A_IMPRIMER: [
    '#f7a35a',
    'repeating-linear-gradient(-45deg, #0007 0 1.5px, transparent 1.5px 4px)',
    '#352310',
  ],
  EN_PRODUCTION: [
    '#e0607e',
    'repeating-linear-gradient(45deg, #ffffffd9 0 1.5px, transparent 1.5px 4px)',
    '#40121d',
  ],
  EN_PROD: [
    '#e0607e',
    'repeating-linear-gradient(45deg, #ffffffd9 0 1.5px, transparent 1.5px 4px)',
    '#40121d',
  ],
  AU_ROULAGE: [
    '#e0607e',
    'repeating-linear-gradient(45deg, #ffffffd9 0 1.5px, transparent 1.5px 4px)',
    '#40121d',
  ],
  PRODUIT: [
    '#9c3f8f',
    'repeating-linear-gradient(90deg, #fffc 0 1.5px, transparent 1.5px 4px)',
    '#ffffff',
  ],
  PREPARE: [
    '#9c3f8f',
    'repeating-linear-gradient(90deg, #fffc 0 1.5px, transparent 1.5px 4px)',
    '#ffffff',
  ],
  COLISE: [
    '#9c3f8f',
    'repeating-linear-gradient(90deg, #fffc 0 1.5px, transparent 1.5px 4px)',
    '#ffffff',
  ],
  EXPEDIE: [
    '#3b1a47',
    'repeating-linear-gradient(0deg, #ffffffbf 0 1.5px, transparent 1.5px 4px)',
    '#ffffff',
  ],
  TERMINE: [
    '#3b1a47',
    'repeating-linear-gradient(0deg, #ffffffbf 0 1.5px, transparent 1.5px 4px)',
    '#ffffff',
  ],
}
export function Pastille({
  ton,
  children,
  production,
}: {
  ton: Ton
  children: ReactNode
  production?: string
}) {
  const etape = production ? ETAPES[production] : undefined
  return (
    <span
      style={etape ? { backgroundColor: etape[0], color: etape[2] } : undefined}
      className={`inline-flex gap-1.5 items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONS[ton]}`}
    >
      {etape && (
        <span
          aria-hidden="true"
          className="inline-block size-3 shrink-0 rounded-full border border-black/30"
          style={{ backgroundColor: etape[0], backgroundImage: etape[1] }}
        />
      )}
      {children}
    </span>
  )
}
