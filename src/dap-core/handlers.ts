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
  removePendingRequest,
  clearPendingRequests
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
 * Handle status messages (Phase 1)
 */
function handleStatusMessage(
  state: DAPSessionState,
  message: ProxyStatusMessage
): DAPProcessingResult {
  const commands: DAPCommand[] = [];

  switch (message.status) {
    case 'proxy_minimal_ran_ipc_test':
      commands.push(
        { type: 'log', level: 'info', message: '[ProxyManager] IPC test message received' },
        { type: 'killProcess' }
      );
      break;
    
    case 'dry_run_complete':
      commands.push(
        { type: 'log', level: 'info', message: '[ProxyManager] Dry run complete' },
        { type: 'emitEvent', event: 'dry-run-complete', args: [message.command, message.script] }
      );
      break;
    
    case 'adapter_configured_and_launched':
      commands.push(
        { type: 'log', level: 'info', message: '[ProxyManager] Adapter configured and launched' },
        { type: 'emitEvent', event: 'adapter-configured', args: [] }
      );
      
      // Update state
      let newState = setAdapterConfigured(state, true);
      
      // If not initialized, mark as initialized and emit event
      if (!state.initialized) {
        newState = setInitialized(newState, true);
        commands.push({ type: 'emitEvent', event: 'initialized', args: [] });
      }
      
      return { commands, newState };
    
    case 'adapter_exited':
    case 'dap_connection_closed':
    case 'terminated':
      commands.push(
        { type: 'log', level: 'info', message: `[ProxyManager] Status: ${message.status}` },
        { 
          type: 'emitEvent', 
          event: 'exit', 
          args: [message.code || 1, message.signal || undefined] 
        }
      );
      break;
  }

  return { commands };
}

/**
 * Handle error messages (Phase 1)
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
 * Handle DAP events (Phase 2 placeholder)
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
      const threadId = message.body?.threadId;
      const reason = message.body?.reason || 'unknown';
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
    
    default:
      // Forward unknown events as generic DAP events
      commands.push({
        type: 'emitEvent',
        event: 'dap-event' as any,
        args: [message.event, message.body]
      });
  }

  return { commands, newState };
}

/**
 * Handle DAP responses (Phase 3 placeholder)
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
        level: 'warn',
        message: `[ProxyManager] Received response for unknown request: ${message.requestId}`
      }]
    };
  }

  // This will be expanded in Phase 3
  // For now, just log and emit basic events
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
  
  const msg = message as any;
  return typeof msg.sessionId === 'string' && typeof msg.type === 'string';
}
