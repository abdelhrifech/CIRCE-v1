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
    EXPORT_TRAINS: 'Trains exportés : go de la plateforme',
    APRES_EXPORT: 'Dossier arrivé après l’export des trains',
    DEPART_RISQUE: 'Départ camion à risque',
    THEME_MODIF: 'Feuille de stock à refaire',
    FEUILLE_DEFINITIVE: 'Feuille de stock définitive à imprimer',
    NC_BLOQUANTE: 'Non-conformité bloquante à la réception',
    NC_PLATEFORME: 'Non-conformité : action de la plateforme attendue',
  };
  M.ALERT_TYPES = TYPES;
  /** Dossiers cités par une alerte (message ou lien), pour le filtre « N° de dossier ». */
  const dossiersAlerte = a => M.uniq((String(a.message || '') + ' ' + JSON.stringify((a.link && a.link.params) || {})).match(/\d{6}/g) || []).filter(id => C.dossier(id));
  /* 11/11 (utilisatrice) : « Acquitter » devient « Archiver ». Deux onglets en tête de page, Ouvertes et Archivées (plus de filtre
     « État ») ; une alerte archivée par erreur se restaure. La date et l'auteur de l'archivage sont gardés (M.data.ackInfo, à côté de
     M.data.ack, la liste des alertes archivées lue par C.alertes). ?vue=archivees ouvre l'onglet Archivées. */
  let vue = 'ouvertes', vueSeq = -1;
  const quiAgit = () => { const r = M.ROLES && M.ROLES.find(x => x.id === M.state.role); return r ? r.label : ''; };
  const infos = () => (M.data.ackInfo = M.data.ackInfo || new Map());
  const archiver = liste => {
    liste.forEach(a => { M.data.ack.add(a.key); infos().set(a.key, { date: new Date(), user: quiAgit() }); });
    M.journal(liste.length === 1 ? liste[0].key : 'alertes', liste.length === 1 ? 'Alerte archivée : ' + liste[0].titre : liste.length + ' alerte(s) archivée(s)');
    ui.toast(liste.length + ' alerte(s) archivée(s) : elles restent dans l’onglet « Archivées », d’où on peut les restaurer.', 'good');
    M.refresh();
  };
  const restaurer = liste => {
    liste.forEach(a => { M.data.ack.delete(a.key); infos().delete(a.key); });
    M.journal(liste.length === 1 ? liste[0].key : 'alertes', liste.length === 1 ? 'Alerte restaurée : ' + liste[0].titre : liste.length + ' alerte(s) restaurée(s)');
    ui.toast(liste.length + ' alerte(s) remise(s) dans les alertes ouvertes.', 'good');
    M.refresh();
  };

  M.screen({
    id: 'alertes', title: 'Alertes', icon: '🔔', nav: 'Alertes',
    needs: ['PP-03', 'PP-08', 'PP-09', 'REC-16', 'SCR-08', 'REU-04', 'REU-03', 'CIB-05', 'CIB-03', 'FIX-07', 'BC-03', 'PROC-02', 'ERG-05', 'ERG-06', 'ERG-08'],
    asis: ['Mails manuels « Go » et alertes par Excel (S12, S49, S69)', 'Aucune alerte quand un dossier arrive après la préparation du fixe (S15 « refresh »)', 'Pas d’alerte en cas de DM sur un fichier scro validé (S71)'],
    badge: () => { const a = C.alertesOuvertes(); return { n: a.length, title: a.length + ' alerte(s) ouverte(s)' }; },
    render(root, params) {
      // Filtres, dans le tableau : N° de dossier, Départ (les alertes sans semaine restent), Type (liste à cocher, avec compteur) ;
      // Site par « + Filtre ». Plus de gravité (04/11). Ouvertes / Archivées : les deux onglets au-dessus (11/11).
      if (params.vue && vueSeq !== M.navSeq) { vueSeq = M.navSeq; vue = params.vue === 'archivees' ? 'archivees' : 'ouvertes'; }
      const tout = C.alertes(), arch = vue === 'archivees';
      const nOuv = tout.filter(a => !a.acquittee).length, nArch = tout.length - nOuv;
      const base = tout.filter(a => !!a.acquittee === arch);
      const archInfo = a => infos().get(a.key);
      // Un lien peut poser le type (?type=ECART) : une fois par arrivée, le filtre reste ensuite libre
      const F = ui.filters({ id: arch ? 'alertes-archivees' : 'alertes', rows: base, preset: params.type ? { type: [params.type] } : null, defs: [
        ui.dossierFilter(base, dossiersAlerte),
        Object.assign(ui.weekFilter([M.state.semaine, M.state.semaine + 1], a => a.semaine), { matchEmpty: true, help: 'Semaines de départ ; les alertes sans semaine (orphelines, purge) restent affichées' }),
        { key: 'type', label: 'Type', options: Object.entries(TYPES).map(([v, l]) => ({ value: v, label: l })), get: a => a.type },
        { key: 'site', label: 'Site', more: true, matchEmpty: true, options: M.ref.sites.map(s => ({ value: s.id, label: s.label })), get: a => a.site },
      ] });
      // Ordre : ouvertes par échéance ou date, la plus ancienne en tête ; archivées, la dernière archivée en tête
      const t = a => (a.date ? a.date.getTime() : 0), tA = a => (archInfo(a) ? archInfo(a).date.getTime() : 0);
      const rows = F.apply(base).sort(arch ? (a, b) => tA(b) - tA(a) : (a, b) => t(a) - t(b));
      // Onglet choisi : plein et marqué « ✓ » (pas seulement une couleur) ; l'autre en contour
      const onglet = (v, label, n, icon) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(vue === v), class: ['btn', vue === v ? 'btn-dark' : 'btn-outline-secondary'],
        style: { fontWeight: 600, minWidth: '170px' }, onclick: () => { vue = v; M.refresh(); } }, ui.icon(icon), (vue === v ? '✓ ' : '') + label + ' (' + n + ')');

      root.append(
        ui.pageHead({ crumb: 'Pilotage', title: 'Alertes', sub: 'Les exceptions remplacent les mails et les pointages Excel. Chaque alerte vient d’une règle paramétrable (seuil, destinataires, mail ou non) : voir Administration › Paramétrage › Alertes et mails.', screen: 'alertes',
          actions: ui.btn('Règles et destinataires', () => M.go('parametrage', { tab: 'alertes' })) }),
        h('div', { role: 'tablist', 'aria-label': 'Alertes ouvertes ou archivées', class: 'row', style: { gap: '8px', marginBottom: '12px' } },
          onglet('ouvertes', 'Ouvertes', nOuv, 'bell'), onglet('archivees', 'Archivées', nArch, 'inbox'),
          h('span', { class: 'small muted', style: { alignSelf: 'center' } }, arch ? 'Une alerte archivée par erreur : « Restaurer » la remet dans les ouvertes.' : '« Archiver » range l’alerte dans l’onglet Archivées, d’où on peut la restaurer.')),
        F.bar,
        ui.card({ flush: true, body: ui.table({
          id: arch ? 'alertes-archivees' : 'alertes', rows, rowKey: a => a.key, exportName: arch ? 'alertes-archivees.csv' : 'alertes.csv', selectable: true,
          empty: arch ? 'Aucune alerte archivée avec ces filtres.' : 'Aucune alerte ouverte avec ces filtres.',
          bulkActions: (sel, clear) => [arch
            ? ui.btn('Restaurer (' + sel.length + ')', () => { restaurer(sel); clear(); }, { small: true, icon: 'arrow-back-up' })
            : ui.btn('Archiver (' + sel.length + ')', () => { archiver(sel); clear(); }, { small: true, icon: 'inbox' })],
          columns: [
            { key: 'type', label: 'Type', hidden: true, render: a => TYPES[a.type] || a.type },
            { key: 'titre', label: 'Alerte', wrap: true, render: a => h('div', null, h('b', null, a.titre), h('div', { class: 'small muted', style: { maxWidth: '640px' } }, a.message)) },
            { key: 'site', label: 'Site', render: a => a.site ? C.site(a.site).label : '—' },
            { key: 'semaine', label: 'Départ', render: a => a.semaine ? 'S' + a.semaine : '—' },
            { key: 'date', label: 'Échéance / date', render: a => M.fmt.dt(a.date), value: a => a.date ? a.date.getTime() : 0 },
            arch ? { key: 'archivee', label: 'Archivée le', render: a => archInfo(a) ? M.fmt.dt(archInfo(a).date) + (archInfo(a).user ? ' · ' + archInfo(a).user : '') : '—', value: tA, csv: a => archInfo(a) ? M.fmt.dt(archInfo(a).date) + ' ' + (archInfo(a).user || '') : '' } : null,
            { key: 'needs', label: 'Besoins', sortable: false, render: a => ui.chips(a.needs), csv: a => (a.needs || []).join(' ') },
          ].filter(Boolean),
          // « Ouvrir » plein (aller voir) ; « Archiver » ou « Restaurer » en contour, à l'écart, avec son icône
          rowActions: a => h('span', { class: 'row nowrap', style: { gap: '14px', flexWrap: 'nowrap' } },
            a.link ? ui.btn('Ouvrir', () => M.go(a.link.screen, a.link.params), { small: true, primary: !arch, ghost: arch, icon: 'external-link', title: 'Aller à l’écran concerné' }) : null,
            arch ? ui.btn('Restaurer', () => restaurer([a]), { small: true, icon: 'arrow-back-up', title: 'Remettre l’alerte dans les alertes ouvertes' })
              : ui.btn('Archiver', () => archiver([a]), { small: true, ghost: true, icon: 'inbox', title: 'Ranger l’alerte dans l’onglet Archivées (on peut la restaurer)' })),
        }) }));
    },
  });
})();
