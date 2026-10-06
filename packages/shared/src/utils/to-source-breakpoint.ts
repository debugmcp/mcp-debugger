/**
 * The single mapper from stored breakpoint fields to a DAP SourceBreakpoint.
 *
 * There are four places that build setBreakpoints arrays (SessionManager live
 * re-send, proxy worker initial breakpoints, connection-manager helper, and
 * the js-debug handshake). Before this mapper existed each mapped its own
 * subset of fields, so optional fields were silently dropped on some paths
 * (suspendPolicy never survived a launch, for example). All four now share
 * this function — add new per-breakpoint fields HERE, nowhere else (#235).
 */
import { DebugProtocol } from '@vscode/debugprotocol';

export interface BreakpointFields {
  line: number;
  condition?: string;
  logMessage?: string;
  /** Java/JDI-only suspend policy, passed through as a non-standard field */
  suspendPolicy?: 'all' | 'thread';
}

export function toSourceBreakpoint(bp: BreakpointFields): DebugProtocol.SourceBreakpoint {
  return {
    line: bp.line,
    ...(bp.condition !== undefined ? { condition: bp.condition } : {}),
    ...(bp.logMessage !== undefined ? { logMessage: bp.logMessage } : {}),
    ...(bp.suspendPolicy !== undefined ? { suspendPolicy: bp.suspendPolicy } : {}),
  };
}

/**
 * The wire form a given adapter must receive (issue #850): the policy's
 * toWireBreakpoint when it declares one (js-debug compiles logpoints into
 * conditions), otherwise the plain mapping above. Use this at every
 * setBreakpoints construction site that knows its policy.
 */
export function toWireSourceBreakpoint(
  bp: BreakpointFields,
  policy?: { toWireBreakpoint?(bp: BreakpointFields): DebugProtocol.SourceBreakpoint } | null
): DebugProtocol.SourceBreakpoint {
  return policy?.toWireBreakpoint?.(bp) ?? toSourceBreakpoint(bp);
}

export interface FunctionBreakpointFields {
  functionName: string;
  condition?: string;
}

/**
 * The single mapper to a DAP FunctionBreakpoint (issue #271 phase 3) — same
 * rule as toSourceBreakpoint: every setFunctionBreakpoints construction site
 * (live sync, worker initial send) maps through here.
 */
export function toFunctionBreakpoint(bp: FunctionBreakpointFields): DebugProtocol.FunctionBreakpoint {
  return {
    name: bp.functionName,
    ...(bp.condition !== undefined ? { condition: bp.condition } : {}),
  };
}
