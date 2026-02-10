# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/heapq.py
@source-hash: 6d43277e5c76fc0f
@generated: 2026-02-09T18:08:47Z

## Purpose & Scope

Python's standard heap queue (priority queue) module implementing a min-heap data structure. Provides efficient priority queue operations with O(log n) insertion/deletion and O(n) heapification. Uses 0-based indexing where `a[k] <= a[2*k+1]` and `a[k] <= a[2*k+2]` maintains heap invariant.

## Core API Functions

**Primary heap operations:**
- `heappush(heap, item)` (L132-135): Adds item to heap, maintains invariant via `_siftdown`
- `heappop(heap)` (L137-145): Removes and returns smallest item, uses `_siftup` to restore heap
- `heapify(x)` (L170-179): In-place O(n) transformation of list to heap via bottom-up approach
- `heapreplace(heap, item)` (L147-161): Atomic pop+push operation, more efficient than separate calls
- `heappushpop(heap, item)` (L163-168): Fast push+pop combination with early return optimization

**Utility functions:**
- `nsmallest(n, iterable, key=None)` (L463-521): Finds n smallest elements using max-heap optimization
- `nlargest(n, iterable, key=None)` (L523-579): Finds n largest elements using min-heap optimization  
- `merge(*iterables, key=None, reverse=False)` (L316-395): Memory-efficient merge of sorted iterables

## Internal Implementation

**Core sifting algorithms:**
- `_siftdown(heap, startpos, pos)` (L207-219): Bubbles element up toward root until heap property restored
- `_siftup(heap, pos)` (L260-278): Bubbles smaller children up, then calls `_siftdown` for final placement

**Max-heap variants (private):**
- `_heappop_max`, `_heapreplace_max`, `_heapify_max` (L181-202): Mirror operations for max-heap behavior
- `_siftdown_max`, `_siftup_max` (L280-314): Max-heap sifting implementations

## Key Design Patterns

**Performance optimizations:**
- Early termination in `heappushpop` when new item larger than heap top
- Specialized fast paths in `nsmallest`/`nlargest` for n=1 and n≥size cases
- Avoids unnecessary comparisons per Knuth's analysis (L226-258 comments)
- C implementation fallback imports (L582-597)

**Memory efficiency:**
- `merge()` uses generator pattern, doesn't load full dataset
- Heap operations modify lists in-place
- Uses tuple decoration pattern for key-based comparisons

## Dependencies & Integration

- Imports C implementation `_heapq` module when available for performance
- Falls back to pure Python implementation gracefully
- No external dependencies beyond standard library
- Doctest integration for CLI testing (L600-603)

## Critical Constraints

- Heap invariant: parent ≤ children for all nodes
- Empty heap operations raise `IndexError` 
- `heapreplace` may return value larger than input item (documented caveat L152-156)
- `merge()` assumes input iterables are pre-sorted