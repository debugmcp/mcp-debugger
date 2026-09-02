/**
 * Issue #646: the launch path must go through the mtime-aware bridge
 * resolution, and validate()/validateEnvironment() must say when the shipped
 * source is newer than the compiled class. The resolver itself is covered in
 * jdi-resolver.test.ts; here it is mocked so the adapter/factory wiring is
 * what is under test.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';

vi.mock('../../../../packages/adapter-java/src/utils/jdi-resolver.js', () => ({
  resolveJdiBridgeClassDir: vi.fn(),
  ensureJdiBridge: vi.fn(),
  ensureJdiBridgeCompiled: vi.fn(),
  isJdiBridgeStale: vi.fn()
}));

vi.mock('../../../../packages/adapter-java/src/utils/java-utils.js', () => ({
  findJavaExecutable: vi.fn(async () => '/usr/bin/java'),
  getJavaVersion: vi.fn(async () => '21.0.1'),
  getJavaSearchPaths: vi.fn(() => [])
}));

import {
  resolveJdiBridgeClassDir,
  ensureJdiBridge,
  isJdiBridgeStale,
  type JdiBridgeStatus
} from '../../../../packages/adapter-java/src/utils/jdi-resolver.js';
import { JavaDebugAdapter } from '../../../../packages/adapter-java/src/java-debug-adapter.js';
import { JavaAdapterFactory } from '../../../../packages/adapter-java/src/java-adapter-factory.js';

const mockResolve = vi.mocked(resolveJdiBridgeClassDir);
const mockEnsure = vi.mocked(ensureJdiBridge);
const mockIsStale = vi.mocked(isJdiBridgeStale);

const OUT = '/repo/packages/adapter-java/java/out';
const SRC = '/repo/packages/adapter-java/java/JdiDapServer.java';

const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() };
const deps = { logger, environment: { get: () => undefined, getAll: () => ({}), getCurrentWorkingDirectory: () => '/' } } as unknown as AdapterDependencies;

const adapterConfig = {
  sessionId: 's',
  executablePath: 'java',
  adapterHost: '127.0.0.1',
  adapterPort: 38000,
  logDir: '/tmp/logs',
  scriptPath: '/app/Main.java',
  scriptArgs: [],
  launchConfig: {}
};

const status = (overrides: Partial<JdiBridgeStatus>): JdiBridgeStatus => ({
  dir: OUT,
  sourceFile: SRC,
  stale: false,
  recompiled: false,
  ...overrides
});

describe('JavaDebugAdapter.buildAdapterCommand bridge resolution (#646)', () => {
  let adapter: JavaDebugAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('JAVA_HOME', undefined);
    adapter = new JavaDebugAdapter(deps);
  });

  it('always goes through ensureJdiBridge (the staleness-aware path), never resolve-only', () => {
    mockEnsure.mockReturnValue(status({}));

    const cmd = adapter.buildAdapterCommand(adapterConfig);

    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(cmd.args.slice(0, 3)).toEqual(['-cp', OUT, 'JdiDapServer']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs when the bridge was recompiled because the source was newer', () => {
    mockEnsure.mockReturnValue(status({ recompiled: true }));

    const cmd = adapter.buildAdapterCommand(adapterConfig);

    expect(cmd.args).toContain(OUT);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('recompiled into ' + OUT));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns, naming the reason, when a stale bridge could not be recompiled — and still launches it', () => {
    mockEnsure.mockReturnValue(status({ stale: true, error: 'javac not found (set JAVA_HOME or put javac on PATH)' }));

    const cmd = adapter.buildAdapterCommand(adapterConfig);

    expect(cmd.args.slice(0, 2)).toEqual(['-cp', OUT]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warning = logger.warn.mock.calls[0][0] as string;
    expect(warning).toContain('newer than the compiled class at ' + OUT);
    expect(warning).toContain('javac not found');
    expect(warning).toContain('build:adapter');
  });

  it('throws the usual ENVIRONMENT_INVALID error when nothing usable exists', () => {
    mockEnsure.mockReturnValue({ dir: null, sourceFile: null, stale: false, recompiled: false });

    expect(() => adapter.buildAdapterCommand(adapterConfig)).toThrow(/JDI bridge not compiled/);
  });
});

describe('validateEnvironment / validate() staleness warnings (#646)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('JAVA_HOME', undefined);
  });

  it('adapter.validateEnvironment warns JDI_BRIDGE_STALE (still valid) when the source is newer', async () => {
    mockResolve.mockReturnValue(OUT);
    mockIsStale.mockReturnValue(true);

    const result = await new JavaDebugAdapter(deps).validateEnvironment();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    const stale = result.warnings.find(w => w.code === 'JDI_BRIDGE_STALE');
    expect(stale?.message).toContain('newer than the compiled class at ' + OUT);
    expect(result.warnings.some(w => w.code === 'JDI_BRIDGE_NOT_COMPILED')).toBe(false);
  });

  it('adapter.validateEnvironment stays quiet for a fresh bridge, and keeps NOT_COMPILED for a missing one', async () => {
    mockResolve.mockReturnValue(OUT);
    mockIsStale.mockReturnValue(false);
    expect((await new JavaDebugAdapter(deps).validateEnvironment()).warnings).toEqual([]);

    mockResolve.mockReturnValue(null);
    const missing = await new JavaDebugAdapter(deps).validateEnvironment();
    expect(missing.warnings.map(w => w.code)).toEqual(['JDI_BRIDGE_NOT_COMPILED']);
    expect(mockIsStale).toHaveBeenCalledTimes(1); // not consulted when there is no class
  });

  it('factory.validate() surfaces the stale warning and details.jdiBridgeStale for doctor', async () => {
    mockResolve.mockReturnValue(OUT);
    mockIsStale.mockReturnValue(true);

    const result = await new JavaAdapterFactory().validate();

    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('newer than the compiled class at ' + OUT))).toBe(true);
    expect(result.details).toMatchObject({ jdiBridgeDir: OUT, jdiBridgeStale: true });
  });

  it('factory.validate() reports jdiBridgeStale: false for a fresh bridge', async () => {
    mockResolve.mockReturnValue(OUT);
    mockIsStale.mockReturnValue(false);

    const result = await new JavaAdapterFactory().validate();

    expect(result.warnings.some(w => w.includes('newer than'))).toBe(false);
    expect(result.details).toMatchObject({ jdiBridgeDir: OUT, jdiBridgeStale: false });
  });
});
