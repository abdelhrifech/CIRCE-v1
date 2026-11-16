# Legacy — Module ADMINISTRATION / AUTHENTIFICATION / PROFILS / MENUS (analyse de l'existant)

Périmètre : identification Windows/AD, profils (`tr_profil` / `prf_id`), droits de menu (`tr_utilisateur_menu`), périmètre plateforme/atelier (`tr_utilisateur_data`), écrans Admin* (Utilisateur, UtilisateurData, UtilisateurMenu, Plateforme, PlateformeMail, Equipe, Machine, Info, Contrat), PosteDeTravail / InfoPoste, menus, filtres globaux, mails par plateforme, rapports RDLC / impressions, batchs de mail et d'édition.
Méthode : lecture seule de `circe-develop/`. Aucune règle déduite des specs ou de la cible. « Absence de contrôle » = non trouvé dans le code lu.
Hors périmètre ici (déjà traités) : `AdminPreparationDeblocage` et `AdminSuiviDeblocage` (voir `legacy-coordination.md` RG-COO-080 à 085).

## Légende des chemins (préfixes)
- `W/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE/` (site MVC : Controllers, Views, JS, Helpers, Reports, Web.config, Global.asax)
- `BLL/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.BLL/`
- `REPO/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.Repositories/`
- `MODEL/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.Model/`
- `BATCH/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/`
- `SP/` = `circe-develop/BDD/DATABASE/DATABASE/dbo/Stored Procedures/`
- `TBL/` = `circe-develop/BDD/DATABASE/DATABASE/dbo/Tables/`

## Cartographie rapide
| Couche | Éléments |
|---|---|
| Démarrage / filtres | `W/Global.asax.cs`, `W/App_Start/FilterConfig.cs` (2 filtres globaux : `LogActionFilter`, `ExceptionFilter`), `W/Web.config` (`authentication mode="Windows"`, session InProc, ELMAH) |
| Identité | `W/Helpers/UserHelperNew.cs` (utilisée par le menu « nouveau », les contrôleurs Admin), `W/Helpers/UserHelper.cs` (ancienne, utilisée par `_Layout`, `ApplicationController`, ReportController) |
| Droits | `BLL/CommunBll.cs` (enum `Droits`, `EstAutorise`), `MODEL/UtilisateurMenuModel.cs` (enum restreint), `SP/p_s_listemenu.sql`, `REPO/RessourceRepository.cs` |
| Menus | `W/Views/Shared/_MenuNew.cshtml` (layout `_LayoutSansBoostrap`), `W/Views/Shared/_Menu.cshtml` (layout `_Layout`, par défaut via `_ViewStart.cshtml:2`) |
| Écrans Admin | contrôleurs `AdminUtilisateur`, `AdminUtilisateurData`, `AdminUtilisateurMenu`, `AdminPlateforme`, `AdminPlateformeMail`, `AdminEquipe`, `AdminMachine`, `AdminInfo`, `Administration` (GetAdminInfo), `AdminContrat`, `PosteDeTravail`, `InfoPoste`, `Test` |
| Rapports | `W/Reports/Rapport.cs` (génération PDF / impression directe), `ReportController`, 32 fichiers `.rdlc` dans `W/Reports/` (+ `EtiquetteBague.rdlc` racine et 2 dans `BatchEdition`) |
| Batchs | `BatchEnvoieMailColis` (mails colis), `BatchEdition` (squelette d'impression), `BacthCallZoom`, `BatchAlimPex*` (traités dans Réception/Coordination) |
| Tables | `tr_utilisateur`, `tr_profil`, `tr_utilisateur_menu`, `tr_utilisateur_data`, `tr_plateforme`, `tr_atelier`, `tr_adresseMail_plateforme`, `tr_atelier_imprimante`, `tr_poste`, `Equipe`, `Machine` |
| Triggers SQL | aucun dossier `Triggers` dans `BDD/` (non trouvé) |
| Jobs planifiés | aucun planificateur dans le dépôt (voir zones non analysées) |

---

# A. IDENTIFICATION ET SESSION

### RG-ADM-001 (provisoire) — Identité = compte Windows/AD fourni par IIS, aucun écran de login
- Description : l'utilisateur n'a ni écran de connexion ni mot de passe. Son identité est `HttpContext.Current.User.Identity.Name` mis en majuscules (format `DOMAINE\LOGIN`, domaines rencontrés dans le code : `CCI\`, `EU\`, `CITYZMEDIA\`). L'authentification est déléguée à IIS (`authentication mode="Windows"`), sans section `<authorization>`.
- Déclencheur : toute requête.
- Conditions : IIS doit avoir l'accès anonyme désactivé (configuration IIS non visible dans le dépôt).
- Effet : le login sert de clé dans `tr_utilisateur_data.loginWindows` et `tr_utilisateur_menu.loginWindows`. Ni l'existence dans `tr_utilisateur` ni l'appartenance à un groupe AD ne sont vérifiées pour accéder à l'application.
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `W/Web.config:93` ; `W/Helpers/UserHelperNew.cs:37-38` ; `W/Helpers/UserHelper.cs:23-30`.
- Confiance : CERTAINE pour le code ; PROBABLE pour l'absence d'accès anonyme (config IIS non lue).

### RG-ADM-002 (provisoire) — Login figé en compilation DEBUG
- Description : en compilation `DEBUG`, `UserHelperNew.Login` ignore l'identité réelle et retourne `CCI\PBOSS760` (ligne 34, `return` avant le code de repli). Des logins alternatifs sont laissés en commentaire (lignes 26-33). L'ancienne `UserHelper.UserLogin` n'a pas ce comportement : en DEBUG, le nom affiché (ancienne helper) et les droits (nouvelle helper) peuvent concerner deux personnes différentes.
- Déclencheur : toute requête sur un binaire compilé en DEBUG.
- Conditions : symbole `DEBUG` à la compilation (indépendant de `compilation debug="true"` du Web.config, présent partout).
- Effet : tous les utilisateurs prennent les droits et les plateformes de `CCI\PBOSS760`.
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `W/Helpers/UserHelperNew.cs:20-35` ; `W/Helpers/UserHelper.cs:31-33` ; `W/Web.config:95`.
- Confiance : CERTAINE (code). Le mode de compilation des déploiements réels est INCONNU.

### RG-ADM-003 (provisoire) — Login `UserHelper` vide si non authentifié ; `UserHelperNew` ne vérifie pas
- Description : `UserHelper.UserLogin` retourne `""` si `IsAuthenticated` est faux ; `UserHelperNew.Login` retourne `Identity.Name.ToUpper()` sans test (chaîne vide si anonyme). Un login vide ne correspond à aucune ligne : menus vides, listes de plateformes vides (voir RG-REC-001 : `FirstOrDefault().Value` plante).
- Déclencheur : requête sans identité.
- Conditions : accès anonyme autorisé côté IIS.
- Effet : application dégradée, pas de rejet explicite (pas de 401 applicatif).
- Statuts concernés : sans objet.
- Profils : n/a.
- Source : `W/Helpers/UserHelper.cs:21-41` ; `W/Helpers/UserHelperNew.cs:37-38`.
- Confiance : CERTAINE (code).

### RG-ADM-004 (provisoire) — Nom affiché de l'utilisateur : annuaire AD, mis en session
- Description : « Bienvenue <nom> » provient d'une recherche LDAP (`sAMAccountName`) sur `DC=cityzmedia,DC=local`, nom = « sn givenName », mis en session (`LoginName`). Si aucun résultat : chaîne vide. Le domaine est retiré (`Split('\\').Last()`). Le filtre LDAP est construit par `string.Format` sans échappement du login (login issu d'IIS, pas du client).
- Déclencheur : premier affichage d'une page de la session.
- Conditions : accès AD depuis le serveur web.
- Effet : texte d'en-tête ; aucune autre règle n'en dépend.
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `BLL/ToolBll.cs:210-240` ; `W/Helpers/UserHelperNew.cs:47-62` ; `W/Helpers/UserHelper.cs:48-64` ; `W/Web.config:33` ; `W/Views/Shared/_Layout.cshtml:110` ; `W/Views/Shared/_LayoutSansBoostrap.cshtml:60`.
- Confiance : CERTAINE.

### RG-ADM-005 (provisoire) — Lien caché vers l'écran de tests réservé à des logins codés en dur
- Description : le texte « Bienvenue <nom> » devient un lien vers `Test/Index` pour une liste de logins codée en dur. Layout ancien : `UserLogin.Contains(...)` avec `AWHEE050`, `SJAOE050`, `SFAGU050`, `DJEGO050`, `PSTEF050`, `SVIGU050`, `MSAMM050`, `VBOUR050` (recherche par sous-chaîne, donc tout domaine). Layout nouveau : égalité stricte avec `CITYZMEDIA\SFAGU050`, `CITYZMEDIA\YBENO050`, `CITYZMEDIA\MARIM050`. Ce n'est qu'un masquage de lien : le contrôleur `TestController` n'a aucun contrôle (voir RG-ADM-050).
- Déclencheur : rendu de l'en-tête.
- Conditions : login ∈ liste.
- Effet : lien visible.
- Statuts concernés : sans objet.
- Profils : 8 logins (ancien layout) / 3 logins (nouveau layout).
- Source : `W/Views/Shared/_Layout.cshtml:97-107` ; `W/Views/Shared/_LayoutSansBoostrap.cshtml:51-57`.
- Confiance : CERTAINE.

### RG-ADM-006 (provisoire) — Les plateformes de l'utilisateur sont chargées en session une seule fois, via la première ligne `tr_utilisateur_data`
- Description : `ApplicationController.OnActionExecuting` charge en session la plateforme utilisateur (`p_s_plateforme`) et la liste des formats de déroulants, à la première action (uniquement pour les contrôleurs héritant d'`ApplicationController`). `p_s_plateforme` ne retourne qu'une seule plateforme : `min(plt_id)` des lignes `tr_utilisateur_data` du login (en majuscules). Les contrôleurs Admin* n'héritent pas de `ApplicationController` (sauf `AdministrationController`, `PosteDeTravailController`, `TestController`).
- Déclencheur : première action de la session.
- Conditions : aucune ligne `tr_utilisateur_data` → aucune plateforme (SP retourne vide).
- Effet : session ; jamais rafraîchie tant que la session vit (InProc).
- Statuts concernés : sans objet.
- Profils : par utilisateur.
- Source : `W/Controllers/ApplicationController.cs:33-34,86-102` ; `SP/p_s_plateforme.sql:29-45` ; `REPO/UserRepository.cs:76-94` ; `W/Web.config:141`.
- Confiance : CERTAINE.

### RG-ADM-007 (provisoire) — Culture imposée par l'en-tête Accept-Language du navigateur
- Description : pour les contrôleurs héritant d'`ApplicationController`, la culture du thread est celle du premier `Accept-Language`. La culture par défaut globale est `fr-FR`. Peut changer formats de dates/nombres selon le poste.
- Déclencheur : toute action de ces contrôleurs.
- Conditions : `Request.UserLanguages != null`.
- Effet : formatage localisé ; `CreateSpecificCulture` lève une exception si la valeur n'est pas une culture valide (non gérée).
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `W/Controllers/ApplicationController.cs:22-32` ; `W/Web.config:89`.
- Confiance : CERTAINE.

---

# B. DROITS (« PROFILS ») ET PÉRIMÈTRE

## Constat structurant : il n'existe PAS de profil nommé fonctionnel dans l'exécution
Trois mécanismes distincts coexistent :
1. `tr_utilisateur.prf_id` → `tr_profil(prf_id, prf_lib)` : champ « profil » saisissable en administration, mais **sans effet à l'exécution** (RG-ADM-010).
2. `tr_utilisateur_menu(loginWindows, menu)` : les **droits** réels, chaînes libres (27 valeurs connues dans l'enum du code).
3. `tr_utilisateur_data(loginWindows, plt_id, ate_id)` : le **périmètre** plateforme/atelier réel.

### RG-ADM-010 (provisoire) — `prf_id` (profil) n'est lu par aucun traitement actif ; seule une procédure morte en dérive des règles
- Description : `tr_utilisateur.prf_id` est écrit à la création d'un utilisateur et affiché dans la grille (« Profile »). Les seuls consommateurs sont `p_s_listeAtelier` et `p_s_profilUser`, non appelées par le code C# (aucune référence dans `*.cs`, y compris l'import de fonctions EF). `p_s_listeAtelier` décrit trois types de profil : **1 = atelier** (un atelier, `ate_id` de l'utilisateur), **2 = plateforme** (toutes les plateformes de l'atelier de l'utilisateur), **3 = administrateur** (aucun filtre : tous les ateliers hors `ate_id = 0`). Les libellés `prf_lib` ne figurent dans aucun script du dépôt (pas de seed de `tr_profil`).
- Déclencheur : n/a (procédures non appelées).
- Conditions : `prf_id` 1, 2 ou autre/NULL.
- Effet : aucun à l'exécution. Bug visible dans la SP morte : jointure `u.ate_id = a.plt_id` (colonnes de natures différentes).
- Statuts concernés : sans objet.
- Profils : les valeurs 1/2/3 sont le seul « profil » documenté (en commentaire SQL), sans libellé officiel.
- Source : `SP/p_s_listeAtelier.sql:17-41` ; `SP/p_s_profilUser.sql:13-15` ; `TBL/tr_profil.sql:1-5` ; `TBL/tr_utilisateur.sql:1-11` ; absence d'appel : recherche `p_s_listeAtelier|p_s_profilUser` dans `*.cs` = 0 occurrence.
- Confiance : CERTAINE pour l'absence d'usage dans le dépôt ; INCERTAINE sur les libellés réels en base (données de `tr_profil` non fournies) et sur d'éventuels usages hors dépôt (états Reporting, Sybase).

### RG-ADM-011 (provisoire) — Un droit = une ligne `tr_utilisateur_menu` ; comparaison exacte de la chaîne
- Description : `EstAutorise(droit, login)` charge les lignes `tr_utilisateur_menu` du login (`loginWindows == user`) en session (`droitUtilisateur`), retire le `_` initial du nom d'enum (`_2m2_fixe` → `2m2_fixe`) et teste `droits.Any(x => x.menu == droitStr)`. La comparaison C# est sensible à la casse (ex. `Zone_Picking`, `Super_admin` en PascalCase en base). Le cache de session n'est jamais rafraîchi : un droit ajouté/retiré n'agit qu'à la session suivante (timeout par défaut ASP.NET, 20 min d'inactivité non surchargé).
- Déclencheur : rendu des menus/vues.
- Conditions : droits chargés au premier appel de la session.
- Effet : booléen d'affichage.
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `BLL/CommunBll.cs:276-303` ; `REPO/CommunRepository.cs:134-144` ; `W/Helpers/UserHelperNew.cs:70-80`.
- Confiance : CERTAINE.

### RG-ADM-012 (provisoire) — Deux mécanismes de lecture des droits (session vs requête à chaque appel)
- Description : l'ancien helper `UserHelper.IsAuthorised(menu)` appelle `p_s_listemenu` (login mis en majuscules côté SQL) à **chaque** appel, sans cache, et compare par `Equals` exact. Il sert à `_Menu.cshtml` (layout par défaut) et au droit `retirer` dans les écrans de préparation. `PreparationDeroulantBll.RecupDroit` utilise un troisième chemin (`p_s_listemenu` mis en cache dans le BLL) pour `train_changer_statut` et `train_regrouper`.
- Déclencheur : rendu des vues.
- Conditions : n/a.
- Effet : mêmes données, durées de vie de cache différentes (le menu ancien reflète un changement de droit immédiatement, le menu nouveau non).
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `W/Helpers/UserHelper.cs:91-104` ; `REPO/RessourceRepository.cs:61-71` ; `SP/p_s_listemenu.sql:19-28` ; `BLL/PreparationDeroulantBll.cs:187-204` ; `W/Controllers/PreparationDeroulants/PreparationDeroulantsController.cs:585-586`.
- Confiance : CERTAINE.

### RG-ADM-013 (provisoire) — Enum de droits du code (27) ≠ enum proposé à l'administrateur (21)
- Description : `CommunBll.Droits` compte 27 valeurs ; la liste déroulante de l'écran « Admin utilisateur menu » n'en propose que 21 (`UtilisateurMenuModel.Droits`). **Non attribuables via l'écran** : `Super_admin`, `Zone_Picking`, `Activite_Production`, `expedition_ext`, `duplication_train`, `fusion_affiche`. Elles ne peuvent être posées que par SQL direct.
- Déclencheur : ouverture du dialogue d'ajout d'un droit.
- Conditions : n/a.
- Effet : écart entre droits utilisés et droits administrables.
- Statuts concernés : sans objet.
- Profils : `Super_admin`.
- Source : `BLL/CommunBll.cs:31-40` ; `MODEL/UtilisateurMenuModel.cs:12-19` ; `BLL/AdminUtilisateurMenuBll.cs:33-46`.
- Confiance : CERTAINE.

### RG-ADM-014 (provisoire) — Droits `_2m2_fixe` et `_2m2_fixe_a_traiter` mal enregistrés par l'écran
- Description : l'écran enregistre `Value = i.ToString()` du nom d'enum, soit `_2m2_fixe` et `_2m2_fixe_a_traiter` (avec underscore initial). `EstAutorise` cherche `2m2_fixe` (underscore retiré). Une ligne créée par l'écran ne donne donc pas le droit ; il faut insérer `2m2_fixe` en SQL. Le commentaire du code (« todo changer les droits pour qu'il ne commence pas par un chiffre ») confirme que le point est connu.
- Déclencheur : ajout d'un droit via l'écran.
- Conditions : droit choisi parmi ces deux valeurs.
- Effet : droit inopérant sans erreur visible.
- Statuts concernés : sans objet.
- Profils : `Super_admin`.
- Source : `BLL/AdminUtilisateurMenuBll.cs:39-43` ; `BLL/CommunBll.cs:295-298` ; `W/Views/AdminUtilisateurMenu/Partial/AjouterUserMenu.cshtml:12`. L'ancien menu `_Menu.cshtml:15-25` cherche `"2m2_fixe"` (sans underscore).
- Confiance : PROBABLE (déduit du code ; non vérifié sur les données réelles).

### RG-ADM-015 (provisoire) — Aucun contrôle serveur des droits : aucun `[Authorize]`, aucun appel à `EstAutorise` dans les contrôleurs, aucun jeton anti-CSRF
- Description : les seuls filtres globaux sont `LogActionFilter` (journalisation de temps/actions) et `ExceptionFilter` (journal d'erreur). Recherche exhaustive dans le dépôt : `[Authorize]`, `AllowAnonymous`, `ValidateAntiForgeryToken` = 0 occurrence. Les appels à `EstAutorise`/`IsAuthorised` sont uniquement dans des vues (`.cshtml`) et le BLL de préparation (calcul de booléens renvoyés à l'écran). N'importe quel utilisateur authentifié par IIS peut appeler directement les URL d'administration (créer des droits, se donner `Super_admin`, supprimer des utilisateurs, modifier plateformes/mails, déclencher une relance de dossier) et les actions de Réception/Coordination. **Confirme et fait passer en CERTAINE** les points RG-REC-121 et RG-COO-090 (filtres globaux vérifiés).
- Déclencheur : toute requête HTTP.
- Conditions : être authentifié dans IIS.
- Effet : escalade de privilèges triviale (POST `AdminUtilisateurMenu/Validation_Ajout` avec `menu=admin`).
- Statuts concernés : tous.
- Profils : tous.
- Source : `W/App_Start/FilterConfig.cs:11-12` ; `W/Global.asax.cs:15-20` ; `W/Controllers/AdminUtilisateurMenuController.cs:50-65` ; recherche `\[Authorize|AllowAnonymous|ValidateAntiForgeryToken` dans `*.cs`/`*.cshtml` = 0.
- Confiance : CERTAINE.

### RG-ADM-016 (provisoire) — Périmètre plateforme/atelier : `tr_utilisateur_data`, appliqué par les procédures de lecture
- Description : les listes d'ateliers (`p_s_atelier`, `p_s_atelierScro`) joignent `tr_utilisateur_data` sur le login (en majuscules) ; `p_s_atelierScro` ne retient que les ateliers `ate_id IN (5,6,7,8,11,12)` (identifiants codés en dur = ateliers déroulants/scrolling). `p_s_plateforme` retient la plus petite `plt_id`. Le filtrage est donc fait en lecture ; aucune écriture ne revérifie que la plateforme/atelier reçus du client appartiennent à l'utilisateur (voir RG-REC-001).
- Déclencheur : ouverture des écrans Réception, Coordination, Suivi.
- Conditions : lignes `tr_utilisateur_data` du login (le login saisi à l'administration n'est pas converti en majuscules ; la correspondance repose sur la collation SQL).
- Effet : restriction des listes.
- Statuts concernés : sans objet.
- Profils : par utilisateur.
- Source : `SP/p_s_atelier.sql:8,15-22` ; `SP/p_s_atelierScro.sql:9,15-24` ; `SP/p_s_plateforme.sql:29-45` ; `BLL/CommunBll.cs:92-115`.
- Confiance : CERTAINE pour les procédures ; INCERTAINE sur la casse (collation de la base non visible dans les fichiers lus).

### RG-ADM-017 (provisoire) — Énumération des plateformes codée en dur
- Description : `PlateformeEnum { Wissous = 1, Nime, DBG, DBGLyon }` (valeurs 1 à 4) et une table de conversion code → ville (« Nîmes »…) dans `ToolBll`.
- Déclencheur : traitements qui convertissent un identifiant de plateforme.
- Conditions : id ∈ 1..4.
- Effet : libellés/branches spécifiques par plateforme.
- Statuts concernés : sans objet.
- Profils : n/a.
- Source : `BLL/CommunBll.cs:26` ; `BLL/ToolBll.cs:370-385`.
- Confiance : PROBABLE (le contexte complet de `ToolBll.cs:360-385` n'a été lu que partiellement).

---

# C. MENUS ET NAVIGATION

### RG-ADM-020 (provisoire) — Deux menus selon le layout de la page
- Description : le menu affiché dépend du layout de la vue. Layout par défaut (`_ViewStart.cshtml`) = `_Layout` → `_Menu.cshtml` (ancien, incomplet). 50 vues déclarent `_LayoutSansBoostrap` → `_MenuNew.cshtml` (complet). Les 22 vues restantes sans layout explicite héritent de l'ancien menu. L'ancien menu ne propose pas : Bus, Zone picking, Fusion des affiches, Expedition ext, Analyse Production, Etat de destruction, Dupliquer train, Plateforme/PlateformeMail, Activité (Equipe/Machine), « Utilisateur Admin ». Un même utilisateur voit donc un menu différent d'une page à l'autre.
- Déclencheur : rendu de chaque page.
- Conditions : layout de la vue.
- Effet : navigation incohérente (les écrans Admin* utilisent tous `_LayoutSansBoostrap`).
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `W/Views/_ViewStart.cshtml:2` ; `W/Views/Shared/_Layout.cshtml:119` ; `W/Views/Shared/_LayoutSansBoostrap.cshtml:64` ; `W/Views/Shared/_Menu.cshtml:85-146` ; `W/Views/Shared/_MenuNew.cshtml:7-228`.
- Confiance : CERTAINE.

### RG-ADM-021 (provisoire) — Visibilité du menu « Administration » : le droit `Super_admin` seul ne suffit pas
- Description : le groupe « Administration » n'est affiché que si l'utilisateur a au moins un parmi `debloque_repart`, `view_repart`, `admin`, `referentiel`, `train_rafraichir_contrat`. Le sous-menu « Utilisateur Admin » (droit `Super_admin`) est **à l'intérieur** de ce groupe ; `Super_admin` seul, ou `duplication_train` seul, ne rend donc ni le groupe ni les écrans accessibles par le menu. Un super-administrateur doit cumuler un autre de ces cinq droits (ou saisir l'URL).
- Déclencheur : rendu du menu.
- Conditions : voir description.
- Effet : masquage.
- Statuts concernés : sans objet.
- Profils : `Super_admin` (en pratique cumulé avec `admin`).
- Source : `W/Views/Shared/_MenuNew.cshtml:155-160,212-222`.
- Confiance : CERTAINE.

### RG-ADM-022 (provisoire) — Correspondance menu ↔ droit (menu complet `_MenuNew`)
Voir la matrice §« Matrice droit × page » en fin de document. Points particuliers :
- le groupe « Trains » est visible avec `pliage` OU `pliage_a_traiter` OU `train_suivi_theme` OU `train_preparation`, mais « Liste des colis » est dupliqué sous « 2m² fixe » (droit `_2m2_fixe`), « Pliage » (droit `pliage`) et « Trains » (droit `train_preparation`) ;
- le menu Bus exige en plus le feature flag ConfigCat `busv3` (valeur par défaut `false` si clé SDK absente ou erreur de service) ;
- « Réception » : `Zone picking` et `Fusion des affiches` exigent en plus leur propre droit ; « Suivi » : `Analyse Production` exige `Activite_Production` ;
- le droit `suivi_suivi_production` donne aussi « Etat de destruction » et « Etat des réservations ».
- Source : `W/Views/Shared/_MenuNew.cshtml:11-226` ; `BLL/CommunBll.cs:31-40` ; `ClearChannel.CIRCE.Tools/Helper/FeatureFlagHelper.cs:19-44,77-80`.
- Confiance : CERTAINE.

### RG-ADM-023 (provisoire) — Les droits sont des tests d'affichage seulement (menu et boutons)
- Description : le droit n'agit que sur la présence de liens/boutons. Autres usages dans les vues : `retirer` (bouton « Confirmer Retirer » en Préparation 2m² fixe, Pliage, Bus), `Zone_Picking` (case dans le détail affiche et dans l'écran Zone picking), `Activite_Production` (boutons des écrans Zone picking et Suivi de production), `validation_admin`, `fusion_affiche` (en liste « À traiter » seulement), `train_regrouper`, `train_debloquer_semaine`, `train_changer_statut`. `train_annuler_theme` n'a aucun usage retrouvé dans les vues.
- Source : `W/Views/ZonePicking/Index.cshtml:91,98` ; `W/Views/SuiviSuiviProduction/Index.cshtml:21` ; `W/Views/ReceptionListeAffiche/Index.cshtml:99,117` ; `W/Views/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:24,256` ; `W/Views/Shared/DetailAffiche/Partial/Partial_GridAssoc_prepa_affiche.cshtml:42` ; `W/Views/TrainSuiviTheme/Index.cshtml:91,105,143` ; `W/Views/TrainPreparation/Index.cshtml:78` ; `W/Views/Preparation/Preparation2m2Fixe.cshtml:139` ; `W/Views/_2m2FixePreparation/Index.cshtml:147` ; `W/Views/PreparationPliage/Pliage.cshtml:115` ; `W/Views/BusPreparation/BusPreparation.cshtml:139`.
- Confiance : CERTAINE.

---

# D. ADMINISTRATION DES UTILISATEURS (écrans « Utilisateur Admin »)

Les trois écrans sont des grilles Kendo (lecture Ajax) avec un dialogue d'ajout et une suppression avec confirmation navigateur. **Il n'existe aucune modification** (pas d'édition d'un profil, d'un atelier ou d'un droit : supprimer puis recréer). Aucune historisation (`histo_historique_entite` non alimentée), aucun journal de qui a changé quoi.

### RG-ADM-030 (provisoire) — Création d'un utilisateur (`tr_utilisateur`) : profil + atelier + login, login unique sans casse
- Description : le dialogue demande profil (liste `tr_profil`), atelier (liste complète `tr_atelier`, toutes plateformes) et login. Validation serveur : (1) login déjà présent (comparaison `ToUpper()` des deux côtés) → message « le loginWindows existe dèja » ; (2) login vide → « Il faut vérifier le loginWindows saisi ». Les messages ne sont pas exclusifs (les deux peuvent être ajoutés). Le front n'a aucun contrôle (pas de champ requis, pas de format `DOMAINE\LOGIN`) et affiche le premier message d'erreur de chaque champ en `alert`. Pas de contrôle d'existence du login dans l'AD. Le login est enregistré tel que saisi (pas de mise en majuscules). Atelier et profil non vérifiés côté serveur (clés étrangères SQL seulement).
- Déclencheur : bouton « + » (grille) → « Enregistrer ».
- Conditions : voir description.
- Effet : insertion `tr_utilisateur(loginWindows, ate_id, prf_id)`.
- Statuts concernés : (inexistant) → utilisateur créé.
- Profils : en principe `Super_admin` (menu) ; non vérifié côté serveur (RG-ADM-015).
- Source : `W/Controllers/AdminUtilisateurController.cs:40-66,76-99` ; `BLL/AdminUtilisateurBll.cs:60-76` ; `REPO/AdminUtilisateurRepository.cs:50-63` ; `W/JS/AdminUtilisateur.js:62-95` ; `W/Views/AdminUtilisateur/Partial/AjouterUser.cshtml:7-29` ; `TBL/tr_utilisateur.sql:1-11`.
- Confiance : CERTAINE.

### RG-ADM-031 (provisoire) — Suppression d'un utilisateur sans cascade ni garde
- Description : `Supprimer(loginWindows)` supprime la ligne `tr_utilisateur` sans toucher à `tr_utilisateur_data` ni `tr_utilisateur_menu` (pas de clé étrangère entre elles). L'utilisateur supprimé conserve donc accès et droits. Si le login est introuvable, `Remove(null)` lève une exception (non gérée côté serveur ; le front affiche l'erreur Ajax). On peut supprimer son propre compte ou le dernier `Super_admin`. Message front : « Confirmez-vous la suppression de l'utilisateur ? » puis « l'utilisateur a été supprimé avec succès ».
- Déclencheur : bouton « − » de la ligne.
- Conditions : confirmation navigateur.
- Effet : suppression physique.
- Statuts concernés : utilisateur créé → supprimé (définitif).
- Profils : voir RG-ADM-015.
- Source : `W/Controllers/AdminUtilisateurController.cs:68-74` ; `BLL/AdminUtilisateurBll.cs:78-83` ; `REPO/AdminUtilisateurRepository.cs:71-75` ; `W/JS/AdminUtilisateur.js:43-60`.
- Confiance : CERTAINE.

### RG-ADM-032 (provisoire) — Lecture de la liste des utilisateurs plante si profil ou atelier est NULL
- Description : `ate_id` et `prf_id` sont nullables en base mais la liste fait `x.ate_id.Value`, `x.prf_id.Value`, `x.tr_atelier.ate_lib`, `x.tr_profil.prf_lib` sans test : un utilisateur sans profil ou sans atelier fait échouer toute la grille. Les logins sont affichés avec `\` doublés (`Replace("\\","\\\\")`) pour le gabarit JavaScript du bouton Supprimer.
- Déclencheur : ouverture de l'écran « Admin utilisateur ».
- Conditions : au moins une ligne avec `ate_id` ou `prf_id` NULL.
- Effet : erreur sur la grille (`gridErreur`).
- Statuts concernés : sans objet.
- Profils : n/a.
- Source : `BLL/AdminUtilisateurBll.cs:22-34` ; `TBL/tr_utilisateur.sql:3-4`.
- Confiance : CERTAINE.

### RG-ADM-033 (provisoire) — Création d'un périmètre (`tr_utilisateur_data`) : un utilisateur a N lignes plateforme/atelier ; contrôle de doublon exact seulement
- Description : le dialogue propose une plateforme (toutes) et un atelier ; à l'ouverture la liste d'ateliers est celle de la plateforme `plt_id = 1` (codé en dur), puis rechargée au changement de plateforme par l'appel `AnalyseProduction/GetAteliersByPlt_id`. Validation serveur : le triplet (login, plateforme, atelier) existe déjà → « le loginWindows existe dèja » ; login vide → « Il faut vérifier le loginWindows saisi ». Les contrôles « plateforme vide » et « atelier vide » sont inopérants (`plt_id`/`ate_id` sont des entiers non nullables : `ToString()` n'est jamais vide). **Aucun contrôle que l'atelier appartient à la plateforme choisie** (le couple est libre), aucun contrôle que le login existe dans `tr_utilisateur`. Comparaison du login sensible à la collation (pas de `ToUpper`, contrairement à `tr_utilisateur`).
- Déclencheur : « + » → « Enregistrer » sur « Admin utilisateur data ».
- Conditions : voir description.
- Effet : insertion `tr_utilisateur_data(loginWindows, plt_id, ate_id)`.
- Statuts concernés : (inexistant) → périmètre créé.
- Profils : voir RG-ADM-015.
- Source : `W/Controllers/AdminUtilisateurDataController.cs:39-65,77-107` ; `BLL/AdminUtilisateurDataBll.cs:59-81` ; `REPO/AdminUtilisateurDataRepository.cs:29-65` ; `W/JS/AdminUtilisateurData.js:62-111` ; `TBL/tr_utilisateur_data.sql:1-8`.
- Confiance : CERTAINE.

### RG-ADM-034 (provisoire) — Suppression d'un périmètre : sans garde, exception si la ligne n'existe plus
- Description : `Supprimer(login, plt_id, ate_id)` retrouve la ligne exacte et la supprime ; si absente, `Remove(null)` lève une exception. Aucune vérification qu'il reste au moins un périmètre à l'utilisateur (ce qui ferait planter les écrans Réception, RG-REC-001).
- Déclencheur : bouton « − ».
- Conditions : confirmation « Confirmez-vous la suppression de l'utilisateur_data ? ».
- Effet : suppression physique.
- Statuts concernés : périmètre actif → supprimé.
- Profils : voir RG-ADM-015.
- Source : `W/Controllers/AdminUtilisateurDataController.cs:67-75` ; `REPO/AdminUtilisateurDataRepository.cs:67-73` ; `W/JS/AdminUtilisateurData.js:44-60`.
- Confiance : CERTAINE.

### RG-ADM-035 (provisoire) — Attribution d'un droit (`tr_utilisateur_menu`) : doublon refusé, aucun contrôle de cohérence
- Description : validation serveur : couple (login, menu) déjà présent → message « le loginWindows existe dèja » (même texte que pour les autres écrans, trompeur : c'est le couple qui existe) ; login vide → « Il faut vérifier le loginWindows saisi » ; `model.menu.ToString()` lève une `NullReferenceException` si `menu` est nul (appel direct). Pas de contrôle que le login existe, pas de contrôle de cohérence (ex. `Super_admin` accordé sans `admin`), pas de vérification que la valeur de `menu` appartient à l'enum (champ texte libre côté serveur, `varchar(50)`). Valeurs proposées : voir RG-ADM-013/014.
- Déclencheur : « + » → « Enregistrer » sur « Admin utilisateur menu ».
- Conditions : voir description.
- Effet : insertion `tr_utilisateur_menu(loginWindows, menu)`.
- Statuts concernés : droit absent → droit accordé (effectif à la session suivante de l'intéressé, RG-ADM-011).
- Profils : voir RG-ADM-015.
- Source : `W/Controllers/AdminUtilisateurMenuController.cs:40-94` ; `BLL/AdminUtilisateurMenuBll.cs:48-69` ; `REPO/AdminUtilisateurMenuRepository.cs:29-44` ; `W/JS/AdminUtilisateurMenu.js:61-93` ; `TBL/tr_utilisateur_menu.sql:1-5`.
- Confiance : CERTAINE.

### RG-ADM-036 (provisoire) — Retrait d'un droit : sans garde, exception si absent ; libellé de confirmation erroné
- Description : `Supprimer(login, menu)` supprime la ligne. Le message de confirmation front est « Confirmez-vous la suppression de l'utilisateur_data ? » (copier-coller). Le retrait n'agit qu'à la prochaine session de l'utilisateur (cache de session) sauf sur les écrans de l'ancien menu.
- Déclencheur : bouton « − ».
- Conditions : confirmation navigateur.
- Effet : suppression physique.
- Statuts concernés : droit accordé → retiré.
- Profils : voir RG-ADM-015.
- Source : `W/Controllers/AdminUtilisateurMenuController.cs:96-104` ; `REPO/AdminUtilisateurMenuRepository.cs:46-51` ; `W/JS/AdminUtilisateurMenu.js:43-59`.
- Confiance : CERTAINE.

### RG-ADM-037 (provisoire) — Unicité du login et nettoyage historique des doublons
- Description : `tr_utilisateur.loginWindows` est clé primaire (non nulle). Un script de reprise supprime un doublon de login (`delete top(1)`) puis ajoute la clé primaire : les doublons ont existé avant la contrainte.
- Déclencheur : script ponctuel.
- Conditions : n/a.
- Effet : contrainte d'unicité.
- Statuts concernés : sans objet.
- Profils : n/a.
- Source : `circe-develop/BDD/DATA/ScriptDeleteDoublonsAndAddPrimaryKey_Table_tr_utilisateur.sql:4-21` ; `TBL/tr_utilisateur.sql:5-8`.
- Confiance : CERTAINE.

---

# E. PLATEFORMES, MAILS PAR PLATEFORME, IMPRIMANTES

### RG-ADM-040 (provisoire) — Écran « Plateforme » : édition en ligne des coordonnées et d'une imprimante ; un POST sur une ligne crée une imprimante si l'id n'existe pas
- Description : la grille liste chaque plateforme × chaque imprimante (jointure gauche : une ligne vide `Id=0`, `NomImprimante=""` pour une plateforme sans imprimante). Édition en ligne : nom, adresses 1 et 2, code postal, localité, téléphone, mail(s), nom d'imprimante. `Update` modifie `tr_plateforme` (y compris `plt_nom`, `plt_dat_maj = now`) puis, si l'id d'imprimante reçu n'existe pas (cas `Id=0` ou id inconnu), **insère** une nouvelle ligne `tr_atelier_imprimante` (même avec un nom d'imprimante vide). Aucune suppression d'imprimante n'est possible (action `Delete` déclarée dans la grille mais sans méthode `Delete` sur le contrôleur, et pas de bouton). `AjouterPlateforme` construit un objet sans l'enregistrer (code mort). Validation : `ModelState.IsValid` uniquement (aucune annotation connue : longueurs `plt_postal` 5, `plt_tel` 14 non contrôlées → erreur SQL de troncature). Le champ mail est un texte libre (500 car.) ; l'affichage remplace `,` par `,\n`.
- Déclencheur : « Edit » → « Update » sur la ligne.
- Conditions : `ModelState.IsValid`.
- Effet : `UPDATE tr_plateforme` + `UPDATE` ou `INSERT tr_atelier_imprimante`. Effet de bord : les `plt_nom` sont utilisés partout (listes, mails de réception).
- Statuts concernés : sans objet.
- Profils : droit `admin` (menu) ; non vérifié côté serveur.
- Source : `W/Controllers/AdminPlateformeController.cs:24-35` ; `BLL/AdminPlateformeBll.cs:14-63` ; `REPO/AdminPlateformeRepository.cs:22-78` ; `W/Views/AdminPlateforme/Index.cshtml:11-40` ; `TBL/tr_plateforme.sql:1-15` ; `TBL/tr_atelier_imprimante.sql:1-7`.
- Confiance : CERTAINE (code) ; PROBABLE pour les annotations de validation (modèle `AdminPlateformeModel` non lu).

### RG-ADM-041 (provisoire) — Imprimantes d'une plateforme = cibles de l'impression directe de l'étiquette rack
- Description : à l'envoi d'une réception (« Envoyé »), le contrôleur lit les noms d'imprimantes de la plateforme (`tr_atelier_imprimante`) et n'imprime que s'il en existe au moins un non vide ; l'étiquette est alors imprimée sur **chaque** imprimante (Windows, serveur web). Voir RG-ADM-060.
- Déclencheur : action d'envoi/validation depuis la liste des affiches.
- Conditions : ≥ 1 nom d'imprimante non vide pour `model.plt_id`.
- Effet : impression directe côté serveur ; aucune imprimante → aucune impression, aucune alerte.
- Statuts concernés : sans objet.
- Profils : tous les utilisateurs de l'écran.
- Source : `W/Controllers/ReceptionListeAfficheController.cs:455-465` ; `BLL/AdminPlateformeBll.cs:65-69` ; `W/Reports/Rapport.cs:1021-1024`.
- Confiance : CERTAINE.

### RG-ADM-042 (provisoire) — Mails de réception par plateforme : table `tr_adresseMail_plateforme`, aucune validation
- Description : l'écran « Plateforme Mail » affiche **uniquement les plateformes du login** (`tr_utilisateur_data`, comparaison sans `ToUpper`) avec un champ de saisie et la liste des adresses. Ajout : `plt_id` + texte → insertion `(plt_id, adresseMail, user_creation = login, date_creation = now)`. Aucun contrôle côté front ni back : adresse vide, sans `@`, doublon, plus de 50 caractères (`varchar(50)` → erreur SQL). Suppression : par `Id` sans contrôle d'appartenance à la plateforme postée (le `plt_id` posté ne sert qu'au réaffichage) ; si l'id n'existe pas, `Remove(null)` lève une exception. Aucune confirmation avant suppression. Si une plateforme référencée dans `tr_utilisateur_data` n'existe plus, `RecupDataPlateforme` ajoute `null` à la liste.
- Déclencheur : icône « + » / suppression d'une adresse.
- Conditions : l'utilisateur doit avoir au moins une ligne `tr_utilisateur_data` pour voir/modifier une plateforme.
- Effet : insertion / suppression physique.
- Statuts concernés : adresse absente → présente → supprimée.
- Profils : droit `admin` (menu) ; non vérifié côté serveur.
- Source : `W/Controllers/AdminPlateformeMailController.cs:15,26-49` ; `BLL/AdminPlateformeMailBll.cs:20-54` ; `REPO/AdminPlateformeMailRepository.cs:32-74` ; `W/JS/AdminPlateformeMail.js:1-30` ; `TBL/tr_adresseMail_plateforme.sql:1-14`.
- Confiance : CERTAINE.

### RG-ADM-043 (provisoire) — Mail « réception d'affiches » : destinataires = adresses de la plateforme de la première affiche de la livraison
- Description : à la création d'une livraison, un mail HTML est envoyé aux adresses de `tr_adresseMail_plateforme` de la plateforme de la **première** affiche de la livraison (`plt_id` pris sur la première ligne). Le corps liste, groupé par format : plateforme, dossier, annonceur, thème, format, départ (`S<sem>/<année>` si lignes de préparation, sinon date de création de l'affiche), quantité. Envoi en thread d'arrière-plan : un nouveau thread n'est lancé que si le précédent est terminé (`MemoryCache`, clé `ThreadBackgroundSendMail`) → **des mails sont perdus si deux réceptions sont validées pendant l'envoi du précédent**. Pour la livraison orpheline, l'envoi est synchrone. Toute exception SMTP est avalée (`catch {}`) : aucune trace, aucun statut « mail envoyé ». Aucun destinataire → `Send` lève une exception avalée. Hors production, l'objet est préfixé par le nom d'environnement ; le corps contient « sur l'environnement {env} » y compris en production, car `message.Body` est réécrit avec `string.Format(body, Environnement)` après le choix prod/non-prod.
- Déclencheur : création d'une livraison (Réception des affiches).
- Conditions : appel ligne 223 (`livraison.Id <= 0`) ou orpheline (ligne 287).
- Effet : envoi SMTP via `System.Net.Mail` (config `system.net/mailSettings`, expéditeur `exploit@clearChannel.fr`).
- Statuts concernés : sans objet.
- Profils : n/a.
- Source : `W/Controllers/LivraisonAfficheController.cs:221-249,287-291` ; `BLL/LivraisonAfficheService.cs:930-939` ; `BLL/ToolBll.cs:391-456` ; `W/Web.config:255-261`.
- Confiance : CERTAINE.

### RG-ADM-044 (provisoire) — Deux sources de mails par plateforme, non synchronisées
- Description : `tr_adresseMail_plateforme` (liste, écran « Plateforme Mail ») sert le mail de réception ; `tr_plateforme.plt_mail` (texte libre ≤ 500 car., liste séparée par des virgules, écran « Plateforme ») sert le mail de déblocage de préparation, retrouvé par `id_site_ccf` (`FirstOrDefault`). Aucun écran ne gère `id_site_ccf`. Les deux champs peuvent diverger.
- Déclencheur : déblocage de préparation (plt_mail) / réception (liste).
- Conditions : n/a.
- Effet : destinataires différents selon le mail.
- Statuts concernés : sans objet.
- Profils : n/a.
- Source : `REPO/AdminPreparationDeblocageRepository.cs:84-94` ; `REPO/AdminPlateformeMailRepository.cs:20-26` ; `TBL/tr_plateforme.sql:12-13`. Voir RG-COO-084.
- Confiance : CERTAINE.

### RG-ADM-045 (provisoire) — Batch « mail colis » : un mail par manager CCF (interne) ou par tiers (externe), marquage « envoyé » seulement si SMTP OK
- Description : le batch lit les colis à notifier (`GetGlobalColis`), les ressources dans la base Broadcast (EXTPLAY), classe chaque colis interne/externe selon la ressource de l'afficheur (`PersId`) et groupe : interne → par manager CCF, externe → par (tiers, manager). Mail HTML avec tableau (colis, quantité trains/rouleaux, quantité affiches) et pièce jointe Excel `DetailsColis_jj_MM_aaaa.xls` (onglets « Fixe » et « Scrolling » séparés par `EstTrain`). Destinataire : interne = manager CCF ; externe = adresse du tiers avec le manager en copie. Pas de pièce jointe (aucun détail) → pas de mail. Réessais : 10 tentatives espacées de 10 s. Colis marqués envoyés (`UpdateSendColis`) uniquement pour les mails réussis ; `UpdateParametrePackage` est ensuite appelé. Un colis dont l'afficheur n'a pas de ressource obtient `EstInterne` nul : il n'est ni interne ni externe (jamais notifié, jamais alerté). Expéditeur `ClearChannel <admin_playext@clearchannel.fr>`.
- Déclencheur : exécution planifiée du batch (planificateur non visible).
- Conditions : colis à notifier ; ressource et adresses non nulles.
- Effet : envois SMTP port 25, identifiants Windows par défaut ; mise à jour des colis.
- Statuts concernés : colis « à notifier » → « notifié » (colonne gérée par `UpdateSendColis`, non lue).
- Profils : compte de service du batch.
- Source : `BATCH/ClearChannel.CIRCE.BatchEnvoieMailColis/Program.cs:13-31` ; `BLL/BatchEnvoieMailColisBll.cs:33-92,148-181,188-232,236-267`.
- Confiance : CERTAINE pour le déroulé ; INCERTAINE pour la colonne/état exact marqué (`BatchEnvoieMailColisRepository` non lu).

---

# F. RÉFÉRENTIELS D'ACTIVITÉ ET POSTES

### RG-ADM-046 (provisoire) — Équipes et machines : CRUD par plateforme, libellé obligatoire, suppression physique sans contrôle d'usage
- Description : écrans « Admin Equipe » et « Admin Machine » (menu Administration › Activité, droit `referentiel`). Création/modification : le seul contrôle (serveur) est le libellé non vide (« Il faut vérifier le libelle saisi ») ; plateforme choisie dans la liste complète (toutes plateformes, sans filtre sur l'utilisateur) ; aucun contrôle d'unicité du libellé par plateforme. Traçabilité : `QuiCreation`/`DateCreation`, `QuiModification`/`DateModification` (colonnes `varchar(20)` : un login de plus de 20 caractères, par ex. `CITYZMEDIA\...` long, provoque une erreur SQL). Suppression : `Remove` sans vérifier l'usage (`mouvement.IdActivite`, activités) → violation de clé étrangère possible, ou perte de référentiel ; si l'id n'existe pas, `Remove(null)` lève une exception.
- Déclencheur : boutons Ajouter / Modifier / Supprimer.
- Conditions : libellé non vide.
- Effet : écriture `Equipe` / `Machine`.
- Statuts concernés : sans objet.
- Profils : droit `referentiel` (menu) ; non vérifié côté serveur.
- Source : `W/Controllers/AdminEquipeController.cs:49-110` ; `W/Controllers/AdminMachineController.cs:48-108` ; `BLL/AdminEquipeBll.cs:46-73` ; `BLL/AdminMachineBll.cs:46-74` ; `REPO/AdminEquipeRepository.cs:39-71` ; `REPO/AdminMachineRepository.cs:39-71` ; `TBL/Equipe.sql:1-14` ; `TBL/Machine.sql:1-13` ; `W/JS/AdminMachine.js:49-65,75-100`.
- Confiance : CERTAINE.

### RG-ADM-047 (provisoire) — Postes de travail : référentiel poste ↔ plateforme/atelier/imprimante CCF/calibre
- Description : l'écran « Poste de travail » (droit `admin`) liste, crée, modifie, supprime des `tr_poste(plt_id, ate_id, poste_nom, poste_ip, poste_calber, poste_imp_ccf)`. Aucun contrôle métier (IP non validée, aucune unicité, cohérence atelier/plateforme non vérifiée) hors `ModelState.IsValid`. La suppression ou modification d'un id absent lève une exception (`tr_poste not found`) ; sur la suppression l'exception est capturée et la vue vide est renvoyée. Consommation : `RecupDataPoste(ate_id, user)` pour l'impression des colis et `poste_calber` dans l'export d'expédition (ligne `I` + calibre). Les droits d'écriture ne sont pas vérifiés côté serveur.
- Déclencheur : Create / Update / Delete.
- Conditions : `ModelState.IsValid`.
- Effet : écriture `tr_poste` ; trace `Trace.WriteLine`.
- Statuts concernés : sans objet.
- Profils : droit `admin` (menu).
- Source : `W/Controllers/PosteDeTravailController.cs:17-98` ; `BLL/PosteDeTravailBll.cs:14-81` ; `REPO/PosteDeTravailRepository.cs:31-118` ; `TBL/tr_poste.sql:1-12` ; `REPO/PreparationColisRepository.cs:577-582` ; `BLL/PreparationExpeditionService.cs:212-219`.
- Confiance : CERTAINE pour le CRUD ; PROBABLE pour l'usage aval (lignes 577-582 et 212-219 lues partiellement).

### RG-ADM-048 (provisoire) — « Info poste » : identification du poste client par IP puis `ping -a` exécuté sur le serveur
- Description : `InfoPoste` lit l'IP du client (`::1` converti en `127.0.0.1`), lance `ping.exe -a <ip>` sur le serveur web et extrait le nom d'hôte du texte de sortie en s'appuyant sur le libellé « Pinging » (anglais) ou « sur » (français) selon le paramètre `InterpretationPingAnglaise` ; si le format ne correspond pas, `Substring` lève une exception. Aucun contrôle de droit. Une copie du même code existe dans `TestController.RecupNomPc`.
- Déclencheur : ouverture de `InfoPoste/Index`.
- Conditions : serveur Windows, `ping.exe` disponible.
- Effet : affichage IP + nom de poste ; ce nom n'est lié à aucune règle d'accès retrouvée.
- Statuts concernés : sans objet.
- Profils : tous (aucun garde).
- Source : `W/Controllers/InfoPosteController.cs:16-26` ; `BLL/InfoPosteBll.cs:8-23` ; `BLL/CommunBll.cs:217-268` ; `W/Controllers/TestController.cs:125-181` ; `W/Web.config:50`.
- Confiance : CERTAINE.

---

# G. INFORMATION D'ENVIRONNEMENT ET RELANCE DE DOSSIER

### RG-ADM-049 (provisoire) — « Informations configuration » : affiche environnement et serveurs de bases (aucune donnée sensible, aucun garde serveur)
- Description : deux écrans : `AdminInfo/Index` (environnement, serveur et base CIRCE, serveurs et bases Broadcast EXTPLAY et INTERFACE, regroupés si même serveur) et `Administration/GetAdminInfo` (environnement, serveur CIRCE, serveur Sybase AMT, via `Sybase.Data.AseClient`). Menu : droit `admin`. Chaînes de connexion non affichées en clair.
- Déclencheur : ouverture de l'écran.
- Conditions : `AseConnection` sur Sybase échoue → chaîne vide, erreur ELMAH.
- Effet : lecture seule.
- Statuts concernés : sans objet.
- Profils : droit `admin`.
- Source : `W/Controllers/AdminInfoController.cs:15-22` ; `BLL/AdminInfoBll.cs:25-33` ; `REPO/AdminInfoRepository.cs:15-47` ; `W/Controllers/Administration/AdministrationController.cs:10-18` ; `REPO/RessourceRepository.cs:73-98`.
- Confiance : CERTAINE.

### RG-ADM-051 (provisoire) — « Rafraichir un dossier » : relance de la redescente d'un contrat depuis Broadcast
- Description : l'utilisateur saisit un numéro de dossier (`cont_num`, requis). Contrôle serveur : `cont_num > 0`, sinon erreur « Le numero de dossier doit supérieur à 0 ! » (affichée sur le champ). Effet : exécute `ope.P_ExportTrainAfficheTravailCirce` dans la base INTERFACE avec la liste `dbo.IdGenericList` d'un seul dossier. Aucun contrôle d'existence du dossier, aucun retour de résultat à l'utilisateur, aucun contrôle de périmètre plateforme, aucune limite de fréquence ; la procédure est dans une base externe (non lue).
- Déclencheur : validation du formulaire.
- Conditions : `cont_num > 0`.
- Effet : relance d'un export de trains/instructions vers CIRCE (rejoue l'alimentation Coordination pour ce dossier ; voir RG-COO-040 et suivantes).
- Statuts concernés : sans objet (états des instructions changés indirectement ; voir machine d'états COO).
- Profils : droit `train_rafraichir_contrat` (menu) ; non vérifié côté serveur.
- Source : `W/Controllers/AdminContratController.cs:20-55` ; `BLL/AdminContratBll.cs:24-34` ; `REPO/AdminContratRepository.cs:21-37` ; `MODEL/AdminContratModel.cs:13-15`.
- Confiance : CERTAINE (code) ; INCERTAINE (effet réel de la procédure externe).

---

# H. RAPPORTS RDLC, ÉDITIONS, IMPRESSIONS

### RG-ADM-060 (provisoire) — Génération des états : RDLC locaux (ReportViewer) rendus côté serveur en PDF ou EMF
- Description : `Rapport.cs` alimente un `DataSetNew` typé ou des entités, charge un `.rdlc` (chemin relatif au site), renseigne des paramètres puis rend soit un PDF (`FileContentResult`, `application/pdf`) soit des images EMF imprimées directement sur une imprimante Windows **du serveur** via `System.Drawing.Printing` (`PrintDocument`, nom d'imprimante reçu en paramètre). Si le nom d'imprimante est invalide : exception « Error: cannot find the default printer. » ; si aucun flux : « Error: no stream to print. ». Inventaire des états produits par `Rapport.cs` :

| Méthode | État RDLC | Sortie |
|---|---|---|
| `PliageEtiquetteColis` | `PliageEtiquetteUm.rdlc` | PDF |
| `SyntheseUm` | `PreparationSyntheseUm.rdlc` | PDF (en-tête expéditeur = plateforme) |
| `EtiquetteColis` | `EtiquetteColisUm.rdlc` | PDF ou impression directe (booléen `pdf`) |
| `EtiquetteColisTrain` | `EtiquetteColisTrain.rdlc` | PDF ou impression directe |
| `EtiquetteBague` | `EtiquetteBagueNewCode128.rdlc` si `code128`, sinon `EtiquetteBagueNew.rdlc` | PDF écrit dans `Content\temp`, nom `<login sans domaine>-<horodatage>.pdf`, affiché par `<embed>` ; suppression via `SupprimeEmbedFile` |
| `ExportThemeQte` | `ExportThemeParQuantite.rdlc` ou `…Surf.rdlc` | état |
| `FinDeJournee` | `FinDeJournee.rdlc` | PDF temporaire |
| `EtiquetteRackAffiche` / `EtiquetteRackAffichePicking` / `EditionEnvoyeEtiquetteRackAffiche` | `EtiquetteRackAffiche.rdlc` | PDF ou impression directe sur chaque imprimante de la plateforme |
| `EditionPicking` | `EditionPicking.rdlc` | état |
| `EditionFicheActivite` | `EditionActivite.rdlc` (+ sous-rapport `activite_prepa_affiches`) | état |
| `TestEtiquetteAuto` | `Test.rdlc` | test |
| Autres `.rdlc` présents | `EditionActivite*`, `EditionFicheActivite`, `FichePreparation*`, `PreparationColisage*`, `EtiquetteColis*` (anciennes versions `_old`, `Copy of …`) | rendus par des contrôles `.ascx` / vues `*Report.cshtml` ; usage non tracé |
- Déclencheur : actions « Imprimer / Éditer » des écrans Réception, Coordination, Colis, Zone picking.
- Conditions : imprimante Windows installée sur le serveur ; répertoire `Content\temp` créé à la volée (`ControleRepertoireTravail`).
- Effet : PDF ou impression ; aucun enregistrement de l'édition en base, aucune historisation de l'impression (sauf actions décrites dans les modules Réception/Coordination).
- Statuts concernés : sans objet.
- Profils : aucun contrôle de droit sur les éditions (RG-ADM-015).
- Source : `W/Reports/Rapport.cs:48-103,105-172,174-245,247-290,325-426,463-479,486-508,509-561,576-617,626-644,669-709,732-777,792-838,853-875,888-901,961-1025` ; `W/Controllers/Preparation/ReportController.cs:14-72`.
- Confiance : CERTAINE (inventaire et branches) ; INCERTAINE pour le contenu des RDLC (mises en page, formules non lues : voir zones non analysées).

### RG-ADM-061 (provisoire) — Fichiers PDF temporaires : un fichier par édition, jamais purgé automatiquement
- Description : `EtiquetteBague` et `FinDeJournee` écrivent un PDF dans `..\Content\temp` sous un nom `<login sans domaine>-<yyyy-MM-dd-HH-mm-ss-FFFFFFF>.pdf` (ou `output.pdf` si le login ne contient pas de `\`). La suppression est à la charge de l'appelant (`SupprimeEmbedFile`) ; aucune purge planifiée trouvée.
- Déclencheur : édition d'étiquettes de bague / de fin de journée.
- Conditions : droit d'écriture sur le dossier du site.
- Effet : accumulation de fichiers contenant des données de livraison/destinataires.
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `W/Reports/Rapport.cs:32,433-441,463-479,486-508`.
- Confiance : PROBABLE (le code de `SupprimeEmbedFile` suffit à confirmer l'existence mais l'appelant n'a pas été vérifié partout).

### RG-ADM-062 (provisoire) — Code-barres de l'étiquette rack : « A- » + identifiant d'affiche complété par des zéros à 13 caractères
- Description : `code_barres = "A-0000000000000"` dont on retire autant de caractères finaux que la longueur de `affiche_id`, puis on concatène `affiche_id` (ex. id 123 → `A-0000000000123`). Paramètres de l'étiquette : support, dossier, semaines, annonceur, thème, repiquage, allée, rayon, quantité = somme des mouvements, référence DA, date de réception (`date_entree`), commentaire = commentaire affiche + deux espaces + commentaire réception, premier départ = min des `sem_num` des prépas liées, mention « Affiche A Conserver » si `aConserver`. Le champ `Qte_Theorique` NULL est forcé à 0 avant impression.
- Déclencheur : impression de l'étiquette rack (envoi de réception).
- Conditions : affiche existante.
- Effet : étiquette EMF imprimée.
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `W/Reports/Rapport.cs:961-1025`.
- Confiance : CERTAINE (la règle « à conserver » côté Réception est dans RG-REC-0xx).

### RG-ADM-063 (provisoire) — `ReportController.ReportPreparationStreamWithRdlc` : exceptions avalées, `null` retourné
- Description : l'action de rendu lit l'objet `TempData["myReport"]`, calcule un `ReportGenericModel` (logo `~/Content/logo.jpg`, langue `fr-FR`, imprimé par = `UserHelper.UserName`) et renvoie le fichier. Toute exception est capturée et ignorée (`var exp = e;`) et l'action retourne `null` (réponse vide) : l'utilisateur ne voit pas d'erreur. `TempData` perdu (nouvelle session) → exception avalée.
- Déclencheur : édition d'une fiche de préparation (synthèse/détail).
- Conditions : `TempData["myReport"]` rempli par l'écran appelant.
- Effet : PDF ou réponse vide.
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `W/Controllers/Preparation/ReportController.cs:14-40,44`.
- Confiance : CERTAINE.

---

# I. COMPORTEMENTS TECHNIQUES À RISQUE (administration/exploitation)

### RG-ADM-050 (provisoire) — Contrôleur `Test` exposé en production : outils d'exploitation sans garde
- Description : `TestController` (hérite d'`ApplicationController`) expose notamment : liste des imprimantes du serveur (`TestListeImprimantes`), impression de test sur une imprimante au choix (`TestEtiquetteAuto(pdf, imprimanteSelect)`), exécution de `ping` (`RecupNomPc`), déclenchement d'une division par zéro (`IndexDivParZero`), upload de photo en base (`TestAjoutPhoto`, enregistrée avec le login), transcodage code 128, vidage du journal de trace (`FlushTrace`, `Trace.Flush()`), écrans de grilles. Aucun garde ; seul le lien de l'en-tête est masqué (RG-ADM-005). Aucune règle métier, mais surface d'attaque et d'exploitation à ne pas reproduire.
- Source : `W/Controllers/TestController.cs:125-181,251-256,350-400,428-478` ; `W/Views/Test/TestAdminFlush.cshtml`.
- Confiance : CERTAINE.

### RG-ADM-052 (provisoire) — Journal d'erreurs ELMAH accessible à distance sans authentification applicative
- Description : ELMAH est actif (`elmah.axd`, route MVC `elmah`), `allowRemoteAccess="yes"`, `elmah.mvc.requiresAuthentication=false`, `allowedRoles="*"`, `allowedUsers="*"` : tout utilisateur réseau authentifié IIS (ou anonyme si IIS le permet) peut lire les erreurs (URL, trace, paramètres) stockées dans `~/App_Data`. Les erreurs non gérées sont aussi journalisées par `ToolBll.LogException` (via `ExceptionFilter`) et la page d'erreur personnalisée est activée (`customErrors mode="On"`).
- Déclencheur : accès à `/elmah`.
- Conditions : réseau.
- Effet : fuite d'information.
- Source : `W/Web.config:54-60,90-92,148,176,242-253` ; `W/Classes/ExceptionFilter.cs:16-23`.
- Confiance : CERTAINE (la config de production peut surcharger ces valeurs : `Web.CIRCE-PROD.config` ne contient pas de transformation `elmah` ou `authorization`, grep sans résultat).

### RG-ADM-053 (provisoire) — Secrets et environnements par jetons de remplacement
- Description : les chaînes de connexion et le serveur SMTP sont des jetons (`__SQLInstanceCIRCE__`, `__userCircePassword__`, `__SMTPHost__`, `__ConfigCatSdkKey__`…) remplacés au déploiement ; `Environnement` vaut `PRODUCTION` en prod. Le test `Environnement != "PRODUCTION"` change l'objet des mails (RG-ADM-043). Connexion SQL avec identifiant/mot de passe applicatif unique (pas de délégation d'identité : `<identity impersonate="false">`), donc les contrôles d'accès SQL ne distinguent pas les utilisateurs.
- Source : `W/Web.config:18-21,31,38,156` ; `W/Web.CIRCE-PROD.config:15`.
- Confiance : CERTAINE.

---

# Machines d'états

Les entités de ce module n'ont **aucune colonne de statut**. Seul le cycle d'existence (création/suppression physique, sans historique) est porté.

### Utilisateur (`tr_utilisateur`), périmètre (`tr_utilisateur_data`), droit (`tr_utilisateur_menu`)
| Statut \ Action | Créer (écran) | Modifier | Supprimer (écran) | Effet de bord |
|---|---|---|---|---|
| Inexistant | → Existant (si login non vide et non en doublon ; RG-ADM-030/033/035) | n/a (aucun écran de modification) | n/a (exception si cible absente) | — |
| Existant | refusé (message de doublon) | n/a | → Supprimé physiquement | aucune cascade : `tr_utilisateur` supprimé ≠ `tr_utilisateur_data`/`tr_utilisateur_menu` supprimés (RG-ADM-031) ; un droit/périmètre retiré n'agit qu'à la prochaine session (RG-ADM-011) |
| Supprimé | = Inexistant | | | |

### Référentiels Equipe, Machine, Poste, Mail plateforme, Imprimante
| Statut \ Action | Créer | Modifier | Supprimer |
|---|---|---|---|
| Inexistant | → Existant | n/a | exception (`Remove(null)` ou `not found`) |
| Existant | → Existant (nouveau doublon possible, aucune unicité) | → Existant (champs `Qui/DateModification` sur Equipe/Machine uniquement) | → Supprimé physiquement (erreur SQL si référencé, RG-ADM-046) |
Imprimante : création uniquement via `Update` de la plateforme (RG-ADM-040) ; pas de suppression. Plateforme : modification seule (RG-ADM-040) ; pas de création ni suppression à l'écran.

### Édition / impression / mail
Aucun statut persistant (RG-ADM-043, RG-ADM-060). Seul le batch colis marque les colis notifiés (RG-ADM-045).

---

# Profils réels et ce que chacun peut faire

## 1. Constat sur les « profils » (CLAUDE.md §8)
- **Aucun rôle nommé exploité par l'application** : pas de classe `Role`, pas de `[Authorize(Roles=…)]`, pas de `roleManager` utilisé (le `roleManager` de `Web.config` est le gabarit par défaut, jamais appelé).
- `tr_profil` (prf_id, prf_lib) : contenu inconnu (aucun seed dans le dépôt). Seules les valeurs 1 / 2 / 3 sont décrites, en commentaire de `p_s_listeAtelier` : **1 = profil atelier**, **2 = profil plateforme**, **3 = administrateur**. Non appliqué à l'exécution (RG-ADM-010).
- Le profil **effectif** d'un utilisateur est donc la combinaison : (a) ensemble des droits `tr_utilisateur_menu`, (b) périmètre `tr_utilisateur_data`. Ce n'est pas un rôle unique.

## 2. Droits connus (27, enum `CommunBll.Droits`) et effets exacts constatés
Légende : « Menu » = élément de menu `_MenuNew`; « UI » = bouton/case dans une vue ; **aucun** n'est contrôlé côté serveur (RG-ADM-015). `Admin UI` = attribuable par l'écran « Admin utilisateur menu ».

| Droit (valeur en base) | Admin UI | Effets constatés (affichage) | Source |
|---|---|---|---|
| `Super_admin` | non | Sous-menu « Utilisateur Admin » (Admin utilisateur / data / menu), à l'intérieur du groupe Administration | `_MenuNew.cshtml:212-222` |
| `admin` | oui | Groupe Administration visible ; « Informations configuration », « Poste de travail », « Plateforme Mail », « Plateforme », « Liste des transporteurs » | `_MenuNew.cshtml:157,201-208` |
| `referentiel` | oui | Groupe Administration visible ; « Liste des adresses », « Liste des rouleurs », Activité › « Admin Equipe », « Admin Machine » | `_MenuNew.cshtml:158,187-197` |
| `debloque_repart` | oui | Groupe Administration ; « Déblocage préparations » | `_MenuNew.cshtml:155,166-169` |
| `view_repart` | oui | Groupe Administration ; « Préparations débloquées » | `_MenuNew.cshtml:156,171-174` |
| `train_rafraichir_contrat` | oui | Groupe Administration ; « Rafraichir un dossier » | `_MenuNew.cshtml:159,176-179` |
| `duplication_train` | non | « Dupliquer train » (sous Administration, sans rendre le groupe visible) | `_MenuNew.cshtml:180-183` |
| `reception_liste_affiche` | oui | Menu Réception : « Réception des affiches », « Liste des affiches » | `_MenuNew.cshtml:122-128` |
| `Zone_Picking` | non | Réception › « Zone picking » ; case zone picking du détail affiche ; bouton écran Zone picking | `_MenuNew.cshtml:129-132` ; `ZonePicking/Index.cshtml:91` ; `Partial_ModifierDetailsAffiche.cshtml:256` |
| `fusion_affiche` | non | Réception › « Fusion des affiches » ; colonne et bouton Fusionner (liste « À traiter ») | `_MenuNew.cshtml:133-136` ; `ReceptionListeAffiche/Index.cshtml:99,117` |
| `validation_admin` | oui | Cases « Validation Admin » / « À conserver » ; boutons d'association/dissociation de prépa | `Partial_ModifierDetailsAffiche.cshtml:24` ; `Partial_GridAssoc_prepa_affiche.cshtml:42` |
| `suivi_suivi_production` | oui | Menu Suivi : « Suivi de production », « Etat des réservations », « Etat de destruction » | `_MenuNew.cshtml:140-152` |
| `Activite_Production` | non | Suivi › « Analyse Production » ; boutons des écrans Zone picking / Suivi de production | `_MenuNew.cshtml:147-150` ; `SuiviSuiviProduction/Index.cshtml:21` ; `ZonePicking/Index.cshtml:98` |
| `pliage_a_traiter` | oui | Pliage › « A traiter » ; Trains › « Liste des instructions » | `_MenuNew.cshtml:61-64,84-87` |
| `pliage` | oui | Pliage › « Préparation », « Liste des colis » ; Trains › « Liste des trains », « Position Train » | `_MenuNew.cshtml:66-70,89-93` |
| `train_suivi_theme` | oui | Trains › « Suivi par thème » | `_MenuNew.cshtml:95-99` |
| `train_preparation` | oui | Trains › « Préparation », « Export préparation », « Liste des colis » | `_MenuNew.cshtml:101-107` |
| `train_regrouper` | oui | Raccrocher / fractionner (Suivi par thème, Liste des trains) | `TrainSuiviTheme/Index.cshtml:91` ; `PreparationDeroulantsController.cs:586` |
| `train_debloquer_semaine` | oui | Bouton « Débloquer semaine » | `TrainSuiviTheme/Index.cshtml:105,143` |
| `train_changer_statut` | oui | « Changer statut » (A imprimer) | `TrainPreparation/Index.cshtml:78` ; `PreparationDeroulantsController.cs:585` |
| `train_annuler_theme` | oui | aucun usage retrouvé dans les vues | enum seulement |
| `_2m2_fixe` (stocké `2m2_fixe`) | oui (valeur incorrecte, RG-ADM-014) | 2m² fixe › « Préparation », « Liste des colis » | `_MenuNew.cshtml:45-49` |
| `_2m2_fixe_a_traiter` (stocké `2m2_fixe_a_traiter`) | oui (valeur incorrecte) | 2m² fixe › « A traiter » | `_MenuNew.cshtml:40-43` |
| `bus` | oui | Bus › « Préparation » (si `busv3` actif) | `_MenuNew.cshtml:11-28` |
| `bus_a_traiter` | oui | Bus › « A traiter » (si `busv3` actif) | `_MenuNew.cshtml:20-23` |
| `expedition_ext` | non | Menu « Expedition ext » › « Liste des colis » | `_MenuNew.cshtml:111-119` |
| `retirer` | oui | Bouton « Confirmer Retirer » en Préparation 2m² fixe / Pliage / Bus (ancien helper `IsAuthorised`) | `Preparation2m2Fixe.cshtml:139` ; `Pliage.cshtml:115` ; `BusPreparation.cshtml:139` |

Aucun droit n'est requis pour : Home, InfoPoste, Test (hors lien masqué), ou toute URL tapée à la main.

## 3. Périmètre (`tr_utilisateur_data`)
Un utilisateur peut avoir N triplets (login, plateforme, atelier). Effet : listes de plateformes et d'ateliers filtrées (RG-ADM-016). `p_s_atelierScro` n'expose que les ateliers 5, 6, 7, 8, 11, 12.

## 4. Matrice droit × page/action (menu `_MenuNew` ; ● = élément visible ; « + » = condition supplémentaire)
| Page / action | `Super_admin` | `admin` | `referentiel` | `debloque_repart` | `view_repart` | `train_rafraichir_contrat` | `duplication_train` | autres droits |
|---|---|---|---|---|---|---|---|---|
| Groupe « Administration » (visibilité) | non seul | ● | ● | ● | ● | ● | non seul | — |
| Admin utilisateur / data / menu | ● (+ groupe visible) | | | | | | | — |
| Informations configuration (`AdminInfo`) | | ● | | | | | | — |
| Poste de travail | | ● | | | | | | — |
| Plateforme Mail / Plateforme | | ● | | | | | | — |
| Liste des transporteurs (`PreparationExpedition`) | | ● | | | | | | — |
| Liste des adresses / rouleurs | | | ● | | | | | — |
| Admin Equipe / Admin Machine | | | ● | | | | | — |
| Déblocage préparations | | | | ● | | | | — |
| Préparations débloquées | | | | | ● | | | — |
| Rafraichir un dossier | | | | | | ● | | — |
| Dupliquer train | | | | | | | ● | — |
| Réception (Réception/Liste des affiches) | | | | | | | | `reception_liste_affiche` |
| Zone picking, Fusion des affiches | | | | | | | | `Zone_Picking`, `fusion_affiche` (+ `reception_liste_affiche`) |
| Suivi de production, Etat des réservations, Etat de destruction | | | | | | | | `suivi_suivi_production` |
| Analyse Production | | | | | | | | `Activite_Production` (+ `suivi_suivi_production`) |
| Trains / Pliage / 2m² fixe / Bus / Expedition ext | | | | | | | | voir tableau §2 |
Toutes les URL correspondantes restent appelables sans droit (RG-ADM-015). Les écrans Admin* utilisent `_LayoutSansBoostrap` → menu complet.

---

# Dépendances vers les autres modules

| Module / domaine | Dépendance | Références |
|---|---|---|
| **Réception** | périmètre plateforme (`tr_utilisateur_data`), droits `reception_liste_affiche`, `Zone_Picking`, `fusion_affiche`, `validation_admin` ; mail de réception (`tr_adresseMail_plateforme`) ; imprimantes de plateforme pour l'étiquette rack ; rapports (étiquette rack, picking) | RG-ADM-016, 023, 041, 043, 060, 062 ; RG-REC-001, 120, 121 |
| **Coordination** | droits `pliage*`, `train_*`, `debloque_repart`, `view_repart`, `duplication_train`, `validation_admin` ; périmètre atelier ; `plt_mail` + `id_site_ccf` pour le mail de déblocage ; « Rafraichir un dossier » appelle `ope.P_ExportTrainAfficheTravailCirce` (INTERFACE/Broadcast) | RG-ADM-016, 044, 051 ; RG-COO-084, 090, 091, 092 |
| **Production / Expédition / Colis** | `tr_poste` (calibre, imprimante CCF), étiquettes colis / trains / UM (RDLC), droit `expedition_ext`, batch mail colis (EXTPLAY ressources) | RG-ADM-045, 047, 060 |
| **Zone picking / Activité** | référentiels `Equipe` / `Machine` (par plateforme), droit `Activite_Production` | RG-ADM-046 |
| **Broadcast / EXTPLAY / INTERFACE** | affichage des serveurs, relance de dossier, ressources pour mails colis | RG-ADM-049, 051, 045 |
| **Sybase AMT** | affichage du serveur (`Sybase.Data.AseClient`) | RG-ADM-049 |
| **Active Directory** | nom de l'utilisateur ; `RessourceRepository.GetUtilisateursAD` / `LoadFromAD` (recherche d'annuaire, usage non retrouvé dans le périmètre) | RG-ADM-004 |
| **ConfigCat (feature flags)** | `busv3`, `PastillePrepaBus` (clé `ConfigCatSdkKey`) | RG-ADM-022 |
| **Historique transversal** | non utilisé par les écrans d'administration (aucune trace des changements de droits/référentiels) | RG-ADM-030 à 036 |
| **SMTP** | mails réception (`system.net/mailSettings`), mail déblocage, mails colis (`HostSMTP`, port 25) | RG-ADM-043, 045 |

---

# Zones NON analysées (et pourquoi)

1. **Contenu des `.rdlc`** (mise en page, expressions, sous-rapports, visibilité conditionnelle, codes-barres, formats de date) : fichiers XML volumineux non lus ; l'inventaire des états est fait via `Rapport.cs` seulement. Les `.ascx`/`*Report.cshtml` (`FichePreparation*Report`, `PreparationColisage*Report`) n'ont été vus que par leurs appels d'identité.
2. **Configuration IIS** (authentification anonyme/Windows, groupes AD autorisés, pool d'applications, durée de session) : hors dépôt. L'hypothèse de RG-ADM-001 (anonyme désactivé) n'est pas vérifiable.
3. **Contenu réel de `tr_profil`, `tr_utilisateur`, `tr_utilisateur_menu`, `tr_utilisateur_data` en production** : aucune donnée de seed ; les libellés de profils et les droits réellement attribués sont inconnus. La collation SQL (sensibilité à la casse des logins) n'est pas lisible dans les fichiers lus.
4. **Planification** des batchs (`BatchEnvoieMailColis`, `BatchAlimPex*`, `BacthCallZoom`) et compte de service SMTP/SQL : aucun fichier de planification trouvé ; `BatchEdition` est un exemple de squelette d'impression (aucune règle). `BacthCallZoomBll` et `BatchEnvoieMailColisRepository` (requêtes `GetGlobalColis`, `UpdateSendColis`, `UpdateParametrePackage`) non lus.
5. **Autres écrans de référentiels** déclarés dans le menu Administration : « Liste des transporteurs », « Liste des adresses » (`PreparationExpedition`), « Liste des rouleurs » (`ListeRouleur`), « Dupliquer train » (`DuplicationTrain`), « Déblocage préparations » / « Préparations débloquées » (traités dans `legacy-coordination.md`) : seule leur condition d'accès au menu est analysée ici.
6. **JavaScript partagé** (`Scripts/site/Commum.js`, `JS/AppCirce.js`, `Utils.js`, `AjaxHelper.js`, `Administation.js`) : non présents ou non lus ; règles de front communes (resizing de grilles, gestion `ErreurAjaxActionLink`) non extraites.
7. **Modèles de validation** (`AdminPlateformeModel`, `EquipeModel`, `MachineModel`, `PosteDeTravailModel`, `UtilisateurDataModel`) : annotations `[Required]`, `[StringLength]` non lues ; seules les validations des contrôleurs ont été relevées (sauf `AdminContratModel`).
8. **`RessourceRepository.GetUtilisateursAD` / `LoadFromAD`** : recherche AD par critères (login, nom, prénom) avec filtre LDAP construit par concaténation (risque d'injection LDAP) ; aucun appelant trouvé dans le périmètre lu → usage réel INCONNU.
9. **`ToolBll`** : seules les fonctions `NomUtilisateurDuLoginAd`, `SendMail`, une partie de la table plateforme → ville (lignes 360-385) ont été lues ; `LogException`, `ExtraitExceptionData` non lues.
10. **`ClearChannel.Circe.Test`** (tests unitaires) : non lus ; aucun test sur l'administration retrouvé dans les noms de fichiers (seul `AdminPreparationDeblocageBllTest` existe).
11. **Triggers SQL / droits SQL** : aucun dossier `Triggers` ; les `GRANT` observés (`user_circe`, `reader_circe`) ne distinguent pas les utilisateurs finaux (connexion applicative unique).
12. **Docs de contexte** (`circe-develop/docs/*.md`, `docs-sources`) volontairement non utilisés pour déduire des règles.

---

# Synthèse chiffrée et points à risque
- **45 règles provisoires** : RG-ADM-001 à 007 (7), 010 à 017 (8), 020 à 023 (4), 030 à 037 (8), 040 à 053 (hors numérotation séquentielle : 040-053 = 14, dont 048, 049, 050, 051, 052, 053), 060 à 063 (4). (45 entrées RG-ADM au total).
- **Constat n°1 (à arbitrer)** : aucun contrôle serveur, aucun anti-CSRF, ELMAH ouvert (RG-ADM-015, 052) ; escalade de privilèges triviale.
- **Constat n°2** : `prf_id` (profil) est inerte (RG-ADM-010) ; les « profils » réels sont des listes de droits libres + périmètre.
- **Constat n°3** : 6 droits utilisés par le code ne sont pas attribuables par l'écran, et 2 sont attribués avec une valeur erronée (RG-ADM-013/014).
- **Constat n°4** : pas de cascade à la suppression d'utilisateur, pas d'historique des changements de droits (RG-ADM-031, 030 à 036).
- **Constat n°5** : mails perdus (thread unique, exceptions avalées), objet/corps d'environnement incohérent en production (RG-ADM-043).
- **Constat n°6** : DEBUG fige l'identité (`CCI\PBOSS760`) et 3 logins codés en dur ouvrent l'écran de tests (RG-ADM-002, 005, 050).
