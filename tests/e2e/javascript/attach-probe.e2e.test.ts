/**
 * E2E test for JavaScript debugging with attach flow and child session adoption
 * Mirrors the working probe behavior to ensure proper breakpoint stopping and debugging
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { fileURLToPath } from 'url';
import { SessionManager, SessionManagerConfig } from '../../../src/session/session-manager.js';
import { createLogger } from '../../../src/utils/logger.js';
import { DebugProtocol } from '@vscode/debugprotocol';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../../');
const FIXTURES = path.join(ROOT, 'tests/fixtures/javascript-e2e');
const LOG_DIR = path.join(ROOT, 'logs', 'test-e2e-attach');

describe('JavaScript Attach Probe E2E', () => {
  let sessionManager: SessionManager;
  let logger: any;
  let targetProcess: ChildProcess | null = null;
  let inspectorPort: number;

  beforeAll(async () => {
    // Ensure log directory exists
    await fs.promises.mkdir(LOG_DIR, { recursive: true });
    
    // Create logger with proper options
    logger = await createLogger('test-attach-probe', { 
      level: 'debug',
      file: path.join(LOG_DIR, 'test-attach-probe.log')
    });
    sessionManager = new SessionManager();
    // Initialize with config
    const config: SessionManagerConfig = {
      logDir: LOG_DIR
    };
    await sessionManager.initialize(config);
  });

  afterAll(async () => {
    await sessionManager.shutdown();
  });

  afterEach(async () => {
    // Clean up any target process
    if (targetProcess && !targetProcess.killed) {
      targetProcess.kill('SIGKILL');
      targetProcess = null;
    }
  });

  async function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.once('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        srv.close(() => resolve(port));
      });
    });
  }

  async function spawnTargetWithInspector(scriptPath: string): Promise<{ process: ChildProcess; port: number }> {
    const port = await findFreePort();
    const args = [`--inspect-brk=${port}`, scriptPath];
    
    const child = spawn(process.execPath, args, {
      cwd: path.dirname(scriptPath),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      windowsHide: true
    });

    // Capture output for debugging
    child.stdout?.on('data', (data) => {
      logger.debug(`[target stdout] ${data}`);
    });
    child.stderr?.on('data', (data) => {
      logger.debug(`[target stderr] ${data}`);
    });

    // Wait briefly for inspector to start
    await new Promise(resolve => setTimeout(resolve, 500));

    return { process: child, port };
  }

  it('should stop at breakpoint via attach flow with child session adoption', async () => {
    const scriptPath = path.join(FIXTURES, 'simple.js');
    
    // 1. Spawn target with inspector
    const { process: target, port } = await spawnTargetWithInspector(scriptPath);
    targetProcess = target;
    inspectorPort = port;
    logger.info(`Target spawned with inspector on port ${inspectorPort}`);

    // 2. Create debug session with JavaScript adapter
    const session = await sessionManager.createSession({
      language: 'javascript',
      name: 'test-attach-probe'
    });
    
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();

    // 3. Set breakpoint before starting
    const breakpointLine = 8; // Line with console.log in simple.js
    const setBreakpointsResp = await session.setBreakpoint({
      file: scriptPath,
      line: breakpointLine
    });
    
    expect(setBreakpointsResp.success).toBe(true);
    if (setBreakpointsResp.success && setBreakpointsResp.body) {
      const bps = setBreakpointsResp.body.breakpoints;
      expect(bps).toBeDefined();
      expect(bps.length).toBeGreaterThan(0);
      // Breakpoint should be verified after attach
    }

    // 4. Start debugging with attach to inspector port
    let stoppedEventReceived = false;
    let stoppedReason: string | undefined;
    let threadId: number | undefined;

    // Set up event listener for stopped event
    const stoppedPromise = new Promise<void>((resolve) => {
      const checkStopped = () => {
        const events = session.getEvents?.() || [];
        const stopped = events.find((e: any) => e.event === 'stopped');
        if (stopped) {
          stoppedEventReceived = true;
          stoppedReason = stopped.body?.reason;
          threadId = stopped.body?.threadId;
          logger.info(`Stopped event received: reason=${stoppedReason}, threadId=${threadId}`);
          resolve();
        }
      };

      // Poll for events
      const interval = setInterval(checkStopped, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 30000);
    });

    // Start debugging with explicit attach arguments
    const startResp = await session.startDebugging({
      scriptPath,
      args: [],
      dapLaunchArgs: {
        type: 'pwa-node',
        request: 'attach',
        address: '127.0.0.1',
        port: inspectorPort,
        continueOnAttach: false,
        attachExistingChildren: true,
        attachSimplePort: inspectorPort,
        stopOnEntry: false
      }
    });

    expect(startResp.success).toBe(true);

    // Wait for stopped event or timeout
    await stoppedPromise;

    // If no stopped event, try pause fallback
    if (!stoppedEventReceived) {
      logger.info('No stopped event received, attempting pause fallback');
      
      // Get threads
      const threadsResp = await session.customRequest('threads', {});
      if (threadsResp.success && threadsResp.body?.threads?.length > 0) {
        const firstThread = threadsResp.body.threads[0];
        threadId = firstThread.id;
        
        // Pause the thread
        const pauseResp = await session.customRequest('pause', { threadId });
        if (pauseResp.success) {
          // Wait briefly for stopped event after pause
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check for stopped event again
          const events = session.getEvents?.() || [];
          const stopped = events.find((e: any) => e.event === 'stopped');
          if (stopped) {
            stoppedEventReceived = true;
            stoppedReason = stopped.body?.reason;
            threadId = stopped.body?.threadId;
          }
        }
      }
    }

    // Verify we stopped
    expect(stoppedEventReceived).toBe(true);
    expect(threadId).toBeDefined();

    // 5. Get stack trace to verify we're at the breakpoint
    if (threadId !== undefined) {
      const stackResp = await session.customRequest('stackTrace', {
        threadId,
        startFrame: 0,
        levels: 20
      });

      expect(stackResp.success).toBe(true);
      if (stackResp.success && stackResp.body) {
        const frames = stackResp.body.stackFrames;
        expect(frames).toBeDefined();
        expect(frames.length).toBeGreaterThan(0);
        
        const topFrame = frames[0];
        logger.info(`Top frame: ${topFrame.source?.path}:${topFrame.line}`);
        
        // Should be near our breakpoint line
        expect(Math.abs(topFrame.line - breakpointLine)).toBeLessThanOrEqual(1);
      }
    }

    // 6. Test evaluate expression
    if (threadId !== undefined) {
      const stackResp = await session.customRequest('stackTrace', {
        threadId,
        startFrame: 0,
        levels: 1
      });

      if (stackResp.success && stackResp.body?.stackFrames?.length > 0) {
        const frameId = stackResp.body.stackFrames[0].id;
        
        const evalResp = await session.evaluate({
          expression: '1 + 1',
          frameId
        });

        expect(evalResp.success).toBe(true);
        if (evalResp.success && evalResp.body) {
          const result = evalResp.body.result;
          logger.info(`Evaluate '1 + 1' = '${result}'`);
          expect(result).toContain('2');
        }
      }
    }

    // 7. Test variables
    if (threadId !== undefined) {
      const stackResp = await session.customRequest('stackTrace', {
        threadId,
        startFrame: 0,
        levels: 1
      });

      if (stackResp.success && stackResp.body?.stackFrames?.length > 0) {
        const frameId = stackResp.body.stackFrames[0].id;
        
        const scopesResp = await session.customRequest('scopes', { frameId });
        
        expect(scopesResp.success).toBe(true);
        if (scopesResp.success && scopesResp.body?.scopes?.length > 0) {
          const scope = scopesResp.body.scopes[0];
          
          const varsResp = await session.getVariables(scope.variablesReference);
          
          expect(varsResp.success).toBe(true);
          if (varsResp.success && varsResp.body) {
            const vars = varsResp.body.variables;
            expect(vars).toBeDefined();
            expect(vars.length).toBeGreaterThan(0);
            logger.info(`Found ${vars.length} variables in scope`);
          }
        }
      }
    }

    // 8. Continue execution to completion
    if (threadId !== undefined) {
      const continueResp = await session.continue(threadId);
      expect(continueResp.success).toBe(true);
      
      // Wait for process to exit
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 9. Close session
    await session.close();
  }, 60000); // 60 second timeout for the test

  it('should handle step operations after breakpoint', async () => {
    const scriptPath = path.join(FIXTURES, 'simple.js');
    
    // Spawn target with inspector
    const { process: target, port } = await spawnTargetWithInspector(scriptPath);
    targetProcess = target;
    inspectorPort = port;

    // Create session and set breakpoint
    const session = await sessionManager.createSession({
      language: 'javascript',
      name: 'test-step-operations'
    });

    const breakpointLine = 3; // Early line in simple.js
    await session.setBreakpoint({
      file: scriptPath,
      line: breakpointLine
    });

    // Start debugging with attach
    await session.startDebugging({
      scriptPath,
      args: [],
      dapLaunchArgs: {
        type: 'pwa-node',
        request: 'attach',
        address: '127.0.0.1',
        port: inspectorPort,
        continueOnAttach: false,
        attachExistingChildren: true,
        attachSimplePort: inspectorPort
      }
    });

    // Wait for stopped event
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get thread ID
    const threadsResp = await session.customRequest('threads', {});
    const threadId = threadsResp.body?.threads?.[0]?.id;
    
    if (threadId !== undefined) {
      // Test step over
      const stepResp = await session.stepOver(threadId);
      expect(stepResp.success).toBe(true);
      
      // Wait briefly for new stopped event
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify we moved to a different line
      const stackResp = await session.customRequest('stackTrace', {
        threadId,
        startFrame: 0,
        levels: 1
      });
      
      if (stackResp.success && stackResp.body?.stackFrames?.length > 0) {
        const newLine = stackResp.body.stackFrames[0].line;
        logger.info(`After step over, now at line ${newLine}`);
        expect(newLine).toBeGreaterThan(breakpointLine);
      }
      
      // Continue to completion
      await session.continue(threadId);
    }

    await session.close();
  }, 60000);
});
