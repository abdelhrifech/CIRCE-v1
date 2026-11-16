// REC-P03 — photo du BL, référentiels, vérification du panier et du bon de livraison, modale Visuel.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import {
  ErrorResponseSchema,
  PhotoSchema,
  ReferentielsReceptionSchema,
  VerificationBlSchema,
  VisuelLigneSchema,
  semaineIsoDe,
  type Role,
} from '@circe/shared'
import { buildApp } from '../../src/app.ts'
import { loadConfig } from '../../src/core/config.ts'
import { createDb } from '../../src/core/db.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import { rattacher } from '../../src/modules/reception/rattachement.ts'
import { seedRef } from '../../src/reference/seed-ref.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
let app: FastifyInstance
const s = semaineIsoDe(new Date())
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')

beforeAll(async () => {
  await seedRef(db)
  app = buildApp({ config, db, closeDb: () => db.$disconnect() })
  await app.ready()
})
afterAll(async () => {
  await app.close()
})

const erreur = (body: unknown) => ErrorResponseSchema.parse(body)
let cle = 0
const idem = () => ({ 'idempotency-key': `photo-${Date.now()}-${++cle}` })

async function site(roles: Role[] = ['recep']) {
  const plateforme = await f.createPlateforme(db)
  const user = await f.createUtilisateurAvecRoles(db, roles, [{ plateformeId: plateforme.id }])
  return { plateforme, user, headers: devHeaders(user.identifiantExterne) }
}

function ligne(plateformeId: number, data: Parameters<typeof f.createReceptionAttendue>[1] = {}) {
  return f.createReceptionAttendue(db, {
    plateformeId,
    semAnnee: s.annee,
    semNum: s.semaine,
    qteBc: 10,
    ...data,
  })
}

async function photo(headers: Record<string, string>) {
  const r = await app.inject({
    method: 'POST',
    url: '/api/photos',
    headers: { ...headers, ...idem() },
    payload: { intitule: 'bl.png', mimeType: 'image/png', contenuBase64: PNG },
  })
  return PhotoSchema.parse(r.json()).id
}

async function blValide(plateformeId: number, headers: Record<string, string>) {
  const [l1, l2, imprimeur, livreur] = await Promise.all([
    ligne(plateformeId),
    ligne(plateformeId),
    f.createImprimeur(db),
    f.createLivreur(db),
  ])
  return {
    l1,
    l2,
    bl: {
      lignes: [
        { ligneAttendueId: l1.id, quantite: 6, cochee: true },
        { ligneAttendueId: l2.id, quantite: 4, cochee: true },
      ],
      photoBlId: await photo(headers),
      numeroBl: `BL-${Date.now()}-${++cle}`,
      livreurId: livreur.id,
      imprimeurId: imprimeur.id,
      nbColis: 2,
      dechargeParId: null as number | null,
    },
  }
}

const verifier = (headers: Record<string, string>, payload: unknown) =>
  app.inject({
    method: 'POST',
    url: '/api/receptions/verification',
    headers,
    payload: payload as object,
  })

describe('RG-REC-026 / RG-REC-027 photo du BL', () => {
  it('RG-REC-027 enregistre la photo (métadonnées, auteur) et la relit avec son type MIME exact', async () => {
    const { headers, user } = await site()
    const r = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: { ...headers, ...idem() },
      payload: { intitule: 'bl.png', mimeType: 'image/png', contenuBase64: PNG },
    })
    expect(r.statusCode).toBe(201)
    const p = PhotoSchema.parse(r.json())
    expect(p).toMatchObject({ mimeType: 'image/png', taille: 16, intitule: 'bl.png' })
    expect((await db.photo.findUniqueOrThrow({ where: { id: p.id } })).createdById).toBe(user.id)
    const g = await app.inject({ method: 'GET', url: `/api/photos/${p.id}`, headers })
    expect(g.statusCode).toBe(200)
    expect(g.headers['content-type']).toBe('image/png')
    expect(g.rawPayload.toString('base64')).toBe(PNG)
  })

  it('RG-REC-008 une double soumission ne crée qu’une photo', async () => {
    const { headers } = await site()
    const h = { ...headers, ...idem() }
    const payload = { intitule: 'bl.png', mimeType: 'image/png', contenuBase64: PNG }
    const a = await app.inject({ method: 'POST', url: '/api/photos', headers: h, payload })
    const b = await app.inject({ method: 'POST', url: '/api/photos', headers: h, payload })
    expect(b.json()).toEqual(a.json())
    expect(b.headers['idempotent-replayed']).toBe('true')
  })

  it.each([
    ['type refusé', { intitule: 'x.gif', mimeType: 'image/gif', contenuBase64: PNG }],
    ['contenu illisible', { intitule: 'x.png', mimeType: 'image/png', contenuBase64: '***' }],
  ])(
    'RG-REC-027 refuse une photo invalide (%s) : 400 REC_PHOTO_INVALIDE',
    async (_cas, payload) => {
      const { headers } = await site()
      const r = await app.inject({
        method: 'POST',
        url: '/api/photos',
        headers: { ...headers, ...idem() },
        payload,
      })
      expect(r.statusCode).toBe(400)
      expect(erreur(r.json())).toMatchObject({ code: 'REC_PHOTO_INVALIDE', regle: 'RG-REC-027' })
    },
  )

  it('RG-REC-027 refuse un fichier de plus de 10 Mo', async () => {
    const { headers } = await site()
    const gros = Buffer.alloc(10 * 1024 * 1024 + 1, 1).toString('base64')
    const r = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: { ...headers, ...idem() },
      payload: { intitule: 'g.png', mimeType: 'image/png', contenuBase64: gros },
    })
    expect(r.statusCode).toBe(400)
    expect(erreur(r.json()).code).toBe('REC_PHOTO_INVALIDE')
  })

  it('RG-REC-002 photographier est refusé au Commerce (403) ; RG-REC-008 sans Idempotency-Key : 400', async () => {
    const com = await site(['com'])
    const r = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: { ...com.headers, ...idem() },
      payload: { intitule: 'x.png', mimeType: 'image/png', contenuBase64: PNG },
    })
    expect(r.statusCode).toBe(403)
    const { headers } = await site()
    const sansCle = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers,
      payload: { intitule: 'x.png', mimeType: 'image/png', contenuBase64: PNG },
    })
    expect(sansCle.statusCode).toBe(400)
  })

  it('RG-REC-001 une photo d’un autre utilisateur, non rattachée à son périmètre, est refusée (403) ; inconnue : 404', async () => {
    const a = await site()
    const id = await photo(a.headers)
    const b = await site()
    expect(
      (await app.inject({ method: 'GET', url: `/api/photos/${id}`, headers: b.headers }))
        .statusCode,
    ).toBe(403)
    expect(
      (await app.inject({ method: 'GET', url: '/api/photos/999999999', headers: b.headers }))
        .statusCode,
    ).toBe(404)
  })
})

describe('RG-REC-035 référentiels du bon de livraison (listes fermées)', () => {
  it('RG-REC-035 imprimeurs et livreurs actifs ; agents = utilisateurs recep du site', async () => {
    const { plateforme, user, headers } = await site()
    const actif = await f.createImprimeur(db)
    const inactif = await f.createImprimeur(db, { actif: false })
    const livreur = await f.createLivreur(db)
    const autreSite = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: (await f.createPlateforme(db)).id }],
    )
    const coord = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: plateforme.id }],
    )
    const r = await app.inject({ method: 'GET', url: '/api/reception/referentiels', headers })
    const ref = ReferentielsReceptionSchema.parse(r.json())
    expect(ref.imprimeurs.map((i) => i.id)).toContain(actif.id)
    expect(ref.imprimeurs.map((i) => i.id)).not.toContain(inactif.id)
    expect(ref.livreurs.map((l) => l.id)).toContain(livreur.id)
    const agents = ref.agents.map((a) => a.id)
    expect(agents).toContain(user.id)
    expect(agents).not.toContain(autreSite.id)
    expect(agents).not.toContain(coord.id)
  })

  it('RG-REC-002 référentiels refusés à un profil qui ne saisit pas de réception (expe) : 403', async () => {
    const { headers } = await site(['expe'])
    expect(
      (await app.inject({ method: 'GET', url: '/api/reception/referentiels', headers })).statusCode,
    ).toBe(403)
  })
})

describe('vérification du panier et du bon de livraison (ordre des refus de la maquette)', () => {
  it('RG-REC-022 / RG-REC-034 nominal : lignes cochées retenues, date = maintenant, mode MAIN, rien n’est écrit', async () => {
    const { plateforme, headers } = await site()
    const { bl, l1, l2 } = await blValide(plateforme.id, headers)
    const avant = await db.reception.count()
    const r = await verifier(headers, bl)
    expect(r.statusCode).toBe(200)
    const v = VerificationBlSchema.parse(r.json())
    expect(v).toMatchObject({
      plateformeId: plateforme.id,
      nombreLignes: 2,
      nombreAffiches: 10,
      lignesIgnorees: [],
      avertissements: [],
    })
    expect(v.lignes).toEqual([
      { ligneAttendueId: l1.id, quantite: 6, mode: 'BL' },
      { ligneAttendueId: l2.id, quantite: 4, mode: 'BL' },
    ])
    expect(Math.abs(new Date(v.dateLivraison).getTime() - Date.now())).toBeLessThan(10_000)
    expect(await db.reception.count()).toBe(avant)
  })

  it('RG-REC-021 panier vide : 422 REC_PANIER_VIDE', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, { ...bl, lignes: [] })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_PANIER_VIDE',
      regle: 'RG-REC-021',
      message: 'Le panier est vide.',
    })
  })

  it('RG-REC-022 aucune ligne cochée : 422 « Cochez dans le panier les lignes de ce BL. » ; les non cochées sont ignorées', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, {
      ...bl,
      lignes: bl.lignes.map((l) => ({ ...l, cochee: false })),
    })
    expect(erreur(r.json())).toMatchObject({ code: 'REC_AUCUNE_LIGNE_COCHEE', regle: 'RG-REC-022' })
    const partiel = await verifier(headers, {
      ...bl,
      lignes: [bl.lignes[0], { ...bl.lignes[1], cochee: false }],
    })
    expect(VerificationBlSchema.parse(partiel.json()).nombreLignes).toBe(1)
  })

  it('RG-REC-021 la même ligne deux fois dans le panier : 422 « Ce visuel est déjà au panier. »', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, { ...bl, lignes: [bl.lignes[0], bl.lignes[0]] })
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PANIER_DOUBLON', regle: 'RG-REC-021' })
  })

  it('RG-REC-023 quantité négative : 400 REC_QTE_NEGATIVE ; quantité 0 : ligne ignorée avec mention (Q-166)', async () => {
    const { plateforme, headers } = await site()
    const { bl, l2 } = await blValide(plateforme.id, headers)
    const neg = await verifier(headers, { ...bl, lignes: [{ ...bl.lignes[0], quantite: -1 }] })
    expect(neg.statusCode).toBe(400)
    expect(erreur(neg.json())).toMatchObject({ code: 'REC_QTE_NEGATIVE', regle: 'RG-REC-023' })
    const zero = await verifier(headers, {
      ...bl,
      lignes: [bl.lignes[0], { ...bl.lignes[1], quantite: 0 }],
    })
    expect(VerificationBlSchema.parse(zero.json())).toMatchObject({
      nombreLignes: 1,
      lignesIgnorees: [l2.id],
    })
  })

  it('RG-REC-023 une quantité négative est refusée même sur une ligne non cochée du panier (400)', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, {
      ...bl,
      lignes: [bl.lignes[0], { ...bl.lignes[1], cochee: false, quantite: -2 }],
    })
    expect(r.statusCode).toBe(400)
    expect(erreur(r.json()).code).toBe('REC_QTE_NEGATIVE')
  })

  it('RG-REC-023 toutes les lignes cochées à 0 : 422 REC_AUCUNE_QUANTITE', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, {
      ...bl,
      lignes: bl.lignes.map((l) => ({ ...l, quantite: 0 })),
    })
    expect(erreur(r.json())).toMatchObject({ code: 'REC_AUCUNE_QUANTITE', regle: 'RG-REC-023' })
  })

  it('RG-REC-024 lignes cochées sur deux plateformes : 422 REC_BL_DEUX_PLATEFORMES', async () => {
    const p1 = await f.createPlateforme(db)
    const p2 = await f.createPlateforme(db)
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: p1.id }, { plateformeId: p2.id }],
    )
    const headers = devHeaders(user.identifiantExterne)
    const { bl } = await blValide(p1.id, headers)
    const autre = await ligne(p2.id)
    const r = await verifier(headers, {
      ...bl,
      lignes: [bl.lignes[0], { ligneAttendueId: autre.id, quantite: 1, cochee: true }],
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_BL_DEUX_PLATEFORMES',
      regle: 'RG-REC-024',
      message: "Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme.",
    })
  })

  it('RG-REC-026 photo du BL absente : 422 REC_PHOTO_BL_MANQUANTE (même si les lignes viennent de la recherche)', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, { ...bl, photoBlId: null })
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PHOTO_BL_MANQUANTE', regle: 'RG-REC-026' })
    const inconnue = await verifier(headers, { ...bl, photoBlId: 999999999 })
    expect(erreur(inconnue.json())).toMatchObject({
      code: 'REC_PHOTO_INVALIDE',
      regle: 'RG-REC-027',
    })
  })

  it('RG-REC-027 / RG-REC-001 la photo d’un autre agent, non jointe au périmètre, est refusée (403)', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const autre = await site()
    const photoAutre = await photo(autre.headers)
    const r = await verifier(headers, { ...bl, photoBlId: photoAutre })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })

  it('RG-REC-026 une photo déjà jointe à une autre réception est refusée (422, HYPOTHÈSE Q-177)', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    await f.createReception(db, { plateformeId: plateforme.id, photoBlId: bl.photoBlId })
    const r = await verifier(headers, bl)
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PHOTO_DEJA_JOINTE', regle: 'RG-REC-026' })
  })

  it('RG-REC-027 photo introuvable : 400 REC_PHOTO_INVALIDE', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, { ...bl, photoBlId: 999999999 })
    expect(r.statusCode).toBe(400)
    expect(erreur(r.json()).code).toBe('REC_PHOTO_INVALIDE')
  })

  it('RG-REC-032 un mode envoyé par le client est ignoré : toujours BL par le panier (Q-184)', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, {
      ...bl,
      lignes: bl.lignes.map((l) => ({ ...l, mode: 'VISUEL' })),
    })
    expect(r.json<{ lignes: { mode: string }[] }>().lignes.map((l) => l.mode)).toEqual(['BL', 'BL'])
  })

  it('RG-REC-027 la photo est servie avec X-Content-Type-Options: nosniff', async () => {
    const { headers } = await site()
    const id = await photo(headers)
    const g = await app.inject({ method: 'GET', url: `/api/photos/${id}`, headers })
    expect(g.headers['x-content-type-options']).toBe('nosniff')
  })

  it.each([
    ['n° de BL vide', { numeroBl: '   ' }],
    ['transporteur vide', { livreurId: null }],
    ['imprimeur vide', { imprimeurId: null }],
  ])('RG-REC-033 %s : 422 REC_BL_CHAMPS_OBLIGATOIRES', async (_cas, champ) => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, { ...bl, ...champ })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_BL_CHAMPS_OBLIGATOIRES',
      regle: 'RG-REC-033',
      message: 'N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé.',
    })
  })

  it('RG-REC-033 nombre de colis < 1 : 400', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    expect((await verifier(headers, { ...bl, nbColis: 0 })).statusCode).toBe(400)
  })

  it.each([
    ['transporteur inconnu', 'livreurId'],
    ['imprimeur désactivé', 'imprimeurId'],
    ['« Déchargé par » hors des agents du site', 'dechargeParId'],
  ] as const)(
    'RG-REC-035 %s : 422 REC_REFERENTIEL_INCONNU (jamais créé à la volée)',
    async (_cas, champ) => {
      const { plateforme, headers } = await site()
      const { bl } = await blValide(plateforme.id, headers)
      const valeur =
        champ === 'imprimeurId'
          ? (await f.createImprimeur(db, { actif: false })).id
          : champ === 'dechargeParId'
            ? (await f.createUtilisateurAvecRoles(db, ['recep'])).id
            : 999999999
      const avantLivreurs = await db.livreur.count()
      const r = await verifier(headers, { ...bl, [champ]: valeur })
      expect(erreur(r.json())).toMatchObject({
        code: 'REC_REFERENTIEL_INCONNU',
        regle: 'RG-REC-035',
      })
      expect(await db.livreur.count()).toBe(avantLivreurs)
    },
  )

  it('RG-REC-033 / RG-REC-035 « Déchargé par » facultatif ; un agent du site est accepté', async () => {
    const { plateforme, user, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    expect((await verifier(headers, { ...bl, dechargeParId: user.id })).statusCode).toBe(200)
  })

  it('RG-REC-036 n° de BL déjà réceptionné sur la plateforme : avertissement à confirmer, non bloquant', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const livraison = await f.createLivraison(db, { reference: bl.numeroBl })
    const ancienne = await f.createReception(db, {
      plateformeId: plateforme.id,
      livraisonId: livraison.id,
    })
    const r = await verifier(headers, bl)
    expect(r.statusCode).toBe(200)
    expect(VerificationBlSchema.parse(r.json()).avertissements).toEqual([
      expect.objectContaining({ code: 'REC_BL_DOUBLON', receptions: [ancienne.id] }),
    ])
  })

  it('RG-REC-036 le même n° de BL sur une autre plateforme ne lève pas d’avertissement', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const livraison = await f.createLivraison(db, { reference: bl.numeroBl })
    await f.createReception(db, { livraisonId: livraison.id })
    expect(VerificationBlSchema.parse((await verifier(headers, bl)).json()).avertissements).toEqual(
      [],
    )
  })

  it('RG-REC-014 une ligne annulée ou purgée depuis la mise au panier : 422 REC_LIGNE_INDISPONIBLE', async () => {
    const { plateforme, headers } = await site()
    const { bl, l1 } = await blValide(plateforme.id, headers)
    await db.receptionAttendue.update({ where: { id: l1.id }, data: { etatLigne: 'ANNULEE' } })
    expect(erreur((await verifier(headers, bl)).json())).toMatchObject({
      code: 'REC_LIGNE_INDISPONIBLE',
    })
  })

  it('RG-REC-001 une ligne hors périmètre : 403 ; ligne inexistante : 404', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const ailleurs = await ligne((await f.createPlateforme(db)).id)
    expect(
      (
        await verifier(headers, {
          ...bl,
          lignes: [{ ligneAttendueId: ailleurs.id, quantite: 1, cochee: true }],
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (
        await verifier(headers, {
          ...bl,
          lignes: [{ ligneAttendueId: 999999999, quantite: 1, cochee: true }],
        })
      ).statusCode,
    ).toBe(404)
  })

  it.each([
    ['coord', 200],
    ['recep', 200],
    ['cheq', 403],
    ['expe', 403],
    ['com', 403],
  ] as const)(
    'RG-REC-002 vérifier le BL (droit « valider la réception ») par %s → %i',
    async (role, code) => {
      const { plateforme, headers } = await site(['recep'])
      const { bl } = await blValide(plateforme.id, headers)
      const autre = await f.createUtilisateurAvecRoles(
        db,
        [role],
        [{ plateformeId: plateforme.id }],
      )
      // Chaque profil vérifie avec SA photo du BL (RG-REC-027 : la photo d'un autre agent est refusée).
      const saPhoto = await f.createPhoto(db, { createdById: autre.id })
      const r = await verifier(devHeaders(autre.identifiantExterne), {
        ...bl,
        photoBlId: saPhoto.id,
      })
      expect(r.statusCode).toBe(code)
    },
  )
})

describe('RG-REC-203 modale Visuel', () => {
  it('RG-REC-203 renvoie dossier, DA, site, format, départ, reçu / attendu et n° d’affiche (allée-rayon)', async () => {
    const { plateforme, headers } = await site()
    const l = await ligne(plateforme.id, {
      contNum: 910037,
      idDaChapeau: 470053,
      format: '2m2',
      repiquage: 'R1',
    })
    const affiche = await f.createAffiche(db, {
      plateformeId: plateforme.id,
      allee: 'B',
      rayon: '7',
    })
    await f.createRattachement(db, { afficheId: affiche.id, ligneAttendueId: l.id, quantite: 3 })
    const r = await app.inject({
      method: 'GET',
      url: `/api/lignes-attendues/${l.id}/visuel`,
      headers,
    })
    expect(VisuelLigneSchema.parse(r.json())).toMatchObject({
      dossier: 910037,
      da: 470053,
      site: plateforme.nom,
      format: '2m2',
      repiquage: 'R1',
      recu: 3,
      attendu: 10,
      affiches: [{ id: affiche.id, allee: 'B', rayon: '7' }],
      exclusion: false,
    })
  })

  it('RG-REC-203 ligne inexistante : 404 ; hors périmètre : 403', async () => {
    const { headers } = await site()
    expect(
      (await app.inject({ method: 'GET', url: '/api/lignes-attendues/999999999/visuel', headers }))
        .statusCode,
    ).toBe(404)
    const ailleurs = await ligne((await f.createPlateforme(db)).id)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/lignes-attendues/${ailleurs.id}/visuel`,
          headers,
        })
      ).statusCode,
    ).toBe(403)
  })
})

describe('RG-REC-024 rattachement : affiche et ligne sur la même plateforme', () => {
  it('RG-REC-024 refuse de rattacher une affiche à une ligne d’une autre plateforme du périmètre (422)', async () => {
    const p1 = await f.createPlateforme(db)
    const p2 = await f.createPlateforme(db)
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: p1.id }, { plateformeId: p2.id }],
    )
    const identity = {
      userId: user.id,
      identifiantExterne: user.identifiantExterne,
      nom: user.nom,
      roles: ['coord' as const],
      perimetre: {
        toutesPlateformes: false,
        plateformeIds: [p1.id, p2.id],
        lignes: [
          { plateformeId: p1.id, atelierId: null },
          { plateformeId: p2.id, atelierId: null },
        ],
      },
      siteId: null,
    }
    const affiche = await f.createAffiche(db, { plateformeId: p1.id })
    await f.createMouvement(db, { afficheId: affiche.id, quantite: 10 })
    const autre = await ligne(p2.id)
    await expect(
      withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: autre.id,
          quantite: 1,
          mode: 'MAIN',
        }),
      ),
    ).rejects.toMatchObject({
      httpStatus: 422,
      code: 'REC_RATTACHEMENT_AUTRE_PLATEFORME',
      regle: 'RG-REC-024',
    })
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(0)
  })
})
