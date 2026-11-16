import { describe, expect, it } from 'vitest'
import {
  cleTexte,
  dansFenetre,
  estExclue,
  fenetreAlimentation,
  lireSupportsBandeau,
  planDedoublonnage,
  regrouper,
  type CleLigne,
} from './alimentation-lignes.ts'
import { etapeLigne, etapeMoinsAvancee, lireDeadline, lisereDe } from './reservations.ts'

const cle = (p: Partial<CleLigne> = {}): CleLigne => ({
  plateformeId: 1,
  contNum: 100,
  supportId: 2,
  themeCle: 'THEME A',
  idThemeBandeau: null,
  semaine: { annee: 2026, semaine: 43 },
  ...p,
})

describe('COO-P05 — fonctions pures des lignes attendues', () => {
  // HYPOTHÈSE Q-187 (7) : l'énoncé « lundi + 8 semaines » donne S06/2027 (2026 compte 53 semaines ISO) ;
  // l'exemple « S07/2027 » de la fiche de règle le contredit : l'énoncé (calcul en dates) prévaut.
  it('RG-COO-083 fenêtre du lundi 2026-12-14 = S51/2026 → lundi + 8 semaines (S06/2027, 53 semaines en 2026)', () => {
    expect(fenetreAlimentation(new Date('2026-12-14T08:00:00Z'), 8)).toEqual({
      debut: { annee: 2026, semaine: 51 },
      fin: { annee: 2027, semaine: 6 },
    })
  })

  it('RG-COO-083 semaine 53 ISO gérée (2026 compte 53 semaines)', () => {
    const f = fenetreAlimentation(new Date('2026-12-28T08:00:00Z'), 8)
    expect(f.debut).toEqual({ annee: 2026, semaine: 53 })
    expect(f.fin).toEqual({ annee: 2027, semaine: 8 })
    expect(dansFenetre({ annee: 2026, semaine: 53 }, f)).toBe(true)
  })

  it('RG-COO-083 rejet : une semaine hors de S → S+8 n’est pas dans la fenêtre', () => {
    const f = fenetreAlimentation(new Date('2026-10-19T08:00:00Z'), 8)
    expect(dansFenetre({ annee: 2026, semaine: 42 }, f)).toBe(false)
    expect(dansFenetre({ annee: 2026, semaine: 52 }, f)).toBe(false)
    expect(dansFenetre({ annee: 2026, semaine: 51 }, f)).toBe(true)
  })

  it('RG-COO-093 exclusions : statut « Envoyé » et destinataires exclus ; les autres passent', () => {
    const exclus = ['Plateforme Derichebourg Lyon', 'Plateforme Derichebourg']
    expect(estExclue({ statutPreparation: 'Envoyé', destinataire: 'Wissous' }, exclus)).toBe(true)
    expect(
      estExclue({ statutPreparation: null, destinataire: 'plateforme derichebourg' }, exclus),
    ).toBe(true)
    expect(estExclue({ statutPreparation: 'En cours', destinataire: 'Wissous' }, exclus)).toBe(
      false,
    )
    expect(estExclue({ statutPreparation: null, destinataire: null }, exclus)).toBe(false)
  })

  it('RG-COO-080 deux DA du même dossier ⇒ une clé, quantités additionnées ; RG-COO-082 reste en place retiré', () => {
    const g = regrouper([
      { cle: cle(), quantite: 60 },
      { cle: cle(), quantite: 40 },
      { cle: cle(), quantite: 15, resteEnPlace: true },
    ])
    expect(g).toHaveLength(1)
    expect(g[0]?.quantite).toBe(100)
  })

  it('RG-COO-080 / 098 / 100 rejet du regroupement : dossier, plateforme, bandeau ou semaine différents ⇒ clés distinctes', () => {
    const g = regrouper([
      { cle: cle(), quantite: 1 },
      { cle: cle({ contNum: 101 }), quantite: 1 },
      { cle: cle({ plateformeId: 2 }), quantite: 1 },
      { cle: cle({ idThemeBandeau: 7 }), quantite: 1 },
      { cle: cle({ semaine: { annee: 2026, semaine: 44 } }), quantite: 1 },
    ])
    expect(g).toHaveLength(5)
    expect(cleTexte(cle({ themeCle: null }))).not.toBe(cleTexte(cle()))
  })

  it('RG-COO-095 correspondance des supports bandeau lue du paramètre ; valeurs invalides ignorées', () => {
    const m = lireSupportsBandeau('5:100;26:100;1026:100;19:102;27:105;29:107;x:1')
    expect(m.get(5)).toBe(100)
    expect(m.get(19)).toBe(102)
    expect(m.get(29)).toBe(107)
    expect(m.size).toBe(6)
  })

  it('RG-COO-090 dédoublonnage : la ligne qui porte une affiche est gardée, sinon la plus récente', () => {
    const d = (j: number) => new Date(`2026-01-${String(j).padStart(2, '0')}T00:00:00Z`)
    expect(
      planDedoublonnage([
        { id: 1, cle: 'A', liensActifs: 0, createdAt: d(3) },
        { id: 2, cle: 'A', liensActifs: 1, createdAt: d(1) },
        { id: 3, cle: 'B', liensActifs: 0, createdAt: d(1) },
        { id: 4, cle: 'B', liensActifs: 0, createdAt: d(2) },
        { id: 5, cle: 'C', liensActifs: 0, createdAt: d(2) },
      ]),
    ).toEqual([
      { garder: 2, fermer: [1] },
      { garder: 4, fermer: [3] },
    ])
  })

  it('RG-COO-107 « Où en est-il » d’une ligne, du provisoire à l’expédié', () => {
    const base = {
      annulee: false,
      provisoire: false,
      source: 'PREPA' as const,
      attendu: 10,
      recu: 10,
      toutesValidees: true,
      production: [],
    }
    expect(etapeLigne({ ...base, provisoire: true, source: 'BC' })).toBe('DA_ACTIVEE')
    expect(etapeLigne({ ...base, source: 'BC' })).toBe('IP_SAISIES')
    expect(etapeLigne({ ...base, recu: 0 })).toBe('PREPA_RECUE')
    expect(etapeLigne({ ...base, recu: 4 })).toBe('RECUES_EN_PARTIE')
    expect(etapeLigne({ ...base, toutesValidees: false })).toBe('VALIDATION_A_CONFIRMER')
    expect(etapeLigne(base)).toBe('EN_PRODUCTION')
    expect(etapeLigne({ ...base, production: ['A_EXPEDIER', 'TERMINE'] })).toBe('PRODUIT')
    expect(etapeLigne({ ...base, production: ['TERMINE'] })).toBe('EXPEDIE')
    expect(etapeLigne({ ...base, annulee: true })).toBe('ANNULE')
  })

  it('RG-COO-107 un dossier compte à l’étape la moins avancée ; annulé seulement si tout l’est', () => {
    expect(etapeMoinsAvancee(['EN_PRODUCTION', 'IP_SAISIES', 'ANNULE'])).toBe('IP_SAISIES')
    expect(etapeMoinsAvancee(['ANNULE', 'ANNULE'])).toBe('ANNULE')
  })
})

describe('ECR-PIL-03 — liseré et deadline Pré-Prod', () => {
  const deadline = lireDeadline('-2;4;16:00')
  it('RG-COO-066 / 076 deadline = jeudi S-2 16 h (paramètre)', () => {
    expect(deadline({ annee: 2026, semaine: 45 }).toISOString()).toBe('2026-10-22T16:00:00.000Z')
  })
  it('ECR-PIL-03 liseré : critique après la deadline (DA / IP) ou affiches attendues au départ ; sinon ton de l’étape', () => {
    const courante = { annee: 2026, semaine: 44 }
    const avant = new Date('2026-10-20T08:00:00Z')
    const apres = new Date('2026-10-23T08:00:00Z')
    expect(lisereDe({ ou: 'IP_SAISIES', departs: ['2026-W45'] }, apres, courante, deadline)).toBe(
      'critique',
    )
    expect(lisereDe({ ou: 'IP_SAISIES', departs: ['2026-W45'] }, avant, courante, deadline)).toBe(
      null,
    )
    expect(lisereDe({ ou: 'DA_ACTIVEE', departs: ['2026-W45'] }, avant, courante, deadline)).toBe(
      'surveiller',
    )
    expect(lisereDe({ ou: 'PREPA_RECUE', departs: ['2026-W44'] }, avant, courante, deadline)).toBe(
      'critique',
    )
    expect(lisereDe({ ou: 'PREPA_RECUE', departs: ['2026-W46'] }, avant, courante, deadline)).toBe(
      null,
    )
    expect(
      lisereDe({ ou: 'VALIDATION_A_CONFIRMER', departs: ['2026-W46'] }, avant, courante, deadline),
    ).toBe('info')
    expect(lisereDe({ ou: 'EXPEDIE', departs: ['2026-W46'] }, avant, courante, deadline)).toBe('ok')
  })
})
