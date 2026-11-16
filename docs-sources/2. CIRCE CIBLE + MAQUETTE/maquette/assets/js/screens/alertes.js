/* Alertes : toutes les exceptions au même endroit, avec règle, gravité et destinataires */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const TYPES = {
    MANQUANT: 'Visuel manquant ou partiel',
    ECART: 'Écart de réception > 10 %',
    SANS_IP: 'Réception sans IP',
    ORPHELINE: 'Réception inconnue à identifier',
    DOSSIER_INTROUVABLE: 'Réception inconnue : dossier introuvable',
    VALIDATION_ADMIN: 'Validation admin à confirmer (doute)',
    CONTROLE_RETARD: 'Palette à contrôler en retard',
    IP_MANQUANTES: 'Préparation non reçue',
    ECART_BC: 'Écart Broadcast / Circé',
    THEMES_PROCHES: 'Thèmes proches à vérifier',
    ANNONCEURS_PROCHES: 'Annonceurs proches à vérifier',
    THEME_BC: 'Thème modifié dans Broadcast',
    DM_FICHIER: 'Dernière minute sur fichier envoyé',
    APRES_LIBERATION: 'Rajout après préparation',
    DEPART_RISQUE: 'Départ camion à risque',
    THEME_MODIF: 'Feuille de stock à refaire',
    FEUILLE_DEFINITIVE: 'Feuille de stock définitive à imprimer',
  };
  M.ALERT_TYPES = TYPES;
  /** Dossiers cités par une alerte (message ou lien), pour le filtre « N° de dossier ». */
  const dossiersAlerte = a => M.uniq((String(a.message || '') + ' ' + JSON.stringify((a.link && a.link.params) || {})).match(/\d{6}/g) || []).filter(id => C.dossier(id));
  const SEVS = [['critical', 'Critiques', 'à traiter tout de suite'], ['serious', 'Importantes', 'dans la journée'], ['warning', 'À surveiller', 'avant le départ'], ['info', 'Pour information', '']];

  M.screen({
    id: 'alertes', title: 'Alertes', icon: '🔔', nav: 'Alertes',
    needs: ['PP-03', 'PP-08', 'PP-09', 'REC-16', 'SCR-08', 'REU-04', 'REU-03', 'CIB-05', 'CIB-03', 'FIX-07', 'BC-03', 'PROC-02', 'ERG-05', 'ERG-06', 'ERG-08'],
    asis: ['Mails manuels « Go » et alertes par Excel (S12, S49, S69)', 'Aucune alerte quand un dossier arrive après la préparation du fixe (S15 « refresh »)', 'Pas d’alerte en cas de DM sur un fichier scro validé (S71)'],
    badge: () => { const a = C.alertesOuvertes(); const n = a.filter(x => x.sev === 'critical').length; return { n: a.length, hot: n > 0, title: n + ' critiques' }; },
    render(root, params) {
      // Filtres : N° de dossier, Départ (les alertes sans semaine restent), Gravité, État ; Site par « + Filtre ». Le type se choisit par les pastilles.
      const base = C.alertes();
      // Un lien peut poser le type (?type=ECART) : une fois par arrivée, les pastilles restent ensuite libres
      const F = ui.filters({ id: 'alertes', rows: base, preset: params.type ? { type: [params.type] } : null, defs: [
        ui.dossierFilter(base, dossiersAlerte),
        Object.assign(ui.weekFilter([M.state.semaine, M.state.semaine + 1], a => a.semaine), { matchEmpty: true, help: 'Semaines de départ ; les alertes sans semaine (orphelines, purge) restent affichées' }),
        { key: 'sev', label: 'Gravité', options: SEVS.map(([k, l]) => ({ value: k, label: l })), get: a => a.sev },
        { key: 'etat', label: 'État', default: ['ouvertes'], options: [{ value: 'ouvertes', label: 'Ouvertes' }, { value: 'acquittees', label: 'Acquittées' }], get: a => (a.acquittee ? 'acquittees' : 'ouvertes') },
        { key: 'site', label: 'Site', more: true, matchEmpty: true, options: M.ref.sites.map(s => ({ value: s.id, label: s.label })), get: a => a.site },
        { key: 'type', label: 'Type', hidden: true, options: Object.entries(TYPES).map(([v, l]) => ({ value: v, label: l })), get: a => a.type },
      ] });
      const parType = F.except(base, 'type');
      const counts = M.groupBy(parType, a => a.type);
      const total = parType.length;
      const sevCounts = M.groupBy(F.except(base, 'sev'), a => a.sev);
      const types = F.sel('type'), sevs = F.sel('sev');
      const rows = F.apply(base).sort((a, b) => C.sevRank[a.sev] - C.sevRank[b.sev] || (a.date - b.date));
      const toggleType = k => { const s = new Set(types); if (s.has(k)) s.delete(k); else s.add(k); F.set('type', Array.from(s)); M.go('alertes'); };
      const ack = a => { M.data.ack.add(a.key); M.journal(a.key, 'Alerte acquittée : ' + a.titre); M.refresh(); };

      root.append(
        ui.pageHead({ crumb: 'Pilotage', title: 'Alertes', sub: 'Les exceptions remplacent les mails et les pointages Excel. Chaque alerte vient d’une règle paramétrable (seuil, gravité, destinataires, mail ou non) : voir Administration › Paramétrage › Alertes et mails.', screen: 'alertes',
          actions: ui.btn('Règles et destinataires', () => M.go('parametrage', { tab: 'alertes' })) }),
        F.bar,
        // 4 indicateurs par gravité (DESIGN.md §4.4) ; les 13 types deviennent des filtres compacts avec compteur.
        h('div', { class: 'kpis', style: { marginBottom: '12px' } }, SEVS.map(([k, label, sub]) =>
          ui.stat({ label, value: (sevCounts[k] || []).length, sub, onClick: () => { F.set('sev', sevs.length === 1 && sevs[0] === k ? [] : [k]); M.refresh(); }, title: 'Filtrer sur cette gravité' }))),
        // Types : pastilles à choix multiple (plusieurs types cochés s'additionnent)
        h('div', { class: 'cz-chipbar', role: 'toolbar', 'aria-label': 'Filtrer par type d’alerte (plusieurs choix possibles)' },
          [['', 'Tous les types', total]].concat(Object.entries(TYPES).map(([k, l]) => [k, l, (counts[k] || []).length])).map(([k, l, n]) => {
            const on = k ? types.includes(k) : !types.length;
            return h('button', { type: 'button', class: ['btn', 'btn-sm', on ? 'btn-primary' : 'btn-outline-secondary'], 'aria-pressed': String(on), disabled: !n && !on, onclick: () => { if (k) toggleType(k); else { F.set('type', []); M.go('alertes'); } } },
              l, h('span', { class: ['badge', 'ms-1', on ? 'bg-white text-primary' : 'bg-secondary-lt'] }, n));
          })),
        ui.card({ flush: true, body: ui.table({
          id: 'alertes', rows, rowKey: a => a.key, exportName: 'alertes.csv', selectable: true, tone: a => a.sev === 'info' ? 'info' : a.sev,
          bulkActions: (sel, clear) => [ui.btn('Acquitter', () => { sel.forEach(a => M.data.ack.add(a.key)); clear(); M.journal('alertes', sel.length + ' alerte(s) acquittée(s)'); M.refresh(); }, { small: true })],
          columns: [
            { key: 'sev', label: 'Gravité', render: a => ui.sev(a.sev), value: a => C.sevRank[a.sev] },
            { key: 'type', label: 'Type', hidden: true, render: a => TYPES[a.type] || a.type },
            { key: 'titre', label: 'Alerte', wrap: true, render: a => h('div', null, h('b', null, a.titre), h('div', { class: 'small muted', style: { maxWidth: '640px' } }, a.message)) },
            { key: 'site', label: 'Site', render: a => a.site ? C.site(a.site).label : '—' },
            { key: 'semaine', label: 'Départ', render: a => a.semaine ? 'S' + a.semaine : '—' },
            { key: 'date', label: 'Échéance / date', render: a => M.fmt.dt(a.date), value: a => a.date ? a.date.getTime() : 0 },
            { key: 'needs', label: 'Besoins', sortable: false, render: a => ui.chips(a.needs), csv: a => (a.needs || []).join(' ') },
          ],
          rowActions: a => [a.link ? ui.btn('Ouvrir', () => M.go(a.link.screen, a.link.params), { small: true }) : null, a.acquittee ? h('span', { class: 'small muted' }, 'acquittée') : ui.btn('Acquitter', () => ack(a), { small: true, ghost: true })],
        }) }));
    },
  });
})();
