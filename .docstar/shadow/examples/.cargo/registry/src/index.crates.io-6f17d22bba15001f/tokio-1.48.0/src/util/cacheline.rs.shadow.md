# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/cacheline.rs
@source-hash: 204079442ea5db45
@generated: 2026-02-09T18:06:49Z

## Purpose
Cache line alignment wrapper for preventing false sharing in concurrent data structures. Part of Tokio's internal synchronization utilities.

## Key Components

### CachePadded<T> Struct (L66-68)
Generic wrapper that aligns contained values to CPU cache line boundaries to prevent false sharing between threads. Uses architecture-specific alignment:
- **128 bytes**: x86_64, aarch64, powerpc64 (L22-29)
- **256 bytes**: s390x (L45)  
- **32 bytes**: arm, mips, mips64 (L37-40)
- **64 bytes**: All other architectures (L54-65)

### Constructor (L72-74)
- `new(value: T) -> CachePadded<T>`: Creates cache-aligned wrapper around value

### Trait Implementations
- **Deref (L77-83)**: Transparent access to wrapped value via `&T`
- **DerefMut (L85-89)**: Mutable access to wrapped value via `&mut T`
- **Standard traits (L5)**: Clone, Copy, Default, Hash, PartialEq, Eq for ergonomic usage

## Architecture Decisions

### Platform-Specific Alignment Strategy
Uses conditional compilation to match CPU cache line sizes:
- Intel Sandy Bridge+ spatial prefetcher optimization (128-byte alignment)
- ARM big.LITTLE "big" cores (128-byte cache lines)
- IBM s390x mainframe architecture (256-byte cache lines)
- Embedded/RISC architectures (32/64-byte cache lines)

### Performance Rationale
Extensively documented with external sources (L6-53) justifying alignment choices based on CPU microarchitecture specifications and established practice from Go runtime and Facebook Folly.

## Dependencies
- `std::ops::{Deref, DerefMut}` for transparent access pattern
- Conditional compilation based on target architecture

## Usage Pattern
Designed for wrapping shared data structures in concurrent contexts where false sharing between CPU cores would degrade performance. The `pub(crate)` visibility indicates internal Tokio usage for synchronization primitives.