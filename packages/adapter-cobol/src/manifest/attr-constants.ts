/**
 * libcob `cob_field_attr` constants (from GnuCOBOL's public `libcob/common.h`, identical in 3.1.2 and 3.2).
 * These are interface facts of the runtime's data representation, used to interpret the
 * `{type, digits, scale, flags}` tuples cobc writes into `<prog>.c.h`.
 */

export const COB_TYPE = {
  UNKNOWN: 0x00,
  GROUP: 0x01,
  BOOLEAN: 0x02,
  NUMERIC_DISPLAY: 0x10,
  NUMERIC_BINARY: 0x11,
  NUMERIC_PACKED: 0x12,
  NUMERIC_FLOAT: 0x13,
  NUMERIC_DOUBLE: 0x14,
  NUMERIC_L_DOUBLE: 0x15,
  NUMERIC_FP_DEC64: 0x16,
  NUMERIC_FP_DEC128: 0x17,
  NUMERIC_FP_BIN32: 0x18,
  NUMERIC_FP_BIN64: 0x19,
  NUMERIC_FP_BIN128: 0x1a,
  NUMERIC_COMP5: 0x1b,
  ALPHANUMERIC: 0x21,
  ALPHANUMERIC_ALL: 0x22,
  ALPHANUMERIC_EDITED: 0x23,
  NUMERIC_EDITED: 0x24,
  NATIONAL: 0x40,
  NATIONAL_EDITED: 0x41
} as const;

export const COB_FLAG = {
  HAVE_SIGN: 0x0001,
  SIGN_SEPARATE: 0x0002,
  SIGN_LEADING: 0x0004,
  BLANK_ZERO: 0x0008,
  JUSTIFIED: 0x0010,
  BINARY_SWAP: 0x0020,
  REAL_BINARY: 0x0040,
  IS_POINTER: 0x0080,
  NO_SIGN_NIBBLE: 0x0100,
  IS_FP: 0x0200,
  REAL_SIGN: 0x0400,
  BINARY_TRUNC: 0x0800,
  CONSTANT: 0x1000
} as const;

/** `COB_TYPE_NUMERIC` is the class mask: every numeric type has bit 0x10 set. */
export function isNumericType(type: number): boolean {
  return (type & 0x10) !== 0 && type < 0x20;
}

export function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0;
}
