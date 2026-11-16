import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ListeColisSchema,
  ResultatFinDeJourneeSchema,
  STATUTS_COLIS,
  type StatutColis,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { IndicateurExpedition } from '../../components/coordination/expedition-nav.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille, type Ton } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// COO-P13 — ECR-EXP-02 « Colis » (RG-COO-268, 269, 271, RG-X-087). « Fin de journée » : colis « Clos · à expédier »
// → « Expédié » (RG-COO-269) et sorties de stock automatiques (RG-X-087). Le batch planifié est hors dépôt (Q-005) :
// l'action est manuelle. Boucle, canal, étiquette Geodis, preuve de livraison : Q-284 / D-17 (ECARTS). « Clos le » = date de clôture,
// « Expédié le » = date de la fin de journée ; le récépissé est le code externe du transporteur (Q-411).

const SearchSchema = z.object({
  type: z.enum(['fixe', 'pliage']).optional(),
  dossier: z.coerce.number().int().positive().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  destinataire: z.string().optional(),
  statut: z.enum(STATUTS_COLIS).optional(),
})

export const Route = createFileRoute('/expedition/colis')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('colis.gerer'),
  component: ListeDesColis,
})

const STATUT: Record<StatutColis, { libelle: string; ton: Ton }> = {
  EN_COURS: { libelle: 'Colis ouvert', ton: 'surveiller' },
  A_EXPEDIER: { libelle: 'Clos · à expédier', ton: 'info' },
  TERMINE: { libelle: 'Expédié', ton: 'ok' },
}

const dateHeure = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

function ListeDesColis() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(search) as [string, string | number | undefined][])
    if (v !== undefined && v !== '') qs.set(k, String(v))
  const { etat, recharger } = useApi(`colis-${qs.toString()}`, (signal) =>
    apiRequest('GET', `/api/coordination/colis?${qs.toString()}`, {
      schema: ListeColisSchema,
      signal,
    }),
  )
  const [filtres, setFiltres] = useState({
    dossier: search.dossier?.toString() ?? '',
    depart: search.depart ?? '',
    destinataire: search.destinataire ?? '',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)
  const [confirmation, setConfirmation] = useState(false)

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

  async function finDeJournee() {
    setConfirmation(false)
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      const r = await apiPost('/api/coordination/colis/fin-de-journee', {
        schema: ResultatFinDeJourneeSchema,
        body: {},
      })
      setMessage(r.message)
      if (r.manquants.length > 0)
        setMessage(
          `${r.message} ${String(r.manquants.length)} quantité(s) sans stock suffisant (tracées).`,
        )
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
      recharger()
    }
  }

  const d = etat.kind === 'ready' ? etat.data : null
  const filtresActifs = qs.size > 0

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">
        {search.type === 'fixe' ? '2 m² fixe' : search.type === 'pliage' ? 'Pliage' : 'Expédition'}
      </p>
      <h1 className="text-2xl font-semibold">
        {search.type ? 'Liste des colis' : 'Expédition · Colis'}
      </h1>
      <p className="mt-2 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
        <span>
          Les colis clos passent « Expédié » à la fin de journée ; les sorties de stock sont
          automatiques.
        </span>
        <Button
          type="button"
          className="ml-auto"
          disabled={envoi || !d}
          onClick={() => {
            setConfirmation(true)
          }}
        >
          Fin de journée
        </Button>
      </p>
      <Modale titre="Fin de journée" ouverte={confirmation} onOuverture={setConfirmation}>
        <p className="text-sm">
          Tous les colis clos du périmètre passent « Expédié » et leurs sorties de stock sont
          créées, quels que soient les filtres affichés. L’action est irréversible.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            onClick={() => {
              setConfirmation(false)
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={envoi}
            onClick={() => {
              void finDeJournee()
            }}
          >
            Confirmer la fin de journée
          </Button>
        </div>
      </Modale>
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
          Statut du colis
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={search.statut ?? ''}
            onChange={(e) => {
              void navigate({
                search: (s) => ({
                  ...s,
                  statut: e.target.value ? (e.target.value as StatutColis) : undefined,
                }),
              })
            }}
          >
            <option value="">Tous</option>
            {STATUTS_COLIS.map((s) => (
              <option key={s} value={s}>
                {STATUT[s].libelle}
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
      </form>
      <section aria-label="Indicateurs" className="mt-4 grid grid-cols-4 gap-3">
        <IndicateurExpedition titre="Colis" valeur={d?.total ?? null} />
        <IndicateurExpedition titre="Clos · à expédier" valeur={d?.indicateurs.clos ?? null} />
        <IndicateurExpedition titre="Expédiés" valeur={d?.indicateurs.expedies ?? null} />
        <IndicateurExpedition
          titre="Livrés (preuve reçue)"
          valeur={d?.indicateurs.livres ?? null}
        />
      </section>
      {message && (
        <p role="status" className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      {etat.kind === 'loading' && <p className="mt-4">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {d &&
        (d.colis.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            {filtresActifs
              ? 'Aucun colis ne correspond aux filtres.'
              : 'Aucun colis dans ce périmètre.'}
          </p>
        ) : (
          <table className="mt-4 w-full text-sm" aria-label="Colis">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th>Code colis</th>
                <th>Départ</th>
                <th>Destinataire</th>
                <th>Unités</th>
                <th>Poids</th>
                <th>Statut</th>
                <th>Récépissé</th>
                <th>Preuve de livraison</th>
                <th>Clos le</th>
                <th>Expédié le</th>
              </tr>
            </thead>
            <tbody>
              {d.colis.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b ${c.statut === 'A_EXPEDIER' ? 'border-l-4 border-l-sky-400' : c.statut === 'EN_COURS' ? 'border-l-4 border-l-amber-400' : ''}`}
                >
                  <td className="py-1">
                    <code>{c.code}</code>
                  </td>
                  <td>{c.depart ?? '—'}</td>
                  <td>{c.destinataire.nom}</td>
                  <td>{c.nbUnites + c.nbTrains}</td>
                  <td>{c.poids === null ? '—' : `${String(c.poids)} kg`}</td>
                  <td>
                    <Pastille ton={STATUT[c.statut].ton}>{STATUT[c.statut].libelle}</Pastille>
                  </td>
                  <td>{c.codeExterne ?? '—'}</td>
                  <td>—</td>
                  <td>{dateHeure(c.dateExpedition)}</td>
                  <td>{dateHeure(c.expedieLe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </main>
  )
}
