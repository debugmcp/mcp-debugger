/**
 * Simple file existence checker - Centralized path resolution approach
 * 
 * POLICY: 
 * 1. Use centralized path resolution from container-path-utils
 * 2. Only check file existence for immediate UX feedback
 * 3. Log both original and resolved paths for debugging
 * 4. Clear error messages for path issues
 */

import * as nodePath from 'node:path';
import { IFileSystem, IEnvironment } from '@debugmcp/shared';
import { resolvePathForRuntime, getPathDescription, isContainerMode } from './container-path-utils.js';

/**
 * Result of simple file existence check
 */
export interface FileExistenceResult {
  exists: boolean;
  originalPath: string;     // Path as provided by client
  effectivePath: string;    // Path we actually checked for existence
  errorMessage?: string;    // Only if check failed due to system error
}

/**
 * Simple file checker that follows hands-off path policy
 */
export class SimpleFileChecker {
  constructor(
    private readonly fileSystem: IFileSystem,
    private readonly environment: IEnvironment,
    private readonly logger?: { debug: (msg: string, meta?: unknown) => void }
  ) {}

  /**
   * Check if file exists - using centralized path resolution
   */
  async checkExists(path: string): Promise<FileExistenceResult> {
    let effectivePath: string;
    
    try {
      // Use centralized path resolution
      effectivePath = resolvePathForRuntime(path, this.environment);

      // In host mode, reject non-absolute paths early.
      // Node's fs.pathExists() resolves relative paths via process.cwd(),
      // which can pass the existence check but fail downstream in debug adapters.
      // Docker mode is unaffected (workspace prefix makes paths absolute).
      if (!isContainerMode(this.environment) && !nodePath.isAbsolute(effectivePath)) {
        this.logger?.debug(`[SimpleFileChecker] Relative path rejected in host mode: ${effectivePath}`);
        return {
          exists: false,
          originalPath: path,
          effectivePath,
          errorMessage: `Path must be absolute. Received: "${path}"`
        };
      }

      const pathDesc = getPathDescription(path, effectivePath, this.environment);
      this.logger?.debug(`[SimpleFileChecker] Checking existence: ${pathDesc}`);
    } catch (error) {
      // Path resolution failed - return with error
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.debug(`[SimpleFileChecker] Path resolution failed: ${errorMessage}`);
      
      return {
        exists: false,
        originalPath: path,
        effectivePath: path, // Use original since resolution failed
        errorMessage
      };
    }
    
    try {
      const exists = await this.fileSystem.pathExists(effectivePath);
      return { 
        exists, 
        originalPath: path, 
        effectivePath 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.debug(`[SimpleFileChecker] Check failed for ${effectivePath}: ${errorMessage}`);
      
      return {
        exists: false,
        originalPath: path,
        effectivePath,
        errorMessage: `Cannot check file existence: ${errorMessage}`
      };
    }
  }
}

/**
 * Factory function to create a SimpleFileChecker instance
 */
export function createSimpleFileChecker(
  fileSystem: IFileSystem,
  environment: IEnvironment,
  logger?: { debug: (msg: string, meta?: unknown) => void }
): SimpleFileChecker {
  return new SimpleFileChecker(fileSystem, environment, logger);
}
