/**
 * Rust Adapter Smoke Test via MCP Interface
 *
 * Reproduces the current Rust debugging failure so we can iterate locally
 * instead of relying on manual user sessions.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('MCP Server Rust Debugging Smoke Test', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    const distEntry = path.join(ROOT, 'dist', 'index.js');
    if (!existsSync(distEntry)) {
      throw new Error(`Debug MCP dist build missing at ${distEntry}. Run "pnpm build" before executing tests.`);
    }

    transport = new StdioClientTransport({
      command: 'node',
      args: [distEntry, '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client(
      { name: 'rust-smoke-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await mcpClient.connect(transport);
    console.log('[Rust Smoke Test] MCP client connected');
  }, 30000);

  afterEach(async () => {
    if (sessionId && mcpClient) {
      await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      sessionId = null;
    }
  });

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close();
      mcpClient = null;
    }
    if (transport) {
      await transport.close();
      transport = null;
    }
  });

  it(
    'starts Rust debug session end-to-end without proxy exit',
    async () => {
      const scriptPath = path.resolve(
        ROOT,
        'examples',
        'rust',
        'hello_world',
        'src',
        'main.rs'
      );
      expect(existsSync(scriptPath)).toBe(true);

      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'rust', name: 'rust-smoke-test' }
      });
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.success).toBe(true);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;

      const breakpointResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: scriptPath,
          line: 26
        }
      });
      const breakpointResponse = parseSdkToolResult(breakpointResult);
      expect(breakpointResponse.success).toBe(true);

      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath,
          args: [],
          dapLaunchArgs: {
            stopOnEntry: true
          },
          adapterLaunchConfig: {
            sourceLanguages: ['rust']
          }
        }
      });
      const startResponse = parseSdkToolResult(startResult);
      const message = String(startResponse.message ?? startResponse.error ?? '');
      if (!startResponse.success) {
        throw new Error(`start_debugging failed: ${JSON.stringify(startResponse, null, 2)}`);
      }
      expect(['paused', 'running']).toContain(startResponse.state);
      expect(message.toLowerCase()).not.toContain('proxy exited');

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const fetchStackTrace = async () => {
        const stackRaw = await mcpClient!.callTool({
          name: 'get_stack_trace',
          arguments: {
            sessionId,
            includeInternals: false
          }
        });
        return parseSdkToolResult(stackRaw) as {
          success?: boolean;
          stackFrames?: Array<{ file?: string; name?: string; line?: number }>;
        };
      };

      const isUserFrame = (frame: { file?: string }) => {
        if (typeof frame.file !== 'string') return false;
        const normalized = frame.file.replace(/\\/g, '/');
        return normalized.includes('/examples/rust/hello_world/src/');
      };

      await wait(500);
      let stackResponse = await fetchStackTrace();

      if (!stackResponse.stackFrames?.some(isUserFrame)) {
        const continueResult = parseSdkToolResult(
          await mcpClient!.callTool({
            name: 'continue_execution',
            arguments: { sessionId }
          })
        );
        expect(continueResult.success).toBe(true);

        for (let attempt = 0; attempt < 10; attempt++) {
          await wait(300);
          stackResponse = await fetchStackTrace();
          if (stackResponse.stackFrames?.some(isUserFrame)) {
            break;
          }
        }
      }

      if (!stackResponse.stackFrames?.some(isUserFrame)) {
        throw new Error(`Failed to reach user frame. Stack: ${JSON.stringify(stackResponse, null, 2)}`);
      }

      const activeFrame = stackResponse.stackFrames.find(isUserFrame)!;
      expect(activeFrame.file?.replace(/\\/g, '/')).toContain('/examples/rust/hello_world/src/');
      expect(activeFrame.name?.toLowerCase()).toContain('main');
      if (typeof activeFrame.line === 'number') {
        expect(activeFrame.line).toBe(26);
      }

      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
        count?: number;
      };

      expect(localsResponse.success).toBe(true);
      expect(Array.isArray(localsResponse.variables)).toBe(true);
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(variable => [variable.name, variable.value])
      );
      const nameValue = localsByName.get('name');
      expect(nameValue).toBeDefined();
      expect(nameValue).toContain('Rust');
      const versionValue = localsByName.get('version');
      if (versionValue) {
        expect(versionValue).toContain('1.75');
      }
    },
    60000
  );

  it(
    'steps through async await and inspects locals',
    async () => {
      const scriptPath = path.resolve(
        ROOT,
        'examples',
        'rust',
        'async_example',
        'src',
        'main.rs'
      );
      expect(existsSync(scriptPath)).toBe(true);

      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'rust', name: 'rust-async-smoke-test' }
      });
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.success).toBe(true);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;

      const breakpointResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: scriptPath,
          line: 46
        }
      });
      const breakpointResponse = parseSdkToolResult(breakpointResult);
      expect(breakpointResponse.success).toBe(true);

      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath,
          args: [],
          dapLaunchArgs: {
            stopOnEntry: true
          },
          adapterLaunchConfig: {
            sourceLanguages: ['rust']
          }
        }
      });
      const startResponse = parseSdkToolResult(startResult);
      expect(startResponse.success).toBe(true);

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const fetchStackTrace = async () => {
        const stackRaw = await mcpClient!.callTool({
          name: 'get_stack_trace',
          arguments: {
            sessionId,
            includeInternals: false
          }
        });
        return parseSdkToolResult(stackRaw) as {
          success?: boolean;
          stackFrames?: Array<{ file?: string; name?: string; line?: number }>;
        };
      };

      const isAsyncUserFrame = (frame: { file?: string }) => {
        if (typeof frame.file !== 'string') return false;
        const normalized = frame.file.replace(/\\/g, '/');
        return normalized.includes('/examples/rust/async_example/src/');
      };

      await wait(500);
      let stackResponse = await fetchStackTrace();

      if (!stackResponse.stackFrames?.some(isAsyncUserFrame)) {
        const continueResult = parseSdkToolResult(
          await mcpClient!.callTool({
            name: 'continue_execution',
            arguments: { sessionId }
          })
        );
        expect(continueResult.success).toBe(true);

        for (let attempt = 0; attempt < 10; attempt++) {
          await wait(300);
          stackResponse = await fetchStackTrace();
          if (stackResponse.stackFrames?.some(isAsyncUserFrame)) {
            break;
          }
        }
      }

      if (!stackResponse.stackFrames?.some(isAsyncUserFrame)) {
        throw new Error(`Failed to reach async user frame. Stack: ${JSON.stringify(stackResponse, null, 2)}`);
      }

      const asyncFrame = stackResponse.stackFrames.find(isAsyncUserFrame)!;
      expect(asyncFrame.file?.replace(/\\/g, '/')).toContain('/examples/rust/async_example/src/');
      expect(asyncFrame.line).toBe(46);

      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
        count?: number;
      };
      expect(localsResponse.success).toBe(true);
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(variable => [variable.name, variable.value])
      );
      expect(localsByName.get('id')).toBe('1');
      const resultVariable = localsByName.get('result');
      if (resultVariable) {
        expect(resultVariable).toContain('Data_1');
      }

      const finalContinue = parseSdkToolResult(
        await mcpClient!.callTool({
          name: 'continue_execution',
          arguments: { sessionId }
        })
      );
      expect(finalContinue.success).toBe(true);
    },
    60000
  );
});
