import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// La police (DM Sans) est embarquée par base.css : aucun appel à un serveur de polices.
import './theme/jetons.css';
import './theme/base.css';
import './theme/effets.css';
import { App } from './App';
import { BancDEssai } from './BancDEssai';
import { surveillerLesImages, VERSION_ARTEFACT } from './artefact/images';

const racine = document.getElementById('racine');
if (!racine) throw new Error('Élément #racine introuvable dans index.html.');

// `?banc` ouvre le banc d'essai du faux cœur (page de diagnostic, sans apparence).
const banc = new URLSearchParams(location.search).has('banc');

if (VERSION_ARTEFACT) surveillerLesImages();

createRoot(racine).render(<StrictMode>{banc ? <BancDEssai /> : <App />}</StrictMode>);
