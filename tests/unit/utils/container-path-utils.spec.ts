import { describe, it, expect } from 'vitest';
import {
  isContainerMode,
  getWorkspaceRoot,
  resolvePathForRuntime,
  getPathDescription,
} from '../../../src/utils/container-path-utils.js';

class MockEnvironment implements IEnvironment {
  private readonly values: Record<string, string | undefined>;
  private readonly cwd: string;

  constructor(values: Record<string, string | undefined> = {}, cwd = '/app') {
    this.values = { ...values };
    this.cwd = cwd;
  }

  get(key: string): string | undefined {
    return this.values[key];
  }

  getAll(): Record<string, string | undefined> {
    return { ...this.values };
  }

  getCurrentWorkingDirectory(): string {
    return this.cwd;
  }
}

describe('container-path-utils', () => {
  describe('isContainerMode', () => {
    it('returns true when MCP_CONTAINER is true', () => {
      const env = new MockEnvironment({ MCP_CONTAINER: 'true' });
      expect(isContainerMode(env)).toBe(true);
    });

    it('returns false when MCP_CONTAINER is not true', () => {
      const env = new MockEnvironment({ MCP_CONTAINER: 'false' });
      expect(isContainerMode(env)).toBe(false);
    });
  });

  describe('getWorkspaceRoot', () => {
    it('throws when not in container mode', () => {
      const env = new MockEnvironment();
      expect(() => getWorkspaceRoot(env)).toThrow(/only be called in container mode/);
    });

    it('throws when MCP_WORKSPACE_ROOT missing', () => {
      const env = new MockEnvironment({ MCP_CONTAINER: 'true' });
      expect(() => getWorkspaceRoot(env)).toThrow(/MCP_WORKSPACE_ROOT/);
    });

    it('returns root without trailing slash', () => {
      const env = new MockEnvironment({
        MCP_CONTAINER: 'true',
        MCP_WORKSPACE_ROOT: '/workspace/',
      });
      expect(getWorkspaceRoot(env)).toBe('/workspace');
    });
  });

  describe('resolvePathForRuntime', () => {
    it('returns original path when not in container mode', () => {
      const env = new MockEnvironment();
      expect(resolvePathForRuntime('examples/python/simple.py', env)).toBe(
        'examples/python/simple.py',
      );
    });

    it('prefixes workspace root when in container mode', () => {
      const env = new MockEnvironment({
        MCP_CONTAINER: 'true',
        MCP_WORKSPACE_ROOT: '/workspace',
      });
      expect(resolvePathForRuntime('python/simple.py', env)).toBe(
        '/workspace/python/simple.py',
      );
    });
  });

  describe('getPathDescription', () => {
    it('returns original path when not in container mode', () => {
      const env = new MockEnvironment();
      expect(getPathDescription('foo.py', '/workspace/foo.py', env)).toBe('foo.py');
    });

    it('returns original path when resolved matches original', () => {
      const env = new MockEnvironment({ MCP_CONTAINER: 'true' });
      expect(getPathDescription('foo.py', 'foo.py', env)).toBe('foo.py');
    });

    it('returns descriptive text when paths differ in container mode', () => {
      const env = new MockEnvironment({ MCP_CONTAINER: 'true' });
      expect(getPathDescription('foo.py', '/workspace/foo.py', env)).toBe(
        `'foo.py' (resolved to: '/workspace/foo.py')`,
      );
    });
  });
});
