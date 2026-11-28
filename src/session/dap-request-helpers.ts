/**
 * Small helpers shared by every tool that sends a DAP request on the caller's
 * behalf (evaluate, redefineClasses, the mirror commands): validating the
 * optional per-request timeout override, hinting at it when a request times
 * out, and keeping log lines from swallowing a megabyte of program output.
 *
 * They were three private methods on the session-manager operations class and
 * depend on nothing but their arguments, so they live here as free functions —
 * a collaborator that needs one imports it instead of inheriting it.
 */
import { DeadlineExpired, type ILogger } from '@debugmcp/shared';
import { ErrorMessages } from '../utils/error-messages.js';

/** Upper bound for caller-supplied per-request DAP timeouts (10 minutes). */
export const MAX_DAP_TIMEOUT_MS = 600000;

/**
 * Truncate long strings for logging.
 */
export function truncateForLog(value: string, maxLength: number = 1000): string {
  if (!value) return '';
  return value.length > maxLength ? value.substring(0, maxLength) + '... (truncated)' : value;
}

/**
 * Validate and clamp a caller-supplied per-request millisecond override.
 * Returns { error } for invalid values, { timeoutMs } with the (possibly
 * clamped) override, or {} when no override was given.
 *
 * `keyName` names the tool argument in both messages. It defaults to the
 * 'timeout' every DAP-request tool uses; attach's own verification window
 * ('verifyTimeout') is not a DAP timeout but is validated and clamped by the
 * same rules, and had grown a hand-written copy of them.
 */
export function resolveDapTimeoutOverride(
  timeoutMs: number | undefined,
  logContext: string,
  logger: ILogger,
  keyName: string = 'timeout'
): { error?: string; timeoutMs?: number } {
  if (timeoutMs === undefined) {
    return {};
  }
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return {
      error: `Invalid '${keyName}': must be a positive number of milliseconds (got ${timeoutMs})`
    };
  }
  if (timeoutMs > MAX_DAP_TIMEOUT_MS) {
    logger.warn(
      `[${logContext}] '${keyName}' ${timeoutMs}ms exceeds the maximum; clamping to ${MAX_DAP_TIMEOUT_MS}ms`
    );
    return { timeoutMs: MAX_DAP_TIMEOUT_MS };
  }
  return { timeoutMs };
}

/**
 * Whether a failed DAP request got no answer at all, as against one the
 * adapter refused: the worker's and the parent's timeout wordings, or a
 * Deadline that ended it (by class: the DeadlineExpired itself, or an error
 * whose `cause` is one). Its `budget` and `backstop` ends are timeouts. Its
 * `cancelled` and `disposed` ends are not: the caller gave the request up,
 * and the adapter was not left unanswering, so neither the timeout's
 * sentence nor its hint is true of it.
 */
export function isDapRequestTimeout(failure: unknown): boolean {
  const ended = deadlineExpiredIn(failure);
  if (ended) {
    return ended.why === 'budget' || ended.why === 'backstop';
  }
  return /timed out|did not respond/i.test(failure instanceof Error ? failure.message : String(failure));
}

/** The DeadlineExpired a failure is, or carries as its cause (a few levels deep). */
function deadlineExpiredIn(failure: unknown): DeadlineExpired | undefined {
  for (let current = failure, depth = 0; current instanceof Error && depth < 4; current = current.cause, depth++) {
    if (current instanceof DeadlineExpired) {
      return current;
    }
  }
  return undefined;
}

/**
 * Append the 'timeout' tool-arg hint to DAP timeout failures. Pass the
 * failure as well as the message shown for it: a Deadline's is classified by
 * its class, any other by the message, as before.
 */
export function withTimeoutHint(errorMessage: string, failure?: unknown): string {
  if (!isDapRequestTimeout(deadlineExpiredIn(failure) ? failure : errorMessage)) {
    return errorMessage;
  }
  const separator = errorMessage.trimEnd().endsWith('.') ? ' ' : '. ';
  return `${errorMessage}${separator}${ErrorMessages.dapRequestTimeoutHint()}`;
}
