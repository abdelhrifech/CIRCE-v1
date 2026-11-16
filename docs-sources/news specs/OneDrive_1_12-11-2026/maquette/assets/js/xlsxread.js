/* Lecture d'un classeur Excel (.xlsx) dans le navigateur, sans bibliothèque ni réseau (09/11, import de la liste des déclarants).
   Un .xlsx est une archive zip : on lit son répertoire central, on décompresse les pages utiles (DecompressionStream, intégré à Edge
   et Chrome, aussi depuis un fichier local) puis on lit les chaînes partagées et la première feuille.
   M.readXLSX(fichier) → Promise<tableau de lignes, chaque ligne un tableau de textes> (première feuille). */
(function () {
  'use strict';
  const M = window.M;
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const inflate = async data => {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter(); w.write(data); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  };
  /** Répertoire central du zip : nom → { méthode, taille compressée, position de l'entrée }. */
  function repertoire(b) {
    let e = b.length - 22;
    while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Ce fichier n’est pas un classeur Excel (.xlsx).');
    const n = u16(b, e + 10); let p = u32(b, e + 16);
    const out = {};
    for (let i = 0; i < n && u32(b, p) === 0x02014b50; i++) {
      const nl = u16(b, p + 28), el = u16(b, p + 30), cl = u16(b, p + 32);
      out[new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl))] = { methode: u16(b, p + 10), taille: u32(b, p + 20), debut: u32(b, p + 42) };
      p += 46 + nl + el + cl;
    }
    return out;
  }
  async function texte(b, rep, nom) {
    const e = rep[nom];
    if (!e) return null;
    const d = e.debut, deb = d + 30 + u16(b, d + 26) + u16(b, d + 28);
    const brut = b.subarray(deb, deb + e.taille);
    if (e.methode !== 0 && e.methode !== 8) throw new Error('Compression non prise en charge dans ce classeur.');
    return new TextDecoder('utf-8').decode(e.methode === 0 ? brut : await inflate(brut));
  }
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const tous = (n, nom) => Array.from(n.getElementsByTagNameNS('*', nom));
  /** « B7 » → colonne 1 (A = 0). */
  const colonne = ref => { let c = 0; for (const ch of ref.replace(/[0-9]/g, '')) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; };

  M.readXLSX = async function (fichier) {
    const b = new Uint8Array(await fichier.arrayBuffer());
    const rep = repertoire(b);
    const feuille = Object.keys(rep).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((x, y) => parseInt(x.match(/\d+/)[0], 10) - parseInt(y.match(/\d+/)[0], 10))[0];
    if (!feuille) throw new Error('Aucune feuille trouvée dans ce classeur.');
    const ss = await texte(b, rep, 'xl/sharedStrings.xml');
    const chaines = ss ? tous(xml(ss), 'si').map(si => tous(si, 't').map(t => t.textContent).join('')) : [];
    const lignes = [];
    tous(xml(await texte(b, rep, feuille)), 'row').forEach(row => {
      const cells = [];
      tous(row, 'c').forEach(c => {
        const ref = c.getAttribute('r'), t = c.getAttribute('t');
        const v = c.getElementsByTagNameNS('*', 'v')[0];
        const val = t === 's' ? chaines[Number(v && v.textContent)] : t === 'inlineStr' ? tous(c, 't').map(x => x.textContent).join('') : v ? v.textContent : '';
        if (ref) cells[colonne(ref)] = val === undefined ? '' : val;
      });
      lignes.push(Array.from(cells, x => (x === undefined ? '' : x)));
    });
    return lignes;
  };
})();
