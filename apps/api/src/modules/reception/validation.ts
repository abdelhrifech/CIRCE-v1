// REC-P04 — « Valider la réception » (ECR-REC-01) : création ATOMIQUE de la réception (RG-REC-046).
// Les contrôles sont ceux de verifierBonDeLivraison (RG-REC-037, ordre de la maquette), exécutés dans la
// même transaction que les écritures.
import { declarerConstatReception } from '../nonconformite/service.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { ReceptionCreee, ValiderReception } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { verifierBonDeLivraison } from './bon-livraison.ts'
import { recalculerLigne } from './lignes.ts'
import { assertDroitReception, assertPerimetreReception, REC } from './permissions.ts'
import { rattacher } from './rattachement.ts'
import { enregistrerMouvement } from './stock.ts'
import {
  messageUnitesPretes,
  statutsTrainsDesDossiers,
  unitesDevenuesPretes,
} from '../coordination/unites-pretes.ts'

/** RG-REC-144 / Q-120 : conservation par défaut (legacy : 20 si non renseignée). */
const CONSERVATION_DEFAUT = 20

export async function validerReception(
  tx: Tx,
  identity: Identity,
  input: ValiderReception,
): Promise<ReceptionCreee> {
  const maintenant = new Date()
  // RG-REC-037 : panier vide → aucune ligne cochée → deux plateformes → photo → champs obligatoires.
  const v = await verifierBonDeLivraison(tx, identity, input, maintenant)

  // RG-REC-036 / Q-114 : un n° de BL déjà réceptionné exige une confirmation explicite.
  // Le seul avertissement de la vérification est le doublon de BL (REC_BL_DOUBLON).
  const [doublon] = v.avertissements
  if (doublon && !input.confirmerDoublon) {
    throw new ConflictError(doublon.message, {
      code: 'REC_BL_DOUBLON',
      regle: 'RG-REC-036',
      details: { receptions: doublon.receptions },
    })
  }

  const parLigne = new Map(input.lignes.map((l) => [l.ligneAttendueId, l]))
  const lignes = await tx.receptionAttendue.findMany({
    where: { id: { in: v.lignes.map((l) => l.ligneAttendueId) } },
  })
  const ligneDe = (id: number) => {
    const l = lignes.find((x) => x.id === id)
    if (!l) throw new Error(`ligne ${String(id)} absente`)
    return l
  }

  // RG-REC-047 : une ligne sans thème (IP non saisies) exige un intitulé saisi (HYPOTHÈSE Q-178).
  const sansIntitule = v.lignes.filter(
    (l) => !ligneDe(l.ligneAttendueId).theme && !parLigne.get(l.ligneAttendueId)?.intituleSaisi,
  )
  if (sansIntitule.length > 0) {
    throw new BusinessError('IP non saisies : indiquez l’intitulé lu sur l’affiche.', {
      code: 'REC_INTITULE_REQUIS',
      regle: 'RG-REC-047',
      details: { lignes: sansIntitule.map((l) => l.ligneAttendueId) },
    })
  }

  // RG-X-018 : réception partielle puis complément sur la MÊME affiche (la validation du 1er lot reste).
  // RG-REC-040 : un complément vise une affiche déjà rattachée (lien actif) à la même ligne, et
  // seulement quand le visuel est déjà reçu en partie (statut de ligne Partielle).
  for (const l of v.lignes) {
    const c = parLigne.get(l.ligneAttendueId)?.complementAfficheId
    if (c == null) continue
    if (ligneDe(l.ligneAttendueId).statut !== 'PARTIELLE') {
      throw new BusinessError('Complément possible seulement pour un visuel déjà reçu en partie.', {
        code: 'REC_COMPLEMENT_INVALIDE',
        regle: 'RG-REC-040',
        details: { ligneAttendueId: l.ligneAttendueId },
      })
    }
    const lien = await tx.afficheAttendue.findFirst({
      where: { afficheId: c, ligneAttendueId: l.ligneAttendueId, actif: true },
    })
    if (!lien) {
      throw new BusinessError(
        `L’affiche ${String(c)} n’est pas reçue sur cette ligne : pas de complément possible.`,
        {
          code: 'REC_COMPLEMENT_INVALIDE',
          regle: 'RG-REC-040',
          details: { ligneAttendueId: l.ligneAttendueId, afficheId: c },
        },
      )
    }
  }

  // RG-X-003 : état des unités (trains) des dossiers concernés AVANT les écritures, pour compter celles qui passent PRÊT.
  const unitesAvant = await statutsTrainsDesDossiers(
    tx,
    lignes.map((l) => l.contNum),
  )
  // RG-REC-033 : « Déchargé par » = nom de l'agent choisi (liste fermée, contrôlée par la vérification).
  const agent = input.dechargeParId
    ? await tx.utilisateur.findUnique({
        where: { id: input.dechargeParId },
        select: { nom: true, identifiantExterne: true },
      })
    : null
  const livraison = await tx.livraison.create({
    data: {
      dateLivraison: maintenant,
      // RG-NEW-REC-001 : marqueur durable dans le BL et mode MAIN des rattachements.
      reference: input.sansBl && input.photoBlId === null ? 'Sans BL' : input.numeroBl.trim(),
      imprimeurId: input.imprimeurId,
      livreurId: input.livreurId,
      nbreColis: input.nbColis,
      dechargeParId: input.dechargeParId,
      dechargePar: agent ? (agent.nom ?? agent.identifiantExterne) : null,
      createdById: identity.userId,
    },
  })
  // RG-REC-038 : UNE réception (palette = un BL) À contrôler, avec la photo du BL, entrée dans le sas.
  const reception = await tx.reception.create({
    data: {
      plateformeId: v.plateformeId,
      livraisonId: livraison.id,
      statut: 'A_CONTROLER',
      dateArrivee: maintenant,
      aControlerDepuis: maintenant,
      photoBlId: input.photoBlId,
      createdById: identity.userId,
    },
  })
  if (input.photoBlId !== null) {
    await tx.livraisonPhoto.create({
      data: { livraisonId: livraison.id, photoId: input.photoBlId, intitule: 'Photo du BL' },
    })
  }
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'RECEPTION',
    entiteId: reception.id,
    ancien: null,
    nouveau: 'A_CONTROLER',
    parId: identity.userId,
    regle: 'RG-REC-038',
  })

  const conservation = CONSERVATION_DEFAUT
  const creees: ReceptionCreee['affiches'] = []
  for (const l of v.lignes) {
    const ligne = ligneDe(l.ligneAttendueId)
    const saisie = parLigne.get(l.ligneAttendueId)
    const complementId = saisie?.complementAfficheId ?? null
    if (complementId !== null) {
      // RG-REC-040 : la quantité s'ajoute à la MÊME affiche (mouvement « Réception (complément) »).
      const nb = await tx.livraisonAffiche.count({ where: { afficheId: complementId } })
      await tx.livraisonAffiche.create({
        data: { livraisonId: livraison.id, afficheId: complementId, numeroLivraison: nb + 1 },
      })
      // RG-REC-041 : mouvement de la ligne (récépissé = imprimeur, expéditeur = transporteur).
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: complementId,
        type: 'COMPLEMENT',
        quantite: l.quantite,
        date: maintenant,
        receptionId: reception.id,
        livraisonId: livraison.id,
      })
      // Le lien existant porte la quantité reçue pour cette ligne (RG-REC-017).
      const lien = await tx.afficheAttendue.findFirstOrThrow({
        where: { afficheId: complementId, ligneAttendueId: ligne.id, actif: true },
      })
      await updateWithVersion({
        expectedVersion: lien.version,
        update: (where) =>
          tx.afficheAttendue.updateMany({
            where: { id: lien.id, ...where },
            data: { quantite: lien.quantite + l.quantite, ...bumpVersion },
          }),
        ...REC.version,
      })
      await recalculerLigne(tx, identity, ligne.id)
      creees.push({
        id: complementId,
        ligneAttendueId: ligne.id,
        quantite: l.quantite,
        complement: true,
      })
      continue
    }
    // RG-REC-039 : création de l'affiche (IDENTIFIEE, tag « À contrôler » calculé, zone tampon).
    const theme = ligne.theme ?? saisie?.intituleSaisi ?? null
    const affiche = await tx.affiche.create({
      data: {
        plateformeId: ligne.plateformeId,
        supportId: ligne.supportId,
        receptionId: reception.id,
        imprimeurId: input.imprimeurId,
        statut: 'IDENTIFIEE',
        dateEntree: maintenant,
        contNum: ligne.contNum,
        contAnnonc: ligne.annonceur,
        theme,
        repiquage: null,
        conservation,
        quantite: 0,
        allee: null,
        rayon: null,
        createdById: identity.userId,
      },
    })
    await tx.livraisonAffiche.create({
      data: { livraisonId: livraison.id, afficheId: affiche.id, numeroLivraison: 1 },
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'AFFICHE',
      entiteId: affiche.id,
      ancien: null,
      nouveau: 'IDENTIFIEE',
      parId: identity.userId,
      regle: 'RG-REC-039',
    })
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: affiche.id,
      action: 'CREATION_AFFICHE',
      parId: identity.userId,
      nouvelleValeur: `réception ${String(reception.id)} · dossier ${String(ligne.contNum ?? '—')}`,
    })
    // RG-REC-041 / RG-REC-044 : mouvement de réception (« affiche reçue » = oui dès l'arrivée, RG-X-005).
    await enregistrerMouvement(tx, identity, {
      permission: 'reception.valider',
      afficheId: affiche.id,
      type: 'RECEPTION',
      quantite: l.quantite,
      date: maintenant,
      receptionId: reception.id,
      livraisonId: livraison.id,
    })
    // RG-REC-042 / RG-REC-032 : rattachement à la ligne choisie, avec quantité, mode BL (Q-184).
    // RG-X-001 / RG-COO-002 : Circé propose (le lien) ; aucune validation admin n'est posée à la réception.
    await rattacher(tx, identity, {
      permission: 'reception.valider',
      afficheId: affiche.id,
      ligneAttendueId: ligne.id,
      quantite: l.quantite,
      mode: l.mode,
    })
    creees.push({
      id: affiche.id,
      ligneAttendueId: ligne.id,
      quantite: l.quantite,
      complement: false,
    })
  }
  await ecrireJournal(tx, {
    typeEntite: 'RECEPTION',
    entiteId: reception.id,
    action: 'CREATION_RECEPTION',
    parId: identity.userId,
    nouvelleValeur: `BL ${input.numeroBl.trim()} · ${String(creees.length)} ligne(s)`,
  })
  // RG-X-003 : « n unité(s) prête(s) à produire » (EN_ATTENTE → PRET, recalcul dans la même transaction).
  const unitesPretes = unitesDevenuesPretes(
    unitesAvant,
    await statutsTrainsDesDossiers(
      tx,
      lignes.map((l) => l.contNum),
    ),
  )
  if (input.nonConformite)
    await declarerConstatReception(
      tx,
      identity,
      reception.id,
      creees.map((a) => a.id),
      input.nonConformite,
    )
  return {
    receptionId: reception.id,
    affiches: creees,
    lignesIgnorees: v.lignesIgnorees,
    unitesPretes,
    message: `Réception R${String(reception.id)} : ${String(creees.length)} ligne(s), « affiche reçue » = oui dès l’arrivée. La palette passe à l’étape 2 (contrôle).${messageUnitesPretes(unitesPretes)}`,
  }
}

// RG-REC-047 / RG-REC-048 : intitulé déjà saisi par l'autre plateforme pour le même dossier (1er qui a parlé).
export async function intituleSuggere(tx: Tx, ligneAttendueId: number) {
  const ligne = await tx.receptionAttendue.findUnique({ where: { id: ligneAttendueId } })
  if (!ligne?.contNum || ligne.theme) return null
  const affiche = await tx.affiche.findFirst({
    where: {
      contNum: ligne.contNum,
      plateformeId: { not: ligne.plateformeId },
      theme: { not: null },
    },
    orderBy: { id: 'asc' },
    include: { plateforme: { select: { nom: true } } },
  })
  return affiche?.theme
    ? { intitule: affiche.theme, site: affiche.plateforme.nom, afficheId: affiche.id }
    : null
}

// RG-REC-047 / RG-REC-048 : lecture de l'intitulé suggéré, avec droit (RG-REC-002) et périmètre (RG-REC-001).
export async function lireIntituleSuggere(db: Db, identity: Identity, ligneAttendueId: number) {
  assertDroitReception(identity, 'reception.saisir')
  const ligne = await db.receptionAttendue.findUnique({ where: { id: ligneAttendueId } })
  if (!ligne) throw new NotFoundError('Ligne attendue introuvable')
  assertPerimetreReception(identity, ligne.plateformeId)
  return intituleSuggere(db, ligneAttendueId)
}
