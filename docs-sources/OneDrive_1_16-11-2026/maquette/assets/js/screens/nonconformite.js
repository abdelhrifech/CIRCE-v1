/* Onglet « Non-conformité » (09/11, demande de l'utilisatrice). Depuis le 10/11, deux pages seulement :
   - Nouvelle demande : deux boutons, « Usage réservé aux plateformes » (formulaire Contrôle réception de la Pré-Prod et des plateformes ;
     « Pré-production » jusqu'au 11/11) puis « Agence » (formulaire des agences, Power Apps reproduit à l'identique) ; le bouton choisi
     ouvre son formulaire, dans la couleur du bouton ;
   - Suivi des NC : un seul tableau pour toutes les non-conformités, filtre « Demande » (Plateformes / Agence), pour pouvoir extraire
     toutes les données d'un coup. Les deux vues SharePoint (Plateformes, Préproduction ; exports du 09/11) y sont déjà fusionnées.
   Les demandes des agences restent gardées à part sur le poste (clé circe-maquette-nonconf) : le tableau les lit avec les autres.
   Non-conformité à la réception (09/11) : le bouton « Non-conformité » de Réception des affiches (contrôle de la palette, réception inconnue)
   crée une ligne du suivi, taguée bloquante ou non bloquante (M.ncDeclarer). Non bloquante : la ligne sert au suivi (réception inconnue :
   aux statistiques). Bloquante : une alerte « Non-conformité bloquante » (Pilotage › Alertes) jusqu'à la décision ; pour une réception
   inconnue, c'est la préproduction qui doit donner son go (Décision Préproduction).
   Les déclarations sont gardées sur le poste (localStorage, clés circe-maquette-nonconf et circe-maquette-ctrl) ; les pièces jointes ne
   gardent que leur nom. La page J-3 (onglet Réception) est dans screens/j3.js. */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui;
  const lire = cle => { try { const t = JSON.parse(localStorage.getItem(cle)); if (Array.isArray(t)) return t; } catch (e) { /* rien de gardé */ } return []; };
  const garder = (cle, t) => { try { localStorage.setItem(cle, JSON.stringify(t)); } catch (e) { /* stockage indisponible : gardé pour la session */ } };

  /** Listes des formulaires, telles que dans l'original. */
  // 11/11 (utilisatrice) : « FPI (Affiches colle uniquement) » devient « FPI / Autre » dans les deux formulaires ; les lignes déjà
  // gardées avec l'ancien libellé sont relues avec le nouveau (voir stock)
  const PLATEFORMES = ['WISSOUS', 'NÎMES', 'FPI / Autre', 'BUS'];
  const FPI_ANCIEN = 'FPI (Affiches colle uniquement)';
  const REGIONS = ['Nord', 'Sud', 'Est', 'Ouest'];
  const FORMATS = ['12 m² Colle', '2 m² déroulant', '2 m² fixe', '4 m² Colle', '4 m² déroulant', '8 m² Colle', '8 m² déroulant', 'BUS'];
  const TYPES = ['Affiches Non Reçues ou Quantité livrée insuffisante', 'Assemblage Non Conforme', 'Bandeaux non reçus', 'Palette/Colis/Affiches reçus abîmés',
    'Papier de mauvaise qualité / Qualité zip', 'Reçu mauvaises affiches / bandeaux'];
  /* Contrôle réception (Pré-Prod, plateformes) : valeurs lues dans les exports SharePoint du 09/11 (« Réception Contrôle Préprod » et
     « … Plateformes ») ; d'autres valeurs existent peut-être dans la liste. Détail contrôle visuel et Statut état affiches s'ouvrent selon
     le contrôle choisi : déduit des exports, à confirmer. */
  const FORMATS_C = FORMATS.concat(['Autre format']);
  const CONTROLES = ['Contrôle du visuel', 'Format NC', 'Etat des affiches', 'Encre pas sèche'];
  const DETAIL_VISUEL = ['Thèmes', 'Qualité impression'];
  const STATUTS_ETAT = ['Non utilisable', 'Partiellement utilisables'];
  const GROUPE_1 = '1 - Décision plateforme attendue', GROUPE_2 = '2 - Action préproduction attendue', GROUPE_3 = '3 - RAF ou Traité par la Preprod ou Prise en compte Alerte';
  const opts = vals => M.uniq(vals.filter(Boolean)).map(v => ({ value: v, label: v }));
  /** Les 9 lignes des exports du 09/11 (liste « Réception Contrôle », Nîmes), point de départ des vues Plateformes et Préproduction. */
  const SEED_CTRL = () => {
    const ADMIN = 'LEPEUVE, PASCAL;GARREYN, CHRISTINE;SOLIGNAC, ARTHUR;BOSSA, PATRICK';
    const vide = { actionPreprod: '', actionPlateforme: '', decisionPreprod: '', reception: [], ncCond: '', ncBL: [], detailVisuel: [], imprimeurAutre: '', reserve: '', commentaire: '',
      numerosManquants: '', nbAffichesManquantes: '', mesureCm2: '', statutEtat: '', commentaireAgence: '', admin: ADMIN, numeroAffichesManquantes: '', ncQtesBT: '', nbColis: '', nbPalettes: '',
      afficheur: '', region: '', dateAff: '', typeNC: '', qteRecue: '', qteManquante: '', transporteurAutre: '', avarie: 'NON', plateforme: 'NÎMES', controlePossible: 'Vrai', pj: 1, fichiers: [],
      decisionPlateforme: 'Action Pre-Prod requise', commentaireDecisionPlateforme: '', groupeEtat: GROUPE_3 };
    return [
      { id: '94', titre: 'NÎMES - 11 02 2026 11:22', annonceur: 'MAIRIE AIX EN PROVENCE / VILLE D\'AVIGNON', dossier: '497440 / 499238+499239', decisionPreprod: 'NON JUSTIFIE', gestionnaire: 'BEN MZAHI, SAMIA;TARKANY, RAYANE',
        controle: ['Contrôle du visuel'], detailVisuel: ['Thèmes'], imprimeur: 'PRISMA FLEX', theme: 'NATATION SHOW / LES CLES DU FESTIVAL', formats: ['2 m² fixe'], declarant: 'SOLIGNAC, ARTHUR', transporteur: 'CALBERSON',
        commentaireNC: `Nous avons reçu 124 affiches "Natation Show" pour le dossier 49744 pour la mairie d'Aix en Provence alors que le B.L. indique 88 affiches "Les clés du festival" pour les dossiers 499238+499239 pour la ville d'Avignon.`, cree: '2026-02-11T11:27:00' },
      { id: '93', titre: 'NÎMES - 10 02 2026 14:32', annonceur: 'VILLE D\'AVIGNON OPERA', actionPreprod: 'PROBLEME RESOLU', dossier: '482188', gestionnaire: 'BEN MZAHI, SAMIA;TARKANY, RAYANE',
        controle: ['Contrôle du visuel'], detailVisuel: ['Thèmes'], imprimeur: 'AUTRE', imprimeurAutre: 'VILLE D\'AVIGNON', theme: 'LE CHANT DE LA TERRE', formats: ['2 m² fixe'], declarant: 'GARREYN, CHRISTINE',
        transporteur: 'AUTRE', transporteurAutre: 'VILLE D\'AVIGNON', commentaireNC: `NOUS AVONS RECU LE VISUEL "HELENE" POUR S22 ET NON "CHANT DE LA TERRE" S09 COMME INDIQUE SUR LE CARTON. LE THEME "AMERICA" EST OK.`, cree: '2026-02-10T14:38:00' },
      { id: '88', titre: 'NÎMES - 29 01 2026 15:02', annonceur: 'VILLE D\'AVIGNON', dossier: '', gestionnaire: 'BEN MZAHI, SAMIA;TARKANY, RAYANE', controle: ['Format NC'], imprimeur: 'AUTRE', imprimeurAutre: 'INCONNU',
        theme: 'FESTIVAL ANDALOU', pj: 0, formats: ['2 m² fixe'], declarant: 'SOLIGNAC, ARTHUR', transporteur: 'TNT', commentaireNC: 'AFFICHES TROP FINES ET LEGEREMENT PLASTIFIEES 120 GR', cree: '2026-01-29T15:07:00' },
      { id: '87', titre: 'NÎMES - 29 01 2026 14:05', annonceur: 'VILLE D\'AVIGNON', dossier: '497396', gestionnaire: 'BEN MZAHI, SAMIA;TARKANY, RAYANE', controle: ['Format NC'], reception: ['Bon de livraison Incomplet'],
        ncBL: ['Identification Dossier/ Bon Commande', 'Nom Annonceur', 'Visuel manquant', 'Thème'], imprimeur: 'AUTRE', imprimeurAutre: 'Votre imprimeur 14', theme: '25eme festival andalou', formats: ['Autre format', '8 m² déroulant'],
        declarant: 'BARIOD, JEREMY', transporteur: 'AUTRE', transporteurAutre: 'DPD', commentaireNC: 'Grammage papier non conforme=120 g, affiches 8m2  en trois morceaux, pas de présence de croix pour le calage. Affiches inutilisables.', cree: '2026-01-29T14:16:00' },
      { id: '83', titre: 'NÎMES - 28 01 2026 10:04', annonceur: 'FETER & RECEVOIR (5 DOSSIERS) + MONTPELLIER 2M² (4 DOSSIERS)', dossier: '491500+490884+491503+490925+491505+495499+495500+496593+496594',
        gestionnaire: 'PLANCHARD, FABRICE;RUFFINI, PIERRE;FARAND, HELENE;BEN MZAHI, SAMIA;VAY, KORALJKA;MOUSSAOUI, NORA;TARKANY, RAYANE', controle: ['Etat des affiches'], controlePossible: 'False', imprimeur: 'AUTRE', imprimeurAutre: 'PUBLITEX',
        theme: 'MULTI THEMES', statutEtat: 'Non utilisable', formats: ['2 m² déroulant', '2 m² fixe'], numeroAffichesManquantes: 'Intégralité', declarant: 'SOLIGNAC, ARTHUR', transporteur: 'DACHSER',
        commentaireNC: 'Les affiches sont gondolées donc inutilisables.\nDans l\'urgence et parce qu\'il y a peu de faces déroulantes, nous produisons les affiches pour la semaine 06 (surlignées en jaune sur le B.L.).\nMerci de faire réimprimer les autres.', cree: '2026-01-28T10:11:00' },
      { id: '75', titre: 'NÎMES - 14 01 2026 13:49', annonceur: 'CHAMBRE DES METIERS PACA', dossier: '491153', gestionnaire: 'TARKANY, RAYANE', controle: ['Contrôle du visuel', 'Encre pas sèche'], detailVisuel: ['Qualité impression'],
        imprimeur: 'AFFI COLOR', theme: 'COIFFURE', formats: ['2 m² fixe'], numeroAffichesManquantes: '82 ex. inutilisables', declarant: 'SOLIGNAC, ARTHUR', transporteur: 'CALBERSON',
        commentaireNC: 'Il y a des bavures sur le haut des affiches (peut-être dues à une expédition des affiches avant qu\'elles ne soient sèches).', cree: '2026-01-14T13:58:00' },
      { id: '73', titre: 'NÎMES - 08 01 2026 16:18', annonceur: 'MAIRIE AIX EN PROVENCE', dossier: '495337', decisionPreprod: 'Nouvelle impression/Livraison', gestionnaire: 'TARKANY, RAYANE', controle: ['Encre pas sèche'],
        imprimeur: 'AFFI COLOR', theme: 'AIXMAVILLE', formats: ['2 m² fixe', '2 m² déroulant'], declarant: 'GARREYN, CHRISTINE', transporteur: 'AUTRE', transporteurAutre: 'STEM',
        commentaireNC: 'L\'encre a coulé sur le haut de l\'affiche. Cela concerne environ 20 affiches.', cree: '2026-01-08T16:21:00' },
      { id: '69', titre: 'NÎMES - 23 12 2025 14:16', annonceur: 'Casino Barriere', dossier: '470471', decisionPreprod: 'Nouvelle impression/Livraison', gestionnaire: 'FARAND, HELENE;TARKANY, RAYANE', controle: ['Etat des affiches'],
        imprimeur: 'KVC PRINT', theme: `"blotzheim nvx jackpots" S02 ," Cap d'Agde nvx jackpots " s03/04 , "Toulouse nvx jackpots" s03`, statutEtat: 'Partiellement utilisables', formats: ['8 m² déroulant'],
        declarant: 'SCROLLING (Nimes)', transporteur: 'CALBERSON', cree: '2025-12-23T14:31:00',
        commentaireNC: `Nous allons perdre beaucoup de temps , mais nous allons fabriquée le thème "blotzheim nvx jackpots" S02 au vu de la petite quantités d'affiches pour ne pas mettre cette campagne en périls , cependant pour les thèmes " Cap d'Agde nvx jackpots " s03/04 , "Toulouse nvx jackpots" s03 , nous ne pouvons pas nous permettre de perdre plus de temps et nous n'aurons plus les effectifs nécessaire , il faudrait réimprimée ces affiches .` },
      { id: '43', titre: 'NÎMES - 18 11 2025 13:29', annonceur: 'Sud Concert S48', dossier: '', decisionPlateforme: 'RAF', gestionnaire: 'TARKANY, RAYANE', controle: ['Etat des affiches'], imprimeur: 'KVC PRINT',
        theme: 'm pokora toulon / star ac toulon ', statutEtat: 'Partiellement utilisables', formats: ['8 m² déroulant'], declarant: 'SCROLLING (Nimes)', transporteur: 'SCHENKER',
        commentaireNC: 'Les affiches ont un mauvais massicotage, nous les fabriquons mais nous mettons des réserves quant à la qualité finale des affiches.', cree: '2025-11-18T13:44:00' },
    ].map(r => Object.assign({}, vide, r));
  };

  /** Déclarants : la liste vient d'Administration › Paramétrage › Référentiels (import d'un Excel, ajout, retrait) ; les formulaires la lisent
      à chaque ouverture. Gardée sur le poste (localStorage, clé circe-maquette-declarants) ; M.sauverDeclarants est appelée par le Paramétrage. */
  const CLE_D = 'circe-maquette-declarants';
  const lireD = () => { try { const t = JSON.parse(localStorage.getItem(CLE_D)); if (Array.isArray(t)) return t.filter(x => typeof x === 'string' && x.trim()); } catch (e) { /* rien de gardé */ } return ['RAYANE TARKANY']; };
  M.ref.declarants = lireD();
  M.sauverDeclarants = () => { try { localStorage.setItem(CLE_D, JSON.stringify(M.ref.declarants)); } catch (e) { /* stockage indisponible : liste gardée pour la session */ } };
  const declarants = () => M.ref.declarants;
  const ROUGE = '#d63939';

  const vide = (titre, quoi) => ui.card({ title: titre, body: h('div', { class: 'cz-empty' },
    h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, 'Contenu à définir'),
    h('div', { class: 'small' }, quoi)) });

  /* ---------- Formulaires : deux modèles, un moteur ---------- */
  const COMMUN = { declarant: '', fichiers: [], commentaire: '', dossier: '', annonceur: '', theme: '', plateforme: '', essaye: false };
  const CFG = {
    // Réclamation agence : le formulaire des agences
    a: { cle: 'circe-maquette-nonconf', prefixe: 'NC', ou: 'Suivi des NC (demande Agence)', liste: null,
      nouveau: () => Object.assign({}, COMMUN, { fichiers: [], region: '', afficheur: '', format: '', lieu: '', dateAff: '', types: [] }),
      obligatoires: [['plateforme', 'Plateforme'], ['declarant', 'Déclarant'], ['region', 'Région concernée'], ['afficheur', 'Nom de l’afficheur'], ['dossier', 'N° de dossier BC'],
        ['annonceur', 'Annonceur'], ['theme', 'Thème'], ['format', 'Format'], ['dateAff', 'Date d’affichage'], ['types', 'Type de non conformité rencontrée']] },
    // Contrôle réception : le formulaire de la Pré-Prod et des plateformes. Une déclaration = une ligne de la liste SharePoint « Réception
    // Contrôle » (exports Préprod et Plateformes du 09/11) : mêmes colonnes, même GroupeEtat, mêmes décisions.
    c: { cle: 'circe-maquette-ctrl2', prefixe: '', ou: 'Suivi des NC (demande Plateformes)', liste: null,
      // 11/11 : semaine(s) et quantité concernée, avec le n° de dossier et le thème en tête du formulaire
      nouveau: () => Object.assign({}, COMMUN, { semaine: '', quantite: '', fichiers: [], imprimeur: '', imprimeurAutre: '', transporteur: '', transporteurAutre: '', formats: [], avarie: '', controlePossible: 'Oui',
        controle: [], detailVisuel: [], statutEtat: '', commentaireNC: '', numeroAffichesManquantes: '' }),
      obligatoires: f => [['plateforme', 'Plateforme'], ['annonceur', 'Annonceur'], ['imprimeur', 'Imprimeur'], f.imprimeur === 'AUTRE' ? ['imprimeurAutre', 'Imprimeur autre'] : null,
        ['transporteur', 'Transporteur'], f.transporteur === 'AUTRE' ? ['transporteurAutre', 'Transporteur autre'] : null, ['theme', 'Thème'], ['formats', 'Formats'],
        ['avarie', 'Présence avarie de transport'], ['controle', 'Contrôle réception']].filter(Boolean),
      versRecord: (f, liste) => {
        const now = new Date(), p = n => String(n).padStart(2, '0');
        const id = String(Math.max(94, ...liste.map(x => Number(x.id) || 0)) + 1);
        return { id, titre: f.plateforme + ' - ' + p(now.getDate()) + ' ' + p(now.getMonth() + 1) + ' ' + now.getFullYear() + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()),
          annonceur: f.annonceur, dossier: f.dossier, semaine: f.semaine, quantite: f.quantite, plateforme: f.plateforme, declarant: f.declarant, theme: f.theme, formats: f.formats, avarie: f.avarie,
          imprimeur: f.imprimeur, imprimeurAutre: f.imprimeur === 'AUTRE' ? f.imprimeurAutre : '', transporteur: f.transporteur, transporteurAutre: f.transporteur === 'AUTRE' ? f.transporteurAutre : '',
          controlePossible: f.controlePossible === 'Non' ? 'False' : 'Vrai', controle: f.controle, detailVisuel: f.controle.includes('Contrôle du visuel') ? f.detailVisuel : [],
          statutEtat: f.controle.includes('Etat des affiches') ? f.statutEtat : '', commentaire: f.commentaire, commentaireNC: f.commentaireNC, numeroAffichesManquantes: f.numeroAffichesManquantes,
          pj: f.fichiers.length, fichiers: f.fichiers, gestionnaire: '', admin: '', decisionPlateforme: '', decisionPreprod: '', actionPreprod: '', actionPlateforme: '', reception: [], ncBL: [],
          origine: 'Formulaire', cree: now.toISOString(), groupeEtat: GROUPE_1 };
      } },
  };
  const formes = { a: CFG.a.nouveau(), c: CFG.c.nouveau() };
  let quel = 'a', form = formes.a;
  /** Formulaire affiché : le déclarant doit être dans la liste d'Administration (un nom retiré depuis n'est plus proposé) ; sinon le premier. */
  const ouvrir = k => { quel = k; form = formes[k]; if (!declarants().includes(form.declarant)) form.declarant = declarants()[0] || ''; };
  // Contrôles de réception : la première fois, les 9 lignes des exports SharePoint du 09/11 (Nîmes, novembre 2025 à février 2026)
  const stock = k => CFG[k].liste || (CFG[k].liste = (() => { const t = lire(CFG[k].cle); if (k === 'c' && !t.length && !localStorage.getItem(CFG[k].cle)) { const s = SEED_CTRL(); garder(CFG[k].cle, s); return s; }
    t.forEach(r => { if (r && r.plateforme === FPI_ANCIEN) r.plateforme = 'FPI / Autre'; }); return t; })());
  const manquant = k => (Array.isArray(form[k]) ? !form[k].length : !String(form[k] || '').trim());

  /** Champ étiqueté, astérisque rouge pour un champ obligatoire. */
  const champ = (label, controle, obligatoire) => h('label', { class: 'field wide', style: { margin: 0 } },
    h('span', { class: 'form-label' }, obligatoire ? h('span', { style: { color: ROUGE, marginRight: '6px', fontWeight: 700 } }, '*') : null, label), controle);
  /* 12/11 (utilisatrice) : après un pré-remplissage depuis le dossier, ce qui reste vide parmi les champs obligatoires (étoile) est
     signalé « à compléter » (cadre ambre, mention écrite à côté du libellé) ; les champs sans étoile restent neutres, même vides. */
  const obligatoiresDe = () => { const o = CFG[quel].obligatoires; return (typeof o === 'function' ? o(form) : o) || []; };
  const aCompleter = k => !!form.preRempli && obligatoiresDe().some(([x]) => x === k) && manquant(k);
  const marque = (el, k) => { if (form.essaye && manquant(k)) el.classList.add('is-invalid'); if (aCompleter(k)) el.classList.add('cz-a-completer'); return el; };
  /** Le bandeau « reste à compléter » du formulaire pré-rempli, mis à jour pendant la saisie. */
  let resumeEl = null;
  const majResume = () => {
    if (!resumeEl) return;
    const reste = obligatoiresDe().filter(([k]) => manquant(k)).map(([, l]) => l);
    M.mount(resumeEl, form.preRempli ? ui.callout(reste.length ? 'warning' : 'good', 'Pré-rempli depuis le dossier ' + form.preRempli.dossier,
      reste.length ? ' Reste à compléter (champs avec étoile) : ' + reste.join(', ') + '. Les champs sans étoile sont facultatifs.' : ' Tous les champs avec étoile sont remplis. Les champs sans étoile sont facultatifs.') : null);
  };
  // refresh : redessiner au changement (un champ dépend de la valeur, ex. « Imprimeur autre » quand on choisit AUTRE) ; formulaire
  // pré-rempli : aussi, pour retirer le signal « à compléter »
  const liste = (k, vide, options, refresh) => { const s = ui.select({ value: form[k], label: vide, options: [{ value: '', label: vide }].concat(options.map(o => ({ value: o, label: o }))), onChange: v => { form[k] = v; if (form.essaye || form.preRempli || refresh) M.refresh(); } }); return marque(s, k); };
  const texte = (k, placeholder, type) => marque(h('input', { class: 'form-control', type: type || 'text', value: form[k] || '', placeholder, 'aria-label': placeholder || k,
    oninput: e => { form[k] = e.target.value; if (form.preRempli) { e.target.classList.toggle('cz-a-completer', aCompleter(k)); majResume(); } } }), k);

  /** Liste déroulante à cases à cocher (plusieurs choix) : type de non-conformité, formats. */
  function multi(k, placeholder, options) {
    const resume = () => (form[k].length ? form[k].join(' · ') : placeholder);
    const btn = h('button', { type: 'button', class: ['form-select', 'text-start', form[k].length ? '' : 'text-muted'], 'aria-haspopup': 'true' }, resume());
    btn.addEventListener('click', () => {
      if (btn._close) { btn._close(); return; }
      const r = btn.getBoundingClientRect();
      const menu = ui.menuAt(btn, Math.max(r.width, 420));
      let change = false;
      M.mount(menu, options.map(t => ui.checkbox(t, form[k].includes(t), v => {
        form[k] = v ? form[k].concat([t]) : form[k].filter(x => x !== t); change = true;
        btn.textContent = resume(); btn.classList.toggle('text-muted', !form[k].length); btn.classList.remove('is-invalid');
      })));
      menu.querySelectorAll('.form-check').forEach(e => { e.style.display = 'flex'; e.style.margin = '6px 12px'; });
      // À la fermeture, la page se redessine si le choix a changé (champs qui en dépendent, ex. « Détail contrôle visuel »)
      btn._close = ui.popup(menu, () => { btn._close = null; if (change) M.refresh(); }, btn);
    });
    return marque(btn, k);
  }

  /** Justificatifs : photos, PDF ou autre fichier (seul le nom est gardé par la maquette). */
  function fichiersField() {
    const input = h('input', { type: 'file', multiple: true, style: { display: 'none' }, onchange: e => {
      Array.from(e.target.files).forEach(f => form.fichiers.push({ nom: f.name, taille: f.size }));
      M.refresh();
    } });
    return h('div', { class: 'cz-joints', style: { border: '1px solid var(--border-strong)', borderRadius: '4px', minHeight: '140px', padding: '14px 16px', background: '#fff' } },
      form.fichiers.length
        ? h('ul', { style: { margin: '0 0 10px', paddingLeft: '18px' } }, form.fichiers.map((f, i) => h('li', null, f.nom, ' ', h('span', { class: 'small muted' }, '(' + Math.max(1, Math.round(f.taille / 1024)) + ' ko) '),
          h('button', { type: 'button', class: 'linkish', onclick: () => { form.fichiers.splice(i, 1); M.refresh(); } }, 'Retirer'))))
        : h('div', { style: { fontSize: '16px', marginBottom: '10px' } }, 'Rien de joint.'),
      ui.btn('Joindre un fichier', () => input.click(), { small: true, icon: 'plus' }), input);
  }

  function envoyer() {
    const cfg = CFG[quel];
    form.essaye = true;
    const obl = typeof cfg.obligatoires === 'function' ? cfg.obligatoires(form) : cfg.obligatoires;
    const manques = obl.filter(([k]) => manquant(k)).map(([, l]) => l);
    if (manques.length) { M.refresh(); ui.toast('À remplir : ' + manques.join(', ') + '.', 'warning'); return; }
    const liste = stock(quel);
    const d = cfg.versRecord ? cfg.versRecord(form, liste) : Object.assign({}, form, { id: cfg.prefixe + String(liste.length + 1).padStart(4, '0'), date: new Date().toISOString() });
    delete d.essaye;
    liste.unshift(d);
    garder(cfg.cle, liste);
    formes[quel] = cfg.nouveau(); form = formes[quel];
    M.refresh();
    ui.toast('Déclaration ' + d.id + ' envoyée : elle apparaît dans ' + cfg.ou + '.', 'good');
  }
  const pied = () => h('div', { class: 'card-footer', style: { display: 'flex', justifyContent: 'flex-end', gap: '10px' } },
    ui.btn('Annuler', () => { formes[quel] = CFG[quel].nouveau(); form = formes[quel]; M.refresh(); }),
    ui.btn('Envoyer', envoyer, { primary: true }));

  /** Nouvelle demande (10/11) : deux boutons, « Usage réservé aux plateformes » (ex « Pré-production », renommé le 11/11) puis
      « Agence » (ordre inversé le 11/11) ; le bouton choisi ouvre son formulaire en dessous.
      Le choix est gardé pendant la session ; ?type=agence|preprod le pose à l'arrivée. */
  let choix = null, choixSeq = -1;
  /** Couleur de chaque demande (11/11, à sa demande) : le bouton choisi se remplit de sa couleur et son formulaire la reprend.
      Pas de bleu (collègue daltonienne) ; la couleur est doublée par le nom écrit (bandeau du formulaire, « ✓ Choisi »).
      Teintes plus foncées que l'orange « sérieux » et le violet des annotations ; texte blanc lisible sur les deux (contraste > 5).
      nom : le nom court de la demande, celui du bandeau et de la colonne « Demande » du suivi. */
  const TEINTE = { a: { fort: '#c2410c', clair: '#fff4ec', nom: 'Agence' }, c: { fort: '#6f42c1', clair: '#f5f0fd', nom: 'Plateformes' } };
  function vueNouvelle(root, params) {
    if (params.type && choixSeq !== M.navSeq) { choixSeq = M.navSeq; choix = params.type === 'agence' ? 'a' : 'c'; }
    // Le bouton choisi : rempli de sa couleur, bordure épaisse et mention « Choisi » ; l'autre garde sa couleur en liseré à gauche
    const bouton = (k, titre, qui, quoi) => { const t = TEINTE[k], pris = choix === k;
      return h('button', { type: 'button', 'aria-pressed': String(pris),
        style: { textAlign: 'left', padding: '18px 20px', cursor: 'pointer', borderRadius: '6px',
          background: pris ? t.fort : '#fff', color: pris ? '#fff' : 'inherit',
          border: pris ? '3px solid ' + t.fort : '1px solid var(--border-strong, #ccc)', borderLeft: '8px solid ' + t.fort },
        onclick: () => { choix = k; M.refresh(); } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' } },
          h('span', { style: { fontSize: '18px', fontWeight: 700, color: pris ? '#fff' : t.fort } }, titre), pris ? h('span', { class: 'small', style: { fontWeight: 700 } }, '✓ Choisi') : null),
        qui ? h('div', { class: 'small', style: { fontWeight: 600, marginTop: '4px' } }, qui) : null,
        h('div', { class: pris ? 'small' : 'small muted', style: { marginTop: '4px', opacity: pris ? '.92' : '1' } }, quoi)); };
    root.append(ui.pageHead({ crumb: 'Non-conformité', title: 'Nouvelle demande', screen: 'nonconformite',
        actions: [ui.btn('Suivi des NC', () => M.go('nonconformite', { tab: 'suivi' }), { icon: 'list-check' })] }),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '980px', marginBottom: '16px' } },
        // 11/11 (utilisatrice) : plus de sous-titre ; le bouton orange s'appelle « Usage réservé aux agences »
        bouton('c', 'Usage réservé aux plateformes', null, 'Non-conformité constatée au contrôle de la marchandise à la plateforme (visuel, format, état des affiches, encre…).'),
        bouton('a', 'Usage réservé aux agences', null, 'Non-conformité constatée à la réception des affiches en agence (affiches manquantes, abîmées, mauvais visuel…).')),
      // 11/11 : le pré-remplissage depuis le dossier, au-dessus du formulaire des plateformes, en grand
      choix === 'a' ? carteAgence() : choix === 'c' ? h('div', null, blocPreRemplir(), carteControle())
        : h('div', { class: 'cz-empty', style: { maxWidth: '980px' } }, 'Choisissez le type de demande : le formulaire s’ouvre ici.'));
  }

  /** Le formulaire reprend la couleur de son bouton (11/11) : cadre, bandeau avec le nom de la demande, en-tête teinté. */
  const cadre = k => ({ maxWidth: '980px', border: '2px solid ' + TEINTE[k].fort, overflow: 'hidden' });
  const bandeau = k => h('div', { style: { background: TEINTE[k].fort, color: '#fff', padding: '8px 20px', fontWeight: 700, fontSize: '13px', letterSpacing: '.05em', textTransform: 'uppercase' } },
    'Demande ' + TEINTE[k].nom);
  const entete = k => ({ display: 'block', background: TEINTE[k].clair, borderBottom: '3px solid ' + TEINTE[k].fort });

  /** Formulaire Agence. */
  function carteAgence() {
    ouvrir('a');
    return h('section', { class: 'card', style: cadre('a') },
        bandeau('a'),
        h('div', { class: 'card-header', style: entete('a') },
          // Seulement « Usage réservé aux Agences » (09/11)
          h('h2', { class: 'card-title', style: { fontSize: '20px' } }, 'Usage réservé aux Agences'),
          h('div', { style: { color: ROUGE, fontSize: '12px', marginTop: '2px' } }, 'Ce formulaire est uniquement destiné à remonter les non-conformités détectées lors d’une réception d’affiches en Agence')),
        h('div', { class: 'card-body' },
          h('div', { class: 'stack', style: { gap: '14px' } },
            champ('PLATEFORME', liste('plateforme', 'Sélectionner la plateforme', PLATEFORMES), true),
            champ('Déclarant / Émetteur de la non-conformité', liste('declarant', 'Sélectionner le déclarant', declarants()), true),
            champ('Région Concernée', liste('region', 'Sélectionner la région concernée', REGIONS), true),
            champ('Nom de l’Afficheur', texte('afficheur', 'Tel que mentionné sur les feuilles de route en haut à droite. Exemple : DURAND PATRICK (8765)'), true),
            champ('N° de dossier BC', texte('dossier', ''), true),
            champ('Annonceur', texte('annonceur', ''), true),
            champ('Thème', texte('theme', ''), true),
            champ('Format', liste('format', 'Sélectionner le format', FORMATS), true),
            champ('Lieu de livraison des affiches', texte('lieu', 'indiquer l’agence ou le nom du sous-traitant qui doit recevoir les affiches'), false),
            champ('Saisir la date d’affichage', texte('dateAff', '1er départ', 'date'), true),
            champ('Type de Non conformité rencontrée', multi('types', 'Sélectionner le type de non conformité', TYPES), true),
            champ('Justifs reception / Joindre une photo - Si besoin; photo, pdf ou autre type de fichier', fichiersField(), false),
            champ('Commentaires supplémentaires sur le contrôle de la livraison', texte('commentaire', ''), false))),
        pied());
  }

  /** Formulaire « Usage réservé aux plateformes » (ex Pré-production, 11/11) : le formulaire Contrôle réception de la Pré-Prod et des
      plateformes. Titre sur le modèle de « Usage réservé aux Agences ». */
  /* Cas proposés à partir du n° de dossier (11/11, utilisatrice : « sur le côté, les différents cas pour que ça pré-remplisse la
     demande, pour que ce soit beaucoup plus rapide ») : chaque thème des dossiers trouvés (n° de dossier, de DA ou annonceur), avec
     ses semaines, sa quantité reçue et sa dernière réception. Un clic remplit la demande ; tout reste modifiable ; dossier inconnu :
     saisie libre. Les dossiers de la plateforme choisie passent en premier. */
  /** Le format du dossier dans la liste du formulaire (« scrolling » = déroulant) ; sinon « Autre format ». */
  const formatDe = f => {
    const s = String(f || ''), m = s.match(/^(\d+)\s*m²/i), n = m ? m[1] : '';
    const v = /bus/i.test(s) ? 'BUS' : /scroll|déroul/i.test(s) ? n + ' m² déroulant' : /coll/i.test(s) ? n + ' m² Colle' : /fixe/i.test(s) ? n + ' m² fixe' : s;
    return FORMATS_C.find(x => x.toLowerCase() === v.toLowerCase()) || 'Autre format';
  };
  /** Thèmes des dossiers trouvés (n° de dossier, de DA, annonceur). 11/11 (utilisatrice) : seulement ce qui a été reçu à la
      plateforme ; un thème seulement envoyé en prépa, sans affiche reçue, n'est pas proposé. Renvoie { cas, sansReception } ou null. */
  const casDossier = q => {
    const D = M.data, C = M.calc; q = String(q || '').trim().toLowerCase();
    if (q.length < 2 || !D || !D.dossiers || !C) return null;
    const site = PTF_SITE[form.plateforme];
    const ds = D.dossiers.filter(d => String(d.id).includes(q) || String(d.da || '').includes(q) || String(d.no || '').includes(q) || String(d.annonceur || '').toLowerCase().includes(q))
      .sort((x, y) => (String(y.id) === q) - (String(x.id) === q) || (y.site === site) - (x.site === site) || String(x.id).localeCompare(String(y.id))).slice(0, 8);
    const tous = ds.flatMap(d => (d.themes || []).map(C.theme).filter(Boolean).map(t => {
      const affs = D.affiches.filter(a => a.statut !== 'ORPHELINE' && (a.alloc || []).some(x => x.themeId === t.id));
      const recs = affs.map(a => D.receptions.find(r => r.id === a.receptionId)).filter(Boolean).sort((x, y) => new Date(y.date) - new Date(x.date));
      return { d, t, affs, recu: C.recu(t.id), rec: recs[0] || null };
    }));
    const cas = tous.filter(c => c.affs.length && c.recu > 0);
    return { cas, sansReception: M.uniq(tous.filter(c => !(c.affs.length && c.recu > 0)).map(c => c.d.id)) };
  };
  /** Validation admin des affiches d'un thème (le rattachement affiche → thème) : confirmée, proposée ou avec un doute. */
  const vaTheme = affs => {
    const C = M.calc, e = affs.map(a => (C && C.vaEtat ? C.vaEtat(a) : ''));
    return e.length && e.every(x => x === 'MANUELLE') ? ['good', 'Rattachement confirmé'] : e.includes('A_FAIRE') ? ['warning', 'Rattachement à confirmer (doute)'] : ['warning', 'Rattachement proposé, à confirmer'];
  };
  function preRemplir(c) {
    const { d, t, recu, rec } = c;
    const dans = (vals, v) => (v && vals.includes(v) ? [v, ''] : v ? ['AUTRE', v] : ['', '']);
    Object.assign(form, { plateforme: SITE_PTF[d.site] || form.plateforme, dossier: String(d.id), semaine: (d.semaines || [d.semaine]).map(s => 'S' + s).join('+'),
      quantite: String(recu || t.qteEnt || ''), theme: t.libelle, annonceur: d.annonceur, formats: [formatDe(d.format)], preRempli: { dossier: String(d.id), theme: t.libelle } });
    if (rec) {
      [form.imprimeur, form.imprimeurAutre] = dans(M.ref.imprimeurs, rec.imprimeur && rec.imprimeur !== '—' ? rec.imprimeur : '');
      [form.transporteur, form.transporteurAutre] = dans(M.ref.transporteursEntrants, rec.transporteur || '');
    }
    M.refresh();
    ui.toast('Demande pré-remplie : dossier ' + d.id + ', « ' + t.libelle + ' ». Vérifiez la quantité concernée ; les champs à étoile encore vides sont signalés « à compléter ».', 'good');
  }
  /** Bloc « Pré-remplir depuis le dossier » (11/11, utilisatrice : « en dehors et un peu plus grand ») : au-dessus du formulaire,
      pleine largeur, sa propre recherche et un tableau des thèmes reçus. La frappe ne redessine que le tableau (le curseur reste). */
  let rechercheNC = '';
  function blocPreRemplir() {
    const resultats = h('div');
    const ligneCas = c => {
      const pris = form.dossier === String(c.d.id) && form.theme === c.t.libelle, [sev, va] = vaTheme(c.affs);
      return h('tr', { class: pris ? 'is-sel' : '' },
        h('td', null, h('b', null, (pris ? '✓ ' : '') + c.d.id), h('div', { class: 'small muted' }, SITE_PTF[c.d.site] || c.d.site)),
        // 12/11 (utilisatrice) : la semaine dans sa colonne
        h('td', { class: 'nowrap' }, (c.d.semaines || [c.d.semaine]).map(s => 'S' + s).join('+')),
        h('td', null, h('b', null, c.t.libelle), h('div', { class: 'small' }, c.d.annonceur + ' · ' + c.d.format)),
        h('td', { class: 'num' }, M.fmt.n(c.recu) + ' / ' + M.fmt.n(c.t.qteEnt)),
        h('td', null, h('div', { class: 'small mono' }, c.affs.map(a => a.id).join(', ')), ui.sev(sev, va)),
        h('td', { class: 'small' }, c.rec ? [M.fmt.dy(new Date(c.rec.date)), h('div', null, 'BL ' + (c.rec.bl || 'sans BL') + ' · ' + (c.rec.imprimeur || '—'))] : '—'),
        h('td', null, ui.btn(pris ? 'Pré-rempli' : 'Pré-remplir', () => preRemplir(c), { small: true, primary: !pris, icon: pris ? 'check' : 'arrow-right' })));
    };
    const maj = () => {
      const r = casDossier(rechercheNC);
      M.mount(resultats,
        r === null ? h('div', { class: 'muted', style: { padding: '6px 2px' } }, 'Tapez un n° de dossier, de DA ou un annonceur : les thèmes déjà reçus à la plateforme s’affichent ici. Un clic sur « Pré-remplir » remplit la demande.')
          : !r.cas.length ? h('div', { style: { padding: '6px 2px' } }, r.sansReception.length ? 'Dossier ' + r.sansReception.join(', ') + ' trouvé, mais rien n’a encore été reçu à la plateforme : pas de cas à proposer (saisie libre).' : 'Aucun dossier trouvé pour « ' + rechercheNC + ' » : saisie libre.')
          : h('div', { class: 'table-wrap', style: { maxHeight: '360px', overflowY: 'auto' } }, h('table', { class: 'dt' },
            h('thead', null, h('tr', null, ['Dossier', 'Semaine(s)', 'Thème', 'Reçu / attendu', 'Affiches et validation admin', 'Dernière réception', ''].map(x => h('th', null, x)))),
            h('tbody', null, r.cas.map(ligneCas)))),
        r && r.cas.length && r.sansReception.length ? h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Pas proposés, rien de reçu : dossier ' + r.sansReception.join(', ') + '.') : null);
    };
    maj();
    return h('section', { class: 'card', 'aria-label': 'Pré-remplir depuis le dossier', style: { maxWidth: '1280px', marginBottom: '16px', border: '2px solid ' + TEINTE.c.fort } },
      h('div', { class: 'card-header', style: { display: 'block', background: TEINTE.c.clair } },
        h('h3', { class: 'card-title', style: { fontSize: '17px', color: TEINTE.c.fort } }, 'Pré-remplir depuis le dossier'),
        h('div', { class: 'small', style: { marginTop: '2px' } }, 'Seuls les thèmes déjà reçus à la plateforme sont proposés. Tout reste modifiable dans le formulaire.')),
      h('div', { class: 'card-body', style: { display: 'grid', gap: '10px' } },
        h('input', { class: 'form-control form-control-lg', type: 'search', value: rechercheNC, placeholder: 'N° de dossier, de DA ou annonceur', 'aria-label': 'Rechercher un dossier pour pré-remplir',
          style: { fontSize: '17px', maxWidth: '520px' }, oninput: e => { rechercheNC = e.target.value; maj(); } }),
        resultats));
  }
  function carteControle() {
    ouvrir('c');
    resumeEl = h('div'); majResume(); // 12/11 : « Reste à compléter » après un pré-remplissage
    // 11/11 : n° de dossier, semaine(s), quantité et thème juste après plateforme et déclarant
    return h('section', { class: 'card', style: cadre('c') },
        bandeau('c'),
        h('div', { class: 'card-header', style: entete('c') },
          h('h2', { class: 'card-title', style: { fontSize: '20px' } }, 'Usage réservé aux plateformes'),
          h('div', { class: 'small', style: { fontWeight: 600, marginTop: '2px' } }, 'Contrôle réception : déclaration d’une non conformité')),
        h('div', { class: 'card-body' },
          h('div', { class: 'stack', style: { gap: '14px' } },
            resumeEl,
            champ('Plateforme', liste('plateforme', 'Sélectionner la plateforme', PLATEFORMES), true),
            champ('Déclarant', liste('declarant', 'Sélectionner le déclarant', declarants()), false),
            champ('N° de dossier BC', texte('dossier', ''), false),
            champ('Semaine(s)', texte('semaine', 'ex. S45, ou S45+S46 pour un dossier multi-semaines'), false),
            champ('Quantité concernée', texte('quantite', 'nombre d’affiches concernées', 'number'), false),
            champ('Thème', texte('theme', ''), true),
            champ('Annonceur', texte('annonceur', ''), true),
            // Imprimeurs et transporteurs : les listes d'Administration › Référentiels (les mêmes que le bon de livraison de la réception),
            // plus « AUTRE », qui ouvre le champ « … autre » comme dans la liste SharePoint
            champ('Imprimeur', liste('imprimeur', 'Sélectionner l’imprimeur', M.ref.imprimeurs.concat(['AUTRE']), true), true),
            form.imprimeur === 'AUTRE' ? champ('Imprimeur autre', texte('imprimeurAutre', 'Nom de l’imprimeur'), true) : null,
            champ('Transporteur', liste('transporteur', 'Sélectionner le transporteur', M.ref.transporteursEntrants.concat(['AUTRE']), true), true),
            form.transporteur === 'AUTRE' ? champ('Transporteur autre', texte('transporteurAutre', 'Nom du transporteur'), true) : null,
            champ('Formats', multi('formats', 'Sélectionner les formats', FORMATS_C), true),
            champ('Présence avarie de transport', liste('avarie', 'Sélectionner', ['OUI', 'NON']), true),
            champ('Commentaires supplémentaires sur le contrôle de livraison', texte('commentaire', ''), false),
            // Exports du 09/11 : « Contrôle possible » vaut Vrai / False ; « Contrôle réception » est un choix multiple
            champ('Le contrôle de la marchandise est-il possible ?', liste('controlePossible', 'Sélectionner', ['Oui', 'Non']), false),
            champ('Contrôle réception', multi('controle', 'Sélectionner les contrôles', CONTROLES), true),
            form.controle.includes('Contrôle du visuel') ? champ('Détail contrôle visuel', multi('detailVisuel', 'Sélectionner', DETAIL_VISUEL), false) : null,
            form.controle.includes('Etat des affiches') ? champ('Statut de non conformité état affiches', liste('statutEtat', 'Sélectionner', STATUTS_ETAT), false) : null,
            champ('Commentaire de non conformité du contrôle de la marchandise', texte('commentaireNC', ''), false),
            champ('Justificatifs', fichiersField(), false),
            champ('N° d’affiche manquante', texte('numeroAffichesManquantes', ''), false))),
        pied());
  }

  /** Demandes des agences mises au format du tableau commun (10/11) : titre, type de NC, formats, date de création. Les champs propres
      aux agences (région, afficheur, lieu, date d'affichage) ont leur colonne. Complète la ligne gardée, sans rien retirer. */
  const normA = r => {
    if (r.source === 'Agence') return r;
    const d = new Date(r.date || Date.now()), p = n => String(n).padStart(2, '0');
    return Object.assign(r, { source: 'Agence', origine: 'Formulaire', cree: r.cree || d.toISOString(), typeNC: r.typeNC || (r.types || []).slice(),
      formats: r.formats || (r.format ? [r.format] : []), pj: (r.fichiers || []).length, decisionPreprod: r.decisionPreprod || '',
      titre: r.titre || 'AGENCE ' + (r.region || '') + ' - ' + p(d.getDate()) + ' ' + p(d.getMonth() + 1) + ' ' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) });
  };
  /** Toutes les non-conformités, les deux demandes ensemble, la plus récente d'abord. */
  const toutes = () => stock('c').concat(stock('a').map(normA)).sort((x, y) => String(y.cree).localeCompare(String(x.cree)));
  const demande = r => (r.source === 'Agence' ? TEINTE.a.nom : TEINTE.c.nom); // Agence ou Plateformes (ex Pré-production, 11/11)
  /** Garde la liste d'où vient la ligne. */
  const sauver = r => (r.source === 'Agence' ? garder(CFG.a.cle, stock('a')) : garder(CFG.c.cle, stock('c')));

  /* ---------- Réception contrôlée : la liste « Réception Contrôle », deux vues (exports SharePoint du 09/11) ----------
     Plateformes et Préproduction montrent les mêmes lignes, chacune avec l'ordre de colonnes de sa vue SharePoint et sa décision :
     « Décision Plateforme » (flux RCPTCONT_ChangeDécisionPlateforme) et « Décision Préproduction » (RCPTCONT_ChangeDécisionPreprod). Aujourd'hui
     ces flux utilisent SharePoint et Office 365 Outlook : dans la maquette, la décision met la ligne à jour et le mail est simulé. */
  const arr = v => (Array.isArray(v) ? v.join(' · ') : v === undefined || v === null ? '' : String(v));
  const quand = v => { const d = new Date(v); return isNaN(d) ? String(v || '') : M.fmt.dy(d) + ' ' + M.fmt.hm(d); };
  const COLS = {
    titre: ['Titre'], annonceur: ['Annonceur', 220], actionPreprod: ['Action préproduction'], actionPlateforme: ['Action plateforme'], dossier: ['N° de dossier BC', 180],
    decisionPreprod: ['Décision préproduction - plateforme'], gestionnaire: ['Gestionnaire préproduction', 200], controle: ['Contrôle réception', 200], avarie: ['Présence avarie de transport'],
    decisionPlateforme: ['Décision plateforme'], commentaireDecisionPlateforme: ['Commentaire de la décision plateforme', 240], reception: ['Réception'], ncCond: ['Type de Non conformité Conditionnement'],
    ncBL: ['Type de Non conformité Bon de livraison', 240], controlePossible: ['Contrôle possible'], detailVisuel: ['Détail contrôle visuel'], imprimeur: ['Imprimeur'], imprimeurAutre: ['Imprimeur autre'],
    plateforme: ['Plateforme'], theme: ['Thème', 240], reserve: ['Réserve sur la livraison'], pj: ['Pièces jointes'], commentaire: ['Commentaires supplémentaires sur le contrôle de la livraison', 280],
    commentaireNC: ['Commentaire de non conformité du contrôle de la marchandise', 360], numerosManquants: ['Numéros manquants'], nbAffichesManquantes: ['Nombre d’affiches manquantes'],
    mesureCm2: ['Mesure en cm2'], statutEtat: ['Statut de non conformité état affiches'], formats: ['Formats', 200], commentaireAgence: ['Commentaire Pre-Production / Plateforme si non conformité via Agence', 240],
    admin: ['Admin plateforme', 240], numeroAffichesManquantes: ['Numéro d’affiches manquantes'], ncQtesBT: ['Type de Non conformité Qtés manquantes du Bon de transport'],
    nbColis: ['Nombre de colis manquants'], nbPalettes: ['Nombre de palettes manquantes'], afficheur: ['Nom de l’afficheur'], region: ['Région'], declarant: ['Déclarant'], dateAff: ['Date d’affichage'],
    typeNC: ['Type de non conformité rencontré'], qteRecue: ['Quantité reçue'], qteManquante: ['Quantité manquante'], cree: ['Créé'], id: ['ID'], groupeEtat: ['GroupeEtat', 260],
    transporteur: ['Transporteur'], transporteurAutre: ['Transporteur autre'],
    // Colonnes ajoutées le 09/11 (non-conformité déclarée depuis la réception)
    origine: ['Origine'], bloquante: ['Bloquante'], affiches: ['N° d’affiche', 160], receptionId: ['Réception'], statut: ['Statut'],
    // 10/11 : un seul tableau Agence + Pré-production
    demande: ['Demande'], lieu: ['Lieu de livraison (agence)'],
    // 11/11 : formulaire des plateformes (semaine(s), quantité concernée) ; réponses de la plateforme (bloc 2 du panneau de décision)
    semaine: ['Semaine(s)'], quantite: ['Quantité concernée'], reponses: ['Réponses de la plateforme', 300], traiteLe: ['Traité le'],
  };
  COLS.decisionPreprod = ['Décision', 220]; // 10/11 : une seule liste de décisions (Pré-Prod, puis plateforme pour « Traité »)
  COLS.decisionPlateforme = ['Décision plateforme (ancienne liste SharePoint)'];
  /* Un seul tableau depuis le 09/11 (à sa demande : « fusionne les pages plateformes et préproduction ») : toutes les colonnes des deux
     exports, dans l'ordre de la vue Préproduction, complété par celles que seule la vue Plateformes avait (transporteur, commentaire de la
     décision plateforme) et par les colonnes de la réception. « vis » : colonnes affichées d'emblée (les autres sont dans « Colonnes »). */
  const ORDRE = ['titre', 'demande', 'origine', 'bloquante', 'statut', 'annonceur', 'actionPreprod', 'actionPlateforme', 'dossier', 'semaine', 'quantite', 'affiches', 'receptionId', 'decisionPreprod', 'reponses', 'traiteLe', 'gestionnaire', 'controle', 'typeNC', 'avarie',
    'decisionPlateforme', 'commentaireDecisionPlateforme', 'admin', 'reception', 'ncCond', 'ncBL', 'controlePossible', 'detailVisuel', 'imprimeur', 'imprimeurAutre', 'transporteur', 'transporteurAutre',
    'plateforme', 'theme', 'reserve', 'pj', 'commentaire', 'commentaireNC', 'numerosManquants', 'nbAffichesManquantes', 'mesureCm2', 'statutEtat', 'formats', 'commentaireAgence', 'numeroAffichesManquantes',
    'ncQtesBT', 'nbColis', 'nbPalettes', 'afficheur', 'region', 'lieu', 'declarant', 'dateAff', 'qteRecue', 'qteManquante', 'cree', 'id', 'groupeEtat'];
  const VIS = ['titre', 'demande', 'origine', 'bloquante', 'statut', 'annonceur', 'dossier', 'semaine', 'quantite', 'plateforme', 'typeNC', 'controle', 'decisionPreprod', 'gestionnaire', 'theme', 'commentaireNC', 'formats', 'declarant', 'cree'];
  const decisions = () => M.NC_DECISIONS.map(x => x[0]); // lue à l'usage : M.NC_DECISIONS est défini plus bas
  /** GroupeEtat : seul le groupe 3 figure dans les exports ; les groupes 1 et 2 sont des hypothèses de la maquette, à confirmer.
      Une non-conformité non bloquante déclarée à la réception n'attend aucune décision : groupe 3 d'emblée. */
  /** Décisions à plusieurs choix (10/11, à sa demande) : une liste de valeurs ; les lignes des exports, à une seule valeur, sont lues telles quelles. */
  const dec = v => (Array.isArray(v) ? v : v ? [v] : []);
  const groupe = r => (dec(r.decisionPreprod).length || dec(r.decisionPlateforme).some(x => ['RAF', 'Alerte OK PTF'].includes(x)) ? GROUPE_3 : dec(r.decisionPlateforme).length ? GROUPE_2 : r.bloquante === false ? GROUPE_3 : GROUPE_1);
  const tagBloquante = r => (r.bloquante === true ? ui.sev('critical', 'Bloquante') : r.bloquante === false ? ui.sev('warning', 'Non bloquante') : h('span', { class: 'muted' }, '—'));
  /** Une non-conformité bloquante est réglée par une décision : la préproduction pour une réception inconnue (« son go »), la
      plateforme ou la préproduction sinon. */
  const reglee = r => dec(r.decisionPreprod).length > 0; // 10/11 : une seule décision ; la décision plateforme des exports reste en lecture

  /* ---------- Non-conformité déclarée depuis Réception des affiches (09/11) ---------- */
  const SITE_PTF = { WIS: 'WISSOUS', NIM: 'NÎMES', NAN: 'BUS' };
  const PTF_SITE = { WISSOUS: 'WIS', 'NÎMES': 'NIM', BUS: 'NAN' };
  /** Les non-conformités possibles à la réception et leur portée (slide « Liste des options de NC + décisions à la réception », 10/11) :
      la portée se déduit de l'item coché ; les deux « à préciser » demandent de choisir. Thèmes mélangés, Formats mélangés et Palettes non
      conformes sont en bloquante avec « ?? » sur le slide : à confirmer. */
  M.NC_BLOQUANTES = ['Affiches trempées ou abîmées', 'Encre qui a coulé', 'Erreur de format (ex. scro reçu à la place de colle)', 'Erreur de papier', 'Casse à la production',
    'Thèmes mélangés', 'Formats mélangés', 'Palettes non conformes'];
  M.NC_NON_BLOQUANTES = ['Rouleaux au lieu de palettes', 'BL non conforme', 'Papier de mauvaise qualité'];
  M.NC_A_PRECISER = ['Croix mal positionnées', 'Écart de quantité'];
  M.NC_RECEPTION = M.NC_BLOQUANTES.concat(M.NC_A_PRECISER, M.NC_NON_BLOQUANTES);
  /** Portée déduite des items cochés : 'oui' (au moins un bloquant), 'non' (que des non bloquants), null (à préciser : seulement des items communs, ou rien). */
  M.ncPortee = types => (types.some(t => M.NC_BLOQUANTES.includes(t)) ? 'oui' : types.length && types.every(t => M.NC_NON_BLOQUANTES.includes(t)) ? 'non' : null);
  /** La décision, une seule liste (10/11) : les six de la Pré-Prod, RAF, et les deux que la plateforme coche quand la Pré-Prod lui renvoie l'action.
      « Action Pre-Prod requise » est supprimée : c'est l'alerte. Chaque décision donne un statut. */
  // 11/11 (utilisatrice) : « Traité par la plateforme » n'est plus une décision : c'est la réponse, dans le 2e bloc du panneau
  // (« Réponse de la plateforme », oui / non). Les lignes qui l'ont déjà gardent leur statut « Traitée ».
  M.NC_DECISIONS = [['Décision Commerce', 'En cours plateforme'], ['OK préparation en l’état', 'Traitée'], ['Nouvelle impression/Livraison', 'En cours plateforme'], ['Nouvelle préparation', 'En cours plateforme'],
    ['NON JUSTIFIE', 'Traitée'], ['Pas de stock d’affiche', 'En cours plateforme'], ['RAF', 'Traitée'], ['À traiter par la plateforme', 'En cours plateforme']];
  const STATUT_DE = Object.fromEntries(M.NC_DECISIONS);
  /** Statut calculé, jamais saisi ni stocké : Pour statistique (non bloquante), À décider (bloquante sans décision), En cours plateforme, Traitée. */
  const statut = r => {
    if (r.bloquante === false) return 'Pour statistique';
    const ds = dec(r.decisionPreprod);
    // Lignes des exports SharePoint : une décision plateforme RAF / Alerte OK PTF vaut traitée
    if (!ds.length) return r.bloquante === undefined && dec(r.decisionPlateforme).some(x => ['RAF', 'Alerte OK PTF'].includes(x)) ? 'Traitée' : 'À décider';
    // Réponse « traité : oui » (11/11), ou ancienne case « Traité par la plateforme »
    if (r.traite || ds.includes('Traité par la plateforme')) return 'Traitée';
    return ds.some(d => STATUT_DE[d] === 'En cours plateforme') ? 'En cours plateforme' : 'Traitée';
  };
  const STATUTS = { 'Pour statistique': 'info', 'À décider': 'critical', 'En cours plateforme': 'warning', 'Traitée': 'good' };
  const tagStatut = r => ui.sev(STATUTS[statut(r)], statut(r));
  /** Crée la ligne du suivi. o : { site, reception: {id, bl, imprimeur, transporteur}, affiches: [{id, annonceur, dossier, theme, format, qte}],
      bloquante, types[], commentaire, orpheline, user }. Renvoie la ligne. */
  M.ncDeclarer = function (o) {
    const liste = stock('c'), now = new Date(), p = n => String(n).padStart(2, '0');
    const id = String(Math.max(94, ...liste.map(x => Number(x.id) || 0)) + 1), ptf = SITE_PTF[o.site] || o.site || '';
    const u = (k, sep) => M.uniq(o.affiches.map(a => a[k]).filter(Boolean)).join(sep || ' / ');
    const r = Object.assign({}, CFG.c.nouveau(), {
      id, titre: ptf + ' - ' + p(now.getDate()) + ' ' + p(now.getMonth() + 1) + ' ' + now.getFullYear() + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()),
      plateforme: ptf, declarant: o.user || '', annonceur: u('annonceur'), dossier: u('dossier'), theme: u('theme'), formats: M.uniq(o.affiches.map(a => a.format).filter(Boolean)),
      imprimeur: o.reception.imprimeur || '', transporteur: o.reception.transporteur || '', avarie: o.types.some(t => /abîm/i.test(t)) ? 'OUI' : 'NON', controlePossible: 'Vrai',
      typeNC: o.types.slice(), commentaireNC: o.commentaire || '', qteRecue: M.sum(o.affiches, a => Number(a.qte) || 0),
      // 11/11 : photos de preuve (nom et taille seulement) et n° de BL, pour la feuille de non-conformité
      fichiers: (o.fichiers || []).map(p => ({ nom: p.nom, taille: p.taille })), pj: (o.fichiers || []).length, bl: o.reception.bl || '',
      affiches: o.affiches.map(a => a.id), receptionId: o.reception.id, origine: o.orpheline ? 'Réception inconnue' : 'Réception', bloquante: !!o.bloquante, stats: !!(o.orpheline && !o.bloquante),
      gestionnaire: '', admin: '', decisionPlateforme: '', decisionPreprod: '', actionPreprod: '', actionPlateforme: '', reception: [], ncBL: [], cree: now.toISOString() });
    delete r.essaye; r.groupeEtat = groupe(r);
    liste.unshift(r); garder(CFG.c.cle, liste);
    M.journal('Réception ' + o.reception.id, 'Non-conformité ' + (r.bloquante ? 'bloquante' : 'non bloquante') + ' n° ' + id + ' : ' + o.types.join(', '));
    return r;
  };
  /** Non-conformités d'une affiche (pour les lignes du contrôle). */
  M.ncDe = afficheId => stock('c').filter(r => (r.affiches || []).includes(afficheId));
  /** Toutes les non-conformités, agences comprises, avec leur statut calculé (11/11, pour les suivis d'atelier). */
  M.ncToutes = () => toutes().map(r => ({ r, statut: statut(r), dossiers: String(r.dossier || '').match(/\d{6}/g) || [] }));
  /** Non-conformités d'un thème (11/11, colonne « Non-conformité » des suivis d'atelier) : celles qui portent sur ses affiches, ou
      sur son dossier quand le thème déclaré lui correspond ou n'est pas précisé. liste : M.ncToutes(), calculée une fois par page.
      Renvoie { toutes, ouvertes } ; ouvertes = À décider ou En cours plateforme. */
  M.ncDuTheme = (t, d, liste, affIds) => {
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const lib = norm(t.libelle);
    const tout = (liste || M.ncToutes()).filter(x => (x.r.affiches || []).some(a => affIds && affIds.has(a))
      || (x.dossiers.includes(String(d.id)) && (!x.r.theme || norm(x.r.theme).includes(lib) || lib.includes(norm(x.r.theme)))));
    return { toutes: tout, ouvertes: tout.filter(x => x.statut === 'À décider' || x.statut === 'En cours plateforme') };
  };

  /* ---------- Feuille de non-conformité (11/11, à sa demande) ----------
     Une seule page A4 pour toutes les non-conformités imprimées ensemble (11/11, utilisatrice : « les non-conformités doivent être en
     une seule et même feuille ») : celles de la palette au contrôle, celles d'une affiche (Liste des affiches) ou une seule (Suivi des
     NC). Dans le même aperçu que la feuille de stock. Au moins une bloquante : bandeau hachuré « BLOQUANTE(S) » (12/11, utilisatrice :
     retrait de « NE PAS UTILISER les affiches concernées · décision de la Pré-Prod attendue ») ; sinon bandeau plein « utilisables ». Le sens est écrit, pas seulement porté par la couleur (impression en noir et blanc, collègue daltonienne).
     Quantité mise de côté et décision : cases à remplir à la main tant qu'elles ne sont pas dans Circé. */
  /** Note l'impression de la feuille de non-conformité sur ces lignes du suivi. */
  M.ncNoterFeuille = rows => {
    const ids = new Set(rows.map(r => String(r.id))), le = new Date().toISOString();
    stock('c').forEach(r => { if (ids.has(String(r.id))) r.feuilleNC = le; });
    garder(CFG.c.cle, stock('c'));
    M.journal('Non-conformité ' + Array.from(ids).join(', '), 'Feuille de non-conformité imprimée');
  };
  /** La feuille unique de plusieurs non-conformités (une seule possible) ; ids (facultatif) limite aux affiches d'une palette ou d'une
      ligne de la Liste des affiches. */
  ui.feuilleNC = function (rows, ids) {
    const C = M.calc, D = M.data;
    const u = vals => M.uniq(vals.filter(v => v !== undefined && v !== null && v !== '').map(String)).join(' / ');
    const affsDe = r => (r.affiches || []).filter(x => !ids || ids.has(x));
    const infoAff = id => {
      const a = D && D.affiches ? D.affiches.find(x => x.id === id) : null;
      const t = a && a.alloc && a.alloc[0] && C ? C.theme(a.alloc[0].themeId) : null, d = t ? C.dossier(t.dossierId) : null;
      return { id, dossier: d ? d.id : '', annonceur: d ? d.annonceur : a ? a.annonceurSaisi : '', theme: t ? t.libelle : a ? a.libelleSaisi : '',
        format: a ? a.format : '', qte: a ? a.qteRecue : '', empl: a ? a.allee + '-' + a.rayon : '', ncs: rows.filter(r => affsDe(r).includes(id)).map(r => r.id) };
    };
    const affs = M.uniq(rows.flatMap(affsDe)).map(infoAff);
    const nBloq = rows.filter(r => r.bloquante === true).length, seul = rows.length === 1 ? rows[0] : null;
    const ligne = (lib, val) => h('div', { class: 'fnc-l' }, h('span', { class: 'fnc-lib' }, lib), h('span', { class: 'fnc-val' }, val === undefined || val === null || val === '' ? '—' : String(val)));
    const imp = r => (r.imprimeur === 'AUTRE' ? r.imprimeurAutre : r.imprimeur), trp = r => (r.transporteur === 'AUTRE' ? r.transporteurAutre : r.transporteur);
    const recs = u(rows.map(r => r.receptionId));
    const portee = r => (r.bloquante === true ? 'BLOQUANTE' : r.bloquante === false ? 'Non bloquante' : 'Non précisée');
    const constat = r => (dec(r.typeNC).length ? dec(r.typeNC) : dec(r.controle)).join(', ');
    const sous = nBloq ? (nBloq === rows.length ? (seul ? 'BLOQUANTE' : 'BLOQUANTES') : nBloq + ' BLOQUANTE(S) SUR ' + rows.length)
      : rows.every(r => r.bloquante === false) ? 'NON BLOQUANTE' + (seul ? '' : 'S') + ' · affiches utilisables · signalée' + (seul ? '' : 's') + ' pour la qualité' : 'Portée non précisée';
    const code = 'NC-' + (seul ? String(seul.id).padStart(8, '0') : rows.map(r => r.id).join('-'));
    const td = (x, st) => h('td', st ? { style: st } : null, x === undefined || x === null || x === '' ? '—' : x);
    return h('div', { class: 'fsa-wrap', title: 'Feuille de non-conformité · ' + rows.map(r => 'NC ' + r.id).join(', ') },
      h('div', { class: ['fsa-page', 'fnc-page', nBloq ? 'is-bloq' : ''] },
        h('div', { class: 'fnc-mention' }, h('div', { class: 'fnc-mention-t' }, 'FEUILLE DE NON-CONFORMITÉ'), h('div', { class: 'fnc-mention-s' }, sous)),
        h('div', { class: 'fnc-gros' }, h('b', null, seul ? 'NC n° ' + seul.id : rows.length + ' non-conformités'), recs ? h('span', null, 'Réception ' + recs) : null),
        h('div', { class: 'fnc-grille' },
          h('div', { class: 'fnc-bloc' }, h('h4', null, 'Réception'),
            ligne('Déclarée le', u(rows.map(r => M.fmt && M.fmt.dy ? M.fmt.dy(new Date(r.cree)) : quand(r.cree)))), ligne('Plateforme', u(rows.map(r => r.plateforme))),
            ligne('BL n°', u(rows.map(r => r.bl))), ligne('Déclarant', u(rows.map(r => r.declarant))),
            ligne('Imprimeur', u(rows.map(imp))), ligne('Transporteur', u(rows.map(trp)))),
          h('div', { class: 'fnc-bloc' }, h('h4', null, 'Dossiers'),
            ligne('Dossier', u(affs.length ? affs.map(x => x.dossier) : rows.map(r => r.dossier))), ligne('Annonceur', u(affs.length ? affs.map(x => x.annonceur) : rows.map(r => r.annonceur))),
            ligne('Thème', u(affs.length ? affs.map(x => x.theme) : rows.map(r => r.theme))), ligne('Affiches', affs.length ? affs.length + ' concernée(s)' : ''))),
        affs.length ? h('div', { class: 'fnc-bloc' }, h('h4', null, 'Affiches concernées'),
          h('table', { class: 'fnc-tab' }, h('thead', null, h('tr', null, ['N° affiche', 'Dossier', 'Thème', 'Format', 'Qté reçue', 'Emplacement', 'NC n°'].map(x => h('th', null, x)))),
            h('tbody', null, affs.map(x => h('tr', null, td(h('b', null, x.id)), td(x.dossier), td(x.theme), td(x.format), td(String(x.qte)), td(x.empl), td(x.ncs.join(', '))))))) : null,
        h('div', { class: 'fnc-bloc' }, h('h4', null, 'Non-conformités (' + rows.length + ')'),
          h('table', { class: 'fnc-tab' }, h('thead', null, h('tr', null, ['NC n°', 'Portée', 'Constat', 'Commentaire', 'Photos'].map(x => h('th', null, x)))),
            h('tbody', null, rows.map(r => h('tr', null, td(h('b', null, r.id)), td(r.bloquante === true ? h('b', null, '☒ ' + portee(r)) : portee(r)), td(constat(r)),
              td(r.commentaireNC || r.commentaire || '', { whiteSpace: 'pre-wrap' }), td((r.fichiers || []).length ? r.fichiers.length + ' photo(s)' : 'aucune')))))),
        h('div', { class: 'fnc-grille' },
          h('div', { class: 'fnc-bloc fnc-main' }, h('h4', null, 'À remplir à la main'),
            h('div', null, 'Quantité mise de côté : ..............'), h('div', null, 'Emplacement : ..............')),
          h('div', { class: 'fnc-bloc fnc-main' }, h('h4', null, 'Décision de la Pré-Prod'),
            rows.some(r => dec(r.decisionPreprod).length)
              ? rows.map(r => h('div', { style: { lineHeight: 1.5 } }, h('b', null, 'NC ' + r.id + ' : '), dec(r.decisionPreprod).length ? dec(r.decisionPreprod).join(' · ') + (r.dateDecision ? ', le ' + quand(r.dateDecision) : '') : '..............'))
              : [h('div', null, 'Décision : ..............'), h('div', null, 'Date : ............  Visa : ............')])),
        h('div', { class: 'fnc-pied' },
          h('div', null, h('div', { class: 'fnc-barres', 'aria-hidden': 'true' }), h('div', { style: { fontWeight: 700, fontSize: '12pt', marginTop: '2px' } }, code)),
          h('div', { style: { textAlign: 'right' } }, 'Suivi des NC › ' + rows.map(r => 'n° ' + r.id).join(', '), h('br'), 'Page 1/1'))));
  };
  /** Une seule feuille pour toutes ces non-conformités (11/11) ; ids (facultatif) garde celles qui touchent ces affiches. Renvoie une
      liste d'une page (vide s'il n'y a rien à imprimer), pour l'aperçu commun avec les feuilles de stock. */
  ui.feuillesNC = function (rows, ids) {
    const gardees = rows.filter(r => !ids || !(r.affiches || []).length || (r.affiches || []).some(x => ids.has(x)));
    return gardees.length ? [{ rows: gardees, el: ui.feuilleNC(gardees, ids) }] : [];
  };
  /** Aperçu et impression des seules feuilles de non-conformité : depuis le Suivi des NC (toutes les affiches de la NC) ou depuis la
      Liste des affiches (ids : la seule affiche de la ligne). Sert aussi après un oubli ou une panne d'imprimante. */
  ui.printFeuillesNC = function (rows, titre, ids) {
    const pages = ui.feuillesNC(rows, ids);
    ui.modal({ title: titre || 'Feuille de non-conformité : aperçu avant impression', wide: true,
      body: [h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'Une seule feuille pour ' + rows.length + ' non-conformité(s), en 1 exemplaire.'),
        h('div', { class: 'fsa-liste' }, pages.map(p => p.el))],
      actions: [{ label: 'Annuler' }, { label: 'Imprimer la feuille', primary: true, onClick: () => {
        M.ncNoterFeuille(rows); ui.toast('Feuille de non-conformité envoyée à l’imprimante (simulation).', 'good'); M.refresh(); } }] });
  };
  /** Alertes des non-conformités pour Pilotage › Alertes (lues par C.alertes) :
      - « Non-conformité bloquante », pour la Pré-Prod, jusqu'à sa décision ;
      - « Action de la plateforme attendue » (10/11, utilisatrice) : la décision renvoie l'action à la plateforme (statut « En cours
        plateforme »), alerte pour cette plateforme jusqu'à ce qu'elle coche « Traité par la plateforme ». Une décision qui donne
        « Traitée » n'envoie pas d'alerte. La clé porte la date de la décision : une nouvelle décision rouvre une alerte, même si la
        précédente a été acquittée. */
  const ouOK = r => r.plateforme || 'plateforme non précisée';
  const quoi = r => (r.annonceur ? ' · ' + r.annonceur : '') + (r.dossier ? ' (dossier ' + r.dossier + ')' : '');
  M.ncAlertes = () => {
    const rows = toutes();
    const pp = rows.filter(r => r.bloquante === true && !reglee(r)).map(r => ({
      key: 'NC-' + r.id, type: 'NC_BLOQUANTE', sev: 'critical', site: PTF_SITE[r.plateforme] || null, semaine: null, date: new Date(r.cree),
      titre: r.origine === 'Réception inconnue' ? 'Non-conformité bloquante sur une réception inconnue : go de la préproduction attendu' : 'Non-conformité bloquante à la réception',
      message: 'NC n° ' + r.id + ' · ' + ouOK(r) + (r.receptionId ? ' · réception ' + r.receptionId : '') + quoi(r) + ' : ' + arr(r.typeNC) + (r.commentaireNC ? ' — ' + r.commentaireNC : '')
        + (r.origine === 'Réception inconnue' ? '. La Pré-Prod décide avant toute suite (Suivi des NC, bouton Décision).' : '. Décision de la Pré-Prod attendue dans Suivi des NC.'),
      link: { screen: 'nonconformite', params: { tab: 'suivi', id: r.id } }, needs: [], roles: ['coord', 'recep'] }));
    const ptf = rows.filter(r => statut(r) === 'En cours plateforme').map(r => ({
      key: 'NCP-' + r.id + (r.dateDecision ? '-' + r.dateDecision : ''), type: 'NC_PLATEFORME', sev: 'serious', site: PTF_SITE[r.plateforme] || null, semaine: null,
      date: new Date(r.dateDecision || r.cree), titre: 'Non-conformité : action de la plateforme attendue',
      message: 'NC n° ' + r.id + ' · ' + ouOK(r) + quoi(r) + ' : décision de la Pré-Prod « ' + dec(r.decisionPreprod).join(' · ') + ' »'
        + (r.commentaireDecisionPlateforme ? ' — ' + r.commentaireDecisionPlateforme : '') + '. Une fois l’action faite, répondre « Oui, traité » (Suivi des NC, bouton « Réponse »).',
      link: { screen: 'nonconformite', params: { tab: 'suivi', id: r.id } }, needs: [], roles: ['recep', 'cheq'] }));
    return pp.concat(ptf);
  };

  /** Texte d'une colonne (11/11 : les réponses de la plateforme et la date du « traité » ne sont pas du texte simple). */
  const txt = (r, k) => (k === 'reponses' ? (r.reponses || []).map(x => quand(x.date) + ' · ' + (x.user || '') + ' · ' + (x.traite ? 'Oui, traité' : 'Non, toujours en cours') + (x.comm ? ' : ' + x.comm : '')).join('\n')
    : k === 'traiteLe' ? (r.traite ? quand(r.traite.date) + ' · ' + (r.traite.user || '') : '') : arr(r[k]));
  function colonnesVue() {
    return ORDRE.map(k => {
      const [label, w] = COLS[k];
      const c = { key: k, label, hidden: !VIS.includes(k), value: r => (k === 'cree' ? new Date(r.cree).getTime() : txt(r, k)) };
      if (k === 'cree') { c.render = r => quand(r.cree); c.csv = r => quand(r.cree); c.nowrap = true; }
      if (k === 'decisionPlateforme' || k === 'decisionPreprod') c.render = r => (dec(r[k]).length ? h('b', null, dec(r[k]).join(' · ')) : h('span', { class: 'muted' }, '—'));
      if (k === 'bloquante') { c.render = tagBloquante; c.value = r => (r.bloquante === true ? 'Bloquante' : r.bloquante === false ? 'Non bloquante' : ''); }
      if (k === 'statut') { c.render = tagStatut; c.value = statut; c.nowrap = true; }
      if (k === 'demande') { c.value = demande; c.nowrap = true; }
      if (k === 'origine') { c.value = r => r.origine || 'Formulaire'; c.render = r => h('span', null, r.origine || 'Formulaire', r.stats ? [' ', ui.tag('statistiques', 'hyp')] : null); }
      if (w) { c.wrap = true; c.maxWidth = w; }
      return c;
    });
  }
  /** Fiche d'une ligne : toutes les colonnes renseignées, et les deux décisions. */
  function ficheControle(r) {
    ui.modal({ title: r.titre + ' · ' + arr(r.annonceur), wide: true, body: h('table', { class: 'dt' }, h('tbody', null, ORDRE.filter(k => k === 'bloquante' ? r.bloquante !== undefined : k === 'statut' || k === 'demande' || txt(r, k) !== '').map(k =>
      h('tr', null, h('th', { style: { width: '34%', whiteSpace: 'normal' } }, COLS[k][0]), h('td', { style: { whiteSpace: 'pre-wrap' } }, k === 'cree' ? quand(r.cree) : k === 'demande' ? demande(r) : k === 'bloquante' ? tagBloquante(r) : k === 'statut' ? tagStatut(r) : k === 'origine' ? r.origine || 'Formulaire' : txt(r, k)))))),
      // 11/11 : réimprimer la feuille de non-conformité depuis le suivi
      actions: [{ label: 'Fermer' }, { label: 'Feuille de non-conformité', onClick: () => { setTimeout(() => ui.printFeuillesNC([r], 'NC n° ' + r.id + ' : feuille de non-conformité'), 0); } },
        { label: 'Décision', primary: true, onClick: () => { setTimeout(() => decider(r), 0); } }] });
  }
  /** Qui agit : le rôle choisi dans le bandeau (la maquette n'a pas de connexion). */
  const quiAgit = () => { const x = M.ROLES && M.state ? M.ROLES.find(y => y.id === M.state.role) : null; return x ? x.label : 'Utilisateur'; };
  /** Panneau de décision, en deux blocs (11/11, utilisatrice : « un bouton où tu valides la décision, ensuite un autre bouton où tu
      valides si c'est traité ou pas ») :
      1. Décision de la Pré-Prod : décisions à cocher (plusieurs possibles), le statut qu'elles donnent, commentaire, « Valider la décision ».
         Une décision qui donne « Traitée » n'envoie pas d'alerte ; une décision qui renvoie l'action à la plateforme (« En cours
         plateforme ») lui envoie une alerte. Une nouvelle décision efface le « traité » précédent (nouvelle action attendue).
      2. Réponse de la plateforme, visible dès que la ligne est « En cours plateforme » : « Oui, traité » ou « Non, toujours en cours »,
         commentaire, « Valider la réponse ». Chaque réponse est gardée, datée, avec son auteur (colonne « Réponses de la plateforme »).
         Oui : la ligne passe « Traitée », l'alerte de la plateforme se ferme. Non : elle reste « En cours plateforme ». */
  function decider(r) {
    const choix = new Set(dec(r.decisionPreprod).filter(x => STATUT_DE[x]));
    let comm = r.commentaireDecisionPlateforme || '';
    const apercu = h('div', { class: 'small' });
    const alerteTxt = s => (s === 'En cours plateforme' ? 'alerte envoyée à la plateforme (' + ouOK(r) + ') jusqu’à sa réponse « Oui, traité »' : 'aucune alerte');
    const majApercu = () => {
      const x = Object.assign({}, r, { decisionPreprod: Array.from(choix), traite: null }), s = statut(x);
      M.mount(apercu, 'Statut après validation : ', tagStatut(x), choix.size ? [' · ', s === 'En cours plateforme' ? h('b', null, alerteTxt(s)) : alerteTxt(s)] : null);
    };
    majApercu();
    const valider = () => {
      if (!choix.size) { ui.toast('Cochez au moins une décision.', 'critical'); return; }
      const vals = decisions().filter(x => choix.has(x));
      r.decisionPreprod = vals; r.commentaireDecisionPlateforme = comm; r.dateDecision = new Date().toISOString(); r.traite = null;
      r.groupeEtat = groupe(r);
      sauver(r);
      M.journal('Non-conformité ' + r.id, 'Décision : ' + vals.join(', ') + ' → ' + statut(r) + (statut(r) === 'En cours plateforme' ? ' (alerte à la plateforme)' : ''));
      close(); M.refresh();
      ui.toast('Décision validée pour ' + r.titre + ' : ' + statut(r) + ', ' + alerteTxt(statut(r)) + '.', statut(r) === 'En cours plateforme' ? 'warning' : 'good');
    };
    // Bloc 2 : réponse de la plateforme
    const rep = { traite: '', comm: '' };
    const choixRep = h('div', { class: 'row', style: { gap: '10px' } });
    const majRep = () => M.mount(choixRep, [['oui', 'Oui, traité'], ['non', 'Non, toujours en cours']].map(([v, l]) =>
      h('button', { type: 'button', 'aria-pressed': String(rep.traite === v), class: ['btn', rep.traite === v ? (v === 'oui' ? 'btn-success' : 'btn-warning') : 'btn-outline-secondary'],
        style: { flex: '1', fontWeight: 600 }, onclick: () => { rep.traite = v; majRep(); } }, (rep.traite === v ? '✓ ' : '') + l)));
    majRep();
    const validerRep = () => {
      if (!rep.traite) { ui.toast('Choisissez « Oui, traité » ou « Non, toujours en cours ».', 'critical'); return; }
      const le = new Date().toISOString(), qui = quiAgit();
      r.reponses = (r.reponses || []).concat([{ date: le, user: qui, traite: rep.traite === 'oui', comm: rep.comm.trim() }]);
      if (rep.traite === 'oui') r.traite = { date: le, user: qui };
      r.groupeEtat = groupe(r);
      sauver(r);
      M.journal('Non-conformité ' + r.id, 'Réponse de la plateforme : ' + (rep.traite === 'oui' ? 'traité' : 'pas encore traité') + (rep.comm.trim() ? ' (' + rep.comm.trim() + ')' : ''));
      close(); M.refresh();
      ui.toast(rep.traite === 'oui' ? 'NC n° ' + r.id + ' traitée : l’alerte de la plateforme est fermée.' : 'NC n° ' + r.id + ' toujours en cours : réponse enregistrée, l’alerte reste ouverte.', rep.traite === 'oui' ? 'good' : 'warning');
    };
    const enCours = statut(r) === 'En cours plateforme';
    const historique = (r.reponses || []).length ? h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } }, r.reponses.map(x =>
      h('li', null, h('b', null, quand(x.date)), ' · ' + (x.user || '') + ' · ', x.traite ? ui.sev('good', 'Oui, traité') : ui.sev('warning', 'Non, toujours en cours'), x.comm ? ' : ' + x.comm : null)))
      : h('div', { class: 'small muted' }, 'Aucune réponse pour l’instant.');
    const bloc = (titre, kids) => h('div', { style: { border: '2px solid var(--border-strong, #ccc)', borderRadius: '8px', padding: '12px 14px' } },
      h('div', { style: { fontWeight: 700, fontSize: '15px', marginBottom: '10px' } }, titre), h('div', { class: 'stack', style: { gap: '12px' } }, kids));
    const close = ui.drawer({ title: 'Décision', body: h('div', { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'small' }, r.titre + ' · ' + arr(r.annonceur)),
      h('div', { class: 'row', style: { gap: '8px' } }, tagBloquante(r), tagStatut(r)),
      bloc('1. Décision de la Pré-Prod', [
        ui.field('Décision (une ou plusieurs)', h('div', { class: 'stack', style: { gap: '4px' } }, M.NC_DECISIONS.map(([x, s]) => h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } },
          ui.checkbox(x, choix.has(x), v => { if (v) choix.add(x); else choix.delete(x); majApercu(); }),
          h('span', { class: 'small muted' }, '→ ' + s + (s === 'En cours plateforme' ? ' · alerte à la plateforme' : '')))))),
        apercu,
        ui.field('Commentaire (facultatif)', h('textarea', { class: 'form-control', rows: 3, 'aria-label': 'Commentaire de la décision', placeholder: 'Ex. date prévisionnelle de la nouvelle livraison, ré-impression impossible…', oninput: e => { comm = e.target.value; } }, comm)),
        h('div', null, ui.btn('Valider la décision', valider, { primary: true }))]),
      // Bloc 2 : visible dès que la décision a renvoyé l'action à la plateforme, ou une fois traitée (pour l'historique)
      enCours || r.traite || (r.reponses || []).length ? bloc('2. Réponse de la plateforme', [
        historique,
        r.traite ? ui.callout('good', 'Traité', ' le ' + quand(r.traite.date) + ' par ' + (r.traite.user || '') + '. L’alerte de la plateforme est fermée.')
          : enCours ? [
            ui.field('L’action est-elle faite ?', choixRep),
            ui.field('Commentaire (facultatif)', h('textarea', { class: 'form-control', rows: 3, 'aria-label': 'Commentaire de la réponse', placeholder: 'Ex. affiches renvoyées le 12/11, en attente du retour du Commerce…', oninput: e => { rep.comm = e.target.value; } })),
            h('div', null, ui.btn('Valider la réponse', validerRep, { primary: true })),
            h('div', { class: 'small muted' }, 'Oui : la NC passe « Traitée » et l’alerte de la plateforme se ferme. Non : elle reste « En cours plateforme », la réponse est gardée avec sa date.')]
          : null]) : null,
      h('div', { class: 'small muted' }, 'Aujourd’hui, ce flux utilise SharePoint et Office 365 Outlook (deux décisions, plateforme puis préproduction). Dans la maquette : la Pré-Prod valide sa décision (bloc 1) ; si elle renvoie l’action à la plateforme, la réponse se donne ensuite (bloc 2), autant de fois que nécessaire, jusqu’à « Oui, traité ».'),
      h('div', null, ui.btn('Fermer', () => close()))) });
  }
  /** Suivi des NC : un seul tableau (10/11) pour les demandes des agences, les déclarations du formulaire Pré-production et celles faites
      à la réception ; le filtre « Demande » sépare Agence et Pré-production, l'export Excel prend tout ce qui est affiché. */
  let ouverte = { id: null, seq: 0 }, presetSeq = -1;
  function vueSuivi(root, params) {
    const rows = toutes();
    const F = ui.filters({ id: 'nc-suivi', rows, defs: [
      // 11/11 : N° de dossier (un lien ?dossier=… le pose, ex. la colonne « Non-conformité » des suivis d'atelier)
      ui.dossierFilter(rows, r => String(r.dossier || '').match(/\d{6}/g) || []),
      { key: 'demande', label: 'Demande', options: [TEINTE.c.nom, TEINTE.a.nom].map(x => ({ value: x, label: x })), get: demande, stable: true },
      { key: 'plateforme', label: 'Plateforme', options: opts(rows.map(r => r.plateforme)), get: r => r.plateforme },
      { key: 'bloquante', label: 'Bloquante', options: [{ value: 'oui', label: 'Bloquante' }, { value: 'non', label: 'Non bloquante' }, { value: '—', label: 'Non précisé (formulaire)' }], get: r => (r.bloquante === true ? 'oui' : r.bloquante === false ? 'non' : '—'), stable: true },
      { key: 'origine', label: 'Origine', options: ['Formulaire', 'Réception', 'Réception inconnue'].map(x => ({ value: x, label: x })), get: r => r.origine || 'Formulaire', stable: true },
      { key: 'statut', label: 'Statut', options: Object.keys(STATUTS).map(x => ({ value: x, label: x })), get: statut, stable: true },
      { key: 'decision', label: 'Décision', more: true, options: [{ value: '—', label: 'Pas encore décidé' }].concat(decisions().map(x => ({ value: x, label: x }))), get: r => (dec(r.decisionPreprod).length ? dec(r.decisionPreprod) : '—'), stable: true },
      { key: 'controle', label: 'Contrôle réception', more: true, options: CONTROLES.map(x => ({ value: x, label: x })), get: r => r.controle },
      { key: 'typeNC', label: 'Type de non-conformité', more: true, options: M.NC_RECEPTION.concat(TYPES).map(x => ({ value: x, label: x })), get: r => r.typeNC },
    ] });
    // Arrivée avec ?demande=Agence (anciennes adresses du Suivi NC Agence) : le filtre se pose une fois par arrivée
    if (params.demande && presetSeq !== M.navSeq) { presetSeq = M.navSeq; F.set('demande', [params.demande]); }
    // Arrivée par une alerte (?id=…) : la fiche de la ligne s'ouvre, une fois par arrivée
    if (params.id && ouverte.seq !== M.navSeq) { ouverte = { id: params.id, seq: M.navSeq }; const r = rows.find(x => String(x.id) === String(params.id)); if (r) setTimeout(() => ficheControle(r), 0); }
    const vis = F.apply(rows), nBloq = rows.filter(r => statut(r) === 'À décider').length, nCours = rows.filter(r => statut(r) === 'En cours plateforme').length;
    root.append(ui.pageHead({ crumb: 'Non-conformité', title: 'Suivi des NC', screen: 'nonconformite',
      actions: [ui.btn('Nouvelle demande', () => M.go('nonconformite', { tab: 'demande' }), { icon: 'plus', primary: true })] }),
      F.bar,
      h('div', { class: 'kpis', style: { marginBottom: '12px' } },
        ui.stat({ label: 'À décider', value: nBloq, sub: 'sans décision : bloquantes (alerte ouverte) et demandes des agences', onClick: () => { F.set('statut', ['À décider']); M.refresh(); } }),
        ui.stat({ label: 'En cours plateforme', value: nCours, sub: 'alerte ouverte pour la plateforme, jusqu’à sa réponse « Oui, traité »', onClick: () => { F.set('statut', ['En cours plateforme']); M.refresh(); } }),
        ui.stat({ label: 'Pour statistique', value: rows.filter(r => statut(r) === 'Pour statistique').length, sub: 'non bloquantes : scorecard imprimeur', onClick: () => { F.set('statut', ['Pour statistique']); M.refresh(); } }),
        ui.stat({ label: 'Traitées', value: rows.filter(r => statut(r) === 'Traitée').length, sub: 'décision prise, plus rien à attendre : aucune alerte', onClick: () => { F.set('statut', ['Traitée']); M.refresh(); } })),
      ui.card({ flush: true, body: ui.table({ id: 'nc-suivi', rows: vis, exportName: 'suivi-nc.xlsx', onRowClick: ficheControle,
        empty: 'Aucune non-conformité avec ces filtres : « Nouvelle demande » ouvre le formulaire « Usage réservé aux plateformes » ou Agence ; la réception déclare aussi depuis le bon de livraison et le contrôle de la palette.',
        tone: r => ({ 'À décider': 'critical', 'En cours plateforme': 'warning' }[statut(r)] || null),
        // Un seul bouton (10/11) : la Pré-Prod décide ; la plateforme y coche « Traité par la plateforme ». Rien à décider sur une non bloquante
        rowActions: r => (statut(r) === 'Pour statistique' ? h('span', { class: 'small muted nowrap' }, 'rien à décider')
          : ui.btn(statut(r) === 'En cours plateforme' ? 'Réponse' : 'Décision', () => decider(r), { small: true, primary: statut(r) === 'À décider', title: statut(r) === 'En cours plateforme' ? 'Réponse de la plateforme : « Oui, traité » ou « Non, toujours en cours » (bloc 2 du panneau)' : 'Décision de la Pré-Prod' })),
        columns: colonnesVue() }) }),
      ui.annot('Un seul tableau pour les deux demandes (10/11) : Plateformes (formulaire « Usage réservé aux plateformes ») et Agence, séparées par le filtre « Demande » et la colonne du même nom, pour extraire toutes les données d’un coup. Il remplace aussi les vues Plateformes et Préproduction (09/11) ; une seule décision à neuf choix et un statut calculé, jamais saisi (10/11, slides de l’utilisatrice) : Pour statistique (non bloquante), À décider (bloquante, alerte à la Pré-Prod), En cours plateforme (la décision renvoie l’action à la plateforme : alerte à la plateforme, jusqu’à « Traité par la plateforme »), Traitée (aucune alerte). La portée se déduit de l’item coché à la réception ; « Croix mal positionnées » et « Écart de quantité » se précisent. Départ : les 9 lignes des exports du 09/11, dont la décision plateforme reste en colonne masquée.', []));
  }

  const PAGES = { demande: vueNouvelle, suivi: vueSuivi };
  /** Anciennes adresses : formulaires et tableaux d'avant le 10/11, renvoyés vers les deux pages. */
  const ANCIENNES = { declaration: { tab: 'demande', type: 'agence' }, reception: { tab: 'demande', type: 'preprod' }, reclamation: { tab: 'suivi', demande: 'Agence' },
    plateformes: { tab: 'suivi' }, preproduction: { tab: 'suivi' } };

  M.screen({
    id: 'nonconformite', title: 'Non-conformité', nav: 'Non-conformité', roles: ['recep', 'coord', 'cheq', 'admin'], vueDefaut: 'demande',
    render(root, params) {
      params = params || {};
      if (ANCIENNES[params.tab]) { M.go('nonconformite', ANCIENNES[params.tab]); return; }
      PAGES[PAGES[params.tab] ? params.tab : 'demande'](root, params);
    },
  });
})();
