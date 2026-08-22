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
import type { DebugProtocol } from '@vscode/debugprotocol';
import { CdpFunctionBreakpointBridge, MAX_SCRIPT_URLS } from '../../src/proxy/cdp-function-breakpoint-bridge.js';

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

  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    this.calls.push({ method, params });
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

  pause(opts: { hitBreakpoints?: string[]; callFrameId?: string; scriptId?: string; url?: string } = {}): void {
    this.emit('cdp-event', 'Debugger.paused', {
      reason: 'other',
      hitBreakpoints: opts.hitBreakpoints ?? [],
      callFrames: [
        {
          callFrameId: opts.callFrameId ?? 'frame-1',
          functionName: '',
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
});
