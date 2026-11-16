// Étape 8 (D-08) — Configuration des règles d'alerte (ECR-ADM-04 « Alertes et mails », RG-REC-190, EX-TRA-029) : pour
// chaque type d'alerte, le canal et les rôles destinataires sont configurables ; le déclencheur et le seuil sont
// affichés en lecture seule (le seuil réel est un paramètre métier, D-06). AUCUN mail n'est envoyé (Q-375) : les canaux
// « mail » et « digest » sont enregistrés sans effet. Effets réels, dans Pilotage › Alertes : « Désactivée » masque le
// type ; des destinataires configurés remplacent ceux calculés. Droit `parametrage.gerer`. Hypothèses : Q-408.
import {
  CATALOGUE_ALERTES,
  LIBELLES_DESTINATAIRES,
  LIBELLES_TYPES_ALERTE,
  ROLES,
  TYPES_ALERTE,
  type CanalAlerte,
  type ModifierRegleAlerte,
  type RegleAlerteAdmin,
  type Role,
  type TypeAlerte,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { ADM, assertDroitAdmin } from './permissions.ts'

type Client = Db | Tx
const R = 'RG-REC-190'
const CANAL_DEFAUT: CanalAlerte = 'BANDEAU'

const lireRoles = (s: string): Role[] => ROLES.filter((r) => s.split(';').includes(r))

async function valeurSeuil(db: Client, cle: string | undefined): Promise<string | null> {
  if (!cle) return null
  const p = await db.parametre.findFirst({ where: { cle, plateformeId: null } })
  return p?.valeur ?? null
}

async function vue(db: Client, type: TypeAlerte): Promise<RegleAlerteAdmin> {
  const cat = CATALOGUE_ALERTES[type]
  const ligne = await db.regleAlerte.findUnique({ where: { type } })
  return {
    type,
    libelle: LIBELLES_TYPES_ALERTE[type],
    declencheur: cat.declencheur,
    seuil: cat.seuil,
    valeurSeuil: await valeurSeuil(db, cat.parametre),
    regles: cat.regles,
    calculee: cat.calculee,
    canal: (ligne?.canal as CanalAlerte | undefined) ?? CANAL_DEFAUT,
    destinataires: ligne ? lireRoles(ligne.destinataires) : [],
    version: ligne?.version ?? 0,
  }
}

// RG-REC-190 : les 18 types, dans l'ordre du catalogue, avec la configuration courante (défauts si jamais modifiée).
export async function listerReglesAlerte(db: Client, identity: Identity) {
  assertDroitAdmin(identity, 'parametrage.gerer')
  const lignes = await db.regleAlerte.findMany()
  const parType = new Map(lignes.map((l) => [l.type, l]))
  const regles: RegleAlerteAdmin[] = []
  for (const type of TYPES_ALERTE) {
    const cat = CATALOGUE_ALERTES[type]
    const l = parType.get(type)
    regles.push({
      type,
      libelle: LIBELLES_TYPES_ALERTE[type],
      declencheur: cat.declencheur,
      seuil: cat.seuil,
      valeurSeuil: await valeurSeuil(db, cat.parametre),
      regles: cat.regles,
      calculee: cat.calculee,
      canal: (l?.canal as CanalAlerte | undefined) ?? CANAL_DEFAUT,
      destinataires: l ? lireRoles(l.destinataires) : [],
      version: l?.version ?? 0,
    })
  }
  return { regles }
}

// RG-REC-190 : modification du canal et des destinataires sous verrou de version (0 = première configuration :
// création ; une autre session l'ayant déjà créée → 409). Journalisée dans la même transaction.
export async function modifierRegleAlerte(
  tx: Tx,
  identity: Identity,
  type: TypeAlerte,
  input: ModifierRegleAlerte,
): Promise<RegleAlerteAdmin> {
  assertDroitAdmin(identity, 'parametrage.gerer')
  const avant = await vue(tx, type)
  const destinataires = ROLES.filter((r) => input.destinataires.includes(r)).join(';')
  if (input.version === 0) {
    if (avant.version !== 0)
      throw new ConflictError('Cette règle a été modifiée par un autre utilisateur : rechargez.', {
        code: ADM.version.code,
        regle: ADM.version.regle,
      })
    await tx.regleAlerte.create({
      data: { type, canal: input.canal, destinataires, updatedById: identity.userId },
    })
  } else {
    await updateWithVersion({
      expectedVersion: input.version,
      update: (where) =>
        tx.regleAlerte.updateMany({
          where: { type, ...where },
          data: {
            canal: input.canal,
            destinataires,
            updatedById: identity.userId,
            ...bumpVersion,
          },
        }),
      ...ADM.version,
    })
  }
  const apres = await vue(tx, type)
  await ecrireJournal(tx, {
    typeEntite: 'REGLE_ALERTE',
    entiteId: type,
    action: 'MODIFICATION_REGLE_ALERTE',
    parId: identity.userId,
    ancienneValeur: avant.canal,
    nouvelleValeur: apres.canal,
    complement: R,
    donnees: { avant: avant.destinataires, apres: apres.destinataires },
  })
  return apres
}

/** RG-REC-190 : applique la configuration aux alertes calculées de Pilotage › Alertes : type « Désactivée » retiré,
 * destinataires configurés substitués aux destinataires calculés. Sans configuration : alertes inchangées. */
export async function appliquerReglesAlerte<
  A extends { type: TypeAlerte; destinataires: string[] },
>(db: Client, alertes: A[]): Promise<A[]> {
  const lignes = await db.regleAlerte.findMany()
  if (lignes.length === 0) return alertes
  const parType = new Map(lignes.map((l) => [l.type, l]))
  const resultat: A[] = []
  for (const a of alertes) {
    const l = parType.get(a.type)
    if (!l) {
      resultat.push(a)
      continue
    }
    if (l.canal === 'DESACTIVEE') continue
    const roles = lireRoles(l.destinataires)
    resultat.push(
      roles.length > 0 ? { ...a, destinataires: roles.map((r) => LIBELLES_DESTINATAIRES[r]) } : a,
    )
  }
  return resultat
}
