import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useState } from 'react'
import { FormulaireNc, SuiviNc } from '../components/nonconformite/ecrans.tsx'
import { requirePermission } from '../lib/session.ts'
const Search = z.object({
  tab: z.preprocess(
    (v) => (v === 'plateformes' ? 'suivi' : v === 'preproduction' ? 'suivi' : v),
    z.enum(['demande', 'reception', 'suivi', 'declaration', 'reclamation']).default('demande'),
  ),
  type: z.enum(['agence', 'preprod']).optional(),
  dossier: z.string().optional(),
  id: z.coerce.number().int().positive().optional(),
})
export const Route = createFileRoute('/non-conformite')({
  validateSearch: Search,
  beforeLoad: requirePermission('nonconformite.consulter'),
  component: Page,
})
function Page() {
  const s = Route.useSearch(),
    navigate = useNavigate({ from: Route.fullPath })
  const [choix, setChoix] = useState<'RECEPTION' | 'AGENCE' | null>(null)
  const type =
    s.tab === 'declaration' || s.type === 'agence'
      ? 'AGENCE'
      : s.tab === 'reception' || s.type === 'preprod'
        ? 'RECEPTION'
        : choix
  const formulaire = !['suivi', 'reclamation'].includes(s.tab)
  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <p className="mb-2 text-sm text-slate-500">Non-conformité</p>
      {formulaire ? (
        <>
          <div className="mb-5 flex justify-between">
            <h1 className="text-2xl font-semibold">Nouvelle demande</h1>
            <button
              className="underline"
              onClick={() => void navigate({ search: { tab: 'suivi' } })}
            >
              Suivi des NC
            </button>
          </div>
          <div className="mb-5 grid max-w-4xl gap-4 sm:grid-cols-2">
            {(['RECEPTION', 'AGENCE'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                className="rounded border-2 p-5 text-left font-semibold"
                style={{
                  borderColor: t === 'AGENCE' ? '#c2410c' : '#6f42c1',
                  background: type === t ? (t === 'AGENCE' ? '#c2410c' : '#6f42c1') : '#fff',
                  color: type === t ? '#fff' : '#172033',
                }}
                onClick={() => {
                  setChoix(t)
                  void navigate({
                    search: { tab: 'demande', type: t === 'AGENCE' ? 'agence' : 'preprod' },
                  })
                }}
              >
                Usage réservé aux {t === 'AGENCE' ? 'agences' : 'plateformes'}
                {type === t ? ' — ✓ Choisi' : ''}
              </button>
            ))}
          </div>
          {type ? (
            <FormulaireNc
              key={type}
              type={type}
              onEnvoyee={() => void navigate({ search: { tab: 'suivi' } })}
              onAnnuler={() => void navigate({ search: { tab: 'suivi' } })}
            />
          ) : (
            <p>Choisissez le type de demande.</p>
          )}
        </>
      ) : (
        <SuiviNc
          type={s.tab === 'reclamation' ? 'AGENCE' : undefined}
          ouvrir={s.id}
          dossier={s.dossier}
          onNouvelle={() => void navigate({ search: { tab: 'demande' } })}
        />
      )}
    </main>
  )
}
