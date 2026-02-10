# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/bisect.py
@source-hash: f1cf7b85fc36b5da
@generated: 2026-02-09T18:07:00Z

## Python Bisection Algorithm Module

**Purpose:** Provides binary search algorithms for maintaining sorted lists through efficient insertion and search operations.

### Core Functions

**`bisect_right(a, x, lo=0, hi=None, *, key=None)` (L21-54)**
- Returns insertion index for item `x` in sorted list `a` to maintain sort order
- Inserts to the right of existing equal elements
- Binary search implementation with O(log n) complexity
- Returns index `i` where `a[:i] <= x < a[i:]`
- Supports custom key function for sorting criteria
- Validates `lo >= 0`, defaults `hi` to `len(a)`

**`bisect_left(a, x, lo=0, hi=None, *, key=None)` (L74-107)**
- Returns insertion index for item `x` in sorted list `a` to maintain sort order
- Inserts to the left of existing equal elements
- Returns index `i` where `a[:i] < x <= a[i:]`
- Nearly identical implementation to `bisect_right` with reversed comparison logic

**`insort_right(a, x, lo=0, hi=None, *, key=None)` (L4-18)**
- Inserts item `x` into sorted list `a` in-place
- Uses `bisect_right` to find insertion point, then calls `a.insert()`
- Maintains sorted order with rightmost insertion for duplicates

**`insort_left(a, x, lo=0, hi=None, *, key=None)` (L57-72)**
- Inserts item `x` into sorted list `a` in-place
- Uses `bisect_left` to find insertion point, then calls `a.insert()`
- Maintains sorted order with leftmost insertion for duplicates

### Key Implementation Details

- **Algorithm:** Classic binary search with midpoint calculation `(lo + hi) // 2`
- **Comparison Logic:** Uses `<` operator to match Python's `list.sort()` and `heapq` behavior (L38-39, L91-92)
- **Key Function Support:** Both direct comparison and key-transformed comparison paths
- **Bounds Handling:** Optional `lo`/`hi` parameters for searching list slices

### Module Optimization Strategy

**C Implementation Override (L110-114)**
- Attempts to import optimized C implementation from `_bisect` module
- Falls back gracefully to pure Python implementation on import failure
- Uses wildcard import to replace all function definitions

### Aliases (L116-118)
- `bisect = bisect_right`: Default bisection behavior
- `insort = insort_right`: Default insertion behavior

### Dependencies
- Standard library only
- Optional `_bisect` C extension for performance
- No external dependencies

This module is part of the LLDB Python environment for CodeLLDB debugging adapter, providing essential algorithms for maintaining sorted data structures during debugging operations.