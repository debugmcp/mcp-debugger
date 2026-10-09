/**
 * Docker Dart Smoke Tests (issue #790)
 *
 * The image carries the Dart SDK from the official `dart` image, so `dart debug_adapter` runs
 * in-container behind the stdio bridge. The lane debugs the dependency-free examples/dart/hello.dart
 * (the examples mount is volume-mounted, so a project needing `dart pub get` stays host-only).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { buildDockerImage, createDockerMcpClient, getDockerLogs } from './docker-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const SKIP_DOCKER = process.env.SKIP_DOCKER_TESTS === 'true';

// examples/dart/hello.dart — `final target = 'mcp-debugger'; // BP-HELLO`
const BP_LINE = 3;

describe.skipIf(SKIP_DOCKER)('Docker: Dart Debugging Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  let sessionId: string | null = null;
  let containerName: string | null = null;
  let anyFailed = false;

  afterEach((ctx) => {
    if (ctx.task.result?.state === 'fail') {
      anyFailed = true;
    }
  });

  beforeAll(async () => {
    console.log('[Docker Dart] Building Docker image...');
    await buildDockerImage({ imageName: 'mcp-debugger:test' });

    containerName = `mcp-debugger-dart-test-${Date.now()}`;
    const result = await createDockerMcpClient({
      imageName: 'mcp-debugger:test',
      containerName,
      logLevel: 'debug'
    });
    mcpClient = result.client;
    cleanup = result.cleanup;
  }, 600000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({ name: 'close_debug_session', arguments: { sessionId } });
      } catch { /* already closed */ }
    }
    if (anyFailed && containerName) {
      console.log('[Docker Dart] container logs:\n' + await getDockerLogs(containerName));
    }
    if (cleanup) {
      await cleanup();
    }
  });

  it('advertises dart with launch and attach available', async () => {
    const response = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_supported_languages', arguments: {} }));
    expect(response.installed).toContain('dart');
    const dart = (response.available as Array<{ language: string; installed: boolean; modes: { launch: { available: boolean }; attach: { available: boolean } } }>)
      .find(a => a.language === 'dart');
    expect(dart).toBeDefined();
    expect(dart!.installed).toBe(true);
    expect(dart!.modes.launch.available).toBe(true);
    expect(dart!.modes.attach.available).toBe(true);
  }, 60000);

  it('launches hello.dart in-container, breaks, inspects, and runs to exit 0', async () => {
    // Relative path — the container roots it at /workspace (the examples mount)
    const scriptPath = 'dart/hello.dart';

    sessionId = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'dart', name: 'docker-dart-smoke' }
    })).sessionId as string;
    expect(sessionId).toBeDefined();

    expect(parseSdkToolResult(await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: BP_LINE }
    })).success).toBe(true);

    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: { sessionId, scriptPath, dapLaunchArgs: { stopOnEntry: false } }
    }));
    console.log('[Docker Dart] Start response:', JSON.stringify(startResponse).slice(0, 300));
    expect(startResponse.success).not.toBe(false);

    let paused = false;
    for (let i = 0; i < 60 && !paused; i++) {
      await new Promise(r => setTimeout(r, 500));
      const sessions = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      const s = (sessions.sessions as Array<{ id: string; state: string }>).find(x => x.id === sessionId);
      paused = s?.state === 'paused';
    }
    expect(paused, 'session should pause at the breakpoint').toBe(true);

    const stackResponse = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_stack_trace', arguments: { sessionId } }));
    const frames = stackResponse.stackFrames as Array<{ name: string; line: number; file?: string }>;
    expect(frames[0]?.name).toBe('main');
    expect(frames[0]?.line).toBe(BP_LINE);

    const localsResponse = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_local_variables', arguments: { sessionId } }));
    const locals = new Map((localsResponse.variables as Array<{ name: string; value: string }>).map(v => [v.name, v.value]));
    expect(locals.get('greeting')).toBe('"hello"');

    const evalResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'evaluate_expression',
      arguments: { sessionId, expression: 'greeting.length' }
    }));
    expect(String(evalResponse.result)).toBe('5');

    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'continue_execution', arguments: { sessionId } })).success).not.toBe(false);
    let exitCode: number | undefined;
    for (let i = 0; i < 40 && exitCode === undefined; i++) {
      await new Promise(r => setTimeout(r, 500));
      const sessions = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      const s = (sessions.sessions as Array<{ id: string; state: string; exitCode?: number }>).find(x => x.id === sessionId);
      if (s?.state === 'stopped') exitCode = s.exitCode;
    }
    expect(exitCode).toBe(0);

    const outputResult = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_output', arguments: { sessionId } }));
    const entries = (outputResult.entries ?? []) as Array<{ output: string }>;
    expect(entries.some(e => e.output.includes('hello mcp-debugger')), 'program output captured').toBe(true);

    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'close_debug_session', arguments: { sessionId } })).success).toBe(true);
    sessionId = null;
  }, 120000);
});
