/* Fin de campagne (REC-20, REC-21, REC-24 ; RP32) : une décision par dossier pour les affiches restées en stock après le
   dernier départ : conserver, renvoyer puis détruire, ou détruire. Garde-fou par visuel (RP32 #4) : pas de destruction
   proposée tant que le visuel a une campagne prévue. La destruction faite se confirme par une coche. Le rebut (quantités
   abîmées) reste dans Stock par affiche. */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const user = () => M.ROLES.find(r => r.id === M.state.role).label;
  /** Décision d'un dossier : [libellé, gravité de la pastille, destruction oui / non]. */
  const DECISIONS = {
    A_DECIDER: ['À décider', 'warning', '?'],
    CONSERVER: ['À conserver', 'info', 'Non'],
    ENVOYER: ['À renvoyer, puis détruire', 'serious', 'Oui, après le renvoi'],
    DETRUIRE: ['À détruire', 'critical', 'Oui'],
    ENVOYE: ['Renvoyé', 'good', 'Oui, après le renvoi'],
    DETRUIT: ['Détruit', 'good', 'Oui'],
  };
  const ATTENTION = { BDX: 'Bordeaux', MUI: 'MUI (Ville de Paris)' };
  const decisions = () => (M.data.finCampagne = M.data.finCampagne || {});
  /** Repère d'un point d'attention ; pour BDX, la part des affiches du dossier livrées à Bordeaux. */
  const repere = (r, k) => {
    if (k !== 'BDX') return k;
    const ls = M.data.lignes.filter(l => l.dossierId === r.id), tot = M.sum(ls, l => l.qte);
    return 'BDX ' + (tot ? Math.round(100 * M.sum(ls.filter(l => l.dest === 'BOR'), l => l.qte) / tot) : 0) + ' %';
  };
  const emplacements = r => M.uniq(r.affiches.filter(a => C.stockDispo(a) > 0).map(a => a.allee + '-' + a.rayon)).join(', ');
  /** Raisons du garde-fou (campagnes prévues sur les visuels du dossier), sans doublon. */
  const raisons = r => M.uniq(r.garde.map(g => g.raison));
  /** Proposition par défaut : conservation si un visuel a encore une campagne prévue (RP32 #4) ou pour le MUI (« flag
      conservation » pour la Ville de Paris) ; un autre point d'attention se décide un par un ; sinon destruction après le délai. */
  const proposition = r => (r.garde.length ? 'Conserver : ' + raisons(r).join(', ')
    : r.attention.includes('MUI') ? 'Conserver (Ville de Paris)' : r.attention.length ? 'À vérifier : ' + r.attention.join(', ') : 'Détruire dès S' + r.echeance);

  /** Sortie de stock de toutes les affiches du dossier (destruction) ou d'une quantité (renvoi), avec un mouvement par affiche. */
  function sortir(r, type, qteMax) {
    let reste = qteMax === undefined ? Infinity : qteMax, total = 0;
    r.affiches.forEach(a => {
      const q = Math.min(Math.max(0, C.stockDispo(a)), reste);
      if (q <= 0) return;
      M.data.mouvements.push({ id: M.uid('MV'), date: new Date(M.NOW), afficheId: a.id, type, qte: -q, user: user(), auto: false, motif: 'Fin de campagne, dossier ' + r.id });
      reste -= q; total += q;
    });
    return total;
  }

  function decider(r) {
    const x = r.x || {};
    const bloque = r.garde.length > 0;
    let choix = r.x ? r.decision : (bloque || r.attention.includes('MUI') ? 'CONSERVER' : 'DETRUIRE');
    if (choix === 'ENVOYE' || choix === 'DETRUIT' || choix === 'A_DECIDER') choix = 'DETRUIRE';
    if (bloque && choix !== 'CONSERVER') choix = 'CONSERVER';
    let jusqua = x.jusqua || M.state.semaine + 9, motif = x.motif || (bloque ? 'Campagne prévue sur le visuel' : r.attention.includes('MUI') ? 'Ville de Paris (MUI)' : 'Réaffichage prévu');
    let dest = x.destinataire || 'Client ou agence', qte = x.qte || r.stock;
    const dests = M.uniq(M.data.lignes.filter(l => l.dossierId === r.id).map(l => C.dest(l.dest).label));
    const body = h('div');
    const radio = (k, label, sub, disabled) => h('label', { class: 'form-check', style: { marginBottom: '6px' } },
      h('input', { class: 'form-check-input', type: 'radio', name: 'fc-choix', checked: choix === k, disabled: !!disabled, onchange: () => { choix = k; draw(); } }),
      h('span', { class: ['form-check-label', disabled ? 'muted' : ''] }, h('b', null, label), sub ? h('span', { class: 'small muted' }, ' · ' + sub) : null));
    const draw = () => M.mount(body,
      h('div', { class: 'row', style: { marginBottom: '10px' } }, ui.tag(C.atelier(r.d.atelier).label + ' · ' + C.site(r.d.site).label), ui.tag('Dernier départ S' + r.dernier), ui.tag(M.fmt.n(r.stock) + ' affiche(s) en stock'), r.attention.map(k => ui.sev('serious', 'Attention ' + repere(r, k)))),
      bloque ? ui.callout('warning', 'Destruction non proposée : le visuel sert encore', ' ' + raisons(r).join(' ; ') + '. Règle RP32 #4 : une affiche n’est proposée à la destruction que si son visuel n’a plus de campagne prévue.') : null,
      r.attention.length ? ui.callout('warning', 'Point d’attention : ' + r.attention.map(k => ATTENTION[k]).join(', '), ' À décider dossier par dossier, sans destruction en lot. La règle exacte reste à confirmer.') : null,
      h('p', { class: 'small muted', style: { margin: '0 0 4px' } }, 'Emplacements : ' + (emplacements(r) || '—')),
      h('div', { class: 'small', style: { margin: '0 0 8px' } }, h('span', { class: 'muted' }, 'Visuels : '), r.d.themes.map(C.theme).filter(Boolean).map((t, i) => [i ? ' · ' : null, ui.btnVisuel(t), t.libelle])),
      radio('DETRUIRE', 'Détruire', bloque ? 'impossible tant que le visuel a une campagne prévue' : 'destruction : oui, dès S' + r.echeance + ' (' + r.delai + ' semaines après le dernier départ' + (C.formatDestruction(r.d) === 'autres' ? '' : ' au ' + C.formatDestruction(r.d)) + ')', bloque),
      radio('ENVOYER', 'Renvoyer, puis détruire le reste', bloque ? 'impossible tant que le visuel a une campagne prévue' : 'destruction : oui, après le renvoi', bloque),
      choix === 'ENVOYER' ? h('div', { class: 'grid cols-2', style: { margin: '0 0 8px 26px' } },
        ui.field('Destinataire', ui.select({ value: dest, options: M.uniq(['Client ou agence', 'Ville de Paris'].concat(dests.map(x2 => 'Dépôt ' + x2), ['Autre plateforme', 'Autre'])), onChange: v => { dest = v; } })),
        ui.field('Quantité à renvoyer', ui.input({ type: 'number', value: qte, min: 1, max: r.stock, onChange: v => { qte = Math.max(1, Math.min(r.stock, Number(v) || r.stock)); } }))) : null,
      radio('CONSERVER', 'Conserver', 'destruction : non, jusqu’à une semaine donnée'),
      choix === 'CONSERVER' ? h('div', { class: 'grid cols-2', style: { margin: '0 0 8px 26px' } },
        ui.field('Jusqu’à', ui.select({ value: jusqua, options: Array.from({ length: 10 }, (_, i) => M.state.semaine + 1 + i).map(s => ({ value: s, label: 'S' + s })), onChange: v => { jusqua = Number(v); } })),
        ui.field('Motif', ui.select({ value: motif, options: ['Campagne prévue sur le visuel', 'Ville de Paris (MUI)', 'Réaffichage prévu', 'Demande du client', 'Autre'], onChange: v => { motif = v; } }))) : null,
      ui.annot('Décision prise une fois pour le dossier et appliquée à toutes ses affiches en stock ; la destruction d’un visuel qui a encore une campagne prévue n’est pas proposée (RP32 #4). Le rebut (affiches abîmées) se saisit à part, en quantité, dans Stock par affiche.', ['REC-24', 'REC-20', 'REC-21']));
    draw();
    ui.modal({ title: 'Fin de campagne · dossier ' + r.id + ' · ' + r.d.annonceur, wide: true, body, actions: [
      { label: 'Annuler' },
      r.x ? { label: 'Revenir à « à décider »', onClick: () => { delete decisions()[r.id]; M.journal(r.id, 'Fin de campagne : décision annulée'); M.refresh(); } } : null,
      { label: 'Enregistrer la décision', primary: true, onClick: () => {
        if (bloque && choix !== 'CONSERVER') { ui.toast('Le visuel a encore une campagne prévue : seule la conservation est possible.', 'critical'); return true; }
        M.tick(1);
        decisions()[r.id] = Object.assign({ decision: choix, date: new Date(M.NOW), user: user() }, choix === 'ENVOYER' ? { destinataire: dest, qte } : choix === 'CONSERVER' ? { jusqua, motif } : {});
        M.journal(r.id, 'Fin de campagne : ' + DECISIONS[choix][0] + (choix === 'ENVOYER' ? ' (' + dest + ', ' + qte + ' affiches)' : choix === 'CONSERVER' ? ' jusqu’à S' + jusqua + ' (' + motif + ')' : ''));
        ui.toast('Dossier ' + r.id + ' : ' + DECISIONS[choix][0].toLowerCase() + '.', 'good');
        M.refresh();
      } },
    ].filter(Boolean) });
  }

  function renvoiFait(r) {
    const x = r.x || {};
    M.tick(3);
    const n = sortir(r, 'Renvoi avant destruction', x.qte || r.stock);
    const reste = M.sum(r.affiches, a => Math.max(0, C.stockDispo(a)));
    decisions()[r.id] = Object.assign({}, x, { decision: reste > 0 ? 'DETRUIRE' : 'ENVOYE', envoye: new Date(M.NOW), qteEnvoyee: n });
    M.journal(r.id, 'Fin de campagne : ' + n + ' affiche(s) renvoyée(s) à ' + (x.destinataire || '—') + (reste > 0 ? ' ; ' + reste + ' à détruire' : ''));
    ui.toast(n + ' affiche(s) renvoyée(s)' + (reste > 0 ? ' ; les ' + reste + ' restantes passent « À détruire ».' : '.'), 'good');
    M.refresh();
  }
  function destructionFaite(rows) {
    M.tick(3);
    let n = 0;
    rows.forEach(r => {
      const q = sortir(r, 'Destruction');
      n += q;
      decisions()[r.id] = Object.assign({}, r.x || {}, { decision: 'DETRUIT', detruit: new Date(M.NOW), qteDetruite: q, user: user() });
      M.journal(r.id, 'Fin de campagne : destruction faite et confirmée (' + q + ' affiche(s))');
    });
    ui.toast('Destruction faite : ' + n + ' affiche(s), ' + rows.length + ' dossier(s). Le stock est à zéro.', 'good');
    M.refresh();
  }
  /** Coche de confirmation de la destruction (RP32 #4) : on détruit toutes les affiches restantes du dossier. */
  function confirmerDestruction(rows) {
    let ok = false;
    ui.modal({ title: 'Confirmer la destruction', body: [
      h('p', { style: { marginTop: 0 } }, rows.length + ' dossier(s), ' + M.fmt.n(M.sum(rows, r => r.stock)) + ' affiche(s) en stock : ' + rows.map(r => r.id + ' (' + r.d.annonceur + ')').join(', ') + '.'),
      ui.checkbox('Je confirme que toutes les affiches restantes de ces dossiers ont été détruites', false, v => { ok = v; }),
      ui.annot('Coche de confirmation (RP32 #4) : la destruction sort tout le stock restant ; elle est tracée dans les mouvements et le journal.', ['REC-21', 'REC-24'])],
    actions: [{ label: 'Annuler' }, { label: 'Destruction faite', primary: true, danger: true, onClick: () => { if (!ok) { ui.toast('Cochez la confirmation de destruction.', 'critical'); return true; } destructionFaite(rows); } }] });
  }

  M.screen({
    id: 'fincampagne', title: 'Fin de campagne', icon: '🗑', nav: 'Fin de campagne', roles: ['recep', 'cheq', 'coord'],
    needs: ['REC-24', 'REC-20', 'REC-21', 'REC-05', 'QUA-01', 'ERG-03', 'ERG-05', 'ERG-06', 'ERG-08'],
    asis: ['« Suivi › Etat de destruction » liste les affiches entrées depuis plus d’un an, avec une conservation d’au moins 365 et un dernier départ de plus de 4 semaines (code : p_s_destruction.sql:27-32)', 'La destruction faite et la mise au rebut utilisent la même case « rebus » (DestructionRepository.cs:29-33 ; ReceptionListeAfficheBll.cs:271-289) ; « Vider le rebus » remet les quantités à zéro (ReceptionListeAfficheBll.cs:297-325)', 'Coche « Affiche à conserver » par affiche, à bien utiliser pour la Ville de Paris (R28 #9) ; pas de décision par dossier ni d’« à renvoyer »'],
    badge: () => { const n = C.finCampagne().filter(r => r.decision === 'A_DECIDER').length; return { n, hot: false, title: 'Fins de campagne à décider' }; },
    render(root, params) {
      const rows = C.finCampagne();
      // Le lien du menu pose la décision (?decision=A_DECIDER, CONSERVER, ENVOYER, DETRUIRE ou FAIT) : une fois par arrivée
      const preset = params.decision === 'FAIT' ? { decision: ['ENVOYE', 'DETRUIT'] } : params.decision ? { decision: [params.decision] } : null;
      const F = ui.filters({ id: 'fincampagne', rows, preset, defs: [
        ui.dossierFilter(rows, r => r.id),
        { key: 'decision', label: 'Décision', default: ['A_DECIDER'], options: Object.entries(DECISIONS).map(([v, [l]]) => ({ value: v, label: l })), get: r => r.decision },
        { key: 'attention', label: 'Point d’attention', options: Object.entries(ATTENTION).map(([v, l]) => ({ value: v, label: l })).concat([{ value: 'garde', label: 'Visuel encore utilisé' }, { value: 'aucun', label: 'Aucun' }]), get: r => (r.attention.length || r.garde.length ? r.attention.concat(r.garde.length ? ['garde'] : []) : ['aucun']) },
        { key: 'site', label: 'Site', options: M.ref.sites.filter(s => !s.cible).map(s => ({ value: s.id, label: s.label })), get: r => r.d.site },
        { key: 'annonceur', label: 'Annonceur', more: true, options: M.uniq(rows.map(r => r.d.annonceur)).sort((a, b) => a.localeCompare(b, 'fr')).map(v => ({ value: v, label: v })), get: r => r.d.annonceur },
      ] });
      const list = F.apply(rows);
      const parDec = M.groupBy(F.except(rows, 'decision'), r => r.decision);
      const n = k => (parDec[k] || []).length;
      const aff = k => M.fmt.n(M.sum(parDec[k] || [], r => r.stock));
      const voir = ks => { F.set('decision', ks); M.refresh(); };
      const sel = F.sel('decision');
      root.append(
        ui.pageHead({ crumb: 'Stocks · Fin de campagne', title: sel.length === 1 ? DECISIONS[sel[0]][0] : sel.length === 2 && sel.includes('ENVOYE') && sel.includes('DETRUIT') ? 'Sortis du stock' : 'Fin de campagne',
          sub: 'Après le dernier départ, les affiches restées en stock : on décide une fois par dossier de les conserver, de les renvoyer avant destruction, ou de les détruire. Puis on note le renvoi, ou on confirme la destruction : le stock passe à zéro.', screen: 'fincampagne' }),
        F.bar,
        h('div', { class: 'kpis', style: { marginBottom: '12px' } },
          ui.stat({ label: 'À décider', value: n('A_DECIDER'), sub: (parDec.A_DECIDER || []).filter(r => r.attention.length || r.garde.length).length + ' avec un point d’attention', onClick: () => voir(['A_DECIDER']) }),
          ui.stat({ label: 'À conserver', value: n('CONSERVER'), sub: aff('CONSERVER') + ' affiches', onClick: () => voir(['CONSERVER']) }),
          ui.stat({ label: 'À renvoyer', value: n('ENVOYER'), sub: aff('ENVOYER') + ' affiches, avant destruction', onClick: () => voir(['ENVOYER']) }),
          ui.stat({ label: 'À détruire', value: n('DETRUIRE'), sub: aff('DETRUIRE') + ' affiches', onClick: () => voir(['DETRUIRE']) })),
        ui.annot('Destruction proposée ' + M.PARAMS.finCampagne.delai['2 m²'] + ' semaines après le dernier départ au 2 m², ' + M.PARAMS.finCampagne.delai['8 m²'] + ' au 8 m² faute de place de stockage (paramétrable ; CGV 2027 à revoir), et seulement si le visuel n’a plus de campagne prévue (RP32 #4). MUI : conservation proposée (« flag conservation » pour la Ville de Paris). « À renvoyer » sert d’abord à Paris (RP32 #2). Points d’attention BDX et MUI : décision un par un, jamais en lot.', ['REC-24', 'REC-20', 'REC-21']),
        ui.card({ flush: true, body: ui.table({
          id: 'fincampagne', rows: list, rowKey: r => r.id, selectable: true, exportName: 'fin-de-campagne.csv', onRowClick: r => decider(r),
          tone: r => (r.decision === 'DETRUIRE' ? 'critical' : r.decision === 'A_DECIDER' && (r.attention.length || r.garde.length) ? 'warning' : r.decision === 'CONSERVER' ? 'info' : r.decision === 'DETRUIT' || r.decision === 'ENVOYE' ? 'good' : null),
          empty: 'Aucun dossier avec ces filtres.',
          bulkActions: (s, clear) => [
            ui.btn('Détruire la sélection', () => {
              const ok = s.filter(r => r.decision === 'A_DECIDER' && !r.attention.length && !r.garde.length), skip = s.length - ok.length;
              clear();
              if (!ok.length) { ui.toast('Rien à détruire en lot : seuls les dossiers « à décider », sans point d’attention et dont les visuels n’ont plus de campagne prévue, le peuvent.', 'critical'); return; }
              ok.forEach(r => { decisions()[r.id] = { decision: 'DETRUIRE', date: new Date(M.NOW), user: user() }; M.journal(r.id, 'Fin de campagne : à détruire'); });
              ui.toast(ok.length + ' dossier(s) « à détruire »' + (skip ? ' ; ' + skip + ' laissé(s) de côté (point d’attention, visuel encore utilisé ou déjà décidé)' : '') + '.', 'good');
              M.refresh();
            }, { small: true }),
            ui.btn('Destruction faite…', () => { const ok = s.filter(r => r.decision === 'DETRUIRE'); clear(); if (!ok.length) { ui.toast('Sélectionnez des dossiers « à détruire ».', 'critical'); return; } confirmerDestruction(ok); }, { small: true, danger: true })],
          columns: [
            { key: 'decision', label: 'Décision', render: r => ui.sev(DECISIONS[r.decision][1], DECISIONS[r.decision][0]), value: r => Object.keys(DECISIONS).indexOf(r.decision), csv: r => DECISIONS[r.decision][0] },
            { key: 'id', label: 'Dossier' },
            { key: 'annonceur', label: 'Annonceur', value: r => r.d.annonceur },
            { key: 'atelier', label: 'Atelier', value: r => ui.withSite(C.atelier(r.d.atelier).label, r.d.site) },
            { key: 'dernier', label: 'Dernier départ', value: r => 'S' + r.dernier },
            { key: 'delai', label: 'Délai avant destruction', hidden: true, value: r => r.delai + ' sem. (' + (C.formatDestruction(r.d) === 'autres' ? 'autre format' : C.formatDestruction(r.d)) + ')' },
            { key: 'stock', label: 'En stock', align: 'num', value: r => r.stock },
            { key: 'detail', label: 'Détail', wrap: true, maxWidth: 240, value: r => (r.decision === 'A_DECIDER' ? 'Proposition : ' + proposition(r)
              : r.decision === 'CONSERVER' ? 'Jusqu’à S' + r.x.jusqua + ' · ' + r.x.motif
                : r.decision === 'ENVOYER' ? (r.x.qte || r.stock) + ' affiche(s) à renvoyer à ' + r.x.destinataire
                  : r.decision === 'ENVOYE' ? 'Renvoyé le ' + M.fmt.dt(r.x.envoye) + ' à ' + r.x.destinataire
                    : r.decision === 'DETRUIT' ? 'Détruit le ' + M.fmt.dt(r.x.detruit) + ' (' + (r.x.qteDetruite || 0) + ')' : 'Dès S' + r.echeance) },
            { key: 'attention', label: 'Attention', title: 'BDX : part des affiches du dossier livrées à Bordeaux ; MUI : format MUI (Ville de Paris) ; campagne prévue : le visuel sert encore un autre dossier', render: r => (r.attention.length || r.garde.length ? h('span', null, r.attention.map(k => [ui.sev('serious', repere(r, k)), ' ']), r.garde.length ? ui.sev('info', 'campagne prévue') : null) : ''), value: r => r.attention.map(k => repere(r, k)).concat(r.garde.length ? ['campagne prévue'] : []).join(' ') },
            { key: 'destruction', label: 'Destruction', hidden: true, value: r => DECISIONS[r.decision][2] },
            { key: 'empl', label: 'Emplacements', hidden: true, value: r => emplacements(r) },
            { key: 'site', label: 'Site', hidden: true, value: r => C.site(r.d.site).label },
          ],
          rowActions: r => (r.decision === 'A_DECIDER' ? ui.btn('Décider…', () => decider(r), { small: true, primary: true })
            : r.decision === 'ENVOYER' ? ui.btn('Renvoi fait', () => renvoiFait(r), { small: true, primary: true })
              : r.decision === 'DETRUIRE' ? ui.btn('Destruction faite…', () => confirmerDestruction([r]), { small: true, primary: true })
                : r.decision === 'CONSERVER' ? ui.btn('Modifier', () => decider(r), { small: true, ghost: true }) : null),
        }) }),
        ui.callout('cible', 'À confirmer en atelier', ' Décision par dossier (demande de la cheffe de projet) ou par visuel (RP32 #4) ? La maquette décide par dossier et ne propose pas la destruction d’un visuel qui a encore une campagne prévue. BDX : s’agit-il des dossiers livrés à Bordeaux (critère de la maquette) ou d’un contrat particulier, et que faut-il en faire ? À qui renvoie-t-on, en dehors de Paris ? Qui décide en fin de campagne : la réception, la Coordination ou le commerce ?'));
    },
  });
})();
