import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { resolve } from 'node:path'

describe('EXP-001/002/003/006/010 real OTLP transport', () => {
  it('exports HTTP, Prisma and outbound traces, low-cardinality metrics and correlated JSON logs', async () => {
    const received: { path: string; body: string }[] = []
    const collector = createServer((request, response) => {
      let body = ''
      request.setEncoding('utf8')
      request.on('data', (chunk: string) => {
        body += chunk
      })
      request.on('end', () => {
        received.push({ path: request.url ?? '', body })
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end('{}')
      })
    })
    await new Promise<void>((done) => collector.listen(0, '127.0.0.1', done))
    const address = collector.address()
    if (!address || typeof address === 'string') throw new Error('Collector listener unavailable')
    const endpoint = `http://127.0.0.1:${address.port}`
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', '--env-file=../../.env.test', 'test/support/observability-child.ts'],
      {
        cwd: resolve(import.meta.dirname, '..'),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          LOG_LEVEL: 'info',
          OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
          OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
          OTEL_RESOURCE_ATTRIBUTES:
            'service.name=circe-test,service.namespace=circe-tests,service.version=test-build,deployment.environment.name=test',
          OTEL_SERVICE_NAME: 'circe-test',
          OTEL_TRACES_SAMPLER: 'always_on',
          OTEL_TRACES_EXPORTER: 'otlp',
          OTEL_METRICS_EXPORTER: 'otlp',
          OTEL_BSP_SCHEDULE_DELAY: '100',
          OTEL_METRIC_EXPORT_INTERVAL: '100',
          OTEL_EXPORTER_OTLP_TIMEOUT: '1000',
          TEST_UPSTREAM_URL: `${endpoint}/upstream?secret=private-upstream-token`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stdout = '',
      stderr = ''
    child.stdout.on('data', (b: Buffer) => {
      stdout += b.toString()
    })
    child.stderr.on('data', (b: Buffer) => {
      stderr += b.toString()
    })
    try {
      for (let i = 0; i < 100 && !/TEST_API_PORT=\d+/.test(stdout); i++) {
        if (child.exitCode !== null) throw new Error(`Telemetry child exited: ${stderr}\n${stdout}`)
        await delay(50)
      }
      const port = /TEST_API_PORT=(\d+)/.exec(stdout)?.[1]
      expect(port, stderr).toBeDefined()
      const response = await fetch(
        `http://127.0.0.1:${port ?? ''}/v1/telemetry-test?token=private-request-token`,
        {
          headers: { cookie: 'private-session-cookie' },
        },
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
      for (
        let i = 0;
        i < 100 &&
        !(
          received.some((r) => r.path === '/v1/traces') &&
          received.some((r) => r.path === '/v1/metrics')
        );
        i++
      )
        await delay(50)
      const traces = received
        .filter((r) => r.path === '/v1/traces')
        .map((r) => r.body)
        .join('\n')
      const metrics = received
        .filter((r) => r.path === '/v1/metrics')
        .map((r) => r.body)
        .join('\n')
      expect(traces, stderr).toContain('/v1/telemetry-test')
      expect(traces).toContain('prisma')
      expect(traces).toContain('"kind":3')
      expect(traces).toContain('@opentelemetry/instrumentation-undici')
      expect(traces).toContain('circe-test')
      expect(traces).toContain('test-build')
      const tracePayload = z.object({
        resourceSpans: z.array(
          z.object({
            scopeSpans: z.array(
              z.object({
                spans: z.array(
                  z.object({
                    name: z.string(),
                    kind: z.number(),
                    traceId: z.string(),
                    spanId: z.string(),
                  }),
                ),
              }),
            ),
          }),
        ),
      })
      const spans = received
        .filter((r) => r.path === '/v1/traces')
        .flatMap((r) =>
          tracePayload
            .parse(JSON.parse(r.body))
            .resourceSpans.flatMap((resource) =>
              resource.scopeSpans.flatMap((scope) => scope.spans),
            ),
        )
      const incoming = spans.find(
        (span) => span.kind === 2 && span.name.includes('/v1/telemetry-test'),
      )
      expect(incoming).toBeDefined()
      expect(
        spans.some((span) => span.name.includes('prisma') && span.traceId === incoming?.traceId),
      ).toBe(true)
      expect(
        spans.some(
          (span) => span.name === 'GET' && span.kind === 3 && span.traceId === incoming?.traceId,
        ),
      ).toBe(true)

      expect(metrics, stderr).toContain('http.server.request.duration')
      expect(metrics).toContain('circe_api_requests')
      expect(metrics).toContain('http.route')
      expect(traces + metrics).not.toMatch(
        /private-request-token|private-upstream-token|private-session-cookie/,
      )
      expect(stdout).not.toMatch(/private-request-token|private-session-cookie/)
      const logs = stdout
        .split('\n')
        .filter((l) => l.startsWith('{'))
        .map((l) => JSON.parse(l) as Record<string, unknown>)
      expect(
        logs.some(
          (l) =>
            l['trace_id'] === incoming?.traceId &&
            spans.some((span) => span.spanId === l['span_id']),
        ),
      ).toBe(true)
      expect(logs.some((l) => l['severityText'] === 'INFO' && typeof l['body'] === 'string')).toBe(
        true,
      )
      // A collector outage never turns a successful business response into an error.
      await new Promise<void>((done, reject) =>
        collector.close((error) => {
          if (error) reject(error)
          else done()
        }),
      )
      const stillWorks = await fetch(`http://127.0.0.1:${port ?? ''}/api/health`)
      expect(stillWorks.status).toBe(200)
    } finally {
      if (child.exitCode === null) {
        const exited = once(child, 'exit')
        child.kill('SIGTERM')
        await exited
      }
      if (collector.listening)
        await new Promise<void>((done) =>
          collector.close(() => {
            done()
          }),
        )
    }
  }, 30000)
})
