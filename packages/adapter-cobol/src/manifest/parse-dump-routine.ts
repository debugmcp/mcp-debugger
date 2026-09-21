/**
 * Data items from the `-fdump=ALL` dump routine cobc emits into every program body.
 *
 * The routine (`P_dump:` … `cob_dump_output ("END OF DUMP - X")`) is the one place the
 * compiler enumerates every item with its level, name, size, storage address and
 * attribute — exactly the tuple a debugger needs — and it does so in declaration order,
 * so the tree can be rebuilt from level numbers alone. Items cobc will not dump at runtime
 * (REDEFINES, level 88) are still emitted as `/* … *\/` comments carrying the same call plus
 * a trailing tag, and are parsed the same way.
 *
 * OCCURS nesting is taken from the call itself (`…, ndims, i_1, 20UL, i_2, 4UL`), not from
 * the surrounding `for` blocks: 3.2 sometimes wraps the whole routine in an extra `{ … }`,
 * and the subscript pairs are what libcob actually uses to address an element.
 */
import type {
  CobolConditionValue,
  CobolDataItem,
  CobolManifestDiagnostic,
  CobolProgram,
  CobolSection,
  CobolStorageKind
} from './schema.js';
import type { AttrTables } from './parse-attrs-and-storage.js';
import { COB_FLAG, COB_TYPE } from './attr-constants.js';
import { findMatchingBracket, parseDataExpr, splitTopLevelArgs, unquoteCString } from './c-text.js';
import { reconstructPicture, usageFor } from './picture.js';

export interface DumpRoutineInput {
  /** The program segment's lines; the routine is located by its `P_dump:` label. */
  lines: string[];
  tables: AttrTables;
  programId: string;
  cobcVersion?: string;
}

export interface DumpRoutineResult {
  /** False when the segment has no dump routine (compiled without `-fdump`). */
  found: boolean;
  items: CobolDataItem[];
  roots: CobolProgram['roots'];
  files: CobolProgram['files'];
  diagnostics: CobolManifestDiagnostic[];
}

const SECTION_LABELS: Record<string, CobolSection> = {
  'WORKING-STORAGE': 'WORKING-STORAGE',
  'LOCAL-STORAGE': 'LOCAL-STORAGE',
  LINKAGE: 'LINKAGE',
  FILE: 'FILE',
  SCREEN: 'SCREEN',
  REPORT: 'REPORT'
};

/** libcob's figurative-constant fields, as they appear in a level-88 VALUE tag. */
const FIGURATIVE: Record<string, string> = {
  cob_space: 'SPACE',
  cob_all_space: 'SPACE',
  cob_zero: 'ZERO',
  cob_all_zero: 'ZERO',
  cob_low: 'LOW-VALUE',
  cob_all_low: 'LOW-VALUE',
  cob_high: 'HIGH-VALUE',
  cob_all_high: 'HIGH-VALUE',
  cob_quote: 'QUOTE',
  cob_all_quote: 'QUOTE',
  cob_null: 'NULL'
};

/** RETURN-CODE is a C `int` in every cobc version: COMP-5 S9(9), the attr 3.2 dumps for it. */
const RETURN_CODE_ATTR = {
  type: COB_TYPE.NUMERIC_COMP5,
  digits: 9,
  scale: 0,
  flags: COB_FLAG.HAVE_SIGN | COB_FLAG.REAL_BINARY
};

interface MaxDecl {
  literal?: number;
  expr?: string;
  cap?: number;
}

interface ResolvedField {
  size: number;
  sizeExpr?: string;
  dataExpr: string;
  attrSymbol?: string;
  fieldSymbol?: string;
}

interface DumpCall {
  level: number;
  name: string;
  field: ResolvedField;
  offsetArg: number;
  pairs: Array<{ index: number; elemSize: number }>;
  commented: boolean;
  tail: string;
}

export function parseDumpRoutine(input: DumpRoutineInput): DumpRoutineResult {
  const { lines, tables, programId } = input;
  const diagnostics: CobolManifestDiagnostic[] = [];
  const items: CobolDataItem[] = [];
  const rootsBySection = new Map<CobolSection, number[]>();
  const files: CobolProgram['files'] = [];
  const qualifiedNames = new Set<string>();

  const diag = (level: 'warn' | 'error', message: string, item?: string): void => {
    diagnostics.push(item ? { level, message, program: programId, item } : { level, message, program: programId });
  };

  const startIdx = lines.findIndex((l) => /^\s*P_dump\s*:/.test(l));
  if (startIdx < 0) {
    return { found: false, items, roots: [], files, diagnostics };
  }
  const segmentText = lines.join('\n');

  let section: CobolSection = 'WORKING-STORAGE';
  let currentFile: CobolProgram['files'][number] | undefined;
  let stack: Array<{ id: number; level: number }> = [];
  let lastNon88: number | undefined;
  const maxByIndex = new Map<number, MaxDecl>();
  const loopOwner = new Map<number, number>();
  /** Bytes of each group already claimed by its subordinates, in declaration order. */
  const layoutNext = new Map<number, number>();
  let braceDepth = 0;
  let skipDepth: number | undefined;

  const rootsFor = (s: CobolSection): number[] => {
    let list = rootsBySection.get(s);
    if (!list) {
      list = [];
      rootsBySection.set(s, list);
    }
    return list;
  };

  const resetSection = (next: CobolSection): void => {
    section = next;
    stack = [];
    lastNon88 = undefined;
    if (next !== 'FILE') {
      currentFile = undefined;
    }
    // Register the section as soon as cobc announces it so `roots` keeps dump order even
    // when its first item arrives later (a RETURN-CODE synthesized after the walk).
    rootsFor(next);
  };

  const uniqueQualifiedName = (base: string): string => {
    let candidate = base;
    for (let n = 2; qualifiedNames.has(candidate); n += 1) {
      candidate = `${base} #${n}`;
    }
    qualifiedNames.add(candidate);
    return candidate;
  };

  /** `f_N` declared with NULL data is bound at runtime by `COB_SET_DATA (f_N, expr)`; find that expr. */
  const findSetData = (fieldSymbol: string): string | undefined => {
    const re = new RegExp(`COB_SET_DATA\\s*\\(\\s*${fieldSymbol}\\s*,`);
    const m = re.exec(segmentText);
    if (!m) {
      return undefined;
    }
    const open = segmentText.indexOf('(', m.index);
    const close = findMatchingBracket(segmentText, open);
    if (open < 0 || close < 0) {
      return undefined;
    }
    const args = splitTopLevelArgs(segmentText.slice(open + 1, close));
    return args[1];
  };

  const resolveField = (expr: string, name: string): ResolvedField | undefined => {
    const byField = /^&\s*(f_\d+)$/.exec(expr);
    if (byField) {
      const decl = tables.fields.get(byField[1]);
      if (!decl) {
        diag('warn', `field ${byField[1]} is not declared in the .c.l.h`, name);
        return undefined;
      }
      let dataExpr = decl.dataExpr;
      if (/^NULL$/.test(dataExpr.trim())) {
        const bound = findSetData(byField[1]);
        if (bound) {
          dataExpr = bound;
        }
        // Otherwise the address is derived from the enclosing group's layout (addItem).
      }
      return { size: decl.size, dataExpr, attrSymbol: decl.attrSymbol, fieldSymbol: byField[1] };
    }
    const setData = /^COB_SET_DATA\s*\(/.exec(expr);
    if (setData) {
      // A referenced EXTERNAL or BASED item: its static field carries NULL data and the
      // dump call binds it to the runtime pointer in place (`COB_SET_DATA (f_36, b_36)`).
      const open = expr.indexOf('(');
      const close = findMatchingBracket(expr, open);
      const args = splitTopLevelArgs(expr.slice(open + 1, close < 0 ? expr.length : close));
      const fieldSymbol = (args[0] ?? '').trim();
      const decl = args.length >= 2 ? tables.fields.get(fieldSymbol) : undefined;
      if (!decl) {
        diag('warn', `COB_SET_DATA names an undeclared field: ${expr}`, name);
        return undefined;
      }
      return { size: decl.size, dataExpr: args[1], attrSymbol: decl.attrSymbol, fieldSymbol };
    }
    const setFld = /^COB_SET_FLD\s*\(/.exec(expr);
    if (!setFld) {
      diag('warn', `unrecognised field expression: ${expr}`, name);
      return undefined;
    }
    const open = expr.indexOf('(');
    const close = findMatchingBracket(expr, open);
    const args = splitTopLevelArgs(expr.slice(open + 1, close < 0 ? expr.length : close));
    if (args.length < 4) {
      diag('warn', `COB_SET_FLD with ${args.length} arguments: ${expr}`, name);
      return undefined;
    }
    const attrRef = /&\s*(a_\d+)/.exec(args[3]);
    const sizeIsLiteral = /^\d+(?:[uU]?[lL]{0,2})?$/.test(args[1]);
    return {
      size: sizeIsLiteral ? parseInt(args[1], 10) : 0,
      sizeExpr: sizeIsLiteral ? undefined : args[1],
      dataExpr: args[2],
      attrSymbol: attrRef ? attrRef[1] : undefined
    };
  };

  const parseCall = (line: string, callIdx: number): DumpCall | undefined => {
    const open = line.indexOf('(', callIdx);
    const close = open < 0 ? -1 : findMatchingBracket(line, open);
    if (open < 0 || close < 0) {
      diag('warn', `unbalanced cob_dump_field_ext call: ${line.trim()}`);
      return undefined;
    }
    const args = splitTopLevelArgs(line.slice(open + 1, close));
    if (args.length < 5) {
      diag('warn', `cob_dump_field_ext with ${args.length} arguments: ${line.trim()}`);
      return undefined;
    }
    const commented = line.trimStart().startsWith('/*');
    let tail = line.slice(close + 1).replace(/^\s*;/, '').trim();
    if (commented && tail.endsWith('*/')) {
      tail = tail.slice(0, -2).trim();
    }
    const name = unquoteCString(args[1]).toUpperCase();
    const field = resolveField(args[2], name);
    if (!field) {
      return undefined;
    }
    const ndims = parseInt(args[4], 10) || 0;
    const pairs: DumpCall['pairs'] = [];
    for (let k = 0; k < ndims; k += 1) {
      const indexVar = /i_(\d+)/.exec(args[5 + 2 * k] ?? '');
      // `6UL` normally; `(cob_uli_t)(4)` for items inside an ODO table under odoslide
      // (the -std=ibm default, or -fodoslide).
      const elemText = (args[6 + 2 * k] ?? '').replace(/\(\s*cob_u?li_t\s*\)/g, '');
      const elemMatch = /(\d+)/.exec(elemText);
      const elem = elemMatch ? parseInt(elemMatch[1], 10) : Number.NaN;
      if (!indexVar || Number.isNaN(elem)) {
        diag('warn', `subscript pair ${k + 1} of ${ndims} is malformed`, name);
        continue;
      }
      pairs.push({ index: parseInt(indexVar[1], 10), elemSize: elem });
    }
    return {
      level: parseInt(args[0], 10),
      name,
      field,
      offsetArg: parseInt(args[3], 10) || 0,
      pairs,
      commented,
      tail
    };
  };

  const storageKindFor = (data: { kind: string; symbol: string }): CobolStorageKind => {
    if (data.kind === 'register') {
      return 'register';
    }
    if (data.kind === 'local') {
      return 'local';
    }
    const decl = tables.storage.get(data.symbol);
    if (decl?.kind === 'pointer') {
      return 'linkage';
    }
    if (decl?.kind === 'int') {
      return 'register';
    }
    if (decl?.kind === 'array') {
      return 'static';
    }
    if (section === 'LINKAGE') {
      return 'linkage';
    }
    if (section === 'LOCAL-STORAGE') {
      return 'local';
    }
    return 'static';
  };

  const conditionValues = (valueText: string): CobolConditionValue[] => {
    const values: CobolConditionValue[] = [];
    for (const alternative of splitOnKeyword(valueText, 'OR')) {
      const [loText, hiText] = splitOnKeyword(alternative, 'THRU');
      const lo = resolveValue(loText);
      const hi = hiText !== undefined ? resolveValue(hiText) : undefined;
      const value: CobolConditionValue = { lo: lo.text, resolved: lo.resolved && (hi ? hi.resolved : true) };
      if (hi) {
        value.hi = hi.text;
      }
      if (lo.kind) {
        value.kind = lo.kind;
      }
      values.push(value);
    }
    return values;
  };

  const resolveValue = (raw: string): { text: string; resolved: boolean; kind?: CobolConditionValue['kind'] } => {
    const text = raw.trim();
    const constant = /&\s*(c_\d+)\b/.exec(text);
    if (constant) {
      const literal = tables.constants.get(constant[1]);
      if (literal) {
        // cobc types an `ALL "x"` literal as ALPHANUMERIC_ALL; a plain literal keeps its own class.
        const all = tables.attrs.get(literal.attrSymbol)?.type === COB_TYPE.ALPHANUMERIC_ALL;
        return { text: literal.text, resolved: true, kind: all ? 'all' : 'literal' };
      }
      return { text, resolved: false };
    }
    const figurative = /&\s*(cob_(?:all_)?(?:space|zero|low|high|quote|null))\b/.exec(text);
    if (figurative && FIGURATIVE[figurative[1]]) {
      return { text: FIGURATIVE[figurative[1]], resolved: true, kind: 'figurative' };
    }
    return { text, resolved: false };
  };

  const findRedefined = (item: CobolDataItem, siblings: number[]): number | undefined => {
    for (let k = siblings.length - 1; k >= 0; k -= 1) {
      const sibling = items[siblings[k]];
      if (
        sibling.level !== 88 &&
        sibling.redefinesItemId === undefined &&
        sibling.storage.symbol === item.storage.symbol &&
        sibling.offset === item.offset
      ) {
        return sibling.id;
      }
    }
    return undefined;
  };

  const addItem = (call: DumpCall): void => {
    const id = items.length;
    let parent: CobolDataItem | undefined;
    if (call.level === 88) {
      parent = lastNon88 !== undefined ? items[lastNon88] : undefined;
      if (!parent) {
        diag('warn', 'level-88 item has no preceding conditional variable; skipped', call.name);
        return;
      }
    } else if (call.level === 66 || call.level === 78) {
      parent = stack.length > 0 ? items[stack[0].id] : undefined;
    } else if (call.level === 0) {
      // cobc dumps `OCCURS … INDEXED BY` index-names and an FD's record area at level 0,
      // between an 01 and its subordinates: a root of its own that must leave the level
      // stack alone, or the table that follows would be re-parented under the index.
      parent = undefined;
    } else {
      if (call.level === 1 || call.level === 77) {
        stack = [];
      } else {
        while (stack.length > 0 && stack[stack.length - 1].level >= call.level) {
          stack.pop();
        }
      }
      parent = stack.length > 0 ? items[stack[stack.length - 1].id] : undefined;
    }

    let data = parseDataExpr(call.field.dataExpr);
    if (data?.kind === 'null') {
      if (call.field.fieldSymbol && parent && call.level !== 88) {
        // A subordinate whose static `cob_field` has NULL data and that no statement
        // binds with COB_SET_DATA — LOCAL-STORAGE group members. cobc's own dump prints
        // a codegen error for these; the address follows from the parent and the
        // declaration order (subordinates are contiguous, a REDEFINES restarts at its
        // target, which the running offset below already accounts for).
        data = {
          kind: parent.storage.symbol === 'cob_local_ptr' ? 'local' : 'symbol',
          symbol: parent.storage.symbol,
          offset: parent.offset + (layoutNext.get(parent.id) ?? 0)
        };
      } else {
        if (call.field.fieldSymbol) {
          diag('warn', `field ${call.field.fieldSymbol} has NULL data, no COB_SET_DATA binding and no enclosing group; skipped`, call.name);
        }
        // Else the `if (b_N == NULL)` arm of a LINKAGE/BASED dump: no address to record.
        return;
      }
    }
    if (!data) {
      diag('warn', `data address is not a static expression: ${call.field.dataExpr}`, call.name);
    }
    const symbol = data ? data.symbol : call.field.dataExpr;
    const offset = call.offsetArg + (data ? data.offset : 0);
    const kind = data ? storageKindFor(data) : storageKindFor({ kind: 'symbol', symbol });

    const attr = call.field.attrSymbol ? tables.attrs.get(call.field.attrSymbol) : undefined;
    if (call.field.attrSymbol && !attr) {
      diag('warn', `attribute ${call.field.attrSymbol} is not declared in the .c.h`, call.name);
    }

    let size = call.field.size;
    if (call.field.sizeExpr) {
      // Runtime-sized (ODO) item: the static array length bounds it.
      const decl = tables.storage.get(symbol);
      size = decl?.kind === 'array' && decl.size !== undefined ? Math.max(0, decl.size - offset) : 0;
    }

    const item: CobolDataItem = {
      id,
      name: call.name,
      qualifiedName: uniqueQualifiedName(parent ? `${call.name} OF ${parent.qualifiedName}` : call.name),
      level: call.level,
      section,
      children: [],
      storage: { kind, symbol },
      offset,
      size,
      usage: call.level === 88 && parent ? parent.usage : usageFor(attr, size),
      occursDims: [],
      flags: {}
    };
    if (currentFile && section === 'FILE') {
      item.fileName = currentFile.name;
    }
    if (parent) {
      item.parentId = parent.id;
    }
    if (call.field.sizeExpr) {
      item.sizeExpr = call.field.sizeExpr;
    }
    if (attr) {
      item.attr = attr;
    }
    if (call.field.fieldSymbol) {
      item.fieldSymbol = call.field.fieldSymbol;
    }
    if (call.level !== 88) {
      const picture = reconstructPicture(attr, size, input.cobcVersion);
      if (picture) {
        item.picture = picture;
      }
    }

    const tail = call.tail;
    if (/\bBASED\b/.test(tail)) {
      item.flags.based = true;
    }
    if (/\bEXTERNAL\b/.test(tail)) {
      item.flags.external = true;
    }
    if (/\bGLOBAL\b/.test(tail)) {
      item.flags.global = true;
    }
    if (/\bANY\s*LENGTH\b/.test(tail)) {
      item.flags.anyLength = true;
    }

    if (call.level === 88) {
      const valueText = valueTagText(tail);
      const raw = valueText ?? tail;
      item.condition = { values: valueText !== undefined ? conditionValues(raw) : [], raw };
      if (valueText === undefined) {
        diag('warn', 'level-88 item without a VALUE tag', call.name);
      }
    }

    // OCCURS: this item owns a subscript when its call carries one more pair than its parent.
    const inheritedDims = parent ? parent.occursDims : [];
    const ownsLoop = call.pairs.length > inheritedDims.length && call.pairs.length > 0;
    if (call.pairs.length !== inheritedDims.length + (ownsLoop ? 1 : 0)) {
      diag('warn', `subscript count ${call.pairs.length} does not match the parent's ${inheritedDims.length}`, call.name);
    }
    if (ownsLoop) {
      const own = call.pairs[call.pairs.length - 1];
      const occursTag = /\bOCCURS\s+(\d+)\s+(\d+)/.exec(tail);
      const decl = maxByIndex.get(own.index);
      const max = occursTag ? parseInt(occursTag[2], 10) : decl?.cap ?? decl?.literal ?? 0;
      const min = occursTag ? parseInt(occursTag[1], 10) : decl?.expr ? 1 : max;
      item.occurs = { min, max, elemSize: own.elemSize };
      if (decl?.expr) {
        item.occurs.dependingExpr = decl.expr;
      }
      loopOwner.set(own.index, id);
    }
    for (let k = 0; k < call.pairs.length; k += 1) {
      const pair = call.pairs[k];
      const ownerId = ownsLoop && k === call.pairs.length - 1 ? id : loopOwner.get(pair.index);
      if (ownerId === undefined) {
        diag('warn', `subscript i_${pair.index} has no enclosing OCCURS item`, call.name);
        item.occursDims.push({ itemId: -1, elemSize: pair.elemSize, max: 0 });
        continue;
      }
      const owner = ownerId === id ? item : items[ownerId];
      item.occursDims.push({ itemId: ownerId, elemSize: pair.elemSize, max: owner.occurs?.max ?? 0 });
    }

    items.push(item);

    if (parent) {
      if (/\bREDEFINES\b/.test(tail)) {
        const redefined = findRedefined(item, parent.children);
        if (redefined !== undefined) {
          item.redefinesItemId = redefined;
        } else {
          diag('warn', 'REDEFINES tag but no earlier sibling shares its storage', call.name);
        }
      }
      parent.children.push(id);
      if (call.level !== 88 && call.level !== 66 && call.level !== 78 && item.storage.symbol === parent.storage.symbol) {
        const extent = item.sizeExpr !== undefined ? 0 : item.size * (item.occurs ? item.occurs.max : 1);
        layoutNext.set(parent.id, Math.max(layoutNext.get(parent.id) ?? 0, item.offset - parent.offset + extent));
        if (parent.sizeExpr !== undefined && parent.size < (layoutNext.get(parent.id) ?? 0)) {
          // A runtime-sized group outside static storage (LOCAL-STORAGE, LINKAGE): its
          // static size is the layout's maximum extent, as the listing reports it.
          parent.size = layoutNext.get(parent.id) ?? 0;
        }
      }
    } else {
      const roots = rootsFor(section);
      if (/\bREDEFINES\b/.test(tail)) {
        const redefined = findRedefined(item, roots);
        if (redefined !== undefined) {
          item.redefinesItemId = redefined;
        } else {
          diag('warn', 'REDEFINES tag but no earlier sibling shares its storage', call.name);
        }
      }
      roots.push(id);
      if (currentFile && section === 'FILE') {
        currentFile.recordItemIds.push(id);
      }
    }

    if (call.level !== 88 && call.level !== 66 && call.level !== 78 && call.level !== 0) {
      stack.push({ id, level: call.level });
      lastNon88 = id;
    }
  };

  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const t = lines[i].trim();
    if (!t) {
      continue;
    }
    const opens = (t.match(/\{/g) ?? []).length;
    const closes = (t.match(/\}/g) ?? []).length;

    const output = /cob_dump_output\s*\(\s*"([^"]*)"/.exec(t);
    if (output) {
      const label = output[1].trim().toUpperCase();
      if (label.startsWith('END OF DUMP')) {
        break;
      }
      const next = SECTION_LABELS[label];
      if (next) {
        resetSection(next);
      } else {
        diag('warn', `unrecognised dump section label "${output[1]}"`);
      }
    } else if (/^P_cancel\s*:/.test(t) || /^P_clear_decimal\s*:/.test(t)) {
      break;
    } else if (/cob_dump_file\s*\(/.test(t)) {
      const m = /cob_dump_file\s*\(\s*"([^"]*)"\s*,\s*([A-Za-z_]\w*)\s*\)/.exec(t);
      if (m) {
        resetSection('FILE');
        currentFile = { name: m[1].replace(/^(?:FD|SD)\s+/i, '').toUpperCase(), handle: m[2], recordItemIds: [] };
        files.push(currentFile);
      } else {
        diag('warn', `unrecognised cob_dump_file call: ${t}`);
      }
    } else if (/^int\s+max_\d+\s*=/.test(t)) {
      const m = /^int\s+max_(\d+)\s*=([^;]*);/.exec(t);
      if (m) {
        const rhs = m[2].trim();
        const decl: MaxDecl = /^\d+$/.test(rhs) ? { literal: parseInt(rhs, 10) } : { expr: rhs };
        maxByIndex.set(parseInt(m[1], 10), decl);
      }
    } else if (/^if\s*\(\s*max_\d+\s*>/.test(t)) {
      const m = /^if\s*\(\s*max_(\d+)\s*>\s*(\d+)\s*\)\s*max_\1\s*=\s*\2/.exec(t);
      if (m) {
        const decl = maxByIndex.get(parseInt(m[1], 10));
        if (decl) {
          decl.cap = parseInt(m[2], 10);
        }
      }
    } else if (/^if\s*\(\s*[A-Za-z_]\w*\s*==\s*NULL\s*\)/.test(t)) {
      skipDepth = braceDepth + 1;
    } else {
      const callIdx = t.indexOf('cob_dump_field_ext');
      if (callIdx >= 0 && !(skipDepth !== undefined && braceDepth >= skipDepth)) {
        const call = parseCall(t, callIdx);
        if (call) {
          addItem(call);
        }
      }
    }

    braceDepth += opens - closes;
    // The guard is armed on the `if` line, one line before its `{`, so only a closing
    // brace can end it.
    if (closes > 0 && skipDepth !== undefined && braceDepth < skipDepth) {
      skipDepth = undefined;
    }
  }

  resolveDependingOn(items, diag);
  synthesizeReturnCode(items, rootsFor, tables, qualifiedNames);

  const roots: CobolProgram['roots'] = [];
  for (const [s, itemIds] of rootsBySection) {
    roots.push({ section: s, itemIds });
  }
  return { found: true, items, roots, files, diagnostics };
}

/** Bind each ODO's `dependingExpr` to the item whose storage it reads. */
/**
 * Split a VALUE list on a whitespace-delimited keyword (`OR`, `THRU`) outside quoted
 * literals, in one left-to-right pass: `'A OR B' OR 'C'` -> `["'A OR B'", "'C'"]`.
 */
function splitOnKeyword(text: string, keyword: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: string | undefined;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote !== undefined) {
      if (ch === quote) {
        quote = undefined;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (!isSpace(ch)) {
      continue;
    }
    let j = i;
    while (j < text.length && isSpace(text[j])) {
      j++;
    }
    const keywordEnd = j + keyword.length;
    if (text.startsWith(keyword, j) && keywordEnd < text.length && isSpace(text[keywordEnd])) {
      parts.push(text.slice(start, i));
      let k = keywordEnd;
      while (k < text.length && isSpace(text[k])) {
        k++;
      }
      start = k;
      i = k - 1;
    } else {
      i = j - 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\f' || ch === '\v';
}

/** The text after a `VALUE ` tag on a dump-comment tail, up to any trailing C comment, trimmed. */
function valueTagText(tail: string): string | undefined {
  const at = tail.search(/\bVALUE\s/);
  if (at < 0) {
    return undefined;
  }
  let text = tail.slice(at + 'VALUE'.length);
  const comment = text.indexOf('/*');
  if (comment >= 0) {
    text = text.slice(0, comment);
  }
  return text.trim();
}

function resolveDependingOn(items: CobolDataItem[], diag: (level: 'warn' | 'error', message: string, item?: string) => void): void {
  for (const item of items) {
    const expr = item.occurs?.dependingExpr;
    if (!item.occurs || !expr) {
      continue;
    }
    let target: CobolDataItem | undefined;
    const byField = /&\s*(f_\d+)\b/.exec(expr);
    if (byField) {
      target = items.find((o) => o.fieldSymbol === byField[1]);
    } else {
      const byStorage = /\b(b_\d+|cob_local_ptr)\b((?:\s*\+\s*\d+(?:[uU]?[lL]{0,2})?)*)/.exec(expr);
      if (byStorage) {
        const symbol = byStorage[1];
        // Nested offsets come as separate terms (`cob_local_ptr + 16 + 4`).
        let offset = 0;
        for (const term of byStorage[2].matchAll(/\d+/g)) {
          offset += parseInt(term[0], 10);
        }
        const candidates = items.filter(
          (o) => o.level !== 88 && o.storage.symbol === symbol && o.offset === offset && o.usage !== 'GROUP'
        );
        target = candidates[0] ?? items.find((o) => o.level !== 88 && o.storage.symbol === symbol && o.offset === offset);
      }
    }
    if (target) {
      item.occurs.dependingOnItemId = target.id;
    } else {
      diag('warn', `DEPENDING ON expression does not match a known item: ${expr}`, item.name);
    }
  }
}

/**
 * 3.1.2 does not dump RETURN-CODE (3.2 does, as a level 77 with `(cob_u8_t *)&b_2`), but
 * every version declares it as `static int b_N; /* RETURN-CODE *\/`. Add it from that
 * declaration so the manifest is uniform across compiler versions.
 */
function synthesizeReturnCode(
  items: CobolDataItem[],
  rootsFor: (s: CobolSection) => number[],
  tables: AttrTables,
  qualifiedNames: Set<string>
): void {
  if (items.some((o) => o.name === 'RETURN-CODE' && o.storage.kind === 'register')) {
    return;
  }
  const decl = [...tables.storage.values()].find((d) => d.kind === 'int' && d.comment === 'RETURN-CODE');
  if (!decl) {
    return;
  }
  const id = items.length;
  const attr = { ...RETURN_CODE_ATTR };
  qualifiedNames.add('RETURN-CODE');
  items.push({
    id,
    name: 'RETURN-CODE',
    qualifiedName: 'RETURN-CODE',
    level: 77,
    section: 'WORKING-STORAGE',
    children: [],
    storage: { kind: 'register', symbol: decl.symbol },
    offset: 0,
    size: 4,
    attr,
    picture: reconstructPicture(attr, 4),
    usage: usageFor(attr),
    occursDims: [],
    flags: {}
  });
  rootsFor('WORKING-STORAGE').push(id);
}
