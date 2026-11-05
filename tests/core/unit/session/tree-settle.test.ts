/**
 * selectSettledInTree: which session a tree-aware wait_for_stop answers for
 * (the session tree, issue #1081; docs/architecture/session-tree.md, "wait_for_stop
 * is tree-aware"). A pure read over the session and its descendants in the
 * rule-2 order (depth first, adoption order within a level):
 *   1. the session itself when it is paused or in error;
 *   2. else the first descendant that is paused or in error;
 *   3. else the session itself when it has ended;
 *   4. else nothing — only descendants have ended and the session still runs.
 */
import { describe, it, expect } from 'vitest';
import { SessionState } from '@debugmcp/shared';
import { selectSettledInTree } from '../../../../src/session/execution/tree-settle.js';

const node = (id: string, state: SessionState) => ({ id, state });

describe('selectSettledInTree', () => {
  it('answers a paused descendant for a running session (rule 2)', () => {
    const parent = node('p', SessionState.RUNNING);
    const child = node('c', SessionState.PAUSED);
    expect(selectSettledInTree(parent, [child])?.id).toBe('c');
  });

  it('answers the session itself before its paused descendants (rule 1)', () => {
    const parent = node('p', SessionState.PAUSED);
    expect(selectSettledInTree(parent, [node('c', SessionState.PAUSED)])?.id).toBe('p');
  });

  it('counts an errored session as settled (rule 1) and an errored descendant too (rule 2)', () => {
    expect(selectSettledInTree(node('p', SessionState.ERROR), [])?.id).toBe('p');
    expect(selectSettledInTree(node('p', SessionState.RUNNING), [node('c', SessionState.ERROR)])?.id).toBe('c');
  });

  it('takes the first settled descendant in the order given — a paused grandchild before a paused later child', () => {
    const descendants = [
      node('c1', SessionState.RUNNING),
      node('g1', SessionState.PAUSED),
      node('c2', SessionState.PAUSED)
    ];
    expect(selectSettledInTree(node('p', SessionState.RUNNING), descendants)?.id).toBe('g1');
  });

  it('skips descendants that have ended', () => {
    const descendants = [node('c1', SessionState.STOPPED), node('c2', SessionState.PAUSED)];
    expect(selectSettledInTree(node('p', SessionState.RUNNING), descendants)?.id).toBe('c2');
  });

  it('answers the session itself when it has ended and nothing below is paused (rule 3)', () => {
    const parent = node('p', SessionState.STOPPED);
    expect(selectSettledInTree(parent, [node('c', SessionState.STOPPED)])?.id).toBe('p');
    expect(selectSettledInTree(parent, [])?.id).toBe('p');
  });

  it('answers a paused child of an ended session (rule 2 before rule 3)', () => {
    const parent = node('p', SessionState.STOPPED);
    expect(selectSettledInTree(parent, [node('c', SessionState.PAUSED)])?.id).toBe('c');
  });

  it('keeps waiting when only descendants have ended and the session still runs (rule 4)', () => {
    const parent = node('p', SessionState.RUNNING);
    expect(selectSettledInTree(parent, [node('c', SessionState.STOPPED)])).toBeUndefined();
  });

  it('keeps waiting for a running, initializing or created session with nothing settled below', () => {
    for (const state of [SessionState.RUNNING, SessionState.INITIALIZING, SessionState.CREATED, SessionState.READY]) {
      expect(selectSettledInTree(node('p', state), [node('c', SessionState.RUNNING)])).toBeUndefined();
      expect(selectSettledInTree(node('p', state), [])).toBeUndefined();
    }
  });
});
