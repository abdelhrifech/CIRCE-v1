import { createFileRoute } from '@tanstack/react-router'
import type { MeResponse } from '@circe/shared'
import { useEffect, useState } from 'react'
import { ErrorMessage } from '../components/error-message.tsx'
import { getMe, resetMe } from '../lib/session.ts'

export const Route = createFileRoute('/moi')({ component: MonProfil })

type State =
  { kind: 'loading' } | { kind: 'error'; error: unknown } | { kind: 'ready'; me: MeResponse }

/** Mon profil : identité, rôles, périmètre et permissions renvoyés par GET /api/me. */
function MonProfil() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getMe().then(
      (me) => {
        if (!cancelled) setState({ kind: 'ready', me })
      },
      (error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  function retry() {
    resetMe()
    setState({ kind: 'loading' })
    setAttempt((value) => value + 1)
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Mon profil</h1>
      <section className="mt-6" aria-live="polite">
        {state.kind === 'loading' && <p data-testid="moi-loading">Chargement…</p>}
        {state.kind === 'error' && <ErrorMessage error={state.error} onRetry={retry} />}
        {state.kind === 'ready' && (
          <div
            data-testid="moi-ready"
            className="space-y-2 rounded-lg border border-slate-200 bg-white p-4"
          >
            <p>
              <strong>{state.me.nom ?? state.me.identifiantExterne}</strong> · rôles :{' '}
              {state.me.roles.join(', ')}
            </p>
            <p className="text-sm text-slate-600">
              Périmètre :{' '}
              {state.me.perimetre.toutesPlateformes
                ? 'toutes les plateformes'
                : state.me.perimetre.plateformeIds.join(', ') || 'aucune plateforme'}
            </p>
            {state.me.permissions.length === 0 ? (
              <p className="text-sm text-slate-600">Aucune permission.</p>
            ) : (
              <ul className="list-inside list-disc text-sm">
                {state.me.permissions.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
