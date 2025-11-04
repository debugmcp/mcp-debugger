import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { setTimeout as wait } from 'timers/promises';
import path from 'path';
import { fileURLToPath } from 'url';

function parseResult(result) {
  const content = result?.content?.[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected ServerResult format: ' + JSON.stringify(result));
  }
  return JSON.parse(content.text);
}

async function waitForHealth(port, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'ok') return true;
      }
    } catch {}
    await wait(500);
  }
  return false;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const scriptPath = path.join(ROOT, 'examples', 'javascript', 'simple_test.js');

const port = 3900 + Math.floor(Math.random() * 200);
const server = spawn(process.execPath, ['dist/index.js', 'sse', '--port', String(port), '--log-level', 'debug'], {
  cwd: ROOT,
  env: { ...process.env, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', chunk => process.stdout.write('[server] ' + chunk.toString()));
server.stderr.on('data', chunk => process.stderr.write('[server-err] ' + chunk.toString()));

async function shutdown() {
  if (!server.killed) {
    server.kill('SIGTERM');
    await wait(500);
    if (!server.killed) server.kill('SIGKILL');
  }
}

try {
  const ready = await waitForHealth(port);
  if (!ready) throw new Error('Server did not become healthy');

  console.log('[client] connecting');
  const client = new Client({ name: 'long-delay-repro', version: '0.0.0' });
  const transport = new SSEClientTransport(new URL(`http://127.0.0.1:${port}/sse`));
  await client.connect(transport);
  console.log('[client] connected');

  const createResp = parseResult(await client.callTool({
    name: 'create_debug_session',
    arguments: { language: 'javascript', name: 'long-delay' }
  }));
  console.log('[client] create response:', createResp);
  const sessionId = createResp.sessionId;

  const bpResp = parseResult(await client.callTool({
    name: 'set_breakpoint',
    arguments: { sessionId, file: scriptPath, line: 14 }
  }));
  console.log('[client] breakpoint response:', bpResp);

  const startResp = parseResult(await client.callTool({
    name: 'start_debugging',
    arguments: {
      sessionId,
      scriptPath
    }
  }));
  console.log('[client] start debugging response:', startResp);

  console.log('[client] waiting 10 seconds before locals');
  await wait(10000);

  try {
    const localsResp = parseResult(await client.callTool({
      name: 'get_local_variables',
      arguments: { sessionId }
    }));
    console.log('[client] locals response:', localsResp);
  } catch (err) {
    console.error('[client] locals error:', err);
  }

  try {
    const stackResp = parseResult(await client.callTool({
      name: 'get_stack_trace',
      arguments: { sessionId }
    }));
    console.log('[client] stack response:', stackResp);
  } catch (err) {
    console.error('[client] stack error:', err);
  }

  await client.close();
  await transport.dispose?.();
} catch (err) {
  console.error('[long-delay] failed:', err);
} finally {
  await shutdown();
}