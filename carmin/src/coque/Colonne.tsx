import { useMemo, type CSSProperties } from 'react';
import type { Ami, JeuResume, Profil } from '../../contrat/types';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { useApplication } from '../etat/application';
import { formaterPourcentage, formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import { Avatar } from '../profil/Avatar';
import styles from './Colonne.module.css';

/** Ce que la colonne montre au plus : un coup d'œil, pas une liste. La liste complète reste l'écran Amis. */
const AMIS_MONTRES = 5;
const JEUX_MONTRES = 3;

/** Un ami en ligne : son portrait, son pseudo, et le jeu auquel il joue. */
function Personne({ ami }: { ami: Ami }) {
  const { t } = useTexte();
  const jeu = ami.statut === 'en_jeu' ? ami.jeu_en_cours : null;
  const contenu = (
    <>
      <span className={styles.portrait} data-statut={ami.statut}>
        <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={36} />
      </span>
      <span className={styles.texte}>
        <span className={styles.pseudo}>{ami.pseudo}</span>
        <span className={styles.activite}>
          {jeu === null ? (
            <span data-statut={ami.statut}>{t(`amis.statut.${ami.statut}`)}</span>
          ) : (
            <>
              <span className={styles.verbe}>{jeu.id_jeu !== null ? t('colonne.rejoindre') : t('colonne.joue')}</span>
              <span className={styles.jeu}>{jeu.titre}</span>
            </>
          )}
        </span>
      </span>
    </>
  );
  // Un ami qui joue à un jeu de notre bibliothèque mène à la fiche de ce jeu (« Rejoindre » lance le jeu, rien de plus).
  if (jeu !== null && jeu.id_jeu !== null) {
    return (
      <li>
        <Lien className={styles.personne} vers={{ ecran: 'jeu', id_jeu: jeu.id_jeu }} title={t('panneau_amis.joue_a', { pseudo: ami.pseudo, titre: jeu.titre })}>
          {contenu}
        </Lien>
      </li>
    );
  }
  return (
    <li>
      <Lien className={styles.personne} vers={{ ecran: 'amis' }} title={`${ami.pseudo} · ${t(`amis.statut.${ami.statut}`)}`}>
        {contenu}
      </Lien>
    </li>
  );
}

/** Les jeux les plus près du 100 % (au moins un succès, pas encore tous), les plus avancés d'abord. */
function succesAPortee(jeux: readonly JeuResume[], nombre: number): JeuResume[] {
  const part = (j: JeuResume) => (j.succes === null || j.succes.debloques === null || j.succes.total === 0 ? 0 : j.succes.debloques / j.succes.total);
  return jeux
    .filter((j) => !j.masque && j.succes !== null && j.succes.debloques !== null && j.succes.debloques > 0 && j.succes.debloques < j.succes.total)
    .sort((a, b) => part(b) - part(a))
    .slice(0, nombre);
}

/** Un jeu à finir : sa jaquette, son titre, et la part de ses succès dans une jauge qui se remplit. */
function JeuRecent({ jeu }: { jeu: JeuResume }) {
  const { t, langue } = useTexte();
  const succes = jeu.succes !== null && jeu.succes.debloques !== null && jeu.succes.total > 0 ? jeu.succes : null;
  const part = succes === null ? null : Math.round(((succes.debloques ?? 0) / succes.total) * 100);
  return (
    <li>
      <Lien className={styles.recent} vers={{ ecran: 'jeu', id_jeu: jeu.id }} title={jeu.titre} style={{ '--couleur-jaquette': jeu.couleur_dominante ?? undefined } as CSSProperties}>
        <span className={styles.vignette}>
          <Jaquette jeu={jeu} className={styles.vignetteImage ?? ''} />
        </span>
        <span className={styles.texte}>
          <span className={styles.titre}>{jeu.titre}</span>
          <span className={`${styles.mesure} chiffres`}>
            {part === null || succes === null
              ? t('colonne.temps', { temps: formaterTempsDeJeu(jeu.temps.minutes_total, langue) })
              : `${formaterPourcentage(part, langue)} · ${t('carmin.portee.reste', { n: succes.total - (succes.debloques ?? 0) })}`}
          </span>
          <span className={styles.jauge} aria-hidden="true">
            <span style={{ '--part': `${part ?? Math.min(100, Math.round(jeu.temps.minutes_total / 60))}%` } as CSSProperties} />
          </span>
        </span>
      </Lien>
    </li>
  );
}

/**
 * La colonne de droite : le profil, les amis en ligne (ceux qui jouent d'abord, avec leur jeu),
 * puis les jeux dont il reste le moins de succès à débloquer.
 * Sur l'écran Amis, `amis` vaut null : la liste complète est déjà au centre.
 */
export function Colonne({
  amis,
  tousLesAmis,
  profil,
  replie,
}: {
  amis: Ami[] | null;
  tousLesAmis: number;
  profil: Profil | null;
  /** Repliée, la colonne ne garde que les portraits et les jaquettes ; leur nom passe en infobulle. */
  replie: boolean;
}) {
  const { t, tp } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  // Les derniers jeux sont dans le dock de la barre latérale ; ici, les jeux dont il reste le moins à finir.
  const aPortee = useMemo(() => (jeux === null ? [] : succesAPortee(jeux, JEUX_MONTRES)), [jeux]);
  const connectes = useMemo(() => {
    if (amis === null) return null;
    const ordre = { en_jeu: 0, en_ligne: 1, occupe: 2, absent: 3, hors_ligne: 4 } as const;
    return amis.filter((ami) => ami.statut !== 'hors_ligne').sort((a, b) => ordre[a.statut] - ordre[b.statut]);
  }, [amis]);
  const pseudo = profil?.pseudo ?? null;

  return (
    <aside className={styles.colonne} aria-label={t('colonne.nom')} data-replie={replie ? '' : undefined}>
      <Lien className={styles.profil} vers={{ ecran: 'profil' }} aria-label={pseudo === null ? t('coque.profil') : t('coque.profil_de', { pseudo })} title={pseudo ?? t('coque.profil')}>
        <span className={styles.profilAvatar}>
          {profil?.avatar != null ? (
            <img src={profil.avatar} alt="" width={40} height={40} />
          ) : (
            <span className={styles.profilVide}>
              <Icone nom="utilisateur" taille={18} />
            </span>
          )}
        </span>
        <span className={styles.texte}>
          <span className={styles.pseudo}>{pseudo ?? t('coque.profil')}</span>
          <span className={styles.statut}>{t('amis.statut.en_ligne')}</span>
        </span>
      </Lien>

      {connectes !== null && (
        <section className={styles.groupe} aria-labelledby="colonne-amis">
          <h2 id="colonne-amis" className={styles.titreGroupe}>
            {t('colonne.amis_en_ligne')}
            <span className={`${styles.nombre} chiffres`}>{connectes.length}</span>
          </h2>
          {connectes.length === 0 ? (
            <p className={styles.vide}>{t('colonne.personne')}</p>
          ) : (
            <ul className={styles.liste}>
              {connectes.slice(0, AMIS_MONTRES).map((ami) => (
                <Personne key={ami.steamid} ami={ami} />
              ))}
            </ul>
          )}
          {tousLesAmis > 0 && (
            <Lien className={styles.tous} vers={{ ecran: 'amis' }}>
              {tp('panneau_amis.tous', tousLesAmis)}
              <Icone nom="chevron_droit" taille={14} />
            </Lien>
          )}
        </section>
      )}

      {aPortee.length > 0 && (
        <section className={styles.groupe} aria-labelledby="colonne-portee">
          <h2 id="colonne-portee" className={styles.titreGroupe}>
            {t('carmin.portee.titre')}
          </h2>
          <ul className={styles.liste}>
            {aPortee.map((jeu) => (
              <JeuRecent key={jeu.id} jeu={jeu} />
            ))}
          </ul>
        </section>
      )}

    </aside>
  );
}
