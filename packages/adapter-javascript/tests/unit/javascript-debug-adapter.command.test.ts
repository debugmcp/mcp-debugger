import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

import { JavascriptDebugAdapter } from '../../src/index.js';

// Helper to normalize paths for cross-platform assertions
function norm(p: unknown): string {
  return typeof p === 'string' ? p.replace(/\\+/g, '/') : '';
}
function isVendorPath(p: unknown): boolean {
  return norm(p).endsWith('/vendor/js-debug/vsDebugServer.cjs');
}

// Minimal AdapterDependencies stub (adapter does not use dependencies in buildAdapterCommand)
const deps = {
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {}
  },
  // Cast to satisfy type system in tests
} as unknown as import('@debugmcp/shared').AdapterDependencies;

describe('JavascriptDebugAdapter.buildAdapterCommand (stdio)', () => {
  const isWin = process.platform === 'win32';
  const fakeNode = isWin ? 'C:\\\\node\\\\node.exe' : '/usr/bin/node';

  const defaultConfig = {
    sessionId: 'test-session',
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

  it('produces correct command and args', () => {
    const adapter = new JavascriptDebugAdapter(deps);


    const cmd = adapter.buildAdapterCommand(defaultConfig);

    // Command equals the provided Node path (absolute)
    expect(cmd.command).toBe(fakeNode);

    // Args: [adapterPath, "--stdio"]
    expect(Array.isArray(cmd.args)).toBe(true);
    expect(cmd.args.length).toBeGreaterThanOrEqual(2);
    // Second argument should be the TCP port number
    expect(cmd.args[1]).toBe(String(defaultConfig.adapterPort));
    expect(Number(cmd.args[1])).toBe(defaultConfig.adapterPort);

    // adapterPath ends with vendor/js-debug/vsDebugServer.cjs
    const adapterPath = cmd.args[0];
    expect(typeof adapterPath).toBe('string');
    expect(isVendorPath(adapterPath)).toBe(true);

    // Ensure adapterPath is absolute
    expect(path.isAbsolute(adapterPath as string)).toBe(true);
  });

  it('environment includes NODE_OPTIONS and does not mutate process.env', () => {
    const adapter = new JavascriptDebugAdapter(deps);

    const before = process.env.NODE_OPTIONS;
    const cmd = adapter.buildAdapterCommand(defaultConfig);

    // Returned env is a plain object with string values only
    expect(cmd.env).toBeDefined();
    expect(typeof cmd.env).toBe('object');
    expect(typeof cmd.env!.NODE_OPTIONS).toBe('string');

    // Should contain the memory flag
    expect(cmd.env!.NODE_OPTIONS!.includes('--max-old-space-size=4096')).toBe(true);

    // process.env remains unchanged
    expect(process.env.NODE_OPTIONS).toBe(before);
  });

  it('preserves and appends existing NODE_OPTIONS when memory flag missing (single space separation)', () => {
    const adapter = new JavascriptDebugAdapter(deps);

    process.env.NODE_OPTIONS = '--experimental-repl-await';
    const cmd = adapter.buildAdapterCommand(defaultConfig);

    // Should contain both flags, with a single space separation and trimmed
    expect(cmd.env!.NODE_OPTIONS).toBe('--experimental-repl-await --max-old-space-size=4096');

    // process.env remains unchanged
    expect(process.env.NODE_OPTIONS).toBe('--experimental-repl-await');
  });

  it('is idempotent: multiple calls do not duplicate --max-old-space-size', () => {
    const adapter = new JavascriptDebugAdapter(deps);

    // Start with no NODE_OPTIONS
    delete (process.env as Record<string, string | undefined>).NODE_OPTIONS;

    const first = adapter.buildAdapterCommand(defaultConfig);
    const second = adapter.buildAdapterCommand(defaultConfig);

    const countFlag = (s: string | undefined) =>
      (s?.match(/--max-old-space-size=4096/gi) || []).length;

    expect(countFlag(first.env!.NODE_OPTIONS)).toBe(1);
    expect(countFlag(second.env!.NODE_OPTIONS)).toBe(1);
  });

  it('does not override when NODE_OPTIONS already includes a max-old-space-size (any value, case-insensitive)', () => {
    const adapter = new JavascriptDebugAdapter(deps);

    process.env.NODE_OPTIONS = '--MAX-OLD-SPACE-SIZE=2048   --trace-warnings';
    const cmd = adapter.buildAdapterCommand(defaultConfig);

    // Should not append another max-old-space-size; should normalize spaces
    expect(cmd.env!.NODE_OPTIONS).toBe('--MAX-OLD-SPACE-SIZE=2048 --trace-warnings');

    // process.env remains unchanged
    expect(process.env.NODE_OPTIONS).toBe('--MAX-OLD-SPACE-SIZE=2048   --trace-warnings');
  });
});
