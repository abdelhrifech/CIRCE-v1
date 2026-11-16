// COO-P11 — Référentiel des rouleurs (RG-COO-297, ECR-ADM-07) : opérateurs rattachés à un atelier (donc à un site) et à
// un poste (« Table 1 »), distincts des utilisateurs (Q-276). Désactivation plutôt que suppression d'un rouleur
// référencé (HYPOTHÈSE de la règle) ; suppression refusée (409) s'il est référencé par une face de train ou une bague.
// Droit : `referentiel.gerer` (administrateur, COO §2, RG-COO-297).
import type { CreerRouleur, ModifierRouleur, RouleurLigne } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import {
  assertDroitCoordination,
  assertPerimetreAtelier,
  COO,
  peutVoirAtelier,
} from './permissions.ts'

type Client = Db | Tx
const R = 'RG-COO-297'

const actif = (r: { dateFin: Date | null }, maintenant: Date) =>
  r.dateFin === null || r.dateFin > maintenant

async function ligne(db: Client, id: number, maintenant = new Date()): Promise<RouleurLigne> {
  const r = await db.rouleur.findUnique({
    where: { id },
    include: {
      atelier: { include: { plateforme: { select: { nom: true } } } },
      _count: { select: { faces: true, bagues: true } },
    },
  })
  if (!r) throw new NotFoundError(`Rouleur ${String(id)} introuvable`)
  return {
    id: r.id,
    nom: r.nom,
    poste: r.poste,
    atelier: r.atelier
      ? { id: r.atelier.id, libelle: r.atelier.libelle, plateforme: r.atelier.plateforme.nom }
      : null,
    actif: actif(r, maintenant),
    utilise: r._count.faces + r._count.bagues > 0,
    version: r.version,
  }
}

// RG-COO-297 : liste complète (actifs et désactivés) des rouleurs du périmètre de l'utilisateur.
export async function listerRouleursReferentiel(
  db: Db,
  identity: Identity,
  maintenant = new Date(),
): Promise<{ rouleurs: RouleurLigne[] }> {
  assertDroitCoordination(identity, 'referentiel.gerer', R)
  const rouleurs = await db.rouleur.findMany({
    include: { atelier: { select: { id: true, plateformeId: true } } },
    orderBy: [{ atelierId: 'asc' }, { nom: 'asc' }],
  })
  const visibles = rouleurs.filter((r) => peutVoirAtelier(identity, r.atelier))
  const lignes: RouleurLigne[] = []
  for (const r of visibles) lignes.push(await ligne(db, r.id, maintenant))
  return { rouleurs: lignes }
}

// RG-COO-297 : création d'un rouleur d'un atelier du périmètre ; le nom est unique dans l'atelier (HYPOTHÈSE Q-195).
export async function creerRouleur(
  tx: Tx,
  identity: Identity,
  input: CreerRouleur,
): Promise<RouleurLigne> {
  assertDroitCoordination(identity, 'referentiel.gerer', R)
  const atelier = await tx.atelier.findUnique({ where: { id: input.atelierId } })
  if (!atelier) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, atelier)
  await assertNomLibre(tx, input.atelierId, input.nom)
  const cree = await tx.rouleur.create({
    data: {
      atelierId: input.atelierId,
      nom: input.nom,
      poste: input.poste ?? null,
    },
  })
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `rouleur:${String(cree.id)}`,
    action: 'CREATION_ROULEUR',
    parId: identity.userId,
    nouvelleValeur: `${cree.nom}${cree.poste ? ` (${cree.poste})` : ''}`,
    complement: R,
  })
  return ligne(tx, cree.id)
}

async function assertNomLibre(tx: Client, atelierId: number, nom: string, sauf?: number) {
  const meme = (
    await tx.rouleur.findMany({ where: { atelierId }, select: { id: true, nom: true } })
  ).find((x) => x.id !== sauf && x.nom.trim().toLowerCase() === nom.trim().toLowerCase())
  if (meme)
    throw new ConflictError(`Un rouleur « ${meme.nom} » existe déjà dans cet atelier.`, {
      code: 'COO_ROULEUR_EXISTE',
      regle: R,
    })
}

// RG-COO-297 : modification (nom, poste) et désactivation / réactivation, sous verrou de version.
export async function modifierRouleur(
  tx: Tx,
  identity: Identity,
  id: number,
  input: ModifierRouleur,
  maintenant = new Date(),
): Promise<RouleurLigne> {
  assertDroitCoordination(identity, 'referentiel.gerer', R)
  const r = await tx.rouleur.findUnique({
    where: { id },
    include: { atelier: { select: { id: true, plateformeId: true } } },
  })
  if (!r) throw new NotFoundError(`Rouleur ${String(id)} introuvable`)
  assertPerimetreAtelier(identity, r.atelier)
  if (input.nom !== undefined && r.atelierId !== null)
    await assertNomLibre(tx, r.atelierId, input.nom, r.id)
  await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.rouleur.updateMany({
        where: { id, ...where },
        data: {
          ...(input.nom !== undefined ? { nom: input.nom } : {}),
          ...(input.poste !== undefined ? { poste: input.poste } : {}),
          ...(input.actif === undefined ? {} : { dateFin: input.actif ? null : maintenant }),
          ...bumpVersion,
        },
      }),
    ...COO.version,
    regle: R,
  })
  const apres = await ligne(tx, id, maintenant)
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `rouleur:${String(id)}`,
    action: 'MODIFICATION_ROULEUR',
    parId: identity.userId,
    ancienneValeur: `${r.nom}${r.poste ? ` (${r.poste})` : ''}${actif(r, maintenant) ? '' : ' [désactivé]'}`,
    nouvelleValeur: `${apres.nom}${apres.poste ? ` (${apres.poste})` : ''}${apres.actif ? '' : ' [désactivé]'}`,
    complement: R,
  })
  return apres
}

// RG-COO-297 : un rouleur référencé (face de train, bague) ne se supprime pas : 409, désactivation seule.
export async function supprimerRouleur(tx: Tx, identity: Identity, id: number): Promise<void> {
  assertDroitCoordination(identity, 'referentiel.gerer', R)
  const r = await tx.rouleur.findUnique({
    where: { id },
    include: {
      atelier: { select: { id: true, plateformeId: true } },
      _count: { select: { faces: true, bagues: true } },
    },
  })
  if (!r) throw new NotFoundError(`Rouleur ${String(id)} introuvable`)
  assertPerimetreAtelier(identity, r.atelier)
  if (r._count.faces + r._count.bagues > 0)
    throw new ConflictError(
      `Le rouleur « ${r.nom} » est référencé (${String(r._count.faces)} face(s), ${String(r._count.bagues)} bague(s)) : désactivez-le plutôt que de le supprimer.`,
      { code: 'COO_ROULEUR_REFERENCE', regle: R },
    )
  await tx.rouleur.delete({ where: { id } })
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `rouleur:${String(id)}`,
    action: 'MODIFICATION_ROULEUR',
    parId: identity.userId,
    ancienneValeur: r.nom,
    nouvelleValeur: 'supprimé',
    complement: R,
  })
}
