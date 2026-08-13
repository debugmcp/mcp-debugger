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
