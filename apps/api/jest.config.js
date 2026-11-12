/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
  // Jest não carrega ESM via require: usa o código-fonte do pacote de contratos.
  moduleNameMapper: {
    '^@baldeacao/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@baldeacao/types/examples$': '<rootDir>/../../packages/types/src/__examples__.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageDirectory: './coverage',
};
