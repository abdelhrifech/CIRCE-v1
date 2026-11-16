import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  AColiserSchema,
  FicheColisSchema,
  ResultatColisSchema,
  type AColiser,
  type ColisLigne,
  type FicheColis,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { IndicateurExpedition } from '../../components/coordination/expedition-nav.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// COO-P13 — ECR-EXP-01 « Scan et colisage » (RG-COO-263 à 267, 270). Le premier scan d'une unité ouvre un colis ;
// « Clore le colis » = « Expédier » (RG-COO-268) ; un colis clos ne se rouvre pas (RG-COO-266). La création des UM
// reste bloquée (Q-265) : seules les UM existantes sont scannées. Étiquette Geodis, boucle et canal : étape 8
// (Q-284, ECARTS).

const SearchSchema = z.object({
  dossier: z.coerce.number().int().positive().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  destinataire: z.string().optional(),
})

export const Route = createFileRoute('/expedition/')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('colis.gerer'),
  component: ScanEtColisage,
})

type Unite = AColiser['groupes'][number]['unites'][number]
const libelleUnite = (u: Unite) => (u.type === 'UM' ? u.code : u.trainId)

function ScanEtColisage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(search) as [string, string | number | undefined][])
    if (v !== undefined && v !== '') qs.set(k, String(v))
  const { etat, recharger } = useApi(`a-coliser-${qs.toString()}`, (signal) =>
    apiRequest('GET', `/api/coordination/colis/a-coliser?${qs.toString()}`, {
      schema: AColiserSchema,
      signal,
    }),
  )
  const [filtres, setFiltres] = useState({
    dossier: search.dossier?.toString() ?? '',
    depart: search.depart ?? '',
    destinataire: search.destinataire ?? '',
  })
  const [scan, setScan] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)

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

  async function agir(action: () => Promise<string>) {
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      setMessage(await action())
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
      recharger()
    }
  }

  const d = etat.kind === 'ready' ? etat.data : null

  /** Colis ouvert du même destinataire et du même atelier, sinon un nouveau (le premier scan ouvre un colis). */
  async function colisPour(g: AColiser['groupes'][number]): Promise<ColisLigne | FicheColis> {
    const ouvert = d?.colisOuverts.find(
      (c) => c.destinataire.id === g.destinataire.id && c.atelier.id === g.atelier.id,
    )
    if (ouvert) return ouvert
    const cree = await apiPost('/api/coordination/colis', {
      schema: ResultatColisSchema,
      body: { atelierId: g.atelier.id, destinataireId: g.destinataire.id },
    })
    if (!cree.colis) throw new Error('Colis non créé')
    return cree.colis
  }

  function scanner(g: AColiser['groupes'][number], u: Unite) {
    void agir(async () => {
      const colis = await colisPour(g)
      const r = await apiPost(
        u.type === 'UM'
          ? `/api/coordination/colis/${String(colis.id)}/unites`
          : `/api/coordination/colis/${String(colis.id)}/trains`,
        {
          schema: ResultatColisSchema,
          body:
            u.type === 'UM'
              ? { version: colis.version, code: u.code }
              : { version: colis.version, trainId: u.trainId },
        },
      )
      return r.message
    })
  }

  function envoyerScan(e: SyntheticEvent) {
    e.preventDefault()
    const code = scan.trim()
    if (!code || !d) return
    const trouve = d.groupes
      .flatMap((g) => g.unites.map((u) => ({ g, u })))
      .find(({ u }) => libelleUnite(u).toLowerCase() === code.toLowerCase())
    setScan('')
    if (!trouve) {
      setErreur(null)
      setMessage(`Code inconnu : ${code}`)
      return
    }
    scanner(trouve.g, trouve.u)
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Expédition</p>
      <h1 className="text-2xl font-semibold">Expédition · Scan et colisage</h1>
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
        <IndicateurExpedition
          titre="Produites à coliser"
          valeur={d?.indicateurs.aColiser ?? null}
        />
        <IndicateurExpedition titre="Colis clos à expédier" valeur={d?.indicateurs.clos ?? null} />
        <IndicateurExpedition titre="Expédiées" valeur={d?.indicateurs.expedies ?? null} />
        <IndicateurExpedition
          titre="Livrées (preuve reçue)"
          valeur={d?.indicateurs.livres ?? null}
        />
      </section>
      <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
        La preuve de livraison Geodis, l’étiquette de colis et la boucle ne sont pas branchées
        (module Expédition, étape 8) : « Livrées » n’est pas calculable.
      </p>
      <form className="mt-4 flex items-center gap-2" onSubmit={envoyerScan} aria-label="Douchette">
        <label className="text-sm">
          ⌁ Douchette : code de l’unité ou du train
          <input
            className="ml-2 w-64 rounded-md border border-slate-300 px-2 py-1"
            value={scan}
            onChange={(e) => {
              setScan(e.target.value)
            }}
            disabled={envoi || !d}
          />
        </label>
        <Button type="submit" disabled={envoi || !d || scan.trim() === ''}>
          Scanner
        </Button>
      </form>
      {message && (
        <p role="status" className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      {etat.kind === 'loading' && <p className="mt-4">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {d && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <section
            className="rounded-lg border border-slate-200 p-3"
            aria-label="Unités produites à coliser"
          >
            <h2 className="font-semibold">Unités produites à coliser</h2>
            {d.groupes.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                Aucune unité produite en attente de colisage.
              </p>
            ) : (
              d.groupes.map((g) => (
                <div
                  key={`${String(g.destinataire.id)}-${String(g.atelier.id)}`}
                  className="mt-3"
                  role="group"
                  aria-label={`À coliser pour ${g.destinataire.nom}`}
                >
                  <p className="font-medium">
                    {g.destinataire.nom}{' '}
                    <span className="text-xs text-slate-500">
                      · départ {g.depart ?? '—'} · {g.unites.length} unité(s)
                    </span>
                  </p>
                  <ul className="mt-1 text-sm">
                    {g.unites.map((u) => (
                      <li key={libelleUnite(u)} className="flex items-center gap-2 border-b py-1">
                        <code>{libelleUnite(u)}</code>
                        <span className="text-slate-600">
                          {u.theme ?? '—'} ·{' '}
                          {u.type === 'UM'
                            ? `${String(u.quantite)} aff.`
                            : `${String(u.faces)} face(s)`}
                        </span>
                        <button
                          type="button"
                          className="ml-auto underline"
                          disabled={envoi}
                          onClick={() => {
                            scanner(g, u)
                          }}
                          aria-label={`Scanner ${libelleUnite(u)}`}
                        >
                          Scanner
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
          <section className="rounded-lg border border-slate-200 p-3" aria-label="Colis en cours">
            <h2 className="font-semibold">Colis en cours</h2>
            {d.colisOuverts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                Aucun colis ouvert. Le premier scan d’unité ouvre un colis.
              </p>
            ) : (
              d.colisOuverts.map((c) => (
                <CarteColis key={c.id} colis={c} envoi={envoi} agir={agir} />
              ))
            )}
          </section>
        </div>
      )}
    </main>
  )
}

function CarteColis({
  colis,
  envoi,
  agir,
}: {
  colis: ColisLigne
  envoi: boolean
  agir: (action: () => Promise<string>) => Promise<void>
}) {
  const { etat } = useApi(`colis-${String(colis.id)}-${String(colis.version)}`, (signal) =>
    apiRequest('GET', `/api/coordination/colis/${String(colis.id)}`, {
      schema: FicheColisSchema,
      signal,
    }),
  )
  const [coche, setCoche] = useState<Set<string>>(new Set())
  const fiche = etat.kind === 'ready' ? etat.data : null

  function retirer(tout: boolean) {
    if (!fiche) return
    const unites = [...coche].filter((x) => x.startsWith('U')).map((x) => Number(x.slice(1)))
    const trains = [...coche].filter((x) => x.startsWith('T')).map((x) => x.slice(1))
    if (!tout && unites.length === 0 && trains.length === 0) {
      void agir(() => Promise.resolve('Cochez les unités à retirer du colis.'))
      return
    }
    void agir(async () => {
      const r = await apiPost(`/api/coordination/colis/${String(colis.id)}/retirer`, {
        schema: ResultatColisSchema,
        body: { version: fiche.version, unites, trains, tout },
      })
      setCoche(new Set())
      return r.message
    })
  }

  function clore() {
    if (!fiche) return
    void agir(async () => {
      const r = await apiPost(`/api/coordination/colis/${String(colis.id)}/expedier`, {
        schema: ResultatColisSchema,
        body: { version: fiche.version },
      })
      return r.message
    })
  }

  return (
    <article
      className="mt-3 rounded-md border border-slate-200 p-2"
      aria-label={`Colis ${colis.code}`}
    >
      <p className="flex items-center gap-2 font-medium">
        <code>{colis.code}</code> · {colis.destinataire.nom}
        <Pastille ton="surveiller">Colis ouvert</Pastille>
        <span className="ml-auto text-xs text-slate-500">
          {colis.nbUnites} UM · {colis.nbTrains} train(s) · {colis.poids ?? '—'} kg
        </span>
      </p>
      {etat.kind === 'loading' && <p className="text-sm">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} />}
      {fiche && (
        <ul className="mt-1 text-sm">
          {fiche.unites.map((u) => (
            <li key={`U${String(u.uniteId)}`} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`Retirer ${u.code}`}
                checked={coche.has(`U${String(u.uniteId)}`)}
                onChange={(e) => {
                  const m = new Set(coche)
                  if (e.target.checked) m.add(`U${String(u.uniteId)}`)
                  else m.delete(`U${String(u.uniteId)}`)
                  setCoche(m)
                }}
              />
              <code>{u.code}</code> {u.theme ?? '—'} · {u.quantite} / {u.quantiteTotale ?? '—'}
            </li>
          ))}
          {fiche.trains.map((t) => (
            <li key={`T${t.trainId}`} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`Retirer ${t.trainId}`}
                checked={coche.has(`T${t.trainId}`)}
                onChange={(e) => {
                  const m = new Set(coche)
                  if (e.target.checked) m.add(`T${t.trainId}`)
                  else m.delete(`T${t.trainId}`)
                  setCoche(m)
                }}
              />
              <code>{t.trainId}</code> {t.faces} face(s)
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <Button type="button" disabled={envoi || !fiche} onClick={clore}>
          Clore le colis
        </Button>
        <Button
          type="button"
          disabled={envoi || !fiche}
          onClick={() => {
            retirer(false)
          }}
        >
          Retirer la sélection
        </Button>
        <Button
          type="button"
          disabled={envoi || !fiche}
          onClick={() => {
            retirer(true)
          }}
        >
          Tout retirer
        </Button>
      </div>
    </article>
  )
}
