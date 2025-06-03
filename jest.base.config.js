// @ts-check
export default {
  preset: 'ts-jest/presets/default-esm',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s?(x)',
    '**/tests/manual/**/*.test.ts' // Made specific to .test.ts to avoid .d.ts
  ],
  verbose: true,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts', // Typically entry point, might not need direct test
    '!src/proxy/proxy-bootstrap.js' // This is a JS bootstrap file, not TS
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'json-summary'], // Added json-summary for easier parsing
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // Point @/ alias to src/ for unit tests
    // Re-add mapper for .js extensions in relative imports to point to the .ts source
    '^(\\.{1,2}/.+)\\.js$': '$1'
    // Removed explicit map for @vscode/debugadapter
  },
  transform: {
    // Transform TypeScript files with ESM support
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        // isolatedModules: true, // Rely on tsconfig.json for this setting
        mapCoverage: true, // Add this to map coverage from JS back to TS sources
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: ['node_modules'], // Reverted to default
  setupFilesAfterEnv: ['./tests/jest.setupAfterEnv.ts'], // Moved from setupFiles
  testTimeout: 15000, // Increasing default timeout to 15 seconds
  // globals section for ts-jest is deprecated
};
