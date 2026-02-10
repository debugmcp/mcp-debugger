# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/re/_compiler.py
@source-hash: c05067f8bfa4c13c
@generated: 2026-02-09T18:11:25Z

## Purpose
Core compiler module for Python's Secret Labs Regular Expression (SRE) engine. Converts parsed regular expression patterns into bytecode for the _sre C extension module. Part of Python's standard library regex implementation.

## Key Components

### Core Compilation Functions
- `compile(p, flags=0)` (L740-765): Main entry point that converts pattern strings or parsed patterns to compiled regex objects
- `_code(p, flags)` (L573-586): Orchestrates the compilation process by generating info block and pattern bytecode
- `_compile(code, pattern, flags)` (L37-214): Primary recursive compiler that converts parsed pattern operations into bytecode sequences

### Bytecode Generation
- `_compile_info(code, pattern, flags)` (L511-568): Generates optimization info block with pattern width and literal/charset prefixes
- `_compile_charset(charset, flags, code)` (L216-241): Compiles character set subpatterns into bytecode

### Character Set Optimization
- `_optimize_charset(charset, iscased, fixup, fixes)` (L243-381): Optimizes character sets using bitmaps or ranges for efficient matching
- `_mk_bitmap(bits)` (L386-389): Converts bit patterns to integer arrays for charset representation
- `_bytes_to_codes(b)` (L391-396): Converts byte arrays to code word arrays

### Pattern Analysis Utilities
- `_get_literal_prefix(pattern, flags)` (L436-465): Extracts literal string prefixes for fast matching optimization
- `_get_charset_prefix(pattern, flags)` (L467-509): Identifies character set prefixes for optimization
- `_simple(p)` (L398-405): Determines if a subpattern is "simple" (single unit operation)
- `_generate_overlap_table(prefix)` (L407-426): Creates KMP-style overlap table for literal prefix matching

### Flag and Case Handling
- `_combine_flags(flags, add_flags, del_flags)` (L31-35): Manages regex flag combinations across subpatterns
- `_get_iscased(flags)` (L428-434): Returns appropriate case-checking function based on flags

### Development/Debug Tools
- `dis(code)` (L591-737): Disassembler for debugging compiled regex bytecode
- `_hex_code(code)` (L588-589): Formats bytecode as hexadecimal strings
- `isstring(obj)` (L570-571): Type checking utility

## Key Data Structures

### Constants and Mappings (L20-29)
- `_LITERAL_CODES`: Literal character matching operations
- `_REPEATING_CODES`: Maps repeat types to their bytecode sequences
- `_UNIT_CODES`: Single-unit matching operations
- `_SUCCESS_CODES`, `_ASSERT_CODES`: Operation type groups

### Global Configuration (L383-385)
- `_CODEBITS`: Bits per code unit from _sre module
- `MAXCODE`: Maximum code value
- `_BITS_TRANS`: Translation table for bitmap generation

## Architecture Notes

The compiler uses a two-phase approach:
1. **Info Block Generation**: Creates optimization metadata including pattern bounds and fast-match prefixes
2. **Bytecode Generation**: Recursive compilation of pattern AST to linear bytecode

Character set optimization uses multiple strategies:
- Small sets: Literal/range representation
- Medium sets: 256-bit bitmaps
- Large Unicode sets: Chunked bitmaps with deduplication

Case-insensitive matching supports ASCII, Unicode, and locale-specific modes with appropriate character transformation functions.

## Dependencies
- `_sre`: C extension providing core regex engine and constants
- `_parser`: Pattern parsing module  
- `_constants`: Regex operation constants
- `_casefix`: Unicode case folding tables