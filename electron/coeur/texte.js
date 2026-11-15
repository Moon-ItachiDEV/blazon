// Textes venus de Steam : BBCode -> HTML sûr, texte brut, titre de tri.
// Portage fidèle de outils/generer_donnees.py, qui a fabriqué les données factices.
'use strict';

const BASE_ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets/';
const BASE_COMMUNAUTE = 'https://shared.akamai.steamstatic.com/community_assets/images/apps/';
const BASE_CLAN = 'https://clan.akamai.steamstatic.com/images/';

const echapper = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const echapperAttr = (s) => echapper(s).replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
function desechapper(s) {
  return s
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
}

function urlSure(u, appid) {
  u = desechapper(u).trim().replace(/^["']|["']$/g, '');
  u = u.replace('{STEAM_CLAN_IMAGE}', BASE_CLAN.replace(/\/$/, ''));
  if (appid) u = u.replace('{STEAM_APP_IMAGE}', `${BASE_ASSETS}steam/apps/${appid}`);
  return /^https:\/\/[^\s"'<>{}]+$/.test(u) ? echapperAttr(u) : null;
}

const SIMPLE = { b: 'strong', i: 'em', u: 'u', strike: 's', h1: 'h3', h2: 'h3', h3: 'h4', h4: 'h4', h5: 'h4', quote: 'blockquote', code: 'code', p: 'p', td: 'td', th: 'th', tr: 'tr', table: 'table' };
const CONNUES = 'p|b|i|u|strike|h[1-5]|list|olist|url|img|quote|code|table|tr|td|th|hr|spoiler|noparse|previewyoutube|video|carousel|dynamiclink|c|expand|center|color|size|pullquote|sticker|roomeffect';

function bbcodeVersHtml(texte, appid = null) {
  let t = texte.replace(/\r\n/g, '\n').replace(/\\\[/g, '\x00').replace(/\\\]/g, '\x01');
  t = echapper(t);
  t = t.replace(/\[img(?:\s+[^\]]*?src="?([^"\]\s]+)"?[^\]]*)?\](?:([^[]*)\[\/img\])?/gi, (_, a, b) => {
    const u = urlSure(a || b || '', appid);
    return u ? `<img src="${u}" loading="lazy" alt="">` : '';
  });
  const lien = (_, cible, contenu) => {
    const u = urlSure(cible, appid);
    return u ? `<a href="${u}" rel="noopener noreferrer">${contenu}</a>` : contenu;
  };
  t = t.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, lien);
  t = t.replace(/\[dynamiclink\s+href=([^\]]+)\]([\s\S]*?)\[\/dynamiclink\]/gi, (m, a, b) => (b.trim() ? lien(m, a, b) : ''));
  t = t.replace(/\[url\]([^[]*)\[\/url\]/gi, (_, a) => {
    const u = urlSure(a, appid);
    return u ? `<a href="${u}" rel="noopener noreferrer">${a}</a>` : a;
  });
  t = t.replace(/\[previewyoutube="?([\w-]+)[^\]]*\]\s*\[\/previewyoutube\]/gi, '<p><a href="https://www.youtube.com/watch?v=$1" rel="noopener noreferrer">YouTube</a></p>');
  t = t.replace(/\[(o?)list\]/gi, (_, o) => (o ? '<ol>' : '<ul>'));
  t = t.replace(/\[\/(o?)list\]/gi, (_, o) => (o ? '</li></ol>' : '</li></ul>'));
  t = t.replace(/\[\*\]/g, '</li><li>').replace(/\[\/\*\]/g, '');
  t = t.replace(/<(ul|ol)>\s*<\/li>/g, '<$1>');
  for (const [bb, balise] of Object.entries(SIMPLE)) {
    t = t.replace(new RegExp(`\\[${bb}(?:[\\s=][^\\]]*)?\\]`, 'gi'), `<${balise}>`);
    t = t.replace(new RegExp(`\\[/${bb}\\]`, 'gi'), `</${balise}>`);
  }
  t = t.replace(/\[hr\]\s*(\[\/hr\])?/gi, '<hr>');
  t = t.replace(new RegExp(`\\[/?(?:${CONNUES})(?:[\\s=][^\\]\\n]*)?\\]`, 'gi'), '');
  t = t.replace(/\x00/g, '[').replace(/\x01/g, ']');
  t = t.trim().replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
  const blocs = 'ul|ol|li|h3|h4|p|table|tr|td|th|blockquote|hr';
  t = t.replace(new RegExp(`(<br>\\s*)+(</?(?:${blocs})>)`, 'g'), '$2');
  t = t.replace(new RegExp(`(</?(?:${blocs})>)(\\s*<br>)+`, 'g'), '$1');
  t = t.replace(/<(p|li|strong|em|u|h3|h4)>\s*<\/\1>/g, '').replace(/<(p|li)>\s*<\/\1>/g, '');
  return t;
}

function texteBrut(h, longueur = 220) {
  let t = h.replace(/<p><a [^>]*>YouTube<\/a><\/p>/g, '');
  t = t.replace(/<(br|\/p|\/li|\/h3|\/h4|\/td)>/g, ' ');
  t = desechapper(t.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (t.length <= longueur) return t;
  const coupe = t.slice(0, longueur);
  const espace = coupe.lastIndexOf(' ');
  return (espace > 0 ? coupe.slice(0, espace) : coupe) + '…';
}

const ARTICLES = /^(the|a|an|le|la|les|l'|un|une|des)\s+/i;
function titreTri(titre) {
  let t = titre.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/[®™©]/g, '').toLowerCase().trim().replace(ARTICLES, '');
  t = t.replace(/[^a-z0-9]+/g, ' ').trim();
  return t || titre.toLowerCase();
}

/** Adresse d'un visuel du magasin à partir de `assets` de GetItems. */
function urlAsset(assets, nom) {
  if (!assets || !assets[nom] || !assets.asset_url_format) return null;
  return BASE_ASSETS + assets.asset_url_format.replace('${FILENAME}', assets[nom]);
}

module.exports = { bbcodeVersHtml, texteBrut, titreTri, urlAsset, BASE_ASSETS, BASE_COMMUNAUTE, BASE_CLAN };
