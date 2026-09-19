/**
 * COBOL symbol manifest: schema, parser and read-side helpers.
 *
 * Producers call `parseGeneratedC` (files) or `parseGeneratedCText` (strings) on cobc's
 * `-fdump=ALL --save-temps` output; consumers read the `CobolManifest` and use the
 * `lookup` helpers. The sub-parsers are exported for unit tests and for callers that
 * only need one table.
 */
export * from './schema.js';
export * from './attr-constants.js';
export { usageFor, reconstructPicture } from './picture.js';
export {
  splitLines,
  splitTopLevelArgs,
  findMatchingBracket,
  unescapeCString,
  unquoteCString,
  parseDataExpr,
  baseName
} from './c-text.js';
export type { DataExpr } from './c-text.js';
export { parseAttrsAndStorage, emptyAttrTables } from './parse-attrs-and-storage.js';
export type { AttrTables, ConstantLiteral, FieldDecl, PicSymbol, StorageDecl, StorageDeclKind } from './parse-attrs-and-storage.js';
export { parseDumpRoutine } from './parse-dump-routine.js';
export type { DumpRoutineInput, DumpRoutineResult } from './parse-dump-routine.js';
export { parseProcedureMap, splitProgramSegments, SourceFileRegistry, demangleProgramId } from './parse-procedure-map.js';
export type { ProcedureMap, ProgramSegment } from './parse-procedure-map.js';
export { parseSymbolListing, splitPictureColumn } from './parse-symbol-listing.js';
export type { ListingProgram, ListingRow, SymbolListing } from './parse-symbol-listing.js';
export { mergeListingIntoProgram } from './merge-listing.js';
export { validateProgram } from './validate.js';
export { findDataItems, ancestorsOf, findLineMapEntry, findProcRanges } from './lookup.js';
export { parseGeneratedC, parseGeneratedCText } from './parse-generated-c.js';
export type { GeneratedCTexts, GeneratorInput, ParseGeneratedCInput } from './parse-generated-c.js';
