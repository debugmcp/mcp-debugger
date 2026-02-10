# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/sparc64.rs
@source-hash: d50816e830225779
@generated: 2026-02-09T18:02:09Z

## Purpose
Platform-specific type definitions and constants for NetBSD on SPARC64 architecture. Part of the libc crate's BSD Unix family hierarchy.

## Key Elements
- `__cpu_simple_lock_nv_t` (L3): Type alias for simple CPU locks, mapped to `c_uchar` for SPARC64
- `_ALIGNBYTES` (L7): Memory alignment constant set to `0xf` (15 bytes), marking 16-byte alignment boundaries

## Architecture Context
This file sits in the NetBSD-like BSD Unix hierarchy (`unix/bsd/netbsdlike/netbsd/`), providing SPARC64-specific implementations that override or supplement the generic NetBSD definitions.

## Dependencies
- `crate::prelude::*` (L1): Imports common libc types and traits

## Design Notes
- Uses `#[doc(hidden)]` on `_ALIGNBYTES` to hide from public documentation while keeping it public for crate-internal use
- Comment indicates desired `pub(crate)` visibility blocked by Rust version compatibility (targeting pre-1.18.0)