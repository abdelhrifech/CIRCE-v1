import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  ADMIN_HOST: z.string().default('127.0.0.1'),
  ADMIN_PORT: z.coerce.number().int().min(0).max(65535).default(9180),
  ADMIN_READY_TIMEOUT_MS: z.coerce.number().int().min(1).max(30000).default(2000),
  DATABASE_URL: z.string().startsWith('file:', 'DATABASE_URL doit être un fichier SQLite (file:…)'),
  IDENTITY_PROVIDER: z.enum(['dev']).default('dev'),
  DEV_IDENTITY_SECRET: z.string().min(16, 'DEV_IDENTITY_SECRET : 16 caractères minimum').optional(),
  // D-19 (Q-409) : « dev » = boîte d'envoi de développement (aucun mail réel) ; « smtp » = envoi réel, uniquement
  // si SMTP_HOST et MAIL_EXPEDITEUR sont renseignés. Désactivé par défaut.
  MAIL_MODE: z.enum(['dev', 'smtp']).default('dev'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(25),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_EXPEDITEUR: z.string().optional(),
  // D-20 (Q-410) : ordonnanceur interne des traitements planifiés (les horaires vides le rendent sans effet).
  ORDONNANCEUR_ACTIF: z.enum(['true', 'false']).default('true'),
})

export type Config = z.infer<typeof EnvSchema>

/** Valide l'environnement au démarrage ; échec immédiat si invalide. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`)
    throw new Error(`Configuration invalide :\n- ${problems.join('\n- ')}`)
  }
  const config = parsed.data
  // HYPOTHÈSE (Q-001) : seul le fournisseur d'identité de dev existe (IDENTITY_PROVIDER=dev) ;
  // il est interdit en production.
  if (config.NODE_ENV === 'production') {
    throw new Error("Fournisseur d'identité de dev interdit en production (Q-001 non tranchée)")
  }
  if (!config.DEV_IDENTITY_SECRET) {
    throw new Error('DEV_IDENTITY_SECRET est obligatoire avec IDENTITY_PROVIDER=dev')
  }
  return config
}

/** Variables d'environnement de l'envoi de mails seules (commandes hors serveur : pas d'identité de dev requise). */
export function loadConfigMail(env: NodeJS.ProcessEnv = process.env) {
  return EnvSchema.pick({
    NODE_ENV: true,
    MAIL_MODE: true,
    SMTP_HOST: true,
    SMTP_PORT: true,
    SMTP_SECURE: true,
    SMTP_USER: true,
    SMTP_PASSWORD: true,
    MAIL_EXPEDITEUR: true,
  }).parse(env)
}
