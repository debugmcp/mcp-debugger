/**
 * Helpers shared by more than one tool handler: the best-effort line-context
 * read, the redaction notice, the get_variables / get_local_variables payload
 * extras, and the attach warning both attach paths surface.
 */
import { REDACTION_NOTICE, Variable } from '@debugmcp/shared';
import type { LineContext } from '../../utils/line-reader.js';
import { buildTruncationNotice, VariableTruncationSummary } from '../../session/variable-caps.js';
import type { ToolContext } from '../tool-context.js';

/** The line-context slice the breakpoint and step payloads embed. */
export type EmbeddedLineContext = Pick<LineContext, 'lineContent' | 'surrounding'>;

/**
 * Read the source around a location for a response payload. Advisory: a
 * failure is logged at debug level (with the caller's label, so the two log
 * lines read the way they always have) and reported as no context, never as a
 * failed tool call.
 */
export async function readLineContext(
  ctx: ToolContext,
  file: string,
  line: number,
  logLabel: string
): Promise<EmbeddedLineContext | undefined> {
  try {
    const lineContext = await ctx.lineReader.getLineContext(file, line, { contextLines: 2 });
    if (lineContext) {
      return {
        lineContent: lineContext.lineContent,
        surrounding: lineContext.surrounding
      };
    }
  } catch (contextError) {
    // Log but don't fail if we can't get context
    ctx.logger.debug(`Could not get line context for ${logLabel}`, {
      file,
      line,
      error: contextError
    });
  }
  return undefined;
}

/**
 * Top-level `redaction` notice object for tool results (issue #237):
 * present when any returned item carries the session layer's `redacted`
 * flag, so the agent learns why values changed and how to opt out.
 */
export function redactionSummary(
  items: Array<{ redacted?: boolean }>
): { masked: number; notice: string } | undefined {
  const masked = items.filter(item => item.redacted).length;
  return masked > 0 ? { masked, notice: REDACTION_NOTICE } : undefined;
}

/**
 * The three optional decorations a variables payload carries: the names that
 * were asked for but not returned, the redaction notice, and the size-guard
 * summary with its advisory (issues #356/#359). Each is an independent
 * optional field, so a caller can splice them in one at a time: get_variables
 * spreads the whole object at the tail of its payload while
 * get_local_variables assigns the three in a different order. Neither key
 * order may change.
 */
export function variablePayloadExtras(
  variables: Variable[],
  names: string[] | undefined,
  truncation: VariableTruncationSummary | undefined
): {
  notFound?: string[];
  redaction?: { masked: number; notice: string };
  truncation?: VariableTruncationSummary & { notice: string };
} {
  const notFound = names
    ? names.filter(name => !variables.some(v => v.name === name))
    : undefined;
  const redaction = redactionSummary(variables);
  const truncationInfo = truncation
    ? { ...truncation, notice: buildTruncationNotice(truncation, variables) }
    : undefined;
  return {
    ...(notFound !== undefined ? { notFound } : {}),
    ...(redaction ? { redaction } : {}),
    ...(truncationInfo ? { truncation: truncationInfo } : {})
  };
}

/**
 * The attach warning (dropped adapterConfig keys, issue #450) both attach
 * entry points lift to the top level of their response — reported only for a
 * successful attach, where it is advisory rather than the failure itself.
 */
export function attachWarning(
  attachResult: { success: boolean; data?: unknown }
): string | undefined {
  return attachResult.success
    ? (attachResult.data as { warning?: string } | undefined)?.warning
    : undefined;
}
