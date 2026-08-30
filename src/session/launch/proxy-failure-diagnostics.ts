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
import { sanitizeStderrTail, type SessionFailureDiagnostics } from '@debugmcp/shared';
import type { ManagedSession } from '../session-store.js';
import type { IFileSystem, ILogger } from '../../interfaces/external-dependencies.js';
import type { ProxyInitProgress } from '../../utils/error-messages.js';
import { getErrorMessage, SessionNotFoundError } from '../../errors/debug-errors.js';
import { proxyLogPathFor } from '../../proxy/session-log-layout.js';
import { proxyLogResourceUri } from '../session-resource-uris.js';

/** How many trailing proxy-log lines are worth reporting after a failure. */
const PROXY_LOG_TAIL_LINES = 80;

/** Hard I/O and allocation cap applied before the log is sanitized. */
export const PROXY_LOG_TAIL_MAX_BYTES = 64 * 1024;

  /** The pointers a failed launch/attach returns to the caller (issue #493 / #551). */
  export interface ProxyFailureDiagnostics extends SessionFailureDiagnostics {
    initProgress?: ProxyInitProgress;
    proxyLogPath?: string;
  }

/**
 * What `logProxyFailure` needs. Declared here, as the narrowest possible slice,
 * so the module has no dependency on the session manager's shape.
 */
export interface ProxyFailureLogDeps {
  logger: ILogger;
  fileSystem: Pick<IFileSystem, 'readTail'>;
}

/** The two operations that can fail this way, named as they appear in the log. */
export type ProxyFailureOperation = 'startDebugging' | 'attachToProcess' | 'proxyExit';

/**
 * What `failProxySetup` needs on top of the log deps: the facade's
 * session-preserving proxy teardown.
 */
export interface ProxySetupFailureDeps extends ProxyFailureLogDeps {
  stopProxyPreservingSession(session: ManagedSession): Promise<void>;
}

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

  // The log path comes from the session, not from the error, so it is derived
  // FIRST: it is the pointer that survives a hostile error object, and losing
  // it would drop `data` from the tool result entirely.
  if (session.logDir) {
    diagnostics.proxyLogPath = proxyLogPathFor(session.logDir, session.id);
    diagnostics.proxyLogResource = proxyLogResourceUri(session.id);
  }

  // The error, by contrast, is a value that has already misbehaved once — a
  // throwing getter or a Proxy trap here must cost only this one field.
  try {
    const initProgress = (error as { initProgress?: ProxyInitProgress } | null)?.initProgress;
    if (initProgress) {
      diagnostics.initProgress = initProgress;
    }
  } catch {
    // Unreadable init progress: report the pointer we do have.
  }

  return diagnostics;
}

/**
 * Read the last `tailLineCount` lines of the proxy log, if there is one.
 *
 * Reads the bounded tail rather than asking `pathExists` first: the proxy is
 * still writing (and may rotate) this file, so an exists-then-read pair can
 * report "no log" for a file that appeared a millisecond later, and spends a
 * second syscall to do it. `ENOENT` — the answer that check was buying — is
 * simply the "no log yet" case.
 *
 * The tail goes through `sanitizeStderrTail`, which redacts secret-shaped lines
 * (issue #237's corpus) as well as tailing. The proxy log carries raw adapter
 * argv and DAP `output` bodies, so an attach token or an env secret can be
 * sitting in the very lines a failure makes interesting — copying those
 * un-redacted into the server log is exactly the leak the shared sanitizer
 * exists to prevent.
 *
 * Never throws: any other read failure is reported *as* the tail, so the setup
 * error that sent us here still reaches the log intact.
 */
export async function readProxyLogTail(
  fileSystem: Pick<IFileSystem, 'readTail'>,
  proxyLogPath: string | undefined,
  tailLineCount: number = PROXY_LOG_TAIL_LINES
): Promise<string | undefined> {
  if (!proxyLogPath) {
    return undefined;
  }
  try {
    const logContent = await fileSystem.readTail(proxyLogPath, PROXY_LOG_TAIL_MAX_BYTES);
    return sanitizeStderrTail(logContent, {
      maxLines: tailLineCount,
      maxChars: PROXY_LOG_TAIL_MAX_BYTES
    });
  } catch (logReadError) {
    if ((logReadError as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return undefined;
    }
    return `<<Failed to read proxy log: ${getErrorMessage(logReadError)}>>`;
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
    message: getErrorMessage(error),
    stack: error instanceof Error ? error.stack : 'No stack available',
    code: (error as Record<string, unknown>)?.code,
    errno: (error as Record<string, unknown>)?.errno,
    syscall: (error as Record<string, unknown>)?.syscall,
    path: (error as Record<string, unknown>)?.path,
    toString: error?.toString ? error.toString() : 'No toString',
    initProgress: diagnostics.initProgress,
    proxyLogPath: diagnostics.proxyLogPath,
    proxyLogResource: diagnostics.proxyLogResource,
    proxyLogTail
  };

  return errorDetails;
}

/**
 * Describe a thrown value without trusting it. `String(error)` runs the value's
 * own `toString`, and `error.message` runs its own getter — either can throw.
 */
function describeErrorSafely(error: unknown): string {
  try {
    return getErrorMessage(error);
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

/**
 * The shared failure path for a launch or attach that died once the proxy may
 * already exist: tear the proxy down, then log the failure and hand back the
 * pointers for the tool result.
 *
 * Teardown is the session-preserving one for BOTH operations — listeners
 * removed, the mirror record cleared with the worker that hosted it, a stop()
 * that fails logged rather than thrown, and a teardown already in flight from
 * a terminal event awaited. Launch used to do a bare `proxyManager.stop()`
 * here, which left its listeners attached and let a failing stop replace the
 * launch error with a rejection out of start_debugging.
 *
 * The record is written after the teardown: the proxy log is complete by then,
 * and the teardown touches nothing the record reads (logDir and the error's
 * initProgress survive it), so ordering it first can never keep it from
 * running.
 */
export async function failProxySetup(
  deps: ProxySetupFailureDeps,
  session: ManagedSession,
  error: unknown,
  operation: ProxyFailureOperation
): Promise<ProxyFailureDiagnostics> {
  await deps.stopProxyPreservingSession(session);
  return logProxyFailure(deps, session, error, operation);
}

/** What the post-teardown guard needs: the store lookup, and somewhere to say what it found. */
export interface SessionLookupDeps {
  logger: ILogger;
  /** `_getSessionById` — throws SessionNotFoundError for an unknown id. */
  getSession(sessionId: string): ManagedSession;
}

/**
 * Whether the session was closed while `failProxySetup` was running.
 *
 * The teardown it awaits can take seconds (the DAP drain, a force-kill, the
 * proxy-log read), and a `close_debug_session` / `closeAllSessions` that lands
 * in that window removes the session from the store. The state writes a catch
 * does next would then throw SessionNotFoundError — converting the failure
 * that was just logged into a rejection out of the tool. Callers check this
 * first and report the failure with the session's terminal state instead.
 * Anything other than "not found" is re-thrown: that is a different problem.
 */
export function sessionRemovedDuringTeardown(deps: SessionLookupDeps, sessionId: string): boolean {
  try {
    deps.getSession(sessionId);
    return false;
  } catch (error: unknown) {
    if (error instanceof SessionNotFoundError) {
      deps.logger.warn(
        `[SessionManager] Session ${sessionId} was closed while its failed setup was being torn down; reporting the failure without a state update`
      );
      return true;
    }
    throw error;
  }
}
