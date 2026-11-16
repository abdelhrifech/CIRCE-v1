// COO-P12 — tests d'INTÉGRATION de l'écran « unitaire » (préparation 2 m² fixe, pliage, bus) : liste et entretien à
// l'afficheur (RG-COO-238, 245, 248, 290), quantité à produire (RG-COO-239), corriger l'intitulé (RG-COO-244), rendre
// la main (RG-COO-243), retirer / préparer (RG-COO-249, 250), comptage du pliage (RG-COO-247), fiche de synthèse
// (RG-COO-246), quantités à encoller du Bus (RG-COO-304, 305), réalignement de l'entretien (RG-COO-124).
// Hypothèses : Q-196 ; RG-COO-240 / 241 / 242 / 260 : liberation-colisage.int.test.ts (Q-265, option (c) par défaut).
// Aucun test unitaire : API réelle sur la base de test (test.db), données par les factories.
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest'
import {
  EncollerSchema,
  ResultatUnitaireSchema,
  SyntheseSchema,
  UnitaireSchema,
  formatSemaineIso,
  lundiSemaineIso,
  type LotIntegration,
  semaineIsoDe,
  type Role,
} from '@circe/shared'
import type { StatutProduction } from '../../src/generated/prisma/client.ts'
import type { BroadcastPort } from '../../src/core/ports/broadcast.ts'
import { lancerPassage } from '../../src/modules/coordination/integration-broadcast.ts'
import { realignerEntretien } from '../../src/modules/coordination/integration-flux.ts'
import { calculBroadcast, quantiteAEncoller } from '../../src/modules/coordination/unitaire.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception, erreur, get } from '../support/reception.ts'
import {
  avecEchec,
  envoyer,
  parametre,
  restaurerParametres,
  ROLES,
  ROLES_SANS_ADMIN,
} from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterEach(restaurerParametres)
afterAll(() => ctx.arreter())

type H = Record<string, string>
const SEM = semaineIsoDe(
  new Date(lundiSemaineIso(semaineIsoDe(new Date())).getTime() + 7 * 86_400_000),
)
const DEPART = formatSemaineIso(SEM)
const numero = () => 600_000 + Math.floor(Math.random() * 300_000)

/** Site de préparation : atelier FIXE, trois types de préparation (fixe, pliage, bus), un utilisateur par rôle. */
async function siteFixe() {
  const plateforme = await f.createPlateforme(db)
  const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
  const support = await f.createSupport(db, { nom: 'Format 2 m²' })
  const [typeFixe, typePliage, typeBus] = await Promise.all(
    ['2 m² fixe', 'Pliage', 'Bus'].map((libelle) =>
      db.typePreparation.create({ data: { libelle } }),
    ),
  )
  const dest = [
    await f.createDestinataire(db, { nom: `Dest A ${String(next())}` }),
    await f.createDestinataire(db, { nom: `Dest B ${String(next())}` }),
  ] as const
  const users = {} as Record<Role, { id: number; headers: H }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, headers: devHeaders(u.identifiantExterne) }
  }
  return {
    plateforme,
    atelier,
    support,
    typeFixe: typeFixe as { id: number },
    typePliage: typePliage as { id: number },
    typeBus: typeBus as { id: number },
    dest,
    users,
  }
}
type Site = Awaited<ReturnType<typeof siteFixe>>

async function typesParam(...sites: Site[]) {
  await parametre(ctx, 'unitaire.typesPliage', sites.map((x) => x.typePliage.id).join(';'))
  await parametre(ctx, 'unitaire.typesBus', sites.map((x) => x.typeBus.id).join(';'))
}

interface OptLigne {
  type?: 'typeFixe' | 'typePliage' | 'typeBus'
  contNum?: number
  theme?: string
  annonceur?: string
  qte?: number
  statut?: StatutProduction
  dest?: 0 | 1
  um?: { id: number } | null
  semaine?: { annee: number; semaine: number }
  repiquage?: string | null
  extra?: Record<string, unknown>
}
async function ligne(s: Site, o: OptLigne = {}) {
  const sem = o.semaine ?? SEM
  return f.createRepartition(db, {
    atelierId: s.atelier.id,
    typePreparationId: s[o.type ?? 'typeFixe'].id,
    supportId: s.support.id,
    destinataireId: s.dest[o.dest ?? 0].id,
    contNum: o.contNum ?? numero(),
    theme: o.theme ?? `Thème ${String(next())}`,
    annonceur: o.annonceur ?? 'ANNONCEUR',
    qte: o.qte ?? 10,
    statut: o.statut ?? 'A_TRAITER',
    semAnnee: sem.annee,
    semNum: sem.semaine,
    repiquage: o.repiquage ?? null,
    ...(o.um ? { uniteId: o.um.id } : {}),
    ...(o.extra ?? {}),
  })
}
/** UM « En cours » avec sa répartition « En cours » (ligne prête à retirer / préparer). */
async function ligneAvecUm(s: Site, o: OptLigne & { umStatut?: StatutProduction } = {}) {
  const um = await f.createUniteManutention(db, {
    atelierId: s.atelier.id,
    statut: o.umStatut ?? 'EN_COURS',
  })
  const r = await ligne(s, { statut: 'EN_COURS', ...o, um })
  return { um, r }
}

const q = (s: Site, qs = '', role: Role = 'coord') =>
  get(ctx, `/api/coordination/unitaire${qs}`, s.users[role].headers)
const lister = async (s: Site, qs = '', role: Role = 'coord') => {
  const r = await q(s, qs, role)
  expect(r.statusCode, r.body).toBe(200)
  return UnitaireSchema.parse(r.json())
}
const ref = (r: { id: number; version: number }) => ({ id: r.id, version: r.version })
const post = (s: Site, chemin: string, payload: unknown, role: Role = 'coord', cle?: H) =>
  envoyer(ctx, `/api/coordination/unitaire/${chemin}`, s.users[role].headers, payload, cle)
const repLue = (id: number) => db.repartition.findUniqueOrThrow({ where: { id } })

// ───────────────────────── RG-COO-290 / 238 / 245 / 248 : liste ─────────────────────────

describe('RG-COO-290 liste des unités : périmètre, exclusions, types', () => {
  it('RG-COO-290 liste les lignes de l’atelier, sans les statuts 3 et 4 ni les autres types', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const a = await ligne(s, { statut: 'A_TRAITER' })
    const b = await ligne(s, { statut: 'EN_COURS' })
    await ligne(s, { statut: 'ANNULE' })
    await ligne(s, { statut: 'ERREUR' })
    await ligne(s, { type: 'typePliage' })
    await ligne(s, { type: 'typeBus' })
    const fixe = await lister(s)
    expect(fixe.type).toBe('fixe')
    expect(fixe.lignes.flatMap((l) => l.refs.map((x) => x.id)).sort()).toEqual([a.id, b.id].sort())
    expect((await lister(s, '?type=pliage')).lignes).toHaveLength(1)
    expect((await lister(s, '?type=bus')).lignes).toHaveLength(1)
    expect(fixe.ateliers.map((x) => x.id)).toEqual([s.atelier.id])
  })

  it('RG-COO-290 / 248 aucun paramètre de type : tout atelier fixe est « 2 m² fixe » (une seule distinction)', async () => {
    const s = await siteFixe()
    await ligne(s, { type: 'typePliage' })
    await ligne(s, { type: 'typeBus' })
    await ligne(s, { type: 'typeFixe' })
    expect((await lister(s)).lignes).toHaveLength(3)
    expect((await lister(s, '?type=pliage')).lignes).toHaveLength(0)
    expect((await lister(s, '?type=bus')).lignes).toHaveLength(0)
  })

  it('RG-COO-248 deux lignes du même destinataire, thème, dossier et semaine : une seule ligne (Vrac + Roulée fusionnés)', async () => {
    const s = await siteFixe()
    const contNum = numero()
    const a = await ligne(s, { contNum, theme: 'Thème fusion', qte: 6 })
    const b = await ligne(s, { contNum, theme: 'THEME FUSION', qte: 4 })
    const autre = await ligne(s, { contNum, theme: 'Thème fusion', qte: 5, dest: 1 })
    const { lignes } = await lister(s, `?dossier=${String(contNum)}`)
    expect(lignes).toHaveLength(2)
    const fusion = lignes.find((l) => l.refs.length === 2)
    expect(fusion?.qte).toBe(10)
    expect(fusion?.refs.map((x) => x.id).sort()).toEqual([a.id, b.id].sort())
    expect(lignes.find((l) => l.refs.length === 1)?.refs[0]?.id).toBe(autre.id)
  })

  it('RG-COO-290 filtres : dossier, départ, annonceur, statut, destinataire, afficheur', async () => {
    const s = await siteFixe()
    const c1 = numero()
    const c2 = numero()
    await ligne(s, { contNum: c1, annonceur: 'RENAULT', statut: 'EN_COURS' })
    await ligne(s, { contNum: c2, annonceur: 'PEUGEOT', dest: 1 })
    await ligne(s, {
      contNum: c2,
      annonceur: 'AUTRE',
      semaine: { annee: SEM.annee + 1, semaine: 1 },
    })
    expect((await lister(s, `?dossier=${String(c1)}`)).lignes).toHaveLength(1)
    expect((await lister(s, `?depart=${DEPART}`)).lignes).toHaveLength(2)
    expect((await lister(s, '?annonceur=peug')).lignes).toHaveLength(1)
    expect((await lister(s, '?statut=EN_COURS')).lignes).toHaveLength(1)
    const dest1 = s.dest[1].nom ?? s.dest[1].nomOrigine
    expect((await lister(s, `?destinataire=${encodeURIComponent(dest1)}`)).lignes).toHaveLength(1)
    expect((await lister(s, `?afficheur=${encodeURIComponent(dest1)}`)).lignes).toHaveLength(1)
    expect((await lister(s, '?annonceur=introuvable')).lignes).toHaveLength(0)
  })

  it('RG-COO-290 filtres invalides : 400', async () => {
    const s = await siteFixe()
    for (const qs of [
      '?type=autre',
      '?depart=2026-W54',
      '?dossier=abc',
      '?statut=INCONNU',
      '?repere=LIBERE',
    ])
      expect((await q(s, qs)).statusCode, qs).toBe(400)
  })

  it('RG-COO-290 l’affiche reçue est indicative : ✓ validée, • proposée, sinon aucune (sans bloquer les actions)', async () => {
    const s = await siteFixe()
    const c = [numero(), numero(), numero()] as const
    const themes = ['Validé', 'Proposé', 'Rien']
    for (const [i, contNum] of c.entries()) {
      await ligne(s, { contNum, theme: themes[i] ?? '', statut: 'EN_COURS' })
      if (i < 2) {
        const l = await f.createReceptionAttendue(db, {
          plateformeId: s.plateforme.id,
          supportId: s.support.id,
          contNum,
          theme: themes[i] ?? '',
        })
        const a = await f.createAffiche(db, {
          plateformeId: s.plateforme.id,
          supportId: s.support.id,
          contNum,
          validationAdmin: i === 0,
        })
        await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, quantite: 5 })
      }
    }
    const { lignes } = await lister(s)
    const parTheme = new Map(lignes.map((l) => [l.theme, l.afficheRecue]))
    expect(parTheme.get('Validé')).toBe('VALIDEE')
    expect(parTheme.get('Proposé')).toBe('PROPOSEE')
    expect(parTheme.get('Rien')).toBe('AUCUNE')
  })

  it('RG-COO-290 les thèmes exclus par Broadcast sont listés en annotation', async () => {
    const s = await siteFixe()
    const contNum = numero()
    await ligne(s, { contNum })
    await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme: 'Ne pas afficher',
      themeExclu: true,
    })
    expect((await lister(s)).themesExclus).toContain('Ne pas afficher')
  })

  it('RG-COO-245 chaque ligne porte son départ et son jour d’affichage', async () => {
    const s = await siteFixe()
    const jour = new Date('2027-03-04T00:00:00.000Z')
    await ligne(s, { extra: { dateAffichage: jour } })
    const [l] = (await lister(s)).lignes
    expect(l?.depart).toBe(DEPART)
    expect(l?.jourAffichage).toBe(jour.toISOString())
  })

  it('RG-COO-240 / 241 / 242 la libération de la semaine est disponible (Q-265, option (c)) : état lu par l’écran, routes de création inexistantes ailleurs', async () => {
    const s = await siteFixe()
    const u = await lister(s)
    expect(u.liberation.disponible).toBe(true)
    expect(u.liberation.semaines).toEqual([])
    for (const chemin of ['liberation', 'creer-um'])
      expect((await post(s, chemin, {})).statusCode, chemin).toBe(404)
  })

  it('RG-COO-251 aucun réordonnancement (drag and drop) n’existe : route absente (Q-261)', async () => {
    const s = await siteFixe()
    for (const chemin of ['reordonner', 'deplacer'])
      expect((await post(s, chemin, {})).statusCode, chemin).toBe(404)
  })

  it('RG-COO-167 un atelier d’un autre site : 403 ; un atelier déroulant : 422 ; inconnu : 404', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const deroulant = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'SCROLL' })
    expect((await q(s, `?atelier=${String(autre.atelier.id)}`)).statusCode).toBe(403)
    const r = await q(s, `?atelier=${String(deroulant.id)}`)
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('COO_ATELIER_NON_FIXE')
    expect((await q(s, '?atelier=999999999')).statusCode).toBe(404)
    await ligne(autre)
    expect((await lister(s)).lignes).toHaveLength(0)
  })

  it('RG-COO-165 / 168 la consultation est ouverte à la Coordination et au chef d’équipe seulement', async () => {
    const s = await siteFixe()
    for (const role of ROLES_SANS_ADMIN) {
      const r = await q(s, '', role)
      expect(r.statusCode, role).toBe(role === 'coord' || role === 'cheq' ? 200 : 403)
      if (r.statusCode === 403) expect(erreur(r).code).toBe('PERMISSION')
    }
    expect(erreur(await q(s, '', 'com')).regle).toBe('RG-COO-168')
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/api/coordination/unitaire' })).statusCode,
    ).toBe(401)
  })
})

describe('RG-COO-238 entretien calculé à l’afficheur', () => {
  it('RG-COO-238 aucun entretien sous le seuil (3), sinon quantité × % arrondi au supérieur, total = quantité + entretien', async () => {
    const s = await siteFixe()
    const cas: [number, number][] = [
      [2, 0], // < seuil
      [3, 1], // ceil(0,24) = 1
      [10, 1], // ceil(0,8) = 1
      [13, 2], // ceil(1,04) = 2
      [50, 4], // 4,00 pile
      [101, 9], // ceil(8,08) = 9
    ]
    for (const [qte] of cas) await ligne(s, { qte, theme: `Q${String(qte)}`, dest: 0 })
    const { lignes } = await lister(s)
    for (const [qte, attendu] of cas) {
      const l = lignes.find((x) => x.theme === `Q${String(qte)}`)
      expect(l?.entretien, `qte ${String(qte)}`).toBe(attendu)
      expect(l?.total).toBe(qte + attendu)
      expect(l?.pourcentageEntretien).toBe(8)
    }
  })

  it('RG-COO-238 le % d’entretien est celui de l’instruction du dossier (repris de Broadcast, sans ressaisie)', async () => {
    const s = await siteFixe()
    const dossier = await f.createDossier(db, {})
    await f.createInstruction(db, {
      dossierId: dossier.id,
      contNum: dossier.contNum,
      atelierId: s.atelier.id,
      entretien: 15,
    })
    await ligne(s, { contNum: dossier.contNum, qte: 50 })
    const [l] = (await lister(s, `?dossier=${String(dossier.contNum)}`)).lignes
    expect(l?.pourcentageEntretien).toBe(15)
    expect(l?.entretien).toBe(8) // ceil(7,5)
  })

  it('RG-COO-238 seuil et arrondi paramétrables ; minimum 1 dès le seuil même en arrondi « proche »', async () => {
    const s = await siteFixe()
    await ligne(s, { qte: 3, theme: 'Petite' })
    await parametre(ctx, 'trains.entretienArrondi', 'PROCHE')
    expect((await lister(s)).lignes[0]?.entretien).toBe(1)
    await parametre(ctx, 'trains.entretienSeuil', '5')
    expect((await lister(s)).lignes[0]?.entretien).toBe(0)
  })
})

// ───────────────────────── RG-COO-239 : quantité à produire ─────────────────────────

describe('RG-COO-239 modifier la quantité à produire', () => {
  it('RG-COO-239 la Coordination et le chef d’équipe modifient la quantité, avec historique ; une valeur 0 est acceptée', async () => {
    const s = await siteFixe()
    for (const role of ['coord', 'cheq'] as const) {
      const r = await ligne(s, { qte: 20 })
      const res = await post(s, 'quantite', { ...ref(r), quantite: 35 }, role)
      expect(res.statusCode, res.body).toBe(200)
      expect(ResultatUnitaireSchema.parse(res.json()).message).toContain('20 → 35')
      const apres = await repLue(r.id)
      expect(apres.qte).toBe(35)
      expect(apres.version).toBe(r.version + 1)
      const journal = await db.journalAudit.findFirst({
        where: {
          typeEntite: 'REPARTITION',
          entiteId: String(r.id),
          action: 'MODIFICATION_QUANTITE_UNITE',
        },
      })
      expect(journal?.ancienneValeur).toBe('20')
      expect(journal?.nouvelleValeur).toBe('35')
      expect(journal?.parId).toBe(s.users[role].id)
    }
    const z = await ligne(s)
    expect((await post(s, 'quantite', { ...ref(z), quantite: 0 })).statusCode).toBe(200)
    expect((await repLue(z.id)).qte).toBe(0)
  })

  it('RG-COO-239 une valeur négative ou non entière : 400, rien n’est écrit', async () => {
    const s = await siteFixe()
    const r = await ligne(s, { qte: 20 })
    for (const quantite of [-1, 1.5, '5', null]) {
      const res = await post(s, 'quantite', { ...ref(r), quantite })
      expect(res.statusCode, String(quantite)).toBe(400)
    }
    expect((await repLue(r.id)).qte).toBe(20)
  })

  it('RG-COO-239 la même valeur ne réécrit rien', async () => {
    const s = await siteFixe()
    const r = await ligne(s, { qte: 20 })
    const res = await post(s, 'quantite', { ...ref(r), quantite: 20 })
    expect(res.statusCode).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json()).traitees).toBe(0)
    expect((await repLue(r.id)).version).toBe(r.version)
  })

  it('RG-COO-239 / 223 une unité en production (ligne ou UM « Préparé » et au-delà) : 409, point de non-retour', async () => {
    const s = await siteFixe()
    const lancee = await ligne(s, { statut: 'PREPARE' })
    const { r: viaUm } = await ligneAvecUm(s, { umStatut: 'PREPARE' })
    for (const r of [lancee, viaUm]) {
      const res = await post(s, 'quantite', { ...ref(r), quantite: 99 })
      expect(res.statusCode).toBe(409)
      expect(erreur(res).code).toBe('COO_UNITE_EN_PRODUCTION')
      expect(erreur(res).regle).toBe('RG-COO-223')
    }
  })

  it('RG-COO-239 une ligne annulée ou en erreur : 409 ; inconnue : 404 ; version périmée : 409', async () => {
    const s = await siteFixe()
    const annulee = await ligne(s, { statut: 'ANNULE' })
    expect((await post(s, 'quantite', { ...ref(annulee), quantite: 1 })).statusCode).toBe(409)
    expect(
      (await post(s, 'quantite', { id: 999_999_999, version: 1, quantite: 1 })).statusCode,
    ).toBe(404)
    const r = await ligne(s)
    const res = await post(s, 'quantite', { id: r.id, version: r.version + 5, quantite: 1 })
    expect(res.statusCode).toBe(409)
    expect(erreur(res).code).toBe('COO_CONFLIT_VERSION')
  })

  it('RG-COO-239 / 165 le chef d’équipe et la Coordination seulement ; un autre site : 403', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const r = await ligne(s)
    for (const role of ROLES_SANS_ADMIN) {
      const res = await post(s, 'quantite', { ...ref(r), quantite: 12 }, role)
      expect(res.statusCode, role).toBe(role === 'coord' || role === 'cheq' ? 200 : 403)
      if (role === 'coord') Object.assign(r, await repLue(r.id))
      if (role === 'cheq') Object.assign(r, await repLue(r.id))
    }
    const etrangere = await ligne(autre)
    expect((await post(s, 'quantite', { ...ref(etrangere), quantite: 3 })).statusCode).toBe(403)
    expect((await repLue(etrangere.id)).qte).toBe(10)
  })

  it('RG-COO-239 deux écritures simultanées de la même version : une seule passe, l’autre 409', async () => {
    const s = await siteFixe()
    const r = await ligne(s, { qte: 10 })
    const [a, b] = await Promise.all([
      post(s, 'quantite', { ...ref(r), quantite: 11 }),
      post(s, 'quantite', { ...ref(r), quantite: 12 }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
  })

  it('RG-COO-239 idempotence : même clé → même réponse, une seule écriture ; atomicité : l’échec du journal annule tout', async () => {
    const s = await siteFixe()
    const r = await ligne(s, { qte: 10 })
    const cle = { 'idempotency-key': `u-${String(next())}` }
    const a = await post(s, 'quantite', { ...ref(r), quantite: 30 }, 'coord', cle)
    const b = await post(s, 'quantite', { ...ref(r), quantite: 30 }, 'coord', cle)
    expect(a.statusCode).toBe(200)
    expect(b.statusCode).toBe(200)
    expect((await repLue(r.id)).version).toBe(r.version + 1)
    const r2 = await ligne(s, { qte: 10 })
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(r2.id)}' AND NEW.action = 'MODIFICATION_QUANTITE_UNITE'`,
      () => post(s, 'quantite', { ...ref(r2), quantite: 77 }),
    )
    expect(echec.statusCode).toBe(500)
    expect((await repLue(r2.id)).qte).toBe(10)
  })
})

// ───────────────────────── RG-COO-244 : corriger l'intitulé ─────────────────────────

describe('RG-COO-244 corriger l’intitulé', () => {
  async function jeuIntitule(s: Site, o: { mail?: boolean } = {}) {
    if (o.mail)
      await db.plateforme.update({
        where: { id: s.plateforme.id },
        data: { mail: 'preprod@site.test' },
      })
    const contNum = numero()
    const a = await ligne(s, { contNum, theme: 'Thème ancien', annonceur: 'ANC', dest: 0 })
    const b = await ligne(s, { contNum, theme: 'THEME ANCIEN', annonceur: 'ANC', dest: 1 })
    const autreTheme = await ligne(s, { contNum, theme: 'Autre thème', annonceur: 'ANC' })
    const autreDossier = await ligne(s, { theme: 'Thème ancien', annonceur: 'ANC' })
    const ligneAttendue = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme: 'Thème ancien',
    })
    const affiche = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme: 'Thème ancien',
    })
    await f.createRattachement(db, {
      afficheId: affiche.id,
      ligneAttendueId: ligneAttendue.id,
      quantite: 5,
    })
    const orpheline = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme: 'Thème ancien',
      statut: 'ORPHELINE',
    })
    return { contNum, a, b, autreTheme, autreDossier, affiche, orpheline }
  }

  it('RG-COO-244 corrige toutes les unités du thème, pose « corrigé par la plateforme » et « Feuille à refaire » (RG-X-082)', async () => {
    const s = await siteFixe()
    const j = await jeuIntitule(s, { mail: true })
    const res = await post(s, 'corriger-intitule', {
      ...ref(j.a),
      annonceur: 'NOUVEAU ANN',
      theme: 'Nouveau thème',
      prevenirPreProd: true,
    })
    expect(res.statusCode, res.body).toBe(200)
    const body = ResultatUnitaireSchema.parse(res.json())
    expect(body.traitees).toBe(2)
    expect(body.mailStatut).toBe('NON_ENVOYE')
    for (const id of [j.a.id, j.b.id]) {
      const r = await repLue(id)
      expect([r.annonceur, r.theme, r.corrigeePlateforme]).toEqual([
        'NOUVEAU ANN',
        'Nouveau thème',
        true,
      ])
    }
    expect((await repLue(j.autreTheme.id)).theme).toBe('Autre thème')
    expect((await repLue(j.autreDossier.id)).theme).toBe('Thème ancien')
    expect(
      (await db.affiche.findUniqueOrThrow({ where: { id: j.affiche.id } })).feuilleARefaire,
    ).toBe(true)
    // RG-X-082 : une affiche non rattachée (orpheline) n'est pas touchée.
    expect(
      (await db.affiche.findUniqueOrThrow({ where: { id: j.orpheline.id } })).feuilleARefaire,
    ).toBe(false)
    const dossier = await db.journalAudit.findFirst({
      where: { typeEntite: 'DOSSIER', entiteId: String(j.contNum), action: 'CORRECTION_INTITULE' },
    })
    expect(dossier?.nouvelleValeur).toContain('Nouveau thème')
  })

  it('RG-COO-244 la Pré-Prod n’est prévenue que si la case est cochée ; sans adresse : « sans destinataire »', async () => {
    const s = await siteFixe()
    const j = await jeuIntitule(s)
    const sansMail = await post(s, 'corriger-intitule', {
      ...ref(j.a),
      annonceur: 'X1',
      theme: 'T1',
      prevenirPreProd: true,
    })
    expect(ResultatUnitaireSchema.parse(sansMail.json()).mailStatut).toBe('SANS_DESTINATAIRE')
    const j2 = await jeuIntitule(s)
    const decoche = await post(s, 'corriger-intitule', {
      ...ref(j2.a),
      annonceur: 'X2',
      theme: 'T2',
      prevenirPreProd: false,
    })
    expect(ResultatUnitaireSchema.parse(decoche.json()).mailStatut).toBeNull()
  })

  it('RG-COO-244 un thème ou un annonceur vide : 422 « Le thème et l’annonceur ne peuvent pas être vides. »', async () => {
    const s = await siteFixe()
    const j = await jeuIntitule(s)
    for (const [annonceur, theme] of [
      ['', 'T'],
      ['A', ''],
      ['  ', 'T'],
      ['A', '   '],
    ] as const) {
      const res = await post(s, 'corriger-intitule', { ...ref(j.a), annonceur, theme })
      expect(res.statusCode).toBe(422)
      expect(erreur(res).message).toBe('Le thème et l’annonceur ne peuvent pas être vides.')
      expect(erreur(res).regle).toBe('RG-COO-244')
    }
    expect((await repLue(j.a.id)).theme).toBe('Thème ancien')
  })

  it('RG-COO-244 aucun changement : 422 « Rien n’a changé. »', async () => {
    const s = await siteFixe()
    const j = await jeuIntitule(s)
    const res = await post(s, 'corriger-intitule', {
      ...ref(j.a),
      annonceur: ' ANC ',
      theme: 'Thème ancien ',
    })
    expect(res.statusCode).toBe(422)
    expect(erreur(res).message).toBe('Rien n’a changé.')
    expect((await repLue(j.a.id)).corrigeePlateforme).toBe(false)
  })

  it('RG-COO-244 production lancée : autorisée pour l’intitulé imprimé (exception à RG-COO-223), unités lancées comptées', async () => {
    const s = await siteFixe()
    const contNum = numero()
    const lancee = await ligne(s, { contNum, theme: 'Lancé', statut: 'PREPARE' })
    await ligne(s, { contNum, theme: 'Lancé', dest: 1 })
    const res = await post(s, 'corriger-intitule', {
      ...ref(lancee),
      annonceur: 'ANN',
      theme: 'Lancé corrigé',
    })
    expect(res.statusCode, res.body).toBe(200)
    const body = ResultatUnitaireSchema.parse(res.json())
    expect(body.enProduction).toBe(1)
    expect(body.traitees).toBe(2)
  })

  it('RG-COO-244 une ligne annulée : 409 ; version périmée : 409 ; autre site : 403 ; 6 rôles', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const annulee = await ligne(s, { statut: 'ANNULE' })
    expect(
      (await post(s, 'corriger-intitule', { ...ref(annulee), annonceur: 'A', theme: 'B' }))
        .statusCode,
    ).toBe(409)
    const r = await ligne(s)
    expect(
      (
        await post(s, 'corriger-intitule', {
          id: r.id,
          version: r.version + 3,
          annonceur: 'A',
          theme: 'B',
        })
      ).statusCode,
    ).toBe(409)
    const etrangere = await ligne(autre)
    expect(
      (await post(s, 'corriger-intitule', { ...ref(etrangere), annonceur: 'A', theme: 'B' }))
        .statusCode,
    ).toBe(403)
    for (const role of ROLES_SANS_ADMIN) {
      const x = await ligne(s)
      const res = await post(
        s,
        'corriger-intitule',
        { ...ref(x), annonceur: 'A', theme: `B${role}` },
        role,
      )
      expect(res.statusCode, role).toBe(role === 'coord' || role === 'cheq' ? 200 : 403)
    }
  })

  it('RG-COO-244 atomicité : l’échec du journal du dossier annule les unités et les affiches', async () => {
    const s = await siteFixe()
    const j = await jeuIntitule(s)
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(j.contNum)}' AND NEW.action = 'CORRECTION_INTITULE'`,
      () => post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 'Z', theme: 'Z' }),
    )
    expect(echec.statusCode).toBe(500)
    expect((await repLue(j.a.id)).theme).toBe('Thème ancien')
    expect(
      (await db.affiche.findUniqueOrThrow({ where: { id: j.affiche.id } })).feuilleARefaire,
    ).toBe(false)
  })
})

// ───────────────────────── RG-COO-243 : rendre la main ─────────────────────────

describe('RG-COO-243 rendre la main à la Pré-Prod', () => {
  it('RG-COO-243 les unités non lancées repassent « A traiter » avec le repère « main rendue » ; l’UM est supprimée', async () => {
    const s = await siteFixe()
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const { um, r } = await ligneAvecUm(s, { contNum: dossier.contNum })
    const sansUm = await ligne(s, { contNum: dossier.contNum, theme: 'Sans UM' })
    const res = await post(s, 'rendre-la-main', { lignes: [ref(r), ref(sansUm)] })
    expect(res.statusCode, res.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json())).toMatchObject({ traitees: 2, enProduction: 0 })
    const apres = await repLue(r.id)
    expect([apres.statut, apres.uniteId]).toEqual(['A_TRAITER', null])
    expect(apres.rendueLe).not.toBeNull()
    expect((await repLue(sansUm.id)).rendueLe).not.toBeNull()
    expect(await db.uniteManutention.findUnique({ where: { id: um.id } })).toBeNull()
    const rendu = await db.renduMain.findFirstOrThrow({ where: { atelierId: s.atelier.id } })
    expect(rendu.motif).toBe('Changement de visuel demandé par le client')
    expect(rendu.parId).toBe(s.users.coord.id)
    const histo = await db.statutHistorique.findFirst({
      where: { typeEntite: 'REPARTITION', entiteId: String(r.id), nouveau: 'A_TRAITER' },
    })
    expect(histo?.regle).toBe('RG-COO-243')
    expect(histo?.motif).toBe('Changement de visuel demandé par le client')
    const filtre = await lister(s, '?repere=RENDU')
    expect(filtre.lignes.flatMap((l) => l.refs.map((x) => x.id)).sort()).toEqual(
      [r.id, sansUm.id].sort(),
    )
    expect(filtre.lignes.every((l) => l.rendue)).toBe(true)
  })

  it('RG-COO-243 un motif saisi est enregistré ; les unités déjà en production ne sont pas retirées (point de non-retour)', async () => {
    const s = await siteFixe()
    const { r: libre } = await ligneAvecUm(s)
    const { um: umLancee, r: lancee } = await ligneAvecUm(s, {
      statut: 'PREPARE',
      umStatut: 'PREPARE',
    })
    const res = await post(s, 'rendre-la-main', {
      lignes: [ref(libre), ref(lancee)],
      motif: 'Visuel changé',
    })
    expect(res.statusCode, res.body).toBe(200)
    const body = ResultatUnitaireSchema.parse(res.json())
    expect(body).toMatchObject({ traitees: 1, enProduction: 1 })
    expect(body.message).toContain('déjà en production')
    expect((await repLue(lancee.id)).statut).toBe('PREPARE')
    expect(await db.uniteManutention.findUnique({ where: { id: umLancee.id } })).not.toBeNull()
    expect(
      (await db.renduMain.findFirstOrThrow({ where: { atelierId: s.atelier.id } })).motif,
    ).toBe('Visuel changé')
  })

  it('RG-COO-243 / 223 uniquement des unités en production : 422, rien n’est écrit', async () => {
    const s = await siteFixe()
    const { r } = await ligneAvecUm(s, { statut: 'PREPARE', umStatut: 'PREPARE' })
    const res = await post(s, 'rendre-la-main', { lignes: [ref(r)] })
    expect(res.statusCode).toBe(422)
    expect(erreur(res).code).toBe('COO_RIEN_A_RENDRE')
    expect(await db.renduMain.count({ where: { atelierId: s.atelier.id } })).toBe(0)
  })

  it('RG-COO-243 le dossier annulé reste annulé ; un dossier « A traiter » repasse « Préparation reçue »', async () => {
    const s = await siteFixe()
    const aTraiter = await f.createDossier(db, { statut: 'A_TRAITER' })
    const annule = await f.createDossier(db, { statut: 'ANNULE' })
    const r1 = await ligne(s, { contNum: aTraiter.contNum })
    const r2 = await ligne(s, { contNum: annule.contNum })
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r1), ref(r2)] })).statusCode).toBe(200)
    expect((await db.dossier.findUniqueOrThrow({ where: { id: aTraiter.id } })).statut).toBe(
      'PREPARATION_RECUE',
    )
    expect((await db.dossier.findUniqueOrThrow({ where: { id: annule.id } })).statut).toBe('ANNULE')
  })

  it('RG-X-081 / RG-X-059 rendre la main ne modifie ni la validation admin ni l’affiche reçue (HYPOTHÈSE Q-217)', async () => {
    const s = await siteFixe()
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const r = await ligne(s, { contNum: dossier.contNum, theme: 'Thème validé' })
    const attendue = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: dossier.contNum,
      theme: 'Thème validé',
    })
    const affiche = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: dossier.contNum,
      validationAdmin: true,
    })
    await f.createRattachement(db, {
      afficheId: affiche.id,
      ligneAttendueId: attendue.id,
      quantite: 5,
    })
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r)] })).statusCode).toBe(200)
    const apres = await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })
    expect([apres.validationAdmin, apres.version, apres.statut]).toEqual([
      true,
      affiche.version,
      'IDENTIFIEE',
    ])
    expect(
      (await db.afficheAttendue.findFirstOrThrow({ where: { afficheId: affiche.id } })).actif,
    ).toBe(true)
    expect((await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).statut).toBe(
      'PREPARATION_RECUE',
    )
  })

  it('RG-COO-243 une ligne annulée : 409 ; version périmée : 409 ; doublon : 400 ; autre site : 403', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const annulee = await ligne(s, { statut: 'ANNULE' })
    expect((await post(s, 'rendre-la-main', { lignes: [ref(annulee)] })).statusCode).toBe(409)
    const r = await ligne(s)
    expect(
      (await post(s, 'rendre-la-main', { lignes: [{ id: r.id, version: r.version + 2 }] }))
        .statusCode,
    ).toBe(409)
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r), ref(r)] })).statusCode).toBe(400)
    expect(
      (await post(s, 'rendre-la-main', { lignes: [ref(await ligne(autre))] })).statusCode,
    ).toBe(403)
    expect((await post(s, 'rendre-la-main', { lignes: [] })).statusCode).toBe(400)
  })

  it('RG-COO-243 / 165 la Coordination seule (le chef d’équipe, la réception, l’expédition, l’admin et le commerce : 403)', async () => {
    const s = await siteFixe()
    for (const role of ROLES_SANS_ADMIN) {
      const r = await ligne(s)
      const res = await post(s, 'rendre-la-main', { lignes: [ref(r)] }, role)
      expect(res.statusCode, role).toBe(role === 'coord' ? 200 : 403)
      if (role !== 'coord') expect((await repLue(r.id)).rendueLe).toBeNull()
    }
  })

  it('RG-COO-243 idempotence (même clé : un seul rendu) et atomicité (l’échec de l’historique annule tout)', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    const cle = { 'idempotency-key': `rm-${String(next())}` }
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r)] }, 'coord', cle)).statusCode).toBe(
      200,
    )
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r)] }, 'coord', cle)).statusCode).toBe(
      200,
    )
    expect(await db.renduMain.count({ where: { atelierId: s.atelier.id } })).toBe(1)
    const { um: um2, r: r2 } = await ligneAvecUm(s)
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON rendu_main WHEN NEW.dossiers LIKE '%${String(r2.contNum)}%'`,
      () => post(s, 'rendre-la-main', { lignes: [ref(r2)] }),
    )
    expect(echec.statusCode).toBe(500)
    expect((await repLue(r2.id)).statut).toBe('EN_COURS')
    expect(await db.uniteManutention.findUnique({ where: { id: um2.id } })).not.toBeNull()
    expect(um.id).not.toBe(um2.id)
  })
})

// ───────────────────────── RG-COO-249 / 250 : retirer, préparer ─────────────────────────

describe('RG-COO-249 retirer une préparation (UM)', () => {
  it('RG-COO-249 l’UM est supprimée et TOUTES ses répartitions repassent « A traiter » (UM_id nul), utilisateur tracé', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    const sœur = await ligne(s, { statut: 'EN_COURS', um })
    const res = await post(s, 'retirer', { lignes: [ref(r)] }, 'cheq')
    expect(res.statusCode, res.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json()).traitees).toBe(1)
    for (const id of [r.id, sœur.id]) {
      const apres = await repLue(id)
      expect([apres.statut, apres.uniteId]).toEqual(['A_TRAITER', null])
    }
    expect(await db.uniteManutention.findUnique({ where: { id: um.id } })).toBeNull()
    const histo = await db.statutHistorique.findFirst({
      where: { typeEntite: 'REPARTITION', entiteId: String(r.id), nouveau: 'A_TRAITER' },
    })
    expect(histo?.parId).toBe(s.users.cheq.id)
    expect(histo?.regle).toBe('RG-COO-249')
    const supp = await db.statutHistorique.findFirst({
      where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(um.id), nouveau: 'SUPPRIMEE' },
    })
    expect(supp?.parId).toBe(s.users.cheq.id)
  })

  it('RG-COO-249 une UM « Préparé », expédiée ou une ligne sans UM : 409 (transition interdite), rien n’est écrit', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s, { statut: 'PREPARE', umStatut: 'PREPARE' })
    const expediee = (await ligneAvecUm(s, { statut: 'A_EXPEDIER', umStatut: 'A_EXPEDIER' })).r
    const sansUm = await ligne(s)
    for (const x of [r, expediee, sansUm]) {
      const res = await post(s, 'retirer', { lignes: [ref(x)] })
      expect(res.statusCode).toBe(409)
      expect(erreur(res).code).toBe('TRANSITION_INTERDITE')
      expect(erreur(res).regle).toBe('RG-COO-249')
    }
    expect(await db.uniteManutention.findUnique({ where: { id: um.id } })).not.toBeNull()
  })

  it('RG-COO-249 une UM dont une répartition n’est plus « En cours » : 409 pour toute la sélection', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    await ligne(s, { statut: 'PREPARE', um })
    expect((await post(s, 'retirer', { lignes: [ref(r)] })).statusCode).toBe(409)
    expect((await repLue(r.id)).statut).toBe('EN_COURS')
  })

  it('RG-COO-249 version périmée : 409 ; doublon : 400 ; autre site : 403 ; inconnue : 404', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const { r } = await ligneAvecUm(s)
    expect(
      (await post(s, 'retirer', { lignes: [{ id: r.id, version: r.version + 1 }] })).statusCode,
    ).toBe(409)
    expect((await post(s, 'retirer', { lignes: [ref(r), ref(r)] })).statusCode).toBe(400)
    expect(
      (await post(s, 'retirer', { lignes: [ref((await ligneAvecUm(autre)).r)] })).statusCode,
    ).toBe(403)
    expect(
      (await post(s, 'retirer', { lignes: [{ id: 999_999_999, version: 1 }] })).statusCode,
    ).toBe(404)
  })

  it('RG-COO-249 / 165 la Coordination et le chef d’équipe seulement', async () => {
    const s = await siteFixe()
    for (const role of ROLES_SANS_ADMIN) {
      const { r } = await ligneAvecUm(s)
      const res = await post(s, 'retirer', { lignes: [ref(r)] }, role)
      expect(res.statusCode, role).toBe(role === 'coord' || role === 'cheq' ? 200 : 403)
    }
  })

  it('RG-COO-249 atomicité (l’échec de la suppression de l’UM annule les répartitions) et idempotence', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    const echec = await avecEchec(
      ctx,
      `BEFORE DELETE ON "tf_UM" WHEN OLD."UM_id" = ${String(um.id)}`,
      () => post(s, 'retirer', { lignes: [ref(r)] }),
    )
    expect(echec.statusCode).toBe(500)
    expect((await repLue(r.id)).statut).toBe('EN_COURS')
    const cle = { 'idempotency-key': `ret-${String(next())}` }
    expect((await post(s, 'retirer', { lignes: [ref(r)] }, 'coord', cle)).statusCode).toBe(200)
    expect((await post(s, 'retirer', { lignes: [ref(r)] }, 'coord', cle)).statusCode).toBe(200)
  })
})

describe('RG-COO-250 préparer une UM', () => {
  it('RG-COO-250 l’UM et ses répartitions « En cours » passent « Préparé » (historique, journal)', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    const sœur = await ligne(s, { statut: 'EN_COURS', um })
    const res = await post(s, 'preparer', { lignes: [ref(r)] }, 'cheq')
    expect(res.statusCode, res.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json()).traitees).toBe(1)
    for (const id of [r.id, sœur.id]) expect((await repLue(id)).statut).toBe('PREPARE')
    expect((await db.uniteManutention.findUniqueOrThrow({ where: { id: um.id } })).statut).toBe(
      'PREPARE',
    )
    const histo = await db.statutHistorique.findFirst({
      where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(um.id), nouveau: 'PREPARE' },
    })
    expect([histo?.ancien, histo?.regle, histo?.parId]).toEqual([
      'EN_COURS',
      'RG-COO-250',
      s.users.cheq.id,
    ])
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'UNITE_MANUTENTION',
          entiteId: String(um.id),
          action: 'PREPARATION_UNITE',
        },
      }),
    ).toBe(1)
  })

  it('RG-COO-250 une UM déjà préparée : rien n’est réécrit', async () => {
    const s = await siteFixe()
    const { r } = await ligneAvecUm(s, { statut: 'PREPARE', umStatut: 'PREPARE' })
    const res = await post(s, 'preparer', { lignes: [ref(r)] })
    expect(res.statusCode).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json())).toMatchObject({ traitees: 0 })
    expect((await repLue(r.id)).version).toBe(r.version)
  })

  it('RG-COO-250 (HYPOTHÈSE Q-271) UM annulée, à expédier, terminée ou ligne sans UM : 409', async () => {
    const s = await siteFixe()
    for (const um of ['ANNULE', 'A_EXPEDIER', 'TERMINE'] as const) {
      const { r } = await ligneAvecUm(s, { umStatut: um })
      const res = await post(s, 'preparer', { lignes: [ref(r)] })
      expect(res.statusCode, um).toBe(409)
      expect(erreur(res).regle).toBe('RG-COO-250')
    }
    const sansUm = await ligne(s)
    expect((await post(s, 'preparer', { lignes: [ref(sansUm)] })).statusCode).toBe(409)
  })

  it('RG-COO-250 la répartition « Préparé » interdit toute autre transition : table explicite (409)', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    expect((await post(s, 'preparer', { lignes: [ref(r)] })).statusCode).toBe(200)
    const apres = await repLue(r.id)
    // « Préparé » ne se retire plus (1 → 0 seulement).
    expect((await post(s, 'retirer', { lignes: [ref(apres)] })).statusCode).toBe(409)
    expect(await db.uniteManutention.findUnique({ where: { id: um.id } })).not.toBeNull()
  })

  it('RG-COO-250 version périmée : 409 ; autre site : 403 ; rôles : coord et cheq seulement ; atomicité', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const { r } = await ligneAvecUm(s)
    expect(
      (await post(s, 'preparer', { lignes: [{ id: r.id, version: r.version + 4 }] })).statusCode,
    ).toBe(409)
    expect(
      (await post(s, 'preparer', { lignes: [ref((await ligneAvecUm(autre)).r)] })).statusCode,
    ).toBe(403)
    for (const role of ROLES_SANS_ADMIN) {
      const x = (await ligneAvecUm(s)).r
      expect((await post(s, 'preparer', { lignes: [ref(x)] }, role)).statusCode, role).toBe(
        role === 'coord' || role === 'cheq' ? 200 : 403,
      )
    }
    const { um, r: r2 } = await ligneAvecUm(s)
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(um.id)}' AND NEW.action = 'PREPARATION_UNITE'`,
      () => post(s, 'preparer', { lignes: [ref(r2)] }),
    )
    expect(echec.statusCode).toBe(500)
    expect((await repLue(r2.id)).statut).toBe('EN_COURS')
    expect((await db.uniteManutention.findUniqueOrThrow({ where: { id: um.id } })).statut).toBe(
      'EN_COURS',
    )
  })
})

// ───────────────────────── RG-COO-247 : comptage du pliage ─────────────────────────

describe('RG-COO-247 pliage : saisir le comptage', () => {
  it('RG-COO-247 comptage conforme : « Comptage conforme. », les unités passent « Préparé » (Produit)', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const { um, r } = await ligneAvecUm(s, { type: 'typePliage', qte: 20 }) // entretien 2 → total 22
    const res = await post(s, 'comptage', { lignes: [ref(r)], comptees: 22 }, 'cheq')
    expect(res.statusCode, res.body).toBe(200)
    const body = ResultatUnitaireSchema.parse(res.json())
    expect(body.message).toBe('Comptage conforme.')
    expect(body.ecart).toBe(0)
    expect((await repLue(r.id)).statut).toBe('PREPARE')
    expect((await db.uniteManutention.findUniqueOrThrow({ where: { id: um.id } })).statut).toBe(
      'PREPARE',
    )
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(um.id), action: 'COMPTAGE_PLIAGE' },
      }),
    ).toBe(0)
  })

  it('RG-COO-247 écart : message « Écart de comptage : n affiche(s). Alerte qualité créée. » et alerte au journal', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const { um, r } = await ligneAvecUm(s, { type: 'typePliage', qte: 20 })
    const res = await post(s, 'comptage', { lignes: [ref(r)], comptees: 19 })
    expect(res.statusCode, res.body).toBe(200)
    const body = ResultatUnitaireSchema.parse(res.json())
    expect(body.message).toBe('Écart de comptage : 3 affiche(s). Alerte qualité créée.')
    expect(body.ecart).toBe(3)
    const alerte = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: String(um.id), action: 'COMPTAGE_PLIAGE' },
    })
    expect(alerte.parId).toBe(s.users.coord.id)
    expect(JSON.parse(alerte.donnees ?? '{}')).toMatchObject({
      attendu: 22,
      comptees: 19,
      ecart: 3,
    })
  })

  it('RG-COO-247 le comptage ne concerne que les lots de pliage : 409 pour le fixe et le bus', async () => {
    const s = await siteFixe()
    await typesParam(s)
    for (const type of ['typeFixe', 'typeBus'] as const) {
      const { r } = await ligneAvecUm(s, { type })
      const res = await post(s, 'comptage', { lignes: [ref(r)], comptees: 10 })
      expect(res.statusCode, type).toBe(409)
      expect(erreur(res).code).toBe('COO_PAS_PLIAGE')
      expect((await repLue(r.id)).statut).toBe('EN_COURS')
    }
  })

  it('RG-COO-247 comptage négatif ou non entier : 400 ; unité annulée ou sans UM : 409 ; version périmée : 409', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const { r } = await ligneAvecUm(s, { type: 'typePliage' })
    for (const comptees of [-1, 2.5, '3'])
      expect((await post(s, 'comptage', { lignes: [ref(r)], comptees })).statusCode).toBe(400)
    const sansUm = await ligne(s, { type: 'typePliage' })
    expect((await post(s, 'comptage', { lignes: [ref(sansUm)], comptees: 1 })).statusCode).toBe(409)
    const annulee = (await ligneAvecUm(s, { type: 'typePliage', umStatut: 'ANNULE' })).r
    expect((await post(s, 'comptage', { lignes: [ref(annulee)], comptees: 1 })).statusCode).toBe(
      409,
    )
    expect(
      (await post(s, 'comptage', { lignes: [{ id: r.id, version: r.version + 1 }], comptees: 1 }))
        .statusCode,
    ).toBe(409)
  })

  it('RG-COO-247 / 165 la Coordination et le chef d’équipe seulement ; autre site : 403 ; atomicité', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    await typesParam(s, autre)
    for (const role of ROLES_SANS_ADMIN) {
      const { r } = await ligneAvecUm(s, { type: 'typePliage', qte: 1 })
      expect(
        (await post(s, 'comptage', { lignes: [ref(r)], comptees: 1 }, role)).statusCode,
        role,
      ).toBe(role === 'coord' || role === 'cheq' ? 200 : 403)
    }
    const { r: etrangere } = await ligneAvecUm(autre, { type: 'typePliage' })
    expect((await post(s, 'comptage', { lignes: [ref(etrangere)], comptees: 1 })).statusCode).toBe(
      403,
    )
    const { um, r: r2 } = await ligneAvecUm(s, { type: 'typePliage', qte: 20 })
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(um.id)}' AND NEW.action = 'PREPARATION_UNITE'`,
      () => post(s, 'comptage', { lignes: [ref(r2)], comptees: 5 }),
    )
    expect(echec.statusCode).toBe(500)
    expect((await repLue(r2.id)).statut).toBe('EN_COURS')
  })
})

// ───────────────────────── RG-COO-246 : fiche de synthèse ─────────────────────────

describe('RG-COO-246 fiche de synthèse groupée par destinataire', () => {
  it('RG-COO-246 groupe par destinataire avec quantité, entretien et total ; totaux généraux', async () => {
    const s = await siteFixe()
    const contNum = numero()
    await ligne(s, { contNum, theme: 'Un', qte: 50, dest: 0 })
    await ligne(s, { contNum, theme: 'Deux', qte: 10, dest: 0 })
    await ligne(s, { contNum, theme: 'Trois', qte: 20, dest: 1, repiquage: 'REP' })
    const r = await get(
      ctx,
      `/api/coordination/unitaire/synthese?dossier=${String(contNum)}`,
      s.users.coord.headers,
    )
    expect(r.statusCode, r.body).toBe(200)
    const syn = SyntheseSchema.parse(r.json())
    expect(syn.groupes).toHaveLength(2)
    const a = syn.groupes.find((g) => g.destinataire === (s.dest[0].nom ?? s.dest[0].nomOrigine))
    expect([a?.qte, a?.entretien, a?.total]).toEqual([60, 5, 65]) // 4 + 1
    expect(a?.lignes.map((l) => l.theme).sort()).toEqual(['Deux', 'Un'])
    expect(syn.groupes[1]?.lignes[0]?.repiquage).toBe('REP')
    expect([syn.qte, syn.entretien, syn.total]).toEqual([80, 7, 87]) // 4 + 1 + 2
  })

  it('RG-COO-246 suit les filtres de l’écran ; un type sans ligne : synthèse vide ; 400 sur filtre invalide', async () => {
    const s = await siteFixe()
    await ligne(s, { annonceur: 'AAA' })
    await ligne(s, { annonceur: 'BBB' })
    const filtre = SyntheseSchema.parse(
      (
        await get(ctx, '/api/coordination/unitaire/synthese?annonceur=AAA', s.users.coord.headers)
      ).json(),
    )
    expect(filtre.groupes.flatMap((g) => g.lignes)).toHaveLength(1)
    const vide = SyntheseSchema.parse(
      (
        await get(ctx, '/api/coordination/unitaire/synthese?type=bus', s.users.coord.headers)
      ).json(),
    )
    expect(vide).toMatchObject({ groupes: [], total: 0 })
    expect(
      (await get(ctx, '/api/coordination/unitaire/synthese?depart=2026-W99', s.users.coord.headers))
        .statusCode,
    ).toBe(400)
  })

  it('RG-COO-246 / 165 consultation : Coordination et chef d’équipe ; autre site : liste vide', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    await ligne(autre)
    for (const role of ROLES_SANS_ADMIN) {
      const r = await get(ctx, '/api/coordination/unitaire/synthese', s.users[role].headers)
      expect(r.statusCode, role).toBe(role === 'coord' || role === 'cheq' ? 200 : 403)
    }
    const r = await get(ctx, '/api/coordination/unitaire/synthese', s.users.coord.headers)
    expect(SyntheseSchema.parse(r.json()).groupes).toHaveLength(0)
  })
})

// ───────────────────────── RG-COO-304 / 305 : Bus, quantités à encoller ─────────────────────────

describe('RG-COO-304 quantités à encoller (Bus)', () => {
  const encoller = (s: Site, qs: string, role: Role = 'coord') =>
    get(ctx, `/api/coordination/unitaire/encoller${qs}`, s.users[role].headers)

  it('RG-COO-304 calcul Broadcast (+8 % +20 %) par centre bus : commande × 1,28 arrondi', () => {
    expect(calculBroadcast(100)).toBe(128)
    expect(calculBroadcast(0)).toBe(0)
    expect(calculBroadcast(7)).toBe(9) // 8,96
    expect(quantiteAEncoller(128, 0, 0)).toBe(128)
    expect(quantiteAEncoller(128, 10, -5)).toBe(134) // +5 % : 134,4
    expect(quantiteAEncoller(100, -100, -50)).toBe(0) // plancher −100 %
  })

  it('RG-COO-305 / 304 les centres bus sont les destinataires des lignes bus de la semaine, quantités additionnées', async () => {
    const s = await siteFixe()
    await typesParam(s)
    await ligne(s, { type: 'typeBus', qte: 60, dest: 0 })
    await ligne(s, { type: 'typeBus', qte: 40, dest: 0, theme: 'Autre' })
    await ligne(s, { type: 'typeBus', qte: 10, dest: 1 })
    await ligne(s, { type: 'typeFixe', qte: 999, dest: 1 })
    await ligne(s, {
      type: 'typeBus',
      qte: 500,
      dest: 1,
      semaine: { annee: SEM.annee + 1, semaine: 1 },
    })
    await ligne(s, { type: 'typeBus', qte: 500, dest: 1, statut: 'ANNULE' })
    const r = await encoller(s, `?plateforme=${String(s.plateforme.id)}&depart=${DEPART}`)
    expect(r.statusCode, r.body).toBe(200)
    const e = EncollerSchema.parse(r.json())
    expect(e.version).toBe(0)
    expect(e.centres.map((c) => [c.commande, c.calculBroadcast, c.aEncoller]).sort()).toEqual(
      [
        [10, 13, 13],
        [100, 128, 128],
      ].sort(),
    )
    expect(e.total).toBe(141)
  })

  it('RG-COO-304 enregistre l’ajustement global et par centre (avec historique) puis les relit', async () => {
    const s = await siteFixe()
    await typesParam(s)
    await ligne(s, { type: 'typeBus', qte: 100, dest: 0 })
    const centre = s.dest[0].id
    const res = await post(s, 'encoller', {
      plateformeId: s.plateforme.id,
      depart: DEPART,
      ajustementGlobal: 10,
      centres: [{ destinataireId: centre, ajustement: -5 }],
      version: 0,
    })
    expect(res.statusCode, res.body).toBe(200)
    const e = EncollerSchema.parse(res.json())
    expect(e.version).toBe(1)
    expect(e.ajustementGlobal).toBe(10)
    expect(e.centres[0]).toMatchObject({ ajustement: -5, calculBroadcast: 128, aEncoller: 134 })
    const relu = EncollerSchema.parse(
      (await encoller(s, `?plateforme=${String(s.plateforme.id)}&depart=${DEPART}`)).json(),
    )
    expect(relu.centres[0]?.aEncoller).toBe(134)
    const journal = await db.journalAudit.findFirstOrThrow({
      where: { action: 'QUANTITES_ENCOLLER', entiteId: `${String(s.plateforme.id)}:${DEPART}` },
    })
    expect(journal.parId).toBe(s.users.coord.id)
    const maj = await post(s, 'encoller', {
      plateformeId: s.plateforme.id,
      depart: DEPART,
      ajustementGlobal: 0,
      centres: [],
      version: 1,
    })
    expect(EncollerSchema.parse(maj.json()).version).toBe(2)
  })

  it('RG-COO-304 version périmée : 409 ; première saisie avec une version non nulle : 409 ; bornes : 400', async () => {
    const s = await siteFixe()
    const corps = {
      plateformeId: s.plateforme.id,
      depart: DEPART,
      ajustementGlobal: 1,
      centres: [],
    }
    expect((await post(s, 'encoller', { ...corps, version: 3 })).statusCode).toBe(409)
    expect((await post(s, 'encoller', { ...corps, version: 0 })).statusCode).toBe(200)
    expect((await post(s, 'encoller', { ...corps, version: 0 })).statusCode).toBe(409)
    for (const invalide of [
      { ...corps, version: 1, ajustementGlobal: -101 },
      { ...corps, version: 1, ajustementGlobal: 1001 },
      { ...corps, version: 1, depart: '2026-W54' },
      { ...corps, version: 1, centres: [{ destinataireId: 1, ajustement: -500 }] },
    ])
      expect((await post(s, 'encoller', invalide)).statusCode).toBe(400)
  })

  it('RG-COO-304 / 167 / 165 un autre site : 403 ; consultation Coordination / chef d’équipe ; écriture idem ; 401', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    expect((await encoller(s, `?plateforme=${String(autre.plateforme.id)}`)).statusCode).toBe(403)
    expect(
      (
        await post(s, 'encoller', {
          plateformeId: autre.plateforme.id,
          depart: DEPART,
          ajustementGlobal: 0,
          centres: [],
          version: 0,
        })
      ).statusCode,
    ).toBe(403)
    for (const role of ROLES_SANS_ADMIN) {
      expect((await encoller(s, '', role)).statusCode, `GET ${role}`).toBe(
        role === 'coord' || role === 'cheq' ? 200 : 403,
      )
      const w = await post(
        s,
        'encoller',
        {
          plateformeId: s.plateforme.id,
          depart: DEPART,
          ajustementGlobal: 0,
          centres: [],
          version: 0,
        },
        role,
      )
      expect([200, 409, 403], `POST ${role}`).toContain(w.statusCode)
      if (role !== 'coord' && role !== 'cheq') expect(w.statusCode).toBe(403)
    }
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/api/coordination/unitaire/encoller' }))
        .statusCode,
    ).toBe(401)
  })

  it('RG-COO-304 atomicité : l’échec du journal annule l’enregistrement', async () => {
    const s = await siteFixe()
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'QUANTITES_ENCOLLER' AND NEW.entite_id = '${String(s.plateforme.id)}:${DEPART}'`,
      () =>
        post(s, 'encoller', {
          plateformeId: s.plateforme.id,
          depart: DEPART,
          ajustementGlobal: 5,
          centres: [],
          version: 0,
        }),
    )
    expect(echec.statusCode).toBe(500)
    expect(await db.encollageBus.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
  })
})

// ───────────────────────── RG-COO-124 : entretien repris de Broadcast ─────────────────────────

describe('RG-COO-124 quantités d’entretien réalignées selon le jour de la semaine', () => {
  const LUNDI = new Date('2026-11-09T10:00:00.000Z') // lundi : seuil = lundi + 14 j = 2026-11-23
  const JEUDI = new Date('2026-11-12T10:00:00.000Z')
  const VENDREDI = new Date('2026-11-13T10:00:00.000Z') // seuil = lundi + 21 j = 2026-11-30

  function groupe(contNum: number, quantiteEntretien: number | null, depart: string | null) {
    return {
      idGroupe: next(),
      idSiteCcf: 1,
      statutBroadcast: 133,
      details: [
        {
          idPreparationDetail: next() * 10,
          contNum,
          idTypePreparation: 1,
          supportId: null,
          destinataire: null,
          annonceur: 'A',
          theme: 'T',
          repiquage: null,
          repiquageId: null,
          quantite: 5,
          semaine: SEM,
          dateAffichage: null,
          numAfficheAmt: null,
          statutTravail: 0,
          quantiteEntretien,
          datePremierDepart: depart === null ? null : new Date(depart),
        },
      ],
    }
  }
  const realigner = (g: ReturnType<typeof groupe>, le: Date) =>
    db.$transaction((tx) => realignerEntretien(tx, g, le))
  async function repDe(s: Site, g: ReturnType<typeof groupe>, o: OptLigne = {}) {
    const d = g.details[0]
    return ligne(s, {
      ...o,
      contNum: d?.contNum ?? 0,
      extra: { idPreparationDetail: d?.idPreparationDetail, ...(o.extra ?? {}) },
    })
  }

  it('RG-COO-124 lundi à jeudi : la quantité des lignes dont le premier départ est ≥ lundi + 14 j est réalignée', async () => {
    const s = await siteFixe()
    for (const le of [LUNDI, JEUDI]) {
      const g = groupe(numero(), 7, '2026-11-23T00:00:00.000Z')
      const r = await repDe(s, g, { qte: 100, statut: 'EN_COURS' })
      expect(await realigner(g, le)).toBe(1)
      const apres = await repLue(r.id)
      expect(apres.qte).toBe(7)
      expect(apres.version).toBe(r.version + 1)
    }
  })

  it('RG-COO-124 lundi à jeudi : un départ avant lundi + 14 j, une quantité inchangée ou non fournie : aucune écriture', async () => {
    const s = await siteFixe()
    const tot = groupe(numero(), 7, '2026-11-22T23:59:59.000Z')
    const r1 = await repDe(s, tot, { qte: 100 })
    expect(await realigner(tot, LUNDI)).toBe(0)
    expect((await repLue(r1.id)).qte).toBe(100)
    const identique = groupe(numero(), 100, '2026-12-30T00:00:00.000Z')
    await repDe(s, identique, { qte: 100 })
    expect(await realigner(identique, LUNDI)).toBe(0)
    for (const g of [
      groupe(numero(), null, '2026-12-30T00:00:00.000Z'),
      groupe(numero(), 7, null),
    ]) {
      const r = await repDe(s, g, { qte: 100 })
      expect(await realigner(g, LUNDI)).toBe(0)
      expect((await repLue(r.id)).qte).toBe(100)
    }
  })

  it('RG-COO-124 seules les lignes « A traiter » / « En cours » sont réalignées ; une ligne « Préparé » ne bouge pas', async () => {
    const s = await siteFixe()
    const g = groupe(numero(), 7, '2026-12-30T00:00:00.000Z')
    const prepare = await repDe(s, g, { qte: 100, statut: 'PREPARE' })
    const annulee = await repDe(s, g, { qte: 100, statut: 'ANNULE' })
    const libre = await repDe(s, g, { qte: 100, statut: 'A_TRAITER' })
    expect(await realigner(g, LUNDI)).toBe(1)
    expect((await repLue(prepare.id)).qte).toBe(100)
    expect((await repLue(annulee.id)).qte).toBe(100)
    expect((await repLue(libre.id)).qte).toBe(7)
  })

  it('RG-COO-124 vendredi à dimanche : seulement les départs ≥ lundi + 21 j ET les lignes sans UM', async () => {
    const s = await siteFixe()
    const proche = groupe(numero(), 7, '2026-11-23T00:00:00.000Z') // ≥ +14 j mais < +21 j
    const rProche = await repDe(s, proche, { qte: 100 })
    expect(await realigner(proche, VENDREDI)).toBe(0)
    expect((await repLue(rProche.id)).qte).toBe(100)
    const loin = groupe(numero(), 7, '2026-11-30T00:00:00.000Z')
    const sansUm = await repDe(s, loin, { qte: 100 })
    const um = await f.createUniteManutention(db, { atelierId: s.atelier.id })
    const avecUm = await repDe(s, loin, { qte: 100, statut: 'EN_COURS', um })
    expect(await realigner(loin, VENDREDI)).toBe(1)
    expect((await repLue(sansUm.id)).qte).toBe(7)
    expect((await repLue(avecUm.id)).qte).toBe(100)
    // Le dimanche compte comme fin de semaine (lundi de la semaine en cours, pas du lendemain).
    const dimanche = groupe(numero(), 7, '2026-11-30T00:00:00.000Z')
    const r = await repDe(s, dimanche, { qte: 100 })
    expect(await realigner(dimanche, new Date('2026-11-15T10:00:00.000Z'))).toBe(1)
    expect((await repLue(r.id)).qte).toBe(7)
  })

  it('RG-COO-124 le réalignement est tracé au journal du groupe (automatique, sans utilisateur)', async () => {
    const s = await siteFixe()
    const g = groupe(numero(), 7, '2026-12-30T00:00:00.000Z')
    await repDe(s, g)
    await realigner(g, LUNDI)
    const trace = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: `groupe:${String(g.idGroupe)}`, action: 'INTEGRATION_GROUPE_PREPARATION' },
    })
    expect(trace.parId).toBeNull()
    expect(trace.nouvelleValeur).toContain('réalignée')
  })
})

describe('RG-COO-124 par le passage d’intégration réel (flux préparation)', () => {
  /** Passage réel (orchestration complète) avec un lot de préparation lu un lundi. */
  async function passerPrepa(
    depart: string,
    entretien: number | null,
    lueLe = '2026-11-09T10:00:00.000Z',
  ) {
    const idSiteCcf = 40_000 + next()
    const plateforme = await f.createPlateforme(db, { idSiteCcf })
    const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
    await parametre(ctx, 'integration.sitesPreparation', String(idSiteCcf))
    await parametre(ctx, 'integration.routageFixe', `${String(idSiteCcf)}:${String(atelier.id)}`)
    const contNum = 800_000 + next()
    const lot: LotIntegration = {
      idInterface: 1,
      lectureComplete: false,
      lueLe: new Date(lueLe),
      preparations: [
        {
          idGroupe: 90_000 + next(),
          idSiteCcf,
          statutBroadcast: 133,
          details: [
            {
              idPreparationDetail: 70_000 + next(),
              contNum,
              idTypePreparation: 1,
              supportId: null,
              destinataire: null,
              annonceur: 'ANN124',
              theme: 'Thème 124',
              repiquage: null,
              repiquageId: null,
              quantite: 100,
              semaine: SEM,
              dateAffichage: null,
              numAfficheAmt: null,
              statutTravail: 0,
              quantiteEntretien: entretien,
              datePremierDepart: new Date(depart),
            },
          ],
        },
      ],
    }
    const port: BroadcastPort = {
      nom: 'memoire',
      configure: true,
      lireLot: () => Promise.resolve(lot),
      envoyer: () => Promise.resolve(),
    }
    const passage = await lancerPassage(
      { db, broadcast: port },
      { declencheur: 'LOT', identity: null, lot },
    )
    expect(passage.statut).toBe('SUCCES')
    return db.repartition.findMany({ where: { contNum } })
  }

  it('RG-COO-124 un lundi, la quantité de la ligne intégrée est réalignée sur l’entretien de Broadcast (départ ≥ lundi + 14 j)', async () => {
    const [r] = await passerPrepa('2026-11-23T00:00:00.000Z', 7)
    expect(r?.qte).toBe(7)
  })

  it('RG-COO-124 un départ avant lundi + 14 j, ou sans entretien Broadcast : la quantité de la préparation est gardée', async () => {
    expect((await passerPrepa('2026-11-22T00:00:00.000Z', 7))[0]?.qte).toBe(100)
    expect((await passerPrepa('2026-12-30T00:00:00.000Z', null))[0]?.qte).toBe(100)
  })

  it('RG-COO-124 un vendredi, un départ à lundi + 14 j n’est pas réaligné (seuil lundi + 21 j)', async () => {
    expect(
      (await passerPrepa('2026-11-23T00:00:00.000Z', 7, '2026-11-13T10:00:00.000Z'))[0]?.qte,
    ).toBe(100)
    expect(
      (await passerPrepa('2026-11-30T00:00:00.000Z', 7, '2026-11-13T10:00:00.000Z'))[0]?.qte,
    ).toBe(7)
  })
})
