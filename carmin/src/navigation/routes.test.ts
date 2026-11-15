import { describe, expect, it } from 'vitest';
import { ACCUEIL, ecrireRoute, lireRoute, type Route } from './routes';

describe('adresses de l’application', () => {
  const routes: Route[] = [
    { ecran: 'bibliotheque', recherche: '' },
    { ecran: 'bibliotheque', recherche: 'épée & magie' },
    { ecran: 'jeu', id_jeu: 49 },
    { ecran: 'succes', id_jeu: 49 },
    { ecran: 'actualites' },
    { ecran: 'amis' },
    { ecran: 'profil' },
    { ecran: 'ajout' },
    { ecran: 'parametres', section: 'general' },
    { ecran: 'parametres', section: 'steam' },
  ];

  it('relit chaque route telle qu’elle a été écrite', () => {
    for (const route of routes) expect(lireRoute(ecrireRoute(route))).toEqual(route);
  });

  it('écrit des adresses courtes et lisibles', () => {
    expect(ecrireRoute(ACCUEIL)).toBe('#/');
    expect(ecrireRoute({ ecran: 'jeu', id_jeu: 49 })).toBe('#/jeu/49');
    expect(ecrireRoute({ ecran: 'succes', id_jeu: 49 })).toBe('#/jeu/49/succes');
    expect(ecrireRoute({ ecran: 'parametres', section: 'general' })).toBe('#/parametres');
  });

  it('ramène à la bibliothèque devant une adresse inconnue ou abîmée', () => {
    for (const hash of ['', '#', '#/inconnu', '#/jeu', '#/jeu/abc', '#/jeu/0', '#/jeu/-3', '#/jeu/1e9', '#/jeu/99999999999']) {
      expect(lireRoute(hash)).toEqual(ACCUEIL);
    }
    expect(lireRoute('#/parametres/nimporte')).toEqual({ ecran: 'parametres', section: 'general' });
  });

  it('limite la longueur d’une recherche venue de l’adresse', () => {
    const route = lireRoute(`#/?q=${'a'.repeat(500)}`);
    expect(route.ecran === 'bibliotheque' && route.recherche.length).toBe(80);
  });
});

describe('la page Bibliothèque', () => {
  it('a sa propre adresse, distincte de l’accueil', () => {
    expect(ecrireRoute({ ecran: 'bibliotheque', recherche: '', tout: true })).toBe('#/bibliotheque');
    expect(lireRoute('#/bibliotheque')).toEqual({ ecran: 'bibliotheque', recherche: '', tout: true });
    expect(lireRoute('#/')).toEqual({ ecran: 'bibliotheque', recherche: '' });
  });
});
