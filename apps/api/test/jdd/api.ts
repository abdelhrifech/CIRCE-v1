// Appels d'API des générateurs : toujours la vraie application (inject), jamais d'écriture directe contournant un
// service quand le scénario est « valide ». Chaque appel porte une clé d'idempotence déterministe.
import type { LightMyRequestResponse } from 'fastify'
import { formatSemaineIso } from '@circe/shared'
import * as f from '../factories/index.ts'
import type { Headers, Jdd, SiteJdd } from './contexte.ts'

export interface Reponse {
  status: number
  body: unknown
  code: string | null
  regle: string | null
}

function lire(r: LightMyRequestResponse): Reponse {
  let body: unknown
  try {
    body = r.json()
  } catch {
    body = r.body
  }
  const b = (body ?? {}) as { code?: unknown; regle?: unknown }
  return {
    status: r.statusCode,
    body,
    code: typeof b.code === 'string' ? b.code : null,
    regle: typeof b.regle === 'string' ? b.regle : null,
  }
}

export async function poster(
  jdd: Jdd,
  url: string,
  headers: Headers,
  payload: unknown,
  cle: Headers = jdd.cle(),
): Promise<Reponse> {
  jdd.compter('appels.POST')
  return lire(
    await jdd.ctx.app.inject({
      method: 'POST',
      url,
      headers: { ...headers, ...cle },
      payload: payload as object,
    }),
  )
}

export async function lireApi(jdd: Jdd, url: string, headers: Headers): Promise<Reponse> {
  jdd.compter('appels.GET')
  return lire(await jdd.ctx.app.inject({ method: 'GET', url, headers }))
}

export async function ecrire(
  jdd: Jdd,
  methode: 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  headers: Headers,
  payload?: unknown,
): Promise<Reponse> {
  jdd.compter(`appels.${methode}`)
  return lire(
    await jdd.ctx.app.inject({
      method: methode,
      url,
      headers: { ...headers, ...jdd.cle() },
      ...(payload === undefined ? {} : { payload: payload as object }),
    }),
  )
}

/** Attend une réponse 2xx (scénario valide) ; sinon erreur explicite (un scénario valide ne doit jamais être rejeté). */
export function exiger(r: Reponse, contexte: string): Reponse {
  if (r.status < 200 || r.status >= 300)
    throw new Error(
      `${contexte} : HTTP ${String(r.status)} ${JSON.stringify(r.body).slice(0, 400)}`,
    )
  return r
}

export const departTexte = (jdd: Jdd) => formatSemaineIso(jdd.depart)

/** Ligne attendue (dossier, thème) de la semaine courante sur un site : création directe (alimentation Broadcast). */
export function creerLigne(
  jdd: Jdd,
  site: SiteJdd,
  o: Parameters<typeof f.createReceptionAttendue>[1] = {},
) {
  return f.createReceptionAttendue(jdd.ctx.db, {
    plateformeId: site.plateforme.id,
    supportId: site.supports[0]?.id ?? 0,
    semAnnee: jdd.semaine.annee,
    semNum: jdd.semaine.semaine,
    qteBc: 20,
    ...o,
  })
}

export interface LigneBl {
  ligneAttendueId: number
  quantite: number
  cochee?: boolean
  complementAfficheId?: number | null
  intituleSaisi?: string | null
}

/** Corps d'un bon de livraison valide (n° de BL déterministe). */
export async function corpsBl(
  jdd: Jdd,
  site: SiteJdd,
  lignes: LigneBl[],
  numeroBl?: string,
  auteurId?: number,
) {
  jdd.compter('bl')
  // RG-REC-026 : une photo de BL ne peut être jointe qu'à une seule réception.
  const photo = await f.createPhoto(jdd.ctx.db, {
    intitule: 'bl-jdd.png',
    taille: 16,
    createdById: auteurId ?? site.users.recep.id,
  })
  return {
    lignes: lignes.map((l) => ({ cochee: true, ...l })),
    photoBlId: photo.id,
    numeroBl: numeroBl ?? `BL-J${String(jdd.seed)}-${String(jdd.compteurs['bl'] ?? 0)}`,
    livreurId: site.livreurId,
    imprimeurId: site.imprimeurId,
    nbColis: 1,
    dechargeParId: null as number | null,
  }
}

export interface ReceptionFaite {
  receptionId: number
  affiches: { id: number; ligneAttendueId: number; quantite: number; complement: boolean }[]
}

/** « Valider la réception » (REC-P04) par l'agent du site. */
export async function recevoirBl(
  jdd: Jdd,
  site: SiteJdd,
  lignes: LigneBl[],
  numeroBl?: string,
): Promise<ReceptionFaite> {
  const r = exiger(
    await poster(
      jdd,
      '/api/receptions',
      site.users.recep.headers,
      await corpsBl(jdd, site, lignes, numeroBl),
    ),
    'réception',
  )
  jdd.compter('receptions')
  return r.body as ReceptionFaite
}

export interface AttenteRejet {
  /** Statuts HTTP acceptables (ex. [400], [409], [422]). */
  statuts: number[]
  code?: string
  regle?: string
}

/**
 * Vérifie qu'une requête INVALIDE a été rejetée avec le format d'erreur unique { code, message, regle? } : statut dans
 * l'ensemble attendu, `code` présent, `regle` présent pour un 422 (CLAUDE.md §6), code / règle exacts si fournis.
 */
export function verifierRejet(
  jdd: Jdd,
  nom: string,
  r: Reponse,
  a: AttenteRejet,
  regleDoc?: string,
): boolean {
  const corps = (r.body ?? {}) as { message?: unknown }
  const problemes: string[] = []
  if (!a.statuts.includes(r.status))
    problemes.push(`statut ${String(r.status)} ∉ ${a.statuts.join('/')}`)
  if (r.code === null) problemes.push('code absent')
  if (typeof corps.message !== 'string') problemes.push('message absent')
  if (r.status === 422 && r.regle === null) problemes.push('regle absente sur un 422')
  if (a.code !== undefined && r.code !== a.code)
    problemes.push(`code ${String(r.code)} ≠ ${a.code}`)
  if (a.regle !== undefined && r.regle !== a.regle)
    problemes.push(`regle ${String(r.regle)} ≠ ${a.regle}`)
  const ok = problemes.length === 0
  jdd.verifier(
    nom,
    ok,
    `rejet ${a.statuts.join('/')}${a.code ? ` ${a.code}` : ''}${a.regle ? ` (${a.regle})` : ''}`,
    ok
      ? `${String(r.status)} ${String(r.code)}`
      : `${String(r.status)} ${JSON.stringify(r.body).slice(0, 200)} : ${problemes.join(' ; ')}`,
    regleDoc ?? a.regle,
  )
  return ok
}

/** Photo de BL à usage unique (RG-REC-026). */
export async function nouvellePhoto(jdd: Jdd, site: SiteJdd): Promise<number> {
  return (
    await f.createPhoto(jdd.ctx.db, {
      intitule: 'photo-jdd.png',
      taille: 16,
      createdById: site.users.recep.id,
    })
  ).id
}

/** Instantané des écritures de réception d'un site : sert à prouver qu'un rejet n'écrit RIEN. */
export async function instantane(jdd: Jdd, site: SiteJdd): Promise<string> {
  const { db } = jdd.ctx
  const p = site.plateforme.id
  const [rec, aff, mvt, liv, lig, att] = await Promise.all([
    db.reception.count({ where: { plateformeId: p } }),
    db.affiche.count({ where: { plateformeId: p } }),
    db.mouvement.count({ where: { affiche: { plateformeId: p } } }),
    db.livraison.count({ where: { reception: { plateformeId: p } } }),
    db.receptionAttendue.aggregate({ where: { plateformeId: p }, _sum: { version: true } }),
    db.afficheAttendue.count({ where: { affiche: { plateformeId: p } } }),
  ])
  return JSON.stringify([rec, aff, mvt, liv, lig._sum.version, att])
}
