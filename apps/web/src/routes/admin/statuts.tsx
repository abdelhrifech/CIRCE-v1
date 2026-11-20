import { createFileRoute } from '@tanstack/react-router'
import { CATALOGUE_REFERENCE, MAPPING_REFERENCE, CatalogueStatutsSchema } from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { PageAdmin } from '../../components/admin/page.tsx'
export const Route = createFileRoute('/admin/statuts')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Page,
})
function Page() {
  const { etat, recharger } = useApi('catalogue-statuts', (signal) =>
    apiRequest('GET', '/api/admin/statuts', { schema: CatalogueStatutsSchema, signal }),
  )
  return (
    <PageAdmin titre="Statuts">
      <p className="mb-4 text-sm text-slate-600">
        Catalogue des états et tags effectivement utilisés par l’application. Les états calculés
        suivent leurs données sources.
      </p>
      {etat.kind === 'loading' && <p>Chargement du catalogue…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[...new Set(etat.data.items.map((r) => r.origine))].map((o) => (
              <div key={o} className="rounded border p-4">
                <p>{o}</p>
                <strong className="text-2xl">
                  {etat.data.items.filter((r) => r.origine === o).length}
                </strong>
              </div>
            ))}
          </div>
          <TableMetier
            nom="Statuts et tags"
            lignes={etat.data.items}
            cle={(r) => r.cle}
            colonnes={[
              { id: 'domaine', titre: 'Domaine', valeur: (r) => r.domaine },
              { id: 'libelle', titre: 'Statut ou tag', valeur: (r) => r.libelle },
              { id: 'origine', titre: 'Origine', valeur: (r) => r.origine },
              { id: 'sens', titre: 'Ce que ça veut dire', valeur: (r) => r.description },
              { id: 'ecran', titre: 'Écran', valeur: (r) => r.ecran },
            ]}
          />
        </>
      )}
      <h2 className="my-5 text-xl font-semibold">Catalogue de référence de la maquette</h2>
      <p className="mb-3 text-sm text-slate-600">
        Définitions et origines cibles ; le catalogue des valeurs effectivement utilisées est
        affiché au-dessus.
      </p>
      <TableMetier
        nom="Définitions des statuts et tags"
        lignes={CATALOGUE_REFERENCE.flatMap((g) =>
          g.items.map((item, i) => ({
            cle: `${g.g}-${i}`,
            domaine: g.g,
            ecran: g.ou,
            nom: item[0],
            origine: item[1],
            description: item[2],
            source: item[3],
          })),
        )}
        cle={(r) => r.cle}
        colonnes={[
          { id: 'domaine', titre: 'Domaine', valeur: (r) => r.domaine },
          { id: 'nom', titre: 'Statut ou tag', valeur: (r) => r.nom },
          {
            id: 'origine',
            titre: 'Origine',
            valeur: (r) =>
              ({
                C: 'Calculé',
                E: 'Existe déjà dans Circé',
                B: 'Vient de Broadcast',
                N: 'À ajouter (V2)',
              })[r.origine],
          },
          { id: 'description', titre: 'Ce que ça veut dire', valeur: (r) => r.description },
          {
            id: 'source',
            titre: 'Où c’est dans Circé, ou ce qu’il manque',
            valeur: (r) => r.source,
          },
          { id: 'ecran', titre: 'Écran', valeur: (r) => r.ecran, cachee: true },
        ]}
      />
      <h2 className="my-5 text-xl font-semibold">
        Codes de tr_statut : correspondance existant → cible
      </h2>
      <TableMetier
        nom="Correspondance des statuts"
        lignes={MAPPING_REFERENCE.map((r) => ({
          code: r[0],
          ancien: r[1],
          usage: r[2],
          cible: r[3],
          commentaire: r[4],
        }))}
        cle={(r) => r.code}
        colonnes={[
          { id: 'code', titre: 'Code', valeur: (r) => r.code },
          { id: 'ancien', titre: 'Statut existant', valeur: (r) => r.ancien },
          { id: 'usage', titre: 'Utilisé pour', valeur: (r) => r.usage },
          { id: 'cible', titre: 'Statut cible', valeur: (r) => r.cible },
          { id: 'commentaire', titre: 'Commentaire', valeur: (r) => r.commentaire },
        ]}
      />
    </PageAdmin>
  )
}
