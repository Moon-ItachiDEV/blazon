import { useId, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Formulaire.module.css';

/** Une ligne de réglage : le nom et l'explication à gauche, la commande à droite. */
export function LigneDeReglage({ nom, aide, idDuNom, children }: { nom: string; aide?: ReactNode; idDuNom?: string; children: ReactNode }) {
  return (
    <div className={styles.ligne}>
      <div className={styles.ligneTexte}>
        <div className={styles.ligneNom} id={idDuNom}>
          {nom}
        </div>
        {aide !== undefined && <div className={styles.ligneAide}>{aide}</div>}
      </div>
      <div className={styles.ligneCommande}>{children}</div>
    </div>
  );
}

interface ProprietesDInterrupteur {
  actif: boolean;
  onChanger: (actif: boolean) => void;
  /** Identifiant de l'élément qui nomme l'interrupteur (le nom de la ligne de réglage). */
  nommePar: string;
  disabled?: boolean;
}

/** Interrupteur oui/non. `role="switch"` : un lecteur d'écran annonce « activé » ou « désactivé ». */
export function Interrupteur({ actif, onChanger, nommePar, disabled = false }: ProprietesDInterrupteur) {
  return <button type="button" role="switch" aria-checked={actif} aria-labelledby={nommePar} disabled={disabled} className={styles.interrupteur} onClick={() => onChanger(!actif)} />;
}

/** Ligne de réglage avec son interrupteur, déjà reliés pour l'accessibilité. */
export function ReglageOuiNon({ nom, aide, actif, onChanger, disabled = false }: { nom: string; aide?: ReactNode; actif: boolean; onChanger: (actif: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <LigneDeReglage nom={nom} idDuNom={id} {...(aide === undefined ? {} : { aide })}>
      <Interrupteur actif={actif} onChanger={onChanger} nommePar={id} disabled={disabled} />
    </LigneDeReglage>
  );
}

type ProprietesDeChamp = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  nom: string;
  aide?: ReactNode;
  /** Message d'erreur déjà traduit ; présent = champ marqué invalide et message annoncé. */
  erreur?: string | null;
};

/** Champ de texte avec son nom visible, son aide et son message d'erreur. */
export function Champ({ nom, aide, erreur = null, ...reste }: ProprietesDeChamp) {
  const id = useId();
  const decrit = [aide === undefined ? null : `${id}-aide`, erreur === null ? null : `${id}-erreur`].filter(Boolean).join(' ');
  return (
    <div className={styles.champ}>
      <label className={styles.champNom} htmlFor={id}>
        {nom}
      </label>
      <input {...reste} id={id} className={styles.saisie} aria-invalid={erreur !== null} aria-describedby={decrit === '' ? undefined : decrit} />
      {aide !== undefined && (
        <div className={styles.champAide} id={`${id}-aide`}>
          {aide}
        </div>
      )}
      {erreur !== null && (
        <div className={styles.champErreur} id={`${id}-erreur`} role="alert">
          {erreur}
        </div>
      )}
    </div>
  );
}

interface ProprietesDeSegments<V extends string> {
  /** Nom du groupe pour les lecteurs d'écran. */
  nom: string;
  valeur: V;
  options: { valeur: V; libelle: string }[];
  onChanger: (valeur: V) => void;
}

/** Choix parmi deux à quatre valeurs. Flèches gauche et droite pour changer, comme un groupe de boutons radio. */
export function Segments<V extends string>({ nom, valeur, options, onChanger }: ProprietesDeSegments<V>) {
  const auClavier = (evenement: KeyboardEvent<HTMLDivElement>) => {
    const sens = evenement.key === 'ArrowRight' || evenement.key === 'ArrowDown' ? 1 : evenement.key === 'ArrowLeft' || evenement.key === 'ArrowUp' ? -1 : 0;
    if (sens === 0) return;
    evenement.preventDefault();
    const actuel = options.findIndex((option) => option.valeur === valeur);
    const suivante = options[(actuel + sens + options.length) % options.length];
    if (suivante !== undefined) {
      onChanger(suivante.valeur);
      const boutons = evenement.currentTarget.querySelectorAll<HTMLButtonElement>('button');
      boutons[options.indexOf(suivante)]?.focus();
    }
  };
  return (
    <div className={styles.segments} role="radiogroup" aria-label={nom} onKeyDown={auClavier}>
      {options.map((option) => (
        <button key={option.valeur} type="button" role="radio" aria-checked={option.valeur === valeur} tabIndex={option.valeur === valeur ? 0 : -1} className={styles.segment} onClick={() => onChanger(option.valeur)}>
          {option.libelle}
        </button>
      ))}
    </div>
  );
}
