# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/bisect.py
@source-hash: f1cf7b85fc36b5da
@generated: 2026-02-09T18:09:23Z

**Purpose:** Standard Python bisect module providing binary search algorithms for maintaining sorted sequences. Part of Python's standard library bundled with LLDB's Python distribution.

**Core Functions:**

- `bisect_right(a, x, lo=0, hi=None, *, key=None)` (L21-54): Binary search returning insertion index for rightmost position. Uses "less than" comparisons consistent with list.sort() and heapq. Validates lo >= 0 and defaults hi to len(a).

- `bisect_left(a, x, lo=0, hi=None, *, key=None)` (L74-107): Binary search returning insertion index for leftmost position. Similar logic to bisect_right but with inverted comparison logic (a[mid] < x vs x < a[mid]).

- `insort_right(a, x, lo=0, hi=None, *, key=None)` (L4-18): Insert element x into sorted list a at rightmost valid position. Delegates to bisect_right for index calculation then inserts in-place.

- `insort_left(a, x, lo=0, hi=None, *, key=None)` (L57-72): Insert element x into sorted list a at leftmost valid position. Delegates to bisect_left for index calculation then inserts in-place.

**Key Implementation Details:**

- All functions support optional key function parameter for custom sort ordering
- Binary search uses integer division `(lo + hi) // 2` for midpoint calculation  
- Bounds checking ensures lo is non-negative
- C optimization fallback pattern (L111-114): attempts to import faster C implementations from `_bisect` module, gracefully falls back to Python implementations on ImportError

**Aliases:**
- `bisect` → `bisect_right` (L117)
- `insort` → `insort_right` (L118)

**Architectural Pattern:** Classic Python standard library structure with pure Python reference implementation and optional C extension speedup. Maintains API compatibility while providing performance optimization when available.