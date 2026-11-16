// COO-P06 — tests unitaires COMPLÉMENTAIRES (fonctions pures) : horaires planifiés (RG-COO-103), message
// d'erreur nettoyé (RG-COO-116), adresses en vigueur (RG-COO-118), routage (RG-COO-121), code d'instruction
// (RG-COO-127), format du retour (RG-COO-134). Source : docs/COORDINATION_REGLES_METIER.md ; Q-188.
import { describe, expect, it } from 'vitest'
import { nettoyerMessage, prochainHoraire } from './integration-broadcast.ts'
import {
  adresseEnVigueur,
  codeInstruction,
  destinatairesRetenus,
  lireTransports,
  routerDetail,
} from './integration-flux.ts'
import { formatRetour } from './retour-broadcast.ts'

const H = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']
const a = (h: number, m = 0, j = 5) => new Date(2026, 10, j, h, m, 0, 0)

describe('RG-COO-103 prochain horaire (complément)', () => {
  it('RG-COO-103 limite : à 08:00 pile, le prochain est 10:00 (strictement après) ; après 18:00, le lendemain 08:00', () => {
    expect(prochainHoraire(H, a(8))).toEqual(a(10))
    expect(prochainHoraire(H, a(18, 1))).toEqual(a(8, 0, 6))
    expect(prochainHoraire(H, a(7, 59))).toEqual(a(8))
  })

  it('RG-COO-103 horaires mal formés ou hors journée ignorés ; aucun horaire valide ⇒ pas de planification', () => {
    expect(prochainHoraire(['25:00', '8h', ' 09:30 '], a(9))).toEqual(a(9, 30))
    expect(prochainHoraire(['24:00', 'x'], a(9))).toBeNull()
    expect(prochainHoraire([], a(9))).toBeNull()
  })
})

describe('RG-COO-116 message nettoyé (complément)', () => {
  it('RG-COO-116 erreur Prisma : la cause (dernière ligne), jamais l’appel ni le code cités ; borné à 500 caractères', () => {
    const prisma = new Error(
      'Invalid `tx.destinataire.create()` invocation in\n/app/src/x.ts:12:3\n\n  11 const a\n→ 12 await tx.destinataire.create(\nSQLite error: panne simulée',
    )
    expect(nettoyerMessage(prisma)).toBe('SQLite error: panne simulée')
    expect(nettoyerMessage(new Error('x'.repeat(800)))).toHaveLength(500)
    expect(nettoyerMessage('texte brut')).toBe('texte brut')
  })
})

describe('RG-COO-118 / 120 / 121 / 127 / 134 limites (complément)', () => {
  const maintenant = new Date('2026-11-05T10:00:00Z')

  it('RG-COO-118 limites : fin = maintenant gardée ; début = maintenant sans fin ignorée ; début futur sans fin gardée', () => {
    expect(
      adresseEnVigueur(
        { dateDebutPivot: new Date('2026-01-01'), dateFinPivot: maintenant },
        maintenant,
      ),
    ).toBe(true)
    expect(adresseEnVigueur({ dateDebutPivot: maintenant, dateFinPivot: null }, maintenant)).toBe(
      false,
    )
    expect(
      adresseEnVigueur({ dateDebutPivot: new Date('2026-11-06'), dateFinPivot: null }, maintenant),
    ).toBe(true)
  })

  it('RG-COO-118 annule et remplace : trois versions d’une même clé ⇒ une retenue (début le plus récent), deux ignorées', () => {
    const v = (debut: string, nom: string) => ({
      type: 4,
      clePex: 1,
      nom,
      adresse1: null,
      adresse2: null,
      codePostal: null,
      localite: null,
      lieuDit: null,
      pointRemise: null,
      mail: null,
      telephone: null,
      dateDebutPivot: new Date(debut),
      dateFinPivot: new Date('2027-01-01'),
    })
    const r = destinatairesRetenus(
      [v('2026-03-01', 'B'), v('2026-10-01', 'C'), v('2026-01-01', 'A')],
      maintenant,
    )
    expect(r.retenus.map((x) => x.nom)).toEqual(['C'])
    expect(r.ignores).toBe(2)
  })

  it('RG-COO-120 paramètre sans défaut « * » : atelier non listé sans transport ; entrées mal formées ignorées', () => {
    const t = lireTransports('1:2:X24;3:2:CX;x:1:CCF;4:2')
    expect(t.defaut).toBeNull()
    expect([...t.parAtelier.keys()]).toEqual([1, 3])
  })

  it('RG-COO-121 site absent (null) ⇒ atelier 0 ; type pliage routé sur la table pliage même si le site n’y figure pas', () => {
    const p = {
      sites: [39],
      statutEnvoyee: 133,
      typePliage: 23,
      typesDeroulants: [17, 28],
      routagePliage: new Map([[40, 3]]),
      routageFixe: new Map([[39, 1]]),
    }
    expect(routerDetail(p, null, 1)).toBeUndefined()
    expect(routerDetail(p, 39, 23)).toBeUndefined()
    expect(routerDetail(p, 39, 1)).toBe(1)
    expect(routerDetail(p, 39, 28)).toBeNull()
  })

  it('RG-COO-127 ateliers à deux chiffres (11, 12) et semaine 53 : code complet, jamais tronqué', () => {
    expect(codeInstruction({ annee: 2026, semaine: 53 }, 12, 4242)).toBe('202653C01200004242')
    expect(codeInstruction({ annee: 2027, semaine: 1 }, 11, 12345678)).toBe('202701C01112345678')
  })

  it('RG-COO-134 format ramené sans tenir compte de la casse ni des espaces ; format absent du paramètre inchangé', () => {
    expect(formatRetour(' 2M2 scrolling ', '2m2 Scrolling:2m2')).toBe('2m2')
    expect(formatRetour('8m2', '2m2 Scrolling:2m2')).toBe('8m2')
    expect(formatRetour('2m2 Scrolling', '')).toBe('2m2 Scrolling')
  })
})
