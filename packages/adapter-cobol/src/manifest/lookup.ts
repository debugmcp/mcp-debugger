/**
 * Read-side helpers over a parsed program, for the DAP shim.
 *
 * The manifest stores flat arrays with ids as indices; these functions encode the two
 * lookups every consumer needs — a COBOL data reference (`WS-ID OF WS-GROUP`) to items,
 * and a generated-C line or COBOL line to the procedure map — so the shim does not
 * reimplement COBOL qualification rules.
 */
import type { CobolDataItem, CobolLineMapEntry, CobolProcRange, CobolProgram } from './schema.js';

/**
 * Items matching a COBOL data reference: a name optionally qualified with `OF`/`IN`
 * ancestors, outermost last (`WS-ID OF WS-GROUP`, `A IN B IN C`). Qualifiers need not be
 * contiguous ancestors, as in COBOL. More than one result means the reference is ambiguous.
 */
export function findDataItems(program: CobolProgram, reference: string): CobolDataItem[] {
  const parts = splitQualifiedReference(reference);
  if (!parts) {
    return [];
  }
  const [name, ...qualifiers] = parts;
  const items = program.items;
  return items.filter((item) => {
    if (item.name !== name) {
      return false;
    }
    let ancestor = item.parentId !== undefined ? items[item.parentId] : undefined;
    for (const qualifier of qualifiers) {
      while (ancestor && ancestor.name !== qualifier) {
        ancestor = ancestor.parentId !== undefined ? items[ancestor.parentId] : undefined;
      }
      if (!ancestor) {
        return false;
      }
      ancestor = ancestor.parentId !== undefined ? items[ancestor.parentId] : undefined;
    }
    return true;
  });
}

/**
 * `WS-ID OF WS-GROUP` -> `['WS-ID', 'WS-GROUP']`: whitespace-separated tokens alternating
 * name, `OF`/`IN`, name. Anything else (two names with no keyword between them, a leading
 * or trailing keyword) is not a data reference.
 */
function splitQualifiedReference(reference: string): string[] | undefined {
  const tokens = reference.trim().toUpperCase().split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0 || tokens.length % 2 === 0) {
    return undefined;
  }
  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const keywordSlot = i % 2 === 1;
    if (keywordSlot !== (token === 'OF' || token === 'IN')) {
      return undefined;
    }
    if (!keywordSlot) {
      parts.push(token);
    }
  }
  return parts;
}

/** Ancestors of an item, nearest first. */
export function ancestorsOf(program: CobolProgram, item: CobolDataItem): CobolDataItem[] {
  const chain: CobolDataItem[] = [];
  let parent = item.parentId !== undefined ? program.items[item.parentId] : undefined;
  while (parent) {
    chain.push(parent);
    parent = parent.parentId !== undefined ? program.items[parent.parentId] : undefined;
  }
  return chain;
}

/**
 * The line-map row governing a generated-C line, or undefined when that line belongs to
 * cobc's own bookkeeping (a `#line N "prog.c"` reset) rather than a COBOL statement.
 */
export function findLineMapEntry(program: CobolProgram, cLine: number): CobolLineMapEntry | undefined {
  let candidate: CobolLineMapEntry | undefined;
  for (const row of program.lineMap) {
    if (row.cLine > cLine) {
      break;
    }
    candidate = row;
  }
  if (!candidate) {
    return undefined;
  }
  if (candidate.endCLine !== undefined && cLine > candidate.endCLine) {
    return undefined;
  }
  return candidate;
}

/** The section and paragraph containing a COBOL source line, when any. */
export function findProcRanges(
  program: CobolProgram,
  sourceFileId: number,
  line: number
): { section?: CobolProcRange; paragraph?: CobolProcRange } {
  const contains = (r: CobolProcRange): boolean => r.sourceFileId === sourceFileId && r.startLine <= line && line <= r.endLine;
  const result: { section?: CobolProcRange; paragraph?: CobolProcRange } = {};
  const section = program.procedure.sections.find(contains);
  if (section) {
    result.section = section;
  }
  const paragraph = program.procedure.paragraphs.find(contains);
  if (paragraph) {
    result.paragraph = paragraph;
  }
  return result;
}
