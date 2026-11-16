import swagger from '@fastify/swagger'
import type { FastifyInstance } from 'fastify'
import { createJsonSchemaTransform } from 'fastify-type-provider-zod'

const transformZod = createJsonSchemaTransform({
  zodToJsonConfig: {
    override(ctx) {
      if (ctx.zodSchema._zod.def.type === 'date') {
        ctx.jsonSchema.type = 'string'
        ctx.jsonSchema.format = 'date-time'
      }
    },
  },
})
const errorSchema = {
  type: 'object',
  required: ['code', 'message'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    regle: { type: 'string' },
    details: {},
  },
} as const

// Documentation only: never replace runtime validators or serializers with transformed schemas.
export function registerOpenApi(app: FastifyInstance) {
  app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'CIRCE API',
        version: '1.0.0',
        description:
          'Contrat de l’API existante sous /v1. Les routes /api restent disponibles, sans changement de comportement. Identité actuelle de développement ; ce contrat ne prétend pas implémenter le SSO Cityz.',
      },
      components: {
        securitySchemes: {
          DevIdentity: {
            type: 'apiKey',
            in: 'header',
            name: 'x-dev-identity',
            description:
              'Identité de développement signée HMAC, réservée au développement. Aucun secret dans ce contrat.',
          },
        },
      },
    },
    transform(input) {
      if (!input.url.startsWith('/v1/')) return { schema: { hide: true }, url: input.url }
      const transformed = transformZod(input)
      const health = input.url === '/v1/health'
      const methods = Array.isArray(input.route.method) ? input.route.method : [input.route.method]
      const binary =
        input.url === '/v1/photos/:id' || input.url === '/v1/non-conformites/fichiers/:id'
      const headers = {
        type: 'object',
        properties: {
          'x-site-id': {
            type: 'integer',
            minimum: 1,
            description: 'Filtre de centre facultatif ; périmètre revérifié côté serveur.',
          },
          ...(methods.includes('POST')
            ? {
                'idempotency-key': {
                  type: 'string',
                  minLength: 1,
                  description:
                    'Clé unique de l’opération ; réutiliser pour rejouer la même requête.',
                },
              }
            : {}),
        },
        ...(methods.includes('POST') ? { required: ['idempotency-key'] } : {}),
      }
      return {
        url: transformed.url,
        schema: {
          ...transformed.schema,
          operationId: `${methods[0]?.toLowerCase() ?? 'request'}_${input.url.replace(/[^a-zA-Z0-9]+/g, '_')}`,
          tags: [input.url.split('/')[2] ?? 'circe'],
          security: health ? [] : [{ DevIdentity: [] }],
          'x-api-category': health ? 'technical' : 'business',
          ...(health ? {} : { headers }),
          response: {
            ...(binary
              ? {
                  200: {
                    description: 'Fichier binaire protégé ; type MIME conservé.',
                    content: Object.fromEntries(
                      (input.url === '/v1/photos/:id'
                        ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
                        : ['*/*']
                      ).map((mime) => [mime, { schema: { type: 'string', format: 'binary' } }]),
                    ),
                  },
                }
              : {}),
            ...(typeof transformed.schema.response === 'object' &&
            transformed.schema.response !== null
              ? transformed.schema.response
              : {}),
            default: {
              description:
                'Erreur applicative structurée (validation, authentification, permission, conflit ou erreur interne).',
              ...errorSchema,
            },
          },
        },
      }
    },
  })
}
