// Outils communs aux tests d'intégration de l'ÉTAPE 7 (interactions Réception ↔ Coordination) : un site avec un
// agent de réception, un coordinateur, un chef d'équipe, un administrateur et un commercial ; un dossier ;
// réception d'une affiche par le BL ; lecture de la fiche dossier, des alertes de Pilotage, de la palette.
// Les ressources sont propres à chaque appel (plateforme, dossier, affiches) : aucune dépendance entre tests.
import { expect } from 'vitest'
import {
  FicheDossierSchema,
  ResultatColisSchema,
  InconnueCreeeSchema,
  ListeAlertesSchema,
  type AlertePilotage,
} from '@circe/shared'
import { devHeaders } from './identite.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import { stockAffiche } from '../../src/modules/reception/stock.ts'
import * as f from '../factories/index.ts'
import {
  autre,
  bonDeLivraison,
  get,
  idem,
  ligne,
  photo,
  post,
  receptionValidee,
  site,
  type Ctx,
} from './reception.ts'

export type Headers = Record<string, string>

export type Preparation = 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE'

/** Site + acteurs + dossier de coordination dans l'état de préparation demandé. */
export async function monde(ctx: Ctx, preparation: Preparation = 'A_TRAITER') {
  const s = await site(ctx, ['recep'])
  const [coord, cheq, admin, com] = await Promise.all([
    autre(ctx, s.plateforme.id, ['coord']),
    autre(ctx, s.plateforme.id, ['cheq']),
    autre(ctx, s.plateforme.id, ['admin']),
    autre(ctx, s.plateforme.id, ['com']),
  ])
  const dossier = await f.createDossier(ctx.db, { statut: preparation })
  return { ...s, coord, cheq, admin, com, dossier }
}
export type Monde = Awaited<ReturnType<typeof monde>>

/** Réception (par le BL) de `qte` affiches sur une ligne attendue du dossier du monde. */
export function recevoir(
  ctx: Ctx,
  m: Monde,
  qte = 10,
  data: Parameters<typeof f.createReceptionAttendue>[1] = {},
) {
  return receptionValidee(ctx, m.headers, m.plateforme.id, qte, {
    contNum: m.dossier.contNum,
    supportId: m.support.id,
    ...data,
  })
}

export const affiche = (ctx: Ctx, id: number) => ctx.db.affiche.findUniqueOrThrow({ where: { id } })
export const receptionDe = (ctx: Ctx, id: number) =>
  ctx.db.reception.findUniqueOrThrow({ where: { id } })
export const ligneDe = (ctx: Ctx, id: number) =>
  ctx.db.receptionAttendue.findUniqueOrThrow({ where: { id } })

/** Mouvements de stock d'une affiche (somme = stock, RG-REC-151). */
export const mouvements = (ctx: Ctx, afficheId: number) =>
  ctx.db.mouvement.findMany({ where: { afficheId }, orderBy: { id: 'asc' } })
export const stock = (ctx: Ctx, afficheId: number) =>
  withTransaction(ctx.db, (tx) => stockAffiche(tx, afficheId))

export async function fiche(ctx: Ctx, m: Monde, headers: Headers = m.coord.headers) {
  const r = await get(ctx, `/api/coordination/dossiers/${String(m.dossier.id)}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return FicheDossierSchema.parse(r.json())
}

/** Alertes de Pilotage (Réception + Coordination) ouvertes pour le dossier du monde (ou la requête). */
export async function alertes(ctx: Ctx, headers: Headers, query = ''): Promise<AlertePilotage[]> {
  const r = await get(ctx, `/api/alertes${query}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return ListeAlertesSchema.parse(r.json()).alertes
}
export const alertesDossier = (ctx: Ctx, m: Monde, headers: Headers = m.coord.headers) =>
  alertes(ctx, headers, `?dossier=${String(m.dossier.contNum)}`)

/** Valider (true) / annuler la validation (false) d'une affiche depuis la Coordination. */
export async function valider(
  ctx: Ctx,
  headers: Headers,
  afficheId: number,
  valide: boolean,
  version?: number,
  cle: Headers = idem(),
) {
  const v = version ?? (await affiche(ctx, afficheId)).version
  return ctx.app.inject({
    method: 'POST',
    url: `/api/coordination/affiches/${String(afficheId)}/validation-admin`,
    headers: { ...headers, ...cle },
    payload: { version: v, valider: valide },
  })
}

/** Réception inconnue (ECR-REC-08) de `quantite` affiches sur le site du monde. */
export async function inconnue(ctx: Ctx, m: Monde, quantite = 12, theme = 'Description') {
  const r = await post(ctx, '/api/receptions-inconnues', m.headers, {
    plateformeId: m.plateforme.id,
    supportId: m.support.id,
    annonceur: 'Lu sur affiche',
    theme,
    imprimeurId: null,
    quantite,
    allee: 'x',
    rayon: '4',
    photoAfficheId: null,
    photoBlId: await photo(ctx, m.headers),
    sansBl: false,
    numeroBl: `BL-INC-${String(f.next())}`,
  })
  expect(r.statusCode, r.body).toBe(201)
  return InconnueCreeeSchema.parse(r.json())
}

export async function rattacherInconnue(
  ctx: Ctx,
  headers: Headers,
  afficheId: number,
  lignes: { ligneAttendueId: number; quantite: number }[],
  version?: number,
) {
  return post(ctx, `/api/affiches/${String(afficheId)}/rattacher-inconnue`, headers, {
    version: version ?? (await affiche(ctx, afficheId)).version,
    lignes,
  })
}

/** Ligne attendue du dossier du monde (autre thème possible). */
export const nouvelleLigne = (
  ctx: Ctx,
  m: Monde,
  data: Parameters<typeof f.createReceptionAttendue>[1] = {},
) =>
  ligne(ctx, m.plateforme.id, {
    contNum: m.dossier.contNum,
    supportId: m.support.id,
    ...data,
  })

/** Bon de livraison d'une ligne (pour des réceptions successives : partielle puis complément). */
export const blDe = (ctx: Ctx, m: Monde, lignes: Parameters<typeof bonDeLivraison>[2]) =>
  bonDeLivraison(ctx, m.headers, lignes)

/** Atomicité : déclencheur SQLite temporaire RAISE(ABORT) sur test.db, toujours supprimé (finally). */
let numDeclencheur = 0
export async function avecEchec<T>(ctx: Ctx, corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_x_${String(++numDeclencheur)}_${String(f.next())}`
  await ctx.db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} ${corps} BEGIN SELECT RAISE(ABORT, 'echec simule'); END`,
  )
  try {
    return await fn()
  } finally {
    await ctx.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}

/** Colis expédié (« A expédier ») contenant une UM de `qte` du dossier / thème donnés ; `post2` = appels du colis. */
export async function colisExpedie(
  ctx: Ctx,
  m: Monde,
  o: { contNum: number; theme: string; qte: number },
) {
  const atelier = await f.createAtelier(ctx.db, { plateformeId: m.plateforme.id, type: 'FIXE' })
  const dest = await f.createDestinataire(ctx.db, { nom: `Dest ${String(f.next())}` })
  const um = await f.createUniteManutention(ctx.db, {
    atelierId: atelier.id,
    supportId: m.support.id,
    destinataireId: dest.id,
    qte: o.qte,
    statut: 'EN_COURS',
    contNum: o.contNum,
    theme: o.theme,
    semAnnee: 2026,
    semNum: 45,
  })
  const exp = await f.createUtilisateurAvecRoles(
    ctx.db,
    ['expe'],
    [{ plateformeId: m.plateforme.id }],
  )
  const h = devHeaders(exp.identifiantExterne)
  const post2 = (chemin: string, payload: unknown) =>
    ctx.app.inject({
      method: 'POST',
      url: `/api/coordination/colis${chemin}`,
      headers: { ...h, ...idem() },
      payload: payload as object,
    })
  const ouvert = ResultatColisSchema.parse(
    (await post2('', { atelierId: atelier.id, destinataireId: dest.id })).json(),
  ).colis
  if (!ouvert) throw new Error('colis non créé')
  const ajoute = ResultatColisSchema.parse(
    (
      await post2(`/${String(ouvert.id)}/unites`, {
        version: ouvert.version,
        code: `UM-${String(um.id)}`,
      })
    ).json(),
  ).colis
  if (!ajoute) throw new Error('UM non ajoutée')
  const clos = await post2(`/${String(ajoute.id)}/expedier`, { version: ajoute.version })
  expect(clos.statusCode, clos.body).toBe(200)
  return { post2, um, colisId: ajoute.id }
}
