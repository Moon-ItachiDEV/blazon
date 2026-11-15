import { afterEach, describe, expect, it } from 'vitest';
import type { Evenement } from '../../../contrat/types';
import type { FauxCoeur, OptionsFauxCoeur } from './faux_coeur';
import { normaliserTitre } from './faux_coeur';
import { attendre, coeurDeTest, rejet } from './outils_de_test';
import { lireScenario } from './scenarios';

// Jeux repères des données factices.
const SATISFACTORY = 49; // Steam, installé, 44 succès
const SLAY_THE_SPIRE_2 = 75; // Steam, installé, sans succès
const ELDEN_RING = 79; // Steam, possédé mais pas installé
const FORTNITE = 1961; // Epic, hors Steam

const ouverts: FauxCoeur[] = [];
function ouvrir(options: Partial<OptionsFauxCoeur> = {}): FauxCoeur {
  const coeur = coeurDeTest(options);
  ouverts.push(coeur);
  return coeur;
}
afterEach(() => {
  for (const coeur of ouverts.splice(0)) coeur.arreter();
});

describe('bibliothèque', () => {
  it('expose les 2 000 jeux avec une clé valide', async () => {
    const coeur = ouvrir();
    const etat = await coeur.etat();
    expect(etat).toMatchObject({ niveau: 'personnel', cle: 'valide', en_ligne: true, jeux_possedes_erreur: null });
    const jeux = await coeur.lister_jeux();
    expect(jeux).toHaveLength(2000);
    expect(jeux.filter((j) => j.installe)).toHaveLength(150);
  });

  it('renvoie des copies : modifier une réponse ne change pas le cœur', async () => {
    const coeur = ouvrir();
    const [premier] = await coeur.jeux([SATISFACTORY]);
    expect(premier?.titre).toBe('Satisfactory');
    if (premier) premier.titre = 'Autre chose';
    expect((await coeur.jeux([SATISFACTORY]))[0]?.titre).toBe('Satisfactory');
  });

  it('donne le détail local d\'un jeu, sessions les plus récentes d\'abord', async () => {
    const coeur = ouvrir();
    const detail = await coeur.detail_jeu(SATISFACTORY);
    expect(detail.sources.map((s) => s.source)).toEqual(['steam', 'gog']);
    expect(detail.sessions_recentes).toHaveLength(5);
    const debuts = detail.sessions_recentes.map((s) => s.debut);
    expect(debuts).toEqual([...debuts].sort().reverse());
    expect(debuts[0]).toBe('2026-11-05T22:39:11Z');
  });

  it('pagine les sessions avec `avant`', async () => {
    const coeur = ouvrir();
    const page1 = await coeur.lister_sessions(SATISFACTORY, 3, null);
    const dernier = page1.at(-1);
    expect(page1).toHaveLength(3);
    const page2 = await coeur.lister_sessions(SATISFACTORY, 3, dernier?.debut ?? null);
    expect(page2.every((s) => s.debut < (dernier?.debut ?? ''))).toBe(true);
    expect(new Set([...page1, ...page2].map((s) => s.id)).size).toBe(page1.length + page2.length);
  });

  it('rejette `introuvable` pour un jeu inconnu', async () => {
    const coeur = ouvrir();
    expect(await rejet(coeur.detail_jeu(999_999))).toMatchObject({ code: 'introuvable', cle_i18n: 'erreurs.introuvable' });
  });

  it('enregistre favori, masque et nouveau titre, et prévient l\'interface', async () => {
    const coeur = ouvrir();
    const recus: Evenement[] = [];
    coeur.ecouter((e) => recus.push(e));
    await coeur.definir_favori(SATISFACTORY, true);
    await coeur.definir_masque(SATISFACTORY, true);
    await coeur.renommer_un_jeu(SATISFACTORY, '  Les Usines  ');
    const [jeu] = await coeur.jeux([SATISFACTORY]);
    expect(jeu).toMatchObject({ favori: true, masque: true, titre: 'Les Usines', titre_tri: 'usines' });
    expect(recus.filter((e) => e.type === 'bibliotheque_modifiee')).toHaveLength(3);
  });
});

describe('données en ligne', () => {
  it('répond tout de suite depuis le cache pour un jeu installé', async () => {
    const coeur = ouvrir();
    const fiche = await coeur.fiche_du_jeu(SATISFACTORY);
    expect(fiche.erreur).toBeNull();
    expect(fiche.rafraichissement).toBe('aucun');
    expect(fiche.fraicheur?.origine).toBe('cache');
    expect(fiche.donnees?.developpeurs).toEqual(['Coffee Stain Studios']);
  });

  it('répond « rien encore », puis annonce l\'arrivée du réseau', async () => {
    const coeur = ouvrir();
    const arrivee = attendre(coeur, 'donnees_rafraichies', (e) => e.domaine === 'fiche' && e.id_jeu === ELDEN_RING);
    const avant = await coeur.fiche_du_jeu(ELDEN_RING);
    expect(avant).toEqual({ donnees: null, fraicheur: null, rafraichissement: 'en_cours', erreur: null });
    await arrivee;
    const apres = await coeur.fiche_du_jeu(ELDEN_RING);
    expect(apres.donnees?.id_jeu).toBe(ELDEN_RING);
    expect(apres.fraicheur).toEqual({ maj_le: '2026-11-11T19:00:00Z', origine: 'reseau' });
  });

  it('ne rejette jamais hors ligne : cache avec erreur, ou rien avec erreur', async () => {
    const coeur = ouvrir({ scenario: 'hors_ligne' });
    expect(await coeur.etat()).toMatchObject({ en_ligne: false, niveau: 'local' });
    const enCache = await coeur.fiche_du_jeu(SATISFACTORY);
    expect(enCache.donnees).not.toBeNull();
    expect(enCache.erreur?.code).toBe('hors_ligne');
    expect(enCache.rafraichissement).toBe('echoue');
    const absent = await coeur.fiche_du_jeu(ELDEN_RING);
    expect(absent).toMatchObject({ donnees: null, rafraichissement: 'echoue', erreur: { code: 'hors_ligne' } });
    // Les jeux possédés déjà connus restent visibles hors ligne.
    expect(await coeur.lister_jeux()).toHaveLength(2000);
  });

  it('« Réessayer » prévient l\'interface même quand le réseau manque toujours', async () => {
    const coeur = ouvrir({ scenario: 'hors_ligne' });
    const arrivee = attendre(coeur, 'donnees_rafraichies', (e) => e.domaine === 'fiche' && e.id_jeu === ELDEN_RING);
    await coeur.rafraichir('fiche', ELDEN_RING);
    await arrivee;
    expect((await coeur.fiche_du_jeu(ELDEN_RING)).erreur?.code).toBe('hors_ligne');
  });

  it('distingue jeu hors Steam et jeu sans succès', async () => {
    const coeur = ouvrir();
    expect((await coeur.fiche_du_jeu(FORTNITE)).erreur?.code).toBe('jeu_non_steam');
    expect((await coeur.succes_du_jeu(FORTNITE)).erreur?.code).toBe('jeu_non_steam');
    expect((await coeur.actualites_du_jeu(FORTNITE, 5, null)).erreur?.code).toBe('jeu_non_steam');
    expect(await coeur.succes_du_jeu(SLAY_THE_SPIRE_2)).toMatchObject({ donnees: null, erreur: { code: 'jeu_sans_succes' }, rafraichissement: 'aucun' });
  });

  it('pagine le fil d\'actualités, du plus récent au plus ancien', async () => {
    const coeur = ouvrir();
    const page1 = (await coeur.fil_d_actualites(10, null)).donnees ?? [];
    expect(page1).toHaveLength(10);
    const dates = page1.map((a) => a.date);
    expect(dates).toEqual([...dates].sort().reverse());
    const page2 = (await coeur.fil_d_actualites(10, dates.at(-1) ?? null)).donnees ?? [];
    expect(page2.length).toBeGreaterThan(0);
    expect(page2.every((a) => a.date < (dates.at(-1) ?? ''))).toBe(true);
  });

  it('respecte une source désactivée dans les paramètres', async () => {
    const coeur = ouvrir();
    const parametres = await coeur.parametres();
    parametres.sources_en_ligne.actualites = false;
    await coeur.modifier_parametres(parametres);
    const fil = await coeur.fil_d_actualites(5, null);
    expect(fil.erreur).toMatchObject({ code: 'source_desactivee', details: { source: 'actualites' } });
    expect(fil.rafraichissement).toBe('aucun');
    expect(fil.donnees).not.toBeNull();
  });

  it('signale la source coupée, le quota et le mode jeu sans cacher le cache', async () => {
    const coupee = ouvrir({ scenario: 'source_coupee' });
    expect((await coupee.etat()).sources_coupees).toEqual(['actualites']);
    expect((await coupee.fil_d_actualites(5, null)).erreur?.code).toBe('source_coupee');
    expect((await coupee.fiche_du_jeu(SATISFACTORY)).erreur).toBeNull();

    const quota = ouvrir({ scenario: 'quota_atteint' });
    expect(await quota.fiche_du_jeu(ELDEN_RING)).toMatchObject({ donnees: null, erreur: { code: 'quota_atteint' }, rafraichissement: 'echoue' });

    const enJeu = ouvrir({ scenario: 'mode_jeu' });
    expect((await enJeu.etat()).session_en_cours).not.toBeNull();
    const fiche = await enJeu.fiche_du_jeu(SATISFACTORY);
    expect(fiche.donnees).not.toBeNull();
    expect(fiche.erreur?.code).toBe('mode_jeu');
  });
});

describe('clé et données personnelles', () => {
  it('sans clé : seuls les jeux du PC, pas de progression, pas d\'amis', async () => {
    const coeur = ouvrir({ scenario: 'sans_cle' });
    expect(await coeur.etat()).toMatchObject({ cle: 'absente', niveau: 'public', jeux_possedes_erreur: { code: 'cle_absente' } });
    const jeux = await coeur.lister_jeux();
    expect(jeux).toHaveLength(150);
    expect(jeux.every((j) => j.installe)).toBe(true);
    expect(jeux.every((j) => j.succes === null || j.succes.debloques === null)).toBe(true);
    expect(await rejet(coeur.detail_jeu(ELDEN_RING))).toMatchObject({ code: 'introuvable' });

    const succes = await coeur.succes_du_jeu(SATISFACTORY);
    expect(succes.erreur).toBeNull();
    expect(succes.donnees).toMatchObject({ total: 44, debloques: null, progression_erreur: { code: 'cle_absente' } });
    expect(succes.donnees?.liste).toHaveLength(44);
    expect(succes.donnees?.liste.every((s) => s.debloque === null && s.debloque_le === null)).toBe(true);

    expect(await coeur.amis()).toMatchObject({ donnees: null, erreur: { code: 'cle_absente' }, rafraichissement: 'aucun' });
    const profil = await coeur.profil();
    expect(profil.donnees).toMatchObject({ pseudo: 'Nova', avatar: null });
    expect(profil.erreur?.code).toBe('cle_absente');
  });

  it('profil privé : la clé est valide mais les données personnelles manquent', async () => {
    const coeur = ouvrir({ scenario: 'profil_prive' });
    expect(await coeur.etat()).toMatchObject({ cle: 'valide', niveau: 'public', jeux_possedes_erreur: { code: 'profil_prive' } });
    expect(await coeur.lister_jeux()).toHaveLength(150);
    expect((await coeur.amis()).erreur?.code).toBe('amis_prives');
    expect((await coeur.succes_du_jeu(SATISFACTORY)).donnees?.progression_erreur?.code).toBe('profil_prive');
  });

  it('une clé refusée n\'est pas conservée', async () => {
    const coeur = ouvrir({ scenario: 'sans_cle' });
    expect(await coeur.enregistrer_la_cle('pas une clé')).toMatchObject({ etat: 'refusee', pseudo: null, erreur: { code: 'cle_refusee' } });
    expect(await coeur.enregistrer_la_cle('0000' + 'A'.repeat(28))).toMatchObject({ etat: 'refusee' });
    expect((await coeur.etat()).cle).toBe('refusee');
    expect(await coeur.lister_jeux()).toHaveLength(150);
  });

  it('une clé acceptée fait apparaître les jeux possédés, sans jamais laisser de trace de la clé', async () => {
    const coeur = ouvrir({ scenario: 'sans_cle' });
    const cle = 'A1B2C3D4E5F60718293A4B5C6D7E8F90';
    const ajout = attendre(coeur, 'bibliotheque_modifiee');
    expect(await coeur.enregistrer_la_cle(cle)).toEqual({ etat: 'valide', pseudo: 'Nova', erreur: null });
    expect((await ajout).modifies).toHaveLength(1850);
    expect(await coeur.etat()).toMatchObject({ cle: 'valide', niveau: 'personnel', jeux_possedes_erreur: null });
    expect(await coeur.lister_jeux()).toHaveLength(2000);
    const partout = JSON.stringify([await coeur.etat(), await coeur.parametres(), await coeur.profil(), coeur.journal]);
    expect(partout).not.toContain(cle);
    expect(Object.values(coeur).some((v) => typeof v === 'string' && v.includes(cle))).toBe(false);

    const retrait = attendre(coeur, 'bibliotheque_modifiee');
    await coeur.supprimer_la_cle();
    expect((await retrait).retires).toHaveLength(1850);
    expect((await coeur.etat()).cle).toBe('absente');
  });

  it('hors ligne, une clé bien formée est gardée « non vérifiée »', async () => {
    const coeur = ouvrir({ scenario: 'hors_ligne' });
    await coeur.supprimer_la_cle();
    expect(await coeur.enregistrer_la_cle('A1B2C3D4E5F60718293A4B5C6D7E8F90')).toMatchObject({ etat: 'non_verifiee', erreur: { code: 'hors_ligne' } });
    expect((await coeur.etat()).cle).toBe('non_verifiee');
  });
});

describe('lancement et session', () => {
  it('lance un jeu installé, mesure la session et met le temps à jour', async () => {
    const coeur = ouvrir();
    const avant = (await coeur.jeux([SATISFACTORY]))[0];
    const demarree = attendre(coeur, 'session_demarree');
    const terminee = attendre(coeur, 'session_terminee');
    const fini = attendre(coeur, 'etat_modifie', () => true);
    await coeur.lancer(SATISFACTORY, null);
    expect((await demarree).id_jeu).toBe(SATISFACTORY);
    expect(coeur.journal).toContainEqual({ type: 'lancement', id_jeu: SATISFACTORY, source: 'steam' });
    const fin = await terminee;
    await fini;
    expect(fin.duree_s).toBeGreaterThanOrEqual(60);
    expect(fin.temps.minutes_total).toBe((avant?.temps.minutes_total ?? 0) + Math.round(fin.duree_s / 60));
    expect(fin.succes_debloques).toHaveLength(1);
    expect((await coeur.etat()).session_en_cours).toBeNull();
    const [session] = await coeur.lister_sessions(SATISFACTORY, 1, null);
    expect(session).toMatchObject({ id_jeu: SATISFACTORY, duree_s: fin.duree_s, origine: 'launcher' });
    expect((await coeur.succes_du_jeu(SATISFACTORY)).donnees?.debloques).toBe(16);
    expect((await coeur.jeux([SATISFACTORY]))[0]?.succes?.debloques).toBe(16);
  });

  it('refuse de lancer un jeu non installé', async () => {
    const coeur = ouvrir();
    expect(await rejet(coeur.lancer(ELDEN_RING, null))).toMatchObject({ code: 'lancement_echoue' });
    expect(await rejet(coeur.lancer(SATISFACTORY, 'epic'))).toMatchObject({ code: 'introuvable' });
    expect(coeur.journal).toHaveLength(0);
  });

  it('sait jouer un exécutable introuvable et un lancement sans processus', async () => {
    const perdu = ouvrir({ lancement: 'exe_introuvable' });
    expect(await rejet(perdu.lancer(SATISFACTORY, null))).toMatchObject({ code: 'exe_introuvable' });

    const muet = ouvrir({ lancement: 'sans_session' });
    const signal = attendre(muet, 'lancement_sans_session');
    await muet.lancer(SATISFACTORY, null);
    expect((await signal).id_jeu).toBe(SATISFACTORY);
    expect((await muet.etat()).session_en_cours).toBeNull();
  });

  it('n\'ouvre que des liens https', async () => {
    const coeur = ouvrir();
    await coeur.ouvrir_un_lien('https://store.steampowered.com/app/526870');
    expect(await rejet(coeur.ouvrir_un_lien('javascript:alert(1)'))).toMatchObject({ code: 'chemin_invalide' });
    expect(await rejet(coeur.ouvrir_un_lien('http://exemple.test'))).toMatchObject({ code: 'chemin_invalide' });
    expect(coeur.journal).toEqual([{ type: 'lien_ouvert', url: 'https://store.steampowered.com/app/526870' }]);
  });
});

describe('ajout manuel', () => {
  it('analyse un fichier déposé et repère un doublon', async () => {
    const coeur = ouvrir();
    expect(await rejet(coeur.analyser_un_chemin('notes.txt'))).toMatchObject({ code: 'chemin_invalide' });
    const analyse = await coeur.analyser_un_chemin('D:\\Jeux\\Vintage_Story\\Vintage_Story.exe');
    expect(analyse).toMatchObject({ titre_propose: 'Vintage Story', source: 'manuel', doublon_de: null });
    const doublon = await coeur.analyser_un_chemin('C:\\Users\\Nova\\Desktop\\Satisfactory - Raccourci.lnk');
    expect(doublon.doublon_de).toBe(SATISFACTORY);
  });

  it('ajoute puis retire un jeu, et refuse le même fichier deux fois', async () => {
    const coeur = ouvrir();
    const chemin = 'D:\\Jeux\\Vintage_Story\\Vintage_Story.exe';
    const jeu = await coeur.ajouter_un_jeu_manuel(chemin, 'Vintage Story');
    expect(jeu).toMatchObject({ id: 2001, sources: ['manuel'], installe: true, jaquette: null });
    expect(await coeur.lister_jeux()).toHaveLength(2001);
    expect((await coeur.detail_jeu(2001)).sources[0]?.exe).toBe(chemin);
    expect((await coeur.fiche_du_jeu(2001)).erreur?.code).toBe('jeu_non_steam');
    expect(await rejet(coeur.ajouter_un_jeu_manuel(chemin, 'Encore'))).toMatchObject({ code: 'deja_present', details: { id_jeu: 2001 } });
    await coeur.retirer_un_jeu_manuel(2001);
    expect(await coeur.lister_jeux()).toHaveLength(2000);
    expect(await rejet(coeur.retirer_un_jeu_manuel(SATISFACTORY))).toMatchObject({ code: 'interne' });
  });
});

describe('premier lancement, bibliothèque vide, mise à jour', () => {
  it('déroule le scan dès qu\'on écoute, puis sort de l\'accueil', async () => {
    const coeur = ouvrir({ scenario: 'premier_lancement' });
    const recus: Evenement[] = [];
    const fin = attendre(coeur, 'scan_termine');
    coeur.ecouter((e) => recus.push(e));
    expect(await coeur.etat()).toMatchObject({ premier_lancement: true, cle: 'absente' });
    expect((await fin).jeux_trouves).toBe(150);
    expect(recus.filter((e) => e.type === 'scan_progression').map((e) => e.type === 'scan_progression' && e.jeux_trouves)).toEqual([60, 113, 135, 150]);
    expect(await coeur.lister_jeux()).toHaveLength(150);
    await coeur.terminer_premier_lancement();
    expect(await coeur.etat()).toMatchObject({ premier_lancement: false, scan: { en_cours: false, jeux_trouves: 150 } });
  });

  it('sait montrer une bibliothèque vide sans Steam', async () => {
    const coeur = ouvrir({ scenario: 'bibliotheque_vide' });
    expect(await coeur.etat()).toMatchObject({ steam_installe: false, jeux_possedes_erreur: null });
    expect(await coeur.lister_jeux()).toEqual([]);
    expect(await coeur.comptes_steam()).toEqual([]);
    expect((await coeur.profil()).donnees).toEqual({ steamid: null, pseudo: null, avatar: null });
    expect(await rejet(coeur.action_steam({ action: 'installer', steam_appid: 620 }))).toMatchObject({ code: 'launcher_absent', details: { source: 'steam' } });
  });

  it('télécharge la mise à jour jusqu\'à « prête »', async () => {
    const coeur = ouvrir({ scenario: 'mise_a_jour' });
    expect((await coeur.etat()).mise_a_jour).toEqual({ version: '0.2.0', etape: 'disponible', progression_pct: null });
    await coeur.installer_la_mise_a_jour();
    for (;;) {
      await attendre(coeur, 'etat_modifie');
      if ((await coeur.etat()).mise_a_jour?.etape === 'prete') break;
    }
    expect((await coeur.etat()).mise_a_jour).toEqual({ version: '0.2.0', etape: 'prete', progression_pct: null });
  });

  it('« tout effacer » ramène au premier lancement', async () => {
    const coeur = ouvrir();
    await coeur.definir_favori(SATISFACTORY, true);
    const fin = attendre(coeur, 'scan_termine');
    await coeur.tout_effacer();
    await fin;
    expect(await coeur.etat()).toMatchObject({ premier_lancement: true, cle: 'absente' });
    const jeux = await coeur.lister_jeux();
    expect(jeux).toHaveLength(150);
    expect(jeux.some((j) => j.favori || j.masque)).toBe(false);
    expect(await coeur.lister_sessions(SATISFACTORY, 5, null)).toEqual([]);
  });
});

describe('horloge et utilitaires', () => {
  it('décale les dates d\'un nombre entier de jours quand on ouvre la maquette plus tard', async () => {
    const coeur = ouvrir({ maintenant: () => new Date('2027-01-20T08:30:00Z') });
    const detail = await coeur.detail_jeu(SATISFACTORY);
    // 69 jours entiers séparent le 11/11/2026 19:00 du 20/01/2027 08:30 : l'heure de la session ne bouge pas.
    expect(detail.resume.temps.dernier_lancement).toBe('2027-01-13T22:39:11Z');
    expect(detail.sessions_recentes[0]?.debut).toBe('2027-01-13T22:39:11Z');
  });

  it('normalise les titres exactement comme le générateur de données', async () => {
    expect(normaliserTitre('The Witcher® 3: Wild Hunt')).toBe('witcher 3 wild hunt');
    // Parité vérifiée sur les 2 000 titres : c'est ce qui rend fiable la détection des doublons.
    const jeux = await ouvrir().lister_jeux();
    expect(jeux.filter((j) => normaliserTitre(j.titre) !== j.titre_tri).map((j) => j.titre)).toEqual([]);
  });

  it('lit le scénario dans l\'adresse', () => {
    expect(lireScenario('?scenario=hors_ligne')).toBe('hors_ligne');
    expect(lireScenario('?scenario=nimporte')).toBe('normal');
    expect(lireScenario('')).toBe('normal');
  });
});
