# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/heapq.py
@source-hash: 6d43277e5c76fc0f
@generated: 2026-02-09T18:09:43Z

## Purpose and Responsibility

Python's standard library heapq module implementing heap queue (priority queue) operations. Provides efficient algorithms for maintaining heap invariant `a[k] <= a[2*k+1]` and `a[k] <= a[2*k+2]` using 0-based indexing. Uses min-heap by default where `heap[0]` is always the smallest element.

## Key Public Functions

- `heappush(heap, item)` (L132-135): Adds item to heap maintaining invariant via `_siftdown`
- `heappop(heap)` (L137-145): Removes and returns smallest item, uses `_siftup` to restore invariant
- `heapreplace(heap, item)` (L147-161): More efficient pop+push combo for fixed-size heaps
- `heappushpop(heap, item)` (L163-168): Optimized push+pop operation
- `heapify(x)` (L170-179): Transforms list into heap in O(n) time using bottom-up approach
- `merge(*iterables, key=None, reverse=False)` (L316-394): Merges multiple sorted iterables efficiently using heap
- `nsmallest(n, iterable, key=None)` (L463-521): Finds n smallest elements with performance optimizations
- `nlargest(n, iterable, key=None)` (L523-579): Finds n largest elements with performance optimizations

## Core Internal Functions

- `_siftdown(heap, startpos, pos)` (L207-219): Moves item up tree until heap invariant satisfied
- `_siftup(heap, pos)` (L260-278): Bubbles smaller child up to maintain heap property
- `_siftdown_max(heap, startpos, pos)` (L280-293): Max-heap variant of siftdown
- `_siftup_max(heap, pos)` (L295-314): Max-heap variant of siftup

## Private Max-Heap Functions

- `_heappop_max(heap)` (L181-189): Max-heap version of heappop
- `_heapreplace_max(heap, item)` (L191-196): Max-heap version of heapreplace  
- `_heapify_max(x)` (L198-202): Transforms list into max-heap

## Architecture and Patterns

**Dual Implementation Strategy**: Falls back to C implementation via `from _heapq import *` (L582-597) for performance, with pure Python as backup.

**Algorithm Optimization**: Extensive performance analysis and benchmarking comments (L397-461) document complexity trade-offs and comparison counts.

**Key Function Optimization**: Both `nsmallest` and `nlargest` include multiple algorithm paths:
1. Short-circuit for n==1 using min()/max()
2. Use sorted() when n >= dataset size  
3. Efficient heap-based approach for intermediate cases

## Dependencies and Relationships

- Self-contained module with optional C extension fallback
- Uses iterator protocol extensively in `merge()` function
- Doctest integration for testing (L600-603)

## Critical Invariants

- Heap property: `a[k] <= a[2*k+1]` and `a[k] <= a[2*k+2]` 
- Parent-child indexing: parent at `(i-1)//2`, children at `2*i+1` and `2*i+2`
- Min-heap default behavior (smallest element at index 0)
- All operations maintain heap invariant through sift operations