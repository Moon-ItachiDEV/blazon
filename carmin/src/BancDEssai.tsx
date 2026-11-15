/**
 * BANC D'ESSAI (provisoire) : une page sans apparence qui prouve que le faux cœur tourne dans
 * le navigateur et qui permet de changer de scénario. Elle disparaîtra quand les écrans existeront.
 */
import { useEffect, useState } from 'react';
import type { EtatApp, Evenement, JeuResume } from '../contrat/types';
import { coeur, scenario } from './coeur';
import { SCENARIOS } from './coeur/faux/scenarios';
import { formaterDateRelative, formaterNombre, formaterTempsDeJeu } from './formats';
import { texteErreur } from './i18n';

interface Releve {
  etat: EtatApp;
  jeux: JeuResume[];
  fiche: string;
  amis: string;
}

async function relever(): Promise<Releve> {
  const [etat, jeux, amis] = await Promise.all([coeur.etat(), coeur.lister_jeux(), coeur.amis()]);
  const premier = jeux.find((j) => !j.installe && j.steam_appid !== null) ?? jeux.find((j) => j.steam_appid !== null);
  const fiche = premier ? await coeur.fiche_du_jeu(premier.id) : null;
  const dire = (r: { donnees: unknown; rafraichissement: string; erreur: Parameters<typeof texteErreur>[1] | null }) =>
    r.erreur ? `${r.donnees === null ? 'rien' : 'cache'} + « ${texteErreur('fr', r.erreur)} »` : r.donnees === null ? `chargement (${r.rafraichissement})` : 'données reçues';
  return {
    etat,
    jeux,
    fiche: premier && fiche ? `${premier.titre} : ${dire(fiche)}` : 'aucun jeu Steam',
    amis: amis.donnees ? `${amis.donnees.length} amis` : dire(amis),
  };
}

export function BancDEssai() {
  const [releve, setReleve] = useState<Releve | null>(null);
  const [evenements, setEvenements] = useState<Evenement[]>([]);

  useEffect(() => {
    let actif = true;
    const relire = () => {
      void relever().then((r) => {
        if (actif) setReleve(r);
      });
    };
    // On écoute AVANT la première lecture, comme le demande le contrat.
    const arreter = coeur.ecouter((evenement) => {
      setEvenements((precedents) => [evenement, ...precedents].slice(0, 12));
      relire();
    });
    relire();
    return () => {
      actif = false;
      arreter();
    };
  }, []);

  const maintenant = new Date();
  const recents = [...(releve?.jeux ?? [])]
    .filter((j) => j.temps.dernier_lancement !== null)
    .sort((a, b) => (b.temps.dernier_lancement ?? '').localeCompare(a.temps.dernier_lancement ?? ''))
    .slice(0, 5);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 22 }}>Banc d'essai du faux cœur</h1>
      <p>Page provisoire, sans apparence : elle montre ce que les écrans recevront dans chaque situation.</p>

      <nav aria-label="Scénarios" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SCENARIOS.map((nom) => (
          <a key={nom} href={`?scenario=${nom}`} aria-current={nom === scenario ? 'page' : undefined} style={{ fontWeight: nom === scenario ? 700 : 400 }}>
            {nom}
          </a>
        ))}
      </nav>

      {releve === null ? (
        <p>Chargement…</p>
      ) : (
        <>
          <h2 style={{ fontSize: 18 }}>État</h2>
          <ul data-test="etat">
            <li>Niveau de données : {releve.etat.niveau}</li>
            <li>Clé : {releve.etat.cle}</li>
            <li>En ligne : {releve.etat.en_ligne ? 'oui' : 'non'}</li>
            <li>Premier lancement : {releve.etat.premier_lancement ? 'oui' : 'non'}</li>
            <li data-test="jeux">
              Jeux visibles : {formaterNombre(releve.jeux.length, 'fr')}, dont {releve.jeux.filter((j) => j.installe).length} installés
            </li>
            <li data-test="fiche">Fiche d'un jeu : {releve.fiche}</li>
            <li>Amis : {releve.amis}</li>
            {releve.etat.jeux_possedes_erreur && <li>Jeux possédés : {texteErreur('fr', releve.etat.jeux_possedes_erreur)}</li>}
          </ul>

          <h2 style={{ fontSize: 18 }}>Dernières parties</h2>
          <ul>
            {recents.map((jeu) => (
              <li key={jeu.id}>
                {jeu.titre} : {formaterTempsDeJeu(jeu.temps.minutes_total, 'fr')},{' '}
                {jeu.temps.dernier_lancement && formaterDateRelative(jeu.temps.dernier_lancement, 'fr', maintenant).toLowerCase()}
              </li>
            ))}
          </ul>

          <h2 style={{ fontSize: 18 }}>Derniers événements du cœur</h2>
          <ol data-test="evenements">
            {evenements.map((evenement, i) => (
              <li key={`${evenements.length - i}`}>
                <code>{JSON.stringify(evenement).slice(0, 110)}</code>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
