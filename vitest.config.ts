import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/jest.setupAfterEnv.ts'],
    coverage: {
      provider: 'istanbul', // Changed from 'v8' to 'istanbul'
      reporter: ['text', 'json', 'html', 'json-summary'], // Added 'json-summary' for coverage-summary.json
      reportsDirectory: './coverage',
      reportOnFailure: true,
      exclude: [
        'node_modules',
        'dist',
        'tests',
        'src/proxy/proxy-bootstrap.js',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      include: ['src/**/*.ts']
    },
    testTimeout: 30000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true // Important for process spawning tests
      }
    },
    // Module name mapper equivalent
    alias: {
      // Handle .js extensions in imports (strip them)
      '^(\\.{1,2}/.+)\\.js$': '$1',
      // Handle absolute imports with .js extension
      '^(src/.+)\\.js$': path.resolve(__dirname, '$1'),
      '@/': path.resolve(__dirname, './src')
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // Handle ESM modules that need to be transformed
  optimizeDeps: {
    include: ['@modelcontextprotocol/sdk', '@vscode/debugadapter', '@vscode/debugprotocol']
  }
});
