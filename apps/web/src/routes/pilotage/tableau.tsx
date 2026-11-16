import { createFileRoute } from '@tanstack/react-router'
import {
  AteliersPerimetreSchema,
  DispositionTableauSchema,
  DonneesTableauSchema,
  TABLEAU_DEFAUT,
  TABLEAU_SOURCES,
  type DonneesTableau,
  type TableauCarre,
} from '@circe/shared'
import { useEffect, useRef, useState } from 'react'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { ErrorMessage } from '../../components/error-message.tsx'
import { ChoixMultiples } from '../../components/nonconformite/ecrans.tsx'
export const Route = createFileRoute('/pilotage/tableau')({
  beforeLoad: requirePermission('validation_admin.valider'),
  component: Page,
})
const TITRES = {
  sansIP: 'Réceptions sans IP',
  nonConforme: 'Quantité non conforme',
  echeance: 'Échéance S-2 dépassée',
  j3: 'Échéance à J-3',
  va: 'Validation admin à confirmer',
  iok: 'Instruction OK en cours',
  inconnues: 'Réceptions inconnues',
  themes: 'Thèmes à vérifier',
}
const LIENS = {
  sansIP: '/pilotage/alertes?type=SANS_IP',
  nonConforme: '/pilotage/alertes?type=ECART_BC',
  echeance: '/pilotage/alertes?type=IP_MANQUANTES',
  j3: '/reception/j3',
  va: '/reception/affiches',
  iok: '/coordination?pour=deroulant',
  inconnues: '/reception/inconnues',
  themes: '/coordination/themes',
}
function Page() {
  const { etat, recharger } = useApi('tableau-donnees', (signal) =>
    apiRequest('GET', '/api/pilotage/tableau', { schema: DonneesTableauSchema, signal }),
  )
  const { etat: disposition, recharger: relireDisposition } = useApi(
    'tableau-disposition',
    (signal) =>
      apiRequest('GET', '/api/pilotage/tableau/disposition', {
        schema: DispositionTableauSchema,
        signal,
      }),
  )
  const { etat: ateliers } = useApi('tableau-ateliers', (signal) =>
    apiRequest('GET', '/api/coordination/ateliers', { schema: AteliersPerimetreSchema, signal }),
  )
  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <p className="text-sm text-slate-500">Pilotage</p>
      {(etat.kind === 'loading' || disposition.kind === 'loading') && (
        <p className="mt-4">Chargement du tableau de bord…</p>
      )}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {disposition.kind === 'error' && (
        <ErrorMessage error={disposition.error} onRetry={relireDisposition} />
      )}
      {etat.kind === 'ready' && disposition.kind === 'ready' && (
        <Tableau
          key={disposition.data.version}
          donnees={etat.data}
          initiale={disposition.data.carres}
          initialVersion={disposition.data.version}
          ateliers={ateliers.kind === 'ready' ? ateliers.data.ateliers : []}
        />
      )}
    </main>
  )
}
function Tableau({
  donnees,
  initiale,
  initialVersion,
  ateliers,
}: {
  donnees: DonneesTableau
  initiale: TableauCarre[]
  initialVersion: number
  ateliers: { id: number; libelle: string }[]
}) {
  const [carres, setCarres] = useState(initiale),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false),
    [ajout, setAjout] = useState('')
  const [dossier, setDossier] = useState(''),
    [depart, setDepart] = useState(''),
    [annonceur, setAnnonceur] = useState(''),
    [atelier, setAtelier] = useState(''),
    [format, setFormat] = useState('')
  const version = useRef(initialVersion),
    glisse = useRef<string | null>(null)
  const [sauvegardee, setSauvegardee] = useState(JSON.stringify(initiale))
  const [configure, setConfigure] = useState<string | null>(null)
  useEffect(() => {
    const snapshot = JSON.stringify(carres)
    if (snapshot === sauvegardee || envoi || erreur !== null) return
    const t = setTimeout(() => {
      setEnvoi(true)
      apiPost('/api/pilotage/tableau/disposition', {
        schema: DispositionTableauSchema,
        body: { version: version.current, carres },
      })
        .then((r) => {
          version.current = r.version
          setSauvegardee(snapshot)
        }, setErreur)
        .finally(() => {
          setEnvoi(false)
        })
    }, 500)
    return () => {
      clearTimeout(t)
    }
  }, [carres, envoi, erreur, sauvegardee])
  function maj(id: string, patch: Partial<TableauCarre>) {
    setCarres((c) => c.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }
  function ajouter(type: TableauCarre['type']) {
    setCarres((c) => [
      ...c,
      {
        id: crypto.randomUUID(),
        type,
        large: false,
        items: ['sansIP', 'nonConforme', 'echeance', 'j3'],
        source: 'va',
        texte: '',
      },
    ])
    setAjout('')
  }
  function deplacer(id: string, cible: string) {
    setCarres((c) => {
      const w = c.find((w) => w.id === id)
      if (!w || id === cible) return c
      const next = c.filter((w) => w.id !== id)
      next.splice(
        next.findIndex((w) => w.id === cible),
        0,
        w,
      )
      return next
    })
  }
  const tout = [...Object.values(donnees.sources).flat(), ...donnees.alertes]
  const options = (valeurs: string[]) =>
    [...new Set(valeurs.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const visibles = (rows: typeof tout) =>
    rows.filter(
      (r) =>
        (!dossier || r.dossier.some((d) => String(d).includes(dossier))) &&
        (!depart || !r.semaines.length || r.semaines.includes(depart)) &&
        (!annonceur || r.annonceur === annonceur) &&
        (!atelier || r.atelierIds.includes(Number(atelier))) &&
        (!format || r.format === format),
    )
  const selection = (
    label: string,
    valeur: string,
    changer: (s: string) => void,
    valeurs: string[],
  ) => (
    <label className="text-sm">
      {label}
      <select
        className="ml-2 rounded border bg-white p-2"
        value={valeur}
        onChange={(e) => {
          changer(e.target.value)
        }}
      >
        <option value="">Tous</option>
        {valeurs.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  )
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Tableau de bord pré-production</h1>
        <div className="flex gap-3">
          <select
            className="rounded border bg-white px-3 py-2 text-sm"
            aria-label="Ajouter un carré"
            value={ajout}
            onChange={(e) => {
              if (e.target.value) ajouter(e.target.value as TableauCarre['type'])
            }}
          >
            <option value="">Ajouter un carré</option>
            <option value="compteurs">Compteurs</option>
            <option value="liste">Liste</option>
            <option value="alertes">Alertes</option>
            <option value="notes">Notes</option>
          </select>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              setCarres(structuredClone(TABLEAU_DEFAUT))
            }}
          >
            Disposition par défaut
          </button>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="text-sm">
          N° de dossier
          <input
            className="ml-2 w-32 rounded border p-2"
            value={dossier}
            onChange={(e) => {
              setDossier(e.target.value)
            }}
          />
        </label>
        {selection('Départ', depart, setDepart, options(tout.flatMap((r) => r.semaines)))}
        {selection('Annonceur', annonceur, setAnnonceur, options(tout.map((r) => r.annonceur)))}
        <label className="text-sm">
          Atelier
          <select
            className="ml-2 rounded border bg-white p-2"
            value={atelier}
            onChange={(e) => {
              setAtelier(e.target.value)
            }}
          >
            <option value="">Tous</option>
            {ateliers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.libelle}
              </option>
            ))}
          </select>
        </label>
        {selection('Format', format, setFormat, options(tout.map((r) => r.format)))}
      </div>
      <p role="status" className="mb-3 text-xs text-slate-500">
        {envoi
          ? 'Enregistrement de votre disposition…'
          : JSON.stringify(carres) !== sauvegardee
            ? 'Modifications à enregistrer…'
            : 'Disposition enregistrée'}
      </p>
      {erreur !== null && (
        <div className="mb-4">
          <ErrorMessage error={erreur} />
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              setErreur(null)
            }}
          >
            Réessayer l’enregistrement
          </button>
        </div>
      )}
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {carres.map((w, index) => (
          <section
            key={w.id}
            className={`min-w-0 rounded-lg border bg-white ${w.large ? 'md:col-span-2' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (glisse.current) deplacer(glisse.current, w.id)
              glisse.current = null
            }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
              draggable
              onDragStart={(e) => {
                glisse.current = w.id
                e.dataTransfer.setData('text/plain', w.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                glisse.current = null
              }}
            >
              <h2 className="font-semibold">
                {w.type === 'compteurs'
                  ? 'Mes compteurs'
                  : w.type === 'notes'
                    ? 'Mes notes'
                    : w.type === 'alertes'
                      ? 'Alertes'
                      : TITRES[w.source]}
              </h2>
              <details className="relative">
                <summary aria-label="Options du carré" className="cursor-pointer">
                  ⋮
                </summary>
                <div className="absolute right-0 z-10 grid w-52 gap-2 rounded border bg-white p-3 text-sm shadow">
                  {w.type === 'compteurs' && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfigure(configure === w.id ? null : w.id)
                      }}
                    >
                      Choisir les compteurs…
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      maj(w.id, { large: !w.large })
                    }}
                  >
                    {w.large ? 'Réduire' : 'Agrandir'}
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => {
                      const avant = carres[index - 1]
                      if (avant) deplacer(w.id, avant.id)
                    }}
                  >
                    Déplacer vers le haut
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCarres((c) => c.filter((x) => x.id !== w.id))
                    }}
                  >
                    Retirer ce carré
                  </button>
                </div>
              </details>
            </div>
            <div className="p-4">
              {w.type === 'compteurs' ? (
                <>
                  {configure === w.id && (
                    <div className="mb-4">
                      <ChoixMultiples
                        label="Choisir les compteurs"
                        options={TABLEAU_SOURCES.map((k) => TITRES[k])}
                        value={w.items.map((k) => TITRES[k])}
                        onChange={(v) => {
                          maj(w.id, { items: TABLEAU_SOURCES.filter((k) => v.includes(TITRES[k])) })
                        }}
                      />
                    </div>
                  )}
                  <dl className="space-y-3">
                    {w.items.map((k) => (
                      <div key={k} className="flex items-center justify-between gap-3">
                        <dt className="text-sm">{TITRES[k]}</dt>
                        <dd>
                          <a href={LIENS[k]} className="text-xl font-semibold text-sky-800">
                            {visibles(donnees.sources[k]).length}
                          </a>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {!w.items.length && (
                    <p className="text-sm text-slate-500">
                      Aucun compteur : Options › Choisir les compteurs.
                    </p>
                  )}
                </>
              ) : w.type === 'notes' ? (
                <>
                  <p className="text-right text-xs text-slate-500">{w.texte.length} / 500</p>
                  <textarea
                    aria-label="Notes"
                    maxLength={500}
                    rows={8}
                    className="mt-2 w-full rounded border p-3 text-sm"
                    value={w.texte}
                    onChange={(e) => {
                      maj(w.id, { texte: e.target.value })
                    }}
                    placeholder="Saisissez vos notes ici"
                  />
                </>
              ) : (
                <>
                  {w.type === 'liste' && (
                    <select
                      aria-label="Contenu de la liste"
                      className="mb-3 w-full rounded border bg-white p-2 text-sm"
                      value={w.source}
                      onChange={(e) => {
                        maj(w.id, { source: e.target.value as TableauCarre['source'] })
                      }}
                    >
                      {TABLEAU_SOURCES.map((k) => (
                        <option key={k} value={k}>
                          {TITRES[k]}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="p-2 text-left">Dossier</th>
                          <th className="p-2 text-left">Annonceur / thème</th>
                          <th className="p-2 text-left">Détail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibles(
                          w.type === 'alertes' ? donnees.alertes : donnees.sources[w.source],
                        ).map((r) => (
                          <tr key={r.id} className="border-t">
                            <td className="p-2">
                              <a className="underline" href={r.lien}>
                                {r.dossier.join(', ') || r.id}
                              </a>
                            </td>
                            <td className="p-2">
                              {r.annonceur}
                              <span className="block text-xs text-slate-500">{r.theme}</span>
                            </td>
                            <td className="p-2">{r.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visibles(w.type === 'alertes' ? donnees.alertes : donnees.sources[w.source])
                      .length && <p className="p-4 text-sm text-slate-500">Rien à signaler.</p>}
                  </div>
                  {w.type === 'alertes' && (
                    <a href="/pilotage/alertes" className="mt-3 block text-sm underline">
                      Toutes les alertes
                    </a>
                  )}
                </>
              )}
            </div>
          </section>
        ))}
      </div>
      {!carres.length && (
        <p className="rounded border bg-white p-6">Aucun carré : « Ajouter un carré ».</p>
      )}
    </>
  )
}
