// COO-P10 — tests d'INTÉGRATION des corrections de l'audit (API sur la base de test ; aucun test unitaire) :
//  B1 fichier d'export SIMULÉ marqué partout (nom, résultat, lot, historique, journal) — Q-193 (1), D-15 ;
//  B2 / B3 envoi à la machine : voir suivi-generation.int.test.ts et export-trains-complement.int.test.ts ;
//  m2 générateur : recherche côté API et visuels pour le compteur « n / 20 tiroirs » (ECR-GEN-01) ;
//  m6 historiques : lecture par paquets, un site n'est pas noyé par les lots des autres (RG-COO-167) ;
//  m7 CSV : « Section » = nom d'origine du destinataire (legacy DestNomOri) ;
//  m8 identifiants de règle sur les 403 de RG-COO-219 / 220 ; m9 export préparation sur une seule semaine.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  ExportFichierSchema,
  ExportResultatSchema,
  HistoriqueExportsSchema,
  TrainsGenerationSchema,
  lundiSemaineIso,
  semaineIsoDe,
  formatSemaineIso,
} from '@circe/shared'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'
import {
  DEPART_TXT,
  envoyer,
  parametre,
  recu,
  restaurerParametres,
  SEM,
  siteDeroulant,
  trainExportable,
  versions,
  type SiteD,
} from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
afterEach(restaurerParametres)

const site = () => siteDeroulant(ctx)
const faceDe = (id: number) => db.faceTrain.findUniqueOrThrow({ where: { id } })
const semaineDans = (n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(SEM).getTime() + n * 7 * 86_400_000))
const exporter = (s: SiteD, depart = DEPART_TXT, simulation = false) =>
  envoyer(ctx, '/api/coordination/trains/export', s.users.coord.headers, { depart, simulation })
const prepa = (s: SiteD, trains: { trainId: string; version: string }[]) =>
  envoyer(ctx, '/api/coordination/trains/export-preparation', s.users.cheq.headers, { trains })

describe('COO-P10 audit B1 : le fichier d’export est SIMULÉ et marqué comme tel (Q-193 (1), D-15)', () => {
  it('RG-COO-213 export réel : résultat, nom du fichier, lot et journal portent « simulé » ; la simulation d’export (fonctionnelle) est distincte du fichier simulé', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'])
    const simu = await exporter(s, DEPART_TXT, true)
    expect(simu.statusCode, simu.body).toBe(200)
    const simulation = ExportResultatSchema.parse(simu.json())
    // « Simulation export » = fonctionnelle (aucun statut modifié) ; le fichier, lui, est simulé dans tous les cas.
    expect(simulation).toMatchObject({ simulation: true, fichierSimule: true })
    expect(simulation.nomFichier).toMatch(/^SimulationExportTrainsCIRCEversSurf\d{17}_SIMULE\.csv$/)
    expect(simulation.message).toContain('aucun statut modifié')
    expect(simulation.message).toContain('Fichier SIMULÉ')
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')

    const r = await exporter(s)
    expect(r.statusCode, r.body).toBe(200)
    const reel = ExportResultatSchema.parse(r.json())
    expect(reel).toMatchObject({ simulation: false, fichierSimule: true })
    expect(reel.nomFichier).toMatch(/^ExportTrainsCIRCEversSurf\d{17}_SIMULE\.csv$/)
    expect(reel.message).toContain('non déposé ni transmis à Surf (D-15)')
    // Le lot l'enregistre, l'historique le restitue, le journal le dit.
    const lot = await db.exportTrains.findUniqueOrThrow({ where: { id: reel.lot } })
    expect(lot.fichierSimule).toBe(true)
    const h = await get(
      ctx,
      `/api/coordination/trains/export/historique?depart=${DEPART_TXT}`,
      s.users.coord.headers,
    )
    const ligne = HistoriqueExportsSchema.parse(h.json()).exports.find((e) => e.id === reel.lot)
    expect(ligne).toMatchObject({ simulation: false, fichierSimule: true })
    const journal = await db.journalAudit.findFirstOrThrow({
      where: { typeEntite: 'EXPORT_TRAINS', entiteId: String(reel.lot), action: 'EXPORTER_TRAINS' },
    })
    expect(journal.nouvelleValeur).toContain('fichier simulé, non déposé, D-15')
    // Le téléchargement rend le même nom marqué.
    const f = await get(
      ctx,
      `/api/coordination/trains/export/${String(reel.lot)}/fichier`,
      s.users.coord.headers,
    )
    expect(ExportFichierSchema.parse(f.json()).nomFichier).toBe(reel.nomFichier)
  })

  it('RG-COO-215 export préparation : fichier Caire simulé (nom, lot, journal du lot et des trains) et refus d’une sélection sur plusieurs semaines (audit m9)', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const r = await prepa(s, await versions(ctx, s.users.coord.headers, [t.trainId]))
    expect(r.statusCode, r.body).toBe(200)
    const res = ExportResultatSchema.parse(r.json())
    expect(res.fichierSimule).toBe(true)
    expect(res.nomFichier).toMatch(/^ExportPrepaTrainsCIRCE\d{17}_SIMULE\.csv$/)
    expect(
      (
        await db.journalAudit.findFirstOrThrow({
          where: { typeEntite: 'EXPORT_TRAINS', entiteId: String(res.lot) },
        })
      ).nouvelleValeur,
    ).toContain('fichier simulé, non déposé, D-15')

    // m9 : deux trains de semaines de départ différentes : refus 422, aucune face modifiée.
    const a = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    const b = await trainExportable(ctx, s, ['Bleu'], {
      statut: 'A_IMPRIMER',
      semaine: semaineDans(1),
    })
    const lots = await db.exportTrains.count()
    const refus = await prepa(s, [
      ...(await versions(ctx, s.users.coord.headers, [a.trainId])),
      ...(await versions(ctx, s.users.coord.headers, [b.trainId])),
    ])
    expect(refus.statusCode, refus.body).toBe(422)
    expect(erreur(refus)).toMatchObject({
      code: 'COO_EXPORT_PREPA_MULTI_SEMAINES',
      regle: 'RG-COO-215',
    })
    expect((await faceDe(a.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(b.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect(await db.exportTrains.count()).toBe(lots)
  })

  it('RG-COO-213 audit m7 : « Section » du CSV = nom d’origine du destinataire (legacy DestNomOri), pas son nom d’affichage', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'])
    const r = await exporter(s)
    const csv = ExportResultatSchema.parse(r.json()).contenu
    const dest = await db.destinataire.findUniqueOrThrow({ where: { id: s.destinataire.id } })
    expect(dest.nom).not.toBe(dest.nomOrigine)
    expect(csv).toContain(dest.nomOrigine)
    expect(csv).not.toContain(dest.nom ?? '')
  })
})

describe('COO-P10 audit m6 : historiques lus par paquets (RG-COO-167), un site n’est pas noyé par les lots des autres', () => {
  it('RG-COO-167 l’historique des exports et celui des générations restent complets pour le site, derrière plus de 200 lots d’autres sites', async () => {
    const A = await site()
    const B = await site()
    const sem = semaineDans(3)
    const depart = formatSemaineIso(sem)
    await trainExportable(ctx, A, ['Rose'], { semaine: sem })
    const propre = ExportResultatSchema.parse((await exporter(A, depart)).json())
    // Génération du site A (train prêt, semaine d'essai).
    const g = await trainExportable(ctx, A, ['Gris'], { statut: 'A_IMPRIMER', semaine: sem })
    await recu(ctx, A, g.faces[0]?.contNum ?? 0, 'Gris', 1)
    const propreGen = await envoyer(ctx, '/api/coordination/generateur', A.users.cheq.headers, {
      depart,
      trains: await versions(ctx, A.users.coord.headers, [g.trainId]),
    })
    expect(propreGen.statusCode, propreGen.body).toBe(200)
    const idGen = propreGen.json<{ id: number }>().id
    // 210 lots d'export et de génération plus récents, tous d'un autre site (périmètre : atelier de B).
    const ateIdsB = JSON.stringify([B.atelier.id])
    await db.exportTrains.createMany({
      data: Array.from({ length: 210 }, () => ({
        depAnnee: sem.annee,
        depSemaine: sem.semaine,
        nature: 'EXPORT_TRAINS',
        simulation: false,
        nomFichier: 'autre-site.csv',
        contenu: '',
        nbDossiers: 1,
        nbTrains: 1,
        nbFaces: 1,
        parId: B.users.coord.id,
        ateIds: ateIdsB,
      })),
    })
    const numero = Date.now()
    await db.generationFichiers.createMany({
      data: Array.from({ length: 210 }, (_, k) => ({
        lot: `Z-${String(numero)}-${String(k)}`,
        depAnnee: sem.annee,
        depSemaine: sem.semaine,
        trains: '[]',
        nbTrains: 1,
        nbTiroirs: 1,
        nomFichier: 'autre-site',
        contenu: '',
        statut: 'PREPARE',
        parId: B.users.coord.id,
        ateIds: ateIdsB,
      })),
    })
    const h = await get(
      ctx,
      `/api/coordination/trains/export/historique?depart=${depart}`,
      A.users.coord.headers,
    )
    const exports = HistoriqueExportsSchema.parse(h.json()).exports
    expect(exports.map((e) => e.id)).toEqual([propre.lot])
    const gen = await get(
      ctx,
      `/api/coordination/generateur?depart=${depart}`,
      A.users.cheq.headers,
    )
    expect(TrainsGenerationSchema.parse(gen.json()).historique.map((x) => x.id)).toEqual([idGen])
    // Le site B ne voit que ses lots (jamais celui de A), dans la limite de 100 / 50 lignes.
    const hb = await get(
      ctx,
      `/api/coordination/trains/export/historique?depart=${depart}`,
      B.users.coord.headers,
    )
    const exportsB = HistoriqueExportsSchema.parse(hb.json()).exports
    expect(exportsB).toHaveLength(100)
    expect(exportsB.some((e) => e.id === propre.lot)).toBe(false)
  })
})

describe('COO-P10 audit m2 : générateur — recherche côté API et visuels du compteur « n / 20 tiroirs » (ECR-GEN-01)', () => {
  it('ECR-GEN-01 la recherche filtre côté API (train, destinataire, annonceur, thème, sans casse ni accents) ; chaque train porte ses visuels distincts (= tiroirs)', async () => {
    const s = await site()
    const t1 = await trainExportable(ctx, s, ['Rose Poudré', 'Gris'], {
      statut: 'A_IMPRIMER',
      annonceur: 'MISTRAL',
    })
    const t2 = await trainExportable(ctx, s, ['Bleu'], { statut: 'A_IMPRIMER', annonceur: 'ZEBRE' })
    for (const t of [t1, t2])
      for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
    const lire = async (qs = '') => {
      const r = await get(
        ctx,
        `/api/coordination/generateur?depart=${DEPART_TXT}${qs}`,
        s.users.cheq.headers,
      )
      expect(r.statusCode, r.body).toBe(200)
      return TrainsGenerationSchema.parse(r.json()).trains
    }
    const tous = (await lire()).filter((x) => [t1.trainId, t2.trainId].includes(x.trainId))
    expect(tous).toHaveLength(2)
    const un = tous.find((x) => x.trainId === t1.trainId)
    expect(un?.visuels).toHaveLength(2)
    expect(un?.tiroirs).toBe(un?.visuels.length)
    expect((await lire('&recherche=poudre')).map((x) => x.trainId)).toEqual([t1.trainId])
    expect((await lire('&recherche=zebre')).map((x) => x.trainId)).toEqual([t2.trainId])
    expect((await lire(`&recherche=${t2.trainId}`)).map((x) => x.trainId)).toEqual([t2.trainId])
    expect(await lire('&recherche=introuvable-xyz')).toEqual([])
    const vide = await get(
      ctx,
      `/api/coordination/generateur?depart=${DEPART_TXT}&recherche=`,
      s.users.cheq.headers,
    )
    expect(vide.statusCode).toBe(400)
  })
})

describe('COO-P10 audit m8 : les refus 403 de « Annuler thème » et « Débloquer semaine » citent leur règle', () => {
  it('RG-COO-219 / RG-COO-220 un chef d’équipe (sans le droit de changer le statut) reçoit 403 avec la règle de l’action', async () => {
    const s = await site()
    const annuler = await envoyer(
      ctx,
      '/api/coordination/trains/annuler-theme',
      s.users.cheq.headers,
      { atelierId: s.atelier.id, depart: DEPART_TXT, contNum: 1, theme: 'A' },
      idem(),
    )
    expect(annuler.statusCode).toBe(403)
    expect(erreur(annuler).regle).toBe('RG-COO-219')
    const debloquer = await envoyer(
      ctx,
      '/api/coordination/trains/debloquer-semaine',
      s.users.cheq.headers,
      { atelierId: s.atelier.id, depart: DEPART_TXT },
      idem(),
    )
    expect(debloquer.statusCode).toBe(403)
    expect(erreur(debloquer).regle).toBe('RG-COO-220')
  })
})
