/**
 * Docker Rust Smoke Tests
 *
 * Validates Rust debugging when MCP Debugger runs inside Docker.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  buildDockerImage,
  createDockerMcpClient,
  hostToContainerPath,
  getDockerLogs
} from './docker-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import { prepareRustExample } from '../rust-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');
const DOCKER_RUST_ENABLED = process.env.DOCKER_ENABLE_RUST === 'true';

if (!DOCKER_RUST_ENABLED) {
  console.warn(
    '[Docker Rust Tests] Skipping docker rust smoke tests (set DOCKER_ENABLE_RUST=true to re-enable).',
  );
}

function ensureSuccess(response: any, label: string) {
  if (!response?.success) {
    console.error(`[Docker Rust] ${label} failed`, JSON.stringify(response, null, 2));
  }
  expect(response?.success).toBe(true);
}

function toContainerAbsolute(containerPath: string): string {
  if (containerPath.startsWith('/')) {
    return containerPath;
  }
  return `/workspace/${containerPath.replace(/^\/*/, '')}`;
}

const describeDockerRust = DOCKER_RUST_ENABLED ? describe : describe.skip;

describeDockerRust.sequential('Docker: Rust Debugging Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  let sessionId: string | null = null;
  let containerName: string | null = null;
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForStackFrame = async (
    session: string,
    predicate: (frame: { file?: string | null }) => boolean,
    context: string
  ) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const trace = parseSdkToolResult(
        await mcpClient!.callTool({
          name: 'get_stack_trace',
          arguments: { sessionId: session, includeInternals: false }
        })
      );
      ensureSuccess(trace, `${context}:get_stack_trace`);
      const frames = Array.isArray(trace.stackFrames) ? trace.stackFrames : [];
      const hit = frames.find(predicate);
      if (hit) {
        return hit;
      }
      await wait(250);
    }
    throw new Error(`[Docker Rust] Timed out waiting for stack frame during ${context}`);
  };

  beforeAll(async () => {
    console.log('[Docker Rust] Preparing Linux binaries for rust examples...');
    await prepareRustExample('hello_world', { target: 'linux' });
    await prepareRustExample('async_example', { target: 'linux' });

    console.log('[Docker Rust] Building Docker image...');
    await buildDockerImage({ imageName: 'mcp-debugger:test' });

    console.log('[Docker Rust] Starting MCP server in Docker container...');
    containerName = `mcp-debugger-rust-test-${Date.now()}`;
    const result = await createDockerMcpClient({
      imageName: 'mcp-debugger:test',
      containerName,
      logLevel: 'debug'
    });

    mcpClient = result.client;
    cleanup = result.cleanup;
    console.log('[Docker Rust] MCP client connected to Docker container');
  }, 240000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch {
        // session might already be closed
      }
    }

    if (cleanup) {
      await cleanup();
    }

    if (containerName && process.env.VITEST_FAILED) {
      console.log('[Docker Rust] Container logs:');
      console.log(await getDockerLogs(containerName));
    }
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch {
        // Ignore cleanup errors
      }
      sessionId = null;
    }
  });

  it(
    'should complete hello_world Rust debugging cycle in Docker',
    async () => {
      const { sourcePath, binaryPath } = await prepareRustExample('hello_world', { target: 'linux' });
      const containerSourcePath = hostToContainerPath(sourcePath);
      const containerBinaryPath = hostToContainerPath(binaryPath);

      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'rust', name: 'docker-rust-hello' }
      });
      const createResponse = parseSdkToolResult(createResult);
      ensureSuccess(createResponse, 'create_debug_session');
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;

      const breakpointResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: containerSourcePath,
          line: 26
        }
      });
      ensureSuccess(parseSdkToolResult(breakpointResult), 'set_breakpoint');

      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: containerBinaryPath,
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
      ensureSuccess(startResponse, 'start_debugging');
      expect(startResponse.state).toContain('paused');

      const pauseResult = await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      });
      ensureSuccess(parseSdkToolResult(pauseResult), 'continue_execution (to breakpoint)');

      const continueResult = await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      });
      ensureSuccess(parseSdkToolResult(continueResult), 'continue_execution');

      const closeResult = await mcpClient!.callTool({
        name: 'close_debug_session',
        arguments: { sessionId }
      });
      ensureSuccess(parseSdkToolResult(closeResult), 'close_debug_session');
      sessionId = null;
    },
    120000
  );

  it(
    'should inspect async locals for Rust example in Docker',
    async () => {
      const { sourcePath, binaryPath } = await prepareRustExample('async_example', { target: 'linux' });
      const containerSourcePath = hostToContainerPath(sourcePath);
      const absoluteAsyncSourcePath = toContainerAbsolute(containerSourcePath);
      const containerBinaryPath = hostToContainerPath(binaryPath);

      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'rust', name: 'docker-rust-async' }
      });
      const createResponse = parseSdkToolResult(createResult);
      ensureSuccess(createResponse, 'create_debug_session');
      sessionId = createResponse.sessionId as string;

      const breakpointResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: containerSourcePath,
          line: 46
        }
      });
      ensureSuccess(parseSdkToolResult(breakpointResult), 'set_breakpoint');

      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: containerBinaryPath,
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
      ensureSuccess(startResponse, 'start_debugging');

      const pauseResult = await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      });
      ensureSuccess(parseSdkToolResult(pauseResult), 'continue_execution (async breakpoint)');

      await waitForStackFrame(
        sessionId,
        (frame) => frame.file?.replace(/\\/g, '/').includes(absoluteAsyncSourcePath.replace(/\\/g, '/')),
        'async_example'
      );

      const localsResult = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsResult) as {
        variables?: Array<{ name: string; value: string }>;
      };
      ensureSuccess(localsResponse, 'get_local_variables');
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(variable => [variable.name, variable.value])
      );
      expect(localsByName.get('id')).toBeDefined();

      const continueResult = await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      });
      ensureSuccess(parseSdkToolResult(continueResult), 'continue_execution');

      const closeResult = await mcpClient!.callTool({
        name: 'close_debug_session',
        arguments: { sessionId }
      });
      ensureSuccess(parseSdkToolResult(closeResult), 'close_debug_session');
      sessionId = null;
    },
    120000
  );
});
