/**
 * The pytest preset's expansion (issue #985 M1): `testRunner: "pytest"` on a
 * test file becomes `python -m pytest <node id> -x …` run from pytest's
 * rootdir. Shapes measured in docs/python/spike-notes-pytest.md.
 */
import { describe, it, expect } from 'vitest';
import {
  PYTHON_TEST_RUNNERS,
  expandPytestLaunch,
  type PytestExpansionInput
} from '../../../packages/adapter-python/src/test-runners.js';

const norm = (p: string) => p.replace(/\\/g, '/');
const existsAt = (...files: string[]) => (p: string) => files.includes(norm(p));
const filesWith = (contents: Record<string, string>) => ({
  existsSync: (p: string) => norm(p) in contents,
  readFile: async (p: string) => {
    const text = contents[norm(p)];
    if (text === undefined) throw new Error(`ENOENT ${p}`);
    return text;
  }
});

const FILE = '/proj/tests/test_billing.py';

function expand(overrides: Partial<PytestExpansionInput> = {}) {
  return expandPytestLaunch({ file: FILE, existsSync: existsAt('/proj/pytest.ini'), readFile: async () => '', ...overrides });
}

describe('PYTHON_TEST_RUNNERS', () => {
  it('is pytest alone for now', () => {
    expect(PYTHON_TEST_RUNNERS).toEqual(['pytest']);
  });
});

describe('expandPytestLaunch', () => {
  it('runs the whole file when no target is given: module pytest, -x, the two plugin opt-outs', async () => {
    const out = await expand();
    expect(out.module).toBe('pytest');
    expect(out.nodeId).toBe(FILE);
    expect(out.args).toEqual([FILE, '-x', '-p', 'no:xdist', '-p', 'no:cov']);
    expect(out.configFile?.replace(/\\/g, '/')).toBe('/proj/pytest.ini');
  });

  it('appends a bare selector to the file as a node id (test, Class::test, parametrized id)', async () => {
    expect((await expand({ testTarget: 'test_rounding' })).nodeId).toBe(`${FILE}::test_rounding`);
    expect((await expand({ testTarget: 'TestBilling::test_rounding' })).nodeId).toBe(`${FILE}::TestBilling::test_rounding`);
    expect((await expand({ testTarget: 'test_param[31]' })).nodeId).toBe(`${FILE}::test_param[31]`);
  });

  it('keeps a parametrize id that contains a slash or a .py suffix as a selector', async () => {
    expect((await expand({ testTarget: 'test_parse[/etc/hosts]' })).nodeId).toBe(`${FILE}::test_parse[/etc/hosts]`);
    expect((await expand({ testTarget: 'test_load[settings.py]' })).nodeId).toBe(`${FILE}::test_load[settings.py]`);
    expect((await expand({ testTarget: 'test_fetch[http://x/y::z]' })).nodeId).toBe(`${FILE}::test_fetch[http://x/y::z]`);
  });

  it('accepts a full node id whose file part names the launch file, in either separator spelling and ./-prefixed', async () => {
    expect((await expand({ testTarget: `${FILE}::test_rounding` })).nodeId).toBe(`${FILE}::test_rounding`);
    expect((await expand({ testTarget: 'tests/test_billing.py::test_rounding' })).nodeId).toBe(`${FILE}::test_rounding`);
    expect((await expand({ testTarget: './tests/test_billing.py::test_rounding' })).nodeId).toBe(`${FILE}::test_rounding`);
    expect((await expand({ testTarget: 'tests/test_billing.py::test_param[a/b]' })).nodeId).toBe(`${FILE}::test_param[a/b]`);
    const windows = await expand({
      file: 'C:\\proj\\tests\\test_billing.py',
      testTarget: 'tests\\test_billing.py::test_x',
      existsSync: existsAt('C:/proj/pytest.ini')
    });
    expect(windows.nodeId).toBe('C:\\proj\\tests\\test_billing.py::test_x');
  });

  it('refuses a node id whose file part names another file', async () => {
    await expect(expand({ testTarget: 'tests/test_other.py::test_x' })).rejects.toThrow(/test_other\.py/);
    await expect(expand({ testTarget: '/elsewhere/test_billing.py::test_x' })).rejects.toThrow(/scriptPath/);
  });

  it("appends the caller's args after the preset's", async () => {
    expect((await expand({ args: ['-vv', '--tb=short'] })).args).toEqual([FILE, '-x', '-p', 'no:xdist', '-p', 'no:cov', '-vv', '--tb=short']);
  });

  it("leaves a plugin alone when the caller's args ask for it, in every spelling", async () => {
    expect((await expand({ args: ['-n', '2'] })).args).toEqual([FILE, '-x', '-p', 'no:cov', '-n', '2']);
    for (const spelling of ['-n4', '-nauto', '--numprocesses=auto', '--dist', '--tx', '-f']) {
      expect((await expand({ args: [spelling] })).args, spelling).not.toContain('no:xdist');
    }
    expect((await expand({ args: ['--cov=billing'] })).args).toEqual([FILE, '-x', '-p', 'no:xdist', '--cov=billing']);
    expect((await expand({ args: ['--cov'] })).args).not.toContain('no:cov');
    expect((await expand({ args: ['--no-cov'] })).args).not.toContain('no:cov');
  });

  describe("the project's own addopts", () => {
    it('keeps a plugin addopts turns on loaded, and appends its inert switch instead of -p no:', async () => {
      const cov = await expand(filesWith({ '/proj/pytest.ini': '[pytest]\naddopts = --cov=billing --cov-report=term\n' }));
      expect(cov.args).toEqual([FILE, '-x', '-p', 'no:xdist', '--no-cov']);

      const xdist = await expand(filesWith({ '/proj/pytest.ini': '[pytest]\ntestpaths = tests\naddopts =\n    -n 2\n    -q\n' }));
      expect(xdist.args).toEqual([FILE, '-x', '-n0', '-p', 'no:cov']);
    });

    it('reads a pyproject string or array, and setup.cfg / tox.ini sections', async () => {
      const toml = await expand(filesWith({ '/proj/pyproject.toml': '[tool.pytest.ini_options]\naddopts = [\n  "--cov=billing",\n  "-q",\n]\n' }));
      expect(toml.args).toEqual([FILE, '-x', '-p', 'no:xdist', '--no-cov']);

      const tomlString = await expand(filesWith({ '/proj/pyproject.toml': '[tool.pytest.ini_options]\naddopts = "-n auto -ra"\nminversion = "7"\n' }));
      expect(tomlString.args).toEqual([FILE, '-x', '-n0', '-p', 'no:cov']);

      const cfg = await expand(filesWith({ '/proj/setup.cfg': '[flake8]\nmax-line-length = 100\n\n[tool:pytest]\naddopts = --cov\n' }));
      expect(cfg.args).toEqual([FILE, '-x', '-p', 'no:xdist', '--no-cov']);
    });

    it("still defers to the caller's args when both ask", async () => {
      const out = await expand({ ...filesWith({ '/proj/pytest.ini': '[pytest]\naddopts = --cov=billing\n' }), args: ['--cov=other'] });
      expect(out.args).toEqual([FILE, '-x', '-p', 'no:xdist', '--cov=other']);
    });
  });

  describe("cwd (pytest's rootdir, what python -m puts on sys.path)", () => {
    it('is the nearest ancestor holding a pytest config file, and says which', async () => {
      const ini = await expand();
      expect(ini.cwd).toBe('/proj');
      expect(ini.cwdReason).toContain('pytest.ini');

      const nearer = await expand({ existsSync: existsAt('/proj/pytest.ini', '/proj/tests/pytest.ini') });
      expect(nearer.cwd).toBe('/proj/tests');
    });

    it('counts pyproject.toml, tox.ini and setup.cfg only with their pytest section, as pytest does', async () => {
      const monorepo = await expand({
        file: '/proj/pkgs/billing/tests/test_x.py',
        ...filesWith({ '/proj/pkgs/billing/pyproject.toml': '[build-system]\nrequires = ["setuptools"]\n', '/proj/pytest.ini': '[pytest]\n' })
      });
      expect(monorepo.cwd).toBe('/proj');
      expect(monorepo.cwdReason).toContain('pytest.ini');

      const withTable = await expand(filesWith({ '/proj/pyproject.toml': '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n' }));
      expect(withTable.cwd).toBe('/proj');
      expect(withTable.cwdReason).toContain('pyproject.toml');

      const toxWithout = await expand({ file: '/proj/sub/tests/test_x.py', ...filesWith({ '/proj/sub/tox.ini': '[tox]\nenvlist = py\n', '/proj/setup.cfg': '[tool:pytest]\n' }) });
      expect(toxWithout.cwd).toBe('/proj');
      expect(toxWithout.cwdReason).toContain('setup.cfg');
    });

    it("falls back to setup.py (pytest's rule), then the top-most conftest.py, then the file directory", async () => {
      const setupPy = await expand({ existsSync: existsAt('/proj/setup.py', '/proj/tests/conftest.py') });
      expect(setupPy.cwd).toBe('/proj');
      expect(setupPy.cwdReason).toContain('setup.py');

      const conftest = await expand({ existsSync: existsAt('/proj/tests/conftest.py', '/proj/conftest.py') });
      expect(conftest.cwd).toBe('/proj');
      expect(conftest.cwdReason).toContain('conftest.py');

      const bare = await expand({ existsSync: existsAt() });
      expect(bare.cwd).toBe('/proj/tests');
      expect(bare.cwdReason).toMatch(/directory/);
    });

    it('keeps a cwd the caller set', async () => {
      const out = await expand({ cwd: '/elsewhere' });
      expect(out.cwd).toBe('/elsewhere');
      expect(out.cwdReason).toMatch(/caller|given|set/);
    });
  });
});
