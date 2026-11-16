/* ==========================================================================
   Circé — maquette cible : noyau
   Utilitaires DOM (texte toujours via textContent), formats, état global,
   bus d'événements, routeur par ancre (#/ecran?param=valeur), mise en page.
   Scripts classiques (pas de modules) : la maquette s'ouvre en file:// sans serveur.
   ========================================================================== */
(function () {
  'use strict';
  const M = window.M = window.M || {};

  /* ---------- Construction DOM ---------- */
  const BOOL_PROPS = new Set(['disabled', 'checked', 'selected', 'hidden', 'readOnly', 'multiple', 'required']);
  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(c => append(el, c)); return; }
    if (child instanceof Node) { el.appendChild(child); return; }
    el.appendChild(document.createTextNode(String(child)));
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (BOOL_PROPS.has(k)) el[k] = !!v;
        else if (k === 'value') el.value = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    kids.forEach(c => append(el, c));
    return el;
  }
  M.h = h;
  M.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  M.mount = (el, ...kids) => { M.clear(el); kids.forEach(k => append(el, k)); return el; };

  /* ---------- Formats ---------- */
  const NF = new Intl.NumberFormat('fr-FR');
  const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const toDate = d => (d instanceof Date ? d : new Date(d));
  const pad = n => String(n).padStart(2, '0');
  M.fmt = {
    n: v => (v === null || v === undefined || v === '' || Number.isNaN(v)) ? '—' : NF.format(Math.round(v)),
    pct: (v, digits = 0) => (v === null || v === undefined || !isFinite(v)) ? '—' : (v * 100).toFixed(digits).replace('.', ',') + ' %',
    d: d => { if (!d) return '—'; const x = toDate(d); return pad(x.getDate()) + '/' + pad(x.getMonth() + 1); },
    dy: d => { if (!d) return '—'; const x = toDate(d); return pad(x.getDate()) + '/' + pad(x.getMonth() + 1) + '/' + x.getFullYear(); },
    dt: d => { if (!d) return '—'; const x = toDate(d); return pad(x.getDate()) + '/' + pad(x.getMonth() + 1) + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes()); },
    day: d => { if (!d) return '—'; const x = toDate(d); return JOURS[x.getDay()] + ' ' + pad(x.getDate()) + '/' + pad(x.getMonth() + 1); },
    hm: d => { const x = toDate(d); return pad(x.getHours()) + 'h' + pad(x.getMinutes()); },
    sem: s => 'S' + s,
    /** Libellé d'un ensemble de semaines : « S43 », « S43 + S45 », « S42 à S45 », ou « toutes les semaines ». */
    sems: arr => {
      const a = Array.from(new Set((arr || []).map(Number))).sort((x, y) => x - y);
      if (!a.length) return 'toutes les semaines';
      if (a.length > 2 && a.every((v, i) => !i || v === a[i - 1] + 1)) return 'S' + a[0] + ' à S' + a[a.length - 1];
      return a.map(v => 'S' + v).join(' + ');
    },
    signed: v => (v > 0 ? '+' : '') + NF.format(Math.round(v)),
  };
  M.iso = d => { const x = toDate(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()) + 'T' + pad(x.getHours()) + ':' + pad(x.getMinutes()); };

  /* ---------- Divers ---------- */
  M.sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  M.groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  M.uniq = arr => Array.from(new Set(arr));
  M.byId = (arr, id) => arr.find(x => x.id === id);
  let seq = 1000;
  M.uid = (prefix) => (prefix || 'id') + '-' + (++seq);
  M.download = function (filename, content, mime) {
    // Texte en UTF-8 ; contenu binaire (classeur Excel) tel quel
    const blob = new Blob([content], { type: (mime || 'text/plain') + (typeof content === 'string' ? ';charset=utf-8' : '') });
    const a = h('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  /** CSV : réservé aux fichiers machine (Vendôme, multi-rouleuse) ; les exports de tableaux se font en Excel (M.toXLSX). */
  M.toCSV = function (rows, cols, sep) {
    sep = sep || ';';
    const esc = v => { const s = (v === null || v === undefined) ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const head = cols.map(c => esc(c.label)).join(sep);
    return [head].concat(rows.map(r => cols.map(c => esc(c.csv ? c.csv(r) : (typeof c.value === 'function' ? c.value(r) : r[c.key]))).join(sep))).join('\r\n');
  };

  /* ---------- Export Excel (.xlsx), sans librairie ----------
     Un classeur d'une feuille : ZIP « stocké » (sans compression) contenant les parties XML minimales d'Office Open XML.
     En-tête en gras et figé, filtre automatique, largeurs ajustées ; les nombres restent des nombres, les dates (objets Date
     ou horodatages en millisecondes) deviennent des dates Excel. */
  M.XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  /** Archive ZIP sans compression : [[nom, octets]] → Uint8Array. */
  function zipStore(entries) {
    const now = new Date(), enc = new TextEncoder();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [], central = [];
    let offset = 0;
    entries.forEach(([name, data]) => {
      const nb = enc.encode(name), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nb.length, 2], [28, 0, 2]]
        .forEach(([at, v, n]) => (n === 4 ? lh.setUint32(at, v, true) : lh.setUint16(at, v, true)));
      parts.push(new Uint8Array(lh.buffer), nb, data);
      const ch = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nb.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
        .forEach(([at, v, n]) => (n === 4 ? ch.setUint32(at, v, true) : ch.setUint16(at, v, true)));
      central.push(new Uint8Array(ch.buffer), nb);
      offset += 30 + nb.length + data.length;
    });
    const size = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, entries.length, 2], [10, entries.length, 2], [12, size, 4], [16, offset, 4], [20, 0, 2]]
      .forEach(([at, v, n]) => (n === 4 ? end.setUint32(at, v, true) : end.setUint16(at, v, true)));
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
    let k = 0;
    all.forEach(p => { out.set(p, k); k += p.length; });
    return out;
  }
  /** Classeur Excel : rows et cols comme M.toCSV ({ label, value | csv | key }). Renvoie les octets du fichier .xlsx. */
  M.toXLSX = function (rows, cols, sheetName) {
    const esc = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const colName = i => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
    const isDate = v => v instanceof Date || (typeof v === 'number' && v > 9e11 && v < 4.2e12);
    const serial = v => { const d = v instanceof Date ? v : new Date(v); return (d.getTime() - d.getTimezoneOffset() * 60000) / 864e5 + 25569; };
    const valueOf = (c, r) => { const v = c.csv ? c.csv(r) : (typeof c.value === 'function' ? c.value(r) : r[c.key]); return typeof v === 'boolean' ? (v ? 'Oui' : 'Non') : v; };
    const widths = cols.map(c => String(c.label || '').length);
    const cell = (ref, v, head) => {
      if (v === null || v === undefined || v === '') return '';
      if (!head && isDate(v)) return '<c r="' + ref + '" s="2"><v>' + serial(v) + '</v></c>';
      if (!head && typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"><v>' + v + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"' + (head ? ' s="1"' : '') + '><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
    };
    const lignes = [cols.map((c, j) => cell(colName(j) + '1', c.label || '', true)).join('')]
      .concat(rows.map((r, i) => cols.map((c, j) => {
        const v = valueOf(c, r);
        widths[j] = Math.max(widths[j], isDate(v) ? 16 : String(v === null || v === undefined ? '' : v).length);
        return cell(colName(j) + (i + 2), v);
      }).join('')));
    const lastCol = colName(Math.max(0, cols.length - 1)), lastRow = rows.length + 1;
    const nom = String(sheetName || 'Export').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Export';
    const NS = 'http://schemas.openxmlformats.org/', MAIN = NS + 'spreadsheetml/2006/main', REL = NS + 'officeDocument/2006/relationships';
    const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const sheet = '<worksheet xmlns="' + MAIN + '" xmlns:r="' + REL + '"><dimension ref="A1:' + lastCol + lastRow + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      (cols.length ? '<cols>' + widths.map((w, j) => '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + Math.min(60, Math.max(8, w + 2)) + '" customWidth="1"/>').join('') + '</cols>' : '') +
      '<sheetData>' + lignes.map((l, i) => '<row r="' + (i + 1) + '">' + l + '</row>').join('') + '</sheetData>' +
      (cols.length ? '<autoFilter ref="A1:' + lastCol + lastRow + '"/>' : '') + '</worksheet>';
    const files = [
      ['[Content_Types].xml', '<Types xmlns="' + NS + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<Relationships xmlns="' + NS + 'package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<workbook xmlns="' + MAIN + '" xmlns:r="' + REL + '"><bookViews><workbookView/></bookViews><sheets><sheet name="' + esc(nom) + '" sheetId="1" r:id="rId1"/></sheets>' +
        (cols.length ? '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">' + esc("'" + nom.replace(/'/g, "''") + "'!$A$1:$" + lastCol + '$' + lastRow) + '</definedName></definedNames>' : '') + '</workbook>'],
      ['xl/_rels/workbook.xml.rels', '<Relationships xmlns="' + NS + 'package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + REL + '/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', '<styleSheet xmlns="' + MAIN + '"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/></numFmts>' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
      ['xl/worksheets/sheet1.xml', sheet],
    ];
    const enc = new TextEncoder();
    return zipStore(files.map(([n, s]) => [n, enc.encode(head + s)]));
  };
  /** Télécharge un tableau en Excel : le nom de fichier prend l'extension .xlsx, la feuille porte le nom du fichier. */
  M.downloadXLSX = function (filename, rows, cols) {
    const base = String(filename).replace(/\.(csv|xlsx)$/i, '');
    M.download(base + '.xlsx', M.toXLSX(rows, cols, base), M.XLSX_MIME);
  };

  /* ---------- Événements ---------- */
  const handlers = {};
  M.on = (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); };
  M.emit = (evt, payload) => { (handlers[evt] || []).forEach(fn => fn(payload)); };

  /* ---------- État global (filtres de la barre du haut) ---------- */
  // La Pré-Prod ne travaille pas dans Circé : elle saisit les IP et envoie la préparation depuis Broadcast. Le travail
  // humain de la pré-production dans Circé (validation admin, Instructions OK « En cours », export des trains du jeudi
  // 14 h) est celui de la Coordination (27/10).
  M.ROLES = [
    { id: 'coord', label: 'Coordination' },
    { id: 'cheq', label: "Chef d'équipe" },
    { id: 'recep', label: 'Agent de réception' },
    { id: 'expe', label: "Agent d'expédition" },
    { id: 'admin', label: 'Administrateur' },
    { id: 'com', label: 'Commerce (lecture)' },
  ];
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem('circe-maquette-state') || '{}'); } catch (e) { return {}; } })();
  // La semaine n'est plus un réglage global : c'est un filtre de page (« Départ »). M.state.semaine reste la
  // semaine en production, référence des compteurs du menu et des actions qui portent sur une semaine.
  delete saved.semaine;
  // Rôle gardé d'une session précédente et disparu depuis (ex « pp » avant le 27/10) : rôle par défaut
  if (saved.role && !M.ROLES.some(r => r.id === saved.role)) delete saved.role;
  M.state = Object.assign({ site: 'ALL', semaine: 43, role: 'cheq', annot: true }, saved);
  M.setState = function (patch) {
    Object.assign(M.state, patch);
    try { sessionStorage.setItem('circe-maquette-state', JSON.stringify({ site: M.state.site, role: M.state.role, annot: M.state.annot })); } catch (e) { /* stockage indisponible */ }
    document.body.classList.toggle('no-annot', !M.state.annot);
    M.refresh();
  };
  /** Périmètre : le site du bandeau, et par défaut la semaine en production (allWeeks pour toutes). */
  M.inScope = function (obj, opts) {
    opts = opts || {};
    if (M.state.site !== 'ALL' && obj.site !== M.state.site) return false;
    if (!opts.allWeeks && obj.semaine !== undefined && obj.semaine !== M.state.semaine) return false;
    return true;
  };

  /* ---------- Écrans et routeur ---------- */
  /** Écran d'ouverture : Pilotage › Suivi de prod (plus de page d'accueil, décision du 16/10) ; le logo y ramène. */
  M.DEPART = 'suivi';
  M.screens = {};
  M.screenOrder = [];
  M.screen = function (def) { M.screens[def.id] = def; M.screenOrder.push(def.id); };
  M.parseHash = function () {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const params = {};
    (query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { id: path || M.DEPART, params };
  };
  M.link = function (id, params) {
    const q = params ? Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : '';
    return '#/' + id + (q ? '?' + q : '');
  };
  /* Retour (19/10) : un lien dans la page (M.go : indicateur, alerte, ligne, bouton) empile la page quittée, et l'en-tête de
     la page ouverte propose « ← Retour : <page quittée> », avec ses filtres. Revenir dépile ; le menu ou un autre lien vide la pile. */
  M.pile = [];
  let attendu = null;
  M.go = function (id, params) {
    const target = M.link(id, params);
    if (location.hash === target) { M.navSeq++; M.refresh(); return; }
    M.pile.push({ hash: location.hash, titre: M.titrePage || 'page précédente' });
    if (M.pile.length > 20) M.pile.shift();
    attendu = target;
    location.hash = target;
  };
  M.retour = () => { const p = M.pile[M.pile.length - 1]; if (p) location.hash = p.hash; };
  /** Tient la pile à jour quand l'adresse change : navigation attendue (M.go), retour à la page du dessus, ou autre. */
  const suivrePile = () => {
    const top = M.pile[M.pile.length - 1];
    if (location.hash === attendu) attendu = null;
    else if (top && location.hash === top.hash) M.pile.pop();
    else { M.pile = []; attendu = null; }
  };
  /** Numéro de navigation : change à chaque arrivée sur un écran (lien, menu), pas quand on filtre dans la page.
      Sert aux filtres posés par un lien (preset), appliqués une fois par arrivée. */
  M.navSeq = 1;

  M.current = { id: M.DEPART, params: {} };
  M.refresh = function () {
    renderTopbar();
    renderMenubar();
    renderMain();
  };
  /** Filtres juste au-dessus du tableau (19/10, « tous les tableaux de la maquette ») : la barre de filtres de la page passe
      dans la ligne d'outils du premier tableau qui la suit, au-dessus des colonnes. Une barre qui pilote aussi des graphiques
      reste sous l'en-tête (option page de ui.filters : le dashboard). */
  function filtresDansLeTableau(main) {
    main.querySelectorAll('.cz-filterbar.cz-filters:not(.cz-filters-page)').forEach(bar => {
      const outils = Array.from(main.querySelectorAll('.cz-table-toolbar')).find(t => bar.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (!outils) return;
      outils.insertBefore(bar, outils.firstChild);
      // Le champ « Dossier » tient lieu de recherche : celle du tableau ne reste que si un lien y a posé un texte
      const rech = outils.querySelector('.cz-table-search'), saisie = rech && rech.querySelector('input');
      if (rech && bar.querySelector('.cz-dfield') && !(saisie && saisie.value)) rech.hidden = true;
    });
  }
  function renderMain() {
    const main = document.getElementById('main');
    const route = M.parseHash();
    const def = M.screens[route.id] || M.screens[M.DEPART];
    const sameScreen = M.current.id === def.id;
    const scroll = sameScreen ? main.scrollTop : 0;
    M.current = { id: def.id, params: route.params };
    if (M.ui && M.ui.disposeWidgets) M.ui.disposeWidgets(main);
    M.clear(main);
    try {
      def.render(main, route.params);
      filtresDansLeTableau(main);
    } catch (err) {
      console.error(err);
      main.appendChild(h('div', { class: 'alert alert-danger' }, h('div', null, h('h4', { class: 'alert-heading' }, "Erreur d'affichage de l'écran"), h('div', { class: 'alert-description' }, String(err && err.message || err)))));
    }
    main.scrollTop = scroll;
    document.title = (def.title || 'Circé') + ' — Circé (maquette)';
  }

  /* ---------- Bandeau 1 (bleu nuit) : logo, périmètre commun, horloge, actions globales ---------- */
  function select(value, options, onChange, label) {
    return h('select', { class: 'form-select form-select-sm', 'aria-label': label, onchange: e => onChange(e.target.value) },
      options.map(o => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  }
  function renderTopbar() {
    const bar = document.getElementById('topbar');
    const D = M.data;
    const ui = M.ui;
    const nbAlertes = D ? M.calc.alertes().filter(a => !a.acquittee).length : 0;
    const nbCrit = D ? M.calc.alertes().filter(a => !a.acquittee && a.sev === 'critical').length : 0;
    const nbMails = D ? D.outbox.filter(m => !m.lu).length : 0;
    M.mount(bar, h('div', { class: 'cz-top' },
      h('a', { class: 'cz-brand', href: M.link(M.DEPART), title: 'Suivi de prod (Pilotage)' },
        h('span', { class: 'cz-brand-name' }, 'Circ', h('span', null, 'é')),
        h('span', { class: 'cz-brand-tag' }, 'Maquette cible')),
      h('div', { class: 'cz-top-filters' },
        h('label', { class: 'cz-top-field' }, h('span', null, 'Site'),
          select(M.state.site, [{ value: 'ALL', label: 'Tous les sites' }].concat(M.ref.sites.map(s => ({ value: s.id, label: s.label + (s.cible ? ' (cible)' : '') }))), v => M.setState({ site: v }), 'Site')),
        h('label', { class: 'cz-top-field' }, h('span', null, 'Rôle'),
          select(M.state.role, M.ROLES.map(r => ({ value: r.id, label: r.label })), v => { M.setState({ role: v }); }, 'Rôle'))),
      h('div', { class: 'cz-top-actions' },
        h('button', { type: 'button', class: 'cz-icon-btn', title: 'Alertes ouvertes (' + nbAlertes + ', dont ' + nbCrit + ' critiques)', 'aria-label': 'Alertes', onclick: () => M.go('alertes') },
          ui.icon('bell'), nbAlertes ? h('span', { class: ['badge', nbCrit ? 'bg-red' : 'bg-secondary', 'text-white'] }, nbAlertes) : null),
        h('button', { type: 'button', class: 'cz-icon-btn', title: "Mails envoyés par l'application (simulés)", 'aria-label': 'Mails', onclick: () => M.ui.mailbox() },
          ui.icon('mail'), nbMails ? h('span', { class: 'badge bg-primary text-white' }, nbMails) : null),
        h('span', { class: 'cz-top-sep', 'aria-hidden': 'true' }),
        h('button', { type: 'button', class: 'cz-top-tool', title: 'Déclencher un événement pour la démonstration', onclick: e => M.ui.simulateMenu(e.currentTarget) }, ui.icon('player-play'), 'Simuler'),
        h('label', { class: 'form-check form-switch', title: 'Afficher les besoins couverts par chaque écran' },
          h('input', { class: 'form-check-input', type: 'checkbox', checked: !!M.state.annot, onchange: e => M.setState({ annot: e.target.checked }) }),
          h('span', { class: 'form-check-label' }, 'Besoins')),
        h('button', { type: 'button', class: 'cz-top-tool cz-top-tool-icon', title: 'Aide de la maquette', 'aria-label': 'Aide de la maquette', 'aria-haspopup': 'true', onclick: e => aideMenu(e.currentTarget) },
          ui.icon('help-circle'), ui.icon('chevron-down', 'cz-chev')))));
  }
  /** Menu « Aide » : pages propres à la maquette (elles ne font pas partie de la cible). */
  function aideMenu(anchor) {
    const menu = M.ui.menuAt(anchor, 300);
    M.mount(menu,
      h('div', { class: 'cz-menu-help' }, 'Aide à la lecture de la maquette. Données fictives.'),
      M.NAV_AIDE.map(id => h('a', { class: 'dropdown-item', href: M.link(id) }, M.ui.icon(M.NAV_ICONS[id] || 'circle-dot'), M.screens[id].nav || M.screens[id].title)),
      h('div', { class: 'cz-menu-help', style: { paddingTop: '8px' } }, 'Date simulée : ' + M.fmt.day(M.NOW) + ' ' + M.fmt.hm(M.NOW) + ', production S' + M.SEM_PROD + ' pour le départ S' + (M.SEM_PROD + 1) + '. Dans les onglets, les pages grisées servent moins au rôle choisi.'));
    const close = M.ui.popup(menu);
    menu.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  }

  /* ---------- Bandeau 2 (blanc) : un onglet par type de production et par domaine partagé ---------- */
  /** Onglets repris de Circé : ses trois types de production (2M2FIXE, PLIAGE, DEROULANT, code : Enums.cs:34-45) et ses
      domaines partagés (Réception, Expédition), plus Pilotage, Stocks, Bus (cible) et Administration (15/10).
      Plus d'onglet Pré-production (04/11, décision de l'utilisatrice) : le travail de la Coordination se fait dans les pages
      des autres onglets. Validation admin en lot, tous formats : Réception › Liste des affiches ; Instruction OK et export :
      Déroulant › Liste des instructions, Liste des trains ; dossiers du fixe et du pliage : leur page « À traiter » ;
      vérification des thèmes : Pilotage, sous les Alertes.
      Chaque onglet liste ses pages, et sous chaque page ses vues ou ses ateliers en retrait : une entrée = une vue précise.
      Pas d'onglets dans les pages (DESIGN.md §4.9). Chaque onglet d'atelier commence par son suivi de prod (décision du
      16/10). Le Déroulant garde ensuite les tableaux du menu « Trains » de Circé, dont la Liste des instructions (25/10) ;
      2 m² fixe et Pliage, ceux de leur menu : À traiter, Préparation, Liste des colis (04/11, _MenuNew.cshtml:18-26, 39-47),
      la Préparation réunissant tous les ateliers du type (filtre Atelier dans le tableau, plus de sous-entrées par site).
      Une page : { screen, label, icon, params (contexte : pour, type, atelier, machine), subs, badge }.
      Une sous-entrée : [libellé, paramètres de l'adresse, compteur facultatif]. */
  const scope = x => M.state.site === 'ALL' || x.site === M.state.site;
  const POUR = { deroulant: a => a.mode === 'train', fixe: a => a.type === 'fixe', pliage: a => a.type === 'pliage', bus: a => a.type === 'bus' };
  /** Ateliers d'un type de production (deroulant, fixe, pliage, bus) ; dans le périmètre du site si demandé. */
  M.ateliersPour = (pour, tous) => M.ref.ateliers.filter(a => (POUR[pour] || (() => false))(a) && (tous || scope(a)));
  M.POUR_LABEL = { deroulant: 'Déroulant', fixe: '2 m² fixe', pliage: 'Pliage', bus: 'Bus' };
  const siteDe = a => M.calc.site(a.site).label.replace(' (Bus)', '') + (a.cible ? ' (cible)' : '');
  const machines = type => M.ref.machines.filter(m => m.type === type && m.fichier && scope(m));
  const idsPour = pour => new Set(M.ateliersPour(pour, true).map(a => a.id));
  /** Compteur par type d'atelier : dossiers arrivés après libération. */
  const badgeLiberation = pour => () => {
    const ids = idsPour(pour);
    const n = M.data.dossiers.filter(d => ids.has(d.atelier) && d.apresLiberation && M.inScope(d)).length;
    return { n, hot: n > 0, title: 'Dossiers arrivés après libération' };
  };
  /** Suivi de prod d'un type d'atelier, en tête de son onglet (décision du 16/10) : le tableau de Pilotage › Suivi de prod,
      limité aux ateliers de l'onglet. */
  const suiviProd = pour => ({ screen: 'suivi', label: 'Suivi de prod', icon: 'table', params: { pour } });
  // 2 m² fixe et Pliage : une seule entrée, tous les ateliers du type, filtre Atelier dans le tableau (04/11) ; le Bus garde ses centres
  const preparation = (pour, label, badge) => ({ screen: 'unitaire', label, params: { type: pour }, badge,
    subs: pour === 'bus' ? () => M.ateliersPour(pour).map(a => [siteDe(a), { type: pour, atelier: a.id }]) : undefined });
  // Pages du menu de Circé pour 2m² fixe et Pliage (04/11) : « A traiter » = les dossiers de l'atelier (validation admin, préparation
  // reçue, écart Broadcast, correction demandée), « Liste des colis » = les colis de l'atelier
  const aTraiter = pour => ({ screen: 'instructions', label: 'À traiter', params: { pour } });
  const listeColis = pour => ({ screen: 'expedition', label: 'Liste des colis', icon: 'package', params: { tab: 'colis', type: pour } });
  const fichiers = (type, label) => ({ screen: 'generateur', label, subs: () => machines(type).map(m => [M.calc.site(m.site).label, { machine: m.id }]) });
  M.NAV = [
    { id: 'pilotage', title: 'Pilotage', icon: 'layout-dashboard', items: [
      { screen: 'suivi', label: 'Suivi de prod' },
      // Tableau de bord de la pré-production (04/11) : des carrés que chacun choisit et range (compteurs, listes, notes), sur le
      // modèle d'un « H-Board » montré par l'utilisatrice
      { screen: 'tableau' },
      // État des réservations vivant (19/10, idée de l'équipe) : tous les dossiers et où ils en sont ; il reprend le tableau du
      // reste à faire et l'état des réservations, qui était en tête de Dossiers depuis le 16/10
      { screen: 'reservations' },
      { screen: 'alertes' },
      // Vérification des thèmes, sous les Alertes (04/11, en attendant mieux) : elle était dans l'onglet Pré-production, retiré
      { screen: 'themes', subs: [
        ['Thèmes proches entre dossiers', { tab: 'proches' }, () => M.calc.themesAVerifier().length],
        // Noms d'annonceurs proches (16/10) : même règle que les thèmes
        ['Annonceurs proches', { tab: 'annonceurs' }, () => M.calc.annonceursAVerifier().length],
        ['Thèmes modifiés dans Broadcast', { tab: 'bc' }, () => M.calc.ecartsThemeBC().length]] }] },
    { id: 'reception', title: 'Réception', icon: 'inbox', items: [
      // Trois entrées, aux noms de Circé (décisions du 19/10). La réception des affiches tient en une page par étape (arrivée de
      // la palette, puis contrôle), reliées par le repère d'en-tête ; la feuille de stock à refaire est un tag de la Liste des
      // affiches ; la purge des réceptions attendues est automatique.
      { screen: 'reception', label: 'Réception des affiches', params: { tab: 'attendues' }, vues: ['attendues', 'saisie', 'controle'],
        badge: () => { const n = M.calc.receptionsAControler().length; return { n, title: n + ' palette(s) à contrôler' }; } },
      // Ordre du 04/11 (utilisatrice) : Réception des affiches, Réceptions inconnues, Liste des affiches
      { screen: 'identification', label: 'Réceptions inconnues' },
      { screen: 'reception', label: 'Liste des affiches', params: { tab: 'affiches' }, icon: 'package' },
      // J-3 (09/11, utilisatrice) : page vide, alimentation à préciser
      { screen: 'j3' }] },
    // Onglet « Non-conformité » (09/11, utilisatrice) : deux pages vides, alimentation à préciser
    // Organisé comme le site actuel de l'utilisatrice (capture du 09/11) : deux groupes, chacun avec ses pages. Déclarant : la Pré-Prod
    // et les plateformes (Contrôle réception), ou l'agent d'agence (Réclamation agence, formulaire Power Apps)
    { id: 'nonconformite', title: 'Non-conformité', icon: 'alert-triangle', items: [
      // 09/11 : Plateformes et Préproduction fusionnées en « Suivi NC réception » ; « Tableau principal » renommé « Suivi NC Agence »
      { screen: 'nonconformite', label: 'Réception contrôlée', icon: 'clipboard-check', vues: ['reception', 'suivi'],
        subs: [['Nouvelle réception', { tab: 'reception' }], ['Suivi NC réception', { tab: 'suivi' }, () => (M.ncAlertes ? M.ncAlertes().length : 0)]] },
      { screen: 'nonconformite', label: 'Réclamation agence', icon: 'flag', vues: ['declaration', 'reclamation'],
        subs: [['Nouvelle demande', { tab: 'declaration' }], ['Suivi NC Agence', { tab: 'reclamation' }]] }] },
    // Plus d'onglet « Pré-production » (ex « Dossiers ») depuis le 04/11 : ses pages sont dans les autres onglets (voir plus haut)
    // Ordre des onglets du 04/11 (utilisatrice) : Pilotage, Réception, 2 m² fixe, Pliage, Déroulant, Bus, Expédition, Stocks, Administration
    { id: 'fixe', title: '2 m² fixe', icon: 'layout-rows', items: [
      suiviProd('fixe'),
      aTraiter('fixe'),
      preparation('fixe', 'Préparation', badgeLiberation('fixe')),
      listeColis('fixe'),
      fichiers('multirouleuse', 'Fichiers multi-rouleuse')] },
    { id: 'pliage', title: 'Pliage', icon: 'stack-2', items: [
      suiviProd('pliage'),
      aTraiter('pliage'),
      preparation('pliage', 'Préparation', badgeLiberation('pliage')),
      listeColis('pliage')] },
    { id: 'deroulant', title: 'Déroulant', icon: 'train', items: [
      suiviProd('deroulant'),
      // Les quatre tableaux du menu « Trains » de Circé, gardés sous leurs noms et dans son ordre (25/10, demande de
      // l'utilisatrice) : Liste des instructions, Liste des trains, Suivi par thème, Préparation (_MenuNew.cshtml:64-82)
      { screen: 'instructions', label: 'Liste des instructions', params: { pour: 'deroulant' } },
      { screen: 'trains', label: 'Liste des trains', params: { tab: 'trains' }, icon: 'train' },
      { screen: 'trains', label: 'Suivi par thème', params: { tab: 'besoin' }, icon: 'list-check' },
      { screen: 'trains', label: 'Préparation', params: { tab: 'prepa' }, icon: 'box' },
      { screen: 'trains', label: 'Suivi 8 m² (demies)', params: { tab: 'd8' }, icon: 'chart-bar' },
      fichiers('vendome', 'Fichiers Vendôme'),
      { screen: 'bagues' },
      { screen: 'dispatch', subs: () => M.ateliersPour('deroulant').map(a => [siteDe(a) + ' · ' + a.label, { atelier: a.id }]) }] },
    // Onglet Bus (Nanterre) refait le 09/11 d'après docs/BUS (note de transmission du 08/10, ateliers, CDC, US) : la réception d'abord
    // (BUS-06), puis À traiter et Préparation ; pas de liste des colis ni d'expédition (BUS-23). Écran screens/bus.js.
    // Revu le 09/11 : plus de Documentation ; le Référentiel Bus est dans Administration ; le reste en place est un filtre de À traiter ;
    // la réception s'appelle « Réceptions attendues », le même tableau que Wissous et Nîmes
    // Suivi de prod du Bus (09/11, « fait dashboard pour bus ») : le tableau de bord de l'onglet, en tête comme dans les autres onglets
    { id: 'bus', title: 'Bus', icon: 'route', items: [
      { screen: 'bus', label: 'Suivi de prod', params: { tab: 'suivi' }, icon: 'chart-bar' },
      { screen: 'bus', label: 'Réceptions attendues', params: { tab: 'reception' }, icon: 'inbox' },
      { screen: 'bus', label: 'À traiter', params: { tab: 'atraiter' }, icon: 'clipboard-list' },
      { screen: 'bus', label: 'Préparation', params: { tab: 'preparation' }, icon: 'stack-2' },
      { screen: 'bus', label: 'Vue des réceptions', params: { tab: 'vue' }, icon: 'calendar' }] },
    { id: 'expedition', title: 'Expédition', icon: 'truck', items: [
      { screen: 'expedition', subs: [['Scan et colisage', { tab: 'colisage' }], ['Colis', { tab: 'colis' }], ['Départs camions', { tab: 'departs' }]] }] },
    // Onglet « Stocks » (le menu « Suivi des stocks » de RP32 #2, renommé le 16/10) : quantités par n° d'affiche, puis les
    // statuts de fin de campagne
    { id: 'stock', title: 'Stocks', icon: 'building-warehouse', items: [
      { screen: 'stock', subs: [['Stock par affiche', { tab: 'stock' }], ['Mouvements', { tab: 'mvt' }]] },
      // Fin de campagne (15/10) : une décision par dossier. Une seule entrée (21/10) : les sous-entrées « À décider »,
      // « À conserver », « À renvoyer », « À détruire » et « Sortis du stock » ne faisaient que poser le filtre « Décision » du
      // tableau ; un lien le pose toujours par ?decision=.
      { screen: 'fincampagne' }] },
    { id: 'admin', title: 'Administration', icon: 'settings', items: [
      { screen: 'parametrage', subs: [['Sites, ateliers et gammes', { tab: 'ateliers' }], ['Machines et fichiers', { tab: 'machines' }], ['Statuts', { tab: 'statuts' }], ['Alertes et mails', { tab: 'alertes' }], ['Règles métier', { tab: 'regles' }], ['Transport', { tab: 'transport' }], ['Référentiels', { tab: 'referentiels' }], ['Référentiel Bus', { tab: 'bus' }], ['Journal', { tab: 'journal' }]] }] },
  ];
  /** Pages d'aide à la lecture, dans le menu « Aide » du bandeau 1. */
  M.NAV_AIDE = ['parcours', 'besoins'];
  /** Icône Tabler de chaque écran (DESIGN.md §5). */
  M.NAV_ICONS = {
    suivi: 'layout-dashboard', tableau: 'gauge', alertes: 'bell', reception: 'inbox', identification: 'photo-search', j3: 'calendar-event', nonconformite: 'alert-triangle', bus: 'route',
    reservations: 'calendar', instructions: 'clipboard-check', themes: 'list-check', trains: 'train', generateur: 'file-spreadsheet', bagues: 'tag', dispatch: 'arrows-shuffle',
    unitaire: 'stack-2', expedition: 'truck', stock: 'building-warehouse', fincampagne: 'trash', parametrage: 'settings', parcours: 'route', besoins: 'checklist',
  };
  const subsOf = it => (typeof it.subs === 'function' ? it.subs() : it.subs) || [];
  const labelOf = it => it.label || M.screens[it.screen].nav || M.screens[it.screen].title;
  /** Compteur d'une page du menu : le sien s'il en a un ; celui de l'écran, sauf pour une page à contexte (un même écran
      sert plusieurs onglets : son compteur global serait trompeur). */
  const badgeOf = it => {
    if (!M.data) return null;
    if (it.badge) return it.badge();
    const s = M.screens[it.screen];
    return !it.params && s && s.badge ? s.badge() : null;
  };
  /** Correspondance entre une page du menu et l'adresse courante : 2 = même contexte (atelier, machine, type…),
      1 = même écran sans contexte commun, 0 = autre écran ou autre contexte. Le paramètre « tab » (la vue) n'est pas un contexte.
      0,5 = même écran, mais la page a un contexte que l'adresse n'a pas : Expédition › Colis l'emporte alors sur la Liste des
      colis du fixe, qui la précède dans le menu (04/11). */
  function matchItem(it, cur) {
    if (it.screen !== cur.id) return 0;
    // Contexte implicite de l'adresse (04/11, le Déroulant passe après le fixe et le pliage) : la Liste des instructions sans
    // atelier est celle du déroulant ; une Préparation ouverte sur un atelier est celle de son type
    const cp = Object.assign({}, cur.params);
    if (cur.id === 'instructions' && !cp.pour) cp.pour = 'deroulant';
    if (cur.id === 'unitaire' && cp.atelier && !cp.type) { const a = M.calc && M.calc.atelier(cp.atelier); if (a) cp.type = a.type; }
    cur = { id: cur.id, params: cp };
    let weak = true;
    for (const p of [it.params || {}].concat(subsOf(it).map(s => s[1]))) {
      const common = Object.keys(p).filter(k => k !== 'tab' && cur.params[k] !== undefined);
      if (!common.length) continue;
      weak = false;
      if (common.every(k => String(p[k]) === String(cur.params[k]))) return 2;
    }
    if (!weak) return 0;
    return Object.keys(it.params || {}).some(k => k !== 'tab') ? 0.5 : 1;
  }
  /** Onglet courant : celui dont une page correspond le mieux à l'adresse (le premier en cas d'égalité). */
  const groupOf = cur => {
    const score = g => Math.max(0, ...g.items.map(it => matchItem(it, cur)));
    const best = Math.max(0, ...M.NAV.map(score));
    return best ? M.NAV.find(g => score(g) === best) : null;
  };

  function renderMenubar() {
    const bar = document.getElementById('menubar');
    const cur = M.parseHash();
    const curGroup = groupOf(cur);
    // Pas d'icône maison : la page d'accueil est supprimée (16/10), le logo ramène au suivi de prod
    M.mount(bar, h('div', { class: 'cz-menubar' },
      M.NAV.map(g => {
        // Compteur de l'onglet : celui de sa première page en alerte (sinon de sa première page comptée) ; le détail est dans la liste.
        const counted = g.items.map(it => ({ it, b: badgeOf(it) })).filter(x => x.b && x.b.n);
        const lead = counted.find(x => x.b.hot) || counted[0];
        const tab = h('button', { type: 'button', class: ['cz-tab', curGroup === g ? 'active' : ''], 'aria-haspopup': 'true', 'aria-expanded': 'false',
          title: counted.length ? counted.map(x => labelOf(x.it) + ' : ' + x.b.n).join(' · ') : null },
          M.ui.icon(g.icon), h('span', null, g.title),
          lead ? h('span', { class: ['badge', lead.b.hot ? 'bg-red text-white' : 'bg-secondary-lt'] }, lead.b.n) : null,
          M.ui.icon('chevron-down', 'cz-chev'));
        tab.addEventListener('click', () => openTabMenu(tab, g, M.parseHash()));
        return tab;
      })));
  }
  function openTabMenu(tab, g, cur) {
    if (tab._close) { tab._close(); return; }
    const r = tab.getBoundingClientRect();
    const items = [];
    let prevSubs = false;
    g.items.forEach((it, i) => {
      const s = M.screens[it.screen];
      if (!s) return;
      const subs = subsOf(it);
      if (i && (prevSubs || subs.length)) items.push(h('div', { class: 'cz-menu-sep' }));
      prevSubs = subs.length > 0;
      const m = matchItem(it, cur);
      // Page à vue fixe (seul paramètre : la vue) : courante quand l'adresse montre cette vue, ou l'une de ses vues (it.vues),
      // ou la vue par défaut de l'écran
      const vue = it.params && Object.keys(it.params).length === 1 ? it.params.tab : null;
      const vues = it.vues || (vue ? [vue] : null);
      const isCur = m === 2 || (m === 1 && (vues ? vues.includes(String(cur.params.tab || s.vueDefaut || '')) : !it.params));
      const b = badgeOf(it);
      const forRole = !s.roles || s.roles.includes(M.state.role);
      // Lien de la page : son contexte, sinon sa première vue
      const href = M.link(it.screen, it.params || (subs.length ? subs[0][1] : undefined));
      items.push(h('a', { class: ['cz-menu-page', isCur && !subs.length ? 'current' : '', forRole ? '' : 'dim'], href, title: forRole ? null : 'Écran secondaire pour le rôle sélectionné' },
        M.ui.icon(it.icon || M.NAV_ICONS[it.screen] || 'circle-dot'), h('span', null, labelOf(it)),
        b && b.n ? h('span', { class: ['badge', b.hot ? 'bg-red text-white' : 'bg-secondary-lt'], title: b.title || null }, b.n) : null));
      // Sous-entrée courante : paramètre de l'adresse, ou à défaut la première (vue par défaut de la page)
      subs.forEach(([label, params, count]) => {
        const on = isCur && Object.entries(params).every(([k, v]) => String(cur.params[k] !== undefined ? cur.params[k] : subs[0][1][k]) === String(v));
        const n = count && M.data ? count() : 0;
        items.push(h('a', { class: ['cz-menu-sub', on ? 'current' : '', forRole ? '' : 'dim'], href: M.link(it.screen, params) }, h('span', null, label), n ? h('span', { class: 'badge bg-secondary-lt' }, n) : null));
      });
    });
    const menu = h('div', { class: 'cz-tabmenu', role: 'menu', 'aria-label': g.title, style: { top: (r.bottom + 1) + 'px', left: Math.max(8, Math.min(window.innerWidth - 348, r.left)) + 'px' } }, items);
    tab.classList.add('open');
    tab.setAttribute('aria-expanded', 'true');
    tab._close = M.ui.popup(menu, () => { tab.classList.remove('open'); tab.setAttribute('aria-expanded', 'false'); tab._close = null; });
    menu.addEventListener('click', e => { if (e.target.closest('a') && tab._close) tab._close(); });
  }

  /* ---------- Démarrage ---------- */
  M.start = function () {
    document.body.classList.toggle('no-annot', !M.state.annot);
    // Changer d'écran ferme les menus, fenêtres et panneaux encore ouverts (sinon ils masquent le nouvel écran).
    window.addEventListener('hashchange', () => { suivrePile(); M.navSeq++; if (M.ui && M.ui.closeOverlays) M.ui.closeOverlays(); M.refresh(); });
    if (!location.hash) location.hash = M.link(M.DEPART);
    M.refresh();
  };
})();
