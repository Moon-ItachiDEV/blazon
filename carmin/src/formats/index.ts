/**
 * Mise en forme des nombres, des durées et des dates, identique sur tous les écrans.
 * Tout passe par `Intl` : c'est le navigateur qui connaît les règles de chaque langue
 * (espace des milliers, « 5 nov. », virgule décimale), on ne les réécrit pas à la main.
 */
import type { DateUtc, Langue } from '../../contrat/types';
import { traduire } from '../i18n';

const LOCALES: Record<Langue, string> = { fr: 'fr-FR', en: 'en-GB' };
const JOUR_MS = 86_400_000;

export function formaterNombre(nombre: number, langue: Langue): string {
  return new Intl.NumberFormat(LOCALES[langue]).format(nombre);
}

/** « 97 % » en français (avec l'espace), « 97% » en anglais. */
export function formaterPourcentage(pourcentage: number, langue: Langue): string {
  return new Intl.NumberFormat(LOCALES[langue], { style: 'percent', maximumFractionDigits: 0 }).format(pourcentage / 100);
}

/** Temps de jeu d'un jeu : « 13 min », « 72 h », « 1 250 h ». On arrondit vers le bas, comme Steam. */
export function formaterTempsDeJeu(minutes: number, langue: Langue): string {
  if (minutes < 60) return `${Math.max(0, Math.floor(minutes))} min`;
  return `${formaterNombre(Math.floor(minutes / 60), langue)} h`;
}

/** Durée d'une session : « Moins d'une minute », « 51 min », « 1 h 41 », « 2 h 02 ». */
export function formaterDureeDeSession(secondes: number, langue: Langue): string {
  if (secondes < 60) return traduire(langue, 'duree.moins_d_une_minute');
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Taille sur le disque, en unités de Windows (1 Go = 1 024 Mo) : « 538 Mo », « 16,7 Go ». */
export function formaterTaille(octets: number, langue: Langue): string {
  const mo = octets / 1024 ** 2;
  if (mo < 1024) return `${formaterNombre(Math.round(mo), langue)} ${traduire(langue, 'unites.mo')}`;
  const go = new Intl.NumberFormat(LOCALES[langue], { maximumFractionDigits: 1 }).format(mo / 1024);
  return `${go} ${traduire(langue, 'unites.go')}`;
}

/** Numéro du jour dans le fuseau donné : deux instants du même jour local ont le même numéro. */
function jourLocal(instant: Date, fuseau: string | undefined): number {
  const parties = new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const lire = (type: 'year' | 'month' | 'day') => Number(parties.find((p) => p.type === type)?.value);
  return Math.round(Date.UTC(lire('year'), lire('month') - 1, lire('day')) / JOUR_MS);
}

/** « 5 nov. » si c'est l'année en cours, « 10 sept. 2024 » sinon. `fuseau` absent = celui du PC. */
export function formaterDate(date: DateUtc, langue: Langue, maintenant: Date, fuseau?: string): string {
  const instant = new Date(date);
  const annee = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric' }).format(d);
  return new Intl.DateTimeFormat(LOCALES[langue], {
    timeZone: fuseau,
    day: 'numeric',
    month: 'short',
    ...(annee(instant) === annee(maintenant) ? {} : { year: 'numeric' as const }),
  }).format(instant);
}

/** « Aujourd'hui », « Hier », « Il y a 5 jours », puis la date. Les jours sont ceux du calendrier local. */
export function formaterDateRelative(date: DateUtc, langue: Langue, maintenant: Date, fuseau?: string): string {
  const ecart = jourLocal(maintenant, fuseau) - jourLocal(new Date(date), fuseau);
  if (ecart <= 0) return traduire(langue, 'temps.aujourdhui');
  if (ecart === 1) return traduire(langue, 'temps.hier');
  if (ecart < 7) return traduire(langue, 'temps.il_y_a_jours', { jours: ecart });
  return formaterDate(date, langue, maintenant, fuseau);
}

/** « 5 nov., 23:39 » pour une session ; l'année s'ajoute si ce n'est pas l'année en cours. */
export function formaterDateHeure(date: DateUtc, langue: Langue, maintenant: Date, fuseau?: string): string {
  const instant = new Date(date);
  const annee = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric' }).format(d);
  return new Intl.DateTimeFormat(LOCALES[langue], {
    timeZone: fuseau,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(annee(instant) === annee(maintenant) ? {} : { year: 'numeric' as const }),
  }).format(instant);
}

/** Date complète, toujours avec l'année : « 10 sept. 2024 ». */
export function formaterDateComplete(date: DateUtc, langue: Langue, fuseau?: string): string {
  return new Intl.DateTimeFormat(LOCALES[langue], { timeZone: fuseau, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
}

export function formaterAnnee(date: DateUtc, fuseau?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric' }).format(new Date(date));
}

/** Part de joueurs : une décimale sous 10 %, pour distinguer « 0,4 % » de « 4 % ». */
export function formaterPart(pourcentage: number, langue: Langue): string {
  return new Intl.NumberFormat(LOCALES[langue], { style: 'percent', maximumFractionDigits: pourcentage < 10 ? 1 : 0 }).format(pourcentage / 100);
}
