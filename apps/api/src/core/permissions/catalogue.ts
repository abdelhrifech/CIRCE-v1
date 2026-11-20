// Matrice profils × actions (RG-REC-002, RG-COO-165/166) — source UNIQUE des droits côté serveur.
// Règles de lecture des matrices des docs de règles métier (§2 de chaque document) :
//   ✔ et ✔* (hypothèse Q-136 : écran primaire = écriture) → accordé ; ✔(cond.) → accordé, la condition
//   est appliquée par le service ; ✘, ✘* et « ? » (non tranché) → REFUSÉ (on refuse tant que ce n'est pas
//   décidé ; la question reste ouverte). Rôles provisoires : Q-003.
import type { PermissionCode, Role } from '@circe/shared'

export interface PermissionDefinition {
  libelle: string
  roles: readonly Role[]
  /** Source : ligne de la matrice + RG / question. */
  source: string
}

export const CATALOGUE_PERMISSIONS: Record<PermissionCode, PermissionDefinition> = {
  'nonconformite.consulter': {
    libelle: 'Consulter les non-conformités',
    roles: ['coord', 'recep', 'cheq'],
    source: 'Maquette nonconformite.js, rôles',
  },
  'nonconformite.declarer': {
    libelle: 'Déclarer une non-conformité',
    roles: ['coord', 'recep', 'cheq'],
    source: 'Maquette nonconformite.js, rôles et formulaires',
  },
  'nonconformite.decider': {
    libelle: 'Décider du traitement des non-conformités',
    roles: ['coord'],
    source: 'Maquette nonconformite.js, decider : la Pré-Prod décide',
  },
  'nonconformite.traiter': {
    libelle: 'Confirmer le traitement par la plateforme',
    roles: ['recep', 'cheq'],
    source: 'Maquette nonconformite.js, Traité par la plateforme',
  },
  'j3.gerer': {
    libelle: 'Gérer le suivi J-3',
    roles: ['coord', 'recep', 'cheq'],
    source: 'Maquette j3.js, rôles',
  },
  'bus.consulter': {
    libelle: 'Consulter la production Bus',
    roles: ['coord', 'recep', 'cheq', 'com'],
    source: 'BUS-01, BUS-13, maquette bus.js',
  },
  'bus.recevoir': {
    libelle: 'Réceptionner les affiches Bus',
    roles: ['recep', 'coord'],
    source: 'BUS-09 : magasinier, coordination',
  },
  'bus.ajuster': {
    libelle: 'Ajuster les quantités Bus',
    roles: ['cheq'],
    source: 'BUS-20, maquette bus.js HABILITES',
  },
  // ── Réception : RECEPTION_REGLES_METIER.md §2 ──
  'reception.attendues.consulter': {
    libelle: 'Consulter les réceptions attendues et le panier',
    roles: ['coord', 'cheq', 'recep', 'com'],
    source: 'REC §2 ; ECR-REC-01 ; EX-TRA-004 (com lecture) ; Q-136',
  },
  'reception.saisir': {
    libelle: 'Photographier le BL / une affiche, mettre au panier',
    roles: ['coord', 'recep'],
    source: 'REC §2 ; EX-REC-076 ; cheq « ? » refusé (Q-136)',
  },
  'reception.valider': {
    libelle: 'Valider la réception',
    roles: ['coord', 'recep'],
    source: 'REC §2 ; EX-REC-076 ; cheq « ? » refusé (Q-136)',
  },
  'reception.inconnue.creer': {
    libelle: 'Créer une réception inconnue',
    roles: ['coord', 'recep'],
    source: 'REC §2 ; EX-REC-076 ; ECR-REC-08',
  },
  'reception.sas.consulter': {
    libelle: 'Consulter le sas (palettes à contrôler)',
    roles: ['coord', 'cheq', 'recep', 'com'],
    source: 'REC §2 ; EX-REC-070 ; ECR-REC-02',
  },
  'reception.controler': {
    libelle: 'Contrôler la palette et valider le contrôle',
    roles: ['recep'],
    source: 'REC §2 ; EX-REC-026, 076 ; coord/cheq « ? » refusés (Q-136)',
  },
  'reception.imprimer': {
    libelle: 'Imprimer / réimprimer feuilles de stock et étiquettes rack',
    roles: ['coord', 'cheq', 'recep'],
    source: 'REC §2 ; EX-REC-034, 076',
  },
  'affiche.consulter': {
    libelle: 'Consulter la liste des affiches, la fiche affiche et la fiche réception',
    roles: ['coord', 'cheq', 'recep', 'com'],
    source: 'REC §2 ; ECR-REC-03/05/06 ; COO §2 (recep lecture)',
  },
  'affiche.modifier': {
    libelle: 'Modifier la fiche affiche (annonceur, thème saisis, imprimeur, allée, rayon)',
    roles: ['coord', 'cheq', 'recep'],
    source: 'REC §2 ; ECR-REC-05',
  },
  'affiche.conserver': {
    libelle: 'Cocher « Affiche à conserver »',
    roles: ['coord', 'cheq', 'recep'],
    source: 'REC §2 ; écart legacy (droit validation_admin) : Q-136',
  },
  'affiche.rattachement.modifier': {
    libelle: 'Changer de thème, retirer un rattachement, rattacher à un autre dossier',
    roles: ['coord', 'admin', 'recep'],
    source:
      'REC §2 ; COO §2 (admin ✔, vaut validation) ; recep ✔(cond.) reste « à confirmer » ; cheq « ? » refusé (Q-136, Q-201)',
  },
  'reception.inconnue.consulter': {
    libelle: 'Consulter les réceptions inconnues',
    roles: ['coord', 'recep', 'admin'],
    source:
      'REC §2 ; ECR-REC-04 ; admin : COO §2 « Rattacher une réception inconnue » ✔ (vaut validation) → consulter l’écran (HYPOTHÈSE Q-186 (11), REC §2 ✘* déduit)',
  },
  'reception.inconnue.rattacher': {
    libelle: 'Identifier et rattacher une réception inconnue',
    roles: ['coord', 'admin', 'recep'],
    source: 'REC §2 ; COO §2 (admin ✔) ; recep ✔(cond.) sans validation (Q-107, RG-COO-017)',
  },
  'reception.inconnue.signaler': {
    libelle: 'Signaler « Dossier introuvable » à la Coordination',
    roles: ['coord', 'admin', 'recep'],
    source:
      'REC §2 ; COO §2 (admin ✔, RG-X-054 ; REC §2 marquait ✘* : la source sans hypothèse prévaut)',
  },
  'validation_admin.valider': {
    libelle: 'Valider / annuler la validation admin d’une affiche',
    roles: ['coord', 'admin'],
    source: 'RG-REC-003 ; RG-COO-009, 014 ; Q-201',
  },
  'stock.consulter': {
    libelle: 'Consulter les vues Stocks et Mouvements',
    roles: ['coord', 'cheq', 'recep', 'expe', 'com'],
    source: 'REC §2 ; ECR-STK-01/02 ; stock.js (accès Expédition au rebut)',
  },
  'stock.rebut': {
    libelle: 'Mettre au rebut',
    roles: ['cheq', 'recep', 'expe'],
    source: 'REC §2 ; ECR-STK-01 ; EX-REC-024',
  },
  'stock.mouvement_manuel': {
    libelle: 'Ajout / sortie manuels de stock',
    roles: [],
    source: 'REC §2 : « ? » pour tous (Q-117) → refusé',
  },
  'stock.fin_campagne.agir': {
    libelle: 'Décider et exécuter la fin de campagne',
    roles: ['recep', 'cheq'],
    source:
      'RG-STK-NEW-002 ; décision utilisateur du 19/11/2026 : Réception, chefs d’équipe, admin ; Coordination consulte',
  },
  'stock.fin_campagne.consulter': {
    libelle: 'Consulter Stocks › Fin de campagne',
    roles: ['coord', 'cheq', 'recep'],
    source: 'REC §2 ; ECR-STK-03',
  },
  'alerte.consulter': {
    libelle: 'Consulter Pilotage › Alertes',
    roles: ['coord', 'cheq', 'recep', 'admin', 'com'],
    source: 'REC §2 ; COO §2 ; ECR-TRA-01',
  },
  'alerte.acquitter': {
    libelle: 'Acquitter une alerte',
    roles: [],
    source:
      'COO §2 : « ? » (Q-220) ; REC §2 ✔ mais règles d’acquittement non précisées → refusé tant que Q-220 est ouverte',
  },
  'historique.consulter': {
    libelle: 'Consulter l’historique d’une affiche et le journal',
    roles: ['coord', 'cheq', 'recep', 'admin', 'com'],
    source: 'REC §2 ; ECR-REC-05, ECR-ADM-08',
  },
  'export.tableau': {
    libelle: 'Exporter un tableau (xlsx)',
    roles: ['coord', 'cheq', 'recep', 'admin', 'com'],
    source: 'REC §2 ; EX-TRA-016',
  },
  'parametrage.gerer': {
    libelle: 'Paramétrer règles métier, alertes, listes de distribution, règles de déblocage',
    roles: ['admin'],
    source: 'REC §2 ; COO §2 ; ECR-ADM-04/05 ; RG-COO-141',
  },
  'referentiel.gerer': {
    libelle: 'Gérer les référentiels (imprimeurs, livreurs, agents, plateformes, rouleurs)',
    roles: ['admin'],
    source: 'REC §2 ; COO §2 (rouleurs) ; ECR-ADM-07 ; RG-COO-297',
  },
  // Étape 8 (D-01) : gestion des comptes, rôles et périmètres (HYPOTHÈSE Q-406 : administrateur seul).
  'utilisateur.gerer': {
    libelle: 'Gérer les utilisateurs, leurs rôles et leur périmètre',
    roles: ['admin'],
    source: 'D-01 ; legacy-admin.md RG-ADM-010 à 017 provisoires ; Q-320, Q-406',
  },
  // ── Coordination bloc 1 : COORDINATION_REGLES_METIER.md §2 ──
  'instruction.consulter': {
    libelle: 'Consulter « Validation admin et Instruction OK »',
    roles: ['coord', 'cheq', 'recep', 'admin', 'com'],
    source: 'COO §2 ; RG-COO-166 (lecture cheq, recep, com)',
  },
  'instruction.instruction_ok': {
    libelle: 'Passer l’Instruction OK (manuelle ou lancement du traitement)',
    roles: ['coord', 'admin'],
    source: 'RG-COO-009, 044, 042',
  },
  'instruction.modifier': {
    libelle: 'Modifier l’entretien / la position d’une instruction',
    roles: ['coord', 'admin'],
    source: 'COO §2 ; RG-COO-047, 048, 050',
  },
  'instruction.annuler': {
    libelle: 'Annuler une instruction',
    roles: ['coord', 'admin'],
    source: 'COO §2 ; RG-COO-045',
  },
  'broadcast.version.appliquer': {
    libelle: 'Appliquer / reprendre la version Broadcast',
    roles: ['coord', 'admin'],
    source: 'RG-COO-009, 056, 068',
  },
  'broadcast.correction.demander': {
    libelle: 'Demander une correction à Broadcast',
    roles: ['coord', 'admin'],
    source: 'RG-COO-009, 057, 069, 070',
  },
  'verification_themes.consulter': {
    libelle:
      'Consulter Pré-production › Vérification des thèmes (thèmes, annonceurs, thèmes modifiés)',
    roles: ['coord', 'admin'],
    source: 'RG-COO-069, 070, 075 (« rôle coord/admin ») ; ECR-THM-01 à 03 (maquette `roles`)',
  },
  'reservations.consulter': {
    libelle: 'Consulter l’état des réservations',
    roles: ['coord', 'cheq', 'recep', 'admin', 'com'],
    source: 'COO §2 ; RG-COO-107 ; ECR-PIL-03',
  },
  'suivi_production.consulter': {
    libelle: 'Consulter le suivi de production',
    roles: ['coord', 'cheq', 'admin', 'com'],
    source: 'COO §2 ; recep/expe « ? » refusés (Q-201)',
  },
  'alimentation.manuelle': {
    libelle: 'Rafraîchir un dossier ; consulter les chargements Broadcast',
    roles: ['coord', 'admin'],
    source:
      'COO §2 ; RG-COO-132 (droit legacy train_rafraichir_contrat → coord / admin), RG-COO-116',
  },
  'integration.passage_manuel': {
    libelle: 'Lancer un passage d’intégration Broadcast manuel',
    roles: ['admin'],
    source:
      'RG-COO-103 (« exécution manuelle possible pour l’administrateur ») ; COO §2 ligne « passage manuel » donne aussi coord : conflit Q-189 (le plus restrictif tant que non tranché)',
  },
  'deblocage.executer': {
    libelle: 'Débloquer une préparation / rendre la main à la Pré-Prod',
    roles: ['coord', 'admin'],
    source: 'RG-COO-152 ; RG-COO-145, 151',
  },
  'deblocage.consulter': {
    libelle: 'Consulter les préparations débloquées',
    roles: ['coord', 'admin'],
    source: 'RG-COO-152, 149',
  },
  // ── Coordination bloc 2 : COORDINATION_REGLES_METIER.md §2 (HYPOTHÈSE Q-286) ──
  'train.consulter': {
    libelle: 'Consulter trains, suivi par thème, préparation, suivi 8 m², unitaire',
    roles: ['coord', 'cheq'],
    source: 'COO §2 bloc 2 ; admin/com « ? » refusés (Q-286)',
  },
  'train.exporter': {
    libelle: 'Exporter les trains (jeudi 14 h) et simuler',
    roles: ['coord', 'admin'],
    source: 'COO §2 bloc 2 ; admin ✔(cond.) = coord (Q-COO-6) ; cheq « ? » refusé ; RG-COO-212',
  },
  'train.creer_supprimer': {
    libelle: 'Créer / supprimer un train',
    roles: ['coord'],
    source: 'COO §2 bloc 2 ; RG-COO-224, 225 ; Q-286',
  },
  'train.fractionner': {
    libelle: 'Fractionner / raccrocher un visuel',
    roles: ['coord', 'cheq'],
    source: 'COO §2 bloc 2 ; RG-COO-221, 222',
  },
  'train.changer_statut': {
    libelle: 'Changer statut, annuler un thème, débloquer semaine (trains)',
    roles: ['coord'],
    source: 'COO §2 bloc 2 ; RG-COO-218 à 220 ; Q-286',
  },
  'train.dupliquer': {
    libelle: 'Dupliquer un train',
    roles: ['admin'],
    source:
      'COO §2 bloc 2 ; admin ✔(cond.) droit legacy duplication_train ; coord/cheq « ? » (Q-260) ; RG-COO-226',
  },
  'roulage.preparer': {
    libelle: 'Export préparation, au roulage, choisir le rouleur',
    roles: ['coord', 'cheq'],
    source: 'COO §2 bloc 2 ; RG-COO-215, 217, 236',
  },
  'preassemblage.gerer': {
    libelle: 'Pré-assemblage (marquer / désassembler)',
    roles: ['coord', 'cheq'],
    source: 'COO §2 bloc 2 ; RG-COO-233',
  },
  'suivi_8m2.saisir': {
    libelle: 'Saisie du suivi 8 m² ; afficher le n° de panneau Broadcast',
    roles: ['coord', 'cheq'],
    source: 'COO §2 bloc 2 ; RG-COO-237, 229',
  },
  'semaine.liberer': {
    libelle: 'Libérer la semaine (fixe, pliage, bus)',
    roles: ['coord'],
    source: 'COO §2 bloc 2 ; cheq « ? » (Q-265) ; RG-COO-240',
  },
  'preprod.rendre_main': {
    libelle: 'Rendre la main à la Pré-Prod (unitaire)',
    roles: ['coord'],
    source: 'COO §2 bloc 2 ; RG-COO-243 ; Q-286',
  },
  'intitule.corriger': {
    libelle: 'Corriger l’intitulé (annonceur imprimé, thème)',
    roles: ['coord', 'cheq'],
    source: 'COO §2 bloc 2 ; RG-COO-244',
  },
  'unite.gerer': {
    libelle: 'Créer UM, retirer, préparer ; comptage pliage ; quantités à encoller',
    roles: ['coord', 'cheq'],
    source: 'COO §2 bloc 2 ; RG-COO-247, 249, 250, 260, 304',
  },
  'dispatch.gerer': {
    libelle: 'Dispatch : proposer / affecter / désaffecter un rouleur, liste de picking',
    roles: ['cheq'],
    source: 'COO §2 bloc 2 ; ECR-COO-10 ; coord/admin « ? » (Q-286)',
  },
  'bague.imprimer': {
    libelle: 'Imprimer / modifier les bagues',
    roles: ['cheq'],
    source: 'COO §2 bloc 2 ; ECR-COO-11 ; RG-COO-298 à 300',
  },
  'bague.reimprimer': {
    libelle: 'Réimprimer une bague',
    roles: ['cheq'],
    source: 'COO §2 bloc 2 ; ✔(cond.) directeur de plateforme / chef d’équipe ; RG-COO-301',
  },
  'colis.gerer': {
    libelle: 'Colis : rattacher UM / train, expédier, fin de journée',
    roles: ['cheq', 'expe'],
    source: 'COO §2 bloc 2 ; ECR-EXP-01 ; RG-COO-265 à 269',
  },
  'repartition.debloquer': {
    libelle: 'Déblocage de répartition (annulation répartitions / UM)',
    roles: ['coord', 'admin'],
    source: 'COO §2 bloc 2 ; RG-COO-277, 278 (pont bloc 1)',
  },
}
