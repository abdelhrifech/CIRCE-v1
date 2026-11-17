import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { AnalyseProductionSchema } from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
export const Route = createFileRoute('/pilotage/analyse')({
  beforeLoad: requirePermission('train.consulter'),
  component: Page,
})
function Page() {
  const [du, setDu] = useState(() => {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      return d.toISOString().slice(0, 10)
    }),
    [au, setAu] = useState(() => new Date().toISOString().slice(0, 10)),
    [atelier, setAtelier] = useState('')
  const qs = new URLSearchParams({ du, au, ...(atelier ? { atelier } : {}) })
  const { etat, recharger } = useApi(`analyse-${qs}`, (signal) =>
    apiRequest('GET', `/api/pilotage/analyse?${qs}`, { schema: AnalyseProductionSchema, signal }),
  )
  return (
    <main className="p-6">
      <h1 className="mb-5 text-2xl font-semibold">Analyse Production</h1>
      <p>
        Trains produits, colisés, expédiés ou livrés. Période appliquée à la date de départ des
        trains.
      </p>
      <div className="my-5 flex gap-4">
        <label>
          Du{' '}
          <input
            type="date"
            value={du}
            onChange={(e) => {
              setDu(e.target.value)
            }}
          />
        </label>
        <label>
          Au{' '}
          <input
            type="date"
            value={au}
            onChange={(e) => {
              setAu(e.target.value)
            }}
          />
        </label>
        <label>
          Atelier{' '}
          <select
            value={atelier}
            onChange={(e) => {
              setAtelier(e.target.value)
            }}
          >
            <option value="">Tous</option>
            {etat.kind === 'ready' &&
              etat.data.ateliers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle} · {a.plateforme}
                </option>
              ))}
          </select>
        </label>
      </div>
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <p className="my-4 font-semibold">
            {etat.data.trains.length} train(s) ·{' '}
            {new Set(etat.data.trains.flatMap((t) => (t.rouleur ? [t.rouleur] : []))).size}{' '}
            rouleur(s)
          </p>
          <TableMetier
            nom="Analyse des trains"
            lignes={etat.data.trains}
            cle={(t) => t.id}
            colonnes={[
              { id: 'id', titre: 'Train', valeur: (t) => t.id },
              { id: 'rouleur', titre: 'Rouleur', valeur: (t) => t.rouleur },
              { id: 'machine', titre: 'Machine', valeur: (t) => t.machine },
              { id: 'atelier', titre: 'Atelier', valeur: (t) => t.atelier },
              { id: 'site', titre: 'Site', valeur: (t) => t.site },
              { id: 'depart', titre: 'Départ', valeur: (t) => t.depart },
              { id: 'statut', titre: 'Statut', valeur: (t) => t.statut },
            ]}
          />
        </>
      )}
      <section className="my-5 rounded border p-4">
        <h2 className="font-semibold">Activité et activité par équipe</h2>
        <p>
          Les quantités douchées et le rebut par équipe ne sont pas disponibles : le douchage
          d’activité reste en attente de définition. Aucun mouvement de stock n’est déduit de cette
          vue.
        </p>
      </section>
    </main>
  )
}
