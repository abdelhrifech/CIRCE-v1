import { FeuilleNc } from '../nonconformite/feuille.tsx'
import type { Nc } from '@circe/shared'
import { FeuillesSchema, ImpressionResultatSchema, type Feuille } from '@circe/shared'
import { useState } from 'react'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { barresCode39 } from '../../lib/code39.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'

function CodeBarres({ valeur }: { valeur: string }) {
  const { barres, longueur } = barresCode39(valeur)
  return (
    <svg
      role="img"
      aria-label={`Code-barres ${valeur}`}
      viewBox={`0 0 ${String(longueur)} 40`}
      className="h-12 w-full"
      preserveAspectRatio="none"
    >
      {barres.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.largeur} height={40} fill="black" />
      ))}
    </svg>
  )
}

const date = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/** ECR-REC-09 : une feuille A4 (Reports/EtiquetteRackAffiche.rdlc) ; fond jaune multi-semaines (RG-REC-082). */
function FeuilleA4({ f }: { f: Feuille }) {
  return (
    <article
      className={`feuille-stock mb-4 break-after-page border border-slate-400 p-4 ${f.fondJaune ? 'bg-yellow-100' : 'bg-white'}`}
      data-testid="feuille-stock"
    >
      <p className="text-center font-bold tracking-wide">
        FEUILLE DE STOCK {f.type === 'DEFINITIVE' ? 'DÉFINITIVE' : 'TEMPORAIRE'}
      </p>
      <p className="text-center text-xs">
        {f.type === 'DEFINITIVE'
          ? `Dossier identifié : ${f.dossiers.join(', ')}`
          : 'Réception inconnue · rangée en zone tampon · à remplacer par la feuille définitive'}
      </p>
      {f.photoId != null && (
        <img
          src={`/api/photos/${f.photoId}`}
          alt="Visuel de l’affiche"
          className="float-right ml-3 h-28 w-32 object-contain"
        />
      )}
      <p className="text-center text-6xl font-bold">{f.afficheId}</p>
      <p className="text-center text-3xl">{f.format}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 border border-slate-400 p-2 text-sm">
        <div>
          Date Réception
          <br />
          <strong>{date(f.dateReception)}</strong>
        </div>
        <div>
          Adressage (allée - rayon)
          <br />
          <strong>{f.adressage}</strong>
        </div>
        <div>
          Quantité
          <br />
          <strong>{f.quantite}</strong>
        </div>
        <div className="col-span-3">
          <CodeBarres valeur={f.codeBarres} />
          <p className="text-center font-mono text-xs">{f.codeBarres}</p>
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 text-sm">
        <dt>Dossier</dt>
        <dd>{f.dossiers.join(', ') || '—'}</dd>
        <dt>Semaines</dt>
        <dd>{f.semaines.join(' + ') || '—'}</dd>
        <dt>Annonceur</dt>
        <dd>{f.annonceur ?? '—'}</dd>
        <dt>Thème</dt>
        <dd className="break-words">{f.theme ?? '—'}</dd>
        <dt>Repiquage</dt>
        <dd>{f.repiquage ?? '—'}</dd>
        <dt>Commentaire</dt>
        <dd className="break-words">{f.commentaire ?? '—'}</dd>
        <dt>Affiche à conserver</dt>
        <dd>{f.aConserver ? 'Oui' : 'Non'}</dd>
      </dl>
      {f.premierDepart && <p className="mt-2 text-center text-5xl font-bold">{f.premierDepart}</p>}
      {f.lignes.length > 0 && (
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr>
              <th className="text-left">Dossier</th>
              <th className="text-left">Thème</th>
              <th className="text-left">Annonceur</th>
              <th className="text-left">Format</th>
              <th className="text-left">Départ</th>
              <th className="text-left">Qté prépa.</th>
              <th className="text-left">N° de demande</th>
            </tr>
          </thead>
          <tbody>
            {f.lignes.map((l, i) => (
              <tr key={i}>
                <td>{l.dossier ?? '—'}</td>
                <td>{l.theme ?? '—'}</td>
                <td>{l.annonceur ?? '—'}</td>
                <td>{l.format ?? '—'}</td>
                <td>{l.depart}</td>
                <td>{l.qtePrepa}</td>
                <td>{l.da ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-right text-xs">Page 1/1</p>
    </article>
  )
}

interface ApercuProps {
  nonConformites?: Nc[]
  afficheIds: number[]
  avecEtiquettes?: boolean
  /** RG-REC-090 : « Étiquettes rack » seules (une étiquette rack = la feuille de stock, RG-REC-076). */
  etiquettesSeules?: boolean
  onFermer: (imprime: boolean) => void
}

/**
 * ECR-REC-09 — aperçu avant impression (RG-REC-076 à 087). L'API enregistre l'impression (type de feuille,
 * tag levé, journal) puis le navigateur imprime (Q-002 : pas d'agent d'impression local en V1).
 */
export function ApercuFeuilles({
  afficheIds,
  nonConformites = [],
  avecEtiquettes = false,
  etiquettesSeules = false,
  onFermer,
}: ApercuProps) {
  const { etat, recharger } = useApi(`feuilles-${afficheIds.join(',')}`, (signal) =>
    apiRequest('GET', `/api/feuilles?ids=${afficheIds.join(',')}`, {
      schema: FeuillesSchema,
      signal,
    }),
  )
  const [exemplaires, setExemplaires] = useState<number | null>(null)
  const [envoi, setEnvoi] = useState<
    { kind: 'repos' | 'en-cours' } | { kind: 'erreur'; error: unknown }
  >({
    kind: 'repos',
  })
  const feuilles = etat.kind === 'ready' ? etat.data.feuilles : []
  // RG-REC-086 : nombre d'exemplaires par défaut = paramètre (lu avec les feuilles).
  const n = exemplaires ?? (etat.kind === 'ready' ? etat.data.exemplairesParDefaut : 1)
  const definitives = feuilles.filter((f) => f.type === 'DEFINITIVE').length
  // RG-REC-084 : pas d'étiquette rack sans dossier.
  const etiquettes = (avecEtiquettes || etiquettesSeules) && definitives === feuilles.length
  const impossible = etiquettesSeules && definitives !== feuilles.length

  async function imprimer() {
    setEnvoi({ kind: 'en-cours' })
    try {
      await apiPost('/api/impressions', {
        schema: ImpressionResultatSchema,
        body: {
          afficheIds,
          nonConformites: nonConformites.map((nc) => ({ id: nc.id, version: nc.version })),
          contenu: etiquettesSeules
            ? 'ETIQUETTE_RACK'
            : etiquettes
              ? 'FEUILLE_ET_ETIQUETTE'
              : 'FEUILLE',
          exemplaires: n,
        },
      })
      window.print()
      onFermer(true)
    } catch (error) {
      setEnvoi({ kind: 'erreur', error })
    }
  }

  return (
    <Modale
      titre={etiquettesSeules ? 'Étiquettes rack' : 'Aperçu avant impression'}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer(false)
      }}
    >
      {etat.kind === 'loading' && (
        <p className="text-sm text-slate-500">Préparation des feuilles…</p>
      )}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <p className="mb-2 text-sm" data-testid="resume-feuilles">
            {feuilles.length} feuille(s) : {definitives} définitive(s),{' '}
            {feuilles.length - definitives} temporaire(s).
          </p>
          <div className="zone-impression max-h-[55vh] overflow-auto bg-slate-100 p-2">
            {/* RG-REC-086 : n exemplaires par affiche ; les copies ne sont rendues qu'à l'impression. */}
            {feuilles.map((f) =>
              Array.from({ length: Math.min(Math.max(n, 1), 5) }, (_, i) => (
                <div
                  key={`${String(f.afficheId)}-${String(i)}`}
                  className={i > 0 ? 'hidden print:block' : ''}
                >
                  <FeuilleA4 f={f} />
                </div>
              )),
            )}
            {nonConformites.length > 0 && <FeuilleNc items={nonConformites} />}
          </div>
          {envoi.kind === 'erreur' && (
            <div className="mt-2">
              <ErrorMessage error={envoi.error} />
            </div>
          )}
          {impossible && (
            <p role="alert" className="mt-2 text-sm text-orange-800">
              Étiquette rack impossible pour une affiche sans dossier (feuille temporaire) :
              retirez-la de la sélection.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <label className="text-sm">
              Exemplaires{' '}
              <input
                type="number"
                min={1}
                max={5}
                className="w-14 rounded border border-slate-300 px-1"
                value={n}
                onChange={(e) => {
                  setExemplaires(Math.trunc(Number(e.target.value)))
                }}
              />
            </label>
            <button
              type="button"
              className="text-sm underline"
              onClick={() => {
                onFermer(false)
              }}
            >
              Annuler
            </button>
            <Button
              type="button"
              disabled={envoi.kind === 'en-cours' || impossible}
              onClick={() => void imprimer()}
            >
              {etiquettesSeules
                ? `Imprimer ${String(feuilles.length)} étiquette(s) rack`
                : `Imprimer (${String(n)} exemplaires)${etiquettes ? ' et les étiquettes rack' : ''}`}
            </Button>
          </div>
        </>
      )}
    </Modale>
  )
}
