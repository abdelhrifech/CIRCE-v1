import { exporterExcel } from '../../lib/excel.ts'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  formatSemaineIso,
  J3DonneesSchema,
  J3Schema,
  lireSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type J3Donnees,
  type J3Resultat,
} from '@circe/shared'
import { useState } from 'react'
import { z } from 'zod'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
const Semaine = z.string().regex(/^\d{4}-W\d{2}$/)
export const Route = createFileRoute('/reception/j3')({
  validateSearch: z.object({ semaine: Semaine.optional() }),
  beforeLoad: requirePermission('j3.gerer'),
  component: Page,
})
const CHAMPS: [keyof J3Donnees, string, readonly string[] | 'cout' | undefined][] = [
  ['prepa', 'Gestionnaire Pré-Prod', undefined],
  ['commerce', 'Gestionnaire Commerce', undefined],
  ['type', 'Annonceur / Ville', ['', 'A', 'V']],
  ['region', 'Région', undefined],
  ['ville', 'Ville', undefined],
  ['impact', 'Impact S-T', ['NON', 'OUI']],
  ['typeImpact', 'Type d’impact', undefined],
  ['depart', 'Jour de départ des colis depuis la plateforme', undefined],
  ['go', 'GO / NO GO S-Tech.', ['', 'GO', 'NO GO']],
  ['goCond', 'GO sous condition(s)', undefined],
  ['imprimeur', 'Imprimeur', undefined],
  ['comm', 'Commentaire', undefined],
  [
    'livPrevue',
    'Si raccrochage ou retard : livraison prévue (milk run ou carton sous-traitant)',
    undefined,
  ],
  ['surPtf', 'Surcoût plateforme', 'cout'],
  ['surTech', 'Surcoût technique', 'cout'],
]
const champ = 'w-full min-w-28 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm'
function Page() {
  const s = Route.useSearch(),
    navigate = useNavigate({ from: Route.fullPath })
  const [semaineInitiale] = useState(() =>
    formatSemaineIso(semaineIsoDe(new Date(Date.now() + 7 * 864e5))),
  )
  const semaine = s.semaine ?? semaineInitiale
  const { etat, recharger } = useApi(`j3-${semaine}`, async (signal) => {
    await apiPost('/api/j3/initialiser', {
      schema: z.object({ initialise: z.boolean() }),
      body: { semaine },
    })
    return apiRequest('GET', `/api/j3?semaine=${semaine}`, { schema: J3Schema, signal })
  })
  const anneeSem = lireSemaineIso(semaine)
  const jeudi = new Date(lundiSemaineIso(anneeSem).getTime() - 4 * 864e5)
  return (
    <main className="mx-auto max-w-[1800px] p-6">
      <p className="text-sm text-slate-500">Réception</p>
      <h1 className="mb-5 text-2xl font-semibold">J-3</h1>
      <div className="mb-5 flex flex-wrap items-center gap-5">
        <label className="text-sm font-medium">
          Semaine d’affichage{' '}
          <input
            type="week"
            className="ml-2 rounded border p-2"
            value={semaine}
            onChange={(e) => {
              if (e.target.value) void navigate({ search: { semaine: e.target.value } })
            }}
          />
        </label>
        <p className="rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm">
          À remplir le jeudi de S-1 avant 9 h · {jeudi.toLocaleDateString('fr-FR')}
        </p>
      </div>
      {etat.kind === 'loading' && <p>Chargement des trois tableaux…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <div className="space-y-6">
          {!etat.data.sections.length && (
            <p className="rounded border bg-white p-6">
              Aucune plateforme J-3 dans le site ou le périmètre sélectionné.
            </p>
          )}
          {etat.data.sections.map((section) => (
            <Section
              key={`${semaine}-${section.plateformeId}-${section.id}`}
              section={section}
              semaine={semaine}
              recharger={recharger}
            />
          ))}
        </div>
      )}
    </main>
  )
}
function Section({
  section: s,
  semaine,
  recharger,
}: {
  section: J3Resultat['sections'][number]
  semaine: string
  recharger: () => void
}) {
  const [ajout, setAjout] = useState(false),
    [selection, setSelection] = useState<number[]>([]),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false),
    [recherche, setRecherche] = useState('')
  const candidats = s.candidats.filter(
    (c) =>
      !s.lignes.some((l) => l.candidat.dossierId === c.dossierId) &&
      `${c.dossier} ${c.annonceur}`.toLowerCase().includes(recherche.toLowerCase()),
  )
  const [maj, setMaj] = useState(s.modifieLe)
  async function ajouter() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost('/api/j3/lignes', {
        schema: z.object({ message: z.string() }),
        body: { semaine, section: s.id, plateformeId: s.plateformeId, dossierIds: selection },
      })
      setAjout(false)
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <section className="rounded-lg border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="text-lg font-semibold">{s.nom}</h2>
          <p className="text-xs text-slate-500">{s.formats.join(', ')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              exporterExcel(
                `j3-${s.id}-${semaine}`,
                [
                  'Dossier',
                  'Annonceur',
                  ...CHAMPS.slice(0, 5).map((c) => c[1]),
                  'Semaine',
                  ...s.formats,
                  ...CHAMPS.slice(5).map((c) => c[1]),
                  'Attendu',
                  'Reçu',
                  'Reste',
                ],
                s.lignes.map((l) => [
                  l.candidat.dossier,
                  l.candidat.annonceur,
                  ...CHAMPS.slice(0, 5).map(([k]) => l.donnees[k]),
                  l.candidat.depart,
                  ...s.formats.map((f) => l.candidat.formats[f] ?? 0),
                  ...CHAMPS.slice(5).map(([k]) => l.donnees[k]),
                  l.candidat.attendu,
                  l.candidat.recu,
                  l.candidat.reste,
                ]),
              )
            }}
          >
            Exporter en Excel
          </button>
          <span className="text-xs text-slate-500">
            {maj ? `MAJ du ${new Date(maj).toLocaleString('fr-FR')}` : 'Pas encore mis à jour'}
          </span>
          <Button
            type="button"
            onClick={() => {
              setAjout(true)
            }}
          >
            Ajouter depuis l’EDR vivant
          </Button>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                'Dossier',
                'Annonceur',
                ...CHAMPS.slice(0, 5).map((c) => c[1]),
                'Départ (EDR)',
                ...s.formats.map((f) => `Qté ${f}`),
                ...CHAMPS.slice(5).map((c) => c[1]),
                '',
              ].map((t) => (
                <th key={t} className="min-w-28 p-3 text-left">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.lignes.map((l) => (
              <Ligne
                key={l.id}
                ligne={l}
                formats={s.formats}
                onSauvee={setMaj}
                onRetiree={recharger}
              />
            ))}
          </tbody>
          <tfoot className="border-t bg-slate-50 font-semibold">
            <tr>
              <td colSpan={8} className="p-3">
                Total général
              </td>
              {s.formats.map((f) => (
                <td key={f} className="p-3">
                  {s.lignes.reduce((s, l) => s + (l.candidat.formats[f] ?? 0), 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        {!s.lignes.length && (
          <p className="p-6 text-slate-600">
            Aucune ligne pour cette semaine : « Ajouter depuis l’EDR vivant » choisit les dossiers à
            suivre.
          </p>
        )}
      </div>
      {ajout && (
        <Modale
          titre={`Ajouter depuis l’EDR vivant · ${s.nom} · ${semaine}`}
          ouverte
          large
          onOuverture={setAjout}
        >
          <input
            className={champ}
            placeholder="Dossier ou annonceur"
            aria-label="Rechercher dans l’EDR"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
            }}
          />
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr>
                {['', 'Dossier', 'Annonceur', 'Attendu', 'Reçu', 'Reste à recevoir'].map((t, i) => (
                  <th key={i} className="p-2 text-left">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidats.map((c) => (
                <tr key={c.dossierId} className="border-t">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      aria-label={`Ajouter le dossier ${c.dossier}`}
                      checked={selection.includes(c.dossierId)}
                      onChange={(e) => {
                        setSelection((old) =>
                          e.target.checked
                            ? [...old, c.dossierId]
                            : old.filter((id) => id !== c.dossierId),
                        )
                      }}
                    />
                  </td>
                  <td className="p-2">{c.dossier}</td>
                  <td className="p-2">{c.annonceur}</td>
                  <td className="p-2">{c.attendu}</td>
                  <td className="p-2">{c.recu}</td>
                  <td className="p-2">{c.reste}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!candidats.length && (
            <p className="my-5">
              Aucun autre dossier de cette section dans l’EDR pour cette semaine.
            </p>
          )}
          {erreur !== null && <ErrorMessage error={erreur} />}
          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              disabled={!selection.length || envoi}
              onClick={() => void ajouter()}
            >
              Ajouter la sélection
            </Button>
          </div>
        </Modale>
      )}
    </section>
  )
}
function Ligne({
  ligne: l,
  formats,
  onSauvee,
  onRetiree,
}: {
  ligne: J3Resultat['sections'][number]['lignes'][number]
  formats: string[]
  onSauvee: (d: string) => void
  onRetiree: () => void
}) {
  const [donnees, setDonnees] = useState(l.donnees),
    [version, setVersion] = useState(l.version),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false),
    [sauvee, setSauvee] = useState(JSON.stringify(l.donnees))
  async function sauver(d: J3Donnees) {
    if (JSON.stringify(d) === sauvee) return
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost(`/api/j3/lignes/${l.id}`, {
        schema: z.object({ version: z.number(), donnees: J3DonneesSchema, modifieLe: z.string() }),
        body: { version, donnees: d },
      })
      setVersion(r.version)
      setSauvee(JSON.stringify(r.donnees))
      onSauvee(r.modifieLe)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  async function retirer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost(`/api/j3/lignes/${l.id}/retirer`, {
        schema: z.object({ message: z.string() }),
        body: { version },
      })
      onRetiree()
    } catch (e) {
      setErreur(e)
      setEnvoi(false)
    }
  }
  function cellule([k, label, options]: (typeof CHAMPS)[number]) {
    return (
      <td key={k} className="p-2">
        {Array.isArray(options) ? (
          <select
            aria-label={`${label}, dossier ${l.candidat.dossier}`}
            className={champ}
            disabled={envoi}
            value={String(donnees[k] ?? '')}
            onChange={(e) => {
              const next = { ...donnees, [k]: e.target.value }
              setDonnees(next)
              void sauver(next)
            }}
          >
            {(options as readonly string[]).map((o) => (
              <option key={o} value={o}>
                {o || '—'}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label={`${label}, dossier ${l.candidat.dossier}`}
            type={options === 'cout' ? 'number' : 'text'}
            min={options === 'cout' ? 0 : undefined}
            step={options === 'cout' ? '0.01' : undefined}
            className={champ}
            disabled={envoi}
            value={donnees[k] ?? ''}
            onChange={(e) => {
              setDonnees((d) => ({
                ...d,
                [k]:
                  options === 'cout'
                    ? e.target.value === ''
                      ? null
                      : Number(e.target.value)
                    : e.target.value,
              }))
            }}
            onBlur={() => void sauver(donnees)}
          />
        )}
      </td>
    )
  }
  return (
    <tr className="border-t">
      <td className="p-3 font-mono">{l.candidat.dossier}</td>
      <td className="min-w-48 p-3">{l.candidat.annonceur}</td>
      {CHAMPS.slice(0, 5).map(cellule)}
      <td className="p-3">{l.candidat.depart}</td>
      {formats.map((f) => (
        <td key={f} className="p-3">
          {l.candidat.formats[f] ?? ''}
        </td>
      ))}
      {CHAMPS.slice(5).map(cellule)}
      <td className="min-w-40 p-3">
        <button type="button" className="underline" disabled={envoi} onClick={() => void retirer()}>
          Retirer
        </button>
        {envoi && <p className="text-xs">Enregistrement…</p>}
        {erreur !== null && (
          <>
            <ErrorMessage error={erreur} />
            <button type="button" className="underline" onClick={() => void sauver(donnees)}>
              Réessayer
            </button>
          </>
        )}
      </td>
    </tr>
  )
}
