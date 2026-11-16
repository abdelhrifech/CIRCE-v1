// Initialize instrumentation before loading Fastify, Pino and Prisma.
import './telemetry-bootstrap.ts'
await import('./server-runtime.ts')
