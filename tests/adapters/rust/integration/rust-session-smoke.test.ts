import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';

import type { AdapterDependencies } from '@debugmcp/shared';
import { RustAdapterFactory } from '../../../../packages/adapter-rust/src/index.js';

const createDependencies = (): AdapterDependencies => ({
  fileSystem: {
    readFile: async () => '',
    writeFile: async () => {},
    exists: async () => false,
    mkdir: async () => {},
    readdir: async () => [],
    stat: async () => ({} as unknown as import('fs').Stats),
    unlink: async () => {},
    rmdir: async () => {},
    ensureDir: async () => {},
    ensureDirSync: () => {},
    pathExists: async () => false,
    existsSync: () => false,
    remove: async () => {},
    copy: async () => {},
    outputFile: async () => {}
  },
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {}
  },
  environment: {
    get: (key: string) => process.env[key],
    getAll: () => ({ ...process.env }),
    getCurrentWorkingDirectory: () => process.cwd()
  },
  processLauncher: {
    launch: () => {
      throw new Error('processLauncher.launch should not be used in rust smoke test');
    }
  } as AdapterDependencies['processLauncher']
});

describe('Rust adapter - session smoke (integration)', () => {
  const adapterPort = 48765;
  const sessionId = 'session-rust-smoke';
  const adapterHost = '127.0.0.1';
  const fakeLogDir = path.join(process.cwd(), 'logs', 'tests');
  const sampleScriptPath = path.join(process.cwd(), 'examples', 'rust', 'src', 'main.rs');
  const fakeCodelldbPath = process.execPath;

  let originalCodelldbPath: string | undefined;
  let originalRustBacktrace: string | undefined;

  beforeEach(() => {
    originalCodelldbPath = process.env.CODELLDB_PATH;
    originalRustBacktrace = process.env.RUST_BACKTRACE;
    process.env.CODELLDB_PATH = fakeCodelldbPath;
    delete process.env.RUST_BACKTRACE;
  });

  afterEach(() => {
    if (typeof originalCodelldbPath === 'string') {
      process.env.CODELLDB_PATH = originalCodelldbPath;
    } else {
      delete (process.env as Record<string, string | undefined>).CODELLDB_PATH;
    }

    if (typeof originalRustBacktrace === 'string') {
      process.env.RUST_BACKTRACE = originalRustBacktrace;
    } else {
      delete (process.env as Record<string, string | undefined>).RUST_BACKTRACE;
    }
  });

  it('builds CodeLLDB command with TCP port and Rust env defaults', () => {
    const factory = new RustAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());

    const command = adapter.buildAdapterCommand({
      sessionId,
      executablePath: fakeCodelldbPath,
      adapterHost,
      adapterPort,
      logDir: fakeLogDir,
      scriptPath: sampleScriptPath,
      scriptArgs: [],
      launchConfig: {}
    } as any);

    expect(path.isAbsolute(command.command)).toBe(true);
    expect(existsSync(command.command)).toBe(true);
    expect(command.args).toEqual(['--port', String(adapterPort)]);
    expect(command.env?.RUST_BACKTRACE).toBe('1');
    if (process.platform === 'win32') {
      expect(command.env?.LLDB_USE_NATIVE_PDB_READER).toBe('1');
    } else {
      expect(command.env?.LLDB_USE_NATIVE_PDB_READER).toBeUndefined();
    }
  });

  it('normalizes binary launch config for existing Rust artifacts', async () => {
    const factory = new RustAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());
    const projectRoot = path.join(process.cwd(), 'examples', 'rust-hello');
    const binaryName = process.platform === 'win32' ? 'hello.exe' : 'hello';

    const transformed = await adapter.transformLaunchConfig({
      program: path.join('target', 'debug', binaryName),
      cwd: projectRoot,
      args: ['--sample'],
      env: { RUST_LOG: 'info' }
    } as any);

    expect(transformed.type).toBe('lldb');
    expect(transformed.program).toBe(path.resolve(projectRoot, 'target', 'debug', binaryName));
    expect(transformed.cwd).toBe(projectRoot);
    expect(transformed.args).toEqual(['--sample']);
    expect(transformed.sourceLanguages).toEqual(['rust']);
    expect(transformed.console).toBe('internalConsole');
  });
});
