// Blazon (Blazon V2)  : branché sur Steam et le PC (vrai cœur, coeur/), dans une fenêtre Windows de 1440×900.
// Lancé avec --demo, il garde la maquette sur fausses données (pour filmer une démo).
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { creerLeCoeur, brancher, modeDemo } = require('./coeur/pont');

let coeur = null;

protocol.registerSchemesAsPrivileged([
  { scheme: 'blazon', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const RACINE = path.join(__dirname, 'app');

function creer() {
  const fenetre = new BrowserWindow({
    width: 1440,
    height: 900,
    useContentSize: true,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b0e15',
    title: 'Blazon V2',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, ...(coeur ? { preload: path.join(__dirname, 'coeur', 'preload.js') } : {}) },
  });
  fenetre.once('ready-to-show', () => fenetre.show());
  brancher(coeur, fenetre);
  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'app.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetre.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('blazon://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
  fenetre.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') fenetre.setFullScreen(!fenetre.isFullScreen());
  });
  fenetre.loadURL('blazon://app/index.html');
}

app.setAppUserModelId('com.blazon.v2');
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  protocol.handle('blazon', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const fichier = path.normalize(path.join(RACINE, rel));
    if (!fichier.startsWith(RACINE)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(fichier).toString());
  });
  if (!modeDemo()) coeur = creerLeCoeur();
  creer();
});
app.on('window-all-closed', () => app.quit());
