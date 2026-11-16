import type { Db } from '../../src/core/db.ts'
import type { Prisma } from '../../src/generated/prisma/client.ts'
import {
  StatutDossier,
  StatutInstruction,
  StatutProduction,
} from '../../src/generated/prisma/client.ts'
import { next } from './sequence.ts'

export function createDossier(db: Db, data: Partial<Prisma.DossierUncheckedCreateInput> = {}) {
  const n = next()
  return db.dossier.create({
    data: { contNum: 5000 + n, statut: StatutDossier.A_TRAITER, ...data },
  })
}

export function createInstruction(
  db: Db,
  data: Partial<Prisma.InstructionUncheckedCreateInput> = {},
) {
  const n = next()
  return db.instruction.create({
    data: {
      code: `TEST${String(n).padStart(8, '0')}`,
      statut: StatutInstruction.EN_COURS,
      ...data,
    },
  })
}

export async function createInstructionDetail(
  db: Db,
  data: Partial<Prisma.InstructionDetailUncheckedCreateInput> = {},
) {
  const instructionCode = data.instructionCode ?? (await createInstruction(db)).code
  return db.instructionDetail.create({ data: { ...data, instructionCode } })
}

export async function createInstructionVisuel(
  db: Db,
  data: Partial<Prisma.InstructionVisuelUncheckedCreateInput> = {},
) {
  const instructionCode = data.instructionCode ?? (await createInstruction(db)).code
  return db.instructionVisuel.create({ data: { ...data, instructionCode } })
}

export async function createFaceTrain(
  db: Db,
  data: Partial<Prisma.FaceTrainUncheckedCreateInput> = {},
) {
  const instructionCode = data.instructionCode ?? (await createInstruction(db)).code
  const n = next()
  return db.faceTrain.create({
    data: {
      statut: StatutProduction.A_TRAITER,
      cadrIdent: n,
      dateDepart: new Date('2026-03-06'),
      ...data,
      instructionCode,
    },
  })
}

export function createUniteManutention(
  db: Db,
  data: Partial<Prisma.UniteManutentionUncheckedCreateInput> = {},
) {
  const n = next()
  return db.uniteManutention.create({
    data: { statut: StatutProduction.EN_COURS, codeBarre: `UM-TEST-${n}`, ...data },
  })
}

export function createRepartition(
  db: Db,
  data: Partial<Prisma.RepartitionUncheckedCreateInput> = {},
) {
  return db.repartition.create({ data: { statut: StatutProduction.EN_COURS, qte: 10, ...data } })
}
