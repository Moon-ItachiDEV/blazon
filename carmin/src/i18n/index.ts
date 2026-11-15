/**
 * Textes de l'interface. Règle 3 du contrat : le cœur n'écrit aucun texte destiné au joueur,
 * il renvoie des codes ; c'est ici qu'ils deviennent des phrases, en français ou en anglais.
 *
 * Les clés sont à plat (« erreurs.hors_ligne ») : TypeScript connaît ainsi chaque clé,
 * et une faute de frappe casse la compilation au lieu d'afficher une clé brute à l'écran.
 */
import type { ErreurApp, Langue, Source } from '../../contrat/types';
import en from './en.json';
import fr from './fr.json';

export type CleDeTexte = keyof typeof fr;

// Cette affectation casse la compilation si une clé française manque en anglais.
const anglais: Record<CleDeTexte, string> = en;

export const DICTIONNAIRES: Record<Langue, Record<CleDeTexte, string>> = { fr, en: anglais };

export type Valeurs = Record<string, string | number>;

function estCleDeTexte(cle: string): cle is CleDeTexte {
  return Object.hasOwn(fr, cle);
}

/** Remplace chaque `{nom}` par sa valeur. Une valeur absente laisse le repère visible, pour le repérer. */
export function traduire(langue: Langue, cle: CleDeTexte, valeurs: Valeurs = {}): string {
  return DICTIONNAIRES[langue][cle].replace(/\{(\w+)\}/g, (repere: string, nom: string) =>
    Object.hasOwn(valeurs, nom) ? String(valeurs[nom]) : repere,
  );
}

/** Bases des textes qui s'accordent en nombre : « bibliotheque.jeux » pour les clés « .un » et « .autre ». */
type BaseDe<C> = C extends `${infer B}.un` ? B : never;
export type BasePluriel = BaseDe<CleDeTexte>;

// Cette affectation casse la compilation si une clé « .un » n'a pas sa sœur « .autre ».
const accords: Record<`${BasePluriel}.autre`, string> = fr;
void accords;

const REGLES: Record<Langue, Intl.PluralRules> = { fr: new Intl.PluralRules('fr'), en: new Intl.PluralRules('en') };
const NOMBRES: Record<Langue, Intl.NumberFormat> = { fr: new Intl.NumberFormat('fr-FR'), en: new Intl.NumberFormat('en-GB') };

/**
 * Texte accordé en nombre. C'est le navigateur qui connaît la règle de chaque langue :
 * « 0 jeu » en français, « 0 games » en anglais. `{n}` est remplacé par le nombre mis en forme.
 */
export function pluriel(langue: Langue, base: BasePluriel, nombre: number, valeurs: Valeurs = {}): string {
  const forme = REGLES[langue].select(nombre) === 'one' ? 'un' : 'autre';
  return traduire(langue, `${base}.${forme}`, { n: NOMBRES[langue].format(nombre), ...valeurs });
}

const SOURCES: ReadonlySet<string> = new Set<Source>(['steam', 'epic', 'gog', 'manuel']);

/**
 * Phrase d'une erreur du cœur. Une clé inconnue retombe sur l'erreur générique :
 * l'écran n'affiche jamais une clé brute. Un détail `source` est traduit en nom lisible.
 */
export function texteErreur(langue: Langue, e: ErreurApp): string {
  const cle = estCleDeTexte(e.cle_i18n) ? e.cle_i18n : 'erreurs.interne';
  const valeurs: Valeurs = { ...(e.details ?? {}) };
  const source = valeurs.source;
  if (typeof source === 'string' && SOURCES.has(source)) {
    valeurs.source = traduire(langue, `sources.${source as Source}`);
  }
  return traduire(langue, cle, valeurs);
}
