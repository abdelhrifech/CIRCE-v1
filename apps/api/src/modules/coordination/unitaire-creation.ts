// Étape 8 (Q-265, option (c) retenue par défaut, HYPOTHÈSE PRISE) — « Libérer la semaine » (RG-COO-240) ne crée pas
// les UM (H2 de la maquette ECR-COO-09a) ; « Colisage » (EX-FIX-510, atelier de Wissous) les crée à la demande :
// construction (RG-COO-260), création de l'UM (RG-COO-261), statuts d'origine admis (RG-COO-262). Les repères « à
// libérer » (RG-COO-241) et « arrivé après libération » (RG-COO-242, RG-X-076) sont dérivés à la lecture
// (`unitaire.ts`, `alertes-coordination.ts`). Toutes les écritures d'une opération sont dans UNE transaction.
import {
  formatSemaineIso,
  lireSemaineIso,
  semaineIsoDe,
  type LibererSemaine,
  type LignesSelection,
  type ResultatLiberation,
  type ResultatUnitaire,
} from '@circe/shared'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { parPaquets } from '../../core/paquets.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { assertDroitCoordination, assertPerimetreAtelier } from './permissions.ts'
import { affichesIndicatives } from './unitaire-affiches.ts'
import { cleVisuel } from './trains.ts'
import {
  changerStatutRepartition,
  chargerSelection,
  STATUTS_MASQUES,
  TRANSITIONS_REPARTITION,
  type RepartitionLue,
} from './unitaire.ts'

const deux = (n: number) => String(n).padStart(2, '0')

// ───────────────────────────── RG-COO-240 : libérer la semaine ─────────────────────────────

// RG-COO-240 : crée la libération (atelier fixe, semaine de départ), écrit « Libéré vers l'atelier » à l'historique
// de chaque dossier de la semaine et au journal. Action directe (pas de confirmation), sans lien avec la validation
// admin ; une seule libération par (atelier, semaine) : la seconde est refusée en 409 (HYPOTHÈSE de la règle).
// Ne crée AUCUNE UM (Q-265 option (c)).
export async function libererSemaine(
  tx: Tx,
  identity: Identity,
  input: LibererSemaine,
): Promise<ResultatLiberation> {
  assertDroitCoordination(identity, 'semaine.liberer', 'RG-COO-240')
  const atelier = await tx.atelier.findUnique({ where: { id: input.atelierId } })
  if (!atelier) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, atelier)
  if (atelier.type !== 'FIXE')
    throw new BusinessError(
      "Cet atelier n'est pas un atelier de préparation 2 m² (fixe) : la libération ne s'applique pas.",
      { code: 'COO_ATELIER_NON_FIXE', regle: 'RG-COO-240' },
    )
  const sem = lireSemaineIso(input.depart)
  const deja = await tx.liberationSemaine.findUnique({
    where: {
      atelierId_semAnnee_semNum: {
        atelierId: atelier.id,
        semAnnee: sem.annee,
        semNum: sem.semaine,
      },
    },
  })
  if (deja)
    throw new ConflictError(
      `La ${formatSemaineIso(sem)} est déjà libérée vers l'atelier « ${atelier.libelle} ».`,
      {
        code: 'COO_SEMAINE_DEJA_LIBEREE',
        regle: 'RG-COO-240',
        details: { libereeLe: deja.libereeLe.toISOString() },
      },
    )
  const maintenant = new Date()
  const cree = await tx.liberationSemaine.create({
    data: {
      atelierId: atelier.id,
      semAnnee: sem.annee,
      semNum: sem.semaine,
      libereeLe: maintenant,
      parId: identity.userId,
    },
  })
  // Dossiers « préparation reçue » de la semaine (HYPOTHÈSE Q-404 (3) : ceux qui ont des lignes actives pour l'atelier).
  const reps = await tx.repartition.findMany({
    where: {
      atelierId: atelier.id,
      semAnnee: sem.annee,
      semNum: sem.semaine,
      contNum: { not: null },
      statut: { notIn: STATUTS_MASQUES },
    },
    select: { contNum: true, theme: true, atelier: { select: { plateformeId: true } } },
  })
  const contNums = [...new Set(reps.map((r) => r.contNum).filter((c): c is number => c !== null))]
  const indicatives = await affichesIndicatives(tx, contNums)
  const aConfirmer = new Set<number>()
  for (const r of reps)
    if (
      r.contNum !== null &&
      indicatives.get(cleVisuel(r.atelier?.plateformeId ?? 0, r.contNum, r.theme)) === 'PROPOSEE'
    )
      aConfirmer.add(r.contNum)
  const libelle = formatSemaineIso(sem)
  for (const contNum of contNums)
    await ecrireJournal(tx, {
      typeEntite: 'DOSSIER',
      entiteId: contNum,
      action: 'LIBERATION_SEMAINE',
      parId: identity.userId,
      nouvelleValeur: `Libéré vers l'atelier ${atelier.libelle} (${libelle})`,
      complement: 'RG-COO-240',
    })
  await ecrireJournal(tx, {
    typeEntite: 'LIBERATION_SEMAINE',
    entiteId: cree.id,
    action: 'LIBERATION_SEMAINE',
    parId: identity.userId,
    nouvelleValeur: `${libelle} libérée vers l'atelier ${atelier.libelle}`,
    complement: 'RG-COO-240',
  })
  const confirm =
    aConfirmer.size > 0
      ? ` ${String(aConfirmer.size)} dossier(s) ont encore des affiches à confirmer : la libération ne les attend pas.`
      : ''
  return {
    message: `${libelle} libérée vers l'atelier « ${atelier.libelle} ». Les préparations reçues ensuite déclencheront une alerte (mail non envoyé par Circé, Q-375).${confirm}`,
    atelierId: atelier.id,
    depart: libelle,
    libereeLe: maintenant.toISOString(),
    dossiers: contNums.length,
    dossiersAConfirmer: aConfirmer.size,
  }
}

// ───────────────────────────── RG-COO-260 / 261 / 262 : Colisage = création des UM ─────────────────────────────

/** Clés de regroupement de `BuildUm` (RG-COO-260) : destinataire, contrat (dossier), support, type de préparation,
 * thème, repiquage ; l'afficheur est le destinataire en V2 (HYPOTHÈSE Q-196), donc un changement d'afficheur ne clôt
 * jamais une UM à lui seul. L'atelier et la semaine de départ s'y ajoutent : une UM porte un seul atelier et un seul
 * départ (HYPOTHÈSE Q-404 (5)). */
const cleGroupe = (r: RepartitionLue) =>
  [
    r.atelierId,
    r.semAnnee,
    r.semNum,
    r.destinataireId,
    r.contNum,
    r.supportId,
    r.typePreparationId,
    (r.theme ?? '').trim().toLowerCase(),
    (r.repiquage ?? '').trim().toLowerCase(),
  ].join('|')

const ordre = (a: RepartitionLue, b: RepartitionLue) =>
  cleGroupe(a).localeCompare(cleGroupe(b)) || a.id - b.id

interface Portion {
  rep: Pick<RepartitionLue, 'id' | 'statut' | 'version'>
  qte: number
  /** Nouvelle quantité de la répartition d'origine si elle est scindée ; null sinon. */
  reduiteA: number | null
  date: Date | null
}

// RG-COO-260 : « Colisage » : construit puis crée les UM de la sélection (une UM par groupe de clés identiques, scindée
// par quantité d'UM du support), chaque UM dans la transaction de l'opération (RG-COO-261, CLAUDE.md §6).
// RG-COO-262 : seules les répartitions « A traiter » (0) entrent dans une UM ; toute autre → 409 (transition
// interdite), l'opération entière est annulée.
export async function creerUnites(
  tx: Tx,
  identity: Identity,
  input: LignesSelection,
): Promise<ResultatUnitaire> {
  assertDroitCoordination(identity, 'unite.gerer', 'RG-COO-260')
  const selection = await chargerSelection(tx, identity, input.lignes, 'RG-COO-262')
  // RG-COO-262 : table de transitions explicite (0 → 1 seulement).
  for (const r of selection) {
    assertTransition(TRANSITIONS_REPARTITION, r.statut, 'EN_COURS', { regle: 'RG-COO-262' })
    if (r.uniteId !== null)
      throw new ConflictError('Cette ligne est déjà dans une UM : « Retirer » d’abord.', {
        code: 'TRANSITION_INTERDITE',
        regle: 'RG-COO-262',
        details: { ligne: r.id, unite: r.uniteId },
      })
    // RG-COO-275 (extrait) : `UM_qte` ≠ 0 : une quantité nulle ne produit pas d'UM.
    if ((r.qte ?? 0) <= 0)
      throw new BusinessError(
        `La ligne ${String(r.id)} a une quantité nulle : aucune UM à créer.`,
        {
          code: 'COO_QUANTITE_NULLE',
          regle: 'RG-COO-275',
        },
      )
  }
  const supportIds = [
    ...new Set(selection.map((r) => r.supportId).filter((s): s is number => s !== null)),
  ]
  const supports = new Map(
    (
      await parPaquets(supportIds, (paquet) =>
        tx.categorieSupport.findMany({ where: { id: { in: paquet } } }),
      )
    ).map((s) => [s.id, s]),
  )
  const minLot =
    selection
      .map((r) => r.dateAffichage)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null

  const groupes = new Map<string, RepartitionLue[]>()
  for (const r of [...selection].sort(ordre))
    groupes.set(cleGroupe(r), [...(groupes.get(cleGroupe(r)) ?? []), r])

  const maintenant = new Date()
  const sem = semaineIsoDe(maintenant)
  const aa = deux(sem.annee % 100)
  const ss = deux(sem.semaine)
  const mmjj = `${deux(maintenant.getUTCMonth() + 1)}${deux(maintenant.getUTCDate())}`
  const creees: number[] = []

  for (const membres of groupes.values()) {
    const premiere = membres[0]
    if (!premiere) continue
    const support = premiere.supportId !== null ? supports.get(premiere.supportId) : undefined
    const plafond = support?.qteUm && support.qteUm > 0 ? support.qteUm : null
    // RG-COO-260 : découpage par quantité d'UM du support (UM pleines de `SupQteUM` + un reliquat).
    const unites: Portion[][] = [[]]
    let courant = 0
    for (const r of membres) {
      let reste = r.qte ?? 0
      let enCours: Pick<RepartitionLue, 'id' | 'statut' | 'version'> = r
      while (reste > 0) {
        const place = plafond === null ? reste : plafond - courant
        const prise = Math.min(reste, place)
        const cible = unites[unites.length - 1]
        if (!cible) break
        cible.push({
          rep: enCours,
          qte: prise,
          // Une répartition scindée est réduite à la portion qui entre dans cette UM (le reste est dans un reliquat).
          reduiteA: prise < reste ? prise : null,
          date: r.dateAffichage,
        })
        courant += prise
        reste -= prise
        if (plafond !== null && courant >= plafond) {
          unites.push([])
          courant = 0
        }
        if (reste > 0) {
          // Reliquat : nouvelle répartition (même attributs, statut A traiter) rattachée à l'UM suivante.
          const clone = await tx.repartition.create({
            data: {
              supportId: r.supportId,
              atelierId: r.atelierId,
              typePreparationId: r.typePreparationId,
              destinataireId: r.destinataireId,
              statut: 'A_TRAITER',
              semNum: r.semNum,
              semAnnee: r.semAnnee,
              desId: r.desId,
              desType: r.desType,
              desTypeAdr: r.desTypeAdr,
              type: r.type,
              repartition: r.repartition,
              annonceur: r.annonceur,
              theme: r.theme,
              repiquage: r.repiquage,
              repiquageId: r.repiquageId,
              numAfficheAmt: r.numAfficheAmt,
              qte: reste,
              dateAffichage: r.dateAffichage,
              contNum: r.contNum,
              numeroReception: r.numeroReception,
              corrigeePlateforme: r.corrigeePlateforme,
              idPreparationDetail: r.idPreparationDetail,
              idGroupePreparation: r.idGroupePreparation,
              createdById: identity.userId,
              updatedById: identity.userId,
            },
          })
          await ecrireHistoriqueStatut(tx, {
            typeEntite: 'REPARTITION',
            entiteId: clone.id,
            ancien: null,
            nouveau: 'A_TRAITER',
            parId: identity.userId,
            regle: 'RG-COO-260',
            motif: `Reliquat de la ligne ${String(r.id)} (quantité d'UM du support dépassée)`,
          })
          enCours = { id: clone.id, statut: 'A_TRAITER', version: clone.version }
        }
      }
    }
    for (const portions of unites) {
      if (portions.length === 0) continue
      const qte = portions.reduce((x, p) => x + p.qte, 0)
      const dates = portions
        .map((p) => p.date)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())
      const poids = Number(support?.poids ?? 0) * qte
      // RG-COO-261 : InsertUM : statut 1 (En cours), puis code barre et code synthèse.
      const um = await tx.uniteManutention.create({
        data: {
          typePreparationId: premiere.typePreparationId,
          atelierId: premiere.atelierId,
          supportId: premiere.supportId,
          destinataireId: premiere.destinataireId,
          statut: 'EN_COURS',
          semNum: premiere.semNum,
          semAnnee: premiere.semAnnee,
          repartition: premiere.repartition,
          annonceur: premiere.annonceur,
          theme: premiere.theme,
          repiquage: premiere.repiquage,
          numAfficheAmt: premiere.numAfficheAmt,
          qte,
          contNum: premiere.contNum,
          poids,
          // `UM_date_aff` = minimum des dates des répartitions liées (à défaut, minimum du lot).
          dateAffichage: dates[0] ?? minLot,
          createdById: identity.userId,
          updatedById: identity.userId,
        },
      })
      const codeBarre = `${aa}${ss}-${String(um.id).padStart(13, '0')}`
      const codeSynthese = `${aa}${ss}${mmjj}${deux(premiere.atelierId ?? 0)}${String(premiere.destinataireId ?? 0).padStart(8, '0')}`
      await tx.uniteManutention.update({ where: { id: um.id }, data: { codeBarre, codeSynthese } })
      await ecrireHistoriqueStatut(tx, {
        typeEntite: 'UNITE_MANUTENTION',
        entiteId: um.id,
        ancien: null,
        nouveau: 'EN_COURS',
        parId: identity.userId,
        regle: 'RG-COO-261',
      })
      await ecrireJournal(tx, {
        typeEntite: 'UNITE_MANUTENTION',
        entiteId: um.id,
        action: 'CREATION_UNITE',
        parId: identity.userId,
        nouvelleValeur: `${codeBarre} · quantité ${String(qte)}`,
        complement: 'RG-COO-261',
      })
      // RG-COO-261 / 262 : chaque répartition de l'UM → UM_id, statut 1 (0 → 1 seulement).
      for (const p of portions)
        await changerStatutRepartition(
          tx,
          identity,
          p.rep,
          'EN_COURS',
          'RG-COO-262',
          { uniteId: um.id, ...(p.reduiteA !== null ? { qte: p.reduiteA } : {}) },
          undefined,
        )
      creees.push(um.id)
    }
  }
  return {
    message: `${String(creees.length)} UM créée(s).`,
    traitees: creees.length,
    enProduction: 0,
    ecart: null,
    mailStatut: null,
  }
}
