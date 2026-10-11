/**
 * One stdio MCP client bootstrap for the integration suites that drive the
 * built server (`dist/index.js stdio`) end to end (issue #810).
 *
 * Three suites carried byte-identical copies of the scrubbed-environment set,
 * the transport, the stderr drain, the `call` helper and the teardown. The
 * scrub set had already grown twice (`MCP_DEBUGGER_EXITCODE_CLAIMED` for #731,
 * `DAP_TRACE_FILE`); the next variable a nested server must not inherit would
 * have had to be added in three places, and a miss poisons one suite silently.
 * `tests/e2e/smoke-test-utils.ts` covers the e2e side (result parsing, a
 * `callToolSafely` that swallows errors — the opposite contract from `call`
 * below, which asserts); this is the integration-project counterpart.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/** The repository root (this file lives at tests/test-utils/helpers/). */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Variables the spawned server must never inherit from the test runner:
 * vitest's own NODE_OPTIONS, the bundled CLI's bootstrap flag, the exit-code
 * shim's channel (#731), debug logging and the DAP trace file. Compared
 * upper-cased, so a differently-cased Windows spelling cannot slip through.
 */
export const SCRUBBED_ENV_KEYS: readonly string[] = [
  'NODE_OPTIONS',
  'DEBUG_MCP_SKIP_AUTO_START',
  'MCP_DEBUGGER_EXITCODE_FILE',
  'MCP_DEBUGGER_EXITCODE_CLAIMED',
  'DEBUG',
  'DAP_TRACE_FILE'
];

/** The runner's environment without the scrubbed keys (and any extra ones). */
export function scrubbedEnvironment(extraScrub: readonly string[] = []): Record<string, string> {
  const scrubbed = new Set([...SCRUBBED_ENV_KEYS, ...extraScrub].map((key) => key.toUpperCase()));
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && !scrubbed.has(entry[0].toUpperCase())
    )
  );
}

export interface ServerEnvironmentOptions {
  /** Extra keys to scrub beyond SCRUBBED_ENV_KEYS. */
  scrub?: readonly string[];
  /** Extra environment for the spawned server, applied last. */
  env?: Record<string, string>;
  /** MCP_EXIT_ON_STDIN_CLOSE for the spawned server; default on. */
  exitOnStdinClose?: boolean;
}

/**
 * The environment a spawned mcp-debugger gets: the scrubbed runner environment
 * plus the two flags every test server runs with. The same shape serves a
 * target the suite spawns itself (the self-debug suite's inspected server).
 */
export function serverEnvironment(options: ServerEnvironmentOptions = {}): Record<string, string> {
  return {
    ...scrubbedEnvironment(options.scrub),
    MCP_SKIP_ORPHAN_REAPERS: '1',
    MCP_EXIT_ON_STDIN_CLOSE: options.exitOnStdinClose === false ? '0' : '1',
    ...(options.env ?? {})
  };
}

/** The fields every tool answer may carry; suites extend it with their own. */
export interface ToolAnswer {
  success: boolean;
  state?: string;
  message?: string;
  error?: string;
  warning?: string;
}

export interface StdioClientOptions extends ServerEnvironmentOptions {
  /** The MCP client name reported to the server. */
  name: string;
  /** Per-call timeout for `call`; default 30 s. */
  callTimeoutMs?: number;
  /** Timeout for the close_debug_session that `close` sends; default 5 s. */
  closeTimeoutMs?: number;
  /** Where the spawned server starts; default the repository root. */
  cwd?: string;
}

export interface StdioClientHandle {
  readonly client: Client;
  /** Injected into every `call`'s arguments while set: the suite's current session. */
  sessionId: string | undefined;
  /** Call a tool, assert it did not error, and parse its first text block. */
  call<T extends ToolAnswer = ToolAnswer>(name: string, args?: Record<string, unknown>): Promise<T>;
  /** create_debug_session, remembering its id for `call`. */
  createSession(language: string, name: string): Promise<string>;
  /** close_debug_session for the remembered session (best effort), then close the client. */
  close(): Promise<void>;
}

/**
 * Spawn `dist/index.js stdio` with the scrubbed environment and connect a
 * client to it. The returned handle's `close` is the teardown every suite
 * needs; register it in afterEach.
 */
export async function startStdioClient(options: StdioClientOptions): Promise<StdioClientHandle> {
  const client = new Client({ name: options.name, version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(REPO_ROOT, 'dist/index.js'), 'stdio'],
    cwd: options.cwd ?? REPO_ROOT,
    env: serverEnvironment(options),
    stderr: 'pipe'
  });
  transport.stderr?.on('data', () => {});
  await client.connect(transport);
  const timeout = options.callTimeoutMs ?? 30_000;
  const closeTimeout = options.closeTimeoutMs ?? 5_000;

  const handle: StdioClientHandle = {
    client,
    sessionId: undefined,
    async call<T extends ToolAnswer = ToolAnswer>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      const raw = await client.callTool(
        { name, arguments: { ...(handle.sessionId ? { sessionId: handle.sessionId } : {}), ...args } },
        undefined,
        { timeout }
      );
      expect(raw.isError, JSON.stringify(raw)).not.toBe(true);
      const content = raw.content as Array<{ type: string; text?: string }>;
      return JSON.parse(content.find((item) => item.type === 'text')!.text!) as T;
    },
    async createSession(language: string, name: string): Promise<string> {
      const created = await handle.call<ToolAnswer & { sessionId: string }>('create_debug_session', { language, name });
      expect(created.success, JSON.stringify(created)).toBe(true);
      handle.sessionId = created.sessionId;
      return created.sessionId;
    },
    async close(): Promise<void> {
      try {
        if (handle.sessionId) {
          await client
            .callTool({ name: 'close_debug_session', arguments: { sessionId: handle.sessionId } }, undefined, { timeout: closeTimeout })
            .catch(() => {});
        }
      } finally {
        handle.sessionId = undefined;
        await client.close();
      }
    }
  };
  return handle;
}
