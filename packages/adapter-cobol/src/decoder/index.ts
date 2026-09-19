/**
 * COBOL value decoder: raw debuggee bytes + a manifest data item → what the debugger shows.
 *
 *   decodeItem(bytes, item, opts)          → DecodedValue (never throws)
 *   describeType(item)                     → 'PIC S9(5)V99 COMP-3' | 'GROUP (25 bytes)' | 'POINTER' | …
 *   evaluateCondition(cond, parent, item)  → 'true' | 'false' | '<unknown: …>'
 *   formatNumeric(mantissa, scale)         → canonical decimal text
 *   reconstructPictureFromAttr(attr, size) → 'S9(5)V99' | 'X(12)' | undefined
 */

export type {
  DecodableItem,
  DecodeOptions,
  DecodedKind,
  DecodedNumeric,
  DecodedValue,
  SignSeen
} from './types.js';
export { decodeItem, describeType, reconstructPictureFromAttr } from './cobol-value-decoder.js';
export { formatNumeric } from './format.js';
export { evaluateCondition } from './conditions.js';
