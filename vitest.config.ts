import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/vitest.setup.ts'],
    // Include all test files from both main project and packages
    include: [
      'tests/**/*.{test,spec}.ts',
      'src/**/*.{test,spec}.ts',
      'packages/**/tests/**/*.{test,spec}.ts',
      'packages/**/src/**/*.{test,spec}.ts'
    ],
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '**/node_modules/**',
      '**/dist/**'
    ],
    // Reporter configuration
    reporters: process.env.CI ? ['dot'] : ['default'],
    outputFile: {
      json: './test-results.json'
    },
    // Console filtering for noise reduction
    onConsoleLog(log: string, type: 'stdout' | 'stderr'): boolean | void {
      // Whitelist - Always show important patterns
      const importantPatterns = [
        'FAIL', 
        'Error:', 
        'AssertionError', 
        'Expected', 
        'Received', 
        'Test suite failed',
        'TypeError',
        'ReferenceError'
      ];
      if (importantPatterns.some(pattern => log.includes(pattern))) {
        return true;
      }
      
      // Noise patterns to filter
      const noisePatterns = [
        'vite:', 
        'webpack', 
        '[HMR]', 
        'Download the', 
        'Debugger listening', 
        'Waiting for the debugger',
        'Python path:', 
        'spawn', 
        '[esbuild]', 
        'transforming',
        'node_modules',
        'has been externalized',
        '[MCP Server]',
        '[debug-mcp]',
        '[ProxyManager',
        '[SessionManager]',
        '[SM _updateSessionState',
        'stdout |',
        'stderr |',
        '2025-', // Date timestamps
        '[info]',
        '[debug]',
        '[warn]'
      ];
      
      if (noisePatterns.some(pattern => log.includes(pattern))) {
        return false;
      }
      
      // In test files, allow user's console.log statements
      if (log.includes('.test.') || log.includes('.spec.')) {
        return true;
      }
      
      // Default: suppress stdout info/debug, keep stderr
      return type === 'stderr';
    },
    // Disable file parallelism for cleaner output
    fileParallelism: false,
    coverage: {
      provider: 'istanbul', // Changed from 'v8' to 'istanbul'
      reporter: ['text', 'json', 'html', 'json-summary'], // Added 'json-summary' for coverage-summary.json
      reportsDirectory: './coverage',
      reportOnFailure: true,
      exclude: [
        'node_modules',
        'dist',
        'tests',
        'packages/**/tests',
        'src/proxy/proxy-bootstrap.js',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        // Type-only files - no executable code
        'src/container/types.ts',
        'src/dap-core/types.ts',
        // Mock adapter process - tested via e2e tests, runs as separate process
        'src/adapters/mock/mock-adapter-process.ts'
      ],
      include: ['src/**/*.ts', 'packages/**/src/**/*.ts']
    },
    testTimeout: 30000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Important for process spawning tests
        maxThreads: 1,
        minThreads: 1
      }
    },
    testTransformMode: {
      web: ['src/**/*.ts', 'packages/**/src/**/*.ts'] // Ensure TypeScript files in src are transformed
    },
    // Module name mapper equivalent
    alias: {
      // Handle .js extensions in imports (strip them)
      '^(\\.{1,2}/.+)\\.js$': '$1',
      // Handle absolute imports with .js extension
      '^(src/.+)\\.js$': path.resolve(__dirname, '$1'),
      '@/': path.resolve(__dirname, './src'),
      '../../src/(.*)': path.resolve(__dirname, './src/$1.ts'), // Direct alias for relative imports to src
      // Add support for @debugmcp/shared package
      '@debugmcp/shared': path.resolve(__dirname, './packages/shared/src/index.ts')
    }
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.node'], // Add .ts for resolution
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@debugmcp/shared': path.resolve(__dirname, './packages/shared/src/index.ts')
    }
  },
  // Handle ESM modules that need to be transformed
  optimizeDeps: {
    include: ['@modelcontextprotocol/sdk', '@vscode/debugadapter', '@vscode/debugprotocol']
  }
});
