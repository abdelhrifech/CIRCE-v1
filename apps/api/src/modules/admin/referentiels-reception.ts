// Étape 8 (D-04) — Référentiels de réception (ECR-ADM-07, RG-REC-035 / 179) : imprimeurs et livreurs sont administrés
// par `reception/administration.ts` (GET / POST / PATCH /api/referentiels/:ref) ; ici la liste des AGENTS de réception
// (contrôleurs, EX-REC-514), qui sont les utilisateurs au rôle `recep` (HYPOTHÈSE Q-177 (1)) : lecture seule, gérés
// dans « Utilisateurs » (D-01). Droit `referentiel.gerer` (administrateur seul). Hypothèses : Q-407.
import type { AgentsReceptionAdmin } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Identity } from '../../core/identity.ts'
import { assertDroitAdmin } from './permissions.ts'

// RG-REC-179 : agents de réception (actifs et désactivés), 200 premiers par nom ; filtre texte.
export async function listerAgentsReception(
  db: Db,
  identity: Identity,
  q: { q?: string | undefined },
): Promise<AgentsReceptionAdmin> {
  assertDroitAdmin(identity, 'referentiel.gerer')
  const where = {
    roles: { some: { role: { code: 'recep' } } },
    ...(q.q ? { OR: [{ identifiantExterne: { contains: q.q } }, { nom: { contains: q.q } }] } : {}),
  }
  const [lignes, total] = await Promise.all([
    db.utilisateur.findMany({
      where,
      orderBy: [{ nom: 'asc' }, { identifiantExterne: 'asc' }],
      take: 200,
      include: { perimetres: { include: { plateforme: { select: { nom: true } } } } },
    }),
    db.utilisateur.count({ where }),
  ])
  return {
    total,
    agents: lignes.map((u) => ({
      id: u.id,
      identifiantExterne: u.identifiantExterne,
      nom: u.nom,
      actif: u.actif,
      plateformes: [...new Set(u.perimetres.map((p) => p.plateforme.nom))].sort(),
    })),
  }
}
