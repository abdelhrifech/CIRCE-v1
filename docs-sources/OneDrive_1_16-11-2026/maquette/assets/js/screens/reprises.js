/* Pages de Circé reprises dans la maquette le 12/11 (utilisatrice : « notre Circé est un Circé qui upgrade », « ajoute tout ce qui
   manque »). Elles existaient dans Circé et manquaient à la maquette (croisement « Circé actuel et nouveau Circé » du 12/11) :
   - Réception › Zone picking (ZonePickingController : liste, « Ajouter du Picking » par douchage, « Edition Activité »,
     « Douchage Activité » ; ActiviteBll.cs:113-153) ;
   - Réception › Fusion des affiches (FusionAfficheController, FusionAfficheBll.cs:61-245 : affiches regroupées sous une affiche
     chapeau ; signalée comme ne fonctionnant pas, ANO-15) ;
   - Pilotage › Analyse Production (AnalyseProductionController : activité et trains, recherche plateforme, atelier, dates) ;
   - Expédition › Liste des colis (extérieur) (ExpeditionExterieurController : colis du transporteur externe sur un mois glissant ;
     p_s_colis_transporteur_externe.sql) ;
   - Administration › Déblocage préparations, Préparations débloquées, Rafraichir un dossier (_MenuNew.cshtml:146, 151, 156 ;
     AdminContratRepository.cs:21-36), Dupliquer train (DuplicationTrainController ; p_u_duplication_train) ;
   - Administration › Utilisateurs et menus (AdminUtilisateurMenuController : tr_utilisateur_menu, un login × un menu ; périmètre
     dans tr_utilisateur_data).
   Mêmes fonctions que Circé, sur les données fictives de la maquette. Chaque page porte le bandeau « ajoutée le 12/11 ». */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const user = () => (M.ROLES.find(r => r.id === M.state.role) || { label: 'Utilisateur' }).label;
  const AJOUT = 'Page de Circé, ajoutée à la maquette le 12/11 (elle n’y figurait pas)';
  const bandeau = circe => ui.callout('info', AJOUT, ' Circé : ' + circe + '. Les données sont celles, fictives, de la maquette.');
  const dansSite = x => M.state.site === 'ALL' || x.site === M.state.site;
  const histo = (o, action) => { (o.historique = o.historique || []).push({ date: new Date(M.NOW), user: user(), action }); };
  /** Annonceur et thème d'une affiche : ceux du dossier rattaché, sinon ce qui a été saisi à la réception. */
  const visuel = a => {
    const d = C.dossierOfAffiche(a), t = a.alloc && a.alloc[0] ? C.theme(a.alloc[0].themeId) : null;
    return { d, dossier: d ? (d.no || d.id) : '', annonceur: d ? d.annonceur : a.annonceurSaisi, theme: t ? t.libelle : a.libelleSaisi };
  };
  const affiche = id => M.data.affiches.find(a => a.id === String(id).trim());
  const jour = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const lireJour = (s, fin) => { const p = String(s || '').split('-').map(Number); return p.length === 3 ? new Date(p[0], p[1] - 1, p[2], fin ? 23 : 0, fin ? 59 : 0) : null; };
  const opt = (vals, lab) => vals.map(v => ({ value: v, label: lab ? lab(v) : v }));

  /* =====================================================================
     Réception › Zone picking
     ===================================================================== */
  const EQUIPES = ['Équipe matin', 'Équipe après-midi', 'Équipe nuit'];
  const activites = () => (M.data.activites = M.data.activites || []);
  /** Première ouverture : quelques affiches déjà en zone picking (dans Circé, l'affiche passe de « Réceptionnée » à « Picking »). */
  function semerPicking() {
    if (M.data.pickingSeme) return;
    M.data.pickingSeme = true;
    M.data.affiches.filter(a => a.statut === 'IDENTIFIEE' && C.stockDispo(a) > 0).slice(0, 8).forEach((a, i) => {
      a.zonePicking = 'Picking'; a.datePicking = new Date(M.NOW.getTime() - (i + 1) * 3 * 3600e3);
    });
  }
  /** Activités déjà douchées (jeu de démonstration) : elles n'écrivent pas de mouvement de stock. */
  function semerActivites() {
    if (M.data.activitesSemees) return;
    M.data.activitesSemees = true;
    M.data.affiches.filter(a => a.statut === 'IDENTIFIEE').slice(0, 18).forEach((a, i) => {
      const mach = M.ref.machines.filter(m => m.site === a.site);
      activites().push({ id: 'ACT-' + (1000 + i), date: new Date(M.NOW.getTime() - ((i % 6) + 1) * 86400e3 + (i % 3) * 3600e3), site: a.site, equipe: EQUIPES[i % 2],
        machine: mach.length ? mach[i % mach.length].id : null, afficheId: a.id, qte: 10 + (i * 7) % 40, rebut: i % 4 === 0 ? 1 + (i % 3) : 0, user: 'Chef d’équipe', sortie: false });
    });
  }
  const atelierDeMachine = id => M.ref.ateliers.find(at => (at.machines || []).includes(id));

  /** « Ajouter du Picking » : le n° d'affiche se douche (douchette) ou se tape. */
  function ajouterPicking() {
    let n = '';
    ui.modal({ title: 'Ajouter du picking', body: [
      ui.field('N° d’affiche (douchette ou saisie)', ui.input({ placeholder: 'ex. 712004', onInput: v => { n = v; } })),
      ui.annot('Circé : « Ajouter du Picking » par douchage du code-barres de l’affiche (ZonePicking). L’affiche passe de « Réceptionnée » à « Picking ».'),
    ], actions: [{ label: 'Annuler' }, { label: 'Ajouter', primary: true, onClick: () => {
      const a = affiche(n);
      if (!a) { ui.toast('Affiche ' + n + ' introuvable.', 'warning'); return true; }
      if (a.zonePicking) { ui.toast('L’affiche ' + a.id + ' est déjà en zone picking.', 'warning'); return true; }
      a.zonePicking = 'Picking'; a.datePicking = new Date(M.NOW); histo(a, 'Mise en zone picking');
      M.journal(a.id, 'Ajoutée en zone picking'); ui.toast('Affiche ' + a.id + ' ajoutée en zone picking.', 'good'); M.refresh();
    } }] });
  }

  /** « Edition Activité » : la fiche à remplir pendant la production (équipe, machine, quantité, rebut), puis douchée. */
  function editionActivite(afs) {
    ui.modal({ wide: true, title: 'Edition Activité · fiche d’activité (' + afs.length + ' affiche(s))', body: [
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Fiche imprimée pour l’atelier : les colonnes vides se remplissent à la main, puis chaque ligne est douchée (« Douchage Activité »).'),
      h('table', { class: 'table table-sm table-bordered' },
        h('thead', null, h('tr', null, ['N° affiche', 'Annonceur', 'Thème', 'Emplacement', 'Stock', 'Équipe', 'Machine', 'Quantité', 'Rebut'].map(x => h('th', null, x)))),
        h('tbody', null, afs.map(a => { const v = visuel(a); return h('tr', null, h('td', null, h('b', null, a.id)), h('td', null, v.annonceur), h('td', null, v.theme), h('td', null, a.allee + '-' + a.rayon), h('td', { class: 'text-end' }, C.stockDispo(a)), h('td', null, ''), h('td', null, ''), h('td', null, ''), h('td', null, '')); }))),
    ], actions: [{ label: 'Fermer' }, { label: 'Imprimer la fiche', primary: true, icon: 'printer', onClick: () => { M.journal(afs.map(a => a.id).join(', '), 'Edition Activité imprimée'); ui.toast('Fiche d’activité envoyée à l’imprimante (simulation).', 'good'); } }] });
  }

  /** « Douchage Activité » : date, équipe, machine, affiche, quantité, rebut (ActiviteBll.cs:113-153). */
  function douchageActivite(pre) {
    const s = { date: jour(M.NOW), equipe: EQUIPES[0], machine: '', affiche: pre || '', qte: '', rebut: '0', sortie: false };
    const machines = M.ref.machines.filter(m => dansSite(m));
    s.machine = machines.length ? machines[0].id : '';
    ui.modal({ title: 'Douchage Activité', body: [
      h('div', { class: 'row g-2' },
        ui.field('Date de production', ui.input({ type: 'date', value: s.date, onChange: v => { s.date = v; } })),
        ui.field('Équipe', ui.select({ value: s.equipe, options: EQUIPES, onChange: v => { s.equipe = v; } })),
        ui.field('Machine', ui.select({ value: s.machine, options: machines.map(m => ({ value: m.id, label: m.label })), onChange: v => { s.machine = v; } })),
        ui.field('N° d’affiche', ui.input({ value: s.affiche, placeholder: 'douchette', onInput: v => { s.affiche = v; } })),
        ui.field('Quantité produite', ui.input({ type: 'number', min: 0, value: s.qte, onInput: v => { s.qte = v; } })),
        ui.field('Rebut', ui.input({ type: 'number', min: 0, value: s.rebut, onInput: v => { s.rebut = v; } }))),
      h('div', { style: { marginTop: '10px' } }, ui.checkbox('Sortir aussi la quantité produite du stock (comme Circé)', false, v => { s.sortie = v; })),
      ui.annot('Circé : le douchage de l’activité sort du stock la quantité produite et le rebut. La maquette sort déjà le stock à l’expédition (fin de journée Geodis) : faire les deux compterait deux fois. Ici, le rebut sort toujours du stock, la quantité produite seulement si la case est cochée. À décider.'),
    ], actions: [{ label: 'Annuler' }, { label: 'Enregistrer l’activité', primary: true, onClick: () => {
      const a = affiche(s.affiche), q = Number(s.qte), rb = Number(s.rebut || 0);
      if (!a) { ui.toast('Affiche ' + s.affiche + ' introuvable.', 'warning'); return true; }
      if (!(q > 0) || rb < 0) { ui.toast('Quantité produite à saisir (nombre positif).', 'warning'); return true; }
      const date = lireJour(s.date) || new Date(M.NOW);
      activites().push({ id: M.uid('ACT'), date, site: a.site, equipe: s.equipe, machine: s.machine, afficheId: a.id, qte: q, rebut: rb, user: user(), sortie: s.sortie });
      if (rb > 0) { a.rebut = (a.rebut || 0) + rb; M.data.mouvements.push({ id: M.uid('MV'), date: new Date(M.NOW), afficheId: a.id, type: 'Activité (rebut)', qte: -rb, user: user(), auto: false, motif: s.equipe }); }
      if (s.sortie) M.data.mouvements.push({ id: M.uid('MV'), date: new Date(M.NOW), afficheId: a.id, type: 'Activité de production', qte: -q, user: user(), auto: false, motif: s.equipe });
      histo(a, 'Activité douchée : ' + q + ' produite(s)' + (rb ? ', ' + rb + ' au rebut' : ''));
      M.journal(a.id, 'Douchage Activité : ' + q + ' produite(s), ' + rb + ' rebut, ' + s.equipe);
      ui.toast('Activité enregistrée pour l’affiche ' + a.id + '.', 'good'); M.refresh();
    } }] });
  }

  M.screen({
    id: 'picking', title: 'Zone picking', nav: 'Zone picking', roles: ['recep', 'cheq'],
    asis: ['ZonePicking/Index : liste des affiches en zone picking, « Ajouter du Picking », « Edition Activité », « Douchage Activité » (droit Zone_Picking)'],
    render(root) {
      semerPicking(); semerActivites();
      const afs = M.data.affiches.filter(a => a.zonePicking && dansSite(a));
      const acts = activites().filter(x => dansSite(x)).slice().sort((x, y) => y.date - x.date);
      const parAff = M.groupBy(acts, x => x.afficheId);
      const rows = afs.map(a => { const v = visuel(a), la = parAff[a.id] || []; return { id: a.id, a, dossier: v.dossier, annonceur: v.annonceur, theme: v.theme, format: a.format, le: a.datePicking || null, empl: a.allee + '-' + a.rayon, dispo: C.stockDispo(a), nbAct: la.length, produit: M.sum(la, x => x.qte) }; });
      const semaine = new Date(M.NOW.getTime() - 7 * 86400e3);
      root.append(
        ui.pageHead({ crumb: 'Réception', title: 'Zone picking', screen: 'picking', sub: 'Les affiches mises en zone picking, et l’activité de production douchée sur ces affiches.',
          actions: [ui.btn('Ajouter du picking', ajouterPicking, { primary: true, icon: 'barcode' }), ui.btn('Douchage Activité', () => douchageActivite(), { icon: 'scan' }), ui.btn('Edition Activité', () => editionActivite(afs), { icon: 'printer' })] }),
        bandeau('menu Réception › Zone picking (ZonePicking)'),
        h('div', { class: 'kpis', style: { margin: '14px 0' } },
          ui.stat({ label: 'Affiches en zone picking', value: M.fmt.n(rows.length) }),
          ui.stat({ label: 'Stock en zone picking', value: M.fmt.n(M.sum(rows, r => Math.max(0, r.dispo))) }),
          ui.stat({ label: 'Activités douchées (7 jours)', value: M.fmt.n(acts.filter(x => x.date >= semaine).length) }),
          ui.stat({ label: 'Rebut déclaré (7 jours)', value: M.fmt.n(M.sum(acts.filter(x => x.date >= semaine), x => x.rebut)) })),
        ui.card({ title: 'Affiches en zone picking', sub: rows.length + ' affiche(s)', flush: true, body: ui.table({ id: 'picking', rows, selectable: true, exportName: 'zone-picking.xlsx',
          empty: 'Aucune affiche en zone picking : « Ajouter du picking » pour en mettre une.',
          bulkActions: (sel, clear) => [
            ui.btn('Edition Activité', () => { editionActivite(sel.map(r => r.a)); clear(); }, { small: true, icon: 'printer' }),
            ui.btn('Retirer du picking', () => { sel.forEach(r => { r.a.zonePicking = ''; histo(r.a, 'Retirée de la zone picking'); }); M.journal(sel.map(r => r.id).join(', '), 'Retirée(s) de la zone picking'); clear(); M.refresh(); }, { small: true })],
          rowActions: r => ui.btn('Douchage Activité', () => douchageActivite(r.id), { small: true, ghost: true }),
          columns: [{ key: 'id', label: 'N°' }, { key: 'zone', label: 'Zone', value: () => 'Picking' }, { key: 'format', label: 'Format' },
            { key: 'le', label: 'Mise en picking', render: r => r.le ? M.fmt.dt(r.le) : '—', value: r => r.le ? r.le.getTime() : 0 },
            { key: 'dossier', label: 'Dossier' }, { key: 'annonceur', label: 'Annonceur' }, { key: 'theme', label: 'Thème' },
            { key: 'dispo', label: 'Quantité', align: 'num', title: 'Stock disponible (somme des mouvements)' }, { key: 'empl', label: 'Allée-Rayon', value: r => ui.withSite(r.empl, r.a.site) },
            { key: 'nbAct', label: 'Activités', align: 'num', ajout: true }, { key: 'produit', label: 'Produit', align: 'num', ajout: true }] }) }),
        h('div', { style: { height: '14px' } }),
        ui.card({ title: 'Activité douchée', sub: acts.length + ' ligne(s)', flush: true, body: ui.table({ id: 'picking-activite', rows: acts, exportName: 'activite.xlsx', maxHeight: '380px',
          empty: 'Aucune activité douchée.',
          columns: [{ key: 'date', label: 'Date', render: x => M.fmt.dt(x.date), value: x => x.date.getTime() }, { key: 'equipe', label: 'Équipe' },
            { key: 'machine', label: 'Machine', value: x => x.machine ? C.machine(x.machine).label : '—' }, { key: 'afficheId', label: 'N° affiche' },
            { key: 'qte', label: 'Quantité', align: 'num' }, { key: 'rebut', label: 'Rebut', align: 'num' }, { key: 'user', label: 'Par' },
            { key: 'sortie', label: 'Sortie de stock', value: x => (x.sortie ? 'Quantité et rebut' : x.rebut ? 'Rebut seulement' : 'Non') }] }) }),
        ui.annot('Circé : l’affiche passe de « Réceptionnée » à « Picking » par douchage ; « Edition Activité » imprime la fiche, « Douchage Activité » enregistre date, équipe, machine, affiche, quantité et rebut, et sort le stock (ActiviteBll.cs:113-153). Sortie de la quantité produite : à décider, la maquette sortant déjà le stock à l’expédition.'));
    },
  });

  /* =====================================================================
     Réception › Fusion des affiches
     ===================================================================== */
  const fusions = () => (M.data.fusions = M.data.fusions || []);
  /** Candidates : affiches d'un même site et d'un même visuel (premier thème), reçues en plusieurs fois. La plus ancienne est la
      chapeau. Règle de Circé : procédure p_s_affiche_a_fusionner, SQL non versionné (à confirmer). */
  function groupesFusion() {
    const afs = M.data.affiches.filter(a => dansSite(a) && a.statut !== 'ORPHELINE' && !a.fusionneDans && a.alloc && a.alloc.length && a.qteRecue > 0);
    const g = M.groupBy(afs, a => a.site + '|' + a.alloc[0].themeId);
    return Object.values(g).filter(l => l.length > 1).map(l => {
      const tri = l.slice().sort((x, y) => x.date - y.date), v = visuel(tri[0]);
      return Object.assign({ id: tri[0].id, chapeau: tri[0], autres: tri.slice(1), site: tri[0].site, nb: l.length, qte: M.sum(l, a => a.qteRecue), stock: M.sum(l, a => C.stockDispo(a)) }, v);
    });
  }
  function fusionner(groupes) {
    groupes.forEach(gr => {
      const ch = gr.chapeau;
      gr.autres.forEach(o => {
        // Quantités, mouvements et préparations rattachés à la chapeau (FusionAfficheBll.cs:61-245)
        M.data.mouvements.forEach(m => { if (m.afficheId === o.id) m.afficheId = ch.id; });
        o.alloc.forEach(x => { const y = ch.alloc.find(z => z.themeId === x.themeId); if (y) y.qte += x.qte; else ch.alloc.push({ themeId: x.themeId, qte: x.qte }); });
        o.alloc = o.alloc.map(x => ({ themeId: x.themeId, qte: 0 }));
        ch.qteRecue += o.qteRecue; o.qteRecue = 0; o.fusionneDans = ch.id;
        histo(o, 'Fusionnée dans l’affiche chapeau ' + ch.id);
      });
      histo(ch, 'Affiche chapeau : ' + gr.autres.map(o => o.id).join(', ') + ' fusionnée(s)');
      fusions().push({ id: M.uid('FUS'), date: new Date(M.NOW), chapeau: ch.id, affiches: gr.autres.map(o => o.id), annonceur: gr.annonceur, theme: gr.theme, user: user() });
      M.journal(ch.id, 'Fusion des affiches ' + gr.autres.map(o => o.id).join(', ') + ' dans ' + ch.id);
    });
    M.reindex();
    ui.toast(groupes.length + ' fusion(s) faite(s).', 'good'); M.refresh();
  }

  M.screen({
    id: 'fusion', title: 'Fusion des affiches', nav: 'Fusion des affiches', roles: ['recep', 'coord'],
    asis: ['FusionAffiche/Index : candidates groupées par affiche chapeau ; signalée comme ne fonctionnant pas (ANO-15)'],
    render(root) {
      const rows = groupesFusion();
      const faites = fusions().slice().sort((x, y) => y.date - x.date);
      root.append(
        ui.pageHead({ crumb: 'Réception', title: 'Fusion des affiches', screen: 'fusion', sub: 'Regrouper sous une affiche chapeau les affiches d’un même visuel reçues en plusieurs fois : quantités, mouvements et préparations passent sur la chapeau.' }),
        bandeau('menu Réception › Fusion des affiches (FusionAffiche), signalée comme ne fonctionnant pas (ANO-15)'),
        ui.card({ title: 'Affiches à fusionner', sub: rows.length + ' groupe(s)', flush: true, body: ui.table({ id: 'fusion', rows, selectable: true, exportName: 'affiches-a-fusionner.xlsx',
          empty: 'Aucune affiche à fusionner : chaque visuel n’a qu’une affiche sur ce site.',
          bulkActions: (sel, clear) => [ui.btn('Fusionner', () => { fusionner(sel); clear(); }, { small: true, primary: true })],
          rowActions: r => ui.btn('Fusionner', () => fusionner([r]), { small: true, ghost: true }),
          columns: [{ key: 'id', label: 'Affiche chapeau' }, { key: 'autres', label: 'Affiches à fusionner', value: r => r.autres.map(a => a.id).join(', ') },
            { key: 'dossier', label: 'Dossier' }, { key: 'annonceur', label: 'Annonceur' }, { key: 'theme', label: 'Thème' },
            { key: 'site', label: 'Site', value: r => C.site(r.site).label, hidden: M.state.site !== 'ALL' },
            { key: 'nb', label: 'Affiches', align: 'num' }, { key: 'qte', label: 'Quantité reçue', align: 'num' }, { key: 'stock', label: 'Stock', align: 'num' }] }) }),
        h('div', { style: { height: '14px' } }),
        ui.card({ title: 'Fusions faites', sub: faites.length + ' fusion(s)', flush: true, body: ui.table({ id: 'fusion-faites', rows: faites, exportName: 'affiches-fusionnees.xlsx', empty: 'Aucune fusion pour l’instant.',
          columns: [{ key: 'date', label: 'Date', render: x => M.fmt.dt(x.date), value: x => x.date.getTime() }, { key: 'chapeau', label: 'Affiche chapeau' },
            { key: 'affiches', label: 'Affiches fusionnées', value: x => x.affiches.join(', ') }, { key: 'annonceur', label: 'Annonceur' }, { key: 'theme', label: 'Thème' }, { key: 'user', label: 'Par' }] }) }),
        ui.annot('Règle des candidates dans la maquette : même site et même visuel. Circé les tire de la procédure p_s_affiche_a_fusionner, dont le SQL n’est pas versionné : règle à confirmer. La page est reprise pour garder la fonction ; elle ne marchait pas dans Circé (ANO-15).'));
    },
  });

  /* =====================================================================
     Pilotage › Analyse Production
     ===================================================================== */
  const PRODUITS = ['PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'];
  const stA = { atelier: '', du: null, au: null };
  M.screen({
    id: 'analyse', title: 'Analyse Production', nav: 'Analyse Production', roles: ['cheq', 'coord', 'admin'],
    asis: ['AnalyseProduction/Index : recherche par plateforme, atelier et dates ; deux tableaux, Activité et Trains, avec leurs statistiques'],
    render(root) {
      semerActivites();
      if (!stA.du) { stA.au = jour(M.NOW); stA.du = jour(new Date(M.NOW.getTime() - 30 * 86400e3)); }
      const du = lireJour(stA.du), au = lireJour(stA.au, true);
      const ats = M.ref.ateliers.filter(at => dansSite(at) && !at.cible);
      const acts = activites().filter(x => dansSite(x) && (!du || x.date >= du) && (!au || x.date <= au) && (!stA.atelier || (atelierDeMachine(x.machine) || {}).id === stA.atelier));
      const actRows = acts.map(x => { const a = affiche(x.afficheId), v = a ? visuel(a) : {}; return Object.assign({ id: x.id, x, annonceur: v.annonceur || '', theme: v.theme || '', taux: x.qte ? x.rebut / (x.qte + x.rebut) : 0 }, x); });
      const parEquipe = Object.entries(M.groupBy(acts, x => x.equipe)).map(([eq, l]) => ({ id: eq, equipe: eq, nb: l.length, qte: M.sum(l, x => x.qte), rebut: M.sum(l, x => x.rebut) }));
      const trains = M.data.unites.filter(u => u.kind === 'TRAIN' && dansSite(u) && PRODUITS.includes(u.statut) && (!stA.atelier || u.atelier === stA.atelier));
      const op = id => (M.data.operateurs.find(o => o.id === id) || {}).label || 'Non renseigné';
      const trRows = Object.values(M.groupBy(trains, u => [u.operateur || '', u.machine || '', u.semaine].join('|'))).map(l => ({
        id: [l[0].operateur, l[0].machine, l[0].semaine].join('|'), rouleur: op(l[0].operateur), machine: l[0].machine ? C.machine(l[0].machine).label : '—', atelier: C.atelier(l[0].atelier).label, semaine: 'S' + l[0].semaine, lignes: l.length, trains: M.sum(l, u => u.nb) }));
      const totQ = M.sum(acts, x => x.qte), totR = M.sum(acts, x => x.rebut);
      root.append(
        ui.pageHead({ crumb: 'Pilotage', title: 'Analyse Production', screen: 'analyse', sub: 'Activité de production (quantités et rebut par équipe et machine) et trains produits par rouleur, sur une période.' }),
        bandeau('menu Suivi › Analyse Production (AnalyseProduction)'),
        h('div', { class: 'row g-2', style: { margin: '14px 0' } },
          ui.field('Atelier', ui.select({ value: stA.atelier, options: [{ value: '', label: 'Tous' }].concat(ats.map(at => ({ value: at.id, label: ui.withSite(at.label, at.site) }))), onChange: v => { stA.atelier = v; M.refresh(); } })),
          ui.field('Du', ui.input({ type: 'date', value: stA.du, onChange: v => { stA.du = v; M.refresh(); } })),
          ui.field('Au', ui.input({ type: 'date', value: stA.au, onChange: v => { stA.au = v; M.refresh(); } }))),
        h('div', { class: 'kpis', style: { marginBottom: '14px' } },
          ui.stat({ label: 'Quantité produite (activité)', value: M.fmt.n(totQ) }),
          ui.stat({ label: 'Rebut', value: M.fmt.n(totR), sub: totQ + totR ? Math.round(100 * totR / (totQ + totR)) + ' % de rebut' : '' }),
          ui.stat({ label: 'Trains produits', value: M.fmt.n(M.sum(trains, u => u.nb)), sub: trains.length + ' ligne(s) de trains' }),
          ui.stat({ label: 'Rouleurs', value: M.fmt.n(M.uniq(trains.map(u => u.operateur).filter(Boolean)).length) })),
        ui.card({ title: 'Activité', sub: acts.length + ' activité(s) douchée(s) sur la période', flush: true, body: ui.table({ id: 'analyse-activite', rows: actRows, exportName: 'analyse-activite.xlsx', maxHeight: '380px',
          empty: 'Aucune activité douchée sur la période (Réception › Zone picking › « Douchage Activité »).',
          footer: (c, rs) => (c.key === 'date' ? 'Total' : c.key === 'qte' ? M.fmt.n(M.sum(rs, r => r.qte)) : c.key === 'rebut' ? M.fmt.n(M.sum(rs, r => r.rebut)) : ''),
          columns: [{ key: 'date', label: 'Date', render: r => M.fmt.dt(r.date), value: r => r.date.getTime() }, { key: 'equipe', label: 'Équipe' },
            { key: 'machine', label: 'Machine', value: r => r.machine ? C.machine(r.machine).label : '—' }, { key: 'afficheId', label: 'N° affiche' },
            { key: 'annonceur', label: 'Annonceur' }, { key: 'theme', label: 'Thème' }, { key: 'qte', label: 'Quantité', align: 'num' }, { key: 'rebut', label: 'Rebut', align: 'num' },
            { key: 'taux', label: 'Taux de rebut', align: 'num', render: r => Math.round(100 * r.taux) + ' %' }] }) }),
        h('div', { style: { height: '14px' } }),
        ui.card({ title: 'Activité par équipe', flush: true, body: ui.table({ id: 'analyse-equipe', rows: parEquipe, exportName: 'analyse-equipes.xlsx', empty: 'Aucune activité.',
          columns: [{ key: 'equipe', label: 'Équipe' }, { key: 'nb', label: 'Activités', align: 'num' }, { key: 'qte', label: 'Quantité', align: 'num' }, { key: 'rebut', label: 'Rebut', align: 'num' }] }) }),
        h('div', { style: { height: '14px' } }),
        ui.card({ title: 'Trains', sub: 'Trains produits (produits, colisés, expédiés ou livrés), par rouleur, machine et départ', flush: true, body: ui.table({ id: 'analyse-trains', rows: trRows, exportName: 'analyse-trains.xlsx',
          empty: 'Aucun train produit pour ces critères.',
          footer: (c, rs) => (c.key === 'rouleur' ? 'Total' : c.key === 'trains' ? M.fmt.n(M.sum(rs, r => r.trains)) : c.key === 'lignes' ? M.fmt.n(M.sum(rs, r => r.lignes)) : ''),
          columns: [{ key: 'rouleur', label: 'Rouleur' }, { key: 'machine', label: 'Machine' }, { key: 'atelier', label: 'Atelier' }, { key: 'semaine', label: 'Départ' },
            { key: 'lignes', label: 'Lignes de trains', align: 'num' }, { key: 'trains', label: 'Trains', align: 'num' }] }) }),
        ui.annot('Circé : recherche par plateforme, atelier et dates, puis deux tableaux, Activité et Train, avec leurs statistiques (AnalyseProductionController). Le détail des colonnes de Circé n’est pas dans cette copie du code (modèle AnalyseProductionModel) : colonnes reprises d’après les tables Activite (équipe, machine, affiche, quantité, rebut, date de production) et des trains.'));
    },
  });

  /* =====================================================================
     Expédition › Liste des colis (extérieur)
     ===================================================================== */
  const stE = { du: null, au: null };
  M.screen({
    id: 'colisext', title: 'Liste des colis (extérieur)', nav: 'Liste des colis (extérieur)', roles: ['expe', 'cheq'],
    asis: ['ExpeditionExterieur/Index : colis du transporteur externe, du / au (un mois glissant par défaut) ; données du fichier du transporteur (p_s_colis_transporteur_externe)'],
    render(root) {
      if (!stE.du) { stE.au = jour(M.NOW); stE.du = jour(new Date(M.NOW.getFullYear(), M.NOW.getMonth() - 1, M.NOW.getDate())); }
      const du = lireJour(stE.du), au = lireJour(stE.au, true);
      const quand = c => c.expedie || c.clos;
      const cs = M.data.colis.filter(c => c.canal === 'MESSAGERIE' && dansSite(c) && quand(c) && (!du || quand(c) >= du) && (!au || quand(c) <= au));
      const rows = cs.map(c => { const u0 = (c.unites || []).map(C.unite).filter(Boolean)[0], de = C.dest(c.dest);
        return { id: c.id, c, recepisse: c.recepisse || '', date: quand(c), dest: de.label, boucle: de.boucle, atelier: u0 ? C.atelier(u0.atelier).label : '—', transporteur: M.ref.canaux[c.canal], nb: (c.unites || []).length, statut: c.statut }; });
      root.append(
        ui.pageHead({ crumb: 'Expédition', title: 'Liste des colis (extérieur)', screen: 'colisext', sub: 'Les colis confiés au transporteur externe sur la période, avec les données de son fichier.' }),
        bandeau('menu Expedition ext › Liste des colis (extérieur) (ExpeditionExterieur)'),
        h('div', { class: 'row g-2', style: { margin: '14px 0' } },
          ui.field('Du', ui.input({ type: 'date', value: stE.du, onChange: v => { stE.du = v; M.refresh(); } })),
          ui.field('Au', ui.input({ type: 'date', value: stE.au, onChange: v => { stE.au = v; M.refresh(); } }))),
        ui.card({ title: 'Colis', sub: rows.length + ' colis', flush: true, body: ui.table({ id: 'colisext', rows, exportName: 'colis-exterieur.xlsx',
          empty: 'Aucun colis confié au transporteur externe sur la période.',
          columns: [{ key: 'id', label: 'N° colis' }, { key: 'recepisse', label: 'Code transporteur', title: 'Code externe du colis chez le transporteur (récépissé)' },
            { key: 'date', label: 'Expédié le', render: r => r.date ? M.fmt.dt(r.date) : '—', value: r => r.date ? r.date.getTime() : 0 },
            { key: 'dest', label: 'Destinataire' }, { key: 'boucle', label: 'Boucle' }, { key: 'atelier', label: 'Atelier' }, { key: 'transporteur', label: 'Transporteur' },
            { key: 'nb', label: 'Unités', align: 'num' }, { key: 'statut', label: 'Statut', render: r => ui.pill(r.statut), value: r => (M.STATUTS[r.statut] || { label: r.statut }).label }] }) }),
        ui.annot('Circé : colis confiés au transporteur externe (Calberson dans le code de 2015-2016), sur un mois glissant, avec les données du fichier du transporteur (adresse, code tarif, poids). Dans la maquette : les colis en messagerie Geodis. Qui utilise encore cette page : à confirmer.'));
    },
  });

  /* =====================================================================
     Administration › Déblocage préparations, Préparations débloquées, Rafraichir un dossier, Dupliquer train
     ===================================================================== */
  const EN_PROD = ['EN_PROD', 'PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'];
  const unitesDossier = d => M.data.unites.filter(u => C.dossiersOf(u).includes(d.id));
  /** Débloquer (rendre la main) : même effet que « Rendre la main à la Pré-Prod » de la Préparation, pour tous les ateliers. */
  function debloquer(ds) {
    let motif = 'Préparation corrigée dans Broadcast';
    ui.modal({ title: 'Débloquer la préparation (' + ds.length + ' dossier(s))', body: [
      h('p', null, 'Dossier(s) : ', h('b', null, ds.map(d => (d.no || d.id) + ' (' + d.annonceur + ')').join(', '))),
      ui.field('Motif', ui.input({ value: motif, onChange: v => { motif = v; } }), true),
      ui.annot('Circé : « Déblocage préparations » débloque le groupe de prépa, pour qu’une prépa renvoyée par Broadcast soit réintégrée (mail « Déblocages » à la plateforme). Les unités déjà en production ne reviennent pas (point de non-retour).'),
    ], actions: [{ label: 'Annuler' }, { label: 'Débloquer', primary: true, onClick: () => {
      ds.forEach(d => {
        d.statutPP = 'PREPA_RECUE';
        unitesDossier(d).filter(u => !EN_PROD.includes(u.statut)).forEach(u => { u.statut = 'EN_ATTENTE'; u.rendu = true; });
        histo(d, 'Préparation débloquée : ' + motif);
        (M.data.rendus = M.data.rendus || []).push({ date: new Date(M.NOW), user: user(), dossier: d.id, annonceur: d.annonceur, motif, atelier: d.atelier });
        M.journal(d.id, 'Préparation débloquée : ' + motif);
      });
      ui.toast(ds.length + ' préparation(s) débloquée(s).', 'good'); M.refresh();
    } }] });
  }
  const rafraichis = () => (M.data.rafraichissements = M.data.rafraichissements || []);
  const duplications = () => (M.data.duplications = M.data.duplications || []);
  const stR = { dossier: '' };
  const stD = { source: '', cible: '', afficheur: '', nb: 1 };

  const VUES = {
    deblocage: ['Déblocage préparations', 'Débloquer le groupe de prépa d’un dossier, pour qu’une prépa corrigée dans Broadcast soit réintégrée.'],
    debloquees: ['Préparations débloquées', 'Le suivi des déblocages : quand, quel dossier, pourquoi, par qui.'],
    rafraichir: ['Rafraichir un dossier', 'Redemander à Broadcast les faces et les instructions d’un dossier déroulant.'],
    dupliquer: ['Dupliquer train', 'Copier un train en plusieurs exemplaires, pour un autre afficheur.'],
  };
  M.screen({
    id: 'adminprepa', title: 'Préparations (administration)', nav: 'Préparations (administration)', roles: ['admin', 'coord'], vueDefaut: 'deblocage',
    asis: ['Administration › Déblocage préparations, Préparations débloquées, Rafraichir un dossier, Dupliquer train (_MenuNew.cshtml:146-156)'],
    render(root, params) {
      const tab = VUES[params.tab] ? params.tab : 'deblocage';
      root.append(ui.pageHead({ crumb: 'Administration', title: VUES[tab][0], sub: VUES[tab][1], screen: 'adminprepa' }),
        bandeau('menu Administration › ' + VUES[tab][0]));
      if (tab === 'debloquees') {
        const rs = (M.data.rendus || []).filter(x => { const d = C.dossier(x.dossier); return !d || dansSite(d); }).slice().sort((x, y) => y.date - x.date).map((x, i) => Object.assign({ id: 'R' + i }, x));
        root.append(ui.card({ flush: true, body: ui.table({ id: 'adminprepa-debloquees', rows: rs, exportName: 'preparations-debloquees.xlsx', empty: 'Aucune préparation débloquée pour l’instant.',
          columns: [{ key: 'date', label: 'Date', render: x => M.fmt.dt(x.date), value: x => x.date.getTime() }, { key: 'dossier', label: 'Dossier' }, { key: 'annonceur', label: 'Annonceur' },
            { key: 'atelier', label: 'Atelier', value: x => x.atelier ? C.atelier(x.atelier).label : '—' }, { key: 'motif', label: 'Motif' }, { key: 'user', label: 'Par' }] }) }),
          ui.annot('Les déblocages faits ici et les « Rendre la main à la Pré-Prod » de la Préparation (2 m² fixe, pliage) sont dans la même liste.'));
        return;
      }
      if (tab === 'rafraichir') {
        const ds = M.data.dossiers.filter(d => dansSite(d) && C.atelier(d.atelier).mode === 'train' && d.statutPP !== 'ANNULE');
        if (!stR.dossier && ds.length) stR.dossier = ds[0].id;
        const faits = rafraichis().filter(x => { const d = C.dossier(x.dossier); return !d || dansSite(d); }).slice().sort((x, y) => y.date - x.date);
        root.append(
          ui.card({ title: 'Rafraichir', body: h('div', { class: 'row g-2', style: { alignItems: 'flex-end' } },
            ui.field('Dossier déroulant', ui.select({ value: stR.dossier, options: ds.map(d => ({ value: d.id, label: (d.no || d.id) + ' · ' + d.annonceur + ' · S' + d.semaine })), onChange: v => { stR.dossier = v; } })),
            h('div', null, ui.btn('Rafraichir le dossier', () => {
              const d = C.dossier(stR.dossier); if (!d) return;
              rafraichis().push({ id: M.uid('RAF'), date: new Date(M.NOW), dossier: d.id, annonceur: d.annonceur, user: user() });
              M.journal(d.id, 'Rafraichir un dossier : réexport des faces et instructions demandé à Broadcast');
              ui.toast('Demande envoyée à Broadcast (simulation) : Circé reprendra les faces et les instructions au prochain passage du programme d’intégration.', 'good'); M.refresh();
            }, { primary: true, icon: 'refresh' }))) }),
          h('div', { style: { height: '14px' } }),
          ui.card({ title: 'Dossiers rafraîchis', flush: true, body: ui.table({ id: 'adminprepa-rafraichir', rows: faits, exportName: 'dossiers-rafraichis.xlsx', empty: 'Aucun dossier rafraîchi pour l’instant.',
            columns: [{ key: 'date', label: 'Date', render: x => M.fmt.dt(x.date), value: x => x.date.getTime() }, { key: 'dossier', label: 'Dossier' }, { key: 'annonceur', label: 'Annonceur' }, { key: 'user', label: 'Par' }] }) }),
          ui.annot('Circé : appelle la procédure Broadcast ope.P_ExportTrainAfficheTravailCirce, qui réexporte les trains « de travail » du dossier (AdminContratRepository.cs:21-36) ; Circé les reprend au passage suivant du programme. Qui s’en sert et quand : question posée à la Coordination.'));
        return;
      }
      if (tab === 'dupliquer') {
        const trs = M.data.unites.filter(u => u.kind === 'TRAIN' && dansSite(u) && !EN_PROD.includes(u.statut));
        if (!stD.source && trs.length) stD.source = trs[0].id;
        const src = trs.find(u => u.id === stD.source);
        const affs = src ? M.data.afficheurs.filter(a => a.dest === src.dest) : M.data.afficheurs;
        if (src && !affs.some(a => a.id === stD.afficheur)) stD.afficheur = src.afficheur;
        const lib = u => { const t = u.positions && u.positions[0] ? C.theme(u.positions[0].themeId) : null, d = t ? C.dossier(t.dossierId) : null; return u.id + ' · ' + (d ? d.annonceur : '') + (t ? ' · ' + t.libelle : '') + ' · S' + u.semaine; };
        const faites = duplications().slice().sort((x, y) => y.date - x.date);
        root.append(
          ui.card({ title: 'Dupliquer', body: [h('div', { class: 'row g-2', style: { alignItems: 'flex-end' } },
            ui.field('Train source', ui.select({ value: stD.source, options: trs.map(u => ({ value: u.id, label: lib(u) })), onChange: v => { stD.source = v; M.refresh(); } })),
            ui.field('N° du train cible', ui.input({ value: stD.cible, placeholder: 'automatique', onChange: v => { stD.cible = v; } })),
            ui.field('Afficheur', ui.select({ value: stD.afficheur, options: affs.map(a => ({ value: a.id, label: a.label })), onChange: v => { stD.afficheur = v; } })),
            ui.field('Nombre d’exemplaires', ui.input({ type: 'number', min: 1, value: stD.nb, onChange: v => { stD.nb = Math.max(1, Number(v) || 1); } })),
            h('div', null, ui.btn('Dupliquer', () => {
              const s = M.data.unites.find(u => u.id === stD.source); if (!s) return;
              const n = Math.max(1, Number(stD.nb) || 1), ids = [];
              for (let k = 1; k <= n; k++) {
                let id = (stD.cible ? String(stD.cible).trim() : 'TR-D' + String(M.data.unites.length + 1).padStart(4, '0')) + (stD.cible && n > 1 ? '-' + k : '');
                while (M.data.unites.some(u => u.id === id)) id += 'b';
                const c = Object.assign({}, s, { id, afficheur: stD.afficheur || s.afficheur, statut: s.statut === 'PRET' ? 'PRET' : 'EN_ATTENTE', bague: false, generation: null, operateur: null, modifs: [], duplique: s.id,
                  positions: (s.positions || []).map(p => Object.assign({}, p)) });
                delete c.colis;
                M.data.unites.push(c); ids.push(id);
              }
              M.reindex();
              duplications().push({ id: M.uid('DUP'), date: new Date(M.NOW), source: s.id, copies: ids, afficheur: (M.data.afficheurs.find(a => a.id === (stD.afficheur || s.afficheur)) || {}).label || '', user: user() });
              M.journal(s.id, 'Train dupliqué en ' + n + ' exemplaire(s) : ' + ids.join(', '));
              stD.cible = '';
              ui.toast(n + ' exemplaire(s) du train ' + s.id + ' créé(s) : ' + ids.join(', ') + '.', 'good'); M.refresh();
            }, { primary: true, icon: 'train' })))] }),
          h('div', { style: { height: '14px' } }),
          ui.card({ title: 'Trains dupliqués', flush: true, body: ui.table({ id: 'adminprepa-dupliquer', rows: faites, exportName: 'trains-dupliques.xlsx', empty: 'Aucun train dupliqué pour l’instant.',
            columns: [{ key: 'date', label: 'Date', render: x => M.fmt.dt(x.date), value: x => x.date.getTime() }, { key: 'source', label: 'Train source' },
              { key: 'copies', label: 'Copies', value: x => x.copies.join(', ') }, { key: 'afficheur', label: 'Afficheur' }, { key: 'user', label: 'Par' }] }) }),
          ui.annot('Circé : p_u_duplication_train copie les faces du train source autant de fois que demandé, avec l’afficheur saisi ; les copies partent « A imprimer ». Dans la maquette, les copies reprennent l’état du train source (en attente ou prêt) et apparaissent dans Déroulant › Liste des trains. Qui s’en sert et quand : à confirmer.'));
        return;
      }
      // Déblocage préparations
      const ds = M.data.dossiers.filter(d => dansSite(d) && ['PREPA_RECUE', 'VALIDE'].includes(d.statutPP));
      const rows = ds.map(d => { const us = unitesDossier(d); return { id: d.id, d, dossier: d.no || d.id, annonceur: d.annonceur, atelier: C.atelier(d.atelier).label, sem: (d.semaines || [d.semaine]).map(s => 'S' + s).join(' + '), statut: d.statutPP, unites: us.length, enProd: us.filter(u => EN_PROD.includes(u.statut)).length }; });
      root.append(
        ui.card({ flush: true, body: ui.table({ id: 'adminprepa-deblocage', rows, selectable: true, exportName: 'deblocage-preparations.xlsx', empty: 'Aucune préparation intégrée.',
          bulkActions: (sel, clear) => [ui.btn('Débloquer', () => { debloquer(sel.map(r => r.d)); clear(); }, { small: true, primary: true, icon: 'lock' })],
          rowActions: r => ui.btn('Débloquer', () => debloquer([r.d]), { small: true, ghost: true }),
          columns: [{ key: 'dossier', label: 'Dossier' }, { key: 'annonceur', label: 'Annonceur' }, { key: 'atelier', label: 'Atelier' }, { key: 'sem', label: 'Départ' },
            { key: 'statut', label: 'Statut', render: r => ui.pill(r.statut), value: r => (M.STATUTS[r.statut] || { label: r.statut }).label },
            { key: 'unites', label: 'Unités', align: 'num' }, { key: 'enProd', label: 'Déjà en production', align: 'num', title: 'Unités qui ne reviendront pas (point de non-retour)' }] }) }),
        ui.annot('Même effet que « Rendre la main à la Pré-Prod » dans la Préparation du 2 m² fixe et du pliage ; ici, pour tous les ateliers, déroulant compris, comme dans Circé. Le mail « Déblocages » de Circé est remplacé par le mail « Demander une correction à Broadcast » (Paramétrage › Alertes et mails).'));
    },
  });

  /* =====================================================================
     Administration › Utilisateurs et menus
     ===================================================================== */
  const utilisateurs = () => {
    if (!M.data.utilisateurs) M.data.utilisateurs = [
      { login: 'coord.nimes', nom: 'Coordination Nîmes', role: 'coord', sites: ['NIM'] },
      { login: 'coord.wissous', nom: 'Coordination Wissous', role: 'coord', sites: ['WIS'] },
      { login: 'cheq.nimes', nom: 'Chef d’équipe Nîmes', role: 'cheq', sites: ['NIM'] },
      { login: 'cheq.wissous', nom: 'Chef d’équipe Wissous', role: 'cheq', sites: ['WIS'] },
      { login: 'recep.nimes', nom: 'Réception Nîmes', role: 'recep', sites: ['NIM'] },
      { login: 'recep.wissous', nom: 'Réception Wissous', role: 'recep', sites: ['WIS'] },
      { login: 'expe.wissous', nom: 'Expédition Wissous', role: 'expe', sites: ['WIS'] },
      { login: 'admin.circe', nom: 'Administrateur Circé', role: 'admin', sites: ['NIM', 'WIS', 'NAN'] },
      { login: 'commerce', nom: 'Commerce (lecture)', role: 'com', sites: ['NIM', 'WIS'] },
    ];
    return M.data.utilisateurs;
  };
  const libPage = it => it.label || (M.screens[it.screen] && (M.screens[it.screen].nav || M.screens[it.screen].title)) || it.screen;
  /** Les pages du menu, onglet par onglet (une ligne de tr_utilisateur_menu = un login × une page). */
  const pagesMenu = () => (M.NAV || []).flatMap(g => g.items.map(it => ({ key: g.id + '|' + libPage(it), onglet: g.title, label: libPage(it), screen: it.screen })));
  const parDefaut = (u, p) => { const s = M.screens[p.screen]; return u.role === 'admin' || !s || !s.roles || s.roles.includes(u.role); };
  const menusDe = u => { if (!u.menus) u.menus = new Set(pagesMenu().filter(p => parDefaut(u, p)).map(p => p.key)); return u.menus; };
  const stU = { login: '' };
  M.screen({
    id: 'utilisateurs', title: 'Utilisateurs et menus', nav: 'Utilisateurs et menus', roles: ['admin'],
    asis: ['Admin utilisateur menu : un login × un menu (tr_utilisateur_menu) ; périmètre de chaque utilisateur (tr_utilisateur_data) ; les droits masquent les menus, sans contrôle côté serveur'],
    render(root) {
      const us = utilisateurs();
      if (!stU.login) stU.login = us[0].login;
      const u = us.find(x => x.login === stU.login) || us[0];
      const pages = pagesMenu(), mine = menusDe(u);
      const rows = us.map(x => ({ id: x.login, x, login: x.login, nom: x.nom, role: (M.ROLES.find(r => r.id === x.role) || { label: x.role }).label, sites: x.sites.map(s => C.site(s).label).join(', '), nb: menusDe(x).size }));
      const onglets = M.uniq(pages.map(p => p.onglet));
      root.append(
        ui.pageHead({ crumb: 'Administration', title: 'Utilisateurs et menus', screen: 'utilisateurs', sub: 'Les utilisateurs de Circé, leur périmètre (plateformes) et les pages du menu auxquelles chacun a accès.' }),
        bandeau('Administration › Admin utilisateur menu (AdminUtilisateurMenu, AdminUtilisateurData)'),
        ui.card({ title: 'Utilisateurs', flush: true, body: ui.table({ id: 'utilisateurs', rows, exportName: 'utilisateurs.xlsx', tone: r => (r.id === u.login ? 'info' : null),
          rowActions: r => ui.btn('Menus', () => { stU.login = r.id; M.refresh(); }, { small: true, ghost: true }),
          columns: [{ key: 'login', label: 'Login' }, { key: 'nom', label: 'Nom' }, { key: 'role', label: 'Rôle' }, { key: 'sites', label: 'Plateformes' }, { key: 'nb', label: 'Pages', align: 'num' }] }) }),
        h('div', { style: { height: '14px' } }),
        ui.card({ title: 'Menus de ' + u.nom, sub: mine.size + ' page(s) sur ' + pages.length,
          actions: [ui.btn('Tout cocher', () => { pages.forEach(p => mine.add(p.key)); M.journal(u.login, 'Toutes les pages du menu ouvertes'); M.refresh(); }, { small: true }),
            ui.btn('Revenir au rôle', () => { u.menus = null; menusDe(u); M.journal(u.login, 'Menus remis selon le rôle'); M.refresh(); }, { small: true })],
          body: [
            h('div', { style: { marginBottom: '10px' } }, h('b', null, 'Plateformes : '), M.ref.sites.map(s => ui.checkbox(s.label, u.sites.includes(s.id), v => { u.sites = v ? M.uniq(u.sites.concat([s.id])) : u.sites.filter(x => x !== s.id); M.journal(u.login, (v ? 'Plateforme ajoutée : ' : 'Plateforme retirée : ') + s.label); M.refresh(); }))),
            h('div', { class: 'row g-3' }, onglets.map(o => h('div', { class: 'col-md-4' },
              h('div', { class: 'form-label' }, o),
              pages.filter(p => p.onglet === o).map(p => h('div', null, ui.checkbox(p.label, mine.has(p.key), v => { if (v) mine.add(p.key); else mine.delete(p.key); M.journal(u.login, (v ? 'Page ouverte : ' : 'Page fermée : ') + o + ' › ' + p.label); M.refresh(); })))))),
          ] }),
        ui.annot('Circé : une ligne de tr_utilisateur_menu par login et par menu ; le périmètre est dans tr_utilisateur_data. Les droits y masquent seulement les menus et les boutons, sans contrôle côté serveur (aucun [Authorize]) : dans la cible, le droit doit aussi être vérifié par le serveur. Dans la maquette, cocher ou décocher ne change pas le menu affiché (le rôle se choisit en haut de page).'));
    },
  });
})();
