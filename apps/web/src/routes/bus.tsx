import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  BUS_FORMATS,
  BusHistoriqueSchema,
  BusSchema,
  formatSemaineIso,
  lireSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type BusLigne,
  type BusResultat,
  type BusVisuel,
} from '@circe/shared'
import { useState } from 'react'
import { z } from 'zod'
import { apiPost, apiRequest } from '../lib/api-client.ts'
import { can, getMe, requirePermission } from '../lib/session.ts'
import { useApi } from '../lib/use-api.ts'
import { Button } from '../components/button.tsx'
import { ErrorMessage } from '../components/error-message.tsx'
import { Modale } from '../components/ui/modale.tsx'
import { TableMetier, type ColonneMetier } from '../components/ui/table-metier.tsx'
import { Edition } from '../components/impression/edition.tsx'
import { ModaleReceptionInconnue } from '../components/reception/modale-reception-inconnue.tsx'
import { lireBase64 } from '../components/reception/bon-livraison.tsx'
const SearchSchema = z.object({
  tab: z.enum(['suivi', 'reception', 'atraiter', 'preparation', 'vue']).default('suivi'),
  sem: z.string().optional(),
  semaine: z.string().optional(),
  dossier: z.string().optional(),
  centre: z.string().optional(),
  parc: z.string().optional(),
  format: z.string().optional(),
  annonceur: z.string().optional(),
  dsp: z.string().optional(),
  statut: z.string().optional(),
  rep: z.string().optional(),
  etape: z.string().optional(),
})
export const Route = createFileRoute('/bus')({
  validateSearch: SearchSchema,
  beforeLoad: requirePermission('bus.consulter'),
  component: Page,
})
type Recherche = z.infer<typeof SearchSchema>
const TITRES = {
  suivi: 'Suivi de prod',
  reception: 'Réceptions attendues',
  atraiter: 'À traiter',
  preparation: 'Préparation',
  vue: 'Vue des réceptions',
}
const STATUTS = {
  ATTENDUE: 'Attendue',
  PARTIELLE: 'Partielle',
  COMPLETE: 'Complète',
  SURPLUS: 'Surplus',
}
const champ = 'rounded border border-slate-300 bg-white px-3 py-2 text-sm'
const semaineActuelle = () => formatSemaineIso(semaineIsoDe(new Date()))
const semaineApres = (s: string, n: number) =>
  formatSemaineIso(
    semaineIsoDe(new Date(lundiSemaineIso(lireSemaineIso(s)).getTime() + n * 7 * 864e5)),
  )
const date = (s: string) => new Date(s).toLocaleDateString('fr-FR')
const nombre = (n: number) => n.toLocaleString('fr-FR')
const somme = (ls: BusLigne[], key: 'aEncoller' | 'vendu' | 'quantiteBroadcast' | 'attendu') =>
  ls.reduce((s, l) => s + l[key], 0)
const racks = (ls: BusLigne[]) =>
  [...new Set(ls.map((l) => `${l.semaine}|${l.centreCode}`))].reduce(
    (n, cle) =>
      n +
      Math.ceil(
        somme(
          ls.filter((l) => `${l.semaine}|${l.centreCode}` === cle),
          'aEncoller',
        ) / 105,
      ),
    0,
  )
const selection = (v: string | undefined) => (!v || v === '*' ? [] : v.split(','))
function correspond(v: string | string[], filtre: string | undefined) {
  const s = selection(filtre)
  return !s.length || (Array.isArray(v) ? v.some((x) => s.includes(x)) : s.includes(v))
}
function Page() {
  const [maintenant] = useState(() => Date.now())
  const s = Route.useSearch(),
    navigate = useNavigate({ from: Route.fullPath })
  const { etat, recharger } = useApi('bus-donnees', (signal) =>
    apiRequest('GET', '/api/bus', { schema: BusSchema, signal }),
  )
  const { etat: moi } = useApi('bus-moi', () => getMe())
  const [reception, setReception] = useState<BusVisuel | null>(null),
    [detail, setDetail] = useState<number | null>(null),
    [inconnue, setInconnue] = useState(false),
    [completer, setCompleter] = useState<BusResultat['sansDossier'][number] | null>(null),
    [document, setDocument] = useState<'preparation' | 'synthese' | 'etiquettes' | null>(null),
    [histoire, setHistoire] = useState(false),
    [envoiFs, setEnvoiFs] = useState(false),
    [erreur, setErreur] = useState<unknown>(null)
  const data = etat.kind === 'ready' ? etat.data : null
  const courant = semaineActuelle(),
    prepSem = s.sem ?? semaineApres(courant, 1)
  const changer = (patch: Partial<Recherche>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
  const peutRecevoir = moi.kind === 'ready' && can(moi.data, 'bus.recevoir'),
    peutAjuster = moi.kind === 'ready' && can(moi.data, 'bus.ajuster'),
    peutCompleter = moi.kind === 'ready' && can(moi.data, 'reception.inconnue.rattacher')
  const ls = (data?.lignes ?? []).filter(
    (l) =>
      correspond(String(l.dossier), s.dossier) &&
      correspond(l.centreCode, s.centre) &&
      correspond(l.parc, s.parc) &&
      correspond(l.formatCode, s.format) &&
      correspond(l.annonceur, s.annonceur) &&
      correspond(l.dspCode, s.dsp) &&
      (s.tab === 'preparation'
        ? l.semaine === prepSem
        : selection(s.semaine).length
          ? correspond(l.semaine, s.semaine)
          : s.tab === 'reception'
            ? l.semaine >= courant && l.semaine <= semaineApres(courant, 2)
            : l.finPose >= courant && l.semaine <= semaineApres(courant, 6)) &&
      (s.rep === 'oui' ? l.resteEnPlace : s.rep === 'non' ? !l.resteEnPlace : true),
  )
  const ids = new Set(ls.map((l) => l.ligneAttendueId))
  const visuels = (data?.visuels ?? []).filter((v) => ids.has(v.ligneAttendueId))
  const rowsReception = visuels.filter((v) =>
    correspond(v.statut, s.statut ?? 'ATTENDUE,PARTIELLE'),
  )
  async function ajuster(l: BusLigne, q: number | null) {
    setErreur(null)
    try {
      await apiPost(`/api/bus/lignes/${l.id}/ajuster`, {
        schema: z.object({ message: z.string() }),
        body: { version: l.version, quantite: q },
      })
      recharger()
    } catch (e) {
      setErreur(e)
    }
  }
  const filtre = (key: keyof Recherche, label: string, valeurs: { v: string; l: string }[]) => (
    <label className="text-sm">
      {label}
      <select
        className={`${champ} ml-2`}
        value={s[key] ?? ''}
        onChange={(e) => {
          changer({ [key]: e.target.value || undefined })
        }}
      >
        <option value="">Tous</option>
        {valeurs.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
        {s[key] === '*' && <option value="*">Tous</option>}
      </select>
    </label>
  )
  const uniques = (key: 'centreCode' | 'dspCode' | 'annonceur') =>
    [...new Set(data?.lignes.map((l) => l[key]) ?? [])].map((v) => ({
      v,
      l:
        key === 'centreCode'
          ? (data?.lignes.find((l) => l.centreCode === v)?.centre ?? v)
          : key === 'dspCode'
            ? (data?.lignes.find((l) => l.dspCode === v)?.dsp ?? v)
            : v,
    }))
  const versReception = (vs: BusVisuel[]) => {
    changer({
      tab: 'reception',
      dossier: [...new Set(vs.map((v) => v.dossier))].join(',') || '*',
      statut: '*',
      semaine: '*',
      centre: '*',
      format: '*',
      annonceur: '*',
      dsp: '*',
    })
  }
  const preparation = (sem: string, centre?: string) => {
    changer({ tab: 'preparation', sem, centre: centre ?? s.centre })
  }
  const colonnesVisuel: ColonneMetier<BusVisuel>[] = [
    { id: 'dossier', titre: 'Dossier', valeur: (v) => v.dossier },
    {
      id: 'visuel',
      titre: 'Visuel',
      valeur: (v) => `${v.annonceur} · ${v.theme}`,
      rendu: (v) => (
        <>
          <strong>{v.annonceur}</strong>
          <span className="block text-xs text-slate-500">{v.theme}</span>
        </>
      ),
    },
    {
      id: 'pose',
      titre: 'Pose',
      valeur: (v) => (v.semaine === v.finPose ? v.semaine : `${v.semaine} à ${v.finPose}`),
    },
    { id: 'recu', titre: 'Reçu / attendu', valeur: (v) => `${v.recu} / ${v.attendu}` },
    { id: 'reste', titre: 'Reste', valeur: (v) => v.reste },
    { id: 'statut', titre: 'Statut', valeur: (v) => STATUTS[v.statut] },
    { id: 'echeance', titre: 'Échéance de livraison', valeur: (v) => date(v.echeance) },
    { id: 'anomalies', titre: 'Anomalies', valeur: (v) => v.anomalies.join(', ') },
    { id: 'formats', titre: 'Formats', valeur: (v) => v.formats.join(', '), cachee: true },
    { id: 'centres', titre: 'Centres bus', valeur: (v) => v.centres.join(', '), cachee: true },
    { id: 'dsp', titre: 'DSP', valeur: (v) => v.dsps.join(', '), cachee: true },
    { id: 'attendu', titre: 'Attendu', valeur: (v) => v.attendu, cachee: true },
    { id: 'quantiteRecue', titre: 'Reçu', valeur: (v) => v.recu, cachee: true },
    {
      id: 'photo',
      titre: 'Photo',
      valeur: (v) =>
        data?.receptions.some((r) => r.ligneAttendueId === v.ligneAttendueId) ? 'Oui' : '—',
      cachee: true,
    },
    {
      id: 'nc',
      titre: 'NC',
      valeur: (v) =>
        data?.receptions.some((r) => r.ligneAttendueId === v.ligneAttendueId && r.nc) ? 'Oui' : '—',
      cachee: true,
    },
  ]
  const kpi = (titre: string, valeur: string | number, sous?: string, clic?: () => void) => (
    <button
      type="button"
      key={titre}
      className="rounded-lg border bg-white p-4 text-left"
      onClick={clic}
    >
      <span className="block text-xs text-slate-500">{titre}</span>
      <strong className="mt-1 block text-2xl">{valeur}</strong>
      {sous && <span className="mt-1 block text-xs text-slate-500">{sous}</span>}
    </button>
  )
  const titres = (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm text-slate-500">Bus</p>
        <h1 className="text-2xl font-semibold">{TITRES[s.tab]}</h1>
      </div>
      <div className="flex flex-wrap gap-3">
        {s.tab === 'reception' && peutRecevoir && (
          <Button
            type="button"
            onClick={() => {
              setInconnue(true)
            }}
          >
            Réception sans n° de dossier
          </Button>
        )}
        {s.tab === 'preparation' && (
          <>
            {(['preparation', 'synthese', 'etiquettes'] as const).map((d) => (
              <button
                type="button"
                key={d}
                className={`${champ} border-sky-300`}
                onClick={() => {
                  setDocument(d)
                }}
              >
                {d === 'preparation'
                  ? 'Fiche de préparation'
                  : d === 'synthese'
                    ? 'Fiche de synthèse'
                    : 'Étiquettes de dispatch'}
              </button>
            ))}
            <button
              type="button"
              className={champ}
              onClick={() => {
                setHistoire(true)
              }}
            >
              Historique
            </button>
            <button
              type="button"
              className={champ}
              onClick={() => {
                setEnvoiFs(true)
              }}
            >
              Envoi à Field Service
            </button>
          </>
        )}
      </div>
    </div>
  )
  return (
    <main className="mx-auto max-w-[1800px] p-6">
      {titres}
      {etat.kind === 'loading' && <p>Chargement de la production Bus…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {erreur !== null && <ErrorMessage error={erreur} />}
      {data && (
        <>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              N° de dossier
              <input
                className={`${champ} ml-2 w-36`}
                value={s.dossier === '*' ? '' : (s.dossier ?? '')}
                onChange={(e) => {
                  changer({ dossier: e.target.value || undefined })
                }}
              />
            </label>
            {s.tab === 'preparation' ? (
              <label className="text-sm">
                Semaine de pose
                <input
                  type="week"
                  className={`${champ} ml-2`}
                  value={prepSem}
                  onChange={(e) => {
                    if (e.target.value) changer({ sem: e.target.value })
                  }}
                />
              </label>
            ) : (
              filtre(
                'semaine',
                'Pose',
                [...new Set(data.lignes.map((l) => l.semaine))].map((v) => ({ v, l: v })),
              )
            )}
            {filtre('centre', 'Centre bus', uniques('centreCode'))}
            {filtre(
              'format',
              'Format',
              BUS_FORMATS.map((f) => ({ v: f.code, l: f.nom })),
            )}
            {s.tab === 'preparation' &&
              filtre(
                'parc',
                'Parc',
                [...new Set(ls.map((l) => l.parc))].map((v) => ({ v, l: `Parc ${v}` })),
              )}
            {filtre('annonceur', 'Annonceur', uniques('annonceur'))}
            {filtre('dsp', 'DSP', uniques('dspCode'))}
            {s.tab === 'reception' &&
              filtre(
                'statut',
                'Statut',
                Object.entries(STATUTS).map(([v, l]) => ({ v, l })),
              )}
            {s.tab === 'atraiter' &&
              filtre('rep', 'Reste en place', [
                { v: 'oui', l: 'Signalé dans les IP' },
                { v: 'non', l: 'Non' },
              ])}
            <button
              type="button"
              className="text-sm underline"
              onClick={() =>
                void navigate({
                  search: {
                    tab: s.tab,
                    semaine: s.tab === 'reception' ? '*' : undefined,
                    statut: '*',
                  },
                })
              }
            >
              Réinitialiser
            </button>
          </div>
          {s.tab === 'reception' && (
            <>
              <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {Object.entries(STATUTS).map(([k, label]) =>
                  kpi(label + 's', visuels.filter((v) => v.statut === k).length, undefined, () => {
                    changer({ statut: k })
                  }),
                )}
                {kpi('BL sans n° de dossier', data.sansDossier.length)}
              </div>
              <TableMetier
                nom="bus-receptions-attendues"
                lignes={rowsReception}
                cle={(v) => v.ligneAttendueId}
                colonnes={colonnesVisuel}
                onOuvrir={(v) => {
                  setDetail(v.dossierId)
                }}
                actions={(v) =>
                  peutRecevoir ? (
                    <Button
                      type="button"
                      onClick={() => {
                        setReception(v)
                      }}
                    >
                      Réceptionner
                    </Button>
                  ) : null
                }
              />
              {data.sansDossier.length > 0 && (
                <section className="mt-6">
                  <h2 className="mb-3 text-lg font-semibold">
                    BL sans n° de dossier · à compléter par la Préproduction
                  </h2>
                  <TableMetier
                    nom="bus-sans-dossier"
                    lignes={data.sansDossier}
                    cle={(r) => r.afficheId}
                    colonnes={[
                      { id: 'date', titre: 'Reçue le', valeur: (r) => date(r.date) },
                      { id: 'bl', titre: 'BL', valeur: (r) => r.bl },
                      { id: 'client', titre: 'Client lu sur le BL', valeur: (r) => r.annonceur },
                      { id: 'qte', titre: 'Quantité', valeur: (r) => r.quantite },
                    ]}
                    actions={(r) =>
                      peutCompleter ? (
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            setCompleter(r)
                          }}
                        >
                          Compléter
                        </button>
                      ) : null
                    }
                  />
                </section>
              )}
            </>
          )}
          {s.tab === 'suivi' && (
            <>
              <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {kpi(
                  'Prêt à préparer',
                  somme(ls, 'aEncoller')
                    ? `${Math.floor(
                        (100 *
                          somme(
                            ls.filter(
                              (l) =>
                                visuels.find((v) => v.ligneAttendueId === l.ligneAttendueId)?.pret,
                            ),
                            'aEncoller',
                          )) /
                          somme(ls, 'aEncoller'),
                      )} %`
                    : '—',
                  'Affiches reçues / plaques à encoller',
                  () => {
                    preparation(prepSem)
                  },
                )}
                {kpi(
                  'En retard',
                  visuels.filter((v) => !v.pret && new Date(v.echeance).getTime() < maintenant)
                    .length,
                  undefined,
                  () => {
                    versReception(
                      visuels.filter((v) => !v.pret && new Date(v.echeance).getTime() < maintenant),
                    )
                  },
                )}
                {kpi(
                  'À recevoir',
                  visuels.filter((v) => !v.pret && new Date(v.echeance).getTime() >= maintenant)
                    .length,
                  'Prochaines échéances',
                  () => {
                    versReception(visuels.filter((v) => !v.pret))
                  },
                )}
                {kpi(
                  'Plaques à encoller',
                  nombre(somme(ls, 'aEncoller')),
                  `${racks(ls)} racks`,
                  () => {
                    changer({ tab: 'atraiter' })
                  },
                )}
                {kpi('BL sans n° de dossier', data.sansDossier.length, undefined, () => {
                  changer({ tab: 'reception' })
                })}
              </div>
              <div className="mb-6 grid gap-5 lg:grid-cols-2">
                <Charge
                  titre="Charge par semaine de pose"
                  lignes={ls}
                  visuels={visuels}
                  par="semaine"
                  onClic={(sem) => {
                    preparation(sem)
                  }}
                />
                <Charge
                  titre="À encoller par centre bus"
                  lignes={ls}
                  visuels={visuels}
                  par="centre"
                  onClic={(centre) => {
                    preparation(prepSem, centre)
                  }}
                />
              </div>
              <h2 className="mb-3 text-lg font-semibold">Visuels en attente d’affiches</h2>
              <TableMetier
                nom="bus-suivi-visuels-en-attente"
                lignes={visuels
                  .filter((v) => !v.pret)
                  .sort((a, b) => a.echeance.localeCompare(b.echeance))}
                cle={(v) => v.ligneAttendueId}
                colonnes={[
                  ...colonnesVisuel.filter((c) => !['recu', 'reste', 'statut'].includes(c.id)),
                  {
                    id: 'couverture',
                    titre: 'Reçu / à encoller',
                    valeur: (v) => `${v.recu} / ${v.aEncoller}`,
                  },
                  {
                    id: 'manque',
                    titre: 'Manque',
                    valeur: (v) => Math.max(0, v.aEncoller - v.recu),
                  },
                ]}
                onOuvrir={(v) => {
                  setDetail(v.dossierId)
                }}
                actions={(v) => (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      versReception([v])
                    }}
                  >
                    Ouvrir la réception
                  </button>
                )}
                vide="Tous les visuels retenus par les filtres ont leurs affiches."
              />
            </>
          )}
          {s.tab === 'atraiter' && (
            <>
              <div className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
                {Array.from({ length: 7 }, (_, i) => {
                  const sem = semaineApres(courant, i),
                    lignes = ls.filter((l) => l.semaine === sem)
                  return kpi(
                    sem,
                    `${nombre(somme(lignes, 'aEncoller'))} plaques`,
                    `${new Set(lignes.map((l) => l.dossierId)).size} dossiers · ${racks(lignes)} racks`,
                    () => {
                      changer({ semaine: sem })
                    },
                  )
                })}
              </div>
              <Dossiers lignes={ls} visuels={visuels} onOuvrir={setDetail} />
            </>
          )}
          {s.tab === 'preparation' && (
            <>
              <p className="mb-4 text-sm text-slate-600">
                {peutAjuster
                  ? 'Quantité vendue et quantité Broadcast conservées. Chaque ajustement est historisé.'
                  : 'Lecture seule : ajustement réservé à la production.'}
              </p>
              <TableMetier
                nom={`bus-preparation-${prepSem}`}
                lignes={ls}
                cle={(l) => l.id}
                colonnes={[
                  { id: 'centre', titre: 'Centre bus', valeur: (l) => l.centre },
                  { id: 'parc', titre: 'Parc', valeur: (l) => l.parc },
                  {
                    id: 'format',
                    titre: 'Format',
                    valeur: (l) => `${l.format}${l.verni ? ' (verni)' : ''}`,
                  },
                  { id: 'dossier', titre: 'Contrat', valeur: (l) => l.dossier },
                  { id: 'client', titre: 'Annonceur', valeur: (l) => l.annonceur },
                  { id: 'theme', titre: 'Thème', valeur: (l) => l.theme },
                  { id: 'vendu', titre: 'Vendu', valeur: (l) => l.vendu, somme: true },
                  {
                    id: 'bc',
                    titre: 'Calcul Broadcast (+8 %)',
                    valeur: (l) => l.quantiteBroadcast,
                    somme: true,
                  },
                  {
                    id: 'encoller',
                    titre: 'À encoller',
                    valeur: (l) => l.aEncoller,
                    somme: true,
                    rendu: (l) => (
                      <input
                        key={`${l.id}-${l.version}`}
                        type="number"
                        min={0}
                        defaultValue={l.aEncoller}
                        disabled={!peutAjuster || l.verrouillee}
                        aria-label={`Quantité à encoller ${l.id}`}
                        title={l.verrouillee ? 'Production déjà lancée' : 'Ajustement manuel'}
                        className="w-24 rounded border px-2 py-1.5"
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                        onBlur={(e) => {
                          const n = Number(e.target.value)
                          if (Number.isInteger(n) && n >= 0 && n !== l.aEncoller) void ajuster(l, n)
                        }}
                      />
                    ),
                  },
                  {
                    id: 'ecart',
                    titre: 'Écart',
                    valeur: (l) => l.aEncoller - l.quantiteBroadcast,
                    somme: true,
                  },
                  {
                    id: 'auteur',
                    titre: 'Ajusté par',
                    valeur: (l) =>
                      l.ajustePar ? `${l.ajustePar}, ${l.ajusteLe ? date(l.ajusteLe) : ''}` : '',
                  },
                  { id: 'terrain', titre: 'Parc terrain', valeur: (l) => l.terrain },
                ]}
                actions={(l) =>
                  peutAjuster && l.quantiteAjustee !== null ? (
                    <button
                      type="button"
                      className="underline"
                      disabled={l.verrouillee}
                      onClick={() => void ajuster(l, null)}
                    >
                      Rétablir
                    </button>
                  ) : null
                }
              />
            </>
          )}
          {s.tab === 'vue' && <VueReceptions data={data} onOuvrir={setDetail} />}
          {!data.lignes.length && (
            <p className="mt-5 rounded border bg-white p-6 text-slate-600">
              Aucun dossier Bus dans le périmètre sélectionné.
            </p>
          )}
        </>
      )}
      {data && reception && (
        <ReceptionBus
          key={reception.ligneAttendueId}
          visuel={reception}
          onFermer={() => {
            setReception(null)
          }}
          onEnregistree={() => {
            setReception(null)
            recharger()
          }}
        />
      )}
      {data && detail !== null && (
        <DetailBus
          data={data}
          dossierId={detail}
          onFermer={() => {
            setDetail(null)
          }}
        />
      )}
      {inconnue && (
        <ModaleReceptionInconnue
          siteParDefaut={moi.kind === 'ready' ? moi.data.siteId : null}
          onFermer={() => {
            setInconnue(false)
          }}
          onCreee={() => {
            setInconnue(false)
            recharger()
          }}
        />
      )}
      {data && completer && (
        <CompleterBus
          inconnue={completer}
          visuels={data.visuels}
          onFermer={() => {
            setCompleter(null)
          }}
          onRattachee={() => {
            setCompleter(null)
            recharger()
          }}
        />
      )}
      {document && (
        <DocumentsBus
          type={document}
          semaine={prepSem}
          lignes={ls}
          onFermer={() => {
            setDocument(null)
          }}
        />
      )}
      {histoire && (
        <HistoriqueBus
          lignes={ls}
          onFermer={() => {
            setHistoire(false)
          }}
        />
      )}
      {envoiFs && (
        <Modale titre={`Envoi à Field Service · ${prepSem}`} ouverte onOuverture={setEnvoiFs}>
          <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
            Flux à arbitrer : la note du 08/10 prévoit que Broadcast alimente Field Service. Aucun
            échange direct Circé ↔ Field Service n’est configuré.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <dt>Semaine de pose</dt>
            <dd>{prepSem}</dd>
            <dt>Centres bus</dt>
            <dd>{[...new Set(ls.map((l) => l.centre))].join(', ')}</dd>
            <dt>Lignes</dt>
            <dd>{ls.length}</dd>
            <dt>Plaques à encoller</dt>
            <dd>{somme(ls, 'aEncoller')}</dd>
            <dt>Lignes ajustées</dt>
            <dd>{ls.filter((l) => l.quantiteAjustee !== null).length}</dd>
          </dl>
        </Modale>
      )}
    </main>
  )
}
function Charge({
  titre,
  lignes,
  visuels,
  par,
  onClic,
}: {
  titre: string
  lignes: BusLigne[]
  visuels: BusVisuel[]
  par: 'semaine' | 'centre'
  onClic: (v: string) => void
}) {
  const keys = [...new Set(lignes.map((l) => (par === 'semaine' ? l.semaine : l.centreCode)))]
  const rows = keys.map((k) => {
    const ls = lignes.filter((l) => (par === 'semaine' ? l.semaine : l.centreCode) === k)
    const total = somme(ls, 'aEncoller'),
      pret = somme(
        ls.filter((l) => visuels.find((v) => v.ligneAttendueId === l.ligneAttendueId)?.pret),
        'aEncoller',
      )
    return { k, titre: par === 'semaine' ? k : (ls[0]?.centre ?? k), total, pret, racks: racks(ls) }
  })
  const max = Math.max(1, ...rows.map((r) => r.total))
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-semibold">{titre}</h2>
      <div className="mb-3 flex gap-4 text-xs">
        <span>🟨 En attente d’affiches</span>
        <span>🟧 Prêt à préparer</span>
      </div>
      {rows.map((r) => (
        <button
          key={r.k}
          type="button"
          className="mb-4 block w-full text-left"
          onClick={() => {
            onClic(r.k)
          }}
        >
          <span className="mb-1 flex justify-between text-sm">
            <strong>{r.titre}</strong>
            <span>
              {r.total} plaques · {r.racks} racks
            </span>
          </span>
          <span
            className="flex h-5 overflow-hidden rounded bg-slate-100"
            role="img"
            aria-label={`${r.total - r.pret} en attente, ${r.pret} prêt à préparer`}
          >
            <span
              className="bg-amber-300"
              style={{ width: `${(100 * (r.total - r.pret)) / max}%` }}
            />
            <span
              className="bg-orange-400"
              style={{
                width: `${(100 * r.pret) / max}%`,
                backgroundImage:
                  'repeating-linear-gradient(45deg,transparent,transparent 3px,#ffffff55 3px,#ffffff55 5px)',
              }}
            />
          </span>
        </button>
      ))}
      {!rows.length && <p className="text-sm text-slate-500">Aucune charge avec ces filtres.</p>}
    </section>
  )
}
function Dossiers({
  lignes,
  visuels,
  onOuvrir,
}: {
  lignes: BusLigne[]
  visuels: BusVisuel[]
  onOuvrir: (id: number) => void
}) {
  const rows = [...new Set(lignes.map((l) => l.dossierId))].map((id) => {
    const ls = lignes.filter((l) => l.dossierId === id),
      p = ls[0],
      vs = visuels.filter((v) => v.dossierId === id)
    if (!p) throw new Error('Dossier Bus sans ligne')
    return {
      id,
      dossier: p.dossier,
      client: p.annonceur,
      pose: [...new Set(ls.map((l) => l.semaine))].join(', '),
      dsp: [...new Set(ls.map((l) => l.dsp))].join(', '),
      centres: new Set(ls.map((l) => l.centreCode)).size,
      formats: [...new Set(ls.map((l) => l.format))].join(', '),
      themes: [...new Set(ls.map((l) => l.theme))].join(', '),
      vendu: somme(ls, 'vendu'),
      encoller: somme(ls, 'aEncoller'),
      entretien: [...new Set(ls.map((l) => l.entretienPourcent))].map((n) => `${n} %`).join(', '),
      attendu: vs.reduce((s, v) => s + v.attendu, 0),
      recu: vs.reduce((s, v) => s + v.recu, 0),
      etape:
        vs.length && vs.every((v) => v.pret)
          ? 'Prêt à préparer'
          : vs.some((v) => v.recu > 0)
            ? 'Reçu en partie'
            : 'Affiches attendues',
      reste: ls.some((l) => l.resteEnPlace)
        ? 'Reste en place signalé dans les IP · décision à confirmer'
        : '—',
      anomalies: [...new Set(vs.flatMap((v) => v.anomalies))].join(', '),
    }
  })
  return (
    <TableMetier
      nom="bus-a-traiter"
      lignes={rows}
      cle={(r) => r.id}
      onOuvrir={(r) => {
        onOuvrir(r.id)
      }}
      colonnes={[
        { id: 'dossier', titre: 'Dossier', valeur: (r) => r.dossier },
        { id: 'client', titre: 'Client', valeur: (r) => r.client },
        { id: 'pose', titre: 'Pose', valeur: (r) => r.pose },
        { id: 'dsp', titre: 'DSP', valeur: (r) => r.dsp },
        { id: 'centres', titre: 'Centres bus', valeur: (r) => r.centres },
        { id: 'formats', titre: 'Formats', valeur: (r) => r.formats },
        { id: 'themes', titre: 'Thèmes', valeur: (r) => r.themes },
        { id: 'vendu', titre: 'Vendu (plaques)', valeur: (r) => r.vendu },
        { id: 'encoller', titre: 'À encoller', valeur: (r) => r.encoller },
        { id: 'entretien', titre: 'Entretien', valeur: (r) => r.entretien },
        { id: 'attendu', titre: 'Affiches attendues', valeur: (r) => r.attendu },
        { id: 'recu', titre: 'Reçues', valeur: (r) => r.recu },
        { id: 'etape', titre: 'Étape', valeur: (r) => r.etape },
        { id: 'reste', titre: 'Reste en place', valeur: (r) => r.reste },
        { id: 'anomalies', titre: 'Anomalies', valeur: (r) => r.anomalies },
      ]}
    />
  )
}
function VueReceptions({ data, onOuvrir }: { data: BusResultat; onOuvrir: (id: number) => void }) {
  const current = semaineActuelle(),
    rows = Array.from({ length: 8 }, (_, i) => {
      const semaine = semaineApres(current, i - 1),
        vs = data.visuels.filter((v) => v.semaine === semaine),
        dossierIds = [...new Set(vs.map((v) => v.dossierId))]
      const ds = dossierIds.map((id) => {
        const lignes = vs.filter((v) => v.dossierId === id),
          p = lignes[0]
        if (!p) throw new Error('Dossier absent')
        const recu = lignes.every((v) => v.recu >= v.attendu),
          partiel = !recu && lignes.some((v) => v.recu > 0),
          manque = !recu && !partiel && new Date(p.echeance).getTime() < Date.now()
        return {
          id,
          titre: `${p.dossier} ${p.annonceur}`,
          statut: recu
            ? 'Reçu'
            : partiel
              ? 'Reçu en partie'
              : manque
                ? 'Non reçu, échéance passée'
                : 'Attendu',
        }
      })
      const ech = new Date(
        lundiSemaineIso(lireSemaineIso(semaine)).getTime() - 10 * 864e5 + 16.5 * 36e5,
      )
      return {
        semaine,
        echeance: ech.toISOString(),
        ds,
        total: ds.length,
        recu: ds.filter((d) => d.statut === 'Reçu').length,
        partiel: ds.filter((d) => d.statut === 'Reçu en partie').length,
        attendu: ds.filter((d) => d.statut === 'Attendu').length,
        manquant: ds.filter((d) => d.statut === 'Non reçu, échéance passée').length,
      }
    })
  return (
    <TableMetier
      nom="bus-vue-receptions"
      lignes={rows}
      cle={(r) => r.semaine}
      colonnes={[
        { id: 'pose', titre: 'Pose', valeur: (r) => r.semaine },
        {
          id: 'echeance',
          titre: 'Échéance de livraison',
          valeur: (r) =>
            `${date(r.echeance)}${new Date(r.echeance).getTime() < Date.now() ? ' (passée)' : ''}`,
        },
        { id: 'total', titre: 'Dossiers', valeur: (r) => r.total },
        { id: 'recu', titre: 'Reçus', valeur: (r) => r.recu },
        { id: 'partiel', titre: 'En partie', valeur: (r) => r.partiel },
        { id: 'attendu', titre: 'Attendus', valeur: (r) => r.attendu },
        { id: 'manquant', titre: 'Non reçus (échéance passée)', valeur: (r) => r.manquant },
        {
          id: 'dossiers',
          titre: 'Détail des dossiers',
          valeur: (r) => r.ds.map((d) => `${d.titre} : ${d.statut}`).join(', '),
          rendu: (r) => (
            <div className="flex flex-wrap gap-2">
              {r.ds.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="rounded border px-2 py-1 text-left text-xs"
                  onClick={() => {
                    onOuvrir(d.id)
                  }}
                >
                  {d.titre}
                  <span className="block text-slate-500">{d.statut}</span>
                </button>
              ))}
            </div>
          ),
        },
      ]}
    />
  )
}
function ReceptionBus({
  visuel: v,
  onFermer,
  onEnregistree,
}: {
  visuel: BusVisuel
  onFermer: () => void
  onEnregistree: () => void
}) {
  const [f, setF] = useState({
      bl: '',
      date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
      quantite: Math.max(1, v.reste),
      entretien: true,
      themeConforme: true,
      tenue: '',
      allongement: '',
      massicotage: '',
      nc: '',
      commentaire: '',
    }),
    [photo, setPhoto] = useState<File | null>(null),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false)
  async function enregistrer(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!photo) return
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost('/api/bus/receptions', {
        schema: z.object({ receptionId: z.number(), afficheId: z.number(), message: z.string() }),
        body: {
          ...f,
          date: new Date(f.date).toISOString(),
          ligneAttendueId: v.ligneAttendueId,
          photo: {
            intitule: photo.name,
            mimeType: photo.type,
            contenuBase64: await lireBase64(photo),
          },
        },
      })
      onEnregistree()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={`Réceptionner · dossier ${v.dossier} · ${v.annonceur} · ${v.theme}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      <form onSubmit={(e) => void enregistrer(e)}>
        <p className="mb-5 text-sm text-slate-600">
          Attendu : {v.attendu} affiches, entretien compris · déjà reçu : {v.recu} · pose{' '}
          {v.semaine} · échéance {date(v.echeance)}.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            N° de BL (facultatif)
            <input
              className={`${champ} mt-1 w-full`}
              value={f.bl}
              onChange={(e) => {
                setF((x) => ({ ...x, bl: e.target.value }))
              }}
            />
          </label>
          <label className="text-sm">
            Date de réception
            <input
              type="datetime-local"
              required
              className={`${champ} mt-1 w-full`}
              value={f.date}
              onChange={(e) => {
                setF((x) => ({ ...x, date: e.target.value }))
              }}
            />
          </label>
          <label className="text-sm">
            Quantité reçue (affiches)
            <input
              type="number"
              min={1}
              required
              className={`${champ} mt-1 w-full`}
              value={f.quantite}
              onChange={(e) => {
                setF((x) => ({ ...x, quantite: Number(e.target.value) }))
              }}
            />
          </label>
          {(['entretien', 'themeConforme'] as const).map((k) => (
            <label key={k} className="text-sm">
              {k === 'entretien'
                ? 'Entretien fourni ?'
                : 'Thème conforme à l’instruction de pose ?'}
              <select
                className={`${champ} mt-1 w-full`}
                value={String(f[k])}
                onChange={(e) => {
                  setF((x) => ({ ...x, [k]: e.target.value === 'true' }))
                }}
              >
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </select>
            </label>
          ))}
          <label className="text-sm">
            Photo de l’affiche reçue, avant collage sur la plaque *
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              required
              className="mt-1 block w-full text-sm"
              onChange={(e) => {
                setPhoto(e.target.files?.[0] ?? null)
              }}
            />
          </label>
        </div>
        <h3 className="mb-3 mt-5 font-medium">Test de collage (facultatif)</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['tenue', 'allongement', 'massicotage'] as const).map((k) => (
            <label key={k} className="text-sm capitalize">
              {k}
              <select
                className={`${champ} mt-1 w-full`}
                value={f[k]}
                onChange={(e) => {
                  setF((x) => ({ ...x, [k]: e.target.value }))
                }}
              >
                <option value="">—</option>
                <option>OK</option>
                <option>KO</option>
              </select>
            </label>
          ))}
        </div>
        <label className="mt-5 block text-sm">
          Non-conformité
          <select
            className={`${champ} mt-1 w-full`}
            value={f.nc}
            onChange={(e) => {
              setF((x) => ({ ...x, nc: e.target.value }))
            }}
          >
            <option value="">Aucune</option>
            <option value="ROULE">
              Conditionnement : affiches roulées (tolérance CGV sous 50 exemplaires)
            </option>
            <option value="FORMAT">Format non conforme</option>
          </select>
        </label>
        <label className="mt-4 block text-sm">
          Commentaire
          <textarea
            className={`${champ} mt-1 w-full`}
            rows={3}
            value={f.commentaire}
            onChange={(e) => {
              setF((x) => ({ ...x, commentaire: e.target.value }))
            }}
          />
        </label>
        {erreur !== null && <ErrorMessage error={erreur} />}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onFermer}>
            Annuler
          </button>
          <Button type="submit" disabled={envoi || !photo}>
            Enregistrer la réception
          </Button>
        </div>
      </form>
    </Modale>
  )
}
function DetailBus({
  data,
  dossierId,
  onFermer,
}: {
  data: BusResultat
  dossierId: number
  onFermer: () => void
}) {
  const lignes = data.lignes.filter((l) => l.dossierId === dossierId),
    p = lignes[0],
    ids = new Set(lignes.map((l) => l.ligneAttendueId))
  return (
    <Modale
      titre={`Dossier ${p?.dossier ?? ''} · ${p?.annonceur ?? ''}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      <p className="mb-4 text-sm">
        Pose {[...new Set(lignes.map((l) => l.semaine))].join(', ')} ·{' '}
        {[...new Set(lignes.map((l) => l.dsp))].join(', ')} ·{' '}
        {[...new Set(lignes.map((l) => l.format))].join(', ')}
      </p>
      <TableMetier
        nom="bus-receptions-dossier"
        lignes={data.receptions.filter((r) => ids.has(r.ligneAttendueId))}
        cle={(r) => r.id}
        colonnes={[
          { id: 'date', titre: 'Reçue le', valeur: (r) => new Date(r.date) },
          {
            id: 'theme',
            titre: 'Thème',
            valeur: (r) => data.visuels.find((v) => v.ligneAttendueId === r.ligneAttendueId)?.theme,
          },
          { id: 'bl', titre: 'BL', valeur: (r) => r.bl },
          { id: 'qte', titre: 'Quantité', valeur: (r) => r.quantite },
          { id: 'entretien', titre: 'Entretien', valeur: (r) => (r.entretien ? 'Oui' : 'Non') },
          {
            id: 'conforme',
            titre: 'Thème conforme',
            valeur: (r) => (r.themeConforme ? 'Oui' : 'Non'),
          },
          {
            id: 'photo',
            titre: 'Photo',
            valeur: (r) => `Photo ${r.photoId}`,
            rendu: (r) => (
              <a
                className="underline"
                href={`/api/photos/${r.photoId}`}
                target="_blank"
                rel="noreferrer"
              >
                Voir la photo avant collage
              </a>
            ),
          },
          {
            id: 'test',
            titre: 'Test de collage',
            valeur: (r) =>
              [
                r.tenue && `Tenue ${r.tenue}`,
                r.allongement && `Allongement ${r.allongement}`,
                r.massicotage && `Massicotage ${r.massicotage}`,
              ]
                .filter(Boolean)
                .join(', '),
          },
          {
            id: 'nc',
            titre: 'NC',
            valeur: (r) =>
              r.nc === 'ROULE'
                ? 'Conditionnement : roulées, non bloquant'
                : r.nc === 'FORMAT'
                  ? 'Format non conforme'
                  : '—',
          },
          { id: 'commentaire', titre: 'Commentaire', valeur: (r) => r.commentaire },
          { id: 'auteur', titre: 'Par', valeur: (r) => r.auteur },
        ]}
        vide="Aucune réception pour ce dossier."
      />
    </Modale>
  )
}
function CompleterBus({
  inconnue,
  visuels,
  onFermer,
  onRattachee,
}: {
  inconnue: BusResultat['sansDossier'][number]
  visuels: BusVisuel[]
  onFermer: () => void
  onRattachee: () => void
}) {
  const [choix, setChoix] = useState(''),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false)
  const candidats = visuels
    .filter((v) => v.plateformeId === inconnue.plateformeId)
    .sort(
      (a, b) =>
        Number(b.annonceur === inconnue.annonceur) - Number(a.annonceur === inconnue.annonceur),
    )
  async function rattacher() {
    setEnvoi(true)
    try {
      await apiPost(`/api/affiches/${inconnue.afficheId}/rattacher-inconnue`, {
        schema: z.looseObject({ message: z.string() }),
        body: {
          version: inconnue.version,
          lignes: [{ ligneAttendueId: Number(choix), quantite: inconnue.quantite }],
        },
      })
      onRattachee()
    } catch (e) {
      setErreur(e)
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={`Compléter le n° de dossier · ${inconnue.bl ?? 'Sans BL'}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      <p className="mb-4 text-sm">
        Client lu sur le BL : {inconnue.annonceur} · {inconnue.quantite} affiches. Les dossiers du
        même annonceur sont proposés en premier.
      </p>
      <label className="block text-sm">
        Dossier et thème
        <select
          className={`${champ} mt-2 w-full`}
          value={choix}
          onChange={(e) => {
            setChoix(e.target.value)
          }}
        >
          <option value="">Choisir le dossier et le thème</option>
          {candidats.map((v) => (
            <option key={v.ligneAttendueId} value={v.ligneAttendueId}>
              {v.dossier} · {v.annonceur} · {v.theme} · {v.formats.join(', ')} · {v.semaine}
            </option>
          ))}
        </select>
      </label>
      {erreur !== null && <ErrorMessage error={erreur} />}
      <div className="mt-5 flex justify-end">
        <Button type="button" disabled={!choix || envoi} onClick={() => void rattacher()}>
          Rattacher
        </Button>
      </div>
    </Modale>
  )
}
function DocumentsBus({
  type,
  semaine,
  lignes,
  onFermer,
}: {
  type: 'preparation' | 'synthese' | 'etiquettes'
  semaine: string
  lignes: BusLigne[]
  onFermer: () => void
}) {
  const [entretien, setEntretien] = useState(true)
  const titre = `${type === 'preparation' ? 'Fiche de préparation' : type === 'synthese' ? 'Fiche de synthèse' : 'Étiquettes de dispatch'} · ${semaine}`
  const centres = [...new Set(lignes.map((l) => l.centreCode))],
    dossiers = [...new Set(lignes.map((l) => l.dossierId))]
  const grille = 'border border-slate-400 px-2 py-1 text-left'
  return (
    <Modale
      titre={titre}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      {type === 'preparation' && (
        <label className="mb-4 block text-sm print:hidden">
          <input
            type="checkbox"
            checked={entretien}
            onChange={(e) => {
              setEntretien(e.target.checked)
            }}
          />{' '}
          Avec entretien
        </label>
      )}
      <Edition
        titre={titre}
        contexte={[
          `${lignes.length} lignes`,
          `${centres.length} centres bus`,
          `${racks(lignes)} racks`,
        ]}
      >
        {type === 'preparation' ? (
          centres.map((code, i) => {
            const ls = lignes.filter((l) => l.centreCode === code),
              p = ls[0]
            return (
              <section key={code} style={{ breakAfter: i < centres.length - 1 ? 'page' : 'auto' }}>
                <h3 className="mb-3 text-lg font-bold">
                  {p?.centre} · {p?.dsp} · {semaine}
                </h3>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {[
                        'Contrat',
                        'Annonceur',
                        'Thème',
                        'Format',
                        'Parc',
                        'À encoller',
                        ...(entretien ? ['Entretien (affiches)'] : []),
                      ].map((t) => (
                        <th key={t} className={grille}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ls.map((l) => (
                      <tr key={l.id}>
                        <td className={grille}>{l.dossier}</td>
                        <td className={grille}>{l.annonceur}</td>
                        <td className={grille}>{l.theme}</td>
                        <td className={grille}>
                          {l.format}
                          {l.verni ? ' (verni)' : ''}
                        </td>
                        <td className={grille}>{l.parc}</td>
                        <td className={grille}>{l.aEncoller}</td>
                        {entretien && <td className={grille}>{l.attendu - l.vendu}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="my-4 font-bold">
                  Total à encoller : {somme(ls, 'aEncoller')} plaques · {racks(ls)} racks
                </p>
              </section>
            )
          })
        ) : type === 'synthese' ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {[
                  'Client',
                  'Contrat',
                  'Centres bus',
                  'Vendu',
                  'Quantité Broadcast',
                  'Quantité ajustée',
                  'Écart',
                ].map((t) => (
                  <th key={t} className={grille}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dossiers.map((id) => {
                const ls = lignes.filter((l) => l.dossierId === id),
                  p = ls[0]
                return (
                  <tr key={id}>
                    <td className={grille}>{p?.annonceur}</td>
                    <td className={grille}>{p?.dossier}</td>
                    <td className={grille}>{[...new Set(ls.map((l) => l.centre))].join(', ')}</td>
                    <td className={grille}>{somme(ls, 'vendu')}</td>
                    <td className={grille}>{somme(ls, 'quantiteBroadcast')}</td>
                    <td className={grille}>{somme(ls, 'aEncoller')}</td>
                    <td className={grille}>
                      {somme(ls, 'aEncoller') - somme(ls, 'quantiteBroadcast')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[...new Set(lignes.map((l) => `${l.centreCode}|${l.formatCode}`))].map((cle) => {
              const ls = lignes.filter((l) => `${l.centreCode}|${l.formatCode}` === cle),
                p = ls[0]
              return (
                <div key={cle} className="break-inside-avoid border-2 border-black p-4">
                  <h3 className="text-xl font-bold">{p?.centre}</h3>
                  <p>
                    Format : {p?.format}
                    {p?.verni ? ' (verni)' : ''}
                  </p>
                  <p>
                    Pose {semaine} · parcs {[...new Set(ls.map((l) => l.parc))].join(', ')}
                  </p>
                  <strong>{somme(ls, 'aEncoller')} plaques</strong>
                  <p>Contrats : {[...new Set(ls.map((l) => l.dossier))].join(', ')}</p>
                </div>
              )
            })}
          </div>
        )}
      </Edition>
      {!lignes.length && <p className="my-5">Aucune ligne avec les filtres sélectionnés.</p>}
      <div className="mt-5 flex justify-end gap-3 print:hidden">
        <button type="button" onClick={onFermer}>
          Fermer
        </button>
        <Button
          type="button"
          disabled={!lignes.length}
          onClick={() => {
            window.print()
          }}
        >
          Imprimer
        </Button>
      </div>
    </Modale>
  )
}
function HistoriqueBus({ lignes, onFermer }: { lignes: BusLigne[]; onFermer: () => void }) {
  const { etat, recharger } = useApi('bus-historique', (signal) =>
    apiRequest('GET', '/api/bus/historique', { schema: BusHistoriqueSchema, signal }),
  )
  return (
    <Modale
      titre="Historique des ajustements"
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <TableMetier
          nom="bus-historique-ajustements"
          lignes={etat.data.items.filter((h) => lignes.some((l) => l.id === h.ligneId))}
          cle={(h) => h.id}
          colonnes={[
            { id: 'date', titre: 'Le', valeur: (h) => new Date(h.date) },
            { id: 'auteur', titre: 'Par', valeur: (h) => h.auteur },
            {
              id: 'ligne',
              titre: 'Ligne',
              valeur: (h) => {
                const l = lignes.find((l) => l.id === h.ligneId)
                return l ? `${l.dossier} · ${l.centre} · parc ${l.parc} · ${l.format}` : h.ligneId
              },
            },
            { id: 'avant', titre: 'Ancienne valeur', valeur: (h) => h.avant },
            { id: 'apres', titre: 'Nouvelle valeur', valeur: (h) => h.apres },
            { id: 'motif', titre: 'Motif', valeur: (h) => h.motif },
          ]}
        />
      )}
    </Modale>
  )
}
