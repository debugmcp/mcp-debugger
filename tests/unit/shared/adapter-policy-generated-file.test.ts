/**
 * The compiled languages' generated-file hooks (issue #950): where a source
 * binds through an artefact the transformed launch names, so the core can
 * compare the two mtimes and warn when the artefact is the older one. The
 * JS hook (map-proved candidates) has its own cases in
 * adapter-policy-js.test.ts; adapter-policy-contract.test.ts pins which
 * languages declare a hook at all.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { JavaAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-java.js';
import { DotnetAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-dotnet.js';
import { GoAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-go.js';
import { RustAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-rust.js';
import { CppAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-cpp.js';
import { CobolAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-cobol.js';
import { lldbGeneratedFileCandidates } from '../../../packages/shared/src/interfaces/lldb-policy-shared.js';
import type { GeneratedFileContext } from '../../../packages/shared/src/interfaces/adapter-policy.js';

// An absolute project root on either platform (C:\p or /p).
const P = path.resolve(path.sep, 'p');
const at = (...parts: string[]) => path.join(P, ...parts);
/** The artefact the launch runs: linked by the launch itself, no map to prove it. */
const launched = (file: string) => ({ path: file, linkedBy: 'launch' as const });

describe('DotnetAdapterPolicy.generatedFileCandidates (issue #950)', () => {
  const hook = DotnetAdapterPolicy.generatedFileCandidates!;
  const dll = at('bin', 'Debug', 'net8.0', 'app.dll');

  it('names the launched DLL for a .NET source: netcoredbg binds through its PDB', () => {
    for (const name of ['Program.cs', 'Program.CS', 'Program.fs', 'Program.vb']) {
      expect(hook({ sourcePath: at(name), program: dll, launchConfig: { program: dll } }), name).toEqual([launched(dll)]);
    }
  });

  it('declines before a launch: the DLL is unknown until the transform names it', () => {
    expect(hook({ sourcePath: at('Program.cs') })).toBeUndefined();
  });

  it('declines a source that is not .NET', () => {
    expect(hook({ sourcePath: at('a.py'), program: dll, launchConfig: { program: dll } })).toBeUndefined();
  });
});

describe('GoAdapterPolicy.generatedFileCandidates (issue #950)', () => {
  const hook = GoAdapterPolicy.generatedFileCandidates!;
  const bin = at('app');

  it('names the launched binary in exec mode: Delve runs it as built', () => {
    expect(hook({ sourcePath: at('main.go'), program: bin, launchConfig: { mode: 'exec', program: bin } })).toEqual([launched(bin)]);
  });

  it('declines in debug and test mode: Delve compiles each launch, so nothing can be stale', () => {
    for (const mode of ['debug', 'test']) {
      const program = at('main.go');
      expect(hook({ sourcePath: program, program, launchConfig: { mode, program } }), mode).toBeUndefined();
    }
  });

  it('declines before a launch, without a mode, and for a source that is not Go', () => {
    expect(hook({ sourcePath: at('main.go') })).toBeUndefined();
    expect(hook({ sourcePath: at('main.go'), program: bin, launchConfig: { program: bin } })).toBeUndefined();
    expect(hook({ sourcePath: at('a.py'), program: bin, launchConfig: { mode: 'exec', program: bin } })).toBeUndefined();
  });
});

describe('lldbGeneratedFileCandidates (issue #950): the CodeLLDB family binds through the launched binary', () => {
  const bin = at('target', 'debug', 'app');
  const rustSources = new Set(['.rs']);

  it('names the launched program for a source of the language, whatever the case of its extension', () => {
    expect(lldbGeneratedFileCandidates({ sourcePath: at('src', 'main.rs'), program: bin, launchConfig: { program: bin } }, rustSources)).toEqual([launched(bin)]);
    expect(lldbGeneratedFileCandidates({ sourcePath: at('src', 'MAIN.RS'), program: bin, launchConfig: { program: bin } }, rustSources)).toEqual([launched(bin)]);
  });

  it("declines without a launch, for another language's source, and when the program is itself a source", () => {
    expect(lldbGeneratedFileCandidates({ sourcePath: at('src', 'main.rs') }, rustSources)).toBeUndefined();
    expect(lldbGeneratedFileCandidates({ sourcePath: at('a.c'), program: bin, launchConfig: { program: bin } }, rustSources)).toBeUndefined();
    const source = at('src', 'main.rs');
    expect(lldbGeneratedFileCandidates({ sourcePath: source, program: source, launchConfig: { program: source } }, rustSources)).toBeUndefined();
  });

  it('Rust: .rs sources, through the binary cargo built or the one the launch named', () => {
    expect(RustAdapterPolicy.generatedFileCandidates!({ sourcePath: at('build.rs'), program: bin, launchConfig: { program: bin } })).toEqual([launched(bin)]);
  });

  it('C/C++: sources and headers alike — a header newer than the binary is the gap the compile step does not track', () => {
    const exe = at('a.out');
    for (const name of ['main.c', 'main.cc', 'main.cpp', 'main.cxx', 'util.h', 'util.hh', 'util.hpp', 'util.hxx']) {
      expect(CppAdapterPolicy.generatedFileCandidates!({ sourcePath: at(name), program: exe, launchConfig: { program: exe } }), name).toEqual([launched(exe)]);
    }
    expect(CppAdapterPolicy.generatedFileCandidates!({ sourcePath: at('main.rs'), program: exe, launchConfig: { program: exe } })).toBeUndefined();
  });

  it('COBOL: programs and copybooks, through the executable cobc built or the prebuilt one', () => {
    const exe = at('.debug-mcp', 'cobol', 'payroll', 'k1', 'payroll.exe');
    for (const name of ['payroll.cob', 'payroll.cbl', 'payroll.cobol', 'common.cpy']) {
      expect(CobolAdapterPolicy.generatedFileCandidates!({ sourcePath: at(name), program: exe, launchConfig: { program: exe } }), name).toEqual([launched(exe)]);
    }
  });

  it("COBOL: declines under runner \"cobcrun\", whose launched program is GnuCOBOL's loader, not the user's module", () => {
    const cobcrun = at('msys64', 'ucrt64', 'bin', 'cobcrun.exe');
    expect(CobolAdapterPolicy.generatedFileCandidates!({ sourcePath: at('payroll.cob'), program: cobcrun, launchConfig: { program: cobcrun, runner: 'cobcrun' } })).toBeUndefined();
  });

  it('COBOL: recognises the loader by the program alone — the transform hands CodeLLDB a config without the runner key (measured, issue #950)', () => {
    for (const loader of [at('msys64', 'mingw64', 'bin', 'cobcrun.exe'), path.join(path.sep, 'usr', 'bin', 'cobcrun')]) {
      expect(
        CobolAdapterPolicy.generatedFileCandidates!({ sourcePath: at('payroll.cob'), program: loader, launchConfig: { program: loader, args: ['HELLO'] } }),
        loader
      ).toBeUndefined();
    }
  });
});

describe('JavaAdapterPolicy.generatedFileCandidates (issue #950): the .class on the classpath', () => {
  const hook = JavaAdapterPolicy.generatedFileCandidates!;
  const source = at('src', 'com', 'x', 'Foo.java');
  const launch = (launchConfig: Record<string, unknown>): GeneratedFileContext => ({ sourcePath: source, program: source, launchConfig });
  const paths = (answer: ReturnType<typeof hook>) => answer!.map(candidate => candidate.path);

  it('walks the source directory chain under each classpath directory, deepest first, then the sibling .class', () => {
    const answer = hook(launch({ classpath: at('out'), cwd: P }));

    expect(answer!.every(candidate => candidate.linkedBy === 'launch')).toBe(true);
    expect(paths(answer)).toEqual([
      at('out', 'p', 'src', 'com', 'x', 'Foo.class'),
      at('out', 'src', 'com', 'x', 'Foo.class'),
      at('out', 'com', 'x', 'Foo.class'), // the package directory mirrors the source directory
      at('out', 'x', 'Foo.class'),
      at('out', 'Foo.class'),
      at('src', 'com', 'x', 'Foo.class')  // javac without -d
    ]);
  });

  it('defaults the classpath to "." against the launch cwd, as the JDI bridge does', () => {
    expect(paths(hook(launch({ cwd: at('out') })))).toContain(at('out', 'com', 'x', 'Foo.class'));
  });

  it('resolves a relative classpath entry against the cwd', () => {
    expect(paths(hook(launch({ classpath: 'out', cwd: P })))).toContain(at('out', 'com', 'x', 'Foo.class'));
  });

  it('splits the classpath on the platform delimiter, accepts an array, and skips jars, zips and wildcards', () => {
    const entries = [at('out'), at('lib', 'dep.jar'), at('lib', 'dep.zip'), at('lib', '*')];
    for (const classpath of [entries.join(path.delimiter), entries]) {
      const answer = paths(hook(launch({ classpath, cwd: P })));
      expect(answer.some(file => file.includes('lib')), JSON.stringify(answer)).toBe(false);
      expect(answer).toContain(at('out', 'com', 'x', 'Foo.class'));
    }
  });

  it('caps the directory chain at eight segments', () => {
    const deep = at('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'Foo.java');
    const answer = paths(hook({ sourcePath: deep, program: deep, launchConfig: { classpath: at('out'), cwd: P } }));

    expect(answer[0]).toBe(at('out', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'Foo.class'));
    expect(answer).toHaveLength(9 + 1);
  });

  it('lists the sibling once when a classpath entry is the source directory itself (javac without -d)', () => {
    const dir = path.dirname(source);
    const answer = paths(hook(launch({ classpath: dir, cwd: dir })));

    expect(answer.filter(file => file === at('src', 'com', 'x', 'Foo.class'))).toHaveLength(1);
  });

  it('declines before a launch (no classpath to read) and for a source that is not Java', () => {
    expect(hook({ sourcePath: source })).toBeUndefined();
    expect(hook({ sourcePath: at('a.py'), program: at('a.py'), launchConfig: { classpath: at('out'), cwd: P } })).toBeUndefined();
  });
});
