/**
 * Version « artefact » : l'app tourne dans une page web qui n'a le droit de charger aucune image
 * d'un autre site. Les images utiles ont été réduites et rangées dans des paquets à côté de la page
 * (outils/artefact/images.py). Ici :
 *  - `reecrireImages` remplace, dans les données lues, chaque adresse Steam par une image d'attente
 *    qui porte son empreinte (ou par une adresse vide quand l'image n'a pas été emportée : le
 *    composant affiche alors son repli, comme hors ligne) ;
 *  - `surveillerLesImages` remplace l'image d'attente par la vraie quand elle approche de l'écran.
 * Rien de ce fichier ne tourne hors de la version artefact (`VITE_ARTEFACT=1`).
 */
import { empreinte } from './empreinte';

export const VERSION_ARTEFACT = import.meta.env.VITE_ARTEFACT === '1';

interface Index {
  paquets: string[];
  images: Record<string, [number, number, number]>;
}

const MARQUE = ';blazon=';
const ABSENTE = 'data:,';
const ADRESSE = /https?:\/\/[a-z0-9.-]*steamstatic\.com\/[^\s"'<>)]+/gi;

let index: Index = { paquets: [], images: {} };
let indexPret: Promise<void> | null = null;

function adresseDe(chemin: string): string {
  return new URL(chemin, document.baseURI).href;
}

export function chargerIndex(): Promise<void> {
  indexPret ??= fetch(adresseDe('img/index.json'))
    .then((r) => (r.ok ? (r.json() as Promise<Index>) : index))
    .then((i) => {
      index = i;
    })
    .catch(() => undefined);
  return indexPret;
}

function attente(cle: string): string {
  return `data:image/svg+xml${MARQUE}${cle},%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E`;
}

function remplacer(url: string): string {
  const cle = empreinte(url.replace(/&amp;/g, '&'));
  return cle in index.images ? attente(cle) : ABSENTE;
}

function connue(url: string): boolean {
  return empreinte(url) in index.images;
}

function reecrireTexte(texte: string): string {
  if (!texte.includes('steamstatic')) return texte;
  if (/^https?:\/\/\S+$/.test(texte)) return remplacer(texte);
  // Du HTML (descriptions, actualités) : les images emportées sont remplacées, les autres retirées.
  return texte
    .replace(/<img\b[^>]*>/gi, (balise) => {
      const m = balise.match(ADRESSE);
      if (!m) return balise;
      const cible = remplacer(m[0]);
      return cible === ABSENTE ? '' : balise.replace(m[0], cible);
    })
    .replace(/(src=["'])(https?:\/\/[^"']*steamstatic[^"']*)/gi, (_, debut: string, url: string) => debut + remplacer(url));
}

function parcourir(valeur: unknown, cle = ''): unknown {
  if (typeof valeur === 'string') return reecrireTexte(valeur);
  if (Array.isArray(valeur)) {
    // Une galerie n'affiche que les captures emportées, plutôt que des cases vides.
    const liste = cle === 'captures' ? valeur.filter((c: { miniature?: unknown }) => typeof c?.miniature !== 'string' || connue(c.miniature)) : valeur;
    return liste.map((v) => parcourir(v));
  }
  if (valeur !== null && typeof valeur === 'object') {
    const objet = valeur as Record<string, unknown>;
    for (const k of Object.keys(objet)) objet[k] = parcourir(objet[k], k);
    return objet;
  }
  return valeur;
}

export async function reecrireImages<T>(donnees: T): Promise<T> {
  await chargerIndex();
  return parcourir(donnees) as T;
}

const paquets = new Map<number, Promise<ArrayBuffer>>();
const prets = new Map<string, Promise<string>>();

function image(cle: string): Promise<string> {
  let p = prets.get(cle);
  if (p) return p;
  const entree = index.images[cle];
  if (!entree) return Promise.resolve(ABSENTE);
  const [numero, debut, longueur] = entree;
  let paquet = paquets.get(numero);
  if (!paquet) {
    paquet = fetch(adresseDe(index.paquets[numero] ?? '')).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.arrayBuffer();
    });
    paquet.catch(() => paquets.delete(numero));
    paquets.set(numero, paquet);
  }
  p = paquet
    .then((octets) => URL.createObjectURL(new Blob([new Uint8Array(octets, debut, longueur)], { type: 'image/webp' })))
    .catch(() => {
      prets.delete(cle);
      return ABSENTE;
    });
  prets.set(cle, p);
  return p;
}

function cleDe(img: HTMLImageElement): string | null {
  const src = img.getAttribute('src') ?? '';
  const i = src.indexOf(MARQUE);
  if (i < 0) return null;
  return src.slice(i + MARQUE.length, src.indexOf(',', i));
}

function remplir(img: HTMLImageElement): void {
  const cle = cleDe(img);
  if (cle === null) return;
  const marque = img.getAttribute('src');
  void image(cle).then((url) => {
    if (img.getAttribute('src') === marque) img.src = url;
  });
}

export function surveillerLesImages(): void {
  const proches = new IntersectionObserver(
    (entrees) => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue;
        proches.unobserve(e.target);
        remplir(e.target as HTMLImageElement);
      }
    },
    { rootMargin: '900px' },
  );
  const examiner = (img: HTMLImageElement): void => {
    if (cleDe(img) === null) return;
    // Les images d'ambiance (floues, en fond) et celles qu'on ne voit pas encore passent par l'observateur.
    proches.observe(img);
  };
  const parcourirNoeud = (n: Node): void => {
    if (n instanceof HTMLImageElement) examiner(n);
    else if (n instanceof Element) n.querySelectorAll('img').forEach(examiner);
  };
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') parcourirNoeud(m.target);
      else m.addedNodes.forEach(parcourirNoeud);
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  parcourirNoeud(document.body);
}

/** Une adresse d'image utilisable : présente, et (dans l'artefact) emportée avec la page. */
export function disponible(url: string | null | undefined): url is string {
  return url != null && url !== '' && url !== ABSENTE;
}
