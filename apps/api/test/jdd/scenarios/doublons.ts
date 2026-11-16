// Famille « doublons » : clés métier et doubles soumissions. Même Idempotency-Key rejouée (un seul effet, même
// réponse) ou réutilisée avec un autre corps (409, RG-REC-008) ; n° de BL déjà réceptionné (avertissement, confirmation
// explicite, RG-REC-036) ; deux lignes actives d'un même thème (index unique partiel, RG-COO-080) ; code barre d'UM,
// dossier, identifiant d'utilisateur, couple UM × colis dupliqués (unicité en base) ; même UM ajoutée deux fois au
// colis (RG-COO-265). Volume : ~volume/20 tours. État attendu : un seul enregistrement par clé métier.
import type { Scenario } from './index.ts'
import { corpsBl, exiger, poster, verifierRejet } from '../api.ts'
import { creerSite } from '../contexte.ts'
import { chaineFixe, dossierAvecLignes, ligneRepartition, typePreparation } from '../monde.ts'
import * as f from '../../factories/index.ts'

async function rejetBase(
  jdd: Parameters<Scenario['generer']>[0],
  nom: string,
  regle: string,
  fn: () => Promise<unknown>,
) {
  jdd.compter('doublons.rejetes')
  try {
    await fn()
    jdd.verifier(nom, false, 'violation d’unicité refusée par la base', 'créé sans erreur', regle)
  } catch (e) {
    const code = (e as { code?: string }).code
    jdd.verifier(nom, code === 'P2002', 'P2002 (contrainte unique)', String(code ?? e), regle)
  }
}

export const doublons: Scenario = {
  nom: 'doublons',
  regles: ['RG-REC-008', 'RG-REC-036', 'RG-COO-080', 'RG-COO-261', 'RG-COO-265'],
  attendu: 'une seule réception par clé rejouée ; toute clé métier dupliquée refusée',
  async generer(jdd) {
    const site = await creerSite(jdd)
    const { db } = jdd.ctx
    const type = await typePreparation(jdd)
    const tours = Math.max(1, Math.round(jdd.volume / 20))
    const h = site.users.recep.headers
    for (let t = 0; t < tours; t++) {
      // 1. Rejeu de la même clé et du même corps : même réponse, une seule réception.
      const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
      const l = d.lignes[0]
      if (!l) throw new Error('ligne')
      const bl = await corpsBl(jdd, site, [{ ligneAttendueId: l.id, quantite: 3 }])
      const cle = jdd.cle()
      const avant = await db.reception.count({ where: { plateformeId: site.plateforme.id } })
      const r1 = exiger(await poster(jdd, '/api/receptions', h, bl, cle), 'première soumission')
      const r2 = await poster(jdd, '/api/receptions', h, bl, cle)
      const apres = await db.reception.count({ where: { plateformeId: site.plateforme.id } })
      jdd.verifier(
        'rejeu d’une clé : même réponse',
        r2.status === r1.status && JSON.stringify(r2.body) === JSON.stringify(r1.body),
        `${String(r1.status)} identique`,
        String(r2.status),
        'RG-REC-008',
      )
      jdd.verifier(
        'rejeu d’une clé : un seul effet',
        apres === avant + 1,
        String(avant + 1),
        String(apres),
        'RG-REC-008',
      )
      // 2. Même clé, corps différent : conflit.
      const bl2 = await corpsBl(jdd, site, [{ ligneAttendueId: l.id, quantite: 4 }])
      verifierRejet(
        jdd,
        'même clé d’idempotence, autre corps',
        await poster(jdd, '/api/receptions', h, bl2, cle),
        { statuts: [409, 422], regle: 'RG-REC-008' },
      )
      // 3. Même n° de BL : avertissement puis confirmation explicite.
      const d2 = await dossierAvecLignes(jdd, site, { lignes: 1 })
      const l2 = d2.lignes[0]
      if (!l2) throw new Error('ligne')
      const numero = bl.numeroBl
      const doublon = await poster(
        jdd,
        '/api/receptions',
        h,
        await corpsBl(jdd, site, [{ ligneAttendueId: l2.id, quantite: 2 }], numero),
      )
      const refuse = doublon.status >= 400
      jdd.verifier(
        'n° de BL déjà réceptionné : refusé sans confirmation',
        refuse,
        '4xx',
        String(doublon.status),
        'RG-REC-036',
      )
      if (refuse) {
        verifierRejet(jdd, 'n° de BL en doublon : format d’erreur', doublon, {
          statuts: [409, 422],
        })
        const confirme = await poster(jdd, '/api/receptions', h, {
          ...(await corpsBl(jdd, site, [{ ligneAttendueId: l2.id, quantite: 2 }], numero)),
          confirmerDoublon: true,
        })
        jdd.verifier(
          'n° de BL en doublon : accepté après confirmation',
          confirme.status === 201,
          '201',
          String(confirme.status),
          'RG-REC-036',
        )
      }
      // 4. Clés métier dupliquées en base (insertion directe refusée).
      await rejetBase(
        jdd,
        'deux lignes ACTIVES pour le même thème d’un dossier',
        'RG-COO-080',
        () =>
          f.createReceptionAttendue(db, {
            plateformeId: site.plateforme.id,
            supportId: l.supportId,
            contNum: l.contNum,
            theme: l.theme,
            themeCle: l.themeCle,
            etatLigne: 'ACTIVE',
            semAnnee: l.semAnnee,
            semNum: l.semNum,
          }),
      )
      await rejetBase(jdd, 'deux dossiers de même numéro', 'RG-COO-001', () =>
        f.createDossier(db, { contNum: d.dossier.contNum }),
      )
      await rejetBase(jdd, 'deux utilisateurs de même identifiant externe', 'RG-REC-002', () =>
        f.createUtilisateur(db, { identifiantExterne: site.users.coord.ext }),
      )
      // 5. UM : code barre unique ; même UM deux fois dans un colis.
      const rep = await ligneRepartition(jdd, site, type.id, { qte: 5 })
      const ch = await chaineFixe(jdd, site, [{ id: rep.id, version: rep.version }], {
        expedier: false,
      })
      const um = await db.uniteManutention.findFirstOrThrow({ where: { id: ch.umIds[0] } })
      await rejetBase(jdd, 'deux UM de même code barre', 'RG-COO-261', () =>
        f.createUniteManutention(db, { codeBarre: um.codeBarre, atelierId: site.ateliers.fixe.id }),
      )
      const colis = await db.colis.findUniqueOrThrow({ where: { id: ch.colisIds[0] ?? 0 } })
      verifierRejet(
        jdd,
        'la même UM ajoutée deux fois au colis',
        await poster(
          jdd,
          `/api/coordination/colis/${String(colis.id)}/unites`,
          site.users.expe.headers,
          { version: colis.version, code: um.codeBarre ?? `UM-${String(um.id)}` },
        ),
        { statuts: [409, 422] },
      )
      await rejetBase(jdd, 'deux liens UM × colis identiques', 'RG-COO-264', () =>
        db.uniteColis.create({ data: { uniteId: um.id, colisId: colis.id, quantite: 1 } }),
      )
    }
  },
}
