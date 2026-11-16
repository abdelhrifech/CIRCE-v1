import { useSelectionGlissee } from '../../lib/selection-glissee.ts'
import { IntituleSuggereSchema } from '@circe/shared'
import { useEffect, useRef } from 'react'
import { apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import {
  changerQuantite,
  cocher,
  etatTout,
  modifier,
  retirer,
  toutCocher,
  type LignePanier,
} from '../../lib/panier.ts'

interface PanierProps {
  panier: LignePanier[]
  onChange: (p: LignePanier[]) => void
}

/** RG-REC-021 à 023 : « Lignes du BL (panier) ». */
export function Panier({ panier, onChange }: PanierProps) {
  const glissement = useSelectionGlissee(
    panier.map((p) => p.ligneAttendueId),
    panier.filter((p) => p.cochee).map((p) => p.ligneAttendueId),
    (ids) => {
      onChange(panier.map((p) => ({ ...p, cochee: ids.includes(p.ligneAttendueId) })))
    },
  )
  const tout = useRef<HTMLInputElement>(null)
  const etat = etatTout(panier)
  useEffect(() => {
    if (tout.current) tout.current.indeterminate = etat === 'partiel'
  }, [etat])
  const cochees = panier.filter((p) => p.cochee).length

  return (
    <section className="rounded-lg border border-slate-200 bg-white" aria-labelledby="titre-panier">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <div>
          <h3 id="titre-panier" className="font-medium">
            Lignes du BL (panier)
          </h3>
          {panier.length > 0 && (
            <p className="text-sm text-slate-600" data-testid="panier-sous-titre">
              {cochees} cochée(s) sur {panier.length} pour ce BL ; les autres restent au panier pour
              le BL suivant.
            </p>
          )}
        </div>
        {panier.length > 0 && (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              onChange([])
            }}
          >
            Vider le panier
          </button>
        )}
      </div>
      {panier.length === 0 ? (
        <p className="p-3 text-sm text-slate-600">
          Aucune ligne. Trouvez les dossiers du BL en haut (photo du BL, photo d’une affiche, ou n°
          de dossier puis « Au panier ») : les lignes arrivent non cochées. Cochez celles de cette
          livraison. Rien ne correspond : « Réception inconnue ».
        </p>
      ) : (
        <table {...glissement} className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">
                <input
                  ref={tout}
                  type="checkbox"
                  aria-label="Tout cocher"
                  checked={etat === 'tout'}
                  onChange={() => {
                    onChange(toutCocher(panier, etat !== 'tout'))
                  }}
                />
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Dossier
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Annonceur · thème
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Reste attendu
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Qté du BL
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Livraison en deux fois
              </th>
              <th scope="col" className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {panier.map((p) => (
              <tr
                data-selection-id={p.ligneAttendueId}
                key={p.ligneAttendueId}
                className="border-t border-slate-100"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Ligne ${String(p.dossier ?? p.ligneAttendueId)} pour ce BL`}
                    checked={p.cochee}
                    onChange={(e) => {
                      onChange(cocher(panier, p.ligneAttendueId, e.target.checked))
                    }}
                  />
                </td>
                <td className="px-3 py-2 font-mono">{p.dossier ?? '—'}</td>
                <td className="px-3 py-2">
                  <strong>{p.annonceur ?? '—'}</strong>
                  {p.theme ? (
                    <span className="block text-slate-600">{p.theme}</span>
                  ) : (
                    <IntituleSaisi
                      ligne={p}
                      onChange={(intituleSaisi) => {
                        onChange(modifier(panier, p.ligneAttendueId, { intituleSaisi }))
                      }}
                    />
                  )}
                </td>
                <td className="px-3 py-2">{p.reste}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`Qté du BL, dossier ${String(p.dossier ?? p.ligneAttendueId)}`}
                    className="w-20 rounded border border-slate-300 px-1 py-0.5"
                    value={p.quantite}
                    onChange={(e) => {
                      onChange(changerQuantite(panier, p.ligneAttendueId, Number(e.target.value)))
                    }}
                  />
                  {p.cochee && p.quantite === 0 && (
                    <span className="block text-xs text-slate-500">quantité 0 : ligne ignorée</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {/* RG-REC-040 : visuel déjà reçu en partie. */}
                  {p.recu > 0 && p.recu < p.attendu && p.affiches.length > 0 ? (
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={p.complementAfficheId !== null}
                        onChange={(e) => {
                          onChange(
                            modifier(panier, p.ligneAttendueId, {
                              complementAfficheId: e.target.checked
                                ? (p.affiches[0] ?? null)
                                : null,
                            }),
                          )
                        }}
                      />
                      Complément de l’affiche n° {p.affiches[0]}
                    </label>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => {
                      onChange(retirer(panier, p.ligneAttendueId))
                    }}
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/**
 * RG-REC-047 / RG-REC-048 : IP non saisies → intitulé lu sur l'affiche ; proposition de l'intitulé
 * déjà saisi par l'autre plateforme (« le 1er qui a parlé »).
 */
function IntituleSaisi({ ligne, onChange }: { ligne: LignePanier; onChange: (v: string) => void }) {
  const { etat } = useApi(`intitule-${String(ligne.ligneAttendueId)}`, (signal) =>
    apiRequest('GET', `/api/lignes-attendues/${String(ligne.ligneAttendueId)}/intitule-suggere`, {
      schema: IntituleSuggereSchema,
      signal,
    }),
  )
  const suggestion = etat.kind === 'ready' ? etat.data : null
  return (
    <span className="mt-1 block">
      <input
        aria-label={`Intitulé saisi (sans IP), dossier ${String(ligne.dossier ?? ligne.ligneAttendueId)}`}
        placeholder="Intitulé saisi (sans IP)"
        className="w-full rounded border border-slate-300 px-1 py-0.5"
        value={ligne.intituleSaisi}
        onChange={(e) => {
          onChange(e.target.value)
        }}
      />
      {suggestion && ligne.intituleSaisi === '' && (
        <button
          type="button"
          className="mt-1 text-xs underline"
          onClick={() => {
            onChange(suggestion.intitule)
          }}
        >
          « {suggestion.intitule} » déjà saisi par {suggestion.site} (affiche {suggestion.afficheId}
          ), le 1er qui a parlé
        </button>
      )}
    </span>
  )
}
