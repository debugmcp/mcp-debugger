/**
 * Shared helpers for exploratory testing
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT = path.resolve(__dirname, '../..');

// ========== SDK Helpers ==========

export function parseSdkToolResult(rawResult) {
  const contentArray = rawResult.content;
  if (!contentArray || !Array.isArray(contentArray) || contentArray.length === 0) {
    throw new Error('Invalid result structure: ' + JSON.stringify(rawResult));
  }
  if (contentArray[0].type !== 'text') {
    throw new Error('Non-text content type: ' + contentArray[0].type);
  }
  return JSON.parse(contentArray[0].text);
}

export async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  return parseSdkToolResult(result);
}

export async function callToolSafe(client, name, args) {
  try {
    return await callTool(client, name, args);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ========== Network Helpers ==========

export async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryPort = () => {
      if (attempts++ >= 20) {
        reject(new Error('Could not find available port after 20 attempts'));
        return;
      }
      const port = Math.floor(Math.random() * (65535 - 49152)) + 49152;
      const server = net.createServer();
      server.once('error', () => tryPort());
      server.once('listening', () => {
        server.close(() => setTimeout(() => resolve(port), 300));
      });
      server.listen(port);
    };
    tryPort();
  });
}

export async function waitForHealth(port, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const resp = await fetch(`http://localhost:${port}/health`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'ok') return true;
      }
    } catch {
      // Connection refused, server not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ========== MCP Client Helpers ==========

export async function connectSSEClient(port, clientName = 'exploratory-test') {
  const client = new Client({ name: clientName, version: '0.1.0' });
  const transport = new SSEClientTransport(new URL(`http://localhost:${port}/sse`));
  await client.connect(transport);
  return client;
}

// ========== Test Runner ==========

export function createTestRunner() {
  const results = [];
  let testNum = 0;

  async function runTest(name, fn) {
    testNum++;
    const start = Date.now();
    try {
      await fn();
      const duration = Date.now() - start;
      results.push({ name, status: 'PASS', duration });
      console.log(`  PASS [${testNum}] ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      results.push({ name, status: 'FAIL', error: error.message, duration });
      console.log(`  FAIL [${testNum}] ${name} (${duration}ms)`);
      console.log(`    Error: ${error.message}`);
    }
  }

  function printSummary(title) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  RESULTS: ${title}`);
    console.log('='.repeat(50));
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);
    for (const r of results) {
      const icon = r.status === 'PASS' ? 'PASS' : 'FAIL';
      console.log(`  ${icon} ${r.name}${r.error ? ' -> ' + r.error : ''} (${r.duration}ms)`);
    }
    console.log('='.repeat(50));
    return { total: results.length, passed, failed, results };
  }

  return { runTest, printSummary, results };
}

// ========== Assertions ==========

export function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

export function assertDefined(value, name) {
  if (value === undefined || value === null) throw new Error(`${name} is undefined/null`);
}
