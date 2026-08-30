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
import type { ILogger } from '@debugmcp/shared';
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

/** Append the 'timeout' tool-arg hint to DAP timeout failures. */
export function withTimeoutHint(errorMessage: string): string {
  if (!/timed out|did not respond/i.test(errorMessage)) {
    return errorMessage;
  }
  const separator = errorMessage.trimEnd().endsWith('.') ? ' ' : '. ';
  return `${errorMessage}${separator}${ErrorMessages.dapRequestTimeoutHint()}`;
}
