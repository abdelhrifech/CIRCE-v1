// D-19 — File d'envoi des mails (EX-TRA-030, RG-ADM-043 à 045 provisoires, Q-375, Q-285, Q-219, Q-409).
// Principe (Q-219 : « envoi après commit, échec tracé sans annuler l'action ») :
//  1. le fait métier écrit une ligne de file dans SA transaction (`mettreEnFileMail`, idempotent par `cle`) ;
//  2. un traitement séparé (`traiterFileMails`) réserve la ligne, appelle le port HORS transaction, puis enregistre le
//     résultat (et le marquage du fait : `mailEnvoye`, `mailStatut`) dans une transaction.
// RG-ADM-045 : 10 tentatives au plus ; un colis n'est marqué « envoyé » que si l'envoi réussit (la retentative n'est
// jamais perdue, contrairement au legacy : Q-285). Un canal SIMULE (boîte d'envoi de développement) ne marque rien.
import { AdresseMailSchema, type TypeMail } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { MailPort } from '../../core/ports/mail.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'

/** RG-ADM-045 : 10 tentatives (le legacy les espaçait de 10 s ; ici une tentative par passage du traitement, Q-409). */
export const MAIL_TENTATIVES_MAX = 10
/** Une ligne « EN_COURS » depuis plus longtemps (arrêt du serveur en cours d'envoi) est remise en attente. */
const RESERVATION_PERIMEE_MS = 15 * 60_000

export interface EntreeMail {
  type: TypeMail
  /** Clé de fait métier : une seule mise en file par clé (ex. « COLIS:12 »). */
  cle: string
  source?: { type: 'COLIS' | 'DEBLOCAGE' | 'CORRECTION_BROADCAST'; id: number }
  /** Adresses brutes (listes séparées par « , » ou « ; » acceptées) ; les invalides sont écartées. */
  destinataires: (string | null | undefined)[]
  sujet: string
  corps: string
  parId: number | null
}

/** Adresses valides, normalisées, sans doublon (ordre conservé). */
export function adressesValides(brutes: (string | null | undefined)[]): string[] {
  const vues = new Set<string>()
  for (const brute of brutes)
    for (const morceau of (brute ?? '').split(/[;,]/)) {
      const a = AdresseMailSchema.safeParse(morceau)
      if (a.success) vues.add(a.data)
    }
  return [...vues]
}

/**
 * Met le mail en file dans la transaction du fait métier. Sans adresse valide : rien n'est mis en file (retourne null :
 * l'appelant trace « sans destinataire »). Deuxième appel avec la même clé : aucune nouvelle ligne.
 */
export async function mettreEnFileMail(
  tx: Tx,
  e: EntreeMail,
): Promise<{ id: number; dejaEnFile: boolean } | null> {
  const destinataires = adressesValides(e.destinataires)
  if (destinataires.length === 0) return null
  const existant = await tx.mailFile.findUnique({ where: { cle: e.cle }, select: { id: true } })
  if (existant) return { id: existant.id, dejaEnFile: true }
  const cree = await tx.mailFile.create({
    data: {
      type: e.type,
      cle: e.cle,
      sourceType: e.source?.type ?? null,
      sourceId: e.source?.id ?? null,
      destinataires: destinataires.join(';'),
      sujet: e.sujet.slice(0, 300),
      corps: e.corps,
      parId: e.parId,
    },
  })
  await ecrireJournal(tx, {
    typeEntite: 'MAIL',
    entiteId: cree.id,
    action: 'CREATION_MAIL',
    parId: e.parId,
    nouvelleValeur: e.sujet,
    donnees: { type: e.type, cle: e.cle, destinataires },
  })
  return { id: cree.id, dejaEnFile: false }
}

export interface ResultatTraitement {
  envoyes: number
  echecs: number
  restants: number
  canal: 'SIMULE' | 'SMTP'
}

interface LigneFile {
  id: number
  type: string
  sourceType: string | null
  sourceId: number | null
  tentatives: number
}

/** Marquage du fait d'origine (même transaction que le résultat). */
async function marquerSource(
  tx: Tx,
  m: LigneFile,
  etat: 'ENVOYE' | 'SIMULE' | 'ECHEC',
): Promise<void> {
  if (m.sourceId === null) return
  if (m.sourceType === 'COLIS' && etat === 'ENVOYE')
    // RG-COO-271 : « mail colis envoyé » seulement si l'envoi a réussi.
    await tx.colis.updateMany({ where: { id: m.sourceId }, data: { mailEnvoye: true } })
  else if (m.sourceType === 'DEBLOCAGE')
    // RG-COO-147 : état du mail dans la trace du déblocage.
    await tx.deblocagePreparation.updateMany({
      where: { id: m.sourceId },
      data: { mailStatut: etat },
    })
  else if (m.sourceType === 'CORRECTION_BROADCAST' && etat === 'ENVOYE')
    // RG-COO-057 : demande de correction dont le mail est parti.
    await tx.demandeCorrection.updateMany({ where: { id: m.sourceId }, data: { mailEnvoye: true } })
}

/**
 * Traite la file : une tentative par ligne « EN_ATTENTE ». Concurrence : la réservation (`updateMany where statut et
 * version`) est atomique, deux traitements simultanés n'envoient jamais la même ligne. Un échec n'annule rien d'autre
 * (Q-219) : il est tracé (journal + `derniereErreur`) et la ligne reste en attente jusqu'à 10 tentatives.
 */
export async function traiterFileMails(
  ctx: { db: Db; mail: MailPort },
  opts: { limite?: number; parId?: number | null; maintenant?: Date } = {},
): Promise<ResultatTraitement> {
  const { db, mail } = ctx
  const maintenant = opts.maintenant ?? new Date()
  await db.mailFile.updateMany({
    where: {
      statut: 'EN_COURS',
      tentativeLe: { lt: new Date(maintenant.getTime() - RESERVATION_PERIMEE_MS) },
    },
    data: { statut: 'EN_ATTENTE' },
  })
  const candidats = await db.mailFile.findMany({
    where: { statut: 'EN_ATTENTE' },
    orderBy: { id: 'asc' },
    take: opts.limite ?? 100,
  })
  let envoyes = 0
  let echecs = 0
  for (const c of candidats) {
    const reserve = await db.mailFile.updateMany({
      where: { id: c.id, statut: 'EN_ATTENTE', version: c.version },
      data: {
        statut: 'EN_COURS',
        tentatives: { increment: 1 },
        tentativeLe: maintenant,
        version: { increment: 1 },
      },
    })
    if (reserve.count === 0) continue // pris par un autre traitement
    const ligne: LigneFile = {
      id: c.id,
      type: c.type,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      tentatives: c.tentatives + 1,
    }
    let erreur: string | null = null
    try {
      await mail.envoyer({
        destinataires: c.destinataires.split(';').filter(Boolean),
        sujet: c.sujet,
        corps: c.corps,
      })
    } catch (e) {
      erreur = (e instanceof Error ? e.message : String(e)).slice(0, 500)
    }
    await db.$transaction(async (tx) => {
      if (erreur === null) {
        await tx.mailFile.updateMany({
          where: { id: c.id, statut: 'EN_COURS' },
          data: {
            statut: 'ENVOYE',
            canal: mail.canal,
            envoyeLe: new Date(),
            derniereErreur: null,
            version: { increment: 1 },
          },
        })
        await marquerSource(tx, ligne, mail.canal === 'SMTP' ? 'ENVOYE' : 'SIMULE')
        await ecrireJournal(tx, {
          typeEntite: 'MAIL',
          entiteId: c.id,
          action: 'ENVOI_MAIL',
          parId: opts.parId ?? null,
          nouvelleValeur: mail.canal === 'SMTP' ? 'ENVOYE' : 'SIMULE',
          complement: c.type,
        })
      } else {
        const definitif = ligne.tentatives >= MAIL_TENTATIVES_MAX
        await tx.mailFile.updateMany({
          where: { id: c.id, statut: 'EN_COURS' },
          data: {
            statut: definitif ? 'ECHEC' : 'EN_ATTENTE',
            derniereErreur: erreur,
            version: { increment: 1 },
          },
        })
        if (definitif) await marquerSource(tx, ligne, 'ECHEC')
        await ecrireJournal(tx, {
          typeEntite: 'MAIL',
          entiteId: c.id,
          action: 'ECHEC_MAIL',
          parId: opts.parId ?? null,
          nouvelleValeur: definitif ? 'ECHEC' : 'EN_ATTENTE',
          complement: erreur,
          donnees: { tentatives: ligne.tentatives },
        })
      }
    })
    if (erreur === null) envoyes += 1
    else echecs += 1
  }
  return {
    envoyes,
    echecs,
    restants: await db.mailFile.count({ where: { statut: { in: ['EN_ATTENTE', 'EN_COURS'] } } }),
    canal: mail.canal,
  }
}
