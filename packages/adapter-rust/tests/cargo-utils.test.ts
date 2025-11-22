import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as cargoUtils from '../src/utils/cargo-utils.js';
import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

const spawnMock: Mock = vi.fn();

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => spawnMock(...args)
  };
});

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
    queueMicrotask(() => {
      proc.emit('error', error);
    });
    return proc;
  }

  queueMicrotask(() => {
    stdoutChunks.forEach((chunk) => stdout.emit('data', chunk));
    stderrChunks.forEach((chunk) => stderr.emit('data', chunk));
    proc.emit('exit', exitCode);
  });

  return proc;
};

const tempDirs: string[] = [];

const createTempProject = async (name = 'crate'): Promise<string> => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), `cargo-utils-${name}-`));
  tempDirs.push(base);
  await fs.mkdir(path.join(base, 'src'), { recursive: true });
  await fs.writeFile(path.join(base, 'Cargo.toml'), `name = "${name}"\nversion = "0.1.0"\n`);
  await fs.writeFile(path.join(base, 'src', 'main.rs'), '// test');
  return base;
};

const withBinaryExtension = (name: string): string =>
  process.platform === 'win32' ? `${name}.exe` : name;

beforeEach(() => {
  spawnMock.mockReset();
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      fssync.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});

describe('resolveCargoProject', () => {
  it('parses cargo metadata when available', async () => {
    const projectPath = await createTempProject('metadata');
    const metadata = {
      packages: [
        {
          manifest_path: path.join(projectPath, 'Cargo.toml'),
          targets: [
            {
              name: 'demo-bin',
              kind: ['bin'],
              src_path: path.join(projectPath, 'src/main.rs')
            }
          ]
        }
      ]
    };

    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: [JSON.stringify(metadata)]
      })
    );

    const result = await cargoUtils.resolveCargoProject(projectPath);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('metadata');
    expect(result?.version).toBe('0.1.0');
    expect(result?.targets).toHaveLength(1);
  });

  it('returns null when Cargo.toml lacks name', async () => {
    const projectPath = await createTempProject('no-name');
    await fs.writeFile(path.join(projectPath, 'Cargo.toml'), 'version = "0.1.0"\n');
    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: ['{"packages":[]}']
      })
    );
    const result = await cargoUtils.resolveCargoProject(projectPath);
    expect(result).toBeNull();
  });

  it('returns null when Cargo.toml cannot be read', async () => {
    const projectPath = await createTempProject('no-cargo');
    await fs.rm(path.join(projectPath, 'Cargo.toml'));
    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: ['{"packages":[]}']
      })
    );
    const result = await cargoUtils.resolveCargoProject(projectPath);
    expect(result).toBeNull();
  });
});

describe('getCargoTargets', () => {
  it('extracts targets from cargo metadata', async () => {
    const projectPath = await createTempProject('targets');
    const metadata = {
      packages: [
        {
          manifest_path: path.join(projectPath, 'Cargo.toml'),
          targets: [
            { name: 'bin-one', kind: ['bin'], src_path: 'src/main.rs' },
            { name: 'lib-one', kind: ['lib'], src_path: 'src/lib.rs' }
          ]
        },
        {
          manifest_path: '/other/Cargo.toml',
          targets: [{ name: 'other', kind: ['bin'], src_path: 'other.rs' }]
        }
      ]
    };

    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: [JSON.stringify(metadata)]
      })
    );

    const targets = await cargoUtils.getCargoTargets(projectPath);
    expect(targets).toHaveLength(2);
    expect(targets.map((t) => t.name)).toContain('bin-one');
    expect(targets.map((t) => t.name)).toContain('lib-one');
  });

  it('returns empty list on metadata failure', async () => {
    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: ['not-json'],
        exitCode: 0
      })
    );
    const targets = await cargoUtils.getCargoTargets('/workspace/demo');
    expect(targets).toEqual([]);

    spawnMock.mockImplementation(() => createMockProcess({ stdoutChunks: [], exitCode: 1 }));
    const targetsWithError = await cargoUtils.getCargoTargets('/workspace/demo');
    expect(targetsWithError).toEqual([]);
  });
});

describe('findBinaryTargets', () => {
  it('filters binary targets only', async () => {
    const projectPath = await createTempProject('bin-filter');
    const metadata = {
      packages: [
        {
          manifest_path: path.join(projectPath, 'Cargo.toml'),
          targets: [
            { name: 'app', kind: ['bin'], src_path: 'src/main.rs' },
            { name: 'lib', kind: ['lib'], src_path: 'src/lib.rs' }
          ]
        }
      ]
    };

    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: [JSON.stringify(metadata)]
      })
    );

    const bins = await cargoUtils.findBinaryTargets(projectPath);
    expect(bins).toEqual(['app']);
  });
});

describe('runCargoTest', () => {
  it('collects stdout and stderr on success', async () => {
    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: ['running tests\n'],
        stderrChunks: ['warning\n'],
        exitCode: 0
      })
    );
    const result = await cargoUtils.runCargoTest('/workspace/demo', 'unit_tests');
    expect(result.success).toBe(true);
    expect(result.output).toContain('warning');
  });

  it('returns failure message on spawn error', async () => {
    spawnMock.mockImplementation(() =>
      createMockProcess({
        error: new Error('spawn failed')
      })
    );
    const result = await cargoUtils.runCargoTest('/workspace/demo');
    expect(result.success).toBe(false);
    expect(result.output).toContain('spawn failed');
  });
});

describe('needsRebuild', () => {
  it('returns true when binary is older than sources', async () => {
    const project = await createTempProject('needs-rebuild');
    const targetDir = path.join(project, 'target', 'debug');
    await fs.mkdir(targetDir, { recursive: true });
    const binaryPath = path.join(targetDir, withBinaryExtension('needs-rebuild'));
    await fs.writeFile(binaryPath, '');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await fs.writeFile(path.join(project, 'src', 'main.rs'), '// updated');

    const result = await cargoUtils.needsRebuild(project, 'needs-rebuild');
    expect(result).toBe(true);
  });

  it('returns false when binary is newer than sources and Cargo.toml', async () => {
    const project = await createTempProject('fresh');
    const targetDir = path.join(project, 'target', 'debug');
    await fs.mkdir(targetDir, { recursive: true });
    const binaryPath = path.join(targetDir, withBinaryExtension('fresh'));
    await fs.writeFile(path.join(project, 'src', 'main.rs'), '// stable');
    await fs.writeFile(path.join(project, 'Cargo.toml'), 'name = "fresh"\nversion = "0.1.0"\n');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await fs.writeFile(binaryPath, '');

    const result = await cargoUtils.needsRebuild(project, 'fresh');
    expect(result).toBe(false);
  });

  it('returns true when binary does not exist', async () => {
    const project = await createTempProject('missing-bin');
    const result = await cargoUtils.needsRebuild(project, 'missing-bin');
    expect(result).toBe(true);
  });
});

describe('getDefaultBinary', () => {
  it('returns first binary target when available', async () => {
    const project = await createTempProject('default-bin');
    const metadata = {
      packages: [
        {
          manifest_path: path.join(project, 'Cargo.toml'),
          targets: [
            { name: 'default-bin', kind: ['bin'], src_path: 'src/main.rs' },
            { name: 'default-lib', kind: ['lib'], src_path: 'src/lib.rs' }
          ]
        }
      ]
    };

    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: [JSON.stringify(metadata)]
      })
    );

    const result = await cargoUtils.getDefaultBinary(project);
    expect(result).toBe('default-bin');
  });

  it('falls back to package name when no binary targets', async () => {
    const project = await createTempProject('package-only');
    const metadata = {
      packages: [
        {
          manifest_path: path.join(project, 'Cargo.toml'),
          targets: [{ name: 'package-only', kind: ['lib'], src_path: 'src/lib.rs' }]
        }
      ]
    };

    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: [JSON.stringify(metadata)]
      })
    );

    const result = await cargoUtils.getDefaultBinary(project);
    expect(result).toBe('package-only');
  });

  it('uses project directory name when main.rs exists', async () => {
    const project = await createTempProject('fallback');
    await fs.writeFile(path.join(project, 'Cargo.toml'), 'version = "0.1.0"\n');
    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: ['{"packages":[]}']
      })
    );
    const result = await cargoUtils.getDefaultBinary(project);
    expect(result).toBe(path.basename(project));
  });

  it('returns "main" when detection fails', async () => {
    const project = await createTempProject('no-main');
    await fs.rm(path.join(project, 'Cargo.toml'));
    await fs.rm(path.join(project, 'src', 'main.rs'));
    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: ['{"packages":[]}']
      })
    );
    const result = await cargoUtils.getDefaultBinary(project);
    expect(result).toBe('main');
  });
});

describe('findCargoProjectRoot', () => {
  it('walks up directories to locate Cargo.toml', async () => {
    const project = await createTempProject('root-search');
    const nested = path.join(project, 'src', 'bin');
    await fs.mkdir(nested, { recursive: true });
    const file = path.join(nested, 'main.rs');
    await fs.writeFile(file, '// nested');

    const root = await cargoUtils.findCargoProjectRoot(file);
    expect(root).toBe(project);
  });

  it('throws when Cargo.toml is not found', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cargo-utils-no-root-'));
    tempDirs.push(tmpDir);
    const file = path.join(tmpDir, 'main.rs');
    await fs.writeFile(file, '// orphan');
    await expect(cargoUtils.findCargoProjectRoot(file)).rejects.toThrowError();
  });
});

describe('runCargoBuild', () => {
  it('returns build output and success flag', async () => {
    spawnMock
      .mockImplementationOnce(() =>
        createMockProcess({
          stdoutChunks: ['Compiling crate (1/1)\n', 'Finished release [optimized]\n'],
          exitCode: 0
        })
      )
      .mockImplementationOnce(() =>
        createMockProcess({
          stdoutChunks: ['{"packages":[]}']
        })
      );

    const result = await cargoUtils.runCargoBuild('/workspace/demo', ['build']);
    expect(result.success).toBe(true);
    expect(result.output).toContain('Finished');
  });

  it('captures failure output', async () => {
    spawnMock.mockImplementation(() =>
      createMockProcess({
        stdoutChunks: ['Compiling crate\n'],
        stderrChunks: ['error: build failed\n'],
        exitCode: 101
      })
    );
    const result = await cargoUtils.runCargoBuild('/workspace/demo', ['build']);
    expect(result.success).toBe(false);
    expect(result.output).toContain('error: build failed');
  });
});

describe('buildCargoProject', () => {
  it('returns binary path on successful build', async () => {
    const metadataProject = await createTempProject('build-success');
    spawnMock
      .mockImplementationOnce(() =>
        createMockProcess({
          stdoutChunks: ['Compiling crate\n'],
          exitCode: 0
        })
      )
      .mockImplementationOnce(() =>
        createMockProcess({
          stdoutChunks: [
            JSON.stringify({
              packages: [
                {
                  manifest_path: path.join(metadataProject, 'Cargo.toml'),
                  targets: [
                    { name: 'build-success', kind: ['bin'], src_path: 'src/main.rs' }
                  ]
                }
              ]
            })
          ]
        })
      );
    const logger = {
      info: vi.fn(),
      error: vi.fn()
    };

    const result = await cargoUtils.buildCargoProject(metadataProject, logger, 'release');
    expect(result.success).toBe(true);
    const expectedBinary = process.platform === 'win32' ? 'build-success.exe' : 'build-success';
    expect(result.binaryPath).toBe(
      path.join(metadataProject, 'target', 'release', expectedBinary)
    );
    expect((logger.info as Mock)).toHaveBeenCalled();
  });

  it('reports errors when build process exits with failure', async () => {
    const project = await createTempProject('build-fail');
    spawnMock
      .mockImplementationOnce(() =>
        createMockProcess({
          stderrChunks: ['error: something went wrong\n'],
          exitCode: 1
        })
      )
      .mockImplementationOnce(() =>
        createMockProcess({
          stdoutChunks: ['{"packages":[]}']
        })
      );
    const logger = {
      info: vi.fn(),
      error: vi.fn()
    };

    const result = await cargoUtils.buildCargoProject(project, logger);
    expect(result.success).toBe(false);
    expect(result.error).toContain('something went wrong');
  });

  it('handles spawn errors gracefully', async () => {
    spawnMock
      .mockImplementationOnce(() =>
        createMockProcess({
          error: new Error('spawn error')
        })
      )
      .mockImplementationOnce(() =>
        createMockProcess({
          stdoutChunks: ['{"packages":[]}']
        })
      );

    const logger = {
      info: vi.fn(),
      error: vi.fn()
    };

    const project = await createTempProject('build-error');
    const result = await cargoUtils.buildCargoProject(project, logger);
    expect(result.success).toBe(false);
    expect(result.error).toContain('spawn error');
  });
});
