/**
 * Java example fixture builder for e2e tests.
 *
 * Mirrors tests/e2e/rust-example-utils.ts: on-demand compilation with mtime-based
 * cache invalidation. Ensures examples/java/<Example>.java is compiled with `-g`
 * (so JDI sees the LocalVariableTable) before tests reference its .class output.
 *
 * Synchronous API — call sites all run inside test setup, not on a hot path,
 * and existing inline javac calls were already synchronous.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const JAVA_DIR = path.resolve(ROOT, 'examples', 'java');

export type JavaExampleName =
  | 'HelloWorld'
  | 'PauseTest'
  | 'EventRaceTest'
  | 'InnerClassTest'
  | 'ExprTest'
  | 'InfiniteWait';

export interface JavaExamplePaths {
  /** Absolute path to the main .java source file. */
  sourcePath: string;
  /** Absolute path to the directory containing the compiled .class files (== examples/java). */
  classDir: string;
  /** Main class name passed to the JVM (e.g. 'PauseTest'). */
  mainClass: string;
}

interface JavaExampleSpec {
  /** Source file basename without .java; also the FQCN for the runtime entry point. */
  mainClass: string;
  /** Additional source basenames (no .java) co-compiled with the main file. */
  extraSources?: string[];
}

const EXAMPLES: Record<JavaExampleName, JavaExampleSpec> = {
  HelloWorld:     { mainClass: 'HelloWorld' },
  PauseTest:      { mainClass: 'PauseTest' },
  EventRaceTest:  { mainClass: 'EventRaceTest', extraSources: ['LateLoadedHelper'] },
  InnerClassTest: { mainClass: 'InnerClassTest' },
  ExprTest:       { mainClass: 'ExprTest' },
  InfiniteWait:   { mainClass: 'InfiniteWait' },
};

const prepared = new Map<JavaExampleName, JavaExamplePaths>();

/**
 * Ensure `<name>.class` (and any extra-source .class files) are up-to-date relative
 * to their .java sources, compiling with `javac -g` if needed. Result is cached for
 * the duration of the test process.
 */
export function prepareJavaExample(name: JavaExampleName): JavaExamplePaths {
  const spec = EXAMPLES[name];
  const cached = prepared.get(name);
  if (cached && !needsRebuild(cached, spec)) return cached;

  const sourcePath = path.join(JAVA_DIR, `${spec.mainClass}.java`);
  if (!existsSync(sourcePath)) {
    throw new Error(`Java example source missing: ${sourcePath}`);
  }
  const allSources = [
    sourcePath,
    ...(spec.extraSources ?? []).map(b => path.join(JAVA_DIR, `${b}.java`)),
  ];
  for (const src of allSources) {
    if (!existsSync(src)) {
      throw new Error(`Java example source missing: ${src}`);
    }
  }

  // Style mirrors packages/adapter-java/src/utils/jdi-resolver.ts (execFileSync +
  // array args) — avoids shell parsing, so paths with spaces work on Windows.
  execFileSync('javac', ['-g', '-d', JAVA_DIR, ...allSources], {
    cwd: JAVA_DIR,
    stdio: 'pipe',
  });

  const result: JavaExamplePaths = {
    sourcePath,
    classDir: JAVA_DIR,
    mainClass: spec.mainClass,
  };
  prepared.set(name, result);
  return result;
}

function needsRebuild(paths: JavaExamplePaths, spec: JavaExampleSpec): boolean {
  const mainClassFile = path.join(paths.classDir, `${spec.mainClass}.class`);
  if (!existsSync(mainClassFile)) return true;
  try {
    const classMtime = statSync(mainClassFile).mtimeMs;
    const sources = [
      paths.sourcePath,
      ...(spec.extraSources ?? []).map(b => path.join(paths.classDir, `${b}.java`)),
    ];
    return sources.some(src => statSync(src).mtimeMs >= classMtime);
  } catch {
    return true;
  }
}
