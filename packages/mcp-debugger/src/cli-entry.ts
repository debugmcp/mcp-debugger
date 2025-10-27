#!/usr/bin/env node
/**
 * Publishable CLI shim for npx usage.
 * Preserves critical stdio console silencing and delegates to the existing main() implementation.
 */

// CRITICAL: Console silencing MUST be first - before ANY imports
// This prevents stdout pollution in stdio mode which breaks MCP protocol
(() => {
  // Handle both quoted and unquoted stdio arguments
  const hasStdio = process.argv.some(arg =>
    arg === 'stdio' ||
    arg === '"stdio"' ||
    arg === '"\'stdio\'"' ||
    arg.includes('stdio')
  );

  // Auto-detect STDIO mode:
  // 1. Explicit stdio argument
  // 2. Environment variable set
  // 3. No transport argument specified (default is STDIO)
  // 4. stdin is a pipe (typical for MCP STDIO mode)
  const hasTransportArg = process.argv.some(arg =>
    arg === '--transport' || arg.includes('transport')
  );
  const isStdinPipe = !process.stdin.isTTY;
  const shouldSilenceConsole = hasStdio ||
                               process.env.DEBUG_MCP_STDIO === '1' ||
                               (!hasTransportArg && isStdinPipe);

  if (shouldSilenceConsole) {
    // Set env flag immediately so any early imports see it
    if (hasStdio || shouldSilenceConsole) {
      process.env.DEBUG_MCP_STDIO = '1';
    }
    
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
      // In stdio mode, we must not write to console
      const isStdio = process.argv.includes('stdio') || process.env.DEBUG_MCP_STDIO === '1';
      if (!isStdio) {
        console.error('Fatal error:', error);
      }
      process.exit(1);
    });
};

bootstrap().catch((error) => {
    // In stdio mode, we must not write to console
    const isStdio = process.argv.includes('stdio') || process.env.DEBUG_MCP_STDIO === '1';
    if (!isStdio) {
      console.error('Fatal error:', error);
    }
    process.exit(1);
  });
