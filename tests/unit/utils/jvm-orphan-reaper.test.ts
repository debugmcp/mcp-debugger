import { describe, it, expect, vi } from 'vitest';
import { reapOrphanJvms, type TaggedJvm } from '../../../src/utils/jvm-orphan-reaper.js';

const make = (over: Partial<TaggedJvm> = {}): TaggedJvm => ({
  pid: 9001,
  ownerPid: 12345,
  sessionTag: 'tag-default',
  ...over,
});

describe('reapOrphanJvms', () => {
  it('kills tagged JVMs whose owner PID is dead', async () => {
    const orphan = make({ pid: 9001, ownerPid: 12345 });
    const killer = vi.fn().mockReturnValue(true);
    const result = await reapOrphanJvms({
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

  it('skips JVMs whose owner PID is still alive (concurrent instance)', async () => {
    const live = make({ pid: 9001, ownerPid: 11111 });
    const killer = vi.fn();
    const result = await reapOrphanJvms({
      selfPid: 99999,
      lister: async () => [live],
      isAlive: (pid) => pid === 11111,
      killer,
    });
    expect(killer).not.toHaveBeenCalled();
    expect(result.killed).toEqual([]);
    expect(result.skipped).toEqual([live]);
  });

  it('skips JVMs whose owner PID matches selfPid (PID-recycle defense)', async () => {
    const recycled = make({ pid: 9001, ownerPid: 99999 });
    const killer = vi.fn();
    const result = await reapOrphanJvms({
      selfPid: 99999,
      lister: async () => [recycled],
      // isAlive returns false to ensure the selfPid check happens first
      isAlive: () => false,
      killer,
    });
    expect(killer).not.toHaveBeenCalled();
    expect(result.skipped).toEqual([recycled]);
  });

  it('treats killer returning false as skipped, not killed', async () => {
    const orphan = make();
    const killer = vi.fn().mockReturnValue(false); // ESRCH or EPERM
    const result = await reapOrphanJvms({
      selfPid: 99999,
      lister: async () => [orphan],
      isAlive: () => false,
      killer,
    });
    expect(result.killed).toEqual([]);
    expect(result.skipped).toEqual([orphan]);
    expect(result.errors).toEqual([]);
  });

  it('captures killer exceptions in errors[] without throwing', async () => {
    const orphan = make({ pid: 9001 });
    const killer = vi.fn().mockImplementation(() => {
      throw new Error('boom');
    });
    const result = await reapOrphanJvms({
      selfPid: 99999,
      lister: async () => [orphan],
      isAlive: () => false,
      killer,
    });
    expect(result.killed).toEqual([]);
    expect(result.errors).toEqual(['boom']);
  });

  it('returns empty result with errors when lister throws', async () => {
    const result = await reapOrphanJvms({
      selfPid: 99999,
      lister: async () => {
        throw new Error('ps unavailable');
      },
    });
    expect(result.scanned).toBe(0);
    expect(result.killed).toEqual([]);
    expect(result.errors).toEqual(['ps unavailable']);
  });

  it('processes multiple JVMs in a single pass and partitions correctly', async () => {
    const dead = make({ pid: 100, ownerPid: 1, sessionTag: 'a' });
    const live = make({ pid: 200, ownerPid: 2, sessionTag: 'b' });
    const own = make({ pid: 300, ownerPid: 99999, sessionTag: 'c' });
    const killer = vi.fn().mockReturnValue(true);
    const result = await reapOrphanJvms({
      selfPid: 99999,
      lister: async () => [dead, live, own],
      isAlive: (pid) => pid === 2,
      killer,
    });
    expect(result.scanned).toBe(3);
    expect(result.killed).toEqual([dead]);
    expect(result.skipped).toEqual([live, own]);
    expect(killer).toHaveBeenCalledTimes(1);
    expect(killer).toHaveBeenCalledWith(100);
  });

  it('emits a log line per kill with the session tag for correlation', async () => {
    const orphan = make({ pid: 9001, ownerPid: 12345, sessionTag: 'sess-abc' });
    const info = vi.fn();
    await reapOrphanJvms({
      selfPid: 99999,
      lister: async () => [orphan],
      isAlive: () => false,
      killer: () => true,
      logger: { info },
    });
    expect(info).toHaveBeenCalledTimes(1);
    const msg = info.mock.calls[0][0] as string;
    expect(msg).toContain('pid=9001');
    expect(msg).toContain('owner_pid=12345');
    expect(msg).toContain('tag=sess-abc');
  });
});
