// Seul passage entre la page et le cœur. La page ne voit ni Node, ni la clé, ni le disque.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('blazonCoeur', {
  appeler: (nom, args) => ipcRenderer.invoke('coeur', nom, args),
  ecouter: (rappel) => {
    const f = (_e, ev) => rappel(ev);
    ipcRenderer.on('coeur:evenement', f);
    return () => ipcRenderer.removeListener('coeur:evenement', f);
  },
  /** Chemin complet d'un fichier déposé dans la fenêtre (le navigateur ne donne que son nom). */
  cheminDuFichier: (fichier) => {
    try { return webUtils.getPathForFile(fichier); } catch { return ''; }
  },
});
