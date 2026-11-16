// Outils communs aux tests d'intégration REC-P04 à REC-P10 : application, sites, BL, réception validée.
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { ErrorResponseSchema, PhotoSchema, semaineIsoDe, type Role } from '@circe/shared'
import { buildApp } from '../../src/app.ts'
import { loadConfig } from '../../src/core/config.ts'
import { createDb, type Db } from '../../src/core/db.ts'
import { seedRef } from '../../src/reference/seed-ref.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from './identite.ts'

export const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')
export const erreur = (r: LightMyRequestResponse) => ErrorResponseSchema.parse(r.json())

export function contexteReception() {
  const config = loadConfig()
  const db: Db = createDb(config.DATABASE_URL)
  const ctx = {
    db,
    app: null as unknown as FastifyInstance,
    async demarrer() {
      await seedRef(db)
      ctx.app = buildApp({ config, db, closeDb: () => db.$disconnect() })
      await ctx.app.ready()
    },
    async arreter() {
      await ctx.app.close()
    },
  }
  return ctx
}

let cle = 0
export const idem = () => ({ 'idempotency-key': `t-${String(Date.now())}-${String(++cle)}` })

export type Ctx = ReturnType<typeof contexteReception>

/** Un site (plateforme) et un utilisateur des rôles donnés sur ce site. */
export async function site(ctx: Ctx, roles: Role[] = ['recep']) {
  const plateforme = await f.createPlateforme(ctx.db)
  const support = await f.createSupport(ctx.db)
  const user = await f.createUtilisateurAvecRoles(ctx.db, roles, [{ plateformeId: plateforme.id }])
  return { plateforme, support, user, headers: devHeaders(user.identifiantExterne) }
}

/** Autre utilisateur sur la même plateforme. */
export async function autre(ctx: Ctx, plateformeId: number, roles: Role[]) {
  const user = await f.createUtilisateurAvecRoles(ctx.db, roles, [{ plateformeId }])
  return { user, headers: devHeaders(user.identifiantExterne) }
}

export function ligne(
  ctx: Ctx,
  plateformeId: number,
  data: Parameters<typeof f.createReceptionAttendue>[1] = {},
) {
  const s = semaineIsoDe(new Date())
  return f.createReceptionAttendue(ctx.db, {
    plateformeId,
    semAnnee: s.annee,
    semNum: s.semaine,
    qteBc: 10,
    ...data,
  })
}

export async function photo(ctx: Ctx, headers: Record<string, string>) {
  const r = await ctx.app.inject({
    method: 'POST',
    url: '/api/photos',
    headers: { ...headers, ...idem() },
    payload: { intitule: 'bl.png', mimeType: 'image/png', contenuBase64: PNG },
  })
  return PhotoSchema.parse(r.json()).id
}

export async function bonDeLivraison(
  ctx: Ctx,
  headers: Record<string, string>,
  lignes: {
    ligneAttendueId: number
    quantite: number
    complementAfficheId?: number | null
    intituleSaisi?: string | null
  }[],
) {
  const [imprimeur, livreur] = await Promise.all([
    f.createImprimeur(ctx.db),
    f.createLivreur(ctx.db),
  ])
  return {
    lignes: lignes.map((l) => ({ cochee: true, ...l })),
    photoBlId: await photo(ctx, headers),
    numeroBl: `BL-${String(Date.now())}-${String(++cle)}`,
    livreurId: livreur.id,
    imprimeurId: imprimeur.id,
    nbColis: 1,
    dechargeParId: null as number | null,
  }
}

export function post(
  ctx: Ctx,
  url: string,
  headers: Record<string, string>,
  payload: unknown,
  avecCle = true,
) {
  return ctx.app.inject({
    method: 'POST',
    url,
    headers: { ...headers, ...(avecCle ? idem() : {}) },
    payload: payload as object,
  })
}

export function get(ctx: Ctx, url: string, headers: Record<string, string>) {
  return ctx.app.inject({ method: 'GET', url, headers })
}

/** Réception validée (REC-P04) sur une ligne de `qte` affiches ; renvoie la réception et l'affiche créées. */
export async function receptionValidee(
  ctx: Ctx,
  headers: Record<string, string>,
  plateformeId: number,
  qte = 10,
  data: Parameters<typeof f.createReceptionAttendue>[1] = {},
) {
  const l = await ligne(ctx, plateformeId, { theme: 'Thème A', annonceur: 'ANNONCEUR', ...data })
  const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: qte }])
  const r = await post(ctx, '/api/receptions', headers, bl)
  if (r.statusCode !== 201) throw new Error(`réception non créée : ${r.body}`)
  const body = r.json<{ receptionId: number; affiches: { id: number }[] }>()
  const afficheId = body.affiches[0]?.id
  if (afficheId === undefined) throw new Error('aucune affiche')
  return { ligne: l, bl, receptionId: body.receptionId, afficheId }
}
