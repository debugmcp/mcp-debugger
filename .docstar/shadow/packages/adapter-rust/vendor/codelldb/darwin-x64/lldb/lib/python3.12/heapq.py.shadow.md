# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/heapq.py
@source-hash: 6d43277e5c76fc0f
@generated: 2026-02-09T18:07:46Z

## Python heapq Module - Priority Queue Implementation

**Primary Purpose**: Implements min-heap data structure using 0-based indexing with heap invariant `a[k] <= a[2*k+1] and a[k] <= a[2*k+2]`. Provides priority queue operations and utility functions for finding n smallest/largest elements.

**Core Public API**:
- `heappush(heap, item)` (L132-135): Pushes item onto heap while maintaining heap invariant
- `heappop(heap)` (L137-145): Pops and returns smallest item from heap
- `heapreplace(heap, item)` (L147-161): Atomic pop-smallest + push-new operation
- `heappushpop(heap, item)` (L163-168): Atomic push + pop-smallest operation
- `heapify(x)` (L170-179): Transforms list into heap in O(n) time using bottom-up approach
- `merge(*iterables, key=None, reverse=False)` (L316-394): Merges multiple sorted iterables using heap
- `nsmallest(n, iterable, key=None)` (L463-521): Finds n smallest elements with optimizations
- `nlargest(n, iterable, key=None)` (L523-579): Finds n largest elements with optimizations

**Internal Heap Operations**:
- `_siftdown(heap, startpos, pos)` (L207-219): Bubbles element up toward root until heap invariant satisfied
- `_siftup(heap, pos)` (L260-278): Bubbles smaller child up until leaf, then calls `_siftdown`
- `_siftdown_max(heap, startpos, pos)` (L280-293): Max-heap variant of `_siftdown`
- `_siftup_max(heap, pos)` (L295-314): Max-heap variant of `_siftup`

**Max-Heap Support** (for internal use):
- `_heappop_max(heap)` (L181-189): Max-heap version of `heappop`
- `_heapreplace_max(heap, item)` (L191-196): Max-heap version of `heapreplace`
- `_heapify_max(x)` (L198-202): Transforms list into max-heap

**Key Architectural Decisions**:
- Uses 0-based indexing for Python compatibility (parent at `(i-1)//2`, children at `2*i+1` and `2*i+2`)
- Min-heap by default (smallest element at index 0)
- Separates sift-up and sift-down operations for algorithmic efficiency
- Provides both min-heap and max-heap variants for internal flexibility

**Performance Optimizations**:
- `nsmallest/nlargest` use different strategies based on input size: `min()/max()` for n=1, `sorted()` for n>=size, heap-based for intermediate cases
- `merge()` handles key functions and reverse ordering efficiently
- C implementation fallback attempted (L582-597) for performance-critical operations

**Dependencies**: 
- Attempts to import C implementation from `_heapq` module for performance
- Uses `doctest` for self-testing when run as main module (L600-603)

**Critical Invariants**:
- Heap property: `a[k] <= a[2*k+1] and a[2*k+2]` for all valid k
- All operations maintain heap invariant
- Empty heap raises `IndexError` on pop operations