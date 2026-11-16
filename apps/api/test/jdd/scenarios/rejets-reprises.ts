// Famille « rejets-reprises » : un rejet ou une annulation, puis la reprise du parcours. BL refusé puis corrigé ;
// validation posée, annulée (RG-X-050), reposée ; inconnue rattachée, lien retiré (elle redevient orpheline,
// RG-X-058), rattachée à un autre dossier ; instruction annulée puis reprise (RG-COO-045) ; colis retiré d'un colis ouvert puis remis ; thème changé (RG-X-012). Volume : ~volume/10 tours. État attendu : chaque reprise
// aboutit (2xx) et les historiques gardent la trace de chaque étape.
import type { Scenario } from './index.ts'
import { corpsBl, exiger, poster, verifierRejet } from '../api.ts'
import { creerSite } from '../contexte.ts'
import {
  chaineFixe,
  creerInconnue,
  dossierAvecLignes,
  ligneRepartition,
  rattacherInconnue,
  recevoirLignes,
  trainsDuDossier,
  typePreparation,
  validerAffiche,
} from '../monde.ts'

export const rejetsReprises: Scenario = {
  nom: 'rejets-reprises',
  regles: ['RG-X-012', 'RG-X-050', 'RG-X-058', 'RG-COO-045', 'RG-REC-023'],
  attendu: 'chaque reprise après rejet ou annulation aboutit, historiques complets',
  async generer(jdd) {
    const site = await creerSite(jdd)
    const { db } = jdd.ctx
    const type = await typePreparation(jdd)
    const tours = Math.max(1, Math.round(jdd.volume / 10))
    const coord = site.users.coord.headers
    for (let t = 0; t < tours; t++) {
      // BL refusé (quantité négative) puis corrigé.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const l = d.lignes[0]
        if (!l) throw new Error('ligne')
        const bl = await corpsBl(jdd, site, [{ ligneAttendueId: l.id, quantite: 5 }])
        verifierRejet(
          jdd,
          'BL refusé avant reprise',
          await poster(jdd, '/api/receptions', site.users.recep.headers, {
            ...bl,
            lignes: [{ ligneAttendueId: l.id, quantite: -5, cochee: true }],
          }),
          { statuts: [400, 422] },
        )
        exiger(await poster(jdd, '/api/receptions', site.users.recep.headers, bl), 'BL corrigé')
        jdd.compter('reprises')
      }
      // Validation : poser, annuler, reposer.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const r = await recevoirLignes(jdd, site, d.lignes)
        const a = r.affiches[0]
        if (!a) throw new Error('affiche')
        exiger(await validerAffiche(jdd, site, a.id, true), 'validation')
        exiger(await validerAffiche(jdd, site, a.id, false), 'annulation de la validation')
        exiger(await validerAffiche(jdd, site, a.id, true), 'nouvelle validation')
        jdd.compter('reprises')
        // Thème changé par la Coordination vers un autre thème du même dossier (RG-X-012).
        const lien = await db.afficheAttendue.findFirstOrThrow({
          where: { afficheId: a.id, actif: true },
        })
        const autre = await dossierAvecLignes(jdd, site, {
          lignes: 1,
          ligne: { contNum: d.dossier.contNum },
        })
        const aff = await db.affiche.findUniqueOrThrow({ where: { id: a.id } })
        exiger(
          await poster(jdd, `/api/affiches/${String(a.id)}/changer-theme`, coord, {
            version: aff.version,
            lienId: lien.id,
            nouvelleLigneId: autre.lignes[0]?.id ?? 0,
          }),
          'changement de thème',
        )
      }
      // Inconnue : rattachée, retirée (orpheline), rattachée à un autre dossier.
      {
        const inc = await creerInconnue(jdd, site, 12)
        const d1 = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const d2 = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const l1 = d1.lignes[0]
        const l2 = d2.lignes[0]
        if (!l1 || !l2) throw new Error('lignes')
        exiger(
          await rattacherInconnue(
            jdd,
            inc.afficheId,
            [{ ligneAttendueId: l1.id, quantite: 12 }],
            coord,
          ),
          'rattachement',
        )
        const lien = await db.afficheAttendue.findFirstOrThrow({
          where: { afficheId: inc.afficheId, actif: true },
        })
        exiger(
          await poster(jdd, `/api/rattachements/${String(lien.id)}/retrait`, coord, {
            lienVersion: lien.version,
          }),
          'retrait du dernier lien',
        )
        const a = await db.affiche.findUniqueOrThrow({ where: { id: inc.afficheId } })
        jdd.verifier(
          'RG-X-058 le retrait du dernier dossier rend l’affiche orpheline',
          a.statut === 'ORPHELINE' && !a.validationAdmin,
          'ORPHELINE non validée',
          `${a.statut} ${String(a.validationAdmin)}`,
          'RG-X-058',
        )
        exiger(
          await rattacherInconnue(
            jdd,
            inc.afficheId,
            [{ ligneAttendueId: l2.id, quantite: 12 }],
            coord,
          ),
          'nouveau rattachement',
        )
        jdd.compter('reprises')
      }
      // Instruction annulée puis reprise (RG-COO-045).
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, statut: 'PREPARATION_RECUE' })
        const tr = await trainsDuDossier(jdd, site, d, {
          statutInstruction: 'A_TRAITER',
          statutFace: 'A_TRAITER',
        })
        for (const vers of ['ANNULE', 'A_TRAITER'] as const) {
          const i = await db.instruction.findUniqueOrThrow({ where: { code: tr.instruction.code } })
          exiger(
            await poster(
              jdd,
              `/api/coordination/instructions/${tr.instruction.code}/statut`,
              coord,
              { version: i.version, vers },
            ),
            `instruction vers ${vers}`,
          )
        }
        jdd.compter('reprises')
      }
      // Colis : un colis clos ne se rouvre pas (RG-COO-266, 409) ; reprise = retirer l'UM d'un colis OUVERT, la remettre, expédier.
      {
        const dest = site.destinataires[0]?.id ?? 0
        const rep = await ligneRepartition(jdd, site, type.id, { qte: 8, destinataireId: dest })
        const rep2 = await ligneRepartition(jdd, site, type.id, { qte: 3, destinataireId: dest })
        const ch = await chaineFixe(
          jdd,
          site,
          [rep, rep2].map((r) => ({ id: r.id, version: r.version })),
          { expedier: false },
        )
        const colisId = ch.colisIds[0] ?? 0
        const umId = ch.umIds[0] ?? 0
        const h = site.users.expe.headers
        const um = await db.uniteManutention.findUniqueOrThrow({ where: { id: umId } })
        let c = await db.colis.findUniqueOrThrow({ where: { id: colisId } })
        exiger(
          await poster(jdd, `/api/coordination/colis/${String(colisId)}/retirer`, h, {
            version: c.version,
            unites: [umId],
          }),
          'retrait de l’UM du colis',
        )
        c = await db.colis.findUniqueOrThrow({ where: { id: colisId } })
        exiger(
          await poster(jdd, `/api/coordination/colis/${String(colisId)}/unites`, h, {
            version: c.version,
            code: um.codeBarre ?? `UM-${String(umId)}`,
          }),
          'UM remise dans le colis',
        )
        c = await db.colis.findUniqueOrThrow({ where: { id: colisId } })
        exiger(
          await poster(jdd, `/api/coordination/colis/${String(colisId)}/expedier`, h, {
            version: c.version,
          }),
          'expédition',
        )
        c = await db.colis.findUniqueOrThrow({ where: { id: colisId } })
        verifierRejet(
          jdd,
          'un colis clos ne se rouvre pas',
          await poster(jdd, `/api/coordination/colis/${String(colisId)}/ouvrir`, h, {
            version: c.version,
          }),
          { statuts: [409], code: 'COO_COLIS_NON_ROUVRABLE', regle: 'RG-COO-266' },
        )
        jdd.compter('reprises')
      }
    }
  },
}
