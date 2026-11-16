// taches:executer <TACHE|toutes> — exécute un traitement planifié (D-20, Q-410) : point d'entrée d'un ordonnanceur
// externe (cron) ou exécution à la main. TACHE ∈ FIN_JOURNEE_COLIS, PURGE_ATTENDUES, INSTRUCTION_OK_AUTO, ENVOI_MAILS.
// Verrou et journal d'exécution : modules/taches/service.ts. Les mails ne partent que si MAIL_MODE=smtp est configuré.
import { resolve } from 'node:path'
import { NOMS_TACHES, NomTacheSchema, type NomTache } from '@circe/shared'
import { createDb } from '../src/core/db.ts'
import { creerMailPort } from '../src/core/ports/mail.ts'
import { loadConfigMail } from '../src/core/config.ts'
import { executerTache } from '../src/modules/taches/service.ts'

process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'))
const url = process.env['DATABASE_URL'] ?? ''
const demande = process.argv[2]
const noms: NomTache[] | null =
  demande === 'toutes'
    ? [...NOMS_TACHES]
    : NomTacheSchema.safeParse(demande).success
      ? [NomTacheSchema.parse(demande)]
      : null
if (!url.startsWith('file:') || !noms) {
  console.error(
    `Usage : pnpm --filter @circe/api taches:executer <${NOMS_TACHES.join('|')}|toutes> (DATABASE_URL requis)`,
  )
  process.exit(1)
}
const db = createDb(url)
const mail = creerMailPort(loadConfigMail())
try {
  for (const nom of noms) {
    const e = await executerTache({ db, mail }, nom, { declencheur: 'COMMANDE', identity: null })
    console.log(JSON.stringify(e, null, 2))
    if (e.statut !== 'SUCCES') process.exitCode = 2
  }
} finally {
  await db.$disconnect()
}
