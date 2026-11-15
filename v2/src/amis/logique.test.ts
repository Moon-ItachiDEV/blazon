import { describe, expect, it } from 'vitest';
import type { Ami, JeuEnCoursAmi, StatutAmi } from '../../contrat/types';
import { filtrerLesAmis, groupeDe, grouperLesAmis, normaliserPseudo, partiesEnCours, repartirLesAmis } from './logique';

function ami(pseudo: string, statut: StatutAmi, steamid = pseudo): Ami {
  return { steamid, pseudo, avatar: null, statut, jeu_en_cours: null, derniere_connexion: null, ami_depuis: null };
}

function jeu(titre: string, partie: Partial<JeuEnCoursAmi> = {}): JeuEnCoursAmi {
  return { titre, steam_appid: null, id_jeu: null, jaquette: null, couleur_dominante: null, ...partie };
}

function joueur(pseudo: string, enCours: JeuEnCoursAmi): Ami {
  return { ...ami(pseudo, 'en_jeu'), jeu_en_cours: enCours };
}

const pseudos = (amis: Ami[]) => amis.map((a) => a.pseudo);

describe('groupes', () => {
  it('range les amis dans l\'ordre En jeu, En ligne, Hors ligne', () => {
    const groupes = grouperLesAmis([ami('a', 'hors_ligne'), ami('b', 'occupe'), ami('c', 'en_ligne'), ami('d', 'en_jeu'), ami('e', 'absent')], 'fr');
    expect(groupes.map((g) => g.cle)).toEqual(['en_jeu', 'en_ligne', 'hors_ligne']);
  });

  it('garde les absents et les occupés dans En ligne, après les amis disponibles', () => {
    expect(groupeDe('absent')).toBe('en_ligne');
    expect(groupeDe('occupe')).toBe('en_ligne');
    const [groupe] = grouperLesAmis([ami('Alex', 'occupe'), ami('Zoé', 'absent'), ami('Malo', 'en_ligne'), ami('Bob', 'absent')], 'fr');
    expect(pseudos(groupe?.amis ?? [])).toEqual(['Malo', 'Bob', 'Zoé', 'Alex']);
  });

  it('ne renvoie pas les groupes vides', () => {
    expect(grouperLesAmis([ami('a', 'en_ligne')], 'fr').map((g) => g.cle)).toEqual(['en_ligne']);
    expect(grouperLesAmis([], 'fr')).toEqual([]);
  });

  it('trie par pseudo sans tenir compte de la casse ni des accents, et comprend les nombres', () => {
    const [groupe] = grouperLesAmis([ami('zed', 'en_ligne'), ami('Émile', 'en_ligne'), ami('alice', 'en_ligne'), ami('Joueur10', 'en_ligne'), ami('Joueur2', 'en_ligne')], 'fr');
    expect(pseudos(groupe?.amis ?? [])).toEqual(['alice', 'Émile', 'Joueur2', 'Joueur10', 'zed']);
  });

  it('ne modifie pas la liste reçue', () => {
    const liste = [ami('b', 'en_ligne'), ami('a', 'en_ligne')];
    grouperLesAmis(liste, 'fr');
    expect(pseudos(liste)).toEqual(['b', 'a']);
  });

  it('garde deux amis au même pseudo, dans un ordre stable', () => {
    const [groupe] = grouperLesAmis([ami('Kai', 'en_ligne', '2'), ami('Kai', 'en_ligne', '1')], 'fr');
    expect(groupe?.amis.map((a) => a.steamid)).toEqual(['1', '2']);
  });
});

describe('filtre', () => {
  const amis = [ami('Émilie', 'en_ligne'), ami('le_poulpe', 'en_jeu'), ami('ZED_Mortel', 'hors_ligne'), ami('Яна', 'hors_ligne')];

  it('cherche sans accent ni casse', () => {
    expect(normaliserPseudo('  ÉMILIE ')).toBe('emilie');
    expect(pseudos(filtrerLesAmis(amis, 'emil'))).toEqual(['Émilie']);
    expect(pseudos(filtrerLesAmis(amis, 'ÉMIL'))).toEqual(['Émilie']);
    expect(pseudos(filtrerLesAmis(amis, 'zed_m'))).toEqual(['ZED_Mortel']);
  });

  it('un texte vide ou fait d\'espaces garde tout le monde', () => {
    expect(filtrerLesAmis(amis, '')).toHaveLength(4);
    expect(filtrerLesAmis(amis, '   ')).toHaveLength(4);
  });

  it('retrouve un pseudo en alphabet non latin', () => {
    expect(pseudos(filtrerLesAmis(amis, 'яна'))).toEqual(['Яна']);
  });

  it('ne renvoie rien quand personne ne correspond', () => {
    expect(filtrerLesAmis(amis, 'zzz')).toEqual([]);
  });

  it('retrouve aussi un ami par le jeu auquel il joue', () => {
    const liste = [joueur('Aurore', jeu('HELLDIVERS™ 2')), joueur('Kaelis', jeu('NBA 2K27')), ami('Helline', 'en_ligne')];
    expect(pseudos(filtrerLesAmis(liste, 'hell'))).toEqual(['Aurore', 'Helline']);
  });
});

describe('parties en cours', () => {
  it('réunit les amis qui jouent au même jeu, triés par pseudo', () => {
    const helldivers = jeu('HELLDIVERS™ 2', { id_jeu: 42, steam_appid: 553850, jaquette: 'h.jpg' });
    const parties = partiesEnCours([joueur('Zed', helldivers), joueur('Kaelis', jeu('NBA 2K27', { id_jeu: 41, jaquette: 'n.jpg' })), joueur('alice', { ...helldivers })], 'fr');
    expect(parties.map((p) => [p.jeu.titre, pseudos(p.amis)])).toEqual([
      ['HELLDIVERS™ 2', ['alice', 'Zed']],
      ['NBA 2K27', ['Kaelis']],
    ]);
  });

  it('reconnaît le même jeu par sa fiche, sinon par son appid, sinon par son titre', () => {
    const parties = partiesEnCours(
      [
        joueur('a', jeu('Minecraft')),
        joueur('b', jeu('minecraft ')),
        joueur('c', jeu('Rust', { steam_appid: 252490 })),
        joueur('d', jeu('Rust (bêta)', { steam_appid: 252490 })),
        joueur('e', jeu('Rust', { id_jeu: 7, steam_appid: 252490 })),
      ],
      'fr',
    );
    expect(parties.map((p) => pseudos(p.amis))).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('met d\'abord les parties les plus peuplées, puis celles qui ont une image, puis par titre', () => {
    const parties = partiesEnCours(
      [
        joueur('a', jeu('Zelda-like', { steam_appid: 1 })),
        joueur('b', jeu('Astro', { steam_appid: 2, jaquette: 'a.jpg' })),
        joueur('c', jeu('Brume', { steam_appid: 3, jaquette: 'b.jpg' })),
        joueur('d', jeu('Duo', { steam_appid: 4 })),
        joueur('e', jeu('Duo', { steam_appid: 4 })),
      ],
      'fr',
    );
    expect(parties.map((p) => p.jeu.titre)).toEqual(['Duo', 'Astro', 'Brume', 'Zelda-like']);
  });

  it('laisse de côté ceux qui ne jouent pas, et un ami en jeu dont Steam ne donne pas le jeu', () => {
    expect(partiesEnCours([ami('a', 'en_ligne'), ami('b', 'en_jeu'), ami('c', 'hors_ligne')], 'fr')).toEqual([]);
  });

  it('ne modifie pas la liste reçue', () => {
    const liste = [joueur('b', jeu('X')), joueur('a', jeu('X'))];
    partiesEnCours(liste, 'fr');
    expect(pseudos(liste)).toEqual(['b', 'a']);
  });
});

describe('répartition de l\'écran', () => {
  it('sépare les parties, les connectés et les hors ligne', () => {
    const zones = repartirLesAmis([ami('Zoé', 'hors_ligne'), joueur('Kaelis', jeu('NBA 2K27')), ami('Malo', 'en_ligne'), ami('Bob', 'absent')], 'fr');
    expect(zones.parties.map((p) => pseudos(p.amis))).toEqual([['Kaelis']]);
    expect(pseudos(zones.connectes)).toEqual(['Malo', 'Bob']);
    expect(pseudos(zones.horsLigne)).toEqual(['Zoé']);
  });

  it('garde parmi les connectés, en tête, un ami en jeu dont le jeu est inconnu', () => {
    const zones = repartirLesAmis([ami('Malo', 'en_ligne'), ami('Yuna', 'en_jeu')], 'fr');
    expect(zones.parties).toEqual([]);
    expect(pseudos(zones.connectes)).toEqual(['Yuna', 'Malo']);
  });

  it('ne perd personne', () => {
    const liste = [ami('a', 'hors_ligne'), ami('b', 'occupe'), ami('c', 'en_ligne'), ami('d', 'en_jeu'), joueur('e', jeu('X')), joueur('f', jeu('X'))];
    const zones = repartirLesAmis(liste, 'fr');
    expect(zones.parties.flatMap((p) => p.amis).length + zones.connectes.length + zones.horsLigne.length).toBe(liste.length);
  });
});
