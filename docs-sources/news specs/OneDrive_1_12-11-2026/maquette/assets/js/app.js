/* ==========================================================================
   Circé — maquette cible : événements de démonstration et démarrage
   ========================================================================== */
(function () {
  'use strict';
  const M = window.M;
  const C = M.calc;
  const siteDemo = () => (M.state.site === 'ALL' || M.state.site === 'NAN') ? 'NIM' : M.state.site;

  /** Envoie un mail simulé (boîte « Mails » de la barre du haut). */
  M.mail = function ({ to, subject, body, trigger, needs }) {
    M.data.outbox.push({ date: new Date(M.NOW), to, subject, body, trigger, needs, lu: false });
    M.ui.toast('✉ Mail envoyé : ' + subject, 'mail');
  };
  M.journal = function (objet, action, user) {
    M.data.journal.push({ date: new Date(M.NOW), user: user || M.ROLES.find(r => r.id === M.state.role).label, objet, action });
  };
  /** Avance l'horloge simulée de quelques minutes à chaque action, pour des horodatages lisibles. */
  M.tick = (min) => { M.NOW = new Date(M.NOW.getTime() + (min || 7) * 60e3); };

  /** Préparation renvoyée par Broadcast (27/10, Q60 ; option A le 02/11) : tant que les trains ne sont pas exportés, Circé refait
      l'Instruction OK (règle de Nariman) ; la validation admin ne bouge pas (elle ne dépend plus de la préparation : les affiches
      déjà confirmées le restent) ; après l'export du jeudi 14 h, les trains restent figés (« A imprimer ») et une alerte part à
      la Coordination et aux chefs d'équipe. */
  function renvoiPrepa(d) {
    if (d.statutPP === 'ANNULE') return;
    d.statutPP = 'PREPA_RECUE'; d.prepaDate = new Date(M.NOW);
    if (d.exporte) {
      M.data.events.push({ key: 'EV-RENV-' + d.id + '-' + M.NOW.getTime(), type: 'APRES_LIBERATION', sev: 'serious', site: d.site, semaine: d.semaine, date: new Date(M.NOW),
        titre: 'Préparation renvoyée après l’export des trains', message: 'Dossier ' + d.id + ' (' + d.annonceur + ') : Broadcast a renvoyé la préparation après l’export du ' + M.fmt.dt(d.exporte.date) + '. Les trains exportés ne changent pas : raccrocher à un train pas encore produit, ou produire à part.',
        link: C.lienDossier(d), needs: ['SCR-08', 'PP-06'], roles: ['coord', 'cheq'] });
    } else delete d.iok;
    C.majStatutVA(d);
  }

  M.SIMULATIONS = [
    {
      label: 'Un dossier 2 m² fixe arrive après la libération de la semaine',
      help: "REU-04 : Circé envoie un mail aux chefs d'équipe et lève une alerte.",
      run() {
        M.tick(12);
        const D = M.data, site = siteDemo();
        const atelier = site + '-F2';
        const id = String(Math.max(...D.dossiers.filter(d => !d.no).map(d => Number(d.id))) + 37);
        const d = { id, da: String(480000 + D.dossiers.length), annonceur: 'Assurances Cap', site, semaine: 43, semaines: [43], atelier, format: '2 m² fixe', entretienPct: 10, print: false, controlee: false, ipSaisies: true, prepaEnvoyee: true, prepaDate: new Date(M.NOW), statutPP: 'PREPA_RECUE', qteBC: 0, qteBCInfo: null, pole: 'Pôle Direct', themes: [], historique: [{ date: new Date(M.NOW), user: 'Broadcast', action: 'Préparation envoyée après la libération de la S43' }], apresLiberation: true };
        const th = { id: 'TH' + (D.themes.length + 900), dossierId: id, libelle: 'Protection habitat', position: 'A', exclu: null, qte: 0, qteEnt: 0, repiquage: '' };
        d.themes.push(th.id); D.dossiers.push(d); D.themes.push(th);
        M.ref.destinataires.filter(x => x.site === site).slice(0, 2).forEach((dest, k) => {
          const aff = D.afficheurs.find(a => a.dest === dest.id);
          const l = { id: 'L' + (D.lignes.length + 900), themeId: th.id, dossierId: id, site, semaine: 43, atelier, dest: dest.id, afficheur: aff.id, qte: 6 + k * 5, entretien: 0 };
          l.entretien = C.entretien(l.qte, d.entretienPct);
          D.lignes.push(l);
          D.unites.push({ id: 'UM-' + (9000 + D.unites.length), kind: 'UM', site, semaine: 43, atelier, machine: site + '-MR', dest: dest.id, afficheur: aff.id, ligneId: l.id, themeId: th.id, nb: 1, statut: 'EN_ATTENTE', bague: false, generation: null, modifs: [] });
        });
        const ls = D.lignes.filter(l => l.themeId === th.id);
        th.qte = M.sum(ls, l => l.qte); th.qteEnt = th.qte + M.sum(ls, l => l.entretien); d.qteBC = th.qte;
        const lib = D.liberations.find(l => l.atelier === atelier && l.semaine === 43);
        D.events.push({ key: 'EV-LIB-' + id, type: 'APRES_LIBERATION', sev: 'serious', site, semaine: 43, date: new Date(M.NOW), titre: 'Dossier arrivé après la libération de la semaine', message: 'Dossier ' + id + ' (Assurances Cap, 2 m² fixe) reçu de Broadcast après la libération de la S43' + (lib ? ' du ' + M.fmt.dt(lib.date) : '') + '. Mail envoyé.', link: { screen: 'unitaire', params: { type: 'fixe', atelier, q: id } }, needs: ['REU-04', 'FIX-07'], roles: ['cheq', 'coord'] });
        C.recalculer();
        // La préparation ne valide rien (option A, 02/11) : seul le statut du dossier suit les confirmations de la Coordination
        C.majStatutVA(d);
        M.journal(id, 'Préparation reçue de Broadcast après libération : alerte et mail', 'Circé');
        M.mail({ to: ["Chefs d'équipe 2 m² fixe – " + C.site(site).label, 'Coordination ' + C.site(site).label], subject: '[Circé] Nouveau dossier 2 m² fixe S43 après libération : ' + id, body: 'Le dossier ' + id + ' (Assurances Cap, thème « Protection habitat », ' + th.qteEnt + ' affiches entretien compris) est arrivé après la libération de la semaine 43.\nIl est visible dans Production › Fixe & pliage avec le repère « Arrivé après libération ».', trigger: 'Préparation Broadcast reçue après la libération de la semaine', needs: ['REU-04'] });
      },
    },
    {
      label: 'Un visuel arrive après la préparation des trains (déroulant)',
      help: 'RP34 : mail au chef d’atelier, aux admins de la plateforme et aux coordinateurs ; l’atelier raccroche le visuel ou le produit à part.',
      run() {
        M.tick(10);
        const D = M.data;
        const ok = x => x.semaine === 43 && C.atelier(x.atelier).mode === 'train' && x.statutPP === 'VALIDE';
        const d = D.dossiers.find(x => ok(x) && x.atelier.endsWith('D2') && (M.state.site === 'ALL' || x.site === M.state.site)) || D.dossiers.find(ok);
        if (!d) { M.ui.toast('Aucun dossier déroulant validé en S43 dans ce périmètre.'); return; }
        const th = { id: 'TH' + (D.themes.length + 950), dossierId: d.id, libelle: 'Offre de dernière minute', position: String.fromCharCode(65 + d.themes.length), exclu: null, qte: 0, qteEnt: 0, d8: null, repiquage: '' };
        D.themes.push(th); d.themes.push(th.id);
        d.statutPP = 'PREPA_RECUE'; d.prepaDate = new Date(M.NOW);
        d.historique.push({ date: new Date(M.NOW), user: 'Broadcast', action: 'Préparation renvoyée après la préparation des trains : nouveau visuel « ' + th.libelle + ' »' });
        const site = C.site(d.site).label;
        D.events.push({ key: 'EV-RAJ-' + th.id, type: 'APRES_LIBERATION', sev: 'serious', site: d.site, semaine: 43, date: new Date(M.NOW), titre: 'Rajout après préparation (déroulant)', message: 'Dossier ' + d.id + ' (' + d.annonceur + ') : nouveau visuel « ' + th.libelle + ' » reçu de Broadcast après la préparation des trains de la S43. À raccrocher à un train pas encore produit, ou à produire à part.', link: { screen: 'trains', params: { q: d.id } }, needs: ['REU-04', 'SCR-08'], roles: ['cheq', 'coord'] });
        C.recalculer();
        C.majStatutVA(d);
        M.journal(d.id, 'Rajout après préparation : alerte et mail à la liste de distribution', 'Circé');
        M.mail({ to: ["Chef d'atelier déroulant – " + site, 'Admins de la plateforme de ' + site, 'Coordinateurs logistique'], subject: '[Circé] Rajout après préparation (déroulant S43) : dossier ' + d.id,
          body: 'Le dossier ' + d.id + ' (' + d.annonceur + ') a reçu un nouveau visuel, « ' + th.libelle + ' », après la préparation des trains de la S43.\nPas de raccrochage automatique : raccrochez-le à un train pas encore produit (Déroulant › Liste des trains), ou produisez-le à part.',
          trigger: 'Envoi de préparation entre le jeudi soir de S-2 et le vendredi de S (RP34)', needs: ['REU-04', 'SCR-08'] });
      },
    },
    {
      label: 'Dernière minute sur un train déjà en production',
      help: 'SCR-08 : alerte critique et mail, la modification est tracée sur le train.',
      run() {
        M.tick(9);
        const D = M.data;
        const u = D.unites.find(x => x.kind === 'TRAIN' && x.semaine === 43 && x.statut === 'EN_PROD' && (M.state.site === 'ALL' || x.site === M.state.site)) || D.unites.find(x => x.kind === 'TRAIN' && x.statut === 'EN_PROD');
        if (!u) { M.ui.toast('Aucun train en production dans ce périmètre.'); return; }
        const th = C.theme(u.positions[0].themeId), d = C.dossier(th.dossierId);
        u.modifs.push({ date: new Date(M.NOW), user: 'Broadcast', action: 'Dernière minute : +1 train vers ' + C.dest(u.dest).label });
        D.events.push({ key: 'EV-DM-' + u.id + '-' + D.events.length, type: 'DM_FICHIER', sev: 'critical', site: u.site, semaine: 43, date: new Date(M.NOW), titre: 'Dernière minute sur un fichier déjà envoyé', message: 'Dossier ' + d.id + ' « ' + th.libelle + ' » : +1 train vers ' + C.dest(u.dest).label + ' alors que ' + u.id + ' est en production.', link: { screen: 'trains', params: { q: d.id } }, needs: ['SCR-08', 'CIB-03'], roles: ['cheq', 'coord'] });
        M.journal(u.id, 'Modification Broadcast après envoi du fichier : alerte DM', 'Circé');
        M.mail({ to: ["Chefs d'équipe déroulant – " + C.site(u.site).label], subject: '[Circé] Dernière minute sur un train en production : ' + d.id, body: 'Broadcast a modifié le dossier ' + d.id + ' (' + d.annonceur + ') après l’envoi du fichier de production.\nÀ traiter : fichier complémentaire ou raccrochage à un train non produit.', trigger: 'Modification Broadcast sur une unité « En production »', needs: ['SCR-08'] });
      },
    },
    {
      label: 'Une livraison arrive sans référence de dossier',
      help: 'REC-17 : une réception inconnue ; son affiche orpheline est à identifier, avec suggestions.',
      run() {
        M.tick(6);
        const D = M.data;
        const site = M.state.site === 'NIM' ? 'NIM' : 'WIS';
        const cand = D.themes.find(t => { const d = C.dossier(t.dossierId); return d.site === site && d.semaine >= 44 && d.ipSaisies && d.statutPP !== 'ANNULE' && !t.exclu && C.recu(t.id) === 0; });
        if (!cand) { M.ui.toast('Aucun visuel candidat pour une orpheline.'); return; }
        const d = C.dossier(cand.dossierId);
        // Circuit des réceptions inconnues (21/10) : comptée et rangée dans l'allée tampon, feuille de stock temporaire, alerte à la Coordination
        const allee = M.PARAMS.alleeInconnues, rayon = String(1 + (D.affiches.length % 9));
        const rec = { id: 'R' + (260900 + D.receptions.length), site, date: new Date(M.NOW), bl: '—', transporteur: 'Livraison imprimeur', imprimeur: 'Atelier Grand Format', nbColis: 2, dechargePar: 'Contrôleur B', controleur: null, affiches: [], lignes: [], statut: 'A_IDENTIFIER', ordre: D.receptions.length + 1, orpheline: true };
        const af = { id: String(712900 + D.affiches.length), receptionId: rec.id, receptions: [rec.id], site, date: new Date(M.NOW), statut: 'ORPHELINE', qteBL: cand.qteEnt || 30, qteRecue: cand.qteEnt || 30, alloc: [], annonceurSaisi: d.annonceur.split(' ')[0] + ' ?', libelleSaisi: 'visuel avec ' + cand.libelle.toLowerCase().split(' ')[0], format: d.format, imprimeur: rec.imprimeur, allee, rayon, rebut: 0, aConserver: false, semaines: [], controleur: null, enAttenteControle: true, feuilleImprimee: 'TEMPORAIRE', verite: cand.id, historique: [{ date: new Date(M.NOW), user: rec.dechargePar, action: 'Réception inconnue ' + rec.id + ' : rangée en ' + allee + '-' + rayon + ' (zone tampon), feuille de stock temporaire, affiche orpheline à identifier' }] };
        rec.affiches.push(af.id); rec.lignes.push({ afficheId: af.id, qte: af.qteRecue }); D.receptions.push(rec); D.affiches.push(af);
        D.mouvements.push({ id: M.uid('MV'), date: af.date, afficheId: af.id, type: 'Réception', qte: af.qteRecue, user: rec.dechargePar, auto: false });
        C.recalculer();
        M.journal(af.id, 'Réception inconnue créée (' + rec.id + ') : rangée en ' + allee + '-' + rayon + ', feuille temporaire', rec.dechargePar);
        M.ui.toast('Réception inconnue ' + rec.id + ' : l’affiche ' + af.id + ' est rangée en ' + allee + '-' + rayon + ' avec une feuille temporaire ; la Coordination est alertée (Réception › Réceptions inconnues).');
      },
    },
    {
      label: 'Une réception complète un visuel manquant',
      help: 'PP-02 : « affiche reçue » passe à oui dès la réception, les trains concernés deviennent « Prêt » ; Circé propose le rattachement, la Coordination le confirme (validation admin).',
      run() {
        M.tick(8);
        const D = M.data;
        const t = D.themes.find(x => { const d = C.dossier(x.dossierId); return d.semaine === 43 && d.ipSaisies && d.statutPP !== 'ANNULE' && !x.exclu && C.etatTheme(x) === 'MANQUANT' && (M.state.site === 'ALL' || d.site === M.state.site); });
        if (!t) { M.ui.toast('Aucun visuel manquant en S43 dans ce périmètre.'); return; }
        const d = C.dossier(t.dossierId);
        const before = D.unites.filter(u => u.statut === 'EN_ATTENTE').length;
        // Étape 1 (arrivée de la palette) : « affiche reçue » = oui dès l'arrivée, la palette attend le contrôle en zone tampon
        const rec = { id: 'R' + (260900 + D.receptions.length), site: d.site, date: new Date(M.NOW), bl: 'BL' + (5000000 + D.receptions.length), transporteur: 'Geodis', imprimeur: d.print ? 'Print Cityz' : 'Imprimerie du Lac', nbColis: 1, dechargePar: 'Contrôleur A', controleur: null, affiches: [], lignes: [], statut: 'A_CONTROLER', photoBL: true, ordre: D.receptions.length + 1 };
        const af = { id: String(712900 + D.affiches.length), receptionId: rec.id, receptions: [rec.id], site: d.site, date: new Date(M.NOW), statut: 'IDENTIFIEE', qteBL: t.qteEnt, qteRecue: t.qteEnt, alloc: [{ themeId: t.id, qte: t.qteEnt }], rattache: 'BL', annonceurSaisi: d.annonceur, libelleSaisi: t.libelle, format: d.format, imprimeur: rec.imprimeur, allee: 'Z', rayon: 'tampon', rebut: 0, aConserver: false, semaines: d.semaines.slice(), controleur: null, enAttenteControle: true, historique: [{ date: new Date(M.NOW), user: rec.dechargePar, action: 'Arrivée ' + rec.id + ' : ' + t.qteEnt + ' affiches (quantité du BL), palette à contrôler' }, { date: new Date(M.NOW.getTime() + 60e3), user: 'Circé', action: 'Rattachement proposé : dossier ' + d.id + ' · « ' + t.libelle + ' » (n° de dossier lu sur le BL) : à confirmer par la Coordination' }] };
        rec.affiches.push(af.id); rec.lignes.push({ afficheId: af.id, qte: af.qteRecue }); D.receptions.push(rec); D.affiches.push(af);
        D.mouvements.push({ id: M.uid('MV'), date: af.date, afficheId: af.id, type: 'Réception', qte: af.qteRecue, user: rec.dechargePar, auto: false });
        C.recalculer();
        C.majStatutVA(d);
        const after = D.unites.filter(u => u.statut === 'EN_ATTENTE').length;
        M.journal(af.id, 'Réception de « ' + t.libelle + ' » : affiche reçue = oui, ' + (before - after) + ' unité(s) passée(s) « Prêt »', rec.dechargePar);
        M.ui.toast('Réception de « ' + t.libelle + ' » (' + d.annonceur + ') : ' + (before - after) + ' unité(s) passent « Prêt à produire ». Palette ' + rec.id + ' à contrôler. Rattachement proposé au dossier ' + d.id + ' : à confirmer par la Coordination.', 'good');
      },
    },
    {
      label: 'Fin de journée Geodis',
      help: 'REU-08 : les colis clos partent, le stock est décrémenté automatiquement.',
      run() {
        M.tick(15);
        const D = M.data;
        const cs = D.colis.filter(c => c.statut === 'COLIS_CLOS' && (M.state.site === 'ALL' || c.site === M.state.site));
        if (!cs.length) { M.ui.toast('Aucun colis clos à expédier dans ce périmètre.'); return; }
        cs.forEach(c => {
          c.statut = 'EXPEDIE'; c.expedie = new Date(M.NOW); c.recepisse = String(90600000 + Math.floor(Math.random() * 1e5));
          c.unites.forEach(id => { C.unite(id).statut = 'EXPEDIE'; });
          C.sortiesExpedition(c);
        });
        M.journal('Geodis', 'Fin de journée : ' + cs.length + ' colis expédiés, sorties de stock automatiques', 'Agent d’expédition');
        M.ui.toast(cs.length + ' colis pris en charge par Geodis. Stock mis à jour automatiquement.', 'good');
      },
    },
    {
      label: 'Preuves de livraison Geodis reçues',
      help: 'Les colis expédiés passent « Livré » avec la date de preuve.',
      run() {
        M.tick(30);
        const cs = M.data.colis.filter(c => c.statut === 'EXPEDIE' && (M.state.site === 'ALL' || c.site === M.state.site));
        cs.forEach(c => { c.statut = 'LIVRE'; c.livre = new Date(M.NOW); c.unites.forEach(id => { C.unite(id).statut = 'LIVRE'; }); });
        M.ui.toast(cs.length + ' preuve(s) de livraison enregistrée(s).', 'good');
      },
    },
    {
      label: 'Broadcast change un thème après la validation (dernière minute)',
      help: 'PP-09 : Instruction OK et validation admin faites, la Pré-Prod change le thème dans Broadcast ; Circé le détecte.',
      run() {
        M.tick(15);
        const D = M.data;
        const d = D.dossiers.find(x => x.statutPP === 'VALIDE' && x.semaine === 44 && M.inScope(x, { allWeeks: true }) && x.themes.every(id => { const t = C.theme(id); return !t.libelleBC || t.libelleBC === t.libelle; }));
        if (!d) { M.ui.toast('Aucun dossier validé de S44 dans ce périmètre.'); return; }
        const t = C.theme(d.themes[0]);
        t.libelleBC = t.libelle + ' (dernière minute)';
        t.modifBC = { date: new Date(M.NOW), ancien: t.libelle };
        M.ui.toast('Broadcast : thème du dossier ' + d.id + ' changé en « ' + t.libelleBC + ' ». Circé le signale (Pilotage › Vérification des thèmes).', 'critical');
      },
    },
    {
      label: 'Broadcast renvoie les préparations corrigées (thèmes, annonceurs)',
      help: 'PP-08 : les dossiers pour lesquels un mail de correction est parti (thème, annonceur, ou demande depuis la fiche) reviennent de Broadcast corrigés.',
      run() {
        M.tick(25);
        const dem = M.data.demandesThemes || {};
        const ids = Object.keys(dem).filter(id => dem[id].statut === 'ENVOYEE');
        // Annonceurs (16/10) : le nom demandé remplace l'ancien ; un groupe dont les noms sont devenus identiques est « corrigé »
        const demA = M.data.demandesAnnonceurs || {};
        const idsA = Object.keys(demA).filter(id => demA[id].statut === 'ENVOYEE');
        // Demandes faites depuis la fiche d'un dossier (« Demander une correction à Broadcast ») : la préparation revient, à revalider
        const dosDem = M.data.dossiers.filter(d => d.demandeBC);
        dosDem.forEach(d => {
          const x = d.demandeBC; delete d.demandeBC;
          renvoiPrepa(d);
          d.historique.push({ date: new Date(M.NOW), user: 'Broadcast', action: 'Préparation renvoyée après la correction demandée le ' + M.fmt.dt(x.date) });
          M.journal(d.id, 'Préparation renvoyée par Broadcast (correction demandée)', 'Broadcast');
        });
        if (idsA.length) {
          const avant = C.groupesAnnonceurs().filter(g => g.demandes.length);
          idsA.forEach(id => {
            const x = demA[id], d = C.dossier(id);
            d.annonceur = x.ref; x.statut = 'FAITE'; x.fait = new Date(M.NOW);
            if (d.prepaEnvoyee) renvoiPrepa(d);
            d.historique.push({ date: new Date(M.NOW), user: 'Broadcast', action: 'Annonceur corrigé en « ' + x.ref + ' »' + (d.prepaEnvoyee ? ', préparation renvoyée' : '') });
            M.journal(d.id, 'Annonceur corrigé par Broadcast en « ' + x.ref + ' »', 'Broadcast');
          });
          const apres = C.groupesAnnonceurs();
          avant.forEach(g => { const g2 = apres.find(x => x.key === g.key); if (!g2 || g2.libelles.length < 2) M.data.verifAnnonceurs[g.key] = { statut: 'CORRIGE', date: new Date(M.NOW), user: 'Broadcast', libelles: g.libelles, dossiers: g.dossiers }; });
        }
        if (!ids.length && !idsA.length) { M.ui.toast(dosDem.length ? dosDem.length + ' préparation(s) renvoyée(s) par Broadcast après correction : Circé refait l’Instruction OK quand tout concorde (la validation admin ne dépend pas de la préparation) ; le reste est dans Déroulant › Liste des instructions, ou 2 m² fixe et Pliage › À traiter.' : 'Aucune demande de correction en attente.', dosDem.length ? 'good' : undefined); return; }
        if (!ids.length) { M.ui.toast(idsA.length + ' dossier(s) renvoyé(s) par Broadcast avec l’annonceur corrigé.', 'good'); return; }
        ids.forEach(id => {
          const x = dem[id], t = C.theme(id), d = C.dossier(t.dossierId);
          t.libelle = x.ref; x.statut = 'FAITE'; x.fait = new Date(M.NOW);
          renvoiPrepa(d);
          d.historique.push({ date: new Date(M.NOW), user: 'Broadcast', action: 'Préparation renvoyée : thème corrigé en « ' + x.ref + ' »' });
          M.journal(d.id, 'Préparation renvoyée par Broadcast, thème corrigé en « ' + x.ref + ' »', 'Broadcast');
        });
        // Un groupe sans demande en attente et dont les intitulés sont désormais identiques est traité : il quitte la liste « À vérifier »
        C.groupesThemes().filter(g => !g.harmoniser && !g.demandes.length && g.themes.some(t => ids.includes(t.id)))
          .forEach(g => { M.data.verifThemes[g.key] = { statut: 'CORRIGE', date: new Date(M.NOW), user: 'Broadcast' }; });
        M.ui.toast(ids.length + ' préparation(s) renvoyée(s) par Broadcast avec le thème corrigé.', 'good');
      },
    },
    {
      label: 'Réinitialiser la maquette',
      help: 'Recharge les données fictives de départ.',
      run() { M.NOW = new Date(2026, 9, 13, 10, 0); M.resetData(); Object.keys(M.tableState).forEach(k => delete M.tableState[k]); M.ui.toast('Données réinitialisées.'); },
    },
  ];

  M.start();
})();
