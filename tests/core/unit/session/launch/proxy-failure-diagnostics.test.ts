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
  lastAdapterStderrLine,
  logProxyFailure,
  quotesAdapterStderrLine,
  PROXY_LOG_TAIL_MAX_BYTES,
  readProxyLogTail
} from '../../../../../src/session/launch/proxy-failure-diagnostics.js';
import type { ProxyInitProgress } from '../../../../../src/utils/error-messages.js';
import { createMockLogger } from '../../../../test-utils/helpers/test-dependencies.js';
// The pre-configured double: readTail resolves '' (an empty log) unless a test
// programs it, which keeps the logProxyFailure tests on the read-succeeded path.
import { createMockFileSystem } from '../../../../test-utils/helpers/test-utils.js';

const initProgress: ProxyInitProgress = { transportConnected: true, pendingCommand: 'initialize' };

const runDir = path.join('/tmp', 'logs', 'sess-1', 'run-1');
const proxyLogPath = path.join(runDir, 'proxy-sess-1.log');
const proxyLogResource = 'debug://sessions/sess-1/proxy-log';

/** A winston log file: every line newline-TERMINATED, so the text ends in a newline. */
function logFile(lines: string[]): string {
  return lines.map((line) => `${line}\n`).join('');
}

function enoent(): NodeJS.ErrnoException {
  return Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
}

describe('collectProxyFailureDiagnostics', () => {
  it('carries the init progress the timeout error rode in on', () => {
    const error = Object.assign(new Error('proxy init timed out'), { initProgress });

    expect(collectProxyFailureDiagnostics({ id: 'sess-1', logDir: runDir }, error)).toEqual({
      initProgress,
      proxyLogPath,
      proxyLogResource
    });
  });

  it('still points at the proxy log when the error carries no init progress', () => {
    expect(
      collectProxyFailureDiagnostics({ id: 'sess-1', logDir: runDir }, new Error('adapter exited'))
    ).toEqual({ proxyLogPath, proxyLogResource });
  });

  it('keeps the session-derived pointer when the error refuses to be read', () => {
    // The log path comes from the session and the init progress from the error;
    // a hostile error must cost only the field that depends on it, or the tool
    // result loses `data` entirely.
    const hostile = {
      get initProgress(): never {
        throw new Error('initProgress getter exploded');
      }
    };

    expect(collectProxyFailureDiagnostics({ id: 'sess-1', logDir: runDir }, hostile)).toEqual({
      proxyLogPath,
      proxyLogResource
    });
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
  it('returns only the last N content lines, so a long log cannot swamp the record', async () => {
    const fileSystem = createMockFileSystem();
    const allLines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`);
    vi.mocked(fileSystem.readTail).mockResolvedValue(logFile(allLines));

    const tail = await readProxyLogTail(fileSystem, proxyLogPath, 80);

    // 80 lines of CONTENT: the file's trailing newline is a terminator, not a line.
    const tailLines = tail!.split('\n');
    expect(tailLines).toHaveLength(80);
    expect(tailLines[0]).toBe('line 121');
    expect(tailLines[79]).toContain('line 200');
    // The shared tailer labels what it dropped.
    expect(tail).toContain('(last 80 of 200 lines)');
    expect(fileSystem.readTail).toHaveBeenCalledWith(proxyLogPath, PROXY_LOG_TAIL_MAX_BYTES);
  });

  it('splits CRLF logs, so a Windows proxy log is not one giant line', async () => {
    const fileSystem = createMockFileSystem();
    vi.mocked(fileSystem.readTail).mockResolvedValue('first\r\nsecond\r\nthird\r\n');

    expect(await readProxyLogTail(fileSystem, proxyLogPath, 2)).toBe(
      'second\nthird (last 2 of 3 lines)'
    );
  });

  it('redacts secret-shaped lines instead of copying them into the server log', async () => {
    const fileSystem = createMockFileSystem();
    // The proxy log carries raw adapter argv and DAP output bodies, so the lines
    // a failure makes interesting are exactly the ones that can hold a token.
    vi.mocked(fileSystem.readTail).mockResolvedValue(
      logFile(['[Worker] spawning adapter', '[Worker] argv: --token=super-secret-value'])
    );

    const tail = await readProxyLogTail(fileSystem, proxyLogPath);

    expect(tail).toContain('[Worker] spawning adapter');
    expect(tail).not.toContain('super-secret-value');
    expect(tail).toContain('[REDACTED');
  });

  it('reads nothing when there is no path to read', async () => {
    const fileSystem = createMockFileSystem();

    expect(await readProxyLogTail(fileSystem, undefined)).toBeUndefined();
    expect(fileSystem.readTail).not.toHaveBeenCalled();
  });

  it('reads nothing when the proxy never got as far as writing its log', async () => {
    const fileSystem = createMockFileSystem();
    // ENOENT is the answer an exists-check would have bought, one syscall later
    // and with a rotation race in between.
    vi.mocked(fileSystem.readTail).mockRejectedValue(enoent());

    expect(await readProxyLogTail(fileSystem, proxyLogPath)).toBeUndefined();
  });

  it('reports any other read failure as the tail rather than throwing over the real error', async () => {
    const fileSystem = createMockFileSystem();
    vi.mocked(fileSystem.readTail).mockRejectedValue(new Error('permission denied'));

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

  it('does not redundantly serialize the raw error object', () => {
    const circular: Record<string, unknown> = { message: 'cycle' };
    circular.self = circular;

    expect(buildProxyFailureErrorDetails(circular, {}, undefined)).not.toHaveProperty('raw');
  });

  it('describes a thrown non-error without pretending it has a stack', () => {
    const details = buildProxyFailureErrorDetails('boom', {}, undefined);

    expect(details.message).toBe('boom');
    expect(details.stack).toBe('No stack available');
  });
});

describe('logProxyFailure', () => {
  it('names the failing operation in the log line', async () => {
    const logger = createMockLogger();
    const fileSystem = createMockFileSystem();

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
    const logger = createMockLogger();
    const fileSystem = createMockFileSystem();

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

  it('survives an error object whose toString throws, rather than rejecting', async () => {
    const logger = createMockLogger();
    const fileSystem = createMockFileSystem();
    // Both callers await this from inside a catch that is about to return
    // {success:false}; a throw here would turn a reported failure into a
    // rejection out of the tool call.
    const hostile = {
      get message(): string {
        throw new Error('message getter exploded');
      },
      toString(): string {
        throw new Error('toString exploded');
      }
    };

    const diagnostics = await logProxyFailure(
      { logger, fileSystem },
      { id: 'sess-1', logDir: runDir },
      hostile,
      'attachToProcess'
    );

    // The pointers still reach the caller, and the log still names the failure.
    expect(diagnostics).toEqual({ proxyLogPath, proxyLogResource });
    expect(logger.error).toHaveBeenCalledWith(
      '[SessionManager] Detailed error in attachToProcess for session sess-1:',
      expect.objectContaining({
        message: '<<error could not be described>>',
        proxyLogPath,
        diagnosticsUnavailable: expect.stringContaining('exploded')
      })
    );
  });

  it('survives an error whose initProgress getter throws, keeping the log path', async () => {
    const logger = createMockLogger();
    const fileSystem = createMockFileSystem();
    const hostile = Object.defineProperty(new Error('proxy init timed out'), 'initProgress', {
      get(): never {
        throw new Error('initProgress getter exploded');
      }
    });

    const diagnostics = await logProxyFailure(
      { logger, fileSystem },
      { id: 'sess-1', logDir: runDir },
      hostile,
      'attachToProcess'
    );

    // The hostile field costs itself and nothing else: the record is the full
    // one, not the degraded fallback.
    expect(diagnostics).toEqual({ proxyLogPath, proxyLogResource });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Detailed error in attachToProcess'),
      expect.objectContaining({
        message: 'proxy init timed out',
        proxyLogPath,
        initProgress: undefined
      })
    );
  });

  it('survives a logger that throws, since there is nowhere left to report it', async () => {
    const logger = createMockLogger();
    const fileSystem = createMockFileSystem();
    vi.mocked(logger.error).mockImplementation(() => {
      throw new Error('transport closed');
    });

    await expect(
      logProxyFailure(
        { logger, fileSystem },
        { id: 'sess-1', logDir: runDir },
        new Error('attach failed'),
        'attachToProcess'
      )
    ).resolves.toEqual({ proxyLogPath, proxyLogResource });
  });

  it('logs the proxy log tail but returns only the pointers', async () => {
    const logger = createMockLogger();
    const fileSystem = createMockFileSystem();
    vi.mocked(fileSystem.readTail).mockResolvedValue(logFile(['adapter said: could not open port']));
    const error = Object.assign(new Error('proxy init timed out'), { initProgress });

    const diagnostics = await logProxyFailure(
      { logger, fileSystem },
      { id: 'sess-1', logDir: runDir },
      error,
      'attachToProcess'
    );

    expect(diagnostics).toEqual({ initProgress, proxyLogPath, proxyLogResource });
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ proxyLogTail: 'adapter said: could not open port' })
    );
  });
});

describe('lastAdapterStderrLine (issue #897)', () => {
  it('picks the Error line over the stack frames printed under it', () => {
    expect(lastAdapterStderrLine([
      'Error: Could not connect to debug target at http://localhost:5678: Could not find any debuggable target',
      '    at C:\\vendor\\js-debug\\vsDebugServer.cjs:91:49334',
      '    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)',
      '    at async Server.<anonymous> (vsDebugServer.cjs:106:3656)'
    ])).toBe('Error: Could not connect to debug target at http://localhost:5678: Could not find any debuggable target');
  });

  it('takes the last non-frame line when several precede the frames', () => {
    expect(lastAdapterStderrLine(['warning: old', '  fatal: new  ', '    at x'])).toBe('fatal: new');
  });

  it('skips the `from` frames of a Ruby backtrace', () => {
    expect(lastAdapterStderrLine([
      "/app/boot.rb:3:in 'start': no such file (Errno::ENOENT)",
      '\tfrom /app/boot.rb:9:in <main>',
      "\tfrom /usr/lib/ruby/debug.rb:12:in 'run'"
    ])).toBe("/app/boot.rb:3:in 'start': no such file (Errno::ENOENT)");
  });

  it('answers nothing for a missing, empty or all-frame tail', () => {
    expect(lastAdapterStderrLine(undefined)).toBeUndefined();
    expect(lastAdapterStderrLine([])).toBeUndefined();
    expect(lastAdapterStderrLine(['    at a', '  ', '    at b'])).toBeUndefined();
  });
});

describe('quotesAdapterStderrLine (issue #897)', () => {
  it('sees the line behind its log tag, as an adapter error answer repeats it', () => {
    expect(quotesAdapterStderrLine(
      'Critical initialization error: Could not attach: no process found with process ID 4 [Adapter command: …]',
      '[ERROR codelldb::debug_session] Could not attach: no process found with process ID 4'
    )).toBe(true);
  });

  it('sees a truncated line by its prefix', () => {
    const long = `Error: ${'x'.repeat(50)}`;
    expect(quotesAdapterStderrLine(`refused: ${long} and more`, `${long}…`)).toBe(true);
  });

  it('never treats a bare tag or an unrelated line as already quoted', () => {
    expect(quotesAdapterStderrLine('anything', '[WARN codelldb]')).toBe(false);
    expect(quotesAdapterStderrLine('DAP client error: read ECONNRESET', 'Error: boom')).toBe(false);
  });
});
