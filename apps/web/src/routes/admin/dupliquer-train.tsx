import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ResultatSimpleSchema } from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiPost } from '../../lib/api-client.ts'
import { ErrorMessage } from '../../components/error-message.tsx'
export const Route = createFileRoute('/admin/dupliquer-train')({
  beforeLoad: requirePermission('train.dupliquer'),
  component: Page,
})
function Page() {
  const [f, setF] = useState({ trainSource: '', trainCible: '', afficheur: '', nombre: 1 }),
    [erreur, setErreur] = useState<unknown>(null),
    [message, setMessage] = useState(''),
    [envoi, setEnvoi] = useState(false)
  async function dupliquer() {
    setEnvoi(true)
    setErreur(null)
    setMessage('')
    try {
      const r = await apiPost('/api/coordination/trains/dupliquer', {
        schema: ResultatSimpleSchema,
        body: f,
      })
      setMessage(r.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <main className="max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Dupliquer train</h1>
      <p>
        Les copies reprennent le statut À imprimer. Les identifiants cibles suivent la règle
        existante (+190) et les collisions sont refusées.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void dupliquer()
        }}
      >
        {(['trainSource', 'trainCible', 'afficheur'] as const).map((k) => (
          <label key={k} className="block">
            {
              {
                trainSource: 'Train source',
                trainCible: 'Premier train cible',
                afficheur: 'Afficheur',
              }[k]
            }
            <input
              className="block w-full rounded border p-2"
              required
              value={f[k]}
              onChange={(e) => {
                setF({ ...f, [k]: e.target.value })
              }}
            />
          </label>
        ))}
        <label className="block">
          Nombre de copies
          <input
            className="ml-3 rounded border p-2"
            type="number"
            min={1}
            max={50}
            required
            value={f.nombre}
            onChange={(e) => {
              setF({ ...f, nombre: Number(e.target.value) })
            }}
          />
        </label>
        {erreur !== null && <ErrorMessage error={erreur} />}
        <p role="status">{message}</p>
        <button disabled={envoi} className="rounded border p-2">
          Dupliquer
        </button>
      </form>
    </main>
  )
}
