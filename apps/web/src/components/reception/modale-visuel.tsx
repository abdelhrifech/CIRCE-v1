import { VisuelLigneSchema } from '@circe/shared'
import { apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'

/**
 * RG-REC-203 / ECR-REC-12 : modale « Visuel ». Position dans le train, préparation et image Broadcast
 * viennent de l'état des réservations (D-10) : non disponibles, affichés « — ».
 */
export function ModaleVisuel({ ligneId, onFermer }: { ligneId: number; onFermer: () => void }) {
  const { etat, recharger } = useApi(`visuel-${String(ligneId)}`, (signal) =>
    apiRequest('GET', `/api/lignes-attendues/${String(ligneId)}/visuel`, {
      schema: VisuelLigneSchema,
      signal,
    }),
  )
  const titre = etat.kind === 'ready' ? `Visuel · ${etat.data.annonceur ?? '—'}` : 'Visuel'
  return (
    <Modale
      titre={titre}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <dl
          className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
          data-testid="modale-visuel"
        >
          <dt className="text-slate-500">Dossier (DA)</dt>
          <dd>
            {etat.data.dossier ?? '—'} ({etat.data.da ?? '—'})
          </dd>
          <dt className="text-slate-500">Thème</dt>
          <dd>{etat.data.theme ?? '—'}</dd>
          <dt className="text-slate-500">Atelier · site</dt>
          <dd>
            {etat.data.atelier ?? '—'} · {etat.data.site}
          </dd>
          <dt className="text-slate-500">Format</dt>
          <dd>{etat.data.format ?? '—'}</dd>
          <dt className="text-slate-500">Départ</dt>
          <dd>{etat.data.depart}</dd>
          <dt className="text-slate-500">Position dans le train</dt>
          <dd>—</dd>
          <dt className="text-slate-500">Repiquage</dt>
          <dd>{etat.data.repiquage ?? '—'}</dd>
          <dt className="text-slate-500">Reçu / attendu</dt>
          <dd>
            {etat.data.recu} / {etat.data.attendu}
          </dd>
          <dt className="text-slate-500">N° d’affiche</dt>
          <dd>
            {etat.data.affiches.length === 0
              ? 'pas encore reçue'
              : etat.data.affiches
                  .map(
                    (a) =>
                      `${String(a.id)}${a.allee || a.rayon ? ` (${a.allee ?? ''}-${a.rayon ?? ''})` : ''}`,
                  )
                  .join(', ')}
          </dd>
          <dt className="text-slate-500">Exclusion</dt>
          <dd>{etat.data.exclusion ? 'exclu (ne pas afficher / reste en place)' : '—'}</dd>
          <dt className="text-slate-500">Préparation</dt>
          <dd>—</dd>
        </dl>
      )}
    </Modale>
  )
}
