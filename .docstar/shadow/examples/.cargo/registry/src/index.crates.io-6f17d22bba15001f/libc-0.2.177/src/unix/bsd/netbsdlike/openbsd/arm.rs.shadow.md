# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/arm.rs
@source-hash: f064d935f416ca9f
@generated: 2026-02-09T18:02:08Z

## Purpose
Platform-specific constants for ARM architecture on OpenBSD systems within the libc crate. Provides memory alignment and page size configuration values needed for low-level system operations.

## Key Elements
- `_ALIGNBYTES` (L3): Memory alignment constant calculated as `size_of::<c_double>() - 1`, ensuring proper alignment for double-precision floating point values on ARM
- `_MAX_PAGE_SHIFT` (L5): Maximum page shift value set to 12, corresponding to 4KB pages (2^12 = 4096 bytes) typical for ARM systems

## Dependencies
- `crate::prelude::*` (L1): Imports common types and utilities from libc crate, including `c_double` type and `size_of` function

## Architecture Notes
- Part of nested module hierarchy: `unix/bsd/netbsdlike/openbsd/arm` indicating BSD-family Unix variant specificity
- Constants follow C naming convention with leading underscores
- `_ALIGNBYTES` uses `pub(crate)` visibility (internal to libc crate) while `_MAX_PAGE_SHIFT` is `pub` (external API)
- Values are compile-time constants essential for memory management and system calls on ARM OpenBSD