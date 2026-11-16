import { describe, expect, it } from 'vitest'
import type { LigneAttendue } from '@circe/shared'
import {
  ajouter,
  changerQuantite,
  cocher,
  depuisLigne,
  etatTout,
  messageAjout,
  retirer,
  retirerCochees,
} from './panier.ts'

const ligne = (id: number, reste = 6, attendu = 10): LigneAttendue => ({
  id,
  version: 1,
  site: { id: 1, nom: 'Site' },
  dossier: 100000 + id,
  da: null,
  annonceur: 'A',
  theme: 'T',
  format: '2m2',
  depart: '2026-W45',
  attendu,
  recu: attendu - reste,
  reste,
  statut: 'PARTIELLE',
  controle: 'RIEN_RECU',
  affiches: [],
  livraisonPrevue: null,
})

describe('panier (RG-REC-021 à 023)', () => {
  it('RG-REC-021 RG-NEW-REC-002 une ligne ajoutée attend une sélection explicite ; RG-REC-023 quantité par défaut = reste', () => {
    expect(depuisLigne(ligne(1))).toMatchObject({ cochee: false, quantite: 6 })
  })

  it('RG-REC-023 sans reste, la quantité par défaut est l’attendu', () => {
    expect(depuisLigne(ligne(1, 0, 10)).quantite).toBe(10)
  })

  it('RG-REC-021 refuse une ligne déjà au panier', () => {
    const a = ajouter([], [ligne(1), ligne(2)])
    expect(a.ajoutees).toBe(2)
    const b = ajouter(a.panier, [ligne(2)])
    expect(b).toMatchObject({ ajoutees: 0, doublons: 1 })
    expect(b.panier).toHaveLength(2)
    expect(messageAjout(0)).toBe('Ce visuel est déjà au panier.')
    expect(messageAjout(2)).toBe('2 ligne(s) ajoutée(s) au panier.')
  })

  it('RG-REC-021 retirer, cocher, état de la case « tout »', () => {
    let p = ajouter([], [ligne(1), ligne(2)]).panier
    expect(etatTout(p)).toBe('rien')
    p = cocher(p, 1, true)
    expect(etatTout(p)).toBe('partiel')
    p = cocher(p, 1, false)
    expect(etatTout(p)).toBe('rien')
    expect(retirer(p, 1).map((x) => x.ligneAttendueId)).toEqual([2])
  })

  it('RG-REC-023 la quantité saisie est un entier ≥ 0', () => {
    const p = ajouter([], [ligne(1)]).panier
    expect(changerQuantite(p, 1, -3)[0]?.quantite).toBe(0)
    expect(changerQuantite(p, 1, 4.7)[0]?.quantite).toBe(4)
    expect(changerQuantite(p, 1, Number.NaN)[0]?.quantite).toBe(0)
  })

  it('RG-REC-022 seules les lignes cochées quittent le panier', () => {
    const p = cocher(ajouter([], [ligne(1), ligne(2)]).panier, 1, true)
    expect(retirerCochees(p).map((x) => x.ligneAttendueId)).toEqual([2])
  })
})
