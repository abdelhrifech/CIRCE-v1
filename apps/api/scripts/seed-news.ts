// JDD datés et fictifs des nouvelles spécifications. Base locale dev.db exclusivement, jamais exécuté par les tests.
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import {
  BUS_FORMATS,
  BusLigneBroadcastSchema,
  CreerInconnueSchema,
  NcDonneesSchema,
  ValiderReceptionSchema,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
} from '@circe/shared'
import { createDb } from '../src/core/db.ts'
import { dbIdentityLoader, type Identity } from '../src/core/identity.ts'
import {
  referencesBus,
  sauverReferencesBus,
  integrerLignesBus,
  receptionnerBus,
  echeanceBus,
} from '../src/modules/bus/service.ts'
import {
  sauverDeclarants,
  lireDeclarants,
  declarerNc,
} from '../src/modules/nonconformite/service.ts'
import { initialiserJ3 } from '../src/modules/pilotage/j3.ts'
import { enregistrerPhoto } from '../src/modules/reception/photos.ts'
import { validerReception } from '../src/modules/reception/validation.ts'
import { creerReceptionInconnue } from '../src/modules/reception/inconnues.ts'
process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'))
const url = process.env['DATABASE_URL'] ?? ''
if (
  process.env['NODE_ENV'] === 'production' ||
  !url.startsWith('file:') ||
  resolve(url.slice(5)) !== resolve(import.meta.dirname, '../prisma/dev.db')
)
  throw new Error('JDD réservés à apps/api/prisma/dev.db, hors production.')
const db = createDb(url)
const charger = dbIdentityLoader(db)
async function identity(login: string): Promise<Identity> {
  const i = await charger(login)
  if (!i) throw new Error(`Profil absent : ${login}`)
  return { ...i, siteId: null }
}
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='
const photo = (nom: string) => ({ intitule: nom, mimeType: 'image/png', contenuBase64: png })
try {
  const admin = await identity('dev.admin')
  const plateformes = await db.plateforme.findMany()
  const site = (nom: string) => {
    const p = plateformes.find((p) => p.nom === nom)
    if (!p) throw new Error(`Site manquant : ${nom}`)
    return p
  }
  const nanterre = site('Nanterre')
  const ancien = await referencesBus(db)
  const formats = [...ancien.formats]
  if (!formats.length)
    for (const f of BUS_FORMATS) {
      const nom = `${f.nom} Bus (JDD)`
      const support =
        (await db.categorieSupport.findFirst({ where: { nom } })) ??
        (await db.categorieSupport.create({ data: { nom, poids: 1, qteUm: 40 } }))
      formats.push({
        code: f.code,
        supportId: support.id,
        patrimoineCode: `JDD-${f.code}`,
        libelleBroadcast: `JDD ${f.nom}`,
      })
    }
  const dsps = [...ancien.dsps],
    centres = [...ancien.centres],
    parcs = [...ancien.parcs]
  if (!dsps.some((d) => d.code === 'JDD-DSP-BUS'))
    dsps.push({
      code: 'JDD-DSP-BUS',
      nom: 'DSP fictive de démonstration',
      plateformeId: nanterre.id,
    })
  for (const code of ['JDD-CENTRE-A', 'JDD-CENTRE-B']) {
    if (!centres.some((c) => c.code === code))
      centres.push({
        code,
        nom: `Centre bus fictif ${code.endsWith('A') ? 'Alpha' : 'Bêta'}`,
        dspCode: 'JDD-DSP-BUS',
      })
    for (const parc of ['A', 'B'])
      for (const format of formats)
        if (
          !parcs.some(
            (p) => p.centreCode === code && p.parc === parc && p.formatCode === format.code,
          )
        )
          parcs.push({ centreCode: code, parc, formatCode: format.code, cadastre: 60, terrain: 40 })
  }
  if (
    JSON.stringify({ dsps, centres, formats, parcs }) !==
    JSON.stringify({
      dsps: ancien.dsps,
      centres: ancien.centres,
      formats: ancien.formats,
      parcs: ancien.parcs,
    })
  )
    await db.$transaction((tx) =>
      sauverReferencesBus(tx, admin, { version: ancien.version, dsps, centres, formats, parcs }),
    )
  const declarants = await lireDeclarants(db, admin)
  const noms = [
    ...new Set([
      ...declarants.noms,
      'Déclarant fictif Wissous',
      'Déclarant fictif Nîmes',
      'Déclarant fictif Nanterre',
    ]),
  ]
  if (noms.length !== declarants.noms.length)
    await db.$transaction((tx) =>
      sauverDeclarants(tx, admin, { version: declarants.version, noms }),
    )
  const maintenant = new Date(),
    courante = semaineIsoDe(maintenant),
    lundi = lundiSemaineIso(courante)
  let dossiersCrees = 0
  const recepBus = await identity('dev.recep.nanterre')
  for (let k = 0; k < 12; k++) {
    const sem = semaineIsoDe(new Date(lundi.getTime() + (k % 6) * 7 * 864e5)),
      semaine = formatSemaineIso(sem)
    const contNum = 880000 + ((courante.annee - 2026) * 53 + courante.semaine) * 20 + k
    if (await db.dossier.findUnique({ where: { contNum } })) continue
    const code = formats[k % formats.length]?.code ?? 'AR1',
      theme = `Visuel Bus fictif ${k + 1}`
    const lignes = ['JDD-CENTRE-A', 'JDD-CENTRE-B'].map((centreCode) =>
      BusLigneBroadcastSchema.parse({
        idExterne: `JDD-BUS-${contNum}-${centreCode}`,
        contNum,
        annonceur: `Annonceur Bus fictif ${k + 1}`,
        themeCode: `JDD-THEME-${contNum}`,
        theme,
        centreCode,
        parc: k % 2 ? 'B' : 'A',
        formatCode: code,
        semaine,
        finPose: semaine,
        vendu: 60,
        quantiteBroadcast: 65,
        attendu: 72,
        entretienPourcent: 20,
        resteEnPlace: k === 11,
      }),
    )
    await db.$transaction(async (tx) => {
      await integrerLignesBus(tx, lignes, maintenant)
      const bus = await tx.busLigne.findUniqueOrThrow({
        where: { idExterne: lignes[0]?.idExterne ?? '' },
      })
      const scenario = k % 6
      if (scenario !== 0)
        await receptionnerBus(tx, recepBus, {
          ligneAttendueId: bus.ligneAttendueId,
          quantite: scenario === 1 ? 80 : scenario === 3 ? 180 : 144,
          date:
            scenario === 5
              ? new Date(echeanceBus(semaine).getTime() + 864e5)
              : new Date(echeanceBus(semaine).getTime() - 864e5),
          bl: `JDD-BL-BUS-${contNum}`,
          entretien: scenario !== 1,
          themeConforme: scenario !== 4,
          photo: photo('EXEMPLE-FICTIF-visuel-bus.png'),
          tenue: 'OK',
          allongement: 'OK',
          massicotage: scenario === 4 ? 'KO' : 'OK',
          nc: scenario === 4 ? 'FORMAT' : '',
          commentaire: 'Jeu de données fictif des nouvelles spécifications.',
        })
    })
    dossiersCrees++
  }
  const support =
    (await db.categorieSupport.findFirst({ where: { nom: '2 m² JDD centres' } })) ??
    (await db.categorieSupport.create({ data: { nom: '2 m² JDD centres', poids: 1, qteUm: 40 } }))
  const imprimeur = await db.imprimeur.findFirstOrThrow({
      where: { libelle: 'Imprimeur fictif JDD centres' },
    }),
    livreur = await db.livreur.findFirstOrThrow({
      where: { libelle: 'Transporteur fictif JDD centres' },
    })
  for (const [index, nom] of ['Wissous', 'Nîmes', 'Nanterre'].entries()) {
    const p = site(nom),
      code = nom === 'Wissous' ? 'wissous' : nom === 'Nîmes' ? 'nimes' : 'nanterre',
      recep = await identity(`dev.recep.${code}`)
    const atelier = await db.atelier.findFirstOrThrow({
      where: { plateformeId: p.id, type: 'SCROLL' },
    })
    for (let k = 0; k < 6; k++) {
      const contNum =
        840000 + ((courante.annee - 2026) * 53 + courante.semaine) * 30 + index * 6 + k
      const annonceur = `JDD nouvelles specs ${nom} ${k + 1}`,
        theme = `Campagne fictive ${courante.annee}-${courante.semaine}-${k + 1}`
      const existe = await db.dossier.findUnique({ where: { contNum } })
      if (existe) {
        assert.equal(existe.annonceur, annonceur)
        continue
      }
      const sem = semaineIsoDe(new Date(lundi.getTime() + (k % 2) * 7 * 864e5))
      await db.$transaction(async (tx) => {
        const dossier = await tx.dossier.create({
          data: { contNum, annonceur, statut: k < 2 ? 'A_TRAITER' : 'PREPARATION_RECUE' },
        })
        await tx.instruction.create({
          data: {
            code: `N${contNum}`,
            dossierId: dossier.id,
            atelierId: atelier.id,
            contNum,
            annonceur,
            contAnbas: sem.annee,
            contSembas: sem.semaine,
            statut: k % 2 ? 'EN_COURS' : 'INSTRUCTION_OK',
            commentaire: k % 2 ? 'À vérifier, exemple fictif.' : null,
          },
        })
        const ligne = await tx.receptionAttendue.create({
          data: {
            plateformeId: p.id,
            atelierId: atelier.id,
            supportId: support.id,
            contNum,
            annonceur,
            theme: k === 0 ? null : theme,
            themeCle: k === 0 ? null : theme,
            format: '2 m² scro',
            semNum: sem.semaine,
            semAnnee: sem.annee,
            source: 'BC',
            qteBc: 100,
          },
        })
        if (k > 0) {
          const bl = await enregistrerPhoto(tx, recep, photo('EXEMPLE-FICTIF-bon-livraison.png'))
          const r = await validerReception(
            tx,
            recep,
            ValiderReceptionSchema.parse({
              lignes: [{ ligneAttendueId: ligne.id, quantite: k === 1 ? 40 : 100, cochee: true }],
              photoBlId: k === 2 ? null : bl.id,
              sansBl: k === 2,
              numeroBl: `JDD-NEWS-${contNum}`,
              livreurId: livreur.id,
              imprimeurId: imprimeur.id,
            }),
          )
          if (k === 3 || k === 4)
            await declarerNc(tx, recep, {
              type: 'RECEPTION',
              plateformeId: p.id,
              receptionId: r.receptionId,
              afficheIds: r.affiches.map((a) => a.id),
              bloquante: k === 3,
              donnees: NcDonneesSchema.parse({
                annonceur,
                theme,
                dossier: String(contNum),
                types: [k === 3 ? 'Affiches trempées ou abîmées' : 'BL non conforme'],
                commentaireNC: 'Non-conformité fictive de démonstration.',
                imprimeur: imprimeur.libelle,
                transporteur: livreur.libelle,
              }),
              fichiers: [],
            })
        }
      })
      dossiersCrees++
    }
  }
  if (
    !(await db.affiche.findFirst({
      where: {
        plateformeId: nanterre.id,
        contAnnonc: 'Client Bus inconnu fictif (JDD nouvelles specs)',
      },
    }))
  )
    await db.$transaction((tx) =>
      creerReceptionInconnue(
        tx,
        recepBus,
        CreerInconnueSchema.parse({
          plateformeId: nanterre.id,
          supportId: formats[0]?.supportId,
          annonceur: 'Client Bus inconnu fictif (JDD nouvelles specs)',
          theme: 'Visuel à identifier',
          quantite: 30,
          allee: 'X',
          rayon: '1',
          sansBl: true,
        }),
      ),
    )
  for (let i = 0; i < 2; i++)
    await db.$transaction((tx) =>
      initialiserJ3(
        tx,
        admin,
        formatSemaineIso(semaineIsoDe(new Date(lundi.getTime() + i * 7 * 864e5))),
      ),
    )
  console.log(
    `seed:news OK : ${dossiersCrees} dossiers créés ; référentiels Bus, déclarants et tableaux J-3 prêts.`,
  )
} finally {
  await db.$disconnect()
}
