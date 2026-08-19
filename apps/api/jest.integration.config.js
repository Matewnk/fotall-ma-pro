/** Tests d'integration : necessitent DATABASE_URL vers un Postgres reel. */
module.exports = {
  rootDir: 'src',
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts'],
  testTimeout: 30000,
};
