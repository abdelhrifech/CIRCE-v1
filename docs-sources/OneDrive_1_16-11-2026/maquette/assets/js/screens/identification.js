/* Réceptions inconnues (19/10, ex « Orphelines à identifier ») : les affiches reçues sans dossier identifié (bouton
   « Réception inconnue »), en tableau, avec un statut par ligne.
   09/11 : le panneau « Affiche … · à identifier » sous le tableau (photo, ce qui a été lu, bandeau « Trouver le dossier »,
   visuels proposés, « Signaler à la Coordination », « Rattacher ») est retiré (« ça sert à rien »). Une affiche à identifier
   se rattache par sa fiche (clic sur la ligne ou « Fiche », onglet Préparations) ; la palette passe alors dans le sas de
   Réception des affiches : la réception y corrige les informations, valide le contrôle, et la feuille de stock définitive
   s'imprime à la place de la temporaire (21/10). Sous le tableau ne restent que les affiches déjà rattachées (à contrôler,
   feuille définitive à imprimer, rattachée). */
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
  /** Affiche déjà rattachée choisie sous le tableau ; un lien (?id=…) la choisit à l'arrivée sur la page. */
  let choisi = { id: null, seq: 0 };
  /** À identifier ou introuvable : plus de panneau sous le tableau (09/11), on passe par la fiche de l'affiche. */
  const aIdentifier = r => r.statut === 'afaire' || r.statut === 'signalee';
  /** Ouvre le contrôle de la palette dans Réception des affiches (étape 2, sous le sas). */
  const versControle = a => M.go('reception', { tab: 'controle', id: a.receptionId });

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
      if (params.id && choisi.seq !== M.navSeq) {
        choisi = { id: params.id, seq: M.navSeq };
        // Arrivée par une alerte ou le tableau de bord sur une affiche à identifier : sa fiche s'ouvre (plus de panneau, 09/11)
        const arrivee = rows.find(r => r.id === params.id);
        if (arrivee && aIdentifier(arrivee)) setTimeout(() => ui.afficheModal(arrivee.a, () => M.refresh()), 0);
      }
      const dejaRattachees = vis.filter(r => !aIdentifier(r));
      const cur = (rows.find(r => r.id === choisi.id && !aIdentifier(r)) || dejaRattachees.find(r => r.statut !== 'rattachee') || dejaRattachees[0] || {}).a;
      const st = cur ? statutDe(cur) : null;
      root.append(
        ui.pageHead({ crumb: 'Réception', title: 'Réceptions inconnues', screen: 'identification',
          sub: 'Les affiches reçues sans dossier identifié, rangées en zone tampon avec une feuille temporaire. Pour rattacher une affiche à identifier, ouvrez sa fiche (clic sur la ligne ou « Fiche », onglet Préparations) : la palette passe alors dans le sas de Réception des affiches, où l’on valide le contrôle et imprime la feuille définitive.' }),
        ui.annot('Un seul nom (19/10) : le bouton « Réception inconnue » crée la ligne, cette page la suit jusqu’à la feuille définitive (21/10). Une réception sur un dossier sans IP n’est pas une réception inconnue : le dossier est connu, la plateforme donne l’intitulé et la Pré-Prod s’aligne (alerte « Réception sans IP »). Corriger un rattachement (mauvais thème d’un même dossier) se fait dans la fiche de l’affiche, onglet Préparations.', ['REC-17', 'PROC-04', 'REC-18']),
        F.bar,
        ui.card({ flush: true, body: ui.table({
          id: 'inconnues', rows: vis, exportName: 'receptions-inconnues', empty: 'Aucune réception inconnue avec ce statut.',
          onRowClick: r => { if (aIdentifier(r)) { ui.afficheModal(r.a, () => M.refresh()); return; } choisi = { id: r.id, seq: M.navSeq }; M.refresh(); },
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
        h('div', { class: 'mt' }, !cur ? (rows.length ? null : ui.card({ body: h('div', { class: 'dt-empty' }, 'Aucune réception inconnue : utilisez « Simuler » (en haut) pour en créer une.') }))
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
})();
