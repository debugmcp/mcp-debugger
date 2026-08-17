/**
 * Unit tests for CppDebugAdapter and CppAdapterFactory.
 *
 * The CodeLLDB resolver (via @debugmcp/codelldb-common) and compile-utils are
 * mocked hermetically — these tests never depend on the local vendor tree or
 * an installed compiler.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as path from 'path';
import { AdapterState, AdapterError, DebugLanguage } from '@debugmcp/shared';
import type { AdapterConfig, AdapterDependencies } from '@debugmcp/shared';

vi.mock('@debugmcp/codelldb-common', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveCodeLLDBExecutable: vi.fn(),
  resolveCodeLLDBExecutableSyncImpl: vi.fn(),
  getCodeLLDBVersion: vi.fn(),
  detectBinaryFormat: vi.fn(),
  deriveSourceMapFromBinary: vi.fn()
}));

vi.mock('../src/utils/compile-utils.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findCompiler: vi.fn(),
  findAnyCompiler: vi.fn(),
  needsRecompile: vi.fn(),
  compileSourceFile: vi.fn()
}));

import {
  resolveCodeLLDBExecutable,
  resolveCodeLLDBExecutableSyncImpl,
  getCodeLLDBVersion,
  detectBinaryFormat,
  deriveSourceMapFromBinary
} from '@debugmcp/codelldb-common';
import {
  findCompiler,
  findAnyCompiler,
  needsRecompile,
  compileSourceFile,
  getDefaultOutputPath
} from '../src/utils/compile-utils.js';
import { CppDebugAdapter } from '../src/cpp-debug-adapter.js';
import { CppAdapterFactory } from '../src/cpp-adapter-factory.js';

const createDependencies = (): AdapterDependencies => ({
  fileSystem: {} as AdapterDependencies['fileSystem'],
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  } as unknown as AdapterDependencies['logger'],
  environment: {
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue({}),
    getCurrentWorkingDirectory: vi.fn().mockReturnValue(process.cwd())
  } as unknown as AdapterDependencies['environment']
});

const gnuBinaryInfo = {
  format: 'gnu' as const,
  hasPDB: false,
  hasRSDS: false,
  imports: [],
  debugInfoType: 'dwarf' as const
};

describe('CppDebugAdapter', () => {
  let adapter: CppDebugAdapter;
  let dependencies: AdapterDependencies;

  beforeEach(() => {
    vi.mocked(resolveCodeLLDBExecutable).mockReset();
    vi.mocked(resolveCodeLLDBExecutableSyncImpl).mockReset();
    vi.mocked(getCodeLLDBVersion).mockReset();
    vi.mocked(detectBinaryFormat).mockReset().mockResolvedValue(gnuBinaryInfo);
    vi.mocked(findCompiler).mockReset();
    vi.mocked(findAnyCompiler).mockReset();
    vi.mocked(needsRecompile).mockReset();
    vi.mocked(compileSourceFile).mockReset();
    vi.mocked(deriveSourceMapFromBinary).mockReset().mockReturnValue({});
    dependencies = createDependencies();
    adapter = new CppDebugAdapter(dependencies);
  });

  it('identifies as the cpp adapter', () => {
    expect(adapter.language).toBe(DebugLanguage.CPP);
    expect(adapter.name).toBe('C/C++ Debug Adapter');
    expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    expect(adapter.getDefaultExecutableName()).toBe('g++');
  });

  describe('validateEnvironment', () => {
    it('errors when CodeLLDB is missing', async () => {
      vi.mocked(resolveCodeLLDBExecutable).mockResolvedValue(null);
      vi.mocked(findAnyCompiler).mockResolvedValue('g++');

      const result = await adapter.validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('CODELLDB_NOT_FOUND');
    });

    it('warns (does not error) when no compiler is found', async () => {
      vi.mocked(resolveCodeLLDBExecutable).mockResolvedValue('/vendor/codelldb');
      vi.mocked(findAnyCompiler).mockResolvedValue(null);

      const result = await adapter.validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.warnings.map((w) => w.code)).toContain('CPP_COMPILER_NOT_FOUND');
    });
  });

  describe('resolveExecutablePath', () => {
    it('returns the first available compiler', async () => {
      vi.mocked(findAnyCompiler).mockResolvedValue('clang++');

      await expect(adapter.resolveExecutablePath()).resolves.toBe('clang++');
    });

    it('falls back to the prebuilt placeholder in container mode', async () => {
      vi.mocked(findAnyCompiler).mockResolvedValue(null);
      vi.stubEnv('MCP_CONTAINER', 'true');
      try {
        await expect(adapter.resolveExecutablePath()).resolves.toBe('cpp-prebuilt-binary');
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('throws when no compiler exists and relaxed mode is off', async () => {
      vi.mocked(findAnyCompiler).mockResolvedValue(null);

      await expect(adapter.resolveExecutablePath()).rejects.toThrow(AdapterError);
    });
  });

  describe('buildAdapterCommand', () => {
    const config: AdapterConfig = {
      sessionId: 's1',
      executablePath: 'g++',
      adapterHost: '127.0.0.1',
      adapterPort: 4711,
      logDir: '/tmp/logs',
      scriptPath: 'main.cpp',
      launchConfig: {}
    };

    it('spawns CodeLLDB in TCP mode', () => {
      vi.mocked(resolveCodeLLDBExecutableSyncImpl).mockReturnValue('/vendor/adapter/codelldb');

      const command = adapter.buildAdapterCommand(config);

      expect(command.command).toBe('/vendor/adapter/codelldb');
      expect(command.args.slice(0, 2)).toEqual(['--port', '4711']);
      expect(command.env).toBeDefined();
    });

    it('throws when CodeLLDB cannot be resolved', () => {
      vi.mocked(resolveCodeLLDBExecutableSyncImpl).mockReturnValue(null);

      expect(() => adapter.buildAdapterCommand(config)).toThrow(/CodeLLDB/);
    });

    it('rejects a missing TCP port', () => {
      vi.mocked(resolveCodeLLDBExecutableSyncImpl).mockReturnValue('/vendor/adapter/codelldb');

      expect(() => adapter.buildAdapterCommand({ ...config, adapterPort: 0 })).toThrow(/port/i);
    });
  });

  describe('transformLaunchConfig', () => {
    it('resolves a prebuilt binary against cwd and emits the lldb launch shape', async () => {
      const result = await adapter.transformLaunchConfig({
        program: 'build/app',
        cwd: '/work'
      } as never);

      expect(result.type).toBe('lldb');
      expect(result.request).toBe('launch');
      expect(result.program).toBe(path.resolve('/work', 'build/app'));
      expect(result.sourceLanguages).toEqual(['cpp']);
      expect(result.terminal).toBe('console');
    });

    it('translates the legacy console key to terminal', async () => {
      const result = await adapter.transformLaunchConfig({
        program: 'app.bin',
        console: 'integratedTerminal'
      } as never);

      expect(result.terminal).toBe('integrated');
    });

    it('passes advanced CodeLLDB keys through untouched', async () => {
      const result = await adapter.transformLaunchConfig({
        program: 'app.bin',
        initCommands: ['settings set target.x true'],
        targetCreateCommands: ['target create -c core.dump'],
        expressions: 'native',
        breakpointMode: 'file'
      } as never);

      expect(result.initCommands).toEqual(['settings set target.x true']);
      expect(result.targetCreateCommands).toEqual(['target create -c core.dump']);
      expect(result.expressions).toBe('native');
      expect(result.breakpointMode).toBe('file');
    });

    it('compiles a lone source file when stale', async () => {
      const src = path.resolve('/work/hello.cpp');
      const out = getDefaultOutputPath(src, process.platform);
      vi.mocked(needsRecompile).mockResolvedValue(true);
      vi.mocked(compileSourceFile).mockResolvedValue({ success: true, binaryPath: out });

      const result = await adapter.transformLaunchConfig({ program: src } as never);

      expect(compileSourceFile).toHaveBeenCalledWith(
        expect.objectContaining({ sourcePath: src, outputPath: out })
      );
      expect(result.program).toBe(out);
    });

    it('reuses a fresh compiled binary without invoking the compiler', async () => {
      const src = path.resolve('/work/hello.cpp');
      vi.mocked(needsRecompile).mockResolvedValue(false);

      const result = await adapter.transformLaunchConfig({ program: src } as never);

      expect(compileSourceFile).not.toHaveBeenCalled();
      expect(result.program).toBe(getDefaultOutputPath(src, process.platform));
    });

    it('recompiles when forceRebuild is set even if fresh', async () => {
      const src = path.resolve('/work/hello.cpp');
      const out = getDefaultOutputPath(src, process.platform);
      vi.mocked(needsRecompile).mockResolvedValue(false);
      vi.mocked(compileSourceFile).mockResolvedValue({ success: true, binaryPath: out });

      await adapter.transformLaunchConfig({ program: src, forceRebuild: true } as never);

      expect(compileSourceFile).toHaveBeenCalled();
    });

    it('throws with compiler output when compilation fails', async () => {
      const src = path.resolve('/work/broken.cpp');
      vi.mocked(needsRecompile).mockResolvedValue(true);
      vi.mocked(compileSourceFile).mockResolvedValue({
        success: false,
        error: "expected ';' before '}' token"
      });

      await expect(adapter.transformLaunchConfig({ program: src } as never)).rejects.toThrow(
        /expected ';'/
      );
    });

    it('throws SCRIPT_NOT_FOUND when no program is given', async () => {
      await expect(adapter.transformLaunchConfig({} as never)).rejects.toMatchObject({
        code: 'SCRIPT_NOT_FOUND'
      });
    });

    describe('container sourceMap derivation (#363)', () => {
      it('injects a derived sourceMap for a prebuilt binary in container mode', async () => {
        vi.stubEnv('MCP_CONTAINER', 'true');
        vi.mocked(deriveSourceMapFromBinary).mockReturnValue({
          '/home/user/proj': '/workspace'
        });
        try {
          const result = await adapter.transformLaunchConfig({
            program: 'build/app',
            cwd: '/work'
          } as never);

          expect(deriveSourceMapFromBinary).toHaveBeenCalledWith(
            path.resolve('/work', 'build/app'),
            '/workspace'
          );
          expect(result.sourceMap).toEqual({ '/home/user/proj': '/workspace' });
        } finally {
          vi.unstubAllEnvs();
        }
      });

      it('respects MCP_WORKSPACE_ROOT for derivation', async () => {
        vi.stubEnv('MCP_CONTAINER', 'true');
        vi.stubEnv('MCP_WORKSPACE_ROOT', '/mnt/project');
        try {
          await adapter.transformLaunchConfig({ program: 'build/app', cwd: '/work' } as never);

          expect(deriveSourceMapFromBinary).toHaveBeenCalledWith(
            path.resolve('/work', 'build/app'),
            '/mnt/project'
          );
        } finally {
          vi.unstubAllEnvs();
        }
      });

      it('skips derivation when the caller supplies sourceMap entries', async () => {
        vi.stubEnv('MCP_CONTAINER', 'true');
        try {
          const result = await adapter.transformLaunchConfig({
            program: 'build/app',
            cwd: '/work',
            sourceMap: { '/custom': '/workspace' }
          } as never);

          expect(deriveSourceMapFromBinary).not.toHaveBeenCalled();
          expect(result.sourceMap).toEqual({ '/custom': '/workspace' });
        } finally {
          vi.unstubAllEnvs();
        }
      });

      it('skips derivation outside container mode', async () => {
        const result = await adapter.transformLaunchConfig({
          program: 'build/app',
          cwd: '/work'
        } as never);

        expect(deriveSourceMapFromBinary).not.toHaveBeenCalled();
        expect(result.sourceMap).toEqual({});
      });

      it('skips derivation when the binary was compiled at launch', async () => {
        vi.stubEnv('MCP_CONTAINER', 'true');
        const src = path.resolve('/work/hello.cpp');
        const out = getDefaultOutputPath(src, process.platform);
        vi.mocked(needsRecompile).mockResolvedValue(true);
        vi.mocked(compileSourceFile).mockResolvedValue({ success: true, binaryPath: out });
        try {
          await adapter.transformLaunchConfig({ program: src } as never);

          expect(deriveSourceMapFromBinary).not.toHaveBeenCalled();
        } finally {
          vi.unstubAllEnvs();
        }
      });

      it('leaves sourceMap empty when derivation finds nothing', async () => {
        vi.stubEnv('MCP_CONTAINER', 'true');
        vi.mocked(deriveSourceMapFromBinary).mockReturnValue({});
        try {
          const result = await adapter.transformLaunchConfig({
            program: 'build/app',
            cwd: '/work'
          } as never);

          expect(result.sourceMap).toEqual({});
        } finally {
          vi.unstubAllEnvs();
        }
      });
    });
  });

  describe('attach support', () => {
    it('declares attach and detach support', () => {
      expect(adapter.supportsAttach()).toBe(true);
      expect(adapter.supportsDetach()).toBe(true);
      expect(adapter.getDefaultAttachConfig()).toMatchObject({ request: 'attach', stopOnEntry: true });
    });

    it('maps processId to a numeric pid in the lldb attach shape', () => {
      const result = adapter.transformAttachConfig({ request: 'attach', processId: '4242' });

      expect(result.type).toBe('lldb');
      expect(result.request).toBe('attach');
      expect(result.pid).toBe(4242);
      expect(result.stopOnEntry).toBe(true);
    });

    it('honors an explicit stopOnEntry: false', () => {
      const result = adapter.transformAttachConfig({
        request: 'attach',
        processId: 7,
        stopOnEntry: false
      });

      expect(result.stopOnEntry).toBe(false);
    });

    it('passes program and advanced keys through for symbol resolution', () => {
      const result = adapter.transformAttachConfig({
        request: 'attach',
        processId: 7,
        program: '/opt/app/server',
        initCommands: ['x']
      });

      expect(result.program).toBe('/opt/app/server');
      expect(result.initCommands).toEqual(['x']);
    });

    it('rejects attach without a numeric processId', () => {
      expect(() => adapter.transformAttachConfig({ request: 'attach' })).toThrow(/processId/);
      expect(() =>
        adapter.transformAttachConfig({ request: 'attach', processId: 'not-a-pid' })
      ).toThrow(/processId/);
    });
  });

  describe('capabilities', () => {
    it('advertises LLDB capabilities including exceptionInfo and the C++ filters', () => {
      const caps = adapter.getCapabilities();

      expect(caps.supportsExceptionInfoRequest).toBe(true);
      expect(caps.supportsDataBreakpoints).toBe(true);
      expect(caps.supportsDisassembleRequest).toBe(true);
      expect(caps.exceptionBreakpointFilters?.map((f) => f.filter)).toEqual(['cpp_throw', 'cpp_catch']);
    });
  });
});

describe('CppAdapterFactory', () => {
  beforeEach(() => {
    vi.mocked(resolveCodeLLDBExecutable).mockReset();
    vi.mocked(getCodeLLDBVersion).mockReset();
    vi.mocked(findAnyCompiler).mockReset();
  });

  it('creates adapters and reports cpp metadata', () => {
    const factory = new CppAdapterFactory();
    const metadata = factory.getMetadata();

    expect(metadata.language).toBe(DebugLanguage.CPP);
    expect(metadata.displayName).toBe('C/C++');
    expect(metadata.fileExtensions).toEqual(expect.arrayContaining(['.c', '.cpp', '.cc', '.cxx']));

    const adapter = factory.createAdapter(createDependencies());
    expect(adapter.language).toBe(DebugLanguage.CPP);
  });

  it('validate reports the discovered compiler in details when everything is present', async () => {
    const factory = new CppAdapterFactory();
    vi.mocked(resolveCodeLLDBExecutable).mockResolvedValue('/vendor/codelldb');
    vi.mocked(getCodeLLDBVersion).mockResolvedValue('1.11.8');
    vi.mocked(findAnyCompiler).mockResolvedValue('clang++');

    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.details).toMatchObject({
      codelldbPath: '/vendor/codelldb',
      codelldbVersion: '1.11.8',
      compiler: 'clang++'
    });
  });

  it('validate errors without CodeLLDB and warns without a compiler', async () => {
    const factory = new CppAdapterFactory();

    vi.mocked(resolveCodeLLDBExecutable).mockResolvedValue(null);
    vi.mocked(findAnyCompiler).mockResolvedValue(null);
    let result = await factory.validate();
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/CodeLLDB/);

    vi.mocked(resolveCodeLLDBExecutable).mockResolvedValue('/vendor/codelldb');
    vi.mocked(getCodeLLDBVersion).mockResolvedValue('1.11.8');
    vi.mocked(findAnyCompiler).mockResolvedValue(null);
    result = await factory.validate();
    expect(result.valid).toBe(true);
    expect(result.warnings[0]).toMatch(/compiler/i);
  });
});
