/* Onglet « Non-conformité » (09/11, demande de l'utilisatrice), organisé comme son site actuel (capture) :
   - Réception contrôlée : Nouvelle réception (formulaire Contrôle réception de la Pré-Prod et des plateformes), Suivi NC réception ;
   - Réclamation agence : Nouvelle demande (formulaire des agences, Power Apps reproduit à l'identique), Suivi NC Agence.
   Deux déclarants : l'agent d'agence (Réclamation agence) et la Pré-Prod / la plateforme (Contrôle réception). « Envoyer » ajoute la
   déclaration au tableau du groupe : Réclamation agence › Suivi NC Agence, ou la liste « Réception Contrôle » (Suivi NC réception). Les deux
   vues SharePoint (Plateformes, Préproduction ; exports du 09/11) sont fusionnées en un seul tableau (09/11, à sa demande) qui reprend toutes
   les colonnes, avec les deux décisions (« Décision Plateforme », « Décision Préproduction »).
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
  const PLATEFORMES = ['WISSOUS', 'NÎMES', 'FPI (Affiches colle uniquement)', 'BUS'];
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
    a: { cle: 'circe-maquette-nonconf', prefixe: 'NC', ou: 'Réclamation agence › Suivi NC Agence', liste: null,
      nouveau: () => Object.assign({}, COMMUN, { fichiers: [], region: '', afficheur: '', format: '', lieu: '', dateAff: '', types: [] }),
      obligatoires: [['plateforme', 'Plateforme'], ['declarant', 'Déclarant'], ['region', 'Région concernée'], ['afficheur', 'Nom de l’afficheur'], ['dossier', 'N° de dossier BC'],
        ['annonceur', 'Annonceur'], ['theme', 'Thème'], ['format', 'Format'], ['dateAff', 'Date d’affichage'], ['types', 'Type de non conformité rencontrée']] },
    // Contrôle réception : le formulaire de la Pré-Prod et des plateformes. Une déclaration = une ligne de la liste SharePoint « Réception
    // Contrôle » (exports Préprod et Plateformes du 09/11) : mêmes colonnes, même GroupeEtat, mêmes décisions.
    c: { cle: 'circe-maquette-ctrl2', prefixe: '', ou: 'Réception contrôlée › Suivi NC réception', liste: null,
      nouveau: () => Object.assign({}, COMMUN, { fichiers: [], imprimeur: '', imprimeurAutre: '', transporteur: '', transporteurAutre: '', formats: [], avarie: '', controlePossible: 'Oui',
        controle: [], detailVisuel: [], statutEtat: '', commentaireNC: '', numeroAffichesManquantes: '' }),
      obligatoires: f => [['plateforme', 'Plateforme'], ['annonceur', 'Annonceur'], ['imprimeur', 'Imprimeur'], f.imprimeur === 'AUTRE' ? ['imprimeurAutre', 'Imprimeur autre'] : null,
        ['transporteur', 'Transporteur'], f.transporteur === 'AUTRE' ? ['transporteurAutre', 'Transporteur autre'] : null, ['theme', 'Thème'], ['formats', 'Formats'],
        ['avarie', 'Présence avarie de transport'], ['controle', 'Contrôle réception']].filter(Boolean),
      versRecord: (f, liste) => {
        const now = new Date(), p = n => String(n).padStart(2, '0');
        const id = String(Math.max(94, ...liste.map(x => Number(x.id) || 0)) + 1);
        return { id, titre: f.plateforme + ' - ' + p(now.getDate()) + ' ' + p(now.getMonth() + 1) + ' ' + now.getFullYear() + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()),
          annonceur: f.annonceur, dossier: f.dossier, plateforme: f.plateforme, declarant: f.declarant, theme: f.theme, formats: f.formats, avarie: f.avarie,
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
  const stock = k => CFG[k].liste || (CFG[k].liste = (() => { const t = lire(CFG[k].cle); if (k === 'c' && !t.length && !localStorage.getItem(CFG[k].cle)) { const s = SEED_CTRL(); garder(CFG[k].cle, s); return s; } return t; })());
  const manquant = k => (Array.isArray(form[k]) ? !form[k].length : !String(form[k] || '').trim());

  /** Champ étiqueté, astérisque rouge pour un champ obligatoire. */
  const champ = (label, controle, obligatoire) => h('label', { class: 'field wide', style: { margin: 0 } },
    h('span', { class: 'form-label' }, obligatoire ? h('span', { style: { color: ROUGE, marginRight: '6px', fontWeight: 700 } }, '*') : null, label), controle);
  const marque = (el, k) => { if (form.essaye && manquant(k)) el.classList.add('is-invalid'); return el; };
  // refresh : redessiner au changement (un champ dépend de la valeur, ex. « Imprimeur autre » quand on choisit AUTRE)
  const liste = (k, vide, options, refresh) => { const s = ui.select({ value: form[k], label: vide, options: [{ value: '', label: vide }].concat(options.map(o => ({ value: o, label: o }))), onChange: v => { form[k] = v; if (form.essaye || refresh) M.refresh(); } }); return marque(s, k); };
  const texte = (k, placeholder, type) => marque(h('input', { class: 'form-control', type: type || 'text', value: form[k] || '', placeholder, 'aria-label': placeholder || k, oninput: e => { form[k] = e.target.value; } }), k);

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

  /** Réclamation agence › Nouvelle demande. */
  function vueDemande(root) {
    ouvrir('a');
    root.append(ui.pageHead({ crumb: 'Non-conformité · Réclamation agence', title: 'Nouvelle demande', screen: 'nonconformite' }),
      h('section', { class: 'card', style: { maxWidth: '980px' } },
        h('div', { class: 'card-header', style: { display: 'block' } },
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
        pied()));
  }

  /** Réception contrôlée › Nouvelle réception : le formulaire Contrôle réception de la Pré-Prod et des plateformes. */
  function vueControle(root) {
    ouvrir('c');
    root.append(ui.pageHead({ crumb: 'Non-conformité · Réception contrôlée', title: 'Nouvelle réception', screen: 'nonconformite' }),
      h('section', { class: 'card', style: { maxWidth: '980px' } },
        h('div', { class: 'card-header', style: { display: 'block' } },
          h('div', { class: 'small muted', style: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' } }, 'Contrôle réception'),
          h('h2', { class: 'card-title', style: { fontSize: '20px' } }, 'Déclaration d’une non conformité')),
        h('div', { class: 'card-body' },
          h('div', { class: 'stack', style: { gap: '14px' } },
            champ('Plateforme', liste('plateforme', 'Sélectionner la plateforme', PLATEFORMES), true),
            champ('Déclarant', liste('declarant', 'Sélectionner le déclarant', declarants()), false),
            champ('Annonceur', texte('annonceur', ''), true),
            // Imprimeurs et transporteurs : les listes d'Administration › Référentiels (les mêmes que le bon de livraison de la réception),
            // plus « AUTRE », qui ouvre le champ « … autre » comme dans la liste SharePoint
            champ('Imprimeur', liste('imprimeur', 'Sélectionner l’imprimeur', M.ref.imprimeurs.concat(['AUTRE']), true), true),
            form.imprimeur === 'AUTRE' ? champ('Imprimeur autre', texte('imprimeurAutre', 'Nom de l’imprimeur'), true) : null,
            champ('Transporteur', liste('transporteur', 'Sélectionner le transporteur', M.ref.transporteursEntrants.concat(['AUTRE']), true), true),
            form.transporteur === 'AUTRE' ? champ('Transporteur autre', texte('transporteurAutre', 'Nom du transporteur'), true) : null,
            champ('Thème', texte('theme', ''), true),
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
            champ('N° de dossier BC', texte('dossier', ''), false),
            champ('N° d’affiche manquante', texte('numeroAffichesManquantes', ''), false))),
        pied()));
  }

  const dt = d => M.fmt.dt(new Date(d));
  const colId = [{ key: 'id', label: 'N°', nowrap: true }, { key: 'date', label: 'Déclarée le', nowrap: true, value: r => new Date(r.date).getTime(), render: r => dt(r.date), csv: r => dt(r.date) }];
  const colPJ = { key: 'pj', label: 'Pièces jointes', align: 'num', value: r => r.fichiers.length };

  /** Réclamation agence › Suivi NC Agence (ex « Tableau principal », renommé le 09/11) : les demandes des agences. */
  function vueTableauAgences(root) {
    root.append(ui.pageHead({ crumb: 'Non-conformité · Réclamation agence', title: 'Suivi NC Agence', screen: 'nonconformite',
      actions: [ui.btn('Nouvelle demande', () => M.go('nonconformite', { tab: 'declaration' }), { icon: 'plus', primary: true })] }),
      ui.card({ flush: true, body: ui.table({ id: 'nc-reclamations', rows: stock('a'), exportName: 'reclamations-agence.xlsx', empty: 'Aucune demande pour l’instant : « Nouvelle demande » ouvre le formulaire des agences.',
        columns: colId.concat([
          { key: 'plateforme', label: 'Plateforme' }, { key: 'region', label: 'Région' }, { key: 'declarant', label: 'Déclarant' }, { key: 'afficheur', label: 'Afficheur' },
          { key: 'dossier', label: 'Dossier BC', nowrap: true }, { key: 'annonceur', label: 'Annonceur' }, { key: 'theme', label: 'Thème' }, { key: 'format', label: 'Format' },
          { key: 'lieu', label: 'Lieu de livraison' }, { key: 'dateAff', label: 'Date d’affichage', nowrap: true },
          { key: 'types', label: 'Type de non-conformité', wrap: true, maxWidth: 300, value: r => r.types.join(' · ') }, colPJ,
          { key: 'commentaire', label: 'Commentaire', wrap: true, maxWidth: 260 }]) }) }));
  }

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
  };
  COLS.decisionPreprod = ['Décision', 220]; // 10/11 : une seule liste de décisions (Pré-Prod, puis plateforme pour « Traité »)
  COLS.decisionPlateforme = ['Décision plateforme (ancienne liste SharePoint)'];
  /* Un seul tableau depuis le 09/11 (à sa demande : « fusionne les pages plateformes et préproduction ») : toutes les colonnes des deux
     exports, dans l'ordre de la vue Préproduction, complété par celles que seule la vue Plateformes avait (transporteur, commentaire de la
     décision plateforme) et par les colonnes de la réception. « vis » : colonnes affichées d'emblée (les autres sont dans « Colonnes »). */
  const ORDRE = ['titre', 'origine', 'bloquante', 'statut', 'annonceur', 'actionPreprod', 'actionPlateforme', 'dossier', 'affiches', 'receptionId', 'decisionPreprod', 'gestionnaire', 'controle', 'typeNC', 'avarie',
    'decisionPlateforme', 'commentaireDecisionPlateforme', 'admin', 'reception', 'ncCond', 'ncBL', 'controlePossible', 'detailVisuel', 'imprimeur', 'imprimeurAutre', 'transporteur', 'transporteurAutre',
    'plateforme', 'theme', 'reserve', 'pj', 'commentaire', 'commentaireNC', 'numerosManquants', 'nbAffichesManquantes', 'mesureCm2', 'statutEtat', 'formats', 'commentaireAgence', 'numeroAffichesManquantes',
    'ncQtesBT', 'nbColis', 'nbPalettes', 'afficheur', 'region', 'declarant', 'dateAff', 'qteRecue', 'qteManquante', 'cree', 'id', 'groupeEtat'];
  const VIS = ['titre', 'origine', 'bloquante', 'statut', 'annonceur', 'dossier', 'plateforme', 'typeNC', 'controle', 'decisionPreprod', 'gestionnaire', 'theme', 'commentaireNC', 'formats', 'declarant', 'cree'];
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
  M.NC_DECISIONS = [['Décision Commerce', 'En cours plateforme'], ['OK préparation en l’état', 'Traitée'], ['Nouvelle impression/Livraison', 'En cours plateforme'], ['Nouvelle préparation', 'En cours plateforme'],
    ['NON JUSTIFIE', 'Traitée'], ['Pas de stock d’affiche', 'En cours plateforme'], ['RAF', 'Traitée'], ['À traiter par la plateforme', 'En cours plateforme'], ['Traité par la plateforme', 'Traitée']];
  const STATUT_DE = Object.fromEntries(M.NC_DECISIONS);
  /** Statut calculé, jamais saisi ni stocké : Pour statistique (non bloquante), À décider (bloquante sans décision), En cours plateforme, Traitée. */
  const statut = r => {
    if (r.bloquante === false) return 'Pour statistique';
    const ds = dec(r.decisionPreprod);
    // Lignes des exports SharePoint : une décision plateforme RAF / Alerte OK PTF vaut traitée
    if (!ds.length) return r.bloquante === undefined && dec(r.decisionPlateforme).some(x => ['RAF', 'Alerte OK PTF'].includes(x)) ? 'Traitée' : 'À décider';
    if (ds.includes('Traité par la plateforme')) return 'Traitée';
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
      typeNC: o.types.slice(), commentaireNC: o.commentaire || '', qteRecue: M.sum(o.affiches, a => Number(a.qte) || 0), pj: 0, fichiers: [],
      affiches: o.affiches.map(a => a.id), receptionId: o.reception.id, origine: o.orpheline ? 'Réception inconnue' : 'Réception', bloquante: !!o.bloquante, stats: !!(o.orpheline && !o.bloquante),
      gestionnaire: '', admin: '', decisionPlateforme: '', decisionPreprod: '', actionPreprod: '', actionPlateforme: '', reception: [], ncBL: [], cree: now.toISOString() });
    delete r.essaye; r.groupeEtat = groupe(r);
    liste.unshift(r); garder(CFG.c.cle, liste);
    M.journal('Réception ' + o.reception.id, 'Non-conformité ' + (r.bloquante ? 'bloquante' : 'non bloquante') + ' n° ' + id + ' : ' + o.types.join(', '));
    return r;
  };
  /** Non-conformités d'une affiche (pour les lignes du contrôle). */
  M.ncDe = afficheId => stock('c').filter(r => (r.affiches || []).includes(afficheId));
  /** Alertes « Non-conformité bloquante » pour Pilotage › Alertes (lues par C.alertes) : jusqu'à la décision. */
  M.ncAlertes = () => stock('c').filter(r => r.bloquante === true && !reglee(r)).map(r => ({
    key: 'NC-' + r.id, type: 'NC_BLOQUANTE', sev: 'critical', site: PTF_SITE[r.plateforme] || null, semaine: null, date: new Date(r.cree),
    titre: r.origine === 'Réception inconnue' ? 'Non-conformité bloquante sur une réception inconnue : go de la préproduction attendu' : 'Non-conformité bloquante à la réception',
    message: 'NC n° ' + r.id + ' · ' + r.plateforme + (r.receptionId ? ' · réception ' + r.receptionId : '') + (r.annonceur ? ' · ' + r.annonceur : '') + (r.dossier ? ' (dossier ' + r.dossier + ')' : '') + ' : ' + arr(r.typeNC) + (r.commentaireNC ? ' — ' + r.commentaireNC : '')
      + (r.origine === 'Réception inconnue' ? '. La Pré-Prod décide avant toute suite (Suivi NC réception, bouton Décision).' : '. Décision de la Pré-Prod attendue dans Suivi NC réception.'),
    link: { screen: 'nonconformite', params: { tab: 'suivi', id: r.id } }, needs: [], roles: ['coord', 'recep'] }));

  function colonnesVue() {
    return ORDRE.map(k => {
      const [label, w] = COLS[k];
      const c = { key: k, label, hidden: !VIS.includes(k), value: r => (k === 'cree' ? new Date(r.cree).getTime() : arr(r[k])) };
      if (k === 'cree') { c.render = r => quand(r.cree); c.csv = r => quand(r.cree); c.nowrap = true; }
      if (k === 'decisionPlateforme' || k === 'decisionPreprod') c.render = r => (dec(r[k]).length ? h('b', null, dec(r[k]).join(' · ')) : h('span', { class: 'muted' }, '—'));
      if (k === 'bloquante') { c.render = tagBloquante; c.value = r => (r.bloquante === true ? 'Bloquante' : r.bloquante === false ? 'Non bloquante' : ''); }
      if (k === 'statut') { c.render = tagStatut; c.value = statut; c.nowrap = true; }
      if (k === 'origine') { c.value = r => r.origine || 'Formulaire'; c.render = r => h('span', null, r.origine || 'Formulaire', r.stats ? [' ', ui.tag('statistiques', 'hyp')] : null); }
      if (w) { c.wrap = true; c.maxWidth = w; }
      return c;
    });
  }
  /** Fiche d'une ligne : toutes les colonnes renseignées, et les deux décisions. */
  function ficheControle(r) {
    ui.modal({ title: r.titre + ' · ' + arr(r.annonceur), wide: true, body: h('table', { class: 'dt' }, h('tbody', null, ORDRE.filter(k => k === 'bloquante' ? r.bloquante !== undefined : k === 'statut' || arr(r[k]) !== '').map(k =>
      h('tr', null, h('th', { style: { width: '34%', whiteSpace: 'normal' } }, COLS[k][0]), h('td', { style: { whiteSpace: 'pre-wrap' } }, k === 'cree' ? quand(r.cree) : k === 'bloquante' ? tagBloquante(r) : k === 'statut' ? tagStatut(r) : k === 'origine' ? r.origine || 'Formulaire' : arr(r[k])))))),
      actions: [{ label: 'Fermer' }, { label: 'Décision', primary: true, onClick: () => { setTimeout(() => decider(r), 0); } }] });
  }
  /** Panneau de décision (10/11, slide de l'utilisatrice) : une seule liste de neuf décisions à cocher (plusieurs possibles), le statut
      qu'elles donnent en regard, un commentaire facultatif, « Valider la décision ». La Pré-Prod décide ; la plateforme coche
      « Traité par la plateforme » quand l'action lui a été renvoyée. */
  function decider(r) {
    const choix = new Set(dec(r.decisionPreprod));
    let comm = r.commentaireDecisionPlateforme || '';
    const apercu = h('div', { class: 'small' });
    const majApercu = () => { const x = Object.assign({}, r, { decisionPreprod: Array.from(choix) }); M.mount(apercu, 'Statut après validation : ', tagStatut(x)); };
    majApercu();
    const valider = () => {
      if (!choix.size) { ui.toast('Cochez au moins une décision.', 'critical'); return; }
      const vals = decisions().filter(x => choix.has(x));
      r.decisionPreprod = vals; r.commentaireDecisionPlateforme = comm;
      r.groupeEtat = groupe(r);
      garder(CFG.c.cle, stock('c'));
      M.journal('Réception contrôle ' + r.id, 'Décision : ' + vals.join(', ') + ' → ' + statut(r));
      close(); M.refresh();
      ui.toast('Décision validée pour ' + r.titre + ' : ' + statut(r) + ' ; mail envoyé (simulation).', 'good');
    };
    const close = ui.drawer({ title: 'Décision', body: h('div', { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'small' }, r.titre + ' · ' + arr(r.annonceur)),
      h('div', { class: 'row', style: { gap: '8px' } }, tagBloquante(r), tagStatut(r)),
      ui.field('Décision (une ou plusieurs)', h('div', { class: 'stack', style: { gap: '4px' } }, M.NC_DECISIONS.map(([x, s]) => h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } },
        ui.checkbox(x, choix.has(x), v => { if (v) choix.add(x); else choix.delete(x); majApercu(); }), h('span', { class: 'small muted' }, '→ ' + s))))),
      apercu,
      ui.field('Commentaire (facultatif)', h('textarea', { class: 'form-control', rows: 4, 'aria-label': 'Commentaire', placeholder: 'Ex. date prévisionnelle de la nouvelle livraison, ré-impression impossible…', oninput: e => { comm = e.target.value; } }, comm)),
      h('div', { class: 'small muted' }, 'Aujourd’hui, ce flux utilise SharePoint et Office 365 Outlook (deux décisions, plateforme puis préproduction). Dans la maquette, une seule décision met la ligne à jour, le statut se calcule et le mail est simulé.'),
      h('div', { class: 'row', style: { gap: '8px' } }, ui.btn('Valider la décision', valider, { primary: true }), ui.btn('Annuler', () => close()))) });
  }
  /** Réception contrôlée › Suivi NC réception : un seul tableau (09/11) pour les déclarations du formulaire et celles faites à la réception. */
  let ouverte = { id: null, seq: 0 };
  function vueSuivi(root, params) {
    const rows = stock('c');
    const F = ui.filters({ id: 'nc-suivi', rows, defs: [
      { key: 'plateforme', label: 'Plateforme', options: opts(rows.map(r => r.plateforme)), get: r => r.plateforme },
      { key: 'bloquante', label: 'Bloquante', options: [{ value: 'oui', label: 'Bloquante' }, { value: 'non', label: 'Non bloquante' }, { value: '—', label: 'Non précisé (formulaire)' }], get: r => (r.bloquante === true ? 'oui' : r.bloquante === false ? 'non' : '—'), stable: true },
      { key: 'origine', label: 'Origine', options: ['Formulaire', 'Réception', 'Réception inconnue'].map(x => ({ value: x, label: x })), get: r => r.origine || 'Formulaire', stable: true },
      { key: 'statut', label: 'Statut', options: Object.keys(STATUTS).map(x => ({ value: x, label: x })), get: statut, stable: true },
      { key: 'decision', label: 'Décision', more: true, options: [{ value: '—', label: 'Pas encore décidé' }].concat(decisions().map(x => ({ value: x, label: x }))), get: r => (dec(r.decisionPreprod).length ? dec(r.decisionPreprod) : '—'), stable: true },
      { key: 'controle', label: 'Contrôle réception', more: true, options: CONTROLES.map(x => ({ value: x, label: x })), get: r => r.controle },
      { key: 'typeNC', label: 'Type de non-conformité', more: true, options: M.NC_RECEPTION.map(x => ({ value: x, label: x })), get: r => r.typeNC },
    ] });
    // Arrivée par une alerte (?id=…) : la fiche de la ligne s'ouvre, une fois par arrivée
    if (params.id && ouverte.seq !== M.navSeq) { ouverte = { id: params.id, seq: M.navSeq }; const r = rows.find(x => String(x.id) === String(params.id)); if (r) setTimeout(() => ficheControle(r), 0); }
    const vis = F.apply(rows), nBloq = rows.filter(r => statut(r) === 'À décider').length, nCours = rows.filter(r => statut(r) === 'En cours plateforme').length;
    root.append(ui.pageHead({ crumb: 'Non-conformité · Réception contrôlée', title: 'Suivi NC réception', screen: 'nonconformite',
      actions: [ui.btn('Nouvelle réception', () => M.go('nonconformite', { tab: 'reception' }), { icon: 'plus', primary: true })] }),
      F.bar,
      h('div', { class: 'kpis', style: { marginBottom: '12px' } },
        ui.stat({ label: 'À décider', value: nBloq, sub: 'bloquantes sans décision : alerte ouverte pour la Pré-Prod', onClick: () => { F.set('statut', ['À décider']); M.refresh(); } }),
        ui.stat({ label: 'En cours plateforme', value: nCours, sub: 'la Pré-Prod a décidé, la plateforme coche « Traité »', onClick: () => { F.set('statut', ['En cours plateforme']); M.refresh(); } }),
        ui.stat({ label: 'Pour statistique', value: rows.filter(r => statut(r) === 'Pour statistique').length, sub: 'non bloquantes : scorecard imprimeur', onClick: () => { F.set('statut', ['Pour statistique']); M.refresh(); } }),
        ui.stat({ label: 'Traitées', value: rows.filter(r => statut(r) === 'Traitée').length, sub: 'décision prise, plus rien à attendre', onClick: () => { F.set('statut', ['Traitée']); M.refresh(); } })),
      ui.card({ flush: true, body: ui.table({ id: 'nc-suivi', rows: vis, exportName: 'suivi-nc-reception.xlsx', onRowClick: ficheControle,
        empty: 'Aucune non-conformité avec ces filtres : « Nouvelle réception » ouvre le formulaire de contrôle ; la réception déclare aussi depuis le bon de livraison et le contrôle de la palette.',
        tone: r => ({ 'À décider': 'critical', 'En cours plateforme': 'warning' }[statut(r)] || null),
        // Un seul bouton (10/11) : la Pré-Prod décide ; la plateforme y coche « Traité par la plateforme ». Rien à décider sur une non bloquante
        rowActions: r => (statut(r) === 'Pour statistique' ? h('span', { class: 'small muted nowrap' }, 'rien à décider')
          : ui.btn(statut(r) === 'En cours plateforme' ? 'Traité ?' : 'Décision', () => decider(r), { small: true, primary: statut(r) === 'À décider', title: statut(r) === 'En cours plateforme' ? 'La plateforme coche « Traité par la plateforme »' : 'Décision de la Pré-Prod' })),
        columns: colonnesVue() }) }),
      ui.annot('Un seul tableau à la place des vues Plateformes et Préproduction (09/11), une seule décision à neuf choix et un statut calculé, jamais saisi (10/11, slides de l’utilisatrice) : Pour statistique (non bloquante), À décider (bloquante, alerte), En cours plateforme (la Pré-Prod a décidé, la plateforme agit puis coche « Traité »), Traitée. La portée se déduit de l’item coché à la réception ; « Croix mal positionnées » et « Écart de quantité » se précisent. Départ : les 9 lignes des exports du 09/11, dont la décision plateforme reste en colonne masquée.', []));
  }

  const PAGES = { declaration: vueDemande, reclamation: vueTableauAgences, reception: vueControle, suivi: vueSuivi };

  M.screen({
    id: 'nonconformite', title: 'Non-conformité', nav: 'Non-conformité', roles: ['recep', 'coord', 'cheq', 'admin'], vueDefaut: 'reception',
    render(root, params) {
      // Anciennes adresses (09/11) : les vues Plateformes et Préproduction sont fusionnées dans le Suivi NC réception
      if (params.tab === 'plateformes' || params.tab === 'preproduction') { M.go('nonconformite', { tab: 'suivi' }); return; }
      PAGES[PAGES[params.tab] ? params.tab : 'reception'](root, params || {});
    },
  });
})();
