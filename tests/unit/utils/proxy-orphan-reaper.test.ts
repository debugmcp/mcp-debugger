import { describe, it, expect, vi } from 'vitest';
import { reapOrphanProxies, type TaggedProxy } from '../../../src/utils/proxy-orphan-reaper.js';

const make = (over: Partial<TaggedProxy> = {}): TaggedProxy => ({
  pid: 9001,
  ownerPid: 12345,
  sessionId: 'sess-default',
  ...over,
});

describe('reapOrphanProxies', () => {
  it('kills tagged proxy workers whose owner PID is dead', async () => {
    const orphan = make({ pid: 9001, ownerPid: 12345 });
    const killer = vi.fn().mockResolvedValue(true);
    const result = await reapOrphanProxies({
      selfPid: 99999,
      lister: async () => [orphan],
      isAlive: () => false,
      killer,
    });
    expect(killer).toHaveBeenCalledWith(9001);
    expect(result.killed).toEqual([orphan]);
    expect(result.skipped).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.scanned).toBe(1);
  });

  it('skips workers whose owner PID is still alive (concurrent instance)', async () => {
    const live = make({ pid: 9001, ownerPid: 11111 });
    const killer = vi.fn();
    const result = await reapOrphanProxies({
      selfPid: 99999,
      lister: async () => [live],
      isAlive: (pid) => pid === 11111,
      killer,
    });
    expect(killer).not.toHaveBeenCalled();
    expect(result.killed).toEqual([]);
    expect(result.skipped).toEqual([live]);
  });

  it('skips workers whose owner PID matches selfPid (PID-recycle defense)', async () => {
    const recycled = make({ pid: 9001, ownerPid: 99999 });
    const killer = vi.fn();
    const result = await reapOrphanProxies({
      selfPid: 99999,
      lister: async () => [recycled],
      // isAlive returns false to ensure the selfPid check happens first
      isAlive: () => false,
      killer,
    });
    expect(killer).not.toHaveBeenCalled();
    expect(result.skipped).toEqual([recycled]);
  });

  it('treats killer resolving false as skipped, not killed', async () => {
    const orphan = make();
    const killer = vi.fn().mockResolvedValue(false); // ESRCH or EPERM
    const result = await reapOrphanProxies({
      selfPid: 99999,
      lister: async () => [orphan],
      isAlive: () => false,
      killer,
    });
    expect(result.killed).toEqual([]);
    expect(result.skipped).toEqual([orphan]);
    expect(result.errors).toEqual([]);
  });

  it('captures killer rejections in errors[] without throwing', async () => {
    const orphan = make({ pid: 9001 });
    const killer = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await reapOrphanProxies({
      selfPid: 99999,
      lister: async () => [orphan],
      isAlive: () => false,
      killer,
    });
    expect(result.killed).toEqual([]);
    expect(result.errors).toEqual(['boom']);
  });

  it('returns empty result with errors when lister throws', async () => {
    const result = await reapOrphanProxies({
      selfPid: 99999,
      lister: async () => {
        throw new Error('powershell unavailable');
      },
    });
    expect(result.scanned).toBe(0);
    expect(result.killed).toEqual([]);
    expect(result.errors).toEqual(['powershell unavailable']);
  });

  it('processes multiple workers concurrently and partitions in input order', async () => {
    const deadA = make({ pid: 100, ownerPid: 1, sessionId: 'a' });
    const live = make({ pid: 200, ownerPid: 2, sessionId: 'b' });
    const deadB = make({ pid: 300, ownerPid: 3, sessionId: 'c' });
    const own = make({ pid: 400, ownerPid: 99999, sessionId: 'd' });
    // deadA resolves slower than deadB — killed order must still follow input order
    const killer = vi.fn().mockImplementation((pid: number) =>
      pid === 100
        ? new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 20))
        : Promise.resolve(true),
    );
    const result = await reapOrphanProxies({
      selfPid: 99999,
      lister: async () => [deadA, live, deadB, own],
      isAlive: (pid) => pid === 2,
      killer,
    });
    expect(result.scanned).toBe(4);
    expect(result.killed).toEqual([deadA, deadB]);
    expect(result.skipped).toEqual([live, own]);
    expect(killer).toHaveBeenCalledTimes(2);
    expect(killer).toHaveBeenCalledWith(100);
    expect(killer).toHaveBeenCalledWith(300);
  });

  it('emits a log line per kill with the session id for correlation', async () => {
    const orphan = make({ pid: 9001, ownerPid: 12345, sessionId: 'sess-abc' });
    const info = vi.fn();
    await reapOrphanProxies({
      selfPid: 99999,
      lister: async () => [orphan],
      isAlive: () => false,
      killer: async () => true,
      logger: { info },
    });
    expect(info).toHaveBeenCalledTimes(1);
    const msg = info.mock.calls[0][0] as string;
    expect(msg).toContain('pid=9001');
    expect(msg).toContain('owner_pid=12345');
    expect(msg).toContain('session=sess-abc');
  });
});
