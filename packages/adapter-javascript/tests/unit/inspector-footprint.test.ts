/**
 * Issue #1261: what an attach by processId leaves in a Node.js target — an
 * inspector, which this server does not close — said in the `inspector`
 * field, in sentences that claim only what the attach observed.
 */
import { describe, it, expect, vi } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { inspectorFootprint, signalledFootprint } from '../../src/utils/inspector-footprint.js';
import type { InspectorProbe } from '../../src/utils/inspector-activation.js';

const at = { pid: 4242, host: '127.0.0.1', port: 9229 };
/** The claims a sentence may not make: a cause, a lifetime, a remedy. */
const UNOBSERVED = /opened by|until|restart|stays open/;

describe('inspectorFootprint (issue #1261)', () => {
  it('an inspector that answered after the signal: the attach says what it saw, in order, and claims no cause', () => {
    const probe = vi.fn();
    const footprint = inspectorFootprint({ ...at, alreadyActive: false }, probe);
    expect(footprint.field).toBe('inspector');
    expect(footprint.atAttach).toBe(
      "signalled: 127.0.0.1:9229 refused this attach's first probe, this attach then signalled PID 4242, " +
        'and an inspector answered there after the signal, unauthenticated; this server does not close it'
    );
    expect(footprint.atAttach).not.toMatch(UNOBSERVED);
    expect(probe).not.toHaveBeenCalled();
  });

  it.each([
    [
      { status: 'inspector', targets: [{ id: 'a', type: 'node', webSocketDebuggerUrl: 'ws://127.0.0.1:9229/a' }] } as InspectorProbe,
      'listening: an inspector answers on 127.0.0.1:9229, unauthenticated (one answered there after this attach signalled PID 4242); ' +
        'this server does not close it'
    ],
    [
      { status: 'closed' } as InspectorProbe,
      'not listening: 127.0.0.1:9229 no longer accepts connections (one answered there after this attach signalled PID 4242)'
    ],
    [
      { status: 'other', detail: '/json/list answered a list with no Node inspector target in it (0 entries)' } as InspectorProbe,
      'not checked: 127.0.0.1:9229 did not answer as an inspector (/json/list answered a list with no Node inspector target in it (0 entries)); ' +
        'one answered there after this attach signalled PID 4242, and this server does not close it'
    ],
    [
      { status: 'other', detail: 'no answer from /json/list within 1000 ms' } as InspectorProbe,
      'not checked: 127.0.0.1:9229 did not answer as an inspector (no answer from /json/list within 1000 ms); ' +
        'one answered there after this attach signalled PID 4242, and this server does not close it'
    ]
  ])('at the end, says what one probe of its address sees: %o', async (seen, text) => {
    const probe = vi.fn(async () => seen);
    const footprint = inspectorFootprint({ ...at, alreadyActive: false }, probe);
    const said = await footprint.atEnd();
    expect(said).toBe(text);
    expect(said).not.toMatch(UNOBSERVED);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith('127.0.0.1', 9229);
  });

  // The review's construction: an ordinary HTTP server on the address at the end, answering a JSON array.
  it('an ordinary HTTP server on the address at the end is not called an inspector (the real probe)', async () => {
    const server = http.createServer((_req, res) => { res.setHeader('content-type', 'application/json'); res.end('[]'); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      const said = await inspectorFootprint({ ...at, port, alreadyActive: false }).atEnd();
      expect(said).toBe(
        `not checked: 127.0.0.1:${port} did not answer as an inspector (/json/list answered a list with no Node inspector target in it (0 entries)); ` +
          'one answered there after this attach signalled PID 4242, and this server does not close it'
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // The review's construction: a title ending in `[<another PID>]` is a script's path, so whose inspector answered is not observed.
  it('an inspector that answered the first probe: left as it was, under the same field, nothing is probed, and no PID is named', async () => {
    const probe = vi.fn();
    const footprint = inspectorFootprint({ ...at, port: 5935, alreadyActive: true }, probe);
    expect(footprint.field).toBe('inspector');
    expect(footprint.atAttach).toBe(
      "already open: an inspector answered this attach's first probe on 127.0.0.1:5935, so no signal was sent; this server does not close it"
    );
    const atEnd = await footprint.atEnd();
    expect(atEnd).toBe(
      "left as it was: an inspector answered this attach's first probe on 127.0.0.1:5935, so no signal was sent; this server does not close it"
    );
    for (const text of [footprint.atAttach, atEnd]) expect(text).not.toMatch(/PID|4242/);
    expect(probe).not.toHaveBeenCalled();
  });

  it('after a failure that followed the signal: says the PID was signalled, and nothing more', async () => {
    const footprint = signalledFootprint({ pid: 4242, host: '127.0.0.1', port: 5915 });
    const text = 'signalled: this attach signalled PID 4242, and no inspector of it was identified on 127.0.0.1:5915; ' +
      'one may now be open on another port, and this server does not close it';
    expect(footprint.field).toBe('inspector');
    expect(footprint.atAttach).toBe(text);
    await expect(footprint.atEnd()).resolves.toBe(text);
    expect(text).not.toMatch(UNOBSERVED);
  });
});
