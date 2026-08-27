// Config monorepo Expo (https://docs.expo.dev/guides/monorepos/), restreinte
// au store pnpm plutot qu'a tout le workspace (evite de faire crawler a
// Metro les node_modules des autres apps du monorepo, beaucoup plus lourd
// et lent au demarrage sans rien apporter ici) : pnpm range les paquets
// dans .pnpm/ et ne cree que des liens symboliques dans node_modules --
// le watcher de Metro n'indexe jamais les fichiers reels a l'autre bout
// du lien sans watchFolders explicite, d'ou "Unable to resolve module"
// meme pour un paquet present en dependance directe (ex: expo/AppEntry).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(workspaceRoot, 'node_modules', '.pnpm')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
