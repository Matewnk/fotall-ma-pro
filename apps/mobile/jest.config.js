/** @type {import('jest').Config} */
// Deux suites distinctes, incompatibles dans un seul preset : la couche
// offline (016) est du TypeScript pur testé en environnement Node
// (ts-jest), les écrans (017+) sont des composants React Native qui
// exigent le preset jest-expo (transform Babel spécifique RN, mocks des
// modules natifs). `projects` permet aux deux de cohabiter sous un seul
// `pnpm test`.
module.exports = {
  // Option globale (CLI-level), pas par-projet — voir jest.config.js
  // historique et le commentaire sur l'adaptateur LokiJS ci-dessous.
  forceExit: true,
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
      // Défaut Jest (5000ms) trop juste : ce projet tourne en parallèle du
      // projet "offline" (WatermelonDB/LokiJS, cold-start lui-même lent),
      // et sous contention CPU (observé en CI) le test entier peut dépasser
      // 5000ms alors même que le waitFor() interne n'a pas encore atteint
      // son propre délai — les deux budgets sont indépendants dans Jest.
      testTimeout: 15000,
    },
  ],
};
