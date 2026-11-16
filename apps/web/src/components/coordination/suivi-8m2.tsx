import {
  LIBELLE_CHAMP_8M2,
  ResultatSaisie8m2Schema,
  Suivi8m2Schema,
  type Champ8m2,
  type LigneSuivi8m2,
} from '@circe/shared'
import { useState } from 'react'
import { ErrorMessage } from '../error-message.tsx'
import { ApiError, apiPost, apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'

// COO-P11 — ECR-COO-08 « Suivi 8 m² (demies) » (RG-COO-237) : seul écran où des champs sont saisis directement dans le
// tableau. Entier ≥ 0 ; chaque modification est tracée (« 8 m² : <champ> = <valeur> »). Remplace un Excel hors Circé.

const CHAMPS: Champ8m2[] = ['demiesHaut', 'demiesBas', 'finales']

export function VueSuivi8m2({
  qs,
  depart,
  peutSaisir,
}: {
  qs: string
  depart: string
  peutSaisir: boolean
}) {
  const requete = new URLSearchParams(qs)
  requete.set('depart', depart)
  const { etat, recharger } = useApi(`suivi-8m2-${requete.toString()}`, (signal) =>
    apiRequest('GET', `/api/coordination/trains/suivi-8m2?${requete.toString()}`, {
      schema: Suivi8m2Schema,
      signal,
    }),
  )
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [saisies, setSaisies] = useState<Record<string, string>>({})

  async function enregistrer(l: LigneSuivi8m2, champ: Champ8m2, texte: string) {
    setErreur(null)
    setMessage(null)
    const cle = `${l.cle}|${champ}`
    // Entier ≥ 0 (RG-COO-237) : contrôlé ici pour l'ergonomie, l'API refuse en 400 sinon.
    if (!/^\d+$/.test(texte.trim())) {
      setErreur(
        new ApiError(400, {
          code: 'VALIDATION',
          message: `${LIBELLE_CHAMP_8M2[champ]} : saisissez un nombre entier supérieur ou égal à 0.`,
        }),
      )
      return
    }
    if (Number(texte) === l[champ]) {
      setSaisies((courant) =>
        Object.fromEntries(Object.entries(courant).filter(([k]) => k !== cle)),
      )
      return
    }
    try {
      const r = await apiPost('/api/coordination/trains/suivi-8m2', {
        schema: ResultatSaisie8m2Schema,
        body: {
          atelierId: l.atelierId,
          depart,
          contNum: l.contNum ?? 0,
          theme: l.theme ?? '',
          champ,
          valeur: Number(texte),
          version: l.version,
        },
      })
      setMessage(r.message)
      setSaisies((courant) =>
        Object.fromEntries(Object.entries(courant).filter(([k]) => k !== cle)),
      )
    } catch (e) {
      setErreur(e)
    } finally {
      recharger()
    }
  }

  if (etat.kind === 'loading') return <p className="mt-4">Chargement…</p>
  if (etat.kind === 'error') return <ErrorMessage error={etat.error} onRetry={recharger} />
  const { lignes, ateliers } = etat.data
  const sites = new Set(ateliers.map((a) => a.plateforme))
  return (
    <section className="mt-4" aria-label="Suivi 8 m²">
      {message && (
        <p role="status" className="mb-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-600">
          {ateliers.length === 0
            ? 'Aucun atelier 8 m² n’est paramétré (paramètre « suivi8m2.ateliers »).'
            : 'Aucun thème 8 m² pour ces critères.'}
        </p>
      ) : (
        <table className="w-full text-sm" aria-label="Suivi 8 m²">
          <thead>
            <tr className="border-b text-left text-slate-500">
              {sites.size > 1 && <th>Site</th>}
              <th>Annonceur · thème</th>
              <th className="text-right">Besoin</th>
              <th className="text-right">Reçu</th>
              <th className="text-right">Demies haut</th>
              <th className="text-right">Demies bas</th>
              <th className="text-right">8 m² finales</th>
              <th className="text-right">Reste à faire</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr
                key={l.cle}
                className={`border-b ${l.recu < l.besoin ? 'bg-orange-50' : l.resteAFaire === 0 ? 'bg-emerald-50' : ''}`}
              >
                {sites.size > 1 && <td>{l.site}</td>}
                <td className="py-1">
                  {l.annonceur ?? '—'} · {l.theme ?? '—'}
                </td>
                <td className="text-right">{l.besoin}</td>
                <td className="text-right">{l.recu}</td>
                {CHAMPS.map((c) => (
                  <td key={c} className="text-right">
                    {peutSaisir ? (
                      <input
                        type="number"
                        min={0}
                        aria-label={`${LIBELLE_CHAMP_8M2[c]} de ${l.annonceur ?? '—'} · ${l.theme ?? '—'}`}
                        className="w-20 rounded-md border border-slate-300 px-1 text-right"
                        value={saisies[`${l.cle}|${c}`] ?? String(l[c])}
                        onChange={(e) => {
                          setSaisies({ ...saisies, [`${l.cle}|${c}`]: e.target.value })
                        }}
                        onBlur={(e) => {
                          void enregistrer(l, c, e.target.value)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                        }}
                      />
                    ) : (
                      l[c]
                    )}
                  </td>
                ))}
                <td className="text-right">{l.resteAFaire}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
