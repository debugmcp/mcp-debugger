/**
 * Interface for path utilities to enable cross-platform testing
 * Abstracts Node.js path module functionality
 */
export interface IPathUtils {
  /**
   * Determines if a path is absolute
   */
  isAbsolute(path: string): boolean;

  /**
   * Resolves a sequence of paths into an absolute path
   */
  resolve(...pathSegments: string[]): string;

  /**
   * Joins path segments together
   */
  join(...paths: string[]): string;

  /**
   * Returns the directory name of a path
   */
  dirname(path: string): string;

  /**
   * Returns the base name of a path
   */
  basename(path: string, ext?: string): string;

  /**
   * Platform-specific path separator
   */
  readonly sep: string;
}
