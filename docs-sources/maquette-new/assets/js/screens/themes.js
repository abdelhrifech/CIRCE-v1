/* Vérification des thèmes, deux cas :
   1. thèmes proches entre dossiers, dès la saisie des IP (PP-08) : Circé ne modifie pas Broadcast, la Coordination demande à la Pré-Prod
      la correction (et rend la main si la préparation est déjà envoyée), Broadcast envoie la préparation corrigée.
      L'écran reste dans Circé ; RP30 #2 le demande dans Broadcast : à confirmer en atelier (Q19) ;
   2. thème modifié dans Broadcast après Instruction OK et validation admin (PP-09) : Circé compare son thème à celui de
      Broadcast, lève une alerte et propose de reprendre la version Broadcast. */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const user = () => M.ROLES.find(r => r.id === M.state.role).label;
  const VUES = { proches: 'Thèmes proches entre dossiers', annonceurs: 'Annonceurs proches', bc: 'Thèmes modifiés dans Broadcast' };
  /** État d'un groupe de thèmes proches : [libellé, gravité de la pastille]. */
  const ETATS = {
    A_VERIFIER: ['À vérifier', 'warning'],
    DEMANDE: ['Demande envoyée à Broadcast', 'serious'],
    CORRIGE: ['Corrigé par Broadcast', 'good'],
    DIFFERENTS: ['Visuels différents', 'info'],
    MEME: ['Même intitulé', 'info'],
  };
  const etatOf = g => (g.demandes.length ? 'DEMANDE' : g.verif ? g.verif.statut : g.harmoniser ? 'A_VERIFIER' : 'MEME');
  const verifs = () => (M.data.verifThemes = M.data.verifThemes || {});
  const guill = l => '« ' + l + ' »';
  /** Intitulés d'un groupe avec leur nombre de thèmes : « Menu burger » ×2 · « MENU BURGERS ». */
  const intitules = g => Object.entries(M.groupBy(g.themes, t => t.libelle.trim())).map(([l, ts]) => guill(l) + (ts.length > 1 ? ' ×' + ts.length : '')).join(' · ');

  /* ---------- Cas 1 : thèmes proches entre dossiers ---------- */

  /** Demande de correction : la Coordination choisit l'intitulé correct ; Circé envoie un mail au gestionnaire des dossiers
      à corriger (« rendre la main » : un mail, jamais un changement d'état dans Circé). Le groupe disparaît au renvoi de la préparation. */
  function demander(g) {
    const freq = Object.entries(M.groupBy(g.themes, t => t.libelle.trim())).sort((a, b) => b[1].length - a[1].length);
    let ref = freq[0][0], note = '';
    const aCorriger = () => g.themes.filter(t => t.libelle.trim() !== ref).map(t => ({ t, d: C.dossier(t.dossierId) }));
    const body = h('div');
    const draw = () => M.mount(body,
      h('p', { style: { marginTop: 0 } }, 'L’intitulé vient de la préparation envoyée par Broadcast, et Circé ne peut pas modifier Broadcast. Choisissez l’intitulé correct : Circé envoie un mail au gestionnaire des dossiers à corriger, qui corrige dans Broadcast puis renvoie la préparation.'),
      h('div', { class: 'stack', style: { gap: '6px', marginBottom: '12px' } }, freq.map(([l, ts]) => h('label', { class: 'form-check' },
        h('input', { class: 'form-check-input', type: 'radio', name: 'th-ref', checked: ref === l, onchange: () => { ref = l; draw(); } }),
        h('span', { class: 'form-check-label' }, h('b', null, guill(l)), h('span', { class: 'small muted' }, ' · ' + ts.length + ' thème(s), dossier(s) ' + M.uniq(ts.map(t => t.dossierId)).join(', ')))))),
      h('h3', { style: { fontSize: '14px', margin: '0 0 6px' } }, 'À corriger dans Broadcast'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
        h('thead', null, h('tr', null, ['Dossier', 'Atelier', 'Statut pré-production', 'Correction demandée', ''].map(x => h('th', null, x)))),
        h('tbody', null, aCorriger().map(({ t, d }) => h('tr', null,
          h('td', null, d.id), h('td', null, ui.withSite(C.atelier(d.atelier).label, d.site)), h('td', null, ui.pill(C.statutDossier(d))),
          h('td', null, guill(t.libelle) + ' → ', h('b', null, guill(ref))),
          h('td', null, C.prodLancee(d) ? ui.sev('critical', 'Production lancée : à voir avec l’atelier') : d.statutPP === 'A_TRAITER' ? h('span', { class: 'small muted' }, 'prépa pas encore envoyée : à corriger dans les IP') : h('span', { class: 'small muted' }, 'mail au gestionnaire, préparation à renvoyer'))))))),
      ui.field('Message au gestionnaire (facultatif)', ui.input({ value: note, placeholder: 'Précision pour Broadcast', onInput: v => { note = v.trim(); } }), true),
      ui.annot('Aujourd’hui, la main se rend par « Déblocage préparation » (Admin, S47), seulement si la production n’est pas lancée. Cible (19/10) : un mail au gestionnaire ; l’état du dossier ne change pas dans Circé (le sens est toujours de Broadcast vers Circé) ; le groupe reste suivi ici jusqu’au renvoi de la préparation corrigée.', ['PP-08', 'BC-03']));
    draw();
    ui.modal({ title: 'Demander la correction dans Broadcast · ' + g.annonceur, wide: true, body, actions: [
      { label: 'Annuler' },
      { label: 'Envoyer la demande (mail au gestionnaire)', primary: true, onClick: () => {
        const list = aCorriger().filter(x => !C.prodLancee(x.d));
        if (!list.length) { ui.toast('Rien à demander : la production est lancée sur ces dossiers. Voir avec l’atelier.', 'critical'); return true; }
        M.tick(2);
        const dem = M.data.demandesThemes = M.data.demandesThemes || {};
        list.forEach(({ t, d }) => {
          dem[t.id] = { statut: 'ENVOYEE', ref, ancien: t.libelle, date: new Date(M.NOW), user: user(), note };
          const avantEnvoi = d.statutPP === 'A_TRAITER';
          d.historique.push({ date: new Date(M.NOW), user: user(), action: (avantEnvoi ? 'Correction demandée à Broadcast avant l’envoi de la préparation : thème « ' : 'Correction demandée à Broadcast par mail : thème « ') + t.libelle + ' » en « ' + ref + ' »' });
          M.journal(d.id, 'Correction de thème demandée à Broadcast (« ' + t.libelle + ' » → « ' + ref + ' »), mail au gestionnaire');
        });
        M.uniq(list.map(x => x.d.pole)).forEach(pole => {
          const ls = list.filter(x => x.d.pole === pole);
          M.mail({ to: ['Gestionnaires ' + pole + ' (Broadcast)'], subject: '[Circé] Thème à corriger dans Broadcast : ' + g.annonceur + ' (' + ls.map(x => x.d.id).join(', ') + ')',
            body: 'Bonjour,\n\nLa vérification des thèmes signale un même visuel sous des intitulés différents pour ' + g.annonceur + '.\n\n' + ls.map(x => '- Dossier ' + x.d.id + ' : « ' + x.t.libelle + ' » à remplacer par « ' + ref + ' »').join('\n') +
              '\n\nMerci de corriger le thème dans Broadcast, puis de renvoyer la préparation (annule et remplace).' + (note ? '\n\nPrécision : ' + note : ''),
            trigger: 'Vérification des thèmes : correction demandée à Broadcast', needs: ['PP-08'] });
        });
        ui.toast('Demande envoyée pour ' + list.length + ' dossier(s) : mail au gestionnaire. Le groupe disparaîtra au renvoi des préparations corrigées.', 'good');
        M.refresh();
      } },
    ] });
  }
  function differents(g) {
    verifs()[g.key] = { statut: 'DIFFERENTS', date: new Date(M.NOW), user: user() };
    M.journal(g.dossiers.join(', '), 'Thèmes proches vérifiés : visuels différents (' + g.annonceur + ')');
    ui.toast('Noté : ce sont des visuels différents. L’alerte est levée.', 'good');
    M.refresh();
  }
  function rouvrir(g) {
    delete verifs()[g.key];
    M.journal(g.dossiers.join(', '), 'Vérification des thèmes rouverte (' + g.annonceur + ')');
    M.refresh();
  }

  function detailGroupe(g) {
    const etat = etatOf(g);
    const dem = M.data.demandesThemes || {};
    const lignes = g.themes.map(t => ({ t, d: C.dossier(t.dossierId), x: dem[t.id] })).sort((a, b) => a.d.id.localeCompare(b.d.id));
    ui.modal({ title: 'Thèmes proches · ' + g.annonceur, wide: true, body: [
      h('div', { class: 'row', style: { marginBottom: '10px' } }, ui.sev(ETATS[etat][1], ETATS[etat][0]),
        g.verif ? h('span', { class: 'small muted' }, g.verif.user + ', ' + M.fmt.dt(g.verif.date)) : null),
      h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
        h('thead', null, h('tr', null, ['Dossier', 'Atelier', 'Départ', 'Statut pré-production', 'Intitulé', 'Demande', ''].map(x => h('th', null, x)))),
        h('tbody', null, lignes.map(({ t, d, x }) => h('tr', null,
          h('td', null, d.id), h('td', null, ui.withSite(C.atelier(d.atelier).label, d.site)), h('td', null, d.semaines.map(s => 'S' + s).join(' + ')),
          h('td', null, ui.pill(C.statutDossier(d))), h('td', null, ui.btnVisuel(t), h('b', null, t.libelle)),
          h('td', { class: 'small' }, x ? (x.statut === 'ENVOYEE' ? 'Envoyée le ' + M.fmt.dt(x.date) + ' : « ' + x.ref + ' »' : 'Corrigé par Broadcast le ' + M.fmt.dt(x.fait)) : '—'),
          h('td', null, ui.btn('Ouvrir le dossier', () => { const l = C.lienDossier(d); M.go(l.screen, l.params); }, { small: true, ghost: true }))))))),
      ui.annot(etat === 'DEMANDE' ? 'En attente de Broadcast : le gestionnaire corrige le thème et renvoie la préparation. Le groupe disparaît alors de la liste « À vérifier ». Pour la démonstration : Simuler › Broadcast renvoie les préparations corrigées.'
        : g.harmoniser ? 'Intitulés différents pour un visuel probablement identique : demander la correction dans Broadcast, ou confirmer que ce sont des visuels différents.'
          : 'Même intitulé sur plusieurs dossiers : une seule affiche pourra servir ces dossiers (S31).', ['PP-08'])],
      actions: [{ label: 'Fermer' }].concat(etat === 'A_VERIFIER'
        ? [{ label: 'Visuels différents', onClick: () => differents(g) }, { label: 'Demander la correction…', primary: true, onClick: () => { demander(g); } }]
        : etat === 'DIFFERENTS' ? [{ label: 'Rouvrir', onClick: () => rouvrir(g) }] : []) });
  }

  function vueProches(root, params, head) {
    const rows = C.groupesThemes().map(g => {
      const ds = g.dossiers.map(C.dossier);
      return { id: g.key, g, ds, etat: etatOf(g), annonceur: g.annonceur, semaines: M.uniq(ds.flatMap(d => d.semaines)).sort((a, b) => a - b), ateliers: M.uniq(ds.map(d => d.atelier)) };
    });
    // Filtres : N° de dossier, Départ, État (à vérifier par défaut), Annonceur ; Atelier par « + Filtre ».
    // Un lien peut poser le dossier (?dossier=…, depuis une alerte ou une fiche de dossier) : on montre alors tous ses groupes.
    const F = ui.filters({ id: 'themes', rows, preset: params.dossier ? { dossier: [String(params.dossier)], etat: [] } : null, defs: [
      ui.dossierFilter(rows, r => r.g.dossiers),
      ui.weekFilter(M.ref.semaines.map(s => s.num).filter(n => n >= M.state.semaine), r => r.semaines),
      { key: 'etat', label: 'État', default: ['A_VERIFIER'], options: Object.entries(ETATS).map(([v, [l]]) => ({ value: v, label: l })), get: r => r.etat },
      { key: 'annonceur', label: 'Annonceur', options: M.uniq(rows.map(r => r.annonceur)).sort((a, b) => a.localeCompare(b, 'fr')).map(v => ({ value: v, label: v })), get: r => r.annonceur },
      { key: 'atelier', label: 'Atelier', more: true, options: M.ref.ateliers.filter(a => M.state.site === 'ALL' || a.site === M.state.site).map(a => ({ value: a.id, label: ui.withSite(a.label, a.site) })), get: r => r.ateliers },
    ] });
    const parEtat = M.groupBy(F.except(rows, 'etat'), r => r.etat);
    const n = k => (parEtat[k] || []).length;
    const voir = etats => { F.set('etat', etats); M.refresh(); };
    root.append(
      head('Dès la saisie des IP dans Broadcast (les thèmes arrivent dans l’état des réservations), Circé repère les visuels identiques ou proches sur plusieurs dossiers d’un même annonceur, ou d’annonceurs aux noms proches (« Menu burger », « MENU BURGERS »). La Coordination demande la correction à la Pré-Prod, dans Broadcast, ou confirme que ce sont des visuels différents. Le groupe disparaît quand Broadcast envoie la préparation corrigée.'),
      F.bar,
      h('div', { class: 'kpis', style: { marginBottom: '12px' } },
        ui.stat({ label: 'À vérifier', value: n('A_VERIFIER'), sub: 'intitulés différents, même visuel probable', onClick: () => voir(['A_VERIFIER']), title: 'Voir les groupes à vérifier' }),
        ui.stat({ label: 'Demandes envoyées', value: n('DEMANDE'), sub: 'mail envoyé, en attente de Broadcast', onClick: () => voir(['DEMANDE']) }),
        ui.stat({ label: 'Même intitulé', value: n('MEME'), sub: 'une affiche pour plusieurs dossiers (S31)', onClick: () => voir(['MEME']), title: 'Voir les visuels communs à plusieurs dossiers' }),
        ui.stat({ label: 'Déjà traités', value: n('CORRIGE') + n('DIFFERENTS'), sub: 'corrigés par Broadcast ou visuels différents', onClick: () => voir(['CORRIGE', 'DIFFERENTS']) })),
      ui.annot('Règle de l’outil multi-rouleuse (§16.3) : même annonceur regroupé ; intitulés identiques une fois simplifiés (minuscules, sans accents ni ponctuation), l’un contenu dans l’autre, ou similarité ≥ ' + String(M.PARAMS.seuilThemesProches).replace('.', ',') + ' (Administration › Paramétrage › Règles métier). Contrôle fait dès la saisie des IP, donc le plus souvent avant la réception des affiches (RP30 #2), et jusqu’à la validation.', ['PP-08']),
      ui.card({ flush: true, body: ui.table({
        id: 'themes', rows: F.apply(rows), rowKey: r => r.id, exportName: 'themes-a-verifier.csv', onRowClick: r => detailGroupe(r.g),
        tone: r => (r.etat === 'A_VERIFIER' ? 'warning' : r.etat === 'DEMANDE' ? 'info' : r.etat === 'CORRIGE' ? 'good' : null),
        empty: 'Aucun thème proche à vérifier avec ces filtres.',
        columns: [
          { key: 'etat', label: 'État', render: r => ui.sev(ETATS[r.etat][1], ETATS[r.etat][0]), value: r => Object.keys(ETATS).indexOf(r.etat), csv: r => ETATS[r.etat][0] },
          { key: 'annonceur', label: 'Annonceur' },
          // Un bouton par intitulé pour comparer les visuels : « même visuel ? »
          { key: 'intitules', label: 'Intitulés trouvés', wrap: true, maxWidth: 260, value: r => intitules(r.g), render: r => h('span', null, Object.entries(M.groupBy(r.g.themes, t => t.libelle.trim())).map(([l, ts], i) => [i ? ' · ' : null, ui.btnVisuel(ts[0]), guill(l) + (ts.length > 1 ? ' ×' + ts.length : '')])) },
          { key: 'dossiers', label: 'Dossiers', wrap: true, maxWidth: 120, value: r => r.g.dossiers.join(', ') },
          { key: 'ateliers', label: 'Ateliers', hidden: true, wrap: true, maxWidth: 180, value: r => M.uniq(r.ds.map(d => ui.withSite(C.atelier(d.atelier).label, d.site))).join(', ') },
          { key: 'semaines', label: 'Départ', value: r => r.semaines.map(s => 'S' + s).join(' + ') },
          { key: 'statuts', label: 'Pré-production', wrap: true, render: r => h('span', null, M.uniq(r.ds.map(d => C.statutDossier(d))).map(s => ui.pill(s, '(' + r.ds.filter(d => C.statutDossier(d) === s).length + ')'))), value: r => M.uniq(r.ds.map(d => M.STATUTS[C.statutDossier(d)].label)).join(', ') },
        ],
        rowActions: r => (r.etat === 'A_VERIFIER'
          ? [ui.btn('Demander la correction', () => demander(r.g), { small: true, primary: true }), ui.btn('Visuels différents', () => differents(r.g), { small: true, ghost: true })]
          : r.etat === 'DIFFERENTS' ? ui.btn('Rouvrir', () => rouvrir(r.g), { small: true, ghost: true }) : null),
      }) }),
      // 21/10 : la cheffe de projet ne tranche pas, ce sont les Coordinations qui font cette vérification, avec un process
      // différent au fixe et au déroulant (Scro) : questions à leur poser (Q39)
      ui.callout('cible', 'À voir avec les Coordinations (fixe et déroulant)', ' Ce sont elles qui vérifient les thèmes, et le process n’est pas le même au fixe et au déroulant (Scro) : les questions sont à poser pour chacun. Où placer cet écran ? RP30 #2 le demande dans Broadcast ; la maquette le garde dans Circé, qui voit les thèmes dès la saisie des IP, et la correction se fait toujours dans Broadcast (Q19). Compare-t-on les dossiers d’un même annonceur, ou d’annonceurs aux noms proches (règle actuelle, 16/10), ou tous les dossiers ? La demande part par mail au gestionnaire du pôle (simulé dans la boîte « Mails ») : canal à confirmer.'));
  }

  /* ---------- Annonceurs proches (16/10) : même règle que les thèmes, appliquée aux noms d'annonceurs ---------- */
  const ETATS_A = {
    A_VERIFIER: ['À vérifier', 'warning'],
    DEMANDE: ['Demande envoyée à Broadcast', 'serious'],
    CORRIGE: ['Corrigé par Broadcast', 'good'],
    DIFFERENTS: ['Annonceurs différents', 'info'],
  };
  const etatA = g => (g.corrige ? 'CORRIGE' : g.demandes.length ? 'DEMANDE' : g.verif ? g.verif.statut : 'A_VERIFIER');
  const verifsA = () => (M.data.verifAnnonceurs = M.data.verifAnnonceurs || {});

  /** Demande de correction de l'annonceur : la Coordination choisit le bon nom ; Circé demande la correction au gestionnaire et
      lui rend la main si la préparation est envoyée (production pas lancée). Un nom imprimé corrigé par la plateforme (fixe,
      colle) est aligné dans Circé. Pas de règle de regroupement ajoutée par Circé (décision du 16/10). */
  function demanderAnnonceur(g) {
    const freq = Object.entries(M.groupBy(g.membres, x => x.nom)).sort((a, b) => b[1].length - a[1].length);
    let ref = freq[0][0], note = '';
    const aCorriger = () => g.membres.filter(x => x.nom !== ref);
    const body = h('div');
    const ou = x => (x.source === 'Plateforme' ? h('span', { class: 'small muted' }, 'dans Circé (nom imprimé)')
      : C.prodLancee(x.d) ? ui.sev('critical', 'Production lancée : main non rendue')
        : x.d.statutPP === 'A_TRAITER' ? h('span', { class: 'small muted' }, 'Broadcast, avant l’envoi de la prépa') : h('span', { class: 'small muted' }, 'Broadcast : mail envoyé, préparation à renvoyer'));
    const draw = () => M.mount(body,
      h('p', { style: { marginTop: 0 } }, 'Le nom de l’annonceur vient de Broadcast, que Circé ne peut pas modifier. Choisissez le bon nom : Circé demande la correction au gestionnaire, et lui rend la main si la préparation est déjà envoyée.'),
      h('div', { class: 'stack', style: { gap: '6px', marginBottom: '12px' } }, freq.map(([n, xs]) => h('label', { class: 'form-check' },
        h('input', { class: 'form-check-input', type: 'radio', name: 'an-ref', checked: ref === n, onchange: () => { ref = n; draw(); } }),
        h('span', { class: 'form-check-label' }, h('b', null, guill(n)), h('span', { class: 'small muted' }, ' · dossier(s) ' + M.uniq(xs.map(x => x.d.id)).join(', ')))))),
      h('h3', { style: { fontSize: '14px', margin: '0 0 6px' } }, 'À corriger'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
        h('thead', null, h('tr', null, ['Dossier', 'Atelier', 'Statut pré-production', 'Correction demandée', 'Où'].map(x => h('th', null, x)))),
        h('tbody', null, aCorriger().map(x => h('tr', null,
          h('td', null, x.d.id), h('td', null, ui.withSite(C.atelier(x.d.atelier).label, x.d.site)), h('td', null, ui.pill(x.d.statutPP)),
          h('td', null, guill(x.nom) + ' → ', h('b', null, guill(ref))), h('td', null, ou(x))))))),
      ui.field('Message au gestionnaire (facultatif)', ui.input({ value: note, placeholder: 'Précision pour Broadcast', onInput: v => { note = v.trim(); } }), true),
      ui.annot('Même circuit que pour les thèmes : la correction se fait dans Broadcast, et le dossier revient avec la préparation envoyée. Circé n’ajoute pas de règle de regroupement.', ['PP-08', 'BC-03']));
    draw();
    ui.modal({ title: 'Demander la correction de l’annonceur', wide: true, body, actions: [
      { label: 'Annuler' },
      { label: 'Envoyer la demande', primary: true, onClick: () => {
        const bc = aCorriger().filter(x => x.source === 'Broadcast' && !C.prodLancee(x.d)), pf = aCorriger().filter(x => x.source === 'Plateforme');
        if (!bc.length && !pf.length) { ui.toast('Rien à demander : la production est lancée sur ces dossiers. Voir avec l’atelier.', 'critical'); return true; }
        M.tick(2);
        const dem = M.data.demandesAnnonceurs = M.data.demandesAnnonceurs || {};
        bc.forEach(({ d, nom }) => {
          dem[d.id] = { statut: 'ENVOYEE', ref, ancien: nom, date: new Date(M.NOW), user: user(), note };
          const avantEnvoi = d.statutPP === 'A_TRAITER';
          d.historique.push({ date: new Date(M.NOW), user: user(), action: (avantEnvoi ? 'Correction demandée à Broadcast avant l’envoi de la préparation : annonceur « ' : 'Correction demandée à Broadcast par mail : annonceur « ') + nom + ' » en « ' + ref + ' »' });
          M.journal(d.id, 'Correction d’annonceur demandée à Broadcast (« ' + nom + ' » → « ' + ref + ' »)');
        });
        pf.forEach(({ d, t }) => {
          if (ref === d.annonceur) delete t.annonceurImprime; else t.annonceurImprime = ref;
          d.historique.push({ date: new Date(M.NOW), user: user(), action: 'Annonceur imprimé aligné sur « ' + ref + ' »' });
        });
        M.uniq(bc.map(x => x.d.pole)).forEach(pole => {
          const ls = bc.filter(x => x.d.pole === pole);
          M.mail({ to: ['Gestionnaires ' + pole + ' (Broadcast)'], subject: '[Circé] Annonceur à corriger dans Broadcast : « ' + ref + ' » (' + ls.map(x => x.d.id).join(', ') + ')',
            body: 'Bonjour,\n\nLa vérification des annonceurs signale un même annonceur sous des noms différents.\n\n' + ls.map(x => '- Dossier ' + x.d.id + ' : « ' + x.nom + ' » à remplacer par « ' + ref + ' »').join('\n') +
              '\n\nMerci de corriger l’annonceur dans Broadcast, puis de renvoyer la préparation (annule et remplace).' + (note ? '\n\nPrécision : ' + note : ''),
            trigger: 'Vérification des annonceurs : correction demandée à Broadcast', needs: ['PP-08'] });
        });
        ui.toast('Demande envoyée pour ' + bc.length + ' dossier(s)' + (pf.length ? ' ; ' + pf.length + ' nom(s) imprimé(s) aligné(s)' : '') + '. Le groupe disparaîtra au renvoi des préparations corrigées.', 'good');
        M.refresh();
      } },
    ] });
  }
  function differentsA(g) {
    verifsA()[g.key] = { statut: 'DIFFERENTS', date: new Date(M.NOW), user: user(), libelles: g.libelles, dossiers: g.dossiers };
    M.journal(g.dossiers.join(', '), 'Annonceurs proches vérifiés : annonceurs différents (' + g.libelles.join(' / ') + ')');
    ui.toast('Noté : ce sont des annonceurs différents. Leurs thèmes ne sont plus comparés entre eux.', 'good');
    M.refresh();
  }
  function rouvrirA(g) {
    delete verifsA()[g.key];
    M.journal(g.dossiers.join(', '), 'Vérification des annonceurs rouverte (' + g.libelles.join(' / ') + ')');
    M.refresh();
  }
  function detailAnnonceurs(g) {
    const etat = etatA(g), dem = M.data.demandesAnnonceurs || {};
    ui.modal({ title: 'Annonceurs proches · ' + g.libelles.join(' / '), wide: true, body: [
      h('div', { class: 'row', style: { marginBottom: '10px' } }, ui.sev(ETATS_A[etat][1], ETATS_A[etat][0]), g.verif ? h('span', { class: 'small muted' }, g.verif.user + ', ' + M.fmt.dt(g.verif.date)) : null),
      g.membres.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
        h('thead', null, h('tr', null, ['Dossier', 'Atelier', 'Départ', 'Statut pré-production', 'Nom', 'Origine', 'Demande'].map(x => h('th', null, x)))),
        h('tbody', null, g.membres.map(x => h('tr', null,
          h('td', null, x.d.id), h('td', null, ui.withSite(C.atelier(x.d.atelier).label, x.d.site)), h('td', null, x.d.semaines.map(s => 'S' + s).join(' + ')),
          h('td', null, ui.pill(x.d.statutPP)), h('td', null, h('b', null, x.nom)), h('td', null, x.source === 'Plateforme' ? 'Corrigé par la plateforme' : 'Broadcast'),
          h('td', { class: 'small' }, dem[x.d.id] && dem[x.d.id].statut === 'ENVOYEE' ? 'Envoyée le ' + M.fmt.dt(dem[x.d.id].date) + ' : « ' + dem[x.d.id].ref + ' »' : '—')))))) : h('p', { class: 'muted' }, 'Corrigé : les dossiers ' + g.dossiers.join(', ') + ' ont maintenant le même nom.'),
      ui.annot(etat === 'A_VERIFIER' ? 'Même annonceur sous des noms différents ? Demander la correction dans Broadcast, ou noter que ce sont des annonceurs différents. En attendant, leurs thèmes sont comparés entre eux.' : etat === 'DEMANDE' ? 'En attente de Broadcast : le gestionnaire corrige l’annonceur et envoie la préparation. Pour la démonstration : Simuler › Broadcast renvoie les préparations corrigées.' : 'Groupe traité.', ['PP-08'])],
      actions: [{ label: 'Fermer' }].concat(etat === 'A_VERIFIER' ? [{ label: 'Annonceurs différents', onClick: () => differentsA(g) }, { label: 'Demander la correction…', primary: true, onClick: () => { setTimeout(() => demanderAnnonceur(g), 0); } }]
        : etat === 'DIFFERENTS' ? [{ label: 'Rouvrir', onClick: () => rouvrirA(g) }] : []) });
  }

  function vueAnnonceurs(root, params, head) {
    const rows = C.groupesAnnonceurs().map(g => { const ds = g.dossiers.map(C.dossier).filter(Boolean); return { id: g.key, g, ds, etat: etatA(g), semaines: M.uniq(ds.flatMap(d => d.semaines)).sort((a, b) => a - b) }; });
    // Filtres : N° de dossier, Départ, État (à vérifier par défaut). Un lien peut poser le dossier (?dossier=…, depuis une alerte)
    const F = ui.filters({ id: 'annonceurs', rows, preset: params.dossier ? { dossier: [String(params.dossier)], etat: [] } : null, defs: [
      ui.dossierFilter(rows, r => r.g.dossiers),
      ui.weekFilter(M.ref.semaines.map(s => s.num).filter(n => n >= M.state.semaine), r => r.semaines),
      { key: 'etat', label: 'État', default: ['A_VERIFIER'], options: Object.entries(ETATS_A).map(([v, [l]]) => ({ value: v, label: l })), get: r => r.etat },
    ] });
    const parEtat = M.groupBy(F.except(rows, 'etat'), r => r.etat);
    const n = k => (parEtat[k] || []).length;
    const voir = etats => { F.set('etat', etats); M.refresh(); };
    root.append(
      head('Les noms d’annonceurs proches sur plusieurs dossiers (« Brasserie du Port », « BRASSERIE PORT »), repérés avec la même règle que les thèmes, dès la DA activée. Le nom vient de Broadcast : la Coordination demande la correction à la Pré-Prod, ou note que ce sont des annonceurs différents. Tant que ce n’est pas tranché, les thèmes de ces annonceurs sont comparés entre eux.'),
      F.bar,
      h('div', { class: 'kpis', style: { marginBottom: '12px' } },
        ui.stat({ label: 'À vérifier', value: n('A_VERIFIER'), sub: 'noms différents, même annonceur probable', onClick: () => voir(['A_VERIFIER']) }),
        ui.stat({ label: 'Demandes envoyées', value: n('DEMANDE'), sub: 'en attente de Broadcast', onClick: () => voir(['DEMANDE']) }),
        ui.stat({ label: 'Déjà traités', value: n('CORRIGE') + n('DIFFERENTS'), sub: 'corrigés par Broadcast ou annonceurs différents', onClick: () => voir(['CORRIGE', 'DIFFERENTS']) })),
      ui.annot('Même règle que les thèmes : noms identiques une fois simplifiés (minuscules, sans accents ni ponctuation), l’un contenu dans l’autre, ou similarité ≥ ' + String(M.PARAMS.seuilThemesProches).replace('.', ',') + '. L’annonceur imprimé corrigé par la plateforme (fixe, colle) est vérifié aussi. Deux noms qu’un regroupement réunit déjà (outil multi-rouleuse : « *MISTRAL* ») ne sont pas signalés ; Circé n’ajoute pas de regroupement.', ['PP-08', 'FIX-15']),
      ui.card({ flush: true, body: ui.table({
        id: 'annonceurs', rows: F.apply(rows), rowKey: r => r.id, exportName: 'annonceurs-a-verifier', onRowClick: r => detailAnnonceurs(r.g),
        tone: r => (r.etat === 'A_VERIFIER' ? 'warning' : r.etat === 'DEMANDE' ? 'info' : r.etat === 'CORRIGE' ? 'good' : null),
        empty: 'Aucun annonceur proche à vérifier avec ces filtres.',
        columns: [
          { key: 'etat', label: 'État', render: r => ui.sev(ETATS_A[r.etat][1], ETATS_A[r.etat][0]), value: r => Object.keys(ETATS_A).indexOf(r.etat), csv: r => ETATS_A[r.etat][0] },
          { key: 'noms', label: 'Noms trouvés', wrap: true, maxWidth: 230, value: r => r.g.libelles.map(guill).join(' · ') },
          { key: 'dossiers', label: 'Dossiers', wrap: true, maxWidth: 130, value: r => r.g.dossiers.join(', ') },
          { key: 'semaines', label: 'Départ', value: r => r.semaines.map(s => 'S' + s).join(' + ') },
          { key: 'origine', label: 'Origine', value: r => (r.g.membres.some(x => x.source === 'Plateforme') ? 'Broadcast et plateforme' : 'Broadcast') },
          { key: 'statuts', label: 'Pré-production', wrap: true, render: r => h('span', null, M.uniq(r.ds.map(d => C.statutDossier(d))).map(s => ui.pill(s, '(' + r.ds.filter(d => C.statutDossier(d) === s).length + ')'))), value: r => M.uniq(r.ds.map(d => M.STATUTS[C.statutDossier(d)].label)).join(', ') },
        ],
        rowActions: r => (r.etat === 'A_VERIFIER'
          ? [ui.btn('Demander la correction', () => demanderAnnonceur(r.g), { small: true, primary: true }), ui.btn('Annonceurs différents', () => differentsA(r.g), { small: true, ghost: true })]
          : r.etat === 'DIFFERENTS' ? ui.btn('Rouvrir', () => rouvrirA(r.g), { small: true, ghost: true }) : null),
      }) }));
  }

  /* ---------- Cas 2 : thème modifié dans Broadcast après la validation ---------- */

  /** Reprendre la version Broadcast : Circé lit Broadcast et aligne son propre thème (« annule et remplace »). Si la
      production est lancée, les chefs d'équipe de l'atelier sont prévenus : le visuel produit est peut-être l'ancien. */
  M.appliquerThemeBC = function (x) {
    const { t, d } = x;
    const enProd = C.prodLancee(d), ancien = t.libelle;
    M.tick(2);
    t.libelle = t.libelleBC;
    delete t.modifBC;
    // Feuilles de stock déjà imprimées avec l'ancien intitulé : la réception les refait (REC-06)
    C.noterThemeModifie(t, ancien, user(), 'Repris de la version Broadcast');
    d.historique.push({ date: new Date(M.NOW), user: user(), action: 'Thème aligné sur Broadcast : « ' + ancien + ' » → « ' + t.libelle + ' »' });
    M.journal(d.id, 'Thème aligné sur Broadcast (« ' + ancien + ' » → « ' + t.libelle + ' »)');
    if (enProd) M.mail({ to: ["Chefs d'équipe " + C.atelier(d.atelier).label + ' – ' + C.site(d.site).label], subject: '[Circé] Thème changé par Broadcast, production lancée : dossier ' + d.id,
      body: 'Bonjour,\n\nLe thème du dossier ' + d.id + ' (' + d.annonceur + ') a été modifié dans Broadcast après la validation : « ' + ancien + ' » devient « ' + t.libelle + ' ».\n\nLa production est lancée : vérifiez que le visuel en cours est le bon avant de continuer.',
      trigger: 'Thème modifié dans Broadcast après la validation', needs: ['PP-09'] });
    ui.toast('Thème « ' + t.libelle + ' » repris de Broadcast pour le dossier ' + d.id + '.' + (enProd ? ' Production lancée : l’atelier est prévenu.' : ''), 'good');
    M.refresh();
  };

  function vueBC(root, params, head) {
    const rows = C.ecartsThemeBC().map(x => ({ id: x.t.id, x, d: x.d, t: x.t, prod: x.enProd ? 'lancee' : 'avant', annonceur: x.d.annonceur }));
    const F = ui.filters({ id: 'themes-bc', rows, preset: params.dossier ? { dossier: [String(params.dossier)] } : null, defs: [
      ui.dossierFilter(rows, r => r.d.id),
      ui.weekFilter(M.ref.semaines.map(s => s.num).filter(n => n >= M.state.semaine), r => r.d.semaines),
      { key: 'prod', label: 'Production', options: [{ value: 'lancee', label: 'Production lancée' }, { value: 'avant', label: 'Avant la production' }], get: r => r.prod },
      { key: 'annonceur', label: 'Annonceur', options: M.uniq(rows.map(r => r.annonceur)).sort((a, b) => a.localeCompare(b, 'fr')).map(v => ({ value: v, label: v })), get: r => r.annonceur },
      { key: 'atelier', label: 'Atelier', more: true, options: M.ref.ateliers.filter(a => M.state.site === 'ALL' || a.site === M.state.site).map(a => ({ value: a.id, label: ui.withSite(a.label, a.site) })), get: r => r.d.atelier },
    ] });
    const list = F.apply(rows);
    const parProd = M.groupBy(F.except(rows, 'prod'), r => r.prod);
    root.append(
      head('Les gestionnaires ont changé un thème dans Broadcast après l’envoi de la préparation, alors que l’Instruction OK et la validation admin étaient faites. À chaque mise à jour de sa copie de Broadcast, Circé compare le thème de chaque dossier des deux côtés et lève une alerte, critique si la production est lancée.'),
      F.bar,
      h('div', { class: 'kpis', style: { marginBottom: '12px' } },
        ui.stat({ label: 'Thèmes modifiés dans Broadcast', value: F.except(rows, 'prod').length, sub: 'Circé n’a pas encore suivi', onClick: () => { F.set('prod', []); M.refresh(); } }),
        ui.stat({ label: 'Production lancée', value: (parProd.lancee || []).length, sub: 'visuel à vérifier avec l’atelier', onClick: () => { F.set('prod', ['lancee']); M.refresh(); } }),
        ui.stat({ label: 'Avant la production', value: (parProd.avant || []).length, sub: 'reprendre la version Broadcast', onClick: () => { F.set('prod', ['avant']); M.refresh(); } })),
      ui.annot('Aujourd’hui, rien ne compare les deux : seule la copie Broadcast de Circé est rafraîchie ; le thème de la préparation et celui de l’affiche, copié à la réception, ne bougent plus. La cible compare dossier par dossier, même après Instruction OK et validation admin.', ['PP-09', 'ANO-07', 'SCR-08']),
      ui.card({ flush: true, body: ui.table({
        id: 'themes-bc', rows: list, rowKey: r => r.id, exportName: 'themes-modifies-broadcast.csv',
        tone: r => (r.x.enProd ? 'critical' : 'serious'),
        empty: 'Aucun thème modifié dans Broadcast avec ces filtres : Broadcast et Circé ont les mêmes thèmes.',
        columns: [
          { key: 'prod', label: 'Gravité', render: r => ui.sev(r.x.enProd ? 'critical' : 'serious', r.x.enProd ? 'Production lancée' : 'Avant la production'), value: r => (r.x.enProd ? 0 : 1), csv: r => (r.x.enProd ? 'Production lancée' : 'Avant la production') },
          { key: 'dossier', label: 'Dossier', value: r => r.d.id },
          { key: 'annonceur', label: 'Annonceur' },
          { key: 'atelier', label: 'Atelier', value: r => ui.withSite(C.atelier(r.d.atelier).label, r.d.site) },
          { key: 'semaine', label: 'Départ', value: r => r.d.semaines.map(s => 'S' + s).join(' + ') },
          { key: 'circe', label: 'Thème dans Circé', wrap: true, maxWidth: 180, value: r => r.t.libelle, render: r => h('span', null, ui.btnVisuel(r.t), r.t.libelle) },
          { key: 'bc', label: 'Thème dans Broadcast', wrap: true, maxWidth: 180, render: r => h('b', null, r.t.libelleBC), value: r => r.t.libelleBC },
          { key: 'date', label: 'Modifié le', hidden: true, render: r => (r.t.modifBC ? M.fmt.dt(r.t.modifBC.date) : '—'), value: r => (r.t.modifBC ? r.t.modifBC.date.getTime() : 0) },
          { key: 'statut', label: 'Statut pré-production', hidden: true, render: r => ui.pill(C.statutDossier(r.d)), value: r => M.STATUTS[C.statutDossier(r.d)].label },
        ],
        rowActions: r => [ui.btn('Reprendre la version BC', () => M.appliquerThemeBC(r.x), { small: true, primary: true }), // « Voir le dossier » (21/10) : l'état des réservations vivant dit où en est le dossier (affiches reçues, production,
          // repères), ce qui décide de reprendre la version Broadcast ou de prévenir l'atelier
          ui.btn('Voir le dossier', () => M.go('reservations', { dossier: r.d.id }), { small: true, ghost: true, title: 'Où en est ce dossier : État des réservations vivant' })],
      }) }),
      ui.callout('cible', 'À décider', ' Reprend-on la version Broadcast automatiquement quand la production n’est pas lancée, ou toujours après un clic de la Coordination ? Quand le visuel change vraiment, l’affiche déjà reçue reste celle de l’ancien thème : qui prévient l’imprimeur ?'));
  }

  M.screen({
    id: 'themes', title: 'Vérification des thèmes', icon: '≈', nav: 'Vérification des thèmes', roles: ['coord', 'admin'],
    needs: ['PP-08', 'PP-09', 'ANO-07', 'REC-23', 'BC-03', 'SCR-08', 'ERG-05', 'ERG-06', 'ERG-08'],
    asis: ['À la préparation des trains, la Pré-Prod doit « vérifier que chaque thème a le même intitulé » (S49), à l’œil', 'Un visuel commun à plusieurs dossiers est réparti à la main, avec une recherche par thème (S31)', 'Les thèmes proches ne sont repérés que par l’outil multi-rouleuse, au moment de générer les fichiers (§16.3)', 'Aucune comparaison du thème entre Broadcast et Circé : le thème de l’affiche est copié à la réception (code : LivraisonAfficheService.cs:451) ; seule la copie Broadcast est rafraîchie (LivraisonAfficheRepository.cs:378-386)', 'Dans la Liste des affiches, le thème d’une affiche se corrige à la main, avec historique (HistorisationBll.cs:25-26)'],
    badge: () => {
      const gs = C.themesAVerifier(), bc = C.ecartsThemeBC(), an = C.annonceursAVerifier();
      return { n: gs.length + bc.length + an.length, hot: bc.length > 0 || gs.some(g => g.dossiers.some(id => C.dossier(id).statutPP === 'PREPA_RECUE')), title: 'Thèmes proches, annonceurs proches et thèmes modifiés dans Broadcast' };
    },
    render(root, params) {
      // Vue choisie dans le menu du haut (Pilotage › Vérification des thèmes, sous les Alertes depuis le 04/11) : pas d'onglets dans la page
      const vue = VUES[params.tab] ? params.tab : 'proches';
      const head = sub => ui.pageHead({ crumb: 'Pilotage · Vérification des thèmes', title: VUES[vue], sub, screen: 'themes' });
      if (vue === 'bc') vueBC(root, params, head); else if (vue === 'annonceurs') vueAnnonceurs(root, params, head); else vueProches(root, params, head);
    },
  });
})();
