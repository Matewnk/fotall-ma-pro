/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // L'adaptateur LokiJS de WatermelonDB (utilisé uniquement en test, voir
  // db/test-adapter.ts) garde un timer interne actif même après la fin
  // des tests — comportement connu de la librairie en environnement
  // Node/Jest, sans impact sur la justesse des tests.
  forceExit: true,
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
};
