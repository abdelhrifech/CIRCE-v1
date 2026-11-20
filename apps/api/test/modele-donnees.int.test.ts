// Contraintes clés du modèle de données (étape 3) sur la base de test SQLite (Q-343).
import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from '../src/core/db.ts'
import {
  EtatLigne,
  SourceLigne,
  StatutAffiche,
  StatutReception,
} from '../src/generated/prisma/client.ts'
import { seedRef } from '../src/reference/seed-ref.ts'
import * as f from './factories/index.ts'

const db = createDb(process.env['DATABASE_URL'] ?? '')
afterAll(async () => {
  await db.$disconnect()
})

describe('migration : index uniques partiels présents', () => {
  it('Q-305 / RG-COO-080 les 4 index partiels sont créés par la migration', async () => {
    const rows = await db.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type = 'index' AND sql LIKE '%WHERE%'`
    const names = rows.map((r) => r.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'tf_prepa_affiche_ligne_active_cle_key',
        'asso_affiche_visuel_lien_actif_key',
        'parametre_cle_globale_key',
        'utilisateur_perimetre_sans_atelier_key',
      ]),
    )
  })
})

describe('clés étrangères (ON DELETE RESTRICT)', () => {
  it('rejette une affiche sur une plateforme inexistante', async () => {
    const support = await f.createSupport(db)
    await expect(
      f.createAffiche(db, { plateformeId: 999_999, supportId: support.id }),
    ).rejects.toMatchObject({ code: 'P2003' })
  })

  it('rejette un mouvement sur une affiche inexistante', async () => {
    await expect(f.createMouvement(db, { afficheId: 999_999 })).rejects.toMatchObject({
      code: 'P2003',
    })
  })

  it('rejette une face de train sur une instruction inexistante', async () => {
    await expect(f.createFaceTrain(db, { instructionCode: 'INEXISTANTE' })).rejects.toMatchObject({
      code: 'P2003',
    })
  })

  it('rejette un rattachement vers une ligne attendue inexistante', async () => {
    const affiche = await f.createAffiche(db)
    await expect(
      f.createRattachement(db, { afficheId: affiche.id, ligneAttendueId: 999_999 }),
    ).rejects.toMatchObject({ code: 'P2003' })
  })

  it('refuse de supprimer une plateforme référencée par une réception', async () => {
    const reception = await f.createReception(db)
    await expect(
      db.plateforme.delete({ where: { id: reception.plateformeId } }),
    ).rejects.toMatchObject({ code: 'P2003' })
  })

  it('RG-REC-151 refuse de supprimer une affiche qui a des mouvements', async () => {
    const mouvement = await f.createMouvement(db)
    await expect(db.affiche.delete({ where: { id: mouvement.afficheId } })).rejects.toMatchObject({
      code: 'P2003',
    })
  })

  it('accepte une FK valide (cas nominal)', async () => {
    const affiche = await f.createAffiche(db)
    const mouvement = await f.createMouvement(db, { afficheId: affiche.id })
    expect(mouvement.afficheId).toBe(affiche.id)
  })
})

describe('NOT NULL (niveau base, SQL brut)', () => {
  it('refuse une affiche sans quantité', async () => {
    const plateforme = await f.createPlateforme(db)
    const support = await f.createSupport(db)
    await expect(
      db.$executeRaw`INSERT INTO "affiche" ("plt_id","sup_id","statut","date_entree","conservation","date_maj")
        VALUES (${plateforme.id}, ${support.id}, 'IDENTIFIEE', CURRENT_TIMESTAMP, 20, CURRENT_TIMESTAMP)`,
    ).rejects.toThrow(/NOT NULL/i)
  })

  it('refuse une réception sans statut', async () => {
    const plateforme = await f.createPlateforme(db)
    await expect(
      db.$executeRaw`INSERT INTO "reception" ("plateforme_id","date_arrivee","updated_at")
        VALUES (${plateforme.id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ).rejects.toThrow(/NOT NULL/i)
  })

  it('refuse un mouvement sans quantité', async () => {
    const affiche = await f.createAffiche(db)
    await expect(
      db.$executeRaw`INSERT INTO "mouvement" ("affiche_id","type","date") VALUES (${affiche.id}, 'RECEPTION', CURRENT_TIMESTAMP)`,
    ).rejects.toThrow(/NOT NULL/i)
  })
})

describe('valeurs par défaut (Q-313, CLAUDE.md §6)', () => {
  it('une affiche démarre en version 1 avec les drapeaux à false', async () => {
    const affiche = await f.createAffiche(db)
    expect(affiche.version).toBe(1)
    expect(affiche).toMatchObject({
      rebus: false,
      zonePicking: false,
      estFusionne: false,
      envoye: false,
      aConserver: false,
      validationAdmin: false,
      feuilleARefaire: false,
    })
  })

  it('RG-REC-009 une réception porte version, createdAt et updatedAt', async () => {
    const reception = await f.createReception(db)
    expect(reception.version).toBe(1)
    expect(reception.createdAt).toBeInstanceOf(Date)
    expect(reception.updatedAt).toBeInstanceOf(Date)
  })

  it('une ligne attendue démarre ACTIVE et ATTENDUE', async () => {
    const ligne = await f.createReceptionAttendue(db)
    expect(ligne).toMatchObject({ etatLigne: EtatLigne.ACTIVE, statut: 'ATTENDUE', version: 1 })
  })
})

describe('unicités', () => {
  it('refuse deux utilisateurs de même identifiant externe', async () => {
    const user = await f.createUtilisateur(db)
    await expect(
      f.createUtilisateur(db, { identifiantExterne: user.identifiantExterne }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('refuse deux rôles de même code', async () => {
    const role = await f.createRole(db)
    await expect(f.createRole(db, { code: role.code })).rejects.toMatchObject({ code: 'P2002' })
  })

  it('refuse deux instructions de même code (PK, Q-303)', async () => {
    const instruction = await f.createInstruction(db)
    await expect(f.createInstruction(db, { code: instruction.code })).rejects.toMatchObject({
      code: 'P2002',
    })
  })

  it('RG-REC-008 refuse deux clés d’idempotence identiques pour un même utilisateur', async () => {
    const first = await f.createCleIdempotence(db)
    await expect(
      f.createCleIdempotence(db, { utilisateurId: first.utilisateurId, cle: first.cle }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('accepte la même clé d’idempotence pour deux utilisateurs différents', async () => {
    const first = await f.createCleIdempotence(db)
    await expect(f.createCleIdempotence(db, { cle: first.cle })).resolves.toBeDefined()
  })

  it('refuse deux UM de même code-barres', async () => {
    const um = await f.createUniteManutention(db)
    await expect(f.createUniteManutention(db, { codeBarre: um.codeBarre })).rejects.toMatchObject({
      code: 'P2002',
    })
  })

  it('refuse un paramètre global en double (index partiel, Q-337)', async () => {
    const parametre = await f.createParametre(db)
    await expect(f.createParametre(db, { cle: parametre.cle })).rejects.toMatchObject({
      code: 'P2002',
    })
  })

  it('accepte une même clé de paramètre pour deux plateformes distinctes', async () => {
    const cle = 'test.parametre.par-site'
    const a = await f.createPlateforme(db)
    const b = await f.createPlateforme(db)
    await f.createParametre(db, { cle, plateformeId: a.id })
    await expect(f.createParametre(db, { cle, plateformeId: b.id })).resolves.toBeDefined()
  })

  it('refuse un périmètre sans atelier en double (index partiel)', async () => {
    const perimetre = await f.createPerimetre(db)
    await expect(
      f.createPerimetre(db, {
        utilisateurId: perimetre.utilisateurId,
        plateformeId: perimetre.plateformeId,
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })
})

describe('Q-305 / RG-COO-080 une seule ligne attendue ACTIVE par clé', () => {
  const cle = (plateformeId: number, supportId: number) => ({
    plateformeId,
    supportId,
    contNum: 777,
    theme: 'THEME',
    themeCle: 'THEME',
    semNum: 12,
    semAnnee: 2026,
  })

  it('refuse une seconde ligne ACTIVE de même clé', async () => {
    const plateforme = await f.createPlateforme(db)
    const support = await f.createSupport(db)
    await f.createReceptionAttendue(db, cle(plateforme.id, support.id))
    await expect(
      f.createReceptionAttendue(db, cle(plateforme.id, support.id)),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('refuse le doublon même sans thème ni bandeau (NULL traités comme des valeurs)', async () => {
    const plateforme = await f.createPlateforme(db)
    const support = await f.createSupport(db)
    const sansTheme = {
      ...cle(plateforme.id, support.id),
      contNum: 778,
      theme: null,
      themeCle: null,
    }
    await f.createReceptionAttendue(db, sansTheme)
    await expect(f.createReceptionAttendue(db, sansTheme)).rejects.toMatchObject({ code: 'P2002' })
  })

  it('RG-COO-087 accepte une nouvelle ligne ACTIVE quand l’ancienne est ANNULEE (jamais supprimée)', async () => {
    const plateforme = await f.createPlateforme(db)
    const support = await f.createSupport(db)
    const key = { ...cle(plateforme.id, support.id), contNum: 779 }
    const ancienne = await f.createReceptionAttendue(db, { ...key, etatLigne: EtatLigne.ANNULEE })
    const nouvelle = await f.createReceptionAttendue(db, { ...key, source: SourceLigne.PREPA })
    expect(nouvelle.id).not.toBe(ancienne.id)
    expect(await db.receptionAttendue.count({ where: { contNum: 779 } })).toBe(2)
  })

  it('accepte deux lignes ACTIVE de semaines différentes', async () => {
    const plateforme = await f.createPlateforme(db)
    const support = await f.createSupport(db)
    const key = { ...cle(plateforme.id, support.id), contNum: 780 }
    await f.createReceptionAttendue(db, key)
    await expect(f.createReceptionAttendue(db, { ...key, semNum: 13 })).resolves.toBeDefined()
  })
})

describe('Q-306 / RG-COO-088 / RG-REC-137 lien affiche ↔ ligne attendue', () => {
  it('refuse un second lien ACTIF entre la même affiche et la même ligne', async () => {
    const lien = await f.createRattachement(db)
    await expect(
      f.createRattachement(db, {
        afficheId: lien.afficheId,
        ligneAttendueId: lien.ligneAttendueId,
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('accepte un nouveau lien après retrait de l’ancien (un lien retiré n’est jamais réactivé)', async () => {
    const lien = await f.createRattachement(db)
    await db.afficheAttendue.update({
      where: { id: lien.id },
      data: { actif: false, retireLe: new Date() },
    })
    const nouveau = await f.createRattachement(db, {
      afficheId: lien.afficheId,
      ligneAttendueId: lien.ligneAttendueId,
    })
    expect(nouveau.id).not.toBe(lien.id)
    expect(await db.afficheAttendue.count({ where: { afficheId: lien.afficheId } })).toBe(2)
  })

  it('permet de rattacher une affiche à plusieurs lignes avec une quantité par lien (n–n)', async () => {
    const affiche = await f.createAffiche(db)
    await f.createRattachement(db, { afficheId: affiche.id, quantite: 40 })
    await f.createRattachement(db, { afficheId: affiche.id, quantite: 60 })
    const somme = await db.afficheAttendue.aggregate({
      where: { afficheId: affiche.id },
      _sum: { quantite: true },
    })
    expect(somme._sum.quantite).toBe(100)
  })
})

describe('seed:ref (Q-004, Q-319)', () => {
  it('charge les référentiels issus des règles', async () => {
    const result = await seedRef(db)
    expect(result).toEqual({
      roles: 6,
      instructionPlus: 5,
      typesPreparation: 5,
      parametres: 48,
      permissions: 66,
    })
    expect(
      await db.role.count({
        where: { code: { in: ['coord', 'cheq', 'recep', 'expe', 'admin', 'com'] } },
      }),
    ).toBe(6)
  })

  it('est idempotent : un second passage ne crée aucun doublon', async () => {
    await seedRef(db)
    const avant = await db.parametre.count({
      where: { plateformeId: null, cle: { startsWith: 'reception.' } },
    })
    await seedRef(db)
    const apres = await db.parametre.count({
      where: { plateformeId: null, cle: { startsWith: 'reception.' } },
    })
    expect(apres).toBe(avant)
    expect(await db.typePreparation.count({ where: { libelle: 'PLIAGE' } })).toBe(1)
  })

  it('ne charge aucune plateforme ni atelier inventés (Q-319)', async () => {
    await seedRef(db)
    const plateformesSeed = await db.plateforme.count({
      where: { NOT: { nom: { startsWith: 'Plateforme test' } } },
    })
    expect(plateformesSeed).toBe(0)
  })
})

describe('factories : une par entité', () => {
  it('crée chaque entité du modèle', async () => {
    const reception = await f.createReception(db, { statut: StatutReception.A_IDENTIFIER })
    const ids = {
      plateforme: (await f.createPlateforme(db)).id,
      atelier: (await f.createAtelier(db)).id,
      support: (await f.createSupport(db)).id,
      surface: (await f.createSurface(db)).id,
      typePreparation: (await f.createTypePreparation(db)).id,
      imprimeur: (await f.createImprimeur(db)).id,
      livreur: (await f.createLivreur(db)).id,
      destinataire: (await f.createDestinataire(db)).id,
      rouleur: (await f.createRouleur(db)).id,
      jourDepart: (await f.createJourDepart(db)).id,
      permission: (await f.createPermission(db)).id,
      photo: (await f.createPhoto(db)).id,
      livraison: (await f.createLivraison(db)).id,
      reception: reception.id,
      affiche: (await f.createAffiche(db, { statut: StatutAffiche.ORPHELINE })).id,
      semaineDepart: (await f.createAfficheSemaineDepart(db)).id,
      fusion: (await f.createFusionAffiche(db)).id,
      prepaBroadcast: (await f.createPrepaBroadcast(db)).id,
      dossier: (await f.createDossier(db)).id,
      detail: (await f.createInstructionDetail(db)).id,
      visuel: (await f.createInstructionVisuel(db)).id,
      face: (await f.createFaceTrain(db)).id,
      unite: (await f.createUniteManutention(db)).id,
      repartition: (await f.createRepartition(db)).id,
    }
    for (const [nom, id] of Object.entries(ids)) {
      expect(id, nom).toBeGreaterThan(0)
    }
    // Un rouleur sans atelier est proposé à tous les ateliers : purgé pour ne pas fausser les tests du roulage
    // (l'ordre d'exécution des fichiers change avec les durées mesurées).
    await db.rouleur.delete({ where: { id: ids.rouleur } })
    const user = await f.createUtilisateur(db)
    const audit = await f.createJournalAudit(db, {
      typeEntite: 'AFFICHE',
      entiteId: '1',
      action: 'CREATION_AFFICHE',
      parId: user.id,
    })
    const histo = await f.createStatutHistorique(db, {
      typeEntite: 'RECEPTION',
      entiteId: String(reception.id),
      nouveau: 'A_IDENTIFIER',
      parId: user.id,
    })
    expect(audit.id).toBeGreaterThan(0)
    expect(histo.id).toBeGreaterThan(0)
  })
})
