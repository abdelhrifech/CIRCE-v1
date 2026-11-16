import { DeclarerConstat } from '../nonconformite/constat.tsx'
import type { NON_CONFORMITES } from '@circe/shared'
import {
  ControleSchema,
  ControleValideSchema,
  ReferentielsReceptionSchema,
  SasSchema,
  type Controle,
} from '@circe/shared'
import { useState } from 'react'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { dateCourte } from '../../lib/duree.ts'
import { ecartImportant } from '../../lib/ecart.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
import { Pastille } from '../ui/pastille.tsx'
import { ApercuFeuilles } from './apercu-feuilles.tsx'

interface SasProps {
  /** Réception ouverte en contrôle (paramètre d'URL `palette`). */
  ouverte: number | null
  onOuvrir: (id: number | null) => void
  /** Incrémenté par la page quand une réception vient d'être validée (la palette entre dans le sas). */
  rafraichir: number
  peutControler: boolean
}

/** ECR-REC-02 — étape 2 : sas (RG-REC-053 à 055) et contrôle de la palette (RG-REC-056 à 072). */
export function SasEtControle({ ouverte, onOuvrir, rafraichir, peutControler }: SasProps) {
  // RG-REC-053 : recherche par n° de BL ou imprimeur (faite par l'API).
  const [recherche, setRecherche] = useState('')
  const q = recherche.trim()
  const { etat, recharger } = useApi(`sas-${String(rafraichir)}-${q}`, (signal) =>
    apiRequest('GET', `/api/receptions/sas${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      schema: SasSchema,
      signal,
    }),
  )
  const sas = etat.kind === 'ready' ? etat.data : null
  return (
    <section className="mt-8 border-t border-slate-200 pt-4" aria-label="Contrôle des affiches">
      <div className="mt-2 rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
          <h3 className="font-medium">Palettes à contrôler (sas)</h3>
          <input
            type="search"
            aria-label="Rechercher une palette par n° de BL ou imprimeur"
            placeholder="N° de BL ou imprimeur"
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
            }}
          />
        </div>
        {etat.kind === 'loading' && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {etat.kind === 'error' && (
          <div className="p-3">
            <ErrorMessage error={etat.error} onRetry={recharger} />
          </div>
        )}
        {sas && sas.palettes.length === 0 && (
          <p className="p-3 text-sm text-slate-600">
            Aucune palette à contrôler : le sas est vide.
          </p>
        )}
        {sas && sas.palettes.length > 0 && (
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-sm" aria-label="Palettes à contrôler">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {[
                    'Réception',
                    'Arrivée',
                    'Site',
                    'BL',
                    'Imprimeur',
                    'Affiches',
                    'Qté du BL',
                    'Déchargé par',
                    '',
                  ].map((c) => (
                    <th key={c} scope="col" className="px-3 py-2 text-left font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sas.palettes.map((p) => (
                  <tr
                    key={p.receptionId}
                    // ECR-REC-02 : clic de ligne = ouvre le contrôle (le bouton reste l'accès clavier).
                    onClick={() => {
                      onOuvrir(p.receptionId)
                    }}
                    className={`cursor-pointer border-t border-slate-100 ${ouverte === p.receptionId ? 'bg-sky-50' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono">
                      R{p.receptionId}{' '}
                      {p.estInconnue && <Pastille ton="surveiller">réception inconnue</Pastille>}
                    </td>
                    <td className="px-3 py-2">{dateCourte(p.arrivee)}</td>
                    <td className="px-3 py-2">{p.site.nom}</td>
                    <td className="px-3 py-2">{p.bl ?? '—'}</td>
                    <td className="px-3 py-2">{p.imprimeur ?? '—'}</td>
                    <td className="px-3 py-2">{p.nombreAffiches}</td>
                    <td className="px-3 py-2">{p.quantiteBl}</td>
                    <td className="px-3 py-2">{p.dechargePar ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {ouverte === p.receptionId ? (
                        <span className="text-slate-500">ouverte ci-dessous</span>
                      ) : (
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            onOuvrir(p.receptionId)
                          }}
                        >
                          Contrôler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {ouverte !== null && (
        <ControlePalette
          key={ouverte}
          receptionId={ouverte}
          peutControler={peutControler}
          onFermer={() => {
            onOuvrir(null)
          }}
          onValide={() => {
            recharger()
            onOuvrir(null)
          }}
        />
      )}
    </section>
  )
}

interface Saisie {
  qteComptee: number
  allee: string
  rayon: string
  rebut: number
  nonConformite: (typeof NON_CONFORMITES)[number]
  /** RG-REC-066 : case « +N en entretien » cochée. */
  surplus: boolean
}

function ControlePalette({
  receptionId,
  peutControler,
  onFermer,
  onValide,
}: {
  receptionId: number
  peutControler: boolean
  onFermer: () => void
  onValide: () => void
}) {
  const { etat, recharger } = useApi(`controle-${String(receptionId)}`, (signal) =>
    apiRequest('GET', `/api/receptions/${String(receptionId)}/controle`, {
      schema: ControleSchema,
      signal,
    }),
  )
  return (
    <section
      className="mt-4 rounded-lg border border-sky-200 border-l-[6px] border-l-sky-600 bg-[#eaf4f8] p-4"
      aria-label={`Contrôle de la palette · réception R${String(receptionId)}`}
    >
      {etat.kind === 'loading' && <p className="text-sm text-slate-500">Chargement du contrôle…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <FormulaireControle
          c={etat.data}
          peutControler={peutControler}
          onFermer={onFermer}
          onValide={() => {
            recharger()
            onValide()
          }}
        />
      )}
    </section>
  )
}

function FormulaireControle({
  c,
  peutControler,
  onFermer,
  onValide,
}: {
  c: Controle
  peutControler: boolean
  onFermer: () => void
  onValide: () => void
}) {
  const { etat: refs } = useApi('referentiels-reception', (signal) =>
    apiRequest('GET', '/api/reception/referentiels', {
      schema: ReferentielsReceptionSchema,
      signal,
    }),
  )
  const [saisies, setSaisies] = useState<Record<number, Saisie>>(() =>
    Object.fromEntries(
      c.lignes.map((l) => [
        l.afficheId,
        {
          qteComptee: l.quantiteBl,
          // RG-REC-061 : vide tant que l'affiche est en zone tampon.
          allee: '',
          rayon: '',
          rebut: 0,
          nonConformite: 'CONFORME' as const,
          surplus: false,
        },
      ]),
    ),
  )
  const [controleurId, setControleurId] = useState('')
  const [imprimeurId, setImprimeurId] = useState('')
  const [envoi, setEnvoi] = useState<
    { kind: 'repos' | 'en-cours' } | { kind: 'erreur'; error: unknown }
  >({
    kind: 'repos',
  })
  const [apercu, setApercu] = useState<number[] | null>(null)
  const [voirBl, setVoirBl] = useState(false)
  const lecture = c.lectureSeule || !peutControler
  const agents =
    refs.kind === 'ready' ? refs.data.agents.filter((a) => a.plateformeIds.includes(c.site.id)) : []
  const majSaisie = (id: number, patch: Partial<Saisie>) => {
    setSaisies((s) => {
      const actuelle = s[id]
      return actuelle ? { ...s, [id]: { ...actuelle, ...patch } } : s
    })
  }

  async function valider(imprimer = false) {
    setEnvoi({ kind: 'en-cours' })
    try {
      const r = await apiPost(`/api/receptions/${String(c.receptionId)}/controle`, {
        schema: ControleValideSchema,
        body: {
          version: c.version,
          controleurId: controleurId ? Number(controleurId) : null,
          imprimeurId: imprimeurId ? Number(imprimeurId) : null,
          lignes: c.lignes.map((l) => {
            const s = saisies[l.afficheId]
            const comptee = s?.qteComptee ?? l.quantiteBl
            return {
              afficheId: l.afficheId,
              qteComptee: s?.qteComptee ?? l.quantiteBl,
              allee: s?.allee ?? '',
              rayon: s?.rayon ?? '',
              rebut: s?.rebut ?? 0,
              nonConformite: s?.nonConformite ?? 'CONFORME',
              surplusEntretien: s?.surplus && comptee > l.attendu ? comptee - l.attendu : null,
            }
          }),
        },
      })
      setEnvoi({ kind: 'repos' })
      // RG-REC-069 : après le contrôle, aperçu d'impression avec étiquettes rack (ECR-REC-09).
      if (imprimer) setApercu(r.affiches)
      else onValide()
    } catch (error) {
      setEnvoi({ kind: 'erreur', error })
    }
  }

  const champ = 'w-16 rounded border border-slate-300 px-1 py-0.5'
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">
          {c.estInconnue ? 'Contrôle et feuille définitive' : 'Contrôle de la palette'} · réception
          R{c.receptionId}
        </h3>
        {c.statut === 'CONTROLEE' ? (
          <Pastille ton="ok">
            Contrôlée{c.controleLe ? ` le ${dateCourte(c.controleLe)}` : ''}
            {c.controleur ? ` par ${c.controleur}` : ''}
          </Pastille>
        ) : (
          <Pastille ton="surveiller">À contrôler</Pastille>
        )}
      </div>
      <p className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
        <span>{c.site.nom}</span>·<span>BL {c.bl ?? '—'}</span>·
        <span>{c.imprimeur?.libelle ?? '—'}</span>·<span>{c.nbColis ?? '—'} colis</span>·
        <span>Déchargée par {c.dechargePar ?? '—'}</span>
        {c.photoBlId !== null && (
          <button
            type="button"
            className="underline"
            onClick={() => {
              setVoirBl(true)
            }}
          >
            Voir le BL
          </button>
        )}
      </p>
      {!lecture && (
        <div className="mt-3">
          <DeclarerConstat
            receptionId={c.receptionId}
            plateformeId={c.site.id}
            affiches={c.lignes.map((l) => ({
              id: l.afficheId,
              annonceur: l.annonceur,
              theme: l.theme,
              dossier: l.dossiers[0],
            }))}
          />
        </div>
      )}
      <table className="mt-2 w-full text-sm" aria-label="Lignes du contrôle">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {[
              'N° affiche',
              'Visuel',
              c.estInconnue ? 'Qté saisie' : 'Qté du BL',
              'Qté comptée',
              'Allée',
              'Rayon',
              'Rebut',
              'Non-conformité',
              'Surplus',
            ].map((h) => (
              <th key={h} scope="col" className="px-2 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.lignes.map((l) => {
            const s = saisies[l.afficheId]
            const ecart = (s?.qteComptee ?? l.quantiteBl) - l.quantiteBl
            // RG-REC-058 : écart > seuil (%) de la quantité du BL → Important.
            const important = ecartImportant(
              l.quantiteBl,
              s?.qteComptee ?? l.quantiteBl,
              c.ecartReceptionPourcent,
            )
            return (
              <tr
                key={l.afficheId}
                className={`border-t border-slate-100 ${important ? 'bg-orange-50' : ''}`}
              >
                <td className="px-2 py-2 font-mono">
                  {l.afficheId} {l.complement && <Pastille ton="surveiller">complément</Pastille>}
                </td>
                <td className="px-2 py-2">
                  {l.annonceur ?? '—'} · {l.theme ?? '—'}
                  <span className="block text-xs text-slate-500">
                    {l.dossiers.join(', ') || '—'} · {l.format}
                  </span>
                  {l.orpheline && <Pastille ton="surveiller">orpheline</Pastille>}
                </td>
                <td className="px-2 py-2">{l.quantiteBl}</td>
                <td className="px-2 py-2">
                  {lecture ? (
                    (l.qteComptee ?? '—')
                  ) : (
                    <>
                      <input
                        type="number"
                        min={0}
                        aria-label={`Qté comptée, affiche ${String(l.afficheId)}`}
                        className={champ}
                        value={s?.qteComptee ?? l.quantiteBl}
                        onChange={(e) => {
                          majSaisie(l.afficheId, { qteComptee: Math.trunc(Number(e.target.value)) })
                        }}
                      />
                      {ecart !== 0 && (
                        <Pastille ton={important ? 'important' : 'info'}>
                          {ecart > 0 ? '+' : ''}
                          {ecart} par rapport {c.estInconnue ? 'à la saisie' : 'au BL'}
                        </Pastille>
                      )}
                      {(s?.qteComptee ?? l.quantiteBl) < c.comptageMorceauSeuil && (
                        <span className="block text-xs text-slate-500">
                          Comptage par morceau (4 morceaux par affiche)
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="px-2 py-2">
                  {lecture ? (
                    (l.allee ?? '—')
                  ) : (
                    <>
                      {l.allee && (
                        <span className="block text-xs text-slate-500">
                          aujourd’hui {l.allee}-{l.rayon ?? '—'}
                        </span>
                      )}
                      <input
                        aria-label={`Allée, affiche ${String(l.afficheId)}`}
                        placeholder="A-F"
                        className={champ}
                        value={s?.allee ?? ''}
                        onChange={(e) => {
                          majSaisie(l.afficheId, { allee: e.target.value.toUpperCase() })
                        }}
                      />
                    </>
                  )}
                </td>
                <td className="px-2 py-2">
                  {lecture ? (
                    (l.rayon ?? '—')
                  ) : (
                    <input
                      aria-label={`Rayon, affiche ${String(l.afficheId)}`}
                      placeholder="1-12"
                      className={champ}
                      value={s?.rayon ?? ''}
                      onChange={(e) => {
                        majSaisie(l.afficheId, { rayon: e.target.value })
                      }}
                    />
                  )}
                </td>
                <td className="px-2 py-2">
                  {!lecture && (
                    <input
                      type="number"
                      min={0}
                      aria-label={`Rebut, affiche ${String(l.afficheId)}`}
                      className={champ}
                      value={s?.rebut ?? 0}
                      onChange={(e) => {
                        majSaisie(l.afficheId, { rebut: Math.trunc(Number(e.target.value)) })
                      }}
                    />
                  )}
                </td>
                <td className="px-2 py-2">
                  {!lecture && (
                    <DeclarerConstat
                      receptionId={c.receptionId}
                      plateformeId={c.site.id}
                      affiches={[
                        {
                          id: l.afficheId,
                          annonceur: l.annonceur,
                          theme: l.theme,
                          dossier: l.dossiers[0],
                        },
                      ]}
                    />
                  )}
                  {!lecture && saisies[l.afficheId]?.nonConformite !== 'CONFORME' && (
                    <span className="block text-xs text-slate-500">
                      à ouvrir dans l’appli Process Métier (lien à cadrer, Q-394)
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {lecture ? (
                    l.surplusEntretien ? (
                      `+${String(l.surplusEntretien)} en entretien`
                    ) : (
                      '—'
                    )
                  ) : (s?.qteComptee ?? l.quantiteBl) > l.attendu ? (
                    // RG-REC-066 : la case n'apparaît que si le comptage dépasse l'attendu.
                    <label className="flex items-center gap-1 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={s?.surplus ?? false}
                        onChange={(e) => {
                          majSaisie(l.afficheId, { surplus: e.target.checked })
                        }}
                      />
                      +{(s?.qteComptee ?? l.quantiteBl) - l.attendu} en entretien
                    </label>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!lecture && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {c.estInconnue && (
            <label className="text-sm font-medium">
              Imprimeur (à corriger)
              <select
                className="mt-1 block rounded border border-slate-300 px-2 py-1"
                value={imprimeurId}
                onChange={(e) => {
                  setImprimeurId(e.target.value)
                }}
              >
                <option value="">{c.imprimeur?.libelle ?? '—'}</option>
                {refs.kind === 'ready' &&
                  refs.data.imprimeurs.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.libelle}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="text-sm font-medium">
            Contrôleur (obligatoire)
            <select
              className="mt-1 block rounded border border-slate-300 px-2 py-1"
              value={controleurId}
              onChange={(e) => {
                setControleurId(e.target.value)
              }}
            >
              <option value="">— choisir —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {envoi.kind === 'erreur' && (
        <div className="mt-2">
          <ErrorMessage error={envoi.error} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="text-sm underline" onClick={onFermer}>
          Fermer le contrôle
        </button>
        {!lecture && (
          <>
            <Button
              type="button"
              disabled={envoi.kind === 'en-cours'}
              onClick={() => void valider(false)}
            >
              {envoi.kind === 'en-cours' ? 'Validation…' : 'Valider le contrôle'}
            </Button>
            <Button
              type="button"
              disabled={envoi.kind === 'en-cours'}
              onClick={() => void valider(true)}
            >
              Valider et imprimer
            </Button>
          </>
        )}
      </div>
      {apercu && (
        <ApercuFeuilles
          afficheIds={apercu}
          avecEtiquettes
          onFermer={() => {
            setApercu(null)
            onValide()
          }}
        />
      )}
      {voirBl && c.photoBlId !== null && (
        <Modale
          titre={`BL ${c.bl ?? '—'} · réception R${String(c.receptionId)}`}
          ouverte
          large
          onOuverture={(o) => {
            if (!o) setVoirBl(false)
          }}
        >
          <p className="mb-2 text-sm text-slate-600">
            Photo du BL prise à l’arrivée. Imprimeur : {c.imprimeur?.libelle ?? '—'} · Transporteur
            : {c.transporteur ?? '—'} · {c.lignes.length} ligne(s).
          </p>
          <object
            data={`/api/photos/${String(c.photoBlId)}`}
            aria-label="Photo du BL"
            className="h-[60vh] w-full"
          />
        </Modale>
      )}
    </>
  )
}
