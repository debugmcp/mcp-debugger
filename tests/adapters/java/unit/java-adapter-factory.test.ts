import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import fs from 'node:fs';
import type { AdapterDependencies } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { JavaAdapterFactory, JavaDebugAdapter } from '@debugmcp/adapter-java';

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

describe('JavaAdapterFactory', () => {
  let factory: JavaAdapterFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    factory = new JavaAdapterFactory();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('createAdapter', () => {
    it('should create a JavaDebugAdapter instance', () => {
      const adapter = factory.createAdapter(createMockDependencies());
      expect(adapter).toBeInstanceOf(JavaDebugAdapter);
    });

    it('should create adapter with correct language', () => {
      const adapter = factory.createAdapter(createMockDependencies());
      expect(adapter.language).toBe(DebugLanguage.JAVA);
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata', () => {
      const metadata = factory.getMetadata();

      expect(metadata.language).toBe(DebugLanguage.JAVA);
      expect(metadata.displayName).toBe('Java');
      expect(metadata.version).toBe('0.1.0');
      expect(metadata.description).toContain('kotlin-debug-adapter');
      expect(metadata.fileExtensions).toContain('.java');
    });

    it('should include documentation URL', () => {
      const metadata = factory.getMetadata();
      expect(metadata.documentationUrl).toContain('github.com');
    });
  });

  describe('validate', () => {
    it('should return valid when Java is available', async () => {
      mockSpawn.mockImplementation((_cmd, _args) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1" 2021-10-19\n'));
          proc.emit('exit', 0);
        });

        return proc;
      });

      const result = await factory.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details).toBeDefined();
      expect(result.details?.javaPath).toBeDefined();
    });

    it('should return invalid when Java is not found', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('spawn ENOENT')));
        return proc;
      });

      const originalPath = process.env.PATH;
      const originalJavaHome = process.env.JAVA_HOME;
      process.env.PATH = '';
      delete process.env.JAVA_HOME;

      try {
        const result = await factory.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      } finally {
        process.env.PATH = originalPath;
        if (originalJavaHome) process.env.JAVA_HOME = originalJavaHome;
      }
    });

    it('should warn when KDA is not vendored', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1"\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      const result = await factory.validate();

      // KDA won't be vendored in test environment
      expect(result.warnings?.some(w => w.includes('kotlin-debug-adapter'))).toBe(true);
    });

    it('should include platform info in details', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1"\n'));
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
