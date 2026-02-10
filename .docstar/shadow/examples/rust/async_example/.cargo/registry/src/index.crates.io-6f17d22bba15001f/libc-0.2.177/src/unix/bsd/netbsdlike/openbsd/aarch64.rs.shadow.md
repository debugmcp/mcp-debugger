# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/aarch64.rs
@source-hash: 3960096fb915d2f7
@generated: 2026-02-09T17:57:13Z

**Platform-specific signal context definitions for OpenBSD on AArch64**

This file provides OpenBSD AArch64-specific system type definitions and constants for the libc crate's Unix signal handling infrastructure.

## Key Types

**sigcontext (L6-15)**: Platform-specific signal context structure containing CPU state information when a signal is delivered. Fields include:
- `__sc_unused` (L7): Reserved field
- `sc_mask` (L8): Signal mask
- `sc_sp`, `sc_lr`, `sc_elr`, `sc_spsr` (L9-12): ARM64 register state (stack pointer, link register, exception link register, saved program status register)
- `sc_x` (L13): Array of 30 general-purpose ARM64 registers (X0-X29)
- `sc_cookie` (L14): Security cookie for stack protection

**ucontext_t (L3)**: Type alias mapping the standard POSIX user context type to the OpenBSD-specific sigcontext structure.

## Constants

- `_ALIGNBYTES` (L18): Platform-specific memory alignment constant derived from c_long size
- `_MAX_PAGE_SHIFT` (L20): Maximum page size shift value (4KB pages = 2^12)

## Architecture Context

Part of libc's hierarchical platform abstraction: `unix/bsd/netbsdlike/openbsd/aarch64.rs` indicates this targets OpenBSD on ARM64 architecture. Uses the `s!` macro (from crate prelude) for structure definition, likely for automatic trait implementations.

## Dependencies

- Imports `crate::prelude::*` (L1) for common libc types (`c_int`, `c_ulong`, `c_long`) and macros
- Uses `size_of` intrinsic for alignment calculation (L18)