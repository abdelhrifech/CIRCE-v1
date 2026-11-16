import { BoutonExportTableau } from '../../components/ui/export-tableau.tsx'
import { useSelectionGlissee } from '../../lib/selection-glissee.ts'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  AteliersPerimetreSchema,
  InstructionOkResultatSchema,
  ListeDossiersSchema,
  StatutInstructionChangeSchema,
  STATUTS_PREPARATION,
  type DossierCoordination,
} from '@circe/shared'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { FicheDossierModale } from '../../components/coordination/fiche-dossier.tsx'
import {
  INSTRUCTION,
  PREPARATION,
  libelleInstruction,
  pastilleValidation,
  semaine,
} from '../../components/coordination/libelles.ts'
import { useValiderSelection } from '../../components/coordination/valider-selection.tsx'
import { EtiquettesRack } from '../../components/coordination/etiquettes-rack.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// ECR-COO-01 — « Validation admin et Instruction OK » (socle COO-P01) : une ligne par dossier, statut de
// préparation (RG-COO-063) et instructions (RG-COO-040) ; actions de statut d'instruction (RG-COO-045, 046).
// COO-P02 : filtre « À faire », écart BC / Circé, Instruction OK groupée, fiche dossier (ECR-COO-02).
// COO-P03 : pastille « Validation admin » (RG-COO-019) et son filtre, « Valider la sélection » (RG-COO-010)
// avec confirmation explicite des doutes (ECR-COO-03, RG-COO-012), pré-cochage et « Cocher les cas sûrs »
// (RG-COO-011).

const SearchSchema = z.object({
  dossier: z.coerce.number().int().optional(),
  preparation: z.enum(STATUTS_PREPARATION).optional(),
  atelierId: z.coerce.number().int().optional(),
  /** RG-COO-060 : « À faire (Coordination) » par défaut (maquette) ; « Rien à faire » ; « Tous ». */
  aFaire: z.enum(['A_FAIRE', 'RIEN', 'TOUS']).optional(),
  /** RG-COO-019 : filtre « Validation admin ». */
  // Préréglages par lien de la maquette (`?va=A_FAIRE|FAITE|AUCUNE`) acceptés et traduits.
  va: z.preprocess(
    (v) =>
      ({ A_FAIRE: 'A_CONFIRMER', FAITE: 'VALIDEE', AUCUNE: 'AUCUNE_AFFICHE_RECUE' })[String(v)] ??
      v,
    z.enum(['A_CONFIRMER', 'VALIDEE', 'AUCUNE_AFFICHE_RECUE']).optional(),
  ),
  /** ECR-COO-05 « Voir les dossiers » : dossiers du déroulant seulement. */
  pour: z.enum(['deroulant', 'fixe', 'pliage']).optional(),
  /** ECR-COO-02 : fiche dossier ouverte. */
  fiche: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).optional(),
})
type Search = z.infer<typeof SearchSchema>

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
/** « jeu. 15/10 16h » (heure UTC, comme le calcul de l'API : Q-187 (15)). */
function echeance(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  const m = d.getUTCMinutes()
  return `${JOURS[d.getUTCDay()] ?? ''} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${String(d.getUTCHours())}h${m ? p(m) : ''}`
}

export const Route = createFileRoute('/coordination/')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('instruction.consulter'),
  component: ValidationAdminEtInstructionOk,
})

// RG-COO-009 : info-bulle du bouton désactivé hors coord / admin (maquette « RESERVE »).
const RESERVE = 'Réservé à la Coordination (rôles Coordination et administrateur).'

const ACTION: Record<'A_TRAITER' | 'EN_COURS' | 'ANNULE', string> = {
  ANNULE: 'Annuler',
  A_TRAITER: 'Remettre à traiter',
  EN_COURS: 'Repasser en cours',
}

function query(s: Search) {
  const p = new URLSearchParams()
  for (const k of ['dossier', 'preparation', 'atelierId', 'va', 'page'] as const) {
    if (s[k] !== undefined) p.set(k, String(s[k]))
  }
  const aFaire = s.aFaire ?? 'A_FAIRE'
  if (aFaire !== 'TOUS') p.set('aFaire', aFaire)
  if (s.pour || s.dossier === undefined) p.set('pour', (s.pour ?? 'deroulant').toUpperCase())
  return p.toString()
}

type Demande = {
  code: string
  version: number
  vers: 'A_TRAITER' | 'EN_COURS' | 'ANNULE'
  depuis: string
  dossier: number
}

function ValidationAdminEtInstructionOk() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const q = query(search)
  const { etat, recharger } = useApi(`coo-dossiers?${q}`, (signal) =>
    apiRequest('GET', `/api/coordination/dossiers${q ? `?${q}` : ''}`, {
      schema: ListeDossiersSchema,
      signal,
    }),
  )
  const [demande, setDemande] = useState<Demande | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const changer = (p: Partial<Search>) => {
    // RG-COO-011 : le pré-cochage ne se refait pas à chaque changement de filtre (sélection figée).
    if (etat.kind === 'ready' && moi.kind === 'ready') setSelection(selection)
    void navigate({
      search: (prev) => ({ ...prev, ...p, page: p.page ?? undefined }),
      replace: true,
    })
  }
  // RG-COO-167 : ateliers du périmètre de l'utilisateur (pas seulement ceux de la page chargée).
  const { etat: refAteliers } = useApi('coo-ateliers', (signal) =>
    apiRequest('GET', '/api/coordination/ateliers', { schema: AteliersPerimetreSchema, signal }),
  )
  const ateliers = refAteliers.kind === 'ready' ? refAteliers.data.ateliers : []
  const [saisieInvalide, setSaisieInvalide] = useState(false)
  const [colVisuels, setColVisuels] = useState(false)
  // RG-COO-044 / 051 / RG-COO-010 : sélection de dossiers (Instruction OK groupée, « Valider la sélection »).
  // RG-COO-011 : tant que l'utilisateur n'a rien choisi (null), les cas sûrs de l'arrivée sont pré-cochés
  // pour coord / admin.
  const [selectionChoisie, setSelection] = useState<number[] | null>(null)
  const [erreurIok, setErreurIok] = useState<unknown>(null)
  const [envoiIok, setEnvoiIok] = useState(false)
  const items = etat.kind === 'ready' ? etat.data.items : []
  // RG-COO-009 : bouton désactivé hors coord / admin (confort ; le serveur reste juge).
  const { etat: moi } = useApi('moi', () => getMe())
  const peutValider = moi.kind === 'ready' && can(moi.data, 'validation_admin.valider')
  const casSurs = items.filter((d) => d.validationAdmin.casSur)
  const selection = selectionChoisie ?? (peutValider ? casSurs.map((d) => d.id) : [])
  const glissement = useSelectionGlissee(
    items
      .filter(
        (d) =>
          d.instructions.some((i) => i.actions.includes('INSTRUCTION_OK')) ||
          d.validationAdmin.aConfirmer > 0,
      )
      .map((d) => d.id),
    selection,
    setSelection,
  )
  const aValider = items
    .filter((d) => selection.includes(d.id))
    .flatMap((d) => d.instructions.filter((i) => i.actions.includes('INSTRUCTION_OK')))
  // RG-COO-023 : les étiquettes rack à imprimer sont relues après chaque validation.
  const [maj, setMaj] = useState(0)
  const validation = useValiderSelection((m) => {
    setMessage(m)
    setSelection([])
    setMaj((x) => x + 1)
    recharger()
  })
  async function instructionOkGroupee() {
    setErreurIok(null)
    setEnvoiIok(true)
    try {
      const r = await apiPost('/api/coordination/instruction-ok', {
        schema: InstructionOkResultatSchema,
        body: { instructions: aValider.map((i) => ({ code: i.code, version: i.version })) },
      })
      setMessage(r.message)
      setSelection([])
      recharger()
    } catch (e) {
      setErreurIok(e)
    } finally {
      setEnvoiIok(false)
    }
  }
  const champ = 'ml-1 rounded-md border border-slate-300 px-2 py-1 text-sm'
  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">
        {(search.pour ?? 'deroulant') === 'deroulant'
          ? 'Déroulant'
          : search.pour === 'fixe'
            ? '2 m² fixe'
            : 'Pliage'}
      </p>
      <h1 className="text-2xl font-semibold">
        {(search.pour ?? 'deroulant') === 'deroulant' ? 'Liste des instructions' : 'À traiter'}
      </h1>
      <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm" role="note">
        <strong>Aucune validation sans vous : Circé propose, vous confirmez.</strong> À la réception
        d’une affiche, Circé propose son rattachement au dossier, sans attendre la préparation ni
        l’Instruction OK. Les cas sûrs sont pré-cochés : « Valider la sélection » confirme le lot en
        un clic. Les cas à doute ne sont jamais pré-cochés : le motif s’affiche dans la fiche du
        dossier, et la validation demande une confirmation explicite.
      </p>
      {moi.kind === 'ready' && (peutValider || can(moi.data, 'reception.imprimer')) && (
        <EtiquettesRack cle={maj} />
      )}
      <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
        <label>
          N° de dossier
          <input
            className={`${champ} w-28`}
            defaultValue={search.dossier ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = e.currentTarget.value.trim()
                // Un n° de dossier est numérique : une autre saisie n'est pas envoyée.
                const invalide = v !== '' && !/^\d+$/.test(v)
                setSaisieInvalide(invalide)
                if (!invalide) changer({ dossier: v ? Number(v) : undefined })
              }
            }}
          />
          {saisieInvalide && (
            <span role="alert" className="ml-2 text-xs text-red-700">
              Un n° de dossier ne contient que des chiffres.
            </span>
          )}
        </label>
        <label>
          Atelier
          <select
            className={champ}
            value={search.atelierId ?? ''}
            onChange={(e) => {
              changer({ atelierId: e.target.value ? Number(e.target.value) : undefined })
            }}
          >
            <option value="">
              {refAteliers.kind === 'loading'
                ? 'Chargement des ateliers…'
                : refAteliers.kind === 'error'
                  ? 'Ateliers indisponibles'
                  : 'Tous'}
            </option>
            {ateliers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.libelle} · {a.plateforme}
              </option>
            ))}
          </select>
        </label>
        <label>
          À faire (Coordination)
          <select
            className={champ}
            value={search.aFaire ?? 'A_FAIRE'}
            onChange={(e) => {
              changer({ aFaire: e.target.value as Search['aFaire'] })
            }}
          >
            <option value="A_FAIRE">À faire</option>
            <option value="RIEN">Rien à faire</option>
            <option value="TOUS">Tous</option>
          </select>
        </label>
        <label>
          Préparation
          <select
            className={champ}
            value={search.preparation ?? ''}
            onChange={(e) => {
              changer({
                preparation: (e.target.value || undefined) as Search['preparation'],
              })
            }}
          >
            <option value="">Toutes</option>
            {STATUTS_PREPARATION.map((s) => (
              <option key={s} value={s}>
                {PREPARATION[s]?.libelle}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="underline"
          onClick={() => {
            void navigate({ search: {}, replace: true })
          }}
        >
          Effacer les filtres
        </button>
        <label>
          Validation admin
          <select
            className={champ}
            value={search.va ?? ''}
            onChange={(e) => {
              changer({ va: (e.target.value || undefined) as Search['va'] })
            }}
          >
            <option value="">Toutes</option>
            <option value="A_CONFIRMER">À confirmer</option>
            <option value="VALIDEE">Validée</option>
            <option value="AUCUNE_AFFICHE_RECUE">Aucune affiche reçue</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span title={peutValider ? undefined : RESERVE}>
          <Button
            type="button"
            disabled={!peutValider || validation.envoi || selection.length === 0}
            onClick={() => {
              // RG-COO-013 : le serveur juge (refus « Rien à valider » si aucune affiche à confirmer).
              setMessage(null)
              void validation.valider(selection)
            }}
          >
            Valider la sélection
            {selection.length ? ` (${String(selection.length)} dossier(s))` : ''}
          </Button>
        </span>
        {aValider.length > 0 && (
          <Button disabled={envoiIok} type="button" onClick={() => void instructionOkGroupee()}>
            Instruction OK (après contrôle) ({aValider.length})
          </Button>
        )}
        {peutValider && etat.kind === 'ready' && etat.data.casSurs > 0 && (
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            title="Dossiers dont il ne reste que des rattachements proposés sans doute : « Valider la sélection » les confirme en un clic"
            onClick={() => {
              setSelection(casSurs.map((d) => d.id))
            }}
          >
            Cocher les cas sûrs ({etat.data.casSurs})
          </button>
        )}
      </div>
      {validation.erreur !== null && (
        <div className="mt-2">
          <ErrorMessage error={validation.erreur} />
        </div>
      )}
      {validation.modale}
      {erreurIok !== null && (
        <div className="mt-2">
          <ErrorMessage error={erreurIok} />
        </div>
      )}
      {message && (
        <p
          role="status"
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm"
        >
          {message}
        </p>
      )}
      {/* ECR-COO-01 : colonne masquée « Visuels » (nb de thèmes, thème proche, modifié dans BC). */}
      <label className="mt-3 inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={colVisuels}
          onChange={(e) => {
            setColVisuels(e.target.checked)
          }}
        />
        Afficher la colonne « Visuels »
      </label>
      <section className="mt-4 rounded-lg border border-slate-200 bg-white">
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {etat.kind === 'ready' && etat.data.items.length === 0 && (
          <p className="p-3 text-sm text-slate-600">Aucune ligne pour ces filtres.</p>
        )}
        {etat.kind === 'ready' && etat.data.items.length > 0 && (
          <>
            <BoutonExportTableau nom="coordination-index" tableau="Dossiers" />
            <table {...glissement} className="w-full text-sm" aria-label="Dossiers">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Sélection</span>
                  </th>
                  {[
                    'Dossier',
                    'Annonceur',
                    'Atelier',
                    'Départ',
                    'Validation admin',
                    'Préparation',
                    ...((search.pour ?? 'deroulant') === 'deroulant' ? ['Instruction OK'] : []),
                    'Écart BC / Circé',
                    ...(colVisuels ? ['Visuels'] : []),
                  ].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {etat.data.items.map((d) => (
                  <LigneDossier
                    key={d.id}
                    d={d}
                    selectionnee={selection.includes(d.id)}
                    onSelection={(oui) => {
                      setSelection(oui ? [...selection, d.id] : selection.filter((x) => x !== d.id))
                    }}
                    onFiche={() => {
                      changer({ fiche: d.id, page: search.page })
                    }}
                    onDemande={setDemande}
                    avecVisuels={colVisuels}
                    avecInstructionOk={(search.pour ?? 'deroulant') === 'deroulant'}
                  />
                ))}
              </tbody>
            </table>
          </>
        )}
        {etat.kind === 'ready' && etat.data.total > etat.data.pageSize && (
          <div className="flex justify-between p-3 text-sm">
            <span>{etat.data.total} dossier(s)</span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={etat.data.page <= 1}
                onClick={() => {
                  changer({ page: etat.data.page - 1 })
                }}
              >
                Précédente
              </button>
              <button
                type="button"
                disabled={etat.data.page * etat.data.pageSize >= etat.data.total}
                onClick={() => {
                  changer({ page: etat.data.page + 1 })
                }}
              >
                Suivante
              </button>
            </span>
          </div>
        )}
      </section>
      {search.fiche !== undefined && (
        <FicheDossierModale
          dossierId={search.fiche}
          onFermer={(modifie) => {
            changer({ fiche: undefined, page: search.page })
            if (modifie) {
              setMaj((x) => x + 1)
              recharger()
            }
          }}
        />
      )}
      {demande && (
        <ConfirmerStatut
          demande={demande}
          onFermer={(m) => {
            setDemande(null)
            if (m) {
              setMessage(m)
              recharger()
            }
          }}
        />
      )}
    </main>
  )
}

function LigneDossier({
  d,
  selectionnee,
  onSelection,
  onFiche,
  onDemande,
  avecVisuels,
  avecInstructionOk,
}: {
  d: DossierCoordination
  selectionnee: boolean
  onSelection: (oui: boolean) => void
  onFiche: () => void
  onDemande: (x: Demande) => void
  avecVisuels: boolean
  avecInstructionOk: boolean
}) {
  const prep = PREPARATION[d.preparation]
  const selectionnable =
    d.instructions.some((i) => i.actions.includes('INSTRUCTION_OK')) ||
    d.validationAdmin.aConfirmer > 0
  const va = pastilleValidation(d.validationAdmin)
  return (
    <tr
      data-selection-id={selectionnable ? d.id : undefined}
      className={`border-t border-slate-100 align-top ${(d.ecart !== null && d.ecart !== 0) || d.deadlineDepassee ? 'bg-red-50' : d.aFaire ? 'bg-amber-50' : d.validationAdmin.etat === 'VALIDEE' ? 'bg-emerald-50' : ''}`}
    >
      <td className="px-3 py-2">
        {selectionnable && (
          <input
            type="checkbox"
            aria-label={`Sélectionner le dossier ${String(d.dossier)}`}
            checked={selectionnee}
            onChange={(e) => {
              onSelection(e.target.checked)
            }}
          />
        )}
      </td>
      <td className="px-3 py-2 font-mono">
        <button
          type="button"
          className="underline"
          aria-label={`Ouvrir le dossier ${String(d.dossier)}`}
          onClick={onFiche}
        >
          {d.dossier}
        </button>
      </td>
      <td className="px-3 py-2">{d.annonceur ?? '—'}</td>
      <td className="px-3 py-2">
        {[
          ...new Set(
            d.instructions.map((i) =>
              i.atelier ? `${i.atelier.libelle} · ${i.atelier.plateforme}` : '—',
            ),
          ),
        ].join(', ') || '—'}
      </td>
      <td className="px-3 py-2">{d.departs.map(semaine).join('+') || '—'}</td>
      <td className="px-3 py-2">
        {d.validationAdmin.etat === 'SANS_OBJET' ? (
          '—'
        ) : (
          <Pastille ton={va.ton}>{va.libelle}</Pastille>
        )}
      </td>
      <td className="px-3 py-2">
        {/* RG-COO-066 / 076 : « Pas encore envoyée · deadline jeu. 15/10 16h » (Critique si dépassée). */}
        <Pastille ton={d.deadlineDepassee ? 'critique' : (prep?.ton ?? 'neutre')}>
          {prep?.libelle ?? d.preparation}
          {d.deadlinePrepa && ` · deadline ${echeance(d.deadlinePrepa)}`}
        </Pastille>
      </td>
      {avecInstructionOk && (
        <td className="px-3 py-2">
          {d.preparation === 'ANNULE' ? (
            // RG-COO-062 : dossier annulé → « — ».
            '—'
          ) : d.instructions.length === 0 ? (
            '—'
          ) : (
            <ul className="space-y-1" aria-label={`Instructions du dossier ${String(d.dossier)}`}>
              {d.instructions.map((i) => (
                <li key={i.code} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{i.code}</span>
                  {i.depart && <span className="text-xs text-slate-500">{semaine(i.depart)}</span>}
                  <Pastille ton={INSTRUCTION[i.statut]?.ton ?? 'neutre'}>
                    {libelleInstruction(i, d.preparation)}
                  </Pastille>
                  {i.actions
                    .filter((a): a is Demande['vers'] => a !== 'INSTRUCTION_OK')
                    .map((a) => (
                      <button
                        key={a}
                        type="button"
                        className="text-xs underline"
                        onClick={() => {
                          onDemande({
                            code: i.code,
                            version: i.version,
                            vers: a,
                            depuis: i.statut,
                            dossier: d.dossier,
                          })
                        }}
                      >
                        {ACTION[a]}
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </td>
      )}
      <td className="px-3 py-2">
        {d.ecart === null ? (
          '—'
        ) : d.ecart === 0 ? (
          '0'
        ) : (
          <Pastille ton="critique">
            {d.ecart > 0 ? `+${String(d.ecart)}` : String(d.ecart)}
          </Pastille>
        )}
      </td>
      {avecVisuels && (
        <td className="px-3 py-2">
          {d.pastillesVisuels.nb}{' '}
          {d.pastillesVisuels.procheAVerifier && <Pastille ton="surveiller">thème proche</Pastille>}{' '}
          {d.pastillesVisuels.modifieBroadcast && (
            <Pastille ton="important">modifié dans BC</Pastille>
          )}
        </td>
      )}
    </tr>
  )
}

/** Confirmation : RG-COO-046 prévient de l'effacement du calcul des trains en sortie d'Instruction OK. */
function ConfirmerStatut({
  demande,
  onFermer,
}: {
  demande: Demande
  onFermer: (message: string | null) => void
}) {
  const [envoi, setEnvoi] = useState<
    { kind: 'repos' | 'en-cours' } | { kind: 'erreur'; error: unknown }
  >({ kind: 'repos' })
  async function confirmer() {
    setEnvoi({ kind: 'en-cours' })
    try {
      const r = await apiPost(
        `/api/coordination/instructions/${encodeURIComponent(demande.code)}/statut`,
        {
          schema: StatutInstructionChangeSchema,
          body: { version: demande.version, vers: demande.vers },
        },
      )
      onFermer(r.message)
    } catch (error) {
      setEnvoi({ kind: 'erreur', error })
    }
  }
  return (
    <Modale
      titre={`${ACTION[demande.vers]} l’instruction ${demande.code}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <p className="text-sm">
        Dossier {demande.dossier} : {INSTRUCTION[demande.depuis]?.libelle ?? demande.depuis} →{' '}
        {INSTRUCTION[demande.vers]?.libelle ?? demande.vers}.
      </p>
      {demande.depuis === 'INSTRUCTION_OK' && (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm" role="note">
          Le calcul des trains de cette instruction sera effacé (les faces déjà « à imprimer » sont
          conservées).
        </p>
      )}
      {envoi.kind === 'erreur' && (
        <div className="mt-2">
          <ErrorMessage error={envoi.error} />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            onFermer(null)
          }}
        >
          Annuler
        </button>
        <Button type="button" disabled={envoi.kind === 'en-cours'} onClick={() => void confirmer()}>
          Confirmer
        </Button>
      </div>
    </Modale>
  )
}
