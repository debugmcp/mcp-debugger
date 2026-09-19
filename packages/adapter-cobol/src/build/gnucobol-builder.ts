/**
 * GnuCobolBuilder — runs `cobc` and turns its generated C into the COBOL symbol
 * manifest the DAP shim serves variables from.
 *
 * Three modes share one invocation shape:
 * - `executable`: `cobc -x … -o <dir>/<name>[.exe] <sources>` — source launch.
 * - `module`: `cobc -m … -o <dir>/<name>.<dll|so|dylib> <source>` — dynamically CALLed programs.
 * - `manifest-only`: `cobc -C … <sources>` — translate only; regenerates the
 *   manifest for a prebuilt executable without touching it.
 *
 * Measured constraints (issue #759 spike):
 * - `--save-temps` must be the bare form with cwd = the artifact directory; the
 *   `--save-temps=<dir>` form silently fails to move the intermediates on Windows.
 * - `-A "-O0 -gdwarf-4"` is mandatory on MinGW (DWARF-5 line tables are unreadable
 *   by LLDB in PE-COFF) and harmless elsewhere; `-fdump=ALL` makes the compiler emit
 *   the dump routine the parser reads, and `COBC_GEN_DUMP_COMMENTS=1` adds the
 *   REDEFINES / 88-level comment lines.
 * - A fresh key directory per (compiler, flags, sources) change: no in-place
 *   replacement of a possibly running executable.
 */
import { spawn as nodeSpawn } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { sanitizeStderrTail } from '@debugmcp/shared';
import { parseGeneratedC } from '../manifest/index.js';
import type { CobolManifest } from '../manifest/schema.js';
import { computeBuildKey, hashFileContents } from './build-key.js';
import { cobcEnvironment, type CobcLocation } from './cobc-locator.js';

export type CobolBuildMode = 'executable' | 'module' | 'manifest-only';

export interface CobolBuildRequest {
  /** Absolute path: the main COBOL source (executable/module) or the prebuilt binary (manifest-only). */
  program: string;
  /** Additional sources compiled in the same invocation (static link), or the sources of a prebuilt binary. */
  sources?: string[];
  mode: CobolBuildMode;
  /** Basename of the output (defaults to the program's basename without extension). */
  outputName?: string;
  /** `-std=<dialect>` (ibm, mf, cobol85, default, …). */
  dialect?: string;
  /** `-fixed` / `-free`; omitted → cobc's own default (fixed for .cob). */
  format?: 'fixed' | 'free';
  /** `-I <dir>` copybook search directories. */
  copybookDirs?: string[];
  /** Verbatim extra cobc flags (after ours, so they can override). */
  cobcFlags?: string[];
  /** `--debug`: all runtime checks (changes behaviour: subscript/ODO/numeric checks abort). */
  runtimeChecks?: boolean;
  forceRebuild?: boolean;
  /** Root for artifact directories; default `<dirname(program)>/.debug-mcp/cobol`. */
  artifactRoot?: string;
}

export interface CobolBuildResult {
  success: boolean;
  error?: string;
  /** The executable/module to launch (or the prebuilt binary in manifest-only mode). */
  binaryPath?: string;
  artifactDir?: string;
  /** One manifest per translation unit, written as `<src>.cobol-symbols.json` in the artifact dir. */
  manifestPaths: string[];
  manifests: CobolManifest[];
  buildKey: string;
  /** True when cobc ran in this call; false when a fresh artifact was reused. */
  compiled: boolean;
  /** Compiler warnings (sanitized) and manifest diagnostics. */
  diagnostics: string[];
  /** cobc argv used (without the executable), for logs and `build.json`. */
  argv: string[];
}

export interface GnuCobolBuilderLogger {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  debug?: (message: string) => void;
}

export interface SpawnLike {
  (command: string, args: string[], options: { cwd: string; env: Record<string, string>; windowsHide: boolean; stdio: ['ignore', 'pipe', 'pipe'] }): {
    stdout: NodeJS.ReadableStream | null;
    stderr: NodeJS.ReadableStream | null;
    on: (event: 'error' | 'close', listener: (arg: unknown) => void) => unknown;
    kill: () => unknown;
  };
}

export interface GnuCobolBuilderDeps {
  cobc: CobcLocation;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  logger?: GnuCobolBuilderLogger;
  spawnFn?: SpawnLike;
  /** Compile timeout; cobc + gcc on a big program can take a while. */
  timeoutMs?: number;
  now?: () => Date;
}

/** Launchable COBOL source extensions (copybooks are `.cpy`/`.copy` and are never a `program`). */
export const COBOL_SOURCE_EXTENSIONS = ['.cob', '.cbl', '.cobol'] as const;
export const COBOL_COPYBOOK_EXTENSIONS = ['.cpy', '.copy'] as const;

export function isCobolSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (COBOL_SOURCE_EXTENSIONS as readonly string[]).includes(ext);
}

export function isCobolTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return isCobolSourceFile(filePath) || (COBOL_COPYBOOK_EXTENSIONS as readonly string[]).includes(ext);
}

export function moduleExtension(platform: NodeJS.Platform): string {
  if (platform === 'win32') {
    return '.dll';
  }
  return platform === 'darwin' ? '.dylib' : '.so';
}

export function executableExtension(platform: NodeJS.Platform): string {
  return platform === 'win32' ? '.exe' : '';
}

/** Artifact directory naming, kept in one place so the shim/docs can describe it. */
export const ARTIFACT_ROOT_DIRNAME = path.join('.debug-mcp', 'cobol');
export const MANIFEST_SUFFIX = '.cobol-symbols.json';
export const MANIFEST_INDEX_NAME = 'manifest-index.json';
export const BUILD_INFO_NAME = 'build.json';
export const LATEST_POINTER_NAME = 'latest.json';
/** Older key directories kept per program (best effort; a locked directory is skipped). */
export const KEEP_ARTIFACT_DIRS = 3;

const DEFAULT_TIMEOUT_MS = 180_000;
/** C compiler flags forwarded through `-A` (see the module doc for why DWARF-4). */
export const C_COMPILE_FLAGS = '-O0 -gdwarf-4';

export interface ManifestIndex {
  /** Name of the artifact directory (the probe key computed before cobc ran). */
  buildKey: string;
  /**
   * Content key over the sources AND the copybooks the build discovered. A later
   * launch reuses this artifact when its probe key (sources + these copybooks)
   * equals it — the first build cannot know its copybooks up front, so the
   * directory name and the content key legitimately differ.
   */
  contentKey?: string;
  outputName: string;
  mode: CobolBuildMode;
  binary?: string;
  manifests: string[];
  /** Every copybook any manifest referenced — hashed into the next build key. */
  copybooks: string[];
  cobcVersion: string | null;
  generatedAt: string;
}

/**
 * The cobc argv (pure, unit-testable). Output paths are absolute; sources are
 * passed absolute so the DWARF `#line` paths equal the breakpoint paths mcp-debugger sends.
 */
export function cobcArguments(
  request: CobolBuildRequest,
  outputPath: string | undefined,
  listingPath: string,
  sources: string[]
): string[] {
  const args: string[] = [];
  if (request.mode === 'executable') {
    args.push('-x');
  } else if (request.mode === 'module') {
    args.push('-m');
  } else {
    args.push('-C');
  }
  args.push('-g', '-fdump=ALL', '--save-temps', '-t', listingPath, '-ftsymbols', '-A', C_COMPILE_FLAGS);
  if (request.dialect) {
    args.push(`-std=${request.dialect}`);
  }
  if (request.format === 'fixed') {
    args.push('-fixed');
  } else if (request.format === 'free') {
    args.push('-free');
  }
  for (const dir of request.copybookDirs ?? []) {
    args.push('-I', dir);
  }
  // cobc runs in the artifact directory, so copybooks beside the program are only found
  // when its own directory is searched too (after the caller's dirs).
  const sourceDir = sources.length > 0 ? path.dirname(sources[0]) : undefined;
  if (sourceDir !== undefined && !(request.copybookDirs ?? []).includes(sourceDir)) {
    args.push('-I', sourceDir);
  }
  if (request.runtimeChecks) {
    args.push('--debug');
  }
  args.push(...(request.cobcFlags ?? []));
  if (outputPath) {
    args.push('-o', outputPath);
  }
  args.push(...sources);
  return args;
}

/** The argv with output/listing paths removed — the part of the command that belongs in the build key. */
function keyArgv(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '-t') {
      i++;
      continue;
    }
    if (args[i] === '-I') {
      // A copybook search dir changes what every COPY resolves to.
      out.push(args[i], args[i + 1] ?? '');
      i++;
      continue;
    }
    if (path.isAbsolute(args[i])) {
      // sources are hashed by content, not by path
      continue;
    }
    out.push(args[i]);
  }
  return out;
}

/**
 * Copybook paths from the `#line N "path"` markers of the preprocessed `.i` cobc keeps
 * under --save-temps: every copybook the compilation read, including ones only the
 * LINKAGE SECTION, a REDEFINES or an OCCURS subordinate uses — those get no `#line` row in
 * the generated C. Paths are taken as written (cobc does not escape them here).
 */
export function copybooksFromPreprocessed(iPath: string): string[] {
  let text: string;
  try {
    text = fs.readFileSync(iPath, 'latin1');
  } catch {
    return [];
  }
  const found = new Set<string>();
  for (const match of text.matchAll(/^#line\s+\d+\s+"([^"]*)"/gm)) {
    const p = match[1];
    if (p.length > 0 && fs.existsSync(p)) {
      found.add(path.resolve(p));
    }
  }
  return [...found];
}

function readJson<T>(filePath: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

export class GnuCobolBuilder {
  private readonly platform: NodeJS.Platform;
  private readonly env: NodeJS.ProcessEnv;
  private readonly spawnFn: SpawnLike;
  private readonly timeoutMs: number;
  private readonly now: () => Date;

  constructor(private readonly deps: GnuCobolBuilderDeps) {
    this.platform = deps.platform ?? process.platform;
    this.env = deps.env ?? process.env;
    this.spawnFn = deps.spawnFn ?? (nodeSpawn as unknown as SpawnLike);
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = deps.now ?? (() => new Date());
  }

  /** Environment for spawning cobc and for launching what it built. */
  buildEnvironment(): Record<string, string> {
    return { ...cobcEnvironment(this.deps.cobc, this.env, this.platform), COBC_GEN_DUMP_COMMENTS: '1' };
  }

  /** Where `program`'s artifacts live: `<artifactRoot>/<basename>`. */
  programArtifactRoot(request: CobolBuildRequest): string {
    const root = request.artifactRoot ?? path.join(path.dirname(request.program), ARTIFACT_ROOT_DIRNAME);
    return path.join(root, this.outputName(request));
  }

  outputName(request: CobolBuildRequest): string {
    return request.outputName ?? path.basename(request.program, path.extname(request.program));
  }

  async build(request: CobolBuildRequest): Promise<CobolBuildResult> {
    const sources = this.resolveSources(request);
    const name = this.outputName(request);
    const programRoot = this.ensureProgramRoot(request);
    const previous = readJson<{ key?: string; artifactDir?: string }>(path.join(programRoot, LATEST_POINTER_NAME));
    const previousIndex = previous?.artifactDir
      ? readJson<ManifestIndex>(path.join(previous.artifactDir, MANIFEST_INDEX_NAME))
      : undefined;

    const provisionalArgs = cobcArguments(request, undefined, '<lst>', sources);
    // Platform/arch are part of the key: an artifact directory can be shared
    // through a mounted workspace (host ↔ container), and a Windows .exe must
    // never be "reused" by a Linux launch.
    const keyFor = (files: string[]): string => computeBuildKey({
      cobcVersion: `${this.deps.cobc.versionLine ?? 'unknown'} [${this.platform}/${process.arch}]`,
      argv: keyArgv(provisionalArgs),
      files: files
        .filter((file, index, all) => all.indexOf(file) === index && fs.existsSync(file))
        .map((file) => ({ path: file, contentHash: hashFileContents(file) }))
    });
    // Probe key: the sources plus whatever copybooks the previous build recorded.
    const buildKey = keyFor([...sources, ...(previousIndex?.copybooks ?? [])]);

    // Reuse the previous artifact when nothing it depended on changed — its
    // content key was computed after the build over the same file set.
    if (
      previous?.artifactDir &&
      previousIndex &&
      previousIndex.contentKey === buildKey &&
      !request.forceRebuild &&
      this.freshArtifact(request, previous.artifactDir, previousIndex.binary)
    ) {
      const reusedArgs = cobcArguments(request, previousIndex.binary, path.join(previous.artifactDir, `${name}.lst`), sources);
      this.deps.logger?.info?.(`[GnuCobolBuilder] Reusing artifacts ${previous.artifactDir} (build key ${previousIndex.buildKey}, unchanged inputs)`);
      const manifests = previousIndex.manifests.map((file) => readJson<CobolManifest>(file)).filter((m): m is CobolManifest => m !== undefined);
      return {
        success: true,
        binaryPath: request.mode === 'manifest-only' ? request.program : previousIndex.binary,
        artifactDir: previous.artifactDir,
        manifestPaths: previousIndex.manifests,
        manifests,
        buildKey: previousIndex.buildKey,
        compiled: false,
        diagnostics: [],
        argv: reusedArgs
      };
    }

    const artifactDir = this.claimArtifactDir(programRoot, buildKey);
    const outputPath = this.outputPathFor(request, artifactDir, name);
    const listingPath = path.join(artifactDir, `${name}.lst`);
    const args = cobcArguments(request, outputPath, listingPath, sources);

    this.deps.logger?.info?.(`[GnuCobolBuilder] ${this.deps.cobc.path} ${args.join(' ')} (cwd ${artifactDir})`);
    const run = await this.runCobc(args, artifactDir);
    const diagnostics: string[] = [];
    if (run.stderr.trim().length > 0) {
      diagnostics.push(sanitizeStderrTail(run.stderr, { maxLines: 20, maxChars: 2000 }));
    }
    if (!run.ok) {
      const detail = sanitizeStderrTail(run.stderr || run.stdout, { maxLines: 50, maxChars: 4000 });
      return {
        success: false,
        error: run.error ?? `cobc exited with code ${run.code}${detail ? `: ${detail}` : ''}`,
        artifactDir,
        manifestPaths: [],
        manifests: [],
        buildKey,
        compiled: true,
        diagnostics,
        argv: args
      };
    }
    if (request.mode !== 'manifest-only' && outputPath && !fs.existsSync(outputPath)) {
      return {
        success: false,
        error: `cobc reported success but produced no output at ${outputPath}`,
        artifactDir,
        manifestPaths: [],
        manifests: [],
        buildKey,
        compiled: true,
        diagnostics,
        argv: args
      };
    }

    const manifests: CobolManifest[] = [];
    const manifestPaths: string[] = [];
    const copybooks = new Set<string>();
    const generatedAt = this.now().toISOString();
    for (const source of sources) {
      const base = path.basename(source, path.extname(source));
      const cPath = path.join(artifactDir, `${base}.c`);
      if (!fs.existsSync(cPath)) {
        diagnostics.push(`No generated C for ${source} at ${cPath}; COBOL variables for that program will be unavailable.`);
        continue;
      }
      try {
        const manifest = parseGeneratedC({
          cPath,
          lstPath: fs.existsSync(listingPath) ? listingPath : undefined,
          generator: {
            cobcVersion: this.deps.cobc.versionLine ?? 'unknown',
            cobcPath: this.deps.cobc.path,
            argv: args,
            dialect: request.dialect,
            format: request.format ?? 'auto',
            buildKey,
            generatedAt,
            platform: this.platform,
            arch: process.arch,
            dumpComments: true
          }
        });
        const manifestPath = path.join(artifactDir, `${base}${MANIFEST_SUFFIX}`);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        manifests.push(manifest);
        manifestPaths.push(manifestPath);
        for (const src of manifest.sources) {
          if (src.kind === 'copybook') {
            copybooks.add(src.path);
          }
        }
        for (const diagnostic of manifest.diagnostics) {
          diagnostics.push(`${diagnostic.level}: ${diagnostic.message}`);
        }
      } catch (error) {
        diagnostics.push(`Manifest parse failed for ${cPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const source of sources) {
      const preprocessed = path.join(artifactDir, `${path.basename(source, path.extname(source))}.i`);
      for (const copybook of copybooksFromPreprocessed(preprocessed)) {
        if (!sources.includes(copybook)) {
          copybooks.add(copybook);
        }
      }
    }

    const index: ManifestIndex = {
      buildKey,
      contentKey: keyFor([...sources, ...copybooks]),
      outputName: name,
      mode: request.mode,
      binary: request.mode === 'manifest-only' ? request.program : outputPath,
      manifests: manifestPaths,
      copybooks: [...copybooks],
      cobcVersion: this.deps.cobc.versionLine,
      generatedAt
    };
    fs.writeFileSync(path.join(artifactDir, MANIFEST_INDEX_NAME), JSON.stringify(index, null, 2));
    fs.writeFileSync(
      path.join(artifactDir, BUILD_INFO_NAME),
      JSON.stringify({ buildKey, argv: args, cobc: this.deps.cobc.path, cobcVersion: this.deps.cobc.versionLine, sources, generatedAt }, null, 2)
    );
    fs.writeFileSync(
      path.join(programRoot, LATEST_POINTER_NAME),
      JSON.stringify({ key: buildKey, artifactDir, binaryPath: index.binary, updatedAt: generatedAt }, null, 2)
    );
    this.pruneOldArtifacts(programRoot, path.basename(artifactDir));

    return {
      success: true,
      binaryPath: index.binary,
      artifactDir,
      manifestPaths,
      manifests,
      buildKey,
      compiled: true,
      diagnostics,
      argv: args
    };
  }

  /**
   * The artifact root, created; when it cannot be (a prebuilt binary in a read-only
   * directory), a per-user temp root keyed by the program path, with a warning.
   */
  private ensureProgramRoot(request: CobolBuildRequest): string {
    const primary = this.programArtifactRoot(request);
    try {
      fs.mkdirSync(primary, { recursive: true });
      return primary;
    } catch (error) {
      const digest = createHash('sha256').update(path.resolve(request.program)).digest('hex').slice(0, 12);
      const fallback = path.join(os.tmpdir(), 'mcp-debugger-cobol', digest, this.outputName(request));
      this.deps.logger?.warn?.(
        `[GnuCobolBuilder] Cannot create ${primary} (${error instanceof Error ? error.message : String(error)}); artifacts go to ${fallback}`
      );
      fs.mkdirSync(fallback, { recursive: true });
      return fallback;
    }
  }

  /**
   * A directory of its own for this build: `<key>`, else `<key>-2`, `-3`, … Never build
   * in place — a paused session may still hold the previous executable, and two sessions
   * may build the same source at once (`mkdir` without `recursive` is the claim).
   */
  private claimArtifactDir(programRoot: string, buildKey: string): string {
    for (let n = 1; n < 1000; n++) {
      const candidate = path.join(programRoot, n === 1 ? buildKey : `${buildKey}-${n}`);
      try {
        fs.mkdirSync(candidate);
        return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error;
        }
      }
    }
    throw new Error(`cannot claim an artifact directory under ${programRoot}`);
  }

  private resolveSources(request: CobolBuildRequest): string[] {
    const list = request.mode === 'manifest-only' ? [...(request.sources ?? [])] : [request.program, ...(request.sources ?? [])];
    if (list.length === 0) {
      throw new Error('manifest-only builds need at least one COBOL source in `sources`.');
    }
    return list.map((p) => path.resolve(p)).filter((p, i, all) => all.indexOf(p) === i);
  }

  private outputPathFor(request: CobolBuildRequest, artifactDir: string, name: string): string | undefined {
    if (request.mode === 'manifest-only') {
      return undefined;
    }
    const ext = request.mode === 'module' ? moduleExtension(this.platform) : executableExtension(this.platform);
    return path.join(artifactDir, `${name}${ext}`);
  }

  /** True when the artifact directory still holds its binary (unless manifest-only) and every manifest. */
  private freshArtifact(request: CobolBuildRequest, artifactDir: string, binaryPath: string | undefined): boolean {
    const index = readJson<ManifestIndex>(path.join(artifactDir, MANIFEST_INDEX_NAME));
    if (!index) {
      return false;
    }
    if (request.mode !== 'manifest-only' && (!binaryPath || !fs.existsSync(binaryPath))) {
      return false;
    }
    return index.manifests.every((file) => fs.existsSync(file));
  }

  private pruneOldArtifacts(programRoot: string, currentKey: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(programRoot, { withFileTypes: true });
    } catch {
      return;
    }
    const dirs = entries
      .filter((e) => e.isDirectory() && e.name !== currentKey)
      .map((e) => {
        const full = path.join(programRoot, e.name);
        let mtime = 0;
        try {
          mtime = fs.statSync(full).mtimeMs;
        } catch { /* ignore */ }
        return { full, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    for (const dir of dirs.slice(KEEP_ARTIFACT_DIRS - 1)) {
      try {
        fs.rmSync(dir.full, { recursive: true, force: true });
      } catch {
        // A running debuggee may hold the executable (Windows); leave it for next time.
      }
    }
  }

  private runCobc(args: string[], cwd: string): Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string; error?: string }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (result: { ok: boolean; code: number | null; error?: string }): void => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ ...result, stdout, stderr });
        }
      };
      let child: ReturnType<SpawnLike>;
      try {
        child = this.spawnFn(this.deps.cobc.path, args, { cwd, env: this.buildEnvironment(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (error) {
        resolve({ ok: false, code: null, stdout, stderr, error: `Failed to start cobc: ${error instanceof Error ? error.message : String(error)}` });
        return;
      }
      const timer = setTimeout(() => {
        try { child.kill(); } catch { /* ignore */ }
        finish({ ok: false, code: null, error: `cobc timed out after ${this.timeoutMs} ms` });
      }, this.timeoutMs);
      child.stdout?.on('data', (data: Buffer | string) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer | string) => { stderr += data.toString(); });
      child.on('error', (err: unknown) => finish({ ok: false, code: null, error: `Failed to start cobc: ${err instanceof Error ? err.message : String(err)}` }));
      child.on('close', (code: unknown) => {
        const exitCode = typeof code === 'number' ? code : null;
        finish({ ok: exitCode === 0, code: exitCode });
      });
    });
  }
}
