/**
 * The proxy-failure diagnostics have two audiences and the split between them
 * is the thing worth protecting: the tool result gets *pointers* (which init
 * stage stalled, where the proxy log is), the server log gets the whole record
 * including the log tail. Putting the tail in the result would bury the error
 * for the agent reading it; leaving it out of the log is what made a failed
 * attach undiagnosable before issue #561.
 */
import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import {
  buildProxyFailureErrorDetails,
  collectProxyFailureDiagnostics,
  logProxyFailure,
  readProxyLogTail
} from '../../../../../src/session/launch/proxy-failure-diagnostics.js';
import type { IFileSystem, ILogger } from '../../../../../src/interfaces/external-dependencies.js';
import type { ProxyInitProgress } from '../../../../../src/utils/error-messages.js';

const initProgress: ProxyInitProgress = { transportConnected: true, pendingCommand: 'initialize' };

const runDir = path.join('/tmp', 'logs', 'sess-1', 'run-1');
const proxyLogPath = path.join(runDir, 'proxy-sess-1.log');

function createLogger() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } satisfies ILogger;
}

function createFileSystem() {
  return {
    pathExists: vi.fn<IFileSystem['pathExists']>(async () => true),
    readFile: vi.fn<IFileSystem['readFile']>(async () => '')
  };
}

describe('collectProxyFailureDiagnostics', () => {
  it('carries the init progress the timeout error rode in on', () => {
    const error = Object.assign(new Error('proxy init timed out'), { initProgress });

    expect(collectProxyFailureDiagnostics({ id: 'sess-1', logDir: runDir }, error)).toEqual({
      initProgress,
      proxyLogPath
    });
  });

  it('still points at the proxy log when the error carries no init progress', () => {
    expect(
      collectProxyFailureDiagnostics({ id: 'sess-1', logDir: runDir }, new Error('adapter exited'))
    ).toEqual({ proxyLogPath });
  });

  it('invents nothing for a failure that happened before a log directory existed', () => {
    expect(
      collectProxyFailureDiagnostics({ id: 'sess-1', logDir: undefined }, new Error('bad config'))
    ).toEqual({});
  });

  it('tolerates a thrown non-error', () => {
    expect(collectProxyFailureDiagnostics({ id: 'sess-1', logDir: undefined }, 'boom')).toEqual({});
  });
});

describe('readProxyLogTail', () => {
  it('returns only the last N lines, so a long log cannot swamp the record', async () => {
    const fileSystem = createFileSystem();
    const allLines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`);
    fileSystem.readFile.mockResolvedValue(allLines.join('\n'));

    const tail = await readProxyLogTail(fileSystem, proxyLogPath, 80);

    expect(tail?.split('\n')).toHaveLength(80);
    expect(tail).toContain('line 200');
    expect(tail).not.toContain('line 120\n');
  });

  it('splits CRLF logs, so a Windows proxy log is not one giant line', async () => {
    const fileSystem = createFileSystem();
    fileSystem.readFile.mockResolvedValue('first\r\nsecond\r\nthird');

    expect(await readProxyLogTail(fileSystem, proxyLogPath, 2)).toBe('second\nthird');
  });

  it('reads nothing when there is no path to read', async () => {
    const fileSystem = createFileSystem();

    expect(await readProxyLogTail(fileSystem, undefined)).toBeUndefined();
    expect(fileSystem.pathExists).not.toHaveBeenCalled();
  });

  it('reads nothing when the proxy never got as far as writing its log', async () => {
    const fileSystem = createFileSystem();
    fileSystem.pathExists.mockResolvedValue(false);

    expect(await readProxyLogTail(fileSystem, proxyLogPath)).toBeUndefined();
    expect(fileSystem.readFile).not.toHaveBeenCalled();
  });

  it('reports a read failure as the tail rather than throwing over the real error', async () => {
    const fileSystem = createFileSystem();
    fileSystem.readFile.mockRejectedValue(new Error('permission denied'));

    expect(await readProxyLogTail(fileSystem, proxyLogPath)).toBe(
      '<<Failed to read proxy log: permission denied>>'
    );
  });
});

describe('buildProxyFailureErrorDetails', () => {
  it('captures the identity of a system error, not just its message', () => {
    const error = Object.assign(new Error('spawn ENOENT'), {
      code: 'ENOENT',
      errno: -4058,
      syscall: 'spawn',
      path: 'python'
    });

    const details = buildProxyFailureErrorDetails(error, { initProgress, proxyLogPath }, 'tail');

    expect(details).toMatchObject({
      type: 'Error',
      message: 'spawn ENOENT',
      code: 'ENOENT',
      errno: -4058,
      syscall: 'spawn',
      path: 'python',
      initProgress,
      proxyLogPath,
      proxyLogTail: 'tail'
    });
    expect(details.stack).toContain('spawn ENOENT');
  });

  it('says so rather than throwing when the error will not serialize', () => {
    const circular: Record<string, unknown> = { message: 'cycle' };
    circular.self = circular;

    expect(buildProxyFailureErrorDetails(circular, {}, undefined).raw).toBe(
      'Error not JSON serializable'
    );
  });

  it('describes a thrown non-error without pretending it has a stack', () => {
    const details = buildProxyFailureErrorDetails('boom', {}, undefined);

    expect(details.message).toBe('boom');
    expect(details.stack).toBe('No stack available');
  });
});

describe('logProxyFailure', () => {
  it('names the failing operation in the log line', async () => {
    const logger = createLogger();
    const fileSystem = createFileSystem();

    await logProxyFailure(
      { logger, fileSystem },
      { id: 'sess-1', logDir: runDir },
      new Error('attach failed'),
      'attachToProcess'
    );

    expect(logger.error).toHaveBeenCalledWith(
      '[SessionManager] Detailed error in attachToProcess for session sess-1:',
      expect.objectContaining({ message: 'attach failed' })
    );
  });

  it('keeps the launch literal the existing suites pin', async () => {
    const logger = createLogger();
    const fileSystem = createFileSystem();

    await logProxyFailure(
      { logger, fileSystem },
      { id: 'sess-1', logDir: runDir },
      new Error('launch failed'),
      'startDebugging'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Detailed error in startDebugging'),
      expect.any(Object)
    );
  });

  it('logs the proxy log tail but returns only the pointers', async () => {
    const logger = createLogger();
    const fileSystem = createFileSystem();
    fileSystem.readFile.mockResolvedValue('adapter said: could not open port');
    const error = Object.assign(new Error('proxy init timed out'), { initProgress });

    const diagnostics = await logProxyFailure(
      { logger, fileSystem },
      { id: 'sess-1', logDir: runDir },
      error,
      'attachToProcess'
    );

    expect(diagnostics).toEqual({ initProgress, proxyLogPath });
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ proxyLogTail: 'adapter said: could not open port' })
    );
  });
});
