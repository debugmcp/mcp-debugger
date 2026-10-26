/**
 * The Python test-runner presets (issue #985 M1): `start_debugging {
 * testRunner: "pytest", testTarget }` on a test file becomes a module launch
 * of pytest, run from pytest's rootdir. The shapes here are the measured
 * ones — see docs/python/spike-notes-pytest.md.
 */
import * as path from 'path';

export const PYTHON_TEST_RUNNERS = ['pytest'] as const;
export type PythonTestRunner = (typeof PYTHON_TEST_RUNNERS)[number];

export interface PytestExpansionInput {
  /** The test file the launch is about: start_debugging's scriptPath, carried in as the stand-in `program`. */
  file: string;
  /** A selector inside the file (`test_x`, `Class::test_x`, `test_x[param]`), or a full node id naming that file. */
  testTarget?: unknown;
  /** The caller's own pytest arguments, appended after the preset's. */
  args?: unknown;
  /** A caller cwd; wins over the rootdir walk. */
  cwd?: unknown;
  existsSync: (p: string) => boolean;
  /** Reads a config file the rootdir walk found; a rejection counts as unreadable (no section, no addopts). */
  readFile: (p: string) => Promise<string>;
}

export interface PytestExpansion {
  module: 'pytest';
  /** `<file>` or `<file>::<selector>`, the way pytest addresses a test. */
  nodeId: string;
  /** `[nodeId, '-x', the plugin flags, ...callerArgs]`. */
  args: string[];
  /** What `python -m` puts on sys.path and what pytest runs from. */
  cwd: string;
  /** Why this cwd: the config file found, setup.py, the top-most conftest.py, the file's directory, or the caller. */
  cwdReason: string;
  /** The pytest config file the walk found, whose `addopts` decided the plugin flags; undefined when none. */
  configFile?: string;
}

/**
 * pytest's rootdir rule (`_pytest/config/findpaths.py`): from the test file's
 * directory upward, the first `pytest.ini` or `.pytest.ini` (they always
 * count), `pyproject.toml` with a `[tool.pytest.ini_options]` table,
 * `tox.ini` with a `[pytest]` section, or `setup.cfg` with a `[tool:pytest]`
 * section. Without one, pytest falls back to the nearest ancestor holding
 * `setup.py`.
 */
const CONFIG_CANDIDATES: ReadonlyArray<{ name: string; section?: RegExp; label: string }> = [
  { name: 'pytest.ini', label: 'pytest.ini' },
  { name: '.pytest.ini', label: '.pytest.ini' },
  { name: 'pyproject.toml', section: /^[ \t]*\[tool\.pytest\.ini_options\]/m, label: 'pyproject.toml with a [tool.pytest.ini_options] table' },
  { name: 'tox.ini', section: /^[ \t]*\[pytest\]/m, label: 'tox.ini with a [pytest] section' },
  { name: 'setup.cfg', section: /^[ \t]*\[tool:pytest\]/m, label: 'setup.cfg with a [tool:pytest] section' }
];

/**
 * pytest-xdist moves the test into a worker subprocess the debugger never
 * sees (and the spawn fails under the Windows debuggee, issue #993), and
 * pytest-cov's tracer competes with pydevd's on Pythons before 3.12. Each is
 * turned off: with `-p no:<plugin>` when nothing asks for it (silent when the
 * plugin is absent), or — when the project's own `addopts` turns it on, so
 * `-p no:` would make pytest reject those options as unrecognized (exit 4) —
 * with the plugin's own inert switch appended after them. The caller's args
 * asking for a plugin leave it alone.
 */
const isXdistArg = (arg: string): boolean =>
  /^-n\S*$/.test(arg) || arg.startsWith('--numprocesses') || arg.startsWith('--dist') || arg.startsWith('--tx') || arg === '--looponfail' || arg === '-f';
const isCovArg = (arg: string): boolean => arg.startsWith('--cov') || arg === '--no-cov';

const PLUGINS: ReadonlyArray<{ name: string; asksFor: (arg: string) => boolean; inert: string[] }> = [
  { name: 'xdist', asksFor: isXdistArg, inert: ['-n0'] },
  { name: 'cov', asksFor: isCovArg, inert: ['--no-cov'] }
];

export async function expandPytestLaunch(input: PytestExpansionInput): Promise<PytestExpansion> {
  const nodeId = resolveNodeId(input.file, input.testTarget);
  const callerArgs = Array.isArray(input.args) ? input.args.map(String) : [];
  const root = await resolveRoot(input.file, input.cwd, input.existsSync, input.readFile);
  const addopts = root.configFile ? await readAddopts(root.configFile, input.readFile) : [];

  const args = [nodeId, '-x'];
  for (const plugin of PLUGINS) {
    if (callerArgs.some(plugin.asksFor)) {
      continue;
    }
    if (addopts.some(plugin.asksFor)) {
      args.push(...plugin.inert);
    } else {
      args.push('-p', `no:${plugin.name}`);
    }
  }
  args.push(...callerArgs);

  return {
    module: 'pytest',
    nodeId,
    args,
    cwd: root.cwd,
    cwdReason: root.cwdReason,
    ...(root.configFile ? { configFile: root.configFile } : {})
  };
}

/**
 * A bare selector is appended to the file. A target whose first `::` segment
 * — read before any `[` — looks like a path (a separator, or a `.py` suffix)
 * is a full node id and must name the launch file; relative spellings,
 * `./`-prefixed included, are matched as a suffix.
 */
function resolveNodeId(file: string, testTarget: unknown): string {
  if (typeof testTarget !== 'string' || testTarget.trim() === '') {
    return file;
  }
  const target = testTarget.trim();
  const sep = target.indexOf('::');
  const bracket = target.indexOf('[');
  const hasFilePart = sep !== -1 && (bracket === -1 || sep < bracket);
  const head = hasFilePart ? target.slice(0, sep) : bracket === -1 ? target : target.slice(0, bracket);
  const looksLikePath = /[\\/]/.test(head) || /\.py$/i.test(head);
  if (!looksLikePath) {
    return `${file}::${target}`;
  }
  if (!namesSameFile(file, head)) {
    throw new Error(
      `testTarget names ${head}, not the launch's scriptPath (${file}); pass the selector inside that file ` +
        `(test_name, Class::test_name) or a node id of that file`
    );
  }
  const selector = hasFilePart ? target.slice(sep + 2) : '';
  return selector ? `${file}::${selector}` : file;
}

function namesSameFile(file: string, candidate: string): boolean {
  const normalize = (p: string): string => {
    const slashed = path.posix.normalize(p.replace(/\\/g, '/')).replace(/\/+$/, '');
    return process.platform === 'win32' ? slashed.toLowerCase() : slashed;
  };
  const f = normalize(file);
  const c = normalize(candidate);
  const absolute = path.isAbsolute(candidate) || /^[a-z]:\//i.test(c);
  return absolute ? f === c : f === c || f.endsWith(`/${c}`);
}

interface RootResolution {
  cwd: string;
  cwdReason: string;
  configFile?: string;
}

/** One walk from the test file's directory to the filesystem root, noting what pytest's rule and our fallback need. */
async function resolveRoot(
  file: string,
  cwd: unknown,
  existsSync: (p: string) => boolean,
  readFile: (p: string) => Promise<string>
): Promise<RootResolution> {
  if (typeof cwd === 'string' && cwd.length > 0) {
    return { cwd, cwdReason: 'set by the caller' };
  }
  const start = path.dirname(file);
  let setupPyDir: string | undefined;
  let topConftest: string | undefined;
  for (let dir = start; ; ) {
    for (const candidate of CONFIG_CANDIDATES) {
      const candidatePath = path.join(dir, candidate.name);
      if (!existsSync(candidatePath)) {
        continue;
      }
      if (candidate.section && !candidate.section.test(await readOrEmpty(candidatePath, readFile))) {
        continue;
      }
      return {
        cwd: dir,
        cwdReason: `pytest's rootdir: the nearest directory above the test file holding ${candidate.label}`,
        configFile: candidatePath
      };
    }
    if (setupPyDir === undefined && existsSync(path.join(dir, 'setup.py'))) {
      setupPyDir = dir;
    }
    if (existsSync(path.join(dir, 'conftest.py'))) {
      topConftest = dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  if (setupPyDir !== undefined) {
    return { cwd: setupPyDir, cwdReason: "pytest's rootdir fallback: the nearest directory above the test file holding setup.py" };
  }
  if (topConftest !== undefined) {
    return { cwd: topConftest, cwdReason: 'the top-most directory above the test file holding a conftest.py (no pytest config file found)' };
  }
  return {
    cwd: start,
    cwdReason: "the test file's directory (no pytest config file, setup.py or conftest.py above it)"
  };
}

async function readOrEmpty(file: string, readFile: (p: string) => Promise<string>): Promise<string> {
  try {
    return await readFile(file);
  } catch {
    return '';
  }
}

/**
 * The tokens of the config file's `addopts` (ini `addopts = …` with indented
 * continuation lines, or pyproject's string / multi-line array), read
 * loosely: the value runs to the first newline not followed by indentation
 * (a new key, a section header, a closing `]`) or to the end of the file;
 * quotes, commas and brackets are separators. Enough to see whether the
 * project itself turns a plugin on.
 */
async function readAddopts(configFile: string, readFile: (p: string) => Promise<string>): Promise<string[]> {
  const text = await readOrEmpty(configFile, readFile);
  const match = /^[ \t]*addopts[ \t]*=[ \t]*([\s\S]*?)(?=\n(?![ \t])|(?![\s\S]))/m.exec(text);
  if (!match) {
    return [];
  }
  return match[1]
    .split(/[\s"',[\]]+/)
    .map(token => token.trim())
    .filter(token => token.length > 0 && !token.startsWith('#'));
}
