# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/fnmatch.py
@source-hash: 6683da36e47af523
@generated: 2026-02-09T18:09:39Z

**Purpose**: Standard Python library module implementing Unix shell-style pattern matching for filenames using wildcards (*,?,[seq]). Converts shell patterns to regular expressions with caching for performance.

**Core API Functions**:
- `fnmatch(name, pat)` (L19-36): Case-insensitive pattern matching using OS normalization. Delegates to fnmatchcase after normalizing inputs.
- `fnmatchcase(name, pat)` (L64-71): Case-sensitive pattern matching. Uses cached compiled pattern from _compile_pattern.
- `filter(names, pat)` (L48-62): Filters iterable of names against pattern. Optimizes for POSIX systems by avoiding redundant normcase calls.
- `translate(pat)` (L74-185): Core pattern-to-regex translator. Complex two-phase algorithm handling bracket expressions and star optimization.

**Internal Components**:
- `_compile_pattern(pat)` (L38-46): LRU cached (32768 entries) pattern compiler. Handles both string and bytes patterns with ISO-8859-1 encoding for bytes.

**Pattern Translation Logic (L74-185)**:
- Phase 1 (L84-148): Character-by-character parsing with special handling:
  - `*` → STAR sentinel object with consecutive compression (L87-90)
  - `?` → `.` regex (L91-92) 
  - `[seq]` → Complex bracket expression processing (L93-145) with range validation, negation handling, and escape processing
  - Other chars → escaped literals (L147)
- Phase 2 (L150-184): STAR processing using atomic groups `(?>.*?{fixed})` for non-backtracking matches

**Dependencies**: os, posixpath, re, functools

**Key Patterns**:
- Performance optimization with LRU caching and POSIX-specific shortcuts
- Two-phase translation separating character parsing from star handling
- Atomic regex groups for predictable matching behavior
- Careful handling of edge cases in bracket expressions (empty ranges, negation, escaping)

**Critical Invariants**:
- All patterns end with `\Z` anchor for full string matching
- DOTALL mode `(?s:...)` applied to handle multiline strings
- Bracket expressions validate range ordering and handle empty/negated cases
- Star compression prevents redundant `.*.*` patterns