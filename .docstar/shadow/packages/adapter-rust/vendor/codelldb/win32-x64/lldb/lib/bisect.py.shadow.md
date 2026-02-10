# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/bisect.py
@source-hash: f1cf7b85fc36b5da
@generated: 2026-02-09T18:12:45Z

## Primary Purpose
Pure Python implementation of bisection algorithms for maintaining sorted lists and finding insertion points. Provides fallback functionality when C implementation is unavailable.

## Key Functions

### Core Bisection Functions
- **`bisect_right(a, x, lo=0, hi=None, *, key=None)` (L21-54)**: Returns rightmost insertion index for item `x` in sorted list `a`. Binary search algorithm with optional key function and bounds.
- **`bisect_left(a, x, lo=0, hi=None, *, key=None)` (L74-107)**: Returns leftmost insertion index for item `x` in sorted list `a`. Similar to `bisect_right` but inserts before existing equal elements.

### Insertion Functions
- **`insort_right(a, x, lo=0, hi=None, *, key=None)` (L4-18)**: Inserts item `x` into sorted list `a` at rightmost position, maintaining sort order.
- **`insort_left(a, x, lo=0, hi=None, *, key=None)` (L57-72)**: Inserts item `x` into sorted list `a` at leftmost position, maintaining sort order.

### Aliases
- **`bisect` (L117)**: Alias for `bisect_right`
- **`insort` (L118)**: Alias for `insort_right`

## Implementation Details

### Algorithm Pattern
Both bisection functions use identical binary search pattern:
1. Validate `lo >= 0`
2. Default `hi` to `len(a)` if None
3. Binary search loop with midpoint calculation: `mid = (lo + hi) // 2`
4. Conditional bounds adjustment based on comparison result

### Key Function Support
All functions support optional `key` parameter for custom sort ordering, with separate code paths for performance (L40-53, L93-106).

### C Extension Fallback
Module attempts to import optimized C implementations via `from _bisect import *` (L111-114), falling back to pure Python if unavailable.

## Dependencies
- No external dependencies
- Optional C extension `_bisect` for performance optimization

## Critical Constraints
- Input list `a` must be pre-sorted
- Parameter `lo` must be non-negative (validated with ValueError)
- Uses `<` comparison operator exclusively for consistency with Python's sort implementations