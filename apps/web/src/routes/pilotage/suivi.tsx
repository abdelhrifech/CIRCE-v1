import { createFileRoute } from '@tanstack/react-router'
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
  const q = Route.useSearch(),
    params = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)]))
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
  return (
    <main className="p-6">
      <h1 className="mb-5 text-2xl font-semibold">{lib}</h1>
      {etat.kind === 'loading' && <p>Chargement du suivi…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <TableMetier
          nom={lib}
          lignes={etat.data.items}
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
