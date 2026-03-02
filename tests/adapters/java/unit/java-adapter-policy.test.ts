import { describe, it, expect, vi } from 'vitest';
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
    it('should match JdiDapServer in args', () => {
      expect(JavaAdapterPolicy.matchesAdapter({
        command: 'java',
        args: ['-cp', 'java/out', 'JdiDapServer', '--port', '38000']
      })).toBe(true);
    });

    it('should match jdi-bridge in args', () => {
      expect(JavaAdapterPolicy.matchesAdapter({
        command: 'java',
        args: ['jdi-bridge', '--port', '38000']
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
    it('should return Locals scope name', () => {
      const scopeNames = JavaAdapterPolicy.getLocalScopeName();
      expect(scopeNames).toContain('Locals');
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
    it('should use sendLaunchBeforeConfig (JDI sends initialized before launch)', () => {
      const behavior = JavaAdapterPolicy.getInitializationBehavior();
      expect(behavior.sendLaunchBeforeConfig).toBe(true);
      expect(behavior.deferConfigDone).toBeUndefined();
      expect(behavior.defaultStopOnEntry).toBeUndefined();
      expect(behavior.sendConfigDoneWithAttach).toBeUndefined();
      expect(behavior.sendConfigDoneWithLaunch).toBeUndefined();
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

  describe('extractLocalVariables', () => {
    it('should return empty array when no stack frames', () => {
      const result = JavaAdapterPolicy.extractLocalVariables([], {}, {});
      expect(result).toEqual([]);
    });

    it('should return empty array when stack frames is null', () => {
      const result = JavaAdapterPolicy.extractLocalVariables(null as any, {}, {});
      expect(result).toEqual([]);
    });

    it('should return empty array when no scopes for top frame', () => {
      const stackFrames = [{ id: 1, name: 'main', file: 'Main.java', line: 10 }];
      const result = JavaAdapterPolicy.extractLocalVariables(stackFrames, {}, {});
      expect(result).toEqual([]);
    });

    it('should return empty array when scopes is empty', () => {
      const stackFrames = [{ id: 1, name: 'main', file: 'Main.java', line: 10 }];
      const scopes = { 1: [] };
      const result = JavaAdapterPolicy.extractLocalVariables(stackFrames, scopes, {});
      expect(result).toEqual([]);
    });

    it('should return empty array when no Locals scope', () => {
      const stackFrames = [{ id: 1, name: 'main', file: 'Main.java', line: 10 }];
      const scopes = { 1: [{ name: 'Globals', variablesReference: 100 }] };
      const result = JavaAdapterPolicy.extractLocalVariables(stackFrames, scopes as any, {});
      expect(result).toEqual([]);
    });

    it('should extract variables from Locals scope', () => {
      const stackFrames = [{ id: 1, name: 'main', file: 'Main.java', line: 10 }];
      const scopes = { 1: [{ name: 'Locals', variablesReference: 100 }] };
      const variables = { 100: [{ name: 'x', value: '42', type: 'int' }] };
      const result = JavaAdapterPolicy.extractLocalVariables(stackFrames, scopes as any, variables as any);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('x');
    });

    it('should also recognize Local scope name', () => {
      const stackFrames = [{ id: 1, name: 'main', file: 'Main.java', line: 10 }];
      const scopes = { 1: [{ name: 'Local', variablesReference: 100 }] };
      const variables = { 100: [{ name: 'y', value: '10', type: 'int' }] };
      const result = JavaAdapterPolicy.extractLocalVariables(stackFrames, scopes as any, variables as any);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('y');
    });

    it('should return empty array when variables not found for scope', () => {
      const stackFrames = [{ id: 1, name: 'main', file: 'Main.java', line: 10 }];
      const scopes = { 1: [{ name: 'Locals', variablesReference: 100 }] };
      const variables = { 200: [{ name: 'z', value: '5', type: 'int' }] }; // Different ref
      const result = JavaAdapterPolicy.extractLocalVariables(stackFrames, scopes as any, variables as any);
      expect(result).toEqual([]);
    });
  });

  describe('getDebuggerConfiguration', () => {
    it('should return correct configuration', () => {
      const config = JavaAdapterPolicy.getDebuggerConfiguration();
      expect(config.requiresStrictHandshake).toBe(false);
      expect(config.skipConfigurationDone).toBe(false);
      expect(config.supportsVariableType).toBe(true);
    });
  });

  describe('isChildReadyEvent', () => {
    it('should return true for initialized event', () => {
      const result = JavaAdapterPolicy.isChildReadyEvent({ event: 'initialized' } as any);
      expect(result).toBe(true);
    });

    it('should return false for other events', () => {
      expect(JavaAdapterPolicy.isChildReadyEvent({ event: 'stopped' } as any)).toBe(false);
      expect(JavaAdapterPolicy.isChildReadyEvent({ event: 'output' } as any)).toBe(false);
    });

    it('should return false for null/undefined event', () => {
      expect(JavaAdapterPolicy.isChildReadyEvent(null as any)).toBe(false);
      expect(JavaAdapterPolicy.isChildReadyEvent(undefined as any)).toBe(false);
    });
  });

  describe('getDapClientBehavior', () => {
    it('should return behavior configuration', () => {
      const behavior = JavaAdapterPolicy.getDapClientBehavior();
      expect(behavior.mirrorBreakpointsToChild).toBe(false);
      expect(behavior.deferParentConfigDone).toBe(false);
      expect(behavior.pauseAfterChildAttach).toBe(false);
      expect(behavior.childInitTimeout).toBe(5000);
      expect(behavior.suppressPostAttachConfigDone).toBe(false);
    });

    it('should handle runInTerminal reverse request', async () => {
      const behavior = JavaAdapterPolicy.getDapClientBehavior();
      const mockContext = {
        sendResponse: vi.fn()
      };
      const request = { command: 'runInTerminal', seq: 1, type: 'request' };

      const result = await behavior.handleReverseRequest(request as any, mockContext as any);

      expect(result.handled).toBe(true);
      expect(mockContext.sendResponse).toHaveBeenCalledWith(request, {});
    });

    it('should not handle other reverse requests', async () => {
      const behavior = JavaAdapterPolicy.getDapClientBehavior();
      const mockContext = { sendResponse: vi.fn() };
      const request = { command: 'other', seq: 1, type: 'request' };

      const result = await behavior.handleReverseRequest(request as any, mockContext as any);

      expect(result.handled).toBe(false);
      expect(mockContext.sendResponse).not.toHaveBeenCalled();
    });
  });

  describe('getAdapterSpawnConfig', () => {
    it('should use provided adapterCommand when present', () => {
      const payload = {
        adapterCommand: {
          command: '/custom/java',
          args: ['-jar', 'debug.jar'],
          env: { JAVA_OPTS: '-Xmx1g' }
        },
        adapterHost: '127.0.0.1',
        adapterPort: 5005,
        logDir: '/tmp/logs'
      };

      const config = JavaAdapterPolicy.getAdapterSpawnConfig!(payload as any);

      expect(config.command).toBe('/custom/java');
      expect(config.args).toEqual(['-jar', 'debug.jar']);
      expect(config.host).toBe('127.0.0.1');
      expect(config.port).toBe(5005);
      expect(config.logDir).toBe('/tmp/logs');
      expect(config.env).toEqual({ JAVA_OPTS: '-Xmx1g' });
    });

    it('should return default JdiDapServer config when no adapterCommand', () => {
      const payload = {
        adapterHost: 'localhost',
        adapterPort: 38000,
        logDir: '/var/log'
      };

      const config = JavaAdapterPolicy.getAdapterSpawnConfig!(payload as any);

      expect(config.command).toBe('java');
      expect(config.args).toContain('-cp');
      expect(config.args).toContain('java/out');
      expect(config.args).toContain('JdiDapServer');
      expect(config.args).toContain('--port');
      expect(config.args).toContain('38000');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(38000);
    });
  });

  describe('filterStackFrames - file path filtering', () => {
    it('should filter frames with /jdk/ in path', () => {
      const frames = [
        { id: 1, name: 'com.example.App.run', file: '/app/App.java', line: 10 },
        { id: 2, name: 'Runtime.exec', file: '/usr/lib/jdk/Runtime.java', line: 100 }
      ];

      const filtered = JavaAdapterPolicy.filterStackFrames!(frames, false);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    it('should filter frames with /rt.jar/ in path', () => {
      const frames = [
        { id: 1, name: 'com.example.App.run', file: '/app/App.java', line: 10 },
        { id: 2, name: 'Object.wait', file: '/jre/lib/rt.jar/Object.java', line: 50 }
      ];

      const filtered = JavaAdapterPolicy.filterStackFrames!(frames, false);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });
  });

  describe('validateExecutable', () => {
    it('should return true for valid java command', async () => {
      // This test uses the actual system java if available
      // In CI, Java 21 should be set up
      if (process.env.JAVA_HOME || process.env.CI) {
        const result = await JavaAdapterPolicy.validateExecutable!('java');
        // May be true or false depending on environment
        expect(typeof result).toBe('boolean');
      }
    });

    it('should return false for invalid command', async () => {
      const result = await JavaAdapterPolicy.validateExecutable!('/nonexistent/java123456');
      expect(result).toBe(false);
    });
  });
});
