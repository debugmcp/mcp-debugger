import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as rustUtils from '../src/utils/rust-utils.js';

const spawnMock: Mock = vi.fn();
const whichMock: Mock = vi.fn();

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => spawnMock(...args)
  };
});

vi.mock('which', () => ({
  default: (...args: unknown[]) => whichMock(...args)
}));

const createMockProcess = (options: {
  stdoutChunks?: string[];
  stderrChunks?: string[];
  exitCode?: number;
  error?: Error;
}): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter } => {
  const { stdoutChunks = [], stderrChunks = [], exitCode = 0, error } = options;
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
  proc.stdout = stdout;
  proc.stderr = stderr;

  if (error) {
    queueMicrotask(() => proc.emit('error', error));
    return proc;
  }

  queueMicrotask(() => {
    stdoutChunks.forEach(chunk => stdout.emit('data', chunk));
    stderrChunks.forEach(chunk => stderr.emit('data', chunk));
    proc.emit('exit', exitCode);
    // Real children emit 'close' after 'exit' once stdio drains
    proc.emit('close', exitCode);
  });

  return proc;
};

const tempDirs: string[] = [];

const createTempDir = async (name: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `rust-utils-${name}-`));
  tempDirs.push(dir);
  return dir;
};

beforeEach(() => {
  spawnMock.mockReset();
  whichMock.mockReset();
});

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('rust-utils process checks', () => {
  it('detects cargo installation', async () => {
    spawnMock.mockImplementation(() =>
      createMockProcess({ stdoutChunks: ['cargo 1.70'], exitCode: 0 })
    );
    await expect(rustUtils.checkCargoInstallation()).resolves.toBe(true);

    spawnMock.mockImplementation(() => createMockProcess({ exitCode: 1 }));
    await expect(rustUtils.checkCargoInstallation()).resolves.toBe(false);
  });

  it('detects rustc installation', async () => {
    spawnMock.mockImplementation(() =>
      createMockProcess({ stdoutChunks: ['rustc 1.70'], exitCode: 0 })
    );
    await expect(rustUtils.checkRustInstallation()).resolves.toBe(true);

    spawnMock.mockImplementation(() => createMockProcess({ exitCode: 1 }));
    await expect(rustUtils.checkRustInstallation()).resolves.toBe(false);
  });

  it('builds rust project and captures failure', async () => {
    spawnMock
      .mockImplementationOnce(() =>
        createMockProcess({
          stdoutChunks: ['Compiling crate\n', 'Finished'],
          stderrChunks: [],
          exitCode: 0
        })
      )
      .mockImplementationOnce(() =>
        createMockProcess({
          stderrChunks: ['error: build failed\n'],
          exitCode: 101
        })
      );

    const success = await rustUtils.buildRustProject('/workspace/project');
    expect(success.success).toBe(true);
    expect(success.output).toContain('Compiling');

    const failure = await rustUtils.buildRustProject('/workspace/project');
    expect(failure.success).toBe(false);
    expect(failure.output).toContain('error: build failed');
  });

  it('redacts secret-looking lines from build output', async () => {
    spawnMock.mockImplementationOnce(() =>
      createMockProcess({
        stderrChunks: ['GITHUB_PAT=github_pat_ABCDEFGHIJKLMNOPQRSTUV123456\nerror: build failed\n'],
        exitCode: 101
      })
    );

    const failure = await rustUtils.buildRustProject('/workspace/project');
    expect(failure.output).toContain('[REDACTED — line contained sensitive data]');
    expect(failure.output).not.toContain('github_pat_ABCDEFGHIJKLMNOPQRSTUV123456');
    expect(failure.output).toContain('error: build failed');
  });

  it('retrieves rust host triple from rustc', async () => {
    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: ['rustc 1.75\nhost: x86_64-unknown-linux-gnu\n'],
        exitCode: 0
      })
    );

    await expect(rustUtils.getRustHostTriple()).resolves.toBe('x86_64-unknown-linux-gnu');

    spawnMock.mockImplementation(() => createMockProcess({ stdoutChunks: [], exitCode: 0 }));
    await expect(rustUtils.getRustHostTriple()).resolves.toBeNull();
  });
});

// Issue #968: one direct `cargo -vV` replaces two shell-spawned `cargo
// --version` runs and a `rustc -Vv` that loads the 183 MB rustc_driver DLL.
describe('getCargoVerboseVersion (issue #968)', () => {
  const CARGO_VV =
    'cargo 1.94.1 (29ea6fb6a 2026-03-24)\nrelease: 1.94.1\ncommit-hash: 29ea6fb6a5db279426f4cc4e17aa385f05a0cfbc\n' +
    'commit-date: 2026-03-24\nhost: x86_64-pc-windows-msvc\nlibgit2: 1.9.2 (sys:0.20.3 vendored)\n';

  /** A child that exits before its stdout is drained, as a real one may. */
  const exitThenDrain = (chunks: string[], code: number) => {
    const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    queueMicrotask(() => {
      proc.emit('exit', code, null);
      chunks.forEach((chunk) => proc.stdout.emit('data', Buffer.from(chunk)));
      proc.emit('close', code, null);
    });
    return proc;
  };

  it('spawns cargo -vV directly, without a shell', async () => {
    spawnMock.mockImplementation(() => exitThenDrain([CARGO_VV], 0));

    await rustUtils.getCargoVerboseVersion();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnMock.mock.calls[0];
    expect(command).toBe('cargo');
    expect(args).toEqual(['-vV']);
    expect(options.shell).toBeUndefined();
    expect(options.windowsHide).toBe(true);
  });

  it('reads the version and host triple from output that arrives after exit', async () => {
    spawnMock.mockImplementation(() => exitThenDrain([CARGO_VV.slice(0, 20), CARGO_VV.slice(20)], 0));

    await expect(rustUtils.getCargoVerboseVersion()).resolves.toEqual({
      version: '1.94.1',
      hostTriple: 'x86_64-pc-windows-msvc'
    });
  });

  it('keeps what it can parse when a line is missing', async () => {
    spawnMock.mockImplementation(() => exitThenDrain(['cargo 1.70.0 (abc 2023-01-01)\n'], 0));

    await expect(rustUtils.getCargoVerboseVersion()).resolves.toEqual({
      version: '1.70.0',
      hostTriple: undefined
    });
  });

  it('returns null when cargo cannot be spawned or fails', async () => {
    spawnMock.mockImplementation(() => createMockProcess({ error: new Error('spawn cargo ENOENT') }));
    await expect(rustUtils.getCargoVerboseVersion()).resolves.toBeNull();

    spawnMock.mockImplementation(() => exitThenDrain(['error: no default toolchain configured\n'], 1));
    await expect(rustUtils.getCargoVerboseVersion()).resolves.toBeNull();
  });
});

describe('rust-utils filesystem helpers', () => {
  it('finds cargo project root by walking up directories', async () => {
    const base = await createTempDir('project');
    const nested = path.join(base, 'src', 'bin');
    await fs.mkdir(nested, { recursive: true });
    await fs.writeFile(path.join(base, 'Cargo.toml'), 'name = "demo"\n');

    const root = await rustUtils.findCargoProjectRoot(path.join(nested, 'main.rs'));
    expect(root).toBe(base);
  });

  it('resolves rust binary path with platform extension', async () => {
    const project = await createTempDir('binary');
    const targetDir = path.join(project, 'target', 'debug');
    await fs.mkdir(targetDir, { recursive: true });
    const binPath = path.join(targetDir, 'app.exe');
    await fs.writeFile(binPath, '');

    await expect(rustUtils.getRustBinaryPath(project, 'app', false, 'win32')).resolves.toBe(binPath);
    await expect(rustUtils.getRustBinaryPath(project, 'app', false, 'linux')).resolves.toBeNull();

    await fs.rm(binPath);
    await expect(rustUtils.getRustBinaryPath(project, 'app', false, 'win32')).resolves.toBeNull();
  });
});

describe('findDlltoolExecutable', () => {
  it('uses DLLTOOL env override when accessible', async () => {
    const dir = await createTempDir('dlltool');
    const explicit = path.join(dir, 'dlltool.exe');
    await fs.writeFile(explicit, '');

    vi.stubEnv('DLLTOOL', explicit);
    await expect(rustUtils.findDlltoolExecutable()).resolves.toBe(explicit);
  });

  it('falls back to which lookup', async () => {
    whichMock.mockResolvedValueOnce('/usr/bin/dlltool');
    await expect(rustUtils.findDlltoolExecutable()).resolves.toBe('/usr/bin/dlltool');
  });

  it('scans rustup toolchains on Windows platforms', async () => {
    const rustupHome = await createTempDir('rustup');
    vi.stubEnv('RUSTUP_HOME', rustupHome);

    const toolchain = path.join(rustupHome, 'toolchains', 'stable-x86_64-pc-windows-gnu');
    const binDir = path.join(
      toolchain,
      'lib',
      'rustlib',
      'x86_64-pc-windows-gnu',
      'bin'
    );
    await fs.mkdir(binDir, { recursive: true });
    const candidate = path.join(binDir, 'dlltool.exe');
    await fs.writeFile(candidate, '');

    whichMock.mockRejectedValueOnce(new Error('not found'));

    await expect(rustUtils.findDlltoolExecutable('win32')).resolves.toBe(candidate);
  });
});
