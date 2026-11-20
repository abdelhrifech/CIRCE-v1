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
  fort?: boolean
  separe?: boolean
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
        id: 'analyse',
        libelle: 'Analyse Production',
        to: '/pilotage/analyse',
        permission: 'train.consulter',
      },
      {
        id: 'suivi-prod',
        libelle: 'Suivi de prod',
        to: '/pilotage/suivi',
        permission: 'instruction.consulter',
      },
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
      {
        id: 'picking',
        libelle: 'Zone picking',
        to: '/reception/picking',
        permission: 'affiche.consulter',
      },
      {
        id: 'fusion',
        libelle: 'Fusion des affiches',
        to: '/reception/fusion',
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
        libelle: 'Nouvelle demande',
        to: '/non-conformite',
        permission: 'nonconformite.declarer',
        search: { tab: 'demande' },
      },
      {
        id: 'nc-suivi',
        fort: true,
        libelle: 'Suivi des NC',
        to: '/non-conformite',
        permission: 'nonconformite.consulter',
        search: { tab: 'suivi' },
      },
    ],
  },
  {
    id: 'fixe',
    titre: '2 m² fixe',
    entrees: [
      {
        id: 'suivi-fixe',
        libelle: 'Suivi 2 m² fixe',
        to: '/pilotage/suivi',
        search: { pour: 'fixe' },
        permission: 'instruction.consulter',
        fort: true,
        separe: true,
      },
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
        id: 'suivi-pliage',
        libelle: 'Suivi pliage',
        to: '/pilotage/suivi',
        search: { pour: 'pliage' },
        permission: 'instruction.consulter',
        fort: true,
        separe: true,
      },
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
        id: 'suivi-deroulant',
        libelle: 'Suivi déroulant',
        to: '/pilotage/suivi',
        search: { pour: 'deroulant' },
        permission: 'instruction.consulter',
        fort: true,
        separe: true,
      },
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
      ...(['besoin', 'prepa', 'd8', 'positions', 'export'] as const).map((tab) => ({
        id: `deroulant-${tab}`,
        libelle:
          tab === 'besoin'
            ? 'Suivi par thème'
            : tab === 'prepa'
              ? 'Préparation'
              : tab === 'positions'
                ? 'Position Train'
                : tab === 'export'
                  ? 'Export préparation'
                  : 'Suivi 8 m²',
        to: '/coordination/trains',
        search: { tab },
        permission: 'train.consulter' as const,
      })),
      {
        id: 'deroulant-colis',
        libelle: 'Liste des colis',
        to: '/expedition/colis',
        search: { type: 'deroulant' },
        permission: 'colis.gerer',
      },
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
        libelle: 'Suivi bus',
        fort: true,
        separe: true,
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
      {
        id: 'colis-exterieur',
        libelle: 'Liste des colis (extérieur)',
        to: '/expedition/exterieur',
        permission: 'colis.gerer',
      },
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
    id: 'stocks',
    titre: 'Stocks',
    entrees: [
      {
        id: 'stock-affiches',
        libelle: 'Stock par affiche',
        to: '/stocks',
        permission: 'stock.consulter',
      },
      {
        id: 'stock-mouvements',
        libelle: 'Mouvements',
        to: '/stocks/mouvements',
        permission: 'stock.consulter',
      },
      {
        id: 'fin-campagne',
        libelle: 'Fin de campagne',
        to: '/stocks/fin-campagne',
        permission: 'stock.fin_campagne.consulter',
      },
    ],
  },
  {
    id: 'admin',
    titre: 'Administration',
    entrees: [
      {
        id: 'admin-fin-campagne',
        libelle: 'Règles de fin de campagne',
        to: '/admin/fin-campagne',
        permission: 'parametrage.gerer',
      },
      { id: 'admin-mails', libelle: 'Mails', to: '/admin/mails', permission: 'parametrage.gerer' },
      {
        id: 'admin-machines',
        libelle: 'Machines et fichiers',
        to: '/admin/machines',
        permission: 'parametrage.gerer',
      },
      {
        id: 'admin-statuts',
        libelle: 'Statuts',
        to: '/admin/statuts',
        permission: 'parametrage.gerer',
      },
      {
        id: 'admin-transport',
        libelle: 'Transport',
        to: '/admin/transport',
        permission: 'parametrage.gerer',
      },
      {
        id: 'admin-journal',
        libelle: 'Journal',
        to: '/admin/journal',
        permission: 'parametrage.gerer',
      },

      {
        id: 'admin-deblocage',
        libelle: 'Déblocage préparations',
        to: '/coordination/deblocage',
        permission: 'deblocage.consulter',
      },
      {
        id: 'admin-debloquees',
        libelle: 'Préparations débloquées',
        to: '/coordination/deblocage',
        permission: 'deblocage.consulter',
      },
      {
        id: 'admin-rafraichir',
        libelle: 'Rafraîchir un dossier',
        to: '/coordination/integration',
        permission: 'alimentation.manuelle',
      },
      {
        id: 'admin-dupliquer',
        libelle: 'Dupliquer train',
        to: '/admin/dupliquer-train',
        permission: 'train.dupliquer',
      },

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
        libelle: 'Utilisateurs et menus',
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
