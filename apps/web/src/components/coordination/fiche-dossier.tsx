import {
  ReprendreThemeBroadcastResultatSchema,
  FicheDossierSchema,
  InstructionModifieeSchema,
  InstructionOkResultatSchema,
  ValidationAfficheResultatSchema,
  VersionBroadcastResultatSchema,
  type FicheDossier,
} from '@circe/shared'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { apiPatch, apiPost, apiRequest } from '../../lib/api-client.ts'
import { can, getMe } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
import { Pastille } from '../ui/pastille.tsx'
import {
  ACTION_HISTORIQUE,
  ETAT_VALIDATION,
  INSTRUCTION,
  MOTIF_DOUTE,
  PREPARATION,
  POSITION,
  libelleInstruction,
  pastilleValidation,
  semaine,
} from './libelles.ts'
import { ModaleCorrection } from './modale-correction.tsx'
import { useValiderSelection } from './valider-selection.tsx'

/** RG-COO-009 : info-bulle de la maquette (reformulée : pas de choix du rôle en haut de page, Q-186 (10)). */
const RESERVE_COORDINATION =
  'Réservé à la Coordination : la validation admin est faite par les rôles Coordination et administrateur.'

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * ECR-COO-02 — fiche dossier (COO-P02) : Instruction OK, écart et version Broadcast, demande de correction,
 * saisie entretien / position. COO-P03 : pastille et tableau « Affiches reçues et validation admin »
 * (RG-COO-006 / 007 / 019), bouton « Valider (n affiches) » (RG-COO-010 / 012, modale ECR-COO-03).
 */
export function FicheDossierModale({
  dossierId,
  onFermer,
}: {
  dossierId: number
  onFermer: (modifie: boolean) => void
}) {
  const [essai, setEssai] = useState(0)
  const [modifie, setModifie] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { etat, recharger } = useApi(
    `fiche-dossier-${String(dossierId)}-${String(essai)}`,
    (signal) =>
      apiRequest('GET', `/api/coordination/dossiers/${String(dossierId)}`, {
        schema: FicheDossierSchema,
        signal,
      }),
  )
  const apresAction = (m: string) => {
    setModifie(true)
    setMessage(m)
    setEssai((e) => e + 1)
  }
  const titre =
    etat.kind === 'ready'
      ? `${etat.data.annonceur ?? '—'} · dossier ${String(etat.data.dossier)}`
      : 'Dossier'
  return (
    <Modale
      titre={titre}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer(modifie)
      }}
    >
      {message && (
        <p
          role="status"
          className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm"
        >
          {message}
        </p>
      )}
      {etat.kind === 'loading' && <p className="text-sm text-slate-500">Chargement de la fiche…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <Contenu
          f={etat.data}
          onAction={apresAction}
          onFermer={() => {
            onFermer(modifie)
          }}
        />
      )}
    </Modale>
  )
}

function Contenu({
  f,
  onAction,
  onFermer,
}: {
  f: FicheDossier
  onAction: (m: string) => void
  onFermer: () => void
}) {
  const { etat: moi } = useApi('moi', () => getMe())
  const peut = (code: Parameters<typeof can>[1]) => moi.kind === 'ready' && can(moi.data, code)
  const [erreur, setErreur] = useState<unknown>(null)
  const [correction, setCorrection] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const enCours = f.instructions.filter((i) => i.actions.includes('INSTRUCTION_OK'))
  const va = pastilleValidation(f.validationAdmin)
  const validation = useValiderSelection(onAction)
  const nonRecues = f.lignes.filter((l) => l.affichesRecues === 0 && !l.exclu)

  async function instructionOk() {
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost('/api/coordination/instruction-ok', {
        schema: InstructionOkResultatSchema,
        body: { instructions: enCours.map((i) => ({ code: i.code, version: i.version })) },
      })
      onAction(r.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  // RG-COO-008 / RG-COO-014 : confirmation unitaire ou annulation (Idempotency-Key, version de l'affiche).
  async function basculer(afficheId: number, version: number, valider: boolean) {
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost(`/api/coordination/affiches/${String(afficheId)}/validation-admin`, {
        schema: ValidationAfficheResultatSchema,
        body: { version, valider },
      })
      onAction(r.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  // RG-COO-068 : « Reprendre la version Broadcast » (thème de Circé aligné, feuille de stock à refaire).
  async function reprendreThemes() {
    setEnvoi(true)
    setErreur(null)
    try {
      // Une seule requête : toutes les lignes du dossier sont reprises dans une transaction (tout ou rien).
      const r = await apiPost('/api/coordination/themes/broadcast/reprendre-dossier', {
        schema: ReprendreThemeBroadcastResultatSchema,
        body: {
          contNum: f.dossier,
          lignes: f.themesModifies.map((t) => ({
            ligneAttendueId: t.ligneAttendueId,
            version: t.version,
          })),
        },
      })
      onAction(r.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  async function versionBroadcast() {
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost(`/api/coordination/dossiers/${String(f.id)}/version-broadcast`, {
        schema: VersionBroadcastResultatSchema,
        body: { version: f.version },
      })
      onAction(r.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="text-sm">
      <div className="flex flex-wrap gap-1">
        {f.validationAdmin.etat !== 'SANS_OBJET' && (
          <Pastille ton={va.ton}>Validation admin : {va.libelle}</Pastille>
        )}
        <Pastille ton={PREPARATION[f.preparation]?.ton ?? 'neutre'}>
          Préparation : {PREPARATION[f.preparation]?.libelle ?? f.preparation}
        </Pastille>
        {[
          ...new Set(
            f.instructions
              .map((i) => (i.atelier ? `${i.atelier.libelle} · ${i.atelier.plateforme}` : null))
              .filter(Boolean),
          ),
        ].map((a) => (
          <Pastille key={a} ton="neutre">
            {a}
          </Pastille>
        ))}
        {f.departs.length > 0 && (
          <Pastille ton="neutre">{f.departs.map(semaine).join('+')}</Pastille>
        )}
      </div>
      {f.validationAdmin.etat === 'A_CONFIRMER' && (
        <p
          className={`mt-2 rounded-md border p-2 ${f.validationAdmin.doutes ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}
          role="note"
        >
          Validation admin à confirmer : {f.validationAdmin.aConfirmer} affiche(s) reçue(s), avant
          même la préparation. Voir le tableau « Affiches reçues et validation admin », puis «
          Valider ».
        </p>
      )}
      {f.aReRattacher.length > 0 && (
        // RG-COO-032 : ligne annulée après la réception : le lien est gardé, une personne re-rattache.
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2" role="note">
          Ligne annulée après la réception : affiche(s){' '}
          {f.aReRattacher.map((x) => `${String(x.afficheId)} (${x.theme ?? '—'})`).join(', ')} à
          re-rattacher (le lien est conservé tant qu’une personne ne l’a pas déplacé).
        </p>
      )}
      {f.themesModifies.length > 0 && (
        // ECR-COO-02 / RG-COO-068 : critique si la production est lancée, avertissement sinon.
        <div
          className={`mt-2 rounded-md border p-2 ${f.themesModifies.some((t) => t.productionLancee) ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}
          role="note"
        >
          <strong>Thème modifié dans Broadcast après la validation</strong>{' '}
          {f.themesModifies
            .map(
              (t) =>
                `Broadcast indique « ${t.themeBroadcast ?? '—'} », Circé a « ${t.themeCirce ?? '—'} »`,
            )
            .join(' ; ')}
          {f.themesModifies.some((t) => t.productionLancee)
            ? '. Production lancée : l’atelier est à prévenir.'
            : '.'}
          {peut('broadcast.version.appliquer') && (
            <Button
              type="button"
              className="ml-2"
              disabled={envoi}
              onClick={() => void reprendreThemes()}
            >
              Reprendre la version Broadcast
            </Button>
          )}
        </div>
      )}
      {f.themesProches.length > 0 && (
        // ECR-COO-02 / RG-COO-069 : thème proche à vérifier avant de valider.
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2" role="note">
          <strong>Thème proche à vérifier avant de valider</strong>{' '}
          {f.themesProches
            .map(
              (g) =>
                g.libelles.map((l) => `« ${l} »`).join(' / ') +
                (g.autresDossiers.length
                  ? ` (dossiers ${g.autresDossiers.join(', ')})`
                  : ' (dans ce dossier)'),
            )
            .join(' ; ')}
          . Même visuel ? Demander la correction dans Broadcast.{' '}
          {peut('verification_themes.consulter') ? (
            <Link
              className="ml-2 rounded-md bg-sky-700 px-2 py-1 text-xs text-white"
              to="/coordination/themes"
              search={{ dossier: f.dossier }}
            >
              Vérifier les thèmes
            </Link>
          ) : (
            <Button
              type="button"
              className="ml-2"
              disabled
              title="Réservé à la Coordination : la vérification des thèmes est faite par les rôles Coordination et administrateur."
            >
              Vérifier les thèmes
            </Button>
          )}
        </div>
      )}
      {f.ecart !== null && f.ecart !== 0 && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2" role="note">
          <strong>
            Écart Broadcast / Circé : {f.ecart > 0 ? '+' : ''}
            {f.ecart}
          </strong>{' '}
          — annule et remplace : la quantité Broadcast devient la quantité Circé.
          {peut('broadcast.version.appliquer') && (
            <Button
              type="button"
              className="ml-2"
              disabled={envoi}
              onClick={() => void versionBroadcast()}
            >
              Appliquer la version Broadcast
            </Button>
          )}
        </div>
      )}
      {f.correctionDemandeeLe && (
        <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2">
          Correction demandée à Broadcast le{' '}
          {new Date(f.correctionDemandeeLe).toLocaleString('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
          .
        </p>
      )}
      <h3 className="mt-3 font-medium">Instructions</h3>
      {f.instructions.length === 0 ? (
        <p className="text-slate-600">Aucune instruction reçue.</p>
      ) : (
        <ul className="space-y-2">
          {f.instructions.map((i) => (
            <li key={i.code} className="rounded-md border border-slate-200 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{i.code}</span>
                {i.depart && <span className="text-xs text-slate-500">{semaine(i.depart)}</span>}
                <Pastille ton={INSTRUCTION[i.statut]?.ton ?? 'neutre'}>
                  {libelleInstruction(i, f.preparation)}
                </Pastille>
              </div>
              {i.commentaire && (
                <p className="mt-1 text-slate-600">Commentaire de prépa : {i.commentaire}</p>
              )}
              <Saisie
                instruction={i}
                // RG-COO-052 : prépa non reçue (état ATTENTE) → saisie non modifiable.
                peutModifier={peut('instruction.modifier') && f.preparation === 'PREPARATION_RECUE'}
                onAction={onAction}
                onErreur={setErreur}
              />
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-3 font-medium">Visuels et répartition</h3>
      {f.visuels.length === 0 ? (
        <p className="text-slate-600">Aucun visuel.</p>
      ) : (
        <table className="w-full" aria-label="Visuels">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {['Instruction', 'Thème', 'Répartition', 'Broadcast'].map((h) => (
                <th key={h} scope="col" className="px-2 py-1 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.visuels.map((v, k) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono text-xs">{v.instruction}</td>
                <td className="px-2 py-1">{v.theme ?? '—'}</td>
                <td className="px-2 py-1">{v.pourcentage ?? '—'} %</td>
                <td className="px-2 py-1">{v.pourcentageBroadcast ?? '—'} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3 className="mt-3 font-medium">Lignes attendues</h3>
      {f.lignes.length === 0 ? (
        <p className="text-slate-600">Aucune ligne attendue.</p>
      ) : (
        <table className="w-full" aria-label="Lignes attendues">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                'Thème',
                'Format',
                'Départ',
                'Quantité Broadcast',
                'Quantité Circé',
                'Traitement',
                'N° d’affiche',
              ].map((h) => (
                <th key={h} scope="col" className="px-2 py-1 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.lignes.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-2 py-1">{l.theme ?? '(IP non saisies)'}</td>
                <td className="px-2 py-1">{l.format ?? '—'}</td>
                <td className="px-2 py-1">{semaine(l.depart)}</td>
                <td className="px-2 py-1">{l.qteBc ?? '—'}</td>
                <td className="px-2 py-1">{l.qtePrepa ?? '—'}</td>
                <td className="px-2 py-1">
                  {l.exclu ? (
                    <Pastille ton="neutre">Ne pas afficher / Reste en place (Broadcast)</Pastille>
                  ) : (
                    'À produire'
                  )}
                  {l.etatLigne === 'ANNULEE' && <Pastille ton="important">Ligne annulée</Pastille>}
                </td>
                <td className="px-2 py-1">
                  {/* RG-COO-026 : « • » proposée dès la réception, « ✓ » validée (état des réservations). */}
                  {l.affiches.length === 0
                    ? '—'
                    : l.affiches.map((x) => `${String(x.id)} ${x.marque}`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3 className="mt-3 font-medium">Affiches reçues et validation admin</h3>
      {/* ECR-COO-02 (maquette `affichesVA`) : texte d'état sous le titre. */}
      <p className="text-xs text-slate-600">
        {f.validationAdmin.aConfirmer > 0
          ? `${String(f.validationAdmin.aConfirmer)} affiche(s) à confirmer par la Coordination : rattachement proposé par Circé à la réception${f.validationAdmin.doutes ? `, dont ${String(f.validationAdmin.doutes)} avec un doute (motif sous l’état : à vérifier avant de valider)` : ', sans doute'}. Aucune validation sans vous.`
          : f.affiches.length > 0
            ? 'Toutes les affiches reçues sont confirmées. Une affiche qui arrive ensuite est proposée à sa réception, puis confirmée par la Coordination.'
            : `Aucune affiche reçue : Circé proposera le rattachement dès la réception, sans attendre la préparation${f.preparation === 'A_TRAITER' ? ' (elle n’est pas encore reçue)' : ''}.`}
      </p>
      {f.affiches.length === 0 && nonRecues.length === 0 ? null : (
        <table className="w-full" aria-label="Affiches reçues et validation admin">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                'N° d’affiche',
                'Thème (quantité)',
                'Reçue',
                'Validation admin',
                'Emplacement',
                'Action',
              ].map((h) => (
                <th key={h} scope="col" className="px-2 py-1 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.affiches.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 align-top">
                <td className="px-2 py-1 font-mono">{a.id}</td>
                <td className="px-2 py-1">
                  {a.themes.map((t, k) => (
                    <div key={k}>
                      {t.theme ?? '(IP non saisies)'} ({t.quantite})
                    </div>
                  ))}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{a.quantiteRecue}</td>
                <td className="px-2 py-1">
                  {/* Maquette : « · reçue le … » pour une affiche à confirmer ; « (nom, date) » validée. */}
                  <Pastille ton={ETAT_VALIDATION[a.etat]?.ton ?? 'neutre'}>
                    {ETAT_VALIDATION[a.etat]?.libelle ?? a.etat}
                    {a.etat === 'VALIDEE'
                      ? ` (${a.validePar ?? '—'}${a.valideLe ? `, ${dateHeure(a.valideLe)}` : ''})`
                      : ` · reçue le ${dateHeure(a.recueLe)}`}
                  </Pastille>
                  {a.motifs.length > 0 && (
                    <div className="text-xs text-slate-600">
                      {a.motifs.map((m) => MOTIF_DOUTE[m] ?? m).join(' ; ')}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1">{a.emplacement ?? '—'}</td>
                <td className="px-2 py-1">
                  {/* RG-COO-008 / RG-COO-014 : « Valider » / « Annuler la validation » (coord / admin). */}
                  {/* RG-COO-009 : hors coord / admin, boutons désactivés avec le message de la maquette. */}
                  {a.etat === 'VALIDEE' ? (
                    <button
                      type="button"
                      className="underline disabled:no-underline disabled:opacity-50"
                      disabled={envoi || !peut('validation_admin.valider')}
                      title={peut('validation_admin.valider') ? undefined : RESERVE_COORDINATION}
                      aria-label={`Annuler la validation de l’affiche ${String(a.id)}`}
                      onClick={() => void basculer(a.id, a.version, false)}
                    >
                      Annuler la validation
                    </button>
                  ) : a.etat !== 'RECEPTION_INCONNUE' ? (
                    <span
                      title={peut('validation_admin.valider') ? undefined : RESERVE_COORDINATION}
                    >
                      <Button
                        type="button"
                        disabled={envoi || !peut('validation_admin.valider')}
                        aria-label={`Valider l’affiche ${String(a.id)}`}
                        onClick={() => void basculer(a.id, a.version, true)}
                      >
                        Valider
                      </Button>
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
            {nonRecues.map((l) => (
              <tr key={`l-${String(l.id)}`} className="border-t border-slate-100 text-slate-500">
                <td className="px-2 py-1">—</td>
                <td className="px-2 py-1">
                  {l.theme ?? '(IP non saisies)'} ({semaine(l.depart)})
                </td>
                <td className="px-2 py-1 text-right tabular-nums">0</td>
                <td className="px-2 py-1">
                  <Pastille ton="info">Pas encore reçue</Pastille>
                  <div className="text-xs">rattachement proposé à sa réception, à confirmer</div>
                </td>
                <td className="px-2 py-1">—</td>
                <td className="px-2 py-1" />
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3 className="mt-3 font-medium">Historique</h3>
      {f.historique.length === 0 ? (
        <p className="text-slate-600">Aucun historique.</p>
      ) : (
        <ol className="space-y-1" aria-label="Historique">
          {f.historique.map((h, k) => (
            <li key={k}>
              {new Date(h.le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
              {h.objet} · {ACTION_HISTORIQUE[h.action] ?? h.action}
              {h.ancien || h.nouveau ? ` : ${h.ancien ?? '—'} → ${h.nouveau ?? '—'}` : ''} ·{' '}
              {h.par ?? '—'}
            </li>
          ))}
        </ol>
      )}
      {erreur !== null && (
        <div className="mt-2">
          <ErrorMessage error={erreur} />
        </div>
      )}
      {validation.erreur !== null && (
        <div className="mt-2">
          <ErrorMessage error={validation.erreur} />
        </div>
      )}
      {validation.modale}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className="underline" onClick={onFermer}>
          Fermer
        </button>
        {peut('broadcast.correction.demander') && (
          <Button
            type="button"
            onClick={() => {
              setCorrection(true)
            }}
          >
            Demander une correction à Broadcast
          </Button>
        )}
        {enCours.length > 0 && (
          <Button type="button" disabled={envoi} onClick={() => void instructionOk()}>
            Instruction OK (après contrôle)
          </Button>
        )}
        {f.validationAdmin.aConfirmer > 0 && (
          <span title={peut('validation_admin.valider') ? undefined : RESERVE_COORDINATION}>
            <Button
              type="button"
              disabled={!peut('validation_admin.valider') || validation.envoi}
              onClick={() => void validation.valider([f.id])}
            >
              Valider ({f.validationAdmin.aConfirmer} affiche
              {f.validationAdmin.aConfirmer > 1 ? 's' : ''})
            </Button>
          </span>
        )}
      </div>
      {correction && (
        <ModaleCorrection
          dossierId={f.id}
          dossier={f.dossier}
          dejaDemandeeLe={f.correctionDemandeeLe}
          onFermer={(m) => {
            setCorrection(false)
            if (m) onAction(m)
          }}
        />
      )}
    </div>
  )
}

/** RG-COO-047 / 048 / 050 / 059 : entretien et position, modifiables « En cours » ; position proposée. */
function Saisie({
  instruction: i,
  peutModifier,
  onAction,
  onErreur,
}: {
  instruction: FicheDossier['instructions'][number]
  peutModifier: boolean
  onAction: (m: string) => void
  onErreur: (e: unknown) => void
}) {
  const [entretien, setEntretien] = useState(i.entretien ?? 8)
  const [position, setPosition] = useState(i.position ?? 0)
  const modifiable = peutModifier && i.statut === 'EN_COURS'
  const [envoiSaisie, setEnvoiSaisie] = useState(false)
  async function enregistrer() {
    setEnvoiSaisie(true)
    onErreur(null)
    try {
      const r = await apiPatch(`/api/coordination/instructions/${encodeURIComponent(i.code)}`, {
        schema: InstructionModifieeSchema,
        body: { version: i.version, entretien, position },
      })
      onAction(r.message)
    } catch (e) {
      onErreur(e)
    } finally {
      setEnvoiSaisie(false)
    }
  }
  return (
    <div className="mt-2 flex flex-wrap items-end gap-3">
      <label>
        Entretien (%)
        <input
          type="number"
          min={0}
          max={30}
          disabled={!modifiable}
          className="ml-1 w-16 rounded border border-slate-300 px-1 disabled:bg-slate-50"
          value={entretien}
          onChange={(e) => {
            if (e.target.value !== '') setEntretien(Math.trunc(Number(e.target.value)))
          }}
        />
      </label>
      <label>
        Position
        <select
          disabled={!modifiable}
          className="ml-1 rounded border border-slate-300 px-1 disabled:bg-slate-50"
          value={position}
          onChange={(e) => {
            setPosition(Number(e.target.value))
          }}
        >
          {Object.entries(POSITION).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {i.positionProposee !== null && i.positionProposee !== i.position && (
        <span className="text-xs text-amber-800">
          Proposée d’après le commentaire : {POSITION[i.positionProposee]}
        </span>
      )}
      {modifiable ? (
        <Button type="button" disabled={envoiSaisie} onClick={() => void enregistrer()}>
          Enregistrer
        </Button>
      ) : (
        i.statut !== 'EN_COURS' && (
          <span className="text-xs text-slate-500">
            Entretien repris de Broadcast : modifiable seulement quand l’Instruction OK se fait
            après contrôle (dossier « En cours »).
          </span>
        )
      )}
    </div>
  )
}
