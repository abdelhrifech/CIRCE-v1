/* Bagues et étiquettes : impression groupée, statut mis à jour automatiquement, textes modifiables (REU-05) */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const user =() => M.ROLES.find(r => r.id === M.state.role).label;

  /** Lignes imprimées sur la bague : texte modifié s'il existe, sinon données du dossier (annonceur corrigé par la
      plateforme au fixe ou à la colle, FIX-15). */
  function textes(u) {
    const ths = C.themesOf(u);
    return ths.map((t, i) => {
      const d = C.dossier(t.dossierId);
      const o = u.bagueTexte && u.bagueTexte[i];
      return { t, lettre: String.fromCharCode(65 + i), dossier: d.id, annonceur: o ? o.annonceur : (t.annonceurImprime || d.annonceur), theme: o ? o.theme : t.libelle, modifie: !!o || !!t.corrPlateforme };
    });
  }

  /** Réimprimer une bague déjà imprimée (SCR-17, T17) : un colis se perd, on le refait ; même n°, même contenu, sans
      changer le statut. Aujourd'hui, la même bague ne peut pas resservir. */
  function reimprimer(u) {
    let motif = 'Colis perdu, refait';
    ui.modal({ title: 'Réimprimer la bague ' + u.id, body: [
      ui.annot('Réimpression à l’identique : même n° d’unité, mêmes textes, statut inchangé. Elle est tracée sur l’unité et dans le journal.', ['SCR-17', 'PROC-08', 'CIB-03']),
      h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '12px', marginBottom: '10px' } }, ui.bague(u)),
      ui.field('Motif', ui.select({ value: motif, options: ['Colis perdu, refait', 'Bague abîmée ou illisible', 'Autre'], onChange: v => { motif = v; } })),
    ], actions: [{ label: 'Annuler' }, { label: 'Réimprimer', primary: true, onClick: () => {
      M.tick(1);
      u.reimpressions = (u.reimpressions || 0) + 1;
      u.modifs.push({ date: new Date(M.NOW), user: user(), action: 'Bague réimprimée (' + motif + ')' });
      M.journal(u.id, 'Bague réimprimée : ' + motif);
      ui.toast('Bague ' + u.id + ' réimprimée (' + u.reimpressions + ' fois).', 'good'); M.refresh();
    } }] });
  }

  ui.bague = function (u) {
    const dest = C.dest(u.dest), dep = C.depart(u);
    const l = u.kind === 'TRAIN' ? null : C.ligne(u.ligneId);
    return h('div', { class: 'bague' },
      h('div', { class: 'bc' }), h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'mono' }, u.id), h('span', null, 'Nb aff : ', h('b', null, u.kind === 'TRAIN' ? u.nb : l.qte + l.entretien))),
      h('div', { class: 'big' }, dest.label), h('div', null, C.afficheur(u.afficheur).label + ' · ' + C.atelier(u.atelier).label),
      h('div', null, M.fmt.day(dep) + ' · ' + dest.boucle + (u.operateur ? ' · rouleur ' + u.operateur : '')),
      h('hr', { style: { border: 0, borderTop: '1px solid #999', margin: '4px 0' } }),
      textes(u).map(x => h('div', null,
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', null, x.dossier + ' · ' + x.annonceur), h('b', null, x.lettre)),
        h('div', { style: { fontWeight: 700 } }, x.theme + (x.modifie ? ' *' : '')))));
  };

  function imprimer(us) {
    if (!us.length) { ui.toast('Aucune unité « Prêt à produire » dans la sélection.', 'critical'); return; }
    const ops = M.data.operateurs.filter(o => us.some(u => u.site === o.site));
    let op = ops[0] ? ops[0].label : '';
    ui.modal({ title: 'Imprimer ' + us.length + ' bague(s)', wide: true, body: [
      ui.annot('Le statut passe automatiquement à « En production » à l’impression : plus de clic « Au roulage » à ne pas oublier.', ['PROC-08', 'ERG-01']),
      ui.field('Rouleur', ui.select({ value: op, options: ops.map(o => ({ value: o.label, label: o.label + ' · ' + C.site(o.site).label + ' · ' + o.poste })), onChange: v => { op = v; } })),
      h('div', { class: 'row mt', style: { alignItems: 'flex-start', gap: '12px' } }, us.slice(0, 6).map(ui.bague), us.length > 6 ? h('div', { class: 'muted small' }, '… et ' + (us.length - 6) + ' autre(s)') : null),
    ], actions: [{ label: 'Annuler' }, { label: 'Imprimer', primary: true, onClick: () => {
      M.tick(3);
      let n = 0;
      us.forEach(u => { u.bague = true; u.operateur = op; if (u.statut === 'PRET') { u.statut = 'EN_PROD'; n++; } u.modifs.push({ date: new Date(M.NOW), user: user(), action: 'Bague imprimée (rouleur ' + op + ')' }); });
      M.journal(us.map(u => u.id).slice(0, 5).join(', ') + (us.length > 5 ? '…' : ''), us.length + ' bague(s) imprimée(s) ; ' + n + ' unité(s) passée(s) « En production »');
      ui.toast(us.length + ' bague(s) imprimée(s). ' + n + ' unité(s) passent « En production ».', 'good'); M.refresh();
    } }] });
  }

  function modifierTextes(u) {
    const lignes = textes(u).map(x => Object.assign({}, x));
    ui.modal({ title: 'Textes imprimés sur la bague ' + u.id, body: [
      ui.annot('Corriger le thème ou l’annonceur imprimés, en fixe comme en déroulant. La modification est historisée et la bague est réimprimée.', ['REU-05', 'REC-06', 'ANO-07']),
      lignes.map(x => h('div', { class: 'grid cols-2', style: { marginBottom: '8px' } },
        ui.field('Annonceur (' + x.lettre + ')', ui.input({ value: x.annonceur, onChange: v => { x.annonceur = v; } })),
        ui.field('Thème (' + x.lettre + ')', ui.input({ value: x.theme, onChange: v => { x.theme = v; } })))),
    ], actions: [{ label: 'Annuler' }, { label: 'Enregistrer et réimprimer', primary: true, onClick: () => {
      u.bagueTexte = lignes.map(x => ({ annonceur: x.annonceur, theme: x.theme }));
      u.modifs.push({ date: new Date(M.NOW), user: user(), action: 'Textes de bague modifiés : ' + lignes.map(x => x.annonceur + ' / ' + x.theme).join(' ; ') });
      M.journal(u.id, 'Textes de bague modifiés et bague réimprimée');
      ui.toast('Bague ' + u.id + ' réimprimée avec les nouveaux textes.', 'good'); M.refresh();
    } }] });
  }

  ui.modifierTextesBague = modifierTextes;
  ui.imprimerBagues = imprimer;
  ui.reimprimerBague = reimprimer;

  M.screen({
    id: 'bagues', title: 'Bagues et étiquettes', icon: '⌗', nav: 'Bagues', roles: ['cheq'],
    needs: ['REU-05', 'SCR-17', 'ADM-02', 'PROC-08', 'ANO-07', 'REC-06', 'ERG-01', 'ERG-03', 'CIB-03', 'ERG-05', 'ERG-06', 'ERG-08'],
    asis: ['Hors Vendôme : Imprimer bagues, choisir l’opérateur, imprimer, puis ne pas oublier « Au roulage » avant de fermer (S53)', 'Thème et annonceur modifiables en déroulant mais pas en fixe (réunion du 13/10)'],
    render(root) {
      const base = C.unitesScope({ allWeeks: true }).filter(u => { const m = u.machine ? C.machine(u.machine) : null; return !(m && m.type === 'vendome') && !['EN_ATTENTE'].includes(u.statut); });
      const opt = (vals, lab) => M.uniq(vals).map(v => ({ value: v, label: lab(v) })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
      // Filtres : N° de dossier, Départ, Atelier, Poste, Bague (à imprimer par défaut) ; Destinataire par « + Filtre ».
      // « À imprimer / Imprimées » est un filtre, plus un onglet dans la page.
      const etatBague = u => (u.bague ? 'imprimees' : u.statut === 'PRET' ? 'a_imprimer' : 'sans');
      const F = ui.filters({ id: 'bagues', rows: base, defs: [
        ui.dossierFilter(base, C.dossiersOf),
        ui.weekFilter(),
        { key: 'atelier', label: 'Atelier', options: opt(base.map(u => u.atelier), id => ui.withSite(C.atelier(id).label, C.atelier(id).site)), get: u => u.atelier },
        { key: 'poste', label: 'Poste', options: opt(base.map(u => u.machine || 'SANS'), id => (id === 'SANS' ? 'Sans machine' : C.machine(id).label)), get: u => u.machine || 'SANS' },
        { key: 'bague', label: 'Bague', default: ['a_imprimer'], options: [{ value: 'a_imprimer', label: 'À imprimer' }, { value: 'imprimees', label: 'Imprimées' }, { value: 'sans', label: 'Sans bague, déjà en production' }], get: etatBague },
        { key: 'dest', label: 'Destinataire', more: true, options: opt(base.map(u => u.dest), id => C.dest(id).label), get: u => u.dest },
      ] });
      const rows = F.apply(base);
      root.append(
        ui.pageHead({ crumb: 'Déroulant', title: 'Bagues et étiquettes', sub: 'Unités sans fichier machine (CCM V2, assemblage 8 m², tables de roulage, 2 m² fixe, pliage) : bagues imprimées en lot, textes corrigeables, statut mis à jour à l’impression. Les bagues des trains Vendôme partent avec le fichier.', screen: 'bagues' }),
        F.bar,
        ui.card({ flush: true, body: ui.table({
          id: 'bagues', rows, selectable: true, exportName: 'bagues.csv',
          bulkActions: (sel, clear) => [ui.btn('Imprimer les bagues (' + sel.length + ')', () => { imprimer(sel); clear(); }, { small: true, primary: true })],
          tone: u => u.bagueTexte ? 'warning' : null,
          columns: [
            { key: 'id', label: 'Unité', nowrap: true },
            { key: 'kind', label: 'Type', hidden: true, value: u => u.kind === 'TRAIN' ? 'Train' : u.kind === 'UM' ? 'UM (rouleau)' : 'Lot' },
            { key: 'atelier', label: 'Atelier', value: u => C.atelier(u.atelier).label + (M.state.site === 'ALL' ? ' · ' + C.site(u.site).label : '') },
            { key: 'machine', label: 'Poste', value: u => u.machine ? C.machine(u.machine).label : 'Sans machine' },
            { key: 'dest', label: 'Destinataire', value: u => C.dest(u.dest).label },
            { key: 'contenu', label: 'Textes imprimés', sortable: false, render: u => h('div', null, textes(u).map(x => h('div', { class: 'small' }, ui.btnVisuel(x.t), h('b', null, x.lettre + ' '), x.annonceur + ' · ' + x.theme, x.modifie ? [' ', ui.tag('modifié', 'hyp')] : null))), csv: u => textes(u).map(x => x.annonceur + ' / ' + x.theme).join(' | ') },
            { key: 'statut', label: 'Statut', render: u => ui.pill(u.statut), value: u => M.STATUTS[u.statut].label },
            { key: 'bague', label: 'Bague', hidden: true, value: u => u.bague ? 'Imprimée' + (u.operateur ? ' (' + u.operateur + ')' : '') + (u.reimpressions ? ', réimprimée ' + u.reimpressions + ' fois' : '') : '—' },
          ],
          // Aperçu : la réimpression d'une bague déjà imprimée part de là (SCR-17) ; deux actions de ligne au plus
          rowActions: u => [ui.btn('Aperçu', () => ui.modal({ title: 'Bague ' + u.id, body: ui.bague(u), actions: [{ label: 'Fermer' }].concat(u.bague ? [{ label: 'Réimprimer…', primary: true, onClick: () => { setTimeout(() => reimprimer(u), 0); } }] : []) }), { small: true, ghost: true }), ui.btn('Modifier', () => modifierTextes(u), { small: true, icon: 'pencil', title: 'Modifier les textes imprimés (annonceur, thème)' })],
        }) }));
    },
  });
})();
