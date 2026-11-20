import type { z } from 'zod'
import {
  TAGS_AFFICHE,
  STATUTS_UNITE,
  STATUTS_PREPARATION,
  STATUTS_UNITE_UNITAIRE,
  NC_STATUTS,
  type JournalAdminQuerySchema,
  type TransportAdminQuerySchema,
} from '@circe/shared'
import {
  ActionAudit,
  TypeEntite,
  StatutReception,
  StatutLigneAttendue,
  StatutInstruction,
  StatutProduction,
} from '../../generated/prisma/enums.ts'
import type { Db } from '../../core/db.ts'
import type { Identity } from '../../core/identity.ts'
import type { Prisma } from '../../generated/prisma/client.ts'
import { assertDroitAdmin } from './permissions.ts'
// EX-ADM-NEW-001 : consultation du journal réel, accessible à l’administration seulement.
export async function journalAdmin(
  db: Db,
  i: Identity,
  q: z.infer<typeof JournalAdminQuerySchema>,
) {
  assertDroitAdmin(i, 'parametrage.gerer')
  const where: Prisma.JournalAuditWhereInput = {
    ...(q.action
      ? {
          action: {
            in: Object.values(ActionAudit).filter((a) =>
              a.toLocaleLowerCase('fr').includes(q.action?.toLocaleLowerCase('fr') ?? ''),
            ),
          },
        }
      : {}),
    ...(q.objet
      ? {
          typeEntite: {
            in: Object.values(TypeEntite).filter((a) =>
              a.toLocaleLowerCase('fr').includes(q.objet?.toLocaleLowerCase('fr') ?? ''),
            ),
          },
        }
      : {}),
    ...(q.du || q.au
      ? {
          le: {
            ...(q.du ? { gte: new Date(`${q.du}T00:00:00`) } : {}),
            ...(q.au ? { lt: new Date(new Date(`${q.au}T00:00:00`).getTime() + 86400000) } : {}),
          },
        }
      : {}),
    ...(q.q
      ? {
          OR: [
            { entiteId: { contains: q.q } },
            { complement: { contains: q.q } },
            { par: { nom: { contains: q.q } } },
          ],
        }
      : {}),
  }
  const [rows, total] = await Promise.all([
    db.journalAudit.findMany({
      where,
      include: { par: { select: { nom: true, identifiantExterne: true } } },
      orderBy: [{ le: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.journalAudit.count({ where }),
  ])
  return {
    items: rows.map((j) => ({
      id: j.id,
      date: j.le.toISOString(),
      par: j.par?.nom ?? j.par?.identifiantExterne ?? 'Automatique',
      objet: j.typeEntite,
      identifiant: j.entiteId,
      action: j.action,
      detail: j.complement,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  }
}
export function catalogueStatuts(_db: Db, i: Identity) {
  assertDroitAdmin(i, 'parametrage.gerer')
  const groupes = [
    {
      domaine: 'Réception : palette',
      origine: 'Enregistré',
      ecran: 'Réception',
      valeurs: Object.values(StatutReception),
    },
    {
      domaine: 'Réception attendue',
      origine: 'Calculé depuis les rattachements',
      ecran: 'Réceptions attendues',
      valeurs: Object.values(StatutLigneAttendue),
    },
    {
      domaine: 'Instruction',
      origine: 'Enregistré',
      ecran: 'Liste des instructions',
      valeurs: Object.values(StatutInstruction),
    },
    {
      domaine: 'Préparation',
      origine: 'Enregistré',
      ecran: 'Préparation',
      valeurs: Object.values(StatutProduction),
    },
    { domaine: 'Dossier', origine: 'Calculé', ecran: 'À traiter', valeurs: STATUTS_PREPARATION },
    {
      domaine: 'Train',
      origine: 'Calculé depuis les faces et réceptions',
      ecran: 'Liste des trains',
      valeurs: STATUTS_UNITE,
    },
    {
      domaine: 'Préparation unitaire',
      origine: 'Calculé depuis les répartitions et UM',
      ecran: 'Préparation unitaire',
      valeurs: STATUTS_UNITE_UNITAIRE,
    },
    {
      domaine: 'Affiche : tags',
      origine: 'Calculé',
      ecran: 'Liste des affiches',
      valeurs: TAGS_AFFICHE,
    },
    {
      domaine: 'Non-conformité',
      origine: 'Calculé depuis portée, décision et réponse',
      ecran: 'Suivi des NC',
      valeurs: NC_STATUTS,
    },
  ]
  return {
    items: groupes.flatMap((g) =>
      g.valeurs.map((v) => ({
        cle: `${g.domaine}:${v}`,
        domaine: g.domaine,
        libelle: v,
        origine: g.origine,
        description: `Valeur utilisée par ${g.ecran}.`,
        ecran: g.ecran,
      })),
    ),
  }
}
export async function transportAdmin(
  db: Db,
  i: Identity,
  q: z.infer<typeof TransportAdminQuerySchema>,
) {
  assertDroitAdmin(i, 'parametrage.gerer')
  const [rows, total] = await Promise.all([
    db.transportDestinataire.findMany({
      include: { atelier: { include: { plateforme: true } }, destinataire: true },
      orderBy: { id: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.transportDestinataire.count(),
  ])
  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    items: rows.map((t) => ({
      id: t.id,
      site: t.atelier.plateforme.nom,
      atelier: t.atelier.libelle,
      destinataire: t.destinataire.nom ?? t.destinataire.nomOrigine,
      transporteur: t.transporteur,
      tarif: t.tarif,
    })),
  }
}
export async function machinesAdmin(db: Db, i: Identity) {
  assertDroitAdmin(i, 'parametrage.gerer')
  const [parametres, machines] = await Promise.all([
    db.parametre.findMany({
      where: { cle: { startsWith: 'trains.' }, plateformeId: null },
      orderBy: { cle: 'asc' },
    }),
    db.machineConfiguration.findMany({ orderBy: { nom: 'asc' } }),
  ])
  return {
    machines: machines.map((m) => ({
      id: m.id,
      version: m.version,
      nom: m.nom,
      type: m.type,
      fichier: m.fichier,
      tiroirsMax: m.tiroirsMax,
      sortie: m.sortie,
      repertoire: m.repertoire,
      bagues: m.bagues,
    })),
    parametres: parametres.map((p) => ({ cle: p.cle, valeur: p.valeur })),
  }
}
