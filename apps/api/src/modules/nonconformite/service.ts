import type { ConstatNc } from '@circe/shared'
import { z } from 'zod'
import {
  NC_DECISIONS,
  NC_TYPES,
  NC_TYPES_AGENCE,
  NcDonneesSchema,
  porteeNc,
  statutNc,
  type DeclarerNc,
  type DeciderNc,
  type Nc,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import type { Identity } from '../../core/identity.ts'
import {
  assertPermission,
  assertPlateforme,
  hasPermission,
} from '../../core/permissions/permissions.ts'
import {
  BusinessError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/errors.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Prisma } from '../../generated/prisma/client.ts'

type Client = Db | Tx
const include = {
  fichiers: { select: { id: true, nom: true, taille: true, mimeType: true } },
} satisfies Prisma.NonConformiteInclude
const idsSchema = z.array(z.number().int())
const decisionsSchema = z.array(z.enum(NC_DECISIONS))
const scope = (i: Identity) =>
  i.siteId !== null
    ? { plateformeId: i.siteId }
    : i.perimetre.toutesPlateformes
      ? {}
      : { plateformeId: { in: i.perimetre.plateformeIds } }
function verifierSite(i: Identity, plateformeId: number) {
  assertPlateforme(i, plateformeId)
  if (i.siteId !== null && i.siteId !== plateformeId)
    throw new ForbiddenError('Sélectionnez le site de cette déclaration dans le bandeau.')
}
async function publique(
  db: Client,
  row: Prisma.NonConformiteGetPayload<{ include: typeof include }>,
): Promise<Nc> {
  const [plateforme, auteur] = await Promise.all([
    db.plateforme.findUniqueOrThrow({ where: { id: row.plateformeId } }),
    db.utilisateur.findUniqueOrThrow({ where: { id: row.createdById } }),
  ])
  const decisions = decisionsSchema.parse(JSON.parse(row.decisions))
  return {
    id: row.id,
    version: row.version,
    plateformeId: row.plateformeId,
    plateforme: plateforme.nom,
    type: row.type === 'AGENCE' ? 'AGENCE' : 'RECEPTION',
    origine: row.origine,
    receptionId: row.receptionId,
    afficheIds: idsSchema.parse(JSON.parse(row.afficheIds)),
    bloquante: row.bloquante,
    donnees: NcDonneesSchema.parse(JSON.parse(row.donnees)),
    decisions,
    statut: statutNc(row.bloquante, decisions),
    creeLe: row.createdAt.toISOString(),
    modifieLe: row.updatedAt.toISOString(),
    auteur: auteur.nom ?? auteur.identifiantExterne,
    commentaireDecision: row.commentaireDecision,
    fichiers: row.fichiers,
  }
}
// EX-NEW-NC-001 : listes partagées, filtrées côté serveur par plateforme et profil.
export async function listerNc(db: Client, identity: Identity, type?: 'RECEPTION' | 'AGENCE') {
  assertPermission(identity, 'nonconformite.consulter')
  const rows = await db.nonConformite.findMany({
    where: { ...scope(identity), ...(type ? { type } : {}) },
    include,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  return { items: await Promise.all(rows.map((row) => publique(db, row))) }
}
// RG-NEW-NC-002 : la réception constate ; portée déterminée par les items, décisions humaines.
export async function declarerNc(tx: Tx, identity: Identity, input: DeclarerNc): Promise<Nc> {
  assertPermission(identity, 'nonconformite.declarer')
  verifierSite(identity, input.plateformeId)
  if (!(await tx.plateforme.findUnique({ where: { id: input.plateformeId } })))
    throw new NotFoundError('Plateforme introuvable.')
  if (input.receptionId && input.type !== 'RECEPTION')
    throw new BusinessError('Une réception alimente le suivi NC réception.')
  if (!input.receptionId && input.afficheIds.length)
    throw new BusinessError('Une affiche déclarée doit appartenir à une réception.')
  const d = input.donnees
  let origine = 'Formulaire',
    bloquante = input.bloquante
  const obligatoires: [string, string][] = [
    ['annonceur', d.annonceur],
    ['theme', d.theme],
  ]
  if (input.receptionId) {
    const rec = await tx.reception.findUnique({ where: { id: input.receptionId } })
    if (!rec || rec.plateformeId !== input.plateformeId)
      throw new BusinessError('La réception ne correspond pas à la plateforme.')
    const ids = [...new Set(input.afficheIds)]
    const affiches = await tx.affiche.findMany({
      where: {
        id: { in: ids },
        plateformeId: input.plateformeId,
        OR: [
          { receptionId: rec.id },
          { livraisons: { some: { livraisonId: rec.livraisonId ?? -1 } } },
        ],
      },
    })
    if (!ids.length || affiches.length !== ids.length)
      throw new BusinessError('Choisissez au moins une affiche de cette réception.')
    if (!d.types.length || d.types.some((t) => !(NC_TYPES as readonly string[]).includes(t)))
      throw new BusinessError('Choisissez les non-conformités constatées.')
    bloquante = porteeNc(d.types) ?? input.bloquante
    if (bloquante === null)
      throw new BusinessError('Précisez la portée : bloquante ou non bloquante.')
    origine = rec.estInconnue ? 'Réception inconnue' : 'Réception'
  } else if (input.type === 'AGENCE') {
    obligatoires.push(
      ['déclarant', d.declarant],
      ['région', d.region],
      ['afficheur', d.afficheur],
      ['dossier BC', d.dossier],
      ['date d’affichage', d.dateAff],
    )
    if (!d.types.length || d.types.some((t) => !(NC_TYPES_AGENCE as readonly string[]).includes(t)))
      throw new BusinessError('Choisissez le type de non-conformité agence.')
    if (!['Nord', 'Sud', 'Est', 'Ouest'].includes(d.region))
      throw new BusinessError('Région inconnue.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dateAff) || Number.isNaN(Date.parse(d.dateAff)))
      throw new BusinessError('Date d’affichage invalide.')
  } else {
    obligatoires.push(
      ['imprimeur', d.imprimeur],
      ['transporteur', d.transporteur],
      ['présence avarie', d.avarie],
    )
    if (!d.controle.length) throw new BusinessError('Choisissez le contrôle réception.')
  }
  if (!input.receptionId) {
    if (!d.formats.length) throw new BusinessError('Choisissez au moins un format.')
    if (d.imprimeur === 'AUTRE') obligatoires.push(['imprimeur autre', d.imprimeurAutre])
    if (d.transporteur === 'AUTRE') obligatoires.push(['transporteur autre', d.transporteurAutre])
  }
  const manques = obligatoires.filter(([, v]) => !v.trim()).map(([l]) => l)
  if (manques.length) throw new BusinessError(`À remplir : ${manques.join(', ')}.`)
  if (d.declarant) {
    const refs = await lireDeclarants(tx, identity)
    if (!refs.noms.includes(d.declarant))
      throw new BusinessError('Le déclarant doit appartenir au référentiel Administration.')
  }
  // Champs conditionnels nettoyés ; aucun statut ni décision ne peut être injecté par le formulaire.
  const donnees = {
    ...d,
    gestionnaire: '',
    admin: '',
    decisionPlateforme: '',
    actionPreprod: '',
    actionPlateforme: '',
    detailVisuel: d.controle.includes('Contrôle du visuel') ? d.detailVisuel : [],
    statutEtat: d.controle.includes('Etat des affiches') ? d.statutEtat : '',
    imprimeurAutre: d.imprimeur === 'AUTRE' ? d.imprimeurAutre : '',
    transporteurAutre: d.transporteur === 'AUTRE' ? d.transporteurAutre : '',
  }
  const fichiers = input.fichiers.map((f) => {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(f.contenuBase64))
      throw new ValidationError('Fichier illisible.')
    const contenu = Buffer.from(f.contenuBase64, 'base64')
    if (!contenu.length || contenu.length > 10 * 1024 * 1024)
      throw new ValidationError('Justificatif vide ou supérieur à 10 Mo.')
    return {
      nom: f.nom,
      mimeType: f.mimeType || 'application/octet-stream',
      taille: contenu.length,
      contenu,
    }
  })
  const row = await tx.nonConformite.create({
    data: {
      plateformeId: input.plateformeId,
      type: input.type,
      origine,
      receptionId: input.receptionId ?? null,
      afficheIds: JSON.stringify([...new Set(input.afficheIds)]),
      bloquante,
      donnees: JSON.stringify(donnees),
      createdById: identity.userId,
      fichiers: { create: fichiers },
    },
    include,
  })
  const resultat = await publique(tx, row)
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'NON_CONFORMITE',
    entiteId: row.id,
    ancien: null,
    nouveau: resultat.statut,
    parId: identity.userId,
    regle: 'RG-NEW-NC-002',
  })
  await ecrireJournal(tx, {
    typeEntite: 'NON_CONFORMITE',
    entiteId: row.id,
    action: 'NON_CONFORMITE',
    parId: identity.userId,
    nouvelleValeur: row.donnees,
    complement: `Déclaration ${origine} ; ${resultat.statut}`,
  })
  return resultat
}
// RG-NEW-NC-002 : la Pré-Prod décide ; la plateforme confirme seulement le traitement demandé.
export async function deciderNc(tx: Tx, identity: Identity, id: number, input: DeciderNc) {
  const row = await tx.nonConformite.findUnique({ where: { id }, include })
  if (!row) throw new NotFoundError('Non-conformité introuvable.')
  verifierSite(identity, row.plateformeId)
  const ancienne = decisionsSchema.parse(JSON.parse(row.decisions))
  const avant = statutNc(row.bloquante, ancienne)
  if (row.bloquante === false)
    throw new ConflictError('Une déclaration pour statistique ne demande aucune décision.')
  const decisions = [...new Set(input.decisions)]
  if (!hasPermission(identity, 'nonconformite.decider')) {
    assertPermission(identity, 'nonconformite.traiter')
    if (
      avant !== 'En cours plateforme' ||
      decisions.some((d) => d !== 'Traité par la plateforme' && !ancienne.includes(d)) ||
      !decisions.includes('Traité par la plateforme') ||
      ancienne.some((d) => !decisions.includes(d))
    )
      throw new ForbiddenError('La Préproduction décide avant le traitement par la plateforme.')
  }
  const apres = statutNc(row.bloquante, decisions)
  await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.nonConformite.updateMany({
        where: { id, ...where },
        data: {
          decisions: JSON.stringify(decisions),
          commentaireDecision: input.commentaire,
          updatedById: identity.userId,
          ...bumpVersion,
        },
      }),
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'NON_CONFORMITE',
    entiteId: id,
    ancien: avant,
    nouveau: apres,
    parId: identity.userId,
    regle: 'RG-NEW-NC-002',
  })
  await ecrireJournal(tx, {
    typeEntite: 'NON_CONFORMITE',
    entiteId: id,
    action: 'NON_CONFORMITE',
    parId: identity.userId,
    ancienneValeur: row.decisions,
    nouvelleValeur: JSON.stringify(decisions),
    complement: input.commentaire,
  })
  return publique(tx, await tx.nonConformite.findUniqueOrThrow({ where: { id }, include }))
}
// EX-NEW-ADM-001 : référentiel partagé des déclarants, nom retiré non proposé aux nouvelles saisies.
export async function lireDeclarants(db: Client, identity: Identity) {
  if (!hasPermission(identity, 'nonconformite.declarer'))
    assertPermission(identity, 'referentiel.gerer')
  const row = await db.declarantsNc.findUnique({ where: { id: 1 } })
  return {
    version: row?.version ?? 0,
    noms: row ? z.array(z.string()).parse(JSON.parse(row.noms)) : [],
  }
}
export async function sauverDeclarants(
  tx: Tx,
  identity: Identity,
  input: { version: number; noms: string[] },
) {
  assertPermission(identity, 'referentiel.gerer')
  const row = await tx.declarantsNc.findUnique({ where: { id: 1 } })
  const uniques = new Map<string, string>()
  for (const nom of input.noms) {
    const propre = nom.replace(/\s+/g, ' ').trim()
    const cle = propre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr')
    if (cle && !uniques.has(cle)) uniques.set(cle, propre)
  }
  const noms = [...uniques.values()].sort((a, b) => a.localeCompare(b, 'fr'))
  if (!row) {
    if (input.version !== 0) throw new ConflictError('Rechargez le référentiel.')
    await tx.declarantsNc.create({
      data: { id: 1, noms: JSON.stringify(noms), updatedById: identity.userId },
    })
  } else
    await updateWithVersion({
      expectedVersion: input.version,
      update: (where) =>
        tx.declarantsNc.updateMany({
          where: { id: 1, ...where },
          data: { noms: JSON.stringify(noms), updatedById: identity.userId, ...bumpVersion },
        }),
    })
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: 'declarants-nc',
    action: 'MODIFICATION_REFERENTIEL',
    parId: identity.userId,
    ancienneValeur: row?.noms,
    nouvelleValeur: JSON.stringify(noms),
  })
  return lireDeclarants(tx, identity)
}
export async function lireJustificatif(db: Client, identity: Identity, id: number) {
  assertPermission(identity, 'nonconformite.consulter')
  const f = await db.nonConformiteFichier.findUnique({
    where: { id },
    include: { nonConformite: true },
  })
  if (!f) throw new NotFoundError('Justificatif introuvable.')
  verifierSite(identity, f.nonConformite.plateformeId)
  return f
}

// RG-NEW-NC-002 : l'alerte reste ouverte jusqu'à une décision, pas jusqu'à un acquittement.
export async function alertesNc(db: Client, identity: Identity) {
  if (!hasPermission(identity, 'nonconformite.consulter')) return []
  const rows = await db.nonConformite.findMany({
    where: { ...scope(identity), type: 'RECEPTION', bloquante: true },
  })
  return rows
    .filter((r) => decisionsSchema.parse(JSON.parse(r.decisions)).length === 0)
    .map((r) => {
      const d = NcDonneesSchema.parse(JSON.parse(r.donnees))
      return {
        cle: `NC-${r.id}`,
        type: 'NC_BLOQUANTE' as const,
        regle: 'RG-NEW-NC-002',
        gravite: 'CRITIQUE' as const,
        titre:
          r.origine === 'Réception inconnue'
            ? 'Non-conformité bloquante : go de la Préproduction attendu'
            : 'Non-conformité bloquante à la réception',
        message: `NC n° ${r.id} · ${d.annonceur} · ${d.dossier} : ${d.types.join(', ')}${d.commentaireNC ? ` — ${d.commentaireNC}` : ''}`,
        lien: `/non-conformite?tab=suivi&id=${r.id}`,
        destinataires: ['coord'],
        plateformeId: r.plateformeId,
        depart: null,
        date: r.createdAt.toISOString(),
        dossiers: (d.dossier.match(/\d+/g) ?? []).map(Number),
      }
    })
}

// RG-NEW-REC-001 / RG-NEW-NC-002 : constat atomique avec la réception, données relues en base.
export async function declarerConstatReception(
  tx: Tx,
  identity: Identity,
  receptionId: number,
  afficheIds: number[],
  constat: ConstatNc,
) {
  const rec = await tx.reception.findUniqueOrThrow({
    where: { id: receptionId },
    include: { livraison: { include: { imprimeur: true, livreur: true } } },
  })
  const affiches = await tx.affiche.findMany({
    where: { id: { in: afficheIds } },
    include: {
      support: true,
      rattachements: { where: { actif: true }, include: { ligneAttendue: true } },
    },
  })
  const joindre = (valeurs: (string | null | undefined)[]) =>
    [...new Set(valeurs.filter((v): v is string => Boolean(v)))].join(' / ')
  const donnees = NcDonneesSchema.parse({
    annonceur: joindre(affiches.map((a) => a.contAnnonc)) || 'Non lisible',
    theme: joindre(affiches.map((a) => a.theme)) || 'À identifier',
    dossier: joindre(
      affiches.flatMap((a) =>
        a.rattachements.flatMap((l) =>
          l.ligneAttendue.contNum === null ? [] : [String(l.ligneAttendue.contNum)],
        ),
      ),
    ),
    types: constat.types,
    commentaireNC: constat.commentaire,
    imprimeur: rec.livraison?.imprimeur?.libelle ?? '',
    transporteur: rec.livraison?.livreur?.libelle ?? '',
    qteRecue: String(affiches.reduce((s, a) => s + a.quantite, 0)),
  })
  return declarerNc(tx, identity, {
    type: 'RECEPTION',
    plateformeId: rec.plateformeId,
    receptionId,
    afficheIds,
    bloquante: constat.bloquante,
    donnees,
    fichiers: [],
  })
}
