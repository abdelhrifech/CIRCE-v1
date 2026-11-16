import { createFileRoute } from '@tanstack/react-router'
import {
  DestinataireLigneSchema,
  DestinatairesReferentielSchema,
  type DestinataireLigne,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// Étape 8 (D-05) — ECR-ADM-07 « Destinataires et afficheurs » : référentiel des destinataires (nom d'origine, libellé,
// dispatch O/N de RG-COO-260, mail, téléphone, adresse principale, transport par défaut en lecture). Désactivation
// plutôt que suppression ; le nom d'origine (clé d'intégration Broadcast) n'est pas modifiable. Hypothèses : Q-403.

export const Route = createFileRoute('/coordination/destinataires')({
  beforeLoad: requirePermission('referentiel.gerer'),
  component: Destinataires,
})

function Destinataires() {
  const [recherche, setRecherche] = useState('')
  const [q, setQ] = useState('')
  const { etat, recharger } = useApi(`destinataires-${q}`, (signal) =>
    apiRequest('GET', `/api/coordination/destinataires${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      schema: DestinatairesReferentielSchema,
      signal,
    }),
  )
  const [nomOrigine, setNomOrigine] = useState('')
  const [dispatch, setDispatch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)
  const [edition, setEdition] = useState<DestinataireLigne | null>(null)

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
      const d = await apiPost('/api/coordination/destinataires', {
        schema: DestinataireLigneSchema,
        body: { nomOrigine, ...(dispatch ? { dispatch } : {}) },
      })
      setNomOrigine('')
      setDispatch('')
      return `Destinataire « ${d.nom} » créé.`
    })
  }
  const changerEtat = (d: DestinataireLigne, actif: boolean) =>
    executer(async () => {
      await apiRequest('PATCH', `/api/coordination/destinataires/${String(d.id)}`, {
        schema: DestinataireLigneSchema,
        body: { version: d.version, actif },
      })
      return actif ? `Destinataire « ${d.nom} » réactivé.` : `Destinataire « ${d.nom} » désactivé.`
    })

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="text-sm text-slate-500">Administration › Référentiels</p>
      <h1 className="text-2xl font-semibold">Destinataires et afficheurs</h1>
      <p className="mt-1 text-sm text-slate-600">
        Un destinataire est aussi l’afficheur de ses lignes de préparation. « Dispatch » O : un
        changement d’afficheur clôt l’UM au Colisage. Un destinataire déjà utilisé se désactive : il
        ne se supprime pas.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(recherche.trim())
        }}
        aria-label="Recherche"
      >
        <label>
          Rechercher
          <input
            className="ml-1 w-56 rounded-md border border-slate-300 px-2 py-1"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
            }}
          />
        </label>
        <Button type="submit">Filtrer</Button>
      </form>
      <form
        className="mt-3 flex flex-wrap items-end gap-3 text-sm"
        onSubmit={creer}
        aria-label="Nouveau destinataire"
      >
        <label>
          Nom d’origine
          <input
            className="ml-1 w-56 rounded-md border border-slate-300 px-2 py-1"
            value={nomOrigine}
            maxLength={100}
            onChange={(e) => {
              setNomOrigine(e.target.value)
            }}
          />
        </label>
        <label>
          Dispatch
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={dispatch}
            onChange={(e) => {
              setDispatch(e.target.value)
            }}
          >
            <option value="">Non précisé</option>
            <option value="O">O</option>
            <option value="N">N</option>
          </select>
        </label>
        <Button type="submit" disabled={envoi || !nomOrigine.trim()}>
          Ajouter
        </Button>
      </form>
      {message && (
        <p role="status" className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      <section className="mt-4" aria-label="Destinataires">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' &&
          (etat.data.destinataires.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun destinataire pour cette recherche.</p>
          ) : (
            <table className="w-full text-sm" aria-label="Liste des destinataires">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th>Destinataire</th>
                  <th>Nom d’origine</th>
                  <th>Dispatch</th>
                  <th>Contact</th>
                  <th>Adresse</th>
                  <th>Transport</th>
                  <th>État</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {etat.data.destinataires.map((d) => (
                  <tr key={d.id} className="border-b align-top">
                    <td className="py-1">{d.nom}</td>
                    <td>{d.nomOrigine}</td>
                    <td>{d.dispatch ?? '—'}</td>
                    <td>{[d.mail, d.telephone].filter(Boolean).join(' · ') || '—'}</td>
                    <td>
                      {d.adresse
                        ? [d.adresse.adresse1, d.adresse.codePostal, d.adresse.localite]
                            .filter(Boolean)
                            .join(' ') || '—'
                        : '—'}
                    </td>
                    <td>{d.nbTransports === 0 ? '—' : `${String(d.nbTransports)} atelier(s)`}</td>
                    <td>
                      <Pastille ton={d.actif ? 'ok' : 'neutre'}>
                        {d.actif ? 'Actif' : 'Désactivé'}
                      </Pastille>
                      {d.utilise && <span className="ml-1 text-xs text-slate-500">utilisé</span>}
                    </td>
                    <td className="space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          setEdition(d)
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="underline"
                        disabled={envoi}
                        onClick={() => {
                          void changerEtat(d, !d.actif)
                        }}
                      >
                        {d.actif ? 'Désactiver' : 'Réactiver'}
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
          destinataire={edition}
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
  destinataire,
  onFermer,
}: {
  destinataire: DestinataireLigne
  onFermer: (message: string | null) => void
}) {
  const [nom, setNom] = useState(destinataire.nom)
  const [dispatch, setDispatch] = useState(destinataire.dispatch ?? '')
  const [mail, setMail] = useState(destinataire.mail ?? '')
  const [telephone, setTelephone] = useState(destinataire.telephone ?? '')
  const [adresse1, setAdresse1] = useState(destinataire.adresse?.adresse1 ?? '')
  const [codePostal, setCodePostal] = useState(destinataire.adresse?.codePostal ?? '')
  const [localite, setLocalite] = useState(destinataire.adresse?.localite ?? '')
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)
  const vide = (v: string) => (v.trim() ? v.trim() : null)
  async function enregistrer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiRequest('PATCH', `/api/coordination/destinataires/${String(destinataire.id)}`, {
        schema: DestinataireLigneSchema,
        body: {
          version: destinataire.version,
          nom: vide(nom),
          dispatch: dispatch === 'O' || dispatch === 'N' ? dispatch : null,
          mail: vide(mail),
          telephone: vide(telephone),
          adresse: {
            adresse1: vide(adresse1),
            codePostal: vide(codePostal),
            localite: vide(localite),
          },
        },
      })
      onFermer(`Destinataire « ${nom} » modifié.`)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  const champ = (label: string, value: string, set: (v: string) => void) => (
    <label className="mt-2 block text-sm">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
        value={value}
        onChange={(e) => {
          set(e.target.value)
        }}
      />
    </label>
  )
  return (
    <Modale
      titre={`Modifier ${destinataire.nom}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      {champ('Libellé', nom, setNom)}
      <label className="mt-2 block text-sm">
        Dispatch
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={dispatch}
          onChange={(e) => {
            setDispatch(e.target.value)
          }}
        >
          <option value="">Non précisé</option>
          <option value="O">O</option>
          <option value="N">N</option>
        </select>
      </label>
      {champ('Mail', mail, setMail)}
      {champ('Téléphone', telephone, setTelephone)}
      {champ('Adresse', adresse1, setAdresse1)}
      {champ('Code postal', codePostal, setCodePostal)}
      {champ('Localité', localite, setLocalite)}
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
          disabled={envoi}
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
