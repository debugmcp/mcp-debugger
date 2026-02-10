# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/rustc_literal_escaper.rs
@source-hash: 188cbe8fffe7af38
@generated: 2026-02-09T18:11:54Z

**Purpose:** Vendored utilities from rustc-literal-escaper for validating and unescaping Rust string, char, and byte literals. Handles escape sequences, raw strings, and various literal types with comprehensive error reporting.

## Core Types

**EscapeError (L13-82):** Comprehensive error enum covering all escape sequence validation failures:
- Character count errors: `ZeroChars`, `MoreThanOneChar` 
- Escape validation: `LoneSlash`, `InvalidEscape`, `BareCarriageReturn`
- Hex escapes: `TooShortHexEscape`, `InvalidCharInHexEscape`, `OutOfRangeHexEscape`
- Unicode escapes: `NoBraceInUnicodeEscape`, `EmptyUnicodeEscape`, `OverlongUnicodeEscape`, etc.
- Type-specific: `UnicodeEscapeInByte`, `NonAsciiCharInByte`, `NulInCStr`
- Warnings: `UnskippedWhitespaceWarning`, `MultipleSkippedLinesWarning`

**MixedUnit (L245-305):** Enum for C string literals supporting both Unicode chars and high bytes:
- `Char(NonZeroChar)` - ASCII/Unicode characters
- `HighByte(NonZeroU8)` - High bytes (\x80..\xff)

**Mode (L598-643):** Literal type classifier with methods for quote style and prefix detection.

## Key Traits

**CheckRaw (L117-157):** Validates raw string literals without escape processing:
- `char2raw_unit()` - converts chars to target unit type
- `check_raw()` - validates raw strings, only checking for bare \r

**Unescape (L307-398):** Processes escape sequences in string literals:
- `unescape_single()` - handles single-character literals (L328-339)
- `unescape_1()` - processes first escape after backslash (L342-363)  
- `unescape()` - full string unescaping with continuation support (L370-397)

## Implementation Matrix

**str (L159-166, L516-544):** Regular string handling, accepts all valid chars
**[u8] (L168-175, L546-570):** Byte string handling, rejects non-ASCII, blocks Unicode escapes
**CStr (L188-195, L572-596):** C string handling via MixedUnit, rejects null chars

## Public Functions

**Validation APIs (L84-115):**
- `check_raw_str()`, `check_raw_byte_str()`, `check_raw_c_str()`

**Unescaping APIs (L197-243):**
- `unescape_char()`, `unescape_byte()` - single character
- `unescape_str()`, `unescape_byte_str()`, `unescape_c_str()` - full strings

**Error Checking (L652-701):**
- `check_for_errors()` - validates any literal type without producing output

## Escape Processing Details

**simple_escape() (L404-416):** Handles basic escapes (\n, \r, \t, \\, \', \")
**hex_escape() (L422-430):** Processes \xNN sequences  
**unicode_escape() (L437-480):** Handles \u{...} with validation for overlong/invalid codes
**skip_ascii_whitespace() (L488-514):** Implements string continuation after backslash-newline

## Dependencies
- `crate::num::NonZeroChar` - custom non-zero char wrapper
- Standard library: `CStr`, `NonZeroU8`, `Range`, `Chars`

## Architecture Notes
- Trait-based design allows uniform handling across string types
- Callback-based APIs enable flexible error handling and streaming
- Comprehensive validation covers all Rust literal syntax edge cases
- Performance-optimized character iteration with position tracking