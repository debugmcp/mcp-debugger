import { describe, it, expect } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { JsDebugAdapterPolicy, JS_SCOPE_KINDS } from '../../src/interfaces/adapter-policy-js.js';
import type { Variable } from '../../src/models/index.js';

function createStackFrame(id: number, file: string): DebugProtocol.StackFrame & { file: string } {
  return {
    id,
    name: `frame-${id}`,
    line: 1,
    column: 1,
    file,
  };
}

/** A `Variable` as the policy signature declares it, not the DAP wire shape. */
function v(name: string, value: string): Variable {
  return { name, value, type: 'any', expandable: false };
}

describe('JsDebugAdapterPolicy', () => {
  describe('buildChildStartArgs', () => {
    it('builds attach command with pending target id', () => {
      const args = JsDebugAdapterPolicy.buildChildStartArgs('pending-1', { type: 'pwa-node' });
      expect(args.command).toBe('attach');
      expect(args.args).toMatchObject({
        request: 'attach',
        __pendingTargetId: 'pending-1',
        continueOnAttach: true,
      });
    });
  });

  describe('normalizeStopReason', () => {
    const normalize = JsDebugAdapterPolicy.normalizeStopReason!;
    // js-debug uses the same body for explicit pauses and genuine steps
    const jsDebugPauseBody = {
      reason: 'step',
      description: 'Paused',
      threadId: 0,
      allThreadsStopped: false
    } as DebugProtocol.StoppedEvent['body'];

    it("maps a 'step' stop to 'pause' while a pause request is in flight", () => {
      expect(normalize('step', jsDebugPauseBody, { pausePending: true })).toBe('pause');
    });

    it("leaves a genuine 'step' stop untouched when no pause is pending", () => {
      expect(normalize('step', jsDebugPauseBody, { pausePending: false })).toBeUndefined();
    });

    it('never touches other reasons, even while a pause is pending', () => {
      expect(normalize('breakpoint', { reason: 'breakpoint' }, { pausePending: true })).toBeUndefined();
      expect(normalize('pause', { reason: 'pause' }, { pausePending: true })).toBeUndefined();
      expect(normalize('exception', { reason: 'exception' }, { pausePending: true })).toBeUndefined();
    });
  });

  describe('filterStackFrames', () => {
    it('filters out internal frames but keeps first when all removed', () => {
      const frames = [
        createStackFrame(1, '<node_internals>/lib.js'),
        createStackFrame(2, '/workspace/app.js'),
      ];
      const filtered = JsDebugAdapterPolicy.filterStackFrames!(frames, false);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(2);

      const allInternal = [createStackFrame(3, '<node_internals>/timer.js')];
      const fallback = JsDebugAdapterPolicy.filterStackFrames!(allInternal, false);
      expect(fallback).toHaveLength(1);
      expect(fallback[0].id).toBe(3);
    });
  });

  describe('extractLocalVariables', () => {
    const frame = createStackFrame(1, '/workspace/app.js');

    it('returns empty array when no frames', () => {
      const result = JsDebugAdapterPolicy.extractLocalVariables!([], {}, {});
      expect(result).toEqual({ variables: [], scopeRefs: [] });
    });

    it('filters out special variables by default', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          {
            name: 'Locals',
            variablesReference: 100,
            expensive: false,
          },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [
          v('this', 'ignored'),
          v('__proto__', 'ignored'),
          v('value', '42'),
        ],
      };
      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('value');
    });

    it('includes special variables when requested', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          {
            name: 'Local',
            variablesReference: 200,
            expensive: false,
          },
        ],
      };
      const vars: Record<number, Variable[]> = {
        200: [
          v('this', 'context'),
          v('value', '42'),
        ],
      };
      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars, true);
      expect(result.variables).toHaveLength(2);
    });

    it('falls through an empty Local scope to Module on the same frame (issue #548)', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Local', variablesReference: 100, expensive: false },
          { name: 'Module', variablesReference: 200, expensive: false },
          { name: 'Global', variablesReference: 300, expensive: true },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [],
        200: [v('counter', '46')],
        300: [v('process', 'Process')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['counter']);
    });

    it('prefers Closure over Global when Local is empty (issue #548)', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Local', variablesReference: 100, expensive: false },
          { name: 'Global', variablesReference: 300, expensive: true },
          { name: 'Closure (replay)', variablesReference: 200, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [],
        200: [v('captured', '7')],
        300: [v('process', 'Process')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['captured']);
    });

    it('keeps a non-empty Local scope ahead of sibling scopes', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Local', variablesReference: 100, expensive: false },
          { name: 'Module', variablesReference: 200, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('localValue', '1')],
        200: [v('moduleValue', '2')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['localValue']);
      expect(result.scopeRefs).toEqual([100]);
    });

    it('filters V8 internals before falling through to Global', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Local', variablesReference: 100, expensive: false },
          { name: 'Global', variablesReference: 200, expensive: true },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('[[Scopes]]', 'internal')],
        200: [v('globalValue', '9')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      // A Local scope exists (even if only V8 internals survive filtering), so
      // Global is off the table: an empty answer lets the session layer walk
      // down to the caller frame instead of reporting Node's globals.
      expect(result).toEqual({ variables: [], scopeRefs: [] });
    });

    it('does not fall through to Global past an empty Local scope (issue #548 review)', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Local', variablesReference: 100, expensive: false },
          { name: 'Closure (tick)', variablesReference: 200, expensive: false },
          { name: 'Module', variablesReference: 300, expensive: false },
          { name: 'Global', variablesReference: 400, expensive: true },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [],
        200: [],
        300: [],
        400: [
          v('process', 'Process'),
          v('fetch', 'ƒ fetch()'),
        ],
      };

      expect(JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars)).toEqual({ variables: [], scopeRefs: [] });
    });

    it('uses Global only for a frame that exposes no Local scope at all', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Script', variablesReference: 100, expensive: false },
          { name: 'Global', variablesReference: 200, expensive: true },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [],
        200: [v('globalValue', '9')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['globalValue']);
    });

    it('merges a for-body Block scope ahead of the function locals (issue #558)', () => {
      // js-debug names the scope exactly 'Block', not 'Block:<label>'; V8 lists
      // it before Local, innermost first.
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block', variablesReference: 100, expensive: false },
          { name: 'Local', variablesReference: 200, expensive: false },
          { name: 'Closure', variablesReference: 300, expensive: false },
          { name: 'Global', variablesReference: 400, expensive: true },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('i', '3')],
        200: [v('total', '6'), v('items', 'Array(4)')],
        300: [v('captured', '1')],
        400: [v('globalThis', '{}')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['i', 'total', 'items']);
      // Both scopes are reported, block first, so the session layer can name
      // the canonical Local scope and attribute truncation to either.
      expect(result.scopeRefs).toEqual([100, 200]);
    });

    it("merges the legacy 'Block:<label>' form the same way (issue #558)", () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block:loop', variablesReference: 100, expensive: false },
          { name: 'Local', variablesReference: 200, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('i', '3')],
        200: [v('total', '6')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['i', 'total']);
      expect(result.scopeRefs).toEqual([100, 200]);
    });

    it("merges a catch (e) binding from a 'Catch Block' scope (issue #558)", () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Catch Block', variablesReference: 100, expensive: false },
          { name: 'Local', variablesReference: 200, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('err', 'Error: boom')],
        200: [v('attempt', '2')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['err', 'attempt']);
      expect(result.scopeRefs).toEqual([100, 200]);
    });

    it('merges nested block scopes innermost first (issue #558)', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block', variablesReference: 100, expensive: false },
          { name: 'With Block', variablesReference: 150, expensive: false },
          { name: 'Local', variablesReference: 200, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('inner', '1')],
        150: [v('outer', '2')],
        200: [v('fnLocal', '3')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['inner', 'outer', 'fnLocal']);
      expect(result.scopeRefs).toEqual([100, 150, 200]);
    });

    it('omits a block scope that contributed nothing (issue #558)', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block', variablesReference: 100, expensive: false },
          { name: 'Local', variablesReference: 200, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        // Only V8 internals survive in the block, so it supplies nothing and
        // must not be named as a contributing scope.
        100: [v('[[Scopes]]', '...')],
        200: [v('total', '6')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['total']);
      expect(result.scopeRefs).toEqual([200]);
    });

    it('does not reach Global for a frame whose only scope is a Block (issue #558)', () => {
      // A block scope proves this is not a top-level script frame, so an empty
      // one must not open the Global fall-through (#554 adjudication).
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block', variablesReference: 100, expensive: false },
          { name: 'Global', variablesReference: 400, expensive: true },
        ],
      };
      const vars: Record<number, Variable[]> = {
        400: [v('globalValue', '9')],
      };

      expect(JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars))
        .toEqual({ variables: [], scopeRefs: [] });
    });

    it('merges every block on a frame with no Local scope at all (issue #558)', () => {
      // A `catch (e)` inside a `for (let i...)` with nothing below it. The
      // collecting group takes both blocks; before it, only the first
      // non-empty block was returned and `i` was dropped.
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Catch Block', variablesReference: 100, expensive: false },
          { name: 'Block', variablesReference: 150, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('e', 'Error: boom')],
        150: [v('i', '3')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['e', 'i']);
      expect(result.scopeRefs).toEqual([100, 150]);
    });

    it('adds the module scope as the base when an ESM frame has blocks but no Local (issue #558)', () => {
      // js-debug gives an ESM top-level `for (let i...)` a Block scope with no
      // Local beneath it; the module's own consts are the frame's real base
      // and are what this frame reported before blocks were recognised.
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block', variablesReference: 100, expensive: false },
          { name: 'Module', variablesReference: 300, expensive: false },
          { name: 'Global', variablesReference: 400, expensive: true },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('a', '1')],
        300: [v('total', '6'), v('xs', 'Array(4)')],
        400: [v('globalThis', '{}')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['a', 'total', 'xs']);
      expect(result.scopeRefs).toEqual([100, 300]);
    });

    it('leaves the module scope out of the merge when the frame HAS a Local scope', () => {
      // Module stays a fall-through-only scope for ordinary function frames:
      // the base rule is specific to ESM top-level frames.
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block', variablesReference: 100, expensive: false },
          { name: 'Local', variablesReference: 200, expensive: false },
          { name: 'Module', variablesReference: 300, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('i', '3')],
        200: [v('total', '6')],
        300: [v('moduleValue', '7')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['i', 'total']);
      expect(result.scopeRefs).toEqual([100, 200]);
    });

    it('returns a populated Block-only frame without reaching Global (issue #558)', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block', variablesReference: 100, expensive: false },
          { name: 'Global', variablesReference: 400, expensive: true },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('a', '1')],
        400: [v('globalValue', '9')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['a']);
      expect(result.scopeRefs).toEqual([100]);
    });

    it('keeps an empty Local scope in scopeRefs so it stays nameable (issue #558)', () => {
      // Local holds only `this`, which the default filter drops. It supplied
      // no variables, but it IS the scope the session layer must report, so
      // its ref has to survive - otherwise the response names the block and
      // adds a note blaming Local for a fall-through that never happened.
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block', variablesReference: 100, expensive: false },
          { name: 'Local', variablesReference: 200, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('i', '3')],
        200: [v('this', 'Object')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['i']);
      expect(result.scopeRefs).toEqual([100, 200]);
    });

    it('never lists a shared variablesReference twice', () => {
      // Two sibling scopes pointing at one reference would otherwise duplicate
      // the variables and double-count that scope's truncation.
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Block', variablesReference: 100, expensive: false },
          { name: 'Catch Block', variablesReference: 100, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('i', '3')],
      };

      const result = JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars);

      expect(result.variables.map(variable => variable.name)).toEqual(['i']);
      expect(result.scopeRefs).toEqual([100]);
    });

    it('may select a DIFFERENT scope under includeSpecial:false - not a superset (issue #548)', () => {
      // Intended behaviour, and the reason the contract does not claim
      // includeSpecial:true is a superset: with only `this` in Local, the
      // default filter empties it and the useful binding in Closure is the
      // honest answer; asking for special variables makes Local non-empty
      // again and Local wins. The two answers are about different scopes.
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Local', variablesReference: 100, expensive: false },
          { name: 'Closure', variablesReference: 200, expensive: false },
        ],
      };
      const vars: Record<number, Variable[]> = {
        100: [v('this', 'Object')],
        200: [v('captured', '1')],
      };

      expect(JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars))
        .toEqual({ variables: [vars[200][0]], scopeRefs: [200] });
      expect(JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, vars, true))
        .toEqual({ variables: [vars[100][0]], scopeRefs: [100] });
    });

    it('returns no locals when every useful same-frame scope is empty', () => {
      const scopes: Record<number, DebugProtocol.Scope[]> = {
        1: [
          { name: 'Local', variablesReference: 100, expensive: false },
          { name: 'Closure', variablesReference: 200, expensive: false },
          { name: 'Module', variablesReference: 300, expensive: false },
          { name: 'Global', variablesReference: 400, expensive: true },
        ],
      };

      expect(JsDebugAdapterPolicy.extractLocalVariables!([frame], scopes, {})).toEqual({ variables: [], scopeRefs: [] });
    });
  });

  describe('scope-name table', () => {
    const frame = createStackFrame(1, '/workspace/app.js');

    it('reports exactly the names its extractor matches (issue #558 regression class)', () => {
      // The extractor's predicates and getLocalScopeName() both read
      // JS_SCOPE_KINDS. Commit 4f469d71 shipped a false-note bug because those
      // two disagreed, so pin that they cannot: the reported list IS the table
      // flattened, in the session layer's preference order.
      expect(JsDebugAdapterPolicy.getLocalScopeName!()).toEqual([
        ...JS_SCOPE_KINDS.local,
        ...JS_SCOPE_KINDS.block,
        ...JS_SCOPE_KINDS.closure,
        ...JS_SCOPE_KINDS.module
      ]);
    });

    it('names every local-like scope it will merge, and merges every one it names', () => {
      const reported = JsDebugAdapterPolicy.getLocalScopeName!() as string[];
      const localLike = [...JS_SCOPE_KINDS.local, ...JS_SCOPE_KINDS.block];

      for (const name of localLike) {
        expect(reported).toContain(name);

        // And the extractor really treats a scope of that name as local-like:
        // a Global sibling must stay out of reach for every one of them.
        const concrete = name.endsWith(':') ? `${name}label` : name;
        const scopes: Record<number, DebugProtocol.Scope[]> = {
          1: [
            { name: concrete, variablesReference: 100, expensive: false },
            { name: 'Global', variablesReference: 400, expensive: true }
          ]
        };
        const result = JsDebugAdapterPolicy.extractLocalVariables!(
          [frame],
          scopes,
          { 100: [v('bound', '1')], 400: [v('globalValue', '9')] }
        );
        expect(result, concrete).toEqual({ variables: [v('bound', '1')], scopeRefs: [100] });
      }

      // Local ranks ahead of every block form, which is what keeps the merge
      // reporting 'Local' with no note.
      expect(reported.indexOf('Local')).toBeLessThan(reported.indexOf('Block'));
    });
  });

  describe('command queueing', () => {
    it('does not queue initialize', () => {
      const state = JsDebugAdapterPolicy.createInitialState();
      const result = JsDebugAdapterPolicy.shouldQueueCommand!('initialize', state);
      expect(result.shouldQueue).toBe(false);
    });

    it('queues commands until initialize response received', () => {
      const state = JsDebugAdapterPolicy.createInitialState();
      const result = JsDebugAdapterPolicy.shouldQueueCommand!('threads', state);
      expect(result.shouldQueue).toBe(true);
      expect(result.shouldDefer).toBe(false);
    });

    it('defers launch until configurationDone sent', () => {
      const state = JsDebugAdapterPolicy.createInitialState() as any;
      state.initializeResponded = true;
      state.configurationDone = false;

      const result = JsDebugAdapterPolicy.shouldQueueCommand!('launch', state);
      expect(result.shouldQueue).toBe(true);
      expect(result.shouldDefer).toBe(true);
    });

    it('processQueuedCommands orders configuration, configDone, start, others', () => {
      const commands = [
        { requestId: '1', dapCommand: 'launch' },
        { requestId: '2', dapCommand: 'setBreakpoints' },
        { requestId: '3', dapCommand: 'configurationDone' },
        { requestId: '4', dapCommand: 'threads' },
      ];
      const ordered = JsDebugAdapterPolicy.processQueuedCommands!(commands);
      expect(ordered.map(c => c.dapCommand)).toEqual([
        'setBreakpoints',
        'configurationDone',
        'launch',
        'threads',
      ]);
    });
  });

  describe('state helpers', () => {
    it('updates state on commands and events', () => {
      const state = JsDebugAdapterPolicy.createInitialState() as any;
      JsDebugAdapterPolicy.updateStateOnCommand!('launch', undefined, state);
      expect(state.startSent).toBe(true);

      JsDebugAdapterPolicy.updateStateOnEvent!('initialized', undefined, state);
      expect(state.initialized).toBe(true);

      state.initializeResponded = true;
      expect(JsDebugAdapterPolicy.isConnected!(state)).toBe(true);
      expect(JsDebugAdapterPolicy.isInitialized!(state)).toBe(true);
    });
  });

  describe('matchesAdapter', () => {
    it('matches commands containing js-debug tokens', () => {
      expect(
        JsDebugAdapterPolicy.matchesAdapter!({
          command: '/usr/bin/node',
          args: ['/app/vendor/js-debug/vsDebugServer.cjs', '5678'],
        }),
      ).toBe(true);

      expect(
        JsDebugAdapterPolicy.matchesAdapter!({
          command: '/usr/bin/python',
          args: ['--version'],
        }),
      ).toBe(false);
    });
  });

  describe('getInitializationBehavior', () => {
    it('enables configuration deferral and runtime executable injection', () => {
      const behavior = JsDebugAdapterPolicy.getInitializationBehavior!();
      expect(behavior.deferConfigDone).toBe(true);
      expect(behavior.addRuntimeExecutable).toBe(true);
    });
  });

  describe('DAP client behavior', () => {
    it('normalizes adapter id and handles reverse start debugging request', async () => {
      const behavior = JsDebugAdapterPolicy.getDapClientBehavior!();
      expect(behavior.normalizeAdapterId?.('javascript')).toBe('pwa-node');

      const responses: DebugProtocol.Response[] = [];
      const context = {
        adoptedTargets: new Set<string>(),
        sendResponse: (_req: DebugProtocol.Request, res: DebugProtocol.Response) => {
          responses.push(res);
        },
      };

      const request: DebugProtocol.Request = {
        seq: 1,
        type: 'request',
        command: 'startDebugging',
        arguments: {
          configuration: { __pendingTargetId: 'child-1', host: '127.0.0.1', port: 9229 },
        },
      };

      const result = await behavior.handleReverseRequest!(request, context as any);
      expect(responses).toHaveLength(1);
      expect(result?.handled).toBe(true);
      expect(result?.createChildSession).toBe(true);
      expect(result?.childConfig?.pendingId).toBe('child-1');
    });
  });

  describe('getAdapterSpawnConfig', () => {
    it('returns spawn configuration when adapterCommand provided', () => {
      const spawn = JsDebugAdapterPolicy.getAdapterSpawnConfig!({
        adapterCommand: {
          command: '/usr/bin/node',
          args: ['vsDebugServer.cjs', '5678', '127.0.0.1'],
          env: { NODE_OPTIONS: '--max-old-space-size=4096' },
        },
        adapterHost: '127.0.0.1',
        adapterPort: 5678,
        logDir: '/tmp/session',
      });

      expect(spawn).toMatchObject({
        command: '/usr/bin/node',
        args: ['vsDebugServer.cjs', '5678', '127.0.0.1'],
        host: '127.0.0.1',
        port: 5678,
        logDir: '/tmp/session',
      });
    });
  });
});
