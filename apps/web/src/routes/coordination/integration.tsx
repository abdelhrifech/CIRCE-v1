import { createFileRoute } from '@tanstack/react-router'
import {
  PassageIntegrationSchema,
  PassagesIntegrationSchema,
  RafraichirDossierResultatSchema,
  type FluxIntegration,
} from '@circe/shared'
import { useState } from 'react'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// Suivi des chargements Broadcast (RG-COO-116 : erreur d'un flux visible à l'écran ; RG-COO-103 : horaires et
// passage manuel ; RG-COO-132 : « Rafraîchir un dossier »). Aucune maquette dédiée : écran minimal (HYPOTHÈSE
// Q-188 (8)), entrée « Rafraîchir un dossier » du menu Administration de la maquette.

export const Route = createFileRoute('/coordination/integration')({
  beforeLoad: requirePermission('alimentation.manuelle'),
  component: SuiviChargements,
})

const FLUX: Record<FluxIntegration, string> = {
  ETAT_RESERVATIONS: 'État des réservations',
  DESTINATAIRES: 'Destinataires',
  PREPARATIONS: 'Préparations fixe / pliage',
  TRAINS: 'Trains d’affiches',
  INSTRUCTIONS: 'Instructions et annulations',
  RETOUR_BROADCAST: 'Retour vers Broadcast',
}
const STATUT_FLUX: Record<number, { libelle: string; ton: 'info' | 'ok' | 'critique' }> = {
  1: { libelle: 'En cours', ton: 'info' },
  0: { libelle: 'Succès', ton: 'ok' },
  2: { libelle: 'Échec', ton: 'critique' },
}
const STATUT_PASSAGE = {
  EN_COURS: { libelle: 'En cours', ton: 'info' },
  SUCCES: { libelle: 'Succès', ton: 'ok' },
  ECHEC: { libelle: 'Échec', ton: 'critique' },
} as const
const DECLENCHEUR = { PLANIFIE: 'Planifié', MANUEL: 'Manuel', LOT: 'Lot déposé' } as const
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR') : '—')

function SuiviChargements() {
  const { etat, recharger } = useApi('integration-passages', (signal) =>
    apiRequest('GET', '/api/coordination/integration/passages', {
      schema: PassagesIntegrationSchema,
      signal,
    }),
  )
  const { etat: moi } = useApi('moi', () => getMe())
  // RG-COO-103 : passage manuel réservé à l'administrateur (Q-189) ; confort d'affichage, le serveur décide.
  const peutLancer = moi.kind === 'ready' && can(moi.data, 'integration.passage_manuel')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [dossier, setDossier] = useState('')

  async function lancer() {
    setEnvoi(true)
    setErreur(null)
    setInfo(null)
    try {
      const p = await apiPost('/api/coordination/integration/passages', {
        schema: PassageIntegrationSchema,
        body: {},
      })
      setInfo(
        p.statut === 'SUCCES'
          ? 'Passage terminé.'
          : `Passage en échec : ${p.message ?? 'voir le journal'}`,
      )
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  async function rafraichir() {
    setErreur(null)
    setInfo(null)
    if (!/^\d+$/.test(dossier.trim())) {
      setInfo('Saisissez un n° de dossier (chiffres uniquement).')
      return
    }
    setEnvoi(true)
    try {
      const r = await apiPost('/api/coordination/integration/rafraichir-dossier', {
        schema: RafraichirDossierResultatSchema,
        body: { contNum: Number(dossier.trim()) },
      })
      setInfo(r.message)
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="text-sm text-slate-500">Coordination › Administration</p>
      <h1 className="text-2xl font-semibold">Chargements Broadcast</h1>
      {etat.kind === 'ready' && (
        <p className="mt-1 text-sm text-slate-600">
          Passages planifiés : {etat.data.horaires.join(', ') || 'aucun'} —{' '}
          {etat.data.planificateurActif
            ? 'planificateur actif.'
            : 'planificateur inactif : la liaison avec Broadcast n’est pas configurée.'}{' '}
          Messages vers Broadcast en attente : {etat.data.envoisEnAttente}.
        </p>
      )}
      <section className="mt-4 flex flex-wrap items-end gap-3" aria-label="Actions">
        <Button
          onClick={() => {
            void lancer()
          }}
          disabled={envoi || !peutLancer}
          title={peutLancer ? undefined : 'Réservé à l’administrateur'}
        >
          Lancer un passage
        </Button>
        {moi.kind === 'ready' && !peutLancer && (
          <span className="text-xs text-slate-500">
            Passage manuel réservé à l’administrateur (RG-COO-103).
          </span>
        )}
        <label className="text-sm">
          N° de dossier
          <input
            className="ml-1 w-32 rounded-md border border-slate-300 px-2 py-1"
            value={dossier}
            onChange={(e) => {
              setDossier(e.target.value)
            }}
          />
        </label>
        <Button
          onClick={() => {
            void rafraichir()
          }}
          disabled={envoi}
        >
          Rafraîchir un dossier
        </Button>
      </section>
      {info && (
        <p role="status" className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {info}
        </p>
      )}
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}
      <section className="mt-6">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' && etat.data.passages.length === 0 && (
          <p className="text-sm text-slate-600">Aucun passage d’intégration.</p>
        )}
        {etat.kind === 'ready' && etat.data.passages.length > 0 && (
          <table className="w-full text-sm" aria-label="Passages d’intégration">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-1">Début</th>
                <th>Déclencheur</th>
                <th>Statut</th>
                <th>Flux</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {etat.data.passages.map((p) => (
                <tr key={p.id} className="border-b align-top">
                  <td className="py-1">{date(p.debut)}</td>
                  <td>
                    {DECLENCHEUR[p.declencheur]}
                    {p.par ? ` (${p.par})` : ''}
                  </td>
                  <td>
                    <Pastille ton={STATUT_PASSAGE[p.statut].ton}>
                      {STATUT_PASSAGE[p.statut].libelle}
                    </Pastille>
                  </td>
                  <td>
                    <ul>
                      {p.flux.map((f) => (
                        <li key={f.id}>
                          {FLUX[f.flux]} :{' '}
                          <Pastille ton={STATUT_FLUX[f.statut]?.ton ?? 'info'}>
                            {STATUT_FLUX[f.statut]?.libelle ?? String(f.statut)}
                          </Pastille>{' '}
                          {f.lues} lue(s), {f.creees} créée(s), {f.misesAJour} mise(s) à jour,{' '}
                          {f.ignorees} ignorée(s)
                          {f.erreurs > 0 ? `, ${String(f.erreurs)} en erreur` : ''}
                          {f.message ? ` — ${f.message}` : ''}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>{p.message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
