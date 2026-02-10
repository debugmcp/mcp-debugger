# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/tests/test_bytes_vec_alloc.rs
@source-hash: 5a0e77cab12b3237
@generated: 2026-02-09T18:11:29Z

## Purpose
Test file that validates memory allocation behavior in the `bytes` crate by implementing a custom global allocator that tracks all allocations and deallocations. Ensures that `Bytes` operations properly manage memory without leaks or double-frees.

## Key Components

### Ledger (L13-86)
Custom global allocator that wraps `System` allocator and maintains a tracking table:
- `alloc_table` (L14): Fixed-size array of 1M entries storing `(AtomicPtr<u8>, AtomicUsize)` pairs
- `insert()` (L27-40): Records new allocations by finding first available slot using atomic compare-exchange
- `remove()` (L42-62): Removes allocation record and returns original size for validation
- Uses `SeqCst` ordering for correctness over performance
- Panics on table overflow or missing entries to catch memory bugs

### GlobalAlloc Implementation (L65-86)
- `alloc()` (L66-71): Delegates to System allocator, then records allocation in ledger
- `dealloc()` (L73-85): Validates deallocation size matches original allocation size before delegating to System

### Test Cases (L88-146)
- `test_bytes_advance()` (L89-93): Tests `Bytes::advance()` memory handling
- `test_bytes_truncate()` (L96-100): Tests `Bytes::truncate()` memory handling  
- `test_bytes_truncate_and_advance()` (L103-108): Tests combined operations
- `test_bytes_into_vec()` (L120-146): Comprehensive test of `Vec::from(Bytes)` conversion covering different internal representations (KIND_VEC, KIND_ARC with various ref counts, offset handling)

### Utility Functions
- `invalid_ptr()` (L113-117): Creates dangling pointer from address for sentinel values

## Architecture Notes
- Uses `#![cfg(not(miri))]` to exclude from Miri (memory sanitizer) runs
- Global allocator replacement ensures all heap operations are monitored
- Fixed-size ledger trades memory for simplicity (no reclamation of freed slots)
- Atomic operations prevent race conditions in multi-threaded scenarios

## Dependencies
- `std::alloc`: Memory allocation primitives
- `std::sync::atomic`: Thread-safe operations
- `bytes`: Target crate being tested (Buf, Bytes types)