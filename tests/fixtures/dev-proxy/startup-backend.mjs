import { access } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

if (process.env.DEV_PROXY_FIXTURE_FAIL === '1') process.exit(1);

// The test releases startup only after sending its first tools/list request.
const releaseFile = process.env.DEV_PROXY_FIXTURE_RELEASE;
if (releaseFile) {
  while (!(await access(releaseFile).then(() => true, () => false))) {
    await setTimeout(10);
  }
}

const server = new Server({ name: 'startup-fixture', version: '1.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: process.env.DEV_PROXY_FIXTURE_TOOL || 'fixture_tool',
    description: 'Tool from the startup fixture',
    inputSchema: { type: 'object', properties: {} },
  }],
}));
process.stdin.on('end', () => process.exit(0));
await server.connect(new StdioServerTransport());
