/**
 * Pure message handlers for DAP protocol
 */
import { 
  DAPSessionState, 
  DAPProcessingResult, 
  DAPCommand,
  ProxyMessage,
  ProxyStatusMessage,
  ProxyErrorMessage,
  ProxyDapEventMessage,
  ProxyDapResponseMessage
} from './types.js';
import {
  setInitialized,
  setAdapterConfigured,
  setCurrentThreadId,
  getPendingRequest,
  removePendingRequest
} from './state.js';

/**
 * Main handler for proxy messages
 */
export function handleProxyMessage(
  state: DAPSessionState,
  message: ProxyMessage
): DAPProcessingResult {
  // Validate session ID
  if (message.sessionId !== state.sessionId) {
    return {
      commands: [{
        type: 'log',
        level: 'warn',
        message: `Session ID mismatch. Expected ${state.sessionId}, got ${message.sessionId}`
      }]
    };
  }

  switch (message.type) {
    case 'status':
      return handleStatusMessage(state, message);
    
    case 'error':
      return handleErrorMessage(state, message);
    
    case 'dapEvent':
      return handleDapEvent(state, message);
    
    case 'dapResponse':
      return handleDapResponse(state, message);
    
    default:
      return {
        commands: [{
          type: 'log',
          level: 'warn',
          message: 'Unknown message type',
          data: message
        }]
      };
  }
}

/**
 * Handle status messages (Phase 1: proxy lifecycle status/error messages,
 * as distinct from Phase 2: DAP events and responses).
 *
 * STATE TRANSITIONS ONLY — no commands, for any status. ProxyManager's own
 * `handleStatusMessage` owns every status-derived side effect: the logging,
 * the emits and the latches that make them once-only (the initialized latch,
 * the #258 exit latch), the kill on the IPC probe, and the progress facts the
 * init-timeout diagnosis reads. Duplicating them here meant every status was
 * logged twice, every status-derived event fired every listener twice, and
 * the IPC probe killed the proxy twice (issue #713).
 */
function handleStatusMessage(
  state: DAPSessionState,
  message: ProxyStatusMessage
): DAPProcessingResult {
  switch (message.status) {
    case 'adapter_connected':
      // Adapter transport is up: DAP requests may be sent.
      return { commands: [], newState: setInitialized(state, true) };

    case 'adapter_configured_and_launched': {
      const configured = setAdapterConfigured(state, true);
      return {
        commands: [],
        newState: state.initialized ? configured : setInitialized(configured, true)
      };
    }

    default:
      return { commands: [] };
  }
}

/**
 * Handle error messages (Phase 1: proxy lifecycle status/error messages,
 * as distinct from Phase 2: DAP events and responses)
 */
function handleErrorMessage(
  state: DAPSessionState,
  message: ProxyErrorMessage
): DAPProcessingResult {
  return {
    commands: [
      { 
        type: 'log', 
        level: 'error', 
        message: `[ProxyManager] Proxy error: ${message.message}` 
      },
      { 
        type: 'emitEvent', 
        event: 'error', 
        args: [new Error(message.message)] 
      }
    ]
  };
}

/**
 * Handle DAP events and update session state
 */
function handleDapEvent(
  state: DAPSessionState,
  message: ProxyDapEventMessage
): DAPProcessingResult {
  const commands: DAPCommand[] = [
    { 
      type: 'log', 
      level: 'info', 
      message: `[ProxyManager] DAP event: ${message.event}`,
      data: message.body
    }
  ];

  let newState = state;

  switch (message.event) {
    case 'stopped':
      // Type guard for stopped event body
      const body = message.body as { threadId?: number; reason?: string } | undefined;
      const threadId = body?.threadId;
      const reason = body?.reason || 'unknown';
      if (threadId) {
        newState = setCurrentThreadId(state, threadId);
      }
      commands.push({
        type: 'emitEvent',
        event: 'stopped',
        args: [threadId, reason, message.body]
      });
      break;
    
    case 'continued':
      commands.push({
        type: 'emitEvent',
        event: 'continued',
        args: []
      });
      break;
    
    case 'terminated':
      commands.push({
        type: 'emitEvent',
        event: 'terminated',
        args: []
      });
      break;
    
    case 'exited':
      commands.push({
        type: 'emitEvent',
        event: 'exited',
        args: []
      });
      break;

    case 'output':
      commands.push({
        type: 'emitEvent',
        event: 'output',
        args: [message.body]
      });
      break;

    default:
      // Forward unknown events as generic DAP events
      commands.push({
        type: 'emitEvent',
        event: 'dap-event',
        args: [message.event, message.body]
      });
  }

  return { commands, newState };
}

/**
 * Handle DAP responses and correlate with pending requests
 */
function handleDapResponse(
  state: DAPSessionState,
  message: ProxyDapResponseMessage
): DAPProcessingResult {
  const pending = getPendingRequest(state, message.requestId);
  if (!pending) {
    return {
      commands: [{
        type: 'log',
        level: 'debug',
        message: `[ProxyManager] Received response for unknown request: ${message.requestId}`
      }]
    };
  }

  // Remove pending request from state tracking. Response resolution (resolve/reject
  // of the caller's Promise) is handled imperatively by ProxyManager.handleDapResponse.
  return {
    commands: [],
    newState: removePendingRequest(state, message.requestId)
  };
}

/**
 * Validate a message has required fields
 */
export function isValidProxyMessage(message: unknown): message is ProxyMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  
  const msg = message as { sessionId?: unknown; type?: unknown };
  return typeof msg.sessionId === 'string' && typeof msg.type === 'string';
}
