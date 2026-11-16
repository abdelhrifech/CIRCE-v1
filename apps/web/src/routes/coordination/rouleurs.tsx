import { createFileRoute } from '@tanstack/react-router'
import {
  AteliersPerimetreSchema,
  RouleurLigneSchema,
  RouleursReferentielSchema,
  type RouleurLigne,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// COO-P11 — Référentiel des rouleurs (RG-COO-297, ECR-ADM-07) : opérateurs rattachés à un atelier (donc à un site) et à
// un poste, distincts des utilisateurs. Désactivation plutôt que suppression d'un rouleur référencé (409).

export const Route = createFileRoute('/coordination/rouleurs')({
  beforeLoad: requirePermission('referentiel.gerer'),
  component: Rouleurs,
})

function Rouleurs() {
  const { etat, recharger } = useApi('rouleurs-referentiel', (signal) =>
    apiRequest('GET', '/api/coordination/rouleurs', { schema: RouleursReferentielSchema, signal }),
  )
  const ateliers = useApi('rouleurs-ateliers', (signal) =>
    apiRequest('GET', '/api/coordination/ateliers', { schema: AteliersPerimetreSchema, signal }),
  )
  const [nom, setNom] = useState('')
  const [poste, setPoste] = useState('')
  const [atelierId, setAtelierId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)
  const [edition, setEdition] = useState<RouleurLigne | null>(null)

  async function executer(fn: () => Promise<string>) {
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      setMessage(await fn())
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  function creer(e: SyntheticEvent) {
    e.preventDefault()
    void executer(async () => {
      const r = await apiPost('/api/coordination/rouleurs', {
        schema: RouleurLigneSchema,
        body: { nom, atelierId: Number(atelierId), ...(poste.trim() ? { poste } : {}) },
        idempotencyKey: true,
      })
      setNom('')
      setPoste('')
      return `Rouleur « ${r.nom} » créé.`
    })
  }
  const changerEtat = (r: RouleurLigne, actif: boolean) =>
    executer(async () => {
      await apiRequest('PATCH', `/api/coordination/rouleurs/${String(r.id)}`, {
        schema: RouleurLigneSchema,
        body: { version: r.version, actif },
      })
      return actif ? `Rouleur « ${r.nom} » réactivé.` : `Rouleur « ${r.nom} » désactivé.`
    })
  const supprimer = (r: RouleurLigne) =>
    executer(async () => {
      await apiRequest('DELETE', `/api/coordination/rouleurs/${String(r.id)}`, {
        schema: z.null(),
      })
      return `Rouleur « ${r.nom} » supprimé.`
    })

  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="text-sm text-slate-500">Administration › Référentiels</p>
      <h1 className="text-2xl font-semibold">Rouleurs</h1>
      <p className="mt-1 text-sm text-slate-600">
        Les rouleurs sont des opérateurs d’un atelier (« Rouleur N1 », poste « Table 1 »), distincts
        des utilisateurs. Un rouleur déjà utilisé se désactive : il ne se supprime pas.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
        onSubmit={creer}
        aria-label="Nouveau rouleur"
      >
        <label>
          Nom
          <input
            className="ml-1 w-40 rounded-md border border-slate-300 px-2 py-1"
            value={nom}
            maxLength={100}
            onChange={(e) => {
              setNom(e.target.value)
            }}
          />
        </label>
        <label>
          Poste
          <input
            className="ml-1 w-28 rounded-md border border-slate-300 px-2 py-1"
            value={poste}
            maxLength={50}
            onChange={(e) => {
              setPoste(e.target.value)
            }}
          />
        </label>
        <label>
          Atelier
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={atelierId}
            onChange={(e) => {
              setAtelierId(e.target.value)
            }}
          >
            <option value="">Choisir…</option>
            {(ateliers.etat.kind === 'ready' ? ateliers.etat.data.ateliers : []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.plateforme} · {a.libelle}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={envoi || !nom.trim() || !atelierId}>
          Ajouter
        </Button>
      </form>
      {message && (
        <p role="status" className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      <section className="mt-4" aria-label="Rouleurs">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' &&
          (etat.data.rouleurs.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun rouleur enregistré.</p>
          ) : (
            <table className="w-full text-sm" aria-label="Liste des rouleurs">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th>Rouleur</th>
                  <th>Poste</th>
                  <th>Atelier</th>
                  <th>État</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {etat.data.rouleurs.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-1">{r.nom}</td>
                    <td>{r.poste ?? '—'}</td>
                    <td>{r.atelier ? `${r.atelier.plateforme} · ${r.atelier.libelle}` : '—'}</td>
                    <td>
                      <Pastille ton={r.actif ? 'ok' : 'neutre'}>
                        {r.actif ? 'Actif' : 'Désactivé'}
                      </Pastille>
                      {r.utilise && <span className="ml-1 text-xs text-slate-500">utilisé</span>}
                    </td>
                    <td className="space-x-2">
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          setEdition(r)
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="underline"
                        disabled={envoi}
                        onClick={() => {
                          void changerEtat(r, !r.actif)
                        }}
                      >
                        {r.actif ? 'Désactiver' : 'Réactiver'}
                      </button>
                      <button
                        type="button"
                        className="underline"
                        disabled={envoi}
                        onClick={() => {
                          void supprimer(r)
                        }}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </section>
      {edition && (
        <ModaleModifier
          rouleur={edition}
          onFermer={(msg) => {
            setEdition(null)
            if (msg) {
              setMessage(msg)
              recharger()
            }
          }}
        />
      )}
    </main>
  )
}

function ModaleModifier({
  rouleur,
  onFermer,
}: {
  rouleur: RouleurLigne
  onFermer: (message: string | null) => void
}) {
  const [nom, setNom] = useState(rouleur.nom)
  const [poste, setPoste] = useState(rouleur.poste ?? '')
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)
  async function enregistrer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiRequest('PATCH', `/api/coordination/rouleurs/${String(rouleur.id)}`, {
        schema: RouleurLigneSchema,
        body: { version: rouleur.version, nom, poste: poste.trim() ? poste : null },
      })
      onFermer(`Rouleur « ${nom} » modifié.`)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={`Modifier ${rouleur.nom}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <label className="block text-sm">
        Nom
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={nom}
          onChange={(e) => {
            setNom(e.target.value)
          }}
        />
      </label>
      <label className="mt-2 block text-sm">
        Poste
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={poste}
          onChange={(e) => {
            setPoste(e.target.value)
          }}
        />
      </label>
      {erreur !== null && <ErrorMessage error={erreur} />}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          onClick={() => {
            onFermer(null)
          }}
        >
          Annuler
        </Button>
        <Button
          type="button"
          disabled={envoi || !nom.trim()}
          onClick={() => {
            void enregistrer()
          }}
        >
          Enregistrer
        </Button>
      </div>
    </Modale>
  )
}
