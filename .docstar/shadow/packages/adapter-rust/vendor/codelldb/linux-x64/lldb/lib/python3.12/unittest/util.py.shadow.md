# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/unittest/util.py
@source-hash: fdcc640c3505d16d
@generated: 2026-02-09T18:06:10Z

## Purpose
Utility functions for the Python unittest framework, providing string representation formatting, list comparison operations, and element counting for test assertions and error reporting.

## Core Constants (L8-16)
- `_MAX_LENGTH = 80`: Maximum string length for display
- Shortening parameters for string truncation: `_PLACEHOLDER_LEN`, `_MIN_BEGIN_LEN`, `_MIN_END_LEN`, `_MIN_COMMON_LEN`
- `_MIN_DIFF_LEN`: Calculated minimum difference length with assertion validation

## String Formatting Functions
- `_shorten(s, prefixlen, suffixlen)` (L18-22): Truncates strings with "[N chars]" placeholder when content exceeds display limits
- `_common_shorten_repr(*args)` (L24-43): Intelligently shortens multiple string representations by finding common prefixes and applying targeted truncation
- `safe_repr(obj, short=False)` (L45-52): Safe object representation with fallback to `object.__repr__()` and optional truncation
- `strclass(cls)` (L54-55): Returns fully qualified class name as "module.qualname"

## List Comparison Functions
- `sorted_list_difference(expected, actual)` (L57-95): Efficiently compares two sorted lists, returning (missing, unexpected) tuple. Uses two-pointer technique with duplicate handling
- `unorderable_list_difference(expected, actual)` (L98-113): O(n²) comparison for unorderable items like dicts, modifies input lists destructively
- `three_way_cmp(x, y)` (L115-117): Returns -1/0/1 for less/equal/greater comparison

## Element Counting Functions
- `_Mismatch` namedtuple (L119): Data structure for count differences with fields (actual, expected, value)
- `_count_diff_all_purpose(actual, expected)` (L121-154): Counts element occurrences in both collections, handles non-hashable elements using NULL sentinel pattern
- `_count_diff_hashable(actual, expected)` (L156-170): Optimized Counter-based counting for hashable elements

## Dependencies
- `collections.namedtuple, Counter`: Core data structures
- `os.path.commonprefix`: String prefix detection

## Architecture Notes
- Dual implementation strategy for hashable vs non-hashable elements
- Destructive operations on input lists in `unorderable_list_difference`
- Sentinel object pattern (`NULL = object()`) for marking processed elements
- Conservative string truncation with configurable parameters