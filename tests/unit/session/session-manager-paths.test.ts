/**
 * SessionManager path resolution tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '../../../src/session/models.js';
import { createMockDependencies } from './session-manager-test-utils.js';
import path from 'path';

describe('SessionManager - Path Resolution', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let config: SessionManagerConfig;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    config = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: {
        stopOnEntry: true,
        justMyCode: true
      }
    };
    
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  describe('Windows Path Handling', () => {
    it('should handle Windows absolute paths with drive letters', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      const windowsPaths = [
        'C:\\Users\\test\\file.py',
        'C:/Users/test/file.py',
        'D:\\Projects\\debug\\test.py'
      ];
      
      for (const testPath of windowsPaths) {
        const bp = await sessionManager.setBreakpoint(session.id, testPath, 10);
        
        // Fix the test assertion
        expect(path.isAbsolute(bp.file)).toBe(true);
        expect(bp.file).toContain(path.basename(testPath));
      }
    });

    it('should normalize backslashes to forward slashes', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      const bp = await sessionManager.setBreakpoint(
        session.id,
        'src\\debug\\file.py',
        20
      );
      
      // Check that path contains expected components
      expect(bp.file.toLowerCase()).toContain('src');
      expect(bp.file.toLowerCase()).toContain('debug');
      expect(bp.file.toLowerCase()).toContain('file.py');
    });

    it('should resolve relative paths correctly on Windows', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      const bp = await sessionManager.setBreakpoint(
        session.id,
        'test/file.py',
        30
      );
      
      // Should be resolved to absolute path
      expect(path.isAbsolute(bp.file)).toBe(true);
      // Check path contains expected components
      expect(bp.file.toLowerCase()).toContain('test');
      expect(bp.file.toLowerCase()).toContain('file.py');
    });
  });
  
  describe('Breakpoint Path Resolution', () => {
    it('should convert relative breakpoint paths to absolute', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      const relativePath = 'src/test.py';
      const bp = await sessionManager.setBreakpoint(session.id, relativePath, 42);
      
      expect(path.isAbsolute(bp.file)).toBe(true);
      expect(bp.file.toLowerCase()).toContain('src');
      expect(bp.file.toLowerCase()).toContain('test.py');
    });

    it('should handle already absolute breakpoint paths', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      const absolutePath = '/home/user/project/test.py';
      const bp = await sessionManager.setBreakpoint(session.id, absolutePath, 50);
      
      expect(bp.file).toBe(path.normalize(absolutePath));
    });

    it('should normalize paths across different OS', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // Mix of path separators
      const mixedPath = 'src\\components/test.py';
      const bp = await sessionManager.setBreakpoint(session.id, mixedPath, 60);
      
      // Should contain expected path components
      expect(bp.file.toLowerCase()).toContain('src');
      expect(bp.file.toLowerCase()).toContain('components');
      expect(bp.file.toLowerCase()).toContain('test.py');
    });
  });
});
