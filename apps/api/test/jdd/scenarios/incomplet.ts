// Famille « incomplet » : parcours inachevés, états intermédiaires légitimes. Réceptions partielles puis complément
// (RG-REC-040, RG-X-018, 061), lignes jamais reçues, ligne cochée à quantité 0 ignorée (RG-REC-023, Q-166),
// réception inconnue non rattachée (RG-X-006), palettes non contrôlées, affiches non validées, dossier sans ligne avec
// instruction sans train. Volume : ~volume/10 cas. État attendu : lignes PARTIELLE / ATTENDUE, un complément se
// rattache à la MÊME affiche, aucune validation posée tant que la Coordination ne l'a pas faite.
import type { Scenario } from './index.ts'
import { recevoirBl } from '../api.ts'
import { creerSite } from '../contexte.ts'
import { creerInconnue, dossierAvecLignes, recevoirLignes } from '../monde.ts'
import * as f from '../../factories/index.ts'

export const incomplet: Scenario = {
  nom: 'incomplet',
  regles: ['RG-REC-023', 'RG-REC-040', 'RG-REC-018', 'RG-X-006', 'RG-X-018', 'RG-X-061'],
  attendu:
    'lignes partielles / attendues, compléments sur la même affiche, inconnues non rattachées',
  async generer(jdd) {
    const site = await creerSite(jdd)
    const n = Math.max(6, Math.round(jdd.volume / 10))
    for (let i = 0; i < n; i++) {
      switch (i % 6) {
        case 0: {
          // Partielle, puis (une fois sur deux) complément sur l'affiche déjà rattachée à la ligne.
          const d = await dossierAvecLignes(jdd, site, {
            lignes: 2,
            qteBc: () => jdd.rng.entier(10, 50),
          })
          const r = await recevoirLignes(jdd, site, d.lignes, 0.4)
          if (jdd.rng.booleen()) {
            const complements = r.affiches.map((a) => {
              const l = d.lignes.find((x) => x.id === a.ligneAttendueId)
              return {
                ligneAttendueId: a.ligneAttendueId,
                quantite: Math.max(1, (l?.qteBc ?? 10) - a.quantite),
                complementAfficheId: a.id,
              }
            })
            await recevoirBl(jdd, site, complements)
            jdd.compter('complements', complements.length)
          }
          break
        }
        case 1:
          await dossierAvecLignes(jdd, site) // aucune réception : lignes ATTENDUE
          break
        case 2: {
          const d = await dossierAvecLignes(jdd, site, { lignes: 2 })
          const [a, b] = d.lignes
          if (!a || !b) throw new Error('2 lignes attendues')
          await recevoirBl(jdd, site, [
            { ligneAttendueId: a.id, quantite: a.qteBc ?? 10 },
            { ligneAttendueId: b.id, quantite: 0 }, // cochée à 0 : ignorée (Q-166)
          ])
          break
        }
        case 3:
          await creerInconnue(jdd, site, jdd.rng.entier(1, 40))
          break
        case 4: {
          const d = await dossierAvecLignes(jdd, site)
          await recevoirLignes(jdd, site, d.lignes) // palette « À contrôler », affiche à confirmer
          break
        }
        default: {
          // Dossier sans ligne attendue : instruction « En cours » sans train.
          const dossier = await f.createDossier(jdd.ctx.db, {
            contNum: jdd.contNum(),
            annonceur: 'ANNONCEUR SANS LIGNE',
          })
          await f.createInstruction(jdd.ctx.db, {
            dossierId: dossier.id,
            contNum: dossier.contNum,
            atelierId: site.ateliers.scroll.id,
            statut: 'EN_COURS',
            contAnbas: jdd.depart.annee,
            contSembas: jdd.depart.semaine,
          })
          jdd.compter('dossiers')
          jdd.compter('instructions')
        }
      }
    }
  },
}
