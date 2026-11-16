import type { FastifyError, FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { AppError, ValidationError } from './errors.ts'

/** Mappe toute erreur vers le format unique { code, message, details?, regle? }. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.httpStatus).send(error.toResponse())
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const validation = new ValidationError('Requête invalide', { details: error.validation })
      return reply.status(validation.httpStatus).send(validation.toResponse())
    }
    const status =
      'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500
    if (status >= 400 && status < 500) {
      return reply.status(status).send({ code: 'REQUETE_INVALIDE', message: error.message })
    }
    request.log.error({ err: error }, 'Erreur non gérée')
    return reply.status(500).send({ code: 'ERREUR_INTERNE', message: 'Erreur interne du serveur' })
  })

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ code: 'INTROUVABLE', message: 'Route introuvable' })
  })
}
