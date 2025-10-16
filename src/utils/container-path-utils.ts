/**
 * Container path utilities - Centralized path resolution for container and host modes
 * 
 * POLICY:
 * 1. Single source of truth for all path resolution
 * 2. Container mode requires MCP_WORKSPACE_ROOT environment variable
 * 3. No OS-specific transformations or smart heuristics
 * 4. Clear error messages when paths don't match expectations
 * 5. Deterministic behavior across all deployment scenarios
 */

import { IEnvironment } from '@debugmcp/shared';
import * as path from 'path';

/**
 * Check if the application is running in container mode
 */
export function isContainerMode(environment: IEnvironment): boolean {
  return environment.get('MCP_CONTAINER') === 'true';
}

/**
 * Get the workspace root directory for container mode
 * @throws Error if in container mode but MCP_WORKSPACE_ROOT is not set
 */
export function getWorkspaceRoot(environment: IEnvironment): string {
  if (!isContainerMode(environment)) {
    throw new Error('getWorkspaceRoot should only be called in container mode');
  }
  
  const root = environment.get('MCP_WORKSPACE_ROOT');
  if (!root) {
    throw new Error(
      'MCP_WORKSPACE_ROOT environment variable is required in container mode. ' +
      'This should be set to the mount point of the workspace (e.g., /workspace)'
    );
  }
  
  // Normalize: ensure no trailing slash for consistency
  return root.replace(/\/+$/, '');
}

/**
 * Resolve a path for the current runtime environment
 * 
 * @param inputPath The path to resolve (from MCP client)
 * @param environment The environment interface
 * @returns The resolved absolute path appropriate for the runtime
 * 
 * Host mode: Returns the input path unchanged
 * Container mode: Always prefixes with workspace root (simple, no validation)
 */
export function resolvePathForRuntime(inputPath: string, environment: IEnvironment): string {
  // Host mode: pass through unchanged
  if (!isContainerMode(environment)) {
    return inputPath;
  }
  
  // Container mode: simple prefix with workspace root
  const workspaceRoot = getWorkspaceRoot(environment);
  
  // Simply prepend the workspace root to any path
  // No validation, no rejection, no smart handling
  return `${workspaceRoot}/${inputPath}`;
}

/**
 * Legacy compatibility - translates a path for container mode if needed
 * @deprecated Use resolvePathForRuntime instead
 */
export function translatePathForContainer(inputPath: string, environment: IEnvironment): string {
  try {
    return resolvePathForRuntime(inputPath, environment);
  } catch {
    // Legacy behavior: on error, try simple prefix
    if (isContainerMode(environment)) {
      const root = environment.get('MCP_WORKSPACE_ROOT') || '/workspace';
      const normalized = inputPath.replace(/\\/g, '/');
      
      // Don't double-prefix
      if (normalized.startsWith(root)) {
        return normalized;
      }
      
      // Simple prefix for legacy compatibility
      return path.posix.join(root, normalized.replace(/^\/+/, ''));
    }
    return inputPath;
  }
}

/**
 * Get a descriptive path for error messages
 * Shows both the original and resolved path for debugging
 */
export function getPathDescription(
  originalPath: string,
  resolvedPath: string,
  environment: IEnvironment
): string {
  if (!isContainerMode(environment)) {
    return originalPath;
  }
  
  if (originalPath === resolvedPath) {
    return originalPath;
  }
  
  return `'${originalPath}' (resolved to: '${resolvedPath}')`;
}
