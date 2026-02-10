# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/arm.rs
@source-hash: f064d935f416ca9f
@generated: 2026-02-09T17:57:11Z

## Purpose
Platform-specific constants for OpenBSD ARM architecture, part of the libc crate's BSD Unix family implementation. Provides memory alignment and page size definitions required for low-level system programming on OpenBSD ARM systems.

## Key Constants

**_ALIGNBYTES (L3)**: Memory alignment boundary constant calculated as `size_of::<c_double>() - 1`. Used for ensuring proper memory alignment for data structures on ARM architecture. The value represents the alignment mask needed for double-precision floating-point alignment.

**_MAX_PAGE_SHIFT (L5)**: Maximum page shift value set to 12, indicating that the maximum page size is 2^12 = 4096 bytes (4KB). This constant is used in memory management operations and virtual memory calculations.

## Dependencies
- `crate::prelude::*` (L1): Imports common libc types and utilities, including `c_double` and `size_of` function

## Architectural Context
This file is part of a hierarchical platform-specific organization:
- `unix/bsd/netbsdlike/openbsd/arm.rs` indicates it's specific to OpenBSD on ARM architecture
- These constants provide architecture and OS-specific values that differ from other platforms
- The alignment constant uses compile-time calculation to ensure proper memory layout for the target architecture