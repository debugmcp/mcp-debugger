# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/fnmatch.py
@source-hash: 6683da36e47af523
@generated: 2026-02-09T18:12:53Z

## Primary Purpose
This is a Python implementation of Unix shell-style filename pattern matching (fnmatch), providing glob-like functionality for filtering files and directories. The module translates shell patterns into regular expressions with caching for performance optimization.

## Core Functions

**fnmatch(name, pat) (L19-36)**: Main entry point that normalizes case based on OS conventions before delegating to fnmatchcase. Uses `os.path.normcase` to handle platform-specific case sensitivity (case-insensitive on Windows, case-sensitive on Unix).

**fnmatchcase(name, pat) (L64-71)**: Case-sensitive pattern matching that compiles the pattern using cached `_compile_pattern` and tests for matches using the compiled regex matcher.

**filter(names, pat) (L48-62)**: Efficiently filters an iterable of names against a pattern. Optimized for POSIX systems by avoiding redundant `normcase` calls in the loop when `os.path is posixpath`.

**translate(pat) (L74-185)**: Core pattern-to-regex translator supporting:
- `*` → `.*` (matches everything, with consecutive stars compressed)
- `?` → `.` (matches single character) 
- `[seq]` → character classes with complex range handling
- `[!seq]` → negated character classes

## Key Implementation Details

**_compile_pattern(pat) (L38-46)**: LRU cached function (maxsize=32768) that handles both string and bytes patterns. Converts bytes to ISO-8859-1 encoding for processing, then back to bytes for the compiled regex.

**Pattern Translation Architecture**: Uses a two-phase approach:
1. **Phase 1 (L80-148)**: Converts shell metacharacters to intermediate representation using STAR sentinel object
2. **Phase 2 (L150-185)**: Processes STAR objects into optimized regex patterns with atomic groups `(?>.*?fixed)` to prevent backtracking

## Shell Pattern Support
- `*`: Matches any sequence of characters
- `?`: Matches any single character  
- `[seq]`: Matches any character in sequence
- `[!seq]`: Matches any character NOT in sequence
- Handles escaped characters and complex character ranges with hyphen processing

## Dependencies
- `os`: For platform-specific case normalization
- `posixpath`: For POSIX path optimization detection
- `re`: For regex compilation and escaping
- `functools`: For LRU cache decorator

## Performance Optimizations
- Regex compilation caching with 32K entry LRU cache
- Consecutive star compression to avoid redundant `.*` patterns
- Platform-specific loop optimization in filter()
- Atomic groups in generated regex to prevent backtracking

## Notable Patterns
- Returns compiled matcher function rather than compiled regex object for direct invocation
- Uses sentinel object (STAR) for intermediate representation
- Handles both string and bytes input with encoding conversion
- Final regex includes `(?s:...)\\Z` wrapper for proper anchoring and DOTALL mode