import { useState } from 'react'
import {
  DistributionsSchema,
  DistributionSchema,
  DistributionInputSchema,
  ROLES,
} from '@circe/shared'
import { apiRequest, apiPost } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../ui/table-metier.tsx'
import { Modale } from '../ui/modale.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Button } from '../button.tsx'
type Liste = ReturnType<typeof DistributionSchema.parse>
export function ListesDistribution() {
  const { etat, recharger } = useApi('listes-distribution', (signal) =>
    apiRequest('GET', '/api/admin/distributions', { schema: DistributionsSchema, signal }),
  )
  const [edition, setEdition] = useState<Liste | null | false>(false)
  return (
    <section className="mt-6">
      <div className="my-4 flex justify-between">
        <h2 className="text-lg font-semibold">Listes de distribution</h2>
        <Button
          onClick={() => {
            setEdition(null)
          }}
        >
          Ajouter une liste
        </Button>
      </div>
      {etat.kind === 'loading' && <p>Chargement des listes…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <TableMetier
            nom="Listes de distribution"
            lignes={etat.data.items}
            cle={(r) => r.id}
            colonnes={[
              { id: 'nom', titre: 'Liste', valeur: (r) => r.nom },
              {
                id: 'dest',
                titre: 'Destinataires (rôles)',
                valeur: (r) =>
                  r.roles
                    .map(
                      (role) =>
                        ({
                          coord: 'Coordination',
                          cheq: 'Chefs d’équipe',
                          recep: 'Réception',
                          expe: 'Expédition',
                          admin: 'Administrateurs',
                          com: 'Commerce',
                        })[role],
                    )
                    .join(', '),
              },
              { id: 'site', titre: 'Plateforme', valeur: (r) => r.site ?? 'Toutes' },
              { id: 'usage', titre: 'Utilisée par', valeur: (r) => r.usage },
            ]}
            actions={(r) => (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setEdition(r)
                }}
              >
                Modifier
              </button>
            )}
          />
          <p className="my-3 text-sm text-slate-600">
            Les listes regroupent des rôles par plateforme. Leur enregistrement ne déclenche aucun
            envoi de mail.
          </p>
          {edition !== false && (
            <Edition
              initial={edition}
              sites={etat.data.sites}
              onFermer={() => {
                setEdition(false)
              }}
              onSauvee={() => {
                setEdition(false)
                recharger()
              }}
            />
          )}
        </>
      )}
    </section>
  )
}
function Edition({
  initial,
  sites,
  onFermer,
  onSauvee,
}: {
  initial: Liste | null
  sites: { id: number; nom: string }[]
  onFermer: () => void
  onSauvee: () => void
}) {
  const [f, setF] = useState<ReturnType<typeof DistributionInputSchema.parse>>(
      initial ?? { version: 0, nom: '', plateformeId: null, roles: [], usage: '' },
    ),
    [envoi, setEnvoi] = useState(false),
    [erreur, setErreur] = useState<unknown>(null)
  async function sauver() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost(
        initial ? `/api/admin/distributions/${initial.id}` : '/api/admin/distributions',
        { schema: DistributionSchema, body: DistributionInputSchema.parse(f) },
      )
      onSauvee()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={initial ? 'Modifier la liste' : 'Ajouter une liste'}
      ouverte
      onOuverture={(o) => {
        if (!o && !envoi) onFermer()
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void sauver()
        }}
        className="space-y-4"
      >
        <label className="block">
          Liste
          <input
            required
            className="block w-full rounded border p-2"
            value={f.nom}
            onChange={(e) => {
              setF({ ...f, nom: e.target.value })
            }}
          />
        </label>
        <label className="block">
          Plateforme
          <select
            className="block w-full rounded border p-2"
            value={f.plateformeId ?? ''}
            onChange={(e) => {
              setF({ ...f, plateformeId: e.target.value ? Number(e.target.value) : null })
            }}
          >
            <option value="">Toutes</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Destinataires (rôles)</legend>
          {ROLES.map((role) => (
            <label key={role} className="block">
              <input
                type="checkbox"
                checked={f.roles.includes(role)}
                onChange={(e) => {
                  setF({
                    ...f,
                    roles: e.target.checked
                      ? [...f.roles, role]
                      : f.roles.filter((r) => r !== role),
                  })
                }}
              />{' '}
              {
                {
                  coord: 'Coordination',
                  cheq: 'Chefs d’équipe',
                  recep: 'Réception',
                  expe: 'Expédition',
                  admin: 'Administrateurs',
                  com: 'Commerce',
                }[role]
              }
            </label>
          ))}
        </fieldset>
        <label className="block">
          Utilisée par
          <textarea
            required
            className="block w-full rounded border p-2"
            value={f.usage}
            onChange={(e) => {
              setF({ ...f, usage: e.target.value })
            }}
          />
        </label>
        {erreur !== null && <ErrorMessage error={erreur} />}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={envoi} onClick={onFermer}>
            Annuler
          </button>
          <Button type="submit" disabled={envoi || !f.roles.length}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modale>
  )
}
