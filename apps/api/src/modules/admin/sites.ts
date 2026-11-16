// Étape 8 (D-02) — Sites et ateliers en LECTURE (ECR-ADM-01 « Sites, ateliers et gammes » : lecture seule dans la
// maquette, pas de CRUD ; PLAN D-02 « lecture seule suffit »). Site ≡ plateforme (Q-335). Les formats, machines et
// gammes de fabrication ne sont pas modélisés (ECARTS). Hypothèses : Q-406.
import type { Db } from '../../core/db.ts'
import type { Identity } from '../../core/identity.ts'
import type { Tx } from '../../core/transaction.ts'
import { assertDroitAdmin } from './permissions.ts'

// ECR-ADM-01 : un site avec ses ateliers (mode Trains = SCROLL, Unitaire = FIXE). 200 sites au plus par nom, filtre
// texte sur le nom du site ou le libellé d'un atelier ; `total` = sites correspondant au filtre.
export async function listerSites(db: Db | Tx, identity: Identity, q: { q?: string | undefined }) {
  assertDroitAdmin(identity, 'parametrage.gerer')
  const where = q.q
    ? {
        OR: [{ nom: { contains: q.q } }, { ateliers: { some: { libelle: { contains: q.q } } } }],
      }
    : {}
  const [sites, total] = await Promise.all([
    db.plateforme.findMany({
      where,
      orderBy: [{ nom: 'asc' }, { id: 'asc' }],
      take: 200,
      include: { ateliers: { orderBy: [{ libelle: 'asc' }, { id: 'asc' }] } },
    }),
    db.plateforme.count({ where }),
  ])
  return {
    total,
    sites: sites.map((s) => ({
      id: s.id,
      nom: s.nom,
      localite: s.localite,
      mail: s.mail,
      idSiteCcf: s.idSiteCcf,
      ateliers: s.ateliers.map((a) => ({
        id: a.id,
        libelle: a.libelle,
        type: a.type,
        codeAmt: a.codeAmt,
      })),
    })),
  }
}
