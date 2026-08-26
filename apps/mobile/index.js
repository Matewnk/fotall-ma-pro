// Remplace `import 'expo/AppEntry'` : ce fichier fait un import relatif
// `../../App` depuis SON propre emplacement -- avec unstable_enableSymlinks
// active pour resoudre correctement pnpm (metro.config.js), Metro suit le
// chemin physique reel du paquet (dans .pnpm/), pas le lien symbolique, et
// "../../App" pointe alors deux niveaux au-dessus de .pnpm/ au lieu de la
// racine de ce projet. Reproduit directement la logique d'AppEntry.js
// (registerRootComponent(App)) avec un import relatif a CE fichier.
import registerRootComponent from 'expo/build/launch/registerRootComponent';

import App from './App';

registerRootComponent(App);
