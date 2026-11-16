import {
  BesoinThemeSchema,
  ExportApercuSchema,
  ExportResultatSchema,
  HistoriqueExportsSchema,
  ResultatSimpleSchema,
  RouleursSchema,
  type ExportResultat,
  type LigneBesoin,
  type TrainVersion,
} from '@circe/shared'
import { useState } from 'react'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
import { Pastille } from '../ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'

// COO-P10 — modales et vues du suivi par thème, de l'export des trains et du choix du rouleur
// (ECR-COO-05b, ECR-COO-06, ECR-COO-07). Aucune règle ici : tout est contrôlé par l'API.

/** Télécharge un contenu texte (fichier d'export simulé, Q-193). */
export function telecharger(nom: string, contenu: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  URL.revokeObjectURL(url)
}

// ───────────────────────── ECR-COO-05b Exporter les trains · départ Sxx ─────────────────────────

export function ModaleExport({
  depart,
  onFermer,
}: {
  depart: string
  onFermer: (message: string | null) => void
}) {
  const { etat, recharger } = useApi(`export-apercu-${depart}`, (signal) =>
    apiRequest('GET', `/api/coordination/trains/export/apercu?depart=${depart}`, {
      schema: ExportApercuSchema,
      signal,
    }),
  )
  const historique = useApi(`export-historique-${depart}`, (signal) =>
    apiRequest('GET', `/api/coordination/trains/export/historique?depart=${depart}`, {
      schema: HistoriqueExportsSchema,
      signal,
    }),
  )
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [resultat, setResultat] = useState<ExportResultat | null>(null)

  async function lancer(simulation: boolean) {
    setEnvoi(true)
    setErreur(null)
    try {
      setResultat(
        await apiPost('/api/coordination/trains/export', {
          schema: ExportResultatSchema,
          body: { depart, simulation },
        }),
      )
      recharger()
      historique.recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Modale
      titre={`Exporter les trains · départ ${depart.replace('-W', ' S')}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer(resultat && !resultat.simulation ? resultat.message : null)
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <div className="text-sm">
          <p>
            <strong>{etat.data.dossiersExportables} dossier(s)</strong> en Instruction OK : leurs
            faces passent « A imprimer », le go des plateformes.
            {etat.data.dejaExportes > 0 && <> [{etat.data.dejaExportes} déjà exporté(s)]</>}
          </p>
          {etat.data.dossiersEnCours.length > 0 && (
            <p role="note" className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
              {etat.data.dossiersEnCours.length} dossier(s) « En cours » — Ils ne partent pas :{' '}
              {etat.data.dossiersEnCours
                .map((d) => `${String(d.dossier)}${d.annonceur ? ` (${d.annonceur})` : ''}`)
                .join(', ')}
              .
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">Jeudi 14 h, par la Coordination.</p>
          {resultat && (
            <div
              role="status"
              className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2"
            >
              <p>{resultat.message}</p>
              {resultat.fichierSimule && (
                <p role="note" className="mt-1 text-xs font-semibold text-amber-800">
                  Fichier simulé (D-15) : non déposé, non transmis à Surf.
                </p>
              )}
              <Button
                type="button"
                className="mt-2"
                onClick={() => {
                  telecharger(resultat.nomFichier, resultat.contenu)
                }}
              >
                Télécharger {resultat.nomFichier}
              </Button>
            </div>
          )}
          {erreur !== null && <ErrorMessage error={erreur} />}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              className="bg-slate-600"
              disabled={envoi || etat.data.dossiersExportables === 0}
              onClick={() => {
                void lancer(true)
              }}
            >
              Simulation export
            </Button>
            <Button
              type="button"
              disabled={envoi || etat.data.dossiersExportables === 0}
              onClick={() => {
                void lancer(false)
              }}
            >
              Exporter
            </Button>
          </div>
          <h3 className="mt-5 font-semibold">Historique des exports</h3>
          {historique.etat.kind === 'ready' &&
            (historique.etat.data.exports.length === 0 ? (
              <p className="text-slate-500">Aucun export pour ce départ.</p>
            ) : (
              <table className="mt-1 w-full" aria-label="Historique des exports">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th>Date</th>
                    <th>Par</th>
                    <th>Nature</th>
                    <th className="text-right">Dossiers</th>
                    <th className="text-right">Trains</th>
                    <th>Fichier</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.etat.data.exports.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td>{new Date(e.le).toLocaleString('fr-FR')}</td>
                      <td>{e.par ?? '—'}</td>
                      <td>
                        {e.nature === 'EXPORT_PREPARATION'
                          ? 'Export préparation'
                          : 'Export des trains'}{' '}
                        {e.simulation && (
                          <Pastille ton="neutre">
                            simulation d’export (aucun statut modifié)
                          </Pastille>
                        )}
                      </td>
                      <td className="text-right">{e.dossiers}</td>
                      <td className="text-right">{e.trains}</td>
                      <td>
                        {e.nomFichier}{' '}
                        {e.fichierSimule && (
                          <Pastille ton="important">fichier simulé (D-15)</Pastille>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      )}
    </Modale>
  )
}

// ───────────────────────── Choix du rouleur (RG-COO-217, 236) ─────────────────────────

/** Modale « Rouleur de n ligne(s) de trains » : liste des opérateurs de l'atelier, bouton d'action. */
export function ModaleRouleur({
  trains,
  atelierId,
  actionLabel,
  chemin,
  corpsSupplementaire = {},
  onFermer,
}: {
  trains: TrainVersion[]
  atelierId: number
  /** « Affecter » (RG-COO-236) ou « Au roulage » (RG-COO-217). */
  actionLabel: string
  chemin:
    | '/api/coordination/trains/rouleur'
    | '/api/coordination/trains/au-roulage'
    | '/api/coordination/trains/statut'
  /** Champs propres à l'action (ex. « changer statut » : vers et écran). */
  corpsSupplementaire?: Record<string, string>
  onFermer: (message: string | null) => void
}) {
  const { etat, recharger } = useApi(`rouleurs-${String(atelierId)}`, (signal) =>
    apiRequest('GET', `/api/coordination/trains/rouleurs?atelier=${String(atelierId)}`, {
      schema: RouleursSchema,
      signal,
    }),
  )
  const [rouleurId, setRouleurId] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  async function valider() {
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost(chemin, {
        schema: ResultatSimpleSchema,
        body: { trains, rouleurId: Number(rouleurId), ...corpsSupplementaire },
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
      titre={`Rouleur de ${String(trains.length)} ligne(s) de trains`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' &&
        (etat.data.rouleurs.length === 0 ? (
          <p className="text-sm text-slate-600">
            Aucun rouleur n’est enregistré pour cet atelier (référentiel des rouleurs, ECR-ADM-07).
          </p>
        ) : (
          <label className="block text-sm">
            Rouleur
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
              value={rouleurId}
              onChange={(e) => {
                setRouleurId(e.target.value)
              }}
            >
              <option value="">Choisir…</option>
              {etat.data.rouleurs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom}
                  {r.poste ? ` · ${r.poste}` : ''}
                </option>
              ))}
            </select>
          </label>
        ))}
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
          disabled={envoi || !rouleurId}
          onClick={() => {
            void valider()
          }}
        >
          {actionLabel}
        </Button>
      </div>
    </Modale>
  )
}

// ───────────────────────── ECR-COO-06 Suivi par thème (vue besoin) ─────────────────────────

/** Vue « besoin » : une ligne par thème, pré-assemblage, annulation de thème et déblocage de semaine. */
export function VueBesoin({
  qs,
  depart,
  peutPreAssembler,
  peutChangerStatut,
  onMessage,
}: {
  qs: string
  depart: string
  peutPreAssembler: boolean
  peutChangerStatut: boolean
  onMessage: (message: string) => void
}) {
  const { etat, recharger } = useApi(`besoin-${qs}`, (signal) =>
    apiRequest('GET', `/api/coordination/trains/besoin?${qs}`, {
      schema: BesoinThemeSchema,
      signal,
    }),
  )
  const [selection, setSelection] = useState<string[]>([])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  // Audit COO-P10 m3 : « Annuler thème » et « Débloquer semaine » sont destructeurs : confirmation avant l'appel.
  const [confirmation, setConfirmation] = useState<{
    titre: string
    texte: string
    action: () => void
  } | null>(null)
  const lignes = etat.kind === 'ready' ? etat.data.lignes : []
  const choisies = lignes.filter((l) => selection.includes(l.cle))

  async function agir<T extends { message: string }>(appel: () => Promise<T>) {
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await appel()
      onMessage(r.message)
      setSelection([])
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  const cibleDe = (l: LigneBesoin) => ({
    atelierId: l.atelierId,
    depart,
    contNum: l.contNum ?? 0,
    theme: l.theme ?? '',
  })
  const preAssembler = (valeur: boolean) =>
    agir(() =>
      apiPost('/api/coordination/trains/pre-assemblage', {
        schema: ResultatSimpleSchema,
        body: { themes: choisies.map((l) => ({ ...cibleDe(l), version: l.version })), valeur },
      }),
    )

  return (
    <section aria-label="Suivi par thème" className="mt-4">
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-500">{choisies.length} thème(s) sélectionné(s)</span>
            <Button
              type="button"
              disabled={envoi || choisies.length === 0 || !peutPreAssembler}
              onClick={() => {
                void preAssembler(true)
              }}
            >
              Marquer pré-assemblé
            </Button>
            <Button
              type="button"
              className="bg-slate-600"
              disabled={envoi || choisies.length === 0 || !peutPreAssembler}
              onClick={() => {
                void preAssembler(false)
              }}
            >
              Désassembler
            </Button>
            <Button
              type="button"
              className="bg-red-700 hover:bg-red-600"
              disabled={envoi || choisies.length !== 1 || !peutChangerStatut}
              title="Annule les faces « A imprimer » du thème choisi"
              onClick={() => {
                const l = choisies[0]
                if (!l) return
                setConfirmation({
                  titre: 'Annuler le thème ?',
                  texte: `Les faces « A imprimer » du thème « ${l.theme ?? '—'} » (dossier ${String(l.contNum ?? '—')}) seront annulées.`,
                  action: () => {
                    void agir(() =>
                      apiPost('/api/coordination/trains/annuler-theme', {
                        schema: ResultatSimpleSchema,
                        body: cibleDe(l),
                      }),
                    )
                  },
                })
              }}
            >
              Annuler thème
            </Button>
            <Button
              type="button"
              className="bg-slate-600"
              disabled={envoi || choisies.length === 0 || !peutChangerStatut}
              title="Repasse « Instruction ok » les trains « A imprimer » de l’atelier du thème coché pour ce départ"
              onClick={() => {
                const l = choisies[0]
                if (!l) return
                setConfirmation({
                  titre: 'Débloquer la semaine ?',
                  texte: `Les trains « A imprimer » de l’atelier du thème coché (« ${l.theme ?? '—'} ») repassent « Instruction ok » pour le départ ${depart.replace('-W', ' S')}.`,
                  action: () => {
                    void agir(() =>
                      apiPost('/api/coordination/trains/debloquer-semaine', {
                        schema: ResultatSimpleSchema,
                        body: { atelierId: l.atelierId, depart },
                      }),
                    )
                  },
                })
              }}
            >
              Débloquer semaine
            </Button>
          </div>
          {erreur !== null && <ErrorMessage error={erreur} />}
          {confirmation && (
            <Modale
              titre={confirmation.titre}
              ouverte
              onOuverture={(o) => {
                if (!o) setConfirmation(null)
              }}
            >
              <p className="text-sm">{confirmation.texte}</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  className="bg-slate-600"
                  onClick={() => {
                    setConfirmation(null)
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  className="bg-red-700 hover:bg-red-600"
                  onClick={() => {
                    const { action } = confirmation
                    setConfirmation(null)
                    action()
                  }}
                >
                  Confirmer
                </Button>
              </div>
            </Modale>
          )}
          {etat.data.exclus.length > 0 && (
            <p className="mt-2 text-xs text-slate-600">
              Thèmes exclus (« ne pas afficher » / « reste en place ») :{' '}
              {etat.data.exclus.join(' ; ')}.
            </p>
          )}
          {lignes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Aucun thème pour ces critères.</p>
          ) : (
            <table className="mt-3 w-full text-sm" aria-label="Besoin par thème">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="w-8" />
                  <th>Annonceur · thème</th>
                  <th>Dossier</th>
                  <th className="text-right">Besoin (trains)</th>
                  <th className="text-right">Entretien</th>
                  <th className="text-right">Reçu</th>
                  <th>Couvert</th>
                  <th>Emplacement</th>
                  <th>Pré-assemblé</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.cle} className={`border-b ${l.couvert ? '' : 'bg-orange-50'}`}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${l.theme ?? ''}`}
                        checked={selection.includes(l.cle)}
                        onChange={(e) => {
                          setSelection(
                            e.target.checked
                              ? [...selection, l.cle]
                              : selection.filter((x) => x !== l.cle),
                          )
                        }}
                      />
                    </td>
                    <td className="py-1">
                      {l.annonceur ?? '—'} · {l.theme ?? '—'}
                      {l.repiquage ? ` (${l.repiquage})` : ''}
                    </td>
                    <td>{l.contNum ?? '—'}</td>
                    <td className="text-right">{l.besoin}</td>
                    <td className="text-right">{l.entretien}</td>
                    <td className="text-right">
                      {l.recu} / {l.attendu}
                    </td>
                    <td>
                      <Pastille ton={l.couvert ? 'ok' : 'critique'}>
                        {l.couvert ? 'Oui' : 'Non'}
                      </Pastille>
                    </td>
                    <td>{l.emplacement ?? '—'}</td>
                    <td>{l.preAssemble ? 'Fait' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  )
}
