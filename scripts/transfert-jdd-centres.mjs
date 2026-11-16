// Opération de maintenance des JDD, jamais une règle de transfert métier.
// Par défaut : simulation intégrale puis ROLLBACK. --apply : sauvegarde puis transaction.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync, backup } from 'node:sqlite'

assert.notEqual(process.env.NODE_ENV, 'production', 'Interdit en production')
const racine = resolve(import.meta.dirname, '..')
const chemin = resolve(racine, 'apps/api/prisma/dev.db')
const appliquer = process.argv.includes('--apply')
assert(
  process.argv.slice(2).every((arg) => arg === '--apply'),
  'Option inconnue',
)
const db = new DatabaseSync(chemin)
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000')
const nomSql = (nom) => '"' + nom.replaceAll('"', '""') + '"'
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
const colonnes = (table) => db.prepare(`PRAGMA table_info(${nomSql(table)})`).all()
const references = tables.flatMap(({ name }) =>
  colonnes(name)
    .filter(({ name }) => ['plt_id', 'plateforme_id', 'plateformeId'].includes(name))
    .map((col) => ({ table: name, colonne: col.name })),
)
const total = (table) => db.prepare(`SELECT count(*) AS n FROM ${nomSql(table)}`).get().n
const lignes = (table) =>
  JSON.stringify(db.prepare(`SELECT * FROM ${nomSql(table)} ORDER BY rowid`).all())
const maintenant = new Date().toISOString()
const rapport = { date: maintenant, mode: appliquer ? 'transfert' : 'simulation', transferts: [] }
let sauvegarde
try {
  const destinations = ['Wissous', 'Nîmes', 'Nanterre'].map((nom) => {
    const sites = db.prepare('SELECT * FROM tr_plateforme WHERE nom = ?').all(nom)
    assert.equal(sites.length, 1, `Centre unique requis : ${nom}`)
    assert(sites[0].id_site_ccf !== null, `Identifiant CCF manquant : ${nom}`)
    return sites[0]
  })
  const sources = db
    .prepare("SELECT * FROM tr_plateforme WHERE nom LIKE 'Plateforme E2E %' ORDER BY id")
    .all()
  assert(sources.length > 0, 'Aucune plateforme E2E : rien à transférer')
  const admin = db
    .prepare("SELECT id FROM utilisateur WHERE identifiant_externe = 'dev.admin'")
    .get()
  assert(admin, 'Compte dev.admin requis pour tracer le transfert')
  if (appliquer) {
    sauvegarde = resolve(
      racine,
      `apps/api/prisma/dev-avant-transfert-jdd-${maintenant.replaceAll(/[:.]/g, '-')}.db`,
    )
    await backup(db, sauvegarde)
    rapport.sauvegarde = sauvegarde
  }
  db.exec('BEGIN IMMEDIATE')
  try {
    const totauxAvant = new Map(tables.map(({ name }) => [name, total(name)]))
    // Valeurs métier immuables pour cette opération : pas de mouvement ni de réécriture d'historique.
    const proteges = ['mouvement', 'photo', 'livraison', 'asso_affiche_visuel', 'statut_historique']
    const valeursAvant = new Map(proteges.map((table) => [table, lignes(table)]))
    let perimetresAjoutes = 0
    for (const [index, source] of sources.entries()) {
      const destination = destinations[index % destinations.length]
      const modifications = {}
      // Ces modules ne font pas partie des anciens JDD E2E. Refuser une reprise implicite de leurs JSON.
      for (const table of ['bus_ligne', 'j3_feuille', 'non_conformite', 'deblocage_preparation']) {
        const col = references.find((r) => r.table === table).colonne
        assert.equal(
          db
            .prepare(`SELECT count(*) AS n FROM ${nomSql(table)} WHERE ${nomSql(col)} = ?`)
            .get(source.id).n,
          0,
          `${table} contient des données source : adaptation explicite requise`,
        )
      }
      // Conserver les anciens périmètres et ajouter les destinations sans doublon.
      // Plusieurs plateformes E2E d’un utilisateur peuvent aboutir au même centre.
      const perimetres = db
        .prepare('SELECT * FROM utilisateur_perimetre WHERE plateforme_id = ?')
        .all(source.id)
      assert(
        perimetres.every((p) => p.atelier_id === null),
        'Périmètre atelier source : reprise explicite requise',
      )
      let ajoutes = 0
      for (const p of perimetres) {
        const existe = db
          .prepare(
            'SELECT id FROM utilisateur_perimetre WHERE utilisateur_id = ? AND plateforme_id = ? AND atelier_id IS NULL',
          )
          .get(p.utilisateur_id, destination.id)
        if (!existe) {
          db.prepare(
            'INSERT INTO utilisateur_perimetre (utilisateur_id, plateforme_id, atelier_id) VALUES (?, ?, NULL)',
          ).run(p.utilisateur_id, destination.id)
          ajoutes++
        }
      }
      perimetresAjoutes += ajoutes
      if (ajoutes) modifications.perimetresAjoutes = ajoutes
      for (const { table, colonne } of references) {
        if (table === 'utilisateur_perimetre') continue
        const champs = colonnes(table).map((c) => c.name)
        const setters = [`${nomSql(colonne)} = ?`]
        if (champs.includes('version')) setters.push('version = version + 1')
        const date = ['updated_at', 'updatedAt', 'dateModified'].find((c) => champs.includes(c))
        if (date) setters.push(`${nomSql(date)} = ?`)
        const resultat = db
          .prepare(`UPDATE ${nomSql(table)} SET ${setters.join(', ')} WHERE ${nomSql(colonne)} = ?`)
          .run(...(date ? [destination.id, maintenant, source.id] : [destination.id, source.id]))
        if (resultat.changes) modifications[table] = resultat.changes
      }
      if (source.id_site_ccf !== null) {
        const resultat = db
          .prepare(
            'UPDATE tf_prepa_Broadcast SET IdSiteCCF = ?, dateModified = ? WHERE IdSiteCCF = ?',
          )
          .run(destination.id_site_ccf, maintenant, source.id_site_ccf)
        if (resultat.changes) modifications.tf_prepa_Broadcast = resultat.changes
      }
      const transfert = {
        source: source.nom,
        sourceId: source.id,
        destination: destination.nom,
        destinationId: destination.id,
        modifications,
      }
      rapport.transferts.push(transfert)
      if (Object.keys(modifications).length) {
        db.prepare(
          `INSERT INTO journal_audit
          (le, par_id, type_entite, entite_id, action, ancienne_valeur, nouvelle_valeur, complement, donnees)
          VALUES (?, ?, 'PLATEFORME', ?, 'MODIFICATION_PLATEFORME', ?, ?, ?, ?)`,
        ).run(
          maintenant,
          admin.id,
          String(source.id),
          source.nom,
          destination.nom,
          'Transfert des JDD autorisé par l’utilisateur ; plateforme source conservée.',
          JSON.stringify(transfert),
        )
      }
    }
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], 'Intégrité des références')
    for (const [table, n] of totauxAvant) {
      if (table !== 'journal_audit')
        assert.equal(
          total(table),
          n + (table === 'utilisateur_perimetre' ? perimetresAjoutes : 0),
          `Nombre de lignes conservé : ${table}`,
        )
    }
    for (const [table, valeur] of valeursAvant)
      assert.equal(lignes(table), valeur, `Données conservées : ${table}`)
    assert.equal(
      db
        .prepare(
          `SELECT count(*) AS n FROM tf_prepa_affiche p JOIN tr_atelier a ON a.id = p.ate_id
      WHERE p.plt_id != a.plt_id`,
        )
        .get().n,
      0,
      'Attendus et ateliers du même centre',
    )
    assert.equal(
      db
        .prepare(
          `SELECT count(*) AS n FROM asso_affiche_visuel r
      JOIN affiche a ON a.affiche_id = r.affiche_id JOIN tf_prepa_affiche p ON p.id = r.ligne_attendue_id
      WHERE r.actif = 1 AND a.plt_id != p.plt_id`,
        )
        .get().n,
      0,
      'Rattachements actifs du même centre',
    )
    for (const { table, colonne } of references) {
      if (table === 'utilisateur_perimetre') continue
      const placeholders = sources.map(() => '?').join(',')
      assert.equal(
        db
          .prepare(
            `SELECT count(*) AS n FROM ${nomSql(table)} WHERE ${nomSql(colonne)} IN (${placeholders})`,
          )
          .get(...sources.map((s) => s.id)).n,
        0,
        `Source vide : ${table}`,
      )
    }
    rapport.verifications =
      'Quantités et historiques conservés, mêmes nombres de lignes, références et périmètres cohérents.'
    db.exec(appliquer ? 'COMMIT' : 'ROLLBACK')
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }
  if (appliquer) {
    mkdirSync(resolve(racine, 'docs/_travail'), { recursive: true })
    writeFileSync(
      resolve(racine, 'docs/_travail/transfert-jdd-centres-2026-11-12.json'),
      JSON.stringify(rapport, null, 2) + '\n',
    )
  }
  console.log(JSON.stringify(rapport, null, 2))
} finally {
  db.close()
}
