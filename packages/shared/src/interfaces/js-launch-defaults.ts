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

import * as path from 'path';

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

export interface JsLaunchSourceMapInputs {
  program?: unknown;
  cwd?: unknown;
  __workspaceFolder?: unknown;
  pauseForSourceMap?: unknown;
}

/** A TypeScript program handed to a transpiling runtime (tsx/ts-node). */
const TS_PROGRAM = /.([mc])?tsx?$/i;

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/**
 * js-debug's workspace root for a launch: an explicit `__workspaceFolder`,
 * else `cwd`, else the program's directory. Without it js-debug's config
 * resolution sets `rootPath` to undefined, its `outFiles` search is empty,
 * and its breakpoint predictor — which pre-binds a source-mapped breakpoint
 * before the program runs, the entry script and later-required modules
 * alike — never runs (issue #699). Relative `outFiles` resolve against it.
 */
export function resolveJsLaunchWorkspaceFolder(cfg: JsLaunchSourceMapInputs): string | undefined {
  if (nonEmptyString(cfg.__workspaceFolder)) {
    return cfg.__workspaceFolder;
  }
  if (nonEmptyString(cfg.cwd)) {
    return cfg.cwd;
  }
  return nonEmptyString(cfg.program) ? path.dirname(cfg.program) : undefined;
}

/**
 * The effective js-debug `pauseForSourceMap`: an explicit boolean wins.
 * Otherwise on only for a TypeScript program run through a transpiler, whose
 * generated code lives in memory where the predictor cannot see it, and off
 * (js-debug's own pwa-node default) for compiled JavaScript. The pause and
 * the predictor are exclusive in js-debug — with the instrumentation
 * breakpoint set it skips prediction — and under Node 24 the pause never
 * fires for a CommonJS entry module, which is what let a breakpoint on a
 * module-load line bind only after the line had run (issue #699).
 */
export function resolveJsPauseForSourceMap(cfg: JsLaunchSourceMapInputs): boolean {
  if (typeof cfg.pauseForSourceMap === 'boolean') {
    return cfg.pauseForSourceMap;
  }
  return nonEmptyString(cfg.program) && TS_PROGRAM.test(cfg.program);
}
