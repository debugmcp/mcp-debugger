import { describe, it, expect } from 'vitest';
import { JavaAdapterPolicy } from '@debugmcp/shared';
import { SessionState } from '@debugmcp/shared';

describe('JavaAdapterPolicy', () => {
  describe('basic properties', () => {
    it('should have name "java"', () => {
      expect(JavaAdapterPolicy.name).toBe('java');
    });

    it('should not support reverse start debugging', () => {
      expect(JavaAdapterPolicy.supportsReverseStartDebugging).toBe(false);
    });

    it('should have "none" child session strategy', () => {
      expect(JavaAdapterPolicy.childSessionStrategy).toBe('none');
    });
  });

  describe('matchesAdapter', () => {
    it('should match kotlin-debug-adapter in command', () => {
      expect(JavaAdapterPolicy.matchesAdapter({
        command: '/path/to/kotlin-debug-adapter',
        args: []
      })).toBe(true);
    });

    it('should match kda in command', () => {
      expect(JavaAdapterPolicy.matchesAdapter({
        command: '/path/to/kda',
        args: []
      })).toBe(true);
    });

    it('should match stdio-tcp-bridge in command', () => {
      expect(JavaAdapterPolicy.matchesAdapter({
        command: 'node',
        args: ['stdio-tcp-bridge.js', '--command', '/path/to/kotlin-debug-adapter']
      })).toBe(true);
    });

    it('should match java-debug in args', () => {
      expect(JavaAdapterPolicy.matchesAdapter({
        command: 'node',
        args: ['bridge.js', '--adapter', 'java-debug']
      })).toBe(true);
    });

    it('should not match unrelated commands', () => {
      expect(JavaAdapterPolicy.matchesAdapter({
        command: 'dlv',
        args: ['dap', '--listen=:38000']
      })).toBe(false);
    });

    it('should not match python debugger', () => {
      expect(JavaAdapterPolicy.matchesAdapter({
        command: 'python',
        args: ['-m', 'debugpy']
      })).toBe(false);
    });
  });

  describe('getLocalScopeName', () => {
    it('should return Java scope names', () => {
      const scopeNames = JavaAdapterPolicy.getLocalScopeName();
      expect(scopeNames).toContain('Local Variables');
      expect(scopeNames).toContain('Local');
    });
  });

  describe('getDapAdapterConfiguration', () => {
    it('should return java type', () => {
      const config = JavaAdapterPolicy.getDapAdapterConfiguration();
      expect(config.type).toBe('java');
    });
  });

  describe('resolveExecutablePath', () => {
    it('should return provided path when given', () => {
      const result = JavaAdapterPolicy.resolveExecutablePath('/custom/java');
      expect(result).toBe('/custom/java');
    });

    it('should use JAVA_HOME when set', () => {
      const originalJavaHome = process.env.JAVA_HOME;
      process.env.JAVA_HOME = '/test/jdk';

      try {
        const result = JavaAdapterPolicy.resolveExecutablePath();
        expect(result).toContain('/test/jdk');
        expect(result).toContain('bin');
        expect(result).toContain('java');
      } finally {
        if (originalJavaHome) {
          process.env.JAVA_HOME = originalJavaHome;
        } else {
          delete process.env.JAVA_HOME;
        }
      }
    });

    it('should default to "java" when nothing else is set', () => {
      const originalJavaHome = process.env.JAVA_HOME;
      delete process.env.JAVA_HOME;

      try {
        const result = JavaAdapterPolicy.resolveExecutablePath();
        expect(result).toBe('java');
      } finally {
        if (originalJavaHome) process.env.JAVA_HOME = originalJavaHome;
      }
    });
  });

  describe('state management', () => {
    it('should create initial state', () => {
      const state = JavaAdapterPolicy.createInitialState();
      expect(state.initialized).toBe(false);
      expect(state.configurationDone).toBe(false);
    });

    it('should track initialized event', () => {
      const state = JavaAdapterPolicy.createInitialState();
      JavaAdapterPolicy.updateStateOnEvent('initialized', {}, state);
      expect(state.initialized).toBe(true);
      expect(JavaAdapterPolicy.isInitialized(state)).toBe(true);
    });

    it('should track configurationDone command', () => {
      const state = JavaAdapterPolicy.createInitialState();
      JavaAdapterPolicy.updateStateOnCommand('configurationDone', undefined, state);
      expect(state.configurationDone).toBe(true);
    });

    it('should report connected when initialized', () => {
      const state = JavaAdapterPolicy.createInitialState();
      expect(JavaAdapterPolicy.isConnected(state)).toBe(false);

      JavaAdapterPolicy.updateStateOnEvent('initialized', {}, state);
      expect(JavaAdapterPolicy.isConnected(state)).toBe(true);
    });
  });

  describe('isSessionReady', () => {
    it('should be ready when PAUSED', () => {
      expect(JavaAdapterPolicy.isSessionReady(SessionState.PAUSED)).toBe(true);
    });

    it('should not be ready when RUNNING', () => {
      expect(JavaAdapterPolicy.isSessionReady(SessionState.RUNNING)).toBe(false);
    });

    it('should not be ready when CREATED', () => {
      expect(JavaAdapterPolicy.isSessionReady(SessionState.CREATED)).toBe(false);
    });
  });

  describe('command queueing', () => {
    it('should not require command queueing', () => {
      expect(JavaAdapterPolicy.requiresCommandQueueing()).toBe(false);
    });

    it('should not queue commands', () => {
      const result = JavaAdapterPolicy.shouldQueueCommand();
      expect(result.shouldQueue).toBe(false);
      expect(result.shouldDefer).toBe(false);
    });
  });

  describe('filterStackFrames', () => {
    it('should filter JDK internal frames', () => {
      const frames = [
        { id: 1, name: 'com.example.Main.main', file: '/app/Main.java', line: 10 },
        { id: 2, name: 'java.lang.Thread.run', file: '', line: 0 },
        { id: 3, name: 'sun.misc.Launcher.main', file: '', line: 0 },
      ];

      const filtered = JavaAdapterPolicy.filterStackFrames!(frames, false);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('com.example.Main.main');
    });

    it('should include all frames when includeInternals is true', () => {
      const frames = [
        { id: 1, name: 'com.example.Main.main', file: '/app/Main.java', line: 10 },
        { id: 2, name: 'java.lang.Thread.run', file: '', line: 0 },
      ];

      const filtered = JavaAdapterPolicy.filterStackFrames!(frames, true);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('isInternalFrame', () => {
    it('should identify java.* frames as internal', () => {
      expect(JavaAdapterPolicy.isInternalFrame!({ id: 1, name: 'java.lang.Thread.run', file: '', line: 0 })).toBe(true);
    });

    it('should identify javax.* frames as internal', () => {
      expect(JavaAdapterPolicy.isInternalFrame!({ id: 1, name: 'javax.swing.JFrame.init', file: '', line: 0 })).toBe(true);
    });

    it('should identify sun.* frames as internal', () => {
      expect(JavaAdapterPolicy.isInternalFrame!({ id: 1, name: 'sun.misc.Launcher', file: '', line: 0 })).toBe(true);
    });

    it('should not identify user frames as internal', () => {
      expect(JavaAdapterPolicy.isInternalFrame!({ id: 1, name: 'com.example.Main.main', file: '/app/Main.java', line: 10 })).toBe(false);
    });
  });

  describe('getInitializationBehavior', () => {
    it('should not defer configDone', () => {
      const behavior = JavaAdapterPolicy.getInitializationBehavior();
      expect(behavior.deferConfigDone).toBe(false);
    });

    it('should default to stopOnEntry true', () => {
      const behavior = JavaAdapterPolicy.getInitializationBehavior();
      expect(behavior.defaultStopOnEntry).toBe(true);
    });
  });

  describe('buildChildStartArgs', () => {
    it('should throw since child sessions are not supported', () => {
      expect(() => JavaAdapterPolicy.buildChildStartArgs({} as any, {} as any)).toThrow();
    });
  });

  describe('shouldDeferParentConfigDone', () => {
    it('should return false', () => {
      expect(JavaAdapterPolicy.shouldDeferParentConfigDone()).toBe(false);
    });
  });
});
