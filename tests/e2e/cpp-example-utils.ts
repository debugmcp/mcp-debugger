/**
 * Shared builder for the C/C++ example fixtures (issue #325).
 *
 * Compiles examples/cpp/<name>.cpp (or .c) with the first available compiler
 * into examples/cpp/.debug-mcp-test/ — a separate directory from the
 * adapter's own .debug-mcp/ auto-compile output, so tests that exercise the
 * adapter's source-file launch path never collide with prebuilt fixtures.
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const CPP_EXAMPLES_DIR = path.join(ROOT, 'examples', 'cpp');
const BUILD_DIR = path.join(CPP_EXAMPLES_DIR, '.debug-mcp-test');

export type CppExampleName = 'hello_world' | 'pause_test' | 'throwing_example' | 'hello_world_c';

const SOURCES: Record<CppExampleName, string> = {
  hello_world: 'hello_world.cpp',
  pause_test: 'pause_test.cpp',
  throwing_example: 'throwing_example.cpp',
  hello_world_c: 'hello_world.c'
};

const buildCache = new Map<CppExampleName, { sourcePath: string; binaryPath: string }>();

function commandWorks(command: string): boolean {
  try {
    return spawnSync(command, ['--version'], { stdio: 'ignore', timeout: 5000, windowsHide: true }).status === 0;
  } catch {
    return false;
  }
}

let cachedCppCompiler: string | null | undefined;
let cachedCCompiler: string | null | undefined;

export function findCppCompilerSync(): string | null {
  if (cachedCppCompiler === undefined) {
    cachedCppCompiler = ['g++', 'clang++'].find(commandWorks) ?? null;
  }
  return cachedCppCompiler;
}

export function findCCompilerSync(): string | null {
  if (cachedCCompiler === undefined) {
    cachedCCompiler = ['gcc', 'clang'].find(commandWorks) ?? null;
  }
  return cachedCCompiler;
}

export function hasCppToolchain(): boolean {
  return findCppCompilerSync() !== null;
}

/**
 * Compile an example (memoized per process; skips when the binary is newer
 * than the source). Throws when no compiler is available — gate callers with
 * hasCppToolchain().
 */
export function prepareCppExample(name: CppExampleName): { sourcePath: string; binaryPath: string } {
  const cached = buildCache.get(name);
  if (cached) {
    return cached;
  }

  const sourceFile = SOURCES[name];
  const sourcePath = path.join(CPP_EXAMPLES_DIR, sourceFile);
  if (!existsSync(sourcePath)) {
    throw new Error(`C/C++ example source missing: ${sourcePath}`);
  }

  const isC = sourceFile.endsWith('.c');
  const compiler = isC ? (findCCompilerSync() ?? findCppCompilerSync()) : findCppCompilerSync();
  if (!compiler) {
    throw new Error('No C/C++ compiler available (tried g++, clang++, gcc, clang). Gate tests with hasCppToolchain().');
  }

  const exeSuffix = process.platform === 'win32' ? '.exe' : '';
  const binaryPath = path.join(BUILD_DIR, `${name}${exeSuffix}`);

  const fresh =
    existsSync(binaryPath) && statSync(binaryPath).mtimeMs > statSync(sourcePath).mtimeMs;

  if (!fresh) {
    mkdirSync(BUILD_DIR, { recursive: true });
    // -gdwarf-4: MinGW gcc defaults to DWARF-5, whose line tables LLDB
    // cannot read from PE-COFF (line breakpoints never bind)
    const result = spawnSync(compiler, ['-gdwarf-4', '-O0', '-o', binaryPath, sourcePath], {
      encoding: 'utf-8',
      timeout: 120_000,
      windowsHide: true
    });
    if (result.status !== 0) {
      throw new Error(
        `Failed to compile ${sourceFile} with ${compiler} (exit ${result.status}):\n${result.stderr ?? ''}`
      );
    }
  }

  const entry = { sourcePath, binaryPath };
  buildCache.set(name, entry);
  return entry;
}
