# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/smallvec-1.15.1/src/lib.rs
@source-hash: 881e5b2c9afecd00
@generated: 2026-02-09T18:12:02Z

This is the main library file for `smallvec`, a container that stores elements inline up to a configurable size before spilling to the heap.

## Primary Purpose
Provides `SmallVec<A>`, a vector-like data structure that optimizes for cache locality by storing small collections inline within the struct itself, only allocating on the heap when capacity exceeds the inline storage.

## Core Types

### SmallVec<A> (L772-778)
The main container type with `capacity: usize` and `data: SmallVecData<A>`. Uses capacity field to distinguish between inline (≤ inline_capacity) and heap-allocated storage (> inline_capacity).

### SmallVecData<A> (L622-741)
Storage backend that uses either:
- **Union variant** (L622-671): Memory-efficient union with `inline: ManuallyDrop<MaybeUninit<A>>` or `heap: (NonNull<A::Item>, usize)`
- **Enum variant** (L674-741): Standard enum with `Inline(MaybeUninit<A>)` or `Heap { ptr: NonNull<A::Item>, len: usize }`

### Array trait (L2351-2356)
Unsafe trait defining the backing store interface with associated `Item` type and `size()` method.

## Key Methods

### Construction (L781-916)
- `new()` (L783): Creates empty vector with inline storage
- `with_capacity(n)` (L810): Pre-allocates if n exceeds inline capacity
- `from_vec(vec)` (L829): Efficient conversion from Vec, copies to inline if small enough
- `from_buf(buf)` (L870): Constructs from array without copying
- `from_slice(slice)` (L1743): Optimized for Copy types

### Core Operations (L1118-1535)
- `push(value)` (L1118): Grows to heap if inline capacity exceeded
- `pop()` (L1134): Returns last element or None
- `insert(index, element)` (L1368): Inserts with right-shift
- `remove(index)` (L1352): Removes with left-shift
- `drain(range)` (L1022): Returns draining iterator

### Memory Management (L1170-1294)
- `grow(new_cap)` (L1170): Explicit capacity expansion
- `reserve(additional)` (L1223): Reserves with power-of-2 growth
- `shrink_to_fit()` (L1278): Moves from heap back to inline if possible

## Iterators

### Drain<'a, T> (L351-427)
Iterator that removes elements from vector during iteration. Handles tail restoration on drop.

### DrainFilter<'a, T, F> (L435-558) [drain_filter feature]
Conditional removal iterator with predicate function. Includes panic-safe backshift logic.

### IntoIter<A> (L2233-2315)
Consuming iterator that owns the SmallVec data and yields elements by value.

## Feature-Gated Functionality

### Serde Support (L1918-1976)
Implements Serialize/Deserialize with custom visitor pattern for efficient deserialization.

### Write Trait (L1896-1915) [write feature]
Implements std::io::Write for SmallVec<[u8; _]> by delegating to extend_from_slice.

### Const Construction (L2394-2432) [const_new feature]
Provides const constructors new_const(), from_const(), from_const_with_len_unchecked().

## Critical Implementation Details

### Storage Detection (L975-1001)
`triple()` and `triple_mut()` methods return (ptr, len, capacity) tuples, with storage variant determined by comparing capacity to inline_capacity().

### Layout Management (L332-344)
Custom layout calculation with `layout_array<T>(n)` and unsafe deallocation in `deallocate()`.

### Zero-Size Type Handling (L930-946)
Special case for ZSTs: inline_capacity() returns usize::MAX to prevent heap allocation.

## Macros

### smallvec! (L184-203)
Convenience macro supporting both list syntax `smallvec![1, 2, 3]` and repeat syntax `smallvec![1; 3]`.

### smallvec_inline! (L237-247) [const_new feature]
Const-compatible version that creates inline storage matching argument count.

## Dependencies
- Core collections (Vec, Box) from alloc crate
- Optional: serde, std::io::Write, malloc_size_of, bincode
- Feature-conditional imports with cfg attributes