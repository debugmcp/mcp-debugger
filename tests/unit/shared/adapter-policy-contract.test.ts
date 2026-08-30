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
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  DebugLanguage,
  DefaultAdapterPolicy,
  getPolicyForLanguage,
  resolveExceptionFilters,
  type AdapterPolicy,
  type ChildSessionStrategy,
  type ExceptionBreakMode,
  type LocalVariableExtraction,
  type StackFrame,
  type Variable
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
  /** Out-of-band function-breakpoint delivery; `undefined` means the standard DAP request. */
  functionBreakpointsVia: 'dap' | 'cdp' | undefined;
  /** Whether verified:false at launch is by design rather than a warning. */
  functionBreakpointsBindLate: boolean | undefined;
  childSessionStrategy: ChildSessionStrategy;
  requiresCommandQueueing: boolean;
  /**
   * Break-on-exception mode applied to LAUNCH sessions when the user named none.
   * `undefined` means the policy deliberately declines a default.
   */
  defaultExceptionBreakMode: ExceptionBreakMode | undefined;
}

/**
 * What each language's policy declares today. Every field is pinned for every language — the
 * `undefined`s included — so an adapter that starts declaring one fails a test instead of
 * quietly switching an assertion off.
 *
 * The deviations worth knowing: `javascript -> 'js-debug'` is the one policy name that differs
 * from its language, and the only policy delivering function breakpoints over CDP; ruby is the
 * only adapter with no static function-breakpoint verdict and the only one declining a default
 * exception mode; ruby/java/dotnet are the three that reject logpoints; js and java are the two
 * that bind function breakpoints late.
 */
const PINNED: Record<DebugLanguage, PinnedCapabilities> = {
  [DebugLanguage.PYTHON]: {
    policyName: 'python',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    functionBreakpointsVia: undefined,
    functionBreakpointsBindLate: undefined,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false,
    defaultExceptionBreakMode: 'uncaught'
  },
  [DebugLanguage.RUBY]: {
    policyName: 'ruby',
    supportsFunctionBreakpoints: undefined,
    supportsLogPoints: false,
    functionBreakpointsVia: undefined,
    functionBreakpointsBindLate: undefined,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false,
    defaultExceptionBreakMode: undefined
  },
  [DebugLanguage.JAVASCRIPT]: {
    policyName: 'js-debug',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    functionBreakpointsVia: 'cdp',
    functionBreakpointsBindLate: true,
    childSessionStrategy: 'launchWithPendingTarget',
    requiresCommandQueueing: true,
    defaultExceptionBreakMode: 'uncaught'
  },
  [DebugLanguage.RUST]: {
    policyName: 'rust',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    functionBreakpointsVia: undefined,
    functionBreakpointsBindLate: undefined,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false,
    defaultExceptionBreakMode: 'uncaught'
  },
  [DebugLanguage.GO]: {
    policyName: 'go',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    functionBreakpointsVia: undefined,
    functionBreakpointsBindLate: undefined,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false,
    defaultExceptionBreakMode: 'uncaught'
  },
  [DebugLanguage.JAVA]: {
    policyName: 'java',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: false,
    functionBreakpointsVia: undefined,
    functionBreakpointsBindLate: true,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false,
    defaultExceptionBreakMode: 'uncaught'
  },
  [DebugLanguage.DOTNET]: {
    policyName: 'dotnet',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: false,
    functionBreakpointsVia: undefined,
    functionBreakpointsBindLate: undefined,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false,
    defaultExceptionBreakMode: 'uncaught'
  },
  [DebugLanguage.CPP]: {
    policyName: 'cpp',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    functionBreakpointsVia: undefined,
    functionBreakpointsBindLate: undefined,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false,
    defaultExceptionBreakMode: 'uncaught'
  },
  [DebugLanguage.MOCK]: {
    policyName: 'mock',
    supportsFunctionBreakpoints: true,
    supportsLogPoints: true,
    functionBreakpointsVia: undefined,
    functionBreakpointsBindLate: undefined,
    childSessionStrategy: 'none',
    requiresCommandQueueing: false,
    defaultExceptionBreakMode: 'uncaught'
  }
};

const LANGUAGES = Object.values(DebugLanguage);

/** What every policy must return when it cannot name a scope it read locals from. */
const EMPTY_EXTRACTION: LocalVariableExtraction = { variables: [], scopeRefs: [] };

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
    expect(policy.functionBreakpointsVia).toBe(pinned.functionBreakpointsVia);
    expect(policy.functionBreakpointsBindLate).toBe(pinned.functionBreakpointsBindLate);

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

    // Pinned for every language, ruby's deliberate `undefined` included — guarding this on
    // "if defined" is how it would stop testing anything the day a policy dropped the field.
    expect(behavior.defaultExceptionBreakMode).toBe(pinned.defaultExceptionBreakMode);

    if (behavior.defaultExceptionBreakMode !== undefined) {
      // Only launch sessions get a default, and 'uncaught' is the only sane one — 'all' would
      // pause on routine caught exceptions, 'none' is what omitting the field already means
      // (and names no filter list at all, which is why the mode has to be one of the two the
      // block above proved are arrays).
      expect(behavior.defaultExceptionBreakMode).toBe('uncaught');
      expect(Array.isArray(filters?.uncaught)).toBe(true);
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

  // ===== 11. Local-variable extraction: the edges =====

  it('returns the empty extraction when there is no scope to read', () => {
    const extract = policy.extractLocalVariables!;
    const frame: StackFrame = { id: 1, name: 'frame', file: 'file.src', line: 1 };

    // No frames at all, a frame whose scopes were never fetched, and a frame
    // whose scope list came back empty. None of the three can name a scope, so
    // none may report one either — `scopeRefs` is what the session layer
    // attributes truncation to, and a ref for a scope that supplied nothing
    // would report another scope's cuts as cuts in this response (issue #438).
    expect(extract([], {}, {})).toEqual(EMPTY_EXTRACTION);
    expect(extract([frame], {}, {})).toEqual(EMPTY_EXTRACTION);
    expect(extract([frame], { [frame.id]: [] }, {})).toEqual(EMPTY_EXTRACTION);
  });

  // ===== 12. Local-variable extraction: the data contract =====

  describe('local-variable extraction', () => {
    const ANCHOR_SCOPE_REF = 500;
    const CALLER_SCOPE_REF = 600;
    const anchor: StackFrame = { id: 1, name: 'anchor', file: 'anchor.src', line: 10 };
    const caller: StackFrame = { id: 2, name: 'caller', file: 'caller.src', line: 20 };

    // The policy's own first choice of local-scope name, so this fixture is
    // one every adapter recognises without the test knowing which.
    const localScopeName = normaliseScopeNames(policy)[0];
    const scopes: Record<number, DebugProtocol.Scope[]> = {
      [anchor.id]: [
        { name: localScopeName, variablesReference: ANCHOR_SCOPE_REF, expensive: false }
      ],
      [caller.id]: [
        { name: localScopeName, variablesReference: CALLER_SCOPE_REF, expensive: false }
      ]
    };

    // 'alpha' survives every policy's filter. The dunder is filtered by some
    // (python, go, LLDB) and kept by others, which is what makes it a usable
    // probe for the includeSpecial rule below without hard-coding a verdict.
    const plain: Variable = { name: 'alpha', value: '1', type: 'int', expandable: false };
    const specialish: Variable = { name: '__probe__', value: '2', type: 'int', expandable: false };
    const variables: Record<number, Variable[]> = {
      [ANCHOR_SCOPE_REF]: [plain, specialish],
      [CALLER_SCOPE_REF]: [{ name: 'callerOnly', value: '3', type: 'int', expandable: false }]
    };

    const extract = (frames: StackFrame[], includeSpecial?: boolean): LocalVariableExtraction =>
      policy.extractLocalVariables!(frames, scopes, variables, includeSpecial);

    it('returns the input variable objects and names the scope they came from', () => {
      const result = extract([anchor]);

      expect(result.variables.length).toBeGreaterThan(0);
      // Identity, not a copy: `toContain` compares by reference. The session
      // layer no longer relies on this, but a policy that rebuilt variables
      // would be silently dropping fields it does not know about.
      for (const variable of result.variables) {
        expect(variables[ANCHOR_SCOPE_REF]).toContain(variable);
      }

      expect(result.scopeRefs).toEqual([ANCHOR_SCOPE_REF]);
      const anchorRefs = scopes[anchor.id].map((scope) => scope.variablesReference);
      for (const ref of result.scopeRefs) {
        expect(anchorRefs).toContain(ref);
      }
    });

    it('anchors on the first frame and ignores the frames below it', () => {
      // The session layer re-anchors by slicing the frame list (issue #468);
      // that only works while a policy reads frames[0] and nothing else.
      expect(extract([anchor, caller])).toEqual(extract([anchor]));
    });

    it('never hides a variable that includeSpecial:false already returned', () => {
      const plainResult = extract([anchor], false);
      const specialResult = extract([anchor], true);

      for (const variable of plainResult.variables) {
        expect(specialResult.variables).toContain(variable);
      }
      expect(specialResult.variables.length).toBeGreaterThanOrEqual(plainResult.variables.length);
    });

    it('reports no scope when the scope held no variables', () => {
      expect(policy.extractLocalVariables!([anchor], scopes, {})).toEqual(EMPTY_EXTRACTION);
    });
  });
});
