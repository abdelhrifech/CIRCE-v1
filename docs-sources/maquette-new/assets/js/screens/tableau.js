/* Tableau de bord de la pré-production (Pilotage, 04/11) : des carrés que chacun choisit et range, sur le modèle d'un « H-Board »
   montré par l'utilisatrice. Trois sortes de carrés :
   - Compteurs : une liste de libellés et leur nombre (un clic ouvre la page où agir) ; on choisit les compteurs affichés ;
   - Liste : un tableau, dont le contenu se choisit dans la liste déroulante en tête du carré ;
   - Notes : un texte libre de 500 caractères.
   On ajoute, retire, agrandit et déplace les carrés (glisser-déposer) ; la disposition est gardée sur le poste (localStorage).
   Contenus proposés, d'après la demande de la pré-production : réceptions sans IP, quantité non conforme, échéance S-2, J-3,
   validation admin à confirmer, Instruction OK en cours, réceptions inconnues, thèmes à vérifier. */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const CLE = 'circe-maquette-tableau';
  const JOUR = 864e5;
  const dansSite = x => M.state.site === 'ALL' || x.site === M.state.site;
  /** Dossiers du périmètre, pas annulés, de la semaine en cours et des suivantes. */
  const dossiers = () => M.data.dossiers.filter(d => M.inScope(d, { allWeeks: true }) && d.statutPP !== 'ANNULE' && d.semaine >= M.state.semaine);
  const doss = a => C.dossierOfAffiche(a) || {};
  const echeance = d => M.fmt.day(M.deadlinePP(d.semaine)) + ' 16h';
  const lienDossier = d => C.lienDossier(d);
  /** Dossiers d'une affiche (un visuel peut servir plusieurs dossiers) ; aucun pour une réception inconnue. */
  const dosAff = a => { const l = C.dossiersOfAffiche(a).map(C.dossier).filter(Boolean); return l.length ? l : [doss(a)].filter(d => d.id); };
  /** Contexte de filtre d'une ligne (09/11) : les valeurs que les filtres du haut de page lisent, quelle que soit la sorte de ligne
      (affiche, dossier, groupe de thèmes). */
  const ctxD = ds => ({ dossier: ds.map(d => d.id), semaine: M.uniq(ds.flatMap(d => d.semaines)), annonceur: M.uniq(ds.map(d => d.annonceur)),
    atelier: M.uniq(ds.map(d => d.atelier)), format: M.uniq(ds.map(d => d.format)) });

  /** Contenus d'un carré : libellé, lignes, page où agir (go), colonnes de la liste [titre, valeur], lien d'une ligne,
      ctx = contexte de filtre d'une ligne (voir ctxD). */
  const SOURCES = {
    sansIP: { label: 'Réceptions sans IP', go: ['alertes', { type: 'SANS_IP' }], ctx: a => ctxD(dosAff(a)),
      rows: () => M.data.affiches.filter(a => dansSite(a) && a.statut !== 'ORPHELINE' && doss(a).ipSaisies === false),
      cols: [['N° affiche', a => a.id], ['Dossier', a => doss(a).id], ['Annonceur', a => doss(a).annonceur], ['Reçue le', a => M.fmt.dt(a.date)]],
      lien: a => ({ screen: 'reception', params: { tab: 'affiches', q: a.id } }) },
    nonConforme: { label: 'Quantité non conforme', title: 'Quantité Broadcast différente de celle de Circé après l’envoi de la préparation', go: ['alertes', { type: 'ECART_BC' }], ctx: d => ctxD([d]),
      rows: () => M.data.dossiers.filter(d => M.inScope(d, { allWeeks: true }) && d.qteBCInfo),
      cols: [['Dossier', d => d.id], ['Annonceur', d => d.annonceur], ['Broadcast', d => d.qteBCInfo.bc], ['Circé', d => d.qteBCInfo.circe]],
      lien: d => lienDossier(d) },
    echeance: { label: 'Échéance S-2 dépassée', title: 'Préparation pas encore envoyée par la Pré-Prod, échéance passée (deadline de la maquette : jeudi S-2 16h)', go: ['alertes', { type: 'IP_MANQUANTES' }], ctx: d => ctxD([d]),
      rows: () => dossiers().filter(d => d.statutPP === 'A_TRAITER' && M.NOW > M.deadlinePP(d.semaine)),
      cols: [['Dossier', d => d.id], ['Annonceur', d => d.annonceur], ['Départ', d => 'S' + d.semaine], ['Échéance', echeance]],
      lien: d => lienDossier(d) },
    j3: { label: 'Échéance à J-3', title: 'Préparation pas encore envoyée, échéance dans les 3 jours', go: ['alertes', { type: 'IP_MANQUANTES' }], ctx: d => ctxD([d]),
      rows: () => dossiers().filter(d => { const r = M.deadlinePP(d.semaine) - M.NOW; return d.statutPP === 'A_TRAITER' && r > 0 && r <= 3 * JOUR; }),
      cols: [['Dossier', d => d.id], ['Annonceur', d => d.annonceur], ['IP', d => (d.ipSaisies ? 'saisies' : 'à saisir')], ['Échéance', echeance]],
      lien: d => lienDossier(d) },
    va: { label: 'Validation admin à confirmer', go: ['reception', { tab: 'affiches', va: 'PROPOSEE,A_FAIRE' }], ctx: a => ctxD(dosAff(a)),
      rows: () => M.data.affiches.filter(a => dansSite(a) && ['PROPOSEE', 'A_FAIRE'].includes(C.vaEtat(a))),
      cols: [['N° affiche', a => a.id], ['Dossier', a => C.dossiersOfAffiche(a).join(', ')], ['Thème', a => a.libelleSaisi], ['Doute', a => (C.vaEtat(a) === 'A_FAIRE' ? 'oui' : '')]],
      lien: a => ({ screen: 'reception', params: { tab: 'affiches', va: C.vaEtat(a), q: a.id } }) },
    iok: { label: 'Instruction OK en cours', title: 'Déroulant : commentaire de prépa, ou nombre d’exceptions différent de la quantité', go: ['instructions', { pour: 'deroulant', iok: 'A_FAIRE' }], ctx: d => ctxD([d]),
      rows: () => M.data.dossiers.filter(d => M.inScope(d, { allWeeks: true }) && C.instrOK(d) === 'A_FAIRE'),
      cols: [['Dossier', d => d.id], ['Annonceur', d => d.annonceur], ['Départ', d => 'S' + d.semaine], ['Motif', d => (C.instrOKMotifs(d).includes('commentaire') ? 'commentaire' : 'exceptions ≠ quantité')]],
      lien: d => lienDossier(d) },
    // Une réception inconnue n'a pas de dossier : seul le filtre Départ la laisse passer (voir matchEmpty), les autres la masquent
    inconnues: { label: 'Réceptions inconnues', go: ['identification', {}], ctx: () => ctxD([]),
      rows: () => M.data.affiches.filter(a => dansSite(a) && a.statut === 'ORPHELINE'),
      cols: [['N° affiche', a => a.id], ['Lu sur l’affiche', a => (a.annonceurSaisi || '') + ' / ' + (a.libelleSaisi || '')], ['Reçue le', a => M.fmt.dt(a.date)]],
      lien: a => ({ screen: 'identification', params: { id: a.id } }) },
    themes: { label: 'Thèmes à vérifier', go: ['themes', {}], ctx: g => ctxD(g.dossiers.map(C.dossier).filter(Boolean)),
      rows: () => C.themesAVerifier(),
      cols: [['Annonceur', g => g.annonceur], ['Intitulés', g => g.libelles.join(' / ')], ['Dossiers', g => g.dossiers.join(', ')]],
      lien: g => ({ screen: 'themes', params: { dossier: g.dossiers[0] } }) },
  };
  const DEFAUT = () => [
    { id: 'c1', type: 'compteurs', items: ['sansIP', 'nonConforme', 'echeance', 'j3', 'va', 'iok'] },
    // Carré « Alertes » (09/11, demande de l'utilisatrice) : les alertes ouvertes de Pilotage › Alertes, filtrées comme les autres carrés
    { id: 'c5', type: 'alertes' },
    { id: 'c2', type: 'liste', source: 'sansIP' },
    { id: 'c3', type: 'liste', source: 'echeance' },
    { id: 'c4', type: 'notes', texte: '' },
  ];
  /** Dossiers cités par une alerte (message ou lien), comme dans Pilotage › Alertes. */
  const dossiersAlerte = a => M.uniq((String(a.message || '') + ' ' + JSON.stringify((a.link && a.link.params) || {})).match(/\d{6}/g) || []).filter(id => C.dossier(id)).map(C.dossier);
  const lignesAlertes = () => C.alertesOuvertes().map(a => ({ r: a, c: ctxD(dossiersAlerte(a)) }));
  const lire = () => { try { const t = JSON.parse(localStorage.getItem(CLE)); if (Array.isArray(t)) return t.filter(w => w && w.type); } catch (e) { /* rien de gardé */ } return DEFAUT(); };
  const garder = t => { try { localStorage.setItem(CLE, JSON.stringify(t)); } catch (e) { /* stockage indisponible : la disposition vaut pour la session */ } };
  let carres = null;
  /* Filtres du haut de page (09/11) : ils s'appliquent à tous les carrés, compteurs comme listes. Chaque ligne passe avec son
     contexte (SOURCES[…].ctx) ; les « go » des compteurs ouvrent la page complète, avec ses propres filtres. */
  let F = null;
  const lignes = s => s.rows().map(r => ({ r, c: s.ctx(r) }));
  const vis = s => F.apply(lignes(s)).map(x => x.r);
  const changer = () => { garder(carres); M.refresh(); };
  const nouvelId = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e3);
  const TITRES = { compteurs: 'Mes compteurs', liste: 'Liste', notes: 'Mes notes', alertes: 'Alertes' };
  const ICONES = { compteurs: 'gauge', liste: 'table', notes: 'pencil', alertes: 'bell' };

  /** Menu ⋮ d'un carré : contenu, taille, retrait. */
  function menuCarre(btn, w) {
    const menu = ui.menuAt(btn, 230);
    const close = ui.popup(menu);
    const item = (label, fn) => h('button', { type: 'button', class: 'dropdown-item', onclick: () => { close(); fn(); } }, label);
    M.mount(menu,
      w.type === 'compteurs' ? item('Choisir les compteurs…', () => choisirCompteurs(w)) : null,
      item(w.large ? 'Réduire' : 'Agrandir', () => { w.large = !w.large; changer(); }),
      item('Retirer ce carré', () => { carres = carres.filter(x => x !== w); changer(); }));
  }
  function choisirCompteurs(w) {
    const choix = new Set(w.items || []);
    ui.modal({ title: 'Choisir les compteurs', body: [
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Cochez ce que ce carré doit compter. Un clic sur un nombre ouvre la page où agir.'),
      h('div', { class: 'stack', style: { gap: '4px' } }, Object.entries(SOURCES).map(([k, s]) => ui.checkbox(s.label, choix.has(k), v => { if (v) choix.add(k); else choix.delete(k); }))),
    ], actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { w.items = Object.keys(SOURCES).filter(k => choix.has(k)); changer(); } }] });
  }
  function ajouter(btn) {
    const menu = ui.menuAt(btn, 240);
    const close = ui.popup(menu);
    const item = (label, w) => h('button', { type: 'button', class: 'dropdown-item', onclick: () => { close(); carres.push(Object.assign({ id: nouvelId() }, w)); changer(); } }, label);
    M.mount(menu, item('Compteurs', { type: 'compteurs', items: ['sansIP', 'nonConforme', 'echeance', 'j3'] }), item('Liste', { type: 'liste', source: 'va' }), item('Alertes', { type: 'alertes' }), item('Notes', { type: 'notes', texte: '' }));
  }

  function corps(w) {
    if (w.type === 'alertes') {
      // Les alertes ouvertes, filtrées par les filtres du haut (une alerte sans dossier passe le filtre Départ : matchEmpty) ; la plus ancienne en tête
      const rows = F.apply(lignesAlertes()).map(x => x.r).sort((a, b) => (a.date ? a.date.getTime() : 0) - (b.date ? b.date.getTime() : 0));
      const max = w.large ? 12 : 6, vues = rows.slice(0, max);
      return h('div', null,
        h('div', { class: 'cz-board-list' }, rows.length ? h('table', { class: 'dt' }, h('tbody', null, vues.map(a => h('tr', { class: 'cz-click', title: a.link ? 'Ouvrir la page où agir' : 'Ouvrir les alertes', onclick: () => (a.link ? M.go(a.link.screen, a.link.params) : M.go('alertes', { type: a.type })) },
          h('td', { style: { width: '1%', whiteSpace: 'nowrap' } }, ui.sev(a.sev === 'critical' ? 'critical' : a.sev === 'serious' ? 'serious' : 'warning', M.ALERT_TYPES && M.ALERT_TYPES[a.type] ? M.ALERT_TYPES[a.type] : a.type)),
          h('td', null, h('b', null, a.titre), h('div', { class: 'small muted' }, a.message)),
          h('td', { style: { width: '1%', whiteSpace: 'nowrap' } }, a.semaine ? 'S' + a.semaine : '')))))
          : h('div', { class: 'dt-empty' }, 'Aucune alerte ouverte avec ces filtres.')),
        h('div', { class: 'row', style: { marginTop: '6px', alignItems: 'center' } }, h('span', { class: 'small muted' }, rows.length + ' alerte(s) ouverte(s)' + (rows.length > max ? ', ' + max + ' affichée(s)' : '')), h('span', { class: 'spacer' }),
          ui.btn('Toutes les alertes', () => M.go('alertes', {}), { small: true, ghost: true, icon: 'bell' })));
    }
    if (w.type === 'compteurs') {
      const items = (w.items || []).filter(k => SOURCES[k]);
      if (!items.length) return h('div', { class: 'dt-empty' }, 'Aucun compteur : ⋮ › Choisir les compteurs.');
      return h('div', { class: 'cz-board-counts' }, items.map(k => {
        const s = SOURCES[k], n = vis(s).length;
        return h('div', { class: 'cz-board-count', title: s.title || null }, h('span', null, s.label),
          h('button', { type: 'button', class: 'cz-board-val', title: 'Ouvrir : ' + s.label, onclick: () => M.go(s.go[0], s.go[1]) }, String(n)));
      }));
    }
    if (w.type === 'liste') {
      const s = SOURCES[w.source] || SOURCES.sansIP;
      const rows = vis(s);
      return h('div', null,
        ui.select({ value: w.source, label: 'Contenu de la liste', options: Object.entries(SOURCES).map(([k, x]) => ({ value: k, label: x.label })), onChange: v => { w.source = v; changer(); } }),
        h('div', { class: 'cz-board-list' }, rows.length ? h('table', { class: 'dt' },
          h('thead', null, h('tr', null, s.cols.map(([t]) => h('th', null, t)))),
          h('tbody', null, rows.map(r => h('tr', { class: 'cz-click', title: 'Ouvrir', onclick: () => { const l = s.lien(r); M.go(l.screen, l.params); } }, s.cols.map(([, f]) => h('td', null, String(f(r) === undefined || f(r) === null ? '' : f(r))))))))
          : h('div', { class: 'dt-empty' }, 'Rien à signaler.')),
        h('div', { class: 'small muted', style: { marginTop: '6px' } }, rows.length + ' ligne(s)'));
    }
    // Notes : gardées à la frappe, sans redessiner la page
    const compte = h('div', { class: 'small muted', style: { textAlign: 'right' } }, (w.texte || '').length + ' / 500');
    return h('div', null, compte, h('textarea', { class: 'cz-board-notes', maxlength: '500', placeholder: 'Saisissez vos notes ici', 'aria-label': 'Notes',
      oninput: e => { w.texte = e.target.value; compte.textContent = w.texte.length + ' / 500'; garder(carres); } }, w.texte || ''));
  }

  let glisse = null; // carré déplacé
  function carre(w) {
    const titre = w.type === 'liste' ? (SOURCES[w.source] || SOURCES.sansIP).label : TITRES[w.type];
    const btn = h('button', { type: 'button', class: 'btn btn-sm btn-ghost-secondary cz-board-menu', title: 'Options du carré', 'aria-label': 'Options du carré', onclick: e => { e.stopPropagation(); menuCarre(btn, w); } }, ui.icon('dots-vertical'));
    return h('section', { class: ['card', 'cz-board-card', 'cz-board-' + w.type, w.large ? 'large' : ''], 'data-id': w.id,
      ondragover: e => { if (glisse && glisse !== w) { e.preventDefault(); e.currentTarget.classList.add('cz-drop'); } },
      ondragleave: e => e.currentTarget.classList.remove('cz-drop'),
      ondrop: e => { e.preventDefault(); if (!glisse || glisse === w) return; carres = carres.filter(x => x !== glisse); carres.splice(carres.indexOf(w), 0, glisse); glisse = null; changer(); } },
      // L'en-tête sert de poignée : on glisse le carré sur un autre pour le placer devant lui
      h('div', { class: 'card-header cz-board-head', draggable: 'true', title: 'Glisser pour déplacer le carré',
        ondragstart: e => { glisse = w; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', w.id); } catch (x) { /* navigateur ancien */ } },
        ondragend: () => { glisse = null; } },
        ui.icon(ICONES[w.type]), h('h2', { class: 'card-title' }, titre), btn),
      h('div', { class: 'card-body' }, corps(w)));
  }

  M.screen({
    id: 'tableau', title: 'Tableau de bord pré-production', icon: '▦', nav: 'Tableau de bord pré-production', roles: ['coord', 'admin'],
    needs: ['PP-03', 'REC-16', 'BC-03', 'PP-10', 'SCR-11', 'PP-08', 'REC-17'],
    asis: ['Pas de tableau de bord pour la pré-production : les points à suivre (prépa non reçue, réceptions sans IP, écarts) sont cherchés écran par écran ou dans des Excel'],
    render(root) {
      if (!carres) carres = lire();
      const tout = [].concat(...Object.values(SOURCES).map(lignes));
      const opts = (vals, lab) => M.uniq(vals).sort((a, b) => String(a).localeCompare(String(b), 'fr')).map(v => ({ value: v, label: lab ? lab(v) : v }));
      F = ui.filters({ id: 'tableau', rows: tout, defs: [
        ui.dossierFilter(tout, x => x.c.dossier),
        // Toutes les semaines au départ (les chiffres restent ceux d'avant) ; une réception inconnue, sans dossier ni semaine, reste affichée
        Object.assign(ui.weekFilter([], x => x.c.semaine), { matchEmpty: true, help: 'Semaines de départ ; les réceptions inconnues (sans dossier) restent affichées' }),
        { key: 'annonceur', label: 'Annonceur', options: opts(tout.flatMap(x => x.c.annonceur)), get: x => x.c.annonceur },
        { key: 'atelier', label: 'Atelier', options: M.ref.ateliers.filter(a => M.state.site === 'ALL' || a.site === M.state.site).map(a => ({ value: a.id, label: ui.withSite(a.label, a.site) })), get: x => x.c.atelier },
        { key: 'format', label: 'Format', more: true, options: opts(tout.flatMap(x => x.c.format)), get: x => x.c.format },
      ] });
      root.append(
        ui.pageHead({ crumb: 'Pilotage', title: 'Tableau de bord pré-production', screen: 'tableau',
          actions: [ui.btn('Ajouter un carré', e => ajouter(e.currentTarget), { icon: 'plus' }),
            ui.btn('Disposition par défaut', () => { carres = DEFAUT(); changer(); }, { ghost: true, icon: 'refresh', title: 'Revenir aux carrés proposés au départ (vos notes sont effacées)' })] }),
        F.bar,
        carres.length ? h('div', { class: 'cz-board' }, carres.map(carre)) : h('div', { class: 'dt-empty' }, 'Aucun carré : « Ajouter un carré ».'));
    },
  });
})();
