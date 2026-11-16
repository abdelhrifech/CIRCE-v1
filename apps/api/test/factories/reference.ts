import type { Db } from '../../src/core/db.ts'
import type { Prisma } from '../../src/generated/prisma/client.ts'
import { TypeAtelier } from '../../src/generated/prisma/client.ts'
import { next } from './sequence.ts'

export function createPlateforme(
  db: Db,
  data: Partial<Prisma.PlateformeUncheckedCreateInput> = {},
) {
  const n = next()
  return db.plateforme.create({ data: { nom: `Plateforme test ${n}`, ...data } })
}

export async function createAtelier(
  db: Db,
  data: Partial<Prisma.AtelierUncheckedCreateInput> = {},
) {
  const plateformeId = data.plateformeId ?? (await createPlateforme(db)).id
  const n = next()
  return db.atelier.create({
    data: { libelle: `Atelier test ${n}`, type: TypeAtelier.FIXE, ...data, plateformeId },
  })
}

export function createSupport(
  db: Db,
  data: Partial<Prisma.CategorieSupportUncheckedCreateInput> = {},
) {
  const n = next()
  return db.categorieSupport.create({ data: { nom: `Support test ${n}`, ...data } })
}

export function createSurface(db: Db, data: Partial<Prisma.SurfaceUncheckedCreateInput> = {}) {
  const n = next()
  return db.surface.create({ data: { libelle: `Surface test ${n}`, valeur: n, ...data } })
}

export function createTypePreparation(
  db: Db,
  data: Partial<Prisma.TypePreparationUncheckedCreateInput> = {},
) {
  const n = next()
  return db.typePreparation.create({ data: { libelle: `Type prépa test ${n}`, ...data } })
}

export function createImprimeur(db: Db, data: Partial<Prisma.ImprimeurUncheckedCreateInput> = {}) {
  const n = next()
  return db.imprimeur.create({ data: { libelle: `Imprimeur test ${n}`, ...data } })
}

export function createLivreur(db: Db, data: Partial<Prisma.LivreurUncheckedCreateInput> = {}) {
  const n = next()
  return db.livreur.create({ data: { libelle: `Livreur test ${n}`, ...data } })
}

export function createDestinataire(
  db: Db,
  data: Partial<Prisma.DestinataireUncheckedCreateInput> = {},
) {
  const n = next()
  return db.destinataire.create({ data: { nomOrigine: `Destinataire test ${n}`, ...data } })
}

export async function createRouleur(
  db: Db,
  data: Partial<Prisma.RouleurUncheckedCreateInput> = {},
) {
  const n = next()
  return db.rouleur.create({ data: { nom: `Rouleur test ${n}`, ...data } })
}

export function createJourDepart(
  db: Db,
  data: Partial<Prisma.JourDepartUncheckedCreateInput> = {},
) {
  const n = next()
  return db.jourDepart.create({ data: { libelle: `Jour test ${n}`, ...data } })
}

export function createParametre(db: Db, data: Partial<Prisma.ParametreUncheckedCreateInput> = {}) {
  const n = next()
  return db.parametre.create({ data: { cle: `test.parametre.${n}`, valeur: '1', ...data } })
}
