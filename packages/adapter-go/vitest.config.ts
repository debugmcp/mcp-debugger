import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
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
