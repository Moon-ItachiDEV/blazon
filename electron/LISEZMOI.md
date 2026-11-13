# Coquille Electron de Blazon (Carmin et V2)

Dans ce dépôt, `<coquille>` désigne le dossier `electron/`.

- `coeur/` : le vrai cœur, partagé par les deux versions (Node, processus principal). Il respecte `contrat/types.ts`.
  - `steam_local.js` : dossier de Steam (registre), bibliothèques, appmanifest, comptes (loginusers.vdf), temps de jeu local (localconfig.vdf), jeu en cours (RunningAppID).
  - `autres_lanceurs.js` : jeux installés par GOG (registre `GOG.com\Games` + `goggame-<id>.info`), Epic (manifestes `.item`, jaquettes du cache `catcache.bin`) et l'EA app (`__Installer\installerdata.xml`, trouvés par les entrées de désinstallation, `Program Files\EA Games` et le dossier choisi dans l'EA app). GOG se lance par l'exécutable du jeu ; Epic et EA par leur launcher (`com.epicgames.launcher://`, `origin2://`), puis la partie est suivie par le nom du processus. Jaquette et fiche : le même jeu sur le magasin Steam (titre identique), sinon les images du launcher.
  - `api.js` : appels Steam. Sans clé : GetItems (jaquettes, tags, avis), GetGameAchievements, annonces du magasin, joueurs en ligne. Avec la clé : GetOwnedGames, GetPlayerSummaries, GetFriendList, GetPlayerAchievements.
  - `coeur.js` : le contrat. Cache et réglages dans `%APPDATA%/Blazon <version>/blazon/` (donnees.json, cache.json). La clé est chiffrée par Windows (safeStorage) et n'est jamais envoyée à la page.
  - `pont.js` / `preload.js` : ipcMain.handle('coeur') et événements `coeur:evenement`.
- `--demo` au lancement : la maquette sur fausses données, pour filmer une démo.
- `BLAZON_STEAM_DIR` : forcer un dossier Steam (tests sous Linux). `BLAZON_EPIC_DIR`, `BLAZON_EA_DIRS`, `BLAZON_GOG_REG`, `BLAZON_UNINSTALL_REG`, `BLAZON_PROCESSUS` : idem pour les autres lanceurs.
- Tests du cœur : `node --test --test-force-exit electron/tests/*.test.js`.

Reconstruire :
1. Dans chaque dossier du front (`carmin/`, `v2/` à la racine du dépôt) : `npm ci && npx vite build --outDir <coquille>/<v>/app --emptyOutDir` (build normal, PAS la version artefact).
2. Copier `coeur/` dans `<coquille>/<v>/coeur/`.
3. `npx electron-builder --win portable --x64 --projectDir <coquille>/<v> -c.electronVersion=38.8.6` (marche depuis Linux, sans wine).
