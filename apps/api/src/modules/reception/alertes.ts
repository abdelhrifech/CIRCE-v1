// REC-P10 — Alertes Réception (RG-REC-182 à 189), CALCULÉES à la lecture depuis l'état des données :
// une alerte disparaît d'elle-même quand sa condition tombe (pas de table d'alertes, pas d'acquittement :
// Q-220). RG-REC-190 PARTIEL : canal et destinataires paramétrables (admin/alertes-regles.ts, D-08 partiel) ;
// gravité configurable et envoi de mail non repris (Q-408, Q-375).
// HYPOTHÈSE Q-178 : « grave » = IMPORTANT ; gravité non précisée = À SURVEILLER.
import { formatSemaineIso, semaineIsoDe, type Alerte } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import type { Identity } from '../../core/identity.ts'
import { plateformesVisibles } from './attendues.ts'
import { lireParametreNombre } from './parametres.ts'
import { assertDroitReception } from './permissions.ts'

const RECEP = 'Réception'
const COORD = 'Coordination'
const CHEFS = 'Chefs d’équipe'

function semaineSuivante(d: Date) {
  return semaineIsoDe(new Date(d.getTime() + 7 * 86_400_000))
}

export async function listerAlertes(
  db: Db | Tx,
  identity: Identity,
  maintenant = new Date(),
): Promise<{ alertes: Alerte[] }> {
  assertDroitReception(identity, 'alerte.consulter')
  const plateformes = plateformesVisibles(identity)
  const surPlateformes = plateformes === 'toutes' ? {} : { plateformeId: { in: plateformes } }
  const delai = await lireParametreNombre(db, 'reception.delaiControle')
  const alertes: Alerte[] = []
  const s = semaineIsoDe(maintenant)
  const s1 = semaineSuivante(maintenant)

  // RG-X-018 : visuel reçu en partie → alerte « Visuel reçu en partie ».
  // RG-REC-182 : visuel non reçu / reçu en partie (départ en S : critique / grave ; S+1 : à surveiller).
  const lignes = await db.receptionAttendue.findMany({
    where: {
      ...surPlateformes,
      etatLigne: 'ACTIVE',
      purgeeLe: null,
      statut: { in: ['ATTENDUE', 'PARTIELLE'] },
      OR: [
        { semAnnee: s.annee, semNum: s.semaine },
        { semAnnee: s1.annee, semNum: s1.semaine },
      ],
    },
  })
  for (const l of lignes) {
    const enS = l.semAnnee === s.annee && l.semNum === s.semaine
    alertes.push({
      cle: `RG-REC-182:${String(l.id)}`,
      type: l.statut === 'ATTENDUE' ? 'Visuel non reçu' : 'Visuel reçu en partie',
      regle: 'RG-REC-182',
      gravite: enS ? (l.statut === 'ATTENDUE' ? 'CRITIQUE' : 'IMPORTANT') : 'A_SURVEILLER',
      message: `Dossier ${String(l.contNum ?? '—')} · ${l.annonceur ?? ''} — départ ${formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum })}`,
      lien: '/reception',
      destinataires: [CHEFS, COORD, RECEP],
      plateformeId: l.plateformeId,
      dossier: l.contNum,
      depart: formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }),
      date: null,
    })
  }

  // RG-REC-183 : écart de réception supérieur au seuil (statut SURPLUS, RG-REC-018). HYPOTHÈSE Q-133.
  for (const l of await db.receptionAttendue.findMany({
    where: { ...surPlateformes, etatLigne: 'ACTIVE', statut: 'SURPLUS' },
  })) {
    alertes.push({
      cle: `RG-REC-183:${String(l.id)}`,
      type: 'Écart de réception',
      regle: 'RG-REC-183',
      gravite: 'A_SURVEILLER',
      message: `Dossier ${String(l.contNum ?? '—')} : reçu au-delà du seuil d’écart`,
      lien: '/reception',
      destinataires: [RECEP, COORD],
      plateformeId: l.plateformeId,
      dossier: l.contNum,
      depart: formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }),
      date: null,
    })
  }

  // RG-REC-184 : réception sans instructions de pose (ligne sans thème ayant reçu une affiche).
  for (const l of await db.receptionAttendue.findMany({
    where: {
      ...surPlateformes,
      etatLigne: 'ACTIVE',
      theme: null,
      rattachements: { some: { actif: true } },
    },
  })) {
    alertes.push({
      cle: `RG-REC-184:${String(l.id)}`,
      type: 'Réception sans instructions de pose',
      regle: 'RG-REC-184', // RG-X-009 : réception sur un dossier sans IP → alerte Coordination
      gravite: 'IMPORTANT',
      message: `Dossier ${String(l.contNum ?? '—')} reçu sans IP : prévenir la Pré-Prod`,
      lien: '/reception',
      destinataires: [COORD],
      plateformeId: l.plateformeId,
      dossier: l.contNum,
      depart: formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }),
      date: null,
    })
  }

  // RG-COO-072 (côté Coordination) ; RG-REC-185 / RG-REC-186 (RG-X-006 : inconnue créée → alerte Coordination ; RG-X-008 : « Dossier introuvable » →
  // alerte Coordination du site, gravité IMPORTANT = hypothèse Q-132 / Q-372) : réception inconnue à identifier (importante après le délai) / introuvable.
  const inconnues = await db.reception.findMany({
    where: { ...surPlateformes, statut: 'A_IDENTIFIER' },
  })
  for (const r of inconnues) {
    if (r.signaleLe) {
      alertes.push({
        cle: `RG-REC-186:${String(r.id)}`,
        type: 'Dossier introuvable',
        regle: 'RG-REC-186',
        gravite: 'IMPORTANT',
        message: `Réception inconnue R${String(r.id)} signalée le ${r.signaleLe.toISOString().slice(0, 10)}`,
        lien: `/reception/inconnues?id=${String(r.id)}`,
        destinataires: [COORD],
        plateformeId: r.plateformeId,
        dossier: null,
        depart: null,
        date: r.signaleLe.toISOString(),
      })
    } else {
      const heures = (maintenant.getTime() - r.dateArrivee.getTime()) / 3_600_000
      alertes.push({
        cle: `RG-REC-185:${String(r.id)}`,
        type: 'Réception inconnue à identifier',
        regle: 'RG-REC-185',
        gravite: heures > delai ? 'IMPORTANT' : 'A_SURVEILLER',
        message: `Réception inconnue R${String(r.id)} à identifier`,
        lien: '/reception/inconnues',
        destinataires: [COORD, RECEP],
        plateformeId: r.plateformeId,
        dossier: null,
        depart: null,
        date: r.dateArrivee.toISOString(),
      })
    }
  }

  // RG-REC-187 / RG-REC-188 : feuilles définitives à imprimer (temporaire sur affiche rattachée) / à refaire.
  const feuilles = await db.affiche.findMany({
    where: {
      ...surPlateformes,
      statut: 'IDENTIFIEE',
      OR: [{ typeFeuille: 'TEMPORAIRE' }, { feuilleARefaire: true }],
    },
    select: {
      id: true,
      plateformeId: true,
      typeFeuille: true,
      feuilleARefaire: true,
      contNum: true,
    },
  })
  for (const a of feuilles) {
    const definitiveAImprimer = a.typeFeuille === 'TEMPORAIRE'
    alertes.push({
      cle: `${definitiveAImprimer ? 'RG-REC-187' : 'RG-REC-188'}:${String(a.id)}`,
      type: definitiveAImprimer
        ? 'Feuille de stock définitive à imprimer'
        : 'Feuille de stock à refaire',
      regle: definitiveAImprimer ? 'RG-REC-187' : 'RG-REC-188',
      gravite: 'A_SURVEILLER',
      message: `Affiche ${String(a.id)}`,
      lien: `/reception/affiches?affiche=${String(a.id)}`,
      destinataires: definitiveAImprimer ? [RECEP] : [RECEP, COORD],
      plateformeId: a.plateformeId,
      dossier: a.contNum,
      depart: null,
      date: null,
    })
  }

  // RG-REC-189 : palette à contrôler depuis plus que le délai ; grave au double.
  for (const r of await db.reception.findMany({
    where: { ...surPlateformes, statut: 'A_CONTROLER' },
  })) {
    const depuis = r.aControlerDepuis ?? r.dateArrivee
    const heures = (maintenant.getTime() - depuis.getTime()) / 3_600_000
    if (heures <= delai) continue
    alertes.push({
      cle: `RG-REC-189:${String(r.id)}`,
      type: `Palette à contrôler depuis plus de ${String(delai)} h`,
      regle: 'RG-REC-189',
      gravite: heures > 2 * delai ? 'IMPORTANT' : 'A_SURVEILLER',
      message: `Palette R${String(r.id)} dans le sas depuis ${String(Math.floor(heures))} h`,
      lien: `/reception?palette=${String(r.id)}`,
      destinataires: [RECEP, CHEFS],
      plateformeId: r.plateformeId,
      dossier: null,
      depart: null,
      date: depuis.toISOString(),
    })
  }
  const rang = { CRITIQUE: 0, IMPORTANT: 1, A_SURVEILLER: 2 } as const
  alertes.sort((x, y) => rang[x.gravite] - rang[y.gravite] || x.cle.localeCompare(y.cle))
  return { alertes }
}
