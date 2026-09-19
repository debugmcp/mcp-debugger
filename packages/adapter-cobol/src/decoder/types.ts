/**
 * Public types of the COBOL value decoder.
 *
 * A `DecodedValue` is what the DAP shim shows for one data item: the rendered `value`,
 * a `type` string in COBOL's own vocabulary (`PIC S9(5)V99 COMP-3`), and a `kind` the
 * caller can branch on. Numeric kinds also carry the exact mantissa/scale pair so that
 * level-88 conditions can be evaluated without re-parsing the rendered string.
 */

import type { CobolDataItem } from '../manifest/schema.js';

export interface DecodeOptions {
  /** Byte order of the debuggee host. Defaults to `os.endianness() === 'LE'` of this process. */
  hostLittleEndian?: boolean;
  /** Alphanumeric values longer than this many bytes are cut and suffixed with ` …(+N bytes)`. Default 512. */
  maxTextChars?: number;
  /** Group previews show at most this many bytes, then ` … (N bytes)`. Default 64. */
  groupPreviewBytes?: number;
}

export type DecodedKind =
  | 'numeric'
  | 'text'
  | 'group'
  | 'pointer'
  | 'float'
  | 'boolean'
  | 'invalid'
  | 'unsupported';

export type SignSeen = 'ascii-overpunch' | 'ebcdic-overpunch' | 'separate' | 'nibble' | 'none';

export interface DecodedNumeric {
  /** Exact integer value before the decimal point is applied: `value = mantissa × 10^-scale`. */
  mantissa: bigint;
  scale: number;
  /** How the sign was encoded in storage (diagnostic: an EBCDIC-style overpunch in an ASCII program is worth noticing). */
  signSeen?: SignSeen;
}

export interface DecodedValue {
  /** What the debugger shows, e.g. `-123.45`, `"ALICE               "`, `<invalid packed: 0x4142434445>`. */
  value: string;
  /** COBOL-vocabulary type, e.g. `PIC S9(5)V99 COMP-3`, `PIC X(20)`, `GROUP (25 bytes)`, `POINTER`. */
  type: string;
  kind: DecodedKind;
  numeric?: DecodedNumeric;
  /** Reason text when `kind === 'invalid'`. */
  invalid?: string;
  /**
   * Full latin1 content for `text` and `group` kinds — never truncated or escaped, unlike `value`.
   * Level-88 comparisons and `THRU` ranges are evaluated against this, so a 4 KB record
   * compares correctly even though its `value` preview stops at `groupPreviewBytes`.
   */
  text?: string;
}

export type DecodableItem = Pick<CobolDataItem, 'attr' | 'size' | 'usage' | 'picture' | 'level' | 'flags'> & {
  occurs?: CobolDataItem['occurs'];
};

/** What the per-usage decoders return; the dispatcher stamps `type` from `describeType`. */
export type Decoded = Omit<DecodedValue, 'type'>;
