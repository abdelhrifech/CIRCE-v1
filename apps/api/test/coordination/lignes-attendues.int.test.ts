// COO-P05 — lignes attendues : règles de vie (RG-COO-080 à 090, 094 à 097), cas multi (098 à 101), état des
// réservations vivant (RG-COO-107 / 108, ECR-PIL-03) et suivi de production (RG-COO-105 / 106).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FicheAfficheSchema,
  ReservationsSchema,
  SuiviProductionSchema,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type SemaineIso,
} from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import {
  alertesAlimentation,
  alimenterDepuisBroadcast,
  alimenterDepuisPreparation,
  dedoublonnerLignes,
  lignesPrepaDepuisProduction,
  type LigneLueBroadcast,
} from '../../src/modules/coordination/alimentation-lignes.ts'
import { alertesValidation } from '../../src/modules/coordination/effets-validation.ts'
import { integrerPreparation } from '../../src/modules/coordination/integration.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
  post,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const S = semaineIsoDe(new Date())
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const maintenant = () => new Date()

/** Plateforme gérée par Broadcast (site CCF), support avec correspondance surface × format. */
async function site() {
  const idSiteCcf = 10_000 + next()
  const plateforme = await f.createPlateforme(db, { idSiteCcf })
  const support = await f.createSupport(db)
  const idSurface = 500 + next()
  const idFormat = 900 + next()
  await db.correspondanceSupport.create({ data: { idSurface, idFormat, supportId: support.id } })
  const contNum = 700_000 + next()
  const coord = await f.createUtilisateurAvecRoles(db, ['coord'], [{ plateformeId: plateforme.id }])
  const recep = await f.createUtilisateurAvecRoles(db, ['recep'], [{ plateformeId: plateforme.id }])
  return {
    plateforme,
    support,
    idSiteCcf,
    idSurface,
    idFormat,
    contNum,
    coord: devHeaders(coord.identifiantExterne),
    recep: devHeaders(recep.identifiantExterne),
  }
}
type Site = Awaited<ReturnType<typeof site>>

function lue(s: Site, p: Partial<LigneLueBroadcast> = {}): LigneLueBroadcast {
  return {
    idSiteCcf: s.idSiteCcf,
    destinataire: 'Wissous',
    contNum: s.contNum,
    annonceur: 'ANNONCEUR P05',
    idSurface: s.idSurface,
    idFormat: s.idFormat,
    idTheme: null,
    theme: 'Thème A',
    idThemeBandeau: null,
    idDaChapeau: null,
    semaine: plus(S, 1),
    quantite: 100,
    estResteEnPlace: false,
    statutPreparation: null,
    ...p,
  }
}

const lire = (lignes: LigneLueBroadcast[], lueLe = maintenant()) =>
  withTransaction(db, (tx) => alimenterDepuisBroadcast(tx, { lueLe, lignes }))
const lignesDe = (contNum: number) =>
  db.receptionAttendue.findMany({ where: { contNum }, orderBy: { id: 'asc' } })
const actives = async (contNum: number) =>
  (await lignesDe(contNum)).filter((l) => l.etatLigne === 'ACTIVE')

/** Réception (REC-P04) d'une affiche sur une ligne existante ; `intitule` pour une ligne sans IP. */
async function recevoir(s: Site, ligneAttendueId: number, quantite = 10, intitule?: string) {
  const bl = await bonDeLivraison(ctx, s.recep, [
    { ligneAttendueId, quantite, ...(intitule ? { intituleSaisi: intitule } : {}) },
  ])
  const r = await post(ctx, '/api/receptions', s.recep, bl)
  expect(r.statusCode, r.body).toBe(201)
  const id = r.json<{ affiches: { id: number }[] }>().affiches[0]?.id
  if (id === undefined) throw new Error('aucune affiche')
  return id
}

describe('RG-COO-080 / 082 — ligne Broadcast créée puis mise à jour, une seule ligne active par clé', () => {
  it('RG-COO-082 crée la ligne BC (qte_bc, date vue) puis la met à jour à la lecture suivante', async () => {
    const s = await site()
    const r1 = await lire([lue(s)])
    expect(r1.creees).toBe(1)
    let [l] = await actives(s.contNum)
    expect(l).toMatchObject({ source: 'BC', qteBc: 100, theme: 'Thème A', provisoire: false })
    expect(l?.dateVueBc).not.toBeNull()
    await lire([lue(s, { quantite: 120 })])
    ;[l] = await actives(s.contNum)
    expect(l?.qteBc).toBe(120)
    expect(await actives(s.contNum)).toHaveLength(1)
  })

  it('RG-COO-080 deux lectures identiques ⇒ aucune ligne en plus, quantités inchangées', async () => {
    const s = await site()
    await lire([lue(s)])
    const r2 = await lire([lue(s)])
    expect(r2.creees).toBe(0)
    expect(r2.misesAJour).toBe(1)
    const ls = await lignesDe(s.contNum)
    expect(ls).toHaveLength(1)
    expect(ls[0]?.qteBc).toBe(100)
  })

  it('RG-COO-080 deux DA du même dossier ⇒ une ligne, quantités additionnées (DA hors clé)', async () => {
    const s = await site()
    await lire([lue(s, { idDaChapeau: 1, quantite: 60 }), lue(s, { idDaChapeau: 2, quantite: 40 })])
    const ls = await actives(s.contNum)
    expect(ls).toHaveLength(1)
    expect(ls[0]?.qteBc).toBe(100)
  })

  it('RG-COO-080 rejet du doublon : une ligne de même clé déjà présente est mise à jour, jamais dupliquée', async () => {
    const s = await site()
    const existante = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      theme: 'thème a',
      themeCle: 'THEME A',
      semAnnee: plus(S, 1).annee,
      semNum: plus(S, 1).semaine,
      qteBc: 5,
    })
    await lire([lue(s, { theme: 'THÈME  A' })])
    const ls = await actives(s.contNum)
    expect(ls.map((l) => l.id)).toEqual([existante.id])
    expect(ls[0]?.qteBc).toBe(100)
  })

  it('RG-COO-082 « reste en place » retiré de la quantité de la ligne (Q-209)', async () => {
    const s = await site()
    await lire([lue(s, { quantite: 80 }), lue(s, { quantite: 20, estResteEnPlace: true })])
    expect((await actives(s.contNum))[0]?.qteBc).toBe(80)
  })
})

describe('RG-COO-081 — rapprochement par identifiants, jamais par texte', () => {
  it('RG-COO-081 site inconnu ⇒ ligne écartée avec alerte, les autres lignes sont traitées', async () => {
    const s = await site()
    const r = await lire([lue(s, { idSiteCcf: 999_999_999, contNum: s.contNum + 1 }), lue(s)])
    expect(r.ecartees).toBe(1)
    expect(r.alertes.map((a) => a.type)).toContain('DONNEE_REFERENCE_MANQUANTE')
    expect(await actives(s.contNum)).toHaveLength(1)
    expect(await lignesDe(s.contNum + 1)).toHaveLength(0)
    const journal = await db.journalAudit.findFirst({
      where: { action: 'DONNEE_REFERENCE_MANQUANTE', donnees: { contains: String(s.contNum + 1) } },
    })
    expect(journal).not.toBeNull()
  })

  it('RG-COO-081 surface × format sans support ⇒ écartée avec alerte (jamais sup_id = 0)', async () => {
    const s = await site()
    const r = await lire([lue(s, { idFormat: 1 })])
    expect(r.ecartees).toBe(1)
    expect(r.alertes[0]).toMatchObject({ type: 'DONNEE_REFERENCE_MANQUANTE', regle: 'RG-COO-081' })
    expect(await lignesDe(s.contNum)).toHaveLength(0)
  })

  it('RG-COO-081 plusieurs plateformes pour un site ⇒ ligne écartée, pas de choix au hasard', async () => {
    const s = await site()
    await f.createPlateforme(db, { idSiteCcf: s.idSiteCcf })
    const r = await lire([lue(s)])
    expect(r.ecartees).toBe(1)
    expect(await lignesDe(s.contNum)).toHaveLength(0)
  })

  it('RG-COO-081 thème sans n° ⇒ rapproché au texte normalisé, avec alerte', async () => {
    const s = await site()
    await lire([lue(s, { theme: 'Été Plage' })])
    const r = await lire([lue(s, { theme: 'ETE  plage' })])
    expect(r.alertes.some((a) => a.type === 'THEME_SANS_NUMERO')).toBe(true)
    expect(await actives(s.contNum)).toHaveLength(1)
  })

  it('RG-COO-081 n° de thème fourni : un thème renommé dans Broadcast met à jour la même ligne', async () => {
    const s = await site()
    await lire([lue(s, { idTheme: 55, theme: 'Ancien intitulé' })])
    const r = await lire([lue(s, { idTheme: 55, theme: 'Nouvel intitulé' })])
    expect(r.alertes.some((a) => a.type === 'THEME_SANS_NUMERO')).toBe(false)
    const ls = await actives(s.contNum)
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({
      theme: 'Nouvel intitulé',
      themeCle: 'NOUVEL INTITULE',
      idTheme: 55,
    })
  })
})

describe('RG-COO-083 / 093 — fenêtre et exclusions', () => {
  it('RG-COO-083 une ligne hors de la fenêtre S → S+8 n’est pas alimentée', async () => {
    const s = await site()
    const r = await lire([lue(s, { semaine: plus(S, 9) }), lue(s, { semaine: plus(S, -1) })])
    expect(r.exclues).toBe(2)
    expect(await lignesDe(s.contNum)).toHaveLength(0)
  })

  it('RG-COO-083 S+8 est encore dans la fenêtre', async () => {
    const s = await site()
    await lire([lue(s, { semaine: plus(S, 8) })])
    expect(await actives(s.contNum)).toHaveLength(1)
  })

  it('RG-COO-093 statut de préparation « Envoyé » et destinataire Derichebourg exclus, sans alerte', async () => {
    const s = await site()
    const r = await lire([
      lue(s, { statutPreparation: 'Envoyé' }),
      lue(s, { contNum: s.contNum + 1, destinataire: 'Plateforme Derichebourg Lyon' }),
    ])
    expect(r.exclues).toBe(2)
    expect(r.alertes).toHaveLength(0)
    expect(await lignesDe(s.contNum)).toHaveLength(0)
    expect(await lignesDe(s.contNum + 1)).toHaveLength(0)
  })

  it('RG-COO-093 rejet de la fermeture : une ligne BC d’un dossier passé « Envoyé » n’est pas « disparue »', async () => {
    const s = await site()
    const autre = lue(s, { contNum: s.contNum + 7 })
    await lire([lue(s), autre])
    await lire([lue(s, { statutPreparation: 'Envoyé' }), autre])
    await lire([lue(s, { statutPreparation: 'Envoyé' }), autre])
    const [l] = await lignesDe(s.contNum)
    expect(l).toMatchObject({ etatLigne: 'ACTIVE', nonVueLe: null })
  })
})

describe('RG-COO-084 / 085 — visuel provisoire avant les IP, fermeture à la saisie des IP', () => {
  it('RG-COO-084 sans thème ⇒ une seule ligne provisoire par plateforme × dossier × support × semaine', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, quantite: 30 }), lue(s, { theme: '  ', quantite: 20 })])
    const ls = await actives(s.contNum)
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({ provisoire: true, theme: null, qteBc: 50, source: 'BC' })
  })

  it('RG-COO-084 réception sur la ligne provisoire ⇒ motif de doute SANS_IP', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const [l] = await actives(s.contNum)
    if (!l) throw new Error('ligne')
    const afficheId = await recevoir(s, l.id, 10, 'Intitulé lu sur l’affiche')
    const fiche = FicheAfficheSchema.parse(
      (await get(ctx, `/api/affiches/${String(afficheId)}`, s.recep)).json(),
    )
    expect(fiche.validation.motifs).toContain('SANS_IP')
  })

  it('RG-COO-085 IP saisies, un seul thème ⇒ provisoire fermée, affiche déplacée seule (lien retiré puis recréé)', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const [p] = await actives(s.contNum)
    if (!p) throw new Error('ligne')
    const afficheId = await recevoir(s, p.id, 10, 'Thème lu')
    const r = await lire([lue(s, { theme: 'Thème des IP', semaine: S })])
    expect(r.provisoiresFermees).toBe(1)
    expect(r.liensDeplaces).toBe(1)
    const fermee = await db.receptionAttendue.findUniqueOrThrow({ where: { id: p.id } })
    expect(fermee.etatLigne).toBe('ANNULEE')
    expect(fermee.fermeeLe).not.toBeNull()
    const [cible] = await actives(s.contNum)
    expect(cible).toMatchObject({ theme: 'Thème des IP', statut: 'PARTIELLE' })
    const liens = await db.afficheAttendue.findMany({
      where: { afficheId },
      orderBy: { id: 'asc' },
    })
    expect(liens.map((x) => [x.ligneAttendueId, x.actif, x.quantite])).toEqual([
      [p.id, false, 10],
      [cible?.id, true, 10],
    ])
    expect(liens[0]?.retireLe).not.toBeNull()
    const trace = await db.journalAudit.findFirst({
      where: { entiteId: String(afficheId), action: 'DEPLACEMENT_RATTACHEMENT' },
    })
    expect(trace?.complement).toContain('RG-COO-085')
  })

  it('RG-COO-085 plusieurs thèmes : le thème lu sur le BL désigne la cible', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const [p] = await actives(s.contNum)
    if (!p) throw new Error('ligne')
    const afficheId = await recevoir(s, p.id, 10, 'thème b')
    await lire([lue(s, { theme: 'Thème A', semaine: S }), lue(s, { theme: 'Thème B', semaine: S })])
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    const cible = await db.receptionAttendue.findUniqueOrThrow({
      where: { id: lien.ligneAttendueId },
    })
    expect(cible.theme).toBe('Thème B')
  })

  it('RG-COO-085 rejet du déplacement : plusieurs thèmes sans désignation ⇒ lien conservé sur la ligne fermée, alerte', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const [p] = await actives(s.contNum)
    if (!p) throw new Error('ligne')
    const afficheId = await recevoir(s, p.id, 10, 'Autre chose')
    const r = await lire([
      lue(s, { theme: 'Thème A', semaine: S }),
      lue(s, { theme: 'Thème B', semaine: S }),
    ])
    expect(r.liensDeplaces).toBe(0)
    expect(r.alertes.map((a) => a.type)).toEqual(
      expect.arrayContaining(['AUCUN_CANDIDAT_THEME', 'LIGNE_ANNULEE']),
    )
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    expect(lien.ligneAttendueId).toBe(p.id)
    const alertes = await alertesValidation(db, [s.plateforme.id])
    expect(alertes.some((a) => a.afficheId === afficheId && a.type === 'LIGNE_ANNULEE')).toBe(true)
    const fiche = FicheAfficheSchema.parse(
      (await get(ctx, `/api/affiches/${String(afficheId)}`, s.recep)).json(),
    )
    expect(fiche.validation.motifs).toContain('LIGNE_FERMEE')
  })

  it('RG-COO-085 affiche validée déplacée : la validation est conservée (aucun doute de thème)', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const [p] = await actives(s.contNum)
    if (!p) throw new Error('ligne')
    const afficheId = await recevoir(s, p.id, 10, 'Thème lu')
    await db.affiche.update({ where: { id: afficheId }, data: { validationAdmin: true } })
    await lire([lue(s, { theme: 'Thème unique', semaine: S })])
    const a = await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
    expect(a.validationAdmin).toBe(true)
    expect(a.feuilleARefaire).toBe(true)
  })
})

describe('RG-COO-086 / 094 / 095 — arrivée de la prépa', () => {
  async function prepa(
    s: Site,
    atelierId: number,
    p: Partial<Parameters<typeof alimenterDepuisPreparation>[1][number]> = {},
  ) {
    return withTransaction(db, (tx) =>
      alimenterDepuisPreparation(tx, [
        {
          plateformeId: s.plateforme.id,
          contNum: s.contNum,
          supportId: s.support.id,
          theme: 'Thème A',
          idThemeBandeau: null,
          atelierId,
          annonceur: 'ANNONCEUR P05',
          semaine: S,
          quantite: 90,
          ...p,
        },
      ]),
    )
  }

  it('RG-COO-086 la ligne BC bascule en PREPA avec qte_prepa ; l’affiche rattachée reste rattachée ; écart signalé', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await lire([lue(s, { semaine: S })])
    const [l] = await actives(s.contNum)
    if (!l) throw new Error('ligne')
    const afficheId = await recevoir(s, l.id, 10)
    const r = await prepa(s, atelier.id)
    expect(r.creees).toBe(0)
    expect(r.alertes.map((a) => a.type)).toContain('ECART_DA_PREPA')
    const apres = await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })
    expect(apres).toMatchObject({
      source: 'PREPA',
      qtePrepa: 90,
      qteBc: 100,
      atelierId: atelier.id,
    })
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    expect(lien.ligneAttendueId).toBe(l.id)
    const trace = await db.journalAudit.findFirst({
      where: { entiteId: String(l.id), action: 'ALIMENTATION_LIGNE', nouvelleValeur: 'PREPA' },
    })
    expect(trace).not.toBeNull()
  })

  it('RG-COO-086 sans écart DA / prépa : pas d’alerte ; clé absente : une ligne PREPA est créée', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await lire([lue(s, { semaine: S, quantite: 90 })])
    const r = await prepa(s, atelier.id)
    expect(r.alertes).toHaveLength(0)
    const r2 = await prepa(s, atelier.id, { theme: 'Thème nouveau' })
    expect(r2.creees).toBe(1)
    const nouvelle = (await actives(s.contNum)).find((x) => x.theme === 'Thème nouveau')
    expect(nouvelle).toMatchObject({ source: 'PREPA', qtePrepa: 90, qteBc: null })
  })

  it('RG-COO-082 / 086 rejet : après la bascule, une lecture Broadcast ne modifie pas qte_prepa', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await lire([lue(s, { semaine: S })])
    await prepa(s, atelier.id)
    await lire([lue(s, { semaine: S, quantite: 150 })])
    const [l] = await actives(s.contNum)
    expect(l).toMatchObject({ source: 'PREPA', qtePrepa: 90, qteBc: 150 })
  })

  it('RG-COO-094 / 095 sources : répartitions (Σ qte), faces (nombre), bandeau ; statut ANNULE exclu', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const bandeau = await f.createSupport(db)
    const param = await db.parametre.findFirstOrThrow({
      where: { cle: 'coordination.supportsBandeau', plateformeId: null },
    })
    await db.parametre.update({
      where: { id: param.id },
      data: { valeur: `${String(s.support.id)}:${String(bandeau.id)}` },
    })
    try {
      const base = {
        contNum: s.contNum,
        supportId: s.support.id,
        atelierId: atelier.id,
        semAnnee: S.annee,
        semNum: S.semaine,
        theme: 'Thème A',
      }
      await f.createRepartition(db, { ...base, qte: 30, repiquage: 'Bandeau X', repiquageId: 9 })
      await f.createRepartition(db, { ...base, qte: 20 })
      await f.createRepartition(db, { ...base, qte: 500, statut: 'ANNULE' })
      const instr = await f.createInstruction(db, { contNum: s.contNum })
      const depart = new Date(Date.now() + 3 * 86_400_000)
      const sd = semaineIsoDe(depart)
      for (let i = 0; i < 3; i++)
        await f.createFaceTrain(db, {
          instructionCode: instr.code,
          contNum: s.contNum,
          supportId: s.support.id,
          atelierId: atelier.id,
          theme: 'Thème T',
          depAnbas: sd.annee,
          depSembas: sd.semaine,
          dateDepart: depart,
        })
      await f.createFaceTrain(db, {
        instructionCode: instr.code,
        contNum: s.contNum,
        supportId: s.support.id,
        atelierId: atelier.id,
        theme: null,
        depAnbas: sd.annee,
        depSembas: sd.semaine,
        dateDepart: depart,
      })
      const r = await withTransaction(db, async (tx) =>
        alimenterDepuisPreparation(
          tx,
          await lignesPrepaDepuisProduction(tx, maintenant(), [s.contNum]),
        ),
      )
      expect(r.creees).toBe(3)
      const ls = await actives(s.contNum)
      const par = (t: string) => ls.find((l) => l.theme === t)
      expect(par('Thème A')).toMatchObject({ qtePrepa: 50, source: 'PREPA', atelierId: atelier.id })
      expect(par('Thème T')).toMatchObject({ qtePrepa: 3, source: 'PREPA' })
      expect(par('Bandeau X')).toMatchObject({
        qtePrepa: 30,
        supportId: bandeau.id,
        idThemeBandeau: 9,
        atelierId: atelier.id,
      })
    } finally {
      await db.parametre.update({ where: { id: param.id }, data: { valeur: param.valeur } })
    }
  })
})

describe('RG-COO-087 / 089 / 091 — disparition, fermeture, jamais de suppression', () => {
  it('RG-COO-087 ligne plus vue : marquée à la 1re lecture, fermée (ANNULEE + date, historique) à la suivante', async () => {
    const s = await site()
    const autre = lue(s, { contNum: s.contNum + 3 })
    await lire([lue(s), autre])
    const r1 = await lire([autre])
    expect(r1.nonVues).toBeGreaterThanOrEqual(1)
    let [l] = await lignesDe(s.contNum)
    expect(l?.etatLigne).toBe('ACTIVE')
    expect(l?.nonVueLe).not.toBeNull()
    const r2 = await lire([autre])
    expect(r2.fermees).toBeGreaterThanOrEqual(1)
    ;[l] = await lignesDe(s.contNum)
    expect(l).toMatchObject({ etatLigne: 'ANNULEE' })
    expect(l?.fermeeLe).not.toBeNull()
    const h = await db.statutHistorique.findFirst({
      where: { typeEntite: 'LIGNE_ATTENDUE', entiteId: String(l?.id), nouveau: 'ANNULEE' },
    })
    expect(h?.regle).toBe('RG-COO-087')
  })

  it('RG-COO-087 rejet : une absence unique ne ferme pas ; revue, la ligne repart de zéro', async () => {
    const s = await site()
    const autre = lue(s, { contNum: s.contNum + 3 })
    await lire([lue(s), autre])
    await lire([autre])
    await lire([lue(s), autre])
    await lire([autre])
    const [l] = await lignesDe(s.contNum)
    expect(l?.etatLigne).toBe('ACTIVE')
  })

  it('RG-COO-087 / 032 ligne fermée portant une affiche ⇒ alerte, lien conservé', async () => {
    const s = await site()
    const autre = lue(s, { contNum: s.contNum + 3, semaine: S })
    await lire([lue(s, { semaine: S }), autre])
    const [l] = await actives(s.contNum)
    if (!l) throw new Error('ligne')
    const afficheId = await recevoir(s, l.id, 10)
    await lire([autre])
    const r = await lire([autre])
    expect(r.alertes.some((a) => a.type === 'LIGNE_ANNULEE' && a.afficheId === afficheId)).toBe(
      true,
    )
    expect(await db.afficheAttendue.count({ where: { afficheId, actif: true } })).toBe(1)
  })

  it('RG-COO-091 lecture vide ⇒ rien n’est écrit (aucune ligne marquée « non vue »)', async () => {
    const s = await site()
    await lire([lue(s)])
    const r = await lire([])
    expect(r).toMatchObject({ lues: 0, nonVues: 0, fermees: 0 })
    const [l] = await lignesDe(s.contNum)
    expect(l?.nonVueLe).toBeNull()
  })

  it('RG-COO-087 une ligne d’une plateforme non gérée par Broadcast n’est jamais fermée par la lecture', async () => {
    const s = await site()
    const horsBroadcast = await f.createReceptionAttendue(db, {
      semAnnee: S.annee,
      semNum: S.semaine,
    })
    await lire([lue(s)])
    await lire([lue(s)])
    const l = await db.receptionAttendue.findUniqueOrThrow({ where: { id: horsBroadcast.id } })
    expect(l).toMatchObject({ etatLigne: 'ACTIVE', nonVueLe: null })
  })

  it('RG-COO-089 suppression directe refusée (409) ; la ligne reste en base', async () => {
    const s = await site()
    await lire([lue(s)])
    const [l] = await lignesDe(s.contNum)
    const r = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/coordination/lignes-attendues/${String(l?.id)}`,
      headers: s.coord,
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-089' })
    expect(await db.receptionAttendue.count({ where: { id: l?.id } })).toBe(1)
  })

  it('RG-COO-089 suppression : 404 ligne inconnue, 403 hors périmètre', async () => {
    const s = await site()
    const autreSite = await site()
    await lire([lue(autreSite)])
    const [l] = await lignesDe(autreSite.contNum)
    const del = (id: number) =>
      ctx.app.inject({
        method: 'DELETE',
        url: `/api/coordination/lignes-attendues/${String(id)}`,
        headers: s.coord,
      })
    expect((await del(999_999_999)).statusCode).toBe(404)
    expect((await del(l?.id ?? 0)).statusCode).toBe(403)
  })

  it('RG-COO-089 aucun code applicatif ne supprime une ligne attendue', () => {
    const racine = resolve(import.meta.dirname, '../../src/modules')
    const fichiers: string[] = []
    const parcourir = (d: string) => {
      for (const e of readdirSync(d)) {
        const p = resolve(d, e)
        if (statSync(p).isDirectory()) parcourir(p)
        else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) fichiers.push(p)
      }
    }
    parcourir(racine)
    for (const p of fichiers)
      expect(readFileSync(p, 'utf8'), p).not.toMatch(/receptionAttendue\.delete(Many)?\(/)
  })
})

describe('RG-COO-090 / 096 / 097 — reprise, DA chapeau, reçu calculé', () => {
  it('RG-COO-090 doublons de clé (thème normalisé) : la ligne qui porte l’affiche est gardée, liens reportés, autres fermées', async () => {
    const s = await site()
    const base = {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: S.annee,
      semNum: S.semaine,
    }
    const sansAffiche = await f.createReceptionAttendue(db, {
      ...base,
      theme: 'THÈME a',
      themeCle: 'x-legacy',
    })
    const avecAffiche = await f.createReceptionAttendue(db, {
      ...base,
      theme: 'Thème A',
      themeCle: 'y-legacy',
    })
    const troisieme = await f.createReceptionAttendue(db, {
      ...base,
      theme: 'theme a',
      themeCle: null,
    })
    const afficheId = await recevoir(s, avecAffiche.id, 4)
    await f.createRattachement(db, {
      afficheId: (await f.createAffiche(db, { plateformeId: s.plateforme.id })).id,
      ligneAttendueId: sansAffiche.id,
      quantite: 2,
    })
    const r = await withTransaction(db, (tx) => dedoublonnerLignes(tx))
    expect(r.fermees).toBeGreaterThanOrEqual(2)
    const gardee = await db.receptionAttendue.findUniqueOrThrow({ where: { id: avecAffiche.id } })
    expect(gardee).toMatchObject({ etatLigne: 'ACTIVE', themeCle: 'THEME A' })
    for (const id of [sansAffiche.id, troisieme.id])
      expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id } })).etatLigne).toBe(
        'ANNULEE',
      )
    expect(
      await db.afficheAttendue.count({ where: { ligneAttendueId: avecAffiche.id, actif: true } }),
    ).toBe(2)
    expect(await db.afficheAttendue.count({ where: { afficheId, actif: true } })).toBe(1)
  })

  it('RG-COO-090 rejet : sans doublon, aucune ligne n’est fermée', async () => {
    const s = await site()
    await lire([lue(s)])
    const avant = await db.receptionAttendue.count({
      where: { etatLigne: 'ANNULEE', contNum: s.contNum },
    })
    await withTransaction(db, (tx) => dedoublonnerLignes(tx))
    expect(
      await db.receptionAttendue.count({ where: { etatLigne: 'ANNULEE', contNum: s.contNum } }),
    ).toBe(avant)
  })

  it('RG-COO-096 DA chapeau reprise de la copie Broadcast par (dossier, semaine, année) à la création', async () => {
    const s = await site()
    await f.createPrepaBroadcast(db, {
      idDossierDeVenteChapeau: s.contNum,
      semAnnee: plus(S, 1).annee,
      semNum: plus(S, 1).semaine,
      idDaChapeau: 777,
    })
    await lire([lue(s)])
    expect((await actives(s.contNum))[0]?.idDaChapeau).toBe(777)
  })

  it('RG-COO-096 rejet : une DA chapeau déjà renseignée n’est pas remplacée', async () => {
    const s = await site()
    await lire([lue(s, { idDaChapeau: 11 })])
    await lire([lue(s, { idDaChapeau: 22 })])
    expect((await actives(s.contNum))[0]?.idDaChapeau).toBe(11)
  })

  it('RG-COO-097 reçu calculé : la lecture ne pose jamais « reçu » ; après dissociation du dernier lien la ligne redevient Attendue', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S, quantite: 10 })])
    const [l] = await actives(s.contNum)
    if (!l) throw new Error('ligne')
    const afficheId = await recevoir(s, l.id, 10)
    await lire([lue(s, { semaine: S, quantite: 10 })])
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).statut).toBe(
      'COMPLETE',
    )
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, s.coord, {
      lienVersion: lien.version,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).statut).toBe(
      'ATTENDUE',
    )
  })
})

describe('RG-COO-088 — lien affiche ↔ ligne, propositions du rattachement manuel', () => {
  it('RG-COO-088 propositions (tri par reste) : seules les lignes non entièrement couvertes ; la recherche les montre toutes', async () => {
    const s = await site()
    await lire([
      lue(s, { semaine: S, theme: 'Couverte', quantite: 5 }),
      lue(s, { semaine: S, theme: 'Ouverte', quantite: 5 }),
    ])
    const ls = await actives(s.contNum)
    const couverte = ls.find((l) => l.theme === 'Couverte')
    if (!couverte) throw new Error('ligne')
    await recevoir(s, couverte.id, 5)
    const coord = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: s.plateforme.id }],
    )
    const autreAffiche = await recevoir(
      s,
      (ls.find((l) => l.theme === 'Ouverte') ?? couverte).id,
      1,
    )
    const h = devHeaders(coord.identifiantExterne)
    const url = (tri: string) =>
      `/api/affiches/${String(autreAffiche)}/candidats?q=${String(s.contNum)}${tri}`
    const propositions = await get(ctx, url('&tri=reste'), h)
    expect(propositions.statusCode, propositions.body).toBe(200)
    const themes = (r: typeof propositions) =>
      r.json<{ candidats: { theme: string | null }[] }>().candidats.map((c) => c.theme)
    expect(themes(propositions)).toEqual(['Ouverte'])
    expect(themes(await get(ctx, url(''), h)).sort()).toEqual(['Couverte', 'Ouverte'])
  })
})

describe('COO-P05 audit — fusion de clé, alertes journalisées, droits, rejets, indicateurs', () => {
  it('RG-COO-080 un thème renommé qui prend la clé d’une autre ligne active ⇒ fusion (quantités additionnées, liens déplacés, ligne fermée), jamais de doublon', async () => {
    const s = await site()
    await f.createDossier(db, { contNum: s.contNum })
    await lire([
      lue(s, { semaine: S, theme: 'Ancien', quantite: 30 }),
      lue(s, { semaine: S, theme: 'Nouveau', quantite: 70 }),
    ])
    const ancien = (await actives(s.contNum)).find((l) => l.theme === 'Ancien')
    const nouveau = (await actives(s.contNum)).find((l) => l.theme === 'Nouveau')
    if (!ancien || !nouveau) throw new Error('lignes')
    const afficheId = await recevoir(s, ancien.id, 5)
    await withTransaction(db, (tx) =>
      integrerPreparation(tx, s.contNum, [{ ligneAttendueId: ancien.id, theme: 'nouveau' }]),
    )
    const restantes = await actives(s.contNum)
    expect(restantes.map((l) => l.id)).toEqual([nouveau.id])
    expect(restantes[0]?.qteBc).toBe(100)
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: ancien.id } })).etatLigne,
    ).toBe('ANNULEE')
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    expect(lien.ligneAttendueId).toBe(nouveau.id)
    const h = await db.statutHistorique.findFirst({
      where: { typeEntite: 'LIGNE_ATTENDUE', entiteId: String(ancien.id), nouveau: 'ANNULEE' },
    })
    expect(h?.regle).toBe('RG-COO-080')
  })

  it('RG-COO-081 / 085 / 086 alertes de l’alimentation journalisées, relues par périmètre (interface COO-P07)', async () => {
    const s = await site()
    const autreSite = await site()
    await lire([lue(s, { theme: 'Sans numéro' }), lue(autreSite, { theme: 'Autre site' })])
    const miennes = await alertesAlimentation(db, [s.plateforme.id])
    expect(miennes.some((a) => a.type === 'THEME_SANS_NUMERO' && a.contNum === s.contNum)).toBe(
      true,
    )
    expect(miennes.some((a) => a.contNum === autreSite.contNum)).toBe(false)
    const toutes = await alertesAlimentation(db, null)
    expect(toutes.some((a) => a.contNum === autreSite.contNum)).toBe(true)
  })

  it('RG-COO-086 alerte écart DA / prépa journalisée', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await lire([lue(s, { semaine: S, idTheme: 3 })])
    await withTransaction(db, (tx) =>
      alimenterDepuisPreparation(tx, [
        {
          plateformeId: s.plateforme.id,
          contNum: s.contNum,
          supportId: s.support.id,
          theme: 'Thème A',
          idThemeBandeau: null,
          atelierId: atelier.id,
          annonceur: null,
          semaine: S,
          quantite: 60,
        },
      ]),
    )
    const a = await alertesAlimentation(db, [s.plateforme.id])
    expect(a.some((x) => x.type === 'ECART_DA_PREPA' && x.contNum === s.contNum)).toBe(true)
  })

  it('RG-COO-089 suppression : droit vérifié dans le service (recep, expe, com : 403) ; coord : 409', async () => {
    const s = await site()
    await lire([lue(s)])
    const [l] = await lignesDe(s.contNum)
    const del = (h: Record<string, string>) =>
      ctx.app.inject({
        method: 'DELETE',
        url: `/api/coordination/lignes-attendues/${String(l?.id)}`,
        headers: h,
      })
    for (const role of ['recep', 'expe', 'com'] as const) {
      const u = await autre(ctx, s.plateforme.id, [role])
      const r = await del(u.headers)
      expect(r.statusCode, role).toBe(403)
    }
    expect((await del(s.coord)).statusCode).toBe(409)
  })

  it('RG-COO-098 rejet : même dossier, même thème lu deux fois ⇒ une seule ligne (pas de ligne par lecture)', async () => {
    const s = await site()
    await lire([lue(s, { quantite: 40 }), lue(s, { quantite: 60, destinataire: 'Autre' })])
    const ls = await actives(s.contNum)
    expect(ls).toHaveLength(1)
    expect(ls[0]?.qteBc).toBe(100)
  })

  it('RG-COO-100 rejet : une même plateforme ne donne jamais deux lignes pour deux destinataires', async () => {
    const s = await site()
    await lire([
      lue(s, { destinataire: 'Afficheur A', quantite: 10 }),
      lue(s, { destinataire: 'Afficheur B', quantite: 15 }),
    ])
    const ls = await actives(s.contNum)
    expect(ls).toHaveLength(1)
    expect(ls[0]?.plateformeId).toBe(s.plateforme.id)
  })

  it('ECR-PIL-03 « validation admin à confirmer » compte en pré-production ; une tuile filtre toutes ses étapes', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await lire([lue(s, { semaine: S, quantite: 4 })])
    await withTransaction(db, (tx) =>
      alimenterDepuisPreparation(tx, [
        {
          plateformeId: s.plateforme.id,
          contNum: s.contNum,
          supportId: s.support.id,
          theme: 'Thème A',
          idThemeBandeau: null,
          atelierId: atelier.id,
          annonceur: null,
          semaine: S,
          quantite: 4,
        },
      ]),
    )
    const [l] = await actives(s.contNum)
    if (!l) throw new Error('ligne')
    await recevoir(s, l.id, 4)
    const r = await get(ctx, `/api/coordination/reservations?dossier=${String(s.contNum)}`, s.coord)
    const edr = ReservationsSchema.parse(r.json())
    expect(edr.items[0]?.ou).toBe('VALIDATION_A_CONFIRMER')
    expect(edr.items[0]?.lisere).toBe('info')
    expect(edr.indicateurs).toMatchObject({ enPreProduction: 1, affichesAttendues: 0 })
    const tuile = ReservationsSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/reservations?dossier=${String(s.contNum)}&ou=DA_ACTIVEE,IP_SAISIES,VALIDATION_A_CONFIRMER`,
          s.coord,
        )
      ).json(),
    )
    expect(tuile.total).toBe(1)
    const autre = ReservationsSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/reservations?dossier=${String(s.contNum)}&ou=PREPA_RECUE,RECUES_EN_PARTIE`,
          s.coord,
        )
      ).json(),
    )
    expect(autre.total).toBe(0)
    const invalide = await get(ctx, '/api/coordination/reservations?ou=INCONNUE', s.coord)
    expect(invalide.statusCode).toBe(400)
  })
})

describe('RG-COO-098 / 099 / 100 — même thème, surplus, deux plateformes', () => {
  it('RG-COO-098 même thème sur deux dossiers ⇒ une ligne par dossier', async () => {
    const s = await site()
    await lire([lue(s), lue(s, { contNum: s.contNum + 1 })])
    expect(await actives(s.contNum)).toHaveLength(1)
    expect(await actives(s.contNum + 1)).toHaveLength(1)
  })

  it('RG-COO-099 surplus rattaché à la main à l’autre dossier (MAIN, historisé) ; au-delà du reçu : 422', async () => {
    const s = await site()
    await lire([
      lue(s, { semaine: S, quantite: 6 }),
      lue(s, { contNum: s.contNum + 1, semaine: S, quantite: 4 }),
    ])
    const [l1] = await actives(s.contNum)
    const [l2] = await actives(s.contNum + 1)
    if (!l1 || !l2) throw new Error('lignes')
    const afficheId = await recevoir(s, l1.id, 10)
    // Le lien BL porte les 10 reçues : on le ramène à 6 pour libérer le surplus de 4.
    await db.afficheAttendue.updateMany({
      where: { afficheId, actif: true },
      data: { quantite: 6 },
    })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
    const trop = await post(ctx, `/api/affiches/${String(afficheId)}/rattachements`, s.coord, {
      ligneAttendueId: l2.id,
      quantite: 5,
      version: a.version,
    })
    expect(trop.statusCode).toBe(422)
    const ok = await post(ctx, `/api/affiches/${String(afficheId)}/rattachements`, s.coord, {
      ligneAttendueId: l2.id,
      quantite: 4,
      version: a.version,
    })
    expect(ok.statusCode, ok.body).toBe(200)
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId, ligneAttendueId: l2.id, actif: true },
    })
    expect(lien).toMatchObject({ mode: 'MAIN', quantite: 4 })
    expect(lien.creePar).not.toBeNull()
  })

  it('RG-COO-100 dossier livré sur deux plateformes ⇒ une ligne par plateforme (destinataires sans effet)', async () => {
    const s = await site()
    const deux = await site()
    await lire([
      lue(s, { destinataire: 'Afficheur 1' }),
      lue(s, { destinataire: 'Afficheur 2', quantite: 50 }),
      lue(deux, { contNum: s.contNum, quantite: 30 }),
    ])
    const ls = await actives(s.contNum)
    expect(ls.map((l) => [l.plateformeId, l.qteBc]).sort()).toEqual(
      [
        [s.plateforme.id, 150],
        [deux.plateforme.id, 30],
      ].sort(),
    )
  })
})

describe('RG-COO-101 / 107 / 108 — état des réservations vivant (ECR-PIL-03)', () => {
  const edr = async (headers: Record<string, string>, q = '') => {
    const r = await get(ctx, `/api/coordination/reservations${q ? `?${q}` : ''}`, headers)
    expect(r.statusCode, r.body).toBe(200)
    return ReservationsSchema.parse(r.json())
  }

  it('RG-COO-101 dossier sur deux semaines (S+1 et S+2) de quantité 100 ⇒ attendu 100, repère multi-semaines', async () => {
    const s = await site()
    await lire([lue(s, { semaine: plus(S, 1) }), lue(s, { semaine: plus(S, 2) })])
    const r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      attendu: 100,
      departs: [formatSemaineIso(plus(S, 1)), formatSemaineIso(plus(S, 2))],
      reperes: ['MULTI_SEMAINES'],
      ou: 'IP_SAISIES',
    })
    const dossier = await edr(s.coord, `dossier=${String(s.contNum)}&grain=DOSSIER`)
    expect(dossier.items[0]?.attendu).toBe(100)
  })

  it('RG-COO-107 « Où en est-il », N° d’affiche • puis ✓, reste à recevoir ; un dossier compte à l’étape la moins avancée', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await lire([
      lue(s, { semaine: S, quantite: 10 }),
      lue(s, { semaine: S, theme: null, contNum: s.contNum }),
    ])
    // Thème A : prépa reçue puis affiches reçues ; la ligne provisoire du même dossier/semaine se ferme
    // (IP saisies), on garde donc un second dossier pour l'indicateur.
    await withTransaction(db, (tx) =>
      alimenterDepuisPreparation(tx, [
        {
          plateformeId: s.plateforme.id,
          contNum: s.contNum,
          supportId: s.support.id,
          theme: 'Thème A',
          idThemeBandeau: null,
          atelierId: atelier.id,
          annonceur: 'ANNONCEUR P05',
          semaine: S,
          quantite: 10,
        },
      ]),
    )
    const [l] = await actives(s.contNum)
    if (!l) throw new Error('ligne')
    let r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items[0]).toMatchObject({ ou: 'PREPA_RECUE', afficheRecue: 'NON', resteARecevoir: 10 })
    const afficheId = await recevoir(s, l.id, 4)
    r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items[0]).toMatchObject({ ou: 'RECUES_EN_PARTIE', recu: 4, resteARecevoir: 6 })
    expect(r.items[0]?.numerosAffiche).toEqual([{ id: afficheId, marque: '•' }])
    await db.afficheAttendue.updateMany({
      where: { afficheId, actif: true },
      data: { quantite: 10 },
    })
    await db.mouvement.create({
      data: { afficheId, type: 'COMPLEMENT', date: new Date(), quantite: 6 },
    })
    r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items[0]?.ou).toBe('VALIDATION_A_CONFIRMER')
    await db.affiche.update({ where: { id: afficheId }, data: { validationAdmin: true } })
    r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items[0]).toMatchObject({ ou: 'EN_PRODUCTION' })
    expect(r.items[0]?.numerosAffiche).toEqual([{ id: afficheId, marque: '✓' }])
    expect(r.indicateurs.enProduction).toBe(1)
    // Un second thème du même dossier, IP saisies seulement : le dossier compte en pré-production.
    await lire([lue(s, { semaine: S, quantite: 10 }), lue(s, { semaine: S, theme: 'Thème Z' })])
    r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.indicateurs).toMatchObject({ dossiers: 1, enPreProduction: 1, enProduction: 0 })
    const parDossier = await edr(s.coord, `dossier=${String(s.contNum)}&grain=DOSSIER`)
    expect(parDossier.items[0]).toMatchObject({ ou: 'IP_SAISIES', themes: 2 })
    const filtre = await edr(s.coord, `dossier=${String(s.contNum)}&ou=EN_PRODUCTION`)
    expect(filtre.items.map((x) => x.visuel)).toEqual(['Thème A'])
  })

  it('RG-COO-107 ligne provisoire : « DA activée, IP à saisir » ; dossier annulé : « Annulé », attendu 0', async () => {
    const s = await site()
    await lire([lue(s, { theme: null }), lue(s, { contNum: s.contNum + 1 })])
    expect((await edr(s.coord, `dossier=${String(s.contNum)}`)).items[0]).toMatchObject({
      ou: 'DA_ACTIVEE',
      visuel: null,
      reperes: ['PROVISOIRE'],
    })
    await f.createDossier(db, { contNum: s.contNum + 1, statut: 'ANNULE' })
    await db.receptionAttendue.updateMany({
      where: { contNum: s.contNum + 1 },
      data: { etatLigne: 'ANNULEE' },
    })
    const r = await edr(s.coord, `dossier=${String(s.contNum + 1)}`)
    expect(r.items[0]).toMatchObject({ ou: 'ANNULE', attendu: 0, afficheRecue: null })
    expect(r.indicateurs.dossiers).toBe(0)
  })

  it('RG-COO-107 grains DA et Format, filtres départ et annonceur', async () => {
    const s = await site()
    await lire([
      lue(s, { theme: 'T1', quantite: 10 }),
      lue(s, { theme: 'T2', quantite: 20 }),
      lue(s, { theme: 'T3', quantite: 5, semaine: plus(S, 2), annonceur: 'AUTRE' }),
    ])
    const da = await edr(s.coord, `dossier=${String(s.contNum)}&grain=DA`)
    expect(da.items).toHaveLength(1)
    expect(da.items[0]).toMatchObject({ attendu: 35, themes: 3, dossiers: 1 })
    const format = await edr(s.coord, `dossier=${String(s.contNum)}&grain=FORMAT`)
    expect(format.items[0]).toMatchObject({ dossier: null, attendu: 35 })
    const dep = await edr(
      s.coord,
      `dossier=${String(s.contNum)}&depart=${formatSemaineIso(plus(S, 2))}`,
    )
    expect(dep.items.map((x) => x.visuel)).toEqual(['T3'])
    const ann = await edr(s.coord, `dossier=${String(s.contNum)}&annonceur=autre`)
    expect(ann.items.map((x) => x.visuel)).toEqual(['T3'])
    expect(ann.totaux).toEqual({ attendu: 5, recu: 0, resteARecevoir: 5 })
  })

  it('RG-COO-108 seules les plateformes du périmètre ; site choisi hors périmètre : 403', async () => {
    const s = await site()
    const autreSite = await site()
    await lire([lue(s), lue(autreSite)])
    const vu = await edr(s.coord, `dossier=${String(autreSite.contNum)}`)
    expect(vu.items).toHaveLength(0)
    const r = await get(
      ctx,
      `/api/coordination/reservations?plateformeId=${String(autreSite.plateforme.id)}`,
      s.coord,
    )
    expect(r.statusCode).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-108')
  })

  it('RG-COO-108 rejet : une ligne d’une plateforme non gérée (sans site Broadcast) n’est pas affichée', async () => {
    const s = await site()
    const p = await f.createPlateforme(db)
    const admin = await f.createUtilisateurAvecRoles(db, ['admin'], [{ plateformeId: p.id }])
    await f.createReceptionAttendue(db, {
      plateformeId: p.id,
      contNum: s.contNum,
      semAnnee: S.annee,
      semNum: S.semaine,
    })
    const r = await edr(devHeaders(admin.identifiantExterne), `dossier=${String(s.contNum)}`)
    expect(r.items).toHaveLength(0)
  })

  it('RG-COO-107 permissions : coord, cheq, recep, admin, com consultent ; expe refusé (403)', async () => {
    const s = await site()
    for (const role of ['coord', 'cheq', 'recep', 'admin', 'com'] as const) {
      const u = await autre(ctx, s.plateforme.id, [role])
      expect((await get(ctx, '/api/coordination/reservations', u.headers)).statusCode, role).toBe(
        200,
      )
    }
    const expe = await autre(ctx, s.plateforme.id, ['expe'])
    expect((await get(ctx, '/api/coordination/reservations', expe.headers)).statusCode).toBe(403)
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/api/coordination/reservations' })).statusCode,
    ).toBe(401)
  })
})

describe('RG-COO-105 / 106 — suivi de production', () => {
  const suivi = async (headers: Record<string, string>, q = '') => {
    const r = await get(ctx, `/api/coordination/suivi-production${q ? `?${q}` : ''}`, headers)
    expect(r.statusCode, r.body).toBe(200)
    return SuiviProductionSchema.parse(r.json())
  }

  it('RG-COO-105 seules les lignes PREPA ; n° d’affiche visible une fois validée', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await lire([lue(s, { semaine: S }), lue(s, { semaine: S, theme: 'Thème BC seulement' })])
    await withTransaction(db, (tx) =>
      alimenterDepuisPreparation(tx, [
        {
          plateformeId: s.plateforme.id,
          contNum: s.contNum,
          supportId: s.support.id,
          theme: 'Thème A',
          idThemeBandeau: null,
          atelierId: atelier.id,
          annonceur: null,
          semaine: S,
          quantite: 100,
        },
      ]),
    )
    const l = (await actives(s.contNum)).find((x) => x.theme === 'Thème A')
    if (!l) throw new Error('ligne')
    const afficheId = await recevoir(s, l.id, 10)
    let r = await suivi(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items.map((x) => x.theme)).toEqual(['Thème A'])
    expect(r.items[0]?.numerosAffiche).toEqual([])
    await db.affiche.update({ where: { id: afficheId }, data: { validationAdmin: true } })
    r = await suivi(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items[0]?.numerosAffiche).toEqual([afficheId])
  })

  it('RG-COO-106 répartitions (statut de l’UM prioritaire) et faces ; limité aux ateliers de l’utilisateur', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const autreAtelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const um = await f.createUniteManutention(db, { statut: 'PREPARE' })
    const base = {
      contNum: s.contNum,
      supportId: s.support.id,
      atelierId: atelier.id,
      semAnnee: S.annee,
      semNum: S.semaine,
      theme: 'Thème A',
    }
    await f.createRepartition(db, { ...base, qte: 10, uniteId: um.id, statut: 'EN_COURS' })
    await f.createRepartition(db, { ...base, qte: 5, statut: 'A_IMPRIMER' })
    await withTransaction(db, (tx) =>
      alimenterDepuisPreparation(tx, [
        {
          plateformeId: s.plateforme.id,
          contNum: s.contNum,
          supportId: s.support.id,
          theme: 'Thème A',
          idThemeBandeau: null,
          atelierId: atelier.id,
          annonceur: null,
          semaine: S,
          quantite: 15,
        },
        {
          plateformeId: s.plateforme.id,
          contNum: s.contNum,
          supportId: s.support.id,
          theme: 'Thème B',
          idThemeBandeau: null,
          atelierId: autreAtelier.id,
          annonceur: null,
          semaine: S,
          quantite: 3,
        },
      ]),
    )
    const r = await suivi(s.coord, `dossier=${String(s.contNum)}&atelierId=${String(atelier.id)}`)
    expect(r.items).toHaveLength(1)
    expect(r.items[0]?.repartitions.map((x) => x.statut).sort()).toEqual(['A_IMPRIMER', 'PREPARE'])
    // Utilisateur limité à l'autre atelier : ne voit que la ligne de son atelier ; atelier interdit : 403.
    const limite = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: s.plateforme.id, atelierId: autreAtelier.id }],
    )
    const h = devHeaders(limite.identifiantExterne)
    const vu = await suivi(h, `dossier=${String(s.contNum)}`)
    expect(vu.items.map((x) => x.theme)).toEqual(['Thème B'])
    const interdit = await get(
      ctx,
      `/api/coordination/suivi-production?atelierId=${String(atelier.id)}`,
      h,
    )
    expect(interdit.statusCode).toBe(403)
  })

  it('RG-COO-106 permissions : coord, cheq, admin, com ; recep et expe refusés (Q-201)', async () => {
    const s = await site()
    for (const role of ['coord', 'cheq', 'admin', 'com'] as const) {
      const u = await autre(ctx, s.plateforme.id, [role])
      expect(
        (await get(ctx, '/api/coordination/suivi-production', u.headers)).statusCode,
        role,
      ).toBe(200)
    }
    for (const role of ['recep', 'expe'] as const) {
      const u = await autre(ctx, s.plateforme.id, [role])
      expect(
        (await get(ctx, '/api/coordination/suivi-production', u.headers)).statusCode,
        role,
      ).toBe(403)
    }
  })
})
