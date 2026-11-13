// Fenêtre de Blazon : une seule page, sans barre de titre de Windows.
//
// L'application dessine elle-même le haut de la fenêtre. Réduire, agrandir et fermer restent les
// boutons de Windows (titleBarOverlay), recolorés : ils gardent le menu d'ancrage de Windows 11 au
// survol d'« agrandir ». La page sait où ils sont par les variables CSS `titlebar-area-*` et pose une
// bande invisible (`-webkit-app-region: drag`) par laquelle on déplace la fenêtre.
//
// Avant, la barre de titre était une seconde page (barre.html) posée au-dessus de l'application :
// un processus de rendu entier, environ 100 Mo, pour afficher un logo et un nom déjà présents à l'écran.
'use strict';
const { BrowserWindow, shell } = require('electron');

/** Hauteur des boutons de Windows, en haut à droite. */
const HAUTEUR = 34;

/**
 * @param {object} o
 * @param {string} o.titre         nom de la fenêtre (« Blazon »)
 * @param {string} o.fond          couleur de fond pendant le chargement
 * @param {string} o.boutons       couleur du fond derrière réduire / agrandir / fermer
 * @param {string} o.symboles      couleur des symboles de ces boutons
 * @param {string|null} o.preload
 * @param {(fenetre: BrowserWindow, page: Electron.WebContents) => void} o.brancher
 */
function creerFenetre(o) {
  const fenetre = new BrowserWindow({
    width: 1440,
    height: 900,
    useContentSize: true,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: o.fond,
    title: o.titre,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: o.boutons, symbolColor: o.symboles, height: HAUTEUR },
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      // Pas de correcteur : il soulignait les titres de jeux et les chemins de dossiers.
      spellcheck: false,
      ...(o.preload ? { preload: o.preload } : {}),
    },
  });
  const page = fenetre.webContents;

  // Montrée dès la première image dessinée, pour ne jamais voir une fenêtre vide.
  let montree = false;
  const montrer = () => {
    if (montree || fenetre.isDestroyed()) return;
    montree = true;
    fenetre.show();
  };
  fenetre.once('ready-to-show', montrer);
  setTimeout(montrer, 4000);

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'app.
  page.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  page.on('will-navigate', (e, url) => {
    if (url.startsWith('blazon://')) return;
    e.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });
  page.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') fenetre.setFullScreen(!fenetre.isFullScreen());
  });

  if (o.brancher) o.brancher(fenetre, page);
  void page.loadURL('blazon://app/index.html');
  return { fenetre, page };
}

module.exports = { creerFenetre, HAUTEUR };
