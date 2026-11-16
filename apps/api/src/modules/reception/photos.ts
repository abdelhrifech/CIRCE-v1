// RG-REC-026 / RG-REC-027 : photo du BL (et d'une affiche) — stockage, consultation, contrôles.
// Q-311 (HYPOTHÈSE DATA) : octets en base (bytea / BLOB), métadonnées à côté ; Q-113 : types et taille.
import { TAILLE_MAX_PHOTO, TYPES_PHOTO, type EnvoiPhoto, type Photo } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { canAccessPlateforme } from '../../core/permissions/permissions.ts'
import type { Tx } from '../../core/transaction.ts'
import { assertDroitReception } from './permissions.ts'

const invalide = (message: string) =>
  new ValidationError(message, { code: 'REC_PHOTO_INVALIDE', regle: 'RG-REC-027' })

// RG-REC-027 : type et taille validés (le legacy n'en contrôlait aucun) ; auteur tracé (RG-REC-004).
export async function enregistrerPhoto(
  tx: Tx,
  identity: Identity,
  input: EnvoiPhoto,
): Promise<Photo> {
  assertDroitReception(identity, 'reception.saisir')
  if (!(TYPES_PHOTO as readonly string[]).includes(input.mimeType)) {
    throw invalide(`Type de fichier refusé (${input.mimeType}) : JPEG, PNG, WebP ou PDF.`)
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.contenuBase64))
    throw invalide('Contenu du fichier illisible.')
  const octets = Buffer.from(input.contenuBase64, 'base64')
  if (octets.length === 0) throw invalide('Le fichier est vide.')
  if (octets.length > TAILLE_MAX_PHOTO) throw invalide('Le fichier dépasse 10 Mo.')
  const photo = await tx.photo.create({
    data: {
      intitule: input.intitule,
      mimeType: input.mimeType,
      fichier: octets,
      taille: octets.length,
      extension: input.intitule.includes('.') ? (input.intitule.split('.').pop() ?? null) : null,
      createdById: identity.userId,
    },
  })
  return { id: photo.id, intitule: photo.intitule, mimeType: input.mimeType, taille: octets.length }
}

// RG-REC-027 : consultation (« Voir le BL ») avec le type MIME EXACT (le legacy renvoyait toujours du PDF).
// Accès : auteur de la photo, ou photo d'une réception / d'une affiche du périmètre (RG-REC-001).
export async function lirePhoto(db: Db, identity: Identity, id: number) {
  assertDroitReception(identity, 'affiche.consulter')
  const photo = await db.photo.findUnique({
    where: { id },
    include: {
      receptions: { select: { plateformeId: true } },
      affiches: { select: { plateformeId: true } },
    },
  })
  if (!photo?.fichier) throw new NotFoundError('Photo introuvable')
  // BUS-13 : une photo de complément reste consultable par la Préproduction et le commerce du site.
  const controlesBus = await db.busControleReception.findMany({
    where: { photoId: id },
    select: { receptionId: true },
  })
  const receptionsBus = await db.reception.findMany({
    where: { id: { in: controlesBus.map((c) => c.receptionId) } },
    select: { plateformeId: true },
  })
  const plateformes = [...photo.receptions, ...photo.affiches, ...receptionsBus].map(
    (x) => x.plateformeId,
  )
  const autorise =
    photo.createdById === identity.userId ||
    plateformes.some((p) => canAccessPlateforme(identity, p))
  if (!autorise) {
    throw new ForbiddenError("Cette photo n'est pas dans votre périmètre.", {
      code: 'REC_PERIMETRE_INTERDIT',
      regle: 'RG-REC-001',
    })
  }
  return {
    mimeType: photo.mimeType ?? 'application/octet-stream',
    octets: Buffer.from(photo.fichier),
    intitule: photo.intitule,
  }
}
