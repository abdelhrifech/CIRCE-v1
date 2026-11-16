// COO-P03 — validation admin : état calculé d'une affiche (RG-COO-007), motifs de doute (RG-COO-006), cas
// sûr (RG-COO-005), pastille du dossier (RG-COO-019 / 020) et « Valider la sélection » avec confirmation
// explicite des doutes (RG-COO-010 / 012 / 013). Option A du 02/11 : Circé propose, une personne confirme
// (RG-COO-002) ; la quantité n'est jamais une condition (RG-COO-016).
import type { AfficheValidation, EtatValidation, MotifDoute, ValiderSelection } from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import { BusinessError, ForbiddenError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { ModeRattachement } from '../../generated/prisma/client.ts'
import { assertDroitCoordination, COO, dossierDuPerimetre } from './permissions.ts'
import { donneesValidation } from './validation-donnees.ts'

/** Ligne attendue vue depuis un lien (avec le nombre de thèmes possibles dans son format). */
export interface LigneValidation {
  contNum: number | null
  supportId: number
  theme: string | null
  /** RG-COO-005 (a) : ligne ACTIVE (sinon motif LIGNE_FERMEE, RG-X-055). */
  active: boolean
  /** RG-COO-006 THEME : thèmes distincts des lignes actives du dossier dans ce format (plateforme, semaine). */
  themesPossibles: number
}

export interface DonneesValidation {
  statut: 'IDENTIFIEE' | 'ORPHELINE'
  supportId: number
  /** N° de dossier porté par l'affiche (lu sur le BL ou issu du rattachement). */
  contNum: number | null
  theme: string | null
  validee: boolean
  annulee: boolean
  /** RG-COO-030 (HYPOTHÈSE Q-210) : thème de la ligne changé après la validation (persisté). */
  themeModifie?: boolean
  liens: { mode: ModeRattachement; ligne: LigneValidation }[]
}

/** Comparaison de thèmes sans accents, casse ni espaces multiples (maquette `normTxt`). */
export function normaliserTheme(t: string | null): string {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

// RG-COO-006 / RG-X-002 : motifs de doute, calculés (jamais saisis) et cumulables. RG-COO-003 : l'origine du
// n° de dossier (BL, visuel, saisie) se lit dans le mode du lien. RG-COO-018 : le mode
// VISUEL ou MAIN ajoute le motif BL ; RG-COO-005 (b) : n° porté par l'affiche absent des lignes → BL.
export function motifsDoute(a: DonneesValidation): MotifDoute[] {
  if (a.liens.length === 0) return []
  const motifs: MotifDoute[] = []
  const dossiers = new Set(a.liens.map((l) => l.ligne.contNum))
  if (a.liens.some((l) => l.mode !== 'BL') || (a.contNum !== null && !dossiers.has(a.contNum)))
    motifs.push('BL')
  if (a.liens.some((l) => l.ligne.supportId !== a.supportId)) motifs.push('FORMAT')
  // HYPOTHÈSE Q-185 (2) : thème de l'affiche ≠ thème de la ligne alors que le format en a plusieurs.
  // RG-COO-030 : thème de la ligne changé après la validation → validation à refaire (motif THEME).
  if (
    a.themeModifie === true ||
    a.liens.some(
      (l) =>
        l.ligne.themesPossibles > 1 && normaliserTheme(a.theme) !== normaliserTheme(l.ligne.theme),
    )
  )
    motifs.push('THEME')
  if (dossiers.size > 1) motifs.push('MULTI')
  // HYPOTHÈSE Q-178 (1) : une ligne sans thème = IP non saisies (thème provisoire).
  if (a.liens.some((l) => l.ligne.theme === null)) motifs.push('SANS_IP')
  if (a.annulee) motifs.push('ANNULEE')
  // RG-COO-005 (a) / RG-X-055 (HYPOTHÈSE Q-185 (10)) : lien vers une ligne fermée → à re-rattacher (ANO-028).
  if (a.liens.some((l) => !l.ligne.active)) motifs.push('LIGNE_FERMEE')
  return motifs
}

// RG-COO-007 : état calculé, dans l'ordre RECEPTION_INCONNUE → VALIDEE → DOUTE → PROPOSE.
// RG-COO-005 : cas sûr = rattachée, aucun motif de doute (la prépa n'est PAS une condition).
// RG-COO-016 : aucune condition de quantité.
export function etatValidation(a: DonneesValidation): EtatValidation {
  if (a.statut === 'ORPHELINE' || a.liens.length === 0) return 'RECEPTION_INCONNUE'
  if (a.validee) return 'VALIDEE'
  return motifsDoute(a).length > 0 ? 'A_CONFIRMER_DOUTE' : 'A_CONFIRMER_PROPOSE'
}

export type EtatValidationDossier =
  'SANS_OBJET' | 'A_CONFIRMER' | 'VALIDEE' | 'AUCUNE_AFFICHE_RECUE'

// RG-COO-019 : pastille du dossier ; RG-COO-020 : « Validation admin faite » = au moins une affiche reçue,
// toutes confirmées (calcul, aucun statut persisté, indépendant de la prépa).
export function resumeValidation(etats: EtatValidation[], dossierAnnule: boolean) {
  const aConfirmer = etats.filter(
    (e) => e === 'A_CONFIRMER_PROPOSE' || e === 'A_CONFIRMER_DOUTE',
  ).length
  const doutes = etats.filter((e) => e === 'A_CONFIRMER_DOUTE').length
  const etat: EtatValidationDossier = dossierAnnule
    ? 'SANS_OBJET'
    : aConfirmer > 0
      ? 'A_CONFIRMER'
      : etats.includes('VALIDEE')
        ? 'VALIDEE'
        : 'AUCUNE_AFFICHE_RECUE'
  return { etat, aConfirmer: dossierAnnule ? 0 : aConfirmer, doutes: dossierAnnule ? 0 : doutes }
}

export interface AfficheDuDossier extends AfficheValidation {
  dossier: number
  plateformeId: number
}

/**
 * Affiches reçues des dossiers `contNums` (liens actifs vers leurs lignes, périmètre `plateformes` ;
 * null = tous les sites), avec état et motifs. Lecture seule (RG-X-062 : jamais de rattachement en lecture).
 * RG-COO-004 / RG-X-001 : la proposition de rattachement est le lien actif posé à la réception (mode,
 * quantité), sans effet de validation ; elle est recalculée à chaque lecture (ligne changée, IP, annulation).
 */
export async function affichesDesDossiers(
  client: Db | Tx,
  contNums: number[],
  plateformes: number[] | null,
): Promise<Map<number, AfficheDuDossier[]>> {
  const resultat = new Map<number, AfficheDuDossier[]>()
  if (contNums.length === 0) return resultat
  const liensDossiers = await parPaquets(contNums, (paquet) =>
    client.afficheAttendue.findMany({
      where: {
        actif: true,
        ligneAttendue: {
          contNum: { in: paquet },
          ...(plateformes ? { plateformeId: { in: plateformes } } : {}),
        },
      },
      select: { afficheId: true },
    }),
  )
  const ids = [...new Set(liensDossiers.map((l) => l.afficheId))]
  if (ids.length === 0) return resultat
  const affiches = await parPaquets(ids, (paquet) =>
    client.affiche.findMany({
      where: { id: { in: paquet } },
      include: {
        rattachements: { where: { actif: true }, include: { ligneAttendue: true } },
      },
      orderBy: { id: 'asc' },
    }),
  )
  // RG-COO-006 THEME : thèmes possibles par (dossier, plateforme, format, semaine), lignes actives non exclues.
  const lignesLiees = affiches.flatMap((a) => a.rattachements.map((r) => r.ligneAttendue))
  const dossiersLies = [
    ...new Set(lignesLiees.map((l) => l.contNum).filter((c): c is number => c !== null)),
  ]
  const lignesDossiers = await parPaquets(dossiersLies, (paquet) =>
    client.receptionAttendue.findMany({
      where: { contNum: { in: paquet }, etatLigne: 'ACTIVE', themeExclu: false },
      select: {
        contNum: true,
        plateformeId: true,
        supportId: true,
        semAnnee: true,
        semNum: true,
        theme: true,
      },
    }),
  )
  const cle = (l: {
    contNum: number | null
    plateformeId: number
    supportId: number
    semAnnee: number
    semNum: number
  }) => `${String(l.contNum)}|${l.plateformeId}|${l.supportId}|${l.semAnnee}|${l.semNum}`
  const themes = new Map<string, Set<string>>()
  for (const l of lignesDossiers) {
    const k = cle(l)
    const s = themes.get(k) ?? new Set<string>()
    s.add(normaliserTheme(l.theme))
    themes.set(k, s)
  }
  // ECR-COO-02 « Reçue » : quantité reçue (mouvements de réception et de complément).
  const recus = new Map(
    (
      await parPaquets(ids, (paquet) =>
        client.mouvement.groupBy({
          by: ['afficheId'],
          where: { afficheId: { in: paquet }, type: { in: ['RECEPTION', 'COMPLEMENT'] } },
          _sum: { quantite: true },
        }),
      )
    ).map((m) => [m.afficheId, m._sum.quantite ?? 0]),
  )
  const noms = new Map(
    (
      await parPaquets(
        [
          ...new Set(
            affiches.map((a) => a.validationAdminParId).filter((x): x is number => x !== null),
          ),
        ],
        (paquet) =>
          client.utilisateur.findMany({
            where: { id: { in: paquet } },
            select: { id: true, nom: true, identifiantExterne: true },
          }),
      )
    ).map((u) => [u.id, u.nom ?? u.identifiantExterne]),
  )
  for (const a of affiches) {
    const donnees: DonneesValidation = {
      statut: a.statut,
      supportId: a.supportId,
      contNum: a.contNum,
      theme: a.theme,
      validee: a.validationAdmin,
      annulee: a.validationAnnulee,
      themeModifie: a.themeModifie,
      liens: a.rattachements.map((r) => ({
        mode: r.mode,
        ligne: {
          contNum: r.ligneAttendue.contNum,
          supportId: r.ligneAttendue.supportId,
          theme: r.ligneAttendue.theme,
          active: r.ligneAttendue.etatLigne === 'ACTIVE',
          themesPossibles: themes.get(cle(r.ligneAttendue))?.size ?? 1,
        },
      })),
    }
    const etat = etatValidation(donnees)
    const motifs = etat === 'A_CONFIRMER_DOUTE' ? motifsDoute(donnees) : []
    // Une affiche apparaît dans chaque dossier (du périmètre) auquel elle est rattachée.
    const parDossier = new Map<number, { theme: string | null; quantite: number }[]>()
    for (const r of a.rattachements) {
      const c = r.ligneAttendue.contNum
      if (c === null || !contNums.includes(c)) continue
      if (plateformes && !plateformes.includes(r.ligneAttendue.plateformeId)) continue
      parDossier.set(c, [
        ...(parDossier.get(c) ?? []),
        { theme: r.ligneAttendue.theme, quantite: r.quantite },
      ])
    }
    for (const [dossier, themesDossier] of parDossier) {
      const liste = resultat.get(dossier) ?? []
      liste.push({
        id: a.id,
        version: a.version,
        dossier,
        plateformeId: a.plateformeId,
        theme: a.theme,
        quantite: themesDossier.reduce((t, x) => t + x.quantite, 0),
        themes: themesDossier,
        quantiteRecue: recus.get(a.id) ?? 0,
        recueLe: a.dateEntree.toISOString(),
        emplacement: a.allee || a.rayon ? `${a.allee ?? '—'}-${a.rayon ?? '—'}` : null,
        etat,
        motifs,
        validePar:
          a.validationAdminParId !== null ? (noms.get(a.validationAdminParId) ?? null) : null,
        valideLe: a.validationAdminLe?.toISOString() ?? null,
        // RG-COO-024 : même calcul que effets-validation.ts:estAssociee (lien actif ET validée).
        estAssociee: a.rattachements.length > 0 && a.validationAdmin,
      })
      resultat.set(dossier, liste)
    }
  }
  return resultat
}

/** État et motifs d'une seule affiche (fiche affiche, ECR-REC-05). */
export async function etatValidationAffiche(client: Db | Tx, afficheId: number) {
  const a = await client.affiche.findUniqueOrThrow({
    where: { id: afficheId },
    include: { rattachements: { where: { actif: true }, select: { ligneAttendue: true } } },
  })
  const contNums = [
    ...new Set(
      a.rattachements.map((r) => r.ligneAttendue.contNum).filter((c): c is number => c !== null),
    ),
  ]
  for (const liste of (await affichesDesDossiers(client, contNums, null)).values()) {
    const trouvee = liste.find((x) => x.id === afficheId)
    if (trouvee) return { etat: trouvee.etat, motifs: trouvee.motifs }
  }
  // Sans dossier (orpheline, ou liens vers des lignes sans n° de dossier) : réception inconnue.
  return { etat: 'RECEPTION_INCONNUE' as const, motifs: [] as MotifDoute[] }
}

export const LIBELLE_MOTIF: Record<MotifDoute, string> = {
  BL: 'rattachée sans le n° du BL',
  FORMAT: 'format différent',
  THEME: 'plusieurs thèmes possibles',
  MULTI: 'répartition à confirmer',
  SANS_IP: 'IP pas saisies',
  ANNULEE: 'validation annulée : à refaire',
  LIGNE_FERMEE: 'ligne attendue fermée : à re-rattacher',
}

const plateformesDe = (identity: Identity) =>
  identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds

// RG-COO-010 : « Valider la sélection » : toutes les affiches à confirmer des dossiers cochés, en UNE
// transaction ; une affiche changée ou plus à confirmer est ignorée et listée sans bloquer les autres.
// RG-COO-009 : coord / admin (403 dans le service). RG-COO-012 : doutes sans confirmation explicite → 422.
// RG-COO-013 : rien à confirmer → 422. RG-COO-015 : par / le nominatifs. RG-COO-016 : aucune condition de
// quantité. RG-COO-001 : aucune garde sur la prépa ni l'Instruction OK. RG-COO-167 : périmètre.
export async function validerSelection(tx: Tx, identity: Identity, input: ValiderSelection) {
  assertDroitCoordination(identity, 'validation_admin.valider', 'RG-COO-009')
  // RG-NEW-REC-004 : sélection par affiche, contrôlée avant de résoudre ses dossiers.
  const dossierIds = new Set(input.dossierIds)
  if (input.afficheIds) {
    const choisies = await tx.affiche.findMany({
      where: { id: { in: input.afficheIds } },
      include: {
        rattachements: {
          where: { actif: true },
          select: { ligneAttendue: { select: { contNum: true } } },
        },
      },
    })
    if (
      choisies.length !== new Set(input.afficheIds).size ||
      choisies.some(
        (a) =>
          !identity.perimetre.toutesPlateformes &&
          !identity.perimetre.plateformeIds.includes(a.plateformeId),
      )
    )
      throw new ForbiddenError('Affiche absente ou hors de votre périmètre.')
    const numeros = choisies.flatMap((a) =>
      a.rattachements.flatMap((l) =>
        l.ligneAttendue.contNum === null ? [] : [l.ligneAttendue.contNum],
      ),
    )
    for (const d of await tx.dossier.findMany({
      where: { contNum: { in: numeros } },
      select: { id: true },
    }))
      dossierIds.add(d.id)
  }
  const dossiers = []
  for (const id of dossierIds) {
    dossiers.push(await dossierDuPerimetre(tx, identity, id))
  }
  // Dossier annulé : pastille « — » (RG-COO-019), rien à valider (maquette : seuls les dossiers « à faire »).
  const actifs = dossiers.filter((d) => d.statut !== 'ANNULE')
  const parDossier = await affichesDesDossiers(
    tx,
    actifs.map((d) => d.contNum),
    plateformesDe(identity),
  )
  const aConfirmer = new Map<number, AfficheDuDossier>()
  for (const liste of parDossier.values())
    for (const a of liste)
      if (
        (!input.afficheIds || input.afficheIds.includes(a.id)) &&
        (a.etat === 'A_CONFIRMER_PROPOSE' || a.etat === 'A_CONFIRMER_DOUTE')
      )
        aConfirmer.set(a.id, a)
  if (aConfirmer.size === 0) {
    throw new BusinessError(
      'Rien à valider : les dossiers choisis n’ont aucune affiche à confirmer (validation admin déjà faite, ou aucune affiche reçue).',
      { code: 'COO_RIEN_A_VALIDER', regle: 'RG-COO-013' },
    )
  }
  const sures = [...aConfirmer.values()].filter((a) => a.etat === 'A_CONFIRMER_PROPOSE')
  const doutes = [...aConfirmer.values()].filter((a) => a.etat === 'A_CONFIRMER_DOUTE')
  if (doutes.length > 0 && !input.confirmerDoutes && !input.sansDouteSeulement) {
    throw new BusinessError(
      `${String(sures.length)} affiche(s) sans doute et ${String(doutes.length)} affiche(s) à doute sont dans la sélection. Rien n’est validé sans vous : confirmez explicitement les affiches à doute.`,
      {
        code: 'COO_DOUTES_A_CONFIRMER',
        regle: 'RG-COO-012',
        details: { sansDoute: sures.length, doutes },
      },
    )
  }
  if (input.sansDouteSeulement && sures.length === 0) {
    throw new BusinessError(
      'Aucune affiche à confirmer dans la sélection : la validation admin est déjà faite, ou aucune affiche n’est encore arrivée.',
      { code: 'COO_RIEN_A_VALIDER', regle: 'RG-COO-013' },
    )
  }
  const vus = new Map(input.doutes.map((d) => [d.id, d.version]))
  const ignorees: {
    id: number
    raison: 'DOUTE_NON_CONFIRME' | 'DOUTE_NON_VU' | 'VERSION' | 'PLUS_A_CONFIRMER' | 'FUSIONNEE'
  }[] = []
  // RG-COO-010 (ANO-027) : un doute vu dans la modale mais qui n'est plus à confirmer est ignoré et listé.
  for (const d of input.doutes)
    if (!aConfirmer.has(d.id)) ignorees.push({ id: d.id, raison: 'PLUS_A_CONFIRMER' })
  const aEcrire: AfficheDuDossier[] = [...sures]
  for (const a of doutes) {
    if (input.sansDouteSeulement) ignorees.push({ id: a.id, raison: 'DOUTE_NON_CONFIRME' })
    else if (!vus.has(a.id)) ignorees.push({ id: a.id, raison: 'DOUTE_NON_VU' })
    else if (vus.get(a.id) !== a.version) ignorees.push({ id: a.id, raison: 'VERSION' })
    else aEcrire.push(a)
  }
  // RG-COO-029 / RG-REC-169 / RG-COO-010 : une cible de fusion héritée est en lecture seule : ignorée et
  // listée (FUSIONNEE) sans bloquer les autres.
  const fusionnees = new Set(
    (
      await parPaquets(aEcrire, (paquet) =>
        tx.fusionAffiche.findMany({
          where: { afficheId: { in: paquet.map((a) => a.id) } },
          select: { afficheId: true, afficheChapeauId: true },
        }),
      )
    )
      .filter((x) => x.afficheId !== x.afficheChapeauId)
      .map((x) => x.afficheId),
  )
  for (const id of fusionnees) ignorees.push({ id, raison: 'FUSIONNEE' })
  aEcrire.splice(0, aEcrire.length, ...aEcrire.filter((a) => !fusionnees.has(a.id)))
  // RG-COO-013 / Q-185 (6) : aucun doute vu ni cas sûr à écrire → rien à valider (audit M7).
  if (aEcrire.length === 0) {
    throw new BusinessError(
      'Aucune affiche à confirmer dans la sélection : la validation admin est déjà faite, ou aucune affiche n’est encore arrivée.',
      { code: 'COO_RIEN_A_VALIDER', regle: 'RG-COO-013', details: { ignorees } },
    )
  }
  const maintenant = new Date()
  const confirmees: { id: number; version: number }[] = []
  for (const a of aEcrire) {
    const version = await updateWithVersion({
      expectedVersion: a.version,
      update: (where) =>
        tx.affiche.updateMany({
          where: { id: a.id, ...where },
          // RG-COO-015 : par / le nominatifs ; RG-COO-023 : étiquette rack (affiche à confirmer = non validée).
          data: {
            ...donneesValidation(
              identity,
              { validationAdmin: false, etiquetteRackAImprimer: false },
              maintenant,
            ),
            updatedById: identity.userId,
            ...bumpVersion,
          },
        }),
      ...COO.version,
    })
    confirmees.push({ id: a.id, version })
    const motifs = a.motifs.filter((m) => m !== 'ANNULEE')
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: a.id,
      action: 'VALIDATION_ADMIN',
      parId: identity.userId,
      ancienneValeur: 'à confirmer',
      nouvelleValeur:
        'Validation admin confirmée' +
        (motifs.length
          ? ` après vérification : ${motifs.map((m) => LIBELLE_MOTIF[m]).join(' ; ')}`
          : ' : rattachement proposé par Circé, sans doute'),
      donnees: { motifs: a.motifs },
    })
  }
  // RG-COO-020 / RG-COO-160 : l'historique du dossier enregistre la confirmation (aucun statut persisté).
  for (const d of actifs) {
    const ids = (parDossier.get(d.contNum) ?? [])
      .filter((a) => confirmees.some((c) => c.id === a.id))
      .map((a) => a.id)
    if (ids.length === 0) continue
    await ecrireJournal(tx, {
      typeEntite: 'DOSSIER',
      entiteId: d.contNum,
      action: 'VALIDATION_ADMIN',
      parId: identity.userId,
      nouvelleValeur: `${String(ids.length)} affiche(s) confirmée(s) : ${ids.join(', ')}`,
    })
  }
  return {
    confirmees,
    ignorees,
    message:
      messageConfirmation(confirmees.length) +
      (ignorees.length ? ` ${String(ignorees.length)} ignorée(s) (à revoir).` : ''),
  }
}

/**
 * RG-COO-010 / RG-COO-008 : message de la maquette (toast de « Valider la sélection »). HYPOTHÈSE Q-186 (2) :
 * « Broadcast informé » = au prochain retour (RG-COO-024, envoi BLOQUÉ par Q-005).
 */
export function messageConfirmation(n: number): string {
  return `${String(n)} affiche(s) confirmée(s) par la Coordination : n° d’affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé au prochain retour.`
}
