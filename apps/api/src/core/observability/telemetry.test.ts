import { describe, expect, it } from 'vitest'
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace'
import { SafeTraceExporter } from './telemetry.ts'

describe('EXP-001/006 telemetry data minimization', () => {
  it('exports valid spans without SQL, payloads, query strings or exception details', async () => {
    const exporter = new InMemorySpanExporter()
    const provider = new TracerProvider({
      spanProcessors: [new SimpleSpanProcessor({ exporter: new SafeTraceExporter(exporter) })],
    })
    try {
      const span = provider.getTracer('test').startSpan('GET /v1/photos/:id')
      span.setAttributes({
        'http.route': '/v1/photos/:id',
        'http.response.status_code': 200,
        'db.statement': 'secret-sql',
        'url.full': 'https://example.test/?token=secret-token',
        'request.body': 'private-payload',
        'user.id': 42,
      })
      span.recordException(new Error('private-error'))
      span.end()
      await provider.forceFlush()
      const spans = exporter.getFinishedSpans()
      expect(spans).toHaveLength(1)
      expect(spans[0]?.attributes).toEqual({
        'http.route': '/v1/photos/:id',
        'http.response.status_code': 200,
      })
      expect(spans[0]?.spanContext().traceId).toHaveLength(32)
      expect(spans[0]?.duration).toHaveLength(2)
      expect(spans[0]?.ended).toBe(true)
      expect(JSON.stringify(spans)).not.toMatch(
        /secret-sql|secret-token|private-payload|private-error/,
      )
    } finally {
      await provider.shutdown()
    }
  })
})
