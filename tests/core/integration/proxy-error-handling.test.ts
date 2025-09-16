/**
 * Integration tests for proxy error handling
 * Tests the interaction between ProxyManager and ProxyWorker for error scenarios
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import { ProxyConfig } from '../../../src/proxy/proxy-config.js';
import { createTestDependencies } from '../../test-utils/helpers/test-dependencies.js';
import type { IDebugAdapter } from '../../../src/adapters/debug-adapter-interface.js';
import { DebugLanguage } from '../../../src/session/models.js';
import type { Dependencies } from '../../test-utils/helpers/test-dependencies.js';
import type { IProxyProcessLauncher, IProxyProcess } from '../../../src/interfaces/process-interfaces.js';
import path from 'path';
import { fileURLToPath } from 'url';

describe('Proxy Error Handling Integration', () => {
  let dependencies: Dependencies;
  let proxyManager: ProxyManager | null = null;
  let mockAdapter: IDebugAdapter;
  let mockProxyLauncher: IProxyProcessLauncher;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create test dependencies with real implementations where possible
    dependencies = await createTestDependencies();
    
    // Create a minimal mock adapter
    mockAdapter = {
      language: DebugLanguage.PYTHON,
      initialize: vi.fn().mockResolvedValue(undefined),
      validateEnvironment: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
      resolveExecutablePath: vi.fn().mockResolvedValue('/usr/bin/python3'),
      buildAdapterCommand: vi.fn().mockReturnValue({
        command: '/usr/bin/python3',
        args: ['-m', 'debugpy.adapter', '--host', 'localhost', '--port', '5678'],
        env: {}
      }),
      dispose: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockReturnValue('initialized'),
      getDebuggerInfo: vi.fn().mockReturnValue({ version: '1.0.0', capabilities: [] }),
      translateErrorMessage: vi.fn().mockImplementation(err => err.message),
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      removeListener: vi.fn()
    } as unknown as IDebugAdapter;
    
    // Create a mock proxy process launcher that implements IProxyProcessLauncher
    mockProxyLauncher = {
      launchProxy: vi.fn().mockImplementation((scriptPath: string, sessionId: string, env?: NodeJS.ProcessEnv) => {
        // Return a mock proxy process
        type EventHandler = (...args: any[]) => void;
        const eventHandlers: Record<string, EventHandler[]> = {
          exit: [],
          message: [],
          error: []
        };
        
        let processKilled = false;
        const mockProcess = {
          pid: 12345,
          get killed() { return processKilled; },
          kill: vi.fn().mockImplementation(() => {
            processKilled = true;
            return true;
          }),
          sendCommand: vi.fn().mockImplementation((cmd: any) => {
            // Simulate worker behavior - exit on init with non-existent script
            if (cmd.cmd === 'init') {
              // Send error message to all handlers
              const messageHandlers = eventHandlers.message || [];
              for (const handler of messageHandlers) {
                handler({
                  type: 'error',
                  message: `Script path not found: ${cmd.scriptPath}`,
                  sessionId: cmd.sessionId
                });
              }

              // Then exit the process
              setTimeout(() => {
                processKilled = true; // Mark process as killed
                const exitHandlers = eventHandlers.exit || [];
                for (const handler of exitHandlers) {
                  handler(1, null);
                }
              }, 10); // Small delay to simulate async behavior
            }
          }),
          on: vi.fn().mockImplementation((event: string, handler: EventHandler) => {
            if (!eventHandlers[event]) eventHandlers[event] = [];
            eventHandlers[event].push(handler);
          }),
          once: vi.fn().mockImplementation((event: string, handler: EventHandler) => {
            if (!eventHandlers[event]) eventHandlers[event] = [];
            eventHandlers[event].push(handler);
          }),
          removeListener: vi.fn(),
          stderr: {
            on: vi.fn()
          }
        } as unknown as IProxyProcess;

        // Send proxy-ready signal after event handlers are set up
        // We need a slight delay to ensure ProxyManager has set up its handlers
        setTimeout(() => {
          // Send to ALL message handlers, not just the first one
          const messageHandlers = eventHandlers.message || [];
          for (const handler of messageHandlers) {
            handler({ type: 'proxy-ready', pid: 12345 });
          }
        }, 10);

        return mockProcess;
      })
    };
    
    // Create proxy manager with the mock adapter and proxy launcher
    proxyManager = new ProxyManager(
      mockAdapter,
      mockProxyLauncher,
      dependencies.fileSystem,
      dependencies.logger
    );
  });

  afterEach(async () => {
    // Clean up proxy manager if it exists
    if (proxyManager) {
      try {
        await proxyManager.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
      proxyManager = null;
    }

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Script Path Validation', () => {
    it('should fail quickly when script path does not exist', async () => {
      // Mock file system to simulate script not found
      vi.mocked(dependencies.fileSystem.pathExists)
        .mockResolvedValueOnce(true) // proxy bootstrap script exists
        .mockResolvedValueOnce(false); // target script does not exist
      
      const config: ProxyConfig = {
        sessionId: 'test-session-1',
        language: DebugLanguage.PYTHON,
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/test-logs',
        scriptPath: '/nonexistent/script.py',
        scriptArgs: [],
        stopOnEntry: false,
        justMyCode: true,
        initialBreakpoints: [],
        dryRunSpawn: false
      };
      
      // Start time measurement
      const startTime = Date.now();
      
      // Attempt to start proxy - should fail
      await expect(proxyManager.start(config)).rejects.toThrow('Script path not found');
      
      // End time measurement
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      
      // Verify it failed quickly (should be well under 1 second, not 30 seconds)
      expect(elapsedTime).toBeLessThan(1000);
      
      // The main goal of this test is to verify that the error fails quickly,
      // not to test the exact cleanup timing of the proxy manager
    });
    
    it('should fail quickly with meaningful error message', async () => {
      // Mock file system to simulate script not found
      vi.mocked(dependencies.fileSystem.pathExists)
        .mockResolvedValueOnce(true) // proxy bootstrap script exists
        .mockResolvedValueOnce(false); // target script does not exist
      
      const scriptPath = '/home/user/my-script.py';
      const config: ProxyConfig = {
        sessionId: 'test-session-2',
        language: DebugLanguage.PYTHON,
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/test-logs',
        scriptPath,
        scriptArgs: [],
        stopOnEntry: false,
        justMyCode: true,
        initialBreakpoints: [],
        dryRunSpawn: false
      };
      
      // Attempt to start proxy - should fail with specific error
      await expect(proxyManager.start(config))
        .rejects.toThrow(`Script path not found: ${scriptPath}`);
    });
    
    it('should handle relative script paths in container mode', async () => {
      // Temporarily set container environment
      const originalEnv = process.env.MCP_CONTAINER;
      process.env.MCP_CONTAINER = 'true';
      
      try {
        // Mock file system to return false for the container path
        vi.mocked(dependencies.fileSystem.pathExists)
          .mockResolvedValueOnce(true)  // proxy bootstrap script exists
          .mockResolvedValueOnce(false); // script doesn't exist at /workspace/relative/script.py
        
        const config: ProxyConfig = {
          sessionId: 'test-session-3',
          language: DebugLanguage.PYTHON,
          executablePath: '/usr/bin/python3',
          adapterHost: 'localhost',
          adapterPort: 5678,
          logDir: '/tmp/test-logs',
          scriptPath: 'relative/script.py', // Relative path
          scriptArgs: [],
          stopOnEntry: false,
          justMyCode: true,
          initialBreakpoints: [],
          dryRunSpawn: false
        };
        
        // This should fail because the file doesn't exist
        await expect(proxyManager.start(config))
          .rejects.toThrow('Script path not found: relative/script.py');
        
        // Note: The actual path check happens in the worker process (which we're mocking),
        // not in the ProxyManager, so we can't verify the exact path that was checked.
        // The test verifies that the error message is propagated correctly.
      } finally {
        // Restore original environment
        if (originalEnv !== undefined) {
          process.env.MCP_CONTAINER = originalEnv;
        } else {
          delete process.env.MCP_CONTAINER;
        }
      }
    });
  });

  describe('Error Propagation', () => {
    it('should properly propagate errors from worker to manager', async () => {
      // Mock file system to simulate other initialization errors
      vi.mocked(dependencies.fileSystem.pathExists)
        .mockResolvedValueOnce(true) // proxy bootstrap script exists
        .mockResolvedValueOnce(true); // script exists
      
      // We need to recreate the proxy manager with a failing launcher
      const failingProxyLauncher: IProxyProcessLauncher = {
        launchProxy: vi.fn().mockImplementation(() => {
          throw new Error('Failed to spawn proxy process');
        })
      };
      
      proxyManager = new ProxyManager(
        mockAdapter,
        failingProxyLauncher,
        dependencies.fileSystem,
        dependencies.logger
      );
      
      const config: ProxyConfig = {
        sessionId: 'test-session-4',
        language: DebugLanguage.PYTHON,
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/test-logs',
        scriptPath: '/valid/script.py',
        scriptArgs: [],
        stopOnEntry: false,
        justMyCode: true,
        initialBreakpoints: [],
        dryRunSpawn: false
      };
      
      // Should fail with the spawn error
      await expect(proxyManager.start(config))
        .rejects.toThrow('Failed to spawn proxy process');
    });
  });

  describe('Timing Behavior', () => {
    it('should not hang for 30 seconds on initialization errors', async () => {
      // Test various initialization errors to ensure none cause hanging
      const errorScenarios = [
        {
          name: 'script not found',
          setup: () => {
            vi.mocked(dependencies.fileSystem.pathExists)
              .mockResolvedValueOnce(true) // proxy bootstrap exists
              .mockResolvedValueOnce(false); // script doesn't exist
          },
          expectedError: 'Script path not found'
        },
        {
          name: 'proxy bootstrap not found',
          setup: () => {
            vi.mocked(dependencies.fileSystem.pathExists)
              .mockResolvedValue(false); // Nothing exists
          },
          expectedError: 'Bootstrap worker script not found'
        }
      ];
      
      for (const scenario of errorScenarios) {
        vi.clearAllMocks();
        scenario.setup();
        
        // Create a fresh proxy manager for each scenario
        proxyManager = new ProxyManager(
          mockAdapter,
          mockProxyLauncher,
          dependencies.fileSystem,
          dependencies.logger
        );
        
        const config: ProxyConfig = {
          sessionId: `test-timing-${scenario.name}`,
          language: DebugLanguage.PYTHON,
          executablePath: '/usr/bin/python3',
          adapterHost: 'localhost',
          adapterPort: 5678,
          logDir: '/tmp/test-logs',
          scriptPath: '/some/script.py',
          scriptArgs: [],
          stopOnEntry: false,
          justMyCode: true,
          initialBreakpoints: [],
          dryRunSpawn: false
        };
        
        const startTime = Date.now();
        
        await expect(proxyManager.start(config))
          .rejects.toThrow(scenario.expectedError);
        
        const elapsedTime = Date.now() - startTime;
        
        // Should fail in under 2 seconds, not 30
        expect(elapsedTime).toBeLessThan(2000);
      }
    });
  });
});
