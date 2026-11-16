// D-19 — Consultation et pilotage de la file des mails (API seule : aucune maquette de l'écran, ECR-ADM-04 ne montre que
// la configuration des canaux). Droit `parametrage.gerer` (administrateur seul), vérifié dans le service (RG-REC-002).
// Hypothèses : Q-409.
import {
  STATUTS_MAIL,
  TypeMailSchema,
  type ListeMails,
  type MailFile,
  type ResultatTraitementMails,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import type { MailPort } from '../../core/ports/mail.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { updateWithVersion } from '../../core/versioning.ts'
import { ADM, assertDroitAdmin } from '../admin/permissions.ts'
import { traiterFileMails } from './file.ts'

const DROIT = 'parametrage.gerer'

type Ligne = NonNullable<Awaited<ReturnType<Db['mailFile']['findFirst']>>>

function vue(m: Ligne): MailFile {
  return {
    id: m.id,
    type: TypeMailSchema.parse(m.type),
    statut: m.statut as MailFile['statut'],
    destinataires: m.destinataires.split(';').filter(Boolean),
    sujet: m.sujet,
    corps: m.corps,
    tentatives: m.tentatives,
    derniereErreur: m.derniereErreur,
    canal: m.canal === 'SIMULE' || m.canal === 'SMTP' ? m.canal : null,
    sourceType: m.sourceType,
    sourceId: m.sourceId,
    creeLe: m.creeLe.toISOString(),
    envoyeLe: m.envoyeLe?.toISOString() ?? null,
    version: m.version,
  }
}

// EX-TRA-030 : consultation de la file (les plus récents d'abord, 200 lignes au plus).
export async function listerMails(
  db: Db,
  identity: Identity,
  mail: MailPort,
  q: { statut?: string | undefined; type?: string | undefined; limite: number },
): Promise<ListeMails> {
  assertDroitAdmin(identity, DROIT)
  const where = {
    ...(q.statut ? { statut: q.statut } : {}),
    ...(q.type ? { type: q.type } : {}),
  }
  const [lignes, total, groupes] = await Promise.all([
    db.mailFile.findMany({ where, orderBy: { id: 'desc' }, take: q.limite }),
    db.mailFile.count({ where }),
    db.mailFile.groupBy({ by: ['statut'], _count: { _all: true } }),
  ])
  const parStatut: Record<string, number> = Object.fromEntries(STATUTS_MAIL.map((s) => [s, 0]))
  for (const g of groupes) parStatut[g.statut] = g._count._all
  return { mails: lignes.map(vue), total, canalActif: mail.canal, parStatut }
}

// EX-TRA-030 : traitement manuel de la file (même fonction que la tâche planifiée ENVOI_MAILS).
export async function traiterMailsManuel(
  db: Db,
  identity: Identity,
  mail: MailPort,
): Promise<ResultatTraitementMails> {
  assertDroitAdmin(identity, DROIT)
  const r = await traiterFileMails({ db, mail }, { parId: identity.userId })
  return {
    ...r,
    message:
      r.canal === 'SIMULE'
        ? `${String(r.envoyes)} mail(s) déposé(s) dans la boîte d’envoi de développement : aucun mail réel n’est parti (SMTP non activé, Q-409).`
        : `${String(r.envoyes)} mail(s) envoyé(s), ${String(r.echecs)} échec(s).`,
  }
}

// RG-ADM-045 (HYPOTHÈSE Q-409) : un mail en échec définitif (10 tentatives) se relance à la main, sous verrou de version.
export async function relancerMail(
  tx: Tx,
  identity: Identity,
  id: number,
  version: number,
): Promise<MailFile> {
  assertDroitAdmin(identity, DROIT)
  const m = await tx.mailFile.findUnique({ where: { id } })
  if (!m) throw new NotFoundError('Mail introuvable', { code: 'ADM_MAIL_INTROUVABLE' })
  if (m.statut !== 'ECHEC')
    throw new ConflictError('Seul un mail en échec peut être relancé.', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-ADM-045',
      details: { statut: m.statut },
    })
  await updateWithVersion({
    expectedVersion: version,
    update: (where) =>
      tx.mailFile.updateMany({
        where: { id, statut: 'ECHEC', ...where },
        data: {
          statut: 'EN_ATTENTE',
          tentatives: 0,
          derniereErreur: null,
          version: { increment: 1 },
        },
      }),
    ...ADM.version,
  })
  await ecrireJournal(tx, {
    typeEntite: 'MAIL',
    entiteId: id,
    action: 'RELANCE_MAIL',
    parId: identity.userId,
    ancienneValeur: 'ECHEC',
    nouvelleValeur: 'EN_ATTENTE',
  })
  return vue(await tx.mailFile.findUniqueOrThrow({ where: { id } }))
}
