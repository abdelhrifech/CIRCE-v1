/* Liste des instructions (Déroulant) et À traiter (2 m² fixe, Pliage), noms des menus de Circé : les dossiers d'un type d'atelier,
   avec leur validation admin et, au déroulant, leur Instruction OK. Plus de page « tous ateliers » : l'onglet Pré-production, qui
   la portait (« Validation admin et Instruction OK »), est retiré le 04/11 ; la validation admin en lot de tous les formats est dans
   Réception › Liste des affiches. Process par jalons du 27/10, revu le 02/11 (option A). La Coordination ne part plus de la préparation :
   - la validation admin (tous ateliers), gardée avec son bouton, JAMAIS SANS UNE PERSONNE, part de la RÉCEPTION : Circé
     propose le rattachement de chaque affiche à la ligne attendue de son dossier (état des réservations, BL) ; la Coordination
     confirme en lot (cas sûrs pré-cochés) ou un par un (doutes). La préparation n'est plus qu'un contrôle : Circé signale un
     écart quand elle arrive (PP-01, PP-10, 02/11) ;
   - l'Instruction OK (déroulant) reste liée à la préparation, qui porte les instructions. Règle de Nariman : automatique sans
     commentaire de prépa et avec un nombre d'exceptions égal à la quantité ; sinon le dossier reste « En cours » et la
     Coordination la fait à la main (SCR-11, 26/10).
   La Pré-Prod saisit les IP et envoie la préparation depuis Broadcast ; elle ne travaille pas dans Circé. Le jeudi 14 h, la
   Coordination fait les Instructions OK restantes, vérifie la préparation des trains et exporte les trains. */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const user = () => M.ROLES.find(r => r.id === M.state.role).label;
  /** Option A (02/11) : seule la Coordination (ou l’admin) confirme la validation admin ; les autres rôles voient sans valider. */
  const peutValider = () => M.state.role === 'coord' || M.state.role === 'admin';
  const RESERVE = 'Réservé à la Coordination : choisissez le rôle « Coordination » en haut de page pour valider';
  const opts = vals => M.uniq(vals.filter(Boolean)).sort((a, b) => String(a).localeCompare(String(b), 'fr')).map(v => ({ value: v, label: v }));
  /** Instruction OK d'un dossier (C.instrOK), aux libellés des statuts de Circé : [libellé, gravité de la pastille]. */
  const IOK = {
    AUTO: ['Instruction ok · automatique', 'good'],
    A_FAIRE: ['En cours · commentaire ou écart', 'warning'],
    MANUEL: ['Instruction ok · après contrôle', 'good'],
    ATTENTE: ['À traiter · prépa pas reçue', 'info'],
    SANS_OBJET: ['Sans objet (fixe, pliage, bus)', 'info'],
  };
  const iokPill = d => { const k = C.instrOK(d); return k === 'SANS_OBJET' ? h('span', { class: 'muted' }, '—') : ui.sev(IOK[k][1], IOK[k][0]); };
  /** Validation admin d'une affiche (C.vaEtat) et d'un dossier (C.vaResume) : [libellé, gravité]. Option A (02/11) : Circé propose
      le rattachement à la réception, la Coordination confirme ; plus d'attente de la préparation. */
  const VA = {
    MANUELLE: ['Validée par la Coordination', 'good'], PROPOSEE: ['À confirmer : rattachement proposé', 'info'], A_FAIRE: ['À confirmer : doute', 'warning'],
    ORPHELINE: ['Réception inconnue', 'serious'],
  };
  const VA_D = {
    A_FAIRE: ['À confirmer', 'info'], FAITE: ['Validée', 'good'], AUCUNE: ['Aucune affiche reçue', 'info'], SANS_OBJET: ['Sans objet', 'info'],
  };
  const vaPill = d => {
    const k = C.vaResume(d), v = C.vaDossier(d);
    if (k === 'SANS_OBJET') return h('span', { class: 'muted' }, '—');
    return ui.sev(k === 'A_FAIRE' && v.doutes.length ? 'warning' : VA_D[k][1], VA_D[k][0] + (k === 'A_FAIRE' ? ' (' + v.aFaire.length + ')' + (v.doutes.length ? ', dont ' + v.doutes.length + ' doute' + (v.doutes.length > 1 ? 's' : '') : '') : ''));
  };
  /** La préparation, vue de la Coordination (02/11) : un contrôle, plus un préalable de la validation admin. Pas encore envoyée
      (avec la deadline de la Pré-Prod, en rouge une fois passée), reçue (avec sa date), ou annulée. */
  const PREPA = { A_TRAITER: 'info', PREPA_RECUE: 'good', VALIDE: 'good', ANNULE: 'info' };
  const prepaLib = d => (d.statutPP === 'A_TRAITER' ? 'Pas encore envoyée · deadline ' + M.fmt.day(M.deadlinePP(d.semaine)) + ' 16h' : d.statutPP === 'ANNULE' ? 'Annulé' : 'Reçue' + (d.prepaDate ? ' le ' + M.fmt.day(d.prepaDate) : ''));
  const prepaPill = d => ui.sev(d.statutPP === 'A_TRAITER' && M.NOW > M.deadlinePP(d.semaine) ? 'critical' : PREPA[d.statutPP], prepaLib(d));
  /** Ce qui reste à la Coordination sur un dossier : validation admin à confirmer, Instruction OK en cours, écart Broadcast. */
  const aFaire = d => [C.vaResume(d) === 'A_FAIRE' ? 'va' : null, C.instrOK(d) === 'A_FAIRE' ? 'iok' : null, d.qteBCInfo ? 'ecart' : null].filter(Boolean);
  /** Cas sûr : il ne reste que des rattachements proposés sans doute. Pré-coché pour la confirmation en lot ; un doute ou une autre
      tâche (Instruction OK en cours, écart) n'est jamais pré-coché. */
  const casSurs = d => { const a = aFaire(d); return a.length === 1 && a[0] === 'va' && !C.vaDossier(d).doutes.length; };
  const EXCLU = { NE_PAS_AFFICHER: 'Ne pas afficher', RESTE_EN_PLACE: 'Reste en place' };
  /** Pourquoi l'Instruction OK n'est pas automatique (C.instrOKMotifs), en clair. */
  const motifsTexte = d => C.instrOKMotifs(d).map(m => m === 'commentaire' ? 'commentaire de prépa : « ' + d.commentPrepa + ' »' : 'nombre d’exceptions différent de la quantité : ' + d.qteBCInfo.circe + ' exceptions dans Circé, quantité Broadcast ' + d.qteBCInfo.bc).join(' ; ') || 'sans commentaire ni écart';

  function instructionOK(ds) {
    M.tick(2);
    ds.forEach(d => {
      d.iok = { date: new Date(M.NOW), user: user() };
      d.historique.push({ date: new Date(M.NOW), user: user(), action: 'Instruction OK après contrôle des quantités, des exceptions, de l’entretien et des positions (' + motifsTexte(d) + ')' });
      M.journal(d.id, 'Instruction OK après contrôle');
    });
    ui.toast(ds.length + ' dossier(s) en Instruction OK : Circé répartit les visuels sur les trains et crée l’entretien. Les trains partent à l’export du jeudi 14 h (Liste des trains).', 'good');
    M.refresh();
  }

  /** Confirmation de la validation admin (option A, 02/11) : les affiches proposées par Circé et les affiches à doute des dossiers
      choisis. Une personne confirme toujours ; si la sélection contient des doutes, une confirmation explicite est demandée. */
  function validationAdmin(ds, apres) {
    const afs = M.uniq(ds.flatMap(d => C.vaDossier(d).aFaire));
    if (!afs.length) { ui.toast('Aucune affiche à confirmer dans la sélection : la validation admin est déjà faite, ou aucune affiche n’est encore arrivée.', 'critical'); return; }
    const doutes = afs.filter(a => C.vaEtat(a) === 'A_FAIRE'), sures = afs.filter(a => C.vaEtat(a) === 'PROPOSEE');
    const faire = liste => {
      M.tick(3);
      C.validerAffiches(liste, user());
      ds.forEach(d => { const n = liste.filter(a => C.dossiersOfAffiche(a).includes(d.id)).length; if (n) M.journal(d.id, 'Validation admin confirmée : ' + n + ' affiche(s)'); });
      ui.toast(liste.length + ' affiche(s) confirmée(s) par la Coordination : n° d’affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé.', 'good');
      M.refresh(); if (apres) apres();
    };
    if (!doutes.length) { faire(afs); return; }
    ui.modal({ title: 'Confirmer aussi les affiches à doute ?', body: [
      h('p', { style: { marginTop: 0 } }, sures.length + ' affiche(s) sans doute et ' + doutes.length + ' affiche(s) à doute sont dans la sélection. Rien n’est validé sans vous : les doutes se confirment après vérification du motif.'),
      h('ul', null, doutes.map(a => h('li', null, h('b', null, a.id), ' · « ' + a.libelleSaisi + ' » : ' + C.vaMotifs(a).map(m => M.VA_MOTIFS[m]).join(' ; ')))),
    ], actions: [{ label: 'Annuler' }, sures.length ? { label: 'Confirmer les ' + sures.length + ' sans doute seulement', onClick: () => { faire(sures); } } : null, { label: 'Confirmer tout (' + afs.length + ')', primary: true, onClick: () => { faire(afs); } }].filter(Boolean) });
  }

  /** Les affiches reçues d'un dossier, avec leur n° d'affiche de Circé et leur validation admin (rattachement proposé par Circé,
      confirmé par la Coordination) ; une ligne par visuel pas encore reçu. */
  function affichesVA(d, ths, redraw) {
    const v = C.vaDossier(d);
    const recues = new Set(v.afs.flatMap(a => a.alloc.map(x => x.themeId)));
    const pasRecus = ths.filter(t => !t.exclu && !recues.has(t.id));
    const etat = v.aFaire.length ? v.aFaire.length + ' affiche(s) à confirmer par la Coordination : rattachement proposé par Circé à la réception' + (v.doutes.length ? ', dont ' + v.doutes.length + ' avec un doute (motif sous l’état : à vérifier avant de valider)' : ', sans doute') + '. Aucune validation sans vous.'
      : v.afs.length ? 'Toutes les affiches reçues sont confirmées. Une affiche qui arrive ensuite est proposée à sa réception, puis confirmée par la Coordination.'
        : 'Aucune affiche reçue : Circé proposera le rattachement dès la réception, sans attendre la préparation' + (d.statutPP === 'A_TRAITER' ? ' (elle n’est pas encore reçue)' : '') + '.';
    const valider = (a, titre) => ui.btn('Valider', () => { C.validerAffiches([a], user()); M.journal(a.id, 'Validation admin confirmée'); M.refresh(); redraw(); }, { small: true, primary: C.vaEtat(a) === 'PROPOSEE', title: peutValider() ? titre : RESERVE, disabled: !peutValider() });
    const action = (a, e) => e === 'PROPOSEE' ? valider(a, 'Confirmer le rattachement proposé par Circé')
      : e === 'A_FAIRE' ? valider(a, 'Confirmer après vérification du motif')
        : e === 'MANUELLE' ? ui.btn('Annuler la validation', () => { C.annulerValidation(a, user()); M.journal(a.id, 'Validation admin annulée'); M.refresh(); redraw(); }, { small: true, ghost: true, title: peutValider() ? 'L’affiche repasse « à confirmer »' : RESERVE, disabled: !peutValider() }) : null;
    return [
      h('h3', { style: { fontSize: '14px', margin: '12px 0 6px' } }, 'Affiches reçues et validation admin'),
      h('p', { class: 'small muted', style: { margin: '0 0 6px' } }, etat),
      h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
        h('thead', null, h('tr', null, ['N° d’affiche', 'Thème (quantité)', 'Reçue', 'Validation admin', 'Emplacement', ''].map(x => h('th', null, x)))),
        h('tbody', null,
          v.afs.map(a => {
            const e = C.vaEtat(a);
            const motifs = e === 'A_FAIRE' ? C.vaMotifs(a) : e === 'MANUELLE' && a.va && a.va.motifs ? a.va.motifs : [];
            const quand = e === 'PROPOSEE' || e === 'A_FAIRE' ? ' · reçue le ' + M.fmt.dt(a.date) : e === 'MANUELLE' && a.va ? ' (' + a.va.user + ', ' + M.fmt.dt(a.va.date) + ')' : '';
            const ts = a.alloc.map(x => ({ t: C.theme(x.themeId), q: x.qte })).filter(x => x.t && x.t.dossierId === d.id);
            return h('tr', null,
              h('td', null, h('b', null, a.id)),
              h('td', null, ts.map(x => h('div', null, x.t.libelle + ' (' + x.q + ')'))),
              h('td', { class: 'num' }, String(a.qteRecue)),
              h('td', null, ui.sev(VA[e][1], VA[e][0] + quand), motifs.length ? h('div', { class: 'small muted' }, motifs.map(m => M.VA_MOTIFS[m]).join(' ; ')) : null),
              h('td', null, a.allee + '-' + a.rayon),
              h('td', { class: 'nowrap' }, action(a, e)));
          }),
          pasRecus.map(t => h('tr', null,
            h('td', null, h('span', { class: 'muted' }, '—')), h('td', null, t.libelle), h('td', { class: 'num' }, '0'),
            h('td', null, ui.sev('info', 'Pas encore reçue'), h('div', { class: 'small muted' }, 'rattachement proposé à sa réception, à confirmer')), h('td', null, '—'), h('td', null)))))),
      ui.annot('Validation admin (option A, 02/11) : gardée, avec son bouton, mais jamais sans une personne. À la réception, Circé propose le rattachement de l’affiche au dossier (n° de dossier lu sur le BL, format, thème), sans attendre la préparation ni l’Instruction OK. La Coordination confirme : en lot pour les cas sûrs (pré-cochés), affiche par affiche pour les doutes. La quantité n’est pas une condition : une réception partielle est validée pour ce qu’elle contient, le reste à recevoir garde son alerte. Elle débloque le n° d’affiche dans le suivi de prod, le picking, l’étiquette rack et l’information « reçue » envoyée à Broadcast.', ['PP-01', 'PP-10', 'PP-02', 'REC-09']),
    ];
  }

  /** Demande de correction à Broadcast (19/10). Circé ne peut pas agir dans Broadcast : le sens est toujours de Broadcast vers
      Circé, et « rendre la main » ne peut être qu'un mail ou une alerte, rien d'autre. Le bouton envoie donc un mail à la
      Pré-Prod (gestionnaires du pôle, dans Broadcast) ; l'état du dossier ne change pas ; la préparation corrigée revient par Broadcast. */
  function demanderCorrection(d, apres) {
    let note = '';
    const pole = d.pole || 'du pôle';
    ui.modal({ title: 'Demander une correction à Broadcast · dossier ' + d.id, body: [
      h('p', { style: { marginTop: 0 } }, 'Circé ne peut pas modifier Broadcast : la Pré-Prod (gestionnaires ' + pole + ') reçoit un mail, corrige dans Broadcast (IP, thème, annonceur, quantité) puis renvoie la préparation. Le dossier reste tel quel dans Circé jusqu’à ce renvoi.'),
      d.demandeBC ? ui.callout('info', 'Une demande est déjà partie le ' + M.fmt.dt(d.demandeBC.date), ' Le mail sera renvoyé.') : null,
      C.prodLancee(d) ? ui.callout('warning', 'Production lancée', ' Prévenez aussi l’atelier : une préparation renvoyée n’est pas suivie après le lancement de la production.') : null,
      ui.field('Qu’y a-t-il à corriger ? (message à la Pré-Prod)', ui.input({ value: '', placeholder: 'ex. IP à ressaisir, thème, quantité, annonceur', label: 'Message à la Pré-Prod', onInput: v => { note = v.trim(); } })),
      ui.annot('Même circuit que la vérification des thèmes et des annonceurs. Aujourd’hui : rendu de la main par « Déblocage préparation » dans Circé (S45, S47) ; cible : un mail, et l’envoi de Broadcast fait « annule et remplace » (BC-03).', ['BC-03', 'PP-08']),
    ], actions: [{ label: 'Annuler' }, { label: 'Envoyer le mail', primary: true, onClick: () => {
      M.tick(2);
      M.mail({ to: ['Pré-Prod · gestionnaires ' + d.pole + ' (Broadcast)'], subject: '[Circé] Correction à faire dans Broadcast : dossier ' + d.id + ' (' + d.annonceur + ')',
        body: 'Bonjour,\n\nLa Coordination demande une correction dans Broadcast pour le dossier ' + d.id + ' (' + d.annonceur + ', ' + C.atelier(d.atelier).label + ', départ ' + d.semaines.map(s => 'S' + s).join(' + ') + ').' + (note ? '\n\nÀ corriger : ' + note : '') +
          '\n\nMerci de corriger dans Broadcast, puis de renvoyer la préparation (annule et remplace).',
        trigger: 'Bouton « Demander une correction à Broadcast » (fiche du dossier)', needs: ['BC-03', 'PP-08'] });
      d.demandeBC = { date: new Date(M.NOW), user: user(), note };
      d.historique.push({ date: new Date(M.NOW), user: user(), action: 'Correction demandée à Broadcast par mail' + (note ? ' : ' + note : '') });
      M.journal(d.id, 'Correction demandée à Broadcast (mail à la Pré-Prod ' + d.pole + ')');
      M.refresh(); if (apres) apres();
    } }] });
  }

  function detail(d) {
    const ths = d.themes.map(C.theme);
    const ls = M.data.lignes.filter(l => l.dossierId === d.id);
    const isTrain = C.atelier(d.atelier).mode === 'train';
    const body = h('div');
    // Thèmes proches d'autres dossiers (ou du même), pas encore vérifiés : à regarder avant de valider (PP-08)
    const proches = () => C.themesAVerifier().filter(g => g.dossiers.includes(d.id));
    // Thèmes modifiés dans Broadcast après la validation : Circé ne suit pas d'elle-même (PP-09)
    const ecartsBC = () => C.ecartsThemeBC().filter(x => x.d.id === d.id);
    const draw = () => {
      const iok = C.instrOK(d), va = C.vaResume(d), nVa = C.vaDossier(d).aFaire.length;
      // Positions et entretien : au déroulant, modifiables seulement quand l'Instruction OK se fait à la main (commentaire de
      // prépa, ou nombre d'exceptions différent de la quantité) ; sinon tout est repris de Broadcast. Au fixe et au pliage,
      // tant que la validation admin n'est pas faite.
      const editable = isTrain ? iok === 'A_FAIRE' : d.statutPP === 'PREPA_RECUE';
      M.mount(body,
        // La validation admin d'abord (elle part de la réception), la préparation ensuite, en contrôle (02/11)
        h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'small muted' }, 'Validation admin'), vaPill(d), h('span', { class: 'small muted' }, 'Préparation'), prepaPill(d), ui.tag(C.atelier(d.atelier).label + ' · ' + C.site(d.site).label), ui.tag(d.format), ui.tag('Départ ' + d.semaines.map(s => 'S' + s).join(' + ')), d.controlee ? ui.tag('Campagne contrôlée') : null),
        va === 'A_FAIRE' ? ui.callout(C.vaDossier(d).doutes.length ? 'warning' : 'info', 'Validation admin à confirmer par la Coordination', ' ' + nVa + ' affiche(s) proposée(s) par Circé à la réception' + (C.vaDossier(d).doutes.length ? ', dont ' + C.vaDossier(d).doutes.length + ' avec un doute' : ', sans doute') + (d.statutPP === 'A_TRAITER' ? ', avant même la préparation' : '') + ' : voir le tableau « Affiches reçues et validation admin », puis « Valider ». Aucune validation sans vous.') : null,
        ecartsBC().length ? ui.callout(ecartsBC().some(x => x.enProd) ? 'critical' : 'warning', 'Thème modifié dans Broadcast après la validation', ' ' + ecartsBC().map(x => 'Broadcast indique « ' + x.t.libelleBC + ' », Circé a « ' + x.t.libelle + ' »' + (x.t.modifBC ? ' (modifié le ' + M.fmt.dt(x.t.modifBC.date) + ')' : '')).join(' ; ') + (ecartsBC().some(x => x.enProd) ? '. Production lancée : l’atelier sera prévenu.' : '.'),
          ui.btn('Reprendre la version Broadcast', () => { ecartsBC().forEach(x => M.appliquerThemeBC(x)); draw(); }, { small: true, primary: true })) : null,
        proches().length ? ui.callout('warning', 'Thème proche à vérifier avant de valider', ' ' + proches().map(g => g.libelles.map(l => '« ' + l + ' »').join(' / ') + (g.dossiers.length > 1 ? ' (dossiers ' + g.dossiers.filter(x => x !== d.id).join(', ') + ')' : ' (dans ce dossier)')).join(' ; ') + '. Même visuel ? Demander la correction dans Broadcast.',
          ui.btn('Vérifier les thèmes', () => M.go('themes', { dossier: d.id }), { small: true, primary: true })) : null,
        d.demandeBC ? ui.callout('info', 'Correction demandée à Broadcast le ' + M.fmt.dt(d.demandeBC.date), ' Mail à la Pré-Prod ' + d.pole + (d.demandeBC.note ? ' : « ' + d.demandeBC.note + ' »' : '') + '. Le dossier reste tel quel jusqu’à ce que Broadcast renvoie la préparation.') : null,
        d.qteBCInfo ? ui.callout('critical', 'Écart Broadcast / Circé', ' Broadcast indique ' + d.qteBCInfo.bc + ' faces, Circé a ' + d.qteBCInfo.circe + ' (blocage ou déblocage le ' + M.fmt.dt(d.qteBCInfo.date) + ').',
          ui.btn('Appliquer la version Broadcast', () => { d.historique.push({ date: new Date(M.NOW), user: user(), action: 'Annule et remplace : quantité Broadcast ' + d.qteBCInfo.bc + ' appliquée (au lieu de ' + d.qteBCInfo.circe + ')' }); M.journal(d.id, 'Annule et remplace Broadcast appliqué'); d.qteBC = d.qteBCInfo.bc; d.qteBCInfo = null; ui.toast('Version Broadcast appliquée ; les trains non produits sont recalculés, les trains en production sont signalés.', 'good'); M.refresh(); draw(); }, { small: true, primary: true })) : null,
        d.qteBCInfo ? ui.annot('Aujourd’hui : purge de l’écran puis « Déblocage préparation » et rendu de la main, seulement si la prod n’est pas lancée (S47). Cible : l’envoi Broadcast fait « annule et remplace ».', ['BC-03', 'ANO-06']) : null,
        // Instruction OK (déroulant), règle de Nariman : automatique sans commentaire de prépa et avec un nombre d'exceptions
        // égal à la quantité ; sinon le dossier reste « En cours » et la Coordination la fait à la main. Un écart peut venir
        // d'un « reste en place » ou d'une erreur.
        isTrain && iok === 'A_FAIRE' ? ui.callout('warning', 'En cours : Instruction OK à faire à la main par la Coordination', ' ' + motifsTexte(d) + '. ' + (d.qteBCInfo ? 'Un écart peut venir d’un « reste en place » ou d’une erreur. ' : '') + 'Contrôlez les quantités, les exceptions, l’entretien et la position des visuels (le commentaire porte souvent « début » ou « fin de train »), puis passez le dossier en Instruction OK.') : null,
        isTrain && iok === 'MANUEL' ? ui.callout('good', 'Instruction ok après contrôle', ' ' + motifsTexte(d) + (d.iok ? ' (' + d.iok.user + ', ' + M.fmt.dt(d.iok.date) + ')' : '') + '.') : null,
        isTrain && iok === 'AUTO' ? ui.callout('good', 'Instruction ok automatique', ' Pas de commentaire de prépa, et nombre d’exceptions égal à la quantité : la répartition par thème et l’entretien (' + d.entretienPct + ' %) sont repris de Broadcast' + (d.controlee ? ' ; campagne contrôlée : 15 % d’entretien et visuel en début de train' : '') + '.') : null,
        isTrain && iok === 'ATTENTE' ? ui.callout('info', 'À traiter : la préparation n’est pas reçue', ' Les instructions arrivent avec l’envoi de la prépa par la Pré-Prod ; Circé fait alors l’Instruction OK si tout concorde, sinon le dossier passe « En cours ».') : null,
        h('h3', { style: { fontSize: '14px', margin: '12px 0 6px' } }, 'Visuels et position dans le train'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'dt' },
          h('thead', null, h('tr', null, ['Position', 'Thème', 'Quantité Broadcast', 'Avec entretien', 'Traitement', ''].map(x => h('th', null, x)))),
          h('tbody', null, ths.map(t => h('tr', { class: t.exclu ? 'tone-muted' : '' },
            h('td', null, h('b', null, t.position)), h('td', null, ui.btnVisuel(t), t.libelle), h('td', { class: 'num' }, t.qte), h('td', { class: 'num' }, t.qteEnt),
            // « Ne pas afficher » et « reste en place » viennent des IP de Broadcast : exclusion automatique, sans saisie (SCR-02, FIX-14)
            h('td', null, t.exclu ? ui.tag(EXCLU[t.exclu] + ' (Broadcast)', 'hyp') : 'À produire'),
            h('td', { class: 'nowrap' }, isTrain ? h('span', { class: 'small muted' }, ui.icon('lock'), iok === 'AUTO' || iok === 'MANUEL' ? ' figé (Instruction OK)' : ' repris de Broadcast') : null)))))),
        ui.annot('Les quantités par thème viennent de Broadcast : plus de ressaisie du % de répartition. Les thèmes « ne pas afficher » et « reste en place » sortent d’eux-mêmes des trains et de la préparation du fixe. Une campagne contrôlée est placée en tête de train par défaut.', ['SCR-03', 'SCR-02', 'FIX-14', 'SCR-09', 'SCR-10']),
        affichesVA(d, ths, draw),
        h('div', { class: 'grid cols-2 mt' },
          ui.field('Entretien (%), repris de Broadcast', ui.input({ type: 'number', value: d.entretienPct, min: 0, max: 30, onChange: v => { if (!editable) { ui.toast('Entretien repris de Broadcast : modifiable seulement quand l’Instruction OK se fait après contrôle (dossier « En cours »).', 'critical'); draw(); return; } d.entretienPct = Number(v); ls.forEach(l => { l.entretien = C.entretien(l.qte, d.entretienPct); }); ths.forEach(t => { const tl = ls.filter(l => l.themeId === t.id); t.qteEnt = t.qte + M.sum(tl, l => l.entretien); }); C.recalculer(); draw(); } })),
          ui.field('Entretien calculé à l’afficheur', h('div', { class: 'small' }, M.fmt.n(M.sum(ls, l => l.entretien)) + ' affiches, réparties sur ' + ls.length + ' lignes (règle : rien sous ' + M.PARAMS.entretien.seuil + ' affiches, sinon % arrondi au supérieur)'))),
        ui.annot(isTrain ? 'Deux verrous indépendants : l’Instruction OK (règle de Nariman ; « En cours » à la main par la Coordination) et la validation admin (Circé propose le rattachement à la réception, la Coordination confirme en lot ou un par un, sans attendre la préparation ni l’Instruction OK, 02/11). Le jeudi 14 h, la Coordination fait les Instructions OK restantes, vérifie la préparation des trains et clique « Exporter les trains » : seules les faces en Instruction OK partent, en « A imprimer ».' : '2 m² fixe et pliage : pas d’Instruction OK. La validation admin est proposée par Circé à la réception et confirmée par la Coordination, sans attendre la préparation ; la libération de la semaine donne ensuite le Go à l’atelier.', ['PP-10', 'SCR-11', 'PP-01', 'PP-06', 'SCR-04', 'BC-01', 'REU-06']),
        h('h3', { style: { fontSize: '14px', margin: '12px 0 6px' } }, 'Historique (dont modifications après envoi)'),
        h('ul', { class: 'cz-timeline' }, d.historique.slice().sort((a, b) => a.date - b.date).map(x => h('li', null, h('span', { class: 'when' }, M.fmt.dt(x.date)), h('span', null, x.action + ' · ' + x.user)))));
    };
    draw();
    const iok0 = C.instrOK(d), nVa0 = C.vaDossier(d).aFaire.length;
    ui.modal({ title: d.annonceur + ' · dossier ' + d.id, wide: true, body, actions: [
      { label: 'Fermer' },
      { label: 'Demander une correction à Broadcast', onClick: () => { setTimeout(() => demanderCorrection(d, () => setTimeout(() => detail(d), 0)), 0); } },
      isTrain && iok0 === 'A_FAIRE' ? { label: 'Instruction OK (après contrôle)', primary: !nVa0, onClick: () => { instructionOK([d]); setTimeout(() => detail(d), 0); } } : null,
      nVa0 ? { label: 'Valider (' + nVa0 + ' affiche' + (nVa0 > 1 ? 's' : '') + ')', primary: true, disabled: !peutValider(), onClick: () => { setTimeout(() => validationAdmin([d], () => setTimeout(() => detail(d), 0)), 0); } } : null,
    ].filter(Boolean) });
  }

  /* 12/11 (utilisatrice : « les colonnes présentes dans l'ancien Circé doivent être présentes dans la maquette ; les colonnes ajoutées
     par la maquette, laisse-les »).
     - À traiter (2 m² fixe, pliage) : dans Circé, une ligne par ligne de préparation (tf_repart_calcul : dossier × thème × destinataire),
       colonnes de Preparation/_Preparation2m2FixeATraiterGrid et PreparationPliage/_PliageATraiterGrid. Un seul tableau à ce grain
       (plus de bascule « Afficher par », 12/11 soir) : les colonnes du dossier de la maquette y sont ajoutées, titre en gras rouge
       (ajout: true). Les actions en lot agissent sur les dossiers des lignes cochées.
     - Liste des instructions (déroulant) : même grain que Circé (le dossier) ; colonnes de TrainListeInstruction/Index d'abord. */
  const CIRCE_AT = {
    fixe: ['type', 'repart', 'id', 'annonceur', 'qte', 'theme', 'repiquage', 'format', 'dest', 'depart', 'destination', 'atelier'],
    pliage: ['type', 'repart', 'id', 'annonceur', 'qte', 'theme', 'format', 'atelier', 'dest', 'depart', 'destination', 'semMax', 'nAffiche'],
  };
  const CIRCE_LDI = ['id', 'annonceur', 'format', 'iok', 'comment', 'qteCirce', 'utilisateur', 'dateModif'];
  /** Colonnes de Circé d'abord (dans son ordre, visibles), puis les autres avec leur visibilité d'avant ; libellés de Circé.
      Les autres sont marquées ajout: true (titre en gras rouge : absentes de l'ancien Circé, 12/11). */
  const ordonner = (cols, ordre, libelles) => {
    const par = new Map(cols.map(c => [c.key, c]));
    return ordre.map(k => par.get(k)).filter(Boolean).map(c => Object.assign({}, c, { hidden: false }, libelles && libelles[c.key] ? { label: libelles[c.key] } : null))
      .concat(cols.filter(c => !ordre.includes(c.key)).map(c => Object.assign({}, c, { ajout: true })));
  };

  M.screen({
    id: 'instructions', title: 'Liste des instructions', icon: '✎', nav: 'Liste des instructions', roles: ['coord', 'admin'],
    needs: ['PP-10', 'SCR-11', 'PP-01', 'PP-06', 'PP-08', 'SCR-03', 'SCR-02', 'FIX-14', 'SCR-04', 'SCR-09', 'SCR-10', 'BC-03', 'ANO-06', 'ANO-07', 'ANO-14', 'REC-06', 'REC-09', 'PP-03', 'CIB-02', 'CIB-03', 'BC-01', 'ERG-05', 'ERG-06', 'ERG-08'],
    asis: ['Liste des instructions déroulants : « En cours » posé par Circé à l’arrivée des instructions ; filtrer « En cours », comparer qté BC / nb d’exceptions, ressaisir le % par thème, saisir Instruction OK, le plus souvent le jeudi avant l’export (S47-S48)', 'Validation admin par la Coordination, affiche par affiche, dans la Liste des affiches (S27-S29), raccrochage à la main dans « Ajouter prépa »', 'Mail de confirmation aux plateformes après contrôle (S49)', 'Statuts existants : 0 A traiter, 1 En cours, 2 Instruction Ok, 5 A imprimer après l’export (code : Enums.cs:223-247)'],
    badge: () => { const ds = M.data.dossiers.filter(d => M.inScope(d, { allWeeks: true }) && d.semaine >= 43 && aFaire(d).length); return { n: ds.length, hot: ds.some(d => d.qteBCInfo), title: 'Dossiers avec quelque chose à faire par la Coordination' }; },
    render(root, params) {
      // Le statut est un filtre (plus d'onglets dans la page). Par défaut : ce qui reste à la Coordination (validation admin à
      // faire, Instruction OK en cours, écart Broadcast). Un lien peut poser le statut (?statut=PREPA_RECUE, VALIDE, ECART ou
      // TOUS), l'Instruction OK (?iok=A_FAIRE) ou la validation admin (?va=A_FAIRE) ; il remplace alors le filtre par défaut.
      const iokSel = params.iok ? [params.iok] : [];
      // ?statut=VALIDE (anciens liens) : c'est la validation admin, plus un statut de préparation
      const vaSel = params.va ? [params.va] : params.statut === 'VALIDE' ? ['FAITE'] : [];
      const preset = params.statut === 'TOUS' ? { statut: [], ecart: [], iok: iokSel, va: vaSel, afaire: [] }
        : params.statut === 'ECART' ? { statut: [], ecart: ['oui'], iok: iokSel, va: vaSel, afaire: [] }
          : params.statut ? { statut: params.statut === 'VALIDE' ? [] : [params.statut], ecart: [], iok: iokSel, va: vaSel, afaire: [] }
            : params.iok || params.va ? { statut: [], ecart: [], iok: iokSel, va: vaSel, afaire: [] } : null;
      // Onglet d'atelier (?pour=deroulant, fixe, pliage, bus) : les dossiers de ce type d'atelier, avec leurs propres filtres,
      // comme « Liste des instructions » (Trains) et « A traiter » (2m² fixe, Pliage) dans Circé. Sans « pour » : le déroulant
      // (la page « tous ateliers » de l'onglet Pré-production est retirée, 04/11).
      const pour = M.POUR_LABEL[params.pour] ? params.pour : 'deroulant';
      const ats = M.ateliersPour(pour);
      const idsAt = new Set(ats.map(a => a.id));
      // Filtres : N° de dossier, Départ (semaine en production et suivantes), Atelier, À faire par la Coordination (par défaut),
      // Statut, Validation admin, Instruction OK ; Écart BC / Circé, Thèmes à vérifier, Format, Pôle et Annonceur par « + Filtre »
      const base = M.data.dossiers.filter(d => M.inScope(d, { allWeeks: true }) && idsAt.has(d.atelier));
      // Dossiers ayant un thème proche d'un autre dossier, encore à vérifier (PP-08)
      const aVerifier = new Map();
      C.themesAVerifier().forEach(g => g.dossiers.forEach(id => aVerifier.set(id, (aVerifier.get(id) || 0) + 1)));
      // Dossiers dont un thème a changé dans Broadcast après la validation (PP-09)
      const modifBC = new Set(C.ecartsThemeBC().map(x => x.d.id));
      const F = ui.filters({ id: 'instructions-' + pour, rows: base, preset, defs: [
        ui.dossierFilter(base, d => d.id),
        ui.weekFilter(M.ref.semaines.map(s => s.num).filter(n => n >= M.state.semaine), d => d.semaine),
        { key: 'atelier', label: 'Atelier', options: ats.map(a => ({ value: a.id, label: ui.withSite(a.label, a.site) })), get: d => d.atelier },
        { key: 'afaire', label: 'À faire (Coordination)', default: ['va', 'iok', 'ecart'], options: [{ value: 'va', label: 'Validation admin à confirmer' }, { value: 'iok', label: 'Instruction OK en cours' }, { value: 'ecart', label: 'Écart Broadcast / Circé' }, { value: 'rien', label: 'Rien à faire' }], get: d => (aFaire(d).length ? aFaire(d) : ['rien']), stable: true },
        { key: 'va', label: 'Validation admin', options: Object.entries(VA_D).filter(([v]) => v !== 'SANS_OBJET').map(([v, [l]]) => ({ value: v, label: l })), get: d => C.vaResume(d) },
        { key: 'iok', label: 'Instruction OK', options: Object.entries(IOK).map(([v, [l]]) => ({ value: v, label: l })), get: d => C.instrOK(d) },
        // Clé « statut » gardée pour les liens (?statut=...) : c'est l'état de la préparation, plus une étape avant la validation
        { key: 'statut', label: 'Préparation', options: [{ value: 'A_TRAITER', label: 'Pas encore envoyée (À traiter)' }, { value: 'PREPA_RECUE', label: 'Reçue' }, { value: 'ANNULE', label: 'Annulé' }], get: d => C.statutDossier(d) },
        { key: 'ecart', label: 'Écart BC / Circé', more: true, options: [{ value: 'oui', label: 'Avec écart de quantité' }, { value: 'non', label: 'Sans écart' }], get: d => (d.qteBCInfo ? 'oui' : 'non') },
        { key: 'proches', label: 'Thèmes à vérifier', more: true, options: [{ value: 'oui', label: 'Thème proche d’un autre dossier' }, { value: 'non', label: 'Aucun' }], get: d => (aVerifier.has(d.id) ? 'oui' : 'non') },
        { key: 'format', label: 'Format', more: true, options: opts(base.map(d => d.format)), get: d => d.format },
        { key: 'pole', label: 'Pôle', more: true, options: opts(base.map(d => d.pole)), get: d => d.pole },
        { key: 'annonceur', label: 'Annonceur', more: true, options: opts(base.map(d => d.annonceur)), get: d => d.annonceur },
      ], extra: h('span', { class: 'small muted' }, 'Deadline Pré-Prod (envoi de la prépa) : jeudi S-2 16h (S44 : ' + M.fmt.day(M.deadlinePP(44)) + ').') });
      const selStatut = F.sel('statut');
      const tab = selStatut.length === 1 ? selStatut[0] : 'TOUS'; // colonnes adaptées quand un seul statut est choisi
      const rows = F.apply(base).map(d => ({
        id: d.id, d, da: d.da, annonceur: d.annonceur, atelier: C.atelier(d.atelier).label, site: C.site(d.site).label, format: d.format, semaine: d.semaines.map(s => 'S' + s).join('+'), pole: d.pole,
        qteBC: d.qteBCInfo ? d.qteBCInfo.bc : d.qteBC, qteCirce: d.qteBCInfo ? d.qteBCInfo.circe : d.qteBC, ip: d.ipSaisies, themes: d.themes.length, proches: aVerifier.get(d.id) || 0, modifBC: modifBC.has(d.id), entretien: d.entretienPct, controlee: d.controlee,
        modifs: d.historique.filter(x => d.prepaDate && x.date > d.prepaDate && x.user !== 'Broadcast').length, deadline: M.deadlinePP(d.semaine),
        nAff: C.vaDossier(d).afs.length,
      }));
      // 12/11 : À traiter du fixe et du pliage, un seul tableau au grain de Circé (une ligne de préparation par ligne), avec les
      // colonnes du dossier de la maquette ajoutées (validation admin, préparation, écart…), titres en gras rouge
      const parLigne = pour === 'fixe' || pour === 'pliage';
      const lignesRows = !parLigne ? [] : (() => {
        const parId = new Map(rows.map(r => [r.id, r]));
        return M.data.lignes.filter(l => parId.has(l.dossierId)).map(l => {
          const r = parId.get(l.dossierId), t = C.theme(l.themeId), dest = C.dest(l.dest);
          return Object.assign({}, r, { id: l.id, l, theme: t ? t.libelle : '', repiquage: (t && t.repiquage) || '', qte: l.qte, dest: dest.label,
            destination: dest.label.replace(/ agence$/i, ''), depart: C.depart(l), afficheur: (C.afficheur(l.afficheur) || {}).label || '', entretienL: l.entretien,
            semMax: Math.max.apply(null, r.d.semaines), nAffiche: M.data.affiches.filter(a => a.statut !== 'ORPHELINE' && a.alloc.some(x => x.themeId === l.themeId)).map(a => a.id).join(', ') });
        }).sort((a, b) => String(a.d.id).localeCompare(String(b.d.id)) || a.dest.localeCompare(b.dest));
      })();
      const lignesTable = parLigne ? lignesRows : rows;
      const idTable = parLigne ? 'instructions-lignes-' + pour : 'instructions';
      /** Les dossiers des lignes cochées, une fois chacun (actions en lot de la vue par ligne). */
      const parDossier = sel => { const m = new Map(); sel.forEach(r => { if (!m.has(r.d.id)) m.set(r.d.id, rows.find(x => x.id === r.d.id) || r); }); return Array.from(m.values()); };
      const surs = lignesTable.filter(r => casSurs(r.d));
      const choixGrain = parLigne || pour === 'deroulant' ? h('div', { class: 'small muted', style: { margin: '0 0 10px' } },
        parLigne ? lignesRows.length + ' ligne(s) de préparation pour ' + rows.length + ' dossier(s), comme dans Circé ; les actions en lot agissent sur les dossiers des lignes cochées. ' : '',
        h('span', { class: 'cz-col-ajout-lib' }, 'Titre en gras rouge'), ' : colonne ajoutée par la maquette, absente de l’ancien Circé.') : null;
      const coordSub = 'On part de la réception, plus de la préparation. Dès qu’une affiche est reçue, Circé propose son rattachement à la ligne attendue du dossier (état des réservations, BL) : vous confirmez en lot (cas sûrs pré-cochés) ou un par un (doutes), ici ou dans Réception › Liste des affiches. La préparation, envoyée par la Pré-Prod depuis Broadcast, n’est plus qu’un contrôle : Circé signale un écart quand elle arrive.'
        + (pour === 'deroulant' ? ' Au déroulant, elle porte les instructions : Circé fait seul l’Instruction OK (sans commentaire de prépa et avec un nombre d’exceptions égal à la quantité), il vous reste les dossiers « En cours ». Le jeudi 14 h, vous exportez les trains (Liste des trains).'
          : ' La libération de la semaine (ex « Colisage ») se fait dans la page Préparation.');
      root.append(
        // Les noms de Circé : « Liste des instructions » au Déroulant (gardé le 25/10), « À traiter » au fixe et au pliage (04/11)
        ui.pageHead({ crumb: M.POUR_LABEL[pour], title: pour === 'deroulant' ? 'Liste des instructions' : 'À traiter', sub: coordSub, screen: 'instructions' }),
        h('div', null, ui.callout('info', 'Aucune validation sans vous : Circé propose, vous confirmez', ' À la réception d’une affiche, Circé propose son rattachement au dossier, sans attendre la préparation ni l’Instruction OK. Les cas sûrs sont pré-cochés : « Valider la sélection » confirme le lot en un clic. Les cas à doute ne sont jamais pré-cochés : le motif s’affiche dans la fiche du dossier, et la validation demande une confirmation explicite.')),
        // h() ignore un enfant null, Element.append l'écrirait « null » : l'encadré facultatif passe par un div
        h('div', null, pour === 'deroulant' ? ui.annot('Dernières minutes (Q60, à voir avec Nariman) : aujourd’hui la Coordination fait l’Instruction OK le jeudi, juste avant l’export ; jusque-là Circé accepte ce que Broadcast renvoie. Après l’Instruction OK, Circé l’ignore sans rien dire (p_integ_instructions.sql:170-173). La maquette refait l’Instruction OK quand la préparation est renvoyée, tant que les trains ne sont pas exportés ; autre option : appliquer la règle automatique le jeudi à 14 h, avant l’export.', ['SCR-11', 'PP-06', 'BC-03']) : null),
        F.bar,
        choixGrain,
        ui.card({ flush: true, body: ui.table({
          id: idTable, rows: lignesTable, query: params.q, selectable: true, exportName: parLigne ? 'a-traiter-' + pour + '-lignes.csv' : 'instructions.csv', onRowClick: r => detail(r.d),
          // Cas sûrs pré-cochés à l'arrivée (option A, 02/11) : un clic confirme le lot ; un doute n'est jamais pré-coché
          preselect: r => peutValider() && casSurs(r.d),
          toolbar: surs.length && peutValider() ? ui.btn('Cocher les cas sûrs (' + surs.length + ')', () => { const t = M._tables.get(idTable); if (!t) return; t.deselectRow(); t.selectRow(surs.map(r => String(r.id))); }, { small: true, title: 'Dossiers dont il ne reste que des rattachements proposés sans doute : « Valider la sélection » les confirme en un clic' }) : null,
          tone: r => r.d.qteBCInfo ? 'critical' : r.d.statutPP === 'A_TRAITER' && M.NOW > r.deadline ? 'critical' : aFaire(r.d).length ? 'warning' : C.vaResume(r.d) === 'FAITE' ? 'good' : C.statutDossier(r.d) === 'PREPA_RECUE' ? 'info' : null,
          // Vue par ligne (12/11) : les actions portent sur les dossiers des lignes cochées, une fois chacun
          bulkActions: (selBrut, clear) => { const sel = parDossier(selBrut); return [
            sel.some(r => C.instrOK(r.d) === 'A_FAIRE') ? ui.btn('Instruction OK (après contrôle)', () => { const ok = sel.filter(r => C.instrOK(r.d) === 'A_FAIRE').map(r => r.d); clear(); instructionOK(ok); }, { small: true }) : null,
            ui.btn('Valider la sélection', () => {
              const ds = sel.filter(r => C.vaResume(r.d) === 'A_FAIRE').map(r => r.d);
              clear();
              if (!ds.length) { ui.toast('Rien à valider : les dossiers choisis n’ont aucune affiche à confirmer (validation admin déjà faite, ou aucune affiche reçue).', 'critical'); return; }
              validationAdmin(ds);
            }, { small: true, primary: true, disabled: !peutValider(), title: peutValider() ? 'Confirme la validation admin des affiches à confirmer des dossiers cochés ; une confirmation explicite est demandée si la sélection contient des doutes' : RESERVE })]; },
          // 12/11 : colonnes de Circé d'abord (ordre et libellés de Circé), puis celles de la maquette, gardées
          columns: colonnesCirce([
            // Le n° du dossier, pas l'id de la ligne (la vue par ligne garde l.id comme clé de ligne : L210…)
            { key: 'id', label: 'Dossier', value: r => r.d.id },
            { key: 'annonceur', label: 'Annonceur' },
            { key: 'atelier', label: 'Atelier', value: r => ui.withSite(r.atelier, r.d.site) },
            { key: 'semaine', label: 'Départ' },
            // On part de la réception (02/11) : la validation admin d'abord, visible même si la préparation n'est pas envoyée
            { key: 'va', label: 'Validation admin', title: 'À confirmer par la Coordination : rattachements proposés par Circé à la réception (cas sûrs pré-cochés) et affiches à doute, sans attendre la préparation (02/11)', value: r => VA_D[C.vaResume(r.d)][0], render: r => vaPill(r.d) },
            { key: 'statut', label: 'Préparation', title: 'Envoyée par la Pré-Prod depuis Broadcast. Au déroulant, elle porte les instructions (Instruction OK) ; pour la validation admin, elle n’est plus qu’un contrôle (option A, 02/11)', value: r => r.d.statutPP, csv: r => prepaLib(r.d), render: r => prepaPill(r.d) },
            { key: 'iok', label: 'Instruction OK', hidden: tab === 'A_TRAITER' || pour !== 'deroulant', title: 'Déroulant, statuts de Circé : « Instruction ok » automatique sans commentaire de prépa et avec un nombre d’exceptions égal à la quantité ; sinon « En cours », à la main par la Coordination (règle de Nariman, 26/10)', value: r => IOK[C.instrOK(r.d)][0], render: r => iokPill(r.d) },
            { key: 'ip', label: 'IP', hidden: tab !== 'A_TRAITER', render: r => r.ip ? 'Saisies' : ui.sev('serious', 'Non saisies') },
            { key: 'ecart', label: 'Écart BC / Circé', value: r => r.qteBC - r.qteCirce, title: 'Quantité Broadcast moins quantité Circé', render: r => r.qteBC !== r.qteCirce ? ui.sev('critical', M.fmt.signed(r.qteBC - r.qteCirce)) : h('span', { class: 'muted' }, '0') },
            { key: 'themes', label: 'Visuels', align: 'num', hidden: true, title: 'Nombre de visuels ; « thème proche » : même visuel probable sur un autre dossier ; « modifié dans BC » : thème changé dans Broadcast après la validation',
              render: r => h('span', null, String(r.themes), r.proches ? [' ', ui.sev('warning', 'thème proche')] : null, r.modifBC ? [' ', ui.sev('serious', 'modifié dans BC')] : null) },
            { key: 'deadline', label: 'Deadline', render: r => M.fmt.day(r.deadline) + ' 16h', value: r => r.deadline.getTime(), hidden: true, title: 'Deadline de la Pré-Prod pour l’envoi de la préparation (reprise dans la colonne Préparation)' },
            { key: 'nAff', label: 'Affiches reçues', align: 'num', hidden: true, title: 'Affiches reçues (n° d’affiche de Circé) rattachées au dossier' },
            { key: 'da', label: 'DA', hidden: true }, { key: 'site', label: 'Site', hidden: true }, { key: 'format', label: 'Format', hidden: true }, { key: 'pole', label: 'Pôle', hidden: true },
            { key: 'comment', label: 'Commentaire de prépa', hidden: true, wrap: true, maxWidth: 240, value: r => r.d.commentPrepa || '' },
            { key: 'qteBC', label: 'Qté Broadcast', align: 'num', hidden: true }, { key: 'qteCirce', label: 'Qté Circé', align: 'num', hidden: true },
            { key: 'entretien', label: 'Entretien %', align: 'num', hidden: true },
            { key: 'controlee', label: 'Contrôlée', hidden: true, render: r => r.controlee ? ui.tag('Oui') : '' },
            { key: 'modifs', label: 'Modif. après envoi', align: 'num', hidden: true, title: 'REC-06 : modifications tracées après l’envoi de la préparation' },
            // Colonnes de Circé ajoutées le 12/11 : Liste des instructions (Utilisateur, Date de modification) ; À traiter par ligne de préparation
            { key: 'utilisateur', label: 'Utilisateur', hidden: true, title: 'Dernière personne (ou Broadcast) qui a modifié le dossier', value: r => { const x = r.d.historique[r.d.historique.length - 1]; return x ? x.user || 'Broadcast' : 'Broadcast'; } },
            { key: 'dateModif', label: 'Date de modification', hidden: true, value: r => { const x = r.d.historique[r.d.historique.length - 1]; const t = x ? x.date : r.d.prepaDate; return t ? new Date(t).getTime() : 0; },
              render: r => { const x = r.d.historique[r.d.historique.length - 1]; const t = x ? x.date : r.d.prepaDate; return t ? M.fmt.dt(new Date(t)) : '—'; } },
            { key: 'type', label: 'Type prépa', hidden: true, value: () => (pour === 'fixe' ? '2 m² fixe' : pour === 'pliage' ? 'Collé' : 'Déroulant') },
            { key: 'repart', label: 'Répart', hidden: true, title: 'N° de la ligne de répartition (rpc_repartition dans Circé)', value: r => (r.l ? String(r.l.id).replace(/^L/, '') : '') },
            { key: 'qte', label: 'Qté', align: 'num', hidden: true, value: r => (r.l ? r.l.qte : r.qteCirce) },
            { key: 'theme', label: 'Thème', hidden: true, wrap: true, maxWidth: 260, value: r => r.theme || '' },
            { key: 'repiquage', label: 'Repiquage', hidden: true, value: r => r.repiquage || '' },
            { key: 'dest', label: 'Destinataire', hidden: true, value: r => r.dest || '' },
            { key: 'depart', label: 'Date départ', hidden: true, value: r => (r.depart ? r.depart.getTime() : 0), render: r => (r.depart ? M.fmt.day(r.depart) + ' ' + M.fmt.hm(r.depart) : '—') },
            { key: 'destination', label: 'Destination', hidden: true, title: 'Localité de l’adresse du destinataire', value: r => r.destination || '' },
            { key: 'semMax', label: 'Sem. Max', align: 'num', hidden: true, title: 'Dernière semaine d’affichage du dossier', value: r => Math.max.apply(null, r.d.semaines) },
            { key: 'nAffiche', label: 'Numéro Affiche', hidden: true, wrap: true, maxWidth: 200, value: r => r.nAffiche || '' },
            { key: 'afficheurL', label: 'Afficheur', hidden: true, value: r => r.afficheur || '' },
            { key: 'entretienL', label: 'Entretien (ligne)', align: 'num', hidden: true, value: r => (r.l ? r.l.entretien : '') },
          ]),
        }) }));
      /** Ordre et visibilité des colonnes : À traiter par ligne (fixe, pliage) ou Liste des instructions (déroulant), comme Circé. */
      function colonnesCirce(cols) {
        if (parLigne) return ordonner(cols, CIRCE_AT[pour], { id: 'Dossier', format: 'Format', atelier: 'Atelier' });
        if (pour === 'deroulant') return ordonner(cols, CIRCE_LDI, { id: 'Dossier (contrat)', iok: 'Statut (Instruction OK)', comment: 'Commentaire', qteCirce: 'Quantité' });
        return cols;
      }
    },
  });
})();
