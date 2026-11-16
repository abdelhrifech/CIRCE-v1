import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  AteliersPerimetreSchema,
  ListeAnnonceursProchesSchema,
  ListeThemesModifiesSchema,
  ListeThemesProchesSchema,
  ReprendreThemeBroadcastResultatSchema,
  ResultatVerificationSchema,
  type ListeThemesModifies,
  type StatutVerification,
} from '@circe/shared'
import { useState } from 'react'
import { z } from 'zod'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille, type Ton } from '../../components/ui/pastille.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// ECR-THM-01 / 02 / 03 — Pilotage › Vérification des thèmes (RG-COO-068, 069, 070, 075) : thèmes proches
// entre dossiers, annonceurs proches, thèmes modifiés dans Broadcast. Les groupes sont calculés par l'API ;
// Circé ne modifie pas Broadcast (demande de correction tracée, mail : Q-375).

const VUES = {
  proches: 'Thèmes proches entre dossiers',
  annonceurs: 'Annonceurs proches',
  bc: 'Thèmes modifiés dans Broadcast',
} as const

const SearchSchema = z.object({
  tab: z.enum(['proches', 'annonceurs', 'bc']).optional(),
  dossier: z.coerce.number().int().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  etat: z
    .enum([
      'A_VERIFIER',
      'DEMANDE_ENVOYEE',
      'CORRIGE',
      'DIFFERENTS',
      'MEME_INTITULE',
      'TRAITES',
      'TOUS',
    ])
    .optional(),
  annonceur: z.string().optional(),
  production: z.enum(['LANCEE', 'AVANT']).optional(),
  atelierId: z.coerce.number().int().optional(),
})
type Search = z.infer<typeof SearchSchema>

export const Route = createFileRoute('/coordination/themes')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('verification_themes.consulter'),
  component: VerificationDesThemes,
})

const ETATS: Record<StatutVerification, { libelle: string; ton: Ton }> = {
  A_VERIFIER: { libelle: 'À vérifier', ton: 'surveiller' },
  DEMANDE_ENVOYEE: { libelle: 'Demande envoyée à Broadcast', ton: 'important' },
  CORRIGE: { libelle: 'Corrigé par Broadcast', ton: 'ok' },
  DIFFERENTS: { libelle: 'Visuels différents', ton: 'info' },
  MEME_INTITULE: { libelle: 'Même intitulé', ton: 'info' },
}

const semaine = (s: string | null) => (s ? `S${s.slice(6)}` : '—')
const guill = (l: string) => `« ${l} »`

function query(s: Search) {
  const p = new URLSearchParams()
  for (const k of ['dossier', 'depart', 'etat', 'annonceur', 'production', 'atelierId'] as const)
    if (s[k] !== undefined && s[k] !== '') p.set(k, String(s[k]))
  return p.toString()
}

interface Retour {
  message: string | null
  erreur: unknown
}

function VerificationDesThemes() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const vue = search.tab ?? 'proches'
  const changer = (p: Partial<Search>) => {
    void navigate({ search: (prev) => ({ ...prev, ...p }), replace: true })
  }
  const { etat: moi } = useApi('moi', () => getMe())
  const peutAgir = moi.kind === 'ready' && can(moi.data, 'broadcast.correction.demander')
  const peutReprendre = moi.kind === 'ready' && can(moi.data, 'broadcast.version.appliquer')
  const [retour, setRetour] = useState<Retour>({ message: null, erreur: null })
  const { etat: refAteliers } = useApi('coo-ateliers', (signal) =>
    apiRequest('GET', '/api/coordination/ateliers', { schema: AteliersPerimetreSchema, signal }),
  )
  const ateliers = refAteliers.kind === 'ready' ? refAteliers.data.ateliers : []
  const champ = 'ml-1 rounded-md border border-slate-300 px-2 py-1 text-sm'
  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Pilotage · Vérification des thèmes</p>
      <h1 className="text-2xl font-semibold">{VUES[vue]}</h1>

      <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
        <label>
          N° de dossier
          <input
            className={`${champ} w-28`}
            defaultValue={search.dossier ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = e.currentTarget.value.trim()
                if (v === '' || /^\d+$/.test(v)) changer({ dossier: v ? Number(v) : undefined })
              }
            }}
          />
        </label>
        <label>
          Départ
          <input
            className={`${champ} w-28`}
            placeholder="2026-W43"
            defaultValue={search.depart ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = e.currentTarget.value.trim()
                if (v === '' || /^\d{4}-W\d{2}$/.test(v)) changer({ depart: v || undefined })
              }
            }}
          />
        </label>
        {vue !== 'bc' ? (
          <label>
            État
            <select
              className={champ}
              value={search.etat ?? 'A_VERIFIER'}
              onChange={(e) => {
                changer({ etat: e.target.value as Search['etat'] })
              }}
            >
              {(Object.keys(ETATS) as StatutVerification[])
                .filter((k) => vue === 'proches' || k !== 'MEME_INTITULE')
                .map((k) => (
                  <option key={k} value={k}>
                    {vue === 'annonceurs' && k === 'DIFFERENTS'
                      ? 'Annonceurs différents'
                      : ETATS[k].libelle}
                  </option>
                ))}
              <option value="TRAITES">Déjà traités</option>
              <option value="TOUS">Tous</option>
            </select>
          </label>
        ) : (
          <label>
            Production
            <select
              className={champ}
              value={search.production ?? ''}
              onChange={(e) => {
                changer({ production: (e.target.value || undefined) as Search['production'] })
              }}
            >
              <option value="">Toutes</option>
              <option value="LANCEE">Production lancée</option>
              <option value="AVANT">Avant la production</option>
            </select>
          </label>
        )}
        {vue !== 'annonceurs' && (
          <label>
            Atelier
            <select
              className={champ}
              value={search.atelierId ?? ''}
              onChange={(e) => {
                changer({ atelierId: e.target.value ? Number(e.target.value) : undefined })
              }}
            >
              <option value="">Tous</option>
              {ateliers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle} · {a.plateforme}
                </option>
              ))}
            </select>
          </label>
        )}
        {vue !== 'annonceurs' && (
          <label>
            Annonceur
            <input
              className={`${champ} w-40`}
              defaultValue={search.annonceur ?? ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  changer({ annonceur: e.currentTarget.value.trim() || undefined })
              }}
            />
          </label>
        )}
      </div>
      {retour.message && (
        <p
          role="status"
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm"
        >
          {retour.message}
        </p>
      )}
      {retour.erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={retour.erreur} />
        </div>
      )}
      {vue === 'proches' && (
        <VueProches search={search} peutAgir={peutAgir} onRetour={setRetour} changer={changer} />
      )}
      {vue === 'annonceurs' && (
        <VueAnnonceurs search={search} peutAgir={peutAgir} onRetour={setRetour} changer={changer} />
      )}
      {vue === 'bc' && (
        <VueBroadcast
          search={search}
          peutReprendre={peutReprendre}
          onRetour={setRetour}
          changer={changer}
        />
      )}
    </main>
  )
}

interface VueProps {
  search: Search
  peutAgir: boolean
  onRetour: (r: Retour) => void
  changer: (p: Partial<Search>) => void
}

const Tuile = ({
  libelle,
  n,
  sous,
  onClick,
}: {
  libelle: string
  n: number | undefined
  sous: string
  onClick: () => void
}) => (
  <button
    type="button"
    className="rounded-lg border border-slate-200 bg-white p-3 text-left"
    onClick={onClick}
  >
    <span className="block text-xs text-slate-500">{libelle}</span>
    <span className="text-xl font-semibold">{n ?? '…'}</span>
    <span className="block text-xs text-slate-500">{sous}</span>
  </button>
)

async function poster(
  chemin: string,
  body: unknown,
  onRetour: (r: Retour) => void,
  recharger: () => void,
) {
  onRetour({ message: null, erreur: null })
  try {
    const r = await apiRequest('POST', chemin, {
      schema: ResultatVerificationSchema,
      body,
      idempotencyKey: true,
    })
    onRetour({ message: r.message, erreur: null })
    recharger()
    return true
  } catch (e) {
    onRetour({ message: null, erreur: e })
    return false
  }
}

/** Modale « Demander la correction » : intitulé correct (le plus fréquent préselectionné), message facultatif. */
function ModaleDemande({
  titre,
  options,
  aCorriger,
  ouverte,
  onFermer,
  onEnvoyer,
}: {
  titre: string
  options: { libelle: string; detail: string }[]
  aCorriger: (correct: string) => { dossier: number; ancien: string; mention: string }[]
  ouverte: boolean
  onFermer: () => void
  onEnvoyer: (correct: string, note: string) => Promise<boolean>
}) {
  const [correct, setCorrect] = useState(options[0]?.libelle ?? '')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  return (
    <Modale
      titre={titre}
      ouverte={ouverte}
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
      large
    >
      <p className="text-sm">
        L’intitulé vient de la préparation envoyée par Broadcast, et Circé ne peut pas modifier
        Broadcast. Choisissez l’intitulé correct : Circé trace une demande pour chaque dossier à
        corriger ; le gestionnaire corrige dans Broadcast puis renvoie la préparation.
      </p>
      <fieldset className="mt-3 space-y-1 text-sm">
        <legend className="sr-only">Intitulé correct</legend>
        {options.map((o) => (
          <label key={o.libelle} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={correct === o.libelle}
              onChange={() => {
                setCorrect(o.libelle)
              }}
            />
            <strong>{guill(o.libelle)}</strong>
            <span className="text-xs text-slate-500">· {o.detail}</span>
          </label>
        ))}
      </fieldset>
      <h3 className="mt-3 text-sm font-semibold">À corriger dans Broadcast</h3>
      <table className="mt-1 w-full text-sm" aria-label="À corriger dans Broadcast">
        <thead className="text-slate-600">
          <tr>
            {['Dossier', 'Correction demandée', ''].map((h) => (
              <th key={h} scope="col" className="px-2 py-1 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {aCorriger(correct).map((x) => (
            <tr key={`${String(x.dossier)}-${x.ancien}`} className="border-t border-slate-100">
              <td className="px-2 py-1 font-mono">{x.dossier}</td>
              <td className="px-2 py-1">
                {guill(x.ancien)} → <strong>{guill(correct)}</strong>
              </td>
              <td className="px-2 py-1 text-xs text-slate-500">{x.mention}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="mt-3 block text-sm">
        Message au gestionnaire (facultatif)
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          placeholder="Précision pour Broadcast"
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
          }}
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={onFermer}>
          Annuler
        </button>
        <button
          type="button"
          disabled={envoi}
          className="rounded-md bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          onClick={() => {
            setEnvoi(true)
            void onEnvoyer(correct, note).then((ok) => {
              setEnvoi(false)
              if (ok) onFermer()
            })
          }}
        >
          Envoyer la demande
        </button>
      </div>
    </Modale>
  )
}

const mentionDossier = (d: { productionLancee: boolean; preparation: string }) =>
  d.productionLancee
    ? 'Production lancée : à voir avec l’atelier'
    : d.preparation === 'Pas encore envoyée'
      ? 'prépa pas encore envoyée : à corriger dans les IP'
      : 'demande au gestionnaire, préparation à renvoyer'

function VueProches({ search, peutAgir, onRetour, changer }: VueProps) {
  const q = query(search)
  const { etat, recharger } = useApi(`themes-proches?${q}`, (signal) =>
    apiRequest('GET', `/api/coordination/themes/proches?${q}`, {
      schema: ListeThemesProchesSchema,
      signal,
    }),
  )
  const [demande, setDemande] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const data = etat.kind === 'ready' ? etat.data : null
  const groupe = data?.groupes.find((g) => g.cle === demande)
  const groupeDetail = data?.groupes.find((g) => g.cle === detail)
  return (
    <>
      {groupeDetail && (
        <ModaleDetail
          titre={`Thèmes proches · ${groupeDetail.annonceur}`}
          dossiers={groupeDetail.dossiers}
          note={
            groupeDetail.statut === 'DEMANDE_ENVOYEE'
              ? 'En attente de Broadcast : le gestionnaire corrige le thème et renvoie la préparation. Le groupe disparaît alors de la liste « À vérifier ».'
              : groupeDetail.statut === 'MEME_INTITULE'
                ? 'Même intitulé sur plusieurs dossiers : une seule affiche pourra servir ces dossiers.'
                : 'Intitulés différents pour un visuel probablement identique : demander la correction dans Broadcast, ou confirmer que ce sont des visuels différents.'
          }
          onFermer={() => {
            setDetail(null)
          }}
        />
      )}
      <p className="mt-2 text-sm text-slate-600">
        Dès la saisie des IP dans Broadcast, Circé repère les visuels identiques ou proches sur
        plusieurs dossiers d’un même annonceur, ou d’annonceurs aux noms proches. La Coordination
        demande la correction à la Pré-Prod, dans Broadcast, ou confirme que ce sont des visuels
        différents. Le groupe disparaît quand Broadcast envoie la préparation corrigée.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Indicateurs">
        <Tuile
          libelle="À vérifier"
          n={data?.indicateurs.aVerifier}
          sous="intitulés différents, même visuel probable"
          onClick={() => {
            changer({ etat: 'A_VERIFIER' })
          }}
        />
        <Tuile
          libelle="Demandes envoyées"
          n={data?.indicateurs.demandesEnvoyees}
          sous="en attente de Broadcast"
          onClick={() => {
            changer({ etat: 'DEMANDE_ENVOYEE' })
          }}
        />
        <Tuile
          libelle="Même intitulé"
          n={data?.indicateurs.memeIntitule}
          sous="une affiche pour plusieurs dossiers"
          onClick={() => {
            changer({ etat: 'MEME_INTITULE' })
          }}
        />
        <Tuile
          libelle="Déjà traités"
          n={data?.indicateurs.dejaTraites}
          sous="corrigés par Broadcast ou visuels différents"
          onClick={() => {
            changer({ etat: 'TRAITES' })
          }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Règle : même annonceur regroupé ; intitulés identiques une fois simplifiés (minuscules, sans
        accents ni ponctuation), l’un contenu dans l’autre, ou similarité ≥{' '}
        {data ? String(data.seuil).replace('.', ',') : '…'} (paramètre).
      </p>
      <section className="mt-2 rounded-lg border border-slate-200 bg-white">
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {data && data.groupes.length === 0 && (
          <p className="p-3 text-sm text-slate-600">
            Aucun thème proche à vérifier avec ces filtres.
          </p>
        )}
        {data && data.groupes.length > 0 && (
          <table className="w-full text-sm" aria-label="Thèmes proches">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {[
                  'État',
                  'Annonceur',
                  'Intitulés trouvés',
                  'Dossiers',
                  'Départ',
                  'Pilotage',
                  '',
                ].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.groupes.map((g) => (
                <tr key={g.cle} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <Pastille ton={ETATS[g.statut].ton}>{ETATS[g.statut].libelle}</Pastille>
                  </td>
                  <td className="px-3 py-2">{g.annonceur}</td>
                  <td className="px-3 py-2">
                    {g.libelles
                      .map((l) => guill(l.libelle) + (l.themes > 1 ? ` ×${String(l.themes)}` : ''))
                      .join(' · ')}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {g.dossiers.map((d) => d.contNum).join(', ')}
                  </td>
                  <td className="px-3 py-2">{semaine(g.depart)}</td>
                  <td className="px-3 py-2">
                    {[...new Set(g.dossiers.map((d) => d.preparation))]
                      .map(
                        (p) =>
                          `${p} (${String(g.dossiers.filter((d) => d.preparation === p).length)})`,
                      )
                      .join(', ')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      className="mr-2 text-xs underline"
                      onClick={() => {
                        setDetail(g.cle)
                      }}
                    >
                      Détail
                    </button>
                    {g.statut === 'A_VERIFIER' && (
                      <>
                        <button
                          type="button"
                          disabled={!peutAgir}
                          title={
                            peutAgir
                              ? undefined
                              : 'Réservé à la Coordination et à l’administrateur.'
                          }
                          className="rounded-md bg-sky-700 px-2 py-1 text-xs text-white disabled:opacity-40"
                          onClick={() => {
                            setDemande(g.cle)
                          }}
                        >
                          Demander la correction
                        </button>
                        <button
                          type="button"
                          disabled={!peutAgir}
                          className="ml-2 text-xs underline disabled:opacity-40"
                          onClick={() =>
                            void poster(
                              '/api/coordination/themes/verdicts',
                              { type: 'THEMES', cle: g.cle, verdict: 'DIFFERENTS' },
                              onRetour,
                              recharger,
                            )
                          }
                        >
                          Visuels différents
                        </button>
                      </>
                    )}
                    {g.statut === 'DIFFERENTS' && (
                      <button
                        type="button"
                        disabled={!peutAgir}
                        className="text-xs underline disabled:opacity-40"
                        onClick={() =>
                          void poster(
                            '/api/coordination/themes/verdicts',
                            { type: 'THEMES', cle: g.cle, verdict: 'ROUVRIR' },
                            onRetour,
                            recharger,
                          )
                        }
                      >
                        Rouvrir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {groupe && (
        <ModaleDemande
          titre={`Demander la correction dans Broadcast · ${groupe.annonceur}`}
          ouverte
          options={[...groupe.libelles]
            .sort((a, b) => b.themes - a.themes)
            .map((l) => ({
              libelle: l.libelle,
              detail: `${String(l.themes)} thème(s), ${String(l.dossiers)} dossier(s)`,
            }))}
          aCorriger={(correct) =>
            groupe.dossiers.flatMap((d) =>
              d.libelles
                .filter((l) => l !== correct)
                .map((l) => ({ dossier: d.contNum, ancien: l, mention: mentionDossier(d) })),
            )
          }
          onFermer={() => {
            setDemande(null)
          }}
          onEnvoyer={(correct, note) =>
            poster(
              '/api/coordination/themes/demandes',
              { type: 'THEMES', cle: groupe.cle, correct, note },
              onRetour,
              recharger,
            )
          }
        />
      )}
    </>
  )
}

function VueAnnonceurs({ search, peutAgir, onRetour, changer }: VueProps) {
  const q = query(search)
  const { etat, recharger } = useApi(`annonceurs-proches?${q}`, (signal) =>
    apiRequest('GET', `/api/coordination/themes/annonceurs?${q}`, {
      schema: ListeAnnonceursProchesSchema,
      signal,
    }),
  )
  const [demande, setDemande] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const data = etat.kind === 'ready' ? etat.data : null
  const groupe = data?.groupes.find((g) => g.cle === demande)
  const groupeDetail = data?.groupes.find((g) => g.cle === detail)
  return (
    <>
      {groupeDetail && (
        <ModaleDetail
          titre={`Annonceurs proches · ${groupeDetail.noms.map((x) => x.nom).join(' / ')}`}
          dossiers={groupeDetail.dossiers}
          note={
            groupeDetail.statut === 'A_VERIFIER'
              ? 'Même annonceur sous des noms différents ? Demander la correction dans Broadcast, ou noter que ce sont des annonceurs différents. En attendant, leurs thèmes sont comparés entre eux.'
              : 'En attente de Broadcast ou déjà traité.'
          }
          onFermer={() => {
            setDetail(null)
          }}
        />
      )}
      <p className="mt-2 text-sm text-slate-600">
        Dès la DA activée, Circé repère les noms d’annonceurs proches (même règle que les thèmes).
        Deux noms qu’un regroupement réunit déjà ne sont pas signalés. Même circuit que pour les
        thèmes : la correction se fait dans Broadcast.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Indicateurs">
        <Tuile
          libelle="À vérifier"
          n={data?.indicateurs.aVerifier}
          sous="noms différents, même annonceur probable"
          onClick={() => {
            changer({ etat: 'A_VERIFIER' })
          }}
        />
        <Tuile
          libelle="Demandes envoyées"
          n={data?.indicateurs.demandesEnvoyees}
          sous="en attente de Broadcast"
          onClick={() => {
            changer({ etat: 'DEMANDE_ENVOYEE' })
          }}
        />
        <Tuile
          libelle="Déjà traités"
          n={data?.indicateurs.dejaTraites}
          sous="corrigés par Broadcast ou annonceurs différents"
          onClick={() => {
            changer({ etat: 'TRAITES' })
          }}
        />
      </div>
      <section className="mt-3 rounded-lg border border-slate-200 bg-white">
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {data && data.groupes.length === 0 && (
          <p className="p-3 text-sm text-slate-600">
            Aucun annonceur proche à vérifier avec ces filtres.
          </p>
        )}
        {data && data.groupes.length > 0 && (
          <table className="w-full text-sm" aria-label="Annonceurs proches">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {['État', 'Noms trouvés', 'Dossiers', 'Départ', 'Origine', 'Pilotage', ''].map(
                  (h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.groupes.map((g) => (
                <tr key={g.cle} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <Pastille ton={ETATS[g.statut].ton}>
                      {g.statut === 'DIFFERENTS'
                        ? 'Annonceurs différents'
                        : ETATS[g.statut].libelle}
                    </Pastille>
                  </td>
                  <td className="px-3 py-2">{g.noms.map((x) => guill(x.nom)).join(' · ')}</td>
                  <td className="px-3 py-2 font-mono">
                    {g.dossiers.map((d) => d.contNum).join(', ')}
                  </td>
                  <td className="px-3 py-2">{semaine(g.depart)}</td>
                  <td className="px-3 py-2">Broadcast</td>
                  <td className="px-3 py-2">
                    {[...new Set(g.dossiers.map((d) => d.preparation))].join(', ')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      className="mr-2 text-xs underline"
                      onClick={() => {
                        setDetail(g.cle)
                      }}
                    >
                      Détail
                    </button>
                    {g.statut === 'A_VERIFIER' && (
                      <>
                        <button
                          type="button"
                          disabled={!peutAgir}
                          className="rounded-md bg-sky-700 px-2 py-1 text-xs text-white disabled:opacity-40"
                          onClick={() => {
                            setDemande(g.cle)
                          }}
                        >
                          Demander la correction
                        </button>
                        <button
                          type="button"
                          disabled={!peutAgir}
                          className="ml-2 text-xs underline disabled:opacity-40"
                          onClick={() =>
                            void poster(
                              '/api/coordination/themes/verdicts',
                              { type: 'ANNONCEURS', cle: g.cle, verdict: 'DIFFERENTS' },
                              onRetour,
                              recharger,
                            )
                          }
                        >
                          Annonceurs différents
                        </button>
                      </>
                    )}
                    {g.statut === 'DIFFERENTS' && (
                      <button
                        type="button"
                        disabled={!peutAgir}
                        className="text-xs underline disabled:opacity-40"
                        onClick={() =>
                          void poster(
                            '/api/coordination/themes/verdicts',
                            { type: 'ANNONCEURS', cle: g.cle, verdict: 'ROUVRIR' },
                            onRetour,
                            recharger,
                          )
                        }
                      >
                        Rouvrir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {groupe && (
        <ModaleDemande
          titre="Demander la correction de l’annonceur"
          ouverte
          options={groupe.noms.map((x) => ({
            libelle: x.nom,
            detail: `dossier(s) ${groupe.dossiers
              .filter((d) => d.libelles.includes(x.nom))
              .map((d) => d.contNum)
              .join(', ')}`,
          }))}
          aCorriger={(correct) =>
            groupe.dossiers
              .filter((d) => (d.libelles[0] ?? '') !== correct)
              .map((d) => ({
                dossier: d.contNum,
                ancien: d.libelles[0] ?? '',
                mention: mentionDossier(d),
              }))
          }
          onFermer={() => {
            setDemande(null)
          }}
          onEnvoyer={(correct, note) =>
            poster(
              '/api/coordination/themes/demandes',
              { type: 'ANNONCEURS', cle: groupe.cle, correct, note },
              onRetour,
              recharger,
            )
          }
        />
      )}
    </>
  )
}

function VueBroadcast({
  search,
  peutReprendre,
  onRetour,
  changer,
}: {
  search: Search
  peutReprendre: boolean
  onRetour: (r: Retour) => void
  changer: (p: Partial<Search>) => void
}) {
  const q = query(search)
  const { etat, recharger } = useApi(`themes-bc?${q}`, (signal) =>
    apiRequest('GET', `/api/coordination/themes/broadcast?${q}`, {
      schema: ListeThemesModifiesSchema,
      signal,
    }),
  )
  const [envoi, setEnvoi] = useState<number | null>(null)
  const [colStatut, setColStatut] = useState(false)
  const data = etat.kind === 'ready' ? etat.data : null
  const reprendre = async (l: ListeThemesModifies['lignes'][number]) => {
    setEnvoi(l.ligneAttendueId)
    onRetour({ message: null, erreur: null })
    try {
      const r = await apiRequest(
        'POST',
        `/api/coordination/themes/broadcast/${String(l.ligneAttendueId)}/reprendre`,
        {
          schema: ReprendreThemeBroadcastResultatSchema,
          body: { version: l.version },
          idempotencyKey: true,
        },
      )
      onRetour({ message: r.message, erreur: null })
      recharger()
    } catch (e) {
      onRetour({ message: null, erreur: e })
    } finally {
      setEnvoi(null)
    }
  }
  return (
    <>
      <p className="mt-2 text-sm text-slate-600">
        Les gestionnaires ont changé un thème dans Broadcast après l’envoi de la préparation, alors
        que la validation admin était faite. À chaque mise à jour de sa copie de Broadcast, Circé
        compare le thème de chaque dossier des deux côtés et lève une alerte, critique si la
        production est lancée.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Indicateurs">
        <Tuile
          libelle="Thèmes modifiés dans Broadcast"
          n={data?.indicateurs.total}
          sous="Circé n’a pas encore suivi"
          onClick={() => {
            changer({ production: undefined })
          }}
        />
        <Tuile
          libelle="Production lancée"
          n={data?.indicateurs.productionLancee}
          sous="visuel à vérifier avec l’atelier"
          onClick={() => {
            changer({ production: 'LANCEE' })
          }}
        />
        <Tuile
          libelle="Avant la production"
          n={data?.indicateurs.avantProduction}
          sous="reprendre la version Broadcast"
          onClick={() => {
            changer({ production: 'AVANT' })
          }}
        />
      </div>
      <section className="mt-3 rounded-lg border border-slate-200 bg-white">
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {data && data.lignes.length === 0 && (
          <p className="p-3 text-sm text-slate-600">
            Aucun thème modifié dans Broadcast avec ces filtres : Broadcast et Circé ont les mêmes
            thèmes.
          </p>
        )}
        <label className="m-2 inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={colStatut}
            onChange={(e) => {
              setColStatut(e.target.checked)
            }}
          />
          Afficher la colonne « Statut pré-production »
        </label>
        {data && data.lignes.length > 0 && (
          <table className="w-full text-sm" aria-label="Thèmes modifiés dans Broadcast">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {[
                  'Gravité',
                  'Dossier',
                  'Annonceur',
                  'Atelier',
                  'Départ',
                  'Thème dans Circé',
                  'Thème dans Broadcast',
                  ...(colStatut ? ['Statut pré-production'] : []),
                  '',
                ].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.lignes.map((l) => (
                <tr
                  key={l.ligneAttendueId}
                  className={`border-t border-slate-100 align-top ${l.productionLancee ? 'bg-red-50' : 'bg-orange-50'}`}
                >
                  <td className="px-3 py-2">
                    <Pastille ton={l.productionLancee ? 'critique' : 'important'}>
                      {l.productionLancee ? 'Production lancée' : 'Avant la production'}
                    </Pastille>
                  </td>
                  <td className="px-3 py-2 font-mono">{l.contNum ?? '—'}</td>
                  <td className="px-3 py-2">{l.annonceur ?? '—'}</td>
                  <td className="px-3 py-2">{l.atelier ?? '—'}</td>
                  <td className="px-3 py-2">{semaine(l.depart)}</td>
                  <td className="px-3 py-2">{l.themeCirce ?? '—'}</td>
                  <td className="px-3 py-2 font-semibold">{l.themeBroadcast ?? '—'}</td>
                  {colStatut && <td className="px-3 py-2">{l.preparation}</td>}
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      disabled={!peutReprendre || envoi !== null}
                      title={
                        peutReprendre
                          ? undefined
                          : 'Réservé à la Coordination et à l’administrateur.'
                      }
                      className="rounded-md bg-sky-700 px-2 py-1 text-xs text-white disabled:opacity-40"
                      onClick={() => void reprendre(l)}
                    >
                      Reprendre la version BC
                    </button>
                    {l.contNum !== null && (
                      <Link
                        to="/pilotage/reservations"
                        search={{ dossier: l.contNum }}
                        className="ml-2 text-xs underline"
                        title="Où en est ce dossier : État des réservations vivant"
                      >
                        Voir le dossier
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

/** Modale de détail d'un groupe (maquette `detailGroupe`) : dossiers, préparation, intitulés, ouverture. */
function ModaleDetail({
  titre,
  dossiers,
  note,
  onFermer,
}: {
  titre: string
  dossiers: {
    contNum: number
    annonceur: string | null
    depart: string | null
    preparation: string
    productionLancee: boolean
    libelles: string[]
  }[]
  note: string
  onFermer: () => void
}) {
  return (
    <Modale
      titre={titre}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
      large
    >
      <table className="w-full text-sm" aria-label="Dossiers du groupe">
        <thead className="text-slate-600">
          <tr>
            {['Dossier', 'Annonceur', 'Intitulés', 'Départ', 'Pilotage', ''].map((h) => (
              <th key={h} scope="col" className="px-2 py-1 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dossiers.map((d) => (
            <tr key={d.contNum} className="border-t border-slate-100">
              <td className="px-2 py-1 font-mono">{d.contNum}</td>
              <td className="px-2 py-1">{d.annonceur ?? '—'}</td>
              <td className="px-2 py-1">{d.libelles.map(guill).join(' · ') || '—'}</td>
              <td className="px-2 py-1">{semaine(d.depart)}</td>
              <td className="px-2 py-1">
                {d.preparation}
                {d.productionLancee && ' · production lancée'}
              </td>
              <td className="px-2 py-1">
                <a
                  className="text-xs underline"
                  href={`/coordination?dossier=${String(d.contNum)}&aFaire=TOUS`}
                >
                  Ouvrir le dossier
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-600">{note}</p>
    </Modale>
  )
}
