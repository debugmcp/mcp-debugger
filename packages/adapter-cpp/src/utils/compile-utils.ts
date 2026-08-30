/**
 * Single-file C/C++ compilation utilities (issue #325).
 *
 * Supports the convenience launch path where `program` is a lone .c/.cpp
 * source: pick a compiler by dialect, compile with `-g -O0` into a
 * deterministic `.debug-mcp/` sibling directory, and rebuild only when the
 * source is newer than the binary. Multi-file projects are out of scope —
 * users prebuild those and pass the executable.
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { sanitizeStderrTail } from '@debugmcp/shared';

export type SourceDialect = 'c' | 'cpp';

export const CPP_SOURCE_EXTENSIONS = ['.c', '.cpp', '.cc', '.cxx'] as const;

/** C++ before C: a C++ compiler handles both dialects, the reverse fails to link. */
export const CPP_COMPILER_CANDIDATES = ['g++', 'clang++', 'c++'] as const;
export const C_COMPILER_CANDIDATES = ['gcc', 'clang', 'cc'] as const;

export interface CompileLogger {
  info?(message: string, ...meta: unknown[]): void;
  warn?(message: string, ...meta: unknown[]): void;
  error?(message: string, ...meta: unknown[]): void;
  debug?(message: string, ...meta: unknown[]): void;
}

export interface CompileResult {
  success: boolean;
  binaryPath?: string;
  error?: string;
}

export interface PreparedSourceBinaryResult extends CompileResult {
  compiled?: boolean;
}

interface ArtifactFileSystem {
  mkdir(directoryPath: string, options?: { recursive?: boolean }): Promise<unknown>;
  readdir(directoryPath: string): Promise<string[]>;
  rename(oldPath: string, newPath: string): Promise<unknown>;
  stat(filePath: string): Promise<{ mtimeMs: number }>;
  unlink(filePath: string): Promise<unknown>;
}

const artifactFileSystem: ArtifactFileSystem = {
  mkdir: (directoryPath, options) => fs.mkdir(directoryPath, options),
  readdir: (directoryPath) => fs.readdir(directoryPath),
  rename: (oldPath, newPath) => fs.rename(oldPath, newPath),
  stat: (filePath) => fs.stat(filePath),
  unlink: (filePath) => fs.unlink(filePath)
};

let managedArtifactSequence = 0;
const MANAGED_OUTPUT_CLEANUP_GRACE_MS = 60_000;

export function isCppSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (CPP_SOURCE_EXTENSIONS as readonly string[]).includes(ext);
}

export function dialectForSource(filePath: string): SourceDialect {
  return path.extname(filePath).toLowerCase() === '.c' ? 'c' : 'cpp';
}

function probeCommand(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

/** Find the first working compiler for the given dialect, or null. */
export async function findCompiler(dialect: SourceDialect): Promise<string | null> {
  const candidates = dialect === 'c' ? C_COMPILER_CANDIDATES : CPP_COMPILER_CANDIDATES;
  for (const candidate of candidates) {
    if (await probeCommand(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Find any C/C++ compiler, preferring C++ ones (they handle both dialects). */
export async function findAnyCompiler(): Promise<string | null> {
  return (await findCompiler('cpp')) ?? (await findCompiler('c'));
}

export interface CompilerInfo {
  command: string;
  version: string | null;
}

/** Upper bound for a single toolchain probe child before it is killed. */
const PROBE_KILL_TIMEOUT_MS = 10_000;

/**
 * The available compiler and its version banner (the first line of
 * `--version` output, e.g. "g++ (MinGW-w64 ...) 13.2.0"). Pass an already
 * discovered `command` (e.g. validate()'s details.compiler) to skip the
 * candidate scan. Doctor-only probe (issue #423) — validate() keeps its
 * cheaper presence-only findAnyCompiler.
 */
export async function getCompilerInfo(command?: string): Promise<CompilerInfo | null> {
  const resolved = command ?? (await findAnyCompiler());
  if (!resolved) {
    return null;
  }
  return { command: resolved, version: await captureVersionLine(resolved) };
}

function captureVersionLine(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
      let output = '';
      child.stdout?.on('data', (data) => { output += data.toString(); });
      child.stderr?.on('data', (data) => { output += data.toString(); });

      const killTimer = setTimeout(() => {
        try { child.kill(); } catch { /* already gone */ }
      }, PROBE_KILL_TIMEOUT_MS);
      killTimer.unref?.();

      child.on('error', () => {
        clearTimeout(killTimer);
        resolve(null);
      });
      // 'close' (not 'exit') so stdio is fully drained before reading output
      child.on('close', (code) => {
        clearTimeout(killTimer);
        const firstLine = output.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0);
        resolve(code === 0 && firstLine ? firstLine : null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Deterministic output location for a compiled single-file program:
 * `<sourceDir>/.debug-mcp/<basename>[.exe]`. Git-ignorable and stable, so
 * staleness checks work across sessions.
 */
export function getDefaultOutputPath(sourcePath: string, platform: NodeJS.Platform = process.platform): string {
  const dir = path.dirname(sourcePath);
  const base = path.basename(sourcePath, path.extname(sourcePath));
  const ext = platform === 'win32' ? '.exe' : '';
  return path.join(dir, '.debug-mcp', `${base}${ext}`);
}

/**
 * A unique, debugger-managed sibling of the deterministic output. Successful
 * Windows rebuilds stay here when the running canonical executable is locked.
 */
export function getManagedOutputPath(outputPath: string, token?: string): string {
  const parsed = path.parse(outputPath);
  const uniqueToken = token ?? `${Date.now()}-${process.pid}-${++managedArtifactSequence}`;
  return path.join(parsed.dir, `${parsed.name}.debug-mcp-${uniqueToken}${parsed.ext}`);
}

function isManagedOutputName(fileName: string, outputPath: string): boolean {
  const parsed = path.parse(outputPath);
  const prefix = `${parsed.name}.debug-mcp-`;
  if (!fileName.startsWith(prefix) || !fileName.endsWith(parsed.ext)) {
    return false;
  }
  return fileName.slice(prefix.length, fileName.length - parsed.ext.length).length > 0;
}

async function findNewestCompiledOutput(
  outputPath: string,
  fileSystem: ArtifactFileSystem
): Promise<string | undefined> {
  const directory = path.dirname(outputPath);
  let names: string[];
  try {
    names = await fileSystem.readdir(directory);
  } catch {
    return undefined;
  }

  const candidates = names
    .filter((name) => name === path.basename(outputPath) || isManagedOutputName(name, outputPath))
    .map((name) => path.join(directory, name));
  const existing: Array<{ filePath: string; mtimeMs: number }> = [];
  for (const filePath of candidates) {
    try {
      existing.push({ filePath, mtimeMs: (await fileSystem.stat(filePath)).mtimeMs });
    } catch {
      // The candidate disappeared between readdir and stat.
    }
  }
  existing.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return existing[0]?.filePath;
}

async function removeOlderManagedOutputs(
  outputPath: string,
  keepPath: string,
  fileSystem: ArtifactFileSystem,
  logger?: CompileLogger
): Promise<void> {
  let names: string[];
  try {
    names = await fileSystem.readdir(path.dirname(outputPath));
  } catch {
    return;
  }

  for (const name of names) {
    if (!isManagedOutputName(name, outputPath)) {
      continue;
    }
    const candidate = path.join(path.dirname(outputPath), name);
    if (candidate === keepPath) {
      continue;
    }
    try {
      const ageMs = Date.now() - (await fileSystem.stat(candidate)).mtimeMs;
      if (ageMs < MANAGED_OUTPUT_CLEANUP_GRACE_MS) {
        logger?.debug?.(
          `[compile-utils] Keeping recent managed artifact ${candidate} during the concurrent-build grace window`
        );
        continue;
      }
      await fileSystem.unlink(candidate);
    } catch (error) {
      logger?.debug?.(
        `[compile-utils] Could not remove older managed artifact ${candidate}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

async function promoteStagedOutput(
  stagedPath: string,
  managedPath: string,
  outputPath: string,
  platform: NodeJS.Platform,
  fileSystem: ArtifactFileSystem,
  logger?: CompileLogger
): Promise<{ binaryPath?: string; error?: string }> {
  // Rename straight over the canonical path: on POSIX that is an atomic
  // replace, and on Windows fs.rename maps to MoveFileEx(REPLACE_EXISTING),
  // which replaces an unlocked target and fails on one a running debuggee
  // still holds. Never unlink the canonical executable first — a rename
  // failure after that would destroy the last good build, the exact loss
  // this staging scheme exists to prevent.
  try {
    await fileSystem.rename(stagedPath, outputPath);
    return { binaryPath: outputPath };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    const reason = error instanceof Error ? error.message : String(error);
    const lockHint = platform === 'win32' ? ' (still locked by a running debuggee?)' : '';
    logger?.warn?.(
      `[compile-utils] Could not replace ${outputPath}${lockHint}; retaining managed rebuild ${managedPath}: ${
        code ? `${code}: ` : ''
      }${reason}`
    );
    try {
      await fileSystem.rename(stagedPath, managedPath);
      return { binaryPath: managedPath };
    } catch (managedError) {
      return {
        error: `Could not finalize compiled artifact ${managedPath}: ${
          managedError instanceof Error ? managedError.message : String(managedError)
        }`
      };
    }
  }
}

export interface PrepareSourceBinaryOptions {
  sourcePath: string;
  outputPath: string;
  forceRebuild?: boolean;
  platform?: NodeJS.Platform;
  logger?: CompileLogger;
  /** Internal test seam. */
  compile?: (options: CompileOptions) => Promise<CompileResult>;
  /** Internal test seam. */
  fileSystem?: ArtifactFileSystem;
}

/**
 * Select or safely rebuild a single-source executable. Compilation always
 * targets a unique managed path, so a compiler failure cannot truncate the
 * previous artifact. On Windows, a locked canonical executable leaves the
 * successful managed build in place and that newest artifact is reused by
 * later launches.
 */
export async function prepareSourceBinary(
  options: PrepareSourceBinaryOptions
): Promise<PreparedSourceBinaryResult> {
  const {
    sourcePath,
    outputPath,
    forceRebuild = false,
    platform = process.platform,
    logger,
    compile = compileSourceFile,
    fileSystem = artifactFileSystem
  } = options;

  const outputDir = path.dirname(outputPath);
  try {
    await fileSystem.mkdir(outputDir, { recursive: true });
  } catch (error) {
    // Keep the { success, error } contract so the caller reports this as a
    // compile failure rather than escaping a raw errno from the transform.
    return {
      success: false,
      error: `Could not create output directory ${outputDir}: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
  const currentOutput = await findNewestCompiledOutput(outputPath, fileSystem);
  if (
    !forceRebuild &&
    currentOutput &&
    !(await needsRecompile(sourcePath, currentOutput))
  ) {
    await removeOlderManagedOutputs(outputPath, currentOutput, fileSystem, logger);
    return { success: true, binaryPath: currentOutput, compiled: false };
  }

  // The compiler writes a suffix the selector cannot recognize. Only a
  // successful rename below publishes a reusable managed artifact, so a
  // server/compiler crash can leave at worst an ignored *.tmp file (#560).
  const managedPath = getManagedOutputPath(outputPath);
  const stagedPath = `${managedPath}.tmp`;
  const result = await compile({ sourcePath, outputPath: stagedPath, logger });
  if (!result.success) {
    try {
      await fileSystem.unlink(stagedPath);
    } catch {
      // A compiler may not have emitted a file; partial cleanup is best effort.
    }
    return { success: false, error: result.error };
  }

  const compiledPath = result.binaryPath ?? stagedPath;
  const promoted = await promoteStagedOutput(
    compiledPath,
    managedPath,
    outputPath,
    platform,
    fileSystem,
    logger
  );
  if (!promoted.binaryPath) {
    try {
      await fileSystem.unlink(compiledPath);
    } catch {
      // Best effort: the unselectable temporary file is safe to leave behind.
    }
    return { success: false, error: promoted.error ?? 'Could not finalize compiled artifact' };
  }
  const launchPath = promoted.binaryPath;
  await removeOlderManagedOutputs(outputPath, launchPath, fileSystem, logger);
  return { success: true, binaryPath: launchPath, compiled: true };
}

/**
 * Rebuild when the binary is missing or the source is newer. Only the single
 * source file is tracked — #include'd headers are not (documented limitation;
 * `forceRebuild: true` in the launch config is the escape hatch).
 */
export async function needsRecompile(sourcePath: string, binaryPath: string): Promise<boolean> {
  let binaryStat;
  try {
    binaryStat = await fs.stat(binaryPath);
  } catch {
    return true;
  }
  const sourceStat = await fs.stat(sourcePath);
  return sourceStat.mtimeMs > binaryStat.mtimeMs;
}

export interface CompileOptions {
  sourcePath: string;
  outputPath: string;
  /** Defaults to the dialect implied by the source extension. */
  dialect?: SourceDialect;
  logger?: CompileLogger;
}

/**
 * Compile a single source file with `-gdwarf-4 -O0` (full debug info, no
 * optimization — the right shape for stepping). DWARF-4 explicitly, not `-g`:
 * MinGW gcc 11+ defaults to DWARF-5, whose line tables LLDB cannot read from
 * PE-COFF binaries — line breakpoints come back "Resolved locations: 0" while
 * symbols still work (verified live with MSYS2 g++ 15.2 + CodeLLDB 1.11.8).
 * DWARF-4 is fully supported by LLDB on every platform. Failure output is
 * capped and secret-redacted via the shared stderr sanitizer.
 */
export async function compileSourceFile(options: CompileOptions): Promise<CompileResult> {
  const { sourcePath, outputPath, logger } = options;
  const dialect = options.dialect ?? dialectForSource(sourcePath);

  const compiler = await findCompiler(dialect);
  if (!compiler) {
    const label = dialect === 'c' ? 'C' : 'C++';
    return {
      success: false,
      error: `No ${label} compiler found (tried: ${(dialect === 'c' ? C_COMPILER_CANDIDATES : CPP_COMPILER_CANDIDATES).join(', ')}). Install one (e.g. MSYS2/MinGW-w64 on Windows, build-essential on Debian/Ubuntu, Xcode CLT on macOS) or pass a prebuilt binary as "program".`
    };
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const args = ['-gdwarf-4', '-O0', '-o', outputPath, sourcePath];
  logger?.info?.(`[compile-utils] ${compiler} ${args.join(' ')}`);

  return new Promise((resolve) => {
    const child = spawn(compiler, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stderr = '';
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      resolve({ success: false, error: `Failed to run ${compiler}: ${error.message}` });
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ success: true, binaryPath: outputPath });
      } else {
        resolve({
          success: false,
          error: sanitizeStderrTail(stderr, { maxLines: 50, maxChars: 4000 })
        });
      }
    });
  });
}
