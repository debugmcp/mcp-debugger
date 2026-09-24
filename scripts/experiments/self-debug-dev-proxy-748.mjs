// Manual acceptance probe: use mcp-debugger to inspect its own supervisor.
import assert from 'node:assert/strict';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = process.cwd();
const file = path.join(root, 'tools/dev-proxy/dev-proxy.mjs');
const scrubbed = new Set(['DEBUG_MCP_SKIP_AUTO_START', 'MCP_HTTP_BIND', 'DEBUG', 'NODE_OPTIONS',
  'MCP_DEBUGGER_EXITCODE_FILE', 'MCP_DEBUGGER_EXITCODE_CLAIMED', 'DAP_TRACE_FILE']);
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !scrubbed.has(key.toUpperCase())));
const debuggerClient = new Client({ name: 'self-debug-748', version: '1' });
const targetClient = new Client({ name: 'supervisor-subject', version: '1' });
const debuggerTransport = new StdioClientTransport({
  command: process.execPath, args: [path.join(root, 'packages/mcp-debugger/dist/cli.mjs'), 'stdio'], cwd: root,
  env: { ...env, MCP_SKIP_ORPHAN_REAPERS: '1', DAP_TRACE: '1' }, stderr: 'pipe',
});
debuggerTransport.stderr.on('data', () => {});
const targetTransport = new StdioClientTransport({
  command: process.execPath, args: ['--inspect=127.0.0.1:0', file], cwd: root,
  env: {
    ...env, DEV_PROXY_ROOT: root, DEV_PROXY_BACKEND_TRANSPORT: 'stdio',
    DEV_PROXY_BACKEND_CMD: `"${process.execPath}" "${path.join(root, 'tests/fixtures/dev-proxy/startup-backend.mjs')}"`,
    DEV_PROXY_BUILD_CMD: `"${process.execPath}" -e "console.log('self-debug build');setTimeout(()=>{},3000)"`,
    DEV_PROXY_BUILD_TIMEOUT_MS: '10000', DEV_PROXY_FIXTURE_TOOL: 'fixture_tool',
  }, stderr: 'pipe',
});
let log = '';
targetTransport.stderr.on('data', chunk => { log += chunk.toString(); });
let sessionId;
const parsed = raw => JSON.parse(raw.content.find(item => item.type === 'text').text);
async function call(name, args = {}) {
  const raw = await debuggerClient.callTool({ name, arguments: { ...(sessionId ? { sessionId } : {}), ...args } });
  assert.notEqual(raw.isError, true, JSON.stringify(raw));
  return parsed(raw);
}
try {
  await targetClient.connect(targetTransport);
  await targetClient.listTools();
  const before = parsed(await targetClient.callTool({ name: 'dev_server_status', arguments: {} }));
  await debuggerClient.connect(debuggerTransport);
  sessionId = (await call('create_debug_session', { language: 'javascript', name: 'self-debug-rebuild' })).sessionId;
  await call('attach_to_process', {
    host: '127.0.0.1', port: Number(log.match(/ws:\/\/127\.0\.0\.1:(\d+)\//)[1]),
    stopOnEntry: false, adapterConfig: { sourceMaps: false },
  });
  // Work around #758: non-pausing attach currently skips thread verification.
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if ((await call('list_threads')).threads?.length) { ready = true; break; }
    await delay(100);
  }
  assert(ready, 'target adoption did not complete');
  const pause = call('pause_execution');
  await delay(1000);
  const firstStatus = targetClient.callTool({ name: 'dev_server_status', arguments: {} }, undefined, { timeout: 10000 })
    .then(result => ({ result }), error => ({ error: error.message }));
  assert.equal((await pause).state, 'paused');
  await call('set_breakpoint', { function: 'process.stderr.write', condition: 'this === process.stderr' });
  await call('continue_execution');
  assert.equal((await firstStatus).error, undefined);
  let buildSettled = false;
  const build = targetClient.callTool({ name: 'dev_rebuild_and_restart', arguments: {} }, undefined, { timeout: 15000 })
    .then(result => { buildSettled = true; return { result: parsed(result) }; }, error => ({ error: error.message }));
  let paused = false;
  for (let i = 0; i < 100; i++) {
    if ((await call('list_debug_sessions')).sessions.find(s => s.id === sessionId)?.state === 'paused') { paused = true; break; }
    await delay(100);
  }
  assert(paused, 'function breakpoint did not fire');
  const stack = await call('get_stack_trace');
  // js-debug reports Windows paths with a lower-case drive letter.
  const sameFile = (a, b) => process.platform === 'win32' ? a?.toLowerCase() === b.toLowerCase() : a === b;
  const frame = stack.stackFrames.find(f => f.name.includes('rebuild') && sameFile(f.file, file));
  assert(frame, JSON.stringify(stack));
  const queue = await call('evaluate_expression', { frameId: frame.id, expression: 'this.lifecycleQueue.tail' });
  assert.match(queue.result, /pending/);
  await call('clear_breakpoints');
  await call('continue_execution');
  const start = Date.now();
  const status = parsed(await targetClient.callTool({ name: 'dev_server_status', arguments: {} }));
  const statusLatencyMs = Date.now() - start;
  assert.equal(status.buildInProgress, true);
  assert.equal(status.pid, before.pid);
  assert.equal(buildSettled, false);
  assert(statusLatencyMs < 1000);
  assert.notEqual((await targetClient.callTool({ name: 'fixture_tool', arguments: {} })).isError, true);
  const completed = await build;
  assert.equal(completed.error, undefined);
  assert.equal(completed.result.success, true);
  console.log(JSON.stringify({ sessionId, breakpointFrame: frame, queue: queue.result, statusLatencyMs,
    backendServedDuringBuild: true, replacementStarted: completed.result.status.pid !== before.pid }, null, 2));
} finally {
  if (sessionId) {
    await call('clear_breakpoints').catch(() => {});
    await call('detach_from_process').catch(() => {});
    await call('close_debug_session').catch(() => {});
  }
  await targetClient.close();
  await debuggerClient.close();
}
