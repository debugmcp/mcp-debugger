import { DebugMcpServer } from '../../../src/server.js';
import { createLogger } from '../../../src/utils/logger.js';
import { DebugSessionInfo, DebugLanguage, Breakpoint, Variable, StackFrame } from '../../../src/session/models.js';
import { DebugProtocol } from '@vscode/debugprotocol';

// Create a logger for the test helpers
const logger = createLogger('debug-mcp:test-helpers');

// Lazy-initialized singleton DebugMcpServer for all tests using these helpers
// This ensures a consistent server instance and avoids re-initializing it for every test
let debugServer: DebugMcpServer | null = null;

function getDebugServer(): DebugMcpServer {
  if (!debugServer) {
    debugServer = new DebugMcpServer({
      logLevel: 'debug', // Set a detailed log level for tests
      logFile: 'integration_test_server_real_discovery.log' // Direct logs to the specific file
    });
  }
  return debugServer;
}

// Helper to clean up the server (for test teardown)
export async function cleanupTestServer(): Promise<void> {
  if (debugServer) {
    logger.info(`[Test Helper] Cleaning up shared test server`);
    try {
      // Stop the server which will close all active sessions
      await debugServer.stop();
    } catch (error) {
      logger.error(`[Test Helper] Error during server cleanup:`, error);
    } finally {
      debugServer = null;
    }
  }
}

// Helper to create a debug session
export async function createDebugSession(params: { language: DebugLanguage; name?: string; pythonPath?: string; }): Promise<DebugSessionInfo> {
  logger.info(`[Test Helper] Calling createDebugSession with language: ${params.language}, name: ${params.name || 'unnamed'}, pythonPath: ${params.pythonPath || 'none'}`);
  return getDebugServer().createDebugSession(params);
}

// Helper to start debugging
export async function startDebugging(
  sessionId: string, 
  scriptPath: string, 
  args?: string[], 
  dapLaunchArgs?: Partial<DebugProtocol.LaunchRequestArguments>, 
  dryRunSpawn?: boolean
): Promise<{ success: boolean; state: string; error?: string; data?: unknown; }> {
  logger.info(`[Test Helper] Calling startDebugging for session: ${sessionId}, script: ${scriptPath}, dryRun: ${dryRunSpawn}`);
  return getDebugServer().startDebugging(sessionId, scriptPath, args, dapLaunchArgs, dryRunSpawn);
}

// Helper to close a debug session
export async function closeDebugSession(sessionId: string): Promise<boolean> {
  logger.info(`[Test Helper] Calling closeDebugSession for session: ${sessionId}`);
  return getDebugServer().closeDebugSession(sessionId);
}

// Helper to set a breakpoint
export async function setBreakpoint(sessionId: string, file: string, line: number, condition?: string): Promise<Breakpoint> {
  logger.info(`[Test Helper] Calling setBreakpoint for session: ${sessionId}, file: ${file}, line: ${line}`);
  return getDebugServer().setBreakpoint(sessionId, file, line, condition);
}

// Helper to get variables
export async function getVariables(sessionId: string, scope: number): Promise<Variable[]> {
  logger.info(`[Test Helper] Calling getVariables for session: ${sessionId}, scope: ${scope}`);
  return getDebugServer().getVariables(sessionId, scope);
}

// Helper to get stack trace
export async function getStackTrace(sessionId: string): Promise<StackFrame[]> {
  logger.info(`[Test Helper] Calling getStackTrace for session: ${sessionId}`);
  return getDebugServer().getStackTrace(sessionId);
}

// Helper to get scopes
export async function getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]> {
  logger.info(`[Test Helper] Calling getScopes for session: ${sessionId}, frameId: ${frameId}`);
  return getDebugServer().getScopes(sessionId, frameId);
}

// Helper to continue execution
export async function continueExecution(sessionId: string): Promise<boolean> {
  logger.info(`[Test Helper] Calling continueExecution for session: ${sessionId}`);
  return getDebugServer().continueExecution(sessionId);
}

// Helper to step over
export async function stepOver(sessionId: string): Promise<boolean> {
  logger.info(`[Test Helper] Calling stepOver for session: ${sessionId}`);
  return getDebugServer().stepOver(sessionId);
}

// Helper to step into
export async function stepInto(sessionId: string): Promise<boolean> {
  logger.info(`[Test Helper] Calling stepInto for session: ${sessionId}`);
  return getDebugServer().stepInto(sessionId);
}

// Helper to step out
export async function stepOut(sessionId: string): Promise<boolean> {
  logger.info(`[Test Helper] Calling stepOut for session: ${sessionId}`);
  return getDebugServer().stepOut(sessionId);
}

// Export the server getter for direct access if needed (e.g., for `beforeAll`/`afterAll` hooks)
export { getDebugServer };
