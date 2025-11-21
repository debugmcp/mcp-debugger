import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as fssync from 'fs';
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
  });

  return proc;
};

const tempDirs: string[] = [];

const createTempDir = async (name: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `rust-utils-${name}-`));
  tempDirs.push(dir);
  return dir;
};

const overridePlatform = (platform: NodeJS.Platform) => {
  const original = process.platform;
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  return () => Object.defineProperty(process, 'platform', { value: original, configurable: true });
};

beforeEach(() => {
  spawnMock.mockReset();
  whichMock.mockReset();
});

afterEach(async () => {
  delete process.env.DLLTOOL;
  delete process.env.RUSTUP_HOME;
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

  it('parses cargo version output', async () => {
    spawnMock.mockImplementation(() =>
      createMockProcess({ stdoutChunks: ['cargo 1.74.1 (abc123 2023-01-01)'], exitCode: 0 })
    );
    await expect(rustUtils.getCargoVersion()).resolves.toBe('1.74.1');

    spawnMock.mockImplementation(() =>
      createMockProcess({ stdoutChunks: ['unexpected'], exitCode: 0 })
    );
    await expect(rustUtils.getCargoVersion()).resolves.toBeNull();
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
    const binPath = path.join(targetDir, process.platform === 'win32' ? 'app.exe' : 'app');
    await fs.writeFile(binPath, '');

    await expect(rustUtils.getRustBinaryPath(project, 'app')).resolves.toBe(binPath);

    await fs.rm(binPath);
    await expect(rustUtils.getRustBinaryPath(project, 'app')).resolves.toBeNull();
  });
});

describe('findDlltoolExecutable', () => {
  it('uses DLLTOOL env override when accessible', async () => {
    const dir = await createTempDir('dlltool');
    const explicit = path.join(dir, 'dlltool.exe');
    await fs.writeFile(explicit, '');

    process.env.DLLTOOL = explicit;
    await expect(rustUtils.findDlltoolExecutable()).resolves.toBe(explicit);
  });

  it('falls back to which lookup', async () => {
    whichMock.mockResolvedValueOnce('/usr/bin/dlltool');
    await expect(rustUtils.findDlltoolExecutable()).resolves.toBe('/usr/bin/dlltool');
  });

  it('scans rustup toolchains on Windows platforms', async () => {
    const restorePlatform = overridePlatform('win32');
    const rustupHome = await createTempDir('rustup');
    process.env.RUSTUP_HOME = rustupHome;

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

    await expect(rustUtils.findDlltoolExecutable()).resolves.toBe(candidate);

    restorePlatform();
  });
});
