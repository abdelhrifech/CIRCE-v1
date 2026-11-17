import { createFileRoute } from '@tanstack/react-router'
import { requirePermission } from '../../lib/session.ts'
export const Route = createFileRoute('/reception/fusion')({
  beforeLoad: requirePermission('affiche.consulter'),
  component: () => (
    <main className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Fusion des affiches</h1>
      <p>
        Les fusions héritées sont consultables dans la fiche de l’affiche. La création d’une fusion
        reste indisponible : les critères de regroupement et le choix de l’affiche chapeau doivent
        être validés.
      </p>
      <a className="mt-4 block underline" href="/reception/affiches">
        Consulter les affiches et leurs historiques
      </a>
      <button disabled className="mt-4 rounded bg-slate-200 p-3 text-slate-600">
        Fusionner — règle à valider
      </button>
    </main>
  ),
})
