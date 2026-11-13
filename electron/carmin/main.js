// Blazon : branché sur Steam et le PC (vrai cœur, coeur/), dans une fenêtre Windows de 1440×900
// dont l'application dessine elle-même le haut (coeur/fenetre.js).
const { app, protocol, net, Menu, Tray, nativeImage } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { creerLeCoeur, brancher } = require('./coeur/pont');
const { creerFenetre } = require('./coeur/fenetre');

let coeur = null;
let principale = null;
let zone = null; // l'icône près de l'horloge, créée la première fois que la fenêtre s'y range
let onQuitte = false;

// L'application s'est d'abord appelée « Blazon Carmin » : les réglages, la clé chiffrée et le cache
// restent dans ce dossier, pour que le changement de nom ne fasse rien perdre.
app.setPath('userData', path.join(app.getPath('appData'), 'Blazon Carmin'));

protocol.registerSchemesAsPrivileged([
  // `codeCache` : le code de l'interface n'est compilé qu'une fois, puis relu tel quel aux lancements suivants.
  { scheme: 'blazon', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true } },
]);

const RACINE = path.join(__dirname, 'app');

function creer() {
  const { fenetre } = creerFenetre({
    titre: 'Blazon',
    fond: '#0a0708',
    boutons: '#0a0708',
    symboles: '#d0c7ca',
    preload: path.join(__dirname, 'coeur', 'preload.js'),
    brancher: (f, page) => brancher(coeur, f, page),
  });
  principale = fenetre;
  // Réglage « Réduire dans la zone de notification » : fermer la fenêtre la range près de l'horloge.
  fenetre.on('close', (e) => {
    if (onQuitte || !coeur?.d.parametres.reduire_dans_la_zone_de_notification) return;
    e.preventDefault();
    ranger();
  });
}

function montrer() {
  if (!principale || principale.isDestroyed()) return;
  if (principale.isMinimized()) principale.restore();
  principale.show();
  principale.focus();
}

function ranger() {
  if (!zone) {
    const anglais = coeur?.d.parametres.langue === 'en';
    zone = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icone.png')).resize({ width: 32, height: 32 }));
    zone.setToolTip('Blazon');
    zone.setContextMenu(Menu.buildFromTemplate([
      { label: anglais ? 'Open Blazon' : 'Ouvrir Blazon', click: montrer },
      { type: 'separator' },
      { label: anglais ? 'Quit' : 'Quitter', click: () => app.quit() },
    ]));
    zone.on('click', montrer);
  }
  principale.hide();
}

if (!app.requestSingleInstanceLock()) app.quit();
// Relancer Blazon alors qu'il tourne déjà (ou qu'il est rangé près de l'horloge) ramène sa fenêtre.
app.on('second-instance', montrer);
app.on('before-quit', () => { onQuitte = true; });
app.setAppUserModelId('com.blazon.carmin');
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('blazon', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const fichier = path.normalize(path.join(RACINE, rel));
    if (!fichier.startsWith(RACINE)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(fichier).toString());
  });
  coeur = creerLeCoeur();
  creer();
});
app.on('window-all-closed', () => app.quit());
