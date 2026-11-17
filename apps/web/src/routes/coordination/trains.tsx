import { BoutonExportTableau } from '../../components/ui/export-tableau.tsx'
import { useSelectionGlissee } from '../../lib/selection-glissee.ts'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  CreerTrainResultatSchema,
  ExportResultatSchema,
  FicheTrainSchema,
  ListeTrainsSchema,
  MOTIFS_SUPPRESSION_TRAIN,
  OptionsCreationTrainSchema,
  ResultatActionTrainsSchema,
  ResultatSimpleSchema,
  selectionnerPremiers,
  STATUTS_UNITE,
  STATUTS_UNITE_EN_PRODUCTION,
  VisuelsRaccrochablesSchema,
  type EtatPosition,
  type LigneTrain,
  type StatutUnite,
  type TrainVersion,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import {
  ModaleImpressionBagues,
  ModaleReimpression,
} from '../../components/coordination/bagues.tsx'
import { VueSuivi8m2 } from '../../components/coordination/suivi-8m2.tsx'
import {
  ModaleExport,
  ModaleRouleur,
  telecharger,
  VueBesoin,
} from '../../components/coordination/trains-export.tsx'
import { Pastille, type Ton } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// COO-P09 — ECR-COO-05 « Déroulant · Liste des trains » (RG-COO-208, 209, 218 à 229, 307, 308) : filtres côté
// API, indicateurs, encadré « À faire par la Coordination », pastilles de positions (A reçu / B manquant /
// C fractionné), sélection des N premiers, Fractionner, Raccrocher un visuel (ECR-COO-05d), Train de pré-test
// (ECR-COO-05c), fiche train (ECR-COO-05a), suppression avec motif (ECR-COO-05e). L'export du jeudi
// (ECR-COO-05b), les fichiers Vendôme et les bagues relèvent de COO-P10 / P11.

const SearchSchema = z.object({
  dossier: z.coerce.number().int().positive().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  atelier: z.coerce.number().int().positive().optional(),
  statut: z.string().optional(),
  destinataire: z.string().optional(),
  annonceur: z.string().optional(),
  theme: z.string().optional(),
  afficheur: z.string().optional(),
  trainsDe: z.coerce.number().int().min(1).max(9).optional(),
  /** Vue : Liste des trains (défaut), Suivi par thème (besoin), Préparation ou Suivi 8 m² (ECR-COO-05 / 06 / 07 / 08). */
  tab: z.enum(['trains', 'besoin', 'prepa', 'd8', 'positions', 'export']).optional(),
})
type Recherche = z.infer<typeof SearchSchema>

export const Route = createFileRoute('/coordination/trains')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('train.consulter'),
  component: ListeDesTrains,
})

export const STATUT_UNITE: Record<StatutUnite, { libelle: string; ton: Ton }> = {
  EN_ATTENTE: { libelle: 'En attente d’affiches', ton: 'important' },
  PRET: { libelle: 'Prêt à produire', ton: 'info' },
  EN_PROD: { libelle: 'En production', ton: 'surveiller' },
  PRODUIT: { libelle: 'Produit', ton: 'ok' },
  COLISE: { libelle: 'Colisé · à expédier', ton: 'ok' },
  EXPEDIE: { libelle: 'Expédié', ton: 'ok' },
  LIVRE: { libelle: 'Livré', ton: 'ok' },
}
const POSITION: Record<EtatPosition, { classe: string; titre: string }> = {
  OK: { classe: 'bg-emerald-500 text-white', titre: 'reçu' },
  MANQUANT: {
    classe:
      'border border-red-400 text-red-700 bg-[repeating-linear-gradient(45deg,#fee2e2,#fee2e2_3px,#fff_3px,#fff_6px)]',
    titre: 'manquant',
  },
  FRACTIONNE: {
    classe: 'border border-dashed border-slate-500 text-slate-600',
    titre: 'fractionné',
  },
}

/** « mar. 20/10 16h30 » (maquette). */
export function formatDepart(iso: string): string {
  const d = new Date(iso)
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })
  const jj = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const h = `${String(d.getUTCHours()).padStart(2, '0')}h${String(d.getUTCMinutes()).padStart(2, '0')}`
  return `${jour} ${jj}/${mm} ${h}`
}

function qsDe(s: Recherche, exclure: string[] = ['tab']): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(s) as [string, string | number | undefined][])
    if (v !== undefined && v !== '' && !exclure.includes(k)) qs.set(k, String(v))
  return qs.toString()
}

function Positions({
  ligne,
  onClic,
}: {
  ligne: Pick<LigneTrain, 'positions'>
  onClic?: (faceId: number) => void
}) {
  return (
    <span className="inline-flex gap-1" aria-label="Positions">
      {ligne.positions.map((p) => (
        <button
          type="button"
          key={p.faceId}
          onClick={() => onClic?.(p.faceId)}
          title={`${p.lettre} · ${p.theme ?? '—'} (${String(p.contNum ?? '—')}) : ${POSITION[p.etat].titre}`}
          aria-label={`Position ${p.lettre} ${POSITION[p.etat].titre}`}
          className={`h-6 w-6 rounded text-xs font-semibold ${POSITION[p.etat].classe}`}
        >
          {p.lettre}
        </button>
      ))}
    </span>
  )
}

function ListeDesTrains() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { etat: moi } = useApi('moi', () => getMe())
  const peut = (code: Parameters<typeof can>[1]) => moi.kind === 'ready' && can(moi.data, code)
  const qs = qsDe(search)
  const tab = search.tab ?? 'trains'
  const prepa = tab === 'prepa' || tab === 'export'
  const { etat, recharger } = useApi(`trains-${qs}`, (signal) =>
    apiRequest('GET', `/api/coordination/trains?${qs}`, { schema: ListeTrainsSchema, signal }),
  )
  const [selection, setSelection] = useState<string[]>([])
  const [n, setN] = useState('60')
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)
  const [fiche, setFiche] = useState<string | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [raccrocher, setRaccrocher] = useState<TrainVersion[] | null>(null)
  const [creer, setCreer] = useState(false)
  const [exporter, setExporter] = useState(false)
  const [rouleurPour, setRouleurPour] = useState<{
    trains: TrainVersion[]
    atelierId: number
    action: 'affecter' | 'roulage' | 'liste'
  } | null>(null)
  const [bagues, setBagues] = useState<{ trains: TrainVersion[]; atelierId: number } | null>(null)
  const [colonnes, setColonnes] = useState({
    afficheur: false,
    panneau: false,
    fichier: false,
    modifications: false,
    atelier: false,
    bague: false,
  })
  const [filtres, setFiltres] = useState<Recherche>(search)

  const lignes =
    etat.kind === 'ready' ? (prepa ? etat.data.lignes : (etat.data.faces ?? etat.data.lignes)) : []
  const glissement = useSelectionGlissee(
    [...new Set(lignes.map((l) => l.cle))],
    selection,
    setSelection,
  )
  const choisis = [
    ...new Map(lignes.filter((l) => selection.includes(l.cle)).map((l) => [l.cle, l])).values(),
  ]
  const trainsChoisis = choisis.flatMap((l) => l.trains)

  function appliquer(e: SyntheticEvent) {
    e.preventDefault()
    setSelection([])
    void navigate({ search: () => ({ ...filtres }) })
  }
  function filtrerStatut(statuts: StatutUnite[]) {
    setSelection([])
    void navigate({ search: (s) => ({ ...s, statut: statuts.join(',') }) })
  }
  async function fractionner(trains: TrainVersion[]) {
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      const r = await apiPost('/api/coordination/trains/fractionner', {
        schema: ResultatActionTrainsSchema,
        body: { trains },
      })
      setMessage(
        r.message +
          (r.ecartes.length > 0 ? ` ${String(r.ecartes.length)} train(s) écarté(s).` : ''),
      )
      setSelection([])
      setFiche(null)
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  async function changerStatut(
    trains: TrainVersion[],
    vers: 'A_IMPRIMER' | 'AU_ROULAGE',
    ecran: 'LISTE' | 'PREPARATION',
  ) {
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      const r = await apiPost('/api/coordination/trains/statut', {
        schema: ResultatSimpleSchema,
        body: { trains, vers, ecran },
      })
      setMessage(r.message)
      setSelection([])
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  async function exporterPreparation(trains: TrainVersion[]) {
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      const r = await apiPost('/api/coordination/trains/export-preparation', {
        schema: ExportResultatSchema,
        body: { trains },
      })
      setMessage(r.message)
      telecharger(r.nomFichier, r.contenu)
      setSelection([])
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Déroulant</p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {tab === 'positions'
              ? 'Position Train'
              : tab === 'export'
                ? 'Export préparation'
                : tab === 'prepa'
                  ? 'Préparation des trains'
                  : tab === 'besoin'
                    ? 'Suivi par thème'
                    : tab === 'd8'
                      ? 'Suivi 8 m²'
                      : 'Déroulant · Liste des trains'}
          </h1>
          <p className="text-sm text-slate-600">
            Un train attend ses affiches tant qu’un visuel manque ; il devient « Prêt à produire »
            quand tous ses visuels sont reçus ou fractionnés. En production, il ne se modifie plus.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {peut('roulage.preparer') && (
            <Button asChild>
              <Link to="/coordination/generateur">Fichiers Vendôme</Link>
            </Button>
          )}
          {peut('bague.imprimer') && (
            <Button asChild>
              <Link to="/coordination/bagues">Bagues</Link>
            </Button>
          )}
          {peut('train.creer_supprimer') && (
            <Button
              type="button"
              onClick={() => {
                setCreer(true)
              }}
            >
              Train de pré-test…
            </Button>
          )}
          {tab === 'trains' && peut('train.exporter') && (
            <Button
              type="button"
              title="Jeudi 14 h, par la Coordination"
              onClick={() => {
                setExporter(true)
              }}
            >
              Exporter les trains…
            </Button>
          )}
        </div>
      </div>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={appliquer}
        aria-label="Filtres"
      >
        <Champ label="N° de dossier">
          <input
            className="w-28 rounded-md border border-slate-300 px-2 py-1"
            inputMode="numeric"
            value={filtres.dossier ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim()
              setFiltres({ ...filtres, dossier: /^\d+$/.test(v) ? Number(v) : undefined })
            }}
          />
        </Champ>
        <Champ label="Départ">
          <input
            type="week"
            className="rounded-md border border-slate-300 px-2 py-1"
            value={
              filtres.depart ??
              (etat.kind === 'ready'
                ? `${String(etat.data.semaine.annee)}-W${String(etat.data.semaine.semaine).padStart(2, '0')}`
                : '')
            }
            onChange={(e) => {
              setFiltres({ ...filtres, depart: e.target.value || undefined })
            }}
          />
        </Champ>
        <Champ label="Atelier">
          <select
            className="rounded-md border border-slate-300 px-2 py-1"
            value={filtres.atelier ?? ''}
            onChange={(e) => {
              setFiltres({
                ...filtres,
                atelier: e.target.value ? Number(e.target.value) : undefined,
              })
            }}
          >
            <option value="">Tous</option>
            {etat.kind === 'ready' &&
              etat.data.ateliers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle} · {a.plateforme}
                </option>
              ))}
          </select>
        </Champ>
        <fieldset className="flex flex-wrap items-end gap-2 text-sm">
          <legend className="text-xs text-slate-600">Statut</legend>
          {STATUTS_UNITE.map((st) => {
            const choisis = (filtres.statut ?? '').split(',').filter(Boolean)
            return (
              <label key={st} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={choisis.includes(st)}
                  onChange={(e) => {
                    const suite = e.target.checked
                      ? [...choisis, st]
                      : choisis.filter((x) => x !== st)
                    setFiltres({
                      ...filtres,
                      statut: suite.length > 0 ? suite.join(',') : undefined,
                    })
                  }}
                />
                {STATUT_UNITE[st].libelle}
              </label>
            )
          })}
        </fieldset>
        {(
          [
            ['destinataire', 'Destinataire'],
            ['annonceur', 'Annonceur'],
            ['afficheur', 'Afficheur'],
          ] as const
        ).map(([k, libelle]) => (
          <Champ key={k} label={libelle}>
            <input
              className="w-32 rounded-md border border-slate-300 px-2 py-1"
              value={filtres[k] ?? ''}
              onChange={(e) => {
                setFiltres({ ...filtres, [k]: e.target.value || undefined })
              }}
            />
          </Champ>
        ))}
        <Champ label="Thème (séparés par des virgules)">
          <input
            className="w-48 rounded-md border border-slate-300 px-2 py-1"
            value={filtres.theme ?? ''}
            onChange={(e) => {
              setFiltres({ ...filtres, theme: e.target.value || undefined })
            }}
          />
        </Champ>
        <Champ label="Trains de">
          <select
            className="rounded-md border border-slate-300 px-2 py-1"
            value={filtres.trainsDe ?? ''}
            onChange={(e) => {
              setFiltres({
                ...filtres,
                trainsDe: e.target.value ? Number(e.target.value) : undefined,
              })
            }}
          >
            <option value="">Tous</option>
            {[1, 2, 3, 4].map((k) => (
              <option key={k} value={k}>
                {k} visuel{k > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </Champ>
        <Button type="submit">Filtrer</Button>
        <p className="flex items-center gap-2 text-xs text-slate-600" aria-label="Légende">
          <Positions
            ligne={{
              positions: (['OK', 'MANQUANT', 'FRACTIONNE'] as const).map((e, i) => ({
                lettre: 'ABC'[i] ?? '',
                faceId: -i - 1,
                contNum: null,
                annonceur: null,
                theme: null,
                repiquage: null,
                etat: e,
                ftType: null,
              })),
            }}
          />
          A reçu · B manquant · C fractionné
        </p>
      </form>

      {etat.kind === 'loading' && <p className="mt-4">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          {etat.data.aFaire.instructions > 0 ? (
            <div
              role="note"
              className="mt-4 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"
            >
              <span>
                <strong>À faire par la Coordination avant l’export du jeudi 14 h</strong> :{' '}
                {etat.data.aFaire.dossiers} dossier(s), {etat.data.aFaire.instructions}{' '}
                instruction(s) pas encore en Instruction OK.
              </span>
              <Button asChild>
                <Link to="/coordination" search={{ pour: 'deroulant' }}>
                  Voir les dossiers
                </Link>
              </Button>
            </div>
          ) : (
            <p
              role="note"
              className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm"
            >
              Rien à faire par la Coordination sur ces dossiers.
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Indicateurs">
            <Tuile titre="Trains à produire" valeur={etat.data.indicateurs.aProduire} />
            <Tuile
              titre="En attente d’affiches"
              valeur={etat.data.indicateurs.enAttente}
              onClick={() => {
                filtrerStatut(['EN_ATTENTE'])
              }}
            />
            <Tuile
              titre="Prêts à produire"
              valeur={etat.data.indicateurs.prets}
              onClick={() => {
                filtrerStatut(['PRET'])
              }}
            />
            <Tuile
              titre="En production"
              valeur={etat.data.indicateurs.enProduction}
              onClick={() => {
                filtrerStatut(['EN_PROD', 'PRODUIT'])
              }}
            />
            <Tuile titre="Colisés ou expédiés" valeur={etat.data.indicateurs.colisesExpedies} />
          </div>

          {tab === 'd8' ? (
            <VueSuivi8m2
              qs={qsDe(search, ['tab', 'statut', 'destinataire', 'afficheur', 'theme', 'trainsDe'])}
              depart={`${String(etat.data.semaine.annee)}-W${String(etat.data.semaine.semaine).padStart(2, '0')}`}
              peutSaisir={peut('suivi_8m2.saisir')}
            />
          ) : tab === 'besoin' ? (
            <>
              {message && (
                <p
                  role="status"
                  className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm"
                >
                  {message}
                </p>
              )}
              <VueBesoin
                qs={qsDe(search, ['tab', 'statut'])}
                depart={`${String(etat.data.semaine.annee)}-W${String(etat.data.semaine.semaine).padStart(2, '0')}`}
                peutPreAssembler={peut('preassemblage.gerer')}
                peutChangerStatut={peut('train.changer_statut')}
                onMessage={(m) => {
                  setMessage(m)
                  recharger()
                }}
              />
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <label>
                  Sélectionner les{' '}
                  <input
                    type="number"
                    min={1}
                    className="w-16 rounded-md border border-slate-300 px-1"
                    value={n}
                    onChange={(e) => {
                      setN(e.target.value)
                    }}
                    aria-label="Nombre de trains"
                  />{' '}
                  premiers trains
                </label>
                <Button
                  type="button"
                  onClick={() => {
                    const r = selectionnerPremiers(
                      [...new Map(lignes.map((l) => [l.cle, l])).values()],
                      Math.max(1, Number(n) || 0),
                    )
                    setSelection(r.cles)
                    setMessage(r.message)
                  }}
                >
                  Sélectionner
                </Button>
                <span className="text-slate-500">
                  {trainsChoisis.length} train(s) sélectionné(s)
                </span>
                <Button
                  type="button"
                  disabled={envoi || trainsChoisis.length === 0 || !peut('train.fractionner')}
                  onClick={() => {
                    void fractionner(trainsChoisis)
                  }}
                >
                  Fractionner
                </Button>
                <Button
                  type="button"
                  disabled={trainsChoisis.length === 0 || !peut('train.fractionner')}
                  onClick={() => {
                    setRaccrocher(trainsChoisis)
                  }}
                >
                  Raccrocher un visuel
                </Button>
                {tab === 'trains' && (
                  <>
                    <Button
                      type="button"
                      disabled={
                        envoi || trainsChoisis.length === 0 || !peut('train.changer_statut')
                      }
                      title="Instruction ok → « A imprimer » (RG-COO-218)"
                      onClick={() => {
                        void changerStatut(trainsChoisis, 'A_IMPRIMER', 'LISTE')
                      }}
                    >
                      Passer à « A imprimer »
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        envoi ||
                        trainsChoisis.length === 0 ||
                        !peut('train.changer_statut') ||
                        !choisis[0]?.atelier
                      }
                      title="« A imprimer » → « Au roulage » (RG-COO-218)"
                      onClick={() => {
                        const a = choisis[0]?.atelier?.id
                        if (a !== undefined)
                          setRouleurPour({ trains: trainsChoisis, atelierId: a, action: 'liste' })
                      }}
                    >
                      Au roulage…
                    </Button>
                  </>
                )}
                {prepa && (
                  <>
                    <Button
                      type="button"
                      disabled={
                        trainsChoisis.length === 0 ||
                        !peut('roulage.preparer') ||
                        !choisis[0]?.atelier
                      }
                      onClick={() => {
                        const a = choisis[0]?.atelier?.id
                        if (a !== undefined)
                          setRouleurPour({
                            trains: trainsChoisis,
                            atelierId: a,
                            action: 'affecter',
                          })
                      }}
                    >
                      Choisir le rouleur…
                    </Button>
                    <Button
                      type="button"
                      disabled={envoi || trainsChoisis.length === 0 || !peut('roulage.preparer')}
                      title="Faces « A imprimer » → « Export prépa » (ateliers de 2 m²)"
                      onClick={() => {
                        void exporterPreparation(trainsChoisis)
                      }}
                    >
                      Export préparation
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        trainsChoisis.length === 0 ||
                        !peut('roulage.preparer') ||
                        !choisis[0]?.atelier
                      }
                      title="Faces « Export prépa » → « Au roulage » (rouleur obligatoire)"
                      onClick={() => {
                        const a = choisis[0]?.atelier?.id
                        if (a !== undefined)
                          setRouleurPour({ trains: trainsChoisis, atelierId: a, action: 'roulage' })
                      }}
                    >
                      Au roulage
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        envoi || trainsChoisis.length === 0 || !peut('train.changer_statut')
                      }
                      title="10 / 5 / 9 → « A imprimer » (RG-COO-218)"
                      onClick={() => {
                        void changerStatut(trainsChoisis, 'A_IMPRIMER', 'PREPARATION')
                      }}
                    >
                      Remettre « A imprimer »
                    </Button>
                    {peut('roulage.preparer') && (
                      <Button asChild>
                        <Link to="/coordination/generateur">Générer les fichiers</Link>
                      </Button>
                    )}
                    <Button
                      type="button"
                      disabled={
                        trainsChoisis.length === 0 ||
                        !peut('bague.imprimer') ||
                        !choisis[0]?.atelier
                      }
                      title="Rouleur obligatoire ; les unités « Prêt à produire » passent « En production » (RG-COO-299)"
                      onClick={() => {
                        const a = choisis[0]?.atelier?.id
                        if (a !== undefined) setBagues({ trains: trainsChoisis, atelierId: a })
                      }}
                    >
                      Imprimer les bagues
                    </Button>
                  </>
                )}
                <label className="ml-auto">
                  <input
                    type="checkbox"
                    checked={colonnes.afficheur}
                    onChange={(e) => {
                      setColonnes({ ...colonnes, afficheur: e.target.checked })
                    }}
                  />{' '}
                  Afficheur
                </label>
                {prepa && (
                  <label>
                    <input
                      type="checkbox"
                      checked={colonnes.atelier}
                      onChange={(e) => {
                        setColonnes({ ...colonnes, atelier: e.target.checked })
                      }}
                    />{' '}
                    Atelier · machine
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={colonnes.bague}
                    onChange={(e) => {
                      setColonnes({ ...colonnes, bague: e.target.checked })
                    }}
                  />{' '}
                  Bague
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={colonnes.fichier}
                    onChange={(e) => {
                      setColonnes({ ...colonnes, fichier: e.target.checked })
                    }}
                  />{' '}
                  Fichier
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={colonnes.modifications}
                    onChange={(e) => {
                      setColonnes({ ...colonnes, modifications: e.target.checked })
                    }}
                  />{' '}
                  Modifications
                </label>
                {peut('suivi_8m2.saisir') && (
                  <label>
                    <input
                      type="checkbox"
                      checked={colonnes.panneau}
                      onChange={(e) => {
                        setColonnes({ ...colonnes, panneau: e.target.checked })
                      }}
                    />{' '}
                    N° panneau BC
                  </label>
                )}
              </div>
              {message && (
                <p
                  role="status"
                  className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm"
                >
                  {message}
                </p>
              )}
              {erreur !== null && <ErrorMessage error={erreur} />}
              {lignes.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Aucun train pour ces critères.</p>
              ) : (
                <>
                  <BoutonExportTableau nom="coordination-trains" tableau="Trains" />
                  <table {...glissement} className="mt-3 w-full text-sm" aria-label="Trains">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="w-8" />
                        <th>Train</th>
                        {!prepa && (
                          <>
                            <th>Face</th>
                            <th>Annonceur</th>
                            <th>Dossier</th>
                            <th>Visuel</th>
                            <th>Repiquage</th>
                            <th>Adresse</th>
                            {tab === 'positions' && <th>Côte à côte</th>}
                          </>
                        )}
                        {(!prepa || colonnes.atelier) && <th>Atelier</th>}
                        {(!prepa || colonnes.atelier) && <th>Machine</th>}
                        <th>Destinataire</th>
                        {prepa && <th>Statut</th>}
                        <th>Positions</th>
                        {prepa &&
                          Array.from({ length: 6 }, (_, i) => (
                            <th key={i}>
                              Position {i + 1} · Annonceur / Dossier / Visuel / Repiquage
                            </th>
                          ))}
                        <th className="text-right">Nb trains</th>
                        {prepa && <th>Pré-assemblage</th>}
                        {prepa && <th>Rouleur</th>}
                        <th>Départ camion</th>
                        {!prepa && <th>Statut</th>}
                        {colonnes.afficheur && <th>Afficheur</th>}
                        {colonnes.fichier && <th>Fichier</th>}
                        {colonnes.bague && <th>Bague</th>}
                        {colonnes.modifications && <th>Modifications</th>}
                        {colonnes.panneau && peut('suivi_8m2.saisir') && <th>N° panneau BC</th>}
                        {prepa && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map((l) => (
                        <tr
                          data-selection-id={l.cle}
                          key={`${l.cle}-${l.faceId ?? 'train'}`}
                          className={`cursor-pointer border-b ${l.statut === 'EN_ATTENTE' ? 'bg-orange-50' : l.statut === 'PRET' && (!prepa || l.rouleur === null) ? 'bg-sky-50' : ''}`}
                          onClick={() => {
                            setFiche(l.cle)
                          }}
                        >
                          <td
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Sélectionner ${l.cle}`}
                              checked={selection.includes(l.cle)}
                              onChange={(e) => {
                                setSelection(
                                  e.target.checked
                                    ? [...new Set([...selection, l.cle])]
                                    : selection.filter((x) => x !== l.cle),
                                )
                              }}
                            />
                          </td>
                          <td className="py-1">
                            {l.cle}{' '}
                            {l.origine === 'PRE_TEST' && <Pastille ton="info">pré-test</Pastille>}
                            {(l.origine === 'ENTRETIEN' || l.origine === 'ENTRETIEN_AJOUTE') && (
                              <Pastille ton="neutre">entretien</Pastille>
                            )}
                            {l.fractionne && <Pastille ton="neutre">Fractionné</Pastille>}
                          </td>
                          {!prepa && (
                            <>
                              <td>{l.panneauxBc?.join(', ') || l.faceId || '—'}</td>
                              <td>{l.positions.map((p) => p.annonceur).join(', ')}</td>
                              <td>{l.positions.map((p) => p.contNum).join(', ')}</td>
                              <td>{l.positions.map((p) => p.theme).join(', ')}</td>
                              <td>{l.positions.map((p) => p.repiquage).join(', ')}</td>
                              <td>{l.adresse ?? '—'}</td>
                              {tab === 'positions' && <td>{l.coteCote ?? '—'}</td>}
                            </>
                          )}
                          {(!prepa || colonnes.atelier) && (
                            <td>
                              {l.atelier ? `${l.atelier.libelle} · ${l.atelier.plateforme}` : '—'}
                            </td>
                          )}
                          {(!prepa || colonnes.atelier) && <td>{l.machine ?? '—'}</td>}
                          <td>{l.destinataire ?? '—'}</td>
                          {prepa && (
                            <td>
                              <Pastille production={l.statut} ton={STATUT_UNITE[l.statut].ton}>
                                {STATUT_UNITE[l.statut].libelle}
                              </Pastille>
                            </td>
                          )}
                          <td>
                            <Positions
                              ligne={l}
                              onClic={(faceId) => {
                                // Maquette « clic = Visuel » : la V2 n'a pas d'image de visuel (ECARTS) ; le clic ouvre la
                                // fiche du train avec la position cliquée mise en évidence.
                                setPosition(faceId)
                              }}
                            />
                          </td>
                          {prepa &&
                            Array.from({ length: 6 }, (_, i) => {
                              const p = l.positions[i]
                              return (
                                <td key={i}>
                                  {p ? (
                                    <>
                                      <p>
                                        {p.annonceur ?? '—'} · {p.contNum ?? '—'}
                                      </p>
                                      <p>
                                        {p.theme ?? '—'} · {p.repiquage ?? '—'}
                                      </p>
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              )
                            })}
                          <td className="text-right">{l.nb}</td>
                          {prepa && <td>{l.preAssemble ? 'Fait' : '—'}</td>}
                          {prepa && <td>{l.rouleur ?? '—'}</td>}
                          <td>{formatDepart(l.depart)}</td>
                          {!prepa && (
                            <td>
                              <Pastille production={l.statut} ton={STATUT_UNITE[l.statut].ton}>
                                {STATUT_UNITE[l.statut].libelle}
                              </Pastille>
                            </td>
                          )}
                          {colonnes.afficheur && <td>{l.afficheur ?? '—'}</td>}
                          {colonnes.fichier && <td>{l.fichier ?? '—'}</td>}
                          {colonnes.bague && (
                            <td>
                              {l.bagues.length > 0
                                ? `Imprimée (n° ${l.bagues.join(', ')})${l.reimpressions > 0 ? ` · réimprimée ${String(l.reimpressions)} fois` : ''}`
                                : '—'}
                            </td>
                          )}
                          {colonnes.modifications && <td>{l.modifications}</td>}
                          {colonnes.panneau && peut('suivi_8m2.saisir') && (
                            <td>{l.panneauxBc?.join(', ') ?? '—'}</td>
                          )}
                          {prepa && (
                            <td>
                              <button
                                type="button"
                                className="underline mr-2"
                                onClick={() => {
                                  setFiche(l.cle)
                                }}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                className="underline"
                                disabled={!peut('roulage.preparer') || !l.atelier}
                                onClick={() => {
                                  if (l.atelier)
                                    setRouleurPour({
                                      trains: l.trains,
                                      atelierId: l.atelier.id,
                                      action: 'affecter',
                                    })
                                }}
                              >
                                Rouleur…
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </>
      )}
      {fiche && (
        <ModaleFicheTrain
          trainId={fiche}
          ligne={lignes.find((l) => l.cle === fiche) ?? null}
          positionActive={position}
          peut={peut}
          envoi={envoi}
          onFractionner={(t) => {
            void fractionner([t])
          }}
          onRaccrocher={(t) => {
            setFiche(null)
            setRaccrocher([t])
          }}
          onFermer={(msg) => {
            setFiche(null)
            if (msg) {
              setMessage(msg)
              recharger()
            }
          }}
        />
      )}
      {raccrocher && (
        <ModaleRaccrocher
          trains={raccrocher}
          onFermer={(msg) => {
            setRaccrocher(null)
            if (msg) {
              setMessage(msg)
              setSelection([])
              recharger()
            }
          }}
        />
      )}
      {exporter && etat.kind === 'ready' && (
        <ModaleExport
          depart={`${String(etat.data.semaine.annee)}-W${String(etat.data.semaine.semaine).padStart(2, '0')}`}
          onFermer={(msg) => {
            setExporter(false)
            if (msg) {
              setMessage(msg)
              recharger()
            }
          }}
        />
      )}
      {rouleurPour && (
        <ModaleRouleur
          trains={rouleurPour.trains}
          atelierId={rouleurPour.atelierId}
          actionLabel={rouleurPour.action === 'affecter' ? 'Affecter' : 'Au roulage'}
          chemin={
            rouleurPour.action === 'affecter'
              ? '/api/coordination/trains/rouleur'
              : rouleurPour.action === 'roulage'
                ? '/api/coordination/trains/au-roulage'
                : '/api/coordination/trains/statut'
          }
          {...(rouleurPour.action === 'liste'
            ? { corpsSupplementaire: { vers: 'AU_ROULAGE', ecran: 'LISTE' } }
            : {})}
          onFermer={(msg) => {
            setRouleurPour(null)
            if (msg) {
              setMessage(msg)
              setSelection([])
              recharger()
            }
          }}
        />
      )}
      {bagues && (
        <ModaleImpressionBagues
          trains={bagues.trains}
          atelierId={bagues.atelierId}
          onFermer={(msg) => {
            setBagues(null)
            if (msg) {
              setMessage(msg)
              setSelection([])
              recharger()
            }
          }}
        />
      )}
      {creer && (
        <ModaleCreerTrain
          onFermer={(msg) => {
            setCreer(false)
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

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col text-sm">
      <span className="text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function Tuile({
  titre,
  valeur,
  onClick,
}: {
  titre: string
  valeur: number
  onClick?: () => void
}) {
  const contenu = (
    <>
      <span className="block text-xs text-slate-500">{titre}</span>
      <span className="text-2xl font-semibold">{valeur}</span>
    </>
  )
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50"
    >
      {contenu}
    </button>
  ) : (
    <div className="rounded-md border border-slate-200 p-3">{contenu}</div>
  )
}

/** ECR-COO-05a fiche train (positions, reçu / attendu, emplacement, modifications tracées, actions). */
function ModaleFicheTrain({
  trainId,
  ligne,
  positionActive,
  peut,
  envoi,
  onFractionner,
  onRaccrocher,
  onFermer,
}: {
  trainId: string
  /** Ligne de la liste (trains identiques regroupés, machine) ; null si la liste a changé. */
  ligne: Pick<LigneTrain, 'nb' | 'machine'> | null
  /** Position cliquée dans la liste (mise en évidence). */
  positionActive: number | null
  peut: (code: Parameters<typeof can>[1]) => boolean
  envoi: boolean
  onFractionner: (t: TrainVersion) => void
  onRaccrocher: (t: TrainVersion) => void
  onFermer: (message: string | null) => void
}) {
  const { etat, recharger } = useApi(`train-${trainId}`, (signal) =>
    apiRequest('GET', `/api/coordination/trains/${encodeURIComponent(trainId)}`, {
      schema: FicheTrainSchema,
      signal,
    }),
  )
  const [supprimer, setSupprimer] = useState(false)
  const [reimprimer, setReimprimer] = useState(false)
  return (
    <Modale
      titre={`Train ${trainId}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' &&
        (() => {
          const t = etat.data
          const enProd = STATUTS_UNITE_EN_PRODUCTION.includes(t.statut)
          const v = { trainId: t.trainId, version: t.version }
          return (
            <div className="text-sm">
              <p className="flex flex-wrap gap-2">
                <Pastille production={t.statut} ton={STATUT_UNITE[t.statut].ton}>
                  {STATUT_UNITE[t.statut].libelle}
                </Pastille>
                {t.atelier && (
                  <Pastille ton="neutre">
                    {t.atelier.libelle} · {t.atelier.plateforme}
                  </Pastille>
                )}
                {t.fractionne && <Pastille ton="neutre">Fractionné</Pastille>}
                {t.origine === 'PRE_TEST' && <Pastille ton="info">pré-test</Pastille>}
                {ligne && ligne.nb > 1 && (
                  <Pastille ton="neutre">{ligne.nb} train(s) identique(s)</Pastille>
                )}
                <Pastille ton="neutre">Machine : {ligne?.machine ?? '—'}</Pastille>
              </p>
              <p className="mt-2">
                {t.destinataire ?? '—'} · {t.afficheur ?? '—'} · départ {formatDepart(t.depart)}
              </p>
              {t.panneauxBc && (
                <p className="text-slate-600">
                  N° de panneaux Broadcast : {t.panneauxBc.join(', ') || '—'}
                </p>
              )}
              <table className="mt-3 w-full" aria-label="Positions du train">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th>Pos.</th>
                    <th>Annonceur</th>
                    <th>Thème</th>
                    <th>Dossier</th>
                    <th>Reçu / attendu</th>
                    <th>État</th>
                    <th>Emplacement des affiches</th>
                  </tr>
                </thead>
                <tbody>
                  {t.positions.map((p) => (
                    <tr
                      key={p.faceId}
                      className={`border-b ${p.faceId === positionActive ? 'bg-yellow-100' : ''}`}
                      aria-current={p.faceId === positionActive ? 'true' : undefined}
                    >
                      <td>{p.lettre}</td>
                      <td>{p.annonceur ?? '—'}</td>
                      <td>{p.theme ?? '—'}</td>
                      <td>{p.contNum ?? '—'}</td>
                      <td>
                        {p.recu} / {p.attendu}
                      </td>
                      <td>
                        {p.etat === 'OK' ? (
                          <Pastille ton="ok">Reçu OK</Pastille>
                        ) : p.etat === 'MANQUANT' ? (
                          <Pastille ton="critique">Manquant</Pastille>
                        ) : (
                          <Pastille ton="neutre">Fractionné</Pastille>
                        )}
                      </td>
                      <td>{p.emplacement ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-slate-600" aria-label="Bague du train">
                {t.bague
                  ? `Bague n° ${String(t.bague.numero)} imprimée${t.bague.rouleur ? ` (rouleur ${t.bague.rouleur})` : ''}${t.bague.reimpressions > 0 ? ` · réimprimée ${String(t.bague.reimpressions)} fois` : ''}${t.bague.modifiee ? ' · textes modifiés' : ''}`
                  : 'Aucune bague imprimée.'}
              </p>
              <h3 className="mt-3 font-medium">Modifications tracées</h3>
              {t.modifications.length === 0 ? (
                <p className="text-slate-500">Aucune modification.</p>
              ) : (
                <ol className="mt-1 space-y-1" aria-label="Modifications tracées">
                  {t.modifications.map((m, i) => (
                    <li key={i} className="text-xs">
                      {new Date(m.le).toLocaleString('fr-FR')} · {m.par ?? '—'} · {m.action}
                      {m.detail ? ` · ${m.detail}` : ''}
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {peut('train.creer_supprimer') && (
                  <Button
                    type="button"
                    className="bg-red-700 hover:bg-red-600"
                    disabled={enProd}
                    title={
                      enProd
                        ? 'Train déjà en production : impossible de le modifier (point de non-retour).'
                        : undefined
                    }
                    onClick={() => {
                      setSupprimer(true)
                    }}
                  >
                    Supprimer…
                  </Button>
                )}
                {t.bague && peut('bague.reimprimer') && (
                  <Button
                    type="button"
                    onClick={() => {
                      setReimprimer(true)
                    }}
                  >
                    Réimprimer la bague {t.bague.numero}…
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={enProd || !peut('train.fractionner')}
                  onClick={() => {
                    onRaccrocher(v)
                  }}
                >
                  Raccrocher un visuel
                </Button>
                <Button
                  type="button"
                  disabled={envoi || t.statut !== 'EN_ATTENTE' || !peut('train.fractionner')}
                  onClick={() => {
                    onFractionner(v)
                  }}
                >
                  Fractionner
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onFermer(null)
                  }}
                >
                  Fermer
                </Button>
              </div>
              {reimprimer && t.bague && (
                <ModaleReimpression
                  trainId={t.trainId}
                  numero={t.bague.numero}
                  version={t.bague.version}
                  onFermer={(msg) => {
                    setReimprimer(false)
                    if (msg) onFermer(msg)
                  }}
                />
              )}
              {supprimer && (
                <ModaleSupprimer
                  trainId={t.trainId}
                  version={t.version}
                  onFermer={(msg) => {
                    setSupprimer(false)
                    if (msg) onFermer(msg)
                  }}
                />
              )}
            </div>
          )
        })()}
    </Modale>
  )
}

/** ECR-COO-05e : motif obligatoire, « Supprimer le train » (danger). */
function ModaleSupprimer({
  trainId,
  version,
  onFermer,
}: {
  trainId: string
  version: string
  onFermer: (message: string | null) => void
}) {
  const [motif, setMotif] = useState<(typeof MOTIFS_SUPPRESSION_TRAIN)[number] | ''>('')
  const [precision, setPrecision] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  async function valider() {
    if (!motif) return
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost(
        `/api/coordination/trains/${encodeURIComponent(trainId)}/suppression`,
        {
          schema: ResultatSimpleSchema,
          body: { version, motif, ...(precision ? { precision } : {}) },
        },
      )
      onFermer(r.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={`Supprimer le train ${trainId}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <label className="block text-sm">
        Motif
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={motif}
          onChange={(e) => {
            setMotif(e.target.value as (typeof MOTIFS_SUPPRESSION_TRAIN)[number])
          }}
        >
          <option value="">Choisir…</option>
          {MOTIFS_SUPPRESSION_TRAIN.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      {motif === 'Autre' && (
        <label className="mt-2 block text-sm">
          Précision
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
            maxLength={200}
            value={precision}
            onChange={(e) => {
              setPrecision(e.target.value)
            }}
          />
        </label>
      )}
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
          className="bg-red-700 hover:bg-red-600"
          disabled={envoi || !motif}
          onClick={() => {
            void valider()
          }}
        >
          Supprimer le train
        </Button>
      </div>
    </Modale>
  )
}

/** ECR-COO-05d : raccrocher un visuel au(x) train(s) choisi(s). */
function ModaleRaccrocher({
  trains,
  onFermer,
}: {
  trains: TrainVersion[]
  onFermer: (message: string | null) => void
}) {
  const premier = trains[0]?.trainId ?? ''
  const { etat, recharger } = useApi(`raccrochables-${premier}`, (signal) =>
    apiRequest(
      'GET',
      `/api/coordination/trains/visuels-raccrochables?train=${encodeURIComponent(premier)}`,
      {
        schema: VisuelsRaccrochablesSchema,
        signal,
      },
    ),
  )
  const [visuel, setVisuel] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  async function valider() {
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost('/api/coordination/trains/raccrocher', {
        schema: ResultatActionTrainsSchema,
        body: { visuelId: Number(visuel), trains },
      })
      onFermer(
        r.message +
          (r.ecartes.length > 0
            ? ` Écartés : ${r.ecartes.map((e) => `${e.trainId} (${e.raison})`).join(', ')}.`
            : ''),
      )
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={
        trains.length > 1
          ? `Raccrocher un visuel à ${String(trains.length)} train(s)`
          : `Raccrocher un visuel au train ${premier}`
      }
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' &&
        (etat.data.visuels.length === 0 ? (
          <p className="text-sm text-slate-600">
            Aucun visuel de la même semaine et du même atelier à raccrocher.
          </p>
        ) : (
          <label className="block text-sm">
            Visuel
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
              value={visuel}
              onChange={(e) => {
                setVisuel(e.target.value)
              }}
            >
              <option value="">Choisir…</option>
              {etat.data.visuels.map((v) => (
                <option key={v.visuelId} value={v.visuelId}>
                  {v.contNum ?? '—'} · {v.annonceur ?? '—'} · {v.theme}
                </option>
              ))}
            </select>
          </label>
        ))}
      <p className="mt-2 text-xs text-slate-600">
        Les trains en production, d’un autre atelier ou départ, complets ou qui ont déjà ce visuel
        sont écartés. {trains.length} train(s) sélectionné(s).
      </p>
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
          disabled={envoi || !visuel}
          onClick={() => {
            void valider()
          }}
        >
          Raccrocher
        </Button>
      </div>
    </Modale>
  )
}

/** ECR-COO-05c : créer un train de pré-test ou d'entretien. */
function ModaleCreerTrain({ onFermer }: { onFermer: (message: string | null) => void }) {
  const [atelier, setAtelier] = useState<number | undefined>(undefined)
  const { etat, recharger } = useApi(`options-train-${String(atelier ?? '')}`, (signal) =>
    apiRequest(
      'GET',
      `/api/coordination/trains/options-creation${atelier ? `?atelier=${String(atelier)}` : ''}`,
      {
        schema: OptionsCreationTrainSchema,
        signal,
      },
    ),
  )
  const [depart, setDepart] = useState('')
  const [type, setType] = useState<'PRE_TEST' | 'ENTRETIEN_AJOUTE'>('PRE_TEST')
  const [nombre, setNombre] = useState(1)
  const [visuel, setVisuel] = useState('')
  const [destinataire, setDestinataire] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const min =
    etat.kind === 'ready'
      ? `${String(etat.data.semaineMin.annee)}-W${String(etat.data.semaineMin.semaine).padStart(2, '0')}`
      : ''
  const atelierChoisi = atelier ?? (etat.kind === 'ready' ? etat.data.ateliers[0]?.id : undefined)
  async function valider() {
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost('/api/coordination/trains', {
        schema: CreerTrainResultatSchema,
        body: {
          atelierId: atelierChoisi,
          depart: depart || min,
          type,
          nombre,
          visuelId: visuel ? Number(visuel) : null,
          destinataireId: destinataire ? Number(destinataire) : null,
        },
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
      titre="Créer un train de pré-test ou d’entretien"
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <div className="grid gap-2 text-sm">
          <Champ label="Atelier">
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={atelierChoisi ?? ''}
              onChange={(e) => {
                setAtelier(Number(e.target.value))
                setVisuel('')
                setDestinataire('')
              }}
            >
              {etat.data.ateliers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle} · {a.plateforme}
                </option>
              ))}
            </select>
          </Champ>
          <Champ label="Départ">
            <input
              type="week"
              min={min}
              className="rounded-md border border-slate-300 px-2 py-1"
              value={depart || min}
              onChange={(e) => {
                setDepart(e.target.value)
              }}
            />
          </Champ>
          <Champ label="Type">
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={type}
              onChange={(e) => {
                setType(e.target.value as 'PRE_TEST' | 'ENTRETIEN_AJOUTE')
              }}
            >
              <option value="PRE_TEST">Pré-test</option>
              <option value="ENTRETIEN_AJOUTE">Entretien</option>
            </select>
          </Champ>
          <Champ label="Nombre de trains">
            <input
              type="number"
              min={1}
              max={9}
              className="w-20 rounded-md border border-slate-300 px-2 py-1"
              value={nombre}
              onChange={(e) => {
                setNombre(Math.min(9, Math.max(1, Number(e.target.value) || 1)))
              }}
            />
          </Champ>
          <Champ label="Visuel">
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={visuel}
              onChange={(e) => {
                setVisuel(e.target.value)
              }}
            >
              <option value="">Choisir…</option>
              {etat.data.visuels.map((v) => (
                <option key={v.visuelId} value={v.visuelId}>
                  {v.contNum ?? '—'} · {v.annonceur ?? '—'} · {v.theme} (S
                  {String(v.semaine.semaine).padStart(2, '0')})
                </option>
              ))}
            </select>
          </Champ>
          <Champ label="Destinataire">
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={destinataire}
              onChange={(e) => {
                setDestinataire(e.target.value)
              }}
            >
              <option value="">Choisir…</option>
              {etat.data.destinataires.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </Champ>
        </div>
      )}
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
          disabled={envoi || etat.kind !== 'ready'}
          onClick={() => {
            void valider()
          }}
        >
          Créer
        </Button>
      </div>
    </Modale>
  )
}
