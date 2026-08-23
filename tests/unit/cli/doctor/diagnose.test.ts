/**
 * Unit tests for the doctor command's orchestration (issue #423).
 *
 * Everything is injected: a fake registry with fake factories, a fake
 * environment/filesystem. No process is spawned. Presentation comes from the
 * factories' own describeToolchain (issue #435).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { IEnvironment, IFileSystem } from '@debugmcp/shared';
import { diagnose, type DiagnoseDeps } from '../../../../src/cli/commands/doctor/diagnose.js';

const makeEnvironment = (env: Record<string, string | undefined> = {}): IEnvironment => ({
  get: (key: string) => env[key],
  getAll: () => env,
  getCurrentWorkingDirectory: () => process.cwd()
});

const makeFileSystem = (): IFileSystem =>
  ({
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
    readdir: vi.fn().mockRejectedValue(new Error('ENOENT'))
  }) as unknown as IFileSystem;

interface FakeAdapterSpec {
  name: string;
  installed?: boolean;
  attach?: 'none' | 'direct-connect' | 'spawn';
  validate?: () => Promise<{ valid: boolean; errors: string[]; warnings: string[]; details?: Record<string, unknown> }>;
  /** Adapter-owned doctor row (issue #435); absent models an older factory. */
  describeToolchain?: (validation: unknown, options?: unknown) => Promise<unknown>;
  /** Return a loaded factory that lacks a validate function (version skew). */
  factoryWithoutValidate?: boolean;
  /** Delay (ms) before getFactory resolves — models a slow dynamic import. */
  factoryLoadDelayMs?: number;
}

function makeDeps(adapters: FakeAdapterSpec[], overrides: Partial<DiagnoseDeps> = {}): DiagnoseDeps {
  const registry = {
    listAvailableAdapters: vi.fn().mockResolvedValue(
      adapters.map((a) => ({
        name: a.name,
        packageName: `@debugmcp/adapter-${a.name}`,
        installed: a.installed ?? true,
        attach: a.attach ?? 'none'
      }))
    ),
    getFactory: vi.fn(async (language: string) => {
      const spec = adapters.find((a) => a.name === language);
      if (!spec || !(spec.installed ?? true)) {
        return undefined;
      }
      if (spec.factoryLoadDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, spec.factoryLoadDelayMs));
      }
      if (spec.factoryWithoutValidate) {
        return { getMetadata: () => ({ modes: { launch: true, attach: spec.attach ?? 'none' } }) };
      }
      if (!spec.validate) {
        return undefined;
      }
      return {
        validate: spec.validate,
        ...(spec.describeToolchain ? { describeToolchain: spec.describeToolchain } : {}),
        getMetadata: () => ({ modes: { launch: true, attach: spec.attach ?? 'none' } }),
        createAdapter: () => {
          throw new Error('doctor must never instantiate adapters');
        }
      };
    })
  };

  return {
    registry: registry as unknown as DiagnoseDeps['registry'],
    environment: makeEnvironment(),
    fileSystem: makeFileSystem(),
    env: {},
    platform: 'win32',
    timeoutMs: 5000,
    version: '0.0.0-test',
    ...overrides
  };
}

const okValidate = (details: Record<string, unknown> = {}) => async () => ({
  valid: true,
  errors: [],
  warnings: [],
  details
});

afterEach(() => {
  vi.useRealTimers();
});

describe('diagnose', () => {
  it('reports ok for a healthy adapter and carries validate details through', async () => {
    const deps = makeDeps([
      { name: 'python', validate: okValidate({ pythonPath: '/usr/bin/python3', pythonVersion: '3.12.1' }) }
    ]);

    const report = await diagnose([], deps);

    expect(report.schemaVersion).toBe(1);
    expect(report.languages).toHaveLength(1);
    const python = report.languages[0];
    expect(python.verdict).toBe('ok');
    expect(python.errors).toEqual([]);
    expect(python.details).toMatchObject({ pythonPath: '/usr/bin/python3' });
    expect(python.probe.timedOut).toBe(false);
    expect(python.probe.failed).toBe(false);
    expect(python.modes?.launch.available).toBe(true);
  });

  it('reports warn when validation succeeds with warnings', async () => {
    const deps = makeDeps([
      {
        name: 'rust',
        validate: async () => ({ valid: true, errors: [], warnings: ['MSVC toolchain detected'], details: {} })
      }
    ]);

    const report = await diagnose([], deps);

    expect(report.languages[0].verdict).toBe('warn');
    expect(report.languages[0].warnings).toEqual(['MSVC toolchain detected']);
  });

  it('reports broken with the validation errors when the toolchain is invalid', async () => {
    const deps = makeDeps([
      {
        name: 'go',
        validate: async () => ({ valid: false, errors: ['Delve not found. Run: go install ...'], warnings: [], details: {} })
      }
    ]);

    const report = await diagnose([], deps);

    expect(report.languages[0].verdict).toBe('broken');
    expect(report.languages[0].errors[0]).toContain('Delve not found');
    expect(report.languages[0].modes?.launch.available).toBe(false);
  });

  it('downgrades broken to warn when attach remains available (container ruby: attach-only by design)', async () => {
    const deps = makeDeps([
      {
        name: 'ruby',
        attach: 'direct-connect',
        validate: async () => ({ valid: false, errors: ['Ruby not found.'], warnings: [], details: {} })
      }
    ]);

    const report = await diagnose([], deps);

    const ruby = report.languages[0];
    expect(ruby.verdict).toBe('warn');
    expect(ruby.errors[0]).toContain('Ruby not found');
    expect(ruby.warnings.some((w) => w.includes('attach'))).toBe(true);
    expect(ruby.modes?.launch.available).toBe(false);
    expect(ruby.modes?.attach.available).toBe(true);
    // Gating on such a language must pass: its supported mode works.
    await expect(diagnose(['ruby'], deps)).resolves.toMatchObject({ exitCode: 0 });
  });

  it('keeps broken when neither launch nor attach is available', async () => {
    const deps = makeDeps([
      {
        name: 'go',
        attach: 'none',
        validate: async () => ({ valid: false, errors: ['Delve not found.'], warnings: [], details: {} })
      }
    ]);

    const report = await diagnose(['go'], deps);

    expect(report.languages[0].verdict).toBe('broken');
    expect(report.exitCode).toBe(1);
  });

  it('reports missing for adapters that are not installed', async () => {
    const deps = makeDeps([{ name: 'ruby', installed: false }]);

    const report = await diagnose([], deps);

    expect(report.languages[0].verdict).toBe('missing');
    expect(report.languages[0].modes?.launch.available).toBe(false);
    expect(report.languages[0].modes?.launch.reason).toContain('@debugmcp/adapter-ruby');
  });

  it('reports disabled for adapters disabled via DEBUG_MCP_DISABLE_LANGUAGES', async () => {
    const deps = makeDeps([{ name: 'python', validate: okValidate() }], {
      env: { DEBUG_MCP_DISABLE_LANGUAGES: 'python' }
    });

    const report = await diagnose([], deps);

    expect(report.languages[0].verdict).toBe('disabled');
  });

  it('reports broken with probe.failed when validate throws, while modes fail open like the server', async () => {
    const deps = makeDeps([
      {
        name: 'java',
        validate: async () => {
          throw new Error('probe exploded');
        }
      }
    ]);

    const report = await diagnose([], deps);

    const java = report.languages[0];
    expect(java.verdict).toBe('broken');
    expect(java.probe.failed).toBe(true);
    expect(java.errors[0]).toContain('probe exploded');
    // Parity: computeModeAvailability fails open on probe errors, and doctor
    // must report the same modes the server would.
    expect(java.modes?.launch.available).toBe(true);
  });

  it('reports broken with probe.timedOut when validate never settles', async () => {
    vi.useFakeTimers();
    const deps = makeDeps(
      [{ name: 'dotnet', validate: () => new Promise(() => undefined) }],
      { timeoutMs: 1000 }
    );

    const reportPromise = diagnose([], deps);
    await vi.advanceTimersByTimeAsync(1100);
    const report = await reportPromise;

    const dotnet = report.languages[0];
    expect(dotnet.verdict).toBe('broken');
    expect(dotnet.probe.timedOut).toBe(true);
    expect(dotnet.modes?.launch.available).toBe(true); // fail-open parity
  });

  it('reports broken (not warn) for an installed adapter whose factory cannot be loaded, failing a gated run', async () => {
    // installed: true but no validate => the fake registry returns undefined
    // from getFactory, modelling a corrupt/version-skewed adapter package.
    const deps = makeDeps([{ name: 'python', installed: true }]);

    const report = await diagnose(['python'], deps);

    const python = report.languages[0];
    expect(python.verdict).toBe('broken');
    expect(python.probe.failed).toBe(true);
    expect(python.errors[0]).toContain('factory');
    expect(report.exitCode).toBe(1);
    // Fail-open parity: the server would still assume availability here.
    expect(python.modes?.launch.available).toBe(true);
  });

  it('does not bill a slow factory import against the validate/describe budget (no spurious timeout)', async () => {
    vi.useFakeTimers();
    const deps = makeDeps(
      [
        {
          name: 'dotnet',
          factoryLoadDelayMs: 900, // slow cold import eats most of a naive shared budget
          validate: okValidate({ debuggerPath: '/x' }),
          describeToolchain: () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ runtime: { label: '.NET SDK', version: '8.0.301' } }), 500)
            )
        }
      ],
      { timeoutMs: 1000 }
    );

    const reportPromise = diagnose([], deps);
    await vi.advanceTimersByTimeAsync(2000);
    const report = await reportPromise;

    const dotnet = report.languages[0];
    expect(dotnet.verdict).toBe('ok');
    expect(dotnet.probe.timedOut).toBe(false);
    expect(dotnet.runtime).toEqual({ label: '.NET SDK', version: '8.0.301' }); // the slow row survived
  });

  it('reports broken with probe.timedOut when getFactory itself hangs (wedged dynamic import)', async () => {
    vi.useFakeTimers();
    const deps = makeDeps([{ name: 'java', validate: okValidate() }], { timeoutMs: 1000 });
    (deps.registry as unknown as { getFactory: ReturnType<typeof vi.fn> }).getFactory = vi.fn(
      () => new Promise(() => undefined)
    );

    const reportPromise = diagnose([], deps);
    await vi.advanceTimersByTimeAsync(3000);
    const report = await reportPromise;

    const java = report.languages[0];
    expect(java.verdict).toBe('broken');
    expect(java.probe.timedOut).toBe(true);
  });

  it('reports the elapsed load time on a broken factory instead of durationMs 0', async () => {
    vi.useFakeTimers();
    const deps = makeDeps([{ name: 'python', installed: true }], { timeoutMs: 5000 });
    (deps.registry as unknown as { getFactory: ReturnType<typeof vi.fn> }).getFactory = vi.fn(
      () =>
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error('import exploded')), 400))
    );

    const reportPromise = diagnose([], deps);
    await vi.advanceTimersByTimeAsync(500);
    const report = await reportPromise;

    expect(report.languages[0].verdict).toBe('broken');
    expect(report.languages[0].probe.durationMs).toBeGreaterThanOrEqual(400);
  });

  it('diagnoses a loaded factory without validate() as version skew, not a load failure', async () => {
    const deps = makeDeps([{ name: 'python', factoryWithoutValidate: true }]);

    const report = await diagnose(['python'], deps);

    const python = report.languages[0];
    expect(python.verdict).toBe('broken');
    expect(python.errors[0]).toContain('validate');
    expect(python.errors[0]).not.toContain('could not be loaded');
    expect(report.exitCode).toBe(1);
  });

  it('sets probe.timedOut when describeToolchain hangs, so the handler can force-exit', async () => {
    vi.useFakeTimers();
    const deps = makeDeps(
      [
        {
          name: 'dotnet',
          validate: okValidate({ debuggerPath: '/x' }),
          describeToolchain: () => new Promise(() => undefined)
        }
      ],
      { timeoutMs: 1000 }
    );

    const reportPromise = diagnose([], deps);
    await vi.advanceTimersByTimeAsync(2200);
    const report = await reportPromise;

    const dotnet = report.languages[0];
    expect(dotnet.verdict).toBe('ok'); // presentation is best-effort; the verdict stands on validate()
    expect(dotnet.probe.timedOut).toBe(true);
    expect(dotnet.runtime).toBeUndefined();
  });

  it('counts the describeToolchain phase inside probe.durationMs', async () => {
    vi.useFakeTimers();
    const deps = makeDeps(
      [
        {
          name: 'dotnet',
          validate: okValidate({ debuggerPath: '/x' }),
          describeToolchain: () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ runtime: { label: '.NET SDK', version: '8.0.301' } }), 300)
            )
        }
      ],
      { timeoutMs: 5000 }
    );

    const reportPromise = diagnose([], deps);
    await vi.advanceTimersByTimeAsync(400);
    const report = await reportPromise;

    expect(report.languages[0].probe.durationMs).toBeGreaterThanOrEqual(300);
  });

  it('survives a factory whose getMetadata throws, falling back to the registry attach mechanism', async () => {
    const deps = makeDeps([{ name: 'ruby', attach: 'direct-connect', validate: okValidate() }]);
    const registry = deps.registry as unknown as { getFactory: ReturnType<typeof vi.fn> };
    const originalGetFactory = registry.getFactory;
    registry.getFactory = vi.fn(async (language: string) => {
      const factory = await originalGetFactory(language);
      return factory
        ? { ...factory, getMetadata: () => { throw new Error('metadata exploded'); } }
        : undefined;
    });

    const report = await diagnose([], deps);

    expect(report.languages).toHaveLength(1);
    expect(report.languages[0].verdict).toBe('ok');
    expect(report.languages[0].modes?.attach.available).toBe(true); // from entry.attach
  });

  it('hands the validate() result to describeToolchain and carries its rows into runtime/backend', async () => {
    const deps = makeDeps([
      {
        name: 'dotnet',
        validate: okValidate({ debuggerPath: '/opt/netcoredbg' }),
        describeToolchain: async (validation) => {
          expect(validation).toMatchObject({ valid: true, details: { debuggerPath: '/opt/netcoredbg' } });
          return {
            runtime: { label: '.NET SDK', version: '8.0.301' },
            backend: { label: 'netcoredbg', path: '/opt/netcoredbg', version: '3.1.2-1054' }
          };
        }
      }
    ]);

    const report = await diagnose([], deps);

    const dotnet = report.languages[0];
    expect(dotnet.runtime).toEqual({ label: '.NET SDK', version: '8.0.301' });
    expect(dotnet.backend).toEqual({ label: 'netcoredbg', path: '/opt/netcoredbg', version: '3.1.2-1054' });
    // details stay the raw validate() output — presentation no longer leaks into them
    expect(dotnet.details).toEqual({ debuggerPath: '/opt/netcoredbg' });
  });

  it('keeps the verdict and renders empty cells when describeToolchain itself fails', async () => {
    const deps = makeDeps([
      {
        name: 'cpp',
        validate: okValidate(),
        describeToolchain: async () => {
          throw new Error('presentation exploded');
        }
      }
    ]);

    const report = await diagnose([], deps);

    expect(report.languages[0].verdict).toBe('ok');
    expect(report.languages[0].runtime).toBeUndefined();
    expect(report.languages[0].backend).toBeUndefined();
  });

  it('renders empty cells for a factory without describeToolchain (older adapter package)', async () => {
    const deps = makeDeps([
      { name: 'python', validate: okValidate({ pythonPath: '/usr/bin/python3' }) }
    ]);

    const report = await diagnose([], deps);

    expect(report.languages[0].verdict).toBe('ok');
    expect(report.languages[0].runtime).toBeUndefined();
    expect(report.languages[0].backend).toBeUndefined();
    expect(report.languages[0].details).toEqual({ pythonPath: '/usr/bin/python3' });
  });

  it('normalizes a malformed describeToolchain return (out-of-tree factory is plain JS)', async () => {
    const deps = makeDeps([
      {
        name: 'python',
        validate: okValidate(),
        describeToolchain: async () => ({
          runtime: { label: 'Python' }, // bare label — nothing detected, must not render
          backend: 'not even an object'
        })
      }
    ]);

    const report = await diagnose([], deps);

    expect(report.languages[0].runtime).toBeUndefined();
    expect(report.languages[0].backend).toBeUndefined();
  });

  it('still describes the toolchain when validate() reports invalid (partial rows stay honest)', async () => {
    const deps = makeDeps([
      {
        name: 'dotnet',
        validate: async () => ({
          valid: false,
          errors: ['dotnet SDK not found'],
          warnings: [],
          details: { debuggerPath: '/opt/netcoredbg' }
        }),
        describeToolchain: async () => ({
          backend: { label: 'netcoredbg', path: '/opt/netcoredbg' }
        })
      }
    ]);

    const report = await diagnose([], deps);

    expect(report.languages[0].verdict).toBe('broken');
    expect(report.languages[0].backend).toEqual({ label: 'netcoredbg', path: '/opt/netcoredbg' });
  });

  it('lists unknown requested languages and fails the run', async () => {
    const deps = makeDeps([{ name: 'python', validate: okValidate() }]);

    const report = await diagnose(['python', 'nosuchlang'], deps);

    expect(report.unknownLanguages).toEqual(['nosuchlang']);
    expect(report.exitCode).toBe(1);
  });

  describe('exit code', () => {
    it('is 0 in overview mode even when adapters are broken', async () => {
      const deps = makeDeps([
        { name: 'go', validate: async () => ({ valid: false, errors: ['nope'], warnings: [] }) }
      ]);

      const report = await diagnose([], deps);

      expect(report.exitCode).toBe(0);
    });

    it('is 0 when every requested language is ok or warn', async () => {
      const deps = makeDeps([
        { name: 'python', validate: okValidate() },
        { name: 'rust', validate: async () => ({ valid: true, errors: [], warnings: ['w'] }) },
        { name: 'go', validate: async () => ({ valid: false, errors: ['nope'], warnings: [] }) }
      ]);

      const report = await diagnose(['python', 'rust'], deps);

      expect(report.exitCode).toBe(0);
    });

    it('is 1 when a requested language is broken', async () => {
      const deps = makeDeps([
        { name: 'python', validate: okValidate() },
        { name: 'go', validate: async () => ({ valid: false, errors: ['nope'], warnings: [] }) }
      ]);

      const report = await diagnose(['go'], deps);

      expect(report.exitCode).toBe(1);
    });

    it('is 1 when a requested language is missing or disabled', async () => {
      const deps = makeDeps([{ name: 'ruby', installed: false }, { name: 'python', validate: okValidate() }], {
        env: { DEBUG_MCP_DISABLE_LANGUAGES: 'python' }
      });

      await expect(diagnose(['ruby'], deps)).resolves.toMatchObject({ exitCode: 1 });
      await expect(diagnose(['python'], deps)).resolves.toMatchObject({ exitCode: 1 });
    });

    it('normalizes requested language casing', async () => {
      const deps = makeDeps([{ name: 'python', validate: okValidate() }]);

      const report = await diagnose(['PYTHON'], deps);

      expect(report.unknownLanguages).toEqual([]);
      expect(report.exitCode).toBe(0);
    });
  });

  it('runs the language probes in parallel', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const slowValidate = () => async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return { valid: true, errors: [], warnings: [] };
    };
    const deps = makeDeps([
      { name: 'python', validate: slowValidate() },
      { name: 'go', validate: slowValidate() },
      { name: 'ruby', validate: slowValidate() }
    ]);

    await diagnose([], deps);

    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('includes platform checks and platform info in the report', async () => {
    const deps = makeDeps([{ name: 'mock', validate: okValidate() }]);

    const report = await diagnose([], deps);

    expect(report.platform.os).toBe('win32');
    expect(report.platform.containerMode).toBe(false);
    const ids = report.platformChecks.map((c) => c.id);
    expect(ids).toContain('container-mode');
    expect(ids).toContain('workspace-mount');
    expect(ids).toContain('yama-ptrace-scope');
  });
});
