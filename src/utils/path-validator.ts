/**
 * Centralized file path validation service
 * Provides consistent path validation and resolution across the entire application
 */
import path from 'path';
import { IFileSystem, IEnvironment } from '../interfaces/external-dependencies.js';

/**
 * Result of path validation
 */
export interface PathValidationResult {
  isValid: boolean;
  resolvedPath: string;      // Absolute path with container prefix if needed
  errorMessage?: string;
  originalPath: string;       // For debugging/logging
  isContainer: boolean;       // Whether container mode was applied
}

/**
 * Options for path validation
 */
export interface PathValidationOptions {
  allowSymlinks?: boolean;    // Whether to follow symlinks (default: true)
  cacheDuration?: number;     // Cache duration in milliseconds (default: 5000)
}

/**
 * Cached validation result
 */
interface CachedResult {
  result: PathValidationResult;
  timestamp: number;
}

/**
 * Centralized path validator for consistent file path handling
 */
export class PathValidator {
  private cache = new Map<string, CachedResult>();
  private readonly defaultCacheDuration = 5000; // 5 seconds
  
  constructor(
    private readonly fileSystem: IFileSystem,
    private readonly environment: IEnvironment,
    private readonly logger?: { debug: (msg: string, meta?: unknown) => void }
  ) {}

  /**
   * Check if running in container mode
   */
  private get isContainer(): boolean {
    return this.environment.get('MCP_CONTAINER') === 'true';
  }

  /**
   * Normalize path for cross-platform compatibility
   */
  private normalizePath(filePath: string): string {
    // Normalize path separators and remove redundant segments
    return path.normalize(filePath);
  }

  /**
   * Resolve path to absolute form
   */
  private resolvePath(filePath: string): string {
    const normalized = this.normalizePath(filePath);
    
    // If already absolute, return as-is
    if (path.isAbsolute(normalized)) {
      return normalized;
    }
    
    // Resolve relative to current working directory
    const cwd = this.environment.getCurrentWorkingDirectory();
    return path.resolve(cwd, normalized);
  }

  /**
   * Apply container path translation if needed
   */
  private applyContainerPath(filePath: string): string {
    if (!this.isContainer) {
      return filePath;
    }

    // First, normalize to forward slashes for container environment
    const normalizedPath = filePath.replace(/\\/g, '/');

    // In container mode, prepend /workspace/ if not already present
    if (!normalizedPath.startsWith('/workspace/')) {
      // If it's an absolute path, we need to handle it differently
      if (path.isAbsolute(filePath)) {
        // If it's an absolute Windows path (e.g., C:\...), strip the drive letter
        const windowsDriveRegex = /^[a-zA-Z]:\\/;
        const pathWithoutDrive = filePath.replace(windowsDriveRegex, '');
        
        // Normalize to forward slashes for container
        const normalizedForContainer = pathWithoutDrive.replace(/\\/g, '/');
        
        return `/workspace${normalizedForContainer.startsWith('/') ? '' : '/'}${normalizedForContainer}`;
      } else {
        // For relative paths, just prepend /workspace/
        return `/workspace/${normalizedPath}`;
      }
    }
    
    return normalizedPath;
  }

  /**
   * Check if path is in cache and still valid
   */
  private getCachedResult(cacheKey: string, cacheDuration: number): PathValidationResult | null {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < cacheDuration) {
      this.logger?.debug(`[PathValidator] Cache hit for: ${cacheKey}`);
      return cached.result;
    }
    return null;
  }

  /**
   * Store result in cache
   */
  private setCachedResult(cacheKey: string, result: PathValidationResult): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries periodically
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [key, cached] of this.cache.entries()) {
        if (now - cached.timestamp > this.defaultCacheDuration * 2) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Validate a file path asynchronously
   */
  async validateFilePath(
    requestedPath: string, 
    options: PathValidationOptions = {}
  ): Promise<PathValidationResult> {
    const startTime = Date.now();
    const cacheDuration = options.cacheDuration ?? this.defaultCacheDuration;
    
    // Generate cache key including options
    const cacheKey = `${requestedPath}:${this.isContainer}:${options.allowSymlinks}`;
    
    // Check cache first
    const cachedResult = this.getCachedResult(cacheKey, cacheDuration);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Step 1: Normalize the path
      const normalized = this.normalizePath(requestedPath);
      
      // Step 2: Apply container transformation if needed
      // In container mode, we handle paths differently
      let resolved: string;
      if (this.isContainer) {
        // In container mode, don't resolve relative paths to absolute first
        resolved = this.applyContainerPath(normalized);
      } else {
        // In host mode, resolve to absolute path
        resolved = this.resolvePath(normalized);
      }
      
      // Step 4: Check if file exists
      const exists = await this.fileSystem.pathExists(resolved);
      
      if (exists) {
        // Step 5: Handle symlinks if needed
        if (options.allowSymlinks !== false) {
          try {
            const stats = await this.fileSystem.stat(resolved);
            if (stats.isSymbolicLink && stats.isSymbolicLink()) {
              this.logger?.debug(`[PathValidator] Path is a symlink: ${resolved}`);
            }
          } catch (err) {
            // If stat fails, continue with validation
            this.logger?.debug(`[PathValidator] Could not stat file: ${resolved}`, { error: err });
          }
        }
        
        const result: PathValidationResult = {
          isValid: true,
          resolvedPath: resolved,
          originalPath: requestedPath,
          isContainer: this.isContainer
        };
        
        // Cache the successful result
        this.setCachedResult(cacheKey, result);
        
        // Log performance
        const duration = Date.now() - startTime;
        this.logger?.debug(`[PathValidator] Validation completed in ${duration}ms`, { 
          originalPath: requestedPath,
          resolvedPath: resolved,
          isContainer: this.isContainer
        });
        
        return result;
      } else {
        const result: PathValidationResult = {
          isValid: false,
          resolvedPath: resolved,
          originalPath: requestedPath,
          isContainer: this.isContainer,
          errorMessage: this.formatErrorMessage(requestedPath, resolved)
        };
        
        // Don't cache failed results as aggressively
        if (cacheDuration > 1000) {
          this.setCachedResult(cacheKey, result);
        }
        
        return result;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        resolvedPath: requestedPath,
        originalPath: requestedPath,
        isContainer: this.isContainer,
        errorMessage: `Path validation error: ${errorMsg}`
      };
    }
  }

  /**
   * Validate a file path synchronously
   */
  validateFilePathSync(
    requestedPath: string, 
    options: PathValidationOptions = {}
  ): PathValidationResult {
    const cacheDuration = options.cacheDuration ?? this.defaultCacheDuration;
    
    // Generate cache key including options
    const cacheKey = `${requestedPath}:${this.isContainer}:${options.allowSymlinks}`;
    
    // Check cache first
    const cachedResult = this.getCachedResult(cacheKey, cacheDuration);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Step 1: Normalize the path
      const normalized = this.normalizePath(requestedPath);
      
      // Step 2: Apply container transformation if needed
      // In container mode, we handle paths differently
      let resolved: string;
      if (this.isContainer) {
        // In container mode, don't resolve relative paths to absolute first
        resolved = this.applyContainerPath(normalized);
      } else {
        // In host mode, resolve to absolute path
        resolved = this.resolvePath(normalized);
      }
      
      // Step 4: Check if file exists
      const exists = this.fileSystem.existsSync(resolved);
      
      if (exists) {
        const result: PathValidationResult = {
          isValid: true,
          resolvedPath: resolved,
          originalPath: requestedPath,
          isContainer: this.isContainer
        };
        
        // Cache the successful result
        this.setCachedResult(cacheKey, result);
        
        return result;
      } else {
        const result: PathValidationResult = {
          isValid: false,
          resolvedPath: resolved,
          originalPath: requestedPath,
          isContainer: this.isContainer,
          errorMessage: this.formatErrorMessage(requestedPath, resolved)
        };
        
        // Don't cache failed results as aggressively
        if (cacheDuration > 1000) {
          this.setCachedResult(cacheKey, result);
        }
        
        return result;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        resolvedPath: requestedPath,
        originalPath: requestedPath,
        isContainer: this.isContainer,
        errorMessage: `Path validation error: ${errorMsg}`
      };
    }
  }

  /**
   * Format error message with helpful suggestions
   */
  private formatErrorMessage(originalPath: string, resolvedPath: string): string {
    const lines = [
      `File not found: '${originalPath}'`,
      `Resolved path: '${resolvedPath}'`,
      `Container mode: ${this.isContainer}`
    ];
    
    // Add context-specific suggestions
    if (this.isContainer) {
      lines.push('Suggestion: In container mode, ensure your file is mounted in the /workspace directory');
    } else {
      lines.push('Suggestion: Check that the file exists and the path is correct');
    }
    
    // Add path-specific hints
    if (path.isAbsolute(originalPath) && this.isContainer) {
      lines.push('Note: Absolute paths are automatically prefixed with /workspace in container mode');
    } else if (!path.isAbsolute(originalPath)) {
      const cwd = this.environment.getCurrentWorkingDirectory();
      lines.push(`Note: Relative paths are resolved from: ${cwd}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Clear the validation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0,  // Would need to track this separately
      misses: 0  // Would need to track this separately
    };
  }
}

/**
 * Factory function to create a PathValidator instance
 */
export function createPathValidator(
  fileSystem: IFileSystem,
  environment: IEnvironment,
  logger?: { debug: (msg: string, meta?: unknown) => void }
): PathValidator {
  return new PathValidator(fileSystem, environment, logger);
}
