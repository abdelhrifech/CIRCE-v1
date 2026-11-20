/* Traçabilité : chaque besoin du référentiel → écrans de la maquette */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui;

  /** Montré : visible dans au moins un écran ; En partie : visible, avec un reste à faire (M.besoins.partiel) ; Hors maquette :
      raison donnée ; Non couvert : à faire. */
  const ETATS = ['Montré', 'En partie', 'Hors maquette', 'Non couvert'];
  function couverture() {
    return M.besoins.list.map(b => {
      const ecrans = M.screenOrder.filter(id => (M.screens[id].needs || []).includes(b.id));
      const hors = M.besoins.hors[b.id], reste = M.besoins.partiel[b.id];
      const couv = ecrans.length ? (reste ? 'En partie' : 'Montré') : hors ? 'Hors maquette' : 'Non couvert';
      return Object.assign({}, b, { ecrans, couv, raison: ecrans.length ? (reste || '') : (hors || '') });
    });
  }

  M.screen({
    id: 'besoins', title: 'Traçabilité des besoins', icon: '◈', nav: 'Traçabilité des besoins',
    render(root) {
      const all = couverture();
      // Filtres : Catégorie, Couverture, Écran ; ils se cumulent
      const F = ui.filters({ id: 'besoins', rows: all, defs: [
        { key: 'cat', label: 'Catégorie', options: Object.values(M.besoins.cats).map(c => ({ value: c, label: c })), get: r => r.cat },
        { key: 'couv', label: 'Couverture', options: ETATS.map(v => ({ value: v, label: v })), get: r => r.couv },
        { key: 'ecran', label: 'Écran', options: M.screenOrder.filter(id => (M.screens[id].needs || []).length).map(id => ({ value: id, label: M.screens[id].nav || M.screens[id].title })), get: r => r.ecrans },
      ] });
      const rows = F.apply(all);
      const n = k => all.filter(r => r.couv === k).length;
      const filtreCouv = k => { F.set('couv', [k]); M.refresh(); };
      root.append(
        ui.pageHead({ crumb: 'Aide à la lecture', title: 'Traçabilité des besoins', sub: 'Pour chaque besoin du référentiel : les écrans de la maquette qui le montrent, en entier ou en partie (avec le reste à faire), ou la raison pour laquelle il est hors maquette. L’avancement ligne à ligne de la Synthèse des besoins est dans sa copie remplie (docs/analyse-circe).' }),
        F.bar,
        h('div', { class: 'kpis', style: { marginBottom: '14px' } },
          ui.stat({ label: 'Besoins du référentiel', value: all.length }),
          ui.stat({ label: 'Montrés dans la maquette', value: n('Montré'), sub: Math.round(n('Montré') / all.length * 100) + ' %', onClick: () => filtreCouv('Montré') }),
          ui.stat({ label: 'Montrés en partie', value: n('En partie'), sub: 'reste à faire indiqué', onClick: () => filtreCouv('En partie') }),
          ui.stat({ label: 'Hors maquette (raison donnée)', value: n('Hors maquette'), onClick: () => filtreCouv('Hors maquette') }),
          ui.stat({ label: 'Non couverts', value: n('Non couvert'), onClick: () => filtreCouv('Non couvert') })),
        ui.card({ flush: true, body: ui.table({ id: 'besoins', rows, exportName: 'tracabilite-besoins-maquette.csv', tall: true, tone: r => r.couv === 'Non couvert' ? 'critical' : r.couv === 'Hors maquette' ? 'warning' : r.couv === 'En partie' ? 'info' : null,
          columns: [
            { key: 'id', label: 'ID', render: r => h('span', { class: 'need-chip', style: { display: 'inline-flex' } }, r.id) }, { key: 'cat', label: 'Catégorie' }, { key: 'label', label: 'Besoin', wrap: true }, { key: 'src', label: 'Source' },
            // Un besoin hors maquette n'a pas d'écran : sa raison s'affiche à la place (une colonne de moins) ; un besoin montré en
            // partie garde ses écrans, suivis du reste à faire.
            { key: 'ecrans', label: 'Écrans ou raison', wrap: true, maxWidth: 320, value: r => r.ecrans.length ? r.ecrans.map(id => M.screens[id].title).join(', ') + (r.raison ? ' · ' + r.raison : '') : (r.raison || ''),
              render: r => r.ecrans.length ? h('span', null, r.ecrans.map((id, i) => [i ? ', ' : '', h('a', { href: M.link(id) }, M.screens[id].nav || M.screens[id].title)]), r.raison ? h('div', { class: 'small muted' }, r.raison) : null) : h('span', { class: 'muted' }, r.raison || '—') },
            { key: 'couv', label: 'Couverture', render: r => r.couv === 'Montré' ? ui.sev('good', 'Montré') : r.couv === 'En partie' ? ui.sev('info', 'En partie') : r.couv === 'Hors maquette' ? ui.sev('warning', 'Hors maquette') : ui.sev('critical', 'Non couvert') },
            { key: 'raison', label: 'Raison ou reste à faire', wrap: true, hidden: true }],
        }) }));
    },
  });
})();
