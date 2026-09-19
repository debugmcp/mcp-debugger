/**
 * Unit tests for the cobc locator (issue #759).
 *
 * Every probe is injected — `exists` and `probeVersion` — so nothing here
 * touches the real filesystem or spawns a compiler. Expected paths are built
 * with the same `path.*` calls the source uses, because `path.join` /
 * `path.delimiter` follow the host even when a `platform` argument is passed.
 */
import { describe, it, expect, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import {
  findCobc,
  cobcEnvironment,
  cobcCandidatePaths,
  parseCobcVersion,
  COBC_ENV_PATH_VAR,
  type CobcLocation
} from '../../../src/build/cobc-locator.js';

const BANNER = 'cobc (GnuCOBOL) 3.2.0';

/**
 * Fake install dirs for the win32-platform cases. Derived from os.tmpdir() so a
 * value placed in PATH never contains the host's path.delimiter: a literal
 * `C:\tools` would be split at the colon on a Linux host.
 */
const TOOLS_DIR = path.join(os.tmpdir(), 'msys64', 'mingw64', 'bin');
const WINDOWS_DIR = path.join(os.tmpdir(), 'Windows');

/** `exists` that answers true for exactly the given paths (case-insensitively, like NTFS). */
function existsFor(...paths: string[]): (p: string) => boolean {
  const known = new Set(paths.map((p) => p.toLowerCase()));
  return (p: string) => known.has(p.toLowerCase());
}

function location(overrides: Partial<CobcLocation> = {}): CobcLocation {
  const binDir = path.join('/opt', 'gnucobol', 'bin');
  return {
    path: path.join(binDir, 'cobc'),
    binDir,
    prefix: path.join('/opt', 'gnucobol'),
    versionLine: BANNER,
    version: '3.2.0',
    ...overrides
  };
}

describe('cobcCandidatePaths', () => {
  it('lists the MSYS2 and GnuCOBOL install dirs on win32', () => {
    expect(cobcCandidatePaths('win32')).toEqual([
      'C:\\msys64\\mingw64\\bin\\cobc.exe',
      'C:\\msys64\\ucrt64\\bin\\cobc.exe',
      'C:\\msys64\\clang64\\bin\\cobc.exe',
      'C:\\GnuCOBOL\\bin\\cobc.exe'
    ]);
  });

  it('prefers Homebrew locations on darwin', () => {
    expect(cobcCandidatePaths('darwin')).toEqual(['/opt/homebrew/bin/cobc', '/usr/local/bin/cobc', '/usr/bin/cobc']);
  });

  it('falls back to the distro locations elsewhere', () => {
    expect(cobcCandidatePaths('linux')).toEqual(['/usr/bin/cobc', '/usr/local/bin/cobc']);
    expect(cobcCandidatePaths('freebsd')).toEqual(['/usr/bin/cobc', '/usr/local/bin/cobc']);
  });
});

describe('parseCobcVersion', () => {
  it('extracts the dotted version from the banner', () => {
    expect(parseCobcVersion('cobc (GnuCOBOL) 3.2.0')).toBe('3.2.0');
    expect(parseCobcVersion('cobc (GnuCOBOL) 3.1.2.0')).toBe('3.1.2');
    expect(parseCobcVersion('cobc (GnuCOBOL) 3.2')).toBe('3.2');
  });

  it('returns null for a null banner or one without a version', () => {
    expect(parseCobcVersion(null)).toBeNull();
    expect(parseCobcVersion('')).toBeNull();
    expect(parseCobcVersion('cobc: command not found')).toBeNull();
  });
});

describe('findCobc', () => {
  it('uses COBC_PATH first when it exists and runs', async () => {
    const explicit = path.join('/opt', 'cobol', 'bin', 'cobc');
    const onPath = path.join('/usr', 'bin', 'cobc');
    const probe = vi.fn(async () => BANNER);

    const found = await findCobc({
      env: { [COBC_ENV_PATH_VAR]: explicit, PATH: path.join('/usr', 'bin') },
      platform: 'linux',
      exists: existsFor(explicit, onPath),
      probeVersion: probe
    });

    expect(found).toEqual({
      path: explicit,
      binDir: path.join('/opt', 'cobol', 'bin'),
      prefix: path.join('/opt', 'cobol'),
      versionLine: BANNER,
      version: '3.2.0'
    });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith(explicit);
  });

  it('ignores a COBC_PATH that does not exist and falls through to PATH', async () => {
    const onPath = path.join('/usr', 'local', 'bin', 'cobc');
    const probe = vi.fn(async () => BANNER);

    const found = await findCobc({
      env: { [COBC_ENV_PATH_VAR]: '/nowhere/cobc', PATH: ['/nope', path.join('/usr', 'local', 'bin')].join(path.delimiter) },
      platform: 'linux',
      exists: existsFor(onPath),
      probeVersion: probe
    });

    expect(found?.path).toBe(onPath);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('ignores a whitespace-only COBC_PATH', async () => {
    const onPath = path.join('/usr', 'bin', 'cobc');
    const found = await findCobc({
      env: { [COBC_ENV_PATH_VAR]: '   ', PATH: path.join('/usr', 'bin') },
      platform: 'linux',
      exists: existsFor(onPath),
      probeVersion: async () => BANNER
    });
    expect(found?.path).toBe(onPath);
  });

  it('walks PATH in order and takes the first cobc that exists', async () => {
    const first = path.join('/first', 'cobc');
    const second = path.join('/second', 'cobc');
    const found = await findCobc({
      env: { PATH: ['/empty', '/first', '/second'].join(path.delimiter) },
      platform: 'linux',
      exists: existsFor(first, second),
      probeVersion: async () => BANNER
    });
    expect(found?.path).toBe(first);
  });

  it('tries cobc.exe before the bare name on win32 and reads the Path spelling', async () => {
    const exe = path.join(TOOLS_DIR, 'cobc.exe');
    const bare = path.join(TOOLS_DIR, 'cobc');
    const found = await findCobc({
      env: { Path: TOOLS_DIR },
      platform: 'win32',
      exists: existsFor(exe, bare),
      probeVersion: async () => BANNER
    });
    expect(found?.path).toBe(exe);
    expect(found?.binDir).toBe(TOOLS_DIR);
  });

  it('accepts the bare name on win32 when there is no .exe', async () => {
    const bare = path.join(TOOLS_DIR, 'cobc');
    const found = await findCobc({
      env: { PATH: TOOLS_DIR },
      platform: 'win32',
      exists: existsFor(bare),
      probeVersion: async () => BANNER
    });
    expect(found?.path).toBe(bare);
  });

  it('falls back to the well-known install locations when PATH has nothing', async () => {
    const found = await findCobc({
      env: { PATH: '' },
      platform: 'darwin',
      exists: existsFor('/usr/local/bin/cobc'),
      probeVersion: async () => BANNER
    });
    expect(found?.path).toBe('/usr/local/bin/cobc');
    expect(found?.binDir).toBe(path.dirname('/usr/local/bin/cobc'));
  });

  it('skips a candidate whose --version does not run and keeps looking', async () => {
    const explicit = path.join('/broken', 'cobc');
    const onPath = path.join('/usr', 'bin', 'cobc');
    const probe = vi.fn(async (command: string) => (command === explicit ? null : BANNER));

    const found = await findCobc({
      env: { [COBC_ENV_PATH_VAR]: explicit, PATH: path.join('/usr', 'bin') },
      platform: 'linux',
      exists: existsFor(explicit, onPath),
      probeVersion: probe
    });

    expect(found?.path).toBe(onPath);
    expect(probe.mock.calls.map(([command]) => command)).toEqual([explicit, onPath]);
  });

  it('returns null when no candidate exists or runs', async () => {
    const probe = vi.fn(async () => null);
    const found = await findCobc({
      env: { PATH: '/nowhere' },
      platform: 'linux',
      exists: () => false,
      probeVersion: probe
    });
    expect(found).toBeNull();
    expect(probe).not.toHaveBeenCalled();
  });

  it('probes a path only once even when COBC_PATH and PATH name it in different case', async () => {
    const probe = vi.fn(async () => null);
    const explicit = path.join(TOOLS_DIR.toUpperCase(), 'cobc.exe');
    await findCobc({
      env: { [COBC_ENV_PATH_VAR]: explicit, Path: TOOLS_DIR },
      platform: 'win32',
      exists: existsFor(path.join(TOOLS_DIR, 'cobc.exe')),
      probeVersion: probe
    });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith(explicit);
  });

  it('records configDir and copyDir only when the install has them', async () => {
    const cobc = path.join('/opt', 'gnucobol', 'bin', 'cobc');
    const prefix = path.join('/opt', 'gnucobol');
    const configDir = path.join(prefix, 'share', 'gnucobol', 'config');
    const copyDir = path.join(prefix, 'share', 'gnucobol', 'copy');

    const withConfig = await findCobc({
      env: { [COBC_ENV_PATH_VAR]: cobc },
      platform: 'linux',
      exists: existsFor(cobc, configDir),
      probeVersion: async () => BANNER
    });
    expect(withConfig?.configDir).toBe(configDir);
    expect(withConfig).not.toHaveProperty('copyDir');

    const withBoth = await findCobc({
      env: { [COBC_ENV_PATH_VAR]: cobc },
      platform: 'linux',
      exists: existsFor(cobc, configDir, copyDir),
      probeVersion: async () => BANNER
    });
    expect(withBoth?.configDir).toBe(configDir);
    expect(withBoth?.copyDir).toBe(copyDir);
  });

  it('keeps the raw banner and the parsed version side by side', async () => {
    const cobc = path.join('/usr', 'bin', 'cobc');
    const found = await findCobc({
      env: { [COBC_ENV_PATH_VAR]: cobc },
      platform: 'linux',
      exists: existsFor(cobc),
      probeVersion: async () => 'cobc (GnuCOBOL) 3.1.2.0'
    });
    expect(found?.versionLine).toBe('cobc (GnuCOBOL) 3.1.2.0');
    expect(found?.version).toBe('3.1.2');
  });
});

describe('cobcEnvironment', () => {
  it('prepends the cobc bin dir to PATH and keeps the rest of the base env', () => {
    const loc = location();
    const base = { PATH: ['/usr/bin', '/bin'].join(path.delimiter), HOME: '/home/jf' };

    const env = cobcEnvironment(loc, base, 'linux');

    expect(env.PATH).toBe([loc.binDir, '/usr/bin', '/bin'].join(path.delimiter));
    expect(env.HOME).toBe('/home/jf');
  });

  it('does not prepend again when the bin dir is already on PATH (case-insensitively)', () => {
    const loc = location();
    const already = ['/usr/bin', loc.binDir.toUpperCase()].join(path.delimiter);

    const env = cobcEnvironment(loc, { PATH: already }, 'linux');

    expect(env.PATH).toBe(already);
  });

  it('writes through the existing Path key on win32 instead of adding a second one', () => {
    const loc = location({ path: path.join(TOOLS_DIR, 'cobc.exe'), binDir: TOOLS_DIR, prefix: path.dirname(TOOLS_DIR) });

    const env = cobcEnvironment(loc, { Path: WINDOWS_DIR }, 'win32');

    expect(env.Path).toBe([TOOLS_DIR, WINDOWS_DIR].join(path.delimiter));
    expect(env).not.toHaveProperty('PATH');
  });

  it('creates PATH on win32 when the base has no path variable at all', () => {
    const loc = location({ binDir: TOOLS_DIR });
    const env = cobcEnvironment(loc, {}, 'win32');
    expect(env.PATH).toBe(TOOLS_DIR);
  });

  it('pins COB_CONFIG_DIR and COB_COPY_DIR from the install when the caller has not set them', () => {
    const loc = location({ configDir: path.join('/opt', 'gnucobol', 'share', 'gnucobol', 'config'), copyDir: path.join('/opt', 'gnucobol', 'share', 'gnucobol', 'copy') });

    const env = cobcEnvironment(loc, { PATH: '' }, 'linux');

    expect(env.COB_CONFIG_DIR).toBe(loc.configDir);
    expect(env.COB_COPY_DIR).toBe(loc.copyDir);
  });

  it('keeps caller-set COB_CONFIG_DIR / COB_COPY_DIR', () => {
    const loc = location({ configDir: '/install/config', copyDir: '/install/copy' });

    const env = cobcEnvironment(loc, { COB_CONFIG_DIR: '/mine/config', COB_COPY_DIR: '/mine/copy' }, 'linux');

    expect(env.COB_CONFIG_DIR).toBe('/mine/config');
    expect(env.COB_COPY_DIR).toBe('/mine/copy');
  });

  it('sets no COB_* keys when the install has no config/copy dirs', () => {
    const env = cobcEnvironment(location(), { PATH: '' }, 'linux');
    expect(env).not.toHaveProperty('COB_CONFIG_DIR');
    expect(env).not.toHaveProperty('COB_COPY_DIR');
  });

  it('drops non-string base values and never mutates the base', () => {
    const base: NodeJS.ProcessEnv = { PATH: '/usr/bin', UNSET: undefined };
    const snapshot = { ...base };

    const env = cobcEnvironment(location(), base, 'linux');

    expect(env).not.toHaveProperty('UNSET');
    expect(base).toEqual(snapshot);
  });
});
