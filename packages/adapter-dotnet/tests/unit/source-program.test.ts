import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  describeSourceProgram,
  findBuiltAssembly,
  isDotnetSourceFile
} from '../../src/utils/source-program.js';

// Issue #959: a launch whose program is the .cs source reached netcoredbg and
// failed at configurationDone with a bare 0x800700c1.

const tempDirs: string[] = [];

function tempProject(files: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dotnet-source-program-'));
  tempDirs.push(root);
  for (const file of files) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '');
  }
  return root;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('isDotnetSourceFile', () => {
  it('recognises C#, F# and VB sources whatever the case', () => {
    expect(isDotnetSourceFile('/app/Program.cs')).toBe(true);
    expect(isDotnetSourceFile('C:\\app\\Program.FS')).toBe(true);
    expect(isDotnetSourceFile('Module1.vb')).toBe(true);
  });

  it('leaves assemblies, the dotnet host and project files alone', () => {
    expect(isDotnetSourceFile('/app/bin/Debug/net8.0/App.dll')).toBe(false);
    expect(isDotnetSourceFile('C:\\app\\bin\\Debug\\net8.0\\App.exe')).toBe(false);
    expect(isDotnetSourceFile('dotnet')).toBe(false);
    expect(isDotnetSourceFile('/app/App.csproj')).toBe(false);
  });
});

describe('findBuiltAssembly', () => {
  it('finds the one assembly named after the project, from a source in a subfolder', () => {
    const root = tempProject(['App.csproj', 'src/Program.cs', 'bin/Debug/net8.0/App.dll', 'bin/Debug/net8.0/Other.dll']);

    expect(findBuiltAssembly(path.join(root, 'src', 'Program.cs'))).toBe(
      path.join(root, 'bin', 'Debug', 'net8.0', 'App.dll')
    );
  });

  it('says nothing when the project has not been built', () => {
    const root = tempProject(['App.csproj', 'Program.cs']);

    expect(findBuiltAssembly(path.join(root, 'Program.cs'))).toBeUndefined();
  });

  it('says nothing when more than one build output matches', () => {
    const root = tempProject([
      'App.csproj',
      'Program.cs',
      'bin/Debug/net8.0/App.dll',
      'bin/Release/net8.0/App.dll'
    ]);

    expect(findBuiltAssembly(path.join(root, 'Program.cs'))).toBeUndefined();
  });

  it('says nothing when the folder holds more than one project', () => {
    const root = tempProject(['App.csproj', 'Tests.csproj', 'Program.cs', 'bin/Debug/net8.0/App.dll']);

    expect(findBuiltAssembly(path.join(root, 'Program.cs'))).toBeUndefined();
  });

  it('resolves a relative program against the launch cwd, not the server cwd', () => {
    const root = tempProject(['App.csproj', 'Program.cs', 'bin/Debug/net8.0/App.dll']);

    expect(findBuiltAssembly('Program.cs', root)).toBe(path.join(root, 'bin', 'Debug', 'net8.0', 'App.dll'));
    expect(describeSourceProgram('Program.cs', root)).toContain('Found one:');
  });

  it('says nothing without a project file above the source', () => {
    const root = tempProject(['Program.cs', 'bin/Debug/net8.0/Program.dll']);

    expect(findBuiltAssembly(path.join(root, 'Program.cs'))).toBeUndefined();
  });
});

describe('describeSourceProgram', () => {
  it('names the source, the compiled-assembly convention and the key to set', () => {
    const root = tempProject(['App.csproj', 'Program.cs']);
    const message = describeSourceProgram(path.join(root, 'Program.cs'));

    expect(message).toContain('Program.cs');
    expect(message).toContain('dapLaunchArgs.program');
    expect(message).toContain('bin/Debug/<framework>/<Project>.dll');
    expect(message).toContain('dotnet build');
    expect(message).not.toContain('Found');
  });

  it('suggests the built assembly when there is exactly one', () => {
    const root = tempProject(['App.csproj', 'Program.cs', 'bin/Debug/net8.0/App.dll']);
    const message = describeSourceProgram(path.join(root, 'Program.cs'));

    expect(message).toContain(`Found one: ${path.join(root, 'bin', 'Debug', 'net8.0', 'App.dll')}`);
  });
});
