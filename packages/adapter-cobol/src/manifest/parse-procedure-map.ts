/**
 * Program identity and procedure map from the generated `.c`.
 *
 * cobc brackets every program with `/* PROGRAM-ID 'X' *\/` … `/* End PROGRAM-ID 'X' *\/`
 * (nested programs are emitted as further top-level functions, so the brackets never
 * overlap), which is how one translation unit yields several `CobolProgram`s. Inside a
 * bracket the interesting lines are `#line N "path"` directives, which the C compiler turns
 * into the DWARF line table the debugger stops on, and cobc's own
 * `/* Line: N : Paragraph NAME : path *\/` comments, which are the only record of where a
 * paragraph or section begins. Everything else (statement bodies, frame bookkeeping) is
 * ignored.
 */
import type {
  CobolLineMapEntry,
  CobolManifestDiagnostic,
  CobolProcRange,
  CobolSourceFile,
  CobolStatementLocation
} from './schema.js';
import { baseName, unescapeCString } from './c-text.js';

/** Interns source paths exactly as cobc wrote them (after C-string unescaping) into `sources[]`. */
export class SourceFileRegistry {
  readonly sources: CobolSourceFile[] = [];
  private readonly ids = new Map<string, number>();

  /** Files default to `copybook`; the orchestrator promotes each program's own file. */
  idFor(sourcePath: string): number {
    const existing = this.ids.get(sourcePath);
    if (existing !== undefined) {
      return existing;
    }
    const id = this.sources.length;
    this.sources.push({ id, path: sourcePath, kind: 'copybook' });
    this.ids.set(sourcePath, id);
    return id;
  }

  markProgram(id: number): void {
    const source = this.sources[id];
    if (source) {
      source.kind = 'program';
    }
  }
}

export interface ProgramSegment {
  programId: string;
  /** The id before the manifest upper-cases it. */
  programIdAsWritten?: string;
  kind: 'program' | 'function';
  /** 1-based inclusive range of the segment within the `.c` file. */
  startLine: number;
  endLine: number;
  /** The segment's lines; `lines[i]` is file line `startLine + i`. */
  lines: string[];
  cFunction: string;
  cEntry: string;
  isMain: boolean;
}

const PROGRAM_START_RE = /^\s*\/\*\s*(PROGRAM-ID|FUNCTION-ID)\s+'([^']+)'\s*\*\//;
const PROGRAM_END_RE = /^\s*\/\*\s*End\s+(?:PROGRAM-ID|FUNCTION-ID)\s+'([^']+)'\s*\*\//;
const BODY_DEF_RE = /^([A-Za-z_]\w*)\s*\(\s*const\s+int\s+entry\b/;
const ENTRY_MARKER_RE = /\/\*\s*ENTRY\s+'([^']+)'\s*\*\//;
const FUNCTION_DEF_RE = /^([A-Za-z_]\w*)\s*\(/;
const END_OF_DUMP_RE = /cob_dump_output\s*\(\s*"END OF DUMP - ([^"]+)"/;
const LINE_DIRECTIVE_RE = /^\s*#\s*line\s+(\d+)\s+"((?:\\.|[^"\\])*)"/;
const RANGE_COMMENT_RE = /\/\*\s*Line:\s*(\d+)\s*:\s*(Paragraph|Section)\s+(\S+)\s*:\s*(.*?)\s*\*\//;
const LAST_LINE_COMMENT_RE = /\/\*\s*Line:\s*(\d+)\s*:\s*last source line\s*:\s*(.*?)\s*\*\//;
/** `/* Line: 31 : Entry HELLO : path *\/` — where the program's own code starts, after any DECLARATIVES. */
const ENTRY_COMMENT_RE = /\/\*\s*Line:\s*(\d+)\s*:\s*Entry\s+(\S+)\s*:\s*(.*?)\s*\*\//;
/** `/* Line: 89 : MOVE : path *\/` — one per PROCEDURE DIVISION statement, copybook statements included. */
const STATEMENT_COMMENT_RE = /\/\*\s*Line:\s*(\d+)\s*:\s*([A-Z][A-Z -]*):([^*]*)\*\//;
const RANGE_LABEL_RE = /^\s*((?:PARAGRAPH|SECTION)_\w+)\s*:/;
/** `l_5:;` — the label a PERFORM or GO TO jumps to; 3.2 also spells it inside the range label (`…_l_5`). */
const LABEL_LINE_RE = /^\s*l_(\d+)\s*:/;
const LABEL_SUFFIX_RE = /_l_(\d+)$/;

/** Undo `cb_encode_program_id`: `__` was `-`, `_XX` was a hex-escaped character. */
export function demangleProgramId(cName: string): string {
  return cName
    .replace(/_$/, '')
    .replace(/__/g, '-')
    .replace(/_([0-9A-F]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function findIsMain(cLines: string[], cFunction: string, isFirstSegment: boolean): boolean {
  // `flag_main` in `<PROG>_module_init` is per program in both 3.1.2 and 3.2 and is the
  // authoritative answer for nested programs, where only one of them owns `main`.
  const initName = `${cFunction}module_init`;
  const initIdx = cLines.findIndex((l) => new RegExp(`\\b${initName}\\s*\\(\\s*cob_module`).test(l));
  if (initIdx >= 0) {
    for (let i = initIdx; i < Math.min(cLines.length, initIdx + 120); i += 1) {
      const m = /flag_main\s*=\s*(\d)/.exec(cLines[i]);
      if (m) {
        return m[1] !== '0';
      }
    }
  }
  return isFirstSegment && cLines.some((l) => /^main\s*\(/.test(l));
}

function identifySegment(
  lines: string[],
  markerId: string | undefined,
  kind: 'program' | 'function',
  startLine: number,
  endLine: number,
  cLines: string[],
  isFirstSegment: boolean,
  diagnostics: CobolManifestDiagnostic[]
): ProgramSegment {
  let cFunction = '';
  let cEntry = '';
  let entryMarkerName: string | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!cFunction) {
      const body = BODY_DEF_RE.exec(line);
      if (body) {
        cFunction = body[1];
      }
    }
    if (!cEntry) {
      const marker = ENTRY_MARKER_RE.exec(line);
      if (marker) {
        entryMarkerName = marker[1];
        for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
          const def = FUNCTION_DEF_RE.exec(lines[j]);
          if (def && !BODY_DEF_RE.test(lines[j])) {
            cEntry = def[1];
            break;
          }
        }
      }
    }
    if (cFunction && cEntry) {
      break;
    }
  }

  let programId = markerId;
  if (!programId) {
    const dump = lines.map((l) => END_OF_DUMP_RE.exec(l)).find((m) => m !== null);
    programId = dump ? dump[1] : entryMarkerName ?? (cFunction ? demangleProgramId(cFunction) : '');
  }
  if (!cFunction) {
    diagnostics.push({
      level: 'warn',
      message: 'no body function `NAME_ (const int entry …)` found; frame matching will be unavailable',
      program: programId
    });
    cFunction = cEntry ? `${cEntry}_` : '';
  }
  if (!cEntry) {
    cEntry = cFunction.replace(/_$/, '');
  }
  return {
    programId,
    kind,
    startLine,
    endLine,
    lines,
    cFunction,
    cEntry,
    isMain: cFunction ? findIsMain(cLines, cFunction, isFirstSegment) : false
  };
}

/** Bracket the `.c` into one segment per PROGRAM-ID/FUNCTION-ID; the whole file when unmarked. */
export function splitProgramSegments(cLines: string[]): {
  segments: ProgramSegment[];
  diagnostics: CobolManifestDiagnostic[];
} {
  const diagnostics: CobolManifestDiagnostic[] = [];
  const segments: ProgramSegment[] = [];
  let open: { id: string; kind: 'program' | 'function'; startIdx: number } | undefined;

  for (let i = 0; i < cLines.length; i += 1) {
    const start = PROGRAM_START_RE.exec(cLines[i]);
    if (start) {
      if (open) {
        diagnostics.push({
          level: 'warn',
          message: `PROGRAM-ID '${open.id}' has no End marker before '${start[2]}'; closing it here`,
          program: open.id
        });
        segments.push(
          identifySegment(cLines.slice(open.startIdx, i), open.id, open.kind, open.startIdx + 1, i, cLines, segments.length === 0, diagnostics)
        );
      }
      open = { id: start[2], kind: start[1] === 'FUNCTION-ID' ? 'function' : 'program', startIdx: i };
      continue;
    }
    const end = PROGRAM_END_RE.exec(cLines[i]);
    if (end && open) {
      segments.push(
        identifySegment(cLines.slice(open.startIdx, i + 1), open.id, open.kind, open.startIdx + 1, i + 1, cLines, segments.length === 0, diagnostics)
      );
      open = undefined;
    }
  }
  if (open) {
    segments.push(
      identifySegment(cLines.slice(open.startIdx), open.id, open.kind, open.startIdx + 1, cLines.length, cLines, segments.length === 0, diagnostics)
    );
  }
  if (segments.length === 0) {
    diagnostics.push({
      level: 'warn',
      message: 'no PROGRAM-ID markers found in the generated C; treating the whole file as one program'
    });
    segments.push(identifySegment(cLines, undefined, 'program', 1, cLines.length, cLines, true, diagnostics));
  }
  return { segments, diagnostics };
}

export interface ProcedureMap {
  sourceFileId: number;
  lineMap: CobolLineMapEntry[];
  sections: CobolProcRange[];
  paragraphs: CobolProcRange[];
  statements: CobolStatementLocation[];
  procedureDivisionLine?: number;
  /** The line of cobc's `Entry` comment for the program's own entry. */
  entryLine?: number;
  diagnostics: CobolManifestDiagnostic[];
}

interface Directive {
  /** Absolute 1-based line of the directive in the `.c`. */
  atLine: number;
  line: number;
  path: string;
  isSelf: boolean;
}

function directiveAt(lines: string[], idx: number, startLine: number, cBase: string): Directive | undefined {
  const m = LINE_DIRECTIVE_RE.exec(lines[idx]);
  if (!m) {
    return undefined;
  }
  const filePath = unescapeCString(m[2]);
  return {
    atLine: startLine + idx,
    line: parseInt(m[1], 10),
    path: filePath,
    isSelf: baseName(filePath) === cBase
  };
}

/**
 * Build the line map and paragraph/section ranges for one segment.
 *
 * `fallbackSourcePath` (from the `Generated from` header) names the program's own file
 * when the segment carries no COBOL `#line` at all — a program with an empty PROCEDURE
 * DIVISION and no VALUE clauses.
 */
export function parseProcedureMap(
  segment: ProgramSegment,
  cPath: string,
  registry: SourceFileRegistry,
  fallbackSourcePath?: string
): ProcedureMap {
  const diagnostics: CobolManifestDiagnostic[] = [];
  const cBase = baseName(cPath);
  const { lines, startLine } = segment;

  const directives: Directive[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const d = directiveAt(lines, i, startLine, cBase);
    if (d) {
      directives.push(d);
    }
  }

  const lineMap: CobolLineMapEntry[] = [];
  for (let i = 0; i < directives.length; i += 1) {
    const d = directives[i];
    if (d.isSelf) {
      continue;
    }
    const next = directives[i + 1];
    lineMap.push({
      cLine: d.atLine + 1,
      endCLine: next ? next.atLine - 1 : segment.endLine,
      sourceFileId: registry.idFor(d.path),
      line: d.line
    });
  }

  // The program's own file is the one the entry point is attributed to — the first COBOL
  // directive in the body — not `st_source_files`, which omits copybooks that only
  // contribute DATA DIVISION lines.
  const firstCobol = directives.find((d) => !d.isSelf);
  let sourceFileId: number;
  if (firstCobol) {
    sourceFileId = registry.idFor(firstCobol.path);
  } else if (fallbackSourcePath) {
    sourceFileId = registry.idFor(fallbackSourcePath);
  } else {
    diagnostics.push({
      level: 'warn',
      message: 'no COBOL #line directive in the program body; attributing the program to the generated C file',
      program: segment.programId
    });
    sourceFileId = registry.idFor(cPath);
  }

  // A range comment is followed (within a couple of lines) by the `#line` that attributes
  // it; taking the file from that directive sidesteps the comment's own path spelling,
  // which on Windows differs from the directive's (`C:\x\y.cpy` vs `"C:\\x\\y.cpy"`).
  const ranges: CobolProcRange[] = [];
  const statements: CobolStatementLocation[] = [];
  const lastSourceLineByFile = new Map<number, number>();
  let currentSection: string | undefined;
  let entryLine: number | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    if (entryLine === undefined) {
      const entryComment = ENTRY_COMMENT_RE.exec(lines[i]);
      if (entryComment) {
        entryLine = parseInt(entryComment[1], 10);
        continue;
      }
    }
    const range = RANGE_COMMENT_RE.exec(lines[i]);
    const lastLine = range ? null : LAST_LINE_COMMENT_RE.exec(lines[i]);
    const statement = range || lastLine ? null : STATEMENT_COMMENT_RE.exec(lines[i]);
    const match = range ?? lastLine ?? statement;
    if (!match) {
      continue;
    }
    const cobolLine = parseInt(match[1], 10);
    const commentPath = range ? range[4] : lastLine ? lastLine[2] : match[3].trim();
    let fileId: number | undefined;
    let cLabel: string | undefined;
    let labelId: number | undefined;
    for (let j = i + 1; j < Math.min(lines.length, i + 5); j += 1) {
      const d = directiveAt(lines, j, startLine, cBase);
      if (d && !d.isSelf && d.line === cobolLine && fileId === undefined) {
        fileId = registry.idFor(d.path);
      }
      const label = RANGE_LABEL_RE.exec(lines[j]);
      if (label) {
        cLabel = label[1];
        const suffix = LABEL_SUFFIX_RE.exec(label[1]);
        if (suffix && labelId === undefined) {
          labelId = parseInt(suffix[1], 10);
        }
      }
      const bare = LABEL_LINE_RE.exec(lines[j]);
      if (bare && labelId === undefined) {
        labelId = parseInt(bare[1], 10);
      }
    }
    if (fileId === undefined) {
      fileId = commentPath ? registry.idFor(commentPath) : sourceFileId;
    }
    if (lastLine) {
      lastSourceLineByFile.set(fileId, cobolLine);
      continue;
    }
    if (statement) {
      statements.push({ sourceFileId: fileId, line: cobolLine, verb: statement[2].trim() });
      continue;
    }
    if (!range) {
      continue;
    }
    const kind = range[2] === 'Section' ? 'section' : 'paragraph';
    const name = range[3].toUpperCase();
    if (kind === 'section') {
      currentSection = name;
    }
    const entry: CobolProcRange = {
      name,
      kind,
      sourceFileId: fileId,
      startLine: cobolLine,
      endLine: cobolLine
    };
    if (kind === 'paragraph' && currentSection) {
      entry.sectionName = currentSection;
    }
    if (cLabel) {
      entry.cLabel = cLabel;
    }
    if (labelId !== undefined) {
      entry.labelId = labelId;
    }
    ranges.push(entry);
  }

  // endLine: the line before the next range start in the same file (sections only end at
  // the next section), else the last COBOL line attributed to that file — excluding cobc's
  // "last source line" marker, which points one past the final statement.
  const lastAttributed = new Map<number, number>();
  for (const row of lineMap) {
    if (lastSourceLineByFile.get(row.sourceFileId) === row.line) {
      continue;
    }
    lastAttributed.set(row.sourceFileId, Math.max(lastAttributed.get(row.sourceFileId) ?? 0, row.line));
  }
  for (const r of ranges) {
    const successors = ranges
      .filter((o) => o.sourceFileId === r.sourceFileId && o.startLine > r.startLine && (r.kind === 'paragraph' || o.kind === 'section'))
      .map((o) => o.startLine);
    if (successors.length > 0) {
      r.endLine = Math.max(r.startLine, Math.min(...successors) - 1);
    } else {
      const last = lastAttributed.get(r.sourceFileId) ?? lastSourceLineByFile.get(r.sourceFileId);
      r.endLine = Math.max(r.startLine, last ?? r.startLine);
    }
  }

  const own = ranges.filter((r) => r.sourceFileId === sourceFileId);
  const procedureDivisionLine = own.length > 0 ? Math.min(...own.map((r) => r.startLine)) : undefined;

  return {
    sourceFileId,
    lineMap,
    sections: ranges.filter((r) => r.kind === 'section'),
    paragraphs: ranges.filter((r) => r.kind === 'paragraph'),
    statements,
    procedureDivisionLine,
    entryLine,
    diagnostics
  };
}
