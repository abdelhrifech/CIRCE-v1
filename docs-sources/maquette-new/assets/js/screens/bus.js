/* Onglet Bus (plateforme de Nanterre), construit le 09/11 à partir de la documentation docs/BUS (chantier « Projet Bus V2 », Adsoluce) ;
   quand les documents divergent, la note de transmission du 08/10 prime. Revu le même jour à la demande de l'utilisatrice : plus de page
   Documentation ; le référentiel Bus est dans Administration › Paramétrage › Référentiel Bus (M.busReferentiel) ; le reste en place n'a plus
   de page, c'est un filtre et une colonne de « À traiter » ; la réception devient « Réceptions attendues », le même tableau que Wissous et
   Nîmes (US CIR-01 : Nanterre ajoutée comme plateforme du module Réception).
   Pages, dans l'ordre voulu par le métier (note BUS-06 : la réception d'abord), après le Suivi de prod (tableau de bord, 09/11) :
   - Suivi de prod : le tableau de bord de l'onglet, en tête comme dans les autres onglets (décision du 16/10) ;
   - Réceptions attendues : une ligne par visuel (dossier × thème), colonnes et filtres du tableau de Wissous / Nîmes ; « Réceptionner »
     porte les contrôles Bus (quantité, entretien, thèmes, photo avant collage, test de collage, NC limitée au conditionnement ou au format) ;
     BL sans n° de dossier complété par la préproduction ;
   - À traiter : les dossiers Bus sur 6 semaines, la charge par semaine et les racks, le reste en place en filtre ;
   - Préparation : lignes centre bus × parc × format, ajustement manuel de la quantité à encoller (tracé), fiche de préparation par centre
     bus et par semaine, fiche de synthèse, étiquettes de dispatch, envoi à Field Service (demandé au kick-off, écarté le 11/06 : à arbitrer) ;
   - Vue des réceptions : reçu / non reçu par semaine, avec les échéances.
   Données propres à l'onglet (générées, puis saisies gardées sur le poste : localStorage, clé circe-maquette-bus2). Les références « BUS-xx »
   de cet écran sont celles de la note de transmission, pas celles de la Synthèse (autre numérotation). */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui;
  const CLE = 'circe-maquette-bus2'; // 09/11 : réceptions au thème ; l'ancienne clé (réceptions au dossier) n'est plus lue
  const HABILITES = ['cheq', 'admin'];
  const user = () => { const r = M.ROLES.find(x => x.id === M.state.role); return r ? r.label : M.state.role; };
  const peutAjuster = () => HABILITES.includes(M.state.role);
  const PROD = 1.08, PLAQUES_PAR_RACK = 105;

  /* ---------- Référentiel (BUS-02, BUS-03, BUS-16, BUS-21) ---------- */
  const DSP = [
    { id: 'SO', label: 'DSP Seine-Ouest', plateforme: 'Nanterre' },
    { id: 'VM', label: 'DSP Val-de-Marne', plateforme: 'Nanterre' },
    { id: 'PC', label: 'DSP Plaine Commune', plateforme: 'Nanterre' },
    { id: 'ST', label: 'DSP Marne-Est (sous-traitant)', plateforme: null },
  ];
  const CENTRES = [
    { id: 'RUE', label: 'Centre bus Rueil', dsp: 'SO' }, { id: 'COL', label: 'Centre bus Colombes', dsp: 'SO' },
    { id: 'VIT', label: 'Centre bus Vitry', dsp: 'VM' }, { id: 'THI', label: 'Centre bus Thiais', dsp: 'VM' },
    { id: 'STD', label: 'Centre bus Saint-Denis', dsp: 'PC' }, { id: 'AUB', label: 'Centre bus Aubervilliers', dsp: 'PC' },
  ];
  const PARCS = ['A', 'B'];
  const FORMATS = [
    { id: 'AR1', label: 'Arrière 1', code: 'fixe AR' }, { id: 'AR2', label: 'Arrière 2', code: 'fixe AR (arrière 2 m²)' },
    { id: 'FG', label: 'Flanc gauche', code: 'fixe flanc gauche' }, { id: 'FD', label: 'Flanc droit', code: 'fixe flanc droit' },
    { id: 'AV', label: 'Avant', code: 'fixe AV', verni: true },
  ];
  const fmtL = id => (FORMATS.find(f => f.id === id) || {}).label || id;
  const cbL = id => (CENTRES.find(c => c.id === id) || {}).label || id;
  const dspL = id => (DSP.find(d => d.id === id) || {}).label || id;
  const CLIENTS = ['Métropole de Nordval', 'Opéra de Lys', 'Voyages Sirocco', 'Banque Horizon', 'Festival Arcadia', 'Cinéma Le Phare', 'Sport Altitude', 'Parfums Ambre', 'Mutuelle Alizé', 'Région Val-d’Or'];
  const THEMES = ['Saison 2027', 'Offre d’hiver', 'Lancement', 'Portes ouvertes', 'Soldes', 'Festival', 'Nouvelle ligne', 'Abonnement'];

  /* ---------- Données générées (déterministes) ---------- */
  const alea = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let B = null;
  function base() {
    const cur = M.state.semaine;
    if (B && B.cur === cur) return B;
    const r = alea(4242), i = (a, b) => a + Math.floor(r() * (b - a + 1)), pick = t => t[Math.floor(r() * t.length)];
    // Plaques par centre × parc × format : le cadastre (Broadcast) et le terrain ; le parc est vivant (cadastre 60, terrain 40)
    const parc = {};
    CENTRES.forEach(c => PARCS.forEach(p => FORMATS.forEach(f => {
      const cad = i(18, 60), terrain = r() < 0.45 ? cad - i(2, Math.round(cad / 3)) : cad;
      parc[c.id + '|' + p + '|' + f.id] = { cadastre: cad, terrain };
    })));
    parc['AUB|A|AR1'] = { cadastre: 120, terrain: 36 }; // exemple de l'atelier 2 : cadastre d'Aubervilliers erroné
    const dossiers = [];
    for (let k = 0; k < 20; k++) {
      const s = cur - 1 + (k % 8), duree = r() < 0.35 ? 2 : 1;
      const dsps = r() < 0.3 ? ['SO', 'PC'] : [pick(['SO', 'VM', 'PC'])];
      const fmts = FORMATS.map(f => f.id).filter(() => r() < 0.45);
      if (!fmts.length) fmts.push(pick(['AR1', 'FG', 'FD']));
      const themes = r() < 0.4 ? [pick(THEMES), pick(THEMES)].filter((x, j, t) => t.indexOf(x) === j) : [pick(THEMES)];
      const d = { id: String(708100 + k * 37), client: CLIENTS[k % CLIENTS.length], semaines: duree === 2 ? [s, s + 1] : [s], dsps, formats: fmts, themes, entretien: r() < 0.25 ? pick([10, 15, 25]) : 20, lignes: [] };
      // Deux thèmes : un par parc (A, B)
      CENTRES.filter(c => dsps.includes(c.dsp)).forEach(c => PARCS.forEach((p, pi) => fmts.forEach(f => {
        const pq = parc[c.id + '|' + p + '|' + f];
        const vendu = Math.max(4, Math.round(pq.cadastre * (0.5 + r() * 0.5)));
        d.lignes.push({ id: d.id + '|' + c.id + '|' + p + '|' + f, dossier: d.id, centre: c.id, parc: p, format: f, theme: themes[pi % themes.length], vendu,
          calc: Math.ceil(vendu * PROD), attendu: Math.ceil(vendu * (1 + d.entretien / 100)) });
      })));
      d.vendu = M.sum(d.lignes, l => l.vendu); d.attendu = M.sum(d.lignes, l => l.attendu);
      dossiers.push(d);
    }
    B = { cur, parc, dossiers };
    return B;
  }
  /** Affiches attendues pour un visuel (dossier × thème), entretien compris. */
  const attT = (d, th) => M.sum(d.lignes.filter(l => l.theme === th), l => l.attendu);

  /* ---------- Saisies, gardées sur le poste ---------- */
  let S = null;
  const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) { /* stockage indisponible : saisies gardées pour la session */ } };
  function etat() {
    if (S) return S;
    try { S = JSON.parse(localStorage.getItem(CLE)); } catch (e) { S = null; }
    if (!S || !Array.isArray(S.receptions)) {
      S = { receptions: [], sansDossier: [], ajust: {}, hist: [], envois: [] };
      // Réceptions de départ, au thème : les poses proches sont reçues, avec les cas des ateliers (manquant, partiel, retard, thème non
      // conforme, roulé, entretien non fourni)
      const cur = M.state.semaine, ds = base().dossiers;
      ds.forEach((d, k) => {
        const s0 = d.semaines[0], ech = M.deadlineReception(s0);
        if (s0 > cur + 2 || (s0 === cur + 2 && k % 2)) return;
        if (k === 3) return; // affiches totalement manquantes (cas « Skyrock S13 : 0 reçue / 55 attendues »)
        d.themes.forEach((th, ti) => {
          const att = attT(d, th), un = ti === 0;
          const date = new Date((k === 6 ? ech.getTime() + 2 * 864e5 : ech.getTime() - 2 * 864e5 + (k % 5) * 36e5) + ti * 18e5);
          S.receptions.push({ id: 'RB' + (100 + k) + '-' + ti, dossier: d.id, theme: th, date: date.toISOString(), bl: 'BL' + (553000 + k * 13), qte: k === 1 ? Math.round(att * 0.7) : att,
            entretien: k === 9 ? 'Non' : 'Oui', themes: k === 4 && un ? 'Non' : 'Oui', photo: 'photo-' + d.id + '-' + (ti + 1) + '.jpg',
            test: { tenue: 'OK', allongement: 'OK', massicotage: k === 4 && un ? 'KO' : 'OK' }, nc: k === 8 && un ? 'ROULE' : '',
            comm: k === 4 && un ? 'Visuel reçu différent de l’instruction de pose' : '', user: 'Magasinier Nanterre' });
        });
      });
      S.sansDossier.push({ id: 'SD1', date: M.at(cur, 1, 8, 40).toISOString(), bl: 'BL553911', client: 'Banque Horizon', qte: 140, user: 'Magasinier Nanterre' });
      // Ajustement d'exemple : le cadastre d'Aubervilliers (parc A, arrière 1) ramené au terrain
      ds.forEach(d => d.lignes.filter(l => l.centre === 'AUB' && l.parc === 'A' && l.format === 'AR1').forEach(l => {
        S.ajust[l.id] = { q: 36, date: M.at(cur, 0, 9, 0).toISOString(), user: "Chef d'équipe" };
        S.hist.push({ ligne: l.id, avant: l.calc, apres: 36, date: M.at(cur, 0, 9, 0).toISOString(), user: "Chef d'équipe", motif: 'Parc réel : 36 arrières (cadastre erroné)' });
      }));
      garder();
    }
    return S;
  }

  /* ---------- Calculs ---------- */
  const recs = d => etat().receptions.filter(x => x.dossier === d.id);
  const recsT = (d, th) => recs(d).filter(x => x.theme === th);
  const recu = d => M.sum(recs(d), x => Number(x.qte) || 0);
  const recuT = (d, th) => M.sum(recsT(d, th), x => Number(x.qte) || 0);
  const echeance = d => M.deadlineReception(d.semaines[0]);
  const maintenant = () => new Date(M.NOW);
  /** Statut d'un visuel, avec les mots du tableau de Wissous / Nîmes. */
  const statutT = (d, th) => { const q = recuT(d, th), a = attT(d, th); return q === 0 ? 'Attendue' : q < a ? 'Partielle' : q > a * 1.1 ? 'Surplus' : 'Complète'; };
  const STATUT_T = { Attendue: 'info', Partielle: 'serious', Complète: 'good', Surplus: 'warning' };
  /** Statut de réception du dossier (BUS-07), pour À traiter et la vue des réceptions. */
  const statut = d => { const q = recu(d); return q === 0 ? (maintenant() > echeance(d) ? 'MANQUANT' : 'ATTENDU') : q < d.attendu ? 'PARTIEL' : 'RECU'; };
  const STATUT = { ATTENDU: ['info', 'Attendu'], RECU: ['good', 'Reçu'], PARTIEL: ['serious', 'Reçu en partie'], MANQUANT: ['critical', 'Non reçu, échéance passée'] };
  /** Les quatre anomalies de réception (BUS-15, US CIR-05), pour un visuel puis pour le dossier. */
  const anomaliesT = (d, th) => {
    const rs = recsT(d, th), q = recuT(d, th), ech = echeance(d);
    return [q === 0 && maintenant() > ech ? 'Affiches manquantes' : null, q > 0 && q < attT(d, th) ? 'Quantité inférieure à l’attendu' : null,
      rs.some(x => new Date(x.date) > ech) ? 'Retard de réception' : null, rs.some(x => x.themes === 'Non') ? 'Thème non conforme' : null].filter(Boolean);
  };
  const anomalies = d => M.uniq(d.themes.flatMap(th => anomaliesT(d, th)));
  const NC = { '': 'Aucune', ROULE: 'Conditionnement : affiches roulées (moins de 50 ex., admis par les CGV, non bloquant)', FORMAT: 'Format non conforme (ex. attendu 274×68, reçu 192×68)' };
  const aEncoller = l => (etat().ajust[l.id] ? etat().ajust[l.id].q : l.calc);
  /** Racks de 105 plaques comptés par centre bus, pour des lignes d'une même semaine : un rack part vers un seul centre (kick-off :
      « racks de transport par dépôt » ; fiche de préparation). Même calcul dans À traiter et le Suivi de prod (09/11). */
  const racks = ls => M.sum(Object.values(M.groupBy(ls, l => l.centre)), xs => Math.ceil(M.sum(xs, aEncoller) / PLAQUES_PAR_RACK));
  /** Plaques à encoller d'un visuel (dossier × thème), toutes ses lignes, et règle « couvert » du Suivi de prod (09/11, à confirmer
      avec Fabrice Planchard et Philippe Le Calvé) : les affiches reçues couvrent les plaques à encoller, même si l'entretien manque. */
  const besoinT = (d, th) => M.sum(deTheme(d, th), aEncoller);
  const entretienL = l => l.attendu - l.vendu;
  const envoisSem = s => etat().envois.filter(e => e.sem === s);
  const dernierEnvoi = s => envoisSem(s)[0] || null;
  const aRenvoyer = (l, s) => { const e = dernierEnvoi(s), a = etat().ajust[l.id]; return !!(e && a && a.date > e.date); };
  const lignesSem = s => base().dossiers.filter(d => d.semaines[0] === s).flatMap(d => d.lignes.map(l => Object.assign({ d }, l)));
  // « Prêt à préparer » (09/11) : même règle « couvert » que le Suivi de prod, chaque visuel a reçu au moins ses plaques à encoller
  // (avant : tout reçu, entretien compris ; contraire à l'exception de l'atelier 1)
  const etape = d => (dernierEnvoi(d.semaines[0]) ? 'FS' : d.themes.every(th => recuT(d, th) >= besoinT(d, th)) ? 'PRET' : recu(d) > 0 ? 'PARTIEL' : 'ATTENTE');
  const ETAPE = { ATTENTE: ['warning', 'Affiches attendues'], PARTIEL: ['serious', 'Reçu en partie'], PRET: ['good', 'Prêt à préparer'], FS: ['good', 'Envoyé à Field Service'] };
  const finD = d => d.semaines[d.semaines.length - 1];
  const occupe = (s, l) => base().dossiers.some(x => x.semaines.includes(s) && x.lignes.some(y => y.centre === l.centre && y.parc === l.parc && y.format === l.format));
  /** Reste en place (BUS-26, règle ouverte) : plaques d'un package qui finit en S ou S+1 sans être revendu la semaine suivante. */
  const resteEnPlace = d => { const cur = M.state.semaine, fin = finD(d); return fin === cur || fin === cur + 1 ? M.sum(d.lignes.filter(l => !occupe(fin + 1, l)), l => l.vendu) : 0; };
  const semL = d => d.semaines.map(s => 'S' + s).join(' + ');
  const tags = xs => h('span', null, xs.map(x => ui.tag(x, 'hyp')));
  const head = (titre, actions) => ui.pageHead({ crumb: 'Bus · Nanterre', title: titre, screen: 'bus', actions });
  const semaines = (a, b) => { const out = []; for (let s = a; s <= b; s++) out.push(s); return out; };
  const opts = (vals, lab) => M.uniq(vals).map(v => ({ value: v, label: lab ? lab(v) : v }));
  const deTheme = (d, th) => d.lignes.filter(l => l.theme === th);
  /** Filtres posés par un lien du Suivi de prod (09/11) : « clé=v1,v2 » dans l'adresse ; « * » vide le filtre. */
  const presetDe = (params, cles) => { const p = {}; cles.forEach(k => { if (params && params[k]) p[k] = params[k] === '*' ? [] : String(params[k]).split(','); }); return Object.keys(p).length ? p : null; };

  /** Impression d'un document (fiche, étiquettes) dans une fenêtre à part. */
  function imprimer(titre, node) {
    const w = window.open('', '_blank');
    if (!w) { ui.toast('Fenêtre d’impression bloquée par le navigateur.', 'critical'); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + titre + '</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:18px}h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:16px 0 6px}table{border-collapse:collapse;width:100%;margin-bottom:8px}th,td{border:1px solid #888;padding:4px 6px;text-align:left}th{background:#eee}.num{text-align:right}.saut{page-break-after:always}.etq{display:inline-block;width:46%;border:2px solid #000;margin:6px;padding:10px;vertical-align:top}.etq b{font-size:16px}</style></head><body>' + node.outerHTML + '</body></html>');
    w.document.close(); w.focus(); setTimeout(() => w.print(), 200);
  }

  /* =====================================================================================================================
     Suivi de prod (09/11, demande « fait dashboard pour bus ») : le tableau de bord de l'onglet, en tête comme dans les autres
     onglets (décision du 16/10). Il sert au point hebdomadaire de Nanterre du jeudi 11 h (note §5 : les attendus et les retards) et
     à la charge à 6 semaines (BUS-04, BUS-25). Chaque nombre ouvre la page où l'on agit, avec ses filtres posés.
     Conçu d'après trois propositions (exploitation de Nanterre, préproduction, point du jeudi) notées par deux juges. Écartés :
     l'envoi à Field Service (flux non arbitré : son état reste dans Préparation), le reste en place (BUS-26 ouverte : filtre de
     À traiter), un « parc à vérifier » (règle à créer : BUS-21, BUS-22), les quantités ajustées (trace dans l'Historique de
     Préparation). Les BUS-xx sont ceux de la note, écrits en texte (besoins.js a d'autres BUS-01 à BUS-04).
     ===================================================================================================================== */
  function pageSuivi(root) {
    const cur = M.state.semaine, now = maintenant(), sems = semaines(cur, cur + 6);
    // Lignes à encoller (centre bus × parc × format, avec leur thème) des poses de S à S+6, comme À traiter
    const rows = base().dossiers.filter(d => d.semaines[0] >= cur && d.semaines[0] <= cur + 6).flatMap(d => d.lignes.map(l => Object.assign({ d }, l)));
    const F = ui.filters({ id: 'bus-suivi', rows, defs: [
      ui.dossierFilter(rows, l => l.d.id),
      { key: 'semaine', label: 'Pose', options: sems.map(s => ({ value: s, label: 'S' + s + ' · échéance ' + M.fmt.day(M.deadlineReception(s)), short: 'S' + s })), get: l => l.d.semaines[0], stable: true,
        summary: sel => (sel.length ? M.fmt.sems(sel) : 'S' + cur + ' à S' + (cur + 6)), help: 'Semaine de pose ; l’échéance de livraison est le vendredi S-2 à 16 h 30' },
      { key: 'centre', label: 'Centre bus', options: CENTRES.map(c => ({ value: c.id, label: c.label.replace('Centre bus ', '') + ' · ' + dspL(c.dsp).replace('DSP ', '') })), get: l => l.centre, stable: true },
      { key: 'format', label: 'Format', options: FORMATS.map(f => ({ value: f.id, label: f.label })), get: l => l.format, stable: true },
      { key: 'annonceur', label: 'Annonceur', more: true, options: opts(rows.map(l => l.d.client)), get: l => l.d.client },
      { key: 'dsp', label: 'DSP', more: true, options: DSP.filter(x => x.plateforme).map(x => ({ value: x.id, label: x.label })), get: l => CENTRES.find(c => c.id === l.centre).dsp },
    ] });
    const vis = F.apply(rows), choisies = F.weeks();
    // Prochaine échéance de livraison après maintenant (vendredi S-2, 16 h 30 : BUS-10)
    let sp = cur - 3;
    while (sp < cur + 10 && M.deadlineReception(sp) <= now) sp++;
    const prochaine = M.deadlineReception(sp);
    // Visuels (dossier × thème) des lignes retenues ; « prêt » = règle « couvert » (besoinT), le retard ne compte que ce qui n'est pas prêt
    const visuels = Object.values(M.groupBy(vis, l => l.d.id + '|' + l.theme)).map(ls => {
      const d = ls[0].d, th = ls[0].theme, ech = echeance(d), besoin = besoinT(d, th), q = recuT(d, th), pret = q >= besoin;
      return { id: d.id + '|' + th, d, th, ls, ech, besoin, q, pret, retard: !pret && now > ech, bientot: !pret && ech > now && ech <= prochaine };
    });
    const parV = new Map(visuels.map(v => [v.id, v]));
    const estPret = l => parV.get(l.d.id + '|' + l.theme).pret;
    const plaques = ls => ({ attente: M.sum(ls.filter(l => !estPret(l)), aEncoller), pret: M.sum(ls.filter(estPret), aEncoller) });
    const racksSem = ls => M.sum(Object.values(M.groupBy(ls, l => l.d.semaines[0])), racks);
    const semDe = ls => (choisies.length === 1 ? choisies[0] : ls.length ? Math.min(...ls.map(l => l.d.semaines[0])) : cur + 1);
    const manque = vs => M.sum(vs, v => v.besoin - v.q);
    // Un nombre ouvre Réceptions attendues sur ses dossiers, les autres filtres vidés (« * ») : on y voit ce qu'on a compté
    const versReception = vs => M.go('bus', { tab: 'reception', dossier: M.uniq(vs.map(v => v.d.id)).join(',') || '*', statut: '*', semaine: '*', format: '*', annonceur: '*', centre: '*' });
    // Préparation (une semaine) : avec les filtres N° de dossier, Centre bus et Format du Suivi de prod
    const versPrep = (sem, centre) => M.go('bus', { tab: 'preparation', sem, dossier: F.sel('dossier').join(',') || '*', centre: centre || F.sel('centre').join(',') || '*', format: F.sel('format').join(',') || '*' });

    const p = plaques(vis), total = p.attente + p.pret;
    const retard = visuels.filter(v => v.retard), bientot = visuels.filter(v => v.bientot);
    // BL sans n° de dossier : seul le filtre Annonceur s'y applique (client lu sur le BL)
    const bls = F.apply(etat().sansDossier, { dossier: null, semaine: null, centre: null, format: null, dsp: null, annonceur: x => x.client });
    // Couleurs des étapes de Pilotage › Suivi de prod, même sens : jaune uni = en attente d'affiches, orange hachuré = prêt
    const E = M.chart.ETAPES;
    const SERIES = [{ key: 'attente', label: 'En attente d’affiches', color: E[0].color, decal: E[0].decal }, { key: 'pret', label: 'Prêt à préparer', color: E[1].color, decal: E[1].decal }];
    const parSem = (choisies.length ? sems.filter(s => choisies.includes(s)) : sems).map(s => {
      const ls = vis.filter(l => l.d.semaines[0] === s), ech = M.deadlineReception(s), v = plaques(ls);
      return { label: 'S' + s, sub: 'échéance ' + M.fmt.day(ech) + (now > ech ? ' (passée)' : ''), values: v, t: v.attente + v.pret, racks: racks(ls), onClick: () => versPrep(s) };
    });
    const pic = parSem.reduce((a, r) => (r.t > (a ? a.t : 0) ? r : a), null);
    const parCentre = CENTRES.filter(c => vis.some(l => l.centre === c.id)).map(c => {
      const ls = vis.filter(l => l.centre === c.id);
      return { label: c.label.replace('Centre bus ', ''), sub: dspL(c.dsp).replace('DSP ', ''), values: plaques(ls), racks: racksSem(ls), onClick: () => versPrep(semDe(ls), c.id) };
    });
    const totalRacks = (r, t) => M.fmt.n(t) + ' · ' + r.racks + ' rack' + (r.racks > 1 ? 's' : '');
    const attente = visuels.filter(v => !v.pret).sort((a, b) => a.ech - b.ech || a.d.id.localeCompare(b.d.id));
    const blClient = d => etat().sansDossier.filter(x => x.client === d.client);
    const situation = v => (v.retard ? ['critical', 'En retard'] : v.bientot ? ['warning', 'D’ici le ' + M.fmt.day(prochaine)] : ['info', 'Pas encore dû']);

    root.append(head('Suivi bus'), F.bar, // 11/11 (utilisatrice) : « Suivi bus », comme « Suivi 2 m² fixe », « Suivi pliage », « Suivi déroulant »
      h('div', { class: 'kpis', style: { marginBottom: '12px' } },
        ui.stat({ label: 'Prêt à préparer', value: total ? Math.floor(100 * p.pret / total) + ' %' : '—', sub: M.fmt.n(p.pret) + ' plaques sur ' + M.fmt.n(total) + ' ont leurs affiches',
          title: 'Plaques dont le visuel a reçu au moins autant d’affiches que de plaques à encoller', onClick: () => versPrep(semDe(vis)) }),
        ui.stat({ label: 'En retard', value: retard.length, sub: retard.length ? M.fmt.n(manque(retard)) + ' affiches manquent, échéance passée' : 'aucun visuel après l’échéance', onClick: () => versReception(retard) }),
        ui.stat({ label: 'À recevoir d’ici le ' + M.fmt.day(prochaine), value: bientot.length, sub: bientot.length ? M.fmt.n(manque(bientot)) + ' affiches à recevoir pour encoller' : 'rien d’attendu pour cette échéance', onClick: () => versReception(bientot) }),
        ui.stat({ label: 'Plaques à encoller', value: M.fmt.n(total), sub: racksSem(vis) + ' racks' + (pic ? ' · pic ' + pic.label + ' : ' + M.fmt.n(pic.t) : ''), title: 'Racks de 105 plaques, comptés par centre bus et par semaine', onClick: () => M.go('bus', { tab: 'atraiter' }) }),
        ui.stat({ label: 'BL sans n° de dossier', value: bls.length, sub: bls.length ? M.fmt.n(M.sum(bls, x => x.qte)) + ' affiches, à rattacher avant de relancer un client' : 'rien à rattacher', onClick: () => M.go('bus', { tab: 'reception' }) })),
      ui.annot('Prêt à préparer : les affiches reçues pour le visuel couvrent ses plaques à encoller (calcul Broadcast ou quantité ajustée), même si l’entretien manque. Règle à confirmer avec Fabrice Planchard et Philippe Le Calvé.', null),
      h('div', { class: 'grid cols-2', style: { marginTop: '12px' } },
        ui.card({ body: M.chart.hbars({ series: SERIES, rows: parSem, unit: 'plaques', caption: 'Charge par semaine de pose', rowHeader: 'Pose', totalLabel: totalRacks }) }),
        ui.card({ body: M.chart.hbars({ series: SERIES, rows: parCentre, unit: 'plaques', caption: 'À encoller par centre bus', rowHeader: 'Centre bus', totalLabel: totalRacks }) })),
      ui.card({ title: 'Visuels en attente d’affiches', sub: 'L’échéance la plus proche en premier', flush: true, style: { marginTop: '16px' },
        body: ui.table({ id: 'bus-suivi', rows: attente, exportName: 'bus-suivi-visuels-en-attente.xlsx', onRowClick: v => detailDossier(v.d),
          empty: 'Tous les visuels retenus par les filtres ont leurs affiches.',
          rowActions: v => ui.btn('Ouvrir la réception', () => versReception([v]), { small: true }),
          columns: [
            { key: 'dossier', label: 'Dossier', nowrap: true, value: v => v.d.id },
            { key: 'visuel', label: 'Visuel', value: v => v.d.client + ' · ' + v.th, render: v => h('span', null, h('b', null, v.d.client), h('div', { class: 'small muted' }, v.th)) },
            { key: 'pose', label: 'Pose', nowrap: true, value: v => v.d.semaines[0], render: v => semL(v.d) },
            { key: 'ech', label: 'Échéance de livraison', nowrap: true, title: 'Vendredi S-2 à 16 h 30 (BUS-10)', value: v => v.ech.getTime(), render: v => M.fmt.day(v.ech) },
            { key: 'situation', label: 'Situation', value: v => situation(v)[1], render: v => ui.sev(situation(v)[0], situation(v)[1]) },
            { key: 'recu', label: 'Reçu / à encoller', align: 'num', title: 'Affiches reçues / plaques à encoller du visuel (toutes ses lignes)', value: v => v.q / (v.besoin || 1),
              csv: v => v.q + ' / ' + v.besoin, render: v => M.fmt.n(v.q) + ' / ' + M.fmt.n(v.besoin) },
            { key: 'manque', label: 'Manque', align: 'num', title: 'Affiches qui manquent pour encoller', value: v => v.besoin - v.q },
            { key: 'anom', label: 'Anomalies', value: v => anomaliesT(v.d, v.th).join(', '), render: v => tags(anomaliesT(v.d, v.th)) },
            { key: 'bl', label: 'BL sans n° du même client', title: 'À rattacher avant de relancer le client (BUS-08, atelier 1)', value: v => blClient(v.d).map(x => (x.bl || 'BL sans n°') + ' (' + x.qte + ' affiches)').join(', '),
              render: v => { const xs = blClient(v.d); return xs.length ? ui.tag('Rattacher d’abord ' + xs.map(x => (x.bl || 'le BL sans n°') + ' (' + M.fmt.n(x.qte) + ')').join(', '), 'hyp') : '—'; } },
            { key: 'attendu', label: 'Attendu, entretien compris', align: 'num', hidden: true, value: v => attT(v.d, v.th) },
            { key: 'plaques', label: 'Plaques retenues par les filtres', align: 'num', hidden: true, value: v => M.sum(v.ls, aEncoller) },
            { key: 'centres', label: 'Centres bus', hidden: true, value: v => M.uniq(v.ls.map(l => cbL(l.centre))).join(', ') },
            { key: 'formats', label: 'Formats', hidden: true, value: v => M.uniq(v.ls.map(l => fmtL(l.format))).join(', ') }] }) }));
  }

  /* =====================================================================================================================
     Réceptions attendues (BUS-06 : en premier ; BUS-07 à BUS-13, BUS-15) : le tableau de Wissous / Nîmes, pour Nanterre
     ===================================================================================================================== */
  function receptionner(d, th) {
    const f = { bl: '', date: new Date(M.NOW).toISOString().slice(0, 16), qte: String(Math.max(0, attT(d, th) - recuT(d, th))), entretien: 'Oui', themes: 'Oui', photo: '', tenue: '', allongement: '', massicotage: '', nc: '', comm: '' };
    const photo = h('input', { type: 'file', accept: 'image/*', class: 'form-control', onchange: e => { f.photo = e.target.files[0] ? e.target.files[0].name : ''; } });
    const oknok = (k, label) => ui.field(label, ui.select({ value: f[k], label, options: [{ value: '', label: '—' }, 'OK', 'KO'], onChange: v => { f[k] = v; } }));
    ui.modal({ title: 'Réceptionner · dossier ' + d.id + ' · ' + d.client + ' · « ' + th + ' »', wide: true, body: [
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Attendu pour ce visuel : ' + M.fmt.n(attT(d, th)) + ' affiches, entretien compris (' + d.entretien + ' %) · déjà reçu : ' + M.fmt.n(recuT(d, th)) + ' · pose ' + semL(d) + ' · échéance de livraison ' + M.fmt.dt(echeance(d)) + ' (vendredi S-2).'),
      h('div', { class: 'grid cols-3', style: { gap: '12px' } },
        ui.field('N° de BL (facultatif)', ui.input({ value: f.bl, placeholder: 'BL…', onInput: v => { f.bl = v; } })),
        ui.field('Date de réception', ui.input({ type: 'datetime-local', value: f.date, onInput: v => { f.date = v; } })),
        ui.field('Quantité reçue (affiches)', ui.input({ type: 'number', min: 0, value: f.qte, onInput: v => { f.qte = v; } })),
        ui.field('Entretien fourni ?', ui.select({ value: f.entretien, options: ['Oui', 'Non'], onChange: v => { f.entretien = v; } })),
        ui.field('Thème conforme à l’instruction de pose ?', ui.select({ value: f.themes, options: ['Oui', 'Non'], onChange: v => { f.themes = v; } })),
        // BUS-13 (atelier 3) : la photo de l'affiche telle qu'elle est livrée, avant d'être collée sur la plaque
        ui.field('Photo de l’affiche reçue, avant collage sur la plaque', photo)),
      h('div', { class: 'small muted', style: { marginTop: '4px' } }, 'La photo montre le visuel et l’état de l’affiche livrée par l’imprimeur ; la préproduction et le commerce la voient (BUS-13). Une fois l’affiche collée sur la plaque, on ne peut plus le montrer.'),
      h('h3', { style: { fontSize: '14px', margin: '14px 0 6px' } }, 'Test de collage (facultatif, règle ouverte BUS-14)'),
      h('div', { class: 'grid cols-3', style: { gap: '12px' } }, oknok('tenue', 'Tenue'), oknok('allongement', 'Allongement'), oknok('massicotage', 'Massicotage')),
      h('h3', { style: { fontSize: '14px', margin: '14px 0 6px' } }, 'Non-conformité (BUS-12 : défaut de conditionnement ou de format, jamais une absence de livraison)'),
      ui.field('Non-conformité', ui.select({ value: f.nc, options: Object.entries(NC).map(([v, l]) => ({ value: v, label: l })), onChange: v => { f.nc = v; } }), true),
      ui.field('Commentaire', ui.input({ value: f.comm, placeholder: 'Visible par la préproduction', onInput: v => { f.comm = v; } }), true),
    ], actions: [{ label: 'Annuler' }, { label: 'Enregistrer la réception', primary: true, onClick: () => {
      const q = Number(f.qte);
      if (!(q >= 0)) { ui.toast('Quantité reçue invalide.', 'critical'); return true; }
      etat().receptions.push({ id: 'RB' + Date.now().toString(36), dossier: d.id, theme: th, date: new Date(f.date || M.NOW).toISOString(), bl: f.bl, qte: q, entretien: f.entretien, themes: f.themes,
        photo: f.photo, test: { tenue: f.tenue, allongement: f.allongement, massicotage: f.massicotage }, nc: f.nc, comm: f.comm, user: user() });
      garder(); M.journal('Bus ' + d.id, 'Réception de ' + q + ' affiches « ' + th + ' »'); M.refresh();
      ui.toast('Réception enregistrée pour le dossier ' + d.id + ' (« ' + th + ' »).', 'good');
    } }] });
  }
  function detailDossier(d) {
    ui.modal({ title: 'Dossier ' + d.id + ' · ' + d.client, wide: true, body: [
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Pose ' + semL(d) + ' · ' + d.dsps.map(dspL).join(', ') + ' · formats : ' + d.formats.map(fmtL).join(', ') + ' · thèmes : ' + d.themes.join(', ') + ' · entretien ' + d.entretien + ' %'),
      h('div', { class: 'row', style: { marginBottom: '10px' } }, ui.sev(STATUT[statut(d)][0], STATUT[statut(d)][1]), anomalies(d).map(a => ui.tag(a, 'hyp'))),
      ui.table({ id: 'bus-recs-' + d.id, rows: recs(d), empty: 'Aucune réception pour ce dossier.',
        columns: [{ key: 'date', label: 'Reçue le', value: x => new Date(x.date).getTime(), render: x => M.fmt.dt(x.date) }, { key: 'theme', label: 'Thème' }, { key: 'bl', label: 'BL', value: x => x.bl || 'sans n°' },
          { key: 'qte', label: 'Quantité', align: 'num' }, { key: 'entretien', label: 'Entretien' }, { key: 'themes', label: 'Thème conforme' }, { key: 'photo', label: 'Photo', value: x => x.photo || '—' },
          { key: 'test', label: 'Test de collage', value: x => ['tenue', 'allongement', 'massicotage'].filter(k => x.test && x.test[k]).map(k => k + ' ' + x.test[k]).join(', ') || '—' },
          { key: 'nc', label: 'NC', value: x => (x.nc ? NC[x.nc].split(' :')[0].split(' (')[0] : '—') }, { key: 'comm', label: 'Commentaire', wrap: true }, { key: 'user', label: 'Par' }] }),
    ], actions: [{ label: 'Fermer' }] });
  }
  function sansDossierModal() {
    const f = { bl: '', client: '', qte: '' };
    ui.modal({ title: 'Réception sans n° de dossier sur le BL', body: [
      ui.annot('BUS-08 : le BL ne porte souvent pas le n° de dossier. La palette est enregistrée ; la préproduction complète le dossier ensuite, sans bloquer la préparation.', []),
      ui.field('N° de BL', ui.input({ placeholder: 'BL…', onInput: v => { f.bl = v; } })),
      ui.field('Client lu sur le BL', ui.input({ placeholder: 'Nom du client', onInput: v => { f.client = v; } })),
      ui.field('Quantité reçue', ui.input({ type: 'number', min: 0, onInput: v => { f.qte = v; } })),
    ], actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => {
      if (!f.client.trim() || !(Number(f.qte) > 0)) { ui.toast('Client et quantité sont nécessaires.', 'critical'); return true; }
      etat().sansDossier.push({ id: 'SD' + Date.now().toString(36), date: new Date(M.NOW).toISOString(), bl: f.bl, client: f.client.trim(), qte: Number(f.qte), user: user() });
      garder(); M.refresh(); ui.toast('Réception enregistrée : à compléter par la préproduction.', 'good');
    } }] });
  }
  function completer(x) {
    let choix = '';
    const cands = base().dossiers.slice().sort((a, b) => (b.client === x.client) - (a.client === x.client));
    ui.modal({ title: 'Compléter le n° de dossier · ' + (x.bl || 'BL sans n°'), body: [
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Client lu sur le BL : ' + x.client + ' · ' + M.fmt.n(x.qte) + ' affiches. Les dossiers de ce client sont proposés en premier.'),
      ui.field('Dossier et thème', ui.select({ value: '', options: [{ value: '', label: 'Choisir le dossier et le thème' }].concat(cands.flatMap(d => d.themes.map(th => ({ value: d.id + '|' + th, label: d.id + ' · ' + d.client + ' · « ' + th + ' » · pose ' + semL(d) })))), onChange: v => { choix = v; } }), true),
    ], actions: [{ label: 'Annuler' }, { label: 'Rattacher', primary: true, onClick: () => {
      if (!choix) { ui.toast('Choisissez le dossier et le thème.', 'critical'); return true; }
      const [did, th] = choix.split('|'), s = etat();
      s.sansDossier = s.sansDossier.filter(y => y.id !== x.id);
      s.receptions.push({ id: 'RB' + Date.now().toString(36), dossier: did, theme: th, date: x.date, bl: x.bl, qte: x.qte, entretien: 'Oui', themes: 'Oui', photo: '', test: {}, nc: '', comm: 'Dossier complété par la préproduction', user: x.user });
      garder(); M.journal('Bus ' + did, 'BL ' + (x.bl || 'sans n°') + ' rattaché par la préproduction'); M.refresh();
      ui.toast('Réception rattachée au dossier ' + did + '.', 'good');
    } }] });
  }
  function pageReceptions(root, params) {
    const cur = M.state.semaine;
    const rows = base().dossiers.flatMap(d => d.themes.map(th => ({ id: d.id + '|' + th, d, th })));
    // Filtres du tableau de Wissous / Nîmes : Statut (attendues et partielles par défaut), semaine, format, annonceur ; plus le centre bus.
    // Un nombre du Suivi de prod arrive avec ses dossiers posés (preset)
    const F = ui.filters({ id: 'bus-attendues', rows, preset: presetDe(params, ['dossier', 'statut', 'semaine', 'format', 'annonceur', 'centre']), defs: [
      ui.dossierFilter(rows, r => r.d.id),
      { key: 'statut', label: 'Statut', default: ['Attendue', 'Partielle'], options: ['Attendue', 'Partielle', 'Complète', 'Surplus'].map(s => ({ value: s, label: s })), get: r => statutT(r.d, r.th), stable: true },
      Object.assign(ui.weekFilter([cur, cur + 1, cur + 2], r => r.d.semaines), { label: 'Pose', help: 'Semaines de pose' }),
      { key: 'format', label: 'Format', options: FORMATS.map(f => ({ value: f.id, label: f.label })), get: r => M.uniq(deTheme(r.d, r.th).map(l => l.format)), stable: true },
      { key: 'annonceur', label: 'Annonceur', more: true, options: opts(rows.map(r => r.d.client)), get: r => r.d.client },
      { key: 'centre', label: 'Centre bus', more: true, options: CENTRES.map(c => ({ value: c.id, label: c.label })), get: r => M.uniq(deTheme(r.d, r.th).map(l => l.centre)) },
    ] });
    const tous = F.except(rows, 'statut'), n = s => tous.filter(r => statutT(r.d, r.th) === s).length;
    const manquantes = tous.filter(r => anomaliesT(r.d, r.th).includes('Affiches manquantes')).length;
    const voir = s => { F.set('statut', s); M.refresh(); };
    const sd = etat().sansDossier;
    root.append(head('Réceptions attendues', [ui.btn('Réception sans n° de dossier', sansDossierModal, { icon: 'plus', title: 'BL sans n° de dossier (BUS-08)' })]),
      h('div', { class: 'kpis', style: { marginBottom: '12px' } },
        ui.stat({ label: 'Attendues', value: n('Attendue'), sub: manquantes ? manquantes + ' avec l’échéance du vendredi S-2 passée' : 'livraison au plus tard le vendredi S-2', onClick: () => voir(['Attendue']) }),
        ui.stat({ label: 'Partielles', value: n('Partielle'), sub: 'quantité inférieure à l’attendu', onClick: () => voir(['Partielle']) }),
        ui.stat({ label: 'Complètes', value: n('Complète'), sub: 'quantité reçue', onClick: () => voir(['Complète']) }),
        ui.stat({ label: 'Surplus', value: n('Surplus'), sub: 'plus de 10 % au-delà de l’attendu', onClick: () => voir(['Surplus']) }),
        ui.stat({ label: 'BL sans n° de dossier', value: sd.length, sub: 'à compléter par la préproduction' })),
      F.bar,
      ui.card({ title: 'Réceptions attendues', sub: 'Le même tableau que pour Wissous et Nîmes : une ligne par visuel (dossier × thème). « Réceptionner » ajoute les contrôles du Bus.', flush: true,
        body: ui.table({ id: 'bus-attendues', rows: F.apply(rows), exportName: 'bus-receptions-attendues.xlsx', onRowClick: r => detailDossier(r.d),
          tone: r => (anomaliesT(r.d, r.th).includes('Affiches manquantes') ? 'critical' : { Partielle: 'serious', Surplus: 'warning' }[statutT(r.d, r.th)] || null),
          empty: 'Aucune réception attendue avec ces filtres.',
          rowActions: r => ui.btn('Réceptionner', () => receptionner(r.d, r.th), { small: true, primary: statutT(r.d, r.th) !== 'Complète' }),
          columns: [
            { key: 'dossier', label: 'Dossier', nowrap: true, value: r => r.d.id },
            { key: 'visuel', label: 'Visuel', value: r => r.d.client + ' · ' + r.th, render: r => h('span', null, h('b', null, r.d.client), h('div', { class: 'small muted' }, r.th)) },
            { key: 'pose', label: 'Pose', nowrap: true, title: 'Semaine de pose : le « Départ » des autres plateformes', value: r => r.d.semaines[0], render: r => semL(r.d) },
            { key: 'recuSur', label: 'Reçu / attendu', align: 'num', title: 'Affiches reçues / attendues, entretien compris', value: r => recuT(r.d, r.th) / (attT(r.d, r.th) || 1),
              csv: r => recuT(r.d, r.th) + ' / ' + attT(r.d, r.th), render: r => M.fmt.n(recuT(r.d, r.th)) + ' / ' + M.fmt.n(attT(r.d, r.th)) },
            { key: 'reste', label: 'Reste', align: 'num', value: r => Math.max(0, attT(r.d, r.th) - recuT(r.d, r.th)) },
            { key: 'statut', label: 'Statut', value: r => statutT(r.d, r.th), render: r => ui.sev(STATUT_T[statutT(r.d, r.th)], statutT(r.d, r.th)) },
            { key: 'ech', label: 'Échéance de livraison', nowrap: true, title: 'Vendredi S-2 (BUS-10)', value: r => echeance(r.d).getTime(), render: r => M.fmt.day(echeance(r.d)) },
            { key: 'anom', label: 'Anomalies', value: r => anomaliesT(r.d, r.th).join(', '), render: r => tags(anomaliesT(r.d, r.th)) },
            { key: 'annonceur', label: 'Annonceur', hidden: true, value: r => r.d.client }, { key: 'theme', label: 'Thème', hidden: true, value: r => r.th },
            { key: 'formats', label: 'Formats', hidden: true, value: r => M.uniq(deTheme(r.d, r.th).map(l => fmtL(l.format))).join(', ') },
            { key: 'centres', label: 'Centres bus', hidden: true, value: r => M.uniq(deTheme(r.d, r.th).map(l => cbL(l.centre))).join(', ') },
            { key: 'dsp', label: 'DSP', hidden: true, value: r => r.d.dsps.map(dspL).join(', ') },
            { key: 'attendu', label: 'Attendu', align: 'num', hidden: true, value: r => attT(r.d, r.th) }, { key: 'recu', label: 'Reçu', align: 'num', hidden: true, value: r => recuT(r.d, r.th) },
            { key: 'photo', label: 'Photo', hidden: true, value: r => (recsT(r.d, r.th).some(x => x.photo) ? 'oui' : '—') },
            { key: 'nc', label: 'NC', hidden: true, value: r => (recsT(r.d, r.th).some(x => x.nc) ? 'oui' : '—') }] }) }),
      sd.length ? ui.card({ title: 'BL sans n° de dossier · à compléter par la préproduction', sub: 'BUS-08 : la préparation n’est pas bloquée', flush: true, style: { marginTop: '16px' },
        body: ui.table({ id: 'bus-sansdossier', rows: sd,
          rowActions: x => ui.btn('Compléter', () => completer(x), { small: true, primary: true }),
          columns: [{ key: 'date', label: 'Reçue le', render: x => M.fmt.dt(x.date), value: x => new Date(x.date).getTime() }, { key: 'bl', label: 'BL', value: x => x.bl || 'sans n°' },
            { key: 'client', label: 'Client lu sur le BL' }, { key: 'qte', label: 'Quantité', align: 'num' }, { key: 'user', label: 'Par' }] }) }) : null);
  }

  /* =====================================================================================================================
     À traiter (BUS-01, BUS-04 : 6 semaines, BUS-05) ; reste en place en filtre (BUS-26)
     ===================================================================================================================== */
  function pageATraiter(root) {
    const cur = M.state.semaine, sems = semaines(cur, cur + 6);
    // Les dossiers en cours de pose ou à venir dans les 6 semaines
    const rows = base().dossiers.filter(d => finD(d) >= cur && d.semaines[0] <= cur + 6).map(d => ({ id: d.id, d }));
    const F = ui.filters({ id: 'bus-atraiter', rows, defs: [
      ui.dossierFilter(rows, r => r.d.id),
      ui.weekFilter([], r => r.d.semaines),
      { key: 'etape', label: 'Étape', options: Object.entries(ETAPE).map(([v, [, l]]) => ({ value: v, label: l })), get: r => etape(r.d), stable: true },
      // Reste en place (09/11) : plus de page, un filtre, comme le repère « Reste en place » de l'état des réservations vivant
      { key: 'rep', label: 'Reste en place', options: [{ value: 'oui', label: 'Fin de package sans revente' }, { value: 'non', label: 'Non' }], get: r => (resteEnPlace(r.d) ? 'oui' : 'non'), stable: true },
      { key: 'dsp', label: 'DSP', more: true, options: DSP.filter(x => x.plateforme).map(x => ({ value: x.id, label: x.label })), get: r => r.d.dsps },
    ] });
    const vis = F.apply(rows);
    // Racks comptés par centre bus depuis le 09/11 (avant : total de la semaine / 105), comme la fiche de préparation et le Suivi de prod
    const charge = s => { const ds = base().dossiers.filter(d => d.semaines[0] === s), ls = ds.flatMap(d => d.lignes); return { n: ds.length, pl: M.sum(ls, aEncoller), racks: racks(ls) }; };
    root.append(head('À traiter'),
      ui.annot('Visibilité à 6 semaines (BUS-04, au lieu de S-3 aujourd’hui) pour anticiper la charge, dimensionner les ressources et le roulement des racks (100 à 110 plaques par rack, comptés par centre bus). Les dossiers Bus suivent les mêmes étapes que les autres formats, avec un seul type de préparation : « collé » (BUS-05). Reste en place : un filtre et une colonne (fin de package en S ou S+1 sans revente) ; la règle, déposer ou laisser, plafonnée à 2 semaines ou non, reste à fixer avec l’exploitation (BUS-26).', []),
      h('div', { class: 'kpis', style: { marginBottom: '12px' } }, sems.map(s => { const c = charge(s); return ui.stat({ label: 'Pose S' + s, value: M.fmt.n(c.pl) + ' plaques', sub: c.n + ' dossier' + (c.n > 1 ? 's' : '') + ' · ' + c.racks + ' rack' + (c.racks > 1 ? 's' : ''), title: 'Racks de 105 plaques, comptés par centre bus : un rack part vers un seul centre', onClick: () => { F.set('semaine', [String(s)]); M.refresh(); } }); })),
      F.bar,
      ui.card({ flush: true, body: ui.table({ id: 'bus-atraiter', rows: vis, exportName: 'bus-a-traiter.xlsx', onRowClick: r => detailDossier(r.d),
        empty: 'Aucun dossier Bus avec ces filtres.',
        columns: [
          { key: 'dossier', label: 'Dossier', nowrap: true, value: r => r.d.id }, { key: 'client', label: 'Client', value: r => r.d.client },
          { key: 'pose', label: 'Pose', nowrap: true, value: r => r.d.semaines[0], render: r => semL(r.d) },
          { key: 'dsp', label: 'DSP', value: r => r.d.dsps.map(dspL).join(', ') },
          { key: 'centres', label: 'Centres bus', align: 'num', value: r => M.uniq(r.d.lignes.map(l => l.centre)).length },
          { key: 'formats', label: 'Formats', value: r => r.d.formats.map(fmtL).join(', ') }, { key: 'themes', label: 'Thèmes', value: r => r.d.themes.join(', ') },
          { key: 'vendu', label: 'Vendu (plaques)', align: 'num', value: r => r.d.vendu },
          { key: 'encoller', label: 'À encoller', align: 'num', value: r => M.sum(r.d.lignes, aEncoller), title: 'Calcul Broadcast (+8 % figé) ou quantité ajustée par la production' },
          { key: 'entretien', label: 'Entretien', align: 'num', value: r => r.d.entretien, render: r => r.d.entretien + ' %' },
          { key: 'attendu', label: 'Affiches attendues', align: 'num', value: r => r.d.attendu }, { key: 'recu', label: 'Reçues', align: 'num', value: r => recu(r.d) },
          { key: 'etape', label: 'Étape', value: r => ETAPE[etape(r.d)][1], render: r => ui.sev(ETAPE[etape(r.d)][0], ETAPE[etape(r.d)][1]) },
          { key: 'rep', label: 'Reste en place', title: 'Package qui finit en S ou S+1 sans être revendu : plaques concernées (instruction au poseur : déposer ou laisser)', value: r => resteEnPlace(r.d) || '',
            render: r => { const n = resteEnPlace(r.d); return n ? ui.tag('fin S' + finD(r.d) + ' · ' + M.fmt.n(n) + ' plaques', 'hyp') : '—'; } },
          { key: 'anom', label: 'Anomalies', value: r => anomalies(r.d).join(', '), render: r => tags(anomalies(r.d)) }] }) }));
  }

  /* =====================================================================================================================
     Préparation (BUS-16 à BUS-20, BUS-22 ; US CIR-02) et envoi à Field Service (kick-off du 26/05, étape 5)
     ===================================================================================================================== */
  const st = { sem: null, entretien: true };
  function ajuster(l, v) {
    if (!peutAjuster()) { ui.toast('Seuls les profils habilités de la production ajustent (BUS-20).', 'critical'); return; }
    const n = Math.round(Number(v));
    if (!(n >= 0)) { ui.toast('Quantité invalide.', 'critical'); M.refresh(); return; }
    const avant = aEncoller(l);
    if (n === avant) return;
    const date = new Date().toISOString();
    etat().ajust[l.id] = { q: n, date, user: user() };
    etat().hist.unshift({ ligne: l.id, avant, apres: n, date, user: user(), motif: '' });
    garder(); M.refresh();
  }
  function retablir(l) {
    const a = etat().ajust[l.id];
    if (!a) return;
    etat().hist.unshift({ ligne: l.id, avant: a.q, apres: l.calc, date: new Date().toISOString(), user: user(), motif: 'Retour au calcul Broadcast' });
    delete etat().ajust[l.id]; garder(); M.refresh();
  }
  function fichePreparation(s, ls) {
    const doc = h('div', null, Object.entries(M.groupBy(ls, l => l.centre)).map(([c, xs], k, all) => h('div', { class: k < all.length - 1 ? 'saut' : '' },
      h('h1', null, 'Fiche de préparation · ' + cbL(c)), h('div', null, 'Pose S' + s + ' · ' + dspL(CENTRES.find(x => x.id === c).dsp) + ' · ' + (st.entretien ? 'avec entretien' : 'sans entretien')),
      h('table', null, h('thead', null, h('tr', null, ['Contrat', 'Annonceur', 'Thème', 'Format', 'Parc', 'À encoller'].concat(st.entretien ? ['Entretien (affiches)'] : []).map(t => h('th', null, t)))),
        h('tbody', null, xs.sort((a, b) => a.d.id.localeCompare(b.d.id) || a.format.localeCompare(b.format)).map(l => h('tr', null, h('td', null, l.d.id), h('td', null, l.d.client), h('td', null, l.theme),
          h('td', null, fmtL(l.format) + (l.format === 'AV' ? ' (verni)' : '')), h('td', null, l.parc), h('td', { class: 'num' }, M.fmt.n(aEncoller(l))), st.entretien ? h('td', { class: 'num' }, M.fmt.n(entretienL(l))) : null)))),
      h('div', null, h('b', null, 'Total à encoller : ' + M.fmt.n(M.sum(xs, aEncoller)) + ' plaques'), ' · ' + Math.ceil(M.sum(xs, aEncoller) / PLAQUES_PAR_RACK) + ' rack(s)'))));
    apercu('Fiche de préparation · S' + s, doc, [ui.checkbox('Avec entretien', st.entretien, v => { st.entretien = v; })]);
  }
  function ficheSynthese(s, ls) {
    const parD = M.groupBy(ls, l => l.d.id);
    const doc = h('div', null, h('h1', null, 'Fiche de synthèse · pose S' + s), h('p', null, 'Quantités à préparer par client : quantité Broadcast (vendu + 8 %) et quantité ajustée par la production (US CIR-02, RG7).'),
      h('table', null, h('thead', null, h('tr', null, ['Client', 'Contrat', 'Centres bus', 'Vendu', 'Quantité Broadcast', 'Quantité ajustée', 'Écart'].map(t => h('th', null, t)))),
        h('tbody', null, Object.values(parD).map(xs => { const b = M.sum(xs, l => l.calc), a = M.sum(xs, aEncoller); return h('tr', null, h('td', null, xs[0].d.client), h('td', null, xs[0].d.id), h('td', null, M.uniq(xs.map(l => cbL(l.centre))).join(', ')),
          h('td', { class: 'num' }, M.fmt.n(M.sum(xs, l => l.vendu))), h('td', { class: 'num' }, M.fmt.n(b)), h('td', { class: 'num' }, M.fmt.n(a)), h('td', { class: 'num' }, (a - b > 0 ? '+' : '') + M.fmt.n(a - b))); }))));
    apercu('Fiche de synthèse · S' + s, doc);
  }
  function etiquettes(s, ls) {
    const doc = h('div', null, h('h1', null, 'Étiquettes de dispatch · pose S' + s), Object.values(M.groupBy(ls, l => l.centre + '|' + l.format)).map(xs => h('div', { class: 'etq' },
      h('b', null, cbL(xs[0].centre)), h('div', null, 'Format : ' + fmtL(xs[0].format) + (xs[0].format === 'AV' ? ' (verni)' : '')), h('div', null, 'Pose S' + s + ' · parcs ' + M.uniq(xs.map(l => l.parc)).join(', ')),
      h('div', null, h('b', null, M.fmt.n(M.sum(xs, aEncoller)) + ' plaques')), h('div', null, 'Contrats : ' + M.uniq(xs.map(l => l.d.id)).join(', ')))));
    apercu('Étiquettes de dispatch · S' + s, doc);
  }
  function apercu(titre, doc, options) {
    ui.modal({ title: titre, wide: true, body: [options ? h('div', { class: 'row', style: { marginBottom: '8px' } }, options) : null, h('div', { style: { maxHeight: '60vh', overflow: 'auto', border: '1px solid var(--border)', padding: '12px', background: '#fff' } }, doc)],
      actions: [{ label: 'Fermer' }, { label: 'Imprimer', primary: true, icon: 'printer', onClick: () => { imprimer(titre, doc); return true; } }] });
  }
  function historique(s) {
    const ids = new Set(lignesSem(s).map(l => l.id));
    const rows = etat().hist.filter(x => ids.has(x.ligne)).map((x, k) => Object.assign({ id: 'H' + k }, x));
    ui.modal({ title: 'Historique des ajustements · pose S' + s, wide: true, body: ui.table({ id: 'bus-hist', rows, empty: 'Aucun ajustement pour cette semaine.', exportName: 'bus-ajustements-S' + s + '.xlsx',
      columns: [{ key: 'date', label: 'Le', value: x => new Date(x.date).getTime(), render: x => M.fmt.dt(x.date) }, { key: 'user', label: 'Par' },
        { key: 'ligne', label: 'Ligne', value: x => { const p = x.ligne.split('|'); return p[0] + ' · ' + cbL(p[1]) + ' · parc ' + p[2] + ' · ' + fmtL(p[3]); } },
        { key: 'avant', label: 'Ancienne valeur', align: 'num' }, { key: 'apres', label: 'Nouvelle valeur', align: 'num' }, { key: 'motif', label: 'Motif' }] }) });
  }
  /** Envoi à Field Service (kick-off du 26/05, étape 5 « Circé → Field Service : instructions de pose ») : les quantités à encoller
      de la semaine, ajustées, par centre bus × parc × format. Simulé dans la maquette. */
  function envoyerFS(s, ls) {
    const total = M.sum(ls, aEncoller), e = dernierEnvoi(s), modifs = ls.filter(l => aRenvoyer(l, s)).length;
    ui.modal({ title: 'Envoyer à Field Service · pose S' + s, body: [
      ui.callout('warning', 'Flux à arbitrer', ' Demandé au kick-off du 26/05 (étape 5 : Circé → Field Service). L’atelier 4 du 11/06 et la note du 08/10 l’ont écarté : Broadcast envoie l’instruction de pose à Field Service, sans lien direct Circé ↔ Field Service, et l’ajustement est aujourd’hui saisi dans Field Service. Le bouton montre ce que l’envoi contiendrait.'),
      h('table', { class: 'dt', style: { marginTop: '10px' } }, h('tbody', null,
        [['Semaine de pose', 'S' + s], ['Centres bus', M.uniq(ls.map(l => cbL(l.centre))).join(', ')], ['Lignes (centre × parc × format × thème)', String(ls.length)],
          ['Plaques à encoller', M.fmt.n(total) + ' (dont ' + ls.filter(l => etat().ajust[l.id]).length + ' ligne(s) ajustée(s))'], ['Dernier envoi', e ? M.fmt.dt(e.date) + ' par ' + e.user + (modifs ? ' · ' + modifs + ' ligne(s) modifiée(s) depuis' : '') : 'aucun']]
          .map(([k, v]) => h('tr', null, h('th', { style: { width: '42%' } }, k), h('td', null, v))))),
    ], actions: [{ label: 'Annuler' }, { label: e ? 'Renvoyer à Field Service' : 'Envoyer à Field Service', primary: true, icon: 'send', onClick: () => {
      etat().envois.unshift({ id: 'FS' + Date.now().toString(36), sem: s, date: new Date().toISOString(), user: user(), lignes: ls.length, total, ajustees: ls.filter(l => etat().ajust[l.id]).length });
      garder(); M.journal('Bus S' + s, 'Envoi à Field Service : ' + ls.length + ' lignes, ' + total + ' plaques'); M.refresh();
      ui.toast('Envoyé à Field Service : ' + M.fmt.n(total) + ' plaques pour la pose S' + s + ' (simulation).', 'good');
    } }] });
  }
  function pagePreparation(root, params) {
    const cur = M.state.semaine;
    if (st.sem === null) st.sem = cur + 1;
    // Semaine posée par un lien du Suivi de prod : une fois par arrivée (M.navSeq), puis la liste « Semaine de pose » garde la main
    if (params && params.sem && st.semSeq !== M.navSeq) { st.sem = Number(params.sem); st.semSeq = M.navSeq; }
    const s = st.sem, ls = lignesSem(s);
    const rows = ls.map(l => Object.assign({}, l));
    const F = ui.filters({ id: 'bus-preparation', rows, preset: presetDe(params, ['dossier', 'centre', 'format']), defs: [
      ui.dossierFilter(rows, l => l.d.id),
      { key: 'centre', label: 'Centre bus', options: CENTRES.map(c => ({ value: c.id, label: c.label })), get: l => l.centre },
      { key: 'parc', label: 'Parc', options: PARCS.map(p => ({ value: p, label: 'Parc ' + p })), get: l => l.parc, stable: true },
      { key: 'format', label: 'Format', options: FORMATS.map(f => ({ value: f.id, label: f.label })), get: l => l.format, stable: true },
    ] });
    const vis = F.apply(rows), e = dernierEnvoi(s), modifs = ls.filter(l => aRenvoyer(l, s)).length;
    const choixSem = ui.field('Semaine de pose', ui.select({ value: s, label: 'Semaine de pose', options: semaines(cur - 1, cur + 6).map(n => ({ value: n, label: 'S' + n })), onChange: v => { st.sem = Number(v); M.refresh(); } }));
    root.append(head('Préparation', [
      ui.btn('Fiche de préparation', () => fichePreparation(s, vis), { icon: 'printer', title: 'Une feuille par centre bus et par semaine (BUS-17)' }),
      ui.btn('Fiche de synthèse', () => ficheSynthese(s, vis), { icon: 'file-text' }),
      ui.btn('Étiquettes de dispatch', () => etiquettes(s, vis), { icon: 'tag' }),
      ui.btn('Historique', () => historique(s), { icon: 'history', ghost: true }),
      ui.btn(e ? 'Renvoyer à Field Service' : 'Envoyer à Field Service', () => envoyerFS(s, ls), { primary: true, icon: 'send', title: 'Kick-off du 26/05, étape 5 : à arbitrer' })]),
      h('div', { class: 'row', style: { marginBottom: '10px', alignItems: 'flex-end' } }, choixSem,
        e ? ui.sev(modifs ? 'warning' : 'good', modifs ? 'Envoyé à Field Service le ' + M.fmt.dt(e.date) + ' · ' + modifs + ' ligne(s) modifiée(s) depuis : à renvoyer' : 'Envoyé à Field Service le ' + M.fmt.dt(e.date) + ' par ' + e.user) : ui.sev('info', 'Pas encore envoyé à Field Service'),
        peutAjuster() ? null : ui.tag('Lecture seule : l’ajustement est réservé à la production (chef d’équipe, admin)', 'hyp')),
      ui.annot('Ajustement de la quantité à encoller (BUS-19, BUS-20, US CIR-02) : à la hausse ou à la baisse, par centre bus × parc × format, jamais à la campagne ni au dossier ; strictement manuel ; tracé (auteur, date, ancienne et nouvelle valeur) ; la quantité vendue et l’instruction de pose ne changent pas. Calcul Broadcast = vendu + 8 % (figé). Restent ouverts (BUS-22) : jusqu’à quand ajuster, une quantité nulle, la réédition des documents déjà sortis.', []),
      F.bar,
      ui.card({ flush: true, body: ui.table({ id: 'bus-preparation', rows: vis, exportName: 'bus-preparation-S' + s + '.xlsx', maxHeight: '520px',
        empty: 'Aucune ligne à préparer pour la pose S' + s + ' avec ces filtres.',
        tone: l => (aRenvoyer(l, s) ? 'warning' : etat().ajust[l.id] ? 'info' : null),
        rowActions: l => (etat().ajust[l.id] && peutAjuster() ? ui.btn('Rétablir', () => retablir(l), { small: true, ghost: true, title: 'Revenir au calcul Broadcast (' + l.calc + ')' }) : null),
        footer: (c, rs) => (c.key === 'centre' ? 'Total' : ['vendu', 'calc', 'encoller', 'ecart'].includes(c.key) ? M.fmt.n(M.sum(rs, l => ({ vendu: l.vendu, calc: l.calc, encoller: aEncoller(l), ecart: aEncoller(l) - l.calc }[c.key]))) : ''),
        columns: [
          { key: 'centre', label: 'Centre bus', value: l => cbL(l.centre) }, { key: 'parc', label: 'Parc', value: l => l.parc },
          { key: 'format', label: 'Format', value: l => fmtL(l.format) + (l.format === 'AV' ? ' (verni)' : '') },
          { key: 'dossier', label: 'Contrat', nowrap: true, value: l => l.d.id }, { key: 'client', label: 'Annonceur', value: l => l.d.client }, { key: 'theme', label: 'Thème' },
          { key: 'vendu', label: 'Vendu', align: 'num', title: 'Quantité vendue (Broadcast) : jamais modifiée' },
          { key: 'calc', label: 'Calcul Broadcast (+8 %)', align: 'num' },
          { key: 'encoller', label: 'À encoller', align: 'num', value: l => aEncoller(l), sortable: false,
            render: l => h('input', { class: 'form-control form-control-sm', type: 'number', min: '0', value: aEncoller(l), disabled: !peutAjuster(), style: { width: '90px', textAlign: 'right' }, 'aria-label': 'Quantité à encoller', onchange: ev => ajuster(l, ev.target.value) }) },
          { key: 'ecart', label: 'Écart', align: 'num', value: l => aEncoller(l) - l.calc, render: l => { const x = aEncoller(l) - l.calc; return x ? (x > 0 ? '+' : '') + M.fmt.n(x) : '—'; } },
          { key: 'par', label: 'Ajusté par', value: l => (etat().ajust[l.id] ? etat().ajust[l.id].user + ', ' + M.fmt.dt(etat().ajust[l.id].date) : '') },
          { key: 'terrain', label: 'Parc terrain', align: 'num', title: 'Plaques constatées sur le terrain (Administration › Référentiel Bus)', value: l => base().parc[l.centre + '|' + l.parc + '|' + l.format].terrain }] }) }),
      etat().envois.filter(x => x.sem === s).length ? ui.card({ title: 'Envois à Field Service · pose S' + s, flush: true, style: { marginTop: '16px' }, body: ui.table({ id: 'bus-envois', rows: etat().envois.filter(x => x.sem === s),
        columns: [{ key: 'date', label: 'Le', value: x => new Date(x.date).getTime(), render: x => M.fmt.dt(x.date) }, { key: 'user', label: 'Par' }, { key: 'lignes', label: 'Lignes', align: 'num' },
          { key: 'total', label: 'Plaques', align: 'num' }, { key: 'ajustees', label: 'Lignes ajustées', align: 'num' }] }) }) : null);
  }

  /* =====================================================================================================================
     Vue des réceptions (BUS-25) : reçu / non reçu par semaine, avec les échéances
     ===================================================================================================================== */
  function pageVue(root) {
    const cur = M.state.semaine, sems = semaines(cur - 1, cur + 6);
    const rows = sems.map(s => { const ds = base().dossiers.filter(d => d.semaines[0] === s); const n = k => ds.filter(d => statut(d) === k).length;
      return { id: 'S' + s, s, ech: M.deadlineReception(s), ds, total: ds.length, recu: n('RECU'), partiel: n('PARTIEL'), attendu: n('ATTENDU'), manquant: n('MANQUANT') }; });
    const pastille = d => { const k = statut(d); return h('span', { style: { display: 'inline-block', margin: '2px 6px 2px 0' } }, ui.sev(STATUT[k][0], d.id + ' ' + d.client)); };
    root.append(head('Vue des réceptions'),
      ui.annot('Vue condensée (BUS-25, atelier 4) : par semaine de pose, ce qui est reçu et ce qui ne l’est pas, avec l’échéance de livraison (vendredi S-2 ; réception au moins 2 semaines avant la pose, idéalement 3 : BUS-10). Chaque statut a son icône et son libellé, pas seulement une couleur.', []),
      ui.card({ flush: true, body: ui.table({ id: 'bus-vue', rows, exportName: 'bus-vue-receptions.xlsx',
        tone: r => (r.manquant ? 'critical' : r.partiel ? 'warning' : r.total && r.recu === r.total ? 'good' : null),
        columns: [
          { key: 's', label: 'Pose', render: r => h('b', null, 'S' + r.s) }, { key: 'ech', label: 'Échéance de livraison', value: r => r.ech.getTime(), render: r => M.fmt.day(r.ech) + (maintenant() > r.ech ? ' (passée)' : '') },
          { key: 'total', label: 'Dossiers', align: 'num' }, { key: 'recu', label: 'Reçus', align: 'num' }, { key: 'partiel', label: 'En partie', align: 'num' },
          { key: 'attendu', label: 'Attendus', align: 'num' }, { key: 'manquant', label: 'Non reçus (échéance passée)', align: 'num' },
          { key: 'ds', label: 'Dossiers', sortable: false, wrap: true, value: r => r.ds.map(d => d.id + ' ' + STATUT[statut(d)][1]).join(', '), render: r => h('span', null, r.ds.map(pastille)) }] }) }));
  }

  /* =====================================================================================================================
     Référentiel Bus, dans Administration › Paramétrage (09/11) : BUS-02, BUS-03, BUS-21, note §7
     ===================================================================================================================== */
  M.busReferentiel = function (root) {
    const lignes = [];
    CENTRES.forEach(c => PARCS.forEach(p => lignes.push({ id: c.id + p, c, p })));
    const cell = (r, f) => base().parc[r.c.id + '|' + r.p + '|' + f.id];
    root.append(
      h('div', { class: 'grid cols-2' },
        ui.card({ title: 'DSP et plateforme', sub: 'BUS-02 : affectation par convention ; les bus des sous-traitants ne relèvent d’aucune plateforme', flush: true, body: ui.table({ id: 'bus-dsp', rows: DSP,
          columns: [{ key: 'label', label: 'DSP' }, { key: 'plateforme', label: 'Plateforme', value: x => x.plateforme || 'Aucune (sous-traitant)' }, { key: 'centres', label: 'Centres bus', value: x => CENTRES.filter(c => c.dsp === x.id).map(c => c.label).join(', ') || '—' }] }) }),
        ui.card({ title: 'Les cinq formats Bus', sub: 'BUS-03 : identifiés par la composition du patrimoine, pas par des libellés ; table de correspondance à reprendre de Field Service', flush: true, body: ui.table({ id: 'bus-formats', rows: FORMATS,
          columns: [{ key: 'label', label: 'Format' }, { key: 'code', label: 'Sur la feuille de route Broadcast' }, { key: 'verni', label: 'Vernis', value: f => (f.verni ? 'Oui : +48 h en Dernière Minute (BUS-11)' : '—') }] }) })),
      ui.card({ title: 'Plaques par centre bus, parc et format : cadastre et terrain', sub: 'BUS-21 : réseaux et parcs (A, B, puis des quarts de parc en 2027) n’existent ni dans Circé ni dans Broadcast. Le parc est vivant : l’écart est permanent.', flush: true, style: { marginTop: '16px' },
        body: ui.table({ id: 'bus-parcs', rows: lignes, exportName: 'bus-referentiel-parcs.xlsx',
          columns: [{ key: 'centre', label: 'Centre bus', value: r => r.c.label }, { key: 'dsp', label: 'DSP', value: r => dspL(r.c.dsp) }, { key: 'parc', label: 'Parc', value: r => r.p }]
            .concat(FORMATS.map(f => ({ key: 'f' + f.id, label: f.label + ' (cadastre / terrain)', align: 'num', value: r => cell(r, f).terrain - cell(r, f).cadastre,
              render: r => { const x = cell(r, f); return h('span', { title: 'Écart ' + (x.terrain - x.cadastre) }, x.cadastre + ' / ', x.terrain < x.cadastre ? h('b', null, x.terrain) : String(x.terrain)); } }))) }) }),
      ui.annot('Prérequis côté Broadcast (note Bus §7) : rattacher le patrimoine Bus à sa plateforme ; un dossier de vente test sur le nouveau patrimoine ; la qualité du patrimoine (bus articulés, centres bus, conventions ; état de parc fiable à 70 % pendant la reprise des DSP, jusqu’au 1er novembre 2026) ; une date de montage saisissable.', []));
  };

  const PAGES = { suivi: pageSuivi, reception: pageReceptions, atraiter: pageATraiter, preparation: pagePreparation, vue: pageVue };
  M.screen({
    id: 'bus', title: 'Bus (Nanterre)', nav: 'Bus', roles: ['recep', 'coord', 'cheq', 'admin'], vueDefaut: 'reception',
    render(root, params) {
      // Anciennes adresses (09/11) : le référentiel est passé dans Administration ; Reste en place et Documentation n'ont plus de page
      if (params.tab === 'referentiel') { M.go('parametrage', { tab: 'bus' }); return; }
      PAGES[PAGES[params.tab] ? params.tab : 'reception'](root, params || {});
    },
  });
})();
