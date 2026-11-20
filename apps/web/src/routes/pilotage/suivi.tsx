import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { SuiviAtelierSchema, SuiviAtelierQuerySchema } from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { apiRequest } from '../../lib/api-client.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
export const Route = createFileRoute('/pilotage/suivi')({
  validateSearch: SuiviAtelierQuerySchema,
  beforeLoad: requirePermission('instruction.consulter'),
  component: Page,
})
function Page() {
  const q = Route.useSearch()
  const [filtres, setFiltres] = useState({
    dossiers: q.dossier ? String(q.dossier) : '',
    depart: q.depart ?? '',
    atelier: '',
    format: '',
    annonceur: '',
  })
  const params = new URLSearchParams(q.pour ? { pour: q.pour } : {})
  if (/^\d+$/.test(filtres.dossiers.trim())) params.set('dossier', filtres.dossiers.trim())
  if (filtres.depart) params.set('depart', filtres.depart)
  const { etat, recharger } = useApi(`suivi-${params}`, (signal) =>
    apiRequest('GET', `/api/pilotage/suivi?${params}`, { schema: SuiviAtelierSchema, signal }),
  )
  const lib =
    q.pour === 'fixe'
      ? 'Suivi 2 m² fixe'
      : q.pour === 'pliage'
        ? 'Suivi pliage'
        : q.pour === 'deroulant'
          ? 'Suivi déroulant'
          : 'Suivi de prod'
  const lien = (d: number | null, path: string, valeur: string) =>
    d ? (
      <a
        className="block rounded border p-2 underline"
        href={`${path}${path.includes('?') ? '&' : '?'}dossier=${d}`}
      >
        {valeur}
      </a>
    ) : (
      valeur
    )
  const toutes = etat.kind === 'ready' ? etat.data.items : []
  const dossiers = filtres.dossiers.split(/[,;\s]+/).filter(Boolean)
  // EX-PIL-NEW-001 — filtres cumulés de suivi.js ; aucune étape ni quantité recalculée.
  const lignes = toutes.filter(
    (r) =>
      (!dossiers.length || dossiers.includes(String(r.dossier))) &&
      (!filtres.depart || r.depart === filtres.depart) &&
      (!filtres.atelier || `${r.site} · ${r.atelier}` === filtres.atelier) &&
      (!filtres.format || r.format === filtres.format) &&
      (!filtres.annonceur ||
        (r.annonceur ?? '')
          .toLocaleLowerCase('fr')
          .includes(filtres.annonceur.toLocaleLowerCase('fr'))),
  )
  return (
    <main className="p-6">
      <h1 className="mb-5 text-2xl font-semibold">{lib}</h1>
      <div
        className="mb-5 flex flex-wrap items-end gap-3"
        role="group"
        aria-label="Filtres du suivi"
      >
        <label>
          Dossier(s)
          <input
            className="ml-2 rounded border p-2"
            value={filtres.dossiers}
            placeholder="Séparer par virgule"
            onChange={(e) => {
              setFiltres({ ...filtres, dossiers: e.target.value })
            }}
          />
        </label>
        <label>
          Départ
          <input
            className="ml-2 rounded border p-2"
            type="week"
            value={filtres.depart}
            onChange={(e) => {
              setFiltres({ ...filtres, depart: e.target.value })
            }}
          />
        </label>
        <label>
          Atelier
          <select
            className="ml-2 rounded border p-2"
            aria-label="Atelier"
            value={filtres.atelier}
            onChange={(e) => {
              setFiltres({ ...filtres, atelier: e.target.value })
            }}
          >
            <option value="">Tous</option>
            {[...new Set(toutes.map((r) => `${r.site} · ${r.atelier}`))].sort().map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Format
          <select
            className="ml-2 rounded border p-2"
            aria-label="Format"
            value={filtres.format}
            onChange={(e) => {
              setFiltres({ ...filtres, format: e.target.value })
            }}
          >
            <option value="">Tous</option>
            {[...new Set(toutes.map((r) => r.format))].sort().map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Annonceur
          <input
            className="ml-2 rounded border p-2"
            value={filtres.annonceur}
            onChange={(e) => {
              setFiltres({ ...filtres, annonceur: e.target.value })
            }}
          />
        </label>
        <button
          className="rounded border px-3 py-2"
          type="button"
          onClick={() => {
            setFiltres({ dossiers: '', depart: '', atelier: '', format: '', annonceur: '' })
          }}
        >
          Réinitialiser
        </button>
      </div>
      {etat.kind === 'loading' && <p>Chargement du suivi…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <TableMetier
          nom={lib}
          lignes={lignes}
          cle={(r) => r.id}
          colonnes={[
            { id: 'dossier', titre: 'Dossier', valeur: (r) => r.dossier },
            { id: 'annonceur', titre: 'Annonceur', valeur: (r) => r.annonceur },
            { id: 'theme', titre: 'Visuel', valeur: (r) => r.theme },
            { id: 'format', titre: 'Format', valeur: (r) => r.format },
            { id: 'site', titre: 'Site', valeur: (r) => r.site },
            { id: 'atelier', titre: 'Atelier', valeur: (r) => r.atelier },
            { id: 'depart', titre: 'Départ', valeur: (r) => r.depart },
            {
              id: 'prepa',
              titre: 'Pré-prod',
              valeur: (r) => r.preparation,
              rendu: (r) =>
                lien(
                  r.dossier,
                  `/coordination?pour=${q.pour ?? 'deroulant'}&aFaire=TOUS`,
                  `${r.preparation} · ${r.validees}/${r.affiches.length} affiche(s) validée(s)`,
                ),
            },
            {
              id: 'reception',
              titre: 'Réception',
              valeur: (r) => r.reception,
              rendu: (r) =>
                lien(
                  r.dossier,
                  '/reception/affiches',
                  `${r.reception} · ${r.recu}/${r.attendu ?? '—'}`,
                ),
            },
            {
              id: 'production',
              titre: 'Production',
              valeur: (r) => r.production,
              rendu: (r) =>
                lien(
                  r.dossier,
                  q.pour === 'deroulant'
                    ? '/coordination/trains'
                    : `/coordination/unitaire?type=${q.pour ?? 'fixe'}`,
                  r.production,
                ),
            },
            {
              id: 'expedition',
              titre: 'Expédition',
              valeur: (r) => r.expedition,
              rendu: (r) => lien(r.dossier, '/expedition/colis', r.expedition),
            },
            {
              id: 'nc',
              titre: 'Non-conformité',
              valeur: (r) => r.nc,
              rendu: (r) => lien(r.dossier, '/non-conformite?tab=suivi', `${r.nc} NC ouverte(s)`),
            },
            { id: 'recu', titre: 'Quantité reçue', valeur: (r) => r.recu, cachee: true },
            { id: 'attendu', titre: 'Quantité attendue', valeur: (r) => r.attendu, cachee: true },
            {
              id: 'affiches',
              titre: 'Affiches',
              valeur: (r) => r.affiches.join(', '),
              cachee: true,
            },
          ]}
        />
      )}
    </main>
  )
}
