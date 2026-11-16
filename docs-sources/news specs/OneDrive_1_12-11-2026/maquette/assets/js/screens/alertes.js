/* Alertes : toutes les exceptions au même endroit, avec règle et destinataires. Plus de gravité à l'écran (04/11, décision de
   l'utilisatrice : ni indicateurs Critiques / Importantes / À surveiller / Pour information, ni colonne, ni filtre) ; les types,
   qui étaient des pastilles, sont un filtre « Type » du tableau. */
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
    NC_BLOQUANTE: 'Non-conformité bloquante à la réception',
  };
  M.ALERT_TYPES = TYPES;
  /** Dossiers cités par une alerte (message ou lien), pour le filtre « N° de dossier ». */
  const dossiersAlerte = a => M.uniq((String(a.message || '') + ' ' + JSON.stringify((a.link && a.link.params) || {})).match(/\d{6}/g) || []).filter(id => C.dossier(id));

  M.screen({
    id: 'alertes', title: 'Alertes', icon: '🔔', nav: 'Alertes',
    needs: ['PP-03', 'PP-08', 'PP-09', 'REC-16', 'SCR-08', 'REU-04', 'REU-03', 'CIB-05', 'CIB-03', 'FIX-07', 'BC-03', 'PROC-02', 'ERG-05', 'ERG-06', 'ERG-08'],
    asis: ['Mails manuels « Go » et alertes par Excel (S12, S49, S69)', 'Aucune alerte quand un dossier arrive après la préparation du fixe (S15 « refresh »)', 'Pas d’alerte en cas de DM sur un fichier scro validé (S71)'],
    badge: () => { const a = C.alertesOuvertes(); return { n: a.length, title: a.length + ' alerte(s) ouverte(s)' }; },
    render(root, params) {
      // Filtres, dans le tableau : N° de dossier, Départ (les alertes sans semaine restent), Type (liste à cocher, avec compteur),
      // État ; Site par « + Filtre ». Plus de gravité (04/11).
      const base = C.alertes();
      // Un lien peut poser le type (?type=ECART) : une fois par arrivée, le filtre reste ensuite libre
      const F = ui.filters({ id: 'alertes', rows: base, preset: params.type ? { type: [params.type] } : null, defs: [
        ui.dossierFilter(base, dossiersAlerte),
        Object.assign(ui.weekFilter([M.state.semaine, M.state.semaine + 1], a => a.semaine), { matchEmpty: true, help: 'Semaines de départ ; les alertes sans semaine (orphelines, purge) restent affichées' }),
        { key: 'type', label: 'Type', options: Object.entries(TYPES).map(([v, l]) => ({ value: v, label: l })), get: a => a.type },
        { key: 'etat', label: 'État', default: ['ouvertes'], options: [{ value: 'ouvertes', label: 'Ouvertes' }, { value: 'acquittees', label: 'Acquittées' }], get: a => (a.acquittee ? 'acquittees' : 'ouvertes') },
        { key: 'site', label: 'Site', more: true, matchEmpty: true, options: M.ref.sites.map(s => ({ value: s.id, label: s.label })), get: a => a.site },
      ] });
      // Ordre : par échéance ou date, la plus ancienne en tête
      const rows = F.apply(base).sort((a, b) => (a.date ? a.date.getTime() : 0) - (b.date ? b.date.getTime() : 0));
      const ack = a => { M.data.ack.add(a.key); M.journal(a.key, 'Alerte acquittée : ' + a.titre); M.refresh(); };

      root.append(
        ui.pageHead({ crumb: 'Pilotage', title: 'Alertes', sub: 'Les exceptions remplacent les mails et les pointages Excel. Chaque alerte vient d’une règle paramétrable (seuil, destinataires, mail ou non) : voir Administration › Paramétrage › Alertes et mails.', screen: 'alertes',
          actions: ui.btn('Règles et destinataires', () => M.go('parametrage', { tab: 'alertes' })) }),
        F.bar,
        ui.card({ flush: true, body: ui.table({
          id: 'alertes', rows, rowKey: a => a.key, exportName: 'alertes.csv', selectable: true,
          bulkActions: (sel, clear) => [ui.btn('Acquitter', () => { sel.forEach(a => M.data.ack.add(a.key)); clear(); M.journal('alertes', sel.length + ' alerte(s) acquittée(s)'); M.refresh(); }, { small: true })],
          columns: [
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
