import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ApercusBaguesSchema,
  BaguesSchema,
  FILTRES_BAGUE,
  type FiltreBague,
  type LigneBague,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import {
  ApercuBagueCarte,
  ModaleImpressionBagues,
  ModaleReimpression,
  ModaleTextesBague,
} from '../../components/coordination/bagues.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { formatDepart, STATUT_UNITE } from './trains.tsx'

// COO-P11 — ECR-COO-11 « Bagues et étiquettes » (RG-COO-298 à 302). Unités : les trains du déroulant (les unités UM
// (rouleau) et lot relèvent de la création des UM, Q-265). Le poste (machine) n'est pas repris (D-02) : « Sans
// machine ». L'impression physique n'est pas pilotée (Q-002, Q-287) : aperçu navigateur.

const SearchSchema = z.object({
  dossier: z.coerce.number().int().positive().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  atelier: z.coerce.number().int().positive().optional(),
  bague: z.enum(FILTRES_BAGUE).optional(),
  destinataire: z.string().optional(),
})

export const Route = createFileRoute('/coordination/bagues')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('bague.imprimer'),
  component: Bagues,
})

const LIBELLE_FILTRE: Record<FiltreBague, string> = {
  A_IMPRIMER: 'À imprimer',
  IMPRIMEES: 'Imprimées',
  SANS_BAGUE: 'Sans bague, déjà en production',
}

function Bagues() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { etat: moi } = useApi('moi', () => getMe())
  const peut = (code: Parameters<typeof can>[1]) => moi.kind === 'ready' && can(moi.data, code)
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(search) as [string, string | number | undefined][])
    if (v !== undefined && v !== '') qs.set(k, String(v))
  const { etat, recharger } = useApi(`bagues-${qs.toString()}`, (signal) =>
    apiRequest('GET', `/api/coordination/bagues?${qs.toString()}`, {
      schema: BaguesSchema,
      signal,
    }),
  )
  const [filtres, setFiltres] = useState({
    dossier: search.dossier?.toString() ?? '',
    depart: search.depart ?? '',
    atelier: search.atelier?.toString() ?? '',
    destinataire: search.destinataire ?? '',
  })
  const [selection, setSelection] = useState<string[]>([])
  const [colonnes, setColonnes] = useState({ type: false, bague: true })
  const [message, setMessage] = useState<string | null>(null)
  const [impression, setImpression] = useState(false)
  const [apercu, setApercu] = useState<LigneBague | null>(null)
  const [textes, setTextes] = useState<LigneBague | null>(null)
  const [reimpression, setReimpression] = useState<LigneBague | null>(null)

  const lignes = etat.kind === 'ready' ? etat.data.lignes : []
  const choisies = lignes.filter((l) => selection.includes(l.trainId))
  const imprimables = choisies.filter((l) => l.imprimable)
  const atelierId = choisies[0]?.atelier?.id

  function appliquer(e: SyntheticEvent) {
    e.preventDefault()
    setSelection([])
    const num = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined)
    void navigate({
      search: (s) => ({
        ...s,
        dossier: num(filtres.dossier),
        depart: /^\d{4}-W\d{2}$/.test(filtres.depart.trim()) ? filtres.depart.trim() : undefined,
        atelier: num(filtres.atelier),
        destinataire: filtres.destinataire.trim() || undefined,
      }),
    })
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Déroulant</p>
      <h1 className="text-2xl font-semibold">Bagues et étiquettes</h1>
      <p className="mt-1 text-sm text-slate-600">
        L’impression d’une bague pose le rouleur et fait passer l’unité « Prêt à produire » à « En
        production » (point de non-retour). L’étiquette est un aperçu généré par le navigateur.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
        onSubmit={appliquer}
        aria-label="Filtres"
      >
        <label>
          N° de dossier
          <input
            className="ml-1 w-28 rounded-md border border-slate-300 px-2 py-1"
            inputMode="numeric"
            value={filtres.dossier}
            onChange={(e) => {
              setFiltres({ ...filtres, dossier: e.target.value })
            }}
          />
        </label>
        <label>
          Départ
          <input
            className="ml-1 w-24 rounded-md border border-slate-300 px-2 py-1"
            placeholder="AAAA-Wss"
            value={filtres.depart}
            onChange={(e) => {
              setFiltres({ ...filtres, depart: e.target.value })
            }}
          />
        </label>
        <label>
          Atelier
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={filtres.atelier}
            onChange={(e) => {
              setFiltres({ ...filtres, atelier: e.target.value })
            }}
          >
            <option value="">Tous</option>
            {(etat.kind === 'ready' ? etat.data.ateliers : []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.libelle} · {a.plateforme}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bague
          <select
            aria-label="Filtre Bague"
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={search.bague ?? 'A_IMPRIMER'}
            onChange={(e) => {
              setSelection([])
              void navigate({
                search: (s) => ({ ...s, bague: e.target.value as FiltreBague }),
              })
            }}
          >
            {FILTRES_BAGUE.map((f) => (
              <option key={f} value={f}>
                {LIBELLE_FILTRE[f]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Destinataire
          <input
            className="ml-1 w-40 rounded-md border border-slate-300 px-2 py-1"
            value={filtres.destinataire}
            onChange={(e) => {
              setFiltres({ ...filtres, destinataire: e.target.value })
            }}
          />
        </label>
        <Button type="submit">Filtrer</Button>
        <span className="ml-auto flex gap-3">
          <label>
            <input
              type="checkbox"
              checked={colonnes.type}
              onChange={(e) => {
                setColonnes({ ...colonnes, type: e.target.checked })
              }}
            />{' '}
            Type
          </label>
          <label>
            <input
              type="checkbox"
              checked={colonnes.bague}
              onChange={(e) => {
                setColonnes({ ...colonnes, bague: e.target.checked })
              }}
            />{' '}
            Bague
          </label>
        </span>
      </form>

      <div className="mt-3 flex items-center gap-3 text-sm">
        <Button
          type="button"
          disabled={imprimables.length === 0 || atelierId === undefined}
          title="Rouleur obligatoire ; unités « Prêt à produire » seulement (RG-COO-299)"
          onClick={() => {
            setImpression(true)
          }}
        >
          Imprimer les bagues ({imprimables.length})
        </Button>
        <span className="text-slate-500">{choisies.length} unité(s) sélectionnée(s)</span>
      </div>
      {message && (
        <p role="status" className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}

      <section className="mt-4" aria-label="Unités">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' &&
          (lignes.length === 0 ? (
            <p className="text-sm text-slate-600">Aucune unité pour ces critères.</p>
          ) : (
            <table className="w-full text-sm" aria-label="Bagues">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="w-8" />
                  <th>Unité</th>
                  <th>Atelier</th>
                  <th>Poste</th>
                  <th>Destinataire</th>
                  <th>Textes imprimés</th>
                  <th>Statut</th>
                  {colonnes.type && <th>Type</th>}
                  {colonnes.bague && <th>Bague</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr
                    key={l.trainId}
                    className={`border-b ${l.textes.some((t) => t.modifie) ? 'bg-amber-50' : ''}`}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${l.trainId}`}
                        checked={selection.includes(l.trainId)}
                        onChange={(e) => {
                          setSelection(
                            e.target.checked
                              ? [...selection, l.trainId]
                              : selection.filter((x) => x !== l.trainId),
                          )
                        }}
                      />
                    </td>
                    <td className="py-1">{l.trainId}</td>
                    <td>{l.atelier ? `${l.atelier.libelle} · ${l.atelier.plateforme}` : '—'}</td>
                    <td>{l.poste ?? 'Sans machine'}</td>
                    <td>{l.destinataire ?? '—'}</td>
                    <td>
                      {l.textes.map((t) => (
                        <span key={t.lettre} className="mr-2 inline-block">
                          {t.lettre} {t.annonceur ?? '—'} · {t.theme ?? '—'}
                          {t.modifie && <Pastille ton="surveiller">modifié</Pastille>}
                        </span>
                      ))}
                    </td>
                    <td>
                      <Pastille ton={STATUT_UNITE[l.statut].ton}>
                        {STATUT_UNITE[l.statut].libelle}
                      </Pastille>{' '}
                      <span className="text-xs text-slate-500">{formatDepart(l.depart)}</span>
                    </td>
                    {colonnes.type && <td>Train</td>}
                    {colonnes.bague && (
                      <td>
                        {l.bague
                          ? `Imprimée${l.bague.rouleur ? ` (${l.bague.rouleur})` : ''}${l.bague.reimpressions > 0 ? ` · réimprimée ${String(l.bague.reimpressions)} fois` : ''}`
                          : '—'}
                      </td>
                    )}
                    <td className="space-x-2">
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          setApercu(l)
                        }}
                      >
                        Aperçu
                      </button>
                      {l.bague && (
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            setTextes(l)
                          }}
                        >
                          Modifier
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </section>

      {impression && atelierId !== undefined && (
        <ModaleImpressionBagues
          trains={imprimables.map((l) => ({ trainId: l.trainId, version: l.version }))}
          atelierId={atelierId}
          onFermer={(msg) => {
            setImpression(false)
            if (msg) {
              setMessage(msg)
              setSelection([])
              recharger()
            }
          }}
        />
      )}
      {textes && (
        <ModaleTextesBague
          ligne={textes}
          onFermer={(msg) => {
            setTextes(null)
            if (msg) {
              setMessage(msg)
              recharger()
            }
          }}
        />
      )}
      {reimpression?.bague && (
        <ModaleReimpression
          trainId={reimpression.trainId}
          numero={reimpression.bague.numero}
          version={reimpression.bague.version}
          onFermer={(msg) => {
            setReimpression(null)
            if (msg) {
              setMessage(msg)
              recharger()
            }
          }}
        />
      )}
      {apercu && (
        <ModaleApercu
          ligne={apercu}
          peutReimprimer={peut('bague.reimprimer')}
          onReimprimer={() => {
            setReimpression(apercu)
            setApercu(null)
          }}
          onFermer={() => {
            setApercu(null)
          }}
        />
      )}
    </main>
  )
}

function ModaleApercu({
  ligne,
  peutReimprimer,
  onReimprimer,
  onFermer,
}: {
  ligne: LigneBague
  peutReimprimer: boolean
  onReimprimer: () => void
  onFermer: () => void
}) {
  const { etat, recharger } = useApi(`bague-apercu-${ligne.trainId}`, (signal) =>
    apiRequest(
      'GET',
      `/api/coordination/bagues/apercu?trains=${encodeURIComponent(ligne.trainId)}`,
      {
        schema: ApercusBaguesSchema,
        signal,
      },
    ),
  )
  return (
    <Modale
      titre={`Aperçu de la bague ${ligne.bague ? String(ligne.bague.numero) : ligne.trainId}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && etat.data.bagues[0] && (
        <ApercuBagueCarte bague={etat.data.bagues[0]} />
      )}
      <div className="mt-4 flex justify-end gap-2">
        {ligne.bague && peutReimprimer && (
          <Button type="button" onClick={onReimprimer}>
            Réimprimer la bague {ligne.bague.numero}…
          </Button>
        )}
        <Button
          type="button"
          onClick={() => {
            window.print()
          }}
        >
          Imprimer l’aperçu (PDF navigateur)
        </Button>
        <Button type="button" onClick={onFermer}>
          Fermer
        </Button>
      </div>
    </Modale>
  )
}
