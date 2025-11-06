import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JavascriptDebugAdapter } from '../../src/index.js';
import {
  DebugFeature,
} from '@debugmcp/shared';

// Minimal AdapterDependencies stub
const deps = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

describe('JavascriptDebugAdapter capabilities and error helpers', () => {
  let adapter: JavascriptDebugAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    adapter = new JavascriptDebugAdapter(deps);
  });

  it('supportsFeature returns true for expected features', () => {
    const supported: DebugFeature[] = [
      DebugFeature.CONDITIONAL_BREAKPOINTS,
      DebugFeature.FUNCTION_BREAKPOINTS,
      DebugFeature.EXCEPTION_BREAKPOINTS,
      DebugFeature.EVALUATE_FOR_HOVERS,
      DebugFeature.SET_VARIABLE,
      DebugFeature.LOG_POINTS,
      DebugFeature.EXCEPTION_INFO_REQUEST,
      DebugFeature.LOADED_SOURCES_REQUEST
    ];
    for (const f of supported) {
      expect(adapter.supportsFeature(f)).toBe(true);
    }

    const unsupported: DebugFeature[] = [
      DebugFeature.DATA_BREAKPOINTS,
      DebugFeature.DISASSEMBLE_REQUEST,
      DebugFeature.TERMINATE_THREADS_REQUEST,
      DebugFeature.DELAYED_STACK_TRACE_LOADING,
      DebugFeature.STEP_BACK,
      DebugFeature.REVERSE_DEBUGGING,
      DebugFeature.STEP_IN_TARGETS_REQUEST,
      DebugFeature.SET_EXPRESSION,
      DebugFeature.RESTART_REQUEST,
      DebugFeature.EXCEPTION_OPTIONS
    ];
    for (const f of unsupported) {
      expect(adapter.supportsFeature(f)).toBe(false);
    }
  });

  it('getCapabilities exposes expected js-debug flags and filters', () => {
    const caps = adapter.getCapabilities();
    expect(caps.supportsConfigurationDoneRequest).toBe(true);
    expect(caps.supportsFunctionBreakpoints).toBe(true);
    expect(caps.supportsConditionalBreakpoints).toBe(true);
    expect(caps.supportsEvaluateForHovers).toBe(true);
    expect(caps.supportsLoadedSourcesRequest).toBe(true);
    expect(caps.supportsLogPoints).toBe(true);
    expect(caps.supportsExceptionInfoRequest).toBe(true);
    expect(caps.supportsTerminateRequest).toBe(true);
    expect(caps.supportsBreakpointLocationsRequest).toBe(true);

    // Exception filters: uncaught and userUnhandled
    expect(Array.isArray(caps.exceptionBreakpointFilters)).toBe(true);
    const filters = caps.exceptionBreakpointFilters || [];
    const uncaught = filters.find(f => f.filter === 'uncaught');
    const userUnhandled = filters.find(f => f.filter === 'userUnhandled');
    expect(uncaught?.default).toBe(true);
    expect(userUnhandled?.default).toBe(false);
  });

  it('getFeatureRequirements returns minimal requirements for log points', () => {
    const reqs = adapter.getFeatureRequirements(DebugFeature.LOG_POINTS);
    expect(Array.isArray(reqs)).toBe(true);
    // Contains a version requirement note
    expect(reqs.some(r => r.type === 'version')).toBe(true);
  });

  it('getInstallationInstructions includes Node.js, vendor command, and TS runners', () => {
    const s = adapter.getInstallationInstructions();
    expect(s).toMatch(/nodejs\.org/i);
    expect(s).toMatch(/pnpm -w -F @debugmcp\/adapter-javascript run build:adapter/i);
    expect(s).toMatch(/tsx\s+ts-node\s+tsconfig-paths/i);
  });

  it('getMissingExecutableError provides actionable guidance', () => {
    const msg = adapter.getMissingExecutableError();
    expect(msg).toMatch(/Node\.js runtime not found/i);
    expect(msg).toMatch(/nodejs\.org/i);
    expect(msg).toMatch(/PATH/i);
  });

  it('translateErrorMessage maps ENOENT, EACCES, and ts-node/tsx missing cases', () => {
    // ENOENT -> missing runtime
    const enoent = new Error('spawn node ENOENT');
    expect(adapter.translateErrorMessage(enoent)).toMatch(/Node\.js runtime not found/i);

    // EACCES -> permission denied
    const eacces = new Error('EACCES: permission denied');
    expect(adapter.translateErrorMessage(eacces)).toMatch(/Permission denied/i);

    // ts-node missing
    const tsnodeMissing = new Error("Cannot find module 'ts-node'");
    expect(adapter.translateErrorMessage(tsnodeMissing)).toMatch(/Install tsx or ts-node/i);

    // txs missing (alternate spelling in message)
    const tsxMissing = new Error("Cannot find module 'tsx'");
    expect(adapter.translateErrorMessage(tsxMissing)).toMatch(/Install tsx or ts-node/i);

    // passthrough for other messages
    const other = new Error('some other error');
    expect(adapter.translateErrorMessage(other)).toBe('some other error');
  });
});
