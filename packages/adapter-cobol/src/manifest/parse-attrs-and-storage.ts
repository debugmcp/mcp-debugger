/**
 * Tables from `<prog>.c.h` (attributes, literal constants, picture symbol arrays) and
 * `<prog>.c.l.h` (data storage, linkage pointers, materialised `cob_field`s).
 *
 * Both headers are declaration lists, one declaration per line, so this is a line scanner.
 * The only multi-line shape is a picture symbol array, which is buffered until its `;`.
 * Whitespace between tokens varies between cobc versions (tabs, aligned columns), so every
 * pattern uses `\s*` rather than the literal spacing seen in one fixture.
 */
import type { CobolFieldAttr, CobolManifestDiagnostic } from './schema.js';
import { splitLines, splitTopLevelArgs, trailingComment, unescapeCString } from './c-text.js';

export interface PicSymbol {
  symbol: string;
  count: number;
}

/** `static const cob_field c_N = {size, (cob_u8_ptr)"text", &a_M};` — a literal the program uses. */
export interface ConstantLiteral {
  symbol: string;
  size: number;
  /** Decoded literal text (C escapes resolved). */
  text: string;
  attrSymbol: string;
}

export type StorageDeclKind =
  /** `static cob_u8_t b_N[len]` — a WORKING-STORAGE / FILE record area. */
  | 'array'
  /** `unsigned char *b_N = NULL` — LINKAGE, BASED or EXTERNAL: pointed-to storage, may be NULL. */
  | 'pointer'
  /** `static int b_N` — a special register (RETURN-CODE) stored as a C int. */
  | 'int';

export interface StorageDecl {
  symbol: string;
  kind: StorageDeclKind;
  /** Byte length for arrays; 4 for ints; undefined for pointers. */
  size?: number;
  /** The data-name cobc wrote in the trailing comment, when present. */
  comment?: string;
}

/** `static cob_field f_N = {size, data, &a_M}; /* NAME *\/` */
export interface FieldDecl {
  symbol: string;
  size: number;
  /** Raw data expression: `b_19`, `b_24 + 4`, `NULL`, `cob_local_ptr + 16`. */
  dataExpr: string;
  attrSymbol: string;
  comment?: string;
}

export interface AttrTables {
  attrs: Map<string, CobolFieldAttr>;
  pics: Map<string, PicSymbol[]>;
  constants: Map<string, ConstantLiteral>;
  storage: Map<string, StorageDecl>;
  fields: Map<string, FieldDecl>;
  diagnostics: CobolManifestDiagnostic[];
}

export function emptyAttrTables(): AttrTables {
  return {
    attrs: new Map(),
    pics: new Map(),
    constants: new Map(),
    storage: new Map(),
    fields: new Map(),
    diagnostics: []
  };
}

const ATTR_RE =
  /\bcob_field_attr\s+(a_\d+)\s*=\s*\{\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(NULL|p_\d+|&\s*p_\d+)\s*\}/;
const PIC_START_RE = /\bcob_pic_symbol\s+(p_\d+)\s*\[\s*\]\s*=/;
const PIC_PAIR_RE = /\{\s*'((?:\\.|[^'\\]))'\s*,\s*(\d+)\s*\}/g;
const CONST_RE =
  /\bcob_field\s+(c_\d+)\s*=\s*\{\s*(\d+)\s*,\s*(?:\([^)]*\)\s*)?"((?:\\.|[^"\\])*)"\s*,\s*&\s*(a_\d+)\s*\}/;
const STORAGE_ARRAY_RE = /^\s*(?:static\s+)?(?:cob_u8_t|unsigned\s+char)\s+(b_\d+)\s*\[\s*(\d+)\s*\]/;
const STORAGE_INT_RE = /^\s*(?:static\s+)?int\s+(b_\d+)\s*(?:=\s*0\s*)?;/;
const STORAGE_POINTER_RE = /^\s*(?:static\s+)?(?:cob_u8_t|unsigned\s+char)\s*\*\s*(b_\d+)\s*(?:=\s*NULL\s*)?;/;
const FIELD_RE = /\bcob_field\s+(f_\d+)\s*=\s*\{(.*)\}\s*;/;

function parseNumber(token: string): number {
  return token.startsWith('0x') || token.startsWith('0X') ? parseInt(token, 16) : parseInt(token, 10);
}

function parsePicPairs(text: string): PicSymbol[] {
  const pairs: PicSymbol[] = [];
  for (const m of text.matchAll(PIC_PAIR_RE)) {
    const symbol = unescapeCString(m[1]);
    const count = parseInt(m[2], 10);
    if (symbol === '\0' || count === 0) {
      continue; // the terminator entry
    }
    pairs.push({ symbol, count });
  }
  return pairs;
}

/**
 * Parse one or both headers. Pass the `.c.h` and `.c.l.h` texts joined with a newline —
 * attribute symbols are file-global and field symbols are per program, so one table per
 * translation unit is the right granularity.
 */
export function parseAttrsAndStorage(text: string): AttrTables {
  const tables = emptyAttrTables();
  const lines = splitLines(text);
  // Attrs reference their picture array by symbol; resolve after the scan so the order
  // of the two declaration groups does not matter.
  const picRefs: Array<{ attrSymbol: string; picSymbol: string }> = [];
  let picBuffer: { symbol: string; text: string } | undefined;

  for (const line of lines) {
    if (picBuffer) {
      picBuffer.text += ' ' + line;
      if (line.includes(';')) {
        tables.pics.set(picBuffer.symbol, parsePicPairs(picBuffer.text));
        picBuffer = undefined;
      }
      continue;
    }

    const picStart = PIC_START_RE.exec(line);
    if (picStart) {
      if (line.includes(';')) {
        tables.pics.set(picStart[1], parsePicPairs(line));
      } else {
        picBuffer = { symbol: picStart[1], text: line };
      }
      continue;
    }

    const attr = ATTR_RE.exec(line);
    if (attr) {
      tables.attrs.set(attr[1], {
        type: parseNumber(attr[2]),
        digits: parseInt(attr[3], 10),
        scale: parseInt(attr[4], 10),
        flags: parseNumber(attr[5])
      });
      const picRef = attr[6].replace(/[&\s]/g, '');
      if (picRef !== 'NULL') {
        picRefs.push({ attrSymbol: attr[1], picSymbol: picRef });
      }
      continue;
    }

    const constant = CONST_RE.exec(line);
    if (constant) {
      tables.constants.set(constant[1], {
        symbol: constant[1],
        size: parseInt(constant[2], 10),
        text: unescapeCString(constant[3]),
        attrSymbol: constant[4]
      });
      continue;
    }

    const field = FIELD_RE.exec(line);
    if (field) {
      const parts = splitTopLevelArgs(field[2]);
      const attrRef = parts.length >= 3 ? /&\s*(a_\d+)/.exec(parts[2]) : null;
      if (!attrRef || !/^\d+$/.test(parts[0])) {
        tables.diagnostics.push({
          level: 'warn',
          message: `unrecognised cob_field initialiser for ${field[1]}: ${line.trim()}`
        });
        continue;
      }
      tables.fields.set(field[1], {
        symbol: field[1],
        size: parseInt(parts[0], 10),
        dataExpr: parts[1],
        attrSymbol: attrRef[1],
        comment: trailingComment(line)
      });
      continue;
    }

    const array = STORAGE_ARRAY_RE.exec(line);
    if (array) {
      tables.storage.set(array[1], {
        symbol: array[1],
        kind: 'array',
        size: parseInt(array[2], 10),
        comment: trailingComment(line)
      });
      continue;
    }

    const pointer = STORAGE_POINTER_RE.exec(line);
    if (pointer) {
      tables.storage.set(pointer[1], { symbol: pointer[1], kind: 'pointer', comment: trailingComment(line) });
      continue;
    }

    const int = STORAGE_INT_RE.exec(line);
    if (int) {
      tables.storage.set(int[1], { symbol: int[1], kind: 'int', size: 4, comment: trailingComment(line) });
    }
  }

  if (picBuffer) {
    tables.diagnostics.push({ level: 'warn', message: `unterminated cob_pic_symbol array ${picBuffer.symbol}` });
  }
  for (const { attrSymbol, picSymbol } of picRefs) {
    const pic = tables.pics.get(picSymbol);
    const attr = tables.attrs.get(attrSymbol);
    if (pic && attr) {
      attr.pic = pic;
    } else {
      tables.diagnostics.push({
        level: 'warn',
        message: `attribute ${attrSymbol} references undeclared picture array ${picSymbol}`
      });
    }
  }
  return tables;
}
