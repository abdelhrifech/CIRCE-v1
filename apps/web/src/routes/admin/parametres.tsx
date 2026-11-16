import { createFileRoute } from '@tanstack/react-router'
import {
  HistoriqueParametreSchema,
  ParametreAdminSchema,
  ParametresAdminSchema,
  type ParametreAdmin,
} from '@circe/shared'
import { useState } from 'react'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// Étape 8 (D-06) — ECR-ADM-05 « Règles métier » : tous les paramètres lus par la Réception et la Coordination, par
// groupe ; valeur courante, valeur initiale (issue des règles), format et source. Modification validée par le serveur
// (bornes, ateliers et types existants), verrou de version, historique. Les valeurs structurées (routages, horaires)
// sont en lecture seule. Aucune valeur n'est supposée : les listes d'identifiants legacy restent vides tant qu'elles
// ne sont pas saisies (Q-319). Hypothèses : Q-405.

export const Route = createFileRoute('/admin/parametres')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Parametres,
})

function Parametres() {
  const { etat, recharger } = useApi('admin-parametres', (signal) =>
    apiRequest('GET', '/api/admin/parametres', { schema: ParametresAdminSchema, signal }),
  )
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [historique, setHistorique] = useState<ParametreAdmin | null>(null)

  const groupes =
    etat.kind === 'ready'
      ? [...new Set(etat.data.parametres.map((p) => p.groupe))].map((g) => ({
          groupe: g,
          lignes: etat.data.parametres.filter((p) => p.groupe === g),
        }))
      : []

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="text-sm text-slate-500">Administration › Paramétrage</p>
      <h1 className="text-2xl font-semibold">Règles métier</h1>
      <p className="mt-3 text-sm text-slate-600">
        Un changement s’applique aux prochains traitements. Chaque modification est journalisée.
      </p>
      {message && (
        <p role="status" className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      <section className="mt-4" aria-label="Paramètres">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' && groupes.length === 0 && (
          <p className="text-sm text-slate-600">Aucun paramètre.</p>
        )}
        {groupes.map(({ groupe, lignes }) => (
          <div key={groupe} className="mb-6">
            <h2 className="text-lg font-semibold">{groupe}</h2>
            <table className="mt-2 w-full text-sm" aria-label={`Paramètres ${groupe}`}>
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th>Paramètre</th>
                  <th>Valeur</th>
                  <th>Valeur initiale</th>
                  <th>Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((p) => (
                  <LigneParametre
                    key={`${p.cle}-${String(p.version)}`}
                    parametre={p}
                    onEnregistre={(msg) => {
                      setErreur(null)
                      setMessage(msg)
                      recharger()
                    }}
                    onErreur={(e) => {
                      setMessage(null)
                      setErreur(e)
                    }}
                    onHistorique={() => {
                      setHistorique(p)
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
      {historique && (
        <ModaleHistorique
          parametre={historique}
          onFermer={() => {
            setHistorique(null)
          }}
        />
      )}
    </main>
  )
}

function aide(p: ParametreAdmin): string {
  const f = p.format
  if (f.type === 'entier' || f.type === 'decimal')
    return `${String(f.min)} à ${String(f.max)}${f.unite ? ` ${f.unite}` : ''}`
  if (f.type === 'liste-ateliers')
    return 'Identifiants d’ateliers séparés par « ; » (voir Sites et ateliers)'
  if (f.type === 'liste-types-preparation')
    return 'Identifiants de types de préparation séparés par « ; »'
  if (f.type === 'horaires')
    return 'Horaires « HH:MM » séparés par « ; » (vide = traitement désactivé)'
  return ''
}

function LigneParametre({
  parametre,
  onEnregistre,
  onErreur,
  onHistorique,
}: {
  parametre: ParametreAdmin
  onEnregistre: (message: string) => void
  onErreur: (e: unknown) => void
  onHistorique: () => void
}) {
  const [valeur, setValeur] = useState(parametre.valeur)
  const [envoi, setEnvoi] = useState(false)
  async function enregistrer() {
    setEnvoi(true)
    try {
      await apiRequest('PUT', `/api/admin/parametres/${parametre.cle}`, {
        schema: ParametreAdminSchema,
        body: { valeur, version: parametre.version },
      })
      onEnregistre(
        `Paramètre « ${parametre.libelle} » enregistré (s’applique aux prochains traitements).`,
      )
    } catch (e) {
      onErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  const id = `param-${parametre.cle}`
  return (
    <tr className="border-b align-top">
      <td className="py-1">
        <label htmlFor={id}>{parametre.libelle}</label>
        <div className="text-xs text-slate-500">{parametre.cle}</div>
        {aide(parametre) && <div className="text-xs text-slate-500">{aide(parametre)}</div>}
      </td>
      <td>
        {!parametre.modifiable ? (
          <span title={parametre.format.raison}>
            <code className="break-all text-xs">{parametre.valeur || '—'}</code>
            <span className="ml-1 text-xs text-slate-500">lecture seule</span>
          </span>
        ) : parametre.format.type === 'enum' ? (
          <select
            id={id}
            className="rounded-md border border-slate-300 px-2 py-1"
            value={valeur}
            onChange={(e) => {
              setValeur(e.target.value)
            }}
          >
            {(parametre.format.valeurs ?? []).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            className="w-40 rounded-md border border-slate-300 px-2 py-1"
            value={valeur}
            onChange={(e) => {
              setValeur(e.target.value)
            }}
          />
        )}
      </td>
      <td>
        <code className="break-all text-xs">{parametre.valeurParDefaut || '—'}</code>
      </td>
      <td className="text-xs text-slate-600">{parametre.source}</td>
      <td className="space-x-2 whitespace-nowrap">
        {parametre.modifiable && (
          <Button
            type="button"
            disabled={envoi || valeur === parametre.valeur}
            aria-label={`Enregistrer ${parametre.libelle}`}
            onClick={() => {
              void enregistrer()
            }}
          >
            Enregistrer
          </Button>
        )}
        <button
          type="button"
          className="underline"
          aria-label={`Historique ${parametre.libelle}`}
          onClick={onHistorique}
        >
          Historique
        </button>
      </td>
    </tr>
  )
}

function ModaleHistorique({
  parametre,
  onFermer,
}: {
  parametre: ParametreAdmin
  onFermer: () => void
}) {
  const { etat, recharger } = useApi(`hist-${parametre.cle}`, (signal) =>
    apiRequest('GET', `/api/admin/parametres/${parametre.cle}/historique`, {
      schema: HistoriqueParametreSchema,
      signal,
    }),
  )
  return (
    <Modale
      titre={`Historique · ${parametre.libelle}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' &&
        (etat.data.historique.length === 0 ? (
          <p className="text-sm text-slate-600">Aucune modification enregistrée.</p>
        ) : (
          <table className="w-full text-sm" aria-label="Historique des modifications">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th>Date</th>
                <th>Par</th>
                <th>Ancienne valeur</th>
                <th>Nouvelle valeur</th>
              </tr>
            </thead>
            <tbody>
              {etat.data.historique.map((h) => (
                <tr key={`${h.le}-${h.nouvelleValeur ?? ''}`} className="border-b">
                  <td className="py-1">{new Date(h.le).toLocaleString('fr-FR')}</td>
                  <td>{h.par ?? '—'}</td>
                  <td>{h.ancienneValeur ?? '—'}</td>
                  <td>{h.nouvelleValeur ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </Modale>
  )
}
