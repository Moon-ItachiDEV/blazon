import { describe, expect, it } from 'vitest';
import type { AnalyseChemin, ErreurApp } from '../../contrat/types';
import { erreur } from '../coeur/erreurs';
import { couleurDeLApercu, ETAT_INITIAL, etapeDe, evoluer, extensionAcceptee, extensionDe, jeuDejaPresent, nettoyerChemin, nomDuFichier, titreAEnvoyer, titreProvisoire, type EtatAjout } from './logique';

const ANALYSE: AnalyseChemin = { titre_propose: 'Mon Jeu', cible: 'C:\\Jeux\\Mon Jeu\\jeu.exe', source: 'manuel', icone: null, doublon_de: null };

describe('nettoyage du chemin', () => {
  it('retire les guillemets de « Copier en tant que chemin d’accès » et les espaces', () => {
    expect(nettoyerChemin('"C:\\Jeux\\Mon Jeu\\jeu.exe"')).toBe('C:\\Jeux\\Mon Jeu\\jeu.exe');
    expect(nettoyerChemin('  "C:\\Jeux\\jeu.exe"\n')).toBe('C:\\Jeux\\jeu.exe');
    expect(nettoyerChemin('“C:\\Jeux\\jeu.exe”')).toBe('C:\\Jeux\\jeu.exe');
    expect(nettoyerChemin('"" C:\\Jeux\\jeu.exe ""')).toBe('C:\\Jeux\\jeu.exe');
    expect(nettoyerChemin('C:\\Jeux\\jeu.exe')).toBe('C:\\Jeux\\jeu.exe');
    expect(nettoyerChemin('   ')).toBe('');
  });

  it('garde un guillemet qui n’entoure pas tout le chemin', () => {
    expect(nettoyerChemin('"C:\\Jeux\\jeu.exe')).toBe('"C:\\Jeux\\jeu.exe');
  });
});

describe('extension', () => {
  it('accepte .exe, .lnk et .url, quelle que soit la casse', () => {
    expect(extensionAcceptee('C:\\Jeux\\jeu.EXE')).toBe(true);
    expect(extensionAcceptee('C:\\Users\\Moi\\Desktop\\Jeu.lnk')).toBe(true);
    expect(extensionAcceptee('C:\\Jeux\\Jeu.url')).toBe(true);
    expect(extensionAcceptee('C:\\Jeux\\notes.txt')).toBe(false);
    expect(extensionAcceptee('C:\\Jeux\\exe')).toBe(false);
    expect(extensionAcceptee('C:\\Jeux.exe\\lisezmoi')).toBe(false);
  });

  it('lit l’extension du nom de fichier seulement', () => {
    expect(extensionDe('C:\\Mes.Jeux\\Jeu')).toBeNull();
    expect(extensionDe('C:\\Jeux\\.exe')).toBeNull();
    expect(extensionDe('C:\\Jeux\\jeu.')).toBeNull();
    expect(nomDuFichier('C:\\Jeux\\Mon Jeu\\jeu.exe')).toBe('jeu.exe');
    expect(nomDuFichier('C:/Jeux/jeu.exe')).toBe('jeu.exe');
    expect(nomDuFichier('jeu.exe')).toBe('jeu.exe');
  });
});

describe('titre et doublon', () => {
  it('reprend le titre proposé si le joueur a tout effacé', () => {
    expect(titreAEnvoyer('  Mon jeu préféré ', ANALYSE)).toBe('Mon jeu préféré');
    expect(titreAEnvoyer('   ', ANALYSE)).toBe('Mon Jeu');
  });

  it('retrouve le jeu existant dans une erreur deja_present', () => {
    expect(jeuDejaPresent(erreur('deja_present', { id_jeu: 2001 }))).toBe(2001);
    expect(jeuDejaPresent(erreur('deja_present'))).toBeNull();
    expect(jeuDejaPresent(erreur('deja_present', { id_jeu: '2001' }))).toBeNull();
    expect(jeuDejaPresent(erreur('chemin_invalide', { id_jeu: 2001 }))).toBeNull();
    expect(jeuDejaPresent(null)).toBeNull();
  });
});

describe('états de l’écran', () => {
  const invalide: ErreurApp = erreur('chemin_invalide');
  const enAnalyse = (): EtatAjout => evoluer(ETAT_INITIAL, { type: 'analyser', saisie: ' "C:\\Jeux\\Mon Jeu\\jeu.exe" ' });

  it('part du chemin nettoyé et le montre dans le champ', () => {
    const etat = enAnalyse();
    expect(etat).toMatchObject({ phase: 'analyse', chemin: 'C:\\Jeux\\Mon Jeu\\jeu.exe', saisie: 'C:\\Jeux\\Mon Jeu\\jeu.exe', probleme: null });
  });

  it('refuse une mauvaise extension sans appeler le cœur, et ignore un champ vide', () => {
    expect(evoluer(ETAT_INITIAL, { type: 'analyser', saisie: 'C:\\notes.txt' })).toMatchObject({ phase: 'saisie', probleme: { type: 'extension' } });
    expect(evoluer(ETAT_INITIAL, { type: 'analyser', saisie: '  ' })).toMatchObject({ phase: 'saisie', probleme: null });
  });

  it('montre l’aperçu avec le titre proposé, puis le laisse corriger', () => {
    const apercu = evoluer(enAnalyse(), { type: 'analyse_reussie', chemin: 'C:\\Jeux\\Mon Jeu\\jeu.exe', analyse: ANALYSE });
    expect(apercu).toMatchObject({ phase: 'apercu', titre: 'Mon Jeu', analyse: ANALYSE });
    expect(evoluer(apercu, { type: 'renommer', titre: 'Autre' }).titre).toBe('Autre');
  });

  it('écarte une réponse arrivée pour un chemin qui n’est plus celui du champ', () => {
    const etat = evoluer(enAnalyse(), { type: 'saisir', saisie: 'C:\\autre.exe' });
    expect(evoluer(etat, { type: 'analyse_reussie', chemin: 'C:\\Jeux\\Mon Jeu\\jeu.exe', analyse: ANALYSE })).toBe(etat);
    const relance = evoluer(etat, { type: 'analyser', saisie: 'C:\\autre.exe' });
    expect(evoluer(relance, { type: 'analyse_echouee', chemin: 'C:\\Jeux\\Mon Jeu\\jeu.exe', erreur: invalide })).toBe(relance);
  });

  it('garde l’erreur du cœur pour l’afficher sous le champ', () => {
    const etat = evoluer(enAnalyse(), { type: 'analyse_echouee', chemin: 'C:\\Jeux\\Mon Jeu\\jeu.exe', erreur: invalide });
    expect(etat).toMatchObject({ phase: 'saisie', analyse: null, probleme: { type: 'coeur', erreur: invalide } });
  });

  it('modifier le chemin efface l’aperçu et l’erreur', () => {
    const apercu = evoluer(enAnalyse(), { type: 'analyse_reussie', chemin: 'C:\\Jeux\\Mon Jeu\\jeu.exe', analyse: ANALYSE });
    expect(evoluer(apercu, { type: 'saisir', saisie: 'C:\\' })).toEqual({ ...ETAT_INITIAL, saisie: 'C:\\' });
  });

  it('ajoute seulement un jeu qui n’est pas un doublon, et revient à l’aperçu en cas d’échec', () => {
    const apercu = evoluer(enAnalyse(), { type: 'analyse_reussie', chemin: 'C:\\Jeux\\Mon Jeu\\jeu.exe', analyse: ANALYSE });
    const ajout = evoluer(apercu, { type: 'ajouter' });
    expect(ajout.phase).toBe('ajout');
    // Pendant l’ajout, rien ne bouge : ni le chemin, ni un nouveau dépôt, ni « recommencer ».
    expect(evoluer(ajout, { type: 'saisir', saisie: 'x' })).toBe(ajout);
    expect(evoluer(ajout, { type: 'analyser', saisie: 'C:\\b.exe' })).toBe(ajout);
    expect(evoluer(ajout, { type: 'recommencer' })).toBe(ajout);
    const echec = evoluer(ajout, { type: 'ajout_echoue', erreur: erreur('deja_present', { id_jeu: 7 }) });
    expect(echec).toMatchObject({ phase: 'apercu', probleme: { type: 'coeur', erreur: { code: 'deja_present' } } });

    const doublon = evoluer(enAnalyse(), { type: 'analyse_reussie', chemin: 'C:\\Jeux\\Mon Jeu\\jeu.exe', analyse: { ...ANALYSE, doublon_de: 49 } });
    expect(evoluer(doublon, { type: 'ajouter' })).toBe(doublon);
  });
});

describe('aperçu de la jaquette', () => {
  it('tire un titre provisoire du nom du fichier', () => {
    expect(titreProvisoire('"C:\\Jeux\\Celeste\\Celeste.exe"')).toBe('Celeste');
    expect(titreProvisoire('D:/Emu/Mon Jeu.lnk')).toBe('Mon Jeu');
    expect(titreProvisoire('   ')).toBe('');
  });

  it('donne une couleur stable, sombre, et rien pour un titre vide', () => {
    const couleur = couleurDeLApercu('Celeste');
    expect(couleur).toMatch(/^#[0-9a-f]{6}$/);
    expect(couleurDeLApercu(' Celeste ')).toBe(couleur);
    expect(couleurDeLApercu('')).toBeNull();
  });

  it('place chaque phase sur une étape', () => {
    expect(etapeDe('saisie')).toBe(0);
    expect(etapeDe('analyse')).toBe(0);
    expect(etapeDe('apercu')).toBe(1);
    expect(etapeDe('ajout')).toBe(2);
  });
});
