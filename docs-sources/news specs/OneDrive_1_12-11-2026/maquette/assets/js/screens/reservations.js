/* État des réservations vivant (EDR vivant), dans Pilotage (19/10, idée de l'équipe) : tous les dossiers dont la DA est
   activée, de la semaine en cours aux suivantes, comme le menu Suivi › Etat des réservations de Circé, et, en une vue, où
   chacun en est de son process : pré-production (IP et préparation par la Pré-Prod dans Broadcast, validation admin), réception des affiches, production (le reste à
   faire, ex « Tableau du reste à faire » de Pilotage), expédition. Il était en tête de Dossiers depuis le 16/10 ; une seule
   page, dans Pilotage.
   « Une base, des vues » (21/10, idée de la cheffe de projet) : la page lit la base unique de Circé (C.base : une ligne au
   grain le plus fin, dossier × thème × destinataire × afficheur × unité) et l'affiche au grain choisi dans « Afficher par ».
   Les filtres portent sur les lignes fines, puis les lignes sont regroupées : les totaux sont recalculés pour la partie
   filtrée. Chaque colonne a sa règle de regroupement (somme, étape la moins avancée, reçu compté une fois par thème). */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  /** Pré-production d'un dossier, côté Broadcast (DA, IP, envoi de la prépa) : [libellé, gravité de la pastille]. La validation
      admin a sa propre colonne : elle part de la réception, plus de la préparation (option A, 02/11). */
  const ETAPES = {
    DA: ['DA activée, IP à saisir', 'warning'],
    IP: ['IP saisies, prépa attendue', 'info'],
    PREPA: ['Prépa reçue', 'good'],
    ANNULE: ['Annulé', 'info'],
  };
  const etapeOf = d => (d.statutPP === 'ANNULE' ? 'ANNULE' : d.statutPP === 'PREPA_RECUE' || d.statutPP === 'VALIDE' ? 'PREPA' : d.ipSaisies ? 'IP' : 'DA');
  /** Validation admin d'un dossier (C.vaResume), indépendante de la préparation : [libellé, gravité]. */
  const VA_D = { A_FAIRE: ['À confirmer', 'serious'], FAITE: ['Validée', 'good'], AUCUNE: ['Aucune affiche reçue', 'info'], SANS_OBJET: ['—', null] };
  const vaLib = d => { const k = C.vaResume(d); return k === 'A_FAIRE' ? VA_D[k][0] + ' (' + C.vaDossier(d).aFaire.length + ')' : VA_D[k][0]; };
  /** Où en est la ligne dans tout le process (EDR vivant) : la première étape pas encore faite, de la DA à la livraison.
      Ordre de l’option A (02/11) : la validation admin vient après la réception des affiches, plus après la préparation. */
  const OU = {
    DA: ['DA activée, IP à saisir', 'warning'],
    IP: ['IP saisies, prépa attendue', 'info'],
    AFFICHES: ['Prépa reçue, affiches attendues', 'critical'],
    PARTIEL: ['Affiches reçues en partie', 'serious'],
    PREPA: ['Affiches reçues, validation admin à confirmer', 'serious'],
    PROD: ['Prêt ou en production', 'info'],
    PRODUIT: ['Produit, à expédier', 'good'],
    EXPEDIE: ['Expédié', 'good'],
    LIVRE: ['Livré (preuve reçue)', 'good'],
    ANNULE: ['Annulé', 'info'],
  };
  const PHASES = { prepro: ['DA', 'IP', 'PREPA'], affiches: ['AFFICHES', 'PARTIEL'], prod: ['PROD'], fini: ['PRODUIT', 'EXPEDIE', 'LIVRE'] };
  /** Affiche reçue, mise à jour par la réception (PP-02) et non plus par la validation admin : [libellé, gravité]. */
  const RECU = { COMPLET: ['Oui', 'good'], SURPLUS: ['Oui, surplus', 'warning'], PARTIEL: ['Partielle', 'serious'], MANQUANT: ['Non', 'critical'], NON_ATTENDU: ['—', null], SANS_ATTENDU: ['Sans attendu', 'warning'] };
  const REPERES = { controlee: 'Contrôlée', print: 'Print Cityz', rp: 'Reste en place', npa: 'Ne pas afficher', multi: 'Multi-semaines' };
  const reperesF = f => [f.d.controlee ? 'controlee' : null, f.d.print ? 'print' : null, f.t && f.t.exclu === 'RESTE_EN_PLACE' ? 'rp' : f.t && f.t.exclu === 'NE_PAS_AFFICHER' ? 'npa' : null, f.d.semaines.length > 1 ? 'multi' : null].filter(Boolean);
  const opts = (vals, lab) => M.uniq(vals.filter(v => v !== null && v !== undefined && v !== '')).map(v => ({ value: v, label: lab ? lab(v) : v })).sort((a, b) => String(a.label).localeCompare(String(b.label), 'fr'));
  const ORDRE = Object.keys(OU);
  /** Un groupe en est à l'étape la moins avancée de ses lignes. */
  const ouMin = ks => ks.slice().sort((a, b) => ORDRE.indexOf(a) - ORDRE.indexOf(b))[0];
  const SEM = f => f.d.semaines.map(s => 'S' + s).join(' + ');
  const destLabel = id => (id ? C.dest(id).label : '—');
  const affLabel = id => (id ? C.afficheur(id).label : '—');

  /** Grains proposés dans « Afficher par » : clé de regroupement de la ligne fine (null : la ligne n'a pas encore ce grain).
      Dossier, thème, destinataire, afficheur s'emboîtent ; unité, colis et départ regroupent des lignes de plusieurs dossiers. */
  const PAR = {
    dossier: { label: 'Dossier', key: f => f.dossier },
    // La DA (21/10) : dossier × type de réalisation × plateforme ; un dossier peut être livré sur deux plateformes
    plateforme: { label: 'DA : dossier × type de réalisation × plateforme', key: f => f.dossier + '|' + f.typeReal + '|' + f.site },
    theme: { label: 'Thème (dossier × thème)', key: f => f.theme },
    dest: { label: 'Destinataire (× thème)', key: f => (f.dest ? f.theme + '|' + f.dest : null), manque: 'sans destinataire (préparation pas encore reçue)' },
    aff: { label: 'Afficheur (× destinataire × thème)', key: f => (f.aff ? f.theme + '|' + f.aff : null), manque: 'sans afficheur (préparation pas encore reçue)' },
    unite: { label: 'Unité : train, UM, lot', key: f => f.unite, manque: 'sans unité (préparation pas reçue ou thème non produit)' },
    colis: { label: 'Colis', key: f => f.colis, manque: 'pas encore en colis' },
    depart: { label: 'Départ camion (destinataire × semaine)', key: f => f.departKey, manque: 'sans départ (pas encore d’unité)' },
    format: { label: 'Format (tous dossiers)', key: f => f.format },
  };
  const st = { par: 'theme' };

  /** Regroupe les lignes fines au grain choisi. Règles : quantités en somme ; « Où en est-il » = étape la moins avancée ;
      reçu et reste à recevoir comptés une fois par thème, et signalés « thème entier » quand le groupe n'a qu'une partie
      des lignes du thème (grain plus fin, ou filtre). */
  function regrouper(fs, par, totalParTheme) {
    const g = new Map();
    fs.forEach(f => { const k = PAR[par].key(f); if (k === null || k === undefined) return; if (!g.has(k)) g.set(k, []); g.get(k).push(f); });
    return Array.from(g, ([k, ls]) => {
      const f0 = ls[0];
      const themes = M.uniq(ls.map(f => f.theme)), dossiers = M.uniq(ls.map(f => f.dossier)), unites = M.uniq(ls.map(f => f.unite).filter(Boolean));
      const parTheme = M.groupBy(ls, f => f.theme);
      // Une ligne par « visuel » (thème, ou type de réalisation × plateforme avant les IP) pour le reçu, compté une fois
      const unParVisuel = themes.map(k => parTheme[k][0]);
      const partiel = themes.some(id => parTheme[id].length < (totalParTheme.get(id) || 0));
      const deps = ls.map(f => f.depart).filter(Boolean);
      return {
        id: String(k), ls, f0, d: f0.d, t: f0.t, themes, dossiers, unites, partiel,
        dossier: dossiers.length === 1 ? f0.dossier : dossiers.length + ' dossiers', annonceur: M.uniq(ls.map(f => f.d.annonceur)).join(', '),
        theme: themes.length === 1 ? (f0.t && f0.d.ipSaisies ? f0.t.libelle : '') : themes.length + ' thèmes',
        avantIP: ls.every(f => !f.t), typeReal: M.uniq(ls.map(f => f.typeReal)).join(', '), sites: M.uniq(ls.map(f => f.site)),
        format: M.uniq(ls.map(f => f.format)).join(', '), atelier: M.uniq(ls.map(f => C.atelier(f.atelier).label)).join(', '),
        semaines: M.uniq(ls.map(SEM)).join(', '), dest: f0.dest, aff: f0.aff, u: f0.u, c: f0.c,
        dests: M.uniq(ls.map(f => f.dest).filter(Boolean)), affs: M.uniq(ls.map(f => f.aff).filter(Boolean)), colisL: M.uniq(ls.map(f => f.colis).filter(Boolean)),
        ou: ouMin(ls.map(f => f.ou)),
        besoin: M.sum(ls, f => f.besoin), entretien: M.sum(ls, f => f.entretien), couvert: M.sum(ls, f => f.couvert),
        recu: M.sum(unParVisuel, f => (f.t ? C.recu(f.t.id) : f.recuDA)),
        reste: M.sum(unParVisuel, f => (f.t ? C.reste(f.t) : Math.max(0, f.besoin - f.recuDA))),
        fait: M.sum(ls, f => f.fait), expedie: M.sum(ls, f => f.expedie), livre: M.sum(ls, f => f.livre),
        depart: deps.length ? new Date(Math.min.apply(null, deps)) : null,
        pole: M.uniq(ls.map(f => f.d.pole)).join(', '), da: M.uniq(ls.map(f => f.d.da)).join(', '),
        reperes: M.uniq(ls.flatMap(reperesF)), recuEtat: themes.length === 1 && f0.t ? C.etatTheme(f0.t) : null,
        // N° d'affiche de Circé, visibles dès la réception, avant la préparation (attente de Fabrice, 27/10) : les affiches liées aux
        // visuels du groupe ; avant les IP, à un thème du dossier
        affiches: M.data.affiches.filter(a => a.statut !== 'ORPHELINE' && a.alloc.some(x => themes.includes(x.themeId) || ls.some(f => !f.t && f.d.themes.includes(x.themeId)))),
      };
    });
  }

  /** Toutes les colonnes, quel que soit le grain (21/10, demande de la cheffe de projet : « garde toutes les colonnes ») :
      chacune sait se calculer pour un groupe de lignes (une valeur, ou « N … » quand le groupe en a plusieurs). Le grain
      ne choisit que les 8 colonnes visibles par défaut (DESIGN.md §4.5) ; les autres sont dans « Colonnes ». */
  const plusieurs = (xs, un, mot) => (xs.length === 1 ? un(xs[0]) : xs.length ? xs.length + ' ' + mot : '—');
  const dt = d => (d ? M.fmt.dt(d) : '—');
  function toutesColonnes() {
    const entier = v => r => h('span', null, M.fmt.n(r[v]), r.partiel ? [' ', ui.tag('thème entier', 'hyp')] : null);
    const uniteDe = id => C.unite(id);
    const colisDe = id => M.data.colis.find(c => c.id === id);
    return [
      { key: 'dossier', label: 'Dossier', nowrap: true, value: r => r.dossiers.join(', '), render: r => (r.dossiers.length > 1 ? h('span', { title: r.dossiers.join(', ') }, ui.tag(r.dossiers.length + ' dossiers')) : r.dossiers[0]) },
      ui.colVisuel(r => [r.annonceur, r.theme || null, r.theme ? null : ui.tag(r.avantIP ? 'DA : ' + r.typeReal + ' · thème à la saisie des IP' : 'thème à la saisie des IP', 'hyp')], { theme: r => (r.themes.length === 1 && r.t && r.d.ipSaisies ? r.t : null) }),
      { key: 'annonceur', label: 'Annonceur' },
      { key: 'nbThemes', label: 'Thèmes', align: 'num', value: r => r.themes.length },
      { key: 'nbDossiers', label: 'Dossiers', align: 'num', value: r => r.dossiers.length },
      { key: 'semaines', label: 'Départ' },
      { key: 'destL', label: 'Destinataire', value: r => plusieurs(r.dests, destLabel, 'destinataires') },
      { key: 'affL', label: 'Afficheur', value: r => plusieurs(r.affs, affLabel, 'afficheurs') },
      { key: 'unite', label: 'Unité', nowrap: true, value: r => plusieurs(r.unites, id => id, 'unités'), render: r => (r.unites.length === 1 ? h('span', null, h('b', null, r.unites[0]), ' ', ui.tag(uniteDe(r.unites[0]).kind === 'TRAIN' ? 'train' : uniteDe(r.unites[0]).kind === 'UM' ? 'UM' : 'lot')) : plusieurs(r.unites, id => id, 'unités')) },
      { key: 'statutU', label: 'Statut de l’unité', value: r => (r.unites.length === 1 ? M.STATUTS[uniteDe(r.unites[0]).statut].label : ''), render: r => (r.unites.length === 1 ? ui.pill(uniteDe(r.unites[0]).statut) : h('span', { class: 'muted' }, plusieurs(r.unites, id => id, 'unités'))) },
      { key: 'nbUnites', label: 'Unités', align: 'num', value: r => r.unites.length, title: 'Trains, UM ou lots' },
      { key: 'colis', label: 'Colis', nowrap: true, value: r => plusieurs(r.colisL, id => id, 'colis') },
      { key: 'statutC', label: 'Statut du colis', value: r => (r.colisL.length === 1 ? M.STATUTS[colisDe(r.colisL[0]).statut].label : ''), render: r => (r.colisL.length === 1 ? ui.pill(colisDe(r.colisL[0]).statut) : h('span', { class: 'muted' }, plusieurs(r.colisL, id => id, 'colis'))) },
      { key: 'departD', label: 'Départ camion', value: r => (r.depart ? r.depart.getTime() : null), render: r => dt(r.depart), csv: r => dt(r.depart), title: 'Le premier départ camion des lignes' },
      { key: 'canal', label: 'Boucle', value: r => plusieurs(r.dests, id => C.dest(id).boucle + ' · ' + M.ref.canaux[C.dest(id).canal], 'destinataires') },
      { key: 'ou', label: 'Où en est-il', title: 'La première étape pas encore faite, de la DA activée à la livraison ; pour un groupe, l’étape la moins avancée de ses lignes', render: r => ui.sev(OU[r.ou][1], OU[r.ou][0]), value: r => ORDRE.indexOf(r.ou), csv: r => OU[r.ou][0] },
      { key: 'besoin', label: 'Attendu', align: 'num', title: 'Affiches à produire, entretien compris (lignes de préparation ; avant la préparation : quantité de Broadcast)' },
      { key: 'recu', label: 'Reçu', align: 'num', title: 'Affiches reçues pour le ou les thèmes, comptées une fois par thème : le reçu ne se répartit pas par destinataire : au destinataire, on suit l’expédition et la livraison (Q41, 21/10). « thème entier » : la ligne n’a qu’une partie des besoins du thème.', render: entier('recu') },
      { key: 'reste', label: 'Reste à recevoir', align: 'num', title: 'Par thème, compté une fois (attendu du thème moins reçu)', render: entier('reste') },
      { key: 'couvert', label: 'Couvert par le stock', align: 'num', title: 'Affiches de ces lignes déjà couvertes par le stock reçu (le départ le plus proche est servi d’abord) : dit si une unité peut être produite. Ce n’est pas un reçu par destinataire (Q41).' },
      { key: 'raf', label: 'Reste à faire', align: 'num', value: r => r.besoin - r.fait, title: 'Affiches pas encore colisées' },
      { key: 'entretien', label: 'Dont entretien', align: 'num' },
      { key: 'fait', label: 'Faites', align: 'num', title: 'Colisées ou expédiées' },
      { key: 'expedie', label: 'Expédiées', align: 'num' },
      { key: 'livre', label: 'Livrées (preuve)', align: 'num' },
      { key: 'format', label: 'Format' }, { key: 'atelier', label: 'Atelier' },
      { key: 'typeReal', label: 'Type de réalisation', title: 'Format physique imprimé, tel que dans la DA (demande d’affiches) de Broadcast' },
      { key: 'plateforme', label: 'Plateforme', value: r => r.sites.map(x => C.site(x).label).join(', '), title: 'Adresse de livraison de la DA : la plateforme qui reçoit les affiches' },
      { key: 'etape', label: 'Pré-production (Broadcast)', title: 'DA activée, IP saisies, prépa envoyée par la Pré-Prod depuis Broadcast', value: r => (r.dossiers.length === 1 ? ETAPES[etapeOf(r.d)][0] : ''), render: r => (r.dossiers.length === 1 ? ui.sev(ETAPES[etapeOf(r.d)][1], ETAPES[etapeOf(r.d)][0]) : h('span', { class: 'muted' }, '—')) },
      { key: 'va', label: 'Validation admin', title: 'Proposée par Circé à la réception, confirmée par la Coordination, sans attendre la préparation (option A, 02/11)', value: r => (r.dossiers.length === 1 ? vaLib(r.d) : ''), render: r => { if (r.dossiers.length !== 1) return h('span', { class: 'muted' }, '—'); const k = C.vaResume(r.d); return VA_D[k][1] ? ui.sev(VA_D[k][1], vaLib(r.d)) : h('span', { class: 'muted' }, '—'); } },
      { key: 'recuEtat', label: 'Affiche reçue', render: r => (r.recuEtat && RECU[r.recuEtat][1] ? ui.sev(RECU[r.recuEtat][1], RECU[r.recuEtat][0]) : h('span', { class: 'muted' }, '—')), value: r => (r.recuEtat ? RECU[r.recuEtat][0] : '') },
      // N° d'affiche de Circé (27/10, attente de Fabrice ; option A le 02/11) : visibles dès la réception ; ✓ validation admin faite, • rattachement proposé, à confirmer par la Coordination
      { key: 'nAff', label: 'N° d’affiche', nowrap: true, sortable: false, title: 'N° d’affiche de Circé, donnés à la réception : visibles dès que l’affiche est reçue, sans attendre la préparation. ✓ : validation admin faite (confirmée par la Coordination) ; • : rattachement proposé par Circé, à confirmer',
        value: r => r.affiches.map(a => a.id).join(', '),
        render: r => (r.affiches.length ? h('span', null, r.affiches.map(a => { const e = C.vaEtat(a); return h('span', { style: { marginRight: '6px', whiteSpace: 'nowrap' }, title: e === 'MANUELLE' ? 'Validation admin faite' : e === 'A_FAIRE' ? 'À confirmer par la Coordination : doute sur le rattachement proposé' : 'Rattachement proposé par Circé à la réception : à confirmer par la Coordination' }, a.id, e === 'MANUELLE' ? ' ✓' : e === 'ORPHELINE' ? '' : ' •'); })) : h('span', { class: 'muted' }, '—')) },
      { key: 'reperes', label: 'Repères', sortable: false, render: r => h('span', null, r.reperes.map(k => ui.tag(REPERES[k], 'hyp'))), value: r => r.reperes.map(k => REPERES[k]).join(', ') },
      { key: 'pole', label: 'Pôle' }, { key: 'da', label: 'DA' },
    ];
  }
  /** Les 8 colonnes visibles par défaut de chaque grain ; toutes les autres restent dans « Colonnes ». */
  const VISIBLES = {
    dossier: ['dossier', 'annonceur', 'nbThemes', 'semaines', 'ou', 'besoin', 'recu', 'raf'],
    // N° d'affiche visible par défaut au grain du thème (27/10) ; le reste à faire reste dans « Colonnes »
    theme: ['dossier', 'visuel', 'semaines', 'ou', 'besoin', 'recu', 'reste', 'nAff'],
    // Au destinataire, on suit l'expédition et la livraison (Geodis) : le reçu ne se répartit pas par destinataire (Q41, 21/10)
    dest: ['dossier', 'visuel', 'destL', 'ou', 'besoin', 'fait', 'expedie', 'livre'],
    aff: ['dossier', 'visuel', 'destL', 'affL', 'ou', 'besoin', 'expedie', 'livre'],
    unite: ['unite', 'dossier', 'destL', 'statutU', 'ou', 'besoin', 'couvert', 'raf'],
    colis: ['colis', 'destL', 'dossier', 'nbUnites', 'statutC', 'ou', 'besoin', 'departD'],
    depart: ['destL', 'departD', 'canal', 'nbDossiers', 'ou', 'besoin', 'expedie', 'livre'],
    format: ['format', 'nbDossiers', 'nbThemes', 'ou', 'besoin', 'recu', 'reste', 'raf'],
    // La DA : l'attendu de chaque plateforme, entretien inclus (ex. 968 pour Nîmes, 1 433 pour Wissous)
    plateforme: ['dossier', 'annonceur', 'typeReal', 'plateforme', 'ou', 'besoin', 'recu', 'reste'],
  };
  function colonnes(par) {
    const all = toutesColonnes(), vis = VISIBLES[par] || VISIBLES.theme;
    const parCle = new Map(all.map(c => [c.key, c]));
    return vis.map(k => parCle.get(k)).concat(all.filter(c => !vis.includes(c.key)).map(c => Object.assign({}, c, { hidden: true })));
  }

  M.screen({
    id: 'reservations', title: 'État des réservations vivant', icon: '▦', nav: 'État des réservations vivant', roles: ['coord', 'admin', 'recep', 'com', 'cheq'],
    needs: ['PROC-05', 'SP-02', 'REU-01', 'ANO-02', 'ANO-04', 'ANO-05', 'PP-02', 'PP-03', 'PP-07', 'REC-04', 'CIB-04', 'CIB-07', 'FIX-03', 'ERG-02', 'ERG-04', 'ERG-05', 'ERG-06', 'ERG-08'],
    asis: ['Suivi › Etat des réservations : Broadcast lu en direct (code : SuiviEtatReservationRepository.cs:26) ; une copie de S à S+8 tenue par un traitement automatique (BatchAlimPexCirceGetInstrBc)', 'Une ligne par destinataire effectif, dossier, format, thème et semaine (SuiviEtatReservationBll.cs:112-137)', '« Affiche reçue » : oui ou non, joint sur le thème en texte et la validation admin (SuiviEtatReservationBll.cs:183-192)', 'Quantités doublées pour un dossier sur deux semaines (S61 #2)', 'Statut Préparation = Envoyé, jugé redondant avec le n° de préparation (S32)', 'Pointage papier des manquants les mardi et vendredi S-2 (S33)'],
    render(root, params) {
      if (params.par && PAR[params.par] && st.parSeq !== M.navSeq) { st.par = params.par; st.parSeq = M.navSeq; }
      const par = st.par;
      const fs = C.base();
      const totalParTheme = new Map(Object.entries(M.groupBy(fs, f => f.theme)).map(([k, v]) => [k, v.length]));
      const ats = M.ref.ateliers.filter(a => M.state.site === 'ALL' || a.site === M.state.site);
      // Filtres sur les lignes fines : N° de dossier, Départ, Atelier, Où en est-il, Annonceur ; Affiche reçue, Repère,
      // Format, Pôle et Destinataire par « + Filtre ». Un lien peut poser « Où en est-il » (?ou=) ou le dossier (?dossier=).
      const preset = params.ou || params.dossier ? Object.assign({}, params.ou ? { ou: String(params.ou).split(',') } : null, params.dossier ? { dossier: String(params.dossier).split(',') } : null) : null;
      const choixPar = h('label', { class: 'cz-par', title: 'Le grain de la ligne : les filtres portent sur les lignes les plus fines, puis les lignes sont regroupées à ce grain' },
        h('span', { class: 'cz-par-label' }, 'Afficher par'),
        ui.select({ value: par, label: 'Afficher par', options: Object.entries(PAR).map(([v, p]) => ({ value: v, label: p.label })), onChange: v => { st.par = v; M.refresh(); } }));
      const F = ui.filters({ id: 'reservations', rows: fs, countBy: PAR[par].key, preset, extra: choixPar, defs: [
        ui.dossierFilter(fs, f => f.dossier),
        ui.weekFilter(M.ref.semaines.map(s => s.num).filter(n => n >= M.state.semaine), f => f.d.semaines),
        { key: 'atelier', label: 'Atelier', options: ats.map(a => ({ value: a.id, label: ui.withSite(a.label, a.site) })), get: f => f.atelier },
        { key: 'ou', label: 'Où en est-il', options: Object.entries(OU).map(([v, [l]]) => ({ value: v, label: l })), get: f => f.ou, stable: true },
        { key: 'annonceur', label: 'Annonceur', options: opts(fs.map(f => f.d.annonceur)), get: f => f.d.annonceur },
        { key: 'recu', label: 'Affiche reçue', more: true, options: [{ value: 'oui', label: 'Oui' }, { value: 'partielle', label: 'Partielle' }, { value: 'non', label: 'Non' }], get: f => { const e = f.t ? C.etatTheme(f.t) : f.recuDA >= f.besoin && f.besoin ? 'COMPLET' : f.recuDA ? 'PARTIEL' : 'MANQUANT'; return ['COMPLET', 'SURPLUS'].includes(e) ? 'oui' : e === 'PARTIEL' ? 'partielle' : e === 'MANQUANT' ? 'non' : null; } },
        { key: 'repere', label: 'Repère', more: true, options: Object.entries(REPERES).map(([v, l]) => ({ value: v, label: l })), get: reperesF },
        { key: 'format', label: 'Format', more: true, options: opts(fs.map(f => f.format)), get: f => f.format },
        { key: 'pole', label: 'Pôle', more: true, options: opts(fs.map(f => f.d.pole)), get: f => f.d.pole },
        { key: 'dest', label: 'Destinataire', more: true, options: opts(fs.map(f => f.dest), destLabel), get: f => f.dest },
      ] });
      const sel = F.apply(fs);
      // Indicateurs : dossiers par phase du process (un dossier compte à l'étape la moins avancée de ses lignes), avec les
      // autres filtres ; un clic pose « Où en est-il »
      const parDossier = M.groupBy(F.except(fs, 'ou'), f => f.dossier);
      const phaseDe = M.groupBy(Object.values(parDossier).map(ls => ouMin(ls.map(f => f.ou))).filter(k => k !== 'ANNULE'), k => Object.keys(PHASES).find(p => PHASES[p].includes(k)));
      const n = p => (phaseDe[p] || []).length;
      const voir = ks => { F.set('ou', ks); M.refresh(); };
      const sems = F.weeks().length ? F.weeks().slice().sort((a, b) => a - b).map(s => 'S' + s).join('-') : 'toutes-semaines';
      const rows = regrouper(sel, par, totalParTheme);
      const sansGrain = sel.filter(f => PAR[par].key(f) === null || PAR[par].key(f) === undefined).length;
      const cols = colonnes(par);
      root.append(
        ui.pageHead({ crumb: 'Pilotage · État des réservations vivant', title: 'État des réservations vivant', screen: 'reservations',
          sub: 'Tous les dossiers dont la DA est activée, pour les départs ' + M.fmt.sems(F.weeks()) + ', et où chacun en est : pré-production, réception des affiches, production (le reste à faire), expédition. « Afficher par » choisit le grain : dossier, DA (dossier × type de réalisation × plateforme), thème, destinataire, afficheur, unité, colis, départ ou format.' }),
        F.bar,
        h('div', { class: 'kpis', style: { marginBottom: '12px' } },
          ui.stat({ label: 'Dossiers', value: M.fmt.n(M.sum(Object.keys(PHASES), n)), sub: 'DA activée, hors annulés', onClick: () => voir([]), title: 'Toutes les étapes' }),
          ui.stat({ label: 'En pré-production', value: n('prepro'), sub: 'IP, préparation ou validation admin', onClick: () => voir(PHASES.prepro) }),
          ui.stat({ label: 'Affiches attendues', value: n('affiches'), sub: 'prépa reçue, visuel non reçu ou en partie', onClick: () => voir(PHASES.affiches) }),
          ui.stat({ label: 'En production', value: n('prod'), sub: 'affiches reçues, reste à faire', onClick: () => voir(PHASES.prod) }),
          ui.stat({ label: 'Produits ou expédiés', value: n('fini'), sub: 'jusqu’à la preuve de livraison', onClick: () => voir(PHASES.fini) })),
        ui.annot('Une base, des vues (21/10) : la page lit la base unique de Circé, une ligne par dossier × thème × destinataire × afficheur × unité (face de train, UM ou lot). Le grain s’affine avec le process : avant les IP, la DA seule (dossier × type de réalisation × plateforme, sans thème) ; avant la préparation, le thème. Un dossier livré sur deux plateformes garde un seul n°. « Afficher par » regroupe ces lignes : les filtres portent sur les lignes fines, les totaux se recalculent pour la partie filtrée. Règles : quantités en somme (en affiches, entretien compris) ; « Où en est-il » = l’étape la moins avancée ; le reçu se compte une fois par thème et ne se divise pas par destinataire (« thème entier ») ; « Couvert par le stock » suit la règle du départ le plus proche. Corrigé : un dossier sur deux semaines compte sa quantité une fois (ANO-02) ; « affiche reçue » vient de la réception (PP-02, ANO-05) ; l’attendu vient des lignes de préparation (ANO-04).', ['PROC-05', 'SP-02', 'REU-01', 'ANO-02', 'ANO-04', 'PP-02', 'ANO-05', 'REC-04', 'CIB-04']),
        h('div', null, sansGrain ? h('p', { class: 'small muted', style: { margin: '0 0 6px' } }, M.fmt.n(sansGrain) + ' ligne(s) ' + (PAR[par].manque || 'sans ce grain') + ' : elles n’apparaissent pas à ce grain.') : null),
        ui.card({ flush: true, body: ui.table({
          id: par === 'theme' ? 'reservations' : 'reservations-' + par, rows, query: params.q, selectable: true, exportName: 'etat-des-reservations-vivant-' + par + '-' + sems,
          bulkActions: s => [ui.btn('Exporter la sélection', () => M.downloadXLSX('selection-etat-des-reservations-' + par, s, cols.filter(c => !c.hidden && c.key !== 'reperes').map(c => ({ label: c.label, value: r => (c.csv ? c.csv(r) : c.value ? c.value(r) : r[c.key]) }))), { small: true })],
          onRowClick: r => { if (r.dossiers.length === 1) ui.dossierDrawer(r.dossiers[0]); },
          empty: 'Aucune ligne avec ces filtres à ce grain.',
          tone: r => ((r.ou === 'DA' || r.ou === 'IP') && M.NOW > M.deadlinePP(r.d.semaine)) || (r.ou === 'AFFICHES' && r.d.semaine <= M.state.semaine) ? 'critical' : r.ou === 'DA' || r.ou === 'PARTIEL' ? 'warning' : r.ou === 'PREPA' ? 'info' : PHASES.fini.includes(r.ou) ? 'good' : null,
          columns: cols,
          // Totaux : en somme, sauf le reçu et le reste à recevoir, comptés une fois par thème sur toute la sélection
          footer: (c, rs) => (['besoin', 'entretien', 'couvert', 'fait', 'expedie', 'livre'].includes(c.key) ? M.fmt.n(M.sum(rs, r => r[c.key]))
            : c.key === 'raf' ? M.fmt.n(M.sum(rs, r => r.besoin - r.fait))
              : c.key === 'recu' || c.key === 'reste' ? M.fmt.n(M.sum(Object.values(M.groupBy(rs.flatMap(r => r.ls), f => f.theme)).map(fs => fs[0]), f => (c.key === 'recu' ? (f.t ? C.recu(f.t.id) : f.recuDA) : (f.t ? C.reste(f.t) : Math.max(0, f.besoin - f.recuDA)))))
                : c.key === cols[0].key ? 'Total' : ''),
        }) }));
    },
  });
})();
