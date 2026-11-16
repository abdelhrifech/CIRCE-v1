import { CompteursReceptionSchema } from '@circe/shared'
import { Link } from '@tanstack/react-router'
import { apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'

/**
 * RG-REC-010 : menu Réception (trois entrées + Alertes) et badges (palettes à contrôler ; affiches orphelines en
 * rouge). « Zone picking » et « Fusion des affiches » ne sont pas repris (Q-100, Q-101).
 */
export function MenuReception() {
  const { etat } = useApi('compteurs-reception', (signal) =>
    apiRequest('GET', '/api/reception/compteurs', { schema: CompteursReceptionSchema, signal }),
  )
  const compteurs = etat.kind === 'ready' ? etat.data : null
  return (
    <nav
      aria-label="Réception"
      className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 text-sm"
    >
      <Link
        to="/reception"
        activeOptions={{ exact: true, includeSearch: false }}
        className="rounded-md px-3 py-1.5 font-medium"
        activeProps={{ className: 'bg-slate-900 text-white', 'aria-current': 'page' }}
      >
        Réception des affiches
        {compteurs?.palettesAControler != null && compteurs.palettesAControler > 0 && (
          <span
            className="ml-2 rounded-full bg-amber-200 px-1.5 text-xs text-amber-900"
            aria-label={`${compteurs.palettesAControler} palette(s) à contrôler`}
          >
            {compteurs.palettesAControler}
          </span>
        )}
      </Link>
      <Link
        to="/reception/affiches"
        className="rounded-md px-3 py-1.5 font-medium"
        activeProps={{ className: 'bg-slate-900 text-white', 'aria-current': 'page' }}
      >
        Liste des affiches
      </Link>
      <Link
        to="/reception/inconnues"
        className="rounded-md px-3 py-1.5 font-medium"
        activeProps={{ className: 'bg-slate-900 text-white', 'aria-current': 'page' }}
      >
        Réceptions inconnues
        {compteurs?.affichesOrphelines != null && compteurs.affichesOrphelines > 0 && (
          <span
            className="ml-2 rounded-full bg-red-600 px-1.5 text-xs text-white"
            aria-label={`${compteurs.affichesOrphelines} affiche(s) orpheline(s)`}
          >
            {compteurs.affichesOrphelines}
          </span>
        )}
      </Link>
      <Link
        to="/reception/alertes"
        className="rounded-md px-3 py-1.5 font-medium"
        activeProps={{ className: 'bg-slate-900 text-white', 'aria-current': 'page' }}
      >
        Alertes
      </Link>
    </nav>
  )
}
