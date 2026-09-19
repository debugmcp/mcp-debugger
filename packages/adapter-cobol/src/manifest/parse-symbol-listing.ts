/**
 * Symbol tables from a `cobc -t <file> -ftsymbols` listing.
 *
 * A listing is one page sequence per program in the compilation group: the source
 * listing (whose `PROGRAM-ID.` line names the program) followed by a table headed
 * `SIZE  TYPE  LVL  NAME  PICTURE`. Columns are sliced by the header's positions rather
 * than split on whitespace because the TYPE column can contain a space (`NUMERIC EDITED`),
 * and the PICTURE column is the source text verbatim followed by comma-separated clauses
 * (`9(8), REDEFINES WS-RAW`, `X, OCCURS 1 TO 9`). No line numbers are printed for
 * symbols, so `source` locations are not available from here.
 */
import type { CobolManifestDiagnostic, CobolSection } from './schema.js';
import { splitLines } from './c-text.js';

export interface ListingRow {
  section?: CobolSection;
  /** Undefined for level-88 rows, which the listing leaves blank. */
  size?: number;
  type: string;
  level: number;
  name: string;
  /** Source picture text with any trailing usage words removed; undefined when the row has none. */
  picture?: string;
  /** Usage word that followed the picture (`COMP`, `COMP-3`, …), when the listing printed one. */
  usageText?: string;
  /** Remaining comma-separated clauses (`OCCURS 5`, `REDEFINES WS-RAW`). */
  clauses: string[];
}

export interface ListingProgram {
  programId?: string;
  rows: ListingRow[];
}

export interface SymbolListing {
  programs: ListingProgram[];
  diagnostics: CobolManifestDiagnostic[];
}

const HEADER_RE = /^SIZE\s+TYPE\s+LVL\s+NAME\s+PICTURE/;
const PROGRAM_ID_RE = /^\d{6}[A-Za-z ]?\s+(?:PROGRAM-ID|FUNCTION-ID)\.\s+([A-Za-z0-9_-]+)/;
const SECTION_RE = /^\s+([A-Z-]+)\s+SECTION\s*$/;
const CLAUSE_KEYWORD_RE = /^(?:OCCURS|REDEFINES|BASED|EXTERNAL|GLOBAL|ANY\s+LENGTH|VALUE|JUST|JUSTIFIED|BLANK|SIGN|SYNC|SYNCHRONIZED|INDEXED|RENAMES)\b/i;
const USAGE_WORD_RE =
  /^(?:COMP(?:UTATIONAL)?(?:-[1-6X])?|BINARY|PACKED-DECIMAL|DISPLAY|POINTER|INDEX|NATIONAL|FLOAT-(?:SHORT|LONG)|BINARY-(?:CHAR|SHORT|LONG|DOUBLE|C-LONG)|SIGNED|UNSIGNED)$/i;

const SECTION_NAMES: Record<string, CobolSection> = {
  'WORKING-STORAGE': 'WORKING-STORAGE',
  'LOCAL-STORAGE': 'LOCAL-STORAGE',
  LINKAGE: 'LINKAGE',
  FILE: 'FILE',
  SCREEN: 'SCREEN',
  REPORT: 'REPORT'
};

interface Columns {
  type: number;
  level: number;
  name: number;
}

function columnsFrom(header: string): Columns {
  return { type: header.indexOf('TYPE'), level: header.indexOf('LVL'), name: header.indexOf('NAME') };
}

/** Split the PICTURE column into picture text, usage word and clauses. */
export function splitPictureColumn(text: string): Pick<ListingRow, 'picture' | 'usageText' | 'clauses'> {
  const segments = text
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length === 0) {
    return { clauses: [] };
  }
  const first = segments[0];
  if (CLAUSE_KEYWORD_RE.test(first)) {
    return { clauses: segments };
  }
  const words = first.split(/\s+/);
  const usageWords: string[] = [];
  while (words.length > 0 && USAGE_WORD_RE.test(words[words.length - 1])) {
    usageWords.unshift(words.pop() as string);
  }
  const result: Pick<ListingRow, 'picture' | 'usageText' | 'clauses'> = { clauses: segments.slice(1) };
  if (words.length > 0) {
    result.picture = words.join(' ');
  }
  if (usageWords.length > 0) {
    result.usageText = usageWords.join(' ');
  }
  return result;
}

function parseRow(line: string, columns: Columns, section: CobolSection | undefined): ListingRow | undefined {
  if (line.length <= columns.name) {
    return undefined;
  }
  const sizeText = line.slice(0, columns.type).trim();
  const type = line.slice(columns.type, columns.level).trim();
  const levelText = line.slice(columns.level, columns.name).trim();
  if (!/^\d{1,2}$/.test(levelText) || type.length === 0) {
    return undefined;
  }
  const rest = line.slice(columns.name).trim();
  if (rest.length === 0) {
    return undefined;
  }
  const nameEnd = rest.search(/\s/);
  const name = nameEnd < 0 ? rest : rest.slice(0, nameEnd);
  const pictureColumn = nameEnd < 0 ? '' : rest.slice(nameEnd).trim();
  const row: ListingRow = {
    type,
    level: parseInt(levelText, 10),
    name: name.toUpperCase(),
    ...splitPictureColumn(pictureColumn)
  };
  if (section) {
    row.section = section;
  }
  if (/^\d+$/.test(sizeText)) {
    row.size = parseInt(sizeText, 10);
  }
  return row;
}

export function parseSymbolListing(text: string): SymbolListing {
  const programs: ListingProgram[] = [];
  const diagnostics: CobolManifestDiagnostic[] = [];
  let programId: string | undefined;
  let table: ListingProgram | undefined;
  let columns: Columns | undefined;
  let section: CobolSection | undefined;

  for (const rawLine of splitLines(text)) {
    const line = rawLine.replace(/^\f/, '');
    const id = PROGRAM_ID_RE.exec(line);
    if (id) {
      programId = id[1].toUpperCase();
      table = undefined;
      continue;
    }
    if (HEADER_RE.test(line)) {
      columns = columnsFrom(line);
      table = { rows: [] };
      if (programId) {
        table.programId = programId;
      }
      programs.push(table);
      section = undefined;
      continue;
    }
    if (!table || !columns) {
      continue;
    }
    const sec = SECTION_RE.exec(line);
    if (sec) {
      section = SECTION_NAMES[sec[1]];
      if (!section) {
        diagnostics.push({ level: 'warn', message: `unrecognised listing section "${sec[1]} SECTION"` });
      }
      continue;
    }
    if (/^\d+ (?:warnings?|errors?) in compilation group/.test(line) || /^GnuCOBOL /.test(line)) {
      table = undefined;
      continue;
    }
    const row = parseRow(line, columns, section);
    if (row) {
      table.rows.push(row);
    }
  }
  return { programs, diagnostics };
}
