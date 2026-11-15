// Branche le vrai cœur sur la fenêtre : commandes par ipcMain.handle, événements par webContents.send.
// Partagé par Carmin et V2. `--demo` au lancement garde la maquette sur fausses données.
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { app, ipcMain, shell, safeStorage, net } = require('electron');
const { CoeurReel } = require('./coeur');
const api = require('./api');

const COMMANDES = new Set([
  'etat', 'referentiels', 'parametres', 'modifier_parametres', 'terminer_premier_lancement', 'tout_effacer', 'installer_la_mise_a_jour', 'rafraichir',
  'comptes_steam', 'choisir_le_compte', 'lister_jeux', 'jeux', 'detail_jeu', 'lister_sessions', 'definir_favori', 'definir_masque', 'renommer_un_jeu',
  'relancer_le_scan', 'analyser_un_chemin', 'ajouter_un_jeu_manuel', 'retirer_un_jeu_manuel', 'choisir_l_exe', 'lancer', 'ouvrir_le_dossier', 'action_steam',
  'ouvrir_un_lien', 'fiche_du_jeu', 'succes_du_jeu', 'amis', 'actualites_du_jeu', 'fil_d_actualites', 'profil', 'enregistrer_la_cle', 'supprimer_la_cle',
]);

const modeDemo = () => process.argv.includes('--demo');

function creerLeCoeur() {
  api.utiliserFetch((url, o) => net.fetch(url, o));
  const referentiels = JSON.parse(fs.readFileSync(path.join(__dirname, 'referentiels.json'), 'utf8'));
  const coeur = new CoeurReel({
    dossier: path.join(app.getPath('userData'), 'blazon'),
    version: app.getVersion(),
    referentiels,
    chiffrer: (texte) => (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(texte).toString('base64') : 'clair:' + Buffer.from(texte).toString('base64')),
    dechiffrer: (b) => (b.startsWith('clair:') ? Buffer.from(b.slice(6), 'base64').toString() : safeStorage.decryptString(Buffer.from(b, 'base64'))),
    ouvrirExterne: (url) => shell.openExternal(url),
    ouvrirDossier: async (p) => { const e = await shell.openPath(p); if (e) throw new Error(e); },
    lancerExe: async (exe) => {
      const enfant = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore', windowsHide: false });
      await new Promise((ok, ko) => { enfant.once('spawn', ok); enfant.once('error', ko); });
      return { fin: new Promise((ok) => enfant.once('exit', () => ok())) };
    },
    icone: async (p) => (await app.getFileIcon(p, { size: 'large' })).toDataURL(),
    raccourci: (p) => { try { return { cible: shell.readShortcutLink(p).target }; } catch { return null; } },
    demarrerAvecWindows: (oui) => { try { app.setLoginItemSettings({ openAtLogin: oui }); } catch { /* hors Windows */ } },
  });

  ipcMain.handle('coeur', async (_e, nom, args) => {
    if (!COMMANDES.has(nom)) return { ok: false, erreur: { code: 'interne', cle_i18n: 'erreurs.interne', details: null } };
    try {
      return { ok: true, valeur: await coeur[nom](...(Array.isArray(args) ? args : [])) };
    } catch (e) {
      const appErr = e && typeof e.code === 'string' && typeof e.cle_i18n === 'string' ? e : { code: 'interne', cle_i18n: 'erreurs.interne', details: null };
      if (appErr.code === 'interne') console.error('[coeur]', nom, e);
      return { ok: false, erreur: appErr };
    }
  });
  app.on('before-quit', () => { void coeur.arreter(); });
  return coeur;
}

/** Fenêtre : options à ajouter à webPreferences, et branchement des événements. */
function brancher(coeur, fenetre) {
  if (!coeur) return;
  const arreter = coeur.ecouter((ev) => { if (!fenetre.isDestroyed()) fenetre.webContents.send('coeur:evenement', ev); });
  fenetre.on('closed', arreter);
}

module.exports = { creerLeCoeur, brancher, modeDemo };
