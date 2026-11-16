// Étape 8 (D-06) — Gestion des paramètres métier (ECR-ADM-05 « Règles métier », EX-TRA-041) : lecture de tous les
// paramètres lus par Réception et Coordination, modification validée par format (bornes, énumérations, identifiants
// d'ateliers / de types existants), verrou de version, journal et historique. Paramètres globaux uniquement
// (l'allée des inconnues, réglée par site, reste dans l'écran Réception, Q-105). Aucune valeur initiale n'est
// supposée : la valeur affichée est la valeur du seed (issue des règles), les listes d'identifiants legacy restent
// vides tant que l'administrateur ne les saisit pas (Q-319). Hypothèses : Q-405.
import {
  PARAMETRES_ADMIN,
  type DefinitionParametre,
  type FormatParametre,
  type ParametreAdmin,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError, ValidationError, BusinessError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { PARAMETRES_REF } from '../../reference/seed-ref.ts'
import { ADM, assertDroitAdmin } from './permissions.ts'

type Client = Db | Tx

const defaut = (cle: string) => PARAMETRES_REF.find((p) => p.cle === cle)

function formatPublic(f: FormatParametre): ParametreAdmin['format'] {
  switch (f.type) {
    case 'entier':
      return { type: f.type, min: f.min, max: f.max, ...(f.unite ? { unite: f.unite } : {}) }
    case 'decimal':
      return { type: f.type, min: f.min, max: f.max }
    case 'enum':
      return { type: f.type, valeurs: [...f.valeurs] }
    case 'structure':
      return { type: f.type, raison: f.raison }
    default:
      return { type: f.type }
  }
}

function ligne(
  d: DefinitionParametre,
  row: { valeur: string; version: number; updatedAt: Date } | undefined,
): ParametreAdmin {
  const ref = defaut(d.cle)
  return {
    cle: d.cle,
    groupe: d.groupe,
    libelle: d.libelle,
    valeur: row?.valeur ?? ref?.valeur ?? '',
    valeurParDefaut: ref?.valeur ?? '',
    description: ref?.description ?? null,
    source: d.source,
    format: formatPublic(d.format),
    modifiable: d.format.type !== 'structure',
    version: row?.version ?? 0,
    modifieLe: row ? row.updatedAt.toISOString() : null,
  }
}

// EX-TRA-041 / ECR-ADM-05 : tous les paramètres (valeur courante, valeur initiale, format, source).
export async function listerParametres(db: Client, identity: Identity) {
  assertDroitAdmin(identity, 'parametrage.gerer')
  const rows = await db.parametre.findMany({ where: { plateformeId: null } })
  const parCle = new Map(rows.map((r) => [r.cle, r]))
  return { parametres: PARAMETRES_ADMIN.map((d) => ligne(d, parCle.get(d.cle))) }
}

const invalide = (message: string, details?: unknown) =>
  new ValidationError(message, { code: 'ADM_PARAMETRE_INVALIDE', details })

async function identifiantsExistants(
  db: Client,
  format: 'liste-ateliers' | 'liste-types-preparation',
  ids: number[],
): Promise<Set<number>> {
  if (ids.length === 0) return new Set()
  const rows =
    format === 'liste-ateliers'
      ? await db.atelier.findMany({ where: { id: { in: ids } }, select: { id: true } })
      : await db.typePreparation.findMany({ where: { id: { in: ids } }, select: { id: true } })
  return new Set(rows.map((r) => r.id))
}

/** Valide et normalise la valeur saisie selon le format du paramètre (400 ADM_PARAMETRE_INVALIDE). */
export async function validerValeur(
  db: Client,
  d: DefinitionParametre,
  brute: string,
): Promise<string> {
  const f = d.format
  const v = brute.trim()
  switch (f.type) {
    case 'entier': {
      if (!/^-?\d+$/.test(v)) throw invalide(`« ${d.libelle} » : un nombre entier est attendu.`)
      const nombre = Number(v)
      if (nombre < f.min || nombre > f.max)
        throw invalide(`« ${d.libelle} » : entre ${String(f.min)} et ${String(f.max)}.`, {
          min: f.min,
          max: f.max,
        })
      return String(nombre)
    }
    case 'decimal': {
      if (!/^\d+([.]\d+)?$/.test(v))
        throw invalide(`« ${d.libelle} » : un nombre est attendu (point décimal).`)
      const nombre = Number(v)
      if (nombre < f.min || nombre > f.max)
        throw invalide(`« ${d.libelle} » : entre ${String(f.min)} et ${String(f.max)}.`, {
          min: f.min,
          max: f.max,
        })
      return String(nombre)
    }
    case 'enum': {
      if (!f.valeurs.includes(v))
        throw invalide(`« ${d.libelle} » : ${f.valeurs.join(' ou ')}.`, { valeurs: f.valeurs })
      return v
    }
    case 'liste-ateliers':
    case 'liste-types-preparation': {
      if (v === '') return ''
      const morceaux = v.split(';').map((x) => x.trim())
      if (morceaux.some((x) => !/^[1-9]\d*$/.test(x)))
        throw invalide(`« ${d.libelle} » : identifiants entiers séparés par « ; ».`)
      const ids = morceaux.map(Number)
      if (new Set(ids).size !== ids.length)
        throw invalide(`« ${d.libelle} » : un identifiant est répété.`)
      const connus = await identifiantsExistants(db, f.type, ids)
      const inconnus = ids.filter((i) => !connus.has(i))
      if (inconnus.length > 0)
        throw invalide(
          `« ${d.libelle} » : ${f.type === 'liste-ateliers' ? 'atelier' : 'type de préparation'} inconnu (${inconnus.join(', ')}).`,
          { inconnus },
        )
      return ids.join(';')
    }
    case 'horaires': {
      if (v === '') return ''
      const morceaux = v.split(';').map((x) => x.trim())
      const mauvais = morceaux.filter((x) => !/^([01]?\d|2[0-3]):[0-5]\d$/.test(x))
      if (mauvais.length > 0)
        throw invalide(`« ${d.libelle} » : horaires « HH:MM » séparés par « ; » (24 h).`, {
          mauvais,
        })
      const normalises = morceaux.map((x) => x.padStart(5, '0'))
      if (new Set(normalises).size !== normalises.length)
        throw invalide(`« ${d.libelle} » : un horaire est répété.`)
      return [...normalises].sort().join(';')
    }
    case 'structure':
      throw new BusinessError(`« ${d.libelle} » n’est pas modifiable ici.`, {
        code: 'ADM_PARAMETRE_NON_MODIFIABLE',
      })
  }
}

// EX-TRA-041 : modification d'un paramètre global. `version` = version lue (0 si la valeur initiale du seed n'a
// jamais été écrite) : 409 si elle a changé. Une valeur identique n'écrit rien. Journalisé (ancienne → nouvelle).
export async function modifierParametre(
  tx: Tx,
  identity: Identity,
  cle: string,
  input: { valeur: string; version: number },
): Promise<ParametreAdmin> {
  assertDroitAdmin(identity, 'parametrage.gerer')
  const d = PARAMETRES_ADMIN.find((p) => p.cle === cle)
  if (!d) throw new NotFoundError(`Paramètre « ${cle} » inconnu`, { code: 'ADM_PARAMETRE_INCONNU' })
  const valeur = await validerValeur(tx, d, input.valeur)
  const existant = await tx.parametre.findFirst({ where: { cle, plateformeId: null } })
  if (!existant) {
    if (input.version !== 0)
      throw new ConflictError('Le paramètre a été modifié entre-temps : rechargez.', ADM.version)
    const ref = defaut(cle)
    // Aucune valeur n'est écrite si elle est identique à la valeur initiale (rien à journaliser).
    if (valeur === (ref?.valeur ?? '')) return ligne(d, undefined)
    try {
      const cree = await tx.parametre.create({
        data: { cle, plateformeId: null, valeur, description: ref?.description ?? null },
      })
      await ecrireJournal(tx, {
        typeEntite: 'PARAMETRE',
        entiteId: cle,
        action: 'MODIFICATION_PARAMETRE',
        parId: identity.userId,
        ancienneValeur: ref?.valeur ?? null,
        nouvelleValeur: valeur,
      })
      return ligne(d, cree)
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictError('Le paramètre a été modifié entre-temps : rechargez.', ADM.version)
      throw e
    }
  }
  if (valeur === existant.valeur) {
    if (existant.version !== input.version)
      throw new ConflictError('Le paramètre a été modifié entre-temps : rechargez.', ADM.version)
    return ligne(d, existant)
  }
  const version = await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.parametre.updateMany({
        where: { id: existant.id, ...where },
        data: { valeur, ...bumpVersion },
      }),
    ...ADM.version,
  })
  await ecrireJournal(tx, {
    typeEntite: 'PARAMETRE',
    entiteId: cle,
    action: 'MODIFICATION_PARAMETRE',
    parId: identity.userId,
    ancienneValeur: existant.valeur,
    nouvelleValeur: valeur,
  })
  return ligne(d, { valeur, version, updatedAt: new Date() })
}

// EX-TRA-041 / ECR-ADM-08 : historique des modifications d'un paramètre (50 dernières, plus récente d'abord).
export async function historiqueParametre(db: Client, identity: Identity, cle: string) {
  assertDroitAdmin(identity, 'parametrage.gerer')
  if (!PARAMETRES_ADMIN.some((p) => p.cle === cle))
    throw new NotFoundError(`Paramètre « ${cle} » inconnu`, { code: 'ADM_PARAMETRE_INCONNU' })
  const lignes = await db.journalAudit.findMany({
    where: {
      typeEntite: 'PARAMETRE',
      OR: [{ entiteId: cle }, { entiteId: { startsWith: `${cle}@` } }],
    },
    orderBy: [{ le: 'desc' }, { id: 'desc' }],
    take: 50,
    include: { par: { select: { nom: true, identifiantExterne: true } } },
  })
  return {
    cle,
    historique: lignes.map((j) => ({
      le: j.le.toISOString(),
      par: j.par ? (j.par.nom ?? j.par.identifiantExterne) : null,
      ancienneValeur: j.ancienneValeur,
      nouvelleValeur: j.nouvelleValeur,
    })),
  }
}
