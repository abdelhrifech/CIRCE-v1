// Données E2E (base de TEST) ; avec `--demo` : mêmes données fictives chargées dans la base de DEV (`pnpm seed:demo`,
// appelé par `pnpm start:all`) pour pouvoir essayer l'application. Toute autre base est refusée.
// Données E2E (base de TEST uniquement) : utilisateur e2e.recep (rôle recep) et lignes attendues d'une
// plateforme neuve. Valeurs fictives, sans donnée personnelle. Les statuts sont produits par les vrais
// services (mouvements + rattachements → recalcul RG-REC-018), jamais écrits à la main.
// Relançable : chaque exécution crée une nouvelle plateforme et y déplace le périmètre de l'utilisateur.
import { resolve } from 'node:path'
import { formatSemaineIso, lundiSemaineIso, semaineIsoDe } from '@circe/shared'
import { createDb } from '../src/core/db.ts'
import type { Identity } from '../src/core/identity.ts'
import { BroadcastNonConfigure } from '../src/core/ports/broadcast.ts'
import { lancerPassage } from '../src/modules/coordination/integration-broadcast.ts'
import { rattacher } from '../src/modules/reception/rattachement.ts'
import { enregistrerMouvement } from '../src/modules/reception/stock.ts'
import { seedRef } from '../src/reference/seed-ref.ts'

const demo = process.argv.includes('--demo')
process.loadEnvFile(resolve(import.meta.dirname, demo ? '../../../.env' : '../../../.env.test'))
const url = process.env['DATABASE_URL'] ?? ''
if (!url.endsWith(demo ? 'dev.db' : 'test.db')) {
  console.error(`Refus : ${url} n'est pas la base ${demo ? 'de dev' : 'de test'}.`)
  process.exit(1)
}

const db = createDb(url)
try {
  await seedRef(db)
  if (
    demo &&
    (await db.plateforme.count({ where: { nom: { startsWith: 'Plateforme E2E' } } })) > 0
  ) {
    console.log('Données de démo déjà présentes dans la base de dev : rien à faire.')
    process.exit(0)
  }
  const plateforme = await db.plateforme.create({ data: { nom: `Plateforme E2E ${Date.now()}` } })
  const support = await db.categorieSupport.create({ data: { nom: '2m2' } })
  const role = await db.role.findUniqueOrThrow({ where: { code: 'recep' } })
  const user = await db.utilisateur.upsert({
    where: { identifiantExterne: 'e2e.recep' },
    update: { actif: true },
    create: { identifiantExterne: 'e2e.recep', nom: 'Agent E2E' },
  })
  await db.utilisateurRole.deleteMany({ where: { utilisateurId: user.id } })
  await db.utilisateurRole.create({ data: { utilisateurId: user.id, roleId: role.id } })
  await db.utilisateurPerimetre.deleteMany({ where: { utilisateurId: user.id } })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: user.id, plateformeId: plateforme.id },
  })
  const identity: Identity = {
    userId: user.id,
    identifiantExterne: user.identifiantExterne,
    nom: user.nom,
    roles: ['recep'],
    perimetre: {
      toutesPlateformes: false,
      plateformeIds: [plateforme.id],
      lignes: [{ plateformeId: plateforme.id, atelierId: null }],
    },
    siteId: null,
  }

  const s = semaineIsoDe(new Date())
  const passe = semaineIsoDe(new Date(Date.now() - 14 * 86_400_000))
  const lignes = [
    {
      contNum: 900001,
      idDaChapeau: 800001,
      annonceur: 'Annonceur Alpha',
      theme: 'Thème A1',
      semaine: s,
      recu: 0,
    },
    {
      contNum: 900002,
      idDaChapeau: 800002,
      annonceur: 'Annonceur Bêta',
      theme: 'Thème B1',
      semaine: s,
      recu: 4,
    },
    {
      contNum: 900003,
      idDaChapeau: 800003,
      annonceur: 'Annonceur Gamma',
      theme: 'Thème C1',
      semaine: s,
      recu: 10,
    },
    {
      contNum: 900004,
      idDaChapeau: 800004,
      annonceur: 'Annonceur Delta',
      theme: 'Thème D1',
      semaine: passe,
      recu: 0,
    },
    // REC-P04 à P10 : lignes dédiées (départ passé : masquées par défaut, atteintes par ?depart=tous&q=).
    {
      contNum: 900005,
      idDaChapeau: 800005,
      annonceur: 'Annonceur Epsilon',
      theme: 'Thème E1',
      semaine: passe,
      recu: 0,
    },
    {
      contNum: 900006,
      idDaChapeau: 800006,
      annonceur: 'Annonceur Zêta',
      theme: 'Thème Z1',
      semaine: passe,
      recu: 0,
    },
    {
      contNum: 900007,
      idDaChapeau: 800007,
      annonceur: 'Annonceur Êta',
      theme: 'Thème H1',
      semaine: passe,
      recu: 0,
    },
  ]
  // Référentiels du bon de livraison (RG-REC-035) : valeurs fictives propres aux E2E.
  if (!(await db.imprimeur.findFirst({ where: { libelle: 'Imprimeur E2E' } }))) {
    await db.imprimeur.create({ data: { libelle: 'Imprimeur E2E' } })
  }
  if (!(await db.livreur.findFirst({ where: { libelle: 'Transporteur E2E' } }))) {
    await db.livreur.create({ data: { libelle: 'Transporteur E2E' } })
  }
  const reception = await db.reception.create({
    data: { plateformeId: plateforme.id, statut: 'A_CONTROLER' },
  })
  for (const l of lignes) {
    const ligne = await db.receptionAttendue.create({
      data: {
        contNum: l.contNum,
        idDaChapeau: l.idDaChapeau,
        annonceur: l.annonceur,
        theme: l.theme,
        themeCle: l.theme.toUpperCase(),
        plateformeId: plateforme.id,
        supportId: support.id,
        format: '2m2',
        semAnnee: l.semaine.annee,
        semNum: l.semaine.semaine,
        source: 'BC',
        qteBc: 10,
      },
    })
    if (l.recu > 0) {
      const affiche = await db.affiche.create({
        data: {
          plateformeId: plateforme.id,
          supportId: support.id,
          receptionId: reception.id,
          statut: 'ORPHELINE',
          dateEntree: new Date(),
          conservation: 20,
          quantite: 0,
          contNum: l.contNum,
          theme: l.theme,
        },
      })
      await db.$transaction(async (tx) => {
        await enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'RECEPTION',
          quantite: l.recu,
          receptionId: reception.id,
        })
        await rattacher(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          ligneAttendueId: ligne.id,
          quantite: l.recu,
          mode: 'BL',
        })
      })
    }
  }
  // COO-P01 : utilisateur e2e.coord (rôle coord, même site) et dossiers de Coordination propres à ce run
  // (n° de dossier et codes d'instruction uniques : la base de test garde les runs précédents).
  const roleCoord = await db.role.findUniqueOrThrow({ where: { code: 'coord' } })
  const coord = await db.utilisateur.upsert({
    where: { identifiantExterne: 'e2e.coord' },
    update: { actif: true },
    create: { identifiantExterne: 'e2e.coord', nom: 'Coordination E2E' },
  })
  await db.utilisateurRole.deleteMany({ where: { utilisateurId: coord.id } })
  await db.utilisateurRole.create({ data: { utilisateurId: coord.id, roleId: roleCoord.id } })
  await db.utilisateurPerimetre.deleteMany({ where: { utilisateurId: coord.id } })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: coord.id, plateformeId: plateforme.id },
  })
  const atelier = await db.atelier.create({
    data: { plateformeId: plateforme.id, libelle: '2 m² déroulant E2E', type: 'SCROLL' },
  })
  const run = Date.now() % 90000
  const dossierOk = await db.dossier.create({
    data: {
      contNum: 910000 + run,
      annonceur: 'Annonceur Coordination E2E',
      statut: 'PREPARATION_RECUE',
    },
  })
  // ÉTAPE 7 (interactions Réception ↔ Coordination) : un dossier de Coordination et sa ligne attendue (départ
  // passé : masquée par défaut côté Réception), reçue en E2E par l'interface Réception puis validée / annulée /
  // retirée côté Coordination (e2e/interactions.spec.ts).
  const contInteractions = 1_100_000 + run
  await db.dossier.create({
    data: {
      contNum: contInteractions,
      annonceur: 'Annonceur Interactions E2E',
      statut: 'PREPARATION_RECUE',
    },
  })
  await db.receptionAttendue.create({
    data: {
      contNum: contInteractions,
      idDaChapeau: 840000 + run,
      annonceur: 'Annonceur Interactions E2E',
      theme: 'Thème interactions',
      themeCle: 'THÈME INTERACTIONS',
      plateformeId: plateforme.id,
      supportId: support.id,
      format: '2m2',
      semAnnee: passe.annee,
      semNum: passe.semaine,
      source: 'BC',
      qteBc: 10,
    },
  })
  const commun = {
    dossierId: dossierOk.id,
    atelierId: atelier.id,
    contNum: dossierOk.contNum,
    contAnbas: s.annee,
    contSembas: s.semaine,
    typeInstruction: 'contrat',
  }
  const iok = await db.instruction.create({
    data: { ...commun, code: `E2EIOK${String(run)}`, statut: 'INSTRUCTION_OK' },
  })
  await db.instruction.create({
    data: { ...commun, code: `E2EENC${String(run)}`, statut: 'EN_COURS' },
  })
  for (const ftType of ['contrat', 'entretien']) {
    await db.faceTrain.create({
      data: {
        instructionCode: iok.code,
        statut: 'INSTRUCTION_OK',
        ftType,
        cadrIdent: run,
        dateDepart: new Date(),
        theme: 'Thème E2E',
        trainId: 'T-E2E',
        atelierId: atelier.id,
      },
    })
  }
  await db.dossier.create({
    data: {
      contNum: 920000 + run,
      annonceur: 'Annonceur Annulé E2E',
      statut: 'ANNULE',
      instructions: {
        create: {
          ...commun,
          dossierId: undefined,
          contNum: 920000 + run,
          code: `E2EANN${String(run)}`,
          statut: 'EN_COURS',
        },
      },
    },
  })
  // COO-P02 : Instruction OK après contrôle (commentaire, 100 %), répartition à 90 %, écart Broadcast / Circé.
  async function dossierCoo(
    contNum: number,
    annonceur: string,
    code: string,
    commentaire: string | null,
    pcts: number[],
  ) {
    const dossier = await db.dossier.create({
      data: { contNum, annonceur, statut: 'PREPARATION_RECUE' },
    })
    await db.instruction.create({
      data: {
        ...commun,
        dossierId: dossier.id,
        contNum,
        code,
        statut: 'EN_COURS',
        commentaire,
        entretien: 8,
        tipInsCode: 0,
      },
    })
    for (const p of pcts)
      await db.instructionVisuel.create({
        data: {
          instructionCode: code,
          pourcentage: p,
          pourcentageOri: p,
          theme: `Thème ${String(p)} %`,
        },
      })
    return dossier
  }
  await dossierCoo(
    930000 + run,
    'Annonceur Contrôle E2E',
    `E2EIOC${String(run)}`,
    'Visuel B en début de train, à la demande du client',
    [100],
  )
  await dossierCoo(
    940000 + run,
    'Annonceur Répartition E2E',
    `E2EREP${String(run)}`,
    'à vérifier',
    [60, 30],
  )
  const ecart = await dossierCoo(
    950000 + run,
    'Annonceur Écart E2E',
    `E2EECA${String(run)}`,
    null,
    [100],
  )
  await db.receptionAttendue.create({
    data: {
      contNum: ecart.contNum,
      annonceur: 'Annonceur Écart E2E',
      theme: 'Thème écart',
      themeCle: 'THEME ECART',
      plateformeId: plateforme.id,
      supportId: support.id,
      format: '2m2',
      semAnnee: passe.annee,
      semNum: passe.semaine,
      source: 'PREPA',
      qteBc: 10,
      qtePrepa: 8,
    },
  })
  // COO-P03 : validation admin, sur un 2e site du périmètre de e2e.coord seulement (les écrans Réception
  // de e2e.recep ne changent pas). Affiches reçues par les vrais services (mouvement + rattachement) :
  // « Cas sûr » = une affiche en mode BL (proposée, pré-cochée) ; « Doute » = une BL + une MAIN (doute).
  const siteVa = await db.plateforme.create({ data: { nom: `Plateforme E2E VA ${Date.now()}` } })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: coord.id, plateformeId: siteVa.id },
  })
  const receptionVa = await db.reception.create({
    data: { plateformeId: siteVa.id, statut: 'A_CONTROLER' },
  })
  const agentVa: Identity = {
    ...identity,
    perimetre: {
      toutesPlateformes: false,
      plateformeIds: [siteVa.id],
      lignes: [{ plateformeId: siteVa.id, atelierId: null }],
    },
  }
  async function dossierValidation(
    contNum: number,
    annonceur: string,
    theme: string,
    modes: ('BL' | 'MAIN')[],
  ) {
    await db.dossier.create({ data: { contNum, annonceur, statut: 'A_TRAITER' } })
    const ligne = await db.receptionAttendue.create({
      data: {
        contNum,
        annonceur,
        theme,
        themeCle: theme.toUpperCase(),
        plateformeId: siteVa.id,
        supportId: support.id,
        format: '2m2',
        semAnnee: s.annee,
        semNum: s.semaine,
        source: 'BC',
        qteBc: 10,
      },
    })
    for (const mode of modes) {
      const affiche = await db.affiche.create({
        data: {
          plateformeId: siteVa.id,
          supportId: support.id,
          receptionId: receptionVa.id,
          statut: 'ORPHELINE',
          dateEntree: new Date(),
          conservation: 20,
          quantite: 0,
          contNum,
          theme,
        },
      })
      await db.$transaction(async (tx) => {
        await enregistrerMouvement(tx, agentVa, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'RECEPTION',
          quantite: 3,
          receptionId: receptionVa.id,
        })
        await rattacher(tx, agentVa, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          ligneAttendueId: ligne.id,
          quantite: 3,
          mode,
        })
      })
    }
  }
  await dossierValidation(960000 + run, 'Annonceur Cas sûr E2E', 'Thème sûr', ['BL'])
  await dossierValidation(970000 + run, 'Annonceur Doute E2E', 'Thème doute', ['BL', 'MAIN'])
  // COO-P04 : « Valider » / « Annuler la validation » par affiche (une affiche à doute : jamais pré-cochée).
  await dossierValidation(980000 + run, 'Annonceur Unitaire E2E', 'Thème unitaire', ['MAIN'])
  // COO-P04 (RG-X-051 / RG-COO-017, ECR-REC-04) : une réception inconnue à rattacher par la Coordination, et
  // une ligne du dossier « Annonceur Inconnue E2E » sur le même site.
  const contInconnue = 990000 + run
  await db.dossier.create({
    data: { contNum: contInconnue, annonceur: 'Annonceur Inconnue E2E', statut: 'A_TRAITER' },
  })
  await db.receptionAttendue.create({
    data: {
      contNum: contInconnue,
      annonceur: 'Annonceur Inconnue E2E',
      theme: 'Thème inconnue',
      themeCle: 'THÈME INCONNUE',
      plateformeId: siteVa.id,
      supportId: support.id,
      format: '2m2',
      semAnnee: s.annee,
      semNum: s.semaine,
      source: 'BC',
      qteBc: 10,
    },
  })
  const receptionInconnue = await db.reception.create({
    data: { plateformeId: siteVa.id, statut: 'A_IDENTIFIER', estInconnue: true },
  })
  const orpheline = await db.affiche.create({
    data: {
      plateformeId: siteVa.id,
      supportId: support.id,
      receptionId: receptionInconnue.id,
      statut: 'ORPHELINE',
      dateEntree: new Date(),
      conservation: 20,
      quantite: 0,
      contAnnonc: 'Inconnue Coord E2E',
      theme: 'Lu sur l’affiche',
      typeFeuille: 'TEMPORAIRE',
      allee: 'X',
      rayon: '9',
    },
  })
  await db.$transaction((tx) =>
    enregistrerMouvement(tx, agentVa, {
      permission: 'reception.valider',
      afficheId: orpheline.id,
      type: 'RECEPTION',
      quantite: 5,
      receptionId: receptionInconnue.id,
    }),
  )
  // COO-P05 (ECR-PIL-03, RG-COO-101 / 107) : un site géré par Broadcast (site CCF) du périmètre de e2e.coord ;
  // lignes produites par la vraie lecture de l'état des réservations : un dossier sur deux semaines
  // (quantité comptée une fois) et un dossier avant IP (visuel provisoire).
  const idSiteCcf = 100_000 + run
  const siteEdr = await db.plateforme.create({
    data: { nom: `Plateforme E2E EDR ${Date.now()}`, idSiteCcf },
  })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: coord.id, plateformeId: siteEdr.id },
  })
  await db.correspondanceSupport.create({
    data: { idSurface: 70_000 + run, idFormat: 1, supportId: support.id },
  })
  const s1 = semaineIsoDe(new Date(Date.now() + 7 * 86_400_000))
  const lueEdr = (contNum: number, annonceur: string, theme: string | null, semaine = s) => ({
    idSiteCcf,
    destinataire: 'Afficheur E2E',
    contNum,
    annonceur,
    idSurface: 70_000 + run,
    idFormat: 1,
    idTheme: null,
    theme,
    idThemeBandeau: null,
    idDaChapeau: null,
    semaine,
    quantite: 100,
    estResteEnPlace: false,
    statutPreparation: null,
    idPreparationChapeau: null,
    idTypePreparation: null,
    surface: null,
    format: null,
    bandeau: null,
    assistantCommercial: null,
    assistantLogistique: null,
  })
  // COO-P06 : les lignes passent par le passage d'intégration (flux « état des réservations », lot déposé).
  const passage = await lancerPassage(
    { db, broadcast: new BroadcastNonConfigure() },
    {
      declencheur: 'LOT',
      identity: null,
      lot: {
        idInterface: 1,
        lectureComplete: false,
        lueLe: new Date(),
        etatReservations: [
          lueEdr(1_910_000 + run, 'Annonceur EDR Multi E2E', 'Thème multi', s),
          lueEdr(1_910_000 + run, 'Annonceur EDR Multi E2E', 'Thème multi', s1),
          lueEdr(1_920_000 + run, 'Annonceur EDR Provisoire E2E', null),
          // COO-P06 : dossier à n° fixe du périmètre de e2e.coord (« Rafraîchir un dossier », RG-COO-132).
          lueEdr(1_900_001, 'Annonceur Rafraîchir E2E', 'Thème rafraîchir'),
        ],
      },
    },
  )
  if (passage.statut !== 'SUCCES')
    throw new Error(`Passage d'intégration E2E : ${passage.message ?? ''}`)

  // COO-P07 (ECR-TRA-01, ECR-THM-01 / 03) : un site du périmètre de e2e.coord ; une affiche dont le thème a
  // changé dans Broadcast après la validation (RG-COO-068), et trois couples de thèmes proches (RG-COO-069).
  // Les données P07 des runs précédents sont fermées (dossiers annulés) pour ne pas se mêler à ce run.
  const NOMS_P07 = [
    'Annonceur TBC E2E',
    'Boulangerie Kzwxq E2E',
    'Garage Pltrv E2E',
    'Cinéma Hjqsd E2E',
    'Annonceur Fiche TBC E2E',
  ]
  await db.receptionAttendue.updateMany({
    where: { annonceur: { in: NOMS_P07 }, etatLigne: 'ACTIVE' },
    data: { etatLigne: 'ANNULEE' },
  })
  await db.dossier.updateMany({
    where: { annonceur: { in: NOMS_P07 } },
    data: { statut: 'ANNULE' },
  })
  const siteThm = await db.plateforme.create({ data: { nom: `Plateforme E2E THM ${Date.now()}` } })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: coord.id, plateformeId: siteThm.id },
  })
  const ligneP07 = async (contNum: number, annonceur: string, theme: string) => {
    await db.dossier.upsert({
      where: { contNum },
      create: { contNum, annonceur, statut: 'PREPARATION_RECUE' },
      update: { annonceur, statut: 'PREPARATION_RECUE' },
    })
    return db.receptionAttendue.create({
      data: {
        contNum,
        annonceur,
        theme,
        themeCle: theme.toUpperCase(),
        plateformeId: siteThm.id,
        supportId: support.id,
        format: '2m2',
        semAnnee: s1.annee,
        semNum: s1.semaine,
        source: 'PREPA',
        qteBc: 10,
        qtePrepa: 10,
      },
    })
  }
  const tbc = await ligneP07(2_010_000 + run, 'Annonceur TBC E2E', 'Thème Broadcast E2E')
  const afficheTbc = await db.affiche.create({
    data: {
      plateformeId: siteThm.id,
      supportId: support.id,
      statut: 'IDENTIFIEE',
      dateEntree: new Date(),
      conservation: 20,
      quantite: 5,
      contNum: tbc.contNum,
      theme: 'Thème Circé E2E',
      themeModifie: true,
    },
  })
  await db.afficheAttendue.create({
    data: { afficheId: afficheTbc.id, ligneAttendueId: tbc.id, quantite: 5, mode: 'BL' },
  })
  // ECR-COO-02 : fiche dossier avec « Thème modifié dans Broadcast » et « thème proche à vérifier ».
  const fiche = await ligneP07(2_080_000 + run, 'Annonceur Fiche TBC E2E', 'Thème fiche E2E')
  const afficheFiche = await db.affiche.create({
    data: {
      plateformeId: siteThm.id,
      supportId: support.id,
      statut: 'IDENTIFIEE',
      dateEntree: new Date(),
      conservation: 20,
      quantite: 5,
      contNum: fiche.contNum,
      theme: 'Ancien fiche E2E',
      themeModifie: true,
    },
  })
  await db.afficheAttendue.create({
    data: { afficheId: afficheFiche.id, ligneAttendueId: fiche.id, quantite: 5, mode: 'BL' },
  })
  await ligneP07(2_090_000 + run, 'Annonceur Fiche TBC E2E', 'THÈME FICHE E2E')
  await ligneP07(2_020_000 + run, 'Boulangerie Kzwxq E2E', 'Pain de campagne')
  await ligneP07(2_030_000 + run, 'Boulangerie Kzwxq E2E', 'PAIN DE CAMPAGNE !')
  await ligneP07(2_040_000 + run, 'Garage Pltrv E2E', 'Révision hiver')
  await ligneP07(2_050_000 + run, 'Garage Pltrv E2E', 'Revision hiver 2026')
  for (const [contNum, theme] of [
    [2_060_000 + run, 'Avant-première'],
    [2_070_000 + run, 'AVANT PREMIERE'],
  ] as const) {
    await ligneP07(contNum, 'Cinéma Hjqsd E2E', theme)
    // Production lancée sur les deux dossiers : « Rien à demander » (RG-COO-069).
    await db.instruction.create({
      data: { code: `E2EP07${String(contNum)}`, contNum, statut: 'PRET_A_PRODUIRE' },
    })
  }
  // COO-P08 (déblocage, « Rendre la main ») : un site Broadcast du périmètre de e2e.coord, un atelier fixe avec
  // une règle d'inclusion (RG-COO-141) ; dossier 2190001 : groupe débloquable ; dossier 2190002 : groupe dont
  // une UM est « Préparé » (RG-COO-143). Les données des runs précédents de ces dossiers sont retirées.
  const DOSSIERS_P08 = [2_190_001, 2_190_002]
  const anciennes = await db.repartition.findMany({
    where: { contNum: { in: DOSSIERS_P08 } },
    select: { id: true, uniteId: true },
  })
  await db.repartition.deleteMany({ where: { id: { in: anciennes.map((r) => r.id) } } })
  await db.uniteManutention.deleteMany({
    where: { id: { in: anciennes.map((r) => r.uniteId).filter((u): u is number => u !== null) } },
  })
  await db.prepaBroadcast.deleteMany({ where: { idDossierDeVenteChapeau: { in: DOSSIERS_P08 } } })
  const idSiteDeb = 110_000 + run
  const siteDeb = await db.plateforme.create({
    data: {
      nom: `Plateforme E2E DEB ${Date.now()}`,
      idSiteCcf: idSiteDeb,
      mail: 'preprod@e2e.test',
    },
  })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: coord.id, plateformeId: siteDeb.id },
  })
  const atelierDeb = await db.atelier.create({
    data: { plateformeId: siteDeb.id, libelle: 'Atelier E2E DEB', type: 'FIXE' },
  })
  await db.atelierDroitPrepa.create({
    data: { atelierId: atelierDeb.id, typePreparationId: null, surfaceId: null, exclusion: false },
  })
  const typeDeb = await db.typePreparation.create({ data: { libelle: '2 m² fixe E2E' } })
  for (const [i, contNum] of DOSSIERS_P08.entries()) {
    await db.prepaBroadcast.create({
      data: {
        idPreparationChapeau: 5_000 + i,
        idDossierDeVenteChapeau: contNum,
        idSiteCcf: idSiteDeb,
        idTypePreparation: typeDeb.id,
        annonceur: i === 0 ? 'Annonceur Déblocage E2E' : 'Annonceur Bloqué E2E',
        surface: '2 m²',
        semAnnee: s1.annee,
        semNum: s1.semaine,
        quantite: 20,
      },
    })
    const um =
      i === 1
        ? await db.uniteManutention.create({
            data: {
              statut: 'PREPARE',
              atelierId: atelierDeb.id,
              contNum,
              codeBarre: `UM-E2E-DEB-${String(run)}`,
            },
          })
        : null
    for (const qte of [12, 8])
      await db.repartition.create({
        data: {
          statut: 'A_TRAITER',
          atelierId: atelierDeb.id,
          contNum,
          semAnnee: s1.annee,
          semNum: s1.semaine,
          typePreparationId: typeDeb.id,
          idGroupePreparation: 7_000 + run * 2 + i,
          annonceur: i === 0 ? 'Annonceur Déblocage E2E' : 'Annonceur Bloqué E2E',
          qte,
          uniteId: um?.id ?? null,
        },
      })
  }

  // COO-P09 (ECR-COO-05, trains) : un site du périmètre de e2e.coord, un atelier déroulant ; départ S+1.
  // Train « Fractionnable » (dossiers 2190101 reçu + 2190102 manquant : EN_ATTENTE), train « Complet » (2190101
  // seul : PRET) et un visuel du dossier 2190103 à raccrocher. Faces et lignes des runs précédents retirées.
  const DOSSIERS_P09 = [2_190_101, 2_190_102, 2_190_103]
  const anciennesFaces = await db.faceTrain.findMany({
    where: { contNum: { in: DOSSIERS_P09 } },
    select: { id: true, instructionCode: true },
  })
  await db.faceTrain.deleteMany({ where: { id: { in: anciennesFaces.map((x) => x.id) } } })
  const anciennesInstr = await db.instruction.findMany({
    where: { contNum: { in: DOSSIERS_P09 } },
    select: { code: true },
  })
  await db.instructionVisuel.deleteMany({
    where: { instructionCode: { in: anciennesInstr.map((x) => x.code) } },
  })
  await db.faceTrain.deleteMany({
    where: { instructionCode: { in: anciennesInstr.map((x) => x.code) } },
  })
  await db.instruction.deleteMany({ where: { code: { in: anciennesInstr.map((x) => x.code) } } })
  const liensP09 = await db.afficheAttendue.findMany({
    where: { ligneAttendue: { contNum: { in: DOSSIERS_P09 } } },
    select: { id: true },
  })
  await db.afficheAttendue.updateMany({
    where: { id: { in: liensP09.map((x) => x.id) } },
    data: { actif: false },
  })
  const siteTrn = await db.plateforme.create({ data: { nom: `Plateforme E2E TRN ${Date.now()}` } })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: coord.id, plateformeId: siteTrn.id },
  })
  const atelierTrn = await db.atelier.create({
    data: { plateformeId: siteTrn.id, libelle: 'Déroulant E2E', type: 'SCROLL' },
  })
  const supportTrn = await db.categorieSupport.create({ data: { nom: `2 m² E2E ${String(run)}` } })
  const destTrn = await db.destinataire.create({
    data: { nomOrigine: 'Destinataire E2E TRN', nom: 'Destinataire E2E TRN' },
  })
  const instrTrn = new Map<number, string>()
  for (const contNum of DOSSIERS_P09) {
    const dossier = await db.dossier.upsert({
      where: { contNum },
      update: { statut: 'PREPARATION_RECUE' },
      create: {
        contNum,
        annonceur: `Annonceur Train ${String(contNum)}`,
        statut: 'PREPARATION_RECUE',
      },
    })
    const code = `E2ET${String(run).padStart(5, '0')}${String(contNum)}`.slice(0, 18)
    await db.instruction.create({
      data: {
        code,
        dossierId: dossier.id,
        atelierId: atelierTrn.id,
        contNum,
        annonceur: `Annonceur Train ${String(contNum)}`,
        contAnbas: s1.annee,
        contSembas: s1.semaine,
        statut: 'INSTRUCTION_OK',
      },
    })
    instrTrn.set(contNum, code)
  }
  await db.instructionVisuel.create({
    data: {
      instructionCode: instrTrn.get(2_190_103) ?? '',
      theme: 'Visuel à raccrocher E2E',
      afchIdent: 3,
      pourcentage: 100,
    },
  })
  const departTrn = new Date(lundiSemaineIso(s1).getTime() + 86_400_000 + 16.5 * 3_600_000)
  const faceTrn = (trainId: string, contNum: number, theme: string, ordre: number) =>
    db.faceTrain.create({
      data: {
        instructionCode: instrTrn.get(contNum) ?? '',
        statut: 'INSTRUCTION_OK',
        atelierId: atelierTrn.id,
        supportId: supportTrn.id,
        destinataireId: destTrn.id,
        cadrIdent: ordre,
        dateDepart: departTrn,
        contNum,
        contAnnonc: `Annonceur Train ${String(contNum)}`,
        contAnbas: s1.annee,
        contSembas: s1.semaine,
        depAnbas: s1.annee,
        depSembas: s1.semaine,
        trainId,
        theme,
        ordreReel: ordre,
        afficheurNom: 'Afficheur E2E',
        refPanel: '123456',
      },
    })
  const tFrac = `E2E-FRAC-${String(run)}`
  await faceTrn(tFrac, 2_190_101, 'Thème reçu E2E', 1)
  await faceTrn(tFrac, 2_190_102, 'Thème manquant E2E', 2)
  await faceTrn(`E2E-PRET-${String(run)}`, 2_190_101, 'Thème reçu E2E', 1)
  const ligneTrn = await db.receptionAttendue.create({
    data: {
      plateformeId: siteTrn.id,
      supportId: supportTrn.id,
      contNum: 2_190_101,
      theme: 'Thème reçu E2E',
      themeCle: 'THEME RECU E2E',
      semNum: s1.semaine,
      semAnnee: s1.annee,
      source: 'PREPA',
      qtePrepa: 5,
    },
  })
  const afficheTrn = await db.affiche.create({
    data: {
      plateformeId: siteTrn.id,
      supportId: supportTrn.id,
      statut: 'IDENTIFIEE',
      dateEntree: new Date(),
      conservation: 20,
      quantite: 5,
      contNum: 2_190_101,
      theme: 'Thème reçu E2E',
      allee: 'T',
      rayon: '9',
    },
  })
  await db.afficheAttendue.create({
    data: { afficheId: afficheTrn.id, ligneAttendueId: ligneTrn.id, quantite: 5, mode: 'BL' },
  })

  // COO-P10 (export des trains, suivi par thème, préparation, générateur) : site « EXP » du périmètre de e2e.coord,
  // un atelier déroulant, un rouleur. Train « Exportable » (dossiers 2190201 et 2190202, Instruction OK MANUEL),
  // dossier « En cours » 2190203, train « Prêt » (dossier 2190204, faces « A imprimer », visuel reçu).
  const DOSSIERS_P10 = [2_190_201, 2_190_202, 2_190_203, 2_190_204]
  const instrP10 = await db.instruction.findMany({
    where: { contNum: { in: DOSSIERS_P10 } },
    select: { code: true },
  })
  await db.faceTrain.deleteMany({ where: { instructionCode: { in: instrP10.map((x) => x.code) } } })
  await db.faceTrain.deleteMany({ where: { contNum: { in: DOSSIERS_P10 } } })
  await db.instruction.deleteMany({ where: { code: { in: instrP10.map((x) => x.code) } } })
  const liensP10 = await db.afficheAttendue.findMany({
    where: { ligneAttendue: { contNum: { in: DOSSIERS_P10 } } },
    select: { id: true },
  })
  await db.afficheAttendue.updateMany({
    where: { id: { in: liensP10.map((x) => x.id) } },
    data: { actif: false },
  })
  await db.receptionAttendue.updateMany({
    where: { contNum: { in: DOSSIERS_P10 }, etatLigne: 'ACTIVE' },
    data: { etatLigne: 'ANNULEE' },
  })
  const siteExp = await db.plateforme.create({ data: { nom: `Plateforme E2E EXP ${Date.now()}` } })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: coord.id, plateformeId: siteExp.id },
  })
  const atelierExp = await db.atelier.create({
    data: { plateformeId: siteExp.id, libelle: 'Déroulant Export E2E', type: 'SCROLL' },
  })
  await db.rouleur.create({ data: { atelierId: atelierExp.id, nom: 'Rouleur E2E' } })
  const supportExp = await db.categorieSupport.create({ data: { nom: `2 m² EXP ${String(run)}` } })
  const destExp = await db.destinataire.create({
    data: { nomOrigine: 'Destinataire E2E EXP', nom: 'Destinataire E2E EXP' },
  })
  const departExp = new Date(lundiSemaineIso(s1).getTime() + 86_400_000 + 16.5 * 3_600_000)
  const faceExp = async (
    contNum: number,
    trainId: string,
    theme: string,
    ordre: number,
    statut: 'INSTRUCTION_OK' | 'A_IMPRIMER' | 'EN_COURS',
    instructionStatut: 'INSTRUCTION_OK' | 'PRET_A_PRODUIRE' | 'EN_COURS',
  ) => {
    const dossier = await db.dossier.upsert({
      where: { contNum },
      update: { statut: 'PREPARATION_RECUE' },
      create: {
        contNum,
        annonceur: `Annonceur Export ${String(contNum)}`,
        statut: 'PREPARATION_RECUE',
      },
    })
    const code = `E2EX${String(run).padStart(4, '0')}${String(contNum)}`.slice(0, 18)
    await db.instruction.create({
      data: {
        code,
        dossierId: dossier.id,
        atelierId: atelierExp.id,
        contNum,
        annonceur: `Annonceur Export ${String(contNum)}`,
        contAnbas: s1.annee,
        contSembas: s1.semaine,
        statut: instructionStatut,
        iokMode: instructionStatut === 'EN_COURS' ? null : 'MANUEL',
      },
    })
    await db.faceTrain.create({
      data: {
        instructionCode: code,
        statut,
        atelierId: atelierExp.id,
        supportId: supportExp.id,
        destinataireId: destExp.id,
        cadrIdent: ordre,
        dateDepart: departExp,
        contNum,
        contAnnonc: `Annonceur Export ${String(contNum)}`,
        contAnbas: s1.annee,
        contSembas: s1.semaine,
        depAnbas: s1.annee,
        depSembas: s1.semaine,
        trainId,
        theme,
        ordreReel: ordre,
        afficheurNom: 'Afficheur Export E2E',
        emplAdresse1: 'Rue de l’Export',
        refPanel: '654321',
      },
    })
  }
  await faceExp(
    2_190_201,
    `E2E-EXP-${String(run)}`,
    'Thème export rose E2E',
    1,
    'INSTRUCTION_OK',
    'INSTRUCTION_OK',
  )
  await faceExp(
    2_190_202,
    `E2E-EXP-${String(run)}`,
    'Thème export gris E2E',
    2,
    'INSTRUCTION_OK',
    'INSTRUCTION_OK',
  )
  await faceExp(
    2_190_203,
    `E2E-ENC-${String(run)}`,
    'Thème en cours E2E',
    1,
    'EN_COURS',
    'EN_COURS',
  )
  await faceExp(
    2_190_204,
    `E2E-PRETX-${String(run)}`,
    'Thème prêt E2E',
    1,
    'A_IMPRIMER',
    'PRET_A_PRODUIRE',
  )
  const ligneExp = await db.receptionAttendue.create({
    data: {
      plateformeId: siteExp.id,
      supportId: supportExp.id,
      contNum: 2_190_204,
      theme: 'Thème prêt E2E',
      themeCle: 'THEME PRET E2E',
      semNum: s1.semaine,
      semAnnee: s1.annee,
      source: 'PREPA',
      qtePrepa: 3,
    },
  })
  const afficheExp = await db.affiche.create({
    data: {
      plateformeId: siteExp.id,
      supportId: supportExp.id,
      statut: 'IDENTIFIEE',
      dateEntree: new Date(),
      conservation: 20,
      quantite: 3,
      contNum: 2_190_204,
      theme: 'Thème prêt E2E',
      allee: 'X',
      rayon: '4',
    },
  })
  await db.afficheAttendue.create({
    data: { afficheId: afficheExp.id, ligneAttendueId: ligneExp.id, quantite: 3, mode: 'BL' },
  })

  // COO-P11 (dispatch du roulage, bagues, suivi 8 m²) : site « ROU » du seul périmètre de e2e.chef (rôle cheq), un
  // atelier déroulant déclaré atelier 8 m² (paramètre `suivi8m2.ateliers`), deux rouleurs, quatre trains « Prêts »
  // (dossiers 2190301 à 2190304 : faces « A imprimer », visuels reçus, emplacement R-5). Départ S+1.
  const DOSSIERS_P11 = [2_190_301, 2_190_302, 2_190_303, 2_190_304]
  const instrP11 = await db.instruction.findMany({
    where: { contNum: { in: DOSSIERS_P11 } },
    select: { code: true },
  })
  await db.faceTrain.deleteMany({ where: { contNum: { in: DOSSIERS_P11 } } })
  await db.instruction.deleteMany({ where: { code: { in: instrP11.map((x) => x.code) } } })
  const liensP11 = await db.afficheAttendue.findMany({
    where: { ligneAttendue: { contNum: { in: DOSSIERS_P11 } } },
    select: { id: true },
  })
  await db.afficheAttendue.updateMany({
    where: { id: { in: liensP11.map((x) => x.id) } },
    data: { actif: false },
  })
  await db.receptionAttendue.updateMany({
    where: { contNum: { in: DOSSIERS_P11 }, etatLigne: 'ACTIVE' },
    data: { etatLigne: 'ANNULEE' },
  })
  const siteRou = await db.plateforme.create({ data: { nom: `Plateforme E2E ROU ${Date.now()}` } })
  const roleCheq = await db.role.findUniqueOrThrow({ where: { code: 'cheq' } })
  const chef = await db.utilisateur.upsert({
    where: { identifiantExterne: 'e2e.chef' },
    update: { actif: true },
    create: { identifiantExterne: 'e2e.chef', nom: "Chef d'équipe E2E" },
  })
  await db.utilisateurRole.deleteMany({ where: { utilisateurId: chef.id } })
  await db.utilisateurRole.create({ data: { utilisateurId: chef.id, roleId: roleCheq.id } })
  await db.utilisateurPerimetre.deleteMany({ where: { utilisateurId: chef.id } })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: chef.id, plateformeId: siteRou.id },
  })
  const atelierRou = await db.atelier.create({
    data: { plateformeId: siteRou.id, libelle: 'Déroulant Roulage E2E', type: 'SCROLL' },
  })
  const paramRou = await db.parametre.findFirst({
    where: { cle: 'suivi8m2.ateliers', plateformeId: null },
  })
  if (paramRou) {
    await db.parametre.update({
      where: { id: paramRou.id },
      data: { valeur: String(atelierRou.id) },
    })
  } else {
    await db.parametre.create({ data: { cle: 'suivi8m2.ateliers', valeur: String(atelierRou.id) } })
  }
  await db.rouleur.create({
    data: { atelierId: atelierRou.id, nom: 'Rouleur R1 E2E', poste: 'Table 1' },
  })
  await db.rouleur.create({
    data: { atelierId: atelierRou.id, nom: 'Rouleur R2 E2E', poste: 'Table 2' },
  })
  const supportRou = await db.categorieSupport.create({ data: { nom: `8 m² ROU ${String(run)}` } })
  const destRou = await db.destinataire.create({
    data: { nomOrigine: 'Destinataire E2E ROU', nom: 'Destinataire E2E ROU' },
  })
  const departRou = new Date(lundiSemaineIso(s1).getTime() + 86_400_000 + 16.5 * 3_600_000)
  const THEMES_ROU: [number, string, string][] = [
    [2_190_301, 'A', 'Thème roulage A'],
    [2_190_302, 'B', 'Thème roulage B'],
    [2_190_303, 'C', 'Thème roulage C'],
    [2_190_304, 'D', 'Thème roulage D'],
  ]
  for (const [contNum, lettre, theme] of THEMES_ROU) {
    const dossier = await db.dossier.upsert({
      where: { contNum },
      update: { statut: 'PREPARATION_RECUE' },
      create: {
        contNum,
        annonceur: `Annonceur Roulage ${lettre}`,
        statut: 'PREPARATION_RECUE',
      },
    })
    const code = `E2ER${String(run).padStart(5, '0')}${String(contNum)}`.slice(0, 18)
    await db.instruction.create({
      data: {
        code,
        dossierId: dossier.id,
        atelierId: atelierRou.id,
        contNum,
        annonceur: `Annonceur Roulage ${lettre}`,
        contAnbas: s1.annee,
        contSembas: s1.semaine,
        statut: 'PRET_A_PRODUIRE',
        iokMode: 'MANUEL',
      },
    })
    await db.faceTrain.create({
      data: {
        instructionCode: code,
        statut: 'A_IMPRIMER',
        atelierId: atelierRou.id,
        supportId: supportRou.id,
        destinataireId: destRou.id,
        cadrIdent: 1,
        dateDepart: departRou,
        contNum,
        contAnnonc: `Annonceur Roulage ${lettre}`,
        contAnbas: s1.annee,
        contSembas: s1.semaine,
        depAnbas: s1.annee,
        depSembas: s1.semaine,
        trainId: `E2E-ROU-${lettre}-${String(run)}`,
        theme,
        ordreReel: 1,
        afficheurNom: 'Afficheur Roulage E2E',
        refPanel: '777000',
      },
    })
    const ligne = await db.receptionAttendue.create({
      data: {
        plateformeId: siteRou.id,
        supportId: supportRou.id,
        contNum,
        theme,
        themeCle: theme.toUpperCase(),
        semNum: s1.semaine,
        semAnnee: s1.annee,
        source: 'PREPA',
        qtePrepa: 3,
      },
    })
    const affiche = await db.affiche.create({
      data: {
        plateformeId: siteRou.id,
        supportId: supportRou.id,
        statut: 'IDENTIFIEE',
        dateEntree: new Date(),
        conservation: 20,
        quantite: 3,
        contNum,
        theme,
        allee: 'R',
        rayon: '5',
      },
    })
    await db.afficheAttendue.create({
      data: { afficheId: affiche.id, ligneAttendueId: ligne.id, quantite: 3, mode: 'BL' },
    })
  }

  // COO-P12 (préparation 2 m² fixe / pliage / bus, ECR-COO-09) : site « UNI » du périmètre de e2e.coord (rôle coord),
  // un atelier fixe, trois types de préparation (paramètres `unitaire.typesPliage` / `unitaire.typesBus`, Q-319),
  // des répartitions et UM pour chaque action : dossiers 2190401 (quantité, intitulé), 2190402 (préparer),
  // 2190403 (retirer), 2190404 (rendre la main), 2190405 (comptage du pliage), 2190406 (bus, quantités à encoller).
  const siteUni = await db.plateforme.create({
    data: { nom: `Plateforme E2E UNI ${String(Date.now())}`, mail: 'preprod-uni@e2e.test' },
  })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: coord.id, plateformeId: siteUni.id },
  })
  const atelierUni = await db.atelier.create({
    data: { plateformeId: siteUni.id, libelle: 'Fixe E2E UNI', type: 'FIXE' },
  })
  const supportUni = await db.categorieSupport.create({ data: { nom: `2 m² UNI ${String(run)}` } })
  const [typeFixeUni, typePliageUni, typeBusUni] = await Promise.all(
    ['2 m² fixe', 'Pliage', 'Bus'].map((libelle) =>
      db.typePreparation.create({ data: { libelle } }),
    ),
  )
  for (const [cle, valeur] of [
    ['unitaire.typesPliage', String(typePliageUni?.id)],
    ['unitaire.typesBus', String(typeBusUni?.id)],
  ] as const) {
    const existant = await db.parametre.findFirst({ where: { cle, plateformeId: null } })
    if (existant) await db.parametre.update({ where: { id: existant.id }, data: { valeur } })
    else await db.parametre.create({ data: { cle, valeur } })
  }
  const destUniA = await db.destinataire.create({
    data: { nomOrigine: 'Destinataire UNI A', nom: 'Destinataire UNI A' },
  })
  const destUniBus = await db.destinataire.create({
    data: { nomOrigine: 'Centre bus UNI', nom: 'Centre bus UNI' },
  })
  const lignesUni: [number, 'typeFixe' | 'typePliage' | 'typeBus', string, number, boolean][] = [
    [2_190_401, 'typeFixe', 'Thème unitaire E2E', 20, false],
    [2_190_402, 'typeFixe', 'Thème à préparer E2E', 10, true],
    [2_190_403, 'typeFixe', 'Thème à retirer E2E', 10, true],
    [2_190_404, 'typeFixe', 'Thème à rendre E2E', 10, true],
    [2_190_405, 'typePliage', 'Thème pliage E2E', 20, true],
    [2_190_406, 'typeBus', 'Thème bus E2E', 100, false],
  ]
  const typesUni = { typeFixe: typeFixeUni, typePliage: typePliageUni, typeBus: typeBusUni }
  for (const [contNum, type, theme, qte, avecUm] of lignesUni) {
    await db.dossier.upsert({
      where: { contNum },
      update: { statut: 'PREPARATION_RECUE' },
      create: { contNum, annonceur: 'Annonceur Unitaire E2E', statut: 'PREPARATION_RECUE' },
    })
    const um = avecUm
      ? await db.uniteManutention.create({
          data: {
            atelierId: atelierUni.id,
            statut: 'EN_COURS',
            codeBarre: `E2E-UNI-${String(run)}-${String(contNum)}`,
          },
        })
      : null
    await db.repartition.create({
      data: {
        atelierId: atelierUni.id,
        typePreparationId: typesUni[type]?.id ?? null,
        supportId: supportUni.id,
        destinataireId: type === 'typeBus' ? destUniBus.id : destUniA.id,
        contNum,
        theme,
        annonceur: 'Annonceur Unitaire E2E',
        qte,
        statut: avecUm ? 'EN_COURS' : 'A_TRAITER',
        semAnnee: s1.annee,
        semNum: s1.semaine,
        uniteId: um?.id ?? null,
      },
    })
  }

  // Étape 8 (Q-265 option (c), RG-COO-240 à 242, 260 à 262) : un 2e atelier FIXE « Fixe E2E LIB » du site UNI (libération
  // de la semaine S+1 propre à cet atelier, donc sans effet sur les autres écrans), un support de 10 par UM (la ligne
  // de 25 affiches du dossier 2190407 donne 3 UM au Colisage) et une ligne « à libérer » (statut A traiter).
  const atelierLib = await db.atelier.create({
    data: { plateformeId: siteUni.id, libelle: 'Fixe E2E LIB', type: 'FIXE' },
  })
  const supportLib = await db.categorieSupport.create({
    data: { nom: `2 m² LIB ${String(run)}`, poids: 2, qteUm: 10 },
  })
  await db.dossier.upsert({
    where: { contNum: 2_190_407 },
    update: { statut: 'PREPARATION_RECUE' },
    create: {
      contNum: 2_190_407,
      annonceur: 'Annonceur Libération E2E',
      statut: 'PREPARATION_RECUE',
    },
  })
  await db.repartition.create({
    data: {
      atelierId: atelierLib.id,
      typePreparationId: typeFixeUni?.id ?? null,
      supportId: supportLib.id,
      destinataireId: destUniA.id,
      contNum: 2_190_407,
      theme: 'Thème libération E2E',
      annonceur: 'Annonceur Libération E2E',
      qte: 25,
      statut: 'A_TRAITER',
      semAnnee: s1.annee,
      semNum: s1.semaine,
    },
  })

  // D-05 (référentiel des destinataires, ECR-ADM-07) : utilisateur e2e.admin (rôle admin) et deux destinataires.
  const roleAdmin = await db.role.findUniqueOrThrow({ where: { code: 'admin' } })
  const adminE2e = await db.utilisateur.upsert({
    where: { identifiantExterne: 'e2e.admin' },
    update: { actif: true },
    create: { identifiantExterne: 'e2e.admin', nom: 'Administrateur E2E' },
  })
  await db.utilisateurRole.deleteMany({ where: { utilisateurId: adminE2e.id } })
  await db.utilisateurRole.create({ data: { utilisateurId: adminE2e.id, roleId: roleAdmin.id } })
  for (const nomOrigine of ['Destinataire ADM A', 'Destinataire ADM B'])
    await db.destinataire.upsert({
      where: { id: (await db.destinataire.findFirst({ where: { nomOrigine } }))?.id ?? 0 },
      update: { actif: true, dispatch: null, nom: null },
      create: { nomOrigine },
    })

  // ECR-NAV-01 (e2e/navigation.spec.ts) : profils de dev `dev.<rôle>` de la base de TEST (sélecteur de profil du bandeau,
  // cookie lu par le relais web), un par rôle, périmètre = la plateforme principale (l'administrateur voit tout).
  for (const code of ['coord', 'cheq', 'recep', 'expe', 'admin', 'com'] as const) {
    const roleDev = await db.role.findUniqueOrThrow({ where: { code } })
    const userDev = await db.utilisateur.upsert({
      where: { identifiantExterne: `dev.${code}` },
      update: { actif: true },
      create: { identifiantExterne: `dev.${code}`, nom: `Profil de dev ${code}` },
    })
    await db.utilisateurRole.deleteMany({ where: { utilisateurId: userDev.id } })
    await db.utilisateurRole.create({ data: { utilisateurId: userDev.id, roleId: roleDev.id } })
    await db.utilisateurPerimetre.deleteMany({ where: { utilisateurId: userDev.id } })
    if (code !== 'admin')
      await db.utilisateurPerimetre.create({
        data: { utilisateurId: userDev.id, plateformeId: plateforme.id },
      })
  }

  // COO-P13 (colisage, expédition, fin de journée ; ECR-EXP-01 / ECR-EXP-02) : site « EXP » ajouté au périmètre de
  // e2e.chef (rôle cheq, droit `colis.gerer`), un atelier FIXE (aucun atelier déroulant : le dispatch et les bagues
  // de COO-P11 ne changent pas), un support de 2 kg, un destinataire, trois UM « En cours » (dossiers 2190501 :
  // colisage et retrait ; 2190502 : clôture, fin de journée et sortie de stock ; 2190503 : liste à coliser). Une
  // affiche de 10 reçue pour le dossier 2190502 (RG-X-087). Les UM et colis d'une exécution précédente sont supprimés.
  const DOSSIERS_P13 = [2_190_501, 2_190_502, 2_190_503]
  const umAnciennes = await db.uniteManutention.findMany({
    where: { contNum: { in: DOSSIERS_P13 } },
    select: { id: true },
  })
  const umAncIds = umAnciennes.map((x) => x.id)
  const colisAnciens = await db.uniteColis.findMany({
    where: { uniteId: { in: umAncIds } },
    select: { colisId: true },
  })
  await db.uniteColis.deleteMany({ where: { uniteId: { in: umAncIds } } })
  await db.colis.deleteMany({ where: { id: { in: colisAnciens.map((x) => x.colisId) } } })
  await db.uniteManutention.deleteMany({ where: { id: { in: umAncIds } } })
  const siteColisE2e = await db.plateforme.create({
    data: { nom: `Plateforme E2E EXP ${String(Date.now())}` },
  })
  await db.utilisateurPerimetre.create({
    data: { utilisateurId: chef.id, plateformeId: siteColisE2e.id },
  })
  const atelierColisE2e = await db.atelier.create({
    data: { plateformeId: siteColisE2e.id, libelle: 'Fixe E2E EXP', type: 'FIXE' },
  })
  const supportColisE2e = await db.categorieSupport.create({
    data: { nom: `2 m² EXP ${String(run)}`, poids: 2 },
  })
  const destColisE2e = await db.destinataire.create({
    data: { nomOrigine: 'Destinataire EXP A', nom: 'Destinataire EXP A' },
  })
  const lignesColisE2e: [number, string, number][] = [
    [2_190_501, 'Thème colis E2E', 6],
    [2_190_502, 'Thème expédition E2E', 4],
    [2_190_503, 'Thème à coliser E2E', 3],
  ]
  for (const [contNum, theme, qte] of lignesColisE2e) {
    await db.uniteManutention.create({
      data: {
        atelierId: atelierColisE2e.id,
        supportId: supportColisE2e.id,
        destinataireId: destColisE2e.id,
        statut: 'EN_COURS',
        codeBarre: `UM-E2E-${String(contNum).slice(-3)}`,
        contNum,
        theme,
        annonceur: 'Annonceur Expédition E2E',
        qte,
        semAnnee: s1.annee,
        semNum: s1.semaine,
      },
    })
  }
  const afficheColisE2e = await db.affiche.create({
    data: {
      plateformeId: siteColisE2e.id,
      supportId: supportColisE2e.id,
      statut: 'IDENTIFIEE',
      dateEntree: new Date(),
      conservation: 20,
      quantite: 10,
      contNum: 2_190_502,
      theme: 'Thème expédition E2E',
    },
  })
  await db.mouvement.create({
    data: { afficheId: afficheColisE2e.id, type: 'RECEPTION', date: new Date(), quantite: 10 },
  })

  console.log(
    `E2E : plateforme ${plateforme.id}, ${lignes.length} lignes (${formatSemaineIso(s)}, ${formatSemaineIso(passe)}), utilisateur e2e.recep`,
  )
} finally {
  await db.$disconnect()
}
