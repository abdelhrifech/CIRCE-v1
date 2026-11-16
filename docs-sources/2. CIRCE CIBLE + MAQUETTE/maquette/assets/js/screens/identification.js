/* Réceptions inconnues (19/10, ex « Orphelines à identifier ») : les affiches reçues sans dossier identifié (bouton
   « Réception inconnue »), en tableau, avec un statut par ligne. Sous le tableau, l'affiche choisie (21/10) :
   1. trouver le dossier, comme à la réception (même bandeau) : d'abord par le visuel (Circé compare la photo aux visuels de
      Broadcast, reconnaissance simulée) ; sans visuel (photo absente, IP non saisies, aucun visuel proche), par n° de dossier,
      de DA ou annonceur ; personne ne trouve : un bouton met une alerte pour la Coordination (pas de mail, 21/10 ; destinataire corrigé le 27/10) ;
   2. rattacher, avec la quantité de chaque dossier ;
   3. la palette passe alors dans le sas de Réception des affiches : la réception y corrige les informations, valide le contrôle,
      et la feuille de stock définitive s'imprime à la place de la temporaire (21/10).
   La correction d'un rattachement (mauvais thème d'un même dossier) est dans la fiche de l'affiche, onglet Préparations. */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  /** Statut d'une réception inconnue : [libellé, gravité de la pastille]. */
  const STATUT = {
    afaire: ['À identifier', 'warning'], signalee: ['Introuvable : alerte à la Coordination', 'serious'],
    acontroler: ['Rattachée, à contrôler', 'warning'], adefinitive: ['Contrôlée, feuille définitive à imprimer', 'warning'],
    rattachee: ['Rattachée, feuille définitive', 'good'],
  };
  const recDe = a => M.data.receptions.find(r => r.id === a.receptionId) || {};
  const statutDe = a => (a.statut === 'ORPHELINE' ? (a.signalePP ? 'signalee' : 'afaire')
    : recDe(a).statut === 'A_CONTROLER' ? 'acontroler' : a.feuilleImprimee === 'TEMPORAIRE' ? 'adefinitive' : 'rattachee');
  const qui = () => M.ROLES.find(r => r.id === M.state.role).label;
  /** Affiche choisie sous le tableau ; un lien (?id=…) la choisit à l'arrivée sur la page. */
  let choisi = { id: null, seq: 0 };
  /** Par affiche : la façon de chercher (visuel ou dossier) et le texte cherché ; gardés quand la page se redessine. */
  const recherche = {};

  /** Score simulé : texte saisi (annonceur, thème) + « visuel » (la vraie correspondance ressort nettement). */
  function candidats(a) {
    const sa = C.simplifier(a.annonceurSaisi), sl = C.simplifier(a.libelleSaisi);
    return M.data.themes.filter(t => {
      const d = C.dossier(t.dossierId);
      return d.site === a.site && d.semaine >= 43 && d.ipSaisies && d.statutPP !== 'ANNULE' && !t.exclu && C.reste(t) > 0;
    }).map(t => {
      const d = C.dossier(t.dossierId);
      const txt = 0.6 * C.ratio(sa, C.simplifier(d.annonceur)) + 0.4 * C.ratio(sl, C.simplifier(t.libelle));
      let hsh = 0; for (const ch of t.id + a.id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
      const vis = t.id === a.verite ? 0.93 + (hsh % 5) / 100 : 0.18 + (hsh % 40) / 100;
      return { t, d, score: Math.min(0.99, 0.45 * txt + 0.55 * vis), txt, vis };
    }).sort((x, y) => y.score - x.score).slice(0, 4);
  }
  /** Sans visuel (21/10) : recherche par n° de dossier, de DA, annonceur ou thème, sur le site de l'affiche. Les dossiers sans IP
      sont proposés (il n'y a alors pas de visuel dans Broadcast) : l'intitulé lu par la plateforme est gardé. */
  function parDossier(a, q) {
    const n = C.simplifier(q || '');
    if (n.length < 2) return [];
    const exact = c => String(c.d.id) === String(q).trim() || String(c.d.no || '') === String(q).trim();
    return M.data.themes.map(t => ({ t, d: C.dossier(t.dossierId) }))
      .filter(({ t, d }) => d && d.site === a.site && d.statutPP !== 'ANNULE' && !t.exclu)
      .filter(({ t, d }) => [d.id, d.no, d.da, d.annonceur, t.libelle].some(v => v && C.simplifier(v).includes(n)))
      .sort((x, y) => (exact(y) - exact(x)) || (C.reste(y.t) - C.reste(x.t)))
      .slice(0, 8);
  }

  function rattacher(a, choix) {
    const total = M.sum(choix, c => c.q);
    if (!choix.length || total <= 0) { ui.toast('Choisissez au moins un dossier et une quantité.', 'critical'); return; }
    if (total > a.qteRecue) { ui.toast('La répartition (' + total + ') dépasse la quantité reçue (' + a.qteRecue + ').', 'critical'); return; }
    M.tick(4);
    a.alloc = choix.map(c => ({ themeId: c.t.id, qte: c.q }));
    a.statut = 'IDENTIFIEE'; a.inconnue = true; a.rattacheeLe = new Date(M.NOW);
    a.semaines = M.uniq(choix.flatMap(c => c.d.semaines)).sort();
    a.annonceurSaisi = choix[0].d.annonceur;
    // Dossier sans IP : pas de visuel Broadcast, l'intitulé lu par la plateforme reste (« le 1er qui a parlé »)
    if (choix[0].d.ipSaisies) a.libelleSaisi = choix[0].t.libelle;
    a.historique.push({ date: new Date(M.NOW), user: qui(), action: 'Identifiée : ' + choix.map(c => c.d.id + ' « ' + c.t.libelle + ' » (' + c.q + ')').join(', ') });
    // Validation admin (option A, 02/11) : la Coordination rattache l'affiche au dossier, et ce rattachement vaut validation admin (une
    // personne confirme) ; fait par la réception, il reste proposé, à confirmer par la Coordination (rattachée sans le n° de dossier du BL)
    a.rattache = 'MAIN';
    if (M.state.role === 'coord') a.va = { etat: 'MANUELLE', user: qui(), date: new Date(M.NOW), motifs: C.vaMotifs(a) }; else delete a.va;
    M.uniq(choix.map(c => c.d.id)).map(C.dossier).forEach(d => C.majStatutVA(d));
    // La palette passe « à contrôler » : elle entre dans le sas de Réception des affiches, où la réception valide le contrôle et
    // imprime la feuille définitive
    const rec = recDe(a);
    if (rec.statut === 'A_IDENTIFIER' || !rec.statut) { rec.statut = 'A_CONTROLER'; rec.aControlerDepuis = new Date(M.NOW); }
    const before = M.data.unites.filter(u => u.statut === 'EN_ATTENTE').length;
    C.recalculer();
    const freed = before - M.data.unites.filter(u => u.statut === 'EN_ATTENTE').length;
    M.journal(a.id, 'Réception inconnue rattachée à ' + choix.length + ' dossier(s) ; palette dans le sas de Réception des affiches : contrôle et feuille définitive');
    ui.toast('Affiche ' + a.id + ' rattachée. ' + freed + ' unité(s) passent « Prêt ». La palette ' + rec.id + ' passe dans le sas de Réception des affiches : la réception valide le contrôle et imprime la feuille définitive.', 'good');
    delete recherche[a.id];
    M.refresh();
  }
  /** Ouvre le contrôle de la palette dans Réception des affiches (étape 2, sous le sas). */
  const versControle = a => M.go('reception', { tab: 'controle', id: a.receptionId });

  /** « Personne ne retrouve le dossier ? » (21/10 : « tu appuies et ça met une alerte, pas d'envoi de mail ») : l'alerte
      « Dossier introuvable » remplace celle de la création et va à la Coordination du site (27/10 : la Pré-Prod ne travaille
      pas dans Circé). S17 sépare les gestionnaires (Broadcast) de « Pré-Prod Coordination » et « Pré-Prod Nîmes » (Circé) ; à
      Wissous, l'équipe Coord. Réception de Boulogne identifie les réceptions (S24, S68). À confirmer (Q61). Elle reprend ce que la plateforme
      a lu, pour retrouver le dossier dans Broadcast. Une fois rattachée, même circuit : la palette passe à l'étape 2. */
  function signaler(a) {
    const to = a.site === 'WIS' ? 'Coordination (équipe Coord. Réception, Boulogne)' : 'Coordination ' + C.site(a.site).label;
    M.tick(1);
    a.signalePP = { date: new Date(M.NOW), to, par: qui() };
    a.historique.push({ date: new Date(M.NOW), user: qui(), action: 'Dossier introuvable : alerte pour ' + to });
    M.journal(a.id, 'Réception inconnue : dossier introuvable, alerte pour ' + to);
    ui.toast('Alerte « Dossier introuvable » mise pour ' + to + '. Une fois l’affiche rattachée, la palette passe à l’étape 2 de Réception des affiches.', 'good');
    M.refresh();
  }

  /** Lignes : les affiches des réceptions inconnues, à identifier, à contrôler ou déjà rattachées. */
  function lignes() {
    const recInc = new Set(M.data.receptions.filter(r => r.orpheline).map(r => r.id));
    return M.data.affiches.filter(a => M.inScope(a) && (a.statut === 'ORPHELINE' || a.inconnue || recInc.has(a.receptionId))).map(a => {
      const st = statutDe(a), ds = M.uniq(a.alloc.map(x => (C.theme(x.themeId) || {}).dossierId).filter(Boolean));
      return { id: a.id, a, statut: st, site: C.site(a.site).label, lu: a.annonceurSaisi + ' · ' + a.libelleSaisi, qte: a.qteRecue, date: a.date, attente: st === 'rattachee' ? null : M.NOW - a.date, dossiers: ds.join(', '), signale: a.signalePP ? a.signalePP.date : null,
        empl: a.allee + '-' + a.rayon, format: a.format, imprimeur: a.imprimeur || '—', feuille: a.feuilleImprimee === 'TEMPORAIRE' ? (a.alloc.length ? 'Temporaire : définitive à imprimer' : 'Temporaire') : 'Définitive' };
    }).sort((x, y) => x.date - y.date);
  }
  const duree = ms => { const hh = Math.floor(ms / 3600e3); return hh < 1 ? Math.max(1, Math.round(ms / 60e3)) + ' min' : hh < 48 ? hh + ' h' : Math.floor(hh / 24) + ' j ' + (hh % 24) + ' h'; };

  M.screen({
    id: 'identification', title: 'Réceptions inconnues', icon: '◎', nav: 'Réceptions inconnues', roles: ['coord', 'recep'],
    needs: ['REC-17', 'CIB-08', 'PROC-04', 'ANO-12', 'REC-09', 'REC-10', 'REC-06', 'PROC-07', 'REC-12', 'REC-02'],
    asis: ['Recherche par mot-clé dans Broadcast : 2 × 10 min par réception à Nîmes, 100 % des livraisons orphelines à Wissous (S68)', 'Identification par la Pré-Prod Nîmes ou l’équipe Coord. à Boulogne : recherche du dossier dans Broadcast par annonceur, puis association dossier – thème – n° d’affiche (S24)', 'Répartition d’un visuel sur 33 dossiers limitée dans l’onglet Détail (S31)'],
    badge: () => { const n = M.data.affiches.filter(a => a.statut === 'ORPHELINE' && M.inScope(a)).length; return { n, hot: n > 0 }; },
    render(root, params) {
      const rows = lignes();
      const F = ui.filters({ id: 'inconnues', rows, defs: [
        { key: 'statut', label: 'Statut', default: ['afaire', 'signalee', 'acontroler', 'adefinitive'], options: Object.entries(STATUT).map(([v, [l]]) => ({ value: v, label: l })), get: r => r.statut, stable: true },
      ] });
      const vis = F.apply(rows);
      if (params.id && choisi.seq !== M.navSeq) choisi = { id: params.id, seq: M.navSeq };
      const cur = (rows.find(r => r.id === choisi.id) || vis.find(r => r.statut !== 'rattachee') || vis[0] || {}).a;
      const st = cur ? statutDe(cur) : null;
      root.append(
        ui.pageHead({ crumb: 'Réception', title: 'Réceptions inconnues', screen: 'identification',
          sub: 'Les affiches reçues sans dossier identifié, rangées en zone tampon avec une feuille temporaire. Choisissez-en une : trouvez son dossier (par le visuel, sinon par n° de dossier), rattachez-la : la palette passe dans le sas de Réception des affiches, où l’on valide le contrôle et imprime la feuille définitive. (Reconnaissance simulée dans la maquette.)' }),
        ui.annot('Un seul nom (19/10) : le bouton « Réception inconnue » crée la ligne, cette page la suit jusqu’à la feuille définitive (21/10). Une réception sur un dossier sans IP n’est pas une réception inconnue : le dossier est connu, la plateforme donne l’intitulé et la Pré-Prod s’aligne (alerte « Réception sans IP »). Corriger un rattachement (mauvais thème d’un même dossier) se fait dans la fiche de l’affiche, onglet Préparations.', ['REC-17', 'PROC-04', 'REC-18']),
        F.bar,
        ui.card({ flush: true, body: ui.table({
          id: 'inconnues', rows: vis, exportName: 'receptions-inconnues', empty: 'Aucune réception inconnue avec ce statut.',
          onRowClick: r => { choisi = { id: r.id, seq: M.navSeq }; M.refresh(); },
          tone: r => (r.id === (cur || {}).id ? 'info' : r.statut === 'afaire' && r.attente > 24 * 3600e3 ? 'serious' : null),
          columns: [
            { key: 'id', label: 'N° affiche' },
            { key: 'lu', label: 'Lu sur l’affiche', title: 'Annonceur et description saisis à la réception' },
            { key: 'site', label: 'Site', hidden: M.state.site !== 'ALL' },
            { key: 'qte', label: 'Qté', align: 'num' },
            { key: 'date', label: 'Reçue le', render: r => M.fmt.dt(r.date), value: r => r.date.getTime() },
            { key: 'attente', label: 'En attente depuis', align: 'num', render: r => (r.attente === null ? '—' : r.attente > 24 * 3600e3 ? ui.sev('serious', duree(r.attente)) : duree(r.attente)), value: r => r.attente, csv: r => (r.attente === null ? '' : duree(r.attente)) },
            { key: 'statut', label: 'Statut', render: r => ui.sev(STATUT[r.statut][1], STATUT[r.statut][0] + (r.statut === 'signalee' ? ' le ' + M.fmt.dt(r.signale) : '')), value: r => STATUT[r.statut][0] },
            { key: 'dossiers', label: 'Dossier(s)', render: r => r.dossiers || '—' },
            { key: 'empl', label: 'Emplacement', title: 'Allée et rayon : zone tampon des réceptions inconnues, puis emplacement définitif au contrôle' },
            { key: 'format', label: 'Format', hidden: true }, { key: 'imprimeur', label: 'Imprimeur', hidden: true },
            { key: 'feuille', label: 'Feuille de stock', hidden: true },
          ],
          rowActions: r => ui.btn('Fiche', () => ui.afficheModal(r.a, () => M.refresh()), { small: true, ghost: true, title: 'Ouvrir la fiche de l’affiche (rattachement, thème)' }),
        }) }),
        h('div', { class: 'mt' }, !cur ? ui.card({ body: h('div', { class: 'dt-empty' }, 'Aucune réception inconnue : utilisez « Simuler » (en haut) pour en créer une.') })
          : st === 'afaire' || st === 'signalee' ? detail(cur)
          : st === 'acontroler' ? apresRattachement(cur)
          : st === 'adefinitive' ? ui.card({ title: 'Affiche ' + cur.id + ' · contrôlée : feuille définitive à imprimer', sub: 'La feuille temporaire est encore sur l’affiche ; la définitive s’imprime dans Réception des affiches', body: h('div', { class: 'row', style: { gap: '16px', alignItems: 'center' } },
            ui.poster(cur.libelleSaisi, cur.annonceurSaisi, true), recap(cur),
            ui.btn('Imprimer dans Réception des affiches', () => versControle(cur), { primary: true, icon: 'printer', title: 'Contrôle de la réception ' + cur.receptionId + ', sous le sas' })) })
          : ui.card({ title: 'Affiche ' + cur.id + ' · rattachée, contrôlée', sub: (cur.rattacheeLe ? 'rattachée le ' + M.fmt.dt(cur.rattacheeLe) + ' · ' : '') + 'réception ' + cur.receptionId + ' · feuille définitive', body: h('div', { class: 'row', style: { gap: '16px', alignItems: 'center' } },
            ui.poster(cur.libelleSaisi, cur.annonceurSaisi, true), recap(cur),
            ui.btn('Ouvrir la fiche de l’affiche', () => ui.afficheModal(cur, () => M.refresh()), { small: true, title: 'Rattacher à un autre dossier ou corriger le thème' }),
            ui.btn('Réimprimer la feuille définitive', () => ui.printFeuilles([cur], 'Affiche ' + cur.id + ' : feuille de stock définitive'), { small: true, ghost: true })) })));
    },
  });

  /** Les dossiers auxquels l'affiche est rattachée, avec leur quantité. */
  const recap = a => h('div', { style: { flex: 1 } }, a.alloc.map(x => { const t = C.theme(x.themeId), d = C.dossier(t.dossierId); return h('div', null, h('b', null, 'Dossier ' + d.id), ' · ' + d.annonceur + ' · « ' + t.libelle + ' » · ' + x.qte + ' affiche(s)'); }));

  /** Après le rattachement (21/10) : la palette est dans le sas de Réception des affiches ; la réception y corrige les informations,
      valide le contrôle et imprime la feuille définitive. Ici, on peut encore corriger le rattachement. */
  function apresRattachement(a) {
    return ui.card({ title: 'Affiche ' + a.id + ' · rattachée : à contrôler dans Réception des affiches', sub: (a.rattacheeLe ? 'rattachée le ' + M.fmt.dt(a.rattacheeLe) + ' · ' : '') + 'réception ' + a.receptionId + ' · encore en ' + a.allee + '-' + a.rayon + ', avec sa feuille temporaire', body: [
      h('div', { class: 'row', style: { gap: '16px', alignItems: 'center' } },
        ui.poster(a.libelleSaisi, a.annonceurSaisi, true), recap(a),
        ui.btn('Modifier le rattachement ou le thème', () => ui.afficheModal(a, () => M.refresh()), { small: true, ghost: true, title: 'Fiche de l’affiche, onglet Préparations : autre dossier, quantité, thème' })),
      ui.callout('info', 'Palette ' + a.receptionId + ' dans le sas de contrôle', ' La réception vérifie la quantité, l’imprimeur et l’emplacement définitif, valide le contrôle : la feuille de stock définitive s’imprime à la place de la temporaire.'),
      h('div', { class: 'row mt' }, h('span', { class: 'spacer' }),
        ui.btn('Valider et imprimer dans Réception des affiches', () => versControle(a), { primary: true, title: 'Ouvre le contrôle de la réception ' + a.receptionId + ', sous le sas' }))] });
  }

  /** L'affiche à identifier : ce qui a été lu, le bandeau « Trouver le dossier » (le visuel, sinon le n° de dossier), les dossiers
      proposés avec leur quantité, et « Rattacher ». */
  function detail(a) {
    const s = recherche[a.id] = recherche[a.id] || { voie: null, q: '' };
    const cands = candidats(a), best = cands[0];
    const visuelSur = !!best && best.score >= 0.6;
    // Sans visuel proche, la recherche par n° de dossier est proposée d'office
    if (!s.voie) s.voie = visuelSur ? 'visuel' : 'dossier';
    const choix = new Map();
    const preChoix = () => { choix.clear(); if (s.voie === 'visuel' && best && best.score >= 0.9) choix.set(best.t.id, Math.min(a.qteRecue, best.t.qteEnt || a.qteRecue)); };
    preChoix();
    const liste = h('div', { class: 'stack', style: { gap: '8px' } });
    const titreListe = h('h3', { style: { fontSize: '14px', margin: '16px 0 8px' } });
    const ligne = c => {
      const q0 = choix.has(c.t.id) ? choix.get(c.t.id) : Math.min(a.qteRecue, c.t.qteEnt || a.qteRecue);
      const qte = ui.input({ type: 'number', value: q0, min: 1, label: 'Quantité · dossier ' + c.d.id, style: { width: '80px', minWidth: '0' }, onChange: v => { if (choix.has(c.t.id)) choix.set(c.t.id, Number(v)); } });
      return h('div', { class: 'row', style: { border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', alignItems: 'center' } },
        h('input', { type: 'checkbox', checked: choix.has(c.t.id), 'aria-label': 'Choisir ce dossier', onchange: e => { e.target.checked ? choix.set(c.t.id, Number(qte.value) || q0) : choix.delete(c.t.id); } }),
        ui.poster(c.d.ipSaisies ? c.t.libelle : '(IP non saisies)', c.d.annonceur, true),
        h('div', { style: { flex: 1 } }, h('b', null, c.d.annonceur + ' · « ' + (c.d.ipSaisies ? c.t.libelle : 'IP non saisies') + ' »'),
          h('div', { class: 'small muted' }, 'Dossier ' + c.d.id + (c.d.da ? ' · DA ' + c.d.da : '') + ' · ' + C.atelier(c.d.atelier).label + ' · départ ' + c.d.semaines.map(x => 'S' + x).join('+') + ' · attendu ' + c.t.qteEnt + ', reste ' + C.reste(c.t)),
          c.d.ipSaisies ? null : h('div', { class: 'small muted' }, 'Pas de visuel dans Broadcast : l’intitulé lu par la plateforme sera gardé.')),
        c.score !== undefined ? h('div', { style: { textAlign: 'right' } }, h('div', { class: 'score', style: { fontSize: '18px' } }, M.fmt.pct(c.score)), h('div', { class: 'small muted' }, 'texte ' + M.fmt.pct(c.txt) + ' · visuel ' + M.fmt.pct(c.vis))) : null,
        ui.field('Qté', qte));
    };
    const majListe = () => {
      const items = s.voie === 'visuel' ? cands : parDossier(a, s.q);
      titreListe.textContent = s.voie === 'visuel' ? 'Visuels proposés (comparaison de la photo aux visuels de Broadcast non encore reçus)' : 'Dossiers trouvés par n° de dossier, de DA ou annonceur';
      M.mount(liste, items.length ? items.map(ligne) : h('div', { class: 'dt-empty' }, s.voie === 'visuel' ? 'Aucun visuel proche : cherchez par n° de dossier.' : s.q ? 'Aucun dossier pour « ' + s.q + ' » sur ce site.' : 'Tapez un n° de dossier, de DA, un annonceur ou un thème.'));
    };
    // Le bandeau, au format de la réception (« Trouver les dossiers du BL ») : deux façons, puis le recours à la ligne
    const voie = (id, icone, titre, aide, action) => h('div', { class: ['cz-voie', s.voie === id ? 'is-on' : ''], dataset: { voie: id } },
      h('div', { class: 'cz-voie-tete' }, ui.icon(icone), h('b', null, titre)), h('div', { class: 'cz-voie-aide' }, aide), action);
    const choisirVoie = v => { if (s.voie === v) return; s.voie = v; bandeau.querySelectorAll('.cz-voie').forEach(el => el.classList.toggle('is-on', el.dataset.voie === v)); preChoix(); majListe(); };
    const champ = ui.input({ value: s.q, placeholder: 'n° de dossier, de DA, annonceur…', label: 'Rechercher par n° de dossier', style: { width: '100%' }, onInput: v => { s.q = v; choisirVoie('dossier'); choix.clear(); majListe(); } });
    champ.addEventListener('focus', () => choisirVoie('dossier'));
    const bandeau = h('div', { class: 'cz-trouver', role: 'group', 'aria-label': 'Trouver le dossier' },
      h('div', { class: 'cz-trouver-tete' }, h('b', null, 'Trouver le dossier'), h('span', { class: 'cz-trouver-ou' }, 'd’abord par le visuel ; sans visuel, par le n° de dossier')),
      h('div', { class: 'cz-trouver-voies is-deux' },
        voie('visuel', 'photo', 'Par le visuel', best ? 'Circé compare la photo prise à la réception aux visuels de Broadcast : meilleure correspondance ' + M.fmt.pct(best.score) + (visuelSur ? '' : ', trop faible') + '.' : 'Aucun visuel de Broadcast à comparer sur ce site.',
          ui.btn('Voir les visuels proposés' + (cands.length ? ' (' + cands.length + ')' : ''), () => choisirVoie('visuel'), { small: true, icon: 'photo' })),
        voie('dossier', 'search', 'Par n° de dossier', 'Pas de visuel (photo absente, IP non saisies, aucun visuel proche) : n° de dossier, de DA ou annonceur, lu sur l’affiche ou la palette.', champ)),
      h('div', { class: 'cz-trouver-recours' }, h('span', { class: 'cz-trouver-ou' }, 'Personne ne retrouve le dossier ?'),
        a.signalePP ? ui.sev('serious', 'Alerte « Dossier introuvable » mise le ' + M.fmt.dt(a.signalePP.date) + ' pour ' + a.signalePP.to)
          : ui.btn('Signaler à la Coordination (alerte)', () => signaler(a), { icon: 'bell', title: 'Met une alerte « Dossier introuvable » pour la Coordination, avec ce que la plateforme a lu ; pas de mail' })));
    majListe();
    return ui.card({ title: 'Affiche ' + a.id + ' · à identifier', sub: 'réception ' + a.receptionId + ' · ' + M.fmt.dt(a.date) + ' · feuille temporaire', body: [
      h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '18px', marginBottom: '12px' } },
        h('div', null, h('div', { class: 'small muted', style: { marginBottom: '4px' } }, 'Photo prise à la réception'), ui.poster(a.libelleSaisi, a.annonceurSaisi)),
        h('div', { class: 'stack', style: { gap: '6px', flex: 1 } },
          ui.field('Annonceur lu', h('b', null, a.annonceurSaisi)), ui.field('Description saisie', h('b', null, a.libelleSaisi)),
          ui.field('Quantité reçue · format', h('b', null, a.qteRecue + ' · ' + a.format)),
          ui.field('Imprimeur · emplacement', h('b', null, (a.imprimeur || '—') + ' · ' + a.allee + '-' + a.rayon + (a.allee === M.PARAMS.alleeInconnues ? ' (zone tampon)' : ''))),
          visuelSur ? (best.score >= 0.9 ? ui.callout('good', 'Visuel reconnu (' + M.fmt.pct(best.score) + ')', ' Rattachement proposé directement : il reste à confirmer.') : ui.callout('warning', 'Plusieurs visuels possibles', ' Choisissez le bon dossier.'))
            : ui.callout('warning', 'Pas de visuel proche', ' Cherchez par n° de dossier (ou de DA, ou annonceur). Les IP ne sont peut-être pas saisies : si personne ne retrouve le dossier, « Signaler à la Coordination » met une alerte.'),
          a.signalePP ? ui.callout('info', 'Signalée à la Coordination le ' + M.fmt.dt(a.signalePP.date), ' Alerte « Dossier introuvable » pour ' + a.signalePP.to + ' : dossier à retrouver dans Broadcast, puis à rattacher ici ; la palette passera à l’étape 2 de Réception des affiches.') : null)),
      bandeau,
      titreListe, liste,
      ui.annot('Comme à la réception (21/10) : d’abord le visuel ; sans visuel, le n° de dossier. Un visuel peut être réparti sur plusieurs dossiers et plusieurs semaines : cochez-en plusieurs et ajustez les quantités. Après « Rattacher », la palette passe dans le sas de Réception des affiches : la réception y valide le contrôle et imprime la feuille définitive.', ['ANO-12', 'PROC-07', 'REC-10', 'REC-17']),
      h('div', { class: 'row mt' },
        ui.btn('Fiche de l’affiche', () => ui.afficheModal(a, () => M.refresh()), { small: true, ghost: true, title: 'Rattacher à n’importe quel dossier depuis la fiche, onglet Préparations' }),
        h('span', { class: 'spacer' }),
        ui.btn('Rattacher', () => rattacher(a, Array.from(choix.entries()).map(([id, q]) => { const t = C.theme(id); return { t, d: C.dossier(t.dossierId), q }; })), { primary: true })),
    ] });
  }
})();
