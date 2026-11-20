import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { JournalAdminSchema } from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { PageAdmin } from '../../components/admin/page.tsx'
export const Route = createFileRoute('/admin/journal')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Page,
})
function Page() {
  const [f, setF] = useState({ q: '', action: '', objet: '', du: '', au: '' }),
    [page, setPage] = useState(1)
  const qs = new URLSearchParams(
    Object.entries({ ...f, page: String(page) }).filter(([, v]) => v !== ''),
  )
  const { etat, recharger } = useApi(`journal-admin-${qs}`, (signal) =>
    apiRequest('GET', `/api/admin/journal?${qs}`, { schema: JournalAdminSchema, signal }),
  )
  return (
    <PageAdmin titre="Journal">
      <div className="my-4 flex flex-wrap gap-4">
        {(['q', 'action', 'objet', 'du', 'au'] as const).map((k) => (
          <label key={k}>
            {
              {
                q: 'Rechercher',
                action: 'Action (code)',
                objet: 'Objet (code)',
                du: 'Du',
                au: 'Au',
              }[k]
            }
            <input
              className="block rounded border p-2"
              type={k === 'du' || k === 'au' ? 'date' : 'text'}
              value={f[k]}
              onChange={(e) => {
                setF({ ...f, [k]: e.target.value })
                setPage(1)
              }}
            />
          </label>
        ))}
      </div>
      {etat.kind === 'loading' && <p>Chargement du journal…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <TableMetier
            nom="Journal global"
            lignes={etat.data.items}
            cle={(r) => r.id}
            colonnes={[
              {
                id: 'date',
                titre: 'Date',
                valeur: (r) => new Date(r.date).toLocaleString('fr-FR'),
              },
              { id: 'par', titre: 'Par', valeur: (r) => r.par },
              { id: 'objet', titre: 'Objet', valeur: (r) => `${r.objet} · ${r.identifiant}` },
              { id: 'action', titre: 'Action', valeur: (r) => r.action },
              { id: 'detail', titre: 'Détail', valeur: (r) => r.detail },
            ]}
          />
          <div className="mt-4 flex justify-between">
            <span>{etat.data.total} événement(s) · export de la page affichée</span>
            <span>
              <button
                disabled={page === 1}
                onClick={() => {
                  setPage(page - 1)
                }}
              >
                Précédente
              </button>
              <span className="mx-4">{page}</span>
              <button
                disabled={page * etat.data.pageSize >= etat.data.total}
                onClick={() => {
                  setPage(page + 1)
                }}
              >
                Suivante
              </button>
            </span>
          </div>
        </>
      )}
    </PageAdmin>
  )
}
