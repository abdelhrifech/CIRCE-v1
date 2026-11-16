import { describe, expect, it } from 'vitest'
import { positionProposee } from './edition.ts'
import { motifsNariman } from './instruction-ok.ts'

const conforme = { commentaire: null, exceptions: 4, quantite: 4, repartitionA100: true, ecart: 0 }

describe('RG-COO-042 / RG-COO-133 règle de Nariman (fonction pure)', () => {
  it('RG-COO-042 sans commentaire, exceptions = quantité, répartition à 100 %, sans écart : Instruction OK automatique', () => {
    expect(motifsNariman(conforme)).toEqual([])
    expect(motifsNariman({ ...conforme, commentaire: '   ', ecart: null })).toEqual([])
  })

  it('RG-COO-042 chaque condition non tenue garde l’instruction « En cours » avec son motif', () => {
    expect(motifsNariman({ ...conforme, commentaire: 'Visuel B en tête' })).toEqual(['COMMENTAIRE'])
    expect(motifsNariman({ ...conforme, exceptions: 3 })).toEqual(['EXCEPTIONS'])
    expect(motifsNariman({ ...conforme, repartitionA100: false })).toEqual(['REPARTITION'])
    expect(motifsNariman({ ...conforme, ecart: -20 })).toEqual(['ECART'])
  })

  it('RG-COO-133 référence legacy : commentaire vide ET quantités égales → Instruction OK ; sinon non', () => {
    expect(motifsNariman({ ...conforme, exceptions: 12, quantite: 12 })).toEqual([])
    expect(motifsNariman({ ...conforme, exceptions: 12, quantite: 11 })).not.toEqual([])
  })
})

describe('RG-COO-059 position proposée d’après le commentaire de prépa', () => {
  it('RG-COO-059 « début de train » → 1, « fin de train » → 2', () => {
    expect(positionProposee('Visuel B en début de train, à la demande du client')).toBe(1)
    expect(positionProposee('Mettre ce visuel en fin de train')).toBe(2)
  })

  it('RG-COO-059 autre commentaire ou commentaire vide : aucune proposition', () => {
    expect(positionProposee('Entretien de 15 % demandé par le client')).toBeNull()
    expect(positionProposee(null)).toBeNull()
  })
})
