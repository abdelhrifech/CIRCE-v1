// Vérification de la consigne explicite du 19/11/2026 : Réception et Coordination figées.
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fichiers = JSON.parse(
  readFileSync(resolve(root, 'docs/GEL_RECEPTION_COORDINATION_2026_11_19.json'), 'utf8'),
)
const modifies = Object.entries(fichiers)
  .filter(
    ([p, hash]) =>
      !existsSync(resolve(root, p)) ||
      createHash('sha256')
        .update(readFileSync(resolve(root, p)))
        .digest('hex') !== hash,
  )
  .map(([p]) => p)
if (modifies.length) {
  console.error('Gel non respecté :', modifies)
  process.exitCode = 1
} else
  console.log(
    `${Object.keys(fichiers).length} fichiers Réception, Coordination et composants partagés inchangés.`,
  )
