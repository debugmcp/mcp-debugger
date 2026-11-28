/**
 * Issue #1261: what an attach by processId leaves in a Node.js target — the
 * inspector, which this server never closes — said in the `inspector` field.
 */
import { describe, it, expect, vi } from 'vitest';
import { inspectorFootprint } from '../../src/utils/inspector-footprint.js';
import type { InspectorProbe } from '../../src/utils/inspector-activation.js';

const at = { host: '127.0.0.1', port: 9229 };

describe('inspectorFootprint (issue #1261)', () => {
  it('an inspector this attach opened: the attach says it stays open, unauthenticated, until the target restarts', () => {
    const probe = vi.fn();
    const footprint = inspectorFootprint({ ...at, alreadyActive: false }, probe);
    expect(footprint.field).toBe('inspector');
    expect(footprint.atAttach).toBe(
      'opened by this attach on 127.0.0.1:9229; it stays open, unauthenticated, after this session ends, until the target restarts'
    );
    expect(probe).not.toHaveBeenCalled();
  });

  it.each([
    [
      { status: 'inspector', targets: [] } as InspectorProbe,
      'still listening: 127.0.0.1:9229, where this attach opened the inspector, still answers as one, unauthenticated; ' +
        'this server does not close it, and restarting the target does'
    ],
    [
      { status: 'closed' } as InspectorProbe,
      'no longer listening: 127.0.0.1:9229, where this attach opened the inspector, no longer accepts connections'
    ],
    [
      { status: 'other', detail: 'no answer from /json/list within 1000 ms' } as InspectorProbe,
      'not checked: 127.0.0.1:9229, where this attach opened the inspector, did not answer as one (no answer from /json/list within 1000 ms); ' +
        'this server does not close it, and restarting the target does'
    ]
  ])('at the end, says what one probe of its address sees: %o', async (seen, text) => {
    const probe = vi.fn(async () => seen);
    const footprint = inspectorFootprint({ ...at, alreadyActive: false }, probe);
    await expect(footprint.atEnd()).resolves.toBe(text);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith('127.0.0.1', 9229);
  });

  it('an inspector that was already open: left as it was, and nothing is probed', async () => {
    const probe = vi.fn();
    const footprint = inspectorFootprint({ host: '127.0.0.1', port: 5935, alreadyActive: true }, probe);
    expect(footprint.atAttach).toBe('already open on 127.0.0.1:5935 before this attach; left as it was');
    await expect(footprint.atEnd()).resolves.toBe('left as it was: it was already open on 127.0.0.1:5935 before this attach');
    expect(probe).not.toHaveBeenCalled();
  });
});
