// Appels aux services de Steam. La clé ne sort jamais de ce fichier, sauf vers api.steampowered.com.
// Chaque échec est rangé dans un code du contrat : hors_ligne, quota_atteint, cle_refusee, prive, absent.
'use strict';

const API = 'https://api.steampowered.com/';
const MAGASIN = 'https://store.steampowered.com/';
const CONTEXTE = { language: 'french', country_code: 'FR' };

class EchecReseau extends Error {
  constructor(code, statut = 0) {
    super(code);
    this.code = code;
    this.statut = statut;
  }
}

let compteur = { jour: '', appels: 0 };
// Dans l'exécutable : net.fetch d'Electron (pile réseau de Chromium, proxy du système compris).
let recuperer = (url, o) => globalThis.fetch(url, o);
function utiliserFetch(f) { recuperer = f; }
const LIMITE_JOUR = 20000; // Steam en autorise 100 000 par clé et par jour.

async function obtenir(url, { delai = 15000 } = {}) {
  const jour = new Date().toISOString().slice(0, 10);
  if (compteur.jour !== jour) compteur = { jour, appels: 0 };
  if (++compteur.appels > LIMITE_JOUR) throw new EchecReseau('quota_atteint');
  let rep;
  try {
    rep = await recuperer(url, { signal: AbortSignal.timeout(delai), headers: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5' } });
  } catch {
    throw new EchecReseau('hors_ligne');
  }
  if (rep.status === 429) throw new EchecReseau('quota_atteint', 429);
  if (rep.status === 401 || rep.status === 403) throw new EchecReseau('refus', rep.status);
  if (rep.status === 400 || rep.status === 404) throw new EchecReseau('absent', rep.status);
  if (!rep.ok) throw new EchecReseau('hors_ligne', rep.status);
  try {
    return await rep.json();
  } catch {
    throw new EchecReseau('absent', rep.status);
  }
}

function service(chemin, entree, cle = null) {
  const q = new URLSearchParams({ input_json: JSON.stringify(entree) });
  if (cle) q.set('key', cle);
  return obtenir(`${API}${chemin}?${q}`);
}

// ───────────── Sans clé ─────────────

/** Fiches légères du magasin, par paquets de 100. */
async function articles(appids, donnees) {
  const sortie = [];
  for (let i = 0; i < appids.length; i += 100) {
    const r = await service('IStoreBrowseService/GetItems/v1/', {
      ids: appids.slice(i, i + 100).map((appid) => ({ appid })),
      context: CONTEXTE,
      data_request: donnees,
    });
    sortie.push(...(r?.response?.store_items ?? []));
  }
  return sortie;
}

const DONNEES_GRILLE = { include_assets: true, include_basic_info: true, include_release: true, include_tag_count: 8, include_reviews: true };
const DONNEES_FICHE = { include_assets: true, include_basic_info: true, include_screenshots: true, include_ratings: true, include_supported_languages: true, include_full_description: true };

async function succesPublics(appid) {
  const r = await obtenir(`${API}IPlayerService/GetGameAchievements/v1/?appid=${appid}&language=french`);
  return r?.response?.achievements ?? [];
}

async function joueursEnLigne(appid) {
  const r = await obtenir(`${API}ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`);
  return r?.response?.result === 1 ? r.response.player_count : null;
}

async function annonces(appid, nombre = 10) {
  const r = await obtenir(`${MAGASIN}events/ajaxgetpartnereventspageable/?clan_accountid=0&appid=${appid}&offset=0&count=${nombre}&l=french`);
  return r?.events ?? [];
}

// ───────────── Avec la clé ─────────────

async function resumesJoueurs(cle, steamids) {
  const sortie = [];
  for (let i = 0; i < steamids.length; i += 100) {
    const r = await obtenir(`${API}ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(cle)}&steamids=${steamids.slice(i, i + 100).join(',')}`);
    sortie.push(...(r?.response?.players ?? []));
  }
  return sortie;
}

/** null = profil privé (Steam renvoie une réponse vide). */
async function jeuxPossedes(cle, steamid) {
  const r = await obtenir(
    `${API}IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(cle)}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1&skip_unvetted_apps=0&include_free_sub=0`,
    { delai: 30000 },
  );
  const rep = r?.response;
  if (!rep || rep.games === undefined) return null;
  return rep.games;
}

/** null = liste d'amis privée. */
async function listeDAmis(cle, steamid) {
  try {
    const r = await obtenir(`${API}ISteamUser/GetFriendList/v1/?key=${encodeURIComponent(cle)}&steamid=${steamid}&relationship=friend`);
    return r?.friendslist?.friends ?? [];
  } catch (e) {
    // 401 : liste d'amis privée (la clé, elle, a été acceptée par ailleurs).
    if (e.code === 'refus' && e.statut === 401) return null;
    throw e;
  }
}

/** null = profil privé ; [] = jeu sans succès. */
async function succesDuJoueur(cle, steamid, appid) {
  try {
    const r = await obtenir(`${API}ISteamUserStats/GetPlayerAchievements/v1/?key=${encodeURIComponent(cle)}&steamid=${steamid}&appid=${appid}&l=french`);
    return r?.playerstats?.achievements ?? [];
  } catch (e) {
    if (e.code === 'refus' && e.statut === 403) return null;
    if (e.code === 'absent') return [];
    throw e;
  }
}

// ───────────── Jeux des autres lanceurs ─────────────

/** JSON public d'un autre service (API de GOG). */
function obtenirJson(url) {
  return obtenir(url);
}

/**
 * Le même jeu sur le magasin Steam, retrouvé par son titre (pour la jaquette, les tags et la fiche
 * d'un jeu GOG, Epic ou EA). Seul un titre identique, une fois nettoyé, est retenu.
 */
async function chercherSurLeMagasin(titre, cleDeTitre) {
  const voulu = cleDeTitre(titre);
  if (!voulu) return null;
  // Le titre exact d'abord, puis le titre nettoyé (« … - Game of the Year Edition » -> « … »).
  const termes = [...new Set([String(titre).replace(/[™®©]/g, ''), voulu])];
  for (const terme of termes) {
    let r;
    try {
      r = await obtenir(`${MAGASIN}api/storesearch/?term=${encodeURIComponent(terme)}&l=english&cc=FR`);
    } catch (e) {
      if (e.code === 'absent') continue;
      throw e;
    }
    const items = (r?.items || []).filter((it) => it.type === 'app' || it.type === undefined);
    const exact = items.find((it) => cleDeTitre(it.name) === voulu);
    if (exact) return Number(exact.id);
  }
  return null;
}

module.exports = { utiliserFetch, obtenirJson, chercherSurLeMagasin, EchecReseau, articles, DONNEES_GRILLE, DONNEES_FICHE, succesPublics, joueursEnLigne, annonces, resumesJoueurs, jeuxPossedes, listeDAmis, succesDuJoueur };
