/* Trains (déroulants), sous les noms du menu « Trains » de Circé (25/10) : Liste des trains (composition, fractionnement,
   raccrochage d'un train ou en masse, trains de pré-test et d'entretien créés par la Coordination, suppression, réimpression de
   bague), Suivi par thème (besoin en affiches et pré-assemblage), Préparation (rouleur, bague, colis), suivi 8 m².
   12/11 (utilisatrice) : « les colonnes présentes dans l'ancien Circé doivent être présentes dans la maquette », celles ajoutées
   par la maquette restent, marquées `ajout` (titre en gras rouge). Liste des trains au grain de Circé (une ligne par face) ;
   pages Position Train (CoteCote) et Export préparation (TrainExportPrepa) de Circé ajoutées. */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  let F = null; // filtres de la page (ui.filters)
  const user = () => M.ROLES.find(r => r.id === M.state.role).label;
  const STATUTS_U = ['EN_ATTENTE', 'PRET', 'EN_PROD', 'PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'];
  const PROD = ['EN_PROD', 'PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'];

  /** Pastilles de positions A-D : reçu, manquant (hachuré) ou fractionné (pointillé). Un clic montre le visuel. */
  ui.positions = function (u) {
    return h('span', { class: 'train-pos' }, u.positions.map((p, i) => {
      const t = C.theme(p.themeId), d = C.dossier(t.dossierId);
      const cls = p.fr ? 'fr' : p.couvert ? 'ok' : 'ko';
      const voir = e => { e.stopPropagation(); ui.voirVisuel(t); };
      const chip = h('span', { class: ['pos', cls], tabindex: '0', role: 'button', 'aria-label': String.fromCharCode(65 + i) + ' ' + d.annonceur + ' ' + t.libelle + ' ' + (p.fr ? 'fractionné' : p.couvert ? 'reçu' : 'manquant') + ' : voir le visuel', onclick: voir, onkeydown: e => { if (e.key === 'Enter') voir(e); } }, String.fromCharCode(65 + i));
      ui.tip(chip, () => [h('div', { class: 'tt-title' }, 'Position ' + String.fromCharCode(65 + i)), h('div', { class: 'tt-row' }, d.annonceur + ' · ' + t.libelle), h('div', { class: 'tt-row' }, 'Dossier ' + d.id + (d.controlee ? ' · campagne contrôlée' : '')), h('div', { class: 'tt-row' }, h('b', null, p.fr ? 'Fractionné : produit à part' : p.couvert ? 'Visuel reçu' : 'Visuel manquant')), h('div', { class: 'tt-row muted' }, 'Cliquer pour voir le visuel')]);
      return chip;
    }));
  };

  /** Filtres : N° de dossier, Départ, Atelier, Machine, Statut ; par « + Filtre » : Destinataire, Annonceur, Thème (les trains
      qui contiennent l'un des thèmes choisis, SCR-20), Afficheur et « Trains de » (nombre de visuels, déjà possible dans Circé). */
  function filterDefs() {
    const ats = M.ref.ateliers.filter(a => a.mode === 'train' && (M.state.site === 'ALL' || a.site === M.state.site));
    const base = trainsAll();
    const fr = (a, b) => a.label.localeCompare(b.label, 'fr');
    return [
      ui.dossierFilter(base, C.dossiersOf),
      ui.weekFilter(),
      { key: 'atelier', label: 'Atelier', options: ats.map(a => ({ value: a.id, label: ui.withSite(a.label, a.site) })), get: u => u.atelier },
      { key: 'machine', label: 'Machine', options: M.uniq(ats.flatMap(a => a.machines)).map(id => ({ value: id, label: C.machine(id).label })), get: u => u.machine },
      { key: 'statut', label: 'Statut', options: STATUTS_U.map(s => ({ value: s, label: M.STATUTS[s].label })), get: u => u.statut },
      { key: 'dest', label: 'Destinataire', more: true, options: M.uniq(base.map(u => u.dest)).map(id => ({ value: id, label: C.dest(id).label })).sort(fr), get: u => u.dest },
      { key: 'annonceur', label: 'Annonceur', more: true, options: M.uniq(base.flatMap(u => C.themesOf(u).map(t => C.dossier(t.dossierId).annonceur))).sort((a, b) => a.localeCompare(b, 'fr')).map(a => ({ value: a, label: a })), get: u => M.uniq(C.themesOf(u).map(t => C.dossier(t.dossierId).annonceur)) },
      { key: 'theme', label: 'Thème', more: true, help: 'Les trains qui contiennent l’un des thèmes choisis : pour répartir les thèmes entre opérateurs au roulage',
        options: M.uniq(base.flatMap(u => u.positions.map(p => p.themeId))).map(C.theme).map(t => ({ value: t.id, label: C.dossier(t.dossierId).annonceur + ' · ' + t.libelle, short: t.libelle })).sort(fr), get: u => u.positions.map(p => p.themeId) },
      { key: 'afficheur', label: 'Afficheur', more: true, options: M.uniq(base.map(u => u.afficheur)).map(id => ({ value: id, label: C.afficheur(id).label + ' · ' + C.dest(C.afficheur(id).dest).label, short: C.afficheur(id).label })).sort(fr), get: u => u.afficheur },
      { key: 'npos', label: 'Trains de', more: true, options: [1, 2, 3, 4].map(n => ({ value: n, label: n + ' visuel' + (n > 1 ? 's' : ''), short: String(n) })), get: u => u.positions.length },
    ];
  }
  /** N° de panneau Broadcast de chaque train identique d'une unité (un par train) : fictifs, stables d'un affichage à l'autre. */
  const panneaux = u => {
    let k = 0;
    for (const ch of u.id) k = (k * 31 + ch.charCodeAt(0)) % 900000;
    return Array.from({ length: u.nb }, (_, i) => String(100000 + (k + i * 7919) % 900000));
  };
  /* 12/11 (utilisatrice) : colonnes de Circé sans équivalent dans les données de la maquette (adresse, espace, référence de
     convention du panneau) : valeurs fictives tirées du n° de panneau, donc stables d'un affichage à l'autre. */
  const FICTIF = 'Données fictives (Broadcast, panneau)';
  const hache = s => { let k = 7; for (const ch of String(s)) k = (k * 31 + ch.charCodeAt(0)) % 1000003; return k; };
  const RUES = ['Avenue Jean-Jaurès', 'Boulevard Gambetta', 'Rue de la République', 'Place de la Gare', 'Cours Victor-Hugo', 'Rue Pasteur', 'Avenue de la Libération', 'Quai du Port', 'Rue du Général-Leclerc', 'Boulevard des Arts'];
  const ESPACES = ['Voirie', 'Abri voyageurs', 'Centre commercial', 'Gare', 'Parking relais', 'Parvis'];
  const panneauFictif = pan => {
    const k = hache(pan);
    return { adresse: (1 + k % 148) + ' ' + RUES[Math.floor(k / 149) % RUES.length], espace: ESPACES[Math.floor(k / 7) % ESPACES.length], convention: 'CONV-' + (2018 + k % 7) + '-' + String(Math.floor(k / 11) % 10000).padStart(4, '0') };
  };
  const lettre = i => String.fromCharCode(65 + i);
  const libTrain = u => h('span', null, u.id, u.pretest ? [' ', ui.tag(u.pretest.toLowerCase(), 'hyp')] : null);
  const tonTrain = u => (u.modifs.some(m => m.user === 'Broadcast') && PROD.includes(u.statut) ? 'critical' : u.statut === 'EN_ATTENTE' ? 'serious' : u.statut === 'PRET' ? 'info' : null);
  /** Format d'un train : celui des dossiers de ses visuels (un seul en général). */
  const formatsDe = u => M.uniq(C.themesOf(u).map(t => C.dossier(t.dossierId).format)).join(', ');

  /** 12/11 (utilisatrice) : trains côte à côte (page « Position Train » de Circé, CoteCote) : deux trains posés l'un à côté de
      l'autre sur un même panneau de groupement, qui défilent ensemble. Fictif : des lignes de trains consécutives d'un même
      destinataire, atelier et départ, avec le même nombre de trains, environ une paire sur deux ; calculé sur tous les trains
      (sans les filtres de la page), donc stable d'un affichage à l'autre. */
  function coteACote() {
    const paires = [], parTrain = new Map();
    const grp = M.groupBy(trainsAll().slice().sort((x, y) => x.id.localeCompare(y.id)), u => u.dest + '|' + u.atelier + '|' + C.depart(u).getTime());
    Object.values(grp).forEach(list => {
      for (let i = 0; i + 1 < list.length; i++) {
        const a = list[i], b = list[i + 1];
        if (a.nb !== b.nb || hache(a.id + b.id) % 2) continue;
        const k = hache(a.id + '|' + b.id);
        const pr = { a, b, lien: 'CC-' + (1000 + k % 9000), panel: 'PG-' + (200000 + k % 800000) };
        paires.push(pr);
        parTrain.set(a.id, { cote: 1, autre: b, pr });
        parTrain.set(b.id, { cote: 2, autre: a, pr });
        i++;
      }
    });
    return { paires, parTrain };
  }

  /** Sélectionne les N premiers trains de la liste affichée, dans l'ordre du tri (SCR-21) : on cumule les « Nb trains » des
      lignes jusqu'à N, sans couper une ligne. Exemple : 60 trains de 4 vers une destination, pour un opérateur.
      12/11 (utilisatrice) : dans la Liste des trains, une ligne est une face (un visuel sur un panneau) : on compte les trains
      (un par panneau) et on coche toutes les faces des trains retenus. La Préparation reste à une ligne par ligne de trains. */
  const premiers = { n: 60 };
  function selectionnerPremiers(id) {
    const t = M._tables.get(id);
    if (!t) return;
    // Clé d'une face : « train|panneau|position » ; sinon, la clé est le n° de la ligne de trains
    const trainDe = k => { const p = String(k).split('|'); if (p.length > 1) return { cle: p[0] + '|' + p[1], nb: 1, face: true }; const u = C.unite(k); return { cle: k, nb: (u && u.nb) || 1 }; };
    let tot = 0, suivante = 0, plein = false, parFace = false;
    const pris = new Set(), pick = [];
    for (const row of t.getRows('active')) {
      const { cle, nb, face } = trainDe(row.getData().__k);
      if (face) parFace = true;
      if (!pris.has(cle)) {
        if (plein) continue;
        if (tot + nb > premiers.n) { suivante = nb; plein = true; continue; }
        tot += nb; pris.add(cle);
      }
      pick.push(row);
    }
    t.deselectRow();
    pick.forEach(r => r.select());
    ui.toast(tot ? tot + ' train(s) sélectionné(s), sur ' + pick.length + ' ligne(s)' + (suivante ? (parFace ? ' ; le train suivant dépasserait ' + premiers.n : ' ; la ligne suivante en compte ' + suivante + ' et dépasserait ' + premiers.n) : '') + '.' : 'Aucune ligne de ' + premiers.n + ' train(s) au plus dans la liste.', tot ? 'good' : 'critical');
  }
  /** Outil « Sélectionner les N premiers trains » du tableau `id` (Liste des trains ou Préparation). */
  const outilPremiers = id => h('span',{ class: 'row', style: { gap: '6px', alignItems: 'center', flexWrap: 'nowrap' } },
    h('span', { class: 'small muted' }, 'Sélectionner les'),
    ui.input({ type: 'number', value: premiers.n, min: 1, label: 'Nombre de trains à sélectionner', style: { width: '64px', minWidth: '0' }, onChange: v => { premiers.n = Math.max(1, Number(v) || 1); } }),
    h('span', { class: 'small muted' }, 'premiers trains'),
    ui.btn('Sélectionner', () => selectionnerPremiers(id), { small: true, title: 'Coche les premiers trains de la liste filtrée et triée, jusqu’au nombre choisi' }));
  const trainsAll = () => C.unitesScope({ allWeeks: true }).filter(u => u.kind === 'TRAIN');
  /** Trains filtrés ; sans le filtre Statut pour les indicateurs et le besoin en affiches. */
  const trainsScope = withStatut => (withStatut ? F.apply(trainsAll()) : F.except(trainsAll(), 'statut'));

  function fractionner(us) {
    let n = 0;
    us.forEach(u => {
      if (u.statut !== 'EN_ATTENTE' || !u.positions.some(p => p.couvert)) return;
      u.positions.forEach(p => { if (!p.couvert) p.fr = true; });
      u.fractionne = true; u.statut = 'PRET'; n++;
      u.modifs.push({ date: new Date(M.NOW), user: user(), action: 'Fractionné : lancé sans ' + u.positions.filter(p => p.fr).map(p => C.theme(p.themeId).libelle).join(', ') });
      M.journal(u.id, 'Train fractionné');
    });
    ui.toast(n ? n + ' train(s) fractionné(s) : ils passent « Prêt », les visuels manquants seront produits à part.' : 'Aucun train fractionnable (il faut au moins un visuel reçu).', n ? 'good' : 'critical');
    C.recalculer(); M.refresh();
  }

  /** Visuels raccrochables à un train : même site, même départ, même atelier, pas exclus ni annulés. */
  const candidats = u => M.data.themes.filter(t => { const d = C.dossier(t.dossierId); return d.site === u.site && d.semaine === u.semaine && C.atelier(d.atelier).mode === 'train' && d.atelier === u.atelier && !t.exclu && d.statutPP !== 'ANNULE'; });
  const libVisuel = t => C.dossier(t.dossierId).annonceur + ' · ' + t.libelle + ' (' + t.dossierId + ')';
  /** Ajoute un visuel en dernière position d'un train, avec la ligne de préparation correspondante. */
  function ajouterPosition(u, t, action) {
    u.positions.push({ themeId: t.id, fr: false });
    const l = M.data.lignes.find(x => x.themeId === t.id && x.afficheur === u.afficheur) || (() => { const nl = { id: 'L' + (M.data.lignes.length + 5000), themeId: t.id, dossierId: t.dossierId, site: u.site, semaine: u.semaine, atelier: u.atelier, dest: u.dest, afficheur: u.afficheur, qte: 0, entretien: 0 }; M.data.lignes.push(nl); return nl; })();
    l.qte += u.nb; const tl = M.data.lignes.filter(x => x.themeId === t.id); t.qte = M.sum(tl, x => x.qte); t.qteEnt = t.qte + M.sum(tl, x => x.entretien);
    u.modifs.push({ date: new Date(M.NOW), user: user(), action: action || 'Raccrochage de « ' + t.libelle + ' »' });
  }

  function raccrocher(u) {
    if (PROD.includes(u.statut)) { ui.toast('Train déjà en production : impossible de le modifier (point de non-retour).', 'critical'); return; }
    const deja = new Set(u.positions.map(p => p.themeId));
    const cands = candidats(u).filter(t => !deja.has(t.id));
    let choix = cands[0] ? cands[0].id : '';
    ui.modal({ title: 'Raccrocher un visuel au train ' + u.id, body: [
      ui.annot('Ajoute un visuel arrivé tard (ou une dernière minute) à un train pas encore produit. Le train garde au plus ' + 4 + ' positions (le code existant en accepte 6 : règle à trancher).', ['SCR-08', 'CIB-03']),
      u.positions.length >= 4 ? ui.callout('warning', 'Train complet', ' Ce train a déjà 4 positions.') : null,
      ui.field('Visuel à ajouter', ui.select({ value: choix, options: cands.map(t => ({ value: t.id, label: libVisuel(t) })), onChange: v => { choix = v; } }), true),
    ], actions: [{ label: 'Annuler' }, { label: 'Raccrocher', primary: true, disabled: u.positions.length >= 4 || !cands.length, onClick: () => {
      const t = C.theme(choix); ajouterPosition(u, t); M.journal(u.id, 'Raccrochage de « ' + t.libelle + ' »');
      C.recalculer(); M.refresh();
    } }] });
  }

  /** Raccrochage en masse (SCR-13, T16 #3) : un même visuel ajouté à tous les trains choisis, du même atelier et du même
      départ, pas encore en production, sauf ceux qui sont complets ou qui l'ont déjà. */
  function raccrocherMasse(us) {
    const libres = us.filter(u => !PROD.includes(u.statut));
    if (!libres.length) { ui.toast('Trains déjà en production : impossible de les modifier (point de non-retour).', 'critical'); return; }
    const ref = libres[0];
    const memes = libres.filter(u => u.site === ref.site && u.semaine === ref.semaine && u.atelier === ref.atelier);
    const ecartes = us.length - memes.length;
    const cands = candidats(ref);
    let choix = cands[0] ? cands[0].id : '';
    const box = h('div');
    const draw = () => {
      const ok = memes.filter(u => u.positions.length < 4 && !u.positions.some(p => p.themeId === choix));
      M.mount(box, h('p', { class: 'small', style: { margin: '4px 0 0' } }, h('b', null, ok.length + ' train(s)'), ' recevront ce visuel' + (memes.length - ok.length ? ' ; ' + (memes.length - ok.length) + ' laissé(s) de côté (complets ou qui l’ont déjà)' : '') + '.'));
    };
    draw();
    ui.modal({ title: 'Raccrocher un visuel à ' + memes.length + ' train(s)', wide: true, body: [
      ui.annot('Raccrochage en une fois au lieu de train par train ; aujourd’hui, Circé plante quand il y a trop de lignes (T16 #3). Pas de raccrochage automatique : c’est l’atelier qui choisit entre raccrocher et produire à part (RP34).', ['SCR-13', 'SCR-08', 'CIB-03']),
      ecartes ? ui.callout('warning', ecartes + ' train(s) écarté(s)', ' Déjà en production, ou d’un autre atelier ou d’un autre départ que ' + ref.id + ' (' + C.atelier(ref.atelier).label + ', S' + ref.semaine + ').') : null,
      ui.field('Visuel à ajouter', ui.select({ value: choix, options: cands.map(t => ({ value: t.id, label: libVisuel(t) })), onChange: v => { choix = v; draw(); } }), true),
      box,
    ], actions: [{ label: 'Annuler' }, { label: 'Raccrocher à la sélection', primary: true, disabled: !cands.length, onClick: () => {
      const t = C.theme(choix);
      const ok = memes.filter(u => u.positions.length < 4 && !u.positions.some(p => p.themeId === t.id));
      if (!ok.length) { ui.toast('Aucun train ne peut recevoir ce visuel (complets ou qui l’ont déjà).', 'critical'); return true; }
      M.tick(2);
      ok.forEach(u => ajouterPosition(u, t, 'Raccrochage en masse de « ' + t.libelle + ' »'));
      M.journal(ok.map(u => u.id).slice(0, 5).join(', ') + (ok.length > 5 ? '…' : ''), 'Raccrochage en masse de « ' + t.libelle + ' » sur ' + ok.length + ' train(s)');
      ui.toast('« ' + t.libelle + ' » raccroché à ' + ok.length + ' train(s).', 'good');
      C.recalculer(); M.refresh();
    } }] });
  }

  /** Export des trains du jeudi 14 h, par la Coordination (27/10) : comme dans Circé, seules les faces des dossiers en
      Instruction OK partent et passent « A imprimer », le go des plateformes (PreparationDeroulantsRepository.cs:809) ; un
      dossier « En cours » ne part pas (Instruction OK à faire avant, sinon le vendredi à la main). */
  function exporterTrains(sems) {
    const ds = C.dossiersScope({ allWeeks: true }).filter(d => sems.includes(d.semaine) && C.atelier(d.atelier).mode === 'train' && d.statutPP !== 'ANNULE' && d.statutPP !== 'A_TRAITER');
    const ok = ds.filter(d => ['AUTO', 'MANUEL'].includes(C.instrOK(d)) && !d.exporte), enCours = ds.filter(d => C.instrOK(d) === 'A_FAIRE'), deja = ds.filter(d => d.exporte);
    ui.modal({ title: 'Exporter les trains · départ ' + sems.map(s => 'S' + s).join(', '), body: [
      h('p', { style: { marginTop: 0 } }, ok.length + ' dossier(s) en Instruction OK : leurs faces passent « A imprimer », le go des plateformes.' + (deja.length ? ' ' + deja.length + ' déjà exporté(s).' : '')),
      enCours.length ? ui.callout('warning', enCours.length + ' dossier(s) « En cours »', ' Ils ne partent pas : Instruction OK à faire avant l’export, sinon le vendredi, à la main.') : null,
      // 12/11 (utilisatrice) : l'export envoie une alerte à la plateforme ; un dossier de la même semaine arrivé après en envoie une autre
      h('p', { class: 'small' }, 'Une alerte part à chaque plateforme concernée (chefs d’équipe, réception) : c’est son go. Un dossier de la même semaine qui arrive ensuite déclenche une autre alerte.'),
      ui.annot('Jeudi 14 h, par la Coordination, une fois toutes les instructions reçues ou le maximum : Instructions OK restantes, vérification de la préparation des trains, puis cet export. Comme dans Circé, il ne prend que les faces en Instruction OK. Les plateformes commencent souvent avant, à leurs risques ; l’export est leur go.', ['PP-06', 'SCR-11']),
    ], actions: [{ label: 'Annuler' }, { label: 'Exporter', primary: true, disabled: !ok.length, onClick: () => {
      M.tick(3);
      ok.forEach(d => { d.exporte = { date: new Date(M.NOW), user: user() }; d.historique.push({ date: new Date(M.NOW), user: user(), action: 'Trains exportés : faces « A imprimer »' }); });
      // 12/11 : export gardé par plateforme et semaine (M.data.exportsTrains, lu par M.alerteApresExport) ; une alerte EXPORT_TRAINS
      // par plateforme et semaine exportée, pour la plateforme (chefs d'équipe, réception) : c'est son go
      const exps = M.data.exportsTrains = M.data.exportsTrains || [];
      const avertis = new Set();
      M.uniq(ok.map(d => d.site)).forEach(site => sems.forEach(s => {
        const partis = ok.filter(d => d.site === site && d.semaine === s), restes = enCours.filter(d => d.site === site && d.semaine === s);
        if (!partis.length) return;
        exps.push({ site, semaine: s, date: new Date(M.NOW), user: user(), dossiers: partis.map(d => d.id) });
        M.data.events.push({ key: 'EXP-' + site + '-S' + s + '-' + M.NOW.getTime(), type: 'EXPORT_TRAINS', sev: 'info', site, semaine: s, date: new Date(M.NOW),
          titre: 'Trains exportés : go de la plateforme (S' + s + ')',
          message: 'Export des trains de la S' + s + ' fait le ' + M.fmt.dt(M.NOW) + ' par ' + user() + ' : ' + partis.length + ' dossier(s) en Instruction OK, faces « A imprimer » (' + partis.map(d => d.id).join(', ') + '). La plateforme peut lancer la production.'
            + (restes.length ? ' ' + restes.length + ' dossier(s) « En cours » ne sont pas partis (' + restes.map(d => d.id).join(', ') + ').' : '') + ' Un dossier de la S' + s + ' qui arrive après cet export aura sa propre alerte.',
          link: { screen: 'trains', params: { tab: 'prepa' } }, needs: ['PP-06'], roles: ['cheq', 'recep'] });
        avertis.add(C.site(site).label);
      }));
      const qui = Array.from(avertis).join(', ');
      M.journal(sems.map(s => 'S' + s).join(', '), 'Export des trains : ' + ok.length + ' dossier(s) « A imprimer »' + (enCours.length ? ', ' + enCours.length + ' « En cours » non exporté(s)' : '') + ' ; alerte à la plateforme de ' + qui);
      ui.toast(ok.length + ' dossier(s) exporté(s) : faces « A imprimer ». Alerte envoyée à la plateforme de ' + qui + '.' + (enCours.length ? ' ' + enCours.length + ' dossier(s) « En cours » ne partent pas.' : ''), 'good');
      M.refresh();
    } }] });
  }

  /** Trains de pré-test ou d'entretien créés par la Coordination (SCR-12, T16 #2) : aujourd'hui gérés hors process. */
  function creerTrain() {
    const ats = M.ref.ateliers.filter(a => a.mode === 'train' && (M.state.site === 'ALL' || a.site === M.state.site));
    if (!ats.length) { ui.toast('Pas d’atelier déroulant sur ce site.', 'critical'); return; }
    const st = { atelier: ats[0].id, semaine: M.state.semaine, type: 'Pré-test', theme: '', dest: '', nb: 1 };
    const body = h('div');
    const draw = () => {
      const at = C.atelier(st.atelier);
      const cands = M.data.themes.filter(t => { const d = C.dossier(t.dossierId); return d.atelier === at.id && d.semaine >= st.semaine && !t.exclu && d.statutPP !== 'ANNULE'; });
      if (!cands.some(t => t.id === st.theme)) st.theme = cands[0] ? cands[0].id : '';
      const dests = M.ref.destinataires.filter(x => x.site === at.site);
      if (!dests.some(x => x.id === st.dest)) st.dest = dests[0] ? dests[0].id : '';
      M.mount(body,
        ui.annot('Trains de pré-test ou d’entretien, créés par la Coordination dans Circé au lieu d’être gérés hors process. Ils suivent ensuite le circuit normal : couverture des visuels, fichier ou bagues, roulage.', ['SCR-12']),
        h('div', { class: 'grid cols-2' },
          ui.field('Atelier', ui.select({ value: st.atelier, options: ats.map(a => ({ value: a.id, label: ui.withSite(a.label, a.site) })), onChange: v => { st.atelier = v; draw(); } })),
          ui.field('Départ', ui.select({ value: st.semaine, options: M.ref.semaines.map(s => s.num).filter(n => n >= M.state.semaine).map(n => ({ value: n, label: 'S' + n })), onChange: v => { st.semaine = Number(v); draw(); } })),
          ui.field('Type', ui.select({ value: st.type, options: ['Pré-test', 'Entretien'], onChange: v => { st.type = v; } })),
          ui.field('Nombre de trains', ui.input({ type: 'number', value: st.nb, min: 1, max: 9, onChange: v => { st.nb = Math.max(1, Math.min(9, Number(v) || 1)); } })),
          ui.field('Visuel', ui.select({ value: st.theme, options: cands.length ? cands.map(t => ({ value: t.id, label: libVisuel(t) })) : [{ value: '', label: 'Aucun visuel pour cet atelier et ce départ' }], onChange: v => { st.theme = v; } })),
          ui.field('Destinataire', ui.select({ value: st.dest, options: dests.map(x => ({ value: x.id, label: x.label })), onChange: v => { st.dest = v; } }))));
    };
    draw();
    ui.modal({ title: 'Créer un train de pré-test ou d’entretien', wide: true, body, actions: [{ label: 'Annuler' }, { label: 'Créer le train', primary: true, onClick: () => {
      const at = C.atelier(st.atelier), aff = M.data.afficheurs.find(a => a.dest === st.dest);
      if (!st.theme || !aff) { ui.toast('Choisissez un visuel et un destinataire.', 'critical'); return true; }
      M.tick(2);
      const u = { id: 'TR-P' + String(M.data.unites.length + 1).padStart(4, '0'), kind: 'TRAIN', pretest: st.type, site: at.site, semaine: st.semaine, atelier: at.id, machine: at.machines[0], dest: st.dest, afficheur: aff.id, nb: st.nb, positions: [{ themeId: st.theme, fr: false }], statut: 'EN_ATTENTE', bague: false, operateur: null, generation: null,
        modifs: [{ date: new Date(M.NOW), user: user(), action: 'Train de ' + st.type.toLowerCase() + ' créé par la Coordination' }] };
      M.data.unites.push(u);
      C.recalculer();
      M.journal(u.id, 'Train de ' + st.type.toLowerCase() + ' créé (' + C.theme(st.theme).libelle + ', ' + st.nb + ' train(s))');
      ui.toast('Train ' + u.id + ' créé (' + st.type.toLowerCase() + ') : ' + M.STATUTS[u.statut].label.toLowerCase() + '.', 'good');
      M.refresh();
    } }] });
  }

  /** Supprimer un train pas encore produit (SCR-12) : affichage qui ne se fait pas, affiche à ne pas poser. */
  function supprimerTrain(u) {
    if (PROD.includes(u.statut)) { ui.toast('Train déjà en production : impossible de le supprimer (point de non-retour).', 'critical'); return; }
    let motif = 'Affichage qui ne se fait pas';
    ui.modal({ title: 'Supprimer le train ' + u.id, body: [
      ui.annot('Un train pas encore produit peut être supprimé, par exemple quand l’affichage ne se fait pas ou qu’une affiche ne doit pas être posée (cas de la Ville de Paris, parfois seule dans son train).', ['SCR-12', 'CIB-03']),
      h('p', null, u.nb + ' train(s) vers ' + C.dest(u.dest).label + ' : ' + u.positions.map(p => C.theme(p.themeId).libelle).join(', ') + '.'),
      ui.field('Motif', ui.select({ value: motif, options: ['Affichage qui ne se fait pas', 'Ville de Paris : affiche à ne pas poser', 'Pré-test annulé', 'Autre'], onChange: v => { motif = v; } })),
    ], actions: [{ label: 'Annuler' }, { label: 'Supprimer le train', danger: true, onClick: () => {
      M.tick(1);
      const i = M.data.unites.indexOf(u);
      if (i >= 0) M.data.unites.splice(i, 1);
      M.journal(u.id, 'Train supprimé : ' + motif);
      ui.toast('Train ' + u.id + ' supprimé (' + motif.toLowerCase() + ').', 'good');
      C.recalculer(); M.refresh();
    } }] });
  }

  function trainModal(u) {
    const dest = C.dest(u.dest);
    ui.modal({ title: 'Train ' + u.id, wide: true, body: [
      h('div', { class: 'row', style: { marginBottom: '8px' } }, ui.pill(u.statut), ui.tag(C.atelier(u.atelier).label + ' · ' + C.site(u.site).label), ui.tag(C.machine(u.machine).label), ui.tag(u.nb + ' train(s) identique(s)'), u.fractionne ? ui.tag('Fractionné', 'hyp') : null, u.pretest ? ui.tag(u.pretest, 'hyp') : null, u.reimpressions ? ui.tag('Bague réimprimée ' + u.reimpressions + ' fois', 'hyp') : null),
      h('div', { class: 'small muted' }, dest.label + ' · ' + C.afficheur(u.afficheur).label + ' · départ ' + dest.boucle + ' le ' + M.fmt.day(C.depart(u)) + ' ' + M.fmt.hm(C.depart(u)) + (u.generation ? ' · fichier ' + u.generation : '')),
      h('div', { class: 'small', style: { marginTop: '4px' } }, h('span', { class: 'muted' }, 'Panneaux Broadcast : '), h('span', { class: 'mono' }, panneaux(u).join(', '))),
      h('div', { class: 'table-wrap mt' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Pos.', 'Annonceur', 'Thème', 'Dossier', 'Reçu / attendu', 'État', 'Emplacement des affiches'].map(x => h('th', null, x)))),
        h('tbody', null, u.positions.map((p, i) => { const t = C.theme(p.themeId), d = C.dossier(t.dossierId); const afs = M.data.affiches.filter(a => a.alloc.some(x => x.themeId === t.id)); return h('tr', null, h('td', null, String.fromCharCode(65 + i)), h('td', null, d.annonceur), h('td', null, ui.btnVisuel(t), t.libelle), h('td', null, d.id), h('td', { class: 'num' }, C.recu(t.id) + ' / ' + t.qteEnt), h('td', null, p.fr ? ui.tag('Fractionné', 'hyp') : p.couvert ? ui.sev('good', 'Reçu') : ui.sev('critical', 'Manquant')), h('td', null, afs.map(a => a.allee + '-' + a.rayon).join(', ') || '—')); })))),
      u.modifs.length ? [h('h3', { style: { fontSize: '14px', margin: '12px 0 6px' } }, 'Modifications tracées'), h('ul', { class: 'cz-timeline' }, u.modifs.map(m => h('li', null, h('span', { class: 'when' }, M.fmt.dt(m.date)), h('span', null, m.action + ' · ' + m.user))))] : null,
    ], actions: [{ label: 'Fermer' },
      { label: 'Supprimer…', danger: true, disabled: PROD.includes(u.statut), onClick: () => { setTimeout(() => supprimerTrain(u), 0); } },
      u.bague ? { label: 'Réimprimer la bague…', onClick: () => { setTimeout(() => ui.reimprimerBague(u), 0); } } : null,
      { label: 'Raccrocher un visuel', onClick: () => { raccrocher(u); } }, { label: 'Fractionner', disabled: u.statut !== 'EN_ATTENTE', onClick: () => fractionner([u]) }].filter(Boolean) });
  }

  /** Liste des trains, au grain de Circé (PreparationDeroulants/_FacesTrainsGrid) : une ligne par face, c'est-à-dire un visuel
      d'un train sur un panneau (tf_face_train : un thème, un contrat, un annonceur et une position par face). 12/11
      (utilisatrice) : un seul tableau, sans bascule ; les colonnes de Circé d'abord, dans son ordre, puis celles de la maquette
      (niveau train), marquées `ajout` (titre en gras rouge : absentes de l'ancien Circé). Les actions en lot portent sur les
      trains des faces cochées, chacun une seule fois. */
  function tabTrains(root, params) {
    const us = trainsScope(true);
    const cc = coteACote().parTrain;
    const faces = us.flatMap(u => panneaux(u).flatMap(pan => u.positions.map((p, k) => {
      const t = C.theme(p.themeId);
      return { id: u.id + '|' + pan + '|' + k, u, p, k, pan, t, d: C.dossier(t.dossierId) };
    })));
    const trainsDe = sel => M.uniq(sel.map(f => f.u));
    const nTrains = M.sum(us, u => u.nb);
    root.append(
      ui.annot('Une ligne par face, comme Circé : un visuel d’un train sur un panneau (' + faces.length + ' face(s) pour ' + nTrains + ' train(s)). Les actions en lot agissent sur les trains des faces cochées ; « Sélectionner les N premiers trains » coche toutes les faces de chaque train retenu. Par « + Filtre » : Thème (les trains qui contiennent l’un des thèmes choisis), Afficheur et Trains de 1 à 4 visuels. Adresse, Espace, ReferenceConvention et Cote Cote sont des données fictives ; titres en gras rouge : colonnes ajoutées par la maquette.', ['SCR-20', 'SCR-21', 'SCR-23', 'ERG-03']),
      ui.card({ flush: true, body: ui.table({
        id: 'trains-faces', rows: faces, query: params.q, selectable: true, exportName: 'trains-faces.csv', onRowClick: f => trainModal(f.u), toolbar: outilPremiers('trains-faces'),
        tone: f => tonTrain(f.u),
        bulkActions: (sel, clear) => { const ts = trainsDe(sel); return [
          h('span', { class: 'small muted' }, '(' + ts.length + ' ligne(s) de trains)'),
          ui.btn('Fractionner', () => { fractionner(ts); clear(); }, { small: true }),
          ui.btn('Raccrocher un visuel', () => { raccrocherMasse(ts); clear(); }, { small: true }),
          // Fichiers Vendôme : les trains prêts choisis ici arrivent déjà cochés dans le générateur (le chef d'équipe choisit, SCR-06 abandonné)
          ui.btn('Générer les fichiers', () => { M.genState.preselect = ts.filter(u => u.statut === 'PRET' && u.machine === ts[0].machine).map(u => u.id); M.go('generateur', { machine: ts[0].machine }); }, { small: true, primary: true }),
          ui.btn('Imprimer les bagues', () => M.go('bagues'), { small: true }),
        ]; },
        columns: [
          // Colonnes de Circé (_FacesTrainsGrid), dans son ordre
          { key: 'face', label: 'Face', title: 'N° de panneau Broadcast de la face, et position du visuel dans le train (A, B…)', value: f => f.pan + ' ' + lettre(f.k),
            render: f => h('span', { class: 'mono' }, f.pan, h('span', { class: 'muted' }, ' · ' + lettre(f.k))) },
          { key: 'format', label: 'Format', value: f => f.d.format },
          { key: 'visuel', label: 'Visuel', value: f => f.t.libelle,
            render: f => h('span', null, ui.btnVisuel(f.t), f.t.libelle, f.p.fr ? [' ', ui.tag('fractionné', 'hyp')] : !f.p.couvert ? [' ', ui.sev('critical', 'Manquant')] : null) },
          { key: 'repiquage', label: 'Repiquage', value: f => f.t.repiquage || '' },
          { key: 'statut', label: 'Statut', render: f => ui.pill(f.u.statut), value: f => M.STATUTS[f.u.statut].label },
          { key: 'dossier', label: 'Dossier', value: f => f.d.id },
          { key: 'annonceur', label: 'Annonceur', value: f => f.d.annonceur },
          { key: 'dest', label: 'Destinataire', value: f => C.dest(f.u.dest).label },
          { key: 'id', label: 'Train', value: f => f.u.id, render: f => libTrain(f.u) },
          { key: 'commune', label: 'Commune', title: 'Commune du panneau : dans la maquette, celle du destinataire', value: f => C.dest(f.u.dest).label },
          { key: 'adresse', label: 'Adresse', title: FICTIF, value: f => panneauFictif(f.pan).adresse },
          { key: 'espace', label: 'Espace', title: FICTIF, value: f => panneauFictif(f.pan).espace },
          { key: 'refConvention', label: 'ReferenceConvention', title: FICTIF, value: f => panneauFictif(f.pan).convention },
          { key: 'coteCote', label: 'Cote Cote', title: 'Côte à côte : côté du train (1 ou 2) sur le panneau de groupement, et le train d’à côté (page Position Train). ' + FICTIF,
            value: f => { const c = cc.get(f.u.id); return c ? c.cote + ' (avec ' + c.autre.id + ')' : ''; } },
          // Colonnes propres à la maquette, au niveau du train de la face (ajout : absentes de l'ancien Circé)
          { key: 'atelier', label: 'Atelier', ajout: true, value: f => ui.withSite(C.atelier(f.u.atelier).label, f.u.site) },
          { key: 'machine', label: 'Machine', ajout: true, value: f => C.machine(f.u.machine).label },
          { key: 'positions', label: 'Positions', ajout: true, sortable: false, title: 'Les visuels du train, position par position', render: f => ui.positions(f.u), csv: f => f.u.positions.map(p => C.theme(p.themeId).libelle).join(' | ') },
          { key: 'nb', label: 'Nb trains', ajout: true, align: 'num', title: 'Trains identiques de la ligne de trains dont la face fait partie', value: f => f.u.nb },
          { key: 'depart', label: 'Départ camion', ajout: true, value: f => C.depart(f.u).getTime(), render: f => M.fmt.day(C.depart(f.u)) + ' ' + M.fmt.hm(C.depart(f.u)) },
          { key: 'afficheur', label: 'Afficheur', ajout: true, hidden: true, value: f => C.afficheur(f.u.afficheur).label },
          // N° de panneau Broadcast, affichable par les chefs d'équipe et les coordinateurs (SCR-23) : le même que dans « Face »
          { key: 'panneau', label: 'N° panneau BC', ajout: true, hidden: true, title: 'N° de panneau Broadcast de la face (le même que dans « Face »)', value: f => f.pan, render: f => h('span', { class: 'mono' }, f.pan) },
          { key: 'generation', label: 'Fichier', ajout: true, hidden: true, value: f => f.u.generation || '' },
          { key: 'bague', label: 'Bague', ajout: true, hidden: true, value: f => f.u.bague ? 'Imprimée' : '' },
          { key: 'modifs', label: 'Modifications', ajout: true, hidden: true, align: 'num', value: f => f.u.modifs.length },
        ],
      }) }));
  }

  /** 12/11 (utilisatrice) : bouton d'ordre du thème (Suivi par thème de Circé, _MajOrdreTheme) : le visuel passe à la position
      choisie dans les trains filtrés qui le portent et ne sont pas encore en production ; les autres visuels se décalent. */
  function ordreTheme(r, us) {
    const tous = us.filter(u => u.positions.some(p => p.themeId === r.id));
    const trains = tous.filter(u => !PROD.includes(u.statut));
    let rang = 0;
    ui.modal({ title: 'Ordre de « ' + r.t.libelle + ' » dans ses trains', body: [
      ui.annot('Comme le bouton d’ordre du Suivi par thème de Circé : le visuel passe à la position choisie dans ses trains pas encore en production, les autres visuels se décalent. Les campagnes contrôlées vont en tête de train (SCR-09) : à vérifier après le changement.', ['SCR-08', 'SCR-09']),
      h('p', null, trains.length + ' ligne(s) de trains concernée(s), ' + M.sum(trains, u => u.nb) + ' train(s)' + (trains.length < tous.length ? ' ; ' + (tous.length - trains.length) + ' déjà en production ne bougent pas.' : '.')),
      ui.field('Position dans le train', ui.select({ value: rang, options: [0, 1, 2, 3].map(i => ({ value: i, label: lettre(i) + (i === 0 ? ' (en tête)' : '') })), onChange: v => { rang = Number(v); } }), true),
    ], actions: [{ label: 'Annuler' }, { label: 'Changer l’ordre', primary: true, disabled: !trains.length, onClick: () => {
      M.tick(1);
      trains.forEach(u => {
        const i = u.positions.findIndex(p => p.themeId === r.id);
        const [p] = u.positions.splice(i, 1);
        u.positions.splice(Math.min(rang, u.positions.length), 0, p);
        u.modifs.push({ date: new Date(M.NOW), user: user(), action: 'Ordre : « ' + r.t.libelle + ' » en position ' + lettre(Math.min(rang, u.positions.length - 1)) });
      });
      M.journal(r.t.dossierId, 'Ordre de « ' + r.t.libelle + ' » : position ' + lettre(rang) + ' dans ' + trains.length + ' ligne(s) de trains');
      ui.toast('« ' + r.t.libelle + ' » placé en position ' + lettre(rang) + ' (ou en dernier) dans ' + trains.length + ' ligne(s) de trains.', 'good');
      C.recalculer(); M.refresh();
    } }] });
  }

  function tabBesoin(root) {
    const us = trainsScope(false);
    // Avec le filtre Thème, seuls les visuels choisis (les trains filtrés contiennent aussi d'autres visuels)
    const choisis = F.sel('theme');
    const map = new Map();
    us.forEach(u => u.positions.forEach(p => {
      if (choisis.length && !choisis.includes(p.themeId)) return;
      const e = map.get(p.themeId) || { besoin: 0, unites: 0, statuts: {} };
      e.besoin += u.nb; e.unites++; e.statuts[u.statut] = (e.statuts[u.statut] || 0) + u.nb; // 12/11 : trains par statut
      map.set(p.themeId, e);
    }));
    const rows = Array.from(map.entries()).map(([id, e]) => {
      const t = C.theme(id), d = C.dossier(t.dossierId);
      const afs = M.data.affiches.filter(a => a.alloc.some(x => x.themeId === id));
      const enProd = us.some(u => PROD.includes(u.statut) && u.positions.some(p => p.themeId === id));
      if (t.preassemble === undefined) t.preassemble = enProd;
      const entretien = t.qteEnt - t.qte;
      return { id, t, d, annonceur: d.annonceur, theme: t.libelle, dossier: d.id, format: d.format, repiquage: t.repiquage, besoin: e.besoin, entretien, recu: C.recu(id), ok: C.recu(id) >= t.qteEnt, empl: afs.map(a => a.allee + '-' + a.rayon).join(', '), pre: t.preassemble,
        statuts: e.statuts, qte: e.besoin + entretien };
    });
    // Statuts d'une ligne, dans l'ordre du cycle de vie des trains
    const statutsDe = r => Object.keys(r.statuts).sort((a, b) => STATUTS_U.indexOf(a) - STATUTS_U.indexOf(b));
    root.append(
      ui.annot('Besoin en affiches par visuel, avec l’emplacement en stock pour le picking. Le pré-assemblage se coche par lot ou ligne à ligne ; l’assemblage peut commencer dès réception, sans attendre le blocage adresse. 12/11 : toutes les colonnes de Circé, dans son ordre, avec ses deux boutons (ordre du thème, pré-assemblage) ; Circé fait une ligne par thème et par statut, la maquette une ligne par thème avec le nombre de trains de chaque statut. Titres en gras rouge : colonnes ajoutées par la maquette.', ['SCR-01', 'SCR-07', 'CIB-14', 'ERG-03']),
      ui.card({ flush: true, body: ui.table({
        id: 'trains-besoin', rows, selectable: true, exportName: 'besoin-affiches-par-theme.csv', tone: r => r.ok ? null : 'serious',
        bulkActions: (sel, clear) => [ui.btn('Marquer pré-assemblé', () => { sel.forEach(r => { r.t.preassemble = true; }); clear(); M.journal('pré-assemblage', sel.length + ' visuel(s) pré-assemblé(s)'); M.refresh(); }, { small: true, primary: true }), ui.btn('Désassembler', () => { sel.forEach(r => { r.t.preassemble = false; }); clear(); M.refresh(); }, { small: true })],
        // Les deux boutons de ligne de Circé : ordre du thème dans les trains, et lien de pré-assemblage
        rowActions: r => [
          ui.btn('Ordre…', () => ordreTheme(r, us), { small: true, title: 'Changer la position de ce visuel dans ses trains (bouton d’ordre du thème de Circé)' }),
          ui.btn(r.pre ? 'Désassembler' : 'Pré-assembler', () => { r.t.preassemble = !r.pre; M.journal(r.dossier, '« ' + r.theme + ' » ' + (r.pre ? 'désassemblé' : 'pré-assemblé')); M.refresh(); }, { small: true, title: 'Lien de pré-assemblage de Circé, pour ce seul visuel' }),
        ],
        columns: [
          // 12/11 (utilisatrice) : colonnes de Circé (TrainSuiviTheme), visibles et dans son ordre ; Annonceur et Thème séparés
          { key: 'annonceur', label: 'Annonceur' }, { key: 'format', label: 'Format' },
          { key: 'theme', label: 'Thème', render: r => h('span', null, ui.btnVisuel(r.t), r.theme) }, { key: 'repiquage', label: 'Repiquage' },
          { key: 'statut', label: 'Statut', title: 'Statut des trains qui portent le visuel, avec leur nombre (dans Circé : une ligne par statut)',
            value: r => statutsDe(r).map(s => M.STATUTS[s].label + ' (' + r.statuts[s] + ')').join(', '),
            render: r => h('span', null, statutsDe(r).map((s, i) => [i ? ' ' : null, ui.pill(s, '(' + r.statuts[s] + ')')])) },
          { key: 'pre', label: 'Pré-assemblage', value: r => r.pre ? 'Fait' : '', render: r => r.pre ? ui.sev('good', 'Fait') : h('span', { class: 'muted' }, '—') },
          { key: 'qte', label: 'Quantité', align: 'num', title: 'Nombre de faces du visuel, comme dans Circé : faces des trains (Besoin) et faces d’entretien (Entretien), que p_u_associe_train.sql range dans la même table' },
          // Colonnes propres à la maquette (ajout : absentes de l'ancien Circé). « Annonceur · thème » répète les deux colonnes de
          // Circé ci-dessus : masquée, elle reste dans « Colonnes ».
          ui.colVisuel(null, { ajout: true, hidden: true }),
          { key: 'dossier', label: 'Dossier', ajout: true },
          { key: 'besoin', label: 'Besoin (trains)', ajout: true, align: 'num' }, { key: 'entretien', label: 'Entretien', ajout: true, align: 'num', title: 'Existant : faces « ENTRETIEN » par destinataire et thème (p_u_associe_train.sql)' },
          { key: 'recu', label: 'Reçu', ajout: true, align: 'num' }, { key: 'ok', label: 'Couvert', ajout: true, render: r => r.ok ? ui.sev('good', 'Oui') : ui.sev('critical', 'Non') },
          { key: 'empl', label: 'Emplacement', ajout: true },
        ],
      }) }));
  }

  /** Choisir le rouleur des trains cochés (Préparation de Circé, TrainPreparation/_SelectRouleur.cshtml), sans imprimer la
      bague : l'impression le redemande et passe le train « En production ». */
  function choisirRouleur(us) {
    const ops = M.data.operateurs.filter(o => us.some(u => u.site === o.site));
    let op = ops[0] ? ops[0].label : '';
    ui.modal({ title: 'Rouleur de ' + us.length + ' ligne(s) de trains', body: [
      ui.field('Rouleur', ui.select({ value: op, options: ops.map(o => ({ value: o.label, label: o.label + ' · ' + C.site(o.site).label + ' · ' + o.poste })), onChange: v => { op = v; } }), true),
    ], actions: [{ label: 'Annuler' }, { label: 'Affecter', primary: true, disabled: !ops.length, onClick: () => {
      us.forEach(u => { u.operateur = op; u.modifs.push({ date: new Date(M.NOW), user: user(), action: 'Rouleur : ' + op }); });
      M.journal(us.map(u => u.id).slice(0, 5).join(', ') + (us.length > 5 ? '…' : ''), 'Rouleur ' + op + ' affecté à ' + us.length + ' ligne(s) de trains');
      ui.toast(op + ' affecté à ' + us.length + ' ligne(s) de trains.', 'good'); M.refresh();
    } }] });
  }

  /** Préparation (TrainPreparation de Circé) : les trains à rouler avec leur pré-assemblage, leur rouleur, leur bague et
      leur colis. 12/11 (utilisatrice) : une ligne par ligne de trains comme Circé, ses colonnes dans son ordre, puis celles de
      la maquette, marquées `ajout`. */
  function tabPrepa(root, params) {
    const us = trainsScope(true);
    const enProd = new Set(trainsAll().filter(u => PROD.includes(u.statut)).flatMap(u => u.positions.map(p => p.themeId)));
    // Pré-assemblage d'un train : fait quand tous ses visuels non fractionnés le sont (Suivi par thème)
    const pre = u => u.positions.filter(p => !p.fr).every(p => { const t = C.theme(p.themeId); return t.preassemble !== undefined ? t.preassemble : enProd.has(t.id); });
    /* 12/11 (utilisatrice) : colonnes « Annonceur 1 à 6 », « Contrat 1 à 6 », « Visuel 1 à 6 » et « Repiquage 1 à 6 » de Circé
       (une par position du train, 6 au plus dans le code de Circé) ; vides au-delà des positions du train. */
    const POS = [0, 1, 2, 3, 4, 5];
    const fp = (u, i) => { const p = u.positions[i]; if (!p) return null; const t = C.theme(p.themeId); return { p, t, d: C.dossier(t.dossierId) }; };
    const parPosition = (lib, key, val, render) => POS.map(i => ({ key: key + (i + 1), label: lib + ' ' + (i + 1), title: lib + ' de la position ' + lettre(i) + ' du train',
      value: u => { const f = fp(u, i); return f ? val(f) : ''; }, render: render ? u => { const f = fp(u, i); return f ? render(f) : '—'; } : undefined }));
    root.append(
      ui.annot('Tableau « Préparation » du menu Trains de Circé : rouleur, bague et colis de chaque train, avec le pré-assemblage repris du Suivi par thème. 12/11 : toutes les colonnes de Circé, dans son ordre (Quantité = nombre de trains identiques, Jour départ = départ du camion) ; les positions 5 et 6 restent vides (4 au plus dans la maquette, 6 dans le code de Circé : règle à trancher). Titres en gras rouge : colonnes ajoutées par la maquette.', ['SCR-01', 'SCR-07', 'PROC-08']),
      ui.card({ flush: true, body: ui.table({
        id: 'trains-prepa', rows: us, query: params.q, selectable: true, exportName: 'preparation-trains.csv', onRowClick: trainModal, toolbar: outilPremiers('trains-prepa'),
        tone: u => u.statut === 'EN_ATTENTE' ? 'serious' : u.statut === 'PRET' && !u.operateur ? 'info' : null,
        bulkActions: (sel, clear) => [
          ui.btn('Choisir le rouleur…', () => { choisirRouleur(sel); clear(); }, { small: true }),
          ui.btn('Générer les fichiers', () => { M.genState.preselect = sel.filter(u => u.statut === 'PRET' && u.machine === sel[0].machine).map(u => u.id); M.go('generateur', { machine: sel[0].machine }); }, { small: true, primary: true }),
          ui.btn('Imprimer les bagues', () => M.go('bagues'), { small: true }),
        ],
        // Les deux boutons de ligne de Circé : mise à jour du train (_MiseAJourTrain) et rouleur
        rowActions: u => [
          ui.btn('Modifier', () => trainModal(u), { small: true, title: 'Mise à jour du train : visuels, raccrochage, fractionnement, suppression' }),
          ui.btn('Rouleur…', () => choisirRouleur([u]), { small: true, title: 'Choisir le rouleur de ce train' }),
        ],
        columns: [
          // Colonnes de Circé (TrainPreparation), dans son ordre
          { key: 'dest', label: 'Destinataire', value: u => C.dest(u.dest).label },
          { key: 'statut', label: 'Statut', render: u => ui.pill(u.statut), value: u => M.STATUTS[u.statut].label },
          { key: 'format', label: 'Format', value: u => formatsDe(u) },
          { key: 'afficheur', label: 'Afficheur', value: u => C.afficheur(u.afficheur).label },
          { key: 'nb', label: 'Quantité', align: 'num', title: 'Nombre de trains identiques de la ligne (« Nb trains » de la Liste des trains)' },
          { key: 'pre', label: 'Pré-assemblage', value: u => pre(u) ? 'Fait' : '', render: u => pre(u) ? ui.sev('good', 'Fait') : h('span', { class: 'muted' }, '—') },
          { key: 'depart', label: 'Jour départ', title: 'Départ du camion, jour et heure (« Départ camion » ailleurs dans la maquette)', value: u => C.depart(u).getTime(), render: u => M.fmt.day(C.depart(u)) + ' ' + M.fmt.hm(C.depart(u)) },
          ...parPosition('Annonceur', 'annonceur', f => f.d.annonceur),
          { key: 'id', label: 'Train', nowrap: true, render: libTrain },
          ...parPosition('Contrat', 'contrat', f => f.d.id),
          ...parPosition('Visuel', 'visuel', f => f.t.libelle, f => h('span', null, ui.btnVisuel(f.t), f.t.libelle, f.p.fr ? [' ', ui.tag('fractionné', 'hyp')] : null)),
          ...parPosition('Repiquage', 'repiquage', f => f.t.repiquage || ''),
          { key: 'colis', label: 'Colis', value: u => u.colis || '' },
          { key: 'rouleur', label: 'Rouleur', value: u => u.operateur || '', render: u => u.operateur || h('span', { class: 'muted' }, '—') },
          // Colonnes propres à la maquette (ajout : absentes de l'ancien Circé)
          { key: 'positions', label: 'Positions', ajout: true, sortable: false, title: 'Les visuels du train, position par position', render: ui.positions, csv: u => u.positions.map(p => C.theme(p.themeId).libelle).join(' | ') },
          { key: 'atelier', label: 'Atelier', ajout: true, value: u => ui.withSite(C.atelier(u.atelier).label, u.site), hidden: true },
          { key: 'machine', label: 'Machine', ajout: true, value: u => C.machine(u.machine).label, hidden: true },
          { key: 'bague', label: 'Bague', ajout: true, value: u => u.bague ? 'Imprimée' : '', hidden: true },
        ],
      }) }));
  }

  /** 12/11 (utilisatrice) : « Position Train » de Circé (CoteCote) : deux trains côte à côte sur un même panneau de groupement
      défilent ensemble ; une ligne par position (A, B…), avec le visuel de chaque train à cette position. Paires fictives
      (voir coteACote) ; une paire s'affiche dès qu'un de ses deux trains passe les filtres de la page. */
  function tabPositions(root) {
    const ids = new Set(trainsScope(true).map(u => u.id));
    const paires = coteACote().paires.filter(pr => ids.has(pr.a.id) || ids.has(pr.b.id));
    const rows = paires.flatMap(pr => Array.from({ length: Math.max(pr.a.positions.length, pr.b.positions.length) }, (_, k) => ({ id: pr.lien + '|' + k, pr, k, a: pr.a, b: pr.b })));
    const fp = (r, s) => { const p = r[s].positions[r.k]; if (!p) return null; const t = C.theme(p.themeId); return { p, t, d: C.dossier(t.dossierId) }; };
    // Les colonnes d'un côté (s = 'a' ou 'b') : N° Train, Statut, Dossier, Annonceur, Visuel
    const cote = s => [
      { key: 'train' + s, label: 'N° Train', value: r => r[s].id,
        render: r => h('button', { type: 'button', class: 'btn btn-sm btn-ghost-secondary', title: 'Voir le train ' + r[s].id, onclick: e => { e.stopPropagation(); trainModal(r[s]); } }, r[s].id) },
      { key: 'statut' + s, label: 'Statut', render: r => ui.pill(r[s].statut), value: r => M.STATUTS[r[s].statut].label },
      { key: 'dossier' + s, label: 'Dossier', value: r => { const f = fp(r, s); return f ? f.d.id : ''; } },
      { key: 'annonceur' + s, label: 'Annonceur', value: r => { const f = fp(r, s); return f ? f.d.annonceur : ''; } },
      { key: 'visuel' + s, label: 'Visuel', value: r => { const f = fp(r, s); return f ? lettre(r.k) + ' · ' + f.t.libelle : ''; },
        render: r => { const f = fp(r, s); return f ? h('span', null, ui.btnVisuel(f.t), h('span', { class: 'muted' }, lettre(r.k) + ' · '), f.t.libelle) : h('span', { class: 'muted' }, 'pas de visuel à cette position'); } },
    ];
    root.append(
      ui.annot('Page « Position Train » du menu Trains de Circé : les trains côte à côte (deux panneaux voisins qui défilent ensemble), position par position, pour vérifier ce qui s’affiche en même temps. Dans Circé, les flèches changent l’ordre d’une face sur le panneau ; ici, l’ordre se change dans Suivi par thème (« Ordre… ») ou dans le train. Les paires sont fictives.', ['SCR-08', 'SCR-20']),
      ui.card({ flush: true, body: ui.table({
        id: 'trains-positions', rows, exportName: 'position-train.csv',
        empty: 'Aucun train côte à côte pour ces filtres.',
        // Toutes les colonnes sont celles de Circé (CoteCote) : aucune n'est marquée `ajout`
        columns: [
          ...cote('a'),
          { key: 'lien', label: 'Lien', title: 'Lien côte à côte entre les deux trains (tr_lien_cote_cote). ' + FICTIF, value: r => 'Côte à côte · ' + r.pr.lien },
          ...cote('b'),
          { key: 'panel', label: 'Emplacement panel', hidden: true, title: 'Panneau de groupement des deux trains. ' + FICTIF, value: r => r.pr.panel + ' · ' + panneauFictif(r.pr.panel).adresse + ', ' + C.dest(r.a.dest).label },
        ],
      }) }));
  }

  /** 12/11 (utilisatrice) : « Export préparation » de Circé (TrainExportPrepa) : quantités à préparer par thème, et par thème et
      destinataire, sommées sur les trains filtrés (les visuels fractionnés, produits à part, n'y sont pas). Le bouton de ligne
      reprend « Supprimer les trains » de Circé : ici, la ligne est seulement marquée « retirée » (gardé pour la session). */
  const retiresExport = new Set();
  function tabExport(root) {
    const us = trainsScope(true);
    const parTheme = new Map(), parDest = new Map();
    us.forEach(u => u.positions.forEach(p => {
      if (p.fr) return;
      const t = C.theme(p.themeId), d = C.dossier(t.dossierId);
      // Circé regroupe sur le texte : annonceur, format, thème, repiquage (et destinataire)
      const base = { t, d, annonceur: d.annonceur, format: d.format, theme: t.libelle, repiquage: t.repiquage || '' };
      const k1 = 'T|' + [base.annonceur, base.format, base.theme, base.repiquage].join('|');
      const e1 = parTheme.get(k1) || Object.assign({ id: k1, qte: 0 }, base);
      e1.qte += u.nb; parTheme.set(k1, e1);
      const k2 = 'D|' + [base.annonceur, base.format, base.theme, base.repiquage, u.dest].join('|');
      const e2 = parDest.get(k2) || Object.assign({ id: k2, qte: 0, dest: C.dest(u.dest).label }, base);
      e2.qte += u.nb; parDest.set(k2, e2);
    }));
    const tri = (x, y) => x.annonceur.localeCompare(y.annonceur, 'fr') || x.theme.localeCompare(y.theme, 'fr') || String(x.dest || '').localeCompare(String(y.dest || ''), 'fr');
    // Toutes les colonnes sont celles de Circé (TrainExportPrepa) : aucune n'est marquée `ajout`
    const colsCommunes = [
      { key: 'annonceur', label: 'Annonceur' }, { key: 'format', label: 'Format' },
      { key: 'theme', label: 'Thème', render: r => h('span', null, ui.btnVisuel(r.t), r.theme) }, { key: 'repiquage', label: 'Repiquage' },
    ];
    const colBouton = { key: 'retire', label: 'Dans l’export', sortable: false, title: 'Circé : « Supprimer les trains » de la ligne ; dans la maquette, la ligne est seulement marquée', value: r => retiresExport.has(r.id) ? 'Retiré' : 'Oui',
      render: r => { const out = retiresExport.has(r.id); return h('span', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap', alignItems: 'center' } }, out ? ui.tag('Retiré', 'hyp') : h('span', null, 'Oui'),
        ui.btn(out ? 'Remettre' : 'Retirer', e => { e.stopPropagation(); if (out) retiresExport.delete(r.id); else retiresExport.add(r.id); M.journal(r.d.id, '« ' + r.theme + ' »' + (r.dest ? ' vers ' + r.dest : '') + (out ? ' remis dans' : ' retiré de') + ' l’export préparation'); M.refresh(); }, { small: true })); } };
    const colQte = { key: 'qte', label: 'Quantité', align: 'num', title: 'Nombre de trains (une affiche par train)' };
    // Total des lignes affichées, sans celles qui sont retirées
    const total = (c, lignes) => (c.key === 'qte' ? M.sum(lignes.filter(r => !retiresExport.has(r.id)), r => r.qte) : c.key === 'annonceur' ? 'Total à préparer' : null);
    root.append(
      ui.annot('Page « Export préparation » du menu Trains de Circé : ce qu’il faut sortir du stock pour les trains filtrés, par thème puis par destinataire. Les visuels fractionnés (produits à part) n’y sont pas.', ['SCR-01', 'SCR-07', 'SCR-11']),
      ui.card({ title: 'Par thème', sub: parTheme.size + ' ligne(s), ' + us.length + ' ligne(s) de trains', flush: true, body: ui.table({
        id: 'trains-export-theme', rows: Array.from(parTheme.values()).sort(tri), exportName: 'export-preparation-par-theme.csv', footer: total,
        tone: r => retiresExport.has(r.id) ? 'warning' : null,
        columns: [...colsCommunes, colBouton, colQte],
      }) }),
      h('div', { style: { height: '14px' } }),
      ui.card({ title: 'Par destinataire', sub: parDest.size + ' ligne(s)', flush: true, body: ui.table({
        id: 'trains-export-dest', rows: Array.from(parDest.values()).sort(tri), exportName: 'export-preparation-par-destinataire.csv', footer: total,
        tone: r => retiresExport.has(r.id) ? 'warning' : null,
        columns: [...colsCommunes, { key: 'dest', label: 'Destinataire' }, colBouton, colQte],
      }) }));
  }

  function tab8m2(root) {
    // Mêmes filtres, appliqués aux visuels 8 m² (machine, statut et destinataire sans objet ici)
    const dos = t => C.dossier(t.dossierId);
    const ths = F.apply(C.themesScope({ allWeeks: true }).filter(t => t.d8), { dossier: t => t.dossierId, semaine: t => dos(t).semaine, atelier: t => dos(t).atelier, machine: null, statut: null, dest: null, annonceur: t => dos(t).annonceur, theme: t => t.id, afficheur: null, npos: null });
    const rows = ths.map(t => { const d = C.dossier(t.dossierId); return { id: t.id, t, d, site: C.site(d.site).label, annonceur: d.annonceur, theme: t.libelle, besoin: t.qteEnt, recu: C.recu(t.id), haut: t.d8.haut, bas: t.d8.bas, final: t.d8.final, raf: Math.max(0, t.qteEnt - t.d8.final) }; });
    const edit = (r, k) => ui.input({ type: 'number', value: r.t.d8[k], min: 0, style: { width: '70px', minWidth: '0' }, onChange: v => { r.t.d8[k] = Number(v); M.journal(r.d.id, '8 m² : ' + k + ' = ' + v); M.refresh(); } });
    root.append(
      ui.annot('Remplace le tableau Excel 8 m² : besoin, reçu, demies haut et bas, affiches finales et reste à faire, saisis directement. Le travail peut commencer plusieurs semaines à l’avance (choisir le départ en haut de page).', ['PROC-06', 'CIB-12', 'SCR-01']),
      ui.card({ flush: true, body: ui.table({ id: 'trains-8m2', rows, exportName: 'suivi-8m2.csv', tone: r => r.recu < r.besoin ? 'serious' : r.raf === 0 ? 'good' : null,
        columns: [{ key: 'site', label: 'Site', hidden: M.state.site !== 'ALL' }, ui.colVisuel(), { key: 'besoin', label: 'Besoin', align: 'num' }, { key: 'recu', label: 'Reçu', align: 'num' },
          { key: 'haut', label: 'Demies haut', render: r => edit(r, 'haut') }, { key: 'bas', label: 'Demies bas', render: r => edit(r, 'bas') }, { key: 'final', label: '8 m² finales', render: r => edit(r, 'final') }, { key: 'raf', label: 'Reste à faire', align: 'num' },
          { key: 'annonceur', label: 'Annonceur', hidden: true }, { key: 'theme', label: 'Thème', hidden: true }] }) }));
  }

  M.screen({
    id: 'trains', title: 'Trains (déroulants)', icon: '☰', nav: 'Trains', roles: ['cheq', 'coord'], vueDefaut: 'trains',
    needs: ['SCR-01', 'SCR-02', 'SCR-05', 'SCR-07', 'SCR-08', 'SCR-09', 'SCR-12', 'SCR-13', 'SCR-17', 'SCR-11', 'SCR-18', 'SCR-19', 'SCR-20', 'SCR-21', 'SCR-23', 'REC-04', 'PP-06', 'PROC-06', 'CIB-03', 'CIB-12', 'CIB-14', 'AUT-03', 'ERG-02', 'ERG-03', 'ERG-05', 'ERG-06', 'ERG-08', 'ERG-09', 'ERG-10'],
    asis: ['Trois onglets à ouvrir dans l’ordre (Préparation, Suivi par thème, Export préparation) puis filtres « À imprimer » et « pré-assemblé = Fait » (S50-S52)', 'Besoin en affiches imprimé et pointé à la main (S50)', 'Mail de la Pré-Prod pour donner le Go (S49)', 'Tableau Excel 8 m² (S56)'],
    badge: () => { const n = M.sum(C.unitesScope().filter(u => u.kind === 'TRAIN' && u.statut === 'EN_ATTENTE'), u => u.nb); return { n, title: 'Trains en attente' }; },
    render(root, params) {
      // Vue choisie dans le menu du haut (Déroulant) : pas d'onglets dans la page
      // Noms des tableaux du menu « Trains » de Circé, gardés le 25/10 (Liste des trains, Suivi par thème, Préparation)
      const VUES = {
        trains: ['Liste des trains', 'Composition des trains, couverture des visuels, fractionnement et raccrochage. 2 m² (dont MUI et Venusial), 4 m² et 8 m².'],
        besoin: ['Suivi par thème', 'Besoin par visuel, avec l’emplacement en stock pour le picking, et pré-assemblage par lot.'],
        prepa: ['Préparation', 'Trains à rouler : pré-assemblage, rouleur, bague et colis, jusqu’au départ du camion.'],
        // 12/11 (utilisatrice) : deux pages du menu « Trains » de Circé qui manquaient à la maquette
        positions: ['Position Train', 'Trains côte à côte sur un même panneau de groupement : le visuel de chaque train, position par position.'],
        export: ['Export préparation', 'Quantités à préparer par thème, et par thème et destinataire, pour les trains filtrés.'],
        d8: ['Suivi 8 m² (demies)', 'Besoin, reçu, demies haut et bas, affiches finales et reste à faire, saisis directement.'],
      };
      const tab = VUES[params.tab] ? params.tab : 'trains';
      const ajoutee = tab === 'positions' || tab === 'export';
      F = ui.filters({ id: 'trains', defs: filterDefs(), rows: trainsAll(),
        extra: h('span', { class: 'legend-inline' }, h('span', { class: 'train-pos' }, h('span', { class: 'pos ok' }, 'A')), ' reçu ', h('span', { class: 'train-pos' }, h('span', { class: 'pos ko' }, 'B')), ' manquant ', h('span', { class: 'train-pos' }, h('span', { class: 'pos fr' }, 'C')), ' fractionné') });
      const ws = F.weeks();
      const ds = C.dossiersScope({ allWeeks: true }).filter(d => (!ws.length || ws.includes(d.semaine)) && C.atelier(d.atelier).mode === 'train' && d.statutPP !== 'ANNULE');
      // Ce qui reste à la Coordination avant l'export du jeudi 14 h (27/10) : Instruction OK « En cours » (commentaire de prépa,
      // ou nombre d'exceptions différent de la quantité), et validation admin d'une affiche à confirmer (02/11) ; les deux sont indépendantes
      const aFaire = ds.filter(d => C.instrOK(d) === 'A_FAIRE').length;
      const vaAFaire = ds.filter(d => C.vaResume(d) === 'A_FAIRE').length;
      const us = trainsScope(false);
      const e = C.etapesCount(us);
      const filtreStatut = s => { F.set('statut', [s]); M.go('trains'); };
      root.append(
        ui.pageHead({ crumb: 'Déroulant', title: VUES[tab][0], sub: VUES[tab][1], screen: 'trains',
          actions: [ui.btn('Fichiers Vendôme', () => { const v = M.ref.machines.find(x => x.type === 'vendome' && (M.state.site === 'ALL' || x.site === M.state.site)); M.go('generateur', v ? { machine: v.id } : null); }, { primary: true }), ui.btn('Bagues', () => M.go('bagues')), ui.btn('Train de pré-test…', creerTrain, { title: 'Coordination : créer un train de pré-test ou d’entretien (SCR-12)' }),
            tab === 'trains' ? ui.btn('Exporter les trains…', () => exporterTrains(ws.length ? ws : [M.state.semaine]), { title: 'Coordination, jeudi 14 h : exporter les faces en Instruction OK (« A imprimer », le go des plateformes)' }) : null].filter(Boolean) }),
        // Bandeau des pages de Circé ajoutées le 12/11 (h() ignore un enfant null, Element.append l'écrirait « null »)
        h('div', null, ajoutee ? ui.callout('info', 'Page de Circé, ajoutée à la maquette le 12/11 (elle n’y figurait pas)', ' ' + (tab === 'positions' ? 'Circé : menu Trains › Position Train (CoteCote).' : 'Circé : menu Trains › Export préparation (TrainExportPrepa).') + ' Mêmes colonnes que dans Circé ; les données sont celles, fictives, de la maquette.') : null),
        F.bar,
        aFaire || vaAFaire ? ui.callout('warning', 'À faire par la Coordination avant l’export du jeudi 14 h', ' ' + [aFaire ? aFaire + ' dossier(s) « En cours » : Instruction OK à faire à la main (commentaire de prépa ou nombre d’exceptions différent de la quantité)' : null, vaAFaire ? vaAFaire + ' dossier(s) avec une affiche à confirmer (validation admin)' : null].filter(Boolean).join(' ; ') + '. « Exporter les trains » ne prend que les faces en Instruction OK : elles passent « A imprimer », c’est le go des plateformes.', ui.btn('Voir les dossiers', () => M.go('instructions', { pour: 'deroulant' }), { small: true }))
          : ui.callout('good', 'Rien à faire par la Coordination sur ces dossiers', ' Instructions OK et validations admin faites ; les trains partent à l’export du jeudi 14 h (« A imprimer »), le go des plateformes.'),
        h('div', { class: 'kpis', style: { marginBottom: '14px' } },
          ui.stat({ label: 'Trains à produire', value: M.fmt.n(M.sum(us, u => u.nb)) }),
          ui.stat({ label: "En attente d'affiches", value: M.fmt.n(e.attente), onClick: () => filtreStatut('EN_ATTENTE'), title: 'Filtrer sur ce statut' }),
          ui.stat({ label: 'Prêts à produire', value: M.fmt.n(e.pret), onClick: () => filtreStatut('PRET'), title: 'Filtrer sur ce statut' }),
          ui.stat({ label: 'En production', value: M.fmt.n(e.prod), onClick: () => filtreStatut('EN_PROD'), title: 'Filtrer sur ce statut' }),
          ui.stat({ label: 'Colisés ou expédiés', value: M.fmt.n(e.colise + e.expedie) })));
      if (tab === 'besoin') tabBesoin(root); else if (tab === 'prepa') tabPrepa(root, params); else if (tab === 'positions') tabPositions(root); else if (tab === 'export') tabExport(root); else if (tab === 'd8') tab8m2(root); else tabTrains(root, params);
    },
  });
})();
