// REC-P10 — Paramètres « Règles métier › Réception » (RG-REC-178) et référentiels Imprimeurs / Livreurs
// (RG-REC-179). Réservés à l'administrateur (catalogue : parametrage.gerer, referentiel.gerer).
import type { ParametresEcriture, ParametresReception } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { lireParametreNombre, lireParametreTexte } from './parametres.ts'
import { assertDroitReception, assertPerimetreReception, REC } from './permissions.ts'

const CLES = {
  ecartReception: 'reception.ecartReception',
  purgeAttendues: 'reception.purgeAttendues',
  delaiControle: 'reception.delaiControle',
  comptageMorceau: 'reception.comptageMorceau',
  exemplairesFeuille: 'reception.exemplairesFeuille',
  alleeInconnues: 'reception.alleeInconnues',
} as const

// RG-REC-178 : lecture des paramètres (l'allée tampon est lue pour le site, Q-105).
export async function lireParametresReception(
  db: Db | Tx,
  identity: Identity,
  site: number | null,
): Promise<ParametresReception> {
  assertDroitReception(identity, 'parametrage.gerer')
  if (site !== null) assertPerimetreReception(identity, site)
  return {
    ecartReception: await lireParametreNombre(db, CLES.ecartReception),
    purgeAttendues: await lireParametreNombre(db, CLES.purgeAttendues),
    delaiControle: await lireParametreNombre(db, CLES.delaiControle),
    comptageMorceau: await lireParametreNombre(db, CLES.comptageMorceau),
    exemplairesFeuille: await lireParametreNombre(db, CLES.exemplairesFeuille),
    alleeInconnues: await lireParametreTexte(db, CLES.alleeInconnues, site ?? undefined),
  }
}

// RG-REC-178 : enregistrement (bornes validées par le schéma partagé, 400) ; s'applique aux prochains
// traitements ; chaque changement est journalisé. Q-105 : allée tampon par site, le reste global.
export async function ecrireParametresReception(
  tx: Tx,
  identity: Identity,
  site: number | null,
  ecriture: ParametresEcriture,
) {
  assertDroitReception(identity, 'parametrage.gerer')
  if (site !== null) assertPerimetreReception(identity, site)
  // RG-REC-009 : les valeurs lues par l'écran doivent être encore les valeurs en base (sinon 409).
  const { precedent, ...input } = ecriture
  const actuels = await lireParametresReception(tx, identity, site)
  if (
    (Object.keys(actuels) as (keyof ParametresReception)[]).some((k) => actuels[k] !== precedent[k])
  ) {
    throw new ConflictError('Les paramètres ont été modifiés entre-temps : rechargez.', REC.version)
  }
  for (const [champ, cle] of Object.entries(CLES) as [
    keyof ParametresReception,
    (typeof CLES)[keyof typeof CLES],
  ][]) {
    const plateformeId = champ === 'alleeInconnues' ? site : null
    const valeur =
      champ === 'alleeInconnues' ? input.alleeInconnues.toUpperCase() : String(input[champ])
    const existant = await tx.parametre.findFirst({ where: { cle, plateformeId } })
    if (existant?.valeur === valeur) continue
    if (existant) {
      await updateWithVersion({
        expectedVersion: existant.version,
        update: (where) =>
          tx.parametre.updateMany({
            where: { id: existant.id, ...where },
            data: { valeur, ...bumpVersion },
          }),
        ...REC.version,
      })
    } else {
      await tx.parametre.create({ data: { cle, plateformeId, valeur } })
    }
    await ecrireJournal(tx, {
      typeEntite: 'PARAMETRE',
      entiteId: plateformeId === null ? cle : `${cle}@${String(plateformeId)}`,
      action: 'MODIFICATION_PARAMETRE',
      parId: identity.userId,
      ancienneValeur: existant?.valeur ?? null,
      nouvelleValeur: valeur,
    })
  }
  return {
    parametres: await lireParametresReception(tx, identity, site),
    message: 'Seuil enregistré (s’applique aux prochaines préparations).',
  }
}

type Referentiel = 'imprimeurs' | 'livreurs'

function table(tx: Db | Tx, ref: Referentiel) {
  return ref === 'imprimeurs' ? tx.imprimeur : (tx.livreur as unknown as typeof tx.imprimeur)
}

// RG-REC-179 : référentiels (actifs et inactifs) pour l'administration.
export async function listerReferentiel(db: Db, identity: Identity, ref: Referentiel) {
  assertDroitReception(identity, 'referentiel.gerer')
  const lignes = await table(db, ref).findMany({ orderBy: { libelle: 'asc' } })
  return lignes.map((l) => ({ id: l.id, libelle: l.libelle, actif: l.actif, version: l.version }))
}

// RG-REC-179 : ajout par l'administrateur. HYPOTHÈSE Q-178 : libellé unique (casse ignorée) → 409.
export async function ajouterReferentiel(
  tx: Tx,
  identity: Identity,
  ref: Referentiel,
  libelle: string,
) {
  assertDroitReception(identity, 'referentiel.gerer')
  const existants = await table(tx, ref).findMany({ select: { libelle: true } })
  const normaliser = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('fr')
  if (existants.some((e) => normaliser(e.libelle) === normaliser(libelle))) {
    throw new ConflictError(`« ${libelle} » existe déjà.`, {
      code: 'REC_REFERENTIEL_DOUBLON',
      regle: 'RG-REC-179',
    })
  }
  const l = await table(tx, ref).create({ data: { libelle: libelle.trim() } })
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `${ref}:${String(l.id)}`,
    action: 'MODIFICATION_REFERENTIEL',
    parId: identity.userId,
    nouvelleValeur: l.libelle,
  })
  return { id: l.id, libelle: l.libelle, actif: l.actif, version: l.version }
}

// RG-REC-179 : désactivation / réactivation (jamais de suppression : les livraisons y font référence).
export async function changerEtatReferentiel(
  tx: Tx,
  identity: Identity,
  ref: Referentiel,
  id: number,
  input: { actif: boolean; version: number },
) {
  assertDroitReception(identity, 'referentiel.gerer')
  const l = await table(tx, ref).findUnique({ where: { id } })
  if (!l) throw new NotFoundError('Entrée de référentiel introuvable')
  const version = await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      table(tx, ref).updateMany({
        where: { id, ...where },
        data: { actif: input.actif, ...bumpVersion },
      }),
    ...REC.version,
  })
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `${ref}:${String(id)}`,
    action: 'MODIFICATION_REFERENTIEL',
    parId: identity.userId,
    ancienneValeur: l.actif ? 'actif' : 'inactif',
    nouvelleValeur: input.actif ? 'actif' : 'inactif',
  })
  return { id, libelle: l.libelle, actif: input.actif, version }
}
