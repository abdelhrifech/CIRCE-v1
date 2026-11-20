import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  StockQuerySchema,
  StocksSchema,
  ResultatStocksSchema,
  MOTIFS_REBUT,
  type StockLigne,
} from '@circe/shared'
import { requirePermission, can, getMe } from '../../lib/session.ts'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Button } from '../../components/button.tsx'
import { PageStocks, IndicateursStocks, champStock } from '../../components/stocks/commun.tsx'
export const Route = createFileRoute('/stocks/')({
  validateSearch: StockQuerySchema,
  beforeLoad: requirePermission('stock.consulter'),
  component: Page,
})
function Page() {
  const initial = Route.useSearch(),
    [f, setF] = useState(initial),
    [choix, setChoix] = useState<number[]>([]),
    [action, setAction] = useState<'rebut' | 'conserver' | null>(null),
    [qte, setQte] = useState(1),
    [motif, setMotif] = useState<(typeof MOTIFS_REBUT)[number]>('AFFICHE_DECHIREE'),
    [envoi, setEnvoi] = useState(false),
    [erreur, setErreur] = useState<unknown>(null),
    [message, setMessage] = useState('')
  const query = new URLSearchParams()
  for (const k of ['q', 'dossier', 'depart', 'format', 'etat', 'allee'] as const) {
    const v = f[k]
    if (v) query.set(k, v)
  }
  const { etat, recharger } = useApi(`stock-${query}`, (signal) =>
    apiRequest('GET', `/api/stocks?${query}`, { schema: StocksSchema, signal }),
  )
  const { etat: moi } = useApi('stock-moi', () => getMe())
  const peut = (p: Parameters<typeof can>[1]) => moi.kind === 'ready' && can(moi.data, p)
  const items = etat.kind === 'ready' ? etat.data.items : [],
    selection = items.filter((a) => choix.includes(a.id))
  async function executer() {
    setEnvoi(true)
    setErreur(null)
    try {
      const resultat = await apiPost(
        action === 'rebut' ? '/api/stocks/rebut' : '/api/stocks/conserver',
        {
          schema: ResultatStocksSchema,
          body: {
            affiches: selection.map((a) => ({ id: a.id, version: a.version })),
            ...(action === 'rebut' ? { quantite: qte, motif } : {}),
          },
        },
      )
      setChoix([])
      setAction(null)
      setMessage(resultat.message)
    } catch (e) {
      setErreur(e)
      setMessage('Opération refusée : aucune affiche du lot n’a été modifiée.')
    } finally {
      setEnvoi(false)
      recharger()
    }
  }
  const colonnes = [
    { id: 'id', titre: 'N° affiche', valeur: (a: StockLigne) => a.id },
    {
      id: 'visuel',
      titre: 'Annonceur · thème',
      valeur: (a: StockLigne) => `${a.annonceur ?? '—'} · ${a.theme ?? '—'}`,
      rendu: (a: StockLigne) => (
        <>
          <strong>{a.annonceur ?? '—'}</strong>
          <p>{a.theme ?? '—'}</p>
          {a.conserver && <span className="text-sky-800">À conserver</span>}
        </>
      ),
    },
    { id: 'semaine', titre: 'Départ', valeur: (a: StockLigne) => a.semaines.join(' + ') },
    {
      id: 'emplacement',
      titre: 'Emplacement',
      valeur: (a: StockLigne) => `${a.emplacement} · ${a.site}`,
    },
    { id: 'recu', titre: 'Reçu', valeur: (a: StockLigne) => a.recu },
    { id: 'sorties', titre: 'Sorties expédition', valeur: (a: StockLigne) => a.sorties },
    {
      id: 'disponible',
      titre: 'Disponible',
      valeur: (a: StockLigne) => a.disponible,
      rendu: (a: StockLigne) => (
        <>
          {a.rebut > 0 && <span className="mr-2 text-red-800">{a.rebut} rebut</span>}
          {a.disponible}
        </>
      ),
    },
    {
      id: 'derniere',
      titre: 'Dernière sortie auto',
      valeur: (a: StockLigne) =>
        a.derniereSortie ? new Date(a.derniereSortie).toLocaleString('fr-FR') : '—',
    },
    { id: 'site', titre: 'Site', valeur: (a: StockLigne) => a.site, cachee: true },
    { id: 'format', titre: 'Format', valeur: (a: StockLigne) => a.format, cachee: true },
    {
      id: 'dossier',
      titre: 'Dossiers',
      valeur: (a: StockLigne) => a.dossiers.join(', '),
      cachee: true,
    },
    { id: 'rebut', titre: 'Rebut', valeur: (a: StockLigne) => a.rebut, cachee: true },
  ]
  return (
    <PageStocks titre="Stock par affiche">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <label>
          Dossier(s)
          <input
            className={champStock}
            placeholder="Séparer par virgule"
            value={f.dossier ?? ''}
            onChange={(e) => {
              setF({ ...f, dossier: e.target.value || undefined })
              setChoix([])
            }}
          />
        </label>
        <label>
          Départ
          <input
            type="week"
            className={champStock}
            value={f.depart ?? ''}
            onChange={(e) => {
              setF({ ...f, depart: e.target.value || undefined })
              setChoix([])
            }}
          />
        </label>
        <label>
          Format
          <input
            className={champStock}
            value={f.format ?? ''}
            onChange={(e) => {
              setF({ ...f, format: e.target.value || undefined })
              setChoix([])
            }}
          />
        </label>
        <label>
          État
          <select
            className={champStock}
            value={f.etat ?? ''}
            onChange={(e) => {
              setF({
                ...f,
                etat: e.target.value
                  ? StockQuerySchema.shape.etat.parse(e.target.value)
                  : undefined,
              })
              setChoix([])
            }}
          >
            <option value="">Tous</option>
            <option value="stock">En stock</option>
            <option value="epuise">Épuisée</option>
            <option value="conserver">À conserver (reliquat)</option>
            <option value="rebut">Avec du rebut</option>
          </select>
        </label>
        <label>
          Allée
          <input
            className={champStock}
            value={f.allee ?? ''}
            onChange={(e) => {
              setF({ ...f, allee: e.target.value || undefined })
              setChoix([])
            }}
          />
        </label>
        <button
          type="button"
          className="underline"
          onClick={() => {
            setF({})
            setChoix([])
          }}
        >
          Réinitialiser
        </button>
      </form>
      {etat.kind === 'loading' && <p className="my-5">Chargement du stock…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <IndicateursStocks
            items={[
              { titre: 'Affiches en stock', valeur: etat.data.indicateurs.disponible },
              {
                titre: 'Reliquats d’entretien à conserver',
                valeur: etat.data.indicateurs.reliquats,
                detail: `${etat.data.indicateurs.visuelsConserves} visuels`,
              },
              { titre: 'Rebut', valeur: etat.data.indicateurs.rebut },
              {
                titre: 'Sorties automatiques aujourd’hui',
                valeur: etat.data.indicateurs.sortiesAujourdhui,
              },
            ]}
          />
          <div className="my-4 flex flex-wrap items-center gap-3">
            <label>
              <input
                type="checkbox"
                checked={items.length > 0 && selection.length === items.length}
                onChange={(e) => {
                  setChoix(e.target.checked ? items.map((a) => a.id) : [])
                }}
              />{' '}
              Tout sélectionner
            </label>
            <span>{selection.length} sélectionnée(s)</span>
            <Button
              disabled={!peut('stock.rebut') || !selection.length}
              onClick={() => {
                setErreur(null)
                setAction('rebut')
              }}
            >
              Mettre au rebut
            </Button>
            <Button
              disabled={
                !peut('affiche.modifier') ||
                !peut('affiche.conserver') ||
                !selection.length ||
                selection.some((a) => a.fusionnee)
              }
              onClick={() => {
                setErreur(null)
                setAction('conserver')
              }}
            >
              Marquer « à conserver »
            </Button>
          </div>
          {message && (
            <p role="status" className="my-3 text-sky-900">
              {message}
            </p>
          )}
          <TableMetier
            nom="Stock par affiche"
            lignes={items}
            cle={(a) => a.id}
            colonnes={colonnes}
            actions={(a) => (
              <label>
                <input
                  type="checkbox"
                  aria-label={`Sélectionner affiche ${a.id}`}
                  checked={choix.includes(a.id)}
                  onChange={(e) => {
                    setChoix(
                      e.target.checked ? [...choix, a.id] : choix.filter((id) => id !== a.id),
                    )
                  }}
                />{' '}
                Sélectionner
              </label>
            )}
          />
        </>
      )}
      {action && (
        <Modale
          titre={
            action === 'rebut'
              ? `Mise au rebut (${selection.length} affiche(s))`
              : 'Marquer les affiches à conserver'
          }
          ouverte
          onOuverture={(o) => {
            if (!o && !envoi) setAction(null)
          }}
        >
          <p className="mb-4">Affiches : {selection.map((a) => a.id).join(', ')}.</p>
          {action === 'rebut' && (
            <div className="space-y-3">
              <label className="block">
                Quantité par affiche
                <input
                  className={champStock}
                  type="number"
                  min={1}
                  value={qte}
                  onChange={(e) => {
                    setQte(Number(e.target.value))
                  }}
                />
              </label>
              <label className="block">
                Motif
                <select
                  className={champStock}
                  value={motif}
                  onChange={(e) => {
                    setMotif(e.target.value as typeof motif)
                  }}
                >
                  {MOTIFS_REBUT.map((m) => (
                    <option key={m} value={m}>
                      {
                        {
                          AFFICHE_DECHIREE: 'Affiche déchirée',
                          MAUVAIS_VISUEL: 'Mauvais visuel',
                          ERREUR_QUANTITE: 'Erreur de quantité',
                          AUTRE: 'Autre',
                        }[m]
                      }
                    </option>
                  ))}
                </select>
              </label>
              <p>
                La quantité doit être disponible sur chaque affiche. Le serveur refuse tout
                dépassement.
              </p>
            </div>
          )}
          {erreur !== null && <ErrorMessage error={erreur} />}
          <div className="mt-5 flex justify-end gap-3">
            <button
              disabled={envoi}
              onClick={() => {
                setAction(null)
              }}
            >
              Annuler
            </button>
            <Button
              disabled={
                envoi ||
                (action === 'rebut' &&
                  (!Number.isInteger(qte) || qte < 1 || selection.some((a) => qte > a.disponible)))
              }
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
