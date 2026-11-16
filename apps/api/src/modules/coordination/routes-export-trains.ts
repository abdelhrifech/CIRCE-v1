// Routes COO-P10 (export des trains, export préparation, Au roulage, rouleur, suivi par thème, générateur de
// fichiers) : parse → service → réponse. Aucune règle métier ici.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  AffecterRouleurSchema,
  AuRoulageSchema,
  BesoinThemeQuerySchema,
  BesoinThemeSchema,
  ComplementGenerationSchema,
  EnvoyerGenerationSchema,
  ExportApercuQuerySchema,
  ExportApercuSchema,
  ExportFichierSchema,
  ExporterTrainsSchema,
  ExportPreparationSchema,
  ExportResultatSchema,
  GenerationSchema,
  PickingGenerationSchema,
  HistoriqueExportsSchema,
  PreAssemblageSchema,
  PreparerGenerationSchema,
  ResultatSimpleSchema,
  RouleursQuerySchema,
  RouleursSchema,
  SemaineIsoSchema,
  SupprimerThemeExportSchema,
  TrainsGenerationQuerySchema,
  TrainsGenerationSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { identiteCoordination } from './permissions.ts'
import type { MachinePort } from '../../core/ports/machine.ts'
import {
  affecterRouleur,
  apercuExport,
  auRoulage,
  exporterTrains,
  exportPreparation,
  fichierExport,
  historiqueExports,
  listerRouleurs,
  supprimerThemeExport,
} from './export-trains.ts'
import {
  envoyerGeneration,
  fichierGeneration,
  genererComplement,
  pickingGeneration,
  preparerGeneration,
  trainsPourGeneration,
} from './generation-fichiers.ts'
import { idem } from './routes.ts'
import { besoinParTheme, marquerPreAssemblage } from './suivi-theme.ts'

const IdParam = z.object({ id: z.coerce.number().int().positive() })

export function exportTrainsRoutes(app: FastifyInstance, db: Db, machine: MachinePort): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  // ── ECR-COO-05b : export des trains du jeudi ──
  r.get(
    '/coordination/trains/export/apercu',
    { schema: { querystring: ExportApercuQuerySchema, response: { 200: ExportApercuSchema } } },
    (request) => apercuExport(db, identiteCoordination(request), request.query.depart),
  )
  r.get(
    '/coordination/trains/export/historique',
    {
      schema: {
        querystring: z.object({ depart: SemaineIsoSchema.optional() }),
        response: { 200: HistoriqueExportsSchema },
      },
    },
    (request) => historiqueExports(db, identiteCoordination(request), request.query.depart),
  )
  r.get(
    '/coordination/trains/export/:id/fichier',
    { schema: { params: IdParam, response: { 200: ExportFichierSchema } } },
    (request) => fichierExport(db, identiteCoordination(request), request.params.id),
  )
  r.post(
    '/coordination/trains/export',
    { schema: { body: ExporterTrainsSchema, response: { 200: ExportResultatSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => exporterTrains(tx, identity, request.body)),
  )

  // ── ECR-COO-07 : export préparation, Au roulage, thème retiré de l'export, rouleur ──
  r.post(
    '/coordination/trains/export-preparation',
    { schema: { body: ExportPreparationSchema, response: { 200: ExportResultatSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => exportPreparation(tx, identity, request.body)),
  )
  r.post(
    '/coordination/trains/au-roulage',
    { schema: { body: AuRoulageSchema, response: { 200: ResultatSimpleSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => auRoulage(tx, identity, request.body)),
  )
  r.post(
    '/coordination/trains/supprimer-theme-export',
    { schema: { body: SupprimerThemeExportSchema, response: { 200: ResultatSimpleSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => supprimerThemeExport(tx, identity, request.body)),
  )
  r.get(
    '/coordination/trains/rouleurs',
    { schema: { querystring: RouleursQuerySchema, response: { 200: RouleursSchema } } },
    (request) => listerRouleurs(db, identiteCoordination(request), request.query.atelier),
  )
  r.post(
    '/coordination/trains/rouleur',
    { schema: { body: AffecterRouleurSchema, response: { 200: ResultatSimpleSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => affecterRouleur(tx, identity, request.body)),
  )

  // ── ECR-COO-06 : suivi par thème ──
  r.get(
    '/coordination/trains/besoin',
    { schema: { querystring: BesoinThemeQuerySchema, response: { 200: BesoinThemeSchema } } },
    (request) => besoinParTheme(db, identiteCoordination(request), request.query),
  )
  r.post(
    '/coordination/trains/pre-assemblage',
    { schema: { body: PreAssemblageSchema, response: { 200: ResultatSimpleSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => marquerPreAssemblage(tx, identity, request.body)),
  )

  // ── ECR-GEN-01 / GEN-03 : générateur de fichiers ──
  r.get(
    '/coordination/generateur',
    {
      schema: {
        querystring: TrainsGenerationQuerySchema,
        response: { 200: TrainsGenerationSchema },
      },
    },
    (request) => trainsPourGeneration(db, identiteCoordination(request), request.query),
  )
  r.post(
    '/coordination/generateur',
    { schema: { body: PreparerGenerationSchema, response: { 200: GenerationSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => preparerGeneration(tx, identity, request.body)),
  )
  r.post(
    '/coordination/generateur/envoyer',
    { schema: { body: EnvoyerGenerationSchema, response: { 200: GenerationSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        envoyerGeneration(tx, identity, request.body, machine),
      ),
  )
  r.post(
    '/coordination/generateur/complement',
    { schema: { body: ComplementGenerationSchema, response: { 200: GenerationSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => genererComplement(tx, identity, request.body)),
  )
  r.get(
    '/coordination/generateur/:id/picking',
    { schema: { params: IdParam, response: { 200: PickingGenerationSchema } } },
    (request) => pickingGeneration(db, identiteCoordination(request), request.params.id),
  )
  r.get(
    '/coordination/generateur/:id/fichier',
    { schema: { params: IdParam, response: { 200: ExportFichierSchema } } },
    (request) => fichierGeneration(db, identiteCoordination(request), request.params.id),
  )
}
