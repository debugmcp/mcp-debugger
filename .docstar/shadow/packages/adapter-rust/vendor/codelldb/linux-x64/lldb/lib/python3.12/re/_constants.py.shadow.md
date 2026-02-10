# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/re/_constants.py
@source-hash: fa4fdb200f238f9e
@generated: 2026-02-09T18:06:17Z

## Purpose
Internal constants and symbols module for Python's regular expression engine (SRE). Defines opcodes, flags, character categories, and exception handling for regex compilation and execution.

## Key Components

### Exception Class
- **`error` (L23-53)**: Custom exception for invalid regex patterns with enhanced error reporting including position, line/column information, and pattern context.

### Named Constants Infrastructure  
- **`_NamedIntConstant` (L56-65)**: Integer subclass that preserves symbolic names for debugging/representation
- **`_makecodes()` (L69-72)**: Factory function that creates named integer constants and injects them into global namespace

### Core Constants
- **`MAGIC` (L16)**: Version identifier (20221023) for constants compatibility
- **`MAXREPEAT`/`MAXGROUPS` (L18, L67)**: Imported limits from `_sre` C extension, wrapped as named constants

### Opcode Categories
- **`OPCODES` (L75-123)**: Complete set of regex engine operation codes including:
  - Basic operations (LITERAL, ANY, BRANCH)
  - Quantifiers (REPEAT, MIN_UNTIL, MAX_UNTIL) 
  - Assertions (ASSERT, AT)
  - Character classes (CATEGORY, CHARSET)
  - Case-insensitive variants (_IGNORE suffixes)
  - Locale/Unicode variants (_LOC, _UNI suffixes)
  - Note: MIN_REPEAT/MAX_REPEAT removed at L124 (parser-only opcodes)

- **`ATCODES` (L127-135)**: Position assertion codes for anchors and boundaries
- **`CHCODES` (L138-150)**: Character category codes for \d, \s, \w patterns with locale/unicode variants

### Flag Definitions
- **SRE_FLAG_* (L207-215)**: Regex compilation flags for case sensitivity, multiline mode, unicode handling, etc.
- **SRE_INFO_* (L218-220)**: Optimization flags for pattern analysis

### Mapping Tables
Transformation dictionaries for different regex modes:
- **`OP_IGNORE` (L154-157)**: Case-insensitive operation mappings
- **`OP_LOCALE_IGNORE` (L159-162)**: Locale-aware case-insensitive mappings  
- **`OP_UNICODE_IGNORE` (L164-167)**: Unicode case-insensitive mappings
- **`AT_MULTILINE` (L169-172)**: Anchor transformations for multiline mode
- **`AT_LOCALE`/`AT_UNICODE` (L174-182)**: Boundary operation locale/unicode variants
- **`CH_LOCALE`/`CH_UNICODE` (L184-204)**: Character category locale/unicode mappings

## Dependencies
- `_sre`: C extension module providing MAXREPEAT and MAXGROUPS constants
- Standard Python exception hierarchy

## Architecture Notes
- Uses dynamic global injection via `_makecodes()` to create named constants
- Follows enumeration pattern with symbolic names for debugging
- Supports multiple locale/encoding modes (ASCII, locale, unicode)
- Maintains backward compatibility through MAGIC version number