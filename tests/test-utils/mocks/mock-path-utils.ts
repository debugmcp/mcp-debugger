import { IPathUtils } from '../../src/interfaces/path-utils.js';

/**
 * Mock implementation of IPathUtils for testing
 * Can simulate Windows or POSIX path behavior regardless of actual OS
 */
export class MockPathUtils implements IPathUtils {
  private os: 'windows' | 'posix';

  constructor(os: 'windows' | 'posix') {
    this.os = os;
  }

  isAbsolute(path: string): boolean {
    if (this.os === 'windows') {
      // Windows: C:\path or \\server\share
      return /^[A-Za-z]:[\\\/]/.test(path) || /^\\\\/.test(path);
    } else {
      // POSIX: /path
      return path.startsWith('/');
    }
  }

  resolve(...pathSegments: string[]): string {
    if (this.os === 'windows') {
      return this.windowsResolve(...pathSegments);
    } else {
      return this.posixResolve(...pathSegments);
    }
  }

  join(...paths: string[]): string {
    const sep = this.sep;
    const joined = paths
      .filter(p => p && p.length > 0)
      .join(sep)
      .replace(/[\\\/]+/g, sep);
    
    // Remove trailing separator unless it's the root
    if (joined.length > 1 && joined.endsWith(sep)) {
      return joined.slice(0, -1);
    }
    return joined;
  }

  dirname(path: string): string {
    const sep = this.sep;
    const lastIndex = path.lastIndexOf(sep);
    if (lastIndex === -1) return '.';
    if (lastIndex === 0) return sep;
    return path.slice(0, lastIndex);
  }

  basename(path: string, ext?: string): string {
    const sep = this.sep;
    const lastIndex = path.lastIndexOf(sep);
    const base = lastIndex === -1 ? path : path.slice(lastIndex + 1);
    
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  }

  get sep(): string {
    return this.os === 'windows' ? '\\' : '/';
  }

  private windowsResolve(...pathSegments: string[]): string {
    // Find the last absolute path in the segments
    let basePath = '';
    let segments: string[] = [];
    
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const segment = pathSegments[i];
      if (!segment) continue;
      
      if (this.isAbsolute(segment)) {
        basePath = segment;
        segments = pathSegments.slice(i + 1);
        break;
      }
    }
    
    // If no absolute path found, use default
    if (!basePath) {
      basePath = 'C:\\';
      segments = pathSegments;
    }
    
    // Build the path
    let result = basePath;
    
    for (const segment of segments) {
      if (!segment) continue;
      
      // Normalize the segment
      const normalizedSegment = segment
        .replace(/^\.\\/, '')  // Remove leading .\
        .replace(/^\.\//, '')  // Remove leading ./
        .replace(/[\\\/]+/g, '\\'); // Normalize separators
      
      if (normalizedSegment === '.') continue;
      
      // Ensure proper joining
      if (!result.endsWith('\\')) {
        result += '\\';
      }
      result += normalizedSegment;
    }
    
    // Clean up the result
    result = result
      .replace(/\\+/g, '\\')  // Remove duplicate backslashes
      .replace(/\\$/, '');    // Remove trailing backslash
    
    // Special case for drive root
    if (/^[A-Za-z]:$/.test(result)) {
      result += '\\';
    }
    
    return result;
  }

  private posixResolve(...pathSegments: string[]): string {
    // Find the last absolute path in the segments
    let basePath = '';
    let segments: string[] = [];
    
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const segment = pathSegments[i];
      if (!segment) continue;
      
      if (this.isAbsolute(segment)) {
        basePath = segment;
        segments = pathSegments.slice(i + 1);
        break;
      }
    }
    
    // If no absolute path found, use default
    if (!basePath) {
      basePath = '/home/user';
      segments = pathSegments;
    }
    
    // Build the path
    let result = basePath;
    
    for (const segment of segments) {
      if (!segment) continue;
      
      // Normalize the segment
      const normalizedSegment = segment
        .replace(/^\.\//, '')  // Remove leading ./
        .replace(/\/+/g, '/'); // Normalize separators
      
      if (normalizedSegment === '.') continue;
      
      // Ensure proper joining
      if (!result.endsWith('/')) {
        result += '/';
      }
      result += normalizedSegment;
    }
    
    // Clean up the result
    result = result
      .replace(/\/+/g, '/')  // Remove duplicate slashes
      .replace(/\/$/, '');   // Remove trailing slash (except for root)
    
    return result || '/';
  }
}

/**
 * Factory functions for common test scenarios
 */
export const createWindowsPathUtils = () => new MockPathUtils('windows');
export const createPosixPathUtils = () => new MockPathUtils('posix');
