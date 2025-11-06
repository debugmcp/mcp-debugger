/**
 * FileSystem abstraction interface for dependency injection
 *
 * This interface allows filesystem operations to be mocked in tests,
 * following the same pattern as CommandFinder for the Python adapter.
 *
 * @since 2.1.0
 */
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

// Create require function for ES modules
// Use a more robust fallback when import.meta.url is not available
const require = createRequire(
  typeof import.meta?.url !== 'undefined'
    ? import.meta.url
    : pathToFileURL(process.cwd() + '/').href
);

/**
 * FileSystem interface for basic filesystem operations
 */
export interface FileSystem {
  /**
   * Synchronously check if a path exists
   * @param path The path to check
   * @returns true if the path exists, false otherwise
   */
  existsSync(path: string): boolean;

  /**
   * Synchronously read a file as text
   * @param path The path to read
   * @param encoding The encoding to use (typically 'utf8')
   * @returns The file contents as a string, or empty string on error
   */
  readFileSync(path: string, encoding: string): string;
}

/**
 * Production implementation using Node.js fs module
 */
export class NodeFileSystem implements FileSystem {
  private fs: typeof import('fs');

  constructor() {
    this.fs = require('fs');
  }

  existsSync(path: string): boolean {
    try {
      return this.fs.existsSync(path);
    } catch {
      // Return false for any filesystem errors (permissions, etc.)
      return false;
    }
  }

  readFileSync(path: string, encoding: string): string {
    try {
      // TypeScript requires encoding to be cast to BufferEncoding
      return this.fs.readFileSync(path, encoding as BufferEncoding);
    } catch {
      // Return empty string for any filesystem errors
      return '';
    }
  }
}

/**
 * Default filesystem instance for production use
 */
let defaultFileSystem: FileSystem = new NodeFileSystem();

/**
 * Set the default filesystem implementation (useful for testing)
 * @param fileSystem The FileSystem to use as default
 */
export function setDefaultFileSystem(fileSystem: FileSystem): void {
  defaultFileSystem = fileSystem;
}

/**
 * Get the default filesystem implementation
 * @returns The current default FileSystem
 */
export function getDefaultFileSystem(): FileSystem {
  return defaultFileSystem;
}