/**
 * Tests for CdpFunctionBreakpointBridge — JS function breakpoints delivered
 * over js-debug's CDP proxy (issue #295).
 *
 * The CDP client is faked; scenarios are scripted per CDP method. Spike-derived
 * facts encoded here: hitBreakpoints carries our fn-bp ids; the DAP stopped
 * js-debug synthesizes for those hits has reason "breakpoint" (or "entry" on
 * entry-bp collision) with empty hitBreakpointIds; module-scoped names resolve
 * only via evaluateOnCallFrame at a pause.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { CdpFunctionBreakpointBridge, MAX_SCRIPT_URLS } from '../../src/proxy/cdp-function-breakpoint-bridge.js';
import { CdpCallTimeoutError } from '../../src/proxy/cdp-proxy-client.js';
import { JS_LOGPOINT_BINDING, JS_LOGPOINT_CLEAR, JS_LOGPOINT_FLUSH, JS_LOGPOINT_UNBIND } from '@debugmcp/shared';

type CdpHandler = (params: Record<string, unknown>) => unknown;

class FakeCdpClient extends EventEmitter {
  calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  handlers = new Map<string, CdpHandler>();
  connected = false;
  disposeCalls = 0;
  connectArgs: unknown[] = [];

  /** functions resolvable in module/frame scope (evaluateOnCallFrame) */
  frameFunctions = new Map<string, string>(); // expression -> objectId
  /** functions resolvable globally (Runtime.evaluate) */
  globalFunctions = new Map<string, string>();

  constructor() {
    super();
    this.handlers.set('Debugger.evaluateOnCallFrame', (p) => {
      const objectId = this.frameFunctions.get(String(p.expression)) ?? this.globalFunctions.get(String(p.expression));
      if (!objectId) {
        return { result: { type: 'undefined' } };
      }
      return { result: { type: 'function', objectId, className: 'Function' } };
    });
    this.handlers.set('Runtime.evaluate', (p) => {
      const objectId = this.globalFunctions.get(String(p.expression));
      if (!objectId) {
        return { result: { type: 'undefined' } };
      }
      return { result: { type: 'function', objectId, className: 'Function' } };
    });
    this.handlers.set('Debugger.setBreakpointOnFunctionCall', (p) => ({ breakpointId: `cdp-${p.objectId}` }));
    this.handlers.set('Runtime.getProperties', (p) => {
      if (String(p.objectId).startsWith('loc-')) {
        return {
          result: [
            { name: 'scriptId', value: { value: '159' } },
            { name: 'lineNumber', value: { value: 2 } },
            { name: 'columnNumber', value: { value: 14 } }
          ]
        };
      }
      return {
        internalProperties: [
          { name: '[[FunctionLocation]]', value: { objectId: `loc-${p.objectId}` } }
        ]
      };
    });
  }

  async connect(host: string, port: number, path: string): Promise<void> {
    this.connectArgs = [host, port, path];
    this.connected = true;
  }

  /** The timeout each call was sent with, by method. */
  timeouts = new Map<string, Array<number | undefined>>();

  async send(method: string, params: Record<string, unknown> = {}, timeoutMs?: number): Promise<unknown> {
    this.calls.push({ method, params });
    this.timeouts.set(method, [...(this.timeouts.get(method) ?? []), timeoutMs]);
    const handler = this.handlers.get(method);
    return handler ? handler(params) : {};
  }

  isConnected(): boolean {
    return this.connected;
  }

  dispose(): void {
    this.disposeCalls++;
    this.connected = false;
  }

  callsFor(method: string) {
    return this.calls.filter((c) => c.method === method);
  }

  pause(opts: {
    hitBreakpoints?: string[];
    callFrameId?: string;
    scriptId?: string;
    url?: string;
    functionName?: string;
    functionLocation?: { scriptId: string; lineNumber: number; columnNumber: number };
  } = {}): void {
    this.emit('cdp-event', 'Debugger.paused', {
      reason: 'other',
      hitBreakpoints: opts.hitBreakpoints ?? [],
      callFrames: [
        {
          callFrameId: opts.callFrameId ?? 'frame-1',
          functionName: opts.functionName ?? '',
          ...(opts.functionLocation ? { functionLocation: opts.functionLocation } : {}),
          location: { scriptId: opts.scriptId ?? '159', lineNumber: 0, columnNumber: 0 },
          url: opts.url ?? ''
        }
      ]
    });
  }

  resume(): void {
    this.emit('cdp-event', 'Debugger.resumed', {});
  }
}

class FakeChildClient {
  requests: Array<{ command: string; args: unknown }> = [];
  failProxyRequest = false;
  proxyRequestDelayMs = 0;

  async sendRequest(command: string, args?: unknown): Promise<unknown> {
    this.requests.push({ command, args });
    if (command === 'requestCDPProxy') {
      if (this.proxyRequestDelayMs > 0) {
        await new Promise((r) => setTimeout(r, this.proxyRequestDelayMs));
      }
      if (this.failProxyRequest) {
        throw new Error('requestCDPProxy timed out');
      }
      return { body: { host: '127.0.0.1', port: 40000, path: '/token' } };
    }
    return {};
  }
}

function fnBp(name: string, condition?: string): DebugProtocol.FunctionBreakpoint {
  return condition !== undefined ? { name, condition } : { name };
}

function stoppedEvent(reason: string, extra: Record<string, unknown> = {}): DebugProtocol.Event {
  return {
    seq: 0,
    type: 'event',
    event: 'stopped',
    body: { reason, threadId: 0, hitBreakpointIds: [], ...extra }
  } as DebugProtocol.Event;
}

describe('CdpFunctionBreakpointBridge', () => {
  let cdp: FakeCdpClient;
  let currentClient: FakeCdpClient;
  let child: FakeChildClient;
  let bridge: CdpFunctionBreakpointBridge;
  let breakpointEvents: DebugProtocol.BreakpointEvent[];

  beforeEach(() => {
    cdp = new FakeCdpClient();
    currentClient = cdp;
    child = new FakeChildClient();
    bridge = new CdpFunctionBreakpointBridge({
      clientFactory: () => currentClient as never,
      stopEventHoldMs: 40
    });
    breakpointEvents = [];
    bridge.on('breakpointEvent', (evt: DebugProtocol.BreakpointEvent) => breakpointEvents.push(evt));
  });

  async function attach(): Promise<void> {
    await bridge.attachToChild(child as never);
  }

  describe('grammar validation', () => {
    it.each(['1abc', 'a..b', "a['b']", 'a b', 'router.stack[0]', ''])(
      'rejects %j without evaluating',
      async (bad) => {
        const body = await bridge.sync([fnBp(bad)]);
        expect(body.breakpoints[0].verified).toBe(false);
        expect(body.breakpoints[0].message).toMatch(/invalid function name/i);
        expect(cdp.callsFor('Debugger.evaluateOnCallFrame')).toHaveLength(0);
        expect(cdp.callsFor('Runtime.evaluate')).toHaveLength(0);
      }
    );

    it.each(['greet', 'globalThis.gfun', 'MyClass.prototype.handle', '_x.$y'])(
      'accepts %j',
      async (good) => {
        const body = await bridge.sync([fnBp(good)]);
        expect(body.breakpoints[0].message ?? '').not.toMatch(/invalid function name/i);
      }
    );
  });

  describe('pre-attach sync', () => {
    it('returns all-pending body with fresh disjoint adapter ids', async () => {
      const body = await bridge.sync([fnBp('greet'), fnBp('helper.doWork')]);
      expect(body.breakpoints).toHaveLength(2);
      for (const bp of body.breakpoints) {
        expect(bp.verified).toBe(false);
        expect(bp.id).toBeGreaterThanOrEqual(1_000_000);
      }
      expect(body.breakpoints[0].id).not.toBe(body.breakpoints[1].id);
      expect(bridge.hasArmedOrPending()).toBe(true);
    });
  });

  describe('attach and entry-pause binding', () => {
    it('requests the CDP proxy from the child, connects, subscribes, enables', async () => {
      await attach();
      expect(child.requests.map((r) => r.command)).toContain('requestCDPProxy');
      expect(cdp.connectArgs).toEqual(['127.0.0.1', 40000, '/token']);
      const subscribe = cdp.callsFor('JsDebug.subscribe');
      expect(subscribe).toHaveLength(1);
      expect((subscribe[0].params as { events: string[] }).events).toEqual(
        expect.arrayContaining(['Debugger.paused', 'Debugger.resumed', 'Debugger.scriptParsed'])
      );
      expect(cdp.callsFor('Debugger.enable')).toHaveLength(1);
    });

    it('kicks resolution when the bridge attach completes so pre-attach syncs bind without any pause (attach mode)', async () => {
      // Attach-mode race under load: the live set_breakpoint sync can land
      // while child adoption is still in flight. The entry pends ("no debug
      // target yet") — and a free-running attach target never pauses, so the
      // attach completion itself must trigger resolution via the global path.
      cdp.globalFunctions.set('globalThis.tick', 'obj-tick-g');
      const body = await bridge.sync([fnBp('globalThis.tick')]);
      expect(body.breakpoints[0].verified).toBe(false);

      await attach(); // no pause events at all
      await bridge.waitForResolution();

      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')).toHaveLength(1);
      expect(breakpointEvents).toHaveLength(1);
      expect(breakpointEvents[0].body.breakpoint.verified).toBe(true);
    });

    it('attach failure leaves entries pending with a message and does not throw', async () => {
      await bridge.sync([fnBp('greet')]);
      child.failProxyRequest = true;
      await expect(bridge.attachToChild(child as never)).resolves.toBeUndefined();
      const body = await bridge.sync([fnBp('greet')]);
      expect(body.breakpoints[0].verified).toBe(false);
      expect(body.breakpoints[0].message).toMatch(/CDP proxy unavailable/i);
    });

    it('binds pending entries from a sticky pause replay that arrives DURING Debugger.enable', async () => {
      // js-debug's proxy replays the latest Debugger.paused while processing
      // the enable request itself — before attachToChild finishes. The
      // resolution kick from that replay must already see a usable client.
      await bridge.sync([fnBp('greet')]);
      cdp.frameFunctions.set('greet', 'obj-greet');
      cdp.handlers.set('Debugger.enable', () => {
        cdp.emit('cdp-event', 'Debugger.paused', {
          reason: 'other',
          hitBreakpoints: [],
          callFrames: [{ callFrameId: 'entry-frame', location: { scriptId: '159' }, url: '' }]
        });
        return {};
      });
      await attach();
      await bridge.waitForResolution();
      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')).toHaveLength(1);
      expect(breakpointEvents).toHaveLength(1);
    });

    it('binds a module-scoped function at the entry pause via evaluateOnCallFrame and emits a changed event', async () => {
      await bridge.sync([fnBp('greet')]);
      cdp.frameFunctions.set('greet', 'obj-greet');
      await attach();
      cdp.pause({ callFrameId: 'entry-frame' });
      await bridge.waitForResolution();

      const evalCalls = cdp.callsFor('Debugger.evaluateOnCallFrame');
      expect(evalCalls.length).toBeGreaterThanOrEqual(1);
      expect(evalCalls[0].params).toMatchObject({
        callFrameId: 'entry-frame',
        expression: 'greet',
        silent: true,
        throwOnSideEffect: true
      });
      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')[0].params).toMatchObject({ objectId: 'obj-greet' });

      expect(breakpointEvents).toHaveLength(1);
      const bp = breakpointEvents[0].body.breakpoint;
      expect(bp.verified).toBe(true);
      expect(bp.id).toBeGreaterThanOrEqual(1_000_000);
      expect(bp.line).toBe(3); // [[FunctionLocation]] lineNumber 2 is 0-based
    });

    it('passes the condition through to setBreakpointOnFunctionCall', async () => {
      cdp.frameFunctions.set('greet', 'obj-greet');
      await attach();
      cdp.pause();
      await bridge.sync([fnBp('greet', 'n > 5')]);
      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')[0].params).toMatchObject({
        objectId: 'obj-greet',
        condition: 'n > 5'
      });
    });

    it('resolves global functions via Runtime.evaluate while running', async () => {
      cdp.globalFunctions.set('globalThis.gfun', 'obj-gfun');
      await attach(); // no pause
      const body = await bridge.sync([fnBp('globalThis.gfun')]);
      expect(body.breakpoints[0].verified).toBe(true);
      expect(cdp.callsFor('Runtime.evaluate').length).toBeGreaterThanOrEqual(1);
      expect(cdp.callsFor('Debugger.evaluateOnCallFrame')).toHaveLength(0);
    });

    it('retries without throwOnSideEffect when V8 vetoes the strict evaluation (module namespace get)', async () => {
      // Property access on an ESM namespace object is not on V8's
      // side-effect-free whitelist; the strict pass gets an EvalError veto and
      // the bridge must fall back to a permissive evaluation of the same
      // bridge-validated dotted path.
      await attach();
      cdp.pause();
      cdp.handlers.set('Debugger.evaluateOnCallFrame', (p) => {
        if (p.throwOnSideEffect === true) {
          return {
            result: { type: 'object', subtype: 'error', className: 'EvalError' },
            exceptionDetails: { text: 'EvalError: Possible side-effect in debug-evaluate' }
          };
        }
        return { result: { type: 'function', objectId: 'obj-ns-fn', className: 'Function' } };
      });
      const body = await bridge.sync([fnBp('helper.doWork')]);
      expect(body.breakpoints[0].verified).toBe(true);
      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')[0].params).toMatchObject({ objectId: 'obj-ns-fn' });
    });

    it('drops a stale pause record and retries globally when the frame evaluation reports not-paused', async () => {
      // Attach-mode race: the target resumed but the Debugger.resumed event
      // has not landed yet, so the bridge still holds a pause record. The
      // frame evaluation fails with "Can only perform operation while paused"
      // and must fall back to Runtime.evaluate instead of pending forever.
      cdp.globalFunctions.set('globalThis.tick', 'obj-tick-g');
      cdp.handlers.set('Debugger.evaluateOnCallFrame', () => {
        throw new Error('Debugger.evaluateOnCallFrame: Can only perform operation while paused.');
      });
      await attach();
      cdp.pause(); // stale by the time sync evaluates
      const body = await bridge.sync([fnBp('globalThis.tick')]);
      expect(body.breakpoints[0].verified).toBe(true);
      expect(cdp.callsFor('Runtime.evaluate').length).toBeGreaterThanOrEqual(1);
    });

    it('retries globally even when the resumed event cleared the record during the failed frame evaluation', async () => {
      // The other side of the stale-record race: Debugger.resumed lands while
      // the doomed evaluateOnCallFrame round-trip is still in flight, so the
      // record is already null when the error arrives. The error itself
      // proves the frame path was wrong — the retry must not require the
      // record to still be present.
      cdp.globalFunctions.set('globalThis.tick', 'obj-tick-g');
      cdp.handlers.set('Debugger.evaluateOnCallFrame', () => {
        cdp.resume();
        throw new Error('Debugger.evaluateOnCallFrame: Can only perform operation while paused.');
      });
      await attach();
      cdp.pause(); // stale by evaluation time
      const body = await bridge.sync([fnBp('globalThis.tick')]);
      expect(body.breakpoints[0].verified).toBe(true);
      expect(cdp.callsFor('Runtime.evaluate').length).toBeGreaterThanOrEqual(1);
    });

    it('reports a precise pending message when the name resolves to a non-function', async () => {
      await attach();
      cdp.pause();
      cdp.handlers.set('Debugger.evaluateOnCallFrame', () => ({ result: { type: 'number', value: 42 } }));
      const body = await bridge.sync([fnBp('answer')]);
      expect(body.breakpoints[0].verified).toBe(false);
      expect(body.breakpoints[0].message).toMatch(/not a function/i);
    });
  });

  describe('replace-all generations', () => {
    beforeEach(async () => {
      cdp.frameFunctions.set('greet', 'obj-greet');
      cdp.frameFunctions.set('tick', 'obj-tick');
      await attach();
      cdp.pause();
    });

    it('keeps armed CDP breakpoints for surviving (name, condition) keys but mints fresh adapter ids', async () => {
      const first = await bridge.sync([fnBp('greet')]);
      const firstId = first.breakpoints[0].id;
      const armCallsAfterFirst = cdp.callsFor('Debugger.setBreakpointOnFunctionCall').length;

      const second = await bridge.sync([fnBp('greet'), fnBp('tick')]);
      expect(cdp.callsFor('Debugger.removeBreakpoint')).toHaveLength(0);
      // greet survives without re-arming; only tick arms anew
      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')).toHaveLength(armCallsAfterFirst + 1);
      expect(second.breakpoints[0].verified).toBe(true);
      expect(second.breakpoints[0].id).not.toBe(firstId);
    });

    it('a changed condition counts as a new key: removes the old CDP bp and re-arms', async () => {
      await bridge.sync([fnBp('greet')]);
      await bridge.sync([fnBp('greet', 'n > 5')]);
      expect(cdp.callsFor('Debugger.removeBreakpoint')).toHaveLength(1);
      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')).toHaveLength(2);
    });

    it('removes dropped keys via Debugger.removeBreakpoint', async () => {
      await bridge.sync([fnBp('greet'), fnBp('tick')]);
      await bridge.sync([fnBp('tick')]);
      const removes = cdp.callsFor('Debugger.removeBreakpoint');
      expect(removes).toHaveLength(1);
      expect(removes[0].params).toEqual({ breakpointId: 'cdp-obj-greet' });
    });

    it('an empty sync clears everything', async () => {
      await bridge.sync([fnBp('greet')]);
      const body = await bridge.sync([]);
      expect(body.breakpoints).toHaveLength(0);
      expect(cdp.callsFor('Debugger.removeBreakpoint')).toHaveLength(1);
      expect(bridge.hasArmedOrPending()).toBe(false);
    });
  });

  describe('stop-event rewriting', () => {
    let greetAdapterId: number;

    beforeEach(async () => {
      cdp.frameFunctions.set('greet', 'obj-greet');
      await attach();
      cdp.pause();
      const body = await bridge.sync([fnBp('greet')]);
      greetAdapterId = body.breakpoints[0].id!;
      cdp.resume();
    });

    it('rewrites a stopped event when the CDP pause (arrived first) hits our breakpoint', async () => {
      cdp.pause({ hitBreakpoints: ['cdp-obj-greet'] });
      const out = await bridge.processStoppedEvent(stoppedEvent('breakpoint'));
      const body = out.body as DebugProtocol.StoppedEvent['body'];
      expect(body.reason).toBe('function breakpoint');
      expect(body.hitBreakpointIds).toEqual([greetAdapterId]);
    });

    it('merges the line-breakpoint ids js-debug reported into the rewritten stop (issue #673)', async () => {
      // A line breakpoint on the function's first statement co-fires in the
      // same V8 pause; its id may be the only proof that breakpoint bound.
      cdp.pause({ hitBreakpoints: ['cdp-obj-greet'] });
      const evt = stoppedEvent('breakpoint');
      (evt.body as DebugProtocol.StoppedEvent['body']).hitBreakpointIds = [3];
      const out = await bridge.processStoppedEvent(evt);
      const body = out.body as DebugProtocol.StoppedEvent['body'];
      expect(body.reason).toBe('function breakpoint');
      expect(body.hitBreakpointIds).toEqual([3, greetAdapterId]);
    });

    it('rewrites an "entry"-labeled stop too (entry-bp collision) when CDP hits intersect ours', async () => {
      cdp.pause({ hitBreakpoints: ['entry-bp-id', 'cdp-obj-greet'] });
      const out = await bridge.processStoppedEvent(stoppedEvent('entry'));
      expect((out.body as DebugProtocol.StoppedEvent['body']).reason).toBe('function breakpoint');
    });

    it('holds a stopped event briefly until the late CDP pause arrives (DAP-first order)', async () => {
      const resultP = bridge.processStoppedEvent(stoppedEvent('breakpoint'));
      setTimeout(() => cdp.pause({ hitBreakpoints: ['cdp-obj-greet'] }), 10);
      const out = await resultP;
      expect((out.body as DebugProtocol.StoppedEvent['body']).reason).toBe('function breakpoint');
    });

    it('forwards unchanged after the hold times out with no CDP pause', async () => {
      const out = await bridge.processStoppedEvent(stoppedEvent('breakpoint'));
      expect((out.body as DebugProtocol.StoppedEvent['body']).reason).toBe('breakpoint');
    });

    it('forwards unchanged when the CDP pause hits only foreign breakpoints', async () => {
      cdp.pause({ hitBreakpoints: ['someone-elses-bp'] });
      const out = await bridge.processStoppedEvent(stoppedEvent('breakpoint'));
      expect((out.body as DebugProtocol.StoppedEvent['body']).reason).toBe('breakpoint');
    });

    it('does not let a consumed pause rewrite a later stop', async () => {
      cdp.pause({ hitBreakpoints: ['cdp-obj-greet'] });
      await bridge.processStoppedEvent(stoppedEvent('breakpoint'));
      const out = await bridge.processStoppedEvent(stoppedEvent('pause'));
      expect((out.body as DebugProtocol.StoppedEvent['body']).reason).toBe('pause');
    });

    it('never rewrites step stops on a stale record cleared by resume', async () => {
      cdp.pause({ hitBreakpoints: ['cdp-obj-greet'] });
      cdp.resume();
      const out = await bridge.processStoppedEvent(stoppedEvent('step'));
      expect((out.body as DebugProtocol.StoppedEvent['body']).reason).toBe('step');
    });
  });

  describe('late entry stops (issue #858)', () => {
    // js-debug sets its stopOnEntry breakpoint at line 1 col 1 and V8 resolves
    // it to the first breakable position in source order — inside a function
    // declared above the first statement — so the "entry" stop is really that
    // function's first call.
    const WORK_LOCATION = { scriptId: '159', lineNumber: 2, columnNumber: 14 }; // the fake's [[FunctionLocation]]

    it('relabels an entry stop that lands inside the function just armed as that function breakpoint', async () => {
      cdp.frameFunctions.set('work', 'obj-work');
      const body = await bridge.sync([fnBp('work')]);
      const adapterId = body.breakpoints[0].id!;
      await attach();

      // js-debug's own entry breakpoint id is foreign to us; the frame is work's body
      cdp.pause({ hitBreakpoints: ['js-debug-entry-bp'], functionName: 'work', functionLocation: WORK_LOCATION });
      await bridge.waitForResolution();
      const out = await bridge.processStoppedEvent(stoppedEvent('entry'));
      const stopped = out.body as DebugProtocol.StoppedEvent['body'];
      expect(stopped.reason).toBe('function breakpoint');
      expect(stopped.hitBreakpointIds).toEqual([adapterId]);
    });

    it('leaves an entry stop inside some other function to the note path (no false relabel by name)', async () => {
      cdp.frameFunctions.set('work', 'obj-work');
      await bridge.sync([fnBp('work')]);
      await attach();
      cdp.pause({ hitBreakpoints: ['js-debug-entry-bp'], functionName: 'work', functionLocation: { scriptId: '159', lineNumber: 40, columnNumber: 9 } });
      await bridge.waitForResolution();
      const out = await bridge.processStoppedEvent(stoppedEvent('entry'));
      const stopped = out.body as DebugProtocol.StoppedEvent['body'];
      expect(stopped.reason).toBe('entry');
      expect(stopped.text).toMatch(/entry stop landed inside work\(\)/);
    });

    it('annotates a late entry stop with no function breakpoints at all, and leaves a top-level entry stop alone', async () => {
      await attach();
      expect(bridge.hasArmedOrPending()).toBe(false);

      cdp.pause({ hitBreakpoints: ['js-debug-entry-bp'], functionName: 'helper', functionLocation: { scriptId: '159', lineNumber: 0, columnNumber: 15 } });
      const late = await bridge.processStoppedEvent(stoppedEvent('entry'));
      const lateBody = late.body as DebugProtocol.StoppedEvent['body'];
      expect(lateBody.reason).toBe('entry');
      expect(lateBody.text).toMatch(/entry stop landed inside helper\(\) at its first call/);
      expect(lateBody.text).toMatch(/every later call of helper\(\) stops as "entry" again/);

      cdp.resume();
      cdp.pause({ hitBreakpoints: ['js-debug-entry-bp'], functionName: '' });
      const top = await bridge.processStoppedEvent(stoppedEvent('entry'));
      expect((top.body as DebugProtocol.StoppedEvent['body']).text).toBeUndefined();
    });
  });

  describe('deferred binding', () => {
    it('re-resolves pending names at each pause and emits changed on late bind', async () => {
      await bridge.sync([fnBp('helper.doWork')]);
      await attach();
      cdp.pause(); // not resolvable yet
      await bridge.waitForResolution();
      expect(breakpointEvents).toHaveLength(0);

      cdp.resume();
      cdp.frameFunctions.set('helper.doWork', 'obj-dowork'); // module now loaded
      cdp.pause({ callFrameId: 'later-frame' });
      await bridge.waitForResolution();

      expect(breakpointEvents).toHaveLength(1);
      expect(breakpointEvents[0].body.breakpoint.verified).toBe(true);
      expect(breakpointEvents[0].body.reason).toBe('changed');
    });

    it('waits for an in-flight bridge attach before deciding on a stop (entry stop during attach)', async () => {
      await bridge.sync([fnBp('greet')]);
      cdp.frameFunctions.set('greet', 'obj-greet');

      // The entry stop can arrive while attachToChild is still doing the
      // requestCDPProxy/WS/subscribe dance. The held stop must wait for the
      // attach itself — NOT just the fixed hold window (the delay here
      // exceeds stopEventHoldMs on purpose) — so the sticky Debugger.paused
      // replay (simulated below) can deliver the record and binding can
      // complete before forwarding.
      child.proxyRequestDelayMs = 80;
      const attachP = bridge.attachToChild(child as never);
      void attachP.then(() => cdp.pause({ callFrameId: 'entry-frame' }));

      const out = await bridge.processStoppedEvent(stoppedEvent('pause'));
      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')).toHaveLength(1);
      expect((out.body as DebugProtocol.StoppedEvent['body']).reason).toBe('pause');
      await attachP;
    });

    it('holds a DAP-first entry stop until the pause record arrives and pending entries bind (auto-continue race)', async () => {
      await bridge.sync([fnBp('greet')]);
      cdp.frameFunctions.set('greet', 'obj-greet');
      await attach();

      // DAP stopped arrives BEFORE the CDP Debugger.paused twin. The bridge
      // must hold the event, receive the pause, and finish binding before
      // forwarding — otherwise the SessionManager can auto-continue the entry
      // stop while evaluateOnCallFrame still needs the paused frames.
      const p = bridge.processStoppedEvent(stoppedEvent('pause'));
      setTimeout(() => cdp.pause({ callFrameId: 'entry-frame' }), 10);
      await p;

      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')).toHaveLength(1);
    });

    it('processStoppedEvent waits for an in-flight resolution batch before forwarding', async () => {
      await bridge.sync([fnBp('greet')]);
      let release!: (v: unknown) => void;
      let firstCall = true;
      cdp.handlers.set('Debugger.evaluateOnCallFrame', () => {
        if (firstCall) {
          firstCall = false;
          return new Promise((r) => { release = r; });
        }
        // later calls (e.g. __filename enrichment) answer promptly — the real
        // client enforces per-call timeouts, so only the first call hangs
        return { result: { type: 'string', value: 'C:\\proj\\main.js' } };
      });
      await attach();
      cdp.pause();

      let settled = false;
      const p = bridge.processStoppedEvent(stoppedEvent('pause')).then((evt) => { settled = true; return evt; });
      await new Promise((r) => setTimeout(r, 20));
      expect(settled).toBe(false);
      release({ result: { type: 'function', objectId: 'obj-greet' } });
      await p;
      expect(settled).toBe(true);
    });
  });

  describe('boundFile enrichment', () => {
    it('uses the scriptParsed url map when available', async () => {
      cdp.frameFunctions.set('lazy.doWork', 'obj-lazy');
      await attach();
      cdp.emit('cdp-event', 'Debugger.scriptParsed', { scriptId: '159', url: 'file:///C:/proj/helper.js' });
      cdp.pause();
      const body = await bridge.sync([fnBp('lazy.doWork')]);
      expect(body.breakpoints[0].source?.path).toMatch(/helper\.js$/);
      expect(body.breakpoints[0].line).toBe(3);
    });

    it('falls back to __filename on the frame when the script url is unknown and script ids match', async () => {
      cdp.frameFunctions.set('greet', 'obj-greet');
      cdp.handlers.set('Debugger.evaluateOnCallFrame', (p) => {
        if (String(p.expression).includes('__filename')) {
          return { result: { type: 'string', value: 'C:\\proj\\main.js' } };
        }
        return { result: { type: 'function', objectId: 'obj-greet' } };
      });
      await attach();
      cdp.pause({ scriptId: '159' }); // same script as [[FunctionLocation]]
      const body = await bridge.sync([fnBp('greet')]);
      expect(body.breakpoints[0].source?.path).toBe('C:\\proj\\main.js');
    });

    it('reads the inline internal#location shape (value.value) some V8 versions report', async () => {
      cdp.frameFunctions.set('greet', 'obj-greet');
      cdp.handlers.set('Runtime.getProperties', () => ({
        internalProperties: [
          {
            name: '[[FunctionLocation]]',
            value: {
              type: 'object',
              subtype: 'internal#location',
              value: { scriptId: '166', lineNumber: 8, columnNumber: 16 },
              description: 'Object'
            }
          }
        ]
      }));
      await attach();
      cdp.emit('cdp-event', 'Debugger.scriptParsed', { scriptId: '166', url: 'file:///C:/proj/main.js' });
      cdp.pause();
      const body = await bridge.sync([fnBp('greet')]);
      expect(body.breakpoints[0].line).toBe(9);
      expect(body.breakpoints[0].source?.path).toMatch(/main\.js$/);
    });

    it('omits source but keeps verified and line when no url is learnable', async () => {
      cdp.frameFunctions.set('greet', 'obj-greet');
      await attach();
      cdp.pause({ scriptId: '999' }); // different script; no __filename path
      const body = await bridge.sync([fnBp('greet')]);
      expect(body.breakpoints[0].verified).toBe(true);
      expect(body.breakpoints[0].source).toBeUndefined();
      expect(body.breakpoints[0].line).toBe(3);
    });
  });

  describe('detach and re-attach', () => {
    it('detach disposes the client, keeps the desired set, and clears armed state', async () => {
      cdp.frameFunctions.set('greet', 'obj-greet');
      await attach();
      cdp.pause();
      await bridge.sync([fnBp('greet')]);
      bridge.detach();
      expect(cdp.disposeCalls).toBe(1);
      expect(bridge.hasArmedOrPending()).toBe(true); // desired set survives as pending

      // re-attach arms again on a fresh client
      const cdp2 = new FakeCdpClient();
      cdp2.frameFunctions.set('greet', 'obj-greet');
      currentClient = cdp2;
      await bridge.attachToChild(child as never);
      cdp2.pause();
      await bridge.waitForResolution();
      expect(cdp2.callsFor('Debugger.setBreakpointOnFunctionCall')).toHaveLength(1);
    });

    it('client closed event clears armed state like detach', async () => {
      cdp.frameFunctions.set('greet', 'obj-greet');
      await attach();
      cdp.pause();
      await bridge.sync([fnBp('greet')]);
      cdp.emit('closed');
      // a stop now passes through untouched (nothing armed)
      cdp.pause({ hitBreakpoints: ['cdp-obj-greet'] });
      const out = await bridge.processStoppedEvent(stoppedEvent('breakpoint'));
      expect((out.body as DebugProtocol.StoppedEvent['body']).reason).toBe('breakpoint');
    });
  });

  describe('logpoint delivery binding (issue #850)', () => {
    it('subscribes to Runtime.bindingCalled and installs the binding before enabling the debugger', async () => {
      await attach();
      const events = (cdp.callsFor('JsDebug.subscribe')[0].params as { events: string[] }).events;
      expect(events).toContain('Runtime.bindingCalled');
      const order = cdp.calls.map((c) => c.method);
      const addBinding = cdp.callsFor('Runtime.addBinding');
      expect(addBinding).toHaveLength(1);
      expect(addBinding[0].params).toEqual({ name: JS_LOGPOINT_BINDING });
      expect(order.indexOf('JsDebug.subscribe')).toBeLessThan(order.indexOf('Runtime.addBinding'));
      expect(order.indexOf('Runtime.addBinding')).toBeLessThan(order.indexOf('Debugger.enable'));
    });

    it('turns a bindingCalled for our binding into one console output event; other bindings are ignored', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      await attach();

      cdp.emit('cdp-event', 'Runtime.bindingCalled', { name: JS_LOGPOINT_BINDING, payload: 'n=3 done', executionContextId: 1 });
      cdp.emit('cdp-event', 'Runtime.bindingCalled', { name: 'someoneElse', payload: 'ignored', executionContextId: 1 });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].event).toBe('output');
      expect(outputs[0].body).toEqual({ category: 'console', output: 'n=3 done\n' });
    });

    it('tolerates a failed addBinding: the attach still completes and function breakpoints still work', async () => {
      cdp.handlers.set('Runtime.addBinding', () => {
        throw new Error('Runtime.addBinding: not supported');
      });
      cdp.frameFunctions.set('greet', 'obj-greet');
      await attach();
      expect(cdp.callsFor('Debugger.enable')).toHaveLength(1);
      cdp.pause();
      await bridge.sync([fnBp('greet')]);
      await bridge.waitForResolution();
      expect(cdp.callsFor('Debugger.setBreakpointOnFunctionCall')).toHaveLength(1);
    });

    it('sends the binding with the subscription, before either is answered (issue #1212)', async () => {
      // The adapter lets a forked process run about 20 ms after its
      // configurationDone: a round trip saved here is the first statement kept.
      let answerSubscribe!: () => void;
      cdp.handlers.set('JsDebug.subscribe', () => new Promise<void>((resolve) => { answerSubscribe = resolve; }));
      const attaching = attach();
      await vi.waitFor(() => expect(cdp.callsFor('JsDebug.subscribe')).toHaveLength(1));

      expect(cdp.callsFor('Runtime.addBinding')).toHaveLength(1);
      expect(cdp.callsFor('Debugger.enable')).toHaveLength(0);

      answerSubscribe();
      await attaching;
      expect(cdp.callsFor('Debugger.enable')).toHaveLength(1);
    });

    it('delivers what the process kept before the binding was in: one evaluation, right after the binding (issue #1212)', async () => {
      await attach();
      const order = cdp.calls.map((c) => c.method);
      const flush = cdp.calls.filter((c) => c.method === 'Runtime.evaluate' && c.params.expression === JS_LOGPOINT_FLUSH);

      expect(flush).toHaveLength(1);
      expect(flush[0].params).toMatchObject({ returnByValue: true });
      expect(order.indexOf('Runtime.addBinding')).toBeLessThan(order.indexOf('Runtime.evaluate'));
      expect(order.indexOf('Runtime.evaluate')).toBeLessThan(order.indexOf('Debugger.enable'));
    });

    it('says so when the process hit more logpoints than it could keep', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      const lookup = cdp.handlers.get('Runtime.evaluate')!;
      cdp.handlers.set('Runtime.evaluate', (p) => (p.expression === JS_LOGPOINT_FLUSH ? { result: { type: 'number', value: 7 } } : lookup(p)));

      await attach();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].body.category).toBe('console');
      expect(outputs[0].body.output).toMatch(/^\[mcp-debugger\] 7 logpoint message\(s\) of this process were not kept/);
    });

    it('a flush the target cannot answer does not fail the attach, and nothing is flushed without the binding', async () => {
      const lookup = cdp.handlers.get('Runtime.evaluate')!;
      cdp.handlers.set('Runtime.evaluate', (p) => {
        if (p.expression === JS_LOGPOINT_FLUSH) {
          throw new Error('Connection is closed');
        }
        return lookup(p);
      });
      await attach();
      expect(cdp.callsFor('Debugger.enable')).toHaveLength(1);
      expect(bridge.isAttached()).toBe(true);

      const other = new FakeCdpClient();
      other.handlers.set('Runtime.addBinding', () => {
        throw new Error('Runtime.addBinding: not supported');
      });
      const unbound = new CdpFunctionBreakpointBridge({ clientFactory: () => other as never, stopEventHoldMs: 40 });
      await unbound.attachToChild(child as never);
      expect(other.calls.filter((c) => c.params.expression === JS_LOGPOINT_FLUSH)).toHaveLength(0);
    });

    it('tells the session, once, that logpoints are not delivered when the binding is refused', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      bridge.noteLogpoints();
      cdp.handlers.set('Runtime.addBinding', () => {
        throw new Error('Runtime.addBinding: not supported');
      });
      // The attach itself then fails too: one sentence, not two.
      cdp.handlers.set('Debugger.enable', () => {
        throw new Error('Debugger.enable failed');
      });

      await attach();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].body.category).toBe('console');
      expect(outputs[0].body.output).toMatch(/^\[mcp-debugger\] Warning: logpoints that hit in this process are not delivered/);
      expect(outputs[0].body.output).toContain('Runtime.addBinding: not supported');
      // Never the program's own output (the old console.log fallback).
      expect(outputs[0].body.output).toContain("kept out of the program's own output");
    });

    it('says nothing about a target that was never sent a logpoint, and says it the moment one is', async () => {
      // A fork that ends before its socket is open is the common case of a
      // channel that never came up: a warning about nothing, without this.
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      child.failProxyRequest = true;
      await attach();
      expect(outputs).toHaveLength(0);

      bridge.noteLogpoints();
      bridge.noteLogpoints();

      expect(outputs.map((o) => o.body.output)).toEqual([
        expect.stringMatching(/logpoints that hit in this process are not delivered.*requestCDPProxy timed out/)
      ]);
    });

    it('a logpoint sent to a target whose binding is in says nothing', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      bridge.noteLogpoints();
      await attach();
      bridge.noteLogpoints();
      expect(outputs).toHaveLength(0);
    });

    it('tells the session when the CDP socket cannot be opened at all, and says nothing when the binding went in', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      bridge.noteLogpoints();
      child.failProxyRequest = true;
      await attach();
      expect(outputs.map((o) => o.body.output)).toEqual([
        expect.stringMatching(/logpoints that hit in this process are not delivered.*requestCDPProxy timed out/)
      ]);

    });

    it("an attach that fails after the binding went in takes the binding's function out of the process and says the channel is down", async () => {
      // The function is a property of the process's global object: left in,
      // every later hit would call it, keep nothing, and reach nobody. And
      // Runtime.removeBinding alone leaves it in (measured).
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      bridge.noteLogpoints();
      cdp.handlers.set('Debugger.enable', () => {
        throw new Error('Debugger.enable failed');
      });
      const lookup = cdp.handlers.get('Runtime.evaluate')!;
      cdp.handlers.set('Runtime.evaluate', (p) => (p.expression === JS_LOGPOINT_UNBIND ? { result: { type: 'boolean', value: true } } : lookup(p)));

      await attach();

      const unbind = cdp.calls.filter((c) => c.method === 'Runtime.evaluate' && c.params.expression === JS_LOGPOINT_UNBIND);
      expect(unbind).toHaveLength(1);
      expect(unbind[0].params).toMatchObject({ returnByValue: true });
      const order = cdp.calls.map((c) => c.method);
      expect(cdp.callsFor('Runtime.removeBinding')).toEqual([{ method: 'Runtime.removeBinding', params: { name: JS_LOGPOINT_BINDING } }]);
      expect(order.indexOf('Runtime.addBinding')).toBeLessThan(order.lastIndexOf('Runtime.evaluate'));
      // Before the socket goes, and bounded.
      expect(cdp.disposeCalls).toBe(1);
      expect(cdp.timeouts.get('Runtime.evaluate')?.at(-1)).toBe(1000);
      expect(bridge.isAttached()).toBe(false);
      expect(outputs.map((o) => o.body.output)).toEqual([
        expect.stringMatching(/logpoints that hit in this process are not delivered.*Debugger\.enable failed/)
      ]);
    });

    it("says nothing when the function cannot be taken out again: the process ended while the attach was finishing", async () => {
      // Measured with a fork that hits two logpoints and exits at once: both
      // lines arrive, then `Debugger.enable` fails because the target is gone.
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      bridge.noteLogpoints();
      cdp.handlers.set('Debugger.enable', () => {
        throw new Error('Debugger.enable: Connection is closed');
      });
      const lookup = cdp.handlers.get('Runtime.evaluate')!;
      cdp.handlers.set('Runtime.evaluate', (p) => {
        if (p.expression === JS_LOGPOINT_UNBIND) {
          throw new Error('Runtime.evaluate: Connection is closed');
        }
        return lookup(p);
      });

      await attach();

      expect(cdp.calls.filter((c) => c.params.expression === JS_LOGPOINT_UNBIND)).toHaveLength(1);
      expect(cdp.disposeCalls).toBe(1);
      expect(outputs).toHaveLength(0);
    });

    it('says nothing when the CDP WebSocket closes after Runtime.addBinding succeeded: onClosed resetting bindingInstalled does not trigger a false warning', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      bridge.noteLogpoints();
      cdp.handlers.set('Debugger.enable', () => {
        // Real CdpProxyClient.onClosed sets connected=false and emits 'closed'
        // synchronously before the pending Debugger.enable rejection settles.
        cdp.connected = false;
        cdp.emit('closed');
        throw new Error('CDP proxy connection closed');
      });

      await attach();

      expect(bridge.isAttached()).toBe(false);
      expect(outputs).toHaveLength(0);
    });

    it('abandons rollback without clobbering a newer attach or warning when detach() runs during JS_LOGPOINT_UNBIND', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      bridge.noteLogpoints();
      let finishUnbind!: () => void;
      const firstCdp = cdp;
      firstCdp.handlers.set('Debugger.enable', () => {
        throw new Error('Debugger.enable failed');
      });
      const lookup = firstCdp.handlers.get('Runtime.evaluate')!;
      firstCdp.handlers.set('Runtime.evaluate', (p) =>
        p.expression === JS_LOGPOINT_UNBIND
          ? new Promise((resolve) => {
              finishUnbind = () => resolve({ result: { type: 'boolean', value: true } });
            })
          : lookup(p)
      );

      const firstAttach = attach();
      await vi.waitFor(() => expect(finishUnbind).toBeDefined());

      // Detach and attach a fresh client while the first attach's rollback is still awaiting unbind.
      bridge.detach();
      const secondCdp = new FakeCdpClient();
      currentClient = secondCdp;
      await attach();
      expect(bridge.isAttached()).toBe(true);

      finishUnbind();
      await firstAttach;

      // Neither a stale warning nor a cleared secondCdp!
      expect(outputs).toHaveLength(0);
      expect(bridge.isAttached()).toBe(true);
    });

    it.each([
      ['answers that the function is still there (a global that cannot be changed)', () => ({ result: { type: 'boolean', value: false } })],
      ['does not answer in time (its main thread is blocked): the socket is open, so it is there', () => {
        throw new CdpCallTimeoutError('CDP call timeout after 1000ms: Runtime.evaluate');
      }]
    ])('tells a process that is still there, also when it %s', async (_case, unbindAnswer) => {
      // Only a process that has ended is left untold; this one's logpoints are not delivered from now on.
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      bridge.noteLogpoints();
      cdp.handlers.set('Debugger.enable', () => {
        throw new Error('Debugger.enable failed');
      });
      const lookup = cdp.handlers.get('Runtime.evaluate')!;
      cdp.handlers.set('Runtime.evaluate', (p) => (p.expression === JS_LOGPOINT_UNBIND ? unbindAnswer() : lookup(p)));

      await attach();

      expect(outputs.map((o) => o.body.output)).toEqual([
        expect.stringMatching(/logpoints that hit in this process are not delivered.*Debugger\.enable failed/)
      ]);
    });

    it('says it again for a later failure once an attach in between had the channel up', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      bridge.noteLogpoints();
      child.failProxyRequest = true;
      await attach();
      expect(outputs).toHaveLength(1);

      // The channel comes up: nothing is down any more, and a logpoint sent now says nothing.
      child.failProxyRequest = false;
      await attach();
      bridge.noteLogpoints();
      expect(outputs).toHaveLength(1);

      // Down again: said again.
      bridge.detach();
      child.failProxyRequest = true;
      await attach();
      expect(outputs).toHaveLength(2);
    });

    it('a flush that reports nothing lost says nothing', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      const lookup = cdp.handlers.get('Runtime.evaluate')!;
      cdp.handlers.set('Runtime.evaluate', (p) => (p.expression === JS_LOGPOINT_FLUSH ? { result: { type: 'number', value: 0 } } : lookup(p)));

      await attach();

      expect(outputs).toHaveLength(0);
    });

    it('removes the binding on a graceful detach while connected', async () => {
      await attach();
      bridge.detach();
      expect(cdp.callsFor('Runtime.removeBinding')).toEqual([{ method: 'Runtime.removeBinding', params: { name: JS_LOGPOINT_BINDING } }]);
      expect(cdp.disposeCalls).toBe(1);
    });

    it("release() takes the proxy's things out of a process that will live on: one awaited, bounded evaluation, while the socket is up", async () => {
      // Whoever sends the adapter the disconnect that releases the target awaits
      // this first: measured, the disconnect takes the socket with it, and a
      // detach() afterwards finds it closed and leaves the function in the process.
      await expect(bridge.release()).resolves.toBeUndefined();
      expect(cdp.calls).toHaveLength(0);

      await attach();
      let answer!: () => void;
      const lookup = cdp.handlers.get('Runtime.evaluate')!;
      cdp.handlers.set('Runtime.evaluate', (p) =>
        p.expression === JS_LOGPOINT_CLEAR ? new Promise<void>((resolve) => { answer = resolve; }) : lookup(p));
      const before = cdp.calls.length;
      let released = false;
      const releasing = bridge.release().then(() => { released = true; });
      await vi.waitFor(() => expect(answer).toBeDefined());
      await new Promise((resolve) => setImmediate(resolve));

      expect(released).toBe(false);
      expect(cdp.calls.slice(before)).toEqual([
        { method: 'Runtime.evaluate', params: { expression: JS_LOGPOINT_CLEAR, returnByValue: true } }
      ]);
      expect(cdp.timeouts.get('Runtime.evaluate')?.at(-1)).toBe(250);
      // The socket is not closed by it: detach() does that.
      expect(cdp.disposeCalls).toBe(0);

      answer();
      await releasing;
      expect(released).toBe(true);

      // A process that cannot answer does not fail the release.
      cdp.handlers.set('Runtime.evaluate', () => {
        throw new Error('Connection is closed');
      });
      await expect(bridge.release()).resolves.toBeUndefined();

      // And a socket that has closed is asked nothing.
      cdp.connected = false;
      const asked = cdp.calls.length;
      await bridge.release();
      expect(cdp.calls).toHaveLength(asked);
    });

    it('leaves nothing of the kept messages in a process it lets go of, binding or not (issue #1212)', async () => {
      await attach();
      const before = cdp.calls.length;
      bridge.detach();
      const sent = cdp.calls.slice(before);
      expect(sent[0]).toEqual({ method: 'Runtime.evaluate', params: { expression: JS_LOGPOINT_CLEAR, returnByValue: true } });
      expect(sent.map((c) => c.method)).toEqual(['Runtime.evaluate', 'Runtime.removeBinding']);

      // A target that refused the binding still kept messages: cleared too, and no binding to remove.
      const other = new FakeCdpClient();
      other.handlers.set('Runtime.addBinding', () => {
        throw new Error('Runtime.addBinding: not supported');
      });
      const unbound = new CdpFunctionBreakpointBridge({ clientFactory: () => other as never, stopEventHoldMs: 40 });
      await unbound.attachToChild(new FakeChildClient() as never);
      const otherBefore = other.calls.length;
      unbound.detach();
      expect(other.calls.slice(otherBefore)).toEqual([
        { method: 'Runtime.evaluate', params: { expression: JS_LOGPOINT_CLEAR, returnByValue: true } }
      ]);
    });
  });

  describe('a target that ends while its socket is opening, and the end of a target (issue #1212)', () => {
    it('keeps no socket when detach() runs while requestCDPProxy is in flight, and says nothing', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      child.proxyRequestDelayMs = 20;
      const attaching = attach();
      bridge.detach();
      await attaching;

      expect(cdp.connectArgs).toEqual([]);
      expect(bridge.isAttached()).toBe(false);
      expect(outputs).toHaveLength(0);
    });

    it('closes the socket it was opening when detach() runs during the connect', async () => {
      const outputs: DebugProtocol.OutputEvent[] = [];
      bridge.on('outputEvent', (evt: DebugProtocol.OutputEvent) => outputs.push(evt));
      let connected!: () => void;
      cdp.connect = (async (...args: unknown[]) => {
        cdp.connectArgs = args;
        await new Promise<void>((resolve) => { connected = resolve; });
        cdp.connected = true;
      }) as FakeCdpClient['connect'];
      const attaching = attach();
      await vi.waitFor(() => expect(connected).toBeDefined());
      bridge.detach();
      connected();
      await attaching;

      expect(cdp.disposeCalls).toBe(1);
      expect(cdp.callsFor('JsDebug.subscribe')).toHaveLength(0);
      expect(cdp.listenerCount('cdp-event')).toBe(0);
      expect(bridge.isAttached()).toBe(false);
      expect(outputs).toHaveLength(0);
      // Also for a target that holds a logpoint: it was let go of, its channel did not fail.
      bridge.noteLogpoints();
      expect(outputs).toHaveLength(0);
    });

    it('settle() is one round trip on the socket that asks the target nothing, and an error answers it', async () => {
      await attach();
      cdp.handlers.set('JsDebug.mcpDebuggerBarrier', () => {
        throw new Error('JsDebug.mcpDebuggerBarrier not found');
      });
      const before = cdp.calls.length;

      await expect(bridge.settle()).resolves.toBeUndefined();

      const sent = cdp.calls.slice(before);
      expect(sent.map((c) => c.method)).toEqual(['JsDebug.mcpDebuggerBarrier']);
    });

    it('settle() resolves only when the round trip is answered: lines sent before it are in by then', async () => {
      await attach();
      let answer!: () => void;
      cdp.handlers.set('JsDebug.mcpDebuggerBarrier', () => new Promise<void>((resolve) => { answer = resolve; }));
      let settled = false;
      const settling = bridge.settle().then(() => { settled = true; });
      await vi.waitFor(() => expect(answer).toBeDefined());
      await new Promise((resolve) => setImmediate(resolve));
      expect(settled).toBe(false);

      answer();
      await settling;
      expect(settled).toBe(true);
    });

    it('settle() is bounded at 500 ms by default: a round trip nobody answers is sent with that bound', async () => {
      await attach();
      cdp.handlers.set('JsDebug.mcpDebuggerBarrier', () => {
        throw new Error('CDP call timeout');
      });

      await bridge.settle();

      const bound = cdp.timeouts.get('JsDebug.mcpDebuggerBarrier') ?? [];
      expect(bound).toHaveLength(1);
      expect(bound[0]).toBeGreaterThan(400);
      expect(bound[0]).toBeLessThanOrEqual(500);
    });

    it('settle() without a socket resolves at once and sends nothing', async () => {
      await expect(bridge.settle()).resolves.toBeUndefined();
      expect(cdp.calls).toHaveLength(0);

      await attach();
      bridge.detach();
      const before = cdp.calls.length;
      await expect(bridge.settle()).resolves.toBeUndefined();
      expect(cdp.calls.slice(before).map((c) => c.method)).not.toContain('JsDebug.mcpDebuggerBarrier');
    });

    it('settle() waits for an attach in flight, then makes its round trip on that socket', async () => {
      child.proxyRequestDelayMs = 30;
      const attaching = attach();

      await bridge.settle();

      expect(cdp.callsFor('JsDebug.mcpDebuggerBarrier')).toHaveLength(1);
      const order = cdp.calls.map((c) => c.method);
      expect(order.indexOf('Debugger.enable')).toBeLessThan(order.indexOf('JsDebug.mcpDebuggerBarrier'));
      await attaching;
    });

    it('settle() has one deadline: the round trip gets what the attach in flight left of it', async () => {
      child.proxyRequestDelayMs = 60;
      const attaching = attach();

      await bridge.settle(400);

      const barrier = cdp.timeouts.get('JsDebug.mcpDebuggerBarrier') ?? [];
      expect(barrier).toHaveLength(1);
      expect(barrier[0]).toBeGreaterThan(0);
      // Not 400 again: the attach took at least 60 of them.
      expect(barrier[0]).toBeLessThanOrEqual(345);
      await attaching;
    });

    it('settle() gives an attach that does not finish its bound and no more', async () => {
      child.proxyRequestDelayMs = 400;
      const attaching = attach();
      const started = Date.now();

      await bridge.settle(40);

      expect(Date.now() - started).toBeLessThan(300);
      expect(cdp.callsFor('JsDebug.mcpDebuggerBarrier')).toHaveLength(0);
      bridge.detach();
      await attaching;
    });
  });

  describe('scriptUrls cap (issue #405)', () => {
    it('evicts the oldest scriptParsed entries past the cap', async () => {
      await attach();

      const overshoot = 10;
      for (let i = 0; i < MAX_SCRIPT_URLS + overshoot; i++) {
        cdp.emit('cdp-event', 'Debugger.scriptParsed', { scriptId: `s${i}`, url: `file:///f${i}.js` });
      }

      const urls = (bridge as unknown as { scriptUrls: Map<string, string> }).scriptUrls;
      expect(urls.size).toBe(MAX_SCRIPT_URLS);
      // FIFO: the earliest scripts fell out, the newest survive
      expect(urls.has('s0')).toBe(false);
      expect(urls.has(`s${overshoot - 1}`)).toBe(false);
      expect(urls.get(`s${MAX_SCRIPT_URLS + overshoot - 1}`)).toBe(`file:///f${MAX_SCRIPT_URLS + overshoot - 1}.js`);
    });
  });

  describe('the source file', () => {
    it('holds no raw NUL byte: the key separator is written as an escape', () => {
      // A literal NUL made git treat the file as binary (no diff, no blame)
      // and made text tools refuse to edit it. The separator is the same
      // character at run time; the keyed cases above pin that.
      const source = readFileSync(fileURLToPath(new URL('../../src/proxy/cdp-function-breakpoint-bridge.ts', import.meta.url)), 'utf8');
      expect(source.includes(String.fromCharCode(0))).toBe(false);
    });
  });
});
