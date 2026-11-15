import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Les polices sont embarquées dans l'application : aucun appel à un serveur de polices.
// Inter avec son axe de taille optique : en grand, elle prend d'elle-même ses formes « Display »,
// plus fines et mieux espacées. C'est la police libre la plus proche de celle d'Apple (SF Pro).
import '@fontsource-variable/inter/opsz.css';
import './theme/jetons.css';
import './theme/base.css';
import { App } from './App';
import { BancDEssai } from './BancDEssai';
import { surveillerLesImages, VERSION_ARTEFACT } from './artefact/images';

const racine = document.getElementById('racine');
if (!racine) throw new Error('Élément #racine introuvable dans index.html.');

// `?banc` ouvre le banc d'essai du faux cœur (page de diagnostic, sans apparence).
const banc = new URLSearchParams(location.search).has('banc');

if (VERSION_ARTEFACT) surveillerLesImages();

createRoot(racine).render(<StrictMode>{banc ? <BancDEssai /> : <App />}</StrictMode>);
