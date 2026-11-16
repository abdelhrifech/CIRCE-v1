// COO-P07 — alertes Coordination / Pré-Prod (ECR-TRA-01), CALCULÉES à la lecture depuis l'état des données
// (HYPOTHÈSES Q-220, Q-371 : clé stable par objet, levée automatique quand la condition disparaît) :
// RG-COO-033 validation admin à confirmer (doute) ; RG-COO-066 préparation non reçue (deadline) ; RG-COO-067 /
// 031 / 086 écart Broadcast / Circé ; RG-COO-032 ligne annulée (affiche à re-rattacher) ; RG-COO-068 / 030 thème
// modifié dans Broadcast ; RG-COO-069 / 070 thèmes et annonceurs proches ; RG-COO-071 réception sans IP ;
// RG-COO-053 / 073 rajout après préparation ; RG-COO-074 dernière minute ; RG-COO-103 / 116 / 122 / 081 / 085
// alertes techniques de l'intégration. Les alertes nées d'un événement daté (journal) restent visibles
// `alertes.joursEvenements` jours (HYPOTHÈSE Q-190 (3)). Mails : Q-375 (aucun envoi).
import {
  comparerSemaines,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type GraviteAlerte,
  type SemaineIso,
  type TypeAlerte,
} from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import type { Identity } from '../../core/identity.ts'
import { hasPermission } from '../../core/permissions/permissions.ts'
import { lireParametreNombre, lireParametreTexte } from '../reception/parametres.ts'
import { alertesAlimentation } from './alimentation-lignes.ts'
import { alertesValidation } from './effets-validation.ts'
import { ecartDossier } from './instruction-ok.ts'
import { departsDesDossiers, dossiersEnProduction, semainePlus } from './production.ts'
import { lireDeadline } from './reservations.ts'
import { groupesAVerifier, lignesThemeModifie } from './themes.ts'
import { cleTheme, STATUTS_TRAIN } from './trains.ts'
import { affichesDesDossiers, LIBELLE_MOTIF } from './validation-admin.ts'

export interface AlerteCalculee {
  cle: string
  type: TypeAlerte
  regle: string
  gravite: GraviteAlerte
  titre: string
  message: string
  lien: string
  destinataires: string[]
  plateformeId: number | null
  depart: string | null
  date: string | null
  dossiers: number[]
}

export const DESTINATAIRES = {
  coord: 'Coordination',
  cheq: 'Chefs d’équipe',
  recep: 'Réception',
  admin: 'Administrateur',
} as const

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const deux = (n: number) => String(n).padStart(2, '0')
/** « jeu. 15/10 16h » (UTC, HYPOTHÈSE Q-187 (15) : fuseau des plateformes non modélisé). */
export function formatEcheance(d: Date): string {
  const m = d.getUTCMinutes()
  return `${JOURS[d.getUTCDay()] ?? ''} ${deux(d.getUTCDate())}/${deux(d.getUTCMonth() + 1)} ${String(d.getUTCHours())}h${m ? deux(m) : ''}`
}

/** RG-COO-033 : « Important » pour un départ jusqu'à S+n (paramètre, S+1 par défaut), sinon « À surveiller ». */
export function graviteValidation(
  depart: SemaineIso | null,
  courante: SemaineIso,
  semainesGraves: number,
): GraviteAlerte {
  if (!depart) return 'A_SURVEILLER'
  return comparerSemaines(depart, semainePlus(courante, semainesGraves, lundiSemaineIso)) <= 0
    ? 'IMPORTANT'
    : 'A_SURVEILLER'
}

/** RG-COO-066 : « Critique » si la deadline Pré-Prod est dépassée, sinon « À surveiller ». */
export function graviteDeadline(deadline: Date, maintenant: Date): GraviteAlerte {
  return maintenant > deadline ? 'CRITIQUE' : 'A_SURVEILLER'
}

/** RG-COO-073 (HYPOTHÈSE Q-222) : fenêtre « début | fin » relative au départ (format de la deadline). */
const FORMAT_JALON = /^\s*-?\d+\s*;\s*[1-7]\s*;\s*\d{1,2}:\d{2}\s*$/
export function lireFenetre(valeur: string) {
  // Valeur vide ou mal formée : valeur par défaut de RG-COO-073 (vendredi S-2 0 h → vendredi S 23 h 59).
  const [debut, fin] = valeur.split('|')
  const d = lireDeadline(debut && FORMAT_JALON.test(debut) ? debut : '-2;5;00:00')
  const f = lireDeadline(fin && FORMAT_JALON.test(fin) ? fin : '0;5;23:59')
  return (depart: SemaineIso) => ({ debut: d(depart), fin: f(depart) })
}

const lienDossier = (contNum: number) => `/coordination?dossier=${String(contNum)}&aFaire=TOUS`
const minSemaine = (s: SemaineIso[]) => [...s].sort(comparerSemaines)[0] ?? null

export async function alertesCoordination(
  db: Db | Tx,
  identity: Identity,
  maintenant = new Date(),
): Promise<AlerteCalculee[]> {
  const plateformes = identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds
  const surPlateformes = plateformes ? { plateformeId: { in: plateformes } } : {}
  const S = semaineIsoDe(maintenant)
  const jours = await lireParametreNombre(db, 'alertes.joursEvenements')
  const depuis = new Date(maintenant.getTime() - jours * 86_400_000)
  const out: AlerteCalculee[] = []
  const fiches = async (contNums: number[]) =>
    new Map(
      (
        await parPaquets([...new Set(contNums)], (paquet) =>
          db.dossier.findMany({ where: { contNum: { in: paquet } } }),
        )
      ).map((d) => [d.contNum, d]),
    )

  // ── RG-COO-033 / RG-X-050 : validation admin à confirmer, affiche à doute (hors SANS_IP seul). ──
  const liensNonValides = await db.afficheAttendue.findMany({
    where: {
      actif: true,
      affiche: { validationAdmin: false },
      ligneAttendue: { contNum: { not: null }, ...surPlateformes },
    },
    select: { ligneAttendue: { select: { contNum: true } } },
  })
  const dossiersVa = [
    ...new Set(
      liensNonValides.map((l) => l.ligneAttendue.contNum).filter((c): c is number => c !== null),
    ),
  ]
  const affichesVa = await affichesDesDossiers(db, dossiersVa, plateformes)
  const doutes = new Map<
    number,
    {
      dossiers: number[]
      plateformeId: number
      theme: string | null
      recue: number
      motifs: string[]
    }
  >()
  for (const [dossier, liste] of affichesVa)
    for (const a of liste) {
      if (a.etat !== 'A_CONFIRMER_DOUTE' || !a.motifs.some((m) => m !== 'SANS_IP')) continue
      const e = doutes.get(a.id) ?? {
        dossiers: [],
        plateformeId: a.plateformeId,
        theme: a.theme,
        recue: a.quantiteRecue,
        motifs: a.motifs.map((m) => LIBELLE_MOTIF[m]),
      }
      e.dossiers.push(dossier)
      doutes.set(a.id, e)
    }
  if (doutes.size > 0) {
    const semainesGraves = await lireParametreNombre(db, 'alertes.departGraveSemaines')
    const liens = await parPaquets([...doutes.keys()], (paquet) =>
      db.afficheAttendue.findMany({
        where: { actif: true, afficheId: { in: paquet } },
        select: { afficheId: true, ligneAttendue: { select: { semAnnee: true, semNum: true } } },
      }),
    )
    const noms = await fiches(dossiersVa)
    for (const [id, e] of doutes) {
      const depart = minSemaine(
        liens
          .filter((l) => l.afficheId === id)
          .map((l) => ({ annee: l.ligneAttendue.semAnnee, semaine: l.ligneAttendue.semNum })),
      )
      const premier = e.dossiers[0] ?? 0
      out.push({
        cle: `VA-${String(id)}`,
        type: 'VALIDATION_ADMIN',
        regle: 'RG-COO-033',
        gravite: graviteValidation(depart, S, semainesGraves),
        titre: 'Validation admin à confirmer : doute de rattachement',
        message:
          `Affiche ${String(id)} (${String(e.recue)} ex., « ${e.theme ?? '—'} ») proposée pour ` +
          e.dossiers
            .map((d) => `le dossier ${String(d)} · ${noms.get(d)?.annonceur ?? '—'}`)
            .join(', ') +
          ` : ${e.motifs.join(' ; ')}. Vérifier, puis confirmer la validation admin (aucune validation sans une personne).`,
        lien: lienDossier(premier),
        destinataires: [DESTINATAIRES.coord],
        plateformeId: e.plateformeId,
        depart: depart ? formatSemaineIso(depart) : null,
        date: null,
        dossiers: e.dossiers,
      })
    }
  }

  // ── RG-COO-071 / RG-COO-084 : réception sur un dossier sans IP (ligne provisoire / sans thème). ──
  const sansIp = await db.afficheAttendue.findMany({
    where: {
      actif: true,
      ligneAttendue: {
        etatLigne: 'ACTIVE',
        ...surPlateformes,
        OR: [{ provisoire: true }, { theme: null }],
      },
    },
    include: {
      affiche: { select: { id: true, theme: true, plateformeId: true } },
      ligneAttendue: { select: { contNum: true, annonceur: true, semAnnee: true, semNum: true } },
    },
    orderBy: { id: 'asc' },
  })
  const parAfficheSansIp = new Map<number, typeof sansIp>()
  for (const l of sansIp)
    parAfficheSansIp.set(l.afficheId, [...(parAfficheSansIp.get(l.afficheId) ?? []), l])
  for (const [id, liens] of parAfficheSansIp) {
    const l0 = liens[0]
    if (!l0) continue
    const dossiers = [
      ...new Set(liens.map((l) => l.ligneAttendue.contNum).filter((c): c is number => c !== null)),
    ]
    const depart = minSemaine(
      liens.map((l) => ({ annee: l.ligneAttendue.semAnnee, semaine: l.ligneAttendue.semNum })),
    )
    out.push({
      cle: `IP-${String(id)}`,
      type: 'SANS_IP',
      regle: 'RG-COO-071',
      gravite: 'IMPORTANT',
      titre: 'Réception sans instructions de pose',
      message:
        `Affiche ${String(id)} (${String(liens.reduce((t, l) => t + l.quantite, 0))} ex.) reçue pour ` +
        `${l0.ligneAttendue.annonceur ?? '—'}, dossier ${dossiers.join(', ') || '—'} : aucune IP saisie dans ` +
        `Broadcast. Intitulé saisi par la plateforme : « ${l0.affiche.theme ?? '—'} », à reprendre par la ` +
        'Pré-Prod dans les IP de Broadcast (« le 1er qui a parlé ») : la Coordination la prévient.',
      lien: `/reception/affiches?affiche=${String(id)}`,
      destinataires: [DESTINATAIRES.coord, DESTINATAIRES.recep],
      plateformeId: l0.affiche.plateformeId,
      depart: depart ? formatSemaineIso(depart) : null,
      date: null,
      dossiers,
    })
  }

  // ── RG-COO-066 / 076 : préparation non reçue, départ entre S et S+2 (HYPOTHÈSE Q-190 (4)). ──
  const S2 = semainePlus(S, 2, lundiSemaineIso)
  const lignesProches = await db.receptionAttendue.findMany({
    where: {
      etatLigne: 'ACTIVE',
      contNum: { not: null },
      ...surPlateformes,
      semAnnee: { gte: S.annee, lte: S2.annee },
    },
    include: {
      atelier: { select: { libelle: true } },
      plateforme: { select: { nom: true } },
    },
  })
  const candidats = lignesProches.filter((l) => {
    const s = { annee: l.semAnnee, semaine: l.semNum }
    return comparerSemaines(s, S) >= 0 && comparerSemaines(s, S2) <= 0
  })
  const numsPp = [
    ...new Set(candidats.map((l) => l.contNum).filter((c): c is number => c !== null)),
  ]
  if (numsPp.length > 0) {
    const [dossiersPp, departsPp] = await Promise.all([
      fiches(numsPp),
      departsDesDossiers(db, numsPp),
    ])
    const deadline = lireDeadline(await lireParametreTexte(db, 'coordination.deadlinePrepa'))
    for (const n of numsPp) {
      const fiche = dossiersPp.get(n)
      if (fiche && fiche.statut !== 'A_TRAITER') continue
      const premier = (departsPp.get(n) ?? []).find((s) => comparerSemaines(s, S) >= 0)
      if (!premier || comparerSemaines(premier, S2) > 0) continue
      const lignes = candidats.filter((l) => l.contNum === n)
      const l0 = lignes[0]
      if (!l0) continue
      const ipSaisies = lignes.some((l) => l.theme !== null && !l.provisoire)
      const dl = deadline(premier)
      const late = maintenant > dl
      out.push({
        cle: `PP-${String(n)}`,
        type: 'IP_MANQUANTES',
        regle: 'RG-COO-066',
        gravite: graviteDeadline(dl, maintenant),
        titre: late
          ? 'Préparation non reçue après la deadline'
          : 'Préparation attendue avant la deadline',
        message:
          `${fiche?.annonceur ?? l0.annonceur ?? '—'} (dossier ${String(n)}, ` +
          `${l0.atelier?.libelle ?? l0.format ?? '—'} · ${l0.plateforme.nom}) : ` +
          (ipSaisies ? 'IP saisies, préparation non envoyée' : 'IP non saisies') +
          `. Deadline Pré-Prod : ${formatEcheance(dl)}.`,
        lien: lienDossier(n),
        destinataires: [DESTINATAIRES.coord],
        plateformeId: l0.plateformeId,
        depart: formatSemaineIso(premier),
        date: dl.toISOString(),
        dossiers: [n],
      })
    }
  }

  // ── RG-COO-067 / 031 / 086 : écart Broadcast / Circé (dossier, ou ligne dont la prépa diffère). ──
  const lignesPrepa = await db.receptionAttendue.findMany({
    where: {
      etatLigne: 'ACTIVE',
      themeExclu: false,
      contNum: { not: null },
      qtePrepa: { not: null },
      ...surPlateformes,
    },
    orderBy: [{ semAnnee: 'asc' }, { semNum: 'asc' }],
  })
  const numsBc = [
    ...new Set(lignesPrepa.map((l) => l.contNum).filter((c): c is number => c !== null)),
  ]
  const dossiersBc = await fiches(numsBc)
  for (const n of numsBc) {
    if (dossiersBc.get(n)?.statut === 'ANNULE') continue
    const ecart = (await ecartDossier(db, n, plateformes)) ?? 0
    const lignes = lignesPrepa.filter((l) => l.contNum === n)
    const differente = lignes.find((l) => l.qtePrepa !== l.qteBc)
    if (ecart === 0 && !differente) continue
    const l0 = lignes[0]
    if (!l0) continue
    out.push({
      cle: `BC-${String(n)}`,
      type: 'ECART_BC',
      regle: ecart !== 0 ? 'RG-COO-067' : 'RG-COO-086',
      gravite: 'IMPORTANT',
      titre: 'Écart Broadcast / Circé',
      message:
        ecart !== 0
          ? `Dossier ${String(n)} (${dossiersBc.get(n)?.annonceur ?? l0.annonceur ?? '—'}) : écart de ${ecart > 0 ? '+' : ''}${String(ecart)} entre Broadcast et la préparation reçue par Circé. Appliquer la version Broadcast ou demander une correction.`
          : `Dossier ${String(n)} (${dossiersBc.get(n)?.annonceur ?? l0.annonceur ?? '—'}) : « ${differente?.theme ?? '—'} », Broadcast ${String(differente?.qteBc ?? 0)}, préparation ${String(differente?.qtePrepa ?? 0)}.`,
      lien: lienDossier(n),
      destinataires: [DESTINATAIRES.coord],
      plateformeId: l0.plateformeId,
      depart: formatSemaineIso({ annee: l0.semAnnee, semaine: l0.semNum }),
      date: null,
      dossiers: [n],
    })
  }

  // ── RG-COO-032 : ligne annulée portant une affiche (à re-rattacher), validée ou non. ──
  const annulees = (await alertesValidation(db, plateformes)).filter(
    (a) => a.type === 'LIGNE_ANNULEE',
  )
  if (annulees.length > 0) {
    const lignes = new Map(
      (
        await parPaquets(annulees, (paquet) =>
          db.receptionAttendue.findMany({
            where: { id: { in: paquet.map((a) => a.ligneAttendueId) } },
          }),
        )
      ).map((l) => [l.id, l]),
    )
    for (const a of annulees) {
      const l = lignes.get(a.ligneAttendueId)
      if (!l) continue
      out.push({
        cle: `LA-${String(a.afficheId)}-${String(a.ligneAttendueId)}`,
        type: 'ECART_BC',
        regle: 'RG-COO-032',
        gravite: 'IMPORTANT',
        titre: 'Ligne annulée : affiche à re-rattacher',
        message: `Affiche ${String(a.afficheId)} rattachée au dossier ${String(l.contNum ?? '—')} (« ${l.theme ?? '—'} ») dont la ligne attendue est annulée : le lien est conservé, à re-rattacher par la Coordination.`,
        lien: l.contNum !== null ? lienDossier(l.contNum) : '/coordination',
        destinataires: [DESTINATAIRES.coord],
        plateformeId: l.plateformeId,
        depart: formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }),
        date: l.fermeeLe?.toISOString() ?? null,
        dossiers: l.contNum !== null ? [l.contNum] : [],
      })
    }
  }

  // ── RG-COO-068 / 030 : thème modifié dans Broadcast après la validation. ──
  for (const l of await lignesThemeModifie(db, plateformes)) {
    out.push({
      cle: `TBC-${String(l.ligneAttendueId)}`,
      type: 'THEME_BC',
      regle: 'RG-COO-068',
      gravite: l.productionLancee ? 'CRITIQUE' : 'IMPORTANT',
      titre: l.productionLancee
        ? 'Thème modifié dans Broadcast, production lancée'
        : 'Thème modifié dans Broadcast après la validation',
      message:
        `Dossier ${String(l.contNum ?? '—')} (${l.annonceur ?? '—'}, ${l.atelier}) : Broadcast indique « ${l.themeBroadcast ?? '—'} », Circé a « ${l.themeCirce ?? '—'} ».` +
        (l.productionLancee
          ? ' La production est lancée : vérifier le visuel avec l’atelier.'
          : ' Reprendre la version Broadcast avant la production.'),
      lien: `/coordination/themes?tab=bc${l.contNum !== null ? `&dossier=${String(l.contNum)}` : ''}`,
      destinataires: l.productionLancee
        ? [DESTINATAIRES.coord, DESTINATAIRES.cheq]
        : [DESTINATAIRES.coord],
      plateformeId: l.plateformeId,
      depart: l.depart,
      date: null,
      dossiers: l.contNum !== null ? [l.contNum] : [],
    })
  }

  // ── RG-COO-069 / 070 : thèmes et annonceurs proches à vérifier. ──
  const groupes = await groupesAVerifier(db, identity, maintenant)
  for (const g of groupes.themes)
    out.push({
      cle: `TH-${g.cle}`,
      type: 'THEMES_PROCHES',
      regle: 'RG-COO-069',
      gravite: 'A_SURVEILLER',
      titre: 'Thèmes proches à vérifier',
      message:
        `${g.annonceur} : ${g.libelles.map((l) => `« ${l} »`).join(', ')}` +
        (g.dossiers.length > 1
          ? ` sur ${String(g.dossiers.length)} dossiers (${g.dossiers.join(', ')})`
          : ` dans le dossier ${String(g.dossiers[0] ?? '—')}`) +
        '. Même visuel ? Demander la correction dans Broadcast.',
      lien: `/coordination/themes?dossier=${String(g.dossiers[0] ?? '')}`,
      destinataires: [DESTINATAIRES.coord],
      plateformeId: g.plateformeId,
      depart: g.depart,
      date: null,
      dossiers: g.dossiers,
    })
  for (const g of groupes.annonceurs)
    out.push({
      cle: `AN-${g.cle}`,
      type: 'ANNONCEURS_PROCHES',
      regle: 'RG-COO-070',
      gravite: 'A_SURVEILLER',
      titre: 'Annonceurs proches à vérifier',
      message: `${g.noms.map((l) => `« ${l} »`).join(', ')} sur ${String(g.dossiers.length)} dossiers (${g.dossiers.join(', ')}). Même annonceur ? Demander la correction dans Broadcast.`,
      lien: `/coordination/themes?tab=annonceurs&dossier=${String(g.dossiers[0] ?? '')}`,
      destinataires: [DESTINATAIRES.coord],
      plateformeId: g.plateformeId,
      depart: g.depart,
      date: null,
      dossiers: g.dossiers,
    })

  // ── RG-COO-053 / 074 : renvoi de Broadcast ignoré après l'Instruction OK (DM si production lancée). ──
  const renvois = await db.journalAudit.findMany({
    where: {
      action: 'RENVOI_BROADCAST_IGNORE',
      typeEntite: 'INSTRUCTION',
      le: { gte: depuis },
      ancienneValeur: { in: ['INSTRUCTION_OK', 'PRET_A_PRODUIRE'] },
    },
    orderBy: { id: 'asc' },
  })
  if (renvois.length > 0) {
    const instructions = new Map(
      (
        await parPaquets(renvois, (paquet) =>
          db.instruction.findMany({
            where: { code: { in: paquet.map((r) => r.entiteId) } },
            include: { atelier: { select: { plateformeId: true, libelle: true } } },
          }),
        )
      ).map((i) => [i.code, i]),
    )
    const nums = [...instructions.values()]
      .map((i) => i.contNum)
      .filter((c): c is number => c !== null)
    const [enProd, noms] = await Promise.all([dossiersEnProduction(db, nums), fiches(nums)])
    for (const r of renvois) {
      const i = instructions.get(r.entiteId)
      if (!i || i.contNum === null) continue
      const site = i.atelier?.plateformeId ?? null
      if (plateformes && (site === null || !plateformes.includes(site))) continue
      const dm = enProd.has(i.contNum)
      const depart =
        i.contAnbas && i.contSembas
          ? formatSemaineIso({ annee: i.contAnbas, semaine: i.contSembas })
          : null
      const annonceur = noms.get(i.contNum)?.annonceur ?? i.annonceur ?? '—'
      out.push({
        cle: `RB-${String(r.id)}`,
        // RG-X-077 : dernière minute sur train en production (trace + alerte critique) ; RG-X-078 : renvoi de la
        // préparation après l'export / l'Instruction OK (Q-251, Q-266).
        type: dm ? 'DM_FICHIER' : 'APRES_LIBERATION',
        regle: dm ? 'RG-COO-074' : 'RG-COO-053',
        gravite: dm ? 'CRITIQUE' : 'IMPORTANT',
        titre: dm
          ? 'Dernière minute sur fichier envoyé'
          : 'Préparation renvoyée après l’Instruction OK',
        message: dm
          ? `Dossier ${String(i.contNum)} (${annonceur}) : Broadcast a renvoyé l’instruction ${i.code} alors que la production est lancée. Les trains en production ne changent pas : la modification est tracée, un fichier complémentaire est à générer à part. Mail aux chefs d’équipe du déroulant non envoyé par Circé (Q-375).`
          : `Dossier ${String(i.contNum)} (${annonceur}) : Broadcast a renvoyé la préparation (instruction ${i.code}) après l’Instruction OK. Renvoi ignoré : les trains ne changent pas ; raccrocher à un train pas encore produit, ou produire à part.`,
        lien: lienDossier(i.contNum),
        destinataires: dm ? [DESTINATAIRES.coord, DESTINATAIRES.cheq] : [DESTINATAIRES.coord],
        plateformeId: site,
        depart,
        date: r.le.toISOString(),
        dossiers: [i.contNum],
      })
    }
  }

  // ── RG-COO-073 : préparation intégrée dans la fenêtre « après préparation » (Q-222). ──
  const integrations = await db.journalAudit.findMany({
    where: { action: 'INTEGRATION_PREPARATION', typeEntite: 'DOSSIER', le: { gte: depuis } },
    orderBy: { id: 'asc' },
  })
  if (integrations.length > 0) {
    const nums = [...new Set(integrations.map((j) => Number(j.entiteId)).filter(Number.isFinite))]
    const fenetre = lireFenetre(await lireParametreTexte(db, 'coordination.fenetreRajout'))
    const lignes = await parPaquets(nums, (paquet) =>
      db.receptionAttendue.findMany({
        where: { contNum: { in: paquet }, etatLigne: 'ACTIVE', ...surPlateformes },
        include: { plateforme: { select: { nom: true } } },
        orderBy: [{ semAnnee: 'asc' }, { semNum: 'asc' }],
      }),
    )
    const noms = await fiches(nums)
    for (const j of integrations) {
      const n = Number(j.entiteId)
      const ls = lignes.filter((l) => l.contNum === n)
      const semaines = [
        ...new Map(
          ls.map((l) => [
            `${String(l.semAnnee)}-${String(l.semNum)}`,
            { annee: l.semAnnee, semaine: l.semNum },
          ]),
        ).values(),
      ]
      const dans = semaines.find((s) => {
        const f = fenetre(s)
        return j.le >= f.debut && j.le <= f.fin
      })
      const l0 = ls[0]
      if (!dans || !l0) continue
      out.push({
        cle: `RP-${String(j.id)}`,
        type: 'APRES_LIBERATION',
        regle: 'RG-COO-073',
        gravite: 'IMPORTANT',
        titre: 'Rajout après préparation',
        message: `Dossier ${String(n)} (${noms.get(n)?.annonceur ?? l0.annonceur ?? '—'}) : préparation reçue de Broadcast le ${formatEcheance(j.le)} pour un départ en S${deux(dans.semaine)}, après la préparation de la semaine. Aucun raccrochage automatique : l’atelier choisit de fractionner ou de raccrocher. Mail à la liste « Rajouts après préparation – ${l0.plateforme.nom} » non envoyé par Circé (Q-375).`,
        lien: lienDossier(n),
        destinataires: [DESTINATAIRES.cheq, DESTINATAIRES.admin, DESTINATAIRES.coord],
        plateformeId: l0.plateformeId,
        depart: formatSemaineIso(dans),
        date: j.le.toISOString(),
        dossiers: [n],
      })
    }
  }

  // ── RG-COO-031 (ANO-037) : quantité modifiée par Broadcast après la validation (journalisée). ──
  const journalisees = await alertesAlimentation(db, plateformes, depuis)
  // Un même fait ne donne qu'UNE alerte « Écart Broadcast / Circé » par dossier : l'écart calculé (BC-) prime ;
  // sinon la modification la plus récente (Q-190 (19)).
  const dejaEcart = new Set(out.filter((x) => x.cle.startsWith('BC-')).flatMap((x) => x.dossiers))
  for (const a of journalisees.filter((x) => x.type === 'ECART_QUANTITE')) {
    const n = a.contNum ?? null
    if (n !== null && dejaEcart.has(n)) continue
    if (n !== null) dejaEcart.add(n)
    if (n !== null && (await db.dossier.findUnique({ where: { contNum: n } }))?.statut === 'ANNULE')
      continue
    out.push({
      cle: `QTE-${String(a.id)}`,
      type: 'ECART_BC',
      regle: 'RG-COO-031',
      gravite: 'IMPORTANT',
      titre: 'Quantité modifiée dans Broadcast après la validation',
      message: a.message,
      lien: n !== null ? lienDossier(n) : '/coordination',
      destinataires: [DESTINATAIRES.coord],
      plateformeId: a.plateformeId ?? null,
      depart: null,
      date: a.le.toISOString(),
      dossiers: n !== null ? [n] : [],
    })
  }

  // ── RG-COO-103 / 116 / 122 / 081 / 085 : alertes techniques de l'intégration (coord / admin). ──
  if (hasPermission(identity, 'alimentation.manuelle')) {
    const passages = await db.passageIntegration.findMany({
      where: { statut: { not: 'EN_COURS' } },
      orderBy: { id: 'desc' },
      take: 2,
      include: { flux: { where: { statut: 2 }, orderBy: { ordre: 'asc' } } },
    })
    const [dernier, precedent] = passages
    if (dernier?.statut === 'ECHEC') {
      const flux = dernier.flux[0]
      out.push({
        cle: `INT-ECHEC-${String(dernier.id)}`,
        type: 'INTEGRATION',
        regle: 'RG-COO-116',
        gravite: 'IMPORTANT',
        titre: 'Intégration Broadcast en échec',
        message: `Passage ${String(dernier.id)}${flux ? ` (flux ${flux.flux})` : ''} : ${flux?.message ?? dernier.message ?? 'échec'}. Les flux suivants n’ont pas été exécutés ; le passage est rejouable.`,
        lien: '/coordination/integration',
        destinataires: [DESTINATAIRES.admin, DESTINATAIRES.coord],
        plateformeId: null,
        depart: null,
        date: (dernier.fin ?? dernier.debut).toISOString(),
        dossiers: [],
      })
      if (precedent?.statut === 'ECHEC')
        out.push({
          cle: `INT-ECHECS-${String(dernier.id)}`,
          type: 'INTEGRATION',
          regle: 'RG-COO-103',
          gravite: 'IMPORTANT',
          titre: 'Deux passages d’intégration consécutifs en échec',
          message: `Passages ${String(precedent.id)} et ${String(dernier.id)} en échec : Circé ne lit plus Broadcast. Vérifier la source puis relancer un passage.`,
          lien: '/coordination/integration',
          destinataires: [DESTINATAIRES.admin, DESTINATAIRES.coord],
          plateformeId: null,
          depart: null,
          date: (dernier.fin ?? dernier.debut).toISOString(),
          dossiers: [],
        })
    }
    const refus = await db.journalAudit.findMany({
      where: { action: 'PREPA_RENVOYEE_NON_INTEGREE', le: { gte: depuis } },
      orderBy: { id: 'asc' },
    })
    for (const r of refus) {
      const n = Number(r.entiteId)
      if (
        plateformes &&
        (await db.receptionAttendue.count({ where: { contNum: n, ...surPlateformes } })) === 0
      )
        continue
      out.push({
        cle: `PRNI-${String(r.id)}`,
        type: 'INTEGRATION',
        regle: 'RG-COO-122',
        gravite: 'IMPORTANT',
        titre: 'Prépa renvoyée non intégrée',
        message: `Dossier ${String(n)} : ${r.nouvelleValeur ?? 'préparation renvoyée non intégrée'}`,
        lien: lienDossier(n),
        destinataires: [DESTINATAIRES.coord],
        plateformeId: null,
        depart: null,
        date: r.le.toISOString(),
        dossiers: Number.isFinite(n) ? [n] : [],
      })
    }
    // RG-COO-145 (Q-191 (3)) : demande de déblocage refusée / non reçue par Broadcast (échec d'envoi rejoué à
    // chaque passage) : la main est rendue dans Circé mais pas dans Broadcast.
    const deblocagesNonTransmis = await db.envoiBroadcast.findMany({
      where: { type: 'DEBLOQUER_GROUPE', statut: 'A_ENVOYER', tentatives: { gt: 0 } },
      orderBy: { id: 'asc' },
    })
    for (const e of deblocagesNonTransmis) {
      const trace = await db.deblocagePreparation.findFirst({
        where: { cle: e.cle },
        orderBy: { id: 'desc' },
      })
      if (
        plateformes &&
        (!trace || trace.plateformeId === null || !plateformes.includes(trace.plateformeId))
      )
        continue
      const n = trace?.contNum ?? null
      out.push({
        cle: `DEB-BC-${String(e.id)}`,
        type: 'INTEGRATION',
        regle: 'RG-COO-145',
        gravite: 'IMPORTANT',
        titre: 'Déblocage non transmis à Broadcast',
        message: `Main rendue dans Circé${n !== null ? ` (dossier ${String(n)})` : ''}, mais Broadcast a refusé ou n’a pas reçu la demande de déblocage (${String(e.tentatives)} tentative(s) : ${e.message ?? 'échec'}). Tant que Broadcast n’est pas débloqué, la préparation ne peut pas être renvoyée.`,
        lien:
          n !== null ? `/coordination/deblocage?dossier=${String(n)}` : '/coordination/deblocage',
        destinataires: [DESTINATAIRES.coord, DESTINATAIRES.admin],
        plateformeId: trace?.plateformeId ?? null,
        depart: null,
        date: (trace?.le ?? e.creeLe).toISOString(),
        dossiers: n !== null ? [n] : [],
      })
    }
    const TITRES: Record<string, string> = {
      DONNEE_REFERENCE_MANQUANTE: 'Donnée de référence manquante (alimentation)',
      THEME_SANS_NUMERO: 'Thème lu sans n° de thème',
      AUCUN_CANDIDAT_THEME: 'Saisie des IP : affiche à re-rattacher',
    }
    for (const a of journalisees) {
      // ECART_DA_PREPA : couverte par l'alerte calculée « Écart Broadcast / Circé » (RG-COO-086).
      const titre = TITRES[a.type]
      if (!titre) continue
      out.push({
        cle: `ALIM-${String(a.id)}`,
        type: 'INTEGRATION',
        regle: a.regle,
        gravite: a.type === 'AUCUN_CANDIDAT_THEME' ? 'IMPORTANT' : 'A_SURVEILLER',
        titre,
        message: a.message,
        lien:
          a.contNum !== null && a.contNum !== undefined
            ? lienDossier(a.contNum)
            : '/coordination/integration',
        destinataires: [DESTINATAIRES.coord, DESTINATAIRES.admin],
        plateformeId: a.plateformeId ?? null,
        depart: null,
        date: a.le.toISOString(),
        dossiers: a.contNum !== null && a.contNum !== undefined ? [a.contNum] : [],
      })
    }
  }
  // ── RG-X-076 / RG-COO-242 (Q-265 option (c), HYPOTHÈSE Q-404) : préparation fixe / pliage / bus reçue APRÈS la
  // libération de sa semaine. Alerte calculée à la lecture : une ligne créée après la date de libération du couple
  // (atelier, semaine), regroupée par dossier ; les UM déjà créées ne sont jamais modifiées. Mail non envoyé (Q-375).
  const liberations = await db.liberationSemaine.findMany({
    where: { atelier: surPlateformes },
    include: { atelier: { select: { libelle: true, plateformeId: true } } },
  })
  for (const lib of liberations) {
    const apres = await db.repartition.findMany({
      where: {
        atelierId: lib.atelierId,
        semAnnee: lib.semAnnee,
        semNum: lib.semNum,
        contNum: { not: null },
        statut: { notIn: ['ERREUR', 'ANNULE'] },
        createdAt: { gt: lib.libereeLe, gte: depuis },
      },
      select: { contNum: true, annonceur: true, createdAt: true },
      orderBy: { id: 'asc' },
    })
    const parDossier = new Map<number, (typeof apres)[number]>()
    for (const r of apres)
      if (r.contNum !== null && !parDossier.has(r.contNum)) parDossier.set(r.contNum, r)
    for (const [n, r] of parDossier)
      out.push({
        cle: `LIB-${String(lib.id)}-${String(n)}`,
        type: 'APRES_LIBERATION',
        regle: 'RG-X-076',
        gravite: 'IMPORTANT',
        titre: 'Arrivé après libération',
        message: `Dossier ${String(n)} (${r.annonceur ?? '—'}) : préparation reçue le ${formatEcheance(r.createdAt)} pour la S${deux(lib.semNum)}, après la libération de la semaine vers l’atelier « ${lib.atelier.libelle} » (${formatEcheance(lib.libereeLe)}). Les UM déjà créées ne sont pas modifiées. Mail aux chefs d’équipe du fixe et à la Coordination non envoyé par Circé (Q-375).`,
        lien: `/coordination/unitaire?atelier=${String(lib.atelierId)}&repere=APRES_LIBERATION`,
        destinataires: [DESTINATAIRES.cheq, DESTINATAIRES.coord],
        plateformeId: lib.atelier.plateformeId,
        depart: formatSemaineIso({ annee: lib.semAnnee, semaine: lib.semNum }),
        date: r.createdAt.toISOString(),
        dossiers: [n],
      })
  }
  // ── RG-X-011 / RG-X-010 / RG-X-075 (HYPOTHÈSE Q-398) : affiche reçue APRÈS l'export des trains du dossier. ──
  // Les trains exportés restent figés (RG-COO-223) : la Coordination décide (raccrocher à un train pas encore
  // produit, produire à part). Alerte calculée : mouvement de réception / complément daté après le 1er export
  // des trains du dossier, sur un lien actif ; levée d'elle-même quand la fenêtre d'événements est passée.
  const receptionsRecentes = await db.mouvement.findMany({
    where: { type: { in: ['RECEPTION', 'COMPLEMENT'] }, date: { gte: depuis } },
    select: { afficheId: true, date: true },
    orderBy: { id: 'asc' },
  })
  if (receptionsRecentes.length > 0) {
    const afficheIds = [...new Set(receptionsRecentes.map((m) => m.afficheId))]
    const liens = await parPaquets(afficheIds, (paquet) =>
      db.afficheAttendue.findMany({
        where: {
          actif: true,
          afficheId: { in: paquet },
          ligneAttendue: { contNum: { not: null }, etatLigne: 'ACTIVE', ...surPlateformes },
        },
        select: {
          afficheId: true,
          ligneAttendue: {
            select: { contNum: true, theme: true, plateformeId: true, annonceur: true },
          },
        },
      }),
    )
    const contNums = [
      ...new Set(liens.map((l) => l.ligneAttendue.contNum).filter((c): c is number => c !== null)),
    ]
    const faces = await parPaquets(contNums, (paquet) =>
      db.faceTrain.findMany({
        where: { contNum: { in: paquet }, trainId: { not: null }, statut: { in: STATUTS_TRAIN } },
        select: { contNum: true, trainId: true, theme: true },
      }),
    )
    const trainIds = [
      ...new Set(faces.map((f) => f.trainId).filter((t): t is string => t !== null)),
    ]
    const exports = await parPaquets(trainIds, (paquet) =>
      db.exportTrainLigne.findMany({
        where: { trainId: { in: paquet }, export: { nature: 'EXPORT_TRAINS' } },
        select: { trainId: true, export: { select: { le: true } } },
      }),
    )
    const exporteLe = new Map<string, Date>()
    for (const e of exports) {
      const deja = exporteLe.get(e.trainId)
      if (!deja || e.export.le < deja) exporteLe.set(e.trainId, e.export.le)
    }
    const nomsDossiers = await fiches(contNums)
    for (const l of liens) {
      const n = l.ligneAttendue.contNum
      if (n === null) continue
      const facesDossier = faces.filter((f) => f.contNum === n)
      const exportsDossier = facesDossier
        .map((f) => (f.trainId ? exporteLe.get(f.trainId) : undefined))
        .filter((d): d is Date => d !== undefined)
      const premierExport = exportsDossier.sort((a, b) => a.getTime() - b.getTime())[0]
      if (!premierExport) continue
      const recue = receptionsRecentes
        .filter((m) => m.afficheId === l.afficheId && m.date > premierExport)
        .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
      if (!recue) continue
      const couvert = facesDossier.some(
        (f) => cleTheme(f.theme) === cleTheme(l.ligneAttendue.theme),
      )
      out.push({
        cle: `RX-${String(l.afficheId)}-${String(n)}`,
        type: 'APRES_LIBERATION',
        regle: 'RG-X-011',
        gravite: 'IMPORTANT',
        titre: 'Affiche reçue après l’export des trains',
        message: `Dossier ${String(n)} (${nomsDossiers.get(n)?.annonceur ?? l.ligneAttendue.annonceur ?? '—'}) : l’affiche ${String(l.afficheId)} (${l.ligneAttendue.theme ?? 'thème non saisi'}) est arrivée le ${formatEcheance(recue.date)}, après l’export des trains (${formatEcheance(premierExport)}). Les trains exportés restent figés${couvert ? '' : ' et ce visuel ne figure dans aucun train du dossier'} : raccrocher à un train pas encore produit, ou produire à part (aucun raccrochage automatique). Mail à la liste de distribution non envoyé par Circé (Q-375).`,
        lien: lienDossier(n),
        destinataires: [DESTINATAIRES.coord, DESTINATAIRES.cheq],
        plateformeId: l.ligneAttendue.plateformeId,
        depart: null,
        date: recue.date.toISOString(),
        dossiers: [n],
      })
    }
  }
  return out
}
