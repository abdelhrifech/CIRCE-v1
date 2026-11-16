/* Expédition : scan et colisage, colis, départs Geodis, fin de journée avec sortie de stock automatique */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const E = { dest: '', colis: null, scan: '', retrait: new Set() }; // retrait : unités cochées dans le colis en cours
  const user = () => M.ROLES.find(r => r.id === M.state.role).label;
  let F = null; // filtres de la page (ui.filters), communs aux trois onglets
  /** Lecture des filtres sur une unité, et sur un colis (un colis pas encore livré passe le filtre Départ). */
  const UG = { dossier: u => C.dossiersOf(u), semaine: u => u.semaine, boucle: u => C.dest(u.dest).boucle, canal: u => C.dest(u.dest).canal, dest: u => u.dest, statut: null };
  const CG = { dossier: c => C.dossiersOfColis(c), semaine: c => (c.statut !== 'LIVRE' ? undefined : c.semaine), boucle: c => C.dest(c.dest).boucle, canal: c => c.canal, dest: c => c.dest, statut: c => c.statut };
  // « Liste des colis » des onglets 2 m² fixe et Pliage (04/11, menu de Circé) : la vue Colis limitée aux ateliers du type (?type=)
  let ats = null;
  const unitesAll = () => C.unitesScope({ allWeeks: true }).filter(u => !ats || ats.has(u.atelier));
  const colisAll = () => M.data.colis.filter(c => M.inScope(c, { allWeeks: true }) && (!ats || c.unites.some(id => { const u = C.unite(id); return u && ats.has(u.atelier); })));
  /** Filtres : N° de dossier, Départ, Boucle ; Statut du colis (onglet Colis), Canal et Destinataire par « + Filtre ». */
  function filterDefs(onColis) {
    const g = onColis ? CG : UG;
    const dests = M.ref.destinataires.filter(d => M.state.site === 'ALL' || d.site === M.state.site);
    return [
      ui.dossierFilter(onColis ? colisAll() : unitesAll(), g.dossier),
      ui.weekFilter(null, g.semaine),
      { key: 'boucle', label: 'Boucle', options: M.uniq(dests.map(d => d.boucle)).sort((a, b) => a.localeCompare(b, 'fr')).map(b => ({ value: b, label: b })), get: g.boucle },
      { key: 'statut', label: 'Statut du colis', more: true, hidden: !onColis, options: ['COLIS_OUVERT', 'COLIS_CLOS', 'EXPEDIE', 'LIVRE'].map(s => ({ value: s, label: M.STATUTS[s].label })), get: g.statut },
      { key: 'canal', label: 'Canal', more: true, options: Object.entries(M.ref.canaux).map(([k, v]) => ({ value: k, label: v })), get: g.canal },
      { key: 'dest', label: 'Destinataire', more: true, options: dests.map(d => ({ value: d.id, label: d.label })).sort((a, b) => a.label.localeCompare(b.label, 'fr')), get: g.dest },
    ];
  }

  function finDeJournee() {
    const sim = M.SIMULATIONS.find(s => s.label === 'Fin de journée Geodis');
    sim.run(); M.refresh();
  }

  function scanner(code) {
    const D = M.data;
    code = String(code || '').trim().toUpperCase();
    if (!code) return;
    const dest = M.ref.destinataires.find(d => d.id === code || d.label.toUpperCase() === code);
    if (dest) { E.dest = dest.id; E.colis = null; ui.toast('Destinataire ' + dest.label + ' (' + M.ref.canaux[dest.canal] + ').'); M.refresh(); return; }
    const u = C.unite(code);
    if (!u) { ui.toast('Code inconnu : ' + code, 'critical'); return; }
    if (u.statut !== 'PRODUIT') { ui.toast(u.id + ' n’est pas « Produit » (statut : ' + M.STATUTS[u.statut].label + ').', 'critical'); return; }
    if (E.dest && u.dest !== E.dest) { ui.toast(u.id + ' part vers ' + C.dest(u.dest).label + ', pas vers ' + C.dest(E.dest).label + ' : contrôle bloquant.', 'critical'); return; }
    E.dest = u.dest;
    if (!E.colis) {
      const dst = C.dest(u.dest);
      E.colis = { id: 'C-0000000000063' + String(4100 + D.colis.length + 1), site: u.site, semaine: u.semaine, dest: u.dest, canal: dst.canal, unites: [], statut: 'COLIS_OUVERT', clos: null, recepisse: null, expedie: null, livre: null };
      D.colis.push(E.colis); M.reindex();
    }
    E.colis.unites.push(u.id); u.colis = E.colis.id; u.statut = 'COLISE';
    ui.toast(u.id + ' ajouté au colis ' + E.colis.id + ' (' + (u.kind === 'TRAIN' ? u.nb + ' train(s)' : C.ligne(u.ligneId).qte + C.ligne(u.ligneId).entretien + ' affiches') + ').', 'good');
    M.refresh();
  }

  /** Retire du colis en cours les unités cochées, ou toutes (EXP-02) : elles redeviennent « Produit », prêtes à re-scanner.
      Un colis vidé disparaît. Un colis clos ne se rouvre pas : on en crée un nouveau (réouverture refusée, FIX-08). */
  function retirer(ids) {
    const c = E.colis;
    if (!c || !ids.length) return;
    ids.forEach(id => { const u = C.unite(id); if (u) { u.statut = 'PRODUIT'; u.colis = null; } });
    c.unites = c.unites.filter(id => !ids.includes(id));
    E.retrait = new Set();
    M.journal(c.id, ids.length + ' unité(s) retirée(s) du colis : ' + ids.join(', '), user());
    if (!c.unites.length) { M.data.colis.splice(M.data.colis.indexOf(c), 1); M.reindex(); E.colis = null; }
    ui.toast(ids.length + ' unité(s) retirée(s) du colis' + (E.colis ? '' : ', vide : il est supprimé') + '. Elles repassent « Produit ».', 'good');
    M.refresh();
  }

  function clore() {
    const c = E.colis;
    if (!c || !c.unites.length) return;
    M.tick(2);
    c.statut = 'COLIS_CLOS'; c.clos = new Date(M.NOW);
    M.journal(c.id, 'Colis clos (' + c.unites.length + ' unité(s)) : ' + (c.canal === 'MILK' ? 'code colis milk scanné' : 'étiquette Geodis éditée'), user());
    const dst = C.dest(c.dest);
    ui.modal({ title: c.canal === 'MILK' ? 'Colis milk run clos' : 'Étiquette Geodis messagerie', body: h('div', { class: 'row', style: { alignItems: 'flex-start' } },
      h('div', { class: 'bague', style: { width: '320px' } }, h('div', { class: 'big' }, c.canal === 'MILK' ? 'MILK RUN · ' + dst.boucle : 'GEODIS EXPRESS'), h('div', { class: 'bc' }), h('div', { class: 'mono' }, c.id), h('div', null, 'Destinataire : ', h('b', null, dst.label)), h('div', null, c.unites.length + ' unité(s) · départ ' + M.fmt.day(C.depart(C.unite(c.unites[0]))))),
      h('div', null, ui.annot('Le code colis Circé est repris comme référence de l’envoi Geodis : le suivi et la preuve de livraison reviennent sur le colis.', ['CIB-15']))) });
    E.colis = null; E.retrait = new Set(); M.refresh();
  }

  function tabColisage(root) {
    const D = M.data;
    const aColiser = F.apply(unitesAll(), UG).filter(u => u.statut === 'PRODUIT');
    const byDest = M.groupBy(aColiser, u => u.dest);
    const dst = E.dest ? C.dest(E.dest) : null;
    const pour = E.dest ? aColiser.filter(u => u.dest === E.dest) : [];
    root.append(
      ui.annot('Scan du destinataire, puis de chaque rouleau ou train : le contrôle de destination est bloquant. Avant la clôture, on retire d’un coup les unités cochées du colis. La clôture édite l’étiquette (messagerie) ou valide le code milk. Statut « Colisé · à expédier » au scan.', ['CIB-15', 'ERG-01', 'EXP-02']),
      h('div', { class: 'scan-box' }, h('span', null, '⌁ Douchette'),
        h('input', { placeholder: 'Scanner un code destinataire (ex. ' + ((Object.keys(byDest)[0]) || 'BOR') + ') ou une unité (ex. ' + (aColiser[0] ? aColiser[0].id : 'UM-0001') + '), puis Entrée', value: E.scan, onkeydown: e => { if (e.key === 'Enter') { const v = e.target.value; E.scan = ''; scanner(v); } } })),
      h('div', { class: 'grid side mt' },
        ui.card({ title: dst ? 'À coliser pour ' + dst.label : 'Unités produites à coliser', sub: dst ? dst.boucle + ' · ' + M.ref.canaux[dst.canal] : 'choisissez un destinataire', flush: true, body: dst
          ? (pour.length ? h('div', null, pour.map(u => h('div', { class: 'row', style: { padding: '8px 14px', borderBottom: '1px solid var(--border)' } }, h('span', { class: 'mono' }, u.id), u.kind === 'TRAIN' ? ui.positions(u) : h('span', null, C.theme(u.themeId).libelle), h('span', { class: 'small muted' }, C.afficheur(u.afficheur).label), h('span', { class: 'spacer' }), ui.btn('Scanner', () => scanner(u.id), { small: true })))) : h('div', { class: 'dt-empty' }, 'Plus rien de produit pour ce destinataire.'))
          : h('div', null, Object.entries(byDest).map(([d, us]) => h('div', { class: 'row', style: { padding: '8px 14px', borderBottom: '1px solid var(--border)' } }, h('b', null, C.dest(d).label), h('span', { class: 'small muted' }, C.dest(d).boucle + ' · départ ' + M.fmt.day(C.depart(us[0])) + ' ' + M.fmt.hm(C.depart(us[0]))), h('span', { class: 'spacer' }), h('span', null, us.length + ' unité(s)'), ui.btn('Scanner le destinataire', () => scanner(d), { small: true }))).concat(aColiser.length ? [] : [h('div', { class: 'dt-empty' }, 'Aucune unité produite en attente de colisage.')])) }),
        ui.card({ title: 'Colis en cours', body: E.colis ? [
          h('div', { class: 'file-name' }, E.colis.id), h('div', { class: 'small muted' }, C.dest(E.colis.dest).label + ' · ' + M.ref.canaux[E.colis.canal]),
          // Une case par unité : retirer d'un coup les trains mis dans le colis (EXP-02), sans les recopier code par code
          h('div', { class: 'stack', style: { gap: '2px', margin: '8px 0' } }, E.colis.unites.map(id => h('label', { class: 'form-check', style: { margin: 0 } },
            h('input', { class: 'form-check-input', type: 'checkbox', checked: E.retrait.has(id), onchange: e => { if (e.target.checked) E.retrait.add(id); else E.retrait.delete(id); } }),
            h('span', { class: 'form-check-label mono' }, id)))),
          h('div', { class: 'row' }, ui.btn('Clore le colis', clore, { primary: true }),
            ui.btn('Retirer la sélection', () => { const ids = E.colis.unites.filter(id => E.retrait.has(id)); if (!ids.length) { ui.toast('Cochez les unités à retirer du colis.', 'critical'); return; } retirer(ids); }, { small: true }),
            ui.btn('Tout retirer', () => retirer(E.colis.unites.slice()), { small: true, ghost: true })),
          h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Un colis clos ne se rouvre pas : pour un rouleau oublié, on crée un nouveau colis (réouverture refusée dans la Synthèse du 16/10).')]
          : h('div', { class: 'muted small' }, 'Aucun colis ouvert. Le premier scan d’unité ouvre un colis.') })));
  }

  function tabColis(root) {
    const rows = F.apply(colisAll(), CG);
    root.append(
      h('div', { class: 'row', style: { marginBottom: '10px' } }, ui.annot('À la fin de journée Geodis, les colis clos passent « Expédié » et le stock de chaque affiche est décrémenté automatiquement. Aujourd’hui, aucune sortie de stock n’a lieu à l’expédition (constaté dans le code). Les colis pas encore livrés restent affichés, quelle que soit la semaine de départ choisie.', ['REU-08', 'QUA-01', 'CIB-15']), h('span', { class: 'spacer' }), ui.btn('Fin de journée Geodis', finDeJournee, { primary: true })),
      ui.card({ flush: true, body: ui.table({
        id: 'colis', rows, exportName: 'colis.csv', sort: { key: 'statut', dir: 'asc' },
        tone: c => c.statut === 'COLIS_CLOS' ? 'info' : c.statut === 'COLIS_OUVERT' ? 'warning' : null,
        columns: [
          { key: 'id', label: 'Code colis', nowrap: true }, { key: 'semaine', label: 'Départ', render: c => 'S' + c.semaine },
          { key: 'dest', label: 'Destinataire', value: c => C.dest(c.dest).label },
          { key: 'boucle', label: 'Boucle Geodis', value: c => C.dest(c.dest).boucle + ' · ' + M.ref.canaux[c.canal], title: 'Boucle et canal (milk run ou messagerie)' },
          { key: 'nb', label: 'Unités', align: 'num', value: c => c.unites.length },
          { key: 'statut', label: 'Statut', render: c => ui.pill(c.statut), value: c => M.STATUTS[c.statut].label },
          { key: 'recepisse', label: 'Récépissé Geodis', value: c => c.recepisse || '' },
          { key: 'livre', label: 'Preuve de livraison', render: c => c.livre ? h('span', null, ui.sev('good', M.fmt.dt(c.livre))) : '—', value: c => c.livre ? c.livre.getTime() : 0 },
          { key: 'canal', label: 'Canal', value: c => M.ref.canaux[c.canal], hidden: true },
          { key: 'clos', label: 'Clos le', render: c => c.clos ? M.fmt.dt(c.clos) : '—', value: c => c.clos ? c.clos.getTime() : 0, hidden: true },
          { key: 'expedie', label: 'Expédié le', render: c => c.expedie ? M.fmt.dt(c.expedie) : '—', value: c => c.expedie ? c.expedie.getTime() : 0, hidden: true },
        ],
      }) }));
  }

  function tabDeparts(root) {
    const us = F.apply(unitesAll().filter(u => u.site !== 'NAN'), UG);
    const grp = M.groupBy(us, u => C.dest(u.dest).boucle + '|' + u.site + '|' + C.depart(u).getTime());
    const rows = Object.entries(grp).map(([k, list]) => { const [boucle, site, ts] = k.split('|'); const e = C.etapesCount(list); return { id: k, boucle, site: C.site(site).label, dep: new Date(Number(ts)), dests: M.uniq(list.map(u => C.dest(u.dest).label)).join(', '), total: M.sum(list, u => u.nb), pret: e.colise + e.expedie, att: e.attente, enCours: e.pret + e.prod, parti: e.expedie }; }).sort((a, b) => a.dep - b.dep);
    root.append(
      ui.annot('Planning des départs camions Geodis (milk run par boucle et messagerie express). Un départ proche avec des unités en attente est signalé.', ['CIB-15', 'SP-01', 'CIB-09']),
      ui.card({ flush: true, body: ui.table({ id: 'departs', rows, search: false,
        tone: r => r.att && (r.dep - M.NOW) < 36 * 3600e3 ? 'critical' : r.att ? 'warning' : r.pret === r.total ? 'good' : null,
        columns: [{ key: 'dep', label: 'Départ', render: r => M.fmt.day(r.dep) + ' ' + M.fmt.hm(r.dep), value: r => r.dep.getTime() }, { key: 'boucle', label: 'Boucle', value: r => M.state.site === 'ALL' ? r.boucle + ' · ' + r.site : r.boucle }, { key: 'dests', label: 'Destinations', wrap: true }, { key: 'total', label: 'Unités', align: 'num' }, { key: 'pret', label: 'Colisées / parties', align: 'num' }, { key: 'enCours', label: 'En cours', align: 'num' }, { key: 'att', label: "En attente d'affiches", align: 'num' }, { key: 'avancement', label: 'Avancement', sortable: false, render: r => ui.meter(r.total ? r.pret / r.total : 0) }, { key: 'site', label: 'Plateforme', hidden: true }] }) }));
  }

  M.screen({
    id: 'expedition', title: 'Expédition', icon: '⇪', nav: 'Expédition', roles: ['expe', 'cheq'],
    needs: ['REU-08', 'CIB-15', 'QUA-01', 'EXP-02', 'EXP-01', 'EXP-03', 'FIX-11', 'SP-02', 'ERG-01', 'ERG-05', 'ERG-06', 'ERG-08', 'ERG-10'],
    asis: ['Statut « Terminé » posé par la fin de journée, pas par la preuve de livraison (code : ListeColisBll.cs:199-223)', 'Aucune sortie de stock automatique à l’expédition (code : seuls Activité, Livraison, Liste des affiches et Zone picking écrivent des mouvements)', 'Suivi Geodis : le batch Zoom n’alimente jamais le journal de suivi (BacthCallZoomBll.cs:61)'],
    badge: () => { const n = M.data.colis.filter(c => c.statut === 'COLIS_CLOS' && M.inScope(c)).length; return { n, title: 'Colis clos à remettre à Geodis' }; },
    render(root, params) {
      // Vue choisie dans le menu du haut (Expédition) : pas d'onglets dans la page
      const VUES = {
        colisage: ['Scan et colisage', 'Scanner le destinataire puis ses unités produites ; le colis se clôt en un geste.'],
        colis: ['Colis', 'Colis ouverts, clos, expédiés et livrés, avec la fin de journée Geodis et les preuves de livraison. L’expédition met le stock à jour.'],
        departs: ['Départs camions', 'Départs Geodis (milk run et messagerie) et unités prêtes ou en attente pour chacun.'],
      };
      const tab = VUES[params.tab] ? params.tab : 'colisage';
      const type = tab === 'colis' && M.POUR_LABEL[params.type] ? params.type : null;
      ats = type ? new Set(M.ateliersPour(type, true).map(a => a.id)) : null;
      F = ui.filters({ id: 'expedition', defs: filterDefs(tab === 'colis'), rows: tab === 'colis' ? colisAll() : unitesAll() });
      const us = F.apply(unitesAll(), UG);
      root.append(
        ui.pageHead({ crumb: type ? M.POUR_LABEL[type] : 'Expédition', title: type ? 'Liste des colis' : VUES[tab][0], sub: type ? 'Les colis de l’atelier : ouverts, clos, expédiés et livrés, avec la fin de journée Geodis et les preuves de livraison (« Liste des colis » de Circé).' : VUES[tab][1], screen: 'expedition' }),
        F.bar,
        h('div', { class: 'kpis', style: { marginBottom: '14px' } },
          ui.stat({ label: 'Produites à coliser', value: M.fmt.n(M.sum(us.filter(u => u.statut === 'PRODUIT'), u => u.nb)) }),
          ui.stat({ label: 'Colis clos à expédier', value: F.apply(colisAll(), CG).filter(c => c.statut === 'COLIS_CLOS').length }),
          ui.stat({ label: 'Expédiées', value: M.fmt.n(M.sum(us.filter(u => u.statut === 'EXPEDIE'), u => u.nb)) }),
          ui.stat({ label: 'Livrées (preuve reçue)', value: M.fmt.n(M.sum(us.filter(u => u.statut === 'LIVRE'), u => u.nb)) })));
      if (tab === 'colis') tabColis(root); else if (tab === 'departs') tabDeparts(root); else tabColisage(root);
    },
  });
})();
