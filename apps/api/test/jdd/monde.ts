// Briques de construction des scénarios : dossiers et lignes attendues (alimentation Broadcast : insertion directe),
// trains, lignes de répartition (préparation fixe), puis actions réelles par l'API (réception, contrôle, validation
// admin, export, libération, colisage, colis, fin de journée). Les valeurs viennent du PRNG de la seed.
import { formatSemaineIso, type Role } from '@circe/shared'
import type { Prisma, StatutDossier, StatutProduction } from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { exiger, lireApi, poster, creerLigne, recevoirBl, type ReceptionFaite } from './api.ts'
import { type Jdd, type SiteJdd } from './contexte.ts'
import { annonceur as tirerAnnonceur, theme as tirerTheme } from './prng.ts'

export type Ligne = Awaited<ReturnType<typeof creerLigne>>

export interface DossierJdd {
  dossier: { id: number; contNum: number; version: number }
  annonceur: string
  lignes: Ligne[]
}

/** Dossier et ses lignes attendues (un thème par ligne) sur le site, semaine courante. */
export async function dossierAvecLignes(
  jdd: Jdd,
  site: SiteJdd,
  o: {
    lignes?: number
    statut?: StatutDossier
    qteBc?: () => number
    ligne?: Partial<Prisma.ReceptionAttendueUncheckedCreateInput>
  } = {},
): Promise<DossierJdd> {
  const annonceur = tirerAnnonceur(jdd.rng)
  const contNum = jdd.contNum()
  const dossier = await f.createDossier(jdd.ctx.db, {
    contNum,
    annonceur,
    statut: o.statut ?? 'A_TRAITER',
  })
  const lignes: Ligne[] = []
  const n = o.lignes ?? jdd.rng.entier(1, 3)
  for (let i = 0; i < n; i++) {
    const intitule = tirerTheme(jdd.rng, f.next() + i)
    lignes.push(
      await creerLigne(jdd, site, {
        contNum,
        annonceur,
        theme: intitule,
        themeCle: intitule.toUpperCase(),
        supportId: jdd.rng.choisir(site.supports).id,
        qteBc: o.qteBc ? o.qteBc() : jdd.rng.entier(5, 60),
        ...o.ligne,
      }),
    )
  }
  jdd.compter('dossiers')
  jdd.compter('lignes')
  return { dossier, annonceur, lignes }
}

export interface OptionsTrain {
  statutInstruction?:
    'A_TRAITER' | 'EN_COURS' | 'INSTRUCTION_OK' | 'PRET_A_PRODUIRE' | 'ANNULE' | 'ERREUR'
  statutFace?: StatutProduction
  iokMode?: string | null
  atelierId?: number
}

/** Instruction + face de train (un train d'une position) pour chaque ligne d'un dossier ; départ = départ de la seed. */
export async function trainsDuDossier(
  jdd: Jdd,
  site: SiteJdd,
  d: DossierJdd,
  o: OptionsTrain = {},
) {
  const db = jdd.ctx.db
  const atelierId = o.atelierId ?? site.ateliers.scroll.id
  const statutInstruction = o.statutInstruction ?? 'INSTRUCTION_OK'
  const clos = statutInstruction === 'INSTRUCTION_OK' || statutInstruction === 'PRET_A_PRODUIRE'
  const instruction = await f.createInstruction(db, {
    atelierId,
    dossierId: d.dossier.id,
    contNum: d.dossier.contNum,
    annonceur: d.annonceur,
    contAnbas: jdd.depart.annee,
    contSembas: jdd.depart.semaine,
    statut: statutInstruction,
    // Cohérence (RG-COO-044 / 210) : une instruction « Instruction OK » ou « Prêt à produire » porte son mode ; « Prêt à
    // produire » porte aussi sa date d'export.
    iokMode: o.iokMode === undefined ? (clos ? 'MANUEL' : null) : o.iokMode,
    ...(statutInstruction === 'PRET_A_PRODUIRE'
      ? { exporteLe: new Date(), exporteParId: site.users.coord.id }
      : {}),
  })
  const faces = []
  let rang = 0
  for (const l of d.lignes) {
    faces.push(
      await f.createFaceTrain(db, {
        instructionCode: instruction.code,
        statut: o.statutFace ?? 'INSTRUCTION_OK',
        atelierId,
        supportId: l.supportId,
        destinataireId: jdd.rng.choisir(site.destinataires).id,
        contNum: d.dossier.contNum,
        contAnnonc: d.annonceur,
        dateDepart: new Date(Date.UTC(jdd.depart.annee, 0, 1) + 14 * 86_400_000),
        contAnbas: jdd.depart.annee,
        contSembas: jdd.depart.semaine,
        depAnbas: jdd.depart.annee,
        depSembas: jdd.depart.semaine,
        trainId: `8${String(f.next()).padStart(15, '0')}`,
        theme: l.theme,
        ordreReel: ++rang,
        refPanel: `P${String(f.next())}`,
        afficheurNom: 'AFFICHEUR JDD',
        emplAdresse1: 'Rue du Jeu de Données',
      }),
    )
  }
  jdd.compter('instructions')
  jdd.compter('faces', faces.length)
  return { instruction, faces }
}

/** Réception « complète » : une ligne par BL ou groupées, quantité = qte BC (ou fraction). */
export async function recevoirLignes(
  jdd: Jdd,
  site: SiteJdd,
  lignes: Ligne[],
  fraction = 1,
): Promise<ReceptionFaite> {
  return recevoirBl(
    jdd,
    site,
    lignes.map((l) => ({
      ligneAttendueId: l.id,
      quantite: Math.max(1, Math.round((l.qteBc ?? 10) * fraction)),
    })),
  )
}

/** Contrôle de la palette (REC-P05) : comptage = quantité du BL, ou avec écart. */
export async function controler(
  jdd: Jdd,
  site: SiteJdd,
  receptionId: number,
  o: { ecart?: number; rebut?: number } = {},
) {
  const c = exiger(
    await lireApi(jdd, `/api/receptions/${String(receptionId)}/controle`, site.users.recep.headers),
    'lecture du contrôle',
  ).body as { version: number; lignes: { afficheId: number; quantiteBl: number }[] }
  const r = await poster(
    jdd,
    `/api/receptions/${String(receptionId)}/controle`,
    site.users.recep.headers,
    {
      version: c.version,
      controleurId: site.users.recep.id,
      lignes: c.lignes.map((l) => ({
        afficheId: l.afficheId,
        qteComptee: Math.max(0, l.quantiteBl + (o.ecart ?? 0)),
        allee: String.fromCharCode(65 + (l.afficheId % 6)),
        rayon: String(1 + (l.afficheId % 20)),
        rebut: o.rebut ?? 0,
      })),
    },
  )
  jdd.compter('controles')
  return r
}

/** Validation admin (Coordination) d'une affiche à sa version courante. */
export async function validerAffiche(jdd: Jdd, site: SiteJdd, afficheId: number, valider = true) {
  const a = await jdd.ctx.db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
  const r = await poster(
    jdd,
    `/api/coordination/affiches/${String(afficheId)}/validation-admin`,
    site.users.coord.headers,
    {
      version: a.version,
      valider,
    },
  )
  jdd.compter('validations')
  return r
}

export const departTexte = (jdd: Jdd) => formatSemaineIso(jdd.depart)

/** Ligne de répartition d'un atelier fixe (préparation 2 m², départ de la seed), prête à libérer et coliser. */
export async function ligneRepartition(
  jdd: Jdd,
  site: SiteJdd,
  typePreparationId: number,
  o: Partial<Prisma.RepartitionUncheckedCreateInput> = {},
) {
  jdd.compter('repartitions')
  return f.createRepartition(jdd.ctx.db, {
    atelierId: site.ateliers.fixe.id,
    typePreparationId,
    supportId: jdd.rng.choisir(site.supports).id,
    destinataireId: jdd.rng.choisir(site.destinataires).id,
    contNum: jdd.contNum(),
    theme: tirerTheme(jdd.rng, f.next() % 1000),
    annonceur: tirerAnnonceur(jdd.rng),
    qte: jdd.rng.entier(1, 40),
    statut: 'A_TRAITER',
    semAnnee: jdd.depart.annee,
    semNum: jdd.depart.semaine,
    ...o,
  })
}

export async function typePreparation(jdd: Jdd) {
  return jdd.ctx.db.typePreparation.create({ data: { libelle: `Type JDD ${String(f.next())}` } })
}

export async function appelUnitaire(
  jdd: Jdd,
  site: SiteJdd,
  chemin: string,
  corps: unknown,
  role: Role = 'coord',
) {
  return poster(jdd, `/api/coordination/unitaire/${chemin}`, site.users[role].headers, corps)
}

export interface ChaineFixe {
  umIds: number[]
  colisIds: number[]
}

/**
 * Chaîne de l'atelier fixe par l'API : libérer la semaine, « Colisage » (création des UM), colis par destinataire,
 * ajout des UM, « Expédier » (A expédier). La fin de journée est un appel distinct (`finDeJournee`).
 */
export async function chaineFixe(
  jdd: Jdd,
  site: SiteJdd,
  repartitions: { id: number; version: number }[],
  o: { expedier?: boolean } = {},
): Promise<ChaineFixe> {
  const { db } = jdd.ctx
  // RG-COO-240 : une semaine ne se libère qu'une fois par atelier (409 COO_SEMAINE_DEJA_LIBEREE ensuite).
  const deja = await db.liberationSemaine.count({
    where: {
      atelierId: site.ateliers.fixe.id,
      semAnnee: jdd.depart.annee,
      semNum: jdd.depart.semaine,
    },
  })
  if (deja === 0)
    exiger(
      await appelUnitaire(jdd, site, 'liberer', {
        atelierId: site.ateliers.fixe.id,
        depart: departTexte(jdd),
      }),
      'libération',
    )
  exiger(
    await appelUnitaire(jdd, site, 'colisage', {
      lignes: repartitions.map((r) => ({ id: r.id, version: r.version })),
    }),
    'colisage',
  )
  const reps = await db.repartition.findMany({
    where: { id: { in: repartitions.map((r) => r.id) } },
    include: { unite: true },
  })
  const parDest = new Map<number, typeof reps>()
  for (const r of reps) {
    if (!r.unite || r.unite.destinataireId === null) continue
    parDest.set(r.unite.destinataireId, [...(parDest.get(r.unite.destinataireId) ?? []), r])
  }
  const umIds = new Set<number>()
  const colisIds: number[] = []
  const h = site.users.expe.headers
  for (const [destinataireId, lignes] of parDest) {
    const ouvert = exiger(
      await poster(jdd, '/api/coordination/colis', h, {
        atelierId: site.ateliers.fixe.id,
        destinataireId,
      }),
      'ouverture du colis',
    ).body as { colis: { id: number; version: number } }
    let version = ouvert.colis.version
    for (const um of new Map(
      lignes.flatMap((l) => (l.unite ? [[l.unite.id, l.unite] as const] : [])),
    ).values()) {
      const r = exiger(
        await poster(jdd, `/api/coordination/colis/${String(ouvert.colis.id)}/unites`, h, {
          version,
          code: um.codeBarre ?? `UM-${String(um.id)}`,
        }),
        'ajout de l’UM au colis',
      ).body as { colis: { version: number } }
      version = r.colis.version
      umIds.add(um.id)
    }
    if (o.expedier ?? true) {
      exiger(
        await poster(jdd, `/api/coordination/colis/${String(ouvert.colis.id)}/expedier`, h, {
          version,
        }),
        'expédition du colis',
      )
    }
    colisIds.push(ouvert.colis.id)
    jdd.compter('colis')
  }
  jdd.compter('um', umIds.size)
  return { umIds: [...umIds], colisIds }
}

/** Fin de journée de l'expédition : sorties de stock des colis « A expédier » (RG-X-087). */
export async function finDeJournee(jdd: Jdd, site: SiteJdd) {
  return poster(jdd, '/api/coordination/colis/fin-de-journee', site.users.expe.headers, {})
}

/** Export des trains du départ de la seed (aucune condition sur la réception, RG-X-083). */
export async function exporterTrains(jdd: Jdd, site: SiteJdd, simulation = false) {
  return poster(jdd, '/api/coordination/trains/export', site.users.coord.headers, {
    depart: departTexte(jdd),
    simulation,
  })
}

/** Réception inconnue (ECR-REC-08) : palette sans dossier identifié, affiche ORPHELINE, réception « À identifier ». */
export async function creerInconnue(
  jdd: Jdd,
  site: SiteJdd,
  quantite: number,
  headers = site.users.recep.headers,
) {
  const photo = await f.createPhoto(jdd.ctx.db, {
    intitule: 'bl-inconnue.png',
    taille: 16,
    createdById: site.users.recep.id,
  })
  const r = exiger(
    await poster(jdd, '/api/receptions-inconnues', headers, {
      plateformeId: site.plateforme.id,
      supportId: jdd.rng.choisir(site.supports).id,
      annonceur: tirerAnnonceur(jdd.rng),
      theme: 'Lu sur l’affiche',
      imprimeurId: null,
      quantite,
      allee: 'X',
      rayon: String(jdd.rng.entier(1, 20)),
      photoAfficheId: null,
      photoBlId: photo.id,
      sansBl: false,
      numeroBl: `BL-INC-J${String(jdd.seed)}-${String(f.next())}`,
    }),
    'réception inconnue',
  )
  jdd.compter('inconnues')
  return r.body as { receptionId: number; afficheId: number }
}

/** Rattache une inconnue à des lignes attendues (version courante de l'affiche). */
export async function rattacherInconnue(
  jdd: Jdd,
  afficheId: number,
  lignes: { ligneAttendueId: number; quantite: number }[],
  headers: Record<string, string>,
) {
  const a = await jdd.ctx.db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
  return poster(jdd, `/api/affiches/${String(afficheId)}/rattacher-inconnue`, headers, {
    version: a.version,
    lignes,
  })
}

/** Quantité en stock d'une affiche : somme de ses mouvements (RG-REC-151). */
export async function stockDe(jdd: Jdd, afficheId: number): Promise<number> {
  const r = await jdd.ctx.db.mouvement.aggregate({ where: { afficheId }, _sum: { quantite: true } })
  return r._sum.quantite ?? 0
}

/**
 * Lectures : les principales listes et fiches de Réception et de Coordination, chacune avec le profil autorisé ; toutes
 * doivent répondre 200 (jamais 5xx) et ne rien écrire (RG-X-062). Appelée à la fin de plusieurs familles.
 */
export async function lireLesListes(jdd: Jdd, site: SiteJdd, o: { contNum?: number } = {}) {
  const depart = departTexte(jdd)
  const coord = site.users.coord.headers
  const recep = site.users.recep.headers
  const expe = site.users.expe.headers
  const cheq = site.users.cheq.headers
  const atelier = String(site.ateliers.scroll.id)
  const fixe = String(site.ateliers.fixe.id)
  const dossier = o.contNum !== undefined ? `&dossier=${String(o.contNum)}` : ''
  const appels: [string, Record<string, string>][] = [
    ['/api/receptions-attendues', recep],
    ['/api/receptions-attendues?depart=tous&statut=tous&pageSize=100', recep],
    ['/api/reception/compteurs', recep],
    ['/api/reception/referentiels', recep],
    ['/api/receptions/sas', recep],
    ['/api/receptions-inconnues', recep],
    ['/api/affiches', recep],
    ['/api/affiches?aTraiter=oui', coord],
    ['/api/alertes', coord],
    ['/api/alertes/reception', recep],
    ['/api/parametres/reception', site.users.admin.headers],
    ['/api/coordination/dossiers', coord],
    ['/api/coordination/dossiers?va=A_CONFIRMER', coord],
    ['/api/coordination/dossiers?aFaire=A_FAIRE', coord],
    ['/api/coordination/ateliers', coord],
    ['/api/coordination/etiquettes-rack', coord],
    ['/api/coordination/reservations', coord],
    ['/api/coordination/suivi-production', coord],
    [`/api/coordination/trains?depart=${depart}${dossier}`, coord],
    [`/api/coordination/trains?depart=${depart}&atelier=${atelier}`, coord],
    [`/api/coordination/trains/export/apercu?depart=${depart}`, coord],
    ['/api/coordination/trains/export/historique', coord],
    [`/api/coordination/trains/suivi-8m2?depart=${depart}`, coord],
    [`/api/coordination/dispatch?atelier=${atelier}&depart=${depart}`, cheq],
    [`/api/coordination/bagues?atelier=${atelier}&depart=${depart}`, cheq],
    [`/api/coordination/unitaire?atelier=${fixe}`, coord],
    [`/api/coordination/unitaire/synthese?atelier=${fixe}&depart=${depart}`, coord],
    ['/api/coordination/colis', expe],
    ['/api/coordination/colis/a-coliser', expe],
    ['/api/coordination/colis/departs', expe],
    ['/api/coordination/themes/proches', coord],
    ['/api/coordination/themes/annonceurs', coord],
    ['/api/coordination/themes/broadcast', coord],
    ['/api/coordination/deblocage/suivi', coord],
  ]
  let ko = 0
  for (const [url, h] of appels) {
    const r = await lireApi(jdd, url, h)
    if (r.status !== 200) {
      ko++
      jdd.verifier(
        `lecture ${url}`,
        false,
        '200',
        `${String(r.status)} ${JSON.stringify(r.body).slice(0, 160)}`,
        'RG-X-062',
      )
    }
  }
  jdd.compter('lectures', appels.length)
  jdd.verifier(
    'lecture des listes principales : toutes en 200',
    ko === 0,
    '0 échec',
    String(ko),
    'RG-X-062',
  )
}
