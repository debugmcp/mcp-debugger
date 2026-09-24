import { access } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

if (process.env.DEV_PROXY_FIXTURE_EVENTS) {
  appendFileSync(process.env.DEV_PROXY_FIXTURE_EVENTS, JSON.stringify({
    kind: 'backend-start', pid: process.pid, tool: process.env.DEV_PROXY_FIXTURE_TOOL,
  }) + '\n');
}

if (process.env.DEV_PROXY_FIXTURE_FAIL === '1') process.exit(1);

// The test releases startup only after sending its first tools/list request.
// The release file may never arrive (a test that fails before writing it), and
// nothing is listening on stdin yet — the SDK transport attaches its 'data'
// handler only at connect(), and resuming stdin here would consume the proxy's
// initialize frame. So bound the wait: a fixture that is never released must
// exit rather than poll access() at 100 Hz forever.
const RELEASE_DEADLINE_MS = 60_000;
const releaseFile = process.env.DEV_PROXY_FIXTURE_RELEASE;
if (releaseFile) {
  const deadline = Date.now() + RELEASE_DEADLINE_MS;
  while (!(await access(releaseFile).then(() => true, () => false))) {
    if (Date.now() >= deadline) {
      process.stderr.write(`startup fixture: never released after ${RELEASE_DEADLINE_MS}ms\n`);
      process.exit(2);
    }
    await setTimeout(10);
  }
}

const server = new Server({ name: 'startup-fixture', version: '1.0.0' }, { capabilities: { tools: {}, resources: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: process.env.DEV_PROXY_FIXTURE_TOOL || 'fixture_tool',
    description: 'Tool from the startup fixture',
    inputSchema: { type: 'object', properties: {} },
  }],
}));
// Answering at all is the point: it proves the proxy forwarded the call rather
// than refusing it while the backend was still starting.
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.arguments?.floodStderr) {
    // More than a pipe's capacity: answering proves the proxy drained stderr
    // while a build was running, rather than leaving this write blocked.
    await new Promise((resolve, reject) => {
      process.stderr.write(('fixture noise '.repeat(40) + '\n').repeat(512), (err) => err ? reject(err) : resolve());
    });
  }
  return { content: [{ type: 'text', text: `startup fixture handled ${request.params.name}` }] };
});
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{ uri: 'fixture://status', name: 'status' }],
}));
server.setRequestHandler(ReadResourceRequestSchema, async () => ({
  contents: [{ uri: 'fixture://status', text: process.env.DEV_PROXY_FIXTURE_TOOL || 'fixture_tool' }],
}));
process.stdin.on('end', () => process.exit(0));
await server.connect(new StdioServerTransport());
