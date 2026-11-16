/* Réception des affiches en deux temps, comme aujourd'hui (S19, S20), avec les mots de Circé ; une page par étape (19/10) :
   1. Arrivée de la palette (agent de réception), sur une seule page : on trouve les lignes du BL par la photo (du BL, ou d'une
      affiche) ou par la recherche dans les réceptions attendues (« Au panier ») ; le panier peut réunir les lignes de plusieurs
      BL : on coche celles du BL (quantités du BL), puis n° de BL, transporteur, imprimeur, nombre de colis, validation ; un BL
      = une réception. Validée, la palette passe à l'étape 2, sans étiquette (19/10) ; un complément garde le même n° d'affiche.
   2. Contrôle des affiches (agent de contrôle) : le sas des palettes arrivées, en zone tampon, à contrôler vite (attente
      affichée, alerte au-delà du délai) ; pas de douchette (19/10) : on ouvre la palette dans la liste, avec toutes ses
      affiches : quantité comptée, allée / rayon, rebut, non-conformité, contrôleur ; puis feuilles de stock en lot.
   Plus : Liste des affiches (réunie avec la réception, REC-03), avec ses tags, dont « Feuille à refaire » après un changement
   de thème (REC-06) ; purge automatique des réceptions attendues anciennes (REC-05). Menu : trois entrées (19/10). */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  // panier : lignes du BL (étape 1) ; form : en-tête de la réception ; bl : BL lu par Circé (photo) ; ctrl : saisie du contrôle
  const R = M.recep = { panier: [], form: { bl: '', transporteur: 'Geodis', imprimeur: '', nbColis: 1, dechargePar: '', controleur: '' }, bl: null, ctrl: {} };
  const byLabel = (a, b) => String(a.label).localeCompare(String(b.label), 'fr');
  const opts = (vals, lab) => M.uniq(vals.filter(v => v !== null && v !== undefined && v !== '')).map(v => ({ value: v, label: lab ? lab(v) : v })).sort(byLabel);
  const user = () => M.ROLES.find(r => r.id === M.state.role).label;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const affiche = id => (M.data.idx.affiche && M.data.idx.affiche.get(id)) || M.data.affiches.find(a => a.id === id);
  const liste = (vals, choisi) => [{ value: '', label: 'Choisir…' }].concat(M.uniq(vals.concat(choisi ? [choisi] : [])).map(x => ({ value: x, label: x })));
  const provisoire = s => /^\(IP non saisies\)$|^à décrire$|^non lisible$/i.test(String(s || '').trim());
  /** Intitulé déjà saisi par l'autre plateforme pour cet annonceur, sur une réception sans IP (REC-18, « le 1er qui a parlé »). */
  const intituleAutre = d => {
    const a = M.data.affiches.filter(x => x.site !== d.site && !provisoire(x.libelleSaisi) && norm(x.annonceurSaisi) === norm(d.annonceur) && (x.statut === 'ORPHELINE' || (C.dossierOfAffiche(x) || {}).ipSaisies === false)).sort((p, q) => p.date - q.date)[0];
    return a ? { lib: a.libelleSaisi, site: C.site(a.site).label, id: a.id } : null;
  };

  /** Réceptions attendues : tous les visuels (le filtre Statut masque par défaut les complètes), avec les affiches déjà reçues. */
  function attendues() {
    const D = M.data, parTheme = new Map();
    D.affiches.forEach(a => a.alloc.forEach(x => { if (!parTheme.has(x.themeId)) parTheme.set(x.themeId, []); parTheme.get(x.themeId).push(a); }));
    return D.themes.filter(t => {
      const d = C.dossier(t.dossierId);
      if (!d || d.statutPP === 'ANNULE' || t.exclu || d.site === 'NAN' && d.semaine > 43) return false;
      return M.state.site === 'ALL' || d.site === M.state.site;
    }).map(t => {
      const d = C.dossier(t.dossierId), recu = C.recu(t.id);
      const statut = recu === 0 ? 'Attendue' : recu < t.qteEnt ? 'Partielle' : recu > t.qteEnt * 1.1 ? 'Surplus' : 'Complète';
      // Contrôle des affiches déjà reçues (21/10) : une fois contrôlées, leur feuille de stock se réimprime d'ici
      const affs = parTheme.get(t.id) || [], controlees = affs.filter(a => !a.enAttenteControle && a.statut !== 'ORPHELINE');
      const controle = !affs.length ? '' : affs.some(a => a.enAttenteControle) ? 'À contrôler' : 'Contrôlée';
      return { id: t.id, t, d, dossier: d.id, da: d.da, annonceur: d.annonceur, theme: t.libelle, format: d.format, semaines: d.semaines.map(s => 'S' + s).join('+'), attendu: t.qteEnt, recu, reste: C.reste(t), statut, controle, controlees, site: C.site(d.site).label, livraison: t.livraisonPrevue || null, print: d.print, affs };
    });
  }
  /** Filtres des réceptions attendues, dans le tableau même (19/10) : Statut, Départ et Format, chacun en liste à cocher ;
      Annonceur par « + Filtre ». Le N° de dossier (ou de DA, ou annonceur, lu sur le BL) est l'une des trois façons de
      trouver le dossier : il est dans le bandeau, à côté des deux photos (« dehors »). */
  function filtresAttendues(rows) {
    return ui.filters({ id: 'reception-attendues', rows, defs: [
      Object.assign(ui.dossierFilter(rows, r => r.d.id), { placeholder: 'n° de dossier, de DA, annonceur…', dehors: true }),
      { key: 'statut', label: 'Statut', default: ['Attendue', 'Partielle'], options: ['Attendue', 'Partielle', 'Complète', 'Surplus'].map(s => ({ value: s, label: s })), get: r => r.statut },
      ui.weekFilter(M.ref.semaines.map(s => s.num).filter(n => n >= M.state.semaine), r => r.d.semaine),
      { key: 'format', label: 'Format', options: opts(rows.map(r => r.format)), get: r => r.format },
      { key: 'controle', label: 'Contrôle', more: true, options: [{ value: 'À contrôler', label: 'À contrôler' }, { value: 'Contrôlée', label: 'Contrôlée (feuille réimprimable)' }, { value: 'Rien reçu', label: 'Rien reçu' }], get: r => r.controle || 'Rien reçu' },
      { key: 'annonceur', label: 'Annonceur', more: true, options: opts(rows.map(r => r.annonceur)), get: r => r.annonceur },
    ] });
  }
  /** Affiche déjà reçue pour un visuel (livraison en deux fois, REC-22) : la plus récente de la même plateforme. */
  const afficheDuTheme = t => M.data.affiches.filter(a => a.statut !== 'ORPHELINE' && a.site === C.dossier(t.dossierId).site && a.alloc.some(x => x.themeId === t.id)).sort((a, b) => b.date - a.date)[0] || null;
  /** Met une ligne au panier, cochée pour le BL en cours ; un visuel déjà reçu en partie est proposé en complément de son affiche (même n°).
      voie : comment le dossier a été trouvé, pour la validation admin (27/10) : « BL » (n° de dossier lu sur le BL, par la photo
      ou la recherche), « VISUEL » (visuel reconnu, ou ligne du BL sans contrat lisible : à vérifier par la Coordination). */
  function auPanier(t, qte, voie) {
    if (R.panier.some(p => p.themeId === t.id)) return false;
    const deja = C.recu(t.id) > 0 ? afficheDuTheme(t) : null;
    R.panier.push({ themeId: t.id, qte: qte || C.reste(t) || t.qteEnt, complement: deja ? deja.id : null, sel: true, voie: voie || 'BL' });
    return true;
  }
  /** Validation admin d'une affiche, dans sa fiche (option A, 02/11) : le rattachement proposé par Circé à la réception, et le bouton
      gardé de Circé pour le confirmer (ou son annulation). Seule la Coordination confirme : l'agent de réception ne valide pas. */
  function ficheValidation(a, redraw) {
    const e = C.vaEtat(a), ms = e === 'A_FAIRE' ? C.vaMotifs(a) : [];
    const ds = C.dossiersOfAffiche(a).map(C.dossier).filter(Boolean);
    const propose = ds.length ? 'Rattachement proposé au dossier ' + ds.map(d => d.id).join(', ') + ' · ' + a.alloc.map(x => '« ' + C.theme(x.themeId).libelle + ' »').join(', ') : '';
    const lib = {
      MANUELLE: 'Validée par ' + (a.va ? a.va.user + ', le ' + M.fmt.dt(a.va.date) : 'la Coordination'),
      PROPOSEE: 'À confirmer par la Coordination',
      A_FAIRE: 'À confirmer par la Coordination : doute',
      ORPHELINE: 'Réception inconnue : à rattacher d’abord (Réceptions inconnues)',
    }[e];
    // Le rattachement proposé et le motif du doute sont un texte qui se replie (la pastille reste courte)
    const texte = e === 'PROPOSEE' || e === 'A_FAIRE' ? propose + (ms.length ? ' · doute : ' + ms.map(m => M.VA_MOTIFS[m]).join(' ; ') : '') + '.' : '';
    const sev = { MANUELLE: 'good', PROPOSEE: 'info', A_FAIRE: 'warning', ORPHELINE: 'serious' }[e];
    const peut = M.state.role === 'coord' || M.state.role === 'admin';
    return ui.field('Validation admin', h('div', { class: 'stack', style: { gap: '4px', alignItems: 'flex-start' } }, ui.sev(sev, lib), texte ? h('div', { class: 'small', style: { whiteSpace: 'normal' } }, texte) : null,
      e === 'A_FAIRE' || e === 'PROPOSEE' ? (peut ? ui.btn('Valider', () => { C.validerAffiches([a], user()); M.journal(a.id, 'Validation admin confirmée', user()); M.refresh(); redraw(); }, { small: true, primary: e === 'PROPOSEE', title: e === 'PROPOSEE' ? 'Confirmer le rattachement proposé par Circé' : 'Confirmer après vérification du motif' })
        : h('span', { class: 'small muted' }, 'Aucune validation sans la Coordination : à confirmer dans Pré-production › Validation admin et Instruction OK, sans attendre la préparation.'))
        : e === 'MANUELLE' && peut ? ui.btn('Annuler la validation', () => { C.annulerValidation(a, user()); M.journal(a.id, 'Validation admin annulée', user()); M.refresh(); redraw(); }, { small: true, ghost: true, title: 'L’affiche repasse « à confirmer »' }) : null));
  }
  /** Ligne cochée dans le panier : le bon de livraison ne vaut que pour celles-là (19/10). */
  const coche = p => p.sel !== false;

  /* ---------- Feuille de stock, impression, fiche affiche ---------- */
  /** Feuille temporaire tant que l'affiche n'a pas de dossier (réception inconnue), définitive dès qu'elle en a un (21/10). */
  const typeFeuille = a => (a.alloc.length ? 'DEFINITIVE' : 'TEMPORAIRE');
  ui.typeFeuille = typeFeuille;
  /** Feuille de stock sur le modèle de Circé (Reports/EtiquetteRackAffiche.rdlc, branche develop) : page A4, mêmes champs aux
      mêmes places (positions en cm, tailles en points, Times New Roman). Ajouts (21/10) : la mention « temporaire » ou
      « définitive », dans le bandeau du haut, vide dans Circé ; le fond jaune d'un dossier multi-semaines (REC-13). */
  ui.feuilleStock = function (a) {
    const def = typeFeuille(a) === 'DEFINITIVE';
    const lignes = a.alloc.map(x => { const t = C.theme(x.themeId), d = C.dossier(t.dossierId); return { d, t, q: x.qte }; });
    const sems = (a.semaines || []).slice().sort((x, y) => x - y), multi = sems.length > 1;
    const dossiers = M.uniq(lignes.map(l => l.d.id));
    const t0 = lignes[0] ? lignes[0].t : null, d0 = lignes[0] ? lignes[0].d : null;
    // Une zone de texte du modèle : place (cm) relative à sa section, taille (pt), gras par défaut
    const zone = (top, left, w, hh, pt, txt, st) => h('div', { class: 'fsa-z', style: Object.assign({ top: top + 'cm', left: left + 'cm', width: w + 'cm', height: hh + 'cm', fontSize: pt + 'pt' }, st || {}) }, txt);
    const lib = (top, left, w, txt) => zone(top, left, w, 0.75, 12, txt);
    const H = 0.2, L = 0.2, B = 0.2 + 11.44063, F = 29.7 - 0.15 - 1.08599; // en-tête, corps, pied de page (marges du modèle)
    const sect = (top, kids) => h('div', { class: 'fsa-sect', style: { top: top + 'cm', left: L + 'cm' } }, kids);
    const code = 'A-' + String(a.id).padStart(13, '0');
    const COLS = [2.15276, 2.5, 3.30688, 3.41401, 2.36771, 2.10313, 2.5];
    const cel = (txt, k, th, st) => h(th ? 'th' : 'td', { style: Object.assign({ width: COLS[k] + 'cm' }, st || {}) }, txt);
    const page = h('div', { class: ['fsa-page', def ? 'is-def' : 'is-temp', multi ? 'is-multi' : ''] },
      // En-tête (PageHeader) : mention, ligne, n° d'affiche et format en très gros, cadre réception + code-barres
      sect(H, [
        h('div', { class: 'fsa-mention', style: { top: '0.25cm', left: '0.3cm', width: '19.3cm', height: '4.3cm' } },
          h('div', { class: 'fsa-mention-t' }, def ? 'FEUILLE DE STOCK DÉFINITIVE' : 'FEUILLE DE STOCK TEMPORAIRE'),
          h('div', { class: 'fsa-mention-s' }, def
            ? 'Dossier identifié' + (dossiers.length ? ' : ' + dossiers.join(', ') : '') + (multi ? ' · dossier multi-semaines (feuille jaune)' : '')
            : 'Réception inconnue · rangée en zone tampon · à remplacer par la feuille définitive dès que la Coordination a rattaché l’affiche à son dossier')),
        h('div', { class: 'fsa-ligne', style: { top: '4.86516cm', left: '0', width: '19.9064cm' } }),
        zone(5.2663, 0.82667, 9.89117, 2.83561, 72, a.id),
        zone(8.2783, 0.82667, 9.89117, 2.85323, 36, a.format),
        h('div', { class: 'fsa-cadre', style: { top: '5.2663cm', left: '10.89423cm', width: '8.72113cm', height: '5.86523cm' } },
          lib(0.28251, 0.44979, 3.29375, 'Date Réception :'), zone(0.28251, 4.15739, 4.2, 0.6, 14, M.fmt.dy(a.date)),
          lib(1.27001, 0.44979, 3.29375, 'Adressage :'), zone(1.27001, 4.15739, 4.2, 0.6, 14, a.allee + ' - ' + a.rayon),
          lib(2.23561, 0.44979, 3.29375, 'Quantité :'), zone(1.97584, 4.15739, 4.2, 0.9, 20, String(a.qteRecue)),
          zone(3.012, 0.44979, 6.86906, 0.83811, 16, code),
          h('div', { class: 'fsa-barres', style: { top: '4.1cm', left: '0.6cm', width: '7.5cm', height: '1.5cm' }, 'aria-hidden': 'true' }))]),
      // Corps (Body) : dossier, semaines, annonceur, thème, repiquage, commentaire, à conserver, premier départ, tableau
      sect(B, [
        lib(0.38806, 0.42016, 2.5, 'Dossier :'), zone(0.07056, 3.75048, 14.91239, 0.9175, 22, dossiers.length ? dossiers.join(', ') : '—'),
        lib(1.25906, 0.42016, 2.5, 'Semaines :'), zone(0.98906, 3.75048, 14.91239, 0.9175, 22, sems.length ? sems.map(s => 'S' + s).join(' / ') : '—'),
        lib(2.56667, 0.31838, 2.94979, 'Annonceur :'), zone(2.02917, 3.75048, 14.91239, 1.1625, 30, d0 ? d0.annonceur : a.annonceurSaisi),
        lib(3.84203, 0.31838, 2.94979, 'Thème :'), zone(3.33278, 3.75048, 14.91239, 1.47847, 28, t0 ? t0.libelle : a.libelleSaisi),
        lib(4.99444, 0.42016, 2.94979, 'Repiquage :'), zone(4.87181, 3.75048, 14.91239, 0.74798, 16, t0 && t0.repiquage ? t0.repiquage : ''),
        lib(5.89389, 0.42016, 2.98979, 'Commentaire:'), zone(5.79389, 3.75048, 14.91239, 0.83785, 16, a.commentaire || (def ? '' : 'Réception inconnue ' + a.receptionId + ' : à identifier par la Coordination')),
        lib(6.89974, 0.42016, 4.14042, 'Affiche à conserver :'), zone(6.8, 4.70169, 11.59824, 0.83785, 16, a.aConserver ? 'Oui' : 'Non'),
        zone(7.34277, 6.57795, 3.59409, 1.76362, 48, sems.length ? 'S' + sems[0] : '', { textAlign: 'center' }),
        h('table', { class: 'fsa-table', style: { top: '9.28278cm', left: '0.42016cm' } },
          h('thead', null, h('tr', null, ['Dossier', 'Thème', 'Annonceur', 'Format', 'Départ', 'Qté prépa.', 'numéro de demande'].map((x, k) => cel(x, k, true)))),
          h('tbody', null, lignes.length ? lignes.map(l => h('tr', null, cel(l.d.id, 0), cel(l.t.libelle, 1), cel(l.d.annonceur, 2), cel(l.d.format, 3),
            cel(l.d.semaines.map(s => 'S' + s + ' /' + M.NOW.getFullYear()).join(' '), 4, false, { fontSize: '18pt' }), cel(String(l.t.qteEnt), 5), cel(l.d.da || '', 6)))
            : h('tr', null, h('td', { colspan: 7, style: { textAlign: 'center', fontStyle: 'italic' } }, 'Aucun dossier rattaché : réception inconnue, à identifier'))))]),
      sect(F, [zone(0.17639, 15.89828, 3.71708, 0.6, 10, 'Page 1/1', { fontWeight: 400 })]));
    return h('div', { class: 'fsa-wrap', title: (def ? 'Feuille définitive' : 'Feuille temporaire') + ' · affiche ' + a.id }, page);
  };
  /** Aperçu et impression des feuilles de stock, en n exemplaires (2 en S20 : palette et Pré-Prod, sans doute la Coordination de la plateforme, Q61 ; paramétrable) ; au contrôle,
      avec les étiquettes rack. Imprimer note le type de la feuille posée (temporaire ou définitive) et lève « Feuille à refaire ». */
  ui.printFeuilles = function (affiches, titre, o) {
    const rack = o && o.rack, n = M.PARAMS.exemplairesFeuille || 2, ex = n + ' exemplaire' + (n > 1 ? 's' : '');
    const nT = affiches.filter(a => typeFeuille(a) === 'TEMPORAIRE').length, nD = affiches.length - nT;
    const quoi = (nD ? nD + ' définitive' + (nD > 1 ? 's' : '') : '') + (nD && nT ? ', ' : '') + (nT ? nT + ' temporaire' + (nT > 1 ? 's' : '') : '');
    ui.modal({ title: titre || 'Aperçu avant impression : ' + affiches.length + ' feuille(s) de stock', wide: true,
      body: [ui.annot('Le modèle de Circé (EtiquetteRackAffiche), avec la mention « temporaire » (réception inconnue, pas encore de dossier) ou « définitive » (dossier identifié) dans le bandeau du haut. Impression groupée en un clic, ' + ex + ' par affiche (S20 : palette et Coordination ; nombre paramétrable)' + (rack ? ', avec les étiquettes rack' : '') + '. Aujourd’hui : 3 clics par affiche (S63 #2).', ['REC-02', 'REC-11', 'REC-13', 'REC-27', 'REC-17', 'ERG-01']),
        h('div', { class: 'small muted', style: { marginBottom: '8px' } }, affiches.length + ' feuille(s) : ' + quoi + '.'),
        h('div', { class: 'fsa-liste' }, affiches.map(ui.feuilleStock))],
      actions: [{ label: 'Annuler' }, { label: rack ? 'Imprimer (' + ex + ') et les étiquettes rack' : 'Imprimer (' + ex + ')', primary: true, onClick: () => {
        affiches.forEach(a => {
          const type = typeFeuille(a);
          a.feuilleImprimee = type; a.feuilleImprimeeLe = new Date(M.NOW);
          // Une feuille définitive imprimée avec l'intitulé du dossier règle aussi un changement de thème en attente (REC-06)
          const m = a.themeModif;
          if (type === 'DEFINITIVE' && m && !m.reimprime) { m.reimprime = true; a.libelleSaisi = m.nouveau; }
          if (a.historique) a.historique.push({ date: new Date(M.NOW), user: user(), action: 'Feuille de stock ' + (type === 'DEFINITIVE' ? 'définitive' : 'temporaire') + ' imprimée (' + ex + ')' });
        });
        M.journal(affiches.map(a => a.id).join(', '), 'Feuilles de stock imprimées : ' + quoi + ' (' + ex + ')' + (rack ? ', étiquettes rack' : ''));
        ui.toast(affiches.length * n + ' feuille(s) (' + quoi + ')' + (rack ? ' et ' + affiches.length + ' étiquette(s) rack' : '') + ' envoyées à l’imprimante (simulation).', 'good');
        if (o && o.onPrint) o.onPrint();
        M.refresh();
      } }] });
  };

  /** Fiche affiche : onglets Détail, Mouvements, Préparations, Historique (écran « Modifier une affiche » existant). */
  ui.afficheModal = function (a, onSave) {
    let tab = 'detail';
    let closeSelf = null; // passer d'une fiche à l'autre ferme la première (jamais deux fenêtres empilées)
    const body = h('div');
    /* Onglet Préparations (19/10) : « Rattacher à un autre dossier » vaut pour toute affiche, identifiée ou non (un visuel
       sert souvent plusieurs dossiers, S31) ; « Changer de thème » corrige une ligne parmi les thèmes du même dossier
       (« Corriger un rattachement » : Synthèse ligne 88, cas 2 ; S23), sans repasser par une réception inconnue. Chaque
       changement pose « Feuille à refaire ». Sans aucune ligne, l'affiche retourne dans les réceptions inconnues. */
    let cherche = null; // texte de la recherche « Rattacher à un autre dossier » ; null : recherche fermée
    const noter = (action, ancien) => {
      a.historique.push({ date: new Date(M.NOW), user: user(), action }); M.journal(a.id, action, user());
      a.themeModif = { ancien: a.themeModif && !a.themeModif.reimprime ? a.themeModif.ancien : (ancien || a.libelleSaisi), nouveau: a.libelleSaisi, date: new Date(M.NOW), par: user(), origine: action, reimprime: false };
      C.recalculer(); M.refresh();
    };
    const candidatsRattachement = q => {
      const n = norm(q), deja = new Set(a.alloc.map(x => x.themeId));
      const ann = norm(a.alloc[0] ? C.dossier(C.theme(a.alloc[0].themeId).dossierId).annonceur : a.annonceurSaisi);
      return M.data.themes.map(t => ({ t, d: C.dossier(t.dossierId) }))
        .filter(({ t, d }) => d && d.site === a.site && d.ipSaisies && d.statutPP !== 'ANNULE' && !t.exclu && !deja.has(t.id))
        .filter(({ t, d }) => (n ? [d.id, d.da, d.annonceur, t.libelle].some(v => norm(v).includes(n)) : norm(d.annonceur) === ann))
        .sort((x, y) => C.reste(y.t) - C.reste(x.t)).slice(0, 6);
    };
    const ajouter = (t, qte) => {
      const q = Math.max(0, Number(qte) || 0), d = C.dossier(t.dossierId);
      if (!q) { ui.toast('Indiquez la quantité pour ce dossier.', 'critical'); return; }
      M.tick(2);
      // Réception inconnue rattachée (21/10) : la palette passe « à contrôler » ; au contrôle, l'affiche quitte la zone tampon et la feuille définitive s'imprime
      if (a.statut === 'ORPHELINE') {
        a.statut = 'IDENTIFIEE'; a.inconnue = true; a.rattacheeLe = new Date(M.NOW); a.annonceurSaisi = d.annonceur; if (d.ipSaisies) a.libelleSaisi = t.libelle;
        const rec = M.data.receptions.find(r => r.id === a.receptionId);
        if (rec && rec.statut === 'A_IDENTIFIER') { rec.statut = 'A_CONTROLER'; rec.aControlerDepuis = new Date(M.NOW); }
      }
      a.alloc.push({ themeId: t.id, qte: q });
      a.semaines = M.uniq((a.semaines || []).concat(d.semaines)).sort();
      // Rattachement à la main (option A, 02/11) : fait par la Coordination, il vaut validation admin (une personne confirme) ; fait par
      // la réception, il reste proposé : la Coordination le confirme (motif « rattachée sans le n° du BL »)
      const parCoord = M.state.role === 'coord';
      if (parCoord) a.va = { etat: 'MANUELLE', user: user(), date: new Date(M.NOW), motifs: C.vaMotifs(a) }; else { a.rattache = 'MAIN'; delete a.va; }
      C.dossiersOfAffiche(a).map(C.dossier).filter(Boolean).forEach(x => C.majStatutVA(x));
      cherche = null;
      noter('Rattachée au dossier ' + d.id + ' « ' + t.libelle + ' » (' + q + ')' + (parCoord ? ' ; validation admin faite' : ' ; validation admin à confirmer par la Coordination'));
      ui.toast('Affiche ' + a.id + ' rattachée au dossier ' + d.id + ' : feuille de stock à refaire (tag « Feuille à refaire »)' + (parCoord ? ' ; validation admin faite.' : ' ; la Coordination confirmera la validation admin.'), 'good');
      draw();
    };
    const panneauRattacher = () => {
      const res = h('div', { class: 'stack', style: { gap: '6px', marginTop: '8px' } });
      const majRes = () => {
        const cs = candidatsRattachement(cherche);
        M.mount(res, cs.length ? cs.map(({ t, d }) => {
          const qte = ui.input({ type: 'number', value: Math.min(a.qteRecue, Math.max(1, C.reste(t))), min: 1, label: 'Quantité · dossier ' + d.id, style: { width: '80px', minWidth: '0' } });
          return h('div', { class: 'row', style: { border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', alignItems: 'center' } },
            h('div', { style: { flex: 1 } }, h('b', null, 'Dossier ' + d.id + ' · ' + d.annonceur + ' · « ' + t.libelle + ' »'), h('div', { class: 'small muted' }, C.atelier(d.atelier).label + ' · départ ' + d.semaines.map(s => 'S' + s).join('+') + ' · attendu ' + t.qteEnt + ', reste ' + C.reste(t))),
            ui.field('Qté', qte), ui.btn('Rattacher', () => ajouter(t, qte.value), { small: true, primary: true }));
        }) : h('div', { class: 'small muted' }, cherche ? 'Aucun dossier pour « ' + cherche + ' » sur ce site (IP saisies).' : 'Tapez un n° de dossier, de DA, un annonceur ou un thème.'));
      };
      majRes();
      return h('div', { class: 'cz-rattacher mt' },
        h('div', { class: 'row' }, h('b', null, 'Rattacher à un autre dossier'), h('span', { class: 'small muted' }, cherche ? '' : 'propositions : même annonceur'), h('span', { class: 'spacer' }), ui.btn('Fermer', () => { cherche = null; draw(); }, { small: true, ghost: true })),
        ui.input({ value: cherche, placeholder: 'n° de dossier, de DA, annonceur ou thème', label: 'Rechercher un dossier', style: { width: '100%' }, onInput: v => { cherche = v; majRes(); } }),
        res);
    };
    const draw = () => {
      const D = M.data;
      const recs = M.uniq((a.receptions || [a.receptionId]).concat([a.receptionId])).map(id => D.receptions.find(r => r.id === id)).filter(Boolean);
      M.mount(body,
        ui.tabs([{ id: 'detail', label: 'Détail' }, { id: 'mvt', label: 'Mouvements' }, { id: 'prep', label: 'Préparations', count: a.alloc.length }, { id: 'hist', label: 'Historique' }], tab, id => { tab = id; draw(); }),
        tab === 'detail' ? h('div', { class: 'grid cols-2' },
          h('div', { class: 'stack', style: { gap: '8px' } },
            ui.field(recs.length > 1 ? 'Réceptions (livraison en ' + recs.length + ' fois)' : 'Réception', h('div', null, recs.map(rec => h('div', null, h('button', { class: 'linkish', style: { textAlign: 'left' }, onclick: () => { if (closeSelf) closeSelf(); ui.receptionModal(rec); } }, rec.id + ' du ' + M.fmt.dt(rec.date) + ' (ouvrir)'))))),
            ui.field('Annonceur saisi', ui.input({ value: a.annonceurSaisi, onChange: v => { a.annonceurSaisi = v; } })),
            ui.field('Thème saisi', ui.input({ value: a.libelleSaisi, onChange: v => { a.libelleSaisi = v; } })),
            ui.field('Imprimeur', ui.select({ value: a.imprimeur, options: M.ref.imprimeurs, onChange: v => { a.imprimeur = v; } }))),
          h('div', { class: 'stack', style: { gap: '8px' } },
            a.enAttenteControle ? ui.callout('warning', 'Palette à contrôler', ' Quantité du BL, en zone tampon : le comptage et l’emplacement se saisissent au contrôle.', ui.btn('Contrôler la palette', () => { if (closeSelf) closeSelf(); M.go('reception', { tab: 'controle', id: a.receptionId }); }, { small: true })) : null,
            h('div', { class: 'row' }, ui.field('Allée', ui.input({ value: a.allee, onChange: v => { a.allee = v; } })), ui.field('Rayon', ui.input({ value: a.rayon, onChange: v => { a.rayon = v; } }))),
            ui.field('Quantité reçue', h('b', null, a.qteRecue)), ui.field('Stock disponible', h('b', null, C.stockDispo(a))),
            ui.field('Feuille de stock', h('b', null, !a.feuilleImprimee ? (typeFeuille(a) === 'DEFINITIVE' ? 'définitive' : 'temporaire') : a.feuilleImprimee === 'TEMPORAIRE' && typeFeuille(a) === 'DEFINITIVE' ? 'temporaire posée : imprimer la définitive' : a.feuilleImprimee === 'TEMPORAIRE' ? 'temporaire (réception inconnue)' : 'définitive')),
            a.surplusEntretien ? ui.field('Entretien reçu en plus', h('b', null, '+' + a.surplusEntretien)) : null,
            ui.checkbox('Affiche à conserver (reliquat d’entretien)', a.aConserver, v => { a.aConserver = v; }),
            ficheValidation(a, draw),
            ui.annot('Validation admin gardée, sous son nom de Circé et avec son bouton, mais jamais sans une personne (option A, 02/11) : à la réception Circé propose le rattachement de l’affiche au dossier, sans attendre la préparation ni l’Instruction OK ; la Coordination le confirme, en lot ou un par un. L’affiche est « reçue » dès l’arrivée de la palette, indépendamment de la validation (PP-02).', ['PP-01', 'PP-02', 'PP-10', 'ANO-05']))) : null,
        tab === 'mvt' ? h('div', { class: 'table-wrap' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Date', 'Mouvement', 'Quantité', 'Par', 'Auto'].map(x => h('th', null, x)))), h('tbody', null, C.mouvementsAffiche(a.id).map(m => h('tr', null, h('td', null, M.fmt.dt(m.date)), h('td', null, m.type + (m.motif ? ' (' + m.motif + ')' : '')), h('td', { class: 'num' }, M.fmt.signed(m.qte)), h('td', null, m.user || '—'), h('td', null, m.auto ? 'Oui' : '')))))) : null,
        tab === 'prep' ? h('div', null,
          ui.annot('Une affiche peut servir plusieurs dossiers et plusieurs semaines, sans limite de nombre (ANO-12) : « Rattacher à un autre dossier » vaut pour toute affiche, identifiée ou non. Le rattachement est possible dès que les IP sont connues (REC-09). Mauvais thème d’un même dossier : « Changer de thème » le corrige sans réception inconnue (Synthèse, ligne 88 ; S23). La feuille de stock est alors à refaire.', ['ANO-12', 'REC-09', 'PROC-07', 'ANO-08', 'REC-06']),
          a.alloc.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Dossier', 'Annonceur', 'Thème', 'Départ', 'Quantité', ''].map(x => h('th', null, x)))),
            h('tbody', null, a.alloc.map((x, i) => {
              const t = C.theme(x.themeId), d = C.dossier(t.dossierId), autres = d.themes.filter(id => id !== t.id).map(C.theme);
              const changer = autres.length ? ui.select({ value: '', label: 'Changer de thème · dossier ' + d.id, options: [{ value: '', label: 'Changer de thème…' }].concat(autres.map(o => ({ value: o.id, label: o.libelle }))), onChange: v => {
                if (!v) return;
                const ancien = t.libelle, nt = C.theme(v);
                x.themeId = v; if (i === 0) a.libelleSaisi = nt.libelle;
                // Thème changé (27/10, Q55) : la validation admin est à refaire, sauf si la Coordination fait elle-même la correction
                if (M.state.role === 'coord') a.va = { etat: 'MANUELLE', user: user(), date: new Date(M.NOW), motifs: C.vaMotifs(a) }; else { a.rattache = 'MAIN'; delete a.va; }
                C.majStatutVA(d);
                noter('Thème corrigé (dossier ' + d.id + ') : « ' + ancien + ' » → « ' + nt.libelle + ' »', ancien);
                ui.toast('Thème corrigé : feuille de stock à refaire.', 'good'); draw();
              } }) : null;
              return h('tr', null, h('td', null, d.id), h('td', null, d.annonceur), h('td', null, t.libelle), h('td', null, d.semaines.map(s => 'S' + s).join('+')), h('td', { class: 'num' }, x.qte),
                h('td', { class: 'nowrap' }, changer, ' ', ui.btn('Retirer', () => {
                  a.alloc.splice(i, 1);
                  C.majStatutVA(d);
                  if (!a.alloc.length) {
                    a.statut = 'ORPHELINE';
                    // Plus aucun dossier : la réception inconnue redevient « à identifier » (elle sort du sas)
                    const rec = M.data.receptions.find(r => r.id === a.receptionId);
                    if (rec && rec.orpheline && rec.statut === 'A_CONTROLER') { rec.statut = 'A_IDENTIFIER'; delete rec.aControlerDepuis; }
                  }
                  noter('Retirée du dossier ' + d.id + ' « ' + t.libelle + ' »' + (a.alloc.length ? '' : ' : plus aucun dossier, retour dans les réceptions inconnues'));
                  draw();
                }, { small: true, ghost: true })));
            })))) : ui.callout('warning', 'Aucun dossier', ' L’affiche est dans les réceptions inconnues ; rattachez-la à un dossier ci-dessous.'),
          cherche === null ? h('div', { class: 'mt' }, ui.btn('+ Rattacher à un autre dossier', () => { cherche = ''; draw(); }, { small: true })) : panneauRattacher()) : null,
        tab === 'hist' ? h('ul', { class: 'cz-timeline' }, a.historique.concat(M.data.journal.filter(j => j.objet === a.id)).sort((x, y) => x.date - y.date).map(x => h('li', null, h('span', { class: 'when' }, M.fmt.dt(x.date)), h('span', null, x.action + ' · ' + (x.user || '—'))))) : null);
    };
    draw();
    closeSelf = ui.modal({ title: 'Affiche ' + a.id + (a.statut === 'ORPHELINE' ? ' (réception inconnue)' : ''), wide: true, body, actions: [{ label: 'Fermer' }, { label: 'Imprimer la feuille de stock', onClick: () => { ui.printFeuilles([a]); } }, { label: 'Enregistrer', primary: true, onClick: () => { a.historique.push({ date: new Date(M.NOW), user: user(), action: 'Fiche affiche modifiée' }); if (onSave) onSave(); M.refresh(); } }] });
  };
  /** Fiche d'une réception : en-tête du BL, étape où elle en est, lignes du BL avec la quantité comptée. */
  ui.receptionModal = function (rec) {
    if (!rec) return;
    const aCtrl = rec.statut === 'A_CONTROLER';
    let closeSelf = null;
    closeSelf = ui.modal({ title: 'Réception ' + rec.id, wide: true, body: [
      h('div', { class: 'row', style: { marginBottom: '8px' } }, aCtrl ? ui.sev('warning', 'Palette à contrôler') : rec.statut === 'A_IDENTIFIER' ? ui.sev('warning', 'À identifier par la Coordination (zone tampon)') : ui.sev('good', 'Contrôlée'), rec.orpheline ? ui.tag('Réception inconnue', 'hyp') : null, rec.photoBL ? ui.tag('Photo du BL jointe') : ui.tag('Scan du BL joint (simulation)')),
      h('div', { class: 'grid cols-3' }, ui.field('Date', h('b', null, M.fmt.dt(rec.date))), ui.field('BL', h('b', null, rec.bl)), ui.field('Transporteur', h('b', null, rec.transporteur)), ui.field('Imprimeur', h('b', null, rec.imprimeur)), ui.field('Colis / palettes', h('b', null, rec.nbColis)),
        ui.field('Déchargé par', h('b', null, rec.dechargePar || '—')), ui.field('Contrôlé par', h('b', null, rec.controle ? rec.controle.controleur : rec.controleur || '—'))),
      h('div', { class: 'table-wrap mt' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['N° affiche', 'Annonceur', 'Thème', 'Qté du BL', 'Qté reçue', 'Emplacement', 'Statut'].map(x => h('th', null, x)))),
        h('tbody', null, C.lignesReception(rec).map(l => { const a = affiche(l.afficheId); return a ? h('tr', { style: { cursor: 'pointer' }, onclick: () => { if (closeSelf) closeSelf(); ui.afficheModal(a); } }, h('td', null, a.id, l.complement ? [' ', ui.tag('complément', 'hyp')] : null), h('td', null, a.annonceurSaisi), h('td', null, a.libelleSaisi), h('td', { class: 'num' }, l.qte), h('td', { class: 'num' }, a.qteRecue), h('td', null, a.allee + '-' + a.rayon), h('td', null, ui.pill(a.statut))) : null; })))),
    ], actions: [{ label: 'Fermer' }, aCtrl ? { label: 'Contrôler la palette', primary: true, onClick: () => { M.go('reception', { tab: 'controle', id: rec.id }); } } : null].filter(Boolean) });
  };

  /* ---------- Étape 1 : arrivée de la palette ---------- */
  const slug = s => norm(s).replace(/ /g, '_').toUpperCase().slice(0, 18);
  const codeFormat = f => { const m = String(f).match(/(\d+) m²/); const n = m ? m[1] : '2'; return (/fixe/i.test(f) ? 'FIX' : /coll/i.test(f) ? 'COL' : /venusial/i.test(f) ? 'VEN' : /mui/i.test(f) ? 'MUI' : 'SCR') + n + 'M'; };
  /** Un BL fictif sur le modèle du « bon de collecte » d'imprimeur de Doc_Pilotage (BL.png) : en-tête de l'imprimeur, n° et
      date du BL, adresse de livraison, une ligne par visuel (contrat, article, format, annonceur précédé de la semaine, thème
      au nom de fichier technique, quantité, vignette du visuel). Données fictives : rien n'est repris du BL réel. Sur la
      troisième ligne, le n° de contrat est illisible : Circé s'appuie alors sur l'annonceur, la semaine et la vignette. */
  function blFictif() {
    const site = M.state.site === 'WIS' ? 'WIS' : 'NIM';
    const libres = attendues().filter(r => r.d.site === site && r.reste > 0 && r.d.ipSaisies && !R.panier.some(p => p.themeId === r.id))
      .sort((a, b) => a.d.semaine - b.d.semaine || String(a.dossier).localeCompare(String(b.dossier)));
    if (!libres.length) return null;
    const pris = libres.slice(0, 3);
    return Object.assign(enTeteBL(pris[0].dossier, site), { lignes: pris.map((r, i) => ligneBL(r.t, r.d, r.reste, i === 2)) });
  }
  /** En-tête du BL fictif : n° et date, imprimeur, transporteur, colis ; tout ce que la photo pré-remplit dans le bon de livraison. */
  function enTeteBL(dossier, site) {
    const k = Number(dossier) || 0, imprimeurs = M.ref.imprimeurs.filter(x => x !== 'Print Cityz'), tr = M.ref.transporteursEntrants;
    return { num: 'BL' + (2600000 + k % 100000 + M.data.receptions.length), date: new Date(M.NOW), imprimeur: imprimeurs[k % imprimeurs.length], transporteur: tr[k % tr.length], colis: 1 + k % 3, site };
  }
  const ligneBL = (t, d, qte, illisible) => ({ themeId: t.id, t, d, contrat: illisible ? null : d.id, article: 'ART-' + String(t.id).replace(/\D/g, '').padStart(5, '0'), format: codeFormat(d.format),
    annonceur: 'S' + d.semaine + ' ' + d.annonceur.toUpperCase(), theme: 'VIS_' + slug(t.libelle) + '_' + String(t.id).replace(/\D/g, '') + '.pdf', qte });
  /** Le BL photographié quand les lignes viennent de la recherche (19/10 : « dans tous les cas, le BL est scanné ») : il porte
      les lignes cochées du panier, que Circé retrouve ; la photo pré-remplit le bon de livraison. */
  function blDuPanier() {
    const ls = R.panier.filter(coche).map(p => { const t = C.theme(p.themeId); return { t, d: C.dossier(t.dossierId), q: Number(p.qte) || 0 }; });
    if (!ls.length) return null;
    return Object.assign(enTeteBL(ls[0].d.id, ls[0].d.site), { lignes: ls.map(x => ligneBL(x.t, x.d, x.q, false)) });
  }
  /** Candidats pour une ligne au contrat illisible : même annonceur, même semaine, même format, vignette ressemblante. */
  function candidats(l, bl) {
    const ann = norm(l.annonceur.replace(/^S\d+\s+/, ''));
    return attendues().filter(r => r.d.site === bl.site && r.reste > 0 && r.d.ipSaisies).map(r => {
      const raisons = [];
      let s = 0;
      if (norm(r.annonceur) === ann) { s += 0.5; raisons.push('même annonceur'); }
      if (r.d.semaine === l.d.semaine) { s += 0.2; raisons.push('même semaine'); }
      if (codeFormat(r.format) === l.format) { s += 0.1; raisons.push('même format'); }
      if (r.id === l.themeId) { s += 0.15; raisons.push('vignette ressemblante'); }
      return { r, s, raisons };
    }).filter(x => x.s >= 0.3).sort((a, b) => b.s - a.s).slice(0, 3);
  }
  /** Rendu du BL photographié (fictif). */
  function rendreBL(bl) {
    const td = (x, st) => h('td', { style: Object.assign({ border: '1px solid #555', padding: '4px 6px', verticalAlign: 'top' }, st || {}) }, x);
    return h('div', { style: { background: '#fff', border: '1px solid #bbb', boxShadow: '0 1px 4px rgba(0,0,0,.15)', padding: '14px', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#111' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'flex-start' } },
        h('div', null, h('div', { style: { fontWeight: 800, fontSize: '14px', letterSpacing: '1px' } }, bl.imprimeur.toUpperCase()), h('div', { style: { fontWeight: 700, fontSize: '15px', marginTop: '6px' } }, 'BON DE COLLECTE'), h('div', { class: 'mono' }, bl.num), h('div', null, 'Date BL : ' + M.fmt.dy(bl.date)),
          h('div', null, 'Transporteur : ' + bl.transporteur), h('div', null, 'Colis / palettes : ' + bl.colis)),
        h('div', { style: { textAlign: 'right' } }, h('b', null, 'Adresse de livraison :'), h('div', null, 'Plateforme Cityz Media ' + C.site(bl.site).label))),
      h('table', { style: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' } },
        h('thead', null, h('tr', null, ['Contrat', 'Article', 'Format', 'Annonceur', 'Thème', 'Qté', 'Visuel'].map(x => h('th', { style: { border: '1px solid #555', padding: '3px 6px', textAlign: 'left', background: '#f2f2f2' } }, x)))),
        h('tbody', null, bl.lignes.map(l => h('tr', null,
          td(l.contrat ? h('span', { class: 'mono' }, l.contrat + ' VV') : h('span', { style: { background: 'repeating-linear-gradient(45deg,#ccc 0 3px,#eee 3px 6px)', color: '#999', padding: '0 4px' }, title: 'Taché, illisible' }, '5•••• ••')),
          td(h('span', { class: 'mono' }, l.article)), td(h('span', { class: 'mono' }, l.format)), td(l.annonceur), td(h('span', { class: 'mono', style: { fontSize: '10px' } }, l.theme)),
          td(h('span', { style: { border: '1.5px solid #333', borderRadius: '50%', padding: '1px 6px', fontWeight: 700 } }, l.qte), { textAlign: 'center' }),
          td(ui.poster(l.t.libelle, l.d.annonceur, true)))))));
  }
  /** Une affiche photographiée (aperçu fictif), quand le BL ne suffit pas : Circé compare le visuel aux réceptions attendues,
      comme pour les orphelines (reconnaissance simulée), et propose des dossiers classés. */
  function afficheFictive() {
    const site = M.state.site === 'WIS' ? 'WIS' : 'NIM';
    const libres = attendues().filter(r => r.d.site === site && r.reste > 0 && r.d.ipSaisies && !R.panier.some(p => p.themeId === r.id))
      .sort((a, b) => a.d.semaine - b.d.semaine || String(a.dossier).localeCompare(String(b.dossier)));
    if (!libres.length) return null;
    const vrai = libres[Math.min(3, libres.length - 1)]; // pas l'une des trois lignes du BL fictif
    const memeAnn = libres.filter(r => r !== vrai && norm(r.annonceur) === norm(vrai.annonceur)).slice(0, 1);
    const voisins = libres.filter(r => r !== vrai && !memeAnn.includes(r) && r.format === vrai.format && r.d.semaine === vrai.d.semaine).slice(0, 1);
    return { site, vrai, cands: [{ r: vrai, s: 0.93, raisons: ['visuel très proche', 'même annonceur'] }]
      .concat(memeAnn.map(r => ({ r, s: 0.58, raisons: ['même annonceur', 'autre visuel'] })), voisins.map(r => ({ r, s: 0.31, raisons: ['même format', 'même semaine'] }))) };
  }
  /** Photo du BL ou d'une affiche (simulation), deux des trois façons de trouver les dossiers du BL (la troisième : le n° de
      dossier). Avec le BL, Circé lit ses lignes (contrat, annonceur, semaine, format, quantité, vignette) ; avec une affiche,
      il reconnaît le visuel. Dans les deux cas, il propose les réceptions attendues ; l'agent valide, choisit, ou crée une
      réception inconnue. La photo est jointe à la réception (plus de scan en fin de saisie). Ligne 84 de la Synthèse.
      Le BL est toujours photographié (19/10), même quand les lignes viennent de la recherche : « joindre » le photographie
      depuis le bon de livraison ; Circé retrouve les lignes cochées. La photo du BL pré-remplit le bon de livraison ; il ne
      reste à l'agent qu'à vérifier et valider. depart : 'bl', 'affiche' ou 'joindre'. */
  function photo(depart) {
    const joindre = depart === 'joindre', mode = depart === 'affiche' ? 'affiche' : 'bl';
    const bl = mode === 'bl' ? (joindre ? blDuPanier() : blFictif()) : null, af = mode === 'affiche' ? afficheFictive() : null;
    if (!bl && !af) { ui.toast(joindre ? 'Cochez dans le panier les lignes de ce BL.' : 'Aucune réception attendue à proposer sur ce site.', 'critical'); return; }
    const choix = bl ? bl.lignes.map(l => (l.contrat ? l.themeId : ((candidats(l, bl)[0] || {}).r || {}).id || '__orph')) : [];
    const choixAff = { id: af ? af.cands[0].r.id : '__orph', qte: af ? af.vrai.reste : 0 };
    const radio = (nom, coche, onchange, libelle, detail) => h('label', { class: 'form-check', style: { margin: 0 } }, h('input', { class: 'form-check-input', type: 'radio', name: nom, checked: coche, onchange }),
      h('span', { class: 'form-check-label' }, libelle, detail ? [' ', h('span', { class: 'small muted' }, detail)] : null));
    const vueBL = () => h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(420px, 1.2fr) 1fr', gap: '16px', alignItems: 'start' } },
      h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Photo du BL prise à l’arrivée de la palette (BL fictif, sur le modèle d’un bon de collecte d’imprimeur)'), rendreBL(bl)),
      h('div', { class: 'stack', style: { gap: '10px' } },
        ui.annot(joindre ? 'Le BL est photographié même quand les lignes viennent de la recherche : Circé le lit, retrouve les lignes cochées du panier et pré-remplit le bon de livraison (n° de BL, imprimeur, transporteur, colis). L’agent vérifie, puis valide la réception.'
          : 'Circé lit le n° de contrat, l’annonceur, la semaine, le format, la quantité et la vignette du visuel, puis propose les réceptions attendues ; il pré-remplit le bon de livraison (n° de BL, imprimeur, transporteur, colis). L’agent valide toujours : sans proposition sûre, il choisit, ou crée une réception inconnue.', ['REC-17', 'REC-09', 'ERG-01']),
        bl.lignes.map((l, i) => {
          const sure = !!l.contrat, deja = R.panier.some(p => p.themeId === l.themeId);
          return h('div', { style: { border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px' } },
            h('div', { class: 'row', style: { marginBottom: '4px' } }, h('b', null, 'Ligne ' + (i + 1)), sure ? ui.sev('good', 'Contrat ' + l.contrat + ' lu') : ui.sev('warning', 'Contrat illisible'), h('span', { class: 'small muted' }, l.annonceur + ' · ' + l.format + ' · qté ' + l.qte)),
            sure ? ui.checkbox('Dossier ' + l.d.id + ' · ' + l.d.annonceur + ' · « ' + l.t.libelle + ' » (reste ' + C.reste(l.t) + ') : ' + (deja ? 'déjà au panier' : 'correspondance sûre'), choix[i] === l.themeId, v => { choix[i] = v ? l.themeId : ''; })
              : h('div', { class: 'stack', style: { gap: '2px' } },
                candidats(l, bl).map(c => radio('bl-l' + i, choix[i] === c.r.id, () => { choix[i] = c.r.id; }, 'Dossier ' + c.r.dossier + ' · ' + c.r.annonceur + ' · « ' + c.r.theme + ' »', '(' + Math.round(c.s * 100) + ' % : ' + c.raisons.join(', ') + ')')),
                radio('bl-l' + i, choix[i] === '__orph', () => { choix[i] = '__orph'; }, 'Aucun : réception inconnue')));
        })));
    const vueAffiche = () => h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(260px, .8fr) 1.2fr', gap: '16px', alignItems: 'start' } },
      h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Photo de l’affiche prise sur la palette (aperçu fictif)'), ui.poster(af.vrai.theme, af.vrai.annonceur, 'lg')),
      h('div', { class: 'stack', style: { gap: '10px' } },
        ui.annot('Quand le BL ne porte ni contrat ni DA, ou qu’il manque : Circé compare le visuel photographié à ceux des réceptions attendues et propose les dossiers les plus proches. L’agent choisit ; sinon, réception inconnue (l’affiche part dans « Réceptions inconnues »).', ['REC-17', 'CIB-08', 'PROC-04']),
        h('div', { style: { border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px' } },
          h('div', { style: { marginBottom: '4px' } }, h('b', null, 'Visuels reconnus')),
          h('div', { class: 'stack', style: { gap: '2px' } },
            af.cands.map(c => radio('aff', choixAff.id === c.r.id, () => { choixAff.id = c.r.id; }, 'Dossier ' + c.r.dossier + ' · ' + c.r.annonceur + ' · « ' + c.r.theme + ' » (reste ' + c.r.reste + ')', '(' + Math.round(c.s * 100) + ' % : ' + c.raisons.join(', ') + ')')),
            radio('aff', choixAff.id === '__orph', () => { choixAff.id = '__orph'; }, 'Aucun : réception inconnue'))),
        ui.field('Quantité sur la palette', ui.input({ type: 'number', value: choixAff.qte, min: 0, label: 'Quantité sur la palette', style: { width: '120px' }, onChange: v => { choixAff.qte = Number(v) || 0; } }))));
    // Le choix BL / affiche se fait dans le bandeau (19/10) : la fenêtre montre la seule photo prise
    const body = mode === 'bl' ? vueBL() : vueAffiche();
    ui.modal({ title: mode === 'bl' ? 'Photo du BL' : 'Photo d’une affiche', wide: true, body, actions: [{ label: 'Annuler' }, { label: joindre ? 'Joindre le BL' : 'Mettre au panier', primary: true, onClick: () => {
      if (mode === 'affiche') {
        if (choixAff.id === '__orph') { setTimeout(() => orphelineForm({ site: af.site, qte: choixAff.qte }), 0); return; }
        const ok = auPanier(C.theme(choixAff.id), choixAff.qte || undefined, 'VISUEL');
        M.journal(choixAff.id, 'Photo d’une affiche : visuel reconnu, ligne au panier', user());
        ui.toast(ok ? 'Visuel reconnu : 1 ligne au panier ; la photo de l’affiche est jointe à la réception.' : 'Ce visuel est déjà au panier.', ok ? 'good' : 'critical');
        M.refresh();
        return;
      }
      let n = 0;
      const duBL = [];
      bl.lignes.forEach((l, i) => { if (choix[i] && choix[i] !== '__orph') { if (auPanier(C.theme(choix[i]), l.qte, l.contrat && choix[i] === l.themeId ? 'BL' : 'VISUEL')) n++; duBL.push(choix[i]); } });
      // Les lignes lues sur le BL sont cochées, les autres lignes du panier décochées : ce BL ne vaut que pour les siennes.
      // La photo pré-remplit tout le bon de livraison : il ne reste qu'à vérifier et valider.
      const autres = R.panier.filter(p => !duBL.includes(p.themeId)).length;
      R.panier.forEach(p => { p.sel = duBL.includes(p.themeId); });
      R.bl = { num: bl.num, date: bl.date, imprimeur: bl.imprimeur, transporteur: bl.transporteur, colis: bl.colis, site: bl.site, lignes: bl.lignes.length, themes: duBL };
      Object.assign(R.form, { bl: bl.num, imprimeur: bl.imprimeur, transporteur: bl.transporteur, nbColis: bl.colis });
      M.journal(bl.num, 'Photo du BL : ' + duBL.length + ' ligne(s) cochée(s), dont ' + n + ' mise(s) au panier', user());
      const orph = bl.lignes.find((l, i) => choix[i] === '__orph');
      ui.toast((joindre ? 'BL ' + bl.num + ' joint : ' + duBL.length + ' ligne(s) retrouvée(s) au panier' + (n ? ', dont ' + n + ' ajoutée(s)' : '') : n + ' ligne(s) du BL au panier') + ', cochées pour ce BL' + (autres ? ' (les ' + autres + ' autre(s) ligne(s) du panier sont décochées)' : '') + ' ; bon de livraison pré-rempli : vérifiez, puis validez la réception.' + (orph ? ' Une ligne sans dossier : réception inconnue.' : ''), 'good');
      M.refresh();
      if (orph) setTimeout(() => orphelineForm({ site: bl.site, annonceur: orph.annonceur.replace(/^S\d+\s+/, ''), theme: orph.theme, format: orph.d.format, qte: orph.qte }), 0);
    } }] });
  }
  /** Le BL photographié, en lecture (depuis la réception ou le contrôle). */
  function voirBL(rec) {
    ui.modal({ title: 'BL ' + rec.bl + ' · réception ' + rec.id, body: [h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Photo du BL prise à l’arrivée de la palette et jointe à la réception (simulation).'),
      h('div', { class: 'stack', style: { gap: '4px' } }, h('div', null, 'Imprimeur : ', h('b', null, rec.imprimeur)), h('div', null, 'Transporteur : ', h('b', null, rec.transporteur)), h('div', null, C.lignesReception(rec).length + ' ligne(s) au BL'))] });
  }

  /** Attente d'une palette dans le sas de contrôle (depuis son arrivée ; pour une réception inconnue, depuis son rattachement), et
      palettes au-delà du délai de contrôle. */
  const attente = r => M.NOW - (r.aControlerDepuis || r.date);
  const enRetard = r => attente(r) > M.PARAMS.delaiControle * 3600e3;
  const duree = ms => { const hh = Math.floor(ms / 3600e3); return hh < 1 ? Math.max(1, Math.round(ms / 60e3)) + ' min' : hh < 48 ? hh + ' h' : Math.floor(hh / 24) + ' j ' + (hh % 24) + ' h'; };
  /** Les deux étapes de la réception (S19, S20), sur une seule page (21/10) : le repère de l'étape 1 dans l'intro, sous le titre ;
      celui de l'étape 2 sous le panier et le bon de livraison, en tête du sas et du contrôle. */
  const ETAPES = () => {
    const l = C.receptionsAControler(), n = l.length, k = l.filter(enRetard).length;
    return [['1', 'Arrivée de la palette', 'trouver les dossiers du BL, valider'], ['2', 'Contrôle des affiches', n ? n + ' palette(s) à contrôler' + (k ? ', dont ' + k + ' en retard' : '') : 'aucune palette à contrôler']];
  };
  const etapeTitre = num => { const [n, lib, sub] = ETAPES()[num - 1];
    return h('div', { class: 'cz-etapes', role: 'heading', 'aria-level': '2' }, h('div', { class: 'cz-etape is-on' }, h('span', { class: 'cz-etape-num' }, n), h('span', null, h('b', null, lib), h('span', { class: 'cz-etape-sub' }, sub)))); };
  const statutAttendue = s => s === 'Complète' ? ui.sev('good', 'Complète') : s === 'Surplus' ? ui.sev('warning', 'Surplus') : s === 'Partielle' ? ui.sev('serious', 'Partielle') : h('span', { class: 'cz-status s-0' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'Attendue');

  /** Étape 1 sur une seule page (19/10) : trouver les dossiers du BL (trois façons : photo du BL, photo d'une affiche, ou
      n° de dossier puis « Au panier »), cocher les lignes du BL et vérifier leurs quantités, remplir le bon de livraison, valider. Dans Circé : les
      réceptions attendues et le panier, puis la fenêtre « Préparation de la réception » ouverte par « Ouvrir réception »,
      qui prenait tout le panier. */
  function tabArrivee(root) {
    const D = M.data;
    const all = attendues();
    const FA = filtresAttendues(all);
    const rows = FA.apply(all);
    // Bandeau de départ (19/10) : les trois façons de trouver les dossiers du BL, côte à côte et au même format (photo du BL,
    // photo d'une affiche, n° de dossier, comme le process de la cheffe de projet), puis, à la ligne, le recours
    const voie = (icone, titre, aide, action) => h('div', { class: 'cz-voie' },
      h('div', { class: 'cz-voie-tete' }, ui.icon(icone), h('b', null, titre)), h('div', { class: 'cz-voie-aide' }, aide), action);
    const trouver = h('div', { class: 'cz-trouver', role: 'group', 'aria-label': 'Trouver les dossiers du BL' },
      // Sans numéro (21/10) : le « 1 » est celui de l'étape, dans l'intro
      h('div', { class: 'cz-trouver-tete' }, h('b', null, 'Trouver les dossiers du BL'), h('span', { class: 'cz-trouver-ou' }, 'trois façons, au choix')),
      h('div', { class: 'cz-trouver-voies' },
        voie('receipt', 'Photo du BL', 'Circé lit les lignes du BL et propose les dossiers ; la photo remplit le bon de livraison.',
          ui.btn('Photographier le BL', () => photo('bl'), { icon: 'scan', title: 'Circé lit le BL et propose les dossiers' })),
        voie('photo', 'Photo d’une affiche', 'Quand le BL ne suffit pas : Circé reconnaît le visuel et propose les dossiers proches.',
          ui.btn('Photographier une affiche', () => photo('affiche'), { icon: 'photo', title: 'Circé reconnaît le visuel et propose les dossiers' })),
        voie('search', 'Par n° de dossier', 'N° de dossier, de DA ou annonceur : la liste ci-dessous se filtre, puis « Au panier ».', FA.champ('dossier'))),
      // Le recours, à la ligne (19/10) : la question et son bouton restent ensemble ; ils valent pour les trois façons
      h('div', { class: 'cz-trouver-recours' }, h('span', { class: 'cz-trouver-ou' }, 'Rien ne correspond ?'),
        ui.btn('Réception inconnue…', () => orphelineForm(), { title: 'Ni contrat ni DA sur le BL, et rien de reconnu : créer la réception inconnue ; son affiche se rattache ensuite dans « Réceptions inconnues »' })));
    const dansPanier = new Set(R.panier.map(p => p.themeId));
    const lines = R.panier.map(p => ({ p, t: C.theme(p.themeId), d: C.dossier(C.theme(p.themeId).dossierId) }));
    /** Sans IP : l'agent saisit l'intitulé lu sur l'affiche ; celui déjà saisi par l'autre plateforme est proposé (REC-18). */
    const champIntitule = l => {
      const pr = intituleAutre(l.d);
      if (l.p.intitule === undefined) l.p.intitule = pr ? pr.lib : '';
      return h('div', { class: 'small' }, h('div', { class: 'muted' }, 'IP non saisies · ' + l.d.format + ' : intitulé lu sur l’affiche'),
        ui.input({ value: l.p.intitule, label: 'Intitulé saisi (sans IP)', placeholder: 'ex. BURGER', style: { width: '200px', minWidth: '0' }, onChange: v => { l.p.intitule = v; } }),
        pr ? h('div', { class: 'muted' }, 'Proposé : déjà saisi par ' + pr.site + ' (affiche ' + pr.id + '), « le 1er qui a parlé »') : null);
    };
    // Un BL = une réception (comme le cadre « Livraison » de Circé) ; le panier peut réunir les lignes de plusieurs BL : seules
    // les lignes cochées entrent dans la réception, les autres restent au panier pour le BL suivant (19/10)
    const valider = () => {
      const pris = lines.filter(l => coche(l.p));
      if (!lines.length) { ui.toast('Le panier est vide.', 'critical'); return; }
      if (!pris.length) { ui.toast('Cochez dans le panier les lignes de ce BL.', 'critical'); return; }
      if (M.uniq(pris.map(l => l.d.site)).length > 1) { ui.toast('Les lignes cochées sont sur deux plateformes : un BL ne livre qu’une plateforme.', 'critical'); return; }
      if (!R.bl) { ui.toast('Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche.', 'critical'); return; }
      if (!R.form.bl || !R.form.transporteur || !R.form.imprimeur) { ui.toast('N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé.', 'critical'); return; }
      M.tick(5);
      const site = pris[0].d.site;
      const qui = R.form.dechargePar || user();
      const rec = { id: 'R' + (260900 + D.receptions.length), site, date: new Date(M.NOW), bl: R.form.bl, transporteur: R.form.transporteur, imprimeur: R.form.imprimeur, nbColis: R.form.nbColis, dechargePar: R.form.dechargePar || null, controleur: null, affiches: [], lignes: [], statut: 'A_CONTROLER', photoBL: !!R.bl, ordre: D.receptions.length + 1 };
      let nNew = 0, nCompl = 0;
      pris.forEach(l => {
        const q = Number(l.p.qte) || 0;
        if (!q) return;
        let af = l.p.complement ? affiche(l.p.complement) : null;
        if (af) {
          // Livraison en deux fois sur un même visuel : même n° d'affiche, deux réceptions tracées (REC-22, ligne 88)
          const x = af.alloc.find(y => y.themeId === l.t.id); if (x) x.qte += q; else af.alloc.push({ themeId: l.t.id, qte: q });
          af.qteRecue += q; af.enAttenteControle = true; af.receptions = M.uniq((af.receptions || [af.receptionId]).concat(rec.id));
          af.historique.push({ date: new Date(M.NOW), user: qui, action: 'Complément ' + rec.id + ' : +' + q + ' affiches (quantité du BL), à contrôler' });
          D.mouvements.push({ id: M.uid('MV'), date: new Date(M.NOW), afficheId: af.id, type: 'Réception (complément)', qte: q, user: qui, auto: false, motif: rec.id });
          nCompl++;
        } else {
          af = { id: String(712900 + D.affiches.length), receptionId: rec.id, receptions: [rec.id], site, date: new Date(M.NOW), statut: 'IDENTIFIEE', qteBL: q, qteRecue: q, alloc: [{ themeId: l.t.id, qte: q }], rattache: l.p.voie || 'BL', annonceurSaisi: l.d.annonceur, libelleSaisi: l.d.ipSaisies ? l.t.libelle : (String(l.p.intitule || '').trim() || 'à décrire'), format: l.d.format, imprimeur: rec.imprimeur, allee: 'Z', rayon: 'tampon', rebut: 0, aConserver: false, semaines: l.d.semaines.slice(), controleur: null, enAttenteControle: true, historique: [{ date: new Date(M.NOW), user: qui, action: 'Arrivée ' + rec.id + ' : ' + q + ' affiches (quantité du BL), palette à contrôler' }] };
          D.affiches.push(af);
          af.historique.push({ date: new Date(M.NOW.getTime() + 60e3), user: 'Circé', action: 'Rattachement proposé : dossier ' + l.d.id + ' · « ' + l.t.libelle + ' » (' + (af.rattache === 'VISUEL' ? 'visuel reconnu' : 'n° de dossier lu sur le BL') + ') : à confirmer par la Coordination' });
          D.mouvements.push({ id: M.uid('MV'), date: af.date, afficheId: af.id, type: 'Réception', qte: q, user: qui, auto: false });
          nNew++;
        }
        if (!rec.affiches.includes(af.id)) rec.affiches.push(af.id);
        rec.lignes.push({ afficheId: af.id, qte: q, complement: !!l.p.complement, themeId: l.t.id });
      });
      D.receptions.push(rec);
      const before = D.unites.filter(u => u.statut === 'EN_ATTENTE').length;
      C.recalculer();
      const freed = before - D.unites.filter(u => u.statut === 'EN_ATTENTE').length;
      M.journal(rec.id, 'Arrivée de la palette : ' + nNew + ' affiche(s) créée(s)' + (nCompl ? ', ' + nCompl + ' complément(s)' : '') + ' ; ' + freed + ' unité(s) passée(s) « Prêt »', qui);
      // Validation admin (option A, 02/11) : à la réception, Circé propose le rattachement de chaque affiche à la ligne attendue du
      // dossier ; rien n'est validé sans la Coordination, qui confirme en lot (cas sûrs pré-cochés) dans Validation admin et Instruction OK. Les doutes
      // lèvent une alerte (« Validation admin à confirmer »). La préparation n'est pas attendue.
      const nouv = rec.affiches.map(id => D.affiches.find(x => x.id === id)).filter(Boolean);
      const nVa = e => nouv.filter(x => C.vaEtat(x) === e).length;
      const vaParts = [nVa('PROPOSEE') ? nVa('PROPOSEE') + ' rattachement(s) proposé(s) à confirmer' : null, nVa('A_FAIRE') ? nVa('A_FAIRE') + ' avec un doute, à confirmer après vérification' : null].filter(Boolean);
      const vaTxt = vaParts.length ? ' Validation admin : ' + vaParts.join(', ') + ' (Coordination).' : '';
      M.uniq(nouv.flatMap(C.dossiersOfAffiche)).map(C.dossier).filter(Boolean).forEach(d => C.majStatutVA(d));
      // Les champs propres au BL se vident ; transporteur et « Déchargé par » restent (même arrivée)
      R.panier = R.panier.filter(p => !coche(p)); R.bl = null; R.form.bl = ''; R.form.imprimeur = ''; R.form.nbColis = 1;
      const reste = R.panier.length;
      // Pas d'étiquette (19/10) : la palette passe au sas de l'étape 2, où l'agent de contrôle l'ouvre dans la liste
      ui.toast('Réception ' + rec.id + ' : ' + (nNew + nCompl) + ' ligne(s), « affiche reçue » = oui dès l’arrivée ; ' + freed + ' unité(s) prête(s) à produire. La palette passe à l’étape 2 (contrôle).' + vaTxt + (reste ?' Il reste ' + reste + ' ligne(s) au panier : cochez celles du BL suivant.' : ''), 'good');
      M.refresh();
    };
    /* Panier et bon de livraison liés (19/10) : le panier réunit les lignes trouvées, en masse au besoin ; on coche celles du BL,
       et le bon de livraison ne vaut que pour elles. Cocher ne redessine que ces deux cartes (la page et sa recherche restent). */
    let carteLignes = null, carteBL = null;
    const majBL = () => { const n = carteBonLivraison(); carteBL.replaceWith(n); carteBL = n; };
    const majTout = focus => {
      const n = cartePanier(); carteLignes.replaceWith(n); carteLignes = n; majBL();
      const el = carteLignes.querySelector('[data-coche="' + focus + '"]'); if (el) el.focus();
    };
    const cartePanier = () => {
      const pris = lines.filter(l => coche(l.p));
      const tout = h('input', { class: 'form-check-input m-0', type: 'checkbox', checked: pris.length === lines.length, 'aria-label': 'Cocher toutes les lignes du panier', title: 'Tout cocher ou tout décocher', dataset: { coche: 'tout' },
        onchange: e => { lines.forEach(l => { l.p.sel = e.target.checked; }); majTout('tout'); } });
      tout.indeterminate = pris.length > 0 && pris.length < lines.length;
      return ui.card({ title: 'Lignes du BL (panier)',
        sub: lines.length ? pris.length + ' cochée(s) sur ' + lines.length + ' pour ce BL : elles deviennent des affiches à la validation' + (pris.length < lines.length ? ', les autres restent au panier' : '') + (R.bl ? ' · BL ' + R.bl.num + ' lu par Circé' : '') : null,
        actions: lines.length ? ui.btn('Vider le panier', () => { R.panier = []; R.bl = null; M.refresh(); }, { small: true, ghost: true }) : null, flush: true,
        body: lines.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
          h('thead', null, h('tr', null, h('th', { class: 'w-1' }, tout), ['Dossier', 'Annonceur · thème', 'Reste attendu', 'Qté du BL', 'Livraison en deux fois', ''].map(x => h('th', null, x)))),
          h('tbody', null, lines.map((l, i) => {
            const deja = C.recu(l.t.id) > 0 ? afficheDuTheme(l.t) : null;
            return h('tr', { class: coche(l.p) ? 'is-sel' : null },
              h('td', null, h('input', { class: 'form-check-input m-0', type: 'checkbox', checked: coche(l.p), 'aria-label': 'Ligne de ce BL · ' + l.d.id + ' · ' + l.d.annonceur, dataset: { coche: String(i) }, onchange: e => { l.p.sel = e.target.checked; majTout(i); } })),
              h('td', null, l.d.id), h('td', null, h('b', null, l.d.ipSaisies ? ui.btnVisuel(l.t) : null, l.d.annonceur), l.d.ipSaisies ? h('div', { class: 'small muted' }, l.t.libelle + ' · ' + l.d.format) : champIntitule(l)),
              h('td', { class: 'num' }, C.reste(l.t)),
              h('td', null, ui.input({ type: 'number', value: l.p.qte, min: 0, label: 'Quantité du BL', style: { width: '80px', minWidth: '0' }, onChange: v => { l.p.qte = v; majBL(); } })),
              h('td', null, deja ? ui.checkbox('Complément de l’affiche ' + deja.id, !!l.p.complement, v => { l.p.complement = v ? deja.id : null; }) : h('span', { class: 'small muted' }, '—')),
              h('td', null, ui.btn('Retirer', () => { R.panier.splice(i, 1); M.refresh(); }, { small: true, ghost: true })));
          })))) : h('div', { class: 'dt-empty' }, 'Aucune ligne. Trouvez les dossiers du BL en haut (photo du BL, photo d’une affiche, ou n° de dossier puis « Au panier ») : chaque ligne arrive avec sa case, cochée pour ce BL ; décochez celles d’un autre BL. Rien ne correspond : « Réception inconnue ».') });
    };
    // Le BL est toujours photographié (19/10) : la photo pré-remplit ce bon de livraison ; sans elle, on ne valide pas
    const carteBonLivraison = () => {
      const pris = lines.filter(l => coche(l.p)), qte = M.sum(pris, l => Number(l.p.qte) || 0);
      const horsBL = R.bl && R.bl.themes ? pris.filter(l => !R.bl.themes.includes(l.t.id)) : [];
      const photoBL = () => photo(pris.length ? 'joindre' : undefined);
      return ui.card({ title: 'Bon de livraison',
        sub: pris.length ? 'Pour les ' + pris.length + ' ligne(s) cochée(s) du panier : un BL = une réception' : lines.length ? 'Cochez dans le panier (première colonne) les lignes de ce BL' : 'Un BL = une réception : mettez ses lignes au panier, elles arrivent cochées',
        body: h('div', { class: 'stack', style: { gap: '10px' } },
          R.bl ? ui.callout('good', 'BL ' + R.bl.num + ' lu par Circé', ' Photo jointe à la réception ; bon de livraison pré-rempli : vérifiez, puis validez.', ui.btn('Reprendre la photo', photoBL, { small: true, ghost: true }))
            : ui.callout('warning', 'BL à photographier', ' Obligatoire, même quand les lignes viennent de la recherche : la photo est jointe à la réception et pré-remplit ce bon de livraison.', ui.btn('Photographier le BL', photoBL, { small: true, primary: true, icon: 'scan' })),
          horsBL.length ? ui.callout('warning', horsBL.length + ' ligne(s) cochée(s) absente(s) du BL photographié', ' ' + horsBL.map(l => l.d.id + ' ' + l.d.annonceur).join(', ') + ' : décochez-les, ou vérifiez le BL.') : null,
          ui.field('Lignes de ce BL', pris.length ? h('div', null, h('b', null, pris.length + ' ligne(s) · ' + M.fmt.n(qte) + ' affiche(s)'),
            h('div', { class: 'small muted' }, pris.slice(0, 4).map(l => l.d.id + ' ' + l.d.annonceur).join(' · ') + (pris.length > 4 ? ' · et ' + (pris.length - 4) + ' autre(s)' : '')))
            : h('span', { class: 'muted' }, lines.length ? 'Aucune : cochez-les dans le panier' : 'Panier vide')),
          ui.field('Date de livraison', h('b', null, M.fmt.dt(M.NOW))),
          ui.field('N° de BL (BL imprimeur = BL transporteur)', ui.input({ value: R.form.bl, placeholder: 'lu sur la photo du BL', onChange: v => { R.form.bl = v; } })),
          ui.field('Transporteur', ui.select({ value: R.form.transporteur, label: 'Transporteur', options: liste(M.ref.transporteursEntrants, R.form.transporteur), onChange: v => { R.form.transporteur = v; } })),
          ui.field('Imprimeur', ui.select({ value: R.form.imprimeur, label: 'Imprimeur', options: liste(M.ref.imprimeurs, R.form.imprimeur), onChange: v => { R.form.imprimeur = v; } })),
          ui.field('Nombre de colis / palettes', ui.input({ type: 'number', value: R.form.nbColis, min: 1, onChange: v => { R.form.nbColis = Number(v); } })),
          ui.field('Déchargé par', ui.select({ value: R.form.dechargePar, label: 'Déchargé par', options: liste(M.ref.controleurs, R.form.dechargePar), onChange: v => { R.form.dechargePar = v; } })),
          h('div', { class: 'row' }, ui.btn('Valider la réception' + (pris.length ? ' (' + pris.length + ' ligne' + (pris.length > 1 ? 's' : '') + ')' : ''), valider, { primary: true }))) });
    };
    // Ordre (19/10) : bandeau, note, puis le tableau ; ses filtres passent dans sa ligne d'outils (core.js)
    root.append(
      trouver,
      ui.annot('Étape 1 : arrivée de la palette, en zone tampon. Trois façons de trouver les dossiers du BL, côte à côte dans le bandeau : la photo du BL, la photo d’une affiche (si le BL ne suffit pas), ou le n° de dossier (ou de DA, ou l’annonceur), qui filtre les réceptions attendues, puis « Au panier » ; rien ne correspond : réception inconnue. Lignes, bon de livraison et validation sont sur la même page. Le panier peut réunir les lignes de plusieurs BL : on coche celles du BL, le bon de livraison ne vaut que pour elles (un BL = une réception), les autres restent au panier pour le BL suivant. Le BL est photographié dans tous les cas, même quand les lignes viennent de la recherche : la photo pré-remplit le bon de livraison, l’agent vérifie et valide. La validation crée le n° de réception et les n° d’affiche (un visuel déjà reçu en partie garde le sien : complément) et met « affiche reçue » à oui ; la palette passe à l’étape 2, sans étiquette. Purge automatique : au-delà de ' + M.PARAMS.purgeAttendues + ' semaines, une réception attendue ou partielle sort de la liste, sauf conservation à l’année.', ['REC-25', 'REC-17', 'REC-04', 'REC-22', 'REC-05', 'PP-02', 'CIB-05', 'ERG-01']),
      FA.bar,
      ui.card({ title: 'Réceptions attendues', sub: 'Ce qu’on attend, issu de Broadcast dès la DA activée. « Au panier » ajoute une ligne du BL ; on peut aussi en cocher plusieurs.', flush: true, body: ui.table({
        // Pas de recherche dans le tableau : le n° de dossier est cherché dans le bandeau (19/10)
        id: 'recep-attendues', rows, selectable: true, maxHeight: '330px', exportName: 'receptions-attendues.csv', search: false,
        tone: r => r.statut === 'Surplus' ? 'warning' : r.statut === 'Partielle' ? 'serious' : null,
        bulkActions: (sel, clear) => [ui.btn('Ajouter au panier (' + sel.length + ')', () => { const n = sel.filter(r => auPanier(r.t)).length; clear(); ui.toast(n + ' ligne(s) ajoutée(s) au panier.', 'good'); M.refresh(); }, { small: true, primary: true })],
        columns: [
          { key: 'site', label: 'Site', hidden: M.state.site !== 'ALL' },
          { key: 'dossier', label: 'Dossier' },
          ui.colVisuel(),
          { key: 'semaines', label: 'Départ' },
          { key: 'recuSur', label: 'Reçu / attendu', align: 'num', title: 'Quantité reçue / attendue ; dessous, le n° de l’affiche déjà reçue (cliquer pour ouvrir sa fiche)', value: r => r.attendu ? r.recu / r.attendu : 0, csv: r => r.recu + ' / ' + r.attendu,
            render: r => h('span', null, M.fmt.n(r.recu) + ' / ' + M.fmt.n(r.attendu), r.affs.length ? h('div', { class: 'small' }, r.affs.map((a, i) => [i ? ', ' : null, h('button', { type: 'button', class: 'linkish', title: 'Ouvrir la fiche de l’affiche', onclick: e => { e.stopPropagation(); ui.afficheModal(a); } }, a.id)])) : null) },
          { key: 'reste', label: 'Reste', align: 'num' },
          { key: 'statut', label: 'Statut', render: r => statutAttendue(r.statut) },
          { key: 'controle', label: 'Contrôle', title: 'Contrôle des affiches déjà reçues (étape 2) ; contrôlée : la feuille de stock se réimprime depuis cette ligne', render: r => (!r.controle ? '—' : r.controle === 'Contrôlée' ? ui.sev('good', 'Contrôlée') : ui.sev('warning', 'À contrôler')), value: r => r.controle || '—' },
          { key: 'livraison', label: 'Livraison prévue', render: r => r.livraison ? M.fmt.day(r.livraison) : r.print ? 'Print Cityz' : '—', value: r => r.livraison ? r.livraison.getTime() : null },
          { key: 'da', label: 'DA', hidden: true }, { key: 'annonceur', label: 'Annonceur', hidden: true }, { key: 'theme', label: 'Thème', hidden: true }, { key: 'format', label: 'Format', hidden: true },
          { key: 'attendu', label: 'Attendu', align: 'num', hidden: true }, { key: 'recu', label: 'Reçu', align: 'num', hidden: true },
          { key: 'nAff', label: 'N° d’affiche', hidden: true, value: r => r.affs.map(a => a.id).join(', ') },
        ],
        // Affiches contrôlées (21/10) : réimprimer leur feuille de stock, sans passer par la Liste des affiches
        rowActions: r => h('span', { class: 'row nowrap', style: { gap: '6px', flexWrap: 'nowrap' } },
          r.controlees.length ? ui.btn('Feuille de stock', () => ui.printFeuilles(r.controlees, 'Dossier ' + r.d.id + ' « ' + r.theme + ' » : feuille(s) de stock', { rack: true }), { small: true, ghost: true, icon: 'printer', title: 'Réimprimer la feuille de stock de ' + (r.controlees.length > 1 ? 'ses ' + r.controlees.length + ' affiches contrôlées' : 'l’affiche contrôlée') + ' (' + r.controlees.map(a => a.id).join(', ') + ')' }) : null,
          dansPanier.has(r.id) ? h('span', { class: 'small muted nowrap' }, '✓ au panier')
            : ui.btn('Au panier', () => { auPanier(r.t); M.refresh(); }, { small: true, icon: 'plus', title: 'Mettre cette ligne du BL au panier' })),
      }) }),
      h('div', { class: 'grid side mt' }, carteLignes = cartePanier(), carteBL = carteBonLivraison()));
  }

  /* ---------- Les deux étapes sur une seule page (21/10) ---------- */
  /** Étape 1, puis, sous le panier et le bon de livraison, l'étape 2 : le sas, et sous le sas le contrôle de la palette ouverte
      (?tab=controle&id=…). ?tab=controle mène directement à l'étape 2 de la page. */
  function tabReception(root, params) {
    tabArrivee(root);
    const rec = params.id ? M.data.receptions.find(r => r.id === params.id) : null;
    const s2 = h('section', { class: 'cz-etape2', id: 'recep-etape2', 'aria-label': 'Étape 2 : contrôle des affiches' },
      etapeTitre(2), sasPalettes(params), rec ? controlePalette(rec, { fermer: true, inconnue: !!rec.orpheline }) : null);
    root.append(s2);
    if (params.tab === 'controle') setTimeout(() => { const cible = (rec && document.getElementById('controle-' + rec.id)) || s2; if (cible.scrollIntoView) cible.scrollIntoView({ block: 'start' }); }, 0);
  }

  /* ---------- Étape 2 : contrôle des affiches ---------- */
  /** Le sas (19/10) : les palettes arrivées, en zone tampon, la plus ancienne en tête ; il se remplit et doit être contrôlé vite.
      Pas de douchette : on retrouve la palette dans la liste (n° de BL, imprimeur, sur le BL de la pochette) et on l'ouvre ; son
      contrôle s'affiche sous la liste. Une réception inconnue y entre une fois rattachée par la Coordination (21/10). */
  function sasPalettes(params) {
    const list = C.receptionsAControler().slice().sort((a, b) => attente(b) - attente(a));
    const k = list.filter(enRetard).length, Hc = M.PARAMS.delaiControle;
    return [
      ui.annot('Étape 2 sur 2 : contrôle et stockage, sur la même page que l’arrivée (21/10). Le sas des palettes arrivées, en zone tampon : il se remplit et doit être contrôlé vite (alerte au-delà de ' + Hc + ' h, délai paramétrable). On retrouve la palette par son n° de BL ou son imprimeur, on l’ouvre : son contrôle s’affiche dessous, avec toutes ses affiches. On compte, on range (allée / rayon), puis les feuilles de stock définitives s’impriment en lot, en 2 exemplaires (palette et Coordination). Une réception inconnue y arrive une fois rattachée.', ['REC-25', 'REC-03', 'REC-02', 'REC-12', 'ERG-01']),
      // h() ignore null, Element.append non : l'encadré conditionnel passe par un conteneur
      h('div', null, k ? ui.callout('warning', k + ' palette(s) dans le sas depuis plus de ' + Hc + ' h', ' À contrôler en premier : elles sont en tête de liste.') : null),
      ui.card({ title: 'Palettes à contrôler (sas)', sub: list.length + ' réception(s) arrivée(s), en zone tampon, la plus ancienne en tête', flush: true, body: ui.table({
        id: 'recep-acontroler', rows: list.map(r => ({ id: r.id, r, date: r.date, attente: attente(r), site: C.site(r.site).label, bl: r.bl, imprimeur: r.imprimeur, nb: C.lignesReception(r).length, qte: M.sum(C.lignesReception(r), l => l.qte), decharge: r.dechargePar || '—' })),
        onRowClick: x => M.go('reception', { tab: 'controle', id: x.id }), empty: 'Aucune palette à contrôler : le sas est vide.', maxHeight: '300px',
        tone: x => (params.id === x.id ? 'info' : attente(x.r) > 2 * Hc * 3600e3 ? 'serious' : enRetard(x.r) ? 'warning' : null),
        columns: [{ key: 'attente', label: 'En attente depuis', align: 'num', render: x => enRetard(x.r) ? ui.sev(attente(x.r) > 2 * Hc * 3600e3 ? 'serious' : 'warning', duree(x.attente)) : duree(x.attente), csv: x => duree(x.attente) },
          { key: 'id', label: 'Réception', render: x => h('span', null, x.id, x.r.orpheline ? [' ', ui.tag('réception inconnue', 'hyp')] : null), value: x => x.id + (x.r.orpheline ? ' réception inconnue' : '') }, { key: 'date', label: 'Arrivée', render: x => M.fmt.dt(x.date), value: x => x.date.getTime() }, { key: 'site', label: 'Site', hidden: M.state.site !== 'ALL' }, { key: 'bl', label: 'BL' }, { key: 'imprimeur', label: 'Imprimeur' }, { key: 'nb', label: 'Affiches', align: 'num' }, { key: 'qte', label: 'Qté du BL', align: 'num' }, { key: 'decharge', label: 'Déchargé par' }],
        rowActions: x => (params.id === x.id ? h('span', { class: 'small muted nowrap' }, 'ouverte ci-dessous') : ui.btn('Contrôler', () => M.go('reception', { tab: 'controle', id: x.id }), { small: true, primary: true })) }) })];
  }

  /** Contrôle d'une palette (19/10). 21/10 : sous le sas, sur la même page que l'arrivée. Une réception inconnue rattachée par la
      Coordination arrive aussi dans le sas (o.inconnue) : la réception y corrige les informations saisies, valide le contrôle, et la
      feuille définitive s'imprime à la place de la temporaire.
      o.fermer : bouton qui referme le contrôle (retour au sas). Renvoie l'élément à placer dans la page. */
  function controlePalette(rec, o) {
    o = o || {};
    const P = M.PARAMS;
    const fait = rec.statut !== 'A_CONTROLER';
    const st = R.ctrl[rec.id] = R.ctrl[rec.id] || { lignes: {}, controleur: '' };
    const tampon = a => a.allee === 'Z' || a.allee === P.alleeInconnues;
    const lignes = C.lignesReception(rec).map(l => {
      const a = affiche(l.afficheId);
      // Emplacement à saisir : vide tant que l'affiche est en zone tampon (sas, ou allée des réceptions inconnues)
      const x = st.lignes[a.id] = st.lignes[a.id] || { compte: l.qte, allee: tampon(a) ? '' : a.allee, rayon: tampon(a) ? '' : a.rayon, rebut: 0, nc: '', surplus: false };
      // Visuel de la ligne du BL (une affiche peut servir plusieurs visuels : celui du complément, sinon le premier)
      const t = l.themeId ? C.theme(l.themeId) : a.alloc[0] ? C.theme(a.alloc[0].themeId) : null;
      return { l, a, x, t, d: t ? C.dossier(t.dossierId) : null };
    });
    /** Surplus au-delà de l'attendu, entretien compris, si l'on retient la quantité comptée (cas des « CG », FIX-09). */
    const surplusDe = r => (r.t ? Math.max(0, C.recu(r.t.id) - r.l.qte + Number(r.x.compte || 0) - r.t.qteEnt) : 0);
    const valider = () => {
      if (!st.controleur) { ui.toast('Le nom du contrôleur est obligatoire (REC-12).', 'critical'); return; }
      if (lignes.some(r => !String(r.x.allee).trim() || !String(r.x.rayon).trim())) { ui.toast('Allée et rayon sont obligatoires pour chaque affiche.', 'critical'); return; }
      M.tick(4);
      const D = M.data, nc = [];
      lignes.forEach(r => {
        const { a, x, l } = r;
        const compte = Math.max(0, Number(x.compte) || 0), diff = compte - l.qte;
        if (diff) {
          const al = (r.t && a.alloc.find(y => y.themeId === r.t.id)) || a.alloc[0]; if (al) al.qte = Math.max(0, al.qte + diff);
          a.qteRecue = Math.max(0, a.qteRecue + diff);
          D.mouvements.push({ id: M.uid('MV'), date: new Date(M.NOW), afficheId: a.id, type: 'Contrôle (écart au BL)', qte: diff, user: st.controleur, auto: false, motif: rec.id });
        }
        a.allee = String(x.allee).trim().toUpperCase(); a.rayon = String(x.rayon).trim();
        const rb = Math.max(0, Number(x.rebut) || 0);
        if (rb) { a.rebut = (a.rebut || 0) + rb; D.mouvements.push({ id: M.uid('MV'), date: new Date(M.NOW), afficheId: a.id, type: 'Mise au rebut', qte: -rb, user: st.controleur, auto: false, motif: x.nc || 'Contrôle réception' }); }
        if (x.nc) { nc.push(a.id); a.historique.push({ date: new Date(M.NOW), user: st.controleur, action: 'Non-conformité : ' + x.nc + ' (à ouvrir dans l’appli Process Métier)' }); }
        const sp = x.surplus ? surplusDe(r) : 0;
        if (sp) { a.surplusEntretien = (a.surplusEntretien || 0) + sp; a.historique.push({ date: new Date(M.NOW), user: st.controleur, action: 'Surplus de ' + sp + ' affiche(s) compté en entretien' }); }
        a.enAttenteControle = false; a.controleur = st.controleur;
        if (o.inconnue && st.imprimeur) a.imprimeur = st.imprimeur;
        a.historique.push({ date: new Date(M.NOW), user: st.controleur, action: 'Contrôle ' + rec.id + ' : ' + compte + ' comptée(s) pour ' + l.qte + (o.inconnue ? ' saisie(s) à la réception' : ' au BL') + ', rangée en ' + a.allee + '-' + a.rayon });
      });
      if (o.inconnue && st.imprimeur) rec.imprimeur = st.imprimeur;
      rec.statut = 'CONTROLEE'; rec.controle = { date: new Date(M.NOW), controleur: st.controleur }; rec.controleur = st.controleur;
      delete R.ctrl[rec.id];
      C.recalculer();
      M.journal(rec.id, 'Contrôle fait : ' + lignes.length + ' affiche(s)' + (nc.length ? ', non-conformité sur ' + nc.join(', ') : '') + (o.inconnue ? ' (réception inconnue rattachée)' : ''), rec.controleur);
      M.refresh();
      // Dossier connu : la feuille est définitive (le tableau des dossiers est rempli)
      ui.printFeuilles(lignes.map(r => r.a), 'Contrôle de la réception ' + rec.id + ' : feuilles de stock définitives' + (o.inconnue ? ' (à la place de la temporaire)' : ''), { rack: true });
    };
    const champ = (r, k, lab, w, ph) => ui.input({ value: r.x[k], placeholder: ph, label: lab + ' · ' + r.a.id, style: { width: w, minWidth: '0' }, onChange: v => { r.x[k] = v; } });
    const qteRef = o.inconnue ? 'Qté saisie' : 'Qté du BL';
    return h('div', { class: 'cz-controle', id: 'controle-' + rec.id },
      h('h3', { class: 'cz-controle-titre' }, (o.inconnue ? 'Contrôle et feuille définitive · réception ' : 'Contrôle de la palette · réception ') + rec.id),
      h('div', { class: 'row', style: { marginBottom: '10px' } },
        o.fermer ? ui.btn('Fermer le contrôle', () => M.go('reception', { tab: 'controle' }), { small: true, ghost: true, icon: 'arrow-back-up', title: 'Revenir à la liste du sas' }) : null,
        ui.tag(C.site(rec.site).label), ui.tag('BL ' + rec.bl), ui.tag(rec.imprimeur), ui.tag(rec.nbColis + ' colis / palette(s)'),
        rec.orpheline ? ui.tag('réception inconnue, rattachée', 'hyp') : null,
        rec.dechargePar ? ui.tag('Déchargée par ' + rec.dechargePar) : null,
        rec.photoBL ? ui.btn('Voir le BL', () => voirBL(rec), { small: true, ghost: true, icon: 'photo' }) : null,
        h('span', { class: 'spacer' }),
        fait ? ui.sev('good', 'Contrôlée' + (rec.controle ? ' le ' + M.fmt.dt(rec.controle.date) + ' par ' + rec.controle.controleur : '')) : ui.sev('warning', 'À contrôler')),
      ui.annot(o.inconnue
        ? 'Réception inconnue rattachée (21/10) : on vérifie et corrige ce qui a été saisi à la réception (quantité comptée, imprimeur), on range l’affiche hors de la zone tampon (allée / rayon définitifs), puis on valide : la feuille de stock définitive s’imprime et remplace la temporaire.'
        : 'Comme « Modifier une affiche » dans Circé, mais pour toute la palette : quantité comptée (celle du BL par défaut ; comptage par morceau sous ' + P.comptageMorceau + ' affiches, paramétrable), allée et rayon, rebut, non-conformité. Plus d’affiches qu’attendu : le surplus peut être compté en entretien.', ['REC-27', 'REC-03', 'REC-08', 'REC-16', 'FIX-09', 'REC-12', 'REC-17']),
      ui.card({ flush: true, body: h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
        h('thead', null, h('tr', null, ['N° affiche', 'Visuel', qteRef, 'Qté comptée', 'Allée', 'Rayon', 'Rebut · non-conformité', 'Surplus'].map(x => h('th', null, x)))),
        h('tbody', null, lignes.map(r => {
          const diff = (Number(r.x.compte) || 0) - r.l.qte, sp = surplusDe(r), morceau = (Number(r.x.compte) || 0) < P.comptageMorceau;
          const fort = r.l.qte && Math.abs(diff) / r.l.qte > P.ecartReception;
          return h('tr', { class: fort ? 'cz-tone-serious' : '' },
            h('td', { class: 'mono' }, r.a.id, r.l.complement ? h('div', null, ui.tag('complément', 'hyp')) : null),
            h('td', null, r.t ? h('span', null, ui.btnVisuel(r.t), h('b', null, r.d.annonceur), h('div', { class: 'small muted' }, r.t.libelle + ' · dossier ' + r.d.id + ' · ' + r.d.format)) : h('span', null, r.a.annonceurSaisi + ' · ' + r.a.libelleSaisi, ' ', ui.tag('orpheline', 'hyp'))),
            h('td', { class: 'num' }, r.l.qte),
            h('td', null, fait ? h('b', null, r.a.qteRecue) : ui.input({ type: 'number', value: r.x.compte, min: 0, label: 'Quantité comptée · ' + r.a.id, style: { width: '76px', minWidth: '0' }, onChange: v => { r.x.compte = v; M.refresh(); } }),
              diff ? h('div', null, ui.sev(fort ? 'serious' : 'info', M.fmt.signed(diff) + (o.inconnue ? ' par rapport à la saisie' : ' par rapport au BL'))) : null,
              !fait && morceau ? h('div', { class: 'small muted' }, 'Comptage par morceau' + (/^8 m²/.test(r.a.format) ? ' (4 morceaux par affiche)' : '')) : null),
            h('td', null, fait ? r.a.allee : [champ(r, 'allee', 'Allée', '64px', 'A-F'), r.a.allee === P.alleeInconnues ? h('div', { class: 'small muted nowrap' }, 'aujourd’hui ' + r.a.allee + '-' + r.a.rayon) : null]),
            h('td', null, fait ? r.a.rayon : champ(r, 'rayon', 'Rayon', '72px', '1-12')),
            h('td', null, fait ? (r.a.rebut ? ui.sev('serious', r.a.rebut + ' au rebut') : '—') : h('div', { class: 'stack', style: { gap: '4px' } },
              ui.input({ type: 'number', value: r.x.rebut, min: 0, label: 'Rebut · ' + r.a.id, style: { width: '64px', minWidth: '0' }, onChange: v => { r.x.rebut = v; } }),
              ui.select({ value: r.x.nc, label: 'Non-conformité · ' + r.a.id, options: [{ value: '', label: 'Conforme' }, 'Visuel non conforme', 'Quantité', 'Affiche abîmée', 'Bandeau manquant', 'Autre'], onChange: v => { r.x.nc = v; } }))),
            h('td', null, fait ? (r.a.surplusEntretien ? '+' + r.a.surplusEntretien + ' en entretien' : '—') : sp ? ui.checkbox('+' + sp + ' en entretien', r.x.surplus, v => { r.x.surplus = v; }) : h('span', { class: 'small muted' }, '—')));
        })))) }),
      // Contrôlée mais feuille définitive pas encore imprimée (aperçu fermé sans imprimer) : le bouton passe au premier plan
      fait ? h('div', { class: 'row mt' }, lignes.some(r => definitiveAFaire(r.a))
        ? ui.btn('Imprimer la feuille définitive', () => ui.printFeuilles(lignes.map(r => r.a), 'Réception ' + rec.id + ' : feuilles de stock définitives (à la place de la temporaire)', { rack: true }), { primary: true })
        : ui.btn('Réimprimer les feuilles de stock', () => ui.printFeuilles(lignes.map(r => r.a), 'Réception ' + rec.id + ' : feuilles de stock', { rack: true }), { small: true }))
        : h('div', { class: 'row mt', style: { alignItems: 'flex-end' } },
          o.inconnue ? ui.field('Imprimeur', ui.select({ value: st.imprimeur || (rec.imprimeur !== '—' ? rec.imprimeur : ''), label: 'Imprimeur (à corriger si besoin)', options: liste(M.ref.imprimeurs, st.imprimeur || (rec.imprimeur !== '—' ? rec.imprimeur : '')), onChange: v => { st.imprimeur = v; } })) : null,
          ui.field('Contrôleur (obligatoire)', ui.select({ value: st.controleur, label: 'Contrôleur', options: liste(M.ref.controleurs, st.controleur), onChange: v => { st.controleur = v; } })),
          ui.btn(o.inconnue ? 'Valider le contrôle et imprimer la feuille définitive' : 'Valider le contrôle et imprimer', valider, { primary: true }),
          h('span', { class: 'small muted' }, 'Non-conformité : à ouvrir dans l’appli Process Métier (lien à cadrer).')));
  }
  ui.controlePalette = controlePalette;

  /* ---------- Orpheline (réception sans référence) ---------- */
  /** Réception inconnue (BL sans contrat ni DA ; « orpheline » dans Circé) : un circuit à part (21/10). L'agent remplit ce qu'il
      connaît (annonceur lu, description du thème, imprimeur, quantité, format) et range l'affiche dans l'allée des réceptions
      inconnues (zone tampon, paramétrable), au rayon qu'il choisit. Circé imprime une feuille de stock TEMPORAIRE et lève
      l'alerte « Réception inconnue à identifier » pour la Coordination. La réception est « à identifier » : elle n'entre pas dans le
      sas. Dans « Réceptions inconnues », on trouve le dossier (par le visuel, sinon par n° de dossier), on rattache ; la palette
      est alors à contrôler : on corrige les informations, on valide le contrôle, la feuille DÉFINITIVE s'imprime. Sans IP,
      l'intitulé déjà saisi par l'autre plateforme pour cet annonceur est proposé (« le 1er qui a parlé », REC-18). */
  function orphelineForm(pre) {
    const p = pre || {};
    const f = { site: p.site || (M.state.site === 'NIM' ? 'NIM' : 'WIS'), annonceur: p.annonceur || '', theme: p.theme || '', format: p.format || '2 m² scrolling', qte: p.qte || 20,
      imprimeur: R.form.imprimeur || '', allee: M.PARAMS.alleeInconnues, rayon: '' };
    const themeInput = ui.input({ value: f.theme, label: 'Thème ou description', onInput: v => { f.theme = v; } });
    const sugg = h('div');
    const majSugg = () => {
      const q = norm(f.annonceur);
      const vus = q.length < 3 ? [] : M.data.affiches.filter(a => a.site !== f.site && !provisoire(a.libelleSaisi) && norm(a.annonceurSaisi).includes(q) && (a.statut === 'ORPHELINE' || !C.dossierOfAffiche(a) || !C.dossierOfAffiche(a).ipSaisies));
      const libs = M.uniq(vus.map(a => a.libelleSaisi)).slice(0, 4);
      M.mount(sugg, libs.length ? h('div', { class: 'small', style: { marginTop: '4px' } }, h('div', { class: 'muted' }, 'Déjà saisi par l’autre plateforme pour cet annonceur (« le 1er qui a parlé ») :'),
        h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', marginTop: '4px' } }, libs.map(lib => { const a = vus.find(x => x.libelleSaisi === lib); return ui.btn('« ' + lib + ' » (' + C.site(a.site).label + ', ' + a.id + ')', () => { f.theme = lib; themeInput.value = lib; }, { small: true, ghost: true }); }))) : null);
    };
    majSugg();
    // Le BL est photographié dans tous les cas (19/10), sauf palette arrivée sans BL
    const boiteBL = h('div');
    const majBoiteBL = () => M.mount(boiteBL, R.bl ? h('b', null, 'BL ' + R.bl.num + ' photographié, joint') : f.photoBL ? h('b', null, 'Photo du BL jointe')
      : [ui.btn('Photographier le BL', () => { f.photoBL = true; majBoiteBL(); }, { small: true, icon: 'scan' }), h('div', { class: 'small muted' }, 'À joindre dans tous les cas, sauf palette arrivée sans BL')]);
    majBoiteBL();
    ui.modal({ title: 'Réception inconnue', body: [
      ui.annot('À utiliser quand le BL ne porte ni n° de dossier ni n° de DA (62 % des réceptions en 2024), et que rien n’est reconnu. Circuit à part (21/10) : on remplit ce qu’on connaît, on range l’affiche dans l’allée des réceptions inconnues (zone tampon, ' + M.PARAMS.alleeInconnues + ' par défaut, paramétrable). Circé imprime une feuille de stock temporaire et alerte la Coordination. Dans « Réceptions inconnues », on trouve le dossier (par le visuel, sinon par n° de dossier ; personne ne le retrouve : un bouton alerte la Coordination) et on rattache ; la palette passe alors à l’étape 2 : la réception corrige les informations, valide le contrôle, et la feuille définitive s’imprime. Sans IP, l’intitulé déjà saisi par l’autre plateforme est proposé.', ['REC-17', 'REC-18', 'PROC-04', 'REC-02']),
      h('div', { class: 'grid cols-2' },
        ui.field('Site', ui.select({ value: f.site, options: [{ value: 'NIM', label: 'Nîmes' }, { value: 'WIS', label: 'Wissous' }], onChange: v => { f.site = v; majSugg(); } })),
        ui.field('Format', ui.select({ value: f.format, options: M.uniq(M.ref.ateliers.flatMap(a => a.formats).concat([f.format])), onChange: v => { f.format = v; } })),
        ui.field('Annonceur lu sur l’affiche', ui.input({ value: f.annonceur, label: 'Annonceur lu sur l’affiche', onInput: v => { f.annonceur = v; majSugg(); } })),
        ui.field('Thème ou description', h('div', null, themeInput, sugg)),
        ui.field('Imprimeur', ui.select({ value: f.imprimeur, label: 'Imprimeur', options: liste(M.ref.imprimeurs, f.imprimeur), onChange: v => { f.imprimeur = v; } })),
        ui.field('Quantité comptée', ui.input({ type: 'number', value: f.qte, min: 1, onChange: v => { f.qte = Number(v); } })),
        ui.field('Allée (zone tampon des réceptions inconnues)', ui.input({ value: f.allee, label: 'Allée', style: { width: '90px', minWidth: '0' }, onChange: v => { f.allee = v; } })),
        ui.field('Rayon (obligatoire)', ui.input({ value: f.rayon, label: 'Rayon', placeholder: '1-12', style: { width: '90px', minWidth: '0' }, onChange: v => { f.rayon = v; } })),
        ui.field('Photo de l’affiche', ui.btn('Prendre une photo (simulation)', () => ui.toast('Photo enregistrée.'), { small: true, icon: 'photo' })),
        ui.field('Photo du BL', boiteBL)),
    ], actions: [{ label: 'Annuler' }, { label: 'Créer, ranger et imprimer la feuille temporaire', primary: true, onClick: () => {
      const allee = String(f.allee || '').trim().toUpperCase(), rayon = String(f.rayon || '').trim();
      if (!allee || !rayon) { ui.toast('Allée et rayon sont obligatoires : ils sont imprimés sur la feuille temporaire.', 'critical'); return true; }
      if (!(Number(f.qte) > 0)) { ui.toast('Indiquez la quantité comptée.', 'critical'); return true; }
      const D = M.data; M.tick(4);
      const qui = R.form.dechargePar || user();
      // « À identifier » : hors du sas tant que la Coordination n'a pas rattaché l'affiche ; le contrôle vient après le rattachement
      const rec = { id: 'R' + (260900 + D.receptions.length), site: f.site, date: new Date(M.NOW), bl: R.form.bl || '—', transporteur: R.form.transporteur || 'Livraison imprimeur', imprimeur: f.imprimeur || '—', nbColis: 1, dechargePar: qui, controleur: null, affiches: [], lignes: [], statut: 'A_IDENTIFIER', photoBL: !!R.bl || !!f.photoBL, ordre: D.receptions.length + 1, orpheline: true };
      const af = { id: String(712900 + D.affiches.length), receptionId: rec.id, receptions: [rec.id], site: f.site, date: new Date(M.NOW), statut: 'ORPHELINE', qteBL: Number(f.qte), qteRecue: Number(f.qte), alloc: [], annonceurSaisi: f.annonceur || 'Non lisible', libelleSaisi: f.theme || 'à décrire', format: f.format, imprimeur: rec.imprimeur, allee, rayon, rebut: 0, aConserver: false, semaines: [], controleur: null, enAttenteControle: true, feuilleImprimee: 'TEMPORAIRE', feuilleImprimeeLe: new Date(M.NOW),
        historique: [{ date: new Date(M.NOW), user: qui, action: 'Réception inconnue ' + rec.id + ' : ' + f.qte + ' affiche(s) comptée(s), rangée en ' + allee + '-' + rayon + ' (zone tampon) ; feuille de stock temporaire ; à identifier par la Coordination' }] };
      rec.affiches.push(af.id); rec.lignes.push({ afficheId: af.id, qte: af.qteRecue }); D.receptions.push(rec); D.affiches.push(af);
      D.mouvements.push({ id: M.uid('MV'), date: af.date, afficheId: af.id, type: 'Réception', qte: af.qteRecue, user: qui, auto: false });
      C.recalculer(); M.journal(af.id, 'Réception inconnue créée : rangée en ' + allee + '-' + rayon + ', feuille temporaire, alerte à la Coordination', qui);
      M.refresh();
      ui.toast('Réception inconnue ' + rec.id + ' : affiche ' + af.id + ' rangée en ' + allee + '-' + rayon + '. La Coordination est prévenue (Pilotage › Alertes).', 'good');
      setTimeout(() => ui.printFeuilles([af], 'Réception inconnue ' + rec.id + ' : feuille de stock temporaire'), 0);
    } }] });
  }

  /* ---------- Liste des affiches ---------- */
  /** Tags d'une affiche (19/10) : ce qui reste à faire sur elle ou ce qu'il faut savoir ; filtrables. Le tag « Feuille à refaire »
      remplace l'ancienne page « Thèmes modifiés » (REC-06). */
  const TAGS = { controle: 'À contrôler', orpheline: 'Orpheline', complement: 'Complément', refaire: 'Feuille à refaire' };
  /** Feuille temporaire posée sur une affiche désormais rattachée : la définitive est à imprimer (21/10). */
  const definitiveAFaire = a => a.alloc.length > 0 && a.feuilleImprimee === 'TEMPORAIRE';
  const themeAFaire = a => !!(a.themeModif && !a.themeModif.reimprime);
  const tagsDe = a => [a.enAttenteControle ? 'controle' : null, a.statut === 'ORPHELINE' ? 'orpheline' : null,
    M.uniq((a.receptions || []).concat(a.receptionId ? [a.receptionId] : [])).length > 1 ? 'complement' : null,
    themeAFaire(a) || definitiveAFaire(a) ? 'refaire' : null].filter(Boolean);
  // « Orpheline » n'a pas de badge : la pastille de statut le dit déjà
  const tagVue = (k, a) => k === 'controle' ? ui.sev('warning', TAGS[k])
    : k === 'refaire' ? h('span', { title: definitiveAFaire(a) ? 'Réception inconnue rattachée par la Coordination : remplacer la feuille temporaire par la feuille définitive' : 'Ancien intitulé : « ' + a.themeModif.ancien + ' » ; nouveau : « ' + a.themeModif.nouveau + ' » (' + a.themeModif.origine + ')' }, ui.sev('warning', definitiveAFaire(a) ? 'Feuille définitive à imprimer' : TAGS[k]))
    : k === 'complement' ? ui.tag(TAGS[k], 'hyp') : null;
  /** Feuilles à refaire, en lot : après un changement de thème (REC-06), ou feuille temporaire d'une réception inconnue rattachée
      (21/10). Les affiches encore dans la zone tampon des réceptions inconnues peuvent être rangées d'abord : leur nouvel
      emplacement est imprimé sur la feuille définitive. L'impression lève le tag. */
  function refaireFeuilles(rows) {
    const as = rows.map(r => r.a), zone = M.PARAMS.alleeInconnues;
    const themes = as.filter(themeAFaire); // changement de thème en attente : noté dans l'historique une fois la feuille imprimée
    const imprimer = () => ui.printFeuilles(as, 'Feuilles de stock à refaire : ' + as.length + ' définitive(s)', { onPrint: () => {
      themes.forEach(a => a.historique.push({ date: new Date(M.NOW), user: user(), action: 'Feuille de stock refaite : « ' + a.themeModif.ancien + ' » → « ' + a.themeModif.nouveau + ' »' }));
    } });
    const aRanger = as.filter(a => a.allee === zone);
    if (!aRanger.length) { imprimer(); return; }
    const saisie = new Map(aRanger.map(a => [a.id, { allee: '', rayon: '' }]));
    ui.modal({ title: 'Ranger avant d’imprimer : ' + aRanger.length + ' affiche(s) en zone tampon', body: [
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Ces affiches de réceptions inconnues sont encore dans l’allée ' + zone + ' (zone tampon). Indiquez leur emplacement définitif : il sera imprimé sur la feuille définitive. Laissez vide pour les laisser en ' + zone + '.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
        h('thead', null, h('tr', null, ['N° affiche', 'Visuel', 'Aujourd’hui', 'Allée', 'Rayon'].map(x => h('th', null, x)))),
        h('tbody', null, aRanger.map(a => { const s = saisie.get(a.id), d = C.dossierOfAffiche(a);
          return h('tr', null, h('td', { class: 'mono' }, a.id), h('td', null, (d ? d.annonceur : a.annonceurSaisi) + ' · ' + a.libelleSaisi), h('td', null, a.allee + '-' + a.rayon),
            h('td', null, ui.input({ value: s.allee, placeholder: 'A-F', label: 'Allée · ' + a.id, style: { width: '64px', minWidth: '0' }, onChange: v => { s.allee = v; } })),
            h('td', null, ui.input({ value: s.rayon, placeholder: '1-12', label: 'Rayon · ' + a.id, style: { width: '72px', minWidth: '0' }, onChange: v => { s.rayon = v; } }))); }))))],
      actions: [{ label: 'Annuler' }, { label: 'Ranger et voir les feuilles', primary: true, onClick: () => {
        aRanger.forEach(a => { const s = saisie.get(a.id), al = String(s.allee).trim().toUpperCase(), ra = String(s.rayon).trim();
          if (al && ra) { a.historique.push({ date: new Date(M.NOW), user: user(), action: 'Rangée : ' + a.allee + '-' + a.rayon + ' → ' + al + '-' + ra + ' (sortie de la zone tampon)' }); a.allee = al; a.rayon = ra; } });
        setTimeout(imprimer, 0);
      } }] });
  }
  function tabAffiches(root, params) {
    const D = M.data;
    let rows = D.affiches.filter(a => M.state.site === 'ALL' || a.site === M.state.site);
    if (params.recent === '1') rows = rows.filter(a => a.date > new Date(M.NOW.getTime() - 864e5));
    rows = rows.map(a => {
      const ths = a.alloc.map(x => C.theme(x.themeId));
      const ds = M.uniq(ths.map(t => t.dossierId));
      return { id: a.id, a, recep: a.receptionId, date: a.date, site: C.site(a.site).label, annonceur: ths[0] ? C.dossier(ths[0].dossierId).annonceur : a.annonceurSaisi, theme: ths[0] ? ths[0].libelle : a.libelleSaisi,
        dossiers: ds.join(', '), nbDossiers: ds.length, semaines: (a.semaines || []).map(s => 'S' + s).join('+'), format: a.format, imprimeur: a.imprimeur, recu: a.qteRecue, dispo: C.stockDispo(a), rebut: a.rebut, empl: a.allee + '-' + a.rayon, statut: a.statut, controleur: a.controleur || '—', tags: tagsDe(a) };
    });
    // Filtres : N° de dossier, Départ (une affiche sans semaine, orpheline par exemple, reste visible), Tag, Format ; Imprimeur par « + Filtre ».
    // Un lien peut poser le tag (?tag=refaire : alerte « Feuille de stock à refaire »)
    const FF = ui.filters({ id: 'reception-affiches', rows, preset: params.tag ? { tag: [params.tag] } : null, defs: [
      ui.dossierFilter(rows, r => C.dossiersOfAffiche(r.a)),
      Object.assign(ui.weekFilter([], r => r.a.semaines || []), { matchEmpty: true }),
      { key: 'tag', label: 'Tag', options: Object.entries(TAGS).map(([value, label]) => ({ value, label })), get: r => r.tags },
      { key: 'format', label: 'Format', options: opts(rows.map(r => r.format)), get: r => r.format },
      { key: 'imprimeur', label: 'Imprimeur', more: true, options: opts(rows.map(r => r.imprimeur)), get: r => r.imprimeur },
    ] });
    rows = FF.apply(rows);
    root.append(
      ui.annot('Ce qu’on a reçu (les réceptions attendues, c’est ce qu’on attend). Liste réunie avec la réception : n° de réception cliquable, emplacement, imprimeur, rebut mis en évidence ; feuilles de stock et étiquettes rack en lot. Tags : « À contrôler » (palette pas encore contrôlée, en zone tampon), « Complément » (livrée en plusieurs fois, même n°), « Feuille à refaire » (thème changé après l’identification : on la réimprime d’ici).', ['REC-03', 'REC-02', 'REC-06', 'REC-07', 'REC-08', 'REC-11', 'REC-22', 'ERG-03', 'ANO-01']),
      FF.bar,
      ui.card({ flush: true, body: ui.table({
        id: 'recep-affiches', rows, query: params.q, selectable: true, exportName: 'liste-affiches.csv', sort: { key: 'date', dir: 'desc' },
        tone: r => r.statut === 'ORPHELINE' ? 'warning' : r.rebut ? 'serious' : null, onRowClick: r => ui.afficheModal(r.a),
        bulkActions: (sel, clear) => {
          const aRefaire = sel.filter(r => r.tags.includes('refaire'));
          return [
            aRefaire.length ? ui.btn('Réimprimer les feuilles à refaire (' + aRefaire.length + ')', () => { clear(); refaireFeuilles(aRefaire); }, { small: true, primary: true }) : null,
            ui.btn('Imprimer les feuilles de stock', () => ui.printFeuilles(sel.map(r => r.a)), { small: true, primary: !aRefaire.length }),
            ui.btn('Étiquettes rack', () => { M.journal(sel.map(r => r.id).join(', '), 'Étiquettes rack imprimées'); ui.toast(sel.length + ' étiquette(s) rack imprimée(s) en un clic.', 'good'); }, { small: true }),
          ].filter(Boolean);
        },
        columns: [
          { key: 'id', label: 'N° affiche', nowrap: true },
          { key: 'date', label: 'Reçue le', render: r => M.fmt.dt(r.date), value: r => r.date.getTime() },
          ui.colVisuel(),
          { key: 'dossiers', label: 'Dossier(s)', render: r => h('span', null, r.dossiers || '—', r.nbDossiers > 1 ? [' ', ui.tag(r.nbDossiers + ' dossiers')] : null) },
          { key: 'semaines', label: 'Départ', render: r => h('span', null, r.semaines || '—', r.semaines.includes('+') ? [' ', ui.tag('multi-semaines', 'hyp')] : null) },
          { key: 'dispo', label: 'En stock', align: 'num', title: 'Le rebut est signalé à côté du stock (REC-11)', render: r => h('span', null, r.rebut ? [ui.sev('serious', r.rebut + ' rebut'), ' '] : null, M.fmt.n(r.dispo)) },
          { key: 'empl', label: 'Emplacement', value: r => ui.withSite(r.empl, r.a.site) },
          { key: 'statut', label: 'Statut · tags', render: r => h('span', { class: 'cz-status-stack' }, ui.pill(r.statut), r.tags.map(k => tagVue(k, r.a))),
            value: r => [(M.STATUTS[r.statut] || { label: r.statut }).label].concat(r.tags.filter(k => k !== 'orpheline').map(k => TAGS[k])).join(' · ') },
          { key: 'recep', label: 'Réception', hidden: true, render: r => h('button', { class: 'linkish', onclick: e => { e.stopPropagation(); ui.receptionModal(M.data.receptions.find(x => x.id === r.recep)); } }, r.recep) },
          { key: 'site', label: 'Site', hidden: true },
          { key: 'annonceur', label: 'Annonceur', hidden: true }, { key: 'theme', label: 'Thème', hidden: true },
          { key: 'format', label: 'Format', hidden: true },
          { key: 'imprimeur', label: 'Imprimeur', hidden: true },
          { key: 'recu', label: 'Reçu', align: 'num', hidden: true },
          { key: 'rebut', label: 'Rebut', align: 'num', hidden: true },
          { key: 'controleur', label: 'Contrôleur', hidden: true },
          { key: 'feuille', label: 'Feuille de stock', hidden: true, value: r => (definitiveAFaire(r.a) ? 'Temporaire : définitive à imprimer' : typeFeuille(r.a) === 'TEMPORAIRE' ? 'Temporaire' : 'Définitive') },
        ],
      }) }));
  }

  M.screen({
    id: 'reception', title: 'Réception et affiches', icon: '⇩', nav: 'Réception & affiches', roles: ['recep', 'coord', 'cheq', 'com'], vueDefaut: 'attendues',
    needs: ['REC-02', 'REC-03', 'REC-04', 'REC-05', 'REC-06', 'REC-07', 'REC-08', 'REC-09', 'REC-11', 'REC-12', 'REC-13', 'REC-14', 'REC-16', 'REC-17', 'REC-18', 'REC-22', 'REC-25', 'REC-27', 'FIX-09', 'PP-02', 'ANO-05', 'ANO-11', 'ANO-12', 'ANO-15', 'ANO-08', 'ANO-01', 'CIB-05', 'CIB-07', 'PROC-04', 'PROC-07', 'ERG-01', 'ERG-03', 'ERG-05', 'ERG-06', 'ERG-08', 'ERG-09', 'ERG-10'],
    asis: ['Réception des affiches : panier, « Ouvrir réception », n° d’affiche recopié à la main sur le BL, BL scanné en fin de saisie (S19)', 'Contrôle : dans la Liste des affiches, recherche à la main du n° d’affiche noté sur le BL, puis « Modifier une affiche », une affiche à la fois (S20)', 'Impression des feuilles de stock affiche par affiche, 3 clics chacune (S22, S63 #2)', '« Affiche reçue » mise à jour seulement par la validation admin (S32 ; code : BatchAlimReceptionBll.cs:89)', 'Champ « Déchargé par » libre et facultatif, aucun champ contrôleur (code : CreationLivraisonView.cshtml:68-70)'],
    badge: () => { const n = C.receptionsAControler().length; return { n, title: 'Palettes à contrôler' }; },
    render(root, params) {
      // Réception des affiches : une page par étape (19/10), avec en tête le repère des deux étapes ; Liste des affiches à part.
      // « saisie » (ancienne vue « Ouvrir réception ») mène à l'étape 1.
      const VUES = {
        attendues: ['Réception des affiches', 'Étape 1 · arrivée de la palette : trouvez les dossiers du BL (photo du BL, photo d’une affiche ou n° de dossier), cochez les lignes du BL, vérifiez le bon de livraison, validez.'],
        controle: ['Réception des affiches', 'Étape 2 · contrôle des affiches : le sas des palettes arrivées. Ouvrez la plus ancienne, comptez, rangez (allée / rayon), puis imprimez les feuilles de stock.'],
        affiches: ['Liste des affiches', 'Ce qu’on a reçu : chaque affiche, avec sa réception, son emplacement, son stock et ses tags. Feuilles de stock et étiquettes rack en lot.'],
      };
      const tab = params.tab === 'saisie' ? 'attendues' : VUES[params.tab] ? params.tab : 'attendues';
      // Les deux étapes sur une seule page (21/10) : l'intro porte le repère de l'étape 1 ; celui de l'étape 2 est sous le panier et
      // le bon de livraison. ?tab=controle ouvre la même page à l'étape 2. La Liste des affiches garde sa phrase.
      root.append(ui.pageHead({ crumb: 'Réception', title: VUES[tab][0], screen: 'reception', sub: tab === 'affiches' ? VUES[tab][1] : null,
        intro: tab === 'affiches' ? null : etapeTitre(1) }));
      if (tab === 'affiches') tabAffiches(root, params); else tabReception(root, params);
    },
  });
})();
