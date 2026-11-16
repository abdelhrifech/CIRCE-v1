/* J-3 (Réception, 09/11) : performance de livraison des plateformes à J-3, le fichier « 2026 Performance livraison plateformes J-3 »
   remplacé par une page. Une feuille du fichier = une semaine d'affichage ; ses trois tableaux sont les trois sections de la page :
   - Wissous 1 : 2 m² fixe, 2 m² scro, 4 m² scro, 8 m² scro ;
   - Wissous 2 : collé (12 m², 8 m², 4 m²) ; Wissous 1 et 2 sont la même plateforme, seul le format change ;
   - Nîmes (mêmes formats que Wissous 1 : à confirmer).
   Les lignes viennent de l'état des réservations vivant (EDR vivant) : dossier, annonceur, quantités manquantes par format (le reste à
   recevoir), départ des colis. Le bouton « Ajouter depuis l'EDR vivant » choisit les dossiers ; chaque ligne se remplit ensuite
   directement : gestionnaires, impact, GO / NO GO, imprimeur, commentaire, livraison prévue, surcoûts.
   Les gestionnaires, la ville et la région ne sont pas dans l'EDR vivant (peut-être AssistantCommercial et AssistantLogistique de la
   table de préparation de Broadcast, à confirmer) : ils se saisissent à la main en attendant.
   Les lignes saisies sont gardées sur le poste (localStorage), une feuille par plateforme et par semaine d'affichage. */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const CLE = 'circe-maquette-j3';
  const lire = () => {
    try { const o = JSON.parse(localStorage.getItem(CLE)); if (o && Array.isArray(o.lignes)) return o; } catch (e) { /* rien de gardé */ }
    return { lignes: [], maj: {}, seeded: false };
  };
  const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(J)); } catch (e) { /* stockage indisponible : saisie gardée pour la session */ } };
  let J = null;
  const st = { sem: null };
  const majEl = {}; // « MAJ du » de chaque section, mis à jour à la saisie sans redessiner la page

  /** Une plateforme = un tableau. ok : le dossier est livré à cette plateforme ; col : sa colonne de quantité. */
  const FIXE_SCRO = ['2 m² fixe', '2 m² scro', '4 m² scro', '8 m² scro'];
  const colFixeScro = d => { const f = String(d.format || '').toLowerCase(); return f.includes('fixe') ? FIXE_SCRO[0] : f.includes('4 m²') ? FIXE_SCRO[2] : f.includes('8 m²') ? FIXE_SCRO[3] : FIXE_SCRO[1]; };
  const COLLE = ['12 m²', '8 m²', '4 m²'];
  const PF = [
    { id: 'wis1', nom: 'Wissous 1', sub: '2 m² fixe, 2 m² scro, 4 m² scro, 8 m² scro', formats: FIXE_SCRO, ok: d => d.site === 'WIS' && d.atelier !== 'WIS-COL', col: colFixeScro },
    { id: 'wis2', nom: 'Wissous 2', sub: 'collé : 12 m², 8 m², 4 m²', formats: COLLE, ok: d => d.atelier === 'WIS-COL', col: d => { const f = String(d.format || ''); return f.includes('12') ? COLLE[0] : f.includes('8') ? COLLE[1] : COLLE[2]; } },
    { id: 'nim', nom: 'Nîmes', sub: 'mêmes formats que Wissous 1 (à confirmer)', formats: FIXE_SCRO, ok: d => d.site === 'NIM', col: colFixeScro },
  ];

  /* Quantités d'un dossier, lues dans l'EDR vivant : avant les IP, la DA (quantité de Broadcast) ; ensuite les thèmes, comme la page
     État des réservations vivant (le reçu se compte une fois par thème). */
  const themesD = d => (d.themes || []).map(C.theme).filter(t => t && !t.exclu);
  const attendu = d => (d.ipSaisies ? M.sum(themesD(d), t => t.qteEnt) : M.sum(d.daLignes || [], da => da.affiches));
  const recu = d => M.sum(d.themes || [], id => C.recu(id));
  const reste = d => (d.ipSaisies ? M.sum(themesD(d), t => C.reste(t)) : Math.max(0, attendu(d) - recu(d)));
  /** Premier départ camion de chaque dossier (EDR vivant, colonne « Départ camion »). */
  const departs = () => {
    const dep = new Map();
    C.base().forEach(f => { if (f.depart && (!dep.has(f.dossier) || f.depart < dep.get(f.dossier))) dep.set(f.dossier, f.depart); });
    return dep;
  };
  const eligibles = (pf, sem) => M.data.dossiers.filter(d => pf.ok(d) && d.statutPP !== 'ANNULE' && (d.semaines || []).includes(sem));
  const nouvelle = (pf, d, sem, dep) => ({
    id: 'J3-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), pf: pf.id, sem, dossier: d.id,
    prepa: '', commerce: '', type: '', region: '', ville: '', impact: 'NON', typeImpact: '', depart: dep.get(d.no || d.id) ? M.fmt.day(dep.get(d.no || d.id)) : '',
    go: '', goCond: '', imprimeur: '', comm: '', livPrevue: '', surPtf: '', surTech: '',
  });
  const touche = l => {
    const k = l.pf + '|' + l.sem;
    J.maj[k] = new Date().toISOString();
    garder();
    if (majEl[l.pf]) majEl[l.pf].textContent = 'MAJ du ' + M.fmt.dt(new Date(J.maj[k]));
  };

  /** Première ouverture : chaque plateforme reçoit les dossiers de la semaine d'affichage qui ont des affiches manquantes. */
  const semer = sem => {
    const dep = departs();
    PF.forEach(pf => eligibles(pf, sem).filter(d => reste(d) > 0).forEach(d => J.lignes.push(nouvelle(pf, d, sem, dep))));
    J.seeded = true;
    garder();
  };

  /* Cellules à remplir directement : un champ par colonne, enregistré dès que la valeur change. */
  const texte = (l, key, label, w) => h('input', { class: 'form-control form-control-sm', type: 'text', value: l[key] || '', 'aria-label': label, style: { minWidth: w || '110px' }, onchange: e => { l[key] = e.target.value; touche(l); } });
  const nombre = (l, key, label) => h('input', { class: 'form-control form-control-sm', type: 'number', min: '0', step: '0.01', value: l[key] === '' ? '' : l[key], 'aria-label': label, style: { minWidth: '90px', textAlign: 'right' }, onchange: e => { l[key] = e.target.value; touche(l); } });
  const choix = (l, key, label, options) => { const s = ui.select({ value: l[key], options, label, onChange: v => { l[key] = v; touche(l); } }); s.classList.add('form-select-sm'); s.style.minWidth = '96px'; return s; };
  // Imprimeur : saisie libre, avec les imprimeurs des Référentiels en suggestion (liste « j3-imp », posée une fois dans la page)
  const imprimeur = l => h('input', { class: 'form-control form-control-sm', type: 'text', list: 'j3-imp', value: l.imprimeur || '', 'aria-label': 'Imprimeur', style: { minWidth: '130px' }, onchange: e => { l.imprimeur = e.target.value; touche(l); } });

  function colonnes(pf) {
    const q = f => ({ key: 'q' + f, label: 'Qté ' + f, align: 'num', value: r => (pf.col(r.d) === f ? reste(r.d) : null), render: r => (pf.col(r.d) === f ? M.fmt.n(reste(r.d)) : '') });
    return [
      { key: 'dossier', label: 'Dossier', nowrap: true, value: r => r.d.no || r.d.id },
      { key: 'annonceur', label: 'Annonceur', value: r => r.d.annonceur },
      { key: 'prepa', label: 'Gestionnaire Pré-Prod', sortable: false, value: r => r.l.prepa, render: r => texte(r.l, 'prepa', 'Gestionnaire Pré-Prod') },
      { key: 'commerce', label: 'Gestionnaire Commerce', sortable: false, value: r => r.l.commerce, render: r => texte(r.l, 'commerce', 'Gestionnaire Commerce') },
      { key: 'type', label: 'Annonceur / Ville', sortable: false, value: r => r.l.type, render: r => choix(r.l, 'type', 'Annonceur ou Ville', [{ value: '', label: '—' }, { value: 'A', label: 'A : annonceur' }, { value: 'V', label: 'V : ville' }]) },
      { key: 'region', label: 'Région', sortable: false, value: r => r.l.region, render: r => texte(r.l, 'region', 'Région', '90px') },
      { key: 'ville', label: 'Ville', sortable: false, value: r => r.l.ville, render: r => texte(r.l, 'ville', 'Ville', '90px') },
      { key: 'depart0', label: 'Départ (EDR)', nowrap: true, title: 'Semaine de départ du dossier dans l’état des réservations vivant', value: r => (r.d.semaines || []).map(s => 'S' + s).join(' + ') },
    ].concat(pf.formats.map(q), [
      { key: 'impact', label: 'Impact S-T', sortable: false, value: r => r.l.impact, render: r => choix(r.l, 'impact', 'Impact S-T', ['NON', 'OUI']) },
      { key: 'typeImpact', label: 'Type d’impact', sortable: false, value: r => r.l.typeImpact, render: r => texte(r.l, 'typeImpact', 'Type d’impact', '130px') },
      { key: 'depart', label: 'Jour de départ des colis depuis la plateforme', sortable: false, value: r => r.l.depart, render: r => texte(r.l, 'depart', 'Jour de départ des colis', '130px') },
      { key: 'go', label: 'GO / NO GO S-Tech.', sortable: false, value: r => r.l.go, render: r => choix(r.l, 'go', 'GO ou NO GO', [{ value: '', label: '—' }, 'GO', 'NO GO']) },
      { key: 'goCond', label: 'GO sous condition(s)', sortable: false, value: r => r.l.goCond, render: r => texte(r.l, 'goCond', 'GO sous condition(s)', '150px') },
      { key: 'imprimeur', label: 'Imprimeur', sortable: false, value: r => r.l.imprimeur, render: r => imprimeur(r.l) },
      { key: 'comm', label: 'Commentaire', sortable: false, value: r => r.l.comm, render: r => texte(r.l, 'comm', 'Commentaire', '240px') },
      { key: 'livPrevue', label: 'Si raccrochage ou retard : livraison prévue (milk run ou carton sous-traitant)', sortable: false, value: r => r.l.livPrevue, render: r => texte(r.l, 'livPrevue', 'Livraison prévue', '200px') },
      { key: 'surPtf', label: 'Surcoût plateforme', align: 'num', sortable: false, value: r => r.l.surPtf, render: r => nombre(r.l, 'surPtf', 'Surcoût plateforme') },
      { key: 'surTech', label: 'Surcoût technique', align: 'num', sortable: false, value: r => r.l.surTech, render: r => nombre(r.l, 'surTech', 'Surcoût technique') },
    ]);
  }

  /** Choix des dossiers dans l'EDR vivant : ceux de la plateforme dont le départ tombe la semaine d'affichage, les plus manquants d'abord. */
  function ajouter(pf, sem) {
    const deja = new Set(J.lignes.filter(l => l.pf === pf.id && l.sem === sem).map(l => l.dossier));
    const rows = eligibles(pf, sem).filter(d => !deja.has(d.id)).map(d => ({ id: d.id, d, attendu: attendu(d), recu: recu(d), reste: reste(d) })).sort((a, b) => b.reste - a.reste);
    ui.modal({ wide: true, title: 'Ajouter depuis l’EDR vivant · ' + pf.nom + ' · affichage S' + sem, actions: [{ label: 'Fermer' }],
      body: close => [
        h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Dossiers livrés à ' + pf.nom + ' dont le départ tombe en S' + sem + ', les plus manquants d’abord. Cochez ceux à suivre, puis « Ajouter la sélection ». Filtre « >0 » sous « Reste à recevoir » pour ne garder que les manquants.'),
        ui.table({ id: 'j3-ajout-' + pf.id, rows, selectable: true, maxHeight: '420px', empty: 'Aucun autre dossier de ' + pf.nom + ' en S' + sem + ' dans l’EDR vivant.',
          bulkActions: sel => [ui.btn('Ajouter la sélection', () => {
            const dep = departs();
            sel.forEach(r => J.lignes.push(nouvelle(pf, r.d, sem, dep)));
            J.maj[pf.id + '|' + sem] = new Date().toISOString();
            garder(); close(); M.refresh();
            ui.toast(sel.length + ' dossier' + (sel.length > 1 ? 's ajoutés' : ' ajouté') + ' à ' + pf.nom + '.', 'good');
          }, { small: true, primary: true, icon: 'plus' })],
          columns: [
            { key: 'dossier', label: 'Dossier', nowrap: true, value: r => r.d.no || r.d.id },
            { key: 'annonceur', label: 'Annonceur', value: r => r.d.annonceur },
            { key: 'sem', label: 'Départ', value: r => (r.d.semaines || []).map(s => 'S' + s).join(' + ') },
            { key: 'format', label: 'Format', value: r => r.d.format },
            { key: 'attendu', label: 'Attendu', align: 'num' }, { key: 'recu', label: 'Reçu', align: 'num' }, { key: 'reste', label: 'Reste à recevoir', align: 'num' }] }),
      ] });
  }

  function section(pf, sem) {
    const lignes = J.lignes.filter(l => l.pf === pf.id && l.sem === sem);
    const rows = lignes.map(l => ({ id: l.id, l, d: C.dossier(l.dossier) })).filter(r => r.d);
    const maj = J.maj[pf.id + '|' + sem];
    const majLabel = h('span', { class: 'small muted', style: { marginRight: '10px' } }, maj ? 'MAJ du ' + M.fmt.dt(new Date(maj)) : 'pas encore mis à jour');
    majEl[pf.id] = majLabel;
    const cols = colonnes(pf);
    return ui.card({ title: pf.nom, sub: pf.sub, flush: true,
      actions: [majLabel, ui.btn('Ajouter depuis l’EDR vivant', () => ajouter(pf, sem), { primary: true, small: true, icon: 'plus' })],
      body: ui.table({ id: 'j3-' + pf.id, rows, columns: cols, exportName: 'j3-' + pf.id + '-S' + sem + '.xlsx', maxHeight: '460px',
        empty: 'Aucune ligne pour S' + sem + ' : « Ajouter depuis l’EDR vivant » choisit les dossiers à suivre.',
        rowActions: r => ui.btn('Retirer', () => { J.lignes = J.lignes.filter(x => x.id !== r.l.id); touche(r.l); M.refresh(); }, { small: true, ghost: true, title: 'Retire la ligne de ce tableau (le dossier reste dans l’EDR vivant)' }),
        // « Total général » du fichier : somme des quantités par format
        footer: (c, rs) => (c.key === 'dossier' ? 'Total général' : c.key.startsWith('q') && c.align === 'num' ? M.fmt.n(M.sum(rs, r => (pf.col(r.d) === c.key.slice(1) ? reste(r.d) : 0))) : '') }) });
  }

  M.screen({
    id: 'j3', title: 'J-3', nav: 'J-3', roles: ['recep', 'coord', 'cheq'],
    render(root) {
      if (!J) J = lire();
      if (st.sem === null) st.sem = M.state.semaine + 1;
      const sem = st.sem;
      if (!J.seeded) semer(sem);
      const semaines = M.uniq(M.ref.semaines.map(s => s.num).filter(n => n >= M.state.semaine - 1 && n <= M.state.semaine + 8).concat([sem])).sort((a, b) => a - b);
      root.append(
        h('datalist', { id: 'j3-imp' }, M.ref.imprimeurs.map(x => h('option', { value: x }))),
        ui.pageHead({ crumb: 'Réception', title: 'J-3', screen: 'j3', sub: 'Performance de livraison des plateformes à J-3 : affiches manquantes et fractionnements, les trois tableaux du fichier sur une seule page. Les lignes viennent de l’état des réservations vivant ; les autres colonnes se remplissent directement dans la ligne.' }),
        ui.callout('info', 'À remplir le jeudi de S-1, avant 9 h', ' Pour un affichage en S' + sem + ' : le jeudi de S' + (sem - 1) + '. Wissous 1 et Wissous 2 sont la même plateforme : le format change (2 m² fixe et scro d’un côté, collé de l’autre).'),
        h('div', { class: 'row', style: { margin: '14px 0' } },
          ui.field('Semaine d’affichage', ui.select({ value: sem, label: 'Semaine d’affichage', options: semaines.map(n => ({ value: n, label: 'S' + n })), onChange: v => { st.sem = Number(v); M.refresh(); } }))),
        h('div', { class: 'stack', style: { gap: '16px' } }, PF.map(pf => section(pf, sem))),
        ui.annot('Gestionnaires, ville et région : absents de l’EDR vivant. La table de préparation de Broadcast (tf_prepa_Broadcast) porte AssistantCommercial et AssistantLogistique, peut-être les deux gestionnaires du fichier : à confirmer avec un gestionnaire ou la DSI. En attendant, ces champs se saisissent à la main.'));
    },
  });
})();
