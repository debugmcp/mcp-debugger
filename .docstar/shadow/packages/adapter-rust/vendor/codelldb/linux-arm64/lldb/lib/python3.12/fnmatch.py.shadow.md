# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/fnmatch.py
@source-hash: 6683da36e47af523
@generated: 2026-02-09T18:08:41Z

## Purpose
Shell-style filename pattern matching module for Python. Converts shell glob patterns to regex and provides cached pattern matching with OS-specific case handling.

## Core Functions

**`fnmatch(name, pat)` (L19-36)**: Main entry point for OS-aware filename matching. Normalizes case using `os.path.normcase()` for both filename and pattern, then delegates to `fnmatchcase()`.

**`fnmatchcase(name, pat)` (L64-71)**: Case-sensitive pattern matching. Uses cached compiled patterns from `_compile_pattern()` and returns boolean result.

**`filter(names, pat)` (L48-62)**: Filters an iterable of names against a pattern. Optimizes for POSIX systems by skipping redundant case normalization in the loop when `os.path is posixpath`.

**`translate(pat)` (L74-185)**: Core pattern translator converting shell patterns to regex. Handles:
- `*` → `.*` (with compression of consecutive stars)
- `?` → `.`
- `[seq]` and `[!seq]` → character classes with complex range handling
- Escapes literal characters

## Key Implementation Details

**`_compile_pattern(pat)` (L38-46)**: LRU cached regex compiler with 32768 entry limit. Handles both string and bytes patterns, using ISO-8859-1 encoding for bytes conversion.

**Pattern Translation Algorithm (L74-185)**:
- Two-pass approach: first converts shell patterns to intermediate representation using STAR sentinel objects
- Second pass (L150-185) optimizes STAR handling using atomic groups `(?>.*?{fixed})` for non-backtracking matches
- Complex character class handling (L93-145) with range validation, escape processing, and set operation escaping

## Dependencies
- `os`: Case normalization via `os.path.normcase`
- `posixpath`: POSIX path optimization detection
- `re`: Regex compilation and matching
- `functools`: LRU cache decorator

## Architecture Notes
- Uses sentinel object pattern (STAR) for intermediate representation
- Atomic regex groups prevent pathological backtracking
- Caching strategy balances memory usage (32K entries) with performance
- Supports undocumented feature of joining multiple `translate()` results with `|` for complex patterns

## Shell Pattern Support
- `*`: matches any sequence of characters
- `?`: matches single character  
- `[seq]`: character class matching
- `[!seq]`: negated character class
- No escaping mechanism for meta-characters (documented limitation L77)