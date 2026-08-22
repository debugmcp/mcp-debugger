/**
 * Unit tests for the doctor command handler (issue #423).
 *
 * Follows the check-rust-binary handler test pattern: stub the stdout/stderr
 * writers, inject fake dependencies, assert on the joined output and the
 * returned exit code. Nothing real is probed.
 */
import { describe, it, expect, vi } from 'vitest';
import { handleDoctorCommand, type DoctorDependencies } from '../../../../src/cli/commands/doctor/index.js';

interface FakeAdapterSpec {
  name: string;
  installed?: boolean;
  validate?: () => Promise<{ valid: boolean; errors: string[]; warnings: string[]; details?: Record<string, unknown> }>;
}

function makeFakeDependencies(adapters: FakeAdapterSpec[]): DoctorDependencies & { disposeLogger: ReturnType<typeof vi.fn> } {
  const registry = {
    listAvailableAdapters: vi.fn().mockResolvedValue(
      adapters.map((a) => ({
        name: a.name,
        packageName: `@debugmcp/adapter-${a.name}`,
        installed: a.installed ?? true,
        attach: 'none' as const
      }))
    ),
    getFactory: vi.fn(async (language: string) => {
      const spec = adapters.find((a) => a.name === language);
      if (!spec || !spec.validate) return undefined;
      return {
        validate: spec.validate,
        getMetadata: () => ({ modes: { launch: true, attach: 'none' as const } })
      };
    })
  };
  return {
    adapterRegistry: registry,
    environment: {
      get: () => undefined,
      getAll: () => ({}),
      getCurrentWorkingDirectory: () => process.cwd()
    },
    fileSystem: {
      readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
      stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
      readdir: vi.fn().mockRejectedValue(new Error('ENOENT'))
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    disposeLogger: vi.fn()
  } as unknown as DoctorDependencies & { disposeLogger: ReturnType<typeof vi.fn> };
}

const okAdapter = (name: string): FakeAdapterSpec => ({
  name,
  validate: async () => ({ valid: true, errors: [], warnings: [], details: {} })
});

const brokenAdapter = (name: string): FakeAdapterSpec => ({
  name,
  validate: async () => ({ valid: false, errors: [`${name} toolchain missing`], warnings: [] })
});

function collectOutput() {
  const chunks: string[] = [];
  return {
    writeOutput: (text: string) => chunks.push(text),
    joined: () => chunks.join('\n')
  };
}

describe('handleDoctorCommand', () => {
  it('writes a human-readable report and returns 0 for a healthy overview', async () => {
    const deps = makeFakeDependencies([okAdapter('python'), okAdapter('mock')]);
    const output = collectOutput();

    const code = await handleDoctorCommand([], {}, {
      createDependencies: () => deps,
      writeOutput: output.writeOutput,
      writeError: vi.fn(),
      exit: vi.fn()
    });

    expect(code).toBe(0);
    expect(output.joined()).toContain('Adapter');
    expect(output.joined()).toContain('python');
    expect(deps.disposeLogger).toHaveBeenCalled();
  });

  it('emits parseable JSON and nothing else with --json', async () => {
    const deps = makeFakeDependencies([okAdapter('python')]);
    const output = collectOutput();

    const code = await handleDoctorCommand([], { json: true }, {
      createDependencies: () => deps,
      writeOutput: output.writeOutput,
      writeError: vi.fn(),
      exit: vi.fn()
    });

    expect(code).toBe(0);
    const parsed = JSON.parse(output.joined());
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.languages).toHaveLength(1);
  });

  it('returns 1 when a requested language is broken', async () => {
    const deps = makeFakeDependencies([okAdapter('python'), brokenAdapter('go')]);
    const output = collectOutput();

    const code = await handleDoctorCommand(['go'], {}, {
      createDependencies: () => deps,
      writeOutput: output.writeOutput,
      writeError: vi.fn(),
      exit: vi.fn()
    });

    expect(code).toBe(1);
  });

  it('returns 2 and reports the error when dependency construction fails', async () => {
    const writeError = vi.fn();

    const code = await handleDoctorCommand([], {}, {
      createDependencies: () => {
        throw new Error('container exploded');
      },
      writeOutput: vi.fn(),
      writeError,
      exit: vi.fn()
    });

    expect(code).toBe(2);
    expect(writeError.mock.calls.join('\n')).toContain('container exploded');
  });

  it('disposes the logger even when diagnosis fails, and returns 2', async () => {
    const deps = makeFakeDependencies([]);
    (deps.adapterRegistry as unknown as { listAvailableAdapters: ReturnType<typeof vi.fn> }).listAvailableAdapters =
      vi.fn().mockRejectedValue(new Error('registry exploded'));
    const writeError = vi.fn();

    const code = await handleDoctorCommand([], {}, {
      createDependencies: () => deps,
      writeOutput: vi.fn(),
      writeError,
      exit: vi.fn()
    });

    expect(code).toBe(2);
    expect(deps.disposeLogger).toHaveBeenCalled();
  });

  it('returns 2 for an unparseable --timeout', async () => {
    const writeError = vi.fn();

    const code = await handleDoctorCommand([], { timeout: 'soon' }, {
      createDependencies: () => makeFakeDependencies([]),
      writeOutput: vi.fn(),
      writeError,
      exit: vi.fn()
    });

    expect(code).toBe(2);
    expect(writeError.mock.calls.join('\n')).toContain('timeout');
  });

  it('force-exits only when a probe timed out (hung child containment)', async () => {
    const hungDeps = makeFakeDependencies([
      { name: 'python', validate: () => new Promise(() => undefined) }
    ]);
    const exit = vi.fn();

    const code = await handleDoctorCommand([], { timeout: '50' }, {
      createDependencies: () => hungDeps,
      writeOutput: vi.fn(),
      writeError: vi.fn(),
      exit
    });

    expect(exit).toHaveBeenCalledWith(code);

    const healthyDeps = makeFakeDependencies([okAdapter('python')]);
    const noExit = vi.fn();
    await handleDoctorCommand([], {}, {
      createDependencies: () => healthyDeps,
      writeOutput: vi.fn(),
      writeError: vi.fn(),
      exit: noExit
    });

    expect(noExit).not.toHaveBeenCalled();
  });
});
