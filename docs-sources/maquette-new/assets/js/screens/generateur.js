/* Générateur de fichiers de prod, règles par machine en configuration.
   Multi-rouleuse : 1 source → n fichiers (un par annonceur et thème). Vendôme : le chef d'équipe choisit les trains selon
   l'avancement, l'outil fabrique le fichier et bloque au-delà de 20 tiroirs (la composition automatique est abandonnée, T17). */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const G = M.genState = { machine: '', criteres: null, result: null, sel: 0, combiner: {}, preselect: null };
  const CP = { BOR: '33000', TLS: '31000', LYO: '69007', MRS: '13015', NCE: '06200', MTP: '34000', AVI: '84000', NIA: '30900', SPP: '91280', NTR: '92000', REN: '35000', NTE: '44000', CAE: '14000', LIL: '59273', ORL: '45000', STR: '67000' };
  const user = () => M.ROLES.find(r => r.id === M.state.role).label;
  const nextNum = (machine, sem) => M.sum(M.data.generations.filter(g => g.machine === machine && g.semaine === sem), g => g.nbFichiers) + 1;
  const pad2 = n => String(n).padStart(2, '0');
  let F = null; // filtre Départ (ui.filters)
  /** Semaine qui nomme les fichiers et le lot : la première semaine de départ choisie. */
  const refWeek = () => (F && F.weeks().length ? Math.min(...F.weeks()) : M.state.semaine);
  const unitesMachine = m => C.unitesScope({ allWeeks: true }).filter(u => u.machine === m.id);

  /* ---------- Vendôme : un fichier avec les trains choisis par le chef d'équipe, ≤ N tiroirs (N = thèmes distincts) ---------- */
  /** Tiroirs d'un ensemble de trains : un par visuel distinct (positions fractionnées exclues). */
  const tiroirsDe = trains => M.uniq(trains.flatMap(u => u.positions.filter(p => !p.fr).map(p => p.themeId)));
  function fichierVendome(m, trains) {
    const themes = tiroirsDe(trains);
    const dep = new Date(Math.min(...trains.map(u => C.depart(u).getTime())));
    const name = 'S' + refWeek() + '_' + m.site + '_VEN_F' + pad2(nextNum(m.id, refWeek()));
    const affiches = M.sum(trains, u => u.nb * u.positions.filter(p => !p.fr).length);
    const picking = themes.map(id => { const t = C.theme(id), d = C.dossier(t.dossierId); return { t, annonceur: d.annonceur, theme: t.libelle, repiquage: t.repiquage, q: M.sum(trains.filter(u => u.positions.some(p => p.themeId === id && !p.fr)), u => u.nb), empl: M.data.affiches.filter(a => a.alloc.some(x => x.themeId === id)).map(a => a.allee + '-' + a.rayon).join(' ') }; }).sort((a, b) => b.q - a.q);
    const lignes = trains.map(u => {
      const dest = C.dest(u.dest), dp = C.depart(u);
      const head = [u.id, C.atelier(u.atelier).label, 'A', C.site(u.site).label, C.afficheur(u.afficheur).label, '3', dest.label, 'Dépôt ' + dest.label, dest.label, '(' + dp.getDay() + ') ' + M.iso(dp).slice(0, 10), u.positions.length, M.fmt.dy(dp), C.dossier(C.theme(u.positions[0].themeId).dossierId).format, ''];
      const contrats = u.positions.filter(p => !p.fr).flatMap((p, k) => { const t = C.theme(p.themeId), d = C.dossier(t.dossierId); return [d.id, 'Cityz', d.annonceur, (t.repiquage ? t.repiquage + ' - ' : '') + t.libelle, '', '', String.fromCharCode(65 + k)]; });
      return head.concat(contrats).join(';');
    });
    return { name, ext: '.csv → .ini', kind: 'vendome', trains, unites: trains, tiroirs: themes.length, affiches, dep, dests: M.uniq(trains.map(u => C.dest(u.dest).label)), lignes, picking };
  }

  /* ---------- Multi-rouleuse : 1 CSV par annonceur regroupé et thème (règles de l'outil Projet 1) ---------- */
  function genMultirouleuse(m, us) {
    // Annonceur imprimé : celui du dossier, sauf correction de la plateforme (FIX-15)
    const groups = M.groupBy(us, u => { const t = C.theme(u.themeId), d = C.dossier(t.dossierId); return C.regrouper(t.annonceurImprime || d.annonceur) + '|' + t.libelle.trim(); });
    const files = Object.entries(groups).map(([key, list]) => {
      const [ann, theme] = key.split('|');
      const dep = new Date(Math.min(...list.map(u => C.depart(u).getTime())));
      const lignes = list.sort((a, b) => C.depart(a) - C.depart(b) || C.dest(a.dest).label.localeCompare(C.dest(b.dest).label)).map(u => {
        const l = C.ligne(u.ligneId), t = C.theme(u.themeId), d = C.dossier(t.dossierId), dest = C.dest(u.dest);
        const q = l.qte + l.entretien;
        return [t.libelle, q, '', u.id, d.id, String(142700 + Number((d.no || d.id).slice(-3))), t.annonceurImprime || d.annonceur, '2m2', '2 m² fixe', Math.ceil(q / 4), C.afficheur(u.afficheur).label, dest.label, 'Dépôt ' + dest.label, 'ZA des Platanes', dest.label.toUpperCase(), CP[dest.id] || ''].join(';');
      });
      const parDest = M.groupBy(list, u => C.dest(u.dest).label);
      return { name: ('S' + refWeek() + ' ' + ann.slice(0, 20) + ' ' + theme.slice(0, 60)).replace(/[\\/:*?"<>|]/g, ' '), ext: '.csv', kind: 'mr', annonceur: ann, theme, unites: list, dep, dests: Object.keys(parDest), detail: Object.entries(parDest).map(([dname, us2]) => dname + ' ' + M.sum(us2, u => { const l = C.ligne(u.ligneId); return l.qte + l.entretien; })), affiches: M.sum(list, u => { const l = C.ligne(u.ligneId); return l.qte + l.entretien; }), lignes };
    }).sort((a, b) => a.dep - b.dep || a.annonceur.localeCompare(b.annonceur));
    // Thèmes proches pour un même annonceur regroupé : version combinée proposée
    files.forEach(f => { f.proches = files.filter(g => g !== f && g.annonceur === f.annonceur && C.proches(f.theme, g.theme)).map(g => g.name); });
    return files;
  }

  /** Unités prêtes des départs choisis (anticiper = ajouter la semaine suivante dans le filtre Départ). */
  function sourceUnits(m) {
    return F.apply(unitesMachine(m).filter(u => u.statut === 'PRET'));
  }

  function generer(m) {
    const us = sourceUnits(m);
    if (!us.length) { ui.toast('Aucune unité prête pour cette machine et cette semaine.', 'critical'); return; }
    G.result = { machine: m.id, date: new Date(M.NOW), files: genMultirouleuse(m, us) };
    G.sel = 0; G.combiner = {};
    M.journal(m.id, 'Proposition de ' + G.result.files.length + ' fichier(s) calculée (non envoyée)');
    M.refresh();
  }
  /** Vendôme : fichier des trains choisis par le chef d'équipe ; au-delà de N tiroirs, c'est bloquant (ANO-13). */
  function genererVendome(m, trains) {
    const n = tiroirsDe(trains).length;
    if (!trains.length) { ui.toast('Cochez les trains à mettre dans le fichier.', 'critical'); return; }
    if (n > m.tiroirs) { ui.toast(n + ' tiroirs : la Vendôme en a ' + m.tiroirs + '. Retirez des trains (bloquant).', 'critical'); return; }
    G.result = { machine: m.id, date: new Date(M.NOW), files: [fichierVendome(m, trains)] };
    G.sel = 0; G.combiner = {};
    M.journal(m.id, 'Fichier Vendôme préparé (non envoyé) : ' + trains.length + ' train(s) choisis par le chef d’équipe, ' + n + ' tiroir(s)');
    M.refresh();
  }

  /** Vendôme, étape 1 : les trains prêts des départs choisis ; le chef d'équipe coche ceux du fichier, selon l'avancement. */
  function choixVendome(m) {
    const pret = sourceUnits(m).slice().sort((a, b) => C.depart(a) - C.depart(b) || C.dest(a.dest).label.localeCompare(C.dest(b.dest).label, 'fr') || b.nb - a.nb);
    // Trains cochés dans Déroulant › Trains (« Générer les fichiers ») : ils arrivent déjà sélectionnés
    if (G.preselect) {
      const st = M.tableState['gen-vendome'] = M.tableState['gen-vendome'] || { sort: null, vis: new Map(), order: null, q: '', sel: new Set(), dense: false };
      st.sel = new Set(G.preselect.filter(id => pret.some(u => u.id === id)));
      G.preselect = null;
    }
    const N = m.tiroirs;
    return ui.card({ title: 'Trains prêts : départs ' + M.fmt.sems(F.weeks()), sub: 'cochez les trains du fichier ; ' + N + ' tiroirs au plus (un par visuel)', flush: true, body: ui.table({
      id: 'gen-vendome', rows: pret, selectable: true, search: true, empty: 'Aucun train prêt pour ces départs.',
      bulkActions: sel => { const n = tiroirsDe(sel).length; return [
        h('span', { class: 'small' }, n + ' / ' + N + ' tiroirs'),
        n > N ? ui.sev('critical', 'au-delà de ' + N + ' : bloquant') : null,
        ui.btn('Préparer le fichier (' + sel.length + ' train' + (sel.length > 1 ? 's' : '') + ')', () => genererVendome(m, sel), { small: true, primary: true, disabled: n > N })]; },
      columns: [
        { key: 'id', label: 'Train', nowrap: true },
        { key: 'dest', label: 'Destinataire', value: u => C.dest(u.dest).label },
        { key: 'positions', label: 'Positions', sortable: false, render: ui.positions, csv: u => u.positions.map(p => C.theme(p.themeId).libelle).join(' | ') },
        { key: 'nb', label: 'Nb trains', align: 'num' },
        { key: 'tiroirs', label: 'Tiroirs', align: 'num', title: 'Visuels distincts du train (positions fractionnées exclues)', value: u => tiroirsDe([u]).length },
        { key: 'depart', label: 'Départ camion', value: u => C.depart(u).getTime(), render: u => M.fmt.day(C.depart(u)) + ' ' + M.fmt.hm(C.depart(u)) },
        { key: 'afficheur', label: 'Afficheur', hidden: true, value: u => C.afficheur(u.afficheur).label },
      ] }) });
  }

  function envoyer(m) {
    const r = G.result; M.tick(6);
    const id = 'G-' + String(420 + M.data.generations.length * 3).padStart(4, '0');
    let files = r.files;
    // Fusion des thèmes proches validée par l'opérateur
    Object.entries(G.combiner).filter(([, v]) => v).forEach(([name]) => {
      const f = files.find(x => x.name === name); if (!f) return;
      const autres = files.filter(x => f.proches.includes(x.name));
      f.lignes = f.lignes.concat(...autres.map(a => a.lignes)); f.unites = f.unites.concat(...autres.map(a => a.unites)); f.affiches += M.sum(autres, a => a.affiches); f.name += ' (combiné)';
      files = files.filter(x => !autres.includes(x));
    });
    const unites = files.flatMap(f => f.unites);
    unites.forEach(u => { u.statut = 'EN_PROD'; u.generation = id; if (m.type === 'vendome') u.bague = true; });
    M.data.generations.push({ id, machine: m.id, site: m.site, semaine: refWeek(), date: new Date(M.NOW), user: user(), unites: unites.map(u => u.id), nbFichiers: files.length, statut: 'Envoyé à la machine', version: 1, note: '' });
    M.journal(id, files.length + ' fichier(s) déposés dans « ' + m.repertoire + ' » ; ' + unites.length + ' unité(s) passées « En production »');
    G.result = null;
    ui.toast(files.length + ' fichier(s) envoyé(s) à ' + m.label + '. ' + unites.length + ' unité(s) « En production » (point de non-retour).' + (m.type === 'vendome' ? ' Bagues incluses.' : ''), 'good');
    M.refresh();
  }

  function preview(f, m) {
    const head = m.type === 'vendome'
      ? 'TrainId;Format;Statut;Origine;Afficheur;Zone;Section;Adresse1;Adresse2;CentreCommercial;NbContrats;DateDépart;SupNom;Réf.;[Contrat;Réseau;Annonceur;Thème;Repiquage;Rouleur;Lettre] × n'
      : 'Thème;Qté;;UM;Dossier;Répart;Annonceur;Format;Type prépa;J (poids support / Qté÷4 ?);Afficheur;Destinataire;Adresse;Complément;Ville;CP';
    return [
      h('div', { class: 'row', style: { marginBottom: '6px' } }, h('span', { class: 'file-name' }, f.name + f.ext), h('span', { class: 'spacer' }),
        ui.btn('Télécharger', () => M.download(f.name.replace(/ /g, '_') + '.csv', f.lignes.join('\r\n'), 'text/csv'), { small: true })),
      h('div', { class: 'small muted', style: { marginBottom: '4px' } }, 'Structure (pas d’en-tête dans le fichier) : ', h('span', { class: 'mono wrap' }, head)),
      h('div', { class: 'preview' }, f.lignes.slice(0, 40).join('\n') + (f.lignes.length > 40 ? '\n… ' + (f.lignes.length - 40) + ' ligne(s) de plus' : '')),
      m.type === 'vendome' ? [
        ui.annot('Fichier au format « Générer fichier V2 » existant (une ligne par train, 6 contrats au plus ; code : PreparationDeroulantsService.cs:558-600). Cible : conversion .ini intégrée et dépôt direct dans Vendôme One. Le format .ini exact reste à relever (phase 3).', ['FP-02', 'CIB-10']),
        h('h3', { style: { fontSize: '14px', margin: '12px 0 6px' } }, 'Liste de picking (remplace l’export Excel dont on supprime les colonnes B, D, E)'),
        h('div', { class: 'table-wrap', style: { maxHeight: '220px' } }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Tiroir', 'Annonceur', 'Thème', 'Quantité', 'Emplacement'].map(x => h('th', null, x)))), h('tbody', null, f.picking.map((p, i) => h('tr', null, h('td', { class: 'num' }, i + 1), h('td', null, p.annonceur), h('td', null, ui.btnVisuel(p.t), (p.repiquage ? p.repiquage + ' - ' : '') + p.theme), h('td', { class: 'num' }, p.q), h('td', null, p.empl || '—'))))))]
        : ui.annot('Même contenu que l’export 2 m² existant, recopié ligne à ligne par UM : séparateur « ; », sans en-tête, encodage Windows (cp1252) dans la cible. La maquette télécharge en UTF-8.', ['FIX-02', 'FP-02']),
    ];
  }

  function resultat(m) {
    const r = G.result;
    if (!r) return null;
    const f = r.files[G.sel] || r.files[0];
    const proches = r.files.filter(x => x.proches && x.proches.length);
    const nbU = M.sum(r.files, x => x.unites.length);
    const exclus = F.apply(unitesMachine(m).filter(u => u.statut === 'EN_ATTENTE'));
    const ven = m.type === 'vendome';
    return [
      ui.steps(ven ? ['Machine', 'Trains choisis par le chef d’équipe', 'Fichier et bilan', 'Envoi à la machine'] : ['Machine', 'Unités prêtes', 'Proposition et bilan', 'Envoi à la machine'], 2),
      h('div', { class: 'kpis', style: { marginBottom: '14px' } },
        ui.stat({ label: ven ? 'Fichier préparé' : 'Fichiers proposés', value: r.files.length }),
        ui.stat({ label: ven ? 'Trains' : 'UM (rouleaux)', value: M.fmt.n(ven ? M.sum(r.files, x => M.sum(x.trains, u => u.nb)) : nbU) }),
        ui.stat({ label: 'Affiches', value: M.fmt.n(M.sum(r.files, x => x.affiches)) }),
        ven ? ui.stat({ label: 'Tiroirs', value: Math.max(...r.files.map(x => x.tiroirs)) + ' / ' + m.tiroirs, sub: 'bloquant au-delà' }) : ui.stat({ label: 'Thèmes proches détectés', value: proches.length, sub: 'version combinée proposée' }),
        ui.stat({ label: 'Exclues (visuels manquants)', value: M.fmt.n(M.sum(exclus, u => u.nb)), sub: 'restent « En attente »' })),
      proches.length ? ui.callout('warning', 'Thèmes proches pour un même annonceur', ' Même règle que l’outil Projet 1 (simplification, inclusion, similarité ≥ ' + String(M.PARAMS.seuilThemesProches).replace('.', ',') + '). Si c’est le même visuel, cochez « combiner » : un seul fichier sera envoyé.') : null,
      h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(300px, 1fr) 2fr' } },
        ui.card({ title: 'Bilan de génération', sub: ven ? 'trains choisis par le chef d’équipe' : 'ordre de production proposé', flush: true, body: h('div', { style: { maxHeight: '560px', overflow: 'auto' } }, r.files.map((x, i) => h('div', { class: ['file-card', i === G.sel ? 'sel' : ''], style: { margin: '8px', cursor: 'pointer', background: x.proches && x.proches.length ? '#fff8e1' : '#fff' }, onclick: () => { G.sel = i; M.refresh(); } },
          h('span', { class: 'file-name' }, (i + 1) + '. ' + x.name),
          h('span', { class: 'small' }, (m.type === 'vendome' ? x.tiroirs + ' tiroir(s) · ' + M.sum(x.trains, u => u.nb) + ' trains · ' : x.unites.length + ' UM · ') + x.affiches + ' affiches'),
          h('span', { class: 'small muted' }, 'Départ ' + M.fmt.day(x.dep) + ' ' + M.fmt.hm(x.dep) + ' · ' + (x.detail ? x.detail.join(', ') : x.dests.join(', '))),
          x.proches && x.proches.length ? h('label', { class: 'form-check small mb-0', onclick: e => e.stopPropagation() }, h('input', { class: 'form-check-input', type: 'checkbox', checked: !!G.combiner[x.name], onchange: e => { G.combiner[x.name] = e.target.checked; } }), h('span', { class: 'form-check-label' }, 'Combiner avec : ' + x.proches.join(' | '))) : null))) }),
        ui.card({ title: 'Aperçu du fichier', body: f ? preview(f, m) : null })),
      h('div', { class: 'row mt' },
        ui.btn(ven ? 'Revenir au choix des trains' : 'Abandonner la proposition', () => { G.result = null; M.refresh(); }),
        h('span', { class: 'spacer' }),
        ui.btn('Tout télécharger (un fichier par proposition)', () => r.files.forEach((x, i) => setTimeout(() => M.download(x.name.replace(/ /g, '_') + '.csv', x.lignes.join('\r\n'), 'text/csv'), i * 250))),
        ui.btn('Envoyer à la machine (' + r.files.length + ' fichiers)', () => envoyer(m), { primary: true })),
    ];
  }

  function historique() {
    const gs = M.data.generations.filter(g => M.state.site === 'ALL' || g.site === M.state.site).slice().sort((a, b) => b.date - a.date);
    return ui.card({ title: 'Historique des générations', sub: 'traçabilité de ce qui a été lancé, modifié ou ajouté', style: { marginTop: '16px' }, flush: true, body: ui.table({
      id: 'gen-histo', rows: gs, search: false, columnsMenu: false,
      tone: g => g.unites.some(id => { const u = C.unite(id); return u && u.modifs.some(x => x.user === 'Broadcast' && x.date > g.date); }) ? 'critical' : null,
      columns: [
        { key: 'id', label: 'Lot' }, { key: 'date', label: 'Date', render: g => M.fmt.dt(g.date), value: g => g.date.getTime() }, { key: 'user', label: 'Par', hidden: true },
        { key: 'machine', label: 'Machine', value: g => C.machine(g.machine).label }, { key: 'semaine', label: 'Départ', render: g => 'S' + g.semaine },
        { key: 'nbFichiers', label: 'Fichiers', align: 'num' }, { key: 'nbu', label: 'Unités', align: 'num', value: g => g.unites.length },
        { key: 'modif', label: 'Modifiées depuis', align: 'num', value: g => g.unites.filter(id => { const u = C.unite(id); return u && u.modifs.some(x => x.user === 'Broadcast' && x.date > g.date); }).length },
        { key: 'statut', label: 'Statut' },
      ],
      rowActions: g => { const n = g.unites.filter(id => { const u = C.unite(id); return u && u.modifs.some(x => x.user === 'Broadcast' && x.date > g.date); }).length; return n ? ui.btn('Générer un complément', () => { M.journal(g.id, 'Complément demandé pour ' + n + ' unité(s) modifiée(s)'); ui.toast('Complément proposé : uniquement les ' + n + ' unité(s) modifiée(s) depuis ' + g.id + '.', 'good'); }, { small: true }) : null; },
    }) });
  }

  M.screen({
    id: 'generateur', title: 'Générateur de fichiers de prod', icon: '⚙', nav: 'Générateur de fichiers', roles: ['cheq'],
    needs: ['FIX-02', 'FP-01', 'FP-02', 'SCR-06', 'SCR-07', 'CIB-09', 'CIB-10', 'CIB-03', 'ANO-03', 'ANO-13', 'REU-07', 'SCR-08', 'CIB-14', 'FIX-15', 'ERG-03', 'ERG-05'],
    asis: ['Multi-rouleuse : filtrer, exporter, renommer, coller dans le répertoire, autant de fois qu’il y a de thèmes (S37) ; outil Projet 1 en relais', 'Vendôme : supprimer des lignes pour descendre à 20 tiroirs, export Excel, supprimer B/D/E, renommer, Générer V2, conversion CSV → INI avec GenfichierProd, copie dans Vendôme One (S50)', 'Contrôle des 20 tiroirs fait après coup, non bloquant (code : TrainPreparationBll.cs:285-290)', 'Saturation quand trop de fichiers sont générés (S61 #3)'],
    render(root, params) {
      // La machine se choisit dans le menu du haut (Déroulant › Fichiers Vendôme, 2 m² fixe › Fichiers multi-rouleuse) :
      // plus de cartes de machines à cliquer dans la page.
      if (params.machine) G.machine = params.machine;
      const ms = M.ref.machines.filter(m => m.fichier && (M.state.site === 'ALL' || m.site === M.state.site));
      if (!ms.find(m => m.id === G.machine)) G.machine = ms[0] ? ms[0].id : '';
      const m = C.machine(G.machine);
      F = ui.filters({ id: 'generateur', defs: [ui.weekFilter()], rows: m ? unitesMachine(m) : [], onChange: () => { G.result = null; } });
      root.append(ui.pageHead({ crumb: !m ? 'Fichiers de prod' : m.type === 'vendome' ? 'Déroulant · Fichiers Vendôme' : '2 m² fixe · Fichiers multi-rouleuse', title: m ? m.label : 'Générateur de fichiers de prod',
        sub: m && m.type === 'vendome' ? 'Le chef d’équipe choisit les trains du fichier ; l’outil le fabrique, sans manipulation, et bloque au-delà des tiroirs de la machine. Chaque lot est versionné et tracé.'
          : 'Une source, n fichiers, en un clic. Les règles de chaque machine (tiroirs, colonnes, nommage, répertoire, critères d’ordonnancement) sont en configuration. Chaque lot est versionné et tracé.', screen: 'generateur' }));
      root.append(F.bar);
      if (!m) { root.append(ui.callout('info', 'Pas de machine alimentée par fichier sur ce site.', '')); return; }
      root.append(ui.annot('Sans fichier machine : CCM V2, assemblage 8 m² et tables de roulage passent par les bagues (Déroulant › Bagues) ; le pliage n’a pas de machine (suivi par comptage).', ['REU-07', 'PROC-08']));
      const us = F.apply(unitesMachine(m));
      const pret = us.filter(u => u.statut === 'PRET'), att = us.filter(u => u.statut === 'EN_ATTENTE'), env = us.filter(u => u.generation && u.statut === 'EN_PROD');
      const type = m.type === 'vendome' ? 'train' : 'fixe';
      if (!G.criteres || G.criteres.type !== type) G.criteres = { type, list: M.PARAMS.criteres[type].slice() };
      const mv = (i, d) => { const a = G.criteres.list; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; G.result = null; M.refresh(); };
      root.append(h('div', { class: 'mt' },
        G.result ? resultat(m) : m.type === 'vendome' ? [
          // Vendôme : le chef d'équipe choisit les trains (SCR-06 abandonné, T17) ; l'outil fabrique le fichier et bloque à N tiroirs
          ui.steps(['Machine', 'Trains choisis par le chef d’équipe', 'Fichier et bilan', 'Envoi à la machine'], 1),
          h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' } },
            choixVendome(m),
            ui.card({ title: 'Règles appliquées', sub: 'modifiables dans Paramétrage › Machines', body: [
              h('p', { style: { marginTop: 0 } }, h('b', null, 'Tiroirs par fichier : ' + m.tiroirs), ' ; au-delà, c’est bloquant (aujourd’hui, un simple message, ANO-13).'),
              h('div', { class: 'kpis' }, ui.stat({ label: 'Prêts', value: M.fmt.n(M.sum(pret, u => u.nb)), sub: 'trains, tous visuels reçus' }), ui.stat({ label: 'En attente', value: M.fmt.n(M.sum(att, u => u.nb)), sub: 'pas proposés' }), ui.stat({ label: 'Déjà envoyés', value: M.fmt.n(M.sum(env, u => u.nb)), sub: 'lots précédents' })),
              ui.annot('Le chef d’équipe choisit les trains du fichier selon l’état d’avancement : l’outil ne compose plus seul des fichiers de 20 tiroirs (abandonné le 15/10, T17). Il fabrique le fichier (colonnes, renommage, conversion .ini), comme pour le fixe (T16 #6). Des trains cochés dans Déroulant › Liste des trains ou Préparation arrivent ici déjà sélectionnés.', ['SCR-06', 'ANO-13', 'FP-02', 'CIB-10', 'ERG-03'])] })),
        ] : [
          ui.steps(['Machine', 'Unités prêtes', 'Proposition et bilan', 'Envoi à la machine'], 1),
          h('div', { class: 'grid cols-2' },
            ui.card({ title: 'Source : unités des départs ' + M.fmt.sems(F.weeks()), sub: m.label, body: [
              h('div', { class: 'kpis' }, ui.stat({ label: 'Prêtes', value: M.fmt.n(M.sum(pret, u => u.nb)), sub: 'tous visuels reçus ou fractionnés' }), ui.stat({ label: 'En attente', value: M.fmt.n(M.sum(att, u => u.nb)), sub: 'exclues automatiquement' }), ui.stat({ label: 'Déjà envoyées', value: M.fmt.n(M.sum(env, u => u.nb)), sub: 'lots précédents' })),
              ui.annot('Plus de filtre à refaire par annonceur ni par thème : toutes les unités prêtes des départs choisis sont prises, celles en attente sont listées à part. Pour anticiper, ajoutez la semaine suivante dans le filtre Départ : ses unités déjà prêtes entrent dans la même proposition et lissent la charge. Les dernières minutes arrivées après un lot sont proposées en complément.', ['FIX-02', 'SCR-07', 'CIB-02', 'PROC-02'])] }),
            ui.card({ title: 'Règles appliquées', sub: 'modifiables dans Paramétrage › Machines', body: [
              m.type === 'vendome' ? h('p', { style: { marginTop: 0 } }, h('b', null, 'Tiroirs par fichier : ' + m.tiroirs), ' (bloquant : un fichier ne peut pas dépasser la limite).') : h('p', { style: { marginTop: 0 } }, h('b', null, 'Un fichier par annonceur regroupé et par thème'), ' ; regroupements : ' + M.PARAMS.regroupements.map(r => r.motif + ' → ' + r.valeur).join(', ') + '.'),
              h('div', { class: 'small muted', style: { marginBottom: '4px' } }, 'Critères d’ordonnancement, du plus fort au plus faible :'),
              h('ol', { style: { margin: '0 0 0 18px', padding: 0 } }, G.criteres.list.map((c, i) => h('li', { style: { margin: '3px 0' } }, c, ' ', h('button', { class: 'btn btn-sm btn-icon', title: 'Monter', 'aria-label': 'Monter', disabled: i === 0, onclick: () => mv(i, -1) }, ui.icon('arrow-up')), ' ', h('button', { class: 'btn btn-sm btn-icon', title: 'Descendre', 'aria-label': 'Descendre', disabled: i === G.criteres.list.length - 1, onclick: () => mv(i, 1) }, ui.icon('arrow-down'))))),
              ui.chips(['FP-01', 'CIB-09']),
              h('div', { class: 'row mt' }, h('span', { class: 'spacer' }), ui.btn('Proposer les fichiers', () => generer(m), { primary: true, disabled: !sourceUnits(m).length }))] })),
        ]),
        historique());
    },
  });
})();
