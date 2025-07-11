/**
 * @jest-environment node
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  parseSdkToolResult,
  executeDebugSequence,
  isDockerAvailable,
  ensureDockerImage,
  getVolumeMount,
  generateContainerName,
  cleanupDocker,
  getContainerLogs
} from './smoke-test-utils.js';
import { ensureDir, writeFile, remove } from 'fs-extra';

const TEST_TIMEOUT = 120000; // 120 seconds for container tests (increased to allow for Docker operations)
const DOCKER_IMAGE = 'mcp-debugger:local';

let mcpSdkClient: Client | null = null;
let activeContainerName: string | null = null;
const projectRoot = process.cwd();

// Project testing philosophy: Tests should fail loudly when dependencies are unavailable
// rather than being silently skipped. This ensures we're aware of missing requirements.
describe('MCP Server E2E Container Smoke Test', () => {
  beforeAll(async () => {
    // Docker availability will be checked in each test
    // This allows us to provide specific error messages per test
    console.log(`[Container Smoke Test] Starting test suite at ${new Date().toISOString()}`);
  });

  // Ensure cleanup even if test fails
  afterEach(async function() {
    console.log(`[Container Smoke Test] Cleaning up at ${new Date().toISOString()}...`);
    
    // Close MCP client
    if (mcpSdkClient) {
      try {
        await mcpSdkClient.close();
        console.log('[Container Smoke Test] MCP client closed');
      } catch (e) {
        console.error('[Container Smoke Test] Error closing MCP client:', e);
      }
      mcpSdkClient = null;
    }
    
    // Clean up any Docker containers
    if (activeContainerName) {
      try {
        await cleanupDocker(activeContainerName);
        console.log(`[Container Smoke Test] Cleaned up container: ${activeContainerName}`);
      } catch (e) {
        console.error(`[Container Smoke Test] Error cleaning up container ${activeContainerName}:`, e);
      }
      activeContainerName = null;
    }
  }, 30000); // 30 second timeout for cleanup

  it('should successfully debug fibonacci.py in containerized server', async function() {
    console.log(`\n[Container Smoke Test] TEST START: fibonacci.py test at ${new Date().toISOString()}`);
    
    // Check Docker availability first
    const dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      throw new Error('Docker is required for this test but is not available. Please install Docker and ensure it is running.');
    }

    let debugSessionId: string | undefined;
    const startTime = Date.now();
    
    try {
      // 1. Build Docker image if needed
      console.log(`[${Date.now() - startTime}ms] Building Docker image...`);
      await ensureDockerImage(DOCKER_IMAGE);
      console.log(`[${Date.now() - startTime}ms] Docker image ready`);
      
      // 2. Create MCP client and connect using stdio transport with docker run
      console.log(`[${Date.now() - startTime}ms] Creating MCP client with Docker transport...`);
      mcpSdkClient = new Client({ 
        name: "e2e-container-smoke-test-client", 
        version: "0.1.0" 
      });
      
      // Generate unique container name
      activeContainerName = generateContainerName('mcp-fibonacci-test');
      console.log(`[${Date.now() - startTime}ms] Using container name: ${activeContainerName}`);
      
      // Mount examples directory
      const examplesMount = getVolumeMount(
        path.join(projectRoot, 'examples'),
        '/workspace/examples'
      );
      console.log(`[${Date.now() - startTime}ms] Volume mount: ${examplesMount}`);
      
      // Use docker run directly in StdioClientTransport
      const transport = new StdioClientTransport({
        command: 'docker',
        args: [
          'run', '--rm', '-i',
          '--name', activeContainerName,
          '-v', examplesMount,
          '-e', 'MCP_CONTAINER=true',
          '-e', `MCP_HOST_WORKSPACE=${projectRoot}`,
          DOCKER_IMAGE,
          'stdio'
        ]
      });
      
      console.log(`[${Date.now() - startTime}ms] Connecting to containerized MCP server...`);
      await mcpSdkClient.connect(transport);
      console.log(`[${Date.now() - startTime}ms] MCP SDK Client connected via stdio to container.`);

      // 3. Execute debug sequence with relative path (container mode)
      console.log(`[${Date.now() - startTime}ms] Starting debug sequence...`);
      const relativeFibonacciPath = 'examples/python/fibonacci.py';
      const result = await executeDebugSequence(
        mcpSdkClient,
        relativeFibonacciPath,
        'E2E Container Smoke Test Session'
      );
      
      expect(result.success).toBe(true);
      debugSessionId = result.sessionId;
      console.log(`[${Date.now() - startTime}ms] Debug sequence completed successfully.`);
      
    } catch (error) {
      console.error(`[${Date.now() - startTime}ms] Unexpected error during test execution:`, error);
      
      // Capture container logs for debugging
      if (activeContainerName) {
        try {
          const logs = await getContainerLogs(activeContainerName);
          console.error(`[Container Smoke Test] Container logs:\n${logs}`);
        } catch (logError) {
          console.error('[Container Smoke Test] Could not retrieve container logs:', logError);
        }
      }
      
      // Check if it's a docker issue
      if (error instanceof Error && error.message.includes('docker')) {
        console.error('[Container Smoke Test] Docker container failed to start:', error);
      }
      
      throw error;
    } finally {
      // 4. Cleanup
      if (debugSessionId && mcpSdkClient) {
        try {
          await mcpSdkClient.callTool({ 
            name: 'close_debug_session', 
            arguments: { sessionId: debugSessionId } 
          });
          console.log(`[Container Smoke Test] Debug session ${debugSessionId} closed.`);
        } catch (e) {
          console.error(`[Container Smoke Test] Error closing debug session ${debugSessionId}:`, e);
        }
      }
    }
  }, { timeout: TEST_TIMEOUT });

  // Test that absolute paths are rejected in container mode
  it('should reject absolute paths in container mode', async function() {
    console.log(`\n[Container Smoke Test] TEST START: absolute path rejection test at ${new Date().toISOString()}`);
    
    // Check Docker availability first
    const dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      throw new Error('Docker is required for this test but is not available. Please install Docker and ensure it is running.');
    }

    const tempTestDir = path.join(os.tmpdir(), 'mcp-container-test-' + Date.now());
    let debugSessionId: string | undefined;
    const startTime = Date.now();
    
    try {
      // 1. Create a temporary test directory with a Python script
      console.log(`[${Date.now() - startTime}ms] Creating temp test directory: ${tempTestDir}`);
      await ensureDir(tempTestDir);
      
      const testScript = `
import time
print("Container path test script")
x = 42  # Line 3 - breakpoint here
print(f"x = {x}")
`;
      
      const testScriptPath = path.join(tempTestDir, 'test_container.py');
      await writeFile(testScriptPath, testScript.trim());
      
      // 2. Create MCP client with temp directory mounted
      console.log(`[${Date.now() - startTime}ms] Creating MCP client with temp directory mount...`);
      mcpSdkClient = new Client({ 
        name: "e2e-container-path-test-client", 
        version: "0.1.0" 
      });
      
      // Generate unique container name
      activeContainerName = generateContainerName('mcp-path-test');
      console.log(`[${Date.now() - startTime}ms] Using container name: ${activeContainerName}`);
      
      // Mount temp directory at /workspace (not /workspace/temp-test)
      const tempMount = getVolumeMount(tempTestDir, '/workspace');
      console.log(`[${Date.now() - startTime}ms] Volume mount: ${tempMount}`);
      
      // Use docker run directly in StdioClientTransport
      const transport = new StdioClientTransport({
        command: 'docker',
        args: [
          'run', '--rm', '-i',
          '--name', activeContainerName,
          '-v', tempMount,
          '-e', 'MCP_CONTAINER=true',
          '-e', `MCP_HOST_WORKSPACE=${tempTestDir}`,
          DOCKER_IMAGE,
          'stdio'
        ]
      });
      
      console.log(`[${Date.now() - startTime}ms] Connecting to containerized MCP server...`);
      await mcpSdkClient.connect(transport);
      console.log(`[${Date.now() - startTime}ms] Connected to container.`);
      
      // 3. Create debug session
      console.log(`[${Date.now() - startTime}ms] Creating debug session...`);
      const createCall = await mcpSdkClient.callTool({
        name: 'create_debug_session',
        arguments: { language: 'python', name: 'Container Path Test Session' }
      });
      const createResponse = parseSdkToolResult(createCall);
      expect(createResponse.sessionId).toBeDefined();
      debugSessionId = createResponse.sessionId;
      
      // 4. Set breakpoint using absolute host path (should be rejected)
      console.log(`[${Date.now() - startTime}ms] Setting breakpoint with absolute host path (expecting rejection)...`);
      try {
        const breakpointCall = await mcpSdkClient.callTool({
          name: 'set_breakpoint',
          arguments: { 
            sessionId: debugSessionId, 
            file: testScriptPath,  // Absolute host path
            line: 3 
          }
        });
        const breakpointResponse = parseSdkToolResult(breakpointCall);
        
        // If we get here without an error, the test should fail
        expect(breakpointResponse.success).toBe(false);
        expect(breakpointResponse.error).toContain('Absolute paths are not supported in container mode');
        console.log('[Container Smoke Test] Absolute path correctly rejected with error:', breakpointResponse.error);
      } catch (error) {
        // This is expected - absolute paths should cause an error
        console.log('[Container Smoke Test] Absolute path rejected as expected:', error);
        expect(error).toBeDefined();
      }
      
      // 5. Now test with a relative path (should work)
      console.log(`[${Date.now() - startTime}ms] Setting breakpoint with relative path...`);
      const relativeBreakpointCall = await mcpSdkClient.callTool({
        name: 'set_breakpoint',
        arguments: { 
          sessionId: debugSessionId, 
          file: 'test_container.py',  // Relative path
          line: 3 
        }
      });
      const relativeBreakpointResponse = parseSdkToolResult(relativeBreakpointCall);
      expect(relativeBreakpointResponse.success).toBe(true);
      console.log('[Container Smoke Test] Relative path accepted successfully');
      
      // 5.5. Log debug information about paths
      console.log('[Container Smoke Test] Container mount info:');
      console.log(`  - Host path: ${tempTestDir}`);
      console.log(`  - Container path: /workspace`);
      console.log(`  - Script relative path: test_container.py`);
      console.log(`  - Expected container full path: /workspace/test_container.py`);
      
      // 6. Start debugging with relative path
      console.log(`[${Date.now() - startTime}ms] Starting debugging with relative path...`);
      console.log('[Container Smoke Test] Test expectations:');
      console.log('  - Container mode is enabled (MCP_CONTAINER=true)');
      console.log(`  - Host temp directory: ${tempTestDir}`);
      console.log('  - Container mount point: /workspace');
      console.log('  - File created: test_container.py');
      console.log('  - Using relative path: test_container.py');
      console.log('  - Expected behavior: Server should resolve relative path from /workspace');
      console.log('  - Expected full path in container: /workspace/test_container.py');
      
      const debugCall = await mcpSdkClient.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId: debugSessionId,
          scriptPath: 'test_container.py',  // Relative path
          dapLaunchArgs: { stopOnEntry: false }
        }
      });
      const debugResponse = parseSdkToolResult(debugCall);
      
      // Add detailed logging to understand the failure
      console.log('[Container Smoke Test] Debug response:', JSON.stringify(debugResponse, null, 2));
      
      if (!debugResponse.success) {
        console.error('[Container Smoke Test] ❌ FAILURE: start_debugging failed with relative path');
        console.error('[Container Smoke Test] Error message:', debugResponse.message || debugResponse.error);
        console.error('[Container Smoke Test] Full response:', debugResponse);
        console.error('[Container Smoke Test] This indicates a bug in the container path resolution logic.');
        console.error('[Container Smoke Test] Possible root causes:');
        console.error('  1. Container working directory is not set to /workspace');
        console.error('  2. PathTranslator is not handling relative paths correctly in container mode');
        console.error('  3. The Python debugger launch is not using the translated path');
        console.error('  4. File permissions or visibility issue in the container');
      }
      
      // Test should fail if relative path doesn't work
      expect(debugResponse.success).toBe(true);
      console.log('[Container Smoke Test] ✅ SUCCESS: Relative path handling works correctly in container mode');
      
    } catch (error) {
      console.error(`[${Date.now() - startTime}ms] Error during path translation test:`, error);
      
      // Capture container logs for debugging
      if (activeContainerName) {
        try {
          const logs = await getContainerLogs(activeContainerName);
          console.error(`[Container Smoke Test] Container logs:\n${logs}`);
        } catch (logError) {
          console.error('[Container Smoke Test] Could not retrieve container logs:', logError);
        }
      }
      
      throw error;
    } finally {
      // Cleanup
      if (debugSessionId && mcpSdkClient) {
        try {
          await mcpSdkClient.callTool({ 
            name: 'close_debug_session', 
            arguments: { sessionId: debugSessionId } 
          });
        } catch (e) {
          console.error(`[Container Smoke Test] Error closing debug session:`, e);
        }
      }
      
      // Clean up temp directory
      if (tempTestDir) {
        try {
          await remove(tempTestDir);
          console.log('[Container Smoke Test] Temp directory cleaned up');
        } catch (e) {
          console.error('[Container Smoke Test] Error cleaning up temp directory:', e);
        }
      }
    }
  }, { timeout: TEST_TIMEOUT });
});
