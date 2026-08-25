/** @type {import('jest').Config} */
// Deux suites distinctes, incompatibles dans un seul preset : la couche
// offline (016) est du TypeScript pur testé en environnement Node
// (ts-jest), les écrans (017+) sont des composants React Native qui
// exigent le preset jest-expo (transform Babel spécifique RN, mocks des
// modules natifs). `projects` permet aux deux de cohabiter sous un seul
// `pnpm test`.
module.exports = {
  // Options globales (CLI-level) : Jest refuse silencieusement
  // ("Unknown option") toute option qui n'est pas per-projet à
  // l'intérieur d'une entrée de `projects` — forceExit et testTimeout en
  // font partie. Elles doivent rester ici, au niveau racine, et
  // s'appliquent aux deux projets — sans risque pour "offline", dont les
  // tests sont bien plus rapides que ce plafond.
  //
  // 30000ms (pas 15000) : le premier fichier de test du projet "screens"
  // à s'exécuter dans un worker Jest paie le coût de transform/chargement
  // à froid de toute la chaîne jest-expo/Babel/React Native (mesuré
  // localement à ~15.8s avec un cache Jest vidé, `jest --clearCache`) —
  // en CI, où chaque run repart sans cache persistant, ce coût à froid
  // est systématique, pas occasionnel. Sans rapport avec la lenteur du
  // cold-start LokiJS du projet "offline" (déjà documentée séparément).
  forceExit: true,
  testTimeout: 30000,
  projects: [
    {
      displayName: 'offline',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testRegex: '.*\\.spec\\.ts$',
      setupFiles: ['<rootDir>/jest.setup.ts'],
      transform: {
        '^.+\\.ts$': [
          'ts-jest',
          {
            tsconfig: {
              module: 'CommonJS',
              moduleResolution: 'Node',
              experimentalDecorators: true,
              useDefineForClassFields: false,
            },
          },
        ],
      },
    },
    {
      displayName: 'screens',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/screens/**/*.test.tsx'],
      // Le transformIgnorePatterns par défaut de jest-expo suppose une
      // structure node_modules à plat (npm/yarn) : "node_modules/(?!pkg)".
      // pnpm imbrique chaque paquet sous node_modules/.pnpm/pkg@version/
      // node_modules/pkg/... — le premier segment "node_modules/.pnpm/"
      // matche déjà le motif d'exclusion par défaut avant d'atteindre le
      // vrai nom de paquet, donc react-native et ses dépendances (Flow
      // typé) ne sont jamais transformées. Motif réécrit sans dépendre de
      // la position du segment "node_modules/" : recherche le nom de
      // paquet n'importe où plus loin dans le chemin plutôt qu'immédiatement
      // après "node_modules/".
      transformIgnorePatterns: [
        'node_modules/(?!.*(react-native|expo|react-navigation|unimodules|sentry-expo|native-base|watermelondb))',
      ],
    },
  ],
};
