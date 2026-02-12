import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import fs from 'node:fs';
import type { AdapterDependencies } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { GoAdapterFactory, GoDebugAdapter } from '@debugmcp/adapter-go';

vi.mock('child_process', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    spawn: vi.fn()
  };
});

const mockSpawn = vi.mocked(spawn);

const createMockDependencies = (): AdapterDependencies => ({
  fileSystem: {
    readFile: async () => '',
    writeFile: async () => {},
    exists: async () => false,
    mkdir: async () => {},
    readdir: async () => [],
    stat: async () => ({} as unknown as import('fs').Stats),
    unlink: async () => {},
    rmdir: async () => {},
    ensureDir: async () => {},
    ensureDirSync: () => {},
    pathExists: async () => false,
    existsSync: () => false,
    remove: async () => {},
    copy: async () => {},
    outputFile: async () => {}
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  },
  environment: {
    get: (key: string) => process.env[key],
    getAll: () => ({ ...process.env }),
    getCurrentWorkingDirectory: () => process.cwd()
  },
  processLauncher: {
    launch: vi.fn()
  } as AdapterDependencies['processLauncher']
});

describe('GoAdapterFactory', () => {
  let factory: GoAdapterFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    factory = new GoAdapterFactory();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('createAdapter', () => {
    it('should create a GoDebugAdapter instance', () => {
      const adapter = factory.createAdapter(createMockDependencies());
      expect(adapter).toBeInstanceOf(GoDebugAdapter);
    });

    it('should create adapter with correct language', () => {
      const adapter = factory.createAdapter(createMockDependencies());
      expect(adapter.language).toBe(DebugLanguage.GO);
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata', () => {
      const metadata = factory.getMetadata();
      
      expect(metadata.language).toBe(DebugLanguage.GO);
      expect(metadata.displayName).toBe('Go');
      expect(metadata.version).toBe('0.1.0');
      expect(metadata.description).toContain('Delve');
      expect(metadata.fileExtensions).toContain('.go');
    });

    it('should include documentation URL', () => {
      const metadata = factory.getMetadata();
      expect(metadata.documentationUrl).toContain('github.com');
    });

    it('should include icon', () => {
      const metadata = factory.getMetadata();
      expect(metadata.icon).toBeDefined();
      expect(metadata.icon).toContain('data:image/svg+xml');
    });
  });

  describe('validate', () => {
    it('should return valid when Go and Delve are available', async () => {
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      
      mockSpawn.mockImplementation((cmd, args) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          if (args?.[0] === 'version') {
            if (cmd.toString().includes('dlv')) {
              proc.stdout.emit('data', Buffer.from('Delve Debugger\nVersion: 1.21.0\n'));
            } else {
              proc.stdout.emit('data', Buffer.from('go version go1.21.0 darwin/arm64\n'));
            }
          } else if (args?.[0] === 'dap' && args?.[1] === '--help') {
            // DAP support check
          }
          proc.emit('exit', 0);
        });

        return proc;
      });

      const result = await factory.validate();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details).toBeDefined();
      expect(result.details?.goPath).toBeDefined();
      expect(result.details?.dlvPath).toBeDefined();
    });

    it('should return invalid when Go is not found', async () => {
      vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('Not found'));
      const originalPath = process.env.PATH;
      process.env.PATH = '';

      try {
        const result = await factory.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('not found');
      } finally {
        process.env.PATH = originalPath;
      }
    });

    it('should return error when Go version is too old', async () => {
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      
      mockSpawn.mockImplementation((cmd, args) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          if (args?.[0] === 'version') {
            if (cmd.toString().includes('dlv')) {
              proc.stdout.emit('data', Buffer.from('Delve Debugger\nVersion: 1.21.0\n'));
            } else {
              // Return old Go version
              proc.stdout.emit('data', Buffer.from('go version go1.16.0 darwin/arm64\n'));
            }
          }
          proc.emit('exit', 0);
        });

        return proc;
      });

      const result = await factory.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('1.18'))).toBe(true);
    });

    it('should return error when Delve is not found', async () => {
      let goFound = false;
      vi.spyOn(fs.promises, 'access').mockImplementation(async (p) => {
        if (p.toString().includes('go') && !p.toString().includes('dlv')) {
          goFound = true;
          return undefined;
        }
        throw new Error('Not found');
      });
      
      mockSpawn.mockImplementation((cmd, args) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          if (args?.[0] === 'version') {
            proc.stdout.emit('data', Buffer.from('go version go1.21.0 darwin/arm64\n'));
          }
          proc.emit('exit', 0);
        });

        return proc;
      });

      const result = await factory.validate();
      
      expect(result.errors.some(e => e.includes('Delve') || e.includes('dlv'))).toBe(true);
    });

    it('should return error when Delve does not support DAP', async () => {
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      
      mockSpawn.mockImplementation((cmd, args) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          if (args?.[0] === 'version') {
            if (cmd.toString().includes('dlv')) {
              proc.stdout.emit('data', Buffer.from('Delve Debugger\nVersion: 1.0.0\n'));
            } else {
              proc.stdout.emit('data', Buffer.from('go version go1.21.0 darwin/arm64\n'));
            }
            proc.emit('exit', 0);
          } else if (args?.[0] === 'dap' && args?.[1] === '--help') {
            // DAP not supported in old version
            proc.emit('exit', 1);
          } else {
            proc.emit('exit', 0);
          }
        });

        return proc;
      });

      const result = await factory.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('DAP'))).toBe(true);
    });

    it('should include platform info in details', async () => {
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from('go version go1.21.0\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      const result = await factory.validate();
      
      expect(result.details?.platform).toBe(process.platform);
      expect(result.details?.arch).toBe(process.arch);
      expect(result.details?.timestamp).toBeDefined();
    });
  });
});
