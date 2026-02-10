# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/powerpc.rs
@source-hash: f064d935f416ca9f
@generated: 2026-02-09T17:57:10Z

**Purpose**: PowerPC-specific system constants for OpenBSD platform in the libc crate's Unix BSD family hierarchy.

**Architecture**: Part of libc's platform-specific constant definitions, positioned in the unix/bsd/netbsdlike/openbsd/powerpc hierarchy indicating inheritance from NetBSD-like systems.

**Key Constants**:
- `_ALIGNBYTES` (L3): Memory alignment boundary for PowerPC architecture, calculated as `size_of::<c_double>() - 1` (7 bytes for 8-byte double alignment)
- `_MAX_PAGE_SHIFT` (L4): Maximum page size shift value (12 = 4KB pages), used for virtual memory management

**Dependencies**: 
- `crate::prelude::*` (L1): Imports common libc types including `c_double` and `size_of`

**Usage Context**: These constants are consumed by higher-level libc functions for memory alignment calculations and page size determinations on PowerPC OpenBSD systems. The alignment constant ensures proper data structure padding, while the page shift constant supports virtual memory operations.