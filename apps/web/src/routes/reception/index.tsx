import { BoutonExportTableau } from '../../components/ui/export-tableau.tsx'
import { useSelectionGlissee } from '../../lib/selection-glissee.ts'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as Popover from '@radix-ui/react-popover'
import {
  CONTROLES_LIGNE,
  ListeAttenduesResponseSchema,
  STATUTS_LIGNE,
  formatSemaineIso,
  semaineIsoDe,
  type LigneAttendue,
  type ListeAttenduesResponse,
} from '@circe/shared'
import { useEffect, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { BonLivraison } from '../../components/reception/bon-livraison.tsx'
import { ModaleReceptionInconnue } from '../../components/reception/modale-reception-inconnue.tsx'
import { SasEtControle } from '../../components/reception/sas-controle.tsx'
import { ApercuFeuilles } from '../../components/reception/apercu-feuilles.tsx'
import { ModaleVisuel } from '../../components/reception/modale-visuel.tsx'
import { Panier } from '../../components/reception/panier.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { FiltreListe } from '../../components/ui/filtre-liste.tsx'
import { Pastille, type Ton } from '../../components/ui/pastille.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { LIBELLE_CONTROLE, LIBELLE_STATUT, libelleSemaine } from '../../lib/libelles.ts'
import { ajouter, messageAjout, usePanier } from '../../lib/panier.ts'
import { can, getMe } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// ECR-REC-01 — Réception des affiches, étape 1 : tableau « Réceptions attendues » (REC-P02).
// Paramètres de liste dans l'URL (partageable). Filtrage, tri et pagination faits par l'API.

const TRIS = [
  'dossier',
  'annonceur',
  'theme',
  'depart',
  'recu',
  'attendu',
  'reste',
  'statut',
  'controle',
  'site',
] as const
type Tri = (typeof TRIS)[number]

// Le routeur lit `?q=900006` comme un nombre : les filtres texte sont ramenés en chaîne.
const texte = z.coerce.string().optional()
const SearchSchema = z.object({
  q: texte,
  statut: texte,
  depart: texte,
  format: texte,
  controle: texte,
  annonceur: texte,
  sort: z.enum(TRIS).optional(),
  ordre: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  /** ECR-REC-02 : réception ouverte en contrôle (`?palette=<id>`). */
  palette: z.coerce.number().int().positive().optional(),
})
type Search = z.infer<typeof SearchSchema>

export const Route = createFileRoute('/reception/')({
  validateSearch: SearchSchema,
  component: ReceptionDesAffiches,
})

const TON_STATUT: Record<LigneAttendue['statut'], Ton> = {
  ATTENDUE: 'info',
  PARTIELLE: 'important',
  COMPLETE: 'ok',
  SURPLUS: 'surveiller',
}

/** Libellés des options du filtre Contrôle (maquette ECR-REC-01). */
const LIBELLE_OPTION_CONTROLE = {
  ...LIBELLE_CONTROLE,
  CONTROLEE: 'Contrôlée (feuille réimprimable)',
}

const liste = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : [])
const jetons = (q: string | undefined) => (q ? q.split(/[\s,;+]+/).filter(Boolean) : [])

function versQuery(search: Search): string {
  const params = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(search) as [string, string | number | undefined][]) {
    if (valeur !== undefined && valeur !== '') params.set(cle, String(valeur))
  }
  return params.toString()
}

// RG-REC-014 : colonnes visibles, et colonnes masquées accessibles par « Colonnes ».
type IdColonne =
  | 'site'
  | 'dossier'
  | 'visuel'
  | 'depart'
  | 'recuAttendu'
  | 'reste'
  | 'statut'
  | 'controle'
  | 'livraison'
  | 'da'
  | 'annonceur'
  | 'theme'
  | 'format'
  | 'attendu'
  | 'recu'
  | 'affiches'
interface Colonne {
  id: IdColonne
  libelle: string
  tri?: Tri
  visibleParDefaut: boolean
  cellule: (l: LigneAttendue, annee: number) => ReactNode
}
const COLONNES: Colonne[] = [
  { id: 'site', libelle: 'Site', tri: 'site', visibleParDefaut: true, cellule: (l) => l.site.nom },
  {
    id: 'dossier',
    libelle: 'Dossier',
    tri: 'dossier',
    visibleParDefaut: true,
    cellule: (l) => <span className="font-mono">{l.dossier ?? '—'}</span>,
  },
  {
    id: 'visuel',
    libelle: 'Annonceur · thème',
    tri: 'annonceur',
    visibleParDefaut: true,
    cellule: (l) => (
      <>
        <strong>{l.annonceur ?? '—'}</strong>
        {l.theme && <span className="block text-slate-600">{l.theme}</span>}
      </>
    ),
  },
  {
    id: 'depart',
    libelle: 'Départ',
    tri: 'depart',
    visibleParDefaut: true,
    cellule: (l, annee) => libelleSemaine(l.depart, annee),
  },
  {
    id: 'recuAttendu',
    libelle: 'Reçu / attendu',
    tri: 'recu',
    visibleParDefaut: true,
    cellule: (l) => (
      <>
        {l.recu} / {l.attendu}
        {l.affiches.length > 0 && (
          <span className="block text-xs text-slate-500">n° {l.affiches.join(', ')}</span>
        )}
      </>
    ),
  },
  { id: 'reste', libelle: 'Reste', tri: 'reste', visibleParDefaut: true, cellule: (l) => l.reste },
  {
    id: 'statut',
    libelle: 'Statut',
    tri: 'statut',
    visibleParDefaut: true,
    cellule: (l) => <Pastille ton={TON_STATUT[l.statut]}>{LIBELLE_STATUT[l.statut]}</Pastille>,
  },
  {
    id: 'controle',
    libelle: 'Contrôle',
    tri: 'controle',
    visibleParDefaut: true,
    cellule: (l) =>
      l.controle === 'RIEN_RECU' ? (
        '—'
      ) : (
        <Pastille ton={l.controle === 'CONTROLEE' ? 'ok' : 'surveiller'}>
          {LIBELLE_CONTROLE[l.controle]}
        </Pastille>
      ),
  },
  {
    id: 'livraison',
    libelle: 'Livraison prévue',
    visibleParDefaut: true,
    cellule: (l) => l.livraisonPrevue ?? '—',
  },
  { id: 'da', libelle: 'DA', visibleParDefaut: false, cellule: (l) => l.da ?? '—' },
  {
    id: 'annonceur',
    libelle: 'Annonceur',
    tri: 'annonceur',
    visibleParDefaut: false,
    cellule: (l) => l.annonceur ?? '—',
  },
  {
    id: 'theme',
    libelle: 'Thème',
    tri: 'theme',
    visibleParDefaut: false,
    cellule: (l) => l.theme ?? '—',
  },
  { id: 'format', libelle: 'Format', visibleParDefaut: false, cellule: (l) => l.format ?? '—' },
  {
    id: 'attendu',
    libelle: 'Attendu',
    tri: 'attendu',
    visibleParDefaut: false,
    cellule: (l) => l.attendu,
  },
  { id: 'recu', libelle: 'Reçu', tri: 'recu', visibleParDefaut: false, cellule: (l) => l.recu },
  {
    id: 'affiches',
    libelle: 'N° d’affiche',
    visibleParDefaut: false,
    cellule: (l) => (l.affiches.length > 0 ? l.affiches.join(', ') : '—'),
  },
]

function ReceptionDesAffiches() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [plusDeFiltres, setPlusDeFiltres] = useState(Boolean(search.controle ?? search.annonceur))
  const [colonnes, setColonnes] = useState<IdColonne[]>(
    COLONNES.filter((c) => c.visibleParDefaut).map((c) => c.id),
  )
  const [panier, setPanier] = usePanier()
  const [message, setMessage] = useState<string | null>(null)
  const [selection, setSelection] = useState<number[]>([])
  const [visuel, setVisuel] = useState<number | null>(null)
  const [modalePhoto, setModalePhoto] = useState(false)
  const [modaleInconnue, setModaleInconnue] = useState(false)
  const [messageReception, setMessageReception] = useState<string | null>(null)
  const [versionSas, setVersionSas] = useState(0)
  const [feuilles, setFeuilles] = useState<number[] | null>(null)
  const { etat: moi } = useApi('moi', () => getMe())
  // Confort d'affichage : le serveur reste juge (RG-REC-002).
  const peutSaisir = moi.kind === 'ready' && can(moi.data, 'reception.saisir')
  const peutCreerInconnue = moi.kind === 'ready' && can(moi.data, 'reception.inconnue.creer')
  const peutControler = moi.kind === 'ready' && can(moi.data, 'reception.controler')
  const peutImprimer = moi.kind === 'ready' && can(moi.data, 'reception.imprimer')
  const query = versQuery(search)
  const { etat, recharger } = useApi(`attendues?${query}`, (signal) =>
    apiRequest('GET', `/api/receptions-attendues${query ? `?${query}` : ''}`, {
      schema: ListeAttenduesResponseSchema,
      signal,
    }),
  )

  function mettreAuPanier(lignes: LigneAttendue[]) {
    const r = ajouter(panier, lignes)
    setPanier(r.panier)
    setMessage(messageAjout(r.ajoutees))
    setSelection([])
  }

  function changer(partiel: Partial<Search>) {
    void navigate({
      search: (prev) => ({ ...prev, ...partiel, page: partiel.page ?? undefined }),
      replace: true,
    })
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Réception</p>
      <h1 className="text-2xl font-semibold">Réception des affiches</h1>

      {messageReception && (
        <p
          role="status"
          className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm"
          data-testid="message-reception"
        >
          {messageReception}
        </p>
      )}
      {etat.kind === 'ready' && (
        <RetourRecherche
          data={etat.data}
          onAfficher={(dims) => {
            changer(dims)
          }}
        />
      )}

      <section
        className="mt-4 rounded-lg border border-slate-200 bg-white"
        aria-labelledby="titre-attendues"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <h3 id="titre-attendues" className="mr-2 font-medium">
            Réceptions attendues
          </h3>
        </div>
        <BandeauRecherche
          valeur={search.q ?? ''}
          onRecherche={(q) => {
            changer({ q: q || undefined })
          }}
          onPhotoBl={
            peutSaisir
              ? () => {
                  setModalePhoto(true)
                }
              : null
          }
          onInconnue={
            peutCreerInconnue
              ? () => {
                  setModaleInconnue(true)
                }
              : null
          }
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <Filtres
            search={search}
            data={etat.kind === 'ready' ? etat.data : null}
            plusDeFiltres={plusDeFiltres}
            onPlus={() => {
              setPlusDeFiltres(true)
            }}
            onChange={changer}
          />
          <SelecteurColonnes visibles={colonnes} onChange={setColonnes} />
          {peutSaisir && etat.kind === 'ready' && (
            <button
              type="button"
              disabled={selection.length === 0}
              className="rounded-md bg-slate-900 px-2.5 py-1 text-sm text-white disabled:bg-slate-300"
              onClick={() => {
                mettreAuPanier(etat.data.items.filter((l) => selection.includes(l.id)))
              }}
            >
              Ajouter au panier ({selection.length})
            </button>
          )}
        </div>
        <div aria-live="polite" aria-busy={etat.kind === 'loading'}>
          {etat.kind === 'loading' && <Squelette />}
          {etat.kind === 'error' && (
            <div className="p-3">
              <ErrorMessage error={etat.error} onRetry={recharger} />
            </div>
          )}
          {etat.kind === 'ready' && (
            <Tableau
              data={etat.data}
              search={search}
              colonnes={colonnes}
              onChange={changer}
              actions={
                peutSaisir
                  ? {
                      auPanier: new Set(panier.map((p) => p.ligneAttendueId)),
                      selection,
                      onSelection: setSelection,
                      onAjouter: (l) => {
                        mettreAuPanier([l])
                      },
                    }
                  : null
              }
              onVisuel={setVisuel}
              onFeuille={peutImprimer ? setFeuilles : null}
            />
          )}
        </div>
      </section>

      {message && (
        <p role="status" className="mt-2 text-sm text-slate-700" data-testid="message-panier">
          {message}
        </p>
      )}
      {peutSaisir && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panier panier={panier} onChange={setPanier} />
          <BonLivraison
            panier={panier}
            modalePhoto={modalePhoto}
            onModalePhoto={setModalePhoto}
            onValidee={(ids, msg) => {
              // RG-REC-045 : les lignes validées quittent le panier, le reste demeure pour le BL suivant.
              const restantes = panier.filter((p) => !ids.includes(p.ligneAttendueId))
              setPanier(restantes)
              setMessageReception(
                restantes.length > 0
                  ? `${msg} Il reste ${String(restantes.length)} ligne(s) au panier.`
                  : msg,
              )
              setVersionSas((v) => v + 1)
              recharger()
            }}
          />
        </div>
      )}
      <SasEtControle
        ouverte={search.palette ?? null}
        rafraichir={versionSas}
        peutControler={peutControler}
        onOuvrir={(id) => {
          void navigate({
            search: (prev) => ({ ...prev, palette: id ?? undefined }),
            replace: true,
          })
        }}
      />
      {feuilles && (
        <ApercuFeuilles
          afficheIds={feuilles}
          avecEtiquettes
          onFermer={() => {
            setFeuilles(null)
          }}
        />
      )}
      {modaleInconnue && (
        <ModaleReceptionInconnue
          siteParDefaut={moi.kind === 'ready' ? moi.data.siteId : null}
          onFermer={() => {
            setModaleInconnue(false)
          }}
          onCreee={(msg) => {
            setModaleInconnue(false)
            setMessageReception(msg)
          }}
        />
      )}
      {visuel !== null && (
        <ModaleVisuel
          ligneId={visuel}
          onFermer={() => {
            setVisuel(null)
          }}
        />
      )}
    </main>
  )
}

/** RG-REC-011 / RG-REC-012 : trois façons de trouver les dossiers ; recherche à la frappe, en puces. */
function BandeauRecherche({
  valeur,
  onRecherche,
  onPhotoBl,
  onInconnue,
}: {
  valeur: string
  onRecherche: (q: string) => void
  /** RG-REC-026 : joindre la photo du BL (sans lecture automatique en V1, Q-112). */
  onPhotoBl: (() => void) | null
  /** RG-REC-095 : « Réception inconnue… » (ECR-REC-08). */
  onInconnue: (() => void) | null
}) {
  const [saisie, setSaisie] = useState(valeur)
  useEffect(() => {
    if (saisie.trim() === valeur) return
    const t = setTimeout(() => {
      onRecherche(saisie.trim())
    }, 250)
    return () => {
      clearTimeout(t)
    }
  }, [saisie, valeur, onRecherche])
  const puces = jetons(valeur)
  function retirer(jeton: string) {
    const reste = puces.filter((p) => p !== jeton).join(' ')
    setSaisie(reste)
    onRecherche(reste)
  }
  return (
    <div className="p-3" role="search" aria-label="Trouver les dossiers du BL">
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-60 flex-1">
          <span className="sr-only">Par n° de dossier</span>
          <input
            id="recherche-dossier"
            type="search"
            value={saisie}
            onChange={(e) => {
              setSaisie(e.target.value)
            }}
            placeholder="N° de dossier, de DA, annonceur…"
            className="h-10 w-full rounded border border-slate-300 px-3 text-sm"
          />
        </label>
        <span className="text-sm text-slate-500">ou</span>
        <button
          type="button"
          disabled={!onPhotoBl}
          className="h-10 rounded border px-3 text-sm disabled:opacity-40"
          onClick={() => onPhotoBl?.()}
          title="Joindre la photo du bon de livraison"
        >
          Photo du BL
        </button>
        <button
          type="button"
          disabled
          className="h-10 rounded border px-3 text-sm opacity-40"
          title="La reconnaissance visuelle nécessite le fournisseur prévu en Q-112"
        >
          Photo d’une affiche
        </button>
        <button
          type="button"
          disabled={!onInconnue}
          className="h-10 border-l px-3 text-sm disabled:opacity-40"
          onClick={() => onInconnue?.()}
        >
          Réception inconnue
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Tapez ou scannez un n° de dossier, de DA ou un annonceur, puis « Au panier ».
      </p>
      {puces.length > 0 && (
        <ul className="mt-2 flex gap-2" aria-label="Valeurs recherchées">
          {puces.map((p) => (
            <li key={p} className="rounded bg-slate-100 px-2 text-xs">
              {p}{' '}
              <button
                type="button"
                aria-label={`Retirer ${p}`}
                onClick={() => {
                  retirer(p)
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RetourRecherche({
  data,
  onAfficher,
}: {
  data: ListeAttenduesResponse
  onAfficher: (s: Partial<Search>) => void
}) {
  const { absents, masques } = data.recherche
  if (absents.length === 0 && masques.length === 0) return null
  const lever: Record<string, Partial<Search>> = {
    Statut: { statut: 'tous' },
    Départ: { depart: 'tous' },
    Format: { format: undefined },
    Contrôle: { controle: undefined },
    Annonceur: { annonceur: undefined },
  }
  return (
    <div className="mt-2 space-y-1 text-sm" role="status">
      {absents.length > 0 && (
        <p data-testid="recherche-absents">
          Absents de cette page : <strong>{absents.join(', ')}</strong>
        </p>
      )}
      {masques.map((m) => (
        <p key={m.valeur} data-testid="recherche-masques">
          {m.valeur} : masqué par {m.filtres.join(', ')} —{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              onAfficher(
                Object.assign({}, ...m.filtres.map((f) => lever[f] ?? {})) as Partial<Search>,
              )
            }}
          >
            Afficher
          </button>
        </p>
      ))}
    </div>
  )
}

function Filtres({
  search,
  data,
  plusDeFiltres,
  onPlus,
  onChange,
}: {
  search: Search
  data: ListeAttenduesResponse | null
  plusDeFiltres: boolean
  onPlus: () => void
  onChange: (s: Partial<Search>) => void
}) {
  const compte = (dim: keyof ListeAttenduesResponse['compteurs'], valeur: string) =>
    data?.compteurs[dim].find((c) => c.valeur === valeur)?.nombre ?? 0
  const courante = semaineIsoDe(new Date())
  const enProduction = formatSemaineIso(courante)
  const statutSel =
    search.statut === 'tous'
      ? []
      : search.statut
        ? liste(search.statut)
        : (data?.filtres.statut ?? [])
  const departSel =
    search.depart === 'tous'
      ? []
      : search.depart
        ? liste(search.depart)
        : (data?.filtres.depart ?? [])
  const departs = [
    ...new Set([...(data?.compteurs.depart.map((c) => c.valeur) ?? []), ...departSel]),
  ].sort()
  return (
    <>
      <FiltreListe
        libelle="Statut"
        options={STATUTS_LIGNE.map((s) => ({
          valeur: s,
          libelle: LIBELLE_STATUT[s],
          nombre: compte('statut', s),
        }))}
        selection={statutSel}
        onChange={(sel) => {
          onChange({ statut: sel.length === 0 ? 'tous' : sel.join(',') })
        }}
      />
      <FiltreListe
        libelle="Départ"
        options={departs.map((d) => ({
          valeur: d,
          libelle: `${libelleSemaine(d, courante.annee)}${d === enProduction ? ' · en production' : ''}`,
          nombre: compte('depart', d),
        }))}
        selection={departSel}
        onChange={(sel) => {
          // RG-REC-016 : aucune coche = tout (semaines passées comprises).
          onChange({ depart: sel.length === 0 ? 'tous' : sel.join(',') })
        }}
      />
      <FiltreListe
        libelle="Format"
        options={(data?.compteurs.format ?? []).map((c) => ({
          valeur: c.valeur,
          libelle: c.valeur,
          nombre: c.nombre,
        }))}
        selection={liste(search.format)}
        onChange={(sel) => {
          onChange({ format: sel.join(',') || undefined })
        }}
      />
      {plusDeFiltres ? (
        <>
          <FiltreListe
            libelle="Contrôle"
            options={CONTROLES_LIGNE.map((c) => ({
              valeur: c,
              libelle: LIBELLE_OPTION_CONTROLE[c],
              nombre: compte('controle', c),
            }))}
            selection={liste(search.controle)}
            onChange={(sel) => {
              onChange({ controle: sel.join(',') || undefined })
            }}
          />
          <FiltreListe
            libelle="Annonceur"
            options={(data?.compteurs.annonceur ?? []).map((c) => ({
              valeur: c.valeur,
              libelle: c.valeur,
              nombre: c.nombre,
            }))}
            selection={liste(search.annonceur)}
            onChange={(sel) => {
              onChange({ annonceur: sel.join(',') || undefined })
            }}
          />
        </>
      ) : (
        <button type="button" className="rounded-md px-2 py-1 text-sm underline" onClick={onPlus}>
          + Filtre
        </button>
      )}
      <button
        type="button"
        className="ml-auto text-sm underline"
        onClick={() => {
          onChange({
            statut: undefined,
            depart: undefined,
            format: undefined,
            controle: undefined,
            annonceur: undefined,
          })
        }}
      >
        Réinitialiser
      </button>
    </>
  )
}

/** RG-REC-014 : afficher ou masquer les colonnes (DA, Annonceur, Thème, Format, Attendu, Reçu, N° d’affiche…). */
function SelecteurColonnes({
  visibles,
  onChange,
}: {
  visibles: IdColonne[]
  onChange: (v: IdColonne[]) => void
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm hover:bg-slate-50">
        Colonnes
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="z-50 rounded-md border border-slate-200 bg-white p-2 shadow-lg"
        >
          <fieldset>
            <legend className="mb-1 text-xs font-semibold uppercase text-slate-500">
              Colonnes
            </legend>
            {COLONNES.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={visibles.includes(c.id)}
                  onChange={() => {
                    onChange(
                      visibles.includes(c.id)
                        ? visibles.filter((v) => v !== c.id)
                        : [...visibles, c.id],
                    )
                  }}
                />
                {c.libelle}
              </label>
            ))}
          </fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Squelette() {
  return (
    <div className="space-y-2 p-3" data-testid="attendues-chargement" aria-label="Chargement">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  )
}

interface ActionsLigne {
  auPanier: Set<number>
  selection: number[]
  onSelection: (ids: number[]) => void
  onAjouter: (l: LigneAttendue) => void
}

function Tableau({
  data,
  search,
  colonnes,
  onChange,
  actions,
  onVisuel,
  onFeuille,
}: {
  data: ListeAttenduesResponse
  search: Search
  colonnes: IdColonne[]
  onChange: (s: Partial<Search>) => void
  actions: ActionsLigne | null
  onVisuel: (id: number) => void
  /** RG-REC-087 : réimprimer la feuille de stock d'une ligne dont les affiches sont contrôlées. */
  onFeuille: ((afficheIds: number[]) => void) | null
}) {
  const annee = semaineIsoDe(new Date()).annee
  const glissement = useSelectionGlissee(
    data.items.filter((l) => actions && !actions.auPanier.has(l.id)).map((l) => l.id),
    actions?.selection ?? [],
    (ids) => {
      actions?.onSelection(ids)
    },
  )
  if (data.aucuneLigneSurLeSite) {
    return (
      <p className="p-4 text-sm text-slate-600">
        Aucune réception attendue à proposer sur ce site.
      </p>
    )
  }
  if (data.items.length === 0) {
    return <p className="p-4 text-sm text-slate-600">Aucune ligne pour ces filtres.</p>
  }
  // La colonne Site est masquée quand toutes les lignes sont d'un même site.
  const unSeulSite =
    new Set(data.items.map((l) => l.site.id)).size === 1 && data.total === data.items.length
  const affichees = COLONNES.filter(
    (c) => colonnes.includes(c.id) && !(c.id === 'site' && unSeulSite),
  )
  const tri = search.sort ?? 'depart'
  const ordre = search.ordre ?? 'asc'
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  return (
    <>
      <div className="max-h-[480px] overflow-auto">
        <>
          <BoutonExportTableau nom="reception-index" tableau="Réceptions attendues" />
          <table {...glissement} className="w-full text-sm" aria-label="Réceptions attendues">
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr>
                {actions && (
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Sélection</span>
                  </th>
                )}
                {affichees.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    className="px-3 py-2 text-left font-medium"
                    aria-sort={
                      c.tri && tri === c.tri
                        ? ordre === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    {c.tri ? (
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => {
                          onChange({
                            sort: c.tri,
                            ordre: tri === c.tri && ordre === 'asc' ? 'desc' : 'asc',
                          })
                        }}
                      >
                        {c.libelle}
                        {tri === c.tri ? (ordre === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    ) : (
                      c.libelle
                    )}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr
                  data-selection-id={l.id}
                  key={l.id}
                  className={`border-t border-slate-100 ${l.statut === 'SURPLUS' ? 'bg-amber-50' : l.statut === 'PARTIELLE' ? 'bg-orange-50' : ''}`}
                >
                  {actions && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner le dossier ${String(l.dossier ?? l.id)}`}
                        disabled={actions.auPanier.has(l.id)}
                        checked={actions.selection.includes(l.id)}
                        onChange={(e) => {
                          actions.onSelection(
                            e.target.checked
                              ? [...actions.selection, l.id]
                              : actions.selection.filter((id) => id !== l.id),
                          )
                        }}
                      />
                    </td>
                  )}
                  {affichees.map((c) => (
                    <td key={c.id} className="px-3 py-2">
                      {c.cellule(l, annee)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      className="mr-2 text-sky-700 underline"
                      aria-label={`Voir le visuel du dossier ${String(l.dossier ?? l.id)}`}
                      onClick={() => {
                        onVisuel(l.id)
                      }}
                    >
                      voir le visuel
                    </button>
                    {onFeuille && l.controle === 'CONTROLEE' && l.affiches.length > 0 && (
                      <button
                        type="button"
                        className="mr-2 text-sky-700 underline"
                        aria-label={`Feuille de stock du dossier ${String(l.dossier ?? l.id)}`}
                        onClick={() => {
                          onFeuille(l.affiches)
                        }}
                      >
                        Feuille de stock
                      </button>
                    )}
                    {actions &&
                      (actions.auPanier.has(l.id) ? (
                        <span className="text-sm text-emerald-700">✓ au panier</span>
                      ) : (
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-0.5 text-sm hover:bg-slate-50"
                          onClick={() => {
                            actions.onAjouter(l)
                          }}
                        >
                          Au panier
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm">
        <span>{data.total} ligne(s)</span>
        {pages > 1 && (
          <span className="flex items-center gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              className="rounded border px-2 disabled:text-slate-300"
              onClick={() => {
                onChange({ page: data.page - 1 })
              }}
            >
              Précédente
            </button>
            Page {data.page} / {pages}
            <button
              type="button"
              disabled={data.page >= pages}
              className="rounded border px-2 disabled:text-slate-300"
              onClick={() => {
                onChange({ page: data.page + 1 })
              }}
            >
              Suivante
            </button>
          </span>
        )}
      </div>
    </>
  )
}
