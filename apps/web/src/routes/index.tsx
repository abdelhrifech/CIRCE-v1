import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ErrorMessage } from '../components/error-message.tsx'
import { pageOuverture } from '../components/shell/nav-config.ts'
import { getMe, resetMe } from '../lib/session.ts'
import { useApi } from '../lib/use-api.ts'

export const Route = createFileRoute('/')({ component: Ouverture })

/**
 * ECR-NAV-01 : « pas de page d'accueil » (décision du 16/10) ; la maquette ouvre sur Pilotage › Suivi de prod, écran absent
 * (ECARTS). Q-365 : ouverture sur la première page accessible du profil.
 */
function Ouverture() {
  const navigate = useNavigate()
  const { etat, recharger } = useApi('ouverture', () => getMe())
  useEffect(() => {
    if (etat.kind === 'ready') void navigate({ to: pageOuverture(etat.data), replace: true })
  }, [etat, navigate])
  return (
    <main className="mx-auto max-w-xl p-6">
      {etat.kind === 'loading' && <p data-testid="ouverture-loading">Ouverture…</p>}
      {etat.kind === 'error' && (
        <ErrorMessage
          error={etat.error}
          onRetry={() => {
            resetMe()
            recharger()
          }}
        />
      )}
    </main>
  )
}
