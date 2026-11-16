// Données de référence issues des RÈGLES (pas des MOCK) — Q-004, Q-319 : seed minimal, sans export DSI.
// Idempotent : peut être relancé sans doublon. Les référentiels de production (plateformes, ateliers,
// supports, surfaces, jours de départ…) NE SONT PAS chargés ici (écart tracé dans ECARTS).
import { PERMISSION_CODES } from '@circe/shared'
import type { Db } from '../core/db.ts'
import { CATALOGUE_PERMISSIONS } from '../core/permissions/catalogue.ts'

/** Q-003 (HYPOTHÈSE) : 6 rôles provisoires — libellés de la maquette (M.ROLES, core.js:187-194). */
export const ROLES_REF = [
  { code: 'coord', libelle: 'Coordination' },
  { code: 'cheq', libelle: "Chef d'équipe" },
  { code: 'recep', libelle: 'Agent de réception' },
  { code: 'expe', libelle: "Agent d'expédition" },
  { code: 'admin', libelle: 'Administrateur' },
  { code: 'com', libelle: 'Commerce (lecture seule)' },
] as const

/** Ex tr_instruction_plus (bdd.md §4.2) : valeurs du schéma réel. */
export const INSTRUCTION_PLUS_REF = [
  { code: 0, libelle: 'Standard' },
  { code: 1, libelle: 'Début de train' },
  { code: 2, libelle: 'Fin de train' },
  { code: 3, libelle: 'Fin de train - 1' },
  { code: 4, libelle: 'Milieu de train' },
] as const

/** TypeDePreparation du code historique (bdd.md §4.2) : libellés applicatifs. */
export const TYPES_PREPARATION_REF = [
  { libelle: '2M2FIXE' },
  { libelle: 'PLIAGE' },
  { libelle: 'DEROULANT' },
  { libelle: 'AUTRES' },
  { libelle: 'BUS' },
] as const

/** Q-105 / Q-224 / RG-COO-216 : valeurs par défaut citées par les règles ; paramétrables (Q-337). */
export const PARAMETRES_REF = [
  {
    cle: 'reception.ecartReception',
    valeur: '10',
    description: 'Écart de réception en % (RG-REC-018, 064 ; Q-105)',
  },
  {
    cle: 'reception.purgeAttendues',
    valeur: '4',
    description: 'Purge des attendues, en semaines (RG-REC-180 ; Q-105, Q-130)',
  },
  {
    cle: 'reception.delaiControle',
    valeur: '24',
    description: 'Délai de contrôle, en heures calendaires (RG-REC-019 ; Q-157)',
  },
  {
    cle: 'reception.comptageMorceau',
    valeur: '30',
    description: 'Seuil du comptage par morceau (Q-105, Q-140)',
  },
  {
    cle: 'reception.exemplairesFeuille',
    valeur: '2',
    description: 'Exemplaires de feuilles, bornes 1 à 5 (Q-128)',
  },
  {
    cle: 'reception.alleeInconnues',
    valeur: 'X',
    description: 'Allée de la zone tampon (Q-106) ; à fixer par site',
  },
  {
    cle: 'coordination.entretienDefaut',
    valeur: '8',
    description: 'Entretien par défaut en % (RG-COO-048 ; Q-224)',
  },
  {
    cle: 'coordination.entretienCampagneControlee',
    valeur: '15',
    description: 'Entretien campagne contrôlée en % (RG-COO-048 ; Q-224)',
  },
  {
    cle: 'coordination.plafondThemesExportPrepa',
    valeur: '20',
    description: 'Couples thème / repiquage max à l’export prépa (RG-COO-216)',
  },
  {
    cle: 'coordination.fenetreSemaines',
    valeur: '8',
    description:
      'Fenêtre d’alimentation des attendues : semaine courante + n semaines ISO (RG-COO-083)',
  },
  {
    cle: 'coordination.destinatairesExclus',
    valeur: 'Plateforme Derichebourg Lyon;Plateforme Derichebourg',
    description:
      'Destinataires Broadcast exclus de l’alimentation, séparés par « ; » (RG-COO-093 ; Q-227)',
  },
  {
    cle: 'coordination.deadlinePrepa',
    valeur: '-2;4;16:00',
    description:
      'Deadline Pré-Prod : semaines relatives au départ ; jour ISO ; heure (jeudi S-2 16 h, RG-COO-066 / 076)',
  },
  {
    cle: 'coordination.supportsBandeau',
    valeur: '5:100;26:100;1026:100;19:102;27:105;29:107',
    description: 'Support → support bandeau des lignes « bandeau » (RG-COO-095 ; Q-227)',
  },
  // ── D-20 (Q-410) : horaires des traitements planifiés. VIDES = désactivés (aucun horaire n'est sourcé : Q-005). ──
  {
    cle: 'taches.finJourneeColis',
    valeur: '',
    description:
      'Horaires de la fin de journée des colis (RG-COO-269) ; vide = désactivé (Q-005, Q-410)',
  },
  {
    cle: 'taches.purgeAttendues',
    valeur: '',
    description:
      'Horaires de la purge des réceptions attendues (RG-REC-180) ; vide = désactivé (Q-005, Q-410)',
  },
  {
    cle: 'taches.instructionOkAuto',
    valeur: '',
    description:
      'Horaires du rattrapage de l’Instruction OK automatique (RG-COO-042) ; vide = désactivé (Q-006, Q-410)',
  },
  {
    cle: 'taches.envoiMails',
    valeur: '',
    description:
      'Horaires de l’envoi des mails en file (EX-TRA-030) ; vide = désactivé (Q-375, Q-410)',
  },
  // ── COO-P06 : intégration Broadcast. Valeurs codées en dur dans le legacy, portées en paramètre (Q-227). ──
  {
    cle: 'integration.horaires',
    valeur: '08:00;10:00;12:00;14:00;16:00;18:00',
    description: 'Horaires des passages d’intégration planifiés (RG-COO-103 ; Q-211)',
  },
  {
    cle: 'integration.timeoutSecondes',
    valeur: '600',
    description:
      'Délai maximal d’un flux d’intégration, en secondes (RG-COO-117 ; valeur HYPOTHÈSE Q-188)',
  },
  {
    cle: 'integration.sitesPreparation',
    valeur: '39;40;43;44',
    description: 'Sites CCF dont la prépa fixe / pliage est intégrée (RG-COO-121 ; Q-227)',
  },
  {
    cle: 'integration.statutPrepaEnvoyee',
    valeur: '133',
    description: 'Statut Broadcast « envoyée » d’un groupe de préparation (RG-COO-121, 125)',
  },
  {
    cle: 'integration.typePreparationPliage',
    valeur: '23',
    description: 'Type de préparation routé vers le pliage (RG-COO-121 ; Q-227)',
  },
  {
    cle: 'integration.typesDeroulants',
    valeur: '17;18;19;20;21;28',
    description: 'Types de préparation du déroulant, exclus de la prépa fixe / pliage (RG-COO-121)',
  },
  {
    cle: 'integration.routagePliage',
    valeur: '39:2;40:3;43:9;44:10',
    description: 'Site CCF → atelier pliage (RG-COO-121 ; Q-227)',
  },
  {
    cle: 'integration.routageFixe',
    valeur: '39:1;40:4',
    description: 'Site CCF → atelier 2 m² fixe (RG-COO-121 ; Q-227)',
  },
  {
    cle: 'integration.atelierDeroulant',
    valeur: '5:39:5;5:40:6;7:39:7;7:40:8;6:39:11;6:40:12',
    description: 'Surface : site CCF : atelier déroulant (RG-COO-126 ; Q-227)',
  },
  {
    cle: 'integration.transportParAtelier',
    valeur: '1:2:X24;2:2:X24;5:2:X24;7:2:X24;3:2:CX;4:2:CX;6:2:CX;8:2:CX;*:1:CCF',
    description: 'Atelier : transporteur : tarif par défaut, « * » = autres ateliers (RG-COO-120)',
  },
  {
    cle: 'integration.typesVisuels',
    valeur: 'visuel:10:26;bdx:2;detail21:11:1026;detail:10',
    description:
      'Types de préparation / supports forcés des visuels et détails d’instruction (RG-COO-128 ; Q-228)',
  },
  {
    cle: 'integration.formatsRetour',
    valeur: '2m2 Scrolling:2m2',
    description: 'Formats ramenés au retour vers Broadcast (RG-COO-134)',
  },
  // ── COO-P07 : alertes Pré-Prod, calendrier du process, vérification des thèmes (Q-220, Q-222). ──
  {
    cle: 'coordination.deadlineReception',
    valeur: '-2;5;16:30',
    description:
      'Deadline réception : semaines relatives au départ ; jour ISO ; heure (vendredi S-2 16 h 30, RG-COO-076)',
  },
  {
    cle: 'coordination.fenetreRajout',
    valeur: '-2;5;00:00|0;5;23:59',
    description:
      'Fenêtre « Rajout après préparation » : début | fin (nuit du jeudi au vendredi S-2 → vendredi S, RG-COO-073 ; Q-222)',
  },
  {
    cle: 'coordination.seuilThemesProches',
    valeur: '0.85',
    description: 'Seuil de similarité des thèmes et annonceurs proches (RG-COO-069 / 070)',
  },
  {
    cle: 'coordination.regroupementsAnnonceurs',
    valeur: '*MISTRAL*:MISTRAL',
    description:
      'Regroupements d’enseignes « motif:valeur » séparés par « ; » (« * » = n’importe quel texte, RG-COO-070)',
  },
  {
    cle: 'alertes.departGraveSemaines',
    valeur: '1',
    description:
      'Validation admin à confirmer : gravité « Important » pour un départ jusqu’à S+n (RG-COO-033 : S ou S+1)',
  },
  {
    cle: 'alertes.joursEvenements',
    valeur: '7',
    description:
      'Durée d’affichage (jours) des alertes nées d’un événement daté (intégration, renvoi, rajout) ; HYPOTHÈSE Q-190 (3)',
  },
  {
    cle: 'trains.positionsMax',
    valeur: '6',
    description:
      'Positions max par train (RG-COO-209, 222 : « Train complet ») ; HYPOTHÈSE Q-253 : 6 (code legacy) tant que 4 / 6 n’est pas tranché',
  },
  {
    cle: 'trains.ateliersExportPrepa',
    valeur: '5;6',
    description:
      "Ateliers autorisés à l'export préparation et au fichier Caire (RG-COO-215 : ateliers legacy 5 Wissous 2 m² et 6 Nîmes 2 m²) ; liste d'identifiants d'atelier séparés par « ; ». Les identifiants legacy ne sont pas au référentiel V2 (Q-319, Q-193) : à saisir à la reprise des ateliers",
  },
  {
    cle: 'trains.themesMaxExportPrepa',
    valeur: '20',
    description:
      "Plafond de couples (thème, repiquage) de l'export préparation (RG-COO-216 : NbMaxThemeExportPrepa = QteMaxThemeMachineCaire = 20) ; refus a priori (HYPOTHÈSE Q-254)",
  },
  {
    cle: 'trains.tiroirsMax',
    valeur: '20',
    description:
      "Tiroirs max d'un fichier Vendôme (ECR-GEN-01 : « n / 20 tiroirs », bloquant au-delà ; HYPOTHÈSE Q-254)",
  },
  {
    cle: 'trains.entretienGrain',
    valeur: 'AFFICHEUR',
    description:
      'Grain du calcul des faces d’entretien d’un train : AFFICHEUR (cible) ou VILLE (existant : destinataire, thème, secteur) ; RG-COO-203, HYPOTHÈSE Q-256',
  },
  {
    cle: 'trains.entretienSeuil',
    valeur: '3',
    description:
      'Pas d’entretien en dessous de n faces dans le groupe (ECR-ADM-05, défaut 3) ; RG-COO-203, HYPOTHÈSE Q-256',
  },
  {
    cle: 'trains.entretienArrondi',
    valeur: 'SUPERIEUR',
    description:
      'Arrondi du nombre de faces d’entretien : SUPERIEUR (cible) ou PROCHE (existant, round) ; RG-COO-203, HYPOTHÈSE Q-256',
  },
  {
    cle: 'dispatch.seuilDepartHeures',
    valeur: '36',
    description:
      'Dispatch du roulage : un train non affecté qui part dans moins de n heures est critique (RG-COO-294, 295 ; valeur de la maquette ECR-COO-10, paramétrable : Q-276)',
  },
  {
    cle: 'dispatch.seuilChargePct',
    valeur: '115',
    description:
      'Dispatch du roulage : un rouleur dont la charge (faces) dépasse n % de la moyenne des rouleurs du site est signalé (RG-COO-295 ; valeur de la maquette ECR-COO-10, paramétrable : Q-276)',
  },
  {
    cle: 'suivi8m2.ateliers',
    valeur: '',
    description:
      'Ateliers dont les thèmes sont suivis en 8 m² (RG-COO-237 : ateliers legacy 7 et 8) ; liste d’identifiants d’atelier séparés par « ; ». Vide tant que les ateliers ne sont pas repris : aucun identifiant legacy n’est supposé (Q-319, Q-195)',
  },
  {
    cle: 'unitaire.typesPliage',
    valeur: '',
    description:
      'Types de préparation (identifiants séparés par « ; ») traités par l’atelier de pliage (RG-COO-247, 248 : legacy type 23). Vide tant que le référentiel n’est pas repris : aucun identifiant legacy n’est supposé (Q-319, Q-196)',
  },
  {
    cle: 'unitaire.typesBus',
    valeur: '',
    description:
      'Types de préparation (identifiants séparés par « ; ») traités par l’onglet Bus (RG-COO-305). Vide tant que le référentiel n’est pas repris (Q-319, Q-196, Q-279) ; tout autre type d’atelier fixe est « 2 m² fixe »',
  },
  {
    cle: 'colis.ateliersMajoration',
    valeur: '',
    description:
      'Ateliers dont le poids du colis est majoré de 3 kg (RG-COO-263 : ateliers legacy 7 et 8 = 8 m²) ; identifiants d’atelier séparés par « ; ». Vide tant que les ateliers ne sont pas repris : aucun identifiant legacy n’est supposé (Q-319, Q-197)',
  },
] as const

export interface SeedRefResult {
  roles: number
  instructionPlus: number
  typesPreparation: number
  parametres: number
  permissions: number
}

export async function seedRef(db: Db): Promise<SeedRefResult> {
  for (const role of ROLES_REF) {
    await db.role.upsert({
      where: { code: role.code },
      update: { libelle: role.libelle },
      create: role,
    })
  }
  for (const item of INSTRUCTION_PLUS_REF) {
    await db.instructionPlus.upsert({
      where: { code: item.code },
      update: { libelle: item.libelle },
      create: item,
    })
  }
  for (const type of TYPES_PREPARATION_REF) {
    const existing = await db.typePreparation.findFirst({ where: { libelle: type.libelle } })
    if (!existing) await db.typePreparation.create({ data: type })
  }
  for (const parametre of PARAMETRES_REF) {
    // Paramètres globaux (plateformeId nul) : clé unique via l'index partiel de la migration.
    const existing = await db.parametre.findFirst({
      where: { cle: parametre.cle, plateformeId: null },
    })
    if (!existing) await db.parametre.create({ data: parametre })
  }
  // Copie en base du catalogue des permissions (source unique : le code, catalogue.ts). Les liens
  // rôle → permission sont reconstruits à chaque passage pour suivre le catalogue.
  for (const code of PERMISSION_CODES) {
    const def = CATALOGUE_PERMISSIONS[code]
    const permission = await db.permission.upsert({
      where: { code },
      update: { libelle: def.libelle },
      create: { code, libelle: def.libelle },
    })
    await db.rolePermission.deleteMany({ where: { permissionId: permission.id } })
    for (const roleCode of def.roles) {
      const role = await db.role.findUniqueOrThrow({ where: { code: roleCode } })
      await db.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } })
    }
  }
  return {
    roles: ROLES_REF.length,
    instructionPlus: INSTRUCTION_PLUS_REF.length,
    typesPreparation: TYPES_PREPARATION_REF.length,
    parametres: PARAMETRES_REF.length,
    permissions: PERMISSION_CODES.length,
  }
}
