// Détection des jeux GOG, Epic et EA sur de faux dossiers (lancer : node --test electron/tests/).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'blazon-lanceurs-'));
const ecrire = (rel, contenu) => {
  const p = path.join(racine, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, contenu);
  return p;
};

// ───── Epic : deux jeux, un DLC, une installation incomplète, un outil, et le cache du catalogue.
const epic = path.join(racine, 'Epic', 'Data');
const jeuEpic = path.join(racine, 'EpicGames', 'Hades');
ecrire('EpicGames/Hades/Hades.exe', 'x');
ecrire('EpicGames/Alan Wake 2/AlanWake2.exe', 'x');
ecrire('Epic/Data/Manifests/A.item', JSON.stringify({ DisplayName: 'Hades', AppName: 'Min', MainGameAppName: 'Min', CatalogNamespace: 'ns1', CatalogItemId: 'item1', InstallLocation: jeuEpic, LaunchExecutable: 'Hades.exe', InstallSize: 1234, AppCategories: ['public', 'games', 'applications'] }));
ecrire('Epic/Data/Manifests/B.item', JSON.stringify({ DisplayName: 'Alan Wake 2', AppName: 'Dill', MainGameAppName: 'Dill', CatalogNamespace: 'ns2', CatalogItemId: 'item2', InstallLocation: path.join(racine, 'EpicGames', 'Alan Wake 2'), LaunchExecutable: 'AlanWake2.exe', AppCategories: ['games'] }));
ecrire('Epic/Data/Manifests/C.item', JSON.stringify({ DisplayName: 'Hades DLC', AppName: 'MinDLC', MainGameAppName: 'Min', InstallLocation: jeuEpic, AppCategories: ['addons'] }));
ecrire('Epic/Data/Manifests/D.item', JSON.stringify({ DisplayName: 'En cours', AppName: 'X', MainGameAppName: 'X', InstallLocation: jeuEpic, bIsIncompleteInstall: true }));
ecrire('Epic/Data/Manifests/E.item', JSON.stringify({ DisplayName: 'Unreal Engine', AppName: 'UE_5', MainGameAppName: 'UE_5', InstallLocation: jeuEpic, AppCategories: ['engines'] }));
ecrire('Epic/Data/Catalog/catcache.bin', Buffer.from(JSON.stringify([
  { id: 'item1', title: 'Hades', keyImages: [{ type: 'DieselGameBoxTall', url: 'https://cdn1.epicgames.com/hades-tall.jpg' }, { type: 'DieselGameBox', url: 'https://cdn1.epicgames.com/hades-wide.jpg' }] },
])).toString('base64'));

// ───── GOG : sortie de « reg query /s », avec accents, un DLC et un jeu désinstallé.
const witcher = path.join(racine, 'GOG Games', 'The Witcher 3');
ecrire('GOG Games/The Witcher 3/bin/x64/witcher3.exe', 'x');
ecrire('GOG Games/The Witcher 3/goggame-1207664663.info', JSON.stringify({ gameId: '1207664663', name: 'The Witcher 3: Wild Hunt - Game of the Year Edition', playTasks: [{ isPrimary: true, type: 'FileTask', path: 'bin\\x64\\witcher3.exe'.replace(/\\/g, path.sep), arguments: '-net "mode a"', workingDir: 'bin' }] }));
const pokemon = path.join(racine, 'GOG Games', 'Pokémon');
ecrire('GOG Games/Pokémon/jeu.exe', 'x');
const reg = ecrire('gog.reg.txt', [
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1207664663',
  '    gameID    REG_SZ    1207664663',
  '    gameName    REG_SZ    The Witcher 3',
  `    path    REG_SZ    ${witcher}`,
  `    exe    REG_SZ    ${path.join(witcher, 'autre.exe')}`,
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1495134320',
  '    gameID    REG_SZ    1495134320',
  '    gameName    REG_SZ    Jeu Pokémon',
  `    path    REG_SZ    ${pokemon}`,
  `    exe    REG_SZ    ${path.join(pokemon, 'jeu.exe')}`,
  '    launchParam    REG_SZ    ',
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1111',
  '    gameID    REG_SZ    1111',
  '    gameName    REG_SZ    Un DLC',
  `    path    REG_SZ    ${witcher}`,
  '    dependsOn    REG_SZ    1207664663',
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\2222',
  '    gameID    REG_SZ    2222',
  '    gameName    REG_SZ    Désinstallé',
  `    path    REG_SZ    ${path.join(racine, 'nulle part')}`,
  '',
].join('\r\n'));

// ───── EA : un jeu dans la bibliothèque, un par la désinstallation de Windows, un jeu Steam et l'EA app.
const bibliEa = path.join(racine, 'EA Games');
const bf = path.join(bibliEa, 'Battlefield 2042');
ecrire('EA Games/Battlefield 2042/BF2042.exe', 'x');
ecrire('EA Games/Battlefield 2042/__Installer/installerdata.xml', `<?xml version="1.0" encoding="utf-8"?>
<DiPManifest version="4.0">
  <contentIDs><contentID>1010</contentID><contentID>1011</contentID></contentIDs>
  <gameTitles><gameTitle locale="en_US">Battlefield™ 2042</gameTitle><gameTitle locale="fr_FR">Battlefield™ 2042</gameTitle></gameTitles>
  <runtime>
    <launcher><filePath>[HKEY_LOCAL_MACHINE\\SOFTWARE\\EA Games\\Battlefield 2042\\Install Dir]BF2042_Trial.exe</filePath><trial>1</trial></launcher>
    <launcher><filePath>[HKEY_LOCAL_MACHINE\\SOFTWARE\\EA Games\\Battlefield 2042\\Install Dir]BF2042.exe</filePath><parameters>-dx12</parameters><trial>0</trial></launcher>
  </runtime>
</DiPManifest>`);
ecrire('EA Games/Outil vide/lisezmoi.txt', 'pas un jeu');
const me = path.join(racine, 'Jeux', 'Mass Effect Legendary Edition');
ecrire('Jeux/Mass Effect Legendary Edition/__Installer/installerdata.xml', `<game><contentIDs><contentID>71234</contentID></contentIDs>
<gameTitles><gameTitle locale="en_US">Mass Effect&#8482; Legendary Edition</gameTitle><gameTitle locale="fr_FR">Mass Effect™ Édition Légendaire</gameTitle></gameTitles>
<runtime><launcher><filePath>[HKEY_LOCAL_MACHINE\\SOFTWARE\\BioWare\\Mass Effect Legendary Edition\\Install Dir]Game\\Launcher\\MassEffectLauncher.exe</filePath></launcher></runtime></game>`);
ecrire('Jeux/Mass Effect Legendary Edition/Game/Launcher/MassEffectLauncher.exe', 'x');
const steamEa = path.join(racine, 'Steam', 'steamapps', 'common', 'Need for Speed Heat');
ecrire('Steam/steamapps/common/Need for Speed Heat/__Installer/installerdata.xml', '<game><contentIDs><contentID>9</contentID></contentIDs></game>');
const desinstall = ecrire('uninstall.reg.txt', [
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{ME}',
  '    DisplayName    REG_SZ    Mass Effect Legendary Edition',
  '    Publisher    REG_SZ    Electronic Arts',
  `    InstallLocation    REG_SZ    ${me}`,
  '    UninstallString    REG_SZ    "C:\\Program Files\\Common Files\\EAInstaller\\Mass Effect\\Cleanup.exe" uninstall_game',
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 1222680',
  '    DisplayName    REG_SZ    Need for Speed Heat',
  '    Publisher    REG_SZ    Electronic Arts',
  `    InstallLocation    REG_SZ    ${steamEa}`,
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Notepad++',
  '    DisplayName    REG_SZ    Notepad++',
  `    InstallLocation    REG_SZ    ${path.join(racine, 'npp')}`,
].join('\r\n'));

process.env.BLAZON_EPIC_DIR = epic;
process.env.BLAZON_GOG_REG = reg;
process.env.BLAZON_UNINSTALL_REG = desinstall;
process.env.BLAZON_EA_DIRS = bibliEa;

const al = require('../coeur/autres_lanceurs');

test('Epic : jeux installés seulement, jaquette du cache du catalogue, lien de lancement', async () => {
  const jeux = await al.jeuxEpic();
  assert.deepEqual(jeux.map((j) => j.titre).sort(), ['Alan Wake 2', 'Hades']);
  const hades = jeux.find((j) => j.titre === 'Hades');
  assert.equal(hades.source, 'epic');
  assert.equal(hades.jaquette, 'https://cdn1.epicgames.com/hades-tall.jpg');
  assert.equal(hades.hero, 'https://cdn1.epicgames.com/hades-wide.jpg');
  assert.equal(hades.url, 'com.epicgames.launcher://apps/ns1%3Aitem1%3AMin?action=launch&silent=true');
  assert.equal(hades.exe, path.join(jeuEpic, 'Hades.exe'));
  assert.equal(hades.taille_octets, 1234);
});

test('GOG : registre, exécutable principal du .info, arguments, accents ; ni DLC ni jeu désinstallé', async () => {
  const jeux = await al.jeuxGog();
  assert.deepEqual(jeux.map((j) => j.id_source).sort(), ['1207664663', '1495134320']);
  const w = jeux.find((j) => j.id_source === '1207664663');
  assert.equal(w.titre, 'The Witcher 3: Wild Hunt - Game of the Year Edition');
  assert.equal(w.exe, path.join(witcher, 'bin', 'x64', 'witcher3.exe'));
  assert.deepEqual(w.args, ['-net', 'mode a']);
  assert.equal(w.cwd, path.join(witcher, 'bin'));
  const p = jeux.find((j) => j.id_source === '1495134320');
  assert.equal(p.titre, 'Jeu Pokémon');
  assert.deepEqual(p.args, []);
});

test('EA : installerdata.xml (titre français, lanceur hors essai, offres), sans les jeux Steam', async () => {
  const jeux = await al.jeuxEa();
  const titres = jeux.map((j) => j.titre).sort();
  assert.deepEqual(titres, ['Battlefield™ 2042', 'Mass Effect™ Édition Légendaire']);
  const bf2042 = jeux.find((j) => j.id_source === '1010');
  assert.equal(bf2042.exe, path.join(bf, 'BF2042.exe'));
  assert.deepEqual(bf2042.args, ['-dx12']);
  assert.equal(bf2042.url, 'origin2://game/launch?offerIds=1010,1011&autoDownload=1');
  const m = jeux.find((j) => j.id_source === '71234');
  assert.equal(m.titre_en, 'Mass Effect™ Legendary Edition');
  assert.equal(m.exe, path.join(me, 'Game', 'Launcher', 'MassEffectLauncher.exe'));
});

test('Titres comparables entre lanceurs', () => {
  assert.equal(al.cleDeTitre('Battlefield™ 2042'), al.cleDeTitre('Battlefield 2042'));
  assert.equal(al.cleDeTitre('The Witcher 3: Wild Hunt - Game of the Year Edition'), 'the witcher 3 wild hunt');
  assert.equal(al.cleDeTitre('Pokémon'), 'pokemon');
});

test('Le cœur range ces jeux dans la bibliothèque, avec un identifiant stable, et les lance', async () => {
  delete require.cache[require.resolve('../coeur/coeur')];
  const { CoeurReel } = require('../coeur/coeur');
  process.env.BLAZON_STEAM_DIR = path.join(racine, 'pas-de-steam');
  const ouverts = [];
  const lances = [];
  const options = {
    dossier: path.join(racine, 'donnees'),
    version: 'test',
    referentiels: { fr: {} },
    chiffrer: (t) => t, dechiffrer: (t) => t,
    ouvrirExterne: async (u) => { ouverts.push(u); },
    ouvrirDossier: async () => {},
    lancerExe: async (exe, args, cwd) => { lances.push({ exe, args, cwd }); return { fin: new Promise(() => {}) }; },
    icone: async () => 'data:image/png;base64,AAAA',
    raccourci: () => null,
  };
  const c = new CoeurReel(options);
  c.en_ligne = false; // pas de réseau dans ce test
  await c.charge;
  await c.scanner();
  const jeux = c.visibles();
  const parTitre = Object.fromEntries(jeux.map((j) => [j.titre, j]));
  assert.ok(parTitre['Hades'] && parTitre['Alan Wake 2'] && parTitre['The Witcher 3: Wild Hunt - Game of the Year Edition'] && parTitre['Battlefield™ 2042']);
  assert.equal(jeux.length, 6);
  assert.deepEqual(parTitre['Hades'].sources, ['epic']);
  assert.equal(parTitre['Hades'].installe, true);
  assert.equal(parTitre['Hades'].jaquette, 'https://cdn1.epicgames.com/hades-tall.jpg');
  assert.ok(jeux.every((j) => j.id >= 1_500_000_000));
  assert.equal(c.scan.jeux_trouves, 6);

  const detail = await c.detail_jeu(parTitre['Hades'].id);
  assert.equal(detail.sources[0].source, 'epic');
  assert.equal(detail.hero, 'https://cdn1.epicgames.com/hades-wide.jpg');
  const fiche = await c.fiche_du_jeu(parTitre['Hades'].id);
  assert.equal(fiche.erreur.code, 'jeu_non_steam');

  // Epic : par le launcher d'Epic ; GOG : directement l'exécutable du jeu.
  await c.lancer(parTitre['Hades'].id, 'epic');
  assert.equal(ouverts[0], 'com.epicgames.launcher://apps/ns1%3Aitem1%3AMin?action=launch&silent=true');
  // Le jeu démarre : la partie est suivie par le nom de son processus.
  process.env.BLAZON_PROCESSUS = 'explorer.exe;hades.exe';
  await c.surveillerLaSession();
  assert.equal(c.session?.id_jeu, parTitre['Hades'].id);
  assert.equal(c.session.origine, 'launcher');
  process.env.BLAZON_PROCESSUS = 'explorer.exe';
  await c.surveillerLaSession();
  assert.equal(c.session, null);
  assert.equal(c.d.sessions.length, 1);

  const w = parTitre['The Witcher 3: Wild Hunt - Game of the Year Edition'];
  await c.lancer(w.id, 'gog');
  assert.deepEqual(lances[0], { exe: path.join(witcher, 'bin', 'x64', 'witcher3.exe'), args: ['-net', 'mode a'], cwd: path.join(witcher, 'bin') });
  c.finirSession();

  // Identifiants stables d'un lancement à l'autre.
  await c.ecrire();
  const c2 = new CoeurReel(options);
  c2.en_ligne = false;
  await c2.charge;
  await c2.scanner();
  const ids2 = Object.fromEntries(c2.visibles().map((j) => [j.titre, j.id]));
  for (const j of jeux) assert.equal(ids2[j.titre], j.id);
  await c.arreter();
  await c2.arreter();
  delete process.env.BLAZON_PROCESSUS;
});
