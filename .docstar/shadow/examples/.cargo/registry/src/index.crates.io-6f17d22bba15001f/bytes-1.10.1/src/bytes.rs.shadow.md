# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/bytes.rs
@source-hash: 1b3935281970640e
@generated: 2026-02-09T18:11:43Z

## Core Purpose
This file implements `Bytes`, a reference-counted, immutable, cheaply cloneable buffer for efficient zero-copy networking operations. The design uses dynamic dispatch via vtables to handle different backing storage types.

## Key Structures

### Bytes (L102-108)
The main type containing:
- `ptr`: Raw pointer to data start
- `len`: Buffer length
- `data`: Atomic pointer to shared state
- `vtable`: Function pointers for type-specific operations

### Vtable (L110-122)
Function pointer table defining operations:
- `clone`: Create new reference
- `to_vec`: Convert to owned Vec<u8>
- `to_mut`: Convert to BytesMut
- `is_unique`: Check if sole reference
- `drop`: Cleanup logic

## Storage Types & Vtables

### Static Storage (L1078-1107)
- **STATIC_VTABLE**: For `&'static [u8]` data
- No allocation/deallocation needed
- `is_unique` always returns false

### Owned Storage (L1111-1188)
- **OWNED_VTABLE**: For user-provided owners (via `from_owner`)
- Reference counted with `OwnedLifetime` struct
- Generic drop function for any owner type

### Shared Storage (L1357-1594)
- **SHARED_VTABLE**: For reference-counted heap data
- `Shared` struct (L1357-1362) tracks buffer + ref count
- Optimized unique-to-vec conversion

### Promotable Storage (L1190-1348)
- **PROMOTABLE_EVEN/ODD_VTABLE**: For `Box<[u8]>` that can upgrade to shared
- Uses pointer tagging (KIND_ARC=0, KIND_VEC=1) in low bit
- Even/odd variants handle pointer alignment differences

## Key Methods

### Construction
- `new()` (L139/148): Empty buffer using static storage
- `from_static()` (L168/179): Wraps static slice
- `from_owner()` (L251-290): Takes ownership of arbitrary AsRef<[u8]> types
- `copy_from_slice()` (L347): Creates owned copy

### Slicing Operations
- `slice()` (L373-413): Zero-copy substring with range bounds
- `slice_ref()` (L440-471): Create slice from existing &[u8] subset
- `split_off()` (L499-522): Split at index, returns tail
- `split_to()` (L548-571): Split at index, returns head
- `truncate()` (L592-605): Shorten buffer in place

### Conversions
- `try_into_mut()` (L641-647): Convert to BytesMut if unique
- `From<Vec<u8>>` (L964-996): Converts Vec, optimizes for exact-fit case
- `From<Box<[u8]>>` (L999-1027): Uses promotable vtables with pointer tagging

## Memory Management Patterns

### Reference Counting
- Atomic operations for thread safety
- Overflow protection (> usize::MAX >> 1 triggers abort)
- Release/Acquire ordering for proper synchronization

### Promotion Strategy
- Box<[u8]> starts as promotable (single-threaded)
- On clone, promotes to shared Arc-like storage
- Uses compare-and-swap for thread-safe promotion

### Pointer Tagging
- Low bit indicates storage type (ARC=0, VEC=1)
- `ptr_map()` function handles provenance correctly
- Separate implementations for miri vs normal builds

## Thread Safety
- `Send + Sync` bounds enforced by vtable contract
- All atomic operations use appropriate memory ordering
- Clone operations are lock-free and contention-resistant

## Notable Implementation Details

### Empty Buffer Handling
- `new_empty_with_ptr()` (L189-202): Creates zero-length buffer with specific pointer
- Special handling for empty slices in `slice_ref()`

### Compile-time Assertions
- Line 1374: Ensures `Shared` alignment is even (required for pointer tagging)
- Static assertions validate vtable assumptions

### Platform Considerations
- Conditional compilation for loom testing framework
- Miri-specific `ptr_map` implementation for better diagnostics