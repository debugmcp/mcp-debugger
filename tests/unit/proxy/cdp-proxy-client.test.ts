/**
 * Tests for CdpProxyClient — the minimal CDP-over-WebSocket JSON client used by
 * the js-debug function-breakpoint bridge (issue #295).
 *
 * The transport is injected so no real WebSocket/server is needed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { CdpProxyClient, type CdpTransport } from '../../../src/proxy/cdp-proxy-client.js';

class FakeTransport extends EventEmitter implements CdpTransport {
  sent: string[] = [];
  closeCalls = 0;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closeCalls++;
    this.emit('close');
  }

  // test helpers
  open(): void {
    this.emit('open');
  }

  receive(obj: unknown): void {
    this.emit('message', JSON.stringify(obj));
  }

  receiveRaw(data: string): void {
    this.emit('message', data);
  }

  lastSent(): { id: number; method: string; params?: unknown } {
    return JSON.parse(this.sent[this.sent.length - 1]);
  }
}

describe('CdpProxyClient', () => {
  let transport: FakeTransport;
  let urls: string[];
  let client: CdpProxyClient;

  beforeEach(() => {
    transport = new FakeTransport();
    urls = [];
    client = new CdpProxyClient({
      transportFactory: (url: string) => {
        urls.push(url);
        return transport;
      },
      callTimeoutMs: 50
    });
  });

  async function connect(): Promise<void> {
    const p = client.connect('127.0.0.1', 9229, '/abc123');
    transport.open();
    await p;
  }

  describe('connect', () => {
    it('builds the ws URL from host, port and path and resolves on open', async () => {
      await connect();
      expect(urls).toEqual(['ws://127.0.0.1:9229/abc123']);
      expect(client.isConnected()).toBe(true);
    });

    it('normalizes a path missing its leading slash', async () => {
      const p = client.connect('127.0.0.1', 9229, 'abc123');
      transport.open();
      await p;
      expect(urls).toEqual(['ws://127.0.0.1:9229/abc123']);
    });

    it('rejects when the transport errors before opening', async () => {
      const p = client.connect('127.0.0.1', 9229, '/abc123');
      transport.emit('error', new Error('boom'));
      await expect(p).rejects.toThrow(/boom/);
      expect(client.isConnected()).toBe(false);
    });

    it('rejects when the transport never opens within the timeout', async () => {
      const slow = new CdpProxyClient({
        transportFactory: () => transport,
        connectTimeoutMs: 30
      });
      await expect(slow.connect('127.0.0.1', 9229, '/x')).rejects.toThrow(/timeout/i);
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      await connect();
    });

    it('round-trips a request: writes {id, method, params}, resolves with the result', async () => {
      const p = client.send<{ breakpointId: string }>('Debugger.setBreakpointOnFunctionCall', { objectId: 'o1' });
      const sent = transport.lastSent();
      expect(sent.method).toBe('Debugger.setBreakpointOnFunctionCall');
      expect(sent.params).toEqual({ objectId: 'o1' });
      expect(typeof sent.id).toBe('number');

      transport.receive({ id: sent.id, result: { breakpointId: '7:1' } });
      await expect(p).resolves.toEqual({ breakpointId: '7:1' });
    });

    it('correlates out-of-order responses by id', async () => {
      const p1 = client.send('Runtime.evaluate', { expression: 'a' });
      const id1 = transport.lastSent().id;
      const p2 = client.send('Runtime.evaluate', { expression: 'b' });
      const id2 = transport.lastSent().id;
      expect(id2).not.toBe(id1);

      transport.receive({ id: id2, result: { value: 'second' } });
      transport.receive({ id: id1, result: { value: 'first' } });
      await expect(p2).resolves.toEqual({ value: 'second' });
      await expect(p1).resolves.toEqual({ value: 'first' });
    });

    it('rejects when the response carries an error object', async () => {
      const p = client.send('Debugger.removeBreakpoint', { breakpointId: 'nope' });
      transport.receive({ id: transport.lastSent().id, error: { code: -32000, message: 'not found' } });
      await expect(p).rejects.toThrow(/Debugger\.removeBreakpoint.*not found/);
    });

    it('rejects on per-call timeout and silently drops the late response', async () => {
      const p = client.send('Runtime.evaluate', { expression: 'slow' }, 20);
      const id = transport.lastSent().id;
      await expect(p).rejects.toThrow(/timeout/i);
      // late response must not throw or resurrect the promise
      transport.receive({ id, result: { value: 'late' } });
      expect(client.isConnected()).toBe(true);
    });

    it('rejects immediately when not connected', async () => {
      const fresh = new CdpProxyClient({ transportFactory: () => new FakeTransport() });
      await expect(fresh.send('Runtime.evaluate', {})).rejects.toThrow(/not connected/i);
    });
  });

  describe('events', () => {
    beforeEach(async () => {
      await connect();
    });

    it('emits cdp-event for frames without an id', async () => {
      const events: Array<{ method: string; params: unknown }> = [];
      client.on('cdp-event', (method: string, params: unknown) => events.push({ method, params }));
      transport.receive({ method: 'Debugger.paused', params: { reason: 'other', hitBreakpoints: ['7:1'] } });
      expect(events).toEqual([
        { method: 'Debugger.paused', params: { reason: 'other', hitBreakpoints: ['7:1'] } }
      ]);
    });

    it('skips unparseable frames without breaking later traffic', async () => {
      transport.receiveRaw('{not json');
      const p = client.send('Runtime.evaluate', { expression: 'x' });
      transport.receive({ id: transport.lastSent().id, result: { value: 1 } });
      await expect(p).resolves.toEqual({ value: 1 });
    });
  });

  describe('close and dispose', () => {
    beforeEach(async () => {
      await connect();
    });

    it('rejects all pending sends and emits closed when the transport closes', async () => {
      let closedEvents = 0;
      client.on('closed', () => closedEvents++);
      const p1 = client.send('Runtime.evaluate', { expression: 'a' });
      const p2 = client.send('Runtime.evaluate', { expression: 'b' });
      transport.emit('close');
      await expect(p1).rejects.toThrow(/closed/i);
      await expect(p2).rejects.toThrow(/closed/i);
      expect(closedEvents).toBe(1);
      expect(client.isConnected()).toBe(false);
    });

    it('dispose closes the transport, rejects pending sends, and is idempotent', async () => {
      const p = client.send('Runtime.evaluate', { expression: 'a' });
      client.dispose();
      client.dispose();
      await expect(p).rejects.toThrow(/closed/i);
      expect(transport.closeCalls).toBe(1);
      expect(client.isConnected()).toBe(false);
      await expect(client.send('Runtime.evaluate', {})).rejects.toThrow(/not connected/i);
    });
  });
});
