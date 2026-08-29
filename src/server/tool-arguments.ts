/**
 * MCP tool arguments: the argument bag every tool handler receives, and the
 * schema-driven coercion applied to it once per request.
 */
import { DebugProtocol } from '@vscode/debugprotocol';

/**
 * Tool arguments interface
 */
export interface ToolArguments {
  sessionId?: string;
  language?: string;
  name?: string;
  executablePath?: string;  // Language-agnostic executable path
  file?: string;
  line?: number;
  condition?: string;
  logMessage?: string;
  expectedContent?: string;
  statement?: string;
  nearLine?: number;
  function?: string;
  breakpointId?: string;
  scriptPath?: string;
  args?: string[];
  dapLaunchArgs?: Partial<DebugProtocol.LaunchRequestArguments>;
  dryRunSpawn?: boolean;
  breakOnExceptions?: string;
  adapterLaunchConfig?: Record<string, unknown>;
  scope?: number;
  frameId?: number;
  expression?: string;
  linesContext?: number;
  includeInternals?: boolean;
  includeSpecial?: boolean;
  names?: string[];
  // Attach-related parameters
  port?: number;
  host?: string;
  processId?: number | string;
  timeout?: number;
  verifyTimeout?: number;
  sourcePaths?: string[];
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  adapterConfig?: Record<string, unknown>;
  terminateProcess?: boolean;
  suspendPolicy?: 'all' | 'thread';
  threadId?: number;
  // redefine_classes parameters
  classesDir?: string;
  sinceTimestamp?: number;
  // get_output parameters
  since?: number;
  limit?: number;
}

/**
 * Schema-driven type coercion for MCP tool arguments.
 *
 * Works around a known Claude Code bug (anthropics/claude-code#11359) where
 * SSE-transport tool arguments arrive as strings instead of their declared
 * JSON-Schema types.  Called once per request on the fresh args object — no
 * shared state is mutated.
 */
export const TOOL_ARG_EXPECTED_TYPES: Record<string, 'number' | 'boolean' | 'object' | 'array'> = {
  // numbers
  line: 'number', linesContext: 'number', scope: 'number',
  frameId: 'number', port: 'number', timeout: 'number', threadId: 'number',
  verifyTimeout: 'number', since: 'number', limit: 'number',
  sinceTimestamp: 'number', nearLine: 'number',
  // booleans
  includeInternals: 'boolean', includeSpecial: 'boolean',
  stopOnEntry: 'boolean', justMyCode: 'boolean',
  dryRunSpawn: 'boolean', terminateProcess: 'boolean',
  // objects
  dapLaunchArgs: 'object', adapterLaunchConfig: 'object', adapterConfig: 'object',
  // arrays
  args: 'array', sourcePaths: 'array', names: 'array',
};

export function coerceToolArguments(args: Record<string, unknown>): Record<string, unknown> {
  for (const [key, expectedType] of Object.entries(TOOL_ARG_EXPECTED_TYPES)) {
    const val = args[key];
    if (val === undefined) continue;

    // Handle "null" string → undefined for optional params
    if (val === 'null') { args[key] = undefined; continue; }

    if (typeof val !== 'string') continue; // already correct type

    switch (expectedType) {
      case 'number': {
        if (val !== '') {
          const n = Number(val);
          if (!Number.isNaN(n)) args[key] = n;
        }
        break;
      }
      case 'boolean':
        if (val === 'true') args[key] = true;
        else if (val === 'false') args[key] = false;
        break;
      case 'object':
      case 'array':
        try {
          const parsed = JSON.parse(val);
          if (expectedType === 'object' && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            args[key] = parsed;
          } else if (expectedType === 'array' && Array.isArray(parsed)) {
            args[key] = parsed;
          }
        } catch { /* leave as-is, downstream validation will catch */ }
        break;
    }
  }
  return args;
}
