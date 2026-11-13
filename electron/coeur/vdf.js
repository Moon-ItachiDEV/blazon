// Lecture des fichiers texte « KeyValues » de Steam (libraryfolders.vdf, appmanifest_*.acf,
// loginusers.vdf, localconfig.vdf). Les clés de Steam ne respectent pas toujours la casse :
// `cle()` les cherche sans en tenir compte.
'use strict';

function lireVdf(texte) {
  let i = 0;
  const n = texte.length;
  function blancs() {
    while (i < n) {
      const c = texte[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '﻿') { i++; continue; }
      if (c === '/' && texte[i + 1] === '/') { while (i < n && texte[i] !== '\n') i++; continue; }
      break;
    }
  }
  function chaine() {
    if (texte[i] === '"') {
      i++;
      let s = '';
      while (i < n && texte[i] !== '"') {
        if (texte[i] === '\\' && i + 1 < n) {
          const c = texte[i + 1];
          s += c === 'n' ? '\n' : c === 't' ? '\t' : c;
          i += 2;
        } else s += texte[i++];
      }
      i++;
      return s;
    }
    let s = '';
    while (i < n && !/[\s{}"]/.test(texte[i])) s += texte[i++];
    return s;
  }
  function objet() {
    const o = {};
    for (;;) {
      blancs();
      if (i >= n) return o;
      if (texte[i] === '}') { i++; return o; }
      const k = chaine();
      blancs();
      // Conditions de plateforme ([$WIN32]) : ignorées.
      if (texte[i] === '[') { while (i < n && texte[i] !== ']') i++; i++; blancs(); }
      if (texte[i] === '{') { i++; o[k] = objet(); } else o[k] = chaine();
      blancs();
      if (texte[i] === '[') { while (i < n && texte[i] !== ']') i++; i++; }
    }
  }
  return objet();
}

/** Valeur d'une clé sans tenir compte de la casse, en suivant un chemin : cle(o, 'a', 'b'). */
function cle(objet, ...chemin) {
  let o = objet;
  for (const nom of chemin) {
    if (o === null || typeof o !== 'object') return undefined;
    if (nom in o) { o = o[nom]; continue; }
    const bas = nom.toLowerCase();
    const trouve = Object.keys(o).find((k) => k.toLowerCase() === bas);
    o = trouve === undefined ? undefined : o[trouve];
  }
  return o;
}

module.exports = { lireVdf, cle };
