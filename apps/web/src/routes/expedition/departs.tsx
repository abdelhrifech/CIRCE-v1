import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DepartsCamionsSchema, type GraviteDepart } from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { IndicateurExpedition } from '../../components/coordination/expedition-nav.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// D-14 — ECR-EXP-03 « Départs camions » (lecture seule). Le jour / l'heure de départ, la boucle et le canal ne sont
// pas modélisés (Q-403) : un départ est une semaine ISO, une ligne = départ × destinataire (Q-411). Les unités sont
// les trains (statut calculé) et les UM des ateliers fixes, hors Bus.

const SearchSchema = z.object({
  dossier: z.coerce.number().int().positive().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  destinataire: z.string().optional(),
})

export const Route = createFileRoute('/expedition/departs')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('colis.gerer'),
  component: DepartsCamions,
})

const LISERE: Record<GraviteDepart, string> = {
  CRITIQUE: 'border-l-4 border-l-red-500',
  ATTENTION: 'border-l-4 border-l-amber-400',
  PRET: 'border-l-4 border-l-emerald-500',
  AUCUNE: '',
}

function DepartsCamions() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(search) as [string, string | number | undefined][])
    if (v !== undefined && v !== '') qs.set(k, String(v))
  const { etat, recharger } = useApi(`departs-${qs.toString()}`, (signal) =>
    apiRequest('GET', `/api/coordination/colis/departs?${qs.toString()}`, {
      schema: DepartsCamionsSchema,
      signal,
    }),
  )
  const [filtres, setFiltres] = useState({
    dossier: search.dossier?.toString() ?? '',
    depart: search.depart ?? '',
    destinataire: search.destinataire ?? '',
  })

  function appliquer(e: SyntheticEvent) {
    e.preventDefault()
    const num = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined)
    void navigate({
      search: (s) => ({
        ...s,
        dossier: num(filtres.dossier),
        depart: /^\d{4}-W\d{2}$/.test(filtres.depart.trim()) ? filtres.depart.trim() : undefined,
        destinataire: filtres.destinataire.trim() || undefined,
      }),
    })
  }

  const d = etat.kind === 'ready' ? etat.data : null
  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Expédition</p>
      <h1 className="text-2xl font-semibold">Expédition · Départs camions</h1>
      <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
        Avancement du colisage par départ. Le jour et l’heure de départ et la boucle de transport ne
        sont pas encore paramétrés : un départ est une semaine, une ligne est un destinataire.
        {d?.depuis ? ` Départs depuis la semaine ${d.depuis} (sans filtre de départ).` : ''}
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
      </form>
      <section aria-label="Indicateurs" className="mt-4 grid grid-cols-4 gap-3">
        <IndicateurExpedition titre="Unités" valeur={d?.indicateurs.unites ?? null} />
        <IndicateurExpedition titre="Colisées / parties" valeur={d?.indicateurs.colisees ?? null} />
        <IndicateurExpedition titre="En cours" valeur={d?.indicateurs.enCours ?? null} />
        <IndicateurExpedition
          titre="En attente d’affiches"
          valeur={d?.indicateurs.enAttente ?? null}
        />
      </section>
      {etat.kind === 'loading' && <p className="mt-4">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {d &&
        (d.departs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            {qs.size > 0
              ? 'Aucun départ ne correspond aux filtres.'
              : 'Aucun départ dans ce périmètre.'}
          </p>
        ) : (
          <table className="mt-4 w-full text-sm" aria-label="Départs camions">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th>Départ</th>
                <th>Destinations</th>
                <th>Unités</th>
                <th>Colisées / parties</th>
                <th>En cours</th>
                <th>En attente d’affiches</th>
                <th>Avancement</th>
              </tr>
            </thead>
            <tbody>
              {d.departs.map((l) => (
                <tr
                  key={`${l.depart}-${String(l.destinataire.id)}-${l.plateforme}`}
                  className={`border-b ${LISERE[l.gravite]}`}
                >
                  <td className="py-1">
                    {l.depart}
                    {l.departLe ? (
                      <span className="ml-1 text-xs text-slate-500">
                        ({new Date(l.departLe).toLocaleDateString('fr-FR')})
                      </span>
                    ) : null}
                  </td>
                  <td>{l.destinataire.nom}</td>
                  <td>{l.unites}</td>
                  <td>{l.colisees}</td>
                  <td>{l.enCours}</td>
                  <td>{l.enAttente}</td>
                  <td>
                    <progress
                      value={l.avancement}
                      max={100}
                      aria-label={`Avancement ${String(l.avancement)} %`}
                    />{' '}
                    {l.avancement} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </main>
  )
}
