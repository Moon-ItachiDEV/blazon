// Jeux installés par les autres lanceurs de Windows : GOG (GOG Galaxy ou installeurs hors ligne),
// Epic Games Launcher et EA app (et Origin). Tout est lu sur le disque et dans le registre,
// sans réseau et sans rien modifier.
//
//  - GOG : registre HKLM\SOFTWARE\(WOW6432Node\)GOG.com\Games\<id>, puis goggame-<id>.info du dossier
//    du jeu pour l'exécutable principal (playTasks).
//  - Epic : manifestes *.item de ProgramData\Epic\EpicGamesLauncher\Data\Manifests ; jaquettes
//    lues dans le cache du catalogue (Data\Catalog\catcache.bin, du JSON en base64).
//  - EA : dossiers des jeux qui contiennent __Installer\installerdata.xml, trouvés par les entrées
//    de désinstallation de Windows, les dossiers par défaut et le dossier choisi dans l'EA app.
//
// Variables pour les tests (et pour forcer un dossier) : BLAZON_EPIC_DIR (dossier Data d'Epic),
// BLAZON_EA_DIRS (dossiers de bibliothèque EA, séparés par « ; »), BLAZON_GOG_REG (fichier texte
// au format de « reg query /s », à la place du registre), BLAZON_UNINSTALL_REG (idem pour Uninstall).
'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');

const WINDOWS = process.platform === 'win32';

// ═════════════════════════════ Outils ═════════════════════════════

async function lireTexte(fichier) {
  try { return await fsp.readFile(fichier, 'utf8'); } catch { return null; }
}
async function lireJson(fichier) {
  const t = await lireTexte(fichier);
  if (t === null) return null;
  try { return JSON.parse(t.replace(/^\uFEFF/, '')); } catch { return null; }
}
const existe = (p) => { try { return Boolean(p) && fs.existsSync(p); } catch { return false; } };
async function sousDossiers(d) {
  try { return (await fsp.readdir(d, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => path.join(d, e.name)); } catch { return []; }
}

/** Taille d'un dossier, bornée pour ne pas parcourir un disque entier. */
async function tailleDossier(d, budget = { fichiers: 20000 }) {
  let total = 0;
  let entrees = [];
  try { entrees = await fsp.readdir(d, { withFileTypes: true }); } catch { return 0; }
  for (const e of entrees) {
    if (budget.fichiers-- <= 0) return total;
    const p = path.join(d, e.name);
    if (e.isDirectory()) total += await tailleDossier(p, budget);
    else if (e.isFile()) { try { total += (await fsp.stat(p)).size; } catch { /* fichier verrouillé */ } }
  }
  return total;
}

/**
 * Sortie de « reg query <clé> /s » -> { 'CHEMIN\\DE\\CLE': { valeur: texte } }.
 * Les noms de clés et de valeurs sont gardés tels quels ; la recherche se fait sans casse.
 */
function lireRegistre(texte) {
  const cles = {};
  let courante = null;
  for (const brute of String(texte || '').split(/\r?\n/)) {
    const ligne = brute.replace(/\s+$/, '');
    if (!ligne.trim()) continue;
    if (/^HKEY_/i.test(ligne)) { courante = cles[ligne] = {}; continue; }
    const m = ligne.match(/^\s+(.*?)\s{4}(REG_[A-Z_]+)\s{4}?(.*)$/) || ligne.match(/^\s+(.*?)\s{4}(REG_[A-Z_]+)$/);
    if (m && courante) {
      const nom = m[1] === '(Default)' || m[1] === '(par défaut)' ? '' : m[1];
      let v = m[3] ?? '';
      if (m[2] === 'REG_DWORD' || m[2] === 'REG_QWORD') v = String(Number.parseInt(v, 16));
      courante[nom] = v;
    }
  }
  return cles;
}
const valeur = (cle, nom) => {
  const k = Object.keys(cle || {}).find((x) => x.toLowerCase() === nom.toLowerCase());
  return k === undefined ? null : cle[k];
};

/** Lance « reg query /s » en UTF-8 (chcp 65001) pour garder les accents des titres et des chemins. */
function requeteRegistre(cle) {
  return new Promise((resoudre) => {
    if (!WINDOWS) return resoudre('');
    const commande = `/d /s /c "chcp 65001 >nul & reg query "${cle}" /s"`;
    execFile('cmd.exe', [commande], { windowsHide: true, windowsVerbatimArguments: true, timeout: 15000, maxBuffer: 32 * 1024 * 1024, encoding: 'buffer' }, (err, sortie) => {
      resoudre(sortie ? Buffer.from(sortie).toString('utf8') : '');
    });
  });
}

async function registre(cles, variable) {
  if (process.env[variable]) return lireRegistre(await lireTexte(process.env[variable]));
  const tout = {};
  for (const c of cles) Object.assign(tout, lireRegistre(await requeteRegistre(c)));
  return tout;
}

/** Titre réduit pour comparer deux noms de jeux (™, accents, ponctuation, casse). */
function cleDeTitre(t) {
  return String(t || '')
    .replace(/[™®©]/g, '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/\b(the )?(game of the year|goty|definitive|complete|deluxe|standard|ultimate|enhanced|remastered)( edition)?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ═════════════════════════════ GOG ═════════════════════════════

const CLES_GOG = ['HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games', 'HKLM\\SOFTWARE\\GOG.com\\Games'];

async function jeuxGog() {
  const reg = await registre(CLES_GOG, 'BLAZON_GOG_REG');
  const vus = new Set();
  const jeux = [];
  for (const [chemin, v] of Object.entries(reg)) {
    const id = valeur(v, 'gameID') || chemin.split('\\').pop();
    if (!/^\d+$/.test(String(id)) || vus.has(id)) continue;
    // Un DLC dépend d'un autre jeu : il n'a pas sa place dans la bibliothèque.
    if (valeur(v, 'dependsOn')) continue;
    const dossier = valeur(v, 'path');
    if (!existe(dossier)) continue;
    vus.add(id);
    const info = await lireJson(path.join(dossier, `goggame-${id}.info`));
    if (info?.dependencyGameId && String(info.dependencyGameId) !== String(id)) continue;
    let exe = valeur(v, 'exe') || valeur(v, 'launchCommand');
    let args = valeur(v, 'launchParam') || '';
    let cwd = valeur(v, 'workingDir') || null;
    const tache = (info?.playTasks || []).find((t) => t.isPrimary && (t.type === 'FileTask' || !t.type)) || (info?.playTasks || []).find((t) => t.type === 'FileTask');
    if (tache?.path) {
      exe = path.join(dossier, tache.path);
      args = tache.arguments || '';
      cwd = tache.workingDir ? path.join(dossier, tache.workingDir) : path.dirname(exe);
    }
    if (exe && !path.isAbsolute(exe)) exe = path.join(dossier, exe);
    if (exe) exe = exe.replace(/^"|"$/g, '');
    jeux.push({
      source: 'gog',
      id_source: String(id),
      titre: String(info?.name || valeur(v, 'gameName') || valeur(v, 'startMenu') || path.basename(dossier)).trim(),
      dossier,
      exe: existe(exe) ? exe : null,
      args: args ? decouperArguments(args) : [],
      cwd: cwd && existe(cwd) ? cwd : exe && existe(exe) ? path.dirname(exe) : dossier,
      // Sans exécutable connu, GOG Galaxy sait encore ouvrir la page du jeu.
      url: `goggalaxy://openGameView/${id}`,
      jaquette: null,
      hero: null,
      taille_octets: null,
    });
  }
  return jeux;
}

/** « -a "b c" d » -> ['-a', 'b c', 'd'] */
function decouperArguments(s) {
  const sortie = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(s))) sortie.push(m[1] ?? m[2]);
  return sortie;
}

/** Visuels d'un jeu GOG depuis l'API publique de GOG (sans compte). */
async function visuelsGog(id, obtenir) {
  const r = await obtenir(`https://api.gog.com/v2/games/${encodeURIComponent(id)}?locale=fr-FR`);
  const l = r?._links || {};
  const href = (k) => {
    const u = l[k]?.href;
    return typeof u === 'string' ? u.replace(/^\/\//, 'https://') : null;
  };
  return { jaquette: href('boxArtImage') || href('verticalCover'), hero: href('galaxyBackgroundImage') || href('backgroundImage'), titre: r?._embedded?.product?.title ?? null };
}

// ═════════════════════════════ Epic Games ═════════════════════════════

async function dossierEpic() {
  if (process.env.BLAZON_EPIC_DIR) return process.env.BLAZON_EPIC_DIR;
  if (!WINDOWS) return null;
  const reg = lireRegistre(await requeteRegistre('HKLM\\SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher'));
  for (const v of Object.values(reg)) {
    const d = valeur(v, 'AppDataPath');
    if (existe(d)) return d;
  }
  const d = path.join(process.env.ProgramData || process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data');
  return existe(d) ? d : null;
}

/** Cache du catalogue d'Epic : identifiant d'article -> { titre, images } (jaquette hors ligne). */
async function catalogueEpic(data) {
  const resultat = new Map();
  let brut;
  try { brut = await fsp.readFile(path.join(data, 'Catalog', 'catcache.bin'), 'utf8'); } catch { return resultat; }
  let liste;
  try {
    const texte = brut.trim().startsWith('[') ? brut : Buffer.from(brut.trim(), 'base64').toString('utf8');
    liste = JSON.parse(texte);
  } catch { return resultat; }
  for (const it of Array.isArray(liste) ? liste : []) {
    if (!it?.id) continue;
    const img = (...types) => {
      for (const t of types) {
        const u = (it.keyImages || []).find((k) => k.type === t)?.url;
        if (u) return u;
      }
      return null;
    };
    resultat.set(it.id, {
      titre: it.title || null,
      jaquette: img('DieselGameBoxTall', 'OfferImageTall', 'Thumbnail'),
      hero: img('DieselGameBox', 'OfferImageWide', 'DieselStoreFrontWide'),
    });
  }
  return resultat;
}

async function jeuxEpic() {
  const data = await dossierEpic();
  if (!data) return [];
  const dossierManifestes = path.join(data, 'Manifests');
  let fichiers = [];
  try { fichiers = (await fsp.readdir(dossierManifestes)).filter((f) => /\.item$/i.test(f)); } catch { return []; }
  const catalogue = await catalogueEpic(data);
  const jeux = [];
  const vus = new Set();
  for (const f of fichiers) {
    const m = await lireJson(path.join(dossierManifestes, f));
    if (!m?.AppName || !m.InstallLocation) continue;
    if (m.bIsIncompleteInstall) continue;
    // Un DLC a son propre manifeste mais pointe vers le jeu principal.
    if (m.MainGameAppName && m.MainGameAppName !== m.AppName) continue;
    const cats = Array.isArray(m.AppCategories) ? m.AppCategories : [];
    if (cats.length && !cats.includes('games')) continue;
    if (cats.includes('addons') || cats.includes('digitalextras') || cats.includes('plugins')) continue;
    if (vus.has(m.AppName) || !existe(m.InstallLocation)) continue;
    vus.add(m.AppName);
    const cat = catalogue.get(m.CatalogItemId) || null;
    const exe = m.LaunchExecutable ? path.join(m.InstallLocation, m.LaunchExecutable) : null;
    const triplet = [m.CatalogNamespace, m.CatalogItemId, m.AppName].map(encodeURIComponent).join('%3A');
    jeux.push({
      source: 'epic',
      id_source: m.AppName,
      titre: String(m.DisplayName || cat?.titre || m.AppName).trim(),
      dossier: m.InstallLocation,
      exe: existe(exe) ? exe : null,
      args: [],
      cwd: exe ? path.dirname(exe) : m.InstallLocation,
      // Le launcher d'Epic doit lancer le jeu lui-même : connexion, jetons, sauvegardes dans le nuage.
      url: m.CatalogNamespace && m.CatalogItemId ? `com.epicgames.launcher://apps/${triplet}?action=launch&silent=true` : `com.epicgames.launcher://apps/${encodeURIComponent(m.AppName)}?action=launch&silent=true`,
      jaquette: cat?.jaquette ?? null,
      hero: cat?.hero ?? null,
      taille_octets: Number(m.InstallSize) || null,
    });
  }
  return jeux;
}

// ═════════════════════════════ EA app (et Origin) ═════════════════════════════

const CLES_DESINSTALLATION = [
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

/** Dossiers où l'EA app range ses jeux : par défaut, et celui choisi dans ses réglages. */
async function bibliothequesEa() {
  const d = new Set();
  if (process.env.BLAZON_EA_DIRS) {
    for (const x of process.env.BLAZON_EA_DIRS.split(';')) if (x) d.add(x);
    return [...d];
  }
  if (!WINDOWS) return [];
  for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files', 'C:\\Program Files (x86)']) {
    if (!base) continue;
    d.add(path.join(base, 'EA Games'));
    d.add(path.join(base, 'Origin Games'));
    d.add(path.join(base, 'Electronic Arts'));
  }
  // %LOCALAPPDATA%\Electronic Arts\EA Desktop\user_<id>.ini : user.downloadinplacedir=D:\Jeux EA\
  const local = process.env.LOCALAPPDATA;
  if (local) {
    const dossierIni = path.join(local, 'Electronic Arts', 'EA Desktop');
    let inis = [];
    try { inis = (await fsp.readdir(dossierIni)).filter((f) => /\.ini$/i.test(f)); } catch { /* pas d'EA app */ }
    for (const f of inis) {
      const t = await lireTexte(path.join(dossierIni, f));
      for (const m of String(t || '').matchAll(/^user\.(?:downloadinplacedir|defaultinstallpath)\s*=\s*(.+)$/gim)) d.add(m[1].trim());
    }
  }
  return [...d].filter(existe);
}

const xmlTexte = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();

/** installerdata.xml (ancien format d'Origin ou DiPManifest de l'EA app). */
function lireInstallerData(xml, dossier) {
  const titres = {};
  for (const m of xml.matchAll(/<gameTitle\b[^>]*locale="([^"]+)"[^>]*>([\s\S]*?)<\/gameTitle>/gi)) titres[m[1].toLowerCase()] = xmlTexte(m[2]);
  const titre = titres.fr_fr || titres.en_us || Object.values(titres)[0] || null;
  const ids = [...xml.matchAll(/<contentID>([\s\S]*?)<\/contentID>/gi)].map((m) => xmlTexte(m[1])).filter(Boolean);
  // Lanceurs : on garde le premier qui n'est pas une version d'essai ni un outil 32 bits.
  const lanceurs = [...xml.matchAll(/<launcher\b[^>]*>([\s\S]*?)<\/launcher>/gi)].map((m) => m[1]);
  const choisi = lanceurs.find((l) => !/<trial>\s*1|<trial>\s*true/i.test(l) && !/<requires32BitOS>\s*1|<requires32BitOS>\s*true/i.test(l)) || lanceurs[0];
  let exe = null;
  let args = [];
  if (choisi) {
    const fp = choisi.match(/<filePath>([\s\S]*?)<\/filePath>/i);
    if (fp) {
      // [HKEY_LOCAL_MACHINE\SOFTWARE\EA Games\Jeu\Install Dir]bin\jeu.exe -> <dossier>\bin\jeu.exe
      const rel = xmlTexte(fp[1]).replace(/^\[[^\]]*\]/, '').replace(/^[\\/]+/, '');
      if (rel && !/^[a-z]+:\/\//i.test(rel)) exe = path.join(dossier, rel.replace(/[\\/]/g, path.sep));
    }
    const pa = choisi.match(/<parameters>([\s\S]*?)<\/parameters>/i);
    if (pa) args = decouperArguments(xmlTexte(pa[1]));
  }
  return { titre, titre_en: titres.en_us || titres.en_gb || null, ids, exe, args };
}

async function jeuxEa() {
  const candidats = new Map(); // dossier normalisé -> { dossier, nom, icone }
  const ajouter = (dossier, nom = null) => {
    // Un jeu EA acheté sur Steam a aussi son __Installer : il reste rangé chez Steam.
    if (!dossier || /[\\/]steamapps[\\/]/i.test(dossier)) return;
    const d = dossier.replace(/^"|"$/g, '').replace(/[\\/]+$/, '');
    const k = path.normalize(d).toLowerCase();
    if (!candidats.has(k)) candidats.set(k, { dossier: d, nom });
    else if (nom && !candidats.get(k).nom) candidats.get(k).nom = nom;
  };
  // 1. Entrées de désinstallation de Windows : l'EA app y inscrit chaque jeu (Cleanup.exe d'EAInstaller).
  const reg = await registre(CLES_DESINSTALLATION, 'BLAZON_UNINSTALL_REG');
  for (const v of Object.values(reg)) {
    const desinst = String(valeur(v, 'UninstallString') || '');
    const editeur = String(valeur(v, 'Publisher') || '');
    const loc = valeur(v, 'InstallLocation');
    if (!loc) continue;
    if (/EAInstaller|Origin|EA Desktop/i.test(desinst) || /Electronic Arts|EA Games|EA Swiss/i.test(editeur)) ajouter(loc, valeur(v, 'DisplayName'));
  }
  // 2. Dossiers de bibliothèque : un jeu par sous-dossier.
  for (const b of await bibliothequesEa()) for (const s of await sousDossiers(b)) ajouter(s);

  const jeux = [];
  const vus = new Set();
  for (const { dossier, nom } of candidats.values()) {
    const xml = await lireTexte(path.join(dossier, '__Installer', 'installerdata.xml'));
    if (xml === null) continue; // pas un jeu de l'EA app (l'EA app elle-même, un outil…)
    const info = lireInstallerData(xml, dossier);
    const id = info.ids[0] || path.basename(dossier);
    if (vus.has(id)) continue;
    vus.add(id);
    const titre = String(info.titre || nom || path.basename(dossier)).trim();
    jeux.push({
      source: 'ea',
      id_source: id,
      titre,
      // Titre anglais : c'est lui qui retrouve le jeu sur le magasin Steam.
      titre_en: info.titre_en,
      dossier,
      exe: existe(info.exe) ? info.exe : null,
      args: info.args,
      cwd: info.exe ? path.dirname(info.exe) : dossier,
      // L'EA app lance le jeu elle-même (connexion EA, protections) ; origin2:// est toujours géré par elle.
      url: info.ids.length ? `origin2://game/launch?offerIds=${info.ids.map(encodeURIComponent).join(',')}&autoDownload=1` : null,
      jaquette: null,
      hero: null,
      taille_octets: null,
    });
  }
  return jeux;
}

// ═════════════════════════════ Processus ═════════════════════════════

/** Noms des exécutables qui tournent (en minuscules), pour suivre une partie lancée par un autre launcher. */
function processusEnCours() {
  return new Promise((resoudre) => {
    if (!WINDOWS) {
      const faux = process.env.BLAZON_PROCESSUS;
      return resoudre(faux === undefined ? null : new Set(faux.split(';').filter(Boolean).map((s) => s.toLowerCase())));
    }
    execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, timeout: 8000, maxBuffer: 8 * 1024 * 1024 }, (err, sortie) => {
      if (err) return resoudre(null);
      const noms = new Set();
      for (const l of String(sortie).split(/\r?\n/)) {
        const m = l.match(/^"([^"]+)"/);
        if (m) noms.add(m[1].toLowerCase());
      }
      resoudre(noms);
    });
  });
}

// ═════════════════════════════ Tout ensemble ═════════════════════════════

const LANCEURS = { gog: jeuxGog, epic: jeuxEpic, ea: jeuxEa };

/** Les jeux d'un launcher ; une erreur de lecture ne casse jamais l'analyse des autres. */
async function jeuxDe(source) {
  try { return await LANCEURS[source](); } catch { return []; }
}

module.exports = {
  LANCEURS, jeuxDe, jeuxGog, jeuxEpic, jeuxEa, visuelsGog, processusEnCours, tailleDossier,
  lireRegistre, lireInstallerData, catalogueEpic, cleDeTitre, decouperArguments,
};
