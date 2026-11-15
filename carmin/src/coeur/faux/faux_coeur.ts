/**
 * FAUX CŒUR : une implémentation complète du contrat (`contrat/types.ts`) servie par les
 * données factices. Les écrans ne voient que l'interface `Coeur` : le jour où le cœur Rust
 * existe, on remplace cet objet et aucun écran ne change.
 *
 * Ce fichier imite le COMPORTEMENT promis par le contrat, pas seulement ses types :
 *  - une lecture en ligne répond tout de suite (cache ou « rien encore »), puis l'événement
 *    `donnees_rafraichies` annonce l'arrivée du réseau ;
 *  - une lecture ne rejette jamais pour une raison de réseau, de clé ou de confidentialité ;
 *  - une action rejette avec une `ErreurApp` ;
 *  - la clé API n'est jamais conservée ni journalisée : seul son état l'est.
 */
import type {
  ActionSteam,
  Actualite,
  Ami,
  AnalyseChemin,
  Coeur,
  CompteSteam,
  DateUtc,
  Domaine,
  ErreurApp,
  EtatApp,
  EtatCle,
  Evenement,
  FicheMagasin,
  JeuDetail,
  JeuResume,
  Langue,
  Parametres,
  Profil,
  Referentiels,
  Reponse,
  ResultatTestCle,
  Session,
  Source,
  SourceEnLigne,
  SuccesDuJeu,
} from '../../../contrat/types';
import type {
  FicheFactice,
  FichierActualites,
  FichierAmis,
  FichierEtat,
  FichierFiches,
  FichierJeux,
  FichierReferentiels,
  FichierSessions,
  FichierSucces,
} from '../../../donnees-factices/formats';
import { erreur, estTransitoire } from '../erreurs';
import { lireFichier, nomDeMorceau, numeroDeMorceau } from './donnees';
import type { Scenario } from './scenarios';

/** Instant auquel les données factices ont été fabriquées (voir outils/generer_donnees.py). */
export const MAINTENANT_FACTICE: DateUtc = '2026-11-11T19:00:00Z';

const JOUR_MS = 86_400_000;
const HEURE_MS = 3_600_000;
const MINUTE_MS = 60_000;
/** Une seconde réelle de session simulée compte pour quatre minutes de jeu. */
const SECONDES_DE_JEU_PAR_SECONDE = 240;

export interface OptionsFauxCoeur {
  scenario: Scenario;
  /** Délai de chaque réponse, pour que les états de chargement soient visibles. 0 dans les tests. */
  latence_ms: number;
  /** Durée d'un aller-retour réseau simulé. */
  reseau_ms: number;
  /** Durée réelle d'une session simulée après `lancer`. */
  session_ms: number;
  /** Durée du scan simulé du PC. */
  scan_ms: number;
  /** Ce qui arrive quand on lance un jeu. */
  lancement: 'ok' | 'sans_session' | 'exe_introuvable';
  /** Horloge, remplaçable dans les tests. */
  maintenant: () => Date;
}

export const OPTIONS_PAR_DEFAUT: OptionsFauxCoeur = {
  scenario: 'normal',
  latence_ms: 40,
  reseau_ms: 900,
  session_ms: 12_000,
  scan_ms: 4_000,
  lancement: 'ok',
  maintenant: () => new Date(),
};

/** Ce que le faux cœur aurait fait sur le PC. Sert aux tests et au banc d'essai. */
export type EntreeJournal =
  | { type: 'lancement'; id_jeu: number; source: Source }
  | { type: 'dossier_ouvert'; id_jeu: number }
  | { type: 'action_steam'; action: ActionSteam }
  | { type: 'lien_ouvert'; url: string };

interface Monde {
  jeux: Map<number, JeuResume>;
  /** De la plus ancienne à la plus récente. */
  sessions: Session[];
  amis: Ami[];
  /** De la plus récente à la plus ancienne. */
  actualites: Actualite[];
  referentiels: FichierReferentiels;
  etat: EtatApp;
  profil: Profil;
  parametres: Parametres;
  comptes: CompteSteam[];
  /** Fiches des jeux ajoutés à la main pendant la session. */
  manuels: Map<number, FicheFactice>;
  profilPrive: boolean;
  quotaAtteint: boolean;
}

interface EntreeCache {
  maj_le: DateUtc;
  origine: 'cache' | 'reseau';
}

interface Cible {
  cle: string;
  source: SourceEnLigne | null;
}

function iso(instant: Date | number): DateUtc {
  return new Date(instant).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Même règle que `titre_tri` dans outils/generer_donnees.py. */
export function normaliserTitre(titre: string): string {
  const sansAccent = titre.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const propre = sansAccent
    .replace(/[®™©]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an|le|la|les|l'|un|une|des)\s+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return propre || titre.toLowerCase();
}

/** Couleur sourde et stable tirée d'un texte, pour la jaquette dessinée d'un jeu ajouté à la main. */
function couleurDe(texte: string): string {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i += 1) h = Math.imul(h ^ texte.charCodeAt(i), 16777619) >>> 0;
  const canal = (decalage: number) => (56 + ((h >>> decalage) % 72)).toString(16).padStart(2, '0');
  return `#${canal(0)}${canal(8)}${canal(16)}`;
}

const CHEMIN_WINDOWS = /^[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+\.(exe|lnk|url)$/i;

export class FauxCoeur implements Coeur {
  /** Effets que le vrai cœur aurait eus sur le PC (jamais la clé API). */
  readonly journal: EntreeJournal[] = [];

  private readonly options: OptionsFauxCoeur;
  private readonly decalage_ms: number;
  private mondePromis: Promise<Monde> | null = null;
  private mondeCharge: Monde | null = null;
  private readonly auditeurs = new Set<(evenement: Evenement) => void>();
  private readonly cache = new Map<string, EntreeCache>();
  private readonly enAttente = new Set<string>();
  private readonly minuteries = new Set<ReturnType<typeof setTimeout>>();
  private readonly fiches = new Map<number, FichierFiches>();
  private readonly succes = new Map<number, FichierSucces>();
  /** Pendant le scan du premier lancement : nombre de jeux déjà trouvés. null = pas de limite. */
  private limiteScan: number | null = null;
  private scanAutomatiqueFait = false;
  private arrete = false;

  constructor(options: Partial<OptionsFauxCoeur> = {}) {
    this.options = { ...OPTIONS_PAR_DEFAUT, ...options };
    // Les dates des données sont décalées d'un nombre entier de jours, pour que « il y a 2 jours »
    // reste vrai quel que soit le jour où l'on ouvre la maquette, sans changer les heures.
    const ecart = this.options.maintenant().getTime() - Date.parse(MAINTENANT_FACTICE);
    this.decalage_ms = Math.floor(ecart / JOUR_MS) * JOUR_MS;
  }

  /** Arrête les minuteries (fin d'un test, changement de scénario). */
  arreter(): void {
    this.arrete = true;
    for (const minuterie of this.minuteries) clearTimeout(minuterie);
    this.minuteries.clear();
    this.auditeurs.clear();
  }

  // ───────────────────────────── État général ─────────────────────────────

  async etat(): Promise<EtatApp> {
    const m = await this.pret();
    return structuredClone(m.etat);
  }

  async referentiels(langue: Langue): Promise<Referentiels> {
    const m = await this.pret();
    return structuredClone(m.referentiels[langue]);
  }

  async parametres(): Promise<Parametres> {
    const m = await this.pret();
    return structuredClone(m.parametres);
  }

  async modifier_parametres(parametres: Parametres): Promise<Parametres> {
    const m = await this.pret();
    m.parametres = structuredClone(parametres);
    this.emettre({ type: 'etat_modifie' });
    return structuredClone(m.parametres);
  }

  async terminer_premier_lancement(): Promise<void> {
    const m = await this.pret();
    m.etat.premier_lancement = false;
    this.emettre({ type: 'etat_modifie' });
  }

  async tout_effacer(): Promise<void> {
    const ancien = await this.pret();
    const retires = this.visibles(ancien).map((j) => j.id);
    for (const minuterie of this.minuteries) clearTimeout(minuterie);
    this.minuteries.clear();
    this.cache.clear();
    this.enAttente.clear();
    this.fiches.clear();
    this.succes.clear();
    this.limiteScan = null;
    const neuf = await this.charger('premier_lancement');
    for (const jeu of neuf.jeux.values()) {
      jeu.favori = false;
      jeu.masque = false;
    }
    neuf.sessions = [];
    this.mondeCharge = neuf;
    this.mondePromis = Promise.resolve(neuf);
    this.emettre({ type: 'bibliotheque_modifiee', modifies: [], retires });
    this.emettre({ type: 'etat_modifie' });
    this.lancerScan(neuf, true);
  }

  async installer_la_mise_a_jour(): Promise<void> {
    const m = await this.pret();
    const maj = m.etat.mise_a_jour;
    if (maj === null) throw erreur('introuvable');
    if (maj.etape !== 'disponible') return;
    maj.etape = 'telechargement';
    maj.progression_pct = 0;
    this.emettre({ type: 'etat_modifie' });
    const pas = [25, 50, 75, 100];
    pas.forEach((pct, i) => {
      this.apres((this.options.reseau_ms * (i + 1)) / 2, () => {
        maj.progression_pct = pct;
        if (pct === 100) {
          maj.etape = 'prete';
          maj.progression_pct = null;
        }
        this.emettre({ type: 'etat_modifie' });
      });
    });
  }

  async rafraichir(domaine: Domaine, id_jeu: number | null): Promise<void> {
    const m = await this.pret();
    if (domaine === 'bibliotheque') {
      this.apres(this.options.reseau_ms, () => this.emettre({ type: 'donnees_rafraichies', domaine, id_jeu: null }));
      return;
    }
    if (id_jeu !== null) this.jeuVisible(m, id_jeu);
    const cible = this.cibleDe(domaine, id_jeu);
    this.programmer(cible, domaine, id_jeu);
  }

  // ───────────────────────────── Compte Steam du PC ─────────────────────────────

  async comptes_steam(): Promise<CompteSteam[]> {
    const m = await this.pret();
    return structuredClone(m.comptes);
  }

  async choisir_le_compte(steamid: string): Promise<void> {
    const m = await this.pret();
    const choisi = m.comptes.find((c) => c.steamid === steamid);
    if (!choisi) throw erreur('introuvable');
    for (const compte of m.comptes) compte.actif = compte === choisi;
    m.profil.steamid = choisi.steamid;
    m.profil.pseudo = choisi.pseudo;
    this.cache.delete('profil');
    this.cache.delete('amis');
    this.emettre({ type: 'etat_modifie' });
    this.emettre({ type: 'donnees_rafraichies', domaine: 'profil', id_jeu: null });
    this.emettre({ type: 'donnees_rafraichies', domaine: 'bibliotheque', id_jeu: null });
  }

  // ───────────────────────────── Bibliothèque ─────────────────────────────

  async lister_jeux(): Promise<JeuResume[]> {
    const m = await this.pret();
    return this.exposer(m, this.visibles(m));
  }

  async jeux(ids: number[]): Promise<JeuResume[]> {
    const m = await this.pret();
    const visibles = new Map(this.visibles(m).map((j) => [j.id, j]));
    const trouves = ids.map((id) => visibles.get(id)).filter((j): j is JeuResume => j !== undefined);
    return this.exposer(m, trouves);
  }

  async detail_jeu(id_jeu: number): Promise<JeuDetail> {
    const m = await this.pret();
    const jeu = this.jeuVisible(m, id_jeu);
    const fiche = await this.ficheFactice(m, id_jeu);
    const resume = this.exposer(m, [jeu])[0];
    if (!resume) throw erreur('interne');
    return {
      resume,
      sources: structuredClone(fiche.sources),
      hero: fiche.hero,
      logo: fiche.logo,
      en_tete: fiche.en_tete,
      sessions_recentes: this.sessionsDe(m, id_jeu, 5, null),
    };
  }

  async lister_sessions(id_jeu: number, limite: number, avant: DateUtc | null): Promise<Session[]> {
    const m = await this.pret();
    this.jeuVisible(m, id_jeu);
    return this.sessionsDe(m, id_jeu, limite, avant);
  }

  async definir_favori(id_jeu: number, favori: boolean): Promise<void> {
    const m = await this.pret();
    this.jeuVisible(m, id_jeu).favori = favori;
    this.emettre({ type: 'bibliotheque_modifiee', modifies: [id_jeu], retires: [] });
  }

  async definir_masque(id_jeu: number, masque: boolean): Promise<void> {
    const m = await this.pret();
    this.jeuVisible(m, id_jeu).masque = masque;
    this.emettre({ type: 'bibliotheque_modifiee', modifies: [id_jeu], retires: [] });
  }

  async renommer_un_jeu(id_jeu: number, titre: string): Promise<void> {
    const m = await this.pret();
    const jeu = this.jeuVisible(m, id_jeu);
    const propre = titre.trim();
    if (propre === '') throw erreur('interne');
    jeu.titre = propre;
    jeu.titre_tri = normaliserTitre(propre);
    this.emettre({ type: 'bibliotheque_modifiee', modifies: [id_jeu], retires: [] });
  }

  async relancer_le_scan(): Promise<void> {
    const m = await this.pret();
    if (m.etat.scan.en_cours) return;
    this.lancerScan(m, false);
  }

  // ───────────────────────────── Ajout manuel ─────────────────────────────

  async analyser_un_chemin(chemin: string): Promise<AnalyseChemin> {
    const m = await this.pret();
    const propre = chemin.trim();
    if (!CHEMIN_WINDOWS.test(propre)) throw erreur('chemin_invalide');
    const fichier = propre.slice(propre.lastIndexOf('\\') + 1);
    const titre_propose = fichier
      .replace(/\.(exe|lnk|url)$/i, '')
      .replace(/\s*-\s*(raccourci|shortcut)$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const cle = normaliserTitre(titre_propose);
    const doublon = this.visibles(m).find((j) => j.titre_tri === cle);
    return {
      titre_propose,
      // Un raccourci serait résolu vers sa cible ; ici on fait comme si elle était à côté.
      cible: propre.replace(/\.(lnk|url)$/i, '.exe'),
      source: 'manuel',
      icone: null,
      doublon_de: doublon ? doublon.id : null,
    };
  }

  async ajouter_un_jeu_manuel(chemin: string, titre: string): Promise<JeuResume> {
    const m = await this.pret();
    const analyse = await this.analyser_un_chemin(chemin);
    const propre = titre.trim() || analyse.titre_propose;
    for (const [id, fiche] of m.manuels) {
      if (fiche.sources.some((s) => s.exe?.toLowerCase() === analyse.cible.toLowerCase())) {
        throw erreur('deja_present', { id_jeu: id });
      }
    }
    const maintenant = iso(this.options.maintenant());
    const id = Math.max(2000, ...m.jeux.keys()) + 1;
    const taille_octets = 1_500_000_000 + (id % 7) * 400_000_000;
    const jeu: JeuResume = {
      id,
      titre: propre,
      titre_tri: normaliserTitre(propre),
      sources: ['manuel'],
      steam_appid: null,
      installe: true,
      taille_octets,
      ajoute_le: maintenant,
      favori: false,
      masque: false,
      temps: { minutes_total: 0, minutes_2sem: 0, dernier_lancement: null, origine: 'local' },
      jaquette: null,
      icone: null,
      couleur_dominante: couleurDe(propre),
      tags: [],
      modes: [],
      manette: null,
      avis: null,
      date_sortie: null,
      succes: null,
    };
    m.jeux.set(id, jeu);
    m.manuels.set(id, {
      hero: null,
      logo: null,
      en_tete: null,
      sources: [
        {
          source: 'manuel',
          id_source: analyse.cible,
          installe: true,
          dossier: analyse.cible.slice(0, analyse.cible.lastIndexOf('\\')),
          exe: analyse.cible,
          taille_octets,
          vu_le: maintenant,
        },
      ],
      fiche: null,
    });
    this.emettre({ type: 'bibliotheque_modifiee', modifies: [id], retires: [] });
    return structuredClone(jeu);
  }

  async retirer_un_jeu_manuel(id_jeu: number): Promise<void> {
    const m = await this.pret();
    const jeu = this.jeuVisible(m, id_jeu);
    // Seul un jeu ajouté à la main se retire : les autres reviendraient au prochain scan.
    if (jeu.sources.length !== 1 || jeu.sources[0] !== 'manuel') throw erreur('interne');
    m.jeux.delete(id_jeu);
    m.manuels.delete(id_jeu);
    m.sessions = m.sessions.filter((s) => s.id_jeu !== id_jeu);
    this.emettre({ type: 'bibliotheque_modifiee', modifies: [], retires: [id_jeu] });
  }

  async choisir_l_exe(id_jeu: number, source: Source, chemin: string): Promise<void> {
    const m = await this.pret();
    this.jeuVisible(m, id_jeu);
    const propre = chemin.trim();
    if (!CHEMIN_WINDOWS.test(propre) || !/\.exe$/i.test(propre)) throw erreur('chemin_invalide');
    const fiche = await this.ficheFactice(m, id_jeu);
    const cible = fiche.sources.find((s) => s.source === source);
    if (!cible) throw erreur('introuvable');
    cible.exe = propre;
  }

  // ───────────────────────────── Lancement ─────────────────────────────

  async lancer(id_jeu: number, source: Source | null): Promise<void> {
    const m = await this.pret();
    const jeu = this.jeuVisible(m, id_jeu);
    if (source !== null && !jeu.sources.includes(source)) throw erreur('introuvable');
    if (!jeu.installe) throw erreur('lancement_echoue', { id_jeu });
    if (m.etat.session_en_cours !== null) throw erreur('lancement_echoue', { id_jeu });
    const fiche = await this.ficheFactice(m, id_jeu);
    const choisie = source ?? fiche.sources.find((s) => s.installe)?.source ?? jeu.sources[0];
    if (choisie === undefined) throw erreur('interne');
    if (choisie === 'steam' && !m.etat.steam_installe) throw erreur('launcher_absent', { source: 'steam' });
    if (this.options.lancement === 'exe_introuvable') throw erreur('exe_introuvable', { id_jeu });

    this.journal.push({ type: 'lancement', id_jeu, source: choisie });
    if (this.options.lancement === 'sans_session') {
      this.apres(Math.min(this.options.session_ms, 3_000), () => this.emettre({ type: 'lancement_sans_session', id_jeu }));
      return;
    }
    const debut = iso(this.options.maintenant());
    m.etat.session_en_cours = { id_jeu, debut };
    this.emettre({ type: 'session_demarree', id_jeu, debut });
    this.emettre({ type: 'etat_modifie' });
    this.apres(this.options.session_ms, () => {
      void this.terminerLaSession(m, id_jeu).catch(() => undefined);
    });
  }

  async ouvrir_le_dossier(id_jeu: number): Promise<void> {
    const m = await this.pret();
    const jeu = this.jeuVisible(m, id_jeu);
    if (!jeu.installe) throw erreur('introuvable');
    this.journal.push({ type: 'dossier_ouvert', id_jeu });
  }

  async action_steam(action: ActionSteam): Promise<void> {
    const m = await this.pret();
    if (!m.etat.steam_installe) throw erreur('launcher_absent', { source: 'steam' });
    this.journal.push({ type: 'action_steam', action: structuredClone(action) });
  }

  async ouvrir_un_lien(url: string): Promise<void> {
    await this.pret();
    if (!/^https:\/\/[^\s]+$/i.test(url)) throw erreur('chemin_invalide');
    this.journal.push({ type: 'lien_ouvert', url });
    // Dans le navigateur, on ouvre vraiment le lien, toujours dans un autre onglet.
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ───────────────────────────── Données en ligne ─────────────────────────────

  async fiche_du_jeu(id_jeu: number): Promise<Reponse<FicheMagasin>> {
    const m = await this.pret();
    const jeu = this.jeuVisible(m, id_jeu);
    if (jeu.steam_appid === null) return this.refus(erreur('jeu_non_steam'));
    return this.lire(m, this.cibleDe('fiche', id_jeu), 'fiche', id_jeu, async () => {
      const fiche = structuredClone((await this.ficheFactice(m, id_jeu)).fiche);
      if (fiche === null) throw erreur('interne');
      if (!m.parametres.sources_en_ligne.joueurs_en_ligne) fiche.joueurs_en_ligne = null;
      return fiche;
    });
  }

  async succes_du_jeu(id_jeu: number): Promise<Reponse<SuccesDuJeu>> {
    const m = await this.pret();
    const jeu = this.jeuVisible(m, id_jeu);
    if (jeu.steam_appid === null) return this.refus(erreur('jeu_non_steam'));
    if (jeu.succes === null) return this.refus(erreur('jeu_sans_succes'));
    return this.lire(m, this.cibleDe('succes', id_jeu), 'succes', id_jeu, async () => {
      const succes = structuredClone(await this.succesFactices(id_jeu));
      if (succes === null) throw erreur('interne');
      const manque = this.erreurPersonnelle(m, 'progression');
      if (manque !== null) {
        succes.debloques = null;
        succes.progression_erreur = manque;
        for (const s of succes.liste) {
          s.debloque = null;
          s.debloque_le = null;
        }
      }
      return succes;
    });
  }

  async amis(): Promise<Reponse<Ami[]>> {
    const m = await this.pret();
    const manque = this.erreurPersonnelle(m, 'amis');
    if (manque !== null) return this.refus(manque);
    return this.lire(m, this.cibleDe('amis', null), 'amis', null, async () => structuredClone(m.amis));
  }

  async actualites_du_jeu(id_jeu: number, limite: number, avant: DateUtc | null): Promise<Reponse<Actualite[]>> {
    const m = await this.pret();
    const jeu = this.jeuVisible(m, id_jeu);
    if (jeu.steam_appid === null) return this.refus(erreur('jeu_non_steam'));
    return this.lire(m, this.cibleDe('actualites', id_jeu), 'actualites', id_jeu, async () =>
      this.page(
        m.actualites.filter((a) => a.id_jeu === id_jeu),
        limite,
        avant,
      ),
    );
  }

  async fil_d_actualites(limite: number, avant: DateUtc | null): Promise<Reponse<Actualite[]>> {
    const m = await this.pret();
    return this.lire(m, this.cibleDe('actualites', null), 'actualites', null, async () => {
      // Le fil ne suit que les jeux installés et ceux joués depuis un mois (quota de 500 appels par jour).
      const seuil = iso(this.options.maintenant().getTime() - 30 * JOUR_MS);
      const suivis = new Set(
        this.visibles(m)
          .filter((j) => j.installe || (j.temps.dernier_lancement !== null && j.temps.dernier_lancement >= seuil))
          .map((j) => j.id),
      );
      return this.page(
        m.actualites.filter((a) => suivis.has(a.id_jeu)),
        limite,
        avant,
      );
    });
  }

  async profil(): Promise<Reponse<Profil>> {
    const m = await this.pret();
    const manque = this.erreurPersonnelle(m, 'progression');
    if (manque !== null) {
      // Le pseudo vient des fichiers locaux de Steam : on le montre même sans clé, sans avatar.
      return {
        donnees: { steamid: m.profil.steamid, pseudo: m.profil.pseudo, avatar: null },
        fraicheur: { maj_le: m.etat.scan.dernier ?? iso(this.options.maintenant()), origine: 'local' },
        rafraichissement: 'aucun',
        erreur: m.profil.steamid === null ? null : manque,
      };
    }
    return this.lire(m, this.cibleDe('profil', null), 'profil', null, async () => structuredClone(m.profil));
  }

  // ───────────────────────────── Clé API ─────────────────────────────

  async enregistrer_la_cle(cle: string): Promise<ResultatTestCle> {
    const m = await this.pret();
    // La clé n'est ni conservée ni journalisée : on ne garde que le verdict.
    const formeValide = /^[0-9A-Fa-f]{32}$/.test(cle.trim());
    // Convention de la maquette : une clé qui commence par 0000 est « refusée par Steam ».
    const refusee = !formeValide || cle.trim().startsWith('0000');
    if (!m.etat.en_ligne && formeValide) {
      this.changerLaCle(m, 'non_verifiee');
      return { etat: 'non_verifiee', pseudo: null, erreur: erreur('hors_ligne') };
    }
    if (refusee) {
      if (m.etat.cle !== 'valide') this.changerLaCle(m, 'refusee');
      return { etat: 'refusee', pseudo: null, erreur: erreur('cle_refusee') };
    }
    this.changerLaCle(m, 'valide');
    return { etat: 'valide', pseudo: m.profil.pseudo, erreur: null };
  }

  async supprimer_la_cle(): Promise<void> {
    const m = await this.pret();
    this.changerLaCle(m, 'absente');
  }

  // ───────────────────────────── Événements ─────────────────────────────

  ecouter(rappel: (evenement: Evenement) => void): () => void {
    this.auditeurs.add(rappel);
    // Au premier lancement, le scan démarre dès que quelqu'un écoute : aucun événement n'est perdu.
    if (this.options.scenario === 'premier_lancement' && !this.scanAutomatiqueFait) {
      this.scanAutomatiqueFait = true;
      void this.monde()
        .then((m) => this.lancerScan(m, true))
        .catch(() => undefined);
    }
    return () => {
      this.auditeurs.delete(rappel);
    };
  }

  // ═════════════════════════════ Mécanique interne ═════════════════════════════

  private emettre(evenement: Evenement): void {
    if (this.arrete) return;
    for (const rappel of [...this.auditeurs]) {
      try {
        rappel(structuredClone(evenement));
      } catch {
        // Un écran qui plante dans son rappel ne doit pas arrêter le cœur.
      }
    }
  }

  private apres(delai_ms: number, action: () => void): void {
    if (this.arrete) return;
    const minuterie = setTimeout(
      () => {
        this.minuteries.delete(minuterie);
        if (!this.arrete) action();
      },
      Math.max(0, delai_ms),
    );
    this.minuteries.add(minuterie);
  }

  private async pret(): Promise<Monde> {
    if (this.options.latence_ms > 0) {
      await new Promise<void>((resoudre) => {
        setTimeout(resoudre, this.options.latence_ms);
      });
    }
    return this.monde();
  }

  private monde(): Promise<Monde> {
    this.mondePromis ??= this.charger(this.options.scenario).then((m) => {
      this.mondeCharge = m;
      return m;
    });
    return this.mondePromis;
  }

  private decaler(date: DateUtc): DateUtc {
    return this.decalage_ms === 0 ? date : iso(Date.parse(date) + this.decalage_ms);
  }

  private decalerOuNull(date: DateUtc | null): DateUtc | null {
    return date === null ? null : this.decaler(date);
  }

  private async charger(scenario: Scenario): Promise<Monde> {
    const [jeux, sessions, amis, actualites, referentiels, fichierEtat] = await Promise.all([
      lireFichier<FichierJeux>('jeux.json'),
      lireFichier<FichierSessions>('sessions.json'),
      lireFichier<FichierAmis>('amis.json'),
      lireFichier<FichierActualites>('actualites.json'),
      lireFichier<FichierReferentiels>('referentiels.json'),
      lireFichier<FichierEtat>('etat.json'),
    ]);
    if (!jeux || !sessions || !amis || !actualites || !referentiels || !fichierEtat) throw erreur('interne');

    for (const jeu of jeux) {
      jeu.ajoute_le = this.decaler(jeu.ajoute_le);
      jeu.temps.dernier_lancement = this.decalerOuNull(jeu.temps.dernier_lancement);
    }
    for (const session of sessions) {
      session.debut = this.decaler(session.debut);
      session.fin = this.decalerOuNull(session.fin);
    }
    for (const ami of amis) ami.derniere_connexion = this.decalerOuNull(ami.derniere_connexion);
    for (const actualite of actualites) actualite.date = this.decaler(actualite.date);
    const etat = fichierEtat.etat;
    etat.scan.dernier = this.decalerOuNull(etat.scan.dernier);

    const profil = fichierEtat.profil;
    const m: Monde = {
      jeux: new Map(jeux.map((j) => [j.id, j])),
      sessions,
      amis,
      actualites,
      referentiels,
      etat,
      profil,
      parametres: fichierEtat.parametres,
      comptes:
        profil.steamid !== null && profil.pseudo !== null
          ? [
              { steamid: profil.steamid, pseudo: profil.pseudo, actif: true },
              { steamid: '76561199000000002', pseudo: 'Nova (second compte)', actif: false },
            ]
          : [],
      manuels: new Map(),
      profilPrive: false,
      quotaAtteint: false,
    };
    this.appliquerLeScenario(m, scenario);
    this.amorcerLeCache(m, scenario);
    return m;
  }

  private appliquerLeScenario(m: Monde, scenario: Scenario): void {
    const maintenant = this.options.maintenant().getTime();
    switch (scenario) {
      case 'normal':
        break;
      case 'premier_lancement':
        m.etat.premier_lancement = true;
        m.etat.cle = 'absente';
        m.etat.scan = { en_cours: false, dernier: null, jeux_trouves: 0 };
        this.limiteScan = 0;
        break;
      case 'sans_cle':
        m.etat.cle = 'absente';
        break;
      case 'cle_refusee':
        m.etat.cle = 'refusee';
        break;
      case 'profil_prive':
        m.profilPrive = true;
        break;
      case 'hors_ligne':
        m.etat.en_ligne = false;
        break;
      case 'mode_jeu': {
        const enCours = [...m.jeux.values()]
          .filter((j) => j.installe && j.temps.dernier_lancement !== null)
          .sort((a, b) => (b.temps.dernier_lancement ?? '').localeCompare(a.temps.dernier_lancement ?? ''))[0];
        if (enCours) m.etat.session_en_cours = { id_jeu: enCours.id, debut: iso(maintenant - 25 * MINUTE_MS) };
        break;
      }
      case 'quota_atteint':
        m.quotaAtteint = true;
        break;
      case 'source_coupee':
        m.etat.sources_coupees = ['actualites'];
        break;
      case 'bibliotheque_vide':
        m.jeux.clear();
        m.sessions = [];
        m.actualites = [];
        m.amis = [];
        m.comptes = [];
        m.profil = { steamid: null, pseudo: null, avatar: null };
        m.etat.steam_installe = false;
        m.etat.cle = 'absente';
        m.etat.scan = { en_cours: false, dernier: iso(maintenant - 12 * MINUTE_MS), jeux_trouves: 0 };
        break;
      case 'mise_a_jour':
        m.etat.mise_a_jour = { version: '0.2.0', etape: 'disponible', progression_pct: null };
        break;
    }
    this.recalculerLeNiveau(m);
  }

  /** `niveau` et `jeux_possedes_erreur` se déduisent toujours du réseau, de la clé et du profil. */
  private recalculerLeNiveau(m: Monde): void {
    const manque = this.erreurPersonnelle(m, 'progression');
    m.etat.jeux_possedes_erreur = m.etat.steam_installe ? manque : null;
    m.etat.niveau = !m.etat.en_ligne ? 'local' : manque === null ? 'personnel' : 'public';
    if (manque !== null) m.profil.avatar = null;
  }

  private amorcerLeCache(m: Monde, scenario: Scenario): void {
    if (scenario === 'premier_lancement' || scenario === 'bibliotheque_vide') return;
    const maintenant = this.options.maintenant().getTime();
    // Ce qui a déjà été consulté : les jeux installés. Le reste se charge à la première visite.
    for (const jeu of m.jeux.values()) {
      if (!jeu.installe || jeu.steam_appid === null) continue;
      const maj_le = iso(maintenant - (1 + ((jeu.id * 7) % 36)) * HEURE_MS);
      for (const domaine of ['fiche', 'succes', 'actualites'] as const) {
        this.cache.set(`${domaine}:${jeu.id}`, { maj_le, origine: 'cache' });
      }
    }
    const recent = iso(maintenant - 20 * MINUTE_MS);
    for (const cle of ['fil', 'amis', 'profil']) this.cache.set(cle, { maj_le: recent, origine: 'cache' });
  }

  /** Pourquoi les données personnelles (jeux possédés, progression, amis) manquent. null = elles sont là. */
  private erreurPersonnelle(m: Monde, pour: 'progression' | 'amis'): ErreurApp | null {
    switch (m.etat.cle) {
      case 'absente':
        return erreur('cle_absente');
      case 'refusee':
        return erreur('cle_refusee');
      case 'non_verifiee':
        return erreur('hors_ligne');
      case 'valide':
        return m.profilPrive ? erreur(pour === 'amis' ? 'amis_prives' : 'profil_prive') : null;
    }
  }

  /** Les jeux que l'interface peut voir : sans données personnelles, seulement ceux trouvés sur le PC. */
  private visibles(m: Monde): JeuResume[] {
    const complet = this.erreurPersonnelle(m, 'progression') === null;
    const liste = [...m.jeux.values()].filter((j) => complet || j.installe || j.steam_appid === null);
    return this.limiteScan === null ? liste : liste.slice(0, this.limiteScan);
  }

  private jeuVisible(m: Monde, id_jeu: number): JeuResume {
    const jeu = this.visibles(m).find((j) => j.id === id_jeu);
    if (!jeu) throw erreur('introuvable', { id_jeu });
    return jeu;
  }

  /** Copie les jeux pour l'interface, en retirant ce que le niveau de données ne permet pas de savoir. */
  private exposer(m: Monde, jeux: JeuResume[]): JeuResume[] {
    const copies = structuredClone(jeux);
    if (this.erreurPersonnelle(m, 'progression') === null) return copies;
    for (const jeu of copies) {
      if (jeu.succes !== null) jeu.succes.debloques = null;
      if (jeu.temps.origine === 'steam') jeu.temps.minutes_2sem = null;
    }
    return copies;
  }

  private sessionsDe(m: Monde, id_jeu: number, limite: number, avant: DateUtc | null): Session[] {
    const liste = m.sessions
      .filter((s) => s.id_jeu === id_jeu && (avant === null || s.debut < avant))
      .sort((a, b) => b.debut.localeCompare(a.debut))
      .slice(0, Math.max(0, limite));
    return structuredClone(liste);
  }

  private page(actualites: Actualite[], limite: number, avant: DateUtc | null): Actualite[] {
    const liste = actualites.filter((a) => avant === null || a.date < avant).slice(0, Math.max(0, limite));
    return structuredClone(liste);
  }

  private async ficheFactice(m: Monde, id_jeu: number): Promise<FicheFactice> {
    const manuelle = m.manuels.get(id_jeu);
    if (manuelle) return manuelle;
    const numero = numeroDeMorceau(id_jeu);
    let morceau = this.fiches.get(numero);
    if (!morceau) {
      morceau = (await lireFichier<FichierFiches>(nomDeMorceau('fiches', numero))) ?? {};
      for (const fiche of Object.values(morceau)) {
        for (const source of fiche.sources) source.vu_le = this.decaler(source.vu_le);
      }
      this.fiches.set(numero, morceau);
    }
    const fiche = morceau[String(id_jeu)];
    if (!fiche) throw erreur('introuvable', { id_jeu });
    return fiche;
  }

  private async succesFactices(id_jeu: number): Promise<SuccesDuJeu | null> {
    const numero = numeroDeMorceau(id_jeu);
    let morceau = this.succes.get(numero);
    if (!morceau) {
      morceau = (await lireFichier<FichierSucces>(nomDeMorceau('succes', numero))) ?? {};
      for (const succes of Object.values(morceau)) {
        for (const s of succes.liste) s.debloque_le = this.decalerOuNull(s.debloque_le);
      }
      this.succes.set(numero, morceau);
    }
    return morceau[String(id_jeu)] ?? null;
  }

  // ───────────────────────────── Lectures en ligne ─────────────────────────────

  private cibleDe(domaine: Exclude<Domaine, 'bibliotheque'>, id_jeu: number | null): Cible {
    switch (domaine) {
      case 'fiche':
        if (id_jeu === null) throw erreur('introuvable');
        return { cle: `fiche:${id_jeu}`, source: 'fiches_magasin' };
      case 'succes':
        if (id_jeu === null) throw erreur('introuvable');
        return { cle: `succes:${id_jeu}`, source: 'succes_publics' };
      case 'actualites':
        return { cle: id_jeu === null ? 'fil' : `actualites:${id_jeu}`, source: 'actualites' };
      case 'amis':
        return { cle: 'amis', source: null };
      case 'profil':
        return { cle: 'profil', source: null };
    }
  }

  /** Ce qui empêche d'aller sur le réseau en ce moment. null = la voie est libre. */
  private blocage(m: Monde, source: SourceEnLigne | null): ErreurApp | null {
    if (source !== null && !m.parametres.sources_en_ligne[source]) return erreur('source_desactivee', { source });
    if (!m.etat.en_ligne) return erreur('hors_ligne');
    if (m.etat.session_en_cours !== null) return erreur('mode_jeu');
    if (source !== null && m.etat.sources_coupees.includes(source)) return erreur('source_coupee', { source });
    if (m.quotaAtteint) return erreur('quota_atteint');
    return null;
  }

  /** Réponse d'une donnée qui n'existera jamais pour ce jeu ou sans action du joueur. */
  private refus<T>(e: ErreurApp): Reponse<T> {
    return { donnees: null, fraicheur: null, rafraichissement: 'aucun', erreur: e };
  }

  /**
   * Le cœur de la règle 4 du contrat : répondre tout de suite avec le cache, même vide,
   * et laisser le réseau arriver ensuite par `donnees_rafraichies`.
   */
  private async lire<T>(
    m: Monde,
    cible: Cible,
    domaine: Domaine,
    id_jeu: number | null,
    produire: () => Promise<T>,
  ): Promise<Reponse<T>> {
    const bloque = this.blocage(m, cible.source);
    const echec = bloque !== null && estTransitoire(bloque) ? 'echoue' : 'aucun';
    const enCache = this.cache.get(cible.cle);
    if (enCache) {
      return { donnees: await produire(), fraicheur: { ...enCache }, rafraichissement: echec, erreur: bloque };
    }
    if (bloque !== null) return { donnees: null, fraicheur: null, rafraichissement: echec, erreur: bloque };
    this.programmer(cible, domaine, id_jeu);
    return { donnees: null, fraicheur: null, rafraichissement: 'en_cours', erreur: null };
  }

  /** Simule un aller-retour réseau, puis prévient l'interface, que ce soit un succès ou un échec. */
  private programmer(cible: Cible, domaine: Domaine, id_jeu: number | null): void {
    if (this.enAttente.has(cible.cle)) return;
    this.enAttente.add(cible.cle);
    this.apres(this.options.reseau_ms, () => {
      this.enAttente.delete(cible.cle);
      const m = this.mondeCharge;
      if (m !== null && this.blocage(m, cible.source) === null) {
        this.cache.set(cible.cle, { maj_le: iso(this.options.maintenant()), origine: 'reseau' });
      }
      this.emettre({ type: 'donnees_rafraichies', domaine, id_jeu });
    });
  }

  // ───────────────────────────── Clé, scan, session ─────────────────────────────

  private changerLaCle(m: Monde, cle: EtatCle): void {
    const avant = new Set(this.visibles(m).map((j) => j.id));
    m.etat.cle = cle;
    this.recalculerLeNiveau(m);
    if (cle === 'valide' && m.profil.avatar === null) {
      // L'avatar revient avec la clé : on le relit comme le ferait le cœur.
      this.cache.delete('profil');
      void lireFichier<FichierEtat>('etat.json')
        .then((f) => {
          if (f && this.erreurPersonnelle(m, 'progression') === null) m.profil.avatar = f.profil.avatar;
        })
        .catch(() => undefined);
    }
    const apres = new Set(this.visibles(m).map((j) => j.id));
    const modifies = [...apres].filter((id) => !avant.has(id));
    const retires = [...avant].filter((id) => !apres.has(id));
    this.emettre({ type: 'etat_modifie' });
    if (modifies.length > 0 || retires.length > 0) this.emettre({ type: 'bibliotheque_modifiee', modifies, retires });
    this.emettre({ type: 'donnees_rafraichies', domaine: 'profil', id_jeu: null });
  }

  private lancerScan(m: Monde, premier: boolean): void {
    this.limiteScan = null;
    const total = this.visibles(m).filter((j) => j.installe).length;
    m.etat.scan = { en_cours: true, dernier: m.etat.scan.dernier, jeux_trouves: 0 };
    if (premier) this.limiteScan = 0;
    this.emettre({ type: 'etat_modifie' });
    const etapes: Array<[Source, number]> = [
      ['steam', 0.4],
      ['steam', 0.75],
      ['epic', 0.9],
      ['gog', 1],
    ];
    etapes.forEach(([source, part], i) => {
      this.apres((this.options.scan_ms * (i + 1)) / (etapes.length + 1), () => {
        const trouves = Math.round(total * part);
        const dejaVus = premier ? new Set(this.visibles(m).map((j) => j.id)) : null;
        m.etat.scan.jeux_trouves = trouves;
        if (premier) this.limiteScan = trouves;
        this.emettre({ type: 'scan_progression', source, jeux_trouves: trouves });
        if (dejaVus !== null) {
          const modifies = this.visibles(m)
            .map((j) => j.id)
            .filter((id) => !dejaVus.has(id));
          if (modifies.length > 0) this.emettre({ type: 'bibliotheque_modifiee', modifies, retires: [] });
        }
      });
    });
    this.apres(this.options.scan_ms, () => {
      const dejaVus = new Set(this.visibles(m).map((j) => j.id));
      this.limiteScan = null;
      m.etat.scan = { en_cours: false, dernier: iso(this.options.maintenant()), jeux_trouves: total };
      this.emettre({ type: 'scan_termine', jeux_trouves: total, duree_ms: this.options.scan_ms });
      const modifies = this.visibles(m)
        .map((j) => j.id)
        .filter((id) => !dejaVus.has(id));
      if (modifies.length > 0) this.emettre({ type: 'bibliotheque_modifiee', modifies, retires: [] });
      this.emettre({ type: 'etat_modifie' });
    });
  }

  private async terminerLaSession(m: Monde, id_jeu: number): Promise<void> {
    const jeu = m.jeux.get(id_jeu);
    const enCours = m.etat.session_en_cours;
    if (!jeu || enCours === null || enCours.id_jeu !== id_jeu) return;
    const fin = this.options.maintenant().getTime();
    // Le temps simulé va plus vite que le temps réel : la session « a commencé » d'autant plus tôt.
    const duree_s = Math.max(60, Math.round((this.options.session_ms / 1000) * SECONDES_DE_JEU_PAR_SECONDE));
    const debut = iso(fin - duree_s * 1000);
    const minutes = Math.round(duree_s / 60);
    jeu.temps.minutes_total += minutes;
    if (jeu.temps.minutes_2sem !== null) jeu.temps.minutes_2sem += minutes;
    jeu.temps.dernier_lancement = debut;
    const id = m.sessions.reduce((max, s) => Math.max(max, s.id), 0) + 1;
    m.sessions.push({ id, id_jeu, debut, fin: iso(fin), duree_s, origine: 'launcher' });

    // Avec les données personnelles, la session débloque le premier succès visible encore verrouillé.
    const succes_debloques: string[] = [];
    if (jeu.succes !== null && this.erreurPersonnelle(m, 'progression') === null) {
      const succes = await this.succesFactices(id_jeu);
      const gagne = succes?.liste.find((s) => s.debloque === false && !s.secret);
      if (succes && gagne) {
        gagne.debloque = true;
        gagne.debloque_le = iso(fin);
        succes.debloques = (succes.debloques ?? 0) + 1;
        jeu.succes.debloques = succes.debloques;
        succes_debloques.push(gagne.api_name);
      }
    }

    m.etat.session_en_cours = null;
    this.emettre({ type: 'session_terminee', id_jeu, duree_s, temps: structuredClone(jeu.temps), succes_debloques });
    this.emettre({ type: 'bibliotheque_modifiee', modifies: [id_jeu], retires: [] });
    this.emettre({ type: 'etat_modifie' });
    if (succes_debloques.length > 0) this.emettre({ type: 'donnees_rafraichies', domaine: 'succes', id_jeu });
  }
}

export function creerFauxCoeur(options: Partial<OptionsFauxCoeur> = {}): FauxCoeur {
  return new FauxCoeur(options);
}
