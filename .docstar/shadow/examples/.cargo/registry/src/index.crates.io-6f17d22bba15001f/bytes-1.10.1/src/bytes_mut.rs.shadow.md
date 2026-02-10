# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/bytes_mut.rs
@source-hash: 0498dcaf2b39c0cc
@generated: 2026-02-09T18:11:42Z

## BytesMut - Mutable Buffer Implementation

**Primary Purpose**: Implements `BytesMut`, a unique reference to a contiguous slice of memory that provides efficient buffer operations with zero-copy semantics where possible.

### Core Structure
- **BytesMut** (L61-66): Main struct containing `ptr` (memory location), `len` (current length), `cap` (capacity), and `data` (metadata pointer)
- **Shared** (L77-81): Thread-safe reference-counted container with `vec`, `original_capacity_repr`, and `ref_count`

### Storage Strategy
Uses dual representation strategy via bit flags in `data` pointer:
- **KIND_VEC** (L91): Direct Vec<u8> storage for single ownership
- **KIND_ARC** (L90): Shared storage with reference counting
- Bit manipulation for encoding metadata in pointer LSBs (L87, L102-111)

### Key Construction Methods
- **with_capacity()** (L148): Creates BytesMut with specified capacity
- **new()** (L172): Creates empty BytesMut with zero capacity
- **zeroed()** (L287): Creates BytesMut filled with zeros
- **from_vec()** (L924): Internal constructor from Vec<u8>

### Memory Operations
- **split_off()** (L320): O(1) split at index, returns tail portion
- **split_to()** (L395): O(1) split at index, returns head portion  
- **split()** (L363): O(1) split returning all current content
- **freeze()** (L246): Convert to immutable Bytes (zero-copy when possible)

### Capacity Management
- **reserve()** (L592): Ensures additional capacity, may reclaim or allocate
- **try_reclaim()** (L833): Attempts non-allocating capacity reclaim
- **reserve_inner()** (L608): Core reservation logic with optimization for Vec reuse

### Buffer Modification
- **extend_from_slice()** (L863): Append byte slice, growing as needed
- **resize()** (L479): Resize buffer with fill value
- **truncate()** (L434): Shrink to specified length
- **clear()** (L452): Reset length to zero

### Advanced Operations  
- **unsplit()** (L904): O(1) merge with previously split BytesMut when contiguous
- **advance_unchecked()** (L956): Internal pointer advancement without bounds checking
- **shallow_clone()** (L1058): Creates clone sharing underlying storage

### Reference Counting (Shared Storage)
- **increment_shared()** (L1425): Atomic reference count increment
- **release_shared()** (L1433): Atomic decrement with cleanup
- **Shared::is_unique()** (L1466): Check for exclusive ownership

### Trait Implementations
- **Buf** (L1140): Read operations - `remaining()`, `chunk()`, `advance()` 
- **BufMut** (L1171): Write operations - specialized `put_*` methods bypass default bounds checking
- Standard traits: Clone, Deref, AsRef, Extend, FromIterator, PartialEq with various types

### Memory Layout Optimizations
- Encodes Vec position offset in unused pointer bits for 32/64-bit systems
- Original capacity tracking for growth heuristics (L482-496)
- Amortized reallocation strategy considering data movement costs (L637)

### Critical Invariants
- `Shared` alignment must be divisible by 2 for LSB flag encoding (L87)
- Vec position limited by available pointer bits (L110, MAX_VEC_POS)
- Reference counting prevents use-after-free in concurrent scenarios
- Capacity and length relationships maintained across all operations

### Dependencies
- Uses atomic operations from `crate::loom` for concurrency
- Integrates with `Bytes` type via shared vtable (L1777-1854)
- Relies on `Buf`/`BufMut` traits for standardized buffer interface