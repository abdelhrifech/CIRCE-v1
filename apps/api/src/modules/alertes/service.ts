// COO-P07 — Pilotage › Alertes (ECR-TRA-01, RG-COO-075) : toutes les exceptions au même endroit. Agrège les
// alertes Réception (RG-REC-182 à 189) et Coordination / Pré-Prod (alertes-coordination.ts), toutes CALCULÉES à
// la lecture ; seul l'acquittement est persisté (HYPOTHÈSE Q-371 : global, auteur et date). Le droit
// d'acquitter reste refusé tant que Q-220 n'a pas désigné qui acquitte (catalogue : `alerte.acquitter`).
import {
  GRAVITES_ALERTE,
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
import { assertPermission, hasPermission } from '../../core/permissions/permissions.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { alertesCoordination, type AlerteCalculee } from '../coordination/alertes-coordination.ts'
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
  const alertes: AlertePilotage[] = brutes.map((a) => {
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
      create: { cle, signature: sig, parId: identity.userId, le: maintenant },
      update: { signature: sig, parId: identity.userId, le: maintenant },
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
