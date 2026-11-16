import { EtiquettesRackSchema } from '@circe/shared'
import { useState } from 'react'
import { apiRequest } from '../../lib/api-client.ts'
import { can, getMe } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { ApercuFeuilles } from '../reception/apercu-feuilles.tsx'

/**
 * RG-COO-023 : étiquettes rack demandées par la validation admin, groupées par plateforme avec un bouton
 * « Imprimer » (pas d'impression en rafale, proposition Q62 / Q-162). PDF rendu par le navigateur (Q-002).
 * Affiché à la Coordination (liste des dossiers) et à la Réception (liste des affiches) ; le serveur limite au
 * périmètre ; « Imprimer » réservé à reception.imprimer.
 */
export function EtiquettesRack({ cle }: { cle: number }) {
  const [essai, setEssai] = useState(0)
  const { etat, recharger } = useApi(
    `coo-etiquettes-rack-${String(cle)}-${String(essai)}`,
    (signal) =>
      apiRequest('GET', '/api/coordination/etiquettes-rack', {
        schema: EtiquettesRackSchema,
        signal,
      }),
  )
  const { etat: moi } = useApi('moi', () => getMe())
  const [apercu, setApercu] = useState<number[] | null>(null)
  if (etat.kind === 'error') return <ErrorMessage error={etat.error} onRetry={recharger} />
  if (etat.kind === 'loading')
    return <p className="mt-2 text-sm text-slate-500">Chargement des étiquettes rack…</p>
  if (etat.data.groupes.length === 0) return null
  const peutImprimer = moi.kind === 'ready' && can(moi.data, 'reception.imprimer')
  return (
    <section
      className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm"
      aria-label="Étiquettes rack à imprimer"
    >
      <strong>Étiquettes rack à imprimer</strong> (affiches confirmées par la Coordination) :
      <ul className="mt-1 space-y-1">
        {etat.data.groupes.map((g) => (
          <li key={g.plateformeId} className="flex flex-wrap items-center gap-2">
            <span>
              {g.plateforme} : {g.afficheIds.length} étiquette(s)
            </span>
            {!peutImprimer && (
              // Admin : lecture seule, l'impression se fait à la plateforme (reception.imprimer).
              <span className="text-xs text-slate-600">imprimée par la plateforme</span>
            )}
            {peutImprimer && (
              <Button
                type="button"
                onClick={() => {
                  setApercu(g.afficheIds)
                }}
              >
                Imprimer
              </Button>
            )}
          </li>
        ))}
      </ul>
      {apercu && (
        <ApercuFeuilles
          afficheIds={apercu}
          etiquettesSeules
          onFermer={(imprime) => {
            setApercu(null)
            if (imprime) setEssai((e) => e + 1)
          }}
        />
      )}
    </section>
  )
}
