import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  AteliersPerimetreSchema,
  ETAPES_RESERVATION,
  GRAINS_RESERVATIONS,
  LIBELLES_GRAINS,
  PHASES_RESERVATION,
  ReservationsSchema,
  type EtapeReservation,
} from '@circe/shared'
import { useState } from 'react'
import { z } from 'zod'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Pastille, type Ton } from '../../components/ui/pastille.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// ECR-PIL-03 — État des réservations vivant (RG-COO-107, 108, 101) : une base (lignes attendues de la semaine
// en cours et suivantes), des vues (« Afficher par »). Filtres sur les lignes fines puis regroupement (serveur).

const SearchSchema = z.object({
  par: z.enum(GRAINS_RESERVATIONS).optional(),
  dossier: z.coerce.number().int().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  atelierId: z.coerce.number().int().optional(),
  /** Une ou plusieurs étapes séparées par des virgules (une tuile pose toutes les étapes de sa phase). */
  ou: z
    .string()
    .regex(new RegExp(`^(${ETAPES_RESERVATION.join('|')})(,(${ETAPES_RESERVATION.join('|')}))*$`))
    .optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
})
type Search = z.infer<typeof SearchSchema>

export const Route = createFileRoute('/pilotage/reservations')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('reservations.consulter'),
  component: EtatDesReservations,
})

/** Liseré gauche de la ligne (maquette `tone`). */
const LISERE: Record<string, string> = {
  critique: 'border-l-4 border-l-red-500',
  surveiller: 'border-l-4 border-l-amber-400',
  info: 'border-l-4 border-l-sky-400',
  ok: 'border-l-4 border-l-emerald-500',
}

/** Libellés et tons de la maquette (« Où en est-il »). */
export const OU: Record<EtapeReservation, { libelle: string; ton: Ton }> = {
  DA_ACTIVEE: { libelle: 'DA activée, IP à saisir', ton: 'surveiller' },
  IP_SAISIES: { libelle: 'IP saisies, prépa attendue', ton: 'info' },
  PREPA_RECUE: { libelle: 'Prépa reçue, affiches attendues', ton: 'critique' },
  RECUES_EN_PARTIE: { libelle: 'Affiches reçues en partie', ton: 'important' },
  VALIDATION_A_CONFIRMER: {
    libelle: 'Affiches reçues, validation admin à confirmer',
    ton: 'important',
  },
  EN_PRODUCTION: { libelle: 'Prêt ou en production', ton: 'info' },
  PRODUIT: { libelle: 'Produit, à expédier', ton: 'ok' },
  EXPEDIE: { libelle: 'Expédié', ton: 'ok' },
  LIVRE: { libelle: 'Livré (preuve reçue)', ton: 'ok' },
  ANNULE: { libelle: 'Annulé', ton: 'info' },
}

const RECUE: Record<string, { libelle: string; ton: Ton }> = {
  OUI: { libelle: 'Oui', ton: 'ok' },
  OUI_SURPLUS: { libelle: 'Oui, surplus', ton: 'surveiller' },
  PARTIELLE: { libelle: 'Partielle', ton: 'important' },
  NON: { libelle: 'Non', ton: 'critique' },
  SANS_ATTENDU: { libelle: 'Sans attendu', ton: 'surveiller' },
}

const semaine = (s: string) => `S${s.slice(6)}`

function query(s: Search) {
  const p = new URLSearchParams()
  p.set('grain', s.par ?? 'THEME')
  for (const k of ['dossier', 'depart', 'atelierId', 'ou', 'page'] as const) {
    if (s[k] !== undefined) p.set(k, String(s[k]))
  }
  if (s.q) p.set('annonceur', s.q)
  return p.toString()
}

function EtatDesReservations() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const q = query(search)
  const { etat, recharger } = useApi(`reservations?${q}`, (signal) =>
    apiRequest('GET', `/api/coordination/reservations?${q}`, {
      schema: ReservationsSchema,
      signal,
    }),
  )
  const { etat: refAteliers } = useApi('coo-ateliers', (signal) =>
    apiRequest('GET', '/api/coordination/ateliers', { schema: AteliersPerimetreSchema, signal }),
  )
  const ateliers = refAteliers.kind === 'ready' ? refAteliers.data.ateliers : []
  const [saisieInvalide, setSaisieInvalide] = useState(false)
  const changer = (p: Partial<Search>) => {
    void navigate({
      search: (prev) => ({ ...prev, ...p, page: p.page ?? undefined }),
      replace: true,
    })
  }
  const grain = search.par ?? 'THEME'
  const champ = 'ml-1 rounded-md border border-slate-300 px-2 py-1 text-sm'
  // Un clic sur une tuile filtre TOUTES les étapes de sa phase (maquette `voir(PHASES.x)`).
  const tuile = (
    libelle: string,
    valeur: number | undefined,
    etapes?: readonly EtapeReservation[],
  ) => (
    <button
      type="button"
      className="rounded-lg border border-slate-200 bg-white p-3 text-left"
      onClick={() => {
        changer({ ou: etapes?.join(',') })
      }}
    >
      <span className="block text-xs text-slate-500">{libelle}</span>
      <span className="text-xl font-semibold">{valeur ?? '…'}</span>
    </button>
  )
  const ind = etat.kind === 'ready' ? etat.data.indicateurs : undefined
  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Pilotage</p>
      <h1 className="text-2xl font-semibold">État des réservations vivant</h1>
      <p className="mt-1 text-sm text-slate-600">
        Tous les dossiers dont la DA est activée, pour les départs de la semaine en cours et des
        suivantes.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Indicateurs">
        {tuile('Dossiers', ind?.dossiers)}
        {tuile('En pré-production', ind?.enPreProduction, PHASES_RESERVATION.enPreProduction)}
        {tuile('Affiches attendues', ind?.affichesAttendues, PHASES_RESERVATION.affichesAttendues)}
        {tuile('En production', ind?.enProduction, PHASES_RESERVATION.enProduction)}
        {tuile(
          'Produits ou expédiés',
          ind?.produitsOuExpedies,
          PHASES_RESERVATION.produitsOuExpedies,
        )}
      </div>
      <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm" role="note">
        Une base, des vues : chaque ligne vient des lignes attendues ; « Afficher par » regroupe. Le
        reçu et le reste sont comptés une fois par thème (un dossier sur deux semaines n’est pas
        compté deux fois).
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
        <label>
          Afficher par
          <select
            className={champ}
            value={grain}
            onChange={(e) => {
              changer({ par: e.target.value as Search['par'] })
            }}
          >
            {GRAINS_RESERVATIONS.map((g) => (
              <option key={g} value={g}>
                {LIBELLES_GRAINS[g]}
              </option>
            ))}
          </select>
        </label>
        <label>
          N° de dossier
          <input
            className={`${champ} w-28`}
            defaultValue={search.dossier ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = e.currentTarget.value.trim()
                const invalide = v !== '' && !/^\d+$/.test(v)
                setSaisieInvalide(invalide)
                if (!invalide) changer({ dossier: v ? Number(v) : undefined })
              }
            }}
          />
          {saisieInvalide && (
            <span role="alert" className="ml-2 text-xs text-red-700">
              Un n° de dossier ne contient que des chiffres.
            </span>
          )}
        </label>
        <label>
          Départ
          <input
            className={`${champ} w-28`}
            placeholder="2026-W43"
            defaultValue={search.depart ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = e.currentTarget.value.trim()
                if (v === '' || /^\d{4}-W\d{2}$/.test(v)) changer({ depart: v || undefined })
              }
            }}
          />
        </label>
        <label>
          Atelier
          <select
            className={champ}
            value={search.atelierId ?? ''}
            onChange={(e) => {
              changer({ atelierId: e.target.value ? Number(e.target.value) : undefined })
            }}
          >
            <option value="">Tous</option>
            {ateliers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.libelle} · {a.plateforme}
              </option>
            ))}
          </select>
        </label>
        <label>
          Où en est-il
          <select
            className={champ}
            value={search.ou ?? ''}
            onChange={(e) => {
              changer({ ou: e.target.value || undefined })
            }}
          >
            <option value="">Tous</option>
            {search.ou?.includes(',') && (
              <option value={search.ou}>Plusieurs étapes (indicateur)</option>
            )}
            {ETAPES_RESERVATION.map((o) => (
              <option key={o} value={o}>
                {OU[o].libelle}
              </option>
            ))}
          </select>
        </label>
        <label>
          Annonceur
          <input
            className={champ}
            defaultValue={search.q ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') changer({ q: e.currentTarget.value.trim() || undefined })
            }}
          />
        </label>
        <button
          type="button"
          className="underline"
          onClick={() => {
            void navigate({ search: {}, replace: true })
          }}
        >
          Effacer les filtres
        </button>
      </div>
      <section className="mt-4 rounded-lg border border-slate-200 bg-white">
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {etat.kind === 'ready' && etat.data.items.length === 0 && (
          <p className="p-3 text-sm text-slate-500">Aucune ligne avec ces filtres à ce grain.</p>
        )}
        {etat.kind === 'ready' && etat.data.items.length > 0 && (
          <table className="w-full text-sm" aria-label="État des réservations">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-2">{grain === 'FORMAT' ? 'Dossiers' : 'Dossier'}</th>
                <th className="p-2">{grain === 'FORMAT' ? 'Format' : 'Visuel'}</th>
                <th className="p-2">Départ</th>
                <th className="p-2">Où en est-il</th>
                <th className="p-2 text-right">Attendu</th>
                <th className="p-2 text-right">Reçu</th>
                <th className="p-2 text-right">Reste à recevoir</th>
                <th className="p-2">{grain === 'THEME' ? 'N° d’affiche' : 'Thèmes'}</th>
              </tr>
            </thead>
            <tbody>
              {etat.data.items.map((l) => (
                <tr
                  key={l.cle}
                  className={`border-t border-slate-100 ${l.lisere ? (LISERE[l.lisere] ?? '') : ''}`}
                >
                  <td className="p-2">{grain === 'FORMAT' ? l.dossiers : (l.dossier ?? '—')}</td>
                  <td className="p-2">
                    {grain === 'FORMAT' ? (
                      (l.format ?? '—')
                    ) : (
                      <>
                        {l.annonceur ? `${l.annonceur} · ` : ''}
                        {l.visuel ?? (l.themes > 1 ? `${String(l.themes)} thèmes` : 'IP à saisir')}
                      </>
                    )}
                    {l.reperes.includes('MULTI_SEMAINES') && (
                      <span className="ml-1">
                        <Pastille ton="surveiller">Multi-semaines</Pastille>
                      </span>
                    )}
                  </td>
                  <td className="p-2">{l.departs.map(semaine).join('+')}</td>
                  <td className="p-2">
                    <Pastille ton={OU[l.ou].ton}>{OU[l.ou].libelle}</Pastille>
                  </td>
                  <td className="p-2 text-right">{l.attendu}</td>
                  <td className="p-2 text-right">
                    {l.recu}
                    {l.afficheRecue && (
                      <span className="ml-1">
                        <Pastille ton={RECUE[l.afficheRecue]?.ton ?? 'neutre'}>
                          {RECUE[l.afficheRecue]?.libelle}
                        </Pastille>
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right">{l.resteARecevoir}</td>
                  <td className="p-2">
                    {grain === 'THEME'
                      ? l.numerosAffiche.map((n) => `${String(n.id)} ${n.marque}`).join(', ') || '—'
                      : l.themes}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 font-medium">
              <tr>
                <td className="p-2" colSpan={4}>
                  Total ({etat.data.total} ligne(s))
                </td>
                <td className="p-2 text-right">{etat.data.totaux.attendu}</td>
                <td className="p-2 text-right">{etat.data.totaux.recu}</td>
                <td className="p-2 text-right">{etat.data.totaux.resteARecevoir}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
        {etat.kind === 'ready' && etat.data.total > etat.data.pageSize && (
          <nav className="flex gap-2 p-2 text-sm" aria-label="Pagination">
            <button
              type="button"
              disabled={etat.data.page <= 1}
              onClick={() => {
                changer({ page: etat.data.page - 1 })
              }}
            >
              Précédent
            </button>
            <span>Page {etat.data.page}</span>
            <button
              type="button"
              disabled={etat.data.page * etat.data.pageSize >= etat.data.total}
              onClick={() => {
                changer({ page: etat.data.page + 1 })
              }}
            >
              Suivant
            </button>
          </nav>
        )}
      </section>
    </main>
  )
}
