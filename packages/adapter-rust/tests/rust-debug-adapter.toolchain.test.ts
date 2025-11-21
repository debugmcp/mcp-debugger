import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { RustDebugAdapter } from '../src/rust-debug-adapter.js';
import { AdapterError } from '@debugmcp/shared';
import type { AdapterConfig } from '@debugmcp/shared';
import type { AdapterDependencies } from '@debugmcp/shared';
import * as fs from 'fs/promises';
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
      process.env.PATH = '/usr/bin';

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

      expect(result.program).toBe(path.join('/workspace/project', 'target', 'debug', 'project-bin'));
      expect(buildCargoProject).not.toHaveBeenCalled();
    });

    it('builds the project when sources are stale', async () => {
      vi.mocked(findCargoProjectRoot).mockResolvedValueOnce('/workspace/project');
      vi.mocked(getDefaultBinary).mockResolvedValueOnce('project-bin');
      vi.mocked(needsRebuild).mockResolvedValueOnce(true);
      vi.mocked(buildCargoProject).mockResolvedValueOnce({
        success: true,
        binaryPath: '/workspace/project/target/release/project-bin'
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
      expect(result.program).toBe('/workspace/project/target/release/project-bin');
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
});
