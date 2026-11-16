// COO-P06 — retour « reçue et associée » vers Broadcast (RG-COO-134, RG-COO-024, Q-231). Module séparé du
// traitement des flux entrants : seul ce retour lit la validation admin (RG-COO-027 : aucune UM / répartition
// ne dépend de la validation).
import { comparerSemaines, formatSemaineIso, semaineIsoDe, type SemaineIso } from '@circe/shared'
import type { Tx } from '../../core/transaction.ts'
import { lireParametreTexte } from '../reception/parametres.ts'

// ───────────────────────────── Retour vers Broadcast (RG-COO-134 / 024) ─────────────────────────────

export interface LigneRetour {
  afficheId: number
  contNum: number
  semaine: SemaineIso
  idDaChapeau: number | null
  format: string
  quantite: number
  estAssociee: boolean
  idSiteCcf: number
  destinataire: 'CIRCE'
}

/** RG-COO-134 : « 2m2 Scrolling » → « 2m2 » (paramètre « source:cible;… »). */
export function formatRetour(format: string, correspondances: string): string {
  for (const p of correspondances.split(';')) {
    const [de, vers] = p.split(':').map((x) => x.trim())
    if (de && vers !== undefined && de.toLowerCase() === format.trim().toLowerCase()) return vers
  }
  return format
}

// RG-COO-134 : population du retour (semaine courante et suivantes) : (a) affiches liées à une ligne attendue
// NON issue de Broadcast (legacy `FromBroadcast = 0` : source PREPA, HYPOTHÈSE de correspondance Q-188 (5)),
// (b) affiches présentes dans tf_dossier_semaine_depart sans lien vers une telle ligne de la fenêtre ; quantité = somme des mouvements ; EstAssociee = lien ET validée (RG-COO-024, Q-231) ; ligne
// envoyée seulement si DA chapeau OU (dossier ≠ 0 et semaine) ; site CCF déduit de la plateforme
// (référentiel) ; lignes écartées renvoyées pour journalisation.
// RG-X-022 : population du retour « reçue et associée » vers Broadcast.
export async function populationRetour(
  tx: Tx,
  maintenant: Date,
): Promise<{ lignes: LigneRetour[]; ecartees: { afficheId: number; raison: string }[] }> {
  const S = semaineIsoDe(maintenant)
  const correspondances = await lireParametreTexte(tx, 'integration.formatsRetour')
  const lignes: LigneRetour[] = []
  const ecartees: { afficheId: number; raison: string }[] = []
  // Semaine courante et suivantes : le filtre est posé en base (le retour tourne à chaque passage, il ne doit
  // pas lire tout l'historique des affiches).
  const liens = await tx.afficheAttendue.findMany({
    where: {
      actif: true,
      // Legacy p_batch_alimentation_circe_pex_reception.sql : #source = lignes `FromBroadcast` nul ou 0.
      ligneAttendue: {
        source: { not: 'BC' },
        OR: [{ semAnnee: { gt: S.annee } }, { semAnnee: S.annee, semNum: { gte: S.semaine } }],
      },
    },
    include: {
      ligneAttendue: { select: { contNum: true, semAnnee: true, semNum: true, idDaChapeau: true } },
      affiche: {
        select: {
          id: true,
          validationAdmin: true,
          support: { select: { nom: true } },
          plateforme: { select: { idSiteCcf: true } },
        },
      },
    },
  })
  const semaines = await tx.afficheSemaineDepart.findMany({
    where: { OR: [{ annee: { gt: S.annee } }, { annee: S.annee, semaine: { gte: S.semaine } }] },
    include: {
      affiche: {
        select: {
          support: { select: { nom: true } },
          plateforme: { select: { idSiteCcf: true } },
        },
      },
    },
  })
  // Quantité = somme des mouvements : une requête groupée par paquets (limite de variables de SQLite).
  const ids = [...new Set([...liens.map((l) => l.afficheId), ...semaines.map((s) => s.afficheId)])]
  const quantites = new Map<number, number>()
  for (let i = 0; i < ids.length; i += 400) {
    const groupes = await tx.mouvement.groupBy({
      by: ['afficheId'],
      where: { afficheId: { in: ids.slice(i, i + 400) } },
      _sum: { quantite: true },
    })
    for (const g of groupes) quantites.set(g.afficheId, g._sum.quantite ?? 0)
  }
  const quantite = (afficheId: number) => quantites.get(afficheId) ?? 0
  const liees = new Set<number>()
  for (const l of liens) {
    const semaine = { annee: l.ligneAttendue.semAnnee, semaine: l.ligneAttendue.semNum }
    if (comparerSemaines(semaine, S) < 0) continue
    // (b) n'exclut que les affiches liées à une ligne de la fenêtre (legacy : jointure sur #prepa_affiche).
    liees.add(l.afficheId)
    const contNum = l.ligneAttendue.contNum ?? 0
    if (l.ligneAttendue.idDaChapeau === null && contNum === 0) {
      ecartees.push({ afficheId: l.afficheId, raison: 'ni DA chapeau ni n° de dossier' })
      continue
    }
    if (l.affiche.plateforme.idSiteCcf === null) {
      ecartees.push({ afficheId: l.afficheId, raison: 'plateforme sans site CCF' })
      continue
    }
    lignes.push({
      afficheId: l.afficheId,
      contNum,
      semaine,
      idDaChapeau: l.ligneAttendue.idDaChapeau,
      format: formatRetour(l.affiche.support.nom, correspondances),
      quantite: quantite(l.afficheId),
      estAssociee: l.affiche.validationAdmin,
      idSiteCcf: l.affiche.plateforme.idSiteCcf,
      destinataire: 'CIRCE',
    })
  }
  for (const s of semaines) {
    if (liees.has(s.afficheId)) continue
    const semaine = { annee: s.annee, semaine: s.semaine }
    if (comparerSemaines(semaine, S) < 0) continue
    if (!s.dossier) {
      ecartees.push({ afficheId: s.afficheId, raison: 'ni DA chapeau ni n° de dossier' })
      continue
    }
    if (s.affiche.plateforme.idSiteCcf === null) {
      ecartees.push({ afficheId: s.afficheId, raison: 'plateforme sans site CCF' })
      continue
    }
    lignes.push({
      afficheId: s.afficheId,
      contNum: s.dossier,
      semaine,
      idDaChapeau: null,
      format: formatRetour(s.affiche.support.nom, correspondances),
      quantite: quantite(s.afficheId),
      estAssociee: false,
      idSiteCcf: s.affiche.plateforme.idSiteCcf,
      destinataire: 'CIRCE',
    })
  }
  return { lignes, ecartees }
}

export const cleRetour = (l: Pick<LigneRetour, 'afficheId' | 'contNum' | 'semaine'>) =>
  `${String(l.afficheId)}|${String(l.contNum)}|${formatSemaineIso(l.semaine)}`
