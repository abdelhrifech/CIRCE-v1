import { ApercuNc } from './feuille.tsx'
import { exporterExcel, lireExcel } from '../../lib/excel.ts'
import { useState } from 'react'
import {
  CasNcListeSchema,
  type CasNc,
  NC_A_PRECISER,
  NC_BLOQUANTES,
  NC_CONTROLES,
  NC_DECISIONS,
  NC_FORMATS,
  NC_NON_BLOQUANTES,
  NC_STATUTS,
  NC_TYPES_AGENCE,
  DeclarantsSchema,
  ListeNcSchema,
  NcDonneesSchema,
  NcSchema,
  ReferentielsReceptionSchema,
  porteeNc,
  statutNc,
  type Nc,
  type NcDonnees,
} from '@circe/shared'
import type { z } from 'zod'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { can, getMe } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
import { lireBase64 } from '../reception/bon-livraison.tsx'

const champ = 'mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm'
const date = (s: string) => new Date(s).toLocaleString('fr-FR')
export function ChoixMultiples({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <fieldset className="rounded border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((v) => (
          <label key={v} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(v)}
              onChange={(e) => {
                onChange(e.target.checked ? [...value, v] : value.filter((x) => x !== v))
              }}
            />
            {v}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
export function ChoixPortee({
  types,
  bloquante,
  onTypes,
  onPortee,
}: {
  types: string[]
  bloquante: boolean | null
  onTypes: (v: string[]) => void
  onPortee: (v: boolean) => void
}) {
  const auto = porteeNc(types)
  const portee = auto ?? bloquante
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        {[
          ['Bloquantes', NC_BLOQUANTES],
          ['À préciser', NC_A_PRECISER],
          ['Non bloquantes', NC_NON_BLOQUANTES],
        ].map(([titre, valeurs]) => (
          <ChoixMultiples
            key={String(titre)}
            label={String(titre)}
            options={valeurs as readonly string[]}
            value={types}
            onChange={(v) => {
              onTypes([
                ...types.filter((t) => !(valeurs as readonly string[]).includes(t)),
                ...v.filter((t) => (valeurs as readonly string[]).includes(t)),
              ])
            }}
          />
        ))}
      </div>
      <div className="flex gap-3">
        {[false, true].map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={portee === v}
            disabled={auto !== null}
            onClick={() => {
              onPortee(v)
            }}
            className={`flex-1 rounded border p-4 text-left text-sm ${portee === v ? (v ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-amber-50') : 'border-slate-200'}`}
          >
            <strong>{v ? 'Bloquante' : 'Non bloquante'}</strong>
            <span className="mt-1 block">
              {v
                ? 'La Préproduction décide avant la suite.'
                : 'La déclaration compte pour la statistique.'}
            </span>
          </button>
        ))}
      </div>
      {types.length > 0 && auto === null && portee === null && (
        <p role="status" className="text-sm text-amber-800">
          Précisez la portée de la non-conformité.
        </p>
      )}
    </div>
  )
}

export function FormulaireNc({
  type,
  onEnvoyee,
  onAnnuler,
}: {
  type: 'RECEPTION' | 'AGENCE'
  onEnvoyee: (nc: Nc) => void
  onAnnuler: () => void
}) {
  const [donnees, setDonnees] = useState<NcDonnees>(() => NcDonneesSchema.parse({}))
  const [site, setSite] = useState('')
  const [prefill, setPrefill] = useState(false)
  const [fichiers, setFichiers] = useState<File[]>([])
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)
  const { etat: refs, recharger } = useApi('refs-nc', (signal) =>
    apiRequest('GET', '/api/reception/referentiels', {
      schema: ReferentielsReceptionSchema,
      signal,
    }),
  )
  const { etat: declarants } = useApi('declarants-nc', (signal) =>
    apiRequest('GET', '/api/non-conformites/declarants', { schema: DeclarantsSchema, signal }),
  )
  const d = donnees
  function maj<K extends keyof NcDonnees>(k: K, v: NcDonnees[K]) {
    setDonnees((x) => ({ ...x, [k]: v }))
  }
  const texte = (k: keyof NcDonnees, titre: string, requis = false, inputType = 'text') => (
    <label className="block text-sm font-medium">
      {titre}
      {requis && ' *'}
      {requis && prefill && !String(d[k]).trim() && (
        <strong className="ml-2 text-amber-800">à compléter</strong>
      )}
      <input
        className={
          champ +
          (requis && prefill && !String(d[k]).trim()
            ? ' border-2 border-amber-700 bg-amber-50'
            : '')
        }
        type={inputType}
        required={requis}
        value={String(d[k])}
        onChange={(e) => {
          maj(k, e.target.value)
        }}
      />
    </label>
  )
  const choix = (k: keyof NcDonnees, titre: string, valeurs: readonly string[], requis = false) => (
    <label className="block text-sm font-medium">
      {titre}
      {requis && ' *'}
      {requis && prefill && !String(d[k]).trim() && (
        <strong className="ml-2 text-amber-800">à compléter</strong>
      )}
      <select
        className={champ}
        required={requis}
        value={String(d[k])}
        onChange={(e) => {
          maj(k, e.target.value)
        }}
      >
        <option value="">Sélectionner</option>
        {valeurs.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  )
  async function envoyer(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      const fichiersEnvoi = await Promise.all(
        fichiers.map(async (f) => ({
          nom: f.name,
          mimeType: f.type,
          contenuBase64: await lireBase64(f),
        })),
      )
      const nc = await apiPost('/api/non-conformites', {
        schema: NcSchema,
        body: { plateformeId: Number(site), type, donnees: d, fichiers: fichiersEnvoi },
      })
      onEnvoyee(nc)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <form
      onSubmit={(e) => void envoyer(e)}
      className="max-w-4xl rounded-lg border-2 bg-white"
      style={{ borderColor: type === 'AGENCE' ? '#c2410c' : '#6f42c1' }}
    >
      <div className="border-b p-5">
        <h2 className="text-xl font-semibold">
          {type === 'AGENCE' ? 'Usage réservé aux Agences' : 'Usage réservé aux plateformes'}
        </h2>
        {type === 'AGENCE' && (
          <p className="mt-1 text-sm text-red-700">
            Ce formulaire est uniquement destiné à remonter les non-conformités détectées lors d’une
            réception d’affiches en Agence.
          </p>
        )}
      </div>
      <div className="space-y-4 p-5">
        {type === 'RECEPTION' && (
          <PreRemplirNc
            onChoix={(c) => {
              setSite(String(c.plateformeId))
              setPrefill(true)
              setDonnees((d) => {
                const next = { ...d, ...c.donnees, declarant: d.declarant }
                if (refs.kind === 'ready') {
                  if (
                    next.imprimeur &&
                    !refs.data.imprimeurs.some((i) => i.libelle === next.imprimeur)
                  ) {
                    next.imprimeurAutre = next.imprimeur
                    next.imprimeur = 'AUTRE'
                  }
                  if (
                    next.transporteur &&
                    !refs.data.livreurs.some((i) => i.libelle === next.transporteur)
                  ) {
                    next.transporteurAutre = next.transporteur
                    next.transporteur = 'AUTRE'
                  }
                }
                return next
              })
            }}
          />
        )}
        {prefill && (
          <p className="rounded border border-amber-500 p-3">
            Demande pré-remplie depuis une réception. Vérifiez les informations et complétez les
            champs obligatoires signalés « à compléter ». Tous les champs restent modifiables.
          </p>
        )}
        {refs.kind === 'loading' && <p>Chargement des référentiels…</p>}
        {refs.kind === 'error' && <ErrorMessage error={refs.error} onRetry={recharger} />}
        <label className="block text-sm font-medium">
          Plateforme *
          <select
            className={champ}
            required
            value={site}
            onChange={(e) => {
              setSite(e.target.value)
            }}
          >
            <option value="">Sélectionner la plateforme</option>
            {refs.kind === 'ready' &&
              refs.data.plateformes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
          </select>
        </label>
        {choix(
          'declarant',
          'Déclarant / Émetteur de la non-conformité',
          declarants.kind === 'ready' ? declarants.data.noms : [],
          type === 'AGENCE',
        )}
        {declarants.kind === 'ready' && declarants.data.noms.length === 0 && (
          <p className="text-sm text-amber-800">
            Aucun déclarant configuré : renseignez le référentiel dans Administration.
          </p>
        )}
        {type === 'AGENCE' && (
          <>
            {choix('region', 'Région concernée', ['Nord', 'Sud', 'Est', 'Ouest'], true)}
            {texte('afficheur', 'Nom de l’afficheur', true)}
            {texte('dossier', 'N° de dossier BC', true)}
          </>
        )}
        {type === 'RECEPTION' && (
          <div className="grid gap-3 sm:grid-cols-3">
            {texte('dossier', 'N° de dossier BC')}
            {texte('semaine', 'Semaine(s)')}
            {texte('quantite', 'Quantité concernée')}
          </div>
        )}
        {texte('annonceur', 'Annonceur', true)}
        {type === 'RECEPTION' && (
          <>
            {choix(
              'imprimeur',
              'Imprimeur',
              [
                ...(refs.kind === 'ready' ? refs.data.imprimeurs.map((i) => i.libelle) : []),
                'AUTRE',
              ],
              true,
            )}
            {d.imprimeur === 'AUTRE' && texte('imprimeurAutre', 'Imprimeur autre', true)}
            {choix(
              'transporteur',
              'Transporteur',
              [...(refs.kind === 'ready' ? refs.data.livreurs.map((i) => i.libelle) : []), 'AUTRE'],
              true,
            )}
            {d.transporteur === 'AUTRE' && texte('transporteurAutre', 'Transporteur autre', true)}
          </>
        )}
        {texte('theme', 'Thème', true)}
        <ChoixMultiples
          label="Formats *"
          options={type === 'AGENCE' ? NC_FORMATS.filter((f) => f !== 'Autre format') : NC_FORMATS}
          value={d.formats}
          onChange={(v) => {
            maj('formats', v as NcDonnees['formats'])
          }}
        />
        {type === 'AGENCE' ? (
          <>
            {texte('lieu', 'Lieu de livraison des affiches')}
            {texte('dateAff', 'Date d’affichage', true, 'date')}
            <ChoixMultiples
              label="Type de non-conformité rencontrée *"
              options={NC_TYPES_AGENCE}
              value={d.types}
              onChange={(v) => {
                maj('types', v)
              }}
            />
          </>
        ) : (
          <>
            {choix('avarie', 'Présence avarie de transport', ['OUI', 'NON'], true)}
            {choix('controlePossible', 'Le contrôle de la marchandise est-il possible ?', [
              'Oui',
              'Non',
            ])}
            <ChoixMultiples
              label="Contrôle réception *"
              options={NC_CONTROLES}
              value={d.controle}
              onChange={(v) => {
                maj('controle', v as NcDonnees['controle'])
              }}
            />
            {d.controle.includes('Contrôle du visuel') && (
              <ChoixMultiples
                label="Détail contrôle visuel"
                options={['Thèmes', 'Qualité impression']}
                value={d.detailVisuel}
                onChange={(v) => {
                  maj('detailVisuel', v as NcDonnees['detailVisuel'])
                }}
              />
            )}
            {d.controle.includes('Etat des affiches') &&
              choix('statutEtat', 'Statut de non conformité état affiches', [
                'Non utilisable',
                'Partiellement utilisables',
              ])}
            {texte('commentaireNC', 'Commentaire de non conformité du contrôle de la marchandise')}
            {texte('dossier', 'N° de dossier BC')}
            {texte('numeroAffichesManquantes', 'N° d’affiche manquante')}
          </>
        )}
        {texte('commentaire', 'Commentaires supplémentaires sur le contrôle de la livraison')}
        <label className="block text-sm font-medium">
          Justificatifs
          <input
            type="file"
            multiple
            className={champ}
            onChange={(e) => {
              setFichiers((old) => [...old, ...Array.from(e.target.files ?? [])])
            }}
          />
        </label>
        {fichiers.map((f, i) => (
          <p key={`${f.name}-${i}`} className="text-sm">
            {f.name} ({Math.ceil(f.size / 1024)} ko){' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setFichiers((old) => old.filter((_, j) => j !== i))
              }}
            >
              Retirer
            </button>
          </p>
        ))}
        {erreur !== null && <ErrorMessage error={erreur} />}
      </div>
      <div className="flex justify-end gap-3 border-t p-4">
        <button type="button" onClick={onAnnuler}>
          Annuler
        </button>
        <Button type="submit" disabled={envoi}>
          {envoi ? 'Envoi…' : 'Envoyer'}
        </Button>
      </div>
    </form>
  )
}

function PreRemplirNc({ onChoix }: { onChoix: (c: CasNc) => void }) {
  const [q, setQ] = useState(''),
    [recherche, setRecherche] = useState('')
  const { etat } = useApi(`nc-cas-${recherche}`, (signal) =>
    recherche.length >= 2
      ? apiRequest('GET', `/api/non-conformites/cas?q=${encodeURIComponent(recherche)}`, {
          schema: CasNcListeSchema,
          signal,
        })
      : Promise.resolve({ items: [] }),
  )
  return (
    <section className="rounded border p-4">
      <h3 className="mb-2 text-lg font-semibold">Pré-remplir depuis un dossier reçu</h3>
      <label>
        Dossier ou annonceur
        <input
          className={champ}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
          }}
        />
      </label>
      <button
        type="button"
        className="my-2 rounded border p-2"
        disabled={q.trim().length < 2}
        onClick={() => {
          setRecherche(q.trim())
        }}
      >
        Rechercher les réceptions
      </button>
      {etat.kind === 'loading' && <p>Recherche…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} />}
      {etat.kind === 'ready' && (
        <>
          <ul>
            {etat.data.items.map((c) => (
              <li key={`${c.plateformeId}-${c.donnees.dossier}-${c.donnees.theme}`}>
                <button
                  type="button"
                  className="my-1 w-full rounded border p-3 text-left"
                  onClick={() => {
                    onChoix(c)
                  }}
                >
                  {c.plateforme} · {c.donnees.dossier} · {c.donnees.annonceur} · {c.donnees.theme} ·{' '}
                  {c.donnees.semaine} · Qté {c.donnees.quantite} —{' '}
                  {c.validation ? 'Rattachement confirmé' : 'Rattachement à confirmer'}
                </button>
              </li>
            ))}
          </ul>
          {recherche && !etat.data.items.length && (
            <p>
              Aucune affiche reçue et rattachée pour cette recherche. La saisie libre reste
              disponible.
            </p>
          )}
        </>
      )}
    </section>
  )
}

const LIBELLES: Partial<Record<keyof NcDonnees, string>> = {
  semaine: 'Semaine(s)',
  quantite: 'Quantité concernée',
  annonceur: 'Annonceur',
  dossier: 'N° de dossier BC',
  theme: 'Thème',
  declarant: 'Déclarant',
  formats: 'Formats',
  types: 'Type de non-conformité',
  commentaireNC: 'Commentaire de non conformité',
  controle: 'Contrôle réception',
  imprimeur: 'Imprimeur',
  transporteur: 'Transporteur',
  gestionnaire: 'Gestionnaire préproduction',
  actionPreprod: 'Action préproduction',
  actionPlateforme: 'Action plateforme',
  decisionPlateforme: 'Décision plateforme (ancienne liste SharePoint)',
  commentaireDecisionPlateforme: 'Commentaire décision plateforme',
  avarie: 'Présence avarie de transport',
  reception: 'Réception',
  ncCond: 'Type NC conditionnement',
  ncBL: 'Type NC bon de livraison',
  controlePossible: 'Contrôle possible',
  detailVisuel: 'Détail contrôle visuel',
  imprimeurAutre: 'Imprimeur autre',
  transporteurAutre: 'Transporteur autre',
  reserve: 'Réserve sur la livraison',
  commentaire: 'Commentaires supplémentaires',
  numerosManquants: 'Numéros manquants',
  nbAffichesManquantes: 'Nombre d’affiches manquantes',
  mesureCm2: 'Mesure en cm2',
  statutEtat: 'Statut NC état affiches',
  commentaireAgence: 'Commentaire Préproduction / Plateforme agence',
  admin: 'Admin plateforme',
  numeroAffichesManquantes: 'Numéro d’affiches manquantes',
  ncQtesBT: 'Type NC quantités manquantes BT',
  nbColis: 'Nombre de colis manquants',
  nbPalettes: 'Nombre de palettes manquantes',
  afficheur: 'Nom de l’afficheur',
  region: 'Région',
  dateAff: 'Date d’affichage',
  qteRecue: 'Quantité reçue',
  qteManquante: 'Quantité manquante',
  lieu: 'Lieu de livraison',
}
const texteCellule = (v: unknown): string =>
  Array.isArray(v)
    ? v.map(texteCellule).join(' · ')
    : typeof v === 'string'
      ? v
      : typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : ''
export function SuiviNc({
  type,
  ouvrir,
  dossier,
  onNouvelle,
}: {
  type?: 'RECEPTION' | 'AGENCE'
  dossier?: string
  ouvrir?: number
  onNouvelle: () => void
}) {
  const { etat, recharger } = useApi(`nc-${type}`, (signal) =>
    apiRequest('GET', '/api/non-conformites', { schema: ListeNcSchema, signal }),
  )
  const { etat: moi } = useApi('nc-moi', () => getMe())
  const [demande, setDemande] = useState(type ?? ''),
    [filtre, setFiltre] = useState(''),
    [site, setSite] = useState(''),
    [statut, setStatut] = useState(''),
    [portee, setPortee] = useState(''),
    [origine, setOrigine] = useState(''),
    [decisionFiltre, setDecisionFiltre] = useState('')
  const [impression, setImpression] = useState<Nc | null>(null)
  const [fiche, setFiche] = useState<Nc | null>(null),
    [decision, setDecision] = useState<Nc | null>(null)
  const [fermee, setFermee] = useState<number | undefined>(undefined)
  const [colonnes, setColonnes] = useState<(keyof NcDonnees)[]>([
    'annonceur',
    'dossier',
    'semaine',
    'quantite',
    'types',
    'controle',
    'gestionnaire',
    'theme',
    'commentaireNC',
    'formats',
    'declarant',
  ])
  const items = etat.kind === 'ready' ? etat.data.items : []
  const rows = items.filter(
    (n) =>
      (!dossier || (n.donnees.dossier.match(/\d+/g) ?? []).some((v) => v === dossier)) &&
      (!filtre || JSON.stringify(n).toLocaleLowerCase().includes(filtre.toLocaleLowerCase())) &&
      (!demande || n.type === demande) &&
      (!site || n.plateforme === site) &&
      (!statut || n.statut === statut) &&
      (!portee || String(n.bloquante) === portee) &&
      (!origine || n.origine === origine) &&
      (!decisionFiltre ||
        (decisionFiltre === 'sans'
          ? !n.decisions.length
          : n.decisions.includes(decisionFiltre as (typeof NC_DECISIONS)[number]))),
  )
  const active = fiche ?? (ouvrir !== fermee ? (items.find((n) => n.id === ouvrir) ?? null) : null)
  function exporter() {
    const champs = Object.keys(NcDonneesSchema.parse({})) as (keyof NcDonnees)[]
    exporterExcel(
      'suivi-nc',
      [
        'N°',
        'Demande',
        'Plateforme',
        'Origine',
        'Bloquante',
        'Statut',
        'Décision',
        ...champs.map((k) => LIBELLES[k] ?? k),
        'Réponses plateforme',
        'Pièces jointes',
        'Créée le',
      ],
      rows.map((n) => [
        n.id,
        n.type === 'AGENCE' ? 'Agence' : 'Plateformes',
        n.plateforme,
        n.origine,
        n.bloquante,
        n.statut,
        n.decisions.join(' · '),
        ...champs.map((k) => texteCellule(n.donnees[k])),
        n.reponses
          .map((r) => `${r.date} · ${r.auteur} · ${r.traite ? 'Oui' : 'Non'} · ${r.commentaire}`)
          .join('\n'),
        n.fichiers.map((f) => f.nom).join('\n'),
        new Date(n.creeLe),
      ]),
    )
  }
  const peutDecider = moi.kind === 'ready' && can(moi.data, 'nonconformite.decider')
  const peutTraiter = moi.kind === 'ready' && can(moi.data, 'nonconformite.traiter')
  return (
    <>
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <h1 className="text-2xl font-semibold">Suivi des NC</h1>
        <Button type="button" onClick={onNouvelle}>
          Nouvelle demande
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <label>
          Demande
          <select
            aria-label="Demande"
            className={champ}
            value={demande}
            onChange={(e) => {
              setDemande(e.target.value)
            }}
          >
            <option value="">Toutes</option>
            <option value="RECEPTION">Plateformes</option>
            <option value="AGENCE">Agence</option>
          </select>
        </label>
        <input
          className={champ + ' max-w-xs'}
          aria-label="Rechercher une non-conformité"
          placeholder="Dossier, annonceur, thème…"
          value={filtre}
          onChange={(e) => {
            setFiltre(e.target.value)
          }}
        />
        <label className="text-sm">
          Plateforme
          <select
            className={champ}
            value={site}
            onChange={(e) => {
              setSite(e.target.value)
            }}
          >
            <option value="">Toutes</option>
            {[...new Set(items.map((n) => n.plateforme))].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        {type === 'RECEPTION' && (
          <>
            <label className="text-sm">
              Bloquante
              <select
                className={champ}
                value={portee}
                onChange={(e) => {
                  setPortee(e.target.value)
                }}
              >
                <option value="">Toutes</option>
                <option value="true">Bloquante</option>
                <option value="false">Non bloquante</option>
                <option value="null">Non précisé (formulaire)</option>
              </select>
            </label>
            <label className="text-sm">
              Statut
              <select
                className={champ}
                value={statut}
                onChange={(e) => {
                  setStatut(e.target.value)
                }}
              >
                <option value="">Tous</option>
                {NC_STATUTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Origine
              <select
                className={champ}
                value={origine}
                onChange={(e) => {
                  setOrigine(e.target.value)
                }}
              >
                <option value="">Toutes</option>
                {['Formulaire', 'Réception', 'Réception inconnue'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Décision
              <select
                className={champ}
                value={decisionFiltre}
                onChange={(e) => {
                  setDecisionFiltre(e.target.value)
                }}
              >
                <option value="">Toutes</option>
                <option value="sans">Pas encore décidé</option>
                {NC_DECISIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      {type === 'RECEPTION' && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {NC_STATUTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatut(statut === s ? '' : s)
              }}
              className="rounded-lg border bg-white p-4 text-left"
            >
              <span className="block text-sm">{s}</span>
              <strong className="text-2xl">{items.filter((n) => n.statut === s).length}</strong>
            </button>
          ))}
        </div>
      )}
      <div className="mb-3 flex gap-3">
        <details className="relative">
          <summary>Colonnes</summary>
          <div className="absolute z-10 max-h-96 w-80 overflow-auto rounded border bg-white p-3 shadow">
            {Object.entries(LIBELLES).map(([k, l]) => (
              <label key={k} className="block text-sm">
                <input
                  type="checkbox"
                  checked={colonnes.includes(k as keyof NcDonnees)}
                  onChange={(e) => {
                    setColonnes((c) =>
                      e.target.checked ? [...c, k as keyof NcDonnees] : c.filter((x) => x !== k),
                    )
                  }}
                />{' '}
                {l}
              </label>
            ))}
          </div>
        </details>
        <button type="button" className="text-sm underline" onClick={exporter}>
          Exporter
        </button>
      </div>
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <div className="overflow-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  'N°',
                  'Demande',
                  'Plateforme',
                  'Origine',
                  'Bloquante',
                  'Statut',
                  'Décision',
                  ...colonnes.map((k) => LIBELLES[k] ?? k),
                  'Pièces jointes',
                  'Créée le',
                  '',
                ].map((t) => (
                  <th key={t} className="whitespace-nowrap p-3 text-left">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr
                  key={n.id}
                  className="cursor-pointer border-t"
                  onClick={() => {
                    setFiche(n)
                  }}
                >
                  <td className="p-3">{n.id}</td>
                  <td
                    className={`p-3 font-semibold ${n.type === 'AGENCE' ? 'bg-orange-100 text-orange-900' : 'bg-purple-100 text-purple-900'}`}
                  >
                    {n.type === 'AGENCE' ? 'Agence' : 'Plateformes'}
                  </td>
                  <td className="p-3">{n.plateforme}</td>
                  <td className="p-3">{n.origine}</td>
                  <td className="p-3">
                    {n.bloquante === null ? '—' : n.bloquante ? 'Bloquante' : 'Non bloquante'}
                  </td>
                  <td className="whitespace-nowrap p-3">{n.statut}</td>
                  <td className="p-3">{n.decisions.join(' · ') || '—'}</td>
                  {colonnes.map((k) => (
                    <td key={k} className="min-w-36 max-w-md whitespace-pre-wrap p-3">
                      {texteCellule(n.donnees[k])}
                    </td>
                  ))}
                  <td className="p-3">{n.fichiers.length}</td>
                  <td className="whitespace-nowrap p-3">{date(n.creeLe)}</td>
                  <td
                    className="p-3"
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    {n.statut !== 'Pour statistique' &&
                      (peutDecider || (peutTraiter && n.statut === 'En cours plateforme')) && (
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            setDecision(n)
                          }}
                        >
                          {n.statut === 'En cours plateforme' ? 'Réponse' : 'Décision'}
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="p-6 text-slate-600">Aucune non-conformité avec ces filtres.</p>
          )}
        </div>
      )}
      {active && (
        <Modale
          titre={`Non-conformité n° ${active.id}`}
          ouverte
          large
          onOuverture={(o) => {
            if (!o) {
              setFiche(null)
              setFermee(ouvrir)
            }
          }}
        >
          <button
            type="button"
            className="mb-3 rounded border p-2"
            onClick={() => {
              setImpression(active)
              setFiche(null)
              setFermee(ouvrir)
            }}
          >
            Feuille de non-conformité
          </button>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt>Statut</dt>
            <dd>{active.statut}</dd>
            <dt>Affiches</dt>
            <dd>{active.afficheIds.join(', ') || '—'}</dd>
            <dt>Réception</dt>
            <dd>{active.receptionId ?? '—'}</dd>
            {Object.entries(active.donnees)
              .filter(([, v]) => texteCellule(v))
              .map(([k, v]) => (
                <div key={k} className="col-span-2 grid grid-cols-2 gap-3">
                  <dt className="font-medium">{LIBELLES[k as keyof NcDonnees] ?? k}</dt>
                  <dd className="whitespace-pre-wrap">{texteCellule(v)}</dd>
                </div>
              ))}
            <dt>Décision</dt>
            <dd>{active.decisions.join(' · ') || '—'}</dd>
            <dt>Commentaire décision</dt>
            <dd>{active.commentaireDecision}</dd>
            <dt>Auteur</dt>
            <dd>
              {active.auteur} · {date(active.creeLe)}
            </dd>
          </dl>
          <ul className="mt-4">
            {active.fichiers.map((f) => (
              <li key={f.id}>
                <a className="underline" href={`/api/non-conformites/fichiers/${f.id}`}>
                  {f.nom} ({Math.ceil(f.taille / 1024)} ko)
                </a>
              </li>
            ))}
          </ul>
        </Modale>
      )}
      {impression && (
        <ApercuNc
          items={[impression]}
          onFermer={() => {
            setImpression(null)
            recharger()
          }}
        />
      )}
      {decision && (
        <DecisionNc
          key={decision.id}
          nc={decision}
          preproduction={peutDecider}
          plateforme={peutTraiter}
          onFermer={() => {
            setDecision(null)
          }}
          onValidee={() => {
            setDecision(null)
            setFiche(null)
            recharger()
          }}
        />
      )}
    </>
  )
}
function DecisionNc({
  nc,
  preproduction,
  plateforme,
  onFermer,
  onValidee,
}: {
  nc: Nc
  preproduction: boolean
  plateforme: boolean
  onFermer: () => void
  onValidee: () => void
}) {
  const [decisions, setDecisions] = useState<string[]>(
      nc.decisions.filter((d) => d !== 'Traité par la plateforme'),
    ),
    [commentaire, setCommentaire] = useState(nc.commentaireDecision),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false)
  async function valider() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost(`/api/non-conformites/${nc.id}/decision`, {
        schema: NcSchema,
        body: { version: nc.version, decisions, commentaire },
      })
      onValidee()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre="Décision"
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      <p className="mb-4">
        NC n° {nc.id} · {nc.donnees.annonceur} · {nc.statut}
      </p>
      {preproduction && (
        <>
          <h3 className="my-3 font-semibold">1. Décision de la Pré-Prod</h3>
          <ChoixMultiples
            label="Décision (une ou plusieurs)"
            options={NC_DECISIONS.filter((d) => d !== 'Traité par la plateforme')}
            value={decisions}
            onChange={setDecisions}
          />
        </>
      )}
      <p className="my-3 text-sm">
        Statut après validation : <strong>{statutNc(nc.bloquante, decisions)}</strong>
      </p>
      <label className="block text-sm">
        Commentaire (facultatif)
        <textarea
          className={champ}
          rows={4}
          value={commentaire}
          onChange={(e) => {
            setCommentaire(e.target.value)
          }}
        />
      </label>
      {erreur !== null && <ErrorMessage error={erreur} />}
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" onClick={onFermer}>
          Annuler
        </button>
        <Button
          type="button"
          disabled={!preproduction || envoi || !decisions.length}
          onClick={() => void valider()}
        >
          Valider la décision
        </Button>
      </div>
      <h3 className="my-3 font-semibold">2. Réponse de la plateforme</h3>
      <ul>
        {nc.reponses.map((r, i) => (
          <li key={i} className="my-2 text-sm">
            {date(r.date)} · {r.auteur} · {r.traite ? 'Oui, traité' : 'Non, toujours en cours'} —{' '}
            {r.commentaire}
          </li>
        ))}
      </ul>
      {plateforme && nc.statut === 'En cours plateforme' && (
        <ReponsePlateforme nc={nc} onValidee={onValidee} />
      )}
    </Modale>
  )
}

function ReponsePlateforme({ nc, onValidee }: { nc: Nc; onValidee: () => void }) {
  const [choix, setChoix] = useState<boolean | null>(null),
    [commentaire, setCommentaire] = useState(''),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false)
  async function envoyer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost(`/api/non-conformites/${nc.id}/reponse`, {
        schema: NcSchema,
        body: { version: nc.version, traite: choix, commentaire },
      })
      onValidee()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <section className="space-y-3 rounded border p-4">
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <button
            type="button"
            key={String(v)}
            aria-pressed={choix === v}
            className="rounded border p-2"
            onClick={() => {
              setChoix(v)
            }}
          >
            {choix === v ? '✓ ' : ''}
            {v ? 'Oui, traité' : 'Non, toujours en cours'}
          </button>
        ))}
      </div>
      <label>
        Commentaire de la réponse
        <textarea
          className={champ}
          value={commentaire}
          onChange={(e) => {
            setCommentaire(e.target.value)
          }}
        />
      </label>
      {erreur !== null && <ErrorMessage error={erreur} />}
      <Button type="button" disabled={choix === null || envoi} onClick={() => void envoyer()}>
        Valider la réponse
      </Button>
    </section>
  )
}

export function AdminDeclarants() {
  const { etat, recharger } = useApi('admin-declarants', (signal) =>
    apiRequest('GET', '/api/non-conformites/declarants', { schema: DeclarantsSchema, signal }),
  )
  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="text-sm text-slate-500">Administration · Référentiels</p>
      <h1 className="mb-5 text-2xl font-semibold">Déclarants des non-conformités</h1>
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <EditionDeclarants key={etat.data.version} data={etat.data} onEnregistree={recharger} />
      )}
    </main>
  )
}
function EditionDeclarants({
  data,
  onEnregistree,
}: {
  data: z.infer<typeof DeclarantsSchema>
  onEnregistree: () => void
}) {
  const [noms, setNoms] = useState(data.noms.join('\n')),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false)
  const [remplacer, setRemplacer] = useState(false)
  const normaliser = (n: string) =>
    n
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('fr')
  function nettoyer(liste: string[]) {
    const uniques = new Map<string, string>()
    for (const nom of liste) {
      const propre = nom.replace(/\s+/g, ' ').trim()
      if (propre && !uniques.has(normaliser(propre))) uniques.set(normaliser(propre), propre)
    }
    return [...uniques.values()]
  }
  async function importer(fichier: File) {
    setErreur(null)
    try {
      const brutes = /\.xlsx$/i.test(fichier.name)
        ? (await lireExcel(fichier)).map((l) => l[0] ?? '')
        : (await fichier.text()).split(/\r?\n/).map((l) => l.split(/[;,\t]/)[0] ?? '')
      const lignes = brutes.map((n) => n.trim()).filter(Boolean)
      if (['declarant', 'declarants', 'nom'].includes(normaliser(lignes[0] ?? ''))) lignes.shift()
      if (!lignes.length) throw new Error('Aucun déclarant trouvé dans la première colonne.')
      setNoms((anciens) =>
        nettoyer([...(remplacer ? [] : anciens.split(/\r?\n/)), ...lignes]).join('\n'),
      )
    } catch (e) {
      setErreur(e)
    }
  }
  async function sauver() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost('/api/non-conformites/declarants', {
        schema: DeclarantsSchema,
        body: { version: data.version, noms: nettoyer(noms.split(/\r?\n/)) },
      })
      onEnregistree()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <section className="space-y-4 rounded border bg-white p-5">
      <label className="block text-sm">
        Un déclarant par ligne
        <textarea
          className={champ}
          rows={12}
          value={noms}
          onChange={(e) => {
            setNoms(e.target.value)
          }}
        />
      </label>
      <label className="block text-sm">
        Importer la première colonne d’un fichier Excel, texte ou CSV
        <input
          type="file"
          accept=".xlsx,.txt,.csv"
          className={champ}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importer(f)
            e.target.value = ''
          }}
        />
      </label>
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={remplacer}
          onChange={(e) => {
            setRemplacer(e.target.checked)
          }}
        />{' '}
        Remplacer la liste lors de l’import
      </label>
      <button
        type="button"
        className="text-sm underline"
        onClick={() => {
          exporterExcel(
            'declarants-nc',
            ['Déclarant'],
            nettoyer(noms.split(/\r?\n/)).map((n) => [n]),
          )
        }}
      >
        Exporter en Excel
      </button>
      {erreur !== null && <ErrorMessage error={erreur} />}
      <Button type="button" disabled={envoi} onClick={() => void sauver()}>
        Enregistrer le référentiel
      </Button>
    </section>
  )
}
