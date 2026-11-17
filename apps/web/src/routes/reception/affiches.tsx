import { ApercuNc } from '../../components/nonconformite/feuille.tsx'
import { BoutonExportTableau } from '../../components/ui/export-tableau.tsx'
import { useSelectionGlissee } from '../../lib/selection-glissee.ts'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  FicheAfficheSchema,
  ImpressionResultatSchema,
  ListeAffichesSchema,
  ListeNcSchema,
  type Nc,
  ReferentielsReceptionSchema,
  TAGS_AFFICHE,
} from '@circe/shared'
import { useState } from 'react'
import { useValiderSelection } from '../../components/coordination/valider-selection.tsx'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { ApercuFeuilles } from '../../components/reception/apercu-feuilles.tsx'
import { EtiquettesRack } from '../../components/coordination/etiquettes-rack.tsx'
import { FicheAfficheModale } from '../../components/reception/fiche-affiche.tsx'
import { FicheReception } from '../../components/reception/fiche-reception.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { dateCourte } from '../../lib/duree.ts'
import { LIBELLE_TAG, departs } from '../../lib/libelles-affiche.ts'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// ECR-REC-03 — Liste des affiches (RG-REC-121 à 129). Filtres dans l'URL, filtrés et paginés par l'API.

const VALIDATIONS = {
  RECEPTION_INCONNUE: 'Réception inconnue',
  VALIDEE: 'Validée',
  A_CONFIRMER_PROPOSE: 'À confirmer : rattachement proposé',
  A_CONFIRMER_DOUTE: 'À confirmer : doute',
}

const SearchSchema = z.object({
  validation: z
    .enum(['RECEPTION_INCONNUE', 'VALIDEE', 'A_CONFIRMER_PROPOSE', 'A_CONFIRMER_DOUTE'])
    .optional(),
  dossier: z.coerce.number().int().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  tag: z.enum([...TAGS_AFFICHE, 'ORPHELINE']).optional(),
  supportId: z.coerce.number().int().optional(),
  imprimeurId: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).optional(),
  affiche: z.coerce.number().int().optional(),
})
type Search = z.infer<typeof SearchSchema>

export const Route = createFileRoute('/reception/affiches')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('affiche.consulter'),
  component: ListeDesAffiches,
})

const LIBELLE_FILTRE_TAG: Record<NonNullable<Search['tag']>, string> = {
  A_CONTROLER: 'À contrôler',
  ORPHELINE: 'Orpheline',
  COMPLEMENT: 'Complément',
  FEUILLE_A_REFAIRE: 'Feuille à refaire',
  FEUILLE_A_IMPRIMER: 'Feuille à imprimer',
  RECEPTION_INCONNUE: 'Réception inconnue',
}

function versQuery(s: Search): string {
  const p = new URLSearchParams()
  for (const k of [
    'dossier',
    'depart',
    'tag',
    'supportId',
    'imprimeurId',
    'page',
    'validation',
  ] as const) {
    const v = s[k]
    if (v !== undefined) p.set(k, String(v))
  }
  return p.toString()
}

function ListeDesAffiches() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [feuilleNc, setFeuilleNc] = useState<Nc[] | null>(null)
  const { etat: ncs, recharger: rechargerNc } = useApi('nc-affiches', (signal) =>
    apiRequest('GET', '/api/non-conformites', { schema: ListeNcSchema, signal }),
  )
  const ncDe = (id: number) =>
    ncs.kind === 'ready' ? ncs.data.items.filter((n) => n.afficheIds.includes(id)) : []
  const query = versQuery(search)
  const { etat, recharger } = useApi(`affiches?${query}`, (signal) =>
    apiRequest('GET', `/api/affiches${query ? `?${query}` : ''}`, {
      schema: ListeAffichesSchema,
      signal,
    }),
  )
  const { etat: moi } = useApi('moi', () => getMe())
  const { etat: refs } = useApi('referentiels-reception', (signal) =>
    apiRequest('GET', '/api/reception/referentiels', {
      schema: ReferentielsReceptionSchema,
      signal,
    }),
  )
  const [choix, setChoix] = useState<{ query: string; ids: number[] } | null>(null)
  const peutValider = moi.kind === 'ready' && can(moi.data, 'validation_admin.valider')
  const selection =
    choix?.query === query
      ? choix.ids
      : etat.kind === 'ready' && peutValider
        ? etat.data.items.filter((a) => a.validation === 'A_CONFIRMER_PROPOSE').map((a) => a.id)
        : []
  const setSelection = (ids: number[]) => {
    setChoix({ query, ids })
  }
  const [apercu, setApercu] = useState<number[] | null>(null)
  const [etiquettes, setEtiquettes] = useState<number[] | null>(null)
  const [ranger, setRanger] = useState<number[] | null>(null)
  const [reception, setReception] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const validation = useValiderSelection((msg) => {
    setMessage(msg)
    setSelection([])
    recharger()
  })
  const changer = (partiel: Partial<Search>) => {
    void navigate({
      search: (prev) => ({ ...prev, ...partiel, page: partiel.page ?? undefined }),
      replace: true,
    })
  }
  const items = etat.kind === 'ready' ? etat.data.items : []
  const glissement = useSelectionGlissee(
    items.map((a) => a.id),
    selection,
    setSelection,
  )
  const choisies = items.filter((a) => selection.includes(a.id))
  const aRefaire = choisies.filter((a) => a.tags.includes('FEUILLE_A_REFAIRE'))

  const champ = 'rounded-md border border-slate-300 px-2 py-1 text-sm'
  const peutImprimer = moi.kind === 'ready' && can(moi.data, 'reception.imprimer')
  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Réception</p>
      <h1 className="text-2xl font-semibold">Liste des affiches</h1>

      {validation.modale}
      {validation.erreur !== null && <ErrorMessage error={validation.erreur} />}

      {/* RG-COO-023 : étiquettes rack demandées par la validation admin, à imprimer par la plateforme. */}
      {peutImprimer && <EtiquettesRack cle={0} />}
      <section className="mt-4 rounded-lg border border-slate-200 bg-white" aria-label="Affiches">
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 p-3 text-sm">
          <label>
            Validation admin{' '}
            <select
              className={champ}
              value={search.validation ?? ''}
              onChange={(e) => {
                changer({
                  validation: e.target.value ? (e.target.value as Search['validation']) : undefined,
                })
              }}
            >
              <option value="">Toutes</option>
              {Object.entries(VALIDATIONS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {peutValider && (
            <button
              type="button"
              className="underline"
              onClick={() => {
                setSelection(
                  items.filter((a) => a.validation === 'A_CONFIRMER_PROPOSE').map((a) => a.id),
                )
              }}
            >
              Cocher les cas sûrs
            </button>
          )}
          <label>
            N° de dossier
            <input
              className={`${champ} ml-1 w-28`}
              defaultValue={search.dossier ?? ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = e.currentTarget.value.trim()
                  changer({ dossier: v ? Number(v) : undefined })
                }
              }}
            />
          </label>
          <label>
            Départ
            <input
              type="week"
              className={`${champ} ml-1`}
              value={search.depart ?? ''}
              onChange={(e) => {
                changer({ depart: e.target.value || undefined })
              }}
            />
          </label>
          <label>
            Tag
            <select
              className={`${champ} ml-1`}
              value={search.tag ?? ''}
              onChange={(e) => {
                changer({ tag: (e.target.value || undefined) as Search['tag'] })
              }}
            >
              <option value="">Tous</option>
              {(['A_CONTROLER', 'ORPHELINE', 'COMPLEMENT', 'FEUILLE_A_REFAIRE'] as const).map(
                (t) => (
                  <option key={t} value={t}>
                    {LIBELLE_FILTRE_TAG[t]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Format
            <select
              className={`${champ} ml-1`}
              value={search.supportId ?? ''}
              onChange={(e) => {
                changer({ supportId: e.target.value ? Number(e.target.value) : undefined })
              }}
            >
              <option value="">Tous</option>
              {refs.kind === 'ready' &&
                refs.data.formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Imprimeur
            <select
              className={`${champ} ml-1`}
              value={search.imprimeurId ?? ''}
              onChange={(e) => {
                changer({ imprimeurId: e.target.value ? Number(e.target.value) : undefined })
              }}
            >
              <option value="">Tous</option>
              {refs.kind === 'ready' &&
                refs.data.imprimeurs.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.libelle}
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
        </div>
        {selection.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
            {peutValider && choisies.some((a) => a.validation.startsWith('A_CONFIRMER')) && (
              <Button
                type="button"
                disabled={validation.envoi}
                onClick={() =>
                  void validation.validerAffiches(
                    choisies.filter((a) => a.validation.startsWith('A_CONFIRMER')).map((a) => a.id),
                  )
                }
              >
                Valider la sélection (
                {choisies.filter((a) => a.validation.startsWith('A_CONFIRMER')).length})
              </Button>
            )}
            {aRefaire.length > 0 && (
              <Button
                type="button"
                onClick={() => {
                  // ECR-REC-10 si des affiches sont encore en zone tampon, sinon directement l'aperçu.
                  // Allée tampon du site lue dans les référentiels (paramètre par site, Q-105).
                  const tampon = (siteId: number) =>
                    refs.kind === 'ready'
                      ? (refs.data.plateformes.find((p) => p.id === siteId)?.alleeInconnues ?? null)
                      : null
                  const enTampon = aRefaire.filter((a) => {
                    const allee = a.emplacement.split('-')[0] ?? ''
                    return allee === '—' || allee === tampon(a.site.id)
                  })
                  if (enTampon.length > 0) setRanger(aRefaire.map((a) => a.id))
                  else setApercu(aRefaire.map((a) => a.id))
                }}
              >
                Réimprimer les feuilles à refaire ({aRefaire.length})
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                setApercu(selection)
              }}
            >
              Imprimer les feuilles de stock
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEtiquettes(selection)
              }}
            >
              Étiquettes rack
            </Button>
          </div>
        )}
        {message && (
          <p role="status" className="p-3 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {etat.kind === 'ready' && items.length === 0 && (
          <p className="p-3 text-sm text-slate-600">Aucune ligne pour ces filtres.</p>
        )}
        {etat.kind === 'ready' && items.length > 0 && (
          <>
            <BoutonExportTableau nom="reception-affiches" tableau="Liste des affiches" />
            <table {...glissement} className="w-full text-sm" aria-label="Liste des affiches">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2" />
                  {[
                    'N° affiche',
                    'Reçue le',
                    'Annonceur · thème',
                    'Dossier(s)',
                    'Départ',
                    'En stock',
                    'Emplacement',
                    'Statut · tags',
                    'Réception',
                    'Imprimeur',
                  ].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr
                    data-selection-id={a.id}
                    key={a.id}
                    className={`cursor-pointer border-t border-slate-100 ${a.rebut > 0 ? 'bg-orange-50' : a.statut === 'ORPHELINE' ? 'bg-amber-50' : ''}`}
                    onClick={() => {
                      changer({ affiche: a.id, page: search.page })
                    }}
                  >
                    <td
                      className="px-3 py-2"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner l’affiche ${String(a.id)}`}
                        checked={selection.includes(a.id)}
                        onChange={(e) => {
                          setSelection(
                            e.target.checked
                              ? [...selection, a.id]
                              : selection.filter((x) => x !== a.id),
                          )
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">{a.id}</td>
                    <td className="px-3 py-2">{dateCourte(a.recueLe)}</td>
                    <td className="px-3 py-2">
                      {a.annonceur ?? '—'} · {a.theme ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {a.dossiers.join(', ') || '—'}{' '}
                      {a.dossiers.length > 1 && (
                        <Pastille ton="info">{a.dossiers.length} dossiers</Pastille>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {departs(a.departs)}{' '}
                      {a.multiSemaines && <Pastille ton="info">multi-semaines</Pastille>}
                    </td>
                    <td className="px-3 py-2">
                      {a.enStock}{' '}
                      {a.rebut > 0 && <Pastille ton="important">{a.rebut} rebut</Pastille>}
                    </td>
                    <td className="px-3 py-2">{a.emplacement}</td>
                    <td className="px-3 py-2">
                      <Pastille ton={a.statut === 'ORPHELINE' ? 'surveiller' : 'ok'}>
                        {a.statut === 'ORPHELINE' ? 'Orpheline' : 'Identifiée'}
                      </Pastille>{' '}
                      <Pastille ton={a.validation === 'VALIDEE' ? 'ok' : 'surveiller'}>
                        {VALIDATIONS[a.validation]}
                      </Pastille>
                      {!a.tags.includes('A_CONTROLER') &&
                        ncDe(a.id).some((n) => !n.feuilleImprimeeLe) && (
                          <Pastille ton="surveiller">Feuille NC à imprimer</Pastille>
                        )}
                      {a.tags.map((t) => (
                        <Pastille key={t} ton={LIBELLE_TAG[t]?.ton ?? 'neutre'}>
                          {t === 'FEUILLE_A_REFAIRE' && a.feuille === 'TEMPORAIRE'
                            ? 'Feuille définitive à imprimer'
                            : (LIBELLE_TAG[t]?.libelle ?? t)}
                        </Pastille>
                      ))}
                    </td>
                    <td className="px-3 py-2">
                      {ncDe(a.id).length > 0 && (
                        <button
                          type="button"
                          className="mr-2 underline"
                          onClick={() => {
                            setFeuilleNc(ncDe(a.id))
                          }}
                        >
                          Feuille NC
                        </button>
                      )}
                      {peutImprimer &&
                        (a.tags.includes('FEUILLE_A_IMPRIMER') ||
                          a.tags.includes('FEUILLE_A_REFAIRE')) && (
                          <button
                            type="button"
                            className="underline mr-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              setApercu([a.id])
                            }}
                          >
                            Feuille de stock
                          </button>
                        )}
                      {a.receptionId !== null && (
                        <button
                          type="button"
                          className="underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setReception(a.receptionId)
                          }}
                        >
                          R{a.receptionId}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">{a.imprimeur ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {etat.kind === 'ready' && etat.data.total > etat.data.pageSize && (
          <div className="flex items-center justify-between p-3 text-sm">
            <span>
              {etat.data.total} affiche(s) · page {etat.data.page}
            </span>
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
      {search.affiche !== undefined && (
        <FicheAfficheModale
          afficheId={search.affiche}
          onFermer={(modifiee) => {
            changer({ affiche: undefined, page: search.page })
            if (modifiee) recharger()
          }}
        />
      )}
      {reception !== null && (
        <FicheReception
          receptionId={reception}
          onFermer={() => {
            setReception(null)
          }}
          onAffiche={(id) => {
            setReception(null)
            changer({ affiche: id, page: search.page })
          }}
        />
      )}
      {feuilleNc && (
        <ApercuNc
          items={feuilleNc}
          onFermer={() => {
            setFeuilleNc(null)
            rechargerNc()
          }}
        />
      )}
      {apercu && (
        <ApercuFeuilles
          afficheIds={apercu}
          onFermer={(imprime) => {
            setApercu(null)
            if (imprime) {
              setSelection([])
              recharger()
            }
          }}
        />
      )}
      {etiquettes && (
        <ApercuFeuilles
          afficheIds={etiquettes}
          etiquettesSeules
          onFermer={(imprime) => {
            // RG-REC-090 : message de la maquette.
            if (imprime)
              setMessage(`${String(etiquettes.length)} étiquette(s) rack imprimée(s) en un clic.`)
            setEtiquettes(null)
          }}
        />
      )}
      {ranger && (
        <RangerAvantImprimer
          ids={ranger}
          items={items}
          onAnnuler={() => {
            setRanger(null)
          }}
          onRangees={() => {
            setApercu(ranger)
            setRanger(null)
          }}
        />
      )}
    </main>
  )
}

/** ECR-REC-10 — « Ranger avant d'imprimer » (RG-REC-088) : vide = reste en zone tampon. */
function RangerAvantImprimer({
  ids,
  items,
  onAnnuler,
  onRangees,
}: {
  ids: number[]
  items: { id: number; annonceur: string | null; theme: string | null; emplacement: string }[]
  onAnnuler: () => void
  onRangees: () => void
}) {
  const [saisie, setSaisie] = useState<Record<number, { allee: string; rayon: string }>>({})
  const [erreur, setErreur] = useState<unknown>(null)
  async function valider() {
    setErreur(null)
    try {
      const affiches = []
      for (const id of ids) {
        // Version courante relue (verrou optimiste, RG-REC-009).
        const fiche = await apiRequest('GET', `/api/affiches/${String(id)}`, {
          schema: FicheAfficheSchema,
        })
        affiches.push({
          id,
          version: fiche.version,
          allee: saisie[id]?.allee ?? '',
          rayon: saisie[id]?.rayon ?? '',
        })
      }
      await apiPost('/api/affiches/rangement', {
        schema: ImpressionResultatSchema,
        body: { affiches },
      })
      onRangees()
    } catch (e) {
      setErreur(e)
    }
  }
  return (
    <Modale
      titre="Ranger avant d’imprimer"
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onAnnuler()
      }}
    >
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {['N° affiche', 'Visuel', 'Aujourd’hui', 'Allée', 'Rayon'].map((h) => (
              <th key={h} scope="col" className="px-2 py-1 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const a = items.find((x) => x.id === id)
            return (
              <tr key={id} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono">{id}</td>
                <td className="px-2 py-1">
                  {a?.annonceur ?? '—'} · {a?.theme ?? '—'}
                </td>
                <td className="px-2 py-1">{a?.emplacement ?? '—'}</td>
                <td className="px-2 py-1">
                  <input
                    aria-label={`Allée, affiche ${String(id)}`}
                    className="w-16 rounded border border-slate-300 px-1"
                    value={saisie[id]?.allee ?? ''}
                    onChange={(e) => {
                      setSaisie({
                        ...saisie,
                        [id]: {
                          allee: e.target.value.toUpperCase(),
                          rayon: saisie[id]?.rayon ?? '',
                        },
                      })
                    }}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    aria-label={`Rayon, affiche ${String(id)}`}
                    className="w-16 rounded border border-slate-300 px-1"
                    value={saisie[id]?.rayon ?? ''}
                    onChange={(e) => {
                      setSaisie({
                        ...saisie,
                        [id]: { allee: saisie[id]?.allee ?? '', rayon: e.target.value },
                      })
                    }}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {erreur !== null && (
        <div className="mt-2">
          <ErrorMessage error={erreur} />
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="text-sm underline" onClick={onAnnuler}>
          Annuler
        </button>
        <Button type="button" onClick={() => void valider()}>
          Ranger et voir les feuilles
        </Button>
      </div>
    </Modale>
  )
}
