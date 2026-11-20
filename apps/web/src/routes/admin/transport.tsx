import { useState } from 'react'
import { Button } from '../../components/button.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { createFileRoute } from '@tanstack/react-router'
import {
  BouclesTransportSchema,
  BoucleTransportInputSchema,
  BoucleTransportSchema,
  TransportAdminSchema,
} from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiRequest, apiPost } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { PageAdmin } from '../../components/admin/page.tsx'
export const Route = createFileRoute('/admin/transport')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Page,
})
function Page() {
  const [page, setPage] = useState(1)
  const { etat, recharger } = useApi(`transport-admin-${page}`, (signal) =>
    apiRequest('GET', `/api/admin/transport?page=${page}`, {
      schema: TransportAdminSchema,
      signal,
    }),
  )
  return (
    <PageAdmin titre="Transport">
      <h2 className="mb-3 text-lg font-semibold">Destinations et transporteurs par atelier</h2>
      {etat.kind === 'loading' && <p>Chargement des transports…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <TableMetier
            nom="Transport par destination"
            lignes={etat.data.items}
            cle={(r) => r.id}
            colonnes={[
              { id: 'site', titre: 'Plateforme', valeur: (r) => r.site },
              { id: 'atelier', titre: 'Atelier', valeur: (r) => r.atelier },
              { id: 'destination', titre: 'Destination', valeur: (r) => r.destinataire },
              { id: 'transporteur', titre: 'Code transporteur', valeur: (r) => r.transporteur },
              { id: 'tarif', titre: 'Tarif', valeur: (r) => r.tarif },
            ]}
          />
          <div className="my-3 flex items-center gap-3">
            <Button
              disabled={page === 1}
              onClick={() => {
                setPage(page - 1)
              }}
            >
              Précédent
            </Button>
            <span>
              Page {page} · {etat.data.total} correspondance(s)
            </span>
            <Button
              disabled={page * etat.data.pageSize >= etat.data.total}
              onClick={() => {
                setPage(page + 1)
              }}
            >
              Suivant
            </Button>
          </div>
        </>
      )}
      <Boucles />
    </PageAdmin>
  )
}

type Boucle = ReturnType<typeof BoucleTransportSchema.parse>
function Boucles() {
  const { etat, recharger } = useApi('boucles-admin', (signal) =>
    apiRequest('GET', '/api/admin/transport/boucles', { schema: BouclesTransportSchema, signal }),
  )
  const [edition, setEdition] = useState<Boucle | null | false>(false),
    [message, setMessage] = useState('')
  return (
    <section className="mt-5">
      <div className="my-4 flex justify-between">
        <h2 className="text-lg font-semibold">Boucles et horaires de départ</h2>
        <Button
          onClick={() => {
            setEdition(null)
          }}
        >
          Ajouter une boucle
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      {etat.kind === 'loading' && <p>Chargement des boucles…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <TableMetier
            nom="Boucles de transport"
            lignes={etat.data.items}
            cle={(b) => b.id}
            colonnes={[
              { id: 'site', titre: 'Plateforme', valeur: (b) => b.site },
              { id: 'boucle', titre: 'Boucle', valeur: (b) => b.nom },
              {
                id: 'canal',
                titre: 'Canal',
                valeur: (b) => (b.canal === 'MILK_RUN' ? 'Milk run' : 'Messagerie'),
              },
              {
                id: 'depart',
                titre: 'Départ',
                valeur: (b) =>
                  `${['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.', 'lun.'][b.jour]} ${b.jour < 7 ? 'S-1' : 'S'} ${b.heure}`,
              },
              { id: 'dest', titre: 'Destinations', valeur: (b) => b.destinations.join(', ') },
            ]}
            actions={(b) => (
              <button
                className="underline"
                onClick={() => {
                  setEdition(b)
                }}
              >
                Modifier
              </button>
            )}
          />
          <p className="my-3 text-sm text-slate-600">
            Ces horaires décrivent les départs de transport. Leur raccordement aux calculs et
            alertes des traitements existants est séparé du paramétrage.
          </p>
          {edition !== false && (
            <EditBoucle
              initial={edition}
              refs={etat.data}
              onFermer={() => {
                setEdition(false)
              }}
              onSauvee={() => {
                setMessage('Boucle enregistrée.')
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
function EditBoucle({
  initial,
  refs,
  onFermer,
  onSauvee,
}: {
  initial: Boucle | null
  refs: ReturnType<typeof BouclesTransportSchema.parse>
  onFermer: () => void
  onSauvee: () => void
}) {
  const [f, setF] = useState<ReturnType<typeof BoucleTransportInputSchema.parse>>(
      initial ?? {
        version: 0,
        plateformeId: refs.sites[0]?.id ?? 0,
        nom: '',
        canal: 'MILK_RUN',
        jour: 0,
        heure: '08:00',
        destinataires: [],
      },
    ),
    [envoi, setEnvoi] = useState(false),
    [erreur, setErreur] = useState<unknown>(null)
  async function sauver() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost(
        initial ? `/api/admin/transport/boucles/${initial.id}` : '/api/admin/transport/boucles',
        { schema: BoucleTransportSchema, body: BoucleTransportInputSchema.parse(f) },
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
      titre={initial ? 'Modifier la boucle' : 'Ajouter une boucle'}
      ouverte
      large
      onOuverture={(o) => {
        if (!o && !envoi) onFermer()
      }}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void sauver()
        }}
      >
        <label className="block">
          Plateforme
          <select
            className="ml-3 rounded border p-2"
            value={f.plateformeId}
            onChange={(e) => {
              setF({ ...f, plateformeId: Number(e.target.value) })
            }}
          >
            {refs.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Boucle
          <input
            className="ml-3 rounded border p-2"
            required
            value={f.nom}
            onChange={(e) => {
              setF({ ...f, nom: e.target.value })
            }}
          />
        </label>
        <label className="block">
          Canal
          <select
            className="ml-3 rounded border p-2"
            value={f.canal}
            onChange={(e) => {
              setF({ ...f, canal: e.target.value === 'MESSAGERIE' ? 'MESSAGERIE' : 'MILK_RUN' })
            }}
          >
            <option value="MILK_RUN">Milk run</option>
            <option value="MESSAGERIE">Messagerie</option>
          </select>
        </label>
        <label className="block">
          Jour
          <select
            className="ml-3 rounded border p-2"
            value={f.jour}
            onChange={(e) => {
              setF({ ...f, jour: Number(e.target.value) })
            }}
          >
            {[
              'Lundi S-1',
              'Mardi S-1',
              'Mercredi S-1',
              'Jeudi S-1',
              'Vendredi S-1',
              'Samedi S-1',
              'Dimanche S-1',
              'Lundi S',
            ].map((j, n) => (
              <option key={n} value={n}>
                {j}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Heure
          <input
            type="time"
            required
            className="ml-3 rounded border p-2"
            value={f.heure}
            onChange={(e) => {
              setF({ ...f, heure: e.target.value })
            }}
          />
        </label>
        <fieldset className="max-h-52 overflow-auto rounded border p-3">
          <legend>Destinations</legend>
          {refs.destinataires.map((d) => (
            <label key={d.id} className="block">
              <input
                type="checkbox"
                checked={f.destinataires.includes(d.id)}
                onChange={(e) => {
                  setF({
                    ...f,
                    destinataires: e.target.checked
                      ? [...f.destinataires, d.id]
                      : f.destinataires.filter((id) => id !== d.id),
                  })
                }}
              />{' '}
              {d.nom}
            </label>
          ))}
        </fieldset>
        {erreur !== null && <ErrorMessage error={erreur} />}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={envoi} onClick={onFermer}>
            Annuler
          </button>
          <Button type="submit" disabled={envoi || !f.plateformeId}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modale>
  )
}
