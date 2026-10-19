/**
 * Is the file the caller points at newer than the compiled file the debugger
 * binds it through? (issues #938/#950)
 *
 * `set_breakpoint` echoes the requested line from the source file, and every
 * stop answer reads its context from the same file, while the engine binds
 * the location through a compiled file: js-debug through the generated
 * `.js`'s source map, JDI through the `.class`, netcoredbg through the DLL's
 * PDB, CodeLLDB and Delve through a binary's DWARF. When that file is older
 * than the source the two disagree and the echo is a confident lie: the
 * breakpoint sits on a different statement than the one shown, and every
 * later line number is off. The adapter answers under the source path, so
 * the compiled file never appears in any record; this module finds it.
 *
 * The split: the adapter's policy knows where its compiler emits
 * (`AdapterPolicy.generatedFileCandidates`, pure path arithmetic); this
 * module does the filesystem work and the mtime comparison. A candidate says
 * what links it to the source: `linkedBy: 'sourceMap'` is a guess — the
 * tsconfig/package walk feeds it, and the `.map` beside it must name the
 * source before it is trusted (a guess that merely exists never is);
 * `linkedBy: 'launch'` is the artefact the transformed launch runs (the .NET
 * DLL, a Go/Rust/C/COBOL binary, the Java `.class` on the classpath), taken
 * as the launch's own word — it needs no walk and has no map, so only its
 * existence is checked. A result is evidence for a hedged sentence, never a
 * verdict: mtime says "older", not "different".
 *
 * Never throws and never logs above debug. Known limits, by design:
 * - A `launch` candidate is believed to contain the source because the
 *   launch runs it; a source newer than the artefact but not compiled into
 *   it (a scratch file beside the project) reads as stale too.
 * - tsconfig `extends` is not followed; the walk takes the nearest config
 *   that names an `outDir` (so a per-directory config that only extends the
 *   root one is walked past), and a parse failure means "no tsconfig".
 * - `sourceMappingURL` is not parsed: the map must be `<generated>.map`
 *   beside the generated file. A generated file without one is skipped —
 *   without a map js-debug cannot bind the source through it either.
 * - A source touched without a content change reads as newer (the sentence
 *   says "may"), and an incremental build (`tsc -b`, `--incremental`,
 *   `tsc --watch`) does not re-emit for an unchanged content hash, so only a
 *   full rebuild or a real edit clears that one.
 * - Whether the process actually loads the compiled file is not known here:
 *   a runner that transforms sources in memory (tsx, ts-node, vitest) is
 *   declined by the adapter's policy from the launch this module hands it,
 *   not by this module.
 * - Several `launch` candidates may exist at once (a Java class under more
 *   than one classpath directory, a leftover in-place compile beside the
 *   source): the newest is taken, since a stale leftover is never newer than
 *   the build the engine loads — the bias is towards silence, never towards
 *   a false warning.
 */
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LRUCache } from 'lru-cache';
import type { AdapterPolicy, GeneratedFileCandidate, GeneratedFileContext, IFileSystem } from '@debugmcp/shared';
import { samePath } from './hit-verification.js';

/** What was compared when the source is newer than the compiled file it binds through. */
export interface StaleBuildEvidence {
  sourceFile: string;
  sourceMtimeMs: number;
  generatedFile: string;
  generatedMtimeMs: number;
  /** What tied `generatedFile` to `sourceFile`: its map, or the launch that runs it. */
  linkedBy: GeneratedFileCandidate['linkedBy'];
  /** The map that proved `generatedFile` is compiled from `sourceFile`; `sourceMap` candidates only. */
  mapFile?: string;
}

/** The session's current launch as the policy hook sees it: absent before a launch and on attach. */
export type LaunchContext = Pick<GeneratedFileContext, 'program' | 'launchConfig'>;

export interface BuildStalenessOptions {
  /** The source must be newer by more than this (default 2000 ms: FAT and other coarse mtimes). */
  toleranceMs?: number;
  /** The largest `.map` read (default 5 MiB; a bundle's map is not a per-file map anyway). */
  maxMapBytes?: number;
  /** The largest tsconfig read (default 1 MiB). */
  maxConfigBytes?: number;
  /** Directory levels walked above the source for tsconfig.json / package.json (default 16). */
  maxWalkDepth?: number;
  /**
   * How long a located compiled file — or, for launch-linked candidates, the
   * fact that none was found — is remembered before the candidates are tried
   * again (default 60 s), so a more specific artefact that appears later —
   * `dist/` added beside an old in-place build — displaces the one found
   * first, and a session whose class lives in a jar does not re-stat every
   * classpath candidate on every answer. Within the window a `sourceMap`
   * discovery is still guarded by its map's stamp, and every discovery by the
   * artefact still existing: the two mtimes that decide are read fresh on
   * every check.
   */
  discoveryTtlMs?: number;
  /**
   * How long a directory's tsconfig/package context is remembered (default
   * 30 s), so a source with no compiled file at all does not pay the walk on
   * every stop answer.
   */
  contextTtlMs?: number;
}

/** The slice of a policy this module reads. */
export type GeneratedFilePolicy = Pick<AdapterPolicy, 'name' | 'generatedFileCandidates'>;

type DebugLogger = { debug: (message: string, meta?: unknown) => void };

interface FileStamp {
  mtimeMs: number;
  size: number;
}

/** One located compiled file; a `sourceMap` one is remembered with the stamp of the map that proved it. */
interface Discovery {
  generatedFile: string;
  linkedBy: GeneratedFileCandidate['linkedBy'];
  mapFile?: string;
  mapMtimeMs?: number;
  mapSize?: number;
}

interface TsconfigSummary {
  dir: string;
  outDir?: string;
  rootDir?: string;
}

interface DirectoryContext {
  tsconfig?: TsconfigSummary;
  packageDir?: string;
}

const DEFAULT_OPTIONS: Required<BuildStalenessOptions> = {
  toleranceMs: 2000,
  maxMapBytes: 5 * 1024 * 1024,
  maxConfigBytes: 1024 * 1024,
  maxWalkDepth: 16,
  discoveryTtlMs: 60_000,
  contextTtlMs: 30_000
};

export class BuildStalenessChecker {
  private readonly options: Required<BuildStalenessOptions>;
  /**
   * Discovery is the expensive part (the walk and the map read) and the
   * answer rarely changes, so it is remembered per policy and source and
   * revalidated against the map's stamp on every hit, for at most
   * `discoveryTtlMs`. The two mtimes that decide staleness are read fresh on
   * every call, so a rebuild is seen at once.
   */
  private readonly discoveries: LRUCache<string, Discovery>;
  /** The keys whose candidates were all missing, for at most `discoveryTtlMs`. */
  private readonly misses: LRUCache<string, true>;
  /** The walk's answer per source directory, for at most `contextTtlMs`. */
  private readonly contexts: LRUCache<string, DirectoryContext>;

  constructor(
    private readonly fileSystem: IFileSystem,
    private readonly logger?: DebugLogger,
    options: BuildStalenessOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.discoveries = new LRUCache<string, Discovery>({ max: 50, ttl: this.options.discoveryTtlMs });
    this.misses = new LRUCache<string, true>({ max: 50, ttl: this.options.discoveryTtlMs });
    this.contexts = new LRUCache<string, DirectoryContext>({ max: 50, ttl: this.options.contextTtlMs });
  }

  /**
   * The evidence when `sourcePath` is newer than the compiled file the
   * policy's candidate names — a `sourceMap` one proved by its map, a
   * `launch` one taken from the session's current launch; undefined when the
   * policy does not compile this source, nothing matching was found, the
   * build is current, or any read failed. `launch` is what the transformed
   * launch handed the engine; without it a compiled language's policy has no
   * artefact to name and answers nothing.
   */
  async check(sourcePath: string, policy: GeneratedFilePolicy, launch?: LaunchContext): Promise<StaleBuildEvidence | undefined> {
    if (!policy.generatedFileCandidates) {
      return undefined;
    }
    // The applicability probe: no filesystem work for a source this adapter
    // binds through nothing it can name.
    const probe: GeneratedFileContext = { sourcePath, ...launch };
    const probed = policy.generatedFileCandidates(probe);
    if (probed === undefined) {
      return undefined;
    }
    // Keyed on the candidates the probe named, not on the program: a Java
    // launch keeps the `.java` as its program while the classpath — and so
    // the class file — may differ from the launch before it.
    const key = `${policy.name}\0${probed.map(candidate => candidate.path).join('\0')}\0${sourcePath}`;
    try {
      const discovery = await this.discover(key, probe, probed, policy);
      if (!discovery) {
        return undefined;
      }
      const [source, generated] = await Promise.all([this.stamp(sourcePath), this.stamp(discovery.generatedFile)]);
      if (!generated) {
        this.discoveries.delete(key);
        return undefined;
      }
      if (!source || source.mtimeMs - generated.mtimeMs <= this.options.toleranceMs) {
        return undefined;
      }
      return {
        sourceFile: sourcePath,
        sourceMtimeMs: source.mtimeMs,
        generatedFile: discovery.generatedFile,
        generatedMtimeMs: generated.mtimeMs,
        linkedBy: discovery.linkedBy,
        ...(discovery.mapFile !== undefined ? { mapFile: discovery.mapFile } : {})
      };
    } catch (error) {
      this.logger?.debug(`[BuildStaleness] check failed for ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  clearCache(): void {
    this.discoveries.clear();
    this.misses.clear();
    this.contexts.clear();
  }

  /**
   * The compiled file for this probe: the remembered one while its proof
   * stands (a `launch` discovery needs none beyond the artefact's existence,
   * which `check` reads fresh), nothing while a remembered miss stands, else
   * a fresh discovery. Candidates the launch links need no directory context,
   * so the probe's own answer serves when every candidate in it is one, and
   * the newest existing one is taken (a stale leftover beside the source is
   * never newer than the build the engine loads); otherwise the
   * tsconfig/package walk runs, the policy is asked again with it, and the
   * first candidate whose map names the source wins.
   */
  private async discover(
    key: string,
    probe: GeneratedFileContext,
    probed: GeneratedFileCandidate[],
    policy: GeneratedFilePolicy
  ): Promise<Discovery | undefined> {
    const cached = this.discoveries.get(key);
    if (cached) {
      if (cached.linkedBy === 'launch') {
        return cached;
      }
      const mapStamp = cached.mapFile !== undefined ? await this.stamp(cached.mapFile) : undefined;
      if (mapStamp && mapStamp.mtimeMs === cached.mapMtimeMs && mapStamp.size === cached.mapSize) {
        return cached;
      }
      this.discoveries.delete(key);
    }
    const launchLinked = probed.length > 0 && probed.every(candidate => candidate.linkedBy === 'launch');
    // A miss is remembered for launch-linked candidates only: there may be
    // dozens of them (every classpath directory × the source's chain) and no
    // map to re-read. A map-proved miss is retried on every check, so a map
    // that changes back to naming the source is seen at once.
    if (launchLinked && this.misses.get(key)) {
      return undefined;
    }
    const discovery = launchLinked ? await this.newestExisting(probed) : await this.firstProvedByMap(probe, policy);
    if (discovery) {
      this.discoveries.set(key, discovery);
    } else if (launchLinked) {
      this.misses.set(key, true);
    }
    return discovery;
  }

  /** The newest existing launch-linked candidate, or nothing when none exists. */
  private async newestExisting(candidates: GeneratedFileCandidate[]): Promise<Discovery | undefined> {
    let newest: { path: string; mtimeMs: number } | undefined;
    for (const candidate of candidates) {
      const stamp = await this.stamp(candidate.path);
      if (stamp && (newest === undefined || stamp.mtimeMs > newest.mtimeMs)) {
        newest = { path: candidate.path, mtimeMs: stamp.mtimeMs };
      }
    }
    return newest ? { generatedFile: newest.path, linkedBy: 'launch' } : undefined;
  }

  /** The first candidate, in the policy's order, that exists and whose `.map` names the source. */
  private async firstProvedByMap(probe: GeneratedFileContext, policy: GeneratedFilePolicy): Promise<Discovery | undefined> {
    const { sourcePath } = probe;
    const candidates = policy.generatedFileCandidates!({ ...probe, ...(await this.contextFor(path.dirname(sourcePath))) }) ?? [];
    for (const candidate of candidates) {
      if (candidate.linkedBy !== 'sourceMap' || !(await this.stamp(candidate.path))) {
        continue;
      }
      const mapFile = `${candidate.path}.map`;
      const mapStamp = await this.stamp(mapFile);
      if (!mapStamp) {
        continue;
      }
      if (mapStamp.size > this.options.maxMapBytes) {
        this.logger?.debug(`[BuildStaleness] ${mapFile} is larger than the ${this.options.maxMapBytes}-byte cap (${mapStamp.size} bytes); not read`);
        continue;
      }
      const sources = resolveMapSources(await this.fileSystem.readFile(mapFile, 'utf8'), mapFile);
      if (!sources.some(source => samePath(source, sourcePath))) {
        continue;
      }
      return {
        generatedFile: candidate.path,
        linkedBy: 'sourceMap',
        mapFile,
        mapMtimeMs: mapStamp.mtimeMs,
        mapSize: mapStamp.size
      };
    }
    return undefined;
  }

  private async contextFor(dir: string): Promise<DirectoryContext> {
    const cached = this.contexts.get(dir);
    if (cached) {
      return cached;
    }
    const context = await this.gatherContext(dir);
    this.contexts.set(dir, context);
    return context;
  }

  /**
   * The tsconfig that places this directory's output and the nearest
   * package.json directory. The nearest tsconfig is not always the one: a
   * per-directory config that only `extends` the root names no `outDir`, so
   * the walk goes on until a config with one appears (or the top), and falls
   * back to the nearest parsed config when none does.
   */
  private async gatherContext(start: string): Promise<DirectoryContext> {
    let dir = start;
    let nearest: TsconfigSummary | undefined;
    let placing: TsconfigSummary | undefined;
    let packageDir: string | undefined;
    for (let depth = 0; depth < this.options.maxWalkDepth; depth++) {
      if (!placing) {
        const file = path.join(dir, 'tsconfig.json');
        if (await this.fileSystem.pathExists(file)) {
          const parsed = await this.readTsconfig(file, dir);
          nearest ??= parsed;
          if (parsed?.outDir !== undefined) {
            placing = parsed;
          }
        }
      }
      if (packageDir === undefined && (await this.fileSystem.pathExists(path.join(dir, 'package.json')))) {
        packageDir = dir;
      }
      const parent = path.dirname(dir);
      if ((placing && packageDir !== undefined) || parent === dir) {
        break;
      }
      dir = parent;
    }
    const tsconfig = placing ?? nearest;
    return { ...(tsconfig ? { tsconfig } : {}), ...(packageDir !== undefined ? { packageDir } : {}) };
  }

  private async readTsconfig(file: string, dir: string): Promise<TsconfigSummary | undefined> {
    const stamp = await this.stamp(file);
    if (!stamp || stamp.size > this.options.maxConfigBytes) {
      return undefined;
    }
    const parsed = parseJsonc<{ compilerOptions?: { outDir?: unknown; rootDir?: unknown } }>(
      await this.fileSystem.readFile(file, 'utf8')
    );
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }
    const options = parsed.compilerOptions;
    return {
      dir,
      ...(typeof options?.outDir === 'string' ? { outDir: options.outDir } : {}),
      ...(typeof options?.rootDir === 'string' ? { rootDir: options.rootDir } : {})
    };
  }

  /** The file's mtime and size, or undefined when it is missing or the stat carries no finite mtime. */
  private async stamp(file: string): Promise<FileStamp | undefined> {
    try {
      const stats = await this.fileSystem.stat(file);
      const mtimeMs = stats?.mtimeMs;
      const size = stats?.size;
      if (typeof mtimeMs !== 'number' || !Number.isFinite(mtimeMs)) {
        return undefined;
      }
      return { mtimeMs, size: typeof size === 'number' ? size : 0 };
    } catch {
      return undefined;
    }
  }
}

export function createBuildStalenessChecker(
  fileSystem: IFileSystem,
  logger?: DebugLogger,
  options?: BuildStalenessOptions
): BuildStalenessChecker {
  return new BuildStalenessChecker(fileSystem, logger, options);
}

/** The index just past the string literal that opens at `start` (which must be a quote). */
function skipString(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length && text[i] !== '"') {
    i += text[i] === '\\' ? 2 : 1;
  }
  return Math.min(i + 1, text.length);
}

/**
 * JSONC (what tsconfig.json is) to a value: line and block comments outside
 * strings and trailing commas are removed, then JSON.parse; undefined when
 * the rest is not JSON. `typescript` is not a runtime dependency, so its own
 * parser is not available here.
 */
export function parseJsonc<T = unknown>(text: string): T | undefined {
  let stripped = '';
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (ch === '"') {
      const end = skipString(text, i);
      stripped += text.slice(i, end);
      i = end;
    } else if (ch === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      stripped += ch;
      i++;
    }
  }
  let json = '';
  for (let i = 0; i < stripped.length;) {
    const ch = stripped[i];
    if (ch === '"') {
      const end = skipString(stripped, i);
      json += stripped.slice(i, end);
      i = end;
    } else if (ch === ',') {
      let j = i + 1;
      while (j < stripped.length && /\s/.test(stripped[j])) {
        j++;
      }
      if (stripped[j] !== '}' && stripped[j] !== ']') {
        json += ch;
      }
      i++;
    } else {
      json += ch;
      i++;
    }
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

/**
 * A source map's `sources`, as absolute paths: relative entries resolved
 * against `sourceRoot` and the map's directory (join semantics, as the
 * source-map consumers apply), `file:` URLs converted, percent escapes
 * decoded, and entries under any other scheme (`webpack://`, `data:`)
 * dropped. Nothing for a map that is not JSON or has no `sources` array.
 */
export function resolveMapSources(mapText: string, mapPath: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(mapText);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }
  const { sources, sourceRoot } = parsed as { sources?: unknown; sourceRoot?: unknown };
  if (!Array.isArray(sources)) {
    return [];
  }
  const root = typeof sourceRoot === 'string' ? sourceRoot : '';
  const mapDir = path.dirname(mapPath);
  const resolved: string[] = [];
  for (const entry of sources) {
    if (typeof entry !== 'string' || entry === '') {
      continue;
    }
    // A scheme longer than one character; a lone letter is a Windows drive.
    const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]+):/.exec(entry)?.[1]?.toLowerCase();
    if (scheme === 'file') {
      try {
        resolved.push(fileURLToPath(entry));
      } catch {
        // Not a usable file URL; skip the entry.
      }
      continue;
    }
    if (scheme !== undefined) {
      continue;
    }
    let decoded = entry;
    try {
      decoded = decodeURIComponent(entry);
    } catch {
      // Keep the raw entry when it is not valid percent-encoding.
    }
    resolved.push(path.resolve(mapDir, root, decoded));
  }
  return resolved;
}
