/* Stock d'affiches : disponible, reliquats d'entretien, rebut, mouvements (dont sorties automatiques) */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const user = () => M.ROLES.find(r => r.id === M.state.role).label;

  function rebut(rows) {
    let q = 1, motif = 'Affiche déchirée';
    ui.modal({ title: 'Mise au rebut (' + rows.length + ' affiche(s))', body: [
      ui.field('Quantité par affiche', ui.input({ type: 'number', value: q, min: 1, onChange: v => { q = Number(v); } })),
      ui.field('Motif', ui.select({ value: motif, options: ['Affiche déchirée', 'Mauvais visuel', 'Erreur de quantité', 'Autre'], onChange: v => { motif = v; } })),
      ui.annot('Le rebut retire une quantité abîmée ou fausse : il défalque le stock (RP32 #4). La destruction de fin de campagne se décide par dossier, dans Stocks › Fin de campagne. Une non-conformité peut être ouverte dans l’appli Process Métier depuis ce motif (lien à cadrer).', ['QUA-03', 'REC-24']),
    ], actions: [{ label: 'Annuler' }, { label: 'Mettre au rebut', primary: true, danger: true, onClick: () => {
      M.tick(2);
      rows.forEach(r => { const take = Math.min(q, C.stockDispo(r.a)); if (take <= 0) return; r.a.rebut += take; M.data.mouvements.push({ id: M.uid('MV'), date: new Date(M.NOW), afficheId: r.a.id, type: 'Mise au rebut', qte: -take, user: user(), auto: false, motif }); });
      M.journal(rows.map(r => r.id).join(', '), 'Mise au rebut : ' + motif); M.refresh();
    } }] });
  }

  M.screen({
    id: 'stock', title: 'Stock d’affiches', icon: '▦', nav: 'Stock', roles: ['recep', 'cheq', 'expe'],
    // QUA-03 : seul un lien vers l'appli Process Métier est évoqué ; le suivi des non-conformités dans Circé reste à faire (ligne 81)
    needs: ['QUA-01', 'REU-08', 'PROC-03', 'REC-08', 'REC-24', 'CIB-14', 'ERG-05', 'ERG-06', 'ERG-08', 'ERG-10'],
    asis: ['Stock = somme des mouvements ; sorties seulement par « Activité de production », rebut ou saisie manuelle (code : ActiviteBll.cs:137-153)', 'Reliquat d’entretien et rebut suivis dans des Excel (S12)'],
    render(root, params) {
      const D = M.data;
      const tab = params.tab || 'stock';
      const afs = D.affiches.filter(a => (M.state.site === 'ALL' || a.site === M.state.site) && a.statut !== 'ORPHELINE' || (a.statut === 'ORPHELINE' && M.inScope(a)));
      const rows = afs.map(a => {
        const mv = C.mouvementsAffiche(a.id);
        const d = C.dossierOfAffiche(a);
        const sorties = -M.sum(mv.filter(m => m.qte < 0 && m.type.startsWith('Expédition')), m => m.qte);
        const lastAuto = mv.filter(m => m.auto).sort((x, y) => y.date - x.date)[0];
        return { id: a.id, a, site: C.site(a.site).label, annonceur: d ? d.annonceur : a.annonceurSaisi, theme: a.alloc[0] ? C.theme(a.alloc[0].themeId).libelle : a.libelleSaisi, semaines: (a.semaines || []).map(s => 'S' + s).join('+'), empl: a.allee + '-' + a.rayon, recu: a.qteRecue, sorties, rebut: a.rebut, dispo: C.stockDispo(a), conserver: a.aConserver, last: lastAuto ? lastAuto.date : null };
      });
      const mvtsAll = D.mouvements.filter(m => { const a = D.affiches.find(x => x.id === m.afficheId); return a && (M.state.site === 'ALL' || a.site === M.state.site); }).slice().sort((a, b) => b.date - a.date);
      const today = new Date(M.NOW); today.setHours(0, 0, 0, 0);
      const opts = (vals, lab) => M.uniq(vals.filter(v => v !== null && v !== undefined && v !== '')).map(v => ({ value: v, label: lab ? lab(v) : v })).sort((a, b) => String(a.label).localeCompare(String(b.label), 'fr'));
      // Filtres du stock : N° de dossier, Départ (une affiche sans semaine reste visible), Format, État ; Allée par « + Filtre »
      const FS = ui.filters({ id: 'stock', rows, defs: [
        ui.dossierFilter(rows, r => C.dossiersOfAffiche(r.a)),
        Object.assign(ui.weekFilter([], r => r.a.semaines || []), { matchEmpty: true }),
        { key: 'format', label: 'Format', options: opts(rows.map(r => r.a.format)), get: r => r.a.format },
        { key: 'etat', label: 'État', options: [{ value: 'stock', label: 'En stock' }, { value: 'epuise', label: 'Épuisée' }, { value: 'conserver', label: 'À conserver (reliquat)' }, { value: 'rebut', label: 'Avec du rebut' }], get: r => [r.dispo > 0 ? 'stock' : 'epuise', r.conserver ? 'conserver' : null, r.rebut ? 'rebut' : null] },
        { key: 'allee', label: 'Allée', more: true, options: opts(rows.map(r => r.a.allee)), get: r => r.a.allee },
      ] });
      // Filtres des mouvements : N° de dossier, Mouvement, Automatique ; Par par « + Filtre »
      const FM = ui.filters({ id: 'stock-mvt', rows: mvtsAll, defs: [
        ui.dossierFilter(mvtsAll, m => { const a = D.idx.affiche.get(m.afficheId); return a ? C.dossiersOfAffiche(a) : []; }),
        { key: 'type', label: 'Mouvement', options: opts(mvtsAll.map(m => m.type)), get: m => m.type },
        { key: 'auto', label: 'Automatique', options: [{ value: 'oui', label: 'Oui (à l’expédition)' }, { value: 'non', label: 'Non' }], get: m => (m.auto ? 'oui' : 'non') },
        { key: 'user', label: 'Par', more: true, options: opts(mvtsAll.map(m => m.user)), get: m => m.user },
      ] });
      const stockRows = FS.apply(rows);
      const mvts = FM.apply(mvtsAll);
      // Vue choisie dans le menu du haut (Stock) : pas d'onglets dans la page ; filtres puis contenu
      root.append(
        ui.pageHead({ crumb: 'Stocks', title: tab === 'mvt' ? 'Mouvements' : 'Stock par affiche',
          sub: tab === 'mvt' ? 'Journal des entrées et sorties de stock ; les sorties d’expédition sont automatiques.' : 'Disponible par affiche et emplacement, reliquats d’entretien à conserver et rebut.', screen: 'stock' }),
        tab === 'mvt' ? FM.bar : FS.bar,
        h('div', { class: 'kpis', style: { marginBottom: '14px' } },
          ui.stat({ label: 'Affiches en stock', value: M.fmt.n(M.sum(stockRows, r => Math.max(0, r.dispo))) }),
          ui.stat({ label: 'Reliquats d’entretien à conserver', value: M.fmt.n(M.sum(stockRows.filter(r => r.conserver), r => r.dispo)), sub: stockRows.filter(r => r.conserver).length + ' visuels' }),
          ui.stat({ label: 'Rebut', value: M.fmt.n(M.sum(stockRows, r => r.rebut)) }),
          ui.stat({ label: 'Sorties automatiques aujourd’hui', value: M.fmt.n(-M.sum(mvtsAll.filter(m => m.auto && m.date >= today), m => m.qte)), sub: 'à l’expédition' })));
      if (tab === 'mvt') {
        root.append(ui.card({ flush: true, body: ui.table({ id: 'stock-mvt', rows: mvts, exportName: 'mouvements-stock.csv', tone: m => m.auto ? 'info' : m.qte < 0 && m.type === 'Mise au rebut' ? 'serious' : null,
          columns: [{ key: 'date', label: 'Date', render: m => M.fmt.dt(m.date), value: m => m.date.getTime() }, { key: 'afficheId', label: 'N° affiche' }, { key: 'type', label: 'Mouvement' }, { key: 'qte', label: 'Quantité', align: 'num', render: m => M.fmt.signed(m.qte) }, { key: 'user', label: 'Par' }, { key: 'auto', label: 'Automatique', value: m => m.auto ? 'Oui' : '' }, { key: 'motif', label: 'Motif', value: m => m.motif || '' }] }) }));
        return;
      }
      root.append(
        ui.annot('Le disponible baisse automatiquement quand un colis part (fin de journée Geodis). Un visuel encore en stock après son départ est gardé comme reliquat d’entretien, jusqu’à la décision de fin de campagne du dossier (Stocks › Fin de campagne : conserver, renvoyer ou détruire). Le rebut retire une quantité abîmée. Entrées et sorties suivent RP32 #1 : réception, fin de journée Geodis, rebut, destruction.', ['REU-08', 'QUA-01', 'PROC-03', 'REC-24']),
        ui.card({ flush: true, body: ui.table({ id: 'stock', rows: stockRows, selectable: true, exportName: 'stock-affiches.csv', query: params.q,
          tone: r => r.dispo <= 0 ? 'muted' : r.conserver ? 'info' : null,
          bulkActions: (sel, clear) => [ui.btn('Mettre au rebut', () => { rebut(sel); clear(); }, { small: true, danger: true }), ui.btn('Marquer « à conserver »', () => { sel.forEach(r => { r.a.aConserver = true; }); clear(); M.refresh(); }, { small: true })],
          columns: [{ key: 'id', label: 'N° affiche' },
            ui.colVisuel(r => [r.annonceur, r.theme, r.conserver ? ui.tag('à conserver') : null]),
            { key: 'semaines', label: 'Départ' }, { key: 'empl', label: 'Emplacement', value: r => ui.withSite(r.empl, r.a.site) },
            { key: 'recu', label: 'Reçu', align: 'num' }, { key: 'sorties', label: 'Sorties expédition', align: 'num' },
            { key: 'dispo', label: 'Disponible', align: 'num', render: r => h('span', null, r.rebut ? [ui.sev('serious', r.rebut + ' rebut'), ' '] : null, M.fmt.n(r.dispo)) },
            { key: 'last', label: 'Dernière sortie auto', render: r => r.last ? M.fmt.dt(r.last) : '—', value: r => r.last ? r.last.getTime() : 0 },
            { key: 'site', label: 'Site', hidden: true }, { key: 'annonceur', label: 'Annonceur', hidden: true }, { key: 'theme', label: 'Thème', hidden: true },
            { key: 'rebut', label: 'Rebut', align: 'num', hidden: true }, { key: 'conserver', label: 'À conserver', value: r => r.conserver ? 'Oui' : '', hidden: true }] }) }));
    },
  });
})();
