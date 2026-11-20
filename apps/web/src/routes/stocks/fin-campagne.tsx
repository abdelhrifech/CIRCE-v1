import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  FinCampagneSchema,
  FinCampagneQuerySchema,
  LIBELLES_FIN_CAMPAGNE,
  DECISIONS_FIN_CAMPAGNE,
  ResultatStocksSchema,
  formatSemaineIso,
  semaineIsoDe,
  lundiSemaineIso,
  type FinCampagneLigne,
} from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiRequest, apiPost } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Button } from '../../components/button.tsx'
import {
  PageStocks,
  IndicateursStocks,
  champStock,
  cibleFin,
} from '../../components/stocks/commun.tsx'
export const Route = createFileRoute('/stocks/fin-campagne')({
  validateSearch: FinCampagneQuerySchema,
  beforeLoad: requirePermission('stock.fin_campagne.consulter'),
  component: Page,
})
function Page() {
  const initial = Route.useSearch(),
    [f, setF] = useState<ReturnType<typeof FinCampagneQuerySchema.parse>>({
      ...initial,
      decision: initial.decision ?? 'A_DECIDER',
    }),
    [choix, setChoix] = useState<string[]>([]),
    [edition, setEdition] = useState<FinCampagneLigne | null>(null),
    [execution, setExecution] = useState<{
      rows: FinCampagneLigne[]
      action: 'PROPOSER_DESTRUCTION' | 'RENVOI' | 'DESTRUCTION'
    } | null>(null),
    [confirme, setConfirme] = useState(false),
    [message, setMessage] = useState(''),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false)
  const qs = new URLSearchParams()
  for (const k of ['dossier', 'decision', 'attention', 'q'] as const) {
    const v = f[k]
    if (v) qs.set(k, v)
  }
  const { etat, recharger } = useApi(`fin-campagne-${qs}`, (signal) =>
    apiRequest('GET', `/api/stocks/fin-campagne?${qs}`, { schema: FinCampagneSchema, signal }),
  )
  const rows = etat.kind === 'ready' ? etat.data.items : [],
    peutAgir = etat.kind === 'ready' && etat.data.peutAgir,
    sel = rows.filter((r) => choix.includes(r.cle))
  function ouvrirAction(
    rows: FinCampagneLigne[],
    action: 'PROPOSER_DESTRUCTION' | 'RENVOI' | 'DESTRUCTION',
  ) {
    setErreur(null)
    setConfirme(false)
    setExecution({ rows, action })
  }
  async function executer() {
    if (!execution) return
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost('/api/stocks/fin-campagne/executer', {
        schema: ResultatStocksSchema,
        body: {
          cibles: execution.rows.map(cibleFin),
          action: execution.action,
          confirmation: confirme,
        },
      })
      setMessage(r.message)
      setExecution(null)
      setChoix([])
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <PageStocks
      titre={
        f.decision && f.decision !== 'FAIT' ? LIBELLES_FIN_CAMPAGNE[f.decision] : 'Fin de campagne'
      }
    >
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label>
          Dossier(s)
          <input
            className={champStock}
            value={f.dossier ?? ''}
            onChange={(e) => {
              setF({ ...f, dossier: e.target.value || undefined })
              setChoix([])
            }}
          />
        </label>
        <label>
          Décision
          <select
            aria-label="Décision"
            className={champStock}
            value={f.decision ?? ''}
            onChange={(e) => {
              setF({
                ...f,
                decision: e.target.value
                  ? FinCampagneQuerySchema.shape.decision.parse(e.target.value)
                  : undefined,
              })
              setChoix([])
            }}
          >
            <option value="">Toutes</option>
            {DECISIONS_FIN_CAMPAGNE.map((d) => (
              <option key={d} value={d}>
                {LIBELLES_FIN_CAMPAGNE[d]}
              </option>
            ))}
            <option value="FAIT">Sortis du stock</option>
          </select>
        </label>
        <label>
          Point d’attention
          <select
            className={champStock}
            value={f.attention ?? ''}
            onChange={(e) => {
              setF({
                ...f,
                attention: e.target.value
                  ? FinCampagneQuerySchema.shape.attention.parse(e.target.value)
                  : undefined,
              })
              setChoix([])
            }}
          >
            <option value="">Tous</option>
            <option value="BDX">Bordeaux</option>
            <option value="MUI">MUI (Ville de Paris)</option>
            <option value="garde">Visuel encore utilisé</option>
            <option value="aucun">Aucun</option>
          </select>
        </label>
      </div>
      {etat.kind === 'loading' && <p>Chargement des fins de campagne…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <IndicateursStocks
            items={(['A_DECIDER', 'CONSERVER', 'ENVOYER', 'DETRUIRE'] as const).map((d) => ({
              titre: LIBELLES_FIN_CAMPAGNE[d],
              valeur: etat.data.indicateurs[d],
              onClick: () => {
                setF({ ...f, decision: d })
                setChoix([])
              },
            }))}
          />
          <p className="my-4 rounded border border-sky-200 bg-sky-50 p-3">
            Décision par dossier et par centre. Les campagnes encore prévues bloquent les sorties.
            Bordeaux et MUI se traitent un par un. Une décision de destruction ne retire aucune
            affiche avant la confirmation « Destruction faite ».
          </p>
          {!peutAgir && <p className="my-3 font-medium">Consultation uniquement pour ce profil.</p>}
          {message && (
            <p role="status" className="my-3 text-sky-900">
              {message}
            </p>
          )}
          <div className="my-4 flex gap-3">
            <label>
              <input
                type="checkbox"
                checked={rows.length > 0 && sel.length === rows.length}
                onChange={(e) => {
                  setChoix(e.target.checked ? rows.map((r) => r.cle) : [])
                }}
              />{' '}
              Tout sélectionner
            </label>
            <Button
              disabled={!peutAgir || !sel.length}
              onClick={() => {
                ouvrirAction(sel, 'PROPOSER_DESTRUCTION')
              }}
            >
              Détruire la sélection
            </Button>
            <Button
              disabled={!peutAgir || !sel.length}
              onClick={() => {
                ouvrirAction(sel, 'DESTRUCTION')
              }}
            >
              Destruction faite…
            </Button>
          </div>
          <TableMetier
            nom="Fin de campagne"
            lignes={rows}
            cle={(r) => r.cle}
            onOuvrir={(r) => {
              if (peutAgir && !['DETRUIT', 'ENVOYE'].includes(r.decision)) setEdition(r)
            }}
            colonnes={[
              {
                id: 'decision',
                titre: 'Décision',
                valeur: (r) => LIBELLES_FIN_CAMPAGNE[r.decision],
              },
              { id: 'dossier', titre: 'Dossier', valeur: (r) => r.dossier },
              { id: 'annonceur', titre: 'Annonceur', valeur: (r) => r.annonceur },
              { id: 'atelier', titre: 'Atelier', valeur: (r) => `${r.atelier} · ${r.site}` },
              { id: 'dernier', titre: 'Dernier départ', valeur: (r) => r.dernierDepart },
              { id: 'stock', titre: 'En stock', valeur: (r) => r.stock },
              {
                id: 'detail',
                titre: 'Détail',
                valeur: (r) =>
                  r.decision === 'A_DECIDER'
                    ? r.gardes.length
                      ? 'Proposition : conserver — ' + r.gardes.join('; ')
                      : r.attention.includes('MUI')
                        ? 'Proposition : conserver (Ville de Paris)'
                        : r.attention.length
                          ? 'À vérifier : ' + r.attention.join(', ')
                          : `Proposition : détruire dès ${r.echeance}`
                    : r.decision === 'CONSERVER'
                      ? `Jusqu’à ${r.jusqua ?? '—'} · ${r.motif ?? ''}`
                      : r.decision === 'ENVOYER'
                        ? `${r.quantiteRetour ?? 0} affiche(s) à renvoyer à ${r.destinataire ?? ''}`
                        : r.decision === 'DETRUIT'
                          ? `${r.quantiteDetruite} détruite(s) · ${r.modifieLe ?? ''}`
                          : r.decision === 'ENVOYE'
                            ? `${r.quantiteEnvoyee} renvoyée(s) · ${r.destinataire ?? ''}`
                            : `Dès ${r.echeance}`,
              },
              {
                id: 'attention',
                titre: 'Attention',
                valeur: (r) => [...r.attention, ...r.gardes].join(' · '),
                rendu: (r) => (
                  <span
                    className={
                      r.attention.length || r.gardes.length ? 'font-semibold text-amber-900' : ''
                    }
                  >
                    {[...r.attention, ...(r.gardes.length ? ['Campagne prévue'] : [])].join(' · ')}
                  </span>
                ),
              },
              {
                id: 'delai',
                titre: 'Délai avant destruction',
                valeur: (r) => `${r.delai} semaines`,
                cachee: true,
              },
              {
                id: 'empl',
                titre: 'Emplacements',
                valeur: (r) =>
                  r.affiches
                    .filter((a) => a.disponible > 0)
                    .map((a) => a.emplacement)
                    .join(', '),
                cachee: true,
              },
              { id: 'par', titre: 'Par', valeur: (r) => r.par, cachee: true },
            ]}
            actions={(r) => (
              <div className="flex gap-2">
                <input
                  type="checkbox"
                  aria-label={`Sélectionner dossier ${r.dossier}`}
                  checked={choix.includes(r.cle)}
                  onChange={(e) => {
                    setChoix(
                      e.target.checked ? [...choix, r.cle] : choix.filter((k) => k !== r.cle),
                    )
                  }}
                />
                {peutAgir && !['DETRUIT', 'ENVOYE'].includes(r.decision) && (
                  <button
                    className="underline"
                    onClick={() => {
                      if (r.decision === 'ENVOYER') ouvrirAction([r], 'RENVOI')
                      else if (r.decision === 'DETRUIRE') ouvrirAction([r], 'DESTRUCTION')
                      else setEdition(r)
                    }}
                  >
                    {r.decision === 'ENVOYER'
                      ? 'Renvoi fait'
                      : r.decision === 'DETRUIRE'
                        ? 'Destruction faite…'
                        : r.decision === 'CONSERVER'
                          ? 'Modifier'
                          : 'Décider…'}
                  </button>
                )}
              </div>
            )}
          />
        </>
      )}
      {edition && (
        <Decision
          row={edition}
          onFermer={() => {
            setEdition(null)
          }}
          onSauvee={(m) => {
            setMessage(m)
            setEdition(null)
            setChoix([])
            recharger()
          }}
        />
      )}
      {execution && (
        <Modale
          titre={
            execution.action === 'DESTRUCTION'
              ? 'Confirmer la destruction'
              : execution.action === 'RENVOI'
                ? 'Confirmer le renvoi'
                : 'Décider la destruction'
          }
          ouverte
          onOuverture={(o) => {
            if (!o && !envoi) setExecution(null)
          }}
        >
          <p>
            {execution.rows.length} dossier(s), {execution.rows.reduce((s, r) => s + r.stock, 0)}{' '}
            affiche(s) en stock :{' '}
            {execution.rows.map((r) => `${r.dossier} (${r.annonceur})`).join(', ')}.
          </p>
          {execution.action === 'DESTRUCTION' && (
            <label className="my-5 block font-semibold">
              <input
                type="checkbox"
                checked={confirme}
                onChange={(e) => {
                  setConfirme(e.target.checked)
                }}
              />{' '}
              Je confirme que toutes les affiches restantes de ces dossiers ont été détruites
            </label>
          )}
          {execution.action === 'RENVOI' && (
            <p className="my-4">
              {execution.rows[0]?.quantiteRetour} affiche(s) renvoyée(s) à{' '}
              {execution.rows[0]?.destinataire}. Le reliquat passera « À détruire ».
            </p>
          )}
          {erreur !== null && <ErrorMessage error={erreur} />}
          <div className="mt-5 flex justify-end gap-3">
            <button
              disabled={envoi}
              onClick={() => {
                setExecution(null)
              }}
            >
              Annuler
            </button>
            <Button
              disabled={envoi || (execution.action === 'DESTRUCTION' && !confirme)}
              onClick={() => {
                void executer()
              }}
            >
              Confirmer
            </Button>
          </div>
        </Modale>
      )}
    </PageStocks>
  )
}
function Decision({
  row: r,
  onFermer,
  onSauvee,
}: {
  row: FinCampagneLigne
  onFermer: () => void
  onSauvee: (message: string) => void
}) {
  const [decision, setDecision] = useState<'DETRUIRE' | 'ENVOYER' | 'CONSERVER'>(
      r.gardes.length || r.attention.includes('MUI')
        ? 'CONSERVER'
        : r.decision === 'CONSERVER' || r.decision === 'ENVOYER'
          ? r.decision
          : 'DETRUIRE',
    ),
    [jusqua, setJusqua] = useState(
      r.jusqua ??
        formatSemaineIso(
          semaineIsoDe(
            new Date(lundiSemaineIso(semaineIsoDe(new Date())).getTime() + 9 * 7 * 86400000),
          ),
        ),
    ),
    [motif, setMotif] = useState(
      r.motif ??
        (r.gardes.length
          ? 'Campagne prévue sur le visuel'
          : r.attention.includes('MUI')
            ? 'Ville de Paris (MUI)'
            : 'Réaffichage prévu'),
    ),
    [dest, setDest] = useState(r.destinataire ?? 'Client ou agence'),
    [qte, setQte] = useState(r.quantiteRetour ?? r.stock),
    [envoi, setEnvoi] = useState(false),
    [erreur, setErreur] = useState<unknown>(null)
  async function sauver(choix: string) {
    setEnvoi(true)
    setErreur(null)
    try {
      const resultat = await apiPost('/api/stocks/fin-campagne/decision', {
        schema: ResultatStocksSchema,
        body: {
          ...cibleFin(r),
          decision: choix,
          ...(choix === 'CONSERVER'
            ? { jusqua, motif }
            : choix === 'ENVOYER'
              ? { destinataire: dest, quantiteRetour: qte }
              : {}),
        },
      })
      onSauvee(resultat.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={`Fin de campagne · dossier ${r.dossier} · ${r.annonceur}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o && !envoi) onFermer()
      }}
    >
      <p>
        {r.site} · {r.atelier} · Dernier départ {r.dernierDepart} · {r.stock} affiche(s) en stock
      </p>
      {r.gardes.length > 0 && (
        <div className="my-3 rounded border border-amber-400 p-3">
          <strong>Destruction non proposée : le visuel sert encore</strong>
          {r.gardes.map((g) => (
            <p key={g}>{g}</p>
          ))}
        </div>
      )}
      {r.attention.length > 0 && (
        <p className="my-3 font-semibold text-amber-900">
          Point d’attention : {r.attention.join(', ')}. Traitement individuel.
        </p>
      )}
      <p className="my-3">Emplacements : {r.affiches.map((a) => a.emplacement).join(', ')}</p>
      <TableMetier
        nom="Affiches du dossier"
        lignes={r.affiches}
        cle={(a) => a.id}
        colonnes={[
          { id: 'id', titre: 'N° affiche', valeur: (a) => a.id },
          { id: 'theme', titre: 'Visuel', valeur: (a) => a.theme },
          { id: 'stock', titre: 'Disponible', valeur: (a) => a.disponible },
          { id: 'emplacement', titre: 'Emplacement', valeur: (a) => a.emplacement },
        ]}
      />
      <div className="my-4 space-y-3">
        {(['DETRUIRE', 'ENVOYER', 'CONSERVER'] as const).map((d) => (
          <label key={d} className="block">
            <input
              type="radio"
              name="decision-fc"
              disabled={r.gardes.length > 0 && d !== 'CONSERVER'}
              checked={decision === d}
              onChange={() => {
                setDecision(d)
              }}
            />{' '}
            <strong>
              {d === 'ENVOYER'
                ? 'Renvoyer, puis détruire le reste'
                : d === 'CONSERVER'
                  ? 'Conserver'
                  : 'Détruire'}
            </strong>
            {d === 'DETRUIRE' &&
              ` — dès ${r.echeance} (${r.delai} semaines après le dernier départ)`}
          </label>
        ))}
      </div>
      {decision === 'CONSERVER' && (
        <div className="flex gap-4">
          <label>
            Jusqu’à
            <input
              className={champStock}
              type="week"
              value={jusqua}
              onChange={(e) => {
                setJusqua(e.target.value)
              }}
            />
          </label>
          <label>
            Motif
            <input
              className={champStock}
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value)
              }}
            />
          </label>
        </div>
      )}
      {decision === 'ENVOYER' && (
        <div className="flex gap-4">
          <label>
            Destinataire
            <input
              className={champStock}
              value={dest}
              onChange={(e) => {
                setDest(e.target.value)
              }}
            />
          </label>
          <label>
            Quantité à renvoyer
            <input
              type="number"
              min={1}
              max={r.stock}
              className={champStock}
              value={qte}
              onChange={(e) => {
                setQte(Number(e.target.value))
              }}
            />
          </label>
        </div>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      <div className="mt-5 flex justify-end gap-3">
        <button disabled={envoi} onClick={onFermer}>
          Annuler
        </button>
        {r.version > 0 && (
          <button
            disabled={envoi}
            className="underline"
            onClick={() => {
              void sauver('A_DECIDER')
            }}
          >
            Revenir à « à décider »
          </button>
        )}
        <Button
          disabled={envoi}
          onClick={() => {
            void sauver(decision)
          }}
        >
          Enregistrer la décision
        </Button>
      </div>
    </Modale>
  )
}
