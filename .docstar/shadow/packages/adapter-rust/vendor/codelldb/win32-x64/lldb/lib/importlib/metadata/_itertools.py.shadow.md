# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/metadata/_itertools.py
@source-hash: 72faffdaff0145bc
@generated: 2026-02-09T18:06:07Z

**Purpose**: Utility module providing iterator manipulation functions for metadata processing. Part of importlib.metadata package, containing helper functions for handling iterable data structures with deduplication and normalization capabilities.

**Key Functions**:

- `unique_everseen(iterable, key=None)` (L4-19): Generator that yields unique elements from an iterable while preserving order. Uses set-based deduplication with optional key function for custom uniqueness criteria. Optimized implementation caches `seen.add` method and uses `filterfalse` when no key function is provided.

- `always_iterable(obj, base_type=(str, bytes))` (L23-73): Normalizes input to always return an iterable. Handles None (returns empty iterator), non-iterable objects (wraps in single-item iterator), and respects base_type exclusions to prevent unwanted string iteration. Copied from more_itertools 8.8.

**Dependencies**:
- `itertools.filterfalse`: Used for efficient filtering in unique_everseen when no key function is specified

**Design Patterns**:
- Generator-based approach for memory efficiency in unique_everseen
- Duck typing with try/except in always_iterable for iterable detection
- Method caching optimization (`seen_add = seen.add`) to avoid repeated attribute lookups
- Special handling for common edge cases (None, strings, bytes)

**Key Behaviors**:
- unique_everseen preserves first occurrence order and remembers all seen elements
- always_iterable treats strings/bytes as non-iterable by default to prevent character iteration
- Both functions are designed for robustness with various input types