# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/support/leaked_buffers.rs
@source-hash: 85ddbce3ff6b0c5c
@generated: 2026-02-09T18:06:49Z

## Primary Purpose
Test utility for creating memory buffers with arbitrary lifetimes while maintaining RAII cleanup semantics. Designed as a safer alternative to `Vec::leak()` for testing scenarios that need to satisfy address sanitizers.

## Key Components

### LeakedBuffers Struct (L10-12)
- **Purpose**: Container that manages leaked buffer lifetime and cleanup
- **Field**: `leaked_vecs: Vec<Box<[u8]>>` - stores boxed slices to prevent deallocation
- **Safety**: Must outlive all created buffer references to prevent use-after-free

### Constructor (L15-19)
- **Function**: `new()` - creates empty buffer manager
- **Returns**: Initialized `LeakedBuffers` with empty vector

### Buffer Creation (L20-25)
- **Function**: `create<'a>(&mut self, size: usize) -> &'a mut [u8]`
- **Safety**: Marked `unsafe` - caller must ensure returned slice doesn't outlive `self`
- **Implementation**: 
  - Allocates zeroed buffer of requested size
  - Stores as `Box<[u8]>` to prevent deallocation
  - Returns raw mutable slice with arbitrary lifetime `'a`
  - Uses `from_raw_parts_mut()` for lifetime transmutation

## Critical Safety Invariants
1. `LeakedBuffers` instance must outlive all created buffer references
2. Caller responsible for ensuring lifetime parameter `'a` doesn't exceed container lifetime
3. Buffer contents initialized to zero but mutable access allows arbitrary modification

## Architectural Pattern
RAII-based memory management for testing - buffers automatically freed when `LeakedBuffers` drops, satisfying address sanitizer requirements while providing leak-like semantics during test execution.