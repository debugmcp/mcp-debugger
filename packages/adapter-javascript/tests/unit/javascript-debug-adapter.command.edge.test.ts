import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JavascriptDebugAdapter } from '../../src/index.js';

// Minimal AdapterDependencies stub
const deps = {
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {}
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

function isVendorPath(p: unknown): boolean {
  return typeof p === 'string' && (p as string).replace(/\\+/g, '/').endsWith('/vendor/js-debug/vsDebugServer.cjs');
}

describe('JavascriptDebugAdapter.buildAdapterCommand (edge/env stability)', () => {
  const isWin = process.platform === 'win32';
  const fakeNode = isWin ? 'C:\\\\node\\\\node.exe' : '/usr/bin/node';

  const baseConfig = {
    sessionId: 'sess',
    executablePath: fakeNode,
    adapterHost: '127.0.0.1',
    adapterPort: 12345,
    logDir: isWin ? 'C:\\\\tmp\\\\logs' : '/tmp/logs',
    scriptPath: isWin ? 'C:\\\\tmp\\\\app.js' : '/tmp/app.js',
    launchConfig: {}
  } as unknown as import('@debugmcp/shared').AdapterConfig;

  let originalNodeOptions: string | undefined;

  beforeEach(() => {
    originalNodeOptions = process.env.NODE_OPTIONS;
  });

  afterEach(() => {
    if (typeof originalNodeOptions === 'string') {
      process.env.NODE_OPTIONS = originalNodeOptions;
    } else {
      delete (process.env as Record<string, string | undefined>).NODE_OPTIONS;
    }
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('repeated calls are stable when NODE_OPTIONS already includes max-old-space-size (normalize whitespace once, no duplication)', () => {
    const adapter = new JavascriptDebugAdapter(deps);
    process.env.NODE_OPTIONS = '   --MAX-OLD-SPACE-SIZE=2048    --trace-warnings   ';

    const first = adapter.buildAdapterCommand(baseConfig);
    const second = adapter.buildAdapterCommand(baseConfig);
    const third = adapter.buildAdapterCommand(baseConfig);

    // Adapter path sanity
    expect(isVendorPath(first.args?.[0])).toBe(true);

    // Normalized once to single spaces and trimmed; identical across calls
    expect(first.env?.NODE_OPTIONS).toBe('--MAX-OLD-SPACE-SIZE=2048 --trace-warnings');
    expect(second.env?.NODE_OPTIONS).toBe('--MAX-OLD-SPACE-SIZE=2048 --trace-warnings');
    expect(third.env?.NODE_OPTIONS).toBe('--MAX-OLD-SPACE-SIZE=2048 --trace-warnings');

    // process.env untouched
    expect(process.env.NODE_OPTIONS).toBe('   --MAX-OLD-SPACE-SIZE=2048    --trace-warnings   ');
  });

  it('repeated calls are stable when NODE_OPTIONS missing memory flag (append once, normalize whitespace)', () => {
    const adapter = new JavascriptDebugAdapter(deps);
    process.env.NODE_OPTIONS = '    --experimental-repl-await    --trace-warnings   ';

    const first = adapter.buildAdapterCommand(baseConfig);
    const second = adapter.buildAdapterCommand(baseConfig);

    // Should contain both flags, single spaces, no duplication across calls
    const expected = '--experimental-repl-await --trace-warnings --max-old-space-size=4096';
    expect(first.env?.NODE_OPTIONS).toBe(expected);
    expect(second.env?.NODE_OPTIONS).toBe(expected);

    // process.env untouched
    expect(process.env.NODE_OPTIONS).toBe('    --experimental-repl-await    --trace-warnings   ');
  });

  it('empty NODE_OPTIONS stays stable across repeated calls (single memory flag only)', () => {
    const adapter = new JavascriptDebugAdapter(deps);
    delete (process.env as Record<string, string | undefined>).NODE_OPTIONS;

    const first = adapter.buildAdapterCommand(baseConfig);
    const second = adapter.buildAdapterCommand(baseConfig);

    expect(first.env?.NODE_OPTIONS).toBe('--max-old-space-size=4096');
    expect(second.env?.NODE_OPTIONS).toBe('--max-old-space-size=4096');
    expect(process.env.NODE_OPTIONS).toBeUndefined();
  });
});
