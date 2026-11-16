import { createFileRoute } from '@tanstack/react-router'
import { PROFILS_DEMO } from '@circe/shared'

// Relais /api/* vers l'API (CLAUDE.md §3). L'URL de l'API est lue à l'exécution (API_URL).

/**
 * Fournisseur d'identité de DEV (Q-001 non tranchée) : en dehors de la production, si DEV_IDENTITY_USER
 * et DEV_IDENTITY_SECRET sont définis, le relais signe l'en-tête d'identité pour cet utilisateur.
 * En production rien n'est injecté (et l'API refuse de démarrer avec ce fournisseur).
 */
async function injectDevIdentity(headers: Headers): Promise<void> {
  headers.delete('x-dev-identity')
  const secret = process.env['DEV_IDENTITY_SECRET']
  if (process.env['NODE_ENV'] === 'production' || !secret) return
  // ECR-NAV-01 : le sélecteur de profil de dev pose le cookie `circe_dev_user`. Il remplace DEV_IDENTITY_USER
  // seulement s'il appartient au catalogue de démo ; tout autre contenu est ignoré (secret côté serveur).
  const cookie = /(?:^|;\s*)circe_dev_user=([^;]+)(?:;|$)/.exec(headers.get('cookie') ?? '')?.[1]
  const choisi = PROFILS_DEMO.find((profil) => profil.identifiant === cookie)?.identifiant
  const user = choisi ?? process.env['DEV_IDENTITY_USER']
  if (!user) return
  const { DEV_IDENTITY_HEADER, signDevIdentity } = await import('@circe/shared/dev-identity')
  headers.set(DEV_IDENTITY_HEADER, signDevIdentity({ sub: user }, secret))
}
async function relay({ request }: { request: Request }): Promise<Response> {
  const apiUrl = process.env['API_URL'] ?? 'http://127.0.0.1:3001'
  const incoming = new URL(request.url)
  const target = new URL(`${incoming.pathname}${incoming.search}`, apiUrl)

  const headers = new Headers(request.headers)
  headers.delete('host')
  await injectDevIdentity(headers)
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
      ...(hasBody ? { duplex: 'half' } : {}),
    })
    const responseHeaders = new Headers(upstream.headers)
    // fetch a déjà décompressé le corps : ces en-têtes ne sont plus valides.
    responseHeaders.delete('content-encoding')
    responseHeaders.delete('content-length')
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return Response.json(
      { code: 'API_INDISPONIBLE', message: "L'API est injoignable" },
      { status: 502 },
    )
  }
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: relay,
      POST: relay,
      PUT: relay,
      PATCH: relay,
      DELETE: relay,
    },
  },
})
