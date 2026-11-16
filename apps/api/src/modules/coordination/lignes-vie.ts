// COO-P05 — opérations de vie d'une ligne attendue partagées par l'alimentation (alimentation-lignes.ts) et la
// mise à jour des lignes (lignes-maj.ts) : fermeture (RG-COO-087 / 089) et déplacement d'un lien (RG-COO-088).
// Acteur : Circé (automatique). Toute écriture passe par le verrou de version (CLAUDE.md §6).
import { formatSemaineIso } from '@circe/shared'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { ReceptionAttendue } from '../../generated/prisma/client.ts'
import { recalculerLigne } from '../reception/lignes.ts'
import { effetsLigneModifiee } from './effets-validation.ts'
import { CIRCE_AUTOMATIQUE } from './integration-commun.ts'
import { COO } from './permissions.ts'

const VERROU_LIEN = { code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-088' } as const

// RG-COO-087 / 089 : fermeture = ANNULEE + date, jamais de suppression ; historique et journal ; RG-COO-032 :
// alerte si une affiche y reste rattachée (effetsLigneModifiee).
export async function fermerLigne(
  tx: Tx,
  ligne: ReceptionAttendue,
  le: Date,
  motif: string,
  regle: string,
) {
  await updateWithVersion({
    expectedVersion: ligne.version,
    update: (where) =>
      tx.receptionAttendue.updateMany({
        where: { id: ligne.id, etatLigne: 'ACTIVE', ...where },
        data: { etatLigne: 'ANNULEE', fermeeLe: le, ...bumpVersion },
      }),
    ...COO.version,
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'LIGNE_ATTENDUE',
    entiteId: ligne.id,
    ancien: 'ACTIVE',
    nouveau: 'ANNULEE',
    parId: null,
    motif,
    regle,
  })
  await ecrireJournal(tx, {
    typeEntite: 'LIGNE_ATTENDUE',
    entiteId: ligne.id,
    action: 'FERMETURE_LIGNE',
    parId: null,
    ancienneValeur: 'ACTIVE',
    nouvelleValeur: 'ANNULEE',
    complement: `${CIRCE_AUTOMATIQUE} : ${motif}`,
    donnees: {
      dossier: ligne.contNum,
      semaine: formatSemaineIso({ annee: ligne.semAnnee, semaine: ligne.semNum }),
    },
  })
  const qte = ligne.source === 'PREPA' ? (ligne.qtePrepa ?? ligne.qteBc) : ligne.qteBc
  return effetsLigneModifiee(
    tx,
    { id: ligne.id, theme: ligne.theme, qte, etatLigne: 'ACTIVE' },
    { theme: ligne.theme, qte, etatLigne: 'ANNULEE' },
  )
}

// RG-COO-085 / RG-COO-088 : un lien est DÉPLACÉ, jamais perdu : retiré (conservé inactif, avec quand) puis
// recréé sur la ligne cible avec la même quantité et le même mode (verrou de version sur le lien, le lien cible
// et l'affiche). HYPOTHÈSE Q-187 (4) : la validation admin de l'affiche est conservée (le déplacement ne se fait
// que vers un thème sans ambiguïté) ; la feuille de stock est à refaire (RG-REC-129, thème changé).
export async function deplacerLien(
  tx: Tx,
  lienId: number,
  versLigneId: number,
  le: Date,
  motif = 'IP saisies, visuel provisoire fermé (RG-COO-085)',
) {
  const lien = await tx.afficheAttendue.findUniqueOrThrow({ where: { id: lienId } })
  await updateWithVersion({
    expectedVersion: lien.version,
    update: (where) =>
      tx.afficheAttendue.updateMany({
        where: { id: lienId, actif: true, ...where },
        data: { actif: false, retireLe: le, retirePar: null, ...bumpVersion },
      }),
    ...VERROU_LIEN,
  })
  // Une affiche déjà liée à la ligne cible : les quantités sont additionnées sur le lien existant.
  const existant = await tx.afficheAttendue.findFirst({
    where: { afficheId: lien.afficheId, ligneAttendueId: versLigneId, actif: true },
  })
  if (existant) {
    await updateWithVersion({
      expectedVersion: existant.version,
      update: (where) =>
        tx.afficheAttendue.updateMany({
          where: { id: existant.id, actif: true, ...where },
          data: { quantite: existant.quantite + lien.quantite, ...bumpVersion },
        }),
      ...VERROU_LIEN,
    })
  } else {
    await tx.afficheAttendue.create({
      data: {
        afficheId: lien.afficheId,
        ligneAttendueId: versLigneId,
        quantite: lien.quantite,
        mode: lien.mode,
        creePar: null,
      },
    })
  }
  const affiche = await tx.affiche.findUniqueOrThrow({
    where: { id: lien.afficheId },
    select: { version: true },
  })
  await updateWithVersion({
    expectedVersion: affiche.version,
    update: (where) =>
      tx.affiche.updateMany({
        where: { id: lien.afficheId, ...where },
        data: { feuilleARefaire: true, ...bumpVersion },
      }),
    ...VERROU_LIEN,
  })
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: lien.afficheId,
    action: 'DEPLACEMENT_RATTACHEMENT',
    parId: null,
    ancienneValeur: `ligne ${String(lien.ligneAttendueId)} : ${String(lien.quantite)}`,
    nouvelleValeur: `ligne ${String(versLigneId)} : ${String(lien.quantite)}`,
    complement: `${CIRCE_AUTOMATIQUE} : ${motif}`,
    donnees: { lienId },
  })
  await recalculerLigne(tx, null, lien.ligneAttendueId)
  await recalculerLigne(tx, null, versLigneId)
}
