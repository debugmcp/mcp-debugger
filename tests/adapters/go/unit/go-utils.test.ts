import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'events';
import {
  findGoExecutable,
  findDelveExecutable,
  getGoVersion,
  getDelveVersion,
  checkDelveDapSupport,
  getGoSearchPaths
} from '@debugmcp/adapter-go';

vi.mock('child_process', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    spawn: vi.fn()
  };
});

const mockSpawn = vi.mocked(spawn);

describe('go-utils', () => {
  let mockLogger: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('findGoExecutable', () => {
    // Only test the current platform - cross-platform mocking of process.platform is unreliable
    describe(`on ${process.platform} platform (current)`, () => {
      const platform = process.platform;

      it('should return preferred path if it exists', async () => {
        const customPath = platform === 'win32' ? 'C:\\Go\\bin\\go.exe' : '/custom/go';
        vi.spyOn(fs.promises, 'access').mockResolvedValueOnce(undefined);

        const result = await findGoExecutable(customPath, mockLogger);
        expect(result).toBe(customPath);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('preferred'));
      });

      it('should find go in PATH', async () => {
        const expectedPath = platform === 'win32' ? 'C:\\Go\\bin\\go.exe' : '/usr/local/go/bin/go';
        
        vi.spyOn(fs.promises, 'access').mockImplementation(async (p) => {
          if (p === expectedPath) return undefined;
          throw new Error('Not found');
        });

        const pathEnv = platform === 'win32' ? 'C:\\Go\\bin' : '/usr/local/go/bin';
        const originalPath = process.env.PATH;
        process.env.PATH = pathEnv;

        try {
          const result = await findGoExecutable(undefined, mockLogger);
          expect(result).toBe(expectedPath);
        } finally {
          process.env.PATH = originalPath;
        }
      });

      it('should throw error if go not found', async () => {
        vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('Not found'));
        process.env.PATH = '';

        await expect(findGoExecutable(undefined, mockLogger))
          .rejects.toThrow('Go executable not found');
      });
    });
  });

  describe('findDelveExecutable', () => {
    // Only test the current platform - cross-platform mocking of process.platform is unreliable
    describe(`on ${process.platform} platform (current)`, () => {
      const platform = process.platform;

      it('should return preferred path if it exists', async () => {
        const customPath = platform === 'win32' ? 'C:\\Go\\bin\\dlv.exe' : '/custom/dlv';
        vi.spyOn(fs.promises, 'access').mockResolvedValueOnce(undefined);

        const result = await findDelveExecutable(customPath, mockLogger);
        expect(result).toBe(customPath);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('preferred'));
      });

      it('should find dlv in GOPATH/bin', async () => {
        // Use platform-appropriate home paths
        const home = platform === 'win32' 
          ? 'C:\\Users\\test' 
          : platform === 'darwin' 
            ? '/Users/test' 
            : '/home/test';
        const expectedPath = path.join(home, 'go', 'bin', platform === 'win32' ? 'dlv.exe' : 'dlv');
        
        vi.spyOn(fs.promises, 'access').mockImplementation(async (p) => {
          if (p === expectedPath) return undefined;
          throw new Error('Not found');
        });

        const originalHome = process.env.HOME;
        const originalUserProfile = process.env.USERPROFILE;
        const originalGoPath = process.env.GOPATH;
        const originalGoBin = process.env.GOBIN;
        const originalPath = process.env.PATH;
        
        process.env.HOME = home;
        process.env.USERPROFILE = home;
        process.env.PATH = '';
        delete process.env.GOPATH;
        delete process.env.GOBIN;

        try {
          const result = await findDelveExecutable(undefined, mockLogger);
          expect(result).toBe(expectedPath);
        } finally {
          process.env.HOME = originalHome;
          process.env.USERPROFILE = originalUserProfile;
          process.env.PATH = originalPath;
          if (originalGoPath !== undefined) {
            process.env.GOPATH = originalGoPath;
          }
          if (originalGoBin !== undefined) {
            process.env.GOBIN = originalGoBin;
          }
        }
      });

      it('should throw error if dlv not found', async () => {
        vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('Not found'));
        process.env.PATH = '';
        delete process.env.GOPATH;
        delete process.env.GOBIN;

        await expect(findDelveExecutable(undefined, mockLogger))
          .rejects.toThrow('Delve (dlv) not found');
      });
    });
  });

  describe('getGoVersion', () => {
    it('should return Go version string', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from('go version go1.21.0 darwin/arm64\n'));
          proc.emit('exit', 0);
        });

        return proc;
      });

      const version = await getGoVersion('/usr/local/go/bin/go');
      expect(version).toBe('1.21.0');
    });

    it('should parse version with minor only', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from('go version go1.22 linux/amd64\n'));
          proc.emit('exit', 0);
        });

        return proc;
      });

      const version = await getGoVersion('/usr/local/go/bin/go');
      expect(version).toBe('1.22');
    });

    it('should return null on spawn error', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('spawn failed')));
        return proc;
      });

      const version = await getGoVersion('/usr/local/go/bin/go');
      expect(version).toBeNull();
    });

    it('should return null on non-zero exit code', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('exit', 1));
        return proc;
      });

      const version = await getGoVersion('/usr/local/go/bin/go');
      expect(version).toBeNull();
    });
  });

  describe('getDelveVersion', () => {
    it('should return Delve version string', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from('Delve Debugger\nVersion: 1.21.0\nBuild: ...\n'));
          proc.emit('exit', 0);
        });

        return proc;
      });

      const version = await getDelveVersion('/home/user/go/bin/dlv');
      expect(version).toBe('1.21.0');
    });

    it('should return null on spawn error', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('spawn failed')));
        return proc;
      });

      const version = await getDelveVersion('/home/user/go/bin/dlv');
      expect(version).toBeNull();
    });

    it('should return null on non-zero exit code', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('exit', 1));
        return proc;
      });

      const version = await getDelveVersion('/home/user/go/bin/dlv');
      expect(version).toBeNull();
    });
  });

  describe('checkDelveDapSupport', () => {
    it('should return true if dlv dap --help succeeds', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('exit', 0));
        return proc;
      });

      const result = await checkDelveDapSupport('/home/user/go/bin/dlv');
      expect(result).toBe(true);
    });

    it('should return false if dlv dap --help fails', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('exit', 1));
        return proc;
      });

      const result = await checkDelveDapSupport('/home/user/go/bin/dlv');
      expect(result).toBe(false);
    });

    it('should return false on spawn error', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('spawn failed')));
        return proc;
      });

      const result = await checkDelveDapSupport('/home/user/go/bin/dlv');
      expect(result).toBe(false);
    });
  });

  describe('getGoSearchPaths', () => {
    describe.each(['win32', 'linux', 'darwin'])('on %s platform', (platform) => {
      beforeEach(() => {
        vi.stubGlobal('process', { ...process, platform });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('should return platform-specific paths', () => {
        const paths = getGoSearchPaths();
        expect(Array.isArray(paths)).toBe(true);
        expect(paths.length).toBeGreaterThan(0);

        if (platform === 'win32') {
          expect(paths.some(p => p.includes('C:\\'))).toBe(true);
        } else if (platform === 'darwin') {
          expect(paths.some(p => p.includes('/usr/local/go') || p.includes('homebrew'))).toBe(true);
        } else {
          expect(paths.some(p => p.includes('/usr/'))).toBe(true);
        }
      });

      it('should include GOBIN if set', () => {
        const originalGobin = process.env.GOBIN;
        process.env.GOBIN = '/custom/gobin';

        try {
          const paths = getGoSearchPaths();
          expect(paths[0]).toBe('/custom/gobin');
        } finally {
          if (originalGobin) {
            process.env.GOBIN = originalGobin;
          } else {
            delete process.env.GOBIN;
          }
        }
      });
    });
  });
});
