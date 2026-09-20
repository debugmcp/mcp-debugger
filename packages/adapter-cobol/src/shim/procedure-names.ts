/**
 * PROCEDURE DIVISION names as breakpoint targets and step boundaries.
 *
 * A paragraph or section is not a C function — cobc emits it as a label inside
 * the program's body function (`PARAGRAPH_1000__INIT_l_5:`), which LLDB cannot
 * set a function breakpoint on (measured: 0 locations). The manifest's procedure
 * map says which source lines a range covers, and its statement list which of
 * those lines are statements, so a name becomes a source location: the range's
 * first statement. A PROGRAM-ID likewise becomes its first statement.
 */
import type { CobolProcRange, CobolStatementLocation } from '../manifest/schema.js';
import type { ManifestRegistry, ProgramEntry } from './manifest-registry.js';

export interface ResolvedProcedure {
  ok: true;
  entry: ProgramEntry;
  kind: 'paragraph' | 'section' | 'program';
  /** Upper-cased COBOL name. */
  name: string;
  path: string;
  line: number;
  /** For the response: `1000-INIT (paragraph of HELLO)`. */
  description: string;
}

export type ProcedureResolution =
  | ResolvedProcedure
  /** Not a COBOL procedure name (a C function like `HELLO_`): the engine's business. */
  | { ok: false; reason: 'not-cobol' }
  | { ok: false; reason: 'unknown' | 'ambiguous'; message: string };

/** A COBOL user-defined word as cobc accepts it: letters, digits, `-` and `_` (`_` is what routes a C symbol here too, so the manifests are consulted first). */
const COBOL_WORD = '[A-Z0-9_][A-Z0-9_-]*';
const QUALIFIED_RE = new RegExp(`^(${COBOL_WORD})\\s+(?:OF|IN)\\s+(${COBOL_WORD})$`);
const COLON_RE = new RegExp(`^(${COBOL_WORD})\\s*:\\s*(${COBOL_WORD})$`);
const BARE_RE = new RegExp(`^${COBOL_WORD}$`);
const C_IDENTIFIER_RE = /^[A-Za-z_]\w*$/;

interface Candidate {
  entry: ProgramEntry;
  kind: 'paragraph' | 'section';
  range: CobolProcRange;
}

/** Statements of a range in source order, copybook statements included. */
export function statementsIn(entry: ProgramEntry, range: CobolProcRange): CobolStatementLocation[] {
  return entry.program.procedure.statements
    .filter((s) => s.sourceFileId === range.sourceFileId && s.line >= range.startLine && s.line <= range.endLine)
    .sort((a, b) => a.line - b.line);
}

/** The line a breakpoint on a range should bind to: its first statement, else its header line. */
export function firstStatementLine(entry: ProgramEntry, range: CobolProcRange): number {
  const first = statementsIn(entry, range)[0];
  return first ? first.line : range.startLine;
}

/**
 * Where a PROGRAM-ID breakpoint binds: the first statement of the program's own source at
 * or after its entry line (the `Entry` cobc records after any DECLARATIVES — a `USE`
 * handler's statements come first in the source but run only when their condition
 * trips), else the first range header, else the PROCEDURE DIVISION line.
 */
export function programEntryLocation(entry: ProgramEntry): { fileId: number; line: number } | undefined {
  const program = entry.program;
  const floor = program.entryLine ?? program.procedureDivisionLine ?? 0;
  const own = program.procedure.statements
    .filter((s) => s.sourceFileId === program.sourceFileId && s.line >= floor)
    .sort((a, b) => a.line - b.line)[0];
  if (own) {
    return { fileId: program.sourceFileId, line: own.line };
  }
  const header = [...program.procedure.paragraphs, ...program.procedure.sections]
    .filter((r) => r.sourceFileId === program.sourceFileId && r.startLine >= floor)
    .sort((a, b) => a.startLine - b.startLine)[0];
  if (header) {
    return { fileId: program.sourceFileId, line: header.startLine };
  }
  return program.procedureDivisionLine !== undefined ? { fileId: program.sourceFileId, line: program.procedureDivisionLine } : undefined;
}

function candidatesNamed(registry: ManifestRegistry, name: string, programFilter?: string): Candidate[] {
  const out: Candidate[] = [];
  for (const entry of registry.programs) {
    if (programFilter && entry.program.programId !== programFilter) {
      continue;
    }
    for (const range of entry.program.procedure.paragraphs) {
      if (range.name === name) {
        out.push({ entry, kind: 'paragraph', range });
      }
    }
    for (const range of entry.program.procedure.sections) {
      if (range.name === name) {
        out.push({ entry, kind: 'section', range });
      }
    }
  }
  return out;
}

function locate(registry: ManifestRegistry, candidate: Candidate): ResolvedProcedure | undefined {
  const source = registry.sourceById(candidate.entry, candidate.range.sourceFileId);
  if (!source) {
    return undefined;
  }
  return {
    ok: true,
    entry: candidate.entry,
    kind: candidate.kind,
    name: candidate.range.name,
    path: source.path,
    line: firstStatementLine(candidate.entry, candidate.range),
    description: `${candidate.range.name} (${candidate.kind} of ${candidate.entry.program.programId})`
  };
}

function programNamed(registry: ManifestRegistry, name: string): ResolvedProcedure | undefined {
  const entry = registry.programs.find((e) => e.program.programId === name);
  if (!entry) {
    return undefined;
  }
  const location = programEntryLocation(entry);
  const source = location ? registry.sourceById(entry, location.fileId) : undefined;
  if (!location || !source) {
    return undefined;
  }
  return { ok: true, entry, kind: 'program', name, path: source.path, line: location.line, description: `${name} (program entry)` };
}

/**
 * `1000-INIT`, `1000-INIT OF PAYROLL` / `1000-INIT IN PAYROLL` / `PAYROLL:1000-INIT`, a
 * section name, or a PROGRAM-ID. The qualifier is a program id, else the section the
 * paragraph is in. A bare name found in several programs is ambiguous, not a guess.
 */
export function resolveProcedureName(registry: ManifestRegistry, raw: string): ProcedureResolution {
  const text = raw.trim().toUpperCase();
  if (registry.programCount === 0) {
    return { ok: false, reason: 'not-cobol' };
  }
  const known = (): string => registry.programs.map((e) => e.program.programId).join(', ');
  const qualified = QUALIFIED_RE.exec(text) ?? (COLON_RE.exec(text) ? [text, COLON_RE.exec(text)![2], COLON_RE.exec(text)![1]] : null);
  if (qualified) {
    const [, name, qualifier] = qualified;
    let candidates = candidatesNamed(registry, name, qualifier);
    if (candidates.length === 0) {
      candidates = candidatesNamed(registry, name).filter((c) => c.kind === 'paragraph' && c.range.sectionName === qualifier);
    }
    if (candidates.length === 0) {
      return { ok: false, reason: 'unknown', message: `no paragraph or section ${name} in ${qualifier} (loaded programs: ${known()})` };
    }
    const located = locate(registry, candidates[0]);
    return located ?? { ok: false, reason: 'unknown', message: `${name} has no source location in the manifest` };
  }
  if (!BARE_RE.test(text)) {
    return { ok: false, reason: 'not-cobol' };
  }
  const candidates = candidatesNamed(registry, text);
  if (candidates.length === 0) {
    const program = programNamed(registry, text);
    if (program) {
      return program;
    }
    if (C_IDENTIFIER_RE.test(raw.trim())) {
      // `HELLO_`, `cob_runtime_error`: a C symbol the engine can bind by itself.
      return { ok: false, reason: 'not-cobol' };
    }
    return { ok: false, reason: 'unknown', message: `no paragraph, section or program named ${text} in the loaded manifests (programs: ${known()})` };
  }
  const programs = [...new Set(candidates.map((c) => c.entry.program.programId))];
  if (programs.length > 1) {
    return {
      ok: false,
      reason: 'ambiguous',
      message: `${text} exists in ${programs.join(' and ')}; qualify it (${text} OF ${programs[0]})`
    };
  }
  if (candidates.length > 1) {
    // One program, several ranges with the name (a paragraph per SECTION is legal COBOL).
    const places = candidates.map((c) => (c.kind === 'paragraph' && c.range.sectionName ? `section ${c.range.sectionName}` : `${c.kind} at line ${c.range.startLine}`));
    const first = candidates.find((c) => c.kind === 'paragraph' && c.range.sectionName);
    const hint = first ? ` (${text} OF ${first.range.sectionName})` : '';
    return {
      ok: false,
      reason: 'ambiguous',
      message: `${text} exists more than once in ${programs[0]} (${places.join(', ')}); qualify it${hint}`
    };
  }
  const located = locate(registry, candidates[0]);
  return located ?? { ok: false, reason: 'unknown', message: `${text} has no source location in the manifest` };
}
