/**
 * Les adresses de l'application. Fonctions pures : une route devient un texte (« #/jeu/49 »),
 * un texte redevient une route. Une adresse inconnue ramène à la bibliothèque, jamais à une page blanche.
 */
export const SECTIONS_PARAMETRES = ['general', 'steam', 'bibliotheque', 'donnees', 'a_propos'] as const;
export type SectionParametres = (typeof SECTIONS_PARAMETRES)[number];

export type Route =
  /** `tout` : la page Bibliothèque (toute la collection, sans la vitrine de l'accueil). */
  | { ecran: 'bibliotheque'; recherche: string; tout?: boolean }
  | { ecran: 'jeu'; id_jeu: number }
  | { ecran: 'succes'; id_jeu: number }
  | { ecran: 'actualites' }
  | { ecran: 'amis' }
  | { ecran: 'profil' }
  | { ecran: 'parametres'; section: SectionParametres }
  | { ecran: 'ajout' };

export const ACCUEIL: Route = { ecran: 'bibliotheque', recherche: '' };
export const BIBLIOTHEQUE: Route = { ecran: 'bibliotheque', recherche: '', tout: true };

function entierPositif(texte: string | undefined): number | null {
  if (texte === undefined || !/^\d{1,9}$/.test(texte)) return null;
  const nombre = Number(texte);
  return nombre > 0 ? nombre : null;
}

export function ecrireRoute(route: Route): string {
  switch (route.ecran) {
    case 'bibliotheque':
      if (route.recherche !== '') return `#/?q=${encodeURIComponent(route.recherche)}`;
      return route.tout === true ? '#/bibliotheque' : '#/';
    case 'jeu':
      return `#/jeu/${route.id_jeu}`;
    case 'succes':
      return `#/jeu/${route.id_jeu}/succes`;
    case 'parametres':
      return route.section === 'general' ? '#/parametres' : `#/parametres/${route.section}`;
    default:
      return `#/${route.ecran}`;
  }
}

export function lireRoute(hash: string): Route {
  const [chemin = '', requete = ''] = hash.replace(/^#\/?/, '').split('?');
  const [premier, deuxieme, troisieme] = chemin.split('/').filter((morceau) => morceau !== '');
  switch (premier) {
    case undefined:
      return { ecran: 'bibliotheque', recherche: new URLSearchParams(requete).get('q')?.slice(0, 80) ?? '' };
    case 'jeu': {
      const id_jeu = entierPositif(deuxieme);
      if (id_jeu === null) return ACCUEIL;
      return troisieme === 'succes' ? { ecran: 'succes', id_jeu } : { ecran: 'jeu', id_jeu };
    }
    case 'actualites':
    case 'amis':
    case 'profil':
    case 'ajout':
      return { ecran: premier };
    case 'bibliotheque':
      return { ecran: 'bibliotheque', recherche: '', tout: true };
    case 'parametres': {
      const section = SECTIONS_PARAMETRES.find((s) => s === deuxieme) ?? 'general';
      return { ecran: 'parametres', section };
    }
    default:
      return ACCUEIL;
  }
}
