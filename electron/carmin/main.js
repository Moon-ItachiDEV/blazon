// Blazon (Blazon Carmin) : branché sur Steam et le PC (vrai cœur, coeur/), dans une fenêtre Windows de 1440×900
// avec une barre de titre aux couleurs du thème (coeur/fenetre.js).
// (L'ancien mode --demo et ses fausses données ne sont plus embarqués.)
const { app, protocol, net, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { creerLeCoeur, brancher, modeDemo } = require('./coeur/pont');
const { creerFenetre } = require('./coeur/fenetre');

let coeur = null;
let principale = null;

protocol.registerSchemesAsPrivileged([
  { scheme: 'blazon', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const RACINE = path.join(__dirname, 'app');

function creer() {
  const { fenetre } = creerFenetre({
    titre: 'Blazon Carmin',
    fond: '#08070d',
    bande: 'linear-gradient(90deg, #0b0709 0, #0b0709 222px, #180409 236px, #1a050a 75%, #0a0708 100%)',
    boutons: '#0a0708',
    symboles: '#e9e4ea',
    texte: '#f2edf1',
    preload: coeur ? path.join(__dirname, 'coeur', 'preload.js') : null,
    brancher: (f, page) => brancher(coeur, f, page),
  });
  principale = fenetre;
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!principale) return;
  if (principale.isMinimized()) principale.restore();
  principale.focus();
});
app.setAppUserModelId('com.blazon.carmin');
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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
