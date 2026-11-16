import {
  ApercusBaguesSchema,
  ImpressionBaguesSchema,
  MOTIFS_REIMPRESSION,
  ResultatBagueSchema,
  RouleursSchema,
  type ApercuBague,
  type ImpressionBagues,
  type LigneBague,
  type TrainVersion,
} from '@circe/shared'
import { useState } from 'react'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { barresCode39 } from '../../lib/code39.ts'
import { useApi } from '../../lib/use-api.ts'

// COO-P11 — Bagues et étiquettes (ECR-COO-11a / 11b / 11c, RG-COO-299 à 302). L'impression physique n'est pas
// pilotée par Circé (Q-002, Q-287) : l'étiquette est un APERÇU navigateur (PDF généré côté navigateur, CLAUDE.md §3) ;
// l'impression pose la bague en base, affecte le rouleur et fait passer les unités « Prêt » à « En production ».

/** « mar. 20/10 16h30 » (UTC, comme la liste des trains). */
function depart(iso: string): string {
  const d = new Date(iso)
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })
  const jj = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${jour} ${jj}/${mm} ${String(d.getUTCHours()).padStart(2, '0')}h${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Code-barres (Code 39) du numéro de bague : chiffres seuls (le préfixe « BG » n'est pas encodé). */
function CodeBarres({ numero }: { numero: number }) {
  const { barres, longueur } = barresCode39(String(numero).padStart(8, '0'), 2)
  return (
    <svg
      role="img"
      aria-label={`Code-barres de la bague ${String(numero)}`}
      viewBox={`0 0 ${String(longueur)} 24`}
      className="h-8 w-full"
      preserveAspectRatio="none"
    >
      {barres.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.largeur} height={24} fill="currentColor" />
      ))}
    </svg>
  )
}

/** RG-COO-302 : contenu de l'étiquette (code-barres, n°, « Nb aff », destinataire, afficheur · atelier, départ · rouleur). */
export function ApercuBagueCarte({ bague }: { bague: ApercuBague }) {
  return (
    <article
      aria-label={`Bague ${bague.numero === null ? bague.trainId : String(bague.numero)}`}
      className="etiquette-bague w-64 rounded-md border-2 border-slate-800 bg-white p-2 text-xs"
    >
      {bague.numero === null ? (
        <p className="text-center text-slate-500">code-barres posé à l’impression</p>
      ) : (
        <CodeBarres numero={bague.numero} />
      )}
      <p className="mt-1 flex justify-between font-mono">
        <span>{bague.codeBarre}</span>
        <span>Nb aff : {bague.nbAff}</span>
      </p>
      <p className="mt-1 text-lg font-bold leading-tight">{bague.destinataire ?? '—'}</p>
      <p>
        {bague.afficheur ?? '—'} · {bague.atelier ?? '—'}
      </p>
      <p>
        {depart(bague.depart)} · {bague.rouleur ?? 'rouleur à choisir'}
      </p>
      <ul className="mt-1 border-t pt-1">
        {bague.lignes.map((l) => (
          <li key={l.lettre}>
            {l.dossier ?? '—'} · {l.annonceur ?? '—'} — {l.lettre}
            <br />
            <span className="font-semibold">
              {l.theme ?? '—'}
              {l.modifie ? ' ★' : ''}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}

// ───────────────────────── ECR-COO-11a : Imprimer n bague(s) ─────────────────────────

export function ModaleImpressionBagues({
  trains,
  atelierId,
  onFermer,
}: {
  trains: TrainVersion[]
  atelierId: number
  onFermer: (message: string | null) => void
}) {
  const ids = trains
    .slice(0, 6)
    .map((t) => t.trainId)
    .join(',')
  const rouleurs = useApi(`bagues-rouleurs-${String(atelierId)}`, (signal) =>
    apiRequest('GET', `/api/coordination/trains/rouleurs?atelier=${String(atelierId)}`, {
      schema: RouleursSchema,
      signal,
    }),
  )
  const apercu = useApi(`bagues-apercu-${ids}`, (signal) =>
    apiRequest('GET', `/api/coordination/bagues/apercu?trains=${encodeURIComponent(ids)}`, {
      schema: ApercusBaguesSchema,
      signal,
    }),
  )
  const [rouleurId, setRouleurId] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [resultat, setResultat] = useState<ImpressionBagues | null>(null)

  async function imprimer() {
    setEnvoi(true)
    setErreur(null)
    try {
      setResultat(
        await apiPost('/api/coordination/bagues/imprimer', {
          schema: ImpressionBaguesSchema,
          body: { trains, rouleurId: Number(rouleurId) },
        }),
      )
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Modale
      titre={`Imprimer ${String(trains.length)} bague(s)`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer(resultat?.message ?? null)
      }}
    >
      {resultat === null ? (
        <>
          {rouleurs.etat.kind === 'loading' && <p>Chargement…</p>}
          {rouleurs.etat.kind === 'error' && (
            <ErrorMessage error={rouleurs.etat.error} onRetry={rouleurs.recharger} />
          )}
          {rouleurs.etat.kind === 'ready' &&
            (rouleurs.etat.data.rouleurs.length === 0 ? (
              <p className="text-sm text-slate-600">
                Aucun rouleur n’est enregistré pour cet atelier (référentiel des rouleurs,
                ECR-ADM-07).
              </p>
            ) : (
              <label className="block text-sm">
                Rouleur
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                  value={rouleurId}
                  onChange={(e) => {
                    setRouleurId(e.target.value)
                  }}
                >
                  <option value="">Choisir…</option>
                  {rouleurs.etat.data.rouleurs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nom}
                      {r.poste ? ` · ${r.poste}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          <p className="mt-3 text-sm text-slate-600">
            Le statut passe automatiquement à « En production » à l’impression (point de
            non-retour). L’étiquette est un aperçu généré par le navigateur : Circé ne pilote pas
            l’imprimante.
          </p>
          <section aria-label="Aperçu des premières bagues" className="mt-3">
            <p className="text-sm font-medium">
              Aperçu des {Math.min(6, trains.length)} première(s) bague(s)
            </p>
            {apercu.etat.kind === 'loading' && <p>Chargement…</p>}
            {apercu.etat.kind === 'error' && (
              <ErrorMessage error={apercu.etat.error} onRetry={apercu.recharger} />
            )}
            {apercu.etat.kind === 'ready' && (
              <div className="mt-2 flex flex-wrap gap-3">
                {apercu.etat.data.bagues.map((b) => (
                  <ApercuBagueCarte key={b.trainId} bague={b} />
                ))}
              </div>
            )}
          </section>
          {erreur !== null && <ErrorMessage error={erreur} />}
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
              disabled={envoi || !rouleurId}
              onClick={() => {
                void imprimer()
              }}
            >
              Imprimer
            </Button>
          </div>
        </>
      ) : (
        <>
          <p
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm"
          >
            {resultat.message}
          </p>
          {resultat.ignorees.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="font-medium">{resultat.ignorees.length} unité(s) non imprimée(s) :</p>
              <ul className="list-disc pl-5" aria-label="Unités non imprimées">
                {resultat.ignorees.map((i) => (
                  <li key={i.trainId}>
                    {i.trainId} : {i.raison}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* D-18 : seules les bagues sont imprimées (zone d'impression), pas la fenêtre. */}
          <div
            className="zone-impression mt-3 flex flex-wrap gap-3"
            data-testid="bagues-impression"
          >
            {resultat.bagues.map((b) => (
              <ApercuBagueCarte key={b.trainId} bague={b} />
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              onClick={() => {
                window.print()
              }}
            >
              Imprimer l’aperçu (PDF navigateur)
            </Button>
            <Button
              type="button"
              onClick={() => {
                onFermer(resultat.message)
              }}
            >
              Fermer
            </Button>
          </div>
        </>
      )}
    </Modale>
  )
}

// ───────────────────────── ECR-COO-11b : Textes imprimés sur la bague ─────────────────────────

export function ModaleTextesBague({
  ligne,
  onFermer,
}: {
  ligne: LigneBague
  onFermer: (message: string | null) => void
}) {
  const [textes, setTextes] = useState(
    ligne.textes.map((t) => ({
      lettre: t.lettre,
      annonceur: t.annonceur ?? '',
      theme: t.theme ?? '',
    })),
  )
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  async function enregistrer() {
    if (ligne.bague === null) return
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost('/api/coordination/bagues/modifier', {
        schema: ResultatBagueSchema,
        body: { trainId: ligne.trainId, version: ligne.bague.version, textes },
      })
      onFermer(r.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={`Textes imprimés sur la bague ${String(ligne.bague?.numero ?? '')}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <div className="space-y-3">
        {textes.map((t, i) => (
          <fieldset key={t.lettre} className="rounded-md border border-slate-200 p-2">
            <legend className="px-1 text-sm font-medium">Position {t.lettre}</legend>
            <label className="block text-sm">
              Annonceur ({t.lettre})
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                value={t.annonceur}
                onChange={(e) => {
                  setTextes(
                    textes.map((x, k) => (k === i ? { ...x, annonceur: e.target.value } : x)),
                  )
                }}
              />
            </label>
            <label className="mt-2 block text-sm">
              Thème ({t.lettre})
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                value={t.theme}
                onChange={(e) => {
                  setTextes(textes.map((x, k) => (k === i ? { ...x, theme: e.target.value } : x)))
                }}
              />
            </label>
          </fieldset>
        ))}
      </div>
      {erreur !== null && <ErrorMessage error={erreur} />}
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
            void enregistrer()
          }}
        >
          Enregistrer et réimprimer
        </Button>
      </div>
    </Modale>
  )
}

// ───────────────────────── ECR-COO-11c : Réimprimer la bague n ─────────────────────────

export function ModaleReimpression({
  trainId,
  numero,
  version,
  onFermer,
}: {
  trainId: string
  numero: number
  version: number
  onFermer: (message: string | null) => void
}) {
  const [motif, setMotif] = useState<string>(MOTIFS_REIMPRESSION[0])
  const [precision, setPrecision] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  async function reimprimer() {
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await apiPost('/api/coordination/bagues/reimprimer', {
        schema: ResultatBagueSchema,
        body: {
          trainId,
          version,
          motif,
          ...(motif === 'Autre' && precision.trim() ? { precision: precision.trim() } : {}),
        },
      })
      onFermer(r.message)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={`Réimprimer la bague ${String(numero)}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <p className="text-sm text-slate-600">
        La bague garde le même numéro et les mêmes textes ; le statut de l’unité est inchangé.
      </p>
      <label className="mt-3 block text-sm">
        Motif
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={motif}
          onChange={(e) => {
            setMotif(e.target.value)
          }}
        >
          {MOTIFS_REIMPRESSION.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      {motif === 'Autre' && (
        <label className="mt-2 block text-sm">
          Précision
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
            maxLength={200}
            value={precision}
            onChange={(e) => {
              setPrecision(e.target.value)
            }}
          />
        </label>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
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
            void reimprimer()
          }}
        >
          Réimprimer
        </Button>
      </div>
    </Modale>
  )
}
