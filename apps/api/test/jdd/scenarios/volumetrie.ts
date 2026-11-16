// Famille « volumetrie » : le gros volume. Trois sites (60 / 30 / 10 %), `volume` dossiers (1 à 3 lignes attendues chacun,
// 4 % annulés), instructions et faces de trains (60 %) insérés par lots (createMany, 30 lignes par requête : la limite
// SQLite est de ~1000 paramètres liés, ANO-035 / 050 / 051), puis, par l'API, réceptions (30 % des dossiers), contrôles,
// validations admin, lignes de répartition de l'atelier fixe (volume / 2), Colisage par lots de 100 lignes, colis.
// Les insertions directes sont suivies du test de cohérence (`massif/`). Enregistrements ≈ 12 × volume. État attendu :
// les listes et filtres répondent en quelques secondes (mesures : `massif/performance.int.test.ts`).
import type { Scenario } from './index.ts'
import { exiger, recevoirBl } from '../api.ts'
import { creerSite, type Jdd, type SiteJdd } from '../contexte.ts'
import { annonceur as tirerAnnonceur, theme as tirerTheme } from '../prng.ts'
import {
  lireLesListes,
  controler,
  ligneRepartition,
  typePreparation,
  validerAffiche,
  appelUnitaire,
  chaineFixe,
} from '../monde.ts'

const LOT = 30

async function parLots<T>(valeurs: T[], fn: (lot: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < valeurs.length; i += LOT) await fn(valeurs.slice(i, i + LOT))
}

async function dossiersEtLignes(jdd: Jdd, site: SiteJdd, n: number) {
  const { db } = jdd.ctx
  const dossiers: {
    contNum: number
    annonceur: string
    annule: boolean
    prepa: boolean
    themes: string[]
  }[] = []
  for (let i = 0; i < n; i++) {
    const annule = jdd.rng.booleen(0.04)
    dossiers.push({
      contNum: jdd.contNum(),
      annonceur: tirerAnnonceur(jdd.rng),
      annule,
      // Dossiers à instruction : la préparation est reçue (RG-COO-063), condition de l'export (RG-COO-211).
      prepa: !annule && jdd.rng.booleen(0.6),
      themes: Array.from({ length: jdd.rng.entier(1, 3) }, (_, k) => tirerTheme(jdd.rng, k + 1)),
    })
  }
  await parLots(dossiers, (lot) =>
    db.dossier.createMany({
      data: lot.map((d) => ({
        contNum: d.contNum,
        annonceur: d.annonceur,
        statut: d.annule
          ? ('ANNULE' as const)
          : d.prepa
            ? ('PREPARATION_RECUE' as const)
            : ('A_TRAITER' as const),
      })),
    }),
  )
  const lignes = dossiers.flatMap((d) =>
    d.themes.map((theme) => ({
      plateformeId: site.plateforme.id,
      supportId: jdd.rng.choisir(site.supports).id,
      contNum: d.contNum,
      annonceur: d.annonceur,
      theme,
      themeCle: theme.toUpperCase(),
      semNum: jdd.semaine.semaine,
      semAnnee: jdd.semaine.annee,
      source: 'BC' as const,
      etatLigne: d.annule ? ('ANNULEE' as const) : ('ACTIVE' as const),
      statut: 'ATTENDUE' as const,
      qteBc: jdd.rng.entier(5, 80),
    })),
  )
  await parLots(lignes, (lot) => db.receptionAttendue.createMany({ data: lot }))
  jdd.compter('dossiers', dossiers.length)
  jdd.compter('lignes', lignes.length)
  return dossiers
}

async function instructionsEtFaces(
  jdd: Jdd,
  site: SiteJdd,
  contNums: number[],
  themesDe: Map<number, string[]>,
) {
  const { db } = jdd.ctx
  const dossiers = new Map<number, number>()
  for (let i = 0; i < contNums.length; i += 200)
    for (const d of await db.dossier.findMany({
      where: { contNum: { in: contNums.slice(i, i + 200) } },
      select: { id: true, contNum: true },
    }))
      dossiers.set(d.contNum, d.id)
  const base = jdd.compteurs['instructions'] ?? 0
  const code = (n: number) =>
    `JV${String(jdd.seed).padStart(3, '0')}${String(base + n).padStart(8, '0')}`
  const instr = contNums.map((contNum, i) => ({
    code: code(i),
    dossierId: dossiers.get(contNum) ?? null,
    atelierId: site.ateliers.scroll.id,
    contNum,
    statut: 'INSTRUCTION_OK' as const,
    iokMode: 'MANUEL',
    contAnbas: jdd.depart.annee,
    contSembas: jdd.depart.semaine,
  }))
  await parLots(instr, (lot) => db.instruction.createMany({ data: lot }))
  const faces = contNums.flatMap((contNum, i) =>
    (themesDe.get(contNum) ?? []).map((theme, k) => ({
      instructionCode: code(i),
      statut: 'INSTRUCTION_OK' as const,
      atelierId: site.ateliers.scroll.id,
      supportId: jdd.rng.choisir(site.supports).id,
      destinataireId: jdd.rng.choisir(site.destinataires).id,
      contNum,
      cadrIdent: (base + i) * 10 + k,
      dateDepart: new Date(Date.UTC(jdd.depart.annee, 0, 1) + 14 * 86_400_000),
      contAnbas: jdd.depart.annee,
      contSembas: jdd.depart.semaine,
      depAnbas: jdd.depart.annee,
      depSembas: jdd.depart.semaine,
      trainId: `7${String(jdd.seed).padStart(3, '0')}${String(base + i).padStart(8, '0')}${String(k)}`,
      theme,
      ordreReel: k + 1,
    })),
  )
  await parLots(faces, (lot) => db.faceTrain.createMany({ data: lot }))
  jdd.compter('instructions', instr.length)
  jdd.compter('faces', faces.length)
}

export const volumetrie: Scenario = {
  nom: 'volumetrie',
  regles: [
    'RG-REC-037',
    'RG-REC-069',
    'RG-COO-008',
    'RG-COO-260',
    'RG-COO-263',
    'ANO-035',
    'ANO-050',
    'ANO-051',
  ],
  attendu:
    'volume dossiers / lignes / trains / répartitions, parcours complet sur une fraction ; cohérence conservée',
  async generer(jdd) {
    const { db } = jdd.ctx
    const sites = [
      await creerSite(jdd, { destinataires: 8 }),
      await creerSite(jdd, { destinataires: 5 }),
      await creerSite(jdd, { destinataires: 3 }),
    ]
    const parts = [0.6, 0.3, 0.1]
    for (const [idx, site] of sites.entries()) {
      const n = Math.max(2, Math.round(jdd.volume * (parts[idx] ?? 0.1)))
      const dossiers = await dossiersEtLignes(jdd, site, n)
      const actifs = dossiers.filter((d) => !d.annule)
      // Trains pour 60 % des dossiers actifs.
      const avecTrains = dossiers.filter((d) => d.prepa)
      await instructionsEtFaces(
        jdd,
        site,
        avecTrains.map((d) => d.contNum),
        new Map(avecTrains.map((d) => [d.contNum, d.themes])),
      )
      // Réceptions (API) pour 30 % des dossiers actifs : un BL par dossier, tous thèmes.
      for (const d of actifs.filter(() => jdd.rng.booleen(0.3))) {
        const lignes = await db.receptionAttendue.findMany({
          where: { plateformeId: site.plateforme.id, contNum: d.contNum, etatLigne: 'ACTIVE' },
          select: { id: true, qteBc: true },
        })
        if (lignes.length === 0) continue
        const r = await recevoirBl(
          jdd,
          site,
          lignes.map((l) => ({ ligneAttendueId: l.id, quantite: l.qteBc ?? 5 })),
        )
        if (jdd.rng.booleen(0.6)) exiger(await controler(jdd, site, r.receptionId), 'contrôle')
        if (jdd.rng.booleen(0.5))
          for (const a of r.affiches) exiger(await validerAffiche(jdd, site, a.id), 'validation')
      }
      // Répartitions de l'atelier fixe : volume / 2 par site ; Colisage par lots de 100 lignes pour 40 % ; colis pour 150 lignes.
      const type = await typePreparation(jdd)
      const reps = []
      for (let i = 0; i < Math.round(n / 2); i++)
        reps.push(await ligneRepartition(jdd, site, type.id))
      const aColiser = reps.slice(0, Math.round(reps.length * 0.4))
      const pourColis = aColiser.slice(0, 150)
      if (pourColis.length > 0)
        await chaineFixe(
          jdd,
          site,
          pourColis.map((r) => ({ id: r.id, version: r.version })),
        )
      const reste = aColiser.slice(150)
      for (let i = 0; i < reste.length; i += 100)
        exiger(
          await appelUnitaire(jdd, site, 'colisage', {
            lignes: reste.slice(i, i + 100).map((r) => ({ id: r.id, version: r.version })),
          }),
          'colisage par lots',
        )
      // Lectures des listes sous volume : toutes en 200 (les temps sont mesurés par massif/performance).
      await lireLesListes(jdd, site)
    }
  },
}
