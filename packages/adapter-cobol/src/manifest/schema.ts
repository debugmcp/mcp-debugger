/**
 * COBOL symbol manifest (`cobol-symbols.json`) — the contract shared by the builder (producer),
 * the parser (producer), and the DAP shim (consumer).
 *
 * One manifest describes one translation unit (`cobc` invocation of one source file): every
 * PROGRAM-ID it contains (nested programs included), every data item with the C expression that
 * addresses its storage at runtime, and the procedure map (sections/paragraphs → source lines).
 *
 * The storage expressions are the ones GnuCOBOL itself emits into the `-fdump=ALL` dump routine
 * (`b_8 + 4`, `cob_local_ptr + 12`, `b_19`) and are valid C expressions LLDB can evaluate in the
 * program's frame. Attribute constants come from libcob's `common.h` (see `attr-constants.ts`).
 */

export const COBOL_MANIFEST_SCHEMA_VERSION = 1 as const;

export type CobolSection =
  | 'WORKING-STORAGE'
  | 'LOCAL-STORAGE'
  | 'LINKAGE'
  | 'FILE'
  | 'SCREEN'
  | 'REPORT';

export type CobolStorageKind =
  /** File/function static (`b_N`): WORKING-STORAGE and FILE record areas. */
  | 'static'
  /** `cob_local_ptr [+ off]`: LOCAL-STORAGE, allocated per invocation. */
  | 'local'
  /** `b_N` pointer parameter of the body function: LINKAGE (and BASED) items; may be NULL. */
  | 'linkage'
  /** Special registers addressed as `(cob_u8_t *)&b_N` (RETURN-CODE etc.). */
  | 'register';

export type CobolUsage =
  | 'DISPLAY'
  | 'COMP'
  | 'COMP-3'
  | 'COMP-5'
  | 'COMP-6'
  | 'COMP-1'
  | 'COMP-2'
  | 'POINTER'
  | 'INDEX'
  | 'NATIONAL'
  | 'GROUP'
  | 'OTHER';

/** libcob `cob_field_attr` as emitted in `<prog>.c.h`: `{0x<type>, digits, scale, 0x<flags>, pic}`. */
export interface CobolFieldAttr {
  /** `COB_TYPE_*` numeric value (e.g. 0x10 NUMERIC_DISPLAY, 0x12 NUMERIC_PACKED, 0x21 ALPHANUMERIC). */
  type: number;
  digits: number;
  scale: number;
  /** `COB_FLAG_*` bit set (0x1 HAVE_SIGN, 0x2 SIGN_SEPARATE, 0x4 SIGN_LEADING, 0x20 BINARY_SWAP, …). */
  flags: number;
  /** Edited-picture symbol array when the attr references one (`&p_N`), else undefined. */
  pic?: Array<{ symbol: string; count: number }>;
}

export interface CobolOccurs {
  min: number;
  max: number;
  /** Bytes per element (the `<elemSize>UL` argument of the dump call). */
  elemSize: number;
  /** Data item whose live value bounds an OCCURS … DEPENDING ON table. */
  dependingOnItemId?: number;
  /** The raw C expression cobc used to fetch the depending value (diagnostics only). */
  dependingExpr?: string;
}

export interface CobolConditionValue {
  /** Literal text (without quotes) or figurative constant name (`SPACE`, `ZERO`, `LOW-VALUE`, …). */
  lo: string;
  /** Upper bound of a `VALUE a THRU b` range. */
  hi?: string;
  /** True when `lo`/`hi` were resolved from a `c_N` literal constant; false when only the raw text is known. */
  resolved: boolean;
  /**
   * What `lo`/`hi` are: a quoted/numeric literal (`'SPACES'` is the five-letter
   * word), a figurative constant (`SPACES` means all spaces), or `ALL <literal>`.
   * Absent on older manifests, where the decoder falls back to treating bare
   * figurative names as figurative.
   */
  kind?: 'literal' | 'figurative' | 'all';
}

export interface CobolDataItem {
  /** Index into `CobolProgram.items`. */
  id: number;
  /** Upper-cased data-name; `FILLER` for unnamed items. */
  name: string;
  /** `NAME OF PARENT OF … OF ROOT` — unique within the program. */
  qualifiedName: string;
  /** COBOL level number: 1–49, 66, 77, 78, 88. */
  level: number;
  section: CobolSection;
  /** FD/SD name when `section === 'FILE'`. */
  fileName?: string;
  parentId?: number;
  children: number[];
  storage: {
    kind: CobolStorageKind;
    /** Base symbol as it appears in the generated C: `b_8`, `cob_local_ptr`, `b_19`. */
    symbol: string;
  };
  /** Byte offset of element 0 from `storage.symbol` (the `<offset>` argument, plus any `+ N` on the base). */
  offset: number;
  /** Size in bytes of one element (`f_N.size` or the `COB_SET_FLD` size). */
  size: number;
  /** Runtime size expression when the size depends on an ODO item (`cob_get_numdisp (b_33, 1)`). */
  sizeExpr?: string;
  attr?: CobolFieldAttr;
  /** Field symbol (`f_N`) when cobc materialised a static `cob_field` for this item. */
  fieldSymbol?: string;
  /** Reconstructed picture, e.g. `S9(5)V99`; from the listing when available. */
  picture?: string;
  usage: CobolUsage;
  occurs?: CobolOccurs;
  /**
   * OCCURS dimensions that apply to this item, outermost first (its own plus every ancestor's).
   * `variables`/`evaluate` subscripts are resolved against this list.
   */
  occursDims: Array<{ itemId: number; elemSize: number; max: number }>;
  /** The item this one REDEFINES (same storage, own attr). */
  redefinesItemId?: number;
  /** Level-88 condition: the VALUE list, evaluated against the parent item. */
  condition?: { values: CobolConditionValue[]; raw: string };
  flags: {
    based?: true;
    external?: true;
    global?: true;
    anyLength?: true;
  };
  /** Source location from the listing symbol table, when available. */
  source?: { fileId: number; line: number };
}

export interface CobolProcRange {
  name: string;
  kind: 'section' | 'paragraph';
  /** Enclosing SECTION for a paragraph, when any. */
  sectionName?: string;
  sourceFileId: number;
  /** First and last source line (inclusive) attributed to this range in its file. */
  startLine: number;
  endLine: number;
  /** C label emitted for the range when the compiler produced one (3.2+: `PARAGRAPH_<NAME>_l_<id>`). */
  cLabel?: string;
  /**
   * The id of the `l_<id>` label cobc jumps to for this range (`goto l_5`), on both 3.1.2
   * and 3.2. A PERFORM frame's `perform_through` names its THRU-end range by this id.
   */
  labelId?: number;
}

/** A PROCEDURE DIVISION statement, from cobc's `/* Line: N : VERB : file *\/` comments. */
export interface CobolStatementLocation {
  sourceFileId: number;
  line: number;
  /** Statement name as cobc prints it (`MOVE`, `PERFORM`, `GO TO`, `CALL`). */
  verb: string;
}

/** One `#line` row of the generated C: generated-C line → COBOL statement location. */
export interface CobolLineMapEntry {
  /** 1-based line in the generated `.c` where the directive takes effect. */
  cLine: number;
  /**
   * Last generated line still governed by this directive: the line before the next `#line`
   * of any kind, including cobc's self-resets (`#line 113 "hello.c"`), which are not rows
   * of this map. Lets a consumer decide containment without knowing about those resets.
   */
  endCLine?: number;
  sourceFileId: number;
  /** COBOL source line the following generated code belongs to. */
  line: number;
}

export interface CobolSourceFile {
  id: number;
  /** Absolute, normalised path exactly as cobc wrote it into `#line` directives. */
  path: string;
  kind: 'program' | 'copybook';
}

export interface CobolProgram {
  /** PROGRAM-ID, upper-cased (the manifest's lookup contract). */
  programId: string;
  /** PROGRAM-ID exactly as the source wrote it (case kept): the file name libcob resolves a dynamic CALL to. */
  programIdAsWritten?: string;
  /** Body function holding every statement (`HELLO_`) — the frame name CodeLLDB reports at a stop. */
  cFunction: string;
  /** Entry function (`HELLO`). */
  cEntry: string;
  kind: 'program' | 'function';
  isMain: boolean;
  parentProgramId?: string;
  sourceFileId: number;
  /** Generated files this program was parsed from (absolute paths at build time). */
  generated: { c: string; h?: string; lh?: string; lst?: string };
  items: CobolDataItem[];
  /** Top-level (01/77) item ids per section, in declaration order. */
  roots: Array<{ section: CobolSection; itemIds: number[] }>;
  files: Array<{ name: string; handle: string; recordItemIds: number[] }>;
  procedure: {
    sections: CobolProcRange[];
    paragraphs: CobolProcRange[];
    /** Every statement location, copybook statements included; empty in manifests older than this field. */
    statements: CobolStatementLocation[];
  };
  /**
   * First line of procedural code in the program's own source file: the earliest paragraph
   * or section start (31 for a `PROCEDURE DIVISION.` header on line 30). Stops attributed to
   * lower lines are DATA DIVISION initialisation (VALUE clauses). The header line itself is
   * not recoverable — cobc's `Entry` comment names line 30 in 3.1.2 and 31 in 3.2.
   */
  procedureDivisionLine?: number;
  /** Every `#line` row of the generated C in order — lets the shim map a generated-C stop back to COBOL. */
  lineMap: CobolLineMapEntry[];
}

export interface CobolManifestDiagnostic {
  level: 'warn' | 'error';
  message: string;
  program?: string;
  item?: string;
}

export interface CobolManifest {
  schemaVersion: typeof COBOL_MANIFEST_SCHEMA_VERSION;
  generator: {
    cobcVersion: string;
    cobcPath?: string;
    argv: string[];
    dialect?: string;
    format?: 'fixed' | 'free' | 'auto';
    dumpComments: boolean;
    buildKey?: string;
    generatedAt: string;
    platform: string;
    arch: string;
  };
  sources: CobolSourceFile[];
  programs: CobolProgram[];
  diagnostics: CobolManifestDiagnostic[];
}
