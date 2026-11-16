// Famille « statuts » : au moins une entité dans CHAQUE statut, par l'API quand c'est réaliste (réception, contrôle,
// inconnue, surplus, annulation d'instruction, annulation de dossier par le service d'intégration, export, colisage,
// colis), sinon insertion directe cohérente avec la machine d'états (faces « Préparé », « Terminé »... posées par les
// écrans de production non encore exposés) suivie du test de cohérence (`massif/`). RG : RG-REC-070/071, RG-REC-018,
// RG-COO-040/062/063/210/261/266, RG-X-065. Volume : ~12 cas × max(1, volume/200). État attendu : chaque statut des
// énumérations Réception (3 + 2 + 4 lignes), Dossier (3), Instruction (6), Face (11), UM / Colis est présent.
import type { Scenario } from './index.ts'
import { exiger, poster } from '../api.ts'
import { creerSite } from '../contexte.ts'
import {
  appelUnitaire,
  chaineFixe,
  controler,
  creerInconnue,
  dossierAvecLignes,
  exporterTrains,
  finDeJournee,
  ligneRepartition,
  recevoirLignes,
  trainsDuDossier,
  typePreparation,
} from '../monde.ts'
import { withTransaction } from '../../../src/core/transaction.ts'
import { annulerDossier } from '../../../src/modules/coordination/integration.ts'
import type { StatutProduction } from '../../../src/generated/prisma/client.ts'

const FACES_DIRECTES: {
  face: StatutProduction
  instruction: 'A_TRAITER' | 'EN_COURS' | 'INSTRUCTION_OK' | 'ERREUR' | 'PRET_A_PRODUIRE'
}[] = [
  { face: 'A_TRAITER', instruction: 'A_TRAITER' },
  { face: 'EN_COURS', instruction: 'EN_COURS' },
  { face: 'INSTRUCTION_OK', instruction: 'INSTRUCTION_OK' },
  { face: 'ERREUR', instruction: 'ERREUR' },
  { face: 'EXPORT_PREPA', instruction: 'PRET_A_PRODUIRE' },
  { face: 'AU_ROULAGE', instruction: 'PRET_A_PRODUIRE' },
  { face: 'PREPARE', instruction: 'PRET_A_PRODUIRE' },
  { face: 'A_EXPEDIER', instruction: 'PRET_A_PRODUIRE' },
  { face: 'TERMINE', instruction: 'PRET_A_PRODUIRE' },
]

export const statuts: Scenario = {
  nom: 'statuts',
  regles: [
    'RG-REC-018',
    'RG-REC-070',
    'RG-REC-071',
    'RG-COO-040',
    'RG-COO-062',
    'RG-COO-210',
    'RG-COO-261',
    'RG-COO-266',
  ],
  attendu:
    'au moins une entité par statut (réception, affiche, ligne, dossier, instruction, face, UM, colis)',
  async generer(jdd) {
    const site = await creerSite(jdd)
    const tours = Math.max(1, Math.round(jdd.volume / 200))
    const type = await typePreparation(jdd)
    for (let t = 0; t < tours; t++) {
      // Réception : À contrôler (BL), Contrôlée (contrôle), À identifier + affiche ORPHELINE (inconnue).
      const complete = await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 20 })
      await recevoirLignes(jdd, site, complete.lignes) // ligne COMPLETE, palette À contrôler
      const r2 = await recevoirLignes(
        jdd,
        site,
        (await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 20 })).lignes,
      )
      exiger(await controler(jdd, site, r2.receptionId), 'contrôle')
      await creerInconnue(jdd, site, 7)
      // Ligne : ATTENDUE (rien), PARTIELLE, SURPLUS (reçu > attendu), COMPLETE (r1).
      await dossierAvecLignes(jdd, site, { lignes: 1 })
      await recevoirLignes(
        jdd,
        site,
        (await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 20 })).lignes,
        0.5,
      )
      await recevoirLignes(
        jdd,
        site,
        (await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 20 })).lignes,
        2,
      )
      // Dossier ANNULE (service d'intégration) : lignes ANNULEE, affiches conservées.
      const aAnnuler = await dossierAvecLignes(jdd, site, { lignes: 2 })
      await recevoirLignes(jdd, site, aAnnuler.lignes.slice(0, 1))
      await withTransaction(jdd.ctx.db, (tx) => annulerDossier(tx, aAnnuler.dossier.contNum))
      // Dossier PREPARATION_RECUE + instruction / faces dans chaque statut.
      for (const c of FACES_DIRECTES) {
        const d = await dossierAvecLignes(jdd, site, {
          lignes: 1,
          statut: c.instruction === 'A_TRAITER' ? 'A_TRAITER' : 'PREPARATION_RECUE',
        })
        await trainsDuDossier(jdd, site, d, {
          statutInstruction: c.instruction,
          statutFace: c.face,
        })
      }
      // Instruction ANNULE (API) à partir d'une instruction EN_COURS.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, statut: 'PREPARATION_RECUE' })
        const tr = await trainsDuDossier(jdd, site, d, {
          statutInstruction: 'EN_COURS',
          statutFace: 'EN_COURS',
        })
        exiger(
          await poster(
            jdd,
            `/api/coordination/instructions/${tr.instruction.code}/statut`,
            site.users.coord.headers,
            {
              version: tr.instruction.version,
              vers: 'ANNULE',
            },
          ),
          'annulation de l’instruction',
        )
      }
      // Instruction ANNULE : ses faces sont annulées (insertion directe : l'annulation ne les cascade pas, RG-COO-045).
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, statut: 'PREPARATION_RECUE' })
        await trainsDuDossier(jdd, site, d, { statutInstruction: 'ANNULE', statutFace: 'ANNULE' })
      }
      // Export : instruction PRET_A_PRODUIRE et faces A_IMPRIMER (API) ; puis un nouveau groupe « Instruction OK ».
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 2, statut: 'PREPARATION_RECUE' })
        await trainsDuDossier(jdd, site, d)
        exiger(await exporterTrains(jdd, site), 'export des trains')
        const d2 = await dossierAvecLignes(jdd, site, { lignes: 1, statut: 'PREPARATION_RECUE' })
        await trainsDuDossier(jdd, site, d2)
      }
      // UM et colis : EN_COURS (colis ouvert), A_EXPEDIER (clos), TERMINE (fin de journée).
      const rep = await ligneRepartition(jdd, site, type.id, { qte: 5 })
      const termine = await chaineFixe(jdd, site, [{ id: rep.id, version: rep.version }])
      jdd.compter('colis.termines', termine.colisIds.length)
      exiger(await finDeJournee(jdd, site), 'fin de journée')
      const rep2 = await ligneRepartition(jdd, site, type.id, { qte: 5 })
      await chaineFixe(jdd, site, [{ id: rep2.id, version: rep2.version }]) // reste « A expédier »
      const rep3 = await ligneRepartition(jdd, site, type.id, { qte: 5 })
      await chaineFixe(jdd, site, [{ id: rep3.id, version: rep3.version }], { expedier: false }) // colis ouvert
      const rep4 = await ligneRepartition(jdd, site, type.id, { qte: 5 })
      exiger(
        await appelUnitaire(jdd, site, 'colisage', {
          lignes: [{ id: rep4.id, version: rep4.version }],
        }),
        'colisage seul',
      ) // UM « En cours », pas encore en colis
    }
    // Couverture : chaque statut est présent sur ce site.
    const { db } = jdd.ctx
    const p = site.plateforme.id
    const presents = {
      reception: new Set(
        (await db.reception.findMany({ where: { plateformeId: p }, select: { statut: true } })).map(
          (x) => x.statut,
        ),
      ),
      affiche: new Set(
        (await db.affiche.findMany({ where: { plateformeId: p }, select: { statut: true } })).map(
          (x) => x.statut,
        ),
      ),
      ligne: new Set(
        (
          await db.receptionAttendue.findMany({
            where: { plateformeId: p },
            select: { statut: true, etatLigne: true },
          })
        ).flatMap((x) => [x.statut, x.etatLigne === 'ANNULEE' ? 'ANNULEE' : x.statut]),
      ),
      face: new Set(
        (
          await db.faceTrain.findMany({
            where: { atelier: { plateformeId: p } },
            select: { statut: true },
          })
        ).map((x) => x.statut),
      ),
      instruction: new Set(
        (
          await db.instruction.findMany({
            where: { atelier: { plateformeId: p } },
            select: { statut: true },
          })
        ).map((x) => x.statut),
      ),
      um: new Set(
        (
          await db.uniteManutention.findMany({
            where: { atelier: { plateformeId: p } },
            select: { statut: true },
          })
        ).map((x) => x.statut),
      ),
      colis: new Set(
        (await db.colis.findMany({ where: { plateformeId: p }, select: { statut: true } })).map(
          (x) => x.statut,
        ),
      ),
    }
    const attendus: [string, Set<string>, string[]][] = [
      ['réception', presents.reception, ['A_IDENTIFIER', 'A_CONTROLER', 'CONTROLEE']],
      ['affiche', presents.affiche, ['IDENTIFIEE', 'ORPHELINE']],
      [
        'ligne attendue',
        presents.ligne,
        ['ATTENDUE', 'PARTIELLE', 'COMPLETE', 'SURPLUS', 'ANNULEE'],
      ],
      [
        'face de train',
        presents.face,
        [
          'A_TRAITER',
          'EN_COURS',
          'INSTRUCTION_OK',
          'ERREUR',
          'ANNULE',
          'A_IMPRIMER',
          'PREPARE',
          'A_EXPEDIER',
          'TERMINE',
          'EXPORT_PREPA',
          'AU_ROULAGE',
        ],
      ],
      [
        'instruction',
        presents.instruction,
        ['A_TRAITER', 'EN_COURS', 'INSTRUCTION_OK', 'ERREUR', 'ANNULE', 'PRET_A_PRODUIRE'],
      ],
      ['colis', presents.colis, ['EN_COURS', 'A_EXPEDIER', 'TERMINE']],
    ]
    for (const [nom, trouves, voulus] of attendus)
      for (const s of voulus)
        jdd.verifier(`statut ${nom} « ${s} » présent`, trouves.has(s), s, [...trouves].join(','))
    const dossiers = new Set(
      (
        await db.dossier.findMany({
          where: { instructions: { some: { atelier: { plateformeId: p } } } },
          select: { statut: true },
        })
      ).map((x) => x.statut),
    )
    const annules = await db.receptionAttendue.count({
      where: { plateformeId: p, etatLigne: 'ANNULEE' },
    })
    jdd.verifier('statut dossier « ANNULE » (lignes annulées)', annules > 0, '> 0', String(annules))
    for (const s of ['A_TRAITER', 'PREPARATION_RECUE'])
      jdd.verifier(
        `statut dossier « ${s} » présent`,
        dossiers.has(s as never),
        s,
        [...dossiers].join(','),
      )
    jdd.verifier(
      'statut UM « EN_COURS » présent',
      presents.um.has('EN_COURS'),
      'EN_COURS',
      [...presents.um].join(','),
    )
  },
}
