// COO-P07 — Pilotage › Alertes (ECR-TRA-01, RG-COO-075) : toutes les exceptions au même endroit. Agrège les
// alertes Réception (RG-REC-182 à 189) et Coordination / Pré-Prod (alertes-coordination.ts), toutes CALCULÉES à
// la lecture ; seul l'acquittement est persisté (HYPOTHÈSE Q-371 : global, auteur et date). Le droit
// d'acquitter reste refusé tant que Q-220 n'a pas désigné qui acquitte (catalogue : `alerte.acquitter`).
import {
  GRAVITES_ALERTE,
  AlertePilotageSchema,
  TYPES_ALERTE,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type AlertePilotage,
  type GraviteAlerte,
  type ListeAlertesQuery,
  type TypeAlerte,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Identity } from '../../core/identity.ts'
import {
  assertPermission,
  hasPermission,
  canAccessPlateforme,
} from '../../core/permissions/permissions.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { alertesCoordination, type AlerteCalculee } from '../coordination/alertes-coordination.ts'
import { peutVoirAtelier } from '../coordination/permissions.ts'
import { semainePlus } from '../coordination/production.ts'
import { listerAlertes } from '../reception/alertes.ts'
import { alertesNc } from '../nonconformite/service.ts'
import { appliquerReglesAlerte } from '../admin/alertes-regles.ts'

/**
 * Correspondance des alertes Réception vers les types de l'écran (maquette `TYPES`).
 * RG-COO-072 : « Réception inconnue à identifier » (ORPHELINE) et « Dossier introuvable » reprises côté Coordination.
 */
const TYPE_REC: Record<string, TypeAlerte> = {
  'RG-REC-182': 'MANQUANT',
  'RG-REC-183': 'ECART',
  'RG-REC-185': 'ORPHELINE',
  'RG-REC-186': 'DOSSIER_INTROUVABLE',
  'RG-REC-187': 'FEUILLE_DEFINITIVE',
  'RG-REC-188': 'THEME_MODIF',
  'RG-REC-189': 'CONTROLE_RETARD',
}

/** Rang de gravité (maquette `C.sevRank`). */
const RANG: Record<GraviteAlerte, number> = {
  CRITIQUE: 0,
  IMPORTANT: 1,
  A_SURVEILLER: 2,
  INFORMATION: 3,
}

/** Signature d'une alerte acquittée : si sa gravité ou son message change, elle redevient ouverte. */
export const signature = (a: Pick<AlerteCalculee, 'gravite' | 'message'>) =>
  `${a.gravite}|${a.message}`

// RG-NEW16-PIL-001 : une archive conserve les contrôles de sa source, y compris après résolution.
async function archiveVisible(db: Db | Tx, identity: Identity, a: AlertePilotage) {
  const plateformes =
    identity.siteId !== null
      ? [identity.siteId]
      : identity.perimetre.toutesPlateformes
        ? null
        : identity.perimetre.plateformeIds
  if (a.plateformeId !== null && plateformes && !plateformes.includes(a.plateformeId)) return false
  if (a.type === 'NC_BLOQUANTE' || a.type === 'NC_PLATEFORME') {
    if (!hasPermission(identity, 'nonconformite.consulter')) return false
  }
  if (a.type === 'INTEGRATION') {
    if (!hasPermission(identity, 'alimentation.manuelle')) return false
    if (
      plateformes &&
      a.cle.startsWith('PRNI-') &&
      !(await db.receptionAttendue.count({
        where: { contNum: { in: a.dossiers }, plateformeId: { in: plateformes } },
      }))
    )
      return false
    if (plateformes && a.cle.startsWith('DEB-BC-') && a.plateformeId === null) return false
  }
  if (a.type === 'EXPORT_TRAINS') {
    const id = Number(/^EXPORT-(\d+)-/.exec(a.cle)?.[1])
    if (!Number.isSafeInteger(id)) return false
    const exp = await db.exportTrains.findUnique({ where: { id }, include: { lignes: true } })
    if (!exp) return false
    const ateliers = await db.atelier.findMany({
      where: {
        id: { in: exp.lignes.flatMap((l) => (l.atelierId === null ? [] : [l.atelierId])) },
        ...(a.plateformeId === null ? {} : { plateformeId: a.plateformeId }),
      },
    })
    if (!ateliers.some((at) => peutVoirAtelier(identity, at))) return false
  }
  if (a.type === 'APRES_EXPORT') {
    const code = /^APEXP-(.*)-\d+$/.exec(a.cle)?.[1]
    if (!code) return false
    const instruction = await db.instruction.findUnique({
      where: { code },
      include: { atelier: true },
    })
    if (!instruction?.atelier || !peutVoirAtelier(identity, instruction.atelier)) return false
  }
  return true
}

/** Toutes les alertes visibles de l'utilisateur (périmètre appliqué par chaque source). */
async function toutesLesAlertes(db: Db | Tx, identity: Identity, maintenant: Date) {
  const rec = (await listerAlertes(db, identity, maintenant)).alertes
  const alertes: AlerteCalculee[] = []
  for (const a of rec) {
    // RG-REC-184 (ligne sans IP ayant reçu une affiche) et RG-COO-071 (par affiche) décrivent la même
    // exception : une seule alerte, celle de la Coordination, clé par affiche (HYPOTHÈSE Q-190 (5)).
    const type = TYPE_REC[a.regle]
    if (!type) continue
    alertes.push({
      cle: a.cle,
      type,
      regle: a.regle,
      gravite: a.gravite,
      titre: a.type,
      message: a.message,
      lien: a.lien,
      destinataires: a.destinataires,
      plateformeId: a.plateformeId,
      depart: a.depart ?? null,
      date: a.date ?? null,
      dossiers: a.dossier !== null && a.dossier !== undefined ? [a.dossier] : [],
    })
  }
  // RG-REC-190 (D-08) : canal « Désactivée » et destinataires configurés (Administration › Alertes).
  return appliquerReglesAlerte(db, [
    ...alertes,
    ...(await alertesNc(db, identity)),
    ...(await alertesCoordination(db, identity, maintenant)),
  ])
}

// RG-COO-075 / ECR-TRA-01 : consultation (coord, cheq, recep, admin, com : `alerte.consulter`). Filtres de la
// maquette : n° de dossier, départ (les alertes sans semaine restent), gravité, état (ouvertes par défaut),
// site, type ; indicateurs par gravité et pastilles par type comptés sans leur propre filtre (`F.except`).
export async function listerAlertesPilotage(
  db: Db,
  identity: Identity,
  q: ListeAlertesQuery,
  maintenant = new Date(),
) {
  assertPermission(identity, 'alerte.consulter', { regle: 'RG-COO-075' })
  const brutes = await toutesLesAlertes(db, identity, maintenant)
  const [acquittements, plateformes] = await Promise.all([
    // Table des acquittements lue entière (pas de liste IN de milliers de clés : limite de SQLite, ANO-035).
    db.alerteAcquittement.findMany(),
    db.plateforme.findMany({ select: { id: true, nom: true } }),
  ])
  const noms = new Map(
    (
      await db.utilisateur.findMany({
        where: { id: { in: acquittements.map((x) => x.parId) } },
        select: { id: true, nom: true, identifiantExterne: true },
      })
    ).map((u) => [u.id, u.nom ?? u.identifiantExterne]),
  )
  const parCle = new Map(acquittements.map((x) => [x.cle, x]))
  const sites = new Map(plateformes.map((p) => [p.id, p.nom]))
  let alertes: AlertePilotage[] = brutes.map((a) => {
    const acq = parCle.get(a.cle)
    return {
      ...a,
      site: a.plateformeId !== null ? (sites.get(a.plateformeId) ?? null) : null,
      acquittee:
        acq && acq.signature === signature(a)
          ? { par: noms.get(acq.parId) ?? null, le: acq.le.toISOString() }
          : null,
    }
  })
  // RG-NEW16-PIL-001 : les archives restent consultables après disparition de leur cause.
  for (const acq of acquittements) {
    if (!acq.snapshot || alertes.some((a) => a.cle === acq.cle)) continue
    const saved = AlertePilotageSchema.safeParse(JSON.parse(acq.snapshot))
    if (!saved.success) continue
    const a = saved.data
    if (!(await archiveVisible(db, identity, a))) continue
    alertes.push({
      ...a,
      site: a.plateformeId === null ? null : (sites.get(a.plateformeId) ?? null),
      acquittee: { par: noms.get(acq.parId) ?? null, le: acq.le.toISOString() },
    })
  }
  alertes = await appliquerReglesAlerte(db, alertes)
  const garde = (a: AlertePilotage, sauf?: 'gravite' | 'type') =>
    (q.dossier === undefined || a.dossiers.includes(q.dossier)) &&
    (q.depart === undefined ||
      q.depart.length === 0 ||
      a.depart === null ||
      q.depart.includes(a.depart)) &&
    (sauf === 'gravite' ||
      q.gravite === undefined ||
      q.gravite.length === 0 ||
      q.gravite.includes(a.gravite)) &&
    (sauf === 'type' || q.type === undefined || q.type.length === 0 || q.type.includes(a.type)) &&
    (q.etat === 'ACQUITTEES' ? a.acquittee !== null : a.acquittee === null) &&
    (q.site === undefined || a.plateformeId === null || a.plateformeId === q.site)
  const compte = <K extends string>(
    cles: readonly K[],
    cle: (a: AlertePilotage) => K,
    sauf: 'gravite' | 'type',
  ) => {
    const r = Object.fromEntries(cles.map((k) => [k, 0])) as Record<K, number>
    for (const a of alertes) if (garde(a, sauf)) r[cle(a)] += 1
    return r
  }
  const S = semaineIsoDe(maintenant)
  return {
    alertes: alertes
      .filter((a) => garde(a))
      .sort(
        (x, y) =>
          RANG[x.gravite] - RANG[y.gravite] ||
          (x.date ?? '').localeCompare(y.date ?? '') ||
          x.cle.localeCompare(y.cle),
      ),
    parGravite: compte(GRAVITES_ALERTE, (a) => a.gravite, 'gravite'),
    parType: compte(TYPES_ALERTE, (a) => a.type, 'type'),
    departsParDefaut: [formatSemaineIso(S), formatSemaineIso(semainePlus(S, 1, lundiSemaineIso))],
    peutAcquitter: hasPermission(identity, 'alerte.acquitter'),
  }
}

// ECR-TRA-01 « Acquitter » (ligne et action groupée). HYPOTHÈSE Q-371 : acquittement global (auteur, date),
// signature gardée ; une alerte déjà levée ou déjà acquittée est ignorée. Droit `alerte.acquitter` : refusé à
// tous les rôles tant que Q-220 n'a pas tranché qui acquitte (COO §2 « ? »).
export async function acquitterAlertes(
  tx: Tx,
  identity: Identity,
  cles: string[],
  maintenant = new Date(),
) {
  assertPermission(identity, 'alerte.acquitter', { regle: 'RG-COO-075' })
  const ouvertes = new Map(
    (await toutesLesAlertes(tx, identity, maintenant)).map((a) => [a.cle, a]),
  )
  let n = 0
  for (const cle of [...new Set(cles)]) {
    const a = ouvertes.get(cle)
    if (!a) continue
    const sig = signature(a)
    const deja = await tx.alerteAcquittement.findUnique({ where: { cle } })
    if (deja?.signature === sig) continue
    await tx.alerteAcquittement.upsert({
      where: { cle },
      create: {
        cle,
        signature: sig,
        parId: identity.userId,
        le: maintenant,
        snapshot: JSON.stringify({ ...a, site: null, acquittee: null }),
      },
      update: {
        signature: sig,
        parId: identity.userId,
        le: maintenant,
        snapshot: JSON.stringify({ ...a, site: null, acquittee: null }),
      },
    })
    await ecrireJournal(tx, {
      typeEntite: 'ALERTE',
      entiteId: cle,
      action: 'ACQUITTEMENT_ALERTE',
      parId: identity.userId,
      nouvelleValeur: a.titre,
      complement: a.regle,
    })
    n++
  }
  return { acquittees: n, message: `${String(n)} alerte(s) acquittée(s).` }
}

// RG-NEW16-PIL-001 — restauration explicite, mêmes droits/périmètres que l’archivage.
export async function restaurerAlertes(tx: Tx, identity: Identity, cles: string[]) {
  assertPermission(identity, 'alerte.acquitter', { regle: 'RG-COO-075' })
  const visibles = new Map(
    (await toutesLesAlertes(tx, identity, new Date())).map((a) => [a.cle, a]),
  )
  let n = 0
  for (const cle of new Set(cles)) {
    const archive = await tx.alerteAcquittement.findUnique({ where: { cle } })
    if (!archive) continue
    const saved = archive.snapshot
      ? AlertePilotageSchema.safeParse(JSON.parse(archive.snapshot))
      : null
    const a =
      visibles.get(cle) ??
      (saved?.success && (await archiveVisible(tx, identity, saved.data)) ? saved.data : null)
    if (
      !a ||
      (a.plateformeId !== null &&
        (!canAccessPlateforme(identity, a.plateformeId) ||
          (identity.siteId !== null && identity.siteId !== a.plateformeId)))
    )
      continue
    await tx.alerteAcquittement.delete({ where: { cle } })
    await ecrireJournal(tx, {
      typeEntite: 'ALERTE',
      entiteId: cle,
      action: 'ACQUITTEMENT_ALERTE',
      parId: identity.userId,
      complement: 'Restauration de l’alerte',
    })
    n++
  }
  return {
    acquittees: n,
    message: `${n} alerte(s) restaurée(s). Une cause résolue ne recrée pas d’alerte.`,
  }
}
