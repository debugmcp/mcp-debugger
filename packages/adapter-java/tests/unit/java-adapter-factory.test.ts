import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { JavaAdapterFactory } from '../../src/java-adapter-factory.js';
import { JavaDebugAdapter } from '../../src/java-debug-adapter.js';
import {
  findJavaExecutable,
  getJavaVersion,
  findJdb,
  validateJdb
} from '../../src/utils/java-utils.js';

vi.mock('../../src/utils/java-utils.js', () => ({
  findJavaExecutable: vi.fn(),
  getJavaVersion: vi.fn(),
  parseJavaMajorVersion: vi.fn((version: string) => {
    // Simple implementation for testing
    if (version.startsWith('1.')) {
      return parseInt(version.split('.')[1], 10);
    }
    return parseInt(version.split('.')[0], 10);
  }),
  findJdb: vi.fn(),
  validateJdb: vi.fn(),
  findJavaHome: vi.fn()
}));

const findJavaExecutableMock = vi.mocked(findJavaExecutable);
const getJavaVersionMock = vi.mocked(getJavaVersion);
const findJdbMock = vi.mocked(findJdb);
const validateJdbMock = vi.mocked(validateJdb);

const createDependencies = (): AdapterDependencies & {
  logger: { info: () => void; debug: () => void; error: () => void };
} => ({
  fileSystem: {} as unknown,
  processLauncher: {} as unknown,
  environment: {
    get: () => undefined,
    getAll: () => ({}),
    getCurrentWorkingDirectory: () => process.cwd()
  },
  logger: {
    info: () => undefined,
    debug: () => undefined,
    error: () => undefined
  }
});

describe('JavaAdapterFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findJavaExecutableMock.mockReset();
    getJavaVersionMock.mockReset();
    findJdbMock.mockReset();
    validateJdbMock.mockReset();
  });

  it('creates JavaDebugAdapter instances with provided dependencies', () => {
    const factory = new JavaAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());

    expect(adapter).toBeInstanceOf(JavaDebugAdapter);
    expect(adapter.language).toBe(DebugLanguage.JAVA);
    expect(adapter.name).toBe('Java Debug Adapter (jdb)');
  });

  describe('getMetadata', () => {
    it('returns correct metadata for Java adapter', () => {
      const factory = new JavaAdapterFactory();
      const metadata = factory.getMetadata();

      expect(metadata.language).toBe(DebugLanguage.JAVA);
      expect(metadata.displayName).toBe('Java');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toContain('jdb');
      expect(metadata.fileExtensions).toContain('.java');
      expect(metadata.fileExtensions).toContain('.class');
    });
  });

  describe('validate', () => {
    it('validates successfully with Java 17 and jdb available', async () => {
      findJavaExecutableMock.mockResolvedValue('/usr/bin/java');
      getJavaVersionMock.mockResolvedValue('17.0.1');
      findJdbMock.mockResolvedValue('/usr/bin/jdb');
      validateJdbMock.mockResolvedValue(true);

      const factory = new JavaAdapterFactory();
      const result = await factory.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details?.javaPath).toBe('/usr/bin/java');
      expect(result.details?.javaVersion).toBe('17.0.1');
      expect(result.details?.jdbPath).toBe('/usr/bin/jdb');
    });

    it('validates successfully with Java 8', async () => {
      findJavaExecutableMock.mockResolvedValue('/usr/bin/java');
      getJavaVersionMock.mockResolvedValue('1.8.0_392');
      findJdbMock.mockResolvedValue('/usr/bin/jdb');
      validateJdbMock.mockResolvedValue(true);

      const factory = new JavaAdapterFactory();
      const result = await factory.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails validation with Java 7', async () => {
      findJavaExecutableMock.mockResolvedValue('/usr/bin/java');
      getJavaVersionMock.mockResolvedValue('1.7.0_80');
      findJdbMock.mockResolvedValue('/usr/bin/jdb');
      validateJdbMock.mockResolvedValue(true);

      const factory = new JavaAdapterFactory();
      const result = await factory.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Java 8 or higher required');
    });

    it('fails validation when Java is not found', async () => {
      findJavaExecutableMock.mockRejectedValue(new Error('Java not found'));

      const factory = new JavaAdapterFactory();
      const result = await factory.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Java not found');
    });

    it('fails validation when jdb is not found', async () => {
      findJavaExecutableMock.mockResolvedValue('/usr/bin/java');
      getJavaVersionMock.mockResolvedValue('17.0.1');
      findJdbMock.mockRejectedValue(new Error('jdb not found'));

      const factory = new JavaAdapterFactory();
      const result = await factory.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('jdb not found');
    });

    it('fails validation when jdb validation fails', async () => {
      findJavaExecutableMock.mockResolvedValue('/usr/bin/java');
      getJavaVersionMock.mockResolvedValue('17.0.1');
      findJdbMock.mockResolvedValue('/usr/bin/jdb');
      validateJdbMock.mockResolvedValue(false);

      const factory = new JavaAdapterFactory();
      const result = await factory.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('failed validation');
    });

    it('adds warning when Java version cannot be determined', async () => {
      findJavaExecutableMock.mockResolvedValue('/usr/bin/java');
      getJavaVersionMock.mockResolvedValue(null);
      findJdbMock.mockResolvedValue('/usr/bin/jdb');
      validateJdbMock.mockResolvedValue(true);

      const factory = new JavaAdapterFactory();
      const result = await factory.validate();

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Could not determine Java version');
    });
  });
});
