/**
 * `stackTrace` annotation: the engine's C-level frames rendered the COBOL way.
 *
 * A frame belongs to a program when its name is the program's body function
 * (`HELLO_`) or entry wrapper (`HELLO`), else when its source path is owned by
 * exactly one program. A body-function frame that the engine locates in the
 * generated C (a runtime check inlined between two statements, or the CALL
 * site the engine reports as `main.c:139`) is moved back onto the COBOL line
 * the `#line` map says it came from — with the raw location kept in the name
 * (`CALLMAIN: 0000-MAIN [main.c:139]`) so the user can still see where the
 * engine really is.
 *
 * Only the body function is remapped: the entry wrapper and `main` sit after
 * the body in the same `.c` and would map to the last statement.
 */
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { CachedFrame, SessionState } from '../session-state.js';
import type { ProgramEntry } from '../manifest-registry.js';

/** The engine's `presentationHint`-free view of one frame, before the shim's rewrite. */
interface FrameLocation {
  sourcePath?: string;
  line: number;
}

function identifyProgram(state: SessionState, frame: DebugProtocol.StackFrame): ProgramEntry | undefined {
  const byName = state.registry.programByFunction(frame.name);
  if (byName) {
    return byName;
  }
  const owners = state.registry.programsBySource(frame.source?.path);
  return owners.length === 1 ? owners[0] : undefined;
}

function annotateOne(state: SessionState, frame: DebugProtocol.StackFrame, index: number, threadId: number): CachedFrame {
  const entry = identifyProgram(state, frame);
  const base: CachedFrame = {
    id: frame.id,
    index,
    threadId,
    program: entry,
    isCobol: false,
    label: frame.name,
    sourcePath: frame.source?.path,
    line: frame.line
  };
  if (!entry) {
    return base;
  }
  const program = entry.program;
  const isBody = frame.name === program.cFunction;
  const location: FrameLocation = { sourcePath: frame.source?.path, line: frame.line };
  let remappedFromC: CachedFrame['remappedFromC'];

  if (isBody && !state.registry.isManifestSource(location.sourcePath) && state.registry.isGeneratedSource(entry, location.sourcePath)) {
    const mapped = state.registry.mapGeneratedLine(entry, frame.line);
    if (mapped) {
      remappedFromC = { path: location.sourcePath ?? '', line: frame.line };
      location.sourcePath = path.normalize(mapped.source.path);
      location.line = mapped.line;
      frame.source = { name: path.basename(mapped.source.path), path: location.sourcePath };
      frame.line = mapped.line;
      frame.column = 1;
    }
  }

  const fileId = location.sourcePath !== undefined ? state.registry.sourceIdByPath(entry, location.sourcePath) : undefined;
  if (fileId === undefined) {
    // A program frame without a COBOL location (entry wrapper, module init): keep the engine's name.
    return base;
  }
  const where = state.registry.procedureAt(entry, fileId, location.line);
  let label = where.paragraph ? `${program.programId}: ${where.paragraph}` : program.programId;
  if (remappedFromC) {
    label += ` [${path.basename(remappedFromC.path)}:${remappedFromC.line}]`;
  }
  frame.name = label;
  return {
    ...base,
    isCobol: isBody,
    label,
    paragraph: where.paragraph,
    section: where.section,
    sourcePath: location.sourcePath,
    line: location.line,
    remappedFromC
  };
}

/** Rewrite the frames in place and cache them for this generation. */
export function annotateStackFrames(state: SessionState, frames: DebugProtocol.StackFrame[], threadId: number, startFrame = 0): CachedFrame[] {
  state.ensureManifests();
  const cached: CachedFrame[] = [];
  frames.forEach((frame, i) => {
    const entry = annotateOne(state, frame, startFrame + i, threadId);
    state.cacheFrame(entry);
    cached.push(entry);
  });
  return cached;
}

/** Whether a raw engine frame is a COBOL statement the step loop may stop on (see `ManifestRegistry.isLandedLocation`). */
export function isLandedCobolFrame(state: SessionState, frame: DebugProtocol.StackFrame): boolean {
  const sourcePath = frame.source?.path;
  if (!state.registry.isManifestSource(sourcePath) || sourcePath === undefined) {
    return false;
  }
  const byName = state.registry.programByFunction(frame.name);
  const candidates = byName ? [byName] : state.registry.programsBySource(sourcePath);
  return candidates.some((entry) => {
    const fileId = state.registry.sourceIdByPath(entry, sourcePath);
    return fileId !== undefined && state.registry.isLandedLocation(entry, fileId, frame.line);
  });
}
