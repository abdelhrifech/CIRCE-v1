// Déclencheur des RG-COO-030 / 031 : mise à jour d'une ligne attendue ACTIVE par la lecture de Broadcast
// (thème, quantité BC) ou par l'intégration de la prépa (quantité prépa, IP saisies), dans la transaction de
// l'appelant. Le reçu et le statut de la ligne sont recalculés (RG-REC-017 / 018) et les effets sur les
// affiches rattachées appliqués (effetsLigneModifiee). Les intégrations Broadcast / prépa des lignes doivent
// passer ici (aucune autre écriture du thème ou des quantités d'une ligne).
import { formatSemaineIso } from '@circe/shared'
import { NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { recalculerLigne } from '../reception/lignes.ts'
import { normaliserTheme } from './validation-admin.ts'
import { effetsLigneModifiee } from './effets-validation.ts'
import { COO } from './permissions.ts'
import { deplacerLien, fermerLigne } from './lignes-vie.ts'

export interface MajLigne {
  theme?: string | null
  qteBc?: number | null
  qtePrepa?: number | null
  /** RG-COO-086 : bascule BC → PREPA à l'arrivée de la prépa (les liens ne bougent pas). */
  source?: 'BC' | 'PREPA'
  /** COO-P05 (alimentation) : champs d'information mis à jour sans effet sur les affiches. */
  idTheme?: number | null
  annonceur?: string | null
  dateVueBc?: Date
  nonVueLe?: Date | null
  idDaChapeau?: number | null
  atelierId?: number | null
}

export interface ResultatMajLigne {
  ligneId: number
  alertes: Awaited<ReturnType<typeof effetsLigneModifiee>>
  ignoree: boolean
}

export async function mettreAJourLigneAttendue(
  tx: Tx,
  ligneId: number,
  maj: MajLigne,
  origine: 'BROADCAST' | 'PREPA',
  /** Utilisateur à l'origine (ex. « Appliquer la version Broadcast ») ; null = traitement automatique. */
  identity: Identity | null = null,
): Promise<ResultatMajLigne> {
  const l = await tx.receptionAttendue.findUnique({ where: { id: ligneId } })
  if (!l) throw new NotFoundError('Ligne attendue introuvable')
  // HYPOTHÈSE Q-186 (13) : une ligne fermée (ANNULEE) n'est pas mise à jour ; elle est IGNORÉE et tracée au
  // journal, sans faire échouer l'intégration (la prépa et ses autres lignes sont intégrées).
  if (l.etatLigne !== 'ACTIVE') {
    await ecrireJournal(tx, {
      typeEntite: 'LIGNE_ATTENDUE',
      entiteId: ligneId,
      action: 'RENVOI_BROADCAST_IGNORE',
      parId: identity?.userId ?? null,
      nouvelleValeur: 'ligne fermée : mise à jour ignorée',
      complement: origine === 'BROADCAST' ? 'Broadcast' : 'Préparation',
      donnees: { maj },
    })
    return { ligneId, alertes: [], ignoree: true as const }
  }
  const theme = maj.theme === undefined ? l.theme : maj.theme
  const qteBc = maj.qteBc === undefined ? l.qteBc : maj.qteBc
  const qtePrepa = maj.qtePrepa === undefined ? l.qtePrepa : maj.qtePrepa
  const source = maj.source ?? l.source
  // RG-COO-080 (HYPOTHÈSE Q-187 (14)) : un thème renommé qui prend la clé d'une AUTRE ligne active (même
  // plateforme × dossier × support × bandeau × semaine) ne crée jamais de doublon : la ligne est FUSIONNÉE dans
  // la ligne occupante (quantités additionnées comme deux DA, liens déplacés, ligne renommée fermée).
  const nouvelleCle = theme === null || theme.trim() === '' ? null : normaliserTheme(theme)
  if (nouvelleCle !== (l.themeCle === '' ? null : l.themeCle)) {
    const occupante = await tx.receptionAttendue.findFirst({
      where: {
        id: { not: ligneId },
        plateformeId: l.plateformeId,
        contNum: l.contNum,
        supportId: l.supportId,
        idThemeBandeau: l.idThemeBandeau,
        semAnnee: l.semAnnee,
        semNum: l.semNum,
        etatLigne: 'ACTIVE',
        ...(nouvelleCle === null
          ? { OR: [{ themeCle: null }, { themeCle: '' }] }
          : { themeCle: nouvelleCle }),
      },
    })
    if (occupante) {
      const le = new Date()
      // RG-COO-030 : les affiches validées de la ligne renommée ont changé de thème : validation à refaire.
      const alertes = await effetsLigneModifiee(
        tx,
        { id: ligneId, theme: l.theme, qte: null, etatLigne: 'ACTIVE' },
        { theme, qte: null, etatLigne: 'ACTIVE' },
      )
      const liens = await tx.afficheAttendue.findMany({
        where: { ligneAttendueId: ligneId, actif: true },
      })
      for (const lien of liens)
        await deplacerLien(
          tx,
          lien.id,
          occupante.id,
          le,
          `fusion de lignes de même clé (RG-COO-080)`,
        )
      const somme = (a: number | null, b: number | null) =>
        a === null && b === null ? null : (a ?? 0) + (b ?? 0)
      const fusion: ResultatMajLigne = await mettreAJourLigneAttendue(
        tx,
        occupante.id,
        {
          qteBc: somme(occupante.qteBc, qteBc),
          qtePrepa: somme(occupante.qtePrepa, qtePrepa),
          ...(source === 'PREPA' ? { source: 'PREPA' as const } : {}),
        },
        origine,
        identity,
      )
      const courante = await tx.receptionAttendue.findUniqueOrThrow({ where: { id: ligneId } })
      await fermerLigne(
        tx,
        courante,
        le,
        `fusionnée dans la ligne ${String(occupante.id)} (même clé)`,
        'RG-COO-080',
      )
      return {
        ligneId: occupante.id,
        alertes: [...alertes, ...fusion.alertes],
        ignoree: false as const,
      }
    }
  }
  // RG-COO-084 : une ligne provisoire qui reçoit un thème n'est plus provisoire.
  const provisoire = l.provisoire && theme === null
  await updateWithVersion({
    expectedVersion: l.version,
    update: (where) =>
      tx.receptionAttendue.updateMany({
        where: { id: ligneId, ...where },
        data: {
          theme,
          themeCle: theme === null ? null : normaliserTheme(theme),
          qteBc,
          qtePrepa,
          source,
          provisoire,
          ...(maj.idTheme !== undefined ? { idTheme: maj.idTheme } : {}),
          ...(maj.annonceur !== undefined ? { annonceur: maj.annonceur } : {}),
          ...(maj.dateVueBc !== undefined ? { dateVueBc: maj.dateVueBc } : {}),
          ...(maj.nonVueLe !== undefined ? { nonVueLe: maj.nonVueLe } : {}),
          ...(maj.idDaChapeau !== undefined ? { idDaChapeau: maj.idDaChapeau } : {}),
          ...(maj.atelierId !== undefined ? { atelierId: maj.atelierId } : {}),
          updatedById: identity?.userId ?? null,
          ...bumpVersion,
        },
      }),
    ...COO.version,
  })
  await recalculerLigne(tx, identity, ligneId)
  const qte = (x: { source: string; qteBc: number | null; qtePrepa: number | null }) =>
    x.source === 'PREPA' ? (x.qtePrepa ?? x.qteBc) : (x.qteBc ?? x.qtePrepa)
  const alertes = await effetsLigneModifiee(
    tx,
    { id: ligneId, theme: l.theme, qte: qte(l), etatLigne: 'ACTIVE' },
    { theme, qte: qte({ source, qteBc, qtePrepa }), etatLigne: 'ACTIVE' },
  )
  if (source !== l.source) {
    // RG-COO-086 : bascule de source tracée (les liens affiche ↔ ligne ne changent pas).
    await ecrireJournal(tx, {
      typeEntite: 'LIGNE_ATTENDUE',
      entiteId: ligneId,
      action: 'ALIMENTATION_LIGNE',
      parId: identity?.userId ?? null,
      ancienneValeur: l.source,
      nouvelleValeur: source,
      complement: 'Arrivée de la prépa (RG-COO-086)',
    })
  }
  if (theme !== l.theme || qteBc !== l.qteBc || qtePrepa !== l.qtePrepa) {
    await ecrireJournal(tx, {
      typeEntite: 'LIGNE_ATTENDUE',
      entiteId: ligneId,
      action: theme !== l.theme ? 'MODIFICATION_THEME' : 'MODIFICATION_DOSSIER',
      parId: identity?.userId ?? null,
      ancienneValeur: `${l.theme ?? '—'} · BC ${String(l.qteBc ?? '—')} · prépa ${String(l.qtePrepa ?? '—')}`,
      nouvelleValeur: `${theme ?? '—'} · BC ${String(qteBc ?? '—')} · prépa ${String(qtePrepa ?? '—')}`,
      complement: origine === 'BROADCAST' ? 'Broadcast' : 'Préparation',
      donnees: {
        dossier: l.contNum,
        semaine: formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }),
        alertes,
      },
    })
  }
  return { ligneId, alertes, ignoree: false as const }
}
