/**
 * `evaluate_expression`: run an expression in the paused debuggee's frame.
 *
 * Two things distinguish it from a bare DAP round trip. It resolves the frame
 * itself when the caller does not name one — an agent that just hit a
 * breakpoint has a thread, not a frame id. And it is the one tool that returns
 * an arbitrary program value straight to the caller, so the secret-redaction
 * hook (issue #237) runs before anything, including the logs, sees the result.
 */
import { getErrorMessage } from '../../errors/debug-errors.js';
import {
  buildRedactionNotice,
  isSensitiveName,
  redactSecretsDeep,
  redactVariableValue,
  SessionState
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import {
  resolveDapTimeoutOverride,
  truncateForLog,
  withTimeoutHint
} from '../dap-request-helpers.js';
import type { EvaluateContext } from '../operations-context.js';
import type { FrameAnchorResolver } from './frame-anchor-resolver.js';

/**
 * Result type for evaluate expression operations
 */
export interface EvaluateResult {
  success: boolean;
  result?: string;
  type?: string;
  variablesReference?: number;
  namedVariables?: number;
  indexedVariables?: number;
  presentationHint?: DebugProtocol.VariablePresentationHint;
  error?: string;
  /** Present when secret-shaped content was masked in `result` (issue #237) */
  redaction?: { rules: string[]; notice: string };
}

/**
 * The "variable name" an evaluate expression stands for, for name-based
 * redaction (issue #237): the whole expression when it is itself a
 * sensitive name, otherwise its final dot-segment — so `config.password`
 * is treated like the variable `password`.
 */
export function expressionNameForRedaction(expression: string): string {
  const trimmed = expression.trim();
  if (isSensitiveName(trimmed)) {
    return trimmed;
  }
  const lastDot = trimmed.lastIndexOf('.');
  return lastDot >= 0 ? trimmed.slice(lastDot + 1) : trimmed;
}

export class ExpressionEvaluator {
  constructor(
    private readonly ctx: EvaluateContext,
    private readonly frameAnchorResolver: FrameAnchorResolver
  ) {}

  /**
   * Evaluate an expression in the context of the current debug session.
   * The debugger must be paused for evaluation to work.
   * Expressions CAN and SHOULD be able to modify program state (this is a feature).
   *
   * @param sessionId - The session ID
   * @param expression - The expression to evaluate
   * @param frameId - Optional stack frame ID for context (defaults to current frame)
   * @param timeoutMs - Optional per-request timeout override (ms) for the DAP
   *   evaluate request (default 30s, max 600000). Issue #142.
   * @returns Evaluation result with value, type, and optional variable reference
   */
  async evaluateExpression(
    sessionId: string,
    expression: string,
    frameId?: number,
    timeoutMs?: number
  ): Promise<EvaluateResult> {
    const session = this.ctx.getSession(sessionId);
    // Some debuggers (rdbg) reject the default 'variables' context; let the
    // adapter policy pick the context its debugger understands.
    const context = this.ctx.selectPolicy(session.language).getEvaluateContext?.() ?? 'variables';
    this.ctx.logger.info(
      `[SM evaluateExpression ${sessionId}] Entered. Expression: "${truncateForLog(
        expression,
        100
      )}", frameId: ${frameId}, context: ${context}, state: ${session.state}`
    );

    // Basic sanity checks
    if (!expression || expression.trim().length === 0) {
      this.ctx.logger.warn(`[SM evaluateExpression ${sessionId}] Empty expression provided`);
      return { success: false, error: 'Expression cannot be empty' };
    }

    const timeoutOverride = resolveDapTimeoutOverride(
      timeoutMs,
      `SM evaluateExpression ${sessionId}`,
      this.ctx.logger
    );
    if (timeoutOverride.error) {
      this.ctx.logger.warn(`[SM evaluateExpression ${sessionId}] ${timeoutOverride.error}`);
      return { success: false, error: timeoutOverride.error };
    }

    // Validate session state
    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      this.ctx.logger.warn(`[SM evaluateExpression ${sessionId}] No active proxy or proxy not running`);
      return { success: false, error: 'No active debug session' };
    }

    if (session.state !== SessionState.PAUSED) {
      this.ctx.logger.warn(
        `[SM evaluateExpression ${sessionId}] Cannot evaluate: session not paused. State: ${session.state}`
      );
      return {
        success: false,
        error: 'Cannot evaluate: debugger not paused. Ensure the debugger is stopped at a breakpoint.',
      };
    }

    // Resolve the same default anchor stack and locals use. An explicit
    // frameId is authoritative and deliberately bypasses the resolver.
    if (frameId === undefined) {
      try {
        this.ctx.logger.info(
          `[SM evaluateExpression ${sessionId}] No frameId provided; resolving the shared inspection anchor`
        );
        const anchor = await this.frameAnchorResolver.resolve(sessionId);
        if (anchor.frames.length > 0) {
          frameId = anchor.frames[0].id;
          this.ctx.logger.info(
            `[SM evaluateExpression ${sessionId}] Using shared anchor frame ID: ${frameId}`
          );
        } else {
          this.ctx.logger.warn(
            `[SM evaluateExpression ${sessionId}] No stack frame available: ${anchor.note ?? 'no detail'}`
          );
          return {
            success: false,
            error: anchor.note?.includes('No stopped thread')
              ? 'Unable to find thread for evaluation. Ensure the debugger is paused at a breakpoint.'
              : 'No active stack frame. Ensure the debugger is paused at a breakpoint.',
          };
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        this.ctx.logger.error(
          `[SM evaluateExpression ${sessionId}] Error getting stack trace for default frame:`,
          error
        );
        return { success: false, error: `Unable to determine current frame: ${errorMessage}` };
      }
    }

    try {
      // Send DAP evaluate request
      this.ctx.logger.info(
        `[SM evaluateExpression ${sessionId}] Sending DAP 'evaluate' request. Expression: "${truncateForLog(
          expression,
          100
        )}", frameId: ${frameId}, context: ${context}`
      );

      // Conditional 3-arg call: only pass options when an override is present,
      // so the default path keeps its exact 2-arg contract.
      const evaluateArgs = { expression, frameId, context };
      const response = timeoutOverride.timeoutMs !== undefined
        ? await session.proxyManager.sendDapRequest<DebugProtocol.EvaluateResponse>(
            'evaluate', evaluateArgs, { timeoutMs: timeoutOverride.timeoutMs })
        : await session.proxyManager.sendDapRequest<DebugProtocol.EvaluateResponse>(
            'evaluate', evaluateArgs);

      // Log raw response in debug mode — scrubbed, the raw body carries
      // unredacted values (issue #237)
      this.ctx.logger.debug(
        `[SM evaluateExpression ${sessionId}] DAP evaluate raw response:`,
        this.ctx.redactionEnabled() ? redactSecretsDeep(response).value : response
      );

      // Process response
      if (response && response.body) {
        const body = response.body;

        // Note: debugpy automatically truncates collections at 300 items for performance
        const result: EvaluateResult = {
          success: true,
          result: body.result || '', // Default to empty string if no result
          type: body.type, // Optional, can be undefined
          variablesReference: body.variablesReference || 0, // Default to 0 (no children)
          namedVariables: body.namedVariables,
          indexedVariables: body.indexedVariables,
          presentationHint: body.presentationHint,
        };

        // Redaction hook (issue #237), placed above the logs below so they
        // only ever see masked values. The expression's final dot-segment
        // counts as the "variable name" so `config.password` is treated like
        // the variable `password` would be.
        if (this.ctx.redactionEnabled() && result.result) {
          const redacted = redactVariableValue(
            expressionNameForRedaction(expression),
            result.result
          );
          if (redacted.redacted) {
            result.result = redacted.value;
            result.redaction = {
              rules: redacted.hits.map(hit => hit.ruleId),
              notice: buildRedactionNotice(redacted.hits)
            };
          }
        }

        // Log the evaluation result with structured logging
        this.ctx.logger.info('debug:evaluate', {
          event: 'expression',
          sessionId,
          sessionName: session.name,
          expression: truncateForLog(expression, 100),
          frameId,
          context,
          result: truncateForLog(result.result || '', 1000),
          type: result.type,
          variablesReference: result.variablesReference,
          namedVariables: result.namedVariables,
          indexedVariables: result.indexedVariables,
          timestamp: Date.now(),
        });

        this.ctx.logger.info(
          `[SM evaluateExpression ${sessionId}] Evaluation successful. Result: "${truncateForLog(
            result.result || '',
            200
          )}", Type: ${result.type}, VarRef: ${result.variablesReference}`
        );

        return result;
      } else {
        this.ctx.logger.warn(`[SM evaluateExpression ${sessionId}] No body in evaluate response`);
        return { success: false, error: 'No response body from debug adapter' };
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      // Log the error
      this.ctx.logger.error('debug:evaluate', {
        event: 'error',
        sessionId,
        sessionName: session.name,
        expression: truncateForLog(expression, 100),
        frameId,
        context,
        error: errorMessage,
        timestamp: Date.now(),
      });

      this.ctx.logger.error(`[SM evaluateExpression ${sessionId}] Error evaluating expression:`, error);

      // Determine error type for better user feedback
      let userError = errorMessage;
      if (errorMessage.includes('SyntaxError')) {
        userError = `Syntax error in expression: ${errorMessage}`;
      } else if (errorMessage.includes('NameError')) {
        userError = `Name not found: ${errorMessage}`;
      } else if (errorMessage.includes('TypeError')) {
        userError = `Type error: ${errorMessage}`;
      } else if (errorMessage.includes('frame')) {
        userError = `Invalid frame context: ${errorMessage}`;
      }

      return { success: false, error: withTimeoutHint(userError) };
    }
  }
}
