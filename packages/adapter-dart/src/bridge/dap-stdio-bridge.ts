/**
 * Process entry for the TCP ↔ stdio bridge. Bundled by `scripts/bundle-bridge.mjs` into
 * `dist/bridge/dap-stdio-bridge.js` and spawned by the Dart adapter as:
 *
 *   node dap-stdio-bridge.js --port <port> [--host <host>] [--cwd <dir>] -- <dart-or-flutter-dap-command…>
 */
import { createBridge, parseBridgeArgs } from './dap-stdio-bridge-core.js';

async function main(): Promise<void> {
  const args = parseBridgeArgs(process.argv.slice(2));
  const bridge = await createBridge(args);
  const stop = (): void => { void bridge.close().then(() => process.exit(bridge.exitCode ?? 0)); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  const code = await bridge.done;
  await bridge.close();
  process.exit(code);
}

main().catch((err: Error) => {
  process.stderr.write(`[dap-stdio-bridge] ${err.message}\n`);
  process.exit(2);
});
