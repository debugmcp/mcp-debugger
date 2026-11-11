import { describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { expectModernEraDebugCycle } from '../e2e/smoke-test-utils.js';
import { TOOL_NAMES } from '../../src/server/tool-schemas.js';

function fixture(start: Record<string, unknown>, stop: Record<string, unknown> = { state: 'paused' }) {
  const callTool = vi.fn(async ({ name }: { name: string }) => {
    const results: Record<string, unknown> = {
      create_debug_session: { sessionId: 'smoke' },
      set_breakpoint: { success: true },
      start_debugging: start,
      wait_for_stop: stop,
      get_local_variables: { variables: [{ name: 'a', value: '1' }, { name: 'b', value: '2' }] },
      close_debug_session: { success: true }
    };
    return { content: [{ type: 'text', text: JSON.stringify(results[name]) }] };
  });
  const client = {
    getProtocolEra: () => 'modern',
    getNegotiatedProtocolVersion: () => '2026-07-28',
    listTools: async () => ({ tools: TOOL_NAMES.map((name) => ({ name })) }),
    callTool
  } as unknown as Client;
  return { client, callTool };
}

describe('modern artifact smoke launch timing', () => {
  it('waits for a delayed breakpoint before reading locals', async () => {
    const { client, callTool } = fixture({ success: true, state: 'running', pending: true });
    await expectModernEraDebugCycle(client, 'simple_test.py');
    expect(callTool.mock.calls.map(([request]) => request.name)).toEqual([
      'create_debug_session', 'set_breakpoint', 'start_debugging',
      'wait_for_stop', 'get_local_variables', 'close_debug_session'
    ]);
    expect(callTool).toHaveBeenCalledWith({
      name: 'wait_for_stop', arguments: { sessionId: 'smoke', timeout: 25_000 }
    });
  });

  it('does not wait again when launch already observed the breakpoint', async () => {
    const { client, callTool } = fixture({ success: true, state: 'paused' });
    await expectModernEraDebugCycle(client, 'simple_test.py');
    expect(callTool.mock.calls.map(([request]) => request.name)).not.toContain('wait_for_stop');
  });

  it.each(['running', 'stopped'])('rejects a wait ending in %s and still closes the session', async (state) => {
    const { client, callTool } = fixture({ success: true, state: 'running', pending: true }, { state });
    await expect(expectModernEraDebugCycle(client, 'simple_test.py')).rejects.toThrow();
    expect(callTool.mock.calls.map(([request]) => request.name)).not.toContain('get_local_variables');
    expect(callTool).toHaveBeenLastCalledWith({
      name: 'close_debug_session', arguments: { sessionId: 'smoke' }
    });
  });
});
