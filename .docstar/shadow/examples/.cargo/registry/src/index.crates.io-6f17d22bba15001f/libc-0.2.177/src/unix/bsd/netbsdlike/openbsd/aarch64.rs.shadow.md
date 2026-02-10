# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/aarch64.rs
@source-hash: 3960096fb915d2f7
@generated: 2026-02-09T18:02:10Z

## Purpose
Platform-specific definitions for OpenBSD on AArch64 (ARM64) architecture. Provides signal context structures and memory alignment constants for low-level system programming.

## Key Definitions

### Type Alias
- **ucontext_t** (L3): Type alias for `sigcontext`, providing compatibility for user context operations in signal handlers

### Structures
- **sigcontext** (L6-15): Signal context structure containing processor state during signal handling
  - `__sc_unused` (L7): Unused field for structure padding/compatibility
  - `sc_mask` (L8): Signal mask state
  - `sc_sp` (L9): Stack pointer register
  - `sc_lr` (L10): Link register (return address)
  - `sc_elr` (L11): Exception Link Register (exception return address)
  - `sc_spsr` (L12): Saved Program Status Register
  - `sc_x` (L13): Array of 30 general-purpose registers (X0-X29)
  - `sc_cookie` (L14): Stack protection cookie

### Constants
- **_ALIGNBYTES** (L18): Memory alignment mask calculated as `sizeof(c_long) - 1`, used for data structure alignment
- **_MAX_PAGE_SHIFT** (L20): Maximum page size shift value (12 = 4KB pages), defines virtual memory page boundaries

## Architecture Context
This file is part of the libc crate's BSD family hierarchy, specifically targeting OpenBSD's AArch64 port. The sigcontext structure layout matches OpenBSD kernel expectations for signal delivery and context switching on ARM64 processors.

## Dependencies
- Uses `crate::prelude::*` for common type definitions (`c_int`, `c_long`, `c_ulong`, `size_of`)
- Leverages the `s!` macro for structure definition (likely from parent modules)