// REC-P02 — Compléments de tests écrits À PARTIR DES RÈGLES (RECEPTION_REGLES_METIER.md §2, §3, §4 ;
// QUESTIONS_OUVERTES.md Q-105, Q-130, Q-134, Q-135, Q-165, Q-349). Ne duplique pas attendues.int.test.ts.
// Base de test uniquement (setup-int.ts) ; données créées par les factories.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import {
  CompteursReceptionSchema,
  ErrorResponseSchema,
  ListeAttenduesQuerySchema,
  ListeAttenduesResponseSchema,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import { buildApp } from '../../src/app.ts'
import { loadConfig } from '../../src/core/config.ts'
import { createDb } from '../../src/core/db.ts'
import type { Identity } from '../../src/core/identity.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import type { StatutReception } from '../../src/generated/prisma/client.ts'
import { listerReceptionsAttendues } from '../../src/modules/reception/attendues.ts'
import { purgerReceptionsAttendues } from '../../src/modules/reception/purge.ts'
import { rattacher, retirerRattachement } from '../../src/modules/reception/rattachement.ts'
import { enregistrerMouvement } from '../../src/modules/reception/stock.ts'
import { seedRef } from '../../src/reference/seed-ref.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
let app: FastifyInstance
const courante = semaineIsoDe(new Date())
const decale = (n: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n * 7)
  return semaineIsoDe(d)
}
const JOUR = 86_400_000

beforeAll(async () => {
  await seedRef(db)
  app = buildApp({ config, db, closeDb: () => db.$disconnect() })
  await app.ready()
})
afterAll(async () => {
  await app.close()
})

function identiteDe(
  user: { id: number; identifiantExterne: string; nom: string | null },
  roles: Role[],
  plateformeIds: number[],
  siteId: number | null,
): Identity {
  return {
    userId: user.id,
    identifiantExterne: user.identifiantExterne,
    nom: user.nom,
    roles,
    perimetre: {
      toutesPlateformes: roles.includes('admin'),
      plateformeIds,
      lignes: plateformeIds.map((plateformeId) => ({ plateformeId, atelierId: null })),
    },
    siteId,
  }
}

async function site(roles: Role[] = ['recep']) {
  const plateforme = await f.createPlateforme(db)
  const user = await f.createUtilisateurAvecRoles(db, roles, [{ plateformeId: plateforme.id }])
  const identity = identiteDe(user, roles, [plateforme.id], plateforme.id)
  return { plateforme, user, identity, headers: devHeaders(user.identifiantExterne, plateforme.id) }
}

/** Utilisateur dont le périmètre couvre deux sites (RG-REC-001). */
async function deuxSites(roles: Role[] = ['recep']) {
  const a = await f.createPlateforme(db)
  const b = await f.createPlateforme(db)
  const user = await f.createUtilisateurAvecRoles(db, roles, [
    { plateformeId: a.id },
    { plateformeId: b.id },
  ])
  return { a, b, user }
}

function ligne(plateformeId: number, data: Parameters<typeof f.createReceptionAttendue>[1] = {}) {
  return f.createReceptionAttendue(db, {
    plateformeId,
    semAnnee: courante.annee,
    semNum: courante.semaine,
    qteBc: 10,
    ...data,
  })
}

async function lister(headers: Record<string, string>, qs = '') {
  const r = await app.inject({ method: 'GET', url: `/api/receptions-attendues${qs}`, headers })
  return { r, body: r.statusCode === 200 ? ListeAttenduesResponseSchema.parse(r.json()) : null }
}

async function compteurs(headers: Record<string, string>) {
  return app.inject({ method: 'GET', url: '/api/reception/compteurs', headers })
}

const ids = (items: { id: number }[] | undefined) =>
  (items ?? []).map((i) => i.id).sort((x, y) => x - y)
const tri = (...valeurs: number[]) => [...valeurs].sort((x, y) => x - y)

/** Affiche reçue (mouvement) sur une palette au statut donné, rattachée à une ou plusieurs lignes. */
async function afficheRattachee(
  identity: Identity,
  plateformeId: number,
  liens: { ligneId: number; quantite: number }[],
  statutPalette: StatutReception = 'A_CONTROLER',
  recue = liens.reduce((s, l) => s + l.quantite, 0),
) {
  const reception = await f.createReception(db, { plateformeId, statut: statutPalette })
  const affiche = await f.createAffiche(db, {
    plateformeId,
    quantite: 0,
    receptionId: reception.id,
  })
  await withTransaction(db, async (tx) => {
    await enregistrerMouvement(tx, identity, {
      permission: 'reception.valider',
      afficheId: affiche.id,
      type: 'RECEPTION',
      quantite: recue,
    })
    for (const l of liens) {
      await rattacher(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        ligneAttendueId: l.ligneId,
        quantite: l.quantite,
        mode: 'BL',
      })
    }
  })
  return affiche
}

async function retirerLien(identity: Identity, afficheId: number, ligneId: number) {
  const lien = await db.afficheAttendue.findFirstOrThrow({
    where: { afficheId, ligneAttendueId: ligneId, actif: true },
  })
  await withTransaction(db, (tx) =>
    retirerRattachement(tx, identity, {
      lienId: lien.id,
      expectedVersion: lien.version,
      permission: 'reception.valider',
    }),
  )
}

const statutEnBase = async (id: number) =>
  (await db.receptionAttendue.findUniqueOrThrow({ where: { id } })).statut

const historiqueLigne = async (id: number) =>
  (
    await db.statutHistorique.findMany({
      where: { typeEntite: 'LIGNE_ATTENDUE', entiteId: String(id) },
      orderBy: { id: 'asc' },
    })
  ).map((h) => ({ transition: `${h.ancien ?? ''}→${h.nouveau}`, regle: h.regle }))

/** Modifie un paramètre GLOBAL le temps d'un test, puis restaure la valeur d'origine. */
async function avecParametreGlobal(cle: string, valeur: string, corps: () => Promise<void>) {
  const p = await db.parametre.findFirstOrThrow({ where: { cle, plateformeId: null } })
  await db.parametre.update({ where: { id: p.id }, data: { valeur } })
  try {
    await corps()
  } finally {
    await db.parametre.update({ where: { id: p.id }, data: { valeur: p.valeur } })
  }
}

// ---------------------------------------------------------------------------------------------
describe('RG-REC-018 statut de la ligne attendue : bornes et paramètre (Q-105)', () => {
  it('RG-REC-018 borne haute incluse : 11 reçus pour 10 attendus (= 10 × 1,10) → Complète', async () => {
    const { plateforme, identity } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 11 }])
    expect(await statutEnBase(l.id)).toBe('COMPLETE')
  })

  it('RG-REC-018 borne exacte reçu = attendu → Complète (et non Partielle)', async () => {
    const { plateforme, identity } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 10 }])
    expect(await statutEnBase(l.id)).toBe('COMPLETE')
  })

  it('RG-REC-018 juste au-delà (12 > 11) : passage direct Attendue → Surplus, historisé avec la règle', async () => {
    const { plateforme, identity } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 12 }])
    expect(await statutEnBase(l.id)).toBe('SURPLUS')
    expect(await historiqueLigne(l.id)).toEqual([
      { transition: 'ATTENDUE→SURPLUS', regle: 'RG-REC-018' },
    ])
  })

  it('RG-REC-018 petit attendu : 1 attendu et 1 reçu → Complète ; un 2e reçu → Surplus (2 > 1,1)', async () => {
    const { plateforme, identity } = await site()
    const l = await ligne(plateforme.id, { qteBc: 1 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 1 }])
    expect(await statutEnBase(l.id)).toBe('COMPLETE')
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 1 }])
    expect(await statutEnBase(l.id)).toBe('SURPLUS')
  })

  it('RG-REC-018 paramètre GLOBAL modifié (0 %) appliqué à un site sans valeur propre : 11/10 → Surplus', async () => {
    const { plateforme, identity } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    await avecParametreGlobal('reception.ecartReception', '0', async () => {
      await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 11 }])
    })
    expect(await statutEnBase(l.id)).toBe('SURPLUS')
  })

  it('RG-REC-018 le paramètre propre à un AUTRE site ne s’applique pas (50 % ailleurs, 12/10 ici → Surplus)', async () => {
    const { plateforme, identity } = await site()
    const autre = await f.createPlateforme(db)
    await f.createParametre(db, {
      cle: 'reception.ecartReception',
      plateformeId: autre.id,
      valeur: '50',
    })
    const l = await ligne(plateforme.id, { qteBc: 10 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 12 }])
    expect(await statutEnBase(l.id)).toBe('SURPLUS')
  })

  it('RG-REC-018 / RG-REC-017 ligne PREPA : statut calculé sur la quantité de la prépa (15 sur 20 → Partielle)', async () => {
    const { plateforme, identity, headers } = await site()
    const l = await ligne(plateforme.id, { source: 'PREPA', qteBc: 10, qtePrepa: 20 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 15 }])
    const row = (await lister(headers, '?statut=tous')).body?.items.find((i) => i.id === l.id)
    expect(row).toMatchObject({ attendu: 20, recu: 15, reste: 5, statut: 'PARTIELLE' })
  })

  it('RG-REC-018 §3.2 recalcul : Surplus → Complète puis → Attendue au retrait des liens, chaque changement historisé', async () => {
    const { plateforme, identity } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    const a1 = await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 10 }])
    const a2 = await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 5 }])
    expect(await statutEnBase(l.id)).toBe('SURPLUS')
    await retirerLien(identity, a2.id, l.id)
    expect(await statutEnBase(l.id)).toBe('COMPLETE')
    await retirerLien(identity, a1.id, l.id)
    expect(await statutEnBase(l.id)).toBe('ATTENDUE')
    expect((await historiqueLigne(l.id)).map((h) => h.transition)).toEqual([
      'ATTENDUE→COMPLETE',
      'COMPLETE→SURPLUS',
      'SURPLUS→COMPLETE',
      'COMPLETE→ATTENDUE',
    ])
  })

  it('RG-REC-018 statut inchangé → aucune entrée d’historique ni nouvelle version', async () => {
    const { plateforme, identity } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 2 }])
    const v = (await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).version
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 3 }])
    expect(await statutEnBase(l.id)).toBe('PARTIELLE')
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).version).toBe(v)
    expect(await historiqueLigne(l.id)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------------------------
describe('RG-REC-017 reçu / attendu / reste', () => {
  it('RG-REC-017 un lien RETIRÉ est exclu du reçu, du reste et des n° d’affiche', async () => {
    const { plateforme, identity, headers } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    const garde = await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 3 }])
    const retiree = await afficheRattachee(identity, plateforme.id, [
      { ligneId: l.id, quantite: 4 },
    ])
    await retirerLien(identity, retiree.id, l.id)
    const row = (await lister(headers, '?statut=tous')).body?.items.find((i) => i.id === l.id)
    expect(row).toMatchObject({ recu: 3, reste: 7, statut: 'PARTIELLE', affiches: [garde.id] })
  })

  it('RG-REC-017 / RG-X-060 affiche multi-semaines (S et S+1) répartie 6 + 4 : reçu total 10, jamais doublé', async () => {
    const { plateforme, identity, headers } = await site()
    const s = await ligne(plateforme.id, { contNum: 930001, qteBc: 10 })
    const s1 = await ligne(plateforme.id, {
      contNum: 930001,
      qteBc: 10,
      semAnnee: decale(1).annee,
      semNum: decale(1).semaine,
    })
    const affiche = await afficheRattachee(identity, plateforme.id, [
      { ligneId: s.id, quantite: 6 },
      { ligneId: s1.id, quantite: 4 },
    ])
    const { body } = await lister(headers, '?statut=tous&q=930001')
    const rows = body?.items ?? []
    expect(rows.map((r) => r.recu).reduce((a, b) => a + b, 0)).toBe(10)
    expect(rows.find((r) => r.id === s.id)).toMatchObject({ recu: 6, affiches: [affiche.id] })
    expect(rows.find((r) => r.id === s1.id)).toMatchObject({ recu: 4, affiches: [affiche.id] })
  })

  it('RG-REC-017 / RG-X-060 rejet : compter la même affiche une 2e fois sur l’autre semaine → 422 REC_REPARTITION_DEPASSE', async () => {
    const { plateforme, identity } = await site()
    const s = await ligne(plateforme.id, { qteBc: 10 })
    const s1 = await ligne(plateforme.id, {
      qteBc: 10,
      semAnnee: decale(1).annee,
      semNum: decale(1).semaine,
    })
    const affiche = await afficheRattachee(identity, plateforme.id, [
      { ligneId: s.id, quantite: 10 },
    ])
    await expect(
      withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          ligneAttendueId: s1.id,
          quantite: 10,
          mode: 'BL',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422, code: 'REC_REPARTITION_DEPASSE', regle: 'RG-X-060' })
    expect(await statutEnBase(s1.id)).toBe('ATTENDUE')
  })

  it('RG-REC-017 reste = max(0, attendu − reçu) : jamais négatif en surplus', async () => {
    const { plateforme, identity, headers } = await site()
    const l = await ligne(plateforme.id, { qteBc: 5 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 9 }])
    const row = (await lister(headers, '?statut=tous')).body?.items.find((i) => i.id === l.id)
    expect(row).toMatchObject({ attendu: 5, recu: 9, reste: 0, statut: 'SURPLUS' })
  })

  it('RG-REC-017 attendu absent (ni BC ni prépa) → 0 ; rien reçu → Attendue, reste 0', async () => {
    const { plateforme, headers } = await site()
    const l = await ligne(plateforme.id, { qteBc: null, qtePrepa: null })
    const row = (await lister(headers, '?statut=tous')).body?.items.find((i) => i.id === l.id)
    expect(row).toMatchObject({ attendu: 0, recu: 0, reste: 0, statut: 'ATTENDUE' })
  })
})

// ---------------------------------------------------------------------------------------------
describe('RG-REC-019 colonne Contrôle', () => {
  it('RG-REC-019 contrôle mixte (une palette contrôlée, une à contrôler) → À contrôler ; retrait du lien non contrôlé → Contrôlée', async () => {
    const { plateforme, identity, headers } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 5 }], 'CONTROLEE')
    const aControler = await afficheRattachee(
      identity,
      plateforme.id,
      [{ ligneId: l.id, quantite: 3 }],
      'A_CONTROLER',
    )
    let row = (await lister(headers, '?statut=tous')).body?.items.find((i) => i.id === l.id)
    expect(row?.controle).toBe('A_CONTROLER')
    await retirerLien(identity, aControler.id, l.id)
    row = (await lister(headers, '?statut=tous')).body?.items.find((i) => i.id === l.id)
    expect(row?.controle).toBe('CONTROLEE')
  })

  it('RG-REC-019 retrait du seul lien → Rien reçu', async () => {
    const { plateforme, identity, headers } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    const a = await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 5 }])
    await retirerLien(identity, a.id, l.id)
    const row = (await lister(headers, '?statut=tous')).body?.items.find((i) => i.id === l.id)
    expect(row?.controle).toBe('RIEN_RECU')
  })

  it('RG-REC-019 / RG-REC-016 filtre Contrôle à plusieurs valeurs (OU) et compteurs par valeur', async () => {
    const { plateforme, identity, headers } = await site()
    const rien = await ligne(plateforme.id)
    const aCtrl = await ligne(plateforme.id)
    const ctrl = await ligne(plateforme.id)
    await afficheRattachee(identity, plateforme.id, [{ ligneId: aCtrl.id, quantite: 2 }])
    await afficheRattachee(
      identity,
      plateforme.id,
      [{ ligneId: ctrl.id, quantite: 2 }],
      'CONTROLEE',
    )
    const { body } = await lister(headers, '?statut=tous&controle=RIEN_RECU,A_CONTROLER')
    expect(ids(body?.items)).toEqual(tri(rien.id, aCtrl.id))
    expect(body?.compteurs.controle).toEqual([
      { valeur: 'A_CONTROLER', nombre: 1 },
      { valeur: 'CONTROLEE', nombre: 1 },
      { valeur: 'RIEN_RECU', nombre: 1 },
    ])
  })

  it('RG-REC-019 rejet : valeur de Contrôle inconnue → 400', async () => {
    const { headers } = await site()
    expect((await lister(headers, '?controle=PERDU')).r.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------------------------
describe('RG-REC-020 Livraison prévue', () => {
  it('RG-REC-020 affichage seul : « — » (null) pour toute ligne tant que Q-134 n’est pas tranchée', async () => {
    const { plateforme, identity, headers } = await site()
    await ligne(plateforme.id)
    const l = await ligne(plateforme.id)
    await afficheRattachee(identity, plateforme.id, [{ ligneId: l.id, quantite: 2 }])
    const { body } = await lister(headers, '?statut=tous')
    expect(body?.items.map((i) => i.livraisonPrevue)).toEqual([null, null])
  })
})

// ---------------------------------------------------------------------------------------------
describe('RG-REC-012 recherche à la frappe (Q-165)', () => {
  it('RG-REC-012 annonceur sans accents ni casse : « CREDIT », « crédit », « agricole »', async () => {
    const { plateforme, headers } = await site()
    const l = await ligne(plateforme.id, { annonceur: 'Crédit Agricole' })
    await ligne(plateforme.id, { annonceur: 'Autre' })
    for (const q of ['CREDIT', 'crédit', 'agricole', 'CRÉDIT AGRICOLE']) {
      const { body } = await lister(headers, `?q=${encodeURIComponent(q)}`)
      expect(ids(body?.items)).toEqual([l.id])
    }
  })

  it('RG-REC-012 valeur saisie deux fois : ligne listée une fois, valeur absente signalée une fois', async () => {
    const { plateforme, headers } = await site()
    const l = await ligne(plateforme.id, { contNum: 910037 })
    const { body } = await lister(
      headers,
      `?q=${encodeURIComponent('910037 910037, 123456 123456')}`,
    )
    expect(ids(body?.items)).toEqual([l.id])
    expect(body?.recherche.absents).toEqual(['123456'])
  })

  it('RG-REC-012 liste collée (retours à la ligne, tabulations, points-virgules)', async () => {
    const { plateforme, headers } = await site()
    const lignes = await Promise.all(
      [911001, 911002, 911003, 911004].map((contNum) => ligne(plateforme.id, { contNum })),
    )
    const { body } = await lister(
      headers,
      `?q=${encodeURIComponent('911001\n911002\t911003;\r\n911004\n')}`,
    )
    expect(ids(body?.items)).toEqual(tri(...lignes.map((l) => l.id)))
    expect(body?.recherche.absents).toEqual([])
  })

  it('RG-REC-012 un n° qui est le dossier d’une ligne ET la DA d’une autre trouve les deux', async () => {
    const { plateforme, headers } = await site()
    const parDossier = await ligne(plateforme.id, { contNum: 912345 })
    const parDa = await ligne(plateforme.id, { contNum: 912999, idDaChapeau: 912345 })
    await ligne(plateforme.id, { contNum: 912000 })
    const { body } = await lister(headers, '?q=912345')
    expect(ids(body?.items)).toEqual(tri(parDossier.id, parDa.id))
  })

  it('RG-REC-012 / RG-REC-025 suffixe -W dans la recherche : trouve le dossier', async () => {
    const { plateforme, headers } = await site()
    const l = await ligne(plateforme.id, { contNum: 913000 })
    const { body } = await lister(headers, '?q=913000-W')
    expect(ids(body?.items)).toEqual([l.id])
  })

  it('RG-REC-012 / RG-REC-001 un dossier d’un autre site est « absent » (jamais révélé)', async () => {
    const { headers } = await site()
    const ailleurs = await f.createPlateforme(db)
    await ligne(ailleurs.id, { contNum: 914000 })
    const { body } = await lister(headers, '?q=914000')
    expect(body?.items).toEqual([])
    expect(body?.recherche).toEqual({ absents: ['914000'], masques: [] })
  })

  it('RG-REC-012 « Masqués par Départ » : le dossier existe mais sa semaine est hors du filtre', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, {
      contNum: 915000,
      semAnnee: decale(-1).annee,
      semNum: decale(-1).semaine,
    })
    await ligne(plateforme.id, { contNum: 915999 })
    const { body } = await lister(headers, `?q=915000&depart=${formatSemaineIso(courante)}`)
    expect(body?.items).toEqual([])
    expect(body?.recherche.masques).toEqual([{ valeur: '915000', filtres: ['Départ'] }])
  })

  it('RG-REC-012 masqué par DEUX filtres à la fois : les deux filtres en cause sont cités', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { contNum: 916000, statut: 'COMPLETE', format: '8m2' })
    await ligne(plateforme.id, { contNum: 916999, format: '2m2' })
    const { body } = await lister(headers, '?q=916000&format=2m2')
    expect(body?.items).toEqual([])
    expect(body?.recherche.masques).toEqual([{ valeur: '916000', filtres: ['Statut', 'Format'] }])
  })

  it('RG-REC-012 une valeur trouvée et visible n’est ni absente ni masquée', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { contNum: 917000 })
    const { body } = await lister(headers, '?q=917000')
    expect(body?.recherche).toEqual({ absents: [], masques: [] })
  })

  it('RG-REC-012 saisie faite uniquement de séparateurs : aucune restriction', async () => {
    const { plateforme, headers } = await site()
    const a = await ligne(plateforme.id)
    const b = await ligne(plateforme.id)
    const { body } = await lister(headers, `?q=${encodeURIComponent(' ,; + ')}`)
    expect(ids(body?.items)).toEqual(tri(a.id, b.id))
  })

  it('RG-REC-012 limite de saisie : 2000 caractères acceptés, 2001 refusés (400)', async () => {
    const { headers } = await site()
    expect((await lister(headers, `?q=${'a'.repeat(2000)}`)).r.statusCode).toBe(200)
    const { r } = await lister(headers, `?q=${'a'.repeat(2001)}`)
    expect(r.statusCode).toBe(400)
  })

  it('RG-REC-012 / RG-REC-013 recherche ET filtre dossier se cumulent (ET)', async () => {
    const { plateforme, headers } = await site()
    const a = await ligne(plateforme.id, { contNum: 918000, annonceur: 'Zèbre' })
    await ligne(plateforme.id, { contNum: 918001, annonceur: 'Zèbre' })
    await ligne(plateforme.id, { contNum: 918000, annonceur: 'Lion' })
    const { body } = await lister(headers, '?q=zebre&dossier=918000')
    expect(ids(body?.items)).toEqual([a.id])
  })
})

// ---------------------------------------------------------------------------------------------
describe('RG-REC-013 format du n° de dossier', () => {
  it.each(['91003', '9100370', 'ABCDEF', '910037-X', '910037W', '91003-W'])(
    'RG-REC-013 rejet : « %s » → 400 REC_DOSSIER_FORMAT',
    async (dossier) => {
      const { headers } = await site()
      const { r } = await lister(headers, `?dossier=${encodeURIComponent(dossier)}`)
      expect(r.statusCode).toBe(400)
      expect(ErrorResponseSchema.parse(r.json())).toMatchObject({
        code: 'REC_DOSSIER_FORMAT',
        regle: 'RG-REC-013',
      })
    },
  )

  it('RG-REC-013 bornes valides : 6 chiffres (000000, 999999) et plusieurs dossiers', async () => {
    const { plateforme, headers } = await site()
    const a = await ligne(plateforme.id, { contNum: 999999 })
    const b = await ligne(plateforme.id, { contNum: 919000 })
    const { r, body } = await lister(headers, '?dossier=000000,999999,919000-W')
    expect(r.statusCode).toBe(200)
    expect(ids(body?.items)).toEqual(tri(a.id, b.id))
  })

  it('RG-REC-013 liste mixte : le refus détaille seulement les valeurs invalides', async () => {
    const { headers } = await site()
    const { r } = await lister(headers, '?dossier=910037,1234,910074-W,abc')
    expect(r.statusCode).toBe(400)
    expect(ErrorResponseSchema.parse(r.json())).toMatchObject({
      code: 'REC_DOSSIER_FORMAT',
      regle: 'RG-REC-013',
      details: { invalides: ['1234', 'abc'] },
    })
  })
})

// ---------------------------------------------------------------------------------------------
describe('RG-REC-016 filtres, combinaisons et compteurs', () => {
  it('RG-REC-016 compteurs calculés sur le résultat de la recherche (pas sur tout le site)', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { contNum: 920000, statut: 'ATTENDUE', format: '2m2' })
    await ligne(plateforme.id, { contNum: 920000, statut: 'COMPLETE', format: '2m2' })
    await ligne(plateforme.id, { contNum: 920999, statut: 'ATTENDUE', format: '8m2' })
    const { body } = await lister(headers, '?q=920000')
    expect(body?.compteurs.statut).toEqual([
      { valeur: 'ATTENDUE', nombre: 1 },
      { valeur: 'COMPLETE', nombre: 1 },
    ])
    // Format : compté hors filtre Format mais AVEC le filtre Statut par défaut.
    expect(body?.compteurs.format).toEqual([{ valeur: '2m2', nombre: 1 }])
  })

  it('RG-REC-016 compteurs calculés sur le filtre n° de dossier', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { contNum: 921000, annonceur: 'A' })
    await ligne(plateforme.id, { contNum: 921999, annonceur: 'B' })
    const { body } = await lister(headers, '?dossier=921000')
    expect(body?.compteurs.annonceur).toEqual([{ valeur: 'A', nombre: 1 }])
  })

  it('RG-REC-016 combinaison des cinq filtres (ET entre filtres, OU dans un filtre)', async () => {
    const { plateforme, identity, headers } = await site()
    const s1 = decale(1)
    const vise = await ligne(plateforme.id, {
      format: '8m2',
      annonceur: 'Alpha',
      semAnnee: s1.annee,
      semNum: s1.semaine,
      qteBc: 10,
    })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: vise.id, quantite: 12 }])
    // Chaque ligne suivante viole UN seul des filtres.
    await ligne(plateforme.id, {
      format: '2m2',
      annonceur: 'Alpha',
      semAnnee: s1.annee,
      semNum: s1.semaine,
    })
    const autreAnn = await ligne(plateforme.id, {
      format: '8m2',
      annonceur: 'Beta',
      semAnnee: s1.annee,
      semNum: s1.semaine,
      qteBc: 10,
    })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: autreAnn.id, quantite: 12 }])
    const autreSem = await ligne(plateforme.id, { format: '8m2', annonceur: 'Alpha', qteBc: 10 })
    await afficheRattachee(identity, plateforme.id, [{ ligneId: autreSem.id, quantite: 12 }])
    const ctrl = await ligne(plateforme.id, {
      format: '8m2',
      annonceur: 'Alpha',
      semAnnee: s1.annee,
      semNum: s1.semaine,
      qteBc: 10,
    })
    await afficheRattachee(
      identity,
      plateforme.id,
      [{ ligneId: ctrl.id, quantite: 12 }],
      'CONTROLEE',
    )

    const { body } = await lister(
      headers,
      `?statut=COMPLETE,SURPLUS&depart=${formatSemaineIso(s1)}&format=8m2,4m2&controle=A_CONTROLER&annonceur=Alpha`,
    )
    expect(ids(body?.items)).toEqual([vise.id])
    expect(body?.filtres).toEqual({
      statut: ['COMPLETE', 'SURPLUS'],
      depart: [formatSemaineIso(s1)],
      format: ['8m2', '4m2'],
      controle: ['A_CONTROLER'],
      annonceur: ['Alpha'],
    })
  })

  it('RG-REC-016 statut à plusieurs valeurs : Complète + Surplus seulement', async () => {
    const { plateforme, headers } = await site()
    const c = await ligne(plateforme.id, { statut: 'COMPLETE' })
    const s = await ligne(plateforme.id, { statut: 'SURPLUS' })
    await ligne(plateforme.id, { statut: 'ATTENDUE' })
    await ligne(plateforme.id, { statut: 'PARTIELLE' })
    const { body } = await lister(headers, '?statut=COMPLETE,SURPLUS')
    expect(ids(body?.items)).toEqual(tri(c.id, s.id))
  })

  it('RG-REC-016 rejet : un statut inconnu dans une liste valide → 400', async () => {
    const { headers } = await site()
    expect((await lister(headers, '?statut=ATTENDUE,PERDUE')).r.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------------------------
describe('RG-REC-015 Départ : valeurs par défaut et semaines ISO', () => {
  it('RG-REC-015 aucune ligne en semaine courante ou suivante : le défaut ne montre PAS les semaines passées', async () => {
    const { plateforme, headers } = await site()
    const passee = await ligne(plateforme.id, {
      semAnnee: decale(-1).annee,
      semNum: decale(-1).semaine,
    })
    const { body } = await lister(headers)
    expect(body?.items.map((i) => i.id)).not.toContain(passee.id)
  })

  it('RG-REC-015 options du filtre Départ (compteurs) ≥ semaine de production', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { semAnnee: decale(-2).annee, semNum: decale(-2).semaine })
    await ligne(plateforme.id)
    const { body } = await lister(headers)
    expect(body?.compteurs.depart.map((c) => c.valeur)).toEqual([formatSemaineIso(courante)])
  })

  it('RG-REC-015 changement d’année ISO : le 1er janvier 2027 est en 2026-W53 ; défaut = 2026-W53 et suivantes', async () => {
    const { plateforme, identity } = await site()
    const semaines: SemaineIso[] = [
      { annee: 2026, semaine: 52 },
      { annee: 2026, semaine: 53 },
      { annee: 2027, semaine: 1 },
      { annee: 2027, semaine: 2 },
    ]
    for (const s of semaines) await ligne(plateforme.id, { semAnnee: s.annee, semNum: s.semaine })
    const res = await listerReceptionsAttendues(
      db,
      identity,
      ListeAttenduesQuerySchema.parse({ sort: 'depart' }),
      new Date('2027-01-01T10:00:00Z'),
    )
    expect(res.filtres.depart).toEqual(['2026-W53', '2027-W01', '2027-W02'])
    expect(res.items.map((i) => i.depart)).toEqual(['2026-W53', '2027-W01', '2027-W02'])
  })

  it('RG-REC-015 changement d’année ISO : le 30 décembre 2025 est en 2026-W01 (2025-W52 exclue)', async () => {
    const { plateforme, identity } = await site()
    await ligne(plateforme.id, { semAnnee: 2025, semNum: 52 })
    await ligne(plateforme.id, { semAnnee: 2026, semNum: 1 })
    const res = await listerReceptionsAttendues(
      db,
      identity,
      ListeAttenduesQuerySchema.parse({}),
      new Date('2025-12-30T10:00:00Z'),
    )
    expect(res.filtres.depart).toEqual(['2026-W01'])
    expect(res.items.map((i) => i.depart)).toEqual(['2026-W01'])
  })

  it('RG-REC-015 bornes du numéro de semaine : W01 et W53 acceptées, W00 refusée (400)', async () => {
    const { headers } = await site()
    expect((await lister(headers, '?depart=2026-W01,2026-W53')).r.statusCode).toBe(200)
    expect((await lister(headers, '?depart=2026-W00')).r.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------------------------
describe('Pagination du tableau (limites)', () => {
  it('RG-REC-014 pageSize 200 accepté ; 201 et 0 refusés (400) ; page 0 refusée (400)', async () => {
    const { headers } = await site()
    expect((await lister(headers, '?pageSize=200')).r.statusCode).toBe(200)
    expect((await lister(headers, '?pageSize=201')).r.statusCode).toBe(400)
    expect((await lister(headers, '?pageSize=0')).r.statusCode).toBe(400)
    expect((await lister(headers, '?page=0')).r.statusCode).toBe(400)
    expect((await lister(headers, '?page=abc')).r.statusCode).toBe(400)
  })

  it('RG-REC-014 page au-delà de la dernière : aucune ligne, total conservé', async () => {
    const { plateforme, headers } = await site()
    for (let i = 0; i < 3; i++) await ligne(plateforme.id)
    const { body } = await lister(headers, '?page=5&pageSize=2')
    expect(body).toMatchObject({ items: [], total: 3, page: 5, pageSize: 2 })
    expect(body?.aucuneLigneSurLeSite).toBe(false)
  })

  it('RG-REC-014 dernière page partielle exacte', async () => {
    const { plateforme, headers } = await site()
    for (let i = 0; i < 5; i++) await ligne(plateforme.id)
    const { body } = await lister(headers, '?page=3&pageSize=2')
    expect(body?.items).toHaveLength(1)
    expect(body?.total).toBe(5)
  })
})

// ---------------------------------------------------------------------------------------------
describe('RG-REC-014 / RG-REC-001 lignes du périmètre multi-sites', () => {
  it('RG-REC-001 périmètre de deux sites sans site choisi : lignes des deux sites, aucune d’un 3e', async () => {
    const { a, b, user } = await deuxSites()
    const la = await ligne(a.id)
    const lb = await ligne(b.id)
    await ligne((await f.createPlateforme(db)).id)
    const { body } = await lister(devHeaders(user.identifiantExterne))
    expect(ids(body?.items)).toEqual(tri(la.id, lb.id))
  })

  it('RG-REC-001 site choisi dans le bandeau : seulement ce site', async () => {
    const { a, b, user } = await deuxSites()
    const la = await ligne(a.id)
    await ligne(b.id)
    const { body } = await lister(devHeaders(user.identifiantExterne, a.id))
    expect(ids(body?.items)).toEqual([la.id])
  })

  it('RG-REC-014 thème exclu (Q-135) masqué même recherché : signalé absent', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { contNum: 922000, themeExclu: true })
    const { body } = await lister(headers, '?statut=tous&q=922000')
    expect(body?.items).toEqual([])
    expect(body?.recherche.absents).toEqual(['922000'])
  })

  it('RG-REC-014 site avec seulement des lignes exclues : « Aucune réception attendue à proposer sur ce site. »', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { themeExclu: true })
    await ligne(plateforme.id, { etatLigne: 'ANNULEE' })
    const { body } = await lister(headers)
    expect(body?.aucuneLigneSurLeSite).toBe(true)
  })

  it('RG-REC-014 lignes présentes mais filtrées : aucuneLigneSurLeSite = faux (« Aucune ligne pour ces filtres. »)', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { statut: 'COMPLETE' })
    const { body } = await lister(headers)
    expect(body).toMatchObject({ items: [], aucuneLigneSurLeSite: false })
  })

  it('RG-REC-002 expe avec un site choisi : toujours refusé en consultation (✘*, Q-171) → 403', async () => {
    const { plateforme } = await site()
    const expe = await f.createUtilisateurAvecRoles(db, ['expe'], [{ plateformeId: plateforme.id }])
    const { r } = await lister(devHeaders(expe.identifiantExterne, plateforme.id))
    expect(r.statusCode).toBe(403)
    expect(ErrorResponseSchema.parse(r.json())).toMatchObject({
      code: 'REC_ACCES_REFUSE',
      regle: 'RG-REC-002',
    })
  })
})

// ---------------------------------------------------------------------------------------------
describe('RG-REC-010 badges du menu Réception', () => {
  async function jeuBadges() {
    const { a, b, user } = await deuxSites(['coord'])
    const c = await f.createPlateforme(db)
    for (const p of [a, b, c]) {
      await f.createReception(db, { plateformeId: p.id, statut: 'A_CONTROLER' })
      await f.createAffiche(db, { plateformeId: p.id, statut: 'ORPHELINE' })
    }
    // Ne comptent pas : palette à identifier (hors sas, RG-REC-071), contrôlée ; affiche identifiée.
    await f.createReception(db, { plateformeId: a.id, statut: 'A_IDENTIFIER' })
    await f.createReception(db, { plateformeId: a.id, statut: 'CONTROLEE' })
    await f.createAffiche(db, { plateformeId: a.id, statut: 'IDENTIFIEE' })
    return { a, b, user }
  }

  it('RG-REC-010 périmètre de deux sites, sans site choisi : somme des deux sites, pas du 3e', async () => {
    const { user } = await jeuBadges()
    const r = await compteurs(devHeaders(user.identifiantExterne))
    expect(CompteursReceptionSchema.parse(r.json())).toEqual({
      palettesAControler: 2,
      affichesOrphelines: 2,
    })
  })

  it('RG-REC-010 site choisi : compteurs de ce site seulement (palette à identifier exclue du sas)', async () => {
    const { a, user } = await jeuBadges()
    const r = await compteurs(devHeaders(user.identifiantExterne, a.id))
    expect(CompteursReceptionSchema.parse(r.json())).toEqual({
      palettesAControler: 1,
      affichesOrphelines: 1,
    })
  })

  it.each([
    ['coord', { palettesAControler: 1, affichesOrphelines: 1 }],
    ['recep', { palettesAControler: 1, affichesOrphelines: 1 }],
    ['cheq', { palettesAControler: 1, affichesOrphelines: null }],
    ['com', { palettesAControler: 1, affichesOrphelines: null }],
    ['expe', { palettesAControler: null, affichesOrphelines: null }],
  ] as const)('RG-REC-010 / RG-REC-002 badges vus par %s (matrice §2)', async (role, attendu) => {
    const { plateforme, headers } = await site([role])
    await f.createReception(db, { plateformeId: plateforme.id, statut: 'A_CONTROLER' })
    await f.createAffiche(db, { plateformeId: plateforme.id, statut: 'ORPHELINE' })
    const r = await compteurs(headers)
    expect(r.statusCode).toBe(200)
    expect(CompteursReceptionSchema.parse(r.json())).toEqual(attendu)
  })

  // HYPOTHÈSE Q-186 (11) (audit COO-P04) : l'admin consulte les réceptions inconnues → badge présent.
  it('RG-REC-010 / RG-REC-002 admin (Q-421 super-utilisateur) : badge du sas et badge des inconnues présents', async () => {
    const { plateforme } = await site()
    await f.createReception(db, { plateformeId: plateforme.id, statut: 'A_CONTROLER' })
    const admin = await f.createUtilisateurAvecRoles(db, ['admin'], [])
    for (const h of [
      devHeaders(admin.identifiantExterne),
      devHeaders(admin.identifiantExterne, plateforme.id),
    ]) {
      const r = await compteurs(h)
      expect(r.statusCode).toBe(200)
      const b = CompteursReceptionSchema.parse(r.json())
      expect(b.palettesAControler).not.toBeNull()
      expect(b.affichesOrphelines).not.toBeNull()
    }
  })

  it('RG-REC-004 badges sans identité → 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/reception/compteurs' })).statusCode).toBe(
      401,
    )
  })

  it('RG-REC-001 badges d’un site hors périmètre → 403 REC_PERIMETRE_INTERDIT', async () => {
    const { user } = await site(['coord'])
    const autre = await f.createPlateforme(db)
    const r = await compteurs(devHeaders(user.identifiantExterne, autre.id))
    expect(r.statusCode).toBe(403)
    expect(ErrorResponseSchema.parse(r.json())).toMatchObject({
      code: 'REC_PERIMETRE_INTERDIT',
      regle: 'RG-REC-001',
    })
  })
})

// ---------------------------------------------------------------------------------------------
// Purge : fonction globale (toutes plateformes). Les tests vérifient LEURS lignes, jamais le total
// global, et sont placés en fin de fichier (les fichiers d'intégration ne tournent pas en parallèle).
describe('RG-REC-180 / RG-REC-181 purge (HYPOTHÈSE Q-130 : depuis le lundi de la semaine de départ)', () => {
  const W53: SemaineIso = { annee: 2026, semaine: 53 }
  const lundiW53 = lundiSemaineIso(W53) // 2026-12-28

  it('RG-REC-180 borne exacte : 4 semaines pile après le lundi → gardée ; 1 ms de plus → purgée (passage d’année ISO)', async () => {
    const { plateforme } = await site()
    const l = await ligne(plateforme.id, { semAnnee: W53.annee, semNum: W53.semaine })
    const pile = new Date(lundiW53.getTime() + 28 * JOUR)
    expect(pile.toISOString()).toBe('2027-01-25T00:00:00.000Z')
    await purgerReceptionsAttendues(db, pile)
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).etatLigne).toBe(
      'ACTIVE',
    )
    const apres = new Date(pile.getTime() + 1)
    await purgerReceptionsAttendues(db, apres)
    const purgee = await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })
    expect(purgee).toMatchObject({ etatLigne: 'ANNULEE', purgeeLe: apres, version: l.version + 1 })
  })

  it('RG-REC-180 paramètre purgeAttendues modifié (2 semaines) : une ligne de 3 semaines est purgée', async () => {
    const { plateforme } = await site()
    const s: SemaineIso = { annee: 2021, semaine: 10 }
    const l = await ligne(plateforme.id, { semAnnee: s.annee, semNum: s.semaine })
    const maintenant = new Date(lundiSemaineIso(s).getTime() + 21 * JOUR)
    await purgerReceptionsAttendues(db, maintenant)
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).etatLigne).toBe(
      'ACTIVE',
    )
    await avecParametreGlobal('reception.purgeAttendues', '2', async () => {
      await purgerReceptionsAttendues(db, maintenant)
      const journal = await db.journalAudit.findFirstOrThrow({
        where: { action: 'PURGE_ATTENDUES' },
        orderBy: { id: 'desc' },
      })
      expect(JSON.parse(journal.donnees ?? '{}')).toMatchObject({ purgeAttendues: 2 })
    })
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).etatLigne).toBe(
      'ANNULEE',
    )
  })

  it('RG-REC-180 idempotence : un 2e passage ne purge rien, ne change ni date ni version, et journalise « 0 »', async () => {
    const { plateforme } = await site()
    const s: SemaineIso = { annee: 2021, semaine: 20 }
    const l = await ligne(plateforme.id, { semAnnee: s.annee, semNum: s.semaine })
    const maintenant = new Date(lundiSemaineIso(s).getTime() + 60 * JOUR)
    await purgerReceptionsAttendues(db, maintenant)
    const premiere = await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })
    expect(premiere.etatLigne).toBe('ANNULEE')
    const n2 = await purgerReceptionsAttendues(db, new Date(maintenant.getTime() + JOUR))
    expect(n2).toBe(0)
    const seconde = await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })
    expect(seconde.purgeeLe).toEqual(premiere.purgeeLe)
    expect(seconde.version).toBe(premiere.version)
    const journal = await db.journalAudit.findFirstOrThrow({
      where: { action: 'PURGE_ATTENDUES' },
      orderBy: { id: 'desc' },
    })
    expect(journal.nouvelleValeur).toBe('0 réception(s) attendue(s) purgée(s).')
  })

  it('RG-REC-180 lignes déjà ANNULEE : jamais touchées (ni date de purge, ni version)', async () => {
    const { plateforme } = await site()
    const s: SemaineIso = { annee: 2021, semaine: 30 }
    const l = await ligne(plateforme.id, {
      semAnnee: s.annee,
      semNum: s.semaine,
      etatLigne: 'ANNULEE',
    })
    await purgerReceptionsAttendues(db, new Date(lundiSemaineIso(s).getTime() + 60 * JOUR))
    const apres = await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })
    expect(apres).toMatchObject({ etatLigne: 'ANNULEE', purgeeLe: null, version: l.version })
  })

  it('RG-REC-180 seules Attendue/Partielle non conservées : Complète, Surplus et Partielle « à l’année » gardées', async () => {
    const { plateforme } = await site()
    const s: SemaineIso = { annee: 2021, semaine: 40 }
    const base = { semAnnee: s.annee, semNum: s.semaine }
    const purgees = [
      await ligne(plateforme.id, { ...base, statut: 'ATTENDUE', source: 'BC' }),
      await ligne(plateforme.id, { ...base, statut: 'PARTIELLE', source: 'PREPA', qtePrepa: 5 }),
    ]
    const gardees = [
      await ligne(plateforme.id, { ...base, statut: 'COMPLETE' }),
      await ligne(plateforme.id, { ...base, statut: 'SURPLUS' }),
      await ligne(plateforme.id, { ...base, statut: 'PARTIELLE', conserverAnnee: true }),
    ]
    const nbAvant = await db.receptionAttendue.count()
    await purgerReceptionsAttendues(db, new Date(lundiSemaineIso(s).getTime() + 60 * JOUR))
    for (const l of purgees)
      expect(
        (await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).etatLigne,
      ).toBe('ANNULEE')
    for (const l of gardees)
      expect(await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({
        etatLigne: 'ACTIVE',
        purgeeLe: null,
      })
    // RG-COO-089 : jamais supprimée.
    expect(await db.receptionAttendue.count()).toBe(nbAvant)
  })

  it('RG-REC-181 la ligne de journal cite les lignes purgées, sans auteur', async () => {
    const { plateforme } = await site()
    const s: SemaineIso = { annee: 2021, semaine: 45 }
    const l = await ligne(plateforme.id, { semAnnee: s.annee, semNum: s.semaine })
    const n = await purgerReceptionsAttendues(
      db,
      new Date(lundiSemaineIso(s).getTime() + 60 * JOUR),
    )
    const journal = await db.journalAudit.findFirstOrThrow({
      where: { action: 'PURGE_ATTENDUES' },
      orderBy: { id: 'desc' },
    })
    expect(journal).toMatchObject({
      parId: null,
      nouvelleValeur: `${n} réception(s) attendue(s) purgée(s).`,
    })
    expect((JSON.parse(journal.donnees ?? '{}') as { ids: number[] }).ids).toContain(l.id)
  })

  it('RG-REC-180 / RG-REC-005 atomicité : si l’écriture du journal échoue, aucune ligne n’est purgée', async () => {
    const { plateforme } = await site()
    const s: SemaineIso = { annee: 2021, semaine: 48 }
    const l = await ligne(plateforme.id, { semAnnee: s.annee, semNum: s.semaine })
    const journalAvant = await db.journalAudit.count({ where: { action: 'PURGE_ATTENDUES' } })
    // Client dont la transaction refuse l'écriture du journal (échec au milieu de l'opération).
    const enPanne = new Proxy(db, {
      get(cible, prop, recv) {
        if (prop !== '$transaction') return Reflect.get(cible, prop, recv) as unknown
        return (fn: (tx: unknown) => Promise<unknown>) =>
          cible.$transaction((tx) =>
            fn(
              new Proxy(tx, {
                get(t, p, r) {
                  if (p === 'journalAudit')
                    return {
                      create: () => Promise.reject(new Error('panne simulée du journal')),
                    }
                  return Reflect.get(t, p, r) as unknown
                },
              }),
            ),
          )
      },
    })
    await expect(
      purgerReceptionsAttendues(enPanne, new Date(lundiSemaineIso(s).getTime() + 60 * JOUR)),
    ).rejects.toThrow('panne simulée du journal')
    expect(await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({
      etatLigne: 'ACTIVE',
      purgeeLe: null,
      version: l.version,
    })
    expect(await db.journalAudit.count({ where: { action: 'PURGE_ATTENDUES' } })).toBe(journalAvant)
  })
})
