// Famille « profils » : les six profils (coord, cheq, recep, expe, admin, com) + un utilisateur HORS périmètre, un
// utilisateur SANS rôle et une requête sans identité, sur des actions de Réception et de Coordination. Résultat
// attendu = matrice du catalogue des permissions (source unique, core/permissions/catalogue.ts) : refusé en 403
// { code, message, regle } sinon 2xx ; hors périmètre 403 (RG-REC-001 / RG-COO-167) ; sans identité 401. RG : RG-REC-001,
// RG-REC-002, RG-REC-003, RG-COO-165, RG-COO-167, RG-COO-168. Volume : ~volume/50 tours (1 à 12) × 8 actions × 9 acteurs.
import type { Scenario } from './index.ts'
import { corpsBl, lireApi, poster, verifierRejet, type Reponse } from '../api.ts'
import {
  creerSite,
  creerUtilisateur,
  PROFILS,
  type Headers,
  type Jdd,
  type SiteJdd,
} from '../contexte.ts'
import { departTexte, dossierAvecLignes, recevoirLignes, trainsDuDossier } from '../monde.ts'
import { CATALOGUE_PERMISSIONS } from '../../../src/core/permissions/catalogue.ts'
import type { PermissionCode } from '@circe/shared'
import * as f from '../../factories/index.ts'

interface Acteur {
  headers: Headers
  id: number
}

interface Action {
  nom: string
  permission: PermissionCode
  /** Prépare une requête propre à (acteur) et l'exécute avec les en-têtes donnés. */
  appeler(jdd: Jdd, site: SiteJdd, acteur: Acteur): Promise<Reponse>
}

const ACTIONS: Action[] = [
  {
    nom: 'valider la réception',
    permission: 'reception.valider',
    async appeler(jdd, site, { headers: h, id }) {
      const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
      const l = d.lignes[0]
      if (!l) throw new Error('ligne')
      return poster(
        jdd,
        '/api/receptions',
        h,
        await corpsBl(jdd, site, [{ ligneAttendueId: l.id, quantite: 2 }], undefined, id),
      )
    },
  },
  {
    nom: 'créer une réception inconnue',
    permission: 'reception.inconnue.creer',
    async appeler(jdd, site, { headers: h, id }) {
      const photo = await f.createPhoto(jdd.ctx.db, { taille: 16, createdById: id })
      return poster(jdd, '/api/receptions-inconnues', h, {
        plateformeId: site.plateforme.id,
        supportId: site.supports[0]?.id ?? 0,
        annonceur: 'X',
        theme: 'Y',
        imprimeurId: null,
        quantite: 3,
        allee: 'A',
        rayon: '1',
        photoAfficheId: null,
        photoBlId: photo.id,
        sansBl: false,
        numeroBl: `BL-PRO-${String(f.next())}`,
      })
    },
  },
  {
    nom: 'valider une affiche (validation admin)',
    permission: 'validation_admin.valider',
    async appeler(jdd, site, { headers: h }) {
      const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
      const r = await recevoirLignes(jdd, site, d.lignes)
      const a = r.affiches[0]
      if (!a) throw new Error('affiche')
      const aff = await jdd.ctx.db.affiche.findUniqueOrThrow({ where: { id: a.id } })
      return poster(jdd, `/api/coordination/affiches/${String(a.id)}/validation-admin`, h, {
        version: aff.version,
        valider: true,
      })
    },
  },
  {
    nom: 'mettre une affiche au rebut',
    permission: 'stock.rebut',
    async appeler(jdd, site, { headers: h }) {
      const d = await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 10 })
      const r = await recevoirLignes(jdd, site, d.lignes)
      const a = r.affiches[0]
      if (!a) throw new Error('affiche')
      return poster(jdd, `/api/affiches/${String(a.id)}/rebut`, h, {
        quantite: 1,
        motif: 'AFFICHE_DECHIREE',
      })
    },
  },
  {
    nom: 'exporter les trains (simulation)',
    permission: 'train.exporter',
    async appeler(jdd, site, { headers: h }) {
      const d = await dossierAvecLignes(jdd, site, { lignes: 1, statut: 'PREPARATION_RECUE' })
      await trainsDuDossier(jdd, site, d)
      return poster(jdd, '/api/coordination/trains/export', h, {
        depart: departTexte(jdd),
        simulation: true,
      })
    },
  },
  {
    nom: 'ouvrir un colis',
    permission: 'colis.gerer',
    appeler: (jdd, site, { headers: h }) =>
      poster(jdd, '/api/coordination/colis', h, {
        atelierId: site.ateliers.fixe.id,
        destinataireId: site.destinataires[0]?.id ?? 0,
      }),
  },
  {
    nom: 'libérer la semaine',
    permission: 'semaine.liberer',
    async appeler(jdd, site, { headers: h }) {
      const atelier = await f.createAtelier(jdd.ctx.db, {
        plateformeId: site.plateforme.id,
        type: 'FIXE',
      })
      return poster(jdd, '/api/coordination/unitaire/liberer', h, {
        atelierId: atelier.id,
        depart: departTexte(jdd),
      })
    },
  },
  {
    nom: 'lire les alertes',
    permission: 'alerte.consulter',
    appeler: (jdd, _s, { headers: h }) => lireApi(jdd, '/api/alertes', h),
  },
  {
    nom: 'lire les trains',
    permission: 'train.consulter',
    appeler: (jdd, _s, { headers: h }) =>
      lireApi(jdd, `/api/coordination/trains?depart=${departTexte(jdd)}`, h),
  },
  {
    nom: 'lire la liste des affiches',
    permission: 'affiche.consulter',
    appeler: (jdd, _s, { headers: h }) => lireApi(jdd, '/api/affiches', h),
  },
  {
    nom: 'lire le sas',
    permission: 'reception.sas.consulter',
    appeler: (jdd, _s, { headers: h }) => lireApi(jdd, '/api/receptions/sas', h),
  },
  {
    nom: 'lire les dossiers de coordination',
    permission: 'instruction.consulter',
    appeler: (jdd, _s, { headers: h }) => lireApi(jdd, '/api/coordination/dossiers', h),
  },
]

export const profils: Scenario = {
  nom: 'profils',
  regles: ['RG-REC-001', 'RG-REC-002', 'RG-REC-003', 'RG-COO-165', 'RG-COO-167', 'RG-COO-168'],
  attendu:
    'autorisé exactement pour les rôles du catalogue ; 403 / 401 sinon, avec { code, message, regle }',
  async generer(jdd) {
    const site = await creerSite(jdd)
    const ailleurs = await creerSite(jdd)
    const sansRole = await creerUtilisateur(jdd, [], [site.plateforme.id])
    const horsPerimetre = await creerUtilisateur(
      jdd,
      ['coord', 'recep', 'cheq', 'expe'],
      [ailleurs.plateforme.id],
    )
    // Plafonné : chaque tour appelle 12 actions × 9 acteurs ; les lectures d'alertes coûtent ~0,5 s sous volume.
    const tours = Math.min(12, Math.max(1, Math.round(jdd.volume / 50)))
    for (let t = 0; t < tours; t++) {
      for (const a of ACTIONS) {
        const def = CATALOGUE_PERMISSIONS[a.permission]
        for (const role of PROFILS) {
          const r = await a.appeler(jdd, site, site.users[role])
          jdd.compter('profils.appels')
          // Q-421 : l'admin est super-utilisateur (toutes les permissions) ; périmètre et règles d'état restent appliqués.
          const autorise = role === 'admin' || def.roles.includes(role)
          if (autorise)
            jdd.verifier(
              `${role} peut « ${a.nom} »`,
              r.status >= 200 && r.status < 300,
              '2xx',
              `${String(r.status)} ${r.code ?? ''}`,
              a.permission,
            )
          else
            verifierRejet(
              jdd,
              `${role} ne peut pas « ${a.nom} »`,
              r,
              { statuts: [403] },
              a.permission,
            )
        }
        verifierRejet(
          jdd,
          `sans rôle : « ${a.nom} »`,
          await a.appeler(jdd, site, sansRole),
          { statuts: [403] },
          a.permission,
        )
        const hors = await a.appeler(jdd, site, horsPerimetre)
        // Un utilisateur hors périmètre ne voit rien du site : 403 (écriture / objet du site) ou 200 sur une liste vide.
        const json = JSON.stringify(hors.body)
        const voitLeSite =
          json.includes(`"plateformeId":${String(site.plateforme.id)}`) ||
          json.includes(`"id":${String(site.plateforme.id)},"nom":"${site.plateforme.nom}"`) ||
          json.includes(site.plateforme.nom)
        const refuse =
          hors.status === 403 ||
          hors.status === 404 ||
          (hors.status === 200 && a.nom.startsWith('lire') && !voitLeSite) ||
          (hors.status === 422 && hors.code === 'COO_RIEN_A_EXPORTER') // périmètre vide : rien à exporter
        jdd.verifier(
          `hors périmètre : « ${a.nom} »`,
          refuse,
          '403 / 404 / liste sans le site',
          `${String(hors.status)} ${hors.code ?? ''}`,
          'RG-REC-001',
        )
        const sans = await a.appeler(jdd, site, { headers: {}, id: site.users.recep.id })
        jdd.verifier(
          `sans identité : « ${a.nom} »`,
          sans.status === 401,
          '401',
          String(sans.status),
          'RG-REC-002',
        )
      }
    }
  },
}
