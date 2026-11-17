/* ==========================================================================
   Circé — maquette cible : données fictives et règles de calcul
   Générateur déterministe (même graine = mêmes données à chaque ouverture).
   Aucun nom de client, d'afficheur ou de collaborateur réel.
   ========================================================================== */
(function () {
  'use strict';
  const M = window.M;

  /* ---------- Aléa déterministe ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let rnd = mulberry32(1);
  const R = {
    f: () => rnd(),
    i: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    pick: arr => arr[Math.floor(rnd() * arr.length)],
    p: x => rnd() < x,
    sample: (arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); },
  };

  /* ---------- Calendrier simulé ---------- */
  M.NOW = new Date(2026, 9, 13, 10, 0);          // mardi 13/10/2026 10:00
  M.SEM_PROD = 42;                                // semaine de production en cours (départ S43)
  M.lundi = sem => new Date(2026, 9, 12 + (sem - 42) * 7);
  /** Date relative au lundi de la semaine `sem` (jour 0 = lundi). */
  M.at = (sem, jour, hh, mm) => { const d = M.lundi(sem); d.setDate(d.getDate() + jour); d.setHours(hh || 0, mm || 0, 0, 0); return d; };
  M.deadlinePP = sem => M.at(sem - 2, 3, 16, 0);          // jeudi S-2 16h
  M.deadlineReception = sem => M.at(sem - 2, 4, 16, 30);  // vendredi S-2 16h30

  /* ---------- Référentiels (paramétrables dans la cible) ---------- */
  M.ref = {
    sites: [
      { id: 'NIM', label: 'Nîmes' },
      { id: 'WIS', label: 'Wissous' },
      { id: 'NAN', label: 'Nanterre (Bus)', cible: true },
    ],
    semaines: [
      { num: 42, statut: 'expédiée' },
      { num: 43, statut: 'en production' },
      { num: 44, statut: 'en préparation' },
      { num: 45, statut: 'à venir' },
    ],
    machines: [
      { id: 'NIM-VEN', site: 'NIM', label: 'Vendôme One – Nîmes', type: 'vendome', fichier: true, tiroirs: 20, bagues: 'automatiques', sortie: 'INI (via GenfichierProd, outil Caire)', repertoire: 'Vendôme One › Référence (cairenimes)' },
      { id: 'NIM-CCM', site: 'NIM', label: 'CCM V2 – Nîmes', type: 'ccm', fichier: false, bagues: 'imprimées à la main', sortie: '—' },
      { id: 'WIS-VEN', site: 'WIS', label: 'Vendôme One – Wissous (MUI)', type: 'vendome', fichier: true, tiroirs: 20, bagues: 'automatiques', sortie: 'INI (via GenfichierProd, outil Caire)', repertoire: 'Vendôme One › Référence (à confirmer)' },
      { id: 'NIM-MR', site: 'NIM', label: 'Multi-rouleuse – Nîmes', type: 'multirouleuse', fichier: true, bagues: '—', sortie: 'CSV ; cp1252, sans en-tête, 1 fichier par annonceur et thème', repertoire: 'Partage de la multi-rouleuse (« dossier jaune »)' },
      { id: 'WIS-MR', site: 'WIS', label: 'Multi-rouleuse – Wissous', type: 'multirouleuse', fichier: true, bagues: '—', sortie: 'CSV ; cp1252, sans en-tête, 1 fichier par annonceur et thème', repertoire: 'Partage de la multi-rouleuse' },
      { id: 'NIM-A8', site: 'NIM', label: 'Assemblage 8 m² – Nîmes', type: 'assemblage', fichier: false, bagues: 'imprimées à la main', sortie: '—' },
      { id: 'WIS-A8', site: 'WIS', label: 'Assemblage 8 m² – Wissous', type: 'assemblage', fichier: false, bagues: 'imprimées à la main', sortie: '—' },
      { id: 'NIM-TR', site: 'NIM', label: 'Tables de roulage – Nîmes', type: 'roulage', fichier: false, bagues: 'imprimées à la main', sortie: '—' },
      { id: 'WIS-TR', site: 'WIS', label: 'Tables de roulage – Wissous', type: 'roulage', fichier: false, bagues: 'imprimées à la main', sortie: '—' },
    ],
    ateliers: [
      { id: 'NIM-D2', site: 'NIM', label: '2 m² déroulant', mode: 'train', formats: ['2 m² scrolling', '2 m² Venusial'], machines: ['NIM-VEN', 'NIM-CCM'] },
      { id: 'NIM-F2', site: 'NIM', label: '2 m² fixe', mode: 'unitaire', type: 'fixe', formats: ['2 m² fixe'], machines: ['NIM-MR'] },
      { id: 'NIM-D8', site: 'NIM', label: '8 m² déroulant', mode: 'train', formats: ['8 m² scrolling'], machines: ['NIM-A8', 'NIM-TR'] },
      { id: 'NIM-D4', site: 'NIM', label: '4 m² déroulant', mode: 'train', formats: ['4 m² scrolling'], machines: ['NIM-TR'] },
      { id: 'WIS-D2', site: 'WIS', label: '2 m² déroulant / MUI', mode: 'train', formats: ['Scrolling MUI', '2 m² scrolling'], machines: ['WIS-VEN', 'WIS-TR'] },
      { id: 'WIS-F2', site: 'WIS', label: '2 m² fixe', mode: 'unitaire', type: 'fixe', formats: ['2 m² fixe'], machines: ['WIS-MR'] },
      { id: 'WIS-D8', site: 'WIS', label: '8 m² déroulant', mode: 'train', formats: ['8 m² scrolling'], machines: ['WIS-A8', 'WIS-TR'] },
      { id: 'WIS-D4', site: 'WIS', label: '4 m² déroulant', mode: 'train', formats: ['4 m² scrolling'], machines: ['WIS-TR'] },
      { id: 'WIS-COL', site: 'WIS', label: 'Colle / pliage', mode: 'unitaire', type: 'pliage', formats: ['4 m² collé', '8 m² collé', '12 m² collé'], machines: [] },
      { id: 'NAN-BUS', site: 'NAN', label: 'Bus', mode: 'unitaire', type: 'bus', cible: true, formats: ['Bus arrière 1', 'Bus arrière 2', 'Bus flanc gauche', 'Bus flanc droit', 'Bus avant'], machines: [] }, // 5 formats (note Bus du 08/10, BUS-03)
    ],
    // jour = décalage depuis le lundi de S-1 (3 = jeudi S-1, 7 = lundi S)
    destinataires: [
      { id: 'BOR', site: 'NIM', label: 'Bordeaux', boucle: 'Boucle Sud-Ouest', canal: 'MILK', jour: 3, hh: 16, mm: 30 },
      { id: 'TLS', site: 'NIM', label: 'Toulouse', boucle: 'Boucle Sud-Ouest', canal: 'MILK', jour: 3, hh: 16, mm: 30 },
      { id: 'LYO', site: 'NIM', label: 'Lyon', boucle: 'Boucle Rhône-Alpes', canal: 'MILK', jour: 4, hh: 10, mm: 0 },
      { id: 'MRS', site: 'NIM', label: 'Marseille', boucle: 'Boucle Sud-Est', canal: 'MILK', jour: 4, hh: 11, mm: 0 },
      { id: 'NCE', site: 'NIM', label: 'Nice', boucle: 'Boucle Sud-Est', canal: 'MILK', jour: 4, hh: 11, mm: 0 },
      { id: 'MTP', site: 'NIM', label: 'Montpellier', boucle: 'Messagerie express', canal: 'MESSAGERIE', jour: 3, hh: 16, mm: 45 },
      { id: 'AVI', site: 'NIM', label: 'Avignon', boucle: 'Messagerie express', canal: 'MESSAGERIE', jour: 3, hh: 16, mm: 45 },
      { id: 'NIA', site: 'NIM', label: 'Nîmes agence', boucle: 'Messagerie express', canal: 'MESSAGERIE', jour: 4, hh: 16, mm: 45 },
      { id: 'SPP', site: 'WIS', label: 'St-Pierre-du-Perray', boucle: 'Boucle IDF', canal: 'MILK', jour: 7, hh: 11, mm: 0 },
      { id: 'NTR', site: 'WIS', label: 'Nanterre', boucle: 'Boucle IDF', canal: 'MILK', jour: 7, hh: 11, mm: 0 },
      { id: 'REN', site: 'WIS', label: 'Rennes', boucle: 'Boucle Ouest', canal: 'MILK', jour: 4, hh: 16, mm: 0 },
      { id: 'NTE', site: 'WIS', label: 'Nantes', boucle: 'Boucle Ouest', canal: 'MILK', jour: 4, hh: 16, mm: 0 },
      { id: 'CAE', site: 'WIS', label: 'Caen', boucle: 'Boucle Normandie', canal: 'MILK', jour: 7, hh: 6, mm: 0 },
      { id: 'LIL', site: 'WIS', label: 'Lille-Fretin', boucle: 'Boucle Nord', canal: 'MILK', jour: 7, hh: 6, mm: 0 },
      { id: 'ORL', site: 'WIS', label: 'Orléans', boucle: 'Boucle Centre', canal: 'MILK', jour: 4, hh: 14, mm: 0 },
      { id: 'STR', site: 'WIS', label: 'Strasbourg', boucle: 'Messagerie express', canal: 'MESSAGERIE', jour: 3, hh: 16, mm: 45 },
      { id: 'BNO', site: 'NAN', label: 'Dépôt bus Nord', boucle: 'Remise directe', canal: 'DIRECT', jour: 4, hh: 9, mm: 0 },
      { id: 'BOU', site: 'NAN', label: 'Dépôt bus Ouest', boucle: 'Remise directe', canal: 'DIRECT', jour: 4, hh: 9, mm: 0 },
      { id: 'BSE', site: 'NAN', label: 'Dépôt bus Seine', boucle: 'Remise directe', canal: 'DIRECT', jour: 4, hh: 9, mm: 0 },
    ],
    imprimeurs: ['Imprimerie Rhône Print', 'Atelier Grand Format', 'Print Cityz', 'Imprimerie du Lac', 'Sérigraphie Ouest', 'Offset Méditerranée'],
    transporteursEntrants: ['Geodis', 'Transports Martin', 'Messagerie Express', 'Livraison imprimeur'],
    // Agents de réception : le contrôleur se choisit dans cette liste (REC-12), tenue dans Paramétrage › Référentiels (REC-14)
    controleurs: ['Contrôleur A', 'Contrôleur B', 'Contrôleur C', 'Contrôleur D'],
    canaux: { MILK: 'Milk run Geodis', MESSAGERIE: 'Messagerie Geodis', DIRECT: 'Remise directe' },
  };
  const NOMS = ['Lefort', 'Garnier', 'Morel', 'Chevalier', 'Roussel', 'Fabre', 'Perrin', 'Gauthier', 'Blanchard', 'Masson', 'Renaud', 'Lambert', 'Bonnet', 'Dupuis', 'Marchand', 'Lemoine', 'Fontaine', 'Barbier', 'Arnaud', 'Giraud', 'Collet', 'Vidal', 'Leclerc', 'Picard', 'Royer', 'Caron', 'Aubert', 'Meunier', 'Brunet', 'Carpentier', 'Moulin', 'Lacroix', 'Benoit', 'Rolland', 'Colin', 'Hubert', 'Riviere', 'Noel'];
  const ANNONCEURS = ['Brasserie du Port', 'Optique Lumière', 'Ville de Valmont', 'Festival Arcadia', 'Meubles Duval', 'Banque Horizon', 'Opéra de Lys', 'Jardins Verdier', 'Auto Sélection', 'Musée des Arts Mécaniques', 'Croisières Azur', 'Théâtre du Rivage', "Salon de l'Habitat", 'Assurances Cap', 'Cinéma Le Phare', 'Métropole de Nordval', 'Parfums Ambre', 'Sport Altitude', 'Librairie Papyrus', 'Électro Max', 'Voyages Sirocco', 'Mutuelle Alizé', "Région Val-d'Or", 'Chocolats Bastide'];
  const THEMES = ['Rentrée 2026', 'Nouvelle collection', 'Portes ouvertes', 'Halloween', 'Saison 26-27', 'Concert du 24 oct.', 'Fête de la science', 'Offre -30 %', 'Marché de Noël', 'Exposition Vapeur', 'Escale en Méditerranée', "Tournée d'hiver", 'Semaine bleue', 'Collecte solidaire', 'Ouverture le dimanche', 'Black Friday', 'Salon du livre', 'Grand prix cycliste', 'Jeunes talents', 'Nuit des musées', 'Les 100 ans', 'Ateliers enfants', 'Bien chez soi', 'Cap sur le sud', 'Le goût du vrai'];
  const BUS_ANNONCEURS = ['Métropole de Nordval', 'Opéra de Lys', 'Voyages Sirocco', 'Banque Horizon', 'Festival Arcadia'];

  /* ---------- Statuts cibles (paramétrables, libellés à valider en atelier) ---------- */
  M.STATUTS = {
    A_TRAITER: { label: 'À traiter', step: 0, help: "Broadcast n'a encore rien envoyé" },
    PREPA_RECUE: { label: 'Préparation reçue', step: 2, help: 'Préparation envoyée par la Pré-Prod depuis Broadcast. La validation admin est à part : elle part de la réception, sans attendre la préparation (02/11)' },
    VALIDE: { label: 'Validation admin faite', step: 4, help: 'Valeur interne (préparation reçue et validation admin faite) : à l’écran, le dossier est « Préparation reçue » et la validation admin a sa propre pastille, indépendante de la préparation (C.statutDossier, 02/11). Préparation reçue et toutes les affiches reçues du dossier confirmées par la Coordination. Circé propose le rattachement dès la réception, sans attendre la préparation ni l’Instruction OK ; une personne confirme, en lot (02/11). Une affiche qui arrive ensuite repasse le dossier à « Préparation reçue » jusqu’à sa confirmation. Sans aucune affiche reçue, il n’y a rien à valider : le dossier reste « Préparation reçue » (02/11)' },
    ANNULE: { label: 'Annulé', step: 'x', help: 'Pas à produire' },
    EN_ATTENTE: { label: "En attente d'affiches", step: 1, help: 'Au moins un visuel manque' },
    PRET: { label: 'Prêt à produire', step: 2, help: 'Tous les visuels sont reçus (ou fractionnés)' },
    EN_PROD: { label: 'En production', step: 3, help: 'Fichier envoyé à la machine ou bagues imprimées : point de non-retour, toute modification déclenche une alerte' },
    PRODUIT: { label: 'Produit', step: 3, help: 'Sorti de machine, pas encore scanné au colisage' },
    COLISE: { label: 'Colisé · à expédier', step: 4, help: 'Scanné dans un colis clos' },
    EXPEDIE: { label: 'Expédié', step: 5, help: 'Pris en charge par Geodis (fin de journée)' },
    LIVRE: { label: 'Livré', step: 5, help: 'Preuve de livraison reçue de Geodis' },
    ORPHELINE: { label: 'Orpheline', step: 0, help: 'Réception sans dossier identifié' },
    IDENTIFIEE: { label: 'Identifiée', step: 4 },
    COLIS_OUVERT: { label: 'Colis ouvert', step: 3 },
    COLIS_CLOS: { label: 'Clos · à expédier', step: 4 },
  };
  /** Étapes du suivi de prod (graphiques) à partir du statut d'une unité. */
  M.ETAPE = { EN_ATTENTE: 'attente', PRET: 'pret', EN_PROD: 'prod', PRODUIT: 'prod', COLISE: 'colise', EXPEDIE: 'expedie', LIVRE: 'expedie' };
  /** Type de réalisation d'affiche de la DA (format physique imprimé), d'après le format du dossier. Libellés fictifs, sur le
      modèle de la capture de Broadcast du 21/10 (« 320x240 Recto verso 150 gr », « 118,5x175 »). */
  M.typeRealisation = f => (/^2 m²|MUI/.test(f) ? '118,5 × 175' : /^8 m²/.test(f) ? '320 × 240 recto verso 150 g' : /^4 m²/.test(f) ? '240 × 160' : /^12 m²/.test(f) ? '400 × 300' : /Bus/.test(f) ? f + ' (bus)' : f);

  /* ---------- Paramètres métier (écran Paramétrage) ---------- */
  M.PARAMS = {
    entretien: { seuil: 3, arrondi: 'supérieur', grain: 'afficheur' },
    ecartReception: 0.10,
    // Contrôle des affiches : comptage manuel par morceau sous ce seuil (le « xx » de la slide S20, à fixer en atelier)
    comptageMorceau: 30,
    // Feuilles de stock imprimées au contrôle : 2 exemplaires en S20 (palette et Pré-Prod), 3 cités le 19/10 (Q32)
    exemplairesFeuille: 2,
    // Réceptions attendues ou partielles purgées au bout de 4 semaines, sauf conservation à l'année (Synthèse, ligne 89)
    purgeAttendues: 4,
    // Le sas de contrôle (zone tampon) se remplit et doit être contrôlé vite (19/10) : alerte au-delà de ce délai, en heures (à fixer)
    delaiControle: 24,
    // Allée où l'on range les affiches des réceptions inconnues en attente d'identification (zone tampon, 21/10 ; à fixer par site)
    alleeInconnues: 'X',
    regroupements: [{ motif: '*MISTRAL*', valeur: 'MISTRAL' }],
    seuilThemesProches: 0.85,
    // Fin de campagne (REC-24) : destruction proposée N semaines après le dernier départ, selon le format (RP32 #4 : 4 semaines
    // au 2 m², 2 au 8 m² faute de place de stockage) ; points d'attention à décider un par un
    finCampagne: { delai: { '2 m²': 4, '8 m²': 2, autres: 4 }, attention: ['BDX', 'MUI'] },
    criteres: {
      train: ['Train reçu à 100 %', 'Destinataire (départ camion le plus proche)', 'Jour de départ', 'Nombre de tiroirs (≤ 20)', "Nombre d'affiches par tiroir (gros volumes d'abord)"],
      fixe: ['Reçu', 'Jour de départ', 'Destinataire'],
      pliage: ['Reçu', 'Jour de départ', 'Destinataire'],
    },
  };

  /* ======================================================================
     Générateur
     ====================================================================== */
  function generate() {
    rnd = mulberry32(20261013);
    const D = {
      dossiers: [], themes: [], lignes: [], unites: [], affiches: [], receptions: [], attenduesAnciennes: [],
      colis: [], mouvements: [], generations: [], events: [], outbox: [], journal: [], liberations: [], ack: new Set(),
      afficheurs: [], operateurs: [], dispatch: {},
    };
    let seqDossier = 0, seqTheme = 0, seqLigne = 0, seqUnite = 0, seqAffiche = 0, seqRecep = 0, seqColis = 0;

    // Afficheurs fictifs : 2 ou 3 équipes par destinataire
    const noms = R.sample(NOMS, NOMS.length);
    let ni = 0;
    M.ref.destinataires.forEach(dest => {
      const n = dest.site === 'NAN' ? 1 : R.i(2, 3);
      for (let k = 0; k < n; k++) D.afficheurs.push({ id: 'AF-' + dest.id + (k + 1), dest: dest.id, label: dest.site === 'NAN' ? 'Équipe dépôt ' + dest.label.replace('Dépôt bus ', '') : 'Équipe ' + noms[ni++ % noms.length] });
    });
    // Opérateurs de roulage (dispatch)
    ['NIM', 'WIS'].forEach(site => { for (let k = 1; k <= (site === 'NIM' ? 6 : 5); k++) D.operateurs.push({ id: site + '-OP' + k, site, label: (site === 'NIM' ? 'Rouleur N' : 'Rouleur W') + k, poste: 'Table ' + Math.ceil(k / 2) }); });

    // ---- Dossiers et thèmes
    const PLAN = {
      // Le 2 m² déroulant est l'atelier le plus chargé : assez de visuels pour que la limite de 20 tiroirs joue
      NIM: { 42: ['NIM-D2', 'NIM-D2', 'NIM-D2', 'NIM-F2', 'NIM-F2', 'NIM-D8'], 43: Array(13).fill('NIM-D2').concat(['NIM-F2', 'NIM-F2', 'NIM-F2', 'NIM-F2', 'NIM-F2', 'NIM-D8', 'NIM-D8', 'NIM-D4']), 44: Array(6).fill('NIM-D2').concat(['NIM-F2', 'NIM-F2', 'NIM-F2', 'NIM-D8', 'NIM-D4']), 45: ['NIM-D2', 'NIM-F2', 'NIM-D8'] },
      WIS: { 42: ['WIS-D2', 'WIS-D2', 'WIS-F2', 'WIS-F2', 'WIS-D8', 'WIS-COL'], 43: Array(8).fill('WIS-D2').concat(['WIS-F2', 'WIS-F2', 'WIS-F2', 'WIS-D8', 'WIS-D8', 'WIS-COL', 'WIS-COL', 'WIS-D4']), 44: ['WIS-D2', 'WIS-D2', 'WIS-D2', 'WIS-F2', 'WIS-F2', 'WIS-D8', 'WIS-COL', 'WIS-COL'], 45: ['WIS-D2', 'WIS-F2', 'WIS-COL'] },
      NAN: { 43: ['NAN-BUS', 'NAN-BUS', 'NAN-BUS'], 44: ['NAN-BUS', 'NAN-BUS'] },
    };
    const ANN = R.sample(ANNONCEURS, ANNONCEURS.length);
    let ai = 0;
    const atelier = id => M.ref.ateliers.find(a => a.id === id);

    function addDossier(site, sem, atId, opts) {
      opts = opts || {};
      const at = atelier(atId);
      let format = opts.format;
      if (!format) {
        if (atId === 'WIS-D2') format = R.p(0.75) ? 'Scrolling MUI' : '2 m² scrolling';
        else if (atId === 'NIM-D2') format = R.p(0.25) ? '2 m² Venusial' : '2 m² scrolling';
        else if (atId === 'WIS-COL') format = at.formats[R.i(0, 2)];
        else format = at.formats[0];
      }
      const isTrain = at.mode === 'train';
      const seq = ++seqDossier;
      // Un dossier livré sur deux plateformes (21/10, DA « adresses de livraison ») : la part de la 2e plateforme est un
      // objet à part (son atelier, ses lignes), avec le même n° Broadcast dans « no » et la même DA
      const d = {
        id: opts.id || String(910000 + seq * 37), da: opts.da || String(470000 + seq * 53), no: opts.no || null,
        annonceur: opts.annonceur || (atId === 'NAN-BUS' ? R.pick(BUS_ANNONCEURS) : ANN[(ai++) % ANN.length]),
        site, semaine: sem, semaines: opts.semaines || [sem], atelier: atId, format,
        entretienPct: R.pick([8, 10, 10, 12]), print: R.p(0.3), controlee: isTrain && R.p(0.12),
        ipSaisies: true, prepaEnvoyee: true, prepaDate: null, statutPP: 'VALIDE', qteBC: null, qteBCInfo: null,
        pole: R.p(0.6) ? 'Pôle Direct' : 'Pôle Intermédié', themes: [], historique: [], apresLiberation: false, ajusteBus: null,
      };
      // Campagne contrôlée : 15 % d'entretien et début de train (R25, RP31). Sans tirage : l'aléa des données ne bouge pas.
      if (d.controlee) d.entretienPct = 15;
      // Statuts Pré-Prod selon l'horizon
      if (sem === 43) {
        const r = R.f();
        d.statutPP = r < 0.84 ? 'VALIDE' : r < 0.95 ? 'PREPA_RECUE' : 'A_TRAITER';
      } else if (sem === 44) {
        const r = R.f();
        d.statutPP = r < 0.35 ? 'VALIDE' : r < 0.72 ? 'PREPA_RECUE' : 'A_TRAITER';
      } else if (sem === 45) {
        d.statutPP = R.p(0.25) ? 'PREPA_RECUE' : 'A_TRAITER';
      }
      if (opts.statutPP) d.statutPP = opts.statutPP;
      d.prepaEnvoyee = d.statutPP !== 'A_TRAITER';
      d.ipSaisies = d.prepaEnvoyee || (sem >= 44 ? R.p(0.5) : false);
      if (opts.ipSaisies !== undefined) d.ipSaisies = opts.ipSaisies;
      d.prepaDate = d.prepaEnvoyee ? M.at(sem - 2, R.i(0, 3), R.i(9, 17), R.pick([0, 15, 30, 45])) : null;
      if (d.prepaDate && d.prepaDate > M.NOW) d.prepaDate = new Date(M.NOW.getTime() - R.i(2, 40) * 3600e3);
      d.historique.push({ date: d.prepaDate || M.at(sem - 4, 1, 9), user: 'Broadcast', action: d.prepaEnvoyee ? 'Préparation envoyée' : 'Dossier créé (DA activée)' });
      // Thèmes
      const nbT = opts.themes ? opts.themes.length : atId.endsWith('F2') ? R.i(1, 4) : atId.endsWith('D8') || atId.endsWith('D4') || atId === 'NAN-BUS' ? R.i(1, 2) : atId === 'WIS-COL' ? R.i(1, 2) : R.i(1, 3);
      const libs = opts.themes || R.sample(THEMES, nbT);
      libs.forEach((lib, k) => {
        const th = {
          id: 'TH' + (++seqTheme), dossierId: d.id, libelle: d.ipSaisies ? lib : '(IP non saisies)', position: String.fromCharCode(65 + k),
          exclu: null, qte: 0, qteEnt: 0, d8: null, repiquage: R.p(0.15) ? 'Du ' + (10 + k) + ' au ' + (24 + k) + '/10' : '',
        };
        if (isTrain && k > 0 && R.p(0.07)) th.exclu = R.pick(['NE_PAS_AFFICHER', 'RESTE_EN_PLACE']);
        if (!d.ipSaisies) th.libelleVisuel = lib; // ce qu'on lit sur l'affiche : la plateforme le saisit à la réception (REC-18)
        D.themes.push(th); d.themes.push(th.id);
      });
      D.dossiers.push(d);
      return d;
    }

    Object.entries(PLAN).forEach(([site, weeks]) => Object.entries(weeks).forEach(([sem, list]) => list.forEach(atId => addDossier(site, Number(sem), atId))));
    // Cas métier explicites
    const mistral1 = addDossier('NIM', 43, 'NIM-F2', { annonceur: 'MISTRAL Nîmes', themes: ['Foire aux vins'], statutPP: 'VALIDE' });
    const mistral2 = addDossier('NIM', 43, 'NIM-F2', { annonceur: 'MISTRAL Vence', themes: ['Foire aux vins'], statutPP: 'VALIDE' });
    const proches = addDossier('NIM', 43, 'NIM-F2', { annonceur: 'Fromagerie Lacombe', themes: ['Automne gourmand', 'automne gourmand 16 oct'], statutPP: 'VALIDE' });
    const demoMR = new Set([mistral1.id, mistral2.id, proches.id]);   // cas de démonstration du générateur multi-rouleuse
    const multiSem = addDossier('NIM', 43, 'NIM-F2', { annonceur: 'Cuisines Atelier 7', themes: ['Nouvelle cuisine 2027'], statutPP: 'VALIDE', semaines: [43, 44] });
    addDossier('WIS', 43, 'WIS-D2', { annonceur: 'Ville de Valmont', themes: ['Nuit blanche', 'Patrimoine'], statutPP: 'VALIDE', format: 'Scrolling MUI', semaines: [43, 44] });
    const sansIP = addDossier('NIM', 44, 'NIM-F2', { annonceur: 'Chocolats Bastide', themes: ['Coffrets de Noël'], statutPP: 'A_TRAITER', ipSaisies: false });
    const ecartBC1 = D.dossiers.find(d => d.semaine === 43 && d.atelier === 'NIM-D2' && d.statutPP === 'PREPA_RECUE') || D.dossiers.find(d => d.semaine === 43 && d.atelier === 'NIM-D2');
    const annule = D.dossiers.find(d => d.semaine === 43 && d.site === 'WIS' && d.atelier === 'WIS-D2' && d.statutPP === 'VALIDE' && d !== ecartBC1);
    if (annule) { annule.statutPP = 'ANNULE'; annule.historique.push({ date: M.at(42, 0, 15, 10), user: 'Broadcast', action: 'Dossier annulé (vente annulée)' }); }
    // Dossiers livrés sur deux plateformes (DA du 21/10 : 968 affiches pour Nîmes, 1 433 pour Wissous). Un en production,
    // un avant les IP (la DA seule : type de réalisation × plateforme, pas encore de thème).
    const deuxPlt = addDossier('NIM', 43, 'NIM-D8', { annonceur: "Région Val-d'Or", themes: ['Fête des lumières'], statutPP: 'VALIDE' });
    addDossier('WIS', 43, 'WIS-D8', { annonceur: "Région Val-d'Or", themes: ['Fête des lumières'], statutPP: 'VALIDE', id: deuxPlt.id + '-W', no: deuxPlt.id, da: deuxPlt.da });
    addDossier('WIS', 44, 'WIS-F2', { annonceur: 'Chocolats Bastide', themes: ['Coffrets de Noël'], statutPP: 'A_TRAITER', ipSaisies: false, id: sansIP.id + '-W', no: sansIP.id, da: sansIP.da });

    const byDossier = id => D.dossiers.find(d => d.id === id);
    const destsOf = site => M.ref.destinataires.filter(x => x.site === site);
    const afficheursOf = destId => D.afficheurs.filter(a => a.dest === destId);
    const live = d => d.prepaEnvoyee && d.statutPP !== 'ANNULE';

    function addLigne(th, d, dest, aff, qte) {
      let l = D.lignes.find(x => x.themeId === th.id && x.afficheur === aff.id);
      if (!l) { l = { id: 'L' + (++seqLigne), themeId: th.id, dossierId: d.id, site: d.site, semaine: d.semaine, atelier: d.atelier, dest: dest.id, afficheur: aff.id, qte: 0, entretien: 0 }; D.lignes.push(l); }
      l.qte += qte;
      return l;
    }

    // ---- Lignes et unités : ateliers unitaires (fixe, pliage, bus)
    D.dossiers.filter(d => atelier(d.atelier).mode === 'unitaire' && live(d)).forEach(d => {
      const dests = d === mistral1 || d === mistral2 ? R.sample(destsOf(d.site), 2) : R.sample(destsOf(d.site), d.atelier === 'NAN-BUS' ? 3 : R.i(2, 4));
      d.themes.map(id => D.themes.find(t => t.id === id)).forEach(th => {
        dests.forEach(dest => R.sample(afficheursOf(dest.id), R.i(1, 2)).forEach(aff => {
          const q = d.atelier === 'NAN-BUS' ? R.i(8, 40) : d.atelier === 'WIS-COL' ? R.i(2, 12) : R.i(2, 28);
          addLigne(th, d, dest, aff, q);
        }));
      });
    });

    // ---- Trains : ateliers déroulants, par site / semaine / atelier
    const trainAteliers = M.ref.ateliers.filter(a => a.mode === 'train');
    [42, 43, 44, 45].forEach(sem => trainAteliers.forEach(at => {
      const pool = D.dossiers.filter(d => d.atelier === at.id && d.semaine === sem && live(d))
        .flatMap(d => d.themes.map(id => D.themes.find(t => t.id === id)).filter(t => !t.exclu));
      if (!pool.length) return;
      const used = new Set();
      const dests = R.sample(destsOf(at.site), Math.min(destsOf(at.site).length, at.id.endsWith('D2') ? 8 : 4));
      dests.forEach(dest => afficheursOf(dest.id).slice(0, R.i(1, 3)).forEach(aff => {
        const nTypes = at.id.endsWith('D2') ? R.i(2, 4) : 1;
        for (let k = 0; k < nTypes; k++) {
          const pos = R.sample(pool, R.i(1, Math.min(4, pool.length)));
          addTrain(at, sem, dest, aff, pos, at.id.endsWith('D2') ? R.i(1, 9) : R.i(1, 4));
          pos.forEach(t => used.add(t.id));
        }
      }));
      pool.filter(t => !used.has(t.id)).forEach(t => { const dest = R.pick(dests); addTrain(at, sem, dest, R.pick(afficheursOf(dest.id)), [t], R.i(1, 5)); });
    }));
    function addTrain(at, sem, dest, aff, positions, nb) {
      // Campagnes contrôlées en tête de train (SCR-09)
      const ordered = positions.slice().sort((a, b) => (byDossier(b.dossierId).controlee ? 1 : 0) - (byDossier(a.dossierId).controlee ? 1 : 0));
      const firstD = byDossier(ordered[0].dossierId);
      let machine = at.machines[0];
      if (at.id === 'NIM-D2' && firstD.format === '2 m² Venusial') machine = 'NIM-CCM';
      if (at.id === 'WIS-D2' && firstD.format !== 'Scrolling MUI') machine = 'WIS-TR';
      const u = { id: 'TR-' + String(++seqUnite).padStart(4, '0'), kind: 'TRAIN', site: at.site, semaine: sem, atelier: at.id, machine, dest: dest.id, afficheur: aff.id, nb, positions: ordered.map(t => ({ themeId: t.id, fr: false })), statut: 'EN_ATTENTE', bague: false, operateur: null, generation: null, modifs: [] };
      D.unites.push(u);
      ordered.forEach(t => addLigne(t, byDossier(t.dossierId), dest, aff, nb));
    }
    // Unités unitaires : une UM (rouleau) par ligne pour le fixe, un lot pour le pliage et le bus
    D.lignes.filter(l => atelier(l.atelier).mode === 'unitaire').forEach(l => {
      const at = atelier(l.atelier);
      D.unites.push({ id: (at.type === 'fixe' ? 'UM-' : at.type === 'pliage' ? 'PL-' : 'BU-') + String(++seqUnite).padStart(4, '0'), kind: at.type === 'fixe' ? 'UM' : 'LOT', site: l.site, semaine: l.semaine, atelier: l.atelier, machine: at.machines[0] || null, dest: l.dest, afficheur: l.afficheur, ligneId: l.id, themeId: l.themeId, nb: 1, statut: 'EN_ATTENTE', bague: false, generation: null, modifs: [] });
    });

    // ---- Entretien calculé à l'afficheur (REU-06), puis quantités par thème
    D.lignes.forEach(l => { const d = byDossier(l.dossierId); l.entretien = M.calc.entretien(l.qte, d.entretienPct); });
    D.themes.forEach(t => {
      const ls = D.lignes.filter(l => l.themeId === t.id);
      t.qte = M.sum(ls, l => l.qte); t.qteEnt = t.qte + M.sum(ls, l => l.entretien);
    });
    // Dossiers sans préparation : quantité attendue issue de la DA (pas de lignes)
    D.dossiers.filter(d => !d.prepaEnvoyee).forEach(d => d.themes.forEach(id => { const t = D.themes.find(x => x.id === id); t.qte = R.i(20, 90); t.qteEnt = Math.round(t.qte * (1 + d.entretienPct / 100)); }));
    D.dossiers.forEach(d => { d.qteBC = M.sum(d.themes.map(id => D.themes.find(t => t.id === id)), t => t.qte); });
    // DA (demande d'affiches) : dossier × type de réalisation d'affiche × plateforme de livraison, avec les faces et les
    // affiches entretien inclus ; c'est l'attendu de chaque plateforme, avant les IP (pas de thème)
    D.dossiers.forEach(d => {
      const ths = d.themes.map(id => D.themes.find(t => t.id === id));
      d.typeReal = M.typeRealisation(d.format);
      d.daLignes = [{ typeReal: d.typeReal, site: d.site, faces: M.sum(ths, t => t.qte), affiches: M.sum(ths, t => t.qteEnt) }];
    });
    // Écart BC / Circé après blocage-déblocage (ANO-06)
    if (ecartBC1) { ecartBC1.qteBCInfo = { bc: Math.max(1, ecartBC1.qteBC - 20), circe: ecartBC1.qteBC, date: M.at(42, 0, 11, 20) }; ecartBC1.statutPP = 'PREPA_RECUE'; }
    const ecartBC2 = D.dossiers.find(d => d.semaine === 44 && d.atelier === 'WIS-D2' && d.prepaEnvoyee);
    if (ecartBC2) ecartBC2.qteBCInfo = { bc: ecartBC2.qteBC + 12, circe: ecartBC2.qteBC, date: M.at(42, 1, 8, 40) };

    // ---- Réceptions et affiches
    const recDays = { 42: [M.at(40, 1), M.at(41, 3)], 43: [M.at(41, 0), M.at(42, 1)], 44: [M.at(41, 3), M.at(42, 1)], 45: [M.at(42, 0), M.at(42, 1)] };
    const deliveries = [];
    D.themes.forEach(t => {
      const d = byDossier(t.dossierId);
      if (d.statutPP === 'ANNULE' || t.exclu || d.site === 'NAN' && d.semaine > 43) return;
      if (!d.ipSaisies && d !== sansIP) return;
      const r = R.f();
      let recu = 0, partial = false;
      if (d.semaine === 42) recu = t.qteEnt;
      else if (demoMR.has(d.id)) recu = t.qteEnt;
      else if (d.semaine === 43) {
        if (r < 0.72) recu = t.qteEnt;
        else if (r < 0.83) { recu = Math.round(t.qteEnt * (0.5 + R.f() * 0.4)); partial = true; }
        else if (r < 0.89) recu = Math.round(t.qteEnt * (1.12 + R.f() * 0.12));
        else recu = 0;
      } else if (d.semaine === 44) {
        if (r < 0.48) recu = t.qteEnt; else if (r < 0.6) { recu = Math.round(t.qteEnt * (0.4 + R.f() * 0.4)); partial = true; } else recu = 0;
      } else if (d.semaine === 45) recu = r < 0.18 ? t.qteEnt : 0;
      if (d === sansIP) recu = 46;
      if (d === mistral2) return; // le visuel MISTRAL est reçu une seule fois pour les deux dossiers (cas multi-dossiers)
      if (d === mistral1) recu = t.qteEnt + byDossier(mistral2.id).themes.map(id => D.themes.find(x => x.id === id)).reduce((s, x) => s + x.qteEnt, 0);
      if (!recu) { if (d.print) t.livraisonPrevue = M.at(42, R.i(1, 3), R.i(9, 15)); return; }
      const span = recDays[d.semaine];
      const date = new Date(span[0].getTime() + R.f() * (span[1].getTime() - span[0].getTime()));
      date.setHours(R.i(7, 15), R.pick([0, 10, 20, 30, 40, 50]), 0, 0);
      deliveries.push({ t, d, recu, date: date > M.NOW ? new Date(M.NOW.getTime() - 3600e3 * R.i(1, 3)) : date, partial });
      if (partial && d.print) t.livraisonPrevue = M.at(42, R.i(1, 3), R.i(9, 15));
    });
    deliveries.sort((a, b) => a.date - b.date);
    let curRec = null;
    deliveries.forEach(dv => {
      const imp = dv.d.print ? 'Print Cityz' : R.pick(M.ref.imprimeurs.filter(x => x !== 'Print Cityz'));
      if (!curRec || curRec.site !== dv.d.site || Math.abs(curRec.date - dv.date) > 5 * 3600e3 || curRec.imprimeur !== imp || curRec.affiches.length >= 4) {
        curRec = { id: 'R' + (260400 + (++seqRecep)), site: dv.d.site, date: dv.date, bl: 'BL' + R.i(1000000, 9999999), transporteur: R.pick(M.ref.transporteursEntrants), imprimeur: imp, nbColis: R.i(1, 6), controleur: 'Contrôleur ' + R.pick(['A', 'B', 'C', 'D']), affiches: [], ordre: seqRecep };
        D.receptions.push(curRec);
      }
      const af = {
        id: String(712000 + (++seqAffiche)), receptionId: curRec.id, site: dv.d.site, date: dv.date, statut: 'IDENTIFIEE', qteRecue: dv.recu,
        // Sans IP, l'intitulé est saisi par la plateforme, à sa façon (« BURGER » ici, « Burger » ailleurs : Synthèse, ligne 83)
        alloc: [{ themeId: dv.t.id, qte: dv.recu }], annonceurSaisi: dv.d.annonceur, libelleSaisi: dv.d.ipSaisies ? dv.t.libelle : (dv.t.libelleVisuel || dv.t.libelle).toUpperCase(), format: dv.d.format,
        imprimeur: curRec.imprimeur, allee: R.pick(['A', 'B', 'C', 'D', 'E', 'F']), rayon: String(R.i(1, 12)), rebut: 0, aConserver: false,
        semaines: dv.d.semaines.slice(), controleur: curRec.controleur, multiSemaines: dv.d.semaines.length > 1, historique: [{ date: dv.date, user: curRec.controleur, action: 'Réception ' + curRec.id + ' : ' + dv.recu + ' affiches' }],
      };
      if (dv.d === mistral1) { // visuel commun à deux dossiers : répartition (cas S31)
        const t2 = D.themes.find(x => x.id === mistral2.themes[0]);
        af.alloc = [{ themeId: dv.t.id, qte: dv.t.qteEnt }, { themeId: t2.id, qte: t2.qteEnt }];
        af.annonceurSaisi = 'MISTRAL';
      }
      curRec.affiches.push(af.id);
      D.affiches.push(af);
    });
    // Orphelines (sans dossier identifiable) : candidates = thèmes S44/S45 non reçus
    const orphCands = D.themes.filter(t => { const d = byDossier(t.dossierId); return (d.semaine === 44 || d.semaine === 45) && d.ipSaisies && d.statutPP !== 'ANNULE' && !t.exclu && !D.affiches.some(a => a.alloc.some(x => x.themeId === t.id)); });
    const ORPH = [
      { site: 'WIS', fuzz: s => s.toUpperCase(), lib: l => l.toLowerCase() },
      { site: 'WIS', fuzz: s => s.replace(/s\b/, ''), lib: l => l.split(' ')[0] + '…' },
      { site: 'NIM', fuzz: s => s.split(' ').slice(0, 2).join(' '), lib: l => 'visuel ' + l.toLowerCase() },
      { site: 'WIS', fuzz: () => 'Illisible sur le BL', lib: () => 'affiche bleue, logo en bas à droite' },
    ];
    ORPH.forEach((o, k) => {
      const cand = orphCands.filter(t => byDossier(t.dossierId).site === o.site)[k] || orphCands[k];
      if (!cand) return;
      const d = byDossier(cand.dossierId);
      const date = M.at(42, k < 2 ? 0 : 1, 8 + k, 15);
      const rec = { id: 'R' + (260400 + (++seqRecep)), site: o.site, date, bl: k === 3 ? '—' : 'BL' + R.i(1000000, 9999999), transporteur: R.pick(M.ref.transporteursEntrants), imprimeur: R.pick(M.ref.imprimeurs), nbColis: R.i(1, 3), controleur: 'Contrôleur ' + R.pick(['A', 'B', 'C']), affiches: [], ordre: seqRecep, orpheline: true, statut: 'A_IDENTIFIER' };
      D.receptions.push(rec);
      // Circuit des réceptions inconnues (21/10) : rangée dans l'allée tampon, feuille de stock temporaire
      const af = { id: String(712000 + (++seqAffiche)), receptionId: rec.id, site: o.site, date, statut: 'ORPHELINE', qteRecue: cand.qteEnt || R.i(20, 60), alloc: [], annonceurSaisi: o.fuzz(d.annonceur), libelleSaisi: o.lib(cand.libelle), format: d.format, imprimeur: rec.imprimeur, allee: M.PARAMS.alleeInconnues, rayon: String(k + 1), rebut: 0, aConserver: false, semaines: [], controleur: rec.controleur, verite: cand.id, feuilleImprimee: 'TEMPORAIRE', enAttenteControle: true, historique: [{ date, user: rec.controleur, action: 'Réception inconnue ' + rec.id + ' : affiche orpheline, rangée en ' + M.PARAMS.alleeInconnues + '-' + (k + 1) + ', feuille de stock temporaire' }] };
      rec.affiches.push(af.id);
      D.affiches.push(af);
    });
    // Réceptions attendues anciennes, départs S36 à S39 (REC-05) : purgées automatiquement au bout de 4 semaines, sauf celles
    // des dossiers en conservation à l'année (deux ici). Aucun tirage de plus : le reste du jeu de données ne change pas.
    for (let k = 0; k < 9; k++) D.attenduesAnciennes.push({ id: 'RA-' + (36 + (k % 4)) + '-' + k, site: k % 2 ? 'WIS' : 'NIM', semaine: 36 + (k % 4), dossier: String(880000 + k * 113), annonceur: R.pick(ANNONCEURS), theme: R.pick(THEMES), statut: R.p(0.6) ? 'Partiel' : 'Attendue', reste: R.i(1, 6), conservation: k === 4 || k === 7 });
    M.calc.purgerAttendues(D);

    // ---- 8 m² : demies haut / bas / finales (suivi Nîmes, PROC-06)
    D.themes.forEach(t => { const d = byDossier(t.dossierId); if (d.atelier.endsWith('D8')) t.d8 = { haut: 0, bas: 0, final: 0 }; });

    // ---- Statuts des unités
    M.data = D; M.reindex();
    M.calc.couverture();
    D.unites.forEach(u => {
      const dep = M.calc.depart(u);
      if (u.semaine === 42) { u.statut = R.p(0.85) ? 'LIVRE' : 'EXPEDIE'; return; }
      if (u.semaine >= 45) { u.statut = u.complet ? 'PRET' : 'EN_ATTENTE'; return; }
      if (!u.complet) {
        if (u.kind === 'TRAIN' && u.semaine === 43 && R.p(0.15) && u.positions.some(p => p.couvert)) { u.positions.forEach(p => { if (!p.couvert) p.fr = true; }); u.statut = 'PRET'; u.fractionne = true; }
        else u.statut = 'EN_ATTENTE';
        return;
      }
      if (u.semaine === 44) { u.statut = (u.atelier.endsWith('D8') && R.p(0.4)) ? 'EN_PROD' : 'PRET'; return; }
      const dest = M.calc.dest(u.dest);
      // Un mardi, les trains Vendôme des départs de fin de semaine ne sont souvent pas encore lancés
      const vendome = u.kind === 'TRAIN' && M.calc.machine(u.machine).type === 'vendome';
      const s = R.f() + (dep < M.at(42, 3, 23) ? 0.22 : 0) - (vendome ? 0.25 : 0);
      u.statut = s < 0.28 ? 'PRET' : s < 0.48 ? 'EN_PROD' : s < 0.66 ? 'PRODUIT' : 'COLISE';
      if (u.statut === 'COLISE' && dest.canal === 'MESSAGERIE' && R.p(0.35)) u.statut = 'EXPEDIE';
      if (u.site === 'NAN') u.statut = R.pick(['PRET', 'EN_PROD', 'PRODUIT']);
      if (u.themeId && demoMR.has(D.themes.find(t => t.id === u.themeId).dossierId)) u.statut = 'PRET';
    });
    D.unites.filter(u => ['EN_PROD', 'PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'].includes(u.statut)).forEach(u => { u.bague = true; });
    // 8 m² : avancement des demies
    D.themes.filter(t => t.d8).forEach(t => {
      const us = D.unites.filter(u => u.positions && u.positions.some(p => p.themeId === t.id));
      const fait = M.sum(us.filter(u => ['EN_PROD', 'PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'].includes(u.statut)), u => u.nb);
      const recu = M.calc.recu(t.id);
      t.d8 = { haut: Math.min(recu, fait + R.i(0, 3)), bas: Math.min(recu, fait + R.i(0, 2)), final: fait };
    });

    // ---- Générations de fichiers déjà faites (S43) et libérations de semaine
    const gen = (id, machine, date, user, unites, nbFichiers, note) => {
      const g = { id, machine, site: machine.slice(0, 3), semaine: 43, date, user, unites: unites.map(u => u.id), nbFichiers, statut: 'Envoyé à la machine', version: 1, note: note || '' };
      unites.forEach(u => { u.generation = id; });
      D.generations.push(g);
      return g;
    };
    const prodN = D.unites.filter(u => u.semaine === 43 && u.machine === 'NIM-VEN' && u.statut !== 'EN_ATTENTE' && u.statut !== 'PRET');
    const g1 = gen('G-0412', 'NIM-VEN', M.at(41, 4, 15, 10), "Chef d'équipe Nîmes", prodN, Math.max(1, Math.ceil(prodN.length / 6)));
    const prodW = D.unites.filter(u => u.semaine === 43 && u.machine === 'WIS-VEN' && u.statut !== 'EN_ATTENTE' && u.statut !== 'PRET');
    gen('G-0418', 'WIS-VEN', M.at(42, 0, 14, 0), "Chef d'équipe Wissous", prodW, Math.max(1, Math.ceil(prodW.length / 6)));
    const prodMR = D.unites.filter(u => u.semaine === 43 && u.machine === 'NIM-MR' && u.statut !== 'EN_ATTENTE' && u.statut !== 'PRET');
    gen('G-0415', 'NIM-MR', M.at(42, 0, 8, 20), "Chef d'équipe Nîmes", prodMR, M.uniq(prodMR.map(u => u.themeId)).length);
    D.liberations.push({ site: 'NIM', semaine: 43, atelier: 'NIM-F2', date: M.at(41, 3, 15, 30), user: 'Coordination Nîmes' });
    D.liberations.push({ site: 'WIS', semaine: 43, atelier: 'WIS-F2', date: M.at(41, 3, 16, 5), user: 'Coordination Wissous' });
    D.liberations.push({ site: 'WIS', semaine: 43, atelier: 'WIS-COL', date: M.at(41, 3, 16, 5), user: 'Coordination Wissous' });

    // ---- Événements datés (alertes non calculables) et mails déjà partis
    const dmTrain = prodN.find(u => u.statut === 'EN_PROD') || prodN[0];
    if (dmTrain) {
      const th = D.themes.find(t => t.id === dmTrain.positions[0].themeId);
      dmTrain.modifs.push({ date: M.at(42, 0, 15, 25), user: 'Broadcast', action: 'Dernière minute : +2 trains ajoutés par Broadcast' });
      D.events.push({ key: 'EV-DM-1', type: 'DM_FICHIER', sev: 'critical', site: dmTrain.site, semaine: 43, date: M.at(42, 0, 15, 25), titre: 'Dernière minute sur un fichier déjà envoyé', message: 'Dossier ' + th.dossierId + ' « ' + th.libelle + ' » : +2 trains vers ' + M.calc.dest(dmTrain.dest).label + " après l'envoi du fichier " + g1.id + ' à la Vendôme.', link: { screen: 'trains', params: { q: th.dossierId } }, needs: ['SCR-08', 'CIB-03'], roles: ['cheq', 'coord'] });
      D.outbox.push({ date: M.at(42, 0, 15, 26), to: ["Chefs d'équipe 2 m² déroulant – Nîmes", 'Coordination Nîmes'], subject: '[Circé] Dernière minute sur un fichier Vendôme déjà envoyé (S43)', body: 'Le dossier ' + th.dossierId + ' (' + byDossier(th.dossierId).annonceur + ') a reçu une dernière minute après la génération du fichier ' + g1.id + '.\n\nÀ faire : générer un fichier complémentaire ou raccrocher le thème à un train non produit.\n\nVoir : Production › Trains, filtre ' + th.dossierId + '.', trigger: 'Modification Broadcast sur une unité « En production »', needs: ['SCR-08'], lu: false });
    }
    // Dossier arrivé après la libération de la semaine (REU-04)
    const tard = addDossier('NIM', 43, 'NIM-F2', { annonceur: 'Librairie Papyrus', themes: ['Salon du livre jeunesse'], statutPP: 'PREPA_RECUE' });
    tard.prepaDate = M.at(42, 0, 16, 40); tard.apresLiberation = true;
    tard.historique = [{ date: tard.prepaDate, user: 'Broadcast', action: 'Préparation envoyée après la libération de la S43' }];
    const thT = D.themes.find(t => t.id === tard.themes[0]);
    R.sample(destsOf('NIM'), 2).forEach(dest => { const aff = afficheursOf(dest.id)[0]; const l = addLigne(thT, tard, dest, aff, R.i(4, 12)); l.entretien = M.calc.entretien(l.qte, tard.entretienPct); D.unites.push({ id: 'UM-' + String(++seqUnite).padStart(4, '0'), kind: 'UM', site: 'NIM', semaine: 43, atelier: 'NIM-F2', machine: 'NIM-MR', dest: dest.id, afficheur: aff.id, ligneId: l.id, themeId: thT.id, nb: 1, statut: 'EN_ATTENTE', bague: false, generation: null, modifs: [] }); });
    thT.qte = M.sum(D.lignes.filter(l => l.themeId === thT.id), l => l.qte); thT.qteEnt = thT.qte + M.sum(D.lignes.filter(l => l.themeId === thT.id), l => l.entretien);
    tard.qteBC = thT.qte;
    D.events.push({ key: 'EV-LIB-1', type: 'APRES_LIBERATION', sev: 'serious', site: 'NIM', semaine: 43, date: tard.prepaDate, titre: 'Dossier arrivé après la libération de la semaine', message: 'Dossier ' + tard.id + ' (' + tard.annonceur + ', 2 m² fixe) reçu de Broadcast le ' + M.fmt.dt(tard.prepaDate) + ', après la libération de la S43 du ' + M.fmt.dt(D.liberations[0].date) + '. Mail envoyé.', link: { screen: 'unitaire', params: { type: 'fixe', atelier: 'NIM-F2', q: tard.id } }, needs: ['REU-04', 'FIX-07'], roles: ['cheq', 'coord'] });
    D.outbox.push({ date: M.at(42, 0, 16, 41), to: ["Chefs d'équipe 2 m² fixe – Nîmes", 'Coordination Nîmes'], subject: '[Circé] Nouveau dossier 2 m² fixe S43 après libération : ' + tard.id, body: 'Bonjour,\n\nLe dossier ' + tard.id + ' (' + tard.annonceur + ', thème « ' + thT.libelle + ' », ' + thT.qteEnt + ' affiches entretien compris) est arrivé de Broadcast après la libération de la semaine 43 pour le 2 m² fixe de Nîmes.\n\nIl apparaît dans Production › Fixe & pliage avec le repère « Arrivé après libération ». Ses affiches ne sont pas encore reçues.\n\nCe mail remplace le mail manuel de la Pré-Prod (S15, S70 Réception #6).', trigger: 'Préparation Broadcast reçue après la libération de la semaine', needs: ['REU-04', 'FIX-07'], lu: false });
    D.outbox.push({ date: M.at(42, 1, 7, 0), to: ["Chefs d'équipe Nîmes et Wissous", 'Coordination'], subject: '[Circé] Point du matin : manquants et départs à risque (S43)', body: "Synthèse automatique de 7h00 : nombre de visuels manquants, départs camions à risque et réceptions orphelines. Le détail est dans Pilotage › Suivi de prod et Alertes.\n\nCe digest optionnel remplace le fichier des manquants du vendredi S-2 et ses mises à jour du lundi S-1, J-3 et lundi S (S33).", trigger: 'Planifié chaque jour ouvré à 7h00 (paramétrable)', needs: ['PP-03', 'PP-07'], lu: false });

    // ---- Colis et expédition
    const grp = M.groupBy(D.unites.filter(u => ['COLISE', 'EXPEDIE', 'LIVRE'].includes(u.statut)), u => [u.site, u.semaine, u.dest, u.statut].join('|'));
    Object.values(grp).forEach(us => {
      const max = us[0].kind === 'TRAIN' ? 8 : 12;
      for (let i = 0; i < us.length; i += max) {
        const part = us.slice(i, i + max);
        const u0 = part[0];
        const dest = M.calc.dest(u0.dest);
        const c = { id: 'C-0000000000063' + String(4100 + (++seqColis)), site: u0.site, semaine: u0.semaine, dest: u0.dest, canal: dest.canal, unites: part.map(u => u.id), statut: u0.statut === 'COLISE' ? 'COLIS_CLOS' : u0.statut, clos: M.at(u0.semaine - 1, R.i(0, 1), R.i(8, 17), R.i(0, 59)), recepisse: null, expedie: null, livre: null };
        if (c.clos > M.NOW) c.clos = new Date(M.NOW.getTime() - R.i(1, 20) * 3600e3);
        if (u0.statut === 'EXPEDIE' || u0.statut === 'LIVRE') { c.recepisse = String(90500000 + R.i(1000, 99999)); c.expedie = M.calc.depart(u0); if (c.expedie > M.NOW) c.expedie = M.at(42, 0, 16, 45); }
        if (u0.statut === 'LIVRE') c.livre = new Date(c.expedie.getTime() + R.i(14, 30) * 3600e3);
        part.forEach(u => { u.colis = c.id; });
        D.colis.push(c);
      }
    });

    // ---- Mouvements de stock : entrées à la réception, sorties automatiques à l'expédition (REU-08)
    D.affiches.forEach(a => D.mouvements.push({ id: M.uid('MV'), date: a.date, afficheId: a.id, type: 'Réception', qte: a.qteRecue, user: a.controleur, auto: false }));
    D.colis.filter(c => c.expedie).forEach(c => M.calc.sortiesExpedition(c, true));
    // Quelques rebuts et reliquats d'entretien à conserver (S42)
    D.affiches.filter(a => byDossier((M.calc.theme(a.alloc[0] && a.alloc[0].themeId) || {}).dossierId || '') && a.alloc.length).slice(0, 60).forEach((a, k) => {
      if (k % 9 === 0) { a.rebut = R.i(1, 3); D.mouvements.push({ id: M.uid('MV'), date: new Date(a.date.getTime() + 3600e3 * 20), afficheId: a.id, type: 'Mise au rebut', qte: -a.rebut, user: 'Contrôleur A', auto: false, motif: 'Affiche déchirée' }); }
    });
    D.affiches.filter(a => M.calc.dossierOfAffiche(a) && M.calc.dossierOfAffiche(a).semaine === 42).forEach(a => { if (M.calc.stockDispo(a) > 0) a.aConserver = true; });

    // ---- Journal (traçabilité de ce qui a été lancé, modifié, ajouté : CIB-03)
    D.generations.forEach(g => D.journal.push({ date: g.date, user: g.user, objet: g.id, action: 'Génération de ' + g.nbFichiers + ' fichier(s) pour ' + M.calc.machine(g.machine).label }));
    D.liberations.forEach(l => D.journal.push({ date: l.date, user: l.user, objet: l.atelier + ' S' + l.semaine, action: 'Libération de la semaine vers l’atelier' }));
    D.events.forEach(e => D.journal.push({ date: e.date, user: 'Circé', objet: e.key, action: e.titre }));

    // ---- Thèmes proches sur plusieurs dossiers (vérification des thèmes, PP-08). Créés en dernier : l'aléa des données
    // ci-dessus ne bouge pas. Préparation reçue en S44, aucune affiche encore reçue.
    D.verifThemes = {}; D.demandesThemes = {};
    const demoTheme = (site, atId, annonceur, libelle, statutPP) => {
      const d = addDossier(site, 44, atId, { annonceur, themes: [libelle], statutPP });
      const th = D.themes.find(t => t.id === d.themes[0]);
      R.sample(destsOf(site), 2).forEach(dest => {
        const aff = afficheursOf(dest.id)[0];
        const l = addLigne(th, d, dest, aff, atId === 'WIS-COL' ? R.i(2, 12) : R.i(4, 18));
        l.entretien = M.calc.entretien(l.qte, d.entretienPct);
        const at = atelier(atId);
        D.unites.push({ id: (at.type === 'fixe' ? 'UM-' : 'PL-') + String(++seqUnite).padStart(4, '0'), kind: at.type === 'fixe' ? 'UM' : 'LOT', site, semaine: 44, atelier: atId, machine: at.machines[0] || null, dest: dest.id, afficheur: aff.id, ligneId: l.id, themeId: th.id, nb: 1, statut: 'EN_ATTENTE', bague: false, generation: null, modifs: [] });
      });
      const ls = D.lignes.filter(l => l.themeId === th.id);
      th.qte = M.sum(ls, l => l.qte); th.qteEnt = th.qte + M.sum(ls, l => l.entretien); d.qteBC = th.qte;
      return d;
    };
    demoTheme('NIM', 'NIM-F2', 'Brasserie du Port', 'Menu burger', 'PREPA_RECUE');
    demoTheme('WIS', 'WIS-F2', 'Brasserie du Port', 'MENU BURGERS', 'PREPA_RECUE');
    demoTheme('WIS', 'WIS-COL', 'Brasserie du Port', 'Menu burger !', 'VALIDE');
    demoTheme('WIS', 'WIS-F2', 'Électro Max', 'Black Friday', 'PREPA_RECUE');
    demoTheme('NIM', 'NIM-F2', 'Électro Max', 'BLACK FRIDAY -30 %', 'PREPA_RECUE');
    // Thème changé dans Broadcast après Instruction OK et validation admin (PP-09) : Broadcast a le nouvel intitulé, Circé
    // garde l'ancien. Un train en production (S43) et un dossier fixe pas encore produit (S44). Sans aléa.
    const PROD = ['EN_PROD', 'PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'];
    const lance = d => D.unites.some(u => PROD.includes(u.statut) && (u.themeId ? d.themes.includes(u.themeId) : (u.positions || []).some(p => d.themes.includes(p.themeId))));
    [D.dossiers.find(d => d.statutPP === 'VALIDE' && d.semaine === 43 && d.atelier === 'NIM-D2' && lance(d)),
      D.dossiers.find(d => d.statutPP === 'VALIDE' && d.semaine === 44 && /F2$/.test(d.atelier) && !lance(d))]
      .filter(Boolean).forEach((d, k) => {
        const th = D.themes.find(t => t.id === d.themes[0]);
        th.libelleBC = th.libelle + ' V2';
        th.modifBC = { date: M.at(42, 1, 8 + k, 20), ancien: th.libelle };
      });

    // Fin de campagne (REC-24) : quelques décisions déjà prises sur les dossiers de S42 encore en stock. Sans aléa.
    D.finCampagne = {};
    const enStock = d => D.affiches.some(a => a.alloc.length && (D.themes.find(t => t.id === a.alloc[0].themeId) || {}).dossierId === d.id && M.sum(D.mouvements.filter(m => m.afficheId === a.id), m => m.qte) > 0);
    const s42 = D.dossiers.filter(d => d.semaine === 42 && Math.max(...d.semaines) === 42 && enStock(d));
    const bdx = d => D.lignes.some(l => l.dossierId === d.id && l.dest === 'BOR');
    const simples = s42.filter(d => d.format !== 'Scrolling MUI' && !bdx(d));
    if (simples[0]) D.finCampagne[simples[0].id] = { decision: 'DETRUIRE', date: M.at(42, 0, 9, 10), user: 'Réception Nîmes' };
    if (simples[1]) D.finCampagne[simples[1].id] = { decision: 'ENVOYER', destinataire: 'Client ou agence', date: M.at(42, 0, 9, 20), user: 'Réception Nîmes' };
    const mui = s42.find(d => d.format === 'Scrolling MUI');
    if (mui) D.finCampagne[mui.id] = { decision: 'CONSERVER', jusqua: 52, motif: 'Ville de Paris (MUI)', date: M.at(42, 0, 10, 0), user: 'Réception Wissous' };
    // Visuel commun à deux campagnes (RP32 #4, S31) : une affiche de S42 encore en stock sert aussi une campagne de S44 du
    // même annonceur, sous le même thème (DA activée, IP saisies, préparation pas encore envoyée) ; sa destruction n'est
    // donc pas proposée. Créé en dernier, sur le dernier dossier de S42 encore à décider.
    const libres = s42.filter(d => !D.finCampagne[d.id]);
    const reuse = libres[libres.length - 1];
    const enStockA = a => M.sum(D.mouvements.filter(m => m.afficheId === a.id), m => m.qte);
    const aReuse = reuse && D.affiches.find(x => x.alloc.length && (D.themes.find(t => t.id === x.alloc[0].themeId) || {}).dossierId === reuse.id && enStockA(x) > 0);
    if (aReuse) {
      const t0 = D.themes.find(t => t.id === aReuse.alloc[0].themeId);
      const d2 = addDossier(reuse.site, 44, reuse.atelier, { annonceur: reuse.annonceur, themes: [t0.libelle], statutPP: 'A_TRAITER', ipSaisies: true, format: reuse.format });
      const t2 = D.themes.find(t => t.id === d2.themes[0]);
      t2.qte = 30; t2.qteEnt = 30 + Math.ceil(30 * d2.entretienPct / 100); d2.qteBC = t2.qte;
      aReuse.alloc.push({ themeId: t2.id, qte: Math.min(enStockA(aReuse), t2.qteEnt) });
      d2.historique.push({ date: M.at(42, 0, 11, 0), user: 'Coordination', action: 'Affiche ' + aReuse.id + ' (stock de la S42) rattachée : même visuel' });
    }

    // Annonceur saisi sous deux noms (16/10) : « BRASSERIE PORT » pour un dossier de la « Brasserie du Port », avec un thème
    // « Menu Burger » ; la vérification signale les deux noms, et compare leurs thèmes. Créé après les cas ci-dessus.
    D.verifAnnonceurs = {}; D.demandesAnnonceurs = {};
    demoTheme('NIM', 'NIM-F2', 'BRASSERIE PORT', 'Menu Burger', 'PREPA_RECUE');

    // Commentaire de préparation (RP31, RP33 #3) : vide le plus souvent, il porte les exceptions. Sans commentaire (et avec
    // un nombre d'exceptions égal à la quantité, C.instrOK), l'Instruction OK d'un dossier déroulant est automatique. Sans aléa : un tiers des préparations reçues à valider, un
    // dossier validé sur cinq.
    const COMMENTAIRES = ['Visuel B en tête de train, à la demande du client', 'Répartition par afficheur différente de Broadcast : voir la pièce jointe', 'Entretien de 15 % demandé par le client', 'Ne pas mettre ce visuel dans le même train que la campagne concurrente'];
    D.dossiers.filter(d => atelier(d.atelier).mode === 'train' && d.prepaEnvoyee).forEach((d, k) => { d.commentPrepa = (d.statutPP === 'PREPA_RECUE' ? k % 3 === 0 : k % 5 === 1) ? COMMENTAIRES[k % COMMENTAIRES.length] : ''; });
    D.dossiers.forEach(d => { if (d.commentPrepa === undefined) d.commentPrepa = ''; });
    // Thème « reste en place » repris de Broadcast sur un dossier 2 m² fixe (FIX-14, A17) : il sort automatiquement de la
    // préparation. Sans aléa : premier dossier fixe de S44 à plusieurs thèmes dont un, après le premier, n'a reçu aucune affiche.
    const sansAffiche = id => !D.affiches.some(a => a.alloc.some(x => x.themeId === id));
    const fixeRP = D.dossiers.find(d => d.semaine === 44 && /F2$/.test(d.atelier) && d.prepaEnvoyee && d.themes.slice(1).some(sansAffiche));
    if (fixeRP) {
      const t = D.themes.find(x => x.id === fixeRP.themes.slice(1).find(sansAffiche));
      t.exclu = 'RESTE_EN_PLACE';
      fixeRP.historique.push({ date: fixeRP.prepaDate || M.at(42, 0, 9), user: 'Broadcast', action: 'IP : « ' + t.libelle + ' » reste en place' });
    }

    // ---- Réception en deux temps (19/10) : 1. arrivée de la palette (BL, rattachement, n° d'affiche) ; 2. contrôle (comptage,
    // allée / rayon, feuilles de stock). Chaque réception garde ses lignes de BL. La dernière réception identifiée de chaque
    // plateforme est arrivée mais pas encore contrôlée : palette en zone tampon (Z-tampon), à compter et à ranger.
    // Aucun tirage aléatoire de plus : le reste du jeu de données ne change pas.
    D.receptions.forEach(rec => {
      // Réception inconnue pas encore rattachée (21/10) : « à identifier », contrôlée seulement après le rattachement
      rec.statut = rec.orpheline && rec.affiches.some(id => (D.affiches.find(x => x.id === id) || {}).statut === 'ORPHELINE') ? 'A_IDENTIFIER' : 'CONTROLEE';
      rec.lignes = rec.affiches.map(id => { const a = D.affiches.find(x => x.id === id); return { afficheId: id, qte: a ? a.qteRecue : 0 }; });
    });
    ['NIM', 'WIS'].forEach(site => {
      const rec = D.receptions.filter(r => r.site === site && !r.orpheline).sort((a, b) => b.date - a.date)[0];
      if (!rec) return;
      rec.statut = 'A_CONTROLER'; rec.dechargePar = rec.controleur; rec.controleur = null; rec.photoBL = true;
      rec.affiches.map(id => D.affiches.find(x => x.id === id)).filter(Boolean).forEach(a => {
        a.qteBL = a.qteRecue; a.allee = 'Z'; a.rayon = 'tampon'; a.enAttenteControle = true; a.controleur = null;
        a.historique = [{ date: a.date, user: rec.dechargePar, action: 'Arrivée ' + rec.id + ' : ' + a.qteRecue + ' affiches (quantité du BL), palette à contrôler' }];
      });
    });
    // Deux feuilles de stock à refaire (REC-06) : intitulé harmonisé après l'identification, une affiche par plateforme
    ['NIM', 'WIS'].forEach(site => {
      const a = D.affiches.find(x => x.site === site && x.statut === 'IDENTIFIEE' && x.alloc.length === 1 && x.allee !== 'Z' && !x.enAttenteControle);
      if (!a) return;
      const t = D.themes.find(x => x.id === a.alloc[0].themeId);
      a.themeModif = { ancien: t.libelle.toUpperCase(), nouveau: t.libelle, date: M.at(42, 1, 14, 30), par: 'Coordination', origine: 'Intitulé harmonisé après l’identification', reimprime: false };
    });
    // ---- Validation admin (option A, 02/11), sans aléa : le reste du jeu de données ne change pas. À la réception, Circé propose le
    // rattachement : la plupart des affiches par le n° de dossier lu sur le BL, une sur sept par le visuel reconnu (doute : n° du
    // BL non vérifié). Sur les dossiers déjà validés (statut hérité du jeu de données), la Coordination a confirmé les affiches reçues
    // depuis plus de 36 h, y compris celles à doute, sauf le visuel MISTRAL commun à deux dossiers, reçu une fois (répartition à
    // confirmer) ; les plus récentes attendent leur confirmation. Pour le reste, une affiche sûre sur quatre est déjà confirmée, que la
    // préparation soit reçue ou non (la validation n’attend pas la prépa, 02/11) ; les autres sont proposées, à confirmer. Leur Instruction OK reste indépendante.
    M.reindex();
    D.affiches.filter(a => a.statut === 'IDENTIFIEE').forEach((a, k) => { a.rattache = k % 7 === 3 ? 'VISUEL' : 'BL'; });
    const confirmee = (a, k, motifs) => {
      const date = new Date(Math.min(a.date.getTime() + (2 + k % 9) * 3600e3, M.NOW.getTime() - 20 * 60e3));
      a.va = { etat: 'MANUELLE', user: 'Coordination ' + C.site(a.site).label, date, motifs };
      a.historique.push({ date, user: a.va.user, action: 'Validation admin confirmée' + (motifs.length ? ' après vérification : ' + motifs.map(m => M.VA_MOTIFS[m]).join(' ; ') : ' : rattachement proposé par Circé, sans doute') });
    };
    D.affiches.filter(a => a.statut === 'IDENTIFIEE').forEach((a, k) => {
      const ms = C.vaMotifs(a), ds = C.dossiersOfAffiche(a).map(C.dossier).filter(Boolean);
      if (!ds.length) return;
      a.historique.push({ date: new Date(a.date.getTime() + 60e3), user: 'Circé', action: 'Rattachement proposé : ' + ds.map(d => 'dossier ' + d.id).join(', ') + ' · ' + a.alloc.map(x => '« ' + C.theme(x.themeId).libelle + ' »').join(', ') + ' (' + (a.rattache === 'VISUEL' ? 'visuel reconnu' : 'n° de dossier lu sur le BL') + ') : à confirmer par la Coordination' });
      if (ds.every(d => d.statutPP === 'VALIDE') && !ms.includes('MULTI') && M.NOW - a.date >= 36 * 3600e3) confirmee(a, k, ms);
      // Les affiches sûres reçues avant la prépa sont déjà validées : on voit qu'elle n'attend pas l'envoi de la prépa (02/11)
      else if (!ms.length && (k % 4 === 0 || ds.every(d => d.statutPP === 'A_TRAITER'))) confirmee(a, k, ms);
    });
    D.dossiers.filter(d => d.statutPP === 'VALIDE' && atelier(d.atelier).mode === 'train' && C.instrOKMotifs(d).length && !d.iok).forEach(d => { d.iok = { date: d.prepaDate || M.at(42, 1, 15), user: 'Coordination' }; });
    D.dossiers.filter(d => d.statutPP === 'PREPA_RECUE' || d.statutPP === 'VALIDE').forEach(d => C.majStatutVA(d, d.prepaDate || M.at(42, 0, 9)));
    return D;
  }

  /* ======================================================================
     Index et calculs
     ====================================================================== */
  M.reindex = function () {
    const D = M.data;
    D.idx = {
      dossier: new Map(D.dossiers.map(x => [x.id, x])),
      theme: new Map(D.themes.map(x => [x.id, x])),
      affiche: new Map(D.affiches.map(x => [x.id, x])),
      unite: new Map(D.unites.map(x => [x.id, x])),
      ligne: new Map(D.lignes.map(x => [x.id, x])),
      colis: new Map(D.colis.map(x => [x.id, x])),
    };
    D.recuParTheme = new Map();
    D.affiches.forEach(a => a.alloc.forEach(x => D.recuParTheme.set(x.themeId, (D.recuParTheme.get(x.themeId) || 0) + x.qte)));
  };

  const C = M.calc = {};
  C.dossier = id => M.data.idx.dossier.get(id);
  C.theme = id => M.data.idx.theme.get(id);
  C.unite = id => M.data.idx.unite.get(id);
  C.ligne = id => M.data.idx.ligne.get(id);
  C.dest = id => M.ref.destinataires.find(x => x.id === id);
  C.atelier = id => M.ref.ateliers.find(x => x.id === id);
  C.machine = id => M.ref.machines.find(x => x.id === id);
  C.site = id => M.ref.sites.find(x => x.id === id);
  C.afficheur = id => M.data.afficheurs.find(x => x.id === id);
  C.recu = themeId => M.data.recuParTheme.get(themeId) || 0;
  C.reste = t => Math.max(0, t.qteEnt - C.recu(t.id));
  /** Entretien à l'afficheur : rien sous le seuil, sinon pourcentage arrondi au supérieur. */
  C.entretien = (qte, pct) => qte < M.PARAMS.entretien.seuil ? 0 : Math.max(1, Math.ceil(qte * pct / 100));
  /** Entretien « existant » calculé par annonceur / thème / ville, réparti ensuite (comparaison REU-06). */
  C.entretienVille = (lignes, pct) => Math.round(M.sum(lignes, l => l.qte) * pct / 100);
  C.depart = u => { const dest = C.dest(u.dest); return M.at(u.semaine - 1, dest.jour, dest.hh, dest.mm); };
  C.themesOf = u => u.kind === 'TRAIN' ? u.positions.map(p => C.theme(p.themeId)) : [C.theme(u.themeId)];
  C.dossierOfAffiche = a => a.alloc.length ? C.dossier((C.theme(a.alloc[0].themeId) || {}).dossierId) : null;
  /** N° des dossiers d'une unité, d'une affiche ou d'un colis (filtre « N° de dossier »). */
  C.dossiersOf = u => M.uniq(C.themesOf(u).filter(Boolean).map(t => t.dossierId));
  C.dossiersOfAffiche = a => M.uniq(a.alloc.map(x => (C.theme(x.themeId) || {}).dossierId).filter(Boolean));
  C.dossiersOfColis = c => M.uniq(c.unites.map(C.unite).filter(Boolean).flatMap(C.dossiersOf));
  C.etatTheme = t => {
    const r = C.recu(t.id);
    if (!t.qteEnt) return r ? 'SANS_ATTENDU' : 'NON_ATTENDU';
    if (r === 0) return 'MANQUANT';
    if (r < t.qteEnt) return 'PARTIEL';
    if (r > t.qteEnt * (1 + M.PARAMS.ecartReception)) return 'SURPLUS';
    return 'COMPLET';
  };
  C.besoinUnite = (u, themeId) => {
    if (u.kind === 'TRAIN') return u.nb;
    const l = C.ligne(u.ligneId);
    return l.qte + l.entretien;
  };

  /**
   * Couverture des besoins par les affiches reçues : chaque thème sert d'abord
   * les unités dont le départ camion est le plus proche.
   */
  C.couverture = function () {
    const D = M.data;
    const consumers = new Map();
    D.unites.forEach(u => {
      const ths = u.kind === 'TRAIN' ? u.positions.map(p => p.themeId) : [u.themeId];
      ths.forEach(id => { if (!consumers.has(id)) consumers.set(id, []); consumers.get(id).push(u); });
    });
    consumers.forEach((us, themeId) => {
      let dispo = C.recu(themeId);
      us.slice().sort((a, b) => C.depart(a) - C.depart(b)).forEach(u => {
        const need = C.besoinUnite(u, themeId);
        const ok = dispo >= need;
        if (ok) dispo -= need;
        if (u.kind === 'TRAIN') { const p = u.positions.find(x => x.themeId === themeId); p.couvert = ok; } else u.couvert = ok;
      });
    });
    D.unites.forEach(u => { u.complet = u.kind === 'TRAIN' ? u.positions.every(p => p.couvert || p.fr) : !!u.couvert; });
  };
  /** Après une réception ou une modification : les unités complètes passent « Prêt », les autres reviennent « En attente ». */
  C.recalculer = function () {
    M.reindex();
    C.couverture();
    M.data.unites.forEach(u => {
      if (u.statut === 'EN_ATTENTE' && u.complet) { u.statut = 'PRET'; u.auto = 'Affiches reçues'; }
      else if (u.statut === 'PRET' && !u.complet) u.statut = 'EN_ATTENTE';
    });
  };

  /* ---------- Base unique (21/10) : « une base, des vues » ----------
     Une ligne au grain le plus fin du dossier : dossier × (format) × thème × destinataire × afficheur × unité (face d'un
     train, UM ou lot). Le grain s'affine avec le process : avant les IP, la DA seule (dossier × type de réalisation ×
     plateforme, sans thème, 21/10) ; après les IP et avant la préparation, le thème (destinataire et unité vides).
     Un dossier livré sur deux plateformes garde un seul n° (d.no). Le train, le colis et le départ sont des attributs de la ligne : ils regroupent des lignes de
     plusieurs dossiers. Le reçu reste au thème (affiches en stock, liées N à N) ; la part « couverte » de chaque ligne
     suit la règle de couverture (le départ le plus proche d'abord, C.couverture). Toutes les quantités sont en affiches. */
  /** Où en est une ligne : la première étape pas encore faite, de la DA activée à la livraison. Ordre de l’option A (02/11) :
      la validation admin suit la réception des affiches (Circé propose le rattachement, la Coordination confirme) et ne
      dépend plus de la préparation : DA, IP, préparation, affiches, validation admin, production, expédition. Une unité déjà
      lancée suit la production : la validation admin ne bloque pas la libération (comme dans Circé). `conf` : thèmes et
      dossiers qui ont des affiches à confirmer (C.vaAConfirmer), calculés une fois par C.base. */
  C.ouLigne = (d, t, u, conf) => {
    if (d.statutPP === 'ANNULE') return 'ANNULE';
    if (d.statutPP !== 'PREPA_RECUE' && d.statutPP !== 'VALIDE') return d.ipSaisies ? 'IP' : 'DA';
    const e = t ? C.etatTheme(t) : 'MANQUANT';
    const aConfirmer = conf ? (t ? conf.th.has(t.id) : conf.ds.has(d.id)) : C.vaDossier(d).aFaire.some(a => !t || a.alloc.some(x => x.themeId === t.id));
    if (!u) return e === 'MANQUANT' ? 'AFFICHES' : e === 'PARTIEL' ? 'PARTIEL' : aConfirmer ? 'PREPA' : 'PROD';
    if (u.statut === 'EN_ATTENTE') return e === 'MANQUANT' ? 'AFFICHES' : 'PARTIEL';
    if (u.statut === 'PRET') return aConfirmer ? 'PREPA' : 'PROD';
    if (u.statut === 'EN_PROD') return 'PROD';
    if (u.statut === 'PRODUIT' || u.statut === 'COLISE') return 'PRODUIT';
    return u.statut === 'EXPEDIE' ? 'EXPEDIE' : 'LIVRE';
  };
  C.base = function () {
    const D = M.data, out = [];
    const lignesDe = M.groupBy(D.lignes, l => l.themeId);
    const umDe = new Map(), trainsDe = new Map();
    D.unites.forEach(u => {
      if (u.kind === 'TRAIN') u.positions.forEach(p => { const k = p.themeId + '|' + u.afficheur; if (!trainsDe.has(k)) trainsDe.set(k, []); trainsDe.get(k).push(u); });
      else umDe.set(u.ligneId, u);
    });
    const colisDe = new Map(D.colis.map(c => [c.id, c]));
    const aConf = C.vaAConfirmer();
    // t est vide pour une ligne de DA (avant les IP) : son « visuel » est alors type de réalisation × plateforme
    const ligne = (t, d, l, u, qte, entretien, da) => {
      const p = u && u.kind === 'TRAIN' ? u.positions.find(x => x.themeId === t.id) : null;
      const besoin = qte + entretien;
      const etape = u ? M.ETAPE[u.statut] : null;
      const c = u && u.colis ? colisDe.get(u.colis) : null;
      return {
        id: 'F' + out.length, t, d, l, u, c, da: da || null,
        // n° de dossier Broadcast : la part d'une 2e plateforme garde le n° du dossier (d.no)
        dossier: d.no || d.id, site: d.site, typeReal: d.typeReal, format: d.format, atelier: d.atelier,
        theme: t ? t.id : 'DA|' + d.id + '|' + da.typeReal + '|' + da.site,
        recuDA: t ? null : M.sum(d.themes, id => C.recu(id)),
        dest: l ? l.dest : null, aff: l ? l.afficheur : null, unite: u ? u.id : null, colis: c ? c.id : null,
        depart: u ? C.depart(u) : null, departKey: u ? u.dest + '|' + u.semaine : null,
        qte, entretien, besoin,
        couvert: u && (p ? p.couvert || p.fr : u.couvert) ? besoin : 0,
        fait: etape === 'colise' || etape === 'expedie' ? besoin : 0,
        expedie: u && (u.statut === 'EXPEDIE' || u.statut === 'LIVRE') ? besoin : 0,
        livre: u && u.statut === 'LIVRE' ? besoin : 0,
        ou: C.ouLigne(d, t, u, aConf),
      };
    };
    // Avant les IP : la DA seule, une ligne par type de réalisation × plateforme, sans thème (21/10)
    const avantIP = new Set();
    D.dossiers.forEach(d => {
      if (d.ipSaisies || !M.inScope(d, { allWeeks: true })) return;
      avantIP.add(d.id);
      (d.daLignes || []).forEach(da => out.push(ligne(null, d, null, null, da.faces, Math.max(0, da.affiches - da.faces), da)));
    });
    D.themes.forEach(t => {
      const d = C.dossier(t.dossierId);
      if (!d || !M.inScope(d, { allWeeks: true }) || avantIP.has(d.id)) return;
      const ls = lignesDe[t.id] || [];
      // Pas encore de préparation (ou thème exclu des trains) : une ligne au grain du thème, quantité de Broadcast
      if (!ls.length) { out.push(ligne(t, d, null, null, t.qte, Math.max(0, t.qteEnt - t.qte))); return; }
      ls.forEach(l => {
        const us = C.atelier(l.atelier).mode === 'train' ? (trainsDe.get(t.id + '|' + l.afficheur) || []) : [umDe.get(l.id)].filter(Boolean);
        if (!us.length) { out.push(ligne(t, d, l, null, l.qte, l.entretien)); return; }
        // Train : une ligne par train (nb faces du thème) ; l'entretien de l'afficheur va sur la première
        us.forEach((u, i) => out.push(ligne(t, d, l, u, u.kind === 'TRAIN' ? u.nb : l.qte, i === 0 ? l.entretien : 0)));
      });
    });
    return out;
  };

  /* ---------- Stock ---------- */
  C.mouvementsAffiche = id => M.data.mouvements.filter(m => m.afficheId === id);
  C.stockDispo = a => M.sum(C.mouvementsAffiche(a.id), m => m.qte);
  C.sortiesExpedition = function (colis, silent) {
    const D = M.data;
    const besoins = new Map();
    colis.unites.map(C.unite).forEach(u => C.themesOf(u).forEach(t => besoins.set(t.id, (besoins.get(t.id) || 0) + C.besoinUnite(u, t.id))));
    besoins.forEach((q, themeId) => {
      let reste = q;
      D.affiches.filter(a => a.alloc.some(x => x.themeId === themeId)).forEach(a => {
        if (reste <= 0) return;
        const dispo = C.stockDispo(a);
        const take = Math.min(dispo, reste);
        if (take > 0) { D.mouvements.push({ id: M.uid('MV'), date: colis.expedie || M.NOW, afficheId: a.id, type: 'Expédition ' + colis.id, qte: -take, user: 'Circé (automatique)', auto: true }); reste -= take; }
      });
    });
    if (!silent) D.journal.push({ date: M.NOW, user: 'Circé', objet: colis.id, action: 'Sortie de stock automatique à l’expédition' });
  };

  /* ---------- Périmètres (filtres de la barre du haut) ---------- */
  C.dossiersScope = (o) => M.data.dossiers.filter(d => M.inScope(d, o));
  C.themesScope = (o) => M.data.themes.filter(t => { const d = C.dossier(t.dossierId); return d && M.inScope(d, o) && d.statutPP !== 'ANNULE' && !t.exclu; });
  // Les unités d'un thème « ne pas afficher » ou « reste en place » (IP de Broadcast) sortent d'elles-mêmes (SCR-02, FIX-14)
  C.unitesScope = (o) => M.data.unites.filter(u => M.inScope(u, o) && !(u.themeId && (C.theme(u.themeId) || {}).exclu));
  /** Ce qui empêche l'Instruction OK automatique d'un dossier déroulant (règle précisée par l'utilisatrice le 26/10) : un
      commentaire de prépa, ou un nombre d'exceptions différent de la quantité (ANO-06 ; dans Circé, l'en-tête « Nombre
      d'exceptions » comparé à la quantité des lignes de format, hors entretien). Un écart peut venir d'un « reste en place »
      ou d'une erreur. Dans ces deux cas, la Coordination fait l'Instruction OK à la main (26/10). La répartition à 100 %
      n'est pas modélisée : la maquette reprend les quantités par thème de Broadcast (SCR-03). */
  C.instrOKMotifs = d => [d.commentPrepa ? 'commentaire' : null, d.qteBCInfo ? 'ecart' : null].filter(Boolean);
  /** Instruction OK d'un dossier (RP31, SCR-11) : sans objet hors déroulant ; automatique quand la préparation arrive
      sans commentaire, avec les quantités et exceptions de Broadcast (répartition, entretien et campagne contrôlée repris de
      Broadcast) ; sinon à faire après contrôle. */
  C.instrOK = d => {
    if (C.atelier(d.atelier).mode !== 'train' || d.statutPP === 'ANNULE') return 'SANS_OBJET';
    if (d.statutPP !== 'PREPA_RECUE' && d.statutPP !== 'VALIDE') return 'ATTENTE';
    if (d.iok) return 'MANUEL';
    // Indépendante de la validation admin (27/10, option A le 02/11) : un dossier peut avoir sa validation admin faite et rester « En cours »
    return C.instrOKMotifs(d).length ? 'A_FAIRE' : 'AUTO';
  };

  /* ---------- Validation admin (26-27/10 ; option A le 02/11) ----------
     Gardée sous son nom de Circé (case `affiche.validationAdmin`), avec son bouton. AUCUNE VALIDATION SANS UNE PERSONNE : à la
     réception, Circé PROPOSE seul le rattachement de l’affiche à la ligne attendue du dossier (en cible, la ligne de l’état des
     réservations, avec son thème dès les IP) ; la Coordination CONFIRME, par liste et en lot, les cas sûrs étant pré-cochés ;
     les cas à doute se traitent affiche par affiche. Elle ne dépend ni de l’envoi de la préparation ni de l’Instruction OK :
     le déclencheur est la réception physique (aujourd’hui elle passe par les lignes de prépa : au fixe la prépa envoyée, au
     scro l’Instruction OK, retour terrain du 02/11). La prépa n’est plus le feu vert : elle confirme, et Circé ne signale qu’un
     écart. La quantité n’est pas une condition : une réception partielle est validée pour ce qu’elle contient, le manque reste
     un état de la ligne. */
  M.VA_MOTIFS = {
    BL: 'rattachée sans le n° de dossier du BL (par le visuel ou à la main)',
    FORMAT: 'format de l’affiche différent de celui du dossier',
    THEME: 'plusieurs thèmes possibles dans ce format : visuel à confirmer',
    MULTI: 'même visuel pour plusieurs dossiers : répartition à confirmer',
    SANS_IP: 'IP pas encore saisies dans Broadcast : thème provisoire',
    ANNULEE: 'validation annulée : à refaire',
  };
  const normTxt = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  /** Ce qui empêche de pré-cocher le rattachement proposé d’une affiche (clés de M.VA_MOTIFS). Rattachement : « BL »
      (n° de dossier lu sur le BL, par la photo du BL ou la recherche), « VISUEL » (visuel reconnu, ou ligne de BL sans
      contrat lisible), « MAIN » (choisi à la main par la réception). */
  C.vaMotifs = a => {
    const ts = a.alloc.map(x => C.theme(x.themeId)).filter(Boolean);
    const ds = M.uniq(ts.map(t => t.dossierId)).map(C.dossier).filter(Boolean);
    if (!ds.length) return [];
    const out = [];
    if (a.rattache === 'VISUEL' || a.rattache === 'MAIN') out.push('BL');
    if (ds.some(d => d.format !== a.format)) out.push('FORMAT');
    if (ts.some(t => C.dossier(t.dossierId).themes.length > 1 && normTxt(a.libelleSaisi) !== normTxt(t.libelle))) out.push('THEME');
    if (ds.length > 1) out.push('MULTI');
    if (ds.some(d => !d.ipSaisies)) out.push('SANS_IP');
    if (a.va && a.va.etat === 'ANNULEE') out.push('ANNULEE');
    return out;
  };
  /** État de la validation admin d’une affiche : ORPHELINE (réception inconnue, à identifier d’abord), MANUELLE (confirmée par
      une personne), PROPOSEE (rattachement proposé par Circé, sans doute : à confirmer, cas sûr pré-coché), A_FAIRE (doute :
      à confirmer affiche par affiche, motifs affichés). Plus d’attente de la préparation. */
  C.vaEtat = a => {
    if (a.statut === 'ORPHELINE' || !a.alloc.length) return 'ORPHELINE';
    if (a.va && a.va.etat === 'MANUELLE') return 'MANUELLE';
    if (!C.dossiersOfAffiche(a).length) return 'ORPHELINE';
    return C.vaMotifs(a).length ? 'A_FAIRE' : 'PROPOSEE';
  };
  /** Date de la validation (confirmée par une personne) ; pour un rattachement seulement proposé, la date de réception. */
  C.vaDate = a => (a.va && a.va.etat === 'MANUELLE' && a.va.date ? a.va.date : a.date);
  /** Les affiches reçues d’un dossier, par état de leur validation admin. `aFaire` = tout ce qui reste à confirmer. */
  C.vaDossier = d => {
    const afs = M.data.affiches.filter(a => a.statut !== 'ORPHELINE' && a.alloc.some(x => d.themes.includes(x.themeId)));
    const par = M.groupBy(afs, C.vaEtat);
    const sures = par.PROPOSEE || [], doutes = par.A_FAIRE || [];
    return { afs, sures, doutes, manuelle: par.MANUELLE || [], aFaire: sures.concat(doutes) };
  };
  /** Page d’un dossier pour la Coordination (04/11, plus d’onglet Pré-production) : la page de son type d’atelier, filtrée sur
      lui : Déroulant › Liste des instructions, 2 m² fixe ou Pliage › À traiter. `params` complète ou remplace les filtres. */
  C.lienDossier = (d, params) => {
    const a = C.atelier(d.atelier);
    return { screen: 'instructions', params: Object.assign({ pour: a.mode === 'train' ? 'deroulant' : a.type, statut: 'TOUS', q: d.id }, params) };
  };
  /** Thèmes et dossiers qui ont au moins une affiche reçue à confirmer par la Coordination (proposée ou à doute). */
  C.vaAConfirmer = () => {
    const th = new Set(), ds = new Set();
    M.data.affiches.forEach(a => {
      const e = C.vaEtat(a);
      if (e !== 'PROPOSEE' && e !== 'A_FAIRE') return;
      a.alloc.forEach(x => { th.add(x.themeId); const t = C.theme(x.themeId); if (t) ds.add(t.dossierId); });
    });
    return { th, ds };
  };
  /** Validation admin d’un dossier, pour le tableau : SANS_OBJET (annulé), A_FAIRE (au moins une affiche à confirmer),
      FAITE (au moins une affiche reçue, toutes confirmées), AUCUNE (aucune affiche reçue). Indépendante de la préparation. */
  C.vaResume = d => {
    if (d.statutPP === 'ANNULE') return 'SANS_OBJET';
    const v = C.vaDossier(d);
    return v.aFaire.length ? 'A_FAIRE' : v.afs.length ? 'FAITE' : 'AUCUNE';
  };
  /** Statut du dossier à afficher, côté préparation (Broadcast) : À traiter, Préparation reçue, Annulé. La valeur interne « VALIDE »
      (préparation reçue et validation admin faite) s’affiche « Préparation reçue » : la validation admin a sa pastille à part
      (C.vaResume), qui ne dépend pas de la préparation (option A ; 02/11 : « la validation admin ne passe plus par l’attente de la prépa »). */
  C.statutDossier = d => (d.statutPP === 'VALIDE' ? 'PREPA_RECUE' : d.statutPP);
  /** Synchronise le statut du dossier avec la validation, dans les deux sens (Circé ne valide rien : il suit les confirmations) :
      « Validation admin faite » quand la préparation est reçue et que toutes les affiches reçues sont confirmées ; retour à
      « Préparation reçue » dès qu’une affiche à confirmer arrive ou qu’une validation est annulée. Sans aucune affiche reçue,
      il n’y a rien à valider : le dossier reste ou repasse « Préparation reçue » (02/11). Appelé après chaque réception,
      rattachement, confirmation ou annulation. Rend vrai si le dossier a changé. */
  C.majStatutVA = (d, quand) => {
    if (d.statutPP !== 'PREPA_RECUE' && d.statutPP !== 'VALIDE') return false;
    const v = C.vaDossier(d), r = C.vaResume(d);
    if (r === 'AUCUNE' && d.statutPP === 'VALIDE') {
      d.statutPP = 'PREPA_RECUE';
      d.historique.push({ date: quand || new Date(M.NOW), user: 'Circé (automatique)', action: 'Aucune affiche reçue : rien à valider, le dossier repasse « Préparation reçue »' });
      return true;
    }
    if (r === 'A_FAIRE' && d.statutPP === 'VALIDE') {
      d.statutPP = 'PREPA_RECUE';
      d.historique.push({ date: quand || new Date(M.NOW), user: 'Circé (automatique)', action: 'Validation admin à confirmer : ' + v.aFaire.length + ' affiche(s) proposée(s) à la Coordination (' + v.aFaire.map(a => a.id).join(', ') + ')' });
      return true;
    }
    if (r === 'FAITE' && d.statutPP === 'PREPA_RECUE') {
      d.statutPP = 'VALIDE';
      d.historique.push({ date: quand || new Date(M.NOW), user: 'Circé (automatique)', action: 'Validation admin faite : ' + v.afs.length + ' affiche(s) reçue(s), toutes confirmées par la Coordination' });
      return true;
    }
    return false;
  };
  /** Confirmation par la Coordination (bouton gardé de Circé), seule ou en lot : affiches confirmées, puis dossiers à jour. */
  C.validerAffiches = (afs, user) => {
    afs.forEach(a => {
      a.va = { etat: 'MANUELLE', user, date: new Date(M.NOW), motifs: C.vaMotifs(a).filter(m => m !== 'ANNULEE') };
      a.historique.push({ date: new Date(M.NOW), user, action: 'Validation admin confirmée' + (a.va.motifs.length ? ' après vérification : ' + a.va.motifs.map(m => M.VA_MOTIFS[m]).join(' ; ') : ' : rattachement proposé par Circé, sans doute') });
    });
    M.uniq(afs.flatMap(C.dossiersOfAffiche)).map(C.dossier).filter(Boolean).forEach(d => C.majStatutVA(d));
  };
  /** Annuler une validation admin : l’affiche repasse « à confirmer », avec son motif. */
  C.annulerValidation = (a, user) => {
    a.va = { etat: 'ANNULEE', user, date: new Date(M.NOW) };
    a.historique.push({ date: new Date(M.NOW), user, action: 'Validation admin annulée : l’affiche repasse à confirmer' });
    C.dossiersOfAffiche(a).map(C.dossier).filter(Boolean).forEach(d => C.majStatutVA(d));
  };
  C.etapesCount = us => {
    const r = { attente: 0, pret: 0, prod: 0, colise: 0, expedie: 0 };
    us.forEach(u => { r[M.ETAPE[u.statut]] += u.nb; });
    return r;
  };
  C.kpis = function (themes, unites) {
    const attendu = M.sum(themes, t => t.qteEnt);
    const recu = M.sum(themes, t => Math.min(C.recu(t.id), t.qteEnt));
    const reste = M.sum(themes, C.reste);
    const e = C.etapesCount(unites);
    const total = M.sum(Object.values(e));
    return { attendu, recu, reste, resteP: attendu ? reste / attendu : 0, e, total, termine: e.colise + e.expedie, avancement: total ? (e.colise + e.expedie) / total : 0, ok: e.pret + e.prod + e.colise + e.expedie };
  };

  /* ---------- Alertes (calculées + événements datés) ---------- */
  C.alertes = function () {
    const D = M.data;
    const out = [];
    const push = a => { a.acquittee = D.ack.has(a.key); out.push(a); };
    // Manquants et écarts (REC-16, PP-03, ANO-04 corrigée : l'attendu vient des lignes de préparation, pas d'un éclatement par type)
    D.themes.forEach(t => {
      const d = C.dossier(t.dossierId);
      if (!d || d.statutPP === 'ANNULE' || t.exclu || d.semaine < 43 || d.semaine > 44 || !d.ipSaisies || !t.qteEnt) return;
      const etat = C.etatTheme(t), recu = C.recu(t.id);
      if (etat === 'MANQUANT' || etat === 'PARTIEL') {
        const bloque = D.unites.filter(u => u.statut === 'EN_ATTENTE' && C.themesOf(u).some(x => x.id === t.id));
        const sev = d.semaine === 43 ? (etat === 'MANQUANT' ? 'critical' : 'serious') : 'warning';
        push({ key: 'MQ-' + t.id, type: 'MANQUANT', sev, site: d.site, semaine: d.semaine, date: M.deadlineReception(d.semaine), titre: etat === 'MANQUANT' ? 'Visuel non reçu' : 'Visuel reçu en partie',
          message: d.annonceur + ' « ' + t.libelle + ' » (dossier ' + d.id + ') : reste ' + M.fmt.n(C.reste(t)) + ' sur ' + M.fmt.n(t.qteEnt) + ' (' + M.fmt.pct(C.reste(t) / t.qteEnt) + ')' + (t.livraisonPrevue ? ' · livraison Print Cityz prévue le ' + M.fmt.day(t.livraisonPrevue) : '') + (bloque.length ? ' · bloque ' + M.sum(bloque, u => u.nb) + ' unité(s)' : ''),
          link: { screen: 'reservations', params: { q: d.id } }, needs: ['REC-16', 'PP-03', 'PP-07'], roles: ['coord', 'cheq', 'recep'] });
      } else if (etat === 'SURPLUS') {
        push({ key: 'EC-' + t.id, type: 'ECART', sev: 'warning', site: d.site, semaine: d.semaine, date: D.affiches.find(a => a.alloc.some(x => x.themeId === t.id)).date, titre: 'Écart de réception supérieur à 10 %',
          message: d.annonceur + ' « ' + t.libelle + ' » : reçu ' + M.fmt.n(recu) + ' pour ' + M.fmt.n(t.qteEnt) + ' attendus (' + M.fmt.signed((recu / t.qteEnt - 1) * 100) + ' %). Vérifier le BL ou un dossier multi-semaines.', link: { screen: 'reception', params: { tab: 'affiches', q: d.id } }, needs: ['REC-16'], roles: ['recep', 'coord'] });
      }
    });
    // Réception sur un dossier sans instructions de pose
    D.affiches.forEach(a => {
      const d = C.dossierOfAffiche(a);
      if (d && !d.ipSaisies) push({ key: 'IP-' + a.id, type: 'SANS_IP', sev: 'serious', site: a.site, semaine: d.semaine, date: a.date, titre: 'Réception sans instructions de pose', message: 'Affiche ' + a.id + ' (' + a.qteRecue + ' ex.) reçue pour ' + d.annonceur + ', dossier ' + d.id + ' : aucune IP saisie dans Broadcast. Intitulé saisi par la plateforme : « ' + a.libelleSaisi + ' », à reprendre par la Pré-Prod dans les IP de Broadcast (« le 1er qui a parlé ») : la Coordination la prévient.', link: { screen: 'reception', params: { tab: 'affiches', q: a.id } }, needs: ['REC-16', 'PP-03'], roles: ['coord', 'recep'] });
      // « Personne ne retrouve le dossier ? » (21/10) : plus de mail, le bouton met cette alerte pour la Coordination (27/10), à la place de la précédente
      if (a.statut === 'ORPHELINE' && a.signalePP) {
        const rec = D.receptions.find(r => r.id === a.receptionId) || {};
        push({ key: 'DI-' + a.id, type: 'DOSSIER_INTROUVABLE', sev: 'serious', site: a.site, semaine: null, date: a.signalePP.date, titre: 'Réception inconnue : dossier introuvable par la réception',
          message: 'Pour ' + a.signalePP.to + ' : affiche ' + a.id + ', lu « ' + a.annonceurSaisi + ' / ' + a.libelleSaisi + ' », ' + a.qteRecue + ' ex., format ' + a.format + ', imprimeur ' + (rec.imprimeur || a.imprimeur || '—') + ', BL ' + (rec.bl || '—') + ', rangée en ' + a.allee + '-' + a.rayon + ', reçue le ' + M.fmt.dt(a.date) + '. Ni le visuel ni le n° de dossier n’ont permis de la rattacher : retrouver le dossier dans Broadcast (IP à saisir si besoin, en reprenant l’intitulé de la plateforme), puis rattacher ; la palette passe alors à l’étape 2 de Réception des affiches.',
          link: { screen: 'identification', params: { id: a.id } }, needs: ['REC-17', 'PROC-04'], roles: ['coord'] });
      } else if (a.statut === 'ORPHELINE') push({ key: 'OR-' + a.id, type: 'ORPHELINE', sev: (M.NOW - a.date) > 24 * 3600e3 ? 'serious' : 'warning', site: a.site, semaine: null, date: a.date, titre: 'Réception inconnue à identifier', message: 'Affiche ' + a.id + ' : « ' + a.annonceurSaisi + ' / ' + a.libelleSaisi + ' », ' + a.qteRecue + ' ex., reçue le ' + M.fmt.dt(a.date) + '.', link: { screen: 'identification', params: { id: a.id } }, needs: ['REC-17', 'PROC-04'], roles: ['coord', 'recep'] });
    });
    // Validation admin à confirmer (option A, 02/11) : affiche reçue avec un doute de rattachement, pour la Coordination, qui la
    // confirme affiche par affiche. Les rattachements sans doute n’ont pas d’alerte : ils attendent dans la Liste des affiches (filtre
    // Validation admin), confirmés en lot. Un doute « IP pas saisies » a déjà son alerte (Réception sans instructions de pose).
    D.affiches.filter(a => C.vaEtat(a) === 'A_FAIRE' && C.vaMotifs(a).some(m => m !== 'SANS_IP')).forEach(a => {
      const ds = C.dossiersOfAffiche(a).map(C.dossier).filter(Boolean), d = ds[0];
      push({ key: 'VA-' + a.id, type: 'VALIDATION_ADMIN', sev: d.semaine <= M.state.semaine + 1 ? 'serious' : 'warning', site: a.site, semaine: d.semaine, date: a.date, titre: 'Validation admin à confirmer : doute de rattachement',
        message: 'Affiche ' + a.id + ' (' + a.qteRecue + ' ex., « ' + a.libelleSaisi + ' ») proposée pour ' + ds.map(x => 'le dossier ' + x.id + ' · ' + x.annonceur).join(', ') + ' : ' + C.vaMotifs(a).map(m => M.VA_MOTIFS[m]).join(' ; ') + '. Vérifier, puis confirmer la validation admin (aucune validation sans une personne).',
        link: { screen: 'reception', params: { tab: 'affiches', va: 'A_FAIRE', q: a.id } }, needs: ['PP-01', 'PP-10'], roles: ['coord'] });
    });
    // IP manquantes / préparation non reçue après la deadline Pré-Prod
    D.dossiers.forEach(d => {
      if (d.statutPP !== 'A_TRAITER' || d.semaine < 43 || d.semaine > 44) return;
      const dl = M.deadlinePP(d.semaine);
      const late = M.NOW > dl;
      push({ key: 'PP-' + d.id, type: 'IP_MANQUANTES', sev: late ? 'critical' : 'warning', site: d.site, semaine: d.semaine, date: dl, titre: late ? 'Préparation non reçue après la deadline' : 'Préparation attendue avant la deadline',
        message: d.annonceur + ' (dossier ' + d.id + ', ' + C.atelier(d.atelier).label + ') : ' + (d.ipSaisies ? 'IP saisies, préparation non envoyée' : 'IP non saisies') + '. Deadline Pré-Prod : ' + M.fmt.day(dl) + ' 16h.', link: C.lienDossier(d), needs: ['PP-03'], roles: ['coord'] });
    });
    // Écart Broadcast / Circé (ANO-06)
    D.dossiers.filter(d => d.qteBCInfo && M.inScope(d, { allWeeks: true })).forEach(d => push({ key: 'BC-' + d.id, type: 'ECART_BC', sev: 'serious', site: d.site, semaine: d.semaine, date: d.qteBCInfo.date, titre: 'Quantité Broadcast modifiée après envoi',
      message: 'Dossier ' + d.id + ' (' + d.annonceur + ') : Broadcast indique ' + d.qteBCInfo.bc + ' faces, Circé ' + d.qteBCInfo.circe + ' (blocage ou déblocage après l’envoi de la préparation).', link: C.lienDossier(d, { statut: 'ECART' }), needs: ['BC-03', 'SCR-04'], roles: ['coord'] }));
    // Départs camions à risque (48 h)
    const risk = M.groupBy(D.unites.filter(u => u.statut === 'EN_ATTENTE' && u.semaine === 43), u => u.site + '|' + C.dest(u.dest).boucle + '|' + C.depart(u).getTime());
    Object.entries(risk).forEach(([k, us]) => {
      const dep = C.depart(us[0]);
      const hrs = (dep - M.NOW) / 3600e3;
      if (hrs > 72) return;
      push({ key: 'DEP-' + k, type: 'DEPART_RISQUE', sev: hrs < 36 ? 'critical' : 'serious', site: us[0].site, semaine: 43, date: dep, titre: 'Départ camion à risque',
        message: C.dest(us[0].dest).boucle + ' (' + M.fmt.day(dep) + ' ' + M.fmt.hm(dep) + ') : ' + M.sum(us, u => u.nb) + ' unité(s) en attente d’affiches, ' + M.uniq(us.map(u => C.dest(u.dest).label)).join(', ') + '.', link: { screen: 'reservations', params: { ou: 'AFFICHES,PARTIEL' } }, needs: ['SP-01', 'CIB-09'], roles: ['cheq'] });
    });
    // Thèmes proches sur plusieurs dossiers, préparation reçue (PP-08)
    C.themesAVerifier().forEach(g => {
      const ds = g.dossiers.map(C.dossier);
      push({ key: 'TH-' + g.key, type: 'THEMES_PROCHES', sev: 'warning', site: M.uniq(ds.map(d => d.site)).length === 1 ? ds[0].site : null, semaine: Math.min(...ds.map(d => d.semaine)), date: new Date(Math.max(...ds.map(d => (d.prepaDate || M.NOW).getTime()))), titre: 'Thèmes proches à vérifier',
        message: g.annonceur + ' : ' + g.libelles.map(l => '« ' + l + ' »').join(', ') + (ds.length > 1 ? ' sur ' + ds.length + ' dossiers (' + g.dossiers.join(', ') + ')' : ' dans le dossier ' + g.dossiers[0]) + '. Même visuel ? Demander la correction dans Broadcast.',
        link: { screen: 'themes', params: { dossier: g.dossiers[0] } }, needs: ['PP-08'], roles: ['coord'] });
    });
    // Annonceurs aux noms proches sur plusieurs dossiers (16/10) : même règle que les thèmes
    C.annonceursAVerifier().forEach(g => {
      const ds = g.dossiers.map(C.dossier).filter(Boolean);
      push({ key: 'AN-' + g.key, type: 'ANNONCEURS_PROCHES', sev: 'warning', site: M.uniq(ds.map(d => d.site)).length === 1 ? ds[0].site : null, semaine: Math.min(...ds.map(d => d.semaine)), date: new Date(Math.max(...ds.map(d => (d.prepaDate || M.NOW).getTime()))), titre: 'Annonceurs proches à vérifier',
        message: g.libelles.map(l => '« ' + l + ' »').join(', ') + ' sur ' + ds.length + ' dossiers (' + g.dossiers.join(', ') + '). Même annonceur ? Demander la correction dans Broadcast.',
        link: { screen: 'themes', params: { tab: 'annonceurs', dossier: g.dossiers[0] } }, needs: ['PP-08'], roles: ['coord'] });
    });
    // Thème modifié dans Broadcast après la validation : Circé ne suit plus (PP-09)
    C.ecartsThemeBC().forEach(({ t, d, enProd }) => push({ key: 'TBC-' + t.id, type: 'THEME_BC', sev: enProd ? 'critical' : 'serious', site: d.site, semaine: d.semaine, date: t.modifBC ? t.modifBC.date : M.NOW, titre: enProd ? 'Thème modifié dans Broadcast, production lancée' : 'Thème modifié dans Broadcast après la validation',
      message: 'Dossier ' + d.id + ' (' + d.annonceur + ', ' + C.atelier(d.atelier).label + ') : Broadcast indique « ' + t.libelleBC + ' », Circé a « ' + t.libelle + ' ».' + (enProd ? ' La production est lancée : vérifier le visuel avec l’atelier.' : ' Reprendre la version Broadcast avant la production.'),
      link: { screen: 'themes', params: { tab: 'bc', dossier: d.id } }, needs: ['PP-09'], roles: enProd ? ['coord', 'cheq'] : ['coord'] }));
    // Feuilles de stock à refaire : thème modifié après l'identification (REC-06), alerte pour la réception
    const modifs = C.themesModifies();
    if (modifs.length) push({ key: 'TMOD', type: 'THEME_MODIF', sev: 'warning', site: null, semaine: null, date: new Date(Math.max(...modifs.map(a => a.themeModif.date.getTime()))), titre: 'Feuilles de stock à refaire', message: modifs.length + ' affiche(s) dont le thème ou le rattachement a changé après l’identification : réimprimer la feuille de stock (' + modifs.map(a => a.id).join(', ') + ').', link: { screen: 'reception', params: { tab: 'affiches', tag: 'refaire' } }, needs: ['REC-06'], roles: ['recep', 'coord'] });
    // Réception inconnue rattachée (21/10) : contrôle (informations corrigées, emplacement définitif), puis feuille définitive à la
    // place de la temporaire. Rattachée par la Coordination, la palette passe dans le sas de Réception des affiches : la réception y valide
    // le contrôle et imprime la nouvelle feuille (21/10)
    C.feuillesDefinitives().forEach(a => {
      const d = C.dossierOfAffiche(a), rec = D.receptions.find(r => r.id === a.receptionId) || {}, aCtrl = rec.statut === 'A_CONTROLER';
      push({ key: 'FD-' + a.id, type: 'FEUILLE_DEFINITIVE', sev: 'warning', site: a.site, semaine: d ? d.semaine : null, date: a.rattacheeLe || a.date,
        titre: aCtrl ? 'Réception inconnue rattachée : contrôle et feuille définitive' : 'Feuille de stock définitive à imprimer',
        message: 'Affiche ' + a.id + ' (réception inconnue ' + a.receptionId + ') rattachée' + (d ? ' au dossier ' + d.id + ' · ' + d.annonceur : '') + ' : ' + (aCtrl ? 'dans Réception des affiches, vérifier les informations, valider le contrôle et imprimer la feuille définitive' : 'imprimer la feuille définitive à la place de la temporaire, dans Réception des affiches') + (a.allee === M.PARAMS.alleeInconnues ? ' ; l’affiche est encore dans la zone tampon (' + a.allee + '-' + a.rayon + ')' : '') + '.',
        link: { screen: 'reception', params: { tab: 'controle', id: a.receptionId } }, needs: ['REC-17', 'REC-06', 'REC-02'], roles: ['recep'] });
    });
    // Réceptions attendues anciennes : purge automatique, sans alerte (décision du 19/10)
    // Palettes du sas de contrôle (zone tampon) en attente au-delà du délai (19/10 : « un sas qui se remplit, à contrôler vite »)
    const delai = M.PARAMS.delaiControle * 3600e3;
    const depuis = r => r.aControlerDepuis || r.date; // réception inconnue : à contrôler depuis son rattachement
    D.receptions.filter(r => r.statut === 'A_CONTROLER' && M.NOW - depuis(r) > delai).forEach(r => push({ key: 'CT-' + r.id, type: 'CONTROLE_RETARD', sev: M.NOW - depuis(r) > 2 * delai ? 'serious' : 'warning', site: r.site, semaine: null, date: depuis(r),
      titre: 'Palette à contrôler depuis plus de ' + M.PARAMS.delaiControle + ' h', message: 'Réception ' + r.id + ' (BL ' + r.bl + ', ' + r.imprimeur + ') arrivée le ' + M.fmt.dt(r.date) + ', en zone tampon : à compter et ranger.',
      link: { screen: 'reception', params: { tab: 'controle', id: r.id } }, needs: ['REC-25'], roles: ['recep', 'cheq'] }));
    // Non-conformités (screens/nonconformite.js) : bloquante, pour la Pré-Prod jusqu'à sa décision (09/11) ; action renvoyée à la
    // plateforme, jusqu'à sa réponse « Oui, traité » (10/11, réponse séparée de la décision le 11/11). Une décision qui donne « Traitée » n'en ouvre aucune
    if (M.ncAlertes) M.ncAlertes().forEach(push);
    D.events.forEach(e => push(Object.assign({}, e)));
    return out.filter(a => (M.state.site === 'ALL' || !a.site || a.site === M.state.site));
  };
  C.alertesOuvertes = () => C.alertes().filter(a => !a.acquittee);
  C.sevRank = { critical: 0, serious: 1, warning: 2, info: 3, good: 4 };

  /* ---------- Thèmes proches (règle de l'outil Projet 1 : simplification, inclusion, similarité ≥ 0,85) ---------- */
  C.simplifier = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^0-9a-z]+/g, ' ').trim();
  C.ratio = function (a, b) { // équivalent de difflib.SequenceMatcher.ratio (blocs communs les plus longs)
    function lcs(a, b) {
      if (!a.length || !b.length) return 0;
      let best = 0, bi = 0, bj = 0;
      for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
        let k = 0; while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
        if (k > best) { best = k; bi = i; bj = j; }
      }
      if (!best) return 0;
      return best + lcs(a.slice(0, bi), b.slice(0, bj)) + lcs(a.slice(bi + best), b.slice(bj + best));
    }
    return a.length + b.length ? 2 * lcs(a, b) / (a.length + b.length) : 1;
  };
  C.proches = function (a, b) {
    a = C.simplifier(a); b = C.simplifier(b);
    if (a === b) return true;
    const [court, long] = a.length <= b.length ? [a, b] : [b, a];
    if (court.length >= 3 && (' ' + long + ' ').includes(' ' + court + ' ')) return true;
    return C.ratio(a, b) >= M.PARAMS.seuilThemesProches;
  };
  C.regrouper = function (annonceur) {
    for (const r of M.PARAMS.regroupements) {
      const re = new RegExp('^' + r.motif.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
      if (re.test(annonceur)) return r.valeur;
    }
    return annonceur;
  };

  /* ---------- Vérification des thèmes (PP-08) ---------- */
  /** Dès que la préparation est reçue, repère les visuels identiques ou proches sur plusieurs dossiers d'un même annonceur
      regroupé, ou d'annonceurs aux noms proches (16/10), avec la règle de l'outil multi-rouleuse (C.proches). Un groupe = un visuel probable et ses intitulés ;
      « harmoniser » = intitulés différents. Circé ne modifie pas Broadcast : la Coordination demande la correction à la Pré-Prod et rend la
      main (M.data.demandesThemes, par thème), puis Broadcast renvoie la préparation corrigée. Les autres décisions
      (visuels différents, corrigé) sont dans M.data.verifThemes, par groupe. */
  const prochesMemo = new Map();
  const prochesVite = (a, b) => {
    const k = M.PARAMS.seuilThemesProches + '\u0001' + (a < b ? a + '\u0001' + b : b + '\u0001' + a);
    if (!prochesMemo.has(k)) prochesMemo.set(k, C.proches(a, b));
    return prochesMemo.get(k);
  };

  /* ---------- Vérification des annonceurs (16/10) : même règle que les thèmes, appliquée aux noms d'annonceurs ---------- */
  /** Noms d'annonceur des dossiers suivis, dès la DA activée (semaine en cours et suivantes) : celui de Broadcast et, s'il
      existe, l'annonceur imprimé corrigé par la plateforme au fixe ou à la colle (FIX-15). */
  function nomsAnnonceurs() {
    const out = [];
    M.data.dossiers.filter(d => d.statutPP !== 'ANNULE' && d.semaine >= M.state.semaine && M.inScope(d, { allWeeks: true })).forEach(d => {
      out.push({ nom: d.annonceur, d, t: null, source: 'Broadcast' });
      d.themes.map(C.theme).filter(t => t && t.annonceurImprime && t.annonceurImprime !== d.annonceur).forEach(t => out.push({ nom: t.annonceurImprime, d, t, source: 'Plateforme' }));
    });
    return out;
  }
  /** Groupes d'annonceurs proches : des noms différents, mais identiques une fois simplifiés, l'un contenu dans l'autre, ou
      d'une similarité ≥ seuil (C.proches, règle des thèmes). Deux noms qu'un regroupement réunit déjà (« *MISTRAL* », outil
      multi-rouleuse) ne sont pas signalés. Clé : les n° de dossiers. Circé ne modifie pas Broadcast : la Coordination demande la
      correction à la Pré-Prod (M.data.demandesAnnonceurs, par dossier) ou note « annonceurs différents » (M.data.verifAnnonceurs). */
  C.groupesAnnonceurs = function () {
    const D = M.data, verif = D.verifAnnonceurs || {}, dem = D.demandesAnnonceurs || {};
    const noms = nomsAnnonceurs();
    const bases = M.uniq(noms.map(x => C.regrouper(x.nom)));
    const vu = new Set(), out = [];
    bases.forEach(b0 => {
      if (vu.has(b0)) return;
      const comp = [b0];
      vu.add(b0);
      for (let i = 0; i < comp.length; i++) bases.forEach(b => { if (!vu.has(b) && prochesVite(comp[i], b)) { vu.add(b); comp.push(b); } });
      if (comp.length < 2) return;
      const membres = noms.filter(x => comp.includes(C.regrouper(x.nom)));
      const dossiers = M.uniq(membres.map(x => x.d.id)).sort();
      const key = dossiers.join('|');
      out.push({ key, bases: comp, membres, dossiers, libelles: M.uniq(membres.map(x => x.nom)), verif: verif[key] || null, demandes: membres.filter(x => dem[x.d.id] && dem[x.d.id].statut === 'ENVOYEE') });
    });
    // Groupes corrigés par Broadcast : leurs noms sont devenus identiques ; on les garde pour la trace
    Object.entries(verif).filter(([k, v]) => v.statut === 'CORRIGE' && !out.some(g => g.key === k))
      .forEach(([key, v]) => out.push({ key, bases: [], membres: [], dossiers: v.dossiers, libelles: v.libelles, verif: v, demandes: [], corrige: true }));
    return out;
  };
  /** Groupes d'annonceurs à vérifier : ni décision (annonceurs différents), ni demande de correction en cours. */
  C.annonceursAVerifier = () => C.groupesAnnonceurs().filter(g => !g.corrige && !g.verif && !g.demandes.length);
  /** Annonceur de référence pour comparer les thèmes : le groupe d'annonceurs proches (sauf « annonceurs différents »),
      sinon le regroupement. Les thèmes de « Brasserie du Port » et de « BRASSERIE PORT » sont ainsi comparés entre eux. */
  C.annonceurRef = function () {
    const map = new Map();
    C.groupesAnnonceurs().filter(g => !g.corrige && !(g.verif && g.verif.statut === 'DIFFERENTS')).forEach(g => { const ref = g.libelles.join(' / '); g.bases.forEach(b => map.set(b, ref)); });
    return nom => map.get(C.regrouper(nom)) || C.regrouper(nom);
  };

  C.groupesThemes = function () {
    const D = M.data;
    const verif = D.verifThemes || {}, dem = D.demandesThemes || {};
    const enCours = t => dem[t.id] && dem[t.id].statut === 'ENVOYEE';
    // Dès la saisie des IP (les thèmes arrivent dans l'état des réservations), donc souvent avant la réception (RP30 #2),
    // jusqu'à la validation ; un dossier dont la main est rendue pour corriger un thème reste suivi jusqu'au renvoi
    const ths = D.themes.filter(t => {
      const d = C.dossier(t.dossierId);
      return d && !t.exclu && (d.statutPP === 'PREPA_RECUE' || d.statutPP === 'VALIDE' || (d.statutPP === 'A_TRAITER' && d.ipSaisies) || enCours(t)) && d.semaine >= M.state.semaine && M.inScope(d, { allWeeks: true });
    });
    const out = [];
    // Annonceur de référence : regroupement, ou groupe d'annonceurs aux noms proches tant qu'il n'est pas noté « différents »
    const ref = C.annonceurRef();
    Object.entries(M.groupBy(ths, t => ref(C.dossier(t.dossierId).annonceur))).forEach(([annonceur, list]) => {
      const vu = new Set();
      list.forEach(t0 => {
        if (vu.has(t0.id)) return;
        const comp = [t0];
        vu.add(t0.id);
        for (let i = 0; i < comp.length; i++) list.forEach(t => { if (!vu.has(t.id) && prochesVite(comp[i].libelle, t.libelle)) { vu.add(t.id); comp.push(t); } });
        const key = comp.map(t => t.id).sort().join('|');
        const dossiers = M.uniq(comp.map(t => t.dossierId));
        const libelles = M.uniq(comp.map(t => t.libelle.trim()));
        // Un seul dossier et un seul intitulé : rien à vérifier (sauf un groupe déjà traité, qui reste visible)
        if (comp.length < 2 || (dossiers.length < 2 && libelles.length < 2 && !verif[key])) return;
        out.push({ key, annonceur, themes: comp, dossiers, libelles, harmoniser: libelles.length > 1, verif: verif[key] || null, demandes: comp.filter(enCours) });
      });
    });
    return out;
  };
  /** Groupes à vérifier : intitulés différents, sans demande de correction en cours ni décision (visuels différents). */
  C.themesAVerifier = () => C.groupesThemes().filter(g => g.harmoniser && !g.verif && !g.demandes.length);

  const PROD_LANCEE = ['EN_PROD', 'PRODUIT', 'COLISE', 'EXPEDIE', 'LIVRE'];
  /** Production lancée sur un dossier : une de ses unités est en production ou au-delà (« point de non-retour »). */
  C.prodLancee = d => M.data.unites.some(u => PROD_LANCEE.includes(u.statut) && (u.themeId ? d.themes.includes(u.themeId) : (u.positions || []).some(p => d.themes.includes(p.themeId))));
  /** Thèmes modifiés dans Broadcast après l'envoi de la préparation (PP-09) : à chaque mise à jour de sa copie de Broadcast,
      Circé compare, dossier par dossier, le thème de Broadcast (t.libelleBC) et le sien, même après Instruction OK et
      validation admin. Aujourd'hui, rien ne les compare : le thème de l'affiche est copié à la réception. Un intitulé
      corrigé par la plateforme au fixe ou à la colle (FIX-15) n'est pas un écart, tant que Broadcast ne change plus. */
  C.ecartsThemeBC = () => M.data.themes.filter(t => t.libelleBC && t.libelleBC !== t.libelle && !(t.corrPlateforme && t.corrPlateforme.bc === t.libelleBC))
    .map(t => ({ t, d: C.dossier(t.dossierId) }))
    .filter(x => x.d && x.d.statutPP !== 'ANNULE' && x.d.semaine >= M.state.semaine && M.inScope(x.d, { allWeeks: true }))
    .map(x => Object.assign(x, { enProd: C.prodLancee(x.d) }));

  /* ---------- Réceptions attendues anciennes (REC-05, ANO-11) ---------- */
  /** Âge en semaines d'une réception attendue ancienne, compté sur la semaine de départ en cours. */
  C.ageAttendue = x => (M.SEM_PROD + 1) - x.semaine;
  /** Purge automatique (Synthèse, ligne 89 : « les faire disparaître au bout de 4 semaines hors flag conservation à l'année ») :
      au-delà du délai paramétré, les réceptions attendues ou partielles sortent de la liste, sauf conservation à l'année.
      Rien à valider, pas d'alerte (décision du 19/10) ; la purge est notée au journal. */
  C.purgerAttendues = function (D) {
    D = D || M.data;
    const P = M.PARAMS.purgeAttendues, sortie = D.attenduesAnciennes.filter(x => C.ageAttendue(x) >= P && !x.conservation);
    if (!sortie.length) return 0;
    D.attenduesAnciennes = D.attenduesAnciennes.filter(x => !sortie.includes(x));
    D.journal.push({ date: new Date(M.NOW), user: 'Circé (automatique)', objet: 'Réceptions attendues', action: 'Purge automatique : ' + sortie.length + ' réception(s) attendue(s) ou partielle(s) de plus de ' + P + ' semaines ; ' + D.attenduesAnciennes.filter(x => x.conservation).length + ' gardée(s), conservation à l’année' });
    return sortie.length;
  };

  /* ---------- Réception en deux temps (19/10) ---------- */
  /** Lignes de BL d'une réception : l'affiche et la quantité du BL (une réception créée avant le 19/10 n'en a pas). */
  C.lignesReception = rec => rec.lignes || rec.affiches.map(id => ({ afficheId: id, qte: ((M.data.idx.affiche && M.data.idx.affiche.get(id)) || M.data.affiches.find(a => a.id === id) || {}).qteRecue || 0 }));
  /** Palettes arrivées, pas encore contrôlées (étape 2), dans le périmètre du site choisi. */
  C.receptionsAControler = () => M.data.receptions.filter(r => r.statut === 'A_CONTROLER' && (M.state.site === 'ALL' || r.site === M.state.site));
  /** Affiches dont le thème a changé après l'identification : feuille de stock à refaire (REC-06, Synthèse ligne 67). */
  C.themesModifies = () => M.data.affiches.filter(a => a.themeModif && !a.themeModif.reimprime && a.feuilleImprimee !== 'TEMPORAIRE' && (M.state.site === 'ALL' || a.site === M.state.site));
  /** Affiches de réceptions inconnues rattachées qui portent encore leur feuille temporaire : la définitive est à imprimer (21/10). */
  C.feuillesDefinitives = () => M.data.affiches.filter(a => a.alloc.length > 0 && a.feuilleImprimee === 'TEMPORAIRE' && (M.state.site === 'ALL' || a.site === M.state.site));
  /** Note sur les affiches d'un thème que son intitulé a changé : la réception refait leurs feuilles de stock. */
  C.noterThemeModifie = (t, ancien, par, origine) => {
    M.data.affiches.filter(a => a.alloc.some(x => x.themeId === t.id)).forEach(a => {
      a.themeModif = { ancien: a.themeModif && !a.themeModif.reimprime ? a.themeModif.ancien : ancien, nouveau: t.libelle, date: new Date(M.NOW), par, origine, reimprime: false };
    });
  };

  /* ---------- Fin de campagne : conserver, envoyer, détruire (REC-20, REC-21, REC-24) ---------- */
  /** Points d'attention avant destruction (paramétrables) : dossiers livrés à Bordeaux (BDX), dossiers MUI. */
  C.attentionDossier = d => {
    const p = M.PARAMS.finCampagne.attention, out = [];
    if (p.includes('BDX') && M.data.lignes.some(l => l.dossierId === d.id && l.dest === 'BOR')) out.push('BDX');
    if (p.includes('MUI') && d.format === 'Scrolling MUI') out.push('MUI');
    return out;
  };
  /** Garde-fou par visuel (RP32 #4) : une affiche n'est proposée à la destruction que si son visuel n'a plus de campagne
      prévue (visuel commun à plusieurs dossiers, S31). La conservation demandée se décide par dossier (« En conservation »).
      Renvoie les raisons qui bloquent la destruction du dossier. */
  C.gardeDestruction = (d, afs) => {
    const out = [];
    afs.filter(a => C.stockDispo(a) > 0).forEach(a => {
      const futurs = M.uniq(a.alloc.map(x => (C.theme(x.themeId) || {}).dossierId).filter(id => id && id !== d.id)).map(C.dossier)
        .filter(x => x && x.statutPP !== 'ANNULE' && Math.max(...x.semaines) >= M.state.semaine);
      futurs.forEach(x => out.push({ affiche: a.id, raison: 'campagne prévue S' + Math.min(...x.semaines.filter(s => s >= M.state.semaine)) + ' (dossier ' + x.id + ')' }));
    });
    return out;
  };
  /** Délai avant destruction, en semaines après le dernier départ, selon le format du dossier (RP32 #4) : 2 m² (MUI compris)
      4 semaines, 8 m² 2 semaines faute de place de stockage, autres formats selon le paramètre « autres ». */
  C.formatDestruction = d => (/^8 m²/.test(d.format) ? '8 m²' : /^2 m²|MUI/.test(d.format) ? '2 m²' : 'autres');
  C.delaiDestruction = d => M.PARAMS.finCampagne.delai[C.formatDestruction(d)];
  /** Dossiers en fin de campagne : dernier départ passé et affiches encore en stock, ou décision déjà prise. Une décision
      par dossier, pour toutes ses affiches (M.data.finCampagne) : conserver, renvoyer puis détruire, détruire. */
  C.finCampagne = function () {
    const D = M.data, dec = D.finCampagne || {};
    const parDossier = M.groupBy(D.affiches.filter(a => a.statut !== 'ORPHELINE' && C.dossierOfAffiche(a)), a => C.dossierOfAffiche(a).id);
    return Object.entries(parDossier).map(([id, afs]) => {
      const d = C.dossier(id);
      const dernier = Math.max(...d.semaines);
      const x = dec[id] || null;
      return { id, d, affiches: afs, stock: M.sum(afs, a => Math.max(0, C.stockDispo(a))), dernier, delai: C.delaiDestruction(d), echeance: dernier + C.delaiDestruction(d), attention: C.attentionDossier(d), decision: x ? x.decision : 'A_DECIDER', x };
    }).filter(r => r.dernier < M.state.semaine && (r.stock > 0 || r.x) && M.inScope(r.d, { allWeeks: true }))
      .map(r => Object.assign(r, { garde: r.stock > 0 ? C.gardeDestruction(r.d, r.affiches) : [] }));
  };

  M.resetData = function () { M.data = generate(); M.reindex(); C.couverture(); };
  M.resetData();
})();
