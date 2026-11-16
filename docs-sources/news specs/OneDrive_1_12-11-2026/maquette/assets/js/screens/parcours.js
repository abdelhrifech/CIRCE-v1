/* Parcours guidés pour les ateliers de présentation */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui;
  const sim = label => () => { const s = M.SIMULATIONS.find(x => x.label === label); s.run(); M.refresh(); };
  const P = [
    { titre: 'Pilotage du matin (chef d’équipe)', role: 'cheq', needs: ['REU-01', 'REU-02', 'SP-01'], steps: [
      ['Déroulant › Suivi de prod : cliquer « En attente » pour ne garder que les visuels qui bloquent', () => M.go('suivi', { pour: 'deroulant' })],
      ['Dashboard : avancement par atelier et par départ camion', () => M.go('suivi')],
      ['État des réservations vivant : les visuels dont les affiches sont attendues ou reçues en partie', () => M.go('reservations', { ou: 'AFFICHES,PARTIEL' })],
      ['Départs camions à risque', () => M.go('alertes', { type: 'DEPART_RISQUE' })]] },
    { titre: 'Une livraison sans référence, de la palette au train', role: 'recep', needs: ['REC-17', 'PP-02'], steps: [
      ['Déclencher l’arrivée d’une livraison inconnue (BL sans référence)', sim('Une livraison arrive sans référence de dossier')],
      ['L’identifier dans Réceptions inconnues : ouvrir sa fiche (clic sur la ligne), onglet Préparations, et la rattacher à son dossier', () => M.go('identification')],
      ['Réception des affiches, étape 2 : ouvrir la palette dans le sas, valider le contrôle, imprimer la feuille de stock définitive', () => M.go('reception', { tab: 'controle' })],
      ['Constater dans l’état des réservations vivant que le dossier passe « Prêt ou en production »', () => M.go('reservations')]] },
    { titre: 'Une réception qui débloque des trains', role: 'recep', needs: ['REC-25', 'REC-27', 'PP-02', 'ANO-05', 'REC-03', 'REC-12'], steps: [
      ['Réception des affiches, étape 1 : trouver les dossiers du BL, de l’une des trois façons du bandeau (photo du BL, photo d’une affiche, n° de dossier puis « Au panier »)', () => M.go('reception', { tab: 'attendues' })],
      ['Même page : cocher les lignes du BL, photographier le BL s’il ne l’est pas encore (il pré-remplit le bon de livraison), vérifier, valider : la palette passe à l’étape 2', () => M.go('reception', { tab: 'attendues' })],
      ['Étape 2, le sas : ouvrir la palette la plus ancienne, compter, ranger, choisir le contrôleur, imprimer les feuilles en lot', () => M.go('reception', { tab: 'controle' })],
      ['Ou en un clic : simuler une réception qui complète un manquant', sim('Une réception complète un visuel manquant')],
      ['Trains : les positions passent au vert', () => M.go('trains')]] },
    // Le travail de la pré-production dans Circé est celui de la Coordination (27/10) : la Pré-Prod saisit les IP et envoie la
    // préparation dans Broadcast. Circé fait l'Instruction OK quand tout concorde et propose la validation admin à la réception ; la Coordination confirme (02/11).
    { titre: 'Coordination : préparations reçues, Instruction OK et validation admin', role: 'coord', needs: ['PP-10', 'PP-01', 'SCR-11', 'PP-06', 'PP-08', 'PP-09', 'BC-03', 'SCR-03'], steps: [
      ['Validation admin en lot, tous formats : Réception › Liste des affiches, filtre « Validation admin ». On part de la réception, plus de la préparation ; les cas sûrs sont pré-cochés : « Valider la sélection » confirme le lot en un clic', () => M.go('reception', { tab: 'affiches', va: 'PROPOSEE,A_FAIRE' })],
      ['Déroulant › Liste des instructions, « En cours » (commentaire de prépa, ou nombre d’exceptions différent de la quantité) : Instruction OK à la main ; sinon, elle est automatique', () => M.go('instructions', { pour: 'deroulant', iok: 'A_FAIRE' })],
      ['Affiche à confirmer avec un doute (rattachée sans le n° du BL, plusieurs thèmes possibles, visuel de plusieurs dossiers) : ouvrir l’affiche, vérifier le motif, « Valider » (aucune validation sans vous)', () => M.go('reception', { tab: 'affiches', va: 'A_FAIRE' })],
      ['2 m² fixe › À traiter : les dossiers du fixe, leur validation admin, la préparation reçue, les écarts Broadcast', () => M.go('instructions', { pour: 'fixe' })],
      ['État des réservations vivant : les n° d’affiche apparaissent dès la réception (✓ validée, • à confirmer)', () => M.go('reservations')],
      ['Vérification des thèmes : « Menu burger » et « MENU BURGERS » sur plusieurs dossiers, demander la correction à la Pré-Prod (la main est rendue à Broadcast)', () => M.go('themes')],
      ['Broadcast renvoie les préparations corrigées : le groupe quitte la liste « À vérifier »', () => { const s = M.SIMULATIONS.find(x => x.label === 'Broadcast renvoie les préparations corrigées (thèmes, annonceurs)'); s.run(); M.go('themes'); }],
      ['Annonceurs proches : « Brasserie du Port » et « BRASSERIE PORT », demander la correction à Broadcast', () => M.go('themes', { tab: 'annonceurs' })],
      ['Thème changé dans Broadcast après la validation : alerte, puis « Reprendre la version Broadcast »', () => M.go('themes', { tab: 'bc' })],
      ['Écart Broadcast / Circé : appliquer la version Broadcast', () => M.go('instructions', { pour: 'deroulant', statut: 'ECART' })],
      ['Jeudi 14 h : Instructions OK restantes, vérification de la préparation des trains, puis « Exporter les trains » (« A imprimer » : le go des plateformes)', () => M.go('trains')]] },
    { titre: '2 m² fixe : du dossier aux fichiers multi-rouleuse en un clic', role: 'cheq', needs: ['FIX-02', 'REU-06', 'REU-05', 'FIX-01'], steps: [
      ['Fixe : lignes par afficheur, entretien à l’afficheur (survoler la colonne)', () => M.go('unitaire', { type: 'fixe', atelier: 'NIM-F2' })],
      ['Générateur : multi-rouleuse Nîmes, « Proposer les fichiers »', () => M.go('generateur', { machine: 'NIM-MR' })],
      ['Repérer les thèmes proches et la version combinée, puis envoyer', () => M.go('generateur', { machine: 'NIM-MR' })],
      ['Corriger l’intitulé d’un visuel, même production lancée (« Corriger l’intitulé »)', () => M.go('unitaire', { type: 'fixe', atelier: 'NIM-F2' })]] },
    { titre: 'Vendôme : le chef d’équipe choisit les trains du fichier', role: 'cheq', needs: ['SCR-06', 'FP-02', 'ANO-13', 'SCR-13'], steps: [
      ['Trains : fractionner un train qui attend un visuel, ou raccrocher un visuel à plusieurs trains', () => M.go('trains', { tab: 'trains' })],
      ['Générateur : Vendôme Nîmes, cocher les trains selon l’avancement : le compteur bloque au-delà de 20 tiroirs', () => M.go('generateur', { machine: 'NIM-VEN' })],
      ['Bilan : tiroirs, liste de picking, envoi à la machine', () => M.go('generateur', { machine: 'NIM-VEN' })],
      ['Dispatch : répartir le roulage entre rouleurs', () => M.go('dispatch')]] },
    { titre: 'Un rajout arrive après la préparation', role: 'cheq', needs: ['REU-04', 'FIX-07', 'SCR-08'], steps: [
      ['Fixe : déclencher l’arrivée tardive', sim('Un dossier 2 m² fixe arrive après la libération de la semaine')],
      ['Déroulant : un visuel arrive après la préparation des trains', sim('Un visuel arrive après la préparation des trains (déroulant)')],
      ['Voir les mails envoyés à la liste de distribution (bouton ✉ Mails en haut)', () => M.ui.mailbox()],
      ['Retrouver le dossier repéré dans le 2 m² fixe', () => M.go('unitaire', { type: 'fixe', flag: 'apres' })]] },
    { titre: 'Dernière minute sur un train déjà en production', role: 'cheq', needs: ['SCR-08', 'CIB-03'], steps: [
      ['Déclencher la dernière minute', sim('Dernière minute sur un train déjà en production')],
      ['L’alerte critique', () => M.go('alertes', { type: 'DM_FICHIER' })],
      ['Historique des générations : « Générer un complément »', () => M.go('generateur')]] },
    { titre: 'Expédier et mettre à jour le stock', role: 'expe', needs: ['REU-08', 'CIB-15'], steps: [
      ['Scanner un destinataire puis ses unités, clore le colis', () => M.go('expedition', { tab: 'colisage' })],
      ['Fin de journée Geodis', () => M.go('expedition', { tab: 'colis' })],
      ['Stock : sorties automatiques dans les mouvements', () => M.go('stock', { tab: 'mvt' })],
      ['Preuves de livraison', sim('Preuves de livraison Geodis reçues')]] },
  ];

  M.screen({
    id: 'parcours', title: 'Parcours guidés', icon: '➜', nav: 'Parcours guidés',
    render(root) {
      root.append(ui.pageHead({ crumb: 'Aide à la lecture', title: 'Parcours guidés', sub: 'Scénarios prêts pour les ateliers. Chaque étape ouvre le bon écran ou déclenche l’événement. « Simuler › Réinitialiser » remet les données de départ.' }),
        h('div', { class: 'grid cols-3' }, P.map((p, i) => ui.card({ title: (i + 1) + '. ' + p.titre, sub: M.ROLES.find(r => r.id === p.role).label, body: [
          h('ol', { style: { margin: '0 0 8px 18px', padding: 0 } }, p.steps.map(([t, fn]) => h('li', { style: { margin: '6px 0' } }, h('button', { class: 'linkish', style: { textAlign: 'left' }, onclick: () => { if (M.state.role !== p.role) M.state.role = p.role; fn(); } }, t)))),
          ui.chips(p.needs)] }))));
    },
  });
})();
