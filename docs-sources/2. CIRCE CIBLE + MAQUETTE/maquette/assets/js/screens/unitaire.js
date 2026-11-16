/* Production unitaire : 2 m² fixe, colle / pliage (même processus, sans machine) et Bus (cible) */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const st = { atelier: '', ajustGlobal: 0, ajustCentre: {} };
  let F = null; // filtres de la page (ui.filters), propres à chaque atelier
  const user = () => M.ROLES.find(r => r.id === M.state.role).label;
  const total = u => { const l = C.ligne(u.ligneId); return l.qte + l.entretien; };
  const annOf = u => C.dossier(C.theme(u.themeId).dossierId).annonceur;
  /** Annonceur imprimé : celui du dossier, sauf correction de la plateforme (FIX-15). */
  const annImprime = t => t.annonceurImprime || C.dossier(t.dossierId).annonceur;
  const STATUTS_U = ['EN_ATTENTE', 'PRET', 'EN_PROD', 'PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'];
  const unitesAtelier = at => C.unitesScope({ allWeeks: true }).filter(u => u.atelier === at.id);

  /** « À libérer » (02/11) : unité d'une semaine pas encore libérée vers l'atelier, pas encore lancée. Remplace le statut 0
      « A traiter » de Circé pour la ligne fixe, qu'on confondait avec le dossier « À traiter » (prépa pas encore envoyée). */
  const aLiberer = u => (u.statut === 'EN_ATTENTE' || u.statut === 'PRET') && !M.data.liberations.some(l => l.atelier === u.atelier && l.semaine === C.dossier(C.theme(u.themeId).dossierId).semaine);
  /** Repères d'une unité : dossier arrivé après la libération de la semaine, main rendue à la Pré-Prod, à libérer. */
  const reperes = u => [C.dossier(C.theme(u.themeId).dossierId).apresLiberation ? 'apres' : null, u.rendu ? 'rendu' : null, aLiberer(u) ? 'alib' : null];
  /** Filtres : N° de dossier, Départ, Annonceur, Statut ; Destinataire, Afficheur et Repère par « + Filtre ». */
  function filterDefs(at) {
    const us = unitesAtelier(at);
    const opt = (vals, lab) => M.uniq(vals).map(v => ({ value: v, label: lab ? lab(v) : v })).sort((a, b) => String(a.label).localeCompare(String(b.label), 'fr'));
    return [
      ui.dossierFilter(us, C.dossiersOf),
      ui.weekFilter(),
      { key: 'annonceur', label: 'Annonceur', options: opt(us.map(annOf)), get: annOf },
      { key: 'statut', label: 'Statut', options: STATUTS_U.map(s => ({ value: s, label: M.STATUTS[s].label })), get: u => u.statut },
      { key: 'dest', label: at.type === 'bus' ? 'Centre bus' : 'Destinataire', more: true, options: opt(us.map(u => u.dest), id => C.dest(id).label), get: u => u.dest },
      { key: 'afficheur', label: 'Afficheur', more: true, options: opt(us.map(u => u.afficheur), id => C.afficheur(id).label), get: u => u.afficheur },
      { key: 'repere', label: 'Repère', more: true, options: [{ value: 'alib', label: 'À libérer (semaine pas encore libérée)' }, { value: 'apres', label: 'Arrivé après libération' }, { value: 'rendu', label: 'Main rendue à la Pré-Prod' }], get: reperes },
    ];
  }

  function liberer(at, sem) {
    M.tick(5);
    const lib = { site: at.site, semaine: sem, atelier: at.id, date: new Date(M.NOW), user: user() };
    M.data.liberations.push(lib);
    // La libération donne le Go à l'atelier ; elle ne valide rien (option A, 02/11) : la validation admin est proposée à la réception
    // et confirmée par la Coordination
    const restants = M.data.dossiers.filter(d => d.atelier === at.id && d.semaine === sem && d.statutPP === 'PREPA_RECUE');
    restants.forEach(d => { d.historique.push({ date: new Date(M.NOW), user: user(), action: 'Libéré vers l’atelier' }); });
    const doutes = restants.filter(d => C.vaResume(d) === 'A_FAIRE').length;
    M.journal(at.id + ' S' + sem, 'Semaine libérée vers l’atelier');
    ui.toast('S' + sem + ' libérée vers l’atelier ' + at.label + '. Les préparations reçues ensuite déclencheront une alerte et un mail.' + (doutes ? ' ' + doutes + ' dossier(s) ont encore des affiches à confirmer : validation admin par la Coordination (elle ne bloque pas la libération).' : ''), 'good');
    M.refresh();
  }

  function rendreMain(us) {
    const ds = M.uniq(us.map(u => C.theme(u.themeId).dossierId)).map(C.dossier);
    const bloques = us.filter(u => ['EN_PROD', 'PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'].includes(u.statut));
    let motif = 'Changement de visuel demandé par le client';
    ui.modal({ title: 'Rendre la main à la Pré-Prod', body: [
      ui.annot('Un seul geste remplace « Retirer » puis « Déblocage préparation » dans l’administration (S45). Le dossier revient à la Pré-Prod pour modification ; l’action est tracée.', ['CIB-03', 'REC-06', 'ERG-01']),
      h('p', null, 'Dossier(s) : ', h('b', null, ds.map(d => d.id + ' (' + d.annonceur + ')').join(', '))),
      bloques.length ? ui.callout('warning', bloques.length + ' unité(s) déjà en production', ' Elles ne seront pas retirées (point de non-retour) ; seules les autres reviennent à la Pré-Prod.') : null,
      ui.field('Motif', ui.input({ value: motif, onChange: v => { motif = v; } }), true),
    ], actions: [{ label: 'Annuler' }, { label: 'Rendre la main', primary: true, onClick: () => {
      ds.forEach(d => { d.statutPP = 'PREPA_RECUE'; d.historique.push({ date: new Date(M.NOW), user: user(), action: 'Main rendue à la Pré-Prod : ' + motif }); (M.data.rendus = M.data.rendus || []).push({ date: new Date(M.NOW), user: user(), dossier: d.id, annonceur: d.annonceur, motif, atelier: d.atelier }); M.journal(d.id, 'Main rendue : ' + motif); });
      us.filter(u => !bloques.includes(u)).forEach(u => { u.statut = 'EN_ATTENTE'; u.rendu = true; });
      ui.toast(ds.length + ' dossier(s) rendu(s) à la Pré-Prod.', 'good'); M.refresh();
    } }] });
  }

  /** Correction d'intitulé par la plateforme, au fixe et à la colle (FIX-15, RP30 #4) : en dernier lieu, dans Circé, même
      production lancée. Le thème et l'annonceur imprimés (bagues, feuille de stock, fichiers) changent pour tout le visuel ;
      Broadcast n'est pas modifié, la Pré-Prod est prévenue. */
  function corrigerIntitule(u) {
    const t = C.theme(u.themeId), d = C.dossier(t.dossierId);
    let theme = t.libelle, annonceur = annImprime(t), prevenir = true;
    const enProd = C.prodLancee(d);
    const nbU = M.data.unites.filter(x => x.themeId === t.id).length;
    ui.modal({ title: 'Corriger l’intitulé · dossier ' + d.id, body: [
      ui.annot('Au fixe et à la colle, la plateforme corrige en dernier lieu le thème et l’annonceur dans Circé, même production lancée (RP30 #4) : deux intitulés pour un même visuel donneraient deux préparations. Broadcast n’est pas modifié ; la correction est marquée et ne déclenche pas l’alerte « Broadcast ≠ Circé ».', ['FIX-15', 'REU-05', 'ANO-07']),
      enProd ? ui.callout('warning', 'Production lancée', ' La correction vaut pour les prochaines impressions : bagues, feuille de stock et fichiers pas encore envoyés.') : null,
      h('div', { class: 'grid cols-2' },
        ui.field('Annonceur imprimé', ui.input({ value: annonceur, onInput: v => { annonceur = v; } })),
        ui.field('Thème', ui.input({ value: theme, onInput: v => { theme = v; } }))),
      h('p', { class: 'small muted' }, 'S’applique au visuel entier : ' + nbU + ' unité(s) de ce thème.'),
      ui.checkbox('Prévenir la Pré-Prod, pour aligner Broadcast si besoin', true, v => { prevenir = v; }),
    ], actions: [{ label: 'Annuler' }, { label: 'Enregistrer la correction', primary: true, onClick: () => {
      theme = theme.trim(); annonceur = annonceur.trim();
      if (!theme || !annonceur) { ui.toast('Le thème et l’annonceur ne peuvent pas être vides.', 'critical'); return true; }
      const ancien = t.libelle, ancienAnn = annImprime(t);
      if (theme === ancien && annonceur === ancienAnn) { ui.toast('Rien n’a changé.', 'critical'); return true; }
      M.tick(2);
      t.corrPlateforme = { date: new Date(M.NOW), user: user(), ancien, ancienAnn, bc: t.libelleBC || ancien };
      t.libelle = theme;
      // Feuilles de stock déjà imprimées avec l'ancien intitulé : la réception les refait (REC-06)
      if (theme !== ancien) C.noterThemeModifie(t, ancien, user(), 'Corrigé par la plateforme (fixe, colle)');
      if (annonceur !== d.annonceur) t.annonceurImprime = annonceur; else delete t.annonceurImprime;
      d.historique.push({ date: new Date(M.NOW), user: user(), action: 'Intitulé corrigé par la plateforme : « ' + ancienAnn + ' · ' + ancien + ' » → « ' + annonceur + ' · ' + theme + ' »' + (enProd ? ' (production lancée)' : '') });
      M.journal(d.id, 'Intitulé corrigé par la plateforme (« ' + ancien + ' » → « ' + theme + ' »)');
      if (prevenir) M.mail({ to: ['Pré-Prod ' + C.site(d.site).label], subject: '[Circé] Intitulé corrigé par la plateforme : dossier ' + d.id,
        body: 'Bonjour,\n\nLa plateforme de ' + C.site(d.site).label + ' a corrigé l’intitulé du dossier ' + d.id + ' (' + C.atelier(d.atelier).label + ') : « ' + ancienAnn + ' · ' + ancien + ' » devient « ' + annonceur + ' · ' + theme + ' ».' + (enProd ? '\nLa production est lancée.' : '') + '\n\nBroadcast n’est pas modifié : à aligner si besoin.',
        trigger: 'Intitulé corrigé par la plateforme (fixe, colle)', needs: ['FIX-15'] });
      ui.toast('Intitulé corrigé pour tout le visuel (' + nbU + ' unité(s)) : bagues, feuille de stock et fichiers suivent.', 'good');
      M.refresh();
    } }] });
  }

  function compter(us) {
    const att = M.sum(us, total);
    let compte = att;
    ui.modal({ title: 'Comptage des affiches pliées', body: [
      ui.annot('Le pliage n’a pas de machine : on saisit le comptage, qui alimente le suivi de prod.', ['QUA-02', 'REU-07', 'CIB-12']),
      h('p', null, us.length + ' lot(s), ' + att + ' affiches attendues.'),
      ui.field('Affiches comptées', ui.input({ type: 'number', value: att, onChange: v => { compte = Number(v); } })),
    ], actions: [{ label: 'Annuler' }, { label: 'Valider le comptage', primary: true, onClick: () => {
      us.forEach(u => { u.statut = 'PRODUIT'; u.compte = true; });
      M.journal(us.map(u => u.id).join(', '), 'Pliage terminé, comptage ' + compte + ' / ' + att);
      ui.toast(compte === att ? 'Comptage conforme.' : 'Écart de comptage : ' + (compte - att) + ' affiche(s). Alerte qualité créée.', compte === att ? 'good' : 'critical'); M.refresh();
    } }] });
  }

  function tabPrep(root, at, params) {
    const D = M.data;
    const us = F.apply(unitesAtelier(at));
    const isFixe = at.type === 'fixe', isPliage = at.type === 'pliage';
    const semsFile = F.weeks().length ? F.weeks().sort((a, b) => a - b).map(s => 'S' + s).join('-') : 'toutes-semaines';
    root.append(
      ui.card({ flush: true, body: ui.table({
        id: 'unitaire-' + at.id, rows: us, query: params.q, selectable: true, exportName: 'preparation-' + at.id + '-' + semsFile + '.csv',
        tone: u => C.dossier(C.theme(u.themeId).dossierId).apresLiberation ? 'serious' : u.statut === 'EN_ATTENTE' ? 'warning' : u.statut === 'PRET' ? 'info' : null,
        bulkActions: (sel, clear) => [
          isFixe ? ui.btn('Générer les fichiers multi-rouleuse', () => M.go('generateur', { machine: at.machines[0] }), { small: true, primary: true }) : null,
          isPliage ? ui.btn('Plié : saisir le comptage', () => { compter(sel.filter(u => u.statut === 'PRET' || u.statut === 'EN_PROD')); clear(); }, { small: true, primary: true }) : null,
          ui.btn('Imprimer les bagues', () => { ui.imprimerBagues(sel.filter(u => u.statut === 'PRET')); clear(); }, { small: true }),
          ui.btn('Rendre la main à la Pré-Prod', () => { rendreMain(sel); clear(); }, { small: true }),
        ],
        // 8 colonnes par défaut : l'atelier (onglet) donne déjà le type de prépa ; dossier et départ restent dans « Colonnes ».
        columns: [
          { key: 'id', label: isFixe ? 'UM' : 'Lot', nowrap: true, title: 'UM : unité produite en 2 m² fixe, l’équivalent du n° de train' },
          ui.colVisuel(u => { const o = u.bagueTexte && u.bagueTexte[0], t = C.theme(u.themeId); return [o ? o.annonceur : annImprime(t), o ? o.theme : t.libelle, o ? ui.tag('bague modifiée', 'hyp') : t.corrPlateforme ? ui.tag('corrigé par la plateforme', 'hyp') : null]; }),
          { key: 'dest', label: at.type === 'bus' ? 'Centre bus' : 'Destinataire', value: u => C.dest(u.dest).label },
          { key: 'afficheur', label: 'Afficheur', value: u => C.afficheur(u.afficheur).label },
          { key: 'qte', label: 'Qté', align: 'num', value: u => C.ligne(u.ligneId).qte },
          { key: 'entretien', label: 'Entretien', align: 'num', value: u => C.ligne(u.ligneId).entretien, title: 'Calculé à l’afficheur (REU-06)', render: u => {
            const l = C.ligne(u.ligneId), d = C.dossier(l.dossierId);
            const ville = C.entretienVille(D.lignes.filter(x => x.themeId === l.themeId && x.dest === l.dest), d.entretienPct);
            const el = h('span', { tabindex: '0', style: { borderBottom: '1px dotted var(--ink-3)' } }, String(l.entretien));
            ui.tip(el, () => [h('div', { class: 'tt-title' }, 'Entretien de ' + d.entretienPct + ' %'), h('div', { class: 'tt-row' }, h('b', null, String(l.entretien)), ' pour cet afficheur (cible)'), h('div', { class: 'tt-row' }, h('b', null, String(ville)), ' pour la ville ' + C.dest(l.dest).label + ' (méthode actuelle, non répartie)')]);
            return el;
          } },
          { key: 'total', label: 'Total', align: 'num', value: total },
          { key: 'statut', label: 'Statut', value: u => M.STATUTS[u.statut].label, render: u => {
            // Les repères « arrivé après libération » et « à libérer » accompagnent le statut au lieu d'occuper une colonne.
            const apres = C.dossier(C.theme(u.themeId).dossierId).apresLiberation;
            return h('span', { class: 'cz-status-stack' }, ui.pill(u.statut), apres ? ui.sev('serious', 'Arrivé après libération') : u.rendu ? ui.tag('main rendue', 'hyp') : aLiberer(u) ? ui.tag('à libérer', 'hyp') : null);
          } },
          { key: 'type', label: 'Type prépa', hidden: true, value: () => isFixe ? '2 m² fixe' : at.type === 'bus' ? 'Bus' : 'Collé', title: 'Vrac, Roulée et Fixe fusionnés (FIX-01)' },
          { key: 'dossier', label: 'Dossier', hidden: true, value: u => C.theme(u.themeId).dossierId },
          { key: 'annonceur', label: 'Annonceur', hidden: true, value: u => C.dossier(C.theme(u.themeId).dossierId).annonceur },
          { key: 'theme', label: 'Thème', hidden: true, value: u => C.theme(u.themeId).libelle },
          { key: 'depart', label: 'Départ', hidden: true, value: u => C.depart(u).getTime(), render: u => M.fmt.day(C.depart(u)) + ' ' + M.fmt.hm(C.depart(u)) },
          { key: 'colis', label: 'Colis', value: u => u.colis || '', hidden: true },
          { key: 'flag', label: 'Repère', hidden: true, render: u => C.dossier(C.theme(u.themeId).dossierId).apresLiberation ? ui.sev('serious', 'Arrivé après libération') : u.rendu ? ui.tag('main rendue', 'hyp') : '', value: u => C.dossier(C.theme(u.themeId).dossierId).apresLiberation ? 'après libération' : '' },
        ],
        // Fixe et colle : correction de l'intitulé pour tout le visuel (FIX-15) ; Bus (cible) : textes de la bague seulement
        rowActions: u => (at.type === 'bus' ? ui.btn('Textes de bague', () => ui.modifierTextesBague(u), { small: true, ghost: true })
          : ui.btn('Corriger l’intitulé', () => corrigerIntitule(u), { small: true, ghost: true, icon: 'pencil', title: 'Corriger le thème ou l’annonceur imprimés, pour tout le visuel, même production lancée' })),
      }) }));
  }

  const libAt = a => C.site(a.site).label + ' · ' + a.label + (a.cible ? ' (cible)' : '');

  /** Fiche de synthèse (document à imprimer) : par destinataire, les visuels avec quantité et entretien, selon les filtres de la page. */
  function synthese(at) {
    const us = F.apply(unitesAtelier(at));
    const byDest = M.groupBy(us, u => C.dest(u.dest).label);
    ui.modal({ title: 'Fiche de synthèse · ' + libAt(at) + ' · ' + M.fmt.sems(F.weeks()), wide: true, body: [
      ui.annot('Fiche de préparation synthèse générée à l’écran (plus d’Excel à télécharger, mettre en page et imprimer). Elle suit les filtres de la page.', ['ERG-01', 'PROC-05', 'FIX-01']),
      h('div', { class: 'table-wrap tall' }, h('table', { class: 'dt' },
        h('thead', null, h('tr', null, ['Destinataire', 'Dossier', 'Annonceur', 'Thème', 'Repiquage', 'Format', 'Qté', 'Entretien', 'Total'].map(x => h('th', null, x)))),
        h('tbody', null, Object.entries(byDest).sort().flatMap(([dest, list]) => {
          const agg = M.groupBy(list, u => u.themeId);
          const lines = Object.entries(agg).map(([tid, ul]) => { const t = C.theme(tid), d = C.dossier(t.dossierId); const q = M.sum(ul, u => C.ligne(u.ligneId).qte), e = M.sum(ul, u => C.ligne(u.ligneId).entretien); return h('tr', null, h('td', null, ''), h('td', null, d.id), h('td', null, annImprime(t)), h('td', null, t.libelle), h('td', null, t.repiquage || ''), h('td', null, d.format), h('td', { class: 'num' }, q), h('td', { class: 'num' }, e), h('td', { class: 'num' }, q + e)); });
          return [h('tr', null, h('td', { colspan: '8' }, h('b', null, dest)), h('td', { class: 'num' }, h('b', null, M.sum(list, total))))].concat(lines);
        })))),
    ], actions: [{ label: 'Fermer' }, { label: 'Imprimer la fiche', primary: true, onClick: () => ui.toast('Fiche de synthèse imprimée (simulation).') }] });
  }

  /** Bus : quantités à encoller, ajustables globalement et par centre bus (BUS-02). Recalcul dans la fenêtre. */
  function ajust(at) {
    const D = M.data;
    const box = h('div');
    const draw = () => {
      const ws = F.weeks();
      const ls = D.lignes.filter(l => l.atelier === at.id && (!ws.length || ws.includes(l.semaine)));
      const rows = Object.entries(M.groupBy(ls, l => l.dest)).map(([dest, list]) => {
        const cmd = M.sum(list, l => l.qte);
        const bc = Math.round(cmd * 1.08) + Math.round(cmd * 0.2);
        const pct = st.ajustCentre[dest] !== undefined ? st.ajustCentre[dest] : st.ajustGlobal;
        return { id: dest, centre: C.dest(dest).label, cmd, bc, pct, final: Math.round(bc * (1 + pct / 100)) };
      });
      M.mount(box,
        h('div', { class: 'row', style: { marginBottom: '10px' } }, ui.field('Ajustement global (%)', ui.input({ type: 'number', value: st.ajustGlobal, onChange: v => { st.ajustGlobal = Number(v); draw(); } }))),
        h('div', { class: 'table-wrap' }, h('table', { class: 'dt cz-bus-ajust' },
          h('thead', null, h('tr', null, ['Centre bus', 'Quantité commandée', 'Calcul Broadcast (+8 % +20 %)', 'Ajustement centre (%)', 'À encoller'].map((x, i) => h('th', { class: i && i !== 3 ? 'num' : '' }, x)))),
          h('tbody', null, rows.map(r => h('tr', null, h('td', null, r.centre), h('td', { class: 'num' }, M.fmt.n(r.cmd)), h('td', { class: 'num' }, M.fmt.n(r.bc)),
            h('td', null, ui.input({ type: 'number', value: r.pct, style: { width: '80px', minWidth: '0' }, onChange: v => { st.ajustCentre[r.id] = Number(v); draw(); } })), h('td', { class: 'num' }, h('b', null, M.fmt.n(r.final)))))))));
    };
    draw();
    ui.modal({ title: 'Quantités à encoller · ' + libAt(at) + ' · ' + M.fmt.sems(F.weeks()), wide: true, body: [
      ui.callout('cible', 'Bus Nanterre : module cible', ' Le flux Broadcast vers Circé pour le Bus est à développer (BC-04, spécification CIR-01). Les dépôts bus sous-traitants hors Nanterre utiliseront le même écran pour saisir leurs quantités reçues, au lieu de l’envoi d’Excel (BUS-04, AUT-04).'),
      ui.annot('Quantité à encoller ajustable globalement et par centre bus, pour coller au parc réellement en exploitation. Aujourd’hui Broadcast applique +8 % de production figés et +20 % d’entretien par défaut.', ['BUS-02', 'BUS-01']),
      box,
    ], actions: [{ label: 'Fermer' }, { label: 'Enregistrer et éditer les états de collage', primary: true, onClick: () => { M.journal(at.id, 'Quantités à encoller ajustées (global ' + st.ajustGlobal + ' %)'); ui.toast('États de collage édités avec les quantités ajustées.', 'good'); } }] });
  }

  M.screen({
    id: 'unitaire', title: 'Préparation (2 m² fixe, pliage, bus)', icon: '▭', nav: 'Préparation', roles: ['cheq', 'coord'],
    // BUS-04 et AUT-04 (centres bus hors Nanterre) sont seulement annoncés dans l'écran Bus : non couverts (Synthèse, ligne 33)
    needs: ['REU-07', 'REU-04', 'REU-05', 'FIX-15', 'FIX-14', 'REU-06', 'REC-19', 'FIX-01', 'FIX-03', 'FIX-04', 'FIX-05', 'FIX-06', 'FIX-07', 'PP-04', 'PP-05', 'CIB-06', 'QUA-02', 'BUS-01', 'BUS-02', 'BUS-03', 'CIB-16', 'CIB-02', 'ERG-03', 'ERG-05', 'ERG-06', 'ERG-08', 'ERG-10'],
    asis: ['Pré-Prod : filtre « À traiter », fiche de synthèse Excel, clic « Colisage » qui crée en fait les UM (code : PreparationController.cs:429-477)', 'Rendu main : Retirer, puis Déblocage préparations dans l’administration (S45)', 'Aucune alerte si un dossier arrive après la préparation (S15)', 'Entretien des trains porté par un afficheur fictif « ENTRETIEN » par destinataire et thème (p_u_associe_train.sql:462-500)'],
    badge: () => { const n = M.data.dossiers.filter(d => d.apresLiberation && M.inScope(d)).length; return { n, hot: n > 0, title: 'Dossiers arrivés après libération' }; },
    render(root, params) {
      // Onglets 2 m² fixe, Pliage et Bus (même écran) : le type et l'atelier se choisissent dans le menu du haut,
      // pas dans la page. Sans atelier précisé, le premier atelier du type sur le site choisi.
      const asked = C.atelier(params.atelier);
      const type = params.type || (asked ? asked.type : 'fixe');
      const ats = M.ateliersPour(type);
      const at = ats.find(a => a.id === params.atelier) || ats[0];
      const typeLib = M.POUR_LABEL[type] || 'Préparation';
      if (!at) {
        root.append(ui.pageHead({ crumb: typeLib, title: 'Préparation', screen: 'unitaire' }),
          ui.callout('info', 'Pas d’atelier « ' + typeLib + ' » sur ce site.', ' Choisissez « Tous les sites » ou un autre site en haut de page.'));
        return;
      }
      st.atelier = at.id;
      F = ui.filters({ id: 'unitaire-' + at.id, defs: filterDefs(at), rows: unitesAtelier(at), preset: params.flag === 'apres' ? { repere: ['apres'] } : null });
      root.append(
        ui.pageHead({ crumb: typeLib + (at.cible ? ' (cible)' : ''), title: (at.type === 'bus' ? 'Préparation par centre · ' : 'Préparation · ') + C.site(at.site).label + (at.type === 'pliage' ? ' · ' + at.label : ''), screen: 'unitaire',
          sub: at.type === 'pliage' ? 'Colle / pliage (Wissous uniquement) : même processus que le fixe, sans machine ni fichier ; le suivi de prod se fait par comptage.' : at.type === 'bus' ? 'Bus de Nanterre (cible) : préparation par centre bus, sur le modèle du fixe.' : 'Préparation par afficheur, fichiers multi-rouleuse, bagues et colisage.',
          actions: [ui.btn('Fiche de synthèse', () => synthese(at), { icon: 'printer' }), at.type === 'bus' ? ui.btn('Quantités à encoller', () => ajust(at)) : null] }),
        F.bar);
      // Libération : un bandeau par semaine de départ choisie (« Toutes » : la semaine en production et les suivantes)
      const semsLib = (F.weeks().length ? F.weeks() : M.ref.semaines.map(s => s.num).filter(n => n >= M.state.semaine)).sort((a, b) => a - b);
      semsLib.forEach(sem => {
        const lib = M.data.liberations.find(l => l.atelier === at.id && l.semaine === sem);
        const tard = M.data.dossiers.filter(d => d.atelier === at.id && d.semaine === sem && d.apresLiberation);
        if (lib) root.append(ui.callout(tard.length ? 'warning' : 'good', 'S' + sem + ' libérée vers l’atelier le ' + M.fmt.day(lib.date) + ' ' + M.fmt.hm(lib.date) + ' (' + lib.user + ')',
          tard.length ? ' ' + tard.length + ' dossier(s) arrivé(s) après : ' + tard.map(d => d.id + ' ' + d.annonceur).join(', ') + '. Mail envoyé aux chefs d’équipe.' : ' Toute préparation reçue après déclenche une alerte et un mail.',
          tard.length ? [ui.btn('Voir ces dossiers', () => { F.set('repere', ['apres']); M.refresh(); }, { small: true }), ui.btn('Voir le mail', () => ui.mailbox(), { small: true })] : null));
        else root.append(ui.callout('info', 'S' + sem + ' pas encore libérée vers l’atelier', ' Ses lignes sont « à libérer » : déjà visibles (préparation reçue) pour anticiper. La libération donne le Go et arme l’alerte « arrivé après libération ». Elle remplace le bouton « Colisage » de Circé, et « à libérer » son statut 0 « A traiter », qu’on confondait avec le dossier « À traiter » (02/11).', ui.btn('Libérer la S' + sem, () => liberer(at, sem), { small: true, primary: true })));
      });
      root.append(h('div', null, ui.chips(['REU-04', 'FIX-06', 'FIX-07', 'CIB-02'])));
      if (at.type === 'pliage') root.append(ui.annot('Colle / pliage (Wissous uniquement) : pas de machine, pas de fichier ; le suivi de prod se fait par comptage.', ['REU-07', 'QUA-02']));
      root.append(ui.annot('Les mains rendues à la Pré-Prod et les dossiers arrivés après libération se retrouvent par le filtre « Repère » ; la fiche de synthèse s’imprime depuis le bouton en haut de page.', ['CIB-03', 'REC-06']));
      // Thèmes « ne pas afficher » ou « reste en place » d'après les IP de Broadcast : sortis d'eux-mêmes de la préparation (FIX-14, A17)
      const ws = F.weeks();
      const exclus = M.data.themes.filter(t => { const d = C.dossier(t.dossierId); return t.exclu && d && d.atelier === at.id && (!ws.length || ws.includes(d.semaine)); });
      if (exclus.length) root.append(ui.annot(exclus.length + ' thème(s) sorti(s) automatiquement de la préparation, d’après les IP de Broadcast : ' + exclus.map(t => '« ' + t.libelle + ' » (' + (t.exclu === 'RESTE_EN_PLACE' ? 'reste en place' : 'ne pas afficher') + ', dossier ' + t.dossierId + ')').join(', ') + '.', ['FIX-14', 'SCR-02']));
      tabPrep(root, at, params);
    },
  });
})();
