/**
 * Situations que le faux cœur sait jouer, pour dessiner et tester chaque état d'écran
 * sans attendre le vrai cœur. On en choisit une dans l'adresse : `?scenario=hors_ligne`.
 */
export const SCENARIOS = [
  /** Tout va bien : clé valide, en ligne, 2 000 jeux. */
  'normal',
  /** Première ouverture : accueil, pas de clé, le scan du PC se déroule sous les yeux du joueur. */
  'premier_lancement',
  /** Pas de clé : seuls les jeux installés sont connus, pas de progression ni d'amis. */
  'sans_cle',
  /** La clé enregistrée est refusée par Steam. */
  'cle_refusee',
  /** Clé valide mais profil Steam privé : ni jeux possédés, ni progression, ni amis. */
  'profil_prive',
  /** Pas de réseau : on montre ce qui est en cache, le reste est indisponible. */
  'hors_ligne',
  /** Un jeu tourne : le réseau est en pause. */
  'mode_jeu',
  /** Le quota d'appels du jour est épuisé. */
  'quota_atteint',
  /** La source des actualités a été mise en pause après des échecs répétés. */
  'source_coupee',
  /** Aucun jeu trouvé et Steam n'est pas installé. */
  'bibliotheque_vide',
  /** Une nouvelle version de l'application est disponible. */
  'mise_a_jour',
] as const;

export type Scenario = (typeof SCENARIOS)[number];

export function estScenario(valeur: string | null): valeur is Scenario {
  return valeur !== null && (SCENARIOS as readonly string[]).includes(valeur);
}

/** Lit `?scenario=…` dans la partie « recherche » d'une adresse. Valeur inconnue : `normal`. */
export function lireScenario(recherche: string): Scenario {
  const valeur = new URLSearchParams(recherche).get('scenario');
  return estScenario(valeur) ? valeur : 'normal';
}
