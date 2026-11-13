/**
 * Groupes, tri, filtre et parties en cours de la liste d'amis. Des fonctions pures : l'écran n'a qu'à les appeler.
 */
import type { Ami, JeuEnCoursAmi, Langue, StatutAmi } from '../../contrat/types';

/** Au-delà de ce nombre d'amis, l'écran propose un champ pour filtrer. */
export const SEUIL_DU_FILTRE = 10;

/** Trois groupes, comme dans Steam : un ami absent ou occupé reste « en ligne », son statut le précise. */
export type CleDeGroupe = 'en_jeu' | 'en_ligne' | 'hors_ligne';

export interface Groupe {
  cle: CleDeGroupe;
  amis: Ami[];
}

/** L'ordre des groupes à l'écran : ceux avec qui on peut jouer tout de suite d'abord. */
export const ORDRE_DES_GROUPES: readonly CleDeGroupe[] = ['en_jeu', 'en_ligne', 'hors_ligne'];

export function groupeDe(statut: StatutAmi): CleDeGroupe {
  return statut === 'absent' || statut === 'occupe' ? 'en_ligne' : statut;
}

/** À l'intérieur du groupe En ligne : les amis disponibles, puis les absents, puis ceux qui ne veulent pas être dérangés. */
const RANG_DU_STATUT: Record<StatutAmi, number> = { en_jeu: 0, en_ligne: 0, absent: 1, occupe: 2, hors_ligne: 0 };

/** Minuscules et sans accent, mais sans toucher à la ponctuation ni aux alphabets non latins : les pseudos en sont pleins. */
export function normaliserPseudo(texte: string): string {
  return texte
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .trim();
}

/**
 * Garde les amis dont le pseudo contient le texte tapé, ou qui jouent à un jeu dont le titre le contient
 * (« hell » retrouve ceux qui sont sur HELLDIVERS 2). Un texte vide ne filtre rien.
 */
export function filtrerLesAmis(amis: readonly Ami[], texte: string): Ami[] {
  const cherche = normaliserPseudo(texte);
  if (cherche === '') return [...amis];
  return amis.filter((ami) => normaliserPseudo(ami.pseudo).includes(cherche) || (ami.jeu_en_cours !== null && normaliserPseudo(ami.jeu_en_cours.titre).includes(cherche)));
}

/** `numeric` : « Joueur2 » avant « Joueur10 ». `base` : « a » et « A » comptent pour la même lettre. */
function collateurDe(langue: Langue): Intl.Collator {
  return new Intl.Collator(langue, { sensitivity: 'base', numeric: true });
}

/**
 * Range les amis par groupe, dans l'ordre de `ORDRE_DES_GROUPES`, puis par disponibilité et par pseudo
 * à l'intérieur de chaque groupe. Un groupe vide n'est pas renvoyé. La liste reçue n'est pas modifiée.
 */
export function grouperLesAmis(amis: readonly Ami[], langue: Langue): Groupe[] {
  const collateur = collateurDe(langue);
  return ORDRE_DES_GROUPES.map((cle) => ({
    cle,
    amis: amis
      .filter((ami) => groupeDe(ami.statut) === cle)
      .sort((a, b) => RANG_DU_STATUT[a.statut] - RANG_DU_STATUT[b.statut] || collateur.compare(a.pseudo, b.pseudo) || a.steamid.localeCompare(b.steamid)),
  })).filter((groupe) => groupe.amis.length > 0);
}

/** Un jeu auquel un ou plusieurs amis jouent en ce moment. */
export interface Partie {
  /** Stable d'un affichage à l'autre : sert de clé à la bannière. */
  cle: string;
  jeu: JeuEnCoursAmi;
  amis: Ami[];
}

/** Deux amis sont dans la même partie s'ils jouent au même jeu : même fiche chez nous, sinon même appid Steam, sinon même titre. */
function cleDePartie(jeu: JeuEnCoursAmi): string {
  if (jeu.id_jeu !== null) return `jeu:${jeu.id_jeu}`;
  if (jeu.steam_appid !== null) return `steam:${jeu.steam_appid}`;
  return `titre:${normaliserPseudo(jeu.titre)}`;
}

/**
 * Réunit les amis en jeu par jeu. Les parties les plus peuplées d'abord, puis celles qui ont une image,
 * puis par titre ; les amis d'une partie par pseudo. Un ami « en jeu » sans jeu connu n'apparaît pas ici.
 */
export function partiesEnCours(amis: readonly Ami[], langue: Langue): Partie[] {
  const collateur = collateurDe(langue);
  const parties = new Map<string, Partie>();
  for (const ami of amis) {
    if (ami.statut !== 'en_jeu' || ami.jeu_en_cours === null) continue;
    const cle = cleDePartie(ami.jeu_en_cours);
    const partie = parties.get(cle);
    if (partie === undefined) parties.set(cle, { cle, jeu: ami.jeu_en_cours, amis: [ami] });
    else partie.amis.push(ami);
  }
  const liste = [...parties.values()];
  for (const partie of liste) partie.amis.sort((a, b) => collateur.compare(a.pseudo, b.pseudo) || a.steamid.localeCompare(b.steamid));
  const sansImage = (partie: Partie) => (partie.jeu.jaquette === null ? 1 : 0);
  return liste.sort((a, b) => b.amis.length - a.amis.length || sansImage(a) - sansImage(b) || collateur.compare(a.jeu.titre, b.jeu.titre) || a.cle.localeCompare(b.cle));
}

/** Les trois zones de l'écran Amis. */
export interface Repartition {
  /** Ce qui se joue en ce moment, une entrée par jeu. */
  parties: Partie[];
  /** Les amis connectés qui ne sont dans aucune partie : en ligne, absents, occupés. */
  connectes: Ami[];
  horsLigne: Ami[];
}

/**
 * Répartit les amis entre les trois zones. Un ami « en jeu » dont Steam ne donne pas le jeu n'a pas de
 * bannière : il passe en tête des connectés, pour ne disparaître de nulle part.
 */
export function repartirLesAmis(amis: readonly Ami[], langue: Langue): Repartition {
  const groupes = new Map(grouperLesAmis(amis, langue).map((groupe) => [groupe.cle, groupe.amis]));
  const enJeu = groupes.get('en_jeu') ?? [];
  return {
    parties: partiesEnCours(enJeu, langue),
    connectes: [...enJeu.filter((ami) => ami.jeu_en_cours === null), ...(groupes.get('en_ligne') ?? [])],
    horsLigne: groupes.get('hors_ligne') ?? [],
  };
}
