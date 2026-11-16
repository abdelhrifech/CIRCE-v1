// JDD+ : cas fonctionnels reproductibles, uniquement sur la base locale de développement.
// Chaque scénario est atomique ; un redémarrage ne modifie jamais un scénario déjà créé.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  NC_TYPES,
  NC_TYPES_AGENCE,
  NC_DECISIONS,
  NcDonneesSchema,
  J3DonneesSchema,
  ValiderReceptionSchema,
  ValiderControleSchema,
  CreerInconnueSchema,
  semaineIsoDe,
  formatSemaineIso,
  lundiSemaineIso,
  type Nc,
} from '@circe/shared'
import { createDb } from '../src/core/db.ts'
import { dbIdentityLoader, type Identity } from '../src/core/identity.ts'
import { enregistrerPhoto } from '../src/modules/reception/photos.ts'
import { validerReception } from '../src/modules/reception/validation.ts'
import { validerControle } from '../src/modules/reception/controle.ts'
import {
  creerReceptionInconnue,
  signalerIntrouvable,
  rattacherInconnue,
} from '../src/modules/reception/inconnues.ts'
import { modifierAffiche } from '../src/modules/reception/affiches.ts'
import { enregistrerImpression } from '../src/modules/reception/impressions.ts'
import { changerValidationCoordination } from '../src/modules/coordination/effets-validation.ts'
import { declarerNc, deciderNc } from '../src/modules/nonconformite/service.ts'
import { lireJ3, ajouterJ3, modifierJ3 } from '../src/modules/pilotage/j3.ts'
import type { Tx } from '../src/core/transaction.ts'
import { lireDeadline } from '../src/modules/coordination/reservations.ts'
import { lireParametreTexte } from '../src/modules/reception/parametres.ts'

process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'))
const url = process.env['DATABASE_URL'] ?? ''
assert(
  process.env['NODE_ENV'] !== 'production' &&
    url.startsWith('file:') &&
    resolve(url.slice(5)) === resolve(import.meta.dirname, '../prisma/dev.db'),
  'JDD+ réservés au fichier local apps/api/prisma/dev.db, hors production.',
)
const db = createDb(url)
const charger = dbIdentityLoader(db)
async function identite(login: string): Promise<Identity> {
  const i = await charger(login)
  assert(i, `Profil absent : ${login}`)
  return { ...i, siteId: null }
}
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='
const justificatif = [{ nom: 'preuve-fictive.png', mimeType: 'image/png', contenuBase64: png }]
const formats = [
  { nom: '2 m² fixe', type: 'FIXE' },
  { nom: '2 m² scro', type: 'SCROLL' },
  { nom: '4 m² scro', type: 'SCROLL' },
  { nom: '8 m² scro', type: 'SCROLL' },
  { nom: '12 m² colle', type: 'FIXE' },
  { nom: '8 m² colle', type: 'FIXE' },
  { nom: '4 m² colle', type: 'FIXE' },
] as const
interface Scenario {
  nom: string
  format: number
  recus: number[]
  controle?: boolean
  compte?: number
  rebut?: number
  entretien?: number
  valide?: boolean
  imprime?: boolean
  sansBl?: boolean
  sansIP?: boolean
  nc?: string
  bloquante?: boolean
  agence?: string
  formulaire?: boolean
  decision?: (typeof NC_DECISIONS)[number]
  traite?: boolean
  multi?: boolean
  inconnueEtape?: number
  decalage?: number
}
const scenarios: Scenario[] = [
  { nom: '2m fixe · attendu sans IP', format: 0, recus: [], sansIP: true },
  { nom: '2m déroulant · attendu avec IP', format: 1, recus: [] },
  { nom: '2m fixe · réception partielle 35 sur 100', format: 0, recus: [35] },
  { nom: '2m déroulant · complète à contrôler', format: 1, recus: [100] },
  { nom: '2m fixe · surplus 125 sur 100', format: 0, recus: [125] },
  {
    nom: '2m déroulant · contrôle validé, feuille à imprimer',
    format: 1,
    recus: [100],
    controle: true,
  },
  { nom: '2m fixe · validation administrative attendue', format: 0, recus: [100], controle: true },
  {
    nom: '2m déroulant · contrôlée et validée',
    format: 1,
    recus: [100],
    controle: true,
    valide: true,
  },
  {
    nom: '2m fixe · comptage 90 pour BL de 100',
    format: 0,
    recus: [100],
    controle: true,
    compte: 90,
  },
  { nom: '2m déroulant · complément 40 puis 60', format: 1, recus: [40, 60] },
  { nom: '2m fixe · sans BL, doute à confirmer', format: 0, recus: [100], sansBl: true },
  {
    nom: '2m déroulant · 10 affiches au rebut',
    format: 1,
    recus: [100],
    controle: true,
    rebut: 10,
  },
  {
    nom: '2m fixe · surplus entretien de 20',
    format: 0,
    recus: [120],
    controle: true,
    entretien: 20,
  },
  {
    nom: '2m déroulant · feuille déjà imprimée',
    format: 1,
    recus: [100],
    controle: true,
    valide: true,
    imprime: true,
  },
  ...[2, 3, 4, 5, 6].map((format) => ({
    nom: `${formats[format]?.nom ?? ''} · manque à J−3`,
    format,
    recus: [25],
  })),
  ...NC_TYPES.map((nc, n) => ({
    nom: `NC réception · ${nc}`,
    format: n % 2,
    recus: [100],
    nc,
    bloquante: true,
    decision: n === 0 ? undefined : NC_DECISIONS[(n - 1) % NC_DECISIONS.length],
    traite: n === 8,
  })),
  {
    nom: 'NC quantité · non bloquante',
    format: 0,
    recus: [60],
    nc: 'Écart de quantité',
    bloquante: false,
  },
  {
    nom: 'NC croix · non bloquante',
    format: 1,
    recus: [100],
    nc: 'Croix mal positionnées',
    bloquante: false,
  },
  {
    nom: 'NC multiple · décision et traitement plateforme',
    format: 0,
    recus: [100],
    nc: 'Thèmes mélangés',
    multi: true,
    decision: 'À traiter par la plateforme',
    traite: true,
  },
  ...NC_TYPES_AGENCE.map((agence, n) => ({
    nom: `NC agence · ${agence}`,
    format: n % 2,
    recus: [100],
    controle: true,
    agence,
    bloquante: n !== 5,
    decision: n === 0 || n === 5 ? undefined : NC_DECISIONS[n],
    traite: n === 3,
  })),
  {
    nom: 'NC formulaire · visuel non conforme',
    format: 0,
    recus: [100],
    formulaire: true,
    bloquante: true,
  },
  {
    nom: 'NC formulaire · papier pour statistiques',
    format: 1,
    recus: [100],
    formulaire: true,
    bloquante: false,
  },
]
scenarios.push(
  { nom: '2m fixe · réception sans IP avec intitulé saisi', format: 0, recus: [60], sansIP: true },
  { nom: 'Inconnue rattachée · à contrôler', format: 0, recus: [], inconnueEtape: 1 },
  {
    nom: 'Inconnue contrôlée · feuille définitive à imprimer',
    format: 1,
    recus: [],
    inconnueEtape: 2,
    controle: true,
    compte: 30,
  },
  {
    nom: 'Inconnue · feuille définitive imprimée',
    format: 0,
    recus: [],
    inconnueEtape: 3,
    controle: true,
    compte: 30,
    imprime: true,
  },
)

const maintenant = new Date()
const courante = semaineIsoDe(maintenant)
const lundi = lundiSemaineIso(courante)
const lot = formatSemaineIso(courante)
const base = 4_000_000 + ((courante.annee - 2026) * 53 + courante.semaine) * 1000
const catalogue: {
  centre: string
  scenario: string
  dossier: number | null
  afficheIds: number[]
  ncId: number | null
  semaine: string
}[] = []
let crees = 0
try {
  const admin = await identite('dev.admin')
  const deadline = lireDeadline(await lireParametreTexte(db, 'coordination.deadlinePrepa'))
  let prochainDecalage = 0
  while (
    deadline(semaineIsoDe(new Date(lundi.getTime() + prochainDecalage * 7 * 864e5))) <= maintenant
  ) {
    prochainDecalage++
    assert(prochainDecalage < 80, 'Échéance future introuvable : vérifier le paramètre métier.')
  }
  // Append-only : ne pas déplacer les identifiants des scénarios déjà chargés.
  for (let n = 0; n < 12; n++)
    scenarios.push({
      nom: `Sans IP · visuel saisi ${String(n + 1).padStart(2, '0')}`,
      format: n < 8 ? n % 2 : (n - 6) % formats.length,
      recus: [[35], [60], [100], [125]][n % 4] ?? [100],
      sansIP: true,
      sansBl: n % 3 === 0,
      controle: n % 4 === 2,
    })
  for (let n = 0; n < 8; n++)
    scenarios.push({
      nom: `J−3 · prochaine échéance · cas ${String(n + 1).padStart(2, '0')}`,
      format: n % formats.length,
      recus: n % 2 ? [25] : [],
      decalage: prochainDecalage,
    })
  for (let n = 0; n < 4; n++)
    scenarios.push({
      nom: `J−3 · échéance dépassée · cas ${String(n + 1).padStart(2, '0')}`,
      format: n % formats.length,
      recus: n % 2 ? [50] : [],
      decalage: prochainDecalage - 1,
    })
  console.log(
    `JDD échéance : prochain départ ${formatSemaineIso(semaineIsoDe(new Date(lundi.getTime() + prochainDecalage * 7 * 864e5)))}, deadline ${deadline(semaineIsoDe(new Date(lundi.getTime() + prochainDecalage * 7 * 864e5))).toISOString()}.`,
  )
  const imprimeur = await db.imprimeur.findFirstOrThrow({
    where: { libelle: 'Imprimeur fictif JDD centres' },
  })
  const livreur = await db.livreur.findFirstOrThrow({
    where: { libelle: 'Transporteur fictif JDD centres' },
  })
  const supports = []
  for (const f of formats) {
    const nom = `JDD+ ${f.nom}`
    supports.push(
      (await db.categorieSupport.findFirst({ where: { nom } })) ??
        (await db.categorieSupport.create({
          data: { nom, estDeroulant: f.type === 'SCROLL', poids: 1, qteUm: 40 },
        })),
    )
  }
  for (const [siteIndex, centre] of ['Wissous', 'Nîmes', 'Nanterre'].entries()) {
    const site = await db.plateforme.findFirstOrThrow({ where: { nom: centre } })
    const code = ['wissous', 'nimes', 'nanterre'][siteIndex]
    const recep = await identite(`dev.recep.${code}`)
    const coord = await identite(`dev.coord.${code}`)
    const cheq = await identite(`dev.cheq.${code}`)
    for (const [index, s] of scenarios.entries()) {
      const contNum = base + siteIndex * 100 + index
      const annonceur = `JDD+ ${centre} · ${s.nom}`
      // Cas actuels majoritaires, plus une échéance passée et des départs à S+1/S+2.
      const decalage = s.decalage ?? (index === 1 ? -1 : index === 2 ? 1 : index === 3 ? 2 : 0)
      const semaine = semaineIsoDe(new Date(lundi.getTime() + decalage * 7 * 864e5))
      const existe = await db.dossier.findUnique({ where: { contNum } })
      if (existe) {
        assert.equal(existe.annonceur, annonceur, `Collision JDD+ ${contNum}`)
        const affiches = await db.affiche.findMany({
          where: { plateformeId: site.id, rattachements: { some: { ligneAttendue: { contNum } } } },
          select: { id: true },
        })
        const nc = await db.nonConformite.findFirst({
          where: { plateformeId: site.id, donnees: { contains: `"dossier":"${contNum}"` } },
          select: { id: true },
        })
        const ligneExistante = await db.receptionAttendue.findFirstOrThrow({
          where: { contNum, plateformeId: site.id },
        })
        catalogue.push({
          centre,
          scenario: s.nom,
          dossier: contNum,
          afficheIds: affiches.map((a) => a.id),
          ncId: nc?.id ?? null,
          semaine: formatSemaineIso({
            annee: ligneExistante.semAnnee,
            semaine: ligneExistante.semNum,
          }),
        })
        continue
      }
      const f = formats[s.format],
        support = supports[s.format]
      assert(f && support)
      const atelierNom = f.nom.includes('colle')
        ? `JDD+ ${centre} · Pliage colle`
        : `JDD ${centre} · ${f.type === 'SCROLL' ? 'Déroulant' : '2 m² fixe'}`
      const atelier =
        (await db.atelier.findFirst({ where: { plateformeId: site.id, libelle: atelierNom } })) ??
        (await db.atelier.create({
          data: { plateformeId: site.id, libelle: atelierNom, type: f.type },
        }))
      await db.$transaction(
        async (tx) => {
          const dossier = await tx.dossier.create({ data: { contNum, annonceur } })
          const theme = `Démonstration fictive ${lot} · ${s.nom}`
          if (!s.sansIP)
            await tx.instruction.create({
              data: {
                code: `JPLUS${contNum}`,
                statut: 'A_TRAITER',
                dossierId: dossier.id,
                contNum,
                annonceur,
                atelierId: atelier.id,
                contAnbas: semaine.annee,
                contSembas: semaine.semaine,
                commentaire: `JDD+ ${s.nom} — aucune donnée réelle.`,
              },
            })
          const ligne = await tx.receptionAttendue.create({
            data: {
              plateformeId: site.id,
              atelierId: atelier.id,
              supportId: support.id,
              contNum,
              annonceur,
              theme: s.sansIP ? null : theme,
              themeCle: s.sansIP ? null : theme,
              format: f.nom,
              source: 'BC',
              qteBc: 100,
              semAnnee: semaine.annee,
              semNum: semaine.semaine,
            },
          })
          let afficheIds: number[] = [],
            receptionId: number | undefined
          for (const [part, quantite] of s.recus.entries()) {
            const bl = s.sansBl
              ? null
              : await enregistrerPhoto(tx, recep, {
                  intitule: `JDD+-BL-${contNum}-${part}.png`,
                  mimeType: 'image/png',
                  contenuBase64: png,
                })
            const reception = await validerReception(
              tx,
              recep,
              ValiderReceptionSchema.parse({
                lignes: [
                  {
                    ligneAttendueId: ligne.id,
                    quantite,
                    cochee: true,
                    complementAfficheId: part > 0 ? afficheIds[0] : null,
                    intituleSaisi: s.sansIP ? theme : null,
                  },
                ],
                sansBl: s.sansBl ?? false,
                photoBlId: bl?.id ?? null,
                numeroBl: `JPLUS-${contNum}-${part}`,
                livreurId: livreur.id,
                imprimeurId: s.sansBl ? null : imprimeur.id,
                nbColis: 2,
                dechargeParId: recep.userId,
              }),
            )
            afficheIds = [...new Set([...afficheIds, ...reception.affiches.map((a) => a.id)])]
            receptionId = reception.receptionId
          }
          if (s.inconnueEtape) {
            const inconnue = await creerReceptionInconnue(
              tx,
              recep,
              CreerInconnueSchema.parse({
                plateformeId: site.id,
                supportId: support.id,
                annonceur,
                theme,
                quantite: 30,
                allee: 'X',
                rayon: String(index + 1),
                sansBl: true,
                imprimeurId: imprimeur.id,
              }),
            )
            const a = await tx.affiche.findUniqueOrThrow({ where: { id: inconnue.afficheId } })
            await rattacherInconnue(tx, recep, a.id, {
              version: a.version,
              lignes: [{ ligneAttendueId: ligne.id, quantite: 30 }],
            })
            afficheIds = [a.id]
            receptionId = inconnue.receptionId
          }
          if (s.controle && receptionId) {
            const r = await tx.reception.findUniqueOrThrow({ where: { id: receptionId } })
            await validerControle(
              tx,
              recep,
              r.id,
              ValiderControleSchema.parse({
                version: r.version,
                controleurId: recep.userId,
                lignes: afficheIds.map((afficheId) => ({
                  afficheId,
                  qteComptee: s.compte ?? s.recus.reduce((a, b) => a + b, 0),
                  allee: 'B',
                  rayon: String(index + 1),
                  rebut: s.rebut ?? 0,
                  surplusEntretien: s.entretien ?? null,
                  nonConformite: s.compte ? 'QUANTITE' : s.rebut ? 'AFFICHE_ABIMEE' : 'CONFORME',
                })),
              }),
            )
          }
          if (s.valide)
            for (const id of afficheIds) {
              const a = await tx.affiche.findUniqueOrThrow({ where: { id } })
              await changerValidationCoordination(tx, coord, id, {
                version: a.version,
                valider: true,
              })
            }
          if (s.imprime)
            await enregistrerImpression(tx, recep, {
              afficheIds,
              contenu: 'FEUILLE',
              exemplaires: 1,
            })
          // Exemple de conservation et repiquage, via la même modification versionnée que la fiche.
          if (index === 7 && afficheIds[0]) {
            const a = await tx.affiche.findUniqueOrThrow({ where: { id: afficheIds[0] } })
            await modifierAffiche(tx, admin, a.id, {
              version: a.version,
              aConserver: true,
              conservation: 24,
              repiquage: `Exemple fictif ${centre}`,
              zonePicking: true,
              commentaire: 'JDD+ contrôlée et validée, à conserver.',
            })
          }
          let nc: Nc | null = null
          if (s.nc || s.agence || s.formulaire) {
            const liee = !s.agence && !s.formulaire
            nc = await declarerNc(tx, s.agence ? admin : recep, {
              plateformeId: site.id,
              type: s.agence ? 'AGENCE' : 'RECEPTION',
              receptionId: liee ? receptionId : undefined,
              afficheIds: liee ? afficheIds : [],
              bloquante: s.bloquante ?? true,
              donnees: NcDonneesSchema.parse({
                annonceur,
                theme,
                dossier: String(contNum),
                declarant: `Déclarant fictif ${centre}`,
                region: ['Nord', 'Sud', 'Ouest'][siteIndex],
                afficheur: `Agence fictive ${centre}`,
                lieu: centre,
                dateAff: lundi.toISOString().slice(0, 10),
                formats: [s.format % 2 ? '2 m² déroulant' : '2 m² fixe'],
                types: s.multi
                  ? ['Thèmes mélangés', 'Formats mélangés']
                  : [s.nc ?? s.agence ?? (s.bloquante ? 'Encre qui a coulé' : 'BL non conforme')],
                imprimeur: s.formulaire ? 'AUTRE' : imprimeur.libelle,
                imprimeurAutre: s.formulaire ? 'Imprimeur exemple JDD+' : '',
                transporteur: livreur.libelle,
                avarie: s.bloquante ? 'OUI' : 'NON',
                controle: ['Contrôle du visuel', 'Etat des affiches'],
                detailVisuel: ['Thèmes', 'Qualité impression'],
                statutEtat: s.bloquante ? 'Non utilisable' : 'Partiellement utilisables',
                commentaireNC: `JDD+ ${s.nom}. Scénario entièrement fictif.`,
                commentaireAgence: s.agence ? 'Réclamation fictive à examiner.' : '',
                qteRecue: '100',
                qteManquante: s.agence ? '15' : '',
                nbColis: '2',
                reserve: 'Exemple de réserves fictives.',
              }),
              fichiers: justificatif,
            })
            if (s.decision && nc.bloquante !== false)
              nc = await deciderNc(tx, coord, nc.id, {
                version: nc.version,
                decisions: s.multi ? ['Nouvelle préparation', s.decision] : [s.decision],
                commentaire: `Décision fictive : ${s.nom}`,
              })
            if (s.traite && nc.statut === 'En cours plateforme')
              nc = await deciderNc(tx, cheq, nc.id, {
                version: nc.version,
                decisions: [...nc.decisions, 'Traité par la plateforme'],
                commentaire: 'Traitement fictif confirmé par le chef d’équipe.',
              })
          }
          // Ajout explicite au J−3, y compris si la feuille de cette semaine existe déjà.
          await suiviJ3(tx, admin, dossier.id, formatSemaineIso(semaine), index)
          catalogue.push({
            centre,
            scenario: s.nom,
            dossier: contNum,
            afficheIds,
            ncId: nc?.id ?? null,
            semaine: formatSemaineIso(semaine),
          })
        },
        { timeout: 30000 },
      )
      crees++
    }
    for (let n = 0; n < 3; n++) {
      const theme = `JDD+ inconnue ${lot} ${centre} · ${['sans BL', 'avec BL et NC', 'signalée introuvable'][n]}`
      const existante = await db.affiche.findFirst({ where: { plateformeId: site.id, theme } })
      if (existante) {
        const nc = await db.nonConformite.findFirst({
          where: { receptionId: existante.receptionId ?? -1 },
        })
        catalogue.push({
          centre,
          scenario: theme,
          dossier: null,
          afficheIds: [existante.id],
          ncId: nc?.id ?? null,
          semaine: lot,
        })
        continue
      }
      const support = supports[n % 2]
      assert(support)
      await db.$transaction(async (tx) => {
        const bl =
          n === 1
            ? await enregistrerPhoto(tx, recep, {
                intitule: 'BL-fictif-inconnu.png',
                mimeType: 'image/png',
                contenuBase64: png,
              })
            : null
        const inconnue = await creerReceptionInconnue(
          tx,
          recep,
          CreerInconnueSchema.parse({
            plateformeId: site.id,
            supportId: support.id,
            theme,
            annonceur: `Client à identifier JDD+ ${centre}`,
            quantite: 30,
            allee: 'X',
            rayon: String(n + 1),
            sansBl: n !== 1,
            photoBlId: bl?.id ?? null,
            numeroBl: n === 1 ? `JPLUS-INC-${lot}-${site.id}` : '',
            nonConformite:
              n === 1
                ? {
                    types: ['Palettes non conformes'],
                    commentaire: 'Palette fictive à identifier et à décider.',
                  }
                : undefined,
          }),
        )
        if (n === 2) {
          const r = await tx.reception.findUniqueOrThrow({ where: { id: inconnue.receptionId } })
          await signalerIntrouvable(tx, recep, inconnue.afficheId, r.version)
        }
        const nc = await tx.nonConformite.findFirst({
          where: { receptionId: inconnue.receptionId },
        })
        catalogue.push({
          centre,
          scenario: theme,
          dossier: null,
          afficheIds: [inconnue.afficheId],
          ncId: nc?.id ?? null,
          semaine: lot,
        })
      })
    }
  }
  const repertoire = resolve(import.meta.dirname, '../../../docs/_travail')
  mkdirSync(repertoire, { recursive: true })
  // Reconstruire le catalogue complet sans modifier les scénarios existants.
  if (catalogue.length)
    writeFileSync(
      resolve(repertoire, `jdd-plus-${lot}.json`),
      JSON.stringify({ lot, catalogue }, null, 2) + '\n',
    )
  console.log(
    `seed:scenarios OK : ${crees} nouveaux dossiers ; ${catalogue.length} scénarios répertoriés sur les trois centres.`,
  )
} finally {
  await db.$disconnect()
}

async function suiviJ3(tx: Tx, admin: Identity, dossierId: number, semaine: string, index: number) {
  const sections = (await lireJ3(tx, admin, semaine)).sections.filter((s) =>
    s.candidats.some((c) => c.dossierId === dossierId),
  )
  for (const section of sections) {
    await ajouterJ3(tx, admin, {
      semaine,
      section: section.id,
      plateformeId: section.plateformeId,
      dossierIds: [dossierId],
    })
    const row = await tx.j3Ligne.findFirstOrThrow({
      where: {
        dossierId,
        feuille: { plateformeId: section.plateformeId, section: section.id, semaine },
      },
    })
    await modifierJ3(tx, admin, row.id, {
      version: row.version,
      donnees: J3DonneesSchema.parse({
        prepa: 'Équipe fictive JDD+',
        commerce: 'Contact fictif',
        type: index % 2 ? 'A' : 'V',
        region: section.id === 'nim' ? 'Sud' : 'Nord',
        ville: section.nom,
        impact: index % 3 ? 'NON' : 'OUI',
        typeImpact: index % 3 ? '' : 'Retard potentiel fictif',
        depart: semaine,
        go: index % 3 === 0 ? 'NO GO' : index % 3 === 1 ? 'GO' : '',
        goCond: 'Exemple fictif, décision à confirmer en exploitation.',
        imprimeur: 'Imprimeur fictif JDD centres',
        comm: 'JDD+ : saisies et coûts de démonstration.',
        livPrevue: 'À confirmer',
        surPtf: index % 3 === 0 ? 120 : null,
        surTech: index % 3 === 0 ? 75.5 : null,
      }),
    })
  }
}
