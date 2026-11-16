import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  DateJourSchema,
  DebloquerGroupeResultatSchema,
  ListeDeblocagesSchema,
  type ListeDeblocages,
  MOTIF_RENDRE_MAIN_DEFAUT,
  ResultatRechercheDeblocageSchema,
  type GroupeDeblocable,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { useApi, type EtatRequete } from '../../lib/use-api.ts'

// COO-P08 — Déblocage des préparations / « Rendre la main à la Pré-Prod » (RG-COO-140 à 152 ; Q-217, Q-382) et
// « Préparations débloquées » (RG-COO-149). Écran legacy d'Administration sans maquette cible (Q-217 :
// emplacement à valider) : reprise de la grille legacy (critères, colonnes, StatutPrepa) ; le bouton porte le
// libellé cible « Rendre la main à la Pré-Prod » et sa modale reprend ECR-COO-09b (motif, avertissement).

const SearchSchema = z.object({
  preparation: z.coerce.number().int().positive().optional(),
  dossier: z.coerce.number().int().positive().optional(),
  du: DateJourSchema.optional(),
  au: DateJourSchema.optional(),
})

export const Route = createFileRoute('/coordination/deblocage')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('deblocage.consulter'),
  component: Deblocage,
})

const STATUT_PREPA = {
  NONE: { libelle: 'Débloquable', ton: 'ok' },
  EN_COURS: { libelle: 'En cours', ton: 'surveiller' },
} as const
const sem = (s: { annee: number; semaine: number }) =>
  `S${String(s.semaine).padStart(2, '0')} ${String(s.annee)}`

function Deblocage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [preparation, setPreparation] = useState(search.preparation?.toString() ?? '')
  const [dossier, setDossier] = useState(search.dossier?.toString() ?? '')
  const [cible, setCible] = useState<GroupeDeblocable | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { etat: moi } = useApi('moi', () => getMe())
  const peutRendre = moi.kind === 'ready' && can(moi.data, 'deblocage.executer')

  const qs = new URLSearchParams()
  if (search.preparation) qs.set('preparation', String(search.preparation))
  if (search.dossier) qs.set('dossier', String(search.dossier))
  const { etat, recharger } = useApi(`deblocage-${qs.toString()}`, (signal) =>
    apiRequest('GET', `/api/coordination/deblocage/groupes?${qs.toString()}`, {
      schema: ResultatRechercheDeblocageSchema,
      signal,
    }),
  )
  const qsSuivi = new URLSearchParams()
  if (search.du) qsSuivi.set('du', search.du)
  if (search.au) qsSuivi.set('au', search.au)
  const suivi = useApi(`deblocage-suivi-${qsSuivi.toString()}`, (signal) =>
    apiRequest('GET', `/api/coordination/deblocage/suivi?${qsSuivi.toString()}`, {
      schema: ListeDeblocagesSchema,
      signal,
    }),
  )

  function rechercher(e: SyntheticEvent) {
    e.preventDefault()
    const num = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined)
    void navigate({
      search: (s) => ({ ...s, preparation: num(preparation), dossier: num(dossier) }),
    })
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Coordination › Administration</p>
      <h1 className="text-2xl font-semibold">Déblocage des préparations</h1>
      <p className="mt-1 text-sm text-slate-600">
        Rendre la main à la Pré-Prod annule dans Circé les lignes de préparation non lancées du
        groupe : Broadcast peut alors renvoyer la préparation. La validation admin et les affiches
        reçues ne changent pas.
      </p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={rechercher}>
        <label className="text-sm">
          N° de préparation
          <input
            className="ml-1 w-32 rounded-md border border-slate-300 px-2 py-1"
            inputMode="numeric"
            value={preparation}
            onChange={(e) => {
              setPreparation(e.target.value)
            }}
          />
        </label>
        <label className="text-sm">
          N° de dossier
          <input
            className="ml-1 w-32 rounded-md border border-slate-300 px-2 py-1"
            inputMode="numeric"
            value={dossier}
            onChange={(e) => {
              setDossier(e.target.value)
            }}
          />
        </label>
        <Button type="submit">Rechercher</Button>
      </form>
      {message && (
        <p role="status" className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      <section className="mt-4" aria-label="Groupes de préparation">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' && (
          <>
            {etat.data.avertissements.length > 0 && (
              <ul className="mb-2 text-xs text-amber-800" aria-label="Avertissements">
                {etat.data.avertissements.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            {etat.data.groupes.length === 0 ? (
              <p className="text-sm text-slate-600">{etat.data.message}</p>
            ) : (
              <table className="w-full text-sm" aria-label="Préparations débloquables">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-1">Prépa</th>
                    <th>Dossier</th>
                    <th>Groupe</th>
                    <th>Annonceur</th>
                    <th>Semaine</th>
                    <th>Format</th>
                    <th>Site</th>
                    <th>Type de préparation</th>
                    <th className="text-right">Quantité</th>
                    <th>Type</th>
                    <th>Statut</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {etat.data.groupes.map((g) => (
                    <tr key={g.cle} className="border-b align-top">
                      <td className="py-1">{g.idPreparationChapeau ?? '—'}</td>
                      <td>
                        {/* Un groupe Broadcast peut couvrir plusieurs dossiers × semaines : contrôle et
                            annulation portent sur le groupe entier (RG-COO-143, 278). */}
                        {[...new Set(g.tranches.map((t) => t.contNum))].join(', ')}
                      </td>
                      <td>{g.idGroupePreparation ?? '—'}</td>
                      <td>{g.annonceur ?? '—'}</td>
                      <td>
                        {g.tranches.length > 1
                          ? g.tranches
                              .map((t) => `${String(t.contNum)} ${sem(t.semaine)}`)
                              .join(' ; ')
                          : sem(g.semaine)}
                      </td>
                      <td>{g.surface ?? '—'}</td>
                      <td>{g.site ?? '—'}</td>
                      <td>{g.typePreparation ?? '—'}</td>
                      <td className="text-right">{g.quantite ?? '—'}</td>
                      <td>{g.type}</td>
                      <td>
                        {g.etat === 'DEBLOQUE' ? (
                          <Pastille ton="info">Main rendue</Pastille>
                        ) : g.statutPrepa ? (
                          <Pastille ton={STATUT_PREPA[g.statutPrepa].ton}>
                            {STATUT_PREPA[g.statutPrepa].libelle}
                          </Pastille>
                        ) : (
                          <Pastille ton="important">Contrôle impossible</Pastille>
                        )}
                        {g.motifBlocage && g.etat !== 'DEBLOQUE' && (
                          <p className="mt-1 text-xs text-red-700">{g.motifBlocage}</p>
                        )}
                      </td>
                      <td>
                        <Button
                          type="button"
                          disabled={!g.deblocable || !peutRendre}
                          title={
                            !peutRendre
                              ? 'Réservé à la Coordination et à l’administrateur'
                              : (g.motifBlocage ?? undefined)
                          }
                          onClick={() => {
                            setMessage(null)
                            setCible(g)
                          }}
                        >
                          Rendre la main
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
      {cible && (
        <ModaleRendreMain
          groupe={cible}
          onFermer={(msg) => {
            setCible(null)
            if (msg) {
              setMessage(msg)
              recharger()
              suivi.recharger()
            }
          }}
        />
      )}
      <SuiviDeblocages
        etat={suivi.etat}
        recharger={suivi.recharger}
        du={search.du}
        au={search.au}
        onPeriode={(du, au) => {
          void navigate({ search: (s) => ({ ...s, du: du || undefined, au: au || undefined }) })
        }}
      />
    </main>
  )
}

/** ECR-COO-09b (RG-COO-151 / 243) : motif (défaut de la maquette), avertissement, « Rendre la main ». */
function ModaleRendreMain({
  groupe,
  onFermer,
}: {
  groupe: GroupeDeblocable
  onFermer: (message: string | null) => void
}) {
  const [motif, setMotif] = useState(MOTIF_RENDRE_MAIN_DEFAUT)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  async function valider() {
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost('/api/coordination/deblocage/groupes', {
        schema: DebloquerGroupeResultatSchema,
        body: { cle: groupe.cle, motif },
      })
      onFermer(r.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre="Rendre la main à la Pré-Prod"
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <p className="text-sm">
        {groupe.tranches.length > 1 ? 'Groupe de préparation' : 'Dossier'}{' '}
        {groupe.tranches.map((t) => `${String(t.contNum)} (${sem(t.semaine)})`).join(', ')} ·{' '}
        {groupe.annonceur ?? '—'} · {groupe.typePreparation ?? groupe.type}
      </p>
      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm" role="note">
        {groupe.repartitionsActives > 0
          ? `${String(groupe.repartitionsActives)} ligne(s) de préparation non lancée(s) seront annulées dans Circé.`
          : 'Aucune ligne de préparation dans Circé : seule la demande à Broadcast est tracée.'}{' '}
        Les unités déjà en production ne sont jamais retirées (point de non-retour).
      </p>
      <label className="mt-3 block text-sm">
        Motif
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={motif}
          maxLength={500}
          onChange={(e) => {
            setMotif(e.target.value)
          }}
        />
      </label>
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}
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
            void valider()
          }}
        >
          Rendre la main
        </Button>
      </div>
    </Modale>
  )
}

/** RG-COO-149 : « Préparations débloquées » (période, défaut = le dernier mois). */
function SuiviDeblocages({
  etat,
  recharger,
  du,
  au,
  onPeriode,
}: {
  etat: EtatRequete<ListeDeblocages>
  recharger: () => void
  du?: string
  au?: string
  onPeriode: (du: string, au: string) => void
}) {
  const [d, setD] = useState(du ?? '')
  const [a, setA] = useState(au ?? '')
  return (
    <section className="mt-10" aria-label="Préparations débloquées">
      <h2 className="text-xl font-semibold">Préparations débloquées</h2>
      <form
        className="mt-2 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          onPeriode(d, a)
        }}
      >
        <label className="text-sm">
          Du
          <input
            type="date"
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={d}
            onChange={(e) => {
              setD(e.target.value)
            }}
          />
        </label>
        <label className="text-sm">
          Au
          <input
            type="date"
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={a}
            onChange={(e) => {
              setA(e.target.value)
            }}
          />
        </label>
        <Button type="submit">Afficher</Button>
      </form>
      <div className="mt-3">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' && (
          <>
            <p className="text-xs text-slate-500">
              Du {etat.data.du} au {etat.data.au}
            </p>
            {etat.data.deblocages.length === 0 ? (
              <p className="text-sm text-slate-600">Aucun déblocage sur la période.</p>
            ) : (
              <table className="mt-1 w-full text-sm" aria-label="Déblocages">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-1">Le</th>
                    <th>Par</th>
                    <th>Prépa</th>
                    <th>Groupe</th>
                    <th>Dossier</th>
                    <th>Annonceur</th>
                    <th>Semaine</th>
                    <th>Site</th>
                    <th>Type de préparation</th>
                    <th className="text-right">Quantité</th>
                    <th>Motif</th>
                    <th>Lignes annulées</th>
                    <th>Mail</th>
                  </tr>
                </thead>
                <tbody>
                  {etat.data.deblocages.map((x) => (
                    <tr key={x.id} className="border-b align-top">
                      <td className="py-1">{new Date(x.le).toLocaleString('fr-FR')}</td>
                      <td>{x.par ?? '—'}</td>
                      <td>{x.idPreparationChapeau ?? '—'}</td>
                      <td>{x.idGroupePreparation ?? '—'}</td>
                      <td>{x.contNum}</td>
                      <td>{x.annonceur ?? '—'}</td>
                      <td>{sem(x.semaine)}</td>
                      <td>{x.site ?? '—'}</td>
                      <td>{x.typePreparation ?? '—'}</td>
                      <td className="text-right">{x.quantite ?? '—'}</td>
                      <td>{x.motif}</td>
                      <td>
                        {x.repartitionsAnnulees} ligne(s), {x.unitesAnnulees} UM
                      </td>
                      <td>
                        {(
                          {
                            SANS_DESTINATAIRE: 'Aucune adresse',
                            ENVOYE: 'Envoyé',
                            SIMULE: 'Simulé (aucun mail réel)',
                            ECHEC: 'Échec d’envoi',
                          } as Record<string, string | undefined>
                        )[x.mailStatut] ?? 'En file d’envoi (Q-409)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </section>
  )
}
