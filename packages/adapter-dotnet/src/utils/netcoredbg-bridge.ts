/**
 * netcoredbg TCP-to-stdio bridge — thin entry point
 *
 * netcoredbg's `--server=PORT` mode has a bug on all platforms (originally
 * discovered on Windows) where the TCP connection drops after the DAP
 * initialize sequence. As a workaround, this bridge:
 *
 * 1. Listens on a TCP port (for the proxy to connect)
 * 2. Spawns netcoredbg in stdio mode (`--interpreter=vscode`)
 * 3. Forwards DAP messages bidirectionally between TCP ↔ stdio
 *
 * This is a pure byte-level forwarder — no DAP parsing or modification.
 *
 * Usage (spawned by adapter/proxy):
 *   node netcoredbg-bridge.js <netcoredbg-path> <port>
 */
import { createBridge } from './netcoredbg-bridge-core.js';

const [netcoredbgPath, portStr] = process.argv.slice(2);
const port = parseInt(portStr, 10);

if (!netcoredbgPath || !port) {
  process.stderr.write(`Usage: node netcoredbg-bridge.js <netcoredbg-path> <port>\n`);
  process.exit(1);
}

const { cleanup } = createBridge(netcoredbgPath, port);

// Clean up on process exit
process.on('SIGTERM', () => {
  cleanup();
});
