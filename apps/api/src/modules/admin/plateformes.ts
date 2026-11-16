// Étape 8 (D-03) — Plateformes : coordonnées, mail de déblocage, id site CCF, mails de RÉCEPTION et imprimantes cibles
// (RG-ADM-040 à 044 provisoires, legacy-admin.md §E). Aucun envoi de mail, aucune impression ici (Q-375, Q-002) :
// la configuration est tenue pour que ces fonctions la lisent. Droit `parametrage.gerer` (administrateur seul), vérifié
// dans le service. Hypothèses : Q-407. Jamais de création ni de suppression de plateforme (RG-ADM-040).
import type { ModifierPlateforme, PlateformeAdmin, PlateformesAdmin } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { ADM, assertDroitAdmin } from './permissions.ts'

type Client = Db | Tx
const DROIT = 'parametrage.gerer'

const include = {
  mailsReception: { orderBy: { adresse: 'asc' as const } },
  imprimantes: { orderBy: [{ nom: 'asc' as const }, { id: 'asc' as const }] },
}

type Brut = NonNullable<Awaited<ReturnType<Db['plateforme']['findFirst']>>> & {
  mailsReception: { id: number; adresse: string }[]
  imprimantes: { id: number; nom: string; actif: boolean; version: number }[]
}

function vue(p: Brut): PlateformeAdmin {
  return {
    id: p.id,
    nom: p.nom,
    adresse1: p.adresse1,
    adresse2: p.adresse2,
    codePostal: p.codePostal,
    localite: p.localite,
    telephone: p.telephone,
    mailDeblocage: p.mail,
    idSiteCcf: p.idSiteCcf,
    mailsReception: p.mailsReception.map((m) => ({ id: m.id, adresse: m.adresse })),
    imprimantes: p.imprimantes.map((i) => ({
      id: i.id,
      nom: i.nom,
      actif: i.actif,
      version: i.version,
    })),
    version: p.version,
  }
}

async function lire(db: Client, id: number): Promise<PlateformeAdmin> {
  const p = await db.plateforme.findUnique({ where: { id }, include })
  if (!p) throw new NotFoundError('Plateforme introuvable', { code: 'ADM_PLATEFORME_INTROUVABLE' })
  return vue(p)
}

const minuscule = (t: string) => t.trim().toLowerCase()

// RG-ADM-040 : liste des plateformes avec leurs imprimantes et leurs mails (200 premières par nom, filtre texte).
export async function listerPlateformes(
  db: Client,
  identity: Identity,
  q: { q?: string | undefined },
): Promise<PlateformesAdmin> {
  assertDroitAdmin(identity, DROIT)
  const where = q.q ? { OR: [{ nom: { contains: q.q } }, { localite: { contains: q.q } }] } : {}
  const [lignes, total] = await Promise.all([
    db.plateforme.findMany({
      where,
      orderBy: [{ nom: 'asc' }, { id: 'asc' }],
      take: 200,
      include,
    }),
    db.plateforme.count({ where }),
  ])
  return { plateformes: lignes.map(vue), total }
}

// RG-ADM-040 : modification des coordonnées sous verrou de version (les champs absents sont conservés ; les
// longueurs de colonnes d'existant sont contrôlées par le schéma, 400, au lieu d'une erreur SQL de troncature).
// RG-ADM-044 : le mail de déblocage (plt_mail) et le mail de réception (liste) restent deux champs distincts.
export async function modifierPlateforme(
  tx: Tx,
  identity: Identity,
  id: number,
  input: ModifierPlateforme,
): Promise<PlateformeAdmin> {
  assertDroitAdmin(identity, DROIT)
  const avant = await lire(tx, id)
  const { version, mailDeblocage, ...champs } = input
  await updateWithVersion({
    expectedVersion: version,
    update: (where) =>
      tx.plateforme.updateMany({
        where: { id, ...where },
        data: {
          ...champs,
          ...(mailDeblocage !== undefined ? { mail: mailDeblocage } : {}),
          ...bumpVersion,
        },
      }),
    ...ADM.version,
  })
  const apres = await lire(tx, id)
  const extrait = (p: PlateformeAdmin) => ({
    nom: p.nom,
    adresse1: p.adresse1,
    adresse2: p.adresse2,
    codePostal: p.codePostal,
    localite: p.localite,
    telephone: p.telephone,
    mailDeblocage: p.mailDeblocage,
    idSiteCcf: p.idSiteCcf,
  })
  await ecrireJournal(tx, {
    typeEntite: 'PLATEFORME',
    entiteId: id,
    action: 'MODIFICATION_PLATEFORME',
    parId: identity.userId,
    donnees: { avant: extrait(avant), apres: extrait(apres) },
  })
  return apres
}

// RG-ADM-042 : ajout d'une adresse de réception (normalisée en minuscules ; doublon sur la plateforme → 409 ;
// syntaxe vérifiée par le schéma : l'existant n'imposait aucun contrôle, Q-407 (3)).
export async function ajouterMailPlateforme(
  tx: Tx,
  identity: Identity,
  plateformeId: number,
  adresse: string,
): Promise<PlateformeAdmin> {
  assertDroitAdmin(identity, DROIT)
  await lire(tx, plateformeId)
  const existant = await tx.plateformeMail.findFirst({ where: { plateformeId, adresse } })
  if (existant)
    throw new ConflictError(`L’adresse « ${adresse} » existe déjà pour cette plateforme.`, {
      code: 'ADM_MAIL_EXISTE',
      regle: 'RG-ADM-042',
    })
  const m = await tx.plateformeMail.create({
    data: { plateformeId, adresse, createdById: identity.userId },
  })
  await ecrireJournal(tx, {
    typeEntite: 'PLATEFORME',
    entiteId: plateformeId,
    action: 'CREATION_MAIL_PLATEFORME',
    parId: identity.userId,
    nouvelleValeur: m.adresse,
  })
  return lire(tx, plateformeId)
}

// RG-ADM-042 : suppression physique d'une adresse (comme l'existant), mais seulement si elle appartient à la
// plateforme demandée (l'existant ne le contrôlait pas) : sinon 404.
export async function supprimerMailPlateforme(
  tx: Tx,
  identity: Identity,
  plateformeId: number,
  mailId: number,
): Promise<PlateformeAdmin> {
  assertDroitAdmin(identity, DROIT)
  await lire(tx, plateformeId)
  const m = await tx.plateformeMail.findFirst({ where: { id: mailId, plateformeId } })
  if (!m) throw new NotFoundError('Adresse introuvable', { code: 'ADM_MAIL_INTROUVABLE' })
  await tx.plateformeMail.delete({ where: { id: mailId } })
  await ecrireJournal(tx, {
    typeEntite: 'PLATEFORME',
    entiteId: plateformeId,
    action: 'SUPPRESSION_MAIL_PLATEFORME',
    parId: identity.userId,
    ancienneValeur: m.adresse,
  })
  return lire(tx, plateformeId)
}

// RG-ADM-040 / 041 : ajout d'une imprimante cible (nom obligatoire, unique par plateforme casse ignorée : l'existant
// insérait même un nom vide, Q-407 (4)).
export async function ajouterImprimante(
  tx: Tx,
  identity: Identity,
  plateformeId: number,
  nom: string,
): Promise<PlateformeAdmin> {
  assertDroitAdmin(identity, DROIT)
  await lire(tx, plateformeId)
  const existantes = await tx.plateformeImprimante.findMany({
    where: { plateformeId },
    select: { nom: true },
  })
  if (existantes.some((e) => minuscule(e.nom) === minuscule(nom)))
    throw new ConflictError(`L’imprimante « ${nom} » existe déjà pour cette plateforme.`, {
      code: 'ADM_IMPRIMANTE_EXISTE',
      regle: 'RG-ADM-040',
    })
  const i = await tx.plateformeImprimante.create({ data: { plateformeId, nom } })
  await ecrireJournal(tx, {
    typeEntite: 'PLATEFORME',
    entiteId: plateformeId,
    action: 'CREATION_IMPRIMANTE',
    parId: identity.userId,
    nouvelleValeur: i.nom,
  })
  return lire(tx, plateformeId)
}

// RG-ADM-040 : jamais de suppression d'imprimante (existant) ; désactivation / réactivation sous verrou de version
// (Q-407 (4)). RG-ADM-041 : seules les imprimantes actives sont des cibles d'impression.
export async function changerEtatImprimante(
  tx: Tx,
  identity: Identity,
  plateformeId: number,
  imprimanteId: number,
  input: { actif: boolean; version: number },
): Promise<PlateformeAdmin> {
  assertDroitAdmin(identity, DROIT)
  await lire(tx, plateformeId)
  const i = await tx.plateformeImprimante.findFirst({ where: { id: imprimanteId, plateformeId } })
  if (!i) throw new NotFoundError('Imprimante introuvable', { code: 'ADM_IMPRIMANTE_INTROUVABLE' })
  await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.plateformeImprimante.updateMany({
        where: { id: imprimanteId, ...where },
        data: { actif: input.actif, ...bumpVersion },
      }),
    ...ADM.version,
  })
  await ecrireJournal(tx, {
    typeEntite: 'PLATEFORME',
    entiteId: plateformeId,
    action: 'MODIFICATION_IMPRIMANTE',
    parId: identity.userId,
    ancienneValeur: i.actif ? 'actif' : 'inactif',
    nouvelleValeur: input.actif ? 'actif' : 'inactif',
    complement: i.nom,
  })
  return lire(tx, plateformeId)
}

/** RG-ADM-041 : imprimantes ACTIVES d'une plateforme = cibles de l'impression directe de l'étiquette rack
 * (lecture à disposition de l'impression, Q-002 : aucun agent d'impression n'est appelé ici). */
export async function imprimantesCibles(db: Client, plateformeId: number): Promise<string[]> {
  const l = await db.plateformeImprimante.findMany({
    where: { plateformeId, actif: true },
    orderBy: { nom: 'asc' },
  })
  return l.map((i) => i.nom)
}

/** RG-ADM-043 : adresses de réception d'une plateforme (destinataires du futur mail de réception, Q-375). */
export async function mailsReception(db: Client, plateformeId: number): Promise<string[]> {
  const l = await db.plateformeMail.findMany({
    where: { plateformeId },
    orderBy: { adresse: 'asc' },
  })
  return l.map((m) => m.adresse)
}
