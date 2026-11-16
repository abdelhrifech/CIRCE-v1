import { describe, expect, it } from 'vitest'
import type { DestinataireBroadcast } from '@circe/shared'
import { nettoyerMessage, prochainHoraire } from './integration-broadcast.ts'
import { formatRetour } from './retour-broadcast.ts'
import {
  adresseEnVigueur,
  atelierDeroulantDe,
  codeInstruction,
  destinatairesRetenus,
  faceAIntegrer,
  lieuDitDe,
  lireAtelierDeroulant,
  lireNombres,
  lirePaires,
  lireTransports,
  lireTypesVisuels,
  routerDetail,
  type ParametresPreparation,
} from './integration-flux.ts'

const dest = (p: Partial<DestinataireBroadcast>): DestinataireBroadcast => ({
  type: 4,
  clePex: 1,
  nom: 'Afficheur',
  adresse1: null,
  adresse2: null,
  codePostal: null,
  localite: null,
  lieuDit: null,
  pointRemise: null,
  mail: null,
  telephone: null,
  dateDebutPivot: null,
  dateFinPivot: null,
  ...p,
})
const J = (j: number) => new Date(Date.UTC(2026, 10, j))

describe('Paramètres d’intégration (Q-227)', () => {
  it('RG-COO-121 lit les listes et paires, ignore les entrées mal formées', () => {
    expect(lireNombres('39;40; x ;43')).toEqual([39, 40, 43])
    expect([...lirePaires('39:2;40:3;:4;5:;6:7:8')]).toEqual([
      [39, 2],
      [40, 3],
    ])
  })
  it('RG-COO-126 lit la table surface : site : atelier', () => {
    const t = lireAtelierDeroulant('5:39:5;5:40:6;7:39')
    expect(atelierDeroulantDe(t, 5, 40)).toBe(6)
    expect(atelierDeroulantDe(t, 7, 39)).toBeUndefined()
    expect(atelierDeroulantDe(t, null, 39)).toBeUndefined()
  })
  it('RG-COO-120 lit le transport par atelier et le défaut « * »', () => {
    const t = lireTransports('1:2:X24;3:2:CX;*:1:CCF;x:1:Y')
    expect(t.parAtelier.get(1)).toEqual({ transporteur: 2, tarif: 'X24' })
    expect(t.parAtelier.get(3)).toEqual({ transporteur: 2, tarif: 'CX' })
    expect(t.defaut).toEqual({ transporteur: 1, tarif: 'CCF' })
    expect(lireTransports('1:2:X24').defaut).toBeNull()
  })
  it('RG-COO-128 lit les types forcés des visuels et détails', () => {
    expect(lireTypesVisuels('visuel:10:26;bdx:2;detail21:11:1026;detail:10')).toEqual({
      visuel: { typePreparationId: 10, supportId: 26 },
      bdx: 2,
      venusial: { type: 21, typePreparationId: 11, supportId: 1026 },
      detail: 10,
    })
  })
})

describe('RG-COO-127 — code d’instruction', () => {
  it('RG-COO-127 AAAA + SS + C0 + atelier (2 chiffres) + dossier (8 chiffres)', () => {
    expect(codeInstruction({ annee: 2026, semaine: 3 }, 5, 123456)).toBe('202603C00500123456')
    expect(codeInstruction({ annee: 2026, semaine: 45 }, 12, 7)).toBe('202645C01200000007')
  })
  it('RG-COO-127 atelier inconnu → « C000 » (pas un code tronqué)', () => {
    expect(codeInstruction({ annee: 2026, semaine: 45 }, null, 7)).toBe('202645C00000000007')
    expect(codeInstruction({ annee: 2026, semaine: 45 }, null, 7)).toHaveLength(18)
  })
})

describe('RG-COO-118 — adresses actuelles ou futures, dernière donnée valide', () => {
  const maintenant = J(10)
  it('RG-COO-118 garde une adresse future ou en cours, ignore une période échue ou sans début', () => {
    expect(adresseEnVigueur(dest({ dateDebutPivot: J(20), dateFinPivot: null }), maintenant)).toBe(
      true,
    )
    expect(adresseEnVigueur(dest({ dateDebutPivot: J(1), dateFinPivot: J(30) }), maintenant)).toBe(
      true,
    )
    expect(adresseEnVigueur(dest({ dateDebutPivot: J(1), dateFinPivot: J(10) }), maintenant)).toBe(
      true,
    )
    expect(adresseEnVigueur(dest({ dateDebutPivot: J(1), dateFinPivot: J(9) }), maintenant)).toBe(
      false,
    )
    expect(adresseEnVigueur(dest({ dateDebutPivot: J(1), dateFinPivot: null }), maintenant)).toBe(
      false,
    )
    expect(adresseEnVigueur(dest({}), maintenant)).toBe(false)
  })
  it('RG-COO-118 annule et remplace : par (type, clé), seule la donnée au début le plus récent', () => {
    const { retenus, ignores } = destinatairesRetenus(
      [
        dest({ nom: 'A', dateDebutPivot: J(1), dateFinPivot: J(30) }),
        dest({ nom: 'B', dateDebutPivot: J(5), dateFinPivot: J(30) }),
        dest({ nom: 'C', type: 2, dateDebutPivot: J(5), dateFinPivot: J(30) }),
        dest({ nom: 'D', dateDebutPivot: J(1), dateFinPivot: J(2) }),
      ],
      maintenant,
    )
    expect(retenus.map((d) => d.nom).sort()).toEqual(['B', 'C'])
    expect(ignores).toBe(2)
  })
  it('RG-COO-119 lieu-dit + point de remise tronqué à 50 caractères', () => {
    expect(lieuDitDe('Zone A', 'Quai 3')).toBe('Zone A Quai 3')
    expect(lieuDitDe(null, null)).toBeNull()
    expect(lieuDitDe('x'.repeat(40), 'y'.repeat(40))).toHaveLength(50)
  })
})

describe('RG-COO-121 — routage d’une prépa fixe / pliage', () => {
  const p: ParametresPreparation = {
    sites: [39, 40],
    statutEnvoyee: 133,
    typePliage: 23,
    typesDeroulants: [17, 18, 19, 20, 21, 28],
    routagePliage: new Map([
      [39, 2],
      [40, 3],
    ]),
    routageFixe: new Map([[39, 1]]),
  }
  it('RG-COO-121 type 23 → pliage du site ; autres types → 2 m² fixe', () => {
    expect(routerDetail(p, 39, 23)).toBe(2)
    expect(routerDetail(p, 40, 23)).toBe(3)
    expect(routerDetail(p, 39, 1)).toBe(1)
  })
  it('RG-COO-121 déroulant exclu (null) ; site sans atelier → atelier 0 (undefined)', () => {
    expect(routerDetail(p, 39, 28)).toBeNull()
    expect(routerDetail(p, 40, 1)).toBeUndefined()
    expect(routerDetail(p, null, 23)).toBeUndefined()
  })
})

describe('RG-COO-131 / 134 / 116 / 103 — fonctions pures', () => {
  it('RG-COO-131 seules les faces du lot marqué (Traitement E, type de destination DA) sont prises', () => {
    expect(faceAIntegrer({ traitement: 'E', idTypeDestinationDa: 1 } as never)).toBe(true)
    expect(faceAIntegrer({ traitement: '0', idTypeDestinationDa: 1 } as never)).toBe(false)
    expect(faceAIntegrer({ traitement: 'E', idTypeDestinationDa: null } as never)).toBe(false)
  })
  it('RG-COO-134 « 2m2 Scrolling » ramené à « 2m2 », autres formats inchangés', () => {
    expect(formatRetour('2m2 Scrolling', '2m2 Scrolling:2m2')).toBe('2m2')
    expect(formatRetour('8m2', '2m2 Scrolling:2m2')).toBe('8m2')
  })
  it('RG-COO-116 message d’erreur nettoyé : première ligne, sans pile, borné', () => {
    expect(nettoyerMessage(new Error('Échec\n  at foo (x.ts:1)'))).toBe('Échec')
    expect(nettoyerMessage('x'.repeat(900))).toHaveLength(500)
    expect(
      nettoyerMessage(
        new Error('Invalid `tx.a.create()` invocation in\n/x.ts:1\n  12 code\npanne simulée'),
      ),
    ).toBe('panne simulée')
  })
  it('RG-COO-103 prochain horaire planifié (le jour même, sinon le lendemain)', () => {
    const h = ['08:00', '10:00', '18:00']
    const d = new Date(2026, 10, 5, 9, 30)
    expect(prochainHoraire(h, d)?.getHours()).toBe(10)
    const soir = prochainHoraire(h, new Date(2026, 10, 5, 18, 0))
    expect(soir?.getDate()).toBe(6)
    expect(soir?.getHours()).toBe(8)
    expect(prochainHoraire(['25:00', 'x'], d)).toBeNull()
  })
})
