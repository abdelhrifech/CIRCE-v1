// Routes Coordination (COO-P01 à COO-P05) : parse → service → réponse ; aucune règle ici.
// Les POST de transition / création exigent Idempotency-Key ; les PATCH passent par le verrou de version.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  AppliquerVersionBroadcastSchema,
  AteliersPerimetreSchema,
  ChangerStatutInstructionSchema,
  ChangerValidationAfficheSchema,
  CodeInstructionParamSchema,
  DemandeCorrectionResultatSchema,
  DemandeCorrectionSchema,
  EtiquettesRackSchema,
  FicheDossierSchema,
  IdAfficheParamSchema,
  IdDossierParamSchema,
  IdLigneAttendueParamSchema,
  InstructionModifieeSchema,
  InstructionOkResultatSchema,
  InstructionOkSchema,
  ListeDossiersQuerySchema,
  ListeDossiersSchema,
  ModifierInstructionSchema,
  ReservationsQuerySchema,
  ReservationsSchema,
  SuiviProductionQuerySchema,
  SuiviProductionSchema,
  StatutInstructionChangeSchema,
  ValiderSelectionResultatSchema,
  ValiderSelectionSchema,
  ValidationAfficheResultatSchema,
  VersionBroadcastResultatSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdempotencyKey, sendIdempotent, withIdempotency } from '../../core/idempotency.ts'
import { type Identity } from '../../core/identity.ts'
import { withTransaction, type Tx } from '../../core/transaction.ts'
import { lireFicheDossier, listerAteliersPerimetre, listerDossiers } from './dossiers.ts'
import { appliquerVersionBroadcast, demanderCorrection, modifierInstruction } from './edition.ts'
import { instructionOkManuelle } from './instruction-ok.ts'
import { changerStatutInstruction } from './instructions.ts'
import { COO, identiteCoordination } from './permissions.ts'
import { validerSelection } from './validation-admin.ts'
import { changerValidationCoordination, listerEtiquettesRack } from './effets-validation.ts'
import { etatReservations, suiviProduction, supprimerLigneAttendue } from './reservations.ts'

/** POST idempotent : la clé, l'opération et la réponse sont dans UNE transaction. */
export async function idem<T>(
  db: Db,
  request: FastifyRequest,
  reply: FastifyReply,
  run: (tx: Tx, identity: Identity) => Promise<T>,
  timeoutMs?: number,
) {
  const identity = identiteCoordination(request)
  const key = requireIdempotencyKey(request)
  const result = await withIdempotency(
    db,
    {
      userId: identity.userId,
      key,
      method: 'POST',
      path: request.url.split('?')[0] ?? request.url,
      body: request.body,
      timeoutMs,
      ...COO.idempotence,
    },
    async (tx) => ({ status: 200, body: await run(tx, identity) }),
  )
  return sendIdempotent(reply, result)
}

export function coordinationRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  r.get(
    '/coordination/dossiers',
    { schema: { querystring: ListeDossiersQuerySchema, response: { 200: ListeDossiersSchema } } },
    (request) => listerDossiers(db, identiteCoordination(request), request.query),
  )
  r.get(
    '/coordination/dossiers/:id',
    { schema: { params: IdDossierParamSchema, response: { 200: FicheDossierSchema } } },
    (request) => lireFicheDossier(db, identiteCoordination(request), request.params.id),
  )
  r.get(
    '/coordination/ateliers',
    { schema: { response: { 200: AteliersPerimetreSchema } } },
    (request) => listerAteliersPerimetre(db, identiteCoordination(request)),
  )

  // RG-COO-040 / 045 / 046 : transition d'instruction.
  r.post(
    '/coordination/instructions/:code/statut',
    {
      schema: {
        params: CodeInstructionParamSchema,
        body: ChangerStatutInstructionSchema,
        response: { 200: StatutInstructionChangeSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        changerStatutInstruction(tx, identity, request.params.code, request.body),
      ),
  )

  // RG-COO-044 / 051 : Instruction OK après contrôle (individuelle ou groupée).
  r.post(
    '/coordination/instruction-ok',
    { schema: { body: InstructionOkSchema, response: { 200: InstructionOkResultatSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        instructionOkManuelle(tx, identity, request.body.instructions),
      ),
  )

  // RG-COO-047 / 048 / 050 : entretien, position, annonceur, commentaire.
  r.patch(
    '/coordination/instructions/:code',
    {
      schema: {
        params: CodeInstructionParamSchema,
        body: ModifierInstructionSchema,
        response: { 200: InstructionModifieeSchema },
      },
    },
    (request) =>
      withTransaction(db, (tx) =>
        modifierInstruction(tx, identiteCoordination(request), request.params.code, request.body),
      ),
  )

  // RG-COO-056 : appliquer la version Broadcast.
  r.post(
    '/coordination/dossiers/:id/version-broadcast',
    {
      schema: {
        params: IdDossierParamSchema,
        body: AppliquerVersionBroadcastSchema,
        response: { 200: VersionBroadcastResultatSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        appliquerVersionBroadcast(tx, identity, request.params.id, request.body.version),
      ),
  )

  // RG-COO-057 : demande de correction à Broadcast.
  r.post(
    '/coordination/dossiers/:id/corrections',
    {
      schema: {
        params: IdDossierParamSchema,
        body: DemandeCorrectionSchema,
        response: { 200: DemandeCorrectionResultatSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        demanderCorrection(tx, identity, request.params.id, request.body.note),
      ),
  )

  // RG-COO-010 / 012 / 013 : « Valider la sélection » (validation admin en lot).
  r.post(
    '/coordination/validation-admin',
    {
      schema: { body: ValiderSelectionSchema, response: { 200: ValiderSelectionResultatSchema } },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => validerSelection(tx, identity, request.body)),
  )

  // RG-COO-008 / 014 : « Valider » / « Annuler la validation » d'une affiche (fiche dossier).
  r.post(
    '/coordination/affiches/:id/validation-admin',
    {
      schema: {
        params: IdAfficheParamSchema,
        body: ChangerValidationAfficheSchema,
        response: { 200: ValidationAfficheResultatSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        changerValidationCoordination(tx, identity, request.params.id, request.body),
      ),
  )

  // RG-COO-023 : étiquettes rack à imprimer, groupées par plateforme.
  r.get(
    '/coordination/etiquettes-rack',
    { schema: { response: { 200: EtiquettesRackSchema } } },
    (request) => listerEtiquettesRack(db, identiteCoordination(request)),
  )

  // RG-COO-107 / 108 / 101 : état des réservations vivant (ECR-PIL-03).
  r.get(
    '/coordination/reservations',
    { schema: { querystring: ReservationsQuerySchema, response: { 200: ReservationsSchema } } },
    (request) => etatReservations(db, identiteCoordination(request), request.query),
  )

  // RG-COO-105 / 106 : suivi de production (lignes PREPA, n° d'affiche validée, répartitions, faces).
  r.get(
    '/coordination/suivi-production',
    {
      schema: { querystring: SuiviProductionQuerySchema, response: { 200: SuiviProductionSchema } },
    },
    (request) => suiviProduction(db, identiteCoordination(request), request.query),
  )

  // RG-COO-089 : une ligne attendue ne se supprime jamais (409) ; la fermeture est la seule voie.
  r.delete(
    '/coordination/lignes-attendues/:id',
    { schema: { params: IdLigneAttendueParamSchema } },
    (request) => supprimerLigneAttendue(db, identiteCoordination(request), request.params.id),
  )
}
