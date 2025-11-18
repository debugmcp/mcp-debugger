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
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { findDlltoolExecutable } from '../../packages/adapter-rust/src/utils/rust-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const WINDOWS_GNU_TARGET = 'x86_64-pc-windows-gnu';
type ExampleName = 'hello_world' | 'async_example';

interface ExamplePaths {
  sourcePath: string;
  binaryPath: string;
}

const preparedExamples = new Map<ExampleName, ExamplePaths>();

async function prepareExample(exampleName: ExampleName): Promise<ExamplePaths> {
  if (preparedExamples.has(exampleName)) {
    return preparedExamples.get(exampleName)!;
  }

  const exampleRoot = path.resolve(ROOT, 'examples', 'rust', exampleName);
  const sourcePath = path.join(exampleRoot, 'src', 'main.rs');
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file missing for ${exampleName}: ${sourcePath}`);
  }

  await buildExampleBinary(exampleRoot);
  const binaryPath = resolveBinaryPath(exampleRoot, exampleName);
  if (!existsSync(binaryPath)) {
    throw new Error(`Compiled binary missing for ${exampleName}: ${binaryPath}`);
  }

  const result = { sourcePath, binaryPath };
  preparedExamples.set(exampleName, result);
  return result;
}

async function buildExampleBinary(exampleRoot: string): Promise<void> {
  if (process.platform === 'win32') {
    const dlltoolPath = await findDlltoolExecutable();
    if (!dlltoolPath) {
      throw new Error(
        'dlltool.exe is required for GNU toolchain builds on Windows. Install MinGW-w64/binutils or ensure rustup stable-gnu is installed and add dlltool.exe to PATH.'
      );
    }
    const dllDir = path.dirname(dlltoolPath);
    const env = {
      ...process.env,
      PATH: `${dllDir}${path.delimiter}${process.env.PATH ?? ''}`,
      DLLTOOL: dlltoolPath
    };
    try {
      await runCargoCommand(
        ['+stable-gnu', 'build', '--target', WINDOWS_GNU_TARGET],
        exampleRoot,
        env
      );
      return;
    } catch (error) {
      console.warn('[Rust Smoke Test] GNU target build failed, falling back to MSVC build:', error);
    }
  }

  const fallbackArgs =
    process.platform === 'win32'
      ? ['+stable-msvc', 'build', '--target', 'x86_64-pc-windows-msvc']
      : ['build'];
  await runCargoCommand(fallbackArgs, exampleRoot, { ...process.env });
}

function resolveBinaryPath(exampleRoot: string, binaryName: string): string {
  const extension = process.platform === 'win32' ? '.exe' : '';
  if (process.platform === 'win32') {
    const gnuPath = path.join(
      exampleRoot,
      'target',
      WINDOWS_GNU_TARGET,
      'debug',
      `${binaryName}${extension}`
    );
    if (existsSync(gnuPath)) {
      return gnuPath;
    }
  }
  return path.join(exampleRoot, 'target', 'debug', `${binaryName}${extension}`);
}

function runCargoCommand(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('cargo', args, {
      cwd,
      env,
      stdio: 'inherit'
    });
    buildProcess.on('error', reject);
    buildProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`cargo build failed with exit code ${code}`));
      }
    });
  });
}

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
      const { sourcePath: helloSourcePath, binaryPath: helloBinaryPath } =
        await prepareExample('hello_world');
      expect(existsSync(helloSourcePath)).toBe(true);
      expect(existsSync(helloBinaryPath)).toBe(true);

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
          file: helloSourcePath,
          line: 26
        }
      });
      const breakpointResponse = parseSdkToolResult(breakpointResult);
      expect(breakpointResponse.success).toBe(true);

      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: helloBinaryPath,
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
      const firstQuotedValue = nameValue?.match(/"([^"]*)"/)?.[1];
      expect(firstQuotedValue).toBe('Rust');
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
      const { sourcePath: asyncSourcePath, binaryPath: asyncBinaryPath } =
        await prepareExample('async_example');
      expect(existsSync(asyncSourcePath)).toBe(true);
      expect(existsSync(asyncBinaryPath)).toBe(true);

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
          file: asyncSourcePath,
          line: 46
        }
      });
      const breakpointResponse = parseSdkToolResult(breakpointResult);
      expect(breakpointResponse.success).toBe(true);

      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: asyncBinaryPath,
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
