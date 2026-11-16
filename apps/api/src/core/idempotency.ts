import { createHash } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { Prisma } from '../generated/prisma/client.ts'
import type { Db } from './db.ts'
import { ConflictError, ValidationError } from './errors.ts'
import type { Tx } from './transaction.ts'

export const IDEMPOTENCY_HEADER = 'idempotency-key'
export const IDEMPOTENCY_REPLAY_HEADER = 'idempotent-replayed'
/** Rétention des clés : 24 h (Q-348 : durée à confirmer). */
export const IDEMPOTENCY_TTL_MS = 24 * 3600 * 1000

/** RG-REC-008 : les POST de création / transition portent obligatoirement un Idempotency-Key. */
export function requireIdempotencyKey(request: FastifyRequest): string {
  const raw = request.headers[IDEMPOTENCY_HEADER]
  const key = typeof raw === 'string' ? raw.trim() : ''
  if (!key || key.length > 200) {
    throw new ValidationError('En-tête Idempotency-Key obligatoire (1 à 200 caractères)', {
      code: 'IDEMPOTENCE_CLE_MANQUANTE',
      regle: 'RG-REC-008',
    })
  }
  return key
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    )
  }
  return value
}

/** Empreinte de la requête : même clé + corps différent = conflit. Indépendante de l'ordre des clés. */
export function empreinteRequete(method: string, path: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method.toUpperCase()} ${path}\n${JSON.stringify(stable(body ?? null))}`)
    .digest('hex')
}

export interface IdempotentResult<T> {
  status: number
  body: T
  /** true si la réponse est rejouée (aucune nouvelle écriture métier). */
  replayed: boolean
}

interface IdempotencyOptions {
  userId: number
  key: string
  method: string
  path: string
  body: unknown
  now?: Date
  /** Délai de la transaction en ms (défaut Prisma : 5 000) : opérations en masse (ex. fin de journée, RG-COO-269). */
  timeoutMs?: number
  /** Code et RG du MODULE en cas de conflit (ex. REC_IDEMPOTENCE_CONFLIT / RG-REC-008) : obligatoires. */
  code: string
  regle: string
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/**
 * CLAUDE.md §6 / RG-REC-008 : exécute `execute` une seule fois par (utilisateur, clé).
 * - rejeu, même corps : renvoie la réponse initiale sans rien réécrire ;
 * - même clé, corps différent : 409 ;
 * - la réservation de la clé, l'opération et la réponse sont dans UNE transaction : si l'opération
 *   échoue, rien n'est gardé (la clé peut être rejouée après correction).
 */
export async function withIdempotency<T>(
  db: Db,
  options: IdempotencyOptions,
  execute: (tx: Tx) => Promise<{ status: number; body: T }>,
): Promise<IdempotentResult<T>> {
  const now = options.now ?? new Date()
  const empreinte = empreinteRequete(options.method, options.path, options.body)
  const where = { utilisateurId_cle: { utilisateurId: options.userId, cle: options.key } }

  const rejouer = async (): Promise<IdempotentResult<T> | null> => {
    const row = await db.cleIdempotence.findUnique({ where })
    if (!row) return null
    if (row.expireLe <= now) {
      await db.cleIdempotence.delete({ where })
      return null
    }
    if (row.empreinte !== empreinte) {
      throw new ConflictError('Cette clé d’idempotence a déjà servi pour une autre requête.', {
        code: options.code,
        regle: options.regle,
      })
    }
    if (row.statutHttp === null || row.reponse === null) {
      throw new ConflictError('La même requête est déjà en cours de traitement.', {
        code: 'REQUETE_EN_COURS',
        regle: options.regle,
      })
    }
    return { status: row.statutHttp, body: JSON.parse(row.reponse) as T, replayed: true }
  }

  const existing = await rejouer()
  if (existing) return existing

  try {
    return await db.$transaction(
      async (tx) => {
        await tx.cleIdempotence.create({
          data: {
            utilisateurId: options.userId,
            cle: options.key,
            methode: options.method.toUpperCase(),
            chemin: options.path,
            empreinte,
            expireLe: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
          },
        })
        const result = await execute(tx)
        await tx.cleIdempotence.update({
          where,
          data: { statutHttp: result.status, reponse: JSON.stringify(result.body) },
        })
        return { ...result, replayed: false }
      },
      options.timeoutMs === undefined
        ? undefined
        : { timeout: options.timeoutMs, maxWait: options.timeoutMs },
    )
  } catch (error) {
    // Course entre deux soumissions simultanées : la seconde lit le résultat de la première.
    if (isUniqueViolation(error)) {
      const replay = await rejouer()
      if (replay) return replay
    }
    throw error
  }
}

/**
 * Variante pour une opération qui enchaîne PLUSIEURS transactions (ex. passage d'intégration Broadcast,
 * RG-COO-102 : transaction par dossier / par flux) : la clé est réservée (réponse vide) dans une première
 * transaction, l'opération s'exécute, puis la réponse est enregistrée. Une soumission simultanée de la même
 * clé reçoit 409 « déjà en cours » ; si l'opération lève, la clé est libérée (rejouable après correction).
 */
export async function withIdempotencyEtapes<T>(
  db: Db,
  options: IdempotencyOptions,
  execute: () => Promise<{ status: number; body: T }>,
): Promise<IdempotentResult<T>> {
  const now = options.now ?? new Date()
  const empreinte = empreinteRequete(options.method, options.path, options.body)
  const where = { utilisateurId_cle: { utilisateurId: options.userId, cle: options.key } }
  const row = await db.cleIdempotence.findUnique({ where })
  if (row && row.expireLe <= now) await db.cleIdempotence.delete({ where })
  else if (row) {
    if (row.empreinte !== empreinte)
      throw new ConflictError('Cette clé d’idempotence a déjà servi pour une autre requête.', {
        code: options.code,
        regle: options.regle,
      })
    if (row.statutHttp === null || row.reponse === null)
      throw new ConflictError('La même requête est déjà en cours de traitement.', {
        code: 'REQUETE_EN_COURS',
        regle: options.regle,
      })
    return { status: row.statutHttp, body: JSON.parse(row.reponse) as T, replayed: true }
  }
  try {
    await db.cleIdempotence.create({
      data: {
        utilisateurId: options.userId,
        cle: options.key,
        methode: options.method.toUpperCase(),
        chemin: options.path,
        empreinte,
        expireLe: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
      },
    })
  } catch (error) {
    if (isUniqueViolation(error))
      throw new ConflictError('La même requête est déjà en cours de traitement.', {
        code: 'REQUETE_EN_COURS',
        regle: options.regle,
      })
    throw error
  }
  let result: { status: number; body: T }
  try {
    result = await execute()
  } catch (error) {
    await db.cleIdempotence.delete({ where })
    throw error
  }
  await db.cleIdempotence.update({
    where,
    data: { statutHttp: result.status, reponse: JSON.stringify(result.body) },
  })
  return { ...result, replayed: false }
}

/** Envoie le résultat ; marque les rejeux par l'en-tête Idempotent-Replayed: true. */
export function sendIdempotent<T>(reply: FastifyReply, result: IdempotentResult<T>): FastifyReply {
  if (result.replayed) void reply.header(IDEMPOTENCY_REPLAY_HEADER, 'true')
  return reply.status(result.status).send(result.body)
}

/** Purge des clés expirées (à planifier ; rétention Q-348). */
export async function purgerClesExpirees(db: Db, now: Date = new Date()): Promise<number> {
  const { count } = await db.cleIdempotence.deleteMany({ where: { expireLe: { lte: now } } })
  return count
}
