// Famille « transitions-interdites » : toute transition absente des tables de transitions est refusée en 409 avec
// { code, message, regle } et n'écrit rien (CLAUDE.md §6). Réception : contrôle d'une palette déjà contrôlée (RG-REC-070)
// ou à identifier (RG-REC-071), double signalement, rattachement d'une palette déjà identifiée, retrait d'un lien déjà
// retiré, annulation d'une validation jamais posée. Coordination : instruction (RG-COO-040/045/046/062), colis,
// libération déjà faite (RG-COO-240), Colisage répété. Volume : ~volume/20 tours de 13 transitions interdites.
import type { Scenario } from './index.ts'
import { exiger, poster, verifierRejet, type Reponse } from '../api.ts'
import { creerSite } from '../contexte.ts'
import {
  appelUnitaire,
  chaineFixe,
  controler,
  creerInconnue,
  dossierAvecLignes,
  ligneRepartition,
  recevoirLignes,
  trainsDuDossier,
  typePreparation,
  validerAffiche,
} from '../monde.ts'
import { withTransaction } from '../../../src/core/transaction.ts'
import { annulerDossier } from '../../../src/modules/coordination/integration.ts'

export const transitionsInterdites: Scenario = {
  nom: 'transitions-interdites',
  regles: [
    'RG-REC-070',
    'RG-REC-071',
    'RG-COO-040',
    'RG-COO-045',
    'RG-COO-046',
    'RG-COO-062',
    'RG-COO-240',
  ],
  attendu: '409 pour chaque transition hors table, aucun changement de statut',
  async generer(jdd) {
    const site = await creerSite(jdd)
    const { db } = jdd.ctx
    const type = await typePreparation(jdd)
    const tours = Math.max(1, Math.round(jdd.volume / 20))
    const rec = site.users.recep.headers
    const coord = site.users.coord.headers
    const ver = async (code: string) =>
      (await db.instruction.findUniqueOrThrow({ where: { code } })).version
    const rejet = (nom: string, r: Reponse, regle?: string) => {
      jdd.compter('transitions.interdites')
      return verifierRejet(jdd, nom, r, { statuts: [409], ...(regle ? { regle } : {}) })
    }
    for (let t = 0; t < tours; t++) {
      // Réception : contrôle d'une palette contrôlée (070), d'une palette à identifier (071).
      const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
      const r = await recevoirLignes(jdd, site, d.lignes)
      exiger(await controler(jdd, site, r.receptionId), 'premier contrôle')
      rejet(
        'RG-REC-070 contrôle d’une palette déjà contrôlée',
        await controler(jdd, site, r.receptionId),
        'RG-REC-070',
      )
      const inc = await creerInconnue(jdd, site, 5)
      const recInc = await db.reception.findUniqueOrThrow({ where: { id: inc.receptionId } })
      const lecture = await jdd.ctx.app.inject({
        method: 'GET',
        url: `/api/receptions/${String(inc.receptionId)}/controle`,
        headers: rec,
      })
      const c = lecture.json<{
        version: number
        lignes: { afficheId: number; quantiteBl: number }[]
      }>()
      rejet(
        'RG-REC-071 contrôle d’une palette à identifier',
        await poster(jdd, `/api/receptions/${String(inc.receptionId)}/controle`, rec, {
          version: c.version,
          controleurId: site.users.recep.id,
          lignes: c.lignes.map((l) => ({
            afficheId: l.afficheId,
            qteComptee: l.quantiteBl,
            allee: 'A',
            rayon: '1',
          })),
        }),
        'RG-REC-071',
      )
      // Signalement : le premier passe, le second est refusé (R-11).
      exiger(
        await poster(jdd, `/api/affiches/${String(inc.afficheId)}/signaler`, rec, {
          receptionVersion: recInc.version,
        }),
        'signalement',
      )
      const recInc2 = await db.reception.findUniqueOrThrow({ where: { id: inc.receptionId } })
      rejet(
        'double signalement « dossier introuvable »',
        await poster(jdd, `/api/affiches/${String(inc.afficheId)}/signaler`, rec, {
          receptionVersion: recInc2.version,
        }),
      )
      // Rattachement d'une affiche déjà identifiée (palette pas « À identifier »).
      const a = r.affiches[0]
      if (!a) throw new Error('affiche')
      const autre = await dossierAvecLignes(jdd, site, { lignes: 1 })
      const l2 = autre.lignes[0]
      if (!l2) throw new Error('ligne')
      const aff = await db.affiche.findUniqueOrThrow({ where: { id: a.id } })
      rejet(
        'rattacher une inconnue : palette déjà identifiée',
        await poster(jdd, `/api/affiches/${String(a.id)}/rattacher-inconnue`, coord, {
          version: aff.version,
          lignes: [{ ligneAttendueId: l2.id, quantite: 1 }],
        }),
      )
      // Retrait d'un lien déjà retiré ; annulation d'une validation jamais posée.
      const lien = await db.afficheAttendue.findFirstOrThrow({
        where: { afficheId: a.id, actif: true },
      })
      const retrait = await poster(jdd, `/api/rattachements/${String(lien.id)}/retrait`, coord, {
        lienVersion: lien.version,
      })
      if (retrait.status === 200) {
        const apres = await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })
        rejet(
          'retrait d’un lien déjà retiré',
          await poster(jdd, `/api/rattachements/${String(lien.id)}/retrait`, coord, {
            lienVersion: apres.version,
          }),
        )
      }
      const neuf = await recevoirLignes(
        jdd,
        site,
        (await dossierAvecLignes(jdd, site, { lignes: 1 })).lignes,
      )
      const n0 = neuf.affiches[0]
      if (!n0) throw new Error('affiche')
      rejet(
        'annulation d’une validation jamais posée',
        await validerAffiche(jdd, site, n0.id, false),
      )
      // Instruction : transitions hors table (RG-COO-040 / 045 / 046).
      const di = await dossierAvecLignes(jdd, site, { lignes: 1, statut: 'PREPARATION_RECUE' })
      const cas: [
        string,
        'ERREUR' | 'PRET_A_PRODUIRE' | 'ANNULE' | 'A_TRAITER',
        'A_TRAITER' | 'EN_COURS' | 'ANNULE',
      ][] = [
        ['ERREUR vers A_TRAITER', 'ERREUR', 'A_TRAITER'],
        ['PRET_A_PRODUIRE vers EN_COURS', 'PRET_A_PRODUIRE', 'EN_COURS'],
        ['ANNULE vers EN_COURS', 'ANNULE', 'EN_COURS'],
        ['A_TRAITER vers A_TRAITER', 'A_TRAITER', 'A_TRAITER'],
      ]
      for (const [nom, depuis, vers] of cas) {
        const tr = await trainsDuDossier(jdd, site, di, {
          statutInstruction: depuis,
          statutFace: 'A_TRAITER',
        })
        rejet(
          `instruction ${nom}`,
          await poster(jdd, `/api/coordination/instructions/${tr.instruction.code}/statut`, coord, {
            version: await ver(tr.instruction.code),
            vers,
          }),
        )
      }
      // Dossier annulé : l'instruction est sans objet (RG-COO-062).
      const da = await dossierAvecLignes(jdd, site, { lignes: 1, statut: 'PREPARATION_RECUE' })
      const tra = await trainsDuDossier(jdd, site, da, {
        statutInstruction: 'EN_COURS',
        statutFace: 'EN_COURS',
      })
      await withTransaction(db, (tx) => annulerDossier(tx, da.dossier.contNum))
      rejet(
        'instruction d’un dossier annulé',
        await poster(jdd, `/api/coordination/instructions/${tra.instruction.code}/statut`, coord, {
          version: await ver(tra.instruction.code),
          vers: 'ANNULE',
        }),
        'RG-COO-062',
      )
      // Libération déjà faite ; Colisage répété ; colis : expédier deux fois, ouvrir un colis ouvert.
      const rep = await ligneRepartition(jdd, site, type.id, { qte: 6 })
      const ch = await chaineFixe(jdd, site, [{ id: rep.id, version: rep.version }])
      rejet(
        'libération d’une semaine déjà libérée',
        await appelUnitaire(jdd, site, 'liberer', {
          atelierId: site.ateliers.fixe.id,
          depart: `${String(jdd.depart.annee)}-W${String(jdd.depart.semaine).padStart(2, '0')}`,
        }),
        'RG-COO-240',
      )
      const repApres = await db.repartition.findUniqueOrThrow({ where: { id: rep.id } })
      rejet(
        'Colisage répété sur une ligne déjà colisée',
        await appelUnitaire(jdd, site, 'colisage', {
          lignes: [{ id: rep.id, version: repApres.version }],
        }),
      )
      const colisId = ch.colisIds[0]
      if (colisId === undefined) throw new Error('colis')
      const colis = await db.colis.findUniqueOrThrow({ where: { id: colisId } })
      rejet(
        'expédier un colis déjà expédié',
        await poster(
          jdd,
          `/api/coordination/colis/${String(colisId)}/expedier`,
          site.users.expe.headers,
          { version: colis.version },
        ),
      )
      const ouvert = (
        await poster(jdd, '/api/coordination/colis', site.users.expe.headers, {
          atelierId: site.ateliers.fixe.id,
          destinataireId: site.destinataires[0]?.id ?? 0,
        })
      ).body as { colis: { id: number; version: number } }
      rejet(
        'rouvrir un colis déjà ouvert',
        await poster(
          jdd,
          `/api/coordination/colis/${String(ouvert.colis.id)}/ouvrir`,
          site.users.expe.headers,
          { version: ouvert.colis.version },
        ),
      )
    }
  },
}
