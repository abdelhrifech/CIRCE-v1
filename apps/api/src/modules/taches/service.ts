// D-20 — Traitements planifiés (EX-REC-512, RG-REC-180 / 181, RG-COO-269, RG-COO-042, EX-TRA-030 ; Q-005, Q-006, Q-410).
// Chaque tâche est IDEMPOTENTE (un second passage ne trouve plus rien à faire) et réutilise la logique des actions
// manuelles dans la même transaction. Verrou anti double exécution : `tache_execution.verrou` UNIQUE (= nom de la
// tâche tant qu'elle s'exécute), comme le passage d'intégration (RG-COO-102). Journal d'exécution : tâche, début, fin,
// résultat. Les horaires viennent des paramètres D-06 `taches.*` ; vides = tâche désactivée (aucun horaire n'est
// sourcé : Q-005). L'acteur des tâches est le compte technique « Circé (automatique) » (RG-COO-061 / 160).
import { NOMS_TACHES, type ExecutionTache, type ListeTaches, type NomTache } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import type { MailPort } from '../../core/ports/mail.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import { Prisma } from '../../generated/prisma/client.ts'
import { assertDroitAdmin, IDENTIFIANT_SYSTEME } from '../admin/permissions.ts'
import { finDeJournee } from '../coordination/colis.ts'
import { CIRCE_AUTOMATIQUE } from '../coordination/integration-commun.ts'
import { evaluerInstructionOkAuto } from '../coordination/instruction-ok.ts'
import { traiterFileMails } from '../mails/file.ts'
import { lireParametreTexte } from '../reception/parametres.ts'
import { purgerReceptionsAttendues } from '../reception/purge.ts'

export interface ContexteTaches {
  db: Db
  mail: MailPort
  maintenant?: () => Date
}

type CleHoraires =
  | 'taches.finJourneeColis'
  | 'taches.purgeAttendues'
  | 'taches.instructionOkAuto'
  | 'taches.envoiMails'

interface DefinitionTache {
  libelle: string
  regle: string
  parametre: CleHoraires
  executer: (
    ctx: ContexteTaches,
    maintenant: Date,
  ) => Promise<{ message: string; resultat: unknown }>
}

export { IDENTIFIANT_SYSTEME }

/** Compte technique (HYPOTHÈSE Q-410 (3)) : créé au premier besoin ; jamais actif ; voit tous les sites. */
export async function identiteSysteme(db: Db): Promise<Identity> {
  let u = await db.utilisateur.findUnique({ where: { identifiantExterne: IDENTIFIANT_SYSTEME } })
  if (!u) {
    try {
      u = await db.utilisateur.create({
        data: { identifiantExterne: IDENTIFIANT_SYSTEME, nom: CIRCE_AUTOMATIQUE, actif: false },
      })
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') throw e
      u = await db.utilisateur.findUniqueOrThrow({
        where: { identifiantExterne: IDENTIFIANT_SYSTEME },
      })
    }
  }
  // Q-412 : le compte technique doit rester inactif et sans rôle ni périmètre en base ; sinon il pourrait
  // s'authentifier : les tâches s'arrêtent plutôt que d'agir sous une identité compromise.
  const [roles, perimetres] = await Promise.all([
    db.utilisateurRole.count({ where: { utilisateurId: u.id } }),
    db.utilisateurPerimetre.count({ where: { utilisateurId: u.id } }),
  ])
  if (u.actif || roles > 0 || perimetres > 0)
    throw new ConflictError(
      `Le compte technique « ${IDENTIFIANT_SYSTEME} » est actif ou porte des rôles / un périmètre : tâches arrêtées.`,
      { code: 'TACHE_COMPTE_TECHNIQUE_INVALIDE' },
    )
  return {
    userId: u.id,
    identifiantExterne: u.identifiantExterne,
    nom: CIRCE_AUTOMATIQUE,
    // Rôle Expédition : `finDeJournee` exige `colis.gerer` (cheq, expe) : la garde de l'action manuelle est conservée.
    roles: ['expe'],
    perimetre: { toutesPlateformes: true, plateformeIds: [], lignes: [] },
    siteId: null,
  }
}

const TIMEOUT_TRANSACTION = 60_000

export const TACHES: Record<NomTache, DefinitionTache> = {
  FIN_JOURNEE_COLIS: {
    libelle: 'Fin de journée des colis',
    regle: 'RG-COO-269',
    parametre: 'taches.finJourneeColis',
    // RG-COO-269 : même fonction et même transaction unique que « Fin de journée » (action manuelle).
    async executer(ctx, maintenant) {
      const identite = await identiteSysteme(ctx.db)
      const r = await ctx.db.$transaction((tx) => finDeJournee(tx, identite, maintenant), {
        timeout: TIMEOUT_TRANSACTION,
        maxWait: TIMEOUT_TRANSACTION,
      })
      return {
        message: r.message,
        resultat: {
          colis: r.colis.length,
          unites: r.unites,
          faces: r.faces,
          sortiesStock: r.sortiesStock,
          manquants: r.manquants.length,
        },
      }
    },
  },
  PURGE_ATTENDUES: {
    libelle: 'Purge des réceptions attendues',
    regle: 'RG-REC-180',
    parametre: 'taches.purgeAttendues',
    // RG-REC-180 / 181 : purge sans alerte ni validation, une ligne au journal (écrite par la fonction).
    async executer(ctx, maintenant) {
      const purgees = await purgerReceptionsAttendues(ctx.db, maintenant)
      return {
        message: `${String(purgees)} réception(s) attendue(s) purgée(s).`,
        resultat: { purgees },
      }
    },
  },
  INSTRUCTION_OK_AUTO: {
    libelle: 'Instruction OK automatique (rattrapage)',
    regle: 'RG-COO-042',
    parametre: 'taches.instructionOkAuto',
    // RG-COO-042 (Q-204 option b) : même règle de Nariman que l'évaluation à l'arrivée de la prépa, rejouée sur les
    // instructions « En cours » dont la prépa est reçue. Une transaction par instruction (une échec n'en annule pas
    // une autre) ; une instruction qui ne respecte pas la règle reste « En cours ».
    async executer(ctx) {
      const candidates = await ctx.db.instruction.findMany({
        where: { statut: 'EN_COURS', dossier: { statut: 'PREPARATION_RECUE' } },
        select: { code: true },
        orderBy: { code: 'asc' },
      })
      let instructionOk = 0
      let restentEnCours = 0
      const erreurs: { code: string; message: string }[] = []
      for (const c of candidates) {
        try {
          const r = await ctx.db.$transaction((tx) => evaluerInstructionOkAuto(tx, c.code), {
            timeout: TIMEOUT_TRANSACTION,
            maxWait: TIMEOUT_TRANSACTION,
          })
          if (r === 'INSTRUCTION_OK') instructionOk += 1
          else restentEnCours += 1
        } catch (e) {
          erreurs.push({ code: c.code, message: e instanceof Error ? e.message : String(e) })
        }
      }
      if (erreurs.length > 0)
        throw new ErreurTache(
          `${String(erreurs.length)} instruction(s) en erreur (les autres sont traitées).`,
          { instructionOk, restentEnCours, erreurs },
        )
      return {
        message: `${String(instructionOk)} instruction(s) passée(s) en Instruction OK, ${String(restentEnCours)} restent « En cours ».`,
        resultat: { examinees: candidates.length, instructionOk, restentEnCours },
      }
    },
  },
  ENVOI_MAILS: {
    libelle: 'Envoi des mails en file',
    regle: 'EX-TRA-030',
    parametre: 'taches.envoiMails',
    async executer(ctx, maintenant) {
      const identite = await identiteSysteme(ctx.db)
      const r = await traiterFileMails(
        { db: ctx.db, mail: ctx.mail },
        { parId: identite.userId, maintenant },
      )
      return {
        message:
          r.canal === 'SIMULE'
            ? `${String(r.envoyes)} mail(s) déposé(s) dans la boîte d’envoi de développement (aucun mail réel), ${String(r.echecs)} échec(s).`
            : `${String(r.envoyes)} mail(s) envoyé(s), ${String(r.echecs)} échec(s).`,
        resultat: r,
      }
    },
  },
}

/** Échec d'une tâche avec un résultat partiel à conserver au journal d'exécution. */
class ErreurTache extends Error {
  constructor(
    message: string,
    readonly resultat: unknown,
  ) {
    super(message)
  }
}

/** Un verrou resté « actif » plus longtemps (arrêt du serveur en cours de tâche) est libéré. */
const VERROU_PERIME_MS = 2 * 3_600_000

type Declencheur = 'PLANIFIE' | 'MANUEL' | 'COMMANDE'

type LigneExecution = NonNullable<Awaited<ReturnType<Db['tacheExecution']['findFirst']>>>

function vueExecution(e: LigneExecution, par: string | null): ExecutionTache {
  return {
    id: e.id,
    tache: e.tache as NomTache,
    declencheur: e.declencheur as Declencheur,
    par,
    statut: e.statut as ExecutionTache['statut'],
    debut: e.debut.toISOString(),
    fin: e.fin?.toISOString() ?? null,
    message: e.message,
    resultat: e.resultat === null ? null : (JSON.parse(e.resultat) as unknown),
  }
}

async function nomsAuteurs(db: Db, ids: (number | null)[]): Promise<Map<number, string>> {
  const uniques = [...new Set(ids.filter((i): i is number => i !== null))]
  if (uniques.length === 0) return new Map()
  const us = await db.utilisateur.findMany({ where: { id: { in: uniques } } })
  return new Map(us.map((u) => [u.id, u.nom ?? u.identifiantExterne]))
}

/**
 * Exécute une tâche sous verrou. `identity` (déclenchement manuel) exige le droit `parametrage.gerer` ; sans identité
 * (ordonnanceur, commande) c'est le compte technique qui agit. Une tâche déjà en cours → 409 (aucune seconde
 * exécution). Une tâche en échec est journalisée (statut ECHEC) : ses écritures atomiques sont annulées.
 */
export async function executerTache(
  ctx: ContexteTaches,
  nom: NomTache,
  opts: { declencheur: Declencheur; identity: Identity | null },
): Promise<ExecutionTache> {
  if (opts.identity) assertDroitAdmin(opts.identity, 'parametrage.gerer')
  const { db } = ctx
  const maintenant = ctx.maintenant?.() ?? new Date()
  await db.tacheExecution.updateMany({
    where: { verrou: nom, debut: { lt: new Date(maintenant.getTime() - VERROU_PERIME_MS) } },
    data: {
      verrou: null,
      statut: 'ECHEC',
      fin: maintenant,
      message: 'Exécution interrompue (verrou périmé libéré).',
    },
  })
  const acteur = opts.identity?.userId ?? (await identiteSysteme(db)).userId
  let execution: LigneExecution
  try {
    execution = await db.tacheExecution.create({
      data: {
        tache: nom,
        declencheur: opts.declencheur,
        parId: acteur,
        statut: 'EN_COURS',
        verrou: nom,
        debut: maintenant,
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      throw new ConflictError(
        `La tâche « ${TACHES[nom].libelle} » est déjà en cours d'exécution.`,
        {
          code: 'TACHE_DEJA_EN_COURS',
          details: { tache: nom },
        },
      )
    throw e
  }
  let statut: 'SUCCES' | 'ECHEC' = 'SUCCES'
  let message: string
  let resultat: unknown = null
  try {
    const r = await TACHES[nom].executer(ctx, maintenant)
    message = r.message
    resultat = r.resultat
  } catch (e) {
    statut = 'ECHEC'
    message = e instanceof Error ? e.message : String(e)
    if (e instanceof ErreurTache) resultat = e.resultat
  }
  const fin = ctx.maintenant?.() ?? new Date()
  const termine = await db.$transaction(async (tx) => {
    const maj = await tx.tacheExecution.update({
      where: { id: execution.id },
      data: {
        statut,
        verrou: null,
        fin,
        message: message.slice(0, 500),
        resultat: resultat === null ? null : JSON.stringify(resultat),
      },
    })
    await ecrireJournal(tx, {
      typeEntite: 'TACHE',
      entiteId: nom,
      action: 'EXECUTION_TACHE',
      parId: acteur,
      nouvelleValeur: statut,
      complement: message.slice(0, 500),
      donnees: { executionId: execution.id, declencheur: opts.declencheur, resultat },
    })
    return maj
  })
  return vueExecution(termine, (await nomsAuteurs(db, [acteur])).get(acteur) ?? null)
}

const horairesDe = (valeur: string) =>
  valeur
    .split(';')
    .map((x) => x.trim())
    .filter((x) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(x))
    .map((x) => x.padStart(5, '0'))

// D-20 : liste des tâches avec leurs horaires (D-06) et leur dernière exécution.
export async function listerTaches(
  db: Db,
  identity: Identity,
  ordonnanceurActif: boolean,
): Promise<ListeTaches> {
  assertDroitAdmin(identity, 'parametrage.gerer')
  const taches: ListeTaches['taches'] = []
  for (const nom of NOMS_TACHES) {
    const d = TACHES[nom]
    const horaires = horairesDe(await lireParametreTexte(db, d.parametre))
    const derniere = await db.tacheExecution.findFirst({
      where: { tache: nom },
      orderBy: { id: 'desc' },
    })
    taches.push({
      nom,
      libelle: d.libelle,
      regle: d.regle,
      parametre: d.parametre,
      horaires,
      active: horaires.length > 0,
      derniere: derniere
        ? vueExecution(
            derniere,
            (await nomsAuteurs(db, [derniere.parId])).get(derniere.parId ?? -1) ?? null,
          )
        : null,
    })
  }
  return { taches, ordonnanceurActif }
}

export async function listerExecutions(
  db: Db,
  identity: Identity,
  q: { tache?: NomTache | undefined; limite: number },
): Promise<ExecutionTache[]> {
  assertDroitAdmin(identity, 'parametrage.gerer')
  const lignes = await db.tacheExecution.findMany({
    where: q.tache ? { tache: q.tache } : {},
    orderBy: { id: 'desc' },
    take: q.limite,
  })
  const auteurs = await nomsAuteurs(
    db,
    lignes.map((l) => l.parId),
  )
  return lignes.map((l) =>
    vueExecution(l, l.parId === null ? null : (auteurs.get(l.parId) ?? null)),
  )
}

/** Horaires « HH:MM » (heure locale du serveur) échus dans l'intervalle ]depuis, jusqua]. */
export function horaireEchu(horaires: string[], depuis: Date, jusqua: Date): boolean {
  for (const h of horairesDe(horaires.join(';'))) {
    const [hh, mm] = h.split(':').map(Number)
    for (const jour of [depuis, jusqua]) {
      const d = new Date(jour)
      d.setHours(hh ?? 0, mm ?? 0, 0, 0)
      if (d > depuis && d <= jusqua) return true
    }
  }
  return false
}

/** Exécute les tâches dont un horaire est échu entre `depuis` et `jusqua` (appelé à chaque pulsation). */
export async function executerEcheances(
  ctx: ContexteTaches,
  depuis: Date,
  jusqua: Date,
  journal: (message: string, erreur?: unknown) => void = () => undefined,
): Promise<NomTache[]> {
  const lancees: NomTache[] = []
  for (const nom of NOMS_TACHES) {
    const horaires = horairesDe(await lireParametreTexte(ctx.db, TACHES[nom].parametre))
    if (!horaireEchu(horaires, depuis, jusqua)) continue
    try {
      await executerTache(ctx, nom, { declencheur: 'PLANIFIE', identity: null })
      lancees.push(nom)
    } catch (e) {
      journal(`Tâche planifiée « ${nom} » non lancée`, e)
    }
  }
  return lancees
}

/** Ordonnanceur interne : une pulsation toutes les 30 s ; sans horaire configuré il ne fait rien (Q-410). */
export function demarrerOrdonnanceur(
  ctx: ContexteTaches,
  journal: (message: string, erreur?: unknown) => void,
  intervalleMs = 30_000,
): () => void {
  let dernier = new Date()
  let enCours = false
  const minuterie = setInterval(() => {
    if (enCours) return
    enCours = true
    const depuis = dernier
    const jusqua = new Date()
    dernier = jusqua
    executerEcheances(ctx, depuis, jusqua, journal)
      .catch((e: unknown) => {
        journal('Pulsation de l’ordonnanceur en erreur', e)
      })
      .finally(() => {
        enCours = false
      })
  }, intervalleMs)
  minuterie.unref()
  return () => {
    clearInterval(minuterie)
  }
}
