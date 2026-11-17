import { TableMetier, type ColonneMetier } from '../../components/ui/table-metier.tsx'
import { useSelectionGlissee } from '../../lib/selection-glissee.ts'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  EncollerSchema,
  REPERES_UNITAIRE,
  ResultatLiberationSchema,
  ResultatUnitaireSchema,
  STATUTS_UNITE_UNITAIRE,
  SyntheseSchema,
  TYPES_UNITAIRE,
  UnitaireSchema,
  type Encoller,
  type LigneUnitaire,
  type RefRepartition,
  type SemaineLiberation,
  type Synthese,
  type TypeUnitaire,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { contexteDesFiltres, Edition } from '../../components/impression/edition.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// COO-P12 — ECR-COO-09 : Préparation 2 m² fixe / Pliage / Bus (écran « unitaire »). Liste des unités (UM, lot PL,
// BU) avec entretien à l'afficheur (RG-COO-238), actions de ligne « Corriger l'intitulé » (RG-COO-244) et de quantité
// (RG-COO-239), actions groupées « Plié : saisir le comptage » (RG-COO-247), « Retirer » / « Préparer »
// (RG-COO-249, 250), « Rendre la main à la Pré-Prod » (RG-COO-243), « Fiche de synthèse » (RG-COO-246) et « Quantités à
// encoller » (Bus, RG-COO-304). Étape 8 (Q-265, option (c) par défaut) : « Libérer la Sxx » (RG-COO-240, ne crée pas les
// UM), repères « à libérer » et « arrivé après libération » (RG-COO-241, 242) et « Colisage » (RG-COO-260 à 262).

const SearchSchema = z.object({
  type: z.enum(TYPES_UNITAIRE).default('fixe'),
  atelier: z.coerce.number().int().positive().optional(),
  depart: z.string().optional(),
  dossier: z.coerce.number().int().positive().optional(),
  annonceur: z.string().optional(),
  statut: z.enum(STATUTS_UNITE_UNITAIRE).optional(),
  destinataire: z.string().optional(),
  afficheur: z.string().optional(),
  repere: z.enum(REPERES_UNITAIRE).optional(),
})
type Search = z.infer<typeof SearchSchema>

export const Route = createFileRoute('/coordination/unitaire')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('train.consulter'),
  component: Unitaire,
})

const TITRES: Record<TypeUnitaire, string> = {
  fixe: 'Préparation 2 m² fixe',
  pliage: 'Pliage',
  bus: 'Préparation par centre (Bus)',
}
const STATUTS: Record<string, { libelle: string; ton: 'neutre' | 'info' | 'ok' | 'surveiller' }> = {
  A_TRAITER: { libelle: 'À traiter', ton: 'surveiller' },
  EN_COURS: { libelle: 'En cours', ton: 'info' },
  PREPARE: { libelle: 'Préparé', ton: 'ok' },
  A_EXPEDIER: { libelle: 'À expédier', ton: 'ok' },
  TERMINE: { libelle: 'Terminé', ton: 'ok' },
  AU_ROULAGE: { libelle: 'Au roulage', ton: 'ok' },
  EXPORT_PREPA: { libelle: 'Export prépa', ton: 'ok' },
  A_IMPRIMER: { libelle: 'À imprimer', ton: 'info' },
  INSTRUCTION_OK: { libelle: 'Instruction OK', ton: 'info' },
}
const AFFICHE = { VALIDEE: '✓', PROPOSEE: '•', AUCUNE: '' } as const

const query = (s: Search) => {
  const p = new URLSearchParams()
  const valeurs: Record<string, string | number | undefined> = { ...s }
  for (const [k, v] of Object.entries(valeurs)) if (v !== undefined && v !== '') p.set(k, String(v))
  return p.toString()
}
const refsDe = (lignes: readonly LigneUnitaire[]): RefRepartition[] => lignes.flatMap((l) => l.refs)

function Unitaire() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qs = query(search)
  const { etat, recharger } = useApi(`unitaire-${qs}`, (signal) =>
    apiRequest('GET', `/api/coordination/unitaire?${qs}`, { schema: UnitaireSchema, signal }),
  )
  const { etat: moi } = useApi('moi', () => getMe())
  const peut = (code: Parameters<typeof can>[1]) => moi.kind === 'ready' && can(moi.data, code)
  const [choix, setChoix] = useState<ReadonlySet<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [modale, setModale] = useState<
    | { kind: 'intitule' | 'quantite'; ligne: LigneUnitaire }
    | { kind: 'main' | 'comptage' | 'synthese' | 'encoller' }
    | null
  >(null)
  const [f, setF] = useState({
    dossier: search.dossier?.toString() ?? '',
    depart: search.depart ?? '',
    annonceur: search.annonceur ?? '',
    destinataire: search.destinataire ?? '',
    afficheur: search.afficheur ?? '',
  })
  const lignes = etat.kind === 'ready' ? etat.data.lignes : []
  const glissement = useSelectionGlissee(
    lignes.map((l) => l.cle),
    [...choix],
    (ids) => {
      setChoix(new Set(ids))
    },
  )
  const selection = lignes.filter((l) => choix.has(l.cle))
  const bus = search.type === 'bus'

  function appliquer(e: SyntheticEvent) {
    e.preventDefault()
    const num = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined)
    const txt = (v: string) => v.trim() || undefined
    void navigate({
      search: (s) => ({
        ...s,
        dossier: num(f.dossier),
        depart: txt(f.depart),
        annonceur: txt(f.annonceur),
        destinataire: txt(f.destinataire),
        afficheur: txt(f.afficheur),
      }),
    })
  }
  const fermer = (msg: string | null) => {
    setModale(null)
    if (msg) {
      setMessage(msg)
      setChoix(new Set())
      recharger()
    }
  }
  async function liberer(sem: SemaineLiberation) {
    setMessage(null)
    setErreur(null)
    try {
      const r = await apiPost('/api/coordination/unitaire/liberer', {
        schema: ResultatLiberationSchema,
        body: { atelierId: sem.atelierId, depart: sem.depart },
      })
      setMessage(r.message)
      recharger()
    } catch (e) {
      setErreur(e)
    }
  }
  async function action(chemin: 'retirer' | 'preparer' | 'colisage') {
    setMessage(null)
    setErreur(null)
    try {
      const r = await apiPost(`/api/coordination/unitaire/${chemin}`, {
        schema: ResultatUnitaireSchema,
        body: { lignes: refsDe(selection) },
      })
      fermer(r.message)
    } catch (e) {
      setErreur(e)
    }
  }
  const ecriture = peut('unite.gerer')

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Coordination › Préparation</p>
      <h1 className="text-2xl font-semibold">{TITRES[search.type]}</h1>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={appliquer}
        aria-label="Filtres"
      >
        <Champ
          label="N° de dossier"
          value={f.dossier}
          onChange={(v) => {
            setF({ ...f, dossier: v })
          }}
        />
        <Champ
          label="Départ"
          value={f.depart}
          placeholder="2026-W45"
          onChange={(v) => {
            setF({ ...f, depart: v })
          }}
        />
        <Champ
          label="Annonceur"
          value={f.annonceur}
          onChange={(v) => {
            setF({ ...f, annonceur: v })
          }}
        />
        <Champ
          label={bus ? 'Centre bus' : 'Destinataire'}
          value={f.destinataire}
          onChange={(v) => {
            setF({ ...f, destinataire: v })
          }}
        />
        <Champ
          label="Afficheur"
          value={f.afficheur}
          onChange={(v) => {
            setF({ ...f, afficheur: v })
          }}
        />
        <label className="text-sm">
          Statut
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={search.statut ?? ''}
            onChange={(e) => {
              const v = STATUTS_UNITE_UNITAIRE.find((x) => x === e.target.value)
              void navigate({ search: (s) => ({ ...s, statut: v }) })
            }}
          >
            <option value="">Tous</option>
            {STATUTS_UNITE_UNITAIRE.map((x) => (
              <option key={x} value={x}>
                {STATUTS[x]?.libelle ?? x}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Repère
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={search.repere ?? ''}
            onChange={(e) => {
              const v = REPERES_UNITAIRE.find((x) => x === e.target.value)
              void navigate({ search: (s) => ({ ...s, repere: v }) })
            }}
          >
            <option value="">Tous</option>
            <option value="RENDU">Main rendue à la Pré-Prod</option>
            <option value="A_LIBERER">À libérer (semaine pas encore libérée)</option>
            <option value="APRES_LIBERATION">Arrivé après libération</option>
          </select>
        </label>
        {etat.kind === 'ready' && etat.data.ateliers.length > 1 && (
          <label className="text-sm">
            Atelier
            <select
              className="ml-1 rounded-md border border-slate-300 px-2 py-1"
              value={search.atelier ?? ''}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined
                void navigate({ search: (s) => ({ ...s, atelier: v }) })
              }}
            >
              <option value="">Tous</option>
              {etat.data.ateliers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle} · {a.plateforme}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit">Filtrer</Button>
      </form>

      {etat.kind === 'ready' && (
        <section
          className="mt-3 space-y-2"
          aria-label="Libération de la semaine"
          data-testid="liberation"
        >
          {etat.data.liberation.semaines.length === 0 && (
            <p role="note" className="rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
              Aucune semaine de départ à libérer pour ces filtres.
            </p>
          )}
          {etat.data.liberation.semaines.map((sem) => (
            <div
              key={`${String(sem.atelierId)}-${sem.depart}`}
              role="note"
              className={`rounded-md border p-2 text-sm ${sem.libereeLe ? 'border-sky-200 bg-sky-50' : 'border-amber-200 bg-amber-50'}`}
            >
              {sem.libereeLe ? (
                <p>
                  {sem.depart} libérée vers l’atelier {sem.atelier} le{' '}
                  {new Date(sem.libereeLe).toLocaleString('fr-FR', { timeZone: 'UTC' })}
                  {sem.libereePar ? ` (${sem.libereePar})` : ''} — Toute préparation reçue après
                  déclenche une alerte et un mail.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p>
                    {sem.depart} pas encore libérée vers l’atelier {sem.atelier} — ses{' '}
                    {sem.lignesALiberer} ligne(s) sont « à libérer ».
                  </p>
                  <Button
                    type="button"
                    disabled={!peut('semaine.liberer')}
                    title={peut('semaine.liberer') ? undefined : 'Réservé à la Coordination'}
                    onClick={() => {
                      void liberer(sem)
                    }}
                  >
                    Libérer la {sem.depart.slice(5)}
                  </Button>
                </div>
              )}
              {sem.dossiersApres.length > 0 && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-amber-900">
                  Arrivés après la libération : dossier(s) {sem.dossiersApres.join(', ')}.
                  <Button
                    type="button"
                    onClick={() => {
                      void navigate({
                        search: (x) => ({
                          ...x,
                          atelier: sem.atelierId,
                          repere: 'APRES_LIBERATION',
                        }),
                      })
                    }}
                  >
                    Voir ces dossiers
                  </Button>
                </p>
              )}
            </div>
          ))}
        </section>
      )}
      {etat.kind === 'ready' && etat.data.themesExclus.length > 0 && (
        <p className="mt-2 text-xs text-slate-600" aria-label="Thèmes exclus">
          Thèmes exclus par Broadcast, sortis de la liste : {etat.data.themesExclus.join(', ')}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm"
        >
          {message}
        </p>
      )}
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2" role="toolbar" aria-label="Actions">
        <Button
          type="button"
          onClick={() => {
            setModale({ kind: 'synthese' })
          }}
        >
          Fiche de synthèse
        </Button>
        {bus && (
          <Button
            type="button"
            onClick={() => {
              setModale({ kind: 'encoller' })
            }}
          >
            Quantités à encoller
          </Button>
        )}
        {search.type === 'pliage' && (
          <Button
            type="button"
            disabled={!ecriture || selection.length === 0}
            title={ecriture ? undefined : 'Réservé à la Coordination et au chef d’équipe'}
            onClick={() => {
              setModale({ kind: 'comptage' })
            }}
          >
            Plié : saisir le comptage
          </Button>
        )}
        <Button
          type="button"
          disabled={!ecriture || selection.length === 0}
          title="Crée les UM de la sélection (Colisage)"
          onClick={() => {
            void action('colisage')
          }}
        >
          Colisage
        </Button>
        <Button
          type="button"
          disabled={!ecriture || selection.length === 0}
          onClick={() => {
            void action('preparer')
          }}
        >
          Préparer
        </Button>
        <Button
          type="button"
          disabled={!ecriture || selection.length === 0}
          onClick={() => {
            void action('retirer')
          }}
        >
          Retirer
        </Button>
        <Button
          type="button"
          disabled={!peut('preprod.rendre_main') || selection.length === 0}
          title={peut('preprod.rendre_main') ? undefined : 'Réservé à la Coordination'}
          onClick={() => {
            setModale({ kind: 'main' })
          }}
        >
          Rendre la main à la Pré-Prod
        </Button>
      </div>

      <section className="mt-4" aria-label="Unités">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' &&
          (lignes.length === 0 ? (
            <p className="text-sm text-slate-600">
              {etat.data.ateliers.length === 0
                ? 'Pas d’atelier de préparation sur ce site.'
                : 'Aucune unité à préparer pour ces filtres.'}
            </p>
          ) : (
            <>
              <label>
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  checked={choix.size === lignes.length}
                  onChange={(e) => {
                    setChoix(e.target.checked ? new Set(lignes.map((l) => l.cle)) : new Set())
                  }}
                />{' '}
                Tout sélectionner
              </label>
              <TableMetier
                key={search.type}
                nom="Unités de préparation"
                tableProps={glissement}
                lignes={lignes}
                cle={(l) => l.cle}
                colonnes={colonnesUnitaire(search.type)}
                actions={(l) => (
                  <div className="flex gap-2 whitespace-nowrap">
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${l.theme ?? ''}`}
                        checked={choix.has(l.cle)}
                        onChange={(e) => {
                          const n = new Set(choix)
                          if (e.target.checked) n.add(l.cle)
                          else n.delete(l.cle)
                          setChoix(n)
                        }}
                      />{' '}
                      Sélection
                    </label>{' '}
                    {!bus && (
                      <Button
                        type="button"
                        className="mr-1"
                        disabled={!peut('intitule.corriger')}
                        onClick={() => {
                          setModale({ kind: 'intitule', ligne: l })
                        }}
                      >
                        Corriger l’intitulé
                      </Button>
                    )}
                    {bus && (
                      <Button
                        type="button"
                        className="mr-1"
                        disabled={!peut('intitule.corriger')}
                        onClick={() => {
                          setModale({ kind: 'intitule', ligne: l })
                        }}
                      >
                        Textes de bague
                      </Button>
                    )}
                    <Button
                      type="button"
                      disabled={!ecriture || l.refs.length !== 1}
                      title={
                        l.refs.length === 1
                          ? undefined
                          : 'Ligne regroupée : modifiez une unité à la fois'
                      }
                      onClick={() => {
                        setModale({ kind: 'quantite', ligne: l })
                      }}
                    >
                      Quantité
                    </Button>
                  </div>
                )}
              />
            </>
          ))}
      </section>

      {modale?.kind === 'intitule' && <ModaleIntitule ligne={modale.ligne} onFermer={fermer} />}
      {modale?.kind === 'quantite' && <ModaleQuantite ligne={modale.ligne} onFermer={fermer} />}
      {modale?.kind === 'main' && <ModaleMain lignes={selection} onFermer={fermer} />}
      {modale?.kind === 'comptage' && <ModaleComptage lignes={selection} onFermer={fermer} />}
      {modale?.kind === 'synthese' && (
        <ModaleSynthese
          qs={qs}
          onFermer={() => {
            setModale(null)
          }}
        />
      )}
      {modale?.kind === 'encoller' && (
        <ModaleEncoller
          peutEcrire={ecriture}
          onFermer={fermer}
          depart={search.depart}
          sites={[
            ...new Map(
              (lignes.length > 0
                ? lignes.map((l) => l.atelier)
                : etat.kind === 'ready'
                  ? etat.data.ateliers
                  : []
              ).map((a) => [a.plateformeId, a.plateforme] as const),
            ),
          ]}
        />
      )}
    </main>
  )
}

function Champ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        className="ml-1 w-32 rounded-md border border-slate-300 px-2 py-1"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
        }}
      />
    </label>
  )
}

/** Envoi commun des modales : bouton désactivé pendant la requête, erreur métier affichée. */
function useEnvoi() {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  async function lancer(corps: () => Promise<void>) {
    setEnvoi(true)
    setErreur(null)
    try {
      await corps()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return { envoi, erreur, lancer }
}

/** ECR-COO-09c (RG-COO-244) : annonceur imprimé, thème, « Prévenir la Pré-Prod ». */
function ModaleIntitule({
  ligne,
  onFermer,
}: {
  ligne: LigneUnitaire
  onFermer: (m: string | null) => void
}) {
  const [annonceur, setAnnonceur] = useState(ligne.annonceur ?? '')
  const [theme, setTheme] = useState(ligne.theme ?? '')
  const [prevenir, setPrevenir] = useState(true)
  const { envoi, erreur, lancer } = useEnvoi()
  const ref = ligne.refs[0]
  return (
    <Modale
      titre={ligne.type === 'bus' ? 'Textes de bague' : 'Corriger l’intitulé'}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      {ligne.enProduction && (
        <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm" role="note">
          La production est lancée : la correction porte sur l’intitulé imprimé seulement.
        </p>
      )}
      <label className="block text-sm">
        Annonceur imprimé
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={annonceur}
          onChange={(e) => {
            setAnnonceur(e.target.value)
          }}
        />
      </label>
      <label className="mt-2 block text-sm">
        Thème
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={theme}
          onChange={(e) => {
            setTheme(e.target.value)
          }}
        />
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={prevenir}
          onChange={(e) => {
            setPrevenir(e.target.checked)
          }}
        />
        Prévenir la Pré-Prod, pour aligner Broadcast si besoin
      </label>
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}
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
          disabled={envoi || !ref}
          onClick={() => {
            if (ref)
              void lancer(async () => {
                const r = await apiPost('/api/coordination/unitaire/corriger-intitule', {
                  schema: ResultatUnitaireSchema,
                  body: { ...ref, annonceur, theme, prevenirPreProd: prevenir },
                })
                onFermer(r.message)
              })
          }}
        >
          Corriger
        </Button>
      </div>
    </Modale>
  )
}

/** RG-COO-239 : modifier la quantité à produire d'une ligne. */
function ModaleQuantite({
  ligne,
  onFermer,
}: {
  ligne: LigneUnitaire
  onFermer: (m: string | null) => void
}) {
  const [valeur, setValeur] = useState(String(ligne.qte))
  const { envoi, erreur, lancer } = useEnvoi()
  const ref = ligne.refs[0]
  return (
    <Modale
      titre="Modifier la quantité à produire"
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <label className="block text-sm">
        Quantité
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          inputMode="numeric"
          value={valeur}
          onChange={(e) => {
            setValeur(e.target.value)
          }}
        />
      </label>
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}
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
          disabled={envoi || !ref || !/^\d+$/.test(valeur.trim())}
          onClick={() => {
            if (ref)
              void lancer(async () => {
                const r = await apiPost('/api/coordination/unitaire/quantite', {
                  schema: ResultatUnitaireSchema,
                  body: { ...ref, quantite: Number(valeur.trim()) },
                })
                onFermer(r.message)
              })
          }}
        >
          Enregistrer
        </Button>
      </div>
    </Modale>
  )
}

/** ECR-COO-09b (RG-COO-243) : motif (défaut de la maquette) et avertissement des unités déjà en production. */
function ModaleMain({
  lignes,
  onFermer,
}: {
  lignes: LigneUnitaire[]
  onFermer: (m: string | null) => void
}) {
  const [motif, setMotif] = useState('Changement de visuel demandé par le client')
  const { envoi, erreur, lancer } = useEnvoi()
  const lancees = lignes.filter((l) => l.enProduction).length
  return (
    <Modale
      titre="Rendre la main à la Pré-Prod"
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      {lancees > 0 && (
        <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm" role="note">
          {lancees} unité(s) déjà en production — Elles ne seront pas retirées (point de
          non-retour).
        </p>
      )}
      <label className="block text-sm">
        Motif
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={motif}
          maxLength={200}
          onChange={(e) => {
            setMotif(e.target.value)
          }}
        />
      </label>
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}
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
          disabled={envoi}
          onClick={() => {
            void lancer(async () => {
              const r = await apiPost('/api/coordination/unitaire/rendre-la-main', {
                schema: ResultatUnitaireSchema,
                body: { lignes: refsDe(lignes), motif },
              })
              onFermer(r.message)
            })
          }}
        >
          Rendre la main
        </Button>
      </div>
    </Modale>
  )
}

/** RG-COO-247 : « Affiches comptées » (défaut = attendu), « Valider le comptage ». */
function ModaleComptage({
  lignes,
  onFermer,
}: {
  lignes: LigneUnitaire[]
  onFermer: (m: string | null) => void
}) {
  const attendu = lignes.reduce((x, l) => x + l.total, 0)
  const [comptees, setComptees] = useState(String(attendu))
  const { envoi, erreur, lancer } = useEnvoi()
  return (
    <Modale
      titre="Plié : saisir le comptage"
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <p className="text-sm">Attendu : {attendu} affiche(s).</p>
      <label className="mt-2 block text-sm">
        Affiches comptées
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          inputMode="numeric"
          value={comptees}
          onChange={(e) => {
            setComptees(e.target.value)
          }}
        />
      </label>
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}
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
          disabled={envoi || !/^\d+$/.test(comptees.trim())}
          onClick={() => {
            void lancer(async () => {
              const r = await apiPost('/api/coordination/unitaire/comptage', {
                schema: ResultatUnitaireSchema,
                body: { lignes: refsDe(lignes), comptees: Number(comptees.trim()) },
              })
              onFermer(r.message)
            })
          }}
        >
          Valider le comptage
        </Button>
      </div>
    </Modale>
  )
}

/** ECR-COO-09d (RG-COO-246) : fiche de synthèse groupée par destinataire ; impression côté navigateur (RG-COO-306). */
function ModaleSynthese({ qs, onFermer }: { qs: string; onFermer: () => void }) {
  const { etat, recharger } = useApi(`unitaire-synthese-${qs}`, (signal) =>
    apiRequest('GET', `/api/coordination/unitaire/synthese?${qs}`, {
      schema: SyntheseSchema,
      signal,
    }),
  )
  return (
    <Modale
      titre="Fiche de synthèse"
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        // D-18 : modèle d'édition imprimé par le navigateur (zone d'impression, en-tête, filtres appliqués).
        <Edition
          titre={`Fiche de synthèse · ${TITRES[etat.data.type]}`}
          contexte={contexteDesFiltres(new URLSearchParams(qs), {
            depart: 'Départ',
            dossier: 'N° de dossier',
            annonceur: 'Annonceur',
            statut: 'Statut',
            destinataire: 'Destinataire',
            afficheur: 'Afficheur',
            repere: 'Repère',
          })}
        >
          <TableSynthese synthese={etat.data} />
        </Edition>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" onClick={onFermer}>
          Fermer
        </Button>
        <Button
          type="button"
          onClick={() => {
            window.print()
          }}
        >
          Imprimer la fiche
        </Button>
      </div>
    </Modale>
  )
}

function TableSynthese({ synthese }: { synthese: Synthese }) {
  if (synthese.groupes.length === 0)
    return <p className="text-sm text-slate-600">Aucune ligne pour ces filtres.</p>
  return (
    <table className="w-full text-sm" aria-label="Synthèse par destinataire">
      <thead>
        <tr className="border-b text-left text-slate-500">
          <th>Destinataire</th>
          <th>Dossier</th>
          <th>Annonceur</th>
          <th>Thème</th>
          <th>Repiquage</th>
          <th>Format</th>
          <th className="text-right">Qté</th>
          <th className="text-right">Entretien</th>
          <th className="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {synthese.groupes.flatMap((g) => [
          ...g.lignes.map((l, i) => (
            <tr key={`${g.destinataire}-${String(i)}`} className="border-b">
              <td>{i === 0 ? g.destinataire : ''}</td>
              <td>{l.dossier ?? '—'}</td>
              <td>{l.annonceur ?? '—'}</td>
              <td>{l.theme ?? '—'}</td>
              <td>{l.repiquage ?? '—'}</td>
              <td>{l.format ?? '—'}</td>
              <td className="text-right">{l.qte}</td>
              <td className="text-right">{l.entretien}</td>
              <td className="text-right">{l.total}</td>
            </tr>
          )),
          <tr key={`${g.destinataire}-total`} className="border-b font-medium">
            <td colSpan={6}>Total {g.destinataire}</td>
            <td className="text-right">{g.qte}</td>
            <td className="text-right">{g.entretien}</td>
            <td className="text-right">{g.total}</td>
          </tr>,
        ])}
        <tr className="font-semibold">
          <td colSpan={6}>Total général</td>
          <td className="text-right">{synthese.qte}</td>
          <td className="text-right">{synthese.entretien}</td>
          <td className="text-right">{synthese.total}</td>
        </tr>
      </tbody>
    </table>
  )
}

/** ECR-COO-09e (RG-COO-304) : quantités à encoller du Bus, ajustement global et par centre. */
function ModaleEncoller({
  peutEcrire,
  depart,
  sites,
  onFermer,
}: {
  peutEcrire: boolean
  depart: string | undefined
  sites: readonly (readonly [number, string])[]
  onFermer: (m: string | null) => void
}) {
  const [site, setSite] = useState<number | undefined>(sites[0]?.[0])
  const params = new URLSearchParams()
  if (depart) params.set('depart', depart)
  if (site !== undefined) params.set('plateforme', String(site))
  const qs = params.size > 0 ? `?${params.toString()}` : ''
  const { etat, recharger } = useApi(`unitaire-encoller-${qs}`, (signal) =>
    apiRequest('GET', `/api/coordination/unitaire/encoller${qs}`, {
      schema: EncollerSchema,
      signal,
    }),
  )
  return (
    <Modale
      titre="Quantités à encoller"
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <p className="mb-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm" role="note">
        Bus Nanterre : calcul Broadcast (+8 % +20 %), ajusté globalement puis par centre (hypothèse
        Q-196).
      </p>
      {sites.length > 1 && (
        <label className="mb-2 block text-sm">
          Site
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={site ?? ''}
            onChange={(ev) => {
              setSite(Number(ev.target.value))
            }}
          >
            {sites.map(([id, nom]) => (
              <option key={id} value={id}>
                {nom}
              </option>
            ))}
          </select>
        </label>
      )}
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <FormulaireEncoller
          key={etat.data.plateformeId}
          e={etat.data}
          peutEcrire={peutEcrire}
          onFermer={onFermer}
        />
      )}
    </Modale>
  )
}

function FormulaireEncoller({
  e,
  peutEcrire,
  onFermer,
}: {
  e: Encoller
  peutEcrire: boolean
  onFermer: (m: string | null) => void
}) {
  const [global, setGlobal] = useState(String(e.ajustementGlobal))
  const [centres, setCentres] = useState(
    Object.fromEntries(e.centres.map((c) => [c.destinataireId, String(c.ajustement)])),
  )
  const { envoi, erreur, lancer } = useEnvoi()
  const nombre = (v: string | undefined) => (v !== undefined && v.trim() !== '' ? Number(v) : 0)
  const valide = [global, ...Object.values(centres)].every((v) => Number.isFinite(nombre(v)))
  return (
    <>
      <label className="block text-sm">
        Ajustement global (%)
        <input
          className="ml-1 w-24 rounded-md border border-slate-300 px-2 py-1"
          inputMode="decimal"
          value={global}
          disabled={!peutEcrire}
          onChange={(ev) => {
            setGlobal(ev.target.value)
          }}
        />
      </label>
      {e.centres.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Aucun centre bus pour {e.depart}.</p>
      ) : (
        <table className="mt-3 w-full text-sm" aria-label="Centres bus">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th>Centre bus</th>
              <th className="text-right">Quantité commandée</th>
              <th className="text-right">Calcul Broadcast (+8 % +20 %)</th>
              <th className="text-right">Ajustement centre (%)</th>
              <th className="text-right">À encoller</th>
            </tr>
          </thead>
          <tbody>
            {e.centres.map((c) => (
              <tr key={c.destinataireId} className="border-b">
                <td>{c.centre}</td>
                <td className="text-right">{c.commande}</td>
                <td className="text-right">{c.calculBroadcast}</td>
                <td className="text-right">
                  <input
                    aria-label={`Ajustement ${c.centre}`}
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right"
                    inputMode="decimal"
                    value={centres[c.destinataireId] ?? '0'}
                    disabled={!peutEcrire}
                    onChange={(ev) => {
                      setCentres({ ...centres, [c.destinataireId]: ev.target.value })
                    }}
                  />
                </td>
                <td className="text-right">{c.aEncoller}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-sm">Total à encoller (dernier enregistrement) : {e.total}</p>
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          onClick={() => {
            onFermer(null)
          }}
        >
          Fermer
        </Button>
        <Button
          type="button"
          disabled={envoi || !peutEcrire || !valide}
          onClick={() => {
            void lancer(async () => {
              await apiPost('/api/coordination/unitaire/encoller', {
                schema: EncollerSchema,
                body: {
                  plateformeId: e.plateformeId,
                  depart: e.depart,
                  ajustementGlobal: nombre(global),
                  centres: e.centres.map((c) => ({
                    destinataireId: c.destinataireId,
                    ajustement: nombre(centres[c.destinataireId]),
                  })),
                  version: e.version,
                },
              })
              onFermer(
                'Quantités à encoller enregistrées : états de collage à éditer (impression navigateur).',
              )
            })
          }}
        >
          Enregistrer et éditer les états de collage
        </Button>
      </div>
    </>
  )
}

// EX-NEW16-COO-001 — ordre des colonnes Circé, métadonnées de l’UM et ajouts de la maquette.
function colonnesUnitaire(type: TypeUnitaire): ColonneMetier<LigneUnitaire>[] {
  const cols: ColonneMetier<LigneUnitaire>[] = [
    { id: 'type', titre: 'Type prépa', valeur: (l) => l.typePreparation },
    { id: 'dossier', titre: 'Dossier', valeur: (l) => l.dossier },
    { id: 'annonceur', titre: 'Annonceur', valeur: (l) => l.annonceur },
    { id: 'theme', titre: 'Thème', valeur: (l) => l.theme },
    { id: 'repiquage', titre: 'Repiquage', valeur: (l) => l.repiquage },
    {
      id: 'dest',
      titre: type === 'bus' ? 'Centre bus' : 'Destinataire',
      valeur: (l) => l.destinataire,
    },
    { id: 'qte', titre: 'Qté', valeur: (l) => l.qte },
    { id: 'format', titre: 'Format', valeur: (l) => l.format },
    {
      id: 'statut',
      titre: 'Statut',
      valeur: (l) => (l.aLiberer ? 'À libérer' : (STATUTS[l.statut]?.libelle ?? l.statut)),
      rendu: (l) => (
        <Pastille
          ton={l.aLiberer ? 'neutre' : (STATUTS[l.statut]?.ton ?? 'neutre')}
          production={l.aLiberer ? 'A_TRAITER' : l.statut}
        >
          {l.aLiberer ? 'À libérer' : (STATUTS[l.statut]?.libelle ?? l.statut)}
        </Pastille>
      ),
    },
    { id: 'dateAff', titre: 'Date Affichage', valeur: (l) => l.jourAffichage?.slice(0, 10) ?? '' },
    {
      id: 'commentaireUM',
      titre: 'Commentaire UM',
      valeur: (l) => l.detailsUm?.commentaires.join(' / ') ?? '',
    },
    { id: 'colis', titre: 'Code colis', valeur: (l) => l.detailsUm?.colis.join(', ') ?? '' },
    { id: 'qtePrep', titre: 'Qté préparée', valeur: (l) => l.detailsUm?.quantitePreparee ?? 0 },
    { id: 'afficheur', titre: 'Afficheur', valeur: (l) => l.afficheur },
    { id: 'repart', titre: 'Répart', valeur: (l) => l.detailsUm?.repartitions.join(', ') ?? '' },
    {
      id: 'prepCode',
      titre: 'Préparation',
      valeur: (l) => l.detailsUm?.preparations.join(', ') ?? '',
    },
    { id: 'id', titre: 'UM', valeur: (l) => l.unite?.code ?? '—' },
    {
      id: 'atelier',
      titre: 'Atelier',
      valeur: (l) => `${l.atelier.libelle} · ${l.atelier.plateforme}`,
    },
    {
      id: 'nAffiche',
      titre: 'numéro affiche',
      valeur: (l) => l.detailsUm?.affiches.join(', ') ?? '',
    },
    {
      id: 'dateCrea',
      titre: 'Date Création',
      valeur: (l) => l.detailsUm?.creation?.slice(0, 10) ?? '',
      cachee: type === 'fixe',
    },
    { id: 'entretien', titre: 'Entretien', valeur: (l) => l.entretien, ajout: true },
    { id: 'total', titre: 'Total', valeur: (l) => l.total, ajout: true },
    { id: 'depart', titre: 'Départ', valeur: (l) => l.depart, ajout: true },
    {
      id: 'repere',
      titre: 'Repère',
      valeur: (l) =>
        [
          l.apresLiberation ? 'Arrivé après libération' : '',
          l.rendue ? 'main rendue' : '',
          l.enProduction ? 'en production' : '',
          l.corrigeePlateforme ? 'corrigé par la plateforme' : '',
        ]
          .filter(Boolean)
          .join(' · '),
      ajout: true,
    },
    {
      id: 'afficheRecue',
      titre: 'Affiche reçue',
      valeur: (l) => AFFICHE[l.afficheRecue],
      ajout: true,
    },
  ]
  const ordre =
    type === 'pliage'
      ? [
          'dossier',
          'annonceur',
          'theme',
          'dest',
          'qte',
          'format',
          'statut',
          'dateAff',
          'commentaireUM',
          'colis',
          'qtePrep',
          'afficheur',
          'repart',
          'atelier',
          'prepCode',
          'id',
          'dateCrea',
          'type',
          'nAffiche',
        ]
      : []
  return ordre.length
    ? [
        ...ordre.flatMap((id) => cols.filter((c) => c.id === id)),
        ...cols.filter((c) => !ordre.includes(c.id)),
      ]
    : cols
}
