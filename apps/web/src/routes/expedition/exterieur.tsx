import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ListeColisSchema } from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
export const Route = createFileRoute('/expedition/exterieur')({
  beforeLoad: requirePermission('colis.gerer'),
  component: Page,
})
function Page() {
  const [du, setDu] = useState(() => {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      return d.toISOString().slice(0, 10)
    }),
    [au, setAu] = useState(() => new Date().toISOString().slice(0, 10))
  const { etat, recharger } = useApi('colis-exterieur', (signal) =>
    apiRequest('GET', '/api/coordination/colis', { schema: ListeColisSchema, signal }),
  )
  const rows =
    etat.kind === 'ready'
      ? etat.data.colis.filter((c) => {
          const date = (c.expedieLe ?? c.dateExpedition)?.slice(0, 10)
          return (
            c.codeExterne !== null &&
            c.codeExterne !== '' &&
            date &&
            (!du || date >= du) &&
            (!au || date <= au)
          )
        })
      : []
  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <p className="text-sm text-slate-500">Expédition</p>
      <h1 className="mb-5 text-2xl font-semibold">Liste des colis (extérieur)</h1>
      <div className="mb-5 flex gap-4">
        <label>
          Du
          <input
            className="ml-2 rounded border p-2"
            type="date"
            value={du}
            onChange={(e) => {
              setDu(e.target.value)
            }}
          />
        </label>
        <label>
          Au
          <input
            className="ml-2 rounded border p-2"
            type="date"
            value={au}
            onChange={(e) => {
              setAu(e.target.value)
            }}
          />
        </label>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Colis avec une référence transporteur externe enregistrée, sur la période de clôture ou
        d’expédition. Les informations proviennent du suivi colis existant.
      </p>
      {etat.kind === 'loading' && <p>Chargement des colis…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <TableMetier
          nom="Colis extérieurs"
          lignes={rows}
          cle={(c) => c.id}
          colonnes={[
            { id: 'id', titre: 'N° colis', valeur: (c) => c.code },
            { id: 'recepisse', titre: 'Code transporteur', valeur: (c) => c.codeExterne },
            {
              id: 'date',
              titre: 'Date',
              valeur: (c) => (c.expedieLe ?? c.dateExpedition)?.slice(0, 10) ?? '',
            },
            { id: 'dest', titre: 'Destinataire', valeur: (c) => c.destinataire.nom },
            { id: 'atelier', titre: 'Atelier', valeur: (c) => c.atelier.libelle },
            {
              id: 'transporteur',
              titre: 'Code transporteur (référentiel)',
              valeur: (c) => c.transporteur,
            },
            { id: 'unites', titre: 'Unités', valeur: (c) => c.nbUnites + c.nbTrains },
            { id: 'statut', titre: 'Statut', valeur: (c) => c.statut },
          ]}
        />
      )}
    </main>
  )
}
