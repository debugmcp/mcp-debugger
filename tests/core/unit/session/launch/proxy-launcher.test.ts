/**
 * The two pure-ish preparation steps of a proxy launch, tested on their own:
 * `prepareLaunchInputs` (everything computed before an adapter exists) and
 * `buildAdapterLaunchPlan` (the ProxyConfig assembled once the adapter has
 * transformed the configuration and the executable is resolved). What these
 * pin is the *shape* handed to the worker — which caller-supplied field wins
 * over which default — since a field silently dropped here is lost for the
 * whole launch (#235) and a wrong program/cwd starts the wrong thing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import {
  ProxyLauncher,
  type LaunchInputs,
  type ProxyLaunchRequest
} from '../../../../../src/session/launch/proxy-launcher.js';
import type { ProxyLaunchContext } from '../../../../../src/session/operations-context.js';
import type { CustomLaunchRequestArguments } from '../../../../../src/session/session-manager-core.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';
import { MockProxyManagerFactory } from '../../../../../src/factories/proxy-manager-factory.js';
import {
  DebugLanguage,
  SessionLifecycleState,
  SessionState,
  type AdapterPolicy,
  type Breakpoint,
  type ExceptionBreakMode,
  type FunctionBreakpoint,
  type LanguageSpecificLaunchConfig
} from '@debugmcp/shared';
import { FakeDebugAdapter } from '../../../../test-utils/fakes/fake-debug-adapter.js';
import {
  createMockFileSystem,
  createMockLogger
} from '../../../../test-utils/helpers/test-dependencies.js';
import { createMockAdapterRegistry } from '../../../../test-utils/mocks/mock-adapter-registry.js';

const LOG_DIR_BASE = path.join('/tmp', 'logs');
const SCRIPT = path.join('/work', 'app', 'script.py');

/**
 * The attach shape (`request`/`host`/`port`) and compiled-language `program`
 * are not in `CustomLaunchRequestArguments`; production passes them through
 * the same cast.
 */
function launchArgs(args: Record<string, unknown>): Partial<CustomLaunchRequestArguments> {
  return args as unknown as Partial<CustomLaunchRequestArguments>;
}

function makeSession(overrides: Partial<ManagedSession> = {}): ManagedSession {
  return {
    id: 'sess-1',
    name: 'Session 1',
    language: DebugLanguage.PYTHON,
    state: SessionState.CREATED,
    sessionLifecycle: SessionLifecycleState.CREATED,
    createdAt: new Date(),
    updatedAt: new Date(),
    breakpoints: new Map<string, Breakpoint>(),
    functionBreakpoints: new Map<string, FunctionBreakpoint>(),
    ...overrides
  } as unknown as ManagedSession;
}

interface Harness {
  launcher: ProxyLauncher;
  ctx: ProxyLaunchContext;
  policy: { getInitializationBehavior: ReturnType<typeof vi.fn> };
}

function makeHarness(): Harness {
  const logger = createMockLogger();
  const fileSystem = createMockFileSystem();
  vi.mocked(fileSystem.ensureDir).mockResolvedValue(undefined);
  vi.mocked(fileSystem.pathExists).mockResolvedValue(true);
  const policy = { getInitializationBehavior: vi.fn(() => ({})) };
  const ctx: ProxyLaunchContext = {
    logger,
    fileSystem,
    adapterRegistry: createMockAdapterRegistry(),
    proxyManagerFactory: new MockProxyManagerFactory(),
    logDirBase: LOG_DIR_BASE,
    defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true },
    updateSession: vi.fn(),
    selectPolicy: () => policy as unknown as AdapterPolicy,
    findFreePort: vi.fn(async () => 5678),
    setupProxyEventHandlers: vi.fn()
  };
  return { launcher: new ProxyLauncher(ctx), ctx, policy };
}

describe('ProxyLauncher.prepareLaunchInputs', () => {
  let h: Harness;

  beforeEach(() => {
    h = makeHarness();
  });

  it('lays out a launch: run log dir, adapter port, program/args/cwd, breakpoint snapshots, adapter config', async () => {
    const session = makeSession({
      breakpoints: new Map<string, Breakpoint>([
        [
          'bp-1',
          {
            id: 'bp-1',
            file: SCRIPT,
            line: 12,
            condition: 'x > 0',
            logMessage: 'x={x}',
            suspendPolicy: 'thread',
            verified: true
          }
        ]
      ]),
      functionBreakpoints: new Map<string, FunctionBreakpoint>([
        ['fbp-1', { id: 'fbp-1', functionName: 'main', condition: 'ready', verified: false }]
      ])
    });
    const request: ProxyLaunchRequest = {
      scriptPath: SCRIPT,
      scriptArgs: ['--flag'],
      dapLaunchArgs: { stopOnEntry: true }
    };

    const inputs = await h.launcher.prepareLaunchInputs(session, request);

    // One run directory per launch, persisted on the session for diagnostics.
    expect(inputs.sessionLogDir.startsWith(path.join(LOG_DIR_BASE, 'sess-1', 'run-'))).toBe(true);
    expect(h.ctx.fileSystem.ensureDir).toHaveBeenCalledWith(inputs.sessionLogDir);
    expect(h.ctx.updateSession).toHaveBeenCalledWith('sess-1', { logDir: inputs.sessionLogDir });
    expect(inputs.adapterPort).toBe(5678);

    // Caller args layered over the defaults; the launch fields derived from the script.
    expect(inputs.effectiveLaunchArgs).toEqual({ stopOnEntry: true, justMyCode: true });
    expect(inputs.isAttachMode).toBe(false);
    expect(inputs.genericLaunchConfig).toEqual({
      stopOnEntry: true,
      justMyCode: true,
      program: SCRIPT,
      args: ['--flag'],
      cwd: path.dirname(SCRIPT)
    });
    expect(inputs.adapterExtraKeys).toEqual([]);

    // Every per-breakpoint field survives the snapshot (#235), ids included (#439).
    expect(inputs.initialBreakpoints).toEqual([
      {
        id: 'bp-1',
        file: SCRIPT,
        line: 12,
        condition: 'x > 0',
        logMessage: 'x={x}',
        suspendPolicy: 'thread'
      }
    ]);
    expect(inputs.initialFunctionBreakpoints).toEqual([{ name: 'main', condition: 'ready' }]);

    // The adapter is created from this; the executable is resolved later.
    expect(inputs.adapterConfig).toEqual({
      sessionId: 'sess-1',
      executablePath: '',
      adapterHost: '127.0.0.1',
      adapterPort: 5678,
      logDir: inputs.sessionLogDir,
      scriptPath: SCRIPT,
      scriptArgs: ['--flag'],
      launchConfig: inputs.genericLaunchConfig,
      attachMode: false
    });
  });

  it('lets a caller-supplied program and cwd win over the script path (compiled languages)', async () => {
    const request: ProxyLaunchRequest = {
      scriptPath: SCRIPT,
      dapLaunchArgs: launchArgs({ program: path.join('/bin', 'app'), cwd: '/elsewhere' })
    };

    const inputs = await h.launcher.prepareLaunchInputs(makeSession(), request);

    expect(inputs.genericLaunchConfig.program).toBe(path.join('/bin', 'app'));
    expect(inputs.genericLaunchConfig.cwd).toBe('/elsewhere');
    expect(inputs.genericLaunchConfig.args).toBeUndefined();
  });

  it('sets no program, args or cwd for an attach-shaped request', async () => {
    const request: ProxyLaunchRequest = {
      scriptPath: 'attach://remote',
      dapLaunchArgs: launchArgs({ request: 'attach', __attachMode: true, host: '127.0.0.1', port: 5005 })
    };

    const inputs = await h.launcher.prepareLaunchInputs(makeSession(), request);

    expect(inputs.isAttachMode).toBe(true);
    expect(inputs.genericLaunchConfig).not.toHaveProperty('program');
    expect(inputs.genericLaunchConfig).not.toHaveProperty('args');
    expect(inputs.genericLaunchConfig).not.toHaveProperty('cwd');
    expect(inputs.genericLaunchConfig).toMatchObject({ request: 'attach', host: '127.0.0.1', port: 5005 });
    expect(inputs.adapterConfig.attachMode).toBe(true);
  });

  it('merges adapter extras over the generic config and strips the reserved request/__attachMode keys with a warning', async () => {
    const request: ProxyLaunchRequest = {
      scriptPath: SCRIPT,
      adapterLaunchConfig: { request: 'attach', __attachMode: true, django: true, env: { A: '1' } }
    };

    const inputs = await h.launcher.prepareLaunchInputs(makeSession(), request);

    // The extras reach the adapter; the mode selectors never do (#336).
    expect(inputs.genericLaunchConfig).toMatchObject({ django: true, env: { A: '1' }, program: SCRIPT });
    expect(inputs.genericLaunchConfig.request).toBeUndefined();
    expect(inputs.genericLaunchConfig.__attachMode).toBeUndefined();
    expect(inputs.isAttachMode).toBe(false);
    // Recorded for the attach transform diff (#450).
    expect(inputs.adapterExtraKeys).toEqual(['django', 'env']);
    expect(h.ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Ignoring reserved adapter-config key(s) for session sess-1: request, __attachMode')
    );
  });

  it('fails with the log-directory reason when the run directory cannot be created', async () => {
    vi.mocked(h.ctx.fileSystem.ensureDir).mockRejectedValueOnce(new Error('disk full'));

    await expect(
      h.launcher.prepareLaunchInputs(makeSession(), { scriptPath: SCRIPT })
    ).rejects.toThrow('Failed to create session log directory: disk full');
    expect(h.ctx.updateSession).not.toHaveBeenCalled();
    expect(h.ctx.findFreePort).not.toHaveBeenCalled();
  });

  it('fails when the run directory does not exist after ensureDir', async () => {
    vi.mocked(h.ctx.fileSystem.pathExists).mockResolvedValueOnce(false);

    await expect(
      h.launcher.prepareLaunchInputs(makeSession(), { scriptPath: SCRIPT })
    ).rejects.toThrow(/could not be created/);
  });
});

describe('ProxyLauncher.buildAdapterLaunchPlan', () => {
  let h: Harness;
  let session: ManagedSession;
  let adapter: FakeDebugAdapter;

  beforeEach(() => {
    h = makeHarness();
    session = makeSession();
    adapter = new FakeDebugAdapter();
  });

  async function inputsFor(request: ProxyLaunchRequest): Promise<LaunchInputs> {
    return h.launcher.prepareLaunchInputs(session, request);
  }

  it('assembles the ProxyConfig from the transformed launch config, filtering non-string args', async () => {
    Object.assign(h.ctx.logger, { level: 'debug' });
    const breakOnExceptions: ExceptionBreakMode = 'uncaught';
    const request: ProxyLaunchRequest = {
      scriptPath: SCRIPT,
      scriptArgs: ['--flag'],
      dapLaunchArgs: { stopOnEntry: true },
      dryRunSpawn: true,
      breakOnExceptions
    };
    const inputs = await inputsFor(request);
    const transformed: LanguageSpecificLaunchConfig = {
      program: path.join('/bin', 'app'),
      // A transform is adapter code; the plan filters non-strings defensively.
      args: ['a', 2, 'b'] as unknown as string[],
      stopOnEntry: false,
      justMyCode: false,
      extra: 'kept'
    };

    const plan = h.launcher.buildAdapterLaunchPlan(
      session,
      adapter,
      inputs,
      request,
      transformed,
      path.join('/usr', 'bin', 'fake')
    );

    // The caller said stopOnEntry, so the policy default is not consulted and
    // the transform's value stands.
    expect(h.policy.getInitializationBehavior).not.toHaveBeenCalled();
    expect(plan.launchConfig).toEqual(transformed);
    expect(adapter.buildAdapterCommand).toHaveBeenCalledWith(inputs.adapterConfig);
    expect(plan.proxyConfig).toEqual({
      sessionId: 'sess-1',
      language: DebugLanguage.PYTHON,
      executablePath: path.join('/usr', 'bin', 'fake'),
      adapterHost: '127.0.0.1',
      adapterPort: 5678,
      logDir: inputs.sessionLogDir,
      scriptPath: path.join('/bin', 'app'),
      scriptArgs: ['a', 'b'],
      stopOnEntry: false,
      justMyCode: false,
      initialBreakpoints: [],
      initialFunctionBreakpoints: [],
      dryRunSpawn: true,
      logLevel: 'debug',
      breakOnExceptions: 'uncaught',
      launchConfig: transformed,
      adapterCommand: {
        command: 'node',
        args: ['fake-adapter.js', '--port', '5678'],
        env: {}
      },
      attachMode: false
    });
  });

  it('falls back to the script path, the caller args and the effective launch args when the transform supplies none', async () => {
    const request: ProxyLaunchRequest = {
      scriptPath: SCRIPT,
      scriptArgs: ['--flag'],
      dapLaunchArgs: { stopOnEntry: true, justMyCode: false }
    };
    const inputs = await inputsFor(request);

    const plan = h.launcher.buildAdapterLaunchPlan(session, adapter, inputs, request, {}, 'python');

    expect(plan.proxyConfig).toMatchObject({
      scriptPath: SCRIPT,
      scriptArgs: ['--flag'],
      stopOnEntry: true,
      justMyCode: false,
      dryRunSpawn: false
    });
    expect(plan.proxyConfig.logLevel).toBeUndefined();
  });

  it('leaves scriptArgs undefined when neither the transform nor the caller supplied any', async () => {
    const request: ProxyLaunchRequest = { scriptPath: SCRIPT };
    const inputs = await inputsFor(request);

    const plan = h.launcher.buildAdapterLaunchPlan(session, adapter, inputs, request, { args: [] }, 'python');

    expect(plan.proxyConfig.scriptArgs).toBeUndefined();
  });

  it('applies the policy default stopOnEntry only when the caller gave none', async () => {
    h.policy.getInitializationBehavior.mockReturnValue({ defaultStopOnEntry: false });

    const silent: ProxyLaunchRequest = { scriptPath: SCRIPT };
    const silentPlan = h.launcher.buildAdapterLaunchPlan(
      session,
      adapter,
      await inputsFor(silent),
      silent,
      { stopOnEntry: true },
      'python'
    );
    expect(silentPlan.launchConfig.stopOnEntry).toBe(false);
    expect(silentPlan.proxyConfig.stopOnEntry).toBe(false);

    const explicit: ProxyLaunchRequest = { scriptPath: SCRIPT, dapLaunchArgs: { stopOnEntry: true } };
    const explicitPlan = h.launcher.buildAdapterLaunchPlan(
      session,
      adapter,
      await inputsFor(explicit),
      explicit,
      { stopOnEntry: true },
      'python'
    );
    expect(explicitPlan.launchConfig.stopOnEntry).toBe(true);
    expect(explicitPlan.proxyConfig.stopOnEntry).toBe(true);
  });

  it('builds no adapter command for a direct-connect attach', async () => {
    adapter.withAttachSupport({ directConnect: true });
    const request: ProxyLaunchRequest = {
      scriptPath: 'attach://remote',
      dapLaunchArgs: launchArgs({ request: 'attach', __attachMode: true, port: 12345 })
    };
    const inputs = await inputsFor(request);

    const plan = h.launcher.buildAdapterLaunchPlan(session, adapter, inputs, request, { port: 12345 }, 'ruby');

    expect(adapter.buildAdapterCommand).not.toHaveBeenCalled();
    expect(plan.proxyConfig.adapterCommand).toBeUndefined();
    expect(plan.proxyConfig.attachMode).toBe(true);
    expect(plan.proxyConfig.executablePath).toBe('ruby');
  });
});
