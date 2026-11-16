// Contrôle de la matrice de traçabilité (étape 10) : node docs/_travail/controle-tracabilite.mjs [--json]
// Vérifie : (1) cohérence EX <-> RG (aucun EX « FAIT » si une RG couverte ne l'est pas, statut dérivé attendu) ;
// (2) fichiers cités existants (chemins complets ou noms de fichier uniques) et fonctions citées présentes ;
// (3) tout FAIT / PARTIEL d'une RG a son identifiant dans au moins un test (apps/**/test, *.test.ts, e2e/) ;
// (4) cohérence du tableau « Synthèse » avec les lignes. Code de sortie 1 s'il reste une anomalie.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, basename, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const matrice = readFileSync(join(racine, 'docs/MATRICE_TRACABILITE_SPECIFICATIONS.md'), 'utf8').split('\n')

// ---------- lecture de la matrice
const lignes = new Map()
for (const l of matrice) {
  const p = l.split('|')
  if (p.length < 12) continue
  const id = p[1].trim()
  if (!/^(EX|RG|ECR)-/.test(id)) continue
  lignes.set(id, {
    id,
    type: p[2].trim(),
    impl: p[7].trim(),
    tests: p[8].trim(),
    statut: p[9].trim(),
    remarque: p.slice(10, -1).join('|').trim(),
  })
}

// ---------- parcours des fichiers
const IGNORES = new Set(['node_modules', 'generated', 'dist', '.output', '.nitro', '.tanstack', 'test-results', 'playwright-report', '.git', 'circe-develop', 'docs-sources'])
const fichiers = []
function parcourir(dir) {
  for (const n of readdirSync(dir)) {
    if (IGNORES.has(n)) continue
    const p = join(dir, n)
    const s = statSync(p)
    if (s.isDirectory()) parcourir(p)
    else fichiers.push(p)
  }
}
for (const d of ['apps', 'packages', 'e2e']) parcourir(join(racine, d))
const rel = (p) => p.slice(racine.length + 1)
const parNom = new Map()
for (const f of fichiers) {
  const n = basename(f)
  if (!parNom.has(n)) parNom.set(n, [])
  parNom.get(n).push(f)
}
const estTest = (f) => /\.test\.tsx?$/.test(f) || /\.spec\.ts$/.test(f) || /[\\/]test[\\/]/.test(f) || f.includes('/e2e/')
const textesTests = fichiers.filter(estTest).map((f) => readFileSync(f, 'utf8'))
const corpusTests = textesTests.join('\n')
const contenu = new Map()
const lire = (f) => {
  if (!contenu.has(f)) contenu.set(f, readFileSync(f, 'utf8'))
  return contenu.get(f)
}

// ---------- statut dérivé d'un EX
const norm = (s) => (s.startsWith('NON REPRIS') ? 'NR' : s)
function deriver(statuts) {
  const S = new Set(statuts.map(norm))
  if (S.size === 1) {
    const [u] = [...S]
    if (u === 'FAIT' || u === 'BLOQUÉ' || u === 'À FAIRE') return u
  }
  return 'PARTIEL'
}
// couverture complète : le matrice abrège certaines listes en « (+n) » ; surcharge explicite (sources : sections de règles)
const COMPLEMENT = {
  'EX-COO-503': ['RG-X-076', 'RG-X-077'],
  'EX-COO-014': ['RG-X-050', 'RG-X-053', 'RG-X-084'],
  'EX-COO-044': ['RG-X-083', 'RG-X-085'],
}
function couverture(ex) {
  const m = /Couvert par ([^·]*)/.exec(ex.remarque)
  if (!m) return null
  const seg = m[1].split(';')[0]
  return [...(seg.match(/RG-[A-Z]+-\d+/g) ?? []), ...(COMPLEMENT[ex.id] ?? [])]
}

const anomalies = []
const ano = (cat, id, msg) => anomalies.push({ cat, id, msg })

// (1) EX <-> RG
for (const ex of lignes.values()) {
  if (ex.type !== 'EX') continue
  const cov = couverture(ex)
  if (!cov) continue
  const sts = []
  for (const r of cov) {
    const l = lignes.get(r)
    if (!l) ano('EX-RG', ex.id, `RG couverte inconnue : ${r}`)
    else sts.push(l.statut)
  }
  if (sts.length === 0) continue
  const attendu = deriver(sts)
  if (ex.statut === 'FAIT' && attendu !== 'FAIT') ano('EX-RG', ex.id, `EX FAIT alors que sa couverture donne ${attendu}`)
  else if (ex.statut !== attendu && !/Statut forcé/.test(ex.remarque)) ano('EX-RG', ex.id, `statut ${ex.statut}, dérivé de ses RG : ${attendu}`)
  // mention « reste : » à jour
  const reste = cov.filter((r) => lignes.get(r) && lignes.get(r).statut !== 'FAIT')
  const mention = /; reste : (.*?)(?: · |$)/.exec(ex.remarque)
  const cites = mention ? (mention[1].match(/RG-[A-Z]+-\d+/g) ?? []) : []
  if (JSON.stringify([...cites].sort()) !== JSON.stringify([...reste].sort()))
    ano('EX-RESTE', ex.id, `mention « reste » périmée (attendu : ${reste.join(', ') || 'aucune'} ; trouvé : ${cites.join(', ') || 'aucune'})`)
}

// (2) fichiers et fonctions cités
const EXT = '(?:tsx?|mjs|md|prisma|sql|json)'
function verifierRefs(id, cellule, champ) {
  for (const seg of cellule.split(';')) {
    const re = new RegExp(`((?:[\\w@.-]+/)*[\\w.$-]+\\.${EXT})(?::([\\w$.,\\s]+?))?(?=[\\s,)(;]|$)`, 'g')
    let m
    while ((m = re.exec(seg))) {
      const chemin = m[1]
      if (/^(docs|\.env)/.test(chemin) || /\.d\.ts$/.test(chemin)) continue
      let cands = []
      if (existsSync(join(racine, chemin))) cands = [join(racine, chemin)]
      else cands = (parNom.get(basename(chemin)) ?? []).filter((f) => rel(f).endsWith(chemin))
      if (cands.length === 0) {
        ano('FICHIER', id, `${champ} : fichier introuvable « ${chemin} »`)
        continue
      }
      if (m[2]) {
        for (const nom of m[2].split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean)) {
          if (!/^[A-Za-z_$][\w$]*$/.test(nom)) continue
          const re2 = new RegExp(`(?<![\\w$])${nom.replace(/\$/g, '\\$')}(?![\\w$])`)
          if (!cands.some((f) => re2.test(lire(f)))) ano('FONCTION', id, `${champ} : « ${nom} » absent de ${rel(cands[0])}`)
        }
      }
    }
  }
}
for (const l of lignes.values()) {
  verifierRefs(l.id, l.impl, 'Implémentation')
  verifierRefs(l.id, l.tests, 'Tests')
}

// (3) identifiant présent dans au moins un test pour tout FAIT / PARTIEL (RG) ; ECR / EX : au moins un test cité existant
for (const l of lignes.values()) {
  if (l.statut !== 'FAIT' && l.statut !== 'PARTIEL') continue
  if (l.type === 'RG') {
    if (!corpusTests.includes(l.id)) ano('TEST-ID', l.id, `${l.statut} sans aucun test portant l'identifiant`)
  } else if (l.type === 'ECR' && l.statut === 'FAIT' && !l.tests) ano('TEST-ID', l.id, 'ECR FAIT sans test cité')
}

// (4) synthèse
const comptes = {}
for (const l of lignes.values()) {
  const k = `${l.type}|${l.id.split('-')[1]}`
  comptes[k] ??= { total: 0 }
  comptes[k].total++
  const s = l.statut.startsWith('NON REPRIS') ? 'NON REPRIS' : l.statut
  comptes[k][s] = (comptes[k][s] ?? 0) + 1
}
const synth = matrice.filter((l) => /^\| (ECR|EX|RG) · /.test(l))
for (const s of synth) {
  const p = s.split('|').map((x) => x.trim())
  const [t, mod] = p[1].split(' · ')
  const modCode = mod.split(' ')[0]
  const c = comptes[`${t}|${modCode}`]
  if (!c || String(c.total) !== p[2]) ano('SYNTHESE', p[1], `total ${p[2]} ≠ ${c ? c.total : 0}`)
}

// ---------- sortie
const parCat = {}
for (const a of anomalies) parCat[a.cat] = (parCat[a.cat] ?? 0) + 1
const totaux = {}
for (const l of lignes.values()) {
  const k = l.type + (l.type === 'RG' ? ` ${l.id.split('-')[1] === 'X' ? 'X' : l.id.split('-')[1]}` : '')
  totaux[k] ??= {}
  const s = l.statut.startsWith('NON REPRIS') ? 'NON REPRIS' : l.statut
  totaux[k][s] = (totaux[k][s] ?? 0) + 1
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ totaux, anomalies: parCat, detail: anomalies }, null, 2))
else {
  console.log(`Lignes lues : ${lignes.size}`)
  console.log('Comptes par statut :', JSON.stringify(totaux))
  console.log(`Anomalies : ${anomalies.length}`, JSON.stringify(parCat))
  for (const a of anomalies.slice(0, 400)) console.log(`  [${a.cat}] ${a.id} : ${a.msg}`)
}
process.exitCode = anomalies.length > 0 ? 1 : 0
