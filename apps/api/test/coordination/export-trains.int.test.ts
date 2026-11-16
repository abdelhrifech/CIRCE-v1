// COO-P10 — tests d'INTÉGRATION de l'export des trains du jeudi (RG-COO-210 à 213), de l'export préparation
// (RG-COO-215, 216), de « Au roulage » et de la suppression d'un thème de l'export (RG-COO-217), du rouleur
// (RG-COO-236). Source de l'attendu : docs/COORDINATION_REGLES_METIER.md (règles citées), hypothèses Q-193,
// Q-251 à Q-254 ; CLAUDE.md §6 (400 validation, 403 permission, 409 transition / version, 422 règle, atomicité,
// idempotence). Le fichier est SIMULÉ (D-15, Q-193). RG-COO-214 (ordonnancement Paris) : Q-255 OUVERTE, non reprise.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ExportApercuSchema, ExportResultatSchema, HistoriqueExportsSchema } from '@circe/shared'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { contexteReception, erreur, get, idem, post } from '../support/reception.ts'
import {
  avecEchec,
  DEPART_TXT,
  envoyer,
  parametre,
  recu,
  restaurerParametres,
  ROLES,
  ROLES_SANS_ADMIN,
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
const exporter = (s: SiteD, simulation = false, headers = s.users.coord.headers) =>
  envoyer(ctx, '/api/coordination/trains/export', headers, { depart: DEPART_TXT, simulation })
const apercu = (s: SiteD, headers = s.users.coord.headers, depart = DEPART_TXT) =>
  get(ctx, `/api/coordination/trains/export/apercu?depart=${depart}`, headers)
const faceDe = (id: number) => db.faceTrain.findUniqueOrThrow({ where: { id } })
const lots = (s: SiteD) =>
  db.exportTrains.findMany({
    where: { parId: { in: Object.values(s.users).map((u) => u.id) } },
    orderBy: { id: 'asc' },
  })

// ───────────────────────── RG-COO-210 / 211 export des trains ─────────────────────────

describe('RG-COO-210 / 211 export des trains du jeudi', () => {
  it('RG-COO-210 nominal : faces « Instruction ok » → « A imprimer », instructions → « Prêt à produire », lot, tf_train_export, historiques, journal', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'])
    const r = await exporter(s)
    expect(r.statusCode, r.body).toBe(200)
    const res = ExportResultatSchema.parse(r.json())
    expect(res).toMatchObject({ simulation: false, dossiers: 2, trains: 1, faces: 2 })
    expect(res.message).toBe(
      '2 dossier(s) exporté(s) : leurs 2 face(s) passent « A imprimer », le go des plateformes. Fichier SIMULÉ : enregistré dans Circé et téléchargeable, non déposé ni transmis à Surf (D-15).',
    )
    // Audit B1 : le fichier est marqué SIMULÉ (nom, résultat, lot) : il ne passe jamais pour un fichier déposé.
    expect(res.fichierSimule).toBe(true)
    expect(res.nomFichier).toMatch(/^ExportTrainsCIRCEversSurf\d{17}_SIMULE\.csv$/)
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('A_IMPRIMER')
    for (const [k, i] of t.instructions.entries()) {
      const apres = await db.instruction.findUniqueOrThrow({ where: { code: i.code } })
      expect(apres.statut).toBe('PRET_A_PRODUIRE')
      expect(apres.exporteParId).toBe(s.users.coord.id)
      expect(apres.exporteLe).toBeInstanceOf(Date)
      expect(
        await db.statutHistorique.count({
          where: {
            typeEntite: 'INSTRUCTION',
            entiteId: i.code,
            nouveau: 'PRET_A_PRODUIRE',
            regle: 'RG-COO-210',
          },
        }),
      ).toBe(1)
      expect(
        await db.statutHistorique.count({
          where: {
            typeEntite: 'FACE_TRAIN',
            entiteId: String(t.faces[k]?.id),
            ancien: 'INSTRUCTION_OK',
            nouveau: 'A_IMPRIMER',
          },
        }),
      ).toBe(1)
      expect(
        await db.journalAudit.count({
          where: {
            typeEntite: 'DOSSIER',
            entiteId: String(t.dossiers[k]?.id),
            action: 'EXPORTER_TRAINS',
          },
        }),
      ).toBe(1)
    }
    const lot = await db.exportTrains.findUniqueOrThrow({
      where: { id: res.lot },
      include: { lignes: true },
    })
    expect(lot).toMatchObject({
      nature: 'EXPORT_TRAINS',
      simulation: false,
      nbDossiers: 2,
      nbFaces: 2,
    })
    expect(lot.lignes).toHaveLength(1)
    expect(lot.lignes[0]).toMatchObject({ trainId: t.trainId, nbContrats: 2 })
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'EXPORT_TRAINS',
          entiteId: String(res.lot),
          action: 'EXPORTER_TRAINS',
          parId: s.users.coord.id,
        },
      }),
    ).toBe(1)
  })

  it('RG-COO-211 rejet : seuls les dossiers en Instruction OK AUTO / MANUEL, non annulés, préparation reçue partent ; les autres restent intacts', async () => {
    const s = await site()
    const bon = await trainExportable(ctx, s, ['Rose'])
    const auto = await trainExportable(ctx, s, ['Auto'], { iokMode: 'AUTO' })
    const sansMode = await trainExportable(ctx, s, ['SansMode'], { iokMode: null })
    const prepaNonRecue = await trainExportable(ctx, s, ['Prepa'], { dossierStatut: 'A_TRAITER' })
    const annule = await trainExportable(ctx, s, ['Annule'], { dossierStatut: 'ANNULE' })
    const enCours = await trainExportable(ctx, s, ['EnCours'], { instructionStatut: 'EN_COURS' })
    const r = await exporter(s)
    expect(r.statusCode, r.body).toBe(200)
    expect(ExportResultatSchema.parse(r.json())).toMatchObject({ dossiers: 2, trains: 2, faces: 2 })
    for (const t of [bon, auto])
      expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    for (const t of [sansMode, prepaNonRecue, annule, enCours])
      expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    expect(
      (
        await db.instruction.findUniqueOrThrow({
          where: { code: sansMode.instructions[0]?.code ?? '' },
        })
      ).statut,
    ).toBe('INSTRUCTION_OK')
  })

  it('RG-COO-211 aperçu : dossiers exportables, déjà exportés et dossiers « En cours » listés (n’en partent pas)', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'])
    const enCours = await trainExportable(ctx, s, ['EnCours'], {
      statut: 'EN_COURS',
      instructionStatut: 'EN_COURS',
    })
    const avant = ExportApercuSchema.parse((await apercu(s)).json())
    expect(avant).toMatchObject({ dossiersExportables: 1, dejaExportes: 0, faces: 1, trains: 1 })
    expect(avant.dossiersEnCours).toEqual([
      { dossier: enCours.dossiers[0]?.contNum, annonceur: 'ANNONCEUR' },
    ])
    expect((await exporter(s)).statusCode).toBe(200)
    const apres = ExportApercuSchema.parse((await apercu(s)).json())
    expect(apres).toMatchObject({ dossiersExportables: 0, dejaExportes: 1, faces: 0 })
  })

  it('RG-COO-211 rejet : aucun dossier exportable → 422 « rien à exporter », aucun lot, aucun statut modifié', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'], { dossierStatut: 'A_TRAITER' })
    const r = await exporter(s)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_RIEN_A_EXPORTER', regle: 'RG-COO-211' })
    expect(await lots(s)).toHaveLength(0)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    expect((await exporter(s, true)).statusCode).toBe(422)
  })

  it('RG-X-083 l’export ne dépend ni de la validation admin ni de la réception complète : dossier sans affiche validée ni reçu → exporté, réception intacte', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'])
    await recu(ctx, s, t.dossiers[0]?.contNum ?? 0, 'Rose', 1)
    const compteurs = async () => [
      await db.affiche.count({ where: { contNum: t.dossiers[0]?.contNum ?? 0 } }),
      await db.mouvement.count(),
      await db.afficheAttendue.count({ where: { actif: true } }),
      await db.affiche.count({
        where: { validationAdmin: true, contNum: t.dossiers[0]?.contNum ?? 0 },
      }),
    ]
    const avant = await compteurs()
    expect((await exporter(s)).statusCode).toBe(200)
    expect(await compteurs()).toEqual(avant)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    // Et sans aucun reçu : l'export part aussi.
    const t2 = await trainExportable(ctx, s, ['Gris'])
    expect((await exporter(s)).statusCode).toBe(200)
    expect((await faceDe(t2.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })

  it('RG-COO-210 une face qui n’est pas « Instruction ok » (déjà A imprimer, en cours) n’est jamais ré-exportée ni rétrogradée', async () => {
    const s = await site()
    const dejaImprime = await trainExportable(ctx, s, ['Fait'], {
      statut: 'A_IMPRIMER',
      instructionStatut: 'PRET_A_PRODUIRE',
    })
    await trainExportable(ctx, s, ['Rose'])
    expect((await exporter(s)).statusCode).toBe(200)
    expect((await faceDe(dejaImprime.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'FACE_TRAIN', entiteId: String(dejaImprime.faces[0]?.id) },
      }),
    ).toBe(0)
  })

  it('RG-COO-167 périmètre : un coordinateur d’un autre site n’exporte rien (422) et ne touche pas les faces du site', async () => {
    const s = await site()
    const autre = await site()
    const t = await trainExportable(ctx, s, ['Rose'])
    const r = await exporter(s, false, autre.users.coord.headers)
    expect(r.statusCode).toBe(422)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    expect(
      ExportApercuSchema.parse((await apercu(s, autre.users.coord.headers)).json()).faces,
    ).toBe(0)
  })
})

// ───────────────────────── RG-COO-212 jalon du jeudi : réservé à la Coordination ─────────────────────────

describe('RG-COO-212 export réservé à la Coordination (service) ; aucun blocage horaire (Q-252)', () => {
  it.each(ROLES)('RG-COO-212 export et aperçu pour le rôle %s', async (role) => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'])
    const autorise = role === 'coord' || role === 'admin'
    expect((await apercu(s, s.users[role].headers)).statusCode).toBe(autorise ? 200 : 403)
    const r = await exporter(s, false, s.users[role].headers)
    expect(r.statusCode).toBe(autorise ? 200 : 403)
    if (!autorise) {
      expect(erreur(r).code).toBe('PERMISSION')
      expect(await lots(s)).toHaveLength(0)
    }
  })

  it('RG-COO-212 l’heure n’est pas contrôlée côté serveur : l’export réussit quel que soit le jour (HYPOTHÈSE Q-252)', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'])
    expect((await exporter(s)).statusCode).toBe(200)
  })

  it('RG-COO-212 sans identité : 401 ; sans Idempotency-Key : 400 ; départ inexistant ou mal formé : 400', async () => {
    const s = await site()
    expect(
      (
        await ctx.app.inject({
          method: 'GET',
          url: `/api/coordination/trains/export/apercu?depart=${DEPART_TXT}`,
        })
      ).statusCode,
    ).toBe(401)
    expect(
      (
        await post(
          ctx,
          '/api/coordination/trains/export',
          s.users.coord.headers,
          { depart: DEPART_TXT },
          false,
        )
      ).statusCode,
    ).toBe(400)
    for (const depart of ['2026-W54', '2026-W00', 'S43', '', '2027-W53'])
      expect(
        (await post(ctx, '/api/coordination/trains/export', s.users.coord.headers, { depart }))
          .statusCode,
        depart,
      ).toBe(400)
    expect((await apercu(s, s.users.coord.headers, '2026-W54')).statusCode).toBe(400)
  })
})

// ───────────────────────── RG-COO-213 fichier, simulation, erreurs visibles, atomicité ─────────────────────────

describe('RG-COO-213 fichier, tf_train_export, simulation, erreurs visibles', () => {
  it('RG-COO-213 simulation : même fichier, aucun statut ni tf_train_export, journal « simulation » ; l’export réel qui suit réussit', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'])
    const simu = ExportResultatSchema.parse((await exporter(s, true)).json())
    expect(simu.simulation).toBe(true)
    expect(simu.nomFichier).toMatch(/^SimulationExportTrainsCIRCEversSurf/)
    expect(simu.message).toContain('aucun statut modifié')
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('INSTRUCTION_OK')
    expect(await db.exportTrainLigne.count({ where: { exportId: simu.lot } })).toBe(0)
    expect(
      (await db.instruction.findUniqueOrThrow({ where: { code: t.instructions[0]?.code ?? '' } }))
        .exporteLe,
    ).toBeNull()
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'EXPORT_TRAINS',
          entiteId: String(simu.lot),
          action: 'SIMULATION_EXPORT_TRAINS',
        },
      }),
    ).toBe(1)
    const reel = ExportResultatSchema.parse((await exporter(s)).json())
    expect(reel.contenu).toBe(simu.contenu)
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('A_IMPRIMER')
  })

  it('RG-COO-213 fichier : une ligne par train (jusqu’à 6 contrats), champs de 30 caractères, caractères interdits retirés', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ["L'Été; 2026", 'Gris'], { annonceur: 'ANNO;NCEUR*' })
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    const lignes = res.contenu.split('\r\n').filter(Boolean)
    expect(lignes).toHaveLength(1)
    const c = (lignes[0] ?? '').split(';')
    expect(c[0]).toBe(t.trainId)
    expect(c[2]).toBe('2')
    expect(c[5]).toBe('3')
    expect(c[4]).toBe('AFFICHEUR SUD'.padEnd(30, ' '))
    expect(c[9]).toMatch(/^\(\d\) \d{4}-\d{2}-\d{2}\s*$/)
    expect(c[7]).toBe('Rue des Tests'.padEnd(30, ' '))
    expect(res.contenu).not.toMatch(/[*`’']/)
    expect(res.contenu).toContain('ANNONCEUR')
    // Contrat 1 : n° de dossier, réseau vide, annonceur, thème, repiquage.
    expect(c[11]).toBe(String(t.dossiers[0]?.contNum))
    expect(c[12]).toBe('')
    expect(c[13]).toBe('ANNONCEUR')
    expect(c[14]).toBe('LÉté 2026')
    expect(c.slice(11).length).toBe(2 * 5)
  })

  it('RG-COO-213 / Q-253 rejet : un train de plus de 6 contrats est une erreur d’export explicite (422) : aucun statut modifié, aucun lot', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    const r = await exporter(s)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_TRAIN_SUPERIEUR_A_6', regle: 'RG-COO-213' })
    expect(erreur(r).details).toMatchObject({ trains: [t.trainId] })
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('INSTRUCTION_OK')
    expect(await lots(s)).toHaveLength(0)
    // Le plafond suit le paramètre : 7 contrats acceptés si positionsMax = 7.
    await parametre(ctx, 'trains.positionsMax', '7')
    expect((await exporter(s)).statusCode).toBe(200)
  })

  it('RG-COO-213 atomicité : un échec d’écriture de tf_train_export annule tout (faces, instructions, lot, historiques, journal)', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'])
    const r = await avecEchec(ctx, 'BEFORE INSERT ON tf_train_export', () => exporter(s))
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    const i = await db.instruction.findUniqueOrThrow({
      where: { code: t.instructions[0]?.code ?? '' },
    })
    expect(i).toMatchObject({ statut: 'INSTRUCTION_OK', exporteLe: null })
    expect(await lots(s)).toHaveLength(0)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'FACE_TRAIN', entiteId: String(t.faces[0]?.id) },
      }),
    ).toBe(0)
    expect((await exporter(s)).statusCode).toBe(200)
  })

  it('RG-COO-213 atomicité : un échec de l’historique d’instruction en fin de transaction annule les faces déjà passées à « A imprimer »', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'])
    const r = await avecEchec(
      ctx,
      "BEFORE INSERT ON statut_historique WHEN NEW.type_entite = 'INSTRUCTION'",
      () => exporter(s),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('INSTRUCTION_OK')
    expect(await lots(s)).toHaveLength(0)
  })

  it('RG-COO-213 idempotence : même clé = même réponse, un seul lot ; autre corps avec la même clé : 409', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'])
    const cle = idem()
    const a = await envoyer(
      ctx,
      '/api/coordination/trains/export',
      s.users.coord.headers,
      { depart: DEPART_TXT },
      cle,
    )
    const b = await envoyer(
      ctx,
      '/api/coordination/trains/export',
      s.users.coord.headers,
      { depart: DEPART_TXT },
      cle,
    )
    expect(a.statusCode).toBe(200)
    expect(b.statusCode).toBe(200)
    expect(b.json()).toEqual(a.json())
    expect(await lots(s)).toHaveLength(1)
    const c = await envoyer(
      ctx,
      '/api/coordination/trains/export',
      s.users.coord.headers,
      { depart: DEPART_TXT, simulation: true },
      cle,
    )
    expect(c.statusCode).toBe(409)
    expect(erreur(c).code).toBe('COO_IDEMPOTENCE_CONFLIT')
  })

  it('RG-COO-213 / RG-COO-308 concurrence : deux exports simultanés (clés différentes) : un seul réussit, l’autre n’a plus rien à exporter, un seul lot', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'])
    const [a, b] = await Promise.all([exporter(s), exporter(s)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 422])
    expect(await lots(s)).toHaveLength(1)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(t.faces[0]?.id ?? 0)).version).toBe(2)
  })

  it('RG-COO-213 historique et téléchargement : lots listés (plus récent d’abord), fichier identique ; 404 / 403 / 400', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'])
    const simu = ExportResultatSchema.parse((await exporter(s, true)).json())
    const reel = ExportResultatSchema.parse((await exporter(s)).json())
    const h = HistoriqueExportsSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/trains/export/historique?depart=${DEPART_TXT}`,
          s.users.coord.headers,
        )
      ).json(),
    )
    const nostres = h.exports.filter((e) => [simu.lot, reel.lot].includes(e.id))
    expect(nostres.map((e) => e.id)).toEqual([reel.lot, simu.lot])
    expect(nostres[0]).toMatchObject({
      nature: 'EXPORT_TRAINS',
      simulation: false,
      depart: DEPART_TXT,
      dossiers: 1,
    })
    expect(nostres[0]?.par).toBeTruthy()
    const fichier = await get(
      ctx,
      `/api/coordination/trains/export/${String(reel.lot)}/fichier`,
      s.users.coord.headers,
    )
    expect(fichier.json()).toEqual({ nomFichier: reel.nomFichier, contenu: reel.contenu })
    expect(
      (await get(ctx, '/api/coordination/trains/export/99999999/fichier', s.users.coord.headers))
        .statusCode,
    ).toBe(404)
    expect(
      (
        await get(
          ctx,
          `/api/coordination/trains/export/${String(reel.lot)}/fichier`,
          s.users.cheq.headers,
        )
      ).statusCode,
    ).toBe(403)
    expect(
      (await get(ctx, '/api/coordination/trains/export/historique', s.users.cheq.headers))
        .statusCode,
    ).toBe(403)
    expect(
      (await get(ctx, '/api/coordination/trains/export/abc/fichier', s.users.coord.headers))
        .statusCode,
    ).toBe(400)
  })
})

// ───────────────────────── RG-COO-214 ordonnancement « Paris » ─────────────────────────

describe('RG-COO-214 ordonnancement Paris (Q-255 OUVERTE : non repris)', () => {
  it('RG-COO-214 les trains sont exportés sans recalcul d’ordre : ordre_reel et ordre_calcule inchangés', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'])
    expect((await exporter(s)).statusCode).toBe(200)
    for (const [k, face] of t.faces.entries()) {
      const apres = await faceDe(face.id)
      expect(apres.ordreReel).toBe(k + 1)
      expect(apres.ordreCalcule).toBeNull()
    }
  })
})

// ───────────────────────── RG-COO-215 / 216 export préparation ─────────────────────────

describe('RG-COO-215 / 216 export préparation (ateliers autorisés par paramètre, plafond de thèmes)', () => {
  const prepa = (
    s: SiteD,
    trains: { trainId: string; version: string }[],
    headers = s.users.cheq.headers,
  ) => envoyer(ctx, '/api/coordination/trains/export-preparation', headers, { trains })

  it('RG-COO-215 nominal : faces « A imprimer » → « Export prépa », fichier Caire simulé, lot, journal ; accepté pour coord et cheq', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', `${String(s.atelier.id)};999`)
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], {
      statut: 'A_IMPRIMER',
      instructionStatut: 'PRET_A_PRODUIRE',
    })
    const r = await prepa(s, await versions(ctx, s.users.coord.headers, [t.trainId]))
    expect(r.statusCode, r.body).toBe(200)
    const res = ExportResultatSchema.parse(r.json())
    expect(res.nomFichier).toMatch(/^ExportPrepaTrainsCIRCE\d{17}_SIMULE\.csv$/)
    expect(res).toMatchObject({ trains: 1, faces: 2, fichierSimule: true })
    expect(res.message).toBe(
      '2 face(s) passée(s) « Export prépa » (1 train(s)). Fichier SIMULÉ : enregistré dans Circé et téléchargeable, non déposé ni transmis à Surf (D-15).',
    )
    for (const face of t.faces) {
      expect((await faceDe(face.id)).statut).toBe('EXPORT_PREPA')
      expect(
        await db.statutHistorique.count({
          where: {
            typeEntite: 'FACE_TRAIN',
            entiteId: String(face.id),
            nouveau: 'EXPORT_PREPA',
            regle: 'RG-COO-215',
          },
        }),
      ).toBe(1)
    }
    expect((await db.exportTrains.findUniqueOrThrow({ where: { id: res.lot } })).nature).toBe(
      'EXPORT_PREPARATION',
    )
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'TRAIN', entiteId: t.trainId, action: 'EXPORT_PREPARATION' },
      }),
    ).toBe(1)
    // 2 m² : thème et repiquage dans le même champ (legacy FormateThemeRepiquage), une colonne de moins par contrat.
    expect((res.contenu.split(';').length - 11) % 4).toBe(0)
    const t2 = await trainExportable(ctx, s, ['Bleu'], { statut: 'A_IMPRIMER', repiquage: 'Rep' })
    const r2 = ExportResultatSchema.parse(
      (
        await prepa(
          s,
          await versions(ctx, s.users.coord.headers, [t2.trainId]),
          s.users.coord.headers,
        )
      ).json(),
    )
    expect(r2.contenu).toContain('Rep - Bleu')
  })

  it('RG-COO-215 rejet : un atelier qui n’est pas autorisé (paramètre) → 422, rien n’est modifié', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const r = await prepa(s, await versions(ctx, s.users.coord.headers, [t.trainId]))
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_EXPORT_PREPA_INTERDIT', regle: 'RG-COO-215' })
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect(await db.exportTrains.count({ where: { parId: s.users.cheq.id } })).toBe(0)
  })

  it("RG-COO-215 rejet : des faces qui ne sont pas « A imprimer » (Instruction ok, Au roulage) → 409 « Les faces des trains ne sont pas dans le statut 'A imprimer' ! »", async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    for (const statut of ['INSTRUCTION_OK', 'AU_ROULAGE', 'EN_COURS'] as const) {
      const t = await trainExportable(ctx, s, ['Rose'], { statut })
      const r = await prepa(
        s,
        await versions(ctx, s.users.coord.headers, [t.trainId]).catch(() => [
          { trainId: t.trainId, version: '1.1.1' },
        ]),
      )
      expect([404, 409], statut).toContain(r.statusCode)
      if (r.statusCode === 409) {
        expect(erreur(r).message).toBe(
          "Les faces des trains ne sont pas dans le statut 'A imprimer' !",
        )
        expect(erreur(r).regle).toBe('RG-COO-215')
      }
      expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe(statut)
    }
  })

  it('RG-COO-215 des faces déjà « Export prépa » acceptées avec des « A imprimer » : seules les premières changent', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const a = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const b = await trainExportable(ctx, s, ['Gris'], { statut: 'EXPORT_PREPA' })
    const r = await prepa(s, await versions(ctx, s.users.coord.headers, [a.trainId, b.trainId]))
    expect(r.statusCode, r.body).toBe(200)
    expect((await faceDe(a.faces[0]?.id ?? 0)).statut).toBe('EXPORT_PREPA')
    expect((await faceDe(b.faces[0]?.id ?? 0)).version).toBe(1)
  })

  it('RG-COO-216 plafond : 21 couples (thème, repiquage) → 422 « Le nombre de thèmes ajouté est supérieur à la capacité de la machine ! », aucune modification ; 20 acceptés', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    await parametre(ctx, 'trains.positionsMax', '25')
    const themes = Array.from({ length: 21 }, (_, k) => `Theme${String(k)}`)
    const t = await trainExportable(ctx, s, themes, { statut: 'A_IMPRIMER' })
    const r = await prepa(s, await versions(ctx, s.users.coord.headers, [t.trainId]))
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({
      code: 'COO_THEMES_SUPERIEUR_CAPACITE',
      regle: 'RG-COO-216',
      message: 'Le nombre de thèmes ajouté est supérieur à la capacité de la machine !',
    })
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('A_IMPRIMER')
    const vingt = await trainExportable(ctx, s, themes.slice(0, 20), { statut: 'A_IMPRIMER' })
    expect(
      (await prepa(s, await versions(ctx, s.users.coord.headers, [vingt.trainId]))).statusCode,
    ).toBe(200)
  })

  it('RG-COO-216 plafond : les faces déjà « Export prépa » de l’atelier et de la semaine comptent ; le plafond suit le paramètre', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    await parametre(ctx, 'trains.themesMaxExportPrepa', '3')
    await trainExportable(ctx, s, ['A', 'B'], { statut: 'EXPORT_PREPA' })
    const ok = await trainExportable(ctx, s, ['A'], { statut: 'A_IMPRIMER' })
    expect(
      (await prepa(s, await versions(ctx, s.users.coord.headers, [ok.trainId]))).statusCode,
    ).toBe(200)
    const trop = await trainExportable(ctx, s, ['C', 'D'], { statut: 'A_IMPRIMER' })
    const r = await prepa(s, await versions(ctx, s.users.coord.headers, [trop.trainId]))
    expect(r.statusCode).toBe(422)
    expect(erreur(r).details).toMatchObject({ themes: 4, max: 3 })
    expect((await faceDe(trop.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-215 permissions : export préparation pour le rôle %s',
    async (role) => {
      const s = await site()
      await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
      const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
      const r = await prepa(
        s,
        await versions(ctx, s.users.coord.headers, [t.trainId]),
        s.users[role].headers,
      )
      const autorise = role === 'coord' || role === 'cheq'
      expect(r.statusCode, r.body).toBe(autorise ? 200 : 403)
      if (!autorise) expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    },
  )

  it('RG-COO-308 version périmée → 409 sans écriture ; train inconnu → 404 ; train d’un autre site → 403', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const perimee = await prepa(s, [{ trainId: t.trainId, version: '9.9.9' }])
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).regle).toBe('RG-COO-308')
    expect((await prepa(s, [{ trainId: '7000000000000000', version: '1.1.1' }])).statusCode).toBe(
      404,
    )
    const autre = await site()
    expect(
      (await prepa(autre, await versions(ctx, s.users.coord.headers, [t.trainId]))).statusCode,
    ).toBe(403)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await prepa(s, [])).statusCode).toBe(400)
  })

  it('RG-COO-215 atomicité : un échec de l’écriture du lot annule le passage des faces à « Export prépa » ; idempotence : même clé, un seul lot', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const v = await versions(ctx, s.users.coord.headers, [t.trainId])
    const r = await avecEchec(ctx, 'BEFORE INSERT ON export_trains', () => prepa(s, v))
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    const cle = idem()
    const a = await envoyer(
      ctx,
      '/api/coordination/trains/export-preparation',
      s.users.cheq.headers,
      { trains: v },
      cle,
    )
    const b = await envoyer(
      ctx,
      '/api/coordination/trains/export-preparation',
      s.users.cheq.headers,
      { trains: v },
      cle,
    )
    expect(a.statusCode).toBe(200)
    expect(b.json()).toEqual(a.json())
    expect(await db.exportTrains.count({ where: { parId: s.users.cheq.id } })).toBe(1)
  })
})

// ───────────────────────── RG-COO-217 Au roulage, thème retiré de l'export ─────────────────────────

describe('RG-COO-217 « Au roulage » et suppression d’un thème de l’export', () => {
  const roulage = (
    s: SiteD,
    trains: { trainId: string; version: string }[],
    rouleurId: number,
    headers = s.users.cheq.headers,
  ) => envoyer(ctx, '/api/coordination/trains/au-roulage', headers, { trains, rouleurId })

  it('RG-COO-217 nominal : faces « Export prépa » → « Au roulage » avec le rouleur, historique et journal', async () => {
    const s = await site()
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur N1' })
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], { statut: 'EXPORT_PREPA' })
    const r = await roulage(s, await versions(ctx, s.users.coord.headers, [t.trainId]), rouleur.id)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ message: string }>().message).toBe(
      '2 face(s) passée(s) « Au roulage » (rouleur Rouleur N1).',
    )
    for (const face of t.faces) {
      expect(await faceDe(face.id)).toMatchObject({ statut: 'AU_ROULAGE', rouleurId: rouleur.id })
      expect(
        await db.statutHistorique.count({
          where: {
            typeEntite: 'FACE_TRAIN',
            entiteId: String(face.id),
            ancien: 'EXPORT_PREPA',
            nouveau: 'AU_ROULAGE',
          },
        }),
      ).toBe(1)
    }
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'TRAIN',
          entiteId: t.trainId,
          action: 'AU_ROULAGE',
          parId: s.users.cheq.id,
        },
      }),
    ).toBe(1)
  })

  it('RG-COO-217 rejet : des faces qui ne sont pas « Export prépa » (A imprimer, Instruction ok) → 409 ; rien ne change', async () => {
    const s = await site()
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    for (const statut of ['A_IMPRIMER', 'AU_ROULAGE'] as const) {
      const t = await trainExportable(ctx, s, ['Rose'], { statut })
      const r = await roulage(
        s,
        await versions(ctx, s.users.coord.headers, [t.trainId]),
        rouleur.id,
      )
      expect(r.statusCode, statut).toBe(409)
      expect(erreur(r)).toMatchObject({
        message: "Les faces des trains ne sont pas dans le statut 'Export prépa' !",
        regle: 'RG-COO-217',
      })
      expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe(statut)
    }
  })

  it('RG-COO-217 rouleur obligatoire : sans rouleur → 400 ; inconnu ou terminé → 404 ; d’un autre atelier → 422 ; rien n’est écrit', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'EXPORT_PREPA' })
    const v = await versions(ctx, s.users.coord.headers, [t.trainId])
    expect(
      (
        await envoyer(ctx, '/api/coordination/trains/au-roulage', s.users.cheq.headers, {
          trains: v,
        })
      ).statusCode,
    ).toBe(400)
    expect((await roulage(s, v, 99_999_999)).statusCode).toBe(404)
    const termine = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      dateFin: new Date(Date.now() - 86_400_000),
    })
    expect((await roulage(s, v, termine.id)).statusCode).toBe(404)
    const autreAtelier = await f.createRouleur(db, { atelierId: s.atelier2.id })
    const r = await roulage(s, v, autreAtelier.id)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_ROULEUR_AUTRE_ATELIER', regle: 'RG-COO-236' })
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('EXPORT_PREPA')
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-217 permissions : « Au roulage » pour le rôle %s',
    async (role) => {
      const s = await site()
      const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
      const t = await trainExportable(ctx, s, ['Rose'], { statut: 'EXPORT_PREPA' })
      const r = await roulage(
        s,
        await versions(ctx, s.users.coord.headers, [t.trainId]),
        rouleur.id,
        s.users[role].headers,
      )
      const autorise = role === 'coord' || role === 'cheq'
      expect(r.statusCode, r.body).toBe(autorise ? 200 : 403)
      if (!autorise) expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('EXPORT_PREPA')
    },
  )

  it('RG-COO-217 atomicité : un échec en cours de passage annule toutes les faces ; concurrence : un seul passage réussit', async () => {
    const s = await site()
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], { statut: 'EXPORT_PREPA' })
    const v = await versions(ctx, s.users.coord.headers, [t.trainId])
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON statut_historique WHEN NEW.entite_id = '${String(t.faces[1]?.id)}' AND NEW.nouveau = 'AU_ROULAGE'`,
      () => roulage(s, v, rouleur.id),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    for (const face of t.faces)
      expect(await faceDe(face.id)).toMatchObject({ statut: 'EXPORT_PREPA', rouleurId: null })
    const [a, b] = await Promise.all([roulage(s, v, rouleur.id), roulage(s, v, rouleur.id)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
  })

  it('RG-COO-217 supprimer un thème de l’export : faces « Export prépa » → « A imprimer », historique, journal ; les autres thèmes intacts', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], { statut: 'EXPORT_PREPA' })
    const corps = {
      atelierId: s.atelier.id,
      depart: DEPART_TXT,
      contNum: t.dossiers[0]?.contNum,
      theme: 'rose',
    }
    const r = await envoyer(
      ctx,
      '/api/coordination/trains/supprimer-theme-export',
      s.users.cheq.headers,
      corps,
    )
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ nombre: number }>().nombre).toBe(1)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(t.faces[1]?.id ?? 0)).statut).toBe('EXPORT_PREPA')
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'TRAIN', entiteId: t.trainId, action: 'SUPPRESSION_THEME_EXPORT' },
      }),
    ).toBe(1)
  })

  it('RG-COO-217 rejet : thème sans face → 409 « Pas de données à traiter ! » ; thème dont une face n’est pas « Export prépa » → 409 ; autre atelier → 403 ; atelier inconnu → 404', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const url = '/api/coordination/trains/supprimer-theme-export'
    const base = {
      atelierId: s.atelier.id,
      depart: DEPART_TXT,
      contNum: t.dossiers[0]?.contNum,
      theme: 'Rose',
    }
    const refus = await envoyer(ctx, url, s.users.cheq.headers, base)
    expect(refus.statusCode).toBe(409)
    expect(erreur(refus).message).toBe(
      "Toutes les faces du theme ne sont pas dans le statut 'Export prépa'",
    )
    const vide = await envoyer(ctx, url, s.users.cheq.headers, { ...base, theme: 'Inconnu' })
    expect(vide.statusCode).toBe(409)
    expect(erreur(vide).message).toBe('Pas de données à traiter !')
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    const autre = await site()
    expect((await envoyer(ctx, url, autre.users.cheq.headers, base)).statusCode).toBe(403)
    expect(
      (await envoyer(ctx, url, s.users.cheq.headers, { ...base, atelierId: 99_999_999 }))
        .statusCode,
    ).toBe(404)
    expect((await envoyer(ctx, url, s.users.recep.headers, base)).statusCode).toBe(403)
    expect(
      (await envoyer(ctx, url, s.users.cheq.headers, { ...base, depart: '2026-W54' })).statusCode,
    ).toBe(400)
  })
})

// ───────────────────────── RG-COO-236 choisir le rouleur ─────────────────────────

describe('RG-COO-236 choisir le rouleur d’une ou plusieurs lignes de trains', () => {
  const affecter = (
    s: SiteD,
    trains: { trainId: string; version: string }[],
    rouleurId: number,
    headers = s.users.cheq.headers,
  ) => envoyer(ctx, '/api/coordination/trains/rouleur', headers, { trains, rouleurId })

  it('RG-COO-236 liste : opérateurs actifs de l’atelier (et sans atelier), triés ; terminés et autres ateliers exclus', async () => {
    const s = await site()
    await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur B' })
    await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur A' })
    await f.createRouleur(db, { atelierId: null, nom: 'Rouleur Z libre' })
    await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur fini',
      dateFin: new Date(Date.now() - 86_400_000),
    })
    await f.createRouleur(db, { atelierId: s.atelier2.id, nom: 'Rouleur autre' })
    const r = await get(
      ctx,
      `/api/coordination/trains/rouleurs?atelier=${String(s.atelier.id)}`,
      s.users.cheq.headers,
    )
    expect(r.statusCode).toBe(200)
    const noms = r.json<{ rouleurs: { nom: string }[] }>().rouleurs.map((x) => x.nom)
    expect(noms).toContain('Rouleur A')
    expect(noms.indexOf('Rouleur A')).toBeLessThan(noms.indexOf('Rouleur B'))
    expect(noms).toContain('Rouleur Z libre')
    expect(noms).not.toContain('Rouleur fini')
    expect(noms).not.toContain('Rouleur autre')
    const autre = await site()
    expect(
      (
        await get(
          ctx,
          `/api/coordination/trains/rouleurs?atelier=${String(s.atelier.id)}`,
          autre.users.cheq.headers,
        )
      ).statusCode,
    ).toBe(403)
    expect(
      (await get(ctx, '/api/coordination/trains/rouleurs?atelier=99999999', s.users.cheq.headers))
        .statusCode,
    ).toBe(404)
    expect(
      (await get(ctx, '/api/coordination/trains/rouleurs', s.users.cheq.headers)).statusCode,
    ).toBe(400)
    expect(
      (
        await get(
          ctx,
          `/api/coordination/trains/rouleurs?atelier=${String(s.atelier.id)}`,
          s.users.recep.headers,
        )
      ).statusCode,
    ).toBe(403)
  })

  it('RG-COO-236 nominal : « Affecter » écrit le rouleur sur tous les trains choisis, journal (ancien, nouveau), version des faces +1', async () => {
    const s = await site()
    const r1 = await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur N1' })
    const r2 = await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur N2' })
    const a = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const b = await trainExportable(ctx, s, ['Gris', 'Bleu'], { statut: 'A_IMPRIMER' })
    const v = await versions(ctx, s.users.coord.headers, [a.trainId, b.trainId])
    const res = await affecter(s, v, r1.id)
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json<{ message: string }>().message).toBe('Rouleur Rouleur N1 affecté à 2 train(s).')
    for (const face of [...a.faces, ...b.faces])
      expect(await faceDe(face.id)).toMatchObject({ rouleurId: r1.id, version: 2 })
    const res2 = await affecter(
      s,
      await versions(ctx, s.users.coord.headers, [a.trainId]),
      r2.id,
      s.users.coord.headers,
    )
    expect(res2.statusCode).toBe(200)
    const journal = await db.journalAudit.findMany({
      where: { typeEntite: 'TRAIN', entiteId: a.trainId, action: 'AFFECTATION_ROULEUR' },
      orderBy: { id: 'asc' },
    })
    expect(journal.map((j) => [j.ancienneValeur, j.nouvelleValeur])).toEqual([
      [null, 'Rouleur N1'],
      ['Rouleur N1', 'Rouleur N2'],
    ])
  })

  it('RG-COO-236 rejets : train en production (409, point de non-retour), rouleur d’un autre atelier (422), inconnu (404), version périmée (409), liste vide (400)', async () => {
    const s = await site()
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    const enProd = await trainExportable(ctx, s, ['Rose'], { statut: 'AU_ROULAGE' })
    const prod = await affecter(
      s,
      await versions(ctx, s.users.coord.headers, [enProd.trainId]),
      rouleur.id,
    )
    expect(prod.statusCode).toBe(409)
    expect(erreur(prod)).toMatchObject({ regle: 'RG-COO-223' })
    expect((await faceDe(enProd.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    const t = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    const v = await versions(ctx, s.users.coord.headers, [t.trainId])
    const autreAtelier = await f.createRouleur(db, { atelierId: s.atelier2.id })
    expect((await affecter(s, v, autreAtelier.id)).statusCode).toBe(422)
    expect((await affecter(s, v, 99_999_999)).statusCode).toBe(404)
    const perimee = await affecter(s, [{ trainId: t.trainId, version: '9.9.9' }], rouleur.id)
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).regle).toBe('RG-COO-308')
    expect((await affecter(s, [], rouleur.id)).statusCode).toBe(400)
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBeNull()
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-236 permissions : affecter un rouleur pour le rôle %s',
    async (role) => {
      const s = await site()
      const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
      const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
      const r = await affecter(
        s,
        await versions(ctx, s.users.coord.headers, [t.trainId]),
        rouleur.id,
        s.users[role].headers,
      )
      const autorise = role === 'coord' || role === 'cheq'
      expect(r.statusCode, r.body).toBe(autorise ? 200 : 403)
      if (!autorise) expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    },
  )

  it('RG-COO-236 atomicité et concurrence : un échec du journal du 2e train annule l’affectation du 1er ; deux affectations simultanées : une seule réussit ; idempotence', async () => {
    const s = await site()
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    const a = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const b = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    const v = await versions(ctx, s.users.coord.headers, [a.trainId, b.trainId])
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${b.trainId}' AND NEW.action = 'AFFECTATION_ROULEUR'`,
      () => affecter(s, v, rouleur.id),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect((await faceDe(a.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    const [x, y] = await Promise.all([affecter(s, v, rouleur.id), affecter(s, v, rouleur.id)])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    const cle = idem()
    const t = await trainExportable(ctx, s, ['Bleu'], { statut: 'A_IMPRIMER' })
    const vt = await versions(ctx, s.users.coord.headers, [t.trainId])
    const p = await envoyer(
      ctx,
      '/api/coordination/trains/rouleur',
      s.users.cheq.headers,
      { trains: vt, rouleurId: rouleur.id },
      cle,
    )
    const q = await envoyer(
      ctx,
      '/api/coordination/trains/rouleur',
      s.users.cheq.headers,
      { trains: vt, rouleurId: rouleur.id },
      cle,
    )
    expect(q.json()).toEqual(p.json())
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'TRAIN', entiteId: t.trainId, action: 'AFFECTATION_ROULEUR' },
      }),
    ).toBe(1)
    expect(next()).toBeGreaterThan(0)
  })
})
