import path from 'path';
import { IPathUtils } from '../interfaces/path-utils.js';

/**
 * Default implementation of IPathUtils using Node.js path module
 * This is used in production and delegates to the actual path module
 */
export class NodePathUtils implements IPathUtils {
  isAbsolute(inputPath: string): boolean {
    return path.isAbsolute(inputPath);
  }

  resolve(...pathSegments: string[]): string {
    return path.resolve(...pathSegments);
  }

  join(...paths: string[]): string {
    return path.join(...paths);
  }

  dirname(inputPath: string): string {
    return path.dirname(inputPath);
  }

  basename(inputPath: string, ext?: string): string {
    return path.basename(inputPath, ext);
  }

  get sep(): string {
    return path.sep;
  }
}
