import { createFileRoute } from '@tanstack/react-router'
import {
  CANAUX_ALERTE,
  LIBELLES_CANAUX,
  LIBELLES_DESTINATAIRES,
  ROLES,
  RegleAlerteAdminSchema,
  ReglesAlerteAdminSchema,
  type CanalAlerte,
  type RegleAlerteAdmin,
  type Role,
} from '@circe/shared'
import { useState } from 'react'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// Étape 8 (D-08) — ECR-ADM-04 « Alertes et mails » : « Règles d'alerte » (Alerte, Déclencheur, Seuil, Destinataires,
// Canal) pour les 18 types d'alerte calculés. Le canal et les destinataires sont modifiables ; le déclencheur et le
// seuil sont en lecture seule (le seuil est un paramètre métier : « Règles métier »). AUCUN mail n'est envoyé (Q-375) :
// les canaux « mail » et « digest » sont enregistrés sans effet ; « Désactivée » masque le type dans Pilotage ›
// Alertes. Les listes de distribution et les mails existants ne sont pas repris (ECARTS). Hypothèses : Q-408.

export const Route = createFileRoute('/admin/alertes')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Alertes,
})

function Alertes() {
  const { etat, recharger } = useApi('admin-alertes-regles', (signal) =>
    apiRequest('GET', '/api/admin/alertes/regles', { schema: ReglesAlerteAdminSchema, signal }),
  )
  const [edition, setEdition] = useState<RegleAlerteAdmin | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="text-sm text-slate-500">Administration › Paramétrage › Alertes et mails</p>
      <h1 className="text-2xl font-semibold">Alertes et mails</h1>
      <p className="mt-3 text-sm text-slate-600">
        Aucun mail n’est envoyé pour le moment : les canaux « mail » et « digest » sont enregistrés
        mais seul le bandeau d’alertes est actif. Le canal « Désactivée » retire le type d’alerte de
        Pilotage › Alertes. Les destinataires configurés remplacent ceux calculés par défaut.
      </p>
      {message && (
        <p role="status" className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      <section className="mt-4" aria-label="Règles d’alerte">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' &&
          (etat.data.regles.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun type d’alerte.</p>
          ) : (
            <table className="w-full text-sm" aria-label="Règles d’alerte">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th>Alerte</th>
                  <th>Déclencheur</th>
                  <th>Seuil</th>
                  <th>Destinataires</th>
                  <th>Canal</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {etat.data.regles.map((r) => (
                  <tr key={r.type} className="border-b align-top">
                    <td className="py-1">
                      {r.libelle}
                      {!r.calculee && (
                        <>
                          {' '}
                          <Pastille ton="neutre">non calculée</Pastille>
                        </>
                      )}
                    </td>
                    <td>{r.declencheur}</td>
                    <td>
                      {r.seuil ?? '—'}
                      {r.valeurSeuil !== null ? ` : ${r.valeurSeuil}` : ''}
                    </td>
                    <td>
                      {r.destinataires.length === 0
                        ? 'Par défaut'
                        : r.destinataires.map((d) => LIBELLES_DESTINATAIRES[d]).join(', ')}
                    </td>
                    <td>
                      <Pastille ton={r.canal === 'DESACTIVEE' ? 'neutre' : 'ok'}>
                        {LIBELLES_CANAUX[r.canal]}
                      </Pastille>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="underline"
                        aria-label={`Modifier ${r.libelle}`}
                        onClick={() => {
                          setMessage(null)
                          setEdition(r)
                        }}
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </section>
      {edition && (
        <ModaleRegle
          regle={edition}
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

function ModaleRegle({
  regle,
  onFermer,
}: {
  regle: RegleAlerteAdmin
  onFermer: (message: string | null) => void
}) {
  const [canal, setCanal] = useState<CanalAlerte>(regle.canal)
  const [destinataires, setDestinataires] = useState<Role[]>(regle.destinataires)
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)

  async function enregistrer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiRequest('PUT', `/api/admin/alertes/regles/${regle.type}`, {
        schema: RegleAlerteAdminSchema,
        body: { version: regle.version, canal, destinataires },
      })
      onFermer(`Règle « ${regle.libelle} » enregistrée.`)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={`Règle d’alerte : ${regle.libelle}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <p className="text-sm text-slate-600">{regle.declencheur}</p>
      <label className="mt-3 block text-sm">
        Canal
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={canal}
          onChange={(e) => {
            setCanal(e.target.value as CanalAlerte)
          }}
        >
          {CANAUX_ALERTE.map((c) => (
            <option key={c} value={c}>
              {LIBELLES_CANAUX[c]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="mt-3 text-sm">
        <legend>Destinataires (aucun coché : destinataires par défaut)</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={destinataires.includes(r)}
                onChange={(e) => {
                  setDestinataires(
                    e.target.checked ? [...destinataires, r] : destinataires.filter((x) => x !== r),
                  )
                }}
              />
              {LIBELLES_DESTINATAIRES[r]}
            </label>
          ))}
        </div>
      </fieldset>
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
