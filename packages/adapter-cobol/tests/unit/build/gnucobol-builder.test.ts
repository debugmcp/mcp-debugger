/**
 * Unit tests for GnuCobolBuilder (issue #759).
 *
 * cobc never runs: a fake `spawnFn` writes the files a real compile would leave
 * in the artifact directory (`<base>.c`, the listing, the output) and emits
 * `close` with the exit code the test chooses. The manifest parser is mocked to
 * return a canned manifest so the copybook-recording and diagnostics paths are
 * exercised without real generated C. Everything lands in a per-test temp dir.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

vi.mock('../../../src/manifest/index.js', () => ({
  parseGeneratedC: vi.fn()
}));

import { parseGeneratedC } from '../../../src/manifest/index.js';
import type { CobolManifest, CobolManifestDiagnostic } from '../../../src/manifest/schema.js';
import type { CobcLocation } from '../../../src/build/cobc-locator.js';
import {
  GnuCobolBuilder,
  cobcArguments,
  copybooksFromPreprocessed,
  isCobolSourceFile,
  isCobolTextFile,
  moduleExtension,
  executableExtension,
  ARTIFACT_ROOT_DIRNAME,
  MANIFEST_SUFFIX,
  MANIFEST_INDEX_NAME,
  BUILD_INFO_NAME,
  LATEST_POINTER_NAME,
  KEEP_ARTIFACT_DIRS,
  C_COMPILE_FLAGS,
  type CobolBuildRequest,
  type ManifestIndex,
  type SpawnLike
} from '../../../src/build/gnucobol-builder.js';

const BANNER = 'cobc (GnuCOBOL) 3.2.0';
const NOW = new Date('2026-09-19T12:00:00.000Z');

interface SpawnPlan {
  /** Exit code emitted on `close` (default 0). */
  code?: number;
  /** Never emit `close` (timeout tests). */
  never?: boolean;
  /** Make `spawnFn` itself throw. */
  throwOnSpawn?: Error;
  /** Emit `error` on the child instead of `close`. */
  emitError?: Error;
  stdout?: string;
  stderr?: string;
  /** Write the `-o` output (default true). */
  writeOutput?: boolean;
  /** Write `<base>.c` for every source (default true). */
  writeC?: boolean;
  /** Write the `-t` listing (default true). */
  writeListing?: boolean;
}

interface SpawnCall {
  command: string;
  args: string[];
  options: Parameters<SpawnLike>[2];
}

interface FakeSpawn {
  spawnFn: SpawnLike;
  calls: SpawnCall[];
  kill: Mock<() => void>;
}

/** A cobc stand-in that leaves behind what the builder expects to find in the cwd it was given. */
function fakeSpawn(plan: SpawnPlan = {}): FakeSpawn {
  const calls: SpawnCall[] = [];
  const kill = vi.fn<() => void>();
  const spawnFn: SpawnLike = (command, args, options) => {
    calls.push({ command, args, options });
    if (plan.throwOnSpawn) {
      throw plan.throwOnSpawn;
    }
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = new EventEmitter();
    setImmediate(() => {
      if (plan.emitError) {
        child.emit('error', plan.emitError);
        return;
      }
      if (plan.stdout) {
        stdout.emit('data', Buffer.from(plan.stdout));
      }
      if (plan.stderr) {
        stderr.emit('data', Buffer.from(plan.stderr));
      }
      if (plan.never) {
        return;
      }
      const outputIndex = args.indexOf('-o');
      const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
      const listingPath = args[args.indexOf('-t') + 1];
      if (plan.writeC !== false) {
        for (const source of args.filter((a) => isCobolSourceFile(a))) {
          fs.writeFileSync(path.join(options.cwd, `${path.basename(source, path.extname(source))}.c`), `/* generated from ${source} */`);
        }
      }
      if (plan.writeListing !== false) {
        fs.writeFileSync(listingPath, 'LISTING');
      }
      if (plan.writeOutput !== false && outputPath) {
        fs.writeFileSync(outputPath, 'BINARY');
      }
      child.emit('close', plan.code ?? 0);
    });
    return {
      stdout: stdout as unknown as NodeJS.ReadableStream,
      stderr: stderr as unknown as NodeJS.ReadableStream,
      on: (event, listener) => child.on(event, listener),
      kill
    };
  };
  return { spawnFn, calls, kill };
}

function cannedManifest(sourcePath: string, copybookPath: string | undefined, diagnostics: CobolManifestDiagnostic[] = []): CobolManifest {
  return {
    schemaVersion: 1,
    generator: { cobcVersion: BANNER, argv: [], dumpComments: true, generatedAt: NOW.toISOString(), platform: 'linux', arch: 'x64' },
    sources: [
      { id: 0, path: sourcePath, kind: 'program' },
      ...(copybookPath ? [{ id: 1, path: copybookPath, kind: 'copybook' as const }] : [])
    ],
    programs: [],
    diagnostics
  };
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

describe('pure helpers', () => {
  it('recognises launchable COBOL sources by extension, case-insensitively', () => {
    expect(isCobolSourceFile('/x/hello.cob')).toBe(true);
    expect(isCobolSourceFile('C:\\x\\HELLO.CBL')).toBe(true);
    expect(isCobolSourceFile('/x/hello.cobol')).toBe(true);
    expect(isCobolSourceFile('/x/copy.cpy')).toBe(false);
    expect(isCobolSourceFile('/x/copy.copy')).toBe(false);
    expect(isCobolSourceFile('/x/hello.c')).toBe(false);
    expect(isCobolSourceFile('/x/hello.exe')).toBe(false);
    expect(isCobolSourceFile('/x/hello')).toBe(false);
  });

  it('counts copybooks as COBOL text but not as sources', () => {
    expect(isCobolTextFile('/x/copy.cpy')).toBe(true);
    expect(isCobolTextFile('/x/copy.COPY')).toBe(true);
    expect(isCobolTextFile('/x/hello.cob')).toBe(true);
    expect(isCobolTextFile('/x/hello.c')).toBe(false);
  });

  it('picks the platform extensions for modules and executables', () => {
    expect(moduleExtension('win32')).toBe('.dll');
    expect(moduleExtension('darwin')).toBe('.dylib');
    expect(moduleExtension('linux')).toBe('.so');
    expect(executableExtension('win32')).toBe('.exe');
    expect(executableExtension('linux')).toBe('');
    expect(executableExtension('darwin')).toBe('');
  });

  it('keeps the artifact naming constants where the shim and docs expect them', () => {
    expect(ARTIFACT_ROOT_DIRNAME).toBe(path.join('.debug-mcp', 'cobol'));
    expect(MANIFEST_SUFFIX).toBe('.cobol-symbols.json');
    expect(MANIFEST_INDEX_NAME).toBe('manifest-index.json');
    expect(BUILD_INFO_NAME).toBe('build.json');
    expect(LATEST_POINTER_NAME).toBe('latest.json');
    expect(KEEP_ARTIFACT_DIRS).toBe(3);
    expect(C_COMPILE_FLAGS).toBe('-O0 -gdwarf-4');
  });
});

describe('cobcArguments', () => {
  const sources = ['/src/hello.cob', '/src/sub.cob'];

  it('builds the full executable argv in the documented order', () => {
    const request: CobolBuildRequest = {
      program: '/src/hello.cob',
      mode: 'executable',
      dialect: 'ibm',
      format: 'free',
      copybookDirs: ['/cpy', '/cpy2'],
      runtimeChecks: true,
      cobcFlags: ['-Wall', '-O2']
    };

    expect(cobcArguments(request, '/out/hello', '/out/hello.lst', sources)).toEqual([
      '-x',
      '-g', '-fdump=ALL', '--save-temps', '-t', '/out/hello.lst', '-ftsymbols', '-A', '-O0 -gdwarf-4',
      '-std=ibm',
      '-free',
      '-I', '/cpy', '-I', '/cpy2',
      '-I', '/src',
      '--debug',
      '-Wall', '-O2',
      '-o', '/out/hello',
      '/src/hello.cob', '/src/sub.cob'
    ]);
  });

  it('uses -m for modules and -C (no -o) for manifest-only translation', () => {
    expect(cobcArguments({ program: '/src/mod.cob', mode: 'module' }, '/out/mod.so', '/out/mod.lst', ['/src/mod.cob'])).toEqual([
      '-m', '-g', '-fdump=ALL', '--save-temps', '-t', '/out/mod.lst', '-ftsymbols', '-A', '-O0 -gdwarf-4', '-I', '/src', '-o', '/out/mod.so', '/src/mod.cob'
    ]);
    expect(cobcArguments({ program: '/bin/app', mode: 'manifest-only', sources }, undefined, '/out/app.lst', sources)).toEqual([
      '-C', '-g', '-fdump=ALL', '--save-temps', '-t', '/out/app.lst', '-ftsymbols', '-A', '-O0 -gdwarf-4', '-I', '/src', '/src/hello.cob', '/src/sub.cob'
    ]);
  });

  it('emits -fixed for fixed format and nothing when the format is left to cobc', () => {
    expect(cobcArguments({ program: '/src/a.cob', mode: 'executable', format: 'fixed' }, '/o/a', '/o/a.lst', ['/src/a.cob'])).toContain('-fixed');
    const noFormat = cobcArguments({ program: '/src/a.cob', mode: 'executable' }, '/o/a', '/o/a.lst', ['/src/a.cob']);
    expect(noFormat).not.toContain('-fixed');
    expect(noFormat).not.toContain('-free');
    expect(noFormat.some((a) => a.startsWith('-std='))).toBe(false);
    expect(noFormat).not.toContain('--debug');
  });

  it('places the user\'s cobcFlags after ours so they can override', () => {
    const args = cobcArguments({ program: '/src/a.cob', mode: 'executable', runtimeChecks: true, cobcFlags: ['-A', '-O1'] }, '/o/a', '/o/a.lst', ['/src/a.cob']);
    expect(args.lastIndexOf('-A')).toBeGreaterThan(args.indexOf('--debug'));
    expect(args.indexOf('-o')).toBeGreaterThan(args.lastIndexOf('-O1'));
  });
});

describe('GnuCobolBuilder', () => {
  let tmp: string;
  let srcDir: string;
  let program: string;
  let copybook: string;
  let artifactRoot: string;
  let cobc: CobcLocation;
  let logger: { info: Mock<(message: string) => void>; warn: Mock<(message: string) => void>; debug: Mock<(message: string) => void> };

  const makeBuilder = (spawn: FakeSpawn, overrides: Partial<ConstructorParameters<typeof GnuCobolBuilder>[0]> = {}): GnuCobolBuilder =>
    new GnuCobolBuilder({
      cobc,
      platform: 'linux',
      env: { PATH: '/usr/bin' },
      logger,
      spawnFn: spawn.spawnFn,
      now: () => NOW,
      ...overrides
    });

  const exeRequest = (overrides: Partial<CobolBuildRequest> = {}): CobolBuildRequest => ({
    program,
    mode: 'executable',
    artifactRoot,
    ...overrides
  });

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cobol-builder-'));
    srcDir = path.join(tmp, 'src');
    fs.mkdirSync(srcDir);
    program = path.join(srcDir, 'hello.cob');
    copybook = path.join(srcDir, 'copy.cpy');
    fs.writeFileSync(program, '       IDENTIFICATION DIVISION.\n       PROGRAM-ID. HELLO.\n');
    fs.writeFileSync(copybook, '       01 WS-REC PIC X(10).\n');
    artifactRoot = path.join(tmp, 'artifacts');
    const prefix = path.join(tmp, 'gnucobol');
    cobc = {
      path: path.join(prefix, 'bin', 'cobc'),
      binDir: path.join(prefix, 'bin'),
      prefix,
      versionLine: BANNER,
      version: '3.2.0',
      configDir: path.join(prefix, 'share', 'gnucobol', 'config')
    };
    logger = { info: vi.fn<(message: string) => void>(), warn: vi.fn<(message: string) => void>(), debug: vi.fn<(message: string) => void>() };
    mockManifests(copybook);
  });

  /** Make the parser return the canned manifest for whichever `.c` it is handed, with or without the copybook. */
  const mockManifests = (copybookPath: string | undefined): void => {
    vi.mocked(parseGeneratedC).mockImplementation((input) => {
      const base = path.basename(input.cPath, '.c');
      return cannedManifest(path.join(srcDir, `${base}.cob`), copybookPath);
    });
  };

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe('layout helpers', () => {
    it('defaults the artifact root to .debug-mcp/cobol next to the program', () => {
      const builder = makeBuilder(fakeSpawn());
      expect(builder.programArtifactRoot({ program, mode: 'executable' })).toBe(path.join(srcDir, '.debug-mcp', 'cobol', 'hello'));
    });

    it('honours an explicit artifactRoot and outputName', () => {
      const builder = makeBuilder(fakeSpawn());
      expect(builder.programArtifactRoot(exeRequest())).toBe(path.join(artifactRoot, 'hello'));
      expect(builder.programArtifactRoot(exeRequest({ outputName: 'app' }))).toBe(path.join(artifactRoot, 'app'));
      expect(builder.outputName({ program: '/x/app.exe', mode: 'manifest-only' })).toBe('app');
    });

    it('builds the compile environment: cobc bin dir on PATH, config dir pinned, dump comments on', () => {
      const env = makeBuilder(fakeSpawn()).buildEnvironment();
      expect(env.PATH).toBe([cobc.binDir, '/usr/bin'].join(path.delimiter));
      expect(env.COB_CONFIG_DIR).toBe(cobc.configDir);
      expect(env.COBC_GEN_DUMP_COMMENTS).toBe('1');
    });
  });

  describe('executable build', () => {
    it('runs cobc in the key directory with the full argv and records every artifact', async () => {
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);

      const result = await builder.build(exeRequest({ dialect: 'ibm', format: 'free', copybookDirs: [srcDir], runtimeChecks: true, cobcFlags: ['-Wall'] }));

      expect(result.success).toBe(true);
      expect(result.compiled).toBe(true);
      expect(result.buildKey).toMatch(/^[0-9a-f]{12}$/);
      const artifactDir = path.join(artifactRoot, 'hello', result.buildKey);
      const outputPath = path.join(artifactDir, 'hello');
      const listingPath = path.join(artifactDir, 'hello.lst');
      expect(result.artifactDir).toBe(artifactDir);
      expect(result.binaryPath).toBe(outputPath);
      expect(result.diagnostics).toEqual([]);
      expect(result.error).toBeUndefined();

      expect(spawn.calls).toHaveLength(1);
      const [call] = spawn.calls;
      expect(call.command).toBe(cobc.path);
      expect(call.args).toEqual([
        '-x', '-g', '-fdump=ALL', '--save-temps', '-t', listingPath, '-ftsymbols', '-A', '-O0 -gdwarf-4',
        '-std=ibm', '-free', '-I', srcDir, '--debug', '-Wall', '-o', outputPath, program
      ]);
      expect(result.argv).toEqual(call.args);
      expect(call.options.cwd).toBe(artifactDir);
      expect(call.options.windowsHide).toBe(true);
      expect(call.options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
      expect(call.options.env.COBC_GEN_DUMP_COMMENTS).toBe('1');
      expect(call.options.env.PATH).toBe([cobc.binDir, '/usr/bin'].join(path.delimiter));
      expect(call.options.env.COB_CONFIG_DIR).toBe(cobc.configDir);

      const manifestPath = path.join(artifactDir, `hello${MANIFEST_SUFFIX}`);
      expect(result.manifestPaths).toEqual([manifestPath]);
      expect(result.manifests).toEqual([cannedManifest(program, copybook)]);
      expect(readJson<CobolManifest>(manifestPath)).toEqual(cannedManifest(program, copybook));
      expect(parseGeneratedC).toHaveBeenCalledWith({
        cPath: path.join(artifactDir, 'hello.c'),
        lstPath: listingPath,
        generator: {
          cobcVersion: BANNER,
          cobcPath: cobc.path,
          argv: call.args,
          dialect: 'ibm',
          format: 'free',
          buildKey: result.buildKey,
          generatedAt: NOW.toISOString(),
          platform: 'linux',
          arch: process.arch,
          dumpComments: true
        }
      });

      expect(readJson<ManifestIndex>(path.join(artifactDir, MANIFEST_INDEX_NAME))).toEqual({
        buildKey: result.buildKey,
        contentKey: expect.stringMatching(/^[0-9a-f]{12}$/),
        outputName: 'hello',
        mode: 'executable',
        binary: outputPath,
        manifests: [manifestPath],
        copybooks: [copybook],
        cobcVersion: BANNER,
        generatedAt: NOW.toISOString()
      });
      expect(readJson<Record<string, unknown>>(path.join(artifactDir, BUILD_INFO_NAME))).toEqual({
        buildKey: result.buildKey,
        argv: call.args,
        cobc: cobc.path,
        cobcVersion: BANNER,
        sources: [program],
        generatedAt: NOW.toISOString()
      });
      expect(readJson<Record<string, unknown>>(path.join(artifactRoot, 'hello', LATEST_POINTER_NAME))).toEqual({
        key: result.buildKey,
        artifactDir,
        binaryPath: outputPath,
        updatedAt: NOW.toISOString()
      });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`${cobc.path} -x -g`));
    });

    it('records format "auto" for the parser when no format was requested', async () => {
      await makeBuilder(fakeSpawn()).build(exeRequest());
      expect(parseGeneratedC).toHaveBeenCalledWith(expect.objectContaining({
        generator: expect.objectContaining({ format: 'auto', dialect: undefined })
      }));
    });

    it('names the output with the platform extension (.exe on win32, .dll for modules)', async () => {
      const win = await makeBuilder(fakeSpawn(), { platform: 'win32' }).build(exeRequest());
      expect(path.basename(win.binaryPath ?? '')).toBe('hello.exe');
      expect(win.argv[win.argv.indexOf('-o') + 1]).toBe(win.binaryPath);

      const dll = await makeBuilder(fakeSpawn(), { platform: 'win32' }).build(exeRequest({ mode: 'module' }));
      expect(path.basename(dll.binaryPath ?? '')).toBe('hello.dll');
      expect(dll.argv[0]).toBe('-m');

      const so = await makeBuilder(fakeSpawn(), { platform: 'linux' }).build(exeRequest({ mode: 'module' }));
      expect(path.basename(so.binaryPath ?? '')).toBe('hello.so');

      const dylib = await makeBuilder(fakeSpawn(), { platform: 'darwin' }).build(exeRequest({ mode: 'module' }));
      expect(path.basename(dylib.binaryPath ?? '')).toBe('hello.dylib');
    });

    it('passes absolute, de-duplicated sources with the program first', async () => {
      const sub = path.join(srcDir, 'sub.cob');
      fs.writeFileSync(sub, '       PROGRAM-ID. SUB.\n');
      const spawn = fakeSpawn();

      const result = await makeBuilder(spawn).build(exeRequest({ sources: [sub, program] }));

      expect(spawn.calls[0].args.slice(-2)).toEqual([program, sub]);
      expect(result.manifestPaths.map((p) => path.basename(p))).toEqual([`hello${MANIFEST_SUFFIX}`, `sub${MANIFEST_SUFFIX}`]);
    });

    it('does not depend on where the artifacts land for the build key', async () => {
      const a = await makeBuilder(fakeSpawn()).build(exeRequest({ artifactRoot: path.join(tmp, 'a') }));
      const b = await makeBuilder(fakeSpawn()).build(exeRequest({ artifactRoot: path.join(tmp, 'b') }));
      expect(a.buildKey).toBe(b.buildKey);
    });

    it('derives a different key for different flags, a different compiler or a different platform', async () => {
      const base = await makeBuilder(fakeSpawn()).build(exeRequest());
      const debug = await makeBuilder(fakeSpawn()).build(exeRequest({ runtimeChecks: true }));
      const other = await makeBuilder(fakeSpawn(), { cobc: { ...cobc, versionLine: 'cobc (GnuCOBOL) 3.1.2.0' } }).build(exeRequest());
      const win = await makeBuilder(fakeSpawn(), { platform: 'win32' }).build(exeRequest());
      expect(debug.buildKey).not.toBe(base.buildKey);
      expect(other.buildKey).not.toBe(base.buildKey);
      expect(win.buildKey).not.toBe(base.buildKey);
    });
  });

  describe('reuse and staleness', () => {
    // Plain reuse is exercised on a program without copybooks, where the artifact
    // directory name (probe key) and the content key coincide. The copybook case,
    // where they legitimately differ, has its own test below.
    beforeEach(() => mockManifests(undefined));

    it('reuses a fresh artifact without running cobc, reading the manifests back from disk', async () => {
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);
      const first = await builder.build(exeRequest());
      expect(readJson<ManifestIndex>(path.join(first.artifactDir ?? '', MANIFEST_INDEX_NAME)).contentKey).toBe(first.buildKey);

      const second = await builder.build(exeRequest());

      expect(spawn.calls).toHaveLength(1);
      expect(second).toEqual({ ...first, compiled: false, diagnostics: [] });
      expect(second.manifests).toEqual([cannedManifest(program, undefined)]);
      expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Reusing artifacts .* \(build key [0-9a-f]{12}, unchanged inputs\)/));
    });

    it('never reuses an artifact built for another platform, even from the same workspace', async () => {
      const spawn = fakeSpawn();
      const linux = await makeBuilder(spawn).build(exeRequest());

      const win = await makeBuilder(spawn, { platform: 'win32' }).build(exeRequest());

      expect(win.compiled).toBe(true);
      expect(win.buildKey).not.toBe(linux.buildKey);
      expect(win.artifactDir).not.toBe(linux.artifactDir);
      expect(path.basename(win.binaryPath ?? '')).toBe('hello.exe');
      expect(spawn.calls).toHaveLength(2);
    });

    it('rebuilds under the same key but into a fresh directory when forceRebuild is set', async () => {
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);
      const first = await builder.build(exeRequest());

      const second = await builder.build(exeRequest({ forceRebuild: true }));

      expect(spawn.calls).toHaveLength(2);
      expect(second.compiled).toBe(true);
      expect(second.buildKey).toBe(first.buildKey);
      // Never in place: a paused session may still hold the first executable.
      expect(second.artifactDir).not.toBe(first.artifactDir);
      expect(path.basename(second.artifactDir ?? '')).toBe(`${first.buildKey}-2`);
      expect(fs.existsSync(first.binaryPath ?? '')).toBe(true);
      expect(readJson<{ artifactDir: string }>(path.join(artifactRoot, 'hello', LATEST_POINTER_NAME)).artifactDir).toBe(second.artifactDir);
    });

    it('changes the build key when copybookDirs change: the -I value is part of the key', async () => {
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);
      const v1 = await builder.build(exeRequest({ copybookDirs: [path.join(tmp, 'cpy-v1')] }));
      const v2 = await builder.build(exeRequest({ copybookDirs: [path.join(tmp, 'cpy-v2')] }));

      expect(v2.compiled).toBe(true);
      expect(v2.buildKey).not.toBe(v1.buildKey);
      expect(spawn.calls).toHaveLength(2);
    });

    it('reads every existing copybook out of a preprocessed .i, paths verbatim', () => {
      const copybook = path.join(tmp, 'linkrec.cpy');
      fs.writeFileSync(copybook, '       01  LK-REC PIC X(10).\n');
      const preprocessed = path.join(tmp, 'hello.i');
      fs.writeFileSync(
        preprocessed,
        [`#line 1 "${copybook}"`, '       01  LK-REC PIC X(10).', '#line 1 "/no/such/other.cpy"', '#line 9 "not-a-directive', ''].join('\n')
      );

      expect(copybooksFromPreprocessed(preprocessed)).toEqual([path.resolve(copybook)]);
      expect(copybooksFromPreprocessed(path.join(tmp, 'missing.i'))).toEqual([]);
    });

    it('compiles into a new key directory when the source changes and keeps the old one', async () => {
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);
      const first = await builder.build(exeRequest());
      fs.appendFileSync(program, '       PROCEDURE DIVISION.\n');

      const second = await builder.build(exeRequest());

      expect(spawn.calls).toHaveLength(2);
      expect(second.buildKey).not.toBe(first.buildKey);
      expect(fs.existsSync(first.artifactDir ?? '')).toBe(true);
      expect(readJson<{ key: string }>(path.join(artifactRoot, 'hello', LATEST_POINTER_NAME)).key).toBe(second.buildKey);
    });

    it('records the copybooks it discovered in a content key: an unchanged relaunch reuses, a copybook edit rebuilds', async () => {
      mockManifests(copybook);
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);

      const first = await builder.build(exeRequest());
      const index = readJson<ManifestIndex>(path.join(first.artifactDir ?? '', MANIFEST_INDEX_NAME));
      expect(index.copybooks).toEqual([copybook]);
      // The directory is named by the probe key (sources only: the copybook was
      // unknown before cobc ran); the content key covers sources + copybook.
      expect(index.contentKey).toMatch(/^[0-9a-f]{12}$/);
      expect(index.contentKey).not.toBe(first.buildKey);

      const unchanged = await builder.build(exeRequest());
      expect(unchanged.compiled).toBe(false);
      expect(unchanged.artifactDir).toBe(first.artifactDir);
      expect(unchanged.buildKey).toBe(first.buildKey);
      expect(unchanged.binaryPath).toBe(first.binaryPath);
      expect(unchanged.manifests).toEqual([cannedManifest(program, copybook)]);
      expect(spawn.calls).toHaveLength(1);

      fs.writeFileSync(copybook, '       01 WS-REC PIC X(20).\n');
      const edited = await builder.build(exeRequest());

      expect(edited.compiled).toBe(true);
      expect(edited.buildKey).not.toBe(first.buildKey);
      expect(edited.artifactDir).not.toBe(first.artifactDir);
      expect(spawn.calls).toHaveLength(2);
      expect(readJson<{ artifactDir: string }>(path.join(artifactRoot, 'hello', LATEST_POINTER_NAME)).artifactDir).toBe(edited.artifactDir);
    });

    it('does not reuse across a forced rebuild even when the content key matches', async () => {
      mockManifests(copybook);
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);
      await builder.build(exeRequest());

      const forced = await builder.build(exeRequest({ forceRebuild: true }));

      expect(forced.compiled).toBe(true);
      expect(spawn.calls).toHaveLength(2);
    });

    it('recompiles when the binary went missing from a fresh key directory', async () => {
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);
      const first = await builder.build(exeRequest());
      fs.rmSync(first.binaryPath ?? '');

      const second = await builder.build(exeRequest());

      expect(second.compiled).toBe(true);
      expect(second.buildKey).toBe(first.buildKey);
      expect(spawn.calls).toHaveLength(2);
    });

    it('recompiles when a recorded manifest went missing', async () => {
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);
      const first = await builder.build(exeRequest());
      fs.rmSync(first.manifestPaths[0]);

      const second = await builder.build(exeRequest());

      expect(second.compiled).toBe(true);
      expect(spawn.calls).toHaveLength(2);
    });

    it('prunes older key directories down to the newest three including the current one', async () => {
      const programRoot = path.join(artifactRoot, 'hello');
      fs.mkdirSync(programRoot, { recursive: true });
      const stale = ['aaaaaaaaaaa1', 'aaaaaaaaaaa2', 'aaaaaaaaaaa3', 'aaaaaaaaaaa4'];
      stale.forEach((name, index) => {
        const dir = path.join(programRoot, name);
        fs.mkdirSync(dir);
        const when = new Date(NOW.getTime() - (stale.length - index) * 60_000);
        fs.utimesSync(dir, when, when);
      });
      fs.writeFileSync(path.join(programRoot, 'stray.txt'), 'not a dir');

      const result = await makeBuilder(fakeSpawn()).build(exeRequest());

      const remaining = fs.readdirSync(programRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
      expect(remaining).toEqual(['aaaaaaaaaaa3', 'aaaaaaaaaaa4', result.buildKey].sort());
      expect(fs.existsSync(path.join(programRoot, 'stray.txt'))).toBe(true);
    });
  });

  describe('manifest-only build', () => {
    let exe: string;
    beforeEach(() => {
      exe = path.join(tmp, 'bin', 'app');
      fs.mkdirSync(path.dirname(exe));
      fs.writeFileSync(exe, 'PREBUILT');
    });

    it('translates the sources with -C, leaves the prebuilt binary alone and points at it', async () => {
      const spawn = fakeSpawn();

      const result = await makeBuilder(spawn).build({ program: exe, sources: [program], mode: 'manifest-only', artifactRoot });

      expect(result.success).toBe(true);
      expect(result.binaryPath).toBe(exe);
      expect(fs.readFileSync(exe, 'utf8')).toBe('PREBUILT');
      const artifactDir = path.join(artifactRoot, 'app', result.buildKey);
      expect(result.artifactDir).toBe(artifactDir);
      expect(spawn.calls[0].args).toEqual([
        '-C', '-g', '-fdump=ALL', '--save-temps', '-t', path.join(artifactDir, 'app.lst'), '-ftsymbols', '-A', '-O0 -gdwarf-4', '-I', path.dirname(program), program
      ]);
      expect(spawn.calls[0].args).not.toContain('-o');
      expect(readJson<ManifestIndex>(path.join(artifactDir, MANIFEST_INDEX_NAME))).toMatchObject({ mode: 'manifest-only', binary: exe, outputName: 'app' });
      expect(result.manifestPaths).toEqual([path.join(artifactDir, `hello${MANIFEST_SUFFIX}`)]);
    });

    it('reuses a fresh manifest-only artifact without needing an output binary', async () => {
      mockManifests(undefined);
      const spawn = fakeSpawn();
      const builder = makeBuilder(spawn);
      await builder.build({ program: exe, sources: [program], mode: 'manifest-only', artifactRoot });

      const again = await builder.build({ program: exe, sources: [program], mode: 'manifest-only', artifactRoot });

      expect(again.compiled).toBe(false);
      expect(again.binaryPath).toBe(exe);
      expect(spawn.calls).toHaveLength(1);
    });

    it('rejects a manifest-only request with no sources', async () => {
      await expect(makeBuilder(fakeSpawn()).build({ program: exe, mode: 'manifest-only', artifactRoot }))
        .rejects.toThrow(/at least one COBOL source in `sources`/);
    });
  });

  describe('diagnostics', () => {
    it('forwards compiler warnings on stderr as a sanitized diagnostic even when the build succeeds', async () => {
      const result = await makeBuilder(fakeSpawn({ stderr: 'hello.cob:3: warning: numeric value is expected\n' })).build(exeRequest());

      expect(result.success).toBe(true);
      expect(result.diagnostics).toEqual([expect.stringContaining('warning: numeric value is expected')]);
    });

    it('surfaces manifest diagnostics as "<level>: <message>"', async () => {
      vi.mocked(parseGeneratedC).mockImplementation(() =>
        cannedManifest(program, copybook, [{ level: 'warn', message: 'no listing symbol table' }, { level: 'error', message: 'unparsed dump call' }])
      );

      const result = await makeBuilder(fakeSpawn()).build(exeRequest());

      expect(result.success).toBe(true);
      expect(result.diagnostics).toEqual(['warn: no listing symbol table', 'error: unparsed dump call']);
    });

    it('reports a source whose generated C never appeared and still succeeds', async () => {
      const result = await makeBuilder(fakeSpawn({ writeC: false })).build(exeRequest());

      expect(result.success).toBe(true);
      expect(result.manifestPaths).toEqual([]);
      expect(result.diagnostics).toEqual([expect.stringMatching(/^No generated C for .*hello\.cob at .*hello\.c; COBOL variables for that program will be unavailable\.$/)]);
      expect(parseGeneratedC).not.toHaveBeenCalled();
      expect(readJson<ManifestIndex>(path.join(result.artifactDir ?? '', MANIFEST_INDEX_NAME)).manifests).toEqual([]);
    });

    it('turns a manifest parse failure into a diagnostic instead of failing the build', async () => {
      vi.mocked(parseGeneratedC).mockImplementation(() => {
        throw new Error('dump routine not found');
      });

      const result = await makeBuilder(fakeSpawn()).build(exeRequest());

      expect(result.success).toBe(true);
      expect(result.manifests).toEqual([]);
      expect(result.diagnostics).toEqual([expect.stringMatching(/^Manifest parse failed for .*hello\.c: dump routine not found$/)]);
    });

    it('omits the listing from the parser input when cobc produced none', async () => {
      await makeBuilder(fakeSpawn({ writeListing: false })).build(exeRequest());
      expect(parseGeneratedC).toHaveBeenCalledWith(expect.objectContaining({ lstPath: undefined }));
    });
  });

  describe('failure paths', () => {
    const expectFailure = (result: Awaited<ReturnType<GnuCobolBuilder['build']>>): void => {
      expect(result.success).toBe(false);
      expect(result.compiled).toBe(true);
      expect(result.binaryPath).toBeUndefined();
      expect(result.manifestPaths).toEqual([]);
      expect(result.manifests).toEqual([]);
      expect(result.buildKey).toMatch(/^[0-9a-f]{12}$/);
      expect(result.artifactDir).toBe(path.join(artifactRoot, 'hello', result.buildKey));
      expect(fs.existsSync(path.join(result.artifactDir ?? '', MANIFEST_INDEX_NAME))).toBe(false);
      expect(fs.existsSync(path.join(artifactRoot, 'hello', LATEST_POINTER_NAME))).toBe(false);
    };

    it('reports a compiler that could not be started', async () => {
      const result = await makeBuilder(fakeSpawn({ throwOnSpawn: new Error('spawn ENOENT') })).build(exeRequest());

      expectFailure(result);
      expect(result.error).toBe('Failed to start cobc: spawn ENOENT');
    });

    it('reports a child that errored instead of closing', async () => {
      const result = await makeBuilder(fakeSpawn({ emitError: new Error('EACCES') })).build(exeRequest());

      expectFailure(result);
      expect(result.error).toBe('Failed to start cobc: EACCES');
    });

    it('reports a non-zero exit with the sanitized stderr tail', async () => {
      const result = await makeBuilder(fakeSpawn({ code: 1, stderr: 'hello.cob:2: error: syntax error, unexpected PROGRAM-ID\n', writeOutput: false })).build(exeRequest());

      expectFailure(result);
      expect(result.error).toMatch(/^cobc exited with code 1: .*syntax error, unexpected PROGRAM-ID/);
      expect(result.diagnostics).toEqual([expect.stringContaining('syntax error')]);
    });

    it('falls back to stdout for the detail when stderr is empty', async () => {
      const result = await makeBuilder(fakeSpawn({ code: 2, stdout: 'cobc: configuration error\n', writeOutput: false })).build(exeRequest());

      expectFailure(result);
      expect(result.error).toMatch(/^cobc exited with code 2: .*configuration error/);
      expect(result.diagnostics).toEqual([]);
    });

    it('reports a zero exit that produced no output file', async () => {
      const result = await makeBuilder(fakeSpawn({ writeOutput: false })).build(exeRequest());

      expectFailure(result);
      expect(result.error).toBe(`cobc reported success but produced no output at ${path.join(result.artifactDir ?? '', 'hello')}`);
    });

    it('kills a compiler that overruns the timeout and says so', async () => {
      const spawn = fakeSpawn({ never: true });

      const result = await makeBuilder(spawn, { timeoutMs: 20 }).build(exeRequest());

      expectFailure(result);
      expect(result.error).toBe('cobc timed out after 20 ms');
      expect(spawn.kill).toHaveBeenCalledTimes(1);
    });

    it('does not reuse a failed key directory on the next build', async () => {
      const spawn = fakeSpawn({ code: 1, writeOutput: false });
      const builder = makeBuilder(spawn);
      await builder.build(exeRequest());

      await builder.build(exeRequest());

      expect(spawn.calls).toHaveLength(2);
    });
  });
});
