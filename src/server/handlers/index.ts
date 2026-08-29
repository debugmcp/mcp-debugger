/**
 * Tool name -> handler table for the tools/call dispatch. Order mirrors the
 * original switch in src/server.ts.
 */
import type { ToolHandler } from '../tool-context.js';
import type { ToolName } from '../tool-schemas.js';
import { createDebugSessionTool, listDebugSessionsTool, closeDebugSessionTool } from './session-tools.js';
import {
  setBreakpointTool,
  listBreakpointsTool,
  removeBreakpointTool,
  clearBreakpointsTool
} from './breakpoint-tools.js';
import {
  startDebuggingTool,
  restartDebuggingTool,
  attachToProcessTool,
  detachFromProcessTool,
  redefineClassesTool
} from './debuggee-tools.js';
import { exposeSessionTool, unexposeSessionTool } from './mirror-tools.js';
import { stepTool, continueExecutionTool, pauseExecutionTool, listThreadsTool } from './execution-tools.js';
import {
  getVariablesTool,
  getStackTraceTool,
  getScopesTool,
  evaluateExpressionTool,
  getSourceContextTool,
  getLocalVariablesTool
} from './inspection-tools.js';
import { getOutputTool } from './output-tools.js';
import { listSupportedLanguagesTool } from './language-tools.js';

/**
 * Keyed by ToolName, so this table cannot drift from the advertised schema
 * list: a tool without a handler and a handler under a misspelled name are
 * both compile errors.
 */
export const TOOL_HANDLERS: Readonly<Record<ToolName, ToolHandler>> = Object.freeze({
  create_debug_session: createDebugSessionTool,
  list_debug_sessions: listDebugSessionsTool,
  set_breakpoint: setBreakpointTool,
  list_breakpoints: listBreakpointsTool,
  remove_breakpoint: removeBreakpointTool,
  clear_breakpoints: clearBreakpointsTool,
  start_debugging: startDebuggingTool,
  restart_debugging: restartDebuggingTool,
  attach_to_process: attachToProcessTool,
  detach_from_process: detachFromProcessTool,
  expose_session: exposeSessionTool,
  unexpose_session: unexposeSessionTool,
  close_debug_session: closeDebugSessionTool,
  step_over: stepTool,
  step_into: stepTool,
  step_out: stepTool,
  continue_execution: continueExecutionTool,
  pause_execution: pauseExecutionTool,
  list_threads: listThreadsTool,
  get_variables: getVariablesTool,
  get_stack_trace: getStackTraceTool,
  get_scopes: getScopesTool,
  evaluate_expression: evaluateExpressionTool,
  get_source_context: getSourceContextTool,
  get_local_variables: getLocalVariablesTool,
  get_output: getOutputTool,
  list_supported_languages: listSupportedLanguagesTool,
  redefine_classes: redefineClassesTool
});
