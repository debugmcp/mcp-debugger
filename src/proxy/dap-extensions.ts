/**
 * MCP Debugger extensions to the DAP protocol
 * Currently used to mark silent DAP commands injected by the proxy.
 */

import { DapCommandPayload } from './dap-proxy-interfaces.js';

/**
 * Extended DapCommandPayload with optional silent flag.
 * Used internally to inject commands without sending responses.
 */
export interface SilentDapCommandPayload extends DapCommandPayload {
  __silent?: boolean;
}
