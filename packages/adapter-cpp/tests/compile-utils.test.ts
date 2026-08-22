/**
 * Unit tests for single-file C/C++ compilation utilities.
 *
 * child_process.spawn is mocked for compiler invocations; staleness tests use
 * real temp files so mtime comparison is honest.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

const spawnMock: Mock = vi.fn();

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawn: (...args: unknown[]) => spawnMock(...args)
}));

import {
  isCppSourceFile,
  dialectForSource,
  findCompiler,
  findAnyCompiler,
  getCompilerInfo,
  getDefaultOutputPath,
  needsRecompile,
  compileSourceFile
} from '../src/utils/compile-utils.js';

function fakeProcess(exitCode: number, stderr = '', stdout = ''): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter } {
  const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  setImmediate(() => {
    if (stderr) {
      proc.stderr.emit('data', Buffer.from(stderr));
    }
    if (stdout) {
      proc.stdout.emit('data', Buffer.from(stdout));
    }
    proc.emit('exit', exitCode);
  });
  return proc;
}

function erroringProcess(): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter } {
  const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  setImmediate(() => proc.emit('error', new Error('ENOENT')));
  return proc;
}

describe('compile-utils', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  describe('isCppSourceFile', () => {
    it.each(['main.c', 'main.cpp', 'main.cc', 'main.cxx'])('accepts %s', (name) => {
      expect(isCppSourceFile(name)).toBe(true);
    });

    it.each(['main.h', 'main.hpp', 'a.out', 'main.exe', 'main.rs', 'binary'])('rejects %s', (name) => {
      expect(isCppSourceFile(name)).toBe(false);
    });
  });

  describe('dialectForSource', () => {
    it('treats .c as C and everything else as C++', () => {
      expect(dialectForSource('foo.c')).toBe('c');
      expect(dialectForSource('foo.cpp')).toBe('cpp');
      expect(dialectForSource('foo.cc')).toBe('cpp');
      expect(dialectForSource('foo.cxx')).toBe('cpp');
    });
  });

  describe('findCompiler', () => {
    it('probes C++ candidates in order and returns the first that answers --version', async () => {
      spawnMock
        .mockImplementationOnce(() => fakeProcess(1))   // g++ missing
        .mockImplementationOnce(() => fakeProcess(0));  // clang++ works

      const result = await findCompiler('cpp');

      expect(result).toBe('clang++');
      expect(spawnMock.mock.calls[0][0]).toBe('g++');
      expect(spawnMock.mock.calls[1][0]).toBe('clang++');
      expect(spawnMock.mock.calls[0][1]).toEqual(['--version']);
    });

    it('probes C candidates for the c dialect', async () => {
      spawnMock.mockImplementationOnce(() => fakeProcess(0)); // gcc works

      const result = await findCompiler('c');

      expect(result).toBe('gcc');
      expect(spawnMock.mock.calls[0][0]).toBe('gcc');
    });

    it('returns null when no candidate answers', async () => {
      spawnMock.mockImplementation(() => fakeProcess(1));

      await expect(findCompiler('cpp')).resolves.toBeNull();
    });

    it('treats a synchronously-throwing spawn as a missing candidate', async () => {
      spawnMock.mockImplementationOnce(() => {
        throw new Error('spawn EPERM');
      });
      spawnMock.mockImplementationOnce(() => fakeProcess(0));

      await expect(findCompiler('cpp')).resolves.toBe('clang++');
    });

    it('treats spawn errors (ENOENT) as a missing candidate', async () => {
      spawnMock.mockImplementationOnce(() => {
        // A real ENOENT spawn emits 'error' and never 'exit'
        const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        setImmediate(() => proc.emit('error', new Error('ENOENT')));
        return proc;
      });
      spawnMock.mockImplementationOnce(() => fakeProcess(0));

      const result = await findCompiler('cpp');
      expect(result).toBe('clang++');
    });
  });

  describe('findAnyCompiler', () => {
    it('prefers C++ compilers over C compilers', async () => {
      // g++, clang++, c++ all missing; gcc present
      spawnMock
        .mockImplementationOnce(() => fakeProcess(1))
        .mockImplementationOnce(() => fakeProcess(1))
        .mockImplementationOnce(() => fakeProcess(1))
        .mockImplementationOnce(() => fakeProcess(0));

      await expect(findAnyCompiler()).resolves.toBe('gcc');
    });
  });

  describe('getCompilerInfo (issue #423)', () => {
    it('returns the discovered command and the first line of its --version output', async () => {
      spawnMock
        .mockImplementationOnce(() => fakeProcess(0))  // findAnyCompiler probe: g++ answers
        .mockImplementationOnce(() =>
          fakeProcess(0, '', 'g++ (MinGW-w64 x86_64-posix-seh) 13.2.0\nCopyright (C) 2023 Free Software Foundation\n')
        );

      await expect(getCompilerInfo()).resolves.toEqual({
        command: 'g++',
        version: 'g++ (MinGW-w64 x86_64-posix-seh) 13.2.0'
      });
    });

    it('returns null when no compiler is installed', async () => {
      spawnMock.mockImplementation(() => fakeProcess(1)); // every candidate probe fails

      await expect(getCompilerInfo()).resolves.toBeNull();
    });

    it('returns a null version when the --version re-run fails after discovery', async () => {
      spawnMock
        .mockImplementationOnce(() => fakeProcess(0))    // probe succeeds
        .mockImplementationOnce(() => erroringProcess()); // version capture fails

      await expect(getCompilerInfo()).resolves.toEqual({ command: 'g++', version: null });
    });
  });

  describe('getDefaultOutputPath', () => {
    it('places the binary under .debug-mcp next to the source, with .exe on win32', () => {
      const src = path.join('C:', 'work', 'demo', 'hello.cpp');
      expect(getDefaultOutputPath(src, 'win32')).toBe(
        path.join('C:', 'work', 'demo', '.debug-mcp', 'hello.exe')
      );
      expect(getDefaultOutputPath(path.join('/tmp', 'x.c'), 'linux')).toBe(
        path.join('/tmp', '.debug-mcp', 'x')
      );
    });
  });

  describe('needsRecompile (real files)', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-utils-test-'));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('is true when the binary is missing', async () => {
      const src = path.join(tmpDir, 'a.cpp');
      await fs.writeFile(src, 'int main(){}');

      await expect(needsRecompile(src, path.join(tmpDir, 'missing'))).resolves.toBe(true);
    });

    it('is true when the source is newer than the binary', async () => {
      const src = path.join(tmpDir, 'a.cpp');
      const bin = path.join(tmpDir, 'a.bin');
      await fs.writeFile(bin, 'old');
      const past = new Date(Date.now() - 60_000);
      await fs.utimes(bin, past, past);
      await fs.writeFile(src, 'int main(){}');

      await expect(needsRecompile(src, bin)).resolves.toBe(true);
    });

    it('is false when the binary is fresh', async () => {
      const src = path.join(tmpDir, 'a.cpp');
      const bin = path.join(tmpDir, 'a.bin');
      await fs.writeFile(src, 'int main(){}');
      const past = new Date(Date.now() - 60_000);
      await fs.utimes(src, past, past);
      await fs.writeFile(bin, 'fresh');

      await expect(needsRecompile(src, bin)).resolves.toBe(false);
    });
  });

  describe('compileSourceFile', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-utils-test-'));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('invokes the compiler with -gdwarf-4 -O0 and returns the binary path', async () => {
      spawnMock
        .mockImplementationOnce(() => fakeProcess(0))  // g++ --version probe
        .mockImplementationOnce(() => fakeProcess(0)); // compile

      const src = path.join(tmpDir, 'hello.cpp');
      const out = path.join(tmpDir, '.debug-mcp', 'hello');
      await fs.writeFile(src, 'int main(){}');

      const result = await compileSourceFile({ sourcePath: src, outputPath: out });

      expect(result.success).toBe(true);
      expect(result.binaryPath).toBe(out);
      const compileCall = spawnMock.mock.calls[1];
      expect(compileCall[0]).toBe('g++');
      // -gdwarf-4, not -g: MinGW gcc 11+ defaults to DWARF-5, whose line
      // tables LLDB cannot read from PE-COFF — breakpoints report
      // "Resolved locations: 0". DWARF-4 works on every platform.
      expect(compileCall[1]).toEqual(['-gdwarf-4', '-O0', '-o', out, src]);
    });

    it('fails with the sanitized stderr tail when compilation errors', async () => {
      const lines = Array.from({ length: 80 }, (_, i) => `error line ${i}`).join('\n');
      spawnMock
        .mockImplementationOnce(() => fakeProcess(0))          // probe
        .mockImplementationOnce(() => fakeProcess(1, lines));  // compile fails

      const src = path.join(tmpDir, 'bad.cpp');
      await fs.writeFile(src, 'int main(){');

      const result = await compileSourceFile({
        sourcePath: src,
        outputPath: path.join(tmpDir, '.debug-mcp', 'bad')
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('error line 79'); // tail survives
      expect(result.error).not.toContain('error line 0'); // head capped
    });

    it('fails when the compiler process itself errors (ENOENT mid-compile)', async () => {
      spawnMock.mockImplementationOnce(() => fakeProcess(0)); // probe
      spawnMock.mockImplementationOnce(() => {
        // Compile spawn emits 'error' and never 'exit'
        const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        setImmediate(() => proc.emit('error', new Error('ENOENT')));
        return proc;
      });

      const src = path.join(tmpDir, 'y.cpp');
      await fs.writeFile(src, 'int main(){}');

      const result = await compileSourceFile({
        sourcePath: src,
        outputPath: path.join(tmpDir, '.debug-mcp', 'y')
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Failed to run g\+\+/);
    });

    it('fails cleanly when no compiler is available', async () => {
      spawnMock.mockImplementation(() => fakeProcess(1));

      const src = path.join(tmpDir, 'x.c');
      await fs.writeFile(src, 'int main(){}');

      const result = await compileSourceFile({
        sourcePath: src,
        outputPath: path.join(tmpDir, '.debug-mcp', 'x')
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no c compiler found/i);
    });
  });
});
