// RG-REC-203 : modale « Visuel » — données de la ligne attendue disponibles dans Circé.
// Position dans le train, préparation et image Broadcast : état des réservations (D-10), non disponibles.
import { formatSemaineIso, type VisuelLigne } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { attenduDe } from './lignes.ts'
import { assertDroitReception, assertPerimetreReception } from './permissions.ts'

export async function lireVisuel(db: Db, identity: Identity, id: number): Promise<VisuelLigne> {
  assertDroitReception(identity, 'reception.attendues.consulter')
  const ligne = await db.receptionAttendue.findUnique({
    where: { id },
    include: {
      plateforme: { select: { nom: true } },
      atelier: { select: { libelle: true } },
      rattachements: {
        where: { actif: true },
        include: { affiche: { select: { id: true, allee: true, rayon: true } } },
      },
    },
  })
  if (!ligne) throw new NotFoundError('Ligne attendue introuvable')
  assertPerimetreReception(identity, ligne.plateformeId)
  return {
    id: ligne.id,
    dossier: ligne.contNum,
    da: ligne.idDaChapeau,
    site: ligne.plateforme.nom,
    atelier: ligne.atelier?.libelle ?? null,
    format: ligne.format,
    depart: formatSemaineIso({ annee: ligne.semAnnee, semaine: ligne.semNum }),
    annonceur: ligne.annonceur,
    theme: ligne.theme,
    repiquage: ligne.repiquage,
    recu: ligne.rattachements.reduce((s, r) => s + r.quantite, 0),
    attendu: attenduDe(ligne),
    affiches: ligne.rattachements.map((r) => r.affiche).sort((a, b) => a.id - b.id),
    exclusion: ligne.themeExclu,
  }
}
