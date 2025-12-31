import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';

import type { AdapterDependencies } from '@debugmcp/shared';
import { GoAdapterFactory } from '@debugmcp/adapter-go';

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
      throw new Error('processLauncher.launch should not be used in go smoke test');
    }
  } as AdapterDependencies['processLauncher']
});

describe('Go adapter - session smoke (integration)', () => {
  const adapterPort = 48766;
  const sessionId = 'session-go-smoke';
  const adapterHost = '127.0.0.1';
  const fakeLogDir = path.join(process.cwd(), 'logs', 'tests');
  const sampleScriptPath = path.join(process.cwd(), 'examples', 'go', 'main.go');
  const fakeDlvPath = process.execPath;

  let originalDlvPath: string | undefined;

  beforeEach(() => {
    originalDlvPath = process.env.DLV_PATH;
    process.env.DLV_PATH = fakeDlvPath;
  });

  afterEach(() => {
    if (typeof originalDlvPath === 'string') {
      process.env.DLV_PATH = originalDlvPath;
    } else {
      delete (process.env as Record<string, string | undefined>).DLV_PATH;
    }
  });

  it('builds dlv dap command with TCP port', async () => {
    const factory = new GoAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());

    const command = await adapter.buildAdapterCommand({
      sessionId,
      executablePath: fakeDlvPath,
      adapterHost,
      adapterPort,
      logDir: fakeLogDir,
      scriptPath: sampleScriptPath,
      scriptArgs: [],
      launchConfig: {}
    } as any);

    expect(path.isAbsolute(command.command)).toBe(true);
    expect(existsSync(command.command)).toBe(true);
    expect(command.args).toContain('dap');
    expect(command.args?.some(arg => arg.includes(`--listen=${adapterHost}:${adapterPort}`))).toBe(true);
  });

  it('normalizes launch config for Go programs', async () => {
    const factory = new GoAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());
    const projectRoot = path.join(process.cwd(), 'examples', 'go-hello');

    const transformed = await adapter.transformLaunchConfig({
      program: path.join(projectRoot, 'main.go'),
      cwd: projectRoot,
      args: ['--sample'],
      env: { DEBUG: 'true' }
    } as any);

    expect(transformed.type).toBe('go');
    expect(transformed.request).toBe('launch');
    expect(transformed.mode).toBe('debug');
    expect(transformed.program).toBe(path.join(projectRoot, 'main.go'));
    expect(transformed.cwd).toBe(projectRoot);
    expect(transformed.args).toEqual(['--sample']);
  });

  it('handles test mode configuration', async () => {
    const factory = new GoAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());
    const projectRoot = path.join(process.cwd(), 'examples', 'go-test');

    const transformed = await adapter.transformLaunchConfig({
      program: projectRoot,
      cwd: projectRoot,
      mode: 'test',
      args: ['-test.v', '-test.run', 'TestExample']
    } as any);

    expect(transformed.type).toBe('go');
    expect(transformed.mode).toBe('test');
    expect(transformed.args).toContain('-test.v');
  });

  it('returns correct metadata from factory', () => {
    const factory = new GoAdapterFactory();
    const metadata = factory.getMetadata();

    expect(metadata.displayName).toBe('Go');
    expect(metadata.fileExtensions).toContain('.go');
    expect(metadata.description).toContain('Delve');
  });

  it('returns required dependencies', () => {
    const factory = new GoAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());
    const deps = adapter.getRequiredDependencies();

    expect(deps).toHaveLength(2);
    expect(deps.some(d => d.name === 'Go')).toBe(true);
    expect(deps.some(d => d.name.includes('Delve'))).toBe(true);
  });

  it('provides installation instructions', () => {
    const factory = new GoAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());
    const instructions = adapter.getInstallationInstructions();

    expect(instructions).toContain('go.dev');
    expect(instructions).toContain('delve');
    expect(instructions).toContain('go install');
  });
});
