/* ==========================================================================
   Circé — maquette cible : composants d'interface communs
   Balisage Tabler 1.6 (voir DESIGN.md §4). Les tableaux reposent sur Tabulator 6.
   Le texte venant des données est toujours inséré via textContent.
   ========================================================================== */
(function () {
  'use strict';
  const M = window.M;
  const h = M.h;
  const ui = M.ui = {};
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- Icônes Tabler (sous-ensemble embarqué, aucune police) ---------- */
  ui.icon = function (name, cls) {
    const def = (window.TABLER_ICONS || {})[name];
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    (def || []).forEach(([tag, attrs]) => {
      const el = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
      svg.appendChild(el);
    });
    return svg;
  };

  /* ---------- Gestion des widgets (tableaux, graphiques) à libérer au changement d'écran ---------- */
  const widgets = M._widgets = M._widgets || new Set();
  M._tables = M._tables || new Map();
  ui.registerWidget = w => { widgets.add(w); return w; };
  ui.disposeWidgets = function (scope) {
    widgets.forEach(w => {
      if (!w.el || !w.el.isConnected || (scope && scope.contains(w.el))) {
        try { w.dispose(); } catch (e) { /* déjà libéré */ }
        widgets.delete(w);
      }
    });
  };
  /** Exécute fn dès que l'élément est inséré dans la page (les librairies ont besoin de ses dimensions). */
  ui.whenAttached = function (el, fn) {
    let tries = 0;
    const go = () => { if (el.isConnected) fn(); else if (tries++ < 60) setTimeout(go, 25); };
    setTimeout(go, 0);
  };

  /* ---------- En-tête de page + bouton « Besoins couverts » ---------- */
  ui.pageHead = function ({ crumb, title, sub, intro, actions, screen }) {
    const def = screen ? M.screens[screen] : null;
    const nb = def && def.needs ? def.needs.length : 0;
    // Retour (19/10) : la page d'où vient le lien (M.go), avec ses filtres ; le titre de cette page sert au retour suivant
    const prec = M.pile && M.pile[M.pile.length - 1];
    M.titrePage = typeof title === 'string' ? title : M.titrePage;
    return h('div', { class: 'cz-page-head' },
      h('div', null,
        prec ? h('button', { type: 'button', class: 'cz-retour', title: 'Revenir à la page précédente, avec ses filtres', onclick: () => M.retour() }, '← Retour : ' + prec.titre) : null,
        crumb ? h('div', { class: 'page-pretitle' }, crumb) : null,
        h('h1', { class: 'page-title' }, title),
        // Plus de phrase d'introduction sous le titre, sur aucune page (04/11, demande de l'utilisatrice) : `sub` n'est plus affiché

        // Intro en éléments (21/10, réception : le repère des étapes sous le titre, à la place de la phrase)
        intro ? h('div', { class: 'cz-page-intro' }, intro) : null),
      h('div', { class: 'btn-list' },
        actions || null,
        nb ? h('button', { class: 'btn needs-btn', onclick: () => ui.needsDrawer(screen) }, ui.icon('checklist'), 'Besoins couverts (' + nb + ')') : null));
  };

  ui.needsDrawer = function (screenId) {
    const def = M.screens[screenId];
    const items = (def.needs || []).map(id => {
      const b = M.besoins.byId(id);
      return h('li', null,
        h('span', null, h('span', { class: 'need-chip' }, id)),
        h('div', null, b ? b.label : 'Besoin non trouvé dans le référentiel', b && b.src ? h('div', { class: 'src' }, b.src) : null));
    });
    ui.drawer({
      title: 'Besoins couverts : ' + def.title,
      body: [
        h('p', { class: 'muted small' }, 'Identifiants du référentiel de la phase 0 (00_synthese_powerpoint.md, §8 et §15-16). Le tableau complet est dans « Traçabilité des besoins ».'),
        def.asis && def.asis.length ? ui.callout('warning', "Ce que l'écran remplace dans l'existant", h('ul', { style: { margin: '4px 0 0 18px', padding: 0 } }, def.asis.map(a => h('li', null, a)))) : null,
        h('ul', { class: 'need-list' }, items),
      ],
    });
  };

  /** Pastilles d'identifiants de besoins (masquées quand les annotations sont coupées). */
  ui.chips = function (ids) {
    return h('span', { class: 'cz-chips' }, (ids || []).map(id => {
      const b = M.besoins.byId(id);
      return h('span', { class: 'need-chip', title: b ? b.label : id }, id);
    }));
  };
  ui.annot = function (text, ids) {
    return h('div', { class: 'annot' }, ids ? ui.chips(ids) : null, ids ? ' ' : null, text);
  };

  /* ---------- Briques simples ---------- */
  ui.card = function ({ title, sub, actions, body, flush, id, style }) {
    return h('section', { class: 'card', id, style },
      title ? h('div', { class: 'card-header' },
        h('div', null, h('h2', { class: 'card-title' }, title), sub ? h('div', { class: 'cz-card-sub' }, sub) : null),
        actions ? h('div', { class: 'card-actions' }, actions) : null) : null,
      h('div', { class: ['card-body', flush ? 'p-0' : ''] }, body));
  };
  const ALERT = {
    info: { cls: 'alert-neutre', icon: 'info-circle' }, // gris et non bleu depuis le 09/11 (collègue daltonien)
    warning:{ cls: 'alert-warning', icon: 'alert-circle' },
    critical: { cls: 'alert-danger', icon: 'alert-triangle' },
    good: { cls: 'alert-success', icon: 'circle-check' },
    cible: { cls: 'alert-cible', icon: 'sparkles' },
  };
  ui.callout = function (tone, title, text, actions) {
    const a = ALERT[tone] || ALERT.info;
    return h('div', { class: ['alert', a.cls], role: 'alert' },
      h('div', { class: 'alert-icon' }, ui.icon(a.icon)),
      h('div', null, title ? h('h4', { class: 'alert-heading' }, title) : null, text ? h('div', { class: 'alert-description' }, text) : null),
      actions ? h('div', { class: 'cz-alert-actions' }, actions) : null);
  };
  ui.btn = function (label, onClick, opts) {
    opts = opts || {};
    const cls = ['btn',
      opts.primary ? 'btn-primary' : '',
      opts.danger ? 'btn-outline-danger' : '',
      opts.ghost ? 'btn-ghost-secondary' : '',
      opts.small ? 'btn-sm' : ''];
    return h('button', { type: 'button', class: cls, disabled: opts.disabled, title: opts.title, onclick: onClick }, opts.icon ? ui.icon(opts.icon) : null, label);
  };
  const TAG = { cible: 'bg-purple-lt', new: 'bg-green-lt', asis: 'bg-secondary-lt', hyp: 'bg-yellow-lt' };
  ui.tag = (text, kind) => h('span', { class: ['badge', TAG[kind] || 'bg-azure-lt'] }, text);
  /** Champ étiqueté : applique la classe Tabler adaptée au contrôle reçu. */
  ui.field = function (label, control, wide) {
    if (control && control.tagName === 'SELECT' && !control.classList.contains('form-select')) control.classList.add('form-select');
    if (control && (control.tagName === 'INPUT' || control.tagName === 'TEXTAREA') && control.type !== 'checkbox' && !control.classList.contains('form-control')) control.classList.add('form-control');
    return h('label', { class: ['field', wide ? 'wide' : ''] }, h('span', { class: 'form-label' }, label), control);
  };
  ui.select = function ({ value, options, onChange, label, disabled }) {
    return h('select', { class: 'form-select', 'aria-label': label, disabled, onchange: e => onChange && onChange(e.target.value) },
      options.map(o => typeof o === 'object' ? h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label) : h('option', { value: o, selected: String(o) === String(value) }, o)));
  };
  ui.input = function ({ value, placeholder, onInput, onChange, type, label, min, max, style }) {
    return h('input', { class: 'form-control', type: type || 'text', value: value === undefined ? '' : value, placeholder, 'aria-label': label || placeholder, min, max, style, oninput: onInput ? e => onInput(e.target.value) : null, onchange: onChange ? e => onChange(e.target.value) : null });
  };
  ui.checkbox = function (label, checked, onChange) {
    return h('label', { class: 'form-check form-check-inline check' },
      h('input', { class: 'form-check-input', type: 'checkbox', checked, onchange: e => onChange(e.target.checked) }),
      h('span', { class: 'form-check-label' }, label));
  };
  ui.filterbar = (...kids) => h('div', { class: 'cz-filterbar' }, kids);

  /* Surcouches ouvertes (menus, fenêtres, panneaux) : toutes fermées quand on change d'écran. */
  const overlays = new Set();
  ui.closeOverlays = () => Array.from(overlays).forEach(close => close());

  /** Ouvre un menu flottant (dropdown Tabler) ; fermeture au clic extérieur ou Échap ; onClose est appelé à la fermeture.
      inside : élément dont les clics ne ferment pas le menu (le champ de saisie qui l'a ouvert). */
  ui.popup = function (menu, onClose, inside) {
    menu.classList.add('dropdown-menu', 'cz-menu');
    document.body.appendChild(menu);
    const off = ev => { if (!menu.contains(ev.target) && !(inside && inside.contains(ev.target))) close(); };
    const esc = ev => { if (ev.key === 'Escape') close(); };
    setTimeout(() => { document.addEventListener('click', off); document.addEventListener('keydown', esc); }, 0);
    function close() {
      overlays.delete(close); menu.remove(); document.removeEventListener('click', off); document.removeEventListener('keydown', esc);
      if (onClose) onClose();
    }
    overlays.add(close);
    return close;
  };
  ui.menuAt = function (anchor, width) {
    const r = anchor.getBoundingClientRect();
    const w = width || 280;
    return h('div', { style: { top: (r.bottom + 4) + 'px', left: Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px', width: w + 'px' } });
  };

  /* ==========================================================================
     Filtres à choix multiples, cumulés et « smart » (DESIGN.md §4.3)
     - Un filtre = des valeurs cochées ; aucune coche = tout. Plusieurs valeurs d'un même filtre : OU.
     - Les filtres se cumulent : ET. Filtrer S42 puis un format garde S42. La recherche du tableau s'ajoute.
     - Le nombre affiché à côté de chaque valeur tient compte des autres filtres déjà posés.
     - Smart (ERG-06) : une longue liste (plus de 8 valeurs) ne propose que les valeurs compatibles avec les
       autres filtres (un annonceur choisi → ses seuls thèmes) ; les autres restent accessibles par un lien.
       Une liste courte garde toutes ses valeurs, les incompatibles grisées.
     - Champ « N° de dossier » (input: true) : saisie d'un n° de dossier, de DA ou d'un annonceur, propositions
       compatibles avec les autres filtres, choix multiple en puces, collage d'une liste (mail, Excel).
     - Quatre filtres visibles au plus ; les autres (more: true) s'ajoutent par « + Filtre ».
     Définition d'un filtre : { key, label, options: [{ value, label, short, sub, aliases }] ou fonction,
     get(ligne) → valeur(s), default: [valeurs], more, hidden (piloté ailleurs), input (champ de saisie),
     stable (toutes les valeurs restent proposées), matchEmpty (une ligne sans valeur passe), summary(sel) }.
     Option preset : { clé: [valeurs] } posées par un lien, une fois par arrivée sur l'écran (M.navSeq).
     Un getter peut être remplacé à l'application (autre type de ligne) ; null = filtre sans objet pour ce type.
     L'état est gardé par écran pour la session (M.filterState[id]).
     ========================================================================== */
  const fstate = M.filterState = M.filterState || {};
  const asKey = arr => arr.map(String).sort().join('|');
  const norm = s => String(s === null || s === undefined ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const TOKENS = /\d{4,}/g; // n° de dossier ou de DA dans un texte collé
  let openDMenu = null;     // liste de propositions ouverte (une seule à la fois, même après un rafraîchissement)
  ui.filters = function (o) {
    const st = fstate[o.id] = fstate[o.id] || { sel: {}, shown: [] };
    const defs = o.defs.filter(Boolean);
    defs.forEach(d => { if (!st.sel[d.key]) st.sel[d.key] = (d.default || []).map(String); });
    // Filtres posés par un lien (preset, ex. « Écarts BC » depuis une alerte ou le menu) : appliqués une fois par arrivée sur l'écran,
    // puis l'utilisateur garde la main (un rafraîchissement ne les réimpose pas).
    if (o.preset && st.presetSeq !== M.navSeq) { Object.entries(o.preset).forEach(([k, v]) => { st.sel[k] = (v || []).map(String); }); st.presetSeq = M.navSeq; }
    const optionsOf = d => (typeof d.options === 'function' ? d.options() : d.options) || [];
    const valuesOf = (d, r, getters) => {
      const g = getters && d.key in getters ? getters[d.key] : d.get;
      if (!g) return undefined;
      const v = g(r);
      if (v === undefined) return undefined;
      return (Array.isArray(v) ? v : [v]).filter(x => x !== null && x !== '').map(String);
    };
    const passes = (d, r, getters) => {
      const sel = st.sel[d.key];
      if (!sel.length) return true;
      const vs = valuesOf(d, r, getters);
      if (vs === undefined) return true;
      if (!vs.length) return !!d.matchEmpty;
      return vs.some(v => sel.includes(v));
    };
    const apply = (rows, getters, except) => rows.filter(r => defs.every(d => d.key === except || passes(d, r, getters)));
    const isOn = d => st.sel[d.key].length > 0;
    const changed = () => { if (o.onChange) o.onChange(); M.refresh(); };
    const labelOf = (d, v) => { const x = optionsOf(d).find(y => String(y.value) === v); return x ? (x.short || x.label) : v; };
    const summary = d => {
      const sel = st.sel[d.key];
      if (d.summary) return d.summary(sel);
      if (!sel.length) return d.all || 'Tous';
      return sel.length <= 2 ? sel.map(v => labelOf(d, v)).join(', ') : sel.length + ' choisis';
    };

    /** Nombre de lignes par valeur du filtre d, tous les autres filtres étant posés. o.countBy (21/10) : les lignes reçues
        sont plus fines que celles du tableau (base unique) ; on compte alors les lignes affichées, c'est-à-dire les clés
        de regroupement distinctes. */
    const countsFor = d => {
      const counts = new Map(), seen = new Map();
      if (o.rows) apply(o.rows, null, d.key).forEach(r => (valuesOf(d, r) || []).forEach(v => {
        if (!o.countBy) { counts.set(v, (counts.get(v) || 0) + 1); return; }
        const k = o.countBy(r);
        if (k === null || k === undefined) return;
        if (!seen.has(v)) seen.set(v, new Set());
        seen.get(v).add(k); counts.set(v, seen.get(v).size);
      }));
      return counts;
    };

    function openMenu(btn, d) {
      if (btn._close) { btn._close(); return; }
      const os = optionsOf(d);
      const counts = countsFor(d);
      const work = new Set(st.sel[d.key]);
      const before = asKey(Array.from(work));
      // Smart : une longue liste ne montre que les valeurs compatibles avec les autres filtres, plus celles cochées
      const smart = !!o.rows && !d.stable && os.length > 8;
      const compatible = x => (counts.get(String(x.value)) || 0) > 0 || work.has(String(x.value));
      const nHidden = smart ? os.filter(x => !compatible(x)).length : 0;
      let showAll = false, q = '';
      const list = h('div', { class: 'cz-fopts' });
      const draw = () => M.mount(list, os.filter(x => (!q || norm(x.label).includes(q)) && (!smart || showAll || compatible(x))).map(x => {
        const v = String(x.value), n = counts.get(v) || 0;
        const cb = h('input', { class: 'form-check-input m-0', type: 'checkbox' });
        cb.checked = work.has(v);
        cb.addEventListener('change', () => { if (cb.checked) work.add(v); else work.delete(v); });
        return h('label', { class: ['cz-fopt', o.rows && !n ? 'is-zero' : ''] }, cb, h('span', { class: 'cz-fopt-label' }, x.label), o.rows ? h('span', { class: 'cz-fopt-count' }, M.fmt.n(n)) : null);
      }));
      draw();
      const more = nHidden ? h('button', { type: 'button', class: 'linkish cz-fmenu-more' }) : null;
      const moreLabel = () => { more.textContent = showAll ? 'Masquer les valeurs sans résultat' : 'Afficher aussi ' + nHidden + ' valeur' + (nHidden > 1 ? 's' : '') + ' sans résultat'; };
      if (more) { moreLabel(); more.addEventListener('click', () => { showAll = !showAll; moreLabel(); draw(); }); }
      const r = btn.getBoundingClientRect();
      const menu = h('div', { class: 'cz-fmenu', role: 'dialog', 'aria-label': 'Filtre ' + d.label, style: { top: (r.bottom + 4) + 'px', left: Math.max(8, Math.min(window.innerWidth - 308, r.left)) + 'px', width: '300px' } },
        h('div', { class: 'cz-fmenu-head' }, h('b', null, d.label), h('span', null, 'Plusieurs choix possibles.' + (!o.rows ? '' : smart ? ' Seules les valeurs compatibles avec vos autres filtres sont proposées.' : ' Les nombres tiennent compte des autres filtres.'))),
        os.length > 8 ? h('input', { class: 'form-control form-control-sm cz-fmenu-search', type: 'search', placeholder: 'Rechercher…', 'aria-label': 'Rechercher une valeur', oninput: e => { q = norm(e.target.value.trim()); draw(); } }) : null,
        list,
        more,
        h('div', { class: 'cz-fmenu-foot' },
          h('button', { type: 'button', class: 'linkish', onclick: () => { work.clear(); draw(); } }, 'Tout décocher'),
          h('span', { class: 'spacer' }),
          ui.btn('Appliquer', () => btn._close && btn._close(), { small: true, primary: true })));
      btn.classList.add('open');
      // Fermer (Appliquer, clic ailleurs, Échap) applique le choix s'il a changé
      btn._close = ui.popup(menu, () => {
        btn._close = null; btn.classList.remove('open');
        if (asKey(Array.from(work)) !== before) { st.sel[d.key] = Array.from(work); changed(); }
      });
    }
    /* Champ de saisie à choix multiple (n° de dossier) : puces des valeurs choisies, propositions au fil de la frappe.
       Entrée ajoute la proposition active ; un texte collé avec plusieurs n° les reconnaît tous ; Retour arrière
       sur un champ vide retire la dernière puce. Les propositions tiennent compte des autres filtres ; un dossier
       qu'ils masquent est signalé, avec le filtre en cause, et peut être affiché en retirant ce filtre. */
    function dfield(d) {
      const sel = st.sel[d.key];
      const os = optionsOf(d);
      const byVal = new Map(os.map(x => [String(x.value), x]));
      const byAlias = new Map();
      os.forEach(x => (x.aliases || []).forEach(a => { if (/^\d+$/.test(String(a))) byAlias.set(String(a), String(x.value)); }));
      const resolve = tok => (byVal.has(tok) ? tok : byAlias.get(tok) || null);
      const counts = countsFor(d);             // lignes par valeur, les autres filtres posés
      const total = new Map();                 // lignes par valeur, sans aucun filtre
      if (o.rows) o.rows.forEach(r => (valuesOf(d, r) || []).forEach(v => total.set(v, (total.get(v) || 0) + 1)));
      /** Filtres qui masquent la valeur v : aucune de ses lignes ne les passe. */
      const blockers = v => {
        const rowsV = (o.rows || []).filter(r => (valuesOf(d, r) || []).includes(v));
        const act = defs.filter(x => x.key !== d.key && st.sel[x.key].length);
        const b = act.filter(x => !rowsV.some(r => passes(x, r)));
        return b.length ? b : act;
      };
      const subOf = v => (byVal.get(v) || {}).sub || '';
      let closeMenu = null, menu = null, items = [], active = 0;
      const commit = (add, remove, clearKeys) => {
        const cur = new Set(st.sel[d.key]);
        (add || []).forEach(v => cur.add(String(v)));
        (remove || []).forEach(v => cur.delete(String(v)));
        st.sel[d.key] = Array.from(cur);
        (clearKeys || []).forEach(k => { st.sel[k] = []; });
        st.refocus = d.key;
        if (closeMenu) closeMenu();
        changed();
      };
      const input = h('input', { type: 'text', class: 'cz-dinput', placeholder: sel.length ? 'Ajouter…' : (d.placeholder || 'Saisir ou coller'), autocomplete: 'off', spellcheck: 'false',
        role: 'combobox', 'aria-label': d.label + ' : saisir ou coller un ou plusieurs numéros', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
      const opt = (cls, kids, act) => {
        const b = h('button', { type: 'button', class: ['cz-dopt', cls], role: 'option' }, kids);
        b.addEventListener('mousedown', e => e.preventDefault()); // garde le curseur dans le champ
        b.addEventListener('click', act);
        items.push({ el: b, act });
        return b;
      };
      const plural = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');
      function suggestions(text) {
        items = []; active = 0;
        const toks = M.uniq(text.match(TOKENS) || []);
        const q = norm(text.trim());
        if (toks.length >= 2) {
          // Liste collée ou tapée : chaque n° est reconnu (dossier ou DA)
          const found = [], masked = [], unknown = [];
          toks.forEach(t => { const v = resolve(t); if (!v) unknown.push(t); else if (counts.get(v)) found.push(v); else masked.push(v); });
          const neuf = M.uniq(found).filter(v => !sel.includes(v));
          const bl = M.uniq(masked.flatMap(blockers));
          return [
            h('div', { class: 'cz-dgroup' }, 'Liste de ' + plural(toks.length, 'numéro')),
            neuf.length ? opt('primary', [ui.icon('check'), h('span', { class: 'cz-dopt-sub' }, 'Ajouter ' + plural(neuf.length, 'dossier') + ' : ' + neuf.slice(0, 6).join(', ') + (neuf.length > 6 ? '…' : ''))], () => commit(neuf)) : null,
            masked.length ? opt('', [ui.icon('filter'), h('span', { class: 'cz-dopt-sub' }, 'Ajouter aussi ' + plural(masked.length, 'dossier') + ' masqué' + (masked.length > 1 ? 's' : '') + ' par ' + bl.map(x => x.label).join(', ') + ' (retire ce filtre)')], () => commit(neuf.concat(masked), null, bl.map(x => x.key))) : null,
            unknown.length ? h('div', { class: 'cz-dhint warn' }, 'Absents de cette page : ' + unknown.join(', ')) : null,
            !neuf.length && !masked.length && !unknown.length ? h('div', { class: 'cz-dhint' }, 'Ces dossiers sont déjà choisis.') : null,
          ];
        }
        if (!q) {
          return [
            sel.length ? h('div', { class: 'cz-dgroup' }, 'Choisis (' + sel.length + ')') : null,
            sel.map(v => opt('is-sel', [ui.icon('check'), h('span', { class: 'cz-dopt-num' }, v), h('span', { class: 'cz-dopt-sub' }, subOf(v)), h('span', { class: 'cz-dopt-act' }, 'Retirer')], () => commit(null, [v]))),
            h('div', { class: 'cz-dhint' }, d.hint || 'Tapez un n° de dossier, de DA ou un annonceur. Pour en filtrer plusieurs : Entrée après chacun, ou collez une liste (mail, Excel).'),
          ];
        }
        // Une saisie : début ou partie du n°, n° de DA, annonceur ; les dossiers compatibles avec les autres filtres d'abord
        const t0 = text.trim();
        const match = x => norm(x.value).includes(q) || norm(x.sub).includes(q) || (x.aliases || []).some(a => norm(a).includes(q));
        const rank = x => (String(x.value).startsWith(t0) ? 0 : (x.aliases || []).some(a => String(a).startsWith(t0)) ? 1 : 2);
        const hits = os.filter(match).sort((a, b) => rank(a) - rank(b) || String(a.value).localeCompare(String(b.value)));
        const ok = hits.filter(x => counts.get(String(x.value)));
        const hidden = hits.filter(x => !counts.get(String(x.value)) && total.get(String(x.value)));
        return [
          ok.slice(0, 8).map(x => {
            const v = String(x.value), on = sel.includes(v);
            return opt(on ? 'is-sel' : '', [on ? ui.icon('check') : h('span', { class: 'cz-dopt-ico' }), h('span', { class: 'cz-dopt-num' }, v), h('span', { class: 'cz-dopt-sub' }, x.sub || ''), h('span', { class: 'cz-dopt-count', title: 'Lignes avec vos autres filtres' }, M.fmt.n(counts.get(v)))], () => commit(on ? null : [v], on ? [v] : null));
          }),
          ok.length > 8 ? h('div', { class: 'cz-dhint' }, plural(ok.length - 8, 'autre dossier') + ' : précisez la saisie.') : null,
          hidden.length ? h('div', { class: 'cz-dgroup' }, 'Masqués par vos filtres') : null,
          hidden.slice(0, 3).map(x => {
            const v = String(x.value), bl = blockers(v);
            return opt('', [h('span', { class: 'cz-dopt-ico' }), h('span', { class: 'cz-dopt-num' }, v), h('span', { class: 'cz-dopt-sub' }, (x.sub ? x.sub + ' · ' : '') + 'masqué par ' + bl.map(b => b.label).join(', ')), h('span', { class: 'cz-dopt-act' }, 'Afficher')], () => commit([v], null, bl.map(b => b.key)));
          }),
          !ok.length && !hidden.length ? h('div', { class: 'cz-dhint warn' }, 'Aucun dossier « ' + t0 + ' » sur cette page.') : null,
        ];
      }
      const mark = () => items.forEach((it, i) => it.el.classList.toggle('active', i === active));
      const wrap = h('div', { class: ['cz-dfield', sel.length ? 'is-on' : ''], role: 'group', 'aria-label': d.label, title: d.help || null });
      function render() {
        const content = suggestions(input.value);
        if (!menu) {
          if (openDMenu) openDMenu(); // une liste restée d'un affichage précédent
          const r = wrap.getBoundingClientRect();
          menu = h('div', { class: 'cz-dmenu', role: 'listbox', 'aria-label': d.label, style: { top: (r.bottom + 4) + 'px', left: Math.max(8, Math.min(window.innerWidth - 428, r.left)) + 'px', width: '420px' } });
          const close = ui.popup(menu, () => { menu = null; closeMenu = null; if (openDMenu === close) openDMenu = null; input.setAttribute('aria-expanded', 'false'); }, wrap);
          closeMenu = openDMenu = close;
          input.setAttribute('aria-expanded', 'true');
        }
        M.mount(menu, content);
        mark();
      }
      input.addEventListener('focus', render);
      input.addEventListener('input', render);
      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = (active + 1) % items.length; mark(); }
        else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; mark(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) items[active].act(); }
        else if (e.key === 'Backspace' && !input.value && sel.length) { e.preventDefault(); commit(null, [sel[sel.length - 1]]); }
        else if (e.key === 'Escape' && closeMenu) closeMenu();
      });
      input.addEventListener('paste', e => {
        const txt = (e.clipboardData || window.clipboardData).getData('text') || '';
        if ((txt.match(TOKENS) || []).length >= 2) { e.preventDefault(); input.value = txt.replace(/\s+/g, ' ').trim(); render(); }
      });
      wrap.addEventListener('click', () => input.focus());
      const chip = v => h('span', { class: 'cz-dchip', title: subOf(v) || null }, v,
        h('button', { type: 'button', class: 'cz-dchip-x', 'aria-label': 'Retirer ' + v, onclick: e => { e.stopPropagation(); commit(null, [v]); } }, ui.icon('x')));
      M.mount(wrap,
        h('span', { class: 'cz-dfield-label' }, ui.icon('search'), d.short || d.label),
        sel.slice(0, 3).map(chip),
        sel.length > 3 ? h('button', { type: 'button', class: 'cz-dchip more', title: 'Voir les ' + sel.length + ' choisis', onclick: e => { e.stopPropagation(); input.focus(); } }, '+' + (sel.length - 3)) : null,
        input,
        sel.length ? h('button', { type: 'button', class: 'cz-dclear', title: 'Vider ce filtre', 'aria-label': 'Vider le filtre ' + d.label, onclick: e => { e.stopPropagation(); commit(null, sel.slice()); } }, ui.icon('x')) : null);
      // Après un ajout, le curseur revient dans le champ pour enchaîner un autre numéro
      if (st.refocus === d.key) { st.refocus = null; setTimeout(() => { if (document.body.contains(input)) input.focus(); }, 0); }
      return wrap;
    }
    function fbtn(d) {
      const b = h('button', { type: 'button', class: ['cz-fbtn', isOn(d) ? 'is-on' : ''], 'aria-haspopup': 'dialog', title: d.help || null },
        h('span', { class: 'cz-fbtn-label' }, d.label), h('span', { class: 'cz-fbtn-value' }, summary(d)), ui.icon('chevron-down', 'cz-chev'));
      b.addEventListener('click', () => openMenu(b, d));
      return b;
    }
    // Un champ marqué « dehors » se pose ailleurs que dans la barre (F.champ) : le n° de dossier dans le bandeau de la réception
    const fields = defs.filter(d => d.input && !d.hidden && !d.dehors);
    const shown = defs.filter(d => !d.hidden && !d.input && (!d.more || st.shown.includes(d.key) || isOn(d)));
    const others = defs.filter(d => !d.hidden && !d.input && d.more && !shown.includes(d));
    let addBtn = null;
    if (others.length) {
      addBtn = h('button', { type: 'button', class: 'cz-fbtn cz-fbtn-add', 'aria-haspopup': 'menu' }, ui.icon('plus'), 'Filtre');
      addBtn.addEventListener('click', () => {
        const rr = addBtn.getBoundingClientRect();
        const menu = h('div', { style: { top: (rr.bottom + 4) + 'px', left: rr.left + 'px', width: '240px' } },
          h('div', { class: 'cz-menu-help' }, 'Ajouter un filtre'),
          others.map(d => h('button', { type: 'button', class: 'dropdown-item', onclick: () => { close(); st.shown.push(d.key); M.refresh(); } }, d.label)));
        const close = ui.popup(menu);
      });
    }
    const atDefault = defs.every(d => asKey(st.sel[d.key]) === asKey(d.default || [])) && !st.shown.length;
    const reset = () => { defs.forEach(d => { st.sel[d.key] = (d.default || []).map(String); }); st.shown = []; changed(); };
    // La barre passe d'elle-même dans la ligne d'outils du tableau qui la suit (core.js, 19/10) ; o.page la garde sous
    // l'en-tête, quand elle pilote aussi des graphiques (dashboard)
    const bar = h('div', { class: ['cz-filterbar', 'cz-filters', o.page ? 'cz-filters-page' : ''], role: 'group', 'aria-label': 'Filtres' },
      h('span', { class: 'cz-filters-title' }, ui.icon('filter'), 'Filtres'),
      fields.map(dfield), shown.map(fbtn), addBtn,
      h('span', { class: 'spacer' }),
      o.extra || null,
      atDefault ? null : ui.btn('Réinitialiser', reset, { small: true, ghost: true, icon: 'arrow-back-up', title: 'Revenir aux filtres par défaut' }));
    return {
      bar,
      /** Le champ de saisie d'un filtre « dehors », à poser où l'écran veut (19/10). */
      champ: key => { const d = defs.find(x => x.key === key && x.input); return d ? dfield(d) : null; },
      apply: (rows, getters) => apply(rows, getters),
      except: (rows, key, getters) => apply(rows, getters, key),
      sel: key => (st.sel[key] || []).slice(),
      set: (key, values) => { st.sel[key] = values.map(String); },
      weeks: () => (st.sel.semaine || []).map(Number),
    };
  };
  /** Filtre « Départ » : semaines de départ des camions, plusieurs possibles. */
  ui.weekFilter = (defaults, get) => ({
    key: 'semaine', label: 'Départ', default: (defaults || [M.state.semaine]).map(String), stable: true,
    options: () => M.ref.semaines.map(s => ({ value: s.num, label: 'S' + s.num + ' · ' + s.statut, short: 'S' + s.num })),
    get: get || (r => r.semaine),
    summary: sel => (sel.length ? M.fmt.sems(sel) : 'Toutes'),
    help: 'Semaines de départ des camions',
  });
  /** Filtre « N° de dossier » : champ à choix multiple. get(ligne) → n° de dossier (ou liste). Les propositions
      viennent des dossiers présents dans les lignes de la page ; un n° de DA ou un annonceur les retrouve aussi. */
  ui.dossierFilter = (rows, get) => {
    const ids = M.uniq((rows || []).flatMap(r => { const v = get(r); return (Array.isArray(v) ? v : [v]).filter(Boolean).map(String); }));
    return {
      key: 'dossier', label: 'N° de dossier', short: 'Dossier', input: true, get,
      placeholder: 'n° de dossier, de DA…',
      help: 'Un ou plusieurs dossiers : tapez un n° de dossier, de DA ou un annonceur, ou collez une liste',
      options: () => ids.map(id => {
        const d = M.calc.dossier(id);
        return { value: id, label: id, sub: d ? d.annonceur + ' · S' + d.semaines.join('+S') + ' · ' + d.format : '', aliases: d ? [d.da, d.annonceur] : [] };
      }).sort((a, b) => a.value.localeCompare(b.value)),
    };
  };

  /* ---------- Statuts, sévérités, indicateurs ---------- */
  ui.pill = function (code, extra) {
    const s = M.STATUTS[code] || { label: code, step: 0 };
    return h('span', { class: ['cz-status', 's-' + s.step], title: s.help || '' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), s.label, extra ? ' ' + extra : '');
  };
  const SEV = {
    critical: { icon: 'alert-triangle', label: 'Critique', cls: 'bg-red-lt' },
    serious: { icon: 'alert-circle', label: 'Important', cls: 'bg-orange-lt' },
    warning: { icon: 'alert-circle', label: 'À surveiller', cls: 'bg-yellow-lt' },
    good: { icon: 'circle-check', label: 'OK', cls: 'bg-green-lt' },
    info: { icon: 'info-circle', label: 'Info', cls: 'bg-secondary-lt' },
  };
  ui.sev = function (level, label) {
    const s = SEV[level] || SEV.info;
    return h('span', { class: ['badge', 'cz-sev', s.cls] }, ui.icon(s.icon), label || s.label);
  };
  ui.stat = function ({ label, value, sub, onClick, title }) {
    return h('div', { class: ['card', 'stat', onClick ? 'clickable' : ''], onclick: onClick, title, role: onClick ? 'button' : null, tabindex: onClick ? '0' : null, onkeydown: onClick ? e => { if (e.key === 'Enter') onClick(); } : null },
      h('div', { class: 'card-body' },
        h('div', { class: 'subheader stat-label' }, label),
        h('div', { class: 'stat-value' }, value),
        sub ? h('div', { class: 'stat-sub' }, sub) : null));
  };
  ui.meter = function (ratio, label) {
    const r = Math.max(0, Math.min(1, ratio || 0));
    return h('div', { class: 'cz-meter' },
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(r * 100)) }, h('div', { class: 'progress-bar', style: { width: (r * 100) + '%' } })),
      label === '' ? null : h('span', { class: 'small num', style: { minWidth: '42px' } }, label !== undefined ? label : M.fmt.pct(r)));
  };
  ui.steps = function (labels, current) {
    return h('ul', { class: 'steps steps-counter steps-cyan' }, labels.map((l, i) => h('li', { class: ['step-item', i === current ? 'active' : ''] }, l)));
  };
  /** Couleur stable pour les vignettes d'affiches (visuels fictifs). */
  const POSTER = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6', '#e34948', '#008300', '#c98500', '#d55181', '#1c5cab', '#0d366b'];
  /** Vignette d'affiche fictive ; taille : vrai = petite, 'lg' = grande (fenêtre « Visuel »). */
  ui.poster = function (title, sub, small) {
    let hsh = 0; for (const c of String(title)) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
    const c1 = POSTER[hsh % POSTER.length], c2 = POSTER[(hsh >>> 4) % POSTER.length]; // >>> : décalage non signé (sinon indice négatif)
    return h('div', { class: ['poster', small === 'lg' ? 'lg' : small ? 'sm' : ''], style: { background: 'linear-gradient(160deg,' + c1 + ',' + c2 + ')' }, title: 'Visuel fictif' }, h('span', null, title), sub ? h('span', { style: { fontWeight: 500, opacity: .9 } }, sub) : null);
  };

  /* ---------- Voir le visuel (demande du 16/10) : un petit bouton à côté de chaque visuel, dans toutes les listes ---------- */
  /** Thème d'une ligne : ligne de suivi ou de besoin (t), unité (themeId), affiche (première allocation) ; null sinon. */
  ui.themeDe = r => (r && (r.t || (r.themeId && M.calc.theme(r.themeId)) || (r.a && r.a.alloc && r.a.alloc[0] && M.calc.theme(r.a.alloc[0].themeId)))) || null;
  /** Fenêtre « Visuel » : l'affiche en grand, et de quoi la retrouver (dossier, format, départ, n° d'affiche, emplacement). */
  ui.voirVisuel = function (t) {
    const C = M.calc, d = C.dossier(t.dossierId);
    const ann = t.annonceurImprime || d.annonceur;
    const afs = M.data.affiches.filter(a => a.alloc.some(x => x.themeId === t.id));
    const ligne = (k, v) => (v || v === 0 ? h('div', { class: 'cz-visuel-row' }, h('span', { class: 'muted' }, k), h('span', null, v)) : null);
    ui.modal({ title: 'Visuel · ' + ann + ' · ' + t.libelle, body: [
      h('div', { class: 'cz-visuel-modal' },
        ui.poster(t.libelle, ann, 'lg'),
        h('div', { class: 'cz-visuel-info' },
          ligne('Dossier', d.id + ' (DA ' + d.da + ')'),
          ligne('Atelier', C.atelier(d.atelier).label + ' · ' + C.site(d.site).label),
          ligne('Format', d.format),
          ligne('Départ', d.semaines.map(s => 'S' + s).join(' + ')),
          C.atelier(d.atelier).mode === 'train' ? ligne('Position dans le train', t.position + (d.controlee ? ' (campagne contrôlée, en tête)' : '')) : null,
          ligne('Repiquage', t.repiquage || null),
          ligne('Reçu / attendu', M.fmt.n(C.recu(t.id)) + ' / ' + M.fmt.n(t.qteEnt)),
          ligne('N° d’affiche', afs.length ? afs.map(a => a.id + ' (' + a.allee + '-' + a.rayon + ')').join(', ') : 'pas encore reçue'),
          ligne('Exclusion', t.exclu ? (t.exclu === 'RESTE_EN_PLACE' ? 'reste en place' : 'ne pas afficher') : null),
          h('div', { class: 'cz-visuel-row' }, h('span', { class: 'muted' }, 'Préparation'), ui.pill(M.calc.statutDossier(d))))),
      ui.annot('Aperçu fictif dans la maquette. Dans la cible : le visuel transmis par Broadcast (le lien « visuel disponible » de l’état des réservations), ou la photo prise à la réception.', ['REC-04', 'REC-17']),
    ], actions: [{ label: 'Fermer' }] });
  };
  /** Petit bouton « voir le visuel », à côté d'un intitulé ; il n'ouvre pas la ligne du tableau. */
  ui.btnVisuel = t => (t ? h('button', { type: 'button', class: 'btn btn-sm btn-icon btn-ghost-secondary cz-btn-visuel', title: 'Voir le visuel', 'aria-label': 'Voir le visuel « ' + t.libelle + ' »', onclick: e => { e.stopPropagation(); ui.voirVisuel(t); } }, ui.icon('photo')) : null);

  /* ---------- Info-bulles (texte via textContent) ---------- */
  ui.tip = function (el, build) {
    const tt = document.getElementById('tooltip');
    const show = ev => {
      M.clear(tt);
      const content = build();
      (Array.isArray(content) ? content : [content]).forEach(c => c && tt.appendChild(c));
      tt.hidden = false;
      move(ev);
    };
    const move = ev => {
      let x, y;
      if (ev && ev.clientX !== undefined && ev.type !== 'focus') { x = ev.clientX + 14; y = ev.clientY + 14; }
      else { const r = el.getBoundingClientRect(); x = r.left; y = r.bottom + 6; }
      const w = tt.offsetWidth, hh = tt.offsetHeight;
      if (x + w > window.innerWidth - 8) x = window.innerWidth - w - 8;
      if (y + hh > window.innerHeight - 8) y = y - hh - 24;
      tt.style.left = x + 'px'; tt.style.top = y + 'px';
    };
    const hide = () => { tt.hidden = true; };
    el.addEventListener('pointerenter', show); el.addEventListener('pointermove', move); el.addEventListener('pointerleave', hide);
    el.addEventListener('focus', show); el.addEventListener('blur', hide);
    return el;
  };

  /* ---------- Onglets ---------- */
  ui.tabs = function (tabs, active, onChange) {
    return h('ul', { class: 'nav nav-tabs cz-tabs', role: 'tablist' }, tabs.map(t => h('li', { class: 'nav-item', role: 'presentation' },
      h('button', { type: 'button', class: ['nav-link', t.id === active ? 'active' : ''], role: 'tab', 'aria-selected': String(t.id === active), onclick: () => onChange(t.id) },
        t.label, t.count !== undefined && t.count !== null && t.count !== '' ? h('span', { class: ['badge', t.id === active ? 'bg-primary-lt' : 'bg-secondary-lt'] }, t.count) : null))));
  };

  /* ---------- Fenêtre modale (Tabler modal) et panneau latéral (offcanvas) ---------- */
  ui.modal = function ({ title, body, actions, wide }) {
    const root = document.getElementById('overlay-root');
    let ov, bd;
    const close = () => { overlays.delete(close); ui.disposeWidgets(ov); ov.remove(); bd.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    overlays.add(close);
    bd = h('div', { class: 'modal-backdrop fade show' });
    ov = h('div', { class: 'modal modal-blur fade show cz-modal', tabindex: '-1', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: e => { if (e.target === ov) close(); } },
      h('div', { class: ['modal-dialog', wide ? 'modal-xl' : 'modal-lg'], role: 'document' },
        h('div', { class: 'modal-content' },
          h('div', { class: 'modal-header' }, h('h2', { class: 'modal-title' }, title), h('button', { type: 'button', class: 'btn-close', 'aria-label': 'Fermer', onclick: close })),
          h('div', { class: 'modal-body' }, typeof body === 'function' ? body(close) : body),
          h('div', { class: 'modal-footer' }, (actions || [{ label: 'Fermer' }]).map(a => ui.btn(a.label, () => { const keep = a.onClick ? a.onClick(close) : false; if (keep !== true) close(); }, { primary: a.primary, danger: a.danger, disabled: a.disabled, icon: a.icon }))))));
    root.appendChild(bd); root.appendChild(ov);
    document.addEventListener('keydown', esc);
    const first = ov.querySelector('.modal-body input, .modal-body select, .modal-body textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return close;
  };
  ui.drawer = function ({ title, body }) {
    const root = document.getElementById('overlay-root');
    const bg = h('div', { class: 'offcanvas-backdrop fade show' });
    const dr = h('aside', { class: 'offcanvas offcanvas-end show cz-offcanvas', tabindex: '-1', role: 'dialog', 'aria-label': title },
      h('div', { class: 'offcanvas-header' }, h('h2', { class: 'offcanvas-title' }, title), h('button', { type: 'button', class: 'btn-close', 'aria-label': 'Fermer', onclick: () => close() })),
      h('div', { class: 'offcanvas-body' }, body));
    const close = () => { overlays.delete(close); ui.disposeWidgets(dr); bg.remove(); dr.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    overlays.add(close);
    bg.addEventListener('click', close);
    root.appendChild(bg); root.appendChild(dr);
    document.addEventListener('keydown', esc);
    return close;
  };
  ui.toast = function (msg, tone) {
    let box = document.querySelector('.cz-toasts');
    if (!box) { box = h('div', { class: 'cz-toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
    const icon = { good: 'circle-check', critical: 'alert-triangle', mail: 'mail-forward' }[tone] || 'info-circle';
    const t = h('div', { class: ['cz-toast', tone || ''] }, ui.icon(icon), h('div', null, msg));
    box.appendChild(t);
    setTimeout(() => t.remove(), 5000);
  };

  /* ---------- Mails simulés ---------- */
  ui.mailbox = function () {
    const D = M.data;
    D.outbox.forEach(m => { m.lu = true; });
    ui.modal({
      title: "Mails envoyés par l'application (simulation)",
      wide: true,
      body: [
        h('p', { class: 'muted small' }, "Aucun mail ne part réellement. Les destinataires sont des rôles et des listes paramétrables (Paramétrage › Alertes et mails). Q10 du référentiel : destinataires définitifs à confirmer."),
        D.outbox.length ? D.outbox.slice().reverse().map(m => h('div', { class: 'mail' },
          h('div', { class: 'mail-head' },
            h('div', null, h('b', null, m.subject)),
            h('div', null, 'À : ', m.to.join(', ')),
            h('div', { class: 'muted' }, M.fmt.dt(m.date) + ' · déclencheur : ' + m.trigger, m.needs ? [' · ', ui.chips(m.needs)] : null)),
          h('div', { class: 'mail-body' }, m.body))) : h('div', { class: 'dt-empty' }, 'Aucun mail pour le moment.'),
      ],
    });
    M.refresh();
  };

  /* ---------- Menu « Simuler » ---------- */
  ui.simulateMenu = function (anchor) {
    const menu = ui.menuAt(anchor, 380);
    M.mount(menu,
      h('div', { class: 'cz-menu-help' }, 'Événements de démonstration. Ils modifient les données fictives en mémoire.'),
      M.SIMULATIONS.map(s => h('button', { type: 'button', class: 'dropdown-item', onclick: () => { close(); s.run(); M.refresh(); } },
        h('div', null, h('div', { style: { fontWeight: 600 } }, s.label), h('div', { class: 'small muted' }, s.help)))));
    const close = ui.popup(menu);
  };

  /* ==========================================================================
     Tableau de données (Tabulator 6)
     Même interface qu'avant pour les écrans : colonnes {key, label, value, render,
     csv, align, wrap, hidden, sortable, title}, sélection, actions groupées, ton
     de ligne, pied de tableau, recherche, export CSV, vue mémorisée par id.
     ========================================================================== */
  const tstate = M.tableState = M.tableState || {};
  function toNode(x) {
    if (x instanceof Node) return x;
    if (Array.isArray(x)) return h('span', null, x);
    return h('span', null, x === null || x === undefined ? '' : String(x));
  }
  function compare(a, b, aRow, bRow, column, dir) {
    const nil = v => v === null || v === undefined || v === '';
    if (a === b) return 0;
    if (nil(a)) return dir === 'asc' ? 1 : -1;
    if (nil(b)) return dir === 'asc' ? -1 : 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'fr', { numeric: true });
  }

  /* Vue de chaque tableau (ordre des colonnes, colonnes affichées) gardée d'une ouverture à l'autre sur ce poste
     (localStorage, clé circe-maquette-vues : { idTableau: { order: [clés], vis: [[clé, visible]] } }). Sans stockage
     disponible, la vue reste mémorisée pour la session. */
  const VUES = 'circe-maquette-vues';
  const vuesLues = () => { try { return JSON.parse(localStorage.getItem(VUES) || '{}') || {}; } catch (e) { return {}; } };
  const garderVue = (id, st) => {
    try {
      const all = vuesLues();
      if (!st.order && !st.vis.size) delete all[id]; else all[id] = { order: st.order, vis: Array.from(st.vis.entries()) };
      localStorage.setItem(VUES, JSON.stringify(all));
    } catch (e) { /* stockage indisponible : vue gardée pour la session seulement */ }
  };

  ui.table = function (o) {
    const id = o.id || 'table';
    // vis : seuls les choix explicites de l'utilisateur sont mémorisés ; sinon la colonne suit sa règle par défaut (hidden).
    if (!tstate[id]) { const v = vuesLues()[id]; tstate[id] = { sort: o.sort || null, vis: new Map(v && v.vis ? v.vis : []), order: v && v.order ? v.order : null, q: '', sel: new Set(), dense: false }; }
    const st = tstate[id];
    // Filtres d'en-tête (21/10) : un champ sous le titre de chaque colonne, en plus des filtres de la ligne d'outils ; gardés pour la session
    if (!st.hf) st.hf = {};
    if (o.query && st.qInit !== o.query) { st.q = o.query; st.qInit = o.query; }
    const rowKey = o.rowKey || (r => r.id);
    const cols = o.columns;
    const shown = c => st.vis.has(c.key) ? st.vis.get(c.key) : !c.hidden;
    const byKey = new Map();
    const data = o.rows.map(r => {
      const k = String(rowKey(r));
      byKey.set(k, r);
      const d = { __k: k };
      cols.forEach((c, j) => { d['c' + j] = c.value ? c.value(r) : r[c.key]; });
      return d;
    });
    const fieldOf = key => { const j = cols.findIndex(c => c.key === key); return j < 0 ? null : 'c' + j; };
    const keyOf = field => { const j = Number(String(field).slice(1)); return cols[j] ? cols[j].key : null; };
    let table = null;
    /* Texte d'une cellule pour le filtre d'en-tête : celui de l'export s'il existe, sinon le texte affiché ; sans accents ni
       majuscules (« reçu » trouve « Reçu »). Calculé à la première frappe, puis gardé pour ce tableau. */
    const sansAccent = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const txtCache = new Map();
    const texteCellule = (k, j) => {
      const ck = k + '|' + j;
      if (txtCache.has(ck)) return txtCache.get(ck);
      const c = cols[j], r = byKey.get(k);
      let t = '';
      try {
        const v = c.value ? c.value(r) : r[c.key];
        t = c.csv ? c.csv(r) : typeof v === 'string' ? v : c.render ? toNode(c.render(r)).textContent : fmtCell(v);
      } catch (e) { t = ''; }
      t = sansAccent(t === null || t === undefined ? '' : t);
      txtCache.set(ck, t);
      return t;
    };
    // Colonnes de nombres : « >10 », « <5 », « >=3 », « =0 » comparent la valeur ; tout autre texte cherche dans la cellule
    const OPERATEUR = /^\s*(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)\s*$/;
    const filtreEntete = (c, j) => (saisie, valeur, ligne) => {
      const m = c.align === 'num' ? OPERATEUR.exec(saisie) : null;
      if (m && typeof valeur === 'number') {
        const n = Number(m[2].replace(',', '.'));
        return m[1] === '>' ? valeur > n : m[1] === '<' ? valeur < n : m[1] === '>=' ? valeur >= n : m[1] === '<=' ? valeur <= n : valeur === n;
      }
      const q = sansAccent(saisie).trim();
      return !q || texteCellule(ligne.__k, j).includes(q);
    };
    const avecFiltresEntete = o.headerFilters !== false;

    const wrap = h('div', { class: ['cz-table', st.dense ? 'is-dense' : '', o.onRowClick ? 'is-clickable' : ''] });
    const holder = h('div', { class: 'cz-table-holder' });
    const info = h('span', { class: 'cz-table-info' }, data.length + ' ligne' + (data.length > 1 ? 's' : ''));
    const bulk = h('span', { class: 'cz-table-bulk' });

    const visibleCols = () => table
      ? table.getColumns().filter(c => c.isVisible() && /^c\d+$/.test(c.getField() || '')).map(c => cols[Number(c.getField().slice(1))])
      : cols.filter(shown);
    const colCount = h('span', { class: 'cz-col-count' });
    const updateColCount = () => { colCount.textContent = visibleCols().length + '/' + cols.length; };
    const activeRows = () => table ? table.getData('active').map(d => byKey.get(d.__k)) : o.rows;
    const updateInfo = n => { const c = n === undefined ? activeRows().length : n; info.textContent = c + ' ligne' + (c > 1 ? 's' : '') + (c !== data.length ? ' sur ' + data.length : ''); };
    const updateBulk = () => {
      M.clear(bulk);
      if (!o.bulkActions || !st.sel.size) return;
      const selRows = o.rows.filter(r => st.sel.has(String(rowKey(r))));
      if (!selRows.length) return;
      // h() accepte un tableau d'enfants ; Element.append le convertirait en texte.
      M.mount(bulk, h('b', null, selRows.length + ' sélectionnée' + (selRows.length > 1 ? 's' : '') + ' :'), o.bulkActions(selRows, () => { if (table) table.deselectRow(); st.sel.clear(); updateBulk(); }));
    };
    const applySearch = () => {
      if (!table) return;
      const q = (st.q || '').toLowerCase().trim();
      if (!q) { table.clearFilter(); return; }
      const fields = visibleCols().map(c => 'c' + cols.indexOf(c));
      table.setFilter(d => fields.some(f => { const v = d[f]; return v !== null && v !== undefined && String(v).toLowerCase().includes(q); }));
    };
    // Export Excel (.xlsx) des lignes et colonnes affichées, dans l'ordre et avec les filtres de l'écran
    const exportXlsx = () => {
      const vc = visibleCols();
      M.downloadXLSX(o.exportName, activeRows(), vc.map(c => ({ label: c.label, value: r => c.csv ? c.csv(r) : (c.value ? c.value(r) : r[c.key]) })));
    };
    const dataColumns = () => (table ? table.getColumns().filter(c => /^c\d+$/.test(c.getField() || '')) : []);
    /** Menu « Colonnes » : afficher ou masquer, et changer l'ordre avec les flèches (FIX-03, ERG-02). Les clics ne
        remontent pas au document : le menu, redessiné, reste ouvert. */
    const columnMenu = anchor => {
      const menu = ui.menuAt(anchor, 330);
      const garderOrdre = () => { st.order = table.getColumns().map(c => c.getField()).filter(f => /^c\d+$/.test(f || '')).map(keyOf); garderVue(id, st); };
      const deplacer = (e, col, cible, apres) => { e.stopPropagation(); table.moveColumn(col.getField(), cible.getField(), apres); garderOrdre(); applySearch(); fill(); };
      const fill = () => {
        const dcs = dataColumns();
        M.mount(menu,
          h('div', { class: 'cz-menu-help' }, 'Cochez les colonnes à afficher ; les flèches changent l’ordre (on peut aussi glisser un en-tête). La vue est gardée sur ce poste, et l’export Excel la suit.'),
          dcs.map((col, i) => {
            const lib = cols[Number(col.getField().slice(1))].label || '(sans titre)';
            return h('div', { class: 'col-item' },
              h('label', null, h('input', { class: 'form-check-input m-0', type: 'checkbox', checked: col.isVisible(), onchange: e => { e.target.checked ? col.show() : col.hide(); applySearch(); } }), h('span', null, lib)),
              h('button', { type: 'button', class: 'btn btn-sm btn-icon btn-ghost-secondary', title: 'Monter', 'aria-label': 'Monter « ' + lib + ' »', disabled: i === 0, onclick: e => deplacer(e, col, dcs[i - 1], false) }, ui.icon('arrow-up')),
              h('button', { type: 'button', class: 'btn btn-sm btn-icon btn-ghost-secondary', title: 'Descendre', 'aria-label': 'Descendre « ' + lib + ' »', disabled: i === dcs.length - 1, onclick: e => deplacer(e, col, dcs[i + 1], true) }, ui.icon('arrow-down')));
          }),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '6px' } },
            // Vue par défaut : ordre et colonnes d'origine, vue gardée effacée
            ui.btn('Vue par défaut', e => { e.stopPropagation(); cols.forEach((c, j) => { if (j) table.moveColumn('c' + j, 'c' + (j - 1), true); }); dataColumns().forEach(col => { cols[Number(col.getField().slice(1))].hidden ? col.hide() : col.show(); }); st.vis.clear(); st.order = null; garderVue(id, st); applySearch(); fill(); }, { small: true, ghost: true }),
            ui.btn('Tout afficher', e => { e.stopPropagation(); dataColumns().forEach(col => col.show()); applySearch(); fill(); }, { small: true })));
      };
      fill();
      ui.popup(menu);
    };

    // « Effacer les filtres des colonnes » : visible seulement quand un filtre d'en-tête est posé
    const effacerEntetes = ui.btn('Effacer les filtres des colonnes', () => { if (table) table.clearHeaderFilter(); st.hf = {}; majEffacer(); }, { small: true, ghost: true, icon: 'filter', title: 'Vider les champs de filtre sous les titres des colonnes' });
    const majEffacer = () => { effacerEntetes.hidden = !Object.keys(st.hf).length; };
    majEffacer();
    const toolbar = h('div', { class: 'cz-table-toolbar' },
      o.search === false ? null : h('div', { class: 'cz-table-search' }, ui.icon('search'),
        h('input', { class: 'form-control form-control-sm', type: 'search', placeholder: 'Rechercher dans le tableau…', 'aria-label': 'Rechercher dans le tableau', value: st.q, oninput: e => { st.q = e.target.value; applySearch(); } })),
      o.toolbar || null,
      bulk,
      // Nombre de lignes et outils groupés à droite : quand les filtres remplissent la ligne, ils passent ensemble à la suivante
      h('div', { class: 'cz-table-outils' },
        avecFiltresEntete ? effacerEntetes : null,
        info,
        ui.btn(st.dense ? 'Confort' : 'Compact', e => { st.dense = !st.dense; wrap.classList.toggle('is-dense', st.dense); e.currentTarget.lastChild.textContent = st.dense ? 'Confort' : 'Compact'; if (table) table.redraw(true); }, { small: true, ghost: true, icon: 'layout-rows', title: 'Changer la densité des lignes' }),
        o.columnsMenu === false ? null : (() => { const b = ui.btn('Colonnes', e => columnMenu(e.currentTarget), { small: true, icon: 'layout-columns', title: 'Colonnes affichées / disponibles : afficher, masquer, revenir à la vue par défaut' }); b.append(colCount); return b; })(),
        o.exportName ? ui.btn('Exporter', exportXlsx, { small: true, icon: 'download', title: 'Exporter les lignes affichées dans un fichier Excel' }) : null));

    // Colonnes Tabulator, dans l'ordre mémorisé
    let ordered = cols.slice();
    if (st.order) ordered.sort((a, b) => { const ia = st.order.indexOf(a.key), ib = st.order.indexOf(b.key); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
    const tcols = ordered.map(c => {
      const j = cols.indexOf(c);
      const def = {
        title: c.label || '', field: 'c' + j, visible: shown(c),
        headerSort: c.sortable !== false, headerTooltip: c.title || false,
        hozAlign: c.align === 'num' ? 'right' : 'left', headerHozAlign: c.align === 'num' ? 'right' : 'left',
        sorter: compare,
        formatter: cell => { const r = byKey.get(cell.getRow().getData().__k); return toNode(c.render ? c.render(r) : fmtCell(cell.getValue())); },
        cssClass: [c.wrap ? 'cz-wrap' : '', c.align === 'num' ? 'cz-num' : ''].filter(Boolean).join(' '),
        minWidth: c.wrap ? 200 : 60,
        resizable: true,
      };
      // Filtre d'en-tête (21/10) : un champ texte sous le titre ; une colonne peut s'en passer avec filter: false
      if (avecFiltresEntete && c.filter !== false) {
        def.headerFilter = 'input';
        def.headerFilterPlaceholder = 'Filtrer';
        def.headerFilterFunc = filtreEntete(c, j);
        def.headerFilterParams = { elementAttributes: { 'aria-label': 'Filtrer la colonne « ' + (c.label || 'sans titre') + ' »' + (c.align === 'num' ? ' (texte, ou >10, <5, =0)' : ''), title: c.align === 'num' ? 'Texte, ou une comparaison : >10, <5, >=3, =0' : 'Texte contenu dans la colonne', autocomplete: 'off', spellcheck: 'false' } };
      }
      // Texte long : largeur initiale bornée (le texte passe à la ligne), l'utilisateur peut élargir la colonne.
      if (c.wrap) def.maxInitialWidth = c.maxWidth || 380;
      if (typeof c.width === 'number') def.width = c.width;
      if (o.footer) def.bottomCalc = (values, rowsData) => { const v = o.footer(c, rowsData.map(d => byKey.get(d.__k))); return v === undefined || v === null ? '' : v; };
      return def;
    });
    // Actions de ligne : 2 au plus, figées à droite. inline-flex sans rétrécissement : Tabulator mesure ainsi la vraie largeur.
    if (o.rowActions) tcols.push({ title: '', field: '__act', headerSort: false, resizable: false, hozAlign: 'right', cssClass: 'cz-actions', frozen: true, formatter: cell => h('span', { class: 'cz-row-actions' }, o.rowActions(byKey.get(cell.getRow().getData().__k))) });

    const sortField = st.sort ? fieldOf(st.sort.key) : null;
    const opts = {
      data,
      columns: tcols,
      index: '__k',
      layout: 'fitDataStretch',
      movableColumns: true,
      placeholder: h('div', { class: 'cz-empty' }, o.empty || 'Aucune ligne pour ces filtres.'),
      renderVertical: o.tall ? 'basic' : 'virtual',
      selectableRows: o.selectable ? 'highlight' : false,
      columnDefaults: { headerSortTristate: false },
    };
    if (!o.tall) opts.maxHeight = o.maxHeight || '560px';
    if (sortField) opts.initialSort = [{ column: sortField, dir: st.sort.dir }];
    // Filtres d'en-tête repris de l'affichage précédent (une action redessine la page : les filtres restent)
    const hfInit = Object.entries(st.hf).map(([key, value]) => ({ field: fieldOf(key), value })).filter(x => x.field && x.value);
    if (avecFiltresEntete && hfInit.length) opts.initialHeaderFilter = hfInit;
    // Tabulator appelle aussi rowFormatter pour la ligne de totaux : elle n'a pas de ligne source.
    if (o.tone) opts.rowFormatter = row => { const r = byKey.get(row.getData().__k); const t = r ? o.tone(r) : null; if (t) row.getElement().classList.add('cz-tone-' + t); };
    if (o.selectable) opts.rowHeader = { formatter: 'rowSelection', titleFormatter: 'rowSelection', headerSort: false, resizable: false, frozen: true, hozAlign: 'center', headerHozAlign: 'center', width: 44 };

    ui.whenAttached(holder, () => {
      if (typeof window.Tabulator !== 'function') { M.mount(holder, h('div', { class: 'cz-empty' }, 'Librairie Tabulator introuvable (assets/vendor/tabulator).')); return; }
      table = new window.Tabulator(holder, opts);
      M._tables.set(id, table);
      ui.registerWidget({ el: holder, dispose: () => { table.destroy(); if (M._tables.get(id) === table) M._tables.delete(id); } });
      table.on('tableBuilt', () => {
        applySearch();
        // Pré-sélection (option A, 02/11) : les lignes que `preselect` désigne sont cochées une fois par arrivée sur l'écran (M.navSeq)
        if (o.preselect && o.selectable && st.preselSeq !== M.navSeq) { st.preselSeq = M.navSeq; o.rows.forEach(r => { if (o.preselect(r)) st.sel.add(String(rowKey(r))); }); }
        const keep = Array.from(st.sel).filter(k => byKey.has(k));
        if (keep.length && o.selectable) table.selectRow(keep);
        updateInfo(); updateBulk(); updateColCount();
      });
      table.on('dataFiltered', (filters, rows) => {
        updateInfo(rows.length);
        if (!avecFiltresEntete) return;
        st.hf = {};
        table.getHeaderFilters().forEach(f => { const k = keyOf(f.field); if (k && f.value !== '' && f.value !== null && f.value !== undefined) st.hf[k] = f.value; });
        majEffacer();
      });
      // Ombre sur la colonne d'actions figée seulement quand le tableau défile horizontalement.
      table.on('renderComplete', () => { const th = holder.querySelector('.tabulator-tableholder'); wrap.classList.toggle('is-overflow', !!th && th.scrollWidth > th.clientWidth + 1); });
      table.on('rowSelectionChanged', dataSel => {
        st.sel = new Set(dataSel.map(d => d.__k));
        updateBulk();
        if (o.onSelectionChange) o.onSelectionChange(dataSel.map(d => byKey.get(d.__k)));
      });
      /* Sélection en glissant (09/11), dans tout tableau à cases : on appuie sur une ligne (ou sa case), on glisse vers le haut ou
         le bas, et toutes les lignes survolées prennent l'état inverse de la première (cochées, ou décochées si elle l'était).
         Revenir en arrière rend aux lignes quittées leur état d'avant. Un simple clic garde son effet (case, ouverture de la ligne). */
      if (o.selectable) {
        let drag = null, bloquerClic = false;
        const champ = el => el.closest('button,a,select,textarea,input:not([type="checkbox"])');
        table.on('rowMouseDown', (e, row) => {
          if (e.button !== 0 || champ(e.target)) return;
          drag = { start: row, etat: !row.isSelected(), avant: new Set(table.getSelectedRows()), plage: [], bouge: false };
        });
        table.on('rowMouseEnter', (e, row) => {
          if (!drag || !(e.buttons & 1)) return;
          const rows = table.getRows('active'), i0 = rows.indexOf(drag.start), i1 = rows.indexOf(row);
          if (i0 < 0 || i1 < 0) return;
          if (!drag.bouge) { drag.bouge = true; holder.classList.add('is-dragsel'); const s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges(); }
          const plage = rows.slice(Math.min(i0, i1), Math.max(i0, i1) + 1), dans = new Set(plage);
          // Lignes quittées : leur état d'avant le glissé
          drag.plage.filter(r => !dans.has(r)).forEach(r => (drag.avant.has(r) ? r.select() : r.deselect()));
          if (drag.etat) table.selectRow(plage); else table.deselectRow(plage);
          drag.plage = plage;
        });
        const finDrag = () => {
          if (!drag) return;
          if (drag.bouge) { bloquerClic = true; setTimeout(() => { bloquerClic = false; }, 300); holder.classList.remove('is-dragsel'); }
          drag = null;
        };
        // Le clic qui suit un glissé ne doit ni recocher la case ni ouvrir la ligne
        const avalerClic = e => { if (bloquerClic) { e.stopPropagation(); e.preventDefault(); bloquerClic = false; } };
        document.addEventListener('mouseup', finDrag);
        holder.addEventListener('click', avalerClic, true);
        ui.registerWidget({ el: holder, dispose: () => { document.removeEventListener('mouseup', finDrag); holder.removeEventListener('click', avalerClic, true); } });
      }
      table.on('dataSorted', sorters => { const s = sorters && sorters[0]; st.sort = s ? { key: keyOf(s.field), dir: s.dir } : st.sort; });
      table.on('columnMoved', () => { st.order = table.getColumns().map(c => c.getField()).filter(f => /^c\d+$/.test(f || '')).map(keyOf); garderVue(id, st); });
      table.on('columnVisibilityChanged', (col, visible) => { const k = keyOf(col.getField()); if (!k) return; st.vis.set(k, visible); garderVue(id, st); updateColCount(); });
      if (o.onRowClick) table.on('rowClick', (e, row) => { if (e.target.closest('input,button,a,select,label,textarea,.tabulator-row-header')) return; o.onRowClick(byKey.get(row.getData().__k)); });
    });

    M.mount(wrap, o.noToolbar ? null : toolbar, holder);
    wrap.redraw = () => { if (table) table.redraw(true); };
    wrap.getSelection = () => o.rows.filter(r => st.sel.has(String(rowKey(r))));
    wrap.clearSelection = () => { if (table) table.deselectRow(); };
    return wrap;
  };
  /**
   * Colonne « Annonceur · thème » : un visuel se désigne ainsi à l'atelier et sur les bagues.
   * Une seule colonne au lieu de deux (règle des 8 colonnes, DESIGN.md §4.5) ; la recherche porte sur les deux.
   * Un petit bouton devant l'intitulé ouvre le visuel (extra.theme : thème de la ligne, si ui.themeDe ne le trouve pas).
   */
  ui.colVisuel = function (get, extra) {
    const parts = get || (r => [r.annonceur, r.theme]);
    const themeOf = (extra && extra.theme) || ui.themeDe;
    return Object.assign({
      key: 'visuel', label: 'Annonceur · thème',
      value: r => parts(r).slice(0, 2).filter(Boolean).join(' · '),
      render: r => { const [a, t, more] = parts(r); return h('span', { class: 'cz-visuel' }, ui.btnVisuel(themeOf(r)), h('b', null, a), t ? h('span', { class: 'cz-visuel-t' }, ' · ' + t) : null, more || null); },
    }, extra || {});
  };
  /** Libellé suivi du site quand on regarde toutes les plateformes (évite une colonne Site de plus). */
  ui.withSite = (label, siteId) => (M.state.site === 'ALL' && siteId ? label + ' · ' + M.calc.site(siteId).label : label);

  function fmtCell(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'number') return M.fmt.n(v);
    if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
    return String(v);
  }
  ui.fmtCell = fmtCell;
})();
