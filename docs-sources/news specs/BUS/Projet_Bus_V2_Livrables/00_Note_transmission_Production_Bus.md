# Production Bus — connaissance métier pour la refonte de Circé

Note de transmission · V1.1 · 08/10/2026 · Thierry Czerwiec (Adsoluce), pour Amaury Bourayne

## 1. Objet

Cityz confie la refonte complète de Circé, son outil de production pour l'affichage, à une nouvelle équipe. Les aménagements de Circé prévus pour le Bus en 2026 (chantier « V2 ») sont donc abandonnés.

Cette note transmet à l'équipe de refonte ce que nous avons appris sur la production Bus pendant ce chantier : ateliers de mai à septembre 2026 avec la préproduction, l'exploitation Bus et l'IT. Elle est destinée à nourrir la réflexion de l'équipe. **Ce n'est pas un cahier des charges** : elle n'impose ni écran ni architecture.

Le métier et la DSI ont posé un principe : le Bus doit fonctionner, autant que possible, comme les autres supports. La note se concentre donc sur ce qui le distingue. Elle sépare :

- les particularités opérationnelles du Bus (§3) ;
- les règles métier à préserver (§4). Chacune a un statut : **Fermée** (validée par le métier), **Existant** (déjà appliquée aux autres plateformes, à couvrir aussi pour le Bus) ou **Ouverte** (besoin confirmé, règle à trancher) ;
- les choix liés aux outils actuels, qui peuvent être réexaminés (§5) ;
- les points encore à arbitrer et les interlocuteurs (§8 et §9).

Chaque règle renvoie à sa source dans le dossier joint (documents 01 à 04f).

## 2. Repères pour une équipe extérieure

- **Broadcast** : outil de vente et de réservation de Cityz. On y trouve les commandes et le patrimoine, c'est-à-dire l'inventaire des emplacements vendables.
- **Circé** : outil de production actuel, utilisé par la préproduction et les plateformes depuis 2017 (Wissous, Nîmes/Sausset). Nanterre n'y est pas raccordée.
- **Field Service** : outil de planification et de suivi de la pose. Les poseurs sous-traitants y accèdent en version mobile.
- **Préproduction** : équipe qui suit les dossiers vendus jusqu'à la réception des affiches et gère la relation avec le client en cas de problème.
- **Plateforme** : site qui reçoit et prépare les affiches. Pour le Bus, c'est Nanterre.
- **DSP** (délégation de service public) : réseau de transport dont Cityz exploite l'espace publicitaire. **Centre bus** : dépôt d'une DSP, où les plaques sont livrées et posées. **Parc** : sous-ensemble des bus d'un centre (parc A, parc B…).
- **Dossier de vente / bon de commande** : la campagne vendue à un annonceur. **Thème** : une version du visuel au sein d'une campagne.
- **Entretien** : affiches commandées en plus pour couvrir la casse, le vol et les non-conformités.
- **BL** : bon de livraison de l'imprimeur. **NC** : fiche de non-conformité.
- **Fiche de préparation, état de collage** : documents qui indiquent, par destination, quoi coller et en quelle quantité.
- **Dernière Minute** : procédure de dérogation quand une pose est demandée sous le délai minimum.
- **Reste en place** : plaque d'une campagne terminée, laissée sur le bus au lieu d'être déposée.

## 3. Particularités opérationnelles du Bus

**La chaîne actuelle.** Broadcast (vente, réservation) → outil de production (anticipation, réception des affiches, préparation) → Field Service (état de collage, pose).

**Ce qui distingue le Bus :**

- Les affiches sont **collées sur des plaques**, mises en rack (100 à 110 plaques par rack), puis posées sur les bus dans les **centres bus**. D'où le besoin de recevoir les affiches environ 2 semaines avant la pose.
- **Cinq formats, sans notion de surface** : arrière 1, arrière 2, flanc gauche, flanc droit, avant. Les **avants doivent être vernis** (prestataire externe), ce qui allonge le délai.
- **Nanterre livre elle-même les centres bus**. Les affiches arrivées par erreur sont redispatchées en interne vers les deux sous-traitants.
- Le **parc est vivant** : un cadastre annonce 60 plaques, le terrain en a 40. Ces écarts sont permanents, par centre bus, par parc (A, B, puis des quarts de parc en 2027) et par format. Un manque ne se compense pas sur un panneau voisin comme en affichage classique.
- Volumes attendus : jusqu'à environ 120 clients par semaine avec 12 DSP.
- Quantités appliquées à la vente : **+8 % de production (figé)** et **+20 % d'entretien par défaut** (modulable par la préproduction).

**La situation de départ à Nanterre.** Nanterre ne reçoit aucun flux de Broadcast. Le rapprochement attendus / reçus se fait sur un tableur partagé avec les deux sous-traitants (depuis le 1ᵉʳ novembre 2025). La plateforme n'a aucune visibilité avant S-3 et reçoit les feuilles de route à la main, le lundi et le jeudi de S-1. Avec la montée en volume, cette situation n'est plus tenable : **sortir de la gestion Excel est le critère de priorité retenu par le métier.**

## 4. Règles métier à préserver

### A. Flux et anticipation

| Réf | Statut | Règle | Source |
|---|---|---|---|
| BUS-01 | Fermée | Nanterre reçoit les dossiers de vente Bus sans ressaisie, comme les autres plateformes. Données attendues : n° de dossier, client, format, DSP/réseau, centre bus, semaine de pose, quantités par centre bus. | 04c ; 02a |
| BUS-02 | Fermée | Affectation à la plateforme : le patrimoine des nouvelles DSP va à Nanterre ; les bus exploités par des sous-traitants ne relèvent d'aucune plateforme. Une convention n'étant jamais partagée entre un sous-traitant et Nanterre, ce critère est fiable. Il coexiste avec l'affectation géographique des autres supports. | 02e |
| BUS-03 | Fermée | Chacun des cinq formats Bus doit être identifié comme tel. L'identification repose sur la composition du patrimoine, pas sur des libellés concaténés et modifiables. Field Service dispose déjà d'une table de correspondance. | 02e |
| BUS-04 | Fermée | Visibilité sur l'état des réservations jusqu'à 6 semaines (au lieu de S-3 aujourd'hui), pour anticiper la charge, dimensionner les ressources et le roulement des racks. | 02b ; 04c |
| BUS-05 | Fermée | Les dossiers Bus suivent les mêmes étapes que les autres formats (à traiter, préparation, réception), avec un seul type de préparation : « collé ». Les équipes de Nanterre retrouvent leurs informations à un seul endroit. | 02e ; 04c |
| BUS-06 | Fermée | Ordre souhaité par le métier : **la réception d'abord** (savoir chaque semaine ce qui est reçu et sortir des tableurs échangés avec les partenaires), puis la préparation, puis l'état des réservations. | 02e |

### B. Réception et contrôle des affiches

| Réf | Statut | Règle | Source |
|---|---|---|---|
| BUS-07 | Existant | La livraison est rapprochée de son dossier grâce au n° de dossier de vente et à la semaine portés sur le BL. Les statuts attendu / reçu / manquant sont consultables par dossier et par centre bus. | 02a ; 04c |
| BUS-08 | Fermée | Si le BL ne porte pas le n° de dossier (souvent omis par l'imprimeur), la préproduction complète l'information sans bloquer la préparation. | 02c |
| BUS-09 | Fermée | À réception, le magasinier contrôle la quantité livrée, la fourniture de l'entretien et la correspondance des thèmes reçus avec les instructions de pose. | 02c |
| BUS-10 | Fermée | Délais : livraison au plus tard le vendredi S-2 ; réception au minimum 2 semaines avant la pose, idéalement 3. | 02a ; 02c ; 02d |
| BUS-11 | Fermée | Délai minimum technique de pose : 5 jours une fois l'ensemble des DSP repris. Les avants (vernis) demandent 48 h de plus en Dernière Minute. | 04a |
| BUS-12 | Existant | La NC ne se déclare que sur un défaut de conditionnement ou de format (ex. attendu 274×68, reçu 192×68), pas sur une absence de livraison. Les affiches livrées roulées sous 50 exemplaires sont admises par les CGV : elles sont tracées en NC sans bloquer la suite. | 02a ; 02b |
| BUS-13 | Fermée | Le magasinier photographie l'affiche non encollée. La photo est accessible à la préproduction et au commerce. *Le mode de stockage reste ouvert.* | 02c |
| BUS-14 | Ouverte | Enregistrement des caractéristiques issues du test de collage (tenue, allongement, massicotage), éventuellement en mobilité. Opportunité à confirmer. | 02c |
| BUS-15 | Ouverte | Quatre anomalies de réception doivent être repérables au niveau du dossier : affiches totalement manquantes, quantité reçue inférieure à l'attendu, retard sur le délai de réception, thème non conforme. | 04e |

### C. Préparation

| Réf | Statut | Règle | Source |
|---|---|---|---|
| BUS-16 | Fermée | Le destinataire de la préparation est le **centre bus**, pas la DSP (périmètre plus large). | 02e |
| BUS-17 | Fermée | **Fiche de préparation** : une seule feuille par centre bus et par semaine, avec contrat, annonceur, thème, format, quantité, avec ou sans entretien. S'y ajoutent une fiche de synthèse (quantités à préparer) et les étiquettes de dispatch. | 02e ; 02c |
| BUS-18 | Fermée | Si les thèmes d'une préparation déjà envoyée changent, les documents de préparation et les états de collage doivent suivre. | 02e |

### D. Ajustement des quantités — le besoin propre au Bus

| Réf | Statut | Règle | Source |
|---|---|---|---|
| BUS-19 | Fermée | La quantité de plaques à préparer doit pouvoir être ajustée **à la hausse ou à la baisse, par centre bus, par parc et par format**, jamais à la campagne ni au dossier. Le besoin est permanent. L'ajustement est strictement manuel : aucun calcul ni correction automatique. | 02e ; 02b ; 02d ; 04d |
| BUS-20 | Fermée | Seuls les profils habilités de la production ajustent. Chaque modification conserve l'auteur, la date, l'ancienne et la nouvelle valeur. La quantité vendue n'est jamais modifiée et reste consultable ; l'instruction de pose n'est pas touchée. | 04d |
| BUS-21 | Fermée | Cela suppose des données qui n'existent aujourd'hui ni dans Circé ni dans Broadcast : **réseaux et parcs** (A, B, puis des quarts de parc en 2027). | 02e |
| BUS-22 | Ouverte | **Où et quand ajuster.** Le process est à construire avec l'exploitation : à quel moment, sur quel objet, dans quel outil, sans double saisie avec Field Service (voir §5). Restent aussi à trancher : jusqu'à quand ajuster, la possibilité d'une quantité nulle, la réédition des documents déjà sortis. | 02e ; 04d |

### E. Livraison et suivi

| Réf | Statut | Règle | Source |
|---|---|---|---|
| BUS-23 | Fermée | Nanterre livre elle-même les centres bus : la liste des colis, l'expédition par transporteur et la zone de picking ne sont pas utiles pour le Bus. | 02e |
| BUS-24 | Fermée | Le suivi se fait sur la vente (bon de commande). Aucune campagne Bus n'est contrôlée par un audit externe. | 04a |
| BUS-25 | Fermée | Une vue condensée des réceptions : reçu / non reçu par semaine, avec les échéances. *Filtres à préciser.* | 02d ; 03 |

### F. Reste en place

| Réf | Statut | Règle | Source |
|---|---|---|---|
| BUS-26 | Ouverte | Quand un package Bus arrive à échéance sans être revendu, le poseur doit recevoir une instruction explicite : déposer la plaque ou la laisser. Aujourd'hui, c'est géré sur tableurs. **Les sources divergent** : sujet spécifique au Bus (atelier 1), aligné sur les autres supports et plafonné à 2 semaines (atelier 3), « non spécifique au Bus, à requalifier » (préproduction, 09/09). La règle et le tableau des cas sont attendus de l'exploitation. L'outil porteur n'est pas tranché. | 02a ; 02c ; 04a |

## 5. Choix liés aux outils actuels, réexaminables

Ces choix ont été faits en fonction de Circé, Broadcast et Field Service tels qu'ils existent. Ils expliquent le contenu des documents du dossier, mais ne s'imposent pas à une refonte. Le besoin métier en face de chaque choix, lui, reste valable.

| Choix actuel | Besoin métier à couvrir | Source |
|---|---|---|
| Adapter Circé (onglet Bus dédié) plutôt que créer un outil séparé. | Traiter le Bus comme les autres supports (BUS-05). | 03 ; 02e |
| Broadcast alimente en parallèle l'outil de production et Field Service ; aucun échange direct entre les deux. | La vente reste la référence des quantités et de l'instruction de pose (BUS-20, BUS-24). | 02d ; 03 |
| Le retour de pose se lit dans Field Service : tout est « réputé posé » le lendemain vers 4-5 h, sauf constat du poseur. | Suivi de la pose. | 02d |
| Pas d'alerte ni de notification dédiée. Le suivi repose sur l'état des réservations, le champ commentaire et un point hebdomadaire Nanterre (jeudi 11 h). Les alertes push, reconnues utiles par l'exploitation, avaient été reportées hors du premier lot. | Repérer les anomalies de réception (BUS-15) et le respect des délais (BUS-10). | 02a ; 02c ; 02d ; 03 |
| Pas de module de reporting : aménagement d'un écran existant. | Vue condensée des réceptions (BUS-25). | 02d ; 03 |
| Formulaire Dernière Minute sur Process Métiers, hors de l'outil de production. | Gérer les dérogations de délai (BUS-11). | 04a |
| Transmission dès validation du bon de commande, rattrapage quotidien à 6 h ; en cas d'échec, 3 essais puis mail à la préproduction. | Visibilité sans ressaisie (BUS-01, BUS-04). | 02a |
| Affectation à la plateforme par un traitement nocturne dans Broadcast. Tant que le patrimoine Bus n'a pas de plateforme, le dossier reste bloqué (pastille « préparation » grise). | Affectation par convention (BUS-02). | 02e |
| L'ajustement des quantités et l'état de collage final (pour colleurs, transporteurs et poseurs) sont faits aujourd'hui dans Field Service. | Ajustement par centre bus, parc et format (BUS-19 à BUS-22). | 02e |

## 6. Écartés par le métier

- Tracer une face de bout en bout, de la commande à la pose : le trou entre l'expédition et la pose est connu et accepté, comme sur les autres formats.
- Identifier les livraisons par QR code : écarté à cause du calage spécifique en impression et des systèmes différents selon les afficheurs.

## 7. Prérequis côté données

Quel que soit l'outil, la production dépend de la qualité des données de vente et de patrimoine dans Broadcast :

- **Rattachement du patrimoine Bus à sa plateforme** (BUS-02) : sans lui, aucun dossier Bus ne peut être préparé.
- **Dossier de vente test** : aucun dossier n'a encore pu être saisi sur le patrimoine Bus nouvellement modélisé. Ce test conditionne toute vérification de bout en bout.
- **Qualité du patrimoine** : bus articulés, centres bus, conventions. L'état de parc est fiable à environ 70 % pendant la reprise des DSP (échéance 1ᵉʳ novembre 2026).
- **Date de montage** : elle n'est jamais saisie à la main aujourd'hui et bloque la vente et la logistique. Elle doit devenir saisissable.

## 8. Points ouverts et détenteurs

| Sujet | Réf | Détenteur |
|---|---|---|
| Table de correspondance des formats (à reprendre de Field Service) | BUS-03 | Fabrice Planchard, Narimane Chekkar |
| Règle d'affectation par convention | BUS-02 | Fabrice Planchard, Narimane Chekkar |
| Dossier de vente test sur le nouveau patrimoine Bus | §7 | Narimane Chekkar |
| Process d'ajustement des quantités (moment, objet, outil) | BUS-22 | Philippe Le Calvé |
| Règle du reste en place et nouveaux cas | BUS-26 | Philippe Le Calvé, Dianaelle Pyrée |
| Repérage des anomalies de réception | BUS-15 | Préproduction, IT |
| Stockage des photos (piste OneDrive, à voir avec Wissous) | BUS-13 | Préproduction |
| Saisie des contrôles / mobilité | BUS-14 | Préproduction, Nanterre |

## 9. Contacts

- **Fabrice Planchard** — préproduction ; référent de la chaîne de production et validateur des règles.
- **Philippe Le Calvé** — directeur exploitation Bus Île-de-France.
- **Dianaelle Pyrée** — exploitation, plateforme de Nanterre.
- **Jovany Morelli** — plateforme de Nanterre.
- **Narimane Chekkar** — IT, paramétrage de la plateforme Nanterre et des flux depuis Broadcast.
- **Alexis Hodehou** — IT, responsable du chantier.

## 10. Sources

Les documents cités sont joints dans le dossier « Projet Bus V2 — livrables », qui en donne l'index :

- 01 : kick-off (26/05/2026)
- 02a à 02d : ateliers 1 à 4 (28/05 au 11/06/2026)
- 02e : atelier « Parcours d'un dossier bus, de Broadcast à Circé Nanterre » (21/09/2026)
- 03 : cahier des charges V2 (VF, 18/06/2026)
- 04a à 04f : backlog CIR V5, note P1, US CIR-01, CIR-02 et CIR-05, trame Field Service

Ces documents ont été écrits pour adapter Circé : ils décrivent souvent des écrans et des solutions propres à cet outil. Quand ils divergent de cette note, c'est la note qui est à jour.
