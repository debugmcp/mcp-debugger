# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/fnmatch.py
@source-hash: 6683da36e47af523
@generated: 2026-02-09T18:07:06Z

## Primary Purpose
Python standard library module for filename matching using Unix shell-style patterns. Provides efficient pattern matching with regex compilation and caching for performance.

## Key Functions

### Core Matching Functions
- **`fnmatch(name, pat)`** (L19-36): Main entry point for filename matching. Normalizes case based on OS requirements before delegating to `fnmatchcase()`. Uses `os.path.normcase()` for platform-appropriate case handling.

- **`fnmatchcase(name, pat)`** (L64-71): Case-sensitive pattern matching. Compiles pattern to regex using cached `_compile_pattern()` and tests match.

- **`filter(names, pat)`** (L48-62): Filters iterable of names against pattern. Optimizes for POSIX systems by avoiding redundant `normcase()` calls in the loop (L53-57).

### Pattern Compilation
- **`_compile_pattern(pat)`** (L38-46): LRU-cached pattern compiler with 32K entry limit. Handles both string and bytes patterns, converting bytes via ISO-8859-1 encoding. Returns compiled regex match function.

- **`translate(pat)`** (L74-185): Complex pattern-to-regex translator supporting shell wildcards:
  - `*` → `.*` (with consecutive compression L87-90)
  - `?` → `.`
  - `[seq]` → character class with range handling (L93-145)
  - `[!seq]` → negated character class

## Pattern Translation Details

### Character Class Processing (L93-145)
Sophisticated bracket expression handling including:
- Range validation and merging (L123-126)
- Backslash and hyphen escaping (L129-130)
- Set operation escaping (L132)
- Empty/negated range handling (L134-145)

### Star Optimization (L150-183)
Two-phase processing:
1. Initial parsing with STAR sentinel objects (L80-148)
2. STAR consolidation using atomic groups `(?>.*?fixed)` for non-backtracking matches (L166-183)

## Dependencies
- `os`: Platform-specific path normalization
- `posixpath`: POSIX path optimization detection
- `re`: Regular expression compilation
- `functools`: LRU cache decorator

## Performance Features
- Regex compilation caching (32K entries)
- POSIX-specific optimization to skip normcase in loops
- Consecutive star compression
- Atomic grouping for efficient backtracking prevention

## Shell Pattern Support
Standard Unix shell wildcards: `*` (any string), `?` (single char), `[seq]` (character class), `[!seq]` (negated class). No escape mechanism for meta-characters.