/**
 * The js-debug launch keys behind `justMyCode`, shared by the JavaScript
 * adapter's launch transform (which sends them) and the JavaScript policy
 * (which explains a pause or step they swallowed) so the two cannot drift
 * (issue #678). js-debug has no `justMyCode` key of its own.
 *
 * `skipFiles` follows VS Code's launch.json: a caller-supplied list replaces
 * the default outright; otherwise node internals are always blackboxed and
 * `node_modules` is blackboxed only while `justMyCode` is not `false`.
 *
 * `smartStep` is the gate on js-debug's resume-on-skipped-frame behaviour:
 * `getSmartStepDirection` returns early unless `launchConfig.smartStep`, and
 * only then reads whether the frame is blackboxed. It follows `justMyCode`
 * unless the caller sets it explicitly — the pair attach has had since #513.
 */

export const JS_NODE_INTERNALS_SKIP = '<node_internals>/**';
export const JS_NODE_MODULES_SKIP = '**/node_modules/**';

/** js-debug skips internals for any pattern that starts with `<node_internals>/` (or `\`). */
const NODE_INTERNALS_PATTERN = /^<node_internals>[\\/]/;

export interface JsLaunchSkipInputs {
  justMyCode?: unknown;
  skipFiles?: unknown;
  smartStep?: unknown;
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

/** Whether the effective launch skip list blackboxes Node internals. */
export function jsLaunchSkipsNodeInternals(cfg: JsLaunchSkipInputs): boolean {
  return resolveJsLaunchSkipFiles(cfg).some(pattern => NODE_INTERNALS_PATTERN.test(pattern));
}

/**
 * The effective js-debug launch `smartStep`: an explicit boolean wins,
 * otherwise on while `justMyCode` is not `false`. `justMyCode: false` means
 * "let me see everything", and the stepper is what would step past it.
 */
export function resolveJsLaunchSmartStep(cfg: JsLaunchSkipInputs): boolean {
  return typeof cfg.smartStep === 'boolean' ? cfg.smartStep : cfg.justMyCode !== false;
}
