/**
 * Picture and usage reconstruction from a libcob `cob_field_attr`.
 *
 * The listing's PICTURE column is the source text verbatim (`S9(5)V99`, `X`) and wins when
 * present; this is the fallback for builds without `-t … -ftsymbols`. It reconstructs a
 * canonical form (`9(n)` for n > 1, the bare symbol for n = 1), which is enough for a
 * debugger to show the item's shape but is not guaranteed to match the source spelling.
 */
import { COB_FLAG, COB_TYPE, hasFlag, isNumericType } from './attr-constants.js';
import type { CobolFieldAttr, CobolUsage } from './schema.js';

function rep(symbol: string, n: number): string {
  if (n <= 0) {
    return '';
  }
  return n === 1 ? symbol : `${symbol}(${n})`;
}

/**
 * Usage per libcob's type/flag encoding. `_size` is accepted for signature stability —
 * no usage is currently distinguished by byte size alone.
 */
export function usageFor(attr: CobolFieldAttr | undefined, _size?: number): CobolUsage {
  if (!attr) {
    return 'OTHER';
  }
  if (hasFlag(attr.flags, COB_FLAG.IS_POINTER)) {
    return 'POINTER';
  }
  switch (attr.type) {
    case COB_TYPE.GROUP:
      return 'GROUP';
    case COB_TYPE.NUMERIC_DISPLAY:
      return 'DISPLAY';
    case COB_TYPE.NUMERIC_BINARY:
      return hasFlag(attr.flags, COB_FLAG.REAL_BINARY) ? 'COMP-5' : 'COMP';
    case COB_TYPE.NUMERIC_PACKED:
      return hasFlag(attr.flags, COB_FLAG.NO_SIGN_NIBBLE) ? 'COMP-6' : 'COMP-3';
    case COB_TYPE.NUMERIC_FLOAT:
      return 'COMP-1';
    case COB_TYPE.NUMERIC_DOUBLE:
      return 'COMP-2';
    case COB_TYPE.NUMERIC_COMP5:
      return 'COMP-5';
    case COB_TYPE.ALPHANUMERIC:
    case COB_TYPE.ALPHANUMERIC_ALL:
    case COB_TYPE.ALPHANUMERIC_EDITED:
    case COB_TYPE.NUMERIC_EDITED:
      return 'DISPLAY';
    case COB_TYPE.NATIONAL:
    case COB_TYPE.NATIONAL_EDITED:
      return 'NATIONAL';
    default:
      return 'OTHER';
  }
}

/**
 * Canonical picture for an elementary item, or undefined when the attr does not describe
 * one (groups, pointers, edited items without a symbol array, unknown types).
 *
 * Numeric: `[S]9(d-s)V9(s)`; a scale beyond the digit count or a negative scale is
 * expressed with `P` (`VPP9`, `9(3)PP`), the way the source must have written it.
 */
export function reconstructPicture(attr: CobolFieldAttr | undefined, size: number): string | undefined {
  if (!attr || attr.type === COB_TYPE.GROUP || hasFlag(attr.flags, COB_FLAG.IS_POINTER)) {
    return undefined;
  }
  if (attr.pic && attr.pic.length > 0) {
    return attr.pic.map(({ symbol, count }) => rep(symbol, count)).join('');
  }
  if (isNumericType(attr.type)) {
    const { digits, scale } = attr;
    if (digits <= 0) {
      return undefined;
    }
    const sign = hasFlag(attr.flags, COB_FLAG.HAVE_SIGN) ? 'S' : '';
    if (scale <= 0) {
      return sign + rep('9', digits) + rep('P', -scale);
    }
    if (scale < digits) {
      return sign + rep('9', digits - scale) + 'V' + rep('9', scale);
    }
    if (scale === digits) {
      return sign + 'V' + rep('9', digits);
    }
    return sign + 'V' + rep('P', scale - digits) + rep('9', digits);
  }
  switch (attr.type) {
    case COB_TYPE.ALPHANUMERIC:
    case COB_TYPE.ALPHANUMERIC_ALL:
      return size > 0 ? rep('X', size) : undefined;
    case COB_TYPE.NATIONAL:
      // libcob stores national data as 2-byte units.
      return size > 0 && size % 2 === 0 ? rep('N', size / 2) : undefined;
    default:
      return undefined;
  }
}
