/* Suivi de prod : le dashboard de Pilotage (REU-02, SP-01), et, en tête de chaque onglet d'atelier (?pour=deroulant, fixe,
   pliage, bus ; décision du 16/10), le tableau de suivi de prod de ces ateliers. Le tableau du reste à faire de tous les
   ateliers est passé dans Pilotage › État des réservations vivant (19/10). */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  let F = null; // filtres de la page (ui.filters), recréés à chaque affichage

  /** Lignes du tableau de suivi : une par dossier × thème. */
  function rowsFor(themes) {
    const D = M.data;
    return themes.map(t => {
      const d = C.dossier(t.dossierId);
      const us = D.unites.filter(u => (u.kind === 'TRAIN' ? u.positions.some(p => p.themeId === t.id) : u.themeId === t.id));
      const tot = M.sum(us, u => u.nb), fait = M.sum(us.filter(u => ['colise', 'expedie'].includes(M.ETAPE[u.statut])), u => u.nb);
      const ls = D.lignes.filter(l => l.themeId === t.id);
      const recu = C.recu(t.id);
      return {
        id: t.id, t, d, site: C.site(d.site).label, atelier: C.atelier(d.atelier).label, dossier: d.id, annonceur: d.annonceur, theme: t.libelle, format: d.format,
        semaines: d.semaines.map(s => 'S' + s).join('+'), sansEnt: t.qte, avecEnt: t.qteEnt, recu, reste: C.reste(t), resteP: t.qteEnt ? C.reste(t) / t.qteEnt : 0,
        ip: d.ipSaisies, livraison: t.livraisonPrevue || null, d8: t.d8, unites: tot, fait, raf: tot - fait,
        dests: M.uniq(ls.map(l => C.dest(l.dest).label)).join(', '), expedie: M.sum(us.filter(u => ['EXPEDIE', 'LIVRE'].includes(u.statut)), u => u.nb),
        preuve: M.sum(us.filter(u => u.statut === 'LIVRE'), u => u.nb), etat: C.etatTheme(t), statutPP: d.statutPP,
        bloque: M.sum(us.filter(u => u.statut === 'EN_ATTENTE'), u => u.nb),
      };
    });
  }
  const etatPill = e => ({
    COMPLET: ui.sev('good', 'Reçu'), PARTIEL: ui.sev('serious', 'Partiel'), MANQUANT: ui.sev('critical', 'Non reçu'), SURPLUS: ui.sev('warning', 'Surplus > 10 %'), NON_ATTENDU: h('span', { class: 'muted' }, '—'), SANS_ATTENDU: ui.sev('warning', 'Sans attendu'),
  }[e]);
  /** Libellé de l'état de réception, pour l'export Excel. */
  const ETAT_LIB = { COMPLET: 'Reçu', PARTIEL: 'Partiel', MANQUANT: 'Non reçu', SURPLUS: 'Surplus > 10 %', NON_ATTENDU: '', SANS_ATTENDU: 'Sans attendu' };
  const toneOf = r => r.etat === 'MANQUANT' && r.d.semaine <= 43 ? 'critical' : r.etat === 'MANQUANT' || r.etat === 'PARTIEL' ? 'serious' : r.etat === 'SURPLUS' ? 'warning' : r.raf === 0 && r.unites ? 'good' : null;

  /** Filtres de la page : N° de dossier, Départ, Atelier, Format, Annonceur, et Destination par « + Filtre ». Ils se cumulent. */
  function filterDefs() {
    const ats = M.ref.ateliers.filter(a => M.state.site === 'ALL' || a.site === M.state.site);
    const dos = t => C.dossier(t.dossierId);
    const anns = M.uniq(C.themesScope({ allWeeks: true }).map(t => dos(t).annonceur)).sort((a, b) => a.localeCompare(b, 'fr'));
    const dests = M.ref.destinataires.filter(d => M.state.site === 'ALL' || d.site === M.state.site);
    return [
      ui.dossierFilter(C.themesScope({ allWeeks: true }), t => t.dossierId),
      ui.weekFilter(null, t => dos(t).semaine),
      { key: 'atelier', label: 'Atelier', options: ats.map(a => ({ value: a.id, label: ui.withSite(a.label, a.site) })), get: t => dos(t).atelier },
      { key: 'format', label: 'Format', options: M.uniq(ats.flatMap(a => a.formats)).map(f => ({ value: f, label: f })), get: t => dos(t).format },
      { key: 'annonceur', label: 'Annonceur', options: anns.map(a => ({ value: a, label: a })), get: t => dos(t).annonceur },
      { key: 'dest', label: 'Destination', more: true, options: dests.map(d => ({ value: d.id, label: d.label + ' · ' + d.boucle })), get: t => M.uniq(M.data.lignes.filter(l => l.themeId === t.id).map(l => l.dest)) },
    ];
  }
  /** Les mêmes filtres, appliqués aux unités (trains, UM, lots). */
  const U_GET = {
    dossier: u => C.dossiersOf(u),
    semaine: u => u.semaine,
    atelier: u => u.atelier,
    format: u => M.uniq(C.themesOf(u).map(t => C.dossier(t.dossierId).format)),
    annonceur: u => M.uniq(C.themesOf(u).map(t => C.dossier(t.dossierId).annonceur)),
    dest: u => u.dest,
  };
  function filtered() {
    return { themes: F.apply(C.themesScope({ allWeeks: true })), unites: F.apply(C.unitesScope({ allWeeks: true }), U_GET) };
  }
  const semsLabel = () => M.fmt.sems(F.weeks());

  function dashboard(root) {
    const { themes, unites } = filtered();
    const k = C.kpis(themes, unites);
    const ETAPES = M.chart.ETAPES;
    // Avancement par atelier
    const byAt = M.groupBy(unites, u => u.atelier);
    const atOrder = id => M.ref.ateliers.findIndex(a => a.id === id);
    const atRows = Object.entries(byAt).map(([id, us]) => ({ id, label: C.atelier(id).label, sub: C.site(C.atelier(id).site).label, values: C.etapesCount(us), onClick: () => { F.set('atelier', [id]); M.refresh(); } }))
      .sort((a, b) => atOrder(a.id) - atOrder(b.id));
    // Avancement par départ camion (un départ = une boucle, un site, une date)
    const byDep = M.groupBy(unites, u => C.dest(u.dest).boucle + '|' + C.depart(u).getTime() + '|' + u.site);
    const depRows = Object.entries(byDep).map(([key, us]) => { const [boucle, ts, site] = key.split('|'); const dt = new Date(Number(ts)); return { label: boucle + (M.state.site === 'ALL' ? ' · ' + C.site(site).label.replace(' (Bus)', '') : ''), sub: M.fmt.day(dt) + ' ' + M.fmt.hm(dt) + (dt < M.NOW ? ' · parti' : ''), ts: Number(ts), values: C.etapesCount(us) }; }).sort((a, b) => a.ts - b.ts);
    // Reste à recevoir par annonceur
    const byAnn = M.groupBy(themes.filter(t => C.reste(t) > 0 && C.dossier(t.dossierId).ipSaisies), t => C.dossier(t.dossierId).annonceur);
    const annRows = Object.entries(byAnn).map(([a, ts]) => ({ label: a, values: { reste: M.sum(ts, C.reste) }, attendu: M.sum(ts, t => t.qteEnt) })).sort((a, b) => b.values.reste - a.values.reste).slice(0, 8);
    // Visuels qui bloquent
    const blocking = rowsFor(themes).filter(r => r.bloque > 0).sort((a, b) => b.bloque - a.bloque);
    const ws = F.weeks();
    const alerts = C.alertesOuvertes().filter(a => !a.semaine || !ws.length || ws.includes(a.semaine)).sort((a, b) => C.sevRank[a.sev] - C.sevRank[b.sev]).slice(0, 8);

    root.append(
      // Une tuile principale + 4 indicateurs (DESIGN.md §4.4 : 5 au plus). Attendu, reçu et A sont en sous-titre.
      h('div', { class: 'grid cz-kpi-hero', style: { marginBottom: '16px' } },
        h('div', { class: 'card stat cz-hero-card' }, h('div', { class: 'card-body' },
          h('div', { class: 'subheader stat-label' }, 'Avancement · ' + (ws.length === 1 ? 'départ ' : 'départs ') + semsLabel()),
          h('div', { class: 'hero' }, h('div', { class: 'hero-value' }, M.fmt.pct(k.avancement)), ui.chips(['SP-01'])),
          ui.meter(k.avancement, ''),
          h('div', { class: 'stat-sub', style: { marginTop: '6px' } }, 'C / A : ' + M.fmt.n(k.termine) + ' unités colisées ou expédiées sur ' + M.fmt.n(k.total) + ' à produire'))),
        ui.stat({ label: 'Reste à recevoir', value: M.fmt.n(k.reste), sub: M.fmt.n(k.recu) + ' reçues sur ' + M.fmt.n(k.attendu) + ' attendues, entretien compris', onClick: () => M.go('reservations', { ou: 'AFFICHES,PARTIEL' }) }),
        ui.stat({ label: 'OK pour production (B)', value: M.fmt.n(k.ok), sub: 'sur ' + M.fmt.n(k.total) + ' unités à produire (A) : trains, UM, lots' }),
        ui.stat({ label: 'En attente (A − B)', value: M.fmt.n(k.e.attente), sub: 'unités bloquées par un visuel manquant', onClick: () => M.go('reservations', { ou: 'AFFICHES,PARTIEL' }) }),
        ui.stat({ label: 'Terminées (C)', value: M.fmt.n(k.termine), sub: 'scannées au colisage' })),
      h('div', { class: 'grid cols-2' },
        ui.card({ title: 'Avancement par atelier', sub: 'Cliquer une ligne pour filtrer', body: M.chart.hbars({ series: ETAPES, rows: atRows, unit: 'unités', rowHeader: 'Atelier', caption: "Nombre d'unités (trains, UM, lots) par étape. Clair = en amont, foncé = terminé." }) }),
        ui.card({ title: 'Avancement par départ camion', sub: 'Geodis : milk run et messagerie', body: M.chart.hbars({ series: ETAPES, rows: depRows, unit: 'unités', rowHeader: 'Départ', caption: 'Un départ dont la barre est encore claire est à risque.' }) })),
      h('div', { class: 'grid cols-2 mt' },
        ui.card({ title: 'Reste à recevoir par annonceur', sub: '8 premiers', body: M.chart.hbars({ series: [{ key: 'reste', label: 'Reste à recevoir', color: 'var(--series-1)' }], rows: annRows, unit: 'affiches', rowHeader: 'Annonceur', totalLabel: (r, v) => M.fmt.n(v) + ' / ' + M.fmt.n(r.attendu), caption: 'Affiches restant à recevoir (sur l’attendu, entretien compris).' }) }),
        ui.card({ title: 'Alertes du périmètre', actions: h('a', { href: M.link('alertes'), class: 'btn btn-sm btn-ghost-secondary' }, 'Toutes les alertes'), flush: true, body: alerts.length ? h('div', { class: 'cz-scroll', style: { maxHeight: '420px' } }, alerts.map(a => h('div', { class: 'cz-alert-row' }, h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 600 } }, a.titre), h('div', { class: 'small muted' }, a.message)), a.link ? ui.btn('Ouvrir', () => M.go(a.link.screen, a.link.params), { small: true }) : null))) : h('div', { class: 'dt-empty' }, 'Aucune alerte.') })),
      ui.card({ title: 'Visuels qui bloquent la production', sub: 'liste des visuels en attente (A − B)', style: { marginTop: '16px' }, flush: true, body: ui.table({
        id: 'suivi-bloquants', rows: blocking, maxHeight: '340px', exportName: 'visuels-bloquants.csv', onRowClick: r => ui.dossierDrawer(r.d.id),
        columns: [
          ui.colVisuel(), { key: 'dossier', label: 'Dossier' }, { key: 'atelier', label: 'Atelier', value: r => ui.withSite(r.atelier, r.d.site) },
          { key: 'reste', label: 'Reste à recevoir', align: 'num' }, { key: 'bloque', label: 'Unités bloquées', align: 'num' },
          { key: 'livraison', label: 'Livraison prévue', render: r => r.livraison ? M.fmt.day(r.livraison) : (r.d.print ? 'Print Cityz : à demander' : '—'), value: r => r.livraison ? r.livraison.getTime() : null },
          { key: 'etat', label: 'État', render: r => etatPill(r.etat) }],
      }) }));
  }

  /* ---------- Suivi de prod d'un type d'atelier, en tête des onglets Déroulant, 2 m² fixe, Pliage et Bus (16/10) ---------- */
  /** Unité de production de chaque type d'atelier, au pluriel. */
  const UNITES = { deroulant: 'trains', fixe: 'UM', pliage: 'lots', bus: 'lots' };
  /** Avancement d'un visuel d'après ses unités : [libellé, gravité de la pastille]. */
  const AVANCE = {
    attente: ['En attente d’affiches', 'critical'],
    cours: ['Prêt ou en production', 'info'],
    termine: ['Terminé', 'good'],
    sans: ['Pas encore d’unité', 'info'],
  };
  const avanceOf = r => (!r.unites ? 'sans' : r.bloque > 0 ? 'attente' : r.raf > 0 ? 'cours' : 'termine');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function vueAtelier(root, params, pour) {
    const lib = M.POUR_LABEL[pour], uN = UNITES[pour];
    const ats = M.ateliersPour(pour);
    if (!ats.length) {
      root.append(ui.pageHead({ crumb: lib + ' · Suivi de prod', title: 'Suivi de prod · ' + lib, screen: 'suivi' }),
        ui.callout('info', 'Pas d’atelier « ' + lib + ' » sur ce site.', ' Choisissez « Tous les sites » ou un autre site en haut de page.'));
      return;
    }
    const ids = new Set(ats.map(a => a.id));
    const rows = rowsFor(C.themesScope({ allWeeks: true }).filter(t => ids.has(C.dossier(t.dossierId).atelier))).map(r => Object.assign(r, { avance: avanceOf(r) }));
    const opts = (vals, lab) => M.uniq(vals.filter(v => v !== null && v !== undefined && v !== '')).map(v => ({ value: v, label: lab ? lab(v) : v })).sort((a, b) => String(a.label).localeCompare(String(b.label), 'fr'));
    const destsOf = r => M.uniq(M.data.lignes.filter(l => l.themeId === r.id).map(l => l.dest));
    // Filtres : N° de dossier (plusieurs, ou une liste collée), Départ, Atelier, Annonceur (plusieurs), Avancement ;
    // Format et Destination par « + Filtre ». Ils se cumulent.
    const FA = ui.filters({ id: 'suivi-' + pour, rows, defs: [
      ui.dossierFilter(rows, r => r.dossier),
      ui.weekFilter(null, r => r.d.semaine),
      { key: 'atelier', label: 'Atelier', options: ats.map(a => ({ value: a.id, label: ui.withSite(a.label, a.site) })), get: r => r.d.atelier },
      { key: 'annonceur', label: 'Annonceur', options: opts(rows.map(r => r.annonceur)), get: r => r.annonceur },
      { key: 'avance', label: 'Avancement', options: Object.entries(AVANCE).map(([v, [l]]) => ({ value: v, label: l })), get: r => r.avance },
      { key: 'format', label: 'Format', more: true, options: opts(rows.map(r => r.format)), get: r => r.format },
      { key: 'dest', label: pour === 'bus' ? 'Centre bus' : 'Destination', more: true, options: opts(rows.flatMap(destsOf), id => C.dest(id).label), get: destsOf },
    ] });
    // Indicateurs (SP-01) : unités des ateliers de l'onglet, avec les mêmes filtres, sauf l'avancement (propre aux visuels)
    const unites = FA.apply(C.unitesScope({ allWeeks: true }).filter(u => ids.has(u.atelier)), {
      dossier: u => C.dossiersOf(u), semaine: u => u.semaine, atelier: u => u.atelier, avance: null, dest: u => u.dest,
      annonceur: u => M.uniq(C.themesOf(u).map(t => C.dossier(t.dossierId).annonceur)), format: u => M.uniq(C.themesOf(u).map(t => C.dossier(t.dossierId).format)),
    });
    const e = C.etapesCount(unites), total = M.sum(Object.values(e)), ok = e.pret + e.prod + e.colise + e.expedie, finis = e.colise + e.expedie;
    const voir = vals => { FA.set('avance', vals); M.refresh(); };
    const sems = FA.weeks().length ? FA.weeks().slice().sort((a, b) => a - b).map(s => 'S' + s).join('-') : 'toutes-semaines';
    const tbl = ui.table({
      id: 'suivi-' + pour, rows: FA.apply(rows), query: params.q, selectable: true, exportName: 'suivi-prod-' + pour + '-' + sems,
      tone: toneOf, onRowClick: r => ui.dossierDrawer(r.d.id), empty: 'Aucun visuel avec ces filtres.',
      bulkActions: sel => [ui.btn('Exporter la sélection', () => M.downloadXLSX('selection-suivi-' + pour, sel, [{ label: 'Dossier', value: r => r.dossier }, { label: 'Annonceur', value: r => r.annonceur }, { label: 'Thème', value: r => r.theme }, { label: 'Reçu', value: r => r.recu }, { label: cap(uN) + ' à produire', value: r => r.unites }, { label: 'Faits', value: r => r.fait }, { label: 'Reste à faire', value: r => r.raf }]), { small: true })],
      // 8 colonnes par défaut (DESIGN.md §4.5) ; les autres dans « Colonnes », où l'on règle aussi l'ordre
      columns: [
        { key: 'dossier', label: 'Dossier', nowrap: true },
        ui.colVisuel(),
        { key: 'semaines', label: 'Départ' },
        { key: 'avecEnt', label: 'Attendu', align: 'num', title: 'Attendu avec entretien, calculé à l’afficheur' },
        { key: 'recu', label: 'Reçu', align: 'num' },
        { key: 'unites', label: cap(uN) + ' à produire', align: 'num', title: cap(uN) + ' contenant ce visuel' },
        { key: 'fait', label: 'Faits', align: 'num', title: cap(uN) + ' colisés ou expédiés' },
        { key: 'raf', label: 'Reste à faire', align: 'num', title: cap(uN) + ' pas encore colisés' },
        { key: 'avance', label: 'Avancement', hidden: true, render: r => ui.sev(AVANCE[r.avance][1], AVANCE[r.avance][0]), value: r => AVANCE[r.avance][0] },
        { key: 'atelier', label: 'Atelier', hidden: true, value: r => ui.withSite(r.atelier, r.d.site) },
        { key: 'reste', label: 'Reste à recevoir', align: 'num', hidden: true },
        { key: 'etat', label: 'Réception', hidden: true, render: r => etatPill(r.etat), csv: r => ETAT_LIB[r.etat] },
        { key: 'bloque', label: cap(uN) + ' en attente', align: 'num', hidden: true },
        { key: 'annonceur', label: 'Annonceur', hidden: true }, { key: 'theme', label: 'Thème', hidden: true }, { key: 'format', label: 'Format', hidden: true },
        { key: 'sansEnt', label: 'Attendu sans entretien', align: 'num', hidden: true },
      ].concat(pour === 'deroulant' ? [
        { key: 'dh', label: 'Demies haut', align: 'num', hidden: true, value: r => r.d8 ? r.d8.haut : null, title: '8 m² (PROC-06)' },
        { key: 'db', label: 'Demies bas', align: 'num', hidden: true, value: r => r.d8 ? r.d8.bas : null },
        { key: 'df', label: '8 m² finales', align: 'num', hidden: true, value: r => r.d8 ? r.d8.final : null }] : [], [
        { key: 'dests', label: pour === 'bus' ? 'Centres bus' : 'Destinations', hidden: true },
        { key: 'expedie', label: pour === 'bus' ? 'Remis au dépôt' : 'Expédiés', align: 'num', hidden: true },
        { key: 'preuve', label: 'Preuve de livraison', align: 'num', hidden: true },
        { key: 'ip', label: 'IP saisies', hidden: true, value: r => (r.ip ? 'Oui' : 'Non') },
        { key: 'statutPP', label: 'Statut pré-production', hidden: true, render: r => ui.pill(r.statutPP), value: r => M.STATUTS[r.statutPP].label },
      ]),
      footer: (c, rs) => ['sansEnt', 'avecEnt', 'recu', 'reste', 'unites', 'fait', 'raf', 'bloque', 'expedie', 'preuve'].includes(c.key) ? M.fmt.n(M.sum(rs, r => r[c.key])) : c.key === 'dossier' ? 'Total' : '',
    });
    root.append(
      ui.pageHead({ crumb: lib + ' · Suivi de prod', title: 'Suivi de prod · ' + lib, screen: 'suivi',
        sub: 'Une ligne par visuel des départs ' + M.fmt.sems(FA.weeks()) + ' : attendu, reçu, ' + uN + ' à produire, faits et reste à faire. Plusieurs dossiers ou annonceurs à la fois ; l’ordre des colonnes se règle dans « Colonnes » et reste gardé.' }),
      FA.bar,
      h('div', { class: 'kpis', style: { marginBottom: '12px' } },
        ui.stat({ label: cap(uN) + ' à produire (A)', value: M.fmt.n(total), sub: 'départs ' + M.fmt.sems(FA.weeks()), onClick: () => voir([]), title: 'Tous les visuels' }),
        ui.stat({ label: 'OK pour production (B)', value: M.fmt.n(ok), sub: 'tous visuels reçus ou fractionnés', onClick: () => voir(['cours', 'termine']), title: 'Visuels sans unité en attente' }),
        ui.stat({ label: 'En attente (A − B)', value: M.fmt.n(e.attente), sub: 'un visuel manque', onClick: () => voir(['attente']), title: 'Visuels qui bloquent la production' }),
        ui.stat({ label: 'Terminés (C)', value: M.fmt.n(finis), sub: 'colisés ou expédiés', onClick: () => voir(['termine']), title: 'Visuels terminés' }),
        ui.stat({ label: 'Avancement', value: M.fmt.pct(total ? finis / total : 0), sub: 'C / A' })),
      ui.annot('Le tableau de suivi de prod de l’onglet : choix multiple de dossiers (saisis ou collés en liste) et d’annonceurs, filtres cumulés ; un clic sur un indicateur filtre les visuels. Les colonnes se masquent et se réordonnent (« Colonnes », flèches) ; la vue est gardée sur ce poste et l’export Excel la suit. Pilotage › Suivi de prod garde la vue de tous les ateliers.', ['SP-01', 'SP-02', 'REU-01', 'FIX-03', 'FIX-04', 'ERG-02', 'ERG-08']),
      ui.card({ flush: true, body: tbl }));
  }

  /** Fiche dossier (tiroir), réutilisée par plusieurs écrans. */
  ui.dossierDrawer = function (dossierId) {
    const D = M.data, d = C.dossier(dossierId);
    if (!d) return;
    const ths = d.themes.map(C.theme);
    const ls = D.lignes.filter(l => l.dossierId === d.id);
    const us = D.unites.filter(u => C.themesOf(u).some(t => t && t.dossierId === d.id));
    const afs = D.affiches.filter(a => a.alloc.some(x => C.theme(x.themeId) && C.theme(x.themeId).dossierId === d.id));
    const journal = D.journal.filter(j => j.objet === d.id);
    const mini = (cols, rows) => h('div', { class: 'table-wrap', style: { maxHeight: '220px', border: '1px solid var(--border)', borderRadius: '6px' } }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, cols.map(c => h('th', { class: c.num ? 'num' : '' }, c.label)))), h('tbody', null, rows.map(r => h('tr', null, cols.map(c => h('td', { class: c.num ? 'num' : '' }, c.v(r))))))));
    ui.drawer({
      title: d.annonceur + ' · dossier ' + d.id,
      body: [
        h('div', { class: 'row', style: { marginBottom: '8px' } }, ui.pill(C.statutDossier(d)), ui.tag(C.atelier(d.atelier).label + ' · ' + C.site(d.site).label), ui.tag(d.format), ui.tag('Départ ' + d.semaines.map(s => 'S' + s).join(' + ')), d.print ? ui.tag('Print Cityz') : null, d.controlee ? ui.tag('Campagne contrôlée') : null, d.apresLiberation ? ui.tag('Arrivé après libération', 'hyp') : null),
        h('div', { class: 'small muted' }, 'DA ' + d.da + ' · ' + d.pole + ' · entretien ' + d.entretienPct + ' % · IP ' + (d.ipSaisies ? 'saisies' : 'non saisies') + (d.prepaDate ? ' · préparation reçue le ' + M.fmt.dt(d.prepaDate) : '')),
        h('h3', { style: { margin: '14px 0 6px', fontSize: '14px' } }, 'Visuels'),
        mini([{ label: 'Pos.', v: t => t.position }, { label: 'Thème', v: t => h('span', null, ui.btnVisuel(t), t.libelle + (t.exclu ? ' (exclu)' : '')) }, { label: 'Attendu', num: 1, v: t => M.fmt.n(t.qteEnt) }, { label: 'Reçu', num: 1, v: t => M.fmt.n(C.recu(t.id)) }, { label: 'Reste', num: 1, v: t => M.fmt.n(C.reste(t)) }, { label: 'État', v: t => etatPill(C.etatTheme(t)) }], ths),
        ls.length ? [h('h3', { style: { margin: '14px 0 6px', fontSize: '14px' } }, 'Préparation par destinataire et afficheur'),
          mini([{ label: 'Destinataire', v: l => C.dest(l.dest).label }, { label: 'Afficheur', v: l => C.afficheur(l.afficheur).label }, { label: 'Thème', v: l => C.theme(l.themeId).libelle }, { label: 'Qté', num: 1, v: l => l.qte }, { label: 'Entretien', num: 1, v: l => l.entretien }], ls)] : h('p', { class: 'muted small' }, 'Préparation pas encore reçue de Broadcast.'),
        us.length ? [h('h3', { style: { margin: '14px 0 6px', fontSize: '14px' } }, 'Unités de production'),
          mini([{ label: 'Unité', v: u => u.id }, { label: 'Destinataire', v: u => C.dest(u.dest).label }, { label: 'Nb', num: 1, v: u => u.nb }, { label: 'Statut', v: u => ui.pill(u.statut) }], us)] : null,
        afs.length ? [h('h3', { style: { margin: '14px 0 6px', fontSize: '14px' } }, 'Affiches reçues'),
          mini([{ label: 'N° affiche', v: a => a.id }, { label: 'Réception', v: a => a.receptionId }, { label: 'Reçu', num: 1, v: a => a.qteRecue }, { label: 'Emplacement', v: a => a.allee + '-' + a.rayon }, { label: 'Le', v: a => M.fmt.dt(a.date) }], afs)] : null,
        h('h3', { style: { margin: '14px 0 6px', fontSize: '14px' } }, 'Historique'),
        h('ul', { class: 'cz-timeline' }, d.historique.concat(journal).sort((a, b) => a.date - b.date).map(x => h('li', null, h('span', { class: 'when' }, M.fmt.dt(x.date)), h('span', null, x.action + ' · ' + x.user)))),
        h('div', { class: 'row mt' }, ui.btn(C.atelier(d.atelier).mode === 'train' ? 'Voir dans la Liste des instructions' : 'Voir dans À traiter', () => { const l = C.lienDossier(d); M.go(l.screen, l.params); }, { small: true }), ui.btn('Voir les affiches', () => M.go('reception', { tab: 'affiches', q: d.id }), { small: true })),
      ],
    });
  };

  M.screen({
    id: 'suivi', title: 'Suivi de prod', icon: '▤', nav: 'Suivi de prod', roles: ['coord', 'cheq', 'admin', 'com'],
    needs: ['REU-01', 'REU-02', 'SP-01', 'SP-02', 'REC-16', 'REC-19', 'CIB-01', 'AUT-05', 'CIB-04', 'CIB-12', 'SCR-05', 'PROC-02', 'PROC-03', 'PROC-05', 'PROC-06', 'PP-07', 'ANO-04', 'ANO-02', 'ERG-02', 'ERG-03', 'ERG-04', 'FIX-03', 'FIX-04', 'ERG-05', 'ERG-06', 'ERG-07', 'ERG-08', 'ERG-09', 'ERG-10'],
    asis: ['Pointage papier de l’état des réservations les mardi et vendredi S-2 (S33)', 'Excel de suivi de prod par atelier et tableau 8 m² (S12, S56)', 'Manquants faux quand l’attendu est éclaté par type de préparation (S34)'],
    badge: () => { const n = M.sum(C.unitesScope().filter(u => u.statut === 'EN_ATTENTE'), u => u.nb); return { n, hot: n > 0, title: "Unités en attente d'affiches" }; },
    render(root, params) {
      // Onglet d'atelier (?pour=deroulant, fixe, pliage, bus) : le suivi de prod de ces ateliers
      const pour = M.POUR_LABEL[params.pour] ? params.pour : null;
      if (pour) { vueAtelier(root, params, pour); return; }
      // Pilotage › Suivi de prod : le dashboard. Le tableau du reste à faire est passé dans l'état des réservations vivant
      // (19/10) ; ses filtres pilotent aussi les graphiques, ils restent sous l'en-tête (option page)
      F = ui.filters({ id: 'suivi', defs: filterDefs(), rows: C.themesScope({ allWeeks: true }), page: true });
      root.append(
        ui.pageHead({ crumb: 'Pilotage · Suivi de prod', title: 'Dashboard', screen: 'suivi',
          sub: 'Avancement des départs ' + semsLabel() + ' : attendu, reçu, prêt, produit et expédié, par atelier et par départ camion. Le reste à faire, dossier par dossier : État des réservations vivant.' }),
        F.bar);
      dashboard(root);
    },
  });
})();
