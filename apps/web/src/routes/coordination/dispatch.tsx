import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  DispatchSchema,
  PickingSchema,
  ResultatDispatchSchema,
  STATUTS_DISPATCH,
  type Dispatch,
  type LigneDispatch,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Edition } from '../../components/impression/edition.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { formatDepart } from './trains.tsx'

// COO-P11 — ECR-COO-10 « Dispatch du roulage » (RG-COO-291 à 296). Un atelier déroulant par site. La répartition
// proposée est une règle SIMULÉE (moteur cible non fourni, Q-276) : départ le plus proche d'abord, puis rouleur le
// moins chargé. Seuils 36 h / 115 % : paramètres (`dispatch.seuilDepartHeures`, `dispatch.seuilChargePct`).

const SearchSchema = z.object({
  atelier: z.coerce.number().int().positive().optional(),
  dossier: z.coerce.number().int().positive().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  statut: z.enum(STATUTS_DISPATCH).optional(),
  destinataire: z.string().optional(),
})

export const Route = createFileRoute('/coordination/dispatch')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('dispatch.gerer'),
  component: DispatchRoulage,
})

const STATUT = {
  PRET: { libelle: 'Prêt', ton: 'info' },
  EN_PROD: { libelle: 'En production', ton: 'surveiller' },
} as const

function DispatchRoulage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(search) as [string, string | number | undefined][])
    if (v !== undefined && v !== '') qs.set(k, String(v))
  const { etat, recharger } = useApi(`dispatch-${qs.toString()}`, (signal) =>
    apiRequest('GET', `/api/coordination/dispatch?${qs.toString()}`, {
      schema: DispatchSchema,
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
  const [picking, setPicking] = useState<{ id: number; nom: string } | null>(null)

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

  async function action(chemin: string, corps: unknown) {
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      const r = await apiPost(chemin, { schema: ResultatDispatchSchema, body: corps })
      setMessage(r.message)
      recharger()
    } catch (e) {
      setErreur(e)
      recharger()
    } finally {
      setEnvoi(false)
    }
  }

  const d: Dispatch | null = etat.kind === 'ready' ? etat.data : null
  const tousTrains = d?.lignes.flatMap((l) => l.trains) ?? []

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Déroulant</p>
      <h1 className="text-2xl font-semibold">
        Déroulant · Dispatch du roulage
        {d?.atelier ? ` — ${d.atelier.plateforme} · ${d.atelier.libelle}` : ''}
      </h1>
      <form
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
        onSubmit={appliquer}
        aria-label="Filtres"
      >
        {d && d.ateliers.length > 1 && (
          <label>
            Atelier
            <select
              className="ml-1 rounded-md border border-slate-300 px-2 py-1"
              value={search.atelier ?? d.atelier?.id ?? ''}
              onChange={(e) => {
                void navigate({
                  search: (s) => ({ ...s, atelier: Number(e.target.value) }),
                })
              }}
            >
              {d.ateliers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.plateforme} · {a.libelle}
                </option>
              ))}
            </select>
          </label>
        )}
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
          Statut
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={search.statut ?? ''}
            onChange={(e) => {
              void navigate({
                search: (s) => ({
                  ...s,
                  statut: e.target.value ? (e.target.value as 'PRET' | 'EN_PROD') : undefined,
                }),
              })
            }}
          >
            <option value="">Tous</option>
            <option value="PRET">Prêt</option>
            <option value="EN_PROD">En production</option>
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
        <span className="ml-auto flex gap-2">
          <Button
            type="button"
            disabled={envoi || !d?.atelier || tousTrains.length === 0}
            onClick={() => {
              if (d?.atelier)
                void action('/api/coordination/dispatch/proposer', {
                  atelierId: d.atelier.id,
                  trains: tousTrains,
                })
            }}
          >
            Proposer une répartition
          </Button>
          <Button
            type="button"
            disabled={envoi || !d?.atelier || tousTrains.length === 0}
            onClick={() => {
              if (d?.atelier)
                void action('/api/coordination/dispatch/desaffecter', {
                  atelierId: d.atelier.id,
                  trains: tousTrains,
                })
            }}
          >
            Tout désaffecter
          </Button>
        </span>
      </form>
      <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
        Moteur de répartition à brancher : la répartition proposée applique une règle simulée
        (départ le plus proche d’abord, puis rouleur le moins chargé) en attendant l’algorithme
        cible.
      </p>
      {message && (
        <p role="status" className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      {etat.kind === 'loading' && <p className="mt-4">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {d && d.atelier === null && (
        <p className="mt-4 text-sm text-slate-600">Aucun atelier déroulant sur ce site.</p>
      )}
      {d?.atelier && (
        <>
          {d.alertes.departProche > 0 && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800"
            >
              {d.alertes.departProche} train(s) non affecté(s) partent dans moins de{' '}
              {d.alertes.seuilDepartHeures} h.
            </p>
          )}
          {d.alertes.surcharges.map((s) => (
            <p
              key={s.rouleur}
              role="alert"
              className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900"
            >
              {s.rouleur} : charge à {s.chargePct} % de la moyenne (seuil{' '}
              {d.alertes.seuilSurchargePct} %).
            </p>
          ))}
          <section
            className="mt-4 rounded-lg border border-slate-200 p-3"
            aria-label="Charge par rouleur"
          >
            <h2 className="font-semibold">Charge par rouleur</h2>
            {d.charge.length === 0 ? (
              <p className="text-sm text-slate-600">
                Aucun rouleur n’est enregistré pour cet atelier (référentiel des rouleurs).
              </p>
            ) : (
              <table className="mt-2 w-full text-sm" aria-label="Charge">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th>Rouleur</th>
                    <th>Poste</th>
                    <th className="text-right">Trains</th>
                    <th className="text-right">Faces</th>
                    <th>Charge</th>
                    <th>Destinataires</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.charge.map((c) => (
                    <tr key={c.rouleurId} className="border-b">
                      <td className="py-1">{c.nom}</td>
                      <td>{c.poste ?? '—'}</td>
                      <td className="text-right">{c.trains}</td>
                      <td className="text-right">{c.faces}</td>
                      <td>
                        <span
                          role="meter"
                          aria-label={`Charge de ${c.nom}`}
                          aria-valuenow={c.chargePct}
                          aria-valuemin={0}
                          aria-valuemax={200}
                          className="inline-block h-2 w-24 overflow-hidden rounded bg-slate-200 align-middle"
                        >
                          <span
                            className={`block h-2 ${c.surcharge ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${String(Math.min(100, c.chargePct / 2))}%` }}
                          />
                        </span>{' '}
                        {c.chargePct} %
                      </td>
                      <td>{c.destinataires.join(', ') || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            setPicking({ id: c.rouleurId, nom: c.nom })
                          }}
                        >
                          Liste de picking
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="mt-4 rounded-lg border border-slate-200 p-3" aria-label="À répartir">
            <h2 className="font-semibold">À répartir</h2>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Indicateur titre="Trains à rouler" valeur={d.indicateurs.trainsARouler} />
              <Indicateur titre="Faces" valeur={d.indicateurs.faces} />
              <Indicateur titre="Non affectés" valeur={d.indicateurs.nonAffectes} />
            </div>
          </section>
          <section
            className="mt-4 rounded-lg border border-slate-200 p-3"
            aria-label="Trains et affectation"
          >
            <h2 className="font-semibold">Trains et affectation</h2>
            {d.lignes.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Aucun train pour ces critères.</p>
            ) : (
              <table className="mt-2 w-full text-sm" aria-label="Trains">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th>Train</th>
                    <th>Destinataire</th>
                    <th>Départ</th>
                    <th>Positions</th>
                    <th className="text-right">Trains</th>
                    <th className="text-right">Faces</th>
                    <th>Statut</th>
                    <th>Rouleur</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lignes.map((l) => (
                    <LigneAffectation
                      key={l.cle}
                      ligne={l}
                      rouleurs={d.rouleurs}
                      desactive={envoi}
                      onChoix={(rouleurId) => {
                        void action('/api/coordination/dispatch/affecter', {
                          trains: l.trains,
                          rouleurId,
                        })
                      }}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
      {picking && (
        <ModalePicking
          rouleur={picking}
          depart={search.depart}
          onFermer={() => {
            setPicking(null)
          }}
        />
      )}
    </main>
  )
}

function Indicateur({ titre, valeur }: { titre: string; valeur: number }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <span className="block text-xs text-slate-500">{titre}</span>
      <span className="text-2xl font-semibold">{valeur}</span>
    </div>
  )
}

function LigneAffectation({
  ligne,
  rouleurs,
  desactive,
  onChoix,
}: {
  ligne: LigneDispatch
  rouleurs: Dispatch['rouleurs']
  desactive: boolean
  onChoix: (rouleurId: number | null) => void
}) {
  // RG-COO-294 : non affecté < 36 h → critique ; non affecté → avertissement.
  const teinte = ligne.rouleur === null ? (ligne.urgent ? 'bg-red-50' : 'bg-amber-50') : ''
  const choisi = ligne.rouleur?.id ?? ''
  const present = rouleurs.some((r) => r.id === ligne.rouleur?.id)
  return (
    <tr className={`border-b ${teinte}`}>
      <td className="py-1">{ligne.cle}</td>
      <td>{ligne.destinataire ?? '—'}</td>
      <td>{formatDepart(ligne.depart)}</td>
      <td>
        {ligne.positions.map((p) => (
          <span
            key={p.lettre}
            title={`${p.annonceur ?? '—'} · ${p.theme ?? '—'}`}
            className="mr-1 inline-block rounded border border-slate-300 px-1 text-xs"
          >
            {p.lettre}
          </span>
        ))}
      </td>
      <td className="text-right">{ligne.nb}</td>
      <td className="text-right">{ligne.faces}</td>
      <td>
        <Pastille ton={STATUT[ligne.statut].ton}>{STATUT[ligne.statut].libelle}</Pastille>
      </td>
      <td>
        <select
          aria-label={`Rouleur du train ${ligne.cle}`}
          className="rounded-md border border-slate-300 px-1 py-0.5"
          disabled={desactive}
          value={choisi}
          onChange={(e) => {
            onChoix(e.target.value === '' ? null : Number(e.target.value))
          }}
        >
          <option value="">Non affecté</option>
          {!present && ligne.rouleur && (
            <option value={ligne.rouleur.id}>{ligne.rouleur.nom}</option>
          )}
          {rouleurs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nom}
              {r.poste ? ` · ${r.poste}` : ''}
            </option>
          ))}
        </select>
      </td>
    </tr>
  )
}

// RG-COO-296 : « Liste des affaires à collecter : <rouleur> ».
function ModalePicking({
  rouleur,
  depart,
  onFermer,
}: {
  rouleur: { id: number; nom: string }
  depart: string | undefined
  onFermer: () => void
}) {
  const { etat, recharger } = useApi(`picking-${String(rouleur.id)}-${depart ?? ''}`, (signal) =>
    apiRequest(
      'GET',
      `/api/coordination/dispatch/picking?rouleur=${String(rouleur.id)}${depart ? `&depart=${depart}` : ''}`,
      { schema: PickingSchema, signal },
    ),
  )
  return (
    <Modale
      titre={`Liste des affaires à collecter : ${rouleur.nom}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' &&
        (etat.data.lignes.length === 0 ? (
          <p className="text-sm text-slate-600">Aucune affaire à collecter pour ce rouleur.</p>
        ) : (
          <Edition
            titre={`Liste des affaires à collecter : ${rouleur.nom}`}
            contexte={depart ? [`Départ : ${depart}`] : []}
          >
            <table className="w-full text-sm" aria-label="Affaires à collecter">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th>Emplacement</th>
                  <th>N° affiche</th>
                  <th>Annonceur</th>
                  <th>Thème</th>
                  <th className="text-right">Quantité</th>
                </tr>
              </thead>
              <tbody>
                {etat.data.lignes.map((l, i) => (
                  <tr key={`${String(l.numAffiche)}-${String(i)}`} className="border-b">
                    <td className="py-1">{l.emplacement ?? '—'}</td>
                    <td>{l.numAffiche ?? '—'}</td>
                    <td>{l.annonceur ?? '—'}</td>
                    <td>{l.theme ?? '—'}</td>
                    <td className="text-right">{l.quantite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Edition>
        ))}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          onClick={() => {
            window.print()
          }}
        >
          Imprimer (PDF navigateur)
        </Button>
        <Button type="button" onClick={onFermer}>
          Fermer
        </Button>
      </div>
    </Modale>
  )
}
