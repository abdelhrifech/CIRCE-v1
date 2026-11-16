import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { FormulaireNc, SuiviNc } from '../components/nonconformite/ecrans.tsx'
import { requirePermission } from '../lib/session.ts'
const Search = z.object({
  tab: z.enum(['reception', 'suivi', 'declaration', 'reclamation']).default('suivi'),
  id: z.coerce.number().int().positive().optional(),
})
export const Route = createFileRoute('/non-conformite')({
  validateSearch: Search,
  beforeLoad: requirePermission('nonconformite.consulter'),
  component: Page,
})
function Page() {
  const s = Route.useSearch(),
    navigate = useNavigate({ from: Route.fullPath })
  const agence = s.tab === 'declaration' || s.tab === 'reclamation'
  const formulaire = s.tab === 'reception' || s.tab === 'declaration'
  const suivre = () => void navigate({ search: { tab: agence ? 'reclamation' : 'suivi' } })
  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <p className="mb-2 text-sm text-slate-500">
        Non-conformité · {agence ? 'Réclamation agence' : 'Réception contrôlée'}
      </p>
      {formulaire ? (
        <>
          <h1 className="mb-5 text-2xl font-semibold">
            {agence ? 'Nouvelle demande' : 'Nouvelle réception'}
          </h1>
          <FormulaireNc
            key={s.tab}
            type={agence ? 'AGENCE' : 'RECEPTION'}
            onEnvoyee={suivre}
            onAnnuler={suivre}
          />
        </>
      ) : (
        <SuiviNc
          key={s.tab}
          type={agence ? 'AGENCE' : 'RECEPTION'}
          ouvrir={s.id}
          onNouvelle={() =>
            void navigate({ search: { tab: agence ? 'declaration' : 'reception' } })
          }
        />
      )}
    </main>
  )
}
