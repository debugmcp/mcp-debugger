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
        'ReferenceError',
        '[Discovery Test]',
        '[Workflow Test]',
        '[Test Server]',
        '[env-utils]'
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
        '20', // Date timestamps (matches 2025-, 2026-, etc.)
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
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'json-summary'],
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
        'src/adapters/mock/mock-adapter-process.ts',
        'packages/adapter-mock/src/mock-adapter-process.ts',
        // CLI entry points - handle process-level stdio, not unit-testable
        'packages/mcp-debugger/src/cli-entry.ts',
        'packages/mcp-debugger/dist/packages/mcp-debugger/src/cli-entry.js',
        // Module init side-effects only (import statements that register adapters)
        'packages/mcp-debugger/src/batteries-included.ts',
        // Script entry point — process.argv parsing only, logic in netcoredbg-bridge-core.ts
        'packages/adapter-dotnet/src/utils/netcoredbg-bridge.ts',
        // Error definitions - mostly class constructors and type guards
        'src/errors/debug-errors.ts',
        // Proxy entry point - separate process
        'src/proxy/dap-proxy-entry.ts',
        // Factory pattern files with minimal logic
        'packages/shared/src/factories/adapter-factory.ts',
        // Exclude barrel export index files to prevent duplicate coverage
        'packages/shared/src/index.ts',
        'packages/shared/src/models/index.ts'
      ],
      include: ['src/**/*.{ts,js}', 'packages/**/src/**/*.{ts,js}']
    },
    testTimeout: 30000,
    maxWorkers: 1, // Required for process spawning tests
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.node'], // Resolve TypeScript sources directly
    alias: [
      // Map relative imports ending with .js to .ts (e.g., ../../../src/foo.js -> ../../../src/foo.ts)
      { find: /^(\.{1,2}\/.+)\.js$/, replacement: '$1.ts' },
      
      // Map absolute src imports ending with .js to .ts
      { find: /^(src\/.+)\.js$/, replacement: path.resolve(__dirname, './$1.ts') },
      
      // Keep project aliases pointing to TS sources
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@debugmcp/shared', replacement: path.resolve(__dirname, './packages/shared/src/index.ts') },
      { find: '@debugmcp/adapter-mock', replacement: path.resolve(__dirname, './packages/adapter-mock/src/index.ts') },
      { find: '@debugmcp/adapter-python', replacement: path.resolve(__dirname, './packages/adapter-python/src/index.ts') },
      { find: '@debugmcp/adapter-javascript', replacement: path.resolve(__dirname, './packages/adapter-javascript/src/index.ts') },
      { find: '@debugmcp/adapter-go', replacement: path.resolve(__dirname, './packages/adapter-go/src/index.ts') },
      { find: '@debugmcp/adapter-rust', replacement: path.resolve(__dirname, './packages/adapter-rust/src/index.ts') },
      { find: '@debugmcp/adapter-java', replacement: path.resolve(__dirname, './packages/adapter-java/src/index.ts') },
      { find: '@debugmcp/adapter-dotnet', replacement: path.resolve(__dirname, './packages/adapter-dotnet/src/index.ts') }
    ]
  },
  // Handle ESM modules that need to be transformed
  optimizeDeps: {
    include: ['@modelcontextprotocol/sdk', '@vscode/debugprotocol']
  }
});
