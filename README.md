# CIRCE — démarrage local

Depuis le dossier qui contient `package.json` :

```sh
pnpm start
```

Cette commande installe les dépendances à la première utilisation, crée `.env` s’il est absent, applique les migrations SQLite, prépare les référentiels, les profils de développement et les JDD Wissous / Nîmes / Nanterre, puis lance l’API et le web. Elle affiche **Application prête** et l’adresse à ouvrir. Le premier démarrage nécessite Internet et peut prendre plusieurs minutes.

`pnpm start:all` reste disponible et lance le même programme. `Ctrl+C` arrête l’application. Les ports préférés sont web 3000, API 3001 et sondes 9180 ; si un port est occupé, un port libre est choisi et affiché.

## Installation sur Windows

1. Installer **Node.js 24 LTS**, version Windows x64 pour un PC Intel/AMD, avec npm et l’ajout au PATH : [téléchargement officiel](https://nodejs.org/en/download).
2. Fermer puis rouvrir le terminal. Dans **Invite de commandes (cmd)**, installer une fois pnpm :

   ```bat
   npm install -g pnpm@12.14.0
   ```

3. Récupérer le projet dans un dossier local accessible en écriture, par exemple `C:\Projets\CIRCE-v1`. Git est facultatif si le projet est téléchargé en ZIP. Pour cloner la version contenant les évolutions du 16/11, installer [Git pour Windows](https://git-scm.com/download/win), puis :

   ```bat
   git clone --branch codex/maquette-20261116 https://github.com/abdelhrifech/CIRCE-v1.git C:\Projets\CIRCE-v1
   ```

4. Dans le dossier du projet, démarrer :

   ```bat
   cd /d C:\Projets\CIRCE-v1
   pnpm start
   ```

5. Ouvrir dans Edge, Chrome ou Firefox l’adresse affichée après **Application prête**, généralement `http://127.0.0.1:3000`.

Le projet ne nécessite ni Docker ni un serveur PostgreSQL/MySQL : SQLite est installé avec les dépendances. Ne pas copier les `node_modules` d’une autre machine ; le lanceur les installe pour Windows. Le dossier doit être accessible en écriture pour `.env` et `apps\api\prisma\dev.db`.

### PowerShell

Si PowerShell refuse les scripts `npm.ps1` ou `pnpm.ps1`, utiliser les exécutables `.cmd`, sans changer la politique de sécurité :

```powershell
npm.cmd install -g pnpm@12.14.0
cd C:\Projets\CIRCE-v1
pnpm.cmd start
```

### En cas d’erreur d’installation

Vérifier `node --version` (24.x conseillé), `npm --version` et `pnpm --version`. Si une compilation du module SQLite `better-sqlite3` est demandée et échoue, installer **Python 3** et **Visual Studio Build Tools** avec la charge **Développement Desktop en C++** et le SDK Windows, puis relancer `pnpm install --frozen-lockfile` et `pnpm start`. Ces outils sont nécessaires seulement si le binaire précompilé ne peut pas être utilisé. Voir la [documentation du module](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md).

## Profils et options

Le sélecteur **Profil (dev)** permet de changer de rôle. Pour ouvrir directement avec l’administrateur :

```sh
pnpm start --user=dev.admin
```

Autres options :

```sh
pnpm start --no-seed
pnpm start --no-demo
pnpm start --web-port=3000 --api-port=3001 --admin-port=9180
```

- `--no-seed` applique les migrations et lance les serveurs sans exécuter les référentiels, profils et JDD. À utiliser sur une base déjà préparée.
- `--no-demo` prépare les référentiels et profils, sans charger les JDD.
- Les options de ports indiquent les ports préférés ; le lanceur choisit un autre port s’ils sont occupés.

La base locale persiste entre les démarrages. Pour déplacer les données existantes, arrêter l’application et sauvegarder la base SQLite avec une copie cohérente avant transfert. Une installation neuve construit ses propres JDD.

Ce lanceur utilise les identités de développement. Il sert au fonctionnement local et aux démonstrations ; la mise en production nécessite l’authentification et la configuration de déploiement décrites dans les audits du projet.

## Vérifications

```sh
node --test scripts/pnpm-process.test.mjs
pnpm typecheck
pnpm lint
```

La correction Windows utilise le CLI JavaScript de pnpm sans shell, y compris pour les migrations ; l’arrêt termine l’arbre de processus sous Windows. La recette native sur une machine Windows reste à effectuer, l’environnement de développement courant étant macOS.
