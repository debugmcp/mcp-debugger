/**
 * BuildStalenessChecker (issue #938): locates the compiled file a
 * source-mapped location binds through, verifies it through its `.map`, and
 * compares mtimes. Runs against the real js-debug policy over a hand-rolled
 * fake filesystem whose `stat` fails for anything not declared, so "exists"
 * is never the default.
 */
import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import { JsDebugAdapterPolicy, type IFileSystem } from '@debugmcp/shared';
import {
  BuildStalenessChecker,
  parseJsonc,
  resolveMapSources,
  type GeneratedFilePolicy
} from '../../../../../src/session/breakpoints/build-staleness.js';

interface FakeFile {
  content: string;
  mtimeMs: number;
  /** Overrides the size derived from the content (for the size caps). */
  size?: number;
}

/**
 * A fake of the filesystem the checker reads. Looked up live, so a test can
 * edit `files` between checks; case- and separator-insensitive on Windows,
 * as the real one is (the checker builds some paths through `path.join`, which
 * folds separators, from a request it never re-spells).
 */
function makeFs(files: Record<string, FakeFile>) {
  const fold = (file: string) => (process.platform === 'win32' ? file.replace(/\//g, '\\').toLowerCase() : file);
  const find = (file: string): FakeFile | undefined => {
    const key = Object.keys(files).find(candidate => fold(candidate) === fold(file));
    return key === undefined ? undefined : files[key];
  };
  const enoent = (file: string) => Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
  const stat = vi.fn(async (file: string) => {
    const entry = find(file);
    if (!entry) {
      throw enoent(file);
    }
    return { size: entry.size ?? entry.content.length, mtimeMs: entry.mtimeMs, isFile: () => true };
  });
  const readFile = vi.fn(async (file: string) => {
    const entry = find(file);
    if (!entry) {
      throw enoent(file);
    }
    return entry.content;
  });
  const pathExists = vi.fn(async (file: string) => find(file) !== undefined);
  const fs = { stat, readFile, pathExists } as unknown as IFileSystem;
  return { fs, stat, readFile, pathExists };
}

// An absolute project root on either platform (C:\proj or /proj).
const P = path.resolve(path.sep, 'proj');
const at = (...parts: string[]) => path.join(P, ...parts);
const map = (sources: string[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ version: 3, sources, mappings: '', ...extra });

const SRC = at('src', 'a.ts');
const DIST = at('dist', 'a.js');
const DIST_MAP = at('dist', 'a.js.map');
const TSCONFIG = at('tsconfig.json');

/** A tsc layout: src/a.ts compiled to dist/a.js with a map that names it. */
function tscLayout(sourceMtimeMs: number, generatedMtimeMs: number, tsconfig = '{ "compilerOptions": { "outDir": "dist", "rootDir": "src" } }'): Record<string, FakeFile> {
  return {
    [TSCONFIG]: { content: tsconfig, mtimeMs: 1 },
    [SRC]: { content: 'export const a = 1;\n', mtimeMs: sourceMtimeMs },
    [DIST]: { content: 'exports.a = 1;\n', mtimeMs: generatedMtimeMs },
    [DIST_MAP]: { content: map(['../src/a.ts']), mtimeMs: generatedMtimeMs }
  };
}

const logger = () => ({ debug: vi.fn() });

describe('BuildStalenessChecker', () => {
  describe('locating the compiled file through its map', () => {
    it('reports the evidence when the source is newer than the compiled file its map names', async () => {
      const { fs } = makeFs(tscLayout(20_000, 10_000));
      const checker = new BuildStalenessChecker(fs, logger());

      const evidence = await checker.check(SRC, JsDebugAdapterPolicy);

      expect(evidence).toEqual({
        sourceFile: SRC,
        sourceMtimeMs: 20_000,
        generatedFile: DIST,
        generatedMtimeMs: 10_000,
        linkedBy: 'sourceMap',
        mapFile: DIST_MAP
      });
    });

    it('stays silent when the compiled file is newer, as new, or older by less than the tolerance', async () => {
      for (const [source, generated] of [[10_000, 20_000], [10_000, 10_000], [11_000, 10_000]]) {
        const { fs } = makeFs(tscLayout(source, generated));
        expect(await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy), `${source} vs ${generated}`).toBeUndefined();
      }
    });

    it('rejects a candidate whose map names a different source and goes on to the next', async () => {
      const files = tscLayout(20_000, 10_000);
      files[DIST_MAP] = { content: map(['../src/other.ts']), mtimeMs: 10_000 };
      const { fs } = makeFs(files);

      expect(await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
    });

    it('falls through to the sibling .js when the tsconfig candidate has no map', async () => {
      const files = tscLayout(20_000, 10_000);
      delete files[DIST_MAP];
      files[at('src', 'a.js')] = { content: 'exports.a = 1;\n', mtimeMs: 5_000 };
      files[at('src', 'a.js.map')] = { content: map(['a.ts']), mtimeMs: 5_000 };
      const { fs } = makeFs(files);

      const evidence = await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy);

      expect(evidence?.generatedFile).toBe(at('src', 'a.js'));
      expect(evidence?.generatedMtimeMs).toBe(5_000);
    });

    it('ignores a compiled file with no map at all: without one js-debug cannot bind the source through it', async () => {
      const files = tscLayout(20_000, 10_000);
      delete files[DIST_MAP];
      const { fs } = makeFs(files);

      expect(await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
    });

    it('skips a map larger than the cap and says so at debug level', async () => {
      const files = tscLayout(20_000, 10_000);
      files[DIST_MAP] = { ...files[DIST_MAP], size: 6 * 1024 * 1024 };
      const { fs, readFile } = makeFs(files);
      const log = logger();

      expect(await new BuildStalenessChecker(fs, log, { maxMapBytes: 5 * 1024 * 1024 }).check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
      expect(readFile).not.toHaveBeenCalledWith(DIST_MAP);
      expect(log.debug.mock.calls.some(([message]) => String(message).includes('larger than'))).toBe(true);
    });

    it('honours sourceRoot and accepts file: URLs while ignoring bundler and inline schemes', async () => {
      const files = tscLayout(20_000, 10_000);
      files[DIST_MAP] = {
        content: map(['webpack:///./src/a.ts', 'data:application/json;base64,e30=', 'a.ts'], { sourceRoot: '../src/' }),
        mtimeMs: 10_000
      };
      const { fs } = makeFs(files);
      expect((await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy))?.generatedFile).toBe(DIST);

      const url = 'file:///' + SRC.replace(/\\/g, '/').replace(/^\//, '');
      files[DIST_MAP] = { content: map([url]), mtimeMs: 10_000 };
      expect((await new BuildStalenessChecker(makeFs(files).fs, logger()).check(SRC, JsDebugAdapterPolicy))?.generatedFile).toBe(DIST);
    });

    it.runIf(process.platform === 'win32')('matches a map source against the request across drive-letter case and separators', async () => {
      const files = tscLayout(20_000, 10_000);
      const { fs } = makeFs(files);
      const asked = SRC.replace(/^([A-Za-z]):/, (_m, d: string) => `${d.toLowerCase()}:`).replace(/\\/g, '/');

      const evidence = await new BuildStalenessChecker(fs, logger()).check(asked, JsDebugAdapterPolicy);

      // The compiled path is built from the request's spelling of the root.
      expect(evidence?.generatedFile.toLowerCase()).toBe(DIST.toLowerCase());
      expect(evidence?.sourceFile).toBe(asked);
    });
  });

  describe('reading the tsconfig', () => {
    it('parses a commented tsconfig with trailing commas', async () => {
      const tsconfig = [
        '{',
        '  // where tsc writes',
        '  "compilerOptions": {',
        '    "outDir": "dist", /* trailing */',
        '    "rootDir": "src",',
        '    "paths": { "@x/*": ["src/x/*"] }, // a "//" inside a string: "http://example"',
        '  },',
        '}'
      ].join('\n');
      const { fs } = makeFs(tscLayout(20_000, 10_000, tsconfig));

      expect((await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy))?.generatedFile).toBe(DIST);
    });

    it('treats a malformed tsconfig as none and still finds the sibling', async () => {
      const files = tscLayout(20_000, 10_000, '{ not json');
      delete files[DIST];
      delete files[DIST_MAP];
      files[at('src', 'a.js')] = { content: '', mtimeMs: 5_000 };
      files[at('src', 'a.js.map')] = { content: map(['a.ts']), mtimeMs: 5_000 };
      const { fs } = makeFs(files);

      expect((await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy))?.generatedFile).toBe(at('src', 'a.js'));
    });

    it('walks past a tsconfig that names no outDir to one that does (a per-directory config extending the root)', async () => {
      const files: Record<string, FakeFile> = {
        [TSCONFIG]: { content: '{ "compilerOptions": { "outDir": "build-out", "rootDir": "src" } }', mtimeMs: 1 },
        [at('src', 'tsconfig.json')]: { content: '{ "extends": "../tsconfig.json", "include": ["."] }', mtimeMs: 1 },
        [SRC]: { content: '', mtimeMs: 20_000 },
        [at('build-out', 'a.js')]: { content: '', mtimeMs: 10_000 },
        [at('build-out', 'a.js.map')]: { content: map(['../src/a.ts']), mtimeMs: 10_000 }
      };
      const { fs } = makeFs(files);

      expect((await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy))?.generatedFile).toBe(at('build-out', 'a.js'));
    });

    it('uses the conventional out dirs under the nearest package.json when no tsconfig is found', async () => {
      const files: Record<string, FakeFile> = {
        [at('package.json')]: { content: '{}', mtimeMs: 1 },
        [SRC]: { content: '', mtimeMs: 20_000 },
        [at('build', 'a.js')]: { content: '', mtimeMs: 10_000 },
        [at('build', 'a.js.map')]: { content: map(['../src/a.ts']), mtimeMs: 10_000 }
      };
      const { fs } = makeFs(files);

      expect((await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy))?.generatedFile).toBe(at('build', 'a.js'));
    });
  });

  describe('a candidate the launch links (issue #950): the artefact the engine runs, with no map to prove it', () => {
    const CS = at('Program.cs');
    const DLL = at('bin', 'app.dll');
    const OTHER_DLL = at('bin', 'other.dll');
    /** A .NET-shaped policy: a C# source binds through the launched DLL, and only once a launch exists. */
    const launchPolicy: GeneratedFilePolicy = {
      name: 'dotnet',
      generatedFileCandidates: info =>
        info.program !== undefined && info.sourcePath.endsWith('.cs') ? [{ path: info.program, linkedBy: 'launch' }] : undefined
    };
    const launchOf = (program: string) => ({ program, launchConfig: { program } });

    it('reports the evidence from the two mtimes alone when the source is newer than the launched artefact', async () => {
      const { fs, readFile } = makeFs({ [CS]: { content: '', mtimeMs: 20_000 }, [DLL]: { content: '', mtimeMs: 10_000 } });

      const evidence = await new BuildStalenessChecker(fs, logger()).check(CS, launchPolicy, launchOf(DLL));

      expect(evidence).toEqual({
        sourceFile: CS,
        sourceMtimeMs: 20_000,
        generatedFile: DLL,
        generatedMtimeMs: 10_000,
        linkedBy: 'launch'
      });
      expect(readFile).not.toHaveBeenCalled();
    });

    it('hands the launch to the policy on the probe and on the context call alike', async () => {
      const { fs } = makeFs({ [CS]: { content: '', mtimeMs: 20_000 }, [DLL]: { content: '', mtimeMs: 10_000 } });
      const hook = vi.fn(launchPolicy.generatedFileCandidates!);

      await new BuildStalenessChecker(fs, logger()).check(CS, { name: 'dotnet', generatedFileCandidates: hook }, launchOf(DLL));

      expect(hook).toHaveBeenCalled();
      for (const [info] of hook.mock.calls) {
        expect(info).toMatchObject({ sourcePath: CS, program: DLL, launchConfig: { program: DLL } });
      }
    });

    it('touches no file without a launch: the artefact is unknown until the transform names it', async () => {
      const { fs, stat, readFile, pathExists } = makeFs({ [CS]: { content: '', mtimeMs: 20_000 }, [DLL]: { content: '', mtimeMs: 10_000 } });

      expect(await new BuildStalenessChecker(fs, logger()).check(CS, launchPolicy)).toBeUndefined();
      expect(stat).not.toHaveBeenCalled();
      expect(readFile).not.toHaveBeenCalled();
      expect(pathExists).not.toHaveBeenCalled();
    });

    it('skips a launched artefact that does not exist', async () => {
      const { fs } = makeFs({ [CS]: { content: '', mtimeMs: 20_000 } });

      expect(await new BuildStalenessChecker(fs, logger()).check(CS, launchPolicy, launchOf(DLL))).toBeUndefined();
    });

    it('stays silent when the artefact is as new as the source or newer', async () => {
      for (const generated of [20_000, 30_000]) {
        const { fs } = makeFs({ [CS]: { content: '', mtimeMs: 20_000 }, [DLL]: { content: '', mtimeMs: generated } });
        expect(await new BuildStalenessChecker(fs, logger()).check(CS, launchPolicy, launchOf(DLL)), String(generated)).toBeUndefined();
      }
    });

    it('remembers the discovery per program, so two launches of different artefacts from one source do not share it', async () => {
      const { fs } = makeFs({
        [CS]: { content: '', mtimeMs: 20_000 },
        [DLL]: { content: '', mtimeMs: 10_000 },
        [OTHER_DLL]: { content: '', mtimeMs: 5_000 }
      });
      const checker = new BuildStalenessChecker(fs, logger());

      expect((await checker.check(CS, launchPolicy, launchOf(DLL)))?.generatedFile).toBe(DLL);
      expect((await checker.check(CS, launchPolicy, launchOf(OTHER_DLL)))?.generatedFile).toBe(OTHER_DLL);
      expect((await checker.check(CS, launchPolicy, launchOf(DLL)))?.generatedFile).toBe(DLL);
    });

    it('still sees a rebuild of the artefact immediately', async () => {
      const files = { [CS]: { content: '', mtimeMs: 20_000 }, [DLL]: { content: '', mtimeMs: 10_000 } };
      const { fs } = makeFs(files);
      const checker = new BuildStalenessChecker(fs, logger());

      expect(await checker.check(CS, launchPolicy, launchOf(DLL))).toBeDefined();
      files[DLL] = { content: '', mtimeMs: 30_000 };
      expect(await checker.check(CS, launchPolicy, launchOf(DLL))).toBeUndefined();
    });

    /** A Java-shaped policy: the class file comes from the launch's classpath, not from `program` (the unchanged .java). */
    const JAVA = at('src', 'Foo.java');
    const classpathPolicy: GeneratedFilePolicy = {
      name: 'java',
      generatedFileCandidates: info => {
        const classpath = info.launchConfig?.classpath;
        if (typeof classpath !== 'string' || !info.sourcePath.endsWith('.java')) {
          return undefined;
        }
        return classpath.split(path.delimiter).map(dir => ({ path: path.join(dir, 'Foo.class'), linkedBy: 'launch' as const }));
      }
    };
    const classpathLaunch = (...dirs: string[]) => ({ program: JAVA, launchConfig: { program: JAVA, classpath: dirs.join(path.delimiter) } });

    it('remembers the discovery per candidate set, not per program: a relaunch with another classpath is compared against its own class', async () => {
      const { fs } = makeFs({
        [JAVA]: { content: '', mtimeMs: 20_000 },
        [at('out1', 'Foo.class')]: { content: '', mtimeMs: 5_000 },
        [at('out2', 'Foo.class')]: { content: '', mtimeMs: 30_000 }
      });
      const checker = new BuildStalenessChecker(fs, logger());

      expect((await checker.check(JAVA, classpathPolicy, classpathLaunch(at('out1'))))?.generatedFile).toBe(at('out1', 'Foo.class'));
      expect(await checker.check(JAVA, classpathPolicy, classpathLaunch(at('out2')))).toBeUndefined();
    });

    it('takes the newest existing launch-linked candidate: a stale leftover never outranks the build the engine loads', async () => {
      const files: Record<string, FakeFile> = {
        [JAVA]: { content: '', mtimeMs: 20_000 },
        [at('stale', 'Foo.class')]: { content: '', mtimeMs: 5_000 },
        [at('fresh', 'Foo.class')]: { content: '', mtimeMs: 30_000 }
      };
      const { fs } = makeFs(files);

      // The leftover is listed first; the fresh build still wins, so nothing is said.
      expect(await new BuildStalenessChecker(fs, logger()).check(JAVA, classpathPolicy, classpathLaunch(at('stale'), at('fresh')))).toBeUndefined();

      // Both older than the source: the newest is the one named.
      files[at('fresh', 'Foo.class')] = { content: '', mtimeMs: 8_000 };
      const evidence = await new BuildStalenessChecker(fs, logger()).check(JAVA, classpathPolicy, classpathLaunch(at('stale'), at('fresh')));
      expect(evidence?.generatedFile).toBe(at('fresh', 'Foo.class'));
      expect(evidence?.generatedMtimeMs).toBe(8_000);
    });

    it('remembers a miss for the window, so a session whose class lives in a jar does not re-stat every candidate on every answer', async () => {
      const { fs, stat } = makeFs({ [JAVA]: { content: '', mtimeMs: 20_000 } });
      const checker = new BuildStalenessChecker(fs, logger());
      const launch = classpathLaunch(at('a'), at('b'), at('c'));

      expect(await checker.check(JAVA, classpathPolicy, launch)).toBeUndefined();
      const stats = stat.mock.calls.length;
      expect(stats).toBeGreaterThan(0);
      expect(await checker.check(JAVA, classpathPolicy, launch)).toBeUndefined();

      expect(stat.mock.calls.length).toBe(stats);
    });
  });

  describe('applicability and failure modes', () => {
    it('touches no file for a policy without the hook', async () => {
      const { fs, stat, readFile, pathExists } = makeFs(tscLayout(20_000, 10_000));
      const policy: GeneratedFilePolicy = { name: 'python' };

      expect(await new BuildStalenessChecker(fs, logger()).check(SRC, policy)).toBeUndefined();
      expect(stat).not.toHaveBeenCalled();
      expect(readFile).not.toHaveBeenCalled();
      expect(pathExists).not.toHaveBeenCalled();
    });

    it('touches no file for a source the policy does not compile', async () => {
      const { fs, stat, readFile, pathExists } = makeFs({});

      expect(await new BuildStalenessChecker(fs, logger()).check(at('src', 'a.py'), JsDebugAdapterPolicy)).toBeUndefined();
      expect(stat).not.toHaveBeenCalled();
      expect(readFile).not.toHaveBeenCalled();
      expect(pathExists).not.toHaveBeenCalled();
    });

    it('stays silent when a stat carries no numeric mtime (mocked filesystems)', async () => {
      const files = tscLayout(20_000, 10_000);
      const { fs, stat } = makeFs(files);
      stat.mockImplementation(async () => ({ size: 10 }) as never);

      expect(await new BuildStalenessChecker(fs, logger()).check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
    });

    it('never throws: a filesystem failure is a debug line and no evidence', async () => {
      const { fs, pathExists } = makeFs(tscLayout(20_000, 10_000));
      pathExists.mockRejectedValue(new Error('EACCES'));
      const log = logger();

      expect(await new BuildStalenessChecker(fs, log).check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
      expect(log.debug).toHaveBeenCalled();
    });
  });

  describe('remembering the discovery', () => {
    it('does not re-read the map or re-walk for a second check while the map is unchanged', async () => {
      const { fs, readFile, pathExists } = makeFs(tscLayout(20_000, 10_000));
      const checker = new BuildStalenessChecker(fs, logger());

      await checker.check(SRC, JsDebugAdapterPolicy);
      const mapReads = readFile.mock.calls.filter(([file]) => file === DIST_MAP).length;
      const walks = pathExists.mock.calls.length;
      expect(await checker.check(SRC, JsDebugAdapterPolicy)).toMatchObject({ generatedFile: DIST });

      expect(readFile.mock.calls.filter(([file]) => file === DIST_MAP).length).toBe(mapReads);
      expect(pathExists.mock.calls.length).toBe(walks);
    });

    it('still sees a rebuild immediately: the mtimes are read on every check', async () => {
      const files = tscLayout(20_000, 10_000);
      const { fs } = makeFs(files);
      const checker = new BuildStalenessChecker(fs, logger());

      expect(await checker.check(SRC, JsDebugAdapterPolicy)).toBeDefined();
      files[DIST] = { ...files[DIST], mtimeMs: 30_000 };
      files[DIST_MAP] = { ...files[DIST_MAP], mtimeMs: 30_000 };
      expect(await checker.check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
    });

    it('remembers the directory context, so a source with no compiled file does not pay the walk on every stop', async () => {
      const files: Record<string, FakeFile> = {
        [at('package.json')]: { content: '{}', mtimeMs: 1 },
        [SRC]: { content: '', mtimeMs: 20_000 }
      };
      const { fs, pathExists } = makeFs(files);
      const checker = new BuildStalenessChecker(fs, logger());

      expect(await checker.check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
      const walks = pathExists.mock.calls.length;
      expect(walks).toBeGreaterThan(0);
      expect(await checker.check(SRC, JsDebugAdapterPolicy)).toBeUndefined();

      expect(pathExists.mock.calls.length).toBe(walks);
    });

    it('lets a discovery expire, so a more specific compiled file that appears later displaces a sibling', async () => {
      const files = tscLayout(20_000, 10_000);
      delete files[DIST];
      delete files[DIST_MAP];
      files[at('src', 'a.js')] = { content: '', mtimeMs: 5_000 };
      files[at('src', 'a.js.map')] = { content: map(['a.ts']), mtimeMs: 5_000 };
      const { fs } = makeFs(files);
      const checker = new BuildStalenessChecker(fs, logger(), { discoveryTtlMs: 1, contextTtlMs: 1 });

      expect((await checker.check(SRC, JsDebugAdapterPolicy))?.generatedFile).toBe(at('src', 'a.js'));
      files[DIST] = { content: '', mtimeMs: 30_000 };
      files[DIST_MAP] = { content: map(['../src/a.ts']), mtimeMs: 30_000 };
      await new Promise(resolve => setTimeout(resolve, 10));

      // dist/a.js is newer than the source: the warning clears instead of naming the stale sibling.
      expect(await checker.check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
    });

    it('re-reads the map once it changes, and re-discovers once the compiled file is gone', async () => {
      const files = tscLayout(20_000, 10_000);
      const { fs, readFile } = makeFs(files);
      const checker = new BuildStalenessChecker(fs, logger());
      await checker.check(SRC, JsDebugAdapterPolicy);

      files[DIST_MAP] = { content: map(['../src/other.ts']), mtimeMs: 15_000 };
      expect(await checker.check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
      expect(readFile.mock.calls.filter(([file]) => file === DIST_MAP).length).toBe(2);

      files[DIST_MAP] = { content: map(['../src/a.ts']), mtimeMs: 16_000 };
      expect(await checker.check(SRC, JsDebugAdapterPolicy)).toBeDefined();
      delete files[DIST];
      delete files[DIST_MAP];
      expect(await checker.check(SRC, JsDebugAdapterPolicy)).toBeUndefined();
    });
  });
});

describe('parseJsonc', () => {
  it('strips line and block comments and trailing commas, leaving strings alone', () => {
    const text = '{ // c\n "a": "http://x", /* b */ "b": [1, 2,], "c": "a /* not */ b", }';
    expect(parseJsonc(text)).toEqual({ a: 'http://x', b: [1, 2], c: 'a /* not */ b' });
  });

  it('answers undefined for text that is not JSON after stripping', () => {
    expect(parseJsonc('{ nope')).toBeUndefined();
    expect(parseJsonc('')).toBeUndefined();
  });
});

describe('resolveMapSources', () => {
  const mapPath = at('dist', 'x.js.map');

  it('resolves relative entries against the map directory and sourceRoot', () => {
    expect(resolveMapSources(map(['../src/x.ts']), mapPath)).toEqual([at('src', 'x.ts')]);
    expect(resolveMapSources(map(['x.ts'], { sourceRoot: '../src' }), mapPath)).toEqual([at('src', 'x.ts')]);
  });

  it('drops non-file schemes, decodes percent escapes and accepts file: URLs', () => {
    const encoded = '../src/with%20space.ts';
    expect(resolveMapSources(map(['webpack:///./x.ts', 'data:,x', encoded]), mapPath)).toEqual([at('src', 'with space.ts')]);
    const url = 'file:///' + at('src', 'x.ts').replace(/\\/g, '/').replace(/^\//, '');
    expect(resolveMapSources(map([url]), mapPath)).toEqual([at('src', 'x.ts')]);
  });

  it('answers nothing for a map that is not JSON or has no sources array', () => {
    expect(resolveMapSources('nope', mapPath)).toEqual([]);
    expect(resolveMapSources('{"version":3}', mapPath)).toEqual([]);
  });
});
