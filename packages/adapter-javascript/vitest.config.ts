import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      clean: false,
      cleanOnRerun: false,
      exclude: ['tests/**', 'vendor/**', 'dist/**', 'scripts/**', 'vitest.config.ts', 'src/types/**', 'src/javascript-adapter-factory.ts', 'src/javascript-debug-adapter.ts', 'coverage/**'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 }
    },
    alias: {
      // Handle .js extensions in imports (strip them)
      '^(\\.{1,2}/.+)\\.js$': '$1',
      // Workspace source aliases for local dev
      '@debugmcp/shared': path.resolve(__dirname, '../shared/src/index.ts')
    }
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.node'],
    alias: {
      '@debugmcp/shared': path.resolve(__dirname, '../shared/src/index.ts')
    }
  }
});
