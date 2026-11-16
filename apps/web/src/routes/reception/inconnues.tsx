import { BoutonExportTableau } from '../../components/ui/export-tableau.tsx'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  InconnuesSchema,
  RattachementInconnueResultatSchema,
  ResultatAfficheSchema,
  STATUTS_INCONNUE,
  type StatutInconnue,
} from '@circe/shared'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { ApercuFeuilles } from '../../components/reception/apercu-feuilles.tsx'
import { FicheAfficheModale, RechercheDossiers } from '../../components/reception/fiche-affiche.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { dateCourte, duree } from '../../lib/duree.ts'
import { LIBELLE_STATUT_INCONNUE } from '../../lib/libelles-affiche.ts'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// ECR-REC-04 — Réceptions inconnues (RG-REC-101 à 120). Statut par ligne calculé par l'API.

const SearchSchema = z.object({
  statut: z.array(z.enum(STATUTS_INCONNUE)).optional(),
  id: z.coerce.number().int().optional(),
})

export const Route = createFileRoute('/reception/inconnues')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('reception.inconnue.consulter'),
  component: ReceptionsInconnues,
})

type Ligne = z.infer<typeof InconnuesSchema>['items'][number]

function ReceptionsInconnues() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const query = (search.statut ?? []).map((s) => `statut=${s}`).join('&')
  const { etat, recharger } = useApi(`inconnues?${query}`, (signal) =>
    apiRequest('GET', `/api/receptions-inconnues${query ? `?${query}` : ''}`, {
      schema: InconnuesSchema,
      signal,
    }),
  )
  const [fiche, setFiche] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const items = etat.kind === 'ready' ? etat.data.items : []
  const filtre = etat.kind === 'ready' ? etat.data.filtreStatut : (search.statut ?? [])
  const choisie = items.find((l) => l.afficheId === search.id) ?? items[0] ?? null

  function basculer(s: StatutInconnue) {
    const n = filtre.includes(s) ? filtre.filter((x) => x !== s) : [...filtre, s]
    void navigate({ search: (prev) => ({ ...prev, statut: n }), replace: true })
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <p className="text-sm text-slate-500">Réception</p>
      <h1 className="text-2xl font-semibold">Réceptions inconnues</h1>

      <fieldset className="mt-4 flex flex-wrap gap-3 text-sm">
        <legend className="font-medium">Statut</legend>
        {STATUTS_INCONNUE.map((s) => (
          <label key={s} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={filtre.includes(s)}
              onChange={() => {
                basculer(s)
              }}
            />
            {LIBELLE_STATUT_INCONNUE[s]?.libelle ?? s}
          </label>
        ))}
      </fieldset>
      {message && (
        <p
          role="status"
          className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm"
          data-testid="message-inconnues"
        >
          {message}
        </p>
      )}
      <section className="mt-3 rounded-lg border border-slate-200 bg-white">
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {etat.kind === 'ready' && items.length === 0 && (
          <p className="p-3 text-sm text-slate-600">Aucune réception inconnue avec ce statut.</p>
        )}
        {items.length > 0 && (
          <>
            <BoutonExportTableau nom="reception-inconnues" tableau="Réceptions inconnues" />
            <table className="w-full text-sm" aria-label="Réceptions inconnues">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {[
                    'N° affiche',
                    'Lu sur l’affiche',
                    'Site',
                    'Qté',
                    'Reçue le',
                    'En attente depuis',
                    'Statut',
                    'Dossier(s)',
                    'Emplacement',
                    '',
                  ].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr
                    key={l.afficheId}
                    className={`cursor-pointer border-t border-slate-100 ${choisie?.afficheId === l.afficheId ? 'bg-sky-50' : l.statut === 'A_IDENTIFIER' && l.enRetard ? 'bg-orange-50' : ''}`}
                    onClick={() => {
                      if (l.statut === 'A_IDENTIFIER' || l.statut === 'INTROUVABLE')
                        setFiche(l.afficheId)
                      void navigate({
                        search: (prev) => ({ ...prev, id: l.afficheId }),
                        replace: true,
                      })
                    }}
                  >
                    <td className="px-3 py-2 font-mono">{l.afficheId}</td>
                    <td className="px-3 py-2">
                      {l.annonceur ?? '—'} · {l.description ?? '—'}
                    </td>
                    <td className="px-3 py-2">{l.site.nom}</td>
                    <td className="px-3 py-2">{l.quantite}</td>
                    <td className="px-3 py-2">{dateCourte(l.recueLe)}</td>
                    <td className="px-3 py-2">
                      {l.enAttenteMinutes === null ? '—' : duree(l.enAttenteMinutes)}{' '}
                      {l.enRetard && <Pastille ton="important">Important</Pastille>}
                    </td>
                    <td className="px-3 py-2">
                      <Pastille ton={LIBELLE_STATUT_INCONNUE[l.statut]?.ton ?? 'neutre'}>
                        {LIBELLE_STATUT_INCONNUE[l.statut]?.libelle ?? l.statut}
                        {l.statut === 'INTROUVABLE' && l.signaleLe
                          ? ` le ${dateCourte(l.signaleLe)}`
                          : ''}
                      </Pastille>
                    </td>
                    <td className="px-3 py-2">{l.dossiers.join(', ') || '—'}</td>
                    <td className="px-3 py-2">{l.emplacement}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFiche(l.afficheId)
                        }}
                      >
                        Fiche
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
      {etat.kind === 'ready' && items.length === 0 && (
        <p className="mt-4 text-sm text-slate-600">
          Aucune réception inconnue : elles se créent depuis Réception des affiches (« Réception
          inconnue… »).
        </p>
      )}
      {choisie && choisie.statut !== 'A_IDENTIFIER' && choisie.statut !== 'INTROUVABLE' && (
        <Detail
          key={`${String(choisie.afficheId)}-${String(choisie.version)}`}
          l={choisie}
          onFiche={() => {
            setFiche(choisie.afficheId)
          }}
          onFait={(m) => {
            setMessage(m)
            recharger()
          }}
        />
      )}
      {fiche !== null && (
        <FicheAfficheModale
          afficheId={fiche}
          onFermer={(modifiee) => {
            setFiche(null)
            if (modifiee) recharger()
          }}
        />
      )}
    </main>
  )
}

/** RG-REC-119 : boutons selon l'état de la réception inconnue. */
function Detail({
  l,
  onFiche,
  onFait,
}: {
  l: Ligne
  onFiche: () => void
  onFait: (m: string) => void
}) {
  const { etat: moi } = useApi('moi', () => getMe())
  const peutRattacher = moi.kind === 'ready' && can(moi.data, 'reception.inconnue.rattacher')
  const peutSignaler = moi.kind === 'ready' && can(moi.data, 'reception.inconnue.signaler')
  const [selection, setSelection] = useState<{ ligneAttendueId: number; quantite: number }[]>([])
  const [erreur, setErreur] = useState<unknown>(null)
  const [apercu, setApercu] = useState(false)
  const aIdentifier = l.statut === 'A_IDENTIFIER' || l.statut === 'INTROUVABLE'

  async function rattacher() {
    setErreur(null)
    try {
      const r = await apiPost(`/api/affiches/${String(l.afficheId)}/rattacher-inconnue`, {
        schema: RattachementInconnueResultatSchema,
        body: { version: l.version, lignes: selection },
      })
      onFait(r.message)
    } catch (e) {
      setErreur(e)
    }
  }
  async function signaler() {
    setErreur(null)
    try {
      const r = await apiPost(`/api/affiches/${String(l.afficheId)}/signaler`, {
        schema: ResultatAfficheSchema.extend({ receptionId: z.number() }),
        body: { receptionVersion: l.receptionVersion },
      })
      onFait(r.message)
    } catch (e) {
      setErreur(e)
    }
  }

  return (
    <section
      className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm"
      aria-label={`Affiche n° ${String(l.afficheId)}`}
    >
      <h2 className="font-medium">
        Affiche n° {l.afficheId}
        {aIdentifier ? ' · à identifier' : ''}
      </h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-[160px_1fr]">
        {l.photoId !== null ? (
          <img
            src={`/api/photos/${String(l.photoId)}`}
            alt={`Photo de l’affiche ${String(l.afficheId)}`}
            className="max-h-40 rounded border"
          />
        ) : (
          <div className="flex h-32 items-center justify-center rounded border border-dashed text-slate-500">
            Pas de photo
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4">
          <dt className="font-medium">Annonceur lu</dt>
          <dd>{l.annonceur ?? '—'}</dd>
          <dt className="font-medium">Description saisie</dt>
          <dd>{l.description ?? '—'}</dd>
          <dt className="font-medium">Quantité · format</dt>
          <dd>
            {l.quantite} · {l.format}
          </dd>
          <dt className="font-medium">Imprimeur · emplacement</dt>
          <dd>
            {l.imprimeur ?? '—'} · {l.emplacement}
            {l.feuille === 'TEMPORAIRE' && aIdentifier ? ' (zone tampon)' : ''}
          </dd>
        </dl>
      </div>
      {l.statut === 'INTROUVABLE' && l.signaleLe && (
        <p className="mt-2 rounded-md border border-orange-200 bg-orange-50 p-2">
          Signalée à la Coordination le {dateCourte(l.signaleLe)}.
        </p>
      )}
      {aIdentifier && peutRattacher && (
        <div className="mt-3">
          {/* RG-REC-104 / RG-REC-106 : identification par le visuel BLOQUÉE (Q-112) : voie « par n° de dossier ». */}
          <h3 className="font-medium">Trouver le dossier — par n° de dossier</h3>
          <RechercheDossiers
            afficheId={l.afficheId}
            qInitial=""
            max={8}
            multiple
            quantiteDefaut={l.quantite}
            onSelection={setSelection}
          />
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button type="button" className="underline" onClick={onFiche}>
              Fiche de l’affiche
            </button>
            <Button type="button" onClick={() => void rattacher()}>
              Rattacher
            </Button>
          </div>
        </div>
      )}
      {l.statut === 'A_IDENTIFIER' && peutSignaler && (
        <p className="mt-3">
          Personne ne retrouve le dossier ?{' '}
          <Button type="button" onClick={() => void signaler()}>
            Signaler à la Coordination (alerte)
          </Button>
        </p>
      )}
      {l.statut === 'RATTACHEE_A_CONTROLER' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <p className="w-full">
            Dossier(s) {l.dossiers.join(', ')} · Palette R{l.receptionId} dans le sas de contrôle.
          </p>
          <button type="button" className="underline" onClick={onFiche}>
            Modifier le rattachement ou le thème
          </button>
          <Link
            className="rounded-md bg-slate-900 px-3 py-1.5 text-white"
            to="/reception"
            search={{ palette: l.receptionId }}
          >
            Valider et imprimer dans Réception des affiches
          </Link>
        </div>
      )}
      {l.statut === 'CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER' && (
        <div className="mt-3">
          {/* RG-REC-119 : l'impression se fait dans Réception des affiches (contrôle de la palette). */}
          <Link
            className="rounded-md bg-slate-900 px-3 py-1.5 text-white"
            to="/reception"
            search={{ palette: l.receptionId }}
          >
            Imprimer dans Réception des affiches
          </Link>
        </div>
      )}
      {l.statut === 'RATTACHEE_FEUILLE_DEFINITIVE' && (
        <div className="mt-3 flex gap-2">
          <button type="button" className="underline" onClick={onFiche}>
            Ouvrir la fiche de l’affiche
          </button>
          <Button
            type="button"
            onClick={() => {
              setApercu(true)
            }}
          >
            Réimprimer la feuille définitive
          </Button>
        </div>
      )}
      {erreur !== null && (
        <div className="mt-2">
          <ErrorMessage error={erreur} />
        </div>
      )}
      {apercu && (
        <ApercuFeuilles
          afficheIds={[l.afficheId]}
          avecEtiquettes
          onFermer={(imprime) => {
            setApercu(false)
            if (imprime) onFait('Feuille définitive imprimée.')
          }}
        />
      )}
    </section>
  )
}
