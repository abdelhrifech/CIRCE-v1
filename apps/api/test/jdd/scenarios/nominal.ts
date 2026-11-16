// Famille « nominal » : le parcours complet, sans accroc. Réception par BL (REC-P04), contrôle de la palette
// (REC-P05), validation admin (COO-P03/04), instructions et trains exportables, export des trains (COO-P10),
// préparation fixe : libération, Colisage (UM), colis, expédition, fin de journée (COO-P12/13, RG-X-087).
// RG : RG-REC-037, 044, 069 ; RG-COO-008, 210, 240, 260, 261, 263 à 266 ; RG-X-001, 005, 028, 063, 083, 084, 087.
// Volume : ~volume/6 dossiers (1 à 3 lignes) ; enregistrements ≈ 25 par dossier (lignes, affiches, mouvements,
// historiques, journal) + trains + UM/colis. État attendu : tout dossier reçu a ses affiches IDENTIFIEE, contrôlées à 75 %,
// validées à 60 % ; les trains exportés sont « A imprimer » ; les colis expédiés sont « Terminé » avec sorties de stock.
import type { Scenario } from './index.ts'
import { exiger } from '../api.ts'
import { creerSite } from '../contexte.ts'
import {
  chaineFixe,
  controler,
  dossierAvecLignes,
  exporterTrains,
  finDeJournee,
  ligneRepartition,
  lireLesListes,
  recevoirLignes,
  trainsDuDossier,
  typePreparation,
  validerAffiche,
} from '../monde.ts'

export const nominal: Scenario = {
  nom: 'nominal',
  regles: [
    'RG-REC-037',
    'RG-REC-069',
    'RG-COO-008',
    'RG-COO-210',
    'RG-COO-260',
    'RG-X-083',
    'RG-X-087',
  ],
  attendu:
    'chaîne réception → contrôle → validation → export → colisage → fin de journée, sans rejet',
  async generer(jdd) {
    const site = await creerSite(jdd, { destinataires: 4 })
    const n = Math.max(3, Math.round(jdd.volume / 6))
    const type = await typePreparation(jdd)
    const fixes: { id: number; version: number }[] = []
    for (let i = 0; i < n; i++) {
      const avecTrains = jdd.rng.booleen(0.7)
      const d = await dossierAvecLignes(jdd, site, {
        statut: avecTrains ? 'PREPARATION_RECUE' : 'A_TRAITER',
      })
      const r = await recevoirLignes(jdd, site, d.lignes)
      if (jdd.rng.booleen(0.75)) exiger(await controler(jdd, site, r.receptionId), 'contrôle')
      if (jdd.rng.booleen(0.6))
        for (const a of r.affiches)
          exiger(await validerAffiche(jdd, site, a.id), 'validation admin')
      if (avecTrains) await trainsDuDossier(jdd, site, d)
      // Préparation fixe de ce dossier : une ligne par thème, quantité ≤ reçu (la sortie de stock est plafonnée au stock).
      if (jdd.rng.booleen(0.5))
        for (const l of d.lignes) {
          const rep = await ligneRepartition(jdd, site, type.id, {
            contNum: d.dossier.contNum,
            theme: l.theme,
            annonceur: d.annonceur,
            qte: Math.max(1, Math.min(l.qteBc ?? 5, 20)),
          })
          fixes.push({ id: rep.id, version: rep.version })
        }
    }
    if (fixes.length > 0) {
      await chaineFixe(jdd, site, fixes)
      const fin = exiger(await finDeJournee(jdd, site), 'fin de journée')
      jdd.compter('sorties.stock', (fin.body as { sortiesStock: number }).sortiesStock)
    }
    await lireLesListes(jdd, site)
    const ex = exiger(await exporterTrains(jdd, site), 'export des trains')
    jdd.compter('export.trains', (ex.body as { trains: number }).trains)
  },
}
