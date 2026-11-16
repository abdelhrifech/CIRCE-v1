// Famille « limites » : valeurs aux bornes. Quantités 1 et 100 000, reçu = attendu exactement, écart de contrôle de
// ±10 % pile (seuil RG-REC-018 / Q-133) et au-delà, comptage à zéro, rebut égal au stock (stock 0, jamais négatif,
// RG-REC-017), annonceur de 100 caractères et thème de 250 (RG-REC-009 formats), BL de 100 lignes, UM aux bornes de
// quantité par support (RG-COO-260 : 40, 41, 80, 1), départ en semaine 1 / 52. Volume : ~volume/10 cas.
// État attendu : aucune borne rejetée à tort ; aucun stock négatif.
import type { Scenario } from './index.ts'
import { exiger, poster, recevoirBl } from '../api.ts'
import { creerSite } from '../contexte.ts'
import {
  chaineFixe,
  controler,
  dossierAvecLignes,
  finDeJournee,
  ligneRepartition,
  recevoirLignes,
  typePreparation,
} from '../monde.ts'

export const limites: Scenario = {
  nom: 'limites',
  regles: ['RG-REC-017', 'RG-REC-018', 'RG-REC-023', 'RG-COO-260', 'RG-X-087'],
  attendu: 'toutes les bornes acceptées, stocks à zéro mais jamais négatifs, UM scindées à 40',
  async generer(jdd) {
    const site = await creerSite(jdd, { formats: 2 })
    const k = Math.max(2, Math.round(jdd.volume / 10))
    const long = (m: number, c: string) => c.repeat(m).slice(0, m)
    for (let i = 0; i < k; i++) {
      // Quantité minimale et maximale.
      for (const qte of [1, 100_000]) {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => qte })
        const r = await recevoirLignes(jdd, site, d.lignes)
        exiger(await controler(jdd, site, r.receptionId), 'contrôle aux bornes')
      }
      // Écart de contrôle de +10 % pile, -10 % pile, puis comptage à zéro (rebut = tout le BL).
      for (const ecart of [10, -10, -100]) {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 100 })
        const r = await recevoirLignes(jdd, site, d.lignes)
        exiger(
          await controler(jdd, site, r.receptionId, { ecart }),
          `contrôle avec écart ${String(ecart)}`,
        )
      }
      // Rebut égal au stock : stock 0.
      {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 12 })
        const r = await recevoirLignes(jdd, site, d.lignes)
        const a = r.affiches[0]
        if (!a) throw new Error('affiche')
        exiger(
          await poster(jdd, `/api/affiches/${String(a.id)}/rebut`, site.users.recep.headers, {
            quantite: 12,
            motif: 'AFFICHE_DECHIREE',
          }),
          'rebut égal au stock',
        )
      }
      // Formats maximaux : annonceur 100, thème 250.
      {
        const d = await dossierAvecLignes(jdd, site, {
          lignes: 1,
          ligne: {
            annonceur: long(100, 'A'),
            theme: long(250, 'Thème '),
            themeCle: long(250, 'THÈME '),
          },
        })
        await recevoirLignes(jdd, site, d.lignes)
      }
    }
    // BL de 100 lignes (la borne du schéma est 500 ; 100 reste réaliste) dans un seul passage.
    {
      const lignes = []
      for (let i = 0; i < 100; i++) {
        const d = await dossierAvecLignes(jdd, site, { lignes: 1, qteBc: () => 3 })
        const l = d.lignes[0]
        if (!l) throw new Error('ligne')
        lignes.push({ ligneAttendueId: l.id, quantite: 3 })
      }
      await recevoirBl(jdd, site, lignes)
    }
    // Lignes de la semaine ISO 1 et 52 (frontières d'année).
    for (const semNum of [1, 52]) {
      const d = await dossierAvecLignes(jdd, site, {
        lignes: 1,
        ligne: { semNum, semAnnee: jdd.semaine.annee },
      })
      jdd.compter('lignes.semaine.limite', d.lignes.length)
    }
    // UM aux bornes : support « 40 par UM » (supports[1]) ; quantités 1, 39, 40, 41, 80, 81.
    const type = await typePreparation(jdd)
    const bornes = [1, 39, 40, 41, 80, 81]
    const reps = []
    for (const qte of bornes) {
      const rep = await ligneRepartition(jdd, site, type.id, {
        qte,
        supportId: site.supports[1]?.id ?? 0,
      })
      reps.push({ id: rep.id, version: rep.version })
    }
    await chaineFixe(jdd, site, reps)
    exiger(await finDeJournee(jdd, site), 'fin de journée aux bornes')
  },
}
