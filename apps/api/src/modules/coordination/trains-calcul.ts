// COO-P09 — calcul des trains à l'Instruction OK (RG-COO-200 à 203, 205) : reprise de la procédure legacy
// circe-develop BDD/.../p_u_associe_train.sql, exécutée dans la transaction de l'Instruction OK (CLAUDE.md §6).
// Écarts V2 assumés (HYPOTHÈSE Q-192) : faces sans identifiant de train ANNULÉES avec historique au lieu d'être
// supprimées ; bloc « Paris » (convention VPS_75 101 0004) non repris (Q-255) ; grain / seuil / arrondi de
// l'entretien en paramètres (Q-256).
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { StatutProduction } from '../../generated/prisma/client.ts'
import { lireParametreNombre, lireParametreTexte } from '../reception/parametres.ts'

import { CIRCE_AUTOMATIQUE, lireTypesVisuels } from './integration-commun.ts'
import { COO } from './permissions.ts'
import { TRANSITIONS_FACE } from './statuts-trains.ts'

/** Faces encore « avant l'Instruction OK » que le calcul prend en charge (transitions 0 / 1 / 3 → 2). */
const FACES_A_CALCULER: StatutProduction[] = ['A_TRAITER', 'EN_COURS', 'ERREUR']
/** RG-COO-200 : statuts pris en compte pour la version du train (5 à 10). */
const STATUTS_VERSION: StatutProduction[] = [
  'A_IMPRIMER',
  'PREPARE',
  'A_EXPEDIER',
  'TERMINE',
  'EXPORT_PREPA',
  'AU_ROULAGE',
]
/** RG-COO-223 : faces en production ou au-delà, jamais modifiées par le calcul. */
const STATUTS_FACE_EN_PRODUCTION: StatutProduction[] = [
  'PREPARE',
  'A_EXPEDIER',
  'TERMINE',
  'EXPORT_PREPA',
  'AU_ROULAGE',
]

// RG-COO-201 : code de position de l'instruction (tip_ins_code) → ordre réel : 1 début (0), 2 fin (99),
// 3 fin − 1 (98), 4 milieu (15) ; sinon l'ordre déjà posé, à défaut l'ordre proposé (= rang).
export function ordreReel(
  tipInsCode: number | null,
  ordrePropose: number | null,
  ordreActuel: number | null,
): number | null {
  const fixe: Record<number, number> = { 1: 0, 2: 99, 3: 98, 4: 15 }
  if (tipInsCode !== null && tipInsCode in fixe) return fixe[tipInsCode] ?? null
  return ordreActuel ?? ordrePropose
}

const pad = (v: number | string, n: number) => String(v).padStart(n, '0').slice(-n)

/** Conversion legacy `convert(varchar(1), x)` : au-delà d'un caractère, SQL Server renvoie « * ». */
const unCaractere = (v: number) => (String(v).length === 1 ? String(v) : '*')

// RG-COO-200 : train_id = AA + SS (semaine de départ) + secteur (3) + département (2) + commune (3) +
// n° d'emplacement (4) + n° de train (1) + version (1). Une partie absente → pas d'identifiant (legacy : la
// concaténation SQL avec NULL donne NULL).
export function identifiantTrain(
  f: {
    depAnbas: number | null
    depSembas: number | null
    emplSectCode: number | null
    emplDepaCode: string | null
    commNumord: number | null
    emplNumord: number | null
    train: number | null
  },
  version: number,
): string | null {
  const parts = [
    f.depAnbas,
    f.depSembas,
    f.emplSectCode,
    f.emplDepaCode,
    f.commNumord,
    f.emplNumord,
    f.train,
  ]
  if (parts.some((p) => p === null || p === '')) return null
  return (
    pad(f.depAnbas ?? 0, 2) +
    pad(f.depSembas ?? 0, 2) +
    pad(f.emplSectCode ?? 0, 3) +
    pad(f.emplDepaCode ?? '', 2) +
    pad(f.commNumord ?? 0, 3) +
    pad(f.emplNumord ?? 0, 4) +
    unCaractere(f.train ?? 0) +
    unCaractere(version)
  )
}

// RG-COO-203 : identifiant d'un train d'entretien = AA + SS + secteur (3) + dernier chiffre de l'atelier +
// 2 derniers chiffres du dossier + compteur (6) + « 19 ».
export function identifiantTrainEntretien(p: {
  depAnbas: number | null
  depSembas: number | null
  emplSectCode: number | null
  atelierId: number | null
  contNum: number | null
  compteur: number
}): string | null {
  if (p.depAnbas === null || p.depSembas === null || p.emplSectCode === null) return null
  if (p.atelierId === null) return null
  return (
    pad(p.depAnbas, 2) +
    pad(p.depSembas, 2) +
    pad(p.emplSectCode, 3) +
    pad(p.atelierId, 1) +
    pad(p.contNum ?? 0, 2) +
    pad(p.compteur, 6) +
    '19'
  )
}

// RG-COO-202 : guillemets et apostrophes → espaces ; thème de moins de 3 caractères complété par « --- ».
export function nettoyerTexte(t: string | null): string | null {
  return t === null ? null : t.replace(/'/g, ' ').replace(/"/g, ' ')
}
export function nettoyerTheme(t: string | null): string {
  const base = (t ?? '').length < 3 ? `${t ?? ''}---` : (t ?? '')
  return base.replace(/'/g, ' ').replace(/"/g, ' ')
}

export interface VisuelARepartir {
  id: number
  afchIdent: number | null
  theme: string | null
  pourcentage: number
}

const arrondi = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d

// RG-COO-202 : répartition des thèmes (type 10) sur les faces restantes, au prorata des pourcentages,
// faces parcourues dans l'ordre secteur / département / commune / adresse (curseur C1 du legacy) :
// nb_tot = int(fréquence × nombre de faces) ; à chaque face, le visuel d'id le plus grand dont l'avancement
// ≤ fréquence et qui a encore des faces à recevoir, sinon le plus petit id. Fonction pure.
export function repartirThemes(
  facesSansTheme: readonly number[],
  visuels: readonly VisuelARepartir[],
  nbTotalFaces: number,
  dejaAffectees: ReadonlyMap<number, number>,
): Map<number, VisuelARepartir> {
  const affectation = new Map<number, VisuelARepartir>()
  if (visuels.length === 0 || facesSansTheme.length === 0) return affectation
  const etat = visuels.map((v) => {
    // ANO-040 : fréquence au centième (pourcentage entier), quota en arithmétique entière
    // (0,58 × 50 = 28,999… en flottant donnerait 28 au lieu de 29).
    const pourcentEntier = Math.round(v.pourcentage)
    const frequence = pourcentEntier / 100
    const nbTot = Math.trunc((pourcentEntier * nbTotalFaces) / 100)
    const nbAffecte = v.afchIdent === null ? 0 : (dejaAffectees.get(v.afchIdent) ?? 0)
    return {
      v,
      frequence,
      encours: arrondi(v.pourcentage / 100, 5),
      nbAffecte,
      nbRestant: nbTot - nbAffecte,
    }
  })
  // Legacy : encours = nb_restant / @nb en division ENTIÈRE (int / int).
  for (const e of etat) e.encours = Math.trunc(e.nbRestant / facesSansTheme.length)
  for (const faceId of facesSansTheme) {
    const eligibles = etat.filter((e) => e.encours <= e.frequence && e.nbRestant > 0)
    const choisi =
      eligibles.length > 0
        ? eligibles.reduce((a, b) => (b.v.id > a.v.id ? b : a))
        : etat.reduce((a, b) => (b.v.id < a.v.id ? b : a))
    affectation.set(faceId, choisi.v)
    choisi.nbRestant--
    choisi.nbAffecte++
    const compteur = etat.reduce((s, e) => s + e.nbAffecte, 0)
    if (compteur !== 0) for (const e of etat) e.encours = arrondi(e.nbAffecte / compteur, 5)
  }
  return affectation
}

// RG-COO-203 (MODIFIÉE, HYPOTHÈSE Q-256) : nombre de faces d'entretien d'un groupe : 0 sous le seuil ; sinon
// nombre × % / 100 arrondi au supérieur (cible) ou au plus proche (legacy `round`).
export function nombreEntretien(
  nombreFaces: number,
  pourcentage: number,
  seuil: number,
  arrondiMode: string,
): number {
  if (nombreFaces < seuil) return 0
  // ANO-040 : arithmétique entière (pourcentage au centième) : pas d'erreur d'arrondi flottant.
  const dixMilliemes = nombreFaces * Math.round(pourcentage * 100)
  return arrondiMode === 'PROCHE'
    ? Math.floor((dixMilliemes + 5000) / 10000)
    : Math.ceil(dixMilliemes / 10000)
}

/** Ordre de parcours legacy (NULL en premier en tri croissant SQL Server). */
function comparerParcours(
  a: {
    id: number
    emplSectCode: number | null
    emplDepaCode: string | null
    commNumord: number | null
    emplAdresse1: string | null
  },
  b: typeof a,
): number {
  const cmp = <T extends number | string>(x: T | null, y: T | null) =>
    x === y ? 0 : x === null ? -1 : y === null ? 1 : x < y ? -1 : 1
  return (
    cmp(a.emplSectCode, b.emplSectCode) ||
    cmp(a.emplDepaCode, b.emplDepaCode) ||
    cmp(a.commNumord, b.commNumord) ||
    cmp(a.emplAdresse1, b.emplAdresse1) ||
    a.id - b.id
  )
}

export interface ResultatCalculTrains {
  facesCalculees: number
  facesEntretien: number
  facesAnnulees: number
  trains: number
}

/** Passage d'une face à un nouveau statut, sous verrou de version, avec historique (RG-COO-307). */
async function majFace(
  tx: Tx,
  face: { id: number; version: number; statut: StatutProduction },
  data: Record<string, unknown>,
  historique: {
    vers: StatutProduction
    parId: number | null
    regle: string
    motif?: string
  } | null,
) {
  await updateWithVersion({
    expectedVersion: face.version,
    update: (where) =>
      tx.faceTrain.updateMany({
        where: { id: face.id, ...where },
        data: { ...data, ...bumpVersion },
      }),
    ...COO.version,
  })
  if (historique && historique.vers !== face.statut) {
    if (!TRANSITIONS_FACE[face.statut].includes(historique.vers))
      throw new Error(`Transition de face non listée : ${face.statut} → ${historique.vers}`)
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'FACE_TRAIN',
      entiteId: face.id,
      ancien: face.statut,
      nouveau: historique.vers,
      parId: historique.parId,
      regle: historique.regle,
      ...(historique.motif ? { motif: historique.motif } : {}),
    })
  }
}

// RG-COO-200 à 203 et 205 : calcul des trains d'une instruction qui passe Instruction OK (manuelle ou
// automatique), dans la transaction de l'appelant. `parId` null = Circé (automatique).
export async function calculerTrains(
  tx: Tx,
  instructionCode: string,
  parId: number | null,
): Promise<ResultatCalculTrains> {
  const instruction = await tx.instruction.findUniqueOrThrow({ where: { code: instructionCode } })
  const faces = (
    await tx.faceTrain.findMany({
      where: { instructionCode, statut: { in: FACES_A_CALCULER } },
    })
  ).sort(comparerParcours)
  const resultat: ResultatCalculTrains = {
    facesCalculees: 0,
    facesEntretien: 0,
    facesAnnulees: 0,
    trains: 0,
  }
  const types = lireTypesVisuels(await lireParametreTexte(tx, 'integration.typesVisuels'))
  const tousVisuels = await tx.instructionVisuel.findMany({
    where: { instructionCode },
    orderBy: { id: 'asc' },
  })
  // RG-COO-202 : visuels de type « visuel » (legacy tpr_id 10) ; bandeaux = type BDX (legacy 2).
  // HYPOTHÈSE Q-192 (2) : un visuel dont le type n'est pas repris au référentiel (null) est un visuel.
  const estBandeau = (tpr: number | null) => tpr !== null && tpr === types.bdx
  const visuels: VisuelARepartir[] = tousVisuels
    .filter((v) => !estBandeau(v.typePreparationId))
    .map((v) => ({
      id: v.id,
      afchIdent: v.afchIdent,
      theme: v.theme,
      pourcentage: Number(v.pourcentage ?? 0),
    }))
  const bandeau100 = tousVisuels.find(
    (v) => estBandeau(v.typePreparationId) && Number(v.pourcentage ?? 0) === 100,
  )
  const details = await tx.instructionDetail.findMany({ where: { instructionCode } })

  // Calcul en mémoire (table #face du legacy).
  type Calcul = {
    theme: string | null
    themeId: number | null
    repiquage: string | null
    repiquageId: number | null
    visuelId: number | null
    ftType: string | null
    ordrePropose: number | null
    ordreReel: number | null
    versionTrain: number
  }
  const calc = new Map<number, Calcul>()
  for (const f of faces) {
    const ordrePropose = f.rang
    // RG-COO-200 : version = max des versions (faces 5 à 10, même emplacement / train / semaine) + 1, sinon 0.
    let versionTrain = 0
    if (f.emplSectCode !== null && f.train !== null) {
      const max = await tx.faceTrain.aggregate({
        _max: { versionTrain: true },
        where: {
          emplSectCode: f.emplSectCode,
          emplDepaCode: f.emplDepaCode,
          commNumord: f.commNumord,
          emplNumord: f.emplNumord,
          train: f.train,
          depSembas: f.depSembas,
          depAnbas: f.depAnbas,
          statut: { in: STATUTS_VERSION },
        },
      })
      const m = await tx.faceTrain.count({
        where: {
          emplSectCode: f.emplSectCode,
          emplDepaCode: f.emplDepaCode,
          commNumord: f.commNumord,
          emplNumord: f.emplNumord,
          train: f.train,
          depSembas: f.depSembas,
          depAnbas: f.depAnbas,
          statut: { in: STATUTS_VERSION },
        },
      })
      versionTrain = m > 0 ? (max._max.versionTrain ?? 0) + 1 : 0
    }
    const c: Calcul = {
      theme: f.theme,
      themeId: f.themeId,
      repiquage: f.repiquage,
      repiquageId: f.repiquageId,
      visuelId: f.visuelId,
      ftType: f.ftType,
      ordrePropose,
      ordreReel: ordreReel(instruction.tipInsCode, ordrePropose, f.ordreReel),
      versionTrain,
    }
    // RG-COO-202 : exceptions (instruction_detail) affectées à la face de même cadre.
    for (const d of details.filter((x) => x.cadrIdent === f.cadrIdent)) {
      if (d.theme !== null) {
        c.theme = d.theme
        c.themeId = d.afchIdent
        c.ftType = 'exception'
      }
      if (d.repiquage !== null) {
        c.repiquage = d.repiquage
        c.repiquageId = d.repiquageIdent
      }
    }
    // « On recroise avec le visuel » (legacy) : restreint aux visuels de l'instruction.
    const visuel = tousVisuels.find((v) => c.themeId !== null && v.afchIdent === c.themeId)
    if (visuel) c.visuelId = visuel.id
    calc.set(f.id, c)
  }
  const dejaAffectees = new Map<number, number>()
  for (const c of calc.values())
    if (c.themeId !== null) dejaAffectees.set(c.themeId, (dejaAffectees.get(c.themeId) ?? 0) + 1)
  const sansTheme = faces.filter((f) => calc.get(f.id)?.themeId === null).map((f) => f.id)
  for (const [faceId, v] of repartirThemes(sansTheme, visuels, faces.length, dejaAffectees)) {
    const c = calc.get(faceId)
    if (!c) continue
    c.theme = v.theme
    c.themeId = v.afchIdent
    c.visuelId = v.id
    c.ftType = 'face'
  }
  const annonceur = nettoyerTexte(instruction.annonceur)
  const trainIds = new Set<string>()
  for (const f of faces) {
    const c = calc.get(f.id)
    if (!c) continue
    // RG-COO-202 : bandeau à 100 % non traité en exception → repiquage de toutes les faces.
    if (bandeau100 && c.repiquage === null) {
      c.repiquage = bandeau100.theme
      c.repiquageId = bandeau100.afchIdent
    }
    const trainId = identifiantTrain(f, c.versionTrain)
    if (trainId) trainIds.add(trainId)
    await majFace(
      tx,
      f,
      {
        theme: nettoyerTheme(c.theme),
        themeId: c.themeId,
        repiquage: nettoyerTexte(c.repiquage),
        repiquageId: c.repiquageId,
        visuelId: c.visuelId,
        statut: 'INSTRUCTION_OK',
        ftType: c.ftType,
        trainId,
        versionTrain: c.versionTrain,
        ordrePropose: c.ordrePropose,
        ordreReel: c.ordreReel,
        contAnnonc: annonceur,
        fractionnee: false,
        updatedById: parId,
      },
      { vers: 'INSTRUCTION_OK', parId, regle: 'RG-COO-202' },
    )
    resultat.facesCalculees++
  }

  // RG-COO-203 : faces d'entretien (grain, seuil, arrondi : paramètres, HYPOTHÈSE Q-256).
  const pourcentage =
    instruction.entretien ?? (await lireParametreNombre(tx, 'coordination.entretienDefaut'))
  const grain = await lireParametreTexte(tx, 'trains.entretienGrain')
  const seuil = await lireParametreNombre(tx, 'trains.entretienSeuil')
  const arrondiMode = await lireParametreTexte(tx, 'trains.entretienArrondi')
  const calculees = await tx.faceTrain.findMany({
    where: { id: { in: faces.map((f) => f.id) } },
    orderBy: { id: 'asc' },
  })
  const groupes = new Map<string, typeof calculees>()
  for (const f of calculees) {
    const themeRepiquage = `${f.repiquage === null ? '' : `${f.repiquage}#`}${f.theme ?? ''}`
    const cle =
      grain === 'VILLE'
        ? [
            f.destinataireId,
            f.themeId,
            f.emplSectCode,
            f.depSembas,
            f.depAnbas,
            themeRepiquage,
            f.supportId,
          ]
        : [f.afficheurId, f.themeId, f.depSembas, f.depAnbas, themeRepiquage, f.supportId]
    const k = JSON.stringify(cle)
    groupes.set(k, [...(groupes.get(k) ?? []), f])
  }
  for (const groupe of groupes.values()) {
    const premiere = groupe[0]
    if (!premiere) continue
    const combien = nombreEntretien(groupe.length, pourcentage, seuil, arrondiMode)
    for (let i = 0; i < combien; i++) {
      const compteur =
        (await tx.faceTrain.count({
          where: {
            depSembas: premiere.depSembas,
            depAnbas: premiere.depAnbas,
            emplSectCode: premiere.emplSectCode,
            cadreLib: 'entretien',
          },
        })) + 1
      const trainId = identifiantTrainEntretien({
        depAnbas: premiere.depAnbas,
        depSembas: premiere.depSembas,
        emplSectCode: premiere.emplSectCode,
        atelierId: instruction.atelierId,
        contNum: instruction.contNum,
        compteur,
      })
      // Sans secteur ni atelier, l'identifiant ne se calcule pas : le legacy créait puis supprimait la face
      // (train_id NULL) ; la V2 ne la crée pas et le trace (HYPOTHÈSE Q-192 (3)).
      if (!trainId) {
        await ecrireJournal(tx, {
          typeEntite: 'INSTRUCTION',
          entiteId: instructionCode,
          action: 'CALCUL_TRAINS',
          parId,
          nouvelleValeur: 'Face d’entretien non créée : emplacement (secteur) ou atelier inconnu.',
          complement: 'RG-COO-203',
        })
        break
      }
      const creee = await tx.faceTrain.create({
        data: {
          instructionCode,
          trainId,
          versionTrain: 1,
          ftType: 'entretien',
          destinataireId: premiere.destinataireId,
          themeId: premiere.themeId,
          emplSectCode: premiere.emplSectCode,
          depSembas: premiere.depSembas,
          depAnbas: premiere.depAnbas,
          statut: 'INSTRUCTION_OK',
          atelierId: instruction.atelierId,
          theme: premiere.theme,
          repiquage: premiere.repiquage,
          cadreLib: 'entretien',
          cadrIdent: 0,
          // HYPOTHÈSE Q-192 (4) : départ du groupe (le legacy posait la date du calcul).
          dateDepart: premiere.dateDepart,
          supportId: premiere.supportId,
          contNum: instruction.contNum,
          contAnnonc: annonceur,
          ordrePropose: 1,
          ordreReel: 1,
          afficheurId: null,
          afficheurNom: 'ENTRETIEN',
          contSembas: premiere.depSembas,
          contAnbas: premiere.depAnbas,
          createdById: parId,
        },
      })
      await ecrireHistoriqueStatut(tx, {
        typeEntite: 'FACE_TRAIN',
        entiteId: creee.id,
        ancien: null,
        nouveau: 'INSTRUCTION_OK',
        parId,
        regle: 'RG-COO-203',
      })
      trainIds.add(trainId)
      resultat.facesEntretien++
    }
  }

  // RG-COO-205 (1) : deux faces non d'entretien d'un même train sur le même cadre → la plus récente gardée,
  // les autres ANNULÉES (train vidé) avec historique ; (2) un seul afficheur par train (celui de la face la
  // plus récente). RG-COO-223 : les faces en production ne sont jamais touchées.
  if (trainIds.size > 0) {
    const dansTrains = await tx.faceTrain.findMany({
      where: {
        trainId: { in: [...trainIds] },
        OR: [{ ftType: null }, { NOT: { ftType: 'entretien' } }],
        NOT: [{ statut: 'ANNULE' }, { statut: { in: STATUTS_FACE_EN_PRODUCTION } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const vus = new Set<string>()
    const gardees: typeof dansTrains = []
    for (const f of dansTrains) {
      const k = `${f.trainId ?? ''}|${String(f.cadrIdent)}`
      if (!vus.has(k)) {
        vus.add(k)
        gardees.push(f)
        continue
      }
      await majFace(
        tx,
        f,
        { statut: 'ANNULE', trainId: null, updatedById: parId },
        {
          vers: 'ANNULE',
          parId,
          regle: 'RG-COO-205',
          motif: 'Doublon de cadre dans le train : face la plus récente conservée.',
        },
      )
      await ecrireJournal(tx, {
        typeEntite: 'FACE_TRAIN',
        entiteId: f.id,
        action: 'ANNULATION_FACE_DOUBLON',
        parId,
        ancienneValeur: f.trainId,
        nouvelleValeur: 'ANNULE',
        complement: 'RG-COO-205',
      })
      resultat.facesAnnulees++
    }
    const parTrain = new Map<string, typeof gardees>()
    for (const f of gardees)
      parTrain.set(f.trainId ?? '', [...(parTrain.get(f.trainId ?? '') ?? []), f])
    for (const fs of parTrain.values()) {
      const afficheurs = new Set(fs.map((f) => f.afficheurId).filter((a) => a !== null))
      const recente = fs[0]
      if (afficheurs.size <= 1 || !recente) continue
      for (const f of fs.slice(1))
        if (f.afficheurId !== recente.afficheurId)
          await majFace(
            tx,
            f,
            {
              afficheurId: recente.afficheurId,
              afficheurNom: recente.afficheurNom,
              updatedById: parId,
            },
            null,
          )
    }
  }
  // RG-COO-205 (3) : face « Instruction ok » sans identifiant de train → ANNULÉE avec historique (le legacy la
  // supprimait ; HYPOTHÈSE Q-192 (3), CLAUDE.md §6 : pas d'annulation silencieuse).
  const sansTrain = await tx.faceTrain.findMany({
    where: { instructionCode, statut: 'INSTRUCTION_OK', trainId: null },
  })
  for (const f of sansTrain) {
    await majFace(
      tx,
      f,
      { statut: 'ANNULE', updatedById: parId },
      {
        vers: 'ANNULE',
        parId,
        regle: 'RG-COO-205',
        motif: 'Identifiant de train non calculable (emplacement inconnu).',
      },
    )
    resultat.facesAnnulees++
  }
  resultat.trains = trainIds.size
  // Instruction sans face : rien n'a été calculé, rien à tracer.
  if (resultat.facesCalculees + resultat.facesEntretien + resultat.facesAnnulees === 0)
    return resultat
  await ecrireJournal(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: instructionCode,
    action: 'CALCUL_TRAINS',
    parId,
    nouvelleValeur: `${String(resultat.facesCalculees)} face(s) réparties sur ${String(resultat.trains)} train(s), ${String(resultat.facesEntretien)} face(s) d'entretien, ${String(resultat.facesAnnulees)} face(s) annulée(s).`,
    ...(parId === null ? { complement: CIRCE_AUTOMATIQUE } : {}),
    donnees: resultat,
  })
  return resultat
}
