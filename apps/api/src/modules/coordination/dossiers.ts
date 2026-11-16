// COO-P01 — liste des dossiers de « Validation admin et Instruction OK » (ECR-COO-01, socle) :
// une ligne par dossier, statut de préparation (RG-COO-063) et instructions (RG-COO-040), périmètre
// atelier / site (RG-COO-167). COO-P03 : pastille de validation admin (RG-COO-019), cas sûrs (RG-COO-011).
import { formatSemaineIso, lireSemaineIso, type ListeDossiersQuery } from '@circe/shared'
import { lireTypes, typeDe } from './unitaire.ts'
import { lireParametreTexte } from '../reception/parametres.ts'
import { lireDeadline } from './reservations.ts'
import { groupesAVerifier, lignesThemeModifie } from './themes.ts'
import type { Db } from '../../core/db.ts'
import type { Identity } from '../../core/identity.ts'
import { hasPermission } from '../../core/permissions/permissions.ts'
import type { Prisma, StatutInstruction } from '../../generated/prisma/client.ts'
import type { Tx } from '../../core/transaction.ts'
import { dossierDuPerimetre, positionProposee } from './edition.ts'
import { donneesNariman, ecartDeLignes, ecartDossier, motifsNariman } from './instruction-ok.ts'
import { NotFoundError } from '../../core/errors.ts'
import { assertDroitCoordination, assertPerimetreAtelier, peutVoirAtelier } from './permissions.ts'
import { TRANSITIONS_INSTRUCTION_UTILISATEUR } from './statuts.ts'
import { affichesDesDossiers, resumeValidation, type AfficheDuDossier } from './validation-admin.ts'
import {
  affichesSurLignesAnnulees,
  marqueEtatReservations,
  numeroVisibleSuiviProd,
} from './effets-validation.ts'

type Action = 'A_TRAITER' | 'EN_COURS' | 'ANNULE' | 'INSTRUCTION_OK'

/** Actions proposées : transitions permises ET droit de l'utilisateur (confort d'affichage ; le service revérifie). */
function actionsPour(identity: Identity, statut: StatutInstruction): Action[] {
  return (TRANSITIONS_INSTRUCTION_UTILISATEUR[statut] as StatutInstruction[])
    .filter(
      (v): v is Action =>
        v === 'A_TRAITER' || v === 'EN_COURS' || v === 'ANNULE' || v === 'INSTRUCTION_OK',
    )
    .filter((v) =>
      hasPermission(
        identity,
        v === 'ANNULE' || statut === 'ANNULE'
          ? 'instruction.annuler'
          : 'instruction.instruction_ok',
      ),
    )
}

/** RG-COO-042 / 044 : mode de l'Instruction OK lu en base (texte libre côté SQLite). */
function modeIok(v: string | null): 'AUTO' | 'MANUEL' | null {
  return v === 'AUTO' ? 'AUTO' : v === 'MANUEL' ? 'MANUEL' : null
}

type InstructionAvecAtelier = Prisma.InstructionGetPayload<{
  include: { atelier: { include: { plateforme: { select: { nom: true } } } } }
}>

/** ECR-COO-01 / 02 : dossiers à thème proche à vérifier (RG-COO-069) et à thème modifié dans Broadcast
 * (RG-COO-068), calculés une fois par lecture ; `de` donne les pastilles « Visuels » d'un dossier. */
async function marquesVisuels(db: Db, identity: Identity, maintenant: Date) {
  const plateformes = identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds
  const proches = new Set(
    (await groupesAVerifier(db, identity, maintenant)).themes.flatMap((g) => g.dossiers),
  )
  const modifies = new Set(
    (await lignesThemeModifie(db, plateformes))
      .map((l) => l.contNum)
      .filter((c): c is number => c !== null),
  )
  return {
    de: (contNum: number, lignes: { theme: string | null; etatLigne: string }[]) => ({
      nb: new Set(lignes.filter((l) => l.etatLigne === 'ACTIVE' && l.theme).map((l) => l.theme))
        .size,
      procheAVerifier: proches.has(contNum),
      modifieBroadcast: modifies.has(contNum),
    }),
  }
}

/** Une ligne de dossier (ECR-COO-01) à partir des instructions visibles et des départs des lignes attendues. */
async function ligneDossier(
  client: Db | Tx,
  identity: Identity,
  d: {
    id: number
    version: number
    contNum: number
    annonceur: string | null
    statut: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE'
  },
  instructions: InstructionAvecAtelier[],
  departsLignes: string[],
  affiches: AfficheDuDossier[],
  deadline: (s: { annee: number; semaine: number }) => Date,
  maintenant: Date,
  visuels: { nb: number; procheAVerifier: boolean; modifieBroadcast: boolean },
  /** Valeurs déjà lues par lot (liste des dossiers, ANO-062) ; absentes : lues ici (fiche d'un dossier). */
  precalcule?: { ecart: number | null; correctionLe: Date | null },
) {
  const departs = new Set<string>(departsLignes)
  for (const i of instructions) {
    if (i.contAnbas && i.contSembas)
      departs.add(formatSemaineIso({ annee: i.contAnbas, semaine: i.contSembas }))
  }
  // RG-COO-055 : écart Broadcast / Circé du dossier.
  // RG-COO-167 : écart lu sur les lignes du périmètre de l'utilisateur (HYPOTHÈSE Q-183 (11)).
  const ecart = precalcule
    ? precalcule.ecart
    : await ecartDossier(
        client,
        d.contNum,
        identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds,
      )
  const lignes = []
  for (const i of instructions) {
    // RG-COO-042 / 055 : motifs « En cours » (seulement pour une instruction En cours d'un dossier reçu).
    const motifs =
      i.statut === 'EN_COURS' && d.statut === 'PREPARATION_RECUE'
        ? motifsNariman(await donneesNariman(client, i))
        : []
    lignes.push({
      code: i.code,
      version: i.version,
      statut: i.statut,
      atelier: i.atelier
        ? { id: i.atelier.id, libelle: i.atelier.libelle, plateforme: i.atelier.plateforme.nom }
        : null,
      depart:
        i.contAnbas && i.contSembas
          ? formatSemaineIso({ annee: i.contAnbas, semaine: i.contSembas })
          : null,
      type: i.typeInstruction,
      commentaire: i.commentaire,
      // RG-COO-062 : dossier annulé → aucune action (« — ») ; RG-COO-052 : pas d'Instruction OK avant la prépa.
      actions:
        d.statut === 'ANNULE'
          ? []
          : actionsPour(identity, i.statut).filter(
              (a) => a !== 'INSTRUCTION_OK' || d.statut === 'PREPARATION_RECUE',
            ),
      iokMode: modeIok(i.iokMode),
      entretien: i.entretien,
      position: i.tipInsCode,
      motifs,
      positionProposee: positionProposee(i.commentaire),
    })
  }
  // RG-COO-019 / RG-COO-020 : validation admin calculée à partir des affiches reçues (indépendante de la prépa).
  const va = resumeValidation(
    affiches.map((a) => a.etat),
    d.statut === 'ANNULE',
  )
  const iokAFaire =
    d.statut === 'PREPARATION_RECUE' && instructions.some((i) => i.statut === 'EN_COURS')
  const ecartAFaire = ecart !== null && ecart !== 0
  const correctionLe = precalcule
    ? precalcule.correctionLe
    : ((
        await client.demandeCorrection.findFirst({
          where: { dossierId: d.id },
          orderBy: { le: 'desc' },
        })
      )?.le ?? null)
  // RG-COO-066 / 076 : deadline Pré-Prod (envoi de la prépa) du premier départ, tant que la prépa n'est pas
  // reçue ; dépassée → teinte critique de la ligne (ECR-COO-01).
  const premier = [...departs].sort()[0]
  const dl = d.statut === 'A_TRAITER' && premier ? deadline(lireSemaineIso(premier)) : null
  return {
    id: d.id,
    version: d.version,
    dossier: d.contNum,
    deadlinePrepa: dl?.toISOString() ?? null,
    // ECR-COO-01 colonne masquée « Visuels » : nb de thèmes et pastilles thème proche (RG-COO-069) /
    // modifié dans Broadcast (RG-COO-068).
    pastillesVisuels: visuels,
    deadlineDepassee: dl !== null && maintenant > dl,
    annonceur: d.annonceur,
    preparation: d.statut,
    departs: [...departs].sort(),
    instructions: lignes,
    ecart,
    validationAdmin: {
      ...va,
      // RG-COO-011 (HYPOTHÈSE Q-185 (4), maquette `casSurs`) : seule la validation reste à faire, sans doute.
      casSur: va.etat === 'A_CONFIRMER' && va.doutes === 0 && !iokAFaire && !ecartAFaire,
    },
    // RG-COO-060 : à faire = validation admin à confirmer, Instruction OK en cours (prépa reçue :
    // RG-COO-052, ANO-025) ou écart ; dossier annulé : rien à faire (RG-COO-062).
    aFaire: d.statut !== 'ANNULE' && (va.etat === 'A_CONFIRMER' || iokAFaire || ecartAFaire),
    correctionDemandeeLe: correctionLe?.toISOString() ?? null,
  }
}

export async function listerDossiers(db: Db, identity: Identity, q: ListeDossiersQuery) {
  // RG-COO-166 : consultation (coord, cheq, recep, admin, com).
  assertDroitCoordination(identity, 'instruction.consulter')
  // RG-COO-167 : un atelier demandé hors périmètre est refusé (403), pas seulement filtré.
  if (q.atelierId !== undefined) {
    const atelier = await db.atelier.findUnique({
      where: { id: q.atelierId },
      select: { id: true, plateformeId: true },
    })
    if (!atelier) throw new NotFoundError('Atelier introuvable')
    assertPerimetreAtelier(identity, atelier)
  }
  // ANO-035 : lecture par paquets de dossiers (limite de paramètres de SQLite dépassée au-delà de quelques
  // milliers de dossiers : P2029) ; les dossiers hors périmètre sont écartés avant tout calcul.
  const tous = await db.dossier.findMany({
    where: {
      ...(q.dossier ? { contNum: q.dossier } : {}),
      ...(q.preparation ? { statut: q.preparation } : {}),
    },
    select: { id: true },
    orderBy: { contNum: 'asc' },
  })
  const deadline = lireDeadline(await lireParametreTexte(db, 'coordination.deadlinePrepa'))
  const maintenant = new Date()
  const marques = await marquesVisuels(db, identity, maintenant)
  const typesUnitaire = q.pour === 'FIXE' || q.pour === 'PLIAGE' ? await lireTypes(db) : null
  const items = []
  const PAQUET = 400
  for (let debut = 0; debut < tous.length; debut += PAQUET) {
    const dossiers = await db.dossier.findMany({
      where: { id: { in: tous.slice(debut, debut + PAQUET).map((d) => d.id) } },
      include: {
        instructions: {
          include: { atelier: { include: { plateforme: { select: { nom: true } } } } },
          orderBy: [{ contAnbas: 'asc' }, { contSembas: 'asc' }, { code: 'asc' }],
        },
      },
      orderBy: { contNum: 'asc' },
    })
    // RG-COO-167 : lignes attendues du périmètre (dossier sans instruction encore reçue).
    const lignes = await db.receptionAttendue.findMany({
      where: {
        contNum: { in: dossiers.map((d) => d.contNum) },
        ...(identity.perimetre.toutesPlateformes
          ? {}
          : { plateformeId: { in: identity.perimetre.plateformeIds } }),
      },
      select: {
        contNum: true,
        semAnnee: true,
        semNum: true,
        theme: true,
        etatLigne: true,
        themeExclu: true,
        qteBc: true,
        qtePrepa: true,
        atelierId: true,
        atelier: { select: { type: true } },
      },
    })
    // ANO-062 : dernière demande de correction de chaque dossier du paquet, lue en UNE requête.
    const corrections = new Map<number, Date>()
    for (const c of await db.demandeCorrection.findMany({
      where: { dossierId: { in: dossiers.map((d) => d.id) } },
      orderBy: { le: 'asc' },
      select: { dossierId: true, le: true },
    }))
      corrections.set(c.dossierId, c.le)
    // EX-NEW-COO-001 : les contextes fixe/pliage viennent des types de préparation structurés.
    const repTypes = typesUnitaire
      ? await db.repartition.findMany({
          where: { contNum: { in: dossiers.map((d) => d.contNum) } },
          select: { contNum: true, typePreparationId: true },
        })
      : []
    const bcTypes = typesUnitaire
      ? await db.prepaBroadcast.findMany({
          where: { idDossierDeVenteChapeau: { in: dossiers.map((d) => d.contNum) } },
          select: { idDossierDeVenteChapeau: true, idTypePreparation: true },
        })
      : []
    const dossierDuType = (contNum: number | null) => {
      if (!typesUnitaire) return true
      const type = q.pour === 'PLIAGE' ? 'pliage' : 'fixe'
      const connus = [
        ...repTypes.filter((r) => r.contNum === contNum).map((r) => r.typePreparationId),
        ...bcTypes
          .filter((r) => r.idDossierDeVenteChapeau === contNum)
          .map((r) => r.idTypePreparation),
      ]
      return connus.length
        ? connus.some((id) => typeDe({ typePreparationId: id }, typesUnitaire) === type)
        : type === 'fixe'
    }
    // `pour=DEROULANT` : instructions des ateliers déroulants seulement ; un dossier sans telle instruction est écarté.
    const retenue = (i: (typeof dossiers)[number]['instructions'][number]) =>
      peutVoirAtelier(identity, i.atelier) &&
      (!q.atelierId || i.atelierId === q.atelierId) &&
      (q.pour === 'DEROULANT'
        ? i.atelier?.type === 'SCROLL'
        : q.pour === 'FIXE' || q.pour === 'PLIAGE'
          ? i.atelier?.type === 'FIXE' && dossierDuType(i.contNum)
          : true)
    const visibles = dossiers.filter(
      (d) =>
        d.instructions.some(retenue) ||
        (q.atelierId === undefined &&
          (q.pour === undefined ||
            ((q.pour === 'FIXE' || q.pour === 'PLIAGE') && dossierDuType(d.contNum))) &&
          lignes.some(
            (l) =>
              l.contNum === d.contNum && (q.pour === undefined || l.atelier?.type !== 'SCROLL'),
          )),
    )
    const affiches = await affichesDesDossiers(
      db,
      visibles.map((d) => d.contNum),
      identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds,
    )
    for (const d of visibles) {
      const instructions = d.instructions.filter(retenue)
      const lignesDossier = lignes.filter((l) => l.contNum === d.contNum)
      const ligne = await ligneDossier(
        db,
        identity,
        d,
        instructions,
        lignesDossier.map((l) => formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum })),
        affiches.get(d.contNum) ?? [],
        deadline,
        maintenant,
        marques.de(d.contNum, lignesDossier),
        {
          // RG-COO-055 : mêmes lignes que `ecartDossier` (actives, thème non exclu, périmètre déjà appliqué).
          ecart: ecartDeLignes(
            lignesDossier.filter((l) => l.etatLigne === 'ACTIVE' && !l.themeExclu),
          ),
          correctionLe: corrections.get(d.id) ?? null,
        },
      )
      if (q.aFaire === 'A_FAIRE' && !ligne.aFaire) continue
      if (q.aFaire === 'RIEN' && ligne.aFaire) continue
      // RG-COO-019 : filtre « Validation admin » (un dossier annulé n'a pas de pastille).
      if (q.va && ligne.validationAdmin.etat !== q.va) continue
      items.push(ligne)
    }
  }
  const page = items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
  return {
    items: page,
    total: items.length,
    // RG-COO-011 : « n » = dossiers cas sûrs sous le filtre courant (toutes pages).
    casSurs: items.filter((i) => i.validationAdmin.casSur).length,
    page: q.page,
    pageSize: q.pageSize,
  }
}

// RG-COO-167 : ateliers visibles par l'utilisateur (périmètre site / atelier ; admin : tous).
export async function listerAteliersPerimetre(db: Db, identity: Identity) {
  assertDroitCoordination(identity, 'instruction.consulter')
  const ateliers = await db.atelier.findMany({
    include: { plateforme: { select: { nom: true } } },
    orderBy: [{ plateformeId: 'asc' }, { libelle: 'asc' }],
  })
  return {
    ateliers: ateliers
      .filter((a) => peutVoirAtelier(identity, a))
      .map((a) => ({ id: a.id, libelle: a.libelle, plateforme: a.plateforme.nom })),
  }
}

// ECR-COO-02 — fiche dossier : instructions, visuels (répartition, valeur Broadcast d'origine), lignes attendues
// (qte_BC / qte_prépa, exclusions), demandes de correction. RG-COO-167 : périmètre revérifié.
export async function lireFicheDossier(db: Db, identity: Identity, id: number) {
  assertDroitCoordination(identity, 'instruction.consulter')
  const dossier = await dossierDuPerimetre(db, identity, id)
  const instructions = await db.instruction.findMany({
    where: { dossierId: id },
    include: { atelier: { include: { plateforme: { select: { nom: true } } } } },
    orderBy: [{ contAnbas: 'asc' }, { contSembas: 'asc' }, { code: 'asc' }],
  })
  const visibles = instructions.filter((i) => peutVoirAtelier(identity, i.atelier))
  const lignesAttendues = await db.receptionAttendue.findMany({
    where: {
      contNum: dossier.contNum,
      ...(identity.perimetre.toutesPlateformes
        ? {}
        : { plateformeId: { in: identity.perimetre.plateformeIds } }),
    },
    include: {
      _count: { select: { rattachements: { where: { actif: true } } } },
      rattachements: {
        where: { actif: true },
        select: { afficheId: true, affiche: { select: { validationAdmin: true } } },
        orderBy: { afficheId: 'asc' },
      },
    },
    orderBy: [{ semAnnee: 'asc' }, { semNum: 'asc' }, { id: 'asc' }],
  })
  // ECR-COO-02 : « Affiches reçues et validation admin » (RG-COO-006 / 007).
  const affiches =
    (
      await affichesDesDossiers(
        db,
        [dossier.contNum],
        identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds,
      )
    ).get(dossier.contNum) ?? []
  const base = await ligneDossier(
    db,
    identity,
    dossier,
    visibles,
    lignesAttendues.map((l) => formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum })),
    affiches,
    lireDeadline(await lireParametreTexte(db, 'coordination.deadlinePrepa')),
    new Date(),
    (await marquesVisuels(db, identity, new Date())).de(dossier.contNum, lignesAttendues),
  )
  // ECR-COO-02 (RG-COO-068 / 069) : encadrés « Thème modifié dans Broadcast » et « thème proche à vérifier ».
  const plateformes = identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds
  const themesModifies = (await lignesThemeModifie(db, plateformes))
    .filter((l) => l.contNum === dossier.contNum)
    .map((l) => ({
      ligneAttendueId: l.ligneAttendueId,
      version: l.version,
      themeCirce: l.themeCirce,
      themeBroadcast: l.themeBroadcast,
      productionLancee: l.productionLancee,
    }))
  const themesProches = (await groupesAVerifier(db, identity, new Date())).themes
    .filter((g) => g.dossiers.includes(dossier.contNum))
    .map((g) => ({
      cle: g.cle,
      libelles: g.libelles,
      autresDossiers: g.dossiers.filter((n) => n !== dossier.contNum),
    }))
  const visuels = await db.instructionVisuel.findMany({
    where: { instructionCode: { in: visibles.map((i) => i.code) } },
    orderBy: [{ instructionCode: 'asc' }, { afchIdent: 'asc' }],
  })
  // RG-COO-160 : historique nominatif du dossier et de ses instructions visibles (frise de la fiche).
  const journal = await db.journalAudit.findMany({
    where: {
      OR: [
        { typeEntite: 'DOSSIER', entiteId: String(dossier.contNum) },
        { typeEntite: 'INSTRUCTION', entiteId: { in: visibles.map((i) => i.code) } },
      ],
    },
    orderBy: [{ le: 'desc' }, { id: 'desc' }],
    take: 200,
  })
  const corrections = await db.demandeCorrection.findMany({
    where: { dossierId: id },
    orderBy: { le: 'desc' },
  })
  const noms = new Map(
    (
      await db.utilisateur.findMany({
        where: {
          id: {
            in: [
              ...corrections.map((c) => c.parId),
              ...journal.map((j) => j.parId).filter((x): x is number => x !== null),
            ],
          },
        },
        select: { id: true, nom: true, identifiantExterne: true },
      })
    ).map((u) => [u.id, u.nom ?? u.identifiantExterne]),
  )
  return {
    ...base,
    themesModifies,
    themesProches,
    visuels: visuels.map((v) => ({
      instruction: v.instructionCode,
      afchIdent: v.afchIdent,
      theme: v.theme,
      pourcentage: v.pourcentage === null ? null : Number(v.pourcentage),
      pourcentageBroadcast: v.pourcentageOri === null ? null : Number(v.pourcentageOri),
    })),
    lignes: lignesAttendues.map((l) => ({
      id: l.id,
      theme: l.theme,
      format: l.format,
      depart: formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }),
      qteBc: l.qteBc,
      qtePrepa: l.qtePrepa,
      exclu: l.themeExclu,
      affichesRecues: l._count.rattachements,
      // RG-COO-026 : « • » dès la réception, « ✓ » après la validation (la réception suffit à « reçue »).
      affiches: l.rattachements.map((r) => ({
        id: r.afficheId,
        marque: marqueEtatReservations(r.affiche.validationAdmin),
      })),
      // RG-COO-021 : n° visible au suivi de production seulement validée ET ligne de source PREPA.
      numerosSuiviProd: l.rattachements
        .filter((r) =>
          numeroVisibleSuiviProd({ validee: r.affiche.validationAdmin, sources: [l.source] }),
        )
        .map((r) => r.afficheId),
      etatLigne: l.etatLigne,
    })),
    // RG-COO-032 : affiches rattachées à une ligne annulée (alerte, lien et validation conservés).
    aReRattacher: await affichesSurLignesAnnulees(
      db,
      dossier.contNum,
      identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds,
    ),
    affiches: affiches.map((a) => ({
      id: a.id,
      version: a.version,
      theme: a.theme,
      quantite: a.quantite,
      themes: a.themes,
      quantiteRecue: a.quantiteRecue,
      recueLe: a.recueLe,
      emplacement: a.emplacement,
      etat: a.etat,
      motifs: a.motifs,
      validePar: a.validePar,
      valideLe: a.valideLe,
      estAssociee: a.estAssociee,
    })),
    historique: journal.map((j) => ({
      le: j.le.toISOString(),
      // Champ modifié (entretien, position, annonceur, commentaire) précisé pour ModificationInstructionPlus.
      objet:
        (j.typeEntite === 'DOSSIER' ? 'Dossier' : `Instruction ${j.entiteId}`) +
        (j.action === 'MODIFICATION_INSTRUCTION_PLUS' && j.complement ? ` — ${j.complement}` : ''),
      action: j.action,
      ancien: j.ancienneValeur,
      nouveau: j.nouvelleValeur,
      par: j.parId !== null ? (noms.get(j.parId) ?? null) : (j.complement ?? null),
    })),
    corrections: corrections.map((c) => ({
      le: c.le.toISOString(),
      note: c.note,
      par: noms.get(c.parId) ?? null,
      mailEnvoye: c.mailEnvoye,
    })),
  }
}
