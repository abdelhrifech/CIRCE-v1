import type { z } from 'zod'
import type { J3AjoutSchema, J3MajSchema } from '@circe/shared'
import { J3DonneesSchema, lireSemaineIso, type J3Resultat } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import { identiteDuSite, type Identity } from '../../core/identity.ts'
import {
  assertPermission,
  assertPlateforme,
  canAccessAtelier,
} from '../../core/permissions/permissions.ts'
import { BusinessError, NotFoundError } from '../../core/errors.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import { attenduDe } from '../reception/lignes.ts'

type Client = Db | Tx
const FIXE_SCRO = ['2 m² fixe', '2 m² scro', '4 m² scro', '8 m² scro']
const COLLE = ['12 m²', '8 m²', '4 m²']
const normaliser = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
// EX-NEW-J3-001 : Wissous 1 et 2 partagent la plateforme ; seule la famille de formats les distingue.
async function candidats(db: Client, identity: Identity, semaine: string) {
  assertPermission(identity, 'j3.gerer')
  const i = identiteDuSite(identity),
    sem = lireSemaineIso(semaine)
  const plateformes = await db.plateforme.findMany({
    where: i.perimetre.toutesPlateformes ? {} : { id: { in: i.perimetre.plateformeIds } },
  })
  const sections: J3Resultat['sections'] = []
  for (const plateforme of plateformes) {
    const nom = normaliser(plateforme.nom)
    const ids = nom.includes('wissous')
      ? (['wis1', 'wis2'] as const)
      : nom.includes('nimes')
        ? (['nim'] as const)
        : []
    if (!ids.length) continue
    const lignes = await db.receptionAttendue.findMany({
      where: {
        plateformeId: plateforme.id,
        semAnnee: sem.annee,
        semNum: sem.semaine,
        etatLigne: 'ACTIVE',
        themeExclu: false,
      },
      include: {
        support: true,
        atelier: true,
        rattachements: { where: { actif: true }, select: { quantite: true } },
      },
    })
    const dossiers = await db.dossier.findMany({
      where: {
        contNum: {
          in: [...new Set(lignes.flatMap((l) => (l.contNum === null ? [] : [l.contNum])))],
        },
        statut: { not: 'ANNULE' },
      },
    })
    for (const id of ids) {
      const formats = id === 'wis2' ? COLLE : FIXE_SCRO
      const liste: J3Resultat['sections'][number]['candidats'] = []
      for (const d of dossiers) {
        const ls = lignes.filter(
          (l) =>
            l.contNum === d.contNum &&
            (l.atelierId === null || canAccessAtelier(i, plateforme.id, l.atelierId)) &&
            (id === 'nim' ||
              (id === 'wis2') ===
                /colle|pliage/.test(
                  normaliser(`${l.format ?? l.support.nom} ${l.atelier?.libelle ?? ''}`),
                )),
        )
        if (!ls.length) continue
        let attendu = 0,
          recu = 0
        const qtes: Record<string, number> = {}
        for (const l of ls) {
          const att = attenduDe(l),
            rec = l.rattachements.reduce((s, r) => s + r.quantite, 0)
          const f = normaliser(l.format ?? l.support.nom)
          const colonne =
            id === 'wis2'
              ? f.includes('12')
                ? COLLE[0]
                : f.includes('8')
                  ? COLLE[1]
                  : COLLE[2]
              : f.includes('fixe')
                ? FIXE_SCRO[0]
                : f.includes('4')
                  ? FIXE_SCRO[2]
                  : f.includes('8')
                    ? FIXE_SCRO[3]
                    : FIXE_SCRO[1]
          if (colonne) qtes[colonne] = (qtes[colonne] ?? 0) + Math.max(0, att - rec)
          attendu += att
          recu += rec
        }
        liste.push({
          dossierId: d.id,
          dossier: d.contNum,
          annonceur: d.annonceur ?? ls[0]?.annonceur ?? '',
          formats: qtes,
          attendu,
          recu,
          reste: Object.values(qtes).reduce((s, q) => s + q, 0),
          depart: semaine,
        })
      }
      liste.sort((a, b) => b.reste - a.reste || a.dossier - b.dossier)
      sections.push({
        id,
        nom: id === 'wis1' ? 'Wissous 1' : id === 'wis2' ? 'Wissous 2' : 'Nîmes',
        plateformeId: plateforme.id,
        formats: [...formats],
        modifieLe: null,
        lignes: [],
        candidats: liste,
      })
    }
  }
  return { semaine, sections }
}
// EX-NEW-J3-001 : premier affichage, seulement les dossiers avec manque ; les suppressions ultérieures restent supprimées.
export async function initialiserJ3(tx: Tx, identity: Identity, semaine: string) {
  const resultat = await candidats(tx, identity, semaine)
  for (const s of resultat.sections) {
    const feuille = await tx.j3Feuille.findUnique({
      where: {
        plateformeId_section_semaine: { plateformeId: s.plateformeId, section: s.id, semaine },
      },
    })
    if (feuille) continue
    const f = await tx.j3Feuille.create({
      data: { plateformeId: s.plateformeId, section: s.id, semaine },
    })
    for (const c of s.candidats.filter((c) => c.reste > 0))
      await tx.j3Ligne.create({
        data: {
          feuilleId: f.id,
          dossierId: c.dossierId,
          donnees: JSON.stringify(J3DonneesSchema.parse({})),
          updatedById: identity.userId,
        },
      })
  }
  return { initialise: true }
}
// EX-NEW-J3-001 : quantités toujours relues de l'EDR ; saisies seulement dans les champs du classeur.
export async function lireJ3(db: Client, identity: Identity, semaine: string): Promise<J3Resultat> {
  const resultat = await candidats(db, identity, semaine)
  for (const s of resultat.sections) {
    const f = await db.j3Feuille.findUnique({
      where: {
        plateformeId_section_semaine: { plateformeId: s.plateformeId, section: s.id, semaine },
      },
      include: { lignes: { orderBy: { id: 'asc' } } },
    })
    s.modifieLe = f?.updatedAt.toISOString() ?? null
    for (const row of f?.lignes ?? []) {
      const candidat = s.candidats.find((c) => c.dossierId === row.dossierId)
      if (candidat)
        s.lignes.push({
          id: row.id,
          version: row.version,
          candidat,
          donnees: J3DonneesSchema.parse(JSON.parse(row.donnees)),
        })
    }
  }
  return resultat
}
export async function ajouterJ3(tx: Tx, identity: Identity, input: z.infer<typeof J3AjoutSchema>) {
  const scope = (await candidats(tx, identity, input.semaine)).sections.find(
    (s) => s.id === input.section && s.plateformeId === input.plateformeId,
  )
  if (!scope) throw new BusinessError('Section J-3 hors de votre périmètre.')
  if (input.dossierIds.some((id) => !scope.candidats.some((c) => c.dossierId === id)))
    throw new BusinessError('Un dossier ne correspond pas à cette section et à cette semaine.')
  const feuille = await tx.j3Feuille.upsert({
    where: {
      plateformeId_section_semaine: {
        plateformeId: input.plateformeId,
        section: input.section,
        semaine: input.semaine,
      },
    },
    create: { plateformeId: input.plateformeId, section: input.section, semaine: input.semaine },
    update: { updatedAt: new Date() },
  })
  for (const id of new Set(input.dossierIds))
    await tx.j3Ligne.upsert({
      where: { feuilleId_dossierId: { feuilleId: feuille.id, dossierId: id } },
      create: {
        feuilleId: feuille.id,
        dossierId: id,
        donnees: JSON.stringify(J3DonneesSchema.parse({})),
        updatedById: identity.userId,
      },
      update: {},
    })
  await ecrireJournal(tx, {
    typeEntite: 'SUIVI_J3',
    entiteId: feuille.id,
    action: 'MODIFICATION_DOSSIER',
    parId: identity.userId,
    nouvelleValeur: JSON.stringify(input.dossierIds),
    complement: 'Ajout depuis l’EDR vivant',
  })
  return { message: 'Dossiers ajoutés au suivi J-3.' }
}
async function ligneDuPerimetre(db: Client, identity: Identity, id: number) {
  assertPermission(identity, 'j3.gerer')
  const row = await db.j3Ligne.findUnique({ where: { id }, include: { feuille: true } })
  if (!row) throw new NotFoundError('Ligne J-3 introuvable.')
  assertPlateforme(identiteDuSite(identity), row.feuille.plateformeId)
  return row
}
export async function modifierJ3(
  tx: Tx,
  identity: Identity,
  id: number,
  input: z.infer<typeof J3MajSchema>,
) {
  const row = await ligneDuPerimetre(tx, identity, id)
  const donnees = JSON.stringify(input.donnees)
  const version = await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.j3Ligne.updateMany({
        where: { id, ...where },
        data: { donnees, updatedById: identity.userId, ...bumpVersion },
      }),
  })
  await tx.j3Feuille.update({ where: { id: row.feuilleId }, data: { updatedAt: new Date() } })
  await ecrireJournal(tx, {
    typeEntite: 'SUIVI_J3',
    entiteId: id,
    action: 'MODIFICATION_DOSSIER',
    parId: identity.userId,
    ancienneValeur: row.donnees,
    nouvelleValeur: donnees,
  })
  return { version, donnees: input.donnees, modifieLe: new Date().toISOString() }
}
export async function retirerJ3(tx: Tx, identity: Identity, id: number, version: number) {
  const row = await ligneDuPerimetre(tx, identity, id)
  await updateWithVersion({
    expectedVersion: version,
    update: (where) => tx.j3Ligne.updateMany({ where: { id, ...where }, data: { ...bumpVersion } }),
  })
  await tx.j3Ligne.delete({ where: { id } })
  await tx.j3Feuille.update({ where: { id: row.feuilleId }, data: { updatedAt: new Date() } })
  await ecrireJournal(tx, {
    typeEntite: 'SUIVI_J3',
    entiteId: id,
    action: 'MODIFICATION_DOSSIER',
    parId: identity.userId,
    ancienneValeur: row.donnees,
    complement: 'Retirée du tableau J-3, dossier conservé dans l’EDR.',
  })
  return { message: 'Ligne retirée du suivi J-3.' }
}
