/**
 * The js-debug launch `skipFiles` defaults, shared by the JavaScript adapter's
 * launch transform (which sends them) and the JavaScript policy (which explains
 * a pause or step that they swallowed) so the two cannot drift (issue #678).
 *
 * Semantics follow VS Code's launch.json: a caller-supplied `skipFiles` list
 * replaces the default outright; otherwise node internals are always
 * blackboxed and `node_modules` is blackboxed only while `justMyCode` is not
 * `false`. js-debug has no `justMyCode` key of its own — the skip list is the
 * only mechanism behind the intent, which is why `justMyCode: false` used to
 * be inert on launch.
 */

export const JS_NODE_INTERNALS_SKIP = '<node_internals>/**';
export const JS_NODE_MODULES_SKIP = '**/node_modules/**';

export interface JsLaunchSkipInputs {
  justMyCode?: unknown;
  skipFiles?: unknown;
}

/** The effective js-debug launch `skipFiles` for these generic launch inputs. */
export function resolveJsLaunchSkipFiles(cfg: JsLaunchSkipInputs): string[] {
  if (Array.isArray(cfg.skipFiles)) {
    return cfg.skipFiles.filter((entry): entry is string => typeof entry === 'string');
  }
  return cfg.justMyCode === false
    ? [JS_NODE_INTERNALS_SKIP]
    : [JS_NODE_INTERNALS_SKIP, JS_NODE_MODULES_SKIP];
}

/** Whether the effective launch skip list blackboxes dependency code. */
export function jsLaunchBlackboxesNodeModules(cfg: JsLaunchSkipInputs): boolean {
  return resolveJsLaunchSkipFiles(cfg).includes(JS_NODE_MODULES_SKIP);
}
