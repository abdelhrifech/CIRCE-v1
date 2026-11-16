import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const SearchSchema = z.object({
  permission: z.string().optional(),
  motif: z.enum(['interdit', 'non_authentifie', 'erreur']).optional(),
})

export const Route = createFileRoute('/acces-refuse')({
  validateSearch: SearchSchema,
  component: AccesRefuse,
})

const TEXTES = {
  interdit: 'Votre rôle ne permet pas d’accéder à cette page.',
  non_authentifie: 'Vous n’êtes pas identifié.',
  erreur: 'Vos droits n’ont pas pu être vérifiés.',
} as const

function AccesRefuse() {
  const { permission, motif } = Route.useSearch()
  return (
    <main className="mx-auto max-w-xl p-6" data-testid="acces-refuse">
      <h1 className="text-xl font-semibold">Accès refusé</h1>
      <p className="mt-2 text-slate-700">{TEXTES[motif ?? 'interdit']}</p>
      {permission && (
        <p className="mt-1 text-xs text-slate-500">Permission requise : {permission}</p>
      )}
      <Link to="/" className="mt-4 inline-block text-sm underline">
        Retour à l’accueil
      </Link>
    </main>
  )
}
