import { disponible } from '../artefact/images';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { JeuResume } from '../../contrat/types';
import { BoutonJouer } from '../composants/BoutonJouer';
import { Icone, type NomDIcone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { NombreAnime } from '../composants/NombreAnime';
import { suiviDeListe } from '../composants/pointeur';
import { coeur } from '../coeur';
import { useApplication } from '../etat/application';
import { useDetail } from '../etat/detail';
import { creerMagasin } from '../etat/magasin';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterAnnee, formaterDateRelative, formaterNombre, formaterPourcentage, formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { animationsActives, Lien } from '../navigation';
import { Avatar } from '../profil/Avatar';
import styles from './Scene.module.css';

/** Le jeu choisi sur l'étagère, gardé quand on quitte la bibliothèque puis qu'on y revient. */
export const jeuEnScene = creerMagasin<number | null>(null);

/** Une image du fond. Les couches s'empilent : la nouvelle arrive en fondu par-dessus l'ancienne. */
interface Couche {
  cle: number;
  image: string | null;
  couleur: string | null;
}

/**
 * Le fond suit le jeu choisi en fondu enchaîné. La nouvelle image n'est posée qu'une fois décodée,
 * sur l'ancienne qui reste dessous jusqu'à la fin du fondu : jamais d'écran noir entre deux jeux.
 */
function useCouches(jeu: JeuResume, image: string | null | undefined): [Couche[], (cle: number) => void] {
  const [couches, setCouches] = useState<Couche[]>([]);
  const compteur = useRef(0);

  useEffect(() => {
    if (image === undefined) return; // détail pas encore lu : on garde l'image d'avant.
    let actif = true;
    const poser = () => {
      if (!actif) return;
      setCouches((avant) => {
        const derniere = avant.at(-1);
        if (derniere !== undefined && derniere.image === image && derniere.couleur === jeu.couleur_dominante) return avant;
        compteur.current += 1;
        return [...avant.slice(-2), { cle: compteur.current, image, couleur: jeu.couleur_dominante }];
      });
    };
    if (image === null) poser();
    else {
      const chargee = new Image();
      chargee.src = image;
      chargee.decode().then(poser, poser);
    }
    return () => {
      actif = false;
    };
  }, [image, jeu.couleur_dominante]);

  // Une couche arrivée recouvre tout : celles du dessous peuvent partir.
  const arrivee = (cle: number) => setCouches((avant) => avant.filter((couche) => couche.cle >= cle));
  return [couches, arrivee];
}

/** Les jeux à redécouvrir : jamais lancés, ou pas depuis six mois, les mieux notés d'abord. */
const SIX_MOIS = 182 * 86_400_000;

function aRedecouvrir(jeux: readonly JeuResume[], exclus: ReadonlySet<number>, maintenant: Date, nombre: number): JeuResume[] {
  const oublie = (jeu: JeuResume) =>
    jeu.temps.dernier_lancement === null || maintenant.getTime() - new Date(jeu.temps.dernier_lancement).getTime() > SIX_MOIS;
  const note = (jeu: JeuResume) => (jeu.avis === null ? 0 : jeu.avis.pct_positifs * Math.min(1, Math.log10(jeu.avis.nombre + 1) / 4));
  return jeux
    .filter((jeu) => !jeu.masque && !exclus.has(jeu.id) && jeu.steam_appid !== null && disponible(jeu.jaquette) && oublie(jeu))
    .sort((a, b) => note(b) - note(a) || a.id - b.id)
    .slice(0, nombre);
}

/**
 * Orientation « Carmin » : la vitrine. L'image du jeu choisi remplit une grande carte arrondie et dérive
 * lentement ; dessus, ses tags, son titre, ses chiffres et Jouer ; à droite, la carte carmin du jeu et
 * deux captures ; dessous, les points du carrousel (la vitrine passe seule au jeu suivant toutes les
 * 9 secondes, en pause sous le pointeur), puis les dernières parties en grandes jaquettes, puis les jeux
 * à redécouvrir.
 * Survoler ou toucher une jaquette la choisit (le fond change avec elle) ; un second toucher, ou
 * Entrée, ouvre sa fiche. Les flèches gauche et droite parcourent l'étagère.
 */
export function Scene({ jeu, recents }: { jeu: JeuResume; recents: JeuResume[] }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  const { detail } = useDetail(jeu.id);
  const noms = useApplication((a) => a.tags);
  const fiche = useReponse(() => coeur.fiche_du_jeu(jeu.id), 'fiche', jeu.id, `fiche:${jeu.id}`);
  const amis = useReponse(() => coeur.amis(), 'amis', null, 'amis');
  const etagere = useRef<HTMLUListElement>(null);
  const suiviEtagere = useMemo(() => suiviDeListe('[data-case]'), []);

  const [couches, coucheArrivee] = useCouches(jeu, detail === null ? undefined : (detail.hero ?? detail.en_tete));

  const listeAmis = amis.donnees ?? [];
  const joueurs = listeAmis.filter((ami) => ami.jeu_en_cours?.id_jeu === jeu.id);
  const enLigne = listeAmis.filter((ami) => ami.statut !== 'hors_ligne');
  const pile = joueurs.length > 0 ? joueurs : enLigne;

  const tags = jeu.tags
    .slice(0, 4)
    .map((id) => noms.get(id))
    .filter((nom): nom is string => nom !== undefined);
  const magasin = fiche.donnees;
  const captures = (magasin?.captures ?? []).slice(0, 2);
  const derniere = jeu.temps.dernier_lancement === null ? null : formaterDateRelative(jeu.temps.dernier_lancement, langue, maintenant);
  const succes = jeu.succes !== null && jeu.succes.debloques !== null && jeu.succes.total > 0 ? jeu.succes : null;
  const partSucces = succes === null ? null : Math.round(((succes.debloques ?? 0) / succes.total) * 100);
  const rang = recents.findIndex((j) => j.id === jeu.id);

  // La jaquette choisie reste visible quand on parcourt l'étagère.
  useEffect(() => {
    // Seule l'étagère défile, à l'horizontale : la page, elle, ne bouge pas.
    const liste = etagere.current;
    const choisie = liste?.querySelector<HTMLElement>('li[data-choisi]');
    if (liste == null || choisie == null) return;
    const gauche = choisie.offsetLeft; // l'étagère est le repère (position: relative)
    const droite = gauche + choisie.offsetWidth;
    const marge = 40;
    let cible: number | null = null;
    if (gauche - marge < liste.scrollLeft) cible = gauche - marge;
    else if (droite + marge > liste.scrollLeft + liste.clientWidth) cible = droite + marge - liste.clientWidth;
    if (cible !== null) liste.scrollTo({ left: Math.max(0, cible), behavior: animationsActives() ? 'smooth' : 'auto' });
  }, [jeu.id]);

  // Parallaxe : le fond recule, le texte avance, la carte penche, selon la place de la souris.
  const imageEnAttente = useRef(0);
  const suivre = (evenement: PointerEvent<HTMLElement>) => {
    if (evenement.pointerType !== 'mouse' || !animationsActives()) return;
    const element = evenement.currentTarget;
    const { clientX, clientY } = evenement;
    cancelAnimationFrame(imageEnAttente.current);
    imageEnAttente.current = requestAnimationFrame(() => {
      const cadre = element.getBoundingClientRect();
      const x = Math.min(1, Math.max(-1, ((clientX - cadre.left) / cadre.width) * 2 - 1));
      const y = Math.min(1, Math.max(-1, ((clientY - cadre.top) / cadre.height) * 2 - 1));
      element.style.setProperty('--sx', x.toFixed(3));
      element.style.setProperty('--sy', y.toFixed(3));
    });
  };
  const oublier = (evenement: PointerEvent<HTMLElement>) => {
    cancelAnimationFrame(imageEnAttente.current);
    evenement.currentTarget.style.removeProperty('--sx');
    evenement.currentTarget.style.removeProperty('--sy');
  };
  useEffect(() => () => cancelAnimationFrame(imageEnAttente.current), []);

  const parcourir = (evenement: KeyboardEvent<HTMLUListElement>) => {
    if (evenement.key !== 'ArrowRight' && evenement.key !== 'ArrowLeft') return;
    evenement.preventDefault();
    const prochain = recents[Math.min(recents.length - 1, Math.max(0, rang + (evenement.key === 'ArrowRight' ? 1 : -1)))];
    if (prochain === undefined) return;
    jeuEnScene.ecrire(prochain.id);
    etagere.current?.querySelector<HTMLElement>(`[data-id="${prochain.id}"]`)?.focus();
  };

  // Un premier toucher choisit la jaquette, le second ouvre sa fiche (comme une manette : on vise, puis on valide).
  const toucher = (j: JeuResume) => (evenement: MouseEvent<HTMLAnchorElement>) => {
    if (j.id !== jeu.id) {
      evenement.preventDefault();
      jeuEnScene.ecrire(j.id);
    }
  };

  const chiffres: { icone: NomDIcone; valeur: ReactNode; nom: string }[] = [];
  chiffres.push({
    icone: 'horloge',
    valeur: <NombreAnime valeur={jeu.temps.minutes_total} format={(v) => formaterTempsDeJeu(Math.round(v), langue)} />,
    nom: t('scene.tuile.temps'),
  });
  if (succes !== null) {
    chiffres.push({
      icone: 'trophee',
      valeur: (
        <>
          <NombreAnime valeur={succes.debloques ?? 0} format={(v) => formaterNombre(Math.round(v), langue)} />
          <small> / {formaterNombre(succes.total, langue)}</small>
        </>
      ),
      nom: t('scene.tuile.succes'),
    });
  }
  if (magasin?.joueurs_en_ligne != null && magasin.joueurs_en_ligne > 0) {
    chiffres.push({
      icone: 'amis',
      valeur: <NombreAnime valeur={magasin.joueurs_en_ligne} format={(v) => formaterNombre(Math.round(v), langue)} />,
      nom: t('salon.en_ligne_maintenant'),
    });
  } else {
    chiffres.push({
      icone: 'manette',
      valeur: derniere ?? t('scene.tuile.jamais'),
      nom: derniere === null ? (jeu.date_sortie === null ? '' : formaterAnnee(jeu.date_sortie)) : t('scene.tuile.derniere'),
    });
  }

  // La vitrine passe d'elle-même au jeu suivant quand la minuterie du point allumé est pleine.
  const suivant = () => {
    const prochain = recents[(rang + 1) % recents.length];
    if (prochain !== undefined && prochain.id !== jeu.id) jeuEnScene.ecrire(prochain.id);
  };
  const defiler = (sens: 1 | -1) => {
    const liste = etagere.current;
    if (liste !== null) liste.scrollBy({ left: sens * liste.clientWidth * 0.8, behavior: animationsActives() ? 'smooth' : 'auto' });
  };

  return (
    <section className={styles.salon} style={{ '--couleur-jeu': jeu.couleur_dominante ?? undefined } as CSSProperties} aria-labelledby="salon-titre">
      <div className={styles.vitrine}>
        <div className={styles.ecran} onPointerMove={suivre} onPointerLeave={oublier}>
          <div className={styles.fond} aria-hidden="true">
            <div className={styles.camera}>
              {couches.map((couche) => (
                <div
                  key={couche.cle}
                  className={styles.couche}
                  data-sens={couche.cle % 2 === 0 ? 'pair' : 'impair'}
                  style={{ '--couleur-couche': couche.couleur ?? undefined } as CSSProperties}
                  onAnimationEnd={(e: AnimationEvent<HTMLDivElement>) => {
                    if (e.target === e.currentTarget) coucheArrivee(couche.cle);
                  }}
                >
                  {couche.image !== null ? <img className={styles.fondImage} src={couche.image} alt="" decoding="async" /> : <span className={styles.fondCouleur} />}
                </div>
              ))}
            </div>
            <span className={styles.voile} />
            {couches.map((couche) => (
              <span key={couche.cle} className={styles.sol} style={{ '--couleur-couche': couche.couleur ?? undefined } as CSSProperties} />
            ))}
            <span className={styles.balayage} />
          </div>

          <div key={jeu.id} className={styles.infos}>
            <div className={styles.dessus}>
              {tags.length > 0 && (
                <ul className={styles.tags} aria-label={t('fiche.tags')}>
                  {tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              )}
              <p className={styles.etiquette}>
                {jeu.installe ? t('salon.pret') : t('salon.pas_installe')}
                {jeu.date_sortie !== null && <span>{formaterAnnee(jeu.date_sortie)}</span>}
              </p>
            </div>

            <h1 id="salon-titre" className={styles.titre}>
              <span className={styles.titreMasque}>
                {detail?.logo != null ? <img className={styles.logo} src={detail?.logo ?? ''} alt={jeu.titre} /> : jeu.titre}
              </span>
            </h1>

            <ul className={styles.chiffres}>
              {chiffres.map((chiffre) => (
                <li key={chiffre.icone}>
                  <span className={styles.chiffreIcone}>
                    <Icone nom={chiffre.icone} taille={16} />
                  </span>
                  <span className={styles.chiffreTexte}>
                    <strong className="chiffres">{chiffre.valeur}</strong>
                    <span>{chiffre.nom}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className={styles.actions}>
              <BoutonJouer jeu={jeu} grand />
              <Lien className={styles.rond} vers={{ ecran: 'jeu', id_jeu: jeu.id }} aria-label={t('scene.voir_la_fiche')} title={t('scene.voir_la_fiche')}>
                <Icone nom="info" taille={20} />
              </Lien>
              <Lien className={styles.rond} vers={{ ecran: 'succes', id_jeu: jeu.id }} aria-label={t('scene.tuile.succes')} title={t('scene.tuile.succes')}>
                <Icone nom="trophee" taille={20} />
              </Lien>
              {pile.length > 0 && (
                <p className={styles.joueurs}>
                  <span className={styles.pile} aria-hidden="true">
                    {pile.slice(0, 4).map((ami) => (
                      <Avatar key={ami.steamid} image={ami.avatar} pseudo={ami.pseudo} taille={30} />
                    ))}
                  </span>
                  {joueurs.length > 0
                    ? t('scene.amis_y_jouent', { n: formaterNombre(joueurs.length, langue) })
                    : t('salon.amis_en_ligne', { n: formaterNombre(enLigne.length, langue) })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div key={`carte-${jeu.id}`} className={styles.droite}>
          <article className={styles.carte}>
            <span className={styles.carteLueur} aria-hidden="true" />
            <span className={styles.carteReflet} aria-hidden="true" />
            <p className={styles.carteEtiquette}>{t('salon.carte.etiquette')}</p>
            <h2 className={styles.carteTitre}>{jeu.titre}</h2>
            <p className={styles.carteTexte}>{magasin?.description_courte ?? t('scene.sans_description')}</p>
            {captures.length > 0 && (
              <ul className={styles.captures} aria-label={t('salon.captures')}>
                {captures.map((capture) => (
                  <li key={capture.miniature}>
                    <Lien vers={{ ecran: 'jeu', id_jeu: jeu.id }} tabIndex={-1} aria-hidden="true">
                      <img src={capture.miniature} alt="" loading="lazy" decoding="async" />
                    </Lien>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.carteBas}>
              <span className={styles.jauge} title={t('scene.tuile.succes')}>
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <circle className={styles.jaugeFond} cx="32" cy="32" r="28" pathLength="100" />
                  <circle className={styles.jaugeValeur} cx="32" cy="32" r="28" pathLength="100" style={{ '--part': partSucces ?? 0 } as CSSProperties} />
                </svg>
                <span className="chiffres">
                  {partSucces === null ? '–' : <NombreAnime valeur={partSucces} format={(v) => formaterPourcentage(Math.round(v), langue)} />}
                </span>
              </span>
              <Lien className={styles.carteBouton} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
                {t('scene.voir_la_fiche')}
                <Icone nom="chevron_droit" taille={18} />
              </Lien>
            </div>
          </article>
        </div>
      </div>

      {recents.length > 1 && (
        <div className={styles.points}>
          <span className="chiffres">
            {String(rang + 1).padStart(2, '0')} <small>/ {String(recents.length).padStart(2, '0')}</small>
          </span>
          <span className={styles.pointsListe}>
            {recents.map((j, index) => (
              <button
                key={j.id}
                type="button"
                tabIndex={-1}
                aria-label={t('salon.choisir', { titre: j.titre })}
                title={t('salon.position', { n: index + 1, total: recents.length })}
                data-actif={j.id === jeu.id ? '' : undefined}
                onClick={() => jeuEnScene.ecrire(j.id)}
              >
                {j.id === jeu.id && <span key={j.id} className={styles.minuterie} onAnimationEnd={suivant} />}
              </button>
            ))}
          </span>
        </div>
      )}

      <div className={styles.bas}>
        <div className={styles.basTete}>
          <h2 className="titre-section">{t('bibliotheque.dernieres_parties')}</h2>
          <span className={styles.fleches}>
            <button type="button" className={styles.fleche} aria-label={t('carmin.precedents')} onClick={() => defiler(-1)}>
              <Icone nom="retour" taille={18} />
            </button>
            <button type="button" className={styles.fleche} aria-label={t('carmin.suivants')} onClick={() => defiler(1)}>
              <Icone nom="chevron_droit" taille={18} />
            </button>
          </span>
        </div>
        <ul ref={etagere} className={`cascade ${styles.etagere}`} onKeyDown={parcourir} {...suiviEtagere}>
          {recents.map((j) => (
            <li key={j.id} data-choisi={j.id === jeu.id ? '' : undefined}>
              <Lien
                className={styles.case}
                vers={{ ecran: 'jeu', id_jeu: j.id }}
                data-case=""
                data-id={j.id}
                data-choisi={j.id === jeu.id ? '' : undefined}
                aria-current={j.id === jeu.id ? 'true' : undefined}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') jeuEnScene.ecrire(j.id);
                }}
                onFocus={() => jeuEnScene.ecrire(j.id)}
                onClick={toucher(j)}
                style={{ '--couleur-jaquette': j.couleur_dominante ?? undefined } as CSSProperties}
              >
                <span className={styles.caseCadre}>
                  <Jaquette jeu={j} prioritaire className={styles.caseImage ?? ''} />
                  <span className={styles.casePellicule} aria-hidden="true" />
                  <span className={styles.caseJouer} aria-hidden="true">
                    <Icone nom="jouer" taille={20} />
                  </span>
                </span>
                <span className={styles.caseNom}>{j.titre}</span>
                <span className={`${styles.caseTemps} chiffres`}>{formaterTempsDeJeu(j.temps.minutes_total, langue)}</span>
              </Lien>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={styles.toutVoir}
              onClick={() => document.getElementById('toute-la-bibliotheque')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <Icone nom="grille" taille={26} />
              <span>{t('salon.toute_la_bibliotheque')}</span>
            </button>
          </li>
        </ul>
      </div>

      <Redecouvrir recents={recents} />
    </section>
  );
}

/** La rangée des grandes cartes : des jeux possédés qui attendent qu'on les relance. */
function Redecouvrir({ recents }: { recents: JeuResume[] }) {
  const { t } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const maintenant = useMaintenant();
  const jour = maintenant.toDateString();
  const suivi = useMemo(() => suiviDeListe('[data-carte]'), []);
  const choix = useMemo(
    () => (jeux === null ? [] : aRedecouvrir(jeux, new Set(recents.map((j) => j.id)), new Date(jour), 4)),
    [jeux, recents, jour],
  );
  if (choix.length === 0) return null;
  return (
    <section className={styles.redecouvrir} aria-labelledby="salon-redecouvrir">
      <header className={styles.redecouvrirTete}>
        <h2 id="salon-redecouvrir">{t('salon.redecouvrir.titre')}</h2>
        <p>{t('salon.redecouvrir.sous_titre')}</p>
      </header>
      <ul className={`cascade ${styles.offres}`} {...suivi}>
        {choix.map((jeu, index) => (
          <li key={jeu.id}>
            <CarteOubliee jeu={jeu} grande={index === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CarteOubliee({ jeu, grande }: { jeu: JeuResume; grande: boolean }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  const { detail } = useDetail(jeu.id);
  const noms = useApplication((a) => a.tags);
  // La première image réellement là : le grand visuel, sinon l'en-tête, sinon la jaquette.
  const image = [detail?.hero, detail?.en_tete, jeu.jaquette].find(disponible);
  const derniere = jeu.temps.dernier_lancement === null ? null : formaterDateRelative(jeu.temps.dernier_lancement, langue, maintenant);
  const tag = jeu.tags.map((id) => noms.get(id)).find((nom) => nom !== undefined);
  return (
    <Lien
      className={styles.offre}
      vers={{ ecran: 'jeu', id_jeu: jeu.id }}
      data-carte=""
      data-grande={grande ? '' : undefined}
      style={{ '--couleur-jaquette': jeu.couleur_dominante ?? undefined } as CSSProperties}
    >
      <span className={styles.offreImage} aria-hidden="true">
        {image != null && <img src={image} alt="" loading="lazy" decoding="async" />}
      </span>
      <span className={styles.offreVoile} aria-hidden="true" />
      <span className={styles.offreEclat} aria-hidden="true" />
      <span className={styles.offreTexte}>
        {tag !== undefined && <span className={styles.offreTag}>{tag}</span>}
        {grande && disponible(detail?.logo) ? <img className={styles.offreLogo} src={detail.logo} alt={jeu.titre} /> : <strong>{jeu.titre}</strong>}
        <small>
          {derniere === null ? t('scene.tuile.jamais') : t('salon.joue', { quand: derniere.charAt(0).toLocaleLowerCase(langue) + derniere.slice(1) })}
          {jeu.avis !== null && jeu.avis.nombre > 0 && <span>{t('salon.avis', { pct: formaterPourcentage(jeu.avis.pct_positifs, langue) })}</span>}
        </small>
      </span>
      <span className={styles.offreFleche} aria-hidden="true">
        <Icone nom="chevron_droit" taille={20} />
      </span>
    </Lien>
  );
}
