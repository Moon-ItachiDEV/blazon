// Le vrai cœur de Blazon, dans le processus principal d'Electron. Il respecte le contrat
// (contrat/types.ts) : l'interface ne voit pas la différence avec le faux cœur.
//
// Ce qu'il lit :
//  - le PC : dossier de Steam, bibliothèques, jeux installés, comptes, temps de jeu local, jeu en cours ;
//  - les autres lanceurs du PC : jeux installés par GOG, Epic Games et l'EA app (autres_lanceurs.js) ;
//  - Steam sans clé : fiches et visuels du magasin, succès publics, annonces, joueurs en ligne ;
//  - Steam avec la clé du joueur : jeux possédés, temps de jeu, succès débloqués, profil, amis.
// La clé est chiffrée par Windows (safeStorage) et ne quitte jamais ce processus.
'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const local = require('./steam_local');
const autres = require('./autres_lanceurs');
const api = require('./api');
const { bbcodeVersHtml, texteBrut, titreTri, urlAsset, BASE_ASSETS, BASE_COMMUNAUTE, BASE_CLAN } = require('./texte');

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;
const ID_MANUEL = 1_000_000_000;
// Jeux des autres lanceurs (GOG, Epic, EA) : identifiants stables, gardés dans donnees.json.
const ID_EXTERNE = 1_500_000_000;
const SOURCES_EXTERNES = ['epic', 'gog', 'ea'];
const estExterne = (id) => id >= ID_EXTERNE;

const LANGUES = { 0: 'en', 1: 'de', 2: 'fr', 3: 'it', 4: 'ko', 5: 'es', 6: 'zh-CN', 7: 'zh-TW', 8: 'ru', 9: 'th', 10: 'ja', 11: 'pt', 12: 'pl', 13: 'da', 14: 'nl', 15: 'fi', 16: 'no', 17: 'sv', 18: 'hu', 19: 'cs', 20: 'ro', 21: 'tr', 22: 'pt-BR', 23: 'bg', 24: 'el', 25: 'ar', 26: 'uk', 27: 'es-419', 28: 'vi', 30: 'id' };

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const maintenant = () => Date.now();
const erreur = (code, details = null) => ({ code, cle_i18n: `erreurs.${code}`, details });

const PARAMETRES_DEFAUT = {
  langue: 'fr',
  dossiers_a_scanner: [],
  demarrer_avec_windows: false,
  reduire_dans_la_zone_de_notification: false,
  animations: 'systeme',
  sources_en_ligne: { fiches_magasin: true, succes_publics: true, actualites: true, visuels_magasin: true, joueurs_en_ligne: true },
  rapports_de_plantage: false,
  reveler_les_succes_secrets: false,
  affichage: { vue: 'grille', taille_jaquettes: 180, tri: 'dernier_lancement', ordre: 'decroissant', montrer_les_jeux_masques: false },
};

function donneesNeuves() {
  return {
    version: 1,
    premier_lancement: true,
    parametres: structuredClone(PARAMETRES_DEFAUT),
    cle_chiffree: null,
    cle_etat: 'absente',
    compte: null,
    perso: {},
    manuels: [],
    externes_ids: {},
    exes: {},
    sessions: [],
    vus: {},
  };
}
function cacheNeuf() {
  return { possedes: null, articles: {}, fiches: {}, succes: {}, amis: null, profil: null, actus: {}, fil: null, visuels_ext: {} };
}

class CoeurReel {
  /**
   * @param {object} o
   * @param {string} o.dossier          dossier des données de l'application
   * @param {string} o.version
   * @param {(t:string)=>string|null} o.chiffrer   texte -> base64 chiffré
   * @param {(b:string)=>string|null} o.dechiffrer
   * @param {(url:string)=>Promise<void>} o.ouvrirExterne
   * @param {(p:string)=>Promise<void>} o.ouvrirDossier
   * @param {(exe:string)=>Promise<{fin:Promise<void>}>} o.lancerExe
   * @param {(p:string)=>Promise<string|null>} o.icone       icône d'un exécutable en data: URL
   * @param {(p:string)=>{cible:string}|null} o.raccourci   cible d'un .lnk
   * @param {object} o.referentiels
   */
  constructor(o) {
    this.o = o;
    this.auditeurs = new Set();
    this.d = donneesNeuves();
    this.c = cacheNeuf();
    this.frais = new Set(); // clés de cache rafraîchies pendant cette session (origine « reseau »)
    this.echecs = new Map(); // clé -> { erreur, quand }
    this.enCours = new Map(); // clé -> promesse
    this.en_ligne = true;
    this.steam = null;
    this.comptesLocaux = [];
    this.installes = new Map(); // appid -> jeu installé
    this.externes = new Map(); // id_jeu -> jeu installé par GOG, Epic ou l'EA app
    this.icones = new Map(); // exe -> icône (data: URL)
    this.tempsLocaux = new Map();
    this.scan = { en_cours: false, dernier: null, jeux_trouves: 0 };
    this.session = null; // { id_jeu, appid, debut, origine }
    this.lancementAttendu = null; // { id_jeu, quand }
    this.aSignaler = { modifies: new Set(), retires: new Set(), minuterie: null };
    this.erreurPossedes = null;
    this.erreurAmis = null;
    this.demarre = false;
    this.charge = this.charger();
  }

  // ═════════════════════════════ Persistance ═════════════════════════════

  fichier(nom) {
    return path.join(this.o.dossier, nom);
  }

  async charger() {
    await fsp.mkdir(this.o.dossier, { recursive: true });
    try {
      const d = JSON.parse(await fsp.readFile(this.fichier('donnees.json'), 'utf8'));
      this.d = { ...donneesNeuves(), ...d, parametres: { ...structuredClone(PARAMETRES_DEFAUT), ...(d.parametres || {}) } };
    } catch { /* premier lancement */ }
    try {
      this.c = { ...cacheNeuf(), ...JSON.parse(await fsp.readFile(this.fichier('cache.json'), 'utf8')) };
    } catch { /* pas de cache */ }
    if (this.d.cle_chiffree && this.cle() === null) {
      // Clé illisible (autre session Windows) : on la considère absente.
      this.d.cle_chiffree = null;
      this.d.cle_etat = 'absente';
    }
  }

  ecrireBientot() {
    clearTimeout(this.minuterieEcriture);
    this.minuterieEcriture = setTimeout(() => void this.ecrire(), 800);
  }

  async ecrire() {
    clearTimeout(this.minuterieEcriture);
    const ecrireFichier = async (nom, valeur) => {
      const tmp = this.fichier(nom + '.tmp');
      await fsp.writeFile(tmp, JSON.stringify(valeur));
      await fsp.rename(tmp, this.fichier(nom));
    };
    try {
      await ecrireFichier('donnees.json', this.d);
      await ecrireFichier('cache.json', this.c);
    } catch { /* disque plein : on réessaiera à la prochaine écriture */ }
  }

  cle() {
    if (!this.d.cle_chiffree) return null;
    try { return this.o.dechiffrer(this.d.cle_chiffree); } catch { return null; }
  }

  // ═════════════════════════════ Événements ═════════════════════════════

  ecouter(rappel) {
    this.auditeurs.add(rappel);
    return () => this.auditeurs.delete(rappel);
  }

  emettre(evenement) {
    for (const rappel of [...this.auditeurs]) {
      try { rappel(structuredClone(evenement)); } catch { /* un écran qui plante n'arrête pas le cœur */ }
    }
  }

  /** Regroupe les changements de la bibliothèque : au plus un événement toutes les 500 ms. */
  signaler(modifies = [], retires = []) {
    for (const id of modifies) this.aSignaler.modifies.add(id);
    for (const id of retires) this.aSignaler.retires.add(id);
    if (this.aSignaler.minuterie) return;
    this.aSignaler.minuterie = setTimeout(() => {
      const modif = [...this.aSignaler.modifies];
      const ret = [...this.aSignaler.retires].filter((id) => !this.aSignaler.modifies.has(id));
      this.aSignaler = { modifies: new Set(), retires: new Set(), minuterie: null };
      if (modif.length || ret.length) this.emettre({ type: 'bibliotheque_modifiee', modifies: modif, retires: ret });
    }, 500);
  }

  // ═════════════════════════════ Démarrage et synchronisation ═════════════════════════════

  async demarrer() {
    if (this.demarre) return;
    this.demarre = true;
    await this.charge;
    await this.scanner(this.d.premier_lancement);
    void this.synchroniser();
    this.surveillance = setInterval(() => void this.surveillerLaSession(), 5000);
    this.periodique = setInterval(() => void this.synchroniser(), 30 * MINUTE);
  }

  arreter() {
    clearInterval(this.surveillance);
    clearInterval(this.periodique);
    this.auditeurs.clear();
    return this.ecrire();
  }

  steamidActif() {
    const choisi = this.comptesLocaux.find((c) => c.steamid === this.d.compte);
    return (choisi ?? this.comptesLocaux[0])?.steamid ?? null;
  }

  async scanner(lent = false) {
    if (this.scan.en_cours) return;
    const debut = maintenant();
    const avant = new Set(this.visibles().map((j) => j.id));
    this.scan = { en_cours: true, dernier: this.scan.dernier, jeux_trouves: 0 };
    this.emettre({ type: 'etat_modifie' });
    this.steam = await local.dossierDeSteam();
    const installes = new Map();
    if (this.steam) {
      this.comptesLocaux = await local.comptes(this.steam);
      const biblios = await local.bibliotheques(this.steam);
      for (const b of biblios) {
        for (const j of await local.jeuxInstalles(b)) {
          installes.set(j.appid, j);
          if (!this.d.vus[j.appid]) this.d.vus[j.appid] = iso(maintenant());
        }
        this.installes = new Map([...this.installes, ...installes]);
        this.emettre({ type: 'scan_progression', source: 'steam', jeux_trouves: installes.size });
        // Au premier lancement, l'accueil montre les jeux qui arrivent : on laisse le temps de les voir.
        if (lent) await new Promise((r) => setTimeout(r, 500));
      }
      this.tempsLocaux = await local.tempsLocaux(this.steam, this.steamidActif());
    }
    this.installes = installes;
    await this.scannerLesAutresLanceurs(lent);
    // Jeux ajoutés à la main : ils sont « installés » tant que leur exécutable existe.
    const manuels = this.d.manuels.filter((m) => fs.existsSync(m.chemin)).length;
    const total = installes.size + this.externes.size + manuels;
    this.scan = { en_cours: false, dernier: iso(maintenant()), jeux_trouves: total };
    const apres = new Set(this.visibles().map((j) => j.id));
    this.signaler([...apres], [...avant].filter((id) => !apres.has(id)));
    this.emettre({ type: 'scan_termine', jeux_trouves: total, duree_ms: maintenant() - debut });
    this.emettre({ type: 'etat_modifie' });
    this.ecrireBientot();
  }

  /** Jeux installés par Epic, GOG et l'EA app. Un même dossier n'est compté qu'une fois. */
  async scannerLesAutresLanceurs(lent) {
    const externes = new Map();
    const dossiers = new Set([...this.installes.values()].map((j) => j.dossier).filter(Boolean).map((d) => path.normalize(d).toLowerCase()));
    for (const source of SOURCES_EXTERNES) {
      let trouves = 0;
      for (const e of await autres.jeuxDe(source)) {
        const k = path.normalize(e.dossier).toLowerCase();
        // Un jeu EA acheté sur Steam ou Epic a aussi un __Installer : il reste rangé chez Steam ou Epic.
        if (dossiers.has(k) || /[\\/]steamapps[\\/]/i.test(e.dossier)) continue;
        dossiers.add(k);
        const id = this.idExterne(e.source, e.id_source);
        externes.set(id, { ...e, id });
        trouves++;
      }
      this.externes = new Map([...this.externes, ...externes]);
      this.emettre({ type: 'scan_progression', source, jeux_trouves: trouves });
      if (lent && trouves) await new Promise((r) => setTimeout(r, 400));
    }
    this.externes = externes;
    for (const e of externes.values()) {
      if (!this.d.vus[`${e.source}:${e.id_source}`]) this.d.vus[`${e.source}:${e.id_source}`] = iso(maintenant());
      if (e.exe && !this.icones.has(e.exe)) {
        this.icones.set(e.exe, null);
        void this.o.icone(e.exe).then((u) => { this.icones.set(e.exe, u); this.signaler([e.id]); }).catch(() => {});
      }
    }
  }

  /** Identifiant stable d'un jeu d'un autre launcher (le même d'un lancement à l'autre). */
  idExterne(source, id_source) {
    const k = `${source}:${id_source}`;
    if (this.d.externes_ids[k]) return this.d.externes_ids[k];
    const pris = new Set(Object.values(this.d.externes_ids));
    let id = ID_EXTERNE + 1;
    while (pris.has(id)) id++;
    this.d.externes_ids[k] = id;
    this.ecrireBientot();
    return id;
  }

  /** Jaquettes et fiches des jeux GOG, Epic et EA : leur launcher d'abord, sinon le même jeu sur le magasin Steam. */
  async completerLesVisuelsExternes() {
    if (this.session || !this.d.parametres.sources_en_ligne.visuels_magasin) return;
    const limite = maintenant() - 7 * JOUR;
    const nouveaux = [];
    for (const e of this.externes.values()) {
      const k = `${e.source}:${e.id_source}`;
      const v = this.c.visuels_ext[k];
      if (v && Date.parse(v.maj_le) > limite) continue;
      const res = { maj_le: iso(maintenant()), jaquette: null, hero: null, appid: null };
      try {
        if (e.source === 'gog') {
          const g = await autres.visuelsGog(e.id_source, (u) => api.obtenirJson(u)).catch(() => null);
          if (g) { res.jaquette = g.jaquette; res.hero = g.hero; }
        }
        for (const t of [...new Set([e.titre_en, e.titre].filter(Boolean))]) {
          res.appid = await api.chercherSurLeMagasin(t, autres.cleDeTitre);
          if (res.appid) break;
        }
        this.noterReseau(true);
      } catch (err) {
        if (err?.code === 'hors_ligne') { this.noterReseau(false); return; }
      }
      this.c.visuels_ext[k] = res;
      if (res.appid) nouveaux.push(res.appid);
      this.signaler([e.id]);
    }
    if (nouveaux.length) await this.completerLesArticles();
    this.ecrireBientot();
  }

  /** Va chercher ce qui manque sur le réseau, sans jamais bloquer l'interface. */
  async synchroniser() {
    if (this.synchro) return this.synchro;
    this.synchro = (async () => {
      try {
        await this.rafraichirLesPossedes();
        await this.completerLesArticles();
        await this.completerLesVisuelsExternes();
        void this.completerLesSucces();
      } catch { /* chaque étape range déjà ses erreurs */ }
    })().finally(() => { this.synchro = null; });
    return this.synchro;
  }

  noterReseau(ok) {
    if (this.en_ligne !== ok) {
      this.en_ligne = ok;
      this.emettre({ type: 'etat_modifie' });
    }
  }

  async rafraichirLesPossedes() {
    const cle = this.cle();
    const steamid = this.steamidActif();
    if (!cle || !steamid || this.session) return;
    const avant = new Set(this.visibles().map((j) => j.id));
    try {
      const jeux = await api.jeuxPossedes(cle, steamid);
      this.noterReseau(true);
      if (this.d.cle_etat !== 'valide') { this.d.cle_etat = 'valide'; this.emettre({ type: 'etat_modifie' }); }
      if (jeux === null) {
        this.erreurPossedes = erreur('profil_prive');
        this.c.possedes = null;
      } else {
        this.erreurPossedes = null;
        this.c.possedes = {
          steamid,
          maj_le: iso(maintenant()),
          jeux: jeux.map((g) => ({ appid: g.appid, nom: g.name ?? null, minutes: g.playtime_forever ?? 0, minutes_2sem: g.playtime_2weeks ?? 0, dernier: g.rtime_last_played || null, icone: g.img_icon_url || null })),
        };
        for (const g of jeux) if (!this.d.vus[g.appid]) this.d.vus[g.appid] = iso(maintenant());
      }
      this.emettre({ type: 'etat_modifie' });
    } catch (e) {
      if (e.code === 'hors_ligne') this.noterReseau(false);
      else if (e.code === 'refus') {
        this.d.cle_etat = 'refusee';
        this.emettre({ type: 'etat_modifie' });
      }
      return;
    }
    const apres = this.visibles();
    this.signaler(apres.map((j) => j.id), [...avant].filter((id) => !apres.some((j) => j.id === id)));
    this.ecrireBientot();
  }

  /** Jaquettes, tags, avis… de tous les jeux visibles, par paquets de 100 (une poignée d'appels). */
  async completerLesArticles() {
    if (this.session) return;
    const limite = maintenant() - 7 * JOUR;
    const manquants = [...new Set([...this.appidsVisibles(), ...this.appidsDesExternes()])].filter((a) => {
      const art = this.c.articles[a];
      return !art || Date.parse(art.maj_le) < limite;
    });
    if (!manquants.length) return;
    // Les jeux installés et récents d'abord : ce sont ceux que l'on voit en premier.
    manquants.sort((a, b) => this.priorite(b) - this.priorite(a));
    for (let i = 0; i < manquants.length; i += 100) {
      const paquet = manquants.slice(i, i + 100);
      try {
        const items = await api.articles(paquet, api.DONNEES_GRILLE);
        this.noterReseau(true);
        const recus = new Map(items.map((it) => [it.id ?? it.appid, it]));
        for (const appid of paquet) {
          const it = recus.get(appid);
          this.c.articles[appid] = { maj_le: iso(maintenant()), a: it && it.success === 1 ? compacterArticle(it) : null };
        }
        this.signaler(paquet);
      } catch (e) {
        if (e.code === 'hors_ligne') this.noterReseau(false);
        return;
      }
    }
    this.ecrireBientot();
  }

  priorite(appid) {
    const t = this.temps(appid);
    return (this.installes.has(appid) ? 1e13 : 0) + (t.dernier_lancement ? Date.parse(t.dernier_lancement) : 0);
  }

  /** Nombre de succès débloqués des jeux joués, pour les compteurs de la grille et du profil. */
  async completerLesSucces() {
    const cle = this.cle();
    const steamid = this.steamidActif();
    if (!cle || !steamid || this.erreurPossedes) return;
    const limite = maintenant() - 3 * JOUR;
    const joues = this.appidsVisibles()
      .filter((a) => this.temps(a).minutes_total > 0)
      .filter((a) => { const s = this.c.succes[a]; return !s || Date.parse(s.maj_le) < limite; })
      .sort((a, b) => this.priorite(b) - this.priorite(a))
      .slice(0, 300);
    let i = 0;
    const travailleur = async () => {
      while (i < joues.length) {
        if (this.session) return;
        const appid = joues[i++];
        try {
          const liste = await api.succesDuJoueur(cle, steamid, appid);
          if (liste === null) return;
          const ancien = this.c.succes[appid];
          this.c.succes[appid] = {
            ...(ancien || {}),
            maj_le: iso(maintenant()),
            total: liste.length,
            debloques: liste.filter((s) => s.achieved === 1).length,
            perso: Object.fromEntries(liste.map((s) => [s.apiname, s.achieved === 1 ? s.unlocktime || 0 : -1])),
          };
          this.signaler([appid]);
        } catch (e) {
          if (e.code === 'hors_ligne' || e.code === 'quota_atteint') return;
        }
      }
    };
    await Promise.all([travailleur(), travailleur(), travailleur()]);
    this.ecrireBientot();
  }

  // ═════════════════════════════ Fabrication des jeux ═════════════════════════════

  personnelOk() {
    return this.erreurPersonnelle('progression') === null;
  }

  erreurPersonnelle(pour) {
    switch (this.d.cle_etat) {
      case 'absente': return erreur('cle_absente');
      case 'refusee': return erreur('cle_refusee');
      case 'non_verifiee': return erreur('hors_ligne');
      default:
        if (!this.steamidActif()) return erreur('launcher_absent', { source: 'steam' });
        if (pour === 'amis' && this.erreurAmis) return this.erreurAmis;
        return this.erreurPossedes;
    }
  }

  possedes() {
    const p = this.c.possedes;
    if (!p || p.steamid !== this.steamidActif() || !this.personnelOk()) return new Map();
    return new Map(p.jeux.map((g) => [g.appid, g]));
  }

  appidsVisibles() {
    return [...new Set([...this.installes.keys(), ...this.possedes().keys()])];
  }

  temps(appid) {
    const g = this.possedes().get(appid);
    const l = this.tempsLocaux.get(appid);
    if (g) {
      const dernier = Math.max(g.dernier || 0, l?.dernier || 0);
      return { minutes_total: Math.max(g.minutes, l?.minutes_total || 0), minutes_2sem: g.minutes_2sem, dernier_lancement: dernier ? iso(dernier * 1000) : null, origine: 'steam' };
    }
    if (l) return { minutes_total: l.minutes_total, minutes_2sem: null, dernier_lancement: l.dernier ? iso(l.dernier * 1000) : null, origine: 'steam' };
    return { minutes_total: 0, minutes_2sem: null, dernier_lancement: null, origine: 'steam' };
  }

  jeuSteam(appid) {
    const art = this.c.articles[appid]?.a ?? null;
    const inst = this.installes.get(appid);
    const g = this.possedes().get(appid);
    const p = this.d.perso[appid] || {};
    const nomOrigine = art?.nom || g?.nom || inst?.nom || `App ${appid}`;
    const titre = p.titre || nomOrigine;
    const s = this.c.succes[appid];
    const visuels = this.d.parametres.sources_en_ligne.visuels_magasin;
    let icone = art?.assets?.community_icon ? `${BASE_COMMUNAUTE}${appid}/${art.assets.community_icon}.jpg` : null;
    if (!icone && g?.icone) icone = `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${g.icone}.jpg`;
    return {
      id: appid,
      titre,
      titre_tri: titreTri(titre),
      sources: ['steam'],
      steam_appid: appid,
      installe: Boolean(inst?.complet),
      taille_octets: inst?.complet ? inst.taille_octets : null,
      ajoute_le: this.d.vus[appid] || iso(maintenant()),
      favori: Boolean(p.favori),
      masque: Boolean(p.masque),
      temps: this.tempsAvecPersonnel(this.temps(appid)),
      jaquette: visuels ? urlAsset(art?.assets, 'library_capsule') : null,
      icone,
      couleur_dominante: null,
      tags: art?.tags ?? [],
      modes: art?.modes ?? [],
      manette: art?.manette ?? null,
      avis: art?.avis ?? null,
      date_sortie: art?.sortie ?? null,
      succes: s && s.total > 0 ? { total: s.total, debloques: this.personnelOk() ? s.debloques ?? null : null } : null,
    };
  }

  tempsAvecPersonnel(t) {
    if (!this.personnelOk()) t.minutes_2sem = null;
    return t;
  }

  /** Temps de jeu compté par Blazon lui-même (jeux hors Steam). */
  tempsDesSessions(id_jeu) {
    const sessions = this.d.sessions.filter((s) => s.id_jeu === id_jeu);
    const total = Math.round(sessions.reduce((n, s) => n + s.duree_s, 0) / 60);
    const deuxSem = Math.round(sessions.filter((s) => Date.parse(s.debut) > maintenant() - 14 * JOUR).reduce((n, s) => n + s.duree_s, 0) / 60);
    const dernier = sessions.map((s) => s.debut).sort().pop() ?? null;
    return { minutes_total: total, minutes_2sem: deuxSem, dernier_lancement: dernier, origine: 'local' };
  }

  jeuManuel(m) {
    const p = this.d.perso[m.id] || {};
    const titre = p.titre || m.titre;
    return {
      id: m.id, titre, titre_tri: titreTri(titre), sources: ['manuel'], steam_appid: null,
      installe: fs.existsSync(m.chemin), taille_octets: null, ajoute_le: m.ajoute_le,
      favori: Boolean(p.favori), masque: Boolean(p.masque),
      temps: this.tempsDesSessions(m.id),
      jaquette: null, icone: m.icone ?? null, couleur_dominante: null, tags: [], modes: [], manette: null, avis: null, date_sortie: null, succes: null,
    };
  }

  /** Le même jeu sur le magasin Steam, s'il y est (pour la jaquette, les tags et la fiche). */
  appidDuMagasin(e) {
    return this.c.visuels_ext[`${e.source}:${e.id_source}`]?.appid ?? null;
  }

  appidsDesExternes() {
    return [...this.externes.values()].map((e) => this.appidDuMagasin(e)).filter(Boolean);
  }

  visuelsExternes(e) {
    const appid = this.appidDuMagasin(e);
    const art = appid ? this.c.articles[appid]?.a ?? null : null;
    const v = this.c.visuels_ext[`${e.source}:${e.id_source}`] || {};
    const ok = this.d.parametres.sources_en_ligne.visuels_magasin;
    return {
      art,
      appid,
      jaquette: ok ? urlAsset(art?.assets, 'library_capsule') || e.jaquette || v.jaquette || null : null,
      hero: ok ? urlAsset(art?.assets, 'library_hero') || e.hero || v.hero || null : null,
      en_tete: ok ? urlAsset(art?.assets, 'header') || null : null,
    };
  }

  jeuExterne(e) {
    const p = this.d.perso[e.id] || {};
    const titre = p.titre || e.titre;
    const { art, jaquette } = this.visuelsExternes(e);
    return {
      id: e.id, titre, titre_tri: titreTri(titre), sources: [e.source], steam_appid: null,
      installe: true, taille_octets: e.taille_octets ?? null, ajoute_le: this.d.vus[`${e.source}:${e.id_source}`] || iso(maintenant()),
      favori: Boolean(p.favori), masque: Boolean(p.masque),
      temps: this.tempsDesSessions(e.id),
      jaquette,
      icone: (e.exe && this.icones.get(e.exe)) || null,
      couleur_dominante: null,
      tags: art?.tags ?? [], modes: art?.modes ?? [], manette: art?.manette ?? null, avis: art?.avis ?? null, date_sortie: art?.sortie ?? null,
      succes: null,
    };
  }

  visibles() {
    return [
      ...this.appidsVisibles().map((a) => this.jeuSteam(a)),
      ...[...this.externes.values()].map((e) => this.jeuExterne(e)),
      ...this.d.manuels.map((m) => this.jeuManuel(m)),
    ];
  }

  jeuParId(id_jeu) {
    if (estExterne(id_jeu)) {
      const e = this.externes.get(id_jeu);
      if (!e) throw erreur('introuvable', { id_jeu });
      return this.jeuExterne(e);
    }
    if (id_jeu >= ID_MANUEL) {
      const m = this.d.manuels.find((x) => x.id === id_jeu);
      if (!m) throw erreur('introuvable', { id_jeu });
      return this.jeuManuel(m);
    }
    if (!this.appidsVisibles().includes(id_jeu)) throw erreur('introuvable', { id_jeu });
    return this.jeuSteam(id_jeu);
  }

  // ═════════════════════════════ Lectures en ligne (règle 4 du contrat) ═════════════════════════════

  blocage(source) {
    if (source && !this.d.parametres.sources_en_ligne[source]) return erreur('source_desactivee', { source });
    if (this.session) return erreur('mode_jeu');
    if (!this.en_ligne && !this.sondeEnCours) return erreur('hors_ligne');
    return null;
  }

  /**
   * Répond tout de suite avec le cache, puis rafraîchit en arrière-plan et prévient par
   * `donnees_rafraichies`. Un échec récent n'est pas retenté tout seul : seul « Réessayer » le fait.
   */
  lire({ cle, domaine, id_jeu, source, duree, enCache, produire, forcer = false }) {
    const cache = enCache();
    const bloque = this.blocage(source);
    const echec = this.echecs.get(cle);
    const fraicheur = cache ? { maj_le: cache.maj_le, origine: this.frais.has(cle) ? 'reseau' : 'cache' } : null;
    const perime = !cache || cache.provisoire || Date.parse(cache.maj_le) < maintenant() - duree;
    const recent = echec && maintenant() - echec.quand < 2 * MINUTE;
    if (echec?.definitif) return { donnees: null, fraicheur: null, rafraichissement: 'aucun', erreur: echec.erreur };
    if (bloque) {
      const transitoire = ['hors_ligne', 'mode_jeu', 'quota_atteint', 'source_coupee'].includes(bloque.code);
      if (bloque.code === 'hors_ligne' && perime && !recent) this.enFond(cle, domaine, id_jeu, produire);
      return { donnees: cache ? cache.donnees : null, fraicheur, rafraichissement: transitoire ? 'echoue' : 'aucun', erreur: bloque };
    }
    if (this.enCours.has(cle)) return { donnees: cache ? cache.donnees : null, fraicheur, rafraichissement: 'en_cours', erreur: null };
    if ((perime && !recent) || forcer) {
      this.enFond(cle, domaine, id_jeu, produire);
      return { donnees: cache ? cache.donnees : null, fraicheur, rafraichissement: 'en_cours', erreur: null };
    }
    if (recent && echec) return { donnees: cache ? cache.donnees : null, fraicheur, rafraichissement: 'echoue', erreur: echec.erreur };
    return { donnees: cache.donnees, fraicheur, rafraichissement: 'aucun', erreur: null };
  }

  enFond(cle, domaine, id_jeu, produire) {
    if (this.enCours.has(cle)) return;
    const p = (async () => {
      try {
        await produire();
        this.echecs.delete(cle);
        this.frais.add(cle);
        this.noterReseau(true);
        this.ecrireBientot();
      } catch (e) {
        const code = e?.code;
        if (code === 'hors_ligne') this.noterReseau(false);
        if (code === 'amis_prives') {
          this.echecs.set(cle, { erreur: erreur('amis_prives'), quand: maintenant() });
        } else if (code === 'jeu_sans_succes' || code === 'jeu_non_steam' || code === 'introuvable') {
          this.echecs.set(cle, { erreur: erreur(code), quand: maintenant(), definitif: true });
        } else if (code === 'refus') {
          this.echecs.set(cle, { erreur: erreur('cle_refusee'), quand: maintenant() });
        } else {
          this.echecs.set(cle, { erreur: erreur(['hors_ligne', 'quota_atteint'].includes(code) ? code : 'interne'), quand: maintenant() });
        }
      } finally {
        this.enCours.delete(cle);
        this.emettre({ type: 'donnees_rafraichies', domaine, id_jeu });
      }
    })();
    this.enCours.set(cle, p);
  }

  // ═════════════════════════════ Commandes du contrat ═════════════════════════════

  async etat() {
    await this.charge;
    if (!this.demarre) void this.demarrer();
    const cleEtat = this.d.cle_etat;
    const niveau = cleEtat === 'valide' && this.steamidActif() && !this.erreurPossedes ? 'personnel' : this.en_ligne ? 'public' : 'local';
    return {
      version: this.o.version,
      en_ligne: this.en_ligne,
      niveau,
      steam_installe: this.steam !== null,
      cle: cleEtat,
      premier_lancement: this.d.premier_lancement,
      scan: { ...this.scan },
      session_en_cours: this.session ? { id_jeu: this.session.id_jeu, debut: this.session.debut } : null,
      jeux_possedes_erreur: this.erreurPersonnelle('progression'),
      sources_coupees: [],
      mise_a_jour: null,
    };
  }

  async referentiels(langue) {
    const r = this.o.referentiels[langue] ?? this.o.referentiels.fr;
    return structuredClone(r);
  }

  async parametres() {
    await this.charge;
    return structuredClone(this.d.parametres);
  }

  async modifier_parametres(p) {
    await this.charge;
    const avantVisuels = this.d.parametres.sources_en_ligne.visuels_magasin;
    this.d.parametres = structuredClone(p);
    this.ecrireBientot();
    this.emettre({ type: 'etat_modifie' });
    if (avantVisuels !== p.sources_en_ligne.visuels_magasin) this.signaler(this.visibles().map((j) => j.id));
    if (this.o.demarrerAvecWindows) this.o.demarrerAvecWindows(p.demarrer_avec_windows);
    return structuredClone(this.d.parametres);
  }

  async terminer_premier_lancement() {
    this.d.premier_lancement = false;
    await this.ecrire();
    this.emettre({ type: 'etat_modifie' });
  }

  async tout_effacer() {
    const retires = this.visibles().map((j) => j.id);
    this.d = donneesNeuves();
    this.c = cacheNeuf();
    this.frais.clear();
    this.echecs.clear();
    this.erreurPossedes = null;
    this.erreurAmis = null;
    await this.ecrire();
    this.emettre({ type: 'bibliotheque_modifiee', modifies: [], retires });
    this.emettre({ type: 'etat_modifie' });
    await this.scanner(true);
  }

  async installer_la_mise_a_jour() {
    throw erreur('introuvable');
  }

  async rafraichir(domaine, id_jeu) {
    if (domaine === 'bibliotheque') {
      this.echecs.clear();
      await this.scanner();
      await this.synchroniser();
      this.emettre({ type: 'donnees_rafraichies', domaine, id_jeu: null });
      return;
    }
    const cles = { fiche: `fiche:${id_jeu}`, succes: `succes:${id_jeu}`, actualites: id_jeu === null ? 'fil' : `actus:${id_jeu}`, amis: 'amis', profil: 'profil' };
    const cle = cles[domaine];
    this.echecs.delete(cle);
    this.sondeEnCours = true;
    try {
      const lecteurs = { fiche: () => this.fiche_du_jeu(id_jeu, true), succes: () => this.succes_du_jeu(id_jeu, true), actualites: () => (id_jeu === null ? this.fil_d_actualites(1, null, true) : this.actualites_du_jeu(id_jeu, 1, null, true)), amis: () => this.amis(true), profil: () => this.profil(true) };
      await lecteurs[domaine]();
    } finally {
      this.sondeEnCours = false;
    }
  }

  async comptes_steam() {
    await this.charge;
    const actif = this.steamidActif();
    return this.comptesLocaux.map((c) => ({ steamid: c.steamid, pseudo: c.pseudo, actif: c.steamid === actif }));
  }

  async choisir_le_compte(steamid) {
    if (!this.comptesLocaux.some((c) => c.steamid === steamid)) throw erreur('introuvable');
    const avant = this.visibles().map((j) => j.id);
    this.d.compte = steamid;
    this.c.possedes = null;
    this.c.amis = null;
    this.c.profil = null;
    this.c.succes = {};
    this.echecs.clear();
    this.tempsLocaux = this.steam ? await local.tempsLocaux(this.steam, steamid) : new Map();
    this.ecrireBientot();
    this.signaler(this.visibles().map((j) => j.id), avant);
    this.emettre({ type: 'etat_modifie' });
    this.emettre({ type: 'donnees_rafraichies', domaine: 'profil', id_jeu: null });
    void this.synchroniser();
  }

  async lister_jeux() {
    await this.charge;
    if (!this.demarre) void this.demarrer();
    return this.visibles();
  }

  async jeux(ids) {
    const voulus = new Set(ids);
    return this.visibles().filter((j) => voulus.has(j.id));
  }

  async detail_jeu(id_jeu) {
    const resume = this.jeuParId(id_jeu);
    const sessions_recentes = this.sessionsDe(id_jeu, 10, null);
    if (estExterne(id_jeu)) {
      const e = this.externes.get(id_jeu);
      const v = this.visuelsExternes(e);
      return {
        resume,
        sources: [{ source: e.source, id_source: e.id_source, installe: true, dossier: e.dossier, exe: this.d.exes[id_jeu] ?? e.exe, taille_octets: resume.taille_octets, vu_le: this.scan.dernier || iso(maintenant()) }],
        hero: v.hero, logo: null, en_tete: v.en_tete, sessions_recentes,
      };
    }
    if (resume.steam_appid === null) {
      const m = this.d.manuels.find((x) => x.id === id_jeu);
      return {
        resume,
        sources: [{ source: 'manuel', id_source: m.chemin, installe: resume.installe, dossier: path.dirname(m.chemin), exe: m.chemin, taille_octets: null, vu_le: this.scan.dernier || iso(maintenant()) }],
        hero: null, logo: null, en_tete: null, sessions_recentes,
      };
    }
    const appid = resume.steam_appid;
    const art = this.c.articles[appid]?.a ?? null;
    const inst = this.installes.get(appid);
    const visuels = this.d.parametres.sources_en_ligne.visuels_magasin;
    const ancienStyle = art?.assets?.library_capsule && !art.assets.library_capsule.includes('/');
    return {
      resume,
      sources: [{ source: 'steam', id_source: String(appid), installe: resume.installe, dossier: inst?.dossier ?? null, exe: this.d.exes[appid] ?? null, taille_octets: resume.taille_octets, vu_le: this.scan.dernier || iso(maintenant()) }],
      hero: visuels ? urlAsset(art?.assets, 'library_hero') : null,
      logo: visuels && ancienStyle ? `${BASE_ASSETS}steam/apps/${appid}/logo.png` : null,
      en_tete: visuels ? urlAsset(art?.assets, 'header') : null,
      sessions_recentes,
    };
  }

  sessionsDe(id_jeu, limite, avant) {
    return this.d.sessions
      .filter((s) => s.id_jeu === id_jeu && (avant === null || s.debut < avant))
      .sort((a, b) => b.debut.localeCompare(a.debut))
      .slice(0, Math.max(0, limite))
      .map((s) => ({ ...s }));
  }

  async lister_sessions(id_jeu, limite, avant) {
    this.jeuParId(id_jeu);
    return this.sessionsDe(id_jeu, limite, avant);
  }

  modifierPerso(id_jeu, changement) {
    this.jeuParId(id_jeu);
    this.d.perso[id_jeu] = { ...(this.d.perso[id_jeu] || {}), ...changement };
    this.ecrireBientot();
    this.signaler([id_jeu]);
  }

  async definir_favori(id_jeu, favori) { this.modifierPerso(id_jeu, { favori }); }
  async definir_masque(id_jeu, masque) { this.modifierPerso(id_jeu, { masque }); }
  async renommer_un_jeu(id_jeu, titre) {
    const propre = String(titre).trim();
    if (!propre || propre.length > 200) throw erreur('chemin_invalide');
    this.modifierPerso(id_jeu, { titre: propre });
  }

  async relancer_le_scan() {
    await this.scanner();
    void this.synchroniser();
  }

  // ───────────── Ajout manuel ─────────────

  async analyser_un_chemin(chemin) {
    let cible = String(chemin || '').trim().replace(/^"|"$/g, '');
    if (!path.isAbsolute(cible) || !/\.(exe|lnk|url|bat)$/i.test(cible)) throw erreur('chemin_invalide');
    if (!fs.existsSync(cible)) throw erreur('exe_introuvable');
    if (/\.lnk$/i.test(cible)) {
      const r = this.o.raccourci(cible);
      if (!r?.cible) throw erreur('chemin_invalide');
      cible = r.cible;
    } else if (/\.url$/i.test(cible)) {
      const texte = await fsp.readFile(cible, 'utf8').catch(() => '');
      const m = texte.match(/^URL=(.+)$/m);
      if (!m) throw erreur('chemin_invalide');
      const steam = m[1].trim().match(/^steam:\/\/rungameid\/(\d+)/);
      if (steam) {
        const appid = Number(steam[1]);
        return { titre_propose: this.c.articles[appid]?.a?.nom ?? path.basename(chemin, path.extname(chemin)), cible: m[1].trim(), source: 'steam', icone: null, doublon_de: this.appidsVisibles().includes(appid) ? appid : null };
      }
      cible = m[1].trim();
    }
    const doublon = this.d.manuels.find((m) => m.chemin.toLowerCase() === cible.toLowerCase());
    const titre = path.basename(chemin, path.extname(chemin)).replace(/[_.]+/g, ' ').trim();
    return { titre_propose: titre, cible, source: 'manuel', icone: await this.o.icone(cible).catch(() => null), doublon_de: doublon ? doublon.id : null };
  }

  async ajouter_un_jeu_manuel(chemin, titre) {
    const a = await this.analyser_un_chemin(chemin);
    if (a.doublon_de !== null) throw erreur('deja_present', { id_jeu: a.doublon_de });
    if (a.source === 'steam') throw erreur('deja_present');
    const id = Math.max(ID_MANUEL, ...this.d.manuels.map((m) => m.id).filter((x) => !estExterne(x))) + 1;
    const m = { id, titre: String(titre || a.titre_propose).trim() || a.titre_propose, chemin: a.cible, icone: a.icone, ajoute_le: iso(maintenant()) };
    this.d.manuels.push(m);
    await this.ecrire();
    this.signaler([id]);
    return this.jeuManuel(m);
  }

  async retirer_un_jeu_manuel(id_jeu) {
    const i = this.d.manuels.findIndex((m) => m.id === id_jeu);
    if (i < 0) throw erreur('introuvable', { id_jeu });
    this.d.manuels.splice(i, 1);
    this.d.sessions = this.d.sessions.filter((s) => s.id_jeu !== id_jeu);
    delete this.d.perso[id_jeu];
    this.ecrireBientot();
    this.signaler([], [id_jeu]);
  }

  async choisir_l_exe(id_jeu, source, chemin) {
    if (!fs.existsSync(chemin)) throw erreur('exe_introuvable');
    if (source === 'manuel') {
      const m = this.d.manuels.find((x) => x.id === id_jeu);
      if (!m) throw erreur('introuvable', { id_jeu });
      m.chemin = chemin;
    } else this.d.exes[id_jeu] = chemin;
    this.ecrireBientot();
    this.signaler([id_jeu]);
  }

  // ───────────── Lancement et sessions ─────────────

  async lancer(id_jeu, source) {
    const jeu = this.jeuParId(id_jeu);
    if (this.session) throw erreur('lancement_echoue', { id_jeu });
    if (jeu.steam_appid !== null && source !== 'manuel') {
      if (!this.steam) throw erreur('launcher_absent', { source: 'steam' });
      this.lancementAttendu = { id_jeu, quand: maintenant() };
      await this.o.ouvrirExterne(`steam://rungameid/${jeu.steam_appid}`);
      setTimeout(() => {
        if (this.lancementAttendu?.id_jeu === id_jeu && !this.session) {
          this.lancementAttendu = null;
          this.emettre({ type: 'lancement_sans_session', id_jeu });
        }
      }, 120_000);
      return;
    }
    if (estExterne(id_jeu)) return this.lancerExterne(this.externes.get(id_jeu));
    const m = this.d.manuels.find((x) => x.id === id_jeu);
    if (!m || !fs.existsSync(m.chemin)) throw erreur('exe_introuvable', { id_jeu });
    let processus;
    try { processus = await this.o.lancerExe(m.chemin); } catch { throw erreur('lancement_echoue', { id_jeu }); }
    this.commencerSession(id_jeu, null, 'launcher');
    processus.fin.then(() => this.finirSession());
  }

  /**
   * GOG : on lance l'exécutable du jeu (pas de DRM), la partie dure tant que son processus vit.
   * Epic et EA : c'est leur launcher qui lance le jeu (connexion, protections) ; on suit ensuite
   * le processus du jeu par son nom.
   */
  async lancerExterne(e) {
    const id_jeu = e.id;
    const choisi = this.d.exes[id_jeu] && fs.existsSync(this.d.exes[id_jeu]) ? this.d.exes[id_jeu] : null;
    const direct = choisi || (e.source === 'gog' || !e.url ? e.exe : null);
    if (direct) {
      let processus;
      try { processus = await this.o.lancerExe(direct, choisi ? [] : e.args || [], choisi ? path.dirname(choisi) : e.cwd); } catch { throw erreur('lancement_echoue', { id_jeu }); }
      this.commencerSession(id_jeu, null, 'launcher');
      processus.fin.then(() => {
        // Certains jeux GOG passent la main à un second exécutable : on le suit s'il tourne encore.
        if (this.session?.id_jeu === id_jeu) {
          this.session.processus = path.basename(direct).toLowerCase();
          this.session.parProcessus = true;
          void this.surveillerUnProcessus();
        }
      });
      return;
    }
    if (!e.url) throw erreur('exe_introuvable', { id_jeu });
    try { await this.o.ouvrirExterne(e.url); } catch { throw erreur('launcher_absent', { source: e.source }); }
    this.lancementAttendu = { id_jeu, quand: maintenant(), processus: e.exe ? path.basename(e.exe).toLowerCase() : null };
    setTimeout(() => {
      if (this.lancementAttendu?.id_jeu === id_jeu && !this.session) {
        this.lancementAttendu = null;
        this.emettre({ type: 'lancement_sans_session', id_jeu });
      }
    }, 120_000);
  }

  /** Fin d'une partie suivie par le nom de son processus (jeux Epic et EA, relais GOG). */
  async surveillerUnProcessus() {
    const s = this.session;
    if (!s?.parProcessus) return;
    const noms = await autres.processusEnCours();
    if (noms && this.session === s && !noms.has(s.processus)) this.finirSession();
  }

  /** Une partie d'un jeu GOG, Epic ou EA a-t-elle commencé (lancée d'ici ou d'ailleurs) ? */
  async detecterUnJeuExterne() {
    const attendu = this.lancementAttendu && estExterne(this.lancementAttendu.id_jeu) ? this.lancementAttendu : null;
    this.tic = (this.tic || 0) + 1;
    // Sans lancement attendu, un coup d'œil toutes les 15 s suffit pour les jeux lancés ailleurs.
    if (!attendu && this.tic % 3 !== 0) return;
    const parNom = new Map();
    for (const e of this.externes.values()) if (e.exe) parNom.set(path.basename(e.exe).toLowerCase(), e.id);
    if (!parNom.size) return;
    const noms = await autres.processusEnCours();
    if (!noms || this.session) return;
    for (const [nom, id_jeu] of parNom) {
      if (!noms.has(nom)) continue;
      const lance = attendu?.id_jeu === id_jeu;
      this.lancementAttendu = null;
      this.commencerSession(id_jeu, null, lance ? 'launcher' : 'detectee');
      this.session.processus = nom;
      this.session.parProcessus = true;
      this.signaler([id_jeu]);
      return;
    }
  }

  commencerSession(id_jeu, appid, origine) {
    const debut = iso(maintenant());
    this.session = { id_jeu, appid, debut, origine };
    this.emettre({ type: 'session_demarree', id_jeu, debut });
    this.emettre({ type: 'etat_modifie' });
  }

  finirSession() {
    const s = this.session;
    if (!s) return;
    this.session = null;
    const fin = maintenant();
    const duree_s = Math.max(0, Math.round((fin - Date.parse(s.debut)) / 1000));
    const id = (this.d.sessions.reduce((n, x) => Math.max(n, x.id), 0) || 0) + 1;
    this.d.sessions.push({ id, id_jeu: s.id_jeu, debut: s.debut, fin: iso(fin), duree_s, origine: s.origine });
    let temps;
    if (s.appid !== null) {
      // Steam met son compteur à jour un peu plus tard : on ajoute la session à ce qu'on sait déjà.
      const avant = this.temps(s.appid);
      const ajout = Math.round(duree_s / 60);
      const l = this.tempsLocaux.get(s.appid) || { minutes_total: avant.minutes_total, minutes_2sem: avant.minutes_2sem, dernier: null };
      l.minutes_total = avant.minutes_total + ajout;
      l.dernier = Math.floor(fin / 1000);
      this.tempsLocaux.set(s.appid, l);
      const g = this.possedes().get(s.appid);
      if (g) { g.minutes += ajout; g.minutes_2sem = (g.minutes_2sem || 0) + ajout; g.dernier = Math.floor(fin / 1000); }
      temps = this.jeuSteam(s.appid).temps;
    } else if (estExterne(s.id_jeu)) temps = this.tempsDesSessions(s.id_jeu);
    else temps = this.jeuManuel(this.d.manuels.find((m) => m.id === s.id_jeu)).temps;
    this.ecrireBientot();
    this.emettre({ type: 'session_terminee', id_jeu: s.id_jeu, duree_s, temps, succes_debloques: [] });
    this.emettre({ type: 'etat_modifie' });
    this.signaler([s.id_jeu]);
    if (s.appid !== null) {
      // Puis on relit Steam : vrai temps de jeu et succès gagnés pendant la partie.
      delete this.c.succes[s.appid]?.maj_le;
      this.echecs.delete(`succes:${s.appid}`);
      setTimeout(() => {
        void this.rafraichirLesPossedes();
        this.emettre({ type: 'donnees_rafraichies', domaine: 'succes', id_jeu: s.appid });
      }, 20_000);
    }
  }

  async surveillerLaSession() {
    if (this.session?.parProcessus) return this.surveillerUnProcessus();
    if (this.session && this.session.appid === null) return; // jeu lancé par Blazon : suivi par son processus
    if (!this.session) await this.detecterUnJeuExterne();
    if (this.session) return;
    let appid = 0;
    try { appid = await local.jeuEnCours(); } catch { return; }
    if (this.session && appid !== this.session.appid) this.finirSession();
    if (!this.session && appid > 0 && !local.OUTILS.has(appid)) {
      const id_jeu = appid;
      const lance = this.lancementAttendu?.id_jeu === id_jeu && maintenant() - this.lancementAttendu.quand < 5 * MINUTE;
      this.lancementAttendu = null;
      this.commencerSession(id_jeu, appid, lance ? 'launcher' : 'detectee');
      if (!this.appidsVisibles().includes(appid)) this.installes.set(appid, { appid, nom: `App ${appid}`, dossier: null, taille_octets: null, complet: true });
      this.signaler([id_jeu]);
    }
  }

  async ouvrir_le_dossier(id_jeu) {
    const d = await this.detail_jeu(id_jeu);
    const dossier = d.sources.find((s) => s.dossier)?.dossier;
    if (!dossier || !fs.existsSync(dossier)) throw erreur('exe_introuvable', { id_jeu });
    await this.o.ouvrirDossier(dossier);
  }

  async action_steam(a) {
    const sansSteam = {
      voir_dans_le_magasin: () => `https://store.steampowered.com/app/${a.steam_appid}/`,
      ouvrir_le_profil: () => `https://steamcommunity.com/profiles/${a.steamid}`,
    };
    if (!this.steam) {
      if (sansSteam[a.action]) return this.o.ouvrirExterne(sansSteam[a.action]());
      throw erreur('launcher_absent', { source: 'steam' });
    }
    const liens = {
      voir_dans_le_magasin: () => `steam://store/${a.steam_appid}`,
      installer: () => `steam://install/${a.steam_appid}`,
      desinstaller: () => `steam://uninstall/${a.steam_appid}`,
      envoyer_un_message: () => `steam://friends/message/${a.steamid}`,
      ouvrir_le_profil: () => `steam://url/SteamIDPage/${a.steamid}`,
    };
    const f = liens[a.action];
    if (!f) throw erreur('interne');
    await this.o.ouvrirExterne(f());
  }

  async ouvrir_un_lien(url) {
    if (!/^https:\/\/[^\s]+$/i.test(url)) throw erreur('chemin_invalide');
    await this.o.ouvrirExterne(url);
  }

  // ───────────── Fiche du magasin ─────────────

  /** Appid du magasin Steam d'un jeu : le sien, ou celui du même jeu pour GOG, Epic et EA. */
  appidPourLaFiche(id_jeu) {
    const jeu = this.jeuParId(id_jeu);
    if (jeu.steam_appid !== null) return jeu.steam_appid;
    return estExterne(id_jeu) ? this.appidDuMagasin(this.externes.get(id_jeu)) : null;
  }

  async fiche_du_jeu(id_jeu, forcer = false) {
    const appid = this.appidPourLaFiche(id_jeu);
    if (appid === null) return { donnees: null, fraicheur: null, rafraichissement: 'aucun', erreur: erreur('jeu_non_steam') };
    const cle = `fiche:${id_jeu}`;
    return this.lire({
      cle, domaine: 'fiche', id_jeu, source: 'fiches_magasin', duree: JOUR, forcer,
      enCache: () => {
        const f = this.c.fiches[appid];
        if (!f) return null;
        const fiche = structuredClone(f.fiche);
        if (!this.d.parametres.sources_en_ligne.joueurs_en_ligne) fiche.joueurs_en_ligne = null;
        return { maj_le: f.maj_le, donnees: fiche };
      },
      produire: async () => {
        const [it] = await api.articles([appid], api.DONNEES_FICHE);
        if (!it || it.success !== 1) throw { code: 'introuvable' };
        let joueurs = null;
        if (this.d.parametres.sources_en_ligne.joueurs_en_ligne) joueurs = await api.joueursEnLigne(appid).catch(() => null);
        this.c.fiches[appid] = { maj_le: iso(maintenant()), fiche: ficheDepuisArticle(it, id_jeu, joueurs) };
        if (this.c.articles[appid]?.a && it.assets) this.c.articles[appid].a.assets = it.assets;
      },
    });
  }

  // ───────────── Succès ─────────────

  async succes_du_jeu(id_jeu, forcer = false) {
    const jeu = this.jeuParId(id_jeu);
    if (jeu.steam_appid === null) return { donnees: null, fraicheur: null, rafraichissement: 'aucun', erreur: erreur('jeu_non_steam') };
    const appid = jeu.steam_appid;
    const sansSucces = this.c.succes[appid]?.liste && this.c.succes[appid].liste.length === 0;
    if (sansSucces && !forcer) return { donnees: null, fraicheur: null, rafraichissement: 'aucun', erreur: erreur('jeu_sans_succes') };
    return this.lire({
      cle: `succes:${id_jeu}`, domaine: 'succes', id_jeu, source: 'succes_publics', duree: 6 * HEURE, forcer,
      enCache: () => {
        const s = this.c.succes[appid];
        if (!s?.liste || !s.maj_le) return null;
        return { maj_le: s.maj_le, donnees: this.succesExposes(id_jeu, appid, s) };
      },
      produire: async () => {
        const publics = await api.succesPublics(appid);
        const ancien = this.c.succes[appid] || {};
        if (!publics.length) {
          this.c.succes[appid] = { ...ancien, maj_le: iso(maintenant()), liste: [], total: 0 };
          throw { code: 'jeu_sans_succes' };
        }
        let perso = ancien.perso ?? null;
        let prive = false;
        const cle = this.cle();
        const steamid = this.steamidActif();
        if (cle && steamid && this.d.cle_etat === 'valide') {
          const liste = await api.succesDuJoueur(cle, steamid, appid).catch((e) => { if (e.code === 'hors_ligne') throw e; return undefined; });
          if (liste === null) prive = true;
          else if (liste) perso = Object.fromEntries(liste.map((s) => [s.apiname, s.achieved === 1 ? s.unlocktime || 0 : -1]));
        }
        const base = BASE_COMMUNAUTE + appid + '/';
        this.c.succes[appid] = {
          maj_le: iso(maintenant()),
          total: publics.length,
          prive,
          perso,
          debloques: perso ? Object.values(perso).filter((t) => t >= 0).length : null,
          liste: publics.map((s) => ({
            api_name: s.internal_name,
            nom: s.localized_name || s.internal_name,
            description: s.localized_desc || null,
            secret: Boolean(s.hidden),
            icone: base + s.icon,
            icone_grise: base + s.icon_gray,
            pct_mondial: s.player_percent_unlocked ? Number(s.player_percent_unlocked) : null,
          })),
        };
        this.signaler([id_jeu]);
      },
    });
  }

  succesExposes(id_jeu, appid, s) {
    let manque = this.erreurPersonnelle('progression');
    if (!manque && s.prive) manque = erreur('profil_prive');
    const perso = manque ? null : s.perso;
    const liste = s.liste.map((x) => {
      const t = perso ? perso[x.api_name] : undefined;
      return { ...x, debloque: perso ? t !== undefined && t >= 0 : null, debloque_le: perso && t > 0 ? iso(t * 1000) : null };
    });
    return {
      id_jeu,
      langue: 'fr',
      total: liste.length,
      debloques: perso ? liste.filter((x) => x.debloque).length : null,
      progression_erreur: manque,
      liste,
    };
  }

  // ───────────── Amis et profil ─────────────

  async amis(forcer = false) {
    await this.charge;
    const manque = this.erreurPersonnelle('amis');
    if (manque && !(manque.code === 'amis_prives' && forcer)) return { donnees: null, fraicheur: null, rafraichissement: 'aucun', erreur: manque };
    const steamid = this.steamidActif();
    return this.lire({
      cle: 'amis', domaine: 'amis', id_jeu: null, source: null, duree: 2 * MINUTE, forcer,
      enCache: () => (this.c.amis && this.c.amis.steamid === steamid ? { maj_le: this.c.amis.maj_le, donnees: this.c.amis.prive ? null : structuredClone(this.c.amis.liste) } : null),
      produire: async () => {
        const cle = this.cle();
        const liste = await api.listeDAmis(cle, steamid);
        if (liste === null) {
          this.erreurAmis = erreur('amis_prives');
          this.c.amis = { steamid, maj_le: iso(maintenant()), prive: true, liste: [] };
          throw { code: 'amis_prives' };
        }
        this.erreurAmis = null;
        const depuis = new Map(liste.map((f) => [f.steamid, f.friend_since]));
        const resumes = await api.resumesJoueurs(cle, liste.map((f) => f.steamid));
        // Jaquettes des jeux en cours que nous n'avons pas encore vus.
        const enJeu = [...new Set(resumes.map((p) => Number(p.gameid)).filter((a) => a > 0 && a < 2 ** 31))];
        const inconnus = enJeu.filter((a) => !this.c.articles[a]);
        if (inconnus.length) {
          const items = await api.articles(inconnus, api.DONNEES_GRILLE).catch(() => []);
          for (const it of items) if (it.success === 1) this.c.articles[it.id ?? it.appid] = { maj_le: iso(maintenant()), a: compacterArticle(it) };
        }
        const visibles = new Set(this.appidsVisibles());
        this.c.amis = {
          steamid,
          maj_le: iso(maintenant()),
          liste: resumes.map((p) => this.ami(p, depuis.get(p.steamid), visibles)).sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr')),
        };
      },
    });
  }

  ami(p, depuis, visibles) {
    const etats = { 0: 'hors_ligne', 1: 'en_ligne', 2: 'occupe', 3: 'absent', 4: 'absent', 5: 'en_ligne', 6: 'en_ligne' };
    let jeu = null;
    if (p.gameid || p.gameextrainfo) {
      const appid = Number(p.gameid);
      const steamAppid = appid > 0 && appid < 2 ** 31 ? appid : null;
      const art = steamAppid ? this.c.articles[steamAppid]?.a : null;
      jeu = {
        titre: p.gameextrainfo || art?.nom || '',
        steam_appid: steamAppid,
        id_jeu: steamAppid && visibles.has(steamAppid) ? steamAppid : null,
        jaquette: urlAsset(art?.assets, 'library_capsule'),
        couleur_dominante: null,
      };
    }
    return {
      steamid: p.steamid,
      pseudo: p.personaname || p.steamid,
      avatar: p.avatarfull || p.avatarmedium || null,
      statut: jeu ? 'en_jeu' : etats[p.personastate] ?? 'hors_ligne',
      jeu_en_cours: jeu,
      derniere_connexion: p.lastlogoff ? iso(p.lastlogoff * 1000) : null,
      ami_depuis: depuis ? iso(depuis * 1000) : null,
    };
  }

  async profil(forcer = false) {
    await this.charge;
    const steamid = this.steamidActif();
    const compte = this.comptesLocaux.find((c) => c.steamid === steamid);
    const manque = this.erreurPersonnelle('progression');
    if (manque || !steamid) {
      return {
        donnees: { steamid, pseudo: compte?.pseudo ?? null, avatar: null },
        fraicheur: { maj_le: this.scan.dernier || iso(maintenant()), origine: 'local' },
        rafraichissement: 'aucun',
        erreur: steamid ? manque : null,
      };
    }
    return this.lire({
      cle: 'profil', domaine: 'profil', id_jeu: null, source: null, duree: 30 * MINUTE, forcer,
      enCache: () => (this.c.profil?.donnees?.steamid === steamid ? this.c.profil : { maj_le: this.scan.dernier || iso(maintenant()), donnees: { steamid, pseudo: compte?.pseudo ?? null, avatar: null }, provisoire: true }),
      produire: async () => {
        const [p] = await api.resumesJoueurs(this.cle(), [steamid]);
        if (!p) throw { code: 'introuvable' };
        this.c.profil = { maj_le: iso(maintenant()), donnees: { steamid, pseudo: p.personaname || compte?.pseudo || null, avatar: p.avatarfull || null } };
      },
    });
  }

  // ───────────── Actualités ─────────────

  actualite(ev, appid) {
    const ab = ev.announcement_body || {};
    if (!ab.body || !ev.event_name) return null;
    const corps = bbcodeVersHtml(ab.body);
    let image = null;
    try {
      const jd = JSON.parse(ev.jsondata || '{}');
      const fichiers = (jd && (jd.localized_capsule_image || jd.localized_title_image)) || [];
      const nom = [fichiers[2], fichiers[0]].find((f) => f);
      if (nom && /^[\w.-]+$/.test(nom)) image = `${BASE_CLAN}${ab.clanid}/${nom}`;
    } catch { /* pas d'image */ }
    return {
      id: String(ev.gid),
      id_jeu: appid,
      steam_appid: appid,
      titre: String(ev.event_name).trim(),
      resume: texteBrut(corps),
      html_sur: corps,
      langue: { 0: 'en', 2: 'fr' }[ab.language] ?? 'autre',
      type: [12, 13, 14].includes(ev.event_type) ? 'mise_a_jour' : 'annonce',
      date: iso((ev.rtime32_start_time || ab.posttime || 0) * 1000),
      url: `https://store.steampowered.com/news/app/${appid}/view/${ev.gid}`,
      image,
    };
  }

  async chargerActus(appid, nombre) {
    const evenements = await api.annonces(appid, nombre);
    const liste = evenements.map((ev) => this.actualite(ev, appid)).filter(Boolean);
    this.c.actus[appid] = { maj_le: iso(maintenant()), liste };
    return liste;
  }

  page(liste, limite, avant) {
    return liste.filter((a) => avant === null || a.date < avant).sort((a, b) => b.date.localeCompare(a.date)).slice(0, Math.max(0, limite));
  }

  async actualites_du_jeu(id_jeu, limite, avant, forcer = false) {
    const appid = this.appidPourLaFiche(id_jeu);
    if (appid === null) return { donnees: null, fraicheur: null, rafraichissement: 'aucun', erreur: erreur('jeu_non_steam') };
    return this.lire({
      cle: `actus:${id_jeu}`, domaine: 'actualites', id_jeu, source: 'actualites', duree: 6 * HEURE, forcer,
      enCache: () => (this.c.actus[appid] ? { maj_le: this.c.actus[appid].maj_le, donnees: this.page(this.c.actus[appid].liste, limite, avant) } : null),
      produire: () => this.chargerActus(appid, 20),
    });
  }

  suivisPourLeFil() {
    const seuil = maintenant() - 30 * JOUR;
    return this.visibles()
      .filter((j) => j.steam_appid !== null && !j.masque && (j.installe || (j.temps.dernier_lancement && Date.parse(j.temps.dernier_lancement) >= seuil)))
      .sort((a, b) => (Date.parse(b.temps.dernier_lancement || 0) || 0) - (Date.parse(a.temps.dernier_lancement || 0) || 0))
      .slice(0, 30)
      .map((j) => j.steam_appid);
  }

  async fil_d_actualites(limite, avant, forcer = false) {
    await this.charge;
    return this.lire({
      cle: 'fil', domaine: 'actualites', id_jeu: null, source: 'actualites', duree: 3 * HEURE, forcer,
      enCache: () => {
        if (!this.c.fil) return null;
        const suivis = new Set(this.suivisPourLeFil());
        const tout = [...suivis].flatMap((a) => this.c.actus[a]?.liste ?? []);
        return { maj_le: this.c.fil.maj_le, donnees: this.page(tout, limite, avant) };
      },
      produire: async () => {
        const suivis = this.suivisPourLeFil();
        let i = 0;
        let reussis = 0;
        let derniere = null;
        const travailleur = async () => {
          while (i < suivis.length) {
            const appid = suivis[i++];
            const c = this.c.actus[appid];
            if (c && Date.parse(c.maj_le) > maintenant() - 3 * HEURE) { reussis++; continue; }
            try { await this.chargerActus(appid, 6); reussis++; } catch (e) { derniere = e; }
          }
        };
        await Promise.all([travailleur(), travailleur(), travailleur(), travailleur()]);
        if (reussis === 0 && derniere) throw derniere;
        this.c.fil = { maj_le: iso(maintenant()) };
      },
    });
  }

  // ───────────── Clé API ─────────────

  async enregistrer_la_cle(saisie) {
    await this.charge;
    const cle = String(saisie || '').trim();
    if (!/^[0-9A-Fa-f]{32}$/.test(cle)) {
      return { etat: 'refusee', pseudo: null, erreur: erreur('cle_refusee') };
    }
    const steamid = this.steamidActif();
    let pseudo = null;
    try {
      const [p] = await api.resumesJoueurs(cle, [steamid || '76561197960287930']);
      this.noterReseau(true);
      pseudo = steamid ? p?.personaname ?? null : null;
    } catch (e) {
      if (e.code === 'refus') {
        return { etat: 'refusee', pseudo: null, erreur: erreur('cle_refusee') };
      }
      // Hors ligne : la clé est gardée, elle sera vérifiée au retour du réseau.
      this.noterReseau(false);
      this.garderLaCle(cle, 'non_verifiee');
      return { etat: 'non_verifiee', pseudo: null, erreur: erreur('hors_ligne') };
    }
    this.garderLaCle(cle, 'valide');
    void this.synchroniser().then(() => this.emettre({ type: 'donnees_rafraichies', domaine: 'profil', id_jeu: null }));
    return { etat: 'valide', pseudo, erreur: null };
  }

  garderLaCle(cle, etat) {
    this.d.cle_chiffree = this.o.chiffrer(cle);
    this.d.cle_etat = etat;
    this.c.profil = null;
    this.echecs.clear();
    void this.ecrire();
    this.emettre({ type: 'etat_modifie' });
    this.emettre({ type: 'donnees_rafraichies', domaine: 'profil', id_jeu: null });
  }

  async supprimer_la_cle() {
    const avant = this.visibles().map((j) => j.id);
    this.d.cle_chiffree = null;
    this.d.cle_etat = 'absente';
    this.c.possedes = null;
    this.c.amis = null;
    this.c.profil = null;
    this.erreurPossedes = null;
    this.erreurAmis = null;
    await this.ecrire();
    const apres = this.visibles().map((j) => j.id);
    this.signaler(apres, avant.filter((id) => !apres.includes(id)));
    this.emettre({ type: 'etat_modifie' });
    this.emettre({ type: 'donnees_rafraichies', domaine: 'profil', id_jeu: null });
  }
}

// ═════════════════════════════ Réponses du magasin ═════════════════════════════

function compacterArticle(it) {
  const cat = it.categories || {};
  const joueurs = new Set(cat.supported_player_categoryids || []);
  const modes = [['solo', [2]], ['multi', [1, 20, 36, 37, 47, 49]], ['coop', [9, 38, 39, 48]]].filter(([, ids]) => ids.some((i) => joueurs.has(i))).map(([m]) => m);
  const manettes = new Set(cat.controller_categoryids || []);
  const rs = it.reviews?.summary_filtered;
  const sortie = it.release?.steam_release_date || it.release?.original_release_date;
  return {
    nom: it.name || null,
    type: it.type ?? null,
    assets: it.assets || null,
    tags: (it.tagids || []).slice(0, 6),
    modes,
    manette: manettes.has(28) ? 'complete' : manettes.has(18) ? 'partielle' : null,
    avis: rs && rs.review_count ? { nombre: rs.review_count, pct_positifs: rs.percent_positive, score: rs.review_score } : null,
    sortie: sortie ? iso(sortie * 1000) : null,
  };
}

function ficheDepuisArticle(it, id_jeu, joueurs) {
  const appid = it.id ?? it.appid;
  const bi = it.basic_info || {};
  const captures = [...(it.screenshots?.all_ages_screenshots || [])]
    .sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0))
    .slice(0, 8)
    .map((c) => {
      const brut = BASE_ASSETS + c.filename;
      const i = brut.indexOf('.jpg');
      const base = i < 0 ? brut : brut.slice(0, i);
      const suite = i < 0 ? '' : brut.slice(i + 4);
      return { miniature: `${base}.600x338.jpg${suite}`, pleine: `${base}.1920x1080.jpg${suite}` };
    });
  const gr = it.game_rating;
  const classification = gr && gr.rating ? { organisme: gr.agency === 2 ? 'PEGI' : gr.agency === 1 ? 'ESRB' : gr.agency === 3 ? 'USK' : 'autre', valeur: String(gr.rating), descripteurs: gr.descriptors || [] } : null;
  const langues = (it.supported_languages || [])
    .filter((l) => l.elanguage in LANGUES && (l.eadditionallanguage ?? -1) === -1)
    .map((l) => ({ code: LANGUES[l.elanguage], interface: Boolean(l.supported), audio: Boolean(l.full_audio), sous_titres: Boolean(l.subtitles) }));
  const desc = it.full_description_bbcode || it.full_description || null;
  return {
    id_jeu,
    langue: 'fr',
    description_courte: (bi.short_description || '').replace(/\r?\n/g, ' ').trim(),
    description_html: desc ? bbcodeVersHtml(desc, appid) : null,
    developpeurs: (bi.developers || []).map((x) => x.name),
    editeurs: (bi.publishers || []).map((x) => x.name),
    captures,
    acces_anticipe: Boolean(it.is_early_access),
    classification,
    langues,
    joueurs_en_ligne: joueurs,
    url_magasin: 'https://store.steampowered.com/' + (it.store_url_path || `app/${appid}`),
  };
}

module.exports = { CoeurReel, compacterArticle, ficheDepuisArticle };
