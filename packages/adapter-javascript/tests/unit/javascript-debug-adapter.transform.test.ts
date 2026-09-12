import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';

// Mocks for helper modules used by transformLaunchConfig
vi.mock('../../src/utils/config-transformer.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/config-transformer.js')>(
    '../../src/utils/config-transformer.js'
  );
  return {
    ...actual,
    isESMProject: vi.fn(actual.isESMProject),
    hasTsConfigPaths: vi.fn(actual.hasTsConfigPaths),
    determineOutFiles: vi.fn(actual.determineOutFiles)
  };
});

vi.mock('../../src/utils/typescript-detector.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/typescript-detector.js')>(
    '../../src/utils/typescript-detector.js'
  );
  return {
    ...actual,
    detectBinary: vi.fn(actual.detectBinary)
  };
});

import {
  isESMProject,
  hasTsConfigPaths,
  determineOutFiles
} from '../../src/utils/config-transformer.js';

import { detectBinary } from '../../src/utils/typescript-detector.js';
import { JavascriptDebugAdapter } from '../../src/index.js';

// Minimal AdapterDependencies stub for constructor
const deps = {
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {}
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

function norm(p: unknown): string {
  return typeof p === 'string' ? p.replace(/\\+/g, '/') : '';
}

describe('JavascriptDebugAdapter.transformLaunchConfig', () => {
  let adapter: JavascriptDebugAdapter;
  let envBefore: NodeJS.ProcessEnv;

  beforeEach(() => {
    adapter = new JavascriptDebugAdapter(deps);
    vi.clearAllMocks();
    envBefore = { ...process.env };
  });

  afterEach(() => {
    // restore env
    for (const k of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[k];
    }
    for (const [k, v] of Object.entries(envBefore)) {
      (process.env as Record<string, string | undefined>)[k] = v;
    }
    vi.restoreAllMocks();
  });

  it('should transform JS config with defaults', async () => {
    const program = path.resolve('/proj/app.js');
    const cfg = await adapter.transformLaunchConfig({
      program,
      stopOnEntry: true
    } as any);

    expect(cfg.type).toBe('pwa-node');
    expect(cfg.request).toBe('launch');
    expect(cfg.stopOnEntry).toBe(true);
    expect(cfg.smartStep).toBe(true);
    // js-debug's own default (issue #684): maps on, with launch's outFiles/exclusion
    expect(cfg.sourceMaps).toBe(true);
    expect(cfg.outFiles).toEqual(['**/*.(m|c|)js', '!**/node_modules/**']);
    expect(cfg.resolveSourceMapLocations).toEqual(['**', '!**/node_modules/**']);
    expect(norm(cfg.cwd)).toBe(norm(path.dirname(program)));
    expect(Array.isArray(cfg.args)).toBe(true);
    expect((cfg.args as string[]).length).toBe(0);
    expect(cfg.skipFiles).toEqual(['<node_internals>/**', '**/node_modules/**']);

    // env merged with NODE_ENV default 'development'
    const env = cfg.env as Record<string, string>;
    expect(typeof env).toBe('object');
    expect(env.NODE_ENV).toBe('development');
    // Ensure process.env not mutated
    expect(process.env.NODE_ENV).toBe(envBefore.NODE_ENV);
    expect(norm(cfg.runtimeExecutable as string)).toBe(norm(process.execPath));
  });

  it('JS with sourceMaps true applies default outFiles when not provided', async () => {
    const program = path.resolve('/proj/app.js');
    (determineOutFiles as any).mockImplementation((user?: string[]) => {
      if (Array.isArray(user)) return user;
      return ['**/*.(m|c|)js', '!**/node_modules/**'];
    });

    const cfg = await adapter.transformLaunchConfig({
      program,
      sourceMaps: true
    } as any);

    expect(cfg.sourceMaps).toBe(true);
    expect(cfg.outFiles).toEqual(['**/*.(m|c|)js', '!**/node_modules/**']);
    expect(cfg.resolveSourceMapLocations).toEqual(['**', '!**/node_modules/**']);
  });

  it('should set TS defaults and outFiles with ts-node present', async () => {
    const program = path.resolve('/proj/app.ts');

    // Synchronous detectBinary used by transformLaunchConfig
    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });

    const cfg = await adapter.transformLaunchConfig({
      program
    } as any);

    expect(cfg.sourceMaps).toBe(true);
    expect((cfg.outFiles as string[])).toContain('**/*.(m|c|)js');
    // runtimeExecutable defaults to host Node.js when ts-node is present (hooks added)
    expect(norm(cfg.runtimeExecutable as string)).toBe(norm(process.execPath));
    // runtimeArgs should include ts-node hooks
    const ra = (cfg.runtimeArgs || []) as string[];
    const hasRegister = ra.includes('-r') && ra.includes('ts-node/register');
    const hasTranspile = ra.includes('-r') && ra.includes('ts-node/register/transpile-only');
    expect(hasRegister || hasTranspile).toBe(true);
  });

  it('should use tsx when available (priority over ts-node)', async () => {
    const program = path.resolve('/proj/app.ts');

    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'tsx') return '/bin/tsx';
      return undefined;
    });

    const cfg = await adapter.transformLaunchConfig({
      program
    } as any);

    expect(norm(cfg.runtimeExecutable as string)).toBe(norm('/bin/tsx'));
    expect(cfg.runtimeArgs).toBeUndefined(); // no hooks added when using tsx (aside from user-provided)
  });

  it('should add ts-node ESM loader for ESM project (.mts) when ts-node present', async () => {
    const program = path.resolve('/proj/app.mts');

    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });

    (isESMProject as any).mockReturnValue(true);

    const cfg = await adapter.transformLaunchConfig({
      program
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    const idx = ra.findIndex((x) => x === '--loader');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(ra[idx + 1]).toBe('ts-node/esm');
  });

  it('should add tsconfig-paths/register when tsconfig has paths', async () => {
    const program = path.resolve('/proj/app.ts');

    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });
    (hasTsConfigPaths as any).mockReturnValue(true);

    const cfg = await adapter.transformLaunchConfig({
      program
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    const findRIdxes = ra.reduce<number[]>((acc, v, i) => (v === '-r' ? acc.concat(i) : acc), []);
    const values = findRIdxes.map((i) => ra[i + 1]);
    expect(values).toContain('tsconfig-paths/register');
  });

  it('should preserve user-provided runtimeArgs and append last', async () => {
    const program = path.resolve('/proj/app.ts');
    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });

    const cfg = await adapter.transformLaunchConfig({
      program,
      runtimeArgs: ['--my-flag']
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    expect(ra[ra.length - 1]).toBe('--my-flag');
  });

  it('runtimeExecutable override: "tsx" results in empty hooks', async () => {
    const program = path.resolve('/proj/app.ts');
    const cfg = await adapter.transformLaunchConfig({
      program,
      runtimeExecutable: 'tsx',
      runtimeArgs: ['--custom']
    } as any);

    expect(cfg.runtimeExecutable).toBe('tsx');
    expect(cfg.runtimeArgs).toEqual(['--custom']); // only user-provided
  });

  it('runtimeExecutable override: "ts-node" results in no duplicate hooks', async () => {
    const program = path.resolve('/proj/app.ts');
    const cfg = await adapter.transformLaunchConfig({
      program,
      runtimeExecutable: 'ts-node',
      runtimeArgs: ['-r', 'ts-node/register', '-r', 'ts-node/register/transpile-only']
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    // Should be exactly as provided (idempotent)
    const countRegister = ra.filter((x) => x === 'ts-node/register').length;
    const countTranspile = ra.filter((x) => x === 'ts-node/register/transpile-only').length;
    expect(countRegister).toBe(1);
    expect(countTranspile).toBe(1);
  });

  it('JS passes through user-provided outFiles', async () => {
    const program = path.resolve('/proj/app.js');
    const cfg = await adapter.transformLaunchConfig({
      program,
      sourceMaps: true,
      outFiles: ['dist/**/*.js']
    } as any);
    expect(cfg.outFiles).toEqual(['dist/**/*.js']);
  });

  it('JS: an explicit sourceMaps false opts out of maps and passes caller outFiles through (issue #684)', async () => {
    const program = path.resolve('/proj/app.js');
    const cfg = await adapter.transformLaunchConfig({
      program,
      sourceMaps: false,
      outFiles: ['dist/**/*.js']
    } as any);
    expect(cfg.sourceMaps).toBe(false);
    expect(cfg.outFiles).toEqual(['dist/**/*.js']);
    expect(cfg.resolveSourceMapLocations).toBeUndefined();
  });

  it('justMyCode false keeps node internals blackboxed but not node_modules (issue #678)', async () => {
    const program = path.resolve('/proj/app.js');
    const cfg = await adapter.transformLaunchConfig({
      program,
      justMyCode: false
    } as any);
    expect(cfg.justMyCode).toBe(false);
    expect(cfg.skipFiles).toEqual(['<node_internals>/**']);
  });

  it('justMyCode false also turns off smartStep, so a pause lands instead of being stepped past (issue #678)', async () => {
    // Node internals stay blackboxed on every launch, and on an HTTP server the
    // request path enters user code by calls, never by returns — so with the
    // smart-stepper on, a pause that lands in internals is stepped out of
    // forever (the #513 mechanism). Off, the pause lands truthfully.
    const program = path.resolve('/proj/app.js');
    const cfg = await adapter.transformLaunchConfig({ program, justMyCode: false } as any);
    expect(cfg.smartStep).toBe(false);
  });

  it('keeps smartStep on for the default launch and honours an explicit caller value either way (issue #678)', async () => {
    const program = path.resolve('/proj/app.js');
    expect((await adapter.transformLaunchConfig({ program } as any)).smartStep).toBe(true);
    expect((await adapter.transformLaunchConfig({ program, justMyCode: false, smartStep: true } as any)).smartStep).toBe(true);
    expect((await adapter.transformLaunchConfig({ program, smartStep: false } as any)).smartStep).toBe(false);
  });

  it('a caller skipFiles list replaces the defaults instead of being merged into them (issue #678)', async () => {
    const program = path.resolve('/proj/app.js');
    const cfg = await adapter.transformLaunchConfig({
      program,
      skipFiles: ['**/foo/**']
    } as any);
    expect(cfg.skipFiles).toEqual(['**/foo/**']);
  });

  it('env merge should not mutate process.env', async () => {
    const program = path.resolve('/proj/app.js');
    const before = { ...process.env };
    const cfg = await adapter.transformLaunchConfig({
      program,
      env: { CUSTOM_ENV: '1' }
    } as any);

    const env = cfg.env as Record<string, string>;
    expect(env.CUSTOM_ENV).toBe('1');
    expect(process.env.CUSTOM_ENV).toBe(before.CUSTOM_ENV);
  });

  describe('exit code shim injection (issue #247)', () => {
    // The shim resolution consults dependencies.fileSystem.existsSync (same
    // pattern as buildAdapterCommand's vendor lookup)
    const depsWithFs = {
      ...deps,
      fileSystem: { existsSync: () => true }
    } as unknown as import('@debugmcp/shared').AdapterDependencies;

    it('injects MCP_DEBUGGER_EXITCODE_FILE and a NODE_OPTIONS --require of the shim', async () => {
      const withFs = new JavascriptDebugAdapter(depsWithFs);
      const cfg = await withFs.transformLaunchConfig({
        program: path.resolve('/proj/app.js')
      } as any);

      const env = cfg.env as Record<string, string>;
      expect(env.MCP_DEBUGGER_EXITCODE_FILE).toMatch(/mcp-exitcode-[0-9a-f-]+\.txt$/);
      expect(env.NODE_OPTIONS ?? '').toMatch(/--require "[^"]*exitcode-shim\.cjs"/);
      // Forward slashes only: backslash escaping in NODE_OPTIONS is ambiguous on Windows
      const requireArg = /--require "([^"]*)"/.exec(env.NODE_OPTIONS)![1];
      expect(requireArg).not.toContain('\\');
    });

    it('preserves pre-existing NODE_OPTIONS content', async () => {
      const withFs = new JavascriptDebugAdapter(depsWithFs);
      const cfg = await withFs.transformLaunchConfig({
        program: path.resolve('/proj/app.js'),
        env: { NODE_OPTIONS: '--max-old-space-size=2048' }
      } as any);

      const env = cfg.env as Record<string, string>;
      expect(env.NODE_OPTIONS).toContain('--max-old-space-size=2048');
      expect(env.NODE_OPTIONS).toMatch(/--require "[^"]*exitcode-shim\.cjs"/);
    });

    it('does not double-append when NODE_OPTIONS already carries the shim', async () => {
      const withFs = new JavascriptDebugAdapter(depsWithFs);
      const cfg = await withFs.transformLaunchConfig({
        program: path.resolve('/proj/app.js'),
        env: { NODE_OPTIONS: '--require "/prior/exitcode-shim.cjs"' }
      } as any);

      const env = cfg.env as Record<string, string>;
      const occurrences = env.NODE_OPTIONS.match(/exitcode-shim\.cjs/g) ?? [];
      expect(occurrences.length).toBe(1);
    });

    it('skips injection cleanly when the shim asset cannot be resolved', async () => {
      const depsNoShim = {
        ...deps,
        fileSystem: { existsSync: () => false }
      } as unknown as import('@debugmcp/shared').AdapterDependencies;
      const withoutShim = new JavascriptDebugAdapter(depsNoShim);

      const cfg = await withoutShim.transformLaunchConfig({
        program: path.resolve('/proj/app.js')
      } as any);

      const env = cfg.env as Record<string, string>;
      expect(env.MCP_DEBUGGER_EXITCODE_FILE).toBeUndefined();
      expect(env.NODE_OPTIONS ?? '').not.toContain('exitcode-shim');
    });

    it('leaves attach configs untouched', async () => {
      const withFs = new JavascriptDebugAdapter(depsWithFs);
      const cfg = await withFs.transformAttachConfig({
        port: 9229
      } as any);

      const env = (cfg.env ?? {}) as Record<string, string>;
      expect(env.MCP_DEBUGGER_EXITCODE_FILE).toBeUndefined();
      expect(env.NODE_OPTIONS ?? '').not.toContain('exitcode-shim');
    });
  });

  describe('transformAttachConfig source-map defaults (issue #655)', () => {
    it('defaults resolveSourceMapLocations to the launch exclusion and cwd to the server cwd', () => {
      const adapter = new JavascriptDebugAdapter(deps);
      const cfg = adapter.transformAttachConfig({ request: 'attach', port: 9229 } as any) as Record<string, unknown>;
      expect(cfg.resolveSourceMapLocations).toEqual(['**', '!**/node_modules/**']);
      expect(cfg.cwd).toBe(process.cwd());
      // Deliberately not defaulted: blackboxing node_modules would recreate
      // the #513 pause step-chase; the policy hides those frames instead.
      expect(cfg.skipFiles).toBeUndefined();
      expect(cfg.sourceMaps).toBeUndefined();
      expect(cfg.outFiles).toBeUndefined();
    });

    it('keeps a caller resolveSourceMapLocations — including an explicit null — and a caller cwd', () => {
      const adapter = new JavascriptDebugAdapter(deps);
      const list = adapter.transformAttachConfig({
        request: 'attach', port: 9229, resolveSourceMapLocations: ['/app/**'], cwd: '/app'
      } as any) as Record<string, unknown>;
      expect(list.resolveSourceMapLocations).toEqual(['/app/**']);
      expect(list.cwd).toBe('/app');

      const everywhere = adapter.transformAttachConfig({
        request: 'attach', port: 9229, resolveSourceMapLocations: null
      } as any) as Record<string, unknown>;
      expect(everywhere.resolveSourceMapLocations).toBeNull();
    });

    it('uses the workspace root as cwd in container mode', () => {
      const prev = { c: process.env.MCP_CONTAINER, w: process.env.MCP_WORKSPACE_ROOT };
      process.env.MCP_CONTAINER = 'true';
      process.env.MCP_WORKSPACE_ROOT = '/ws';
      try {
        const adapter = new JavascriptDebugAdapter(deps);
        const cfg = adapter.transformAttachConfig({ request: 'attach', port: 9229 } as any) as Record<string, unknown>;
        expect(cfg.cwd).toBe('/ws');
      } finally {
        if (prev.c === undefined) delete process.env.MCP_CONTAINER; else process.env.MCP_CONTAINER = prev.c;
        if (prev.w === undefined) delete process.env.MCP_WORKSPACE_ROOT; else process.env.MCP_WORKSPACE_ROOT = prev.w;
      }
    });
  });

  describe('transformAttachConfig passthrough (issues #450/#466)', () => {
    it('normalizes the pwa-node attach shape and defaults the host', () => {
      const adapter = new JavascriptDebugAdapter(deps);
      const cfg = adapter.transformAttachConfig({
        request: 'attach',
        port: 9229,
        stopOnEntry: true,
        justMyCode: false,
        timeout: 15000
      } as any) as Record<string, unknown>;

      expect(cfg.type).toBe('pwa-node');
      expect(cfg.request).toBe('attach');
      expect(cfg.host).toBe('127.0.0.1');
      expect(cfg.port).toBe(9229);
      expect(cfg.stopOnEntry).toBe(true);
      expect(cfg.justMyCode).toBe(false);
      expect(cfg.timeout).toBe(15000);
    });

    it('forwards advanced js-debug options and strips reserved keys', () => {
      const adapter = new JavascriptDebugAdapter(deps);
      const cfg = adapter.transformAttachConfig({
        request: 'launch', // must not survive: attach transforms pin the request
        __attachMode: true,
        processId: 4242,
        host: '10.0.0.5',
        port: 9229,
        localRoot: '/local/src',
        remoteRoot: '/app',
        sourceMaps: false,
        skipFiles: ['<node_internals>/**'],
        continueOnAttach: true
      } as any) as Record<string, unknown>;

      expect(cfg.request).toBe('attach');
      expect(cfg.__attachMode).toBeUndefined();
      expect(cfg.processId).toBeUndefined();
      expect(cfg.host).toBe('10.0.0.5');
      expect(cfg.localRoot).toBe('/local/src');
      expect(cfg.remoteRoot).toBe('/app');
      expect(cfg.sourceMaps).toBe(false);
      expect(cfg.skipFiles).toEqual(['<node_internals>/**']);
      expect(cfg.continueOnAttach).toBe(true);
    });

    it('defaults autoAttachChildProcesses to false on attach (issue #501)', () => {
      const adapter = new JavascriptDebugAdapter(deps);
      const cfg = adapter.transformAttachConfig({
        request: 'attach',
        port: 9229
      } as any) as Record<string, unknown>;

      // js-debug's pwa-node attach defaults this to true, which parks every
      // fork() of the inspected process in waitForDebugger
      expect(cfg.autoAttachChildProcesses).toBe(false);
    });

    it('respects a caller-supplied autoAttachChildProcesses (issue #501)', () => {
      const adapter = new JavascriptDebugAdapter(deps);
      const optIn = adapter.transformAttachConfig({
        request: 'attach',
        port: 9229,
        autoAttachChildProcesses: true
      } as any) as Record<string, unknown>;
      expect(optIn.autoAttachChildProcesses).toBe(true);

      const optOut = adapter.transformAttachConfig({
        request: 'attach',
        port: 9229,
        autoAttachChildProcesses: false
      } as any) as Record<string, unknown>;
      expect(optOut.autoAttachChildProcesses).toBe(false);
    });

    it('lists autoAttachChildProcesses as a supported attach key (issue #501)', () => {
      const adapter = new JavascriptDebugAdapter(deps);
      expect(adapter.supportedAttachKeys).toContain('autoAttachChildProcesses');
    });

    it('defaults smartStep to false on attach (issue #513)', () => {
      const adapter = new JavascriptDebugAdapter(deps);
      const cfg = adapter.transformAttachConfig({
        request: 'attach',
        port: 9229
      } as any) as Record<string, unknown>;

      // js-debug's smart-stepper converts a user pause landing on a
      // blackboxed/unmapped frame into an endless auto-step on an idle
      // server, so the 'stopped' event never fires
      expect(cfg.smartStep).toBe(false);
    });

    it('respects a caller-supplied smartStep (issue #513)', () => {
      const adapter = new JavascriptDebugAdapter(deps);
      const optIn = adapter.transformAttachConfig({
        request: 'attach',
        port: 9229,
        smartStep: true
      } as any) as Record<string, unknown>;
      expect(optIn.smartStep).toBe(true);

      const optOut = adapter.transformAttachConfig({
        request: 'attach',
        port: 9229,
        smartStep: false
      } as any) as Record<string, unknown>;
      expect(optOut.smartStep).toBe(false);
    });
  });
});

/** Deps with a file system that knows a fixed set of paths, and remembers what was ensured. */
function depsWithFileSystem(existing: string[], ensured: string[] = []) {
  const known = new Set(existing.map(norm));
  return {
    logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    fileSystem: {
      existsSync: (p: string) => known.has(norm(p)),
      ensureDirSync: (p: string) => { ensured.push(p); }
    }
  } as unknown as import('@debugmcp/shared').AdapterDependencies & {
    logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  };
}

describe('JavascriptDebugAdapter.transformLaunchConfig passthrough (issue #703)', () => {
  it('forwards js-debug keys the transform does not derive; derived keys win and consumed inputs never leak', async () => {
    const adapter = new JavascriptDebugAdapter(deps);
    const program = path.resolve('/proj/app.js');
    const cfg = await adapter.transformLaunchConfig({
      program,
      stopOnEntry: false,
      justMyCode: true,
      trace: { logFile: '/tmp/js-debug.json', stdio: false },
      perScriptSourcemaps: 'yes',
      pauseForSourceMap: false,
      timeouts: { sourceMapMinPause: 0 },
      env: { FOO: 'bar' },
      skipFiles: ['<node_internals>/**'],
      request: 'attach',
      __attachMode: true
    } as any) as Record<string, unknown>;

    // js-debug keys ride along untouched
    expect(cfg.trace).toEqual({ logFile: '/tmp/js-debug.json', stdio: false });
    expect(cfg.perScriptSourcemaps).toBe('yes');
    expect(cfg.pauseForSourceMap).toBe(false);
    expect(cfg.timeouts).toEqual({ sourceMapMinPause: 0 });

    // consumed generic inputs are folded into their derived keys, not re-sent
    expect((cfg.env as Record<string, string>).FOO).toBe('bar');
    expect(cfg.skipFiles).toEqual(['<node_internals>/**']);
    expect(cfg.smartStep).toBe(true);

    // launch/attach selection is never forwarded
    expect(cfg.request).toBe('launch');
    expect(cfg.__attachMode).toBeUndefined();
  });

  it('pins the launch shape mcp-debugger owns, lets autoAttachChildProcesses follow the caller, and says so', async () => {
    const d = depsWithFileSystem([]);
    const adapter = new JavascriptDebugAdapter(d);
    const cfg = await adapter.transformLaunchConfig({
      program: path.resolve('/proj/app.js'),
      console: 'integratedTerminal',
      outputCapture: 'console',
      type: 'node',
      name: 'mine',
      autoAttachChildProcesses: true,
      trace: true
    } as any) as Record<string, unknown>;
    expect(cfg.console).toBe('internalConsole');
    expect(cfg.outputCapture).toBe('std');
    expect(cfg.type).toBe('pwa-node');
    expect(cfg.name).toBe('Debug JavaScript/TypeScript');
    expect(cfg.autoAttachChildProcesses).toBe(true);
    expect(cfg.trace).toBe(true);
    const warned = d.logger.warn.mock.calls.map(([m]) => String(m)).join('\n');
    expect(warned).toMatch(/pins the js-debug launch shape: console, outputCapture, type, name/);
    const info = d.logger.info.mock.calls.map(([m]) => String(m)).join('\n');
    expect(info).toMatch(/forwarded to js-debug: trace$/m);
  });

  it('never forwards the keys that break a parent launch, nor a null trace, and warns', async () => {
    const d = depsWithFileSystem([]);
    const adapter = new JavascriptDebugAdapter(d);
    const cfg = await adapter.transformLaunchConfig({
      program: path.resolve('/proj/app.js'),
      __pendingTargetId: 'x',
      attachSimplePort: 9230,
      trace: null,
      ['__proto__']: { polluted: true }
    } as any) as Record<string, unknown>;
    expect('__pendingTargetId' in cfg).toBe(false);
    expect('attachSimplePort' in cfg).toBe(false);
    expect('trace' in cfg).toBe(false);
    expect((cfg as { polluted?: unknown }).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(cfg, '__proto__')).toBe(false);
    const warned = d.logger.warn.mock.calls.map(([m]) => String(m)).join('\n');
    expect(warned).toMatch(/not applicable to a launch: __pendingTargetId, attachSimplePort, trace/);
  });

  it('a caller resolveSourceMapLocations (an array or null) wins over the launch default; anything else falls back with a warning', async () => {
    const d = depsWithFileSystem([]);
    const adapter = new JavascriptDebugAdapter(d);
    const program = path.resolve('/proj/app.js');
    const explicit = await adapter.transformLaunchConfig({ program, resolveSourceMapLocations: ['/proj/dist/**'] } as any) as Record<string, unknown>;
    expect(explicit.resolveSourceMapLocations).toEqual(['/proj/dist/**']);

    const everywhere = await adapter.transformLaunchConfig({ program, resolveSourceMapLocations: null } as any) as Record<string, unknown>;
    expect(everywhere.resolveSourceMapLocations).toBeNull();

    const byDefault = await adapter.transformLaunchConfig({ program } as any) as Record<string, unknown>;
    expect(byDefault.resolveSourceMapLocations).toEqual(['**', '!**/node_modules/**']);

    const bad = await adapter.transformLaunchConfig({ program, resolveSourceMapLocations: 'dist/**' } as any) as Record<string, unknown>;
    expect(bad.resolveSourceMapLocations).toEqual(['**', '!**/node_modules/**']);
    expect(d.logger.warn.mock.calls.map(([m]) => String(m)).join('\n')).toMatch(/resolveSourceMapLocations must be null or an array/);

    const attach = adapter.transformAttachConfig({ host: 'h', port: 1, resolveSourceMapLocations: { no: true } } as any) as Record<string, unknown>;
    expect(attach.resolveSourceMapLocations).toEqual(['**', '!**/node_modules/**']);
  });
});

describe('JavascriptDebugAdapter.transformLaunchConfig workspace root and source-map pause (issue #699)', () => {
  it('roots js-debug at the nearest package.json above the program and leaves pauseForSourceMap off for a .js program', async () => {
    const ensured: string[] = [];
    const d = depsWithFileSystem([path.resolve('/proj/package.json')], ensured);
    const adapter = new JavascriptDebugAdapter(d);
    const program = path.resolve('/proj/dist/bin/cli.js');
    const cfg = await adapter.transformLaunchConfig({ program } as any) as Record<string, unknown>;
    expect(norm(cfg.__workspaceFolder)).toBe(norm(path.resolve('/proj')));
    expect(cfg.pauseForSourceMap).toBe(false);
    // the predictor cache lives under the server's temp tree and is created on the way
    expect(typeof cfg.__workspaceCachePath).toBe('string');
    expect(ensured).toEqual([cfg.__workspaceCachePath]);
  });

  it('falls back to the program directory without a package.json, and sends no cache path without a file system', async () => {
    const adapter = new JavascriptDebugAdapter(deps);
    const program = path.resolve('/proj/dist/app.js');
    const cfg = await adapter.transformLaunchConfig({ program } as any) as Record<string, unknown>;
    expect(norm(cfg.__workspaceFolder)).toBe(norm(path.dirname(program)));
    expect('__workspaceCachePath' in cfg).toBe(false);
  });

  it('an explicit __workspaceFolder and __workspaceCachePath win', async () => {
    const d = depsWithFileSystem([path.resolve('/proj/package.json')]);
    const adapter = new JavascriptDebugAdapter(d);
    const cfg = await adapter.transformLaunchConfig({
      program: path.resolve('/proj/dist/app.js'),
      __workspaceFolder: path.resolve('/root'),
      __workspaceCachePath: path.resolve('/cache')
    } as any) as Record<string, unknown>;
    expect(norm(cfg.__workspaceFolder)).toBe(norm(path.resolve('/root')));
    expect(norm(cfg.__workspaceCachePath)).toBe(norm(path.resolve('/cache')));
  });

  it('sends no root when source maps are off (nothing to predict), and honours outFiles: [] as the scan opt-out', async () => {
    const d = depsWithFileSystem([path.resolve('/proj/package.json')]);
    const adapter = new JavascriptDebugAdapter(d);
    const program = path.resolve('/proj/dist/app.js');
    const off = await adapter.transformLaunchConfig({ program, sourceMaps: false } as any) as Record<string, unknown>;
    expect('__workspaceFolder' in off).toBe(false);
    expect('__workspaceCachePath' in off).toBe(false);

    const optOut = await adapter.transformLaunchConfig({ program, outFiles: [] } as any) as Record<string, unknown>;
    expect(optOut.outFiles).toEqual([]);
    expect(norm(optOut.__workspaceFolder)).toBe(norm(path.resolve('/proj')));
  });

  it('keeps pauseForSourceMap on for a TypeScript program run through a transpiler, and honours an explicit value', async () => {
    (detectBinary as unknown as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const adapter = new JavascriptDebugAdapter(deps);
    const ts = await adapter.transformLaunchConfig({ program: path.resolve('/proj/src/app.ts') } as any) as Record<string, unknown>;
    expect(ts.pauseForSourceMap).toBe(true);

    const forced = await adapter.transformLaunchConfig({
      program: path.resolve('/proj/dist/app.js'), pauseForSourceMap: true
    } as any) as Record<string, unknown>;
    expect(forced.pauseForSourceMap).toBe(true);
  });
});
