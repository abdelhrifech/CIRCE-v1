import { NodeSDK } from '@opentelemetry/sdk-node'
import { context, trace, isSpanContextValid } from '@opentelemetry/api'
import {
  defaultResource,
  resourceFromAttributes,
  detectResources,
  resourceAttributesEnvDetector,
  serviceNameEnvDetector,
} from '@opentelemetry/resources'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { PrismaInstrumentation } from '@prisma/instrumentation'
import FastifyOtelInstrumentation from '@fastify/otel'
import { BatchSpanProcessor, type SpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace'
import { OTLPTraceExporter as ProtoExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { OTLPTraceExporter as JsonExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPTraceExporter as GrpcExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { getNumberFromEnv, type ExportResult } from '@opentelemetry/core'

// Never export request payloads, SQL, query strings, credentials or arbitrary instrumentation attributes.
const allowedAttributes = new Set([
  'http.request.method',
  'http.response.status_code',
  'http.route',
  'http.method',
  'http.status_code',
  'url.scheme',
  'server.address',
  'server.port',
  'network.protocol.version',
  'network.protocol.name',
  'db.system',
  'db.system.name',
  'db.operation',
  'db.operation.name',
  'db.namespace',
  'method',
  'model',
  'error.type',
  'rpc.system',
  'rpc.method',
  'rpc.service',
])
export function sanitizeSpan(span: ReadableSpan): ReadableSpan {
  const attributes = Object.fromEntries(
    Object.entries(span.attributes).filter(([key]) => allowedAttributes.has(key)),
  )
  return {
    name: span.name,
    kind: span.kind,
    parentSpanContext: span.parentSpanContext,
    startTime: span.startTime,
    endTime: span.endTime,
    duration: span.duration,
    ended: span.ended,
    resource: span.resource,
    instrumentationScope: span.instrumentationScope,
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount,
    droppedLinksCount: span.droppedLinksCount,
    spanContext: () => span.spanContext(),
    attributes,
    // Exception text/stack can contain application data. Preserve the failure status without its message.
    status: { code: span.status.code },
    events: [],
    links: [],
  }
}
export class SafeTraceExporter implements SpanExporter {
  constructor(private readonly exporter: SpanExporter) {}
  export(spans: ReadableSpan[], callback: (result: ExportResult) => void): void {
    this.exporter.export(spans.map(sanitizeSpan), callback)
  }
  shutdown(): Promise<void> {
    return this.exporter.shutdown()
  }
}

export const telemetryResource = defaultResource()
  .merge(
    resourceFromAttributes({
      'service.name': 'circe-api',
      'service.namespace': 'circe',
      'service.version': '0.0.0',
      'deployment.environment.name': process.env['NODE_ENV'] ?? 'development',
    }),
  )
  .merge(detectResources({ detectors: [resourceAttributesEnvDetector, serviceNameEnvDetector] }))

// Pino is the only application log channel: OTLP log sending is deliberately disabled.
export function logContext() {
  const span = trace.getSpan(context.active())?.spanContext()
  return {
    resource: telemetryResource.attributes,
    ...(span && isSpanContextValid(span)
      ? {
          trace_id: span.traceId,
          span_id: span.spanId,
          trace_flags: span.traceFlags.toString(16).padStart(2, '0'),
        }
      : {}),
  }
}
export function severity(label: string, level: number) {
  const numbers: Record<string, number> = {
    trace: 1,
    debug: 5,
    info: 9,
    warn: 13,
    error: 17,
    fatal: 21,
  }
  return { level, severityText: label.toUpperCase(), severityNumber: numbers[label] ?? 9 }
}

export function startTelemetry() {
  const env = process.env
  const tracesConfigured =
    !!(env['OTEL_EXPORTER_OTLP_ENDPOINT'] || env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT']) &&
    env['OTEL_TRACES_EXPORTER'] !== 'none'
  const metricsConfigured =
    !!(env['OTEL_EXPORTER_OTLP_ENDPOINT'] || env['OTEL_EXPORTER_OTLP_METRICS_ENDPOINT']) &&
    env['OTEL_METRICS_EXPORTER'] !== 'none'
  const protocol =
    env['OTEL_EXPORTER_OTLP_TRACES_PROTOCOL'] ??
    env['OTEL_EXPORTER_OTLP_PROTOCOL'] ??
    'http/protobuf'
  let processors: BatchSpanProcessor[] = []
  if (tracesConfigured) {
    const exporter =
      protocol === 'grpc'
        ? new GrpcExporter()
        : protocol === 'http/json'
          ? new JsonExporter()
          : protocol === 'http/protobuf'
            ? new ProtoExporter()
            : null
    if (!exporter) throw new Error('Unsupported OTEL_EXPORTER_OTLP_TRACES_PROTOCOL')
    processors = [
      new BatchSpanProcessor({
        exporter: new SafeTraceExporter(exporter),
        maxQueueSize: getNumberFromEnv('OTEL_BSP_MAX_QUEUE_SIZE'),
        maxExportBatchSize: getNumberFromEnv('OTEL_BSP_MAX_EXPORT_BATCH_SIZE'),
        scheduledDelayMillis: getNumberFromEnv('OTEL_BSP_SCHEDULE_DELAY'),
        exportTimeoutMillis: getNumberFromEnv('OTEL_BSP_EXPORT_TIMEOUT'),
      }),
    ]
  }
  const fastify = new FastifyOtelInstrumentation({
    instrumentHooks: false,
    recordExceptions: false,
  })
  const sdk = new NodeSDK({
    resource: telemetryResource,
    autoDetectResources: false,
    spanProcessors: processors,
    ...(metricsConfigured ? {} : { metricReaders: [] }),
    logRecordProcessors: [],
    instrumentations: [
      new HttpInstrumentation(),
      new UndiciInstrumentation(),
      new PinoInstrumentation({ disableLogSending: true }),
      new PrismaInstrumentation(),
      fastify,
    ],
  })
  sdk.start()
  return { sdk, fastify }
}
