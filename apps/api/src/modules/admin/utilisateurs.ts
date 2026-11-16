// Étape 8 (D-01) — Gestion des utilisateurs, rôles et périmètre (RG-ADM-010 à 017 provisoires, Q-320, Q-003) : liste,
// création, modification (nom, rôles, périmètre site / atelier), désactivation. Pas d'authentification gérée ici
// (Q-001) : aucun mot de passe, l'identifiant est l'identifiant externe de l'annuaire. Droit `utilisateur.gerer`
// (administrateur seul), vérifié dans le service. Hypothèses : Q-406.
import type {
  CreerUtilisateur,
  ModifierUtilisateur,
  PerimetreEntree,
  Role,
  UtilisateurAdmin,
} from '@circe/shared'
import { RoleSchema } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { ADM, assertDroitAdmin, estCompteTechnique, IDENTIFIANT_SYSTEME } from './permissions.ts'

/** Q-412 : le compte de l'automate n'est ni créé, ni modifié, ni activé, ni doté de rôle ou de périmètre depuis D-01. */
function refuserCompteTechnique(identifiant: string): void {
  if (estCompteTechnique(identifiant))
    throw new ConflictError(
      `Le compte technique « ${IDENTIFIANT_SYSTEME} » est réservé aux traitements planifiés : il ne se gère pas ici.`,
      { code: 'ADM_COMPTE_TECHNIQUE' },
    )
}

type Client = Db | Tx

const include = {
  roles: { include: { role: true } },
  perimetres: { include: { plateforme: true, atelier: true } },
} as const

async function lire(db: Client, id: number): Promise<UtilisateurAdmin> {
  const u = await db.utilisateur.findUnique({ where: { id }, include })
  if (!u)
    throw new NotFoundError('Utilisateur introuvable', { code: 'ADM_UTILISATEUR_INTROUVABLE' })
  return vue(u)
}

type Brut = NonNullable<Awaited<ReturnType<Db['utilisateur']['findFirst']>>> & {
  roles: { role: { code: string } }[]
  perimetres: {
    plateformeId: number
    atelierId: number | null
    plateforme: { nom: string }
    atelier: { libelle: string } | null
  }[]
}

function vue(u: Brut): UtilisateurAdmin {
  const roles = u.roles
    .map((r) => RoleSchema.safeParse(r.role.code))
    .flatMap((p) => (p.success ? [p.data] : []))
    .sort()
  return {
    id: u.id,
    identifiantExterne: u.identifiantExterne,
    nom: u.nom,
    actif: u.actif,
    roles,
    toutesPlateformes: roles.includes('admin'),
    perimetre: u.perimetres
      .map((p) => ({
        plateformeId: p.plateformeId,
        plateforme: p.plateforme.nom,
        atelierId: p.atelierId,
        atelier: p.atelier?.libelle ?? null,
      }))
      .sort((a, b) => a.plateformeId - b.plateformeId || (a.atelierId ?? 0) - (b.atelierId ?? 0)),
    version: u.version,
  }
}

// D-01 : liste (200 premiers par identifiant) filtrable par texte, rôle et état.
export async function listerUtilisateurs(
  db: Client,
  identity: Identity,
  q: { q?: string | undefined; role?: Role | undefined; actif?: boolean | undefined },
) {
  assertDroitAdmin(identity, 'utilisateur.gerer')
  const where = {
    // Q-412 : le compte technique est masqué de la liste.
    identifiantExterne: { not: IDENTIFIANT_SYSTEME },
    ...(q.q ? { OR: [{ identifiantExterne: { contains: q.q } }, { nom: { contains: q.q } }] } : {}),
    ...(q.role ? { roles: { some: { role: { code: q.role } } } } : {}),
    ...(q.actif !== undefined ? { actif: q.actif } : {}),
  }
  const [lignes, total] = await Promise.all([
    db.utilisateur.findMany({ where, orderBy: { identifiantExterne: 'asc' }, take: 200, include }),
    db.utilisateur.count({ where }),
  ])
  return { utilisateurs: lignes.map(vue), total }
}

/** Rôles demandés → lignes `role` (les 6 rôles provisoires du seed, Q-003) ; 400 si un rôle manque en base. */
async function resoudreRoles(db: Client, roles: Role[]) {
  const uniques = [...new Set(roles)]
  const lignes = await db.role.findMany({ where: { code: { in: uniques } } })
  const manquants = uniques.filter((c) => !lignes.some((l) => l.code === c))
  if (manquants.length > 0)
    throw new ValidationError(`Rôle inconnu : ${manquants.join(', ')}.`, {
      code: 'ADM_ROLE_INCONNU',
    })
  return lignes
}

/** Périmètre : sites et ateliers existants, l'atelier appartient au site ; doublons écartés. */
async function resoudrePerimetre(db: Client, perimetre: PerimetreEntree[]) {
  const vus = new Set<string>()
  const lignes: { plateformeId: number; atelierId: number | null }[] = []
  for (const p of perimetre) {
    const cle = `${String(p.plateformeId)}:${String(p.atelierId ?? '')}`
    if (vus.has(cle)) continue
    vus.add(cle)
    lignes.push({ plateformeId: p.plateformeId, atelierId: p.atelierId ?? null })
  }
  const plateformes = await db.plateforme.findMany({
    where: { id: { in: [...new Set(lignes.map((l) => l.plateformeId))] } },
    select: { id: true },
  })
  const inconnuesP = lignes.filter((l) => !plateformes.some((p) => p.id === l.plateformeId))
  if (inconnuesP.length > 0)
    throw new ValidationError(
      `Site inconnu : ${[...new Set(inconnuesP.map((l) => l.plateformeId))].join(', ')}.`,
      { code: 'ADM_SITE_INCONNU' },
    )
  const idsAteliers = lignes.flatMap((l) => (l.atelierId === null ? [] : [l.atelierId]))
  const ateliers = await db.atelier.findMany({
    where: { id: { in: idsAteliers } },
    select: { id: true, plateformeId: true },
  })
  for (const l of lignes) {
    if (l.atelierId === null) continue
    const a = ateliers.find((x) => x.id === l.atelierId)
    if (!a)
      throw new ValidationError(`Atelier inconnu : ${String(l.atelierId)}.`, {
        code: 'ADM_ATELIER_INCONNU',
      })
    if (a.plateformeId !== l.plateformeId)
      throw new ValidationError(
        `L’atelier ${String(l.atelierId)} n’appartient pas au site ${String(l.plateformeId)}.`,
        { code: 'ADM_ATELIER_HORS_SITE' },
      )
  }
  return lignes
}

// D-01 : création d'un compte. Identifiant unique (casse ignorée, Q-406) → 409 ADM_UTILISATEUR_EXISTE.
export async function creerUtilisateur(
  tx: Tx,
  identity: Identity,
  input: CreerUtilisateur,
): Promise<UtilisateurAdmin> {
  assertDroitAdmin(identity, 'utilisateur.gerer')
  refuserCompteTechnique(input.identifiantExterne)
  const roles = await resoudreRoles(tx, input.roles)
  const perimetre = await resoudrePerimetre(tx, input.perimetre)
  const doublon = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM utilisateur WHERE lower(identifiant_externe) = lower(${input.identifiantExterne}) LIMIT 1`
  if (doublon.length > 0)
    throw new ConflictError(`L’identifiant « ${input.identifiantExterne} » existe déjà.`, {
      code: 'ADM_UTILISATEUR_EXISTE',
    })
  const u = await tx.utilisateur.create({
    data: { identifiantExterne: input.identifiantExterne, nom: input.nom ?? null },
  })
  await tx.utilisateurRole.createMany({
    data: roles.map((r) => ({ utilisateurId: u.id, roleId: r.id })),
  })
  if (perimetre.length > 0)
    await tx.utilisateurPerimetre.createMany({
      data: perimetre.map((p) => ({ utilisateurId: u.id, ...p })),
    })
  await ecrireJournal(tx, {
    typeEntite: 'UTILISATEUR',
    entiteId: u.id,
    action: 'CREATION_UTILISATEUR',
    parId: identity.userId,
    nouvelleValeur: u.identifiantExterne,
    donnees: { roles: roles.map((r) => r.code).sort(), perimetre },
  })
  return lire(tx, u.id)
}

// D-01 : modification (nom, état, rôles, périmètre) sous verrou de version ; rôles et périmètre sont REMPLACÉS.
// HYPOTHÈSE Q-406 : un administrateur ne modifie ni ses propres rôles ni son périmètre et ne se désactive pas
// (409 ADM_AUTO_MODIFICATION) : pas d'élévation de ses propres droits et pas de verrouillage ; l'acteur étant
// toujours un administrateur actif, le dernier administrateur est ainsi protégé.
export async function modifierUtilisateur(
  tx: Tx,
  identity: Identity,
  id: number,
  input: ModifierUtilisateur,
): Promise<UtilisateurAdmin> {
  assertDroitAdmin(identity, 'utilisateur.gerer')
  const avant = await lire(tx, id)
  refuserCompteTechnique(avant.identifiantExterne)
  if (
    id === identity.userId &&
    (input.roles !== undefined || input.perimetre !== undefined || input.actif === false)
  )
    throw new ConflictError(
      'Vous ne pouvez pas modifier vos propres rôles, votre périmètre ni vous désactiver.',
      { code: 'ADM_AUTO_MODIFICATION' },
    )
  const roles = input.roles ? await resoudreRoles(tx, input.roles) : null
  const perimetre = input.perimetre ? await resoudrePerimetre(tx, input.perimetre) : null
  await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.utilisateur.updateMany({
        where: { id, ...where },
        data: {
          ...(input.nom !== undefined ? { nom: input.nom } : {}),
          ...(input.actif !== undefined ? { actif: input.actif } : {}),
          ...bumpVersion,
        },
      }),
    ...ADM.version,
  })
  if (roles) {
    await tx.utilisateurRole.deleteMany({ where: { utilisateurId: id } })
    await tx.utilisateurRole.createMany({
      data: roles.map((r) => ({ utilisateurId: id, roleId: r.id })),
    })
  }
  if (perimetre) {
    await tx.utilisateurPerimetre.deleteMany({ where: { utilisateurId: id } })
    if (perimetre.length > 0)
      await tx.utilisateurPerimetre.createMany({
        data: perimetre.map((p) => ({ utilisateurId: id, ...p })),
      })
  }
  const apres = await lire(tx, id)
  // Q-412 (m1) : dernier administrateur recompté DANS la transaction, après les écritures (deux administrateurs qui se
  // retirent mutuellement ne peuvent pas laisser la base sans administrateur actif).
  if (
    avant.actif &&
    avant.roles.includes('admin') &&
    !(apres.actif && apres.roles.includes('admin'))
  ) {
    const restants = await tx.utilisateur.count({
      where: { actif: true, roles: { some: { role: { code: 'admin' } } } },
    })
    if (restants === 0)
      throw new ConflictError('Le dernier administrateur actif ne peut pas être retiré.', {
        code: 'ADM_DERNIER_ADMIN',
      })
  }
  await ecrireJournal(tx, {
    typeEntite: 'UTILISATEUR',
    entiteId: id,
    action: 'MODIFICATION_UTILISATEUR',
    parId: identity.userId,
    ancienneValeur: avant.actif ? 'actif' : 'inactif',
    nouvelleValeur: apres.actif ? 'actif' : 'inactif',
    donnees: {
      avant: { nom: avant.nom, roles: avant.roles, perimetre: avant.perimetre.map(cleP) },
      apres: { nom: apres.nom, roles: apres.roles, perimetre: apres.perimetre.map(cleP) },
    },
  })
  return apres
}

const cleP = (p: { plateformeId: number; atelierId: number | null }) => ({
  plateformeId: p.plateformeId,
  atelierId: p.atelierId,
})
