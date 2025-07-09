/**
 * Migration utilities for transitioning from Python-specific to language-agnostic sessions
 */
import { DebugLanguage } from '../session/models.js';
import { ProxyConfig } from '../proxy/proxy-config.js';

/**
 * Session configuration interface for migration
 */
export interface SessionConfig {
  language: DebugLanguage;
  name?: string;
  executablePath?: string;
  pythonPath?: string;  // @deprecated
  [key: string]: unknown; // Allow additional properties for flexibility
}

/**
 * Migrate old session configuration to new format
 * @param oldConfig Configuration that may use deprecated fields
 * @returns Migrated configuration
 */
export function migrateSessionConfig(oldConfig: Record<string, unknown>): SessionConfig {
  const config: SessionConfig = {
    ...oldConfig,
    language: (oldConfig.language as DebugLanguage) || DebugLanguage.PYTHON,
    executablePath: (oldConfig.executablePath as string) || (oldConfig.pythonPath as string),
  };
  
  // Log deprecation warning if pythonPath is used
  if (oldConfig.pythonPath && !oldConfig.executablePath) {
    console.warn(
      '[DEPRECATION] pythonPath is deprecated in session configuration. ' +
      'Use executablePath instead. This will be removed in v3.0.0'
    );
  }
  
  // Remove old fields to catch usage
  delete config.pythonPath;
  
  return config;
}

/**
 * Migrate old proxy configuration to new format
 * @param oldConfig Configuration that may use deprecated fields
 * @returns Migrated configuration
 */
export function migrateProxyConfig(oldConfig: Record<string, unknown>): ProxyConfig {
  if (oldConfig.pythonPath && !oldConfig.executablePath) {
    console.warn(
      '[DEPRECATION] pythonPath is deprecated in proxy configuration. ' +
      'Use executablePath instead. This will be removed in v3.0.0'
    );
  }
  
  const config: ProxyConfig = {
    ...oldConfig,
    language: (oldConfig.language as DebugLanguage) || DebugLanguage.PYTHON,
    executablePath: (oldConfig.pythonPath as string) || (oldConfig.executablePath as string),
  } as ProxyConfig;
  
  // Keep pythonPath for backward compatibility with current proxy implementation
  // This will be removed when proxy is updated to use executablePath
  if (config.executablePath && !config.pythonPath) {
    config.pythonPath = config.executablePath;
  }
  
  return config;
}

/**
 * Check if a configuration is using deprecated fields
 * @param config Configuration to check
 * @returns True if deprecated fields are in use
 */
export function isUsingDeprecatedFields(config: Record<string, unknown>): boolean {
  return !!(config.pythonPath && !config.executablePath);
}

/**
 * Get a user-friendly message about deprecated field usage
 * @param fieldName Name of the deprecated field
 * @param replacementField Name of the replacement field
 * @returns Deprecation message
 */
export function getDeprecationMessage(fieldName: string, replacementField: string): string {
  return `[DEPRECATION] '${fieldName}' is deprecated and will be removed in v3.0.0. ` +
         `Please use '${replacementField}' instead.`;
}
