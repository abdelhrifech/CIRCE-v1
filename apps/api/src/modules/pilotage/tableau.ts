import type { z } from 'zod'
import {
  DispositionTableauSchema,
  TABLEAU_DEFAUT,
  formatSemaineIso,
  semaineIsoDe,
  type DonneesTableau,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import { identiteDuSite, type Identity } from '../../core/identity.ts'
import { assertPermission } from '../../core/permissions/permissions.ts'
import { ConflictError } from '../../core/errors.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import { listerDossiers } from '../coordination/dossiers.ts'
import { groupesAVerifier } from '../coordination/themes.ts'
import { listerAffiches } from '../reception/affiches.ts'
import { listerAlertesPilotage } from '../alertes/service.ts'

type Ligne = DonneesTableau['sources']['sansIP'][number]
// EX-NEW-PIL-001 : disposition propre à l'utilisateur authentifié, jamais à l'identité passée par le client.
export async function lireDisposition(db: Db | Tx, identity: Identity) {
  assertPermission(identity, 'validation_admin.valider')
  const row = await db.tableauPersonnel.findUnique({ where: { userId: identity.userId } })
  return DispositionTableauSchema.parse({
    version: row?.version ?? 0,
    carres: row ? (JSON.parse(row.carres) as unknown) : TABLEAU_DEFAUT,
  })
}
export async function sauverDisposition(
  tx: Tx,
  identity: Identity,
  input: z.infer<typeof DispositionTableauSchema>,
) {
  assertPermission(identity, 'validation_admin.valider')
  const row = await tx.tableauPersonnel.findUnique({ where: { userId: identity.userId } })
  const carres = JSON.stringify(input.carres)
  if (!row) {
    if (input.version !== 0) throw new ConflictError('Rechargez votre tableau de bord.')
    await tx.tableauPersonnel.create({ data: { userId: identity.userId, carres } })
  } else
    await updateWithVersion({
      expectedVersion: input.version,
      update: (where) =>
        tx.tableauPersonnel.updateMany({
          where: { userId: identity.userId, ...where },
          data: { carres, ...bumpVersion },
        }),
    })
  await ecrireJournal(tx, {
    typeEntite: 'TABLEAU_PERSONNEL',
    entiteId: identity.userId,
    action: 'MODIFICATION_PARAMETRE',
    parId: identity.userId,
    ancienneValeur: row?.carres,
    nouvelleValeur: carres,
  })
  return lireDisposition(tx, identity)
}
// EX-NEW-PIL-001 : mêmes services pour listes, compteurs et écrans d'action ; parcours de toutes les pages.
export async function donneesTableau(db: Db, identity: Identity): Promise<DonneesTableau> {
  assertPermission(identity, 'validation_admin.valider')
  const i = identiteDuSite(identity)
  const dossiers: Awaited<ReturnType<typeof listerDossiers>>['items'] = []
  const affiches: Awaited<ReturnType<typeof listerAffiches>>['items'] = []
  for (let page = 1; ; page++) {
    const r = await listerDossiers(db, i, { page, pageSize: 100 })
    dossiers.push(...r.items)
    if (page * 100 >= r.total) break
  }
  for (let page = 1; ; page++) {
    const r = await listerAffiches(db, i, { page, pageSize: 100 })
    affiches.push(...r.items)
    if (page * 100 >= r.total) break
  }
  const ids = dossiers.map((d) => d.dossier)
  const lignes = await db.receptionAttendue.findMany({
    where: {
      contNum: { in: ids },
      ...(i.perimetre.toutesPlateformes ? {} : { plateformeId: { in: i.perimetre.plateformeIds } }),
      etatLigne: 'ACTIVE',
    },
    select: {
      contNum: true,
      theme: true,
      format: true,
      atelierId: true,
      semAnnee: true,
      semNum: true,
      rattachements: { where: { actif: true }, select: { afficheId: true } },
    },
  })
  const contexte = (nums: number[]) => {
    const ls = lignes.filter((l) => l.contNum !== null && nums.includes(l.contNum))
    return {
      semaines: [
        ...new Set(ls.map((l) => formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }))),
      ],
      atelierIds: [...new Set(ls.flatMap((l) => (l.atelierId === null ? [] : [l.atelierId])))],
      format: [...new Set(ls.flatMap((l) => (l.format ? [l.format] : [])))].join(' / '),
    }
  }
  const ligneD = (d: (typeof dossiers)[number]): Ligne => ({
    id: `D-${d.id}`,
    dossier: [d.dossier],
    annonceur: d.annonceur ?? '',
    theme: '',
    ...contexte([d.dossier]),
    details: d.deadlinePrepa
      ? new Date(d.deadlinePrepa).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
      : '',
    lien: `/coordination?fiche=${d.id}`,
  })
  const ligneA = (a: (typeof affiches)[number]): Ligne => ({
    id: String(a.id),
    dossier: a.dossiers,
    annonceur: a.annonceur ?? '',
    theme: a.theme ?? '',
    ...contexte(a.dossiers),
    semaines: a.departs,
    format: a.format,
    details: a.validation === 'A_CONFIRMER_DOUTE' ? 'Doute de rattachement' : '',
    lien:
      a.statut === 'ORPHELINE'
        ? `/reception/inconnues?id=${a.id}`
        : `/reception/affiches?affiche=${a.id}`,
  })
  const sansIp = new Set(
    lignes.filter((l) => l.theme === null).flatMap((l) => l.rattachements.map((r) => r.afficheId)),
  )
  const groupes = await groupesAVerifier(db, i, new Date())
  const maintenant = Date.now()
  const semaineCourante = formatSemaineIso(semaineIsoDe(new Date(maintenant)))
  const dossiersAVenir = dossiers.filter(
    (d) =>
      d.preparation !== 'ANNULE' &&
      contexte([d.dossier]).semaines.some((s) => s >= semaineCourante),
  )
  const sources: DonneesTableau['sources'] = {
    sansIP: affiches.filter((a) => a.statut !== 'ORPHELINE' && sansIp.has(a.id)).map(ligneA),
    nonConforme: dossiers
      .filter((d) => d.preparation === 'PREPARATION_RECUE' && d.ecart !== null && d.ecart !== 0)
      .map((d) => ({ ...ligneD(d), details: `Écart Broadcast / Circé : ${d.ecart}` })),
    echeance: dossiersAVenir
      .filter((d) => d.preparation === 'A_TRAITER' && d.deadlineDepassee)
      .map(ligneD),
    j3: dossiersAVenir
      .filter(
        (d) =>
          d.preparation === 'A_TRAITER' &&
          d.deadlinePrepa !== null &&
          new Date(d.deadlinePrepa).getTime() > maintenant &&
          new Date(d.deadlinePrepa).getTime() <= maintenant + 3 * 864e5,
      )
      .map(ligneD),
    va: affiches.filter((a) => a.validation.startsWith('A_CONFIRMER')).map(ligneA),
    iok: dossiers
      .filter((d) => d.instructions.some((ins) => ins.statut === 'EN_COURS'))
      .map((d) => ({
        ...ligneD(d),
        details: d.instructions.flatMap((ins) => ins.motifs).join(', '),
      })),
    inconnues: affiches.filter((a) => a.statut === 'ORPHELINE').map(ligneA),
    themes: groupes.themes.map((g) => ({
      id: g.cle,
      dossier: g.dossiers,
      annonceur: g.annonceur,
      theme: g.libelles.join(' / '),
      ...contexte(g.dossiers),
      details: 'Thèmes proches à vérifier',
      lien: `/coordination/themes?dossier=${g.dossiers[0] ?? ''}`,
    })),
  }
  const alertes = (await listerAlertesPilotage(db, i, { etat: 'OUVERTES' })).alertes.map((a) => ({
    id: a.cle,
    dossier: a.dossiers,
    annonceur: dossiers.find((d) => a.dossiers.includes(d.dossier))?.annonceur ?? '',
    theme: a.titre,
    ...contexte(a.dossiers),
    details: a.message,
    lien: a.lien,
  }))
  return { sources, alertes }
}
