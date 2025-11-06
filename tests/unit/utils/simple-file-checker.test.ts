import { describe, it, expect, beforeEach, vi } from 'vitest';

const { resolvePathForRuntimeMock, getPathDescriptionMock } = vi.hoisted(() => ({
  resolvePathForRuntimeMock: vi.fn<(path: string) => string>(),
  getPathDescriptionMock: vi.fn<(original: string, resolved: string) => string>()
}));

vi.mock('../../../src/utils/container-path-utils.js', () => ({
  resolvePathForRuntime: resolvePathForRuntimeMock,
  getPathDescription: getPathDescriptionMock
}));

import {
  SimpleFileChecker,
  createSimpleFileChecker
} from '../../../src/utils/simple-file-checker.js';

describe('SimpleFileChecker', () => {
  const fileSystem = {
    pathExists: vi.fn<(path: string) => Promise<boolean>>(),
  };
  const environment = {} as unknown as Record<string, unknown>;
  const logger = { debug: vi.fn<(message: string, meta?: unknown) => void>() };

  beforeEach(() => {
    resolvePathForRuntimeMock.mockClear();
    getPathDescriptionMock.mockClear();
    fileSystem.pathExists.mockReset();
    logger.debug.mockClear();
  });

  it('resolves paths and returns existence result', async () => {
    resolvePathForRuntimeMock.mockReturnValue('/resolved/path');
    getPathDescriptionMock.mockReturnValue('desc');
    fileSystem.pathExists.mockResolvedValue(true);

    const checker = new SimpleFileChecker(fileSystem as any, environment as any, logger);
    const result = await checker.checkExists('script.py');

    expect(result).toEqual({
      exists: true,
      originalPath: 'script.py',
      effectivePath: '/resolved/path'
    });
    expect(logger.debug).toHaveBeenCalledWith(
      '[SimpleFileChecker] Checking existence: desc'
    );
  });

  it('propagates resolution errors with context', async () => {
    resolvePathForRuntimeMock.mockImplementation(() => {
      throw new Error('bad path');
    });

    const checker = createSimpleFileChecker(fileSystem as any, environment as any, logger);
    const result = await checker.checkExists('bad\\path');

    expect(result).toEqual({
      exists: false,
      originalPath: 'bad\\path',
      effectivePath: 'bad\\path',
      errorMessage: 'bad path'
    });
  });

  it('returns descriptive error when path existence check fails', async () => {
    resolvePathForRuntimeMock.mockReturnValue('/resolved/path');
    getPathDescriptionMock.mockReturnValue('desc');
    fileSystem.pathExists.mockRejectedValue(new Error('fs failure'));

    const checker = new SimpleFileChecker(fileSystem as any, environment as any, logger);
    const result = await checker.checkExists('script.py');

    expect(result).toEqual({
      exists: false,
      originalPath: 'script.py',
      effectivePath: '/resolved/path',
      errorMessage: 'Cannot check file existence: fs failure'
    });
    expect(logger.debug).toHaveBeenCalledWith(
      '[SimpleFileChecker] Check failed for /resolved/path: fs failure'
    );
  });
});
