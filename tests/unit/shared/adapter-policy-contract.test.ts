/**
 * Cross-policy contract test.
 *
 * Nine `AdapterPolicy` implementations satisfy one interface, and until now each was tested
 * only on its own terms — the rules that must hold for *every* policy lived in doc comments
 * on `adapter-policy.ts` and in the head of whoever added a language last. A tenth adapter
 * can currently ship with, say, `functionBreakpointsVia: 'cdp'` and no
 * `supportsFunctionBreakpoints`, and nothing complains until a user hits it.
 *
 * These assertions run against the REAL policies via `getPolicyForLanguage` — no mocks — so
 * they double as a description of what a new policy has to provide.
 *
 * The pinned capability table is deliberately a duplicate of what the policies declare: a
 * capability flipping is a user-visible behaviour change (it gates `set_breakpoint` up front),
 * so it should require editing this table on purpose rather than passing silently.
 */
import { describe, it, expect } from 'vitest';
import {
  DebugLanguage,
  DefaultAdapterPolicy,
  getPolicyForLanguage,
  resolveExceptionFilters,
  type AdapterPolicy,
  type ChildSessionStrategy,
  type ExceptionBreakMode
} from '@debugmcp/shared';

/** The abstract break-on-exception modes `resolveExceptionFilters` accepts. */
const EXCEPTION_MODES: ExceptionBreakMode[] = ['none', 'uncaught', 'all'];

interface PinnedCapabilities {
  /** `policy.name` — the diagnostics identifier. */
  policyName: string;
  /** Static function-breakpoint verdict; `undefined` means "unknown, re-check live". */
  supportsFunctionBreakpoints: boolean | undefined;
  /** Static logpoint verdict; `undefined` means "unknown, re-check live". */
  supportsLogPoints: boolean | undefined;
  childSessionStrategy: ChildSessionStrategy;
  requiresCommandQueueing: boolean;
}

/**
 * What each language's policy declares today. `javascript -> 'js-debug'` is the one place a
 * policy name deviates from its language; ruby is the one adapter with no static
 * function-breakpoint verdict, and ruby/java/dotnet are the three that reject logpoints.
 */
const PINNED: Record<DebugLanguage, PinnedCapabilities> = {
  [DebugLanguage.PYTHON]: {
    policyName: 'python',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false
  },
  [DebugLanguage.RUBY]: {
    policyName: 'ruby',
    supportsFunctionBreakpoints: undefined,
    supportsLogPoints: false,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false
  },
  [DebugLanguage.JAVASCRIPT]: {
    policyName: 'js-debug',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    childSessionStrategy: 'launchWithPendingTarget',
    requiresCommandQueueing: true
  },
  [DebugLanguage.RUST]: {
    policyName: 'rust',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false
  },
  [DebugLanguage.GO]: {
    policyName: 'go',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false
  },
  [DebugLanguage.JAVA]: {
    policyName: 'java',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: false,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false
  },
  [DebugLanguage.DOTNET]: {
    policyName: 'dotnet',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: false,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false
  },
  [DebugLanguage.CPP]: {
    policyName: 'cpp',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false
  },
  [DebugLanguage.MOCK]: {
    policyName: 'mock',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false
  }
};

const LANGUAGES = Object.values(DebugLanguage);

/** `getLocalScopeName()` may return one name or several; callers treat both as a list. */
function normaliseScopeNames(policy: AdapterPolicy): string[] {
  const names = policy.getLocalScopeName?.();
  if (names === undefined) return [];
  return Array.isArray(names) ? names : [names];
}

describe('AdapterPolicy contract — dispatch', () => {
  it('maps every DebugLanguage to a real policy, never the placeholder', () => {
    for (const language of LANGUAGES) {
      const policy = getPolicyForLanguage(language);
      expect(policy, language).not.toBe(DefaultAdapterPolicy);
      expect(policy.name, language).not.toBe('default');
    }
  });

  it('gives every policy a unique name', () => {
    const names = LANGUAGES.map((language) => getPolicyForLanguage(language).name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('falls back to DefaultAdapterPolicy for an unknown language', () => {
    expect(getPolicyForLanguage('klingon')).toBe(DefaultAdapterPolicy);
  });
});

describe.each(LANGUAGES)('AdapterPolicy contract — %s', (language) => {
  const policy = getPolicyForLanguage(language);
  const pinned = PINNED[language];

  // ===== 1. Identity =====

  it('declares the pinned policy name', () => {
    expect(policy.name).toBe(pinned.policyName);
  });

  // ===== 2. Reverse startDebugging is exactly "has a child session strategy" =====

  it('ties supportsReverseStartDebugging to childSessionStrategy', () => {
    expect(policy.childSessionStrategy).toBe(pinned.childSessionStrategy);
    expect(policy.supportsReverseStartDebugging).toBe(policy.childSessionStrategy !== 'none');
  });

  // ===== 3. Command queueing is all-or-nothing =====

  it('pairs command queueing with the handshake it implies', () => {
    // A policy that queues commands owns the whole DAP start sequence: the proxy worker's
    // built-in launch/attach flow does not run for it, so performHandshake is mandatory, and
    // the queue it built has to be drained by processQueuedCommands.
    expect(policy.requiresCommandQueueing()).toBe(pinned.requiresCommandQueueing);
    expect(Boolean(policy.performHandshake)).toBe(policy.requiresCommandQueueing());
    expect(Boolean(policy.processQueuedCommands)).toBe(policy.requiresCommandQueueing());
  });

  // ===== 4. Breakpoint capabilities =====

  it('declares the pinned breakpoint capabilities', () => {
    expect(policy.supportsFunctionBreakpoints).toBe(pinned.supportsFunctionBreakpoints);
    expect(policy.supportsLogPoints).toBe(pinned.supportsLogPoints);
  });

  it('only claims a function-breakpoint delivery quirk when it supports them at all', () => {
    // 'cdp' delivery means our proxy arms them out of band, and bind-late means verified:false
    // at launch is expected — both are refinements of "supported", not substitutes for it.
    if (policy.functionBreakpointsVia === 'cdp') {
      expect(policy.supportsFunctionBreakpoints).toBe(true);
    }
    if (policy.functionBreakpointsBindLate) {
      expect(policy.supportsFunctionBreakpoints).toBe(true);
    }
  });

  // ===== 5. Initialization behavior =====

  it('returns a well-formed initialization behavior', () => {
    const behavior = policy.getInitializationBehavior();
    expect(behavior).toBeTypeOf('object');

    // Both modes must name a list. The list may legitimately be empty — cpp has no
    // uncaught-only LLDB filter — which the session layer reads as "mode unsupported here".
    const filters = behavior.exceptionFilters;
    expect(filters, 'every policy declares exception filters').toBeDefined();
    expect(Array.isArray(filters?.uncaught)).toBe(true);
    expect(Array.isArray(filters?.all)).toBe(true);

    if (behavior.defaultExceptionBreakMode !== undefined) {
      // Only launch sessions get a default, and 'uncaught' is the only sane one — 'all' would
      // pause on routine caught exceptions, 'none' is what omitting the field already means
      // (and names no filter list at all).
      expect(behavior.defaultExceptionBreakMode).toBe('uncaught');
    }
  });

  it('resolves every exception mode to an array of filter ids', () => {
    for (const mode of EXCEPTION_MODES) {
      const resolved = resolveExceptionFilters(policy, mode);
      expect(Array.isArray(resolved), mode).toBe(true);
      for (const filter of resolved) expect(typeof filter).toBe('string');
    }
    expect(resolveExceptionFilters(policy, 'none')).toEqual([]);
    expect(resolveExceptionFilters(policy, undefined)).toEqual([]);
  });

  // ===== 6. Local-variable extraction =====

  it('implements local-variable extraction and names its local scopes', () => {
    // The session layer's get_local_variables path calls both; a policy missing either
    // silently degrades to the generic scope scan.
    expect(policy.extractLocalVariables).toBeTypeOf('function');
    expect(policy.getLocalScopeName).toBeTypeOf('function');

    const names = normaliseScopeNames(policy);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  // ===== 7. Configuration surfaces =====

  it('returns usable configuration objects', () => {
    const dapConfig = policy.getDapAdapterConfiguration();
    expect(dapConfig.type).toBeTypeOf('string');
    expect(dapConfig.type.length).toBeGreaterThan(0);

    expect(policy.getDebuggerConfiguration()).toBeTypeOf('object');

    const clientBehavior = policy.getDapClientBehavior();
    expect(clientBehavior).toBeTypeOf('object');
    if (clientBehavior.childInitTimeout !== undefined) {
      expect(clientBehavior.childInitTimeout).toBeGreaterThan(0);
    }

    const attachBehavior = policy.getAttachBehavior?.();
    if (attachBehavior !== undefined) {
      for (const value of Object.values(attachBehavior)) {
        expect(typeof value).toBe('boolean');
      }
    }
  });

  // ===== 8. State lifecycle =====

  it('creates a fresh, uninitialized state on every call', () => {
    const first = policy.createInitialState();
    const second = policy.createInitialState();

    // Shared state would leak one session's progress into the next.
    expect(first).not.toBe(second);
    expect(first.initialized).toBe(false);
    expect(first.configurationDone).toBe(false);

    expect(policy.isInitialized(first)).toBe(false);
    expect(policy.isConnected(first)).toBe(false);
  });

  // ===== 9. Executable resolution =====

  it('honours an explicitly provided executable path', () => {
    expect(policy.resolveExecutablePath('/explicit/bin')).toBe('/explicit/bin');
  });

  // ===== 10. Adapter matching =====

  it('does not match an empty adapter command', () => {
    expect(policy.matchesAdapter({ command: '', args: [] })).toBe(false);
  });
});
