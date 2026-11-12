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
import { describeReleasedChildren, selectSettledInTree, withReleasedChildren } from '../../../../src/session/execution/tree-settle.js';

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

// Issue #1137: an answer said `childrenReleased: 1` and nothing else — not
// what the number means, not that the child ran undebugged, not which setting
// caused it — while its message went on promising a pause at a breakpoint only
// the released child could reach.
describe('describeReleasedChildren (issue #1137)', () => {
  it('says nothing for a run that released no child', () => {
    expect(describeReleasedChildren({})).toBeUndefined();
    expect(describeReleasedChildren({ releasedChildReports: 0 })).toBeUndefined();
  });

  it('names the setting when child sessions are off', () => {
    expect(describeReleasedChildren({ releasedChildReports: 1, releasedChildCauses: { 'adoption-off': 1 } })).toBe(
      '1 child process was released to run undebugged (child sessions are off: DEBUG_MCP_MAX_CHILD_SESSIONS=0): ' +
      'a breakpoint only it reaches will not hit.'
    );
  });

  it('names the cap that was reached, as a limit rather than as a variable somebody set', () => {
    expect(describeReleasedChildren({ releasedChildReports: 8, releasedChildCauses: { cap: 8 }, releasedChildCap: 32 })).toBe(
      '8 child processes were released to run undebugged (the tree is at its child-session cap of 32, ' +
      'which DEBUG_MCP_MAX_CHILD_SESSIONS raises): a breakpoint only they reach will not hit.'
    );
  });

  it('says so when the session cannot host child sessions, or an adoption failed', () => {
    expect(describeReleasedChildren({ releasedChildReports: 1, releasedChildCauses: { unsupported: 1 } }))
      .toContain('(this session cannot host child sessions)');
    expect(describeReleasedChildren({ releasedChildReports: 1, releasedChildCauses: { 'adoption-failed': 1 } }))
      .toContain("(its adoption failed; the server log has the adapter's error)");
  });

  it('lists each cause with its count when a run had more than one', () => {
    expect(
      describeReleasedChildren({
        releasedChildReports: 3,
        releasedChildCauses: { cap: 2, 'adoption-failed': 1 },
        releasedChildCap: 4
      })
    ).toBe(
      '3 child processes were released to run undebugged (2: the tree is at its child-session cap of 4, ' +
      "which DEBUG_MCP_MAX_CHILD_SESSIONS raises; 1: its adoption failed; the server log has the adapter's error): " +
      'a breakpoint only they reach will not hit.'
    );
  });

  it('still explains a count whose cause was not recorded', () => {
    expect(describeReleasedChildren({ releasedChildReports: 2 })).toBe(
      '2 child processes were released to run undebugged: a breakpoint only they reach will not hit.'
    );
  });
});

describe('withReleasedChildren', () => {
  const note = '1 child process was released to run undebugged: a breakpoint only it reaches will not hit.';

  it('leaves a message alone when there is nothing to add', () => {
    expect(withReleasedChildren('Paused (breakpoint) at /w/a.py:3', undefined)).toBe('Paused (breakpoint) at /w/a.py:3');
  });

  it('adds the sentence after the message, closing an unpunctuated one first', () => {
    expect(withReleasedChildren('Paused (breakpoint) at /w/a.py:3', note)).toBe(`Paused (breakpoint) at /w/a.py:3. ${note}`);
    expect(withReleasedChildren('The program exited with code 3.', note)).toBe(`The program exited with code 3. ${note}`);
  });
});
