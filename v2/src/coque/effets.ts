import { animationsActives } from '../navigation';

/**
 * Les effets de matière de la V2, posés une fois pour toute l'application, par délégation sur le document
 * (aucun écouteur par carte). Tout passe par des variables CSS et des propriétés `translate`/`rotate`
 * indépendantes de `transform` : les animations déjà écrites dans les modules ne sont pas écrasées.
 *
 * - Reflet de verre : sur tout panneau de verre (détecté à son `backdrop-filter`), une lueur douce et un
 *   bord qui s'allument sous le pointeur, comme une vitre qui accroche la lumière.
 * - Inclinaison : `[data-incliner]` pivote légèrement vers le pointeur, avec un éclat qui le suit.
 * - Parallaxe : `[data-parallaxe]` expose la position du pointeur (−1…1) dans --px / --py.
 * - Aimant : `[data-aimant]` (les boutons Jouer) se laisse attirer de quelques pixels.
 * - Onde : un clic sur `[data-onde]` fait partir un anneau de lumière depuis le point touché.
 *
 * Rien ne s'installe si les animations sont coupées (réglage ou « réduire les animations »).
 */

const verres = new WeakMap<Element, HTMLElement | null>();

/** Le panneau de verre qui contient l'élément, s'il y en a un (résultat gardé). */
function panneauDeVerre(depart: Element | null): HTMLElement | null {
  let el: Element | null = depart;
  for (let profondeur = 0; el !== null && profondeur < 9; profondeur += 1, el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    const connu = verres.get(el);
    if (connu !== undefined) {
      if (connu !== null) return connu;
      continue;
    }
    const style = getComputedStyle(el);
    const flou = style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter');
    const r = el.getBoundingClientRect();
    if (flou !== '' && flou !== 'none' && r.width > 140 && r.height > 48 && el.dataset.sansReflet === undefined) {
      if (style.position === 'static') el.style.position = 'relative';
      const lueur = document.createElement('span');
      lueur.className = 'v2-reflet';
      lueur.setAttribute('aria-hidden', 'true');
      const bord = document.createElement('span');
      bord.className = 'v2-reflet-bord';
      bord.setAttribute('aria-hidden', 'true');
      el.append(lueur, bord);
      el.dataset.reflet = '';
      verres.set(el, el);
      return el;
    }
    verres.set(el, null);
  }
  return null;
}

let verreActif: HTMLElement | null = null;
let inclineActif: HTMLElement | null = null;
let aimantActif: HTMLElement | null = null;
const parallaxes = new Set<HTMLElement>();

function relacher(el: HTMLElement | null, attribut: string): void {
  if (el === null) return;
  delete el.dataset[attribut];
}

function suivre(e: PointerEvent): void {
  if (e.pointerType === 'touch') return;
  const cible = e.target instanceof Element ? e.target : null;

  const verre = panneauDeVerre(cible);
  if (verre !== verreActif) {
    relacher(verreActif, 'eclaire');
    verreActif = verre;
    if (verre !== null) verre.dataset.eclaire = '';
  }
  if (verre !== null) {
    const r = verre.getBoundingClientRect();
    verre.style.setProperty('--rx', `${e.clientX - r.left}px`);
    verre.style.setProperty('--ry', `${e.clientY - r.top}px`);
  }

  const incline = cible?.closest<HTMLElement>('[data-incliner]') ?? null;
  if (incline !== inclineActif) {
    if (inclineActif !== null) {
      inclineActif.style.setProperty('--tx', '0');
      inclineActif.style.setProperty('--ty', '0');
      relacher(inclineActif, 'incline');
    }
    inclineActif = incline;
  }
  if (incline !== null) {
    const r = incline.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    incline.dataset.incline = '';
    incline.style.setProperty('--tx', (x - 0.5).toFixed(3));
    incline.style.setProperty('--ty', (y - 0.5).toFixed(3));
    incline.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    incline.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
  }

  const aimant = cible?.closest<HTMLElement>('[data-aimant]') ?? null;
  if (aimant !== aimantActif) {
    if (aimantActif !== null) aimantActif.style.translate = '';
    aimantActif = aimant;
  }
  if (aimant !== null) {
    const r = aimant.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    aimant.style.translate = `${(dx * 8).toFixed(1)}px ${(dy * 6).toFixed(1)}px`;
  }

  const zone = cible?.closest<HTMLElement>('[data-parallaxe]') ?? null;
  for (const p of parallaxes) {
    if (p !== zone) {
      p.style.setProperty('--px', '0');
      p.style.setProperty('--py', '0');
      parallaxes.delete(p);
    }
  }
  if (zone !== null) {
    const r = zone.getBoundingClientRect();
    zone.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    zone.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    parallaxes.add(zone);
  }
}

function onde(e: PointerEvent): void {
  const hote = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-onde]') : null;
  if (hote === null) return;
  const r = hote.getBoundingClientRect();
  const taille = Math.hypot(r.width, r.height) * 2;
  const anneau = document.createElement('span');
  anneau.className = 'v2-onde';
  anneau.setAttribute('aria-hidden', 'true');
  anneau.style.width = anneau.style.height = `${taille}px`;
  anneau.style.left = `${e.clientX - r.left - taille / 2}px`;
  anneau.style.top = `${e.clientY - r.top - taille / 2}px`;
  hote.append(anneau);
  anneau.addEventListener('animationend', () => anneau.remove(), { once: true });
}

let installe = false;

/** Installe les effets (une seule fois). Le pointeur est lu à chaque image au plus. */
export function installerLesEffets(): () => void {
  if (installe || !animationsActives()) return () => undefined;
  installe = true;
  let enAttente: PointerEvent | null = null;
  let image = 0;
  const auMouvement = (e: PointerEvent) => {
    enAttente = e;
    if (image === 0)
      image = requestAnimationFrame(() => {
        image = 0;
        if (enAttente !== null) suivre(enAttente);
      });
  };
  const aLaSortie = () => {
    relacher(verreActif, 'eclaire');
    verreActif = null;
  };
  // Le défilement de la page (elle défile dans la fenêtre) : --defil sert aux parallaxes au défilement.
  let imageDefil = 0;
  const auDefilement = (e: Event) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || el.scrollHeight < window.innerHeight) return;
    if (imageDefil === 0)
      imageDefil = requestAnimationFrame(() => {
        imageDefil = 0;
        document.documentElement.style.setProperty('--defil', String(Math.round(el.scrollTop)));
      });
  };
  document.addEventListener('scroll', auDefilement, { passive: true, capture: true });
  document.addEventListener('pointermove', auMouvement, { passive: true });
  document.addEventListener('pointerdown', onde, { passive: true });
  document.documentElement.addEventListener('pointerleave', aLaSortie);
  return () => {
    installe = false;
    document.removeEventListener('scroll', auDefilement, { capture: true });
    document.removeEventListener('pointermove', auMouvement);
    document.removeEventListener('pointerdown', onde);
    document.documentElement.removeEventListener('pointerleave', aLaSortie);
  };
}
