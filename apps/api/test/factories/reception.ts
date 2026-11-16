import type { Db } from '../../src/core/db.ts'
import type { Prisma } from '../../src/generated/prisma/client.ts'
import {
  EtatLigne,
  ModeRattachement,
  SourceLigne,
  StatutAffiche,
  StatutLigneAttendue,
  StatutReception,
  TypeMouvement,
} from '../../src/generated/prisma/client.ts'
import { createPlateforme, createSupport } from './reference.ts'
import { next } from './sequence.ts'

export function createPhoto(db: Db, data: Partial<Prisma.PhotoUncheckedCreateInput> = {}) {
  const n = next()
  return db.photo.create({ data: { intitule: `Photo test ${n}`, mimeType: 'image/png', ...data } })
}

export function createLivraison(db: Db, data: Partial<Prisma.LivraisonUncheckedCreateInput> = {}) {
  const n = next()
  return db.livraison.create({ data: { reference: `BL-TEST-${n}`, ...data } })
}

export async function createReception(
  db: Db,
  data: Partial<Prisma.ReceptionUncheckedCreateInput> = {},
) {
  const plateformeId = data.plateformeId ?? (await createPlateforme(db)).id
  return db.reception.create({
    data: { statut: StatutReception.A_CONTROLER, ...data, plateformeId },
  })
}

export async function createAffiche(
  db: Db,
  data: Partial<Prisma.AfficheUncheckedCreateInput> = {},
) {
  const plateformeId = data.plateformeId ?? (await createPlateforme(db)).id
  const supportId = data.supportId ?? (await createSupport(db)).id
  const n = next()
  return db.affiche.create({
    data: {
      statut: StatutAffiche.IDENTIFIEE,
      dateEntree: new Date('2026-01-05'),
      conservation: 20,
      quantite: 100,
      contNum: 1000 + n,
      theme: `Thème test ${n}`,
      ...data,
      plateformeId,
      supportId,
    },
  })
}

export async function createMouvement(
  db: Db,
  data: Partial<Prisma.MouvementUncheckedCreateInput> = {},
) {
  const afficheId = data.afficheId ?? (await createAffiche(db)).id
  return db.mouvement.create({
    data: {
      type: TypeMouvement.RECEPTION,
      date: new Date('2026-01-05'),
      quantite: 100,
      ...data,
      afficheId,
    },
  })
}

export async function createReceptionAttendue(
  db: Db,
  data: Partial<Prisma.ReceptionAttendueUncheckedCreateInput> = {},
) {
  const plateformeId = data.plateformeId ?? (await createPlateforme(db)).id
  const supportId = data.supportId ?? (await createSupport(db)).id
  const n = next()
  const theme = `Thème attendu ${n}`
  return db.receptionAttendue.create({
    data: {
      contNum: 2000 + n,
      theme,
      themeCle: theme.toUpperCase(),
      semNum: 10,
      semAnnee: 2026,
      source: SourceLigne.BC,
      etatLigne: EtatLigne.ACTIVE,
      statut: StatutLigneAttendue.ATTENDUE,
      qteBc: 100,
      ...data,
      plateformeId,
      supportId,
    },
  })
}

export async function createRattachement(
  db: Db,
  data: Partial<Prisma.AfficheAttendueUncheckedCreateInput> = {},
) {
  const afficheId = data.afficheId ?? (await createAffiche(db)).id
  const ligneAttendueId = data.ligneAttendueId ?? (await createReceptionAttendue(db)).id
  return db.afficheAttendue.create({
    data: { quantite: 50, mode: ModeRattachement.BL, ...data, afficheId, ligneAttendueId },
  })
}

export async function createAfficheSemaineDepart(
  db: Db,
  data: Partial<Prisma.AfficheSemaineDepartUncheckedCreateInput> = {},
) {
  const afficheId = data.afficheId ?? (await createAffiche(db)).id
  return db.afficheSemaineDepart.create({ data: { semaine: 10, annee: 2026, ...data, afficheId } })
}

export async function createFusionAffiche(
  db: Db,
  data: Partial<Prisma.FusionAfficheUncheckedCreateInput> = {},
) {
  const afficheChapeauId = data.afficheChapeauId ?? (await createAffiche(db)).id
  const afficheId = data.afficheId ?? (await createAffiche(db)).id
  return db.fusionAffiche.create({ data: { ...data, afficheChapeauId, afficheId } })
}

export function createPrepaBroadcast(
  db: Db,
  data: Partial<Prisma.PrepaBroadcastUncheckedCreateInput> = {},
) {
  const n = next()
  return db.prepaBroadcast.create({
    data: { idDossierDeVenteChapeau: 3000 + n, semNum: 10, semAnnee: 2026, quantite: 100, ...data },
  })
}
