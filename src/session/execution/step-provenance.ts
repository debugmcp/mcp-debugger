/**
 * Pure step-provenance and call-identity rules (issues #1180, #1182, #1183, #1184).
 *
 * A DAP `stopped` event with `reason: 'step'` only states that the debug engine
 * ended a step; it never compares where execution started with where it landed,
 * and DAP frame IDs are ephemeral per stop. This module captures the step's
 * starting stack from one `stackTrace` read and computes:
 *
 * 1. Factual positional disclosures when a `step` landing does not match the
 *    requested step's expected stack motion (`step_out` stopping at the same
 *    visible depth or with a frame of the starting function's name below the
 *    stop, `step_out` landing more than one frame shallower, `step_into`
 *    stopping in the starting function at the same visible depth, or a landing
 *    stack in which no starting function — or only the outermost entry —
 *    appears);
 * 2. Meaningful adapter-supplied step descriptions (e.g. COBOL PERFORM summaries),
 *    filtering generic boilerplate ("Paused", "Paused on step", "step");
 * 3. Call-stack-aware frame identity for `StopSnapshot.changedVariables`, so
 *    distinct calls from different call sites, `step_out` landings back in the
 *    origin function, and broken caller unwinds never diff two calls as one.
 */
import { type AdapterPolicy, type StackFrame } from '@debugmcp/shared';
import { samePath } from '../breakpoints/hit-verification.js';
import type { FrameSummary } from '../inspection/frame-anchor-resolver.js';
import { USER_DIRECTED_STOP_REASONS } from '../inspection/stop-anchor.js';

export type StepFlavor = 'stepOver' | 'stepInto' | 'stepOut';

/**
 * The call stack where a step was issued from, derived from a single unfiltered
 * `stackTrace` read before the step command is sent.
 */
export interface StepOrigin {
  /** Unfiltered top frame (needed by JS `describePendingStop` and Dart token-repeat). */
  rawTop?: StackFrame;
  /** Unfiltered frame count (used by Dart `repeatWhileOnOriginLine`). */
  rawDepth: number;
  /**
   * Policy-filtered stack matching `FrameAnchorResolver.resolve(..., false)`
   * at the origin stop, so origin-vs-landing comparisons see the same frame set
   * the user saw before stepping.
   */
  visibleFrames: StackFrame[];
  threadId: number;
}

/**
 * COBOL synthesizes active PERFORM callers as `<PROG>: <PARA> (PERFORM <TARGET>)`
 * while execution is inside `<TARGET>`; once `<TARGET>` returns, the frame in
 * `<PARA>` is named `<PROG>: <PARA>` without the call-site suffix. Strip the
 * suffix when comparing whether two stack positions name the same routine.
 */
const COBOL_PERFORM_CALLSITE_SUFFIX = /\s+\(PERFORM\s+[^()]+\)$/;

/**
 * Adapter `stopped.description` strings that merely restate `reason: 'step'`
 * (e.g. js-debug sends `"Paused"` on every step stop) and add nothing to the
 * step answer (issue #1182).
 */
const BOILERPLATE_STEP_DESCRIPTION = /^(?:paused(?:\s+on\s+step)?|step(?:ped(?:\s+(?:over|into|in|out))?)?)$/i;

/**
 * Raw hex or `@symbol` frame names produced when native stack unwinding fails
 * at a return instruction (e.g. MinGW g++ `50000061`, issue #1183 / #1204).
 */
const GARBAGE_UNWIND_FRAME_NAME = /^(?:@.+|0x[0-9a-f]+|[0-9a-f]{6,})$/i;

const TOP_LEVEL_ENTRY_NAMES: ReadonlySet<string> = new Set([
  '<module>',
  '<main>',
  '<anonymous>',
  '(anonymous)',
  'main'
]);

export function canonicalFrameName(name: string): string {
  return name.replace(COBOL_PERFORM_CALLSITE_SUFFIX, '');
}

export function sameFrameFunction(
  a: Pick<StackFrame, 'name' | 'file'>,
  b: Pick<StackFrame, 'name' | 'file'>
): boolean {
  return canonicalFrameName(a.name) === canonicalFrameName(b.name) && samePath(a.file, b.file);
}

/** Exclude traceback-only unwound frames (issue #1143) so live call heights align. */
export function liveFramesOf(frames: readonly StackFrame[]): StackFrame[] {
  return frames.filter((frame) => !frame.unwound);
}

/**
 * Build a `StepOrigin` from one unfiltered `getStackTraceDetailed` result,
 * reproducing `FrameAnchorResolver`'s keep-top-frame rule (issue #672) without
 * a second DAP `stackTrace` round trip.
 */
export function captureStepOrigin(
  rawFrames: readonly StackFrame[],
  policy: Pick<AdapterPolicy, 'filterStackFrames' | 'isAsyncBoundaryFrame'>,
  threadId: number,
  originStopReason?: string
): StepOrigin | undefined {
  if (rawFrames.length === 0) {
    return undefined;
  }
  const rawTop = rawFrames[0];
  let visibleFrames: StackFrame[];
  if (policy.filterStackFrames) {
    const filtered = policy.filterStackFrames([...rawFrames], false);
    if (filtered.length === 0) {
      visibleFrames = [rawTop];
    } else if (filtered[0].id !== rawTop.id) {
      const visibleIdx = rawFrames.findIndex((f) => f.id === filtered[0].id);
      const hiddenAbove = visibleIdx > 1 ? rawFrames.slice(1, visibleIdx) : [];
      const crossesAsyncBoundary =
        policy.isAsyncBoundaryFrame !== undefined &&
        hiddenAbove.some((frame) => policy.isAsyncBoundaryFrame!(frame));
      visibleFrames =
        USER_DIRECTED_STOP_REASONS.has(originStopReason ?? '') || crossesAsyncBoundary
          ? [rawTop, ...filtered]
          : filtered;
    } else {
      visibleFrames = filtered;
    }
  } else {
    visibleFrames = [...rawFrames];
  }
  return {
    rawTop,
    rawDepth: rawFrames.length,
    visibleFrames,
    threadId
  };
}

export interface CompareStepLandingOptions {
  /** Optional conditional policy explanation for active engine step filtering (issues #1184, #1328). */
  stepFilterHint?: string;
  /**
   * True when the proxy's own stepper already supplied a walk-limit explanation
   * in `lastStop.text` (JS `stepIntoReachedNoProgramCode`, issue #1130), so the
   * generic `step_into` note does not repeat it.
   */
  hasStepperWalkNote?: boolean;
  /** True when the landing stack has no program frame at all (`stopWithoutProgramFrame` already speaks). */
  noProgramFrame?: boolean;
}

/**
 * Compare a step's starting stack with its `reason: 'step'` landing stack and
 * return a neutral, factual positional disclosure when the two stacks prove
 * something the fixed `"Stepped ..."` message hides (issues #1180, #1184, #1328).
 */
export function compareStepOriginAndLanding(
  kind: StepFlavor,
  origin: StepOrigin | undefined,
  landingFrames: readonly StackFrame[],
  opts: CompareStepLandingOptions = {}
): string | undefined {
  if (!origin || opts.noProgramFrame) {
    return undefined;
  }
  const originLive = liveFramesOf(origin.visibleFrames);
  const landingLive = liveFramesOf(landingFrames);
  if (originLive.length === 0 || landingLive.length === 0) {
    return undefined;
  }

  const originTop = originLive[0];
  const landingTop = landingLive[0];

  // 1. No starting function in common, or only an outermost entry in common
  //    (e.g. Ruby Fiber / Enumerator switch #1198, or every starting frame having returned to its caller):
  const anySharedFrame = landingLive.some((lf) =>
    originLive.some((of) => sameFrameFunction(lf, of))
  );
  if (!anySharedFrame) {
    return `No starting function appears in the current visible stack (from '${originTop.name}', now in '${landingTop.name}').`;
  }
  //    Also catch two multi-frame stacks where only an outermost module/main
  //    entry appears in both while every call above it differs — except `stepInto`
  //    returning to the outermost line and entering a sibling call (`foo < main` ->
  //    `bar < main` on `bar(foo())`).
  if (originLive.length >= 2 && landingLive.length >= 2) {
    const originBottom = originLive[originLive.length - 1];
    const landingBottom = landingLive[landingLive.length - 1];
    const originAboveBottom = originLive.slice(0, -1);
    const landingAboveBottom = landingLive.slice(0, -1);
    const sharesAboveOutermost = landingAboveBottom.some((lf) =>
      originAboveBottom.some((of) => sameFrameFunction(lf, of))
    );
    const isStepIntoSiblingAtOutermost =
      kind === 'stepInto' &&
      landingLive.length === 2 &&
      sameFrameFunction(originBottom, landingBottom) &&
      originBottom.line === landingBottom.line;
    if (
      !sharesAboveOutermost &&
      !isStepIntoSiblingAtOutermost &&
      sameFrameFunction(originBottom, landingBottom) &&
      TOP_LEVEL_ENTRY_NAMES.has(canonicalFrameName(originBottom.name))
    ) {
      return `Only '${originBottom.name}' appears in both visible stacks (from '${originTop.name}', now in '${landingTop.name}').`;
    }
  }

  // 2. step_out comparisons:
  if (kind === 'stepOut') {
    // Check the bottom-up slot where `originTop` sat (`originBottomIdx = originLive.length - 1`).
    const originBottomIdx = originLive.length - 1;
    const landingIdxAtOriginSlot = landingLive.length - 1 - originBottomIdx;
    if (
      landingIdxAtOriginSlot >= 0 &&
      sameFrameFunction(landingLive[landingIdxAtOriginSlot], originTop)
    ) {
      if (landingIdxAtOriginSlot === 0) {
        return (
          `The stop is in '${originTop.name}' at the same visible call-stack depth as before step_out ` +
          `(the same call, or another call of '${originTop.name}').`
        );
      }
      return (
        `A frame named '${originTop.name}' appears ${landingIdxAtOriginSlot} visible frame(s) below the stop ` +
        `(the original call, or another call of '${originTop.name}').`
      );
    }

    const framesDropped = originLive.length - landingLive.length;
    if (framesDropped >= 2) {
      const expectedAncestor = originLive[framesDropped];
      if (expectedAncestor && sameFrameFunction(landingTop, expectedAncestor)) {
        return `The visible stack is ${framesDropped} frame(s) shallower than before step_out.`;
      }
    }
    return undefined;
  }

  // 3. step_into comparisons (#1180, #1184, #1328):
  if (kind === 'stepInto' && !opts.hasStepperWalkNote) {
    if (
      landingLive.length === originLive.length &&
      sameFrameFunction(landingTop, originTop)
    ) {
      const onStartingLine =
        landingTop.line === originTop.line && samePath(landingTop.file, originTop.file);
      const base =
        `The stop is in '${originTop.name}' at the same visible call-stack depth as before step_into.` +
        (onStartingLine ? ' It is on the starting source line.' : '');
      return opts.stepFilterHint ? `${base} ${opts.stepFilterHint}` : base;
    }
  }

  return undefined;
}

/**
 * Return the adapter's `stopped.description` for a `step` stop when it carries
 * actual information (e.g. COBOL's `"returned from BUMP-PARA to VIA-TIMES …"`),
 * or `undefined` when absent or generic boilerplate (issue #1182).
 */
export function meaningfulStepStopDescription(description: string | undefined): string | undefined {
  if (typeof description !== 'string') {
    return undefined;
  }
  const trimmed = description.trim();
  if (trimmed.length === 0 || BOILERPLATE_STEP_DESCRIPTION.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

/**
 * Call-stack-aware key for `StopSnapshot.changedVariables` (issue #1183):
 * includes the thread, anchor frame's canonical name and file, and the live
 * caller chain (`name|file|line` per caller), so calls from different threads or
 * call sites never diff against each other while stepping within one call
 * keeps an identical caller chain.
 */
export function buildSnapshotFrameKey(
  anchor: Pick<FrameSummary, 'name' | 'file'>,
  frames: readonly StackFrame[],
  threadId?: number
): string {
  const live = liveFramesOf(frames);
  const callers = live
    .slice(1)
    .map((f) => `${canonicalFrameName(f.name)}@${f.file}:${f.line}`)
    .join('<');
  return `${threadId ?? 'unknown'}|${canonicalFrameName(anchor.name)}|${anchor.file}|${live.length}|${callers}`;
}

/**
 * True when frame 1 (the immediate caller) looks like a failed stack unwind —
 * no openable source and a raw address / `@symbol` name (issue #1183 / #1204).
 */
export function hasUnresolvedCallerUnwind(frames: readonly StackFrame[]): boolean {
  const live = liveFramesOf(frames);
  const caller = live[1];
  if (!caller) {
    return false;
  }
  const noSource =
    caller.file === '' ||
    caller.file.startsWith('<') ||
    caller.file.startsWith('@') ||
    caller.unresolvedSource === true;
  return noSource && GARBAGE_UNWIND_FRAME_NAME.test(caller.name.trim());
}

/**
 * True when a stop produced by `step_out` landed at the same call-stack slot
 * and function the `step_out` started from (issue #1183: e.g. `[11, 21].map(key)`
 * stopping in the next invocation of `key`). Such a stop cannot be assumed to
 * be the same activation and must emit full `locals` rather than `changedVariables`.
 */
export function stepOutReenteredOriginFrame(
  flavor: StepFlavor | undefined,
  origin: StepOrigin | undefined,
  landingFrames: readonly StackFrame[]
): boolean {
  if (flavor !== 'stepOut' || !origin) {
    return false;
  }
  const originLive = liveFramesOf(origin.visibleFrames);
  const landingLive = liveFramesOf(landingFrames);
  if (originLive.length === 0 || landingLive.length !== originLive.length) {
    return false;
  }
  return sameFrameFunction(landingLive[0], originLive[0]);
}
