# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/util.py
@source-hash: fdcc640c3505d16d
@generated: 2026-02-09T18:12:18Z

## Purpose
Utility module for unittest framework providing string representation helpers and collection comparison functions. Part of LLDB's unittest infrastructure for debugging/testing purposes.

## Key Constants (L8-16)
String truncation configuration:
- `_MAX_LENGTH = 80`: Maximum display length for representations
- `_PLACEHOLDER_LEN = 12`: Length of truncation placeholder "[N chars]"
- Minimum length constraints for prefix/suffix preservation during truncation
- `_MIN_DIFF_LEN`: Calculated minimum length for differing portions

## Core Functions

### String Representation (L18-56)
- `_shorten(s, prefixlen, suffixlen)` (L18-22): Truncates strings with placeholder notation
- `_common_shorten_repr(*args)` (L24-43): Intelligently shortens multiple string representations by finding common prefixes and applying strategic truncation
- `safe_repr(obj, short=False)` (L45-52): Safe object representation with exception handling and optional truncation
- `strclass(cls)` (L54-55): Returns fully qualified class name as "module.qualname"

### Collection Comparison (L57-113)
- `sorted_list_difference(expected, actual)` (L57-95): Finds missing and unexpected elements between two sorted lists, handling duplicates
- `unorderable_list_difference(expected, actual)` (L98-113): Same functionality for unorderable items (O(n²) performance)

### Utility Functions
- `three_way_cmp(x, y)` (L115-117): Python 2/3 compatible three-way comparison
- `_Mismatch` namedtuple (L119): Container for count difference results

### Count Difference Analysis (L121-170)
- `_count_diff_all_purpose(actual, expected)` (L121-154): Compares element counts between collections using NULL marker technique for non-hashable items
- `_count_diff_hashable(actual, expected)` (L156-170): Optimized count comparison using Counter for hashable elements

## Architecture Notes
- Uses `__unittest = True` marker for unittest framework integration
- Implements two strategies for count comparison: general-purpose (NULL markers) vs optimized (Counter)
- String truncation preserves both ends with informative middle placeholders
- Handles edge cases like duplicate removal and exception safety in repr generation