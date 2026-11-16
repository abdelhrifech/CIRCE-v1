import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  GenerationSchema,
  PickingGenerationSchema,
  TrainsGenerationSchema,
  type Generation,
  type PickingGeneration,
  type TrainsGeneration,
} from '@circe/shared'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { telecharger } from '../../components/coordination/trains-export.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Edition } from '../../components/impression/edition.tsx'
import { Pastille, type Ton } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { formatDepart } from './trains.tsx'

// COO-P10 — ECR-GEN-01 « Fichiers Vendôme : choix des trains » et ECR-GEN-03 « Bilan de génération et envoi à la
// machine » (RG-COO-215 / 216 / 217, Q-254). Le format de production réel (.ini, D-15) n'est pas repris : le fichier
// est une SIMULATION marquée (Q-193). Les règles (trains prêts, 20 tiroirs, envoi, train déjà envoyé) sont contrôlées par l'API ;
// l'envoi ne modifie pas les faces (effet d'un envoi : Q-194). D-15 : historique (Fichiers, Modifiées depuis),
// « Générer un complément » (RG-COO-074) et liste de picking du lot (HYPOTHÈSES Q-411).

const SearchSchema = z.object({
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  atelier: z.coerce.number().int().positive().optional(),
  recherche: z.string().trim().min(1).max(100).optional(),
})

export const Route = createFileRoute('/coordination/generateur')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('roulage.preparer'),
  component: Generateur,
})

const STATUT: Record<TrainsGeneration['trains'][number]['statut'], { libelle: string; ton: Ton }> =
  {
    PRET: { libelle: 'Prêt', ton: 'ok' },
    EN_ATTENTE: { libelle: 'En attente d’affiches', ton: 'important' },
    DEJA_ENVOYE: { libelle: 'Déjà envoyé', ton: 'neutre' },
  }

function Generateur() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const params = new URLSearchParams()
  if (search.depart) params.set('depart', search.depart)
  if (search.atelier) params.set('atelier', String(search.atelier))
  if (search.recherche) params.set('recherche', search.recherche)
  const qs = params.toString()
  const { etat, recharger } = useApi(`generateur-${qs}`, (signal) =>
    apiRequest('GET', `/api/coordination/generateur${qs ? `?${qs}` : ''}`, {
      schema: TrainsGenerationSchema,
      signal,
    }),
  )
  const [selection, setSelection] = useState<string[]>([])
  const [bilan, setBilan] = useState<Generation | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [picking, setPicking] = useState<PickingGeneration | null>(null)
  const [depart, setDepart] = useState(search.depart ?? '')
  const [recherche, setRecherche] = useState(search.recherche ?? '')
  const trains = etat.kind === 'ready' ? etat.data.trains : []
  const choisis = trains.filter((t) => selection.includes(t.trainId))
  // ECR-GEN-01 : compteur « n / 20 tiroirs » = visuels distincts (union des visuels des trains choisis). C'est une aide
  // d'affichage : le refus au-delà de la limite reste prononcé par l'API (RG-COO-216, bloquant).
  const tiroirsMax = etat.kind === 'ready' ? etat.data.tiroirsMax : 0
  const tiroirs = new Set(choisis.flatMap((t) => t.visuels)).size
  const depasse = tiroirsMax > 0 && tiroirs > tiroirsMax
  const semaine =
    etat.kind === 'ready'
      ? `${String(etat.data.semaine.annee)}-W${String(etat.data.semaine.semaine).padStart(2, '0')}`
      : ''

  async function agir(appel: () => Promise<Generation>) {
    setEnvoi(true)
    setErreur(null)
    try {
      setBilan(await appel())
      setSelection([])
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  async function voirPicking(id: number) {
    setErreur(null)
    try {
      setPicking(
        await apiRequest('GET', `/api/coordination/generateur/${String(id)}/picking`, {
          schema: PickingGenerationSchema,
        }),
      )
    } catch (e) {
      setErreur(e)
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Déroulant › Générateur de fichiers</p>
      <h1 className="text-2xl font-semibold">Fichiers Vendôme · choix des trains</h1>
      <p className="text-sm text-slate-600">
        Cochez les trains à mettre dans le fichier. Seuls les trains prêts (tous leurs visuels
        reçus) sont proposés ; le fichier est une simulation (format de la machine non repris).{' '}
        <Link to="/coordination/trains" search={{ tab: 'prepa' }} className="underline">
          Retour à la Préparation
        </Link>
      </p>
      <form
        className="mt-4 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setSelection([])
          void navigate({
            search: (s) => ({
              ...s,
              depart: depart || undefined,
              recherche: recherche.trim() || undefined,
            }),
          })
        }}
      >
        <label className="flex flex-col text-sm">
          <span className="text-slate-600">Départ</span>
          <input
            type="week"
            className="rounded-md border border-slate-300 px-2 py-1"
            value={depart || semaine}
            onChange={(e) => {
              setDepart(e.target.value)
            }}
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-slate-600">Recherche</span>
          <input
            type="search"
            className="rounded-md border border-slate-300 px-2 py-1"
            placeholder="Train, destinataire, annonceur, thème…"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
            }}
          />
        </label>
        <Button type="submit">Filtrer</Button>
      </form>
      {etat.kind === 'loading' && <p className="mt-4">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <section className="md:col-span-2" aria-label="Trains prêts">
            <h2 className="font-semibold">Trains prêts : départs {semaine.replace('-W', ' S')}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span>{choisis.length} train(s) choisi(s)</span>
              <span aria-label="Tiroirs">
                {tiroirs} / {tiroirsMax} tiroirs
              </span>
              {depasse && <Pastille ton="critique">au-delà de {tiroirsMax} : bloquant</Pastille>}
              <Button
                type="button"
                disabled={envoi || choisis.length === 0 || depasse}
                onClick={() => {
                  void agir(() =>
                    apiPost('/api/coordination/generateur', {
                      schema: GenerationSchema,
                      body: {
                        depart: semaine,
                        trains: choisis.map((t) => ({ trainId: t.trainId, version: t.version })),
                      },
                    }),
                  )
                }}
              >
                Préparer le fichier ({choisis.length} trains)
              </Button>
            </div>
            {choisis.length === 0 && trains.length > 0 && (
              <p className="mt-2 text-sm text-slate-600">
                Cochez les trains à mettre dans le fichier.
              </p>
            )}
            {depasse && (
              <p
                role="alert"
                className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm"
              >
                {tiroirs} tiroirs : la Vendôme en a {tiroirsMax}. Retirez des trains (bloquant).
              </p>
            )}
            {erreur !== null && <ErrorMessage error={erreur} />}
            {trains.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Aucun train prêt pour ces départs.</p>
            ) : (
              <table className="mt-3 w-full text-sm" aria-label="Trains">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="w-8" />
                    <th>Train</th>
                    <th>Destinataire</th>
                    <th>Positions</th>
                    <th className="text-right">Nb trains</th>
                    <th className="text-right">Tiroirs</th>
                    <th>Départ camion</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {trains.map((t) => (
                    <tr key={t.trainId} className="border-b">
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Choisir ${t.trainId}`}
                          disabled={t.statut !== 'PRET'}
                          checked={selection.includes(t.trainId)}
                          onChange={(e) => {
                            setSelection(
                              e.target.checked
                                ? [...selection, t.trainId]
                                : selection.filter((x) => x !== t.trainId),
                            )
                          }}
                        />
                      </td>
                      <td className="py-1">{t.trainId}</td>
                      <td>{t.destinataire ?? '—'}</td>
                      <td>{t.positions.map((p) => p.lettre).join(' ')}</td>
                      <td className="text-right">{t.nb}</td>
                      <td className="text-right">{t.tiroirs}</td>
                      <td>{formatDepart(t.depart)}</td>
                      <td>
                        <Pastille ton={STATUT[t.statut].ton}>{STATUT[t.statut].libelle}</Pastille>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <aside
            aria-label="Règles appliquées"
            className="rounded-md border border-slate-200 p-3 text-sm"
          >
            <h2 className="font-semibold">Règles appliquées</h2>
            <p className="mt-1">
              {etat.data.tiroirsMax} tiroirs au plus par fichier (bloquant au-delà).
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="block text-xl font-semibold">{etat.data.indicateurs.prets}</span>
                Prêts
              </div>
              <div>
                <span className="block text-xl font-semibold">
                  {etat.data.indicateurs.enAttente}
                </span>
                En attente
              </div>
              <div>
                <span className="block text-xl font-semibold">
                  {etat.data.indicateurs.dejaEnvoyes}
                </span>
                Déjà envoyés
              </div>
            </div>
          </aside>
        </div>
      )}

      {bilan && (
        <section
          aria-label="Bilan de génération"
          className="mt-6 rounded-md border border-slate-200 p-4"
        >
          <h2 className="font-semibold">Bilan de génération · {bilan.lot}</h2>
          <p role="status" className="mt-1 text-sm">
            {bilan.message}
          </p>
          <p className="text-sm text-slate-600">
            {bilan.trains} train(s) · {bilan.tiroirs} tiroir(s) · {bilan.nomFichier} · version{' '}
            {bilan.version} ·{' '}
            <Pastille ton={bilan.statut === 'ENVOYE' ? 'ok' : 'info'}>
              {bilan.statut === 'ENVOYE' ? 'Envoyé à la machine' : 'Préparé'}
            </Pastille>{' '}
            <Pastille ton="important">fichier simulé (D-15)</Pastille>
            {bilan.machine && <> · machine « {bilan.machine} »</>}
          </p>
          <pre
            className="mt-2 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs"
            aria-label="Aperçu du fichier"
          >
            {bilan.contenu.split('\r\n').slice(0, 40).join('\n')}
          </pre>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              onClick={() => {
                telecharger(bilan.nomFichier, bilan.contenu)
              }}
            >
              Télécharger
            </Button>
            <Button
              type="button"
              disabled={envoi || bilan.statut !== 'PREPARE'}
              onClick={() => {
                void agir(() =>
                  apiPost('/api/coordination/generateur/envoyer', {
                    schema: GenerationSchema,
                    body: { id: bilan.id, version: bilan.version },
                  }),
                )
              }}
            >
              Envoyer à la machine ({bilan.trains} trains)
            </Button>
            <Button
              type="button"
              onClick={() => {
                void voirPicking(bilan.id)
              }}
            >
              Liste de picking
            </Button>
            <Button
              type="button"
              className="bg-slate-600"
              onClick={() => {
                setBilan(null)
              }}
            >
              Fermer le bilan
            </Button>
          </div>
        </section>
      )}

      {picking && (
        <section
          aria-label="Liste de picking"
          className="mt-6 rounded-md border border-slate-200 p-4"
        >
          <Edition titre={`Liste de picking · ${picking.lot}`}>
            {picking.lignes.length === 0 ? (
              <p className="text-sm text-slate-600">Aucun tiroir dans ce lot.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th>Tiroir</th>
                    <th>Annonceur</th>
                    <th>Thème</th>
                    <th className="text-right">Quantité</th>
                    <th>Emplacement</th>
                  </tr>
                </thead>
                <tbody>
                  {picking.lignes.map((l, i) => (
                    <tr key={`${String(l.tiroir)}-${String(i)}`} className="border-b">
                      <td className="py-1">{l.tiroir}</td>
                      <td>{l.annonceur ?? '—'}</td>
                      <td>{l.theme ?? '—'}</td>
                      <td className="text-right">{l.quantite ?? '—'}</td>
                      <td>{l.emplacement ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Edition>
          <Button
            type="button"
            className="mt-2"
            onClick={() => {
              window.print()
            }}
          >
            Imprimer (PDF navigateur)
          </Button>
          <Button
            type="button"
            className="mt-2 bg-slate-600"
            onClick={() => {
              setPicking(null)
            }}
          >
            Fermer
          </Button>
        </section>
      )}

      {etat.kind === 'ready' && (
        <section aria-label="Historique des générations" className="mt-6">
          <h2 className="font-semibold">Historique des générations</h2>
          {etat.data.historique.length === 0 ? (
            <p className="text-sm text-slate-600">Aucune génération pour ce départ.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th>Lot</th>
                  <th>Date</th>
                  <th>Par</th>
                  <th>Fichier</th>
                  <th className="text-right">Fichiers</th>
                  <th className="text-right">Trains</th>
                  <th className="text-right">Tiroirs</th>
                  <th className="text-right">Modifiées depuis</th>
                  <th>Machine</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {etat.data.historique.map((h) => (
                  <tr
                    key={h.id}
                    className={`border-b ${h.modifiees > 0 ? 'border-l-4 border-l-red-500 bg-red-50' : ''}`}
                  >
                    <td className="py-1">
                      {h.lot}
                      {h.complementDe && (
                        <span className="block text-xs text-slate-500">
                          complément de {h.complementDe}
                        </span>
                      )}
                    </td>
                    <td>{new Date(h.le).toLocaleString('fr-FR')}</td>
                    <td>{h.par ?? '—'}</td>
                    <td>{h.nomFichier}</td>
                    <td className="text-right">{h.fichiers}</td>
                    <td className="text-right">{h.trains}</td>
                    <td className="text-right">{h.tiroirs}</td>
                    <td className="text-right">{h.modifiees}</td>
                    <td>{h.machine ?? '—'}</td>
                    <td>
                      {h.statut === 'ENVOYE' ? 'Envoyé à la machine' : 'Préparé'} · v{h.version}
                    </td>
                    <td className="space-x-2">
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          void voirPicking(h.id)
                        }}
                      >
                        Liste de picking
                      </button>
                      {h.statut === 'ENVOYE' && h.modifiees > 0 && (
                        <button
                          type="button"
                          className="underline"
                          disabled={envoi}
                          onClick={() => {
                            void agir(() =>
                              apiPost('/api/coordination/generateur/complement', {
                                schema: GenerationSchema,
                                body: { id: h.id, version: h.version },
                              }),
                            )
                          }}
                        >
                          Générer un complément
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  )
}
