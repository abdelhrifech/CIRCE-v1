/* Dispatch du roulage (PR7 8 m², PR10 MUI) : répartition équitable entre rouleurs, alertes, picking */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const st = { atelier: '' };
  const faces = u => u.nb * u.positions.filter(p => !p.fr).length;

  function proposer(us, ops) {
    const charge = new Map(ops.map(o => [o.label, 0]));
    us.slice().sort((a, b) => C.depart(a) - C.depart(b) || faces(b) - faces(a)).forEach(u => {
      const best = ops.map(o => o.label).sort((a, b) => charge.get(a) - charge.get(b))[0];
      u.operateur = best; charge.set(best, charge.get(best) + faces(u));
    });
    M.journal(st.atelier, 'Répartition proposée sur ' + ops.length + ' rouleur(s)');
    ui.toast('Répartition proposée : ' + us.length + ' trains sur ' + ops.length + ' rouleurs.', 'good');
    M.refresh();
  }

  M.screen({
    id: 'dispatch', title: 'Dispatch du roulage', icon: '⇄', nav: 'Dispatch', roles: ['cheq'],
    needs: ['REU-03', 'CIB-13', 'CIB-14', 'CIB-11', 'SCR-07', 'SCR-22', 'PROC-03', 'ERG-05', 'ERG-06', 'ERG-08'],
    asis: ['Dispatch fait avec des outils hors Circé (réunion du 13/10)', 'Liste des affiches à collecter et TCD remis au dispatcheur depuis des extractions Excel (S50, S71)'],
    render(root, params) {
      // L'atelier (qui fixe les rouleurs) se choisit dans le menu du haut (Déroulant › Dispatch du roulage) :
      // pas de boutons d'atelier dans la page. Par défaut, le premier atelier du menu.
      const ats = M.ref.ateliers.filter(a => a.mode === 'train' && (M.state.site === 'ALL' || a.site === M.state.site));
      const at = ats.find(a => a.id === params.atelier) || ats[0];
      if (!at) { root.append(ui.pageHead({ crumb: 'Déroulant', title: 'Dispatch du roulage', screen: 'dispatch' }), ui.callout('info', 'Aucun atelier déroulant', ' sur ce site.')); return; }
      st.atelier = at.id;
      root.append(ui.pageHead({ crumb: 'Déroulant · Dispatch du roulage', title: C.site(at.site).label + ' · ' + at.label, sub: 'Répartir équitablement les trains à rouler entre les rouleurs, en tenant compte des départs camions, et donner à chacun sa liste d’affiches à collecter.', screen: 'dispatch' }));
      const base =C.unitesScope({ allWeeks: true }).filter(u => u.kind === 'TRAIN' && u.atelier === at.id && ['PRET', 'EN_PROD'].includes(u.statut));
      const F = ui.filters({ id: 'dispatch-' + at.id, rows: base, defs: [
        ui.dossierFilter(base, C.dossiersOf),
        ui.weekFilter(),
        { key: 'statut', label: 'Statut', options: ['PRET', 'EN_PROD'].map(s => ({ value: s, label: M.STATUTS[s].label })), get: u => u.statut },
        { key: 'dest', label: 'Destinataire', more: true, options: M.uniq(base.map(u => u.dest)).map(id => ({ value: id, label: C.dest(id).label })).sort((a, b) => a.label.localeCompare(b.label, 'fr')), get: u => u.dest },
      ], extra: [ui.btn('Proposer une répartition', () => proposer(us, ops), { primary: true }), ui.btn('Tout désaffecter', () => { us.forEach(u => { u.operateur = null; }); M.refresh(); })] });
      const us = F.apply(base);
      const ops = M.data.operateurs.filter(o => o.site === at.site);
      const charge = ops.map(o => { const mine = us.filter(u => u.operateur === o.label); return { o, trains: M.sum(mine, u => u.nb), faces: M.sum(mine, faces), dests: M.uniq(mine.map(u => C.dest(u.dest).label)) }; });
      const moy = charge.length ? M.sum(charge, c => c.faces) / charge.length : 0;
      const maxF = Math.max(1, ...charge.map(c => c.faces));
      const nonAff = us.filter(u => !u.operateur);
      const urgents = nonAff.filter(u => (C.depart(u) - M.NOW) < 36 * 3600e3);
      root.append(
        F.bar,
        ui.callout('cible', 'Moteur de répartition à brancher', ' Le programme Python de dispatch déjà utilisé sera intégré ici (à transmettre). La maquette applique une règle simple : départ le plus proche d’abord, puis le rouleur le moins chargé.'),
        // h() ignore null, Element.append non : le bandeau conditionnel passe par un conteneur.
        h('div', null, urgents.length ? ui.callout('critical', urgents.length + ' train(s) non affecté(s) partent dans moins de 36 h', ' ' + M.uniq(urgents.map(u => C.dest(u.dest).boucle)).join(', ') + '.') : null),
        h('div', null, charge.filter(c => moy && c.faces > moy * 1.15).map(c => ui.callout('warning', c.o.label + ' est surchargé', ' ' + c.faces + ' faces pour une moyenne de ' + Math.round(moy) + ' (+' + Math.round((c.faces / moy - 1) * 100) + ' %).'))),
        h('div', { class: 'grid side' },
          ui.card({ title: 'Charge par rouleur', sub: Math.round(moy) + ' faces en moyenne', flush: true, body: h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
            h('thead', null, h('tr', null, ['Rouleur', 'Poste', 'Trains', 'Faces', 'Charge', 'Destinataires', ''].map(x => h('th', null, x)))),
            h('tbody', null, charge.map(c => h('tr', null, h('td', null, h('b', null, c.o.label)), h('td', null, c.o.poste), h('td', { class: 'num' }, c.trains), h('td', { class: 'num' }, c.faces),
              h('td', { style: { minWidth: '160px' } }, ui.meter(c.faces / maxF, '')), h('td', { class: 'small' }, c.dests.join(', ') || '—'),
              h('td', null, ui.btn('Liste de picking', () => picking(c.o, us.filter(u => u.operateur === c.o.label)), { small: true }))))))) }),
          ui.card({ title: 'À répartir', body: h('div', { class: 'kpis' }, ui.stat({ label: 'Trains à rouler', value: M.sum(us, u => u.nb) }), ui.stat({ label: 'Faces', value: M.sum(us, faces) }), ui.stat({ label: 'Non affectés', value: M.sum(nonAff, u => u.nb) })) })),
        ui.card({ title: 'Trains et affectation', style: { marginTop: '16px' }, flush: true, body: ui.table({
          id: 'dispatch-trains', rows: us, exportName: 'dispatch.csv', tone: u => !u.operateur && (C.depart(u) - M.NOW) < 36 * 3600e3 ? 'critical' : !u.operateur ? 'warning' : null,
          columns: [
            { key: 'id', label: 'Train' }, { key: 'dest', label: 'Destinataire', value: u => C.dest(u.dest).label },
            { key: 'depart', label: 'Départ', value: u => C.depart(u).getTime(), render: u => M.fmt.day(C.depart(u)) + ' ' + M.fmt.hm(C.depart(u)) },
            { key: 'positions', label: 'Positions', sortable: false, render: ui.positions }, { key: 'nb', label: 'Trains', align: 'num' }, { key: 'faces', label: 'Faces', align: 'num', value: faces },
            { key: 'statut', label: 'Statut', render: u => ui.pill(u.statut), value: u => u.statut },
            { key: 'operateur', label: 'Rouleur', render: u => ui.select({ value: u.operateur || '', options: [{ value: '', label: 'Non affecté' }].concat(ops.map(o => ({ value: o.label, label: o.label }))), onChange: v => { u.operateur = v || null; M.journal(u.id, 'Affecté à ' + (v || 'personne')); M.refresh(); } }), value: u => u.operateur || '' },
          ],
        }) }));
    },
  });

  function picking(op, us) {
    const map = new Map();
    us.forEach(u => u.positions.filter(p => !p.fr).forEach(p => map.set(p.themeId, (map.get(p.themeId) || 0) + u.nb)));
    const rows = Array.from(map.entries()).map(([id, q]) => { const t = C.theme(id), d = C.dossier(t.dossierId); const afs = M.data.affiches.filter(a => a.alloc.some(x => x.themeId === id)); return { empl: afs.map(a => a.allee + '-' + a.rayon).join(' ') || '—', annonceur: d.annonceur, theme: t.libelle, q, affiche: afs.map(a => a.id).join(' ') }; }).sort((a, b) => a.empl.localeCompare(b.empl));
    ui.modal({ title: 'Liste des affiches à collecter : ' + op.label, wide: true, body: [
      ui.annot('Triée par emplacement pour un seul passage dans les allées. Remplace le TCD remis au dispatcheur.', ['CIB-14', 'SCR-07']),
      h('div', { class: 'table-wrap' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Emplacement', 'N° affiche', 'Annonceur', 'Thème', 'Quantité'].map(x => h('th', null, x)))), h('tbody', null, rows.map(r => h('tr', null, h('td', null, r.empl), h('td', null, r.affiche), h('td', null, r.annonceur), h('td', null, r.theme), h('td', { class: 'num' }, r.q)))))),
    ], actions: [{ label: 'Fermer' }, { label: 'Imprimer', primary: true, onClick: () => ui.toast('Liste de picking imprimée (simulation).') }] });
  }
})();
