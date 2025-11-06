#!/usr/bin/env node
/**
 * Publishable CLI shim for npx usage.
 * Preserves critical stdio console silencing and delegates to the existing main() implementation.
 */

// CRITICAL: Console silencing MUST be first - before ANY imports
// This prevents stdout pollution in transport modes (stdio/SSE) which breaks MCP protocol
(() => {
  const normalizeArg = (arg: unknown): string => typeof arg === 'string' ? arg.toLowerCase() : '';
  const stripQuotes = (value: string): string => value.replace(/^["']|["']$/g, '');
  const matchesKeyword = (arg: unknown, keyword: string): boolean => {
    const normalized = stripQuotes(normalizeArg(arg));
    if (normalized === keyword) {
      return true;
    }
    const pattern = new RegExp(`(?:^|[=:])${keyword}(?:$|\\b)`);
    return pattern.test(normalized);
  };

  // Handle both quoted and unquoted transport arguments
  const hasStdio = process.argv.some(arg => matchesKeyword(arg, 'stdio'));
  const hasSse = process.argv.some(arg => matchesKeyword(arg, 'sse'));

  // Auto-detect console silencing:
  // 1. Explicit stdio argument
  // 2. Explicit sse argument (JS debugging)
  // 3. Environment variable set
  // 4. No transport argument specified (default is STDIO)
  // 5. stdin is a pipe (typical for MCP STDIO mode)
  const hasTransportArg = process.argv.some(arg =>
    arg === '--transport' || arg.includes('transport')
  );
  const isStdinPipe = !process.stdin.isTTY;
  const shouldSilenceConsole = hasStdio ||
                               hasSse ||
                               process.env.CONSOLE_OUTPUT_SILENCED === '1' ||
                               (!hasTransportArg && isStdinPipe);

  if (shouldSilenceConsole) {
    // Set env flag immediately so any early imports see it
    process.env.CONSOLE_OUTPUT_SILENCED = '1';
    
    const noop = () => {};
    console.log = noop;
    console.error = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.trace = noop;
    console.dir = noop;
    console.table = noop;
    console.group = noop;
    console.groupEnd = noop;
    console.time = noop;
    console.timeEnd = noop;
    console.assert = noop;
    
    // Suppress process warnings
    process.removeAllListeners('warning');
    process.on('warning', noop);
  }
})();

// Clean argv before any code processes it - strip quotes from all arguments
process.argv = process.argv.map(arg => 
  typeof arg === 'string' ? arg.replace(/^["'](.*)["']$/, '$1') : arg
);

// Signal to the core entrypoint that the CLI shim will invoke main() explicitly.
process.env.DEBUG_MCP_SKIP_AUTO_START = '1';

// Import batteries-included module to ensure all adapters are bundled
import './batteries-included.js';

const bootstrap = async (): Promise<void> => {
  // Import and run the existing CLI main from the root source to avoid duplicating logic.
  // The bundler will include the referenced source so npx works standalone.
  const { main } = await import('../../../src/index.js');

  return Promise.resolve()
    .then(() => main())
    .catch((error) => {
      // When console is silenced, avoid writing to stdout/stderr
      if (process.env.CONSOLE_OUTPUT_SILENCED !== '1') {
        console.error('Fatal error:', error);
      }
      process.exit(1);
    });
};

bootstrap().catch((error) => {
    // When console is silenced, avoid writing to stdout/stderr
    if (process.env.CONSOLE_OUTPUT_SILENCED !== '1') {
      console.error('Fatal error:', error);
    }
    process.exit(1);
  });
