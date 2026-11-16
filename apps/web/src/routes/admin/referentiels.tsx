import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AgentsReceptionAdminSchema,
  ReferentielLigneSchema,
  type ReferentielLigne,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// Étape 8 (D-04) — ECR-ADM-07 « Référentiels » (volet réception) : trois cartes, Imprimeurs, Livreurs (transporteurs
// à la réception) et Agents de réception (contrôleurs). Ajout d'une valeur LIBRE (la maquette crée une valeur
// factice « Nouvel imprimeur n » : remplacé par la saisie réelle, question de la maquette), désactivation et
// réactivation, jamais de suppression ni de renommage (maquette, RG-REC-179). Les agents sont les utilisateurs au rôle
// Réception : lecture seule, gérés dans « Utilisateurs » (Q-177 (1), Q-407). Les destinataires et les rouleurs
// restent sur leurs écrans de Coordination.

export const Route = createFileRoute('/admin/referentiels')({
  beforeLoad: requirePermission('referentiel.gerer'),
  component: Referentiels,
})

function Referentiels() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="text-sm text-slate-500">Administration › Paramétrage › Référentiels</p>
      <h1 className="text-2xl font-semibold">Référentiels de réception</h1>
      <p className="mt-3 text-sm text-slate-600">
        Listes proposées à la saisie d’une réception. Une valeur désactivée n’est plus proposée mais
        reste visible sur les réceptions existantes ; rien n’est jamais supprimé.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <CarteReferentiel
          ref_="imprimeurs"
          titre="Imprimeurs"
          singulier="un imprimeur"
          libelleChamp="Nouvel imprimeur"
        />
        <CarteReferentiel
          ref_="livreurs"
          titre="Livreurs"
          singulier="un livreur"
          libelleChamp="Nouveau livreur"
        />
        <CarteAgents />
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Destinataires et afficheurs :{' '}
        <Link to="/coordination/destinataires" className="underline">
          Coordination › Destinataires
        </Link>
        . Rouleurs :{' '}
        <Link to="/coordination/rouleurs" className="underline">
          Coordination › Rouleurs
        </Link>
        .
      </p>
    </main>
  )
}

function CarteReferentiel({
  ref_,
  titre,
  singulier,
  libelleChamp,
}: {
  ref_: 'imprimeurs' | 'livreurs'
  titre: string
  singulier: string
  libelleChamp: string
}) {
  const { etat, recharger } = useApi(`admin-ref-${ref_}`, (signal) =>
    apiRequest('GET', `/api/referentiels/${ref_}`, {
      schema: ReferentielLigneSchema.array(),
      signal,
    }),
  )
  const [libelle, setLibelle] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)

  async function ajouter(e: SyntheticEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      const l = await apiPost(`/api/referentiels/${ref_}`, {
        schema: ReferentielLigneSchema,
        body: { libelle },
      })
      setLibelle('')
      setMessage(`« ${l.libelle} » ajouté.`)
      recharger()
    } catch (err) {
      setErreur(err)
    } finally {
      setEnvoi(false)
    }
  }
  async function changer(l: ReferentielLigne, actif: boolean) {
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      await apiRequest('PATCH', `/api/referentiels/${ref_}/${String(l.id)}`, {
        schema: ReferentielLigneSchema,
        body: { actif, version: l.version },
      })
      setMessage(actif ? `« ${l.libelle} » réactivé.` : `« ${l.libelle} » désactivé.`)
      recharger()
    } catch (err) {
      setErreur(err)
      recharger()
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <section className="rounded-md border border-slate-200 p-3 text-sm" aria-label={titre}>
      <h2 className="font-semibold">{titre}</h2>
      {etat.kind === 'loading' && <p className="mt-2">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' &&
        (etat.data.length === 0 ? (
          <p className="mt-2 text-slate-600">Aucune valeur.</p>
        ) : (
          <ul className="mt-2 space-y-1" aria-label={`Liste ${titre}`}>
            {etat.data.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span className={l.actif ? '' : 'text-slate-500 line-through'}>{l.libelle}</span>
                <span className="flex items-center gap-2">
                  {!l.actif && <Pastille ton="neutre">Désactivé</Pastille>}
                  <button
                    type="button"
                    className="underline"
                    disabled={envoi}
                    aria-label={`${l.actif ? 'Désactiver' : 'Réactiver'} ${l.libelle}`}
                    onClick={() => {
                      void changer(l, !l.actif)
                    }}
                  >
                    {l.actif ? 'Désactiver' : 'Réactiver'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ))}
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        aria-label={`Ajouter ${singulier}`}
        onSubmit={(e) => {
          void ajouter(e)
        }}
      >
        <label>
          {libelleChamp}
          <input
            className="ml-1 w-40 rounded-md border border-slate-300 px-2 py-1"
            value={libelle}
            maxLength={150}
            onChange={(e) => {
              setLibelle(e.target.value)
            }}
          />
        </label>
        <Button type="submit" disabled={envoi || !libelle.trim()}>
          + Ajouter {singulier}
        </Button>
      </form>
      {message && (
        <p role="status" className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2">
          {message}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
    </section>
  )
}

function CarteAgents() {
  const { etat, recharger } = useApi('admin-ref-agents', (signal) =>
    apiRequest('GET', '/api/admin/referentiels/agents', {
      schema: AgentsReceptionAdminSchema,
      signal,
    }),
  )
  return (
    <section
      className="rounded-md border border-slate-200 p-3 text-sm"
      aria-label="Agents de réception"
    >
      <h2 className="font-semibold">Agents de réception (contrôleurs)</h2>
      <p className="mt-1 text-xs text-slate-600">
        Utilisateurs au rôle Réception, gérés dans{' '}
        <Link to="/admin/utilisateurs" className="underline">
          Utilisateurs
        </Link>
        .
      </p>
      {etat.kind === 'loading' && <p className="mt-2">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' &&
        (etat.data.agents.length === 0 ? (
          <p className="mt-2 text-slate-600">Aucun agent de réception.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-1" aria-label="Liste Agents de réception">
              {etat.data.agents.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className={a.actif ? '' : 'text-slate-500 line-through'}>
                    {a.nom ?? a.identifiantExterne}
                    {a.plateformes.length > 0 ? ` · ${a.plateformes.join(', ')}` : ''}
                  </span>
                  {!a.actif && <Pastille ton="neutre">Désactivé</Pastille>}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-500">
              {etat.data.agents.length} affiché(s) sur {etat.data.total}.
            </p>
          </>
        ))}
    </section>
  )
}
