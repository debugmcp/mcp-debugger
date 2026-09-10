import { describe, it, expect } from 'vitest';
import {
  JS_NODE_INTERNALS_SKIP,
  JS_NODE_MODULES_SKIP,
  jsLaunchBlackboxesNodeModules,
  resolveJsLaunchSkipFiles
} from '../../src/interfaces/js-launch-defaults.js';

describe('resolveJsLaunchSkipFiles (issue #678)', () => {
  it('blackboxes node internals and node_modules by default', () => {
    expect(resolveJsLaunchSkipFiles({})).toEqual([JS_NODE_INTERNALS_SKIP, JS_NODE_MODULES_SKIP]);
    expect(resolveJsLaunchSkipFiles({ justMyCode: true })).toEqual([JS_NODE_INTERNALS_SKIP, JS_NODE_MODULES_SKIP]);
  });

  it('keeps node internals but stops blackboxing node_modules when justMyCode is false', () => {
    expect(resolveJsLaunchSkipFiles({ justMyCode: false })).toEqual([JS_NODE_INTERNALS_SKIP]);
  });

  it('lets a caller list replace the defaults entirely (VS Code launch.json semantics)', () => {
    expect(resolveJsLaunchSkipFiles({ skipFiles: ['**/foo/**'] })).toEqual(['**/foo/**']);
    expect(resolveJsLaunchSkipFiles({ skipFiles: ['**/foo/**'], justMyCode: true })).toEqual(['**/foo/**']);
    expect(resolveJsLaunchSkipFiles({ skipFiles: ['**/foo/**'], justMyCode: false })).toEqual(['**/foo/**']);
  });

  it('treats an empty caller list as "skip nothing"', () => {
    expect(resolveJsLaunchSkipFiles({ skipFiles: [] })).toEqual([]);
  });

  it('ignores a non-array skipFiles and drops non-string entries', () => {
    expect(resolveJsLaunchSkipFiles({ skipFiles: '**/foo/**' })).toEqual([JS_NODE_INTERNALS_SKIP, JS_NODE_MODULES_SKIP]);
    expect(resolveJsLaunchSkipFiles({ skipFiles: ['**/foo/**', 42, null] })).toEqual(['**/foo/**']);
  });

  it('returns a fresh array every call', () => {
    const first = resolveJsLaunchSkipFiles({});
    first.push('mutated');
    expect(resolveJsLaunchSkipFiles({})).toEqual([JS_NODE_INTERNALS_SKIP, JS_NODE_MODULES_SKIP]);
  });
});

describe('jsLaunchBlackboxesNodeModules (issue #678)', () => {
  it('is true for the default launch and false once justMyCode is off', () => {
    expect(jsLaunchBlackboxesNodeModules({})).toBe(true);
    expect(jsLaunchBlackboxesNodeModules({ justMyCode: true })).toBe(true);
    expect(jsLaunchBlackboxesNodeModules({ justMyCode: false })).toBe(false);
  });

  it('follows the caller list when one is given', () => {
    expect(jsLaunchBlackboxesNodeModules({ skipFiles: ['**/foo/**'] })).toBe(false);
    expect(jsLaunchBlackboxesNodeModules({ skipFiles: ['**/foo/**', JS_NODE_MODULES_SKIP], justMyCode: false })).toBe(true);
  });
});
