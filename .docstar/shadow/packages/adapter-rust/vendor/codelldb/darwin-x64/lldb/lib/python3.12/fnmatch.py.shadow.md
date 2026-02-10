# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/fnmatch.py
@source-hash: 6683da36e47af523
@generated: 2026-02-09T18:08:15Z

## Purpose and Responsibility
Unix shell-style filename pattern matching module providing glob-like functionality. Translates shell patterns into compiled regular expressions with caching for performance optimization.

## Key Functions

### Core Matching Functions
- `fnmatch(name, pat)` (L19-36): Main entry point for case-aware filename matching using OS-specific case normalization
- `fnmatchcase(name, pat)` (L64-71): Case-sensitive variant that bypasses OS normalization
- `filter(names, pat)` (L48-62): Filters iterable of names against pattern, with POSIX optimization path

### Pattern Translation
- `translate(pat)` (L74-185): Core algorithm converting shell patterns to regex strings
  - Handles `*` (any chars), `?` (single char), `[seq]` (character classes), `[!seq]` (negated classes)
  - Complex bracket expression parsing (L93-145) with range handling and escaping
  - Two-phase processing: initial pattern parsing, then STAR consolidation (L150-185)
  - Uses atomic groups `(?>...)` for non-backtracking wildcard matching

### Caching Layer  
- `_compile_pattern(pat)` (L38-46): LRU-cached pattern compiler with 32K cache size
  - Handles both string and bytes patterns via ISO-8859-1 encoding
  - Returns compiled regex match function

## Dependencies
- `os`: Platform-specific path operations and case normalization
- `posixpath`: POSIX path handling for optimization detection
- `re`: Regular expression compilation and operations
- `functools`: LRU caching decorator

## Architecture Patterns
- **Caching Strategy**: Aggressive LRU caching of compiled patterns for repeated use
- **Platform Optimization**: Special case handling for POSIX systems where normcase is no-op
- **Two-Phase Translation**: Initial shell-to-regex conversion, followed by wildcard optimization
- **Atomic Regex Groups**: Uses possessive quantifiers to prevent catastrophic backtracking

## Critical Invariants
- All shell patterns are anchored with `\Z` to match entire strings
- DOTALL mode `(?s:...)` enabled for multiline string matching
- Character class ranges validated and empty ranges converted to negative lookahead `(?!)`
- Consecutive wildcards compressed into single `*` during parsing