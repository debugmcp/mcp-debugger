// The real mcp-debugger server as a dev-proxy stdio backend, counting its own
// starts (tests/integration/dev-proxy-eras.test.ts). The legacy fixture beside
// this one speaks only the 2025 era; this is the built server, which speaks
// both, so the proxy's negotiation with a stdio backend can be observed — and
// the event line shows whether the proxy spawned it once or twice.
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const events = process.env.DEV_PROXY_FIXTURE_EVENTS;
if (events) {
  appendFileSync(events, `${JSON.stringify({ event: 'backend-start', pid: process.pid })}\n`);
}

const entry = path.resolve(process.env.DEV_PROXY_ROOT ?? process.cwd(), 'dist/index.js');
// The entry runs its CLI only as the main module, which it tells from argv.
process.argv = [process.argv[0], entry, 'stdio'];
await import(pathToFileURL(entry).href);
