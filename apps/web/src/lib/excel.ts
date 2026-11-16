// EX-NEW-ADM-001 : lecture et export XLSX navigateur, adaptés des utilitaires de la maquette (core.js, xlsxread.js).
export type CelluleExcel = string | number | boolean | Date | null | undefined
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const enc = new TextEncoder()
const xml = (s: string) =>
  s
    .split('')
    .filter((c) => c.charCodeAt(0) >= 32 || ['\t', '\n', '\r'].includes(c))
    .join('')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const colonne = (i: number) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff
  for (const v of b) c = (crcTable[(c ^ v) & 0xff] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function entete(longueur: number, champs: [number, number, number][]) {
  const b = new Uint8Array(longueur),
    v = new DataView(b.buffer)
  for (const [at, valeur, taille] of champs)
    if (taille === 4) v.setUint32(at, valeur, true)
    else v.setUint16(at, valeur, true)
  return b
}
function zip(fichiers: [string, string][]) {
  const parties: Uint8Array[] = [],
    central: Uint8Array[] = []
  let offset = 0
  for (const [nom, contenu] of fichiers) {
    const n = enc.encode(nom),
      b = enc.encode(contenu),
      crc = crc32(b)
    parties.push(
      entete(30, [
        [0, 0x04034b50, 4],
        [4, 20, 2],
        [14, crc, 4],
        [18, b.length, 4],
        [22, b.length, 4],
        [26, n.length, 2],
      ]),
      n,
      b,
    )
    central.push(
      entete(46, [
        [0, 0x02014b50, 4],
        [4, 20, 2],
        [6, 20, 2],
        [16, crc, 4],
        [20, b.length, 4],
        [24, b.length, 4],
        [28, n.length, 2],
        [42, offset, 4],
      ]),
      n,
    )
    offset += 30 + n.length + b.length
  }
  const tailleCentral = central.reduce((s, b) => s + b.length, 0)
  const fin = entete(22, [
    [0, 0x06054b50, 4],
    [8, fichiers.length, 2],
    [10, fichiers.length, 2],
    [12, tailleCentral, 4],
    [16, offset, 4],
  ])
  const tout = [...parties, ...central, fin],
    resultat = new Uint8Array(tout.reduce((s, b) => s + b.length, 0))
  let position = 0
  for (const b of tout) {
    resultat.set(b, position)
    position += b.length
  }
  return resultat
}
export function classeurExcel(
  titres: string[],
  lignes: CelluleExcel[][],
  titre = 'Export',
): Uint8Array {
  const ns = 'http://schemas.openxmlformats.org/',
    main = ns + 'spreadsheetml/2006/main',
    rel = ns + 'officeDocument/2006/relationships'
  const nom = titre.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Export'
  const cellule = (v: CelluleExcel, ref: string, head: boolean) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`
    if (v instanceof Date && Number.isFinite(v.getTime()))
      return `<c r="${ref}" s="2"><v>${v.getTime() / 86400000 + 25569}</v></c>`
    const texte = typeof v === 'boolean' ? (v ? 'Oui' : 'Non') : String(v)
    return `<c r="${ref}" t="inlineStr"${head ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(texte)}</t></is></c>`
  }
  const rows = [titres, ...lignes]
    .map(
      (r, i) =>
        `<row r="${i + 1}">${r.map((v, j) => cellule(v, `${colonne(j)}${i + 1}`, i === 0)).join('')}</row>`,
    )
    .join('')
  const fin = `${colonne(Math.max(0, titres.length - 1))}${lignes.length + 1}`
  return zip([
    [
      '[Content_Types].xml',
      `<Types xmlns="${ns}package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      '_rels/.rels',
      `<Relationships xmlns="${ns}package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="${xml(nom)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<Relationships xmlns="${ns}package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      'xl/styles.xml',
      `<styleSheet xmlns="${main}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="22" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ],
    [
      'xl/worksheets/sheet1.xml',
      `<worksheet xmlns="${main}"><dimension ref="A1:${fin}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${titres.map((t, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(14, t.length + 3))}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${fin}"/></worksheet>`,
    ],
  ])
}
export function exporterExcel(nom: string, titres: string[], lignes: CelluleExcel[][]) {
  const b = classeurExcel(titres, lignes, nom),
    url = URL.createObjectURL(new Blob([new Uint8Array(b)], { type: MIME })),
    a = document.createElement('a')
  a.href = url
  a.download = nom.replace(/\.(csv|xlsx)$/i, '') + '.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
// Import borné, première feuille, chaînes partagées ou inline ; aucun calcul de formule ni exécution de macro.
export async function lireExcel(fichier: File): Promise<string[][]> {
  if (fichier.size > 10 * 1024 * 1024) throw new Error('Le classeur dépasse 10 Mo.')
  const b = new Uint8Array(await fichier.arrayBuffer()),
    view = new DataView(b.buffer)
  const u16 = (o: number) => view.getUint16(o, true),
    u32 = (o: number) => view.getUint32(o, true)
  let e = b.length - 22
  while (e >= Math.max(0, b.length - 65558) && u32(e) !== 0x06054b50) e--
  if (e < Math.max(0, b.length - 65558))
    throw new Error('Ce fichier n’est pas un classeur Excel XLSX.')
  const rep = new Map<
    string,
    { methode: number; taille: number; brut: number; debut: number; crc: number }
  >()
  let p = u32(e + 16),
    total = 0
  for (let i = 0; i < u16(e + 10); i++) {
    if (u32(p) !== 0x02014b50) throw new Error('Archive Excel endommagée.')
    const nl = u16(p + 28),
      el = u16(p + 30),
      cl = u16(p + 32),
      brut = u32(p + 24)
    total += brut
    if (total > 50 * 1024 * 1024 || u16(e + 10) > 5000)
      throw new Error('Classeur trop volumineux après décompression.')
    rep.set(new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl)), {
      methode: u16(p + 10),
      crc: u32(p + 16),
      taille: u32(p + 20),
      brut,
      debut: u32(p + 42),
    })
    p += 46 + nl + el + cl
  }
  async function lire(nom: string) {
    const r = rep.get(nom)
    if (!r) return null
    const deb = r.debut + 30 + u16(r.debut + 26) + u16(r.debut + 28),
      data = b.slice(deb, deb + r.taille)
    if (r.methode !== 0 && r.methode !== 8)
      throw new Error('Compression Excel non prise en charge.')
    const contenu =
      r.methode === 0
        ? data
        : new Uint8Array(
            await new Response(
              new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
            ).arrayBuffer(),
          )
    if (contenu.length !== r.brut || crc32(contenu) !== r.crc)
      throw new Error('Feuille Excel corrompue.')
    const doc = new DOMParser().parseFromString(
      new TextDecoder().decode(contenu),
      'application/xml',
    )
    if (doc.querySelector('parsererror')) throw new Error('Feuille Excel illisible.')
    return doc
  }
  const sheet = [...rep.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))[0]
  if (!sheet) throw new Error('Aucune feuille trouvée dans le classeur.')
  const tous = (n: Document | Element, nom: string) =>
    Array.from(n.getElementsByTagNameNS('*', nom))
  const ss = await lire('xl/sharedStrings.xml'),
    textes = ss
      ? tous(ss, 'si').map((si) =>
          tous(si, 't')
            .map((t) => t.textContent)
            .join(''),
        )
      : []
  const doc = await lire(sheet)
  if (!doc) throw new Error('Feuille absente.')
  const lignes = tous(doc, 'row')
  if (lignes.length > 10001) throw new Error('La feuille dépasse 10 000 lignes de données.')
  return lignes.map((row) => {
    const cells: string[] = []
    for (const c of tous(row, 'c')) {
      const ref = c.getAttribute('r') ?? '',
        t = c.getAttribute('t'),
        v = tous(c, 'v')[0]?.textContent ?? ''
      let col = 0
      for (const ch of ref.replace(/[0-9]/g, '')) col = col * 26 + ch.charCodeAt(0) - 64
      if (col > 1000) throw new Error('La feuille contient trop de colonnes.')
      if (col > 0)
        cells[col - 1] =
          t === 's'
            ? (textes[Number(v)] ?? '')
            : t === 'inlineStr'
              ? tous(c, 't')
                  .map((t) => t.textContent)
                  .join('')
              : v
    }
    return Array.from({ length: cells.length }, (_, i) => cells[i] ?? '')
  })
}
