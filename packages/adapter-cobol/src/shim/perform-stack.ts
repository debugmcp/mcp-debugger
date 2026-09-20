/**
 * The PERFORM stack as stack frames.
 *
 * A COBOL program is one C function, so the engine shows a single frame for it
 * however many PERFORMs are active. libcob keeps the PERFORM stack in the
 * program's `frame_stack` (see perform-frames.ts): for each active entry the
 * shim synthesises a frame under the program's real frame — the performing
 * paragraph at the PERFORM statement, named `HELLO: 0000-MAIN (PERFORM
 * 1000-INIT)` — the way a COBOL programmer reads a call stack. The performed
 * range comes from the entry's `perform_through` (the label id cobc gave the
 * THRU-end paragraph, recorded in the manifest), the PERFORM statement from
 * the entry's return address through the engine's line table and the
 * manifest's `#line` map, which works on 3.1.2 and 3.2 alike.
 *
 * Synthesised frames carry ids from their own band and resolve, for scopes and
 * evaluation, to the real frame: the storage is the program's, whichever
 * PERFORM is active.
 */
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { CobolProcRange } from '../manifest/schema.js';
import type { EngineRequester } from './engine-client.js';
import type { ShimLogger } from './logger.js';
import type { ProgramEntry } from './manifest-registry.js';
import { readPerformDepth, readPerformThrough, readReturnAddress, resolveAddressLocation } from './perform-frames.js';
import type { CachedFrame, SessionState } from './session-state.js';

/** Frame ids the shim hands out for synthesised frames: above CodeLLDB's (thread-indexed thousands), below the variables band. */
export const PERFORM_FRAME_ID_BASE = 1 << 28;
/** How many active PERFORMs are shown; deeper stacks are runaway recursion, not a call chain worth listing. */
export const PERFORM_STACK_MAX = 32;

export interface PerformFrameInfo {
  /** The synthesised frame's id, fixed for the generation. */
  id: number;
  /** The PERFORM statement's location (the performing paragraph's line). */
  sourcePath: string;
  line: number;
  performing?: string;
  performed?: string;
  labelId: number;
}

function rangeByLabelId(entry: ProgramEntry, labelId: number): CobolProcRange | undefined {
  const { paragraphs, sections } = entry.program.procedure;
  return paragraphs.find((r) => r.labelId === labelId) ?? sections.find((r) => r.labelId === labelId);
}

/** One entry of the PERFORM stack, read through the engine in the program's real frame. */
async function readPerformEntry(
  engine: EngineRequester,
  state: SessionState,
  entry: ProgramEntry,
  engineFrameId: number,
  depth: number
): Promise<PerformFrameInfo | undefined> {
  const [address, labelId] = await Promise.all([
    readReturnAddress(engine, engineFrameId, depth),
    readPerformThrough(engine, engineFrameId, depth)
  ]);
  if (address === undefined) {
    return undefined;
  }
  const location = await resolveAddressLocation(engine, engineFrameId, address);
  if (!location) {
    return undefined;
  }
  let cobol: { fileId: number; line: number } | undefined;
  const direct = state.registry.sourceIdByPath(entry, location.path);
  if (direct !== undefined) {
    cobol = { fileId: direct, line: location.line };
  } else if (state.registry.isGeneratedSource(entry, location.path)) {
    const mapped = state.registry.mapGeneratedLine(entry, location.line);
    if (mapped) {
      cobol = { fileId: mapped.source.id, line: mapped.line };
    }
  }
  if (!cobol) {
    return undefined;
  }
  const source = state.registry.sourceById(entry, cobol.fileId);
  if (!source) {
    return undefined;
  }
  const where = state.registry.procedureAt(entry, cobol.fileId, cobol.line);
  const performed = labelId !== undefined ? rangeByLabelId(entry, labelId) : undefined;
  return {
    id: state.allocFrameId(),
    sourcePath: source.path,
    line: cobol.line,
    performing: where.paragraph ?? where.section,
    performed: performed?.name,
    labelId: labelId ?? 0
  };
}

/**
 * Insert the PERFORM stack of the innermost COBOL frame into a client-facing stack
 * (frames already annotated and cached). Returns the number of frames inserted; on any
 * failure the stack is left as the engine gave it.
 */
export async function insertPerformFrames(
  engine: EngineRequester,
  state: SessionState,
  logger: ShimLogger,
  threadId: number,
  frames: DebugProtocol.StackFrame[]
): Promise<number> {
  const at = frames.findIndex((frame) => state.frame(frame.id)?.isCobol);
  if (at < 0) {
    return 0;
  }
  const real = state.frame(frames[at].id);
  const entry = real?.program;
  if (!real || !entry || real.evalFrameId !== undefined) {
    return 0;
  }
  let infos: PerformFrameInfo[];
  try {
    infos = await state.memoise(`perform-stack:${threadId}:${real.id}`, async () => {
      const depth = await readPerformDepth(engine, real.id);
      if (depth === undefined || depth === 0) {
        return [];
      }
      const out: PerformFrameInfo[] = [];
      for (let level = Math.min(depth, PERFORM_STACK_MAX); level >= 1; level -= 1) {
        const info = await readPerformEntry(engine, state, entry, real.id, level);
        if (!info) {
          break;
        }
        out.push(info);
      }
      return out;
    });
  } catch (error) {
    logger.warn('PERFORM stack unavailable', error);
    return 0;
  }
  if (infos.length === 0) {
    return 0;
  }
  const synthesised: DebugProtocol.StackFrame[] = [];
  const cached: CachedFrame[] = [];
  infos.forEach((info, i) => {
    const id = info.id;
    const target = info.performed ?? `label l_${info.labelId}`;
    const label = `${entry.program.programId}: ${info.performing ?? '?'} (PERFORM ${target})`;
    synthesised.push({
      id,
      name: label,
      source: { name: path.basename(info.sourcePath), path: info.sourcePath },
      line: info.line,
      column: 1,
      presentationHint: 'subtle'
    });
    cached.push({
      id,
      index: at + 1 + i,
      threadId,
      program: entry,
      isCobol: true,
      label,
      paragraph: info.performing,
      sourcePath: info.sourcePath,
      line: info.line,
      evalFrameId: real.id
    });
  });
  // The frames below the program shift down; their cached indices follow.
  for (let i = at + 1; i < frames.length; i += 1) {
    const below = state.frame(frames[i].id);
    if (below) {
      state.cacheFrame({ ...below, index: below.index + synthesised.length });
    }
  }
  for (const frame of cached) {
    state.cacheFrame(frame);
  }
  frames.splice(at + 1, 0, ...synthesised);
  return synthesised.length;
}
