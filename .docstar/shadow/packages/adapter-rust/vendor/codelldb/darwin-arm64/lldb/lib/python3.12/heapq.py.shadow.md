# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/heapq.py
@source-hash: 6d43277e5c76fc0f
@generated: 2026-02-09T18:07:08Z

## Primary Purpose

Python's heapq module implementation providing a min-heap priority queue algorithm. Implements binary heap data structure using 0-based indexing with heap invariant: `a[k] <= a[2*k+1]` and `a[k] <= a[2*k+2]` for all k. Module serves as fallback pure Python implementation when C extension `_heapq` is unavailable.

## Core Public API

**Basic heap operations:**
- `heappush(heap, item)` (L132-135): Adds item to heap while maintaining heap invariant
- `heappop(heap)` (L137-145): Removes and returns smallest item from heap
- `heapreplace(heap, item)` (L147-161): Atomic pop-smallest + push-new operation
- `heappushpop(heap, item)` (L163-168): Optimized push-then-pop operation
- `heapify(x)` (L170-179): Transforms list into heap in-place, O(n) time

**Advanced operations:**
- `merge(*iterables, key=None, reverse=False)` (L316-395): Merges multiple sorted iterables into single sorted output using heap
- `nsmallest(n, iterable, key=None)` (L463-521): Finds n smallest elements efficiently
- `nlargest(n, iterable, key=None)` (L523-579): Finds n largest elements efficiently

## Internal Helper Functions

**Min-heap sift operations:**
- `_siftdown(heap, startpos, pos)` (L207-219): Moves element up toward root until heap invariant satisfied
- `_siftup(heap, pos)` (L260-278): Moves element down toward leaves, then calls _siftdown

**Max-heap variants (for internal use):**
- `_heappop_max(heap)` (L181-189): Max-heap version of heappop
- `_heapreplace_max(heap, item)` (L191-196): Max-heap version of heapreplace  
- `_heapify_max(x)` (L198-202): Transform to max-heap
- `_siftdown_max(heap, startpos, pos)` (L280-293): Max-heap sift down
- `_siftup_max(heap, pos)` (L295-314): Max-heap sift up

## Key Design Decisions

**Performance optimizations:**
- Uses 0-based indexing for better Python integration
- Implements "bubble down to leaf, then sift up" strategy in _siftup to reduce comparisons
- Provides specialized fast paths in nlargest/nsmallest (single element uses min/max, large n uses sorted)
- Caches method references in merge() for performance

**Fallback architecture:**
- Pure Python implementation with optional C extension imports (L582-597)
- Graceful degradation when C modules unavailable

## Critical Invariants

- Heap property: parent ≤ children for all nodes
- heappop() returns smallest element (min-heap behavior)
- All operations maintain heap invariant
- Empty heap operations raise IndexError appropriately

## Dependencies

- Uses built-in functions: `iter()`, `min()`, `max()`, `sorted()`
- Optional C extension `_heapq` for performance
- Module designed to be self-contained fallback implementation