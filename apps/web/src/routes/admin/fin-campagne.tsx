import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ConfigurationFinCampagneSchema } from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiRequest, apiPost } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { PageAdmin } from '../../components/admin/page.tsx'
export const Route = createFileRoute('/admin/fin-campagne')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Page,
})
function Page() {
  const { etat, recharger } = useApi('configuration-fin-campagne', (signal) =>
    apiRequest('GET', '/api/admin/fin-campagne', {
      schema: ConfigurationFinCampagneSchema,
      signal,
    }),
  )
  return (
    <PageAdmin titre="Règles de fin de campagne">
      {etat.kind === 'loading' && <p>Chargement des paramètres…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <Formulaire key={etat.data.version} initial={etat.data} onSauvee={recharger} />
      )}
    </PageAdmin>
  )
}
function Formulaire({
  initial,
  onSauvee,
}: {
  initial: ReturnType<typeof ConfigurationFinCampagneSchema.parse>
  onSauvee: () => void
}) {
  const [f, setF] = useState(initial),
    [envoi, setEnvoi] = useState(false),
    [erreur, setErreur] = useState<unknown>(null),
    [message, setMessage] = useState('')
  async function sauver() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost('/api/admin/fin-campagne', { schema: ConfigurationFinCampagneSchema, body: f })
      setMessage('Paramètres enregistrés.')
      onSauvee()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void sauver()
      }}
      className="max-w-3xl rounded border bg-white p-5"
    >
      <h2 className="mb-4 text-lg font-semibold">Délai après le dernier départ</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {(['2m2', '8m2', 'autres'] as const).map((k) => (
          <label key={k}>
            {k === '2m2' ? '2 m² (MUI compris)' : k === '8m2' ? '8 m²' : 'Autres formats'}
            <input
              className="block w-full rounded border p-2"
              type="number"
              required
              min={1}
              max={52}
              value={f.delais[k]}
              onChange={(e) => {
                setF({ ...f, delais: { ...f.delais, [k]: Number(e.target.value) } })
              }}
            />{' '}
            semaines
          </label>
        ))}
      </div>
      <h2 className="my-4 text-lg font-semibold">Points d’attention</h2>
      {(['BDX', 'MUI'] as const).map((k) => (
        <label key={k} className="mb-3 block">
          <input
            type="checkbox"
            checked={f.attention.includes(k)}
            onChange={(e) => {
              setF({
                ...f,
                attention: e.target.checked
                  ? [...f.attention, k]
                  : f.attention.filter((x) => x !== k),
              })
            }}
          />{' '}
          {k === 'BDX' ? 'BDX : dossiers livrés à Bordeaux' : 'MUI : Ville de Paris'}
        </label>
      ))}
      <p className="my-4 text-sm text-slate-600">
        Le blocage d’une affiche utilisée par une campagne prévue reste toujours actif, quels que
        soient ces paramètres.
      </p>
      {message && <p role="status">{message}</p>}
      {erreur !== null && <ErrorMessage error={erreur} />}
      <Button type="submit" disabled={envoi}>
        Enregistrer les paramètres
      </Button>
    </form>
  )
}
