import path from 'path';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { findDlltoolExecutable } from '../../packages/adapter-rust/src/utils/rust-utils.js';

export type RustExampleName = 'hello_world' | 'async_example';

const WINDOWS_GNU_TARGET = 'x86_64-pc-windows-gnu';
const ROOT = path.resolve(process.cwd(), '.');
const DOCKER_RUST_IMAGE = process.env.RUST_EXAMPLE_DOCKER_IMAGE || 'rust:1.83-slim';
const LINUX_BUILD_STAMP = '.debug-mcp-linux-build';
type RustTarget = 'host' | 'linux';

interface ExamplePaths {
  sourcePath: string;
  binaryPath: string;
}

export interface PrepareRustExampleOptions {
  target?: RustTarget;
}

const preparedExamples = new Map<string, ExamplePaths>();

export async function prepareRustExample(
  exampleName: RustExampleName,
  options: PrepareRustExampleOptions = {}
): Promise<ExamplePaths> {
  const target: RustTarget = options.target ?? 'host';
  const cacheKey = `${exampleName}:${target}`;
  if (preparedExamples.has(cacheKey)) {
    return preparedExamples.get(cacheKey)!;
  }

  const exampleRoot = path.resolve(ROOT, 'examples', 'rust', exampleName);
  const sourcePath = path.join(exampleRoot, 'src', 'main.rs');
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file missing for ${exampleName}: ${sourcePath}`);
  }

  await buildExampleBinary(exampleRoot, exampleName, target);
  const binaryPath = await resolveBinaryPath(exampleRoot, exampleName, target);
  if (!existsSync(binaryPath)) {
    throw new Error(`Compiled binary missing for ${exampleName}: ${binaryPath}`);
  }

  const result = { sourcePath, binaryPath };
  preparedExamples.set(cacheKey, result);
  return result;
}

async function buildExampleBinary(
  exampleRoot: string,
  exampleName: RustExampleName,
  target: RustTarget
): Promise<void> {
  if (target === 'linux') {
    await buildExampleBinaryInDocker(exampleRoot, exampleName);
    return;
  }

  if (process.platform === 'win32') {
    const dlltoolPath = await findDlltoolExecutable();
    if (!dlltoolPath) {
      throw new Error(
        'dlltool.exe is required for GNU toolchain builds on Windows. Install MinGW-w64/binutils or ensure rustup stable-gnu is installed and add dlltool.exe to PATH.'
      );
    }
    const dllDir = path.dirname(dlltoolPath);
    const env = {
      ...process.env,
      PATH: `${dllDir}${path.delimiter}${process.env.PATH ?? ''}`,
      DLLTOOL: dlltoolPath
    };
    try {
      await runCargoCommand(['+stable-gnu', 'build', '--target', WINDOWS_GNU_TARGET], exampleRoot, env);
      return;
    } catch (error) {
      console.warn('[Rust Example Utils] GNU target build failed, falling back to platform default:', error);
    }
  }

  const fallbackArgs =
    process.platform === 'win32'
      ? ['+stable-msvc', 'build', '--target', 'x86_64-pc-windows-msvc']
      : ['build'];
  await runCargoCommand(fallbackArgs, exampleRoot, { ...process.env });
}

async function resolveBinaryPath(
  exampleRoot: string,
  binaryName: string,
  target: RustTarget
): Promise<string> {
  const extension = process.platform === 'win32' ? '.exe' : '';

  if (target === 'linux') {
    const linuxBinary = path.join(exampleRoot, 'target', 'debug', binaryName);
    if (!(await pathExistsAsync(linuxBinary))) {
      throw new Error(`Linux binary not found at ${linuxBinary}. Did the docker build succeed?`);
    }
    return linuxBinary;
  }

  if (process.platform === 'win32') {
    const gnuPath = path.join(
      exampleRoot,
      'target',
      WINDOWS_GNU_TARGET,
      'debug',
      `${binaryName}${extension}`
    );
    if (existsSync(gnuPath)) {
      return gnuPath;
    }
  }
  return path.join(exampleRoot, 'target', 'debug', `${binaryName}${extension}`);
}

async function buildExampleBinaryInDocker(exampleRoot: string, exampleName: RustExampleName): Promise<void> {
  const binaryPath = path.join(exampleRoot, 'target', 'debug', exampleName);
  const sourcePath = path.join(exampleRoot, 'src', 'main.rs');
  const examplesRootFs = path.resolve(ROOT, 'examples');
  const relativeExamplePathFs = path.relative(examplesRootFs, exampleRoot);
  const workspaceRelativePath = relativeExamplePathFs.replace(/\\/g, '/');

  if (!(await linuxBinaryNeedsBuild(binaryPath, sourcePath, exampleRoot, workspaceRelativePath))) {
    return;
  }

  console.log(`[Rust Example Utils] Building Linux binary for ${exampleName} via Docker (${DOCKER_RUST_IMAGE})...`);
  const examplesRoot = examplesRootFs.replace(/\\/g, '/');
  const workdir = workspaceRelativePath ? `/workspace/${workspaceRelativePath}` : '/workspace';
  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    `${examplesRoot}:/workspace`,
    '-e',
    'CARGO_HOME=/workspace/.cargo',
    '--workdir',
    workdir,
    DOCKER_RUST_IMAGE,
    '/bin/sh',
    '-c',
    'cargo build --locked --color never'
  ];

  await runDockerCommand(dockerArgs);
  const stampPath = path.join(exampleRoot, LINUX_BUILD_STAMP);
  await fs.writeFile(stampPath, workspaceRelativePath || '.');
}

async function linuxBinaryNeedsBuild(
  binaryPath: string,
  sourcePath: string,
  exampleRoot: string,
  expectedWorkspacePath: string
): Promise<boolean> {
  if (!(await pathExistsAsync(binaryPath))) {
    return true;
  }

  const stampPath = path.join(exampleRoot, LINUX_BUILD_STAMP);
  try {
    const recorded = (await fs.readFile(stampPath, 'utf-8')).trim();
    if (recorded !== (expectedWorkspacePath || '.')) {
      return true;
    }
  } catch {
    return true;
  }

  try {
    const [binaryStat, srcStat] = await Promise.all([fs.stat(binaryPath), fs.stat(sourcePath)]);
    return srcStat.mtimeMs >= binaryStat.mtimeMs;
  } catch {
    return true;
  }
}

function runCargoCommand(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('cargo', args, {
      cwd,
      env,
      stdio: 'inherit'
    });
    buildProcess.on('error', reject);
    buildProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`cargo build failed with exit code ${code}`));
      }
    });
  });
}

function runDockerCommand(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function pathExistsAsync(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
