// EX-NEW-NAV-001 : navigation de la nouvelle maquette ; les routes appliquent leurs droits côté serveur.
import type { MeResponse, PermissionCode } from '@circe/shared'

export type CleBadge = 'palettes' | 'inconnues' | 'alertes'

export interface EntreeNav {
  id: string
  libelle: string
  /** Route réelle (TanStack Router). */
  to: string
  search?: Record<string, string>
  permission: PermissionCode
  groupe?: string
  badge?: CleBadge
}

export interface OngletNav {
  id: string
  titre: string
  entrees: EntreeNav[]
}

export const NAV: OngletNav[] = [
  {
    id: 'pilotage',
    titre: 'Pilotage',
    entrees: [
      {
        id: 'tableau',
        libelle: 'Tableau de bord préproduction',
        to: '/pilotage/tableau',
        permission: 'validation_admin.valider',
      },
      {
        id: 'reservations',
        libelle: 'État des réservations vivant',
        to: '/pilotage/reservations',
        permission: 'reservations.consulter',
      },
      {
        id: 'alertes',
        libelle: 'Alertes',
        to: '/pilotage/alertes',
        permission: 'alerte.consulter',
        badge: 'alertes',
      },
      ...(['proches', 'annonceurs', 'bc'] as const).map((tab) => ({
        id: `themes-${tab}`,
        groupe: 'Vérification des thèmes',
        libelle:
          tab === 'proches'
            ? 'Thèmes proches entre dossiers'
            : tab === 'annonceurs'
              ? 'Annonceurs proches'
              : 'Thèmes modifiés dans Broadcast',
        to: '/coordination/themes',
        search: { tab },
        permission: 'verification_themes.consulter' as const,
      })),
    ],
  },
  {
    id: 'reception',
    titre: 'Réception',
    entrees: [
      {
        id: 'reception',
        libelle: 'Réception des affiches',
        to: '/reception',
        permission: 'reception.attendues.consulter',
        badge: 'palettes',
      },
      {
        id: 'inconnues',
        libelle: 'Réceptions inconnues',
        to: '/reception/inconnues',
        permission: 'reception.inconnue.consulter',
        badge: 'inconnues',
      },
      {
        id: 'affiches',
        libelle: 'Liste des affiches',
        to: '/reception/affiches',
        permission: 'affiche.consulter',
      },
      { id: 'j3', libelle: 'J−3', to: '/reception/j3', permission: 'j3.gerer' },
    ],
  },
  {
    id: 'non-conformite',
    titre: 'Non-conformité',
    entrees: [
      {
        id: 'nc-nouvelle',
        libelle: 'Réception contrôlée · Nouvelle réception',
        to: '/non-conformite',
        permission: 'nonconformite.declarer',
        search: { tab: 'reception' },
      },
      {
        id: 'nc-suivi',
        libelle: 'Réception contrôlée · Suivi des NC',
        to: '/non-conformite',
        permission: 'nonconformite.consulter',
        search: { tab: 'suivi' },
      },
      {
        id: 'nc-agence',
        libelle: 'Réclamation agence · Nouvelle demande',
        to: '/non-conformite',
        permission: 'nonconformite.declarer',
        search: { tab: 'declaration' },
      },
      {
        id: 'nc-agence-suivi',
        libelle: 'Réclamation agence · Suivi des NC',
        to: '/non-conformite',
        permission: 'nonconformite.consulter',
        search: { tab: 'reclamation' },
      },
    ],
  },
  {
    id: 'fixe',
    titre: '2 m² fixe',
    entrees: [
      {
        id: 'fixe-traiter',
        libelle: 'À traiter',
        to: '/coordination',
        permission: 'instruction.consulter',
        search: { pour: 'fixe' },
      },
      {
        id: 'fixe-preparer',
        libelle: 'Préparation',
        to: '/coordination/unitaire',
        permission: 'train.consulter',
        search: { type: 'fixe' },
      },
      {
        id: 'fixe-colis',
        libelle: 'Liste des colis',
        to: '/expedition/colis',
        permission: 'colis.gerer',
        search: { type: 'fixe' },
      },
    ],
  },
  {
    id: 'pliage',
    titre: 'Pliage',
    entrees: [
      {
        id: 'pliage-traiter',
        libelle: 'À traiter',
        to: '/coordination',
        permission: 'instruction.consulter',
        search: { pour: 'pliage' },
      },
      {
        id: 'pliage-preparer',
        libelle: 'Préparation',
        to: '/coordination/unitaire',
        permission: 'train.consulter',
        search: { type: 'pliage' },
      },
      {
        id: 'pliage-colis',
        libelle: 'Liste des colis',
        to: '/expedition/colis',
        permission: 'colis.gerer',
        search: { type: 'pliage' },
      },
    ],
  },
  {
    id: 'deroulant',
    titre: 'Déroulant',
    entrees: [
      {
        id: 'instructions',
        libelle: 'Liste des instructions',
        to: '/coordination',
        permission: 'instruction.consulter',
        search: { pour: 'deroulant' },
      },
      {
        id: 'trains',
        libelle: 'Liste des trains',
        to: '/coordination/trains',
        permission: 'train.consulter',
      },
      ...(['besoin', 'prepa', 'd8'] as const).map((tab) => ({
        id: `deroulant-${tab}`,
        libelle:
          tab === 'besoin' ? 'Suivi par thème' : tab === 'prepa' ? 'Préparation' : 'Suivi 8 m²',
        to: '/coordination/trains',
        search: { tab },
        permission: 'train.consulter' as const,
      })),
      {
        id: 'generateur',
        libelle: 'Fichiers Vendôme',
        to: '/coordination/generateur',
        permission: 'roulage.preparer',
      },
      { id: 'bagues', libelle: 'Bagues', to: '/coordination/bagues', permission: 'bague.imprimer' },
      {
        id: 'dispatch',
        libelle: 'Dispatch du roulage',
        to: '/coordination/dispatch',
        permission: 'dispatch.gerer',
      },
      {
        id: 'rouleurs',
        libelle: 'Rouleurs',
        to: '/coordination/rouleurs',
        permission: 'referentiel.gerer',
      },
    ],
  },
  {
    id: 'bus',
    titre: 'Bus',
    entrees: [
      {
        id: 'bus-suivi',
        libelle: 'Suivi de prod',
        to: '/bus',
        permission: 'bus.consulter',
        search: { tab: 'suivi' },
      },
      {
        id: 'bus-reception',
        libelle: 'Réceptions attendues',
        to: '/bus',
        permission: 'bus.consulter',
        search: { tab: 'reception' },
      },
      {
        id: 'bus-atraiter',
        libelle: 'À traiter',
        to: '/bus',
        permission: 'bus.consulter',
        search: { tab: 'atraiter' },
      },
      {
        id: 'bus-preparation',
        libelle: 'Préparation',
        to: '/bus',
        permission: 'bus.consulter',
        search: { tab: 'preparation' },
      },
      {
        id: 'bus-vue',
        libelle: 'Vue des réceptions',
        to: '/bus',
        permission: 'bus.consulter',
        search: { tab: 'vue' },
      },
    ],
  },
  {
    id: 'expedition',
    titre: 'Expédition',
    entrees: [
      { id: 'colisage', libelle: 'Scan et colisage', to: '/expedition', permission: 'colis.gerer' },
      { id: 'colis', libelle: 'Colis', to: '/expedition/colis', permission: 'colis.gerer' },
      {
        id: 'departs',
        libelle: 'Départs camions',
        to: '/expedition/departs',
        permission: 'colis.gerer',
      },
    ],
  },
  {
    id: 'admin',
    titre: 'Administration',
    entrees: [
      {
        id: 'declarants',
        libelle: 'Déclarants NC',
        to: '/admin/declarants',
        permission: 'referentiel.gerer',
      },
      {
        id: 'bus-references',
        libelle: 'Référentiels Bus',
        to: '/admin/bus',
        permission: 'referentiel.gerer',
      },
      {
        id: 'integration',
        libelle: 'Chargements Broadcast',
        to: '/coordination/integration',
        permission: 'alimentation.manuelle',
      },
      {
        id: 'deblocage',
        libelle: 'Déblocage des préparations',
        to: '/coordination/deblocage',
        permission: 'deblocage.consulter',
      },
      {
        id: 'parametres',
        libelle: 'Paramètres',
        to: '/admin/parametres',
        permission: 'parametrage.gerer',
      },
      {
        id: 'utilisateurs',
        libelle: 'Utilisateurs',
        to: '/admin/utilisateurs',
        permission: 'utilisateur.gerer',
      },
      {
        id: 'plateformes',
        libelle: 'Plateformes',
        to: '/admin/plateformes',
        permission: 'parametrage.gerer',
      },
      {
        id: 'referentiels',
        libelle: 'Référentiels',
        to: '/admin/referentiels',
        permission: 'referentiel.gerer',
      },
      {
        id: 'admin-alertes',
        libelle: 'Alertes et mails',
        to: '/admin/alertes',
        permission: 'parametrage.gerer',
      },
      {
        id: 'sites',
        libelle: 'Sites et ateliers',
        to: '/admin/sites',
        permission: 'parametrage.gerer',
      },
      {
        id: 'destinataires',
        libelle: 'Destinataires',
        to: '/coordination/destinataires',
        permission: 'referentiel.gerer',
      },
    ],
  },
]

type Permis = Pick<MeResponse, 'permissions'>
const a = (me: Permis, code: PermissionCode) => me.permissions.includes(code)

/**
 * Écran d'ouverture (Q-365) : la maquette ouvre sur Pilotage › Suivi de prod, absent ici. Ouverture sur la première
 * page accessible du profil : Réception (recep), Coordination (coord, cheq), Expédition (expe), Administration
 * (admin), sinon Alertes, sinon la page « Mon profil ».
 */
export function pageOuverture(me: MeResponse): string {
  if (me.roles.includes('admin') && a(me, 'parametrage.gerer')) return '/admin/parametres'
  if (me.roles.includes('recep') && a(me, 'reception.attendues.consulter')) return '/reception'
  if (me.roles.includes('expe') && a(me, 'colis.gerer')) return '/expedition'
  if ((me.roles.includes('coord') || me.roles.includes('cheq')) && a(me, 'instruction.consulter'))
    return '/coordination'
  if (a(me, 'alerte.consulter')) return '/pilotage/alertes'
  if (a(me, 'reception.attendues.consulter')) return '/reception'
  return '/moi'
}
