import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import {
  AcquitterAlertesResultatSchema,
  LIBELLES_TYPES_ALERTE,
  ListeAlertesSchema,
  TYPES_ALERTE,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type AlertePilotage,
  type TypeAlerte,
} from '@circe/shared'
import { useState } from 'react'
import { z } from 'zod'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// ECR-TRA-01 — Pilotage › Alertes (RG-COO-075) : toutes les exceptions au même endroit, Réception (RG-REC-182 à
// 189) et Coordination / Pré-Prod (RG-COO-030 à 033, 053, 066 à 074, 086, 103, 116, 122). Alertes calculées
// par l'API ; chaque alerte ouvre l'écran où agir. Acquittement : droit non ouvert tant que Q-220 n'a pas
// désigné qui acquitte.

const SearchSchema = z.object({
  dossier: z.coerce.number().int().optional(),
  /** Semaines de départ séparées par des virgules ; « TOUTES » = sans filtre ; absent = S et S+1. */
  depart: z.string().optional(),
  type: z.string().optional(),
  etat: z.enum(['OUVERTES', 'ACQUITTEES']).optional(),
  site: z.coerce.number().int().optional(),
})
type Search = z.infer<typeof SearchSchema>

export const Route = createFileRoute('/pilotage/alertes')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('alerte.consulter'),
  component: Alertes,
})

/** S et S+1 (maquette : filtre Départ par défaut). */
function departsParDefaut(maintenant = new Date()) {
  const s = semaineIsoDe(maintenant)
  const s1 = semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + 7 * 86_400_000))
  return [formatSemaineIso(s), formatSemaineIso(s1)]
}

const liste = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : [])
const semaine = (s: string) => `S${s.slice(6)}`
const dateCourte = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })

function query(s: Search) {
  const p = new URLSearchParams()
  if (s.dossier !== undefined) p.set('dossier', String(s.dossier))
  const departs = s.depart === 'TOUTES' ? [] : s.depart ? liste(s.depart) : departsParDefaut()
  if (departs.length) p.set('depart', departs.join(','))
  if (s.type) p.set('type', s.type)
  if (s.etat) p.set('etat', s.etat)
  if (s.site !== undefined) p.set('site', String(s.site))
  return p.toString()
}

function Alertes() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const q = query(search)
  const { etat, recharger } = useApi(`alertes?${q}`, (signal) =>
    apiRequest('GET', `/api/alertes?${q}`, { schema: ListeAlertesSchema, signal }),
  )
  const [selection, setSelection] = useState<string[]>([])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saisieInvalide, setSaisieInvalide] = useState(false)
  const changer = (p: Partial<Search>) => {
    setSelection([])
    void navigate({ search: (prev) => ({ ...prev, ...p }), replace: true })
  }
  const types = liste(search.type) as TypeAlerte[]
  const basculerType = (t: TypeAlerte) => {
    const s = new Set(types)
    if (s.has(t)) s.delete(t)
    else s.add(t)
    changer({ type: [...s].join(',') || undefined })
  }
  const acquitter = async (cles: string[]) => {
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      const r = await apiRequest('POST', '/api/alertes/acquittements', {
        schema: AcquitterAlertesResultatSchema,
        body: { cles },
        idempotencyKey: true,
      })
      setMessage(r.message)
      setSelection([])
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  const champ = 'ml-1 rounded-md border border-slate-300 px-2 py-1 text-sm'
  const data = etat.kind === 'ready' ? etat.data : null
  const sites = data
    ? [
        ...new Map(
          data.alertes
            .filter((a) => a.plateformeId !== null && a.site)
            .map((a) => [a.plateformeId, a.site]),
        ),
      ]
    : []
  const departDefaut = departsParDefaut()
  const peutAcquitter = data?.peutAcquitter ?? false
  const motifAcquittement = peutAcquitter
    ? undefined
    : 'Acquittement non ouvert : qui acquitte une alerte reste à décider (Q-220).'
  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Pilotage</p>
          <h1 className="text-2xl font-semibold">Alertes</h1>
        </div>
        <Link
          to="/admin/alertes"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          Règles et destinataires
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
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
          <select
            className={champ}
            value={search.depart ?? ''}
            onChange={(e) => {
              changer({ depart: e.target.value || undefined })
            }}
          >
            <option value="">
              {departDefaut.map(semaine).join(' + ')} (alertes sans semaine incluses)
            </option>
            {departDefaut.map((s) => (
              <option key={s} value={s}>
                {semaine(s)}
              </option>
            ))}
            <option value="TOUTES">Toutes les semaines</option>
          </select>
        </label>
        <label>
          État
          <select
            className={champ}
            value={search.etat ?? 'OUVERTES'}
            onChange={(e) => {
              changer({ etat: e.target.value === 'OUVERTES' ? undefined : 'ACQUITTEES' })
            }}
          >
            <option value="OUVERTES">Ouvertes</option>
            <option value="ACQUITTEES">Acquittées</option>
          </select>
        </label>
        <label>
          Site
          <select
            className={champ}
            value={search.site ?? ''}
            onChange={(e) => {
              changer({ site: e.target.value ? Number(e.target.value) : undefined })
            }}
          >
            <option value="">Tous</option>
            {sites.map(([id, nom]) => (
              <option key={String(id)} value={String(id)}>
                {nom}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            setSelection([])
            void navigate({ search: {}, replace: true })
          }}
        >
          Réinitialiser
        </button>
      </div>

      <details className="mt-3 rounded border p-3">
        <summary>Type ({types.length || 'tous'})</summary>
        <div className="grid gap-2 sm:grid-cols-3 mt-2">
          {TYPES_ALERTE.map((t) => (
            <label key={t} className="text-sm">
              <input
                type="checkbox"
                checked={types.includes(t)}
                onChange={() => {
                  basculerType(t)
                }}
              />{' '}
              {LIBELLES_TYPES_ALERTE[t]} ({data?.parType[t] ?? 0})
            </label>
          ))}
        </div>
      </details>

      {message && (
        <p
          role="status"
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm"
        >
          {message}
        </p>
      )}
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-sm">
        <button
          type="button"
          disabled={!peutAcquitter || selection.length === 0 || envoi}
          title={motifAcquittement}
          className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          onClick={() => void acquitter(selection)}
        >
          Acquitter{selection.length ? ` (${String(selection.length)})` : ''}
        </button>
      </div>

      <section className="mt-2 rounded-lg border border-slate-200 bg-white">
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {data && data.alertes.length === 0 && (
          <p className="p-3 text-sm text-slate-600">Aucune alerte avec ces filtres.</p>
        )}
        {data && data.alertes.length > 0 && (
          <table className="w-full text-sm" aria-label="Alertes">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Sélection</span>
                </th>
                {['Type', 'Alerte', 'Site', 'Départ', 'Échéance / date', 'Règle', ''].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.alertes]
                .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
                .map((a) => (
                  <LigneAlerte
                    key={a.cle}
                    a={a}
                    selectionnee={selection.includes(a.cle)}
                    onSelection={(oui) => {
                      setSelection((s) => (oui ? [...s, a.cle] : s.filter((c) => c !== a.cle)))
                    }}
                    peutAcquitter={peutAcquitter}
                    motif={motifAcquittement}
                    envoi={envoi}
                    onAcquitter={() => void acquitter([a.cle])}
                  />
                ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}

function LigneAlerte({
  a,
  selectionnee,
  onSelection,
  peutAcquitter,
  motif,
  envoi,
  onAcquitter,
}: {
  a: AlertePilotage
  selectionnee: boolean
  onSelection: (oui: boolean) => void
  peutAcquitter: boolean
  motif: string | undefined
  envoi: boolean
  onAcquitter: () => void
}) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2">
        {a.acquittee === null && (
          <input
            type="checkbox"
            aria-label={`Sélectionner l’alerte ${a.titre}`}
            checked={selectionnee}
            onChange={(e) => {
              onSelection(e.target.checked)
            }}
          />
        )}
      </td>
      <td className="px-3 py-2">{LIBELLES_TYPES_ALERTE[a.type]}</td>
      <td className="max-w-xl px-3 py-2">
        <strong>{a.titre}</strong>
        <div className="text-xs text-slate-600">{a.message}</div>
        <div className="text-xs text-slate-500">Pour : {a.destinataires.join(', ')}</div>
      </td>
      <td className="px-3 py-2">{a.site ?? '—'}</td>
      <td className="px-3 py-2">{a.depart ? semaine(a.depart) : '—'}</td>
      <td className="px-3 py-2">{a.date ? dateCourte(a.date) : '—'}</td>
      <td className="px-3 py-2">
        <Pastille ton="neutre">{a.regle}</Pastille>
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <a className="underline" href={a.lien}>
          Ouvrir
        </a>
        {a.acquittee ? (
          <span className="ml-2 text-xs text-slate-500">
            acquittée{a.acquittee.par ? ` par ${a.acquittee.par}` : ''}
          </span>
        ) : (
          <button
            type="button"
            className="ml-2 text-xs underline disabled:opacity-40"
            disabled={!peutAcquitter || envoi}
            title={motif}
            onClick={onAcquitter}
          >
            Acquitter
          </button>
        )}
      </td>
    </tr>
  )
}
