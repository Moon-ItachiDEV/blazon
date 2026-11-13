# Coquille Electron de Blazon (Carmin)

- `coeur/` : le vrai cœur, embarqué dans l'exe (Node, processus principal). Il respecte `contrat/types.ts`.
  - `steam_local.js` : dossier de Steam (registre), bibliothèques, appmanifest, comptes (loginusers.vdf), temps de jeu local (localconfig.vdf), jeu en cours (RunningAppID).
  - `api.js` : appels Steam. Sans clé : GetItems (jaquettes, tags, avis), GetGameAchievements, annonces du magasin, joueurs en ligne. Avec la clé : GetOwnedGames, GetPlayerSummaries, GetFriendList, GetPlayerAchievements.
  - `coeur.js` : le contrat. Cache et réglages dans `%APPDATA%/Blazon <version>/blazon/` (donnees.json, cache.json). La clé est chiffrée par Windows (safeStorage) et n'est jamais envoyée à la page.
  - `fenetre.js` : une seule fenêtre, sans barre de titre Windows (`titleBarStyle: 'hidden'`). Les boutons réduire/agrandir/fermer sont dessinés par Windows en haut à droite (`titleBarOverlay`, 34 px) ; la page les évite avec `env(titlebar-area-height)` et se déplace par la bande `#poignee` d'`index.html`.
  - `pont.js` / `preload.js` : ipcMain.handle('coeur') et événements `coeur:evenement`.
- Plus de mode `--demo` : l'exe n'embarque ni le faux cœur ni ses données factices (app 1,1 Mo au lieu de 21). Pour une démo, utiliser l'artefact.
- `BLAZON_STEAM_DIR` : forcer un dossier Steam (tests sous Linux).

Reconstruire :
1. Dans `launcher-carmin` : `npm ci && BLAZON_EXE=1 npx vite build --outDir <coquille>/carmin/app --emptyOutDir` (`BLAZON_EXE=1` remplace le faux cœur par `src/coeur/sans_faux.ts` ; PAS la version artefact).
2. Copier `coeur/` dans `<coquille>/carmin/coeur/`.
3. `npx electron-builder --win portable --x64 --projectDir <coquille>/carmin -c.electronVersion=38.8.6` (marche depuis Linux, sans wine). Sort `sortie/Blazon.exe` et `sortie/win-unpacked/`.
4. Livrer `Blazon.zip` (le `Blazon.exe` portable) et `Blazon-dossier.zip` (le dossier `win-unpacked` renommé `Blazon`).

Pourquoi deux zips : l'exe portable se décompresse (≈ 330 Mo) dans `%TEMP%` à chaque lancement, ce qui coûte plusieurs secondes. Le dossier, extrait une fois, démarre sans cette étape. Un installateur NSIS demanderait wine pour être construit depuis Linux.
