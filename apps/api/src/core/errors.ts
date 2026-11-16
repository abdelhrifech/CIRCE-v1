import type { ErrorResponse } from '@circe/shared'

interface ErrorOptions {
  code?: string
  details?: unknown
  /** ID de la règle de gestion violée (ex. RG-REC-012). */
  regle?: string
}

/** Socle des erreurs normalisées { code, message, details?, regle? } (CLAUDE.md §6). */
export class AppError extends Error {
  readonly httpStatus: number
  readonly code: string
  readonly details?: unknown
  readonly regle?: string

  constructor(
    httpStatus: number,
    defaultCode: string,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message)
    this.name = new.target.name
    this.httpStatus = httpStatus
    this.code = options.code ?? defaultCode
    this.details = options.details
    this.regle = options.regle
  }

  toResponse(): ErrorResponse {
    const body: ErrorResponse = { code: this.code, message: this.message }
    if (this.details !== undefined) body.details = this.details
    if (this.regle !== undefined) body.regle = this.regle
    return body
  }
}

/** 400 : requête invalide (validation Zod). */
export class ValidationError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(400, 'VALIDATION', message, options)
  }
}

/** 401 : identité absente ou invalide. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise', options?: ErrorOptions) {
    super(401, 'NON_AUTHENTIFIE', message, options)
  }
}

/** 403 : permission refusée. */
export class ForbiddenError extends AppError {
  constructor(message = 'Permission refusée', options?: ErrorOptions) {
    super(403, 'PERMISSION', message, options)
  }
}

/** 404 : ressource introuvable. */
export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable', options?: ErrorOptions) {
    super(404, 'INTROUVABLE', message, options)
  }
}

/** 409 : conflit (version, transition de statut interdite, doublon). */
export class ConflictError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(409, 'CONFLIT', message, options)
  }
}

/** 422 : règle métier violée ; `regle` est renseigné avec l'ID RG. */
export class BusinessError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(422, 'REGLE_METIER', message, options)
  }
}
