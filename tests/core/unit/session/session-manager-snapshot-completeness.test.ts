import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../../../src/session/session-manager.js';
import type { LocalVariablesResult } from '../../../../src/session/session-manager-data.js';
import { DebugLanguage, JsDebugAdapterPolicy, type AdapterPolicy } from '@debugmcp/shared';
import { createMockDependencies, createMockEnvironment } from './session-manager-test-utils.js';

describe('snapshot completeness after a failed local scope read', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it.each(['throw', 'rejected response', 'missing body'])(
    'does not call an unread block variable gone and new again after %s', async (failure) => {
    const dependencies = createMockDependencies();
    dependencies.environment = createMockEnvironment({ DEBUG_MCP_NO_REDACT: '' });
    const manager = new SessionManager({
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true }
    }, dependencies);
    const session = await manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    await manager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    dependencies.mockProxyManager.simulateStopped(1, 'entry');
    const internals = manager as unknown as { selectPolicy(language: string): AdapterPolicy };
    const policy = internals.selectPolicy('mock');
    internals.selectPolicy = () => ({ ...policy, extractLocalVariables: JsDebugAdapterPolicy.extractLocalVariables, getLocalScopeName: JsDebugAdapterPolicy.getLocalScopeName });
    let blockFails = false;
    let blockEmpty = false;
    let lowerScopesFail = false;
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: any) => {
      if (command === 'stackTrace') return { success: true, body: { stackFrames: [1, 2].map(id => ({
        id, name: id === 1 ? 'main' : 'caller', source: { path: 'test.py' }, line: 10, column: 0
      })) } };
      if (command === 'scopes' && args.frameId === 2) {
        if (lowerScopesFail) throw new Error('caller scopes unavailable');
        return { success: true, body: { scopes: [] } };
      }
      if (command === 'scopes') return { success: true, body: { scopes: [
        { name: 'Block', variablesReference: 100, expensive: false },
        { name: 'Local', variablesReference: 101, expensive: false }
      ] } };
      if (command === 'variables') {
        if (args.variablesReference === 100 && blockFails) {
          if (failure === 'throw') throw new Error('temporary scope read failure');
          if (failure === 'rejected response') return { success: false, message: 'scope unavailable' };
          return { success: true };
        }
        if (args.variablesReference === 100 && blockEmpty) return { success: true, body: { variables: [] } };
        return { success: true, body: { variables: [{ name: args.variablesReference === 100 ? 'i' : 'x', value: '1', type: 'int', variablesReference: 0 }] } };
      }
      return { success: true, args };
    });
    const step = async () => {
      const pending = manager.stepOver(session.id);
      await vi.advanceTimersByTimeAsync(20);
      dependencies.mockProxyManager.simulateStopped(1, 'step');
      await vi.advanceTimersByTimeAsync(30);
      return pending;
    };
    const first = await step();
    expect(first.data?.snapshot?.locals).toEqual({ i: '1', x: '1' });
    blockFails = true;
    const failedRead = await step();
    expect(failedRead.data?.snapshot?.changedVariables).toEqual({});
    expect(failedRead.data?.snapshot?.note).toContain('could not be read');
    blockFails = false;
    const recovered = await step();
    expect(recovered.data?.snapshot?.changedVariables?.i).toEqual({ after: '1' });
    expect(recovered.data?.snapshot?.note).toBeUndefined();
    // A successful empty response is evidence of absence, unlike a failure.
    // An unused caller's failed discovery must not obscure the top frame.
    blockEmpty = true;
    lowerScopesFail = true;
    const leftScope = await step();
    expect(leftScope.data?.snapshot?.changedVariables).toEqual({ i: { before: '1', gone: true } });
    expect(leftScope.data?.snapshot?.note).toBeUndefined();
  });

  it.each(['throw', 'rejected response', 'missing body'])(
    'does not treat failed scope discovery as an empty recursive frame after %s', async (failure) => {
    const dependencies = createMockDependencies();
    dependencies.environment = createMockEnvironment({ DEBUG_MCP_NO_REDACT: '' });
    const manager = new SessionManager({
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true }
    }, dependencies);
    const session = await manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    await manager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    dependencies.mockProxyManager.simulateStopped(1, 'entry');
    let topScopesFail = false;
    let topScopesEmpty = false;
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: any) => {
      if (command === 'stackTrace') return { success: true, body: { stackFrames: [1, 2].map(id => ({
        id, name: 'recurse', source: { path: 'test.py' }, line: 10, column: 0
      })) } };
      if (command === 'scopes') {
        if (args.frameId === 1 && topScopesFail) {
          if (failure === 'throw') throw new Error('temporary scope discovery failure');
          if (failure === 'rejected response') return { success: false, message: 'scopes unavailable' };
          return { success: true };
        }
        return { success: true, body: { scopes: args.frameId === 1 && topScopesEmpty ? [] : [
          { name: 'Locals', variablesReference: 100 + args.frameId, expensive: false }
        ] } };
      }
      if (command === 'variables') return { success: true, body: { variables:
        (args.variablesReference === 101 ? ['i', 'x'] : ['x']).map(name => ({
          name, value: '1', type: 'int', variablesReference: 0
        }))
      } };
      return { success: true, args };
    });
    const step = async () => {
      const pending = manager.stepOver(session.id);
      await vi.advanceTimersByTimeAsync(20);
      dependencies.mockProxyManager.simulateStopped(1, 'step');
      await vi.advanceTimersByTimeAsync(30);
      return pending;
    };
    const first = await step();
    expect(first.data?.snapshot?.locals).toEqual({ i: '1', x: '1' });
    topScopesFail = true;
    const failedRead = await step();
    expect(failedRead.data?.snapshot?.changedVariables).toEqual({});
    expect(failedRead.data?.snapshot?.note).toContain('could not be read');
    topScopesFail = false;
    const recovered = await step();
    expect(recovered.data?.snapshot?.changedVariables?.i).toEqual({ after: '1' });
    expect(recovered.data?.snapshot?.note).toBeUndefined();
    topScopesEmpty = true;
    expect(await manager.getScopes(session.id, 1)).toEqual([]);
    const successfulEmpty = await manager.getLocalVariables(session.id) as LocalVariablesResult;
    expect(successfulEmpty.incomplete).toBeUndefined();
    expect(successfulEmpty.anchorNote).not.toContain('could not be read');
  });
});
