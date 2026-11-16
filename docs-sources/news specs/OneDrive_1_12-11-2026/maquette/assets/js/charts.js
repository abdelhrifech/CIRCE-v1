/* ==========================================================================
   Circé — maquette cible : graphiques (Apache ECharts 6, rendu SVG)
   Barres horizontales simples ou empilées : barres fines (16 px), extrémité
   arrondie, 1 px de séparation blanche entre segments, légende dès 2 séries,
   total en bout de barre, info-bulle par ligne, vue tableau équivalente.
   Couleurs : rampe ordinale bleue validée (étapes) ou série 1 (une seule série).
   ========================================================================== */
(function () {
  'use strict';
  const M = window.M;
  const h = M.h;
  const chart = M.chart = {};
  const INK = '#16191d', INK2 = '#4b5260', INK3 = '#6f7683', GRID = '#e6e8ea', AXIS = '#c3c9d1';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** ECharts ne lit pas les variables CSS : on les résout ici. */
  const resolve = color => {
    const m = /^var\((--[\w-]+)\)$/.exec(String(color || '').trim());
    return m ? (getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#e0607e') : color;
  };
  const compact = v => v >= 1000 ? (Math.round(v / 100) / 10).toString().replace('.', ',') + ' k' : String(v);

  /**
   * @param {object} o
   *  series: [{key, label, color}]
   *  rows:   [{label, sub, values: {key: number}, onClick}]
   *  unit, caption, rowHeader, fmt, totalLabel(row, total)
   */
  chart.hbars = function (o) {
    const series = o.series;
    const fmt = o.fmt || M.fmt.n;
    let mode = 'chart';
    const root = h('figure', { class: 'cz-chart' });

    function draw() {
      const totals = o.rows.map(r => M.sum(series, s => r.values[s.key] || 0));
      const toggle = M.ui.btn(mode === 'chart' ? 'Voir en tableau' : 'Voir en graphique', () => { mode = mode === 'chart' ? 'table' : 'chart'; M.ui.disposeWidgets(root); draw(); }, { small: true, ghost: true, icon: mode === 'chart' ? 'table' : 'chart-bar' });
      const head = h('div', { class: 'cz-chart-head' }, h('figcaption', null, o.caption || ''), toggle);

      if (mode === 'table') {
        M.mount(root, head, h('div', { class: 'table-wrap', style: { maxHeight: '420px' } },
          h('table', { class: 'dt' },
            h('thead', null, h('tr', null, h('th', null, o.rowHeader || ''), series.map(s => h('th', { class: 'num' }, s.label)), series.length > 1 ? h('th', { class: 'num' }, 'Total') : null)),
            h('tbody', null, o.rows.map((r, i) => h('tr', null, h('td', null, r.label, r.sub ? h('span', { class: 'muted small' }, ' · ' + r.sub) : null), series.map(s => h('td', { class: 'num' }, fmt(r.values[s.key] || 0))), series.length > 1 ? h('td', { class: 'num' }, h('b', null, fmt(totals[i]))) : null))))));
        return;
      }
      if (!o.rows.length) { M.mount(root, head, h('div', { class: 'cz-empty' }, 'Rien à afficher pour ces filtres.')); return; }

      const legend = series.length > 1;
      const height = Math.max(140, o.rows.length * 38 + (legend ? 44 : 14) + 34);
      const canvas = h('div', { class: 'cz-chart-canvas', style: { height: height + 'px' }, role: 'img', 'aria-label': (o.caption || 'Graphique') + ' (vue tableau disponible)' });
      M.mount(root, head, canvas);

      M.ui.whenAttached(canvas, () => {
        if (!window.echarts) { M.mount(canvas, h('div', { class: 'cz-empty' }, 'Librairie ECharts introuvable (assets/vendor/echarts).')); return; }
        const ec = window.echarts.init(canvas, null, { renderer: 'svg' });
        const last = series.length - 1;
        const option = {
          animationDuration: 300,
          // decal.show à true : sans lui ECharts ignore les textures des séries (celles sans motif ont decal « none »)
          aria: { enabled: true, decal: { show: true } },
          textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
          grid: { left: 8, right: 72, top: legend ? 40 : 8, bottom: 26, containLabel: true },
          // data explicite : sinon la série technique « __total » apparaît dans la légende
          legend: legend ? { data: series.map(s => s.label), top: 0, left: 0, itemWidth: 20, itemHeight: 14, itemGap: 16, icon: 'roundRect', textStyle: { color: INK2, fontSize: 12 }, selectedMode: false } : undefined,
          tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,25,29,.06)' } }, appendTo: 'body',
            backgroundColor: '#fff', borderColor: GRID, borderWidth: 1, padding: [8, 10], extraCssText: 'box-shadow:0 12px 32px rgba(16,24,40,.18);border-radius:8px;',
            formatter: params => {
              const i = params[0].dataIndex, r = o.rows[i];
              const lines = series.map(s => '<div style="display:flex;align-items:center;gap:8px;color:' + INK2 + '"><span style="width:12px;height:3px;border-radius:2px;background:' + resolve(s.color) + '"></span><b style="color:' + INK + '">' + esc(fmt(r.values[s.key] || 0)) + '</b> ' + esc(s.label) + '</div>');
              const tot = series.length > 1 ? '<div style="margin-top:4px;padding-top:4px;border-top:1px solid ' + GRID + ';color:' + INK2 + '"><b style="color:' + INK + '">' + esc(fmt(totals[i])) + '</b> au total' + (o.unit ? ' (' + esc(o.unit) + ')' : '') + '</div>' : '';
              return '<div style="font-size:12px"><div style="font-weight:700;margin-bottom:4px;color:' + INK + '">' + esc(r.label + (r.sub ? ' · ' + r.sub : '')) + '</div>' + lines.join('') + tot + '</div>';
            },
          },
          // Unité à droite de l'axe, dans la marge : elle ne chevauche plus la dernière graduation
          xAxis: { type: 'value', axisLabel: { color: INK3, fontSize: 11, formatter: v => compact(v) }, splitLine: { lineStyle: { color: GRID } }, name: o.unit || '', nameLocation: 'end', nameGap: 12, nameTextStyle: { color: INK3, fontSize: 11, align: 'left', verticalAlign: 'middle' } },
          yAxis: {
            type: 'category', inverse: true, data: o.rows.map(r => r.label),
            axisTick: { show: false }, axisLine: { lineStyle: { color: AXIS } },
            axisLabel: {
              color: INK, fontSize: 12, width: 160, overflow: 'truncate', lineHeight: 15,
              formatter: (v, i) => o.rows[i] && o.rows[i].sub ? v + '\n{sub|' + o.rows[i].sub + '}' : v,
              rich: { sub: { color: INK3, fontSize: 11, lineHeight: 14 } },
            },
          },
          series: series.map((s, si) => ({
            type: 'bar', stack: 'total', name: s.label, barWidth: 18, barCategoryGap: '40%',
            data: o.rows.map(r => r.values[s.key] || 0),
            itemStyle: { color: resolve(s.color), decal: s.decal || { symbol: 'none' }, borderColor: '#fff', borderWidth: series.length > 1 ? 1 : 0, borderRadius: si === last ? [0, 4, 4, 0] : 0 },
            emphasis: { focus: 'none', itemStyle: { opacity: .9 } },
          })).concat([{
            // Série invisible qui porte le total en bout de barre
            type: 'bar', stack: 'total', name: '__total', silent: true, tooltip: { show: false },
            data: o.rows.map(() => 0), itemStyle: { color: 'transparent' },
            label: { show: true, position: 'right', color: INK2, fontSize: 12, formatter: p => o.totalLabel ? o.totalLabel(o.rows[p.dataIndex], totals[p.dataIndex]) : fmt(totals[p.dataIndex]) },
          }]),
        };
        ec.setOption(option);
        ec.on('click', p => { const r = o.rows[p.dataIndex]; if (r && r.onClick) r.onClick(); });
        const onResize = () => ec.resize();
        window.addEventListener('resize', onResize);
        M.ui.registerWidget({ el: canvas, dispose: () => { window.removeEventListener('resize', onResize); ec.dispose(); } });
      });
    }
    draw();
    return root;
  };

  /** Étapes de production (rampe ordinale jaune → orange → rose → violet, sans bleu depuis le 09/11 : clair = en amont, foncé = terminé). */
  chart.ETAPES = [
    // Chaque étape a aussi une texture (09/11, pour un collègue daltonien) : uni, hachures montantes, descendantes, verticales,
    // horizontales. Les mêmes motifs sont repris sur les pastilles de statut (app.css, .cz-status.s-N).
    { key: 'attente', label: "En attente d'affiches", color: '#f9db7c' },
    { key: 'pret', label: 'Prêt à produire', color: '#f7a35a', decal: { symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [2, 3], rotation: Math.PI / 4, color: 'rgba(0,0,0,.45)' } },
    { key: 'prod', label: 'En production', color: '#e0607e', decal: { symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [2, 3], rotation: -Math.PI / 4, color: 'rgba(255,255,255,.8)' } },
    { key: 'colise', label: 'Colisé (scanné)', color: '#9c3f8f', decal: { symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [2, 3], rotation: Math.PI / 2, color: 'rgba(255,255,255,.75)' } },
    { key: 'expedie', label: 'Expédié / livré', color: '#3b1a47', decal: { symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [2, 3], rotation: 0, color: 'rgba(255,255,255,.7)' } },
  ];
})();
