// Famille « invalides » : les données invalides ne sont JAMAIS insérées (skill circe-jdd) ; chaque requête fautive,
// tirée de la seed, doit être rejetée avec { code, message, regle? } (400 validation, 404, 409, 422 règle métier) et
// n'écrire RIEN (instantané des tables de réception inchangé). RG : RG-REC-008, 009, 023, 026, 033, 037, RG-COO-009,
// 265, CLAUDE.md §6. Volume : ~volume/10 tours de 14 requêtes invalides. État attendu : 0 écriture.
import type { Scenario } from './index.ts'
import { corpsBl, instantane, nouvellePhoto, poster, verifierRejet, type Reponse } from '../api.ts'
import { creerSite } from '../contexte.ts'
import { dossierAvecLignes, recevoirLignes, validerAffiche } from '../monde.ts'

export const invalides: Scenario = {
  nom: 'invalides',
  regles: [
    'RG-REC-008',
    'RG-REC-009',
    'RG-REC-023',
    'RG-REC-026',
    'RG-REC-033',
    'RG-COO-009',
    'RG-COO-265',
  ],
  attendu: 'toutes les requêtes rejetées avec code / message (/ regle) et aucune écriture',
  async generer(jdd) {
    const site = await creerSite(jdd)
    const h = site.users.recep.headers
    const tours = Math.max(2, Math.round(jdd.volume / 10))
    for (let t = 0; t < tours; t++) {
      const d = await dossierAvecLignes(jdd, site, { lignes: 2 })
      const [l1, l2] = d.lignes
      if (!l1 || !l2) throw new Error('2 lignes')
      const recu = await dossierAvecLignes(jdd, site, { lignes: 1 })
      const r0 = await recevoirLignes(jdd, site, recu.lignes)
      const a0 = r0.affiches[0]
      if (!a0) throw new Error('affiche')
      const avant = await instantane(jdd, site)
      const qte = jdd.rng.entier(1, 30)
      const bl = await corpsBl(jdd, site, [{ ligneAttendueId: l1.id, quantite: qte }])
      const cas: { nom: string; r: () => Promise<Reponse>; statuts: number[]; regle?: string }[] = [
        {
          nom: 'BL : quantité négative',
          r: async () =>
            poster(jdd, '/api/receptions', h, {
              ...bl,
              lignes: [{ ligneAttendueId: l1.id, quantite: -qte, cochee: true }],
            }),
          statuts: [400, 422],
          regle: 'RG-REC-023',
        },
        {
          nom: 'BL : quantité non numérique',
          r: async () =>
            poster(jdd, '/api/receptions', h, {
              ...bl,
              lignes: [{ ligneAttendueId: l1.id, quantite: 'dix', cochee: true }],
            }),
          statuts: [400],
        },
        {
          nom: 'BL : nombre de colis nul',
          r: async () => poster(jdd, '/api/receptions', h, { ...bl, nbColis: 0 }),
          statuts: [400],
        },
        {
          nom: 'BL : ligne attendue inexistante',
          r: async () =>
            poster(jdd, '/api/receptions', h, {
              ...bl,
              lignes: [{ ligneAttendueId: 999_999_000 + t, quantite: 3, cochee: true }],
            }),
          statuts: [404, 422],
        },
        {
          nom: 'BL : n° de BL absent',
          r: async () => poster(jdd, '/api/receptions', h, { ...bl, numeroBl: '' }),
          statuts: [400, 422],
        },
        {
          nom: 'BL : photo déjà jointe à une autre réception',
          r: async () =>
            poster(jdd, '/api/receptions', h, {
              ...bl,
              photoBlId:
                r0.receptionId &&
                (await jdd.ctx.db.reception.findUniqueOrThrow({ where: { id: r0.receptionId } }))
                  .photoBlId,
              numeroBl: `BL-DEJA-${String(t)}`,
            }),
          statuts: [422],
          regle: 'RG-REC-026',
        },
        {
          nom: 'BL : aucune ligne',
          r: async () =>
            poster(jdd, '/api/receptions', h, {
              ...bl,
              lignes: [],
              photoBlId: await nouvellePhoto(jdd, site),
              numeroBl: `BL-VIDE-${String(t)}`,
            }),
          statuts: [400, 422],
        },
        {
          nom: 'BL : champ inconnu du corps',
          r: async () => poster(jdd, '/api/receptions', h, { lignes: 'x' }),
          statuts: [400],
        },
        {
          nom: 'BL : sans clé d’idempotence',
          r: async () => poster(jdd, '/api/receptions', h, bl, {}),
          statuts: [400],
          regle: 'RG-REC-008',
        },
        {
          nom: 'validation admin : version périmée',
          r: async () =>
            poster(
              jdd,
              `/api/coordination/affiches/${String(a0.id)}/validation-admin`,
              site.users.coord.headers,
              { version: 0, valider: true },
            ),
          statuts: [409],
        },
        {
          nom: 'validation admin : corps incomplet',
          r: async () =>
            poster(
              jdd,
              `/api/coordination/affiches/${String(a0.id)}/validation-admin`,
              site.users.coord.headers,
              { valider: true },
            ),
          statuts: [400],
        },
        {
          nom: 'validation admin : affiche inexistante',
          r: async () =>
            poster(
              jdd,
              '/api/coordination/affiches/999999000/validation-admin',
              site.users.coord.headers,
              { version: 1, valider: true },
            ),
          statuts: [404],
        },
        {
          nom: 'rebut supérieur au stock',
          r: async () =>
            poster(jdd, `/api/affiches/${String(a0.id)}/rebut`, h, {
              quantite: 10_000_000,
              motif: 'AUTRE',
            }),
          statuts: [409, 422],
        },
        {
          nom: 'rebut : motif hors liste',
          r: async () =>
            poster(jdd, `/api/affiches/${String(a0.id)}/rebut`, h, {
              quantite: 1,
              motif: 'CAPRICE',
            }),
          statuts: [400],
        },
        {
          nom: 'export : départ mal formé',
          r: async () =>
            poster(jdd, '/api/coordination/trains/export', site.users.coord.headers, {
              depart: '2026/45',
              simulation: true,
            }),
          statuts: [400],
        },
        {
          nom: 'colis : ajout d’une UM inconnue',
          r: async () =>
            poster(jdd, '/api/coordination/colis/999999000/unites', site.users.expe.headers, {
              version: 1,
              code: 'UM-INCONNUE',
            }),
          statuts: [404, 409, 422],
          regle: undefined,
        },
      ]
      for (const c of cas) {
        const r = await c.r()
        verifierRejet(jdd, c.nom, r, { statuts: c.statuts, ...(c.regle ? { regle: c.regle } : {}) })
        jdd.compter('rejets')
      }
      // Annulation de la validation d'une affiche jamais validée : 409 (cellule C-01).
      verifierRejet(
        jdd,
        'annulation d’une affiche jamais validée',
        await validerAffiche(jdd, site, a0.id, false),
        { statuts: [409] },
      )
      const apres = await instantane(jdd, site)
      jdd.verifier(
        'aucune écriture de réception après les rejets',
        apres === avant,
        avant,
        apres,
        'CLAUDE.md §6',
      )
    }
  },
}
