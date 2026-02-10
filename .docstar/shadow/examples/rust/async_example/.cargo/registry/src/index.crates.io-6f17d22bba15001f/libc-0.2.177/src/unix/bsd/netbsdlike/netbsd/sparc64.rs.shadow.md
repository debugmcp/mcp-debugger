# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/sparc64.rs
@source-hash: d50816e830225779
@generated: 2026-02-09T17:57:10Z

## Purpose
Platform-specific type definitions and constants for NetBSD on SPARC64 architecture. Part of the libc crate's Unix/BSD/NetBSD target hierarchy providing low-level system interface compatibility.

## Key Definitions
- `__cpu_simple_lock_nv_t` (L3): Type alias for CPU simple lock, defined as `c_uchar` for SPARC64 architecture
- `_ALIGNBYTES` (L7): Memory alignment constant set to `0xf` (15 bytes), representing SPARC64's 16-byte alignment requirement minus 1

## Dependencies
- `crate::prelude::*` (L1): Imports common libc types and utilities

## Architecture Notes
- SPARC64-specific implementations within NetBSD's type system
- Memory alignment follows SPARC64's natural 16-byte boundary requirements
- Simple lock implementation uses single byte representation for this architecture

## Visibility Design
- `_ALIGNBYTES` marked as `#[doc(hidden)]` but public due to Rust 1.18.0 compatibility constraint, ideally would be `pub(crate)`