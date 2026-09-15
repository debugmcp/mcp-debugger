import { describe, it, expect, afterEach, vi } from 'vitest';
import { JavascriptDebugAdapter } from '../../src/index.js';

// Minimal AdapterDependencies stub — fileSystem reports the vendored js-debug as
// present so these tests stay hermetic (no dependency on a real vendor/ dir).
const deps = {
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {}
  },
  fileSystem: {
    existsSync: () => true,
    pathExists: async () => true
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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('does not hand the js-debug adapter process an inherited exit-code shim env (issue #731)', () => {
    // A nested server inherits the outer session's shim triplet; the adapter
    // process it spawns must not carry it either, or js-debug's env overlay
    // re-supplies the outer claim/file to every inner debuggee
    const adapter = new JavascriptDebugAdapter(deps);
    vi.stubEnv('NODE_OPTIONS', '--require "/outer/bootloader.js" --require "/prior/exitcode-shim.cjs"');
    vi.stubEnv('MCP_DEBUGGER_EXITCODE_FILE', '/outer/session/exit.txt');
    vi.stubEnv('MCP_DEBUGGER_EXITCODE_CLAIMED', '1');

    const cmd = adapter.buildAdapterCommand(baseConfig);

    expect(cmd.env?.NODE_OPTIONS).not.toContain('exitcode-shim');
    expect(cmd.env?.NODE_OPTIONS).toContain('--require "/outer/bootloader.js"');
    expect(cmd.env?.NODE_OPTIONS).toContain('--max-old-space-size=4096');
    expect(cmd.env?.MCP_DEBUGGER_EXITCODE_FILE).toBeUndefined();
    expect(cmd.env?.MCP_DEBUGGER_EXITCODE_CLAIMED).not.toBe('1');
  });

  it('repeated calls are stable when NODE_OPTIONS already includes max-old-space-size (normalize whitespace once, no duplication)', () => {
    const adapter = new JavascriptDebugAdapter(deps);
    vi.stubEnv('NODE_OPTIONS', '   --MAX-OLD-SPACE-SIZE=2048    --trace-warnings   ');

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
    vi.stubEnv('NODE_OPTIONS', '    --experimental-repl-await    --trace-warnings   ');

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
    vi.stubEnv('NODE_OPTIONS', undefined);

    const first = adapter.buildAdapterCommand(baseConfig);
    const second = adapter.buildAdapterCommand(baseConfig);

    expect(first.env?.NODE_OPTIONS).toBe('--max-old-space-size=4096');
    expect(second.env?.NODE_OPTIONS).toBe('--max-old-space-size=4096');
    expect(process.env.NODE_OPTIONS).toBeUndefined();
  });
});
