# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/tests/test_bytes_odd_alloc.rs
@source-hash: ad5df84a35038359
@generated: 2026-02-09T18:11:29Z

**Purpose:** Test suite for the `bytes` crate that validates proper handling of "odd" memory addresses (where the least significant bit is set) using a custom global allocator.

## Core Components

**Odd Allocator (L11-48):**
- Custom `GlobalAlloc` implementation that returns memory addresses with LSB set to 1
- `Odd` struct (L14) implements the allocator interface
- For single-byte aligned allocations, allocates extra byte and offsets pointer by 1 (L17-34)
- Corresponding deallocation logic reverses the offset (L36-47)
- Falls back to system allocator for other alignment requirements

## Test Coverage

**Allocator Validation (L50-55):**
- `sanity_check_odd_allocator`: Verifies the custom allocator produces odd-addressed pointers

**Bytes Lifecycle Tests (L57-97):**
- `test_bytes_from_vec_drop` (L58-61): Basic conversion and cleanup
- `test_bytes_clone_drop` (L64-68): Clone semantics with odd pointers
- `test_bytes_into_vec` (L71-97): Comprehensive Vec conversion testing across different internal states:
  - KIND_VEC direct conversion
  - KIND_ARC with reference count variations
  - SHARED_VTABLE scenarios
  - Split operations with non-zero offsets

**BytesMut Conversion Tests (L99-147):**
- `test_bytesmut_from_bytes_vec` (L100-107): KIND_VEC conversion
- `test_bytesmut_from_bytes_arc_1` (L110-118): KIND_ARC with single reference
- `test_bytesmut_from_bytes_arc_2` (L121-133): KIND_ARC with multiple references
- `test_bytesmut_from_bytes_arc_offset` (L136-147): Offset handling in conversions

## Key Dependencies
- `std::alloc::{GlobalAlloc, Layout, System}` for custom allocation
- `bytes::{Bytes, BytesMut}` for the types under test
- Conditional compilation excludes Miri due to custom allocator incompatibility (L4)

## Critical Constraints
- Tests specifically target memory safety with non-aligned pointers
- Validates that bytes crate internal pointer arithmetic works correctly with odd addresses
- All tests use 1024-byte vectors filled with value 33 for consistency
- Split operations test offset handling at byte position 20