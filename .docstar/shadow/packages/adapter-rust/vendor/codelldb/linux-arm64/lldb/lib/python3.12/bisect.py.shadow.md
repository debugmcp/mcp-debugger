# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/bisect.py
@source-hash: f1cf7b85fc36b5da
@generated: 2026-02-09T18:08:31Z

## Primary Purpose
This is Python's standard library bisect module, implementing bisection algorithms for maintaining sorted sequences. It provides binary search functionality to find insertion points and insert elements while preserving sort order.

## Core Functions

**bisect_right(a, x, lo=0, hi=None, *, key=None) (L21-54)**
- Returns insertion index for item x in sorted list a (rightmost position for duplicates)
- Binary search implementation using `x < a[mid]` comparison
- Validates lo ≥ 0, defaults hi to len(a)
- Supports custom key function for sort order customization
- Time complexity: O(log n)

**bisect_left(a, x, lo=0, hi=None, *, key=None) (L74-107)**
- Returns insertion index for item x in sorted list a (leftmost position for duplicates)
- Binary search using `a[mid] < x` comparison (opposite of bisect_right)
- Same validation and key function support as bisect_right
- Time complexity: O(log n)

**insort_right(a, x, lo=0, hi=None, *, key=None) (L4-18)**
- Inserts item x into sorted list a at rightmost position for duplicates
- Combines bisect_right() search with list.insert()
- Modifies list in-place

**insort_left(a, x, lo=0, hi=None, *, key=None) (L57-72)**
- Inserts item x into sorted list a at leftmost position for duplicates
- Combines bisect_left() search with list.insert()
- Modifies list in-place

## Key Implementation Details

**Binary Search Logic**
- Uses floor division `(lo + hi) // 2` for midpoint calculation
- Maintains loop invariant: `lo <= target_index <= hi`
- Different comparison directions distinguish left vs right variants

**C Implementation Override (L111-114)**
- Attempts to import optimized C implementations from `_bisect`
- Falls back to pure Python if C extension unavailable
- Performance critical for large datasets

**Aliases (L116-118)**
- `bisect = bisect_right`: Default bisect behavior
- `insort = insort_right`: Default insert behavior

## Dependencies
- No external dependencies
- Optional C extension `_bisect` for performance
- Uses built-in `len()`, list methods

## Critical Invariants
- Input list must be sorted (not validated)
- `lo` parameter must be non-negative
- Key function must be consistent across calls
- Maintains sorted order after insertions