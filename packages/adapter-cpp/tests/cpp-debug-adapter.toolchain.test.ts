/**
 * Lifecycle, toolchain-gating, DAP-operation, and error-translation coverage
 * for CppDebugAdapter (the launch/attach transform surface lives in
 * cpp-adapter.test.ts). Mirrors rust-debug-adapter.toolchain.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as path from 'path';
import {
  AdapterError,
  AdapterState,
  DebugFeature
} from '@debugmcp/shared';
import type { AdapterConfig, AdapterDependencies } from '@debugmcp/shared';

const accessMock: Mock = vi.fn();

// The adapter imports `promises` from 'fs' (not 'fs/promises') — intercept
// promises.access there while keeping the sync surface real for
// codelldb-common's existsSync probes.
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      access: (...args: unknown[]) => accessMock(...args)
    }
  };
});

vi.mock('@debugmcp/codelldb-common', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveCodeLLDBExecutable: vi.fn(),
  resolveCodeLLDBExecutableSyncImpl: vi.fn(),
  detectBinaryFormat: vi.fn()
}));

vi.mock('../src/utils/compile-utils.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findAnyCompiler: vi.fn(),
  findCompiler: vi.fn(),
  needsRecompile: vi.fn(),
  compileSourceFile: vi.fn()
}));

import {
  resolveCodeLLDBExecutable,
  resolveCodeLLDBExecutableSyncImpl,
  detectBinaryFormat
} from '@debugmcp/codelldb-common';
import { findAnyCompiler, needsRecompile } from '../src/utils/compile-utils.js';
import { CppDebugAdapter } from '../src/cpp-debug-adapter.js';

const gnuBinaryInfo = {
  format: 'gnu' as const,
  hasPDB: false,
  hasRSDS: false,
  imports: [],
  debugInfoType: 'dwarf' as const
};

const msvcBinaryInfo = {
  format: 'msvc' as const,
  hasPDB: true,
  hasRSDS: true,
  imports: ['vcruntime140.dll'],
  debugInfoType: 'pdb' as const
};

const createDependencies = (env: Record<string, string> = {}): AdapterDependencies => ({
  fileSystem: {} as AdapterDependencies['fileSystem'],
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  } as unknown as AdapterDependencies['logger'],
  environment: {
    get: vi.fn((key: string) => env[key]),
    getAll: vi.fn().mockReturnValue(env),
    getCurrentWorkingDirectory: vi.fn().mockReturnValue(process.cwd())
  } as unknown as AdapterDependencies['environment']
});

describe('CppDebugAdapter lifecycle and toolchain', () => {
  let dependencies: AdapterDependencies;

  beforeEach(() => {
    accessMock.mockReset();
    vi.mocked(resolveCodeLLDBExecutable).mockReset().mockResolvedValue('/vendor/adapter/codelldb');
    vi.mocked(resolveCodeLLDBExecutableSyncImpl).mockReset().mockReturnValue('/vendor/adapter/codelldb');
    vi.mocked(detectBinaryFormat).mockReset().mockResolvedValue(gnuBinaryInfo);
    vi.mocked(findAnyCompiler).mockReset().mockResolvedValue('g++');
    vi.mocked(needsRecompile).mockReset().mockResolvedValue(false);
    dependencies = createDependencies();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('initialize', () => {
    it('transitions to READY and emits initialized on a valid environment', async () => {
      const adapter = new CppDebugAdapter(dependencies);
      const initialized = vi.fn();
      const stateChanges: Array<[AdapterState, AdapterState]> = [];
      adapter.on('initialized', initialized);
      adapter.on('stateChanged', (from: AdapterState, to: AdapterState) => stateChanges.push([from, to]));

      await adapter.initialize();

      expect(adapter.getState()).toBe(AdapterState.READY);
      expect(adapter.isReady()).toBe(true);
      expect(initialized).toHaveBeenCalled();
      expect(stateChanges).toContainEqual([AdapterState.UNINITIALIZED, AdapterState.INITIALIZING]);
      expect(stateChanges).toContainEqual([AdapterState.INITIALIZING, AdapterState.READY]);
    });

    it('logs warnings (missing compiler) but still initializes', async () => {
      vi.mocked(findAnyCompiler).mockResolvedValue(null);
      const adapter = new CppDebugAdapter(dependencies);

      await adapter.initialize();

      expect(adapter.getState()).toBe(AdapterState.READY);
      expect(dependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No C/C++ compiler found')
      );
    });

    it('throws and lands in ERROR state when CodeLLDB is missing', async () => {
      vi.mocked(resolveCodeLLDBExecutable).mockResolvedValue(null);
      const adapter = new CppDebugAdapter(dependencies);

      await expect(adapter.initialize()).rejects.toThrow(AdapterError);
      expect(adapter.getState()).toBe(AdapterState.ERROR);
      expect(adapter.isReady()).toBe(false);
    });

    it('surfaces validation exceptions as VALIDATION_ERROR and fails initialize', async () => {
      vi.mocked(resolveCodeLLDBExecutable).mockRejectedValue(new Error('vendor walk exploded'));
      const adapter = new CppDebugAdapter(dependencies);

      const validation = await adapter.validateEnvironment();
      expect(validation.valid).toBe(false);
      expect(validation.errors[0].code).toBe('VALIDATION_ERROR');
      expect(validation.errors[0].message).toContain('vendor walk exploded');

      await expect(adapter.initialize()).rejects.toThrow('vendor walk exploded');
      expect(adapter.getState()).toBe(AdapterState.ERROR);
    });
  });

  describe('dispose', () => {
    it('resets state and emits disposed', async () => {
      const adapter = new CppDebugAdapter(dependencies);
      await adapter.initialize();
      await adapter.connect('127.0.0.1', 4711);
      const disposed = vi.fn();
      adapter.on('disposed', disposed);

      await adapter.dispose();

      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getCurrentThreadId()).toBeNull();
      expect(disposed).toHaveBeenCalled();
    });
  });

  describe('connection management', () => {
    it('tracks connect and disconnect with events and state', async () => {
      const adapter = new CppDebugAdapter(dependencies);
      const connected = vi.fn();
      const disconnected = vi.fn();
      adapter.on('connected', connected);
      adapter.on('disconnected', disconnected);

      expect(adapter.isConnected()).toBe(false);
      await adapter.connect('127.0.0.1', 4711);
      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
      expect(adapter.isReady()).toBe(true);
      expect(connected).toHaveBeenCalled();

      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
      expect(disconnected).toHaveBeenCalled();
    });
  });

  describe('handleDapEvent', () => {
    it('tracks the current thread and DEBUGGING state on stopped events', () => {
      const adapter = new CppDebugAdapter(dependencies);
      const stopped = vi.fn();
      adapter.on('stopped', stopped);

      expect(adapter.getCurrentThreadId()).toBeNull();
      adapter.handleDapEvent({ seq: 1, type: 'event', event: 'stopped', body: { threadId: 42, reason: 'breakpoint' } });

      expect(adapter.getCurrentThreadId()).toBe(42);
      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
      expect(stopped).toHaveBeenCalledWith(expect.objectContaining({ threadId: 42 }));
    });

    it('clears the thread on terminated and returns to CONNECTED when connected', async () => {
      const adapter = new CppDebugAdapter(dependencies);
      await adapter.connect('127.0.0.1', 4711);
      adapter.handleDapEvent({ seq: 1, type: 'event', event: 'stopped', body: { threadId: 7, reason: 'step' } });

      adapter.handleDapEvent({ seq: 2, type: 'event', event: 'terminated', body: {} });

      expect(adapter.getCurrentThreadId()).toBeNull();
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
    });

    it('clears the thread on exited without state change when not connected', () => {
      const adapter = new CppDebugAdapter(dependencies);
      adapter.handleDapEvent({ seq: 1, type: 'event', event: 'stopped', body: { threadId: 7, reason: 'step' } });

      adapter.handleDapEvent({ seq: 2, type: 'event', event: 'exited', body: { exitCode: 0 } });

      expect(adapter.getCurrentThreadId()).toBeNull();
      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
    });
  });

  describe('handleDapResponse', () => {
    it('logs failed responses as errors', () => {
      const adapter = new CppDebugAdapter(dependencies);

      adapter.handleDapResponse({ seq: 1, type: 'response', request_seq: 1, command: 'evaluate', success: false, message: 'no frame' });
      expect(dependencies.logger.error).toHaveBeenCalledWith(expect.stringContaining('no frame'));

      vi.mocked(dependencies.logger.error as Mock).mockClear();
      adapter.handleDapResponse({ seq: 2, type: 'response', request_seq: 2, command: 'threads', success: true });
      expect(dependencies.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('sendDapRequest', () => {
    it('warns about unknown exception filters and accepts the known ones', async () => {
      const adapter = new CppDebugAdapter(dependencies);

      await adapter.sendDapRequest('setExceptionBreakpoints', { filters: ['cpp_throw', 'rust_panic'] });
      expect(dependencies.logger.warn).toHaveBeenCalledWith(expect.stringContaining('rust_panic'));

      vi.mocked(dependencies.logger.warn as Mock).mockClear();
      await adapter.sendDapRequest('setExceptionBreakpoints', { filters: ['cpp_throw', 'cpp_catch'] });
      expect(dependencies.logger.warn).not.toHaveBeenCalled();
    });

    it('passes other commands through as stubs', async () => {
      const adapter = new CppDebugAdapter(dependencies);
      await expect(adapter.sendDapRequest('threads')).resolves.toEqual({});
    });
  });

  describe('resolveExecutablePath branches', () => {
    it('validates and returns a preferred path that exists', async () => {
      accessMock.mockResolvedValue(undefined);
      const adapter = new CppDebugAdapter(dependencies);

      await expect(adapter.resolveExecutablePath('/opt/gcc/bin/g++')).resolves.toBe('/opt/gcc/bin/g++');
      expect(accessMock).toHaveBeenCalledWith('/opt/gcc/bin/g++');
    });

    it('rejects a preferred path that does not exist', async () => {
      accessMock.mockRejectedValue(new Error('ENOENT'));
      const adapter = new CppDebugAdapter(dependencies);

      await expect(adapter.resolveExecutablePath('/missing/g++')).rejects.toMatchObject({
        code: 'EXECUTABLE_NOT_FOUND'
      });
    });

    it('caches the discovered compiler between calls', async () => {
      const adapter = new CppDebugAdapter(dependencies);

      await expect(adapter.resolveExecutablePath()).resolves.toBe('g++');
      await expect(adapter.resolveExecutablePath()).resolves.toBe('g++');

      expect(findAnyCompiler).toHaveBeenCalledTimes(1);
      expect(dependencies.logger.debug).toHaveBeenCalledWith(expect.stringContaining('cached executable path'));
    });

    it('honors MCP_CPP_ALLOW_PREBUILT and the placeholder override', async () => {
      vi.mocked(findAnyCompiler).mockResolvedValue(null);
      vi.stubEnv('MCP_CPP_ALLOW_PREBUILT', 'true');
      vi.stubEnv('MCP_CPP_EXECUTABLE_PLACEHOLDER', 'byo-binary');
      const adapter = new CppDebugAdapter(dependencies);

      await expect(adapter.resolveExecutablePath()).resolves.toBe('byo-binary');
      expect(dependencies.logger.warn).toHaveBeenCalledWith(expect.stringContaining('MCP_CPP_ALLOW_PREBUILT'));
    });
  });

  describe('getExecutableSearchPaths', () => {
    it.each([
      ['win32', 'C:\\msys64\\mingw64\\bin'],
      ['darwin', '/opt/homebrew/bin'],
      ['linux', '/usr/local/bin']
    ] as Array<[NodeJS.Platform, string]>)('includes platform locations on %s plus PATH', (platform, expected) => {
      const adapter = new CppDebugAdapter(dependencies, platform);
      const paths = adapter.getExecutableSearchPaths();

      expect(paths).toContain(expected);
      const firstPathEntry = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)[0];
      if (firstPathEntry) {
        expect(paths).toContain(firstPathEntry);
      }
    });
  });

  describe('MSVC toolchain gating', () => {
    it('flags MSVC binaries with remediation text and consumes the result once', async () => {
      vi.mocked(detectBinaryFormat).mockResolvedValue(msvcBinaryInfo);
      const adapter = new CppDebugAdapter(dependencies);

      const result = await adapter.validateToolchain('C:/app/msvc.exe');

      expect(result.compatible).toBe(false);
      expect(result.toolchain).toBe('msvc');
      expect(result.message).toContain('MSVC');
      expect(result.suggestions?.join(' ')).toContain('MinGW');
      expect(result.behavior).toBe('warn');

      // transformLaunchConfig stores it for the session manager to consume
      await adapter.transformLaunchConfig({ program: 'C:/app/msvc.exe' } as never);
      expect(dependencies.logger.warn).toHaveBeenCalledWith(expect.stringContaining('MSVC'));
      expect(adapter.consumeLastToolchainValidation()?.toolchain).toBe('msvc');
      expect(adapter.consumeLastToolchainValidation()).toBeUndefined();
    });

    it('reports GNU binaries compatible', async () => {
      const adapter = new CppDebugAdapter(dependencies);

      const result = await adapter.validateToolchain('/app/gnu.bin');

      expect(result).toMatchObject({ compatible: true, toolchain: 'gnu' });
    });

    it('degrades to unknown/compatible when detection throws', async () => {
      vi.mocked(detectBinaryFormat).mockRejectedValue(new Error('unreadable'));
      const adapter = new CppDebugAdapter(dependencies);

      const result = await adapter.validateToolchain('/app/odd.bin');

      expect(result).toMatchObject({ compatible: true, toolchain: 'unknown' });
      expect(dependencies.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Toolchain detection failed'));
    });

    it('CPP_MSVC_BEHAVIOR=error turns an MSVC binary into a launch failure', async () => {
      vi.mocked(detectBinaryFormat).mockResolvedValue(msvcBinaryInfo);
      const adapter = new CppDebugAdapter(createDependencies({ CPP_MSVC_BEHAVIOR: 'error' }));

      await expect(
        adapter.transformLaunchConfig({ program: 'C:/app/msvc.exe' } as never)
      ).rejects.toMatchObject({ code: 'ENVIRONMENT_INVALID' });
    });

    it('CPP_MSVC_BEHAVIOR=continue stays silent on MSVC binaries', async () => {
      vi.mocked(detectBinaryFormat).mockResolvedValue(msvcBinaryInfo);
      const deps = createDependencies({ CPP_MSVC_BEHAVIOR: 'continue' });
      const adapter = new CppDebugAdapter(deps);

      await adapter.transformLaunchConfig({ program: 'C:/app/msvc.exe' } as never);

      expect(deps.logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('MSVC'));
      expect(adapter.consumeLastToolchainValidation()?.behavior).toBe('continue');
    });

    it('unrecognized CPP_MSVC_BEHAVIOR values fall back to warn', async () => {
      vi.mocked(detectBinaryFormat).mockResolvedValue(msvcBinaryInfo);
      const adapter = new CppDebugAdapter(createDependencies({ CPP_MSVC_BEHAVIOR: 'explode' }));

      const result = await adapter.validateToolchain('C:/app/msvc.exe');
      expect(result.behavior).toBe('warn');
    });
  });

  describe('buildAdapterCommand on win32', () => {
    it('enables the native PDB reader in the spawn env', () => {
      const adapter = new CppDebugAdapter(dependencies, 'win32');
      const config: AdapterConfig = {
        sessionId: 's1',
        executablePath: 'g++',
        adapterHost: '127.0.0.1',
        adapterPort: 4711,
        logDir: '/tmp/logs',
        scriptPath: 'main.cpp',
        launchConfig: {}
      };

      const command = adapter.buildAdapterCommand(config);

      expect(command.env?.LLDB_USE_NATIVE_PDB_READER).toBe('1');
      expect(command.args.slice(0, 2)).toEqual(['--port', '4711']);
    });
  });

  describe('launch config defaults and metadata', () => {
    it('exposes sane defaults and adapter metadata', () => {
      const adapter = new CppDebugAdapter(dependencies);

      expect(adapter.getDefaultLaunchConfig()).toMatchObject({ stopOnEntry: false, justMyCode: true });
      expect(adapter.getAdapterModuleName()).toBe('codelldb');
      expect(adapter.getAdapterInstallCommand()).toContain('build:adapter');
      expect(adapter.getRequiredDependencies()).toEqual([
        expect.objectContaining({ name: 'CodeLLDB', required: true }),
        expect.objectContaining({ required: false })
      ]);
    });

    it('honors a user-specified sourceLanguages override', async () => {
      const adapter = new CppDebugAdapter(dependencies);

      const result = await adapter.transformLaunchConfig({
        program: 'app.bin',
        sourceLanguages: ['c']
      } as never);

      expect(result.sourceLanguages).toEqual(['c']);
    });
  });

  describe('error translation and guidance', () => {
    it('provides installation instructions and missing-executable guidance', () => {
      const adapter = new CppDebugAdapter(dependencies);

      expect(adapter.getInstallationInstructions()).toContain('-gdwarf-4');
      expect(adapter.getMissingExecutableError()).toContain('MCP_CPP_ALLOW_PREBUILT');
    });

    it.each([
      ['CodeLLDB executable not found', 'build:adapter'],
      ['C/C++ compiler not found anywhere', 'MCP_CPP_ALLOW_PREBUILT'],
      ['attach failed: permission denied', 'ptrace_scope'],
      ['operation failed with EPERM', 'ptrace_scope'],
      ['LLDB failed to start somehow', 'CodeLLDB is properly installed'],
      ['some totally novel failure', 'some totally novel failure']
    ])('translates %s', (input, expected) => {
      const adapter = new CppDebugAdapter(dependencies);
      expect(adapter.translateErrorMessage(new Error(input))).toContain(expected);
    });
  });

  describe('feature support', () => {
    it('reports supported and unsupported features', () => {
      const adapter = new CppDebugAdapter(dependencies);

      expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.EXCEPTION_INFO_REQUEST)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.STEP_BACK)).toBe(false);
      expect(adapter.supportsFeature(DebugFeature.REVERSE_DEBUGGING)).toBe(false);
    });

    it('lists requirements for gated features and none for plain ones', () => {
      const adapter = new CppDebugAdapter(dependencies);

      expect(adapter.getFeatureRequirements(DebugFeature.DATA_BREAKPOINTS)).toHaveLength(1);
      expect(adapter.getFeatureRequirements(DebugFeature.DISASSEMBLE_REQUEST)).toHaveLength(1);
      expect(adapter.getFeatureRequirements(DebugFeature.LOG_POINTS)).toHaveLength(1);
      expect(adapter.getFeatureRequirements(DebugFeature.SET_VARIABLE)).toHaveLength(0);
    });
  });
});
