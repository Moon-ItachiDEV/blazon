import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Ami, JeuDetail, JeuResume } from '../../contrat/types';
import { disponible } from '../artefact/images';
import { Icone } from '../composants/Icone';
import { BadgesSources, BoutonTempsJouer, classes, ImageDeJeuAuto, MotsQuiSeLevent, PileDAvatars, PiluleTag, TitreDeSection, useNomsDeTags } from '../composants/Visuels';
import { coeur } from '../coeur';
import { useAmbiance } from '../etat/ambiance';
import { useApplication } from '../etat/application';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterDateRelative } from '../formats';
import { useTexte } from '../i18n/react';
import { animationsActives, Lien, naviguer } from '../navigation';
import { BIBLIOTHEQUE } from '../navigation/routes';
import { filtreChoisi } from '../bibliotheque/filtre';
import { Avatar } from '../profil/Avatar';
import styles from './EcranAccueil.module.css';

const ROTATION_MS = 8000;
const CANDIDATS = 10;
const VEDETTES = 6;

/** Les jeux récents qui ont une grande image : lus une fois, dans l'ordre des dernières parties. */
function useVedettes(jeux: JeuResume[] | null): JeuDetail[] {
  const ids = useMemo(
    () =>
      (jeux ?? [])
        .filter((j) => !j.masque && j.temps.dernier_lancement !== null && disponible(j.jaquette))
        .sort((a, b) => (b.temps.dernier_lancement ?? '').localeCompare(a.temps.dernier_lancement ?? ''))
        .slice(0, CANDIDATS)
        .map((j) => j.id)
        .join(','),
    [jeux],
  );
  const [details, setDetails] = useState<JeuDetail[]>([]);
  useEffect(() => {
    let actif = true;
    const liste = ids === '' ? [] : ids.split(',').map(Number);
    void Promise.all(liste.map((id) => coeur.detail_jeu(id).catch(() => null))).then((lus) => {
      if (!actif) return;
      setDetails(lus.filter((d): d is JeuDetail => d !== null && disponible(d.hero)).slice(0, VEDETTES));
    });
    return () => {
      actif = false;
    };
  }, [ids]);
  return details;
}

function useFicheCourte(id_jeu: number | null): { studio: string | null; description: string | null } {
  const fiche = useReponse(() => (id_jeu === null ? Promise.reject(new Error()) : coeur.fiche_du_jeu(id_jeu)), 'fiche', id_jeu, String(id_jeu));
  return { studio: fiche.donnees?.developpeurs[0] ?? null, description: fiche.donnees?.description_courte ?? null };
}

/** La rangée du haut (Dribbble 08) : la grande image qui chevauche le panneau d'info. */
function Vedette({ details, amis }: { details: JeuDetail[]; amis: Ami[] }) {
  const { t, tp } = useTexte();
  const [rang, setRang] = useState(0);
  const [pause, setPause] = useState(false);
  // L'image précédente reste dessous pendant le fondu de la nouvelle.
  const [sortante, setSortante] = useState<number | null>(null);
  const changer = (suivant: number) => {
    if (suivant === rang) return;
    setSortante(rang);
    setRang(suivant);
  };
  const courant = details[rang % Math.max(details.length, 1)];
  const jeuFrais = useApplication((a) => (courant === undefined ? undefined : a.jeux?.find((j) => j.id === courant.resume.id)));
  const jeu = jeuFrais ?? courant?.resume;
  const tags = useNomsDeTags(jeu?.tags ?? [], 3);
  const { studio: developpeur, description } = useFicheCourte(jeu?.id ?? null);
  useAmbiance(jeu?.couleur_dominante ?? null, courant?.hero ?? null);

  useEffect(() => {
    if (details.length < 2 || pause || !animationsActives()) return;
    const minuteur = window.setTimeout(() => changer((rang + 1) % details.length), ROTATION_MS);
    return () => window.clearTimeout(minuteur);
  }, [rang, pause, details.length]);

  if (courant === undefined || jeu === undefined) {
    return <div className={styles.vedetteVide} aria-hidden="true" />;
  }
  const quiYJouent = amis.filter((a) => a.statut === 'en_jeu' && a.jeu_en_cours?.id_jeu === jeu.id);
  const enLigne = amis.filter((a) => a.statut !== 'hors_ligne');
  const pile = quiYJouent.length > 0 ? quiYJouent : enLigne;

  return (
    <section className={styles.vedette} aria-roledescription="carrousel" aria-label={t('v2.a_la_une')} data-parallaxe="" onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}>
      <Lien className={styles.vedetteImage} vers={{ ecran: 'jeu', id_jeu: jeu.id }} aria-label={jeu.titre} data-envol="">
        {details.map((d, i) => (
          <img key={d.resume.id} src={d.hero ?? ''} alt="" className={styles.vedetteArt} data-visible={i === rang ? '' : undefined} data-sortante={i === sortante && i !== rang ? '' : undefined} decoding="async" draggable={false} />
        ))}
        <span className={styles.vedetteDegrade} aria-hidden="true" />
        {/* Un trait de lumière balaie l'image à chaque changement de jeu. */}
        <span key={`balayage-${rang}`} className={styles.balayage} aria-hidden="true" />
        <span className={styles.vedetteHaut}>
          <BadgesSources sources={jeu.sources} />
        </span>
        {pile.length > 0 && (
          <span className={styles.vedetteAmis}>
            <PileDAvatars amis={pile} max={3} taille={34} reste={0} />
            <span className={styles.vedettePilule}>
              <Icone nom="amis" taille={16} />
              {quiYJouent.length > 0 ? tp('v2.amis_y_jouent', quiYJouent.length) : tp('v2.amis_en_ligne', enLigne.length)}
            </span>
          </span>
        )}
      </Lien>

      <div className={styles.vedetteInfo}>
        <div key={jeu.id} className={styles.vedetteTexte}>
          <h1 className={styles.vedetteTitre}>
            <MotsQuiSeLevent texte={jeu.titre} />
          </h1>
          {developpeur !== null && <p className={styles.vedetteStudio}>{developpeur}</p>}
          {description !== null && <p className={styles.vedetteDescription}>{description}</p>}
          {tags.length > 0 && (
            <div className={styles.vedetteTags}>
              {tags.map((tag) => (
                <PiluleTag key={tag}>{tag}</PiluleTag>
              ))}
            </div>
          )}
        </div>
        <BoutonTempsJouer jeu={jeu} large />
        {details.length > 1 && (
          <div className={styles.points} role="tablist" aria-label={t('v2.a_la_une')}>
            {details.map((d, i) => (
              <button
                key={d.resume.id}
                type="button"
                role="tab"
                aria-selected={i === rang}
                aria-label={d.resume.titre}
                className={styles.point}
                data-pause={pause ? '' : undefined}
                onClick={() => changer(i)}
                style={{ '--duree-point': `${ROTATION_MS}ms` } as CSSProperties}
              >
                <span />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Carte paysage qui « sort » de la grille au survol (effet FIFA 22 de Dribbble 08). */
function CartePaysage({ jeu, position }: { jeu: JeuResume; position: 'debut' | 'milieu' | 'fin' }) {
  const tags = useNomsDeTags(jeu.tags, 1);
  return (
    <li className={styles.carte} data-position={position}>
      <Lien className={styles.carteLien} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
        <span className={styles.carteCadre} data-incliner="">
          <ImageDeJeuAuto jeu={jeu} className={styles.carteImage} />
          <span className="v2-eclat" aria-hidden="true" />
        </span>
        <span className={styles.carteBas}>
          <span className={styles.carteTitre}>{jeu.titre}</span>
          {tags[0] !== undefined && <PiluleTag petite>{tags[0]}</PiluleTag>}
        </span>
      </Lien>
    </li>
  );
}

function Rangee({ jeux, colonnes }: { jeux: JeuResume[]; colonnes: number }) {
  return (
    <ul className={styles.rangee} style={{ '--colonnes': colonnes } as CSSProperties}>
      {jeux.map((jeu, i) => (
        <CartePaysage key={jeu.id} jeu={jeu} position={i % colonnes === 0 ? 'debut' : i % colonnes === colonnes - 1 ? 'fin' : 'milieu'} />
      ))}
    </ul>
  );
}

const ORDRE = { en_jeu: 0, en_ligne: 1, occupe: 2, absent: 3, hors_ligne: 4 } as const;

function PanneauAmis({ amis }: { amis: Ami[] }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  const liste = [...amis].sort((a, b) => ORDRE[a.statut] - ORDRE[b.statut] || (b.derniere_connexion ?? '').localeCompare(a.derniere_connexion ?? '')).slice(0, 6);
  return (
    <ul className={`${styles.amis} verre-poli`}>
      {liste.map((ami) => {
        const jeu = ami.statut === 'en_jeu' ? ami.jeu_en_cours : null;
        return (
          <li key={ami.steamid} className={styles.ami}>
            <span className={styles.amiAvatar} data-statut={ami.statut}>
              <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={40} />
            </span>
            <span className={styles.amiTexte}>
              <span className={styles.amiPseudo}>{ami.pseudo}</span>
              {jeu !== null ? (
                <span className={styles.amiJeu}>{t('v2.joue_a', { titre: jeu.titre })}</span>
              ) : (
                <span className={styles.amiVu}>
                  {ami.statut === 'hors_ligne' && ami.derniere_connexion !== null
                    ? t('v2.vu', { quand: formaterDateRelative(ami.derniere_connexion, langue, maintenant).toLocaleLowerCase(langue) })
                    : t(`amis.statut.${ami.statut}`)}
                </span>
              )}
            </span>
            {jeu !== null && (
              <button
                type="button"
                className={styles.rejoindre}
                onClick={() => naviguer(jeu.id_jeu !== null ? { ecran: 'jeu', id_jeu: jeu.id_jeu } : { ecran: 'amis' })}
              >
                {t('v2.rejoindre')}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function VoirTout({ vers, onClick }: { vers: Parameters<typeof Lien>[0]['vers']; onClick?: () => void }) {
  const { t } = useTexte();
  return (
    <Lien className={classes.lienVoir} vers={vers} onClick={onClick}>
      {t('v2.voir_tout')}
      <Icone nom="chevron_droit" taille={16} />
    </Lien>
  );
}

/** L'accueil de la V2 (Dribbble 08) : vedette, les plus joués, favoris et amis. */
export function EcranAccueil() {
  const { t } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const amisR = useReponse(() => coeur.amis(), 'amis', null, 'amis');
  const amis = amisR.donnees ?? [];
  const vedettes = useVedettes(jeux);

  const visibles = useMemo(() => (jeux ?? []).filter((j) => !j.masque && disponible(j.jaquette)), [jeux]);
  const plusJoues = useMemo(() => [...visibles].sort((a, b) => b.temps.minutes_total - a.temps.minutes_total).slice(0, 4), [visibles]);
  const favoris = useMemo(() => visibles.filter((j) => j.favori).slice(0, 4), [visibles]);

  return (
    <div className={styles.accueil}>
      <Vedette details={vedettes} amis={amis} />

      <section className={styles.section} aria-labelledby="accueil-plus-joues">
        <TitreDeSection id="accueil-plus-joues" titre={t('v2.plus_joues')} action={<VoirTout vers={BIBLIOTHEQUE} onClick={() => filtreChoisi.ecrire('tous')} />} />
        <Rangee jeux={plusJoues} colonnes={4} />
      </section>

      <div className={styles.deuxColonnes}>
        {favoris.length > 0 && (
          <section aria-labelledby="accueil-favoris">
            <TitreDeSection id="accueil-favoris" titre={t('filtre.favoris')} action={<VoirTout vers={BIBLIOTHEQUE} onClick={() => filtreChoisi.ecrire('favoris')} />} />
            <Rangee jeux={favoris} colonnes={2} />
          </section>
        )}
        {amis.length > 0 && (
          <section aria-labelledby="accueil-amis">
            <TitreDeSection id="accueil-amis" titre={t('coque.amis')} action={<VoirTout vers={{ ecran: 'amis' }} />} />
            <PanneauAmis amis={amis} />
          </section>
        )}
      </div>
    </div>
  );
}
