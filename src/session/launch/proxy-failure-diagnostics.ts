/**
 * Diagnostics for a launch or attach that failed while the debug proxy was
 * coming up.
 *
 * Two audiences, deliberately kept apart:
 *
 * - The **tool result** gets pointers only — which init stage stalled and where
 *   the proxy log lives. That shape is pinned by tests and is what an agent
 *   reads; dumping 80 lines of adapter chatter into it would bury the error.
 * - The **server log** gets the full record: the error's type/code/errno/syscall,
 *   the init progress, and the tail of the proxy log, which is usually the only
 *   place the adapter's own complaint appears.
 *
 * Launch had all of this; attach had only the pointers, so an attach that died
 * during proxy initialization left the actual cause unreadable (issue #561).
 * Both paths now call `logProxyFailure`, which is why it lives here rather than
 * in either one.
 */
import type { ManagedSession } from '../session-store.js';
import type { IFileSystem, ILogger } from '../../interfaces/external-dependencies.js';
import type { ProxyInitProgress } from '../../utils/error-messages.js';
import { proxyLogPathFor } from '../../proxy/proxy-log-path.js';

/** How many trailing proxy-log lines are worth reading after a failure. */
const PROXY_LOG_TAIL_LINES = 80;

/** The pointers a failed launch/attach returns to the caller (issue #493 / #551). */
export interface ProxyFailureDiagnostics {
  initProgress?: ProxyInitProgress;
  proxyLogPath?: string;
}

/**
 * What `logProxyFailure` needs. Declared here, as the narrowest possible slice,
 * so the module has no dependency on the session manager's shape.
 */
export interface ProxyFailureLogDeps {
  logger: ILogger;
  fileSystem: Pick<IFileSystem, 'pathExists' | 'readFile'>;
}

/** The two operations that can fail this way, named as they appear in the log. */
export type ProxyFailureOperation = 'startDebugging' | 'attachToProcess';

/**
 * Pointers to proxy initialization diagnostics for a failed launch/attach
 * (issue #493 / #551): which init stage stalled (from the timeout error) and
 * where the proxy log for the session's current run lives.
 */
export function collectProxyFailureDiagnostics(
  session: Pick<ManagedSession, 'id' | 'logDir'>,
  error: unknown
): ProxyFailureDiagnostics {
  const diagnostics: ProxyFailureDiagnostics = {};
  const initProgress = (error as { initProgress?: ProxyInitProgress } | null)?.initProgress;

  if (initProgress) {
    diagnostics.initProgress = initProgress;
  }
  if (session.logDir) {
    diagnostics.proxyLogPath = proxyLogPathFor(session.logDir, session.id);
  }

  return diagnostics;
}

/**
 * Read the last `tailLineCount` lines of the proxy log, if there is one.
 *
 * Never throws: a failure to read the log is itself reported *as* the tail, so
 * the setup error that sent us here still reaches the log intact.
 */
export async function readProxyLogTail(
  fileSystem: Pick<IFileSystem, 'pathExists' | 'readFile'>,
  proxyLogPath: string | undefined,
  tailLineCount: number = PROXY_LOG_TAIL_LINES
): Promise<string | undefined> {
  try {
    if (!proxyLogPath) {
      return undefined;
    }
    const logExists = await fileSystem.pathExists(proxyLogPath);
    if (!logExists) {
      return undefined;
    }
    const logContent = await fileSystem.readFile(proxyLogPath, 'utf-8');
    const logLines = logContent.split(/\r?\n/);
    const startIndex = Math.max(0, logLines.length - tailLineCount);
    return logLines.slice(startIndex).join('\n');
  } catch (logReadError) {
    return `<<Failed to read proxy log: ${
      logReadError instanceof Error ? logReadError.message : String(logReadError)
    }>>`;
  }
}

/**
 * The comprehensive error record written to the server log — originally added
 * to make Windows CI failures diagnosable from the log alone.
 */
export function buildProxyFailureErrorDetails(
  error: unknown,
  diagnostics: ProxyFailureDiagnostics,
  proxyLogTail: string | undefined
): Record<string, unknown> {
  const errorDetails: Record<string, unknown> = {
    type: error?.constructor?.name || 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : 'No stack available',
    code: (error as Record<string, unknown>)?.code,
    errno: (error as Record<string, unknown>)?.errno,
    syscall: (error as Record<string, unknown>)?.syscall,
    path: (error as Record<string, unknown>)?.path,
    toString: error?.toString ? error.toString() : 'No toString',
    initProgress: diagnostics.initProgress,
    proxyLogPath: diagnostics.proxyLogPath,
    proxyLogTail
  };

  // Try to capture raw error object
  try {
    errorDetails.raw = JSON.stringify(error);
  } catch {
    errorDetails.raw = 'Error not JSON serializable';
  }

  return errorDetails;
}

/**
 * Describe a thrown value without trusting it. `String(error)` runs the value's
 * own `toString`, and `error.message` runs its own getter — either can throw.
 */
function describeErrorSafely(error: unknown): string {
  try {
    return error instanceof Error ? error.message : String(error);
  } catch {
    return '<<error could not be described>>';
  }
}

/**
 * Log without trusting the logger. There is nowhere left to report a logger
 * that throws, so it is dropped rather than allowed to become the caller's
 * failure.
 */
function logSafely(logger: ILogger, message: string, meta: unknown): void {
  try {
    logger.error(message, meta);
  } catch {
    // Deliberately empty — see above.
  }
}

/**
 * Log the full failure record and hand back the pointers for the tool result.
 *
 * Returning the diagnostics is what keeps the two audiences consistent: the
 * caller reports exactly the paths that were just written to the log, without
 * collecting them twice.
 *
 * **Total by construction.** Both callers `await` this from inside a `catch`
 * that is about to `return { success: false, … }`, so anything thrown here
 * would convert a reported failure into a rejection out of `start_debugging` /
 * `attach_to_process` — turning a diagnosable error into an opaque one, which
 * is the exact opposite of the point. The record is built from a value that has
 * already misbehaved once, and any of its property reads (`toString`, a
 * `message` getter) can misbehave again, so building and logging are both
 * guarded: a failure there degrades to a minimal record instead of escaping.
 */
export async function logProxyFailure(
  deps: ProxyFailureLogDeps,
  session: Pick<ManagedSession, 'id' | 'logDir'>,
  error: unknown,
  operation: ProxyFailureOperation
): Promise<ProxyFailureDiagnostics> {
  const header = `[SessionManager] Detailed error in ${operation} for session ${session.id}:`;
  let diagnostics: ProxyFailureDiagnostics = {};
  let errorDetails: Record<string, unknown>;

  try {
    diagnostics = collectProxyFailureDiagnostics(session, error);

    // Attempt to capture proxy log tail for debugging initialization failures
    const proxyLogTail = await readProxyLogTail(deps.fileSystem, diagnostics.proxyLogPath);

    errorDetails = buildProxyFailureErrorDetails(error, diagnostics, proxyLogTail);
  } catch (diagnosticsError: unknown) {
    // Keep whatever was collected before the failure — the pointers are the
    // half the caller returns — and say why the rest is missing.
    errorDetails = {
      message: describeErrorSafely(error),
      ...diagnostics,
      diagnosticsUnavailable: describeErrorSafely(diagnosticsError)
    };
  }

  // Log comprehensive error details
  logSafely(deps.logger, header, errorDetails);

  return diagnostics;
}
