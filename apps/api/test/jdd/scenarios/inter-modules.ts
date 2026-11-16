// Famille « inter-modules » : les cellules de la matrice d'impact Réception ↔ Coordination (ANALYSE_FONCTIONNELLE_COMPLETE
// §6.6) rejouées à la volée, avec les données de la seed, et vérifiées par lecture de la base / de l'API : R-06 (reçu
// compté une fois, répartition > reçu refusée), R-08 (écart > 10 % : Surplus + alerte), R-12 (thème changé : la
// Coordination garde la validation, la Réception la défait), R-16 (dossier annulé : affiche et stock intacts, ligne
// annulée), R-17 (réception qui couvre un train : « n unité(s) prête(s) », train PRÊT), R-18 (réception après l'export :
// alerte « Rajout après préparation »), C-01 (annulation de validation sans mouvement), C-09 (fin de journée : sortie de
// stock sur l'affiche reçue). RG-X-003, 011, 012, 017, 050, 060, 065, 079, 087. Volume : ~volume/20 tours.
import type { Scenario } from './index.ts'
import { exiger, lireApi, poster, verifierRejet } from '../api.ts'
import { creerSite } from '../contexte.ts'
import {
  chaineFixe,
  controler,
  creerInconnue,
  dossierAvecLignes,
  exporterTrains,
  finDeJournee,
  ligneRepartition,
  rattacherInconnue,
  recevoirLignes,
  stockDe,
  trainsDuDossier,
  typePreparation,
  validerAffiche,
} from '../monde.ts'
import { withTransaction } from '../../../src/core/transaction.ts'
import { annulerDossier } from '../../../src/modules/coordination/integration.ts'

export const interModules: Scenario = {
  nom: 'inter-modules',
  regles: [
    'RG-X-003',
    'RG-X-011',
    'RG-X-012',
    'RG-X-017',
    'RG-X-050',
    'RG-X-060',
    'RG-X-065',
    'RG-X-079',
    'RG-X-087',
  ],
  attendu:
    'les 9 cellules vérifiées à chaque tour (effets induits présents, états de l’autre module inchangés)',
  async generer(jdd) {
    const site = await creerSite(jdd)
    const { db } = jdd.ctx
    const type = await typePreparation(jdd)
    const tours = Math.max(1, Math.round(jdd.volume / 20))
    const coord = site.users.coord.headers
    const recep = site.users.recep.headers
    const alertesDe = async (contNum: number) =>
      (
        (await lireApi(jdd, `/api/alertes?dossier=${String(contNum)}`, coord)).body as {
          alertes: { regle: string; type: string }[]
        }
      ).alertes
    for (let t = 0; t < tours; t++) {
      // R-06 : une inconnue de 100 rattachée à trois dossiers (50 + 30 + 20) : reçu compté une fois.
      {
        const inc = await creerInconnue(jdd, site, 100)
        const ds = [
          await dossierAvecLignes(jdd, site, { lignes: 1 }),
          await dossierAvecLignes(jdd, site, { lignes: 1 }),
          await dossierAvecLignes(jdd, site, { lignes: 1 }),
        ]
        const lignes = ds.map((d, i) => ({
          ligneAttendueId: d.lignes[0]?.id ?? 0,
          quantite: [50, 30, 20][i] ?? 0,
        }))
        const trop = await rattacherInconnue(
          jdd,
          inc.afficheId,
          [{ ligneAttendueId: lignes[0]?.ligneAttendueId ?? 0, quantite: 101 }],
          coord,
        )
        verifierRejet(
          jdd,
          'R-06 répartition supérieure au reçu',
          trop,
          { statuts: [409, 422] },
          'RG-X-060',
        )
        exiger(await rattacherInconnue(jdd, inc.afficheId, lignes, coord), 'R-06 rattachement')
        const somme = (
          await db.afficheAttendue.aggregate({
            where: { afficheId: inc.afficheId, actif: true },
            _sum: { quantite: true },
          })
        )._sum.quantite
        jdd.verifier(
          'R-06 reçu compté une seule fois (Σ liens = stock)',
          somme === 100 && (await stockDe(jdd, inc.afficheId)) === 100,
          '100 = 100',
          `${String(somme)} / ${String(await stockDe(jdd, inc.afficheId))}`,
          'RG-X-060',
        )
      }
      // R-08 : écart de contrôle de +50 % : Surplus et alerte « Écart de réception ».
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 40 })
        const r = await recevoirLignes(jdd, site, d.lignes)
        exiger(await controler(jdd, site, r.receptionId, { ecart: 20 }), 'R-08 contrôle')
        const l = await db.receptionAttendue.findUniqueOrThrow({
          where: { id: d.lignes[0]?.id ?? 0 },
        })
        jdd.verifier(
          'R-08 ligne « Surplus » après un écart de contrôle',
          l.statut === 'SURPLUS',
          'SURPLUS',
          l.statut,
          'RG-X-017',
        )
        const al = await alertesDe(d.dossier.contNum)
        jdd.verifier(
          'R-08 alerte d’écart visible de la Coordination',
          al.some((a) => a.regle.startsWith('RG-REC-183') || a.regle === 'RG-X-017'),
          'alerte RG-REC-183',
          al.map((a) => a.regle).join(',') || 'aucune',
          'RG-X-017',
        )
      }
      // R-12 : thème changé. Coordination : validation conservée ; Réception : validation à refaire.
      for (const acteur of ['coord', 'recep'] as const) {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const autre = await dossierAvecLignes(jdd, site, {
          lignes: 1,
          ligne: { contNum: d.dossier.contNum },
        })
        const r = await recevoirLignes(jdd, site, d.lignes)
        const a = r.affiches[0]
        if (!a) throw new Error('affiche')
        exiger(await validerAffiche(jdd, site, a.id, true), 'R-12 validation')
        const lien = await db.afficheAttendue.findFirstOrThrow({
          where: { afficheId: a.id, actif: true },
        })
        const aff = await db.affiche.findUniqueOrThrow({ where: { id: a.id } })
        exiger(
          await poster(
            jdd,
            `/api/affiches/${String(a.id)}/changer-theme`,
            acteur === 'coord' ? coord : recep,
            { version: aff.version, lienId: lien.id, nouvelleLigneId: autre.lignes[0]?.id ?? 0 },
          ),
          `R-12 changement de thème (${acteur})`,
        )
        const apres = await db.affiche.findUniqueOrThrow({ where: { id: a.id } })
        jdd.verifier(
          `R-12 thème changé par ${acteur} : validation ${acteur === 'coord' ? 'conservée' : 'à refaire'}`,
          apres.validationAdmin === (acteur === 'coord'),
          acteur === 'coord' ? 'validée' : 'non validée',
          String(apres.validationAdmin),
          'RG-X-012',
        )
        jdd.verifier(
          `R-12 thème changé par ${acteur} : feuille à refaire`,
          apres.feuilleARefaire,
          'feuille à refaire',
          String(apres.feuilleARefaire),
          'RG-X-012',
        )
      }
      // R-16 : dossier annulé après réception : affiche, validation et stock intacts, ligne annulée.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const r = await recevoirLignes(jdd, site, d.lignes)
        const a = r.affiches[0]
        if (!a) throw new Error('affiche')
        exiger(await validerAffiche(jdd, site, a.id, true), 'R-16 validation')
        const avant = {
          stock: await stockDe(jdd, a.id),
          mouvements: await db.mouvement.count({ where: { afficheId: a.id } }),
        }
        await withTransaction(db, (tx) => annulerDossier(tx, d.dossier.contNum))
        const apres = await db.affiche.findUniqueOrThrow({ where: { id: a.id } })
        const ligne = await db.receptionAttendue.findUniqueOrThrow({
          where: { id: d.lignes[0]?.id ?? 0 },
        })
        jdd.verifier(
          'R-16 dossier annulé : ligne annulée, affiche validée et stock intacts',
          ligne.etatLigne === 'ANNULEE' &&
            apres.validationAdmin &&
            (await stockDe(jdd, a.id)) === avant.stock &&
            (await db.mouvement.count({ where: { afficheId: a.id } })) === avant.mouvements,
          'ANNULEE + intact',
          `${ligne.etatLigne} ${String(apres.validationAdmin)}`,
          'RG-X-065',
        )
      }
      // R-17 : la réception qui couvre le visuel d'un train en attente le rend PRÊT.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, statut: 'PREPARATION_RECUE' })
        const tr = await trainsDuDossier(jdd, site, d)
        const trainId = tr.faces[0]?.trainId ?? ''
        const statut = async () =>
          (
            (await lireApi(jdd, `/api/coordination/trains/${trainId}`, coord)).body as {
              statut: string
            }
          ).statut
        const avant = await statut()
        await recevoirLignes(jdd, site, d.lignes)
        const apres = await statut()
        jdd.verifier(
          'R-17 train EN_ATTENTE puis PRÊT après la réception du visuel',
          avant === 'EN_ATTENTE' && apres === 'PRET',
          'EN_ATTENTE → PRET',
          `${avant} → ${apres}`,
          'RG-X-003',
        )
      }
      // R-18 : réception APRÈS l'export des trains : alerte « Rajout après préparation ».
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, statut: 'PREPARATION_RECUE' })
        await trainsDuDossier(jdd, site, d)
        exiger(await exporterTrains(jdd, site), 'R-18 export')
        await new Promise((fin) => setTimeout(fin, 15))
        await recevoirLignes(jdd, site, d.lignes)
        const al = await alertesDe(d.dossier.contNum)
        jdd.verifier(
          'R-18 alerte « affiche reçue après l’export » (RG-X-011)',
          al.some((a) => a.regle === 'RG-X-011'),
          'RG-X-011',
          al.map((a) => a.regle).join(',') || 'aucune',
          'RG-X-011',
        )
      }
      // C-01 : annulation de la validation après contrôle : aucun mouvement, palette inchangée.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const r = await recevoirLignes(jdd, site, d.lignes)
        const a = r.affiches[0]
        if (!a) throw new Error('affiche')
        exiger(await controler(jdd, site, r.receptionId), 'C-01 contrôle')
        exiger(await validerAffiche(jdd, site, a.id, true), 'C-01 validation')
        const avant = await db.mouvement.count({ where: { afficheId: a.id } })
        exiger(await validerAffiche(jdd, site, a.id, false), 'C-01 annulation')
        const rec = await db.reception.findUniqueOrThrow({ where: { id: r.receptionId } })
        jdd.verifier(
          'C-01 annuler la validation : aucun mouvement, palette toujours contrôlée',
          (await db.mouvement.count({ where: { afficheId: a.id } })) === avant &&
            rec.statut === 'CONTROLEE',
          'inchangés',
          rec.statut,
          'RG-X-050',
        )
      }
      // C-09 : fin de journée : sortie de stock « Expédition » sur l'affiche reçue.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 20 })
        const l = d.lignes[0]
        if (!l) throw new Error('ligne')
        const r = await recevoirLignes(jdd, site, d.lignes)
        const a = r.affiches[0]
        if (!a) throw new Error('affiche')
        const rep = await ligneRepartition(jdd, site, type.id, {
          contNum: d.dossier.contNum,
          theme: l.theme,
          qte: 8,
        })
        await chaineFixe(jdd, site, [{ id: rep.id, version: rep.version }])
        exiger(await finDeJournee(jdd, site), 'C-09 fin de journée')
        const sortie = await db.mouvement.findFirst({
          where: { afficheId: a.id, type: 'EXPEDITION' },
        })
        jdd.verifier(
          'C-09 sortie de stock de 8 sur l’affiche reçue, stock = reçu − 8',
          sortie?.quantite === -8 && (await stockDe(jdd, a.id)) === a.quantite - 8,
          '-8 ; reçu − 8',
          `${String(sortie?.quantite)} ; ${String(await stockDe(jdd, a.id))}`,
          'RG-X-087',
        )
      }
    }
  },
}
