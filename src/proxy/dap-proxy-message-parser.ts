/**
 * Message parsing and validation utilities for DAP Proxy
 * Pure functions with no side effects for easy testing
 */

import {
  ParentCommand,
  ProxyInitPayload,
  DapCommandPayload,
  TerminatePayload
} from './dap-proxy-interfaces.js';

export class MessageParser {
  /**
   * Parse and validate a command from the parent process
   * @throws {Error} if the message is invalid
   */
  static parseCommand(message: unknown): ParentCommand {
    // Handle string messages (from IPC)
    if (typeof message === 'string') {
      try {
        const parsed = JSON.parse(message);
        return this.parseCommand(parsed); // Recursive call with parsed object
      } catch (e) {
        throw new Error(`Failed to parse JSON message: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Validate object structure
    if (!message || typeof message !== 'object') {
      throw new Error(`Invalid message type: expected object, got ${typeof message}`);
    }

    const obj = message as Record<string, unknown>;
    
    // Check for required 'cmd' field
    if (!obj.cmd || typeof obj.cmd !== 'string') {
      throw new Error(`Missing or invalid 'cmd' field: ${obj.cmd}`);
    }

    // Route to specific validators based on command type
    // Note: sessionId validation is done per command type since terminate can work without it
    switch (obj.cmd) {
      case 'init':
        return this.validateInitPayload(obj);
      case 'dap':
        return this.validateDapPayload(obj);
      case 'terminate':
        return this.validateTerminatePayload(obj);
      default:
        throw new Error(`Unknown command type: ${obj.cmd}`);
    }
  }

  /**
   * Validate and type-guard an init payload
   * @throws {Error} if validation fails
   */
  static validateInitPayload(payload: unknown): ProxyInitPayload {
    const obj = payload as Record<string, unknown>;

    // Required string fields
    const requiredStrings = [
      'sessionId', 'executablePath', 'adapterHost', 'logDir', 'scriptPath'
    ];
    
    for (const field of requiredStrings) {
      if (!obj[field] || typeof obj[field] !== 'string') {
        throw new Error(`Init payload missing or invalid '${field}': ${obj[field]}`);
      }
    }

    // Required number field
    if (typeof obj.adapterPort !== 'number' || obj.adapterPort <= 0 || obj.adapterPort > 65535) {
      throw new Error(`Init payload invalid 'adapterPort': ${obj.adapterPort}`);
    }

    // Optional fields validation
    if (obj.scriptArgs !== undefined && !Array.isArray(obj.scriptArgs)) {
      throw new Error(`Init payload 'scriptArgs' must be an array if provided`);
    }

    if (obj.stopOnEntry !== undefined && typeof obj.stopOnEntry !== 'boolean') {
      throw new Error(`Init payload 'stopOnEntry' must be a boolean if provided`);
    }

    if (obj.justMyCode !== undefined && typeof obj.justMyCode !== 'boolean') {
      throw new Error(`Init payload 'justMyCode' must be a boolean if provided`);
    }

    if (obj.dryRunSpawn !== undefined && typeof obj.dryRunSpawn !== 'boolean') {
      throw new Error(`Init payload 'dryRunSpawn' must be a boolean if provided`);
    }

    // Validate initialBreakpoints if provided
    if (obj.initialBreakpoints !== undefined) {
      if (!Array.isArray(obj.initialBreakpoints)) {
        throw new Error(`Init payload 'initialBreakpoints' must be an array if provided`);
      }
      
      for (const bp of obj.initialBreakpoints) {
        if (!bp || typeof bp !== 'object') {
          throw new Error(`Invalid breakpoint in initialBreakpoints`);
        }
        const bpObj = bp as Record<string, unknown>;
        if (typeof bpObj.file !== 'string' || typeof bpObj.line !== 'number') {
          throw new Error(`Breakpoint must have 'file' (string) and 'line' (number)`);
        }
        if (bpObj.condition !== undefined && typeof bpObj.condition !== 'string') {
          throw new Error(`Breakpoint 'condition' must be a string if provided`);
        }
      }
    }

    // Type assertion via unknown to satisfy TypeScript
    return obj as unknown as ProxyInitPayload;
  }

  /**
   * Validate and type-guard a DAP command payload
   * @throws {Error} if validation fails
   */
  static validateDapPayload(payload: unknown): DapCommandPayload {
    const obj = payload as Record<string, unknown>;

    // Required string fields
    const requiredStrings = ['sessionId', 'requestId', 'dapCommand'];
    
    for (const field of requiredStrings) {
      if (!obj[field] || typeof obj[field] !== 'string') {
        throw new Error(`DAP payload missing or invalid '${field}': ${obj[field]}`);
      }
    }

    // dapArgs is optional but commonly used
    if (obj.dapArgs !== undefined && obj.dapArgs === null) {
      throw new Error(`DAP payload 'dapArgs' should not be null`);
    }

    // Type assertion via unknown to satisfy TypeScript
    return obj as unknown as DapCommandPayload;
  }

  /**
   * Validate and type-guard a terminate payload
   * @throws {Error} if validation fails
   */
  static validateTerminatePayload(payload: unknown): TerminatePayload {
    const obj = payload as Record<string, unknown>;

    // sessionId is preferred but not strictly required for emergency shutdown
    if (obj.sessionId !== undefined && typeof obj.sessionId !== 'string') {
      throw new Error(`Terminate payload has invalid 'sessionId' type: ${typeof obj.sessionId}`);
    }

    // Type assertion via unknown to satisfy TypeScript
    return obj as unknown as TerminatePayload;
  }

  /**
   * Helper to check if a message is a string that needs parsing
   */
  static isStringMessage(message: unknown): message is string {
    return typeof message === 'string';
  }

}
