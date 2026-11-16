import { ControleSchema } from '@circe/shared'
import { Link } from '@tanstack/react-router'
import { apiRequest } from '../../lib/api-client.ts'
import { dateCourte } from '../../lib/duree.ts'
import { LIBELLE_STATUT_RECEPTION } from '../../lib/libelles-affiche.ts'
import { useApi } from '../../lib/use-api.ts'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
import { Pastille } from '../ui/pastille.tsx'

/** ECR-REC-06 — fiche réception (lecture). Données du contrôle de la palette (GET …/controle). */
export function FicheReception({
  receptionId,
  onFermer,
  onAffiche,
}: {
  receptionId: number
  onFermer: () => void
  /** Clic de ligne → fiche affiche (ECR-REC-05). */
  onAffiche?: (afficheId: number) => void
}) {
  const { etat, recharger } = useApi(`fiche-reception-${String(receptionId)}`, (signal) =>
    apiRequest('GET', `/api/receptions/${String(receptionId)}/controle`, {
      schema: ControleSchema,
      signal,
    }),
  )
  return (
    <Modale
      titre={`Réception R${String(receptionId)}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      {etat.kind === 'loading' && <p className="text-sm text-slate-500">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <div className="text-sm">
          <div className="flex flex-wrap gap-1">
            <Pastille ton={LIBELLE_STATUT_RECEPTION[etat.data.statut]?.ton ?? 'neutre'}>
              {LIBELLE_STATUT_RECEPTION[etat.data.statut]?.libelle ?? etat.data.statut}
            </Pastille>
            {etat.data.estInconnue && <Pastille ton="info">Réception inconnue</Pastille>}
            {etat.data.photoBlId !== null && <Pastille ton="ok">Photo du BL jointe</Pastille>}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="font-medium">Date</dt>
            <dd>{dateCourte(etat.data.arrivee)}</dd>
            <dt className="font-medium">BL</dt>
            <dd>{etat.data.bl ?? '—'}</dd>
            <dt className="font-medium">Transporteur</dt>
            <dd>{etat.data.transporteur ?? '—'}</dd>
            <dt className="font-medium">Imprimeur</dt>
            <dd>{etat.data.imprimeur?.libelle ?? '—'}</dd>
            <dt className="font-medium">Colis / palettes</dt>
            <dd>{etat.data.nbColis ?? '—'}</dd>
            <dt className="font-medium">Déchargé par</dt>
            <dd>{etat.data.dechargePar ?? '—'}</dd>
            <dt className="font-medium">Contrôlé par</dt>
            <dd>
              {etat.data.controleur ?? '—'}
              {etat.data.controleLe ? ` le ${dateCourte(etat.data.controleLe)}` : ''}
            </dd>
          </dl>
          <table className="mt-3 w-full" aria-label="Lignes du BL">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {[
                  'N° affiche',
                  'Annonceur',
                  'Thème',
                  'Qté du BL',
                  'Qté reçue',
                  'Emplacement',
                  'Statut',
                ].map((h) => (
                  <th key={h} scope="col" className="px-2 py-1 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {etat.data.lignes.map((l) => (
                <tr
                  key={l.afficheId}
                  className={`border-t border-slate-100 ${onAffiche ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  onClick={() => onAffiche?.(l.afficheId)}
                >
                  <td className="px-2 py-1 font-mono">
                    {onAffiche ? (
                      <button
                        type="button"
                        className="underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAffiche(l.afficheId)
                        }}
                      >
                        {l.afficheId}
                      </button>
                    ) : (
                      l.afficheId
                    )}{' '}
                    {l.complement && <Pastille ton="surveiller">complément</Pastille>}
                  </td>
                  <td className="px-2 py-1">{l.annonceur ?? '—'}</td>
                  <td className="px-2 py-1">{l.theme ?? '—'}</td>
                  <td className="px-2 py-1">{l.quantiteBl}</td>
                  {/* Qté reçue par cette réception : comptée au contrôle, sinon quantité du BL. */}
                  <td className="px-2 py-1">{l.qteComptee ?? l.quantiteBl}</td>
                  <td className="px-2 py-1">
                    {l.allee ?? '—'}-{l.rayon ?? '—'}
                  </td>
                  <td className="px-2 py-1">
                    <Pastille ton={l.statutAffiche === 'ORPHELINE' ? 'surveiller' : 'ok'}>
                      {l.statutAffiche === 'ORPHELINE' ? 'Orpheline' : 'Identifiée'}
                    </Pastille>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="underline" onClick={onFermer}>
              Fermer
            </button>
            {etat.data.statut === 'A_CONTROLER' && (
              <Link
                className="rounded-md bg-slate-900 px-3 py-1.5 text-white"
                to="/reception"
                search={{ palette: receptionId }}
              >
                Contrôler la palette
              </Link>
            )}
          </div>
        </div>
      )}
    </Modale>
  )
}
