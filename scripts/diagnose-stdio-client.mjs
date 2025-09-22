import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';

function normalizeForDocker(p) {
  return process.platform === 'win32' ? p.replace(/\\/g, '/') : p;
}

async function main() {
  const projectRoot = process.cwd();
  const logsDir = path.join(projectRoot, 'logs', 'diag-run');
  fs.mkdirSync(logsDir, { recursive: true });

  const volumeMount = `${normalizeForDocker(logsDir)}:/app/logs`;
  const containerName = `mcp-stdio-diag-${Date.now()}`;

  const transport = new StdioClientTransport({
    command: 'docker',
    args: [
      'run', '--rm', '-i',
      '--name', containerName,
      '-v', volumeMount,
      '-e', 'MCP_CONTAINER=true',
      'mcp-debugger:local',
      'stdio'
    ]
  });

  const client = new Client({
    name: 'diag-stdio-client',
    version: '0.0.1'
  });

  try {
    console.log('[Diag] Connecting to containerized MCP server via stdio...');
    await client.connect(transport);
    console.log('[Diag] Connected.');

    console.log('[Diag] Calling list_supported_languages...');
    const langs = await client.callTool({
      name: 'list_supported_languages',
      arguments: {}
    });
    console.log('[Diag] list_supported_languages result:', JSON.stringify(langs, null, 2));

    console.log('[Diag] Creating python debug session...');
    const create = await client.callTool({
      name: 'create_debug_session',
      arguments: { language: 'python', name: 'Diag Session' }
    });
    console.log('[Diag] create_debug_session result:', JSON.stringify(create, null, 2));

    // Try to parse sessionId if present
    let sessionId;
    try {
      const contentArray = (create || {}).content;
      if (Array.isArray(contentArray) && contentArray[0]?.type === 'text') {
        const parsed = JSON.parse(contentArray[0].text);
        sessionId = parsed.sessionId;
      }
    } catch (e) {
      if (process.env.DEBUG_STDIO_DIAG) {
        console.warn('[Diag] Ignoring parse error:', e?.message || e);
      }
    }

    if (sessionId) {
      console.log('[Diag] Closing session:', sessionId);
      const close = await client.callTool({
        name: 'close_debug_session',
        arguments: { sessionId }
      });
      console.log('[Diag] close_debug_session result:', JSON.stringify(close, null, 2));
    } else {
      console.log('[Diag] No sessionId returned; skipping close.');
    }

    console.log('[Diag] Done.');
  } catch (err) {
    console.error('[Diag] Error:', err?.message || err);
    process.exitCode = 1;
  } finally {
    try { await client.close(); } catch (e) {
      if (process.env.DEBUG_STDIO_DIAG) {
        console.warn('[Diag] Ignoring close error:', e?.message || e);
      }
    }
  }

  console.log('[Diag] Logs should be available under:', logsDir);
}

main();
