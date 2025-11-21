/**
 * Type guards and validation utilities for runtime type safety
 * These guards ensure type safety at critical boundaries (IPC, serialization, etc.)
 */

import { AdapterCommand } from '@debugmcp/shared';
import { ProxyInitPayload } from '../proxy/dap-proxy-interfaces.js';

/**
 * Type guard for AdapterCommand
 * Validates that an object has the required structure for an adapter command
 */
export function isValidAdapterCommand(obj: unknown): obj is AdapterCommand {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  const cmd = obj as Record<string, unknown>;
  
  // Required fields
  if (typeof cmd.command !== 'string' || !cmd.command) {
    return false;
  }
  
  if (!Array.isArray(cmd.args)) {
    return false;
  }
  
  // All args must be strings
  if (!cmd.args.every((arg: unknown) => typeof arg === 'string')) {
    return false;
  }
  
  // Optional env must be a record of strings if present
  if (cmd.env !== undefined) {
    if (!cmd.env || typeof cmd.env !== 'object' || Array.isArray(cmd.env)) {
      return false;
    }
    
    // Check all env values are strings
    for (const [key, value] of Object.entries(cmd.env)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Validates and returns a typed AdapterCommand
 * Throws descriptive error if validation fails
 */
export function validateAdapterCommand(obj: unknown, source: string): AdapterCommand {
  if (!isValidAdapterCommand(obj)) {
    const details = {
      receivedType: typeof obj,
      receivedValue: obj,
      source,
      requiredStructure: {
        command: 'string (required)',
        args: 'string[] (required)',
        env: 'Record<string, string> (optional)'
      }
    };
    
    const error = new Error(`Invalid adapter command from ${source}: ${JSON.stringify(details, null, 2)}`);
    console.error('[TYPE VALIDATION ERROR]', error.message);
    throw error;
  }
  
  return obj;
}

/**
 * Type guard for ProxyInitPayload adapter command
 * Validates the optional adapterCommand field
 */
export function hasValidAdapterCommand(payload: ProxyInitPayload): boolean {
  if (!payload.adapterCommand) {
    return true; // Optional field, absence is valid
  }
  
  return isValidAdapterCommand(payload.adapterCommand);
}

/**
 * Validates ProxyInitPayload
 * Ensures all required fields are present and valid
 */
export function validateProxyInitPayload(payload: unknown): ProxyInitPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid ProxyInitPayload: must be an object');
  }
  
  const p = payload as Record<string, unknown>;
  
  // Check required fields
  const requiredFields = [
    'cmd', 'sessionId', 'executablePath', 'adapterHost', 
    'adapterPort', 'logDir', 'scriptPath'
  ];
  
  for (const field of requiredFields) {
    if (!p[field]) {
      throw new Error(`Invalid ProxyInitPayload: missing required field '${field}'`);
    }
  }
  
  // Validate adapterCommand if present
  if (p.adapterCommand && !isValidAdapterCommand(p.adapterCommand)) {
    const error = new Error(`Invalid ProxyInitPayload: adapterCommand validation failed - ${JSON.stringify(p.adapterCommand)}`);
    console.error('[VALIDATION ERROR]', error.message);
    throw error;
  }

  if (p.launchConfig && typeof p.launchConfig !== 'object') {
    throw new Error('Invalid ProxyInitPayload: launchConfig must be an object when provided');
  }
  
  return payload as ProxyInitPayload;
}

/**
 * Safely serialize adapter command for IPC
 * Validates before serialization to prevent undefined propagation
 */
export function serializeAdapterCommand(cmd: AdapterCommand): string {
  validateAdapterCommand(cmd, 'serialization');
  return JSON.stringify(cmd);
}

/**
 * Safely deserialize adapter command from IPC
 * Validates after parsing to ensure type safety
 */
export function deserializeAdapterCommand(data: string, source: string): AdapterCommand {
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    throw new Error(`Failed to parse adapter command from ${source}: ${e}`);
  }
  
  return validateAdapterCommand(parsed, `deserialization-${source}`);
}

/**
 * Create a type-safe adapter command with defaults
 * Ensures all required fields are present
 */
export function createAdapterCommand(
  command: string,
  args: string[] = [],
  env?: Record<string, string>
): AdapterCommand {
  if (!command || typeof command !== 'string') {
    throw new Error(`Invalid command for adapter: "${command}"`);
  }
  
  const cmd: AdapterCommand = {
    command,
    args: args || [],
    env: env || {}
  };
  
  // Validate the created command
  return validateAdapterCommand(cmd, 'creation');
}

/**
 * Type-safe property access for adapter commands
 * Prevents accessing properties on undefined
 */
export function getAdapterCommandProperty<K extends keyof AdapterCommand>(
  cmd: unknown,
  property: K,
  defaultValue: AdapterCommand[K]
): AdapterCommand[K] {
  if (!isValidAdapterCommand(cmd)) {
    console.warn(`[TYPE GUARD] Invalid adapter command, returning default for ${String(property)}`);
    return defaultValue;
  }
  
  return cmd[property] ?? defaultValue;
}

/**
 * Logging utility for adapter command validation
 * Provides consistent logging format
 */
export function logAdapterCommandValidation(
  cmd: unknown,
  source: string,
  isValid: boolean,
  details?: unknown
): void {
  const logData = {
    source,
    isValid,
    command: cmd,
    timestamp: new Date().toISOString(),
    details
  };
  
  if (isValid) {
    console.log('[ADAPTER COMMAND VALIDATION]', JSON.stringify(logData, null, 2));
  } else {
    console.error('[ADAPTER COMMAND VALIDATION ERROR]', JSON.stringify(logData, null, 2));
  }
}
