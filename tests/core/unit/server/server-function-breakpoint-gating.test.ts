/**
 * set_breakpoint function-breakpoint gating tests (issue #271, phase 3).
 *
 * Hybrid gating with one deliberate difference from logpoint gating: the
 * STATIC policy verdict is checked BEFORE live adapter capabilities. The
 * policy encodes what the adapter and our plumbing can actually deliver, so
 * an explicit policy false must win over whatever live capabilities claim
 * (they can drift, as js-debug's hand-written TS metadata once did).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getToolHandlers
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('set_breakpoint function gating (#271 phase 3)', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;
  let listToolsHandler: any;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });
    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });

    new DebugMcpServer();
    const handlers = getToolHandlers(mockServer);
    callToolHandler = handlers.callToolHandler;
    listToolsHandler = handlers.listToolsHandler;

    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active'
    });
    mockSessionManager.setFunctionBreakpoint.mockResolvedValue({
      breakpoint: {
        id: 'fbp-1',
        functionName: 'load_prices',
        verified: false
      }
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function callSetFunctionBreakpoint(extra: Record<string, unknown> = {}) {
    return callToolHandler({
      method: 'tools/call',
      params: {
        name: 'set_breakpoint',
        arguments: {
          sessionId: 'test-session',
          function: 'load_prices',
          ...extra
        }
      }
    });
  }

  it('rejects when the adapter policy declares no function-breakpoint support', async () => {
    // Synthetic language: real adapters that gate function breakpoints off
    // (js-debug) carry their own reason string, tested below
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'unsupported-lang', supportsFunctionBreakpoints: false });

    await expect(callSetFunctionBreakpoint()).rejects.toThrow(/[Ff]unction breakpoint/);
    expect(mockSessionManager.setFunctionBreakpoint).not.toHaveBeenCalled();
  });

  it('rejects on policy false even when live capabilities advertise support (policy beats live caps)', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'unsupported-lang', supportsFunctionBreakpoints: false });
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active',
      adapterCapabilities: { supportsFunctionBreakpoints: true }
    });

    await expect(callSetFunctionBreakpoint()).rejects.toThrow(/[Ff]unction breakpoint/);
    expect(mockSessionManager.setFunctionBreakpoint).not.toHaveBeenCalled();
  });

  it('rejects on policy false regardless of a cdp delivery marker', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({
      name: 'unsupported-lang',
      supportsFunctionBreakpoints: false,
      functionBreakpointsVia: 'cdp'
    });

    await expect(callSetFunctionBreakpoint()).rejects.toThrow(/[Ff]unction breakpoint/);
    expect(mockSessionManager.setFunctionBreakpoint).not.toHaveBeenCalled();
  });

  it('accepts policy true + via cdp even when live capabilities deny support (js-debug, issue #295)', async () => {
    // js-debug's initialize response always reports supportsFunctionBreakpoints
    // false — irrelevant, because the CDP bridge delivers them out of band.
    mockSessionManager.getSessionPolicy.mockReturnValue({
      name: 'js-debug',
      supportsFunctionBreakpoints: true,
      functionBreakpointsVia: 'cdp'
    });
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active',
      language: 'javascript',
      adapterCapabilities: { supportsFunctionBreakpoints: false }
    });

    const result = await callSetFunctionBreakpoint();
    expect(mockSessionManager.setFunctionBreakpoint).toHaveBeenCalled();
    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
  });

  it('still rejects policy true + DAP delivery when live capabilities deny support (real adapter regression)', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({
      name: 'python',
      supportsFunctionBreakpoints: true
    });
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active',
      adapterCapabilities: { supportsFunctionBreakpoints: false }
    });

    await expect(callSetFunctionBreakpoint()).rejects.toThrow(/did not advertise/);
    expect(mockSessionManager.setFunctionBreakpoint).not.toHaveBeenCalled();
  });

  it('rejects when live capabilities deny support and policy is silent', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'ruby' });
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active',
      adapterCapabilities: { supportsFunctionBreakpoints: false }
    });

    await expect(callSetFunctionBreakpoint()).rejects.toThrow(/[Ff]unction breakpoint/);
  });

  it('forwards when the policy supports function breakpoints', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'python', supportsFunctionBreakpoints: true });

    const result = await callSetFunctionBreakpoint({ condition: 'x > 1' });

    expect(mockSessionManager.setFunctionBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ functionName: 'load_prices', condition: 'x > 1' })
    );
    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.functionName).toBe('load_prices');
  });

  it('accepts with a warning when support is unknown pre-launch', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'ruby' });

    const result = await callSetFunctionBreakpoint();

    expect(mockSessionManager.setFunctionBreakpoint).toHaveBeenCalled();
    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.warning).toMatch(/unknown|not advertise/i);
  });

  it('hard-errors the function param outside content mode, naming the env value', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'assert');
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'python', supportsFunctionBreakpoints: true });

    await expect(callSetFunctionBreakpoint()).rejects.toThrow(/DEBUG_MCP_BP_ADDRESSING=assert/);
    expect(mockSessionManager.setFunctionBreakpoint).not.toHaveBeenCalled();
  });

  it('exposes the function param in the schema only in content mode', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'assert');
    let res = await listToolsHandler({ method: 'tools/list', params: {} });
    let tool = res.tools.find((t: { name: string }) => t.name === 'set_breakpoint');
    expect(tool.inputSchema.properties.function).toBeUndefined();

    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'content');
    res = await listToolsHandler({ method: 'tools/list', params: {} });
    tool = res.tools.find((t: { name: string }) => t.name === 'set_breakpoint');
    expect(tool.inputSchema.properties.function).toBeDefined();
    expect(tool.inputSchema.required).toEqual(['sessionId']);
  });
});

describe('set_breakpoint function-name normalization (issue #467)', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let callToolHandler: any;

  beforeEach(() => {
    const mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });
    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });
    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });
    new DebugMcpServer();
    callToolHandler = getToolHandlers(mockServer).callToolHandler;
    mockSessionManager.getSession.mockReturnValue({ id: 'test-session', sessionLifecycle: 'active' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function callFn(name: string) {
    return callToolHandler({
      method: 'tools/call',
      params: {
        name: 'set_breakpoint',
        arguments: { sessionId: 'test-session', function: name }
      }
    });
  }

  it('rewrites a policy-certain never-binding name and says so', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({
      name: 'go',
      supportsFunctionBreakpoints: true,
      normalizeFunctionBreakpointName: (name: string) =>
        name === 'main' ? { name: 'main.main', note: 'Auto-qualified to main.main' } : undefined
    });
    mockSessionManager.setFunctionBreakpoint.mockResolvedValue({
      breakpoint: { id: 'fbp-2', functionName: 'main.main', verified: false }
    });

    const result = await callFn('main');
    const content = JSON.parse(result.content[0].text);

    expect(mockSessionManager.setFunctionBreakpoint).toHaveBeenCalledWith(
      'test-session', { functionName: 'main.main', condition: undefined }
    );
    expect(content.functionName).toBe('main.main');
    expect(content.requestedName).toBe('main');
    expect(content.warning).toContain('Auto-qualified');
  });

  it('keeps the advisory hint for names without a certain rewrite', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({
      name: 'go',
      supportsFunctionBreakpoints: true,
      normalizeFunctionBreakpointName: () => undefined,
      functionBreakpointNameHint: (name: string) =>
        name.includes('.') ? undefined : `bare '${name}' may never bind`
    });
    mockSessionManager.setFunctionBreakpoint.mockResolvedValue({
      breakpoint: { id: 'fbp-3', functionName: 'helper', verified: false }
    });

    const result = await callFn('helper');
    const content = JSON.parse(result.content[0].text);

    expect(mockSessionManager.setFunctionBreakpoint).toHaveBeenCalledWith(
      'test-session', { functionName: 'helper', condition: undefined }
    );
    expect(content.requestedName).toBeUndefined();
    expect(content.warning).toContain("bare 'helper' may never bind");
  });
});

describe('GoAdapterPolicy.normalizeFunctionBreakpointName (issue #467)', () => {
  it("rewrites bare 'main' to 'main.main' and leaves other names alone", async () => {
    const { GoAdapterPolicy } = await import('@debugmcp/shared');
    expect(GoAdapterPolicy.normalizeFunctionBreakpointName?.('main')?.name).toBe('main.main');
    expect(GoAdapterPolicy.normalizeFunctionBreakpointName?.('helper')).toBeUndefined();
    expect(GoAdapterPolicy.normalizeFunctionBreakpointName?.('main.main')).toBeUndefined();
  });
});
