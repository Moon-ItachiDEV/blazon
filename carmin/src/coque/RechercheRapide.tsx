import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { JeuResume } from '../../contrat/types';
import { aReprendre, filtrer, rechercheRapide } from '../bibliotheque/logique';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { useApplication } from '../etat/application';
import { creerMagasin, useMagasin } from '../etat/magasin';
import { formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { naviguer } from '../navigation';
import styles from './RechercheRapide.module.css';

const NOMBRE_DE_RESULTATS = 7;

const ouverture = creerMagasin(false);

/** Ouvre la recherche rapide depuis n'importe quel écran (bouton de la bibliothèque, Ctrl K). */
export function ouvrirLaRecherche(): void {
  ouverture.ecrire(true);
}

type Option = { type: 'jeu'; jeu: JeuResume } | { type: 'tout'; nombre: number };

export function RechercheRapide() {
  const { t, tp, langue } = useTexte();
  const ouverte = useMagasin(ouverture, (o) => o);
  const jeux = useApplication((a) => a.jeux);
  const dialogue = useRef<HTMLDialogElement>(null);
  const [texte, setTexte] = useState('');
  const [actif, setActif] = useState(0);
  const idListe = useId();

  // Ctrl K ouvre ou ferme la recherche, où que soit le focus.
  useEffect(() => {
    const auClavier = (evenement: globalThis.KeyboardEvent) => {
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === 'k') {
        evenement.preventDefault();
        ouverture.ecrire((o) => !o);
      }
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, []);

  // `showModal` fait le travail d'accessibilité : focus retenu dans la fenêtre, Échap pour fermer,
  // retour du focus au bouton d'origine à la fermeture.
  useEffect(() => {
    const element = dialogue.current;
    if (element === null) return;
    if (ouverte && !element.open) {
      setTexte('');
      setActif(0);
      element.showModal();
    } else if (!ouverte && element.open) {
      element.close();
    }
  }, [ouverte]);

  const propre = texte.trim();
  const options = useMemo<Option[]>(() => {
    if (jeux === null) return [];
    if (propre === '') return aReprendre(jeux, 5).map((jeu) => ({ type: 'jeu', jeu }));
    const trouves: Option[] = rechercheRapide(jeux, propre, NOMBRE_DE_RESULTATS).map((jeu) => ({ type: 'jeu', jeu }));
    const total = filtrer(jeux, { filtre: 'tous', recherche: propre, montrer_les_jeux_masques: false }).length;
    if (total > trouves.length) trouves.push({ type: 'tout', nombre: total });
    return trouves;
  }, [jeux, propre]);

  const choisir = (option: Option | undefined) => {
    if (option === undefined) return;
    ouverture.ecrire(false);
    if (option.type === 'jeu') naviguer({ ecran: 'jeu', id_jeu: option.jeu.id });
    else naviguer({ ecran: 'bibliotheque', recherche: propre });
  };

  const auClavier = (evenement: KeyboardEvent<HTMLInputElement>) => {
    const aller = (index: number) => {
      evenement.preventDefault();
      if (options.length > 0) setActif((index + options.length) % options.length);
    };
    if (evenement.key === 'ArrowDown') aller(actif + 1);
    else if (evenement.key === 'ArrowUp') aller(actif - 1);
    else if (evenement.key === 'Enter') {
      evenement.preventDefault();
      choisir(options[actif]);
    }
  };

  // L'option active reste visible quand on descend dans la liste au clavier.
  useEffect(() => {
    document.getElementById(`${idListe}-${actif}`)?.scrollIntoView({ block: 'nearest' });
  }, [actif, idListe]);

  const precision = (jeu: JeuResume): string => {
    const morceaux = [jeu.installe ? t('jeu.installe') : t('jeu.non_installe')];
    if (jeu.temps.minutes_total > 0) morceaux.push(formaterTempsDeJeu(jeu.temps.minutes_total, langue));
    return morceaux.join(' · ');
  };

  return (
    <dialog
      ref={dialogue}
      className={styles.dialogue}
      aria-label={t('recherche.titre')}
      onClose={() => ouverture.ecrire(false)}
      onClick={(evenement) => {
        // Un clic sur le fond sombre (donc sur l'élément dialog lui-même) ferme la fenêtre.
        if (evenement.target === dialogue.current) ouverture.ecrire(false);
      }}
    >
      <label className={styles.champ}>
        <Icone nom="recherche" />
        <input
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={idListe}
          aria-activedescendant={options.length > 0 ? `${idListe}-${actif}` : undefined}
          aria-autocomplete="list"
          aria-label={t('recherche.champ')}
          placeholder={t('recherche.champ')}
          autoComplete="off"
          spellCheck={false}
          value={texte}
          onChange={(evenement) => {
            setTexte(evenement.target.value);
            setActif(0);
          }}
          onKeyDown={auClavier}
        />
        <kbd className={styles.touche}>{t('recherche.echap')}</kbd>
      </label>
      <div className={styles.resultats}>
        {propre === '' && options.length > 0 && <div className={styles.rubrique}>{t('recherche.dernieres_parties')}</div>}
        <ul id={idListe} role="listbox" aria-label={t('recherche.resultats')}>
          {options.map((option, index) => (
            <li
              key={option.type === 'jeu' ? option.jeu.id : 'tout'}
              id={`${idListe}-${index}`}
              role="option"
              aria-selected={index === actif}
              className={styles.option}
              onPointerMove={() => setActif(index)}
              onClick={() => choisir(option)}
            >
              {option.type === 'jeu' ? (
                <>
                  <Jaquette jeu={option.jeu} prioritaire className={styles.vignette ?? ''} />
                  <span className={styles.corps}>
                    <span className={styles.titre} style={{ display: 'block' }}>
                      {option.jeu.titre}
                    </span>
                    <span className={styles.precision}>{precision(option.jeu)}</span>
                  </span>
                </>
              ) : (
                <span className={`${styles.corps} ${styles.tout}`}>{tp('recherche.tout_voir', option.nombre)}</span>
              )}
              <span className={styles.entree} aria-hidden="true">
                <Icone nom="chevron_droit" taille={18} />
              </span>
            </li>
          ))}
        </ul>
        {propre !== '' && options.length === 0 && (
          <p className={styles.rien} role="status">
            {t('recherche.rien', { texte: propre })}
          </p>
        )}
      </div>
    </dialog>
  );
}
