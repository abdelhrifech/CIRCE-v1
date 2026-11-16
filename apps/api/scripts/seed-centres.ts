// JDD de démonstration persistants, exclusivement dans la base locale de développement.
// Relançable : chaque dossier est créé avec son parcours dans une transaction ; les dossiers existants restent intacts.
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import {
  CENTRES_DEMO,
  ROLES_DEMO,
  PERMISSION_CODES,
  ValiderReceptionSchema,
  ValiderControleSchema,
  CreerInconnueSchema,
  semaineIsoDe,
} from '@circe/shared'
import { createDb } from '../src/core/db.ts'
import { dbIdentityLoader, type Identity } from '../src/core/identity.ts'
import { canAccessPlateforme, permissionsOf } from '../src/core/permissions/permissions.ts'
import { seedRef } from '../src/reference/seed-ref.ts'
import { enregistrerPhoto } from '../src/modules/reception/photos.ts'
import { validerReception } from '../src/modules/reception/validation.ts'
import { validerControle } from '../src/modules/reception/controle.ts'
import { creerReceptionInconnue } from '../src/modules/reception/inconnues.ts'
import { changerValidationCoordination } from '../src/modules/coordination/effets-validation.ts'

process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'))
const url = process.env['DATABASE_URL'] ?? ''
const cible = resolve(import.meta.dirname, '../prisma/dev.db')
if (
  process.env['NODE_ENV'] === 'production' ||
  !url.startsWith('file:') ||
  resolve(url.slice(5)) !== cible
)
  throw new Error('Chargement réservé au fichier local apps/api/prisma/dev.db, hors production.')

const db = createDb(url)
const charger = dbIdentityLoader(db)
async function identite(login: string): Promise<Identity> {
  const utilisateur = await charger(login)
  if (!utilisateur) throw new Error(`Compte absent : ${login}`)
  return { ...utilisateur, siteId: null }
}
const normaliser = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='
try {
  await seedRef(db)
  const sites: { code: string; nom: string; id: number }[] = []
  for (const centre of CENTRES_DEMO) {
    const existants = (await db.plateforme.findMany()).filter(
      (p) => normaliser(p.nom) === normaliser(centre.nom),
    )
    if (existants.length > 1) throw new Error(`Plusieurs centres nommés ${centre.nom}`)
    const plateforme = existants[0] ?? (await db.plateforme.create({ data: { nom: centre.nom } }))
    // Identifiants de site fictifs réservés aux JDD : l'EDR n'affiche que les plateformes gérées.
    if (plateforme.idSiteCcf === null) {
      const fictif = 9000 + CENTRES_DEMO.findIndex((c) => c.code === centre.code) + 1
      if (
        await db.plateforme.findFirst({ where: { idSiteCcf: fictif, id: { not: plateforme.id } } })
      )
        throw new Error('Identifiant de site JDD déjà utilisé')
      await db.plateforme.update({ where: { id: plateforme.id }, data: { idSiteCcf: fictif } })
    }
    sites.push({ ...centre, id: plateforme.id })
    for (const type of ['FIXE', 'SCROLL'] as const) {
      const libelle = `JDD ${centre.nom} · ${type === 'FIXE' ? '2 m² fixe' : 'Déroulant'}`
      if (!(await db.atelier.findFirst({ where: { plateformeId: plateforme.id, libelle } })))
        await db.atelier.create({ data: { plateformeId: plateforme.id, libelle, type } })
    }
  }
  // Les profils généraux gardent leurs périmètres existants et gagnent les trois centres.
  // Les nouveaux profils locaux ont uniquement leur centre ; tout admin reste global via dbIdentityLoader.
  for (const centre of [null, ...sites]) {
    for (const role of ROLES_DEMO) {
      const login = `dev.${role.code}${centre ? `.${centre.code}` : ''}`
      await db.$transaction(async (tx) => {
        const user = await tx.utilisateur.upsert({
          where: { identifiantExterne: login },
          update: { actif: true },
          create: {
            identifiantExterne: login,
            nom: `${role.libelle} · ${centre?.nom ?? 'Multicentres'} (démo)`,
          },
        })
        const r = await tx.role.findUniqueOrThrow({ where: { code: role.code } })
        if (
          !(await tx.utilisateurRole.findFirst({ where: { utilisateurId: user.id, roleId: r.id } }))
        )
          await tx.utilisateurRole.create({ data: { utilisateurId: user.id, roleId: r.id } })
        for (const site of centre ? [centre] : sites) {
          if (
            !(await tx.utilisateurPerimetre.findFirst({
              where: { utilisateurId: user.id, plateformeId: site.id, atelierId: null },
            }))
          )
            await tx.utilisateurPerimetre.create({
              data: { utilisateurId: user.id, plateformeId: site.id },
            })
        }
      })
    }
  }
  const support =
    (await db.categorieSupport.findFirst({ where: { nom: '2 m² JDD centres' } })) ??
    (await db.categorieSupport.create({ data: { nom: '2 m² JDD centres', poids: 1, qteUm: 40 } }))
  const imprimeur =
    (await db.imprimeur.findFirst({ where: { libelle: 'Imprimeur fictif JDD centres' } })) ??
    (await db.imprimeur.create({ data: { libelle: 'Imprimeur fictif JDD centres' } }))
  const livreur =
    (await db.livreur.findFirst({ where: { libelle: 'Transporteur fictif JDD centres' } })) ??
    (await db.livreur.create({ data: { libelle: 'Transporteur fictif JDD centres' } }))
  const semaine = semaineIsoDe(new Date())
  let crees = 0
  const scenarios = [
    { nom: 'Attendue', recu: 0, controle: false, valide: false },
    { nom: 'Partielle', recu: 40, controle: false, valide: false },
    { nom: 'Complète à contrôler', recu: 100, controle: false, valide: false },
    { nom: 'Surplus', recu: 125, controle: false, valide: false },
    { nom: 'Contrôlée à confirmer', recu: 100, controle: true, valide: false },
    { nom: 'Contrôlée et validée', recu: 100, controle: true, valide: true },
  ]
  for (const [siteIndex, site] of sites.entries()) {
    const recep = await identite(`dev.recep.${site.code}`)
    const coord = await identite(`dev.coord.${site.code}`)
    const atelier = await db.atelier.findFirstOrThrow({
      where: { plateformeId: site.id, type: 'SCROLL' },
    })
    for (let n = 0; n < 12; n++) {
      const scenario = scenarios[n % scenarios.length]
      assert(scenario)
      const contNum = 760000 + siteIndex * 100 + n
      const annonceur = `JDD ${site.nom} ${String(n + 1).padStart(2, '0')}`
      const theme = `${scenario.nom} · campagne fictive ${n + 1}`
      const existant = await db.dossier.findUnique({ where: { contNum } })
      if (existant) {
        assert.equal(existant.annonceur, annonceur, `Collision avec un dossier existant ${contNum}`)
        continue
      }
      await db.$transaction(async (tx) => {
        const dossier = await tx.dossier.create({ data: { contNum, annonceur } })
        await tx.instruction.create({
          data: {
            code: `JDDC${contNum}`,
            dossierId: dossier.id,
            contNum,
            atelierId: atelier.id,
            annonceur,
            contAnbas: semaine.annee,
            contSembas: semaine.semaine,
            statut: 'A_TRAITER',
          },
        })
        const ligne = await tx.receptionAttendue.create({
          data: {
            plateformeId: site.id,
            supportId: support.id,
            contNum,
            annonceur,
            theme,
            themeCle: theme.toUpperCase(),
            format: '2m2',
            source: 'BC',
            qteBc: 100,
            semAnnee: semaine.annee,
            semNum: semaine.semaine,
          },
        })
        if (scenario.recu === 0) return
        const photo = await enregistrerPhoto(tx, recep, {
          intitule: `Echantillon-technique-JDD-${contNum}.png`,
          mimeType: 'image/png',
          contenuBase64: png,
        })
        const reception = await validerReception(
          tx,
          recep,
          ValiderReceptionSchema.parse({
            lignes: [{ ligneAttendueId: ligne.id, quantite: scenario.recu, cochee: true }],
            numeroBl: `JDD-CENTRES-${contNum}`,
            photoBlId: photo.id,
            imprimeurId: imprimeur.id,
            livreurId: livreur.id,
            nbColis: 1,
            dechargeParId: recep.userId,
          }),
        )
        if (scenario.controle) {
          const r = await tx.reception.findUniqueOrThrow({ where: { id: reception.receptionId } })
          await validerControle(
            tx,
            recep,
            r.id,
            ValiderControleSchema.parse({
              version: r.version,
              controleurId: recep.userId,
              lignes: reception.affiches.map((a) => ({
                afficheId: a.id,
                qteComptee: scenario.recu,
                allee: 'A',
                rayon: String(n + 1),
              })),
            }),
          )
        }
        if (scenario.valide) {
          for (const a of reception.affiches) {
            const affiche = await tx.affiche.findUniqueOrThrow({ where: { id: a.id } })
            await changerValidationCoordination(tx, coord, a.id, {
              version: affiche.version,
              valider: true,
            })
          }
        }
      })
      crees++
    }
    const themeInconnu = `JDD inconnue ${site.code}`
    if (!(await db.affiche.findFirst({ where: { plateformeId: site.id, theme: themeInconnu } })))
      await db.$transaction((tx) =>
        creerReceptionInconnue(
          tx,
          recep,
          CreerInconnueSchema.parse({
            plateformeId: site.id,
            supportId: support.id,
            theme: themeInconnu,
            annonceur: 'Annonceur non identifié — JDD',
            quantite: 30,
            allee: 'X',
            rayon: '1',
            sansBl: true,
          }),
        ),
      )
    for (const role of ROLES_DEMO) {
      const identity = await identite(`dev.${role.code}.${site.code}`)
      assert(canAccessPlateforme(identity, site.id))
      if (role.code === 'admin') {
        assert(identity.perimetre.toutesPlateformes)
        assert.equal(permissionsOf(identity.roles).length, PERMISSION_CODES.length)
        for (const s of sites) assert(canAccessPlateforme(identity, s.id))
      } else {
        for (const s of sites.filter((s) => s.id !== site.id))
          assert(!canAccessPlateforme(identity, s.id))
      }
    }
  }
  const admin = await identite('dev.admin')
  assert(admin.perimetre.toutesPlateformes)
  assert.equal(permissionsOf(admin.roles).length, PERMISSION_CODES.length)
  console.log(
    JSON.stringify(
      {
        centres: sites,
        profils: 24,
        dossiersCrees: crees,
        dossiersJdd: await db.dossier.count({
          where: { contNum: { gte: 760000, lt: 760300 }, annonceur: { startsWith: 'JDD ' } },
        }),
        droitsAdmin: permissionsOf(admin.roles).length,
        acces: 'Administrateurs globaux ; profils locaux limités à leur centre',
      },
      null,
      2,
    ),
  )
} finally {
  await db.$disconnect()
}
