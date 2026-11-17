import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ListeAffichesSchema, ResultatAfficheSchema } from '@circe/shared'
import { can, getMe, requirePermission } from '../../lib/session.ts'
import { apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
export const Route = createFileRoute('/reception/picking')({
  beforeLoad: requirePermission('affiche.consulter'),
  component: Page,
})
function Page() {
  const { etat: moi } = useApi('moi', () => getMe())
  const modification = moi.kind === 'ready' && can(moi.data, 'affiche.modifier')
  const [page, setPage] = useState(1),
    [toutes, setToutes] = useState(false),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false)
  const { etat, recharger } = useApi(`picking-${page}-${toutes}`, (signal) =>
    apiRequest('GET', `/api/affiches?page=${page}&pageSize=100${toutes ? '' : '&picking=oui'}`, {
      schema: ListeAffichesSchema,
      signal,
    }),
  )
  async function basculer(id: number, version: number, picking: boolean) {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiRequest('PATCH', `/api/affiches/${id}`, {
        schema: ResultatAfficheSchema,
        body: { version, zonePicking: picking },
        idempotencyKey: true,
      })
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <main className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Zone picking</h1>
      <label>
        <input
          type="checkbox"
          checked={toutes}
          onChange={(e) => {
            setToutes(e.target.checked)
            setPage(1)
          }}
        />{' '}
        Afficher aussi les affiches hors picking pour les ajouter
      </label>
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}{' '}
      {erreur !== null && <ErrorMessage error={erreur} />}
      {etat.kind === 'ready' && (
        <>
          <TableMetier
            nom="zone-picking"
            lignes={etat.data.items}
            cle={(r) => r.id}
            colonnes={[
              { id: 'id', titre: 'N° affiche', valeur: (r) => r.id },
              { id: 'site', titre: 'Plateforme', valeur: (r) => r.site.nom },
              { id: 'dossier', titre: 'Dossier', valeur: (r) => r.dossiers.join(', ') },
              { id: 'annonceur', titre: 'Annonceur', valeur: (r) => r.annonceur },
              { id: 'theme', titre: 'Thème', valeur: (r) => r.theme },
              { id: 'stock', titre: 'Stock', valeur: (r) => r.enStock },
              { id: 'lieu', titre: 'Emplacement', valeur: (r) => r.emplacement },
              { id: 'picking', titre: 'Picking', valeur: (r) => (r.zonePicking ? 'Oui' : 'Non') },
            ]}
            actions={(r) => (
              <button
                type="button"
                className="underline"
                disabled={!modification || envoi || r.version === undefined || r.fusionneeHeritee}
                onClick={() => void basculer(r.id, r.version ?? 0, !r.zonePicking)}
              >
                {r.zonePicking ? 'Retirer du picking' : 'Ajouter au picking'}
              </button>
            )}
          />
          <p className="my-3">
            Page {page} · {etat.data.total} affiche(s). Export de la page filtrée affichée.
          </p>
          <button
            disabled={page === 1}
            onClick={() => {
              setPage((p) => p - 1)
            }}
          >
            Précédente
          </button>{' '}
          ·{' '}
          <button
            disabled={page * 100 >= etat.data.total}
            onClick={() => {
              setPage((p) => p + 1)
            }}
          >
            Suivante
          </button>
        </>
      )}
      <p className="mt-6 rounded border p-3">
        Le douchage d’activité reste indisponible : son effet sur les sorties de stock n’est pas
        arbitré. L’ajout ou le retrait du picking ne modifie pas le stock.
      </p>
    </main>
  )
}
