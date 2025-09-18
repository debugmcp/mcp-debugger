/**
 * Simple file existence checker - TRUE HANDS-OFF APPROACH
 * 
 * POLICY: 
 * 1. Accept all paths as-is from MCP clients
 * 2. Only check file existence for immediate UX feedback  
 * 3. Container mode: Simple /workspace/ prefix only
 * 4. Pass original paths to debug adapter unchanged
 * 5. No path interpretation, normalization, or cross-platform logic
 */

import { IFileSystem, IEnvironment } from '@debugmcp/shared';
import { translatePathForContainer } from './container-path-utils.js';

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
   * Check if file exists - the ONLY path operation we perform
   */
  async checkExists(path: string): Promise<FileExistenceResult> {
    const effectivePath = this.getEffectivePath(path);
    
    this.logger?.debug(`[SimpleFileChecker] Checking existence: ${path} -> ${effectivePath}`);
    
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

  /**
   * Get the effective path we'll check for existence
   * ONLY container prefix logic - no other path manipulation
   */
  private getEffectivePath(path: string): string {
    return translatePathForContainer(path, this.environment);
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
