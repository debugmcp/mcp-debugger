/**
 * The facts of a run (issue #1214): how a session tree's program was started
 * is one fact, kept on the tree's root and read from there by every session
 * in the tree.
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import type { ManagedSession } from '../../../../src/session/session-store.js';
import { rootOfTree, runFactsOf } from '../../../../src/session/run-facts.js';

const session = (fields: Record<string, unknown>): ManagedSession => fields as unknown as ManagedSession;

function tree(...sessions: ManagedSession[]): (sessionId: string) => ManagedSession | undefined {
  const byId = new Map(sessions.map((entry) => [entry.id, entry]));
  return (sessionId) => byId.get(sessionId);
}

describe('rootOfTree', () => {
  it('is the session itself for a root, and the top of the chain for a child or a grandchild', () => {
    const root = session({ id: 'root' });
    const child = session({ id: 'child', parentSessionId: 'root' });
    const grandchild = session({ id: 'grandchild', parentSessionId: 'child' });
    const get = tree(root, child, grandchild);
    expect(rootOfTree(root, get)).toBe(root);
    expect(rootOfTree(child, get)).toBe(child === root ? child : root);
    expect(rootOfTree(grandchild, get)).toBe(root);
  });

  it('stops at the highest ancestor that still has a row, and never loops', () => {
    const orphan = session({ id: 'orphan', parentSessionId: 'gone' });
    expect(rootOfTree(orphan, tree(orphan))).toBe(orphan);
    const a = session({ id: 'a', parentSessionId: 'b' });
    const b = session({ id: 'b', parentSessionId: 'a' });
    expect(['a', 'b']).toContain(rootOfTree(a, tree(a, b)).id);
  });
});

describe('runFactsOf', () => {
  const launched = { program: '/w/node_modules/vitest/vitest.mjs', launchConfig: { program: '/w/node_modules/vitest/vitest.mjs' } };
  const request = { scriptPath: '/w/node_modules/vitest/vitest.mjs', dapLaunchArgs: { justMyCode: false } };
  const logDir = path.join('/logs', 'root', 'run-1');
  const root = session({ id: 'root', attachMode: false, transformedLaunch: launched, lastLaunch: request, logDir });
  // What adoption gives a child today: the parent's run directory, and none of the launch facts.
  const child = session({ id: 'child', parentSessionId: 'root', logDir });

  it("gives a child its root's launch: what ran, what was asked for, and the worker's one log", () => {
    const facts = runFactsOf(child, tree(root, child));
    expect(facts).toEqual({
      rootSessionId: 'root',
      attached: false,
      targetLocality: undefined,
      launch: launched,
      request,
      proxyLogPath: path.join(logDir, 'proxy-root.log')
    });
    expect(runFactsOf(root, tree(root, child))).toEqual(facts);
  });

  it("gives a child its root's attach: attached, where the target lives, and no launch", () => {
    const attachRoot = session({ id: 'root', attachMode: true, attachLocality: 'remote', transformedLaunch: launched, logDir });
    const facts = runFactsOf(child, tree(attachRoot, child));
    expect(facts.attached).toBe(true);
    expect(facts.targetLocality).toBe('remote');
    // An attach debugs some other process, whatever the session launched before.
    expect(facts.launch).toBeUndefined();
  });

  it('answers a session that has started nothing with nothing', () => {
    const fresh = session({ id: 'fresh' });
    expect(runFactsOf(fresh, tree(fresh))).toEqual({
      rootSessionId: 'fresh', attached: false, targetLocality: undefined, launch: undefined, request: undefined, proxyLogPath: undefined
    });
  });
});
