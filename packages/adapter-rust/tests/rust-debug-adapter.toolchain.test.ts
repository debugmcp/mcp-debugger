import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { RustDebugAdapter } from '../src/rust-debug-adapter.js';
import { AdapterError, DebugFeature, AdapterState } from '@debugmcp/shared';
import type { AdapterConfig, AdapterDependencies } from '@debugmcp/shared';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('../src/utils/rust-utils.js', () => ({
  checkCargoInstallation: vi.fn(),
  checkRustInstallation: vi.fn(),
  getRustHostTriple: vi.fn(),
  findDlltoolExecutable: vi.fn()
}));

vi.mock('../src/utils/codelldb-resolver.js', () => ({
  resolveCodeLLDBExecutable: vi.fn()
}));

vi.mock('../src/utils/binary-detector.js', () => ({
  detectBinaryFormat: vi.fn()
}));

vi.mock('../src/utils/cargo-utils.js', () => ({
  findCargoProjectRoot: vi.fn(),
  getDefaultBinary: vi.fn(),
  needsRebuild: vi.fn(),
  buildCargoProject: vi.fn()
}));

import {
  checkCargoInstallation,
  checkRustInstallation,
  getRustHostTriple,
  findDlltoolExecutable
} from '../src/utils/rust-utils.js';
import { detectBinaryFormat } from '../src/utils/binary-detector.js';
import {
  findCargoProjectRoot,
  getDefaultBinary,
  needsRebuild,
  buildCargoProject
} from '../src/utils/cargo-utils.js';
import { resolveCodeLLDBExecutable } from '../src/utils/codelldb-resolver.js';

const createDependencies = (): AdapterDependencies => ({
  fileSystem: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    outputFile: vi.fn(),
    exists: vi.fn(),
    existsSync: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    ensureDir: vi.fn(),
    ensureDirSync: vi.fn(),
    pathExists: vi.fn(),
    copy: vi.fn(),
    remove: vi.fn()
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  environment: {
    get: vi.fn((key: string) => process.env[key]),
    getAll: vi.fn(() => process.env),
    getCurrentWorkingDirectory: vi.fn(() => process.cwd())
  },
  processLauncher: {
    launch: vi.fn()
  }
});

const setPlatform = (platform: NodeJS.Platform): (() => void) => {
  const original = process.platform;
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  return () => {
    Object.defineProperty(process, 'platform', { value: original, configurable: true });
  };
};

describe('RustDebugAdapter toolchain logic', () => {
  let adapter: RustDebugAdapter;
  let dependencies: AdapterDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveCodeLLDBExecutable).mockReset();
    vi.mocked(detectBinaryFormat).mockReset();
    vi.mocked(findCargoProjectRoot).mockReset();
    vi.mocked(getDefaultBinary).mockReset();
    vi.mocked(needsRebuild).mockReset();
    vi.mocked(buildCargoProject).mockReset();
    vi.mocked(checkCargoInstallation).mockReset();
    vi.mocked(checkRustInstallation).mockReset();
    vi.mocked(getRustHostTriple).mockReset();
    vi.mocked(findDlltoolExecutable).mockReset();
    delete process.env.MCP_RUST_ALLOW_PREBUILT;
    delete process.env.MCP_RUST_EXECUTABLE_PLACEHOLDER;
    delete process.env.RUST_MSVC_BEHAVIOR;
    delete process.env.RUST_AUTO_SUGGEST_GNU;
    dependencies = createDependencies();
    adapter = new RustDebugAdapter(dependencies);
  });

  describe('resolveExecutablePath', () => {
    it('returns cached executable path when available', async () => {
      checkCargoInstallation.mockResolvedValueOnce(true);
      const first = await adapter.resolveExecutablePath();
      expect(first).toBe('cargo');

      checkCargoInstallation.mockResolvedValueOnce(false);
      const second = await adapter.resolveExecutablePath();
      expect(second).toBe('cargo');
      expect(checkCargoInstallation).toHaveBeenCalledTimes(1);
    });

    it('prefers specified executable when accessible', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rda-exec-'));
      const execPath = path.join(tempDir, 'rust-binary');
      await fs.writeFile(execPath, 'bin');
      const result = await adapter.resolveExecutablePath(execPath);
      expect(result).toBe(execPath);
    });

    it('throws when preferred executable is missing', async () => {
      const missing = path.join(os.tmpdir(), `missing-${Date.now()}`);
      await expect(adapter.resolveExecutablePath(missing)).rejects.toThrow(AdapterError);
    });

    it('falls back to rustc when cargo is unavailable', async () => {
      checkCargoInstallation.mockResolvedValueOnce(false);
      checkRustInstallation.mockResolvedValueOnce(true);
      const result = await adapter.resolveExecutablePath();
      expect(result).toBe('rustc');
    });

    it('uses relaxed toolchain placeholder when allowed', async () => {
      process.env.MCP_RUST_ALLOW_PREBUILT = 'true';
      process.env.MCP_RUST_EXECUTABLE_PLACEHOLDER = 'custom-rust-binary';
      checkCargoInstallation.mockResolvedValueOnce(false);
      checkRustInstallation.mockResolvedValueOnce(false);
      const dependencies = createDependencies();
      const warnSpy = dependencies.logger?.warn as unknown as Mock;
      adapter = new RustDebugAdapter(dependencies);
      const result = await adapter.resolveExecutablePath();
      expect(result).toBe('custom-rust-binary');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cargo/rustc not found'));
    });
  });

  describe('validateEnvironment', () => {
    it('reports missing CodeLLDB and MSVC warning', async () => {
      vi.mocked(resolveCodeLLDBExecutable).mockResolvedValueOnce(null);
      checkCargoInstallation.mockResolvedValueOnce(true);
      checkRustInstallation.mockResolvedValueOnce(true);
      getRustHostTriple.mockResolvedValueOnce('x86_64-pc-windows-msvc');

      const result = await adapter.validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('CODELLDB_NOT_FOUND');
      const warningCodes = result.warnings?.map((warning) => warning.code);
      expect(warningCodes).toContain('RUST_MSVC_TOOLCHAIN');
    });

    it('warns when dlltool is missing for GNU toolchain on Windows', async () => {
      const restorePlatform = setPlatform('win32');
      vi.mocked(resolveCodeLLDBExecutable).mockResolvedValueOnce('C:\\\\codelldb.exe');
      checkCargoInstallation.mockResolvedValueOnce(true);
      checkRustInstallation.mockResolvedValueOnce(true);
      getRustHostTriple.mockResolvedValueOnce('x86_64-pc-windows-gnu');
      findDlltoolExecutable.mockResolvedValueOnce(undefined);

      try {
        const result = await adapter.validateEnvironment();
        expect(result.valid).toBe(true);
        const warningCodes = result.warnings?.map((warning) => warning.code);
        expect(warningCodes).toContain('DLLTOOL_NOT_FOUND');
      } finally {
        restorePlatform();
      }
    });
  });

  describe('buildAdapterCommand environment wiring', () => {
    it('injects dlltool path into environment when available on Windows', () => {
      const restorePlatform = setPlatform('win32');
      const originalPath = process.env.PATH;
      const originalDlltool = process.env.DLLTOOL;
      process.env.PATH = '/usr/bin';
      delete process.env.DLLTOOL;

      const adapterWithMethod = adapter as unknown as {
        resolveCodeLLDBExecutableSync: () => string | null;
      };
      const resolveSpy = vi
        .spyOn(adapterWithMethod, 'resolveCodeLLDBExecutableSync')
        .mockReturnValue('C:\\\\CodeLLDB\\\\adapter\\\\codelldb.exe');

      (adapter as unknown as { dlltoolPath?: string }).dlltoolPath = './dlltool.exe';

      try {
        const command = adapter.buildAdapterCommand({
          sessionId: 'session',
          executablePath: 'cargo',
          adapterHost: '127.0.0.1',
          adapterPort: 4000,
          logDir: '/tmp/logs',
          scriptPath: 'main.rs',
          launchConfig: {}
        } as AdapterConfig);

        expect(command.env?.LLDB_USE_NATIVE_PDB_READER).toBe('1');
        expect(command.env?.DLLTOOL).toBe('./dlltool.exe');
        expect(command.env?.PATH?.startsWith('.')).toBe(true);
        expect(command.args).toEqual(['--port', '4000']);
      } finally {
        resolveSpy.mockRestore();
        if (originalDlltool === undefined) {
          delete process.env.DLLTOOL;
        } else {
          process.env.DLLTOOL = originalDlltool;
        }
        if (originalPath === undefined) {
          delete process.env.PATH;
        } else {
          process.env.PATH = originalPath;
        }
        restorePlatform();
      }
    });
  });

  describe('transformLaunchConfig with Rust sources', () => {
    const mockBinaryInfo = {
      format: 'gnu',
      hasPDB: false,
      hasRSDS: false,
      imports: [] as string[],
      debugInfoType: 'dwarf'
    };

    it('resolves source program without rebuild when up to date', async () => {
      vi.mocked(findCargoProjectRoot).mockResolvedValueOnce('/workspace/project');
      vi.mocked(getDefaultBinary).mockResolvedValueOnce('project-bin');
      vi.mocked(needsRebuild).mockResolvedValueOnce(false);
      detectBinaryFormat.mockResolvedValueOnce(mockBinaryInfo);

      const result = await adapter.transformLaunchConfig({
        program: '/workspace/project/src/main.rs'
      });

      const expectedBinaryPath = path.join(
        '/workspace/project',
        'target',
        'debug',
        process.platform === 'win32' ? 'project-bin.exe' : 'project-bin'
      );
      expect(result.program).toBe(expectedBinaryPath);
      expect(buildCargoProject).not.toHaveBeenCalled();
    });

    it('builds the project when sources are stale', async () => {
      vi.mocked(findCargoProjectRoot).mockResolvedValueOnce('/workspace/project');
      vi.mocked(getDefaultBinary).mockResolvedValueOnce('project-bin');
      vi.mocked(needsRebuild).mockResolvedValueOnce(true);
      const builtBinaryPath =
        process.platform === 'win32'
          ? '/workspace/project/target/release/project-bin.exe'
          : '/workspace/project/target/release/project-bin';
      vi.mocked(buildCargoProject).mockResolvedValueOnce({
        success: true,
        binaryPath: builtBinaryPath
      });
      detectBinaryFormat.mockResolvedValueOnce(mockBinaryInfo);

      const result = await adapter.transformLaunchConfig({
        program: '/workspace/project/src/main.rs',
        cargo: { release: true }
      });

      expect(buildCargoProject).toHaveBeenCalledWith(
        '/workspace/project',
        dependencies.logger,
        'release'
      );
      expect(result.program).toBe(builtBinaryPath);
    });

    it('throws when Cargo build fails', async () => {
      vi.mocked(findCargoProjectRoot).mockResolvedValueOnce('/workspace/project');
      vi.mocked(getDefaultBinary).mockResolvedValueOnce('project-bin');
      vi.mocked(needsRebuild).mockResolvedValueOnce(true);
      vi.mocked(buildCargoProject).mockResolvedValueOnce({
        success: false,
        error: 'compile error'
      });
      detectBinaryFormat.mockResolvedValueOnce(mockBinaryInfo);

      await expect(
        adapter.transformLaunchConfig({
          program: '/workspace/project/src/main.rs'
        })
      ).rejects.toThrow('Cargo build failed: compile error');
    });
  });

  describe('validateToolchain', () => {
    it('records MSVC incompatibility details', async () => {
      detectBinaryFormat.mockResolvedValue({
        format: 'msvc',
        hasPDB: true,
        hasRSDS: true,
        imports: ['foo'],
        debugInfoType: 'pdb'
      });

      await adapter.transformLaunchConfig({ program: '/bin/app.exe' });
      const result = adapter.consumeLastToolchainValidation();
      expect(result?.compatible).toBe(false);
      expect(result?.toolchain).toBe('msvc');
      expect(result?.message).toContain('MSVC toolchain');
      expect(result?.suggestions?.length).toBeGreaterThan(0);
      expect(adapter.consumeLastToolchainValidation()).toBeUndefined();
    });

    it('returns generic compatibility on detection failure', async () => {
      detectBinaryFormat.mockRejectedValueOnce(new Error('failure'));
      const result = await adapter.validateToolchain('/bin/app');
      expect(result.compatible).toBe(true);
      expect(result.toolchain).toBe('unknown');
    });

    it('honors MSVC behavior "error" during launch transformation', async () => {
      process.env.RUST_MSVC_BEHAVIOR = 'error';
      adapter = new RustDebugAdapter(createDependencies());
      detectBinaryFormat.mockResolvedValue({
        format: 'msvc',
        hasPDB: false,
        hasRSDS: false,
        imports: [],
        debugInfoType: 'pdb'
      });

      await expect(
        adapter.transformLaunchConfig({ program: '/tmp/my-program' })
      ).rejects.toThrow(AdapterError);
    });
  });

  describe('DAP operations and connectivity', () => {
    it('warns about invalid exception filters on DAP requests', async () => {
      const warnSpy = dependencies.logger?.warn as Mock;
      const result = await adapter.sendDapRequest('setExceptionBreakpoints', {
        filters: ['unknown']
      });
      expect(result).toEqual({});
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown exception filters')
      );
    });

    it('handles DAP events and responses with state transitions', async () => {
      await adapter.connect('127.0.0.1', 4000);
      const stoppedSpy = vi.fn();
      const terminatedSpy = vi.fn();
      adapter.on('stopped', stoppedSpy);
      adapter.on('terminated', terminatedSpy);

      adapter.handleDapEvent({
        type: 'event',
        event: 'stopped',
        body: { threadId: 21 }
      });

      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
      expect(adapter.getCurrentThreadId()).toBe(21);
      expect(stoppedSpy).toHaveBeenCalledWith({ threadId: 21 });

      adapter.handleDapEvent({ type: 'event', event: 'terminated', body: {} });
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
      expect(adapter.getCurrentThreadId()).toBeNull();
      expect(terminatedSpy).toHaveBeenCalled();
    });

    it('logs DAP errors', () => {
      const errorSpy = dependencies.logger?.error as Mock;
      adapter.handleDapResponse({
        type: 'response',
        command: 'launch',
        success: false,
        message: 'boom',
        request_seq: 1,
        seq: 2
      });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DAP error')
      );
    });

    it('manages connection lifecycle', async () => {
      const connectedSpy = vi.fn();
      const disconnectedSpy = vi.fn();
      adapter.on('connected', connectedSpy);
      adapter.on('disconnected', disconnectedSpy);

      await adapter.connect('localhost', 9000);
      expect(connectedSpy).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);

      await adapter.disconnect();
      expect(disconnectedSpy).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
    });
  });

  describe('dependency and path utilities', () => {
    it('lists required dependencies with install commands', () => {
      const deps = adapter.getRequiredDependencies();
      expect(deps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'CodeLLDB', installCommand: 'npm run build:adapter' }),
          expect.objectContaining({ name: 'Rust' }),
          expect.objectContaining({ name: 'Cargo' })
        ])
      );
    });

    it('derives executable search paths per platform', () => {
      const restoreLinux = setPlatform('linux');
      const originalHome = process.env.HOME;
      const originalPath = process.env.PATH;
      process.env.HOME = '/tmp/tester';
      process.env.PATH = '/usr/bin:/usr/local/bin';
      const searchPaths = adapter
        .getExecutableSearchPaths()
        .map((entry) => entry.replace(/\\/g, '/'));
      expect(searchPaths).toEqual(
        expect.arrayContaining([
          '/tmp/tester/.cargo/bin',
          '/tmp/tester/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin'
        ])
      );
      expect(searchPaths.some((entry) => entry.includes('/usr/bin'))).toBe(true);
      expect(searchPaths.some((entry) => entry.includes('/usr/local/bin'))).toBe(true);
      process.env.HOME = originalHome;
      process.env.PATH = originalPath;
      restoreLinux();

      const restoreWindows = setPlatform('win32');
      const originalRustup = process.env.RUSTUP_HOME;
      const originalCargo = process.env.CARGO_HOME;
      const originalHomeWin = process.env.HOME;
      process.env.HOME = 'C:\\Users\\tester';
      process.env.RUSTUP_HOME = 'C:\\Rustup';
      process.env.CARGO_HOME = 'C:\\Cargo';
      const windowsPaths = adapter.getExecutableSearchPaths();
      expect(windowsPaths.some((entry) => entry.includes('Cargo'))).toBe(true);
      expect(windowsPaths.some((entry) => entry.includes('Program Files'))).toBe(true);
      process.env.HOME = originalHomeWin;
      process.env.RUSTUP_HOME = originalRustup;
      process.env.CARGO_HOME = originalCargo;
      restoreWindows();
    });

    it('scrubs python variables when configuring embedded environment', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-python-'));
      const adapterDir = path.join(root, 'adapter');
      const adapterScripts = path.join(adapterDir, 'scripts');
      const adapterDLLs = path.join(adapterDir, 'DLLs');
      const lldbDir = path.join(root, 'lldb');
      const lldbBin = path.join(lldbDir, 'bin');
      const lldbDLLs = path.join(lldbDir, 'DLLs');

      await fs.mkdir(adapterScripts, { recursive: true });
      await fs.mkdir(adapterDLLs, { recursive: true });
      await fs.mkdir(lldbBin, { recursive: true });
      await fs.mkdir(lldbDLLs, { recursive: true });

      const env: Record<string, string> = {
        PATH: '',
        PYTHONHOME: 'remove',
        PYTHONPATH: 'remove',
        CODELLDB_STARTUP: 'remove'
      };

      (adapter as unknown as {
        configurePythonEnvironment: (env: Record<string, string>, adapterPath: string) => void;
      }).configurePythonEnvironment(env, path.join(adapterDir, 'codelldb.exe'));

      const pathEntries = env.PATH.split(path.delimiter);
      expect(pathEntries).toEqual(expect.arrayContaining([adapterDir, adapterScripts, lldbBin]));
      expect(env.PYTHONHOME).toBeUndefined();

      await fs.rm(root, { recursive: true, force: true });
    });

    it('sanitizes CodeLLDB paths containing spaces on Windows', async () => {
      const restorePlatform = setPlatform('win32');
      const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codelldb-src-'));
      const platformDir = path.join(baseDir, 'platform dir');
      const adapterDir = path.join(platformDir, 'adapter');
      await fs.mkdir(adapterDir, { recursive: true });
      const exePath = path.join(adapterDir, 'codelldb.exe');
      await fs.writeFile(exePath, 'binary');
      await fs.writeFile(path.join(platformDir, 'version.json'), '"1.0"');

      const sanitized = (adapter as unknown as {
        prepareCodelldbExecutablePath: (path: string) => string | null;
      }).prepareCodelldbExecutablePath(exePath);

      expect(sanitized).toContain('debug-mcp-codelldb');
      expect(fsSync.existsSync(sanitized as string)).toBe(true);

      await fs.rm(path.join(os.tmpdir(), 'debug-mcp-codelldb'), { recursive: true, force: true });
      await fs.rm(baseDir, { recursive: true, force: true });
      restorePlatform();
    });

    it('exposes adapter metadata helpers', () => {
      expect(adapter.getAdapterModuleName()).toBe('codelldb');
      expect(adapter.getAdapterInstallCommand()).toBe('npm run build:adapter');
    });
  });

  describe('adapter messaging and capabilities', () => {
    it('provides installation guidance and missing executable error', () => {
      expect(adapter.getInstallationInstructions()).toContain('Install Rust toolchain');
      expect(adapter.getMissingExecutableError()).toContain('Rust toolchain not found');
    });

    it('translates common error messages', () => {
      const cases: Array<[string, string]> = [
        ['CodeLLDB not found', 'CodeLLDB is not installed'],
        ['cargo command not found', 'Rust toolchain not found'],
        ['Permission denied while executing', 'Permission denied'],
        ['target debug build missing', 'Debug binary not found'],
        ['LLDB failed to start', 'LLDB failed to start'],
        ['unexpected failure', 'unexpected failure']
      ];

      for (const [message, expected] of cases) {
        const translated = adapter.translateErrorMessage(new Error(message));
        expect(translated).toContain(expected.split(' ')[0]);
      }
    });

    it('reports supported features and requirements', () => {
      expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.REVERSE_DEBUGGING)).toBe(false);

      const dataReqs = adapter.getFeatureRequirements(DebugFeature.DATA_BREAKPOINTS);
      expect(dataReqs[0]?.type).toBe('version');

      const disassembleReqs = adapter.getFeatureRequirements(DebugFeature.DISASSEMBLE_REQUEST);
      expect(disassembleReqs[0]?.type).toBe('configuration');

      const logPointReqs = adapter.getFeatureRequirements(DebugFeature.LOG_POINTS);
      expect(logPointReqs[0]?.description).toContain('CodeLLDB');
    });

    it('returns default launch configuration and capabilities', () => {
      const defaults = adapter.getDefaultLaunchConfig();
      expect(defaults.cwd).toBe(process.cwd());
      expect(defaults.stopOnEntry).toBe(false);

      const capabilities = adapter.getCapabilities();
      expect(capabilities.supportsConditionalBreakpoints).toBe(true);
      expect(capabilities.supportsDisassembleRequest).toBe(true);
      expect(capabilities.supportsSetExpression).toBe(false);
    });
  });
});
