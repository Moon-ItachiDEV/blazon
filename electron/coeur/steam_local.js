// Ce que le PC sait de Steam, sans réseau : dossier de Steam, bibliothèques, jeux installés,
// comptes connectés, temps de jeu local et jeu en cours (registre Windows).
'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { lireVdf, cle } = require('./vdf');

const DECALAGE_STEAMID = 76561197960265728n;

/** Outils Steam installés comme des jeux, jamais montrés dans la bibliothèque. */
const OUTILS = new Set([228980, 1070560, 1391110, 1628350, 1493710, 1826330, 2180100, 250820, 1007, 2805730, 3658110, 1161040, 1580130, 1887720, 2230260, 2348590, 961940, 858280, 1054830, 1113280, 1245040, 1420170, 2805730]);
const NOM_OUTIL = /^(Steamworks|Proton|Steam Linux Runtime|SteamVR|Steam Audio)\b|Redistributable|Dedicated Server$/i;

function reg(cleRegistre, valeur) {
  return new Promise((resoudre) => {
    if (process.platform !== 'win32') return resoudre(null);
    execFile('reg', ['query', cleRegistre, '/v', valeur], { windowsHide: true, timeout: 4000 }, (err, sortie) => {
      if (err) return resoudre(null);
      const m = String(sortie).match(new RegExp(`${valeur}\\s+REG_\\w+\\s+(.*)`, 'i'));
      resoudre(m ? m[1].trim() : null);
    });
  });
}

async function lireTexte(fichier) {
  try { return await fsp.readFile(fichier, 'utf8'); } catch { return null; }
}

async function dossierDeSteam() {
  const candidats = [];
  if (process.env.BLAZON_STEAM_DIR) candidats.push(process.env.BLAZON_STEAM_DIR);
  const registre = await reg('HKCU\\Software\\Valve\\Steam', 'SteamPath');
  if (registre) candidats.push(registre.replace(/\//g, path.sep));
  const machine = await reg('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath');
  if (machine) candidats.push(machine);
  if (process.platform === 'win32') candidats.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  for (const c of candidats) {
    if (fs.existsSync(path.join(c, 'steamapps')) || fs.existsSync(path.join(c, 'config'))) return c;
  }
  return null;
}

async function bibliotheques(steam) {
  const liste = [steam];
  const texte = await lireTexte(path.join(steam, 'steamapps', 'libraryfolders.vdf'));
  if (texte) {
    const racine = cle(lireVdf(texte), 'libraryfolders') || {};
    for (const v of Object.values(racine)) {
      const p = typeof v === 'object' ? cle(v, 'path') : typeof v === 'string' && /[\\/]/.test(v) ? v : null;
      if (p) liste.push(p);
    }
  }
  const vus = new Set();
  return liste.filter((p) => {
    const k = path.normalize(p).toLowerCase();
    if (vus.has(k)) return false;
    vus.add(k);
    return fs.existsSync(path.join(p, 'steamapps'));
  });
}

/** Jeux installés d'une bibliothèque. */
async function jeuxInstalles(biblio) {
  const dossier = path.join(biblio, 'steamapps');
  let fichiers = [];
  try { fichiers = await fsp.readdir(dossier); } catch { return []; }
  const jeux = [];
  for (const f of fichiers) {
    if (!/^appmanifest_\d+\.acf$/i.test(f)) continue;
    const texte = await lireTexte(path.join(dossier, f));
    if (!texte) continue;
    const etat = cle(lireVdf(texte), 'AppState');
    if (!etat) continue;
    const appid = Number(cle(etat, 'appid'));
    const nom = String(cle(etat, 'name') || '');
    if (!appid || OUTILS.has(appid) || NOM_OUTIL.test(nom)) continue;
    const drapeaux = Number(cle(etat, 'StateFlags') || 0);
    const installdir = cle(etat, 'installdir');
    jeux.push({
      appid,
      nom,
      dossier: installdir ? path.join(dossier, 'common', installdir) : null,
      taille_octets: Number(cle(etat, 'SizeOnDisk') || 0) || null,
      // 4 = entièrement installé ; un jeu en cours de téléchargement n'est pas « installé ».
      complet: (drapeaux & 4) === 4,
      derniere_maj: Number(cle(etat, 'LastUpdated') || 0) || null,
    });
  }
  return jeux;
}

function versSteamId64(idCompte) {
  return (BigInt(idCompte) + DECALAGE_STEAMID).toString();
}
function versIdCompte(steamid64) {
  return (BigInt(steamid64) - DECALAGE_STEAMID).toString();
}

/** Comptes qui se sont connectés à Steam sur ce PC (le nom de connexion n'est jamais lu). */
async function comptes(steam) {
  const texte = await lireTexte(path.join(steam, 'config', 'loginusers.vdf'));
  if (!texte) return [];
  const users = cle(lireVdf(texte), 'users') || {};
  return Object.entries(users)
    .filter(([id]) => /^\d{17}$/.test(id))
    .map(([steamid, u]) => ({
      steamid,
      pseudo: String(cle(u, 'PersonaName') || ''),
      recent: String(cle(u, 'MostRecent') || '0') === '1',
      horodatage: Number(cle(u, 'Timestamp') || 0),
    }))
    .sort((a, b) => Number(b.recent) - Number(a.recent) || b.horodatage - a.horodatage);
}

/** Temps de jeu et dernier lancement que Steam garde sur le PC pour un compte. */
async function tempsLocaux(steam, steamid) {
  const resultat = new Map();
  if (!steamid) return resultat;
  const texte = await lireTexte(path.join(steam, 'userdata', versIdCompte(steamid), 'config', 'localconfig.vdf'));
  if (!texte) return resultat;
  const racine = lireVdf(texte);
  const apps = cle(racine, 'UserLocalConfigStore', 'Software', 'Valve', 'Steam', 'apps') || cle(racine, 'UserLocalConfigStore', 'Software', 'Valve', 'Steam', 'Apps') || {};
  for (const [id, a] of Object.entries(apps)) {
    const appid = Number(id);
    if (!appid || typeof a !== 'object') continue;
    const dernier = Number(cle(a, 'LastPlayed') || 0);
    const minutes = Number(cle(a, 'Playtime') || 0);
    const deuxSem = cle(a, 'Playtime2wks');
    if (!dernier && !minutes) continue;
    resultat.set(appid, { minutes_total: minutes, minutes_2sem: deuxSem === undefined ? null : Number(deuxSem), dernier: dernier || null });
  }
  return resultat;
}

/** Jeu Steam qui tourne en ce moment (0 = aucun). */
async function jeuEnCours() {
  const v = await reg('HKCU\\Software\\Valve\\Steam', 'RunningAppID');
  if (v === null) return process.env.BLAZON_RUNNING_APPID ? Number(process.env.BLAZON_RUNNING_APPID) : 0;
  return Number.parseInt(v, v.startsWith('0x') ? 16 : 10) || 0;
}

module.exports = { dossierDeSteam, bibliotheques, jeuxInstalles, comptes, tempsLocaux, jeuEnCours, versSteamId64, versIdCompte, OUTILS, NOM_OUTIL };
