/**
 * pi extension: registers mcp-debugger with pi's built-in MCP support (issue #841).
 *
 * `pi install npm:@debugmcp/mcp-debugger` loads this file through the package's `pi.extensions`
 * manifest entry. Pi core reads only `extensions`, `skills`, `prompts` and `themes` from a package
 * manifest, so an extension calling `pi.registerMcpServer()` is how a package adds a server to the
 * built-in MCP support (pi 0.99+).
 *
 * - The server is the CLI that `pi install` placed next to this file, so it always matches the
 *   installed skill and starts without an `npx` download. Pi runs on Node, so the server runs on
 *   the same Node binary when the host process is Node, and on `node` from PATH otherwise.
 * - `deferred` exposure: pi lists the server, with its description, in the system prompt's
 *   `mcp_servers` section, and the model loads the tools it needs with `tool_search`, instead of
 *   every prompt carrying all 28 tool schemas. `/mcp` changes it for the session; a `mcp-debugger`
 *   entry in `mcp.json` overrides this registration entirely.
 * - `timeout` (per request, in seconds): pi's default of 60 is shorter than a slow launch, which
 *   can spend proxy start-up, the 30 s readiness wait and a compile (C/C++, COBOL) in one call.
 * - Pi older than 0.99 has no `registerMcpServer`; the extension then does nothing.
 *
 * The factory only registers; pi connects the server when a session starts.
 */
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Absolute path of the bundled CLI the server runs. */
export const CLI_PATH = join(packageDir, 'dist', 'cli.mjs');

/** The Node binary to run the CLI with. */
export function nodeCommand(execPath = process.execPath) {
  return /^node(\.exe)?$/i.test(basename(execPath)) ? execPath : 'node';
}

/** The `mcpServers`-shaped entry this extension registers. */
export function serverConfig(execPath = process.execPath) {
  return {
    command: nodeCommand(execPath),
    args: [CLI_PATH, 'stdio'],
    description:
      'Step-through debugger for Python, JavaScript/TypeScript, Ruby, Rust, Go, Java, .NET, C/C++ and COBOL: ' +
      'breakpoints, stepping, stack traces and live variables. Use it to find why a program misbehaves at runtime.',
    exposure: 'deferred',
    timeout: 180
  };
}

export default function mcpDebugger(pi) {
  if (typeof pi.registerMcpServer !== 'function') return;
  pi.registerMcpServer('mcp-debugger', serverConfig());
}
