/**
 * Entry point: one cobc translation unit (`<prog>.c` + `.c.h` + `.c.l.h`, optionally a
 * `-t` listing) → one `CobolManifest`.
 *
 * `parseGeneratedCText` is the pure core (strings in, manifest out) and what tests drive;
 * `parseGeneratedC` adds file reading with an injectable reader. Nothing here throws on
 * malformed input: a missing header or an unexpected line becomes a diagnostic and the
 * rest of the manifest is still produced.
 */
import { readFileSync } from 'fs';
import type { CobolManifest, CobolManifestDiagnostic, CobolProgram } from './schema.js';
import { COBOL_MANIFEST_SCHEMA_VERSION } from './schema.js';
import { baseName, splitLines, unescapeCString } from './c-text.js';
import { emptyAttrTables, parseAttrsAndStorage } from './parse-attrs-and-storage.js';
import { parseDumpRoutine } from './parse-dump-routine.js';
import { SourceFileRegistry, parseProcedureMap, splitProgramSegments } from './parse-procedure-map.js';
import { parseControlFlow } from './parse-control-flow.js';
import { parseSymbolListing } from './parse-symbol-listing.js';
import { mergeListingIntoProgram } from './merge-listing.js';
import { validateProgram } from './validate.js';

type GeneratorInfo = CobolManifest['generator'];

/** What the builder knows about the compile; the environment-derived fields default here. */
export type GeneratorInput = Omit<GeneratorInfo, 'generatedAt' | 'platform' | 'arch' | 'dumpComments'> &
  Partial<Pick<GeneratorInfo, 'generatedAt' | 'platform' | 'arch' | 'dumpComments'>>;

export interface ParseGeneratedCInput {
  /** `<prog>.c` (absolute). */
  cPath: string;
  /** Defaults to `cPath + '.h'`. */
  hPath?: string;
  /** Defaults to `cPath + '.l.h'`; further `.c.l<N>.h` headers the `.c` includes are read too. */
  lhPath?: string;
  /** Listing from `-t <file> -ftsymbols`, when the build produced one. */
  lstPath?: string;
  generator: GeneratorInput;
  /** Injectable for tests; defaults to `fs.readFileSync(p, 'latin1')` — cobc output is bytes, not UTF-8. */
  readFile?: (p: string) => string;
}

export interface GeneratedCTexts {
  c: string;
  h?: string;
  lh?: string;
  lst?: string;
  cPath: string;
  /** Paths recorded in each program's `generated` block; default to `cPath`-derived names. */
  paths?: { h?: string; lh?: string; lst?: string };
}

const GENERATED_FROM_RE = /\/\*\s*Generated from\s([^*]*)\*\//;
const SOURCE_FILE_DEFINE_RE = /^\s*#\s*define\s+COB_SOURCE_FILE\s+"((?:\\.|[^"\\])*)"/;
const LOCAL_INCLUDE_RE = /^\s*#\s*include\s+"([^"]+\.c\.l\d*\.h)"/;

function translationUnitSource(cLines: string[]): string | undefined {
  for (const line of cLines) {
    const define = SOURCE_FILE_DEFINE_RE.exec(line);
    if (define) {
      return unescapeCString(define[1]);
    }
    const header = GENERATED_FROM_RE.exec(line);
    if (header) {
      return header[1].trim();
    }
  }
  return undefined;
}

export function parseGeneratedCText(texts: GeneratedCTexts, generator: GeneratorInput): CobolManifest {
  const diagnostics: CobolManifestDiagnostic[] = [];
  const cLines = splitLines(texts.c);
  // Only files whose text was actually parsed are recorded; the header names follow
  // cobc's convention when the caller gave no path, the listing has no convention.
  const generated: CobolProgram['generated'] = { c: texts.cPath };
  if (texts.h !== undefined) {
    generated.h = texts.paths?.h ?? `${texts.cPath}.h`;
  }
  if (texts.lh !== undefined) {
    generated.lh = texts.paths?.lh ?? `${texts.cPath}.l.h`;
  }
  if (texts.lst !== undefined && texts.paths?.lst !== undefined) {
    generated.lst = texts.paths.lst;
  }

  let tables = emptyAttrTables();
  const headerTexts = [texts.h, texts.lh].filter((t): t is string => typeof t === 'string');
  if (headerTexts.length > 0) {
    tables = parseAttrsAndStorage(headerTexts.join('\n'));
    diagnostics.push(...tables.diagnostics);
  }
  if (texts.h === undefined) {
    diagnostics.push({ level: 'warn', message: 'no .c.h text: attributes and literal constants are unavailable' });
  }
  if (texts.lh === undefined) {
    diagnostics.push({ level: 'warn', message: 'no .c.l.h text: storage declarations and cob_field tables are unavailable' });
  }

  const registry = new SourceFileRegistry();
  const fallbackSource = translationUnitSource(cLines);
  const { segments, diagnostics: segmentDiagnostics } = splitProgramSegments(cLines);
  diagnostics.push(...segmentDiagnostics);
  for (const segment of segments) {
    // cobc keeps the PROGRAM-ID as written in its `.c` marker but upper-cases it in the
    // listing; the manifest's contract is upper case (the C function names stay verbatim).
    segment.programIdAsWritten = segment.programId;
    segment.programId = segment.programId.toUpperCase();
  }

  let sawDump = false;
  const programs: CobolProgram[] = [];
  for (const segment of segments) {
    const procedure = parseProcedureMap(segment, texts.cPath, registry, fallbackSource);
    diagnostics.push(...procedure.diagnostics);
    registry.markProgram(procedure.sourceFileId);

    const dump = parseDumpRoutine({ lines: segment.lines, tables, programId: segment.programId, cobcVersion: generator.cobcVersion });
    diagnostics.push(...dump.diagnostics);
    if (dump.found) {
      sawDump = true;
    } else {
      diagnostics.push({
        level: 'warn',
        message: 'no dump routine (P_dump) in the program body — was it compiled with -fdump=ALL? No data items recorded',
        program: segment.programId
      });
    }

    const program: CobolProgram = {
      programId: segment.programId,
      programIdAsWritten: segment.programIdAsWritten ?? segment.programId,
      cFunction: segment.cFunction,
      cEntry: segment.cEntry,
      kind: segment.kind,
      isMain: segment.isMain,
      sourceFileId: procedure.sourceFileId,
      generated: { ...generated },
      items: dump.items,
      roots: dump.roots,
      files: dump.files,
      procedure: { sections: procedure.sections, paragraphs: procedure.paragraphs, statements: procedure.statements },
      lineMap: procedure.lineMap
    };
    if (procedure.entryLine !== undefined) {
      program.entryLine = procedure.entryLine;
    }
    if (procedure.entryStatement) program.entryStatement = procedure.entryStatement;
    program.controlFlow = parseControlFlow(segment);
    if (procedure.procedureDivisionLine !== undefined) {
      program.procedureDivisionLine = procedure.procedureDivisionLine;
    }
    programs.push(program);
  }

  if (texts.lst !== undefined) {
    const listing = parseSymbolListing(texts.lst);
    diagnostics.push(...listing.diagnostics);
    for (const program of programs) {
      const byId = listing.programs.filter((p) => p.programId === program.programId);
      const match =
        byId[0] ?? (listing.programs.length === 1 && programs.length === 1 ? listing.programs[0] : undefined);
      if (!match) {
        diagnostics.push({
          level: 'warn',
          message: 'listing has no symbol table for this program',
          program: program.programId
        });
        continue;
      }
      diagnostics.push(...mergeListingIntoProgram(program, match));
    }
  }

  for (const program of programs) {
    diagnostics.push(...validateProgram(program));
  }

  return {
    schemaVersion: COBOL_MANIFEST_SCHEMA_VERSION,
    generator: {
      ...generator,
      generatedAt: generator.generatedAt ?? new Date().toISOString(),
      platform: generator.platform ?? process.platform,
      arch: generator.arch ?? process.arch,
      dumpComments: generator.dumpComments ?? sawDump
    },
    sources: registry.sources,
    programs,
    diagnostics
  };
}

const STRICT_UTF8 = new TextDecoder('utf-8', { fatal: true });

/**
 * cobc writes source paths in the OS's own encoding: UTF-8 on POSIX, the ANSI code page on
 * Windows. Decode as UTF-8 when the bytes allow it, so a non-ASCII path equals the one the
 * debugger reports; fall back to latin1 for a code-page file.
 */
function defaultReadFile(p: string): string {
  const bytes = readFileSync(p);
  try {
    return STRICT_UTF8.decode(bytes);
  } catch {
    return bytes.toString('latin1');
  }
}

/** Read the generated files and parse them; a missing optional file is a diagnostic, not an error. */
export function parseGeneratedC(input: ParseGeneratedCInput): CobolManifest {
  const readFile = input.readFile ?? defaultReadFile;
  const hPath = input.hPath ?? `${input.cPath}.h`;
  const lhPath = input.lhPath ?? `${input.cPath}.l.h`;
  const pending: CobolManifestDiagnostic[] = [];

  const tryRead = (p: string, what: string): string | undefined => {
    try {
      return readFile(p);
    } catch (error) {
      pending.push({ level: 'warn', message: `cannot read ${what} ${p}: ${error instanceof Error ? error.message : String(error)}` });
      return undefined;
    }
  };

  const c = readFile(input.cPath);
  const h = tryRead(hPath, '.c.h');
  let lh = tryRead(lhPath, '.c.l.h');

  // Nested programs get their own `.c.l<N>.h`; pick up whichever the .c includes.
  const dir = input.cPath.slice(0, input.cPath.length - baseName(input.cPath).length);
  const seen = new Set([baseName(lhPath)]);
  for (const line of splitLines(c)) {
    const include = LOCAL_INCLUDE_RE.exec(line);
    if (!include || seen.has(include[1])) {
      continue;
    }
    seen.add(include[1]);
    const extra = tryRead(`${dir}${include[1]}`, 'nested-program header');
    if (extra !== undefined) {
      lh = lh === undefined ? extra : `${lh}\n${extra}`;
    }
  }

  const lst = input.lstPath !== undefined ? tryRead(input.lstPath, 'listing') : undefined;
  const texts: GeneratedCTexts = { c, cPath: input.cPath, paths: { h: hPath, lh: lhPath } };
  if (h !== undefined) {
    texts.h = h;
  }
  if (lh !== undefined) {
    texts.lh = lh;
  }
  if (lst !== undefined && input.lstPath !== undefined) {
    texts.lst = lst;
    texts.paths = { ...texts.paths, lst: input.lstPath };
  }
  const manifest = parseGeneratedCText(texts, input.generator);
  manifest.diagnostics.unshift(...pending);
  return manifest;
}
