import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';

import type { AdapterDependencies } from '@debugmcp/shared';
import { RubyAdapterFactory } from '@debugmcp/adapter-ruby';

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
});

describe('Ruby adapter - session smoke (integration)', () => {
  const adapterPort = 48767;
  const sessionId = 'session-ruby-smoke';
  const adapterHost = '127.0.0.1';
  const fakeLogDir = path.join(process.cwd(), 'logs', 'tests');
  const sampleScriptPath = path.join(process.cwd(), 'examples', 'ruby', 'fizzbuzz.rb');
  // A real existing executable path so invocation construction is exercised
  // without requiring an actual Ruby toolchain.
  const fakeRdbgPath = process.execPath;

  let originalRdbgPath: string | undefined;

  beforeEach(() => {
    originalRdbgPath = process.env.RDBG_PATH;
    process.env.RDBG_PATH = fakeRdbgPath;
  });

  afterEach(() => {
    if (typeof originalRdbgPath === 'string') {
      process.env.RDBG_PATH = originalRdbgPath;
    } else {
      delete (process.env as Record<string, string | undefined>).RDBG_PATH;
    }
  });

  it('builds an rdbg command that stops at load and serves DAP over TCP', () => {
    const factory = new RubyAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());

    const command = adapter.buildAdapterCommand({
      sessionId,
      executablePath: 'ruby',
      adapterHost,
      adapterPort,
      logDir: fakeLogDir,
      scriptPath: sampleScriptPath,
      scriptArgs: [],
      launchConfig: {}
    } as never);

    expect(command.args).toContain('--open');
    expect(command.args).toContain('--host');
    expect(command.args).toContain(String(adapterPort));
    // Stop-at-load is mandatory: --nonstop would let short scripts finish
    // before the proxy connects (the entry stop is auto-continued instead).
    expect(command.args).not.toContain('--nonstop');
    // Never the vscode frontend mode, which tries to launch an editor.
    expect(command.args.every(arg => !arg.includes('vscode'))).toBe(true);
    // Command mode: rdbg runs `ruby <script>` under the debugger.
    const dashC = command.args.indexOf('-c');
    expect(dashC).toBeGreaterThan(-1);
    expect(command.args.slice(dashC)).toEqual(['-c', '--', 'ruby', sampleScriptPath]);
  });

  it('normalizes launch config for Ruby scripts', async () => {
    const factory = new RubyAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());

    const transformed = await adapter.transformLaunchConfig({
      program: sampleScriptPath,
      stopOnEntry: true,
      justMyCode: false
    } as never);

    expect(transformed.type).toBe('rdbg');
    expect(transformed.request).toBe('launch');
    expect(transformed.script).toBe(sampleScriptPath);
    expect(transformed.stopOnEntry).toBe(true);
  });

  it('transforms attach config with discrete host and port', () => {
    const factory = new RubyAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());

    const attach = adapter.transformAttachConfig!({
      request: 'attach',
      host: '127.0.0.1',
      port: 12345,
      stopOnEntry: true
    });

    expect(attach).toMatchObject({
      type: 'rdbg',
      request: 'attach',
      host: '127.0.0.1',
      port: 12345,
      localfs: true
    });
    expect(adapter.usesDirectConnectForAttach?.()).toBe(true);
  });

  it('returns correct metadata from factory', () => {
    const factory = new RubyAdapterFactory();
    const metadata = factory.getMetadata();

    expect(metadata.displayName).toBe('Ruby');
    expect(metadata.fileExtensions).toContain('.rb');
    expect(metadata.description).toContain('rdbg');
  });

  it('returns required dependencies and install instructions', () => {
    const factory = new RubyAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());

    const deps = adapter.getRequiredDependencies();
    expect(deps.some(d => d.name === 'Ruby')).toBe(true);
    expect(deps.some(d => d.name.includes('debug gem'))).toBe(true);

    const instructions = adapter.getInstallationInstructions();
    expect(instructions).toContain('gem install debug');
    expect(instructions).toContain('ruby-lang.org');
  });
});
