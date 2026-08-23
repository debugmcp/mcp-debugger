/**
 * CodeLLDB adapter-settings injection (issue #441).
 *
 * CodeLLDB's lang_support/rust.py loads the Rust formatter scripts from
 * `lang.rust.sysroot` when set, and only falls back to `rustc --print=sysroot`
 * when it is not. On rustc-less hosts (the Docker image), the adapter injects
 * that setting from CODELLDB_RUST_SYSROOT via _adapterSettings.scriptConfig,
 * and passes a user-supplied _adapterSettings through (previously it was
 * silently dropped by the transform's explicit key list).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RustDebugAdapter } from '../src/rust-debug-adapter.js';
import { buildRustAdapterSettings } from '../src/utils/rust-utils.js';
import { AdapterDependencies } from '@debugmcp/shared';

interface AdapterSettingsShape {
  scriptConfig?: {
    lang?: {
      rust?: {
        sysroot?: string;
      };
    };
  };
  [key: string]: unknown;
}

function makeDependencies(env: Record<string, string | undefined>): AdapterDependencies {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    environment: {
      get: vi.fn((key: string) => env[key]),
      getAll: vi.fn(() => env as Record<string, string>),
      getCurrentWorkingDirectory: vi.fn(() => process.cwd())
    }
  } as unknown as AdapterDependencies;
}

/** Creates a temp sysroot; with `valid`, includes lib/rustlib/etc/lldb_lookup.py. */
function makeSysroot(valid: boolean): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-sysroot-'));
  if (valid) {
    const etc = path.join(root, 'lib', 'rustlib', 'etc');
    fs.mkdirSync(etc, { recursive: true });
    fs.writeFileSync(path.join(etc, 'lldb_lookup.py'), '# formatter stub\n');
  }
  return root;
}

describe('buildRustAdapterSettings', () => {
  it('returns undefined with no user settings and no sysroot', () => {
    expect(buildRustAdapterSettings(undefined, undefined)).toBeUndefined();
  });

  it('builds the nested scriptConfig shape from a sysroot alone', () => {
    expect(buildRustAdapterSettings(undefined, '/opt/rust-sysroot')).toEqual({
      scriptConfig: { lang: { rust: { sysroot: '/opt/rust-sysroot' } } }
    });
  });

  it('preserves unrelated user settings while injecting the sysroot', () => {
    const merged = buildRustAdapterSettings(
      { displayFormat: 'auto', scriptConfig: { other: true } },
      '/opt/rust-sysroot'
    ) as AdapterSettingsShape;
    expect(merged.displayFormat).toBe('auto');
    expect((merged.scriptConfig as Record<string, unknown>).other).toBe(true);
    expect(merged.scriptConfig?.lang?.rust?.sysroot).toBe('/opt/rust-sysroot');
  });

  it('lets a user-supplied sysroot leaf win over the environment-derived one', () => {
    const merged = buildRustAdapterSettings(
      { scriptConfig: { lang: { rust: { sysroot: '/user/choice' } } } },
      '/opt/rust-sysroot'
    ) as AdapterSettingsShape;
    expect(merged.scriptConfig?.lang?.rust?.sysroot).toBe('/user/choice');
  });

  it('passes user settings through unchanged when no sysroot is derived', () => {
    const user = { scriptConfig: { lang: { rust: { sysroot: '/user/choice' } } }, extra: 1 };
    expect(buildRustAdapterSettings(user, undefined)).toEqual(user);
  });

  it('does not clobber a non-object intermediate the user set', () => {
    const merged = buildRustAdapterSettings(
      { scriptConfig: 'not-an-object' },
      '/opt/rust-sysroot'
    ) as AdapterSettingsShape;
    // User value preserved; injection skipped rather than overwriting it.
    expect(merged.scriptConfig).toBe('not-an-object');
  });

  it('ignores non-object user settings', () => {
    expect(buildRustAdapterSettings('bogus', undefined)).toBeUndefined();
    expect(buildRustAdapterSettings(['bogus'], '/opt/rust-sysroot')).toEqual({
      scriptConfig: { lang: { rust: { sysroot: '/opt/rust-sysroot' } } }
    });
  });

  it('does not mutate the user settings object', () => {
    const user = { scriptConfig: { lang: {} } };
    buildRustAdapterSettings(user, '/opt/rust-sysroot');
    expect(user).toEqual({ scriptConfig: { lang: {} } });
  });
});

describe('transformLaunchConfig _adapterSettings (issue #441)', () => {
  const tempRoots: string[] = [];

  function sysrootDir(valid: boolean): string {
    const root = makeSysroot(valid);
    tempRoots.push(root);
    return root;
  }

  afterEach(() => {
    while (tempRoots.length > 0) {
      const dir = tempRoots.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  async function transform(
    env: Record<string, string | undefined>,
    config: Record<string, unknown>
  ): Promise<{ result: Record<string, unknown>; deps: AdapterDependencies }> {
    const deps = makeDependencies(env);
    const adapter = new RustDebugAdapter(deps);
    const result = (await adapter.transformLaunchConfig({
      program: './target/debug/myapp',
      ...config
    })) as Record<string, unknown>;
    return { result, deps };
  }

  it('injects scriptConfig.lang.rust.sysroot when CODELLDB_RUST_SYSROOT points at a valid sysroot', async () => {
    const sysroot = sysrootDir(true);
    const { result } = await transform({ CODELLDB_RUST_SYSROOT: sysroot }, {});
    const settings = result._adapterSettings as AdapterSettingsShape;
    expect(settings.scriptConfig?.lang?.rust?.sysroot).toBe(sysroot);
  });

  it('omits _adapterSettings entirely when the env var is unset', async () => {
    const { result } = await transform({}, {});
    expect(result._adapterSettings).toBeUndefined();
  });

  it('treats a blank env var as unset', async () => {
    const { result } = await transform({ CODELLDB_RUST_SYSROOT: '   ' }, {});
    expect(result._adapterSettings).toBeUndefined();
  });

  it('skips injection and warns when the sysroot lacks lldb_lookup.py', async () => {
    const sysroot = sysrootDir(false);
    const { result, deps } = await transform({ CODELLDB_RUST_SYSROOT: sysroot }, {});
    expect(result._adapterSettings).toBeUndefined();
    const warn = deps.logger?.warn as ReturnType<typeof vi.fn>;
    const warned = warn.mock.calls.some((call) =>
      String(call[0]).includes('CODELLDB_RUST_SYSROOT')
    );
    expect(warned).toBe(true);
  });

  it('passes a user-supplied _adapterSettings through when the env var is unset', async () => {
    const { result } = await transform({}, {
      _adapterSettings: { displayFormat: 'hex' }
    });
    expect(result._adapterSettings).toEqual({ displayFormat: 'hex' });
  });

  it('merges user _adapterSettings with the env-derived sysroot, user leaf winning', async () => {
    const sysroot = sysrootDir(true);
    const { result } = await transform({ CODELLDB_RUST_SYSROOT: sysroot }, {
      _adapterSettings: {
        displayFormat: 'hex',
        scriptConfig: { lang: { rust: { sysroot: '/user/choice' } } }
      }
    });
    const settings = result._adapterSettings as AdapterSettingsShape;
    expect(settings.displayFormat).toBe('hex');
    expect(settings.scriptConfig?.lang?.rust?.sysroot).toBe('/user/choice');
  });
});
