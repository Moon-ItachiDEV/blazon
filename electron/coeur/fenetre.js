// Fenêtre de Blazon avec une barre de titre maison, aux couleurs du thème, à la place de la barre
// blanche de Windows. La barre est la page propre de la fenêtre (barre.html) ; l'application vit
// dans une vue posée juste dessous : ses mises en page en 100vh ne bougent pas.
// Réduire, agrandir et fermer restent les boutons de Windows (titleBarOverlay), recolorés :
// ils gardent le menu d'ancrage de Windows 11 au survol d'« agrandir ».
'use strict';
const path = require('node:path');
const { BrowserWindow, WebContentsView, shell } = require('electron');

const HAUTEUR = 34;

/**
 * @param {object} o
 * @param {string} o.titre         nom de la fenêtre (« Blazon Carmin »)
 * @param {string} o.fond          couleur de fond pendant le chargement
 * @param {string} o.bande         fond CSS de la barre (couleur ou dégradé)
 * @param {string} o.boutons       couleur du fond derrière réduire / agrandir / fermer
 * @param {string} o.symboles      couleur des symboles de ces boutons
 * @param {string} o.texte         couleur du texte de la barre
 * @param {string|null} o.preload
 * @param {(fenetre: BrowserWindow, page: Electron.WebContents) => void} o.brancher
 */
function creerFenetre(o) {
  const fenetre = new BrowserWindow({
    width: 1440,
    height: 900 + HAUTEUR,
    useContentSize: true,
    minWidth: 1100,
    minHeight: 700 + HAUTEUR,
    backgroundColor: o.fond,
    title: o.titre,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: o.boutons, symbolColor: o.symboles, height: HAUTEUR },
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  const vue = new WebContentsView({
    webPreferences: { contextIsolation: true, sandbox: true, ...(o.preload ? { preload: o.preload } : {}) },
  });
  vue.setBackgroundColor(o.fond);
  fenetre.contentView.addChildView(vue);
  const page = vue.webContents;

  const placer = () => {
    const { width, height } = fenetre.getContentBounds();
    const haut = fenetre.isFullScreen() ? 0 : HAUTEUR;
    vue.setBounds({ x: 0, y: haut, width, height: Math.max(0, height - haut) });
  };
  placer();
  for (const ev of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'restore']) fenetre.on(ev, placer);

  // La barre : le blason, le nom, et l'écran ouvert (repris du titre de la page).
  const parametres = new URLSearchParams({ bande: o.bande, texte: o.texte, fond: o.fond, nom: o.titre });
  void fenetre.webContents.loadFile(path.join(__dirname, 'barre.html'), { search: parametres.toString() });
  const ecrireTitre = (titre) => {
    fenetre.setTitle(titre);
    const ecran = titre.replace(/\s*·\s*Blazon.*$/, '').trim();
    void fenetre.webContents.executeJavaScript(`window.ecran && window.ecran(${JSON.stringify(ecran === titre ? '' : ecran)})`).catch(() => {});
  };
  page.on('page-title-updated', (e, titre) => { e.preventDefault(); ecrireTitre(titre); });

  let montree = false;
  const montrer = () => { if (!montree) { montree = true; fenetre.show(); page.focus(); } };
  page.once('did-finish-load', montrer);
  setTimeout(montrer, 4000);
  fenetre.on('focus', () => page.focus());

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'app.
  for (const wc of [page, fenetre.webContents]) {
    wc.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
  }
  page.on('will-navigate', (e, url) => {
    if (!url.startsWith('blazon://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
  fenetre.webContents.on('will-navigate', (e) => e.preventDefault());
  page.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') fenetre.setFullScreen(!fenetre.isFullScreen());
  });

  if (o.brancher) o.brancher(fenetre, page);
  page.loadURL('blazon://app/index.html');
  return { fenetre, page };
}

module.exports = { creerFenetre, HAUTEUR };
