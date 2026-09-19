/**
 * Dispatch: one `CobolDataItem` (its libcob attr, size, usage, picture) plus the raw bytes
 * read from the debuggee → one `DecodedValue`. `decodeItem` never throws — every failure
 * mode is a `kind: 'invalid'` / `'unsupported'` value with the raw bytes in it, because a
 * debugger that raises on bad data hides exactly the thing the user came to see.
 */

import { endianness } from 'node:os';
import { COB_FLAG, COB_TYPE, hasFlag } from '../manifest/attr-constants.js';
import type { CobolFieldAttr } from '../manifest/schema.js';
import { decodeBinary, decodePointer } from './binary.js';
import { decodeDisplay } from './display.js';
import { decodeFloat32, decodeFloat64 } from './float.js';
import { hexOf, invalidValue } from './format.js';
import { decodePacked } from './packed.js';
import { decodeBoolean, decodeGroup, decodeText } from './text.js';
import type { DecodableItem, DecodeOptions, Decoded, DecodedValue } from './types.js';

interface ResolvedOptions {
  hostLittleEndian: boolean;
  maxTextChars: number;
  groupPreviewBytes: number;
}

const DEFAULT_MAX_TEXT_CHARS = 512;
const DEFAULT_GROUP_PREVIEW_BYTES = 64;

function resolveOptions(opts: DecodeOptions | undefined): ResolvedOptions {
  return {
    hostLittleEndian: opts?.hostLittleEndian ?? endianness() === 'LE',
    maxTextChars: opts?.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS,
    groupPreviewBytes: opts?.groupPreviewBytes ?? DEFAULT_GROUP_PREVIEW_BYTES
  };
}

const FLOAT32_TYPES: ReadonlySet<number> = new Set([COB_TYPE.NUMERIC_FLOAT, COB_TYPE.NUMERIC_FP_BIN32]);
const FLOAT64_TYPES: ReadonlySet<number> = new Set([COB_TYPE.NUMERIC_DOUBLE, COB_TYPE.NUMERIC_FP_BIN64]);
const TEXT_TYPES: ReadonlySet<number> = new Set([
  COB_TYPE.ALPHANUMERIC,
  COB_TYPE.ALPHANUMERIC_ALL,
  COB_TYPE.ALPHANUMERIC_EDITED,
  COB_TYPE.NUMERIC_EDITED
]);

/** Types that store a decimal number the debugger reconstructs digit by digit. */
const FIXED_NUMERIC_TYPES: ReadonlySet<number> = new Set([
  COB_TYPE.NUMERIC_DISPLAY,
  COB_TYPE.NUMERIC_BINARY,
  COB_TYPE.NUMERIC_PACKED,
  COB_TYPE.NUMERIC_COMP5
]);

function isPointer(item: DecodableItem): boolean {
  return item.attr !== undefined && hasFlag(item.attr.flags, COB_FLAG.IS_POINTER);
}

/** Decode with every input already validated; the caller wraps this in try/catch. */
function dispatch(bytes: Uint8Array, item: DecodableItem, opts: ResolvedOptions): Decoded {
  if (item.level === 88) {
    return invalidValue('<level 88 has no storage>', 'condition names are evaluated against their parent item');
  }
  if (bytes.length < item.size) {
    return invalidValue(
      `<short read: ${bytes.length} of ${item.size} bytes: 0x${hexOf(bytes)}>`,
      `expected ${item.size} bytes, got ${bytes.length}`
    );
  }
  const data = item.size > 0 && bytes.length > item.size ? bytes.subarray(0, item.size) : bytes;

  const attr = item.attr;
  if (isPointer(item) || (!attr && item.usage === 'POINTER')) {
    return decodePointer(data, opts.hostLittleEndian);
  }
  if (!attr || attr.type === COB_TYPE.GROUP) {
    return decodeGroup(data, opts.groupPreviewBytes);
  }
  if (TEXT_TYPES.has(attr.type)) {
    return decodeText(data, opts.maxTextChars);
  }
  if (attr.type === COB_TYPE.BOOLEAN) {
    return decodeBoolean(data);
  }
  if (FIXED_NUMERIC_TYPES.has(attr.type) && data.length === 0) {
    return invalidValue(
      `<invalid ${usageWord(attr)}: no storage>`,
      `attr says ${usageWord(attr)} (type 0x${attr.type.toString(16)}) but the item has size 0`
    );
  }
  switch (attr.type) {
    case COB_TYPE.NUMERIC_DISPLAY:
      return decodeDisplay(data, attr);
    case COB_TYPE.NUMERIC_BINARY:
    case COB_TYPE.NUMERIC_COMP5:
      return decodeBinary(data, attr, opts.hostLittleEndian);
    case COB_TYPE.NUMERIC_PACKED:
      return decodePacked(data, attr);
    default:
      break;
  }
  if (FLOAT32_TYPES.has(attr.type)) {
    return decodeFloat32(data, opts.hostLittleEndian);
  }
  if (FLOAT64_TYPES.has(attr.type)) {
    return decodeFloat64(data, opts.hostLittleEndian);
  }
  return {
    value: `<usage 0x${attr.type.toString(16).padStart(2, '0')} unsupported: 0x${hexOf(data)}>`,
    kind: 'unsupported'
  };
}

function usageWord(attr: CobolFieldAttr): string {
  switch (attr.type) {
    case COB_TYPE.NUMERIC_DISPLAY:
      return 'display';
    case COB_TYPE.NUMERIC_PACKED:
      return 'packed';
    default:
      return 'binary';
  }
}

/**
 * Decode one item's storage. Never throws: an exception anywhere in the decoders becomes a
 * `kind: 'invalid'` value carrying the message and the raw hex.
 */
export function decodeItem(bytes: Uint8Array, item: DecodableItem, opts?: DecodeOptions): DecodedValue {
  let type: string;
  try {
    type = describeType(item);
  } catch (err) {
    type = `<type unavailable: ${errorMessage(err)}>`;
  }
  try {
    return { type, ...dispatch(bytes, item, resolveOptions(opts)) };
  } catch (err) {
    return {
      type,
      ...invalidValue(`<decode failed: ${errorMessage(err)}: 0x${hexOf(bytes)}>`, errorMessage(err))
    };
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------------------
// Type strings
// ---------------------------------------------------------------------------------------

/** `9(4)`, `X(12)`; a single symbol stands alone (`9`, `X`), the way the cobc listing prints it. */
function rep(symbol: string, count: number): string {
  return count === 1 ? symbol : `${symbol}(${count})`;
}

/** Fraction digits and scaling `P`s are written out while short — `V99`, `PP9` — and counted beyond that: `V9(4)`. */
function shortRep(symbol: string, count: number): string {
  return count <= 2 ? symbol.repeat(count) : `${symbol}(${count})`;
}

function numericPicture(attr: CobolFieldAttr, size: number): string | undefined {
  const digits = attr.digits > 0 ? attr.digits : attr.type === COB_TYPE.NUMERIC_DISPLAY ? size : 0;
  if (digits <= 0) {
    return undefined;
  }
  const scale = attr.scale;
  let pic = hasFlag(attr.flags, COB_FLAG.HAVE_SIGN) ? 'S' : '';
  if (scale <= 0) {
    // `9(d)` then `PP` for an assumed point to the right (`PIC 9(3)PP`).
    pic += rep('9', digits) + (scale < 0 ? shortRep('P', -scale) : '');
  } else if (scale < digits) {
    pic += `${rep('9', digits - scale)}V${shortRep('9', scale)}`;
  } else if (scale === digits) {
    pic += `V${shortRep('9', scale)}`;
  } else {
    // More scale than digits: an assumed point to the left (`PIC PP9`).
    pic += shortRep('P', scale - digits) + rep('9', digits);
  }
  return pic;
}

function editedPicture(attr: CobolFieldAttr): string | undefined {
  if (!attr.pic || attr.pic.length === 0) {
    return undefined;
  }
  let pic = '';
  for (const { symbol, count } of attr.pic) {
    if (count <= 0 || symbol === '' || symbol === '\0') {
      continue; // the `{'\0', 0}` terminator cobc emits, if the manifest kept it
    }
    pic += rep(symbol, count);
  }
  return pic === '' ? undefined : pic;
}

/**
 * Rebuild a PICTURE from the attr when the manifest has none: `S9(5)V99`, `9`, `X(12)`,
 * `Z(3)9`. Undefined for groups, pointers and floating-point usages (they have no picture).
 */
export function reconstructPictureFromAttr(attr: CobolFieldAttr, size: number): string | undefined {
  if (hasFlag(attr.flags, COB_FLAG.IS_POINTER)) {
    return undefined;
  }
  switch (attr.type) {
    case COB_TYPE.NUMERIC_DISPLAY:
    case COB_TYPE.NUMERIC_BINARY:
    case COB_TYPE.NUMERIC_PACKED:
    case COB_TYPE.NUMERIC_COMP5:
      return numericPicture(attr, size);
    case COB_TYPE.ALPHANUMERIC:
    case COB_TYPE.ALPHANUMERIC_ALL:
      return size > 0 ? rep('X', size) : undefined;
    case COB_TYPE.ALPHANUMERIC_EDITED:
    case COB_TYPE.NUMERIC_EDITED:
      return editedPicture(attr);
    case COB_TYPE.BOOLEAN:
      return rep('1', attr.digits > 0 ? attr.digits : size * 8);
    case COB_TYPE.NATIONAL:
      return size > 0 ? rep('N', Math.ceil(size / 2)) : undefined;
    case COB_TYPE.NATIONAL_EDITED:
      return editedPicture(attr);
    default:
      return undefined;
  }
}

/** The listing's PICTURE column already says `9(4) COMP-3`; do not append a second usage. */
const USAGE_IN_PICTURE = /\b(?:COMP(?:UTATIONAL)?(?:-[1-6XN])?|BINARY|PACKED-DECIMAL|DISPLAY|INDEX|POINTER|FLOAT-\S+)\b/i;

function usageSuffix(item: DecodableItem): string {
  const attr = item.attr;
  if (attr) {
    switch (attr.type) {
      case COB_TYPE.NUMERIC_BINARY:
        return hasFlag(attr.flags, COB_FLAG.REAL_BINARY) ? ' COMP-5' : ' COMP';
      case COB_TYPE.NUMERIC_COMP5:
        return ' COMP-5';
      case COB_TYPE.NUMERIC_PACKED:
        return hasFlag(attr.flags, COB_FLAG.NO_SIGN_NIBBLE) ? ' COMP-6' : ' COMP-3';
      case COB_TYPE.NUMERIC_DISPLAY:
        return '';
      default:
        break;
    }
  }
  switch (item.usage) {
    case 'COMP':
    case 'COMP-3':
    case 'COMP-5':
    case 'COMP-6':
      return ` ${item.usage}`;
    default:
      return '';
  }
}

const UNSUPPORTED_TYPE_NAMES: Readonly<Record<number, string>> = {
  [COB_TYPE.NUMERIC_L_DOUBLE]: 'FLOAT-LONG',
  [COB_TYPE.NUMERIC_FP_DEC64]: 'FLOAT-DECIMAL-16',
  [COB_TYPE.NUMERIC_FP_DEC128]: 'FLOAT-DECIMAL-34',
  [COB_TYPE.NUMERIC_FP_BIN128]: 'FLOAT-BINARY-128'
};

/**
 * COBOL-vocabulary type string: `PIC S9(5)V99 COMP-3`, `PIC X(20)`, `GROUP (25 bytes)`,
 * `POINTER`, `COMP-2`, with ` OCCURS <max>` appended for table elements. Level-88 items
 * are the caller's business (their "type" is the condition itself).
 */
export function describeType(item: DecodableItem): string {
  const occurs = item.occurs ? ` OCCURS ${item.occurs.max}` : '';
  return `${baseType(item)}${occurs}`;
}

function baseType(item: DecodableItem): string {
  const attr = item.attr;
  if (isPointer(item) || (item.usage === 'POINTER' && !attr)) {
    return 'POINTER';
  }
  if (item.usage === 'INDEX') {
    return 'INDEX';
  }
  if (!attr || attr.type === COB_TYPE.GROUP) {
    return `GROUP (${item.size} bytes)`;
  }
  if (FLOAT32_TYPES.has(attr.type)) {
    return 'COMP-1';
  }
  if (FLOAT64_TYPES.has(attr.type)) {
    return 'COMP-2';
  }
  const picture = item.picture?.trim() || reconstructPictureFromAttr(attr, item.size);
  if (picture) {
    const suffix = USAGE_IN_PICTURE.test(picture) ? '' : usageSuffix(item);
    return `PIC ${picture}${suffix}`;
  }
  if (attr.type === COB_TYPE.ALPHANUMERIC_EDITED || attr.type === COB_TYPE.NUMERIC_EDITED) {
    return `PIC (edited, ${item.size} bytes)`;
  }
  const named = UNSUPPORTED_TYPE_NAMES[attr.type];
  if (named) {
    return named;
  }
  return `<type 0x${attr.type.toString(16).padStart(2, '0')}> (${item.size} bytes)`;
}
