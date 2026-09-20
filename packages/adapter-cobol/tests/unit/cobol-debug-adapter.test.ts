/**
 * Unit tests for CobolDebugAdapter (issue #759).
 *
 * Hermetic: the CodeLLDB resolver and argv builder (via @debugmcp/codelldb-common)
 * are mocked, `findCobc` returns a canned location or null, and `GnuCobolBuilder`
 * is a stub whose `build` is a vi.fn() — no cobc, no CodeLLDB, no vendor tree.
 * `fs.existsSync` is routed through a switch so the shim entry can be "found"
 * without a real dist/ build; every other path check stays real.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AdapterState, AdapterError, AdapterErrorCode, DebugFeature, DebugLanguage } from '@debugmcp/shared';
import type { AdapterConfig, AdapterDependencies, LanguageSpecificLaunchConfig } from '@debugmcp/shared';
import type { CobcLocation, CobolBuildRequest, CobolBuildResult } from '../../src/build/index.js';

const { shimExists, cobcrunExists, buildMock, builderCtor } = vi.hoisted(() => ({
  /** Whether the fs switch pretends the shim entry exists. */
  shimExists: { value: true },
  /** Whether the fs switch pretends cobcrun sits beside the canned cobc. */
  cobcrunExists: { value: true },
  buildMock: vi.fn<(request: CobolBuildRequest) => Promise<CobolBuildResult>>(),
  builderCtor: vi.fn<(deps: unknown) => void>()
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: (p: fs.PathLike): boolean =>
      String(p).endsWith('cobol-shim.js')
        ? shimExists.value
        : /[\\/]cobcrun(\.exe)?$/.test(String(p))
          ? cobcrunExists.value
          : actual.existsSync(p)
  };
});

vi.mock('@debugmcp/codelldb-common', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveCodeLLDBExecutable: vi.fn(),
  resolveCodeLLDBExecutableSyncImpl: vi.fn(),
  buildCodeLLDBArgs: vi.fn((_codelldbPath: string, port: number) => ['--port', String(port)])
}));

vi.mock('../../src/build/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/build/index.js')>()),
  findCobc: vi.fn(),
  GnuCobolBuilder: class {
    constructor(deps: unknown) {
      builderCtor(deps);
    }
    build = buildMock;
  }
}));

import { resolveCodeLLDBExecutable, resolveCodeLLDBExecutableSyncImpl, buildCodeLLDBArgs } from '@debugmcp/codelldb-common';
import { findCobc } from '../../src/build/index.js';
import { CobolDebugAdapter, COBOL_RUNTIME_ERROR_FILTER, type CobolLaunchConfig } from '../../src/cobol-debug-adapter.js';
import { COBOL_PRIVATE_KEY, type CobolShimSessionOptions } from '../../src/shim-protocol.js';

const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
/** First candidate of the shim walk: `<dir of the adapter module>/shim/cobol-shim.js` (src/ under vitest). */
const SHIM_FIRST_CANDIDATE = path.resolve(PACKAGE_ROOT, 'src', 'shim', 'cobol-shim.js');
const CODELLDB = '/vendor/adapter/codelldb';

const cobcLinux: CobcLocation = {
  path: '/opt/gnucobol/bin/cobc',
  binDir: '/opt/gnucobol/bin',
  prefix: '/opt/gnucobol',
  versionLine: 'cobc (GnuCOBOL) 3.2.0',
  version: '3.2.0',
  configDir: '/opt/gnucobol/share/gnucobol/config'
};

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } satisfies AdapterDependencies['logger'];

const createDependencies = (): AdapterDependencies => ({
  fileSystem: {} as AdapterDependencies['fileSystem'],
  logger,
  environment: {
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue({}),
    getCurrentWorkingDirectory: vi.fn().mockReturnValue(process.cwd())
  } as unknown as AdapterDependencies['environment']
});

const shimOptions = (result: LanguageSpecificLaunchConfig): CobolShimSessionOptions =>
  result[COBOL_PRIVATE_KEY] as CobolShimSessionOptions;

/** The PATH-like entries of an env, whichever spelling the platform under test wrote. */
const pathEntries = (env: Record<string, string> | undefined): string[][] =>
  Object.entries(env ?? {})
    .filter(([key]) => key.toUpperCase() === 'PATH')
    .map(([, value]) => value.split(path.delimiter));

describe('CobolDebugAdapter', () => {
  let tmp: string;
  let adapter: CobolDebugAdapter;

  const buildResult = (name: string, overrides: Partial<CobolBuildResult> = {}): CobolBuildResult => {
    const artifactDir = path.join(tmp, '.debug-mcp', 'cobol', name, 'abc123abc123');
    return {
      success: true,
      binaryPath: path.join(artifactDir, name),
      artifactDir,
      manifestPaths: [path.join(artifactDir, `${name}.cobol-symbols.json`)],
      manifests: [],
      buildKey: 'abc123abc123',
      compiled: true,
      diagnostics: [],
      argv: [],
      ...overrides
    };
  };

  /** Typed entry so inline launch literals are checked as CobolLaunchConfig, not the generic shape. */
  const transformLaunch = (config: CobolLaunchConfig, target: CobolDebugAdapter = adapter): Promise<LanguageSpecificLaunchConfig> =>
    target.transformLaunchConfig(config);

  const adapterConfig = (overrides: Partial<AdapterConfig> = {}): AdapterConfig => ({
    sessionId: 's1',
    executablePath: 'cobc',
    adapterHost: '127.0.0.1',
    adapterPort: 4711,
    logDir: path.join('/tmp', 'logs'),
    scriptPath: 'hello.cob',
    launchConfig: {},
    ...overrides
  });

  beforeEach(() => {
    shimExists.value = true;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cobol-adapter-'));
    fs.writeFileSync(path.join(tmp, 'hello.cob'), '       PROGRAM-ID. HELLO.\n');
    vi.mocked(findCobc).mockResolvedValue(cobcLinux);
    cobcrunExists.value = true;
    vi.mocked(resolveCodeLLDBExecutable).mockResolvedValue(CODELLDB);
    vi.mocked(resolveCodeLLDBExecutableSyncImpl).mockReturnValue(CODELLDB);
    adapter = new CobolDebugAdapter(createDependencies(), 'linux');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe('identity and metadata', () => {
    it('identifies as the COBOL adapter over CodeLLDB', () => {
      expect(adapter.language).toBe(DebugLanguage.COBOL);
      expect(adapter.name).toBe('COBOL Debug Adapter');
      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
      expect(adapter.isReady()).toBe(false);
      expect(adapter.getDefaultExecutableName()).toBe('cobc');
      expect(adapter.getAdapterModuleName()).toBe('codelldb');
      expect(adapter.getAdapterInstallCommand()).toBe('pnpm install (vendors CodeLLDB)');
      expect(adapter.getCurrentThreadId()).toBeNull();
    });

    it('requires CodeLLDB but only recommends cobc', () => {
      const deps = adapter.getRequiredDependencies();
      expect(deps.map((d) => [d.name, d.required])).toEqual([['CodeLLDB', true], ['GnuCOBOL (cobc)', false]]);
    });

    it('declares attach/detach support and the default configs', () => {
      expect(adapter.supportsAttach()).toBe(true);
      expect(adapter.supportsDetach()).toBe(true);
      expect(adapter.getDefaultAttachConfig()).toEqual({ request: 'attach', stopOnEntry: true });
      expect(adapter.getDefaultLaunchConfig()).toMatchObject({ stopOnEntry: false, justMyCode: true, env: {} });
    });

    it('lists the platform-specific search dirs before PATH', () => {
      expect(new CobolDebugAdapter(createDependencies(), 'win32').getExecutableSearchPaths().slice(0, 3))
        .toEqual(['C:\\msys64\\mingw64\\bin', 'C:\\msys64\\ucrt64\\bin', 'C:\\msys64\\clang64\\bin']);
      expect(new CobolDebugAdapter(createDependencies(), 'darwin').getExecutableSearchPaths().slice(0, 3))
        .toEqual(['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']);
      expect(adapter.getExecutableSearchPaths().slice(0, 2)).toEqual(['/usr/bin', '/usr/local/bin']);
    });
  });

  describe('validateEnvironment', () => {
    it('errors when CodeLLDB is missing', async () => {
      vi.mocked(resolveCodeLLDBExecutable).mockResolvedValue(null);

      const result = await adapter.validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors.map((e) => e.code)).toEqual(['CODELLDB_NOT_FOUND']);
      expect(result.errors[0].recoverable).toBe(true);
    });

    it('warns (does not error) when cobc is missing', async () => {
      vi.mocked(findCobc).mockResolvedValue(null);

      const result = await adapter.validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings.map((w) => w.code)).toEqual(['COBC_NOT_FOUND']);
      expect(result.warnings[0].message).toMatch(/COBC_PATH/);
    });

    it('is clean when both are present and looks cobc up for the configured platform, once', async () => {
      const win = new CobolDebugAdapter(createDependencies(), 'win32');

      const first = await win.validateEnvironment();
      const second = await win.validateEnvironment();

      expect(first).toEqual({ valid: true, errors: [], warnings: [] });
      expect(second.valid).toBe(true);
      expect(findCobc).toHaveBeenCalledTimes(1);
      expect(findCobc).toHaveBeenCalledWith(expect.objectContaining({ platform: 'win32' }));
    });

    it('reports a thrown lookup as VALIDATION_ERROR', async () => {
      vi.mocked(resolveCodeLLDBExecutable).mockRejectedValue(new Error('resolver exploded'));

      const result = await adapter.validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'VALIDATION_ERROR', message: 'resolver exploded', recoverable: false });
    });
  });

  describe('lifecycle', () => {
    it('initializes to READY, logs warnings and emits initialized', async () => {
      vi.mocked(findCobc).mockResolvedValue(null);
      const initialized = vi.fn();
      adapter.on('initialized', initialized);

      await adapter.initialize();

      expect(adapter.getState()).toBe(AdapterState.READY);
      expect(adapter.isReady()).toBe(true);
      expect(initialized).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/^\[CobolDebugAdapter\] GnuCOBOL \(cobc\) not found/));
    });

    it('rejects initialization and lands in ERROR when the environment is invalid', async () => {
      vi.mocked(resolveCodeLLDBExecutable).mockResolvedValue(null);

      await expect(adapter.initialize()).rejects.toMatchObject({ code: AdapterErrorCode.ENVIRONMENT_INVALID });
      expect(adapter.getState()).toBe(AdapterState.ERROR);
    });

    it('tracks connect / disconnect / dispose state', async () => {
      await adapter.connect('127.0.0.1', 4711);
      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);

      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);

      const disposed = vi.fn();
      adapter.on('disposed', disposed);
      await adapter.dispose();
      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
      expect(disposed).toHaveBeenCalledOnce();
    });

    it('follows stopped / terminated events for the current thread', async () => {
      await adapter.connect('127.0.0.1', 4711);

      adapter.handleDapEvent({ type: 'event', seq: 1, event: 'stopped', body: { threadId: 7, reason: 'breakpoint' } });
      expect(adapter.getCurrentThreadId()).toBe(7);
      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);

      adapter.handleDapEvent({ type: 'event', seq: 2, event: 'terminated' });
      expect(adapter.getCurrentThreadId()).toBeNull();
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
    });

    it('warns about exception filters it does not own', async () => {
      await adapter.sendDapRequest('setExceptionBreakpoints', { filters: [COBOL_RUNTIME_ERROR_FILTER, 'cpp_throw'] });
      expect(logger.warn).toHaveBeenCalledWith('[CobolDebugAdapter] Unknown exception filters: cpp_throw');
    });
  });

  describe('resolveExecutablePath', () => {
    it('returns an existing preferred path and rejects a missing one', async () => {
      const existing = path.join(tmp, 'hello.cob');
      await expect(adapter.resolveExecutablePath(existing)).resolves.toBe(existing);
      await expect(adapter.resolveExecutablePath(path.join(tmp, 'nope'))).rejects.toMatchObject({ code: AdapterErrorCode.EXECUTABLE_NOT_FOUND });
    });

    it('defaults to the located cobc', async () => {
      await expect(adapter.resolveExecutablePath()).resolves.toBe(cobcLinux.path);
    });

    it('resolves to the prebuilt placeholder without cobc: attach and prebuilt launches need no compiler', async () => {
      vi.mocked(findCobc).mockResolvedValue(null);
      vi.stubEnv('MCP_CONTAINER', undefined);
      await expect(adapter.resolveExecutablePath()).resolves.toBe('cobol-prebuilt-binary');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/cobc/));
    });

    it('probes a user-supplied executablePath as cobc on later launches', async () => {
      const existing = path.join(tmp, 'my-cobc');
      fs.writeFileSync(existing, '');
      vi.mocked(findCobc).mockResolvedValue(cobcLinux);
    cobcrunExists.value = true;
      await expect(adapter.resolveExecutablePath(existing)).resolves.toBe(existing);
      await transformLaunch({ program: 'app', cwd: tmp });
      expect(findCobc).toHaveBeenLastCalledWith(expect.objectContaining({ env: expect.objectContaining({ COBC_PATH: existing }) }));
    });
  });

  describe('transformLaunchConfig', () => {
    it('compiles a COBOL source with the builder and launches the binary it produced', async () => {
      const result = buildResult('hello');
      buildMock.mockResolvedValue(result);
      const config: CobolLaunchConfig = {
        program: 'hello.cob',
        cwd: tmp,
        sources: ['sub.cob'],
        copybookDirs: ['cpy'],
        dialect: 'ibm',
        format: 'free',
        runtimeChecks: true,
        cobcFlags: ['-Wall'],
        forceRebuild: true,
        args: ['--x'],
        stopOnEntry: true
      };

      const launch = await adapter.transformLaunchConfig(config);

      expect(builderCtor).toHaveBeenCalledWith({ cobc: cobcLinux, platform: 'linux', logger });
      expect(buildMock).toHaveBeenCalledTimes(1);
      expect(buildMock).toHaveBeenCalledWith({
        program: path.join(tmp, 'hello.cob'),
        sources: [path.join(tmp, 'sub.cob')],
        mode: 'executable',
        dialect: 'ibm',
        format: 'free',
        copybookDirs: [path.join(tmp, 'cpy')],
        cobcFlags: ['-Wall'],
        runtimeChecks: true,
        forceRebuild: true
      });
      expect(launch).toMatchObject({
        type: 'lldb',
        request: 'launch',
        name: 'Debug COBOL',
        program: result.binaryPath,
        args: ['--x'],
        cwd: tmp,
        stopOnEntry: true,
        sourceLanguages: ['cpp'],
        terminal: 'console',
        sourceMap: {},
        initCommands: [],
        preRunCommands: [],
        postRunCommands: []
      });
      expect(shimOptions(launch)).toEqual({ manifestDirs: [result.artifactDir], engineScopes: false, stdinFile: undefined });
      expect(launch.env).toEqual({ PATH: cobcLinux.binDir, COB_CONFIG_DIR: cobcLinux.configDir });
      expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Compiled .*hello\.cob -> /));
      expect(adapter.consumeLastBuild()).toBe(result);
      expect(adapter.consumeLastBuild()).toBeUndefined();
    });

    it('defaults forceRebuild to false, resolves against process.cwd() without cwd, and reports reuse', async () => {
      buildMock.mockResolvedValue(buildResult('hello', { compiled: false }));

      const launch = await transformLaunch({ program: path.join(tmp, 'hello.cob') });

      expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({ forceRebuild: false, copybookDirs: [], sources: [] }));
      expect(launch.cwd).toBe(process.cwd());
      expect(launch.stopOnEntry).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Reusing .* \(up to date\)/));
    });

    it('logs every build diagnostic as a cobc warning', async () => {
      buildMock.mockResolvedValue(buildResult('hello', { diagnostics: ['warn: no listing', 'hello.cob:3: warning: x'] }));

      await transformLaunch({ program: 'hello.cob', cwd: tmp });

      expect(logger.warn).toHaveBeenCalledWith('[CobolDebugAdapter] cobc: warn: no listing');
      expect(logger.warn).toHaveBeenCalledWith('[CobolDebugAdapter] cobc: hello.cob:3: warning: x');
    });

    it('throws with the compiler error when the build fails, keeping the failed result for diagnostics', async () => {
      const failed = buildResult('hello', { success: false, binaryPath: undefined, error: 'cobc exited with code 1: syntax error' });
      buildMock.mockResolvedValue(failed);

      await expect(transformLaunch({ program: 'hello.cob', cwd: tmp })).rejects.toThrow(/COBOL compile failed: cobc exited with code 1: syntax error/);
      expect(adapter.consumeLastBuild()).toBe(failed);
    });

    it('refuses a source launch without cobc', async () => {
      vi.mocked(findCobc).mockResolvedValue(null);

      await expect(transformLaunch({ program: 'hello.cob', cwd: tmp })).rejects.toMatchObject({
        code: AdapterErrorCode.ENVIRONMENT_INVALID,
        message: expect.stringMatching(/GnuCOBOL \(cobc\) is required to launch a COBOL source file/)
      });
      expect(builderCtor).not.toHaveBeenCalled();
    });

    it('throws SCRIPT_NOT_FOUND when no program is given', async () => {
      await expect(transformLaunch({})).rejects.toMatchObject({ code: AdapterErrorCode.SCRIPT_NOT_FOUND });
    });

    describe('stdinFile', () => {
      it('feeds the file through LLDB\'s target.input-path ahead of the user\'s preRunCommands', async () => {
        buildMock.mockResolvedValue(buildResult('hello'));
        fs.writeFileSync(path.join(tmp, 'input.txt'), '42\n');

        const launch = await transformLaunch({ program: 'hello.cob', cwd: tmp, stdinFile: 'input.txt', preRunCommands: ['settings set x y'] });

        const stdinPath = path.join(tmp, 'input.txt');
        expect(launch.preRunCommands).toEqual([`settings set target.input-path "${stdinPath}"`, 'settings set x y']);
        expect(shimOptions(launch).stdinFile).toBe(stdinPath);
      });

      it('quotes a path that contains whitespace verbatim, backslashes untouched', async () => {
        buildMock.mockResolvedValue(buildResult('hello'));
        const spaced = path.join(tmp, 'my inputs');
        fs.mkdirSync(spaced);
        fs.writeFileSync(path.join(spaced, 'in.txt'), '');

        const launch = await transformLaunch({ program: 'hello.cob', cwd: tmp, stdinFile: path.join('my inputs', 'in.txt') });

        expect((launch.preRunCommands as string[])[0]).toBe(`settings set target.input-path "${path.join(spaced, 'in.txt')}"`);
      });

      it('refuses a stdinFile path that contains a double quote', async () => {
        buildMock.mockResolvedValue(buildResult('hello'));

        await expect(transformLaunch({ program: 'hello.cob', cwd: tmp, stdinFile: 'in"put.txt' })).rejects.toThrow(/double quote/);
      });

      it('throws SCRIPT_NOT_FOUND for a missing stdinFile', async () => {
        buildMock.mockResolvedValue(buildResult('hello'));

        await expect(transformLaunch({ program: 'hello.cob', cwd: tmp, stdinFile: 'missing.txt' })).rejects.toMatchObject({
          code: AdapterErrorCode.SCRIPT_NOT_FOUND,
          message: expect.stringContaining(path.join(tmp, 'missing.txt'))
        });
      });
    });

    describe('modules', () => {
      it('builds each module with -m and puts their directories on COB_LIBRARY_PATH', async () => {
        vi.stubEnv('COB_LIBRARY_PATH', undefined);
        const exe = buildResult('hello');
        const mod1 = buildResult('mod1', { binaryPath: path.join(tmp, 'm1', 'mod1.so'), artifactDir: path.join(tmp, 'm1') });
        const mod2 = buildResult('mod2', { binaryPath: path.join(tmp, 'm2', 'mod2.so'), artifactDir: path.join(tmp, 'm2') });
        buildMock.mockResolvedValueOnce(exe).mockResolvedValueOnce(mod1).mockResolvedValueOnce(mod2);

        const launch = await transformLaunch({ program: 'hello.cob', cwd: tmp, modules: ['mod1.cob', path.join('lib', 'mod2.cob')], dialect: 'mf' });

        expect(buildMock).toHaveBeenCalledTimes(3);
        expect(buildMock.mock.calls[1][0]).toEqual({
          program: path.join(tmp, 'mod1.cob'),
          mode: 'module',
          dialect: 'mf',
          format: undefined,
          copybookDirs: [],
          cobcFlags: undefined,
          runtimeChecks: undefined,
          forceRebuild: false
        });
        expect(buildMock.mock.calls[2][0]).toMatchObject({ program: path.join(tmp, 'lib', 'mod2.cob'), mode: 'module' });
        expect(launch.env?.COB_LIBRARY_PATH).toBe([path.join(tmp, 'm1'), path.join(tmp, 'm2')].join(path.delimiter));
        expect(shimOptions(launch).manifestDirs).toEqual([exe.artifactDir, path.join(tmp, 'm1'), path.join(tmp, 'm2')]);
      });

      it('appends an inherited COB_LIBRARY_PATH after the module directories', async () => {
        vi.stubEnv('COB_LIBRARY_PATH', '/inherited/libs');
        buildMock.mockResolvedValueOnce(buildResult('hello')).mockResolvedValueOnce(buildResult('mod1', { artifactDir: path.join(tmp, 'm1') }));

        const launch = await transformLaunch({ program: 'hello.cob', cwd: tmp, modules: ['mod1.cob'] });

        expect(launch.env?.COB_LIBRARY_PATH).toBe([path.join(tmp, 'm1'), '/inherited/libs'].join(path.delimiter));
      });

      // BUG: cobol-debug-adapter.ts transformLaunchConfig (the COB_LIBRARY_PATH block followed
      // by `launchConfig.env = { ...launchEnv, ...(env || {}) }`) reads `env.COB_LIBRARY_PATH`
      // to append it after the module dirs, then the spread of the user's env overwrites the
      // merged value with the user's bare one — so with `modules` AND `env.COB_LIBRARY_PATH`
      // the freshly built modules are NOT on the library path and CALL fails at runtime.
      // Expected: `<module dirs>${path.delimiter}<user value>`. Flip this on once fixed.
      it('keeps the module directories ahead of a user-supplied COB_LIBRARY_PATH', async () => {
        buildMock.mockResolvedValueOnce(buildResult('hello')).mockResolvedValueOnce(buildResult('mod1', { artifactDir: path.join(tmp, 'm1') }));

        const launch = await transformLaunch({ program: 'hello.cob', cwd: tmp, modules: ['mod1.cob'], env: { COB_LIBRARY_PATH: '/user/libs' } });

        expect(launch.env?.COB_LIBRARY_PATH).toBe([path.join(tmp, 'm1'), '/user/libs'].join(path.delimiter));
      });

      it('throws naming the module when a module build fails', async () => {
        buildMock.mockResolvedValueOnce(buildResult('hello')).mockResolvedValueOnce(buildResult('mod1', { success: false, error: 'boom' }));

        await expect(transformLaunch({ program: 'hello.cob', cwd: tmp, modules: ['mod1.cob'] }))
          .rejects.toThrow('COBOL module compile failed for mod1.cob: boom');
      });
    });

    describe('prebuilt executables', () => {
      it('regenerates the manifest from sources with a manifest-only build and launches the binary as given', async () => {
        const exe = path.join(tmp, 'app');
        const manifestBuild = buildResult('app', { binaryPath: exe });
        buildMock.mockResolvedValue(manifestBuild);

        const launch = await transformLaunch({ program: 'app', cwd: tmp, sources: ['hello.cob'], dialect: 'ibm', runtimeChecks: true });

        expect(buildMock).toHaveBeenCalledWith({
          program: exe,
          sources: [path.join(tmp, 'hello.cob')],
          mode: 'manifest-only',
          dialect: 'ibm',
          format: undefined,
          copybookDirs: [],
          cobcFlags: undefined,
          runtimeChecks: true,
          forceRebuild: false
        });
        expect(launch.program).toBe(exe);
        expect(shimOptions(launch).manifestDirs).toEqual([manifestBuild.artifactDir]);
        expect(adapter.consumeLastBuild()).toBe(manifestBuild);
      });

      it('only warns when manifest regeneration fails, and still launches', async () => {
        buildMock.mockResolvedValue(buildResult('app', { success: false, error: 'cobc exited with code 1' }));

        const launch = await transformLaunch({ program: 'app', cwd: tmp, sources: ['hello.cob'] });

        expect(launch.program).toBe(path.join(tmp, 'app'));
        expect(shimOptions(launch).manifestDirs).toEqual([]);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/Symbol manifest regeneration failed \(cobc exited with code 1\)/));
      });

      it('warns about the missing manifest when neither sources nor manifestDirs are given', async () => {
        const launch = await transformLaunch({ program: 'app', cwd: tmp });

        expect(builderCtor).not.toHaveBeenCalled();
        expect(shimOptions(launch).manifestDirs).toEqual([]);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/Prebuilt executable without "sources" or "manifestDirs"/));
      });

      it('warns differently when sources are given but cobc is unavailable', async () => {
        vi.mocked(findCobc).mockResolvedValue(null);

        const launch = await transformLaunch({ program: 'app', cwd: tmp, sources: ['hello.cob'] });

        expect(builderCtor).not.toHaveBeenCalled();
        expect(launch.program).toBe(path.join(tmp, 'app'));
        expect(launch.env).toEqual({});
        expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/"sources" given but cobc is not available/));
      });

      it('passes manifestDirs through resolved against cwd, without building or warning', async () => {
        const launch = await transformLaunch({ program: 'app', cwd: tmp, manifestDirs: ['manifests', path.join(tmp, 'other')] });

        expect(builderCtor).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(shimOptions(launch).manifestDirs).toEqual([path.join(tmp, 'manifests'), path.join(tmp, 'other')]);
      });

      it('combines user manifestDirs with the build\'s artifact dir, de-duplicated', async () => {
        const result = buildResult('hello');
        buildMock.mockResolvedValue(result);

        const launch = await transformLaunch({ program: 'hello.cob', cwd: tmp, manifestDirs: ['extra', result.artifactDir as string] });

        // The fresh build first: the shim keeps the first definition of a C function.
        expect(shimOptions(launch).manifestDirs).toEqual([result.artifactDir, path.join(tmp, 'extra')]);
      });
    });

    describe('CodeLLDB pass-through', () => {
      it('passes advanced CodeLLDB keys through untouched and translates the legacy console key', async () => {
        const launch = await transformLaunch({
          program: 'app',
          cwd: tmp,
          manifestDirs: ['m'],
          targetCreateCommands: ['target create -c core.dump'],
          expressions: 'native',
          breakpointMode: 'file',
          relativePathBase: '/src',
          console: 'integratedTerminal',
          initCommands: ['settings set target.x true'],
          engineScopes: true
        });

        expect(launch.targetCreateCommands).toEqual(['target create -c core.dump']);
        expect(launch.expressions).toBe('native');
        expect(launch.breakpointMode).toBe('file');
        expect(launch.relativePathBase).toBe('/src');
        expect(launch.initCommands).toEqual(['settings set target.x true']);
        expect(launch.terminal).toBe('integrated');
        expect(launch).not.toHaveProperty('console');
        expect(shimOptions(launch).engineScopes).toBe(true);
      });

      it('lets an explicit terminal win over console', async () => {
        const launch = await transformLaunch({ program: 'app', cwd: tmp, manifestDirs: ['m'], terminal: 'external', console: 'internalConsole' });
        expect(launch.terminal).toBe('external');
      });

      it('never leaks the COBOL build keys into the CodeLLDB config', async () => {
        buildMock.mockResolvedValue(buildResult('hello'));

        const launch = await transformLaunch({ program: 'hello.cob', cwd: tmp, sources: [], modules: [], dialect: 'ibm', copybookDirs: [], cobcFlags: [], runtimeChecks: true, forceRebuild: false, engineScopes: false, manifestDirs: [] });

        for (const key of ['sources', 'modules', 'dialect', 'format', 'copybookDirs', 'cobcFlags', 'runtimeChecks', 'forceRebuild', 'stdinFile', 'engineScopes', 'manifestDirs']) {
          expect(launch).not.toHaveProperty(key);
        }
      });
    });

    describe('env merge', () => {
      it('lets the user\'s env win over the cobc environment', async () => {
        buildMock.mockResolvedValue(buildResult('hello'));

        const launch = await transformLaunch({ program: 'hello.cob', cwd: tmp, env: { PATH: '/user/bin', COB_SET_DEBUG: 'Y' } });

        expect(launch.env).toEqual({ PATH: '/user/bin', COB_CONFIG_DIR: cobcLinux.configDir, COB_SET_DEBUG: 'Y' });
      });

      it('leaves env untouched for a prebuilt launch without cobc', async () => {
        vi.mocked(findCobc).mockResolvedValue(null);

        const launch = await transformLaunch({ program: 'app', cwd: tmp, manifestDirs: ['m'], env: { A: '1' } });

        expect(launch.env).toEqual({ A: '1' });
      });
    });
  });

  describe('runner: cobcrun', () => {
    const moduleResult = (name: string): CobolBuildResult => {
      const artifactDir = path.join(tmp, '.debug-mcp', 'cobol', name, 'abc123abc123');
      return buildResult(name, { artifactDir, binaryPath: path.join(artifactDir, `${name}.so`), manifestPaths: [path.join(artifactDir, `${name.toLowerCase()}.cobol-symbols.json`)] });
    };

    it('builds the program as a module and launches cobcrun with the PROGRAM-ID, its directory first on COB_LIBRARY_PATH', async () => {
      const main = moduleResult('DYNMAIN');
      const mod = moduleResult('MOD1');
      buildMock.mockResolvedValueOnce(main).mockResolvedValueOnce(mod);

      const launch = await transformLaunch({ program: 'main.cob', cwd: tmp, runner: 'cobcrun', modules: ['mod1.cob'], args: ['--batch'] });

      expect(buildMock.mock.calls[0][0]).toMatchObject({ mode: 'module', program: path.join(tmp, 'main.cob') });
      expect(buildMock.mock.calls[1][0]).toMatchObject({ mode: 'module', program: path.join(tmp, 'mod1.cob') });
      expect(launch.program).toBe(path.join('/opt/gnucobol/bin', 'cobcrun'));
      expect(launch.args).toEqual(['DYNMAIN', '--batch']);
      const libraryPath = (launch.env as Record<string, string>).COB_LIBRARY_PATH.split(path.delimiter);
      expect(libraryPath.slice(0, 2)).toEqual([main.artifactDir, mod.artifactDir]);
      expect(shimOptions(launch).manifestDirs).toEqual([main.artifactDir, mod.artifactDir]);
    });

    it('uses cobcrun.exe on win32', async () => {
      buildMock.mockResolvedValueOnce(moduleResult('DYNMAIN'));
      const win = new CobolDebugAdapter(createDependencies(), 'win32');

      const launch = await transformLaunch({ program: 'main.cob', cwd: tmp, runner: 'cobcrun' }, win);

      expect(launch.program).toBe(path.join('/opt/gnucobol/bin', 'cobcrun.exe'));
      expect(launch.args).toEqual(['DYNMAIN']);
    });

    it('runs a prebuilt module by name from its own directory and regenerates its manifest from sources', async () => {
      buildMock.mockResolvedValueOnce(buildResult('MOD1'));
      const modulePath = path.join(tmp, 'lib', 'MOD1.so');

      const launch = await transformLaunch({ program: modulePath, cwd: tmp, runner: 'cobcrun', sources: ['mod1.cob'] });

      expect(launch.program).toBe(path.join('/opt/gnucobol/bin', 'cobcrun'));
      expect(launch.args).toEqual(['MOD1']);
      expect((launch.env as Record<string, string>).COB_LIBRARY_PATH.split(path.delimiter)[0]).toBe(path.join(tmp, 'lib'));
      expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'manifest-only', program: modulePath, sources: [path.join(tmp, 'mod1.cob')] }));
      expect(shimOptions(launch).manifestDirs).toEqual([buildResult('MOD1').artifactDir]);
    });

    it('refuses a prebuilt program that is not a module file for this platform', async () => {
      await expect(transformLaunch({ program: 'app', cwd: tmp, runner: 'cobcrun' })).rejects.toMatchObject({
        code: AdapterErrorCode.SCRIPT_NOT_FOUND,
        message: expect.stringMatching(/takes a COBOL source or a compiled module \(\.so on this platform\)/)
      });
      // A Windows DLL is not a module cobcrun on Linux can load.
      await expect(transformLaunch({ program: path.join(tmp, 'MOD1.dll'), cwd: tmp, runner: 'cobcrun' })).rejects.toMatchObject({ code: AdapterErrorCode.SCRIPT_NOT_FOUND });
      expect(buildMock).not.toHaveBeenCalled();
    });

    it('builds a program with statically linked sources as one module (-b is the builder\'s job; the sources travel)', async () => {
      buildMock.mockResolvedValueOnce(moduleResult('DYNMAIN'));
      fs.writeFileSync(path.join(tmp, 'sub.cob'), '');
      await transformLaunch({ program: 'main.cob', cwd: tmp, runner: 'cobcrun', sources: ['sub.cob'] });
      expect(buildMock.mock.calls[0][0]).toMatchObject({ mode: 'module', program: path.join(tmp, 'main.cob'), sources: [path.join(tmp, 'sub.cob')] });
    });

    it('builds `modules` for a prebuilt program too, and needs cobc for them', async () => {
      const mod = moduleResult('MOD1');
      buildMock.mockResolvedValueOnce(mod);
      const launch = await transformLaunch({ program: path.join(tmp, 'lib', 'MAIN.so'), cwd: tmp, runner: 'cobcrun', modules: ['mod1.cob'] });
      expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'module', program: path.join(tmp, 'mod1.cob') }));
      const libraryPath = (launch.env as Record<string, string>).COB_LIBRARY_PATH.split(path.delimiter);
      expect(libraryPath.slice(0, 2)).toEqual([path.join(tmp, 'lib'), mod.artifactDir]);
      expect(shimOptions(launch).manifestDirs).toEqual([mod.artifactDir]);

      vi.mocked(findCobc).mockResolvedValue(null);
      const noCobc = new CobolDebugAdapter(createDependencies(), 'linux');
      await expect(transformLaunch({ program: 'app', cwd: tmp, manifestDirs: ['m'], modules: ['mod1.cob'] }, noCobc)).rejects.toMatchObject({
        code: AdapterErrorCode.ENVIRONMENT_INVALID,
        message: expect.stringMatching(/"modules" are compiled with GnuCOBOL/)
      });
    });

    it('fails as ENVIRONMENT_INVALID without cobc, and when cobcrun is missing beside it', async () => {
      vi.mocked(findCobc).mockResolvedValue(null);
      const noCobc = new CobolDebugAdapter(createDependencies(), 'linux');
      await expect(transformLaunch({ program: path.join(tmp, 'MOD1.so'), cwd: tmp, runner: 'cobcrun' }, noCobc)).rejects.toMatchObject({
        code: AdapterErrorCode.ENVIRONMENT_INVALID,
        message: expect.stringMatching(/cobcrun ships beside cobc/)
      });

      vi.mocked(findCobc).mockResolvedValue(cobcLinux);
      cobcrunExists.value = false;
      buildMock.mockResolvedValueOnce(moduleResult('DYNMAIN'));
      const noLoader = new CobolDebugAdapter(createDependencies(), 'linux');
      await expect(transformLaunch({ program: 'main.cob', cwd: tmp, runner: 'cobcrun' }, noLoader)).rejects.toMatchObject({
        code: AdapterErrorCode.ENVIRONMENT_INVALID,
        message: expect.stringMatching(/cobcrun does not exist/)
      });
    });
  });

  describe('transformAttachConfig', () => {
    it('maps a numeric processId to the lldb attach shape with stopOnEntry defaulting to true', async () => {
      expect(await adapter.transformAttachConfig({ request: 'attach', processId: 4242 })).toEqual({
        type: 'lldb',
        request: 'attach',
        pid: 4242,
        stopOnEntry: true,
        [COBOL_PRIVATE_KEY]: { manifestDirs: [], engineScopes: false }
      });
    });

    it('accepts a numeric string pid and honours stopOnEntry: false', async () => {
      const result = await adapter.transformAttachConfig({ request: 'attach', processId: '77', stopOnEntry: false });
      expect(result.pid).toBe(77);
      expect(result.stopOnEntry).toBe(false);
    });

    it('resolves manifestDirs against cwd into the private block and keeps cwd out of the engine config', async () => {
      const result = await adapter.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, manifestDirs: ['m1', path.join(tmp, 'm2')], engineScopes: true });

      expect(result[COBOL_PRIVATE_KEY]).toEqual({ manifestDirs: [path.join(tmp, 'm1'), path.join(tmp, 'm2')], engineScopes: true });
      expect(result).not.toHaveProperty('cwd');
      expect(result).not.toHaveProperty('manifestDirs');
      expect(result).not.toHaveProperty('engineScopes');
    });

    it('passes program and advanced keys through for symbol resolution, program resolved against cwd', async () => {
      const result = await adapter.transformAttachConfig({ request: 'attach', processId: 7, program: '/opt/app/server', initCommands: ['x'], waitFor: true });
      expect(result).toMatchObject({ program: path.resolve('/opt/app/server'), initCommands: ['x'], waitFor: true });
      // A relative program is what CodeLLDB would resolve against ITS cwd (review of #761): sent absolute.
      const relative = await adapter.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, program: 'bin/payroll' });
      expect(relative.program).toBe(path.join(tmp, 'bin', 'payroll'));
      expect(relative).not.toHaveProperty('cwd');
      expect(buildMock).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/Attach without "sources" or "manifestDirs"/));
    });

    it('regenerates the manifest from sources with a translate-only build beside the named program, ahead of manifestDirs', async () => {
      buildMock.mockResolvedValue(buildResult('payroll'));

      const result = await adapter.transformAttachConfig({
        request: 'attach',
        processId: 7,
        cwd: tmp,
        program: 'bin/payroll',
        sources: ['src/payroll.cob', path.join(tmp, 'src', 'sub.cob')],
        dialect: 'ibm',
        copybookDirs: ['cpy'],
        runtimeChecks: true,
        manifestDirs: ['old']
      });

      expect(buildMock).toHaveBeenCalledWith({
        program: path.join(tmp, 'bin', 'payroll'),
        sources: [path.join(tmp, 'src', 'payroll.cob'), path.join(tmp, 'src', 'sub.cob')],
        mode: 'manifest-only',
        dialect: 'ibm',
        format: undefined,
        copybookDirs: [path.join(tmp, 'cpy')],
        cobcFlags: undefined,
        runtimeChecks: true,
        forceRebuild: false
      });
      // The translate runs under the attach timeout (30 s default) less a margin.
      expect(builderCtor).toHaveBeenLastCalledWith(expect.objectContaining({ timeoutMs: 25_000 }));
      expect(result[COBOL_PRIVATE_KEY]).toEqual({ manifestDirs: [buildResult('payroll').artifactDir, path.join(tmp, 'old')], engineScopes: false });
      // The build options are consumed here, not forwarded to the engine.
      expect(result).toMatchObject({ pid: 7, program: path.join(tmp, 'bin', 'payroll') });
      for (const key of ['sources', 'dialect', 'copybookDirs', 'runtimeChecks', 'manifestDirs']) {
        expect(result).not.toHaveProperty(key);
      }
      expect(adapter.buildAdapterCommand(adapterConfig({ logDir: '' })).args).toContain(buildResult('payroll').artifactDir);
    });

    it('anchors the regeneration on the first source when no program is named', async () => {
      buildMock.mockResolvedValue(buildResult('pause'));

      await adapter.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, sources: ['pause.cob'] });

      expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({ program: path.join(tmp, 'pause.cob'), mode: 'manifest-only' }));
    });

    it('fails the attach when the regeneration fails, naming the knobs; attaches with a warning when cobc is missing', async () => {
      buildMock.mockResolvedValue({ ...buildResult('pause'), success: false, error: 'cobc timed out after 25000 ms' });
      await expect(adapter.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, sources: ['pause.cob'] })).rejects.toMatchObject({
        code: AdapterErrorCode.ENVIRONMENT_INVALID,
        message: expect.stringMatching(/regeneration failed: cobc timed out after 25000 ms\. Raise "timeout".*"manifestDirs".*omit "sources"/)
      });

      vi.mocked(findCobc).mockResolvedValue(null);
      const fresh = new CobolDebugAdapter(createDependencies(), 'linux');
      logger.warn.mockClear();
      const noCobc = await fresh.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, sources: ['pause.cob'], manifestDirs: ['m'] });
      expect(noCobc[COBOL_PRIVATE_KEY]).toEqual({ manifestDirs: [path.join(tmp, 'm')], engineScopes: false });
      // manifestDirs still supply a manifest: an info line, not the no-manifest warning.
      expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/"sources" given but cobc is not available; using the manifests in "manifestDirs"/));
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringMatching(/"sources" given but cobc is not available: no COBOL symbol manifest/));
      const bare = await fresh.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, sources: ['pause.cob'] });
      expect(bare[COBOL_PRIVATE_KEY]).toEqual({ manifestDirs: [], engineScopes: false });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/"sources" given but cobc is not available: no COBOL symbol manifest/));
    });

    it('warns when build options come without sources (nothing regenerates), and stays quiet otherwise', async () => {
      await adapter.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, manifestDirs: ['m'], dialect: 'ibm', runtimeChecks: true });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/dialect, runtimeChecks given without "sources"/));
      logger.warn.mockClear();
      await adapter.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, manifestDirs: ['m'] });
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringMatching(/given without "sources"/));
    });

    it('honours the caller\'s attach timeout as the regeneration budget', async () => {
      buildMock.mockResolvedValue(buildResult('pause'));
      await adapter.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, sources: ['pause.cob'], timeout: 12_000 });
      expect(builderCtor).toHaveBeenLastCalledWith(expect.objectContaining({ timeoutMs: 7_000 }));
    });

    it('rejects anything but a positive integer pid as UNSUPPORTED_OPERATION', async () => {
      for (const config of [
        { request: 'attach' as const },
        { request: 'attach' as const, processId: 'not-a-pid' },
        { request: 'attach' as const, processId: 0 },
        { request: 'attach' as const, processId: 12.5 },
        { request: 'attach' as const, processName: 'hello' }
      ]) {
        let caught: unknown;
        try {
          await adapter.transformAttachConfig(config);
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(AdapterError);
        expect((caught as AdapterError).code).toBe(AdapterErrorCode.UNSUPPORTED_OPERATION);
        expect((caught as AdapterError).message).toMatch(/numeric processId/);
      }
    });
  });

  describe('buildAdapterCommand', () => {
    it('spawns node on the shim with the session options and hands CodeLLDB over after "--"', async () => {
      vi.mocked(buildCodeLLDBArgs).mockReturnValue(['--port', '4711', '--liblldb', '/vendor/lldb/lib/liblldb.so']);
      await transformLaunch({ program: 'app', cwd: tmp, manifestDirs: ['m1', 'm2'], engineScopes: true });

      const command = adapter.buildAdapterCommand(adapterConfig());

      expect(command.command).toBe(process.execPath);
      expect(command.args[0]).toBe(SHIM_FIRST_CANDIDATE);
      expect(command.args.slice(1)).toEqual([
        '--port', '4711',
        '--manifest-dir', path.join(tmp, 'm1'),
        '--manifest-dir', path.join(tmp, 'm2'),
        '--log', path.join('/tmp', 'logs', 'cobol-shim-s1.log'),
        '--engine-scopes',
        '--', CODELLDB, '--liblldb', '/vendor/lldb/lib/liblldb.so'
      ]);
      expect(buildCodeLLDBArgs).toHaveBeenCalledWith(CODELLDB, 4711, 'linux', logger);
      expect(resolveCodeLLDBExecutableSyncImpl).toHaveBeenCalledWith({ platform: 'linux', packageRoot: PACKAGE_ROOT });
      expect(logger.info).toHaveBeenCalledWith(`[CobolDebugAdapter] Using shim ${SHIM_FIRST_CANDIDATE} over CodeLLDB at ${CODELLDB}`);
    });

    it('is minimal before any transform and without a log dir', () => {
      const command = adapter.buildAdapterCommand(adapterConfig({ logDir: '' }));

      expect(command.args.slice(1)).toEqual(['--port', '4711', '--', CODELLDB]);
    });

    it('passes --stdin-file and the native PDB reader flag on win32 only', async () => {
      vi.stubEnv('LLDB_USE_NATIVE_PDB_READER', undefined);
      fs.writeFileSync(path.join(tmp, 'in.txt'), '');
      const stdinPath = path.join(tmp, 'in.txt');

      const win = new CobolDebugAdapter(createDependencies(), 'win32');
      await transformLaunch({ program: 'app', cwd: tmp, manifestDirs: ['m'], stdinFile: 'in.txt' }, win);
      const winCommand = win.buildAdapterCommand(adapterConfig());
      expect(winCommand.args).toContain('--stdin-file');
      expect(winCommand.args[winCommand.args.indexOf('--stdin-file') + 1]).toBe(stdinPath);
      expect(winCommand.env?.LLDB_USE_NATIVE_PDB_READER).toBe('1');

      await transformLaunch({ program: 'app', cwd: tmp, manifestDirs: ['m'], stdinFile: 'in.txt' });
      const linuxCommand = adapter.buildAdapterCommand(adapterConfig());
      expect(linuxCommand.args).not.toContain('--stdin-file');
      expect(linuxCommand.env).not.toHaveProperty('LLDB_USE_NATIVE_PDB_READER');
    });

    it('puts the cobc bin dir on PATH and pins COB_CONFIG_DIR once cobc has been located', async () => {
      vi.stubEnv('COB_CONFIG_DIR', undefined);
      const before = adapter.buildAdapterCommand(adapterConfig());
      expect(before.env).not.toHaveProperty('COB_CONFIG_DIR');

      await adapter.validateEnvironment();
      const after = adapter.buildAdapterCommand(adapterConfig());

      expect(after.env?.COB_CONFIG_DIR).toBe(cobcLinux.configDir);
      expect(pathEntries(after.env).some((entries) => entries[0] === cobcLinux.binDir)).toBe(true);
    });

    it('reuses the manifest dirs of the last attach transform', async () => {
      await adapter.transformAttachConfig({ request: 'attach', processId: 7, cwd: tmp, manifestDirs: ['m'] });

      const command = adapter.buildAdapterCommand(adapterConfig({ logDir: '' }));

      expect(command.args.slice(1)).toEqual(['--port', '4711', '--manifest-dir', path.join(tmp, 'm'), '--', CODELLDB]);
    });

    it('throws ENVIRONMENT_INVALID when CodeLLDB cannot be resolved', () => {
      vi.mocked(resolveCodeLLDBExecutableSyncImpl).mockReturnValue(null);

      expect(() => adapter.buildAdapterCommand(adapterConfig())).toThrow(
        expect.objectContaining({ code: AdapterErrorCode.ENVIRONMENT_INVALID, message: expect.stringMatching(/CodeLLDB executable not found/) })
      );
    });

    it('throws ENVIRONMENT_INVALID for a missing TCP port', () => {
      expect(() => adapter.buildAdapterCommand(adapterConfig({ adapterPort: 0 }))).toThrow(
        expect.objectContaining({ code: AdapterErrorCode.ENVIRONMENT_INVALID, message: expect.stringMatching(/Valid TCP port required/) })
      );
    });

    it('throws ENVIRONMENT_INVALID and lists the candidates when the shim is not built', () => {
      shimExists.value = false;

      expect(() => adapter.buildAdapterCommand(adapterConfig())).toThrow(
        expect.objectContaining({ code: AdapterErrorCode.ENVIRONMENT_INVALID, message: expect.stringMatching(/cobol-shim\.js not found/) })
      );
      expect(logger.error).toHaveBeenCalledWith('[CobolDebugAdapter] cobol-shim.js not found. Searched:');
      expect(logger.error).toHaveBeenCalledWith(`  ${SHIM_FIRST_CANDIDATE}: NOT FOUND`);
    });
  });

  describe('capabilities and features', () => {
    it('advertises the single cobol_runtime_error filter, on by default, and no function breakpoints or logpoints', () => {
      const caps = adapter.getCapabilities();

      expect(caps.supportsFunctionBreakpoints).toBe(false);
      expect(caps.supportsLogPoints).toBe(false);
      expect(caps.exceptionBreakpointFilters).toEqual([
        expect.objectContaining({ filter: 'cobol_runtime_error', label: 'COBOL: runtime error', default: true })
      ]);
      expect(caps.supportsConditionalBreakpoints).toBe(true);
      expect(caps.supportsExceptionInfoRequest).toBe(true);
      expect(caps.supportsDataBreakpoints).toBe(false);
      expect(caps.supportsSetVariable).toBe(false);
    });

    it('matches supportsFeature to the capabilities and explains the M3 deferrals', () => {
      expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.EXCEPTION_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.FUNCTION_BREAKPOINTS)).toBe(false);
      expect(adapter.supportsFeature(DebugFeature.LOG_POINTS)).toBe(false);
      expect(adapter.getFeatureRequirements(DebugFeature.FUNCTION_BREAKPOINTS)[0].description).toMatch(/milestone M3/);
      expect(adapter.getFeatureRequirements(DebugFeature.LOG_POINTS)[0].description).toMatch(/milestone M3/);
      expect(adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS)).toEqual([]);
    });
  });

  describe('error translation', () => {
    it('explains a missing cobc, a missing dialect configuration, and leaves the rest alone', () => {
      expect(adapter.translateErrorMessage(new Error('cobc: command not found'))).toMatch(/^GnuCOBOL compiler \(cobc\) not found/);
      expect(adapter.translateErrorMessage(new Error('configuration error: /mingw64/share/gnucobol/config/default.conf: No such file')))
        .toMatch(/set COB_CONFIG_DIR to <GnuCOBOL prefix>\/share\/gnucobol\/config/);
      expect(adapter.translateErrorMessage(new Error('something else'))).toBe('something else');
      expect(adapter.getInstallationInstructions()).toMatch(/-gdwarf-4/);
    });
  });
});
