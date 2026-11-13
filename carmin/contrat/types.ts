/**
 * CONTRAT v0.2 : tout ce que l'interface reçoit du cœur, et tout ce qu'elle lui demande.
 *
 * Règles (voir CONTEXTE_PROJET_LAUNCHER.txt, règles 3, 9 et §13.3) :
 *  1. L'interface ne parle qu'à l'objet `Coeur` défini en bas de ce fichier. Aujourd'hui il est
 *     servi par des données factices, demain par le cœur Rust (Tauri). Les écrans ne changent pas.
 *  2. Les noms de champs reprennent ceux du modèle de données (§14) : français, sans accent,
 *     en snake_case, pour que les types générés depuis Rust tombent sur les mêmes noms.
 *  3. Le cœur n'écrit aucun texte destiné à l'utilisateur : il renvoie des codes et des nombres,
 *     l'interface traduit (fr.json, en.json).
 *  4. Une lecture répond tout de suite avec ce qui est en cache, même si c'est « rien encore ».
 *     Le rafraîchissement réseau arrive ensuite par l'événement `donnees_rafraichies`.
 *     L'interface n'attend jamais le réseau.
 *  5. UN SEUL canal d'erreur : `ErreurApp`. Une lecture ne rejette JAMAIS pour une raison de
 *     réseau, de clé ou de confidentialité : elle répond avec `erreur` rempli. Elle ne rejette
 *     que pour `introuvable` et `interne`. Une action (lancer, ajouter, enregistrer) rejette
 *     avec une `ErreurApp`.
 *  6. Pas de champ optionnel : une valeur absente vaut `null`. Tous les nombres tiennent dans un
 *     `number` JavaScript (identifiants et tailles compris).
 *
 * Quand le cœur Rust existera, ce fichier sera GÉNÉRÉ (ADR-003) et ne sera plus édité à la main.
 * C'est pourquoi les objets imbriqués ont tous un nom et qu'il n'y a ni `Partial` ni `extends`.
 */

// ───────────────────────────── Bases ─────────────────────────────

/** Date ISO 8601 en UTC, par exemple "2026-11-11T19:43:51Z". */
export type DateUtc = string;

export type Langue = 'fr' | 'en';

export type Source = 'steam' | 'epic' | 'gog' | 'manuel';

/**
 * Niveau de données disponible (§7).
 * local = fichiers du PC seulement, public = en ligne sans clé, personnel = en ligne avec la clé du joueur.
 */
export type NiveauDonnees = 'local' | 'public' | 'personnel';

export type CodeErreur =
  | 'hors_ligne'
  /** Réseau en pause parce qu'un jeu tourne (§11.5). */
  | 'mode_jeu'
  | 'cle_absente'
  | 'cle_refusee'
  | 'profil_prive'
  | 'amis_prives'
  /** Jeu Steam qui n'a pas de succès. */
  | 'jeu_sans_succes'
  /** Jeu hors Steam : ni fiche du magasin, ni succès, ni actualités. */
  | 'jeu_non_steam'
  | 'quota_atteint'
  /** Source mise en pause par le disjoncteur après des échecs répétés (§9.4). */
  | 'source_coupee'
  /** Source désactivée par le joueur dans les paramètres. */
  | 'source_desactivee'
  | 'introuvable'
  | 'deja_present'
  /** Steam, Epic ou GOG n'est pas installé : `details.source` dit lequel. */
  | 'launcher_absent'
  | 'lancement_echoue'
  | 'exe_introuvable'
  | 'chemin_invalide'
  | 'interne';

/**
 * Seule forme d'erreur du contrat (§13.3). `cle_i18n` pointe vers fr.json / en.json.
 * `details` ne contient jamais la clé API, ni un message brut du système, ni du texte libre.
 */
export interface ErreurApp {
  code: CodeErreur;
  cle_i18n: string;
  details: Record<string, string | number> | null;
}

/** D'où vient une donnée et de quand elle date. */
export interface Fraicheur {
  maj_le: DateUtc;
  origine: 'local' | 'cache' | 'reseau';
}

/**
 * Enveloppe de toute donnée qui vient d'internet. Elle permet de distinguer les états à dessiner (§16) :
 *   donnees null + rafraichissement 'en_cours'  -> chargement (squelette)
 *   donnees null + erreur                       -> écran d'erreur, hors ligne, clé absente, profil privé…
 *   donnees vide ([])                           -> écran vide
 *   donnees + erreur                            -> on affiche le cache avec un bandeau discret
 */
export interface Reponse<T> {
  donnees: T | null;
  fraicheur: Fraicheur | null;
  rafraichissement: 'aucun' | 'en_cours' | 'echoue';
  erreur: ErreurApp | null;
}

// ───────────────────────────── Jeux ─────────────────────────────

export interface TempsDeJeu {
  minutes_total: number;
  /** null quand Steam ne l'a pas fourni (niveau local). */
  minutes_2sem: number | null;
  dernier_lancement: DateUtc | null;
  /**
   * Jeu Steam : le temps Steam fait foi. Autres jeux, ou temps Steam inconnu : temps mesuré par
   * le launcher. L'interface n'additionne jamais les deux (§11.4) : elle affiche ce champ tel quel.
   */
  origine: 'steam' | 'local';
}

export interface AvisResume {
  nombre: number;
  pct_positifs: number;
  /** Échelle de Steam, de 1 (extrêmement négatives) à 9 (extrêmement positives). 0 = pas assez d'avis. */
  score: number;
}

export interface ResumeSucces {
  total: number;
  /** null sans la clé ou si le profil est privé. */
  debloques: number | null;
}

export type ModeDeJeu = 'solo' | 'multi' | 'coop';

/** Ligne légère pour la grille et la liste : 2 000 de ces objets sont chargés d'un coup. */
export interface JeuResume {
  id: number;
  titre: string;
  /** Titre normalisé pour le tri (sans article, sans accent, en minuscules). */
  titre_tri: string;
  sources: Source[];
  steam_appid: number | null;
  installe: boolean;
  /** Taille sur le disque, seulement si le jeu est installé. */
  taille_octets: number | null;
  ajoute_le: DateUtc;
  favori: boolean;
  masque: boolean;
  temps: TempsDeJeu;
  /** Adresse de la vignette, affichable telle quelle. null = l'interface dessine la jaquette (icône + titre, §12). */
  jaquette: string | null;
  /** Icône de l'exécutable ou du jeu, pour la vue liste et la jaquette dessinée. */
  icone: string | null;
  /** Couleur dominante de la jaquette (#rrggbb), pour le chargement progressif et la fiche. */
  couleur_dominante: string | null;
  /** Identifiants de tags, à traduire avec `Referentiels.tags`. Les plus pertinents d'abord. */
  tags: number[];
  modes: ModeDeJeu[];
  manette: 'complete' | 'partielle' | null;
  avis: AvisResume | null;
  date_sortie: DateUtc | null;
  /** null = jeu sans succès, ou total pas encore connu. */
  succes: ResumeSucces | null;
}

export interface SourceDeJeu {
  source: Source;
  id_source: string;
  installe: boolean;
  dossier: string | null;
  exe: string | null;
  taille_octets: number | null;
  vu_le: DateUtc;
}

export interface Session {
  id: number;
  id_jeu: number;
  debut: DateUtc;
  /** null = session en cours. */
  fin: DateUtc | null;
  duree_s: number;
  /** 'launcher' = lancé depuis l'application, 'detectee' = lancé ailleurs et repéré (§11.2). */
  origine: 'launcher' | 'detectee';
}

/** Partie locale de la fiche d'un jeu : toujours disponible, même hors ligne. */
export interface JeuDetail {
  resume: JeuResume;
  sources: SourceDeJeu[];
  /** Grande image du haut de la fiche. null = l'interface utilise la couleur dominante. */
  hero: string | null;
  /** Logo à poser sur le hero. null = l'interface écrit le titre. */
  logo: string | null;
  en_tete: string | null;
  sessions_recentes: Session[];
}

export interface Capture {
  miniature: string;
  pleine: string;
}

export interface Classification {
  organisme: 'PEGI' | 'ESRB' | 'USK' | 'autre';
  valeur: string;
  descripteurs: string[];
}

export interface LangueJeu {
  /** Code court : 'fr', 'en', 'de'… */
  code: string;
  interface: boolean;
  audio: boolean;
  sous_titres: boolean;
}

/** Fiche du magasin (niveau public). N'existe pas pour un jeu hors Steam : erreur `jeu_non_steam`. */
export interface FicheMagasin {
  id_jeu: number;
  /** Langue réelle du texte : la fiche peut être en anglais faute de traduction. */
  langue: Langue;
  description_courte: string;
  /** HTML déjà nettoyé par le cœur (liste blanche, §15). */
  description_html: string | null;
  developpeurs: string[];
  editeurs: string[];
  captures: Capture[];
  acces_anticipe: boolean;
  classification: Classification | null;
  langues: LangueJeu[];
  joueurs_en_ligne: number | null;
  url_magasin: string;
}

// ───────────────────────────── Succès ─────────────────────────────

export interface Succes {
  api_name: string;
  nom: string;
  /** Présente même pour un succès secret : c'est à l'interface de la masquer tant qu'il n'est pas débloqué. */
  description: string | null;
  secret: boolean;
  icone: string;
  icone_grise: string;
  /** Part des joueurs qui l'ont, de 0 à 100. */
  pct_mondial: number | null;
  /** null = inconnu (pas de clé ou profil privé). */
  debloque: boolean | null;
  debloque_le: DateUtc | null;
}

export interface SuccesDuJeu {
  id_jeu: number;
  /** Langue réelle des textes. */
  langue: Langue;
  total: number;
  debloques: number | null;
  /**
   * La liste (niveau public) s'affiche toujours. Ce champ dit pourquoi la progression personnelle
   * manque (`cle_absente`, `cle_refusee`, `profil_prive`), pour que l'écran propose la bonne action.
   */
  progression_erreur: ErreurApp | null;
  liste: Succes[];
}

// ───────────────────────────── Amis et profil ─────────────────────────────

export type StatutAmi = 'en_jeu' | 'en_ligne' | 'absent' | 'occupe' | 'hors_ligne';

export interface JeuEnCoursAmi {
  titre: string;
  steam_appid: number | null;
  /** Rempli si ce jeu est aussi dans notre bibliothèque. */
  id_jeu: number | null;
  /**
   * Vignette au format 2:3, même pour un jeu que nous n'avons pas : le cœur la demande au magasin
   * Steam avec `steam_appid`. null = jeu hors Steam, ou image inconnue : l'interface dessine la bannière.
   */
  jaquette: string | null;
  /** Couleur dominante de cette vignette (#rrggbb), comme `JeuResume.couleur_dominante`. */
  couleur_dominante: string | null;
}

export interface Ami {
  steamid: string;
  pseudo: string;
  avatar: string | null;
  statut: StatutAmi;
  jeu_en_cours: JeuEnCoursAmi | null;
  derniere_connexion: DateUtc | null;
  ami_depuis: DateUtc | null;
}

/** steamid et pseudo sont lus dans les fichiers locaux de Steam ; l'avatar demande la clé. */
export interface Profil {
  steamid: string | null;
  pseudo: string | null;
  avatar: string | null;
}

/** Un PC peut avoir plusieurs comptes Steam (F-02). Le nom de connexion n'est jamais exposé (§8). */
export interface CompteSteam {
  steamid: string;
  pseudo: string;
  actif: boolean;
}

// ───────────────────────────── Actualités ─────────────────────────────

export interface Actualite {
  id: string;
  id_jeu: number;
  steam_appid: number;
  titre: string;
  /** Texte brut court, sans balise, pour les listes. */
  resume: string;
  /** HTML déjà nettoyé par le cœur (BBCode converti, liste blanche, §15). */
  html_sur: string;
  /** Langue réelle : toutes les annonces ne sont pas traduites, l'interface l'affiche. */
  langue: Langue | 'autre';
  type: 'mise_a_jour' | 'annonce';
  date: DateUtc;
  /** Lien vers l'annonce d'origine, ouvert dans le navigateur. */
  url: string;
  image: string | null;
}

// ───────────────────────────── État, paramètres, référentiels ─────────────────────────────

/** 'non_verifiee' = clé enregistrée mais pas encore testée (hors ligne au moment de la saisie). */
export type EtatCle = 'absente' | 'valide' | 'refusee' | 'non_verifiee';

/** Sources en ligne qui ont chacune leur interrupteur dans les paramètres (§13.3). */
export type SourceEnLigne =
  | 'fiches_magasin'
  | 'succes_publics'
  | 'actualites'
  | 'visuels_magasin'
  | 'joueurs_en_ligne';

export interface EtatScan {
  en_cours: boolean;
  dernier: DateUtc | null;
  jeux_trouves: number;
}

export interface SessionEnCours {
  id_jeu: number;
  debut: DateUtc;
}

export interface MiseAJour {
  version: string;
  /** 'disponible' -> 'telechargement' -> 'prete' (redémarrage demandé). */
  etape: 'disponible' | 'telechargement' | 'prete';
  progression_pct: number | null;
}

export interface EtatApp {
  version: string;
  en_ligne: boolean;
  niveau: NiveauDonnees;
  steam_installe: boolean;
  cle: EtatCle;
  /** Vrai tant que l'accueil du premier lancement n'a pas été terminé. */
  premier_lancement: boolean;
  scan: EtatScan;
  session_en_cours: SessionEnCours | null;
  /** Pourquoi les jeux possédés non installés manquent (clé absente, profil privé…). null = tout va bien. */
  jeux_possedes_erreur: ErreurApp | null;
  /** Sources mises en pause par le disjoncteur (§9.4), à signaler discrètement. */
  sources_coupees: SourceEnLigne[];
  mise_a_jour: MiseAJour | null;
}

export type TriBibliotheque = 'titre' | 'dernier_lancement' | 'temps_de_jeu' | 'ajoute_le' | 'date_sortie';

export interface InterrupteursSources {
  fiches_magasin: boolean;
  succes_publics: boolean;
  actualites: boolean;
  visuels_magasin: boolean;
  joueurs_en_ligne: boolean;
}

export interface Affichage {
  vue: 'grille' | 'liste';
  taille_jaquettes: number;
  tri: TriBibliotheque;
  ordre: 'croissant' | 'decroissant';
  montrer_les_jeux_masques: boolean;
}

export interface Parametres {
  langue: Langue;
  dossiers_a_scanner: string[];
  demarrer_avec_windows: boolean;
  reduire_dans_la_zone_de_notification: boolean;
  /** 'systeme' suit le réglage d'animations de Windows. */
  animations: 'systeme' | 'activees' | 'desactivees';
  sources_en_ligne: InterrupteursSources;
  rapports_de_plantage: boolean;
  reveler_les_succes_secrets: boolean;
  affichage: Affichage;
}

export interface Tag {
  id: number;
  nom: string;
}

export interface Referentiels {
  langue: Langue;
  tags: Tag[];
}

// ───────────────────────────── Événements du cœur ─────────────────────────────

export type Domaine = 'bibliotheque' | 'fiche' | 'succes' | 'amis' | 'actualites' | 'profil';

export type Evenement =
  | { type: 'scan_progression'; source: Source; jeux_trouves: number }
  | { type: 'scan_termine'; jeux_trouves: number; duree_ms: number }
  /** Regroupé par le cœur : au plus un événement toutes les 500 ms. */
  | { type: 'bibliotheque_modifiee'; modifies: number[]; retires: number[] }
  | { type: 'session_demarree'; id_jeu: number; debut: DateUtc }
  /** `temps` est le nouveau temps à afficher : l'interface ne calcule rien elle-même. */
  | { type: 'session_terminee'; id_jeu: number; duree_s: number; temps: TempsDeJeu; succes_debloques: string[] }
  /** Le jeu a été lancé mais aucun processus n'est apparu : l'interface arrête son indicateur. */
  | { type: 'lancement_sans_session'; id_jeu: number }
  | { type: 'donnees_rafraichies'; domaine: Domaine; id_jeu: number | null }
  /** Réseau, clé, niveau, source coupée, mise à jour : l'interface relit `etat()`. */
  | { type: 'etat_modifie' };

// ───────────────────────────── Commandes ─────────────────────────────

/** Action passée au client Steam par un lien steam:// (achat, installation, message : §4.2). */
export type ActionSteam =
  | { action: 'voir_dans_le_magasin'; steam_appid: number }
  | { action: 'installer'; steam_appid: number }
  | { action: 'desinstaller'; steam_appid: number }
  | { action: 'envoyer_un_message'; steamid: string }
  | { action: 'ouvrir_le_profil'; steamid: string };

export interface ResultatTestCle {
  etat: EtatCle;
  /** Pseudo du compte Steam du PC relu avec cette clé, pour confirmation visuelle. */
  pseudo: string | null;
  erreur: ErreurApp | null;
}

/** Ce que le cœur a compris d'un fichier déposé (.exe, .lnk, .url), avant de l'ajouter (F-07). */
export interface AnalyseChemin {
  titre_propose: string;
  /** Cible réelle (raccourci résolu). */
  cible: string;
  source: Source;
  icone: string | null;
  /** Rempli si ce jeu est déjà dans la bibliothèque. */
  doublon_de: number | null;
}

/**
 * L'interface appelle `ecouter` AVANT `etat()`, pour ne manquer aucun événement de scan.
 * Les lectures répondent en moins de 100 ms depuis le cache (Q-07).
 */
export interface Coeur {
  // État général
  etat(): Promise<EtatApp>;
  referentiels(langue: Langue): Promise<Referentiels>;
  parametres(): Promise<Parametres>;
  /** On envoie l'objet complet, pas un fragment. */
  modifier_parametres(parametres: Parametres): Promise<Parametres>;
  terminer_premier_lancement(): Promise<void>;
  tout_effacer(): Promise<void>;
  installer_la_mise_a_jour(): Promise<void>;
  /** Bouton « Réessayer » : le résultat arrive par `donnees_rafraichies`. */
  rafraichir(domaine: Domaine, id_jeu: number | null): Promise<void>;

  // Compte Steam du PC
  comptes_steam(): Promise<CompteSteam[]>;
  choisir_le_compte(steamid: string): Promise<void>;

  // Bibliothèque (local, immédiat)
  lister_jeux(): Promise<JeuResume[]>;
  /** Après `bibliotheque_modifiee`, pour ne relire que les jeux touchés. */
  jeux(ids: number[]): Promise<JeuResume[]>;
  detail_jeu(id_jeu: number): Promise<JeuDetail>;
  lister_sessions(id_jeu: number, limite: number, avant: DateUtc | null): Promise<Session[]>;
  definir_favori(id_jeu: number, favori: boolean): Promise<void>;
  definir_masque(id_jeu: number, masque: boolean): Promise<void>;
  renommer_un_jeu(id_jeu: number, titre: string): Promise<void>;
  relancer_le_scan(): Promise<void>;

  // Ajout manuel (F-07)
  analyser_un_chemin(chemin: string): Promise<AnalyseChemin>;
  ajouter_un_jeu_manuel(chemin: string, titre: string): Promise<JeuResume>;
  retirer_un_jeu_manuel(id_jeu: number): Promise<void>;
  /** Quand l'exécutable n'a pas été trouvé seul (§11.3) : le choix est mémorisé. */
  choisir_l_exe(id_jeu: number, source: Source, chemin: string): Promise<void>;

  // Lancement
  /** `source` null = le cœur choisit (utile quand un jeu existe chez deux stores). */
  lancer(id_jeu: number, source: Source | null): Promise<void>;
  ouvrir_le_dossier(id_jeu: number): Promise<void>;
  action_steam(action: ActionSteam): Promise<void>;
  /** Ouvre un lien https dans le navigateur par défaut, jamais dans l'application (§15). */
  ouvrir_un_lien(url: string): Promise<void>;

  // Données en ligne (toujours enveloppées dans Reponse)
  fiche_du_jeu(id_jeu: number): Promise<Reponse<FicheMagasin>>;
  succes_du_jeu(id_jeu: number): Promise<Reponse<SuccesDuJeu>>;
  amis(): Promise<Reponse<Ami[]>>;
  actualites_du_jeu(id_jeu: number, limite: number, avant: DateUtc | null): Promise<Reponse<Actualite[]>>;
  /**
   * Fil global, les plus récentes d'abord. Il ne couvre que les jeux installés et ceux joués
   * récemment : le quota (500 appels par jour) interdit de suivre 2 000 jeux.
   */
  fil_d_actualites(limite: number, avant: DateUtc | null): Promise<Reponse<Actualite[]>>;
  profil(): Promise<Reponse<Profil>>;

  // Clé API (jamais relue par l'interface une fois enregistrée)
  /** Une clé refusée n'est pas conservée. Hors ligne, elle est conservée avec l'état 'non_verifiee'. */
  enregistrer_la_cle(cle: string): Promise<ResultatTestCle>;
  supprimer_la_cle(): Promise<void>;

  // Événements
  ecouter(rappel: (evenement: Evenement) => void): () => void;
}
