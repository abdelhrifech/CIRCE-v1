// Étape 8 (D-05) — Référentiel des destinataires (ECR-ADM-07 « Destinataires et afficheurs », tr_destinataire,
// tr_dest_adresse, tr_ate_dest_trans) : liste, création manuelle, édition (libellé, dispatch O/N, mail, téléphone,
// adresse principale) et désactivation. Un destinataire n'est jamais supprimé (il est référencé par les lignes de
// préparation, les UM, les faces de train et les colis) ; le nom d'origine, clé d'intégration Broadcast
// (RG-COO-120), n'est pas modifiable. Les destinataires sont globaux (sans site) : seul l'administrateur les gère
// (`referentiel.gerer`). Le transport par défaut (tr_ate_dest_trans) est lu, pas édité (Geodis seul, ECR-ADM-06).
// Hypothèses : Q-403. Source : ECR-ADM-07, legacy-integrations.md §9, D-05 du PLAN.
import type {
  CreerDestinataire,
  DestinataireLigne,
  DestinatairesQuery,
  ModifierDestinataire,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { parPaquets } from '../../core/paquets.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { DestinataireAdresse, Prisma } from '../../generated/prisma/client.ts'
import { assertDroitCoordination, COO } from './permissions.ts'

type Client = Db | Tx
const R = 'RG-COO-120'

type Brut = Prisma.DestinataireGetPayload<Record<string, never>>

/** Lecture en lot (RG-COO-120) : adresse principale, transport par défaut et indicateur « utilisé » de chaque
 * destinataire, par paquets (limite SQLite de paramètres liés, ANO-035 / 049 / 050 / 051) et sans sous-requêtes par
 * ligne (une inclusion `_count` / `take` sur 1 400 destinataires prenait plus de 8 s). */
async function lignes(db: Client, destinataires: readonly Brut[]): Promise<DestinataireLigne[]> {
  const ids = destinataires.map((d) => d.id)
  const adresses = new Map<number, DestinataireAdresse>()
  for (const a of await parPaquets(ids, (paquet) =>
    db.destinataireAdresse.findMany({
      where: { destinataireId: { in: paquet } },
      orderBy: { id: 'asc' },
    }),
  ))
    if (!adresses.has(a.destinataireId)) adresses.set(a.destinataireId, a)
  // Transport par défaut (RG-COO-120) : seul le nombre de couples destinataire × atelier est affiché (le flux
  // Destinataires en crée un par atelier : plusieurs milliers de lignes en base de test).
  const transports = new Map<number, number>()
  for (const t of await parPaquets(ids, (paquet) =>
    db.transportDestinataire.groupBy({
      by: ['destinataireId'],
      where: { destinataireId: { in: paquet } },
      _count: { _all: true },
    }),
  ))
    transports.set(t.destinataireId, t._count._all)
  const utilises = new Set<number>()
  const lire = [
    (paquet: number[]) =>
      db.faceTrain.findMany({
        where: { destinataireId: { in: paquet } },
        select: { destinataireId: true },
        distinct: ['destinataireId'],
      }),
    (paquet: number[]) =>
      db.repartition.findMany({
        where: { destinataireId: { in: paquet } },
        select: { destinataireId: true },
        distinct: ['destinataireId'],
      }),
    (paquet: number[]) =>
      db.uniteManutention.findMany({
        where: { destinataireId: { in: paquet } },
        select: { destinataireId: true },
        distinct: ['destinataireId'],
      }),
    (paquet: number[]) =>
      db.colis.findMany({
        where: { destinataireId: { in: paquet } },
        select: { destinataireId: true },
        distinct: ['destinataireId'],
      }),
  ]
  for (const requete of lire)
    for (const r of await parPaquets(ids, requete))
      if (r.destinataireId !== null) utilises.add(r.destinataireId)
  return destinataires.map((d) => {
    const a = adresses.get(d.id)
    return {
      id: d.id,
      nomOrigine: d.nomOrigine,
      nom: d.nom ?? d.nomOrigine,
      actif: d.actif,
      dispatch: d.dispatch,
      mail: d.mail,
      telephone: d.telephone,
      adresse: a
        ? {
            adresse1: a.adresse1,
            adresse2: a.adresse2,
            codePostal: a.codePostal,
            localite: a.localite,
          }
        : null,
      nbTransports: transports.get(d.id) ?? 0,
      utilise: utilises.has(d.id),
      version: d.version,
    }
  })
}

async function ligne(db: Client, id: number): Promise<DestinataireLigne> {
  const d = await db.destinataire.findUnique({ where: { id } })
  if (!d) throw new NotFoundError(`Destinataire ${String(id)} introuvable`)
  const [l] = await lignes(db, [d])
  if (!l) throw new NotFoundError(`Destinataire ${String(id)} introuvable`)
  return l
}

const minuscule = (t: string) => t.trim().toLowerCase()

async function assertNomOrigineLibre(db: Client, nomOrigine: string): Promise<void> {
  const existants = await db.destinataire.findMany({ select: { nomOrigine: true } })
  if (existants.some((x) => minuscule(x.nomOrigine) === minuscule(nomOrigine)))
    throw new ConflictError(`Un destinataire « ${nomOrigine} » existe déjà.`, {
      code: 'COO_DESTINATAIRE_EXISTE',
      regle: R,
    })
}

// D-05 : liste (recherche sur le nom d'origine ou le libellé, filtre actif) ; lecture réservée au droit référentiel.
export async function listerDestinataires(
  db: Db,
  identity: Identity,
  q: DestinatairesQuery,
): Promise<{ destinataires: DestinataireLigne[] }> {
  assertDroitCoordination(identity, 'referentiel.gerer', R)
  const tous = await db.destinataire.findMany({
    where: q.actif === undefined ? {} : { actif: q.actif },
    orderBy: { nomOrigine: 'asc' },
  })
  const motif = q.q ? minuscule(q.q) : null
  const retenus = tous.filter(
    (d) =>
      motif === null ||
      minuscule(d.nomOrigine).includes(motif) ||
      minuscule(d.nom ?? '').includes(motif),
  )
  return { destinataires: await lignes(db, retenus) }
}

// D-05 : création manuelle (hors flux Broadcast) ; le nom d'origine est unique (HYPOTHÈSE Q-403 (2)).
export async function creerDestinataire(
  tx: Tx,
  identity: Identity,
  input: CreerDestinataire,
): Promise<DestinataireLigne> {
  assertDroitCoordination(identity, 'referentiel.gerer', R)
  await assertNomOrigineLibre(tx, input.nomOrigine)
  const cree = await tx.destinataire.create({
    data: {
      nomOrigine: input.nomOrigine,
      nom: input.nom ?? null,
      dispatch: input.dispatch ?? null,
      mail: input.mail ?? null,
      telephone: input.telephone ?? null,
      ...(input.adresse
        ? {
            adresses: {
              create: {
                adresse1: input.adresse.adresse1 ?? null,
                adresse2: input.adresse.adresse2 ?? null,
                codePostal: input.adresse.codePostal ?? null,
                localite: input.adresse.localite ?? null,
              },
            },
          }
        : {}),
    },
  })
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `destinataire:${String(cree.id)}`,
    action: 'CREATION_DESTINATAIRE',
    parId: identity.userId,
    nouvelleValeur: cree.nom ?? cree.nomOrigine,
    complement: R,
  })
  return ligne(tx, cree.id)
}

function resume(d: DestinataireLigne): string {
  return [
    d.nom,
    d.dispatch ? `dispatch ${d.dispatch}` : null,
    d.mail,
    d.telephone,
    d.actif ? null : 'désactivé',
  ]
    .filter(Boolean)
    .join(' · ')
}

// D-05 : modification et désactivation / réactivation sous verrou de version ; journal avant / après.
export async function modifierDestinataire(
  tx: Tx,
  identity: Identity,
  id: number,
  input: ModifierDestinataire,
): Promise<DestinataireLigne> {
  assertDroitCoordination(identity, 'referentiel.gerer', R)
  const avant = await ligne(tx, id)
  await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.destinataire.updateMany({
        where: { id, ...where },
        data: {
          ...(input.nom !== undefined ? { nom: input.nom } : {}),
          ...(input.dispatch !== undefined ? { dispatch: input.dispatch } : {}),
          ...(input.mail !== undefined ? { mail: input.mail } : {}),
          ...(input.telephone !== undefined ? { telephone: input.telephone } : {}),
          // Q-414 : modification manuelle du contact : le flux Broadcast ne l'écrase plus.
          ...(input.mail !== undefined || input.telephone !== undefined
            ? { contactModifie: true }
            : {}),
          ...(input.actif !== undefined ? { actif: input.actif } : {}),
          ...bumpVersion,
        },
      }),
    ...COO.version,
    regle: R,
  })
  if (input.adresse) {
    const a = input.adresse
    const donnees = {
      ...(a.adresse1 !== undefined ? { adresse1: a.adresse1 } : {}),
      ...(a.adresse2 !== undefined ? { adresse2: a.adresse2 } : {}),
      ...(a.codePostal !== undefined ? { codePostal: a.codePostal } : {}),
      ...(a.localite !== undefined ? { localite: a.localite } : {}),
    }
    const principale = await tx.destinataireAdresse.findFirst({
      where: { destinataireId: id },
      orderBy: { id: 'asc' },
    })
    if (principale)
      await tx.destinataireAdresse.update({
        where: { id: principale.id },
        data: { ...donnees, ...bumpVersion },
      })
    else await tx.destinataireAdresse.create({ data: { destinataireId: id, ...donnees } })
  }
  const apres = await ligne(tx, id)
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: `destinataire:${String(id)}`,
    action: 'MODIFICATION_DESTINATAIRE',
    parId: identity.userId,
    ancienneValeur: resume(avant),
    nouvelleValeur: resume(apres),
    complement: R,
  })
  return apres
}
