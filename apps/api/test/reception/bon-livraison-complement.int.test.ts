// REC-P03 — compléments de tests (test-engineer) : ordre des refus avec fautes cumulées, bornes de la
// quantité, panier mixte, compteurs, doublon de BL, photos (types, taille limite, accès), référentiels
// (multi-sites, admin), modale Visuel, matrice profils × endpoints.
// Sources : RECEPTION_REGLES_METIER.md §2 et §4 (RG-REC-021 à 027, 032 à 036, 203) ; maquette ECR-REC-01
// (« Règles visibles au clic Valider la réception »), ECR-REC-07, ECR-REC-11, ECR-REC-12 ;
// QUESTIONS_OUVERTES.md Q-112, Q-113/Q-311, Q-114, Q-115, Q-116, Q-166, Q-349.
// RG-REC-028 à 031 (lecture du BL, reconnaissance) : non testées, absentes en V1 (HYPOTHÈSE Q-112).
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
import { seedRef } from '../../src/reference/seed-ref.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
let app: FastifyInstance
const s = semaineIsoDe(new Date())
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')
const DIX_MO = 10 * 1024 * 1024

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
const idem = () => ({ 'idempotency-key': `photo-cpl-${Date.now()}-${++cle}` })

async function site(roles: Role[] = ['recep']) {
  const plateforme = await f.createPlateforme(db)
  const user = await f.createUtilisateurAvecRoles(db, roles, [{ plateformeId: plateforme.id }])
  return { plateforme, user, headers: devHeaders(user.identifiantExterne) }
}

async function multiSites(roles: Role[] = ['recep']) {
  const p1 = await f.createPlateforme(db)
  const p2 = await f.createPlateforme(db)
  const user = await f.createUtilisateurAvecRoles(db, roles, [
    { plateformeId: p1.id },
    { plateformeId: p2.id },
  ])
  return { p1, p2, user, headers: devHeaders(user.identifiantExterne) }
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

const envoyerPhoto = (headers: Record<string, string>, payload: object) =>
  app.inject({ method: 'POST', url: '/api/photos', headers: { ...headers, ...idem() }, payload })

async function photo(headers: Record<string, string>) {
  const r = await envoyerPhoto(headers, {
    intitule: 'bl.png',
    mimeType: 'image/png',
    contenuBase64: PNG,
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
      numeroBl: `BLC-${Date.now()}-${++cle}`,
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

/** BL qui cumule TOUTES les fautes de l'ordre de la maquette (sauf celles qu'on retire étape par étape). */
async function blToutesFautes() {
  const { p1, p2, headers } = await multiSites()
  const { bl } = await blValide(p1.id, headers)
  const autre = await ligne(p2.id)
  const fautif = {
    ...bl,
    lignes: [...bl.lignes, { ligneAttendueId: autre.id, quantite: 3, cochee: true }],
    photoBlId: null,
    numeroBl: '',
    livreurId: null,
    imprimeurId: null,
  }
  return { headers, bl, fautif }
}

describe('RG-REC-037 ordre des refus quand plusieurs fautes sont présentes (ECR-REC-01, reception.js:503-509)', () => {
  it('RG-REC-021 panier vide + photo absente + champs vides → le refus « panier vide » passe en premier', async () => {
    const { headers, fautif } = await blToutesFautes()
    const r = await verifier(headers, { ...fautif, lignes: [] })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_PANIER_VIDE',
      regle: 'RG-REC-021',
      message: 'Le panier est vide.',
    })
  })

  it('RG-REC-022 aucune ligne cochée (lignes de deux plateformes) + photo absente + champs vides → « aucune ligne cochée » en premier', async () => {
    const { headers, fautif } = await blToutesFautes()
    const r = await verifier(headers, {
      ...fautif,
      lignes: fautif.lignes.map((l) => ({ ...l, cochee: false })),
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_AUCUNE_LIGNE_COCHEE',
      regle: 'RG-REC-022',
      message: 'Cochez dans le panier les lignes de ce BL.',
    })
  })

  it('RG-REC-024 deux plateformes + photo absente + champs vides → « deux plateformes » avant la photo', async () => {
    const { headers, fautif } = await blToutesFautes()
    const r = await verifier(headers, fautif)
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_BL_DEUX_PLATEFORMES',
      regle: 'RG-REC-024',
    })
  })

  it('RG-REC-026 photo absente + n° de BL, transporteur et imprimeur vides → « photo » avant les champs obligatoires', async () => {
    const { headers, fautif, bl } = await blToutesFautes()
    const r = await verifier(headers, { ...fautif, lignes: bl.lignes })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_PHOTO_BL_MANQUANTE',
      regle: 'RG-REC-026',
      message:
        'Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche.',
    })
  })

  it('RG-REC-033 les trois champs vides ensemble → un seul refus, détail par champ', async () => {
    const { headers, fautif, bl } = await blToutesFautes()
    const r = await verifier(headers, { ...fautif, lignes: bl.lignes, photoBlId: bl.photoBlId })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_BL_CHAMPS_OBLIGATOIRES',
      regle: 'RG-REC-033',
      details: { numeroBl: true, transporteur: true, imprimeur: true },
    })
  })

  it('RG-REC-037 aucun refus n’écrit quoi que ce soit (réceptions, livraisons, affiches, mouvements, référentiels)', async () => {
    const { headers, fautif } = await blToutesFautes()
    const compter = () =>
      Promise.all([
        db.reception.count(),
        db.livraison.count(),
        db.affiche.count(),
        db.mouvement.count(),
        db.livreur.count(),
        db.imprimeur.count(),
      ])
    const avant = await compter()
    await verifier(headers, fautif)
    await verifier(headers, { ...fautif, lignes: [] })
    expect(await compter()).toEqual(avant)
  })
})

describe('RG-REC-022 / RG-REC-024 panier mêlant lignes cochées et non cochées', () => {
  it('RG-REC-024 une ligne NON cochée d’une autre plateforme n’empêche pas le BL (seules les cochées comptent)', async () => {
    const { p1, p2, headers } = await multiSites()
    const { bl, l1, l2 } = await blValide(p1.id, headers)
    const autre = await ligne(p2.id)
    const r = await verifier(headers, {
      ...bl,
      lignes: [...bl.lignes, { ligneAttendueId: autre.id, quantite: 5, cochee: false }],
    })
    expect(r.statusCode).toBe(200)
    const v = VerificationBlSchema.parse(r.json())
    expect(v.plateformeId).toBe(p1.id)
    expect(v.lignes.map((l) => l.ligneAttendueId)).toEqual([l1.id, l2.id])
    expect(v.lignesIgnorees).toEqual([])
  })

  it('RG-REC-022 lignes cochées de P2 et non cochées de P1 : le BL est celui de P2', async () => {
    const { p1, p2, headers } = await multiSites()
    const { bl } = await blValide(p1.id, headers)
    const a = await ligne(p2.id)
    const b = await ligne(p2.id)
    const r = await verifier(headers, {
      ...bl,
      lignes: [
        ...bl.lignes.map((l) => ({ ...l, cochee: false })),
        { ligneAttendueId: a.id, quantite: 2, cochee: true },
        { ligneAttendueId: b.id, quantite: 3, cochee: true },
      ],
    })
    expect(r.statusCode).toBe(200)
    expect(VerificationBlSchema.parse(r.json())).toMatchObject({
      plateformeId: p2.id,
      nombreLignes: 2,
      nombreAffiches: 5,
    })
  })

  it('RG-REC-021 la même ligne deux fois au panier (une cochée, une non cochée) est refusée : « Ce visuel est déjà au panier. »', async () => {
    // RG-REC-021 : « Ajouter une ligne déjà au panier est refusé » — le panier ne contient jamais deux fois la même ligne,
    // qu'elle soit cochée ou non.
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, {
      ...bl,
      lignes: [...bl.lignes, { ...bl.lignes[0], cochee: false }],
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_PANIER_DOUBLON',
      regle: 'RG-REC-021',
      message: 'Ce visuel est déjà au panier.',
    })
  })
})

describe('RG-REC-023 bornes de la quantité du BL', () => {
  it('RG-REC-023 quantité 1 (borne basse retenue) : ligne retenue', async () => {
    const { plateforme, headers } = await site()
    const { bl, l1 } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, { ...bl, lignes: [{ ...bl.lignes[0], quantite: 1 }] })
    expect(r.statusCode).toBe(200)
    expect(VerificationBlSchema.parse(r.json())).toMatchObject({
      lignes: [{ ligneAttendueId: l1.id, quantite: 1, mode: 'BL' }],
      nombreLignes: 1,
      nombreAffiches: 1,
      lignesIgnorees: [],
    })
  })

  it('RG-REC-023 quantité 0 : ligne ignorée avec mention (Q-166), sans refus', async () => {
    const { plateforme, headers } = await site()
    const { bl, l1, l2 } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, {
      ...bl,
      lignes: [{ ...bl.lignes[0], quantite: 0 }, bl.lignes[1]],
    })
    expect(r.statusCode).toBe(200)
    const v = VerificationBlSchema.parse(r.json())
    expect(v.lignesIgnorees).toEqual([l1.id])
    expect(v.lignes.map((l) => l.ligneAttendueId)).toEqual([l2.id])
  })

  it('RG-REC-023 grand nombre (au-delà du reste attendu) : accepté, aucun plafond documenté', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, {
      ...bl,
      lignes: [
        { ...bl.lignes[0], quantite: 1_000_000 },
        { ...bl.lignes[1], quantite: 999_999 },
      ],
    })
    expect(r.statusCode).toBe(200)
    expect(VerificationBlSchema.parse(r.json())).toMatchObject({
      nombreLignes: 2,
      nombreAffiches: 1_999_999,
    })
  })

  it.each([1.5, 0.1, -0.5])(
    'RG-REC-023 quantité non entière (%s) : 400 de validation',
    async (quantite) => {
      const { plateforme, headers } = await site()
      const { bl } = await blValide(plateforme.id, headers)
      const r = await verifier(headers, { ...bl, lignes: [{ ...bl.lignes[0], quantite }] })
      expect(r.statusCode).toBe(400)
    },
  )

  it('RG-REC-023 quantité −1 sur une ligne parmi d’autres valides : 400 REC_QTE_NEGATIVE, détail = la ligne fautive', async () => {
    const { plateforme, headers } = await site()
    const { bl, l2 } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, {
      ...bl,
      lignes: [bl.lignes[0], { ...bl.lignes[1], quantite: -1 }],
    })
    expect(r.statusCode).toBe(400)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_QTE_NEGATIVE',
      regle: 'RG-REC-023',
      message: 'La quantité doit être supérieure ou égale à 0.',
      details: { lignes: [l2.id] },
    })
  })
})

describe('RG-REC-033 compteurs « Lignes de ce BL » (nb de lignes, nb d’affiches) et champs', () => {
  it('RG-REC-033 nombreLignes / nombreAffiches ne comptent que les lignes cochées à quantité > 0', async () => {
    const { plateforme, headers } = await site()
    const [a, b, c, d] = await Promise.all([
      ligne(plateforme.id),
      ligne(plateforme.id),
      ligne(plateforme.id),
      ligne(plateforme.id),
    ])
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, {
      ...bl,
      lignes: [
        { ligneAttendueId: a.id, quantite: 7, cochee: true },
        { ligneAttendueId: b.id, quantite: 0, cochee: true },
        { ligneAttendueId: c.id, quantite: 50, cochee: false },
        { ligneAttendueId: d.id, quantite: 3, cochee: true },
      ],
    })
    expect(r.statusCode).toBe(200)
    expect(VerificationBlSchema.parse(r.json())).toMatchObject({
      nombreLignes: 2,
      nombreAffiches: 10,
      lignesIgnorees: [b.id],
    })
  })

  it('RG-REC-033 nombre de colis : 1 accepté (borne), absent = 1 par défaut ; 1,5 refusé (400)', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    expect((await verifier(headers, { ...bl, nbColis: 1 })).statusCode).toBe(200)
    const sansColis: Partial<typeof bl> = { ...bl }
    delete sansColis.nbColis
    expect((await verifier(headers, sansColis)).statusCode).toBe(200)
    expect((await verifier(headers, { ...bl, nbColis: 1.5 })).statusCode).toBe(400)
  })

  it('RG-REC-033 un seul champ obligatoire manquant : le détail ne désigne que ce champ', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, { ...bl, imprimeurId: null })
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_BL_CHAMPS_OBLIGATOIRES',
      details: { numeroBl: false, transporteur: false, imprimeur: true },
    })
  })

  it('RG-REC-034 la date de livraison est en lecture = maintenant (une date envoyée par le client est ignorée)', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r = await verifier(headers, { ...bl, dateLivraison: '2001-01-01T00:00:00.000Z' })
    expect(r.statusCode).toBe(200)
    const v = VerificationBlSchema.parse(r.json())
    expect(Math.abs(new Date(v.dateLivraison).getTime() - Date.now())).toBeLessThan(10_000)
  })

  it('RG-REC-035 transporteur désactivé : 422 REC_REFERENTIEL_INCONNU (détail transporteur)', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const inactif = await f.createLivreur(db, { actif: false })
    const r = await verifier(headers, { ...bl, livreurId: inactif.id })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_REFERENTIEL_INCONNU',
      regle: 'RG-REC-035',
      details: { transporteur: true, imprimeur: false, dechargePar: false },
    })
  })

  it('RG-REC-035 « Déchargé par » = agent de réception désactivé ou utilisateur non agent (coord) : refusé', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const inactif = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: plateforme.id }],
    )
    await db.utilisateur.update({ where: { id: inactif.id }, data: { actif: false } })
    const coord = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: plateforme.id }],
    )
    for (const id of [inactif.id, coord.id]) {
      const r = await verifier(headers, { ...bl, dechargeParId: id })
      expect(r.statusCode).toBe(422)
      expect(erreur(r.json())).toMatchObject({
        code: 'REC_REFERENTIEL_INCONNU',
        regle: 'RG-REC-035',
      })
    }
  })

  it('RG-REC-035 « Déchargé par » = agent d’un autre site du périmètre de l’utilisateur : refusé (agent du site du BL)', async () => {
    const { p1, p2, headers } = await multiSites()
    const { bl } = await blValide(p1.id, headers)
    const agentP2 = await f.createUtilisateurAvecRoles(db, ['recep'], [{ plateformeId: p2.id }])
    const r = await verifier(headers, { ...bl, dechargeParId: agentP2.id })
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_REFERENTIEL_INCONNU',
      details: { dechargePar: true },
    })
  })

  it('RG-REC-032 réception par le panier (n° lu sur le BL, Q-184), chaque ligne retenue est en mode BL', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const v = VerificationBlSchema.parse((await verifier(headers, bl)).json())
    expect(v.lignes.map((l) => l.mode)).toEqual(['BL', 'BL'])
  })
})

describe('RG-REC-036 avertissement de doublon du n° de BL (HYPOTHÈSE Q-114 : non bloquant)', () => {
  async function receptionAvecBl(plateformeId: number, reference: string) {
    const livraison = await f.createLivraison(db, { reference })
    return f.createReception(db, { plateformeId, livraisonId: livraison.id })
  }

  it('RG-REC-036 plusieurs réceptions avec le même n° de BL : toutes citées, dans l’ordre, message « … Continuer ? »', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const r1 = await receptionAvecBl(plateforme.id, bl.numeroBl)
    const r2 = await receptionAvecBl(plateforme.id, bl.numeroBl)
    const r = await verifier(headers, bl)
    expect(r.statusCode).toBe(200)
    const [avert, ...reste] = VerificationBlSchema.parse(r.json()).avertissements
    expect(reste).toEqual([])
    expect(avert?.code).toBe('REC_BL_DOUBLON')
    expect(avert?.receptions).toEqual([r1.id, r2.id])
    expect(avert?.message).toMatch(
      /^Ce n° de BL a déjà été réceptionné \(réception .+\)\. Continuer \?$/,
    )
    expect(avert?.message).toContain(String(r1.id))
    expect(avert?.message).toContain(String(r2.id))
  })

  it('RG-REC-036 espaces autour du n° saisi : le doublon est quand même détecté', async () => {
    const { plateforme, headers } = await site()
    const { bl } = await blValide(plateforme.id, headers)
    const ancienne = await receptionAvecBl(plateforme.id, bl.numeroBl)
    const r = await verifier(headers, { ...bl, numeroBl: `   ${bl.numeroBl}  ` })
    expect(r.statusCode).toBe(200)
    expect(VerificationBlSchema.parse(r.json()).avertissements).toEqual([
      expect.objectContaining({ code: 'REC_BL_DOUBLON', receptions: [ancienne.id] }),
    ])
  })

  it('RG-REC-036 n° de BL nouveau : aucun avertissement ; un BL d’une autre plateforme n’est pas cité', async () => {
    const { p1, p2, headers } = await multiSites()
    const { bl } = await blValide(p1.id, headers)
    const ici = await receptionAvecBl(p1.id, bl.numeroBl)
    await receptionAvecBl(p2.id, bl.numeroBl)
    const v = VerificationBlSchema.parse((await verifier(headers, bl)).json())
    expect(v.avertissements).toEqual([
      expect.objectContaining({ code: 'REC_BL_DOUBLON', receptions: [ici.id] }),
    ])
    const nouveau = VerificationBlSchema.parse(
      (await verifier(headers, { ...bl, numeroBl: `${bl.numeroBl}-NEUF` })).json(),
    )
    expect(nouveau.avertissements).toEqual([])
  })
})

describe('RG-REC-026 / RG-REC-027 photos : types, taille, accès (HYPOTHÈSE Q-113 / Q-311)', () => {
  it.each([
    ['image/jpeg', 'bl.jpg'],
    ['image/png', 'bl.png'],
    ['image/webp', 'bl.webp'],
    ['application/pdf', 'bl.pdf'],
  ])(
    'RG-REC-027 type accepté %s : 201 et relu avec ce type MIME exact (pas de PDF forcé)',
    async (mimeType, intitule) => {
      const { headers } = await site()
      const contenu = Buffer.from(`contenu ${mimeType}`).toString('base64')
      const r = await envoyerPhoto(headers, { intitule, mimeType, contenuBase64: contenu })
      expect(r.statusCode).toBe(201)
      const p = PhotoSchema.parse(r.json())
      expect(p.mimeType).toBe(mimeType)
      const g = await app.inject({ method: 'GET', url: `/api/photos/${p.id}`, headers })
      expect(g.statusCode).toBe(200)
      expect(g.headers['content-type']).toBe(mimeType)
      expect(g.rawPayload.toString('base64')).toBe(contenu)
    },
  )

  it.each([
    'image/gif',
    'image/svg+xml',
    'text/plain',
    'application/octet-stream',
    'image/heic',
    '',
  ])('RG-REC-027 type refusé « %s » : 400 REC_PHOTO_INVALIDE', async (mimeType) => {
    const { headers } = await site()
    const r = await envoyerPhoto(headers, { intitule: 'x', mimeType, contenuBase64: PNG })
    expect(r.statusCode).toBe(400)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PHOTO_INVALIDE', regle: 'RG-REC-027' })
  })

  it('RG-REC-027 taille exacte de 10 Mo : acceptée (borne incluse)', async () => {
    const { headers } = await site()
    const contenu = Buffer.alloc(DIX_MO, 7).toString('base64')
    const r = await envoyerPhoto(headers, {
      intitule: 'limite.pdf',
      mimeType: 'application/pdf',
      contenuBase64: contenu,
    })
    expect(r.statusCode).toBe(201)
    expect(PhotoSchema.parse(r.json()).taille).toBe(DIX_MO)
  })

  it('RG-REC-027 contenu vide : 400 ; aucune photo écrite', async () => {
    const { headers } = await site()
    const avant = await db.photo.count()
    const r = await envoyerPhoto(headers, {
      intitule: 'v.png',
      mimeType: 'image/png',
      contenuBase64: '',
    })
    expect(r.statusCode).toBe(400)
    expect(await db.photo.count()).toBe(avant)
  })

  it('RG-REC-008 même Idempotency-Key, contenu différent : 409 REC_IDEMPOTENCE_CONFLIT, une seule photo', async () => {
    const { headers } = await site()
    const h = { ...headers, ...idem() }
    const avant = await db.photo.count()
    const a = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: h,
      payload: { intitule: 'a.png', mimeType: 'image/png', contenuBase64: PNG },
    })
    expect(a.statusCode).toBe(201)
    const b = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: h,
      payload: { intitule: 'b.png', mimeType: 'image/png', contenuBase64: PNG },
    })
    expect(b.statusCode).toBe(409)
    expect(erreur(b.json())).toMatchObject({ code: 'REC_IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' })
    expect(await db.photo.count()).toBe(avant + 1)
  })

  it('RG-REC-027 / RG-REC-001 photo liée à une réception du périmètre : un autre agent du site la consulte (« Voir le BL »)', async () => {
    const { plateforme, headers } = await site()
    const id = await photo(headers)
    await f.createReception(db, { plateformeId: plateforme.id, photoBlId: id })
    const collegue = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: plateforme.id }],
    )
    const g = await app.inject({
      method: 'GET',
      url: `/api/photos/${id}`,
      headers: devHeaders(collegue.identifiantExterne),
    })
    expect(g.statusCode).toBe(200)
    expect(g.headers['content-type']).toBe('image/png')
  })

  it('RG-REC-027 / RG-REC-001 photo liée à une affiche du périmètre : consultable par un autre agent du site', async () => {
    const { plateforme, headers } = await site()
    const id = await photo(headers)
    await f.createAffiche(db, { plateformeId: plateforme.id, photoId: id })
    const collegue = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: plateforme.id }],
    )
    const g = await app.inject({
      method: 'GET',
      url: `/api/photos/${id}`,
      headers: devHeaders(collegue.identifiantExterne),
    })
    expect(g.statusCode).toBe(200)
  })

  it('RG-REC-001 photo liée à une réception d’un AUTRE site : refusée (403) à un agent hors périmètre', async () => {
    const { plateforme, headers } = await site()
    const id = await photo(headers)
    await f.createReception(db, { plateformeId: plateforme.id, photoBlId: id })
    const ailleurs = await site()
    const g = await app.inject({
      method: 'GET',
      url: `/api/photos/${id}`,
      headers: ailleurs.headers,
    })
    expect(g.statusCode).toBe(403)
    expect(erreur(g.json())).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })

  it.each([
    ['coord', 201],
    ['recep', 201],
    ['cheq', 403],
    ['expe', 403],
    ['com', 403],
  ] as const)(
    'RG-REC-002 POST /api/photos (photographier le BL) par %s → %i',
    async (role, code) => {
      const { headers } = await site([role])
      const r = await envoyerPhoto(headers, {
        intitule: 'x.png',
        mimeType: 'image/png',
        contenuBase64: PNG,
      })
      expect(r.statusCode).toBe(code)
      if (code === 403)
        expect(erreur(r.json())).toMatchObject({ code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' })
    },
  )

  it.each([
    ['coord', 200],
    ['cheq', 200],
    ['recep', 200],
    ['com', 200],
    ['expe', 403],
  ] as const)(
    'RG-REC-002 GET /api/photos/:id (voir le BL d’une réception du site) par %s → %i',
    async (role, code) => {
      const { plateforme, headers } = await site()
      const id = await photo(headers)
      await f.createReception(db, { plateformeId: plateforme.id, photoBlId: id })
      const lecteur = await f.createUtilisateurAvecRoles(
        db,
        [role],
        [{ plateformeId: plateforme.id }],
      )
      const g = await app.inject({
        method: 'GET',
        url: `/api/photos/${id}`,
        headers: devHeaders(lecteur.identifiantExterne),
      })
      expect(g.statusCode).toBe(code)
    },
  )
})

describe('RG-REC-035 référentiels du bon de livraison : périmètre multi-sites et admin', () => {
  const lire = (headers: Record<string, string>) =>
    app.inject({ method: 'GET', url: '/api/reception/referentiels', headers })

  it('RG-REC-035 utilisateur multi-sites sans site choisi : agents de ses deux sites, pas ceux d’un site hors périmètre', async () => {
    const { p1, p2, headers } = await multiSites()
    const a1 = await f.createUtilisateurAvecRoles(db, ['recep'], [{ plateformeId: p1.id }])
    const a2 = await f.createUtilisateurAvecRoles(db, ['recep'], [{ plateformeId: p2.id }])
    const dehors = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: (await f.createPlateforme(db)).id }],
    )
    const r = await lire(headers)
    expect(r.statusCode).toBe(200)
    const agents = ReferentielsReceptionSchema.parse(r.json()).agents.map((a) => a.id)
    expect(agents).toEqual(expect.arrayContaining([a1.id, a2.id]))
    expect(agents).not.toContain(dehors.id)
  })

  it('RG-REC-035 site choisi (x-site-id) : seuls les agents de ce site', async () => {
    const { p1, p2, user } = await multiSites()
    const a1 = await f.createUtilisateurAvecRoles(db, ['recep'], [{ plateformeId: p1.id }])
    const a2 = await f.createUtilisateurAvecRoles(db, ['recep'], [{ plateformeId: p2.id }])
    const r = await lire(devHeaders(user.identifiantExterne, p1.id))
    const agents = ReferentielsReceptionSchema.parse(r.json()).agents.map((a) => a.id)
    expect(agents).toContain(a1.id)
    expect(agents).not.toContain(a2.id)
  })

  it('RG-REC-001 site choisi hors périmètre : 403', async () => {
    const { user } = await site()
    const autre = await f.createPlateforme(db)
    const r = await lire(devHeaders(user.identifiantExterne, autre.id))
    expect(r.statusCode).toBe(403)
  })

  it('RG-REC-035 agent désactivé et livreur désactivé exclus des listes', async () => {
    const { plateforme, headers } = await site()
    const agentInactif = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: plateforme.id }],
    )
    await db.utilisateur.update({ where: { id: agentInactif.id }, data: { actif: false } })
    const livreurInactif = await f.createLivreur(db, { actif: false })
    const ref = ReferentielsReceptionSchema.parse((await lire(headers)).json())
    expect(ref.agents.map((a) => a.id)).not.toContain(agentInactif.id)
    expect(ref.livreurs.map((l) => l.id)).not.toContain(livreurInactif.id)
  })

  it('RG-REC-035 agent de réception cumulant le rôle admin (périmètre toutes plateformes) : agents de tous les sites', async () => {
    const { user, headers } = await site(['recep', 'admin'])
    const ailleurs = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: (await f.createPlateforme(db)).id }],
    )
    const r = await lire(headers)
    expect(r.statusCode).toBe(200)
    const agents = ReferentielsReceptionSchema.parse(r.json()).agents.map((a) => a.id)
    expect(agents).toEqual(expect.arrayContaining([user.id, ailleurs.id]))
  })

  it.each([
    ['coord', 200],
    ['recep', 200],
    ['cheq', 403],
    ['expe', 403],
    ['com', 403],
  ] as const)('RG-REC-002 GET /api/reception/referentiels par %s → %i', async (role, code) => {
    const { headers } = await site([role])
    expect((await lire(headers)).statusCode).toBe(code)
  })
})

describe('RG-REC-203 modale Visuel (ECR-REC-12)', () => {
  const visuel = (id: number, headers: Record<string, string>) =>
    app.inject({ method: 'GET', url: `/api/lignes-attendues/${id}/visuel`, headers })

  it('RG-REC-203 thème exclu : la modale le signale (exclusion = vrai)', async () => {
    const { plateforme, headers } = await site()
    const l = await ligne(plateforme.id, { themeExclu: true })
    const r = await visuel(l.id, headers)
    expect(r.statusCode).toBe(200)
    expect(VisuelLigneSchema.parse(r.json()).exclusion).toBe(true)
  })

  it('RG-REC-203 aucune affiche reçue : reçu 0, liste d’affiches vide (« pas encore reçue »)', async () => {
    const { plateforme, headers } = await site()
    const l = await ligne(plateforme.id, { qteBc: 12 })
    expect(VisuelLigneSchema.parse((await visuel(l.id, headers)).json())).toMatchObject({
      recu: 0,
      attendu: 12,
      affiches: [],
    })
  })

  it('RG-REC-203 plusieurs affiches : toutes listées (allée-rayon, tri par n°), reçu = somme ; rattachement retiré ignoré', async () => {
    const { plateforme, headers } = await site()
    const l = await ligne(plateforme.id)
    const a1 = await f.createAffiche(db, { plateformeId: plateforme.id, allee: 'A', rayon: '1' })
    const a2 = await f.createAffiche(db, { plateformeId: plateforme.id, allee: null, rayon: null })
    const retiree = await f.createAffiche(db, { plateformeId: plateforme.id })
    await f.createRattachement(db, { afficheId: a2.id, ligneAttendueId: l.id, quantite: 4 })
    await f.createRattachement(db, { afficheId: a1.id, ligneAttendueId: l.id, quantite: 3 })
    await f.createRattachement(db, {
      afficheId: retiree.id,
      ligneAttendueId: l.id,
      quantite: 99,
      actif: false,
    })
    const v = VisuelLigneSchema.parse((await visuel(l.id, headers)).json())
    expect(v.recu).toBe(7)
    expect(v.affiches).toEqual([
      { id: a1.id, allee: 'A', rayon: '1' },
      { id: a2.id, allee: null, rayon: null },
    ])
  })

  it.each([
    ['coord', 200],
    ['cheq', 200],
    ['recep', 200],
    ['com', 200],
    ['expe', 403],
  ] as const)('RG-REC-002 GET /api/lignes-attendues/:id/visuel par %s → %i', async (role, code) => {
    const { plateforme, headers } = await site([role])
    const l = await ligne(plateforme.id)
    expect((await visuel(l.id, headers)).statusCode).toBe(code)
  })
})

describe('RG-REC-004 identité exigée sur chaque endpoint de REC-P03', () => {
  it('RG-REC-004 sans identité : 401 sur les cinq endpoints', async () => {
    const reponses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/photos',
        headers: idem(),
        payload: { intitule: 'x.png', mimeType: 'image/png', contenuBase64: PNG },
      }),
      app.inject({ method: 'GET', url: '/api/photos/1' }),
      app.inject({ method: 'GET', url: '/api/reception/referentiels' }),
      app.inject({
        method: 'POST',
        url: '/api/receptions/verification',
        payload: { lignes: [], photoBlId: null, livreurId: null, imprimeurId: null },
      }),
      app.inject({ method: 'GET', url: '/api/lignes-attendues/1/visuel' }),
    ])
    expect(reponses.map((r) => r.statusCode)).toEqual([401, 401, 401, 401, 401])
  })
})
