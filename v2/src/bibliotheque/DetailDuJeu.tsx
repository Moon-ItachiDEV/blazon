import { useState } from 'react';
import type { Actualite } from '../../contrat/types';
import { LecteurDActualite } from '../actualites/Lecteur';
import { disponible } from '../artefact/images';
import { Icone, type NomDIcone } from '../composants/Icone';
import { BoutonTempsJouer, PileDAvatars, PiluleTag, useNomsDeTags } from '../composants/Visuels';
import { coeur } from '../coeur';
import { useAmbiance } from '../etat/ambiance';
import { definirFavori, tenter, useApplication } from '../etat/application';
import { useDetail } from '../etat/detail';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterDate, formaterDateComplete, formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import type { Route } from '../navigation';
import styles from './DetailDuJeu.module.css';

function LienDeColonne({ icone, children, vers, onClick }: { icone: NomDIcone; children: string; vers?: Route; onClick?: () => void }) {
  const contenu = (
    <>
      <Icone nom={icone} taille={17} />
      <span>{children}</span>
    </>
  );
  return (
    <li>
      {vers !== undefined ? (
        <Lien className={styles.lien} vers={vers}>
          {contenu}
        </Lien>
      ) : (
        <button type="button" className={styles.lien} onClick={onClick}>
          {contenu}
        </button>
      )}
    </li>
  );
}

/**
 * Le jeu choisi dans la bibliothèque, sur son art plein panneau (For Honor, Dota 2) : grand titre fin,
 * temps de jeu et dernière partie en bleu, description, Jouer, amis qui y jouent, actualités et liens.
 */
export function DetailDuJeu({ id_jeu }: { id_jeu: number }) {
  const { t, tp, langue } = useTexte();
  const maintenant = useMaintenant();
  const { detail } = useDetail(id_jeu);
  const jeuFrais = useApplication((a) => a.jeux?.find((j) => j.id === id_jeu));
  const jeu = jeuFrais ?? detail?.resume;
  const fiche = useReponse(() => coeur.fiche_du_jeu(id_jeu), 'fiche', id_jeu, `fiche:${id_jeu}`);
  const actualites = useReponse(() => coeur.actualites_du_jeu(id_jeu, 3, null), 'actualites', id_jeu, `actualites:${id_jeu}`);
  const amis = useReponse(() => coeur.amis(), 'amis', null, 'amis');
  const tags = useNomsDeTags(jeu?.tags ?? [], 4);
  const [lue, setLue] = useState<Actualite | null>(null);
  const art = detail === null ? null : [detail.hero, detail.en_tete].find((u) => disponible(u)) ?? null;
  useAmbiance(jeu?.couleur_dominante ?? null, art ?? (disponible(jeu?.jaquette) ? (jeu?.jaquette ?? null) : null));

  if (jeu === undefined) return <div className={styles.detail} />;

  const enJeu = (amis.donnees ?? []).filter((a) => a.statut === 'en_jeu' && a.jeu_en_cours?.id_jeu === jeu.id);
  const enLigne = (amis.donnees ?? []).filter((a) => a.statut !== 'hors_ligne' && !enJeu.includes(a));
  const logo = detail !== null && disponible(detail.logo) ? detail.logo : null;
  const description = fiche.donnees?.description_courte ?? null;

  return (
    <article className={styles.detail} aria-label={jeu.titre}>
      <div className={styles.art} aria-hidden="true">
        {art !== null ? (
          <img key={art} src={art} alt="" decoding="async" />
        ) : disponible(jeu.jaquette) ? (
          <img key={jeu.jaquette} src={jeu.jaquette} alt="" className={styles.artFlou} decoding="async" />
        ) : null}
      </div>
      <div className={styles.contenu}>
        <div className={styles.principal}>
          <header className={styles.entete}>
            {disponible(jeu.jaquette) && <img className={styles.icone} src={jeu.jaquette} alt="" decoding="async" />}
            <div className={styles.enteteTexte}>
              {logo !== null ? (
                <h2 className={styles.logo}>
                  <img src={logo} alt={jeu.titre} />
                </h2>
              ) : (
                <h2 className={styles.titre}>{jeu.titre}</h2>
              )}
              <p className={styles.temps}>
                <span>
                  {t('v2.tu_as_joue')} <strong className="chiffres">{jeu.temps.minutes_total > 0 ? formaterTempsDeJeu(jeu.temps.minutes_total, langue) : t('jeu.jamais_lance')}</strong>
                </span>
                {jeu.temps.dernier_lancement !== null && (
                  <span>
                    {t('tri.dernier_lancement')} <strong className="chiffres">{formaterDateComplete(jeu.temps.dernier_lancement, langue)}</strong>
                  </span>
                )}
              </p>
            </div>
          </header>

          {description !== null && <p className={styles.description}>{description}</p>}
          {tags.length > 0 && (
            <div className={styles.tags}>
              {tags.map((tag) => (
                <PiluleTag key={tag} petite>
                  {tag}
                </PiluleTag>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <BoutonTempsJouer jeu={jeu} sansTemps />
            <Lien className={styles.boutonFiche} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
              {t('v2.voir_la_fiche')}
              <Icone nom="chevron_droit" taille={16} />
            </Lien>
          </div>

          <section className={styles.bloc} aria-labelledby="detail-amis">
            <h3 id="detail-amis" className={styles.blocTitre}>
              {t('coque.amis')}
            </h3>
            {enJeu.length > 0 ? (
              <>
                <p className={styles.phrase}>{tp('fiche.amis_y_jouent', enJeu.length)}</p>
                <PileDAvatars amis={enJeu} max={6} taille={40} />
              </>
            ) : (
              <p className={styles.phrase}>{t('v2.aucun_ami_n_y_joue')}</p>
            )}
            {enLigne.length > 0 && (
              <>
                <p className={styles.phrase}>{tp('v2.amis_en_ligne', enLigne.length)}</p>
                <PileDAvatars amis={enLigne} max={8} taille={32} />
              </>
            )}
          </section>

          {actualites.donnees !== null && actualites.donnees.length > 0 && (
            <section className={styles.bloc} aria-labelledby="detail-actualites">
              <h3 id="detail-actualites" className={styles.blocTitre}>
                {t('v2.actualites_recentes')}
              </h3>
              <ul className={styles.nouvelles}>
                {actualites.donnees.slice(0, 2).map((a) => (
                  <li key={a.id}>
                    <button type="button" className={styles.nouvelle} onClick={() => setLue(a)}>
                      <span className="etiquette">
                        {formaterDate(a.date, langue, maintenant)} · {t(`actualite.type.${a.type}`)}
                      </span>
                      <span className={styles.nouvelleTitre}>{a.titre}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <nav className={styles.liens} aria-label={t('v2.liens')}>
          <h3 className={styles.blocTitre}>{t('v2.liens')}</h3>
          <ul>
            <LienDeColonne icone="info" vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
              {t('v2.fiche_du_jeu')}
            </LienDeColonne>
            {jeu.succes !== null && (
              <LienDeColonne icone="trophee" vers={{ ecran: 'succes', id_jeu: jeu.id }}>
                {t('fiche.succes')}
              </LienDeColonne>
            )}
            <LienDeColonne icone="journal" vers={{ ecran: 'actualites' }}>
              {t('coque.actualites')}
            </LienDeColonne>
            {jeu.installe && (
              <LienDeColonne icone="dossier" onClick={() => void tenter((c) => c.ouvrir_le_dossier(jeu.id))}>
                {t('v2.dossier_local')}
              </LienDeColonne>
            )}
            {jeu.steam_appid !== null && (
              <LienDeColonne icone="lien_externe" onClick={() => jeu.steam_appid !== null && void tenter((c) => c.action_steam({ action: 'voir_dans_le_magasin', steam_appid: jeu.steam_appid ?? 0 }))}>
                {t('v2.page_magasin')}
              </LienDeColonne>
            )}
            <LienDeColonne icone={jeu.favori ? 'etoile_pleine' : 'etoile'} onClick={() => void definirFavori(jeu.id, !jeu.favori)}>
              {jeu.favori ? t('fiche.retirer_des_favoris') : t('fiche.ajouter_aux_favoris')}
            </LienDeColonne>
          </ul>
        </nav>
      </div>
      <LecteurDActualite actualite={lue} jeu={jeu.titre} onFermer={() => setLue(null)} />
    </article>
  );
}
