// ECR-NAV-01 / EX-TRA-008 : coque de l'application. Bandeau 1 (bleu nuit) : logo, site, profil de dev, alertes, état de
// l'API ; bandeau 2 (blanc) : onglets à liste déroulante. Pas de menu latéral. Source : maquette `core.js`
// (`renderTopbar`, `renderMenubar`, `openTabMenu`) ; éléments propres à la maquette NON reproduits (hors cible) :
// « Simuler », interrupteur « Besoins », « Besoins couverts », menu « Aide », enveloppe de mails simulée.
import * as Popover from '@radix-ui/react-popover'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  CompteursReceptionSchema,
  HealthResponseSchema,
  ListeAlertesSchema,
  MesSitesSchema,
  type MeResponse,
} from '@circe/shared'
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { apiGet, apiRequest } from '../../lib/api-client.ts'
import {
  PROFIL_DEV_DISPONIBLE,
  PROFILS_DEV,
  choisirProfilDev,
  profilDevChoisi,
} from '../../lib/dev-profil.ts'
import { describeError } from '../../lib/error-text.ts'
import { ApiError } from '../../lib/api-client.ts'
import { abonnerSite, getSiteId, setSiteId } from '../../lib/site.ts'
import { can, getMe, resetMe } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { NAV, type CleBadge, type EntreeNav, type OngletNav } from './nav-config.ts'

type Compteurs = Partial<Record<CleBadge, { n: number; chaud: boolean }>>

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300'

/** Recharge la page : toutes les données (et /api/me) sont relues avec la nouvelle identité ou le nouveau site. */
function recharger() {
  resetMe()
  window.location.reload()
}

export function Shell({ children }: { children: ReactNode }) {
  const { etat: moi, recharger: reessayerMoi } = useApi('shell-me', () => getMe())
  const navigate = useNavigate()
  const chemin = useRouterState({ select: (s) => s.location.pathname })
  // Chargement direct d'une URL (la garde beforeLoad ne tourne pas à l'hydratation) : même page de refus que la
  // navigation interne. Confort d'affichage seulement : le serveur reste juge (RG-REC-002).
  useEffect(() => {
    if (moi.kind !== 'ready') return
    const normalise = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : p)
    const entree = NAV.flatMap((o) => o.entrees).find((e) => normalise(e.to) === normalise(chemin))
    if (entree && !can(moi.data, entree.permission))
      void navigate({
        to: '/acces-refuse',
        search: { permission: entree.permission, motif: 'interdit' },
        replace: true,
      })
  }, [moi, chemin, navigate])
  return (
    <div className="flex min-h-screen flex-col">
      <header className="print:hidden">
        <Bandeau1 moi={moi} onRetryMe={reessayerMoi} />
        <Bandeau2 moi={moi} />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}

type EtatMoi = ReturnType<typeof useApi<MeResponse>>['etat']

function useCompteurs(me: MeResponse | null): Compteurs {
  const voitAlertes = me !== null && can(me, 'alerte.consulter')
  const voitReception =
    me !== null && (can(me, 'reception.sas.consulter') || can(me, 'reception.inconnue.consulter'))
  const site = useSyncExternalStore(abonnerSite, getSiteId, () => null)
  const alertes = useApi(`shell-alertes-${String(voitAlertes)}-${String(site)}`, (signal) =>
    voitAlertes
      ? apiRequest('GET', '/api/alertes?etat=OUVERTES', { schema: ListeAlertesSchema, signal })
      : Promise.resolve(null),
  )
  const reception = useApi(`shell-reception-${String(voitReception)}-${String(site)}`, (signal) =>
    voitReception
      ? apiRequest('GET', '/api/reception/compteurs', { schema: CompteursReceptionSchema, signal })
      : Promise.resolve(null),
  )
  const compteurs: Compteurs = {}
  if (alertes.etat.kind === 'ready' && alertes.etat.data) {
    compteurs.alertes = { n: alertes.etat.data.alertes.length, chaud: false }
  }
  if (reception.etat.kind === 'ready' && reception.etat.data) {
    const { palettesAControler, affichesOrphelines } = reception.etat.data
    if (palettesAControler !== null) compteurs.palettes = { n: palettesAControler, chaud: false }
    if (affichesOrphelines !== null)
      compteurs.inconnues = { n: affichesOrphelines, chaud: affichesOrphelines > 0 }
  }
  return compteurs
}

function Pastille({ n, chaud, titre }: { n: number; chaud: boolean; titre?: string }) {
  if (n <= 0) return null
  return (
    <span
      title={titre}
      className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white ${
        chaud ? 'bg-red-600' : 'bg-slate-500'
      }`}
    >
      {n}
    </span>
  )
}

// ───────────────────────── Bandeau 1 ─────────────────────────

function Bandeau1({ moi, onRetryMe }: { moi: EtatMoi; onRetryMe: () => void }) {
  const me = moi.kind === 'ready' ? moi.data : null
  const compteurs = useCompteurs(me)
  const alertes = compteurs.alertes
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-[#1b2a44] px-4 py-2 text-white">
      <Link
        to="/"
        aria-label="Circé : écran d’ouverture"
        className={`text-xl font-semibold tracking-tight ${FOCUS}`}
      >
        Circ<span className="text-sky-300">é</span>
      </Link>
      <SelecteurSite me={me} />
      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        {PROFIL_DEV_DISPONIBLE && <SelecteurProfil me={me} />}
        {moi.kind === 'loading' && (
          <span data-testid="shell-me-loading" className="text-sm text-slate-300">
            Chargement du profil…
          </span>
        )}
        {moi.kind === 'error' && (
          <span data-testid="shell-me-error" role="alert" className="text-sm text-red-200">
            {moi.error instanceof ApiError ? describeError(moi.error).titre : 'Profil indisponible'}
            {' · '}
            <button type="button" className={`underline ${FOCUS}`} onClick={onRetryMe}>
              Réessayer
            </button>
          </span>
        )}
        {me && (
          <Link
            to="/moi"
            className={`text-sm text-slate-200 hover:underline ${FOCUS}`}
            data-testid="shell-utilisateur"
          >
            {me.nom ?? me.identifiantExterne}
          </Link>
        )}
        {me && can(me, 'alerte.consulter') && (
          <Link
            to="/pilotage/alertes"
            aria-label={alertes ? `Alertes : ${String(alertes.n)} ouvertes` : 'Alertes'}
            title={alertes ? `Alertes ouvertes (${String(alertes.n)})` : 'Alertes'}
            data-testid="shell-cloche"
            className={`relative inline-flex items-center rounded p-1 hover:bg-white/10 ${FOCUS}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
              <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
            </svg>
            {alertes && alertes.n > 0 && (
              <span
                data-testid="shell-cloche-badge"
                aria-hidden="true"
                className={`ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white ${
                  alertes.chaud ? 'bg-red-600' : 'bg-slate-500'
                }`}
              >
                {alertes.n}
              </span>
            )}
          </Link>
        )}
        <EtatApi />
      </div>
    </div>
  )
}

/** Indicateur « État de l'API » (relayé par /api/health), gardé dans un coin du bandeau (ex. page d'accueil). */
function EtatApi() {
  const { etat, recharger: reessayer } = useApi('shell-health', (signal) =>
    apiGet('/api/health', HealthResponseSchema, { signal }),
  )
  return (
    <span className="text-xs text-slate-300" aria-live="polite">
      {etat.kind === 'loading' && <span data-testid="health-loading">API : …</span>}
      {etat.kind === 'error' && (
        <span data-testid="health-error" role="alert" className="text-red-200">
          {etat.error instanceof ApiError ? etat.error.body.message : 'Erreur inattendue'}{' '}
          <button type="button" className={`underline ${FOCUS}`} onClick={reessayer}>
            Réessayer
          </button>
        </span>
      )}
      {etat.kind === 'ready' && (
        <span data-testid="health-ready">
          État de l’API : <strong>API : {etat.data.status}</strong> · base :{' '}
          <strong>base : {etat.data.database}</strong>
        </span>
      )}
    </span>
  )
}

const CHAMP =
  'rounded border border-white/30 bg-[#24375a] px-2 py-1 text-sm text-white focus-visible:outline-2 focus-visible:outline-sky-300'

function SelecteurSite({ me }: { me: MeResponse | null }) {
  const site = useSyncExternalStore(abonnerSite, getSiteId, () => null)
  const { etat, recharger: reessayer } = useApi(`shell-sites-${me?.userId ?? 'x'}`, (signal) =>
    me
      ? apiRequest('GET', '/api/me/sites', { schema: MesSitesSchema, siteId: null, signal })
      : Promise.resolve(null),
  )
  if (!me) return null
  if (etat.kind === 'loading') return <span className="text-sm text-slate-300">Sites…</span>
  if (etat.kind === 'error')
    return (
      <span role="alert" className="text-sm text-red-200">
        Sites indisponibles{' '}
        <button type="button" className={`underline ${FOCUS}`} onClick={reessayer}>
          Réessayer
        </button>
      </span>
    )
  const sites = etat.data?.sites ?? []
  // Site mémorisé qui n'est plus dans le périmètre : « Tous les sites » (le serveur le refuserait, RG-REC-001).
  const valeur = site !== null && sites.some((s) => s.id === site) ? String(site) : 'ALL'
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-300">Site</span>
      <select
        className={CHAMP}
        value={valeur}
        data-testid="shell-site"
        onChange={(e) => {
          setSiteId(e.target.value === 'ALL' ? null : Number(e.target.value))
          recharger()
        }}
      >
        <option value="ALL">Tous les sites</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nom}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Profil de DEV (Q-001) : jamais en production, le relais ignore le cookie hors `dev.<rôle>` valide. */
function SelecteurProfil({ me }: { me: MeResponse | null }) {
  const [choisi] = useState(() => (typeof document === 'undefined' ? null : profilDevChoisi()))
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-300">Profil (dev)</span>
      <select
        className={CHAMP}
        data-testid="shell-profil"
        value={choisi ?? ''}
        onChange={(e) => {
          choisirProfilDev(e.target.value === '' ? null : e.target.value)
          setSiteId(null)
          recharger()
        }}
      >
        <option value="">Par défaut{me && !choisi ? ` (${me.identifiantExterne})` : ''}</option>
        {PROFILS_DEV.map((p) => (
          <option key={p.identifiant} value={p.identifiant}>
            {p.libelle} ({p.identifiant})
          </option>
        ))}
      </select>
    </label>
  )
}

// ───────────────────────── Bandeau 2 ─────────────────────────

function estCourante(
  entree: EntreeNav,
  location: { pathname: string; search: Record<string, unknown> },
): boolean {
  const chemin = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : p)
  if (chemin(location.pathname) !== chemin(entree.to)) return false
  const correspond = (candidate: EntreeNav) =>
    Object.entries(candidate.search ?? {}).every(([k, v]) => {
      const courant = location.search[k]
      // Valeur par défaut de l'écran Préparation : `type=fixe`.
      return (
        (typeof courant === 'string'
          ? courant
          : k === 'type'
            ? 'fixe'
            : k === 'pour'
              ? 'deroulant'
              : k === 'tab'
                ? entree.to === '/coordination/themes'
                  ? 'proches'
                  : 'suivi'
                : '') === v
      )
    })
  const candidates = NAV.flatMap((o) => o.entrees).filter(
    (e) => chemin(e.to) === chemin(location.pathname) && correspond(e),
  )
  candidates.sort((a, b) => Object.keys(b.search ?? {}).length - Object.keys(a.search ?? {}).length)
  return candidates[0]?.id === entree.id
}

function Bandeau2({ moi }: { moi: EtatMoi }) {
  const me = moi.kind === 'ready' ? moi.data : null
  const [ouvert, setOuvert] = useState<string | null>(null)
  const location = useRouterState({ select: (s) => s.location })
  const compteurs = useCompteurs(me)
  return (
    <nav aria-label="Navigation principale" className="border-b border-slate-200 bg-white px-2">
      <ul className="flex flex-wrap items-center">
        {NAV.map((onglet) => (
          <li key={onglet.id}>
            <Onglet
              onglet={onglet}
              me={me}
              ouvert={ouvert === onglet.id}
              onOuvert={(o) => {
                setOuvert(o ? onglet.id : null)
              }}
              location={location}
              compteurs={compteurs}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Onglet({
  onglet,
  me,
  ouvert,
  onOuvert,
  location,
  compteurs,
}: {
  onglet: OngletNav
  me: MeResponse | null
  ouvert: boolean
  onOuvert: (ouvert: boolean) => void
  location: { pathname: string; search: Record<string, unknown> }
  compteurs: Compteurs
}) {
  const actif = onglet.entrees.some((e) => estCourante(e, location))
  // Compteur de l'onglet : celui de sa première page en alerte (sinon de sa première page comptée), comme la maquette.
  const comptees = onglet.entrees
    .filter((e) => e.badge && (me === null || can(me, e.permission)))
    .map((e) => ({ e, c: e.badge ? compteurs[e.badge] : undefined }))
    .filter((x) => x.c && x.c.n > 0)
  const tete = comptees.find((x) => x.c?.chaud) ?? comptees[0]

  function touches(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const liens = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('a[href], [data-menu-item]'),
    )
    const i = liens.indexOf(document.activeElement as HTMLElement)
    const suivant = event.key === 'ArrowDown' ? i + 1 : i - 1
    liens[(suivant + liens.length) % liens.length]?.focus()
    event.preventDefault()
  }

  return (
    <Popover.Root open={ouvert} onOpenChange={onOuvert}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-current={actif ? 'page' : undefined}
          data-testid={`onglet-${onglet.id}`}
          className={`flex items-center gap-1 border-b-2 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 ${
            actif ? 'border-sky-600 text-sky-800' : 'border-transparent text-slate-700'
          } ${ouvert ? 'bg-slate-100' : ''} focus-visible:outline-2 focus-visible:outline-sky-600`}
        >
          {onglet.titre}
          {tete?.c && <Pastille n={tete.c.n} chaud={tete.c.chaud} />}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={1}
          aria-label={onglet.titre}
          data-testid={`menu-${onglet.id}`}
          className="z-50 min-w-64 max-w-[22rem] rounded-b-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <ul onKeyDown={touches}>
            {onglet.entrees.map((entree, index) => (
              <li key={entree.id}>
                {entree.groupe && onglet.entrees[index - 1]?.groupe !== entree.groupe && (
                  <p className="mt-2 border-t px-3 py-2 text-xs font-semibold text-slate-500">
                    {entree.groupe}
                  </p>
                )}
                <EntreeMenu
                  entree={entree}
                  me={me}
                  courante={estCourante(entree, location)}
                  compteur={entree.badge ? compteurs[entree.badge] : undefined}
                  onChoisi={() => {
                    onOuvert(false)
                  }}
                />
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function EntreeMenu({
  entree,
  me,
  courante,
  compteur,
  onChoisi,
}: {
  entree: EntreeNav
  me: MeResponse | null
  courante: boolean
  compteur: { n: number; chaud: boolean } | undefined
  onChoisi: () => void
}) {
  const autorise = me !== null && can(me, entree.permission)
  const contenu = (
    <>
      <span>{entree.libelle}</span>
      {autorise && compteur && <Pastille n={compteur.n} chaud={compteur.chaud} />}
    </>
  )
  // Droits : l'entrée est grisée (maquette : `dim`) avec une infobulle ; le serveur reste juge (page de refus conservée).
  if (!autorise)
    return (
      <span
        data-menu-item=""
        tabIndex={0}
        aria-disabled="true"
        title={`Réservé aux profils ayant le droit « ${entree.permission} »`}
        className="flex cursor-not-allowed items-center px-4 py-2 text-sm text-slate-400"
      >
        {contenu}
      </span>
    )
  return (
    <Link
      to={entree.to}
      search={entree.search}
      aria-current={courante ? 'page' : undefined}
      onClick={onChoisi}
      className={`flex items-center px-4 py-2 text-sm hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-600 ${
        courante ? 'bg-sky-50 font-medium text-sky-900' : 'text-slate-800'
      }`}
    >
      {contenu}
    </Link>
  )
}
