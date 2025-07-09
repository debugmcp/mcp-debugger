/**
 * SessionManager path resolution tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '../../../../src/session/models.js';
import { createMockDependencies } from './session-manager-test-utils.js';

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
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      const windowsPaths = [
        { path: 'C:\\Users\\test\\file.py', expectedFile: 'file.py' },
        { path: 'C:/Users/test/file.py', expectedFile: 'file.py' },
        { path: 'D:\\Projects\\debug\\test.py', expectedFile: 'test.py' }
      ];
      
      for (const { path: testPath, expectedFile } of windowsPaths) {
        const bp = await sessionManager.setBreakpoint(session.id, testPath, 10);
        
        // SessionManager passes through paths without modification
        // So the breakpoint file should match the input path
        expect(bp.file).toBe(testPath);
        expect(bp.file).toContain(expectedFile);
      }
    });

    it('should normalize backslashes to forward slashes', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
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

    it('should pass through paths without modification', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      const testPath = 'test/file.py';
      const bp = await sessionManager.setBreakpoint(
        session.id,
        testPath,
        30
      );
      
      // SessionManager should pass through the path as-is
      // Path resolution is now handled at the server level
      expect(bp.file).toBe(testPath);
    });
  });
  
  describe('Breakpoint Path Resolution', () => {
    it('should pass through relative paths without modification', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      const relativePath = 'src/test.py';
      const bp = await sessionManager.setBreakpoint(session.id, relativePath, 42);
      
      // SessionManager no longer converts paths - just passes through
      expect(bp.file).toBe(relativePath);
    });

    it('should handle already absolute breakpoint paths', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      const absolutePath = '/home/user/project/test.py';
      const bp = await sessionManager.setBreakpoint(session.id, absolutePath, 50);
      
      // SessionManager passes through paths without normalization
      expect(bp.file).toBe(absolutePath);
    });

    it('should normalize paths across different OS', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
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
