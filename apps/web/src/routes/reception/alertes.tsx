import { createFileRoute } from '@tanstack/react-router'
import { AlertesSchema } from '@circe/shared'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Pastille, type Ton } from '../../components/ui/pastille.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// Alertes Réception (RG-REC-182 à 189), calculées par l'API ; chaque alerte ouvre l'écran où agir
// (RG-REC-190 : canal / mail / paramétrage BLOQUÉS, D-08).

export const Route = createFileRoute('/reception/alertes')({
  beforeLoad: requirePermission('alerte.consulter'),
  component: AlertesReception,
})

const GRAVITE: Record<string, { libelle: string; ton: Ton }> = {
  CRITIQUE: { libelle: 'Critique', ton: 'important' },
  IMPORTANT: { libelle: 'Important', ton: 'important' },
  A_SURVEILLER: { libelle: 'À surveiller', ton: 'surveiller' },
}

function AlertesReception() {
  const { etat, recharger } = useApi('alertes-reception', (signal) =>
    apiRequest('GET', '/api/alertes/reception', { schema: AlertesSchema, signal }),
  )
  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Réception</p>
      <h1 className="text-2xl font-semibold">Alertes</h1>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white">
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {etat.kind === 'ready' && etat.data.alertes.length === 0 && (
          <p className="p-3 text-sm text-slate-600">Aucune alerte.</p>
        )}
        {etat.kind === 'ready' && etat.data.alertes.length > 0 && (
          <table className="w-full text-sm" aria-label="Alertes">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {['Gravité', 'Alerte', 'Détail', 'Destinataires', ''].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {etat.data.alertes.map((a) => (
                <tr key={a.cle} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Pastille ton={GRAVITE[a.gravite]?.ton ?? 'neutre'}>
                      {GRAVITE[a.gravite]?.libelle ?? a.gravite}
                    </Pastille>
                  </td>
                  <td className="px-3 py-2">{a.type}</td>
                  <td className="px-3 py-2">{a.message}</td>
                  <td className="px-3 py-2">{a.destinataires.join(', ')}</td>
                  <td className="px-3 py-2">
                    <a className="underline" href={a.lien}>
                      Ouvrir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
