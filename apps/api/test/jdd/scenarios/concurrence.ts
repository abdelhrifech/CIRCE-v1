// Famille « concurrence » : requêtes réellement simultanées (Promise.all) sur la même ressource, verrou optimiste
// (champ `version`) et idempotence (CLAUDE.md §6). K-01 deux validations de même version : 200 + 409 ; K-02 valider ∥
// annuler : jamais d'état mixte ; K-06 même clé d'idempotence en parallèle : un seul effet ; K-09 deux réceptions sur la
// même ligne : Σ stock = Σ liens ; K-07 deux rattachements de la même inconnue : un gagnant ; Colisage et « Expédier »
// en double : un seul gagnant. RG : RG-REC-008, 009, RG-COO-040, 265, 266 ; RG-X-060. Volume : ~volume/20 tours.
import type { Scenario } from './index.ts'
import { corpsBl, poster, type Reponse } from '../api.ts'
import { creerSite } from '../contexte.ts'
import {
  appelUnitaire,
  chaineFixe,
  creerInconnue,
  dossierAvecLignes,
  ligneRepartition,
  recevoirLignes,
  stockDe,
  typePreparation,
} from '../monde.ts'

const statuts = (rs: Reponse[]) => rs.map((r) => r.status).sort((a, b) => a - b)

export const concurrence: Scenario = {
  nom: 'concurrence',
  regles: ['RG-REC-008', 'RG-REC-009', 'RG-COO-040', 'RG-COO-265', 'RG-COO-266', 'RG-X-060'],
  attendu: 'un seul gagnant par ressource, état final cohérent, aucun doublon',
  async generer(jdd) {
    const site = await creerSite(jdd)
    const { db } = jdd.ctx
    const type = await typePreparation(jdd)
    const tours = Math.max(2, Math.round(jdd.volume / 20))
    const coord = site.users.coord.headers
    const recep = site.users.recep.headers
    const expe = site.users.expe.headers
    for (let t = 0; t < tours; t++) {
      // K-01 : deux validations de même version.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const a = (await recevoirLignes(jdd, site, d.lignes)).affiches[0]
        if (!a) throw new Error('affiche')
        const v = (await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).version
        const url = `/api/coordination/affiches/${String(a.id)}/validation-admin`
        const rs = await Promise.all([
          poster(jdd, url, coord, { version: v, valider: true }),
          poster(jdd, url, coord, { version: v, valider: true }),
        ])
        jdd.verifier(
          'K-01 deux validations simultanées : 200 + 409',
          JSON.stringify(statuts(rs)) === '[200,409]',
          '[200,409]',
          JSON.stringify(statuts(rs)),
          'RG-COO-040',
        )
        jdd.compter('concurrence.paires')
        // K-02 : valider ∥ annuler (même version) : un seul gagnant.
        const v2 = (await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).version
        const rs2 = await Promise.all([
          poster(jdd, url, coord, { version: v2, valider: false }),
          poster(jdd, url, coord, { version: v2, valider: false }),
        ])
        jdd.verifier(
          'K-02 deux annulations simultanées : 200 + 409',
          JSON.stringify(statuts(rs2)) === '[200,409]',
          '[200,409]',
          JSON.stringify(statuts(rs2)),
          'RG-COO-040',
        )
      }
      // K-06 : même clé d'idempotence en parallèle : un seul effet.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const l = d.lignes[0]
        if (!l) throw new Error('ligne')
        const bl = await corpsBl(jdd, site, [{ ligneAttendueId: l.id, quantite: 4 }])
        const cle = jdd.cle()
        const avant = await db.reception.count({ where: { plateformeId: site.plateforme.id } })
        const rs = await Promise.all([
          poster(jdd, '/api/receptions', recep, bl, cle),
          poster(jdd, '/api/receptions', recep, bl, cle),
        ])
        const apres = await db.reception.count({ where: { plateformeId: site.plateforme.id } })
        jdd.verifier(
          'K-06 même clé en parallèle : une seule réception',
          apres === avant + 1 && rs.some((r) => r.status === 201),
          '+1 réception',
          `+${String(apres - avant)} ${JSON.stringify(statuts(rs))}`,
          'RG-REC-008',
        )
      }
      // K-09 : deux réceptions simultanées sur la même ligne : Σ stock = Σ liens.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 30 })
        const l = d.lignes[0]
        if (!l) throw new Error('ligne')
        const blA = await corpsBl(jdd, site, [{ ligneAttendueId: l.id, quantite: 10 }])
        const blB = await corpsBl(jdd, site, [{ ligneAttendueId: l.id, quantite: 12 }])
        const rs = await Promise.all([
          poster(jdd, '/api/receptions', recep, blA),
          poster(jdd, '/api/receptions', recep, blB),
        ])
        const liens = await db.afficheAttendue.findMany({
          where: { ligneAttendueId: l.id, actif: true },
        })
        let stock = 0
        for (const x of liens) stock += await stockDe(jdd, x.afficheId)
        const somme = liens.reduce((s, x) => s + x.quantite, 0)
        const acceptees = rs.filter((r) => r.status === 201).length
        jdd.verifier(
          'K-09 deux réceptions sur la même ligne : Σ stock = Σ liens, au moins une acceptée',
          stock === somme && acceptees >= 1,
          'Σ stock = Σ liens',
          `${String(stock)} / ${String(somme)} (${String(acceptees)} acceptée(s))`,
          'RG-X-060',
        )
      }
      // K-07 : deux rattachements simultanés de la même inconnue : un gagnant.
      {
        const inc = await creerInconnue(jdd, site, 10)
        const d1 = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const d2 = await dossierAvecLignes(jdd, site, { lignes: 1 })
        const a = await db.affiche.findUniqueOrThrow({ where: { id: inc.afficheId } })
        const url = `/api/affiches/${String(inc.afficheId)}/rattacher-inconnue`
        const rs = await Promise.all([
          poster(jdd, url, coord, {
            version: a.version,
            lignes: [{ ligneAttendueId: d1.lignes[0]?.id ?? 0, quantite: 10 }],
          }),
          poster(jdd, url, coord, {
            version: a.version,
            lignes: [{ ligneAttendueId: d2.lignes[0]?.id ?? 0, quantite: 10 }],
          }),
        ])
        const liens = await db.afficheAttendue.findMany({
          where: { afficheId: inc.afficheId, actif: true },
        })
        jdd.verifier(
          'K-07 deux rattachements simultanés : un gagnant, Σ liens = reçu',
          rs.filter((r) => r.status === 200).length === 1 &&
            liens.reduce((s, x) => s + x.quantite, 0) === 10,
          '1 × 200 ; Σ liens = 10',
          `${JSON.stringify(statuts(rs))} ; ${String(liens.reduce((s, x) => s + x.quantite, 0))}`,
          'RG-X-060',
        )
      }
      // Colisage simultané des mêmes lignes ; « Expédier » simultané du même colis.
      {
        const rep = await ligneRepartition(jdd, site, type.id, { qte: 7 })
        const corps = { lignes: [{ id: rep.id, version: rep.version }] }
        const rs = await Promise.all([
          appelUnitaire(jdd, site, 'colisage', corps),
          appelUnitaire(jdd, site, 'colisage', corps),
        ])
        jdd.verifier(
          'Colisage simultané des mêmes lignes : 200 + 409, une seule UM',
          JSON.stringify(statuts(rs)) === '[200,409]' &&
            (await db.uniteManutention.count({
              where: { repartitions: { some: { id: rep.id } } },
            })) === 1,
          '[200,409] ; 1 UM',
          JSON.stringify(statuts(rs)),
          'RG-COO-260',
        )
        const rep2 = await ligneRepartition(jdd, site, type.id, { qte: 5 })
        const ch = await chaineFixe(jdd, site, [{ id: rep2.id, version: rep2.version }], {
          expedier: false,
        })
        const c = await db.colis.findUniqueOrThrow({ where: { id: ch.colisIds[0] ?? 0 } })
        const url = `/api/coordination/colis/${String(c.id)}/expedier`
        const rs2 = await Promise.all([
          poster(jdd, url, expe, { version: c.version }),
          poster(jdd, url, expe, { version: c.version }),
        ])
        jdd.verifier(
          '« Expédier » simultané : 200 + 409',
          JSON.stringify(statuts(rs2)) === '[200,409]',
          '[200,409]',
          JSON.stringify(statuts(rs2)),
          'RG-COO-266',
        )
      }
    }
  },
}
