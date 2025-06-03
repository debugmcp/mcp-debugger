// @ts-check
import baseConfig from './jest.base.config.js';

export default {
  ...baseConfig,
  // Unit-specific overrides can go here if needed in the future
  // For now, it uses the base config which is already set up for unit tests
  // (e.g., moduleNameMapper for @/ pointing to src/)
  testMatch: [ // Override testMatch to be specific to unit tests
    '**/tests/unit/**/*.test.ts',
    '**/tests/unit/**/*.spec.ts'
  ],
};
