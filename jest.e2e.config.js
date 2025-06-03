// @ts-check
import baseConfig from './jest.base.config.js';

export default {
  ...baseConfig,
  collectCoverage: false, // Disable Jest's own coverage when using c8
  // Remove moduleNameMapper override; inherit from baseConfig.
  // If tsc correctly resolves paths in dist/, this override might not be needed
  // or could interfere with coverage mapping if test files use @/ to import from src/.
  // moduleNameMapper: {
  //   ...baseConfig.moduleNameMapper,
  //   '^@/(.*)$': '<rootDir>/dist/$1',
  // },
  testMatch: [ // Override testMatch to be specific to e2e tests
    '**/tests/e2e/**/*.test.ts',
    '**/tests/e2e/**/*.spec.ts'
  ],
  // E2E tests typically run against compiled JS.
  // The base transform for .ts files is still useful for any .ts test helpers.
};
