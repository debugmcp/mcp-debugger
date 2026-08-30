/**
 * Intake validation shared by the tool handlers: the required-argument
 * guards, the start_debugging argument normalization and the least-privilege
 * names gate. Pure functions over the arguments (plus the environment where a
 * mode gate needs it) — no session state, no ToolContext.
 */
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ExceptionBreakMode, IEnvironment } from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import { getVariableAccessMode, requiresExplicitNames } from '../utils/variable-access.js';
import type { ToolArguments } from './tool-arguments.js';
import type { ToolDefinition } from './tool-schemas.js';

/** Arguments whose sessionId has been established at dispatch or by requireSessionId. */
export type WithSessionId = ToolArguments & { sessionId: string };

/**
 * Enforce the required properties advertised for one tool before dispatch.
 * The schema order is intentional: when several values are absent, clients
 * receive a deterministic error naming the first missing parameter.
 */
export function assertRequiredToolArguments(
  definition: Pick<ToolDefinition, 'inputSchema'>,
  args: Record<string, unknown>
): void {
  for (const parameterName of definition.inputSchema.required ?? []) {
    const value = args[parameterName];
    if (value === undefined || value === null || value === '') {
      throw new McpError(
        McpErrorCode.InvalidParams,
        `Missing required parameter: ${parameterName}`
      );
    }
  }
}

/** A non-null, non-array object — what the pass-through config bags must be. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Defensive narrowing for handlers that are also invoked directly by unit
 * tests. Production dispatch has already enforced the schema's required
 * fields through assertRequiredToolArguments.
 */
export function requireSessionId(args: ToolArguments): asserts args is WithSessionId {
  if (!args.sessionId) {
    throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameter: sessionId');
  }
}

/**
 * Reject a pass-through config bag that is not a plain object. Undefined is
 * allowed — these arguments are all optional.
 */
export function assertPlainObjectArg(value: unknown, parameterName: string): void {
  if (value === undefined || isPlainObject(value)) {
    return;
  }
  throw new McpError(McpErrorCode.InvalidParams, `${parameterName} must be an object when provided`);
}

export function validateBreakOnExceptions(value: string | undefined): ExceptionBreakMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== 'uncaught' && value !== 'all' && value !== 'none') {
    throw new McpError(
      McpErrorCode.InvalidParams,
      `breakOnExceptions must be one of 'uncaught', 'all', 'none' (got '${value}')`
    );
  }
  return value;
}

/**
 * Top-level start_debugging parameters that have no meaning inside
 * dapLaunchArgs. Deliberately excludes keys that are legitimate DAP launch
 * arguments (program, cwd, args, env, stopOnEntry, justMyCode, ...) —
 * compiled languages pass the binary as dapLaunchArgs.program.
 * breakOnExceptions is handled separately (honored as an alias).
 */
export const NEVER_VALID_DAP_LAUNCH_KEYS = [
  'dryRunSpawn',
  'sessionId',
  'scriptPath',
  'adapterLaunchConfig',
  'dapLaunchArgs'
] as const;

/**
 * Intake normalization for start_debugging (issue #305). dapLaunchArgs is
 * declared additionalProperties:true, so a top-level parameter nested there
 * by mistake used to ride through the launch-config merge as a junk DAP key
 * adapters silently ignore — a silent behavioral failure. Now:
 * - dapLaunchArgs.breakOnExceptions is honored as an alias for the
 *   top-level parameter (top-level wins when both are given), stripped from
 *   the forwarded launch args, and reported via a warning.
 * - Other never-valid nested keys are stripped with a warning.
 * Fixing at intake also cures restart_debugging replay, which snapshots the
 * post-intake values into session.lastLaunch downstream.
 */
export function normalizeStartDebuggingArgs(
  dapLaunchArgs: Partial<DebugProtocol.LaunchRequestArguments> | undefined,
  topLevelBreakOnExceptions: string | undefined
): {
  dapLaunchArgs: Partial<DebugProtocol.LaunchRequestArguments> | undefined;
  breakOnExceptions: string | undefined;
  warnings: string[];
} {
  const warnings: string[] = [];
  let breakOnExceptions = topLevelBreakOnExceptions;
  if (!isPlainObject(dapLaunchArgs)) {
    return { dapLaunchArgs, breakOnExceptions, warnings };
  }
  const cleaned: Record<string, unknown> = { ...dapLaunchArgs };
  if ('breakOnExceptions' in cleaned) {
    const nested = cleaned.breakOnExceptions;
    delete cleaned.breakOnExceptions;
    if (topLevelBreakOnExceptions === undefined) {
      breakOnExceptions = nested as string;
      warnings.push(
        `breakOnExceptions is a top-level start_debugging parameter, not a dapLaunchArgs key — honored as '${String(nested)}' this time; pass it at the top level`
      );
    } else {
      warnings.push(
        `breakOnExceptions was passed both top-level ('${topLevelBreakOnExceptions}') and inside dapLaunchArgs ('${String(nested)}'); the top-level value wins and the nested key was ignored`
      );
    }
  }
  for (const key of NEVER_VALID_DAP_LAUNCH_KEYS) {
    if (key in cleaned) {
      delete cleaned[key];
      warnings.push(
        `'${key}' is a top-level start_debugging parameter and has no meaning inside dapLaunchArgs — ignored; pass it at the top level`
      );
    }
  }
  return {
    dapLaunchArgs: cleaned as Partial<DebugProtocol.LaunchRequestArguments>,
    breakOnExceptions,
    warnings
  };
}

/**
 * Least-privilege enforcement (issue #237): in explicit mode, bulk scope
 * dumps are disabled — the tools require a non-empty names filter, and the
 * error teaches the correct call shape.
 */
export function enforceExplicitNames(
  environment: IEnvironment,
  toolName: string,
  names: string[] | undefined
): void {
  if (!requiresExplicitNames(getVariableAccessMode(environment))) {
    return;
  }
  if (!names || names.length === 0) {
    throw new McpError(
      McpErrorCode.InvalidParams,
      `${toolName} requires "names" in least-privilege mode (DEBUG_MCP_VARIABLE_ACCESS=explicit): ` +
      `pass the exact variable names you need, e.g. names:["user","order_total"]. ` +
      `Unfiltered scope dumps are disabled by this server's configuration.`
    );
  }
}
