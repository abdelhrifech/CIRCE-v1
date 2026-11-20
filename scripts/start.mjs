// Démarrage de l'application en UNE commande (pnpm start:all) : base de dev + API + web.
// Étapes : .env (copié de .env.example si absent) -> ports libres -> migrations -> référentiels
// -> utilisateurs de dev (un par rôle) -> API + web. Ctrl+C arrête tout.
// Options : --user=<identifiant> (identité envoyée par le relais web, défaut dev.coord),
//           --api-port=<n> --web-port=<n> --admin-port=<n> (ports préférés), --no-seed (ne touche pas aux données).
// Base de DÉVELOPPEMENT uniquement (apps/api/prisma/dev.db), jamais la base de test. Q-001 : pas d'auth réelle.
import { commandePnpm, commandeArretWindows } from './pnpm-process.mjs'
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(racine)
const arg = (nom) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.split('=')[1]
const drapeau = (nom) => process.argv.includes(`--${nom}`)

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env')
  console.log('• .env créé à partir de .env.example')
}
const env = {}
for (const l of readFileSync('.env', 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim())
  if (m) env[m[1]] = m[2]
}
if (env.NODE_ENV === 'production') {
  console.error('Refusé : NODE_ENV=production (fournisseur d’identité de dev, Q-001).')
  process.exit(1)
}
if (!(env.DATABASE_URL ?? '').includes('dev.db')) {
  console.error(`Refusé : DATABASE_URL (${env.DATABASE_URL}) ne vise pas la base de dev (dev.db).`)
  process.exit(1)
}

const libre = (port) =>
  new Promise((ok) => {
    const s = createServer()
    s.once('error', () => ok(false))
    s.once('listening', () => s.close(() => ok(true)))
    s.listen(port, '127.0.0.1')
  })
async function premierLibre(depart, interdits = []) {
  for (let p = depart; p < depart + 100; p++) {
    if (!interdits.includes(p) && (await libre(p))) return p
  }
  throw new Error(`Aucun port libre à partir de ${depart}`)
}
const apiPort = await premierLibre(Number(arg('api-port') ?? env.API_PORT ?? 3001))
const webPort = await premierLibre(Number(arg('web-port') ?? env.WEB_PORT ?? 3000), [apiPort])
const adminPort = await premierLibre(Number(arg('admin-port') ?? env.ADMIN_PORT ?? 9180), [
  apiPort,
  webPort,
])
console.log(`• Sondes techniques : http://127.0.0.1:${adminPort}/healthz/live et /healthz/ready`)
const utilisateur = arg('user') ?? env.DEV_IDENTITY_USER ?? 'dev.coord'
if (apiPort !== Number(env.API_PORT ?? 3001) || webPort !== Number(env.WEB_PORT ?? 3000)) {
  console.log(
    `• Ports habituels occupés : API ${apiPort}, web ${webPort} (le fichier .env n'est pas modifié)`,
  )
}

function etape(titre, args) {
  console.log(`\n▶ ${titre}`)
  const cmd = commandePnpm(args)
  const r = spawnSync(cmd.command, cmd.args, { stdio: 'inherit', env: process.env })
  if (r.error) console.error(r.error.message)
  if (r.status !== 0) {
    console.error(`✖ Échec : pnpm ${args.join(' ')}`)
    process.exit(r.status ?? 1)
  }
}
if (!existsSync('node_modules/.modules.yaml'))
  etape('Installation des dépendances', ['install', '--frozen-lockfile'])
etape('Base de dev : migrations', ['db:up'])
etape('Client de base de données', ['--filter', '@circe/api', 'exec', 'prisma', 'generate'])
if (!drapeau('no-seed')) {
  etape('Référentiels (rôles, paramètres, types)', ['seed:ref'])
  for (const role of ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']) {
    etape(`Utilisateur de dev dev.${role}`, ['dev:user', `dev.${role}`, role])
  }
  // JDD sur les trois centres métier ; les plateformes techniques restent réservées aux tests E2E.
  if (!drapeau('no-demo')) {
    etape('JDD Wissous, Nîmes et Nanterre, profils par centre', ['seed:centres'])
    etape('JDD nouvelles spécifications : Bus, J-3, non-conformités', ['seed:news'])
    etape('JDD+ : réception, pilotage, non-conformités et formats 2 m²', ['seed:scenarios'])
  }
}

const enfants = []
const lancer = (nom, args, extra) => {
  const cmd = commandePnpm(args)
  const p = spawn(cmd.command, cmd.args, { stdio: 'inherit', env: { ...process.env, ...extra } })
  p.on('error', (error) => {
    console.error(`✖ ${nom} : ${error.message}`)
    arreter(1)
  })
  p.on('exit', (code) => {
    console.log(`\n${nom} arrêté (code ${code ?? 'signal'})`)
    arreter(code ?? 0)
  })
  enfants.push(p)
}
let arrete = false
function arreter(code) {
  if (arrete) return
  arrete = true
  for (const p of enfants) {
    if (process.platform === 'win32' && p.pid) {
      const cmd = commandeArretWindows(p.pid)
      spawnSync(cmd.command, cmd.args, { stdio: 'ignore' })
    } else p.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 500)
}
process.on('SIGINT', () => arreter(0))
process.on('SIGTERM', () => arreter(0))

const urlApi = `http://127.0.0.1:${apiPort}`
console.log('\n▶ Démarrage API + web (Ctrl+C pour tout arrêter)')
lancer('API', ['--filter', '@circe/api', 'dev'], {
  API_PORT: String(apiPort),
  ADMIN_PORT: String(adminPort),
})
lancer(
  'Web',
  [
    '--filter',
    '@circe/web',
    'exec',
    'vite',
    'dev',
    '--port',
    String(webPort),
    '--strictPort',
    '--host',
    '127.0.0.1',
  ],
  {
    API_URL: urlApi,
    WEB_PORT: String(webPort),
    DEV_IDENTITY_USER: utilisateur,
    ...(env.DEV_IDENTITY_SECRET ? { DEV_IDENTITY_SECRET: env.DEV_IDENTITY_SECRET } : {}),
  },
)

let pret = false
for (let i = 0; i < 120 && !arrete; i++) {
  try {
    const [a, w] = await Promise.all([
      fetch(`${urlApi}/api/health`, { signal: AbortSignal.timeout(3000) }),
      fetch(`http://127.0.0.1:${webPort}/`, { signal: AbortSignal.timeout(3000) }),
    ])
    if (a.ok && w.ok) {
      pret = true
      console.log(
        `\n✔ Application prête : http://127.0.0.1:${webPort}  (API ${urlApi}, identité ${utilisateur})`,
      )
      console.log(
        '  Autres profils : relancer avec --user=dev.recep | dev.cheq | dev.expe | dev.admin | dev.com',
      )
      break
    }
  } catch {
    // pas encore prêt
  }
  await new Promise((r) => setTimeout(r, 1000))
}

if (!pret && !arrete) {
  console.error('✖ Démarrage incomplet : consultez les erreurs API/web ci-dessus.')
  arreter(1)
}
